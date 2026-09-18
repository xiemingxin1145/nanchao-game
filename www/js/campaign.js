// ============================================================
// campaign.js — V16.0 战役模式系统（新建）
// ------------------------------------------------------------
// 战役模式核心逻辑：
//  - CampaignSystem 类：管理战役关卡进度
//  - 战役状态机：未开始(idle) → 进行时(running) → 胜利(win)
//                → 失败(lose) → 通关(completed)
//  - 目标追踪：实时检查胜利/失败条件
//  - 奖励发放：通关后发放奖励（金钱/武将/装备/成就）
//  - 分支战役：根据上一关表现（评级 S/A/B）解锁不同下一关
//  - 战役存档：独立的战役存档槽（与普通存档分离）
//
// API：
//   startCampaign(campaignId)           开始战役
//   getCampaignState()                   返回当前战役状态
//   checkCampaignObjectives(game)       实时检查胜利/失败条件
//   completeCampaign(campaignId)         完成战役并发放奖励
//   getCampaignRewards(campaignId)       返回战役奖励表
//   getAvailableCampaigns()              返回可玩战役列表
//
// 战役数据：优先从 data.js 的 CAMPAIGN_SCENARIOS 导入；
//   若 data.js 尚未导出，则使用本地内置 V16_CAMPAIGN_DATA 兜底。
// ============================================================

import * as DataModule from './data.js';

const CAMPAIGN_SAVE_KEY = 'nanchao_campaign_save_v16';
const CAMPAIGN_PROGRESS_KEY = 'nanchao_campaign_progress_v16';

// ---------- 本地兜底战役数据（data.js 未导出时使用） ----------
const V16_CAMPAIGN_DATA = [
  {
    id: 'v16_camp_shayuan',
    name: '沙苑之战',
    chapter: '关东风云',
    description: '公元537年，宇文泰以不满万人之众，于沙苑设伏大破高欢二十万大军。你将率西魏精锐，重现以少胜多的经典战例。',
    recommendTurn: 15,
    factions: { player: 'xiwei', enemy: 'dongwei' },
    objectives: {
      win:  { type: 'destroyEnemyArmy', desc: '歼灭高欢主力军团（敌军兵力折损60%以上）', threshold: 0.6 },
      lose: { type: 'loseCapital',      desc: '长安失守则战役失败' }
    },
    branches: {
      S: 'v16_camp_jingling',
      A: 'v16_camp_jingling',
      B: 'v16_camp_tongguan'
    },
    rewards: {
      money: 3000, food: 4000,
      generals: ['v16_g_shayuan_veteran'],
      items: ['v16_iv_vanguard_banner'],
      achievement: 'v16_ach_shayuan'
    }
  },
  {
    id: 'v16_camp_tongguan',
    name: '潼关据守',
    chapter: '关东风云',
    description: '据潼关天险，阻挡东魏西进。坚守至援军抵达，方保关中无虞。',
    recommendTurn: 20,
    factions: { player: 'xiwei', enemy: 'dongwei' },
    objectives: {
      win:  { type: 'holdTurns',   desc: '坚守潼关20回合不失', threshold: 20 },
      lose: { type: 'loseCapital', desc: '潼关/长安失守则失败' }
    },
    branches: {
      S: 'v16_camp_jingling',
      A: 'v16_camp_jingling',
      B: 'v16_camp_jiangling'
    },
    rewards: {
      money: 2500, food: 3500,
      generals: [],
      items: ['v16_illu_tongguan_shield'],
      achievement: 'v16_ach_tongguan'
    }
  },
  {
    id: 'v16_camp_jingling',
    name: '江陵攻防',
    chapter: '梁魏纷争',
    description: '西魏南下取江陵，生擒梁元帝。你须在江河纵横之间，突破梁人江防。',
    recommendTurn: 25,
    factions: { player: 'xiwei', enemy: 'nanchao' },
    objectives: {
      win:  { type: 'occupyCity',  desc: '攻占江陵', cityId: 'jiangling' },
      lose: { type: 'timeout',     desc: '30回合内未攻占江陵则失败' }
    },
    branches: {
      S: 'v16_camp_huaiyin',
      A: 'v16_camp_huaiyin',
      B: 'v16_camp_huaiyin'
    },
    rewards: {
      money: 4000, food: 5000,
      generals: ['v16_g_jiangling_captive'],
      items: [],
      achievement: 'v16_ach_jiangling'
    }
  },
  {
    id: 'v16_camp_huaiyin',
    name: '淮南拉锯',
    chapter: '江淮战场',
    description: '淮南要地，南北反复争夺。你须在水网地带与南朝水军周旋，稳固防线。',
    recommendTurn: 30,
    factions: { player: 'dongwei', enemy: 'nanchao' },
    objectives: {
      win:  { type: 'occupyCity',  desc: '攻占寿阳并守住10回合', cityId: 'shouyang' },
      lose: { type: 'loseAllCities', desc: '丧失全部淮南城池则失败' }
    },
    branches: {
      S: 'v16_camp_mogao',
      A: 'v16_camp_mogao',
      B: null
    },
    rewards: {
      money: 5000, food: 6000,
      generals: ['v16_g_huaiyin_marshal'],
      items: ['v16_iv_southern_bow'],
      achievement: 'v16_ach_huaiyin'
    }
  },
  {
    id: 'v16_camp_mogao',
    name: '河西拓土',
    chapter: '河西走廊',
    description: '西征吐谷浑，打通河西走廊。控制丝路要冲，断匈奴右臂。',
    recommendTurn: 35,
    factions: { player: 'xiwei', enemy: 'barbarian' },
    objectives: {
      win:  { type: 'occupyCity',  desc: '攻占姑臧', cityId: 'guzang' },
      lose: { type: 'loseCapital', desc: '天水失守则失败' }
    },
    branches: {
      S: 'v16_camp_final',
      A: 'v16_camp_final',
      B: null
    },
    rewards: {
      money: 6000, food: 7000,
      generals: ['v16_g_hexi_commander'],
      items: ['v16_iv_silk_map'],
      achievement: 'v16_ach_hexi'
    }
  },
  {
    id: 'v16_camp_final',
    name: '混一北方',
    chapter: '终章',
    description: '自北魏分裂以来，东西对峙已近四十年。今你承天命，扫平关东，混一北方，为一统天下奠基。',
    recommendTurn: 40,
    factions: { player: 'xiwei', enemy: 'dongwei' },
    objectives: {
      win:  { type: 'occupyCity',  desc: '攻占邺城，消灭北齐', cityId: 'yecheng' },
      lose: { type: 'loseCapital', desc: '长安失守则战役失败' }
    },
    branches: {
      S: null, A: null, B: null
    },
    rewards: {
      money: 10000, food: 12000,
      generals: ['v16_g_unifier'],
      items: ['v16_iv_imperial_seal'],
      achievement: 'v16_ach_unifier'
    }
  }
];

// 合并 data.js 导出（若存在）与本地兜底
const CAMPAIGN_SCENARIOS =
  (DataModule.CAMPAIGN_SCENARIOS && DataModule.CAMPAIGN_SCENARIOS.length)
    ? DataModule.CAMPAIGN_SCENARIOS
    : V16_CAMPAIGN_DATA;

// ---------- 战役状态机 ----------
// idle(未开始) → running(进行中) → win(胜利) / lose(失败) → completed(通关)
export const CampaignState = {
  IDLE: 'idle',
  RUNNING: 'running',
  WIN: 'win',
  LOSE: 'lose',
  COMPLETED: 'completed'
};

export class CampaignSystem {
  constructor() {
    this.state = CampaignState.IDLE;
    this.currentCampaignId = null;
    this.campaignData = null;
    this.turn = 0;
    this._progress = this._loadProgress();
  }

  // ---------- 持久化（独立战役存档槽） ----------
  _loadProgress() {
    try {
      const raw = localStorage.getItem(CAMPAIGN_PROGRESS_KEY);
      if (!raw) return { completed: [], ratings: {} };
      const d = JSON.parse(raw);
      return {
        completed: Array.isArray(d.completed) ? d.completed : [],
        ratings: d.ratings && typeof d.ratings === 'object' ? d.ratings : {}
      };
    } catch (e) { return { completed: [], ratings: {} }; }
  }
  _saveProgress() {
    try {
      localStorage.setItem(CAMPAIGN_PROGRESS_KEY, JSON.stringify(this._progress));
    } catch (e) {}
  }
  _saveRuntime() {
    try {
      localStorage.setItem(CAMPAIGN_SAVE_KEY, JSON.stringify({
        state: this.state,
        currentCampaignId: this.currentCampaignId,
        turn: this.turn
      }));
    } catch (e) {}
  }
  loadRuntime() {
    try {
      const raw = localStorage.getItem(CAMPAIGN_SAVE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      this.state = d.state || CampaignState.IDLE;
      this.currentCampaignId = d.currentCampaignId || null;
      this.turn = d.turn || 0;
      this.campaignData = CAMPAIGN_SCENARIOS.find(c => c.id === this.currentCampaignId) || null;
    } catch (e) {}
  }

  // ---------- API ----------
  // 开始战役
  startCampaign(campaignId) {
    const data = CAMPAIGN_SCENARIOS.find(c => c.id === campaignId);
    if (!data) return false;
    this.currentCampaignId = campaignId;
    this.campaignData = data;
    this.state = CampaignState.RUNNING;
    this.turn = 0;
    this._saveRuntime();
    return true;
  }

  // 返回当前战役状态
  getCampaignState() {
    return {
      state: this.state,
      campaignId: this.currentCampaignId,
      campaignName: this.campaignData ? this.campaignData.name : null,
      turn: this.turn,
      completed: [...this._progress.completed],
      ratings: { ...this._progress.ratings }
    };
  }

  // 实时检查胜利/失败条件
  // game: 当前 Game 实例
  // 返回 { result: 'win'|'lose'|'continue', rating: 'S'|'A'|'B'|null, detail: string }
  checkCampaignObjectives(game) {
    if (!this.campaignData || this.state !== CampaignState.RUNNING) {
      return { result: 'continue', rating: null, detail: '非进行中战役' };
    }
    const obj = this.campaignData.objectives;
    this.turn = (game && game.turn) || this.turn;

    // ---- 胜利条件 ----
    const win = obj.win;
    let winMet = false;
    let rating = 'A';
    try {
      if (win.type === 'occupyCity') {
        // 检查玩家是否占据目标城市
        const city = game.cities && game.cities.get(win.cityId);
        winMet = !!(city && city.owner === game.playerFaction);
      } else if (win.type === 'destroyEnemyArmy') {
        // 敌军兵力折损比例
        const enemyArmies = game.getFactionArmies ? game.getFactionArmies(this.campaignData.factions.enemy) : [];
        const start = game._campaignStartEnemyTroops || enemyArmies.reduce((s, a) => s + (a.troops || 0), 0);
        const cur = enemyArmies.reduce((s, a) => s + (a.troops || 0), 0);
        if (start > 0) {
          const destroyed = 1 - cur / start;
          winMet = destroyed >= (win.threshold || 0.6);
        }
      } else if (win.type === 'holdTurns') {
        winMet = this.turn >= (win.threshold || 20);
      }
    } catch (e) { winMet = false; }

    // ---- 失败条件 ----
    const lose = obj.lose;
    let loseMet = false;
    try {
      if (lose.type === 'loseCapital') {
        const cap = this.campaignData.factions.player &&
          (game.getFactionCities ? game.getFactionCities(this.campaignData.factions.player) : []);
        loseMet = !cap || cap.length === 0;
      } else if (lose.type === 'loseAllCities') {
        const cities = game.getFactionCities ? game.getFactionCities(this.campaignData.factions.player) : [];
        loseMet = cities.length === 0;
      } else if (lose.type === 'timeout') {
        loseMet = this.turn >= (win.threshold || 30) && !winMet;
      }
    } catch (e) { loseMet = false; }

    // ---- 评级（S: 低伤亡/快通关；A: 按时通关；B: 险胜） ----
    if (winMet) {
      if (this.turn <= (this.campaignData.recommendTurn * 0.6)) rating = 'S';
      else if (this.turn <= this.campaignData.recommendTurn) rating = 'A';
      else rating = 'B';
      this.state = CampaignState.WIN;
      this._progress.ratings[this.currentCampaignId] = rating;
      this._saveRuntime();
      return { result: 'win', rating, detail: `战役胜利！评级 ${rating}` };
    }
    if (loseMet) {
      this.state = CampaignState.LOSE;
      this._saveRuntime();
      return { result: 'lose', rating: null, detail: '战役失败' };
    }
    return { result: 'continue', rating: null, detail: '战役进行中' };
  }

  // 完成战役并发放奖励
  completeCampaign(campaignId) {
    const cid = campaignId || this.currentCampaignId;
    const data = CAMPAIGN_SCENARIOS.find(c => c.id === cid);
    if (!data) return null;
    // 记录通关
    if (!this._progress.completed.includes(cid)) {
      this._progress.completed.push(cid);
    }
    this._saveProgress();

    const rewards = this.getCampaignRewards(cid);
    // 分支解锁：根据评级决定下一关
    const rating = this._progress.ratings[cid] || 'B';
    const nextId = data.branches ? (data.branches[rating] || null) : null;

    this.state = CampaignState.COMPLETED;
    this.currentCampaignId = null;
    this.campaignData = null;
    this._saveRuntime();

    return {
      campaignId: cid,
      rewards,
      nextCampaignId: nextId,
      nextCampaign: nextId ? CAMPAIGN_SCENARIOS.find(c => c.id === nextId) || null : null
    };
  }

  // 返回战役奖励表
  getCampaignRewards(campaignId) {
    const data = CAMPAIGN_SCENARIOS.find(c => c.id === campaignId);
    if (!data) return null;
    return { ...(data.rewards || {}) };
  }

  // 返回可玩战役列表（含是否已通关/下一关解锁）
  getAvailableCampaigns() {
    return CAMPAIGN_SCENARIOS.map(c => {
      const completed = this._progress.completed.includes(c.id);
      const rating = this._progress.ratings[c.id] || null;
      return {
        id: c.id, name: c.name, chapter: c.chapter,
        description: c.description,
        recommendTurn: c.recommendTurn,
        completed, rating,
        rewards: c.rewards || {}
      };
    });
  }

  // 重置战役进度
  resetCampaign() {
    this.state = CampaignState.IDLE;
    this.currentCampaignId = null;
    this.campaignData = null;
    this.turn = 0;
    try { localStorage.removeItem(CAMPAIGN_SAVE_KEY); } catch (e) {}
  }
}

// 单例导出（供 ui.js / game.js 使用）
export const campaignSystem = new CampaignSystem();
