// ============================================================
// fog.js — V2.5 战争迷雾
// ============================================================
// 视野规则（见 GDD §四）：
//  - 己方城市：周围 BFS 2 格可见。
//  - 己方军队：所在城市及其相邻 1 格可见。
//  - 同盟城市：周围 1 格可见。
//  - 谍报刺探成功：目标城市临时可见 3 回合（intelVision）。
//  - 己方已建关隘：额外 +1 格视野。
//  - 未探索：城市显示为「？」；军队不可见。
//  - 已探索但当前无视野：显示城市，但不显示实时兵力。
// 蛮族部落区域默认不可见，需探索邻近城市。
// ============================================================
import { CITY_LINKS, FACTIONS, getPassById } from './data.js';

const SELF_CITY_RANGE = 2;
const ARMY_RANGE = 1;
const ALLY_CITY_RANGE = 1;
const PASS_VISION_BONUS = 1;   // 己方关隘 +1 格
const INTEL_VISION_TURNS = 3;  // 谍报视野持续回合

// BFS：返回 { cityId: dist }（从 starts 出发的最短跳数）
function bfsDistances(starts, maxDist) {
  const dist = {};
  const queue = [];
  for (const s of starts) {
    if (dist[s] === undefined) { dist[s] = 0; queue.push(s); }
  }
  while (queue.length) {
    const cur = queue.shift();
    const d = dist[cur];
    if (d >= maxDist) continue;
    for (const n of (CITY_LINKS[cur] || [])) {
      if (dist[n] === undefined) { dist[n] = d + 1; queue.push(n); }
    }
  }
  return dist;
}

// 某派系当前可见的城市 id 集合（实时视野，不含历史探索）
export function computeVisibleCities(game, factionId) {
  const visible = new Set();
  const factionCities = game.getFactionCities(factionId).map(c => c.id);
  const allyCities = [];
  for (const fid of Object.keys(FACTIONS)) {
    if (fid === factionId) continue;
    const rel = game.diplomacy.getRelation(factionId, fid);
    if (rel && rel.alliance) {
      for (const c of game.getFactionCities(fid)) allyCities.push(c.id);
    }
  }

  // 己方城市 2 格
  const selfView = bfsDistances(factionCities, SELF_CITY_RANGE);
  for (const cid of Object.keys(selfView)) visible.add(cid);
  // 同盟城市 1 格
  const allyView = bfsDistances(allyCities, ALLY_CITY_RANGE);
  for (const cid of Object.keys(allyView)) visible.add(cid);
  // 己方军队所在城市 1 格
  const armyCities = game.getFactionArmies(factionId).map(a => a.cityId);
  const armyView = bfsDistances(armyCities, ARMY_RANGE);
  for (const cid of Object.keys(armyView)) visible.add(cid);
  // 己方关隘 +1 格（在己方城市半径上叠加：以关隘所在城市为中心再扩 1 格）
  const passCities = [];
  if (game.passes) {
    for (const p of Object.values(game.passes)) {
      if (p && p.built && p.owner === factionId) {
        const staticPass = getPassById(p.id);
        const anchor = staticPass ? staticPass.locationCity : null;
        if (anchor) passCities.push(anchor);
      }
    }
  }
  if (passCities.length) {
    const passView = bfsDistances(passCities, PASS_VISION_BONUS);
    for (const cid of Object.keys(passView)) visible.add(cid);
  }
  // 谍报临时视野
  const fog = game.fogOfWar || {};
  const intel = fog.intelVision || {};
  for (const cid of Object.keys(intel)) visible.add(cid);

  return visible;
}

// 是否曾探索过（可显示城市名/轮廓）
export function isExplored(game, cityId, factionId) {
  if (factionId === game.playerFaction) {
    const fog = game.fogOfWar || {};
    return Array.isArray(fog.explored) && fog.explored.includes(cityId);
  }
  // AI 不做迷雾限制
  return true;
}

// 每回合：把当前视野并入 explored，并递减谍报视野计时
export function settleFog(game, factionId) {
  const visible = computeVisibleCities(game, factionId);
  if (factionId === game.playerFaction) {
    if (!game.fogOfWar) game.fogOfWar = { explored: [], intelVision: {} };
    if (!Array.isArray(game.fogOfWar.explored)) game.fogOfWar.explored = [];
    for (const cid of visible) {
      if (!game.fogOfWar.explored.includes(cid)) game.fogOfWar.explored.push(cid);
    }
  }
  // 谍报视野倒计时
  const fog = game.fogOfWar || {};
  if (fog.intelVision) {
    for (const cid of Object.keys(fog.intelVision)) {
      fog.intelVision[cid]--;
      if (fog.intelVision[cid] <= 0) delete fog.intelVision[cid];
    }
  }
}

// 刺探成功：授予目标城市临时视野
export function grantIntelVision(game, cityId, turns = INTEL_VISION_TURNS) {
  if (!game.fogOfWar) game.fogOfWar = { explored: [], intelVision: {} };
  if (!game.fogOfWar.intelVision) game.fogOfWar.intelVision = {};
  game.fogOfWar.intelVision[cityId] = Math.max(game.fogOfWar.intelVision[cityId] || 0, turns);
}
