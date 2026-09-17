// ============================================================
// city.js — 城市数据模型与内政操作
// ============================================================
import { CITIES, CITY_LINKS, UNIT_TYPES, TERRAIN, SEASON_FOOD_MULT } from './data.js';

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
  }

  // 计算金钱收入
  calcIncome(season) {
    // 金钱 = 人口 × 商业/100 × 税率/100 × 民心系数
    const moraleFactor = this.morale / 50; // 0~2，50为基准
    let income = (this.pop * (this.comm / 100) * (this.taxRate / 100) * moraleFactor) / 10;
    // 太守政治加成
    if (this.mayor) {
      const gen = window.__game?.getGeneral(this.mayor);
      if (gen) income *= (1 + gen.politics / 200);
    }
    return Math.round(income);
  }

  // 计算粮草产出
  calcFood(season) {
    const seasonMult = SEASON_FOOD_MULT[season] || 1;
    let food = (this.pop * (this.agri / 100) * seasonMult) / 10;
    if (this.mayor) {
      const gen = window.__game?.getGeneral(this.mayor);
      if (gen) food *= (1 + gen.politics / 300);
    }
    return Math.round(food);
  }

  // 征兵
  recruit(unitType, count, factionRes) {
    const unit = UNIT_TYPES[unitType];
    if (!unit) return { ok: false, msg: '兵种不存在' };
    const cost = unit.cost * count;
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
    // 人口自然增长
    this.pop = Math.round(this.pop * (1 + (this.morale - 50) / 5000));
    return { income, food };
  }

  serialize() {
    return {
      id: this.id, name: this.name, isoX: this.isoX, isoY: this.isoY,
      terrain: this.terrain, size: this.size, capital: this.capital,
      owner: this.owner, pop: this.pop, agri: this.agri, comm: this.comm,
      defense: this.defense, prosperity: this.prosperity, taxRate: this.taxRate,
      morale: this.morale, garrison: this.garrison, mayor: this.mayor
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
    return c;
  }
}

// 初始化所有城市
export function createInitialCities() {
  return CITIES.map(d => new City(d));
}
