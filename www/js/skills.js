// ============================================================
// skills.js — 武将技能系统
// 主动技能（active）：战斗中由玩家/AI 选择使用，受冷却限制
// 被动技能（passive）：满足条件自动触发，在战力计算中乘算
//
// 数值约定（可复算）：
//  - effect 中的百分比均为乘算系数，例如 cavalryMult: 0.15 表示骑兵战力 ×1.15
//  - 同一「类别」下所有加成（技能 + 科技 + 势力）在战力计算中先相加再乘算，
//    最终加成封顶 +100%（即该类别倍率 ≤ 2.0），见 army.js clampBonus()
// ============================================================

// ---------- 技能注册表 ----------
// effect 字段说明：
//   allUnitMult   全兵种战力倍率加成
//   infantryMult  步兵倍率加成
//   cavalryMult   骑兵倍率加成
//   archerMult    弓兵倍率加成
//   attackMult    通用攻击倍率加成
//   defenseMult   通用防御倍率加成（守城/防御动作）
//   siegeMult     攻城（攻击敌方城市）倍率加成
//   garrisonMult  守城（被攻城时）倍率加成
//   ambushBonus   奇袭触发概率加成（+x）
//   detectBonus   识破敌计概率加成（+x）
//   defectBonus   策反成功率加成
//   recruitBonus  招募在野武将成功率加成
//   mayorDefenseMult  任太守时城市防御加成
//   moralePerTurn 每回合民心加成
//   doubleForce   主动：本战武力翻倍（攻击力×2）
//   forceBoostMult 主动：武力临时提升倍率
//   chargeMult    冲锋（猛攻动作）加成
//   firstRoutAmbush 主动：首轮奇袭必中
export const SKILLS = {
  // --- 南梁 ---
  wangzhe_qiqi: {
    id: 'wangzhe_qiqi', name: '王者之气', type: 'passive', cooldown: 0,
    description: '真龙之气，己方全兵种战力+10%。',
    effect: { allUnitMult: 0.10 }
  },
  dudu_zhongwai: {
    id: 'dudu_zhongwai', name: '都督中外', type: 'passive', cooldown: 0,
    description: '统御诸军，全军战力+8%。',
    effect: { allUnitMult: 0.08 }
  },
  shoucheng_mingjiang: {
    id: 'shoucheng_mingjiang', name: '守城名将', type: 'passive', cooldown: 0,
    description: '任太守时，城市防御+50%。',
    effect: { mayorDefenseMult: 0.50 }
  },
  rujiang: {
    id: 'rujiang', name: '儒将', type: 'passive', cooldown: 0,
    description: '谦谦君子，奇袭概率+30%，识破敌方计谋+40%。',
    effect: { ambushBonus: 0.30, detectBonus: 0.40 }
  },
  jingtu_tuzhi: {
    id: 'jingtu_tuzhi', name: '励精图治', type: 'passive', cooldown: 0,
    description: '勤政爱民，税收+10%，民心每回合+5。',
    effect: { incomeMult: 0.10, moralePerTurn: 5 }
  },
  bianzhen_hanjiang: {
    id: 'bianzhen_hanjiang', name: '边镇悍将', type: 'passive', cooldown: 0,
    description: '久历边镇，骑兵+10%、弓兵+10%。',
    effect: { cavalryMult: 0.10, archerMult: 0.10 }
  },

  // --- 东魏 ---
  xiaoxiong: {
    id: 'xiaoxiong', name: '枭雄', type: 'passive', cooldown: 0,
    description: '雄才大略，策反成功率+30%，攻城战力+15%。',
    effect: { defectBonus: 0.30, siegeMult: 0.15 }
  },
  luodiao_dudu: {
    id: 'luodiao_dudu', name: '落雕都督', type: 'passive', cooldown: 0,
    description: '射落飞雕之神射，弓兵战力+25%。',
    effect: { archerMult: 0.25 }
  },
  mengjiang: {
    id: 'mengjiang', name: '猛将', type: 'active', cooldown: 2,
    description: '主动：怒吼冲阵，本场武力翻倍，步兵猛攻+30%。',
    effect: { doubleForce: true, chargeMult: 0.30 }
  },
  hanshan_yanji: {
    id: 'hanshan_yanji', name: '寒山堰计', type: 'passive', cooldown: 0,
    description: '善用水攻，攻城+15%，识破计谋+30%。',
    effect: { siegeMult: 0.15, detectBonus: 0.30 }
  },
  jiamian_pozhen: {
    id: 'jiamian_pozhen', name: '假面破阵', type: 'active', cooldown: 2,
    description: '主动：戴面具摧锋陷阵，冲锋+40%，首轮奇袭必中。',
    effect: { chargeMult: 0.40, firstRoutAmbush: true }
  },
  mouliao_baichu: {
    id: 'mouliao_baichu', name: '谋略百出', type: 'passive', cooldown: 0,
    description: '临敌应变无穷，奇袭+35%，识破+35%。',
    effect: { ambushBonus: 0.35, detectBonus: 0.35 }
  },

  // --- 西魏 ---
  guanlong_jituan: {
    id: 'guanlong_jituan', name: '关陇集团', type: 'passive', cooldown: 0,
    description: '关中本位，步兵+20%，守城+15%。',
    effect: { infantryMult: 0.20, garrisonMult: 0.15 }
  },
  yubi_jianshou: {
    id: 'yubi_jianshou', name: '玉璧坚守', type: 'passive', cooldown: 0,
    description: '玉璧城下退强敌，守城战力+30%。',
    effect: { garrisonMult: 0.30 }
  },
  ciemao_fengliu: {
    id: 'ciemao_fengliu', name: '侧帽风流', type: 'passive', cooldown: 0,
    description: '风流倜傥，民心每回合+10，招募在野武将成功率+20%。',
    effect: { moralePerTurn: 10, recruitBonus: 0.20 }
  },
  bazhuguo_zhiyong: {
    id: 'bazhuguo_zhiyong', name: '八柱国之勇', type: 'passive', cooldown: 0,
    description: '柱国上将，骑兵战力+15%。',
    effect: { cavalryMult: 0.15 }
  },
  miefo_xingzhou: {
    id: 'miefo_xingzhou', name: '灭佛兴周', type: 'passive', cooldown: 0,
    description: '富国强兵，金钱收入+15%，步兵+15%。',
    effect: { incomeMult: 0.15, infantryMult: 0.15 }
  },
  daizhou_jiansui: {
    id: 'daizhou_jiansui', name: '代周建隋', type: 'passive', cooldown: 0,
    description: '天命所归，全兵种+15%，政治施政效果+20%。',
    effect: { allUnitMult: 0.15, politicsEffMult: 0.20 }
  },

  // --- 在野 ---
  baipao_jun: {
    id: 'baipao_jun', name: '白袍军', type: 'active', cooldown: 3,
    description: '主动：七千白袍，骑兵战力本场+50%。',
    effect: { cavalryMult: 0.50 }
  },
  changchou_liangsha: {
    id: 'changchou_liangsha', name: '唱筹量沙', type: 'active', cooldown: 3,
    description: '主动：以沙为粮欺敌，本场防御+40%，奇袭概率+30%。',
    effect: { defenseMult: 0.40, ambushBonus: 0.30 }
  },
  xiaoyong_shanzhan: {
    id: 'xiaoyong_shanzhan', name: '骁勇善战', type: 'passive', cooldown: 0,
    description: '猛锐冠世，骑兵+15%，奇袭+20%。',
    effect: { cavalryMult: 0.15, ambushBonus: 0.20 }
  },

  // ============================================================
  // V14.0「霸业宏图」新增技能（v14_ 前缀）
  // 覆盖主动/被动/内政三类，服务于武将养成技能树
  // ============================================================

  // ---- 主动技（战斗中释放）----
  v14_lianji: {
    id: 'v14_lianji', name: '连击', type: 'active', cooldown: 2,
    description: '主动：连续突击，本场攻击+30%，有20%概率再次伤害。',
    effect: { attackMult: 0.30, comboChance: 0.20 }
  },
  v14_baoji: {
    id: 'v14_baoji', name: '暴击', type: 'active', cooldown: 2,
    description: '主动：致命一击，本场暴击率+25%，攻击+15%。',
    effect: { critChance: 0.25, attackMult: 0.15 }
  },
  v14_xixue: {
    id: 'v14_xixue', name: '吸血', type: 'active', cooldown: 3,
    description: '主动：伤敌为己，本场造成伤害的15%转化为兵力恢复。',
    effect: { lifesteal: 0.15, attackMult: 0.10 }
  },
  v14_chaoFeng: {
    id: 'v14_chaoFeng', name: '嘲讽', type: 'active', cooldown: 3,
    description: '主动：怒喝激将，吸引火力，本场防御+30%，反击+20%。',
    effect: { defenseMult: 0.30, counterMult: 0.20 }
  },
  v14_jingzhong: {
    id: 'v14_jingzhong', name: '陷阵', type: 'active', cooldown: 3,
    description: '主动：身先士卒，本场全军攻击+40%，但自损+10%。',
    effect: { attackMult: 0.40, selfDamageMult: 0.10 }
  },
  v14_shenmen: {
    id: 'v14_shenmen', name: '神射', type: 'active', cooldown: 2,
    description: '主动：百步穿杨，弓兵本场+35%，首轮齐射必中。',
    effect: { archerMult: 0.35, firstRoutAmbush: true }
  },
  v14_tiebi: {
    id: 'v14_tiebi', name: '铁壁', type: 'active', cooldown: 3,
    description: '主动：坚不可摧，本场防御+50%，守城时额外+15%。',
    effect: { defenseMult: 0.50, garrisonMult: 0.15 }
  },
  v14_fengkuang: {
    id: 'v14_fengkuang', name: '疯狂', type: 'active', cooldown: 4,
    description: '主动：狂战无双，本场武力×1.8，攻击+25%，但每回合自损5%。',
    effect: { forceBoostMult: 0.80, attackMult: 0.25, selfDamageMult: 0.05 }
  },

  // ---- 被动技（永久属性加成）----
  v14_lifu: {
    id: 'v14_lifu', name: '膂力', type: 'passive', cooldown: 0,
    description: '天生神力，武力+8，步兵+10%。',
    effect: { forceFlat: 8, infantryMult: 0.10 }
  },
  v14_chengjia: {
    id: 'v14_chengjia', name: '坚甲', type: 'passive', cooldown: 0,
    description: '披坚执锐，防御+12%，带兵上限+200。',
    effect: { defenseMult: 0.12, troopMaxFlat: 200 }
  },
  v14_ruishi: {
    id: 'v14_ruishi', name: '锐士', type: 'passive', cooldown: 0,
    description: '选拔精锐，全军攻击+12%，士气+10。',
    effect: { attackMult: 0.12, moraleFlat: 10 }
  },
  v14_qimeng: {
    id: 'v14_qimeng', name: '奇谋', type: 'passive', cooldown: 0,
    description: '算无遗策，智力+8，奇袭概率+20%，识破+20%。',
    effect: { intelFlat: 8, ambushBonus: 0.20, detectBonus: 0.20 }
  },
  v14_yingyong: {
    id: 'v14_yingyong', name: '英武', type: 'passive', cooldown: 0,
    description: '勇冠三军，武力+5，骑兵+12%，移动+10%。',
    effect: { forceFlat: 5, cavalryMult: 0.12, moveMult: 0.10 }
  },
  v14_weiyuan: {
    id: 'v14_weiyuan', name: '威远', type: 'passive', cooldown: 0,
    description: '威震遐迩，全兵种+8%，忠诚度影响+10。',
    effect: { allUnitMult: 0.08, loyaltyFlat: 10 }
  },

  // ---- 内政技（内政加成）----
  v14_nongshi: {
    id: 'v14_nongshi', name: '农事', type: 'internal', cooldown: 0,
    description: '劝课农桑，所在城粮食产出+15%，农业发展速度+10%。',
    effect: { foodMult: 0.15, agriDevMult: 0.10 }
  },
  v14_shanggu: {
    id: 'v14_shanggu', name: '商贾', type: 'internal', cooldown: 0,
    description: '通商惠工，所在城金钱收入+15%，商业发展速度+10%。',
    effect: { incomeMult: 0.15, commDevMult: 0.10 }
  },
  v14_minzhi: {
    id: 'v14_minzhi', name: '民治', type: 'internal', cooldown: 0,
    description: '爱民如子，所在城民心每回合+3，人口增长+8%。',
    effect: { moralePerTurn: 3, popMult: 0.08 }
  },
  v14_xunlian: {
    id: 'v14_xunlian', name: '训练', type: 'internal', cooldown: 0,
    description: '练兵有方，所在城征兵质量+15%，训练发展速度+10%。',
    effect: { recruitQuality: 0.15, trainingDevMult: 0.10 }
  },
  v14_hedao: {
    id: 'v14_hedao', name: '河道', type: 'internal', cooldown: 0,
    description: '通晓水利，所在城水利发展速度+15%，灾害减免+10%。',
    effect: { waterDevMult: 0.15, disasterMult: -0.10 }
  }
};

// ---------- 武将 → 技能映射（每位 1~2 个） ----------
export const GENERAL_SKILLS = {
  chen_baxian:   ['wangzhe_qiqi'],
  wang_sengbian: ['dudu_zhongwai'],
  yang_kan:      ['shoucheng_mingjiang'],
  wei_rui:       ['rujiang'],
  chen_qian:     ['jingtu_tuzhi'],
  yang_yaren:    ['bianzhen_hanjiang'],

  gao_huan:      ['xiaoxiong'],
  hu_luguang:    ['luodiao_dudu'],
  gao_aocao:     ['mengjiang'],
  murong_shaozong: ['hanshan_yanji'],
  gao_changgong: ['jiamian_pozhen'],
  duan_shao:     ['mouliao_baichu'],

  yuwen_tai:     ['guanlong_jituan'],
  wei_xiaokuan:  ['yubi_jianshou'],
  dugu_xin:      ['ciemao_fengliu'],
  li_hu:         ['bazhuguo_zhiyong'],
  yuwen_yong:    ['miefo_xingzhou'],
  yang_jian:     ['daizhou_jiansui'],

  chen_qingzhi:  ['baipao_jun'],
  tan_daoji:     ['changchou_liangsha'],
  cao_jingzong:  ['xiaoyong_shanzhan']
};

// 获取某武将拥有的技能数据对象数组
export function getGeneralSkills(generalId) {
  const ids = GENERAL_SKILLS[generalId] || [];
  return ids.map(id => SKILLS[id]).filter(Boolean);
}

// 获取某武将某技能
export function getSkill(skillId) {
  return SKILLS[skillId] || null;
}

// 仅主动技能
export function getActiveSkills(generalId) {
  return getGeneralSkills(generalId).filter(s => s.type === 'active');
}

// ============================================================
// V14.0「霸业宏图」：武将技能树系统
//  - 每位武将 3 个技能槽位：槽1 初始解锁（自带基础技能），
//    槽2 10 级解锁，槽3 25 级解锁。
//  - 槽2/槽3 可从 V14 技能池中选择一个 v14_ 技能解锁。
// ============================================================

// 三个槽位的解锁等级要求
export const SKILL_SLOT_LEVELS = [1, 10, 25];

// V14 技能树候选池（按武将类型推荐）
// 武将类型：warrior 猛将 / commander 统帅 / strategist 谋士 / civilian 内政
export const V14_TREE_POOL = {
  warrior:   ['v14_lianji', 'v14_baoji', 'v14_xixue', 'v14_chaoFeng', 'v14_jingzhong', 'v14_lifu', 'v14_yingyong', 'v14_fengkuang'],
  commander: ['v14_chengjia', 'v14_ruishi', 'v14_chaoFeng', 'v14_tiebi', 'v14_weiyuan', 'v14_jingzhong', 'v14_qimeng', 'v14_xunlian'],
  strategist:['v14_qimeng', 'v14_shenmen', 'v14_lianji', 'v14_baoji', 'v14_ruishi', 'v14_weiyuan', 'v14_nongshi', 'v14_shanggu'],
  civilian:  ['v14_nongshi', 'v14_shanggu', 'v14_minzhi', 'v14_xunlian', 'v14_hedao', 'v14_weiyuan', 'v14_ruishi', 'v14_chengjia']
};

/**
 * 获取武将技能树结构
 * @param {object} general - General 实例（需含 level, skills）
 * @returns {Array<{slot:number, levelReq:number, unlocked:boolean, skillId:string|null}>}
 */
export function getSkillTree(general) {
  const lvl = general.level || 1;
  const owned = new Set(general.skills || []);
  const tree = [];
  for (let i = 0; i < SKILL_SLOT_LEVELS.length; i++) {
    const req = SKILL_SLOT_LEVELS[i];
    // 槽1：初始解锁，填充武将自带的第一个基础技能
    let skillId = null;
    if (i === 0) {
      const base = (GENERAL_SKILLS[general.id] || [])[0];
      if (base) skillId = base;
    } else {
      // 槽2/槽3：已解锁槽位中玩家选择的 v14 技能
      const v14Owned = (general.skills || []).filter(id => id && id.startsWith('v14_'));
      if (v14Owned[i - 1]) skillId = v14Owned[i - 1];
    }
    tree.push({
      slot: i,
      levelReq: req,
      unlocked: lvl >= req,
      skillId
    });
  }
  return tree;
}

/**
 * 获取武将当前已解锁的全部技能对象（基础技能 + 技能树技能）
 */
export function getUnlockedSkills(general) {
  const ids = general.skills || [];
  return ids.map(id => SKILLS[id]).filter(Boolean);
}

/**
 * 检查是否可解锁某技能
 * 规则：必须是 v14_ 技能、尚未拥有、且存在已解锁但未填满的技能树槽位
 */
export function canUnlockSkill(general, skillId) {
  const sk = SKILLS[skillId];
  if (!sk) return { ok: false, msg: '技能不存在' };
  if (!skillId.startsWith('v14_')) return { ok: false, msg: '仅可解锁 V14 新技能' };
  const owned = new Set(general.skills || []);
  if (owned.has(skillId)) return { ok: false, msg: '已拥有该技能' };
  // 已解锁但空着的槽位数量
  const tree = getSkillTree(general);
  const freeSlots = tree.filter(s => s.unlocked && !s.skillId).length;
  if (freeSlots <= 0) return { ok: false, msg: '技能槽位已满（需提升等级解锁新槽位）' };
  return { ok: true };
}

/**
 * 解锁技能（写入 general.skills）
 * 返回 { ok, msg }
 */
export function unlockSkill(general, skillId) {
  const chk = canUnlockSkill(general, skillId);
  if (!chk.ok) return chk;
  general.skills = general.skills || [];
  general.skills.push(skillId);
  const sk = SKILLS[skillId];
  return { ok: true, msg: `${general.name} 习得【${sk.name}】` };
}

/**
 * 按武将类型获取推荐的可解锁技能 id 列表
 */
export function getRecommendedSkills(generalType) {
  return (V14_TREE_POOL[generalType] || V14_TREE_POOL.warrior).slice();
}

// ============================================================
// ============================================================
// V17.0「战斗系统深化」：武将技能战斗集成
//  - 每个主动技能在战斗中有明确效果（伤害/治疗/增益/减益）
//  - 技能效果受智力 / 等级影响
//  - 技能有冷却回合数（写入 general.v17_skillCooldowns）
// ============================================================

// 技能战斗效果类型枚举
export const V17_SKILL_EFFECT_TYPE = {
  DAMAGE: 'damage',       // 直接伤害
  HEAL: 'heal',           // 治疗/恢复兵力
  BUFF: 'buff',           // 自身增益
  DEBUFF: 'debuff'        // 敌方减益
};

// 各类主动技能的基础战斗效果模板（按 effect 字段推断）
// 返回 { type, baseValue, desc }
function _inferSkillCombatTemplate(skill) {
  const e = skill.effect || {};
  // 武力翻倍 / 猛攻类 → 伤害型
  if (e.doubleForce || e.chargeMult || e.forceBoostMult) {
    return { type: V17_SKILL_EFFECT_TYPE.DAMAGE, baseValue: 0.50, desc: '爆发伤害' };
  }
  // 吸血 / 连击 / 暴击 → 伤害型
  if (e.lifesteal || e.comboChance || e.critChance || e.attackMult) {
    return { type: V17_SKILL_EFFECT_TYPE.DAMAGE, baseValue: 0.30, desc: '攻击强化' };
  }
  // 防御 / 铁壁 / 嘲讽 → 增益
  if (e.defenseMult || e.garrisonMult) {
    return { type: V17_SKILL_EFFECT_TYPE.BUFF, baseValue: e.defenseMult || 0.30, desc: '防御增益' };
  }
  // 奇袭 / 首轮伏击 → 减益敌方
  if (e.firstRoutAmbush || e.ambushBonus) {
    return { type: V17_SKILL_EFFECT_TYPE.DEBUFF, baseValue: 0.25, desc: '伏击挫敌' };
  }
  // 弓兵强化 → 伤害型
  if (e.archerMult) {
    return { type: V17_SKILL_EFFECT_TYPE.DAMAGE, baseValue: e.archerMult, desc: '齐射伤害' };
  }
  // 全军强化 → 增益
  if (e.allUnitMult || e.cavalryMult || e.infantryMult) {
    return { type: V17_SKILL_EFFECT_TYPE.BUFF, baseValue: e.allUnitMult || e.cavalryMult || e.infantryMult || 0.15, desc: '全军增益' };
  }
  // 默认：小伤害
  return { type: V17_SKILL_EFFECT_TYPE.DAMAGE, baseValue: 0.15, desc: '战术打击' };
}

/**
 * 计算某技能对目标的战斗效果（不真正释放，仅预览/计算）
 * @param {string} skillId - 技能 id
 * @param {object} general - 释放武将（需含 intel / level / effIntel）
 * @param {object} target - 目标武将/军队（需含 troops）
 * @returns {{type, value, turns, successChance, damage, heal, buff, debuff, log}}
 */
export function getSkillBattleEffect(skillId, general, target) {
  const skill = SKILLS[skillId];
  if (!skill) return { ok: false, msg: '技能不存在' };
  if (skill.type !== 'active') return { ok: false, msg: '被动技能无需主动释放' };

  const intel = general.effIntel || general.intel || 50;
  const level = general.level || 1;
  const template = _inferSkillCombatTemplate(skill);

  // 智力影响：每 25 点智力 +10% 效果；等级影响：每级 +2%
  const intelFactor = 1 + (intel - 50) / 250;       // 0.8 ~ 1.2
  const levelFactor = 1 + (level - 1) * 0.02;        // 每级 +2%
  const effectValue = template.baseValue * intelFactor * levelFactor;

  // 计谋成功率：0.5 + 智力/200（0.75 ~ 1.0）
  const successChance = Math.min(1.0, 0.5 + intel / 200);

  // 持续回合：2 + floor(intel/30)
  const turns = 2 + Math.floor(intel / 30);

  const result = {
    ok: true,
    type: template.type,
    skillId,
    skillName: skill.name,
    caster: general.name,
    target: target?.name || '敌军',
    value: Math.round(effectValue * 100) / 100,
    turns,
    successChance: Math.round(successChance * 100) / 100,
    damage: 0,
    heal: 0,
    buff: null,
    debuff: null,
    log: []
  };

  // 按类型填充具体数值
  if (template.type === V17_SKILL_EFFECT_TYPE.DAMAGE) {
    const targetTroops = target?.troops || 1000;
    result.damage = Math.round(targetTroops * effectValue * (0.8 + Math.random() * 0.4));
    result.log.push(`【${skill.name}】${general.name}对${result.target}造成 ${result.damage} 点伤害（成功率 ${Math.round(successChance * 100)}%）`);
  } else if (template.type === V17_SKILL_EFFECT_TYPE.HEAL) {
    const selfTroops = general.troops || 1000;
    result.heal = Math.round(selfTroops * effectValue);
    result.log.push(`【${skill.name}】${general.name}恢复 ${result.heal} 点兵力`);
  } else if (template.type === V17_SKILL_EFFECT_TYPE.BUFF) {
    result.buff = { attackMult: effectValue, defMult: effectValue, turns };
    result.log.push(`【${skill.name}】${general.name}全军强化 ${turns} 回合（攻防+${Math.round(effectValue * 100)}%）`);
  } else if (template.type === V17_SKILL_EFFECT_TYPE.DEBUFF) {
    result.debuff = { defDown: effectValue, turns };
    result.log.push(`【${skill.name}】${general.name}削弱${result.target}防御 ${turns} 回合（-${Math.round(effectValue * 100)}%）`);
  }
  return result;
}

/**
 * 判断武将当前是否可释放某主动技能（冷却检查）
 * @param {object} general - 武将对象
 * @param {string} skillId - 技能 id
 * @param {number} currentTurn - 当前回合数（可选，预留）
 * @returns {{ok:boolean, msg:string, cooldown:number}}
 */
export function canUseSkill(general, skillId, currentTurn = 0) {
  const skill = SKILLS[skillId];
  if (!skill) return { ok: false, msg: '技能不存在' };
  if (skill.type !== 'active') return { ok: false, msg: '被动技能无法主动释放' };
  // 武将是否拥有该技能
  const owned = general.skills || [];
  if (!owned.includes(skillId)) return { ok: false, msg: `${general.name}未习得【${skill.name}】` };
  // 冷却检查
  if (!general.v17_skillCooldowns) general.v17_skillCooldowns = {};
  const cd = general.v17_skillCooldowns[skillId] || 0;
  if (cd > 0) return { ok: false, msg: `【${skill.name}】冷却中（剩余 ${cd} 回合）`, cooldown: cd };
  return { ok: true, msg: '可释放', cooldown: 0 };
}

/**
 * 释放技能：计算效果、写入冷却
 * @param {object} general - 释放武将
 * @param {string} skillId - 技能 id
 * @param {object} target - 目标
 * @returns {{ok, msg, effect}}
 */
export function useSkill(general, skillId, target) {
  const chk = canUseSkill(general, skillId);
  if (!chk.ok) return { ok: false, msg: chk.msg };
  const effect = getSkillBattleEffect(skillId, general, target);
  if (!effect.ok) return effect;

  // 计谋判定：按 successChance 决定是否命中
  const hit = Math.random() < effect.successChance;
  effect.hit = hit;
  if (!hit) {
    effect.log.push(`【${skill.name}】被${effect.target}识破！技能落空。`);
    effect.damage = 0;
    effect.buff = null;
    effect.debuff = null;
    effect.heal = 0;
  }

  // 写入冷却（skill.cooldown 为基础冷却，智力高时 -1 回合，最低 1）
  const skill = SKILLS[skillId];
  const intel = general.effIntel || general.intel || 50;
  let cd = Math.max(1, (skill.cooldown || 2) - Math.floor((intel - 50) / 50));
  general.v17_skillCooldowns = general.v17_skillCooldowns || {};
  general.v17_skillCooldowns[skillId] = cd;
  effect.cooldownSet = cd;
  return { ok: true, msg: effect.log.join('；'), effect };
}

/**
 * 回合结束时递减所有技能冷却（由 game 层每回合调用）
 */
export function tickSkillCooldowns(general) {
  if (!general.v17_skillCooldowns) return general;
  for (const k of Object.keys(general.v17_skillCooldowns)) {
    general.v17_skillCooldowns[k]--;
    if (general.v17_skillCooldowns[k] <= 0) delete general.v17_skillCooldowns[k];
  }
  return general;
}
