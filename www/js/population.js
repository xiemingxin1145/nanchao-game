// ============================================================
// population.js — V20.0 灾害与人口系统（人口动态子系统）
// ------------------------------------------------------------
// 人口自然增长（受 粮食 / 安定 / 医疗 影响）、人口迁移、
// 人口结构（青壮年/老幼）与征兵比例反噬。
//
// 运行时由 game 层在 endTurn 对每座己方城市调用：
//   game.populationSystem.updatePopulation(city, game);
//
// 人口结构（青壮年比例）独立维护在本系统实例 ageStructure，
// 不污染既有 City 字段（city.js 不在本任务改动范围）。
//
// 状态（V20 新数据）：
//   ageStructure : { [cityId]: { working:0~1 } }   青壮年(15~60)占比
//   stats        : { naturalGrowth, migrationIn, migrationOut,
//                    conscriptionRiots, totalPopPeak }
// ============================================================

export class PopulationSystem {
  constructor() {
    // 青壮年占比（默认 60%）。老幼=1-working，不参战但耗粮。
    this.ageStructure = {};
    this.stats = {
      naturalGrowth: 0,        // 累计自然增长人口
      migrationIn: 0,          // 累计流入
      migrationOut: 0,         // 累计流出
      conscriptionRiots: 0,    // 累计因过度征兵引发的民怨/叛乱次数
      totalPopPeak: 0          // 势力总人口峰值
    };
  }

  // ---------- 结构工具 ----------
  _workingRatio(city) {
    if (!this.ageStructure[city.id]) {
      this.ageStructure[city.id] = { working: 0.6 };
    }
    return this.ageStructure[city.id].working;
  }

  // ---------- 读取人口 ----------
  getPopulation(city) {
    return (city && city.pop) || 0;
  }

  // ---------- 征兵比例 ----------
  // 征兵 = 城防守军 / 在城人口（亦可理解为动员强度）
  getConscriptionRatio(city) {
    const pop = (city && city.pop) || 0;
    if (pop <= 0) return 0;
    return Math.min(1, (city.garrison || 0) / pop);
  }

  // ---------- 粮食状况（充足/紧张/不足） ----------
  _foodStatus(game) {
    try {
      const res = game.getPlayerRes ? game.getPlayerRes() : null;
      if (!res || typeof res.food !== 'number') return 'normal';
      let totalPop = 0;
      const cities = game.getFactionCities(game.playerFaction) || [];
      for (const c of cities) totalPop += (c.pop || 0);
      if (totalPop <= 0) return 'normal';
      const per = res.food / totalPop;   // 人均粮食
      if (per >= 2) return 'abundant';   // 充足
      if (per >= 0.5) return 'tight';    // 紧张
      return 'short';                    // 不足
    } catch (e) { return 'normal'; }
  }

  // ---------- 本城是否正遭瘟疫 ----------
  _hasPlague(city, game) {
    try {
      if (game.disasterSystem && typeof game.disasterSystem.getActiveDisasters === 'function') {
        const list = game.disasterSystem.getActiveDisasters(city.id) || [];
        return list.some(d => d.type === 'plague');
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  // ---------- 计算本回合人口增长率 ----------
  // 返回 { rate, reason, status }
  getPopulationGrowth(city, game) {
    // 瘟疫：-5%/回合（最高优先级）
    if (this._hasPlague(city, game)) {
      return { rate: -0.05, reason: '瘟疫横行', status: 'plague' };
    }
    const status = this._foodStatus(game);
    let rate = 0;
    if (status === 'abundant') rate = 0.02;       // 粮食充足 +2%
    else if (status === 'tight') rate = 0.005;    // 粮食紧张 +0.5%
    else rate = -0.01;                            // 粮食不足 -1%

    // 安定（民心）修正：民心高则+，低则-
    const morale = city.morale || 50;
    rate += (morale - 50) / 5000;                 // ±1% 范围
    // 医疗（医药建筑）加成
    try {
      const bs = city.buildings || {};
      const hasMed = Object.keys(bs).some(b =>
        /medical|medic|pharm|clinic|hospital|physic/i.test(b));
      if (hasMed) rate += 0.005;
    } catch (e) { /* ignore */ }
    // 战乱（民心极低）额外折损
    if (morale < 30) rate -= 0.01;

    return { rate: +rate.toFixed(4), reason: this._statusLabel(status), status };
  }

  _statusLabel(s) {
    return ({ abundant: '粮草丰足', tight: '粮草紧张', short: '粮草不足',
      normal: '粮情平稳', plague: '瘟疫横行' })[s] || '粮情平稳';
  }

  // ---------- 征兵反噬 ----------
  // ratio>30%：民怨上升（民心下降）
  // ratio>50%：人口 -5%/回合 + 叛乱概率
  _conscriptionEffect(city, game) {
    const ratio = this.getConscriptionRatio(city);
    let riot = false;
    if (ratio > 0.5) {
      // 人口 -5%
      const lost = Math.round((city.pop || 0) * 0.05);
      city.pop = Math.max(1000, (city.pop || 0) - lost);
      // 民怨：民心 -8
      city.morale = Math.max(0, (city.morale || 0) - 8);
      // 叛乱概率 10%：民心暴跌至 20
      if (Math.random() < 0.10) {
        city.morale = Math.min(city.morale, 20);
        riot = true;
        this.stats.conscriptionRiots++;
        try { game.pushLog(`🪧 【${city.name}】征发过甚（${Math.round(ratio * 100)}%），民怨沸腾，几至叛乱！`); }
        catch (e) { /* ignore */ }
      }
    } else if (ratio > 0.3) {
      // 民怨 +20（折算为民心小幅下降，体现代际积累）
      city.morale = Math.max(0, (city.morale || 0) - 4);
    }
    return { ratio, riot };
  }

  // ---------- 单城人口结算（每回合） ----------
  // 自然增长 + 征兵反噬 + 自动迁移
  updatePopulation(city, game) {
    const before = city.pop || 0;
    // 1) 自然增长
    const { rate, reason } = this.getPopulationGrowth(city, game);
    const grown = Math.round(before * rate);
    city.pop = Math.max(1000, before + grown);
    if (grown > 0) this.stats.naturalGrowth += grown;

    // 2) 征兵反噬
    const cons = this._conscriptionEffect(city, game);

    // 3) 自动迁移（战乱→安全；边境流出；高文化吸引）
    const migrated = this._autoMigrate(city, game);

    // 更新总人口峰值
    try {
      let total = 0;
      const cities = game.getFactionCities(game.playerFaction) || [];
      for (const c of cities) total += (c.pop || 0);
      this.stats.totalPopPeak = Math.max(this.stats.totalPopPeak, total);
    } catch (e) { /* ignore */ }

    return { growth: grown, rate, reason, conscriptionRatio: +cons.ratio.toFixed(3), migrated };
  }

  // ---------- 自动迁移 ----------
  // 战乱城（民心<30）→ 流向己方最安定城；边境北方城轻微流出。
  _autoMigrate(city, game) {
    let out = 0;
    try {
      const morale = city.morale || 50;
      // 战乱城：1% 人口流向本势力民心最高的安全城
      if (morale < 30) {
        const cities = game.getFactionCities(game.playerFaction) || [];
        if (cities.length >= 2) {
          const target = cities
            .filter(c => c.id !== city.id)
            .sort((a, b) => (b.morale || 0) - (a.morale || 0))[0];
          if (target && (target.morale || 0) > 50) {
            out = Math.round((city.pop || 0) * 0.01);
            if (out > 0) {
              city.pop = Math.max(1000, city.pop - out);
              target.pop = (target.pop || 0) + out;
              this.stats.migrationOut += out;
              this.stats.migrationIn += out;
            }
          }
        }
      }
    } catch (e) { /* ignore */ }
    return out;
  }

  // ---------- 显式人口迁移 ----------
  // fromCity → toCity 搬迁 amount 人。返回实际迁移人数。
  migratePopulation(fromCity, toCity, amount) {
    amount = Math.max(0, Math.round(amount || 0));
    if (!fromCity || !toCity || amount <= 0 || fromCity.id === toCity.id) return 0;
    const movable = Math.max(0, (fromCity.pop || 0) - 1000); // 保底留存 1000
    const real = Math.min(amount, movable);
    if (real <= 0) return 0;
    fromCity.pop -= real;
    toCity.pop = (toCity.pop || 0) + real;
    this.stats.migrationOut += real;
    this.stats.migrationIn += real;
    return real;
  }

  // ---------- 查询：势力总人口 ----------
  getTotalPopulation(game) {
    try {
      const cities = game.getFactionCities(game.playerFaction) || [];
      return cities.reduce((s, c) => s + (c.pop || 0), 0);
    } catch (e) { return 0; }
  }

  // ---------- 查询：可征兵人口（青壮年） ----------
  getMilitaryPool(city) {
    return Math.round((city.pop || 0) * this._workingRatio(city));
  }

  // ---------- 序列化 ----------
  serialize() {
    return { ageStructure: this.ageStructure, stats: this.stats };
  }
  static deserialize(data) {
    const s = new PopulationSystem();
    if (!data) return s;
    s.ageStructure = data.ageStructure || {};
    s.stats = Object.assign(s.stats, data.stats || {});
    return s;
  }
}
