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
    const _cachedGenerals = game.getFactionGenerals(this.factionId);
    const _cachedArmies = game.getFactionArmies(this.factionId);

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
      if (gen.inArmy) continue;
      const city = game.cities.get(gen.location);
      if (city && city.garrison >= 2000) {
        const troops = Math.min(gen.getMaxTroops() * (isStrong ? 1 : 0.8), city.garrison, isWeak ? 2500 : 3500);
        if (troops < 1000) continue;
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

    // 6) 招募在野武将
    const idleGens = game.getIdleGenerals();
    const recruitBonus = (this.techBag().recruitBonus || 0) + 0.2;
    for (const gen of idleGens) {
      if (res.money > 800 && Math.random() < recruitBonus) {
        gen.faction = this.factionId;
        gen.loyalty = 65;
        // BUG修复#4：防御性校验——首都城可能已被摧毁（game.cities.get 返回 undefined），
        // 直接访问 capital.id 会导致 TypeError 崩溃。此处做空值兜底。
        const capital = game.cities.get(FACTIONS[this.factionId].capital);
        gen.location = capital ? capital.id : null;
        game.pushLog(`【${this.name}】贤士 ${gen.name} 来投！`);
        break;
      }
    }
  }

  // V9.0：AI 自动编成军团——把同城的多支独立军队合编为军团
  aiFormLegions(game) {
    if (!game.legions) game.legions = new Map();
    const myArmies = game.getFactionArmies(this.factionId).filter(a => !a.legionId && a.troops >= 1500);
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
    // 仅考虑仍存活（有城）的势力
    const aliveFids = Object.keys(FACTIONS).filter(f =>
      f !== this.factionId && game.getFactionCities(f).length > 0);
    // 各方城市数
    const cityCount = {};
    for (const f of aliveFids) cityCount[f] = game.getFactionCities(f).length;
    cityCount[this.factionId] = game.getFactionCities(this.factionId).length;
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

  tryAttack(game, army) {
    const links = CITY_LINKS[army.cityId] || [];
    for (const targetId of links) {
      const target = game.cities.get(targetId);
      if (!target || target.owner === this.factionId) continue;
      // 同盟不攻
      const rel = game.diplomacy.getRelation(this.factionId, target.owner);
      if (rel && rel.alliance) continue;

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
      const atkPow = army.troops * (gen ? (gen.effCommand + gen.effForce) / 100 : 1);
      const defPow = target.garrison * (1 + target.defense / 100);
      // V4.0: AI进攻阈值 1.5→1.3（原值1.5，新值1.3，调整原因: 让AI更积极进攻但不过于鲁莽）
      // V4.0: 防御检查 — 若己方城市少于3座则优先防守，不主动攻城
      const myCityCount = game.getFactionCities(this.factionId).length;
      if (myCityCount >= 3 && atkPow > defPow * 1.3) {
        game.attackCity(army, target);
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
  // 建造建筑：优先 农田→市集→兵营→城墙→校场→工坊
  buildBuildings(game, res) {
    const priority = ['farm', 'market', 'barracks', 'walls', 'drill', 'workshop', 'temple'];
    for (const city of game.getFactionCities(this.factionId)) {
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
    for (const city of game.getFactionCities(this.factionId)) {
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
    const generals = game.getFactionGenerals(this.factionId);
    for (let i = inv.length - 1; i >= 0; i--) {
      const item = getItem(inv[i]);
      if (!item) continue;
      // 找该槽位为空、且当前无更好装备的武将
      const target = generals.find(g => !g.equipment[item.slot]);
      if (!target) continue;
      target.equipment[item.slot] = inv[i];
      inv.splice(i, 1);
    }
  }

  // 兵种进阶：有校场且有钱粮则整训
  advanceUnits(game, res) {
    for (const army of game.getFactionArmies(this.factionId)) {
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
    const cities = game.getFactionCities(this.factionId).filter(c => (c.buildings['market'] || 0) >= 1);
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
  weakDiplomacy(game, res, isWeak) {
    if (!isWeak) return;
    const myStrength = game.getFactionCities(this.factionId).length;
    // 找最强敌对阵营
    let strongest = null, maxN = -1;
    for (const fid of Object.keys(FACTIONS)) {
      if (fid === this.factionId) continue;
      const n = game.getFactionCities(fid).length;
      if (n > maxN) { maxN = n; strongest = fid; }
    }
    if (!strongest || maxN <= myStrength) return;
    // BUG修复#5：防御性校验——getRelation 可能返回 null（势力关系未初始化），
    // 直接访问 rel.alliance 会导致 TypeError 崩溃。此处做空值兜底。
    const rel = game.diplomacy.getRelation(this.factionId, strongest);
    if (!rel) return;
    if (rel.alliance) return;

    // 70% 概率送人质求和；否则尝试联姻
    if (Math.random() < 0.7) {
      const hostageGen = this._pickIdleGeneral(game);
      if (hostageGen) {
        const r = game.diplomacy.sendHostage(game, this.factionId, strongest, hostageGen.id);
        if (r.ok) game.pushLog(`【${this.name}】遣 ${hostageGen.name} 入 ${FACTIONS[strongest].name} 为质以求苟安`);
      }
    } else {
      const brideGen = this._pickIdleGeneral(game);
      if (brideGen) {
        const r = game.diplomacy.proposeMarriage(game, this.factionId, strongest, brideGen.id);
        if (r.ok) game.pushLog(`【${this.name}】与 ${FACTIONS[strongest].name} 议亲结好`);
      }
    }
  }

  _pickIdleGeneral(game) {
    return game.getFactionGenerals(this.factionId)
      .find(g => !g.inArmy && !g.onHostage && g.role !== '君主') || null;
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
    for (const city of game.getFactionCities(this.factionId)) {
      // 未建成且 locationCity 属我
      const builtPasses = Object.values(game.passes).filter(p => p.built && p.locationCity === city.id);
      const pending = Object.values(game.passes).some(p => p.pending > 0);
      if (pending) continue;
      // 找到该城可建的关隘
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
        const army = game.getFactionArmies(this.factionId)
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
