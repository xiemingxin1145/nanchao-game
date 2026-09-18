// ============================================================
// barbarian.js — V2.5 蛮族部落
// ============================================================
// 蛮族交互（见 GDD §七）：
//  征讨 attack：派邻近军队攻击；胜则缴获金钱/粮草，蛮族兵力折损、关系 -20。
//  招安 recruit：关系≥30 且耗 2000 金 → 成为附庸，每回合进贡 300 金。
//  贸易 trade：耗 500 金 → 关系 +10，换取特产粮草。
//  关系 < 0 时蛮族每回合概率劫掠相邻己方城市。
// 平衡：蛮族初始兵力 ≤ 15000（硬上限 20000）。
// ============================================================
import {
  BARBARIAN_TRIBES, getBarbarianById,
  BARBARIAN_ATTACK_LOOT, BARBARIAN_RECRUIT_COST, BARBARIAN_RECRUIT_REL_MIN,
  BARBARIAN_VASSAL_TRIBUTE, BARBARIAN_TRADE_COST, FACTIONS
} from './data.js';
import { computeBattle } from './army.js';

// 初始化运行时蛮族表
export function initBarbarianTribes() {
  return BARBARIAN_TRIBES.map(t => ({
    id: t.id, name: t.name, anchorCity: t.anchorCity,
    specialty: t.specialty, unitType: t.unitType, desc: t.desc,
    troops: t.troops, relation: t.relation, vassal: false
  }));
}

function findTribe(game, tribeId) {
  return (game.barbarianTribes || []).find(t => t.id === tribeId) || null;
}

// BUG修复（barbarian.js）：热座/模组/势力灭亡场景下 FACTIONS[factionId] 可能为 undefined，
//   日志里直接取 .name 会抛 TypeError。统一用此小工具安全取势力名。
function _factionName(fid) {
  return (FACTIONS[fid] && FACTIONS[fid].name) || fid || '本国';
}

// 选出某势力驻在蛮族锚点城市（或相邻）的最强军队
function pickArmyForBarbarian(game, factionId, anchorCityId) {
  const candidates = game.getFactionArmies(factionId).filter(a => a.cityId === anchorCityId);
  candidates.sort((a, b) => b.troops - a.troops);
  return candidates[0] || null;
}

// 征讨蛮族
export function attackBarbarian(game, factionId, tribeId) {
  const tribe = findTribe(game, tribeId);
  if (!tribe) return { ok: false, msg: '蛮族部落不存在' };
  if (tribe.vassal) return { ok: false, msg: '该部落已是附庸，不宜征讨' };
  const army = pickArmyForBarbarian(game, factionId, tribe.anchorCity);
  // BUG修复（barbarian.js #4a）：锚点城被摧毁/数据缺失时 game.cities.get 返回 undefined，
  //   直接取 .name 会抛 TypeError。此处做空值兜底。
  const anchorCity = game.cities.get(tribe.anchorCity);
  if (!anchorCity) return { ok: false, msg: `【${tribe.anchorCity}】已无城邑，无法征讨` };
  if (!army) return { ok: false, msg: `需在【${anchorCity.name}】驻扎一支军队方可征讨` };

  const attGen = game.generals.get(army.generalId);
  const attData = {
    troops: army.troops,
    unitType: army.getMainUnit(),
    unitCoeff: army.getAvgUnitCoeff(),
    bags: [game.getTechBag(factionId)],
    general: attGen ? {
      command: attGen.effCommand, force: attGen.effForce,
      intel: attGen.effIntel, name: attGen.name
    } : { command: 50, force: 50, intel: 50 },
    cityDefense: 0
  };
  const barbUnit = tribe.unitType === 'mixed' ? 'cavalry' : tribe.unitType;
  const defData = {
    troops: tribe.troops,
    unitType: barbUnit,
    unitCoeff: 1.1,
    bags: [],
    general: { command: 70, force: 70, intel: 50, name: tribe.name },
    cityDefense: 0
  };
  const result = computeBattle(attData, defData, 'plain', 'plain');
  army.troops = Math.max(0, army.troops - result.attackerLoss);

  if (result.attackerWin && !result.draw) {
    const loot = Math.round(tribe.troops * BARBARIAN_ATTACK_LOOT);
    const res = game.factionRes.get(factionId);
    res.money += loot;
    tribe.troops = Math.max(2000, Math.round(tribe.troops - result.defenderLoss * 1.5));
    tribe.relation = Math.max(-100, tribe.relation - 20);
    game.pushLog(`⚔ ${_factionName(factionId)} 大破${tribe.name}！缴获 ${loot} 金，蛮族远遁。`);
    if (army.troops <= 0) {
      army.destroyed = true;
      if (attGen) { attGen.inArmy = null; attGen.location = army.cityId; }
    }
    return { ok: true, msg: `征讨大捷！缴获 ${loot} 金`, win: true, loot };
  }
  tribe.relation = Math.max(-100, tribe.relation - 5);
  game.pushLog(`${_factionName(factionId)} 征${tribe.name}受挫，损兵折将。`);
  if (army.troops <= 0) {
    army.destroyed = true;
    if (attGen) { attGen.inArmy = null; attGen.location = army.cityId; }
  }
  return { ok: true, msg: '征讨未果，收兵回营', win: false };
}

// 招安蛮族
export function recruitBarbarian(game, factionId, tribeId) {
  const tribe = findTribe(game, tribeId);
  if (!tribe) return { ok: false, msg: '蛮族部落不存在' };
  if (tribe.vassal) return { ok: false, msg: '该部落已是附庸' };
  if (tribe.relation < BARBARIAN_RECRUIT_REL_MIN) {
    return { ok: false, msg: `关系不足（需≥${BARBARIAN_RECRUIT_REL_MIN}，当前 ${tribe.relation}）` };
  }
  const res = game.factionRes.get(factionId);
  if (!res || res.money < BARBARIAN_RECRUIT_COST) {
    return { ok: false, msg: `招安需 ${BARBARIAN_RECRUIT_COST} 金` };
  }
  res.money -= BARBARIAN_RECRUIT_COST;
  tribe.vassal = true;
  tribe.relation = Math.min(100, tribe.relation + 30);
  // BUG修复（barbarian.js #4b）：记录宗主势力——否则下回合 settleBarbarians 会把
  //   进贡错误地发给玩家势力（即使是 AI 招安的附庸也给玩家进贡）。
  tribe.suzerain = factionId;
  game.pushLog(`🏮 ${_factionName(factionId)} 招抚${tribe.name}成功！其岁岁进贡，可供驱策。`);
  return { ok: true, msg: `${tribe.name} 归附！每回合进贡 ${BARBARIAN_VASSAL_TRIBUTE} 金` };
}

// 贸易蛮族
export function tradeBarbarian(game, factionId, tribeId) {
  const tribe = findTribe(game, tribeId);
  if (!tribe) return { ok: false, msg: '蛮族部落不存在' };
  const res = game.factionRes.get(factionId);
  if (!res || res.money < BARBARIAN_TRADE_COST) {
    return { ok: false, msg: `贸易需 ${BARBARIAN_TRADE_COST} 金` };
  }
  res.money -= BARBARIAN_TRADE_COST;
  tribe.relation = Math.min(100, tribe.relation + 10);
  res.food += 1000;
  game.pushLog(`🤝 与${tribe.name}互市，换得${tribe.specialty}与粮草（+1000 粮，关系+10）。`);
  return { ok: true, msg: `贸易成功：获得${tribe.specialty}，粮草 +1000` };
}

// 回合结算：附庸进贡 + 敌对蛮族劫掠
export function settleBarbarians(game) {
  for (const tribe of (game.barbarianTribes || [])) {
    // 附庸进贡（进贡给招安它的宗主——见 recruitBarbarian 记录的 tribe.suzerain；
    //   旧存档无 suzerain 字段时兜底给玩家，保持向后兼容）
    // BUG修复（barbarian.js #4b）：原先无条件发给 game.playerFaction，导致 AI 招安的附庸
    //   也向玩家进贡（钱算错势力）。
    if (tribe.vassal) {
      const suzerain = tribe.suzerain || game.playerFaction;
      const res = game.factionRes.get(suzerain);
      if (res) res.money += BARBARIAN_VASSAL_TRIBUTE;
    }
    // 敌对蛮族劫掠：关系 < 0 且非附庸时，15% 概率袭扰相邻城市
    if (!tribe.vassal && tribe.relation < 0 && Math.random() < 0.15) {
      const city = game.cities.get(tribe.anchorCity);
      if (city && city.owner === game.playerFaction) {
        const raid = Math.round(tribe.troops * 0.1);
        const loss = Math.min(city.garrison, raid);
        city.garrison -= loss;
        city.morale = Math.max(0, city.morale - 5);
        game.pushLog(`🔥 ${tribe.name} 南下劫掠 ${city.name}！守军折损 ${loss}，民心浮动。`);
      }
    }
  }
}
