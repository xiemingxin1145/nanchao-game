// ============================================================
// achievements.js — 成就系统
// 在 game.endTurn() 末尾调用 checkAchievements(game)，
// 满足条件且未解锁的成就推入 game.pendingAchievements 供 UI 弹窗。
//
// 状态约定：
//   game.achievements = { [id]: unlockTurn }   已解锁成就及解锁回合
//   game.pendingAchievements = [id, ...]       待弹窗队列
//   game.stats 累计战斗/内政数据（见 game.js）
// ============================================================

import { TECHS } from './tech.js';

// 每条科技线 id → 全部科技 id
const LINE_TECHS = { military: [], economy: [], political: [] };
for (const t of TECHS) LINE_TECHS[t.line].push(t.id);

export const ACHIEVEMENTS = [
  {
    id: 'first_turn', name: '初出茅庐', icon: '🌱',
    description: '完成第一回合。',
    condition: (g) => g.turn >= 2
  },
  {
    id: 'conquer_first', name: '攻城略地', icon: '🏯',
    description: '攻占第一座敌方城市。',
    condition: (g) => (g.stats.citiesConquered || 0) >= 1
  },
  {
    id: 'win_streak_5', name: '百战百胜', icon: '⚔️',
    description: '连胜5场战斗。',
    condition: (g) => (g.stats.bestWinStreak || 0) >= 5
  },
  {
    id: 'rich', name: '富甲一方', icon: '💰',
    description: '金钱达到10000。',
    condition: (g) => {
      const r = g.getPlayerRes(); return r && r.money >= 10000;
    }
  },
  {
    id: 'army_might', name: '兵强马壮', icon: '🐎',
    description: '总兵力达到50000。',
    condition: (g) => {
      const mine = g.getFactionArmies(g.playerFaction);
      const total = mine.reduce((s, a) => s + a.troops, 0);
      const cities = g.getFactionCities(g.playerFaction);
      const garrison = cities.reduce((s, c) => s + (c.garrison || 0), 0);
      return total + garrison >= 50000;
    }
  },
  {
    id: 'talent_all', name: '人才济济', icon: '📜',
    description: '招募所有在野武将。',
    condition: (g) => (g.stats.idleRecruited || 0) >= (g.initialIdleCount || 3)
  },
  {
    id: 'tech_pioneer', name: '科技先驱', icon: '🔬',
    description: '研究完一条科技线。',
    condition: (g) => {
      const done = new Set(g.techs || []);
      return Object.values(LINE_TECHS).some(ids => ids.every(id => done.has(id)));
    }
  },
  {
    id: 'underdog', name: '以弱胜强', icon: '🐺',
    description: '以少于敌方一半的兵力获胜。',
    condition: (g) => (g.stats.underdogWins || 0) >= 1
  },
  {
    id: 'wall_master', name: '守城大师', icon: '🛡️',
    description: '成功防御10次攻城。',
    condition: (g) => (g.stats.siegesDefended || 0) >= 10
  },
  {
    id: 'unify', name: '一统天下', icon: '👑',
    description: '控制所有城市。',
    condition: (g) => g.getFactionCities(g.playerFaction).length >= 16
  },
  {
    id: 'warlord', name: '乱世枭雄', icon: '🔥',
    description: '游戏回合数超过50。',
    condition: (g) => g.turn > 50
  },
  {
    id: 'mandate', name: '天命所归', icon: '🌟',
    description: '以任意势力统一全国。',
    condition: (g) => g.getFactionCities(g.playerFaction).length >= 16
  }
];

// 检查全部成就，返回本次新解锁的成就数组
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
        game.pushLog(`🏆 成就解锁：「${ach.name}」— ${ach.description}`);
      }
    } catch (e) {
      // 条件异常不阻断游戏
    }
  }
  return newly;
}

// 返回成就列表（供 UI 展示）
export function getAchievementList(game) {
  return ACHIEVEMENTS.map(a => ({
    id: a.id, name: a.name, description: a.description, icon: a.icon,
    unlocked: !!game.achievements[a.id],
    unlockTurn: game.achievements[a.id] || null
  }));
}
