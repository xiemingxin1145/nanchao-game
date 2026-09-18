// ============================================================
// morale.js — V17.0「战斗系统深化」：士气系统
//
// 设计要点（可复算）：
//  - 每支军队维护一个 0~100 的士气值，初始 50。
//  - 影响因素：胜败、损失、连胜连败、补给、将领忠诚、天气。
//  - 士气分段影响攻击倍率与逃跑概率；低于 10 触发士气崩溃自动撤退。
//  - 全系统独立可序列化，与 army.js / formation.js 解耦。
// ============================================================

// 士气上下限
export const MORALE_MIN = 0;
export const MORALE_MAX = 100;
export const MORALE_INITIAL = 50;

// 士气崩溃阈值（低于此值军队自动撤退）
export const MORALE_ROUT_THRESHOLD = 10;

// 士气分段表：[下限, 攻击倍率加成, 逃跑概率]
// 80~100: +20%, 0%
// 60~80 : +10%, 5%
// 40~60 :  0%, 0%
// 20~40 : -15%, 15%
// 0~20  : -30%, 30%
const MORALE_BANDS = [
  { min: 80, atkMult: 0.20, routChance: 0.00 },
  { min: 60, atkMult: 0.10, routChance: 0.05 },
  { min: 40, atkMult: 0.00, routChance: 0.00 },
  { min: 20, atkMult: -0.15, routChance: 0.15 },
  { min: 0,  atkMult: -0.30, routChance: 0.30 }
];

// 连胜/连败加成的上下限（防止无限滚雪球）
export const MORALE_STREAK_CAP = 80;  // 连胜士气不超过 80
export const MORALE_STREAK_FLOOR = 20; // 连败士气不低于 20

// 各类事件的士气修正量
export const MORALE_EVENTS = {
  WIN: 20,          // 胜利
  LOSE: -20,        // 战败
  HEAVY_LOSS: -15,  // 兵力损失超过 30%
  STREAK_WIN: 10,   // 连续胜利
  STREAK_LOSE: -10, // 连续战败
  SUPPLY_OK: 5,     // 补给充足 / 回合
  SUPPLY_CUT: -10,  // 补给断绝 / 回合
  BAD_WEATHER: -5   // 天气恶劣
};

// 把任意士气值钳制到 0~100
function clampMorale(v) {
  if (v == null || isNaN(v)) return MORALE_INITIAL;
  return Math.max(MORALE_MIN, Math.min(MORALE_MAX, Math.round(v)));
}

/**
 * 根据士气值获取分段配置
 * @param {number} morale
 * @returns {{min:number, atkMult:number, routChance:number, label:string}}
 */
export function getMoraleBand(morale) {
  for (const band of MORALE_BANDS) {
    if (morale >= band.min) {
      const label = morale >= 80 ? '高昂' : morale >= 60 ? '稳定' : morale >= 40 ? '普通' : morale >= 20 ? '低落' : '崩溃';
      return { ...band, label };
    }
  }
  return { ...MORALE_BANDS[MORALE_BANDS.length - 1], label: '崩溃' };
}

// ============================================================
// MoraleSystem 类：管理所有军队的士气
// ============================================================
export class MoraleSystem {
  constructor() {
    // armyId -> { morale, streak, lastResult, updatedAt }
    this.records = {};
  }

  /**
   * 获取某军队士气；不存在则初始化
   * @param {string} armyId
   * @returns {number} 0~100
   */
  getMorale(armyId) {
    if (!this.records[armyId]) {
      this.records[armyId] = {
        morale: MORALE_INITIAL,
        streak: 0,          // 正数连胜，负数连败
        lastResult: null
      };
    }
    return this.records[armyId].morale;
  }

  /**
   * 设置士气（直接覆盖，需自行钳制）
   */
  setMorale(armyId, value) {
    const rec = this._ensure(armyId);
    rec.morale = clampMorale(value);
    return rec.morale;
  }

  /**
   * 应用一次士气变化（delta 可正可负）
   */
  _ensure(armyId) {
    if (!this.records[armyId]) {
      this.records[armyId] = { morale: MORALE_INITIAL, streak: 0, lastResult: null };
    }
    return this.records[armyId];
  }

  /**
   * 通用事件更新
   * @param {string} armyId
   * @param {string} event - MORALE_EVENTS 的键名（如 WIN/LOSE/SUPPLY_OK...）
   * @param {object} game - 可选，用于读取天气/补给/将领忠诚度
   * @returns {{morale:number, delta:number, routed:boolean}}
   */
  updateMorale(armyId, event, game = {}) {
    const rec = this._ensure(armyId);
    let delta = 0;
    const gen = game.general || game.generals?.get?.(game.generalId) || null;

    switch (event) {
      case 'WIN':
        delta = MORALE_EVENTS.WIN;
        rec.streak = rec.streak >= 0 ? rec.streak + 1 : 1;
        // 连续胜利加成（第 2 场起 +10，上限 80）
        if (rec.streak >= 2) {
          rec.morale = clampMorale(rec.morale + MORALE_EVENTS.STREAK_WIN);
          if (rec.morale > MORALE_STREAK_CAP) rec.morale = MORALE_STREAK_CAP;
        }
        rec.lastResult = 'win';
        break;
      case 'LOSE':
        delta = MORALE_EVENTS.LOSE;
        rec.streak = rec.streak <= 0 ? rec.streak - 1 : -1;
        if (rec.streak <= -2) {
          rec.morale = clampMorale(rec.morale + MORALE_EVENTS.STREAK_LOSE);
          if (rec.morale < MORALE_STREAK_FLOOR) rec.morale = MORALE_STREAK_FLOOR;
        }
        rec.lastResult = 'lose';
        break;
      case 'HEAVY_LOSS':
        delta = MORALE_EVENTS.HEAVY_LOSS;
        break;
      case 'SUPPLY_OK':
        delta = MORALE_EVENTS.SUPPLY_OK;
        break;
      case 'SUPPLY_CUT':
        delta = MORALE_EVENTS.SUPPLY_CUT;
        break;
      case 'BAD_WEATHER':
        delta = MORALE_EVENTS.BAD_WEATHER;
        break;
      default:
        // 允许传入自定义数值 delta
        if (typeof event === 'number') delta = event;
        break;
    }

    // 将领忠诚度高 → +5 加成（忠诚 ≥ 80 视为死忠）
    if (gen && typeof gen.loyalty === 'number' && gen.loyalty >= 80) {
      delta += 5;
    }

    rec.morale = clampMorale(rec.morale + delta);
    return {
      morale: rec.morale,
      delta,
      routed: rec.morale < MORALE_ROUT_THRESHOLD
    };
  }

  /**
   * 战斗结果回调：胜方/败方同时更新
   * @param {string} winnerArmy - 胜方 armyId
   * @param {string} loserArmy - 败方 armyId
   * @param {object} opts - { winnerLossRatio, loserLossRatio, winnerGeneral, loserGeneral }
   */
  onBattleResult(winnerArmy, loserArmy, opts = {}) {
    const w = this.updateMorale(winnerArmy, 'WIN', { general: opts.winnerGeneral });
    const l = this.updateMorale(loserArmy, 'LOSE', { general: opts.loserGeneral });

    // 兵力损失超过 30% → 额外 -15
    if (opts.loserLossRatio != null && opts.loserLossRatio > 0.30) {
      this.updateMorale(loserArmy, 'HEAVY_LOSS');
    }
    if (opts.winnerLossRatio != null && opts.winnerLossRatio > 0.30) {
      this.updateMorale(winnerArmy, 'HEAVY_LOSS');
    }
    return {
      winnerMorale: this.getMorale(winnerArmy),
      loserMorale: this.getMorale(loserArmy),
      winnerRouted: w.routed,
      loserRouted: this.getMorale(loserArmy) < MORALE_ROUT_THRESHOLD
    };
  }

  /**
   * 获取某军队的战斗修正袋
   * @param {string} armyId
   * @returns {{atkMult:number, routChance:number, routed:boolean, morale:number, label:string}}
   */
  getMoraleCombatMod(armyId) {
    const morale = this.getMorale(armyId);
    const band = getMoraleBand(morale);
    return {
      morale,
      atkMult: band.atkMult,
      routChance: band.routChance,
      routed: morale < MORALE_ROUT_THRESHOLD,
      label: band.label
    };
  }

  /**
   * 查询是否士气崩溃需要自动撤退
   */
  isRouted(armyId) {
    return this.getMorale(armyId) < MORALE_ROUT_THRESHOLD;
  }

  /**
   * 连胜/连败计数
   */
  getStreak(armyId) {
    return this._ensure(armyId).streak;
  }

  // ---- 序列化 / 反序列化 ----
  serialize() {
    const out = {};
    for (const [id, rec] of Object.entries(this.records)) {
      out[id] = { ...rec };
    }
    return out;
  }

  load(data) {
    this.records = {};
    if (data && typeof data === 'object') {
      for (const [id, rec] of Object.entries(data)) {
        this.records[id] = {
          morale: clampMorale(rec.morale),
          streak: rec.streak || 0,
          lastResult: rec.lastResult || null
        };
      }
    }
    return this;
  }
}

// ============================================================
// 模块级单例（便于 game 层全局使用）
// ============================================================
export const moraleSystem = new MoraleSystem();

// ============================================================
// 便捷函数式 API（与 army.js 对接）
// ============================================================

/** 直接查询某军队士气 */
export function getMorale(armyId, sys = moraleSystem) {
  return sys.getMorale(armyId);
}

/** 直接更新士气 */
export function updateMorale(armyId, event, game = {}, sys = moraleSystem) {
  return sys.updateMorale(armyId, event, game);
}

/** 直接获取战斗修正 */
export function getMoraleCombatMod(armyId, sys = moraleSystem) {
  return sys.getMoraleCombatMod(armyId);
}

/** 战斗结果回调 */
export function onBattleResult(winnerArmy, loserArmy, opts = {}, sys = moraleSystem) {
  return sys.onBattleResult(winnerArmy, loserArmy, opts);
}
