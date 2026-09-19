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
// 性能优化（fog.js 渲染优化·更多城市后）：
//   基准：原实现用 `queue.shift()` 弹出队首——shift 是 O(n) 数组搬移，
//   84 城规模下 BFS 每城 1~3 个邻居、队列峰值几十条，每回合每势力一次 BFS
//   （己方/同盟/军队/关隘共 4 次），shift 累计 O(n²) 搬移。
//   优化：改用队首读指针 head，只前移不搬移；队列自然增长到本回合结束即释放。
//   复杂度降为 O(城市数)，84 城规模下每回合视野计算省一次全表搬移。
function bfsDistances(starts, maxDist) {
  const dist = {};
  const queue = [];
  for (const s of starts) {
    if (dist[s] === undefined) { dist[s] = 0; queue.push(s); }
  }
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
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
  // 性能优化（fog.js V23.0·computeVisibleCities 同盟视野）：
  //   基准：原实现对每个同盟势力都调用 game.getFactionCities(fid)——内部是
  //     `[...cities.values()].filter(c=>c.owner===fid)` 全表过滤。设 C=城市数、
  //     A=同盟势力数，本函数每回合结算都被调用一次，多同盟局下是 O(A×C) 的重复
  //     全表扫描（每多一个同盟就把全部城市重扫一遍）。
  //   优化：先单次遍历 FACTIONS 建同盟势力集合 allySet（O(F)），再单次遍历
  //     game.cities.values() 把 owner∈allySet 的城市 id 收集到 allyCities（O(C)）。
  //     总复杂度从 O(A×C) 降为 O(F + C)，多同盟局每回合省 A-1 次全表过滤。
  const allySet = new Set();
  for (const fid of Object.keys(FACTIONS)) {
    if (fid === factionId) continue;
    const rel = game.diplomacy.getRelation(factionId, fid);
    if (rel && rel.alliance) allySet.add(fid);
  }
  const allyCities = [];
  if (allySet.size) {
    for (const c of game.cities.values()) {
      if (allySet.has(c.owner)) allyCities.push(c.id);
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
    const explored = fog.explored;
    if (!Array.isArray(explored)) return false;
    // BUG修复（fog.js V20.0 isExplored O(n) 线性判重）：
    //   基准：原实现 `explored.includes(cityId)` 每调用一次都对已探索城市数组做 O(n) 线性扫描。
    //   108 城/长局后 explored 常达上百，而本函数在地图渲染时对「每座可见城」各调一次，
    //   单帧即 O(n²)，拖动地图时明显卡顿。
    //   优化：settleFog 每回合已把 explored 重建为数组，并顺手缓存一份 Set 到
    //   fog._exploredSet；此处 O(1) 命中。缓存缺失（旧档/热重载）时兜底现建 Set。
    if (!fog._exploredSet || fog._exploredSet._src !== explored) {
      fog._exploredSet = new Set(explored);
      fog._exploredSet._src = explored;
    }
    return fog._exploredSet.has(cityId);
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
    // 性能优化（fog.js）：原实现每加一座城都用 Array.includes 线性判重（O(n)），
    // 72 城规模下每回合 O(n^2)。改为本地 Set 判重，O(1)/次，收尾一次性写回数组。
    const known = new Set(game.fogOfWar.explored);
    let added = false;
    for (const cid of visible) {
      if (!known.has(cid)) { known.add(cid); added = true; }
    }
    if (added) game.fogOfWar.explored = [...known];
  }
  // BUG修复（fog.js #1）：谍报临时视野倒计时此前对「每个势力」调用 settleFog 都执行一次
  //   （game.settleTurn 会按全部势力调用本函数），导致 INTEL_VISION_TURNS=3 的刺探视野
  //   在多势力局被按势力数快速扣光（实际一回合就失效）。
  // 修复：谍报视野是玩家侧单例状态（game.fogOfWar.intelVision），只在结算玩家势力时递减一次。
  if (factionId !== game.playerFaction) return;
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
