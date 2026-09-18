// ============================================================
// legion.js — 军团会战系统 [V9.0]
//
// 历史考据：
//  南北朝大战频繁——沙苑之战（537）、河桥之战（538）、邙山之战（543）、
//  玉璧之战（546）、韩陵之战（532），动辄十万大军对垒。
//  北周府兵制：一柱国统二大将，一将军统二开府，开府各领一军，众不满五万。
//  故设计：最多 5 支军队合编为一军团，总兵力上限 50000。
//
// 军团编制：
//  - 最多 5 支同势力军队组成一个军团；军团长 = 统帅最高的武将。
//  - 军团总兵力 = 各军队兵力之和，硬上限 50000。
//  - 双方军团同处一城且总兵力≥10000 触发大会战。
//
// 会战四阶段：列阵 → 交锋 → 决战 → 追击。
//  会战结果 = 双方战力对比 + 阵型克制 + 武将技能/智力 + 地形。
// ============================================================
import { FORMATIONS, FORMATION_COUNTER, FORMATION_COUNTER_BONUS, getFormationBag, confuseEnemyMult, enemyCounterPenalty, maxFormationLevel } from './formation.js';
import { clampBonus } from './army.js';

export const LEGION_MAX_ARMIES = 5;       // 一个军团最多 5 支军队
export const LEGION_MAX_TROOPS = 50000;  // 军团总兵力上限
export const MASS_BATTLE_TROOP_MIN = 10000; // 双方总兵力≥此值触发大会战
export const LEGION_EXP_PER_LEVEL = 200;

let legionIdCounter = 0;

// ============================================================
// 军团类
// ============================================================
export class Legion {
  constructor({ factionId, name }) {
    this.id = 'legion_' + (++legionIdCounter);
    this.faction = factionId;
    this.name = name || '军团';
    this.armyIds = [];        // 军队 id 列表（最多5）
    this.commanderId = null;  // 军团长（统帅最高）
    this.lieutenantIds = [];  // 副将
    this.formation = 'heyi';  // 军团阵型
    this.formationLevel = 1;  // 军团阵型等级
    this.exp = 0;
    this.level = 1;
    this.cityId = null;       // 当前所在城市（各军队同城才同处）
    this.battles = 0;
    this.wins = 0;
  }

  size() { return this.armyIds.length; }
  isFull() { return this.armyIds.length >= LEGION_MAX_ARMIES; }

  // 军团总兵力（由 game 传入 armies 计算）
  totalTroops(armies) {
    let s = 0;
    for (const id of this.armyIds) {
      const a = armies.find(x => x.id === id);
      if (a) s += Math.max(0, a.troops);
    }
    return Math.min(LEGION_MAX_TROOPS, s);
  }

  serialize() {
    return {
      id: this.id, faction: this.faction, name: this.name,
      armyIds: this.armyIds, commanderId: this.commanderId,
      lieutenantIds: this.lieutenantIds, formation: this.formation,
      formationLevel: this.formationLevel, exp: this.exp, level: this.level,
      cityId: this.cityId, battles: this.battles, wins: this.wins
    };
  }
  static deserialize(d) {
    const L = new Legion({ factionId: d.faction, name: d.name });
    L.id = d.id;
    L.armyIds = Array.isArray(d.armyIds) ? d.armyIds : [];
    L.commanderId = d.commanderId || null;
    L.lieutenantIds = Array.isArray(d.lieutenantIds) ? d.lieutenantIds : [];
    L.formation = d.formation || 'heyi';
    L.formationLevel = d.formationLevel || 1;
    L.exp = d.exp || 0; L.level = d.level || 1;
    L.cityId = d.cityId || null;
    L.battles = d.battles || 0; L.wins = d.wins || 0;
    return L;
  }
}

// 重置 id 计数器（读档后避免 id 冲突）
export function resetLegionIdCounter(maxId) {
  if (typeof maxId === 'number') legionIdCounter = maxId;
}

// ============================================================
// 军团编制操作（在 Game 上下文调用）
// ============================================================
// 创建军团：从一个已有军队起编
export function createLegion(game, armyId, name) {
  const army = game.armies.find(a => a.id === armyId);
  if (!army) return { ok: false, msg: '军队不存在' };
  if (army.legionId) return { ok: false, msg: '该军队已在军团中' };
  const L = new Legion({ factionId: army.faction, name: name || (FACTION_NAME(game, army.faction) + '军团') });
  L.armyIds.push(army.id);
  L.cityId = army.cityId;
  army.legionId = L.id;
  _pickCommander(game, L);
  game.legions.set(L.id, L);
  game.pushLog(`◆ 组建【${L.name}】，初编 ${army.troops} 人。`);
  return { ok: true, legion: L };
}

// 加入军团
export function addArmyToLegion(game, legionId, armyId) {
  const L = game.legions.get(legionId);
  if (!L) return { ok: false, msg: '军团不存在' };
  const army = game.armies.find(a => a.id === armyId);
  if (!army) return { ok: false, msg: '军队不存在' };
  if (army.legionId) return { ok: false, msg: '该军队已在其他军团' };
  if (army.faction !== L.faction) return { ok: false, msg: '非同势力' };
  if (L.isFull()) return { ok: false, msg: `军团已达上限（${LEGION_MAX_ARMIES} 军）` };
  if (L.cityId && army.cityId !== L.cityId) return { ok: false, msg: '须与军团同城方能编入' };
  L.armyIds.push(army.id);
  army.legionId = legionId;
  _pickCommander(game, L);
  game.pushLog(`【${L.name}】增编一军，总兵力 ${L.totalTroops(game.armies)}。`);
  return { ok: true };
}

// 解散军团（军队回归独立）
export function disbandLegion(game, legionId) {
  const L = game.legions.get(legionId);
  if (!L) return { ok: false, msg: '军团不存在' };
  for (const id of L.armyIds) {
    const a = game.armies.find(x => x.id === id);
    if (a) a.legionId = null;
  }
  game.legions.delete(legionId);
  game.pushLog(`【${L.name}】解散。`);
  return { ok: true };
}

// 军队脱离军团
export function removeArmyFromLegion(game, legionId, armyId) {
  const L = game.legions.get(legionId);
  if (!L) return { ok: false, msg: '军团不存在' };
  L.armyIds = L.armyIds.filter(id => id !== armyId);
  const a = game.armies.find(x => x.id === armyId);
  if (a) a.legionId = null;
  if (L.armyIds.length === 0) { game.legions.delete(legionId); return { ok: true, msg: '军团无军，已解散' }; }
  _pickCommander(game, L);
  return { ok: true };
}

// 推举军团长：统帅（effCommand）最高者
function _pickCommander(game, L) {
  let best = null;
  for (const id of L.armyIds) {
    const a = game.armies.find(x => x.id === id);
    if (!a) continue;
    const g = game.generals.get(a.generalId);
    if (!g) continue;
    const cmd = g.effCommand || g.command;
    if (!best || cmd > (best.cmd)) best = { cmd, genId: a.generalId };
  }
  L.commanderId = best ? best.genId : null;
  // 副将：除军团长外其他军队主将
  L.lieutenantIds = L.armyIds.map(id => {
    const a = game.armies.find(x => x.id === id);
    return a ? a.generalId : null;
  }).filter(gid => gid && gid !== L.commanderId);
}

function FACTION_NAME(game, fid) {
  return (game.factionNameOf && game.factionNameOf(fid)) || fid;
}

// 军团阵型升级
export function upgradeLegionFormation(game, legionId) {
  const L = game.legions.get(legionId);
  if (!L) return { ok: false, msg: '军团不存在' };
  const techs = game.techs || [];
  const maxLv = maxFormationLevel(L.formation, techs);
  if (L.formationLevel >= maxLv) return { ok: false, msg: `该阵型已达当前等级上限（${maxLv}级）` };
  const needExp = LEGION_EXP_PER_LEVEL * L.formationLevel;
  if (L.exp < needExp) return { ok: false, msg: `阵型经验不足（需${needExp}，当前${Math.floor(L.exp)}）` };
  const needMoney = 300 + 200 * L.formationLevel;
  const res = game.getPlayerRes();
  if (res.money < needMoney) return { ok: false, msg: `金钱不足（需${needMoney}金）` };
  res.money -= needMoney;
  L.exp -= needExp;
  L.formationLevel++;
  game.pushLog(`◆【${L.name}】阵型【${(FORMATIONS[L.formation]||{}).name||L.formation}】升至 ${L.formationLevel} 级！`);
  return { ok: true, msg: `阵型升至 ${L.formationLevel} 级` };
}

// ============================================================
// 会战引擎
// ============================================================
// 组装一方军团战力
function _legionPower(game, L, enemyL, terrain) {
  const armies = L.armyIds.map(id => game.armies.find(a => a.id === id)).filter(Boolean);
  let power = 0;
  let totalTroops = 0;
  const gen = game.generals.get(L.commanderId);
  const cmd = gen ? (gen.effCommand || gen.command) : 50;
  const force = gen ? (gen.effForce || gen.force) : 50;
  const intel = gen ? (gen.effIntel || gen.intel) : 50;

  // 军团阵型效果袋
  const enemyFm = enemyL ? enemyL.formation : null;
  const fmBag = getFormationBag(L.formation, enemyFm, L.formationLevel);
  let mult = 1 + clampBonus(
    (fmBag.infantryMult || 0) + (fmBag.cavalryMult || 0) + (fmBag.archerMult || 0) + (fmBag.allUnitMult || 0)
  );

  for (const a of armies) {
    totalTroops += a.troops;
    const coeff = a.getAvgUnitCoeff ? a.getAvgUnitCoeff() : 1.0;
    power += a.troops * coeff;
  }
  power *= mult;
  // 军团长统武加成
  power *= (cmd + force) / 100;
  // 智力/士气
  power *= (0.8 + intel / 250);
  // 副将加成（每名副将 +3%）
  power *= (1 + (L.lieutenantIds.length * 0.03));
  // 军团等级加成
  power *= (1 + (L.level - 1) * 0.05);
  // 地形
  if (terrain === 'plain') power *= 1.10;
  if (terrain === 'mountain') power *= 0.95;
  // 玄襄迷惑：折减敌方
  // 被克制防御折减
  power *= enemyCounterPenalty(L.formation, enemyFm);
  return { power: Math.round(power), totalTroops: Math.min(LEGION_MAX_TROOPS, totalTroops), general: gen };
}

// 执行一场军团大会战。
// 返回完整四阶段结算结果（供 UI 渲染战报与动画）。
export function resolveLegionBattle(game, attackerL, defenderL, terrain) {
  const atk = _legionPower(game, attackerL, defenderL, terrain);
  const def = _legionPower(game, defenderL, attackerL, terrain);

  // 玄襄迷惑折减
  const atkConfuse = confuseEnemyMult(defenderL.formation, defenderL.formationLevel);
  const defConfuse = confuseEnemyMult(attackerL.formation, attackerL.formationLevel);
  const atkPower = Math.round(atk.power * atkConfuse);
  const defPower = Math.round(def.power * defConfuse);

  const totalPower = atkPower + defPower || 1;
  const phases = [];
  let atkTroops = atk.totalTroops;
  let defTroops = def.totalTroops;

  // —— 列阵阶段 ——
  phases.push({
    phase: 'zhènliè', name: '列阵',
    text: `双方于 ${terrainName(terrain)} 列阵对峙。攻方 ${(FORMATIONS[attackerL.formation]||{}).name}，守方 ${(FORMATIONS[defenderL.formation]||{}).name}。`
  });

  // —— 交锋阶段：前锋接战，初伤 ——
  const aLoss1 = Math.round(atkTroops * (defPower / totalPower) * 0.12 * (0.85 + Math.random() * 0.3));
  const dLoss1 = Math.round(defTroops * (atkPower / totalPower) * 0.12 * (0.85 + Math.random() * 0.3));
  atkTroops = Math.max(0, atkTroops - aLoss1);
  defTroops = Math.max(0, defTroops - dLoss1);
  phases.push({
    phase: 'jiaofeng', name: '交锋',
    text: `前锋接战！攻方折损 ${aLoss1}，守方折损 ${dLoss1}。`
  });

  // —— 决战阶段：主力对冲，决胜 ——
  const aLoss2 = Math.round(atkTroops * (defPower / totalPower) * 0.22 * (0.85 + Math.random() * 0.3));
  const dLoss2 = Math.round(defTroops * (atkPower / totalPower) * 0.22 * (0.85 + Math.random() * 0.3));
  atkTroops = Math.max(0, atkTroops - aLoss2);
  defTroops = Math.max(0, defTroops - dLoss2);
  const attackerWin = atkPower > defPower * 1.05;
  const draw = !attackerWin && atkPower >= defPower * 0.95;
  phases.push({
    phase: 'juezhan', name: '决战',
    text: `主力对冲！${attackerWin ? '攻方势如破竹！' : (draw ? '旗鼓相当，未分胜负。' : '守方坚不可摧！')} 攻方余 ${atkTroops}，守方余 ${defTroops}。`
  });

  // —— 追击阶段 ——
  let pursuitLoss = 0;
  if (attackerWin && !draw) {
    pursuitLoss = Math.round(defTroops * (0.25 + Math.random() * 0.15));
    defTroops = Math.max(0, defTroops - pursuitLoss);
  } else if (!attackerWin && !draw) {
    pursuitLoss = Math.round(atkTroops * (0.25 + Math.random() * 0.15));
    atkTroops = Math.max(0, atkTroops - pursuitLoss);
  }
  phases.push({
    phase: 'zhuiji', name: '追击',
    text: attackerWin && !draw ? `胜方追击溃兵，扩大战果！守方再损 ${pursuitLoss}。`
      : (!draw ? `败方溃退，胜方乘势掩杀，败方再损 ${pursuitLoss}。`
      : '两军各自收兵，未行追击。')
  });

  const attackerLoss = atk.totalTroops - atkTroops;
  const defenderLoss = def.totalTroops - defTroops;

  // 阵型克制提示
  const counterNote = [];
  if (attackerL.formation && defenderL.formation) {
    const ac = (FORMATIONS[attackerL.formation] || {}).counter;
    if (ac === defenderL.formation) counterNote.push(`攻方【${(FORMATIONS[attackerL.formation]||{}).name}】克制守方阵型，攻击+${Math.round(FORMATION_COUNTER_BONUS*100)}%！`);
    const dc = (FORMATIONS[defenderL.formation] || {}).counter;
    if (dc === attackerL.formation) counterNote.push(`守方【${(FORMATIONS[defenderL.formation]||{}).name}】克制攻方阵型，攻击+${Math.round(FORMATION_COUNTER_BONUS*100)}%！`);
    if (attackerL.formation === 'xuanxiang') counterNote.push(`攻方【玄襄阵】疑兵惑敌！`);
    if (defenderL.formation === 'xuanxiang') counterNote.push(`守方【玄襄阵】疑兵惑敌！`);
  }

  return {
    attackerWin, draw,
    attackerL, defenderL,
    attackerPower: atkPower, defenderPower: defPower,
    attackerLoss, defenderLoss,
    attackerRemain: atkTroops, defenderRemain: defTroops,
    phases, counterNote,
    attackerCommander: atk.general ? atk.general.name : '攻方',
    defenderCommander: def.general ? def.general.name : '守方',
    terrain
  };
}

function terrainName(t) {
  return { plain: '平原', mountain: '山地', river: '水泽', desert: '荒漠', city: '城下' }[t] || '旷野';
}

// 会战结算到 army 兵力与武将经验（game 层调用）
export function applyLegionBattleResult(game, result) {
  const atkL = result.attackerL, defL = result.defenderL;
  // 按比例把损失分摊到各军队
  _distributeLoss(game, atkL, result.attackerLoss);
  _distributeLoss(game, defL, result.defenderLoss);

  // 经验/战功
  const winL = result.attackerWin && !result.draw ? atkL : defL;
  const loseL = result.attackerWin && !result.draw ? defL : atkL;
  const expGain = result.draw ? 60 : 150;
  winL.exp += expGain;
  winL.battles++; winL.wins++;
  loseL.battles++;
  // 军团升级
  while (winL.exp >= LEGION_EXP_PER_LEVEL * winL.level) {
    winL.exp -= LEGION_EXP_PER_LEVEL * winL.level;
    winL.level++;
  }
  // 武将经验
  for (const L of [atkL, defL]) {
    const g = game.generals.get(L.commanderId);
    if (g) {
      const isWin = (L === winL);
      const ups = g.gainExp(isWin ? 120 + Math.round(Math.max(result.attackerLoss, result.defenderLoss) * 0.03) : 40);
      if (ups > 0) game.pushLog(`◆【${g.name}】身历大会战，升至 ${g.level} 级！`);
    }
  }
  // 胜方缴获
  if (!result.draw) {
    const loot = 500 + Math.round(result.defenderLoss * 0.5);
    const res = game.factionRes.get(atkL.faction);
    if (res && result.attackerWin) res.money += loot;
    const res2 = game.factionRes.get(defL.faction);
    if (res2 && !result.attackerWin) res2.money += Math.round(loot * 0.6);
  }
  // 武将被俘/阵亡概率（败方军团长）
  if (!result.draw) {
    const loseGen = game.generals.get(loseL.commanderId);
    if (loseGen && Math.random() < 0.15) {
      loseGen.faction = null;
      loseGen.inArmy = null;
      game.pushLog(`★【${loseGen.name}】于大会战中力竭被俘！`);
    } else if (loseGen && Math.random() < 0.08) {
      loseGen.faction = null; loseGen.inArmy = null;
      game.pushLog(`★【${loseGen.name}】于大会战中壮烈殉国！`);
    }
  }
}

function _distributeLoss(game, L, totalLoss) {
  if (totalLoss <= 0) return;
  const armies = L.armyIds.map(id => game.armies.find(a => a.id === id)).filter(Boolean);
  const total = armies.reduce((s, a) => s + a.troops, 0) || 1;
  for (const a of armies) {
    const share = Math.round(totalLoss * (a.troops / total));
    a.troops = Math.max(0, a.troops - share);
  }
}
