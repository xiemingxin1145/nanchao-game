// ============================================================
// trade.js — V7.0 贸易商路 / 商队 / 贸易协定系统（V15.0 系统深化版）
// ------------------------------------------------------------
// 历史背景（据《宋书·蛮夷传》《梁书·诸夷》《广州市志》）：
//  · 陆上丝路：自长安/洛阳经河西姑臧出西域，通波斯、大秦(罗马)。
//  · 海上丝路：广州(番禺)为始发港，经南海、马六甲、印度洋抵天竺、波斯湾；
//    输入香料、琉璃、珠玑、象牙、犀角，输出丝绸、青瓷。
//  · 六朝时广州海舶万计，"州郡以富雄"，刺史往往以此巨富。
// 设计：
//  - 长距商路：控制端点城即得被动岁入（陆上丝路/海上丝路）。
//  - 商品 GOODS：不同城市产出不同，价差构成商队利润。
//  - 商队 caravans：玩家耗金粮派遣，3 回合抵达，途中有被劫掠风险。
//  - 贸易协定 agreements：与外交关系≥友好势力互市，双方增收。
//
// V15.0 新增：
//  - 城市特产：丝绸/茶叶/盐/铁/马（按城市产出）
//  - 贸易路线：按距离与城市商业等级计算收入
//  - 贸易事件：商队被劫/贸易繁荣/新商路开辟
//  - 新增 API：getTradeRoute / calculateTradeIncome / getTradeGoods
// ============================================================

// ---------- V15.0 城市特产映射 ----------
// 每城产出的特色商品（在 GOODS 基础上扩展盐/铁/马）
export const CITY_SPECIALTIES = {
  silk:   { name: '丝绸', basePrice: 120, cities: ['jinyang', 'xiangguo', 'qingzhou', 'luoyang'] },
  tea:    { name: '茶叶', basePrice: 60,  cities: ['chengdu', 'jiangling', 'xiangyang', 'kuaiji'] },
  salt:   { name: '食盐', basePrice: 80,  cities: ['pengcheng', 'xuzhou_placeholder', 'haimeng'] },
  iron:   { name: '铁器', basePrice: 100, cities: ['yeccheng', 'jinyang', 'changshan'] },
  horse:  { name: '良马', basePrice: 150, cities: ['guzang', 'longyou', 'tianshui', 'pingcheng', 'youzhou'] }
};

// V15.0：贸易事件表
export const TRADE_EVENTS = [
  { id: 'v15_robbery',  name: '商队被劫', weight: 3,
    description: '商队于途中为山胡所掠，损失惨重。',
    effect: { money: -800, morale: -2 } },
  { id: 'v15_boom',     name: '贸易繁荣', weight: 2,
    description: '胡商云集，商税大增。',
    effect: { money: 1500, morale: 3 } },
  { id: 'v15_newroute', name: '新商路开辟', weight: 1,
    description: '商旅发现新道，商路倍增。',
    effect: { money: 2000, tradeBonus: 0.1 } }
];

// ---------- 商品表 ----------
// producedBy: 主要产地城市 id；basePrice 基准价（低买高卖）
export const GOODS = [
  { id: 'silk',     name: '丝绸', basePrice: 120, producedBy: ['jinyang', 'xiangguo', 'qingzhou'] },
  { id: 'porcelain',name: '青瓷', basePrice: 90,  producedBy: ['kuaiji', 'wujun', 'jiankang'] },
  { id: 'tea',      name: '茶叶', basePrice: 60,  producedBy: ['chengdu', 'jiangling', 'xiangyang'] },
  { id: 'horse',    name: '良马', basePrice: 150, producedBy: ['guzang', 'longyou', 'tianshui', 'pingcheng'] },
  { id: 'spice',    name: '香料', basePrice: 200, producedBy: ['guangzhou', 'jiaozhou'] },
  { id: 'jade',     name: '珠宝', basePrice: 240, producedBy: ['guangzhou', 'chengdu'] },
  { id: 'grain',    name: '粮食', basePrice: 30,  producedBy: ['chengdu', 'pengcheng', 'xuzhou_placeholder'] }
];

// ---------- 长距商路（控制端点即生效） ----------
// 陆上丝路：须同时控制 长安/洛阳 与 姑臧（西域门户）
// 海上丝路：须控制 广州（南海始发港）
export const LONG_ROUTES = [
  { id: 'silkroad_land', name: '陆上丝绸之路', type: 'land',
    requires: ['changan', 'luoyang', 'guzang'],
    income: 1200, desc: '自长安洛阳经河西出西域，商旅络绎。' },
  { id: 'maritime', name: '海上丝绸之路', type: 'sea',
    requires: ['guangzhou'],
    income: 900, desc: '自广州扬帆，经南海抵天竺波斯，明珠犀象辐辏。' },
  { id: 'grand_bazaar', name: '建康互市', type: 'land',
    requires: ['jiankang', 'kuaiji'],
    income: 500, desc: '秦淮两岸廛闑扑地，商贩并列。' }
];

// 商队参数
export const CARAVAN_COST_MONEY = 800;    // 派遣商队耗金
export const CARAVAN_COST_FOOD = 400;     // 耗粮
export const CARAVAN_TURNS = 3;           // 到达所需回合
export const CARAVAN_PLUNDER_RISK = 0.15; // 被劫掠概率
export const TRADE_AGREE_REL_MIN = 40;    // 签订贸易协定所需关系

// ---------- V21.0 丝绸之路贸易深化 ----------
// 路线：长安→敦煌→高昌→龟兹→疏勒→碎叶→波斯→罗马（8 节点）
// 仅长安、敦煌为本国可控州郡，高昌以西为西域/远方邦国（概念节点）。
// 设计：
//  - 丝路贯通需先控制东端门户（长安+敦煌），方可 startSilkRoad。
//  - 出口丝绸/瓷器/茶叶，换回宝石/香料/玻璃/骏马，丝路利润翻倍。
//  - 商队需军队护送；护送不足则劫掠风险陡增。
//  - 沿途可控城市可建驿站，每座提升贸易量。
//  - 丝路安全度与游牧民族关系挂钩：关系越好，丝路越畅通。
export const V21_SILK_ROAD_NODES = [
  { id: 'changan',  name: '长安', type: 'domestic', cityId: 'changan' },
  { id: 'dunhuang', name: '敦煌', type: 'domestic', cityId: 'dunhuang' },
  { id: 'gaochang', name: '高昌', type: 'western' },
  { id: 'kuci',     name: '龟兹', type: 'western' },
  { id: 'shule',    name: '疏勒', type: 'western' },
  { id: 'suyab',    name: '碎叶', type: 'western' },
  { id: 'persia',   name: '波斯', type: 'foreign' },
  { id: 'rome',     name: '罗马', type: 'foreign' }
];

// 丝路出口 / 进口特产
export const V21_SILK_EXPORTS  = ['silk', 'porcelain', 'tea'];   // 丝绸/瓷器/茶叶
export const V21_SILK_IMPORTS  = ['gem', 'spice', 'glass', 'horse']; // 宝石/香料/玻璃/骏马
export const V21_SILK_PROFIT_MULT = 2;   // 丝路特产利润翻倍

// 驿站 / 护卫参数
export const V21_STATION_COST_MONEY = 1500;  // 建驿站耗金
export const V21_STATION_COST_FOOD  = 800;   // 建驿站耗粮
export const V21_STATION_TRADE_BONUS = 0.15; // 每座驿站贸易量 +15%
export const V21_GUARD_MIN_TROOPS = 3000;    // 丝路商队所需最低护送兵力
export const V21_SILK_BASE_PROFIT = 2000;    // 丝路商队基础利润（金/趟）
export const V21_SILK_GATEWAY = ['changan', 'dunhuang']; // 开通丝路所需门户城

let v21SilkVoyageCounter = 0;

let caravanCounter = 0;

export class TradeSystem {
  constructor() {
    this.caravans = [];      // 进行中商队
    this.agreements = {};   // "fid1_fid2": true
    // V21.0 丝绸之路深化状态
    this.v21 = {
      started: false,          // 丝路是否已开通
      stations: {},            // cityId: { name, builtTurn }
      voyages: [],             // 进行中/已结算的丝路商队
      stats: { profitEarned: 0, voyagesCompleted: 0, stationsBuilt: 0, plundered: 0 }
    };
  }

  // 计算某势力长距商路岁入（控制全部端点才生效）
  getLongRouteIncome(game, fid) {
    let total = 0;
    const owned = new Set(game.getFactionCities(fid).map(c => c.id));
    for (const r of LONG_ROUTES) {
      if (r.requires.every(cid => owned.has(cid))) total += r.income;
    }
    return total;
  }

  // 已激活的长距商路列表（UI 展示）
  getActiveLongRoutes(game, fid) {
    const owned = new Set(game.getFactionCities(fid).map(c => c.id));
    return LONG_ROUTES.filter(r => r.requires.every(cid => owned.has(cid)));
  }

  // 商品在某城的出售价（商业越高价越高；产地低价）
  priceAt(goodsId, city) {
    const g = GOODS.find(x => x.id === goodsId);
    if (!g) return 0;
    const isOrigin = (g.producedBy || []).includes(city.id);
    const comm = city.comm || 50;
    let price = g.basePrice * (0.6 + comm / 100); // 商业越高，售价越高
    if (isOrigin) price *= 0.7;                    // 产地便宜
    return Math.round(price);
  }

  // 可派遣商队的目的城：本势力非相邻、有产出差异的城
  getCaravanDestinations(game, fid) {
    return game.getFactionCities(fid).map(c => c.id);
  }

  // 派遣商队：fromCity → toCity，携带商品
  dispatchCaravan(game, fid, fromCityId, toCityId) {
    if (fromCityId === toCityId) return { ok: false, msg: '起讫不能同城' };
    const from = game.cities.get(fromCityId);
    const to = game.cities.get(toCityId);
    if (!from || !to) return { ok: false, msg: '城市不存在' };
    if (from.owner !== fid || to.owner !== fid) return { ok: false, msg: '起讫均须属我方' };
    const res = game.factionRes.get(fid);
    if (!res) return { ok: false, msg: '无资源' };
    if (res.money < CARAVAN_COST_MONEY) return { ok: false, msg: `金钱不足（需${CARAVAN_COST_MONEY}金）` };
    if (res.food < CARAVAN_COST_FOOD) return { ok: false, msg: `粮草不足（需${CARAVAN_COST_FOOD}粮）` };
    res.money -= CARAVAN_COST_MONEY;
    res.food -= CARAVAN_COST_FOOD;
    // 选一件两地价差最大的商品
    let best = null, bestMargin = 0;
    for (const g of GOODS) {
      const margin = this.priceAt(g.id, to) - this.priceAt(g.id, from);
      if (margin > bestMargin) { bestMargin = margin; best = g; }
    }
    const caravan = {
      id: 'cav_' + (++caravanCounter),
      factionId: fid,
      from: fromCityId, to: toCityId,
      goods: best ? best.id : 'silk',
      goodsName: best ? best.name : '货物',
      turnsLeft: CARAVAN_TURNS,
      estProfit: Math.max(50, Math.round(bestMargin * 3))
    };
    this.caravans.push(caravan);
    game.pushLog(`🐫 商队自 ${from.name} 出发，贩运${caravan.goodsName}往 ${to.name}（预计获利约${caravan.estProfit}金）。`);
    return { ok: true, msg: `商队已派遣，${CARAVAN_TURNS}回合抵达`, caravan };
  }

  // 贸易协定：双方关系≥友好则签订，双方贸易收入+10%
  agreeKey(a, b) { return [a, b].sort().join('_'); }
  hasAgreement(a, b) { return !!this.agreements[this.agreeKey(a, b)]; }

  proposeAgreement(game, fid, targetFid) {
    if (fid === targetFid) return { ok: false, msg: '不能与本势力互市' };
    const rel = game.diplomacy.getRelation(fid, targetFid);
    if (!rel) return { ok: false, msg: '无外交关系' };
    if (rel.relation < TRADE_AGREE_REL_MIN) {
      return { ok: false, msg: `两国未睦，难以通商（需关系≥${TRADE_AGREE_REL_MIN}）` };
    }
    if (this.hasAgreement(fid, targetFid)) return { ok: false, msg: '已互市通商' };
    this.agreements[this.agreeKey(fid, targetFid)] = true;
    game.pushLog(`⚖ 与 ${game._factionName(targetFid)} 签订通商协定，双方商税互通。`);
    return { ok: true, msg: `已与 ${game._factionName(targetFid)} 通商互市！` };
  }

  // 本势力贸易协定增收比例（每与一势力通商 +10%）
  getAgreementMult(fid) {
    let n = 0;
    for (const [k, v] of Object.entries(this.agreements)) {
      if (!v) continue;
      const [a, b] = k.split('_');
      if (a === fid || b === fid) n++;
    }
    return n * 0.10;
  }

  // ============ V15.0 新增贸易 API ============

  // 查询某城产出的特色商品列表
  getTradeGoods(cityId) {
    const result = [];
    for (const [gid, g] of Object.entries(CITY_SPECIALTIES)) {
      if (g.cities.includes(cityId)) {
        result.push({ id: gid, name: g.name, basePrice: g.basePrice });
      }
    }
    // 也合并原有 GOODS 中 producedBy 包含该城的
    for (const g of GOODS) {
      if ((g.producedBy || []).includes(cityId)) {
        result.push({ id: g.id, name: g.name, basePrice: g.basePrice });
      }
    }
    return result;
  }

  // 查询两城间贸易路线信息（距离、可贸易商品、预估利润）
  getTradeRoute(game, fromCityId, toCityId) {
    const from = game.cities.get(fromCityId);
    const to = game.cities.get(toCityId);
    if (!from || !to) return null;
    // 简化距离：用城市商业等级差作为距离代理
    const fromComm = from.comm || 50;
    const toComm = to.comm || 50;
    // 基础距离估算（0~20）
    const distance = Math.round(Math.abs(fromComm - toComm) / 10) + 2;
    // 可贸易商品：两地特产互补
    const fromGoods = this.getTradeGoods(fromCityId);
    const toGoods = this.getTradeGoods(toCityId);
    const tradable = fromGoods.filter(g => !toGoods.find(t => t.id === g.id));
    return {
      from: from.name, to: to.name,
      distance,
      fromGoods, toGoods,
      tradable,
      estimatedIncome: this.calculateTradeIncome(game, fromCityId, toCityId)
    };
  }

  // 计算两城间贸易收入：基于距离与双方商业等级
  calculateTradeIncome(game, fromCityId, toCityId) {
    const from = game.cities.get(fromCityId);
    const to = game.cities.get(toCityId);
    if (!from || !to) return 0;
    const fromComm = from.comm || 50;
    const toComm = to.comm || 50;
    // 距离因子：越远利润越高（但有风险）
    const distance = Math.round(Math.abs(fromComm - toComm) / 10) + 2;
    // 收入 = 平均商业等级 × 距离 × 系数
    const avgComm = (fromComm + toComm) / 2;
    const baseIncome = Math.round(avgComm * distance * 0.8);
    return baseIncome;
  }

  // 回合结算：推进商队、结算长距商路与协定
  settleTurn(game, fid) {
    let income = 0;
    // V21.0：推进丝路商队（西行而还）
    this._v21SettleVoyages(game, fid);
    // 长距商路
    income += this.getLongRouteIncome(game, fid);
    // 协定加成作用于长距商路
    income *= (1 + this.getAgreementMult(fid));
    // 商队推进
    const arrived = [];
    this.caravans = this.caravans.filter(c => {
      if (c.factionId !== fid) return true;
      c.turnsLeft--;
      if (c.turnsLeft > 0) return true;
      // 到达：判定劫掠
      if (Math.random() < CARAVAN_PLUNDER_RISK) {
        game.pushLog(`⚠ 商队（${c.goodsName}）于中途为山胡所掠，损失惨重！`);
      } else {
        const res = game.factionRes.get(fid);
        if (res) res.money += c.estProfit;
        game.pushLog(`💰 商队（${c.goodsName}）平安抵达，获利 ${c.estProfit} 金！`);
      }
      arrived.push(c);
      return false;
    });
    // V15.0：随机贸易事件（10% 概率触发）
    if (Math.random() < 0.10 && TRADE_EVENTS.length > 0) {
      const totalWeight = TRADE_EVENTS.reduce((s, e) => s + e.weight, 0);
      let roll = Math.random() * totalWeight;
      let ev = TRADE_EVENTS[0];
      for (const e of TRADE_EVENTS) { roll -= e.weight; if (roll <= 0) { ev = e; break; } }
      const res = game.factionRes.get(fid);
      if (res && ev.effect) {
        if (ev.effect.money) res.money = Math.max(0, (res.money || 0) + ev.effect.money);
        if (ev.effect.morale) {
          for (const c of game.getFactionCities(fid)) {
            c.morale = Math.max(0, Math.min(100, (c.morale || 50) + ev.effect.morale));
          }
        }
      }
      game.pushLog(`【贸易事件】${ev.name}：${ev.description}`);
    }
    return { income: Math.round(income), arrived };
  }

  // ============ V21.0 丝绸之路贸易深化 API ============

  // 玩家是否控制丝路东端门户（长安+敦煌）
  _v21HasGateway(game, fid) {
    const owned = new Set(game.getFactionCities(fid).map(c => c.id));
    return V21_SILK_GATEWAY.every(cid => owned.has(cid));
  }

  // 开通丝绸之路：须控制长安、敦煌门户，方可发商队西行
  startSilkRoad(game, fid) {
    fid = fid || game.playerFaction;
    if (this.v21.started) return { ok: false, msg: '丝绸之路已开通' };
    if (!this._v21HasGateway(game, fid)) {
      return { ok: false, msg: '须同时控制长安、敦煌，方可贯通丝路东端门户' };
    }
    this.v21.started = true;
    this.v21.stats.stationsBuilt = this.v21.stats.stationsBuilt || 0;
    game.pushLog('🐫 丝绸之路贯通！自长安经敦煌出西域，商旅直指波斯、大秦。');
    return { ok: true, msg: '丝绸之路已开通！可沿途建驿站、遣商队西行。' };
  }

  // 丝路安全度（0~100）：与游牧民族关系越好，丝路越畅通
  // 综合：游牧部落平均关系(±100→0~100)、驿站护商加成、玩家是否处于战乱
  getSilkRoadSecurity(game, fid) {
    fid = fid || game.playerFaction;
    let relScore = 50; // 无游牧数据时取中性
    const tribes = game.barbarianTribes || [];
    if (tribes.length > 0) {
      const avg = tribes.reduce((s, t) => s + (t.relation || 0), 0) / tribes.length; // -100~100
      relScore = Math.max(0, Math.min(100, Math.round(50 + avg / 2)));
    }
    // 驿站每座 +3 护商，封顶 +15
    const stationBoost = Math.min(15, Object.keys(this.v21.stations).length * 3);
    let value = relScore + stationBoost;
    value = Math.max(0, Math.min(100, value));
    let level = '艰险';
    if (value >= 80) level = '畅通';
    else if (value >= 60) level = '安宁';
    else if (value >= 40) level = '多盗';
    return { value, level, stationBoost, relScore };
  }

  // 商队护送兵力是否充足（现役军队 + 城防）
  _v21GuardTroops(game, fid) {
    try {
      const armies = game.getFactionArmies ? game.getFactionArmies(fid) : [];
      const field = armies.reduce((s, a) => s + (a.troops || 0), 0);
      const cities = game.getFactionCities ? game.getFactionCities(fid) : [];
      const garrison = cities.reduce((s, c) => s + (c.garrison || 0), 0);
      return field + garrison;
    } catch (e) { return 0; }
  }

  // 计算某条丝路商队的预估利润（routeId 保留扩展位，默认主线）
  getCaravanProfit(game, routeId, fid) {
    fid = fid || game.playerFaction;
    if (!this.v21.started) return 0;
    const stations = Object.keys(this.v21.stations).length;
    // 驿站加成
    const stationMult = 1 + stations * V21_STATION_TRADE_BONUS;
    // 安全度决定折损：安全越低，实际到手越少
    const sec = this.getSilkRoadSecurity(game, fid).value / 100;
    // 丝路特产利润翻倍
    let profit = V21_SILK_BASE_PROFIT * V21_SILK_PROFIT_MULT * stationMult;
    profit *= (0.4 + 0.6 * sec); // 安全度 0→0.4，1→1.0
    // 护送不足再折损
    const guard = this._v21GuardTroops(game, fid);
    if (guard < V21_GUARD_MIN_TROOPS) profit *= 0.6;
    return Math.round(profit);
  }

  // 派遣一支丝路商队西行（长安→罗马方向）
  dispatchSilkVoyage(game, fid) {
    fid = fid || game.playerFaction;
    if (!this.v21.started) return { ok: false, msg: '请先开通丝绸之路' };
    const res = game.factionRes.get(fid);
    if (!res) return { ok: false, msg: '无资源' };
    const costMoney = Math.round(V21_SILK_BASE_PROFIT * 0.4);
    if (res.money < costMoney) return { ok: false, msg: `出资本不足（需${costMoney}金）` };
    const guard = this._v21GuardTroops(game, fid);
    const guarded = guard >= V21_GUARD_MIN_TROOPS;
    res.money -= costMoney;
    const voyage = {
      id: 'v21sv_' + (++v21SilkVoyageCounter),
      factionId: fid,
      exportGoods: V21_SILK_EXPORTS,
      importGoods: V21_SILK_IMPORTS,
      guarded,
      estProfit: this.getCaravanProfit(game, 'silkroad_main', fid),
      turnsLeft: 6,
      done: false
    };
    this.v21.voyages.push(voyage);
    game.pushLog(guarded
      ? `🐫 丝路商队携丝绸西行，沿途有精兵护送，市利双倍。`
      : `⚠ 丝路商队西行，然护送单薄，途中恐遭剽掠！`);
    return { ok: true, msg: `丝路商队已发，6 回合抵罗马而还`, voyage };
  }

  // 在沿途城市建造丝路驿站：提升贸易量
  buildCaravanStation(city, game, fid) {
    fid = fid || game.playerFaction;
    if (!city) return { ok: false, msg: '未指定城市' };
    if (this.v21.stations[city.id]) return { ok: false, msg: '此城已有驿站' };
    if (city.owner !== fid) return { ok: false, msg: '驿站须建于我方城池' };
    const res = game.factionRes.get(fid);
    if (!res) return { ok: false, msg: '无资源' };
    if (res.money < V21_STATION_COST_MONEY) return { ok: false, msg: `金钱不足（需${V21_STATION_COST_MONEY}金）` };
    if (res.food < V21_STATION_COST_FOOD) return { ok: false, msg: `粮草不足（需${V21_STATION_COST_FOOD}粮）` };
    res.money -= V21_STATION_COST_MONEY;
    res.food -= V21_STATION_COST_FOOD;
    this.v21.stations[city.id] = { name: city.name, builtTurn: game.turn };
    this.v21.stats.stationsBuilt = (this.v21.stats.stationsBuilt || 0) + 1;
    game.pushLog(`🏯 于 ${city.name} 置丝路驿站，商旅驻足，贸易日盛。`);
    return { ok: true, msg: `驿站建成，丝路贸易量 +${Math.round(V21_STATION_TRADE_BONUS * 100)}%` };
  }

  // 丝路总览状态（UI / 成就 / 结局查询用）
  getSilkRoadStatus(game, fid) {
    fid = fid || game.playerFaction;
    const stations = Object.values(this.v21.stations);
    const sec = this.getSilkRoadSecurity(game, fid);
    const guard = this._v21GuardTroops(game, fid);
    return {
      started: this.v21.started,
      nodes: V21_SILK_ROAD_NODES.map(n => ({ id: n.id, name: n.name, type: n.type })),
      nodesCount: V21_SILK_ROAD_NODES.length,
      gateway: this._v21HasGateway(game, fid),
      stations,
      stationCount: stations.length,
      security: sec,
      guardTroops: guard,
      guardAdequate: guard >= V21_GUARD_MIN_TROOPS,
      estProfitPerVoyage: this.v21.started ? this.getCaravanProfit(game, 'silkroad_main', fid) : 0,
      exports: V21_SILK_EXPORTS,
      imports: V21_SILK_IMPORTS,
      stats: { ...this.v21.stats }
    };
  }

  // V21：丝路商队回合结算（在 settleTurn 内顺带推进）
  _v21SettleVoyages(game, fid) {
    if (!this.v21.started) return;
    this.v21.voyages = this.v21.voyages.filter(v => {
      if (v.factionId !== fid) return true;
      v.turnsLeft--;
      if (v.turnsLeft > 0) return true;
      const res = game.factionRes.get(fid);
      // 劫掠判定：无护送 + 安全低，则被劫
      const plunderChance = v.guarded
        ? (1 - this.getSilkRoadSecurity(game, fid).value / 100) * 0.10
        : 0.25 + (1 - this.getSilkRoadSecurity(game, fid).value / 100) * 0.40;
      if (Math.random() < plunderChance) {
        this.v21.stats.plundered = (this.v21.stats.plundered || 0) + 1;
        game.pushLog(`⚠ 丝路商队于葱岭以西为胡骑所掠，货财尽失！`);
      } else if (res) {
        res.money += v.estProfit;
        this.v21.stats.profitEarned = (this.v21.stats.profitEarned || 0) + v.estProfit;
        this.v21.stats.voyagesCompleted = (this.v21.stats.voyagesCompleted || 0) + 1;
        game.pushLog(`💰 丝路商队自罗马而归，市利翻倍，获利 ${v.estProfit} 金！`);
      }
      return false;
    });
  }

  serialize() {
    return {
      caravans: this.caravans,
      agreements: this.agreements,
      v21: this.v21
    };
  }
  static deserialize(data) {
    const t = new TradeSystem();
    if (data) {
      t.caravans = Array.isArray(data.caravans) ? data.caravans : [];
      t.agreements = (data.agreements && typeof data.agreements === 'object') ? data.agreements : {};
      if (data.v21 && typeof data.v21 === 'object') {
        t.v21 = {
          started: !!data.v21.started,
          stations: (data.v21.stations && typeof data.v21.stations === 'object') ? data.v21.stations : {},
          voyages: Array.isArray(data.v21.voyages) ? data.v21.voyages : [],
          stats: { profitEarned: 0, voyagesCompleted: 0, stationsBuilt: 0, plundered: 0, ...(data.v21.stats || {}) }
        };
      }
      // 同步计数器
      caravanCounter = t.caravans.reduce((m, c) => {
        const n = parseInt(String(c.id).replace('cav_', ''), 10) || 0;
        return Math.max(m, n);
      }, 0);
    }
    return t;
  }
}
