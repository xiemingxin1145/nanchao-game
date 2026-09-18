// ============================================================
// building.js — 城市建设建筑树（8 类建筑，等级 1~10）
//
// 建筑状态：city.buildings = { buildingId: level }（0/缺省 = 未建造）
// 每城每回合只能建造/升级一个（city.buildingThisTurn 标记）
//
// 数值平衡约定（可复算）：
//  - 单建筑 10 级总加成：
//    农田  +80 农业 / +50% 粮草；市集 +80 商业 / +50% 金钱；
//    城墙  +100 城防 / +50% 守城；码头 +100% 贸易收入。
//  - 费用公式：cost = 150 + 120 × 当前等级（0级起建 → 150/270/390…）
//  - effect 袋键名与 skills.js 同语义，经 city/game 层加算
// ============================================================

export const BUILDINGS = {
  farm: {
    id: 'farm', name: '农田', maxLevel: 10, riverOnly: false,
    description: '每级农业+8，粮草产出+5%。',
    perLevel: { agriFlat: 8, foodMult: 0.05 }
  },
  market: {
    id: 'market', name: '市集', maxLevel: 10, riverOnly: false,
    description: '每级商业+8，金钱产出+5%（商路前提：≥1 级）。',
    perLevel: { commFlat: 8, incomeMult: 0.05 }
  },
  barracks: {
    id: 'barracks', name: '兵营', maxLevel: 10, riverOnly: false,
    description: '每级征兵上限+10%，征兵费用-3%。',
    perLevel: { recruitCapMult: 0.10, recruitCostMult: -0.03 }
  },
  drill: {
    id: 'drill', name: '校场', maxLevel: 10, riverOnly: false,
    description: '每级军队经验+5%；3 级解锁兵种进阶（重步兵/重骑兵/强弩兵），5 级解锁精锐（陷阵营/虎豹骑/无当飞军）。',
    perLevel: { drillExpMult: 0.05 },
    upgradeLevels: { 1: 'advanced', 2: 'elite' }
  },
  walls: {
    id: 'walls', name: '城墙', maxLevel: 10, riverOnly: false,
    description: '每级城市防御+10，守城战力+5%。',
    perLevel: { defenseFlat: 10, garrisonMult: 0.05 }
  },
  temple: {
    id: 'temple', name: '庙宇', maxLevel: 10, riverOnly: false,
    description: '每级民心+2/回合，事件负面影响-5%。',
    perLevel: { moralePerTurn: 2, disasterMult: -0.05 }
  },
  workshop: {
    id: 'workshop', name: '工坊', maxLevel: 10, riverOnly: false,
    description: '每级打造速度+10%；3 级可造精良，5 级稀有，7 级史诗，9 级传说。',
    perLevel: { forgeSpeedMult: 0.10 }
  },
  dock: {
    id: 'dock', name: '码头', maxLevel: 10, riverOnly: true,
    description: '仅河流城市。每级贸易收入+10%，水军（弓兵）+5%。3级解锁水军建造。',
    perLevel: { tradeMult: 0.10, archerMult: 0.05, navyBuildUnlock: 1 }
  },
  // ---- V6.0 宗教文化建筑 ----
  buddhist_temple: {
    id: 'buddhist_temple', name: '佛寺', maxLevel: 5, riverOnly: false,
    description: '每级民心+2，文化+5/回合，事件负面影响-3%。佛教建筑。',
    perLevel: { moralePerTurn: 2, culturePerTurn: 5, disasterMult: -0.03 }
  },
  daoist_temple: {
    id: 'daoist_temple', name: '道观', maxLevel: 5, riverOnly: false,
    description: '每级科技+3，文化+3/回合，招募成功率+2%。道教建筑。',
    perLevel: { techPerTurn: 3, culturePerTurn: 3, recruitBonus: 0.02 }
  },
  grotto: {
    id: 'grotto', name: '石窟', maxLevel: 3, riverOnly: false, special: true,
    description: '特殊建筑，仅平城/洛阳/建康可建。每级文化+10，全局声望+1。',
    perLevel: { culturePerTurn: 10, globalPrestige: 1 }
  },
  // ---- V8.0 科举/徭役核心建筑 ----
  taixue: {
    id: 'taixue', name: '太学', maxLevel: 5, riverOnly: false,
    description: '官办最高学府。3级解锁科举取士。每级科举人才质量+10%，科技+2/回合。',
    perLevel: { techPerTurn: 2, examQuality: 0.10 }
  },
  jiangzuojian: {
    id: 'jiangzuojian', name: '将作监', maxLevel: 5, riverOnly: false,
    description: '掌管宫室营建官署。3级解锁徭役征发。每级建造速度+8%。',
    perLevel: { buildSpeedMult: 0.08 }
  },

  // ============================================================
  // V14.0「霸业宏图」新增建筑（v14_ 前缀）
  // 补充：水渠/仓库/学府/驿站/矿场，与城市四维发展关联
  // ============================================================
  v14_water_channel: {
    id: 'v14_water_channel', name: '水渠', maxLevel: 5, riverOnly: false,
    description: '关联水利发展。每级水利+6，粮食产出+6%，灾害减免-3%。',
    perLevel: { waterFlat: 6, foodMult: 0.06, disasterMult: -0.03 }
  },
  v14_granary: {
    id: 'v14_granary', name: '仓库', maxLevel: 5, riverOnly: false,
    description: '囤积粮秣。每级粮草储备上限+20%，军队粮草消耗-3%。',
    perLevel: { foodStorageMult: 0.20, supplyMult: -0.03 }
  },
  v14_academy: {
    id: 'v14_academy', name: '学府', maxLevel: 5, riverOnly: false,
    description: '兴学育才。每级科技+3/回合，在野武将招募成功率+3%。',
    perLevel: { techPerTurn: 3, recruitBonus: 0.03 }
  },
  v14_post_station: {
    id: 'v14_post_station', name: '驿站', maxLevel: 5, riverOnly: false,
    description: '驿传通达。每级军队移动力+5%，补给线效率+5%。',
    perLevel: { moveMult: 0.05, supplyEffMult: 0.05 }
  },
  v14_mine: {
    id: 'v14_mine', name: '矿场', maxLevel: 5, riverOnly: false,
    description: '山泽冶金。每级金钱产出+6%，商业发展速度+4%。',
    perLevel: { incomeMult: 0.06, commDevMult: 0.04 }
  }
};

// 升级费用公式：cost = 150 + 120 × 当前等级（当前等级 0 时即 150 金）
export function buildingCost(currentLevel) {
  return 150 + 120 * currentLevel;
}

export function getBuilding(buildingId) {
  return BUILDINGS[buildingId] || null;
}

// 计算某城市的建筑聚合效果袋
// buildings: { buildingId: level }
// 返回效果袋（键名同 skills）
export function getBuildingBag(buildings) {
  const bag = {};
  for (const [bid, lv] of Object.entries(buildings || {})) {
    const b = BUILDINGS[bid];
    if (!b || !lv) continue;
    for (const [k, v] of Object.entries(b.perLevel)) {
      bag[k] = (bag[k] || 0) + v * lv;
    }
  }
  return bag;
}

// 建造/升级校验 + 落账（不含权限与金钱扣减，由 game 层处理）
// city: City 实例；factionRes: {money}
// 返回 { ok, msg, cost }
export function buildBuildingOnCity(city, buildingId, factionRes) {
  const b = BUILDINGS[buildingId];
  if (!b) return { ok: false, msg: '建筑不存在' };
  if (b.riverOnly && city.terrain !== 'river') {
    return { ok: false, msg: '码头仅可建于河流城市' };
  }
  const cur = city.buildings[buildingId] || 0;
  if (cur >= b.maxLevel) return { ok: false, msg: `${b.name} 已达最高等级 ${b.maxLevel}` };
  if (city.buildingThisTurn) return { ok: false, msg: '本回合该城已在兴工，每回合仅可建造/升级一个建筑' };
  const cost = buildingCost(cur);
  if (factionRes.money < cost) return { ok: false, msg: `金钱不足（需 ${cost} 金）` };
  factionRes.money -= cost;
  city.buildings[buildingId] = cur + 1;
  city.buildingThisTurn = true;
  return { ok: true, msg: `${city.name} ${b.name} 升至 ${cur + 1} 级（耗 ${cost} 金）`, cost, level: cur + 1 };
}

// ============================================================
// V14.0「霸业宏图」：建筑系统增强 API
// ============================================================

/**
 * 获取某城市已建建筑列表
 * @returns {Array<{id,name,level,maxLevel,description}>}
 */
export function getBuildings(city) {
  const out = [];
  for (const [bid, lv] of Object.entries(city.buildings || {})) {
    const b = BUILDINGS[bid];
    if (!b || !lv) continue;
    out.push({
      id: bid, name: b.name, level: lv, maxLevel: b.maxLevel,
      description: b.description
    });
  }
  return out;
}

/**
 * 校验某城市是否可建造/升级指定建筑
 * @returns {ok, msg, cost}
 */
export function canBuild(city, buildingType) {
  const b = BUILDINGS[buildingType];
  if (!b) return { ok: false, msg: '建筑不存在' };
  if (b.riverOnly && city.terrain !== 'river') {
    return { ok: false, msg: `${b.name} 仅可建于河流城市` };
  }
  const cur = city.buildings[buildingType] || 0;
  if (cur >= b.maxLevel) return { ok: false, msg: `${b.name} 已达最高等级 ${b.maxLevel}` };
  if (city.buildingThisTurn) return { ok: false, msg: '本回合该城已在兴工' };
  return { ok: true, cost: buildingCost(cur) };
}

/**
 * 在某城市建造/升级建筑（与 buildBuildingOnCity 等价，V14 对外命名）
 * @param {object} city - City 实例
 * @param {string} buildingType - 建筑 id
 * @param {object} factionRes - { money }
 */
export function buildStructure(city, buildingType, factionRes) {
  return buildBuildingOnCity(city, buildingType, factionRes);
}

/**
 * 升级指定建筑（当前等级→+1）
 */
export function upgradeBuilding(city, buildingType, factionRes) {
  return buildBuildingOnCity(city, buildingType, factionRes);
}

/**
 * 获取某建筑在指定等级下的效果袋
 * @param {object|string} building - 建筑对象或建筑 id
 * @param {number} level - 建筑等级（默认1）
 */
export function getBuildingEffect(building, level = 1) {
  const b = typeof building === 'string' ? BUILDINGS[building] : building;
  if (!b) return {};
  const out = {};
  for (const [k, v] of Object.entries(b.perLevel || {})) {
    out[k] = v * level;
  }
  return out;
}
