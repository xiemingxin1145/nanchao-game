// ============================================================
// religion.js — V6.0 宗教文化系统
//
// 历史背景（搜索整理）：
//   南北朝是佛教中国化的关键时期：
//   - 北魏文成帝460年令昙曜开凿云冈石窟（平城/大同），
//     五万余尊造像，耗时六十余年。
//   - 孝文帝迁都洛阳后，石窟重心南移至龙门石窟。
//   - 北齐凿晋阳西山为大佛像（天龙山）。
//   - 南朝佛教亦盛，建康佛寺林立（"南朝四百八十寺"）。
//   - 北魏太武帝/周武帝两次灭佛（三武一宗法难之二），
//     周武灭佛（574年）毁经像、僧尼还俗，得三百万户编户。
//   - 道教在北朝亦有发展，寇谦之改革天师道。
//
// 系统设计：
//   2种宗教（佛教/道教）→ 文化值 → 民心/科技/收入影响
//   宗教建筑：佛寺(佛教)/道观(道教)/石窟(佛教特殊)
//   宗教事件：高僧来访/道士炼丹/灭佛运动/开凿石窟
//   文化胜利：文化值达1000且维持10回合
// ============================================================

// ---------- 宗教定义 ----------
export const RELIGIONS = {
  buddhist: {
    id: 'buddhist', name: '佛教',
    description: '自西域传来，南北朝大盛。石窟佛寺遍天下，人心归附。'
  },
  daoist: {
    id: 'daoist', name: '道教',
    description: '黄老之学，斋醮炼丹。北朝寇谦之清整道教，辅国教化。'
  }
};

// ---------- 文化值参数 ----------
export const CULTURE_VICTION_THRESHOLD = 1000;  // 文化胜利阈值
export const CULTURE_VICTION_TURNS = 10;          // 需维持回合数

// 每回合文化值 = 佛寺等级×5 + 道观等级×3 + 基础值
export const CULTURE_PER_TEMPLE_LEVEL = 5;   // 佛寺每级
export const CULTURE_PER_DAOIST_LEVEL = 3;   // 道观每级
export const CULTURE_PER_GROTTO_LEVEL = 10;  // 石窟每级
export const CULTURE_BASE = 2;               // 每城基础文化产出/回合

// ---------- 宗教建筑效果 ----------
// 佛寺（佛教）：每级民心+2，文化+5，事件负面影响-3%
// 道观（道教）：每级科技+3，文化+3，招募成功率+2%
// 石窟（佛教特殊）：每级文化+10，全局声望+1，仅平城/洛阳/建康可建
export const RELIGION_BUILDINGS = {
  buddhist_temple: {
    id: 'buddhist_temple', name: '佛寺', religion: 'buddhist',
    maxLevel: 5,
    description: '每级民心+2，文化+5/回合，事件负面影响-3%。',
    perLevel: { moralePerTurn: 2, culturePerTurn: 5, disasterMult: -0.03 }
  },
  daoist_temple: {
    id: 'daoist_temple', name: '道观', religion: 'daoist',
    maxLevel: 5,
    description: '每级科技+3，文化+3/回合，招募成功率+2%。',
    perLevel: { techPerTurn: 3, culturePerTurn: 3, recruitBonus: 0.02 }
  },
  grotto: {
    id: 'grotto', name: '石窟', religion: 'buddhist',
    maxLevel: 3, special: true,
    description: '特殊建筑，仅平城/洛阳/建康可建。每级文化+10，全局声望+1。建造耗费巨大。',
    perLevel: { culturePerTurn: 10, globalPrestige: 1 },
    buildCostMoney: 1000,
    buildCostFood: 500,
    buildTurns: 3
  }
};

// 石窟建造城市限制
import { GROTTO_CITIES } from './navy.js';

// ---------- 城市宗教状态初始化 ----------
// 每城 religion = { buddhist: 0, daoist: 0, culture: 0 }
export function initCityReligion(cityId) {
  return {
    buddhist: 0,    // 佛寺等级（同步到 buildings.buddhist_temple）
    daoist: 0,      // 道观等级
    culture: 0      // 累积文化值
  };
}

// ---------- 计算单城每回合文化产出 ----------
export function calcCityCulturePerTurn(city) {
  const bb = city.religion ? { buddhist: city.religion.buddhist || 0, daoist: city.religion.daoist || 0 } : { buddhist: 0, daoist: 0 };
  const buildings = city.buildings || {};
  const buddhistLv = buildings.buddhist_temple || bb.buddhist || 0;
  const daoistLv = buildings.daoist_temple || bb.daoist || 0;
  const grottoLv = buildings.grotto || 0;

  let culture = CULTURE_BASE;
  culture += buddhistLv * CULTURE_PER_TEMPLE_LEVEL;
  culture += daoistLv * CULTURE_PER_DAOIST_LEVEL;
  culture += grottoLv * CULTURE_PER_GROTTO_LEVEL;
  return culture;
}

// ---------- 计算势力总文化值 ----------
export function calcFactionCulture(factionCities) {
  let total = 0;
  for (const city of factionCities) {
    if (city.religion) total += city.religion.culture || 0;
  }
  return total;
}

// ---------- 宗教影响效果 ----------
// 佛教势力多的城市：民心高(+5)但经济略低(-5%收入)
// 道教势力多的城市：科技高(+3)但民心略低(-3)
export function getReligionCityModifiers(city) {
  if (!city.religion) return { moraleMod: 0, incomeMod: 0, techMod: 0 };
  const buddhistLv = (city.buildings?.buddhist_temple) || 0;
  const daoistLv = (city.buildings?.daoist_temple) || 0;
  const grottoLv = (city.buildings?.grotto) || 0;

  return {
    moraleMod: buddhistLv * 2 + grottoLv * 1,       // 每级佛寺民心+2
    incomeMod: -(buddhistLv * 0.01),                 // 佛教每级收入-1%
    techMod: daoistLv * 3                             // 每级道观科技+3
  };
}

// ---------- 宗教事件定义 ----------
export const RELIGION_EVENTS = [
  {
    id: 'monk_visit', name: '高僧来访', religion: 'buddhist',
    description: '有高僧自西域来，登坛讲经，万众聆听。城中善男信女云集。',
    options: [
      { text: '虔诚迎奉（耗金300，文化+30，民心+10）', effect: { money: -300, culture: 30, morale: 10 } },
      { text: '以礼待之（文化+15，民心+5）', effect: { culture: 15, morale: 5 } }
    ]
  },
  {
    id: 'daoist_alchemy', name: '道士炼丹', religion: 'daoist',
    description: '有道士居山间，炉火九转，炼成金丹。或献丹求试。',
    options: [
      { text: '取丹试服（耗金500，科技+20，金钱+500）', effect: { money: 500, tech: 20 } },
      { text: '厚赏道士（科技+10，文化+10）', effect: { tech: 10, culture: 10 } }
    ]
  },
  {
    id: 'miefo', name: '灭佛运动', religion: 'buddhist',
    minTurn: 18,
    description: '有臣上奏：佛寺占田免税，僧尼不事生产，国用不足。请断佛道二教！',
    options: [
      { text: '下诏灭佛（金钱+2000，佛寺-1级，民心-15）', effect: { money: 2000, destroyTemple: true, morale: -15 } },
      { text: '尊崇释教（民心+10，文化+50）', effect: { morale: 10, culture: 50 } }
    ]
  },
  {
    id: 'grotto_carve', name: '开凿石窟', religion: 'buddhist',
    minTurn: 10,
    description: '于山崖开窟造像，以为国祈福。工匠云集，千载之下尤见庄严。',
    options: [
      { text: '开山造像（耗金1500，文化+80，繁荣+10）', effect: { money: -1500, culture: 80, prosperity: 10 } },
      { text: '量力而行（文化+30，繁荣+5）', effect: { culture: 30, prosperity: 5 } }
    ]
  }
];

// ---------- 文化胜利检测 ----------
// 文化值达到1000且维持10回合 → 触发「文化繁荣」结局
export class ReligionSystem {
  constructor() {
    this.cultureStreak = 0;        // 连续维持文化胜利阈值的回合数
    this.religionHistory = [];     // 宗教事件历史
  }

  // 每回合检测文化胜利条件
  checkCultureVictory(game) {
    const totalCulture = calcFactionCulture(game.getFactionCities(game.playerFaction));
    if (totalCulture >= CULTURE_VICTION_THRESHOLD) {
      this.cultureStreak++;
      if (this.cultureStreak >= CULTURE_VICTION_TURNS) {
        return {
          achieved: true,
          id: 'culture_prosperity',
          text: '文化繁荣！境内佛寺林立，石窟庄严，文教昌明，四海归心。'
        };
      }
    } else {
      this.cultureStreak = 0;
    }
    return { achieved: false, culture: totalCulture, streak: this.cultureStreak };
  }

  // 回合结算：更新城市文化值
  settleTurn(game) {
    const season = game.getSeason();
    for (const city of game.cities.values()) {
      if (!city.religion) city.religion = initCityReligion(city.id);
      const cultureGain = calcCityCulturePerTurn(city);
      city.religion.culture = (city.religion.culture || 0) + cultureGain;

      // 宗教影响：佛教→民心，道教→科技
      const mods = getReligionCityModifiers(city);
      if (mods.moraleMod) {
        city.morale = Math.min(100, city.morale + Math.round(mods.moraleMod / 5));
      }
    }
  }

  serialize() {
    return {
      cultureStreak: this.cultureStreak,
      religionHistory: this.religionHistory
    };
  }

  static deserialize(data) {
    const rs = new ReligionSystem();
    rs.cultureStreak = data?.cultureStreak || 0;
    rs.religionHistory = Array.isArray(data?.religionHistory) ? data.religionHistory : [];
    return rs;
  }
}

// ---------- 石窟建造检查 ----------
export function canBuildGrotto(city) {
  if (!city) return false;
  return GROTTO_CITIES.includes(city.id);
}

export function getGrottoBuildCost() {
  return {
    money: RELIGION_BUILDINGS.grotto.buildCostMoney,
    food: RELIGION_BUILDINGS.grotto.buildCostFood,
    turns: RELIGION_BUILDINGS.grotto.buildTurns
  };
}
