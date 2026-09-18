// ============================================================
// ngplus.js — V3.5 周目继承（New Game+）系统
// ------------------------------------------------------------
// 技术参考（Web Audio/Canvas 调研受限时采用的通用方案）：
// 1) 元游戏继承通用做法：通关后把「持久化解锁」写入独立存储槽
//    （与主存档隔离），新开局时读取并叠加在初始数据上。
//    参考：Hades / Slay the Spire 的 meta-progression 设计。
// 2) 数值平衡：周目加成随周目线性增长但封顶，避免 10 周目后
//    数值爆炸。公式：AI兵力加成 = min(level,10)*10%；
//    AI经济加成 = min(level,10)*5%；玩家初始科技点加成 =
//    min(level,10)*10%。10 周目累计 AI 兵力 +100% / 经济 +50%，
//    玩家科技点 +100%（硬性上限，见 getNGPlusBonus）。
// 3) 存档键名缩写：使用短键（gl/g/i/t/s）以压缩 localStorage 体积。
// ============================================================

const NGPLUS_KEY = 'nanchao_ngplus_data';
const INTRO_KEY = 'nanchao_intro_completed';
export const MAX_NGPLUS_LEVEL = 10;

// 读取上局写入的周目继承数据（不含运行时对象，仅纯数据）
// 返回 null 表示无继承数据
export function loadNGPlusData() {
  try {
    const raw = localStorage.getItem(NGPLUS_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    // 字段补全
    return {
      level: typeof d.level === 'number' ? d.level : 0,
      generals: Array.isArray(d.g) ? d.g : [],          // 已解锁武将 id 列表
      items: Array.isArray(d.i) ? d.i : [],             // 已获得装备 id 列表
      titles: Array.isArray(d.t) ? d.t : [],             // 已解锁称号 id 列表
      stories: Array.isArray(d.s) ? d.s : [],            // 已完成个人剧情 {generalId,nodeId}
      endings: d.e && typeof d.e === 'object' ? d.e : {},// 各结局达成次数
      totalRuns: typeof d.r === 'number' ? d.r : 0       // 总通关次数
    };
  } catch (e) { return null; }
}

// 通关时调用：把当前局的关键数据写入 ngplus_data
// 参数 game：当前 Game 实例
export function saveNGPlusData(game) {
  try {
    const prev = loadNGPlusData() || { level: 0, generals: [], items: [], titles: [], stories: [], endings: {}, totalRuns: 0 };
    // 累加已解锁武将（当前势力武将 + 已招募在野武将）
    const generalSet = new Set(prev.generals);
    for (const g of game.generals.values()) {
      if (g.faction !== null) generalSet.add(g.id);
    }
    // 累加装备（玩家库存 + 玩家武将身上装备）
    const itemSet = new Set(prev.items);
    const inv = game.getPlayerInventory ? game.getPlayerInventory() : [];
    for (const it of inv) itemSet.add(it);
    for (const g of game.getFactionGenerals(game.playerFaction)) {
      if (g.equipment) for (const k of Object.keys(g.equipment)) {
        if (g.equipment[k]) itemSet.add(g.equipment[k]);
      }
    }
    // 累加称号
    const titleSet = new Set(prev.titles);
    if (game.unlockedTitles) {
      for (const [gid, tids] of Object.entries(game.unlockedTitles)) {
        for (const tid of (tids || [])) titleSet.add(tid);
      }
    }
    // 累加个人剧情完成记录
    const storySet = new Set(prev.stories.map(s => s.gid + '|' + s.nid));
    if (game.story && game.story.progress) {
      for (const [gid, prog] of Object.entries(game.story.progress)) {
        const doneNodes = (prog && (prog.completedNodes || prog.done)) || [];
        for (const nid of doneNodes) storySet.add(gid + '|' + nid);
      }
    }
    // 结局计数
    const endings = Object.assign({}, prev.endings);
    if (game.gameOver && game.gameOver.endingId) {
      endings[game.gameOver.endingId] = (endings[game.gameOver.endingId] || 0) + 1;
    }
    const next = {
      level: Math.min(MAX_NGPLUS_LEVEL, prev.level + 1),
      g: [...generalSet],
      i: [...itemSet],
      t: [...titleSet],
      s: [...storySet].map(s => {
        const [gid, nid] = s.split('|');
        return { gid, nid };
      }),
      e: endings,
      r: prev.totalRuns + 1
    };
    localStorage.setItem(NGPLUS_KEY, JSON.stringify(next));
    return next;
  } catch (e) {
    console.warn('[ngplus] 写入失败', e);
    return null;
  }
}

// 清除周目继承数据（重新开始）
export function clearNGPlusData() {
  try { localStorage.removeItem(NGPLUS_KEY); } catch (e) {}
}

// 计算周目加成
// 返回：{ aiArmyMult, aiEconMult, techPointBonus, loyaltyBonus, attrPct }
// 数值平衡（硬性上限）：
//   AI 兵力乘算 = 1 + level*0.10 （10周目 +100%）
//   AI 经济乘算 = 1 + level*0.05  （10周目 +50%）
//   玩家初始科技点 = level*10% 追加（10周目 +100%）
//   继承武将忠诚 +20 起步
//   已完成剧情的武将全属性 +5%
export function getNGPlusBonus(level) {
  const lv = Math.max(0, Math.min(MAX_NGPLUS_LEVEL, level || 0));
  return {
    level: lv,
    aiArmyMult: 1 + lv * 0.10,
    aiEconMult: 1 + lv * 0.05,
    techPointBonus: lv * 0.10,
    loyaltyBonus: lv > 0 ? 20 : 0,
    storyAttrPct: lv > 0 ? 0.05 : 0
  };
}

// ---------- 开场演出状态（localStorage） ----------
export function isIntroCompleted() {
  try { return localStorage.getItem(INTRO_KEY) === '1'; } catch (e) { return false; }
}
export function markIntroCompleted() {
  try { localStorage.setItem(INTRO_KEY, '1'); } catch (e) {}
}
export function resetIntroCompleted() {
  try { localStorage.removeItem(INTRO_KEY); } catch (e) {}
}
