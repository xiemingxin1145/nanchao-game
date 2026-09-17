// ============================================================
// events.js — 事件系统
// ============================================================
import { EVENTS, HISTORICAL_EVENTS, FACTIONS } from './data.js';

export class EventSystem {
  constructor() {
    this.pendingEvents = [];
    this.history = [];
  }

  // 每回合随机触发事件
  rollEvent(game) {
    // 30% 概率触发随机事件
    if (Math.random() < 0.35) {
      const evt = EVENTS[Math.floor(Math.random() * EVENTS.length)];
      this.pendingEvents.push(evt);
      game.pushLog(`事件触发：${evt.name}`);
    }

    // 历史事件
    for (const hevt of HISTORICAL_EVENTS) {
      if (game.turn >= hevt.minTurn && hevt.faction === game.playerFaction) {
        if (!this.history.includes(hevt.id)) {
          this.pendingEvents.push(hevt);
          this.history.push(hevt.id);
          game.pushLog(`历史事件：${hevt.name}`);
        }
      }
    }
  }

  // 应用事件效果（玩家选择后调用）
  applyEvent(game, event, optionIdx) {
    const opt = event.options[optionIdx];
    if (!opt) return;
    const eff = opt.effect;
    const res = game.getPlayerRes();
    const playerCities = game.getFactionCities(game.playerFaction);

    if (eff.money) res.money = Math.max(0, res.money + eff.money);
    if (eff.food) res.food = Math.max(0, res.food + eff.food);
    if (eff.morale) {
      // 影响所有己方城市民心
      for (const c of playerCities) {
        c.morale = Math.max(0, Math.min(100, c.morale + eff.morale));
      }
    }
    if (eff.pop) {
      // 随机一个城市增加人口
      if (playerCities.length > 0) {
        const c = playerCities[Math.floor(Math.random() * playerCities.length)];
        c.pop = Math.max(0, c.pop + eff.pop);
      }
    }
    if (eff.agri) {
      if (playerCities.length > 0) {
        const c = playerCities[Math.floor(Math.random() * playerCities.length)];
        c.agri = Math.max(0, c.agri + eff.agri);
      }
    }
    if (eff.armyLoss) {
      // 从己方军队/驻军中扣除
      const myArmies = game.getFactionArmies(game.playerFaction);
      let remaining = eff.armyLoss;
      for (const a of myArmies) {
        const take = Math.min(a.troops, remaining);
        a.troops -= take;
        remaining -= take;
        if (remaining <= 0) break;
      }
      if (remaining > 0 && playerCities.length > 0) {
        const c = playerCities[0];
        c.garrison = Math.max(0, c.garrison - remaining);
      }
    }
    if (eff.recruitRandom) {
      const idle = game.getIdleGenerals();
      if (idle.length > 0) {
        const gen = idle[Math.floor(Math.random() * idle.length)];
        game.recruitIdleGeneral(gen.id);
      }
    }
    if (eff.shouyang_rebel) {
      const c = game.cities.get('shouyang');
      if (c) {
        c.owner = null;
        c.morale = 30;
        game.pushLog('寿阳脱离掌控！');
      }
    }

    game.pushLog(`【${event.name}】${opt.text} — 结果已生效`);
  }

  serialize() {
    return { history: this.history };
  }

  static deserialize(data) {
    const e = new EventSystem();
    if (data && data.history) e.history = data.history;
    return e;
  }
}
