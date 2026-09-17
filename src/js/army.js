// ============================================================
// army.js — 军队模型、行军、战斗结算
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
    // unitMix: { infantry: n, cavalry: n, archer: n }
    this.unitMix = unitMix || this.defaultMix(troops);
    this.hasMoved = false;        // 本回合是否已行动
  }

  defaultMix(troops) {
    return { infantry: Math.floor(troops * 0.5), cavalry: Math.floor(troops * 0.2), archer: troops - Math.floor(troops * 0.5) - Math.floor(troops * 0.2) };
  }

  // 主兵种（用于克制判定）
  getMainUnit() {
    const mix = this.unitMix;
    let best = 'infantry', bestN = mix.infantry;
    if (mix.cavalry > bestN) { best = 'cavalry'; bestN = mix.cavalry; }
    if (mix.archer > bestN) { best = 'archer'; bestN = mix.archer; }
    return best;
  }

  // 平均兵种系数
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
// 纯函数：战斗结算
// attacker, defender: { troops, unitType(main), general:{command,force,intel}, terrain }
// defenderCity: 可选 { defense }
// ============================================================
export function computeBattle(attacker, defender, attackerTerrain, defenderTerrain) {
  const result = {
    attackerWin: false,
    attackerLoss: 0,
    defenderLoss: 0,
    battleLog: [],
    tactics: []
  };

  // 基础战斗力 = 兵力 × 兵种系数 × (统帅+武力)/100 × 地形修正 × 士气修正 × 补给修正
  function power(side, terrain, isAttacker) {
    let p = side.troops;
    p *= side.unitCoeff || 1.0;
    const gen = side.general || { command: 50, force: 50, intel: 50 };
    p *= (gen.command + gen.force) / 100;

    // 地形修正
    const t = TERRAIN[terrain] || TERRAIN.plain;
    if (terrain === 'mountain' && side.unitType === 'infantry') p *= 1.30;
    if (terrain === 'plain' && side.unitType === 'cavalry') p *= 1.30;
    if (terrain === 'river' && side.unitType === 'archer') p *= 1.20;
    if (terrain === 'desert') p *= (1 - 0.30); // 补给惩罚

    // 兵种克制
    const enemyType = isAttacker ? (side._enemyType || 'infantry') : (side._enemyType || 'infantry');
    if (COUNTER_RELATION[side.unitType] === enemyType) {
      p *= (1 + COUNTER_BONUS);
      result.tactics.push(`${UNIT_TYPES[side.unitType].name}克制${UNIT_TYPES[enemyType].name}，战力+25%`);
    }

    // 士气修正（简化：由将领智力影响）
    p *= (0.8 + gen.intel / 250);

    // 补给修正（进攻方行军后补给略降）
    if (isAttacker) p *= 0.9;

    return p;
  }

  // 设置敌方兵种类型用于克制
  attacker._enemyType = defender.unitType;
  defender._enemyType = attacker.unitType;

  let atkPower = power(attacker, defenderTerrain || 'plain', true);
  let defPower = power(defender, defenderTerrain || 'plain', false);

  // 守城防御加成
  if (defender.cityDefense) {
    defPower *= (1 + defender.cityDefense / 200);
    result.tactics.push(`守城防御加成（+${Math.round(defender.cityDefense / 2)}%）`);
  }

  // 奇袭/火攻（智力判定）
  const atkGen = attacker.general || { intel: 50 };
  if (atkGen.intel >= 75 && Math.random() < 0.4) {
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

  // 胜负判定
  const totalPower = atkPower + defPower;
  const atkRatio = atkPower / totalPower;

  // 双方伤亡：按对方战力占比
  result.attackerLoss = Math.round(attacker.troops * (defPower / totalPower) * (0.4 + Math.random() * 0.3));
  result.defenderLoss = Math.round(defender.troops * (atkPower / totalPower) * (0.4 + Math.random() * 0.3));

  // 最小伤亡保证
  result.attackerLoss = Math.max(result.attackerLoss, Math.round(attacker.troops * 0.1));
  result.defenderLoss = Math.max(result.defenderLoss, Math.round(defender.troops * 0.1));

  result.attackerWin = atkPower > defPower * 1.05; // 5%优势才判定胜利

  if (result.attackerWin) {
    result.battleLog.push(`我军攻破城池！`);
  } else if (atkPower >= defPower * 0.95) {
    result.battleLog.push(`两军相持，未分胜负……`);
    result.draw = true;
  } else {
    result.battleLog.push(`攻城受挫，我军被迫撤退！`);
  }

  // 清理临时字段
  delete attacker._enemyType;
  delete defender._enemyType;

  return result;
}

// 判断两城是否相邻
export function citiesAdjacent(cityId1, cityId2) {
  const links = CITY_LINKS[cityId1] || [];
  return links.includes(cityId2);
}

// 获取可移动目标城市
export function getMoveableCities(army, cities) {
  const cur = army.cityId;
  const links = CITY_LINKS[cur] || [];
  const result = [];
  for (const linkId of links) {
    const city = cities.get(linkId);
    if (!city) continue;
    // 可移动到己方城市或无主城市
    if (city.owner === army.faction || city.owner === null) {
      result.push(linkId);
    }
  }
  return result;
}

// 获取可攻击目标城市
export function getAttackableCities(army, cities) {
  const cur = army.cityId;
  const links = CITY_LINKS[cur] || [];
  const result = [];
  for (const linkId of links) {
    const city = cities.get(linkId);
    if (!city) continue;
    if (city.owner !== null && city.owner !== army.faction) {
      result.push(linkId);
    }
  }
  return result;
}
