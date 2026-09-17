// ============================================================
// game.js — 游戏主类、状态机、回合管理
// ============================================================
import { FACTIONS, SEASONS, CITY_LINKS, UNIT_TYPES, COUNTER_RELATION, GENERALS,
         NEW_GENERAL_SKILLS, SCENARIOS, DEFAULT_SCENARIO } from './data.js';
import { City, createInitialCities } from './city.js';
import { General, createInitialGenerals } from './general.js';
import {
  Army, computeBattle, getMoveableCities, getAttackableCities, citiesAdjacent,
  startMultiBattle, resolveBattleRound, autoAction
} from './army.js';
import { AIPlayer } from './ai.js';
import { EventSystem } from './events.js';
import { DiplomacySystem } from './diplomacy.js';
import { getGeneralSkills, getActiveSkills, getSkill } from './skills.js';
import { getTech, isTechAvailable, aggregateTechEffects, getTechTreeData } from './tech.js';
import { checkAchievements, getAchievementList } from './achievements.js';
import { getItem, checkBonds, rollForgeItem, maxRarityByWorkshop } from './equipment.js';
import { getFormationBag, getFormation, FORMATIONS, DEFAULT_FORMATION } from './formation.js';
import { BUILDINGS, buildBuildingOnCity, getBuilding } from './building.js';
import { getUpgradeNode } from './data.js';
// ---- V6.0 新系统 ----
import { NAVY_UNITS, RIVER_CITIES, canBuildNavy, getNavyMoveableCities, getNavyAttackableCities,
         isNavalBattle, applyWaterTerrainMod, checkFireAttack, NAVY_BUILD_COSTS } from './navy.js';
import { ReligionSystem, calcFactionCulture, RELIGION_EVENTS, canBuildGrotto, getGrottoBuildCost } from './religion.js';
// ---- V2.5 新系统 ----
import { sendSpy, resolveSpies } from './espionage.js';
import { computeVisibleCities, settleFog, isExplored } from './fog.js';
import { initPasses, requestBuildPass, settlePasses, getBlockingPass, attackPass } from './pass.js';
import { computeSupplyStatus, supplyFoodMult, supplyBattleBag } from './supply.js';
import { initBarbarianTribes, attackBarbarian, recruitBarbarian, tradeBarbarian, settleBarbarians } from './barbarian.js';
// ---- V3.0 新系统 ----
import { StorySystem, STORY_NODES } from './story.js';
import { EndingSystem, ENDINGS } from './ending.js';
// ---- V3.5 新系统 ----
import { loadNGPlusData, getNGPlusBonus, saveNGPlusData, isIntroCompleted } from './ngplus.js';
import { checkTitles, getActiveTitleBonus, equipTitle, TITLES } from './titles.js';
import { defaultGameStats, recordTurn, recordBattle, recordIncome, recordEnding } from './stats.js';
// ---- V4.0 模组系统 ----
import { modManager, deepMerge, clamp } from './modding.js';
import { FACTIONS as MOD_FACTIONS, CITIES as MOD_CITIES, GENERALS as MOD_GENERALS,
         EVENTS as MOD_EVENTS, UNIT_TYPES as MOD_UNIT_TYPES,
         HISTORICAL_EVENTS as MOD_HIST_EVENTS, PASSES as MOD_PASSES,
         BARBARIAN_TRIBES as MOD_BARBARIANS, NEW_GENERAL_SKILLS as MOD_GEN_SKILLS,
         CITY_LINKS as MOD_CITY_LINKS } from './data.js';
import { SKILLS as MOD_SKILLS } from './skills.js';
import { TECHS as MOD_TECHS } from './tech.js';
import { EQUIPMENT_ITEMS as MOD_EQUIP } from './equipment.js';
import { FORMATIONS as MOD_FORMATIONS } from './formation.js';
import { BUILDINGS as MOD_BUILDINGS } from './building.js';
// V7.0 新系统
import { DynastySystem, DYNASTIES, ANCIENT_CAPITALS } from './dynasty.js';
import { TradeSystem } from './trade.js';
import { OFFICES, TITLES as RANKS, getOffice, getTitle, canHoldOffice, aggregateOfficeBag } from './office.js';

let armyIdCounter = 100;

export class Game {
  constructor() {
    this.state = 'menu';
    this.turn = 1;
    this.seasonIdx = 0;
    this.playerFaction = null;
    this.cities = new Map();
    this.generals = new Map();
    this.armies = [];
    this.factionRes = new Map();
    this.diplomacy = new DiplomacySystem();
    this.eventSystem = new EventSystem();
    this.log = [];
    this.selectedCity = null;
    this.selectedArmy = null;
    this.battleResult = null;
    this.gameOver = null;
    this.aiPlayers = new Map();

    // ---- 新增系统状态 ----
    this.techs = [];                 // 玩家已研究科技 id
    this.researching = null;         // { techId, turnsLeft }
    this.achievements = {};          // { id: unlockTurn }
    this.pendingAchievements = [];   // 待弹窗成就 id
    this.activeBattle = null;        // 进行中的多回合战斗
    this.stats = this._defaultStats();
    this.initialIdleCount = 3;       // 开局在野武将数（人才济济成就基准）
    this.garrisonBuffTurns = 0;      // 玉璧围城等事件的临时守城加成

    // ---- V2.0 新系统状态 ----
    this.tradeRoutes = [];           // 贸易路线 [{city1, city2, id}]
    this.inventory = new Map();      // factionId -> [itemId]（装备库存）

    // ---- V2.5 新系统状态 ----
    this.marriages = [];             // 联姻记录
    this.hostages = [];              // 人质记录
    this.spies = [];                 // 密探任务
    this.fogOfWar = { explored: [], intelVision: {} }; // 战争迷雾
    this.passes = initPasses();      // 关隘运行时表
    this.supplyLines = {};           // 军队补给线指定 { armyId: depotCityId }
    this.barbarianTribes = initBarbarianTribes(); // 蛮族部落

    // ---- V3.0 新系统状态 ----
    this.scenario = DEFAULT_SCENARIO;        // 当前剧本 id（'550'/'534'/'575'/'581'）
    this.story = new StorySystem();          // 武将个人剧情
    this.endings = new EndingSystem();       // 结局系统
    this.barbarianControlCenters = 0;        // 蛮族占领的中原城数（蛮族入主结局用）

    // ---- V5.0 热座多人模式 ----
    this.isHotSeat = false;                  // 是否热座模式
    this.humanFactions = [];                 // 由人类控制的势力 id 列表
    this.turnOrder = [];                     // 当前回合行动顺序 [fid,...]
    this.currentPlayerIndex = 0;             // turnOrder 中当前行动的玩家下标

    // ---- V5.5 局域网对战模式 ----
    this.netRole = null;                     // null | 'host' | 'client'
    this.netOpponentFaction = null;          // 客机势力 id（主机视角）
    this._netPendingEndTurn = false;         // 客机结束回合标记

    // ---- V3.5 新系统状态 ----
    this.ngPlusLevel = 0;                    // 当前周目（0=首次）
    this.unlockedTitles = {};                // { generalId: [titleId,...] }
    this.activeTitles = {};                  // { generalId: [titleId,...] }（装备中）
    this.gameStats = defaultGameStats();    // 全局统计
    this.generalStats = {};                  // { generalId: {totalBattles,totalWins,maxKills,...} }
    this.introCompleted = isIntroCompleted();// 开场演出状态
    this._ngplusData = null;                // 本周目继承数据（initGame 时读取）
    this.pendingTitles = [];                // 待弹窗称号通知

    // ---- V6.0 新系统状态 ----
    this.religionSystem = new ReligionSystem();  // 宗教文化系统
    this.navyBuilt = {};                     // { cityId: [navyUnitIds] } 已建造水军
    this.cultureVictoryTurns = 0;            // 文化胜利维持回合数

    // ---- V7.0 新系统状态 ----
    this.dynastySystem = new DynastySystem(); // 王朝/正统/年号/禅让
    this.tradeSystem = new TradeSystem();      // 贸易商路/商队/协定
  }

  _defaultStats() {
    return {
      wins: 0, losses: 0, winStreak: 0, bestWinStreak: 0,
      citiesConquered: 0, siegesDefended: 0, underdogWins: 0, idleRecruited: 0
    };
  }

  // ============================================================
  // V4.0 — 模组系统
  // ============================================================
  // 收集所有基础数据的引用，供 ModManager 深合并
  static _collectDataRefs() {
    return {
      FACTIONS: MOD_FACTIONS,
      CITIES: MOD_CITIES,
      GENERALS: MOD_GENERALS,
      SKILLS: MOD_SKILLS,
      TECHS: MOD_TECHS,
      EQUIPMENT_ITEMS: MOD_EQUIP,
      FORMATIONS: MOD_FORMATIONS,
      BUILDINGS: MOD_BUILDINGS,
      EVENTS: MOD_EVENTS,
      UNIT_TYPES: MOD_UNIT_TYPES,
      HISTORICAL_EVENTS: MOD_HIST_EVENTS,
      PASSES: MOD_PASSES,
      BARBARIAN_TRIBES: MOD_BARBARIANS,
      NEW_GENERAL_SKILLS: MOD_GEN_SKILLS,
      CITY_LINKS: MOD_CITY_LINKS
    };
  }

  // 应用所有已启用模组（在 initGame 之前调用一次）
  static applyMods() {
    const refs = Game._collectDataRefs();
    modManager.takeBaseSnapshot(refs);
    modManager.applyMods(refs);
  }

  // 获取模组管理器实例
  static getModManager() { return modManager; }

  // ---------- 初始化新游戏 ----------
  // scenarioId：'550' 群雄并起 / '534' 三足鼎立 / '575' 北周伐齐 / '581' 隋文统一
  // humanFactions（V5.0，可选）：传入 >=2 个势力 id 即进入热座多人模式；
  //   playerFactionId 视为 turnOrder 中首个行动的人类势力。
  initGame(playerFactionId, scenarioId, humanFactions) {
    this.playerFaction = playerFactionId;
    this.scenario = (scenarioId && SCENARIOS[scenarioId]) ? scenarioId : DEFAULT_SCENARIO;
    // ---- V5.0 热座初始化 ----
    this.isHotSeat = Array.isArray(humanFactions) && humanFactions.length >= 2;
    this.humanFactions = this.isHotSeat ? [...humanFactions] : [];
    this.turnOrder = [];
    this.currentPlayerIndex = 0;
    this.cities = new Map();
    this.generals = new Map();
    this.armies = [];
    this.factionRes = new Map();
    this.log = [];
    this.selectedCity = null;
    this.selectedArmy = null;
    this.battleResult = null;
    this.gameOver = null;
    this.turn = 1;
    this.seasonIdx = 0;
    this.diplomacy = new DiplomacySystem();
    this.eventSystem = new EventSystem();
    // 新系统重置
    this.techs = [];
    this.researching = null;
    this.achievements = {};
    this.pendingAchievements = [];
    this.activeBattle = null;
    this.stats = this._defaultStats();
    this.garrisonBuffTurns = 0;
    this.tradeRoutes = [];
    this.inventory = new Map();
    // V2.5 重置
    this.marriages = [];
    this.hostages = [];
    this.spies = [];
    this.fogOfWar = { explored: [], intelVision: {} };
    this.passes = initPasses();
    this.supplyLines = {};
    this.barbarianTribes = initBarbarianTribes();
    // V3.0 重置
    this.story = new StorySystem();
    this.endings = new EndingSystem();
    this.barbarianControlCenters = 0;
    // V3.5 重置
    this.unlockedTitles = {};
    this.activeTitles = {};
    this.generalStats = {};
    this.gameStats = defaultGameStats();
    this.gameStats.startTimestamp = Date.now();
    this.initialIdleCount = GENERALS.filter(g => g.faction === null && g.id !== 'yang_jian').length;
    // V6.0 重置
    this.religionSystem = new ReligionSystem();
    this.navyBuilt = {};
    this.cultureVictoryTurns = 0;
    // V7.0 重置
    this.dynastySystem = new DynastySystem();
    this.tradeSystem = new TradeSystem();

    const cityList = createInitialCities();
    for (const c of cityList) this.cities.set(c.id, c);
    const genList = createInitialGenerals();
    for (const g of genList) this.generals.set(g.id, g);

    // 根据剧本决定激活哪些势力。'534' 仅激活 nanchao/dongwei/xiwei，
    // 其余势力的城市收归无主、武将下野（模拟三足鼎立开局）。
    const sc = SCENARIOS[this.scenario];
    const activeFactions = sc.factions;
    // 名称回退（534 剧本称梁/魏/魏）
    for (const [fid, override] of Object.entries(sc.factionNameOverride || {})) {
      if (FACTIONS[fid]) FACTIONS[fid].name = override;
    }
    // 非激活势力：城市无主、武将下野
    for (const [fid, faction] of Object.entries(FACTIONS)) {
      if (!activeFactions.includes(fid)) {
        for (const cid of faction.startCities) {
          const c = this.cities.get(cid);
          if (c) c.owner = null;
        }
        for (const g of this.generals.values()) {
          if (g.faction === fid) g.faction = null;
        }
      }
    }

    for (const [fid, faction] of Object.entries(FACTIONS)) {
      if (!activeFactions.includes(fid)) continue; // 非激活势力不初始化资源/AI
      for (const cid of faction.startCities) {
        const c = this.cities.get(cid);
        if (c) c.owner = fid;
      }
      // V5.0：剧本开局资源覆盖（默认 2000/1500 金、3000 粮）
      const scRes = (sc.resources && sc.resources[fid]) || null;
      this.factionRes.set(fid, {
        money: scRes ? scRes.money : (fid === playerFactionId ? 2000 : 1500),
        food: scRes ? scRes.food : 3000,
        totalMorale: 60
      });
      this.inventory.set(fid, []);
    }

    for (const gen of this.generals.values()) {
      if (gen.faction && gen.faction !== null) {
        const fac = FACTIONS[gen.faction];
        gen.location = fac.capital;
        const capital = this.cities.get(fac.capital);
        if (capital && !capital.garrison) capital.garrison = 5000;
      }
    }
    for (const [fid, faction] of Object.entries(FACTIONS)) {
      if (!activeFactions.includes(fid)) continue;
      // V5.0：剧本驻军倍率
      const gm = (sc.garrisonMult && sc.garrisonMult[fid]) || 1;
      for (const cid of faction.startCities) {
        const c = this.cities.get(cid);
        if (c) {
          if (!c.garrison) c.garrison = 3000;
          c.garrison = Math.round(c.garrison * gm);
        }
      }
    }
    // V5.0：剧本民心 / 武将忠诚覆盖
    for (const [fid, morale] of Object.entries(sc.cityMorale || {})) {
      for (const c of this.getFactionCities(fid)) c.morale = morale;
    }
    for (const [fid, loyalty] of Object.entries(sc.generalLoyalty || {})) {
      for (const g of this.getFactionGenerals(fid)) g.loyalty = loyalty;
    }

    // V5.0：AI 玩家仅为「激活且非人类控制」的势力创建；并构建行动顺序
    this.aiPlayers = new Map();
    for (const fid of activeFactions) {
      if (this.humanFactions.includes(fid)) continue;
      this.aiPlayers.set(fid, new AIPlayer(fid));
    }
    // 行动顺序：人类势力按选择顺序在前，AI 势力按 FACTIONS 顺序在后
    this.turnOrder = [
      ...(this.isHotSeat ? this.humanFactions : [playerFactionId]),
      ...[...this.aiPlayers.keys()]
    ];
    this.currentPlayerIndex = this.isHotSeat
      ? Math.max(0, this.turnOrder.indexOf(playerFactionId)) : 0;
    this.setupInitialArmies();

    // ---- V7.0：初始化王朝系统（君主/年号/正统）----
    this.dynastySystem.init(sc.factions, this.generals);
    for (const fid of sc.factions) this.dynastySystem.calcLegitimacy(this, fid);

    // ---- V3.5：应用周目继承加成（热座模式下跳过，避免人类间数值失衡）----
    if (!this.isHotSeat) this._applyNGPlusBonus(playerFactionId);

    this.state = 'playing';
    this.pushLog(`—— 第 ${this.turn} 回合 · ${SEASONS[this.seasonIdx]}季 ——（${sc.name} · ${sc.year}年）——`);
    if (this.isHotSeat) {
      this.pushLog(`◆ 热座模式：${this.humanFactions.map(f => FACTIONS[f].name).join(' / ')} 轮流执政（共 ${this.turnOrder.length} 方势力）`);
    }
    this.pushLog(`${FACTIONS[playerFactionId].name} 开始称霸之路！`);
    if (typeof window !== 'undefined') window.__game = this;
  }

  // ============================================================
  // V5.0 — 热座多人模式工具
  // ============================================================
  // 某势力是否存活（仍拥有至少一座城市）
  _factionAlive(fid) {
    return this.getFactionCities(fid).length > 0;
  }
  // 当前活跃（人类）势力名称
  getActiveFactionName() {
    return this.playerFaction && FACTIONS[this.playerFaction] ? FACTIONS[this.playerFaction].name : '';
  }
  // 热座：人类玩家名单（仅存活）
  getAliveHumanFactions() {
    return this.humanFactions.filter(f => this._factionAlive(f));
  }
  // 热座终局检测：人类统一 / 最后存活人类 / 人类全灭
  _checkHotSeatEnd() {
    if (!this.isHotSeat || this.gameOver) return;
    const aliveHumans = this.getAliveHumanFactions();
    this.humanFactions = aliveHumans;
    const total = this.cities.size || 30;
    // 1) 任一人类势力一统天下
    for (const fid of aliveHumans) {
      if (this.getFactionCities(fid).length >= total - 1) {
        this.gameOver = { win: true, text: `${FACTIONS[fid].name}一统天下！（人类玩家胜利）` };
        this.state = 'gameover';
        return;
      }
    }
    // 2) 人类全灭
    if (aliveHumans.length === 0) {
      this.gameOver = { win: false, text: '所有人类控制的势力皆已覆灭……热座终局。' };
      this.state = 'gameover';
      return;
    }
    // 3) 只剩一个人类势力且所有 AI 势力皆灭 → 最后存活人类
    const aliveAI = [...this.aiPlayers.keys()].filter(f => this._factionAlive(f));
    if (aliveHumans.length === 1 && aliveAI.length === 0) {
      this.gameOver = { win: true, text: `${FACTIONS[aliveHumans[0]].name}笑到最后，天下终归人类之手！` };
      this.state = 'gameover';
    }
  }

  setupInitialArmies() {
    for (const [fid, faction] of Object.entries(FACTIONS)) {
      const capital = this.cities.get(faction.capital);
      const myGenerals = [...this.generals.values()].filter(g => g.faction === fid && g.location === faction.capital);
      if (myGenerals.length > 0 && capital && capital.garrison >= 3000) {
        const g = myGenerals[0];
        const troops = Math.min(3000, capital.garrison);
        capital.garrison -= troops;
        const army = new Army({
          factionId: fid, generalId: g.id, cityId: faction.capital,
          troops: troops, unitMix: { infantry: 1500, cavalry: 600, archer: 900 }
        });
        this.armies.push(army);
        g.inArmy = army.id;
      }
    }
  }

  // ---------- 工具 ----------
  getGeneral(id) { return this.generals.get(id); }
  getCity(id) { return this.cities.get(id); }
  getFactionCities(fid) { return [...this.cities.values()].filter(c => c.owner === fid); }
  getFactionGenerals(fid) { return [...this.generals.values()].filter(g => g.faction === fid); }
  getFactionArmies(fid) { return this.armies.filter(a => a.faction === fid); }
  getSeason() { return SEASONS[this.seasonIdx]; }
  getPlayerRes() { return this.factionRes.get(this.playerFaction); }

  // ============================================================
  // V6.0 — 海战系统
  // ============================================================
  // 检查城市是否可建造水军（河流城市 + 码头≥3级）
  canBuildNavyOnCity(cityId) {
    const city = this.cities.get(cityId);
    if (!city) return false;
    return canBuildNavy(city);
  }

  // 建造水军（在河流城市建造一支水军部队）
  buildNavy(cityId, navyUnitType) {
    const city = this.cities.get(cityId);
    if (!city) return { ok: false, msg: '城市不存在' };
    if (!canBuildNavy(city)) return { ok: false, msg: '需河流城市且码头≥3级' };
    const cost = NAVY_BUILD_COSTS[navyUnitType];
    if (!cost) return { ok: false, msg: '水军类型不存在' };
    const res = this.getPlayerRes();
    if (!res || res.money < cost) return { ok: false, msg: `金钱不足（需${cost}金）` };
    if (city.garrison < 1000) return { ok: false, msg: '驻军不足1000，无法编练水军' };

    res.money -= cost;
    const troops = Math.min(2000, city.garrison);
    city.garrison -= troops;

    // 创建水军军队
    const general = this.getFactionGenerals(this.playerFaction).find(g => !g.inArmy) || this.getFactionGenerals(this.playerFaction)[0];
    const army = new Army({
      factionId: this.playerFaction,
      generalId: general ? general.id : null,
      cityId: cityId,
      troops: troops,
      unitMix: { [navyUnitType]: troops }
    });
    // 标记为水军
    army.isNavy = true;
    army.navyType = navyUnitType;
    this.armies.push(army);
    if (general) general.inArmy = army.id;

    this.pushLog(`${city.name} 建造水军【${NAVY_UNITS[navyUnitType]?.name || navyUnitType}】，兵力${troops}`);
    return { ok: true, msg: `水军建造完成！`, army };
  }

  // 水军移动（仅水路连接城市）
  moveNavy(army, targetCityId) {
    if (!army.isNavy) return { ok: false, msg: '非水军部队' };
    if (army.hasMoved) return { ok: false, msg: '本回合已行动' };
    const movable = getNavyMoveableCities(army, this.cities);
    if (!movable.includes(targetCityId)) return { ok: false, msg: '水军仅能沿水路移动' };
    army.cityId = targetCityId;
    army.hasMoved = true;
    return { ok: true, msg: `水军移动至 ${this.cities.get(targetCityId)?.name || targetCityId}` };
  }

  // 获取玩家势力总文化值
  getTotalCulture() {
    return calcFactionCulture(this.getFactionCities(this.playerFaction));
  }

  // 建造石窟（特殊建筑，仅平城/洛阳/建康）
  buildGrotto(cityId) {
    const city = this.cities.get(cityId);
    if (!city) return { ok: false, msg: '城市不存在' };
    if (!canBuildGrotto(city)) return { ok: false, msg: '仅平城、洛阳、建康可建石窟' };
    const existing = city.buildings.grotto || 0;
    if (existing >= 3) return { ok: false, msg: '石窟已达最高等级' };
    const cost = getGrottoBuildCost();
    const res = this.getPlayerRes();
    if (!res || res.money < cost.money) return { ok: false, msg: `金钱不足（需${cost.money}金）` };
    if (res.food < cost.food) return { ok: false, msg: `粮草不足（需${cost.food}粮）` };
    res.money -= cost.money;
    res.food -= cost.food;
    city.buildings.grotto = existing + 1;
    this.pushLog(`${city.name} 开凿石窟第 ${existing + 1} 层！文化大增！`);
    return { ok: true, msg: `石窟建成第 ${existing + 1} 层，文化+10/回合` };
  }

  // ============================================================
  // V3.5 — 周目继承（New Game+）
  // ============================================================
  // 开始周目继承：读取上局存档数据，返回加成信息
  startNewGamePlus(saveSlot) {
    const data = loadNGPlusData();
    if (!data || data.level <= 0) {
      return { ok: false, msg: '暂无周目继承数据，请先通关一局游戏' };
    }
    this._ngplusData = data;
    this.ngPlusLevel = data.level;
    return { ok: true, level: data.level, bonus: getNGPlusBonus(data.level) };
  }

  // 返回当前周目加成
  getNGPlusBonus() {
    return getNGPlusBonus(this.ngPlusLevel);
  }

  // 内部：在 initGame 末尾应用周目加成
  // 数值平衡（详见 ngplus.js）：
  //   AI兵力 ×(1+lv*0.10)；AI经济 ×(1+lv*0.05)；
  //   继承武将忠诚+20；已完成剧情武将全属性+5%
  _applyNGPlusBonus(playerFactionId) {
    if (this.ngPlusLevel <= 0) return;
    const bonus = getNGPlusBonus(this.ngPlusLevel);
    const data = this._ngplusData;
    // 1) AI 势力兵力/经济加成：按初始驻军与资源乘算
    for (const [fid, res] of this.factionRes) {
      if (fid === playerFactionId) continue;
      res.money = Math.round(res.money * bonus.aiEconMult);
      res.food = Math.round(res.food * bonus.aiEconMult);
    }
    for (const c of this.cities.values()) {
      if (c.owner && c.owner !== playerFactionId) {
        c.garrison = Math.round((c.garrison || 0) * bonus.aiArmyMult);
      }
    }
    // 2) 继承武将：已解锁武将新周目直接可用（在野武将直接加入玩家）
    if (data && Array.isArray(data.generals)) {
      for (const gid of data.generals) {
        const g = this.generals.get(gid);
        if (g && g.faction === null) {
          g.faction = playerFactionId;
          g.loyalty = Math.min(100, 70 + bonus.loyaltyBonus);
          const cap = this.cities.get(FACTIONS[playerFactionId].capital);
          g.location = cap ? cap.id : null;
        }
      }
    }
    // 3) 继承装备：放入玩家库存
    if (data && Array.isArray(data.items)) {
      const inv = this.getPlayerInventory();
      for (const it of data.items) if (!inv.includes(it)) inv.push(it);
    }
    // 4) 继承称号：直接写入 unlockedTitles
    if (data && Array.isArray(data.titles)) {
      // 把已解锁称号按玩家君主武将登记
      const lord = this.getFactionGenerals(playerFactionId).find(g => g.role === '君主');
      if (lord) {
        this.unlockedTitles[lord.id] = [...(data.titles || [])];
      }
    }
    // 5) 已完成剧情的武将全属性+5%
    if (data && Array.isArray(data.stories)) {
      for (const s of data.stories) {
        const g = this.generals.get(s.gid);
        if (g && g.faction === playerFactionId) {
          g.command = Math.round(g.command * 1.05);
          g.force = Math.round(g.force * 1.05);
          g.intel = Math.round(g.intel * 1.05);
          g.politics = Math.round(g.politics * 1.05);
        }
      }
    }
    this.pushLog(`◆ 周目继承：第 ${this.ngPlusLevel} 周目开启（AI兵力+${Math.round((bonus.aiArmyMult-1)*100)}%）`);
  }

  // ============================================================
  // V3.5 — 称号系统
  // ============================================================
  getTitles(generalId) {
    const unlocked = (this.unlockedTitles && this.unlockedTitles[generalId]) || [];
    const active = (this.activeTitles && this.activeTitles[generalId]) || [];
    return { unlocked, active };
  }
  unlockTitle(generalId, titleId) {
    if (!this.unlockedTitles[generalId]) this.unlockedTitles[generalId] = [];
    if (!this.unlockedTitles[generalId].includes(titleId)) {
      this.unlockedTitles[generalId].push(titleId);
      return true;
    }
    return false;
  }
  equipTitleOnGeneral(generalId, titleId, toggle) {
    return equipTitle(this, generalId, titleId, toggle);
  }
  // 某武将当前称号加成袋（供战斗/内政合并）
  getTitleBonusBag(generalId) {
    return getActiveTitleBonus(this, generalId);
  }

  // ============================================================
  // V3.5 — 统计面板
  // ============================================================
  getStats() {
    // 实时补充当前数值
    const res = this.getPlayerRes();
    return {
      ...this.gameStats,
      currentTurn: this.turn,
      currentMoney: res ? Math.round(res.money) : 0,
      currentFood: res ? Math.round(res.food) : 0,
      winRate: this.gameStats.battles ? Math.round(this.gameStats.victories / this.gameStats.battles * 100) : 0,
      ngPlusLevel: this.ngPlusLevel
    };
  }

  // ============================================================
  // V3.5 — 开场演出状态
  // ============================================================
  getIntroState() {
    return { completed: this.introCompleted };
  }
  skipIntro() {
    this.introCompleted = true;
  }

  pushLog(text) {
    this.log.push(`[${this.turn}.${this.getSeason()}] ${text}`);
    if (this.log.length > 200) this.log.shift();
  }

  // ---------- 科技加成汇总（供 city / army 查询） ----------
  // 汇总某势力「已研究科技 + 在编武将被动技能」的效果包
  // V3.0：技能合并 skills.js 表 + data.js 的 NEW_GENERAL_SKILLS（新武将复用）
  _mergedGeneralSkills(generalId) {
    const base = getGeneralSkills(generalId);
    const extraIds = NEW_GENERAL_SKILLS[generalId] || [];
    const extra = extraIds.map(id => getSkill(id)).filter(Boolean);
    // 去重
    const seen = new Set(base.map(s => s.id));
    for (const s of extra) if (!seen.has(s.id)) base.push(s);
    return base;
  }

  getTechBag(factionId) {
    const bag = {};
    const researched = factionId === this.playerFaction
      ? this.techs
      : ((this.aiPlayers.get(factionId) || {}).techs || []);
    for (const [k, v] of Object.entries(aggregateTechEffects(researched))) {
      bag[k] = (bag[k] || 0) + v;
    }
    for (const g of this.getFactionGenerals(factionId)) {
      for (const sk of this._mergedGeneralSkills(g.id)) {
        if (sk.type !== 'passive') continue;
        for (const [k, v] of Object.entries(sk.effect)) {
          if (k === 'mayorDefenseMult') continue; // 仅任太守时生效，单独处理
          bag[k] = (bag[k] || 0) + v;
        }
      }
    }
    // ---- V2.0：羁绊效果并入（同势力组合加成） ----
    for (const [k, v] of Object.entries(this.getBondBag(factionId))) {
      bag[k] = (bag[k] || 0) + v;
    }
    // ---- V7.0：官职全局加成并入 ----
    for (const [k, v] of Object.entries(aggregateOfficeBag(this.generals, factionId))) {
      bag[k] = (bag[k] || 0) + v;
    }
    // ---- V7.0：皇帝（君主）声望 buff 并入 ----
    if (this.dynastySystem) {
      for (const [k, v] of Object.entries(this.dynastySystem.getEmperorBag(this, factionId))) {
        bag[k] = (bag[k] || 0) + v;
      }
    }
    return bag;
  }

  // ---- V2.0：羁绊效果袋（同势力武将组合触发） ----
  getBondBag(factionId) {
    const genIds = this.getFactionGenerals(factionId).map(g => g.id);
    return checkBonds(genIds).bag;
  }

  // 某势力当前激活的羁绊列表（供 UI 展示）
  getActiveBonds(factionId) {
    const genIds = this.getFactionGenerals(factionId).map(g => g.id);
    return checkBonds(genIds).activated;
  }
  getTechBonus(factionId, key) {
    return this.getTechBag(factionId)[key] || 0;
  }

  // ---------- 科技研究（玩家） ----------
  researchTech(techId) {
    if (this.researching) return { ok: false, msg: '正在研究另一项科技，请等待完成' };
    const t = getTech(techId);
    if (!t) return { ok: false, msg: '科技不存在' };
    if (this.techs.includes(techId)) return { ok: false, msg: '已研究' };
    if (!isTechAvailable(techId, this.techs, null)) return { ok: false, msg: '前置科技未满足' };
    const res = this.getPlayerRes();
    if (res.money < t.cost) return { ok: false, msg: `金钱不足（需${t.cost}金）` };
    res.money -= t.cost;
    this.researching = { techId, turnsLeft: t.researchTurns };
    this.pushLog(`开始研究：${t.name}（${t.researchTurns}回合，耗${t.cost}金）`);
    return { ok: true, msg: `开始研究 ${t.name}` };
  }

  getTechTree() {
    return getTechTreeData(this.techs, this.researching ? this.researching.techId : null);
  }

  _completeResearch(techId) {
    this.techs.push(techId);
    const t = getTech(techId);
    this.researching = null;
    this.pushLog(`研究完成：${t.name} — ${t.description}`);
    const eff = t.effect || {};
    if (eff.loyaltyFlat) for (const g of this.getFactionGenerals(this.playerFaction)) g.loyalty = Math.min(100, g.loyalty + eff.loyaltyFlat);
    if (eff.moraleFlat) for (const c of this.getFactionCities(this.playerFaction)) c.morale = Math.min(100, c.morale + eff.moraleFlat);
    if (eff.prosperityFlat) for (const c of this.getFactionCities(this.playerFaction)) c.prosperity = Math.min(100, c.prosperity + eff.prosperityFlat);
  }

  // ---------- 成就 ----------
  getAchievements() {
    return getAchievementList(this);
  }

  // ---------- 城市操作 ----------
  cityRecruit(cityId, unitType, count) {
    const city = this.cities.get(cityId);
    if (!city || city.owner !== this.playerFaction) return { ok: false, msg: '无权操作' };
    const res = this.getPlayerRes();
    const result = city.recruit(unitType, count, res);
    if (result.ok) this.pushLog(`${city.name} 征兵：${result.msg}`);
    return result;
  }
  cityDevelopAgri(cityId) {
    const city = this.cities.get(cityId);
    if (!city || city.owner !== this.playerFaction) return { ok: false, msg: '无权操作' };
    const res = this.getPlayerRes();
    const cost = 200;
    if (res.money < cost) return { ok: false, msg: '金钱不足' };
    const result = city.developAgri(cost);
    if (result.ok) { res.money -= cost; this.pushLog(`${city.name} ${result.msg}（花费${cost}金）`); }
    return result;
  }
  cityDevelopComm(cityId) {
    const city = this.cities.get(cityId);
    if (!city || city.owner !== this.playerFaction) return { ok: false, msg: '无权操作' };
    const res = this.getPlayerRes();
    const cost = 200;
    if (res.money < cost) return { ok: false, msg: '金钱不足' };
    const result = city.developComm(cost);
    if (result.ok) { res.money -= cost; this.pushLog(`${city.name} ${result.msg}（花费${cost}金）`); }
    return result;
  }
  cityRepair(cityId) {
    const city = this.cities.get(cityId);
    if (!city || city.owner !== this.playerFaction) return { ok: false, msg: '无权操作' };
    const res = this.getPlayerRes();
    const cost = 150;
    if (res.money < cost) return { ok: false, msg: '金钱不足' };
    const result = city.repairDefense(cost);
    if (result.ok) { res.money -= cost; this.pushLog(`${city.name} ${result.msg}（花费${cost}金）`); }
    return result;
  }
  cityAssignMayor(cityId, generalId) {
    const city = this.cities.get(cityId);
    const gen = this.generals.get(generalId);
    if (!city || city.owner !== this.playerFaction) return { ok: false, msg: '无权操作' };
    if (!gen || gen.faction !== this.playerFaction) return { ok: false, msg: '该武将不属我方' };
    if (city.mayor) {
      const oldMayor = this.generals.get(city.mayor);
      if (oldMayor) oldMayor.location = cityId;
    }
    city.mayor = generalId;
    gen.location = cityId;
    this.pushLog(`${gen.name} 出任 ${city.name} 太守`);
    return { ok: true, msg: `${gen.name} 出任 ${city.name} 太守` };
  }
  citySetTax(cityId, rate) {
    const city = this.cities.get(cityId);
    if (!city || city.owner !== this.playerFaction) return { ok: false, msg: '无权操作' };
    const result = city.setTaxRate(rate);
    if (result.ok) this.pushLog(`${city.name} ${result.msg}`);
    return result;
  }

  // ============================================================
  // V2.0 — 装备系统
  // ============================================================
  // 某势力装备库存（数组 itemId）
  getInventory(factionId) {
    if (!this.inventory.has(factionId)) this.inventory.set(factionId, []);
    return this.inventory.get(factionId);
  }
  getPlayerInventory() { return this.getInventory(this.playerFaction); }

  // 查询武将当前装备 {weapon, armor, mount, treasure}
  getEquipment(generalId) {
    const gen = this.generals.get(generalId);
    return gen ? { ...gen.equipment } : null;
  }

  // 穿戴装备：从库存移到武将槽位；槽位已有装备则换下
  equipItem(generalId, slot, itemId) {
    const gen = this.generals.get(generalId);
    if (!gen) return { ok: false, msg: '武将不存在' };
    if (gen.faction !== this.playerFaction) return { ok: false, msg: '该武将不属我方' };
    const item = getItem(itemId);
    if (!item) return { ok: false, msg: '装备不存在' };
    if (item.slot !== slot) return { ok: false, msg: `${item.name} 应装备于【${item.slot}】槽位` };
    const inv = this.getPlayerInventory();
    const idx = inv.indexOf(itemId);
    if (idx < 0) return { ok: false, msg: '库存中没有该装备' };
    inv.splice(idx, 1);
    // 换下旧装回库存
    const old = gen.equipment[slot];
    if (old) inv.push(old);
    gen.equipment[slot] = itemId;
    this.pushLog(`${gen.name} 装备了【${item.name}】`);
    return { ok: true, msg: `${gen.name} 装备 ${item.name}` };
  }

  // 卸下装备回库存
  unequipItem(generalId, slot) {
    const gen = this.generals.get(generalId);
    if (!gen) return { ok: false, msg: '武将不存在' };
    if (gen.faction !== this.playerFaction) return { ok: false, msg: '该武将不属我方' };
    const old = gen.equipment[slot];
    if (!old) return { ok: false, msg: '该槽位没有装备' };
    gen.equipment[slot] = null;
    this.getPlayerInventory().push(old);
    this.pushLog(`${gen.name} 卸下了【${getItem(old).name}】`);
    return { ok: true, msg: `卸下 ${getItem(old).name}` };
  }

  // 战斗胜利缴获：概率抢走败将一件随机装备
  _lootEquipment(winnerFactionId, loserGeneral) {
    if (!loserGeneral) return;
    if (Math.random() > 0.30) return; // 30% 概率缴获
    const slots = ['weapon', 'armor', 'mount', 'treasure'];
    const equipped = slots.filter(s => loserGeneral.equipment[s]);
    if (!equipped.length) return;
    const slot = equipped[Math.floor(Math.random() * equipped.length)];
    const itemId = loserGeneral.equipment[slot];
    loserGeneral.equipment[slot] = null;
    this.getInventory(winnerFactionId).push(itemId);
    const item = getItem(itemId);
    this.pushLog(`缴获！${loserGeneral.name} 的【${item.name}】落入敌手`);
  }

  // 工坊打造装备：消耗金钱，按工坊等级解锁品质
  forgeEquipment(cityId) {
    const city = this.cities.get(cityId);
    if (!city || city.owner !== this.playerFaction) return { ok: false, msg: '无权操作' };
    const wsLv = city.buildings['workshop'] || 0;
    if (wsLv < 1) return { ok: false, msg: '需先建造工坊' };
    const rarity = maxRarityByWorkshop(wsLv);
    // 打造费用：100 + 品质阶 ×200（工坊每级 -10%，最低 50%）
    const costBase = { common: 100, fine: 300, rare: 500, epic: 700, legendary: 900 }[rarity];
    const cost = Math.max(50, Math.round(costBase * (1 - 0.10 * (wsLv - 1))));
    const res = this.getPlayerRes();
    if (res.money < cost) return { ok: false, msg: `金钱不足（需 ${cost} 金）` };
    res.money -= cost;
    const itemId = rollForgeItem(wsLv);
    if (!itemId) return { ok: false, msg: '打造失败' };
    this.getPlayerInventory().push(itemId);
    const item = getItem(itemId);
    this.pushLog(`${city.name} 工坊打造出【${item.name}】（${item.name ? '' : ''}）`);
    return { ok: true, msg: `打造成功：${item.name}`, itemId };
  }

  // ============================================================
  // V2.0 — 阵型系统
  // ============================================================
  getFormation(armyId) {
    const army = this.armies.find(a => a.id === armyId);
    return army ? army.formation : null;
  }
  setFormation(armyId, formationId) {
    const army = this.armies.find(a => a.id === armyId);
    if (!army) return { ok: false, msg: '军队不存在' };
    if (army.faction !== this.playerFaction) return { ok: false, msg: '非我方军队' };
    if (!getFormation(formationId)) return { ok: false, msg: '阵型不存在' };
    army.formation = formationId;
    this.pushLog(`${army.generalId} 变阵为【${getFormation(formationId).name}】`);
    return { ok: true, msg: `变阵：${getFormation(formationId).name}` };
  }

  // ============================================================
  // V2.0 — 城市建筑树
  // ============================================================
  getBuildings(cityId) {
    const city = this.cities.get(cityId);
    if (!city) return [];
    return Object.entries(city.buildings).map(([bid, lv]) => ({
      ...BUILDINGS[bid], level: lv
    }));
  }
  // 可供建造/升级的建筑列表（供 UI 渲染按钮）
  getBuildingOptions(cityId) {
    const city = this.cities.get(cityId);
    if (!city) return [];
    return Object.values(BUILDINGS).map(b => ({
      ...b,
      level: city.buildings[b.id] || 0,
      canBuild: !(b.riverOnly && city.terrain !== 'river') &&
                !(city.buildings[b.id] >= b.maxLevel) && !city.buildingThisTurn
    }));
  }
  buildBuilding(cityId, buildingId) {
    const city = this.cities.get(cityId);
    if (!city || city.owner !== this.playerFaction) return { ok: false, msg: '无权操作' };
    const res = this.getPlayerRes();
    const result = buildBuildingOnCity(city, buildingId, res);
    if (result.ok) this.pushLog(`${city.name} ${result.msg}`);
    return result;
  }

  // ============================================================
  // V2.0 — 兵种进阶
  // ============================================================
  // 在驻城发起某兵种进阶（需校场等级），扣金钱+粮草，1 回合后生效
  advanceUnit(cityId, armyId, unitType) {
    const city = this.cities.get(cityId);
    const army = this.armies.find(a => a.id === armyId);
    if (!city || !army) return { ok: false, msg: '目标不存在' };
    if (city.owner !== this.playerFaction || army.faction !== this.playerFaction) {
      return { ok: false, msg: '无权操作' };
    }
    if (army.cityId !== cityId) return { ok: false, msg: '军队不在该城' };
    const drillLv = city.buildings['drill'] || 0;
    const curTier = army.unitTier[unitType] || 0;
    const node = getUpgradeNode(unitType, curTier + 1);
    if (!node) return { ok: false, msg: '该兵种已是最高阶' };
    if (drillLv < node.drillLevel) {
      return { ok: false, msg: `需校场 ${node.drillLevel} 级（当前 ${drillLv}）` };
    }
    const res = this.getPlayerRes();
    if (res.money < node.costMoney || res.food < node.costFood) {
      return { ok: false, msg: `费用不足（需 ${node.costMoney} 金 / ${node.costFood} 粮）` };
    }
    const r = army.requestUpgrade(unitType, drillLv);
    if (!r.ok) return r;
    res.money -= node.costMoney;
    res.food -= node.costFood;
    this.pushLog(`${city.name} ${r.msg}（耗 ${node.costMoney} 金 ${node.costFood} 粮）`);
    return { ok: true, msg: r.msg };
  }

  // ============================================================
  // V2.0 — 贸易路线
  // ============================================================
  getTradeRoutes() { return this.tradeRoutes; }

  establishTradeRoute(cityId1, cityId2) {
    if (cityId1 === cityId2) return { ok: false, msg: '两城不能相同' };
    const c1 = this.cities.get(cityId1);
    const c2 = this.cities.get(cityId2);
    if (!c1 || !c2) return { ok: false, msg: '城市不存在' };
    if (c1.owner !== this.playerFaction || c2.owner !== this.playerFaction) {
      return { ok: false, msg: '两城须均属我方' };
    }
    if ((c1.buildings['market'] || 0) < 1 || (c2.buildings['market'] || 0) < 1) {
      return { ok: false, msg: '两城均需先建造市集' };
    }
    // 最多 5 条
    if (this.tradeRoutes.length >= 5) return { ok: false, msg: '最多同时存在 5 条商路' };
    // 不可重复
    const dup = this.tradeRoutes.some(r =>
      (r.city1 === cityId1 && r.city2 === cityId2) ||
      (r.city1 === cityId2 && r.city2 === cityId1));
    if (dup) return { ok: false, msg: '两城间已有商路' };
    const res = this.getPlayerRes();
    const cost = 500;
    if (res.money < cost) return { ok: false, msg: `建路需 ${cost} 金` };
    res.money -= cost;
    const route = { id: 'trade_' + (this.tradeRoutes.length + 1), city1: cityId1, city2: cityId2 };
    this.tradeRoutes.push(route);
    this.pushLog(`商路开通：${c1.name} ↔ ${c2.name}（耗 ${cost} 金）`);
    return { ok: true, msg: `商路 ${c1.name} ↔ ${c2.name} 开通`, route };
  }

  // 商路收入：Σ(两城商业之和 × 5%)，码头每级再 ×1.10
  calcTradeIncome() {
    let total = 0;
    for (const r of this.tradeRoutes) {
      const c1 = this.cities.get(r.city1);
      const c2 = this.cities.get(r.city2);
      if (!c1 || !c2) continue;
      // 任一城易主即视为断裂，不计收入
      if (c1.owner !== c2.owner) continue;
      const tradeMult = 1 + ((c1.buildingBag().tradeMult || 0) + (c2.buildingBag().tradeMult || 0));
      total += (c1.comm + c2.comm) * 0.05 * tradeMult;
    }
    return Math.round(total);
  }

  // 城市易主后清扫断裂商路
  _sweepTradeRoutes() {
    this.tradeRoutes = this.tradeRoutes.filter(r => {
      const c1 = this.cities.get(r.city1);
      const c2 = this.cities.get(r.city2);
      return c1 && c2 && c1.owner && c1.owner === c2.owner;
    });
  }

  // ============================================================
  // V7.0 — 官职 / 爵位系统（UI 接口）
  // ============================================================
  _factionName(fid) { return (FACTIONS[fid] && FACTIONS[fid].name) || fid; }

  // 某势力当前在任官职 { officeId: generalId }
  getOffices(fid) {
    const map = {};
    for (const g of this.getFactionGenerals(fid)) {
      if (g.office) map[g.office] = g.id;
    }
    return map;
  }

  // 任命官职
  appointOffice(generalId, officeId) {
    const g = this.generals.get(generalId);
    const off = getOffice(officeId);
    if (!g) return { ok: false, msg: '武将不存在' };
    if (g.faction !== this.playerFaction) return { ok: false, msg: '该武将不属我方' };
    if (!off) return { ok: false, msg: '官职不存在' };
    if (g.onHostage || g.onMission) return { ok: false, msg: '该武将为质/出使，不能任职' };
    const chk = canHoldOffice(g, officeId);
    if (!chk.ok) return { ok: false, msg: `${g.name} 不堪此职：${chk.msg}` };
    // 唯一性：若该职已由他人担任，先解任
    if (off.unique) {
      for (const other of this.getFactionGenerals(this.playerFaction)) {
        if (other.office === officeId && other.id !== generalId) {
          this.pushLog(`${other.name} 卸去 ${off.name} 之职。`);
          other.office = null;
        }
      }
    }
    // 免去旧职
    if (g.office && g.office !== officeId) g.office = null;
    g.office = officeId;
    g.loyalty = Math.min(100, g.loyalty + 5);
    this.pushLog(`🎖 ${g.name} 拜受 ${off.name}，众臣拭目。`);
    return { ok: true, msg: `${g.name} 出任 ${off.name}` };
  }

  // 解除官职
  dismissOffice(officeId) {
    for (const g of this.getFactionGenerals(this.playerFaction)) {
      if (g.office === officeId) { g.office = null; this.pushLog(`${g.name} 已解去 ${getOffice(officeId).name}。`); return { ok: true, msg: '已解任' }; }
    }
    return { ok: false, msg: '该职无人担任' };
  }

  // 封赏爵位
  grantTitle(generalId, titleId) {
    const g = this.generals.get(generalId);
    const t = getTitle(titleId);
    if (!g) return { ok: false, msg: '武将不存在' };
    if (g.faction !== this.playerFaction) return { ok: false, msg: '该武将不属我方' };
    if (!t) return { ok: false, msg: '爵位不存在' };
    const res = this.getPlayerRes();
    const cost = t.level * 800; // 封赏需耗金
    if (res.money < cost) return { ok: false, msg: `封赏需 ${cost} 金` };
    res.money -= cost;
    g.title = titleId;
    g.loyalty = Math.min(100, g.loyalty + t.loyaltyBonus);
    this.pushLog(`🏅 封 ${g.name} 为「${t.name}」，食邑有加，忠诚 +${t.loyaltyBonus}。`);
    return { ok: true, msg: `已封 ${g.name} 为 ${t.name}` };
  }

  // ============================================================
  // V7.0 — 王朝 / 禅让系统（UI 接口）
  // ============================================================
  getDynastyInfo() {
    const rec = this.dynastySystem.get(this.playerFaction);
    if (!rec) return null;
    const dyn = (typeof DYNASTIES !== 'undefined' && DYNASTIES[rec.dynastyId]) || null;
    const leg = this.dynastySystem.calcLegitimacy(this, this.playerFaction);
    const emperor = rec.emperorId ? this.getGeneral(rec.emperorId) : null;
    const heir = rec.heirId ? this.getGeneral(rec.heirId) : null;
    return {
      dynastyId: rec.dynastyId, dynastyName: dyn ? dyn.name : FACTIONS[this.playerFaction].name,
      eraName: rec.eraName, eraYear: rec.eraYear, legitimacy: leg,
      emperor, heir,
      canAbdicate: this.dynastySystem.canAbdicate(this, this.playerFaction),
      ancientCapitals: [...ANCIENT_CAPITALS].map(cid => {
        const c = this.cities.get(cid);
        return { id: cid, name: c ? c.name : cid, owned: c ? c.owner === this.playerFaction : false };
      })
    };
  }

  // 可受禅的新王朝候选（仅北方/统一格局给出隋，其余给出泛用）
  getAbdicateCandidates() {
    return Object.values(DYNASTIES);
  }

  doAbdicate(newDynastyId) {
    return this.dynastySystem.abdicate(this, this.playerFaction, newDynastyId);
  }

  // ============================================================
  // V7.0 — 贸易系统（UI 接口）
  // ============================================================
  dispatchCaravan(fromCityId, toCityId) {
    return this.tradeSystem.dispatchCaravan(this, this.playerFaction, fromCityId, toCityId);
  }
  proposeTradeAgreement(targetFid) {
    return this.tradeSystem.proposeAgreement(this, this.playerFaction, targetFid);
  }
  getTradeInfo() {
    return {
      longRoutes: this.tradeSystem.getActiveLongRoutes(this, this.playerFaction),
      caravans: this.tradeSystem.caravans.filter(c => c.factionId === this.playerFaction),
      agreementMult: this.tradeSystem.getAgreementMult(this.playerFaction)
    };
  }

  // ============================================================
  // V2.5 — 联姻系统（UI 接口）
  // ============================================================
  proposeMarriage(factionId, generalId) {
    return this.diplomacy.proposeMarriage(this, this.playerFaction, factionId, generalId);
  }
  acceptMarriage(marriageId) {
    return this.diplomacy.acceptMarriage(this, marriageId);
  }
  rejectMarriage(marriageId) {
    return this.diplomacy.rejectMarriage(this, marriageId);
  }
  // 联姻经济加成查询（供 city.calcIncome 调用）
  getMarriageIncomeMult(factionId) {
    return this.diplomacy.getMarriageIncomeMult(factionId);
  }

  // ============================================================
  // V2.5 — 人质系统（UI 接口）
  // ============================================================
  sendHostage(factionId, generalId) {
    return this.diplomacy.sendHostage(this, this.playerFaction, factionId, generalId);
  }
  recallHostage(hostageId) {
    return this.diplomacy.recallHostage(this, this.playerFaction, hostageId);
  }

  // ============================================================
  // V2.5 — 谍报系统（UI 接口）
  // ============================================================
  sendSpy(factionId, cityId, mission) {
    // UI 层面向玩家；AI 也可直接调用（factionId 可传 AI 势力）
    return sendSpy(this, factionId || this.playerFaction, cityId, mission);
  }
  getActiveSpies() { return this.spies.filter(s => s.status === 'active'); }

  // ============================================================
  // V2.5 — 战争迷雾（UI 接口）
  // ============================================================
  getVisibleCities() {
    return [...computeVisibleCities(this, this.playerFaction)];
  }
  // 某城市当前是否实时可见（供 map/ui 渲染）
  isCityCurrentlyVisible(cityId) {
    return computeVisibleCities(this, this.playerFaction).has(cityId);
  }
  isCityExplored(cityId) {
    return isExplored(this, cityId, this.playerFaction);
  }

  // ============================================================
  // V2.5 — 关隘要塞（UI 接口）
  // ============================================================
  buildPass(cityId, passName) {
    return requestBuildPass(this, this.playerFaction, cityId, passName);
  }
  getPasses() { return this.passes; }

  // ============================================================
  // V2.5 — 补给线系统（UI 接口）
  // ============================================================
  establishSupplyLine(armyId, cityId) {
    const army = this.armies.find(a => a.id === armyId);
    if (!army || army.faction !== this.playerFaction) return { ok: false, msg: '军队不存在或非我方' };
    const city = this.cities.get(cityId);
    if (!city || city.owner !== this.playerFaction) return { ok: false, msg: '补给城市须为我方所有' };
    this.supplyLines[armyId] = cityId;
    const st = computeSupplyStatus(this, army);
    this.pushLog(`已指定 ${city.name} 为【${army.generalId}】部补给据点（${st.cut ? '补给仍被切断！' : st.long ? '补给线过长' : '补给畅通'}）。`);
    return { ok: true, msg: `补给线指定至 ${city.name}`, status: st };
  }
  getArmySupplyStatus(armyId) {
    const army = this.armies.find(a => a.id === armyId);
    if (!army) return null;
    return computeSupplyStatus(this, army);
  }

  // ============================================================
  // V2.5 — 蛮族部落（UI 接口）
  // ============================================================
  getBarbarianTribes() { return this.barbarianTribes; }
  attackBarbarian(tribeId) {
    return attackBarbarian(this, this.playerFaction, tribeId);
  }
  recruitBarbarian(tribeId) {
    return recruitBarbarian(this, this.playerFaction, tribeId);
  }
  tradeBarbarian(tribeId) {
    return tradeBarbarian(this, this.playerFaction, tribeId);
  }

  // ============================================================
  // V3.0 — 武将个人剧情 / 多结局（UI 接口）
  // ============================================================
  // 某武将的全部剧情节点（含状态：done/current/locked）
  getStoryEvents(generalId) {
    return this.story.getStoryEvents(generalId);
  }
  // 某武将剧情进度
  getStoryProgress(generalId) {
    return this.story.getProgress(generalId);
  }
  // 触发（玩家选择）某武将某节点的某选项
  triggerStoryEvent(generalId, nodeIndex, choiceIdx) {
    return this.story.applyChoice(this, generalId, nodeIndex, choiceIdx);
  }
  // 本回合新触发的待处理剧情事件
  getPendingStoryEvents() { return this.story.pending; }

  // 应用剧情选项效果（复用 events 的效果语义）
  _applyStoryEffect(eff, node, generalId) {
    if (!eff) return;
    const res = this.getPlayerRes();
    const myCities = this.getFactionCities(this.playerFaction);
    if (eff.money) res.money = Math.max(0, res.money + eff.money);
    if (eff.food) res.food = Math.max(0, res.food + eff.food);
    if (eff.morale) for (const c of myCities) c.morale = Math.max(0, Math.min(100, c.morale + eff.morale));
    if (eff.factionMorale) for (const c of myCities) c.morale = Math.max(0, Math.min(100, c.morale + eff.factionMorale));
    if (eff.pop && myCities.length) myCities[0].pop = Math.max(0, myCities[0].pop + eff.pop);
    if (eff.garrisonBuff) this.garrisonBuffTurns = 2;
    if (eff.recruitRandom) {
      const idle = this.getIdleGenerals();
      if (idle.length) this.recruitIdleGeneral(idle[Math.floor(Math.random() * idle.length)].id);
    }
    if (eff.recruitGeneral) {
      const gen = this.generals.get(eff.recruitGeneral);
      if (gen && gen.faction === null) {
        gen.faction = this.playerFaction; gen.loyalty = 80;
        gen.location = this.cities.get(FACTIONS[this.playerFaction].capital).id;
        this.pushLog(`${gen.name} 加入我方！`);
      }
    }
    if (eff.armyLoss) {
      let remaining = eff.armyLoss;
      for (const a of this.getFactionArmies(this.playerFaction)) {
        const take = Math.min(a.troops, remaining); a.troops -= take; remaining -= take;
        if (remaining <= 0) break;
      }
    }
    if (eff.generalBuff) {
      const g = this.generals.get(eff.generalBuff.id);
      if (g) { g.command += eff.generalBuff.amt; g.force += eff.generalBuff.amt; }
    }
    if (eff.generalDebuff) {
      const g = this.generals.get(eff.generalDebuff.id);
      if (g) { g.command = Math.max(1, g.command - eff.generalDebuff.amt); g.force = Math.max(1, g.force - eff.generalDebuff.amt); }
    }
    if (eff.generalPolitics) { const g = this.generals.get(eff.generalPolitics.id); if (g) g.politics += eff.generalPolitics.amt; }
    if (eff.generalIntel) { const g = this.generals.get(eff.generalIntel.id); if (g) g.intel += eff.generalIntel.amt; }
    if (eff.generalLoyalty) {
      if (eff.generalLoyalty.id) {
        const g = this.generals.get(eff.generalLoyalty.id);
        if (g) g.loyalty = Math.max(0, Math.min(100, g.loyalty + eff.generalLoyalty.amt));
      }
    }
  }

  // 全部结局定义
  getEndings() { return this.endings.getEndings(); }
  // 检查是否触发结局；返回结局对象或 null
  checkEnding() { return this.endings.checkEnding(this); }
  // 是否已触发结局
  get currentEndingObj() { return this.endings.current; }

  // ---------- 军队操作 ----------
  createArmyFromGarrison(cityId, generalId, troops) {
    const city = this.cities.get(cityId);
    const gen = this.generals.get(generalId);
    if (!city || city.owner !== this.playerFaction) return { ok: false, msg: '无权操作' };
    if (!gen || gen.faction !== this.playerFaction) return { ok: false, msg: '该武将不属我方' };
    if (gen.inArmy) return { ok: false, msg: '该武将已在军中' };
    if (city.garrison < troops) return { ok: false, msg: '驻军不足' };
    // 军制改革：带兵上限 +20%
    const maxT = Math.round(gen.getMaxTroops() * (1 + this.getTechBonus(this.playerFaction, 'maxTroopsMult')));
    if (troops > maxT) troops = maxT;

    city.garrison -= troops;
    const army = new Army({
      factionId: this.playerFaction, generalId, cityId,
      troops: troops, unitMix: this.estimateUnitMix(troops)
    });
    this.armies.push(army);
    gen.inArmy = army.id;
    gen.location = army.id;
    this.pushLog(`${gen.name} 于 ${city.name} 起兵，兵力${troops}`);
    return { ok: true, army };
  }

  estimateUnitMix(troops) {
    return {
      infantry: Math.floor(troops * 0.5),
      cavalry: Math.floor(troops * 0.2),
      archer: troops - Math.floor(troops * 0.5) - Math.floor(troops * 0.2)
    };
  }

  moveArmy(armyId, targetCityId) {
    const army = this.armies.find(a => a.id === armyId);
    if (!army) return { ok: false, msg: '军队不存在' };
    if (army.faction !== this.playerFaction) return { ok: false, msg: '非我方军队' };
    if (army.hasMoved) return { ok: false, msg: '该军本回合已行动' };
    if (!citiesAdjacent(army.cityId, targetCityId)) return { ok: false, msg: '目标不相邻' };

    const target = this.cities.get(targetCityId);
    if (!target) return { ok: false, msg: '目标城市不存在' };

    // V2.5：关隘阻塞 —— 敌军已建成的关隘须先攻打（攻关隘消耗本回合行动）
    const blocking = getBlockingPass(army.cityId, targetCityId, this.passes);
    if (blocking && blocking.runtime.built && blocking.runtime.owner &&
        blocking.runtime.owner !== army.faction) {
      const result = attackPass(this, army, blocking);
      army.hasMoved = true;
      this.armies = this.armies.filter(a => !a.destroyed);
      result.passBattle = true;
      result.passName = blocking.static.name;
      this.battleResult = result;
      this.pushLog(`攻关【${blocking.static.name}】：${result.attackerWin ? '破关！' : '不克而还。'}`);
      return { ok: true, result, blocked: true };
    }

    if (target.owner === this.playerFaction) {
      const res = this.getPlayerRes();
      const foodCost = Math.round(army.troops * 0.05 * 2);
      res.food -= foodCost;
      army.cityId = targetCityId;
      army.hasMoved = true;
      const gen = this.generals.get(army.generalId);
      if (gen) gen.location = army.id;
      this.pushLog(`${gen ? gen.name : '军队'} 行军至 ${target.name}（耗粮${foodCost}）`);
      return { ok: true, msg: `军队移动至${target.name}` };
    } else if (target.owner === null) {
      const res = this.getPlayerRes();
      const foodCost = Math.round(army.troops * 0.05 * 2);
      res.food -= foodCost;
      target.owner = this.playerFaction;
      target.morale = 40;
      army.cityId = targetCityId;
      army.hasMoved = true;
      const gen = this.generals.get(army.generalId);
      this.pushLog(`${gen ? gen.name : '军队'} 占领无主城市 ${target.name}！`);
      this._sweepTradeRoutes();
      this.checkVictory();
      return { ok: true, msg: `占领${target.name}！` };
    } else {
      return this.attackCity(army, target);
    }
  }

  // 装备战斗效果袋（武器攻击加成等 → 全兵种/兵种乘算）
  _equipmentBag(gen) {
    if (!gen) return {};
    const eq = gen.getEquipmentStats ? gen.getEquipmentStats() : {};
    const bag = {};
    if (eq.attackMult) bag.allUnitMult = (bag.allUnitMult || 0) + eq.attackMult;
    if (eq.cavalryMult) bag.cavalryMult = (bag.cavalryMult || 0) + eq.cavalryMult;
    if (eq.defenseMult) bag.garrisonMult = (bag.garrisonMult || 0) + eq.defenseMult;
    return bag;
  }

  // 武将所在军队的阵型（若有）
  _generalArmyFormation(generalId) {
    const army = this.armies.find(a => a.generalId === generalId);
    return army ? army.formation : DEFAULT_FORMATION;
  }

  // ---------- 战斗 ----------
  // 组装攻方 side（含科技 + 被动技能 + 羁绊 + 阵型 + 装备加成）
  _buildAttackerSide(army, enemyFormationId) {
    const gen = this.generals.get(army.generalId);
    const bags = [this.getTechBag(army.faction)];
    const activeSkills = [];
    if (gen) {
      for (const sk of this._mergedGeneralSkills(gen.id)) {
        if (sk.type === 'passive') bags.push(sk.effect);
        else activeSkills.push(sk);
      }
    }
    // V2.0：阵型加成（含克制）
    bags.push(getFormationBag(army.formation, enemyFormationId || DEFAULT_FORMATION));
    // V2.0：装备战斗效果
    bags.push(this._equipmentBag(gen));
    // V2.5：补给线被切断 → 全军战力 -30%
    const supStatus = computeSupplyStatus(this, army);
    if (supStatus.cut) bags.push(supplyBattleBag(supStatus));
    return {
      faction: army.faction, generalId: army.generalId,
      general: gen ? { command: gen.effCommand, force: gen.effForce, intel: gen.effIntel, name: gen.name }
                   : { command: 50, force: 50, intel: 50, name: '我军' },
      troops: army.troops, unitType: army.getMainUnit(), unitCoeff: army.getAvgUnitCoeff(),
      bags, cityDefense: 0, activeSkillList: activeSkills
    };
  }
  // 组装守方 side
  _buildDefenderSide(city) {
    const gen = this.findDefenderGeneral(city.id);
    const bags = [this.getTechBag(city.owner)];
    let defense = city.getEffectiveDefense ? city.getEffectiveDefense() : city.defense;
    if (gen) {
      for (const sk of this._mergedGeneralSkills(gen.id)) {
        if (sk.type !== 'passive') continue;
        bags.push(sk.effect);
        // 羊侃「守城名将」：任太守时城市防御 +50%
        if (sk.effect.mayorDefenseMult && city.mayor === gen.id) {
          defense += (city.getEffectiveDefense ? city.getEffectiveDefense() : city.defense) * sk.effect.mayorDefenseMult;
        }
      }
    }
    // 城墙建筑守城加成
    const bb = city.buildingBag();
    if (bb.garrisonMult) bags.push({ garrisonMult: bb.garrisonMult });
    // V2.0：守方阵型（守将若在军中则用其阵型，否则默认鹤翼）
    const defFormation = gen ? this._generalArmyFormation(gen.id) : DEFAULT_FORMATION;
    bags.push(getFormationBag(defFormation, null));
    // V2.0：装备战斗效果
    bags.push(this._equipmentBag(gen));
    // 玉璧围城事件临时加成
    if (this.garrisonBuffTurns > 0) bags.push({ garrisonMult: 0.30 });
    return {
      faction: city.owner, generalId: gen ? gen.id : null,
      general: gen ? { command: gen.effCommand, force: gen.effForce, intel: gen.effIntel, name: gen.name }
                   : { command: 50, force: 50, intel: 50, name: '守军' },
      troops: city.garrison, unitType: 'infantry', unitCoeff: 1.0,
      bags, cityDefense: Math.round(defense), formation: defFormation, activeSkillList: []
    };
  }

  attackCity(army, targetCity) {
    // V2.5：正式开战 —— 触发人质处置 + 联姻破裂（背盟）
    if (targetCity.owner && army.faction !== targetCity.owner) {
      this.diplomacy.onWarDeclared(this, army.faction, targetCity.owner);
      this.diplomacy.onBetrayal(this, army.faction, targetCity.owner);
    }
    // AI 进攻：快速结算（不弹窗）
    if (army.faction !== this.playerFaction) {
      return this._aiAttack(army, targetCity);
    }
    // 玩家进攻：多回合攻城战
    return this._playerSiege(army, targetCity);
  }

  // 玩家多回合攻城（自动演进完整多回合后结算；同时暴露交互 API）
  _playerSiege(army, targetCity) {
    const dSide = this._buildDefenderSide(targetCity);
    const aSide = this._buildAttackerSide(army, dSide.formation);
    const battle = startMultiBattle(aSide, dSide, {
      terrain: targetCity.terrain, siege: true, cityDefense: targetCity.defense
    });
    battle.armyId = army.id;
    battle.cityId = targetCity.id;
    battle.attackerFaction = army.faction;
    battle.defenderFaction = targetCity.owner;
    battle.attackerName = aSide.general.name;
    battle.defenderName = dSide.general.name;
    battle.startAttackerTroops = aSide.startTroops;
    battle.startDefenderTroops = dSide.startTroops;
    this.activeBattle = battle;

    // 当前 UI 无交互战斗界面，自动演进完整多回合；
    // 新 UI 可改为：仅 startBattle 后由 battleAction(action) 逐回合驱动。
    this._autoPlayBattle();

    return this._finishPlayerSiege(army, targetCity);
  }

  _autoPlayBattle() {
    const b = this.activeBattle;
    if (!b) return;
    let skillUsed = false, guard = 0;
    while (b.phase === 'active' && guard++ < 30) {
      if (!skillUsed && b.attacker.activeSkillList && b.attacker.activeSkillList.length) {
        b.attacker.pendingSkill = b.attacker.activeSkillList[0];
        skillUsed = true;
      }
      let aAct = autoAction(b, 'attacker');
      const dAct = autoAction(b, 'defender');
      if (aAct === 'skill') aAct = 'steady';
      resolveBattleRound(b, aAct, dAct);
    }
  }

  _finishPlayerSiege(army, targetCity) {
    const b = this.activeBattle;
    const attackerWin = !!b.attackerWin;
    const attackerLoss = b.startAttackerTroops - b.attacker.troops;
    const defenderLoss = b.startDefenderTroops - b.defender.troops;
    army.troops = Math.max(0, army.troops - attackerLoss);
    targetCity.garrison = Math.max(0, targetCity.garrison - defenderLoss);

    const atkGen = this.generals.get(army.generalId);
    // 武将经验：胜战多得，败战少得
    if (atkGen) {
      const expGain = attackerWin ? 80 + Math.round(defenderLoss * 0.02) : 30;
      const ups = atkGen.gainExp(expGain);
      if (ups > 0) this.pushLog(`${atkGen.name} 身经百战，升至 ${atkGen.level} 级！`);
      this._rollGeneralHazard(atkGen);
    }

    // 战绩统计
    if (attackerWin) {
      this.stats.wins++;
      this.stats.winStreak++;
      this.stats.bestWinStreak = Math.max(this.stats.bestWinStreak, this.stats.winStreak);
      if (b.startAttackerTroops < b.startDefenderTroops * 0.5) {
        this.stats.underdogWins++;
        this.pushLog('以少胜多，威震天下！');
      }
    } else {
      this.stats.losses++;
      this.stats.winStreak = 0;
    }

    // V3.5：全局战斗统计 + 武将个人战斗统计
    recordBattle(this, {
      win: attackerWin,
      kills: defenderLoss,
      losses: attackerLoss
    });
    if (atkGen) {
      const gs = this.generalStats[atkGen.id] = this.generalStats[atkGen.id] || {
        totalBattles: 0, totalWins: 0, maxKills: 0, maxMarch: 0,
        cavalryWins: 0, archerWins: 0, infantryWins: 0
      };
      gs.totalBattles++;
      if (attackerWin) {
        gs.totalWins++;
        gs.maxKills = Math.max(gs.maxKills, defenderLoss);
        const mainUnit = army.getMainUnit ? army.getMainUnit() : 'infantry';
        if (mainUnit === 'cavalry') gs.cavalryWins++;
        else if (mainUnit === 'archer') gs.archerWins++;
        else gs.infantryWins++;
      }
    }

    let conquered = false;
    if (attackerWin) {
      conquered = true;
      const oldOwner = targetCity.owner;
      // V2.0：缴获守将装备 + 清扫断裂商路
      const loserGen = this.generals.get(targetCity.mayor) || this.findDefenderGeneral(targetCity.id);
      this._lootEquipment(army.faction, loserGen);
      targetCity.owner = army.faction;
      targetCity.morale = 30;
      army.cityId = targetCity.id;
      if (atkGen) atkGen.location = army.id;
      this._sweepTradeRoutes();
      this.pushLog(`${atkGen ? atkGen.name : '我军'} 攻陷 ${targetCity.name}！守将 ${b.defenderName} 败退。`);
      this.stats.citiesConquered++;
      const targetFaction = FACTIONS[oldOwner];
      if (targetFaction && targetFaction.capital === targetCity.id) {
        this.pushLog(`${targetFaction.name} 都城 ${targetCity.name} 已被攻陷！`);
        for (const g of this.generals.values()) if (g.faction === oldOwner) g.faction = null;
      }
    } else {
      this.pushLog(`${atkGen ? atkGen.name : '我军'} 攻 ${targetCity.name} 未果，撤退。`);
      if (army.troops <= 0) {
        this.pushLog(`${atkGen ? atkGen.name : '残军'} 全军覆没！`);
        army.destroyed = true;
        if (atkGen) { atkGen.inArmy = null; atkGen.location = army.cityId; }
      }
    }
    army.hasMoved = true;
    this.armies = this.armies.filter(a => !a.destroyed);

    // 兼容旧 UI 的战报结构
    const result = {
      attackerWin, draw: false, conquered,
      attackerLoss, defenderLoss,
      battleLog: b.log.slice(),
      tactics: b.log.filter(l => l.includes('奇袭') || l.includes('破城') || l.includes('★') || l.includes('绝技')),
      attackerName: b.attackerName, defenderName: b.defenderName,
      attackerFaction: b.attackerFaction, defenderFaction: b.defenderFaction,
      targetCityId: targetCity.id, targetCityName: targetCity.name,
      reason: b.reason
    };

    this.activeBattle = null;
    this.battleResult = result;
    this.state = 'battle';
    if (attackerWin) { this.checkVictory(); this.checkDefeat(); }
    return { ok: true, result };
  }

  // AI 攻城（快速结算，沿用原逻辑 + 科技/技能加成）
  _aiAttack(army, targetCity) {
    const attackerGen = this.generals.get(army.generalId);
    const defenderGeneral = this.findDefenderGeneral(targetCity.id);
    const attackerBags = [this.getTechBag(army.faction)];
    const defenderBags = [this.getTechBag(targetCity.owner)];
    let defenderDefense = targetCity.getEffectiveDefense ? targetCity.getEffectiveDefense() : targetCity.defense;
    if (attackerGen) for (const sk of this._mergedGeneralSkills(army.generalId)) if (sk.type === 'passive') attackerBags.push(sk.effect);
    if (defenderGeneral) for (const sk of this._mergedGeneralSkills(defenderGeneral.id)) if (sk.type === 'passive') {
      defenderBags.push(sk.effect);
      // 羊侃「守城名将」：任太守时城市防御 +50%（本地计算，不改城防数值）
      if (sk.effect.mayorDefenseMult && targetCity.mayor === defenderGeneral.id) {
        defenderDefense = Math.round(defenderDefense * (1 + sk.effect.mayorDefenseMult));
      }
    }
    if (this.garrisonBuffTurns > 0 && targetCity.owner === this.playerFaction) defenderBags.push({ garrisonMult: 0.30 });

    // V2.0：AI 攻方阵型 + 装备
    const atkFormation = army.formation || DEFAULT_FORMATION;
    defenderBags.push(getFormationBag('heyi', atkFormation)); // 守城默认鹤翼
    attackerBags.push(getFormationBag(atkFormation, 'heyi'));
    attackerBags.push(this._equipmentBag(attackerGen));
    defenderBags.push(this._equipmentBag(defenderGeneral));

    const attackerData = {
      troops: army.troops, unitType: army.getMainUnit(), unitCoeff: army.getAvgUnitCoeff(),
      bags: attackerBags,
      general: attackerGen ? { command: attackerGen.effCommand, force: attackerGen.effForce, intel: attackerGen.effIntel, name: attackerGen.name }
                           : { command: 50, force: 50, intel: 50 },
      cityDefense: 0
    };
    const defenderData = {
      troops: targetCity.garrison, unitType: 'infantry', unitCoeff: 1.0,
      bags: defenderBags,
      general: defenderGeneral ? { command: defenderGeneral.effCommand, force: defenderGeneral.effForce, intel: defenderGeneral.effIntel, name: defenderGeneral.name }
                               : { command: 50, force: 50, intel: 50 },
      cityDefense: defenderDefense
    };

    const result = computeBattle(attackerData, defenderData, 'plain', targetCity.terrain);
    result.attackerName = attackerGen ? attackerGen.name : '敌军';
    result.defenderName = defenderGeneral ? defenderGeneral.name : '守军';
    result.attackerFaction = army.faction;
    result.defenderFaction = targetCity.owner;
    result.targetCityId = targetCity.id;
    result.targetCityName = targetCity.name;

    army.troops = Math.max(0, army.troops - result.attackerLoss);
    targetCity.garrison = Math.max(0, targetCity.garrison - result.defenderLoss);

    if (result.attackerWin && !result.draw) {
      const oldOwner = targetCity.owner;
      // V2.0：AI 缴获守将装备
      this._lootEquipment(army.faction, defenderGeneral);
      targetCity.owner = army.faction;
      targetCity.morale = 30;
      army.cityId = targetCity.id;
      if (attackerGen) attackerGen.location = army.id;
      result.conquered = true;
      this._sweepTradeRoutes();
      this.pushLog(`${result.attackerName} 攻陷 ${targetCity.name}！`);
      const targetFaction = FACTIONS[oldOwner];
      if (targetFaction && targetFaction.capital === targetCity.id) {
        for (const g of this.generals.values()) if (g.faction === oldOwner) g.faction = null;
      }
      this.checkVictory();
      this.checkDefeat();
    } else {
      // 玩家成功守城
      if (targetCity.owner === this.playerFaction && !result.attackerWin) {
        this.stats.siegesDefended++;
      }
      if (army.troops <= 0) {
        army.destroyed = true;
        if (attackerGen) { attackerGen.inArmy = null; attackerGen.location = army.cityId; }
      }
    }
    army.hasMoved = true;
    this.armies = this.armies.filter(a => !a.destroyed);
    // AI 战斗不弹窗
    return { ok: true, result };
  }

  // 战斗中武将负伤/阵亡判定（君主不阵亡）
  _rollGeneralHazard(gen) {
    if (!gen) return;
    if (gen.role === '君主') {
      if (Math.random() < 0.05) { gen.wounded = 2; this.pushLog(`${gen.name} 负伤暂退。`); }
      return;
    }
    const r = Math.random();
    if (r < 0.08) {
      gen.wounded = 2;
      this.pushLog(`${gen.name} 负伤，休养两回合。`);
    } else if (r < 0.10) {
      gen.faction = null; gen.inArmy = null; gen.location = null;
      this.pushLog(`${gen.name} 战死沙场，马革裹尸！`);
    }
  }

  findDefenderGeneral(cityId) {
    const city = this.cities.get(cityId);
    if (!city) return null;
    if (city.mayor) return this.generals.get(city.mayor);
    const gen = [...this.generals.values()].find(g => g.location === cityId && g.faction === city.owner && !g.inArmy);
    return gen || null;
  }

  disbandArmy(armyId) {
    const army = this.armies.find(a => a.id === armyId);
    if (!army || army.faction !== this.playerFaction) return { ok: false, msg: '无法解散' };
    const city = this.cities.get(army.cityId);
    if (city) city.garrison += army.troops;
    const gen = this.generals.get(army.generalId);
    if (gen) { gen.inArmy = null; gen.location = army.cityId; }
    this.armies = this.armies.filter(a => a.id !== armyId);
    this.pushLog(`${gen ? gen.name : '军队'} 解散，兵力${army.troops}归入 ${city ? city.name : ''} 城防`);
    return { ok: true };
  }

  // ---------- 多回合战斗交互 API（供新 UI 调用） ----------
  getBattleState() {
    if (!this.activeBattle) return null;
    const b = this.activeBattle;
    return {
      round: b.round, maxRounds: b.maxRounds, phase: b.phase,
      attackerFaction: b.attackerFaction, defenderFaction: b.defenderFaction,
      attackerName: b.attackerName, defenderName: b.defenderName,
      attackerTroops: b.attacker.troops, defenderTroops: b.defender.troops,
      startAttackerTroops: b.startAttackerTroops, startDefenderTroops: b.startDefenderTroops,
      breached: b.breached, siege: b.siege,
      log: b.log.slice(), reason: b.reason, attackerWin: b.attackerWin,
      availableActions: ['storm', 'steady', 'defend', 'retreat'],
      attackerActiveSkills: (b.attacker.activeSkillList || []).map(s => ({
        id: s.id, name: s.name, description: s.description,
        cooldown: b.attacker.cooldowns[s.id] || 0
      }))
    };
  }

  useSkill(armyId, skillId) {
    if (!this.activeBattle) return { ok: false, msg: '当前无进行中的战斗' };
    const b = this.activeBattle;
    const sk = getSkill(skillId);
    if (!sk) return { ok: false, msg: '技能不存在' };
    const side = (b.armyId === armyId) ? b.attacker : null;
    if (!side) return { ok: false, msg: '该军队未在战斗中' };
    if (side.cooldowns[skillId]) return { ok: false, msg: `技能冷却中（${side.cooldowns[skillId]}回合）` };
    side.pendingSkill = sk;
    return { ok: true, msg: `已准备施展【${sk.name}】，本回合生效` };
  }

  battleAction(action) {
    if (!this.activeBattle) return { ok: false, msg: '无进行中战斗' };
    const b = this.activeBattle;
    if (b.phase !== 'active') return { ok: false, msg: '战斗已结束' };
    // 玩家攻方动作；守方 AI 自动
    const atkAction = ['storm', 'steady', 'defend', 'retreat'].includes(action) ? action : 'steady';
    const defAction = autoAction(b, 'defender');
    resolveBattleRound(b, atkAction, defAction);
    if (b.phase === 'ended') {
      // 交互模式下结束：结算（此处仅返回状态，实际战果由 _finish* 应用）
      // 为兼容，这里直接落账
      const army = this.armies.find(a => a.id === b.armyId);
      const city = this.cities.get(b.cityId);
      if (army && city && army.faction === this.playerFaction) {
        return this._finishPlayerSiege(army, city);
      }
    }
    return { ok: true, state: this.getBattleState() };
  }

  // 手动触发武将升级（若经验足够）
  generalLevelUp(generalId) {
    const gen = this.generals.get(generalId);
    if (!gen) return { ok: false, msg: '武将不存在' };
    const before = gen.level;
    gen.gainExp(0);
    if (gen.level > before) {
      this.pushLog(`${gen.name} 升至 ${gen.level} 级！`);
      return { ok: true, level: gen.level };
    }
    return { ok: false, msg: '经验不足，暂不能升级（胜利战斗可获经验）' };
  }

  // 邙山之战事件：自动大规模野战结算
  resolveMassBattle() {
    const res = this.getPlayerRes();
    const myArmies = this.getFactionArmies(this.playerFaction);
    const myStrength = myArmies.reduce((s, a) => s + a.troops, 0) + this.getFactionCities(this.playerFaction).reduce((s, c) => s + c.garrison, 0);
    const win = Math.random() < (myStrength > 8000 ? 0.6 : 0.4);
    const loss = win ? 2500 : 4000;
    let remaining = loss;
    for (const a of myArmies) {
      const take = Math.min(a.troops, remaining);
      a.troops -= take; remaining -= take;
      if (remaining <= 0) break;
    }
    if (win) {
      this.stats.wins++;
      this.stats.winStreak++;
      this.stats.bestWinStreak = Math.max(this.stats.bestWinStreak, this.stats.winStreak);
      this.pushLog(`邙山之战：我军大捷！歼敌无数（自损${loss}）。`);
      if (res) res.money += 800;
    } else {
      this.stats.losses++; this.stats.winStreak = 0;
      this.pushLog(`邙山之战：先胜后败，损兵${loss}。`);
    }
  }

  // ---------- 结束回合 ----------
  endTurn() {
    if (this.gameOver) return;
    // V5.5：客机不本地结算结束回合，只把操作指令发给主机（UI 层拦截）
    if (this.netRole === 'client') return;
    if (this.isHotSeat) { this._hotSeatAdvance(); return; }

    // ===== 单人模式（原逻辑）=====
    this.state = 'ai_turn';
    this.pushLog('—— 玩家阶段结束，AI 势力行动中 ——');
    for (const army of this.armies) army.hasMoved = false;
    this.runAITurns();
    this.settleTurn();
    this.seasonIdx = (this.seasonIdx + 1) % 4;
    this.turn++;
    this._roundPostSettle();
    this.state = 'playing';
    this.checkVictory();
    this.checkDefeat();
    this._checkEndingAndStats();
  }

  // 一整轮结算后的事件/剧情/结局/统计（单人与热座共用）
  _roundPostSettle() {
    this.eventSystem.rollEvent(this);
    // V3.0：扫描武将个人剧情触发
    this.story.scanTriggers(this);
    if (this.story.pending.length) {
      this.pushLog(`◆ 个人剧情：${this.story.pending.map(p => p.node.title).join('、')} 待触发`);
    }
    this.pushLog(`—— 第 ${this.turn} 回合 · ${this.getSeason()}季 ——`);
  }

  _checkEndingAndStats() {
    // V3.0：结局检测（优先级高于普通胜负）
    const ending = this.checkEnding();
    if (ending && !this.gameOver) {
      this.gameOver = { win: ending.rank === 'S', endingId: ending.id, text: ending.text, ending: ending };
      this.state = 'gameover';
      // V3.5：写入周目继承数据 + 记录结局统计
      recordEnding(this, ending.id, this.ngPlusLevel);
      try { saveNGPlusData(this); } catch (e) {}
    }
    // V3.5：统计更新 + 称号检查
    recordTurn(this);
    try {
      const newTitles = checkTitles(this);
      if (newTitles.length && this.pendingTitles) this.pendingTitles.push(...newTitles);
    } catch (e) {}
    // 成就检查
    checkAchievements(this);
  }

  // ===== V5.0 热座模式：按 turnOrder 推进到下一个人类玩家 =====
  _hotSeatAdvance() {
    this.state = 'ai_turn';
    // 当前人类势力军队行动标记重置
    for (const army of this.armies) {
      if (army.faction === this.playerFaction) army.hasMoved = false;
    }
    let settled = false;
    let guard = this.turnOrder.length + 2;
    while (guard-- > 0) {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.turnOrder.length;
      const fid = this.turnOrder[this.currentPlayerIndex];

      // 绕回起点（= 走完一整轮）：结算经济、推进季节/回合
      if (this.currentPlayerIndex === 0 && !settled) {
        settled = true;
        this.settleTurn();
        this.seasonIdx = (this.seasonIdx + 1) % 4;
        this.turn++;
        this._roundPostSettle();
        this._checkEndingAndStats();
        this._checkHotSeatEnd();
        if (this.gameOver) return;
      }

      // 已灭亡势力直接跳过
      if (!this._factionAlive(fid)) continue;

      if (this.humanFactions.includes(fid)) {
        // 移交到下一个人类玩家
        this.playerFaction = fid;
        this.selectedCity = null;
        this.selectedArmy = null;
        this.state = 'playing';
        this._checkHotSeatEnd();
        return;
      } else {
        // AI 势力自动行动
        const ai = this.aiPlayers.get(fid);
        if (ai) ai.takeTurn(this);
        this._checkHotSeatEnd();
        if (this.gameOver) return;
      }
    }
    // 兜底：理论上不会走到这里
    this.state = 'playing';
  }

  runAITurns() {
    for (const [fid, ai] of this.aiPlayers) {
      if (this.gameOver) break;
      ai.takeTurn(this);
    }
  }

  settleTurn() {
    const season = this.getSeason();

    // 玩家科技研究推进
    if (this.researching) {
      this.researching.turnsLeft--;
      if (this.researching.turnsLeft <= 0) this._completeResearch(this.researching.techId);
    }
    if (this.garrisonBuffTurns > 0) this.garrisonBuffTurns--;

    // V2.0：每城建筑工令重置（新回合可继续建造/升级）
    for (const city of this.cities.values()) city.buildingThisTurn = false;
    // V2.0：军队待进阶整训推进
    for (const army of this.armies) {
      const done = army.endTurn();
      for (const p of done) {
        const gen = this.generals.get(army.generalId);
        this.pushLog(`${gen ? gen.name : '军队'} 整训完成，${p.unitType} 进阶！`);
      }
    }

    for (const [fid, res] of this.factionRes) {
      let totalIncome = 0, totalFood = 0;
      const cities = this.getFactionCities(fid);
      for (const city of cities) {
        const { income, food } = city.endTurn(season);
        totalIncome += income;
        totalFood += food;
      }
      // V2.0：贸易路线收入（仅属于本势力的商路计入）
      const tradeIncome = this.tradeRoutes
        .filter(r => {
          const c1 = this.cities.get(r.city1);
          const c2 = this.cities.get(r.city2);
          return c1 && c2 && c1.owner === fid && c2.owner === fid;
        })
        .reduce((s, r) => {
          const c1 = this.cities.get(r.city1);
          const c2 = this.cities.get(r.city2);
          const tm = 1 + ((c1.buildingBag().tradeMult || 0) + (c2.buildingBag().tradeMult || 0));
          return s + (c1.comm + c2.comm) * 0.05 * tm;
        }, 0);
      totalIncome += Math.round(tradeIncome);

      res.money += totalIncome;
      res.food += totalFood;

      // 被动技能：民心每回合加成（独孤信/陈蒨等）
      const moraleBonus = this.getTechBonus(fid, 'moralePerTurn');
      if (moraleBonus) for (const c of cities) c.morale = Math.min(100, c.morale + moraleBonus);

      const armies = this.getFactionArmies(fid);
      let armyFoodCost = 0;
      for (const army of armies) {
        // V2.5：补给线影响粮草消耗（切断×2 / 过长×1.5），切断时每回合士气 -5
        const sup = computeSupplyStatus(this, army);
        armyFoodCost += Math.round(army.troops * 0.05 * supplyFoodMult(sup));
        if (sup.cut && fid === this.playerFaction) {
          res.totalMorale = Math.max(0, (res.totalMorale || 60) - 5);
        }
      }
      res.food -= armyFoodCost;
      if (res.food < 0) {
        res.money -= Math.abs(res.food) * 2;
        res.food = 0;
      }

      for (const gen of this.getFactionGenerals(fid)) {
        gen.endTurn();
        if (gen.loyalty < 30 && Math.random() < 0.15) {
          gen.faction = null;
          this.pushLog(`${gen.name} 因忠诚过低下野而去！`);
        }
      }

      // ---- V7.0：贸易系统回合结算（长距商路岁入直接入账；商队利润在 settleTurn 内入账）----
      if (this.tradeSystem) {
        const tr = this.tradeSystem.settleTurn(this, fid);
        res.money += tr.income;
      }
      // ---- V7.0：王朝系统回合结算（年号推进/君主更替/正统重算）----
      if (this.dynastySystem) this.dynastySystem.settleTurn(this, fid);
    }

    // ---- V2.5：新系统回合推进 ----
    resolveSpies(this);            // 密探任务结算
    settlePasses(this);            // 关隘建造完工
    settleBarbarians(this);        // 蛮族进贡 / 劫掠
    for (const fid of Object.keys(FACTIONS)) settleFog(this, fid); // 战争视野刷新
    this.diplomacy.refreshMarriageBag(this); // 联姻经济袋刷新

    // ---- V6.0：宗教文化系统回合结算 ----
    this.religionSystem.settleTurn(this);
    // 文化胜利检测
    const cultureResult = this.religionSystem.checkCultureVictory(this);
    if (cultureResult.achieved && !this.gameOver) {
      this.gameOver = { win: true, endingId: 'culture_prosperity', text: cultureResult.text };
      this.state = 'gameover';
    }
  }

  // ---------- 胜负 ----------
  checkVictory() {
    // V5.0：热座模式下，人类任一方一统即胜（终局逻辑由 _checkHotSeatEnd 统一处理）
    if (this.isHotSeat) { this._checkHotSeatEnd(); return !!this.gameOver; }
    const playerCities = this.getFactionCities(this.playerFaction);
    // V3.0：30 城地图，占 29 城以上视为一统（与 ending.unify 一致）
    const total = this.cities.size || 30;
    if (playerCities.length >= total - 1) {
      this.gameOver = { win: true, text: '王师所向，一统天下！四海归一，建不世之业！' };
      this.state = 'gameover';
      return true;
    }
    return false;
  }
  checkDefeat() {
    // V5.0：热座模式下，单个玩家势力覆灭 = 淘汰而非终局（由 _checkHotSeatEnd 判定）
    if (this.isHotSeat) return false;
    // V4.0: null guard — 防止 playerFaction 为 null 时崩溃
    if (!this.playerFaction || !FACTIONS[this.playerFaction]) return false;
    const playerFaction = FACTIONS[this.playerFaction];
    const capital = this.cities.get(playerFaction.capital);
    if (capital && capital.owner !== this.playerFaction) {
      this.gameOver = { win: false, text: '都城陷落，霸业成空……然天命未绝，留待后人。' };
      this.state = 'gameover';
      return true;
    }
    return false;
  }

  // ---------- 招募在野武将 ----------
  recruitIdleGeneral(generalId) {
    const gen = this.generals.get(generalId);
    if (!gen || gen.faction !== null) return { ok: false, msg: '武将已有归属' };
    // V4.0: null guard — 防止 playerFaction 或都城不存在时崩溃
    if (!this.playerFaction || !FACTIONS[this.playerFaction]) return { ok: false, msg: '势力未初始化' };
    // 无科技/技能加成时必定来投（保持原 UI 体验）；
    // 科举雏形/独孤信等 recruitBonus 仅用于 AI 与概率提示，不降低玩家成功率。
    gen.faction = this.playerFaction;
    gen.loyalty = 70;
    const capital = this.cities.get(FACTIONS[this.playerFaction].capital);
    gen.location = capital ? capital.id : null;
    this.stats.idleRecruited++;
    this.pushLog(`贤士 ${gen.name} 来投！`);
    return { ok: true, msg: `${gen.name} 加入我方！` };
  }
  getIdleGenerals() {
    return [...this.generals.values()].filter(g => g.faction === null);
  }

  // ---------- 存档 ----------
  serialize() {
    return {
      turn: this.turn, seasonIdx: this.seasonIdx, playerFaction: this.playerFaction,
      state: this.state,
      cities: [...this.cities.entries()].map(([k, v]) => [k, v.serialize()]),
      generals: [...this.generals.entries()].map(([k, v]) => [k, v.serialize()]),
      armies: this.armies.map(a => a.serialize()),
      factionRes: [...this.factionRes.entries()],
      diplomacy: this.diplomacy.serialize(),
      log: this.log, gameOver: this.gameOver,
      selectedCity: this.selectedCity, selectedArmy: this.selectedArmy,
      // 新增字段
      techs: this.techs, researching: this.researching,
      achievements: this.achievements, pendingAchievements: this.pendingAchievements,
      stats: this.stats, initialIdleCount: this.initialIdleCount,
      garrisonBuffTurns: this.garrisonBuffTurns,
      // V2.0 新系统
      tradeRoutes: this.tradeRoutes,
      inventory: [...this.inventory.entries()],
      // V2.5 新系统
      marriages: this.marriages,
      hostages: this.hostages,
      spies: this.spies,
      fogOfWar: this.fogOfWar,
      passes: this.passes,
      supplyLines: this.supplyLines,
      barbarianTribes: this.barbarianTribes,
      // V3.0 新系统
      scenario: this.scenario,
      storyProgress: this.story.serialize(),
      endingTriggered: this.endings.triggered,
      currentEnding: this.endings.triggered,
      barbarianControlCenters: this.barbarianControlCenters,
      // V3.5 新系统
      ngPlusLevel: this.ngPlusLevel,
      unlockedTitles: this.unlockedTitles,
      activeTitles: this.activeTitles,
      gameStats: this.gameStats,
      generalStats: this.generalStats,
      introCompleted: this.introCompleted,
      // V4.0: 模组状态记录
      modState: { enabledMods: modManager.getModList().filter(m => m.enabled).map(m => m.id) },
      // V5.0: 热座多人模式
      isHotSeat: this.isHotSeat,
      humanFactions: this.humanFactions,
      turnOrder: this.turnOrder,
      currentPlayerIndex: this.currentPlayerIndex,
      // V6.0: 宗教文化系统
      religionSystem: this.religionSystem.serialize(),
      navyBuilt: this.navyBuilt,
      cultureVictoryTurns: this.cultureVictoryTurns,
      // V7.0: 王朝 / 贸易系统
      dynastySystem: this.dynastySystem.serialize(),
      tradeSystem: this.tradeSystem.serialize()
    };
  }

  static deserialize(data) {
    const g = new Game();
    g.turn = data.turn;
    g.seasonIdx = data.seasonIdx;
    g.playerFaction = data.playerFaction;
    g.state = data.state || 'playing';
    g.cities = new Map(data.cities.map(([k, v]) => [k, City.deserialize(v)]));
    g.generals = new Map(data.generals.map(([k, v]) => [k, General.deserialize(v)]));
    g.armies = data.armies.map(a => Army.deserialize(a));
    g.factionRes = new Map(data.factionRes);
    g.diplomacy = DiplomacySystem.deserialize(data.diplomacy);
    g.log = data.log || [];
    g.gameOver = data.gameOver;
    g.selectedCity = data.selectedCity;
    g.selectedArmy = data.selectedArmy;

    // ---- 旧存档字段补全（兼容） ----
    g.techs = Array.isArray(data.techs) ? data.techs : [];
    g.researching = data.researching || null;
    g.achievements = data.achievements || {};
    g.pendingAchievements = Array.isArray(data.pendingAchievements) ? data.pendingAchievements : [];
    g.stats = Object.assign(g._defaultStats(), data.stats || {});
    g.initialIdleCount = data.initialIdleCount || 3;
    g.garrisonBuffTurns = data.garrisonBuffTurns || 0;
    g.activeBattle = null; // 战斗不跨存档
    // V2.0：旧存档字段补全
    g.tradeRoutes = Array.isArray(data.tradeRoutes) ? data.tradeRoutes : [];
    g.inventory = (data.inventory && data.inventory instanceof Map)
      ? data.inventory
      : new Map(Array.isArray(data.inventory) ? data.inventory : []);
    for (const fid of Object.keys(FACTIONS)) {
      if (!g.inventory.has(fid)) g.inventory.set(fid, []);
    }
    // V2.5：旧存档新字段默认值补全
    g.marriages = Array.isArray(data.marriages) ? data.marriages : [];
    g.hostages = Array.isArray(data.hostages) ? data.hostages : [];
    g.spies = Array.isArray(data.spies) ? data.spies : [];
    // 旧密探状态兜底
    for (const s of g.spies) if (s.status === undefined) s.status = 'active';
    g.fogOfWar = data.fogOfWar && typeof data.fogOfWar === 'object'
      ? { explored: Array.isArray(data.fogOfWar.explored) ? data.fogOfWar.explored : [],
          intelVision: data.fogOfWar.intelVision || {} }
      : { explored: [], intelVision: {} };
    // 关隘：旧存档缺省时按静态表初始化
    g.passes = data.passes && typeof data.passes === 'object' ? data.passes : initPasses();
    for (const pid of Object.keys(initPasses())) {
      if (!g.passes[pid]) g.passes[pid] = { id: pid, built: false, owner: null, garrison: 0, pending: 0 };
    }
    g.supplyLines = data.supplyLines && typeof data.supplyLines === 'object' ? data.supplyLines : {};
    g.barbarianTribes = Array.isArray(data.barbarianTribes) ? data.barbarianTribes : initBarbarianTribes();
    // V3.0：旧存档新字段默认值补全
    g.scenario = (data.scenario && SCENARIOS[data.scenario]) ? data.scenario : DEFAULT_SCENARIO;
    g.story = (data.storyProgress && typeof data.storyProgress === 'object')
      ? StorySystem.deserialize(data.storyProgress) : new StorySystem();
    g.endings = EndingSystem.deserialize({ triggered: data.endingTriggered || data.currentEnding || null });
    g.barbarianControlCenters = data.barbarianControlCenters || 0;
    // V3.5：旧存档新字段默认值补全
    g.ngPlusLevel = typeof data.ngPlusLevel === 'number' ? data.ngPlusLevel : 0;
    g.unlockedTitles = (data.unlockedTitles && typeof data.unlockedTitles === 'object') ? data.unlockedTitles : {};
    g.activeTitles = (data.activeTitles && typeof data.activeTitles === 'object') ? data.activeTitles : {};
    g.gameStats = Object.assign(defaultGameStats(), data.gameStats || {});
    g.generalStats = (data.generalStats && typeof data.generalStats === 'object') ? data.generalStats : {};
    g.introCompleted = !!data.introCompleted;
    g.pendingTitles = [];
    // V4.0: 旧存档无 modState 字段时默认为空
    g.modState = data.modState || { enabledMods: [] };
    // 联姻经济袋重建
    g.diplomacy.refreshMarriageBag(g);
    // 旧武将补全 exp/level/skills（General.deserialize 已默认，这里兜底）
    for (const gen of g.generals.values()) {
      if (gen.exp === undefined) gen.exp = 0;
      if (gen.level === undefined) gen.level = 1;
      // V3.0：合并 NEW_GENERAL_SKILLS（新武将复用技能）
      const merged = [...new Set([
        ...(getGeneralSkills(gen.id).map(s => s.id)),
        ...(NEW_GENERAL_SKILLS[gen.id] || [])
      ])];
      if (!Array.isArray(gen.skills) || gen.skills.length === 0) gen.skills = merged;
      if (gen.wounded === undefined) gen.wounded = 0;
      // 旧武将补 equipment 字段
      if (!gen.equipment) gen.equipment = { weapon: null, armor: null, mount: null, treasure: null };
    }
    // 旧军队补 formation/unitTier/pendingUpgrades
    for (const army of g.armies) {
      if (!army.formation) army.formation = 'heyi';
      if (!army.unitTier) army.unitTier = { infantry: 0, cavalry: 0, archer: 0 };
      if (!Array.isArray(army.pendingUpgrades)) army.pendingUpgrades = [];
    }
    // 旧城市补 buildings/buildingThisTurn
    for (const city of g.cities.values()) {
      if (!city.buildings) city.buildings = {};
      city.buildingThisTurn = !!city.buildingThisTurn;
    }

    // V5.0：热座模式状态恢复（旧存档无此字段时默认单人）
    g.isHotSeat = !!data.isHotSeat;
    g.humanFactions = Array.isArray(data.humanFactions) ? data.humanFactions : [];
    g.turnOrder = Array.isArray(data.turnOrder) && data.turnOrder.length
      ? data.turnOrder : [g.playerFaction];
    g.currentPlayerIndex = Number.isInteger(data.currentPlayerIndex) ? data.currentPlayerIndex : 0;
    // 防御性修正：currentPlayerIndex 落在 turnOrder 范围内
    if (g.currentPlayerIndex < 0 || g.currentPlayerIndex >= g.turnOrder.length) {
      g.currentPlayerIndex = Math.max(0, g.turnOrder.indexOf(g.playerFaction));
    }

    // V6.0：旧存档补全宗教文化系统字段
    g.religionSystem = (data.religionSystem && typeof data.religionSystem === 'object')
      ? ReligionSystem.deserialize(data.religionSystem) : new ReligionSystem();
    g.navyBuilt = (data.navyBuilt && typeof data.navyBuilt === 'object') ? data.navyBuilt : {};
    g.cultureVictoryTurns = typeof data.cultureVictoryTurns === 'number' ? data.cultureVictoryTurns : 0;
    // 旧城市补 religion 字段
    for (const city of g.cities.values()) {
      if (!city.religion) city.religion = { buddhist: 0, daoist: 0, culture: 0 };
    }

    // V7.0：旧存档补全王朝 / 贸易系统
    g.dynastySystem = (data.dynastySystem && typeof data.dynastySystem === 'object')
      ? DynastySystem.deserialize(data.dynastySystem) : new DynastySystem();
    g.tradeSystem = (data.tradeSystem && typeof data.tradeSystem === 'object')
      ? TradeSystem.deserialize(data.tradeSystem) : new TradeSystem();
    // 还原禅让后势力名/旗色（FACTIONS 为模块级对象，需按存档王朝记录重放）
    for (const [fid, rec] of Object.entries(g.dynastySystem.factions || {})) {
      const dyn = (typeof DYNASTIES !== 'undefined') ? DYNASTIES[rec.dynastyId] : null;
      if (dyn && FACTIONS[fid]) {
        FACTIONS[fid].name = dyn.name;
        FACTIONS[fid].color = dyn.color;
        FACTIONS[fid].colorLight = dyn.colorLight;
      }
    }

    // V3.0/V5.0：为「激活势力」创建 AI。
    // 单人模式：除玩家外全部建 AI；热座模式：仅非人类控制势力建 AI。
    g.aiPlayers = new Map();
    for (const fid of g.factionRes.keys()) {
      if (g.isHotSeat) {
        if (!g.humanFactions.includes(fid)) g.aiPlayers.set(fid, new AIPlayer(fid));
      } else if (fid !== g.playerFaction) {
        g.aiPlayers.set(fid, new AIPlayer(fid));
      }
    }
    if (typeof window !== 'undefined') window.__game = g;
    return g;
  }

  // ============================================================
  // V5.5 局域网对战：客机接收主机广播的完整状态快照
  // 客机侧调用：把反序列化后的快照替换当前游戏状态。
  // yourTurn: 'host' | 'client' —— 标记这一回合该谁操作。
  // ============================================================
  applyNetworkState(serialized, yourTurn) {
    if (!serialized) return;
    // 保留 netRole（快照里不带）
    const role = this.netRole;
    const opponent = this.netOpponentFaction;
    const fresh = Game.deserialize(serialized);
    // 用反序列化出的新状态整体替换（浅拷贝到 this）
    for (const k of Object.keys(fresh)) this[k] = fresh[k];
    this.netRole = role;
    this.netOpponentFaction = opponent;
    // 客机：只能操作自己的势力
    if (role === 'client') {
      this.playerFaction = this.netOpponentFaction;
      this.state = (yourTurn === 'client') ? 'playing' : 'waiting';
    }
    // 主机：自己回合则 playing，否则 waiting
    if (role === 'host') {
      this.state = (yourTurn === 'host') ? 'playing' : 'waiting';
    }
  }
}
