// ============================================================
// disaster.js — V20.0 灾害与人口系统（灾害子系统）
// ------------------------------------------------------------
// 六大自然灾害：地震 / 洪水 / 干旱 / 瘟疫 / 蝗灾 / 暴风雪
// 触发受 季节 / 地形 / 气候（人口密度 / 农业程度 / 南北）影响。
// 应对：建设减免（水利→洪水/干旱、粮仓→干旱、医药→瘟疫、城墙→地震）
//       + 主动救灾（消耗金钱/粮食，将本场灾害效果减半并提前平息）。
//
// 运行时由 game 层在 endTurn 调用：
//   const triggered = game.disasterSystem.rollDisaster(game);
// 查询：
//   game.disasterSystem.getActiveDisasters()          当前全部活跃灾害
//   game.disasterSystem.getDisasterForecast(game)     下回合风险预测
//   game.disasterSystem.disasterMitigation(city, game) 主动救灾
//
// 状态（V20 新数据，统一 v20_ 语义，全部挂在系统实例上，
//       不污染既有 City / game 字段）：
//   activeDisasters : [{id,type,cityId,cityName,turnsLeft,
//                       mitigated,severity,triggeredTurn}]
//   turnsWithoutRain: 连续无雨回合（干旱累积用）
//   stats           : {triggered, mitigated, populationLost,
//                      buildingsLost, byType:{}}
// ============================================================

// ---------- 灾害类型元数据 ----------
// baseProb：每回合单城基础概率；effect：原始损失（0~1 比例或固定点）
export const DISASTER_TYPES = {
  earthquake: {
    id: 'earthquake', name: '地震', icon: '🌋', baseProb: 0.02,
    description: '山崩地裂，屋宇倾颓。',
    effect: { pop: 0.20, money: 0.30, buildingDamage: true }
  },
  flood: {
    id: 'flood', name: '洪水', icon: '🌊', baseProb: 0.025,
    description: '江河横溢，田园漂没。',
    effect: { agri: 0.50, food: 0.40, pop: 0.10 }
  },
  drought: {
    id: 'drought', name: '干旱', icon: '🏜️', baseProb: 0.02,
    description: '赤地千里，禾稼枯槁。',
    effect: { food: 0.60, agriOut: 0.50 }
  },
  plague: {
    id: 'plague', name: '瘟疫', icon: '☠️', baseProb: 0.012,
    description: '疫疠流行，十室九空。',
    effect: { pop: 0.30, army: 0.15, morale: 20 }
  },
  locust: {
    id: 'locust', name: '蝗灾', icon: '🦗', baseProb: 0.018,
    description: '飞蝗蔽日，颗粒无收。',
    effect: { food: 0.70, agriOut: 0.40 }
  },
  blizzard: {
    id: 'blizzard', name: '暴风雪', icon: '🌨️', baseProb: 0.02,
    description: '风雪交加，冻毙士卒。',
    effect: { army: 0.20, morale: 15, supply: 0.30 }
  }
};

let _disasterIdCounter = 0;

export class DisasterSystem {
  constructor() {
    this.activeDisasters = [];   // 当前活跃灾害
    this.turnsWithoutRain = 0;    // 连续无雨（夏旱累积）
    this.stats = {
      triggered: 0,               // 累计触发场次
      mitigated: 0,               // 累计救灾成功场次
      populationLost: 0,          // 累计人口损失
      armyLost: 0,                // 累计军队损失
      foodLost: 0,                // 累计粮食损失
      byType: { earthquake: 0, flood: 0, drought: 0, plague: 0, locust: 0, blizzard: 0 }
    };
  }

  // ---------- 城市画像工具 ----------
  // 北方（河北/关中偏北，isoY 偏小）
  _isNorthern(city) {
    try { return (city.isoY ?? 99) <= 7; } catch (e) { return false; }
  }
  // 河流沿岸
  _isRiver(city) {
    try { return city.terrain === 'river'; } catch (e) { return false; }
  }
  // 农业城市（农桑为主）
  _isAgricultural(city) {
    try { return (city.agri || 0) >= 55; } catch (e) { return false; }
  }
  // 人口密集
  _isDense(city) {
    try { return (city.pop || 0) >= 60000; } catch (e) { return false; }
  }
  // 山地边境
  _isMountain(city) {
    try { return city.terrain === 'mountain' || city.terrain === 'desert'; } catch (e) { return false; }
  }
  // 是否拥有某类建筑（按 id 关键词宽松匹配，兼容不同建筑 id 命名）
  _hasBuilding(city, keywords) {
    try {
      const bs = city.buildings || {};
      for (const bid of Object.keys(bs)) {
        const lower = String(bid).toLowerCase();
        if (keywords.some(k => lower.includes(k))) return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  }
  // 当前季节
  _season(game) {
    try { return typeof game.getSeason === 'function' ? game.getSeason() : '春'; }
    catch (e) { return '春'; }
  }

  // ---------- 建设减免（0~0.5） ----------
  // 水利→洪水/干旱；粮仓→干旱；医药→瘟疫；城墙→地震
  _structuralMitigation(type, city) {
    let m = 0;
    const water = city.waterConservancy || 0;
    const defense = city.getEffectiveDefense ? city.getEffectiveDefense() : (city.defense || 0);
    switch (type) {
      case 'flood':
        // 水利每 20 点 -8%（上限 32%）
        m += Math.min(0.32, Math.floor(water / 20) * 0.08);
        break;
      case 'drought':
        // 水利 + 粮仓
        m += Math.min(0.24, Math.floor(water / 20) * 0.06);
        if (this._hasBuilding(city, ['granary', 'gran', 'store', 'warehouse'])) m += 0.25;
        break;
      case 'plague':
        // 医药建筑 -30%；民心高亦有帮助
        if (this._hasBuilding(city, ['medical', 'medic', 'pharm', 'clinic', 'hospital', 'physic'])) m += 0.30;
        if ((city.morale || 0) >= 75) m += 0.05;
        break;
      case 'earthquake':
        // 城墙/城防每点 -0.15%（上限 30%）
        m += Math.min(0.30, defense * 0.0015);
        break;
      case 'locust':
        // 粮仓/水利有一定缓冲
        if (this._hasBuilding(city, ['granary', 'gran'])) m += 0.20;
        m += Math.min(0.10, Math.floor(water / 40) * 0.05);
        break;
      case 'blizzard':
        // 城防/补给充足略减
        m += Math.min(0.15, Math.floor((defense || 0) / 50) * 0.05);
        break;
    }
    return Math.max(0, Math.min(0.5, m));
  }

  // ---------- 单城单灾害概率 ----------
  _probability(type, city, game) {
    const season = this._season(game);
    const meta = DISASTER_TYPES[type];
    let p = meta.baseProb;
    switch (type) {
      case 'earthquake':
        if (this._isMountain(city)) p *= 1.6;
        if (this._isNorthern(city)) p *= 1.3;
        break;
      case 'flood':
        if (season === '夏') p *= 2.2;
        else if (season === '春') p *= 1.2;
        if (this._isRiver(city)) p *= 3.0;
        break;
      case 'drought': {
        if (season === '夏') p *= 1.8;
        // 连续无雨累积：每过 1 回合 +20%，封顶 ×2
        p *= Math.min(2.0, 1 + this.turnsWithoutRain * 0.2);
        if (this._isAgricultural(city)) p *= 1.5;
        break;
      }
      case 'plague':
        if (season === '冬') p *= 1.8;
        if (this._isDense(city)) p *= 1.8;
        break;
      case 'locust':
        if (season === '春' || season === '夏') p *= 1.3;
        if (this._isAgricultural(city)) p *= 1.8;
        break;
      case 'blizzard':
        if (season === '冬') p *= 3.0;
        if (this._isNorthern(city)) p *= 2.0;
        break;
    }
    // 同一城已有活跃同型灾害则不再叠加
    if (this.activeDisasters.some(d => d.cityId === city.id && d.type === type)) p = 0;
    return Math.min(0.6, p);
  }

  // ---------- 每回合掷灾害 ----------
  // 遍历己方城市，按概率触发；命中即落账。返回本场触发的灾害数组。
  rollDisaster(game) {
    const triggered = [];
    let cities = [];
    try { cities = game.getFactionCities(game.playerFaction) || []; }
    catch (e) { return triggered; }

    const season = this._season(game);
    // 气候维护：夏季累加无雨回合，冬/雨季后重置
    if (season === '夏') this.turnsWithoutRain++;
    else if (season === '秋') this.turnsWithoutRain = Math.max(0, this.turnsWithoutRain - 1);
    else this.turnsWithoutRain = 0;

    for (const city of cities) {
      for (const type of Object.keys(DISASTER_TYPES)) {
        const p = this._probability(type, city, game);
        if (p <= 0) continue;
        if (Math.random() < p) {
          const disaster = {
            id: `v20_d_${++_disasterIdCounter}`,
            type,
            cityId: city.id,
            cityName: city.name || city.id,
            turnsLeft: type === 'plague' || type === 'flood' ? 2 : 1,
            mitigated: false,
            severity: Math.random() < 0.15 ? 'severe' : 'normal',
            triggeredTurn: game.turn
          };
          this.activeDisasters.push(disaster);
          this.stats.triggered++;
          this.stats.byType[type] = (this.stats.byType[type] || 0) + 1;
          try {
            game.pushLog(`⚠️ 【${city.name}】遭遇${DISASTER_TYPES[type].name}！${DISASTER_TYPES[type].description}`);
          } catch (e) { /* ignore */ }
          this.applyDisasterEffect(disaster, city, game);
          triggered.push(disaster);
        }
      }
    }
    return triggered;
  }

  // ---------- 应用灾害效果 ----------
  // 落账到 city / 玩家资源 / 军队。救灾(mitigated)后效果减半。
  applyDisasterEffect(disaster, city, game) {
    const meta = DISASTER_TYPES[disaster.type];
    const eff = meta.effect;
    // 建设减免 + 救灾减半
    const structural = this._structuralMitigation(disaster.type, city);
    let factor = (1 - structural);
    if (disaster.mitigated) factor *= 0.5;
    if (disaster.severity === 'severe') factor *= 1.25;
    factor = Math.max(0.05, Math.min(1.2, factor));

    const res = this._safeRes(game);
    const loss = {};

    // 人口损失
    if (eff.pop) {
      const popLost = Math.round((city.pop || 0) * eff.pop * factor);
      city.pop = Math.max(1000, (city.pop || 0) - popLost);
      loss.pop = popLost;
      this.stats.populationLost += popLost;
    }
    // 农田/农业产出下降
    if (eff.agri) {
      const agriDown = Math.round((city.agri || 0) * eff.agri * factor);
      city.agri = Math.max(0, (city.agri || 0) - agriDown);
      loss.agri = agriDown;
    }
    if (eff.agriOut) {
      // 农业产出受损：以 waterConservancy / agri 折损体现
      const outDown = Math.round((city.agri || 0) * eff.agriOut * factor);
      city.agri = Math.max(0, (city.agri || 0) - Math.round(outDown / 2));
      loss.agriOut = outDown;
    }
    // 金钱损失（地震）
    if (eff.money && res) {
      const mLost = Math.round(res.money * eff.money * factor);
      res.money = Math.max(0, res.money - mLost);
      loss.money = mLost;
    }
    // 粮食损失（洪水/干旱/蝗灾）
    if (eff.food && res) {
      const fLost = Math.round(res.food * eff.food * factor);
      res.food = Math.max(0, res.food - fLost);
      loss.food = fLost;
      this.stats.foodLost += fLost;
    }
    // 军队损失（瘟疫/暴风雪）
    if (eff.army) {
      const aLost = this._damageArmy(game, eff.army * factor, city);
      loss.army = aLost;
      this.stats.armyLost += aLost;
    }
    // 士气损失
    if (eff.morale) {
      const mDown = Math.round(eff.morale * factor);
      city.morale = Math.max(0, (city.morale || 0) - mDown);
      loss.morale = mDown;
    }
    // 建筑损坏（地震）
    if (eff.buildingDamage) {
      const bb = city.buildings || {};
      const keys = Object.keys(bb);
      if (keys.length) {
        const damaged = keys[Math.floor(Math.random() * keys.length)];
        bb[damaged] = Math.max(0, (bb[damaged] || 1) - 1);
        if (bb[damaged] <= 0) delete bb[damaged];
        city.prosperity = Math.max(0, (city.prosperity || 0) - Math.round(20 * factor));
        loss.building = damaged;
      }
    }
    // 补给损失（暴风雪，折算为粮草损耗 + 城防损耗）
    if (eff.supply && res) {
      const sLost = Math.round(res.food * eff.supply * factor);
      res.food = Math.max(0, res.food - sLost);
      loss.supply = sLost;
      // 补给不足亦折守军
      const garLost = Math.round((city.garrison || 0) * eff.supply * 0.5 * factor);
      city.garrison = Math.max(0, (city.garrison || 0) - garLost);
      loss.garrison = garLost;
    }

    try {
      const detail = Object.entries(loss)
        .filter(([, v]) => v && typeof v === 'number' && v > 0)
        .map(([k, v]) => `${this._lossLabel(k)}${v}`).join('，');
      game.pushLog(`  └ ${DISASTER_TYPES[disaster.type].name}损失：${detail || '轻微'}${structural > 0 ? '（建设已减免' + Math.round(structural * 100) + '%）' : ''}`);
    } catch (e) { /* ignore */ }
    return { loss, factor, structural };
  }

  _lossLabel(k) {
    return ({ pop: '人口-', agri: '农田-', agriOut: '农产-', money: '金钱-',
      food: '粮草-', army: '军队-', morale: '民心-', supply: '补给-', garrison: '守军-' })[k] || '';
  }

  // 对玩家军队/守军造成比例损失；返回总损失人数
  _damageArmy(game, ratio, city) {
    let total = 0;
    try {
      const armies = game.getFactionArmies(game.playerFaction) || [];
      for (const a of armies) {
        const lost = Math.round((a.troops || 0) * ratio);
        a.troops = Math.max(0, (a.troops || 0) - lost);
        total += lost;
      }
    } catch (e) { /* ignore */ }
    // 城防守军也受波及（瘟疫/严寒）
    try {
      const gLost = Math.round((city.garrison || 0) * ratio * 0.5);
      city.garrison = Math.max(0, (city.garrison || 0) - gLost);
      total += gLost;
    } catch (e) { /* ignore */ }
    return total;
  }

  _safeRes(game) {
    try { return game.getPlayerRes ? game.getPlayerRes() : null; } catch (e) { return null; }
  }

  // ---------- 活跃灾害查询 ----------
  // 可传 cityId 过滤；不传返回全部
  getActiveDisasters(cityId) {
    if (cityId) return this.activeDisasters.filter(d => d.cityId === cityId);
    return this.activeDisasters.slice();
  }

  // ---------- 灾害预测（供 UI 预警） ----------
  // 返回每城下回合各类型风险 {cityId, cityName, risks:[{type,name,prob,level}]}
  getDisasterForecast(game) {
    const out = [];
    let cities = [];
    try { cities = game.getFactionCities(game.playerFaction) || []; }
    catch (e) { return out; }
    for (const city of cities) {
      const risks = [];
      for (const type of Object.keys(DISASTER_TYPES)) {
        const p = this._probability(type, city, game);
        if (p >= 0.05) {
          risks.push({
            type, name: DISASTER_TYPES[type].name, icon: DISASTER_TYPES[type].icon,
            prob: +p.toFixed(3),
            level: p >= 0.25 ? 'high' : p >= 0.12 ? 'mid' : 'low'
          });
        }
      }
      if (risks.length) out.push({ cityId: city.id, cityName: city.name, risks });
    }
    out.sort((a, b) => {
      const sa = a.risks.reduce((s, r) => s + r.prob, 0);
      const sb = b.risks.reduce((s, r) => s + r.prob, 0);
      return sb - sa;
    });
    return out;
  }

  // ---------- 主动救灾 ----------
  // 消耗金钱+粮草，将该城活跃灾害标记 mitigated（效果减半）并提前平息。
  // 返回 {ok, cost, msg}
  disasterMitigation(city, game) {
    const active = this.activeDisasters.filter(d => d.cityId === city.id && !d.mitigated);
    if (!active.length) return { ok: false, msg: `${city.name} 暂无需要救灾的活跃灾害` };
    const res = this._safeRes(game);
    if (!res) return { ok: false, msg: '无法读取国库' };

    // 救灾成本：每活跃灾害 800 金 + 600 粮
    const moneyCost = active.length * 800;
    const foodCost = active.length * 600;
    if (res.money < moneyCost) return { ok: false, msg: `救灾资金不足（需 ${moneyCost} 金）` };
    if (res.food < foodCost) return { ok: false, msg: `赈灾粮草不足（需 ${foodCost} 粮）` };

    res.money -= moneyCost;
    res.food -= foodCost;
    for (const d of active) {
      d.mitigated = true;
      d.turnsLeft = Math.min(d.turnsLeft, 1); // 提前平息
    }
    this.stats.mitigated += active.length;
    try {
      game.pushLog(`🤝 朝廷拨款赈灾：${city.name} 花费 ${moneyCost} 金、${foodCost} 粮，${active.length} 场灾害影响减半`);
    } catch (e) { /* ignore */ }
    return { ok: true, cost: { money: moneyCost, food: foodCost }, msg: `${city.name} 救灾完成` };
  }

  // ---------- 回合推进：衰减活跃灾害 ----------
  endTurn() {
    const finished = [];
    for (const d of this.activeDisasters) {
      d.turnsLeft--;
      if (d.turnsLeft <= 0) finished.push(d);
    }
    this.activeDisasters = this.activeDisasters.filter(d => d.turnsLeft > 0);
    return finished;
  }

  // ---------- 序列化 ----------
  serialize() {
    return {
      activeDisasters: this.activeDisasters,
      turnsWithoutRain: this.turnsWithoutRain,
      stats: this.stats
    };
  }
  static deserialize(data) {
    const s = new DisasterSystem();
    if (!data) return s;
    s.activeDisasters = data.activeDisasters || [];
    s.turnsWithoutRain = data.turnsWithoutRain || 0;
    s.stats = Object.assign(s.stats, data.stats || {}, {
      byType: Object.assign({ earthquake: 0, flood: 0, drought: 0, plague: 0, locust: 0, blizzard: 0 },
        (data.stats && data.stats.byType) || {})
    });
    return s;
  }
}
