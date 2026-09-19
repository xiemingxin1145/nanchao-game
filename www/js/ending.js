// ============================================================
// ending.js — V3.0 多结局系统（V15.0 系统深化版）
// V3.0：8 种结局，根据游戏进程触发。
// V15.0：从 8 个扩充到 14 个，新增 v15_ 前缀结局 6 个，
//   新增 getEndingRank / getEndingUnlockedList 两个 API。
// game.checkEnding() 遍历 ENDINGS，返回第一个满足条件的结局 id（按优先级排序）。
// 每个结局含名称、文本（300~500字）、触发条件、评分（S/A/B/C/D）、解锁成就。
// ============================================================

import { V19_TECH_IDS } from './tech.js';

// 工具：统计某势力存活城市数 / 武将数
function factionCities(game, fid) { return game.getFactionCities(fid).length; }
function aliveFactionIds(game) {
  return Object.keys(game.factionRes).filter(fid => factionCities(game, fid) > 0);
}
function totalCities(game) { return game.cities.size || 30; }

export const ENDINGS = [
  // 1. 一统天下（S）— 占领全部城市
  {
    id: 'unify', name: '一统天下', rank: 'S',
    text: '自永嘉南渡以来，分裂已逾二百年。至此，王师所向，江河南北尽入版图。' +
          '陛下亲祀南郊，大赦天下，改元「一统」。市不改肆，囹圄空虚。' +
          '后世史家秉笔书曰：「汉魏以降，未有如陛下之武功者也。」四海归一，建不世之业。',
    condition: (game) => factionCities(game, game.playerFaction) >= totalCities(game) - 1,
    achievement: 'unify_world'
  },

  // 2. 亡国之君（D）— 玩家势力被灭（优先判定）
  {
    id: 'perish', name: '亡国之君', rank: 'D',
    text: '城郭丘墟，宗庙隳坠。陛下青衣衔璧，出降于军门。' +
          '功臣宿将，或死或降，三百年宗社，一旦斩焉。' +
          '然天命靡常，成败何足论。他日牧童之唱，犹令人遗恨云。',
    condition: (game) => factionCities(game, game.playerFaction) === 0,
    achievement: null
  },

  // V15.0 新增：英年早逝（D）— 玩家君主壮年殒命
  {
    id: 'v15_early_death', name: '英年早逝', rank: 'D',
    text: '春秋方富，而陛下忽焉崩殂。储君幼弱，母后临朝，权臣辅政。' +
          '一统之志，未及展布，而鼎祚已移。天下英雄，莫不叹息。' +
          '史臣曰：有为之君而不永年，此非人事，乃天命也。',
    condition: (game) => {
      try {
        const lord = game.getFactionGenerals(game.playerFaction).find(g => g.role === '君主');
        if (!lord) return false;
        // 君主死亡（faction=null 或 alive=false）或在位不足40回合且身体衰败
        if (lord.faction === null || lord.alive === false) return game.turn < 60;
        return false;
      } catch (e) { return false; }
    },
    achievement: null
  },

  // 3. 权臣篡位（S/A）— 某忠诚过低的强臣取而代之
  {
    id: 'usurp', name: '权臣篡位', rank: 'A',
    text: '主弱臣强，权威下移。某重臣素有人望，将士皆出其门。' +
          '一旦称兵宫省，迫主禅位，改国号，改正朔。' +
          '旧主封为寓公，以终天年。自古禅让之局，大率如此。',
    condition: (game) => {
      if (game.turn < 20) return false;
      const mine = game.getFactionGenerals(game.playerFaction);
      // 存在一位非君主、忠诚<35、四维总和>380 的强臣
      return mine.some(g =>
        g.role !== '君主' && g.loyalty < 35 &&
        (g.command + g.force + g.intel + g.politics) > 380);
    },
    achievement: 'usurp_throne'
  },

  // V15.0 新增：权臣篡国（B）— 权臣掌权但未称帝
  {
    id: 'v15_powerful_minister', name: '权臣篡国', rank: 'B',
    text: '主少国疑，大将军入朝辅政。政令皆出其门，天子拱手而已。' +
          '然犹未敢称帝，犹假禅让之名，行威福之实。' +
          '朝野侧目，而宗室拱手。他日移鼎，特须时耳。',
    condition: (game) => {
      if (game.turn < 30) return false;
      const mine = game.getFactionGenerals(game.playerFaction);
      // 存在一位非君主、忠诚<50、四维总和>350 的强臣（但未达到篡位阈值380）
      return mine.some(g =>
        g.role !== '君主' && g.loyalty < 50 && g.loyalty >= 35 &&
        (g.command + g.force + g.intel + g.politics) > 350);
    },
    achievement: 'v15_powerful_minister'
  },

  // 4. 南北对峙（B）— 与另一强藩各占半壁
  {
    id: 'standoff', name: '南北对峙', rank: 'B',
    text: '数世经营，竟不能混一。甲坊之下，画江而守；河洛之间，壁垒相望。' +
          '两国遣使通好，约为兄弟。百姓稍得休息，然边防终不能撤。' +
          '后世论者，犹以「南北朝」终始之，叹其功败垂成也。',
    condition: (game) => {
      const mine = factionCities(game, game.playerFaction);
      if (game.turn < 60 || mine < 12) return false;
      const others = aliveFactionIds(game).filter(f => f !== game.playerFaction);
      // 仅剩 2 个势力（玩家 + 一家），且对方也≥10城
      if (others.length !== 1) return false;
      return factionCities(game, others[0]) >= 10;
    },
    achievement: 'north_south_balance'
  },

  // V15.0 新增：偏安江南（B）— 南方势力保有半壁江山
  {
    id: 'v15_partial_south', name: '偏安江南', rank: 'B',
    text: '划江而治，保有江南半壁。荆扬富庶，海贸辐辏，足以立国。' +
          '然中原未复，神州陆沉，士大夫每有新亭之泣。' +
          '偏安之业，足以偏安，不足以混一。后世犹以「南朝」目之。',
    condition: (game) => {
      if (game.turn < 40) return false;
      const mine = factionCities(game, game.playerFaction);
      // 保有8座以上南方城池且未统一
      return mine >= 8 && mine < totalCities(game) - 5;
    },
    achievement: 'v15_partial_south'
  },

  // 5. 偏安一隅（C）— 仅存1~3城但存活80回合以上
  {
    id: 'refuge', name: '偏安一隅', rank: 'C',
    text: '大国虎视，而主公守此弹丸。外有强邻之逼，内有凋残之民。' +
          '然折冲樽俎，岁币相寻，竟得苟延八十余载。' +
          '江上之愁，新亭之泣，犹足为千古遗恨。',
    condition: (game) => {
      const mine = factionCities(game, game.playerFaction);
      return game.turn >= 80 && mine >= 1 && mine <= 3;
    },
    achievement: 'small_realm'
  },

  // V15.0 新增：外贸兴国（B）— 贸易立国
  {
    id: 'v15_trade_nation', name: '外贸兴国', rank: 'B',
    text: '不恃兵革之强，而以商税立国。南海舶交，西域贾胡，' +
          '金银珠犀，委输王府。府库盈溢，而武备稍弛。' +
          '国富而兵弱者，终为强邻所图，然市井之间，已号乐土。',
    condition: (game) => {
      try {
        const routes = (game.tradeRoutes || []).length;
        const tradeIncome = game.gameStats?.totalTradeIncome || 0;
        return routes >= 10 && tradeIncome >= 20000;
      } catch (e) { return false; }
    },
    achievement: 'v15_trade_nation'
  },

  // 6. 蛮族入主（A）— 蛮族占中原≥5城（由蛮族事件结算触发）
  {
    id: 'barbarian_takeover', name: '蛮族入主', rank: 'A',
    text: '五胡故事，复见于今。北狄南牧，饮马江淮，衣冠之族，相率渡江。' +
          '朝廷既不能制，边将复拥兵自重。于是河洛丘墟，胡马嘶风。' +
          '此非独一人之失，亦数百年华夷升降之会也。',
    condition: (game) => {
      // 由 game.barbarianControlCenters 维护（蛮族占领的中原城数）
      return (game.barbarianControlCenters || 0) >= 5;
    },
    achievement: 'barbarian_rise'
  },

  // V15.0 新增：宗教治国（C）— 宗教影响力过大
  {
    id: 'v15_religion_state', name: '宗教治国', rank: 'C',
    text: '佛道二教，遍于州郡。僧尼不耕而食，道观不织而衣。' +
          '国用不足，而斋供无度。大臣多与方丈游，朝政渐废。' +
          '史臣曰：以儒术治天下，以神道设教化则可，以宗教治国则殆矣。',
    condition: (game) => {
      try {
        const cities = game.getFactionCities(game.playerFaction) || [];
        if (cities.length < 5) return false;
        let religiousBuildings = 0;
        for (const c of cities) {
          religiousBuildings += (c.buildings?.buddhist_temple || 0);
          religiousBuildings += (c.buildings?.daoist_temple || 0);
          religiousBuildings += (c.buildings?.grotto || 0);
        }
        // 宗教建筑总数超过城市数的3倍
        return religiousBuildings >= cities.length * 3;
      } catch (e) { return false; }
    },
    achievement: 'v15_religion_state'
  },

  // 7. 禅让贤君（S）— 德政积累，和平过渡
  {
    id: 'abdicate', name: '禅让贤君', rank: 'S',
    text: '陛下临御以来，轻徭薄赋，兴学劝农，囹圄空虚，万民鼓腹。' +
          '耆老诣阙，请择贤而禅。三揖三让，而后受命。' +
          '授受之际，不失揖让之风，世称之为「唐虞之德」。',
    condition: (game) => {
      if (game.turn < 60) return false;
      const lord = game.getFactionGenerals(game.playerFaction).find(g => g.role === '君主');
      if (!lord) return false;
      const myCities = game.getFactionCities(game.playerFaction);
      const avgMorale = myCities.length ? myCities.reduce((s, c) => s + c.morale, 0) / myCities.length : 0;
      return lord.politics >= 90 && avgMorale >= 80 && factionCities(game, game.playerFaction) >= 8;
    },
    achievement: 'virtuous_abdication'
  },

  // V15.0 新增：禅让立国（A）— 通过禅让取得政权
  {
    id: 'v15_abdication_state', name: '禅让立国', rank: 'A',
    text: '权臣辅政三世，威望日隆。九锡既加，禅让之礼行矣。' +
          '旧主退位，改元建国，郊祀天地，班爵宗室。' +
          '虽曰禅让，实同篡夺。然不失兵戈，百姓晏然，亦足称矣。',
    condition: (game) => {
      try {
        return !!(game.dynastySystem && (game.dynastySystem.abdicated || game.dynastySystem.founded));
      } catch (e) { return false; }
    },
    achievement: 'v15_abdication_state'
  },

  // 8. 历史重演（B）— 玩家为南陈且隋灭陈事件已触发
  {
    id: 'history_repeat', name: '历史重演', rank: 'B',
    text: '金陵王气，终于三百六十年。韩擒虎夜渡采石，王世献晨入建业。' +
          '君臣衔璧，妃嫔露处。后主井中犹藏，终为所执。' +
          '刘禹锡诗所谓「山围故国周遭在，潮打空城寂寞回」者，今日见之。',
    condition: (game) => {
      if (game.playerFaction !== 'nanchao') return false;
      // 玩家未统一（<20城）且回合已推进到隋灭陈之后
      return game.turn >= 38 && factionCities(game, game.playerFaction) < 20;
    },
    achievement: 'history_repeats'
  },

  // V16.0 新增：战役全胜（S）— 通关全部战役关卡
  {
    id: 'v16_campaign_grand', name: '战役全胜', rank: 'S',
    text: '沙苑设伏，潼关据守，江陵渡江，淮南拉锯，河西拓土，混一北方。' +
          '大小战役七十余战，未尝一败。军中传檄曰：「将军一出，天下定矣。」' +
          '史官秉笔，以为自孙吴以来，未有若此之善用兵者也。武略至此，虽古之名将，何以加焉。',
    condition: (game) => {
      try {
        const done = game.gameStats?.campaignsCompleted || game.campaignsCompleted || 0;
        return done >= 6;
      } catch (e) { return false; }
    },
    achievement: 'v16_ach_campaign_all'
  },

  // V16.0 新增：全成就收集（S）— 收集全部成就
  {
    id: 'v16_achievement_collector', name: '青史留名', rank: 'S',
    text: '文治武功，权谋谍报，佛道商路，风雨百战。' +
          '六十余项成就，无不毕举。后人读史，见陛下之名，赫然列于典籍之首。' +
          '虽百世之下，犹将闻风而起敬。此所谓「立德、立功、立言」三不朽者也。',
    condition: (game) => {
      try {
        return (game.gameStats?.galleryCompletion || 0) >= 100;
      } catch (e) { return false; }
    },
    achievement: 'v16_ach_gallery'
  },

  // V19.0 新增：文化盛世（S）— 文化值突破 900
  {
    id: 'v19_culture_heyday', name: '文化盛世', rank: 'S',
    text: '自永嘉南渡，文物衣冠，萃于江左。陛下临御，大兴学宫，广开书院，' +
          '国子监弦歌不辍，藏书阁缃帙万卷。文士辐辏，远夷慕化，' +
          '虽北魏遣使求书，高丽遣子入学。' +
          '史臣曰：三代之英，荡荡乎无能名。文治之盛，于斯为极。' +
          '后世但知江左有文章，不复知中原有干戈矣。',
    condition: (game) => {
      try {
        if (!game.cultureSystem) return false;
        return game.cultureSystem.getCulture(game.playerFaction) > 900;
      } catch (e) { return false; }
    },
    achievement: 'v19_culture_900'
  },

  // V19.0 新增：科技领先（S）— 研究完成全部 v19 科技
  {
    id: 'v19_tech_lead', name: '科技领先', rank: 'S',
    text: '铁甲精骑，强弩楼船，曲辕翻车，漕运通淮。' +
          '府兵、租庸、科举、国子监，制度粲然大备。' +
          '虽强敌环伺，而我军械精利、仓廪充实、人才汇征。' +
          '邻邦闻风，皆遣使求教。史臣曰：' +
          '有为之君，不恃一时之兵威，而垂万世之法度。此所谓「制人而不制于人」者也。',
    condition: (game) => {
      try {
        if (!game.techs || V19_TECH_IDS.length === 0) return false;
        const done = new Set(game.techs);
        return V19_TECH_IDS.every(id => done.has(id));
      } catch (e) { return false; }
    },
    achievement: 'v19_tech_all'
  },

  // V20.0 新增：盛世太平（S）— 民生安定、户口殷盛、无灾无害
  {
    id: 'v20_peace_and_prosperity', name: '盛世太平', rank: 'S',
    text: '临御数十年，轻徭薄赋，兴水利、设义仓、置医药，民蕃息而蓄积饶。' +
          '虽水旱蝗疫间作，皆先发仓廪以赈之，民无菜色，道不拾遗。' +
          '州郡上计，户口岁增，囹圄屡空。耆老扶杖而言曰：' +
          "『不图今日复见汉武、文景之盛。』史臣曰：" +
          '三代而下，治日常少，乱日常多。若乃四海晏然、家给人足者，其惟『盛世太平』乎。',
    condition: (game) => {
      try {
        if (game.turn < 80) return false;
        const cities = game.getFactionCities(game.playerFaction) || [];
        if (cities.length < 8) return false;
        // 所有城池民心平均 ≥75
        const avgMorale = cities.reduce((s, c) => s + (c.morale || 0), 0) / cities.length;
        if (avgMorale < 75) return false;
        // 无活跃重大灾害
        const active = game.disasterSystem ? (game.disasterSystem.activeDisasters || []) : [];
        if (active.length > 0) return false;
        // 人口保持正增长（累计自然增长为正）
        const growth = game.populationSystem?.stats?.naturalGrowth || 0;
        if (growth < 10000) return false;
        // 粮食储备充足
        const res = game.getPlayerRes ? game.getPlayerRes() : null;
        return res && res.food >= 30000;
      } catch (e) { return false; }
    },
    achievement: 'v20_pop_conservation'
  },

  // V20.0 新增：灾害克星（A）— 遍历六灾而赈灾有方
  {
    id: 'v20_disaster_nemesis', name: '灾害克星', rank: 'A',
    text: '自践祚以来，地震山崩、江河横溢、赤地千里、疫疠流行、飞蝗蔽野、风雪断道，' +
          '六灾叠至，而皆有以御之：缮堤防以捍水，平斛仓以济荒，建医药以已疫，' +
          '固城堑以止震。朝廷每闻灾，辄遣使持节发廪，吏民不知有凶岁。' +
          '史臣曰：『天灾流行，何代无之。所贵乎人君者，备之豫而救之速耳。』' +
          '若是者，其可以言『灾害克星』矣。',
    condition: (game) => {
      try {
        if (!game.disasterSystem) return false;
        const by = game.disasterSystem.stats?.byType || {};
        const allSix = ['earthquake', 'flood', 'drought', 'plague', 'locust', 'blizzard']
          .every(t => (by[t] || 0) >= 1);
        const mitigated = game.disasterSystem.stats?.mitigated || 0;
        return allSix && mitigated >= 20;
      } catch (e) { return false; }
    },
    achievement: 'v20_disaster_types_all'
  },

  // V21.0 新增：丝路霸主（S）— 贯通丝路、亭障相望、市利倍收
  {
    id: 'v21_silk_overlord', name: '丝路霸主', rank: 'S',
    text: '自长安凿空，经敦煌逾葱岭，亭障驿骑相望数千里。' +
          '我师护送商队，旌旗所指，胡羌帖服。于是蜀锦吴缣，西达于大秦；' +
          '波斯之珠、安息之香、月氏之马，辐辏于王府。' +
          '府库之积，不专于租税，而半出于互市。西域三十六国，皆重译献见。' +
          '史臣曰：汉武通西域，劳费不赀；今我不烦兵革而商道自通，' +
          '富强之术，岂在战阵乎。后世称「丝路霸主」，岂为过哉。',
    condition: (game) => {
      try {
        const ts = game.tradeSystem;
        if (!ts || !ts.v21 || !ts.v21.started) return false;
        const stations = Object.keys(ts.v21.stations || {}).length;
        const profit = ts.v21.stats?.profitEarned || 0;
        const sec = (typeof ts.getSilkRoadSecurity === 'function')
          ? ts.getSilkRoadSecurity(game, game.playerFaction).value : 0;
        return stations >= 4 && profit >= 15000 && sec >= 70;
      } catch (e) { return false; }
    },
    achievement: 'v21_silk_stations_6'
  },

  // V21.0 新增：皇室联姻（A）— 婚娅交结、望族冠时
  {
    id: 'v21_royal_marriage', name: '皇室联姻', rank: 'A',
    text: '陛下以婚姻为结纳，帝女下嫁于强藩，宗女入嫔于邻邦。' +
          '王谢袁萧，崔卢李郑，冠冕之族，世为婚媾。' +
          '于时邻国之君，皆陛下之婿舅；疆场之事，往往以一杯酒解之。' +
          '然姻亲虽笃，而势利之交难久；一旦反目，则唇齿转为戈矛。' +
          '史臣曰：「婚姻者，合二姓之好，上以事宗庙，下以继后世。」' +
          '以婚媾固邦交，此春秋以来之要道也，可不慎欤。',
    condition: (game) => {
      try {
        const fs = game.familySystem;
        if (!fs) return false;
        const marriages = fs.stats?.marriages || 0;
        const prestige = (typeof fs.getFamilyPrestige === 'function')
          ? fs.getFamilyPrestige(game.playerFaction, game).value : 0;
        return marriages >= 3 && prestige >= 60;
      } catch (e) { return false; }
    },
    achievement: 'v21_marriage_3'
  }
];

// ---------- V15.0 新增 API ----------

// 根据结局 id 返回其评分等级（S/A/B/C/D）
export function getEndingRank(endingId) {
  const e = ENDINGS.find(x => x.id === endingId);
  return e ? e.rank : null;
}

// 返回玩家已解锁（已见过）的结局列表
// 读取 game.endings?.triggered 及 game.unlockedEndings 累计记录
export function getEndingUnlockedList(game) {
  const seen = new Set();
  // 本次游戏已触发的结局
  if (game.endings && game.endings.triggered) seen.add(game.endings.triggered);
  // 跨周目累计解锁（若存在）
  if (Array.isArray(game.unlockedEndings)) {
    for (const id of game.unlockedEndings) seen.add(id);
  }
  return ENDINGS
    .filter(e => seen.has(e.id))
    .map(e => ({ id: e.id, name: e.name, rank: e.rank }));
}

// ---------- 结局系统运行时 ----------
export class EndingSystem {
  constructor() {
    this.triggered = null;   // 已触发的结局 id
    this.current = null;      // 当前结局完整对象
  }

  getEndings() { return ENDINGS; }

  // 遍历结局表，返回第一个满足条件的结局对象（未触发返回 null）
  checkEnding(game) {
    if (this.triggered) return ENDINGS.find(e => e.id === this.triggered) || null;
    for (const e of ENDINGS) {
      try {
        if (typeof e.condition === 'function' && e.condition(game)) {
          this.triggered = e.id;
          this.current = e;
          game.pushLog(`◆ 结局达成：【${e.name}】（${e.rank} 级）`);
          return e;
        }
      } catch (err) { /* 条件异常不中断 */ }
    }
    return null;
  }

  serialize() { return { triggered: this.triggered }; }
  static deserialize(data) {
    const s = new EndingSystem();
    if (data) s.triggered = data.triggered || null;
    if (s.triggered) s.current = ENDINGS.find(e => e.id === s.triggered) || null;
    return s;
  }
}
