// ============================================================
// diplomacy.js — 外交系统（V15.0 系统深化版）
// V2.5：联姻系统、人质系统
// V15.0：新增五级关系数值化（友好/中立/紧张/敌对/战争），
//   新增 6 项外交行动：和亲、质子交换、联合讨伐、贸易协定、
//   军事通行、策反（强化）。新增对应 API。
// ============================================================
import { FACTIONS, MARRIAGE_REL_BONUS, MARRIAGE_BREAK_REL_PENALTY,
         HOSTAGE_RANSOM_COST, HOSTAGE_RECALL_REL_MIN } from './data.js';
// V18.0：AI 智能深化——战略规划器（均势/威胁评估）
import { strategyPlanner } from './ai_strategy.js';

// V15.0：外交关系五级定义（基于 relation 数值 -100~100 映射）
export const RELATION_LEVELS = [
  { id: 'war',      name: '战争', min: -100, max: -80, tradeMod: -0.5, intelMod: 0.2  },
  { id: 'hostile',  name: '敌对', min: -80,  max: -40, tradeMod: -0.3, intelMod: 0.1  },
  { id: 'tense',    name: '紧张', min: -40,  max: 0,   tradeMod: -0.1, intelMod: 0.05 },
  { id: 'neutral',  name: '中立', min: 0,    max: 40,  tradeMod: 0,    intelMod: 0    },
  { id: 'friendly', name: '友好', min: 40,   max: 100, tradeMod: 0.1,  intelMod: -0.05 }
];

let marriageCounter = 0;
let hostageCounter = 0;
let coalitionCounter = 0;

export class DiplomacySystem {
  constructor() {
    // relations: { "fid1_fid2": { relation: -100~100, alliance: false, ceasefire: false } }
    this.relations = {};
    const fids = Object.keys(FACTIONS);
    for (let i = 0; i < fids.length; i++) {
      for (let j = i + 1; j < fids.length; j++) {
        const key = this._key(fids[i], fids[j]);
        this.relations[key] = { relation: 0, alliance: false, ceasefire: false };
      }
    }
    // V24.0.0：外交同盟系统深化
    this.v24_treaties = {};       // 条约体系 { key: { type, expires, active } }
    this.v24_vassals = {};        // 附庸国 { vassalFid: { suzerainFid, tribute, sinceTurn } }
    this.v24_reputation = {};      // 外交声望 { factionId: -100~100 }
    this.v24_jointOperations = []; // 联军作战记录
    this.v24_stats = {           // 全局统计（成就/结局读取）
      alliancesSigned: 0,          // 结盟次数
      alliancesBroken: 0,          // 毁盟次数
      jointBattles: 0,             // 联军作战次数
      treatiesSigned: 0,           // 签订条约数
      vassalsAccepted: 0,          // 接受附庸数
      vassalTributes: 0,           // 附庸进贡次数
      hostageExchanges: 0,         // 人质交换次数
      maxReputation: 0,            // 最高外交声望
      minReputation: 0,            // 最低外交声望
      maxAllies: 0,                // 最多同盟数
      maxVassals: 0                // 最多附庸数
    };
  }

  _key(a, b) {
    return [a, b].sort().join('_');
  }

  getRelation(fid1, fid2) {
    return this.relations[this._key(fid1, fid2)];
  }

  // ============ 原有外交 ============
  // 结盟
  proposeAlliance(playerFid, targetFid) {
    const rel = this.getRelation(playerFid, targetFid);
    if (rel.alliance) return { ok: false, msg: '已为同盟' };
    rel.alliance = true;
    rel.relation = Math.min(100, rel.relation + 30);
    return { ok: true, msg: `与 ${FACTIONS[targetFid].name} 结成同盟！` };
  }

  // 停战
  proposeCeasefire(playerFid, targetFid) {
    const rel = this.getRelation(playerFid, targetFid);
    rel.ceasefire = true;
    rel.relation = Math.min(100, rel.relation + 10);
    return { ok: true, msg: `与 ${FACTIONS[targetFid].name} 达成停战` };
  }

  // 策反
  bribeGeneral(game, targetFid, generalId, cost) {
    const gen = game.generals.get(generalId);
    if (!gen || gen.faction !== targetFid) return { ok: false, msg: '目标不属该势力' };
    if (gen.loyalty > 40) return { ok: false, msg: '该武将忠诚较高，难以策反' };
    const res = game.getPlayerRes();
    if (res.money < cost) return { ok: false, msg: '金钱不足' };
    res.money -= cost;
    gen.faction = game.playerFaction;
    gen.loyalty = 60;
    // 从原城市撤出
    // BUG修复#9：防御性校验——都城城可能已被攻陷/摧毁（game.cities.get 返回 undefined），
    // 直接访问 .id 会导致 TypeError 崩溃。此处做空值兜底。
    const capital = game.cities.get(FACTIONS[game.playerFaction].capital);
    gen.location = capital ? capital.id : null;
    return { ok: true, msg: `${gen.name} 已被策反，投奔我方！` };
  }

  // 进贡
  payTribute(game, playerFid, targetFid, amount) {
    const res = game.getPlayerRes();
    if (res.money < amount) return { ok: false, msg: '金钱不足' };
    res.money -= amount;
    const rel = this.getRelation(playerFid, targetFid);
    rel.relation = Math.min(100, rel.relation + amount / 20);
    return { ok: true, msg: `向 ${FACTIONS[targetFid].name} 进贡 ${amount} 金，关系改善` };
  }

  // ============ V2.5 联姻系统 ============
  // 挑选某势力可联姻的未婚武将（君主/宗室优先，其次高政治）
  pickMarriagePartner(game, factionId) {
    const cands = game.getFactionGenerals(factionId).filter(g =>
      !g.married && !g.onHostage && !g.onMission && !g.inArmy
    );
    // 优先君主/宗室
    cands.sort((a, b) => {
      const aRoyal = (a.role === '君主' || /宗|文|武|帝/.test(a.role)) ? 1 : 0;
      const bRoyal = (b.role === '君主' || /宗|文|武|帝/.test(b.role)) ? 1 : 0;
      if (aRoyal !== bRoyal) return bRoyal - aRoyal;
      return b.loyalty - a.loyalty;
    });
    return cands[0] || null;
  }

  // 提议联姻：proposerFid 以 proposerGeneralId（己方武将）向 targetFid 提亲。
  // 条件：关系 > 0；双方各有一名未婚武将。
  proposeMarriage(game, proposerFid, targetFid, proposerGeneralId) {
    if (proposerFid === targetFid) return { ok: false, msg: '不能与本势力联姻' };
    const rel = this.getRelation(proposerFid, targetFid);
    if (!rel || rel.relation <= 0) return { ok: false, msg: '两国关系未睦，不宜联姻（需关系>0）' };
    if (this.getActiveMarriage(game, proposerFid, targetFid)) {
      return { ok: false, msg: '两国已为姻亲' };
    }
    const gen1 = game.generals.get(proposerGeneralId);
    if (!gen1 || gen1.faction !== proposerFid) return { ok: false, msg: '该武将不属我方' };
    if (gen1.married) return { ok: false, msg: '该武将已婚配' };
    const gen2 = this.pickMarriagePartner(game, targetFid);
    if (!gen2) return { ok: false, msg: '对方无未婚可联姻武将' };

    const marriage = {
      id: 'marr_' + (++marriageCounter),
      faction1: proposerFid, faction2: targetFid,
      general1: gen1.id, general2: gen2.id,
      turn: game.turn, active: false, pending: true
    };
    game.marriages.push(marriage);

    // AI 自动决定是否应允：关系 + 实力对比
    if (targetFid !== game.playerFaction) {
      let acceptProb = 0.35 + rel.relation / 200; // 关系越好越易应允
      // V18.0：实力外交——强国提亲弱国更易接受；弱国攀强国更积极
      try {
        const sp = strategyPlanner;
        const mePow = sp.getFactionStrength(proposerFid, game);
        const themPow = sp.getFactionStrength(targetFid, game);
        const ratio = themPow.military > 0 ? mePow.military / themPow.military : 1;
        if (ratio >= 1.5) acceptProb += 0.25;        // 我方（提亲方）显著更强 → 对方更易接受
        else if (ratio <= 0.6) acceptProb += 0.15;   // 对方更强 → 攀附亦易成
        // 恩怨扣分：刚被攻击过则拒婚
        const g = (rel.grievance || 0);
        if (g >= 30) acceptProb -= 0.30;
      } catch (e) {}
      acceptProb = Math.max(0.05, Math.min(0.95, acceptProb));
      if (Math.random() < acceptProb) {
        this.acceptMarriage(game, marriage.id);
        return { ok: true, msg: `${FACTIONS[targetFid].name} 欣然应允与 ${FACTIONS[proposerFid].name} 联姻！`, marriage };
      }
      game.marriages = game.marriages.filter(m => m.id !== marriage.id);
      return { ok: false, msg: `${FACTIONS[targetFid].name} 婉拒了联姻之请。` };
    }
    // AI 向玩家提亲时：挂起待玩家决定
    return { ok: true, msg: `${FACTIONS[targetFid].name} 遣使求亲！`, marriage };
  }

  getActiveMarriage(game, fid1, fid2) {
    return (game.marriages || []).find(m =>
      m.active &&
      ((m.faction1 === fid1 && m.faction2 === fid2) ||
       (m.faction1 === fid2 && m.faction2 === fid1))
    ) || null;
  }

  acceptMarriage(game, marriageId) {
    const m = (game.marriages || []).find(x => x.id === marriageId);
    if (!m || m.active) return { ok: false, msg: '联姻不存在或已生效' };
    const g1 = game.generals.get(m.general1);
    const g2 = game.generals.get(m.general2);
    if (!g1 || !g2) return { ok: false, msg: '联姻武将不在，婚事作罢' };
    m.active = true; m.pending = false;
    g1.married = g2.id; g2.married = g1.id;
    const rel = this.getRelation(m.faction1, m.faction2);
    rel.relation = Math.min(100, rel.relation + MARRIAGE_REL_BONUS);
    rel.ceasefire = true; // 姻亲=互不攻击概率+50%
    this.refreshMarriageBag(game);
    game.pushLog(`💍 两国联姻：${FACTIONS[m.faction1].name} ${g1.name} 与 ${FACTIONS[m.faction2].name} ${g2.name} 永结两姓之好！关系+${MARRIAGE_REL_BONUS}，互不攻伐，通商厚利（经济+10%）。`);
    return { ok: true, msg: '联姻成立！两国永结秦晋之好。' };
  }

  rejectMarriage(game, marriageId) {
    const m = (game.marriages || []).find(x => x.id === marriageId);
    if (!m) return { ok: false, msg: '联姻不存在' };
    game.marriages = game.marriages.filter(x => x.id !== marriageId);
    const rel = this.getRelation(m.faction1, m.faction2);
    rel.relation = Math.max(-100, rel.relation - 5);
    game.pushLog(`两国议亲不成，略有嫌隙。`);
    return { ok: true, msg: '已拒婚' };
  }

  // 经济加成：某势力每有一桩 active 联姻，收入 +10%（公式叠加）
  getMarriageIncomeMult(factionId) {
    return (this._cachedMarriageIncomeMult || {})[factionId] || 0;
  }
  refreshMarriageBag(game) {
    const bag = {};
    for (const m of (game.marriages || [])) {
      if (!m.active) continue;
      bag[m.faction1] = (bag[m.faction1] || 0) + 0.10;
      bag[m.faction2] = (bag[m.faction2] || 0) + 0.10;
    }
    this._cachedMarriageIncomeMult = bag;
  }

  // 背盟：一方对姻亲势力开战 → 联姻破裂，关系 -50，触发背盟事件
  onBetrayal(game, attackerFid, defenderFid) {
    let broken = false;
    game.marriages = (game.marriages || []).map(m => {
      if (!m.active) return m;
      const involved =
        (m.faction1 === attackerFid && m.faction2 === defenderFid) ||
        (m.faction1 === defenderFid && m.faction2 === attackerFid);
      if (involved) {
        broken = true;
        const g1 = game.generals.get(m.general1);
        const g2 = game.generals.get(m.general2);
        if (g1) g1.married = null;
        if (g2) g2.married = null;
        return { ...m, active: false, broken: true };
      }
      return m;
    });
    if (!broken) return;
    // BUG修复#12：防御性校验——getRelation 可能返回 null（异势力 pair 未初始化或存档缺失），
    // 直接访问 rel.relation 会导致 TypeError 崩溃。此处做空值兜底。
    const rel = this.getRelation(attackerFid, defenderFid);
    if (rel) {
      rel.relation = Math.max(-100, rel.relation - MARRIAGE_BREAK_REL_PENALTY);
      rel.ceasefire = false;
    }
    game.pushLog(`⚔ ${FACTIONS[attackerFid].name} 背盟弃好，两国姻亲之谊断绝！关系-${MARRIAGE_BREAK_REL_PENALTY}，天下共鄙之。`);
    game.pushLog('【背盟事件】背信弃义，人心尽失，各路诸侯咸有戒心。');
    this.refreshMarriageBag(game);
  }

  // ============ V2.5 人质系统 ============
  // 送人质：fromFid 派一名武将到 toFid 都城为质
  sendHostage(game, fromFid, toFid, generalId) {
    if (fromFid === toFid) return { ok: false, msg: '不能向本势力送人质' };
    const gen = game.generals.get(generalId);
    if (!gen || gen.faction !== fromFid) return { ok: false, msg: '该武将不属我方' };
    if (gen.inArmy) return { ok: false, msg: '该武将正在军中，不能为质' };
    if (gen.role === '君主') return { ok: false, msg: '君主不可为质' };
    // BUG修复#10：防御性校验——对方都城可能已被摧毁，game.cities.get 返回 undefined，
    // 直接访问 capital.id 会导致 TypeError 崩溃。此处做空值兜底。
    const capital = game.cities.get(FACTIONS[toFid].capital);
    if (!capital) return { ok: false, msg: '对方都城已失，无法为质' };
    const hostage = {
      id: 'host_' + (++hostageCounter),
      from: fromFid, to: toFid,
      generalId: gen.id, sinceTurn: game.turn
    };
    game.hostages.push(hostage);
    gen.onHostage = true;
    gen.location = capital.id;
    gen.loyalty = Math.min(100, gen.loyalty + 5);
    game.pushLog(`🕊 ${gen.name} 赴 ${FACTIONS[toFid].name} 为质，以固盟好。`);
    return { ok: true, msg: `${gen.name} 已入 ${FACTIONS[toFid].name} 都城为质`, hostage };
  }

  // 索回人质：关系≥60 免费；否则耗赎金
  recallHostage(game, factionId, hostageId) {
    const h = (game.hostages || []).find(x => x.id === hostageId);
    if (!h) return { ok: false, msg: '人质记录不存在' };
    if (h.from !== factionId) return { ok: false, msg: '该人质不属我方' };
    const gen = game.generals.get(h.generalId);
    const rel = this.getRelation(factionId, h.to);
    let cost = 0;
    if (rel.relation < HOSTAGE_RECALL_REL_MIN) {
      cost = HOSTAGE_RANSOM_COST;
      const res = game.factionRes.get(factionId);
      if (!res || res.money < cost) {
        return { ok: false, msg: `关系未睦，赎回需 ${cost} 金` };
      }
      res.money -= cost;
    }
    game.hostages = game.hostages.filter(x => x.id !== hostageId);
    if (gen) {
      gen.onHostage = false;
      // BUG修复#11：防御性校验——赎回方都城可能已被摧毁，game.cities.get 返回 undefined，
      // 直接访问 capital.id 会导致 TypeError 崩溃。此处做空值兜底。
      const capital = game.cities.get(FACTIONS[factionId].capital);
      gen.location = capital ? capital.id : null;
    }
    game.pushLog(`🏠 ${gen ? gen.name : '人质'} 自 ${FACTIONS[h.to].name} 赎回（耗 ${cost} 金）。`);
    return { ok: true, msg: `${gen ? gen.name : '人质'} 已赎回` };
  }

  // 撕毁盟约/开战时处置人质：50% 处决（武将死亡），50% 释放
  // V18.0：同时记录历史恩怨（grievance）——刚被攻击过的势力更难和解
  //   fid1=进攻方，fid2=防守方（由 game.attackCity 传入）
  onWarDeclared(game, fid1, fid2) {
    // ---- V18.0：恩怨系统 ----
    try {
      const rel = this.getRelation(fid2, fid1); // 防守方对进攻方
      if (rel) {
        rel.grievance = Math.min(100, (Number(rel.grievance) || 0) + 30);
        rel.lastAttackTurn = game.turn;
        rel.relation = Math.max(-100, (Number(rel.relation) || 0) - 10);
      }
    } catch (e) {}

    const survivors = [];
    for (const h of (game.hostages || [])) {
      const between =
        (h.from === fid1 && h.to === fid2) || (h.from === fid2 && h.to === fid1);
      if (!between) { survivors.push(h); continue; }
      const gen = game.generals.get(h.generalId);
      const executed = Math.random() < 0.5;
      if (executed && gen) {
        gen.faction = null; gen.inArmy = null; gen.location = null; gen.onHostage = false;
        game.pushLog(`🩸 两国交恶！在 ${FACTIONS[h.to].name} 为质的 ${gen.name} 被处决！`);
      } else if (gen) {
        gen.onHostage = false;
        const capital = game.cities.get(FACTIONS[h.from].capital);
        gen.location = capital ? capital.id : null;
        game.pushLog(`🏃 在 ${FACTIONS[h.to].name} 为质的 ${gen.name} 乘乱逃归本国。`);
      }
    }
    game.hostages = survivors;
  }

  // ============ V15.0 五级关系查询 ============
  // 根据 relation 数值返回当前关系等级对象
  getRelationLevel(fid1, fid2) {
    const rel = this.getRelation(fid1, fid2);
    if (!rel) return RELATION_LEVELS[3]; // 默认中立
    const v = rel.relation;
    for (const lv of RELATION_LEVELS) {
      if (v >= lv.min && v <= lv.max) return lv;
    }
    return RELATION_LEVELS[3];
  }

  // ============ V15.0 新增外交行动 ============

  // 1. 联姻和亲：将宗女嫁给对方君主/继承人（无需己方未婚武将）
  //    与既有 proposeMarriage（武将互婚）不同，和亲仅送宗女，关系+20
  proposeHeqin(game, factionA, factionB) {
    if (factionA === factionB) return { ok: false, msg: '不能与本势力和亲' };
    const rel = this.getRelation(factionA, factionB);
    if (!rel) return { ok: false, msg: '无外交关系' };
    if (rel.relation <= -40) return { ok: false, msg: '两国交恶，难以和亲' };
    // 检查对方是否已有和亲
    const existing = (game.heqins || []).find(h =>
      (h.f1 === factionA && h.f2 === factionB) ||
      (h.f1 === factionB && h.f2 === factionA));
    if (existing) return { ok: false, msg: '两国已为姻亲' };
    const heqin = {
      id: 'heqin_' + (++hostageCounter),
      f1: factionA, f2: factionB,
      turn: game.turn, active: true
    };
    game.heqins = game.heqins || [];
    game.heqins.push(heqin);
    rel.relation = Math.min(100, rel.relation + 20);
    rel.ceasefire = true;
    game.pushLog(`💍 ${FACTIONS[factionA].name} 以宗女和亲 ${FACTIONS[factionB].name}，两国之好益固。关系+20。`);
    return { ok: true, msg: `和亲成立：${FACTIONS[factionA].name} 宗女嫁 ${FACTIONS[factionB].name}`, heqin };
  }

  // 2. 质子交换：双方各送一名王子为质
  proposeHostageExchange(game, factionA, factionB) {
    if (factionA === factionB) return { ok: false, msg: '不能与本势力交换质子' };
    const rel = this.getRelation(factionA, factionB);
    if (!rel) return { ok: false, msg: '无外交关系' };
    if (rel.relation < 0) return { ok: false, msg: '两国关系未睦，不宜交换质子' };
    // 双方各选一名闲居武将（王子优先）
    const pickHeir = (fid) => {
      const gens = game.getFactionGenerals(fid).filter(g =>
        !g.inArmy && !g.onHostage && g.role !== '君主');
      // 优先政治/智力较高者（视为王子）
      gens.sort((a, b) => (b.politics + b.intel) - (a.politics + a.intel));
      return gens[0] || null;
    };
    const genA = pickHeir(factionA);
    const genB = pickHeir(factionB);
    if (!genA || !genB) return { ok: false, msg: '双方各需一名闲居王子为质' };
    // 执行交换
    const resA = game.factionRes.get(factionA);
    const resB = game.factionRes.get(factionB);
    const capB = game.cities.get(FACTIONS[factionB].capital);
    const capA = game.cities.get(FACTIONS[factionA].capital);
    if (capB) { genA.onHostage = true; genA.location = capB.id; }
    if (capA) { genB.onHostage = true; genB.location = capA.id; }
    rel.relation = Math.min(100, rel.relation + 15);
    game.pushLog(`🕊 质子交换：${FACTIONS[factionA].name} ${genA.name} 与 ${FACTIONS[factionB].name} ${genB.name} 互换为质。关系+15。`);
    return { ok: true, msg: `质子交换成立：${genA.name} ↔ ${genB.name}` };
  }

  // 3. 联合讨伐：号召多个势力共同讨伐某势力
  proposeCoalition(game, factionA, targets, enemy) {
    if (!Array.isArray(targets) || targets.length === 0) {
      return { ok: false, msg: '需指定至少一个参与势力' };
    }
    if (!enemy || enemy === factionA) return { ok: false, msg: '讨伐目标无效' };
    const joined = [];
    const failed = [];
    for (const t of targets) {
      if (t === factionA || t === enemy) continue;
      const rel = this.getRelation(factionA, t);
      if (!rel) { failed.push(t); continue; }
      // 关系越好越易加入
      const acceptProb = 0.3 + rel.relation / 150;
      if (Math.random() < acceptProb) {
        joined.push(t);
        const relEnemy = this.getRelation(t, enemy);
        if (relEnemy) relEnemy.relation = Math.max(-100, relEnemy.relation - 20);
      } else {
        failed.push(t);
      }
    }
    if (joined.length === 0) {
      game.pushLog(`🚫 ${FACTIONS[factionA].name} 号召讨伐 ${FACTIONS[enemy].name}，无人响应。`);
      return { ok: false, msg: '无人响应联盟', joined, failed };
    }
    const coalition = {
      id: 'coal_' + (++coalitionCounter),
      leader: factionA, targets: [factionA, ...joined],
      enemy, turn: game.turn
    };
    game.coalitions = game.coalitions || [];
    game.coalitions.push(coalition);
    game.pushLog(`⚔ 联盟成立：${FACTIONS[factionA].name} 号召 ${joined.map(t => FACTIONS[t].name).join('、')} 共讨 ${FACTIONS[enemy].name}！`);
    return { ok: true, msg: `联盟成立！${joined.length} 方响应。`, coalition, joined, failed };
  }

  // 4. 贸易协定：双方互通有无，增加贸易收入
  proposeTradeAgreement(game, factionA, factionB) {
    if (factionA === factionB) return { ok: false, msg: '不能与本势力通商' };
    const rel = this.getRelation(factionA, factionB);
    if (!rel) return { ok: false, msg: '无外交关系' };
    if (rel.relation < 20) return { ok: false, msg: '两国关系未睦（需关系≥20）' };
    // 检查是否已有协定
    const key = this._key(factionA, factionB);
    this.tradeAgreements = this.tradeAgreements || {};
    if (this.tradeAgreements[key]) return { ok: false, msg: '已签贸易协定' };
    this.tradeAgreements[key] = { turn: game.turn, incomeBonus: 0.15 };
    rel.relation = Math.min(100, rel.relation + 10);
    game.pushLog(`⚖ 贸易协定：${FACTIONS[factionA].name} 与 ${FACTIONS[factionB].name} 互通有无，双方贸易收入+15%。`);
    return { ok: true, msg: `已签订贸易协定，双方贸易收入+15%` };
  }

  // 查询贸易协定加成
  getTradeAgreementBonus(factionId) {
    let bonus = 0;
    if (!this.tradeAgreements) return 0;
    for (const [k, v] of Object.entries(this.tradeAgreements)) {
      if (!v) continue;
      const [a, b] = k.split('_');
      if (a === factionId || b === factionId) bonus += (v.incomeBonus || 0.15);
    }
    return bonus;
  }

  // 5. 军事通行：允许军队通过对方领地
  proposePassage(game, factionA, factionB, armyId) {
    if (factionA === factionB) return { ok: false, msg: '不能向本势力要求通行' };
    const rel = this.getRelation(factionA, factionB);
    if (!rel) return { ok: false, msg: '无外交关系' };
    if (rel.relation < 30) return { ok: false, msg: '两国关系未睦（需关系≥30），不允借道' };
    // 记录通行许可
    this.passages = this.passages || {};
    const key = this._key(factionA, factionB);
    this.passages[key] = { turn: game.turn, expires: game.turn + 10, armyId };
    game.pushLog(`🚶 ${FACTIONS[factionA].name} 获准借道 ${FACTIONS[factionB].name} 领地（10回合有效）。`);
    return { ok: true, msg: `军事通行许可已授予（10回合）`, armyId };
  }

  // 检查是否有通行权
  hasPassage(factionA, factionB, currentTurn) {
    if (!this.passages) return false;
    const key = this._key(factionA, factionB);
    const p = this.passages[key];
    if (!p) return false;
    if (currentTurn && p.expires && currentTurn > p.expires) return false;
    return true;
  }

  // 6. 策反（强化版）：花重金策反对方武将（低忠诚加成）
  //    既有 bribeGeneral 保留不变；此为 V15.0 强化接口
  proposeDefection(game, targetFid, generalId, cost) {
    return this.bribeGeneral(game, targetFid, generalId, cost);
  }

  // ============================================================
  // V18.0：AI 智能深化——外交决策深化
  // ============================================================

  // 1) AI 外交提案：根据实力/关系/恩怨，决定 AI 主动向对方提议什么
  //    返回 { type: 'hostage'|'marriage'|'heqin'|'ceasefire'|'none', reason }
  getAIProposal(factionA, factionB, game) {
    if (!factionA || !factionB || factionA === factionB) {
      return { type: 'none', reason: '无外交对象' };
    }
    const rel = this.getRelation(factionA, factionB);
    if (!rel) return { type: 'none', reason: '无外交关系' };
    if (rel.alliance) return { type: 'none', reason: '已为同盟' };

    try {
      const sp = strategyPlanner;
      const me = sp.getFactionStrength(factionA, game);
      const them = sp.getFactionStrength(factionB, game);
      const ratio = them.military > 0 ? me.military / them.military : 1;
      const grievance = Number(rel.grievance) || 0;

      // 弱国对强国：优先送人质求和 → 其次联姻/和亲
      if (ratio < 0.6) {
        if (grievance >= 30) {
          // 刚结怨：先停战
          return { type: 'ceasefire', reason: '新败乞和，先止干戈' };
        }
        if (rel.relation > 0) {
          return { type: Math.random() < 0.5 ? 'marriage' : 'heqin', reason: '弱国攀援，结亲固好' };
        }
        return { type: 'hostage', reason: '弱国送质以求苟安' };
      }
      // 势均力敌：关系好则联姻
      if (ratio >= 0.8 && ratio <= 1.2 && rel.relation >= 20) {
        return { type: 'marriage', reason: '势均力敌，结秦晋之好' };
      }
      // 强国对弱国：关系尚可则和亲笼络
      if (ratio > 1.5 && rel.relation >= 0) {
        return { type: 'heqin', reason: '大国怀柔，宗女和亲' };
      }
      return { type: 'none', reason: '当前局势无合适提案' };
    } catch (e) {
      return { type: 'none', reason: '评估失败' };
    }
  }

  // 2) AI 是否应主动求和：遍历交战势力，若己方明显透支则求和
  //    返回 { seek: bool, target: factionId, reason: string }
  shouldAISeekPeace(factionId, game) {
    if (!factionId) return { seek: false, reason: '无效势力' };
    try {
      const sp = strategyPlanner;
      const me = sp.getFactionStrength(factionId, game);
      const res = game.factionRes.get(factionId) || {};
      const alive = Object.keys(FACTIONS).filter(f => {
        if (f === factionId) return false;
        return game.getFactionCities(f).length > 0;
      });
      // 找交战中（关系<0 且未停战）且最强者
      let best = null, bestGap = 0;
      for (const f of alive) {
        const rel = this.getRelation(factionId, f);
        if (!rel || rel.ceasefire || rel.alliance) continue;
        if ((Number(rel.relation) || 0) >= 0) continue;
        const them = sp.getFactionStrength(f, game);
        // 对方显著强于我，且我经济透支
        const gap = them.military - me.military;
        const broke = (Number(res.money) || 0) < 300;
        if (gap > 2000 && (broke || me.cityCount <= 2) && gap > bestGap) {
          best = f; bestGap = gap;
        }
      }
      if (best) {
        return { seek: true, target: best, reason: '国力疲敝，难以为继' };
      }
      return { seek: false, reason: '尚可支撑' };
    } catch (e) {
      return { seek: false, reason: '评估失败' };
    }
  }

  // 3) AI 外交态度：综合实力对比/恩怨/均势压力，返回态度
  //    返回 { attitude: 'warm'|'neutral'|'cold'|'hostile', strengthRatio, grievance, balancePressure, note }
  getAIDiplomacyAttitude(factionA, factionB, game) {
    if (!factionA || !factionB || factionA === factionB) {
      return { attitude: 'neutral', strengthRatio: 1, grievance: 0, balancePressure: 0, note: '无外交对象' };
    }
    const rel = this.getRelation(factionA, factionB) || {};
    try {
      const sp = strategyPlanner;
      const me = sp.getFactionStrength(factionA, game);
      const them = sp.getFactionStrength(factionB, game);
      const ratio = me.military > 0 ? them.military / me.military : 1;
      const grievance = Number(rel.grievance) || 0;
      // 均势压力：factionB 是否过强（占比 > 35%）
      const totalCities = game.cities.size || 1;
      const theirRatio = them.cityCount / totalCities;
      const balancePressure = theirRatio > 0.35 ? 1 : 0;

      let score = 0;
      if (rel.alliance) score += 50;
      if (rel.ceasefire) score += 10;
      score += (Number(rel.relation) || 0) / 2;
      if (grievance >= 30) score -= 30;
      if (balancePressure && factionB !== factionA) score -= 20; // 均势：对霸者敌意
      if (ratio > 1.5) score -= 10;   // 对方显著更强
      else if (ratio < 0.6) score += 5; // 对方弱小

      let attitude = 'neutral';
      if (score >= 40) attitude = 'warm';
      else if (score >= 10) attitude = 'neutral';
      else if (score >= -20) attitude = 'cold';
      else attitude = 'hostile';

      return {
        attitude,
        strengthRatio: Math.round(ratio * 100) / 100,
        grievance,
        balancePressure,
        note: attitude === 'hostile' ? '敌对相向'
          : attitude === 'cold' ? '心存戒心'
          : attitude === 'neutral' ? '不亲不疏'
          : '友善相向'
      };
    } catch (e) {
      return { attitude: 'neutral', strengthRatio: 1, grievance: 0, balancePressure: 0, note: '评估失败' };
    }
  }

  // 4) 均势外交压力查询：某势力是否过强（其他势力应联合对抗）
  //    返回 { dominant: factionId|null, ratio: number, note: string }
  getBalancePressure(game) {
    try {
      const alive = Object.keys(FACTIONS).filter(f => game.getFactionCities(f).length > 0);
      const total = game.cities.size || 1;
      let dominant = null, maxRatio = 0;
      for (const f of alive) {
        const n = game.getFactionCities(f).length;
        const r = n / total;
        if (r > maxRatio) { maxRatio = r; dominant = f; }
      }
      return {
        dominant,
        ratio: Math.round(maxRatio * 100) / 100,
        note: maxRatio > 0.35
          ? `${FACTIONS[dominant].name}势大，诸侯当共图之`
          : '天下均分，暂无独霸'
      };
    } catch (e) {
      return { dominant: null, ratio: 0, note: '评估失败' };
    }
  }

  // 5) 每回合恩怨衰减（由 game 回合推进时调用）
  _decayGrievance(game) {
    try {
      for (const rel of Object.values(this.relations)) {
        if (rel.grievance && rel.grievance > 0) {
          rel.grievance = Math.max(0, rel.grievance - 2);
        }
      }
    } catch (e) {}
  }

  // ============================================================
  // V24.0.0：外交同盟系统深化
  // （同盟体系 / 联军作战 / 条约体系 / 附庸国 / 外交声望）
  // ============================================================

  // ---------- 1. 同盟体系深化 ----------
  // 结盟（深化版）：在原有 proposeAlliance 基础上，增加同盟期限与互不侵犯
  v24ProposeAlliance(game, proposerFid, targetFid) {
    if (proposerFid === targetFid) return { ok: false, msg: '不能与本势力结盟' };
    const rel = this.getRelation(proposerFid, targetFid);
    if (!rel) return { ok: false, msg: '无外交关系' };
    if (rel.alliance) return { ok: false, msg: '已为同盟' };
    // 同盟需关系≥20 或有和亲/联姻
    const hasMarriage = this.getActiveMarriage(game, proposerFid, targetFid);
    if (rel.relation < 20 && !hasMarriage) {
      return { ok: false, msg: '两国关系未睦（需关系≥20 或已有姻亲）' };
    }
    // 检查是否有互不侵犯条约
    const treatyKey = this._key(proposerFid, targetFid);
    const existingTreaty = this.v24_treaties[treatyKey];
    // AI 接受概率
    let acceptProb = 0.4 + rel.relation / 150;
    if (hasMarriage) acceptProb += 0.2;
    if (existingTreaty && existingTreaty.active) acceptProb += 0.15;
    acceptProb = Math.max(0.05, Math.min(0.95, acceptProb));
    if (targetFid !== game.playerFaction && Math.random() >= acceptProb) {
      return { ok: false, msg: `${FACTIONS[targetFid].name} 婉拒了结盟之请` };
    }
    rel.alliance = true;
    rel.relation = Math.min(100, rel.relation + 30);
    rel.allianceSince = game.turn;
    this.v24_stats.alliancesSigned++;
    // 更新声望
    this.v24ReputationChange(proposerFid, 5);
    this.v24ReputationChange(targetFid, 5);
    game.pushLog(`🤝 同盟成立：${FACTIONS[proposerFid].name} 与 ${FACTIONS[targetFid].name} 歃血为盟，共御外侮！`);
    // 更新盟友数统计
    this.v24_stats.maxAllies = Math.max(this.v24_stats.maxAllies, this.v24GetAllyCount(game, proposerFid));
    return { ok: true, msg: `与 ${FACTIONS[targetFid].name} 结成同盟！`, alliance: true };
  }

  // 撕毁同盟
  v24BreakAlliance(game, fid1, fid2) {
    const rel = this.getRelation(fid1, fid2);
    if (!rel || !rel.alliance) return { ok: false, msg: '并非同盟关系' };
    rel.alliance = false;
    rel.relation = Math.max(-100, rel.relation - 40);
    this.v24_stats.alliancesBroken++;
    // 声望下降
    this.v24ReputationChange(fid1, -15);
    game.pushLog(`💔 ${FACTIONS[fid1].name} 撕毁与 ${FACTIONS[fid2].name} 的同盟！天下共鄙之。`);
    return { ok: true, msg: '同盟已撕毁，声望大损' };
  }

  // 获取某势力的同盟数量
  v24GetAllyCount(game, factionId) {
    let count = 0;
    for (const [k, rel] of Object.entries(this.relations)) {
      if (!rel || !rel.alliance) continue;
      const [a, b] = k.split('_');
      if (a === factionId || b === factionId) count++;
    }
    return count;
  }

  // ---------- 2. 联军作战 ----------
  // 同盟国协同作战：邀请同盟国出兵共击敌
  v24JointWar(game, leaderFid, allyFid, enemyFid) {
    if (leaderFid === allyFid || allyFid === enemyFid || leaderFid === enemyFid) {
      return { ok: false, msg: '参战势力无效' };
    }
    const rel = this.getRelation(leaderFid, allyFid);
    if (!rel || !rel.alliance) return { ok: false, msg: '须为同盟关系方可联合作战' };
    // 检查敌对方关系
    const enemyRel = this.getRelation(leaderFid, enemyFid);
    if (!enemyRel) return { ok: false, msg: '与目标无外交关系' };
    // 同盟国出兵概率（基于关系与实力）
    let joinProb = 0.5 + (rel.relation || 0) / 200;
    joinProb = Math.max(0.1, Math.min(0.9, joinProb));
    if (Math.random() >= joinProb) {
      game.pushLog(`🚫 ${FACTIONS[allyFid].name} 拒绝了联军请求。`);
      return { ok: false, msg: '同盟国拒绝出兵' };
    }
    // 记录联军作战
    const op = {
      id: 'joint_' + Date.now(),
      leader: leaderFid, ally: allyFid, enemy: enemyFid,
      turn: game.turn, active: true
    };
    this.v24_jointOperations.push(op);
    this.v24_stats.jointBattles++;
    // 对敌方关系恶化
    const relAllyEnemy = this.getRelation(allyFid, enemyFid);
    if (relAllyEnemy) relAllyEnemy.relation = Math.max(-100, (relAllyEnemy.relation || 0) - 20);
    game.pushLog(`⚔ 联军成立：${FACTIONS[leaderFid].name} 与 ${FACTIONS[allyFid].name} 共讨 ${FACTIONS[enemyFid].name}！`);
    return { ok: true, msg: `联军成立！${FACTIONS[allyFid].name} 出兵协同作战`, operation: op };
  }

  // 查询联军作战记录
  v24GetJointOperations(factionId) {
    return this.v24_jointOperations.filter(op =>
      op.leader === factionId || op.ally === factionId || op.enemy === factionId
    );
  }

  // ---------- 3. 条约体系 ----------
  // 签订互不侵犯条约
  v24SignNonAggression(game, fid1, fid2, duration) {
    if (fid1 === fid2) return { ok: false, msg: '不能与本势力签约' };
    const rel = this.getRelation(fid1, fid2);
    if (!rel) return { ok: false, msg: '无外交关系' };
    if (rel.relation < -20) return { ok: false, msg: '两国交恶，难以签约' };
    const key = this._key(fid1, fid2);
    const treaty = {
      type: 'non_aggression',
      active: true,
      signed: game.turn,
      expires: game.turn + (duration || 20)
    };
    this.v24_treaties[key] = treaty;
    rel.ceasefire = true;
    rel.relation = Math.min(100, rel.relation + 15);
    this.v24_stats.treatiesSigned++;
    game.pushLog(`📜 互不侵犯条约：${FACTIONS[fid1].name} 与 ${FACTIONS[fid2].name} 约为兄弟，互不攻伐（${duration || 20}回合）。`);
    return { ok: true, msg: '互不侵犯条约已签订', treaty };
  }

  // 签订停战协议
  v24SignCeasefire(game, fid1, fid2, duration) {
    if (fid1 === fid2) return { ok: false, msg: '不能与本势力签约' };
    const rel = this.getRelation(fid1, fid2);
    if (!rel) return { ok: false, msg: '无外交关系' };
    const key = this._key(fid1, fid2);
    const treaty = {
      type: 'ceasefire',
      active: true,
      signed: game.turn,
      expires: game.turn + (duration || 10)
    };
    this.v24_treaties[key] = treaty;
    rel.ceasefire = true;
    rel.relation = Math.min(100, rel.relation + 10);
    this.v24_stats.treatiesSigned++;
    game.pushLog(`🕊 停战协议：${FACTIONS[fid1].name} 与 ${FACTIONS[fid2].name} 罢兵息战（${duration || 10}回合）。`);
    return { ok: true, msg: '停战协议已签订', treaty };
  }

  // 签订嫁妆条约（和亲+嫁妆）
  v24SignDowryTreaty(game, fid1, fid2, dowryAmount) {
    if (fid1 === fid2) return { ok: false, msg: '不能与本势力签约' };
    const rel = this.getRelation(fid1, fid2);
    if (!rel) return { ok: false, msg: '无外交关系' };
    const res = game.factionRes.get(fid1);
    if (!res || res.money < (dowryAmount || 0)) return { ok: false, msg: '嫁妆不足' };
    res.money -= (dowryAmount || 0);
    const key = this._key(fid1, fid2);
    const treaty = {
      type: 'dowry',
      active: true,
      signed: game.turn,
      expires: game.turn + 30,
      dowry: dowryAmount || 0
    };
    this.v24_treaties[key] = treaty;
    rel.ceasefire = true;
    rel.relation = Math.min(100, rel.relation + 25);
    this.v24_stats.treatiesSigned++;
    game.pushLog(`💍 嫁妆条约：${FACTIONS[fid1].name} 以 ${dowryAmount} 金为嫁妆，与 ${FACTIONS[fid2].name} 永结和好。`);
    return { ok: true, msg: '嫁妆条约已签订', treaty };
  }

  // 检查是否有有效条约
  v24HasActiveTreaty(fid1, fid2, currentTurn) {
    const key = this._key(fid1, fid2);
    const t = this.v24_treaties[key];
    if (!t || !t.active) return false;
    if (t.expires && currentTurn && currentTurn > t.expires) return false;
    return true;
  }

  // 每回合清理过期条约
  _v24CleanupTreaties(game) {
    for (const [k, t] of Object.entries(this.v24_treaties)) {
      if (t.active && t.expires && game.turn > t.expires) {
        t.active = false;
        game.pushLog(`📜 条约到期：${k.replace('_', ' 与 ')} 的条约已失效。`);
      }
    }
  }

  // ---------- 4. 附庸国 ----------
  // 接受附庸：小国臣服，每年进贡
  v24AcceptVassal(game, suzerainFid, vassalFid) {
    if (suzerainFid === vassalFid) return { ok: false, msg: '不能为本势力附庸' };
    if (this.v24_vassals[vassalFid]) return { ok: false, msg: '该势力已有宗主' };
    const rel = this.getRelation(suzerainFid, vassalFid);
    if (!rel) return { ok: false, msg: '无外交关系' };
    // 附庸国实力须明显弱于宗主
    try {
      const sp = strategyPlanner;
      const me = sp.getFactionStrength(suzerainFid, game);
      const them = sp.getFactionStrength(vassalFid, game);
      if (them.military > me.military * 0.8) {
        return { ok: false, msg: '对方实力不弱，难以臣服' };
      }
    } catch (e) {}
    // 设定附庸
    this.v24_vassals[vassalFid] = {
      suzerain: suzerainFid,
      sinceTurn: game.turn,
      annualTribute: 500,
      tributeAccumulated: 0
    };
    rel.relation = Math.min(100, rel.relation + 40);
    rel.ceasefire = true;
    this.v24_stats.vassalsAccepted++;
    this.v24_stats.maxVassals = Math.max(this.v24_stats.maxVassals, Object.keys(this.v24_vassals).length);
    game.pushLog(`🏯 ${FACTIONS[vassalFid].name} 臣服于 ${FACTIONS[suzerainFid].name}，岁贡不绝！`);
    return { ok: true, msg: `${FACTIONS[vassalFid].name} 成为附庸`, vassal: vassalFid };
  }

  // 附庸国进贡结算（每回合调用）
  v24CollectVassalTribute(game, suzerainFid) {
    let total = 0;
    for (const [vassalFid, vassal] of Object.entries(this.v24_vassals)) {
      if (vassal.suzerain !== suzerainFid) continue;
      // 每年（12回合）进贡一次
      if ((game.turn - vassal.sinceTurn) % 12 !== 0) continue;
      const amount = vassal.annualTribute || 500;
      const res = game.factionRes.get(suzerainFid);
      if (res) {
        res.money = (res.money || 0) + amount;
        total += amount;
        vassal.tributeAccumulated = (vassal.tributeAccumulated || 0) + amount;
        this.v24_stats.vassalTributes++;
        game.pushLog(`💰 ${FACTIONS[vassalFid].name} 进贡 ${amount} 金`);
      }
    }
    return total;
  }

  // 附庸国独立（宗主过弱或附庸反叛）
  v24ReleaseVassal(game, suzerainFid, vassalFid) {
    const v = this.v24_vassals[vassalFid];
    if (!v || v.suzerain !== suzerainFid) return { ok: false, msg: '非我方附庸' };
    delete this.v24_vassals[vassalFid];
    const rel = this.getRelation(suzerainFid, vassalFid);
    if (rel) rel.relation = Math.max(-100, (rel.relation || 0) - 10);
    game.pushLog(`🏃 ${FACTIONS[vassalFid].name} 脱离附庸，自立于一方。`);
    return { ok: true, msg: '附庸已脱离' };
  }

  // 获取某势力的附庸数量
  v24GetVassalCount(suzerainFid) {
    return Object.values(this.v24_vassals).filter(v => v.suzerain === suzerainFid).length;
  }

  // ---------- 5. 外交声望 ----------
  // 修改声望（内部）
  v24ReputationChange(factionId, delta) {
    const cur = this.v24_reputation[factionId] || 0;
    const next = Math.max(-100, Math.min(100, cur + delta));
    this.v24_reputation[factionId] = next;
    this.v24_stats.maxReputation = Math.max(this.v24_stats.maxReputation, next);
    this.v24_stats.minReputation = Math.min(this.v24_stats.minReputation, next);
    return next;
  }

  // 获取声望
  v24GetReputation(factionId) {
    return this.v24_reputation[factionId] || 0;
  }

  // 声望对结盟成功率的修正
  v24ReputationAllyMod(factionId) {
    const rep = this.v24_reputation[factionId] || 0;
    // 声望≥50：结盟成功率+20%；声望≤-50：结盟成功率-20%
    if (rep >= 50) return 0.20;
    if (rep >= 20) return 0.10;
    if (rep <= -50) return -0.20;
    if (rep <= -20) return -0.10;
    return 0;
  }

  // 声望过低时，其他势力倾向围攻
  v24IsIsolated(factionId) {
    const rep = this.v24_reputation[factionId] || 0;
    return rep <= -50;
  }

  // ---------- 每回合结算 ----------
  v24EndTurn(game) {
    // 清理过期条约
    this._v24CleanupTreaties(game);
    // 附庸进贡
    if (game.playerFaction) {
      this.v24CollectVassalTribute(game, game.playerFaction);
    }
    // 声望随时间自然恢复（每回合+1，上限0）
    for (const fid of Object.keys(this.v24_reputation)) {
      if (this.v24_reputation[fid] < 0) {
        this.v24_reputation[fid] = Math.min(0, (this.v24_reputation[fid] || 0) + 1);
      }
    }
  }

  // ---------- 汇总查询（成就/结局用）----------
  v24GetAllStats(factionId) {
    return {
      alliances: this.v24GetAllyCount(null, factionId),
      vassals: this.v24GetVassalCount(factionId),
      reputation: this.v24GetReputation(factionId),
      treaties: Object.values(this.v24_treaties).filter(t => t.active).length,
      ...this.v24_stats
    };
  }

  serialize() {
    return {
      relations: this.relations,
      tradeAgreements: this.tradeAgreements || {},
      passages: this.passages || {},
      // V24.0.0 新增
      v24_treaties: this.v24_treaties || {},
      v24_vassals: this.v24_vassals || {},
      v24_reputation: this.v24_reputation || {},
      v24_jointOperations: this.v24_jointOperations || [],
      v24_stats: this.v24_stats || {}
    };
  }

  static deserialize(data) {
    const d = new DiplomacySystem();
    if (data && data.relations) d.relations = data.relations;
    if (data && data.tradeAgreements) d.tradeAgreements = data.tradeAgreements;
    if (data && data.passages) d.passages = data.passages;
    // V24.0.0 新增
    if (data && data.v24_treaties) d.v24_treaties = data.v24_treaties;
    if (data && data.v24_vassals) d.v24_vassals = data.v24_vassals;
    if (data && data.v24_reputation) d.v24_reputation = data.v24_reputation;
    if (data && data.v24_jointOperations) d.v24_jointOperations = data.v24_jointOperations;
    if (data && data.v24_stats) d.v24_stats = Object.assign(d.v24_stats, data.v24_stats);
    return d;
  }
}
