// ============================================================
// logistics.js — V24.0.0 屯田后勤系统深化
// （屯田制 / 粮道系统 / 后勤补给 / 要塞城防深化 / 烽火台预警）
//
// 设计考据：
//  南北朝兵燹连年，军粮为军国之本。曹魏屯田许下，岁得谷百万斛；
//  诸葛武侯渭滨屯田，为久驻之基。漕运粮道，千里馈粮，十不存二三；
//  故邓艾著《济河论》，开渠屯粮，为灭吴之基。
//  关隘要塞，如潼关、剑阁、峡口，一夫当关；烽火相望，边警立至。
//
// 与既有系统关系：
//  - supply.js 已有基础补给线 BFS 计算（computeSupplyStatus）；
//    本系统在其上叠加「屯田产出」「粮道损耗」「要塞升级」「烽火预警」四层深化。
//  - pass.js 已有基础关隘建造；本系统提供关隘升级（耐久/守军加成）。
//  - city.js 已有 defense/garrison；本系统叠加「城防工事等级」加成袋。
//
// 数值平衡约定（可复算）：
//  - 屯田每级每回合产粮 = 城市 agri × 0.5 × 等级；消耗劳动力 = 等级 × 200 人。
//  - 粮道每远 1 格，运输损耗 +5%；断粮道则士气每回合 -8（叠加 supply.js 的 -5）。
//  - 要塞升级每级：耐久 +50%、守军加成 +10%、攻方惩罚 +5%。
//  - 烽火台：边境城市建成后，敌军入侵提前 2 回合预警，守军士气 +5。
//
// 状态约定（挂在 game.logistics，未挂载时成就/结局防御式读取空值）：
//   this.tuntianLevels   { cityId: 0..5 }      屯田等级
//   this.fortressLevels   { passId: 0..3 }      要塞升级等级
//   this.beaconTowers    { cityId: bool }      烽火台
//   this.grainRoads      { armyId: {distance, cut, loss} }  粮道状态缓存
//   this.v24_stats       全局统计（成就/结局读取）
// ============================================================
import { CITY_LINKS, FACTIONS } from './data.js';

// ---------- 屯田制 ----------
export const V24_TUNTIAN_MAX = 5;
export const V24_TUNTIAN_LABOR_PER_LV = 200;   // 每级屯田消耗劳动力（人）
export const V24_TUNTIAN_FOOD_BASE = 0.5;       // 每级屯田每回合产粮 = agri × 0.5 × lv

// 屯田升级费用（从 lv-1 升到 lv）
export function v24TuntianCost(toLevel) {
  return { money: 300 * toLevel, food: 500 * toLevel };
}

// 屯田每回合产粮量（基于城市农业值）
export function v24TuntianYield(city, level) {
  const lv = Math.max(0, Math.min(V24_TUNTIAN_MAX, level || 0));
  if (lv === 0 || !city) return 0;
  const agri = city.agri || 0;
  return Math.round(agri * V24_TUNTIAN_FOOD_BASE * lv);
}

// 屯田消耗劳动力
export function v24TuntianLabor(level) {
  return Math.max(0, level || 0) * V24_TUNTIAN_LABOR_PER_LV;
}

// ---------- 粮道系统 ----------
export const V24_GRAIN_ROAD_LOSS_PER_STEP = 0.05;   // 每远1格损耗+5%
export const V24_GRAIN_ROAD_CUT_MORALE_PENALTY = 8;  // 断粮道每回合士气-8

// BFS 计算 army 到最近己方产粮城市的粮道距离与损耗
// 返回 { connected, distance, loss, path }
export function v24ComputeGrainRoad(game, army) {
  if (!army || !army.cityId) return { connected: false, distance: -1, loss: 1.0, path: [] };
  const faction = army.faction;
  const startCity = game.cities.get(army.cityId);
  // 驻在己方城市：粮道畅通，无损耗
  if (startCity && startCity.owner === faction) {
    return { connected: true, distance: 0, loss: 0, path: [army.cityId] };
  }
  // BFS：从军队所在城出发，沿 CITY_LINKS 搜索己方城市
  const dist = { [army.cityId]: 0 };
  const prev = {};
  const queue = [army.cityId];
  while (queue.length > 0) {
    const cur = queue.shift();
    const d = dist[cur];
    const curCity = game.cities.get(cur);
    // 到达己方城市 → 粮道畅通
    if (cur !== army.cityId && curCity && curCity.owner === faction) {
      // 回溯路径
      const path = [];
      let node = cur;
      while (node != null) { path.unshift(node); node = prev[node]; }
      const loss = Math.min(0.5, d * V24_GRAIN_ROAD_LOSS_PER_STEP);
      return { connected: true, distance: d, loss, path };
    }
    // 中途经过非己方城市 → 切断，不继续扩展
    if (cur !== army.cityId && (!curCity || curCity.owner !== faction)) continue;
    // 扩展邻居
    for (const nid of (CITY_LINKS[cur] || [])) {
      if (dist[nid] !== undefined) continue;
      const nc = game.cities.get(nid);
      if (!nc) continue;
      // 中间节点必须是己方城市（起点例外）
      if (cur !== army.cityId && nc.owner !== faction) continue;
      dist[nid] = d + 1;
      prev[nid] = cur;
      queue.push(nid);
    }
  }
  // 找不到己方城市 → 粮道断绝
  return { connected: false, distance: -1, loss: 1.0, path: [] };
}

// ---------- 要塞/城防深化 ----------
export const V24_FORTRESS_MAX = 3;
export const V24_FORTRESS_DURABILITY_PER_LV = 0.5;   // 每级耐久+50%
export const V24_FORTRESS_GARRISON_PER_LV = 0.10;    // 每级守军加成+10%
export const V24_FORTRESS_ATTACKER_PENALTY_PER_LV = 0.05; // 每级攻方惩罚+5%

// 要塞升级费用
export function v24FortressCost(toLevel) {
  return { money: 500 * toLevel, food: 800 * toLevel };
}

// 要塞效果袋
export function v24FortressBag(level) {
  const lv = Math.max(0, Math.min(V24_FORTRESS_MAX, level || 0));
  return {
    durabilityMult: 1 + lv * V24_FORTRESS_DURABILITY_PER_LV,
    garrisonBonus: lv * V24_FORTRESS_GARRISON_PER_LV,
    attackerPenalty: lv * V24_FORTRESS_ATTACKER_PENALTY_PER_LV
  };
}

// ---------- 烽火台 ----------
export const V24_BEACON_COST_MONEY = 800;
export const V24_BEACON_COST_FOOD = 1200;
export const V24_BEACON_WARNING_TURNS = 2;   // 提前预警回合数
export const V24_BEACON_MORALE_BONUS = 5;     // 守军士气加成

// 烽火台效果袋
export function v24BeaconBag(hasBeacon) {
  if (!hasBeacon) return {};
  return {
    warningTurns: V24_BEACON_WARNING_TURNS,
    garrisonMorale: V24_BEACON_MORALE_BONUS
  };
}

// ============================================================
// LogisticsSystem 类
// ============================================================
export class LogisticsSystem {
  constructor() {
    this.tuntianLevels = {};     // { cityId: 0..5 }
    this.fortressLevels = {};    // { passId: 0..3 }
    this.beaconTowers = {};      // { cityId: true }
    this.grainRoads = {};        // { armyId: {distance, cut, loss} }
    this.v24_stats = {
      totalTuntianLevels: 0,      // 累计屯田等级总和
      maxTuntianSingle: 0,        // 单城最高屯田等级
      tuntianCities: 0,           // 有屯田的城市数
      grainRoadsMaintained: 0,    // 维护粮道次数
      grainRoadCuts: 0,           // 粮道被断次数
      fortressUpgrades: 0,        // 要塞升级次数
      beaconBuilt: 0,             // 烽火台建造数
      totalFoodProduced: 0,       // 屯田累计产粮
      maxFoodPerTurn: 0,          // 单回合最高屯田产粮
      frontierArmiesSupplied: 0   // 前线补给次数
    };
  }

  // ---------- 1. 屯田制 ----------
  // 在指定城市建立/升级屯田
  buildTuntian(game, factionId, cityId) {
    const city = game.cities.get(cityId);
    if (!city || city.owner !== factionId) {
      return { ok: false, msg: '须在己方城市设屯田' };
    }
    const cur = this.tuntianLevels[cityId] || 0;
    if (cur >= V24_TUNTIAN_MAX) {
      return { ok: false, msg: `屯田已达最高等级（${V24_TUNTIAN_MAX}级）` };
    }
    const next = cur + 1;
    const cost = v24TuntianCost(next);
    const res = game.factionRes.get(factionId);
    if (!res) return { ok: false, msg: '资源不存在' };
    if (res.money < cost.money) return { ok: false, msg: `金钱不足（需 ${cost.money} 金）` };
    if ((city.pop || 0) < v24TuntianLabor(next)) {
      return { ok: false, msg: `人口不足（需劳动力 ${v24TuntianLabor(next)} 人）` };
    }
    // 扣除资源
    res.money -= cost.money;
    city.pop = (city.pop || 0) - v24TuntianLabor(next);
    this.tuntianLevels[cityId] = next;
    // 更新统计
    this.v24_stats.totalTuntianLevels++;
    this.v24_stats.maxTuntianSingle = Math.max(this.v24_stats.maxTuntianSingle, next);
    this.v24_stats.tuntianCities = Object.keys(this.tuntianLevels).filter(
      id => (this.tuntianLevels[id] || 0) > 0).length;
    game.pushLog(`🌾 ${city.name} 屯田升级至 ${next} 级，每回合产粮 ${v24TuntianYield(city, next)}`);
    return { ok: true, msg: `${city.name} 屯田升至 ${next} 级`, cityId, level: next };
  }

  // 每回合屯田产粮结算
  collectTuntian(game, factionId) {
    let total = 0;
    const cities = game.getFactionCities ? game.getFactionCities(factionId) : [];
    for (const city of cities) {
      const lv = this.tuntianLevels[city.id] || 0;
      if (lv === 0) continue;
      const yield_ = v24TuntianYield(city, lv);
      if (yield_ > 0) {
        const res = game.factionRes.get(factionId);
        if (res) res.food = (res.food || 0) + yield_;
        total += yield_;
      }
    }
    if (total > 0) {
      this.v24_stats.totalFoodProduced += total;
      this.v24_stats.maxFoodPerTurn = Math.max(this.v24_stats.maxFoodPerTurn, total);
    }
    return total;
  }

  // ---------- 2. 粮道系统 ----------
  // 每回合更新所有前线军队的粮道状态
  updateGrainRoads(game) {
    this.grainRoads = {};
    const armies = game.getFactionArmies ? game.getFactionArmies(game.playerFaction) : (game.armies || []);
    for (const army of armies) {
      if (!army || army.faction !== game.playerFaction) continue;
      const road = v24ComputeGrainRoad(game, army);
      this.grainRoads[army.id] = road;
      if (road.connected) {
        this.v24_stats.grainRoadsMaintained++;
      } else {
        this.v24_stats.grainRoadCuts++;
        // 断粮道：士气下降
        if (army.morale != null) {
          army.morale = Math.max(0, army.morale - V24_GRAIN_ROAD_CUT_MORALE_PENALTY);
        }
        game.pushLog(`⚠️ 粮道断绝！${army.name || '前线军队'} 士气-${V24_GRAIN_ROAD_CUT_MORALE_PENALTY}`);
      }
    }
    return this.grainRoads;
  }

  // 查询某军队粮道状态
  getGrainRoad(armyId) {
    return this.grainRoads[armyId] || { connected: true, distance: 0, loss: 0, path: [] };
  }

  // ---------- 3. 后勤补给 ----------
  // 自动运输粮食到前线军队（每回合结算）
  autoResupply(game, factionId) {
    let supplied = 0;
    const res = game.factionRes.get(factionId);
    if (!res) return 0;
    const armies = game.getFactionArmies ? game.getFactionArmies(factionId) : (game.armies || []);
    for (const army of armies) {
      if (!army || army.faction !== factionId) continue;
      const road = this.getGrainRoad(army.id);
      if (!road.connected) continue; // 断粮道无法补给
      // 补给量 = 军队兵力 × 0.3 × (1 - 损耗)
      const troops = army.troops || 0;
      const need = Math.round(troops * 0.3 * (1 - road.loss));
      if (need <= 0) continue;
      const take = Math.min(res.food || 0, need);
      if (take > 0) {
        res.food -= take;
        army.supplyEfficiency = Math.min(1.0, (army.supplyEfficiency || 0.5) + 0.1);
        supplied += take;
        this.v24_stats.frontierArmiesSupplied++;
      }
    }
    return supplied;
  }

  // ---------- 4. 要塞/城防深化 ----------
  // 升级关隘要塞（在 pass.js 基础上深化）
  upgradeFortress(game, factionId, passId) {
    const rt = game.passes && game.passes[passId];
    if (!rt || !rt.built) return { ok: false, msg: '该关隘尚未建成' };
    if (rt.owner !== factionId) return { ok: false, msg: '须为己方关隘' };
    const cur = this.fortressLevels[passId] || 0;
    if (cur >= V24_FORTRESS_MAX) {
      return { ok: false, msg: `要塞已达最高等级（${V24_FORTRESS_MAX}级）` };
    }
    const next = cur + 1;
    const cost = v24FortressCost(next);
    const res = game.factionRes.get(factionId);
    if (!res) return { ok: false, msg: '资源不存在' };
    if (res.money < cost.money) return { ok: false, msg: `金钱不足（需 ${cost.money} 金）` };
    res.money -= cost.money;
    this.fortressLevels[passId] = next;
    this.v24_stats.fortressUpgrades++;
    const bag = v24FortressBag(next);
    game.pushLog(`🏰 关隘要塞升级至 ${next} 级：耐久×${bag.durabilityMult.toFixed(1)}，守军+${(bag.garrisonBonus*100).toFixed(0)}%`);
    return { ok: true, msg: `要塞升至 ${next} 级`, passId, level: next };
  }

  // 获取要塞效果袋
  getFortressBag(passId) {
    const lv = this.fortressLevels[passId] || 0;
    return v24FortressBag(lv);
  }

  // 城防工事加成（城市级）：基于城市规模与屯田等级
  getCityDefenseBonus(cityId) {
    const lv = this.tuntianLevels[cityId] || 0;
    // 屯田城市同时提供城防工事加成（兵农合一）
    return {
      garrisonBonus: lv * 0.05,
      defenseFlat: lv * 3
    };
  }

  // ---------- 5. 烽火台 ----------
  // 在边境城市建造烽火台
  buildBeacon(game, factionId, cityId) {
    const city = game.cities.get(cityId);
    if (!city || city.owner !== factionId) {
      return { ok: false, msg: '须在己方城市建烽火台' };
    }
    if (this.beaconTowers[cityId]) {
      return { ok: false, msg: '该城已建烽火台' };
    }
    const res = game.factionRes.get(factionId);
    if (!res) return { ok: false, msg: '资源不存在' };
    if (res.money < V24_BEACON_COST_MONEY) {
      return { ok: false, msg: `金钱不足（需 ${V24_BEACON_COST_MONEY} 金）` };
    }
    if ((res.food || 0) < V24_BEACON_COST_FOOD) {
      return { ok: false, msg: `粮食不足（需 ${V24_BEACON_COST_FOOD} 粮）` };
    }
    res.money -= V24_BEACON_COST_MONEY;
    res.food -= V24_BEACON_COST_FOOD;
    this.beaconTowers[cityId] = true;
    this.v24_stats.beaconBuilt++;
    game.pushLog(`🔥 ${city.name} 建成烽火台，边境预警！`);
    return { ok: true, msg: `${city.name} 烽火台建成`, cityId };
  }

  // 查询城市是否有烽火台
  hasBeacon(cityId) {
    return !!this.beaconTowers[cityId];
  }

  // 边境预警：检查指定城市附近是否有敌军（有烽火台则提前预警）
  checkBorderWarning(game, cityId) {
    if (!this.beaconTowers[cityId]) return { warned: false, enemies: [] };
    const city = game.cities.get(cityId);
    if (!city) return { warned: false, enemies: [] };
    const enemies = [];
    // 检查相邻城市是否有敌军
    for (const nid of (CITY_LINKS[cityId] || [])) {
      const nc = game.cities.get(nid);
      if (nc && nc.owner && nc.owner !== city.owner) {
        enemies.push({ cityId: nid, name: nc.name, owner: FACTIONS[nc.owner]?.name || nc.owner });
      }
    }
    if (enemies.length > 0) {
      return { warned: true, enemies, warningTurns: V24_BEACON_WARNING_TURNS };
    }
    return { warned: false, enemies: [] };
  }

  // ---------- 每回合结算 ----------
  endTurn(game) {
    const factionId = game.playerFaction;
    if (!factionId) return;
    // 1. 屯田产粮
    this.collectTuntian(game, factionId);
    // 2. 更新粮道
    this.updateGrainRoads(game);
    // 3. 后勤补给
    this.autoResupply(game, factionId);
  }

  // ---------- 汇总查询（成就/结局用）----------
  // 总屯田等级
  getTotalTuntianLevels() {
    return Object.values(this.tuntianLevels).reduce((s, v) => s + (v || 0), 0);
  }
  // 有屯田的城市数
  getTuntianCityCount() {
    return Object.values(this.tuntianLevels).filter(v => (v || 0) > 0).length;
  }
  // 烽火台数量
  getBeaconCount() {
    return Object.keys(this.beaconTowers).filter(k => this.beaconTowers[k]).length;
  }
  // 已升级要塞数
  getFortressCount() {
    return Object.values(this.fortressLevels).filter(v => (v || 0) > 0).length;
  }
  // 粮道畅通的军队数
  getConnectedArmyCount() {
    return Object.values(this.grainRoads).filter(r => r && r.connected).length;
  }

  // ---------- 序列化 ----------
  serialize() {
    return {
      tuntianLevels: this.tuntianLevels,
      fortressLevels: this.fortressLevels,
      beaconTowers: this.beaconTowers,
      grainRoads: this.grainRoads,
      v24_stats: this.v24_stats
    };
  }

  static deserialize(data) {
    const s = new LogisticsSystem();
    if (!data) return s;
    s.tuntianLevels = data.tuntianLevels || {};
    s.fortressLevels = data.fortressLevels || {};
    s.beaconTowers = data.beaconTowers || {};
    s.grainRoads = data.grainRoads || {};
    s.v24_stats = Object.assign(s.v24_stats, data.v24_stats || {});
    return s;
  }
}

// ============================================================
// 独立函数式 API（接受 game 上下文，便于 UI/外部调用）
// ============================================================

/** 取系统实例（缺失返回 null，调用方防御式处理） */
export function v24GetLogistics(game) {
  try { return game.logistics || null; } catch (e) { return null; }
}

/** 建设屯田 */
export function v24BuildTuntian(game, cityId) {
  const s = v24GetLogistics(game);
  return s ? s.buildTuntian(game, game.playerFaction, cityId) : { ok: false, msg: '屯田后勤系统未初始化' };
}

/** 升级要塞 */
export function v24UpgradeFortress(game, passId) {
  const s = v24GetLogistics(game);
  return s ? s.upgradeFortress(game, game.playerFaction, passId) : { ok: false, msg: '屯田后勤系统未初始化' };
}

/** 建造烽火台 */
export function v24BuildBeacon(game, cityId) {
  const s = v24GetLogistics(game);
  return s ? s.buildBeacon(game, game.playerFaction, cityId) : { ok: false, msg: '屯田后勤系统未初始化' };
}

/** 查询粮道状态 */
export function v24GetGrainRoad(game, armyId) {
  const s = v24GetLogistics(game);
  return s ? s.getGrainRoad(armyId) : { connected: true, distance: 0, loss: 0, path: [] };
}

/** 屯田统计 */
export function v24LogisticsStats(game) {
  const s = v24GetLogistics(game);
  if (!s) return {};
  return {
    totalTuntianLevels: s.getTotalTuntianLevels(),
    tuntianCityCount: s.getTuntianCityCount(),
    beaconCount: s.getBeaconCount(),
    fortressCount: s.getFortressCount(),
    connectedArmyCount: s.getConnectedArmyCount(),
    ...s.v24_stats
  };
}
