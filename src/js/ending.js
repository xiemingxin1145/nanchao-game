// ============================================================
// ending.js — V3.0 多结局系统
// 8+ 种结局，根据游戏进程触发。game.checkEnding() 遍历 ENDINGS，
// 返回第一个满足条件的结局 id（按优先级排序）。每个结局含名称、
// 文本（300~500字）、触发条件、评分（S/A/B/C/D）、解锁成就。
// ============================================================

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
  }
];

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
