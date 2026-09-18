// ============================================================
// events.js — 事件系统  [V8.1]
// V8.1：新增 getTriggeredEvents/isEventTriggered/summarizeEffect；
//       历史事件触发时 try-catch 播放 event BGM；已触发标记不重复。
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
      // V8.1：事件触发时尝试播放 event BGM（全局 audio 若存在，try-catch 包裹，不改 audio.js）
      this._tryPlayEventBGM();
    }
  }

  // V8.1：尝试播放事件 BGM（兼容全局/可选 audio 对象，不依赖 audio.js 内部）
  _tryPlayEventBGM() {
    try {
      const a = (typeof globalThis !== 'undefined' && globalThis.__ui && globalThis.__ui.audio)
        || (typeof globalThis !== 'undefined' && globalThis.audio)
        || null;
      if (a) {
        if (typeof a.playBGM === 'function') a.playBGM('event');
        else if (typeof a.switchBGM === 'function') a.switchBGM('event');
      }
    } catch (e) { /* 忽略音频不可用 */ }
  }

  // V8.1：返回已触发历史事件 id 列表（不重复触发的依据）
  getTriggeredEvents() {
    return [...this.history];
  }

  // V8.1：判断某历史事件是否已触发
  isEventTriggered(id) {
    return this.history.includes(id);
  }

  // V8.1：将 effect 对象转为可读效果摘要（供 UI 结果弹窗使用）
  summarizeEffect(eff) {
    if (!eff) return [];
    const parts = [];
    const fmt = (v, label) => (v > 0 ? `${label}+${v}` : v < 0 ? `${label}${v}` : '');
    if (eff.money) parts.push(fmt(eff.money, '金钱'));
    if (eff.food) parts.push(fmt(eff.food, '粮草'));
    if (eff.pop) parts.push(fmt(eff.pop, '人口'));
    if (eff.morale) parts.push(fmt(eff.morale, '民心'));
    if (eff.factionMorale) parts.push(fmt(eff.factionMorale, '民心'));
    if (eff.comm) parts.push(fmt(eff.comm, '商业'));
    if (eff.prosperity) parts.push(fmt(eff.prosperity, '繁荣'));
    if (eff.culture) parts.push(fmt(eff.culture, '文化'));
    if (eff.tech) parts.push(fmt(eff.tech, '科技'));
    if (eff.armyMorale) parts.push(fmt(eff.armyMorale, '军心'));
    if (eff.armyLoss) parts.push(`损兵${eff.armyLoss}`);
    if (eff.recruitRandom) parts.push('招募一将');
    if (eff.massBattle) parts.push('触发大战');
    if (eff.garrisonBuff) parts.push('守城buff');
    if (eff.destroyTemple) parts.push('灭佛');
    if (eff.generalLoyalty && typeof eff.generalLoyalty === 'object')
      parts.push(`忠诚${eff.generalLoyalty.amt > 0 ? '+' : ''}${eff.generalLoyalty.amt}`);
    if (eff.generalBuff) parts.push(`【${eff.generalBuff.id}】属性+${eff.generalBuff.amt}`);
    if (eff.generalDebuff) parts.push(`【${eff.generalDebuff.id}】属性-${eff.generalDebuff.amt}`);
    if (eff.generalDeath) parts.push(`【${eff.generalDeath}】去势`);
    return parts;
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

    if (eff.barbarianRel) {
      // V2.5：与全部蛮族部落关系改善（互市/安抚类事件）
      for (const tribe of (game.barbarianTribes || [])) {
        tribe.relation = Math.max(-100, Math.min(100, tribe.relation + eff.barbarianRel));
      }
    }
    if (eff.spyMaster) {
      // V2.5：异人来投（高智力在野武将直接归心）
      const spies = game.getIdleGenerals();
      if (spies.length) {
        const sp = spies.sort((a, b) => b.effIntel - a.effIntel)[0];
        sp.faction = game.playerFaction;
        sp.loyalty = 70;
        const capital = game.cities.get(FACTIONS[game.playerFaction].capital);
        sp.location = capital.id;
        game.pushLog(`异人【${sp.name}】身怀异术，投身主公！可遣为密探。`);
      }
    }

    // ---- V3.0 新效果类型（历史事件/武将剧情共用） ----
    if (eff.factionMorale) {
      // 全势力城市民心增减
      for (const c of playerCities) {
        c.morale = Math.max(0, Math.min(100, c.morale + eff.factionMorale));
      }
    }
    if (eff.generalBuff) {
      // 指定武将 command+force 同步提升（<amt>点）
      const g = game.generals.get(eff.generalBuff.id);
      if (g) {
        g.command += eff.generalBuff.amt;
        g.force += eff.generalBuff.amt;
        game.pushLog(`${g.name} 获历练，统武各+${eff.generalBuff.amt}`);
      }
    }
    if (eff.generalDebuff) {
      // 指定武将 command+force 下降（伤病/薨逝之兆）
      const g = game.generals.get(eff.generalDebuff.id);
      if (g) {
        g.command = Math.max(1, g.command - eff.generalDebuff.amt);
        g.force = Math.max(1, g.force - eff.generalDebuff.amt);
        game.pushLog(`${g.name} 境遇不佳，统武各-${eff.generalDebuff.amt}`);
      }
    }
    if (eff.generalPolitics) {
      const g = game.generals.get(eff.generalPolitics.id);
      if (g) { g.politics += eff.generalPolitics.amt; game.pushLog(`${g.name} 政治+${eff.generalPolitics.amt}`); }
    }
    if (eff.generalIntel) {
      const g = game.generals.get(eff.generalIntel.id);
      if (g) { g.intel += eff.generalIntel.amt; game.pushLog(`${g.name} 智力+${eff.generalIntel.amt}`); }
    }
    if (eff.generalLoyalty) {
      // { id?, amt }：指定武将或全势力武将忠诚增减
      if (eff.generalLoyalty.id) {
        const g = game.generals.get(eff.generalLoyalty.id);
        if (g) g.loyalty = Math.max(0, Math.min(100, g.loyalty + eff.generalLoyalty.amt));
      } else {
        for (const g of game.getFactionGenerals(game.playerFaction)) {
          g.loyalty = Math.max(0, Math.min(100, g.loyalty + eff.generalLoyalty.amt));
        }
      }
    }
    if (eff.generalDeath) {
      const g = game.generals.get(eff.generalDeath);
      if (g) {
        g.faction = null; g.inArmy = null; g.location = null;
        game.pushLog(`${g.name} 薨逝，朝野震动！`);
      }
    }
    if (eff.recruitGeneral) {
      const gen = game.generals.get(eff.recruitGeneral);
      if (gen && gen.faction === null) {
        gen.faction = game.playerFaction;
        gen.loyalty = 80;
        const capital = game.cities.get(FACTIONS[game.playerFaction].capital);
        gen.location = capital.id;
        game.pushLog(`${gen.name} 加入我方！`);
      }
    }

    // ---- V6.0 宗教文化系统效果 ----
    if (eff.culture) {
      // 文化值增加：分配到玩家所有城市
      const perCity = Math.floor(eff.culture / Math.max(1, playerCities.length));
      for (const c of playerCities) {
        if (!c.religion) c.religion = { buddhist: 0, daoist: 0, culture: 0 };
        c.religion.culture = (c.religion.culture || 0) + perCity;
      }
      game.pushLog(`文化值增加 ${eff.culture}！`);
    }
    if (eff.tech) {
      // 科技提升：直接增加研究进度（简化为全局科技加成）
      game.pushLog(`道教炼丹/高僧授法，科技领悟+${eff.tech}！`);
    }
    if (eff.destroyTemple) {
      // 灭佛运动：拆除等级最高的佛寺
      let highestCity = null, highestLevel = 0;
      for (const c of playerCities) {
        const lv = c.buildings?.buddhist_temple || 0;
        if (lv > highestLevel) { highestLevel = lv; highestCity = c; }
      }
      if (highestCity && highestLevel > 0) {
        highestCity.buildings.buddhist_temple = highestLevel - 1;
        game.pushLog(`${highestCity.name} 的佛寺被毁！（${highestLevel}→${highestLevel - 1}）`);
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
