// ============================================================
// supply.js — V2.5 补给线系统
// ============================================================
// 规则（见 GDD §六）：
//  - 军队驻于己方城市：补给线畅通。
//  - 军队在外：BFS 从军队所在城市出发，沿 CITY_LINKS 搜索；
//    若存在一条「路径上所有城市均为己方所有」的路径直达任一己方城市，则补给畅通。
//  - 距离 > 3 格（BFS 最短跳数）：补给线过长 → 粮草消耗 ×1.5。
//  - 无路可达：补给线被切断 → 战力 -30%，粮草消耗 ×2，每回合士气 -5。
// ============================================================
import { CITY_LINKS } from './data.js';

export const SUPPLY_LONG_RANGE = 3;       // >3 格视为过长
export const SUPPLY_CUTOFF_POWER_PENALTY = -0.30;  // 切断：战力 -30%
export const SUPPLY_CUTOFF_FOOD_MULT = 2.0;        // 切断：粮草 ×2
export const SUPPLY_LONG_FOOD_MULT = 1.5;          // 过长：粮草 ×1.5
export const SUPPLY_CUTOFF_MORALE_PENALTY = 5;     // 切断：每回合士气 -5

// BFS 计算 fromCity 到「任意 owner 为 factionId 的城市」的最短跳数；
// 路径上经过的中间城市必须同为己方（被敌方占据的城市切断补给通道）。
// 返回 { ok: bool, distance: int }
export function computeSupplyStatus(game, army) {
  const faction = army.faction;
  const startCity = game.cities.get(army.cityId);
  // 驻在己方城市：直接畅通
  if (startCity && startCity.owner === faction) {
    return { ok: true, cut: false, long: false, distance: 0 };
  }
  // BFS：只能经过己方城市（起点为军队所在城，允许作为出发点）
  const dist = { [army.cityId]: 0 };
  const queue = [army.cityId];
  while (queue.length > 0) {
    const cur = queue.shift();
    const d = dist[cur];
    const curCity = game.cities.get(cur);
    // 到达一个己方城市 → 补给线畅通（起点是军队所在城，不算数）
    if (cur !== army.cityId && curCity && curCity.owner === faction) {
      return { ok: true, cut: false, long: d > SUPPLY_LONG_RANGE, distance: d };
    }
    // 中途经过非己方城市 → 被切断，不得继续扩展该分支
    if (cur !== army.cityId && (!curCity || curCity.owner !== faction)) continue;
    // 继续扩展：只能经过己方城市（起点城可能不属己方，允许作为出发点）
    const links = CITY_LINKS[cur] || [];
    for (const nid of links) {
      if (dist[nid] !== undefined) continue;
      const nc = game.cities.get(nid);
      if (!nc) continue;
      // 中间节点必须是己方城市（军队所在起点例外已在入队前处理）
      if (cur !== army.cityId && nc.owner !== faction) continue;
      dist[nid] = d + 1;
      queue.push(nid);
    }
  }
  // 找不到通往己方城市的通路 → 补给被切断
  return { ok: false, cut: true, long: false, distance: -1 };
}

// 军队粮草消耗倍率（settleTurn 中按此放大 armyFoodCost）
export function supplyFoodMult(status) {
  if (!status || status.cut) return SUPPLY_CUTOFF_FOOD_MULT;
  if (status.long) return SUPPLY_LONG_FOOD_MULT;
  return 1.0;
}

// 军队战斗战力修正袋（供 game._buildAttackerSide 并入 bags）
export function supplyBattleBag(status) {
  if (!status || status.cut) return { allUnitMult: SUPPLY_CUTOFF_POWER_PENALTY };
  return {};
}

// ============================================================
// V14.0「霸业宏图」：补给系统优化 API
//  - 补给线：军队远离城池时补给效率下降
//  - 补给类型：粮食(维持兵力)/草料(维持骑兵)/箭矢(维持弓兵)
//  - 补给不足：士气下降、兵力损耗、战斗力下降
// ============================================================

/**
 * 获取补给线信息
 * @param {object} army - 军队对象
 * @param {object} city - 己方基地城市
 * @returns {object} { connected, distance, line: [cityId...], efficiency }
 */
export function getSupplyLine(army, city) {
  if (!army || !city) return { connected: false, distance: -1, line: [], efficiency: 0 };
  // 同城：补给线畅通
  if (army.cityId === city.id) {
    return { connected: true, distance: 0, line: [city.id], efficiency: 1.0 };
  }
  // BFS 沿 CITY_LINKS 搜索路径
  const dist = { [army.cityId]: 0 };
  const prev = {};
  const queue = [army.cityId];
  while (queue.length) {
    const cur = queue.shift();
    const d = dist[cur];
    if (cur === city.id) {
      // 回溯路径
      const line = [];
      let node = city.id;
      while (node != null) { line.unshift(node); node = prev[node]; }
      const eff = d > SUPPLY_LONG_RANGE ? 0.6 : (1 - d * 0.08);
      return { connected: true, distance: d, line, efficiency: Math.max(0.3, eff) };
    }
    for (const nid of (CITY_LINKS[cur] || [])) {
      if (dist[nid] !== undefined) continue;
      dist[nid] = d + 1;
      prev[nid] = cur;
      queue.push(nid);
    }
  }
  return { connected: false, distance: -1, line: [], efficiency: 0.4 };
}

/**
 * 计算军队补给效率（综合兵力消耗、补给类型）
 * @param {object} army - 军队对象（含 unitMix）
 * @returns {object} { efficiency, foodNeed, fodderNeed, arrowNeed, moralePenalty, attrition }
 */
export function calculateSupplyEfficiency(army) {
  const mix = army.unitMix || { infantry: 0, cavalry: 0, archer: 0 };
  const total = (mix.infantry || 0) + (mix.cavalry || 0) + (mix.archer || 0) || 1;
  // 各类补给需求
  const foodNeed = Math.round(total * 0.5);          // 粮食：维持全体兵力
  const fodderNeed = Math.round((mix.cavalry || 0) * 0.8); // 草料：骑兵
  const arrowNeed = Math.round((mix.archer || 0) * 0.6);  // 箭矢：弓兵
  // 补给效率基准 1.0，无补给则折减
  const baseEff = army.supplyEfficiency || 1.0;
  return {
    efficiency: baseEff,
    foodNeed,
    fodderNeed,
    arrowNeed,
    moralePenalty: baseEff < 0.7 ? 5 : (baseEff < 1.0 ? 2 : 0),
    attrition: baseEff < 0.7 ? Math.round(total * 0.03) : 0
  };
}

/**
 * 从城市向军队补给
 * @param {object} army - 军队对象
 * @param {object} city - 己方基地城市（含 food 等资源）
 * @returns {object} { ok, msg, amount }
 */
export function resupplyArmy(army, city) {
  if (!army || !city) return { ok: false, msg: '参数缺失' };
  if (army.cityId !== city.id) {
    return { ok: false, msg: '军队须在补给城市中方可补给' };
  }
  const need = calculateSupplyEfficiency(army);
  // 扣减城市粮草（city.food 由 game 层维护，这里估算）
  const available = city.food || 0;
  const take = Math.min(available, Math.round(need.foodNeed * 1.5));
  if (city.food != null) city.food -= take;
  army.supplyEfficiency = 1.0;
  army.morale = Math.min(100, (army.morale || 50) + 5);
  return { ok: true, msg: `已补给军队 ${take} 粮草`, amount: take };
}
