// ============================================================
// trade.js — V7.0 贸易商路 / 商队 / 贸易协定系统
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
// ============================================================

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

let caravanCounter = 0;

export class TradeSystem {
  constructor() {
    this.caravans = [];      // 进行中商队
    this.agreements = {};   // "fid1_fid2": true
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

  // 回合结算：推进商队、结算长距商路与协定
  settleTurn(game, fid) {
    let income = 0;
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
    return { income: Math.round(income), arrived };
  }

  serialize() {
    return { caravans: this.caravans, agreements: this.agreements };
  }
  static deserialize(data) {
    const t = new TradeSystem();
    if (data) {
      t.caravans = Array.isArray(data.caravans) ? data.caravans : [];
      t.agreements = (data.agreements && typeof data.agreements === 'object') ? data.agreements : {};
      // 同步计数器
      caravanCounter = t.caravans.reduce((m, c) => {
        const n = parseInt(String(c.id).replace('cav_', ''), 10) || 0;
        return Math.max(m, n);
      }, 0);
    }
    return t;
  }
}
