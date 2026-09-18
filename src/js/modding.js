// ============================================================
// modding.js — V4.0 数据驱动模组加载器
//
// 功能：
//  - 扫描 mods/ 目录下的 JSON 模组文件
//  - 模组可以覆盖/扩展：势力、城市、武将、技能、科技、装备、阵型、建筑、事件、兵种
//  - 加载优先级：基础数据 → 模组数据（模组覆盖基础）
//  - 模组冲突检测：多个模组修改同一数据时按文件名排序，后加载的覆盖先加载的
//  - 主菜单"模组管理"按钮，可启用/禁用模组
//
// 模组格式：
// {
//   "id": "mod_id",
//   "name": "模组名称",
//   "version": "1.0.0",
//   "author": "作者",
//   "description": "描述",
//   "data": {
//     "factions": { ... },      // 覆盖/新增势力
//     "cities": [ ... ],         // 覆盖/新增城市
//     "generals": [ ... ],       // 覆盖/新增武将
//     "skills": { ... },         // 覆盖/新增技能
//     "techs": [ ... ],          // 覆盖/新增科技
//     "equipment": { ... },      // 覆盖/新增装备
//     "formations": { ... },     // 覆盖/新增阵型
//     "buildings": { ... },      // 覆盖/新增建筑
//     "events": [ ... ],         // 新增随机事件
//     "unitTypes": { ... },      // 覆盖/新增兵种
//     "passes": [ ... ],         // 新增关隘
//     "barbarians": [ ... ]      // 新增蛮族部落
//   }
// }
// ============================================================

// ---------- 深合并工具 ----------
// 将 mod 数据深度合并到 base 数据中
// 规则：
//   - 普通值（数字/字符串/布尔）：mod 覆盖 base
//   - 对象：递归合并
//   - 数组：按索引/ID 合并；新元素追加
export function deepMerge(base, mod) {
  if (mod === undefined || mod === null) return base;
  for (const key of Object.keys(mod)) {
    const modVal = mod[key];
    if (modVal === undefined) continue;
    if (modVal === null) { base[key] = null; continue; }
    if (Array.isArray(modVal)) {
      if (!Array.isArray(base[key])) base[key] = [];
      for (let i = 0; i < modVal.length; i++) {
        if (typeof modVal[i] === 'object' && modVal[i] !== null && !Array.isArray(modVal[i])) {
          // 对象数组：按 id 合并
          const existingIdx = base[key].findIndex(b => b && b.id === modVal[i].id);
          if (existingIdx >= 0) {
            deepMerge(base[key][existingIdx], modVal[i]);
          } else {
            base[key].push(JSON.parse(JSON.stringify(modVal[i])));
          }
        } else {
          base[key][i] = modVal[i];
        }
      }
    } else if (typeof modVal === 'object') {
      if (typeof base[key] !== 'object' || base[key] === null || Array.isArray(base[key])) {
        base[key] = {};
      }
      deepMerge(base[key], modVal);
    } else {
      base[key] = modVal;
    }
  }
  return base;
}

// ---------- 深克隆 ----------
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ---------- 数值钳制工具 ----------
export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// ============================================================
// ModManager — 模组管理器
// ============================================================
export class ModManager {
  constructor() {
    // 已发现的模组列表：[{ filename, id, name, version, author, description, data, enabled }]
    this.availableMods = [];
    // 模组是否已加载
    this.loaded = false;
    // 基础数据快照（用于重置）
    this._baseSnapshot = null;
    // 性能优化（modding.js）：快照的深克隆缓存（restoreBase 复用，避免每次全量 deepClone）
    this._baseSnapshotClones = null;
    // 模组启用状态持久化 key
    this._storageKey = 'nanchao_mod_enabled';
  }

  // 从 localStorage 读取启用状态
  _readEnabledState() {
    try {
      const raw = localStorage.getItem(this._storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  // 保存启用状态到 localStorage
  _saveEnabledState() {
    try {
      const state = {};
      for (const mod of this.availableMods) {
        state[mod.id] = mod.enabled;
      }
      localStorage.setItem(this._storageKey, JSON.stringify(state));
    } catch (e) { /* localStorage 不可用时静默 */ }
  }

  // 加载所有模组文件
  // modBaseUrl: 模组目录 URL（相对于 index.html）
  async loadMods(modBaseUrl = 'mods/') {
    if (this.loaded) return;
    this.availableMods = [];

    // 读取 manifest 获取模组文件列表
    let modFilenames = [];
    try {
      const manifestResp = await fetch(modBaseUrl + 'manifest.json');
      if (manifestResp.ok) {
        const manifest = await manifestResp.json();
        if (Array.isArray(manifest.mods)) {
          modFilenames = manifest.mods;
        }
      }
    } catch (e) {
      // manifest 不存在，尝试默认文件
    }

    // 备用：尝试加载 example_mod.json
    if (modFilenames.length === 0) {
      modFilenames = ['example_mod.json'];
    }

    const enabledState = this._readEnabledState();

    for (const filename of modFilenames) {
      try {
        const resp = await fetch(modBaseUrl + filename);
        if (!resp.ok) continue;
        const modJson = await resp.json();
        if (!modJson.id || !modJson.data) continue;

        modJson.filename = filename;
        // 按文件名排序加载（后加载的覆盖先加载的）
        modJson.enabled = enabledState[modJson.id] !== false; // 默认启用
        modJson.loadError = null;
        this.availableMods.push(modJson);
      } catch (e) {
        // 单个模组加载失败不影响其他
        console.warn('[ModManager] 加载模组失败:', filename, e.message);
      }
    }

    // 按文件名排序
    this.availableMods.sort((a, b) => a.filename.localeCompare(b.filename));
    this.loaded = true;
  }

  // 保存基础数据快照（首次加载前调用一次）
  takeBaseSnapshot(dataRefs) {
    if (this._baseSnapshot) return;
    this._baseSnapshot = {};
    for (const [key, obj] of Object.entries(dataRefs)) {
      this._baseSnapshot[key] = deepClone(obj);
    }
  }

  // 恢复基础数据（从快照）
  // 性能优化（modding.js）：restoreBase 每次调用都对整个快照做一次 deepClone
  //   （JSON.parse(JSON.stringify)），72城/144将/海量装备下每次切换模组都全量深克隆，
  //   主线程明显卡顿。优化：takeBaseSnapshot 时缓存一份深克隆副本，
  //   restoreBase 直接用缓存副本（深克隆只发生一次），避免重复序列化大对象。
  restoreBase(dataRefs) {
    if (!this._baseSnapshot) return;
    if (!this._baseSnapshotClones) {
      this._baseSnapshotClones = {};
      for (const [key, snapshot] of Object.entries(this._baseSnapshot)) {
        this._baseSnapshotClones[key] = deepClone(snapshot);
      }
    }
    for (const [key, snapshot] of Object.entries(this._baseSnapshotClones)) {
      const target = dataRefs[key];
      if (!target) continue;
      if (Array.isArray(target)) {
        target.length = 0;
        for (const item of snapshot) target.push(item);
      } else if (typeof target === 'object') {
        // 清空再赋值（snapshot 已是缓存的独立深克隆，无需再 deepClone）
        for (const k of Object.keys(target)) delete target[k];
        Object.assign(target, snapshot);
      }
    }
  }

  // 将所有已启用模组的数据应用到游戏基础数据
  // dataRefs: { FACTIONS, CITIES, GENERALS, SKILLS, TECHS, EQUIPMENT_ITEMS, FORMATIONS, BUILDINGS, EVENTS, UNIT_TYPES, HISTORICAL_EVENTS, PASSES, BARBARIAN_TRIBES, NEW_GENERAL_SKILLS }
  applyMods(dataRefs) {
    if (!this.loaded) return;

    // 先恢复基础数据
    this.restoreBase(dataRefs);

    // 按排序后的顺序应用已启用模组
    for (const mod of this.availableMods) {
      if (!mod.enabled) continue;
      const d = mod.data || {};
      try {
        // 势力（对象 keyed by id）
        if (d.factions && dataRefs.FACTIONS) {
          deepMerge(dataRefs.FACTIONS, d.factions);
        }
        // 城市（数组，按 id 合并）
        if (d.cities && Array.isArray(dataRefs.CITIES)) {
          for (const newCity of d.cities) {
            const idx = dataRefs.CITIES.findIndex(c => c.id === newCity.id);
            if (idx >= 0) deepMerge(dataRefs.CITIES[idx], newCity);
            else dataRefs.CITIES.push(newCity);
          }
        }
        // 武将（数组，按 id 合并）
        if (d.generals && Array.isArray(dataRefs.GENERALS)) {
          for (const newGen of d.generals) {
            const idx = dataRefs.GENERALS.findIndex(g => g.id === newGen.id);
            if (idx >= 0) deepMerge(dataRefs.GENERALS[idx], newGen);
            else dataRefs.GENERALS.push(newGen);
          }
        }
        // 技能（对象 keyed by id）
        if (d.skills && dataRefs.SKILLS) {
          deepMerge(dataRefs.SKILLS, d.skills);
        }
        // 科技（数组，按 id 合并）
        if (d.techs && Array.isArray(dataRefs.TECHS)) {
          for (const newTech of d.techs) {
            const idx = dataRefs.TECHS.findIndex(t => t.id === newTech.id);
            if (idx >= 0) deepMerge(dataRefs.TECHS[idx], newTech);
            else dataRefs.TECHS.push(newTech);
          }
        }
        // 装备（对象 keyed by id）
        if (d.equipment && dataRefs.EQUIPMENT_ITEMS) {
          deepMerge(dataRefs.EQUIPMENT_ITEMS, d.equipment);
        }
        // 阵型（对象 keyed by id）
        if (d.formations && dataRefs.FORMATIONS) {
          deepMerge(dataRefs.FORMATIONS, d.formations);
        }
        // 建筑（对象 keyed by id）
        if (d.buildings && dataRefs.BUILDINGS) {
          deepMerge(dataRefs.BUILDINGS, d.buildings);
        }
        // 随机事件（数组，追加）
        if (d.events && Array.isArray(dataRefs.EVENTS)) {
          for (const evt of d.events) dataRefs.EVENTS.push(evt);
        }
        // 历史事件（数组，按 id 合并）
        if (d.historicalEvents && Array.isArray(dataRefs.HISTORICAL_EVENTS)) {
          for (const hevt of d.historicalEvents) {
            const idx = dataRefs.HISTORICAL_EVENTS.findIndex(e => e.id === hevt.id);
            if (idx >= 0) deepMerge(dataRefs.HISTORICAL_EVENTS[idx], hevt);
            else dataRefs.HISTORICAL_EVENTS.push(hevt);
          }
        }
        // 兵种（对象 keyed by id）
        if (d.unitTypes && dataRefs.UNIT_TYPES) {
          deepMerge(dataRefs.UNIT_TYPES, d.unitTypes);
        }
        // 关隘（数组，按 id 合并）
        if (d.passes && Array.isArray(dataRefs.PASSES)) {
          for (const pass of d.passes) {
            const idx = dataRefs.PASSES.findIndex(p => p.id === pass.id);
            if (idx >= 0) deepMerge(dataRefs.PASSES[idx], pass);
            else dataRefs.PASSES.push(pass);
          }
        }
        // 蛮族部落（数组，按 id 合并）
        if (d.barbarians && Array.isArray(dataRefs.BARBARIAN_TRIBES)) {
          for (const barb of d.barbarians) {
            const idx = dataRefs.BARBARIAN_TRIBES.findIndex(b => b.id === barb.id);
            if (idx >= 0) deepMerge(dataRefs.BARBARIAN_TRIBES[idx], barb);
            else dataRefs.BARBARIAN_TRIBES.push(barb);
          }
        }
        // 武将技能映射（对象 keyed by generalId）
        if (d.generalSkills && dataRefs.NEW_GENERAL_SKILLS) {
          deepMerge(dataRefs.NEW_GENERAL_SKILLS, d.generalSkills);
        }
        // 城市邻接关系（对象 keyed by cityId）
        if (d.cityLinks && dataRefs.CITY_LINKS) {
          deepMerge(dataRefs.CITY_LINKS, d.cityLinks);
        }
      } catch (e) {
        console.warn('[ModManager] 应用模组失败:', mod.id, e.message);
        mod.loadError = e.message;
      }
    }
  }

  // 启用/禁用模组
  setModEnabled(modId, enabled) {
    const mod = this.availableMods.find(m => m.id === modId);
    if (!mod) return false;
    mod.enabled = !!enabled;
    this._saveEnabledState();
    return true;
  }

  // 获取已启用模组列表
  getEnabledMods() {
    return this.availableMods.filter(m => m.enabled);
  }

  // 获取所有模组信息（供 UI 展示）
  getModList() {
    return this.availableMods.map(m => ({
      id: m.id,
      name: m.name,
      version: m.version,
      author: m.author,
      description: m.description,
      enabled: m.enabled,
      loadError: m.loadError
    }));
  }
}

// 全局单例
export const modManager = new ModManager();
