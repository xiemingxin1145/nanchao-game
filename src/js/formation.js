// ============================================================
// formation.js — 阵法系统 [V9.0 大扩充]
//
// 历史考据（《孙膑兵法·八阵》《握奇经》《武经总要》）：
//  八阵本八：方阵、圆阵、牝阵、牡阵、冲阵、轮阵、浮沮阵、雁行阵；
//  《握奇经》以天地风云为四正，龙虎鸟蛇为四奇，"余奇为握机"。
//  诸葛亮推演作八阵图，可离可变，步骑协同，正合南北朝军阵发达之风。
//
// V9.0 数值平衡约定（可复算）：
//  - 阵型由 6 种扩至 12 种；每种可升级 1~5 级。
//  - 阵型效果倍率 = 基础效果 × (1 + (level-1) × 0.10)，每级 +10%。
//  - 单阵型正面加成 ≤ 30%，克制方攻击 +15%、被克方防御 -10%。
//  - 叠加后经 army.js clampBonus(±100%) 与 TOTAL_POWER_CAP(3.0) 再封顶。
//  - effect 袋键名与 skills.js 同语义：
//    infantryMult/cavalryMult/archerMult/allUnitMult/garrisonMult/ambushBonus
//  - confuseMult 为本方迷惑敌方（玄襄阵），由战斗引擎折减敌方战力。
// ============================================================

// 单阵型等级上限（八卦阵需科技解锁到 5 级上限）
export const FORMATION_MAX_LEVEL = 5;
export const FORMATION_LEVEL_GROWTH = 0.10; // 每级效果 +10%

// counter 为本阵型所克制的阵型 id；克制成功时攻击 +15%，被克方 -10%
export const FORMATIONS = {
  // ---- 原有 6 阵 ----
  fengshi: {
    id: 'fengshi', name: '锋矢阵', counter: 'heyi',
    description: '骑兵+25%，突击凌厉，自身防御-10%。克制鹤翼阵。',
    effect: { cavalryMult: 0.25, allUnitMult: -0.10 }, techReq: null
  },
  yulin: {
    id: 'yulin', name: '鱼鳞阵', counter: 'fengshi',
    description: '步兵+20%，近战杀伤+15%。克制锋矢阵。',
    effect: { infantryMult: 0.20, allUnitMult: 0.15 }, techReq: null
  },
  yanxing: {
    id: 'yanxing', name: '雁形阵', counter: 'changshe',
    description: '弓兵+25%，远程齐射+20%，近战-10%。克制长蛇阵。',
    effect: { archerMult: 0.25, allUnitMult: -0.10 }, techReq: null
  },
  fangyuan: {
    id: 'fangyuan', name: '方圆阵', counter: 'zhuixing',
    description: '全兵种防御+20%，守城+30%，攻击-10%。克制锥形阵。',
    effect: { garrisonMult: 0.30, allUnitMult: -0.10 }, techReq: null
  },
  changshe: {
    id: 'changshe', name: '长蛇阵', counter: 'gouxing',
    description: '移动速度+30%，行军消耗-20%，机动奔袭。克制钩形阵。',
    effect: { moveMult: 0.30, supplyMult: -0.20 }, techReq: null
  },
  heyi: {
    id: 'heyi', name: '鹤翼阵', counter: 'yulin',
    description: '全兵种+10%，无明显克制，均衡之选。克制鱼鳞阵。',
    effect: { allUnitMult: 0.10 }, techReq: null
  },

  // ---- V9.0 新增 6 阵（共 12 阵）----
  jixing: {
    id: 'jixing', name: '箕形阵', counter: 'fangyuan',
    description: '两翼张如簸箕，步兵+15%、弓兵+10%，侧击包抄。克制方圆阵。',
    effect: { infantryMult: 0.15, archerMult: 0.10 }, techReq: 'f1'
  },
  zhuixing: {
    id: 'zhuixing', name: '锥形阵', counter: 'jixing',
    description: '尖头锥形，锐不可当，骑兵攻击+30%，中央突破。克制箕形阵。',
    effect: { cavalryMult: 0.30 }, techReq: 'f2'
  },
  gouxing: {
    id: 'gouxing', name: '钩形阵', counter: 'yanxing',
    description: '两翼如钩迂回，弓兵攻击+25%，侧后包抄。克制雁形阵。',
    effect: { archerMult: 0.25 }, techReq: 'f3'
  },
  xuanxiang: {
    id: 'xuanxiang', name: '玄襄阵', counter: 'woji',
    description: '迷惑阵型，多设旗鼓烟火，敌方命中-15%。克制握机阵。',
    effect: { confuseMult: 0.15 }, techReq: 'f4'
  },
  woji: {
    id: 'woji', name: '握机阵', counter: 'xuanxiang',
    description: '《握奇经》余奇为握机，全兵种+10%，正奇相合。克制玄襄阵。',
    effect: { allUnitMult: 0.10 }, techReq: 'f5'
  },
  bagua: {
    id: 'bagua', name: '八卦阵', counter: null,
    description: '武侯八阵图，天地风云龙虎鸟蛇八阵相依，全兵种+15%，终极阵法。需科技解锁。',
    effect: { allUnitMult: 0.15 }, techReq: 'f6'
  }
};

// 克制关系速查（myFormation -> 被我克制的阵型）
export const FORMATION_COUNTER = {};
for (const [id, f] of Object.entries(FORMATIONS)) FORMATION_COUNTER[id] = f.counter;

// 克制成功时攻击加成 / 被克方防御折减
export const FORMATION_COUNTER_BONUS = 0.15;
export const FORMATION_COUNTER_PENALTY = 0.10; // 被克方防御 -10%

export const DEFAULT_FORMATION = 'heyi';

// 升级费用：第 n 级（1→2…4→5）费用递增；经验由战斗累积
export function formationUpgradeCost(fromLevel) {
  // fromLevel: 当前等级（1..4），升到下一级
  return 300 + 200 * fromLevel; // 500/700/900/1100
}
// 升级所需经验（累计）
export function formationUpgradeExp(fromLevel) {
  return 100 * fromLevel;
}

export function getFormation(formationId) {
  return FORMATIONS[formationId] || FORMATIONS[DEFAULT_FORMATION];
}

// 某阵型是否已被科技解锁（无 techReq 即默认解锁）
export function isFormationUnlocked(formationId, researchedTechs) {
  const f = getFormation(formationId);
  if (!f.techReq) return true;
  return Array.isArray(researchedTechs) && researchedTechs.includes(f.techReq);
}

// 某阵型在当前科技下的最高可升等级（八卦阵等需科技提上限）
export function maxFormationLevel(formationId, researchedTechs) {
  const f = getFormation(formationId);
  let base = 3; // 未解锁高级科技时最多 3 级
  if (!f.techReq) base = 4; // 基础阵默认 4 级
  if (Array.isArray(researchedTechs) && researchedTechs.includes('f5')) base = 5; // 握机科技
  if (f.id === 'bagua' && Array.isArray(researchedTechs) && researchedTechs.includes('f6')) base = 5;
  return Math.min(FORMATION_MAX_LEVEL, base);
}

// 按等级缩放效果袋：effect 中各数值 × (1 + (level-1)*growth)
export function scaleEffectByLevel(effect, level) {
  const lv = Math.max(1, level || 1);
  const mult = 1 + (lv - 1) * FORMATION_LEVEL_GROWTH;
  const out = {};
  for (const [k, v] of Object.entries(effect || {})) {
    out[k] = typeof v === 'number' ? v * mult : v;
  }
  return out;
}

// 组装阵型效果袋：自身效果（按等级缩放）+ 克制加成（若克制敌方阵型）
// myFormationId / enemyFormationId: string；level: 1..5
export function getFormationBag(myFormationId, enemyFormationId, level) {
  const f = getFormation(myFormationId);
  const bag = scaleEffectByLevel(f.effect || {}, level || 1);
  const counters = f.counter || FORMATION_COUNTER[myFormationId];
  if (counters && enemyFormationId && counters === enemyFormationId) {
    bag.allUnitMult = (bag.allUnitMult || 0) + FORMATION_COUNTER_BONUS;
  }
  return bag;
}

// 被克制时的防御折减（返回 0~1 倍率，0.9 = -10%）
export function enemyCounterPenalty(myFormationId, enemyFormationId) {
  if (!enemyFormationId) return 1.0;
  const e = getFormation(enemyFormationId);
  const counters = e.counter || FORMATION_COUNTER[enemyFormationId];
  if (counters && counters === myFormationId) return 1 - FORMATION_COUNTER_PENALTY;
  return 1.0;
}

// 玄襄阵等迷惑效果：返回折减敌方战力的倍率（1 = 无影响）
export function confuseEnemyMult(myFormationId, level) {
  const f = getFormation(myFormationId);
  if (!f.effect || !f.effect.confuseMult) return 1.0;
  const lv = Math.max(1, level || 1);
  const amount = f.effect.confuseMult * (1 + (lv - 1) * FORMATION_LEVEL_GROWTH);
  return 1 - amount;
}

// AI 用：根据主力兵种推荐阵型
export function suggestFormation(mainUnit, researchedTechs) {
  const have = (id) => isFormationUnlocked(id, researchedTechs);
  switch (mainUnit) {
    case 'cavalry': return have('zhuixing') ? 'zhuixing' : 'fengshi';
    case 'infantry': return have('jixing') ? 'jixing' : 'yulin';
    case 'archer':   return have('gouxing') ? 'gouxing' : 'yanxing';
    default: return have('woji') ? 'woji' : DEFAULT_FORMATION;
  }
}

// 列出当前可用阵型 id（供 UI 选择）
export function availableFormations(researchedTechs) {
  return Object.keys(FORMATIONS).filter(id => isFormationUnlocked(id, researchedTechs));
}

// ============================================================
// V14.0「霸业宏图」：阵型效果增强 API
//  - 阵型等级 1~5，等级越高效果越强（每级 +10%）
//  - 计算阵型克制加成 + 地形适配 + 兵种协同
// ============================================================

/**
 * 获取某军队当前阵型等级（默认1，由 army.formationLevel 或 legion.formationLevel）
 */
export function getFormationLevel(army) {
  return Math.max(1, Math.min(FORMATION_MAX_LEVEL, army.formationLevel || 1));
}

/**
 * 综合计算阵型效果加成
 * @param {string|object} formation - 阵型 id 或阵型对象
 * @param {string} terrain - 地形 id
 * @param {string} enemyFormation - 敌方阵型 id
 * @param {number} level - 阵型等级 1~5
 * @returns {object} 效果袋（含克制/地形/兵种协同修正）
 */
export function getFormationBonus(formation, terrain, enemyFormation, level = 1) {
  const fid = typeof formation === 'string' ? formation : (formation.id || DEFAULT_FORMATION);
  const lvl = Math.max(1, Math.min(FORMATION_MAX_LEVEL, level || 1));
  // 基础效果袋（按等级缩放）+ 克制加成
  const bag = getFormationBag(fid, enemyFormation, lvl);
  // 地形适配：平原→骑兵阵加分，山地→步兵阵加分
  if (terrain === 'plain' && bag.cavalryMult) bag.cavalryMult += 0.05;
  if (terrain === 'mountain' && bag.infantryMult) bag.infantryMult += 0.05;
  if (terrain === 'river' && bag.archerMult) bag.archerMult += 0.05;
  // 兵种协同：全兵种类阵型在混合兵种下额外 +3%
  if (bag.allUnitMult) bag.allUnitMult += 0.03;
  return bag;
}

/**
 * 升级某军队的阵型（消耗阵型经验）
 * @param {object} army - 军队对象（含 formation, formationExp）
 * @param {Array} researchedTechs - 已研究科技
 * @returns {ok, msg, level}
 */
export function upgradeFormation(army, researchedTechs = []) {
  if (!army.formationExp) army.formationExp = 0;
  const curLv = getFormationLevel(army);
  const maxLv = maxFormationLevel(army.formation || DEFAULT_FORMATION, researchedTechs);
  if (curLv >= maxLv) return { ok: false, msg: `阵型已达当前等级上限（${maxLv}级）` };
  const needExp = formationUpgradeExp(curLv);
  if (army.formationExp < needExp) {
    return { ok: false, msg: `阵型经验不足（需${needExp}，当前${Math.floor(army.formationExp)}）` };
  }
  army.formationExp -= needExp;
  army.formationLevel = curLv + 1;
  return { ok: true, msg: `阵型升至 ${army.formationLevel} 级`, level: army.formationLevel };
}
