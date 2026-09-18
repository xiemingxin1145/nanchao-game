// ============================================================
// achievements.js — 成就系统（V9.5 深化版）
// ------------------------------------------------------------
// V9.5：从 12 个扩充到 30 个，新增分类/点数/奖励/段位。
//   - category: military/politics/economy/person/special
//   - points:   10~50（累计成就点，决定段位）
//   - reward:    { money?, food?, bgm?, title? } 解锁即发放
//   - 段位: 青铜(<100) / 白银(100~249) / 黄金(250~449) /
//           白金(450~699) / 钻石(>=700)
// 在 game.endTurn() 末尾调用 checkAchievements(game)，
// 满足条件且未解锁的成就推入 game.pendingAchievements 供 UI 弹窗。
//
// 状态约定：
//   game.achievements = { [id]: unlockTurn }   已解锁成就及解锁回合
//   game.pendingAchievements = [id, ...]       待弹窗队列
//   game.stats / game.gameStats 累计数据（见 game.js / stats.js）
// ============================================================

import { TECHS } from './tech.js';

// 每条科技线 id → 全部科技 id
const LINE_TECHS = { military: [], economy: [], political: [], formation: [] };
for (const t of TECHS) { if (LINE_TECHS[t.line]) LINE_TECHS[t.line].push(t.id); }

// 全部科技 id 并集（百家争鸣用）
const ALL_TECH_IDS = Object.values(LINE_TECHS).flat();

// 工具：安全读取玩家资源
function _res(g) { try { return g.getPlayerRes ? g.getPlayerRes() : null; } catch (e) { return null; } }
// 工具：玩家总兵力（现役军队 + 驻军）
function _totalTroops(g) {
  try {
    const mine = g.getFactionArmies ? g.getFactionArmies(g.playerFaction) : [];
    const army = mine.reduce((s, a) => s + (a.troops || 0), 0);
    const cities = g.getFactionCities ? g.getFactionCities(g.playerFaction) : [];
    const garrison = cities.reduce((s, c) => s + (c.garrison || 0), 0);
    return army + garrison;
  } catch (e) { return 0; }
}
// 工具：玩家武将数
function _playerGeneralCount(g) {
  try { return g.getFactionGenerals ? g.getFactionGenerals(g.playerFaction).length : 0; }
  catch (e) { return 0; }
}

export const ACHIEVEMENTS = [
  // ==================== 基础（原 V 系列 12 个） ====================
  {
    id: 'first_turn', name: '初出茅庐', icon: '🌱', category: 'military', points: 10,
    description: '完成第一回合。', reward: { money: 200 },
    condition: (g) => g.turn >= 2
  },
  {
    id: 'conquer_first', name: '初克坚城', icon: '🏯', category: 'military', points: 10,
    description: '攻占第一座敌方城市。', reward: { money: 300 },
    condition: (g) => (g.stats.citiesConquered || 0) >= 1
  },
  {
    id: 'win_streak_5', name: '连胜五场', icon: '⚔️', category: 'military', points: 20,
    description: '连胜5场战斗。', reward: { food: 800 },
    condition: (g) => (g.stats.bestWinStreak || 0) >= 5
  },
  {
    id: 'rich', name: '富甲一方', icon: '💰', category: 'economy', points: 10,
    description: '金钱达到10000。', reward: { food: 500 },
    condition: (g) => { const r = _res(g); return r && r.money >= 10000; }
  },
  {
    id: 'army_might', name: '兵强马壮', icon: '🐎', category: 'military', points: 20,
    description: '总兵力达到50000。', reward: { food: 1000 },
    condition: (g) => _totalTroops(g) >= 50000
  },
  {
    id: 'talent_all', name: '人才济济', icon: '📜', category: 'person', points: 20,
    description: '招募所有在野武将。', reward: { money: 800 },
    condition: (g) => (g.stats.idleRecruited || 0) >= (g.initialIdleCount || 3)
  },
  {
    id: 'tech_pioneer', name: '科技先驱', icon: '🔬', category: 'politics', points: 20,
    description: '研究完一条科技线。', reward: { money: 600 },
    condition: (g) => {
      const done = new Set(g.techs || []);
      return Object.values(LINE_TECHS).some(ids => ids.every(id => done.has(id)));
    }
  },
  {
    id: 'underdog', name: '以弱胜强', icon: '🐺', category: 'military', points: 30,
    description: '以少于敌方一半的兵力获胜。', reward: { title: '以弱胜强' },
    condition: (g) => (g.stats.underdogWins || 0) >= 1
  },
  {
    id: 'wall_master', name: '守城大师', icon: '🛡️', category: 'military', points: 30,
    description: '成功防御10次攻城。', reward: { title: '守城名将' },
    condition: (g) => (g.stats.siegesDefended || 0) >= 10
  },
  {
    id: 'unify', name: '一统天下', icon: '👑', category: 'politics', points: 50,
    description: '控制所有城市（16座）。', reward: { bgm: 'dynasty', money: 5000 },
    condition: (g) => g.getFactionCities(g.playerFaction).length >= 16
  },
  {
    id: 'warlord', name: '乱世枭雄', icon: '🔥', category: 'special', points: 10,
    description: '游戏回合数超过50。', reward: { food: 500 },
    condition: (g) => g.turn > 50
  },
  {
    id: 'mandate', name: '天命所归', icon: '🌟', category: 'politics', points: 50,
    description: '以任意势力统一全国。', reward: { bgm: 'dynasty', money: 5000 },
    condition: (g) => g.getFactionCities(g.playerFaction).length >= 16
  },

  // ==================== V9.5 新增（18 个） ====================
  // ---- 军事类（5）----
  {
    id: 'wins_100', name: '百战百胜', icon: '🏅', category: 'military', points: 30,
    description: '累计取得100场胜利。', reward: { food: 3000, title: '常胜将军' },
    condition: (g) => ((g.stats.victories || g.stats.wins || 0) >= 100)
  },
  {
    id: 'army_massive', name: '千军万马', icon: '🐏', category: 'military', points: 40,
    description: '总兵力达到100000。', reward: { food: 5000 },
    condition: (g) => _totalTroops(g) >= 100000
  },
  {
    id: 'cities_20', name: '攻城略地', icon: '🏰', category: 'military', points: 40,
    description: '累计占领20座城市。', reward: { money: 3000 },
    condition: (g) => (g.stats.citiesConquered || 0) >= 20
  },
  {
    id: 'grand_wars_10', name: '会战决胜', icon: '🚩', category: 'military', points: 40,
    description: '累计赢得10次大会战。', reward: { bgm: 'grandbattle', title: '会战之雄' },
    condition: (g) => (g.stats.grandBattlesWon || g.stats.massBattlesWon || 0) >= 10
  },
  {
    id: 'navy_master', name: '水战大师', icon: '⚓', category: 'military', points: 40,
    description: '累计赢得10次水战。', reward: { bgm: 'navy' },
    condition: (g) => (g.stats.navyWins || 0) >= 10
  },

  // ---- 政治类（5）----
  {
    id: 'tech_all', name: '百家争鸣', icon: '📚', category: 'politics', points: 50,
    description: '研究完成全部科技。', reward: { bgm: 'culture', money: 4000 },
    condition: (g) => {
      const done = new Set(g.techs || []);
      return ALL_TECH_IDS.length > 0 && ALL_TECH_IDS.every(id => done.has(id));
    }
  },
  {
    id: 'culture_1000', name: '文化繁荣', icon: '🎨', category: 'politics', points: 40,
    description: '势力文化值累计达到1000。', reward: { bgm: 'culture', title: '文宗' },
    condition: (g) => (g.stats.cultureTotal || g.cultureVictoryTurns || 0) >= 1000
  },
  {
    id: 'exam_top', name: '状元门生', icon: '✒️', category: 'politics', points: 40,
    description: '累计培养10名科举状元。', reward: { bgm: 'exam', money: 2000 },
    condition: (g) => (g.stats.examTopScholars || 0) >= 10
  },
  {
    id: 'abdication', name: '禅让建号', icon: '🛐', category: 'politics', points: 50,
    description: '完成一次禅让建国。', reward: { bgm: 'dynasty', money: 5000 },
    condition: (g) => {
      try { return !!(g.dynastySystem && (g.dynastySystem.abdicated || g.dynastySystem.founded)); }
      catch (e) { return false; }
    }
  },

  // ---- 经济类（5）----
  {
    id: 'money_100k', name: '富甲天下', icon: '💎', category: 'economy', points: 40,
    description: '金钱达到100000。', reward: { food: 5000 },
    condition: (g) => { const r = _res(g); return r && r.money >= 100000; }
  },
  {
    id: 'food_50k', name: '粮草满仓', icon: '🌾', category: 'economy', points: 30,
    description: '粮草达到50000。', reward: { money: 2000 },
    condition: (g) => { const r = _res(g); return r && r.food >= 50000; }
  },
  {
    id: 'trade_10', name: '商路通达', icon: '🐫', category: 'economy', points: 30,
    description: '建立10条商路。', reward: { money: 2500 },
    condition: (g) => (g.tradeRoutes || []).length >= 10
  },
  {
    id: 'build_50', name: '建筑大师', icon: '🏗️', category: 'economy', points: 30,
    description: '累计建造50座建筑。', reward: { money: 2000, food: 2000 },
    condition: (g) => (g.gameStats && g.gameStats.buildingsBuilt || g.stats.buildingsBuilt || 0) >= 50
  },

  // ---- 人物类（2）----
  {
    id: 'five_generals', name: '五子良将', icon: '🎖️', category: 'person', points: 40,
    description: '招募5名统帅90以上的名将。', reward: { title: '伯乐再世' },
    condition: (g) => {
      try {
        const gens = g.getFactionGenerals(g.playerFaction) || [];
        return gens.filter(gen => (gen.command || 0) >= 90).length >= 5;
      } catch (e) { return false; }
    }
  },
  {
    id: 'recruit_80', name: '伯乐相马', icon: '🎯', category: 'person', points: 40,
    description: '累计招募80名武将。', reward: { money: 3000 },
    condition: (g) => {
      const recruited = (g.gameStats && g.gameStats.recruited) || (g.stats.recruitedTotal || 0);
      return recruited >= 80;
    }
  },

  // ---- 特殊类（4）----
  {
    id: 'ngplus_10', name: '周目大师', icon: '♾️', category: 'special', points: 50,
    description: '累计通关10个周目。', reward: { title: '轮回之主' },
    condition: (g) => (g.ngPlusLevel || 0) >= 10 || (g.gameStats && g.gameStats.ngPlusLevel || 0) >= 10
  },
  {
    id: 'titles_20', name: '称号收藏家', icon: '🏅', category: 'special', points: 30,
    description: '累计解锁20个称号。', reward: { title: '名满天下' },
    condition: (g) => {
      let n = 0;
      try { for (const tids of Object.values(g.unlockedTitles || {})) n += (tids || []).length; }
      catch (e) {}
      return n >= 20;
    }
  },
  {
    id: 'perfect_ending', name: '完美结局', icon: '💠', category: 'special', points: 50,
    description: '达成 S 级结局。', reward: { bgm: 'ending', title: '千古一帝' },
    condition: (g) => {
      try {
        const t = g.endings && g.endings.triggered;
        return typeof t === 'string' && /S|perfect|legend|ideal/i.test(t);
      } catch (e) { return false; }
    }
  },
  {
    id: 'speedrun', name: '速通达人', icon: '⚡', category: 'special', points: 50,
    description: '在50回合以内统一全国。', reward: { title: '天下疾风暴' },
    condition: (g) => g.turn <= 50 && g.getFactionCities(g.playerFaction).length >= 16
  }
];

// 分类元数据（供 UI 分组显示）
export const ACH_CATEGORIES = {
  military:  { name: '军事', icon: '⚔️' },
  politics:  { name: '政治', icon: '🏛️' },
  economy:   { name: '经济', icon: '💰' },
  person:    { name: '人物', icon: '👤' },
  special:   { name: '特殊', icon: '✨' }
};

// 段位阈值（累计成就点）
export const ACH_TIERS = [
  { id: 'diamond',  name: '钻石', min: 700, color: '#4FC3F7' },
  { id: 'platinum', name: '白金', min: 450, color: '#E0E0E0' },
  { id: 'gold',     name: '黄金', min: 250, color: '#FFD54F' },
  { id: 'silver',   name: '白银', min: 100, color: '#B0BEC5' },
  { id: 'bronze',   name: '青铜', min: 0,   color: '#B8845A' }
];

// 计算累计成就点
export function getAchievementPoints(game) {
  if (!game.achievements) return 0;
  let pts = 0;
  for (const ach of ACHIEVEMENTS) {
    if (game.achievements[ach.id]) pts += (ach.points || 10);
  }
  return pts;
}

// 根据点数返回段位
export function getAchievementTier(points) {
  for (const t of ACH_TIERS) if (points >= t.min) return t;
  return ACH_TIERS[ACH_TIERS.length - 1];
}

// 检查全部成就，返回本次新解锁的成就数组
// 副作用：解锁即发放 money/food 奖励（BGM/称号奖励由 UI toast 展示并在 game.js 落实）
export function checkAchievements(game) {
  if (!game.achievements) game.achievements = {};
  if (!game.pendingAchievements) game.pendingAchievements = [];
  const newly = [];
  for (const ach of ACHIEVEMENTS) {
    if (game.achievements[ach.id]) continue;
    try {
      if (ach.condition(game)) {
        game.achievements[ach.id] = game.turn;
        game.pendingAchievements.push(ach.id);
        newly.push(ach);
        // 发放资源奖励
        const r = ach.reward || {};
        try {
          if (r.money) game.addPlayerResource ? game.addPlayerResource('money', r.money)
            : (game.factionRes && (game.factionRes.get(game.playerFaction).money += r.money));
          if (r.food) game.addPlayerResource ? game.addPlayerResource('food', r.food)
            : (game.factionRes && (game.factionRes.get(game.playerFaction).food += r.food));
          if (r.bgm && game.audio) { try { game.audio.unlockBGM(r.bgm); } catch (e) {} }
        } catch (e) { /* 奖励发放失败不阻断 */ }
        game.pushLog(`🏆 成就解锁：「${ach.name}」— ${ach.description}`);
      }
    } catch (e) {
      // 条件异常不阻断游戏
    }
  }
  return newly;
}

// 返回成就列表（供 UI 展示，含进度/奖励/分类）
export function getAchievementList(game) {
  return ACHIEVEMENTS.map(a => ({
    id: a.id, name: a.name, description: a.description, icon: a.icon,
    category: a.category, points: a.points || 10, reward: a.reward || {},
    unlocked: !!game.achievements[a.id],
    unlockTurn: game.achievements[a.id] || null
  }));
}
