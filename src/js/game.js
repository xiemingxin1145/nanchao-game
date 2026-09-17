// ============================================================
// game.js — 游戏主类、状态机、回合管理
// ============================================================
import { FACTIONS, SEASONS, CITY_LINKS, UNIT_TYPES, COUNTER_RELATION } from './data.js';
import { City, createInitialCities } from './city.js';
import { General, createInitialGenerals } from './general.js';
import { Army, computeBattle, getMoveableCities, getAttackableCities, citiesAdjacent } from './army.js';
import { AIPlayer } from './ai.js';
import { EventSystem } from './events.js';
import { DiplomacySystem } from './diplomacy.js';

let armyIdCounter = 100;

export class Game {
  constructor() {
    this.state = 'menu'; // menu | faction_select | playing | battle | event | gameover
    this.turn = 1;
    this.seasonIdx = 0;
    this.playerFaction = null;
    this.cities = new Map();      // cityId -> City
    this.generals = new Map();    // generalId -> General
    this.armies = [];             // Army[]
    this.factionRes = new Map();  // factionId -> { money, food, morale }
    this.diplomacy = new DiplomacySystem();
    this.eventSystem = new EventSystem();
    this.log = [];
    this.selectedCity = null;
    this.selectedArmy = null;
    this.battleResult = null;
    this.gameOver = null;         // { win: bool, text: string }
    this.aiPlayers = new Map();   // factionId -> AIPlayer
  }

  // ---------- 初始化新游戏 ----------
  initGame(playerFactionId) {
    this.playerFaction = playerFactionId;
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

    // 初始化城市
    const cityList = createInitialCities();
    for (const c of cityList) this.cities.set(c.id, c);

    // 初始化武将
    const genList = createInitialGenerals();
    for (const g of genList) this.generals.set(g.id, g);

    // 分配城市归属
    for (const [fid, faction] of Object.entries(FACTIONS)) {
      for (const cid of faction.startCities) {
        const c = this.cities.get(cid);
        if (c) c.owner = fid;
      }
      this.factionRes.set(fid, {
        money: fid === playerFactionId ? 2000 : 1500,
        food: 3000,
        totalMorale: 60
      });
    }

    // 初始化武将位置：归属势力的初始武将放在都城
    for (const gen of this.generals.values()) {
      if (gen.faction && gen.faction !== null) {
        const fac = FACTIONS[gen.faction];
        gen.location = fac.capital;
        // 给每个势力的初始城市驻兵
        const capital = this.cities.get(fac.capital);
        if (capital && !capital.garrison) {
          capital.garrison = 5000;
        }
      }
    }

    // 给每个势力其他城市初始驻军
    for (const [fid, faction] of Object.entries(FACTIONS)) {
      for (const cid of faction.startCities) {
        const c = this.cities.get(cid);
        if (c && !c.garrison) c.garrison = 3000;
      }
    }

    // AI 初始化
    for (const fid of Object.keys(FACTIONS)) {
      if (fid !== playerFactionId) {
        this.aiPlayers.set(fid, new AIPlayer(fid));
      }
    }

    // 初始组建军队
    this.setupInitialArmies();

    this.state = 'playing';
    this.pushLog(`—— 第 ${this.turn} 回合 · ${SEASONS[this.seasonIdx]}季 ——`);
    this.pushLog(`${FACTIONS[playerFactionId].name} 开始称霸之路！`);

    // 暴露全局供 UI 使用
    window.__game = this;
  }

  setupInitialArmies() {
    for (const [fid, faction] of Object.entries(FACTIONS)) {
      // 每个势力从都城派一支初始军队
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
  getFactionCities(fid) {
    return [...this.cities.values()].filter(c => c.owner === fid);
  }
  getFactionGenerals(fid) {
    return [...this.generals.values()].filter(g => g.faction === fid);
  }
  getFactionArmies(fid) {
    return this.armies.filter(a => a.faction === fid);
  }
  getSeason() { return SEASONS[this.seasonIdx]; }
  getPlayerRes() { return this.factionRes.get(this.playerFaction); }

  pushLog(text) {
    this.log.push(`[${this.turn}.${this.getSeason()}] ${text}`);
    if (this.log.length > 200) this.log.shift();
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
    if (result.ok) {
      res.money -= cost;
      this.pushLog(`${city.name} ${result.msg}（花费${cost}金）`);
    }
    return result;
  }

  cityDevelopComm(cityId) {
    const city = this.cities.get(cityId);
    if (!city || city.owner !== this.playerFaction) return { ok: false, msg: '无权操作' };
    const res = this.getPlayerRes();
    const cost = 200;
    if (res.money < cost) return { ok: false, msg: '金钱不足' };
    const result = city.developComm(cost);
    if (result.ok) {
      res.money -= cost;
      this.pushLog(`${city.name} ${result.msg}（花费${cost}金）`);
    }
    return result;
  }

  cityRepair(cityId) {
    const city = this.cities.get(cityId);
    if (!city || city.owner !== this.playerFaction) return { ok: false, msg: '无权操作' };
    const res = this.getPlayerRes();
    const cost = 150;
    if (res.money < cost) return { ok: false, msg: '金钱不足' };
    const result = city.repairDefense(cost);
    if (result.ok) {
      res.money -= cost;
      this.pushLog(`${city.name} ${result.msg}（花费${cost}金）`);
    }
    return result;
  }

  cityAssignMayor(cityId, generalId) {
    const city = this.cities.get(cityId);
    const gen = this.generals.get(generalId);
    if (!city || city.owner !== this.playerFaction) return { ok: false, msg: '无权操作' };
    if (!gen || gen.faction !== this.playerFaction) return { ok: false, msg: '该武将不属我方' };
    // 先解除旧太守
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

  // ---------- 军队操作 ----------
  createArmyFromGarrison(cityId, generalId, troops) {
    const city = this.cities.get(cityId);
    const gen = this.generals.get(generalId);
    if (!city || city.owner !== this.playerFaction) return { ok: false, msg: '无权操作' };
    if (!gen || gen.faction !== this.playerFaction) return { ok: false, msg: '该武将不属我方' };
    if (gen.inArmy) return { ok: false, msg: '该武将已在军中' };
    if (city.garrison < troops) return { ok: false, msg: '驻军不足' };
    const maxT = gen.getMaxTroops();
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

    if (target.owner === this.playerFaction) {
      // 移动到己方城市
      // 粮草消耗
      const res = this.getPlayerRes();
      const foodCost = Math.round(army.troops * 0.05 * 2); // 行军双倍
      res.food -= foodCost;
      army.cityId = targetCityId;
      army.hasMoved = true;
      const gen = this.generals.get(army.generalId);
      if (gen) gen.location = army.id;
      this.pushLog(`${gen ? gen.name : '军队'} 行军至 ${target.name}（耗粮${foodCost}）`);
      return { ok: true, msg: `军队移动至${target.name}` };
    } else if (target.owner === null) {
      // 占领无主城市
      const res = this.getPlayerRes();
      const foodCost = Math.round(army.troops * 0.05 * 2);
      res.food -= foodCost;
      target.owner = this.playerFaction;
      target.morale = 40;
      army.cityId = targetCityId;
      army.hasMoved = true;
      const gen = this.generals.get(army.generalId);
      this.pushLog(`${gen ? gen.name : '军队'} 占领无主城市 ${target.name}！`);
      this.checkVictory();
      return { ok: true, msg: `占领${target.name}！` };
    } else {
      // 攻击敌方城市
      return this.attackCity(army, target);
    }
  }

  attackCity(army, targetCity) {
    const attackerGen = this.generals.get(army.generalId);
    const defenderGeneral = this.findDefenderGeneral(targetCity.id);

    const attackerData = {
      troops: army.troops,
      unitType: army.getMainUnit(),
      unitCoeff: army.getAvgUnitCoeff(),
      general: attackerGen ? {
        command: attackerGen.command, force: attackerGen.force,
        intel: attackerGen.intel, name: attackerGen.name
      } : { command: 50, force: 50, intel: 50 },
      cityDefense: 0
    };

    const defenderData = {
      troops: targetCity.garrison,
      unitType: 'infantry',
      unitCoeff: 1.0,
      general: defenderGeneral ? {
        command: defenderGeneral.command, force: defenderGeneral.force,
        intel: defenderGeneral.intel, name: defenderGeneral.name
      } : { command: 50, force: 50, intel: 50 },
      cityDefense: targetCity.defense
    };

    const result = computeBattle(attackerData, defenderData, 'plain', targetCity.terrain);
    result.attackerName = attackerGen ? attackerGen.name : '我军';
    result.defenderName = defenderGeneral ? defenderGeneral.name : '守军';
    result.attackerFaction = army.faction;
    result.defenderFaction = targetCity.owner;
    result.targetCityId = targetCity.id;
    result.targetCityName = targetCity.name;

    // 应用伤亡
    army.troops = Math.max(0, army.troops - result.attackerLoss);
    targetCity.garrison = Math.max(0, targetCity.garrison - result.defenderLoss);

    if (result.attackerWin && !result.draw) {
      // 攻陷城市
      const oldOwner = targetCity.owner;
      targetCity.owner = army.faction;
      targetCity.morale = 30;
      army.cityId = targetCity.id;
      if (attackerGen) attackerGen.location = army.id;
      result.conquered = true;
      this.pushLog(`${attackerGen ? attackerGen.name : '我军'} 攻陷 ${targetCity.name}！守将 ${result.defenderName} 败退。`);

      // 检查敌方都城
      const targetFaction = FACTIONS[oldOwner];
      if (targetFaction && targetFaction.capital === targetCity.id) {
        this.pushLog(`${targetFaction.name} 都城 ${targetCity.name} 已被攻陷！`);
        // 清除该势力在野武将
        for (const g of this.generals.values()) {
          if (g.faction === oldOwner) g.faction = null;
        }
      }

      this.checkVictory();
      this.checkDefeat();
    } else if (result.draw) {
      this.pushLog(`${targetCity.name} 攻防战相持不下，双方各自收兵。`);
    } else {
      // 攻击失败，撤退
      this.pushLog(`${attackerGen ? attackerGen.name : '我军'} 攻 ${targetCity.name} 失败，撤退。`);
      if (army.troops <= 0) {
        this.pushLog(`${attackerGen ? attackerGen.name : '残军'} 全军覆没！`);
        army.destroyed = true;
        if (attackerGen) {
          attackerGen.inArmy = null;
          attackerGen.location = army.cityId;
        }
      }
    }

    army.hasMoved = true;
    this.armies = this.armies.filter(a => !a.destroyed);
    // 仅玩家参与的战斗才弹出结算弹窗
    if (army.faction === this.playerFaction) {
      this.battleResult = result;
      this.state = 'battle';
    }
    return { ok: true, result };
  }

  findDefenderGeneral(cityId) {
    // 找在该城市守城的武将（非太守且在城中驻军）
    const city = this.cities.get(cityId);
    if (!city) return null;
    // 优先太守
    if (city.mayor) return this.generals.get(city.mayor);
    // 找在该城市的武将
    const gen = [...this.generals.values()].find(g => g.location === cityId && g.faction === city.owner && !g.inArmy);
    return gen || null;
  }

  disbandArmy(armyId) {
    const army = this.armies.find(a => a.id === armyId);
    if (!army || army.faction !== this.playerFaction) return { ok: false, msg: '无法解散' };
    const city = this.cities.get(army.cityId);
    if (city) city.garrison += army.troops;
    const gen = this.generals.get(army.generalId);
    if (gen) {
      gen.inArmy = null;
      gen.location = army.cityId;
    }
    this.armies = this.armies.filter(a => a.id !== armyId);
    this.pushLog(`${gen ? gen.name : '军队'} 解散，兵力${army.troops}归入 ${city ? city.name : ''} 城防`);
    return { ok: true };
  }

  // ---------- 结束回合 ----------
  endTurn() {
    // 玩家阶段结束 → AI 行动 → 结算 → 下回合
    this.state = 'ai_turn';
    this.pushLog('—— 玩家阶段结束，AI 势力行动中 ——');

    // 重置军队行动标记
    for (const army of this.armies) army.hasMoved = false;

    // AI 行动
    this.runAITurns();

    // 结算阶段
    this.settleTurn();

    // 季节推进
    this.seasonIdx = (this.seasonIdx + 1) % 4;
    this.turn++;

    // 事件触发
    this.eventSystem.rollEvent(this);

    this.pushLog(`—— 第 ${this.turn} 回合 · ${this.getSeason()}季 ——`);
    this.state = 'playing';

    // 检查胜负
    this.checkVictory();
    this.checkDefeat();
  }

  runAITurns() {
    for (const [fid, ai] of this.aiPlayers) {
      if (this.gameOver) break;
      ai.takeTurn(this);
    }
  }

  settleTurn() {
    const season = this.getSeason();

    for (const [fid, res] of this.factionRes) {
      let totalIncome = 0, totalFood = 0;
      const cities = this.getFactionCities(fid);
      for (const city of cities) {
        const { income, food } = city.endTurn(season);
        totalIncome += income;
        totalFood += food;
      }
      res.money += totalIncome;
      res.food += totalFood;

      // 军队粮草消耗
      const armies = this.getFactionArmies(fid);
      let armyFoodCost = 0;
      for (const army of armies) {
        armyFoodCost += Math.round(army.troops * 0.05);
      }
      res.food -= armyFoodCost;
      if (res.food < 0) {
        // 缺粮降军心
        res.money -= Math.abs(res.food) * 2;
        res.food = 0;
      }

      // 武将忠诚
      for (const gen of this.getFactionGenerals(fid)) {
        gen.endTurn();
        // 低忠诚策反/下野
        if (gen.loyalty < 30 && Math.random() < 0.15) {
          gen.faction = null;
          this.pushLog(`${gen.name} 因忠诚过低下野而去！`);
        }
      }
    }
  }

  // ---------- 胜负 ----------
  checkVictory() {
    const playerCities = this.getFactionCities(this.playerFaction);
    if (playerCities.length >= 16) {
      this.gameOver = { win: true, text: '王师所向，一统天下！四海归一，建不世之业！' };
      this.state = 'gameover';
      return true;
    }
    return false;
  }

  checkDefeat() {
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
    gen.faction = this.playerFaction;
    gen.loyalty = 70;
    const capital = this.cities.get(FACTIONS[this.playerFaction].capital);
    gen.location = capital.id;
    this.pushLog(`贤士 ${gen.name} 来投！`);
    return { ok: true, msg: `${gen.name} 加入我方！` };
  }

  getIdleGenerals() {
    return [...this.generals.values()].filter(g => g.faction === null);
  }

  // ---------- 存档 ----------
  serialize() {
    return {
      turn: this.turn,
      seasonIdx: this.seasonIdx,
      playerFaction: this.playerFaction,
      state: this.state,
      cities: [...this.cities.entries()].map(([k, v]) => [k, v.serialize()]),
      generals: [...this.generals.entries()].map(([k, v]) => [k, v.serialize()]),
      armies: this.armies.map(a => a.serialize()),
      factionRes: [...this.factionRes.entries()],
      diplomacy: this.diplomacy.serialize(),
      log: this.log,
      gameOver: this.gameOver,
      selectedCity: this.selectedCity,
      selectedArmy: this.selectedArmy
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
    // 重建 AI
    for (const fid of Object.keys(FACTIONS)) {
      if (fid !== g.playerFaction) {
        g.aiPlayers.set(fid, new AIPlayer(fid));
      }
    }
    window.__game = g;
    return g;
  }
}
