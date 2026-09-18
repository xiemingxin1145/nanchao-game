// ============================================================
// tech.js — 科技改革树（军事 / 经济 / 政治 三线，各6项）
//
// 数值约定（可复算）：
//  - 费用：第 n 项（沿链）费用 = 500 + 300 × (n-1)  → 500/800/1100/1400/1700/2000
//  - 研究回合数：2/2/3/3/4/4
//  - 每势力同时只能研究一个科技，研究中不可切换
//  - effect 中字段与 skills.js 同语义，乘算加成，最终同类加成封顶 +100%
// ============================================================

export const TECH_LINES = {
  military: { id: 'military', name: '军事', color: '#A0522D' },
  economy:  { id: 'economy',  name: '经济', color: '#1B7A5A' },
  political:{ id: 'political',name: '政治', color: '#2C3E6B' },
  // V9.0：阵法分支（解锁新阵型 + 提升阵型升级上限）
  formation:{ id: 'formation', name: '阵法', color: '#6B3FA0' }
};

// 工具：按链位置生成费用与回合数
// pos: 1..6
function costOf(pos) { return 500 + 300 * (pos - 1); }
function turnsOf(pos) { return pos <= 2 ? 2 : (pos <= 4 ? 3 : 4); }

export const TECHS = [
  // ===================== 军事线 =====================
  { id: 'm1', line: 'military', name: '甲骑具装', pos: 1,
    description: '重甲骑兵冲击，骑兵战力+15%。',
    requires: [], effect: { cavalryMult: 0.15 } },
  { id: 'm2', line: 'military', name: '强弩改良', pos: 2,
    description: '强弩劲矢，弓兵战力+15%。',
    requires: ['m1'], effect: { archerMult: 0.15 } },
  { id: 'm3', line: 'military', name: '步阵精练', pos: 3,
    description: '步阵严整，步兵战力+15%。',
    requires: ['m2'], effect: { infantryMult: 0.15 } },
  { id: 'm4', line: 'military', name: '攻城器械', pos: 4,
    description: '冲车砲石齐备，攻城战力+20%。',
    requires: ['m3'], effect: { siegeMult: 0.20 } },
  { id: 'm5', line: 'military', name: '军制改革', pos: 5,
    description: '整编军伍，武将带兵上限+20%。',
    requires: ['m4'], effect: { maxTroopsMult: 0.20 } },
  { id: 'm6', line: 'military', name: '府兵制', pos: 6,
    description: '兵农合一，征兵费用-30%。',
    requires: ['m5'], effect: { recruitCostMult: -0.30 } },

  // ===================== 经济线 =====================
  { id: 'e1', line: 'economy', name: '均田制', pos: 1,
    description: '计口授田，农业产出+15%。',
    requires: [], effect: { foodMult: 0.15 } },
  { id: 'e2', line: 'economy', name: '租调制', pos: 2,
    description: '轻徭薄赋，税收+15%。',
    requires: ['e1'], effect: { incomeMult: 0.15 } },
  { id: 'e3', line: 'economy', name: '水利兴修', pos: 3,
    description: '堰渠广修，旱灾影响-50%，农业再+10%。',
    requires: ['e2'], effect: { foodMult: 0.10, disasterMult: -0.50 } },
  { id: 'e4', line: 'economy', name: '丝路贸易', pos: 4,
    description: '商旅辐辏，商业+20%。',
    requires: ['e3'], effect: { commMult: 0.20 } },
  { id: 'e5', line: 'economy', name: '铸币改革', pos: 5,
    description: '五铢新钱，金钱收入+15%。',
    requires: ['e4'], effect: { incomeMult: 0.15 } },
  { id: 'e6', line: 'economy', name: '大索貌阅', pos: 6,
    description: '检括户口，人口+10%，税收+10%。',
    requires: ['e5'], effect: { popMult: 0.10, incomeMult: 0.10 } },

  // ===================== 政治线 =====================
  { id: 'p1', line: 'political', name: '九品中正', pos: 1,
    description: '中正定品，武将忠诚+10。',
    requires: [], effect: { loyaltyFlat: 10 } },
  { id: 'p2', line: 'political', name: '汉化改革', pos: 2,
    description: '移风易俗，民心+15、繁荣+10。',
    requires: ['p1'], effect: { moraleFlat: 15, prosperityFlat: 10 } },
  { id: 'p3', line: 'political', name: '三省制', pos: 3,
    description: '分权制衡，政治属性效果+20%。',
    requires: ['p2'], effect: { politicsEffMult: 0.20 } },
  { id: 'p4', line: 'political', name: '律法修订', pos: 4,
    description: '明刑弼教，叛乱概率-50%。',
    requires: ['p3'], effect: { rebellionMult: -0.50 } },
  { id: 'p5', line: 'political', name: '科举雏形', pos: 5,
    description: '开科取士，招募在野武将成功率+30%。',
    requires: ['p4'], effect: { recruitBonus: 0.30 } },
  { id: 'p6', line: 'political', name: '大一统', pos: 6,
    description: '车同轨书同文，全兵种+10%、收入+10%。',
    requires: ['p5'], effect: { allUnitMult: 0.10, incomeMult: 0.10 } },

  // ===================== V9.0 阵法线 =====================
  // 历史：南北朝阵法发达，诸葛亮八阵图传习不绝。研阵以解锁新阵、提级。
  { id: 'f1', line: 'formation', name: '箕形操练', pos: 1,
    description: '教习箕形两翼包抄之法，解锁【箕形阵】。',
    requires: [], effect: { unlockFormation: 'jixing' } },
  { id: 'f2', line: 'formation', name: '锥形突击', pos: 2,
    description: '尖头锥形中央突破，解锁【锥形阵】，骑兵突击凌厉。',
    requires: ['f1'], effect: { unlockFormation: 'zhuixing' } },
  { id: 'f3', line: 'formation', name: '钩形迂回', pos: 3,
    description: '两翼如钩侧后包抄，解锁【钩形阵】，弓兵迂回射杀。',
    requires: ['f2'], effect: { unlockFormation: 'gouxing' } },
  { id: 'f4', line: 'formation', name: '玄惑诈敌', pos: 4,
    description: '多设旗鼓烟尘，虚实惑敌，解锁【玄襄阵】，敌方命中-15%。',
    requires: ['f3'], effect: { unlockFormation: 'xuanxiang' } },
  { id: 'f5', line: 'formation', name: '握奇正合', pos: 5,
    description: '《握奇经》余奇为握机，解锁【握机阵】，阵型升级上限提至5级。',
    requires: ['f4'], effect: { unlockFormation: 'woji', formationMaxLevel: 5 } },
  { id: 'f6', line: 'formation', name: '八阵图', pos: 6,
    description: '武侯八阵：天地风云龙虎鸟蛇相依，解锁终极【八卦阵】，全兵种+15%。',
    requires: ['f5'], effect: { unlockFormation: 'bagua' } }
];

// 派生：费用 / 回合数写入每条
for (const t of TECHS) {
  t.cost = costOf(t.pos);
  t.researchTurns = turnsOf(t.pos);
}

export function getTech(techId) {
  return TECHS.find(t => t.id === techId) || null;
}

// 某势力已研究科技集合 → 汇总 effect 加成
// researched: [techId]
export function aggregateTechEffects(researched) {
  const bag = {};
  const seen = new Set(researched);
  for (const id of seen) {
    const t = getTech(id);
    if (!t) continue;
    for (const [k, v] of Object.entries(t.effect)) {
      bag[k] = (bag[k] || 0) + v;
    }
  }
  return bag;
}

// 判断科技是否可研究：前置全部满足、未研究、未在研究中
export function isTechAvailable(techId, researched, researchingId) {
  const t = getTech(techId);
  if (!t) return false;
  if (researched.includes(techId)) return false;
  if (researchingId) return false;
  return t.requires.every(r => researched.includes(r));
}

// 组装供 UI 展示的科技树
export function getTechTreeData(researched, researchingId) {
  const lines = {};
  for (const t of TECHS) {
    if (!lines[t.line]) lines[t.line] = { ...TECH_LINES[t.line], techs: [] };
    const done = researched.includes(t.id);
    lines[t.line].techs.push({
      ...t,
      researched: done,
      researching: researchingId === t.id,
      available: isTechAvailable(t.id, researched, researchingId)
    });
  }
  return lines;
}
