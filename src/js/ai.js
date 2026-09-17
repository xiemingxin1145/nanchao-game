// ============================================================
// ai.js — AI 势力决策
// ============================================================
import { FACTIONS, UNIT_TYPES, CITY_LINKS } from './data.js';
import { Army, computeBattle, citiesAdjacent } from './army.js';

export class AIPlayer {
  constructor(factionId) {
    this.factionId = factionId;
    this.name = FACTIONS[factionId].name;
  }

  takeTurn(game) {
    const res = game.factionRes.get(this.factionId);
    if (!res) return;
    const myCities = game.getFactionCities(this.factionId);

    // 优先级 1：民心低的城市发展/降税
    for (const city of myCities) {
      if (city.morale < 30) {
        if (city.taxRate > 20) {
          city.setTaxRate(Math.max(10, city.taxRate - 10));
          game.pushLog(`【${this.name}】${city.name} 降低税率安抚民心`);
        }
      }
    }

    // 优先级 2：有钱有人就征兵
    for (const city of myCities) {
      if (res.money > 500 && city.pop > 5000 && city.garrison < 8000) {
        const recruitCount = Math.min(2000, Math.floor(city.pop * 0.1));
        const unitType = Math.random() < 0.3 ? 'cavalry' : (Math.random() < 0.5 ? 'archer' : 'infantry');
        const unit = UNIT_TYPES[unitType];
        const cost = unit.cost * recruitCount;
        if (res.money >= cost) {
          const result = city.recruit(unitType, recruitCount, res);
          if (result.ok) {
            game.pushLog(`【${this.name}】${city.name} 征兵 ${recruitCount} 人（${unit.name}）`);
          }
        }
      }
    }

    // 优先级 3：组建军队并进攻
    const myGenerals = game.getFactionGenerals(this.factionId);
    for (const gen of myGenerals) {
      if (gen.inArmy) continue;
      // 找所在城市有驻军的武将
      const city = game.cities.get(gen.location);
      if (city && city.garrison >= 2000) {
        const troops = Math.min(gen.getMaxTroops(), city.garrison, 3000);
        if (troops < 1000) continue;
        city.garrison -= troops;
        const army = new Army({
          factionId: this.factionId, generalId: gen.id, cityId: city.id,
          troops: troops, unitMix: game.estimateUnitMix(troops)
        });
        game.armies.push(army);
        gen.inArmy = army.id;
        gen.location = army.id;
        game.pushLog(`【${this.name}】${gen.name} 于 ${city.name} 起兵`);

        // 尝试进攻
        this.tryAttack(game, army);
      }
    }

    // 已有军队尝试进攻
    const myArmies = game.getFactionArmies(this.factionId);
    for (const army of myArmies) {
      if (army.hasMoved) continue;
      this.tryAttack(game, army);
    }

    // 优先级 4：发展经济（农业/商业交替）
    let agriCount = 0, commCount = 0;
    for (const city of myCities) {
      if (res.money < 200) break;
      if (city.agri < city.comm && agriCount < 2) {
        city.developAgri(200);
        res.money -= 200;
        agriCount++;
      } else if (res.money >= 200) {
        city.developComm(200);
        res.money -= 200;
        commCount++;
      }
    }

    // 优先级 5：招募在野武将
    const idleGens = game.getIdleGenerals();
    for (const gen of idleGens) {
      if (res.money > 800 && Math.random() < 0.3) {
        gen.faction = this.factionId;
        gen.loyalty = 65;
        const capital = game.cities.get(FACTIONS[this.factionId].capital);
        gen.location = capital.id;
        game.pushLog(`【${this.name}】贤士 ${gen.name} 来投！`);
        break;
      }
    }
  }

  tryAttack(game, army) {
    const links = CITY_LINKS[army.cityId] || [];
    for (const targetId of links) {
      const target = game.cities.get(targetId);
      if (!target || target.owner === this.factionId) continue;
      if (target.owner === null) {
        // 占领无主城市
        target.owner = this.factionId;
        target.morale = 40;
        army.cityId = targetId;
        army.hasMoved = true;
        const gen = game.generals.get(army.generalId);
        game.pushLog(`【${this.name}】${gen ? gen.name : '军队'} 占领 ${target.name}！`);
        return;
      }

      // 估算战力比
      const gen = game.generals.get(army.generalId);
      const atkPow = army.troops * (gen ? (gen.command + gen.force) / 100 : 1);
      const defPow = target.garrison * (1 + target.defense / 100);
      if (atkPow > defPow * 1.5) {
        // 发动攻击
        game.attackCity(army, target);
        return;
      }
    }

    // 如果不能攻击，尝试移动到前线
    for (const targetId of links) {
      const target = game.cities.get(targetId);
      if (!target) continue;
      if (target.owner === this.factionId) {
        // 检查该城市是否靠近前线
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
}
