// ============================================================
// general.js — 武将数据模型
// ============================================================
import { GENERALS } from './data.js';

export class General {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.faction = data.faction;    // null = 在野
    this.role = data.role;
    this.command = data.command;    // 统帅
    this.force = data.force;        // 武力
    this.intel = data.intel;        // 智力
    this.politics = data.politics;  // 政治
    this.loyalty = data.loyalty;    // 忠诚
    this.portrait = data.portrait;
    this.location = null;           // 所在城市id 或 军队id
    this.inArmy = null;             // armyId
  }

  // 可带兵上限
  getMaxTroops() {
    return Math.round(this.command * 100);
  }

  // 攻击加成
  getAttackBonus() {
    return (this.command + this.force) / 200; // 0.6~1.0+
  }

  // 回合结束忠诚波动
  endTurn() {
    if (this.faction === null) return;
    // 随机波动 ±5
    this.loyalty = Math.max(0, Math.min(100, this.loyalty + (Math.random() * 10 - 5)));
  }

  serialize() {
    return {
      id: this.id, name: this.name, faction: this.faction, role: this.role,
      command: this.command, force: this.force, intel: this.intel,
      politics: this.politics, loyalty: this.loyalty, portrait: this.portrait,
      location: this.location, inArmy: this.inArmy
    };
  }

  static deserialize(data) {
    const g = new General({
      id: data.id, name: data.name, faction: data.faction, role: data.role,
      command: data.command, force: data.force, intel: data.intel,
      politics: data.politics, loyalty: data.loyalty, portrait: data.portrait
    });
    g.location = data.location;
    g.inArmy = data.inArmy;
    return g;
  }
}

export function createInitialGenerals() {
  return GENERALS.map(d => new General(d));
}
