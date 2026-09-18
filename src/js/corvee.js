// ============================================================
// corvee.js — V8.0 徭役系统
//
// 历史背景：南北朝徭役繁重，成年男子每年服役二十日（北周制）。
// 徭役可加速营建（建造/城防/水利/运输），但过度征发导致民心下降、
// 人口流失甚至起义。将作监≥3级解锁徭役管理。
//
// 核心逻辑：
//  - 每城每回合只能征发一种徭役，持续3回合
//  - 徭役效果：建造加速/城防修缮/农业兴修/运输补给
//  - 徭役期间民心-3/回合，征发时人口-1%
//  - 徭役过重触发「民夫逃亡」「徭役起义」事件
// ============================================================
import { CORVEE_TYPES, CORVEE_DURATION, CORVEE_BUILDING_REQ, CORVEE_BUILDING_MIN_LEVEL } from './data.js';

// 检查某城市是否可征发徭役（将作监≥3级）
export function canStartCorvee(city) {
  const jzjLevel = city.buildings?.[CORVEE_BUILDING_REQ] || 0;
  if (jzjLevel < CORVEE_BUILDING_MIN_LEVEL) return { ok: false, msg: `需将作监≥${CORVEE_BUILDING_MIN_LEVEL}级方可征发徭役` };
  if (city.corvee) return { ok: false, msg: '该城正在征发徭役中' };
  return { ok: true };
}

// 获取某城市的徭役效果袋（供 game 层汇总）
export function getCorveeBag(city) {
  if (!city.corvee) return {};
  const cv = CORVEE_TYPES[city.corvee.type];
  if (!cv || !cv.effect) return {};
  return { ...cv.effect };
}

// 获取某势力所有城市的徭役汇总效果
export function getFactionCorveeBag(game, factionId) {
  const cities = game.getFactionCities(factionId);
  const bag = {};
  for (const c of cities) {
    const cb = getCorveeBag(c);
    for (const [k, v] of Object.entries(cb)) {
      bag[k] = (bag[k] || 0) + v;
    }
  }
  return bag;
}

// 徭役过重检查：返回应触发的事件id（null=无事件）
export function checkCorveeEvent(game, factionId) {
  const cities = game.getFactionCities(factionId);
  let activeCorvee = 0;
  let lowMorale = 0;
  for (const c of cities) {
    if (c.corvee) activeCorvee++;
    if (c.morale < 25) lowMorale++;
  }
  // 多城同时徭役 + 民心低 → 徭役起义
  if (activeCorvee >= 2 && lowMorale >= 1 && Math.random() < 0.2) {
    return 'corvee_rebellion';
  }
  // 单城徭役 + 民心极低 → 民夫逃亡
  if (activeCorvee >= 1 && cities.some(c => c.corvee && c.morale < 20) && Math.random() < 0.15) {
    return 'corvee_deserters';
  }
  return null;
}

// AI 徭役决策：AI在需要加速建设时征发徭役
export function aiStartCorvee(game, factionId) {
  const res = game.factionRes.get(factionId);
  if (!res) return;
  const cities = game.getFactionCities(factionId);
  for (const city of cities) {
    const check = canStartCorvee(city);
    if (!check.ok) continue;
    // AI策略：城防低时修城防，农业低时修水利
    let type = 'build';
    if (city.defense < 30) type = 'defense';
    else if (city.agri < 40) type = 'water';
    else if (Math.random() < 0.5) type = 'build';
    else continue;
    const result = city.startCorvee(type);
    if (result.ok) game.pushLog(`【AI】${city.name} 征发${CORVEE_TYPES[type].name}`);
  }
}

// ============================================================
// V14.0「霸业宏图」：徭役系统优化 API
// 四类徭役：建造(build) / 水利(water) / 运输(transport) / 征兵(v14_recruit)
// 徭役短期提升建设/征兵速度，但降低民心与农业产出
// ============================================================

// V14 新增「征兵徭役」（本地注册，不改动 data.js）
const V14_CORVEE_EXTRA = {
  v14_recruit: {
    id: 'v14_recruit', name: '征兵徭役', icon: '⚔️',
    description: '征发民夫整编新军（征兵速度+50%，但民心-2/回合，农业产出-10%）。',
    effect: { recruitSpeedMult: 0.5, moraleDelta: -2, foodMult: -0.10 }
  }
};

/** 返回全部可用徭役类型（含 V14 征兵徭役） */
export function getCorveeTypes() {
  return { ...CORVEE_TYPES, ...V14_CORVEE_EXTRA };
}

/**
 * 启动徭役
 * @param {object} city - City 实例
 * @param {string} type - 徭役类型 id
 * @param {number} laborers - 征发民夫数量（影响效果强度）
 * @returns {ok, msg}
 */
export function startCorvee(city, type, laborers = 1000) {
  const allTypes = getCorveeTypes();
  const cv = allTypes[type];
  if (!cv) return { ok: false, msg: '徭役类型不存在' };
  // 将作监≥3级校验
  const pre = canStartCorvee(city);
  if (!pre.ok && type !== 'v14_recruit') return pre;
  if (city.corvee) return { ok: false, msg: '该城正在征发徭役中' };
  // 落账：民夫消耗人口
  const labor = Math.max(0, Math.round(laborers || 1000));
  city.pop = Math.max(1000, city.pop - labor);
  city.corvee = { type, turnsLeft: CORVEE_DURATION, laborers: labor };
  return { ok: true, msg: `${city.name} 征发${cv.name}（民夫${labor}人），持续${CORVEE_DURATION}回合` };
}

/**
 * 获取某城当前徭役进度
 * @returns {type, name, turnsLeft, duration, progress, laborers} 或 null
 */
export function getCorveeProgress(city) {
  if (!city.corvee) return null;
  const allTypes = getCorveeTypes();
  const cv = allTypes[city.corvee.type];
  const done = CORVEE_DURATION - (city.corvee.turnsLeft || 0);
  return {
    type: city.corvee.type,
    name: cv ? cv.name : city.corvee.type,
    turnsLeft: city.corvee.turnsLeft,
    duration: CORVEE_DURATION,
    progress: Math.round((done / CORVEE_DURATION) * 100),
    laborers: city.corvee.laborers || 0
  };
}

/**
 * 完成徭役结算（提前结算奖励并清空状态）
 * @returns {ok, msg, reward}
 */
export function completeCorvee(city) {
  if (!city.corvee) return { ok: false, msg: '该城无徭役' };
  const allTypes = getCorveeTypes();
  const cv = allTypes[city.corvee.type];
  const reward = { ...(cv ? cv.effect : {}) };
  // 征兵徭役完成：临时提升训练度
  if (city.corvee.type === 'v14_recruit') {
    city.training = Math.min(100, (city.training || 0) + 10);
  }
  city.corvee = null;
  return { ok: true, msg: `${city.name} 徭役完成`, reward };
}
