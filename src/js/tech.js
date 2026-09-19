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
  formation:{ id: 'formation', name: '阵法', color: '#6B3FA0' },
  // V19.0：文化分支（科举/均田/府兵/租调等文治教化）
  culture:  { id: 'culture',  name: '文化', color: '#8E44AD' }
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
    requires: ['f5'], effect: { unlockFormation: 'bagua' } },

  // ===================== V19.0 军事线深化（6 个 v19_） =====================
  // 历史：南北朝重甲、强弩、楼船、火器渐兴。pos 7~12 表示高阶科技，费用/回合递增。
  { id: 'v19_tiejia', line: 'military', name: '铁甲锻造', pos: 7,
    description: '百炼钢甲，坚不可摧，步兵战力+15%。',
    requires: ['m3'], effect: { infantryMult: 0.15 } },
  { id: 'v19_makai', line: 'military', name: '马铠具装', pos: 7,
    description: '马铠半身，甲骑护身，骑兵战力+15%。',
    requires: ['m1'], effect: { cavalryMult: 0.15 } },
  { id: 'v19_zhandao', line: 'military', name: '斩马利刀', pos: 8,
    description: '斩马长刀，步卒破骑，步兵战力再+10%。',
    requires: ['v19_tiejia'], effect: { infantryMult: 0.10 } },
  { id: 'v19_yunti', line: 'military', name: '云梯冲车', pos: 8,
    description: '云梯临城，冲车撞门，攻城战力+15%。',
    requires: ['m4'], effect: { siegeMult: 0.15 } },
  { id: 'v19_louchuan', line: 'military', name: '楼船水寨', pos: 9,
    description: '楼船楼橹，水寨横江，水军战力+20%。',
    requires: ['m4'], effect: { navyMult: 0.20 } },
  { id: 'v19_shenhuo', line: 'military', name: '神火飞鸦', pos: 10,
    description: '火药飞鸦，焚舟烧营，弓兵远程战力+20%。',
    requires: ['m5'], effect: { archerMult: 0.20 } },

  // ===================== V19.0 经济线深化（6 个 v19_） =====================
  { id: 'v19_quyuan', line: 'economy', name: '曲辕犁', pos: 7,
    description: '曲辕便耕，牛力增效，农业产出+15%。',
    requires: ['e1'], effect: { foodMult: 0.15 } },
  { id: 'v19_shuiche', line: 'economy', name: '水车灌溉', pos: 8,
    description: '翻车筒车，引水上田，农业再+10%、旱灾影响-30%。',
    requires: ['e3'], effect: { foodMult: 0.10, disasterMult: -0.30 } },
  { id: 'v19_caoyun', line: 'economy', name: '漕运贯通', pos: 9,
    description: '汴河漕船，转输千里，粮食调度效率+20%。',
    requires: ['e3'], effect: { foodTransportMult: 0.20 } },
  { id: 'v19_zuyongdiao', line: 'economy', name: '租庸调制', pos: 8,
    description: '有田则租，有身则庸，有家则调，税收+15%。',
    requires: ['e2'], effect: { incomeMult: 0.15 } },
  { id: 'v19_shibosi', line: 'economy', name: '市舶司', pos: 9,
    description: '市舶理货，南海辐辏，商业收入+15%。',
    requires: ['e4'], effect: { commMult: 0.15 } },
  { id: 'v19_duanshu', line: 'economy', name: '新钱铸币', pos: 10,
    description: '五铢新铸，权衡齐一，金钱收入再+10%。',
    requires: ['e5'], effect: { incomeMult: 0.10 } },

  // ===================== V19.0 文化线（6 个 v19_） =====================
  // 文治教化：均田→租调/府兵→科举→国子监→正音
  { id: 'v19_juntian', line: 'culture', name: '均田令', pos: 7,
    description: '计口授田，黎元乐业，民心+15、农业+5%。',
    requires: [], effect: { moraleFlat: 15, foodMult: 0.05 } },
  { id: 'v19_zutiao', line: 'culture', name: '租调制', pos: 8,
    description: '轻租薄调，藏富于民，税收+10%、民心+10。',
    requires: ['v19_juntian'], effect: { incomeMult: 0.10, moraleFlat: 10 } },
  { id: 'v19_fubing', line: 'culture', name: '府兵制', pos: 8,
    description: '兵农合一，番上宿卫，征兵费用-20%。',
    requires: ['v19_juntian'], effect: { recruitCostMult: -0.20 } },
  { id: 'v19_keju', line: 'culture', name: '科举制', pos: 9,
    description: '开科取士，寒门进阶，在野武将招募成功率+30%。',
    requires: ['v19_zutiao'], effect: { recruitBonus: 0.30 } },
  { id: 'v19_guoxue', line: 'culture', name: '国子监', pos: 10,
    description: '太学育人，儒林彬彬，文化积累速度+20%。',
    requires: ['v19_keju'], effect: { cultureMult: 0.20 } },
  { id: 'v19_zhengyin', line: 'culture', name: '正音定字', pos: 11,
    description: '厘正音韵，刊定文字，文化传播范围+20%。',
    requires: ['v19_guoxue'], effect: { cultureSpreadMult: 0.20 } }
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

// ============================================================
// V19.0 科技树深化：TechSystem 运行时封装
// ------------------------------------------------------------
// 职责：维护「已研究集合 + 正在研究」状态，提供更高层 API：
//   - getTechTree()            当前势力完整科技树（含可用/在研/已研究）
//   - canResearch(techId)      是否可研究（前置满足、未研究、未在研）
//   - research(techId)         开始研究；研究时间随已研究数量递增
//   - getTechBonus(techId)     读取某科技的 effect 加成对象
// 与 game.js 现有 researchTech/getTechTree/getTechBonus 方法解耦，
// 供 UI / 脚本 / AI 直接调用，不改动既有函数签名。
// ============================================================

// 研究时间随已研究科技数量递增：每已研究 4 个科技，新研究多耗 1 回合
// baseTurns 为该科技自身的 researchTurns
export function v19ResearchTurns(baseTurns, researchedCount) {
  return (baseTurns || 2) + Math.floor((researchedCount || 0) / 4);
}

export class TechSystem {
  constructor() {
    this.researched = [];      // [techId]
    this.researching = null;   // { techId, turnsLeft, totalTurns }
  }

  // 当前势力完整科技树
  getTechTree() {
    return getTechTreeData(this.researched,
      this.researching ? this.researching.techId : null);
  }

  // 是否可研究
  canResearch(techId) {
    return isTechAvailable(techId, this.researched,
      this.researching ? this.researching.techId : null);
  }

  // 开始研究；返回 { ok, msg, turns? }
  research(techId) {
    if (this.researching) return { ok: false, msg: '正在研究另一项科技，请等待完成' };
    const t = getTech(techId);
    if (!t) return { ok: false, msg: '科技不存在' };
    if (this.researched.includes(techId)) return { ok: false, msg: '已研究' };
    if (!this.canResearch(techId)) return { ok: false, msg: '前置科技未满足' };
    // 研究时间随已研究数量递增
    const turns = v19ResearchTurns(t.researchTurns, this.researched.length);
    this.researching = { techId, turnsLeft: turns, totalTurns: turns };
    return { ok: true, msg: `开始研究 ${t.name}`, turns };
  }

  // 读取某科技效果加成（未研究也可读，供 UI 预览）
  getTechBonus(techId) {
    const t = getTech(techId);
    if (!t) return {};
    return { ...t.effect };
  }

  // 推进一回合研究；完成时返回新研究的 techId，否则 null
  tick() {
    if (!this.researching) return null;
    this.researching.turnsLeft--;
    if (this.researching.turnsLeft <= 0) {
      const id = this.researching.techId;
      this.researched.push(id);
      this.researching = null;
      return id;
    }
    return null;
  }

  serialize() {
    return { researched: this.researched, researching: this.researching };
  }

  static deserialize(data) {
    const s = new TechSystem();
    if (data) {
      s.researched = Array.isArray(data.researched) ? data.researched.slice() : [];
      s.researching = data.researching || null;
    }
    return s;
  }
}

// V19.0：返回全部 v19_ 前缀科技 id（供成就/结局统计）
export const V19_TECH_IDS = TECHS.filter(t => t.id.startsWith('v19_')).map(t => t.id);

// V19.0：判断某 v19_ 科技线是否已全部研究
// line: 'military' | 'economy' | 'culture'
export function isV19LineComplete(line, researched) {
  const set = new Set(researched);
  const ids = TECHS.filter(t => t.id.startsWith('v19_') && t.line === line).map(t => t.id);
  return ids.length > 0 && ids.every(id => set.has(id));
}
