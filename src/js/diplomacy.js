// ============================================================
// diplomacy.js — 外交系统
// ============================================================
import { FACTIONS } from './data.js';

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

  serialize() {
    return { relations: this.relations };
  }

  static deserialize(data) {
    const d = new DiplomacySystem();
    if (data && data.relations) d.relations = data.relations;
    return d;
  }
}
