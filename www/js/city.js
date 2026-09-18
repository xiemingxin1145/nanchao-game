// ============================================================
// city.js — 城市数据模型与内政操作
// ============================================================
import { CITIES, CITY_LINKS, UNIT_TYPES, TERRAIN, SEASON_FOOD_MULT, TAX_LEVELS, CORVEE_DURATION, CORVEE_MORALE_COST, CORVEE_POP_COST, CORVEE_TYPES } from './data.js';
import { getBuildingBag } from './building.js';
import { calcCityCulturePerTurn, getReligionCityModifiers } from './religion.js';

// V8.5：安全获取全局 game 引用（浏览器/ Electron 中由 game.js 写入 window.__game；
// Node 冒烟测试无 window 时返回 null，避免 ReferenceError）。
function _g() { return (typeof window !== 'undefined' && window.__game) || null; }

let cityIdCounter = 0;

export class City {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.isoX = data.isoX;
    this.isoY = data.isoY;
    this.terrain = data.terrain;
    this.size = data.size;          // 1~4 规模
    this.capital = data.capital;
    this.owner = null;              // factionId
    this.pop = data.pop;
    this.agri = data.agri;          // 农业 0-100
    this.comm = data.comm;          // 商业 0-100
    this.defense = data.defense;    // 防御 0-100
    this.prosperity = data.prosperity;
    this.taxRate = data.taxRate;    // 税率 0-100
    this.morale = 60;               // 民心
    this.garrison = 0;              // 驻城兵力
    this.mayor = null;              // 太守 generalId
    this.adjacent = CITY_LINKS[data.id] || [];
    // ---- V2.0：建筑树 ----
    this.buildings = data.buildings || {};   // { buildingId: level }
    this.buildingThisTurn = false;           // 每回合仅可建造/升级一个建筑
    // ---- V6.0：宗教文化系统 ----
    this.religion = data.religion || { buddhist: 0, daoist: 0, culture: 0 };
    // ---- V8.0：赋税等级（1~5，默认2=正常） ----
    this.taxLevel = data.taxLevel || 2;
    this.taxCooldown = 0;              // 赋税调整冷却回合
    // ---- V8.0：徭役状态 { type, turnsLeft } 或 null ----
    this.corvee = data.corvee || null;
    // ---- V14.0：城市四维发展 ----
    // agriculture(农业→agri) / commerce(商业→comm) /
    // waterConservancy(水利) / training(训练)，均 0~100
    this.waterConservancy = data.waterConservancy || 0; // 水利 0~100
    this.training = data.training || 0;                 // 训练 0~100
  }

  // 建筑聚合效果袋（农田/市集/城墙/码头…）
  buildingBag() {
    return getBuildingBag(this.buildings);
  }

  // 有效城防 = 基础防御 + 城墙每级 +10
  getEffectiveDefense() {
    return this.defense + (this.buildingBag().defenseFlat || 0);
  }

  // 计算金钱收入
  calcIncome(season) {
    // 金钱 = 人口 × 商业/100 × 税率/100 × 民心系数
    const moraleFactor = this.morale / 50; // 0~2，50为基准
    // 科技/技能加成（由 game.getTechBonus 汇总）
    const bonus = (key) => (_g() && typeof _g().getTechBonus === 'function')
      ? (_g().getTechBonus(this.owner, key) || 0) : 0;
    const bb = this.buildingBag();
    // 市集：每级商业 +8
    const commEff = (this.comm + (bb.commFlat || 0)) * (1 + bonus('commMult'));
    let income = (this.pop * (commEff / 100) * (this.taxRate / 100) * moraleFactor) / 10;
    // 太守政治加成（三省制/代周建隋 提升政治效果）
    const polEffMult = 1 + bonus('politicsEffMult');
    if (this.mayor) {
      const gen = _g()?.getGeneral(this.mayor);
      if (gen) income *= (1 + (gen.effPolitics / 200) * polEffMult);
    }
    // 税收类科技/技能加成（均在最终收入上乘算）
    income *= (1 + bonus('incomeMult'));
    // 市集建筑：每级金钱 +5%
    income *= (1 + (bb.incomeMult || 0));
    // V8.0：赋税等级乘数（轻徭薄赋0.7~苛捐杂税1.6）
    const taxLv = TAX_LEVELS[this.taxLevel - 1] || TAX_LEVELS[1];
    income *= (taxLv.multiplier || 1.0);
    // V2.5：联姻经济加成（每桩 active 联姻 +10%，见 diplomacy.getMarriageIncomeMult）
    const marriageMult = (_g() && typeof _g().getMarriageIncomeMult === 'function')
      ? _g().getMarriageIncomeMult(this.owner) : 0;
    income *= (1 + marriageMult);
    return Math.round(income);
  }

  // 计算粮草产出
  calcFood(season) {
    const seasonMult = SEASON_FOOD_MULT[season] || 1;
    const bonus = (key) => (_g() && typeof _g().getTechBonus === 'function')
      ? (_g().getTechBonus(this.owner, key) || 0) : 0;
    const bb = this.buildingBag();
    // 农田：每级农业 +8
    const agriEff = this.agri + (bb.agriFlat || 0);
    let food = (this.pop * (agriEff / 100) * seasonMult) / 10;
    food *= (1 + bonus('foodMult')); // 均田制/水利兴修
    food *= (1 + (bb.foodMult || 0)); // 农田建筑每级 +5%
    if (this.mayor) {
      const gen = _g()?.getGeneral(this.mayor);
      if (gen) food *= (1 + gen.effPolitics / 300);
    }
    return Math.round(food);
  }

  // 征兵
  recruit(unitType, count, factionRes) {
    const unit = UNIT_TYPES[unitType];
    if (!unit) return { ok: false, msg: '兵种不存在' };
    // 府兵制：征兵费用 -30%（recruitCostMult 为负）
    const costMult = (_g() && typeof _g().getTechBonus === 'function')
      ? (1 + (_g().getTechBonus(this.owner, 'recruitCostMult') || 0)) : 1;
    const cost = Math.round(unit.cost * count * Math.max(0.1, costMult));
    if (factionRes.money < cost) return { ok: false, msg: `金钱不足（需${cost}金）` };
    if (this.pop < count) return { ok: false, msg: `人口不足（需${count}人）` };
    factionRes.money -= cost;
    this.pop -= count;
    this.garrison += count;
    return { ok: true, msg: `征兵${count}人（${unit.name}），花费${cost}金` };
  }

  // 发展农业
  developAgri(cost) {
    if (this.comm + this.agri > 180) return { ok: false, msg: '城市发展已近极限' };
    this.agri = Math.min(100, this.agri + 5);
    this.prosperity = Math.min(100, this.prosperity + 2);
    return { ok: true, msg: `农业发展至${this.agri}` };
  }

  // 发展商业
  developComm(cost) {
    if (this.comm + this.agri > 180) return { ok: false, msg: '城市发展已近极限' };
    this.comm = Math.min(100, this.comm + 5);
    this.prosperity = Math.min(100, this.prosperity + 2);
    return { ok: true, msg: `商业发展至${this.comm}` };
  }

  // 修缮防御
  repairDefense(cost) {
    this.defense = Math.min(100, this.defense + 8);
    return { ok: true, msg: `防御修缮至${this.defense}` };
  }

  // ============================================================
  // V14.0：城市四维发展系统 API
  // agriculture 农业 → 粮食产出（复用 this.agri）
  // commerce    商业 → 金钱产出（复用 this.comm）
  // waterConservancy 水利 → 农业加成 + 灾害减免
  // training    训练 → 征兵质量 + 守军战力
  // ============================================================

  // 获取某维度发展值（0~100）
  getDevelopment(type) {
    switch (type) {
      case 'agriculture': return this.agri;
      case 'commerce': return this.comm;
      case 'waterConservancy': return this.waterConservancy;
      case 'training': return this.training;
      default: return 0;
    }
  }

  // 发展某维度（amount 为增加量，自动钳制 0~100）
  // 消耗金钱/徭役由 game 层扣减，这里只落账
  developCity(type, amount) {
    amount = Math.max(0, Math.round(amount || 5));
    switch (type) {
      case 'agriculture':
        if (this.agri + this.comm > 180) return { ok: false, msg: '城市发展已近极限' };
        this.agri = Math.min(100, this.agri + amount);
        break;
      case 'commerce':
        if (this.agri + this.comm > 180) return { ok: false, msg: '城市发展已近极限' };
        this.comm = Math.min(100, this.comm + amount);
        break;
      case 'waterConservancy':
        this.waterConservancy = Math.min(100, this.waterConservancy + amount);
        // 水利每提升直接小幅反哺农业
        this.agri = Math.min(100, this.agri + Math.round(amount / 2));
        break;
      case 'training':
        this.training = Math.min(100, this.training + amount);
        break;
      default:
        return { ok: false, msg: '未知发展维度' };
    }
    this.prosperity = Math.min(100, this.prosperity + 1);
    return { ok: true, msg: `${this.name} 发展至 ${this.getDevelopment(type)}` };
  }

  // 计算城市综合产出（金钱/粮食/守军战力加成）
  // season 可选；返回各维度产出与加成系数
  getCityOutput(season) {
    const income = this.calcIncome(season);
    const food = this.calcFood(season);
    // 水利对农业加成：每 20 点水利 +10% 粮食
    const waterFoodMult = 1 + Math.floor(this.waterConservancy / 20) * 0.10;
    // 训练对守军战力加成：每 20 点训练 +10% 守军
    const trainingGarrisonMult = 1 + Math.floor(this.training / 20) * 0.10;
    // 水利灾害减免：每 20 点 -5% 灾害损失（上限 -25%）
    const disasterReduce = Math.min(0.25, Math.floor(this.waterConservancy / 20) * 0.05);
    return {
      income,
      food: Math.round(food * waterFoodMult),
      dimensions: {
        agriculture: this.agri,
        commerce: this.comm,
        waterConservancy: this.waterConservancy,
        training: this.training
      },
      modifiers: {
        waterFoodMult,
        trainingGarrisonMult,
        disasterReduce
      }
    };
  }

  // 调整税率
  setTaxRate(rate) {
    rate = Math.max(0, Math.min(60, rate));
    const old = this.taxRate;
    this.taxRate = rate;
    // 民心变化
    if (rate > old + 5) this.morale = Math.max(0, this.morale - 10);
    else if (rate < old - 5) this.morale = Math.min(100, this.morale + 5);
    return { ok: true, msg: `税率调整为${rate}%` };
  }

  // V8.0：调整赋税等级（1~5），有冷却
  setTaxLevel(level) {
    level = Math.max(1, Math.min(5, level));
    if (this.taxCooldown > 0) return { ok: false, msg: `赋税调整冷却中（剩${this.taxCooldown}回合）` };
    const oldLv = TAX_LEVELS[this.taxLevel - 1];
    const newLv = TAX_LEVELS[level - 1];
    this.taxLevel = level;
    this.taxCooldown = 3; // TAX_ADJUST_COOLDOWN
    // 调整时民心即时反应
    const diff = level - (oldLv.level);
    if (diff > 0) this.morale = Math.max(0, this.morale - diff * 5);
    else this.morale = Math.min(100, this.morale - diff * 5);
    return { ok: true, msg: `赋税调整为「${newLv.name}」（${newLv.desc}）` };
  }

  // V8.0：征发徭役
  startCorvee(type) {
    const cv = CORVEE_TYPES[type];
    if (!cv) return { ok: false, msg: '徭役类型不存在' };
    if (this.corvee) return { ok: false, msg: '该城正在征发徭役中' };
    // 将作监≥3级解锁（由 game 层校验，这里兜底）
    this.corvee = { type, turnsLeft: CORVEE_DURATION };
    // 征发时人口-1%
    this.pop = Math.max(1000, Math.round(this.pop * (1 - CORVEE_POP_COST)));
    return { ok: true, msg: `${this.name} 征发${cv.name}，持续${CORVEE_DURATION}回合` };
  }

  // V8.0：取消徭役
  cancelCorvee() {
    if (!this.corvee) return { ok: false, msg: '该城无徭役' };
    this.corvee = null;
    return { ok: true, msg: `${this.name} 徭役已取消` };
  }

  // 回合结束结算
  endTurn(season) {
    const income = this.calcIncome(season);
    const food = this.calcFood(season);
    // 民心自然波动
    this.morale = Math.max(0, Math.min(100, this.morale + (Math.random() * 4 - 2)));
    // 庙宇：每级民心 +2/回合
    const bb = this.buildingBag();
    if (bb.moralePerTurn) this.morale = Math.min(100, this.morale + bb.moralePerTurn);
    // ---- V6.0：宗教文化系统 ----
    // 每回合文化值积累（佛寺×5 + 道观×3 + 石窟×10 + 基础2）
    if (!this.religion) this.religion = { buddhist: 0, daoist: 0, culture: 0 };
    const cultureGain = calcCityCulturePerTurn(this);
    this.religion.culture = (this.religion.culture || 0) + cultureGain;
    // 宗教影响：佛教→民心加成，道教→科技加成（由 game 层汇总）
    const relMods = getReligionCityModifiers(this);
    if (relMods.moraleMod) this.morale = Math.min(100, this.morale + Math.round(relMods.moraleMod / 5));

    // ---- V8.0：赋税等级效果 ----
    const taxLv = TAX_LEVELS[this.taxLevel - 1] || TAX_LEVELS[1];
    if (taxLv.moraleDelta) this.morale = Math.max(0, Math.min(100, this.morale + taxLv.moraleDelta));
    if (this.taxCooldown > 0) this.taxCooldown--;

    // ---- V8.0：徭役效果结算 ----
    if (this.corvee) {
      const cv = CORVEE_TYPES[this.corvee.type];
      if (cv) {
        // 徭役每回合民心-3
        this.morale = Math.max(0, this.morale - CORVEE_MORALE_COST);
        // 城防徭役：每回合防御+10
        if (cv.effect.defensePerTurn) this.defense = Math.min(100, this.defense + cv.effect.defensePerTurn);
        // 水利徭役：每回合农业+5
        if (cv.effect.agriPerTurn) this.agri = Math.min(100, this.agri + cv.effect.agriPerTurn);
      }
      this.corvee.turnsLeft--;
      if (this.corvee.turnsLeft <= 0) this.corvee = null;
    }

    // 人口自然增长（大索貌阅 +10%）
    const popMult = (_g() && typeof _g().getTechBonus === 'function')
      ? (1 + (_g().getTechBonus(this.owner, 'popMult') || 0)) : 1;
    // V8.0：赋税等级影响人口增长
    const taxPopMod = 1 + (taxLv.popMult || 0);
    this.pop = Math.round(this.pop * (1 + (this.morale - 50) / 5000) * popMult * taxPopMod);
    return { income, food, culture: cultureGain };
  }

  serialize() {
    return {
      id: this.id, name: this.name, isoX: this.isoX, isoY: this.isoY,
      terrain: this.terrain, size: this.size, capital: this.capital,
      owner: this.owner, pop: this.pop, agri: this.agri, comm: this.comm,
      defense: this.defense, prosperity: this.prosperity, taxRate: this.taxRate,
      morale: this.morale, garrison: this.garrison, mayor: this.mayor,
      buildings: this.buildings, buildingThisTurn: this.buildingThisTurn,
      religion: this.religion,  // V6.0
      taxLevel: this.taxLevel, taxCooldown: this.taxCooldown,  // V8.0
      corvee: this.corvee,  // V8.0
      waterConservancy: this.waterConservancy, training: this.training  // V14.0
    };
  }

  static deserialize(data) {
    const c = new City({
      id: data.id, name: data.name, isoX: data.isoX, isoY: data.isoY,
      terrain: data.terrain, size: data.size, capital: data.capital,
      pop: data.pop, agri: data.agri, comm: data.comm,
      defense: data.defense, prosperity: data.prosperity, taxRate: data.taxRate
    });
    c.owner = data.owner;
    c.morale = data.morale;
    c.garrison = data.garrison;
    c.mayor = data.mayor;
    // 旧存档补默认值
    c.buildings = data.buildings || {};
    c.buildingThisTurn = !!data.buildingThisTurn;
    // V6.0：旧存档补 religion 字段
    c.religion = data.religion || { buddhist: 0, daoist: 0, culture: 0 };
    // V8.0：旧存档补赋税/徭役字段
    c.taxLevel = (typeof data.taxLevel === 'number') ? data.taxLevel : 2;
    c.taxCooldown = data.taxCooldown || 0;
    c.corvee = data.corvee || null;
    // V14.0：旧存档补四维发展字段
    c.waterConservancy = data.waterConservancy || 0;
    c.training = data.training || 0;
    return c;
  }
}

// 初始化所有城市
export function createInitialCities() {
  return CITIES.map(d => new City(d));
}
