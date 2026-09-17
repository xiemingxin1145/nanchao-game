// ============================================================
// save.js — localStorage 存档/读档
// ============================================================
import { Game } from './game.js';

const SAVE_KEY = 'nanchao_save';
const SAVE_SLOTS = ['nanchao_save_1', 'nanchao_save_2', 'nanchao_save_3'];

export function saveGame(game, slot = 0) {
  try {
    const key = slot === 0 ? SAVE_KEY : SAVE_SLOTS[slot - 1];
    const data = game.serialize();
    data.saveTime = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(data));
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
    const data = JSON.parse(raw);
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
    const data = JSON.parse(raw);
    return {
      turn: data.turn,
      playerFaction: data.playerFaction,
      saveTime: data.saveTime
    };
  } catch (e) {
    return null;
  }
}

export function deleteSave(slot = 0) {
  const key = slot === 0 ? SAVE_KEY : SAVE_SLOTS[slot - 1];
  localStorage.removeItem(key);
}
