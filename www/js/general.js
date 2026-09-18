// ============================================================
// general.js — 武将数据模型
// ============================================================
import { GENERALS, NEW_GENERAL_SKILLS } from './data.js';
import { getGeneralSkills } from './skills.js';
import { getItem } from './equipment.js';
import { getTitleStatBonus } from './office.js'; // V7.0 爵位属性加成

// V4.0: 升级经验需求 100→120（原值100，新值120，调整原因: 减缓升级速度，确保升级有成就感但不会太快）
const EXP_PER_LEVEL = 120;   // 120 exp 升一级（旧扁平公式，保留兼容）
const LEVEL_STAT_BONUS = 2;  // 每级全属性 +2
const LEVEL_TROOPS_BONUS = 500; // 每级带兵上限 +500

// ============================================================
// V14.0「霸业宏图」：武将养成系统
//  - 等级上限 MAX_GENERAL_LEVEL = 50
//  - 升级所需经验 expToNext(level) = round(100 * level^1.5)
//  - 升级时按武将类型偏重加点（猛将/统帅/谋士/内政）
// ============================================================
export const MAX_GENERAL_LEVEL = 50;

// 升级所需经验（新公式）：100 * level^1.5
export function expToNext(level) {
  return Math.round(100 * Math.pow(level, 1.5));
}

// 武将类型枚举
export const GENERAL_TYPES = {
  warrior:  { id: 'warrior',  name: '猛将' }, // 武>统>智>政
  commander:{ id: 'commander',name: '统帅' }, // 统>武>政>智
  strategist:{id: 'strategist',name: '谋士' },// 智>政>统>武
  civilian: { id: 'civilian', name: '内政' }  // 政>智>统>武
};

// 根据武将四维属性判定其成长类型
// 取四维中最高者作为主类型；若并列则按 武>统>智>政 权重裁决
export function classifyGeneralType(g) {
  const attrs = { force: g.force, command: g.command, intel: g.intel, politics: g.politics };
  // 各类型主属性
  const primary = { warrior: 'force', commander: 'command', strategist: 'intel', civilian: 'politics' };
  // 找出主属性最高的类型
  let bestType = 'civilian', bestVal = -Infinity;
  for (const [t, key] of Object.entries(primary)) {
    if (attrs[key] > bestVal) { bestVal = attrs[key]; bestType = t; }
  }
  return bestType;
}

// 升级时按类型偏重返回四维加点数组 [command, force, intel, politics]
// 偏重顺序：第一位 +2，第二位 +2，第三位 +1，第四位 +1（在1~2间随机）
function _statBonusByType(type) {
  // 权重顺序（从高到低）：四维键名
  const order = {
    warrior:   ['force', 'command', 'intel', 'politics'],
    commander: ['command', 'force', 'politics', 'intel'],
    strategist:['intel', 'politics', 'command', 'force'],
    civilian:  ['politics', 'intel', 'command', 'force']
  }[type] || ['command', 'force', 'intel', 'politics'];
  const bonus = { command: 0, force: 0, intel: 0, politics: 0 };
  order.forEach((key, idx) => {
    // 前两位固定 +2，后两位随机 1~2
    bonus[key] = idx < 2 ? 2 : (1 + Math.floor(Math.random() * 2));
  });
  return [bonus.command, bonus.force, bonus.intel, bonus.politics];
}

// ============================================================
// V14.0：忠诚度动态系统
// 五级：死忠(80~100) / 信赖(60~79) / 普通(40~59) / 不满(20~39) / 危殆(0~19)
// 低于30时有概率下野/叛变
// ============================================================
export const LOYALTY_LEVELS = [
  { min: 80, id: 'devoted',  name: '死忠' },
  { min: 60, id: 'trusted',  name: '信赖' },
  { min: 40, id: 'normal',   name: '普通' },
  { min: 20, id: 'discontent', name: '不满' },
  { min: 0,  id: 'critical', name: '危殆' }
];
export const LOYALTY_DEFECT_THRESHOLD = 30; // 低于此值有叛变概率
export const LOYALTY_DEFECT_CHANCE = 0.08;  // 每回合在阈值以下的叛变概率

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

    // ---- V7.0：官职 / 爵位 ----
    this.office = data.office || null;          // 官职 id（OFFICES），仅中央/武官
    this.title = data.title || null;            // 爵位 id（TITLES），六等爵

    // ---- V14.0：忠诚度动态系统辅助字段 ----
    this.turnsSinceBattle = data.turnsSinceBattle || 0; // 距上次战斗回合数（长期无战事掉忠诚）
  }

  // V7.0：爵位给个人的四维加成
  _titleBonus() { return this.title ? getTitleStatBonus(this.title) : 0; }

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

  // 有效属性（含等级加成 + 装备加成 + 爵位加成；负伤时按比例下降）
  get effCommand()   { return this._wound(this.command + this._titleBonus() + (this.getEquipmentStats().command || 0)); }
  get effForce()      { return this._wound(this.force + this._titleBonus() + (this.getEquipmentStats().force || 0)); }
  get effIntel()      { return this._wound(this.intel + this._titleBonus() + (this.getEquipmentStats().intel || 0)); }
  get effPolitics()   { return this._wound(this.politics + this._titleBonus() + (this.getEquipmentStats().politics || 0)); }

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
  // V14.0：内部改走新公式 addExp/levelUp，保持对外返回「升级次数」语义不变
  gainExp(n) {
    const ups = this.addExp(n);
    return ups;
  }

  // ============================================================
  // V14.0：经验与等级系统 API
  // ============================================================

  // 获取当前等级
  getLevel() { return this.level; }

  // 获取当前经验值
  getExp() { return this.exp; }

  // 获取当前等级升级到下一级所需经验
  getExpToNext() { return expToNext(this.level); }

  // 武将成长类型（猛将/统帅/谋士/内政）
  getType() { return classifyGeneralType(this); }

  // 是否可升级（经验已满且未达等级上限）
  canLevelUp() {
    return this.level < MAX_GENERAL_LEVEL && this.exp >= this.getExpToNext();
  }

  // 增加经验并自动升级；返回升级次数（与旧 gainExp 一致）
  addExp(amount) {
    if (amount == null || isNaN(amount)) return 0;
    this.exp += Math.round(amount);
    let ups = 0;
    while (this.canLevelUp()) {
      this.levelUp();
      ups++;
    }
    return ups;
  }

  // 执行一次升级：扣除经验、提升等级、按类型偏重加点
  // 返回升级信息 { level, bonuses: {command,force,intel,politics}, type }
  levelUp() {
    if (this.level >= MAX_GENERAL_LEVEL) return null;
    this.exp -= this.getExpToNext();
    this.level++;
    const type = this.getType();
    const [cmd, frc, itl, pol] = _statBonusByType(type);
    this.command += cmd;
    this.force += frc;
    this.intel += itl;
    this.politics += pol;
    return {
      level: this.level,
      type,
      bonuses: { command: cmd, force: frc, intel: itl, politics: pol }
    };
  }

  // ============================================================
  // V14.0：忠诚度动态系统 API
  // ============================================================

  // 调整忠诚度（delta 可正可负），自动钳制 0~100
  // reason: 调整原因（战斗胜利/失败/封赏/长期无战事/君主魅力等），仅记录用
  updateLoyalty(delta, reason) {
    this.loyalty = Math.max(0, Math.min(100, this.loyalty + Math.round(delta)));
    return this.loyalty;
  }

  // 获取忠诚度分级（死忠/信赖/普通/不满/危殆）
  getLoyaltyLevel() {
    for (const lv of LOYALTY_LEVELS) {
      if (this.loyalty >= lv.min) return lv;
    }
    return LOYALTY_LEVELS[LOYALTY_LEVELS.length - 1];
  }

  // 忠诚度对战斗士气的加成（高忠诚 +士气）
  // 返回 -0.2 ~ +0.2 的士气修正系数
  getLoyaltyMoraleMod() {
    return (this.loyalty - 50) / 250; // 50忠诚→0，100→+0.2，0→-0.2
  }

  // 忠诚度对内政效率的加成
  getLoyaltyEfficiencyMod() {
    return 1 + (this.loyalty - 50) / 200; // 0.75 ~ 1.25
  }

  // 叛变/下野判定：忠诚度低于阈值时有概率触发
  // 返回 { defected: bool, reason: string|null }
  checkDefection() {
    if (this.faction === null) return { defected: false, reason: null };
    if (this.loyalty >= LOYALTY_DEFECT_THRESHOLD) return { defected: false, reason: null };
    // 越低概率越大：30阈值时基础8%，0忠诚时翻倍
    const chance = LOYALTY_DEFECT_CHANCE * (1 + (LOYALTY_DEFECT_THRESHOLD - this.loyalty) / 30);
    if (Math.random() < chance) {
      return { defected: true, reason: 'loyalty' };
    }
    return { defected: false, reason: null };
  }

  // 回合结束忠诚波动 + 负伤恢复
  endTurn() {
    if (this.faction === null) return;
    // 随机波动 ±5
    this.loyalty = Math.max(0, Math.min(100, this.loyalty + (Math.random() * 10 - 5)));
    // 负伤每回合恢复 1
    if (this.wounded > 0) this.wounded--;
    // V14.0：长期无战事掉忠诚（每10回合-2，由外部调 notifyBattle 重置计数）
    this.turnsSinceBattle = (this.turnsSinceBattle || 0) + 1;
    if (this.turnsSinceBattle > 0 && this.turnsSinceBattle % 10 === 0) {
      this.updateLoyalty(-2, 'long_peace');
    }
  }

  // V14.0：战斗结束回调（胜利/失败），调整忠诚并重置无战事计数
  notifyBattle(won) {
    this.turnsSinceBattle = 0;
    if (won) this.updateLoyalty(3, 'battle_win');
    else this.updateLoyalty(-3, 'battle_lose');
  }

  serialize() {
    return {
      id: this.id, name: this.name, faction: this.faction, role: this.role,
      command: this.command, force: this.force, intel: this.intel,
      politics: this.politics, loyalty: this.loyalty, portrait: this.portrait,
      location: this.location, inArmy: this.inArmy,
      exp: this.exp, level: this.level, skills: this.skills, wounded: this.wounded,
      equipment: this.equipment,
      married: this.married, onHostage: this.onHostage, onMission: this.onMission,
      office: this.office, title: this.title,  // V7.0
      turnsSinceBattle: this.turnsSinceBattle  // V14.0
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
    // V7.0：旧存档补官职/爵位
    g.office = data.office || null;
    g.title = data.title || null;
    return g;
  }
}

export function createInitialGenerals() {
  return GENERALS.map(d => new General(d));
}

// ============================================================
// V14.0：独立函数式 API（接受 General 实例，便于 game 层/UI 调用）
// ============================================================

/** 获取武将等级 */
export function getLevel(general) { return general.getLevel ? general.getLevel() : general.level; }

/** 获取武将经验 */
export function getExp(general) { return general.getExp ? general.getExp() : general.exp; }

/** 获取升级所需经验 */
export function getExpToNext(general) { return general.getExpToNext ? general.getExpToNext() : expToNext(general.level); }

/** 增加经验（返回升级次数） */
export function addExp(general, amount) { return general.addExp ? general.addExp(amount) : (general.exp += Math.round(amount), 0); }

/** 是否可升级 */
export function canLevelUp(general) { return general.canLevelUp ? general.canLevelUp() : false; }

/** 执行升级（返回升级信息） */
export function levelUp(general) { return general.levelUp ? general.levelUp() : null; }

/** 调整忠诚度（delta 可正可负），reason 为调整原因 */
export function updateLoyalty(general, delta, reason) {
  return general.updateLoyalty ? general.updateLoyalty(delta, reason) : null;
}

/** 获取忠诚度分级对象 { id, name, min } */
export function getLoyaltyLevel(general) {
  return general.getLoyaltyLevel ? general.getLoyaltyLevel() : null;
}

/** 叛变/下野判定，返回 { defected, reason } */
export function checkDefection(general) {
  return general.checkDefection ? general.checkDefection() : { defected: false, reason: null };
}

// ============================================================
// ============================================================
// V17.0「战斗系统深化」：武将属性战斗影响
//  - 统率：影响防御与士气
//  - 武力：影响物理伤害
//  - 智力：影响技能效果与计谋成功率
//  - 政治：影响战后招降概率
// ============================================================

/**
 * 获取武将战斗属性综合修正袋
 *  - 攻击倍率：由武力决定（武力 50 → 1.0；100 → 1.5；0 → 0.5）
 *  - 防御倍率：由统率决定（统率 50 → 1.0；100 → 1.4；0 → 0.6）
 *  - 计谋成功率：由智力决定（0.5 + intel/200）
 *  - 技能效果倍率：由智力决定（1 + (intel-50)/250）
 *  - 招降概率：由政治决定（0.05 + politics/1000）
 * @param {object} general - General 实例或纯属性对象
 * @returns {{atkMult, defMult, stratagemChance, skillEffectMult, recruitChance, moraleBonus}}
 */
export function getGeneralCombatStats(general) {
  const cmd = general.effCommand != null ? general.effCommand : (general.command || 50);
  const frc = general.effForce != null ? general.effForce : (general.force || 50);
  const itl = general.effIntel != null ? general.effIntel : (general.intel || 50);
  const pol = general.effPolitics != null ? general.effPolitics : (general.politics || 50);

  return {
    // 武力 → 物理伤害（50→1.0，每 10 点武力 ±0.1）
    atkMult: 1 + (frc - 50) / 100,
    // 统率 → 防御（50→1.0，每 10 点统率 ±0.08）
    defMult: 1 + (cmd - 50) / 125,
    // 智力 → 计谋成功率（0.75 ~ 1.0）
    stratagemChance: Math.min(1.0, 0.5 + itl / 200),
    // 智力 → 技能效果倍率（0.8 ~ 1.2）
    skillEffectMult: 1 + (itl - 50) / 250,
    // 政治 → 战后招降概率（0.05 ~ 0.15）
    recruitChance: 0.05 + pol / 1000,
    // 统率 → 士气加成（-0.2 ~ +0.2）
    moraleBonus: (cmd - 50) / 250
  };
}

/**
 * 获取武将对军队士气的加成（主要由统率决定，忠诚高者额外加成）
 * @param {object} general
 * @returns {number} 士气加成值（0~10 的修正量）
 */
export function getGeneralMoraleBonus(general) {
  const cmd = general.effCommand != null ? general.effCommand : (general.command || 50);
  const loy = general.loyalty != null ? general.loyalty : 50;
  // 统率 50 → 0；100 → +10；0 → -10
  let bonus = (cmd - 50) / 5;
  // 忠诚 ≥ 80 额外 +3
  if (loy >= 80) bonus += 3;
  // 负伤时 -3
  if (general.wounded && general.wounded > 0) bonus -= 3;
  return Math.round(bonus);
}

/**
 * 判断战后招降某败将是否成功（政治越高概率越大）
 * @param {object} victor - 胜方武将
 * @param {object} defeated - 败方武将
 * @returns {{success:boolean, chance:number}}
 */
export function tryRecruitDefeated(victor, defeated) {
  const stats = getGeneralCombatStats(victor);
  // 败将忠诚越低越容易被招降
  const loyFactor = 1 - ((defeated.loyalty || 50) / 100) * 0.5;
  const chance = Math.min(0.8, stats.recruitChance * loyFactor * 2);
  const success = Math.random() < chance;
  return { success, chance: Math.round(chance * 100) / 100 };
}
