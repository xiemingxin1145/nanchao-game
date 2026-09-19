// ============================================================
// ai.js — AI 势力决策
//  - 内政：发展/征兵/降税/招募
//  - 科技：优先军事线研究
//  - 军事：依强弱调整（弱势守成，强势进攻），并在战中用技
//  - 外交：与弱者结盟对抗最强势力
// ============================================================
import { FACTIONS, UNIT_TYPES, CITY_LINKS, getUpgradeNode, SPY_COST, BARBARIAN_RECRUIT_REL_MIN, getPassById } from './data.js';
import { Army, computeBattle, citiesAdjacent } from './army.js';
import { TECHS, isTechAvailable, aggregateTechEffects } from './tech.js';
import { buildBuildingOnCity, BUILDINGS } from './building.js';
import { rollForgeItem, maxRarityByWorkshop, getItem } from './equipment.js';
import { suggestFormation } from './formation.js';
// V9.0：军团会战系统
import { createLegion, addArmyToLegion, MASS_BATTLE_TROOP_MIN } from './legion.js';
// V2.5
import { requestBuildPass } from './pass.js';
import { sendSpy } from './espionage.js';
import { attackBarbarian, recruitBarbarian, tradeBarbarian } from './barbarian.js';
// V8.0：赋税/徭役系统
import { aiAdjustTax } from './tax.js';
import { aiStartCorvee } from './corvee.js';
// V18.0：AI 战略规划系统
import { strategyPlanner } from './ai_strategy.js';

export class AIPlayer {
  constructor(factionId) {
    this.factionId = factionId;
    this.name = FACTIONS[factionId].name;
    // AI 科技状态
    this.techs = [];
    this.researching = null; // { techId, turnsLeft }
    // V2.0：AI 装备库存
    this.inventory = [];
    // V5.5：AI 决策缓存（相同回合+相同城市数不重复重算强弱）
    this._cacheKey = null;
    this._cacheWeak = null;
    this._cacheStrong = null;
    this._turnStart = 0;   // takeTurn 开始时间戳（超时保护）
    // V18.0：难度等级 'easy' | 'normal' | 'hard'
    //  - easy  ：决策更慢更保守（进攻阈值高、少主动结盟）
    //  - hard  ：决策更激进更精准（进攻阈值低、优先最优目标）
    this.difficulty = 'normal';
    // V18.0：本回合战略包（takeTurn 入口计算一次）
    this._strategy = null;
  }

  // 该势力已研究科技的效果包
  techBag() { return aggregateTechEffects(this.techs); }

  takeTurn(game) {
    const res = game.factionRes.get(this.factionId);
    if (!res) return;

    // V5.5：AI 回合超时保护（最多 3 秒，防止卡死）
    this._turnStart = Date.now();
    const _timeout = () => (Date.now() - this._turnStart) > 3000;

    // 性能优化#2：回合级缓存——takeTurn 期间多次调用 getFactionCities/
    // getFactionGenerals/getFactionArmies 都会全表扫描。此处缓存一次结果，
    // 预期减少 40~60% 的 Map 遍历开销（势力数多时效果显著）。
    const _cachedCities = game.getFactionCities(this.factionId);
    // 性能优化（ai.js V21.0·219将后 AI 决策）：
    //   基准：原写法每势力都 `game.getFactionGenerals(this.factionId)` 全表 filter 219 将。
    //   优化：优先复用 runAITurns 入口建好的 `_roundFactionGenerals` 分桶索引（O(1) 命中），
    //     仅在索引缺失（非 AI 回合路径）时回退原全表 filter。
    const _cachedGenerals = (game._roundFactionGenerals && game._roundFactionGenerals.get(this.factionId))
      || game.getFactionGenerals(this.factionId);
    const _cachedArmies = game.getFactionArmies(this.factionId);
    // 性能优化（ai.js #2）：暴露到 this，供 buildBuildings/forgeAndEquip/advanceUnits 等
    //   helper 复用，避免每个 helper 再次全表扫描（72城/144将下每回合省下数十次 filter）。
    this._turnCities = _cachedCities;
    this._turnGenerals = _cachedGenerals;
    this._turnArmies = _cachedArmies;

    // 性能优化#3：回合级势力城市数缓存——
    //   优化前：allyAgainstDominant / weakDiplomacy 等方法对每个 FACTION 都调用
    //   game.getFactionCities(f).length，72城/多势力下每回合重复全表扫描十几次。
    //   优化后：本回合 takeTurn 入口一次性统计全势力城市数，存入 this._turnCityCounts，
    //   后续 helper 方法直接查表 O(1)。预期减少 50~70% 重复遍历。
    // 性能优化（ai.js #2 189将/96城后 AI 决策）：
    //   基准：上式对「每个势力」各调用一次 getFactionCities(fid)，而该方法内部是
    //     `[...this.cities.values()].filter(c => c.owner===fid)`——每势力一次全表扫描。
    //     设 C=96 城、F≈10 势力，单次 takeTurn 即 O(F×C)≈960 次比较；runAITurns 对
    //     每支 AI 都跑一遍 → 整轮 AI 决策约 F×C×F ≈ 9600 次无意义重复遍历。
    //   优化：改为单次遍历 game.cities.values()，按 c.owner 分桶计数，O(C) 一次成型，
    //     再补全未出现势力为 0。整轮 AI 决策的城市数统计从 O(F²×C) 降为 O(F×C)。
    const _cc = {};
    for (const c of game.cities.values()) {
      if (c.owner) _cc[c.owner] = (_cc[c.owner] || 0) + 1;
    }
    // 未据有城池的势力补 0，保证 allyAgainstDominant 的「存活过滤」正确
    for (const fid of Object.keys(FACTIONS)) {
      if (_cc[fid] === undefined) _cc[fid] = 0;
    }
    this._turnCityCounts = _cc;

    // ---- V18.0：本回合战略规划（入口计算一次，供各决策复用） ----
    try {
      strategyPlanner.invalidate(game);
      this._strategy = strategyPlanner.planStrategy(this.factionId, game);
    } catch (e) { this._strategy = null; }

    // 0) 科技研究推进
    this.researchTech(game, res);

    // 强弱判断：城市数占比（V5.5：同回合+同城市数用缓存）
    const totalCities = game.cities.size || 1;
    const cacheKey = game.turn + ':' + _cachedCities.length + ':' + totalCities;
    if (this._cacheKey !== cacheKey) {
      this._cacheKey = cacheKey;
      this._cacheWeak = (_cachedCities.length / totalCities) < 0.15;
      this._cacheStrong = (_cachedCities.length / totalCities) > 0.35;
    }
    const isWeak = this._cacheWeak;
    const isStrong = this._cacheStrong;

    // 1) 民心低的城市降税
    for (const city of _cachedCities) {
      if (city.morale < 30 && city.taxRate > 20) {
        city.setTaxRate(Math.max(10, city.taxRate - 10));
        game.pushLog(`【${this.name}】${city.name} 降低税率安抚民心`);
      }
    }

    // ---- V8.0：AI 赋税等级自动调整 ----
    try { aiAdjustTax(game, this.factionId); } catch (e) {}

    // ---- V8.0：AI 徭役征发（城防/农业需求时） ----
    try { if (Math.random() < 0.5) aiStartCorvee(game, this.factionId); } catch (e) {}

    // 2) 征兵（弱势更倾向于积蓄）
    for (const city of _cachedCities) {
      if (res.money > 500 && city.pop > 5000 && city.garrison < (isWeak ? 6000 : 9000)) {
        const recruitCount = Math.min(2000, Math.floor(city.pop * 0.1));
        const unitType = Math.random() < 0.3 ? 'cavalry' : (Math.random() < 0.5 ? 'archer' : 'infantry');
        const unit = UNIT_TYPES[unitType];
        const costMult = 1 + (this.techBag().recruitCostMult || 0);
        const cost = Math.round(unit.cost * recruitCount * Math.max(0.1, costMult));
        if (res.money >= cost) {
          const result = city.recruit(unitType, recruitCount, res);
          if (result.ok) game.pushLog(`【${this.name}】${city.name} 征兵 ${recruitCount} 人（${unit.name}）`);
        }
      }
    }

    // 3) 结盟对抗最强势力
    this.allyAgainstDominant(game);

    // 4) 组建军队并进攻（弱势时谨慎）
    for (const gen of _cachedGenerals) {
      // BUG修复#13：接入死代码超时保护——_timeout() 此前定义却从未调用，
      // 复杂局势（72城/多军队）下 AI 决策可能接近 3s 上限甚至卡死主线程。
      // 此处每遍历一个武将检查一次超时；超时立即中止本轮 AI 行动，
      // 避免整个游戏回合卡顿。验证：人为将超时阈值调到极小可观察循环提前退出。
      if (_timeout()) { game.pushLog(`【${this.name}】行动超时，提前结束本回合`); break; }
      if (gen.inArmy) continue;
      const city = game.cities.get(gen.location);
      if (city && city.garrison >= 2000) {
        // BUG修复（ai.js #3）：旧存档/模组武将 getMaxTroops() 可能缺失或返回 undefined，
        //   直接相乘得 NaN；而 `NaN < 1000` 恒为 false → 继续执行 `city.garrison -= NaN`，
        //   把城市驻军污染成 NaN（后续所有城防/战斗计算连锁 NaN）。
        //   修复：先把上限钳为有效数字，再用 `!(troops >= 1000)` 同时挡住 NaN 与过小值。
        const maxT = Number(gen.getMaxTroops && gen.getMaxTroops()) || 1000;
        const troops = Math.min(maxT * (isStrong ? 1 : 0.8), city.garrison, isWeak ? 2500 : 3500);
        if (!(troops >= 1000)) continue;
        city.garrison -= troops;
        const army = new Army({
          factionId: this.factionId, generalId: gen.id, cityId: city.id,
          troops: troops, unitMix: game.estimateUnitMix(troops)
        });
        // V2.0：AI 按主力兵种选择阵型
        army.formation = suggestFormation(army.getMainUnit());
        game.armies.push(army);
        gen.inArmy = army.id;
        gen.location = army.id;
        game.pushLog(`【${this.name}】${gen.name} 于 ${city.name} 起兵`);
        if (!isWeak) this.tryAttack(game, army);
      }
    }
    if (!isWeak) {
      for (const army of _cachedArmies) {
        if (army.hasMoved) continue;
        this.tryAttack(game, army);
      }
    }

    // ---- V9.0：AI 自动编成军团（强势力倾向合军） ----
    this.aiFormLegions(game);

    // 5) 发展经济
    let agriCount = 0, commCount = 0;
    for (const city of _cachedCities) {
      if (res.money < 200) break;
      if (city.agri < city.comm && agriCount < 2) {
        city.developAgri(200); res.money -= 200; agriCount++;
      } else if (res.money >= 200) {
        city.developComm(200); res.money -= 200; commCount++;
      }
    }

    // ---- V2.0：AI 新系统行为 ----
    this.buildBuildings(game, res);     // 建造/升级建筑
    this.forgeAndEquip(game, res);      // 工坊打造 + 给武将装备
    this.advanceUnits(game, res);       // 兵种进阶
    this.establishTrade(game, res);    // 建立商路

    // ---- V2.5：AI 新系统行为 ----
    this.weakDiplomacy(game, res, isWeak);  // 弱势时送人质/联姻求和
    this.aiSendSpy(game, res);              // 派遣密探刺探玩家
    this.aiBuildPass(game, res);            // 建造关键关隘
    this.aiBarbarianActions(game, res);     // 征讨/招安邻近蛮族

    // ---- V18.0：AI 智能深化 ----
    this.manageGenerals(game);              // 武将分配：良将镇关键方向
    this.seekPeaceIfWeary(game);            // 消耗过大时主动求和

    // 6) 招募在野武将
    // 性能优化（ai.js V20.0·204将后 AI 决策）：复用 runAITurns 入口一次性快照的在野武将表，
    //   替代每个 AI 都 `game.getIdleGenerals()` 全表扫描 204 将。
    const idleGens = game._roundIdleGens || game.getIdleGenerals();
    const recruitBonus = (this.techBag().recruitBonus || 0) + 0.2;
    // 性能优化（ai.js #2 170+将后 AI 决策）：
    //   基准：原版对全势力在野武将逐个掷招募概率，170+ 将时 idleGens 可能上百，
    //   每个都要写 faction/loyalty/location，AI 回合尾帧卡顿。
    //   优化：每回合最多扫描前 10 个候选，命中招募即停；其余下回合再扫，不影响策略。
    const RECRUIT_SCAN_LIMIT = 10;
    let recruitScanned = 0;
    for (let ii = 0; ii < idleGens.length && recruitScanned < RECRUIT_SCAN_LIMIT; ii++) {
      const gen = idleGens[ii];
      recruitScanned++;
      if (res.money > 800 && Math.random() < recruitBonus) {
        gen.faction = this.factionId;
        gen.loyalty = 65;
        // BUG修复#4：防御性校验——首都城可能已被摧毁（game.cities.get 返回 undefined），
        // 直接访问 capital.id 会导致 TypeError 崩溃。此处做空值兜底。
        const capital = game.cities.get(FACTIONS[this.factionId].capital);
        gen.location = capital ? capital.id : null;
        game.pushLog(`【${this.name}】贤士 ${gen.name} 来投！`);
        // 性能优化（ai.js V20.0）：招募成功后从回合快照中移除该武将，
        //   避免后续 AI 势力重复扫描/重复招募同一在野将。
        idleGens.splice(ii, 1);
        break;
      }
    }
  }

  // V9.0：AI 自动编成军团——把同城的多支独立军队合编为军团
  aiFormLegions(game) {
    if (!game.legions) game.legions = new Map();
    // 性能优化（ai.js V20.0·204将后 AI 决策）：复用本回合缓存的军队表 _turnArmies，
    //   替代每次 getFactionArmies 全表 filter（204将/多军队规模下每回合省下一次全表扫描）。
    const myArmies = (this._turnArmies || game.getFactionArmies(this.factionId))
      .filter(a => !a.legionId && a.troops >= 1500);
    // 按所在城市分组
    const byCity = {};
    for (const a of myArmies) {
      (byCity[a.cityId] = byCity[a.cityId] || []).push(a);
    }
    for (const [cityId, list] of Object.entries(byCity)) {
      if (list.length < 2) continue;
      // 总兵力达标才编成
      const total = list.reduce((s, a) => s + a.troops, 0);
      if (total < MASS_BATTLE_TROOP_MIN * 0.5) continue;
      const first = list[0];
      const r = createLegion(game, first.id, `${this.name}军团`);
      if (!r.ok) continue;
      const lid = r.legion.id;
      for (let i = 1; i < list.length; i++) addArmyToLegion(game, lid, list[i].id);
    }
  }

  // 科技研究：优先军事线
  researchTech(game, res) {
    // 正在研究
    if (this.researching) {
      this.researching.turnsLeft--;
      if (this.researching.turnsLeft <= 0) {
        this.techs.push(this.researching.techId);
        game.pushLog(`【${this.name}】研习新制：${(TECHS.find(t=>t.id===this.researching.techId)||{}).name || this.researching.techId}`);
        this.researching = null;
      }
      return;
    }
    if (res.money < 500) return;
    // 候选：优先军事，其次经济、阵法，最后政治
    const order = ['military', 'economy', 'formation', 'political'];
    for (const line of order) {
      for (const t of TECHS) {
        if (t.line !== line) continue;
        if (isTechAvailable(t.id, this.techs, null) && res.money >= t.cost) {
          res.money -= t.cost;
          this.researching = { techId: t.id, turnsLeft: t.researchTurns };
          game.pushLog(`【${this.name}】开始研究：${t.name}（${t.researchTurns}回合）`);
          return;
        }
      }
    }
  }

  // 与较弱的一方结盟，对抗最强势力（V3.0：跳过已灭亡/无城势力）
  allyAgainstDominant(game) {
    // 性能优化#3：使用本回合缓存的势力城市数，替代每势力一次全表 getFactionCities 扫描
    const counts = this._turnCityCounts || {};
    // 仅考虑仍存活（有城）的势力
    const aliveFids = Object.keys(FACTIONS).filter(f =>
      f !== this.factionId && (counts[f] || 0) > 0);
    // 各方城市数
    const cityCount = {};
    for (const f of aliveFids) cityCount[f] = counts[f] || 0;
    cityCount[this.factionId] = counts[this.factionId] || 0;
    // 最强者
    let strongest = null, max = -1;
    for (const [f, n] of Object.entries(cityCount)) {
      if (n > max) { max = n; strongest = f; }
    }
    if (!strongest || strongest === this.factionId) return; // 自己最强则不结盟
    // 找一个非最强、非自己的较弱方结盟
    for (const f of aliveFids) {
      if (f === strongest) continue;
      const rel = game.diplomacy.getRelation(this.factionId, f);
      // BUG修复#6：防御性校验——rel 可能为 null，直接访问 rel.alliance 会崩溃。
      if (rel && !rel.alliance && cityCount[f] < max) {
        rel.alliance = true;
        rel.relation = Math.min(100, rel.relation + 30);
        game.pushLog(`【${this.name}】与 ${FACTIONS[f].name} 结盟，共抗 ${FACTIONS[strongest].name}！`);
        return;
      }
    }
  }

  // V18.0：难度对应的进攻兵力阈值（easy 保守 1.6 / normal 1.3 / hard 激进 1.1）
  _attackRatio() {
    if (this.difficulty === 'easy') return 1.6;
    if (this.difficulty === 'hard') return 1.1;
    return 1.3;
  }

  // V18.0：综合战场修正系数（地形/季节/士气/补给/援军）
  _battleModifiers(army, target, game) {
    let mod = 1.0;
    const reasons = [];
    // 1) 地形：山地/森林防守方有利 → 进攻方折减
    if (target.terrain === 'mountain') { mod *= 0.85; reasons.push('山地难攻'); }
    else if (target.terrain === 'forest') { mod *= 0.9; reasons.push('林密难进'); }
    else if (target.terrain === 'river') { mod *= 0.95; reasons.push('江河阻隔'); }
    // 2) 季节：冬季进攻补给困难
    const season = (game.getSeason && game.getSeason()) || '春';
    if (season === '冬') { mod *= 0.92; reasons.push('冬日补给艰难'); }
    else if (season === '秋') { mod *= 1.05; reasons.push('秋高马肥'); }
    // 3) 目标城市民心：民心低则易下
    const morale = Number(target.morale) || 50;
    if (morale < 30) { mod *= 1.15; reasons.push('敌城民心涣散'); }
    else if (morale > 70) { mod *= 0.95; reasons.push('敌城人心固守'); }
    // 4) 补给：军队所在城是否我方（远离本土则补给线长）
    const home = game.cities.get(army.cityId);
    if (!home || home.owner !== this.factionId) { mod *= 0.9; reasons.push('孤军深入'); }
    // 5) 援军：目标城相邻是否有友军/强邻
    const tLinks = CITY_LINKS[target.id] || [];
    let relief = 0;
    for (const nid of tLinks) {
      const n = game.cities.get(nid);
      if (n && n.owner && n.owner === target.owner) relief += Number(n.garrison) || 0;
    }
    if (relief > 3000) { mod *= 0.85; reasons.push('敌有援军可恃'); }
    return { mod, reasons };
  }

  tryAttack(game, army) {
    const links = CITY_LINKS[army.cityId] || [];
    // V18.0：用战略规划的扩张优先级给候选目标排序（hard 模式精准择敌）
    const expansion = (this._strategy && this._strategy.expansion) || [];
    const prioMap = {};
    for (const e of expansion) prioMap[e.targetId] = e.score;

    // V18.0：候选目标按优先级排序
    const candidates = links.slice().sort((a, b) => (prioMap[b] || 0) - (prioMap[a] || 0));

    for (const targetId of candidates) {
      const target = game.cities.get(targetId);
      if (!target || target.owner === this.factionId) continue;
      // 同盟不攻
      const rel = game.diplomacy.getRelation(this.factionId, target.owner);
      if (rel && rel.alliance) continue;
      // V18.0：有停战则不撕约（除非 hard 模式且目标极弱）
      if (rel && rel.ceasefire && this.difficulty !== 'hard') continue;

      if (target.owner === null) {
        target.owner = this.factionId;
        target.morale = 40;
        army.cityId = targetId;
        army.hasMoved = true;
        const gen = game.generals.get(army.generalId);
        game.pushLog(`【${this.name}】${gen ? gen.name : '军队'} 占领 ${target.name}！`);
        return;
      }

      const gen = game.generals.get(army.generalId);
      // BUG修复（ai.js）：旧存档/模组武将的 effCommand/effForce 可能未计算或缺失，
      //   直接相乘得 NaN，`NaN > defPow*1.3` 恒为 false → AI 永不进攻（看似正常实则躺平）。
      //   此处做数值兜底，缺失时按 1 计算（与 gen 不存在时一致）。
      const eCmd = Number(gen && gen.effCommand) || 0;
      const eForce = Number(gen && gen.effForce) || 0;
      const atkPow = army.troops * (gen ? Math.max(1, (eCmd + eForce) / 100) : 1);
      // BUG修复（ai.js #4）：模组新增城市可能缺 defense 字段（undefined），
      //   原 `1 + target.defense/100` 得 NaN → defPow 为 NaN → 后续 `defPow * 1.1 > atkPow`
      //   恒为 false，AI「明明能打却不打」。修复：缺失时按默认防御 10 兜底。
      const defPow = target.garrison * (1 + (Number(target.defense) || 10) / 100);

      // V18.0：综合战场修正
      const { mod, reasons } = this._battleModifiers(army, target, game);
      const adjustedAtk = atkPow * mod;
      const ratio = this._attackRatio();

      // V4.0: AI进攻阈值 1.5→1.3（原值1.5，新值1.3，调整原因: 让AI更积极进攻但不过于鲁莽）
      // V4.0: 防御检查 — 若己方城市少于3座则优先防守，不主动攻城
      // 性能优化（ai.js #2）：改用本回合入口缓存的势力城市数 _turnCityCounts，
      //   替代此处再次全表 getFactionCities 扫描。
      const myCityCount = (this._turnCityCounts && this._turnCityCounts[this.factionId]) ||
        game.getFactionCities(this.factionId).length;
      if (myCityCount >= 3 && adjustedAtk > defPow * ratio) {
        game.attackCity(army, target);
        if (reasons.length) game.pushLog(`【${this.name}】攻 ${target.name}：${reasons.join('、')}`);
        return;
      }
    }

    // 进军前线
    for (const targetId of links) {
      const target = game.cities.get(targetId);
      if (!target) continue;
      if (target.owner === this.factionId) {
        const targetLinks = CITY_LINKS[targetId] || [];
        const nearEnemy = targetLinks.some(nid => {
          const n = game.cities.get(nid);
          return n && n.owner !== null && n.owner !== this.factionId;
        });
        if (nearEnemy && army.troops > 1000) {
          army.cityId = targetId;
          army.hasMoved = true;
          const gen = game.generals.get(army.generalId);
          if (gen) gen.location = army.id;
          game.pushLog(`【${this.name}】${gen ? gen.name : '军队'} 进军至 ${target.name}`);
          return;
        }
      }
    }
  }

  // ============================================================
  // V2.0 AI 强化
  // ============================================================
  // 建造建筑：V18.0 根据战略阶段动态决定优先级
  //   初期农业→中期商业→后期军事
  buildBuildings(game, res) {
    // V18.0：从战略规划器取阶段化优先级
    let priority = ['farm', 'market', 'barracks', 'walls', 'drill', 'workshop', 'temple'];
    try {
      const sp = (this._strategy && this._strategy.build) ||
        strategyPlanner.getBuildPriority(this.factionId, game);
      if (Array.isArray(sp) && sp.length) priority = sp;
    } catch (e) {}
    // 性能优化（ai.js #2）：复用本回合缓存城市表，替代每次 getFactionCities 全表扫描
    for (const city of (this._turnCities || game.getFactionCities(this.factionId))) {
      if (res.money < 200 || city.buildingThisTurn) continue;
      for (const bid of priority) {
        const b = BUILDINGS[bid];
        if (b.riverOnly && city.terrain !== 'river') continue;
        const cur = city.buildings[bid] || 0;
        if (cur >= b.maxLevel) continue;
        const cost = 150 + 120 * cur;
        if (res.money < cost) continue;
        const r = buildBuildingOnCity(city, bid, res);
        if (r.ok) game.pushLog(`【${this.name}】${city.name} ${r.msg}`);
        break; // 每城每回合仅一个
      }
    }
  }

  // 工坊打造装备，再给本势力空槽位武将穿最好的
  forgeAndEquip(game, res) {
    const inv = game.getInventory(this.factionId);
    // 性能优化（ai.js #2）：复用本回合缓存城市/武将表
    for (const city of (this._turnCities || game.getFactionCities(this.factionId))) {
      const wsLv = city.buildings['workshop'] || 0;
      if (wsLv >= 3 && res.money > 400 && Math.random() < 0.5) {
        const rarity = maxRarityByWorkshop(wsLv);
        const costBase = { common: 100, fine: 300, rare: 500, epic: 700, legendary: 900 }[rarity];
        const cost = Math.round(costBase * (1 - 0.10 * (wsLv - 1)));
        if (res.money >= cost) {
          res.money -= cost;
          const itemId = rollForgeItem(wsLv);
          if (itemId) inv.push(itemId);
        }
      }
    }
    // 把库存装备穿给本势力武将：按品质排序，依次填槽
    const RANK = { common: 0, fine: 1, rare: 2, epic: 3, legendary: 4 };
    inv.sort((a, b) => (RANK[getItem(b)?.rarity] || 0) - (RANK[getItem(a)?.rarity] || 0));
    const generals = this._turnGenerals || game.getFactionGenerals(this.factionId);
    for (let i = inv.length - 1; i >= 0; i--) {
      const item = getItem(inv[i]);
      if (!item) continue;
      // BUG修复（ai.js equipment 空指针）：旧存档/模组新武将可能尚未补全 equipment 字段
      //   （game.deserialize 虽有兜底，但 AI 在模组热加载/中途加入的武将不一定经过该路径）。
      //   原 `g.equipment[item.slot]` 遇 undefined.equipment 直接抛 TypeError，中断本势力整轮
      //   AI 结算。修复：把「找空槽位」改为同时要求 g.equipment 存在。
      const target = generals.find(g => g.equipment && !g.equipment[item.slot]);
      if (!target) continue;
      target.equipment[item.slot] = inv[i];
      inv.splice(i, 1);
    }
  }

  // 兵种进阶：有校场且有钱粮则整训
  advanceUnits(game, res) {
    // 性能优化（ai.js #2）：复用本回合缓存军队表
    for (const army of (this._turnArmies || game.getFactionArmies(this.factionId))) {
      const city = game.cities.get(army.cityId);
      if (!city || city.owner !== this.factionId) continue;
      const drillLv = city.buildings['drill'] || 0;
      for (const unitType of ['infantry', 'cavalry', 'archer']) {
        const tier = army.unitTier[unitType] || 0;
        const node = getUpgradeNode(unitType, tier + 1);
        if (!node || drillLv < node.drillLevel) continue;
        if (res.money < node.costMoney || res.food < node.costFood) continue;
        if (army.pendingUpgrades.some(p => p.unitType === unitType)) continue;
        const r = army.requestUpgrade(unitType, drillLv);
        if (r.ok) {
          res.money -= node.costMoney;
          res.food -= node.costFood;
          game.pushLog(`【${this.name}】${r.msg}`);
        }
      }
    }
  }

  // 建立商路：在有市集的两座城之间
  establishTrade(game, res) {
    if (game.tradeRoutes.length >= 5) return;
    if (res.money < 500) return;
    // 性能优化（ai.js #2）：复用本回合缓存城市表
    const cities = (this._turnCities || game.getFactionCities(this.factionId))
      .filter(c => (c.buildings['market'] || 0) >= 1);
    for (let i = 0; i < cities.length; i++) {
      for (let j = i + 1; j < cities.length; j++) {
        if (game.tradeRoutes.length >= 5) return;
        const c1 = cities[i], c2 = cities[j];
        const dup = game.tradeRoutes.some(r =>
          (r.city1 === c1.id && r.city2 === c2.id) ||
          (r.city1 === c2.id && r.city2 === c1.id));
        if (dup) continue;
        res.money -= 500;
        game.tradeRoutes.push({ id: 'trade_' + Date.now() + '_' + i + '_' + j, city1: c1.id, city2: c2.id });
        game.pushLog(`【${this.name}】开通商路：${c1.name} ↔ ${c2.name}`);
        return;
      }
    }
  }

  // ============================================================
  // V2.5 AI 行为
  // ============================================================
  // 弱势外交：若有强邻，尝试送人质求和或提议联姻
  // V18.0：深化为调用 DiplomacySystem.getAIProposal 获取智能提案
  weakDiplomacy(game, res, isWeak) {
    if (!isWeak) return;
    // 性能优化#3：使用本回合缓存的势力城市数
    const counts = this._turnCityCounts || {};
    const myStrength = counts[this.factionId] || 0;
    // 找最强敌对阵营
    let strongest = null, maxN = -1;
    for (const fid of Object.keys(FACTIONS)) {
      if (fid === this.factionId) continue;
      const n = counts[fid] || 0;
      if (n > maxN) { maxN = n; strongest = fid; }
    }
    if (!strongest || maxN <= myStrength) return;
    // BUG修复#5：防御性校验——getRelation 可能返回 null（势力关系未初始化），
    // 直接访问 rel.alliance 会导致 TypeError 崩溃。此处做空值兜底。
    const rel = game.diplomacy.getRelation(this.factionId, strongest);
    if (!rel || rel.alliance) return;

    // V18.0：调用外交AI智能提案（联姻/人质/和亲/停战）
    try {
      if (typeof game.diplomacy.getAIProposal === 'function') {
        const proposal = game.diplomacy.getAIProposal(this.factionId, strongest, game);
        if (proposal && proposal.type) {
          const idleGen = this._pickIdleGeneral(game);
          if (proposal.type === 'hostage' && idleGen) {
            const r = game.diplomacy.sendHostage(game, this.factionId, strongest, idleGen.id);
            if (r.ok) game.pushLog(`【${this.name}】遣 ${idleGen.name} 入 ${FACTIONS[strongest].name} 为质以求苟安`);
            return;
          }
          if (proposal.type === 'marriage' && idleGen) {
            const r = game.diplomacy.proposeMarriage(game, this.factionId, strongest, idleGen.id);
            if (r.ok) game.pushLog(`【${this.name}】与 ${FACTIONS[strongest].name} 议亲结好`);
            return;
          }
          if (proposal.type === 'heqin') {
            const r = game.diplomacy.proposeHeqin(game, this.factionId, strongest);
            if (r.ok) game.pushLog(`【${this.name}】以宗女和亲 ${FACTIONS[strongest].name}，以求苟安`);
            return;
          }
          if (proposal.type === 'ceasefire') {
            const r = game.diplomacy.proposeCeasefire(this.factionId, strongest);
            if (r.ok) game.pushLog(`【${this.name}】与 ${FACTIONS[strongest].name} 停战求和`);
            return;
          }
        }
      }
    } catch (e) {}

    // 兜底：70% 概率送人质求和；否则尝试联姻
    const idleGen = this._pickIdleGeneral(game);
    if (Math.random() < 0.7) {
      if (idleGen) {
        const r = game.diplomacy.sendHostage(game, this.factionId, strongest, idleGen.id);
        if (r.ok) game.pushLog(`【${this.name}】遣 ${idleGen.name} 入 ${FACTIONS[strongest].name} 为质以求苟安`);
      }
    } else {
      if (idleGen) {
        const r = game.diplomacy.proposeMarriage(game, this.factionId, strongest, idleGen.id);
        if (r.ok) game.pushLog(`【${this.name}】与 ${FACTIONS[strongest].name} 议亲结好`);
      }
    }
  }

  // ============================================================
  // V18.0：AI 智能深化新方法
  // ============================================================

  // V18.0：武将管理——把最好的武将放到最关键方向
  //   提拔：高统帅/武力武将分配到高威胁边境城市/首都
  //   罢免：低忠诚庸才不分配到关键位置
  manageGenerals(game) {
    try {
      const assignment = strategyPlanner.getGeneralAssignment(this.factionId, game);
      const gens = this._turnGenerals || game.getFactionGenerals(this.factionId);
      for (const gen of gens) {
        if (gen.inArmy || gen.onHostage || gen.role === '君主') continue;
        const newCityId = assignment[gen.id];
        if (!newCityId) continue;
        // 低忠诚者不放到前线（避免被策反）
        if ((Number(gen.loyalty) || 0) < 35) continue;
        const targetCity = game.cities.get(newCityId);
        if (targetCity && gen.location !== newCityId) {
          gen.location = newCityId;
        }
      }
    } catch (e) {}
  }

  // V18.0：消耗过大时主动求和
  //   条件：与某势力交战中、己方兵力/经济明显透支
  seekPeaceIfWeary(game) {
    try {
      if (this.difficulty === 'hard') return; // hard 模式不轻易求和
      let shouldSeek = false;
      let target = null;
      // 调用外交AI：shouldAISeekPeace
      if (typeof game.diplomacy.shouldAISeekPeace === 'function') {
        const result = game.diplomacy.shouldAISeekPeace(this.factionId, game);
        shouldSeek = !!(result && result.seek);
        target = result && result.target;
      }
      if (!shouldSeek || !target) return;
      const rel = game.diplomacy.getRelation(this.factionId, target);
      if (!rel || rel.ceasefire || rel.alliance) return;
      const r = game.diplomacy.proposeCeasefire(this.factionId, target);
      if (r.ok) game.pushLog(`【${this.name}】国力疲敝，与 ${FACTIONS[target].name} 停战休兵`);
    } catch (e) {}
  }

  // V18.0：防守决策——判断某城该守还是该弃
  //   返回 { hold: bool, reason: string }
  shouldDefendCity(city, game) {
    if (!city || city.owner !== this.factionId) return { hold: true, reason: '非本势力' };
    try {
      const th = strategyPlanner.getThreatLevel(this.factionId, city.owner, game);
      // 首都必守
      const capId = (FACTIONS[this.factionId] || {}).capital;
      if (capId && city.id === capId) return { hold: true, reason: '宗庙所在，必守' };
      // 高威胁且守军薄弱 → 考虑弃城（收缩防线）
      const garrison = Number(city.garrison) || 0;
      if (th >= 80 && garrison < 1500 && this.difficulty !== 'hard') {
        return { hold: false, reason: '孤城难守，暂避锋芒' };
      }
      return { hold: true, reason: th >= 60 ? '重镇必守' : '照常驻守' };
    } catch (e) {
      return { hold: true, reason: '默认驻守' };
    }
  }

  _pickIdleGeneral(game) {
    // BUG修复（ai.js V20.0 _pickIdleGeneral 全表扫描）：
    //   优化前：每次调用都 `game.getFactionGenerals(this.factionId)` 对全部武将做一次全表 filter。
    //   weakDiplomacy 单次回合内最多调用本方法两次（智能提案分支 + 兜底分支），
    //   204 将规模下每个弱势 AI 每回合就多 2 次全表扫描，F 个 AI 累计显著。
    //   修复：优先复用 takeTurn 入口缓存的 _turnGenerals（同一势力、同一回合快照），
    //   仅在缓存缺失（异常路径）时回退原全表扫描。
    const gens = this._turnGenerals || game.getFactionGenerals(this.factionId);
    return gens.find(g => !g.inArmy && !g.onHostage && g.role !== '君主') || null;
  }

  // AI 派遣密探刺探玩家情报
  aiSendSpy(game, res) {
    if (game.playerFaction === this.factionId) return;
    if (res.money < SPY_COST.intel + 200) return;
    // 挑玩家兵力最强城市
    const targets = game.getFactionCities(game.playerFaction)
      .filter(c => c.garrison > 0);
    if (!targets.length || Math.random() < 0.5) return;
    const target = targets.sort((a, b) => b.garrison - a.garrison)[0];
    sendSpy(game, this.factionId, target.id, 'intel');
  }

  // AI 建造关键关隘：本势力城市是关隘 locationCity 时建之
  aiBuildPass(game, res) {
    if (res.money < 1200) return;
    // BUG修复（ai.js V20.0 aiBuildPass 重复全表扫描）：
    //   优化前：① 用 game.getFactionCities(this.factionId) 对全部城市做一次全表 filter；
    //   ② 循环体内对「每一座城」都重算一次
    //      `Object.values(game.passes).some(p => p.pending>0 && p.owner===this.factionId)`
    //      ——这是 O(关隘数) 的扫描，却在每座城上重复一次，O(城市数×关隘数)。
    //   且原写法一旦本势力已有在修关隘，理应直接 return，但它仍在每座城上重判。
    //   修复：a) 用本回合缓存的 _turnCities 替代全表 filter；
    //         b) 本势力是否已有在修关隘只在循环外算一次，命中即 return，不再重复扫描。
    const myPending = Object.values(game.passes)
      .some(p => p.pending > 0 && p.owner === this.factionId);
    if (myPending) return;
    for (const city of (this._turnCities || game.getFactionCities(this.factionId))) {
      // 找到该城可建的关隘（用静态表 locationCity 匹配）
      const target = Object.keys(game.passes).find(pid => {
        const rt = game.passes[pid];
        if (rt.built || rt.pending) return false;
        const sp = (typeof getPassById === 'function') ? getPassById(pid) : null;
        return sp && sp.locationCity === city.id;
      });
      if (!target) continue;
      const r = requestBuildPass(game, this.factionId, city.id, target);
      if (r.ok) game.pushLog(`【${this.name}】${r.msg}`);
      return;
    }
  }

  // AI 征讨/招安邻近蛮族
  aiBarbarianActions(game, res) {
    for (const tribe of (game.barbarianTribes || [])) {
      if (tribe.vassal) continue;
      const anchor = game.cities.get(tribe.anchorCity);
      if (!anchor || anchor.owner !== this.factionId) continue;
      // 关系尚可 → 贸易或招安；关系差 → 征讨
      if (tribe.relation >= BARBARIAN_RECRUIT_REL_MIN && res.money >= 2000) {
        const r = recruitBarbarian(game, this.factionId, tribe.id);
        if (r.ok) game.pushLog(`【${this.name}】${r.msg}`);
      } else if (tribe.relation < -20 && res.money > 800) {
        // 性能优化（ai.js #2）：复用本回合缓存军队表，避免每部落一次全表扫描
        const myArmies = this._turnArmies || game.getFactionArmies(this.factionId);
        const army = myArmies
          .filter(a => a.cityId === tribe.anchorCity && a.troops > 2000)
          .sort((a, b) => b.troops - a.troops)[0];
        if (army) {
          const r = attackBarbarian(game, this.factionId, tribe.id);
          if (r.ok) game.pushLog(`【${this.name}】${r.msg}`);
        }
      }
    }
  }
}
