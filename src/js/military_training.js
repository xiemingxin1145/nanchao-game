// ============================================================
// military_training.js — V23.0.0 军事系统深化
// （训练 / 军团整编 / 军衔体系 / 军功爵制 / 兵法研习 / 装备锻造深化 / 军功簿）
//
// 设计考据：
//  南北朝行府兵制，兵农合一，番上宿卫、平时为农、战时出征。
//  军中有「卒长—校尉—中郎将—将军—大将军」之层级；
//  军功爵承秦汉二十等爵，斩甲首一级赐爵一级，爵高者食邑/俸禄益厚；
//  兵学有《孙子》《吴子》《六韬》《三略》武经七书之半。
//
// 与既有系统关系：
//  - army.js 已有 unitTier（兵种 0~2 阶）与 formationExp；本系统在此之外叠加
//    「士兵训练等级 1~10」，专注经验与士气养成，不改 army.js 模型。
//  - legion.js 已有军团编制（≤5 军）；本系统提供「整编」操作，提升协同作战。
//  - general.js 已有 level/loyalty；本系统叠加「军衔」与「军功爵」两条独立晋升线。
//  - equipment.js 已有品质锻造；本系统提供「强化路线」（+1~+10）。
//
// 数值平衡约定（可复算）：
//  - 训练每级士气 +1%、经验加成 +2%，10 级满训合计士气 +10%、经验 +20%，
//    远低于 army.js clampBonus(±100%) 上限。
//  - 军衔/爵位/兵法加成均为「效果袋」，与 skills/tech/equipment 同语义，
//    最终经 army.js clampBonus 封顶。
//  - 训练/整编/强化费用随等级线性递增，与既有内政消耗同量级。
//
// 状态约定（挂在 game.militaryTraining，未挂载时成就/结局防御式读取空值）：
//   this.trainingLevels   { armyId: 1..10 }      士兵训练等级
//   this.ranks            { generalId: 0..4 }     武将军衔阶
//   this.merit            { generalId: 军功点 }   军功累计
//   this.kills            { generalId: 杀敌数 }   军功簿·斩首
//   this.studiedArts      { generalId: [bookId] } 兵法研习
//   this.enhanced         { equipKey: {slot, lv} } 装备强化
//   this.reorganized      { legionId: 整编次数 }   军团整编
//   this.v23_stats        全局统计（成就/结局读取）
// ============================================================

// ---------- 士兵训练等级 ----------
export const V23_TRAINING_MIN = 1;
export const V23_TRAINING_MAX = 10;

// 训练到 level 级所需费用（从 level-1 升到 level）
// 公式：金 = 150*level，粮 = 250*level；1→10 累计约 8250 金、13750 粮
export function v23TrainingCost(toLevel) {
  return { money: 150 * toLevel, food: 250 * toLevel };
}

// 训练等级 → 效果袋：士气每级 +1%，经验获取每级 +2%
export function v23TrainingBag(level) {
  const lv = Math.max(0, Math.min(V23_TRAINING_MAX, level || 0));
  return {
    moraleMod: lv * 0.01,        // 作战士气 +lv%
    expMult: 1 + lv * 0.02       // 经验获取倍率
  };
}

// ---------- 武将军衔（5 阶）----------
// commandRange：可指挥的同军团协同军数（影响军团会战协同）
export const V23_RANKS = [
  { id: 'zuliang',       name: '卒长',     minCommand: 0,  moraleMod: 0.00, commandRange: 1, salary: 0 },
  { id: 'xiaowei',       name: '校尉',     minCommand: 30, moraleMod: 0.03, commandRange: 2, salary: 200 },
  { id: 'zhonglangjiang',name: '中郎将',   minCommand: 50, moraleMod: 0.06, commandRange: 3, salary: 500 },
  { id: 'jiangjun',      name: '将军',     minCommand: 70, moraleMod: 0.10, commandRange: 4, salary: 1000 },
  { id: 'dajiangjun',    name: '大将军',   minCommand: 88, moraleMod: 0.15, commandRange: 6, salary: 2000 }
];

export const V23_MAX_RANK = V23_RANKS.length - 1; // 4 = 大将军

export function v23GetRank(idx) {
  return V23_RANKS[Math.max(0, Math.min(V23_MAX_RANK, idx || 0))];
}

// 依统率与军功推荐应授衔阶（取统率门槛达标者中的最高阶）
export function v23SuggestRank(general) {
  const cmd = general.effCommand != null ? general.effCommand : (general.command || 0);
  let idx = 0;
  for (let i = 0; i < V23_RANKS.length; i++) {
    if (cmd >= V23_RANKS[i].minCommand) idx = i;
  }
  return idx;
}

// ---------- 军功爵制（6 等爵）----------
// 爵位越高，俸禄（每回合俸禄加成）与封地（民心加成）越厚
export const V23_NOBILITY = [
  { id: 'gongshi',     name: '公士',   need: 0,    stipend: 100,  fiefMorale: 0 },
  { id: 'shangzao',    name: '上造',   need: 200,  stipend: 300,  fiefMorale: 2 },
  { id: 'bugeng',      name: '不更',   need: 600,  stipend: 600,  fiefMorale: 4 },
  { id: 'zuoshuchang', name: '左庶长', need: 1500, stipend: 1200, fiefMorale: 7 },
  { id: 'daliangzao',  name: '大良造', need: 3500, stipend: 2500, fiefMorale: 12 },
  { id: 'chehou',      name: '彻侯',   need: 8000, stipend: 5000, fiefMorale: 20 }
];

export const V23_MAX_NOBILITY = V23_NOBILITY.length - 1;

export function v23GetNobility(idx) {
  return V23_NOBILITY[Math.max(0, Math.min(V23_MAX_NOBILITY, idx || 0))];
}

// 由军功点数推应得爵位阶
export function v23NobilityByMerit(merit) {
  let idx = 0;
  for (let i = 0; i < V23_NOBILITY.length; i++) {
    if ((merit || 0) >= V23_NOBILITY[i].need) idx = i;
  }
  return idx;
}

// ---------- 兵法研习（4 部）----------
export const V23_BINGFA = [
  { id: 'sunzi', name: '孙子兵法', cost: 800,
    bonus: { allUnitMult: 0.08 },
    description: '兵者诡道，全军攻击+8%。' },
  { id: 'wuzi', name: '吴子兵法', cost: 800,
    bonus: { defenseMult: 0.10, moralePerTurn: 5 },
    description: '吴子贵治，防御+10%，每回合士气+5。' },
  { id: 'liutao', name: '六韬', cost: 1000,
    bonus: { cavalryMult: 0.12, commandRange: 1 },
    description: '太公六韬，骑兵+12%，指挥范围+1。' },
  { id: 'sanlue', name: '三略', cost: 1000,
    bonus: { strategyMult: 0.10, intel: 8 },
    description: '黄石公三略，计谋+10%，智力+8。' }
];

export function v23GetBingfa(bookId) {
  return V23_BINGFA.find(b => b.id === bookId) || null;
}

// ---------- 装备锻造深化（强化路线 +1~+10）----------
// 在 equipment.js 既有品质之上，对单件装备再做「强化」
// 路线：武器 / 防具(护甲) / 战马(坐骑)
export const V23_ENHANCE_ROUTES = {
  weapon: { name: '武器', perLevel: { force: 1, attackMult: 0.02 }, max: 10 },
  armor:  { name: '防具', perLevel: { defenseMult: 0.02, troopMax: 50 }, max: 10 },
  mount:  { name: '战马', perLevel: { moveSpeed: 0.2, cavalryMult: 0.02 }, max: 10 }
};

// 强化到 lv 级费用（从 lv-1 → lv）：金 = 300*lv
export function v23EnhanceCost(toLevel) {
  return { money: 300 * toLevel };
}

// 「极品装备」判定：强化等级 ≥ 8（+8 及以上）
export const V23_FORGE_TOP_TIER = 8;

// ---------- 军团整编 ----------
// 整编费用与效果：消耗金粮，提升军团协同（cohesion）
// cohesion 作用于军团会战：每级 +3% 协同，最多 5 级（15%）
export const V23_REORG_COST = { money: 1000, food: 1500 };
export const V23_REORG_MAX = 5;
export const V23_REORG_SYNERGY = 0.03; // 每级协同 +3%

// ============================================================
// 军事训练系统
// ============================================================
export class MilitaryTrainingSystem {
  constructor() {
    // ---- 士兵训练 ----
    this.trainingLevels = {};     // { armyId: 1..10 }
    // ---- 军衔 ----
    this.ranks = {};              // { generalId: 0..4 }
    // ---- 军功 / 军功簿 ----
    this.merit = {};              // { generalId: 军功点 }
    this.kills = {};              // { generalId: 斩首数 }
    this.nobility = {};           // { generalId: 爵位阶 0..5 }
    // ---- 兵法研习 ----
    this.studiedArts = {};        // { generalId: [bookId,...] }
    // ---- 装备锻造深化 ----
    this.enhanced = {};           // { equipKey: { slot, lv } }
    // ---- 军团整编 ----
    this.reorganized = {};        // { legionId: 整编次数 0..5 }

    // ---- V23 全局统计（成就/结局读取）----
    this.v23_stats = {
      trainingsDone: 0,        // 累计训练次数
      maxTrainingLevel: 0,      // 达到过的最高单军训练等级
      maxRank: 0,               // 麾下达到过的最高军衔阶
      maxNobility: 0,           // 麾下达到过的最高爵位阶
      maxMerit: 0,              // 麾下单人最高军功
      reorganizes: 0,           // 累计整编次数
      rankPromotions: 0,        // 军衔晋升次数
      nobilityGrants: 0,        // 赐爵次数
      artsStudied: 0,           // 兵法研习人次
      enhanceCount: 0,          // 装备强化次数
      topTierForged: 0,         // 极品(+8及以上)装备件数
      totalMerit: 0,            // 全势力累计军功
      battlesLogged: 0          // 记功战斗场次
    };
  }

  // ---------- 资源辅助（防御式） ----------
  _spend(game, cost) {
    try {
      if (game.addPlayerResource) {
        const res = game.getPlayerRes ? game.getPlayerRes() : {};
        if ((res.money || 0) < (cost.money || 0)) return false;
        if ((res.food || 0) < (cost.food || 0)) return false;
        if (cost.money) game.addPlayerResource('money', -cost.money);
        if (cost.food) game.addPlayerResource('food', -cost.food);
        return true;
      }
      if (game.factionRes) {
        const r = game.factionRes.get(game.playerFaction);
        if ((r.money || 0) < (cost.money || 0)) return false;
        if ((r.food || 0) < (cost.food || 0)) return false;
        r.money -= (cost.money || 0);
        r.food -= (cost.food || 0);
        return true;
      }
    } catch (e) { /* 资源接口缺失仍允许演练 */ }
    return true;
  }

  // ---------- 1. 训练系统 ----------
  // 对某支部队进行一次训练：训练等级 +1（≤10），消耗金粮，提升经验与士气
  trainArmy(game, armyId) {
    const cur = this.trainingLevels[armyId] || V23_TRAINING_MIN;
    if (cur >= V23_TRAINING_MAX) return { ok: false, msg: '该部已达满训（10 级）' };
    const toLevel = cur + 1;
    const cost = v23TrainingCost(toLevel);
    if (!this._spend(game, cost)) return { ok: false, msg: '金粮不足，无法训练' };
    this.trainingLevels[armyId] = toLevel;
    this.v23_stats.trainingsDone++;
    if (toLevel > this.v23_stats.maxTrainingLevel) this.v23_stats.maxTrainingLevel = toLevel;
    const bag = v23TrainingBag(toLevel);
    try {
      game.pushLog && game.pushLog(`🏋️ 训练【${armyId}】至 ${toLevel} 级，士气+${Math.round(bag.moraleMod * 100)}%。`);
    } catch (e) {}
    return { ok: true, msg: `训练至 ${toLevel} 级`, level: toLevel, bag };
  }

  getTrainingLevel(armyId) { return this.trainingLevels[armyId] || V23_TRAINING_MIN; }

  // 己方所有部队平均训练等级（成就/结局用）
  avgTrainingLevel(game) {
    try {
      const armies = game.getFactionArmies ? game.getFactionArmies(game.playerFaction) : (game.armies || []);
      const mine = armies.filter(a => a.faction === game.playerFaction);
      if (!mine.length) return 0;
      return mine.reduce((s, a) => s + this.getTrainingLevel(a.id), 0) / mine.length;
    } catch (e) { return 0; }
  }

  // ---------- 2. 军团整编 ----------
  // 对一个军团整编：提升协同等级（≤5），消耗金粮，提升军团质量
  reorganizeLegion(game, legionId) {
    const cur = this.reorganized[legionId] || 0;
    if (cur >= V23_REORG_MAX) return { ok: false, msg: '该军团整编已臻化境（5 级）' };
    if (!this._spend(game, V23_REORG_COST)) return { ok: false, msg: '金粮不足，无法整编' };
    this.reorganized[legionId] = cur + 1;
    this.v23_stats.reorganizes++;
    const synergy = (cur + 1) * V23_REORG_SYNERGY;
    try {
      game.pushLog && game.pushLog(`🎖️ 整编【${legionId}】，协同作战 +${Math.round(synergy * 100)}%。`);
    } catch (e) {}
    return { ok: true, msg: `整编完成，协同 +${Math.round(synergy * 100)}%`, level: cur + 1, synergy };
  }

  getReorgLevel(legionId) { return this.reorganized[legionId] || 0; }
  getReorgSynergy(legionId) { return (this.reorganized[legionId] || 0) * V23_REORG_SYNERGY; }

  // ---------- 3. 军衔体系 ----------
  // 依统率授衔（自动晋升），已授更高则不降级
  promoteRank(game, generalId) {
    const gen = game.generals ? game.generals.get(generalId) : null;
    if (!gen) return { ok: false, msg: '武将不存在' };
    const cur = this.ranks[generalId] || 0;
    const want = v23SuggestRank(gen);
    if (want <= cur) return { ok: false, msg: `已授至「${v23GetRank(cur).name}」，暂无可晋之阶` };
    this.ranks[generalId] = want;
    this.v23_stats.rankPromotions++;
    if (want > this.v23_stats.maxRank) this.v23_stats.maxRank = want;
    try {
      game.pushLog && game.pushLog(`🫡 【${gen.name}】晋衔为「${v23GetRank(want).name}」。`);
    } catch (e) {}
    return { ok: true, msg: `晋衔为「${v23GetRank(want).name}」`, rank: want };
  }

  getRank(generalId) { return this.ranks[generalId] || 0; }
  getRankName(generalId) { return v23GetRank(this.ranks[generalId]).name; }

  // 军衔给部队的士气/指挥范围修正袋
  getRankBag(generalId) {
    const r = v23GetRank(this.ranks[generalId]);
    return { moraleMod: r.moraleMod, commandRange: r.commandRange, salary: r.salary };
  }

  // ---------- 4. 军功爵制 ----------
  // 记一次战功：斩首 kills 折算军功，自动晋爵
  addMerit(generalId, kills) {
    kills = Math.max(0, Math.round(kills || 0));
    if (!kills) return { ok: true, msg: '无斩首', merit: this.merit[generalId] || 0 };
    this.merit[generalId] = (this.merit[generalId] || 0) + kills;
    this.kills[generalId] = (this.kills[generalId] || 0) + kills;
    this.v23_stats.totalMerit += kills;
    if (this.merit[generalId] > this.v23_stats.maxMerit) {
      this.v23_stats.maxMerit = this.merit[generalId];
    }
    // 自动晋爵
    const curNob = this.nobility[generalId] || 0;
    const wantNob = v23NobilityByMerit(this.merit[generalId]);
    if (wantNob > curNob) {
      this.nobility[generalId] = wantNob;
      this.v23_stats.nobilityGrants++;
      if (wantNob > this.v23_stats.maxNobility) this.v23_stats.maxNobility = wantNob;
      return { ok: true, msg: `军功晋爵为「${v23GetNobility(wantNob).name}」`, merit: this.merit[generalId], nobility: wantNob };
    }
    return { ok: true, msg: `累计军功 ${this.merit[generalId]}`, merit: this.merit[generalId], nobility: curNob };
  }

  getNobility(generalId) { return this.nobility[generalId] || 0; }
  getNobilityName(generalId) { return v23GetNobility(this.nobility[generalId]).name; }
  getMerit(generalId) { return this.merit[generalId] || 0; }
  getKills(generalId) { return this.kills[generalId] || 0; }

  // 爵位俸禄/封地加成袋
  getNobilityBag(generalId) {
    const n = v23GetNobility(this.nobility[generalId]);
    return { stipend: n.stipend, fiefMorale: n.fiefMorale };
  }

  // ---------- 5. 兵法研习 ----------
  studyArt(game, generalId, bookId) {
    const book = v23GetBingfa(bookId);
    if (!book) return { ok: false, msg: '兵书不存在' };
    const owned = this.studiedArts[generalId] || (this.studiedArts[generalId] = []);
    if (owned.includes(bookId)) return { ok: false, msg: '已研习过该兵法' };
    if (!this._spend(game, { money: book.cost, food: 0 })) return { ok: false, msg: '金钱不足，无法研习' };
    owned.push(bookId);
    this.v23_stats.artsStudied++;
    try {
      const gen = game.generals ? game.generals.get(generalId) : null;
      game.pushLog && game.pushLog(`📖 【${gen ? gen.name : generalId}】研习《${book.name}》：${book.description}`);
    } catch (e) {}
    return { ok: true, msg: `研习《${book.name}》`, book, bonus: book.bonus };
  }

  getStudiedArts(generalId) { return this.studiedArts[generalId] || []; }
  hasAllArts(generalId) { return V23_BINGFA.every(b => (this.studiedArts[generalId] || []).includes(b.id)); }

  // 该武将研习兵法的加成袋
  getArtBag(generalId) {
    const bag = {};
    for (const id of (this.studiedArts[generalId] || [])) {
      const book = v23GetBingfa(id);
      if (!book) continue;
      for (const [k, v] of Object.entries(book.bonus || {})) {
        bag[k] = (bag[k] || 0) + v;
      }
    }
    return bag;
  }

  // ---------- 6. 装备锻造深化（强化）----------
  // equipKey：唯一标识一件已强化装备（建议 generalId+slot）
  enhanceEquip(game, equipKey, slot) {
    const route = V23_ENHANCE_ROUTES[slot];
    if (!route) return { ok: false, msg: '该槽位无强化路线' };
    const cur = (this.enhanced[equipKey] && this.enhanced[equipKey].lv) || 0;
    if (cur >= route.max) return { ok: false, msg: '该装备已强化至极限' };
    const toLevel = cur + 1;
    const cost = v23EnhanceCost(toLevel);
    if (!this._spend(game, cost)) return { ok: false, msg: '金钱不足，无法强化' };
    const wasTop = cur >= V23_FORGE_TOP_TIER;
    this.enhanced[equipKey] = { slot, lv: toLevel };
    this.v23_stats.enhanceCount++;
    if (!wasTop && toLevel >= V23_FORGE_TOP_TIER) this.v23_stats.topTierForged++;
    try {
      game.pushLog && game.pushLog(`🔨 强化【${route.name}】至 +${toLevel}。`);
    } catch (e) {}
    return { ok: true, msg: `强化至 +${toLevel}`, lv: toLevel, stats: route.perLevel };
  }

  getEnhanceLevel(equipKey) { return (this.enhanced[equipKey] && this.enhanced[equipKey].lv) || 0; }

  // 单件强化后的追加属性袋
  getEnhanceBag(equipKey) {
    const rec = this.enhanced[equipKey];
    if (!rec) return {};
    const route = V23_ENHANCE_ROUTES[rec.slot];
    const bag = {};
    for (const [k, v] of Object.entries(route.perLevel || {})) {
      bag[k] = (bag[k] || 0) + v * rec.lv;
    }
    return bag;
  }

  // ---------- 7. 军功簿（战斗记功）----------
  // 战后调用：胜方主将记斩首战功，自动触发军衔建议与晋爵
  recordBattle(game, winnerGeneralId, enemyKills) {
    if (!winnerGeneralId) return { ok: false };
    this.v23_stats.battlesLogged++;
    const res = this.addMerit(winnerGeneralId, enemyKills);
    // 记功后尝试依统率晋衔
    this.promoteRank(game, winnerGeneralId);
    return res;
  }

  // ---------- 汇总查询（成就/结局用）----------
  // 麾下是否有任一武将达到某军衔阶
  hasGeneralAtRank(generalIds, rankIdx) {
    return (generalIds || []).some(gid => (this.ranks[gid] || 0) >= rankIdx);
  }
  // 麾下研习全部四本书法的武将数
  countFullArtists(generalIds) {
    return (generalIds || []).filter(gid => this.hasAllArts(gid)).length;
  }
  // 麾下最高军衔阶
  maxRankOf(generalIds) {
    return (generalIds || []).reduce((m, gid) => Math.max(m, this.ranks[gid] || 0), 0);
  }
  // 麾下最高爵位阶
  maxNobilityOf(generalIds) {
    return (generalIds || []).reduce((m, gid) => Math.max(m, this.nobility[gid] || 0), 0);
  }
  // 单人最高军功
  topMeritOf(generalIds) {
    return (generalIds || []).reduce((m, gid) => Math.max(m, this.merit[gid] || 0), 0);
  }

  // ---------- 序列化 ----------
  serialize() {
    return {
      trainingLevels: this.trainingLevels,
      ranks: this.ranks, merit: this.merit, kills: this.kills, nobility: this.nobility,
      studiedArts: this.studiedArts, enhanced: this.enhanced, reorganized: this.reorganized,
      v23_stats: this.v23_stats
    };
  }

  static deserialize(data) {
    const s = new MilitaryTrainingSystem();
    if (!data) return s;
    s.trainingLevels = data.trainingLevels || {};
    s.ranks = data.ranks || {};
    s.merit = data.merit || {};
    s.kills = data.kills || {};
    s.nobility = data.nobility || {};
    s.studiedArts = data.studiedArts || {};
    s.enhanced = data.enhanced || {};
    s.reorganized = data.reorganized || {};
    s.v23_stats = Object.assign(s.v23_stats, data.v23_stats || {});
    return s;
  }
}

// ============================================================
// 独立函数式 API（接受 game 上下文，便于 UI/外部调用）
// ============================================================

/** 取系统实例（缺失返回 null，调用方防御式处理） */
export function v23GetSystem(game) {
  try { return game.militaryTraining || null; } catch (e) { return null; }
}

/** 训练某部队 */
export function v23TrainArmy(game, armyId) {
  const s = v23GetSystem(game);
  return s ? s.trainArmy(game, armyId) : { ok: false, msg: '军事训练系统未初始化' };
}

/** 整编某军团 */
export function v23ReorganizeLegion(game, legionId) {
  const s = v23GetSystem(game);
  return s ? s.reorganizeLegion(game, legionId) : { ok: false, msg: '军事训练系统未初始化' };
}

/** 战后记功 */
export function v23RecordBattle(game, winnerGeneralId, enemyKills) {
  const s = v23GetSystem(game);
  return s ? s.recordBattle(game, winnerGeneralId, enemyKills) : { ok: false };
}
