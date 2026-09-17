// ============================================================
// general.js — 武将数据模型
// ============================================================
import { GENERALS, NEW_GENERAL_SKILLS } from './data.js';
import { getGeneralSkills } from './skills.js';
import { getItem } from './equipment.js';

// V4.0: 升级经验需求 100→120（原值100，新值120，调整原因: 减缓升级速度，确保升级有成就感但不会太快）
const EXP_PER_LEVEL = 120;   // 120 exp 升一级
const LEVEL_STAT_BONUS = 2;  // 每级全属性 +2
const LEVEL_TROOPS_BONUS = 500; // 每级带兵上限 +500

export class General {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.faction = data.faction;    // null = 在野
    this.role = data.role;
    this.command = data.command;    // 统帅
    this.force = data.force;        // 武力
    this.intel = data.intel;       // 智力
    this.politics = data.politics; // 政治
    this.loyalty = data.loyalty;    // 忠诚
    this.portrait = data.portrait;
    this.location = null;           // 所在城市id 或 军队id
    this.inArmy = null;             // armyId

    // ---- 新增：成长与技能 ----
    this.exp = data.exp || 0;       // 经验
    this.level = data.level || 1;   // 等级
    // 技能 id 列表；缺省时按 GENERAL_SKILLS 表补齐（旧存档兼容）
    // V3.0：合并 NEW_GENERAL_SKILLS（新武将复用已有技能 id）
    const baseSkills = getGeneralSkills(this.id).map(s => s.id);
    const extraSkills = (NEW_GENERAL_SKILLS[this.id] || []);
    const merged = [...new Set([...baseSkills, ...extraSkills])];
    this.skills = data.skills || merged;
    // 临时负伤标记：战斗中可能负伤，属性临时下降，N回合后恢复
    this.wounded = data.wounded || 0;

    // ---- V2.0：装备（4 槽位）----
    // { weapon: itemId|null, armor: ..., mount: ..., treasure: ... }
    this.equipment = data.equipment || { weapon: null, armor: null, mount: null, treasure: null };

    // ---- V2.5：联姻 / 人质 / 谍报标记 ----
    this.married = data.married || null;        // 联姻对象的 generalId
    this.onHostage = !!data.onHostage;          // 在外为质期间不可带兵/任官
    this.onMission = !!data.onMission;          // 执行谍报任务期间不可任职
  }

  // 汇总已装备物品的属性加成袋
  // 平衡：单件传说 +15 四维，四槽合计远低于基础属性 50% 上限
  getEquipmentStats() {
    const bag = {};
    for (const slot of ['weapon', 'armor', 'mount', 'treasure']) {
      const itemId = this.equipment[slot];
      if (!itemId) continue;
      const item = getItem(itemId);
      if (!item) continue;
      for (const [k, v] of Object.entries(item.stats || {})) {
        bag[k] = (bag[k] || 0) + v;
      }
    }
    return bag;
  }

  // 有效属性（含等级加成 + 装备加成；负伤时按比例下降）
  get effCommand()   { return this._wound(this.command + (this.getEquipmentStats().command || 0)); }
  get effForce()      { return this._wound(this.force + (this.getEquipmentStats().force || 0)); }
  get effIntel()      { return this._wound(this.intel + (this.getEquipmentStats().intel || 0)); }
  get effPolitics()   { return this._wound(this.politics + (this.getEquipmentStats().politics || 0)); }

  _wound(attr) {
    // 负伤期间属性 -20%
    return this.wounded > 0 ? Math.round(attr * 0.8) : attr;
  }

  // 可带兵上限（含等级加成；科技 ×1.2 由 game 层再乘）
  // 公式：(baseAttr + (level-1)*2) * 100 + (level-1)*500
  getMaxTroops() {
    const lvlBonus = (this.level - 1) * LEVEL_STAT_BONUS;
    return Math.round((this.command + lvlBonus) * 100) + (this.level - 1) * LEVEL_TROOPS_BONUS;
  }

  // 攻击加成
  getAttackBonus() {
    return (this.effCommand + this.effForce) / 200; // 0.6~1.0+
  }

  // 增加经验，自动升级，返回升级次数
  gainExp(n) {
    this.exp += Math.round(n);
    let ups = 0;
    while (this.exp >= EXP_PER_LEVEL) {
      this.exp -= EXP_PER_LEVEL;
      this.level++;
      this.command += LEVEL_STAT_BONUS;
      this.force += LEVEL_STAT_BONUS;
      this.intel += LEVEL_STAT_BONUS;
      this.politics += LEVEL_STAT_BONUS;
      ups++;
    }
    return ups;
  }

  // 回合结束忠诚波动 + 负伤恢复
  endTurn() {
    if (this.faction === null) return;
    // 随机波动 ±5
    this.loyalty = Math.max(0, Math.min(100, this.loyalty + (Math.random() * 10 - 5)));
    // 负伤每回合恢复 1
    if (this.wounded > 0) this.wounded--;
  }

  serialize() {
    return {
      id: this.id, name: this.name, faction: this.faction, role: this.role,
      command: this.command, force: this.force, intel: this.intel,
      politics: this.politics, loyalty: this.loyalty, portrait: this.portrait,
      location: this.location, inArmy: this.inArmy,
      exp: this.exp, level: this.level, skills: this.skills, wounded: this.wounded,
      equipment: this.equipment,
      married: this.married, onHostage: this.onHostage, onMission: this.onMission
    };
  }

  static deserialize(data) {
    const g = new General({
      id: data.id, name: data.name, faction: data.faction, role: data.role,
      command: data.command, force: data.force, intel: data.intel,
      politics: data.politics, loyalty: data.loyalty, portrait: data.portrait,
      exp: data.exp, level: data.level, skills: data.skills, wounded: data.wounded,
      equipment: data.equipment || { weapon: null, armor: null, mount: null, treasure: null }
    });
    g.location = data.location;
    g.inArmy = data.inArmy;
    // V2.5：旧存档补默认值
    g.married = data.married || null;
    g.onHostage = !!data.onHostage;
    g.onMission = !!data.onMission;
    return g;
  }
}

export function createInitialGenerals() {
  return GENERALS.map(d => new General(d));
}
