// ============================================================
// city.js — 城市数据模型与内政操作
// ============================================================
import { CITIES, CITY_LINKS, UNIT_TYPES, TERRAIN, SEASON_FOOD_MULT } from './data.js';
import { getBuildingBag } from './building.js';
import { calcCityCulturePerTurn, getReligionCityModifiers } from './religion.js';

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
    const bonus = (key) => (window.__game && typeof window.__game.getTechBonus === 'function')
      ? (window.__game.getTechBonus(this.owner, key) || 0) : 0;
    const bb = this.buildingBag();
    // 市集：每级商业 +8
    const commEff = (this.comm + (bb.commFlat || 0)) * (1 + bonus('commMult'));
    let income = (this.pop * (commEff / 100) * (this.taxRate / 100) * moraleFactor) / 10;
    // 太守政治加成（三省制/代周建隋 提升政治效果）
    const polEffMult = 1 + bonus('politicsEffMult');
    if (this.mayor) {
      const gen = window.__game?.getGeneral(this.mayor);
      if (gen) income *= (1 + (gen.effPolitics / 200) * polEffMult);
    }
    // 税收类科技/技能加成（均在最终收入上乘算）
    income *= (1 + bonus('incomeMult'));
    // 市集建筑：每级金钱 +5%
    income *= (1 + (bb.incomeMult || 0));
    // V2.5：联姻经济加成（每桩 active 联姻 +10%，见 diplomacy.getMarriageIncomeMult）
    const marriageMult = (window.__game && typeof window.__game.getMarriageIncomeMult === 'function')
      ? window.__game.getMarriageIncomeMult(this.owner) : 0;
    income *= (1 + marriageMult);
    return Math.round(income);
  }

  // 计算粮草产出
  calcFood(season) {
    const seasonMult = SEASON_FOOD_MULT[season] || 1;
    const bonus = (key) => (window.__game && typeof window.__game.getTechBonus === 'function')
      ? (window.__game.getTechBonus(this.owner, key) || 0) : 0;
    const bb = this.buildingBag();
    // 农田：每级农业 +8
    const agriEff = this.agri + (bb.agriFlat || 0);
    let food = (this.pop * (agriEff / 100) * seasonMult) / 10;
    food *= (1 + bonus('foodMult')); // 均田制/水利兴修
    food *= (1 + (bb.foodMult || 0)); // 农田建筑每级 +5%
    if (this.mayor) {
      const gen = window.__game?.getGeneral(this.mayor);
      if (gen) food *= (1 + gen.effPolitics / 300);
    }
    return Math.round(food);
  }

  // 征兵
  recruit(unitType, count, factionRes) {
    const unit = UNIT_TYPES[unitType];
    if (!unit) return { ok: false, msg: '兵种不存在' };
    // 府兵制：征兵费用 -30%（recruitCostMult 为负）
    const costMult = (window.__game && typeof window.__game.getTechBonus === 'function')
      ? (1 + (window.__game.getTechBonus(this.owner, 'recruitCostMult') || 0)) : 1;
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
    // 人口自然增长（大索貌阅 +10%）
    const popMult = (window.__game && typeof window.__game.getTechBonus === 'function')
      ? (1 + (window.__game.getTechBonus(this.owner, 'popMult') || 0)) : 1;
    this.pop = Math.round(this.pop * (1 + (this.morale - 50) / 5000) * popMult);
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
      religion: this.religion  // V6.0
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
    return c;
  }
}

// 初始化所有城市
export function createInitialCities() {
  return CITIES.map(d => new City(d));
}
