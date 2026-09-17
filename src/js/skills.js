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
