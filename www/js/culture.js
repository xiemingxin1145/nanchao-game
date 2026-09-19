// ============================================================
// culture.js — V19.0 文化系统深化
// ------------------------------------------------------------
// 每个势力拥有文化值（0~1000），通过建筑 / 事件 / 文臣 / 和平时期积累。
// 文化值越高，解锁忠诚度、招募、外交、贸易乃至特殊文化结局加成。
// 与高文化势力接壤时，文化传播使本势力文化增长更快。
//
// 文化建筑（每回合产出文化值）：
//   学府 xuefu(+50) / 寺庙 simiao(+30) /
//   书院 shuyuan(+40) / 藏书阁 cangshuge(+20)
//
// 文化阈值效果：
//   >500：武将忠诚度+10%，人才招募+20%
//   >700：外交关系+5，贸易收入+15%
//   >900：解锁特殊文化结局
//
// API：
//   getCulture(factionId)
//   addCulture(factionId, amount)
//   getCultureBonus(factionId)
//   buildCultureBuilding(city, type)
// ============================================================

// 文化建筑定义
export const CULTURE_BUILDINGS = {
  xuefu:      { id: 'xuefu',      name: '学府',   culturePerTurn: 50, description: '学府育才，每回合文化+50' },
  simiao:     { id: 'simiao',     name: '寺庙',   culturePerTurn: 30, description: '寺庙礼佛，每回合文化+30' },
  shuyuan:    { id: 'shuyuan',    name: '书院',   culturePerTurn: 40, description: '书院讲学，每回合文化+40' },
  cangshuge:  { id: 'cangshuge',  name: '藏书阁', culturePerTurn: 20, description: '藏书阁聚书，每回合文化+20' }
};

// 文化阈值
export const CULTURE_THRESHOLDS = {
  loyaltyRecruit: 500,   // >500：忠诚+10%、招募+20%
  diplomacyTrade: 700,   // >700：外交+5、贸易+15%
  endingUnlock:   900    // >900：解锁文化结局
};

export class CultureSystem {
  constructor() {
    this.culture = {};          // { factionId: value(0~1000) }
    this.buildings = {};       // { cityId: { type: count } } 各城文化建筑
    this.peaceTurns = {};      // { factionId: 连续和平回合数 }
  }

  // 查询某势力文化值
  getCulture(factionId) {
    return this.culture[factionId] || 0;
  }

  // 增减文化值（来源：事件/建筑/文臣/传播），钳制在 0~1000
  addCulture(factionId, amount) {
    const cur = this.culture[factionId] || 0;
    this.culture[factionId] = Math.max(0, Math.min(1000, cur + amount));
    return this.culture[factionId];
  }

  // 在某城建造文化建筑
  // city: 城市对象（含 id）或 cityId 字符串
  buildCultureBuilding(city, type) {
    const def = CULTURE_BUILDINGS[type];
    if (!def) return { ok: false, msg: '未知文化建筑' };
    const cityId = (city && city.id) ? city.id : city;
    if (!this.buildings[cityId]) this.buildings[cityId] = {};
    this.buildings[cityId][type] = (this.buildings[cityId][type] || 0) + 1;
    return { ok: true, msg: `在 ${cityId} 建造${def.name}`, perTurn: def.culturePerTurn };
  }

  // 某势力全部文化建筑每回合产出
  _buildingCulturePerTurn(factionCities) {
    let total = 0;
    for (const city of (factionCities || [])) {
      const cityId = city && city.id;
      const b = cityId ? this.buildings[cityId] : null;
      if (!b) continue;
      for (const [type, count] of Object.entries(b)) {
        const def = CULTURE_BUILDINGS[type];
        if (def) total += def.culturePerTurn * count;
      }
    }
    return total;
  }

  // 文臣加成：政治属性高的武将每回合提供文化
  _scholarBonus(factionGenerals) {
    let bonus = 0;
    for (const g of (factionGenerals || [])) {
      const pol = g.politics || 0;
      if (pol >= 80) bonus += 5;
      else if (pol >= 60) bonus += 2;
    }
    return bonus;
  }

  // 文化传播：与高文化势力接壤时，差距越大增长越快
  // neighborsCulture: 接壤势力的文化值数组
  _cultureSpread(factionId, neighborsCulture) {
    const self = this.getCulture(factionId);
    let spread = 0;
    for (const c of (neighborsCulture || [])) {
      if (c > self) spread += Math.floor((c - self) / 50);
    }
    return spread;
  }

  // 每回合文化积累（建筑 + 文臣 + 和平 + 传播）
  // atPeace: 本回合是否处于和平（无战事）
  endTurn(factionId, factionCities, factionGenerals, neighborsCulture, atPeace) {
    let gain = this._buildingCulturePerTurn(factionCities);
    gain += this._scholarBonus(factionGenerals);
    // 和平时期积累
    if (atPeace) {
      this.peaceTurns[factionId] = (this.peaceTurns[factionId] || 0) + 1;
      gain += 5;
    } else {
      this.peaceTurns[factionId] = 0;
    }
    // 文化传播
    gain += this._cultureSpread(factionId, neighborsCulture);
    if (gain !== 0) this.addCulture(factionId, gain);
    return gain;
  }

  // 文化效果加成（按阈值阶梯）
  getCultureBonus(factionId) {
    const c = this.getCulture(factionId);
    const bonus = {};
    if (c > CULTURE_THRESHOLDS.loyaltyRecruit) {
      bonus.loyaltyMult = 0.10;     // 武将忠诚度+10%
      bonus.recruitBonus = 0.20;    // 人才招募+20%
    }
    if (c > CULTURE_THRESHOLDS.diplomacyTrade) {
      bonus.diplomacyFlat = 5;      // 外交关系+5
      bonus.tradeMult = 0.15;       // 贸易收入+15%
    }
    if (c > CULTURE_THRESHOLDS.endingUnlock) {
      bonus.cultureEndingUnlock = true;  // 解锁特殊文化结局
    }
    return bonus;
  }

  // 是否解锁文化结局（>900）
  hasCultureEnding(factionId) {
    return this.getCulture(factionId) > CULTURE_THRESHOLDS.endingUnlock;
  }

  // 当前所处文化等级（供 UI 展示）
  getCultureTier(factionId) {
    const c = this.getCulture(factionId);
    if (c > 900) return { id: 'golden', name: '文化盛世' };
    if (c > 700) return { id: 'flourish', name: '文治昌明' };
    if (c > 500) return { id: 'rise', name: '文教渐兴' };
    if (c > 200) return { id: 'seed', name: '教化初启' };
    return { id: 'barbarian', name: '未染华风' };
  }

  serialize() {
    return { culture: this.culture, buildings: this.buildings, peaceTurns: this.peaceTurns };
  }

  static deserialize(data) {
    const s = new CultureSystem();
    if (data) {
      s.culture = data.culture || {};
      s.buildings = data.buildings || {};
      s.peaceTurns = data.peaceTurns || {};
    }
    return s;
  }
}
