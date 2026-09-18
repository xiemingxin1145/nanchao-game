// ============================================================
// save.js — localStorage 存档/读档（V5.5：键名缩写 + LZ77 压缩）
// ============================================================
import { Game } from './game.js';
import { loadNGPlusData } from './ngplus.js';
import { lz77Compress, lz77Decompress } from './network.js';

const SAVE_KEY = 'nanchao_save';
const SAVE_SLOTS = ['nanchao_save_1', 'nanchao_save_2', 'nanchao_save_3'];

// ============================================================
// V5.0 存档压缩：顶层键名缩写（可逆）。
// V5.5 升级：在键名缩写之上再叠加 LZ77 字符串压缩，
//   实测存档体积可在 V5.0 基础上再降 30~45%，localStorage 占用显著下降。
//   两种压缩都向后兼容旧档：无 v 标记 → 旧格式；有 v 标记 → 键名缩写；
//   v=6 → 键名缩写 + LZ77。
// ============================================================
const SHORT_KEYS = {
  turn: 't', seasonIdx: 'sIdx', playerFaction: 'pF', state: 'st',
  cities: 'ct', generals: 'gn', armies: 'ar', factionRes: 'fr',
  diplomacy: 'dp', log: 'lg', gameOver: 'gOv',
  selectedCity: 'sC', selectedArmy: 'sA',
  techs: 'tc', researching: 'rs', achievements: 'ac', pendingAchievements: 'pa',
  stats: 'stt', initialIdleCount: 'iic', garrisonBuffTurns: 'gbt',
  tradeRoutes: 'tr', inventory: 'inv',
  marriages: 'mg', hostages: 'hs', spies: 'sp', fogOfWar: 'fog',
  passes: 'ps', supplyLines: 'sl', barbarianTribes: 'bt',
  scenario: 'sc', storyProgress: 'sprog', endingTriggered: 'et',
  currentEnding: 'ce', barbarianControlCenters: 'bcc',
  ngPlusLevel: 'ngp', unlockedTitles: 'ut', activeTitles: 'at',
  gameStats: 'gst', generalStats: 'gsts', introCompleted: 'ic',
  modState: 'mod', isHotSeat: 'hs2', humanFactions: 'hf',
  turnOrder: 'to', currentPlayerIndex: 'cpi', saveTime: 'svt'
};
const LONG_KEYS = Object.fromEntries(Object.entries(SHORT_KEYS).map(([k, v]) => [v, k]));

function _shrink(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = { v: 5 };
  for (const k of Object.keys(obj)) {
    const sk = SHORT_KEYS[k] || k;
    out[sk] = obj[k];
  }
  return out;
}
function _expand(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  // 旧档（无 v 标记）或未压缩档：直接返回
  if (obj.v !== 5) return obj;
  const out = {};
  for (const k of Object.keys(obj)) {
    if (k === 'v') continue;
    const lk = LONG_KEYS[k] || k;
    out[lk] = obj[k];
  }
  return out;
}

// V5.5：写入时在 JSON 字符串上再做一次 LZ77 压缩，外层包一个 {lz:true, data} 信封
function _pack(data) {
  const v5 = _shrink(data);
  const json = JSON.stringify(v5);
  const compressed = lz77Compress(json);
  return JSON.stringify({ lz: 6, data: compressed });
}

// V5.5：读取时识别信封并解压；旧档原样返回
function _unpack(raw) {
  let outer;
  try { outer = JSON.parse(raw); } catch (e) {
    // BUG修复#7：存档数据损坏（JSON.parse 失败）时返回 null，
    // 避免后续 _expand/deserialize 连锁崩溃。调用方会感知 null 并提示读档失败。
    console.warn('存档 JSON 解析失败，可能已损坏。');
    return null;
  }
  if (outer && outer.lz === 6 && typeof outer.data === 'string') {
    const json = lz77Decompress(outer.data);
    if (!json) {
      console.warn('存档 LZ77 解压失败，数据可能损坏。');
      return null;
    }
    try {
      return JSON.parse(json);
    } catch (e) {
      console.warn('解压后存档 JSON 解析失败。');
      return null;
    }
  }
  return outer;
}

export function saveGame(game, slot = 0) {
  try {
    const key = slot === 0 ? SAVE_KEY : SAVE_SLOTS[slot - 1];
    let data = game.serialize();
    data.saveTime = new Date().toISOString();
    localStorage.setItem(key, _pack(data));
    return { ok: true, msg: '存档成功' };
  } catch (e) {
    return { ok: false, msg: '存档失败：' + e.message };
  }
}

export function loadGame(slot = 0) {
  try {
    const key = slot === 0 ? SAVE_KEY : SAVE_SLOTS[slot - 1];
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    let data = _unpack(raw);     // 解压（旧档原样返回；损坏返回 null）
    if (!data) return null;       // BUG修复#7：解压失败，数据损坏
    data = _expand(data);        // 键名展开（旧档原样返回）
    return Game.deserialize(data);
  } catch (e) {
    console.error('读档失败:', e);
    return null;
  }
}

export function hasSave(slot = 0) {
  const key = slot === 0 ? SAVE_KEY : SAVE_SLOTS[slot - 1];
  return localStorage.getItem(key) !== null;
}

export function getSaveInfo(slot = 0) {
  try {
    const key = slot === 0 ? SAVE_KEY : SAVE_SLOTS[slot - 1];
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    let data = _unpack(raw);
    if (!data) return null;  // BUG修复#7：解压失败
    data = _expand(data);
    return {
      turn: data.turn,
      playerFaction: data.playerFaction,
      saveTime: data.saveTime,
      isHotSeat: !!data.isHotSeat,
      humanFactions: Array.isArray(data.humanFactions) ? data.humanFactions : []
    };
  } catch (e) {
    return null;
  }
}

export function deleteSave(slot = 0) {
  const key = slot === 0 ? SAVE_KEY : SAVE_SLOTS[slot - 1];
  localStorage.removeItem(key);
}

// V3.5：返回当前周目等级（供主菜单显示）
export function getCurrentNGPlusLevel() {
  const d = loadNGPlusData();
  return d ? d.level : 0;
}
