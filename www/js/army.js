// ============================================================
// army.js — 军队模型、行军、战斗结算
//  - computeBattle：快速单回合结算（AI 战斗用，保留）
//  - startMultiBattle / resolveBattleRound / endMultiBattle：
//    最多 5 回合的逐步战斗（玩家交互 + AI 自动共用）
// ============================================================
import { UNIT_TYPES, COUNTER_RELATION, COUNTER_BONUS, TERRAIN, CITY_LINKS, ADVANCEMENT_TREE } from './data.js';
import { getFormation } from './formation.js';
import { isNavalBattle, applyWaterTerrainMod, checkFireAttack, FIRE_ATTACK_PENALTY, NAVY_UNIT_KEYS } from './navy.js';

let armyIdCounter = 0;

export class Army {
  constructor({ factionId, generalId, cityId, troops, unitMix }) {
    this.id = 'army_' + (++armyIdCounter);
    this.faction = factionId;
    this.generalId = generalId;
    this.cityId = cityId;         // 当前所在城市
    this.troops = troops;         // 总兵力
    this.unitMix = unitMix || this.defaultMix(troops);
    this.hasMoved = false;        // 本回合是否已行动
    // ---- V2.0 ----
    this.formation = 'heyi';      // 阵型 id（默认鹤翼阵）
    // ---- V9.0：军团编制 ----
    this.legionId = null;         // 所属军团 id（null = 独立军队）
    this.formationExp = 0;       // 本军队阵型经验（会战累积）
    // 各兵种当前进阶阶数：0 基础 / 1 精锐 / 2 王牌
    this.unitTier = { infantry: 0, cavalry: 0, archer: 0 };
    // 待进阶队列：[{ unitType, targetTier, turnsLeft }]，1 回合后生效
    this.pendingUpgrades = [];
  }

  defaultMix(troops) {
    return { infantry: Math.floor(troops * 0.5), cavalry: Math.floor(troops * 0.2), archer: troops - Math.floor(troops * 0.5) };
  }

  getMainUnit() {
    const mix = this.unitMix;
    let best = 'infantry', bestN = mix.infantry;
    if (mix.cavalry > bestN) { best = 'cavalry'; bestN = mix.cavalry; }
    if (mix.archer > bestN) { best = 'archer'; bestN = mix.archer; }
    return best;
  }

  // 兵种进阶系数：tier>0 时该兵种系数 × ADVANCEMENT_TREE 对应 mult
  // 公式：coeff(type) = UNIT_TYPES[type].coefficient × (tier>0 ? tree[tier-1].mult : 1)
  unitCoefficient(unitType) {
    let mult = 1.0;
    const tier = this.unitTier[unitType] || 0;
    if (tier > 0) {
      const node = (ADVANCEMENT_TREE[unitType] || []).find(n => n.tier === tier);
      if (node) mult = node.mult;
    }
    return UNIT_TYPES[unitType].coefficient * mult;
  }

  getAvgUnitCoeff() {
    const mix = this.unitMix;
    const total = mix.infantry + mix.cavalry + mix.archer || 1;
    return (mix.infantry * this.unitCoefficient('infantry') +
            mix.cavalry * this.unitCoefficient('cavalry') +
            mix.archer * this.unitCoefficient('archer')) / total;
  }

  getFormationName() {
    return getFormation(this.formation).name;
  }

  // 申请某兵种进阶：需 city 校场等级满足；费用由 game 层扣减
  // 返回 { ok, msg }；成功后进入 pendingUpgrades，1 回合后生效
  requestUpgrade(unitType, drillLevel) {
    if (!ADVANCEMENT_TREE[unitType]) return { ok: false, msg: '兵种不存在' };
    const curTier = this.unitTier[unitType] || 0;
    if (curTier >= 2) return { ok: false, msg: '该兵种已是最高阶' };
    const node = ADVANCEMENT_TREE[unitType][curTier]; // 下一阶
    if (!node) return { ok: false, msg: '进阶已完成' };
    if (drillLevel < node.drillLevel) {
      return { ok: false, msg: `需校场达到 ${node.drillLevel} 级（当前 ${drillLevel} 级）` };
    }
    if (this.pendingUpgrades.some(p => p.unitType === unitType)) {
      return { ok: false, msg: '该兵种正在进阶整训中' };
    }
    this.pendingUpgrades.push({ unitType, targetTier: node.tier, turnsLeft: 1 });
    return { ok: true, msg: `开始整训进阶为 ${node.name}，1 回合后成军` };
  }

  // 回合推进：待进阶到位
  endTurn() {
    const done = [];
    this.pendingUpgrades = this.pendingUpgrades.filter(p => {
      p.turnsLeft--;
      if (p.turnsLeft <= 0) {
        this.unitTier[p.unitType] = p.targetTier;
        done.push(p);
        return false;
      }
      return true;
    });
    return done;
  }

  serialize() {
    return {
      id: this.id, faction: this.faction, generalId: this.generalId,
      cityId: this.cityId, troops: this.troops, unitMix: this.unitMix,
      hasMoved: this.hasMoved,
      formation: this.formation, unitTier: this.unitTier, pendingUpgrades: this.pendingUpgrades,
      legionId: this.legionId, formationExp: this.formationExp
    };
  }

  static deserialize(data) {
    const a = new Army({
      factionId: data.faction, generalId: data.generalId,
      cityId: data.cityId, troops: data.troops, unitMix: data.unitMix
    });
    a.id = data.id;
    a.hasMoved = data.hasMoved;
    // 旧存档补默认值
    a.formation = data.formation || 'heyi';
    a.unitTier = data.unitTier || { infantry: 0, cavalry: 0, archer: 0 };
    a.pendingUpgrades = Array.isArray(data.pendingUpgrades) ? data.pendingUpgrades : [];
    return a;
  }
}

// ============================================================
// 通用工具
// ============================================================
// 加成封顶：同类加成总和上限 +100%（即倍率 ≤ 2.0），下限 -90%
// V4.0: 保持不变，clampBonus 仍为 ±100% 同类上限
export function clampBonus(sum) {
  return Math.max(-0.9, Math.min(1.0, sum));
}

// V4.0: 总战力倍率硬封顶 3.0（300%），防止所有加成叠加后失衡
// 原值: 无封顶 → 新值: max 3.0 → 调整原因: 确保极端加成组合不会导致战斗结果不可预测
const TOTAL_POWER_CAP = 3.0;
function clampTotalPower(mult) {
  return Math.max(0.1, Math.min(TOTAL_POWER_CAP, mult));
}

function sumBag(bags, key) {
  let s = 0;
  for (const b of bags) s += (b[key] || 0);
  return s;
}

// ============================================================
// 快速单回合结算（AI 战斗用，保留）
// side 可携带 bags: [effectObj]（被动技能 + 科技），自动乘算
// ============================================================
export function computeBattle(attacker, defender, attackerTerrain, defenderTerrain) {
  const result = {
    attackerWin: false, attackerLoss: 0, defenderLoss: 0,
    battleLog: [], tactics: []
  };
  attacker.bags = attacker.bags || [];
  defender.bags = defender.bags || [];

  // V4.0: 0兵力边界处理 — 双方0兵则平局，一方0兵则另一方直接胜
  if (!attacker.troops || attacker.troops <= 0) {
    result.draw = true;
    result.battleLog.push('攻方无兵，战斗无法进行。');
    return result;
  }
  if (!defender.troops || defender.troops <= 0) {
    result.attackerWin = true;
    result.battleLog.push('守方无兵，城池不战而下！');
    result.defenderLoss = 0;
    result.attackerLoss = 0;
    return result;
  }

  function power(side, terrain, isAttacker) {
    let p = side.troops;
    p *= side.unitCoeff || 1.0;
    const gen = side.general || { command: 50, force: 50, intel: 50 };
    p *= (gen.command + gen.force) / 100;

    // 被动技能 + 科技：兵种 / 全兵种加成（封顶 +100%）
    const selfUnit = sumBag(side.bags, side.unitType + 'Mult') + sumBag(side.bags, 'allUnitMult');
    p *= (1 + clampBonus(selfUnit));

    const t = TERRAIN[terrain] || TERRAIN.plain;
    if (terrain === 'mountain' && side.unitType === 'infantry') p *= 1.30;
    if (terrain === 'plain' && side.unitType === 'cavalry') p *= 1.30;
    if (terrain === 'river' && side.unitType === 'archer') p *= 1.20;
    if (terrain === 'desert') p *= 0.70;

    // V6.0：水战地形加成——水军在水上+50%，陆军在水上-30%
    const isWater = (terrain === 'river');
    const waterMod = applyWaterTerrainMod(side.unitType, isWater);
    p *= waterMod;
    if (isWater && waterMod !== 1.0) {
      const unitName = UNIT_TYPES[side.unitType] ? UNIT_TYPES[side.unitType].name : side.unitType;
      if (NAVY_UNIT_KEYS.includes(side.unitType)) {
        result.tactics.push(`${unitName}水战加成！战力×${waterMod.toFixed(2)}`);
      } else {
        result.tactics.push(`我军不习水战，战力×${waterMod.toFixed(2)}`);
      }
    }

    if (COUNTER_RELATION[side.unitType] === side._enemyType) {
      p *= (1 + COUNTER_BONUS);
      result.tactics.push(`${UNIT_TYPES[side.unitType].name}克制${UNIT_TYPES[side._enemyType].name}，战力+25%`);
    }
    p *= (0.8 + gen.intel / 250);
    // V4.0: 攻城方惩罚 0.9→0.85（原值0.9，新值0.85，调整原因: 攻城需要至少1.5倍兵力才能稳胜，增大攻城方难度）
    if (isAttacker) p *= 0.85;
    // 守城/攻城（快速结算仅粗略）
    if (isAttacker) p *= (1 + clampBonus(sumBag(side.bags, 'siegeMult')));
    else p *= (1 + clampBonus(sumBag(side.bags, 'garrisonMult')));

    // V4.0: 总倍率硬封顶
    p = clampTotalPower(p / side.troops) * side.troops;
    return p;
  }

  attacker._enemyType = defender.unitType;
  defender._enemyType = attacker.unitType;

  let atkPower = power(attacker, defenderTerrain || 'plain', true);
  let defPower = power(defender, defenderTerrain || 'plain', false);

  // V6.0：水战火攻机制（赤壁式）——攻方智力高时概率火攻
  const battleIsNaval = isNavalBattle(attacker.cityId || '', defender.cityId || '');
  if (battleIsNaval) {
    const atkGenForFire = attacker.general || { intel: 50 };
    const windDir = Math.random() < 0.5 ? 'favorable' : 'unfavorable';
    const fireResult = checkFireAttack(atkGenForFire.intel, true, windDir);
    if (fireResult.success) {
      defPower *= FIRE_ATTACK_PENALTY;
      result.tactics.push(`★ 火攻！${atkGenForFire.name || '我军'}借风纵火，敌船大乱！防守战力-30%`);
      result.fireAttack = true;
      result.windDirection = windDir;
    }
  }

  if (defender.cityDefense) {
    defPower *= (1 + defender.cityDefense / 200);
    result.tactics.push(`守城防御加成（+${Math.round(defender.cityDefense / 2)}%）`);
  }

  const atkGen = attacker.general || { intel: 50 };
  if (atkGen.intel >= 75 && Math.random() < 0.4 + (attacker._ambushB || 0)) {
    atkPower *= 1.25;
    result.tactics.push(`${atkGen.name || '我军'}发动奇袭！战力+25%`);
  }
  const defGen = defender.general || { intel: 50 };
  if (defGen.intel >= 75 && Math.random() < 0.4) {
    defPower *= 1.25;
    result.tactics.push(`${defGen.name || '守军'}识破计谋，设伏反击！战力+25%`);
  }

  result.battleLog.push(`攻方战力：${Math.round(atkPower)}`);
  result.battleLog.push(`守方战力：${Math.round(defPower)}`);

  const totalPower = atkPower + defPower;
  result.attackerLoss = Math.round(attacker.troops * (defPower / totalPower) * (0.4 + Math.random() * 0.3));
  result.defenderLoss = Math.round(defender.troops * (atkPower / totalPower) * (0.4 + Math.random() * 0.3));
  result.attackerLoss = Math.max(result.attackerLoss, Math.round(attacker.troops * 0.1));
  result.defenderLoss = Math.max(result.defenderLoss, Math.round(defender.troops * 0.1));

  result.attackerWin = atkPower > defPower * 1.05;
  if (result.attackerWin) {
    result.battleLog.push('我军攻破城池！');
  } else if (atkPower >= defPower * 0.95) {
    result.battleLog.push('两军相持，未分胜负……');
    result.draw = true;
  } else {
    result.battleLog.push('攻城受挫，我军被迫撤退！');
  }

  delete attacker._enemyType;
  delete defender._enemyType;
  return result;
}

// ============================================================
// 多回合战斗引擎
// ============================================================
// side: {
//   faction, generalId, general:{command,force,intel,name},
//   troops, startTroops, unitType, unitCoeff,
//   bags:[effectObj...], cityDefense, isAttacker,
//   cooldowns:{}, pendingSkill, doubleForceThisBattle, ambushReady
// }
export function startMultiBattle(attacker, defender, opts = {}) {
  const battle = {
    attacker: { ...attacker, startTroops: attacker.troops, bags: attacker.bags.slice(), cooldowns: {}, doubleForceThisBattle: false, ambushReady: false, pendingSkill: null },
    defender: { ...defender, startTroops: defender.troops, bags: defender.bags.slice(), cooldowns: {}, doubleForceThisBattle: false, ambushReady: false, pendingSkill: null },
    round: 1,
    maxRounds: 5,
    terrain: opts.terrain || 'plain',
    siege: !!opts.siege,           // 攻城战有破城机制
    cityDefense: opts.cityDefense || 0,
    breach: 0,                     // 攻方累计破城值
    breached: false,
    log: [],
    phase: 'active',
    attackerWin: null,
    reason: ''
  };
  // 首轮奇必中技能（如假面破阵）
  if (attacker.firstRoutAmbush) battle.attacker.ambushReady = true;
  if (defender.firstRoutAmbush) battle.defender.ambushReady = true;
  battle.log.push(`—— 第1回合开战 ——`);
  return battle;
}

// 动作 → 名称
const ACTION_NAME = { storm: '猛攻', steady: '稳攻', defend: '防御', skill: '技能', retreat: '撤退' };
export function actionName(a) { return ACTION_NAME[a] || a; }

// 应用一方本回合 pendingSkill
function applyPendingSkill(side, battle) {
  if (!side.pendingSkill) return;
  const sk = side.pendingSkill;
  side.pendingSkill = null;
  if (sk.cooldown) side.cooldowns[sk.id] = sk.cooldown;
  const e = sk.effect || {};
  if (e.doubleForce) side.doubleForceThisBattle = true;
  if (e.firstRoutAmbush) side.ambushReady = true;
  // 其余效果并入 bags，本场持续
  side.bags.push(e);
  battle.log.push(`${side.general ? side.general.name : '我军'} 施展绝技【${sk.name}】！`);
}

// 冷却递减
function tickCooldown(side) {
  for (const k of Object.keys(side.cooldowns)) {
    if (--side.cooldowns[k] <= 0) delete side.cooldowns[k];
  }
}

// 计算某方本回合战力
function calcPower(side, enemyType, battle, action) {
  let p = Math.max(1, side.troops);
  p *= side.unitCoeff || 1.0;
  const gen = side.general || { command: 50, force: 50, intel: 50 };
  p *= (gen.command + gen.force) / 100;
  if (side.doubleForceThisBattle) p *= 2; // 武力翻倍

  // 兵种/全兵种（封顶+100%）
  const unitSum = sumBag(side.bags, side.unitType + 'Mult') + sumBag(side.bags, 'allUnitMult');
  p *= (1 + clampBonus(unitSum));

  // 动作倍率
  let actMult = 1.0;
  if (action === 'storm') actMult = 1.30;
  else if (action === 'defend') actMult = 0.70;
  p *= actMult;
  if (action === 'defend') p *= 1.30; // 防御减伤≈加防

  // 地形
  const terr = battle.terrain;
  if (terr === 'mountain' && side.unitType === 'infantry') p *= 1.30;
  if (terr === 'plain' && side.unitType === 'cavalry') p *= 1.30;
  if (terr === 'river' && side.unitType === 'archer') p *= 1.20;
  if (terr === 'desert') p *= 0.70;

  // V6.0：水战地形加成
  const isWater = (terr === 'river');
  if (isWater) {
    const waterMod = applyWaterTerrainMod(side.unitType, true);
    p *= waterMod;
  }

  // 兵种克制
  if (COUNTER_RELATION[side.unitType] === enemyType) p *= (1 + COUNTER_BONUS);

  // 攻城/守城（未破城前生效）
  const isAttacker = side === battle.attacker;
  if (battle.siege && !battle.breached) {
    if (isAttacker) p *= (1 + clampBonus(sumBag(side.bags, 'siegeMult')));
    else {
      p *= (1 + clampBonus(sumBag(side.bags, 'garrisonMult')));
      if (side.cityDefense) p *= (1 + side.cityDefense / 200);
    }
  }

  // 奇袭（首轮必中或概率）
  if (side.ambushReady) {
    p *= 1.25;
    battle.log.push(`${gen.name || '我军'}奇袭得手！战力+25%`);
    side.ambushReady = false;
  } else if (gen.intel >= 75) {
    const ambushChance = Math.min(0.9, 0.35 + sumBag(side.bags, 'ambushBonus') * 0.5);
    if (Math.random() < ambushChance) {
      p *= 1.20;
      battle.log.push(`${gen.name || '我军'}发动奇袭！战力+20%`);
    }
  }

  // 智力士气
  p *= (0.8 + gen.intel / 250);
  // V4.0: 总倍率硬封顶 3.0（与 computeBattle 一致，防止叠加失衡）
  p = clampTotalPower(p / Math.max(1, side.troops)) * Math.max(1, side.troops);
  return p;
}

// 一回合结算；atkAction/defAction ∈ storm|steady|defend|retreat
// 返回 { ended, attackerWin }
export function resolveBattleRound(battle, atkAction, defAction) {
  if (battle.phase !== 'active') return { ended: true, attackerWin: battle.attackerWin };
  if (atkAction === 'retreat') {
    return endMultiBattle(battle, false, '攻方主动撤退');
  }
  applyPendingSkill(battle.attacker, battle);
  applyPendingSkill(battle.defender, battle);

  const A = battle.attacker, D = battle.defender;
  const aPow = calcPower(A, D.unitType, battle, atkAction);
  const dPow = calcPower(D, A.unitType, battle, defAction);

  // 自损系数（猛攻代价高，防御代价低）
  const selfLoss = { storm: 0.22, steady: 0.14, defend: 0.07 };
  const aLoseF = (selfLoss[atkAction] || 0.14) * (atkAction === 'storm' ? 1 : 1);
  const dLoseF = (selfLoss[defAction] || 0.14);

  const total = aPow + dPow || 1;
  // 攻方对守方造成的杀伤，与守方对攻方的杀伤
  const dmgToD = Math.round(A.troops * (aPow / total) * aLoseF * (0.85 + Math.random() * 0.3));
  const dmgToA = Math.round(D.troops * (dPow / total) * dLoseF * (0.85 + Math.random() * 0.3));
  A.troops = Math.max(0, A.troops - dmgToA);
  D.troops = Math.max(0, D.troops - dmgToD);

  // 破城值累积（仅攻城战、未破城）
  if (battle.siege && !battle.breached) {
    battle.breach += dmgToD * 0.5;
    if (battle.breach >= battle.cityDefense) {
      battle.breached = true;
      battle.log.push(`★ 攻方血洗城墙，破城！巷战展开，守方城防加成消失！`);
    }
  }

  battle.log.push(`第${battle.round}回合：攻方[${actionName(atkAction)}]剩${A.troops}，守方[${actionName(defAction)}]剩${D.troops}`);
  tickCooldown(A);
  tickCooldown(D);
  battle.round++;

  // 结束判定
  if (A.troops < A.startTroops * 0.10) return endMultiBattle(battle, false, '攻方溃不成军，败退！');
  if (D.troops < D.startTroops * 0.10) return endMultiBattle(battle, true, '守方兵力崩溃！');
  if (battle.round > battle.maxRounds) {
    // 5 回合打完
    if (battle.siege && !battle.breached) {
      return endMultiBattle(battle, false, '久攻不下，攻方收兵。');
    }
    const aRatio = A.troops / A.startTroops;
    const dRatio = D.troops / D.startTroops;
    if (aRatio >= dRatio) return endMultiBattle(battle, true, '攻方力压守军，得胜！');
    return endMultiBattle(battle, false, '两军对峙，守方成功守住！');
  }
  return { ended: false };
}

function endMultiBattle(battle, attackerWin, reason) {
  battle.phase = 'ended';
  battle.attackerWin = attackerWin;
  battle.reason = reason;
  battle.log.push(`—— 战斗结束：${reason} ——`);
  return { ended: true, attackerWin, reason };
}

// AI/自动模式为一方挑选动作（基于剩余兵力与战局）
export function autoAction(battle, side) {
  const s = side === 'attacker' ? battle.attacker : battle.defender;
  const enemy = side === 'attacker' ? battle.defender : battle.attacker;
  const ratio = s.troops / s.startTroops;
  // 濒死且有可用主动技能则用技能
  if (ratio < 0.5 && s.pendingSkill) return 'skill';
  if (side === 'attacker') {
    // 优势猛攻，劣势稳扎
    if (s.troops > enemy.troops * 1.3) return 'storm';
    if (s.troops < enemy.troops * 0.7) return 'steady';
    return 'steady';
  } else {
    // 守方偏防御
    if (s.troops < enemy.troops * 0.6) return 'defend';
    return 'steady';
  }
}

// 判断两城是否相邻
export function citiesAdjacent(cityId1, cityId2) {
  const links = CITY_LINKS[cityId1] || [];
  return links.includes(cityId2);
}

export function getMoveableCities(army, cities) {
  const cur = army.cityId;
  const links = CITY_LINKS[cur] || [];
  const result = [];
  for (const linkId of links) {
    const city = cities.get(linkId);
    if (!city) continue;
    if (city.owner === army.faction || city.owner === null) result.push(linkId);
  }
  return result;
}

export function getAttackableCities(army, cities) {
  const cur = army.cityId;
  const links = CITY_LINKS[cur] || [];
  const result = [];
  for (const linkId of links) {
    const city = cities.get(linkId);
    if (!city) continue;
    if (city.owner !== null && city.owner !== army.faction) result.push(linkId);
  }
  return result;
}

// ============================================================
// V14.0「霸业宏图」：武将单挑系统
//  - 战斗开始前，双方武力最高武将有概率触发单挑
//  - 三轮比试，每轮攻击/防御判定，伤害 = 武力差 + 随机值
//  - 胜方士气+15，败方士气-15，败将概率受伤/被俘
// ============================================================

// 单挑触发概率（基础30%，双方武力均高时更高）
const DUEL_BASE_CHANCE = 0.30;

/**
 * 判断是否可触发武将单挑
 * @param {object} attackerGeneral - 攻方武将（需含 effForce/force/level）
 * @param {object} defenderGeneral - 守方武将
 * @returns {bool}
 */
export function canTriggerDuel(attackerGeneral, defenderGeneral) {
  if (!attackerGeneral || !defenderGeneral) return false;
  const aForce = attackerGeneral.effForce || attackerGeneral.force || 0;
  const dForce = defenderGeneral.effForce || defenderGeneral.force || 0;
  // 双方武力均 ≥40 才可能单挑；武力越高概率越大
  if (aForce < 40 || dForce < 40) return false;
  const avg = (aForce + dForce) / 2;
  const chance = Math.min(0.8, DUEL_BASE_CHANCE + (avg - 50) / 200);
  return Math.random() < chance;
}

/**
 * 执行一场武将单挑
 * @param {object} generalA - 攻方武将
 * @param {object} generalB - 守方武将
 * @returns {object} { winner, loser, rounds, log, aInjured, bInjured, captured }
 */
export function executeDuel(generalA, generalB) {
  const aForce = (generalA.effForce || generalA.force || 50);
  const bForce = (generalB.effForce || generalB.force || 50);
  // 等级/装备修正：每级武力判定 +1
  const aLevel = generalA.level || 1;
  const bLevel = generalB.level || 1;
  const aAtk = aForce + aLevel;
  const bAtk = bForce + bLevel;

  let aHp = 100, bHp = 100;
  const rounds = [];
  for (let i = 1; i <= 3; i++) {
    // 每轮：双方攻击
    const aDmg = Math.max(5, Math.round((aAtk - bAtk) + (Math.random() * 30 - 10)));
    const bDmg = Math.max(5, Math.round((bAtk - aAtk) + (Math.random() * 30 - 10)));
    bHp -= aDmg;
    aHp -= bDmg;
    rounds.push({ round: i, aDmg, bDmg, aHp: Math.max(0, aHp), bHp: Math.max(0, bHp) });
    if (aHp <= 0 || bHp <= 0) break;
  }

  let winner, loser;
  if (aHp >= bHp) { winner = generalA; loser = generalB; }
  else { winner = generalB; loser = generalA; }

  // 败将受伤概率 40%
  const injured = Math.random() < 0.40;
  // 败将被俘概率 20%
  const captured = Math.random() < 0.20;

  return {
    winner, loser, rounds,
    winnerName: winner.name,
    loserName: loser.name,
    aInjured: (generalA === loser) && injured,
    bInjured: (generalB === loser) && injured,
    captured: captured && (loser === generalB || generalB === loser),
    log: [
      `—— 武将单挑：${generalA.name} VS ${generalB.name} ——`,
      ...rounds.map(r => `第${r.round}轮：${generalA.name} 造成${r.aDmg}伤，${generalB.name} 造成${r.bDmg}伤`),
      `结果：${winner.name} 获胜！`
    ]
  };
}

/**
 * 将单挑结果应用到战斗
 * @param {object} battle - 战斗对象（含 attacker/defender 士气袋）
 * @param {object} duelResult - executeDuel 返回值
 * @returns {object} 应用后的 battle
 */
export function applyDuelResult(battle, duelResult) {
  if (!battle || !duelResult) return battle;
  // 胜方士气+15，败方士气-15
  if (battle.attacker && battle.attacker.general && duelResult.winner === battle.attacker.general) {
    battle.attackerMoraleBonus = (battle.attackerMoraleBonus || 0) + 15;
    battle.defenderMoraleBonus = (battle.defenderMoraleBonus || 0) - 15;
  } else {
    battle.defenderMoraleBonus = (battle.defenderMoraleBonus || 0) + 15;
    battle.attackerMoraleBonus = (battle.attackerMoraleBonus || 0) - 15;
  }
  // 败将受伤标记
  if (duelResult.aInjured && battle.attacker.general) battle.attacker.general.wounded = Math.max(battle.attacker.general.wounded || 0, 3);
  if (duelResult.bInjured && battle.defender.general) battle.defender.general.wounded = Math.max(battle.defender.general.wounded || 0, 3);
  // 战报
  battle.duelResult = duelResult;
  battle.log = battle.log || [];
  battle.log.push(...duelResult.log);
  return battle;
}

// ============================================================
// V14.0「霸业宏图」：兵种进阶系统增强 API
// ============================================================

/**
 * 获取某基础兵种的进阶路径
 * @param {string} unitType - 基础兵种 id（infantry/cavalry/archer）
 * @returns {Array<{tier,name,mult,drillLevel,costMoney,costFood,description}>}
 */
export function getAdvancementPath(unitType) {
  return (ADVANCEMENT_TREE[unitType] || []).map(n => ({ ...n }));
}

/**
 * 检查某兵种是否可进阶到目标阶
 * @param {object} unit - 军队对象（含 unitTier）或 {unitType, unitTier}
 * @param {number} targetTier - 目标阶数 1 或 2
 * @param {number} drillLevel - 校场等级
 * @returns {ok, msg}
 */
export function canAdvance(unit, targetTier, drillLevel = 0) {
  const unitType = unit.mainUnit || (unit.getMainUnit ? unit.getMainUnit() : unit.unitType);
  const tree = ADVANCEMENT_TREE[unitType] || [];
  const node = tree.find(n => n.tier === targetTier);
  if (!node) return { ok: false, msg: '该兵种无此进阶阶' };
  const curTier = (unit.unitTier && unit.unitTier[unitType]) || 0;
  if (curTier >= targetTier) return { ok: false, msg: '已达成该阶' };
  if (curTier !== targetTier - 1) return { ok: false, msg: '需先完成前一阶进阶' };
  if (drillLevel < node.drillLevel) {
    return { ok: false, msg: `需校场达到 ${node.drillLevel} 级（当前 ${drillLevel} 级）` };
  }
  return { ok: true, node };
}

/**
 * 执行兵种进阶（落账到 unit.unitTier）
 * @param {object} unit - 军队对象
 * @param {number} targetTier - 目标阶
 * @param {number} drillLevel - 校场等级
 * @returns {ok, msg}
 */
export function advanceUnit(unit, targetTier, drillLevel = 0) {
  const chk = canAdvance(unit, targetTier, drillLevel);
  if (!chk.ok) return chk;
  const unitType = unit.mainUnit || (unit.getMainUnit ? unit.getMainUnit() : unit.unitType);
  if (!unit.unitTier) unit.unitTier = { infantry: 0, cavalry: 0, archer: 0 };
  unit.unitTier[unitType] = targetTier;
  return { ok: true, msg: `${UNIT_TYPES[unitType].name} 进阶为【${chk.node.name}】` };
}

/**
 * 判断某兵种是否为精锐（tier≥1）
 */
export function isElite(unit) {
  const unitType = unit.mainUnit || (unit.getMainUnit ? unit.getMainUnit() : unit.unitType);
  const tier = (unit.unitTier && unit.unitTier[unitType]) || 0;
  return tier >= 1;
}
