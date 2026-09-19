// ============================================================
// achievements.js — 成就系统（V15.0 系统深化版）
// ------------------------------------------------------------
// V9.5：从 12 个扩充到 30 个，新增分类/点数/奖励/段位。
// V15.0：从 30 个扩充到 50 个，新增 v15_ 前缀成就 20 个，
//   新增「传奇」段位（≥1000分），新增进度查询 API。
//   - category: military/politics/economy/person/special
//   - points:   10~50（累计成就点，决定段位）
//   - reward:    { money?, food?, bgm?, title? } 解锁即发放
//   - 段位: 青铜(<100) / 白银(100~249) / 黄金(250~449) /
//           白金(450~699) / 钻石(700~999) / 传奇(>=1000)
// 在 game.endTurn() 末尾调用 checkAchievements(game)，
// 满足条件且未解锁的成就推入 game.pendingAchievements 供 UI 弹窗。
//
// 状态约定：
//   game.achievements = { [id]: unlockTurn }   已解锁成就及解锁回合
//   game.pendingAchievements = [id, ...]       待弹窗队列
//   game.stats / game.gameStats 累计数据（见 game.js / stats.js）
// ============================================================

import { TECHS, V19_TECH_IDS, isV19LineComplete } from './tech.js';
import { FACTIONS } from './data.js';

// 每条科技线 id → 全部科技 id
const LINE_TECHS = { military: [], economy: [], political: [], formation: [], culture: [] };
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
// 工具：V22 科举/选官系统统计
function _examStats(g) {
  try { return g.imperialExam?.v22_stats || {}; } catch (e) { return {}; }
}
function _examSys(g) {
  try { return g.imperialExam || null; } catch (e) { return null; }
}
// 工具：V23 军事训练/整编/军衔/军功/兵法/锻造系统统计
function _mtStats(g) {
  try { return g.militaryTraining?.v23_stats || {}; } catch (e) { return {}; }
}
function _mtSys(g) {
  try { return g.militaryTraining || null; } catch (e) { return null; }
}
// 工具：玩家武将 id 列表
function _myGeneralIds(g) {
  try { return (g.getFactionGenerals(g.playerFaction) || []).map(x => x.id); }
  catch (e) { return []; }
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
  },

  // ==================== V15.0 新增（20 个 v15_ 前缀） ====================
  // ---- 军事类：大兵团歼灭 / 远征 / 以少胜多（5）----
  {
    id: 'v15_army_annihilation', name: '大兵团歼灭', icon: '💥', category: 'military', points: 40,
    description: '单场战斗歼灭敌军30000人以上。', reward: { food: 4000, title: '歼敌名将' },
    condition: (g) => (g.stats.maxEnemyDestroyed || g.gameStats?.maxEnemyDestroyed || 0) >= 30000,
    progress: (g) => ({ current: Math.min(30000, g.stats?.maxEnemyDestroyed || g.gameStats?.maxEnemyDestroyed || 0), total: 30000 })
  },
  {
    id: 'v15_expedition', name: '远征万里', icon: '🐫', category: 'military', points: 40,
    description: '一支军队连续行军超过10格并获胜。', reward: { food: 3000 },
    condition: (g) => (g.stats.longExpeditionWins || g.gameStats?.longExpeditionWins || 0) >= 1,
    progress: (g) => ({ current: g.stats?.longExpeditionWins || g.gameStats?.longExpeditionWins || 0, total: 1 })
  },
  {
    id: 'v15_underdog_10', name: '屡出奇兵', icon: '🦊', category: 'military', points: 40,
    description: '累计以少胜多10次。', reward: { title: '奇兵之雄' },
    condition: (g) => (g.stats.underdogWins || 0) >= 10,
    progress: (g) => ({ current: Math.min(10, g.stats?.underdogWins || 0), total: 10 })
  },
  {
    id: 'v15_siege_master_20', name: '攻坚之王', icon: '🏹', category: 'military', points: 40,
    description: '累计攻陷20座城池。', reward: { money: 4000 },
    condition: (g) => (g.stats.citiesConquered || 0) >= 20,
    progress: (g) => ({ current: Math.min(20, g.stats?.citiesConquered || 0), total: 20 })
  },
  {
    id: 'v15_ambush_master', name: '伏击无双', icon: '🌑', category: 'military', points: 30,
    description: '以伏击战术获胜5次。', reward: { food: 2000 },
    condition: (g) => (g.stats.ambushWins || g.gameStats?.ambushWins || 0) >= 5,
    progress: (g) => ({ current: Math.min(5, g.stats?.ambushWins || g.gameStats?.ambushWins || 0), total: 5 })
  },

  // ---- 政治类：改革 / 变法 / 集权（4）----
  {
    id: 'v15_reform', name: '锐意改革', icon: '📜', category: 'politics', points: 40,
    description: '推行3次以上制度改革。', reward: { money: 3000, title: '变法名臣' },
    condition: (g) => (g.stats.reformsPassed || g.gameStats?.reformsPassed || 0) >= 3,
    progress: (g) => ({ current: Math.min(3, g.stats?.reformsPassed || g.gameStats?.reformsPassed || 0), total: 3 })
  },
  {
    id: 'v15_centralize', name: '集权中央', icon: '🏛️', category: 'politics', points: 40,
    description: '将所有边境太守换为己方亲信。', reward: { bgm: 'culture' },
    condition: (g) => {
      try {
        const cities = g.getFactionCities(g.playerFaction) || [];
        if (cities.length === 0) return false;
        const loyal = cities.filter(c => {
          if (!c.mayor) return false;
          const mg = g.generals.get(c.mayor);
          return mg && mg.loyalty >= 70;
        }).length;
        return loyal / cities.length >= 0.8;
      } catch (e) { return false; }
    },
    progress: (g) => {
      try {
        const cities = g.getFactionCities(g.playerFaction) || [];
        const loyal = cities.filter(c => c.mayor && g.generals.get(c.mayor)?.loyalty >= 70).length;
        return { current: loyal, total: cities.length || 1 };
      } catch (e) { return { current: 0, total: 1 }; }
    }
  },
  {
    id: 'v15_law_code', name: '律令定邦', icon: '⚖️', category: 'politics', points: 30,
    description: '研究完成全部政治科技线。', reward: { money: 2500 },
    condition: (g) => {
      try {
        const done = new Set(g.techs || []);
        return (LINE_TECHS.political || []).length > 0 && LINE_TECHS.political.every(id => done.has(id));
      } catch (e) { return false; }
    },
    progress: (g) => {
      try {
        const done = new Set(g.techs || []);
        const ids = LINE_TECHS.political || [];
        return { current: ids.filter(id => done.has(id)).length, total: ids.length || 1 };
      } catch (e) { return { current: 0, total: 1 }; }
    }
  },
  {
    id: 'v15_bureaucracy', name: '吏治清明', icon: '📋', category: 'politics', points: 30,
    description: '势力内所有城池民心平均≥70。', reward: { money: 2000 },
    condition: (g) => {
      try {
        const cities = g.getFactionCities(g.playerFaction) || [];
        if (cities.length === 0) return false;
        const avg = cities.reduce((s, c) => s + (c.morale || 0), 0) / cities.length;
        return avg >= 70;
      } catch (e) { return false; }
    },
    progress: (g) => {
      try {
        const cities = g.getFactionCities(g.playerFaction) || [];
        const avg = cities.length ? cities.reduce((s, c) => s + (c.morale || 0), 0) / cities.length : 0;
        return { current: Math.round(avg), total: 70 };
      } catch (e) { return { current: 0, total: 70 }; }
    }
  },

  // ---- 经济类：贸易繁荣 / 粮仓满溢（4）----
  {
    id: 'v15_trade_prosper', name: '贸易繁荣', icon: '🐫', category: 'economy', points: 40,
    description: '建立20条商路并签订3个贸易协定。', reward: { money: 5000, title: '货殖鼻祖' },
    condition: (g) => (g.tradeRoutes || []).length >= 20 && (g.gameStats?.tradeAgreements || 0) >= 3,
    progress: (g) => {
      const routes = (g.tradeRoutes || []).length;
      const agrees = g.gameStats?.tradeAgreements || 0;
      return { current: Math.min(20, routes) + Math.min(3, agrees), total: 23 };
    }
  },
  {
    id: 'v15_granary_full', name: '粮仓满溢', icon: '🌾', category: 'economy', points: 40,
    description: '粮草储备达到100000。', reward: { money: 3000 },
    condition: (g) => { const r = _res(g); return r && r.food >= 100000; },
    progress: (g) => { const r = _res(g); return { current: Math.min(100000, r?.food || 0), total: 100000 }; }
  },
  {
    id: 'v15_market_bustling', name: '市井繁华', icon: '🏪', category: 'economy', points: 30,
    description: '所有己方城市商业等级平均≥70。', reward: { money: 2500 },
    condition: (g) => {
      try {
        const cities = g.getFactionCities(g.playerFaction) || [];
        if (cities.length === 0) return false;
        const avg = cities.reduce((s, c) => s + (c.comm || 0), 0) / cities.length;
        return avg >= 70;
      } catch (e) { return false; }
    },
    progress: (g) => {
      try {
        const cities = g.getFactionCities(g.playerFaction) || [];
        const avg = cities.length ? cities.reduce((s, c) => s + (c.comm || 0), 0) / cities.length : 0;
        return { current: Math.round(avg), total: 70 };
      } catch (e) { return { current: 0, total: 70 }; }
    }
  },
  {
    id: 'v15_long_route', name: '丝路畅通', icon: '🌏', category: 'economy', points: 40,
    description: '同时控制陆上与海上丝绸之路。', reward: { bgm: 'culture', money: 4000 },
    condition: (g) => {
      try {
        const owned = new Set(g.getFactionCities(g.playerFaction).map(c => c.id));
        const land = ['changan', 'luoyang', 'guzang'].every(c => owned.has(c));
        const sea = owned.has('guangzhou');
        return land && sea;
      } catch (e) { return false; }
    },
    progress: (g) => {
      try {
        const owned = new Set(g.getFactionCities(g.playerFaction).map(c => c.id));
        const land = ['changan', 'luoyang', 'guzang'].every(c => owned.has(c)) ? 1 : 0;
        const sea = owned.has('guangzhou') ? 1 : 0;
        return { current: land + sea, total: 2 };
      } catch (e) { return { current: 0, total: 2 }; }
    }
  },

  // ---- 人物类：收服名将 / 培养满级将（4）----
  {
    id: 'v15_recruit_famous', name: '收服名将', icon: '🎯', category: 'person', points: 40,
    description: '招募一名四维总和≥360的传奇武将。', reward: { title: '伯乐宗师' },
    condition: (g) => {
      try {
        const gens = g.getFactionGenerals(g.playerFaction) || [];
        return gens.some(gen => (gen.command + gen.force + gen.intel + gen.politics) >= 360);
      } catch (e) { return false; }
    },
    progress: (g) => {
      try {
        const gens = g.getFactionGenerals(g.playerFaction) || [];
        const best = gens.reduce((m, gen) => Math.max(m, gen.command + gen.force + gen.intel + gen.politics), 0);
        return { current: Math.min(360, best), total: 360 };
      } catch (e) { return { current: 0, total: 360 }; }
    }
  },
  {
    id: 'v15_max_level_general', name: '培养满级将', icon: '⭐', category: 'person', points: 40,
    description: '培养一名等级达到15级的武将。', reward: { title: '帝师之选' },
    condition: (g) => {
      try {
        const gens = g.getFactionGenerals(g.playerFaction) || [];
        return gens.some(gen => (gen.level || 1) >= 15);
      } catch (e) { return false; }
    },
    progress: (g) => {
      try {
        const gens = g.getFactionGenerals(g.playerFaction) || [];
        const best = gens.reduce((m, gen) => Math.max(m, gen.level || 1), 1);
        return { current: Math.min(15, best), total: 15 };
      } catch (e) { return { current: 1, total: 15 }; }
    }
  },
  {
    id: 'v15_loyalty_army', name: '忠心耿耿', icon: '🛡️', category: 'person', points: 30,
    description: '势力内所有武将忠诚均≥80。', reward: { money: 2000 },
    condition: (g) => {
      try {
        const gens = g.getFactionGenerals(g.playerFaction) || [];
        return gens.length > 0 && gens.every(gen => (gen.loyalty || 0) >= 80);
      } catch (e) { return false; }
    },
    progress: (g) => {
      try {
        const gens = g.getFactionGenerals(g.playerFaction) || [];
        const loyal = gens.filter(gen => (gen.loyalty || 0) >= 80).length;
        return { current: loyal, total: gens.length || 1 };
      } catch (e) { return { current: 0, total: 1 }; }
    }
  },
  {
    id: 'v15_generals_elite', name: '名将如云', icon: '🎖️', category: 'person', points: 40,
    description: '同时拥有3名统帅≥95的名将。', reward: { title: '名将之主' },
    condition: (g) => {
      try {
        const gens = g.getFactionGenerals(g.playerFaction) || [];
        return gens.filter(gen => (gen.command || 0) >= 95).length >= 3;
      } catch (e) { return false; }
    },
    progress: (g) => {
      try {
        const gens = g.getFactionGenerals(g.playerFaction) || [];
        const count = gens.filter(gen => (gen.command || 0) >= 95).length;
        return { current: Math.min(3, count), total: 3 };
      } catch (e) { return { current: 0, total: 3 }; }
    }
  },

  // ---- 特殊类：隐藏成就 / 彩蛋（3）----
  {
    id: 'v15_hidden_1', name: '天命玄鸟', icon: '🦅', category: 'special', points: 50,
    description: '（隐藏）在第100回合仍保有都城。', reward: { bgm: 'dynasty', title: '天命玄鸟' },
    condition: (g) => {
      try {
        if (g.turn < 100) return false;
        const capId = FACTIONS[g.playerFaction]?.capital;
        const cap = g.cities.get(capId);
        return cap && cap.owner === g.playerFaction;
      } catch (e) { return false; }
    },
    progress: (g) => ({ current: Math.min(100, g.turn || 0), total: 100 })
  },
  {
    id: 'v15_egg_1', name: '鸡鸣狗盗', icon: '🐔', category: 'special', points: 20,
    description: '（彩蛋）策反对方一名武力<30的文官。', reward: { food: 1000 },
    condition: (g) => (g.gameStats?.lowForceDefects || 0) >= 1,
    progress: (g) => ({ current: Math.min(1, g.gameStats?.lowForceDefects || 0), total: 1 })
  },
  {
    id: 'v15_egg_2', name: '佛缘深厚', icon: '🛐', category: 'special', points: 30,
    description: '（彩蛋）境内佛寺总数达到10座。', reward: { bgm: 'culture' },
    condition: (g) => {
      try {
        const cities = g.getFactionCities(g.playerFaction) || [];
        const temples = cities.reduce((s, c) => s + (c.buildings?.buddhist_temple || 0), 0);
        return temples >= 10;
      } catch (e) { return false; }
    },
    progress: (g) => {
      try {
        const cities = g.getFactionCities(g.playerFaction) || [];
        const temples = cities.reduce((s, c) => s + (c.buildings?.buddhist_temple || 0), 0);
        return { current: Math.min(10, temples), total: 10 };
      } catch (e) { return { current: 0, total: 10 }; }
    }
  },

  // ==================== V16.0 新增（10 个 v16_ 前缀） ====================
  // ---- 战役模式（3） ----
  {
    id: 'v16_ach_campaign_first', name: '初战告捷', icon: '🏁', category: 'special', points: 20,
    description: '首次通关任意一个战役关卡。', reward: { money: 1500, title: '战役先锋' },
    condition: (g) => (g.gameStats?.campaignsCompleted || g.campaignsCompleted || 0) >= 1,
    progress: (g) => ({ current: Math.min(1, g.gameStats?.campaignsCompleted || g.campaignsCompleted || 0), total: 1 })
  },
  {
    id: 'v16_ach_campaign_all', name: '战役全胜', icon: '🏆', category: 'special', points: 50,
    description: '通关战役模式全部关卡。', reward: { bgm: 'dynasty', title: '战役之神' },
    condition: (g) => (g.gameStats?.campaignsCompleted || g.campaignsCompleted || 0) >= 6,
    progress: (g) => ({ current: Math.min(6, g.gameStats?.campaignsCompleted || g.campaignsCompleted || 0), total: 6 })
  },
  {
    id: 'v16_ach_campaign_s', name: 'S级名将', icon: '💎', category: 'special', points: 40,
    description: '在任意一个战役关卡获得 S 级评价。', reward: { title: 'S级名将' },
    condition: (g) => (g.gameStats?.campainsSRank || g.campaignsSRank || 0) >= 1,
    progress: (g) => ({ current: Math.min(1, g.gameStats?.campainsSRank || g.campaignsSRank || 0), total: 1 })
  },

  // ---- 多周目 meta（3） ----
  {
    id: 'v16_ach_ngplus_reward', name: '周目先驱', icon: '🔓', category: 'special', points: 20,
    description: '解锁第一个周目奖励槽位。', reward: { money: 1000 },
    condition: (g) => (g.gameStats?.ngplusRewardsUnlocked || 0) >= 1,
    progress: (g) => ({ current: Math.min(1, g.gameStats?.ngplusRewardsUnlocked || 0), total: 1 })
  },
  {
    id: 'v16_ach_ngplus_tree', name: '轮回满树', icon: '🌳', category: 'special', points: 50,
    description: '解锁全部 10 个周目奖励槽位。', reward: { title: '轮回之主' },
    condition: (g) => (g.gameStats?.ngplusRewardsUnlocked || 0) >= 10,
    progress: (g) => ({ current: Math.min(10, g.gameStats?.ngplusRewardsUnlocked || 0), total: 10 })
  },
  {
    id: 'v16_ach_gallery', name: '图鉴收藏家', icon: '📖', category: 'special', points: 40,
    description: '图鉴收集率达到 50%。', reward: { bgm: 'culture' },
    condition: (g) => (g.gameStats?.galleryCompletion || 0) >= 50,
    progress: (g) => ({ current: Math.min(50, g.gameStats?.galleryCompletion || 0), total: 50 })
  },

  // ---- 高级系统（4） ----
  {
    id: 'v16_ach_espionage_5', name: '谍影重重', icon: '🕵️', category: 'politics', points: 30,
    description: '成功策反敌将 5 次。', reward: { money: 2000 },
    condition: (g) => (g.stats?.defectSuccesses || g.gameStats?.defectSuccesses || 0) >= 5,
    progress: (g) => ({ current: Math.min(5, g.stats?.defectSuccesses || g.gameStats?.defectSuccesses || 0), total: 5 })
  },
  {
    id: 'v16_ach_trade_master', name: '货殖宗师', icon: '🐫', category: 'economy', points: 30,
    description: '同时维持 15 条以上商路。', reward: { money: 3000 },
    condition: (g) => (g.tradeRoutes || []).length >= 15,
    progress: (g) => ({ current: Math.min(15, (g.tradeRoutes || []).length), total: 15 })
  },
  {
    id: 'v16_ach_religion_pillar', name: '佛道双柱', icon: '☸️', category: 'politics', points: 30,
    description: '境内佛寺、道观各达到 5 座。', reward: { bgm: 'culture' },
    condition: (g) => {
      try {
        const cities = g.getFactionCities(g.playerFaction) || [];
        const buddhist = cities.reduce((s, c) => s + (c.buildings?.buddhist_temple || 0), 0);
        const daoist = cities.reduce((s, c) => s + (c.buildings?.daoist_temple || 0), 0);
        return buddhist >= 5 && daoist >= 5;
      } catch (e) { return false; }
    },
    progress: (g) => {
      try {
        const cities = g.getFactionCities(g.playerFaction) || [];
        const b = cities.reduce((s, c) => s + (c.buildings?.buddhist_temple || 0), 0);
        const d = cities.reduce((s, c) => s + (c.buildings?.daoist_temple || 0), 0);
        return { current: Math.min(5, b) + Math.min(5, d), total: 10 };
      } catch (e) { return { current: 0, total: 10 }; }
    }
  },
  {
    id: 'v16_ach_weather_warrior', name: '风雨百战', icon: '⛈️', category: 'military', points: 30,
    description: '在雨雪天气条件下取得 5 场胜利。', reward: { food: 2500 },
    condition: (g) => (g.stats?.weatherWins || g.gameStats?.weatherWins || 0) >= 5,
    progress: (g) => ({ current: Math.min(5, g.stats?.weatherWins || g.gameStats?.weatherWins || 0), total: 5 })
  },

  // ==================== V19.0 新增（10 个 v19_ 前缀：科技树深化 + 文化系统） ====================
  // ---- 科技树：研究 v19 高阶科技（3）----
  {
    id: 'v19_tech_military_first', name: '铁甲新锐', icon: '🗡️', category: 'military', points: 20,
    description: '研究第一个 v19 军事科技。', reward: { money: 1500 },
    condition: (g) => {
      try {
        const done = new Set(g.techs || []);
        return (LINE_TECHS.military || []).some(id => id.startsWith('v19_') && done.has(id));
      } catch (e) { return false; }
    }
  },
  {
    id: 'v19_tech_economy_first', name: '曲辕初耕', icon: '🌱', category: 'economy', points: 20,
    description: '研究第一个 v19 经济科技。', reward: { food: 1500 },
    condition: (g) => {
      try {
        const done = new Set(g.techs || []);
        return (LINE_TECHS.economy || []).some(id => id.startsWith('v19_') && done.has(id));
      } catch (e) { return false; }
    }
  },
  {
    id: 'v19_tech_culture_first', name: '文治肇始', icon: '📜', category: 'politics', points: 20,
    description: '研究第一个 v19 文化科技。', reward: { money: 1500 },
    condition: (g) => {
      try {
        const done = new Set(g.techs || []);
        return (LINE_TECHS.culture || []).some(id => id.startsWith('v19_') && done.has(id));
      } catch (e) { return false; }
    }
  },

  // ---- 科技树：完成 v19 整条线（3）----
  {
    id: 'v19_tech_military_all', name: '武备极盛', icon: '🛡️', category: 'military', points: 40,
    description: '完成全部 v19 军事科技。', reward: { money: 3000, title: '军神' },
    condition: (g) => {
      try { return isV19LineComplete('military', g.techs || []); } catch (e) { return false; }
    },
    progress: (g) => {
      try {
        const done = new Set(g.techs || []);
        const ids = (LINE_TECHS.military || []).filter(id => id.startsWith('v19_'));
        return { current: ids.filter(id => done.has(id)).length, total: ids.length || 1 };
      } catch (e) { return { current: 0, total: 1 }; }
    }
  },
  {
    id: 'v19_tech_economy_all', name: '富庶甲天下', icon: '💰', category: 'economy', points: 40,
    description: '完成全部 v19 经济科技。', reward: { food: 4000 },
    condition: (g) => {
      try { return isV19LineComplete('economy', g.techs || []); } catch (e) { return false; }
    },
    progress: (g) => {
      try {
        const done = new Set(g.techs || []);
        const ids = (LINE_TECHS.economy || []).filter(id => id.startsWith('v19_'));
        return { current: ids.filter(id => done.has(id)).length, total: ids.length || 1 };
      } catch (e) { return { current: 0, total: 1 }; }
    }
  },
  {
    id: 'v19_tech_culture_all', name: '文教昌明', icon: '🎓', category: 'politics', points: 40,
    description: '完成全部 v19 文化科技。', reward: { bgm: 'culture', title: '文宗' },
    condition: (g) => {
      try { return isV19LineComplete('culture', g.techs || []); } catch (e) { return false; }
    },
    progress: (g) => {
      try {
        const done = new Set(g.techs || []);
        const ids = (LINE_TECHS.culture || []).filter(id => id.startsWith('v19_'));
        return { current: ids.filter(id => done.has(id)).length, total: ids.length || 1 };
      } catch (e) { return { current: 0, total: 1 }; }
    }
  },

  // ---- 科技树：全部 v19 科技（1）----
  {
    id: 'v19_tech_all', name: '科技集大成', icon: '🔬', category: 'special', points: 50,
    description: '研究完成全部 v19 科技。', reward: { bgm: 'dynasty', money: 5000, title: '科技宗师' },
    condition: (g) => {
      try {
        const done = new Set(g.techs || []);
        return V19_TECH_IDS.length > 0 && V19_TECH_IDS.every(id => done.has(id));
      } catch (e) { return false; }
    },
    progress: (g) => {
      try {
        const done = new Set(g.techs || []);
        return { current: V19_TECH_IDS.filter(id => done.has(id)).length, total: V19_TECH_IDS.length || 1 };
      } catch (e) { return { current: 0, total: 1 }; }
    }
  },

  // ---- 文化系统（3）----
  {
    id: 'v19_culture_500', name: '文教渐兴', icon: '📖', category: 'politics', points: 30,
    description: '势力文化值达到 500。', reward: { money: 2000 },
    condition: (g) => {
      try {
        const c = g.cultureSystem ? g.cultureSystem.getCulture(g.playerFaction) : 0;
        return c >= 500;
      } catch (e) { return false; }
    },
    progress: (g) => {
      try {
        const c = g.cultureSystem ? g.cultureSystem.getCulture(g.playerFaction) : 0;
        return { current: Math.min(500, c), total: 500 };
      } catch (e) { return { current: 0, total: 500 }; }
    }
  },
  {
    id: 'v19_culture_900', name: '文化盛世', icon: '🏮', category: 'politics', points: 50,
    description: '势力文化值达到 900。', reward: { bgm: 'culture', title: '盛世文宗' },
    condition: (g) => {
      try {
        const c = g.cultureSystem ? g.cultureSystem.getCulture(g.playerFaction) : 0;
        return c >= 900;
      } catch (e) { return false; }
    },
    progress: (g) => {
      try {
        const c = g.cultureSystem ? g.cultureSystem.getCulture(g.playerFaction) : 0;
        return { current: Math.min(900, c), total: 900 };
      } catch (e) { return { current: 0, total: 900 }; }
    }
  },
  {
    id: 'v19_culture_buildings', name: '广开学宫', icon: '🏫', category: 'economy', points: 30,
    description: '累计建造 5 座文化建筑（学府/寺庙/书院/藏书阁）。', reward: { money: 2500 },
    condition: (g) => {
      try {
        if (!g.cultureSystem || !g.cultureSystem.buildings) return false;
        let n = 0;
        for (const b of Object.values(g.cultureSystem.buildings)) {
          n += Object.values(b).reduce((s, c) => s + c, 0);
        }
        return n >= 5;
      } catch (e) { return false; }
    },
    progress: (g) => {
      try {
        let n = 0;
        if (g.cultureSystem && g.cultureSystem.buildings) {
          for (const b of Object.values(g.cultureSystem.buildings)) {
            n += Object.values(b).reduce((s, c) => s + c, 0);
          }
        }
        return { current: Math.min(5, n), total: 5 };
      } catch (e) { return { current: 0, total: 5 }; }
    }
  },

  // ==================== V20.0 新增（10 个 v20_ 前缀：灾害应对 + 人口管理） ====================
  // ---- 灾害应对（5） ----
  {
    id: 'v20_disaster_first', name: "灾厄初临", icon: '⚠️', category: 'special', points: 20,
    description: '境内首次遭遇任意一场自然灾害。', reward: { money: 1500 },
    condition: (g) => {
      try { return (g.disasterSystem?.stats?.triggered || 0) >= 1; } catch (e) { return false; }
    },
    progress: (g) => {
      try { return { current: Math.min(1, g.disasterSystem?.stats?.triggered || 0), total: 1 }; }
      catch (e) { return { current: 0, total: 1 }; }
    }
  },
  {
    id: 'v20_disaster_mitigate_5', name: "开仓赈灾", icon: '🤝', category: 'economy', points: 30,
    description: '累计成功救灾 5 次。', reward: { food: 2000 },
    condition: (g) => {
      try { return (g.disasterSystem?.stats?.mitigated || 0) >= 5; } catch (e) { return false; }
    },
    progress: (g) => {
      try { return { current: Math.min(5, g.disasterSystem?.stats?.mitigated || 0), total: 5 }; }
      catch (e) { return { current: 0, total: 5 }; }
    }
  },
  {
    id: 'v20_disaster_mitigate_20', name: "济世良牧", icon: '⛑️', category: 'economy', points: 40,
    description: '累计成功救灾 20 次。', reward: { money: 4000, title: '济世良牧' },
    condition: (g) => {
      try { return (g.disasterSystem?.stats?.mitigated || 0) >= 20; } catch (e) { return false; }
    },
    progress: (g) => {
      try { return { current: Math.min(20, g.disasterSystem?.stats?.mitigated || 0), total: 20 }; }
      catch (e) { return { current: 0, total: 20 }; }
    }
  },
  {
    id: 'v20_disaster_infra', name: "防灾完备", icon: '🛡️', category: 'economy', points: 40,
    description: '一座城同时具备水利、粮仓、医药与城墙（灾害减免体系齐备）。', reward: { money: 3000 },
    condition: (g) => {
      try {
        const cities = g.getFactionCities(g.playerFaction) || [];
        return cities.some(c => {
          const bs = c.buildings || {};
          const hasGranary = Object.keys(bs).some(b => /granary|gran|warehouse|store/i.test(b));
          const hasMed = Object.keys(bs).some(b => /medical|medic|pharm|clinic|hospital/i.test(b));
          return (c.waterConservancy || 0) >= 40 && hasGranary && hasMed &&
            (c.getEffectiveDefense ? c.getEffectiveDefense() : (c.defense || 0)) >= 50;
        });
      } catch (e) { return false; }
    }
  },
  {
    id: 'v20_disaster_types_all', name: "尝尽百灾", icon: '🌪️', category: 'special', points: 50,
    description: '经历地震、洪水、干旱、瘟疫、蝗灾、暴风雪全部六种灾害。', reward: { bgm: 'dynasty', title: '历劫之主' },
    condition: (g) => {
      try {
        const by = g.disasterSystem?.stats?.byType || {};
        return ['earthquake', 'flood', 'drought', 'plague', 'locust', 'blizzard']
          .every(t => (by[t] || 0) >= 1);
      } catch (e) { return false; }
    },
    progress: (g) => {
      try {
        const by = g.disasterSystem?.stats?.byType || {};
        const hit = ['earthquake', 'flood', 'drought', 'plague', 'locust', 'blizzard']
          .filter(t => (by[t] || 0) >= 1).length;
        return { current: hit, total: 6 };
      } catch (e) { return { current: 0, total: 6 }; }
    }
  },

  // ---- 人口管理（5） ----
  {
    id: 'v20_pop_peak_50w', name: "户口殷盛", icon: '👨‍👩‍👧‍👦', category: 'economy', points: 30,
    description: '势力总人口峰值达到 50 万。', reward: { food: 3000 },
    condition: (g) => {
      try { return (g.populationSystem?.stats?.totalPopPeak || 0) >= 500000; } catch (e) { return false; }
    },
    progress: (g) => {
      try { return { current: Math.min(500000, g.populationSystem?.stats?.totalPopPeak || 0), total: 500000 }; }
      catch (e) { return { current: 0, total: 500000 }; }
    }
  },
  {
    id: 'v20_pop_peak_100w', name: "百万户口", icon: '🏙️', category: 'economy', points: 50,
    description: '势力总人口峰值达到 100 万。', reward: { bgm: 'culture', title: '富庶之主' },
    condition: (g) => {
      try { return (g.populationSystem?.stats?.totalPopPeak || 0) >= 1000000; } catch (e) { return false; }
    },
    progress: (g) => {
      try { return { current: Math.min(1000000, g.populationSystem?.stats?.totalPopPeak || 0), total: 1000000 }; }
      catch (e) { return { current: 0, total: 1000000 }; }
    }
  },
  {
    id: 'v20_pop_conservation', name: "爱民如子", icon: '🕊️', category: 'politics', points: 40,
    description: '征兵比例全程克制（无一次过度征兵叛乱），且人口保持正增长。', reward: { money: 3000, title: '仁君' },
    condition: (g) => {
      try {
        if (!g.populationSystem) return false;
        if ((g.populationSystem.stats?.conscriptionRiots || 0) > 0) return false;
        return (g.populationSystem.stats?.naturalGrowth || 0) >= 50000;
      } catch (e) { return false; }
    },
    progress: (g) => {
      try {
        return { current: Math.min(50000, g.populationSystem?.stats?.naturalGrowth || 0), total: 50000 };
      } catch (e) { return { current: 0, total: 50000 }; }
    }
  },
  {
    id: 'v20_pop_migration', name: "招抚流亡", icon: '🚶', category: 'politics', points: 30,
    description: '累计迁移人口过万（安置流民、充实内郡）。', reward: { food: 2500 },
    condition: (g) => {
      try { return (g.populationSystem?.stats?.migrationIn || 0) + (g.populationSystem?.stats?.migrationOut || 0) >= 10000; }
      catch (e) { return false; }
    },
    progress: (g) => {
      try {
        const n = (g.populationSystem?.stats?.migrationIn || 0) + (g.populationSystem?.stats?.migrationOut || 0);
        return { current: Math.min(10000, n), total: 10000 };
      } catch (e) { return { current: 0, total: 10000 }; }
    }
  },
  {
    id: 'v20_pop_plague_tamer', name: "疫病克星", icon: '⚕️', category: 'special', points: 40,
    description: '医药体系完备（境内 3 座以上医药建筑）并成功救灾 10 次。', reward: { bgm: 'culture', title: '仁医名臣' },
    condition: (g) => {
      try {
        if ((g.disasterSystem?.stats?.mitigated || 0) < 10) return false;
        const cities = g.getFactionCities(g.playerFaction) || [];
        let med = 0;
        for (const c of cities) {
          const bs = c.buildings || {};
          if (Object.keys(bs).some(b => /medical|medic|pharm|clinic|hospital/i.test(b))) med++;
        }
        return med >= 3;
      } catch (e) { return false; }
    },
    progress: (g) => {
      try {
        const mit = Math.min(10, g.disasterSystem?.stats?.mitigated || 0);
        const cities = g.getFactionCities(g.playerFaction) || [];
        let med = 0;
        for (const c of cities) {
          const bs = c.buildings || {};
          if (Object.keys(bs).some(b => /medical|medic|pharm|clinic|hospital/i.test(b))) med++;
        }
        return { current: mit + Math.min(3, med), total: 13 };
      } catch (e) { return { current: 0, total: 13 }; }
    }
  },

  // ==================== V21.0 新增（10 个 v21_ 前缀：丝路贸易深化 + 家族联姻） ====================
  // ---- 丝绸之路贸易（6） ----
  {
    id: 'v21_silk_start', name: '凿空西域', icon: '🐫', category: 'economy', points: 20,
    description: '控制长安、敦煌，贯通丝绸之路东端门户。', reward: { money: 2000 },
    condition: (g) => {
      try { return !!(g.tradeSystem && g.tradeSystem.v21 && g.tradeSystem.v21.started); }
      catch (e) { return false; }
    }
  },
  {
    id: 'v21_silk_stations_3', name: '驿骑星列', icon: '🏯', category: 'economy', points: 30,
    description: '沿丝路建造 3 座驿站。', reward: { money: 2500 },
    condition: (g) => {
      try { return Object.keys(g.tradeSystem?.v21?.stations || {}).length >= 3; }
      catch (e) { return false; }
    },
    progress: (g) => {
      try {
        const n = Object.keys(g.tradeSystem?.v21?.stations || {}).length;
        return { current: Math.min(3, n), total: 3 };
      } catch (e) { return { current: 0, total: 3 }; }
    }
  },
  {
    id: 'v21_silk_stations_6', name: '丝路通衢', icon: '🛣️', category: 'economy', points: 40,
    description: '沿丝路建造 6 座驿站，亭障相望。', reward: { money: 4000, title: '西州都护' },
    condition: (g) => {
      try { return Object.keys(g.tradeSystem?.v21?.stations || {}).length >= 6; }
      catch (e) { return false; }
    },
    progress: (g) => {
      try {
        const n = Object.keys(g.tradeSystem?.v21?.stations || {}).length;
        return { current: Math.min(6, n), total: 6 };
      } catch (e) { return { current: 0, total: 6 }; }
    }
  },
  {
    id: 'v21_silk_peace', name: '胡汉一家', icon: '🕊️', category: 'politics', points: 30,
    description: '与诸戎修好，丝路安全度达到 80 以上。', reward: { money: 2000 },
    condition: (g) => {
      try {
        if (!g.tradeSystem || typeof g.tradeSystem.getSilkRoadSecurity !== 'function') return false;
        return g.tradeSystem.getSilkRoadSecurity(g, g.playerFaction).value >= 80;
      } catch (e) { return false; }
    },
    progress: (g) => {
      try {
        if (!g.tradeSystem || typeof g.tradeSystem.getSilkRoadSecurity !== 'function') return { current: 0, total: 80 };
        const v = g.tradeSystem.getSilkRoadSecurity(g, g.playerFaction).value || 0;
        return { current: Math.min(80, v), total: 80 };
      } catch (e) { return { current: 0, total: 80 }; }
    }
  },
  {
    id: 'v21_silk_profit', name: '聚宝归府', icon: '💰', category: 'economy', points: 40,
    description: '丝路商队累计获利 10000 金。', reward: { money: 5000 },
    condition: (g) => {
      try { return (g.tradeSystem?.v21?.stats?.profitEarned || 0) >= 10000; }
      catch (e) { return false; }
    },
    progress: (g) => {
      try { return { current: Math.min(10000, g.tradeSystem?.v21?.stats?.profitEarned || 0), total: 10000 }; }
      catch (e) { return { current: 0, total: 10000 }; }
    }
  },
  {
    id: 'v21_silk_voyages', name: '西贾不绝', icon: '🧭', category: 'economy', points: 30,
    description: '丝路商队平安往返 5 次。', reward: { food: 3000 },
    condition: (g) => {
      try { return (g.tradeSystem?.v21?.stats?.voyagesCompleted || 0) >= 5; }
      catch (e) { return false; }
    },
    progress: (g) => {
      try { return { current: Math.min(5, g.tradeSystem?.v21?.stats?.voyagesCompleted || 0), total: 5 }; }
      catch (e) { return { current: 0, total: 5 }; }
    }
  },

  // ---- 家族谱系 / 联姻（4） ----
  {
    id: 'v21_marriage_first', name: '秦晋之好', icon: '💍', category: 'person', points: 20,
    description: '首次与他国势力缔结联姻。', reward: { money: 2000 },
    condition: (g) => {
      try { return (g.familySystem?.stats?.marriages || 0) >= 1; }
      catch (e) { return false; }
    }
  },
  {
    id: 'v21_marriage_3', name: '婚娅遍邦', icon: '👑', category: 'politics', points: 40,
    description: '累计与他国缔结婚好 3 次，联姻网布列邦。', reward: { money: 4000, title: '天下婚亲' },
    condition: (g) => {
      try { return (g.familySystem?.stats?.marriages || 0) >= 3; }
      catch (e) { return false; }
    },
    progress: (g) => {
      try { return { current: Math.min(3, g.familySystem?.stats?.marriages || 0), total: 3 }; }
      catch (e) { return { current: 0, total: 3 }; }
    }
  },
  {
    id: 'v21_prestige_clan', name: '四世三公', icon: '🎖️', category: 'person', points: 40,
    description: '家族声望达到 80，门第冠于一时。', reward: { bgm: 'culture', title: '望族元戎' },
    condition: (g) => {
      try {
        if (!g.familySystem || typeof g.familySystem.getFamilyPrestige !== 'function') return false;
        return g.familySystem.getFamilyPrestige(g.playerFaction, g).value >= 80;
      } catch (e) { return false; }
    },
    progress: (g) => {
      try {
        if (!g.familySystem || typeof g.familySystem.getFamilyPrestige !== 'function') return { current: 0, total: 80 };
        const v = g.familySystem.getFamilyPrestige(g.playerFaction, g).value || 0;
        return { current: Math.min(80, v), total: 80 };
      } catch (e) { return { current: 0, total: 80 }; }
    }
  },
  {
    id: 'v21_divorce', name: '恩断义绝', icon: '💔', category: 'special', points: 20,
    description: '经历一次联姻破裂（和离），旧好成隙。', reward: { money: 1000 },
    condition: (g) => {
      try { return (g.familySystem?.stats?.divorces || 0) >= 1; }
      catch (e) { return false; }
    }
  },

  // ==================== V22.0.0 新增（10 个 v22_ 前缀：科举/选官深化） ====================
  // ---- 科举取士（5）----
  {
    id: 'v22_exam_first', name: '首开贡举', icon: '📜', category: 'politics', points: 20,
    description: '首次举办科举，开科取士。', reward: { money: 2000 },
    condition: (g) => {
      try { return (g.imperialExam?.examCount || 0) >= 1; } catch (e) { return false; }
    }
  },
  {
    id: 'v22_zhuangyuan_1', name: '金榜题名', icon: '🏆', category: 'politics', points: 20,
    description: '麾下首次出一位状元。', reward: { money: 2000, title: '座师' },
    condition: (g) => _examStats(g).zhuangyuan >= 1,
    progress: (g) => ({ current: Math.min(1, _examStats(g).zhuangyuan || 0), total: 1 })
  },
  {
    id: 'v22_zhuangyuan_5', name: '状元门生', icon: '🎓', category: 'politics', points: 40,
    description: '麾下累计出 5 位状元，门生故吏遍天下。', reward: { bgm: 'culture', money: 4000 },
    condition: (g) => _examStats(g).zhuangyuan >= 5,
    progress: (g) => ({ current: Math.min(5, _examStats(g).zhuangyuan || 0), total: 5 })
  },
  {
    id: 'v22_military_top', name: '武举魁首', icon: '⚔️', category: 'military', points: 30,
    description: '举办武举并拔擢一名武状元。', reward: { food: 2500 },
    condition: (g) => _examStats(g).militaryTop >= 1,
    progress: (g) => ({ current: Math.min(1, _examStats(g).militaryTop || 0), total: 1 })
  },
  {
    id: 'v22_fellow_network', name: '同年之谊', icon: '🔗', category: 'person', points: 30,
    description: '同榜进士结成同年网络，在世同年 ≥ 6 人。', reward: { money: 2500 },
    condition: (g) => {
      try {
        const sys = _examSys(g);
        if (!sys) return false;
        let total = 0;
        for (const grp of sys.v22_fellowGroups || []) total += (grp.members || []).length;
        return total >= 6;
      } catch (e) { return false; }
    },
    progress: (g) => {
      try {
        const sys = _examSys(g);
        let total = 0;
        for (const grp of (sys?.v22_fellowGroups || [])) total += (grp.members || []).length;
        return { current: Math.min(6, total), total: 6 };
      } catch (e) { return { current: 0, total: 6 }; }
    }
  },

  // ---- 翰林院 / 选官（5）----
  {
    id: 'v22_hanlin_open', name: '词臣登瀛', icon: '🏛️', category: 'politics', points: 20,
    description: '状元入翰林院，开馆养士。', reward: { money: 1500 },
    condition: (g) => {
      try { return (_examSys(g)?.v22_hanlin || []).length >= 1; } catch (e) { return false; }
    }
  },
  {
    id: 'v22_hanlin_culture', name: '翰墨流芳', icon: '📚', category: 'politics', points: 30,
    description: '翰林院累计产出文化值 300 以上。', reward: { bgm: 'culture', title: '文章宗伯' },
    condition: (g) => _examStats(g).hanlinCulture >= 300,
    progress: (g) => ({ current: Math.min(300, _examStats(g).hanlinCulture || 0), total: 300 })
  },
  {
    id: 'v22_cha_recommend', name: '乡举里选', icon: '📯', category: 'person', points: 20,
    description: '察举制下由州郡举士 ≥ 3 人。', reward: { food: 2000 },
    condition: (g) => _examStats(g).recommended >= 3,
    progress: (g) => ({ current: Math.min(3, _examStats(g).recommended || 0), total: 3 })
  },
  {
    id: 'v22_fraud_strict', name: '科场整肃', icon: '🔍', category: 'special', points: 20,
    description: '破获一起科举舞弊，整肃考场风纪。', reward: { money: 1500 },
    condition: (g) => _examStats(g).fraudCaught >= 1,
    progress: (g) => ({ current: Math.min(1, _examStats(g).fraudCaught || 0), total: 1 })
  },
  {
    id: 'v22_official_evaluate', name: '考课黜陟', icon: '⚖️', category: 'politics', points: 30,
    description: '三岁考课累计晋升官员 ≥ 5 人。', reward: { money: 3000 },
    condition: (g) => _examStats(g).promoted >= 5,
    progress: (g) => ({ current: Math.min(5, _examStats(g).promoted || 0), total: 5 })
  },

  // ==================== V23.0.0 新增（10 个 v23_ 前缀：军事训练/军团整编/装备锻造深化） ====================
  // ---- 训练系统（2）----
  {
    id: 'v23_train_elite', name: '训练精兵', icon: '🏋️', category: 'military', points: 20,
    description: '将一支部队训练至 5 级。', reward: { food: 2000 },
    condition: (g) => _mtStats(g).maxTrainingLevel >= 5,
    progress: (g) => ({ current: Math.min(5, _mtStats(g).maxTrainingLevel || 0), total: 5 })
  },
  {
    id: 'v23_battle_hardened', name: '百战精兵', icon: '🪖', category: 'military', points: 40,
    description: '麾下同时拥有 3 支 10 级满训精锐部队。', reward: { money: 4000, title: '练兵如神' },
    condition: (g) => {
      try {
        const sys = _mtSys(g);
        if (!sys) return false;
        const armies = g.getFactionArmies ? g.getFactionArmies(g.playerFaction) : (g.armies || []);
        const mine = armies.filter(a => a.faction === g.playerFaction);
        return mine.filter(a => sys.getTrainingLevel(a.id) >= 10).length >= 3;
      } catch (e) { return false; }
    },
    progress: (g) => {
      try {
        const sys = _mtSys(g);
        const armies = g.getFactionArmies ? g.getFactionArmies(g.playerFaction) : (g.armies || []);
        const n = armies.filter(a => a.faction === g.playerFaction && sys && sys.getTrainingLevel(a.id) >= 10).length;
        return { current: Math.min(3, n), total: 3 };
      } catch (e) { return { current: 0, total: 3 }; }
    }
  },

  // ---- 军团整编（1）----
  {
    id: 'v23_legion_reorganize', name: '军团整编', icon: '🧭', category: 'military', points: 20,
    description: '完成一次军团整编，提升协同作战。', reward: { money: 2000 },
    condition: (g) => (_mtStats(g).reorganizes || 0) >= 1,
    progress: (g) => ({ current: Math.min(1, _mtStats(g).reorganizes || 0), total: 1 })
  },

  // ---- 军衔 / 军功爵（3）----
  {
    id: 'v23_rank_promote', name: '军衔晋升', icon: '🎖️', category: 'military', points: 30,
    description: '麾下一名武将晋衔至「将军」。', reward: { food: 2500 },
    condition: (g) => (_mtStats(g).maxRank || 0) >= 3,
    progress: (g) => ({ current: Math.min(3, _mtStats(g).maxRank || 0), total: 3 })
  },
  {
    id: 'v23_enfeoff', name: '封侯拜将', icon: '🏮', category: 'military', points: 40,
    description: '麾下一名武将凭军功晋爵至「左庶长」以上。', reward: { bgm: 'dynasty', money: 4000, title: '开国功臣' },
    condition: (g) => (_mtStats(g).maxNobility || 0) >= 3,
    progress: (g) => ({ current: Math.min(3, _mtStats(g).maxNobility || 0), total: 3 })
  },
  {
    id: 'v23_meritorious', name: '军功卓著', icon: '⚔️', category: 'military', points: 40,
    description: '麾下单名武将累计军功达到 3500（晋爵大良造）。', reward: { money: 4000 },
    condition: (g) => (_mtStats(g).maxMerit || 0) >= 3500,
    progress: (g) => ({ current: Math.min(3500, _mtStats(g).maxMerit || 0), total: 3500 })
  },

  // ---- 兵法研习（2）----
  {
    id: 'v23_read_bingfa', name: '熟读兵书', icon: '📖', category: 'person', points: 20,
    description: '麾下一名武将研习任意一部兵法。', reward: { money: 1500 },
    condition: (g) => (_mtStats(g).artsStudied || 0) >= 1,
    progress: (g) => ({ current: Math.min(1, _mtStats(g).artsStudied || 0), total: 1 })
  },
  {
    id: 'v23_strategist', name: '兵法大家', icon: '🏛️', category: 'person', points: 50,
    description: '麾下一名武将研习全部四部兵法（孙吴六三略）。', reward: { bgm: 'culture', title: '武库宗师' },
    condition: (g) => {
      try {
        const sys = _mtSys(g);
        return !!(sys && sys.countFullArtists(_myGeneralIds(g)) >= 1);
      } catch (e) { return false; }
    },
    progress: (g) => {
      try {
        const sys = _mtSys(g);
        const n = sys ? sys.countFullArtists(_myGeneralIds(g)) : 0;
        return { current: Math.min(1, n), total: 1 };
      } catch (e) { return { current: 0, total: 1 }; }
    }
  },

  // ---- 装备锻造深化（1）----
  {
    id: 'v23_forge_weapon', name: '神兵锻造', icon: '🔨', category: 'military', points: 30,
    description: '将单件装备强化至 +5。', reward: { money: 3000 },
    condition: (g) => {
      try {
        const sys = _mtSys(g);
        if (!sys || !sys.enhanced) return false;
        return Object.values(sys.enhanced).some(e => (e.lv || 0) >= 5);
      } catch (e) { return false; }
    },
    progress: (g) => {
      try {
        const sys = _mtSys(g);
        let best = 0;
        if (sys && sys.enhanced) for (const e of Object.values(sys.enhanced)) best = Math.max(best, e.lv || 0);
        return { current: Math.min(5, best), total: 5 };
      } catch (e) { return { current: 0, total: 5 }; }
    }
  },

  // ---- 综合（1）----
  {
    id: 'v23_iron_army', name: '铁血雄师', icon: '🐯', category: 'military', points: 50,
    description: '完成一次 5 级军团整编，且拥有满训（10 级）精锐。', reward: { bgm: 'grandbattle', title: '铁血雄师' },
    condition: (g) => {
      try {
        const sys = _mtSys(g);
        if (!sys) return false;
        const reorgMax = Object.values(sys.reorganized || {}).reduce((m, v) => Math.max(m, v), 0);
        return reorgMax >= 5 && (g.militaryTraining?.v23_stats?.maxTrainingLevel || 0) >= 10;
      } catch (e) { return false; }
    },
    progress: (g) => {
      try {
        const sys = _mtSys(g);
        let reorgMax = 0;
        if (sys) reorgMax = Object.values(sys.reorganized || {}).reduce((m, v) => Math.max(m, v), 0);
        const train = g.militaryTraining?.v23_stats?.maxTrainingLevel || 0;
        return { current: Math.min(5, reorgMax) + Math.min(10, train) / 2, total: 10 };
      } catch (e) { return { current: 0, total: 10 }; }
    }
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
  { id: 'legendary', name: '传奇', min: 1000, color: '#FF6D00' },
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

// V15.0 新增：查询单个成就当前进度
// 返回 { current, total, percent, unlocked }
// 优先使用成就自带的 progress(game) 函数；若无则按 0/1 布尔处理
export function getAchievementProgress(achievementId, game) {
  const ach = ACHIEVEMENTS.find(a => a.id === achievementId);
  if (!ach) return { current: 0, total: 1, percent: 0, unlocked: false };
  const unlocked = !!(game.achievements && game.achievements[achievementId]);
  // 已有 progress 函数则调用
  if (typeof ach.progress === 'function') {
    try {
      const { current, total } = ach.progress(game);
      return {
        current, total: total || 1,
        percent: Math.round((current / Math.max(1, total)) * 100),
        unlocked
      };
    } catch (e) { /* 进度计算异常，回退布尔 */ }
  }
  // 无 progress 函数：已解锁=完成，未解锁=0
  return {
    current: unlocked ? 1 : 0,
    total: 1,
    percent: unlocked ? 100 : 0,
    unlocked
  };
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
