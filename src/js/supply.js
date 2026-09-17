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
