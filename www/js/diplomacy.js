// ============================================================
// diplomacy.js — 外交系统
// 含 V2.5：联姻系统、人质系统
// ============================================================
import { FACTIONS, MARRIAGE_REL_BONUS, MARRIAGE_BREAK_REL_PENALTY,
         HOSTAGE_RANSOM_COST, HOSTAGE_RECALL_REL_MIN } from './data.js';

let marriageCounter = 0;
let hostageCounter = 0;

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
    gen.location = game.cities.get(FACTIONS[game.playerFaction].capital).id;
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
      const acceptProb = 0.35 + rel.relation / 200; // 关系越好越易应允
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
    const rel = this.getRelation(attackerFid, defenderFid);
    rel.relation = Math.max(-100, rel.relation - MARRIAGE_BREAK_REL_PENALTY);
    rel.ceasefire = false;
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
    const capital = game.cities.get(FACTIONS[toFid].capital);
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
      const capital = game.cities.get(FACTIONS[factionId].capital);
      gen.location = capital.id;
    }
    game.pushLog(`🏠 ${gen ? gen.name : '人质'} 自 ${FACTIONS[h.to].name} 赎回（耗 ${cost} 金）。`);
    return { ok: true, msg: `${gen ? gen.name : '人质'} 已赎回` };
  }

  // 撕毁盟约/开战时处置人质：50% 处决（武将死亡），50% 释放
  onWarDeclared(game, fid1, fid2) {
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

  serialize() {
    return { relations: this.relations };
  }

  static deserialize(data) {
    const d = new DiplomacySystem();
    if (data && data.relations) d.relations = data.relations;
    return d;
  }
}
