// ============================================================
// calendar.js — V8.5 历法节气 / 天文异象系统
// ------------------------------------------------------------
// 历史依据：
//  · 二十四节气定型于《淮南子·天文训》（前139），南北朝沿用太初、景初历；
//    太史令掌候部、灵台、观星。每季六气，岁凡二十四。
//  · 《宋书·天文志》《魏书·天象志》《隋书·天文志》记：
//      日食——「日有食之，阴侵阳，君道有亏」，主亡国失君；
//      月食——「兵阴之象」，主外侮；
//      彗星——「除旧布新」，天下革政；
//      流星——「异人星象」，应在谋臣；
//      荧惑守心——「王者恶之」「大人易政，主去其宫」，主兵革大丧。
// 设计：
//  · 每回合推进一个节气（24 节气一循环，约 4 年成一周天）。
//  · seasonIdx = floor(termIdx/6)，与既有四季/粮产倍率自动对齐。
//  · 节气效果在 settleTurn 统一结算；天文异象按权重随机触发，
//    叠加惩罚并向 eventSystem 推送对应事件 id（事件由 events.js 处理）。
// ============================================================
import { SOLAR_TERMS, CELESTIAL_ANOMALIES, ANOMALY_BASE_CHANCE, SEASONS } from './data.js';

let anomalySeq = 1;

// 性能优化（calendar.js）：异象总权重在模块加载时一次性计算，避免 rollAnomaly 每次调用
//   都对 CELESTIAL_ANOMALIES 做一次 reduce（每回合一次，长局累积）。
let _ANOMALY_TOTAL_W = 0;
for (const _a of CELESTIAL_ANOMALIES) _ANOMALY_TOTAL_W += _a.weight;

export class CalendarSystem {
  constructor() {
    this.termIdx = 0;            // 0..23
    this.lastAnomaly = null;     // 最近一次异象记录 { id, name, turn }
    this.anomalyHistory = [];    // 历史异象 id
    this.seasonFlavorGiven = {}; // 已播过的季节/节气提示，避免刷屏
  }

  // ---------- 基本读取 ----------
  get term() { return SOLAR_TERMS[this.termIdx] || SOLAR_TERMS[0]; }
  get seasonIdx() { return Math.floor(this.termIdx / 6) % 4; }
  get season() { return SEASONS[this.seasonIdx]; }

  // 顶栏历法串：如「太建三年·春·春分」
  getLabel(game) {
    const era = (game.dynastySystem && game.dynastySystem.get(game.playerFaction));
    const eraStr = era ? `${era.eraName}${era.eraYear}年` : '';
    return `${eraStr}·${this.season}·${this.term.name}`;
  }

  // ---------- 推进节气 ----------
  advance() { this.termIdx = (this.termIdx + 1) % SOLAR_TERMS.length; }

  // ---------- 节气效果结算（玩家势力） ----------
  // eff 为 SOLAR_TERMS[].effect 袋；直接一次性施加并记日志。
  applyTermEffects(game) {
    if (!game.playerFaction || !game.factionRes.has(game.playerFaction)) return;
    const eff = this.term.effect || {};
    const cities = game.getFactionCities(game.playerFaction);
    const res = game.factionRes.get(game.playerFaction);
    const logs = [];

    const clampMorale = (v) => Math.max(0, Math.min(100, v));

    if (eff.moraleFlat) {
      for (const c of cities) c.morale = clampMorale(c.morale + eff.moraleFlat);
      logs.push(`民心${eff.moraleFlat >= 0 ? '+' : ''}${eff.moraleFlat}`);
    }
    if (eff.agriFlat) {
      for (const c of cities) c.agri = Math.max(0, c.agri + eff.agriFlat);
      logs.push(`农业${eff.agriFlat >= 0 ? '+' : ''}${eff.agriFlat}`);
    }
    if (eff.commFlat) {
      for (const c of cities) c.comm = Math.max(0, Math.min(100, c.comm + eff.commFlat));
      logs.push(`商业${eff.commFlat >= 0 ? '+' : ''}${eff.commFlat}`);
    }
    if (eff.cultureFlat) {
      for (const c of cities) {
        if (!c.religion) c.religion = { buddhist: 0, daoist: 0, culture: 0 };
        c.religion.culture = (c.religion.culture || 0) + Math.floor(eff.cultureFlat / Math.max(1, cities.length));
      }
      logs.push(`文化+${eff.cultureFlat}`);
    }
    if (eff.techFlat) logs.push(`科技领悟+${eff.techFlat}`);
    if (eff.milFlat) {
      res.totalMorale = clampMorale((res.totalMorale || 60) + eff.milFlat);
      logs.push(`军心${eff.milFlat >= 0 ? '+' : ''}${eff.milFlat}`);
    }
    if (eff.legitFlat && game.dynastySystem) {
      game.dynastySystem.calcLegitimacy(game, game.playerFaction);
      logs.push(`正统+${eff.legitFlat}`);
    }
    // 一次性钱粮/金钱加成（按比例）
    if (eff.foodMult) {
      const bonus = Math.round((res.food || 0) * eff.foodMult);
      res.food = Math.max(0, res.food + bonus);
      logs.push(`粮+${bonus}`);
    }
    if (eff.moneyMult) {
      const bonus = Math.round((res.money || 0) * eff.moneyMult);
      res.money = Math.max(0, res.money + bonus);
      logs.push(`金+${bonus}`);
    }
    if (eff.recruitBonus) {
      // 暂存到 game，招募时取用（AI 与玩家共用）
      game._calendarRecruitBonus = eff.recruitBonus;
      logs.push(`募兵+${Math.round(eff.recruitBonus * 100)}%`);
    }
    if (eff.eventChanceBonus) game._calendarEventBonus = eff.eventChanceBonus;

    if (logs.length) {
      game.pushLog(`🌦 【${this.term.name}】${this.term.desc}（${logs.join('，')}）`);
    } else {
      game.pushLog(`🌦 【${this.term.name}】${this.term.desc}`);
    }
  }

  // ---------- 天文异象 ----------
  // 在每回合节气结算后调用；按概率抽异象，施加效果并推送事件。
  rollAnomaly(game) {
    if (!game.playerFaction || !game.factionRes.has(game.playerFaction)) return null;
    if (Math.random() >= ANOMALY_BASE_CHANCE) return null;

    // 加权随机（性能优化：总权重用模块级缓存，避免每回合 reduce）
    const totalW = _ANOMALY_TOTAL_W || CELESTIAL_ANOMALIES.reduce((s, a) => s + a.weight, 0);
    let r = Math.random() * totalW, picked = CELESTIAL_ANOMALIES[0];
    for (const a of CELESTIAL_ANOMALIES) { r -= a.weight; if (r <= 0) { picked = a; break; } }

    this.lastAnomaly = { id: picked.id, name: picked.name, turn: game.turn, icon: picked.icon };
    this.anomalyHistory.push(picked.id);

    const cities = game.getFactionCities(game.playerFaction);
    const eff = picked.effect || {};
    const clamp = (v) => Math.max(0, Math.min(100, v));

    if (eff.moraleFlat) for (const c of cities) c.morale = clamp(c.morale + eff.moraleFlat);
    if (eff.legitFlat && game.dynastySystem) game.dynastySystem.calcLegitimacy(game, game.playerFaction);
    if (eff.milFlat) {
      const res = game.factionRes.get(game.playerFaction);
      res.totalMorale = clamp((res.totalMorale || 60) + eff.milFlat);
    }
    // 君主个人属性波动（找当前君主）
    const emperorId = game.dynastySystem && game.dynastySystem.get(game.playerFaction)
      ? game.dynastySystem.get(game.playerFaction).emperorId : null;
    const emperor = emperorId ? game.generals.get(emperorId) : null;
    if (emperor) {
      if (eff.polFlat) emperor.politics = Math.max(1, emperor.politics + eff.polFlat);
      if (eff.intelFlat) emperor.intel = Math.max(1, emperor.intel + eff.intelFlat);
      if (eff.cmdFlat) emperor.command = Math.max(1, emperor.command + eff.cmdFlat);
    }

    game.pushLog(`${picked.icon} 【天象·${picked.name}】${picked.desc}`);
    game.pushLog(`   太史令奏：「${picked.name}见，朝野震恐，君其修德以应天变！」`);

    // 推送事件（events.js 中注册）
    if (game.eventSystem && picked.eventId) {
      // 惰性查找：事件表由 events 模块注册，找不到则仅日志
      try {
        game._pendingAnomalyEvent = picked.eventId;
      } catch (e) {}
    }
    return picked;
  }

  // ---------- 序列化 ----------
  serialize() {
    return {
      termIdx: this.termIdx,
      lastAnomaly: this.lastAnomaly,
      anomalyHistory: this.anomalyHistory.slice(-20)
    };
  }
  static deserialize(data) {
    const c = new CalendarSystem();
    if (data && typeof data === 'object') {
      c.termIdx = Number.isInteger(data.termIdx)
        ? ((data.termIdx % SOLAR_TERMS.length) + SOLAR_TERMS.length) % SOLAR_TERMS.length
        : 0;
      c.lastAnomaly = data.lastAnomaly || null;
      c.anomalyHistory = Array.isArray(data.anomalyHistory) ? data.anomalyHistory : [];
    }
    return c;
  }
}
