// ============================================================
// ai_strategy.js — V18.0「AI智能深化」战略规划系统
//  AIStrategyPlanner：
//    - 势力评估（军事/经济/地理/威胁）
//    - 扩张优先级（弱邻优先、避免两线作战）
//    - 防御部署（强敌边境多驻兵）
//    - 经济规划（初期农业→中期商业→后期军事）
//    - 武将分配（良将镇关键方向）
//    - 联盟策略（弱国联合抗最强，均势外交）
//  对外 API：
//    planStrategy(factionId, game)
//    getThreatLevel(factionId, targetId, game)
//    getExpansionPriority(factionId, game)
//    getBuildPriority(factionId, game)
// ============================================================
import { FACTIONS, CITY_LINKS } from './data.js';

export class AIStrategyPlanner {
  constructor() {
    // 回合级缓存：同一回合内避免重复全表扫描
    this._cache = new Map();
  }

  // 回合键
  _ck(game) { return 't' + (game ? game.turn : 0); }

  // 新回合时清空缓存（由 AIPlayer.takeTurn 入口调用）
  invalidate(game) {
    this._cache.clear();
  }

  // 缓存读取/写入
  _get(key, producer) {
    const k = this._ck(null) + ':' + key;
    if (this._cache.has(k)) return this._cache.get(k);
    const v = producer();
    this._cache.set(k, v);
    return v;
  }

  // ------------------------------------------------------------
  // 一、势力评估
  // ------------------------------------------------------------

  // 军事实力：城防驻军 + 野外军队 + 武将统帅加成
  getMilitaryStrength(factionId, game) {
    const cities = game.getFactionCities(factionId);
    const armies = game.getFactionArmies(factionId);
    const garrison = cities.reduce((s, c) => s + (Number(c.garrison) || 0), 0);
    const field = armies.reduce((s, a) => s + (Number(a.troops) || 0), 0);
    const gens = game.getFactionGenerals(factionId);
    // 武将质量：每个武将的 (统帅+武力)/100 * 5 作为软实力
    const genBonus = gens.reduce((s, g) =>
      s + ((Number(g.effCommand) || 0) + (Number(g.effForce) || 0)) * 0.05, 0);
    return garrison + field + genBonus;
  }

  // 经济实力：金钱 + 粮食*0.5 + 城市发展度*10
  getEconomicStrength(factionId, game) {
    const res = game.factionRes.get(factionId) || {};
    const cities = game.getFactionCities(factionId);
    const dev = cities.reduce((s, c) =>
      s + (Number(c.agri) || 0) + (Number(c.comm) || 0) + (Number(c.pop) || 0) / 100, 0);
    return (Number(res.money) || 0) + (Number(res.food) || 0) * 0.5 + dev * 10;
  }

  // 地理位置：边境接壤敌城数 + 首都受威胁度 + 城市数
  getGeographicScore(factionId, game) {
    const cities = game.getFactionCities(factionId);
    let border = 0;
    for (const c of cities) {
      const links = CITY_LINKS[c.id] || [];
      for (const nid of links) {
        const n = game.cities.get(nid);
        if (n && n.owner && n.owner !== factionId) border++;
      }
    }
    // 首都安全度
    const capId = (FACTIONS[factionId] || {}).capital;
    const cap = capId ? game.cities.get(capId) : null;
    let capThreat = 0;
    if (cap) {
      const links = CITY_LINKS[cap.id] || [];
      for (const nid of links) {
        const n = game.cities.get(nid);
        if (n && n.owner && n.owner !== factionId) {
          capThreat += 1 + (Number(n.garrison) || 0) / 2000;
        }
      }
    }
    return { border, capThreat, cityCount: cities.length };
  }

  // 综合国力评分
  getFactionStrength(factionId, game) {
    const mil = this.getMilitaryStrength(factionId, game);
    const eco = this.getEconomicStrength(factionId, game);
    const geo = this.getGeographicScore(factionId, game);
    return {
      military: mil,
      economy: eco,
      border: geo.border,
      capThreat: geo.capThreat,
      cityCount: geo.cityCount,
      score: Math.round(mil * 1.0 + eco * 0.5 - geo.border * 100 - geo.capThreat * 200)
    };
  }

  // ------------------------------------------------------------
  // 二、发展阶段（初期/中期/后期）
  // ------------------------------------------------------------
  getStage(factionId, game) {
    const n = game.getFactionCities(factionId).length;
    if (n < 3) return 'early';
    if (n <= 8) return 'mid';
    return 'late';
  }

  // ------------------------------------------------------------
  // 三、威胁等级（0-100）
  // ------------------------------------------------------------
  getThreatLevel(factionId, targetId, game) {
    if (!factionId || !targetId || factionId === targetId) return 0;
    const me = this.getFactionStrength(factionId, game);
    const them = this.getFactionStrength(targetId, game);
    const rel = (game.diplomacy && game.diplomacy.getRelation)
      ? game.diplomacy.getRelation(factionId, targetId) || {} : {};

    // 实力对比：对方军力/我方军力
    const ratio = me.military > 0 ? them.military / me.military : 2;
    let threat = Math.max(0, Math.min(100, (ratio - 0.5) * 50));

    // 接壤边境加分
    if (them.border > 0) threat += Math.min(20, them.border * 3);

    // 同盟/停战减威胁
    if (rel.alliance) threat -= 50;
    if (rel.ceasefire) threat -= 15;

    // 关系态度
    const rv = Number(rel.relation) || 0;
    if (rv < -40) threat += 15;
    else if (rv < 0) threat += 5;

    // 历史恩怨（刚被攻击过）
    if (rel.grievance && rel.grievance > 0) threat += Math.min(25, rel.grievance);

    return Math.max(0, Math.min(100, Math.round(threat)));
  }

  // ------------------------------------------------------------
  // 四、扩张优先级
  // ------------------------------------------------------------
  getExpansionPriority(factionId, game) {
    const cities = game.getFactionCities(factionId);
    const result = [];
    const seen = new Set();
    const myMil = this.getMilitaryStrength(factionId, game);
    const myBorder = this.getGeographicScore(factionId, game).border;

    for (const c of cities) {
      const links = CITY_LINKS[c.id] || [];
      for (const nid of links) {
        if (seen.has(nid)) continue;
        seen.add(nid);
        const n = game.cities.get(nid);
        if (!n || n.owner === factionId) continue;

        // 同盟不攻、停战不撕
        const rel = n.owner
          ? (game.diplomacy && game.diplomacy.getRelation
              ? game.diplomacy.getRelation(factionId, n.owner) : null)
          : null;
        if (rel && rel.alliance) continue;
        if (rel && rel.ceasefire) continue;

        const isNeutral = !n.owner;
        const targetMil = isNeutral ? 500 : this.getMilitaryStrength(n.owner, game);
        const ratio = myMil / Math.max(1, targetMil);

        let score = Math.max(0, Math.min(100, ratio * 40));
        if (isNeutral) score += 30;                         // 无主空城优先
        score += Math.max(0, 30 - (Number(n.garrison) || 0) / 100);  // 城防空虚
        score += Math.max(0, 20 - (Number(n.defense) || 0) / 5);     // 城防低
        score += Math.max(0, 10 - (Number(n.morale) || 0) / 5);      // 民心低易下

        // 避免两线作战：已多线接壤则新目标扣分
        if (myBorder >= 3) score -= 20;

        result.push({
          targetId: nid,
          owner: n.owner,
          cityName: n.name,
          score: Math.round(score),
          reason: isNeutral ? '无主空城可取'
            : (ratio > 1.5 ? '弱邻易图'
              : (ratio > 1.0 ? '势均可图' : '强敌需慎'))
        });
      }
    }
    result.sort((a, b) => b.score - a.score);
    return result;
  }

  // ------------------------------------------------------------
  // 五、建造优先级（经济规划）
  // ------------------------------------------------------------
  getBuildPriority(factionId, game) {
    const stage = this.getStage(factionId, game);
    // 初期：农业积累 → 中期：商业扩张 → 后期：军事优先
    if (stage === 'early') {
      return ['farm', 'market', 'barracks', 'walls', 'drill', 'workshop', 'temple'];
    } else if (stage === 'mid') {
      return ['market', 'farm', 'barracks', 'walls', 'drill', 'workshop', 'temple'];
    } else {
      // 后期：威胁高时军事建筑优先
      const threats = this._topThreats(factionId, game, 3);
      if (threats.length > 0 && threats[0].threat >= 60) {
        return ['barracks', 'walls', 'drill', 'workshop', 'market', 'farm', 'temple'];
      }
      return ['barracks', 'drill', 'workshop', 'walls', 'market', 'farm', 'temple'];
    }
  }

  // ------------------------------------------------------------
  // 六、防御部署（强敌边境多驻兵）
  // ------------------------------------------------------------
  getDefenseDeployment(factionId, game) {
    const cities = game.getFactionCities(factionId);
    const deploy = {};
    const capId = (FACTIONS[factionId] || {}).capital;
    for (const c of cities) {
      let mult = 1.0;
      const links = CITY_LINKS[c.id] || [];
      for (const nid of links) {
        const n = game.cities.get(nid);
        if (!n || !n.owner || n.owner === factionId) continue;
        const th = this.getThreatLevel(factionId, n.owner, game);
        if (th >= 70) mult += 0.8;       // 强敌边境：多驻 80%
        else if (th >= 40) mult += 0.4;  // 中等威胁：多驻 40%
        const nGarrison = Number(n.garrison) || 0;
        if (nGarrison > 5000) mult += 0.3;
      }
      // 首都额外加固
      if (capId && c.id === capId) mult += 0.5;
      deploy[c.id] = Math.round(mult * 100) / 100;
    }
    return deploy;
  }

  // ------------------------------------------------------------
  // 七、武将分配（良将镇关键方向）
  // ------------------------------------------------------------
  getGeneralAssignment(factionId, game) {
    const gens = game.getFactionGenerals(factionId)
      .filter(g => !g.inArmy && !g.onHostage && g.role !== '君主');
    // 按 (统帅+武力) 降序
    const ranked = [...gens].sort((a, b) =>
      ((Number(b.effCommand) || 0) + (Number(b.effForce) || 0)) -
      ((Number(a.effCommand) || 0) + (Number(a.effForce) || 0))
    );
    // 关键城市：首都 + 高威胁边境
    const cities = game.getFactionCities(factionId);
    const capId = (FACTIONS[factionId] || {}).capital;
    const keyCities = cities.map(c => {
      let danger = 0;
      const links = CITY_LINKS[c.id] || [];
      for (const nid of links) {
        const n = game.cities.get(nid);
        if (n && n.owner && n.owner !== factionId) {
          danger += this.getThreatLevel(factionId, n.owner, game);
        }
      }
      if (c.id === capId) danger += 50;
      return { cityId: c.id, danger };
    }).sort((a, b) => b.danger - a.danger);

    const assignment = {};
    let gi = 0;
    for (const kc of keyCities) {
      if (gi >= ranked.length) break;
      assignment[ranked[gi].id] = kc.cityId;
      gi++;
    }
    return assignment;
  }

  // ------------------------------------------------------------
  // 八、联盟策略（均势外交：弱国联合抗最强）
  // ------------------------------------------------------------
  getAllianceTargets(factionId, game) {
    const me = this.getFactionStrength(factionId, game);
    const alive = Object.keys(FACTIONS).filter(f => {
      if (f === factionId) return false;
      return game.getFactionCities(f).length > 0;
    });
    const strengths = {};
    let strongest = null, maxScore = -Infinity;
    for (const f of alive) {
      const s = this.getFactionStrength(f, game);
      strengths[f] = s;
      if (s.score > maxScore) { maxScore = s.score; strongest = f; }
    }
    if (!strongest || strongest === factionId) return [];
    // 最强者未显著压制我方，则不必结盟
    if (maxScore - me.score < 200) return [];
    // 找同受威胁的弱方
    const targets = [];
    for (const f of alive) {
      if (f === strongest) continue;
      const rel = (game.diplomacy && game.diplomacy.getRelation)
        ? game.diplomacy.getRelation(factionId, f) : null;
      if (rel && rel.alliance) continue;
      const s = strengths[f];
      if (s.score < me.score * 1.5) targets.push(f);
    }
    return targets;
  }

  // ------------------------------------------------------------
  // 九、主入口：planStrategy
  // ------------------------------------------------------------
  planStrategy(factionId, game) {
    return {
      factionId,
      factionName: (FACTIONS[factionId] || {}).name,
      turn: game.turn,
      stage: this.getStage(factionId, game),
      strength: this.getFactionStrength(factionId, game),
      expansion: this.getExpansionPriority(factionId, game),
      build: this.getBuildPriority(factionId, game),
      defense: this.getDefenseDeployment(factionId, game),
      generals: this.getGeneralAssignment(factionId, game),
      allies: this.getAllianceTargets(factionId, game)
    };
  }

  // ------------------------------------------------------------
  // 内部工具
  // ------------------------------------------------------------
  _topThreats(factionId, game, n) {
    const alive = Object.keys(FACTIONS).filter(f => {
      if (f === factionId) return false;
      return game.getFactionCities(f).length > 0;
    });
    const list = alive.map(f => ({
      targetId: f,
      targetName: (FACTIONS[f] || {}).name,
      threat: this.getThreatLevel(factionId, f, game)
    })).filter(x => x.threat > 0).sort((a, b) => b.threat - a.threat);
    return list.slice(0, n);
  }
}

// 全局单例：供 AIPlayer / DiplomacySystem 复用同一规划器
export const strategyPlanner = new AIStrategyPlanner();
