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
    // 35% 概率触发随机事件
    if (Math.random() < 0.35) {
      const evt = EVENTS[Math.floor(Math.random() * EVENTS.length)];
      this.pendingEvents.push(evt);
      game.pushLog(`事件触发：${evt.name}`);
    }

    // 历史事件（支持 faction 单值 / factions 数组 / condition 回调）
    for (const hevt of HISTORICAL_EVENTS) {
      if (this.history.includes(hevt.id)) continue;
      if (game.turn < (hevt.minTurn || 0)) continue;
      const factionOk = hevt.factions
        ? hevt.factions.includes(game.playerFaction)
        : (hevt.faction === game.playerFaction);
      if (!factionOk) continue;
      let condOk = true;
      if (typeof hevt.condition === 'function') {
        try { condOk = !!hevt.condition(game); } catch (e) { condOk = false; }
      }
      if (!condOk) continue;
      this.pendingEvents.push(hevt);
      this.history.push(hevt.id);
      game.pushLog(`历史事件：${hevt.name}`);
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
      for (const c of playerCities) {
        c.morale = Math.max(0, Math.min(100, c.morale + eff.morale));
      }
    }
    if (eff.armyMorale && res) {
      res.totalMorale = Math.max(0, Math.min(100, (res.totalMorale || 60) + eff.armyMorale));
    }
    if (eff.pop) {
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
    if (eff.comm) {
      if (playerCities.length > 0) {
        const c = playerCities[Math.floor(Math.random() * playerCities.length)];
        c.comm = Math.max(0, Math.min(100, c.comm + eff.comm));
      }
    }
    if (eff.prosperity) {
      if (playerCities.length > 0) {
        const c = playerCities[Math.floor(Math.random() * playerCities.length)];
        c.prosperity = Math.max(0, Math.min(100, c.prosperity + eff.prosperity));
      }
    }
    if (eff.armyLoss) {
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
    if (eff.recruitGeneral) {
      const gen = game.generals.get(eff.recruitGeneral);
      if (gen && gen.faction === null) {
        gen.faction = game.playerFaction;
        gen.loyalty = 75;
        const capital = game.cities.get(FACTIONS[game.playerFaction].capital);
        gen.location = capital.id;
        game.pushLog(`${gen.name} 加入我方！`);
      }
    }
    if (eff.garrisonBuff) {
      game.garrisonBuffTurns = 2; // 守城战力大幅提升，持续2回合
      game.pushLog('全城誓死守城！接下来两回合守城战力大增。');
    }
    if (eff.massBattle) {
      game.resolveMassBattle();
    }
    if (eff.recaptureJiankang) {
      const c = game.cities.get('shouyang');
      if (c && c.owner === null) {
        c.owner = game.playerFaction;
        c.morale = 50;
        game.pushLog('官军收复寿阳，建康之围遂解！');
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
