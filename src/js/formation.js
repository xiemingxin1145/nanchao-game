// ============================================================
// formation.js — 阵型系统（6 种阵型 + 克制关系）
//
// 数值平衡约定（可复算）：
//  - 单阵型正面加成 ≤ 25%，克制加成固定 +15%；
//    叠加后单类加成 ≤ 30%（与技能/科技经 clampBonus 再封顶 +100%）。
//  - effect 袋键名与 skills.js 同语义：
//    infantryMult/cavalryMult/archerMult/allUnitMult/garrisonMult/ambushBonus
// ============================================================

// counter 为本阵型所克制的阵型 id；克制成功时攻击 +15%
export const FORMATIONS = {
  fengshi: {
    id: 'fengshi', name: '锋矢阵', counter: 'yanxing',
    description: '骑兵+25%，突击凌厉，但自身防御-10%。克制雁形阵。',
    effect: { cavalryMult: 0.25, allUnitMult: -0.10 }
  },
  yulin: {
    id: 'yulin', name: '鱼鳞阵', counter: 'changshe',
    description: '步兵+20%，近战杀伤+15%。克制长蛇阵。',
    effect: { infantryMult: 0.20, allUnitMult: 0.15 }
  },
  yanxing: {
    id: 'yanxing', name: '雁形阵', counter: 'fangyuan',
    description: '弓兵+25%，远程齐射+20%，但近战-10%。克制方圆阵。',
    effect: { archerMult: 0.25, allUnitMult: -0.10 }
  },
  fangyuan: {
    id: 'fangyuan', name: '方圆阵', counter: 'fengshi',
    description: '全兵种防御+20%，守城+30%，但攻击-10%。克制锋矢阵。',
    effect: { garrisonMult: 0.30, allUnitMult: -0.10 }
  },
  changshe: {
    id: 'changshe', name: '长蛇阵', counter: 'yanxing',
    description: '移动速度+30%，行军消耗-20%，机动奔袭。克制雁形阵。',
    effect: { moveMult: 0.30, supplyMult: -0.20 }
  },
  heyi: {
    id: 'heyi', name: '鹤翼阵', counter: null,
    description: '全兵种+10%，无明显克制，均衡之选。',
    effect: { allUnitMult: 0.10 }
  }
};

// 克制关系速查（myFormation -> 被我克制的阵型）
export const FORMATION_COUNTER = {
  fengshi: 'yanxing', yulin: 'changshe', yanxing: 'fangyuan',
  fangyuan: 'fengshi', changshe: 'yanxing', heyi: null
};

// 克制成功时攻击加成
export const FORMATION_COUNTER_BONUS = 0.15;

export const DEFAULT_FORMATION = 'heyi';

export function getFormation(formationId) {
  return FORMATIONS[formationId] || FORMATIONS[DEFAULT_FORMATION];
}

// 组装阵型效果袋：自身效果 + 克制加成（若克制敌方阵型）
// myFormationId / enemyFormationId: string
// 返回效果袋（与 skills 同语义）
export function getFormationBag(myFormationId, enemyFormationId) {
  const f = getFormation(myFormationId);
  const bag = { ...(f.effect || {}) };
  const counters = f.counter || FORMATION_COUNTER[myFormationId];
  if (counters && enemyFormationId && counters === enemyFormationId) {
    bag.allUnitMult = (bag.allUnitMult || 0) + FORMATION_COUNTER_BONUS;
  }
  return bag;
}

// AI 用：根据主力兵种推荐阵型
export function suggestFormation(mainUnit) {
  switch (mainUnit) {
    case 'cavalry': return 'fengshi';
    case 'infantry': return 'yulin';
    case 'archer': return 'yanxing';
    default: return DEFAULT_FORMATION;
  }
}
