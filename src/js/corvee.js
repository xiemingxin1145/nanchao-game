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
