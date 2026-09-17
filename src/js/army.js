// ============================================================
// army.js — 军队模型、行军、战斗结算
//  - computeBattle：快速单回合结算（AI 战斗用，保留）
//  - startMultiBattle / resolveBattleRound / endMultiBattle：
//    最多 5 回合的逐步战斗（玩家交互 + AI 自动共用）
// ============================================================
import { UNIT_TYPES, COUNTER_RELATION, COUNTER_BONUS, TERRAIN, CITY_LINKS } from './data.js';

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

  getAvgUnitCoeff() {
    const mix = this.unitMix;
    const total = mix.infantry + mix.cavalry + mix.archer || 1;
    return (mix.infantry * UNIT_TYPES.infantry.coefficient +
            mix.cavalry * UNIT_TYPES.cavalry.coefficient +
            mix.archer * UNIT_TYPES.archer.coefficient) / total;
  }

  serialize() {
    return {
      id: this.id, faction: this.faction, generalId: this.generalId,
      cityId: this.cityId, troops: this.troops, unitMix: this.unitMix,
      hasMoved: this.hasMoved
    };
  }

  static deserialize(data) {
    const a = new Army({
      factionId: data.faction, generalId: data.generalId,
      cityId: data.cityId, troops: data.troops, unitMix: data.unitMix
    });
    a.id = data.id;
    a.hasMoved = data.hasMoved;
    return a;
  }
}

// ============================================================
// 通用工具
// ============================================================
// 加成封顶：同类加成总和上限 +100%（即倍率 ≤ 2.0），下限 -90%
export function clampBonus(sum) {
  return Math.max(-0.9, Math.min(1.0, sum));
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

    if (COUNTER_RELATION[side.unitType] === side._enemyType) {
      p *= (1 + COUNTER_BONUS);
      result.tactics.push(`${UNIT_TYPES[side.unitType].name}克制${UNIT_TYPES[side._enemyType].name}，战力+25%`);
    }
    p *= (0.8 + gen.intel / 250);
    if (isAttacker) p *= 0.9;
    // 守城/攻城（快速结算仅粗略）
    if (isAttacker) p *= (1 + clampBonus(sumBag(side.bags, 'siegeMult')));
    else p *= (1 + clampBonus(sumBag(side.bags, 'garrisonMult')));
    return p;
  }

  attacker._enemyType = defender.unitType;
  defender._enemyType = attacker.unitType;

  let atkPower = power(attacker, defenderTerrain || 'plain', true);
  let defPower = power(defender, defenderTerrain || 'plain', false);

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
