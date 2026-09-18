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

// ============================================================
// V16.0 多周目传承深化（meta-progression）
// ------------------------------------------------------------
// 1) 周目奖励树：每通关一次解锁新奖励槽位
//    （初始金钱 / 初始武将 / 初始科技 / 特殊装备）。
// 2) 难度层级：周目数越高 AI 越强但奖励越丰厚。
// 3) 图鉴解锁：通关特定结局解锁特殊武将/剧本/皮肤。
// 4) 存档继承：通关后可携带少量资源到下一周目。
// ============================================================

const NGPLUS_REWARD_KEY = 'nanchao_ngplus_rewards_v16';

// ---------- 周目奖励树（按周目等级解锁） ----------
// 每个奖励槽位：{ id, name, desc, unlockLevel, type, value }
export const NGPLUS_REWARD_TREE = [
  { id: 'v16_rw_money_1',    name: '内帑充盈·初阶',   desc: '新周目初始金钱 +1000',        unlockLevel: 1, type: 'startMoney',  value: 1000 },
  { id: 'v16_rw_general_1',  name: '元从老将·初阶',   desc: '新周目初始自带一名三流武将',   unlockLevel: 2, type: 'startGeneral', value: 'v16_g_oldguard' },
  { id: 'v16_rw_tech_1',    name: '格物余脉·初阶',   desc: '新周目初始科技点 +20',         unlockLevel: 3, type: 'startTech',   value: 20 },
  { id: 'v16_rw_item_1',     name: '传国宝剑·初阶',   desc: '新周目初始自带一把精良武器',   unlockLevel: 4, type: 'startItem',   value: 'v16_iv_sword' },
  { id: 'v16_rw_money_2',    name: '内帑充盈·中阶',   desc: '新周目初始金钱 +3000',        unlockLevel: 5, type: 'startMoney',  value: 3000 },
  { id: 'v16_rw_general_2',  name: '元从老将·中阶',   desc: '新周目初始自带一名二流武将',   unlockLevel: 6, type: 'startGeneral', value: 'v16_g_guardian' },
  { id: 'v16_rw_tech_2',    name: '格物余脉·中阶',   desc: '新周目初始科技点 +50',         unlockLevel: 7, type: 'startTech',   value: 50 },
  { id: 'v16_rw_item_2',     name: '传国铠甲·中阶',   desc: '新周目初始自带一副精良铠甲',   unlockLevel: 8, type: 'startItem',   value: 'v16_iv_armor' },
  { id: 'v16_rw_money_3',    name: '内帑充盈·高阶',   desc: '新周目初始金钱 +8000',        unlockLevel: 9, type: 'startMoney',  value: 8000 },
  { id: 'v16_rw_general_3',  name: '元从老将·高阶',   desc: '新周目初始自带一名一流名将',   unlockLevel: 10, type: 'startGeneral', value: 'v16_g_legend' }
];

// 难度层级表（周目数 → 难度名 + 倍率）
const DIFFICULTY_TIERS = [
  { maxLevel: 0, name: '乱世初启', aiArmyMult: 1.0,  aiEconMult: 1.0,  rewardMult: 1.0 },
  { maxLevel: 2, name: '群雄逐鹿', aiArmyMult: 1.10, aiEconMult: 1.05, rewardMult: 1.15 },
  { maxLevel: 4, name: '烽火连天', aiArmyMult: 1.20, aiEconMult: 1.10, rewardMult: 1.30 },
  { maxLevel: 6, name: '白骨露野', aiArmyMult: 1.35, aiEconMult: 1.20, rewardMult: 1.50 },
  { maxLevel: 8, name: '天地色变', aiArmyMult: 1.50, aiEconMult: 1.30, rewardMult: 1.80 },
  { maxLevel: 10,name: '轮回之主', aiArmyMult: 2.00, aiEconMult: 1.50, rewardMult: 2.50 }
];

// 图鉴解锁表（结局 id → 解锁内容）
const GALLERY_UNLOCKS = [
  { endingId: 'unify',           unlockType: 'scenario', unlockId: 'v16_scn_legend', name: '剧本：传说之路' },
  { endingId: 'abdicate',        unlockType: 'general',  unlockId: 'v16_g_sage',     name: '武将：隐士高人' },
  { endingId: 'v15_early_death',unlockType: 'skin',     unlockId: 'v16_skin_dark',  name: '皮肤：玄甲' },
  { endingId: 'usurp',           unlockType: 'general',  unlockId: 'v16_g_usurper',  name: '武将：乱世枭雄' },
  { endingId: 'barbarian_takeover', unlockType: 'skin',  unlockId: 'v16_skin_barbarian', name: '皮肤：胡风' }
];

// ---------- 读取/写入已解锁奖励槽位 ----------
function _readUnlockedRewards() {
  try {
    const raw = localStorage.getItem(NGPLUS_REWARD_KEY);
    if (!raw) return { rewards: [], gallery: [] };
    const d = JSON.parse(raw);
    return {
      rewards: Array.isArray(d.rewards) ? d.rewards : [],
      gallery: Array.isArray(d.gallery) ? d.gallery : []
    };
  } catch (e) { return { rewards: [], gallery: [] }; }
}
function _writeUnlockedRewards(data) {
  try { localStorage.setItem(NGPLUS_REWARD_KEY, JSON.stringify(data)); } catch (e) {}
}

// 根据当前周目等级，返回已解锁的奖励槽位列表
export function getNGPlusRewards(level) {
  const lv = Math.max(0, Math.min(MAX_NGPLUS_LEVEL, level || 0));
  return NGPLUS_REWARD_TREE.filter(r => r.unlockLevel <= lv);
}

// 手动解锁一个奖励槽位（通关/成就触发）
export function unlockNGPlusReward(rewardId) {
  const data = _readUnlockedRewards();
  if (!data.rewards.includes(rewardId)) {
    data.rewards.push(rewardId);
    _writeUnlockedRewards(data);
  }
  return data.rewards;
}

// 返回当前周目难度层级
// 返回 { name, aiArmyMult, aiEconMult, rewardMult, level }
export function getNGPlusDifficulty(level) {
  const lv = Math.max(0, Math.min(MAX_NGPLUS_LEVEL, level || 0));
  let tier = DIFFICULTY_TIERS[0];
  for (const t of DIFFICULTY_TIERS) {
    if (lv <= t.maxLevel) { tier = t; break; }
  }
  return {
    name: tier.name,
    aiArmyMult: tier.aiArmyMult,
    aiEconMult: tier.aiEconMult,
    rewardMult: tier.rewardMult,
    level: lv
  };
}

// 返回图鉴中已解锁的全部内容（特殊武将/剧本/皮肤）
// 通关特定结局后调用 unlockGalleryByEnding(endingId) 解锁
export function getUnlockedContent() {
  const data = _readUnlockedRewards();
  return {
    rewards: data.rewards.map(id => NGPLUS_REWARD_TREE.find(r => r.id === id)).filter(Boolean),
    gallery: data.gallery
  };
}

// 根据结局 id 解锁图鉴内容（通关结局时调用）
export function unlockGalleryByEnding(endingId) {
  const data = _readUnlockedRewards();
  const unlocks = GALLERY_UNLOCKS.filter(u => u.endingId === endingId);
  const newOnes = [];
  for (const u of unlocks) {
    const gid = `${u.unlockType}:${u.unlockId}`;
    if (!data.gallery.includes(gid)) {
      data.gallery.push(gid);
      newOnes.push(u);
    }
  }
  if (newOnes.length) _writeUnlockedRewards(data);
  return newOnes;
}

// 存档继承：通关后可携带到下一周目的资源（按周目数计算上限）
// 返回 { money, food, generalCount }
export function getCarryOverAllowance(level) {
  const lv = Math.max(0, Math.min(MAX_NGPLUS_LEVEL, level || 0));
  return {
    money: Math.min(5000 + lv * 2000, 25000),
    food: Math.min(8000 + lv * 3000, 40000),
    generalCount: Math.min(1 + Math.floor(lv / 3), 3)
  };
}

// 计算新周目初始加成（合并 getNGPlusBonus + 奖励树槽位）
// 返回 { money, food, techPoints, generals, items }
export function getNGPlusStartBonus(level) {
  const rewards = getNGPlusRewards(level);
  const bonus = { money: 0, food: 0, techPoints: 0, generals: [], items: [] };
  for (const r of rewards) {
    switch (r.type) {
      case 'startMoney': bonus.money += r.value; break;
      case 'startTech': bonus.techPoints += r.value; break;
      case 'startGeneral': bonus.generals.push(r.value); break;
      case 'startItem': bonus.items.push(r.value); break;
    }
  }
  return bonus;
}
