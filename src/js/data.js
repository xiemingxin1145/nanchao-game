// ============================================================
// data.js — 静态数据：势力、城市、武将、兵种、事件
// ============================================================

// ---------- 势力（V3.0：6势力「群雄并起·550」） ----------
// 保留原 id（nanchao/dongwei/xiwei）以兼容旧存档与 UI；名称更新为550时代。
// 新增：hou_liang(后梁) / wang_lin(王琳) / xiao_zhuang(萧庄)
// 平衡：6势力初始总兵力通过 startCities 数量 + 初始驻军分布控制在 20000~30000。
export const FACTIONS = {
  // 1. 南陈（陈霸先）— 江东，水军/弓兵强
  nanchao: {
    id: 'nanchao',
    name: '南陈',
    color: '#1B7A5A',
    colorLight: '#2E9E7A',
    capital: 'jiankang',
    description: '陈霸先起于江东，据长江天险，水军弓兵强盛，立国偏安江南。',
    bonus: '商业+20%，弓兵战力+15%',
    startCities: ['jiankang', 'wujun', 'kuaiji', 'jiangzhou', 'guangzhou', 'jiaozhou',
                  'jiangxia', 'hefei']
  },
  // 2. 北齐（高洋）— 河北，骑兵强
  dongwei: {
    id: 'dongwei',
    name: '北齐',
    color: '#A0522D',
    colorLight: '#C07840',
    capital: 'yecheng',
    description: '高洋代东魏建齐，据河北山东富庶之地，铁骑纵横，名将荟萃。',
    bonus: '骑兵战力+15%，人口+10%',
    startCities: ['yecheng', 'jinyang', 'luoyang', 'pengcheng', 'qingzhou', 'youzhou',
                  'shouyang', 'xiangguo', 'xindu', 'dingzhou', 'yingzhou',
                  'runan', 'qiaojun']
  },
  // 3. 北周（宇文觉）— 关中，步兵强
  xiwei: {
    id: 'xiwei',
    name: '北周',
    color: '#2C3E6B',
    colorLight: '#4A6090',
    capital: 'changan',
    description: '宇文氏代西魏建周，据关中形胜，府兵耕战一体，步兵精锐。',
    bonus: '步兵战力+15%，防御+20%',
    startCities: ['changan', 'tianshui', 'guzang', 'pingcheng', 'longyou', 'hanzhong', 'chengdu',
                  'nanyang']
  },
  // 4. 后梁（萧詧）— 荆州，北周附庸
  hou_liang: {
    id: 'hou_liang',
    name: '后梁',
    color: '#6B4C7A',
    colorLight: '#8A6C9A',
    capital: 'jiangling',
    description: '萧詧附庸于北周，据荆州江陵一隅，国小而祚短，唯守而已。',
    bonus: '城市防御+15%',
    startCities: ['jiangling', 'xiangyang']
  },
  // 5. 王琳（郢城）— 湘州，南朝残余，水军强
  wang_lin: {
    id: 'wang_lin',
    name: '王琳',
    color: '#8B6914',
    colorLight: '#B8941F',
    capital: 'yingcheng',
    description: '南朝忠臣之后，据湘郢之地，水军精锐，志在匡复梁室。',
    bonus: '弓兵战力+15%，初始士气+10',
    startCities: ['yingcheng', 'xiangzhou']
  },
  // 6. 萧庄（豫州）— 南朝宗室
  xiao_zhuang: {
    id: 'xiao_zhuang',
    name: '萧庄',
    color: '#4A6B5A',
    colorLight: '#6B8B7A',
    capital: 'yuzhou',
    description: '南朝宗室之后，据豫州之地，号令遗民，徘徊于齐魏之间。',
    bonus: '步兵战力+10%，招募在野将+15%',
    startCities: ['yuzhou', 'xinye']
  }
};

// ---------- 剧本注册表（V5.0：4 个历史剧本） ----------
// '550' 群雄并起：6势力同时存在（默认主剧本，ui.js 经 Object.values(FACTIONS) 自动呈现）
// '534' 三足鼎立：南梁/东魏/西魏 3势力（历史事件链开局剧本，供 API/测试选用）
// '575' 北周伐齐：北周武帝亲征，北齐内乱，南陈偏安（V5.0 新增）
// '581' 隋文统一：杨坚代周建隋，南下灭陈前夕（V5.0 新增）
// 各剧本共用同一套 30 城 / 50 将数据，差异仅在于「激活哪些势力」+ 开局数值调整。
//
// 剧本可选字段（V5.0 声明式开局覆盖）：
//   resources:       { [fid]: { money, food } }  覆盖初始资源
//   cityMorale:      { [fid]: number }           该势力全部城市初始民心
//   generalLoyalty:  { [fid]: number }           该势力全部武将初始忠诚
//   garrisonMult:    { [fid]: number }           该势力城市初始驻军倍率
export const SCENARIOS = {
  '550': {
    id: '550', name: '群雄并起', year: 550,
    description: '高洋代东魏建齐，宇文觉代西魏建周，江南陈霸先立新。六雄并起，天下分崩。',
    factions: ['nanchao', 'dongwei', 'xiwei', 'hou_liang', 'wang_lin', 'xiao_zhuang'],
    factionNameOverride: {} // 沿用 FACTIONS 现有名称
  },
  '534': {
    id: '534', name: '三足鼎立', year: 534,
    description: '高欢、宇文泰各奉魏主，江南萧衍在位。魏分东西，天下三分之势初成。',
    factions: ['nanchao', 'dongwei', 'xiwei'],
    // 534 时代名称回退（东魏/西魏/南梁）
    factionNameOverride: {
      nanchao: '南梁', dongwei: '东魏', xiwei: '西魏'
    }
  },
  // ---- V5.0 剧本3：北周伐齐（575年）----
  '575': {
    id: '575', name: '北周伐齐', year: 575,
    description: '北周武帝宇文邕亲征北齐。北齐后主高纬昏庸，斛律光已冤死，朝政崩坏；北周府兵精锐，志在混一北方。南陈偏安建康，后梁附庸江陵。',
    factions: ['xiwei', 'dongwei', 'nanchao', 'hou_liang'],
    factionNameOverride: {
      xiwei: '北周', dongwei: '北齐', nanchao: '南陈', hou_liang: '后梁'
    },
    // 特殊规则：北齐民心低、武将忠诚低；北周兵强马壮
    resources: {
      xiwei: { money: 3200, food: 4200 },
      dongwei: { money: 1100, food: 2200 },
      nanchao: { money: 1400, food: 2600 },
      hou_liang: { money: 800, food: 1500 }
    },
    cityMorale: { xiwei: 70, dongwei: 28, nanchao: 50, hou_liang: 55 },
    generalLoyalty: { xiwei: 82, dongwei: 38, nanchao: 65, hou_liang: 60 },
    garrisonMult: { xiwei: 1.45, dongwei: 0.75, nanchao: 1.0, hou_liang: 0.9 }
  },
  // ---- V5.0 剧本4：隋文统一（581年）----
  '581': {
    id: '581', name: '隋文统一', year: 581,
    description: '杨坚受周禅让建隋，据关中河北，国富兵强，蓄势南下。南陈后主叔宝荒于诗酒，长江天险形同虚设。后梁一隅、王琳余烬，皆为统一路上的尘埃。',
    factions: ['xiwei', 'nanchao', 'hou_liang', 'wang_lin'],
    factionNameOverride: {
      xiwei: '隋', nanchao: '南陈', hou_liang: '后梁', wang_lin: '王琳'
    },
    // 特殊规则：隋极强；南陈民心低、兵力弱
    resources: {
      xiwei: { money: 4500, food: 6000 },
      nanchao: { money: 1200, food: 2400 },
      hou_liang: { money: 700, food: 1400 },
      wang_lin: { money: 600, food: 1200 }
    },
    cityMorale: { xiwei: 75, nanchao: 30, hou_liang: 50, wang_lin: 45 },
    generalLoyalty: { xiwei: 88, nanchao: 55, hou_liang: 60, wang_lin: 50 },
    garrisonMult: { xiwei: 1.7, nanchao: 0.7, hou_liang: 0.8, wang_lin: 0.8 }
  },
  // ---- V5.5 剧本5：侯景之乱（548年）----
  '548': {
    id: '548', name: '侯景之乱', year: 548,
    description: '南梁武帝怠政，侯景据寿阳举兵叛，渡江围台城，江东涂炭。东魏高洋虎视淮南，西魏宇文泰伺机取巴蜀江陵。江南残破，英雄并起。',
    factions: ['nanchao', 'dongwei', 'xiwei', 'hou_liang'],
    factionNameOverride: {
      nanchao: '南梁', dongwei: '东魏', xiwei: '西魏', hou_liang: '后梁'
    },
    // 特殊规则：南梁内乱民心低、驻军乱；东魏西魏兵精粮足
    resources: {
      nanchao: { money: 1500, food: 2200 },
      dongwei: { money: 3000, food: 3800 },
      xiwei: { money: 2800, food: 3600 },
      hou_liang: { money: 900, food: 1600 }
    },
    cityMorale: { nanchao: 35, dongwei: 68, xiwei: 66, hou_liang: 55 },
    generalLoyalty: { nanchao: 45, dongwei: 80, xiwei: 80, hou_liang: 62 },
    garrisonMult: { nanchao: 0.7, dongwei: 1.3, xiwei: 1.3, hou_liang: 0.9 }
  },
  // ---- V5.5 剧本6：三国归隋（589年）----
  '589': {
    id: '589', name: '三国归隋', year: 589,
    description: '杨坚已篡周建隋，灭后梁，据有整个北方，国富兵强。晋王杨广节度诸军，临江督战。南陈后主陈叔宝荒于诗酒，长江天险形同虚设。此一战，天下归一。',
    factions: ['xiwei', 'nanchao'],
    factionNameOverride: {
      xiwei: '隋', nanchao: '南陈'
    },
    // 特殊规则：隋极强；南陈孤弱
    resources: {
      xiwei: { money: 6000, food: 8000 },
      nanchao: { money: 1000, food: 2000 }
    },
    cityMorale: { xiwei: 78, nanchao: 32 },
    generalLoyalty: { xiwei: 90, nanchao: 48 },
    garrisonMult: { xiwei: 1.9, nanchao: 0.65 }
  }
};
export const DEFAULT_SCENARIO = '550';

// ---------- 兵种 ----------
// V6.0：新增水军兵种（楼船/蒙冲/斗舰），与步兵/骑兵/弓兵并列。
// 历史：南北朝长江水战频繁，楼船为本阵主力，蒙冲为突击先锋，斗舰为中坚。
export const UNIT_TYPES = {
  infantry: { name: '步兵', coefficient: 1.0, cost: 10, counter: 'cavalry' },
  cavalry:  { name: '骑兵', coefficient: 1.3, cost: 25, counter: 'archer' },
  archer:   { name: '弓兵', coefficient: 1.1, cost: 15, counter: 'infantry' },
  // ---- V6.0 水军兵种 ----
  louchuan:   { name: '楼船', coefficient: 1.3, cost: 40, counter: 'mengchong', navy: true, waterBonus: 1.5, landPenalty: 0.3 },
  mengchong:  { name: '蒙冲', coefficient: 1.2, cost: 35, counter: 'douchian',  navy: true, waterBonus: 1.6, landPenalty: 0.25 },
  douchian:   { name: '斗舰', coefficient: 1.15, cost: 30, counter: 'louchuan', navy: true, waterBonus: 1.4, landPenalty: 0.35 }
};

// 克制关系：key 克 value
export const COUNTER_RELATION = {
  cavalry: 'archer',   // 骑兵克弓兵
  archer: 'infantry',  // 弓兵克步兵
  infantry: 'cavalry'  // 步兵克骑兵
};
export const COUNTER_BONUS = 0.25; // +25%

// ---------- 兵种进阶树 ----------
// 每基础兵种两条进阶线：tier1 精锐（需校场3级）→ tier2 王牌（需校场5级）
// mult 为该兵种平均系数倍率（叠加在 UNIT_TYPES.coefficient 之上）
// 费用：tier1 400金+800粮；tier2 800金+1500粮；耗时 1 回合（pendingUpgrades）
// 数值平衡：tier1 系数 +30% 左右，tier2 相对基础 +55%~65%，不超过 70%
export const ADVANCEMENT_TREE = {
  infantry: [
    { id: 'heavy_infantry', name: '重甲步兵', tier: 1, drillLevel: 3,
      mult: 1.30, costMoney: 400, costFood: 800,
      description: '重甲步兵：防御+30%，攻击+10%。' },
    { id: 'xianzhen', name: '陷阵营', tier: 2, drillLevel: 5,
      mult: 1.62, costMoney: 800, costFood: 1500,
      description: '陷阵营：攻击+25%，防御+20%，士气+20。' }
  ],
  cavalry: [
    { id: 'heavy_cavalry', name: '重骑兵', tier: 1, drillLevel: 3,
      mult: 1.30, costMoney: 400, costFood: 800,
      description: '重骑兵：攻击+25%，防御+15%。' },
    { id: 'hubaoqi', name: '虎豹骑', tier: 2, drillLevel: 5,
      mult: 1.65, costMoney: 800, costFood: 1500,
      description: '虎豹骑：攻击+35%，移动+20%，士气+25。' }
  ],
  archer: [
    { id: 'crossbow', name: '强弩兵', tier: 1, drillLevel: 3,
      mult: 1.25, costMoney: 400, costFood: 800,
      description: '强弩兵：攻击+20%，射程+1。' },
    { id: 'wudangfeijun', name: '无当飞军', tier: 2, drillLevel: 5,
      mult: 1.55, costMoney: 800, costFood: 1500,
      description: '无当飞军：攻击+30%，山地+40%，士气+20。' }
  ]
};

// 按兵种与目标阶数查进阶节点
export function getUpgradeNode(unitType, tier) {
  const list = ADVANCEMENT_TREE[unitType] || [];
  return list.find(n => n.tier === tier) || null;
}

// ---------- 地形 ----------
export const TERRAIN = {
  plain:    { name: '平原', color: '#4A7C3A', height: 0, cavalryBonus: 0.30 },
  mountain: { name: '山地', color: '#7A6B5A', height: 1, infantryBonus: 0.30 },
  forest:   { name: '森林', color: '#2D5A2D', height: 0.3, archerBonus: 0.10 },
  river:    { name: '河流', color: '#3A6B9C', height: 0, archerBonus: 0.20 },
  desert:   { name: '沙漠', color: '#C4A55A', height: 0, supplyPenalty: 0.30 }
};

// ---------- 季节 ----------
export const SEASONS = ['春', '夏', '秋', '冬'];
export const SEASON_ICON = { '春': '❀', '夏': '☀', '秋': '🍂', '冬': '❄' };
// 粮草产出季节系数
export const SEASON_FOOD_MULT = { '春': 0.9, '夏': 1.1, '秋': 1.3, '冬': 0.7 };

// ---------- 30 座城市（V3.0 扩充） ----------
// isoX, isoY 为等距坐标；屏幕映射 screenX=(isoX-isoY)*32, screenY=(isoX+isoY)*16
// 地理：关中偏西(x小)、河北偏东北(x大y小)、江南偏东南(x大y大)、巴蜀偏西南(x小y大)
// 平衡：pop 25000~90000，规模 size 1~4，数值在下方逐城标注。
export const CITIES = [
  // === 南陈（江东）===
  { id: 'jiankang',  name: '建康', isoX: 12, isoY: 6,  terrain: 'river',   size: 4, capital: true,
    pop: 85000, agri: 70, comm: 95, defense: 65, prosperity: 90, taxRate: 30 },
  { id: 'wujun',     name: '吴郡', isoX: 13, isoY: 7,  terrain: 'plain',    size: 3, capital: false,
    pop: 50000, agri: 70, comm: 75, defense: 45, prosperity: 70, taxRate: 30 },
  { id: 'kuaiji',    name: '会稽', isoX: 14, isoY: 8,  terrain: 'plain',    size: 3, capital: false,
    pop: 48000, agri: 75, comm: 70, defense: 45, prosperity: 68, taxRate: 30 },
  { id: 'jiangzhou', name: '江州', isoX: 12, isoY: 8,  terrain: 'river',   size: 2, capital: false,
    pop: 35000, agri: 60, comm: 55, defense: 45, prosperity: 55, taxRate: 30 },
  { id: 'guangzhou', name: '广州', isoX: 11, isoY: 10, terrain: 'forest',  size: 3, capital: false,
    pop: 45000, agri: 55, comm: 75, defense: 45, prosperity: 65, taxRate: 30 },
  { id: 'jiaozhou',  name: '交州', isoX: 11, isoY: 11, terrain: 'forest',  size: 2, capital: false,
    pop: 28000, agri: 50, comm: 45, defense: 35, prosperity: 45, taxRate: 30 },

  // === 北齐（河北山东）===
  { id: 'yecheng',   name: '邺城', isoX: 10, isoY: 2,  terrain: 'plain',    size: 4, capital: true,
    pop: 90000, agri: 75, comm: 88, defense: 65, prosperity: 85, taxRate: 30 },
  { id: 'jinyang',   name: '晋阳', isoX: 9,  isoY: 1,  terrain: 'mountain', size: 3, capital: false,
    pop: 55000, agri: 60, comm: 55, defense: 65, prosperity: 65, taxRate: 30 },
  { id: 'luoyang',   name: '洛阳', isoX: 9,  isoY: 3,  terrain: 'plain',    size: 4, capital: false,
    pop: 70000, agri: 70, comm: 90, defense: 55, prosperity: 80, taxRate: 30 },
  { id: 'pengcheng', name: '彭城', isoX: 12, isoY: 3,  terrain: 'plain',    size: 3, capital: false,
    pop: 50000, agri: 65, comm: 65, defense: 50, prosperity: 65, taxRate: 30 },
  { id: 'qingzhou',  name: '青州', isoX: 13, isoY: 2,  terrain: 'plain',    size: 3, capital: false,
    pop: 45000, agri: 60, comm: 70, defense: 45, prosperity: 65, taxRate: 30 },
  { id: 'youzhou',   name: '幽州', isoX: 11, isoY: 0,  terrain: 'desert',  size: 2, capital: false,
    pop: 30000, agri: 45, comm: 40, defense: 50, prosperity: 45, taxRate: 30 },
  { id: 'shouyang',  name: '寿阳', isoX: 11, isoY: 4,  terrain: 'plain',    size: 2, capital: false,
    pop: 35000, agri: 55, comm: 50, defense: 55, prosperity: 55, taxRate: 30 },
  { id: 'xiangguo',  name: '襄国', isoX: 10, isoY: 1,  terrain: 'plain',    size: 2, capital: false,
    pop: 32000, agri: 55, comm: 45, defense: 50, prosperity: 50, taxRate: 30 },
  { id: 'xindu',     name: '信都', isoX: 11, isoY: 2,  terrain: 'plain',    size: 2, capital: false,
    pop: 33000, agri: 55, comm: 50, defense: 48, prosperity: 52, taxRate: 30 },
  { id: 'dingzhou',  name: '定州', isoX: 9,  isoY: 0,  terrain: 'mountain', size: 2, capital: false,
    pop: 30000, agri: 50, comm: 45, defense: 55, prosperity: 48, taxRate: 30 },
  { id: 'yingzhou',  name: '瀛州', isoX: 12, isoY: 0,  terrain: 'plain',    size: 2, capital: false,
    pop: 28000, agri: 50, comm: 42, defense: 45, prosperity: 46, taxRate: 30 },

  // === 北周（关中巴蜀）===
  { id: 'changan',   name: '长安', isoX: 6,  isoY: 3,  terrain: 'plain',    size: 4, capital: true,
    pop: 65000, agri: 65, comm: 70, defense: 75, prosperity: 75, taxRate: 30 },
  { id: 'tianshui',  name: '天水', isoX: 5,  isoY: 4,  terrain: 'mountain', size: 2, capital: false,
    pop: 30000, agri: 45, comm: 35, defense: 55, prosperity: 45, taxRate: 30 },
  { id: 'guzang',    name: '姑臧', isoX: 4,  isoY: 2,  terrain: 'desert',   size: 2, capital: false,
    pop: 25000, agri: 40, comm: 45, defense: 45, prosperity: 40, taxRate: 30 },
  { id: 'pingcheng', name: '平城', isoX: 7,  isoY: 1,  terrain: 'mountain', size: 2, capital: false,
    pop: 28000, agri: 45, comm: 35, defense: 50, prosperity: 42, taxRate: 30 },
  { id: 'longyou',   name: '陇右', isoX: 4,  isoY: 3,  terrain: 'mountain', size: 2, capital: false,
    pop: 26000, agri: 45, comm: 35, defense: 50, prosperity: 42, taxRate: 30 },
  { id: 'hanzhong',  name: '汉中', isoX: 6,  isoY: 6,  terrain: 'mountain', size: 2, capital: false,
    pop: 30000, agri: 60, comm: 40, defense: 60, prosperity: 50, taxRate: 30 },
  { id: 'chengdu',   name: '成都', isoX: 6,  isoY: 8,  terrain: 'plain',    size: 3, capital: false,
    pop: 60000, agri: 80, comm: 55, defense: 50, prosperity: 70, taxRate: 30 },

  // === 后梁（荆州）===
  { id: 'jiangling', name: '江陵', isoX: 10, isoY: 7,  terrain: 'river',   size: 3, capital: true,
    pop: 50000, agri: 65, comm: 60, defense: 60, prosperity: 65, taxRate: 30 },
  { id: 'xiangyang', name: '襄阳', isoX: 9,  isoY: 5,  terrain: 'mountain', size: 3, capital: false,
    pop: 45000, agri: 60, comm: 50, defense: 75, prosperity: 60, taxRate: 30 },

  // === 王琳（湘郢）===
  { id: 'yingcheng', name: '郢城', isoX: 11, isoY: 7,  terrain: 'river',   size: 3, capital: true,
    pop: 40000, agri: 60, comm: 55, defense: 55, prosperity: 58, taxRate: 30 },
  { id: 'xiangzhou', name: '湘州', isoX: 10, isoY: 9,  terrain: 'river',   size: 2, capital: false,
    pop: 32000, agri: 55, comm: 45, defense: 48, prosperity: 50, taxRate: 30 },

  // === 萧庄（豫州新野）===
  { id: 'yuzhou',   name: '豫州', isoX: 12, isoY: 5,  terrain: 'plain',    size: 2, capital: true,
    pop: 35000, agri: 60, comm: 50, defense: 55, prosperity: 55, taxRate: 30 },
  { id: 'xinye',    name: '新野', isoX: 9,  isoY: 6,  terrain: 'plain',    size: 2, capital: false,
    pop: 30000, agri: 55, comm: 40, defense: 50, prosperity: 48, taxRate: 30 },

  // === V6.5 新增城市（5座，30→35）===
  // 历史地理参考：江夏（夏口，今武汉，长江中游重镇）、南阳（宛城，中原门户）、
  // 汝南（悬瓠城，豫州治所）、谯郡（亳州，曹操故乡）、合肥（淮南重镇）
  { id: 'jiangxia', name: '江夏', isoX: 11, isoY: 6,  terrain: 'river',   size: 3, capital: false,
    pop: 42000, agri: 60, comm: 55, defense: 55, prosperity: 58, taxRate: 30 },
  { id: 'nanyang',  name: '南阳', isoX: 8,  isoY: 5,  terrain: 'plain',    size: 3, capital: false,
    pop: 48000, agri: 70, comm: 55, defense: 50, prosperity: 60, taxRate: 30 },
  { id: 'runan',    name: '汝南', isoX: 10, isoY: 4,  terrain: 'plain',    size: 2, capital: false,
    pop: 35000, agri: 60, comm: 45, defense: 50, prosperity: 52, taxRate: 30 },
  { id: 'qiaojun',  name: '谯郡', isoX: 11, isoY: 3,  terrain: 'plain',    size: 2, capital: false,
    pop: 30000, agri: 55, comm: 45, defense: 45, prosperity: 48, taxRate: 30 },
  { id: 'hefei',    name: '合肥', isoX: 12, isoY: 4,  terrain: 'plain',    size: 2, capital: false,
    pop: 32000, agri: 58, comm: 50, defense: 55, prosperity: 52, taxRate: 30 }
];

// 城市邻接关系（行军路径，双向对称）— V6.5 覆盖全部 35 城
export const CITY_LINKS = {
  // 江东
  jiankang:   ['jiangling', 'shouyang', 'guangzhou', 'wujun', 'jiangzhou', 'yingcheng', 'yuzhou', 'hefei'],
  wujun:      ['jiankang', 'kuaiji', 'jiangzhou'],
  kuaiji:     ['wujun', 'jiangzhou'],
  jiangzhou:  ['jiankang', 'guangzhou', 'yingcheng', 'wujun', 'kuaiji', 'xiangzhou', 'jiangxia'],
  guangzhou:  ['jiankang', 'jiangzhou', 'xiangzhou', 'jiaozhou'],
  jiaozhou:   ['guangzhou', 'xiangzhou'],
  // 河北
  yecheng:    ['jinyang', 'luoyang', 'pengcheng', 'xiangguo', 'xindu'],
  jinyang:    ['yecheng', 'pingcheng', 'luoyang', 'xiangguo', 'dingzhou'],
  luoyang:    ['yecheng', 'jinyang', 'shouyang', 'xiangyang', 'changan', 'runan', 'nanyang'],
  pengcheng:  ['yecheng', 'qingzhou', 'shouyang', 'xindu', 'yuzhou', 'qiaojun', 'hefei'],
  qingzhou:   ['pengcheng', 'youzhou', 'xindu', 'yingzhou'],
  youzhou:    ['qingzhou', 'pingcheng', 'dingzhou', 'yingzhou'],
  shouyang:   ['pengcheng', 'luoyang', 'xiangyang', 'jiankang', 'jiangling', 'yuzhou', 'runan', 'hefei'],
  xiangguo:   ['jinyang', 'yecheng', 'dingzhou', 'xindu'],
  xindu:      ['yecheng', 'qingzhou', 'pengcheng', 'xiangguo', 'yingzhou', 'qiaojun'],
  dingzhou:   ['jinyang', 'youzhou', 'pingcheng', 'xiangguo'],
  yingzhou:   ['youzhou', 'qingzhou', 'xindu'],
  // 关中巴蜀
  changan:    ['luoyang', 'tianshui', 'pingcheng', 'xiangyang', 'longyou', 'hanzhong'],
  tianshui:   ['changan', 'guzang', 'chengdu', 'longyou'],
  guzang:     ['tianshui', 'pingcheng', 'longyou'],
  pingcheng:  ['guzang', 'changan', 'jinyang', 'youzhou', 'dingzhou'],
  longyou:    ['guzang', 'tianshui', 'changan'],
  hanzhong:   ['changan', 'chengdu', 'xinye'],
  chengdu:    ['jiangling', 'tianshui', 'hanzhong'],
  // 荆州（后梁）
  jiangling:  ['jiankang', 'chengdu', 'xiangyang', 'shouyang', 'yingcheng', 'xiangzhou', 'xinye', 'jiangxia', 'nanyang'],
  xiangyang:  ['jiangling', 'shouyang', 'luoyang', 'changan', 'xinye', 'nanyang'],
  // 湘郢（王琳）
  yingcheng:  ['jiangling', 'jiankang', 'jiangzhou', 'xiangzhou', 'jiangxia'],
  xiangzhou:  ['jiangling', 'guangzhou', 'yingcheng', 'jiaozhou', 'jiangzhou'],
  // 豫州（萧庄）
  yuzhou:     ['shouyang', 'jiankang', 'pengcheng', 'hefei'],
  xinye:      ['xiangyang', 'jiangling', 'hanzhong', 'nanyang'],
  // ---- V6.5 新增城市连接 ----
  jiangxia:   ['jiangling', 'yingcheng', 'jiangzhou', 'yuzhou', 'hefei'],
  nanyang:    ['jiangling', 'xiangyang', 'xinye', 'luoyang'],
  runan:      ['luoyang', 'shouyang', 'qiaojun'],
  qiaojun:    ['pengcheng', 'xindu', 'runan'],
  hefei:      ['pengcheng', 'shouyang', 'jiankang', 'yuzhou', 'jiangxia']
};

// ---------- 50 位武将（V3.0 扩充） ----------
// 五维(command/force/intel/politics) 总和：名将 400+，普通将 300~350，行尾注释标注总和。
// portrait 对应 assets/portraits/{id}.png
export const GENERALS = [
  // === 南陈（14）===
  { id: 'chen_baxian', name: '陈霸先', faction: 'nanchao', role: '君主',
    command: 88, force: 82, intel: 85, politics: 90, loyalty: 100, portrait: 'chen_baxian' }, // 345
  { id: 'wang_sengbian', name: '王僧辩', faction: 'nanchao', role: '都督',
    command: 85, force: 78, intel: 75, politics: 70, loyalty: 85, portrait: 'wang_sengbian' }, // 308
  { id: 'yang_kan',   name: '羊侃',   faction: 'nanchao', role: '名将',
    command: 80, force: 88, intel: 70, politics: 55, loyalty: 80, portrait: 'yang_kan' }, // 293
  { id: 'wei_rui',    name: '韦睿',   faction: 'nanchao', role: '儒将',
    command: 90, force: 65, intel: 82, politics: 75, loyalty: 88, portrait: 'wei_rui' }, // 312
  { id: 'chen_qian',  name: '陈蒨',   faction: 'nanchao', role: '文帝',
    command: 82, force: 75, intel: 80, politics: 85, loyalty: 90, portrait: 'chen_qian' }, // 322
  { id: 'yang_yaren', name: '羊鸦仁', faction: 'nanchao', role: '边将',
    command: 75, force: 82, intel: 60, politics: 50, loyalty: 75, portrait: 'yang_yaren' }, // 267
  { id: 'hou_zhen',   name: '侯瑱',   faction: 'nanchao', role: '名将',
    command: 84, force: 85, intel: 70, politics: 65, loyalty: 82, portrait: 'hou_zhen' }, // 304
  { id: 'chen_xu',    name: '陈顼',   faction: 'nanchao', role: '宣帝',
    command: 83, force: 78, intel: 78, politics: 82, loyalty: 88, portrait: 'chen_xu' }, // 321
  { id: 'hou_andu',   name: '侯安都', faction: 'nanchao', role: '猛将',
    command: 80, force: 90, intel: 60, politics: 50, loyalty: 80, portrait: 'hou_andu' }, // 280
  { id: 'zhang_zhaoda', name: '章昭达', faction: 'nanchao', role: '名将',
    command: 82, force: 84, intel: 72, politics: 60, loyalty: 82, portrait: 'zhang_zhaoda' }, // 298
  { id: 'wu_mingche', name: '吴明彻', faction: 'nanchao', role: '都督',
    command: 88, force: 75, intel: 82, politics: 70, loyalty: 85, portrait: 'wu_mingche' }, // 315
  { id: 'xiao_mohe',  name: '萧摩诃', faction: 'nanchao', role: '猛将',
    command: 82, force: 96, intel: 55, politics: 45, loyalty: 80, portrait: 'xiao_mohe' }, // 278
  { id: 'zhou_wenyu', name: '周文育', faction: 'nanchao', role: '名将',
    command: 80, force: 86, intel: 65, politics: 55, loyalty: 80, portrait: 'zhou_wenyu' }, // 286
  { id: 'shen_ke',    name: '沈恪',   faction: 'nanchao', role: '宿将',
    command: 72, force: 78, intel: 60, politics: 55, loyalty: 78, portrait: 'shen_ke' }, // 265

  // === V6.5 新增陈朝名将（3）===
  // 历史：杜僧明（字弘照，广陵人，陈霸先旧部，善骑射有勇力，破侯景水军门）
  { id: 'du_sengming', name: '杜僧明', faction: 'nanchao', role: '猛将',
    command: 82, force: 88, intel: 62, politics: 50, loyalty: 82, portrait: 'du_sengming' }, // 282
  // 历史：任忠（字奉诚，小名蛮奴，汝阴人，谲诡多计略，膂力过人善骑射，后降隋）
  { id: 'ren_zhong',  name: '任忠',   faction: 'nanchao', role: '名将',
    command: 80, force: 84, intel: 68, politics: 55, loyalty: 70, portrait: 'ren_zhong' }, // 277
  // 历史：樊毅（陈朝名将，随吴明彻北伐，后镇淮南）
  { id: 'fan_yi',     name: '樊毅',   faction: 'nanchao', role: '边将',
    command: 78, force: 82, intel: 60, politics: 52, loyalty: 78, portrait: 'fan_yi' }, // 272

  // === 北齐（13）===
  { id: 'gao_yang',   name: '高洋',   faction: 'dongwei', role: '君主',
    command: 86, force: 82, intel: 80, politics: 88, loyalty: 100, portrait: 'gao_yang' }, // 336
  { id: 'gao_huan',   name: '高欢',   faction: 'dongwei', role: '权臣',
    command: 92, force: 80, intel: 88, politics: 90, loyalty: 95, portrait: 'gao_huan' }, // 350
  { id: 'hu_luguang', name: '斛律光', faction: 'dongwei', role: '名将',
    command: 88, force: 90, intel: 72, politics: 60, loyalty: 82, portrait: 'hu_luguang' }, // 310
  { id: 'gao_aocao',  name: '高敖曹', faction: 'dongwei', role: '猛将',
    command: 78, force: 95, intel: 55, politics: 40, loyalty: 78, portrait: 'gao_aocao' }, // 268
  { id: 'murong_shaozong', name: '慕容绍宗', faction: 'dongwei', role: '名将',
    command: 86, force: 75, intel: 80, politics: 65, loyalty: 80, portrait: 'murong_shaozong' }, // 306
  { id: 'gao_changgong', name: '高长恭', faction: 'dongwei', role: '兰陵王',
    command: 85, force: 92, intel: 70, politics: 60, loyalty: 80, portrait: 'gao_changgong' }, // 307
  { id: 'duan_shao',  name: '段韶',   faction: 'dongwei', role: '谋将',
    command: 86, force: 78, intel: 82, politics: 75, loyalty: 82, portrait: 'duan_shao' }, // 321
  { id: 'gao_yan',    name: '高演',   faction: 'dongwei', role: '孝昭帝',
    command: 80, force: 76, intel: 82, politics: 86, loyalty: 85, portrait: 'gao_yan' }, // 323
  { id: 'gao_zhan',   name: '高湛',   faction: 'dongwei', role: '武成帝',
    command: 76, force: 74, intel: 70, politics: 65, loyalty: 75, portrait: 'gao_zhan' }, // 285
  { id: 'gao_xiaoyu', name: '高孝瑜', faction: 'dongwei', role: '宗室',
    command: 70, force: 65, intel: 72, politics: 70, loyalty: 75, portrait: 'gao_xiaoyu' }, // 277
  { id: 'he_shikai',  name: '和士开', faction: 'dongwei', role: '佞臣',
    command: 50, force: 45, intel: 75, politics: 78, loyalty: 60, portrait: 'he_shikai' }, // 248
  { id: 'gao_rui',    name: '高睿',   faction: 'dongwei', role: '宗室将',
    command: 78, force: 80, intel: 68, politics: 65, loyalty: 80, portrait: 'gao_rui' }, // 291
  { id: 'duan_xiaoxian', name: '段孝先', faction: 'dongwei', role: '边将',
    command: 76, force: 78, intel: 66, politics: 60, loyalty: 80, portrait: 'duan_xiaoxian' }, // 280

  // === V6.5 新增北齐名将（2）===
  // 历史：高岳（字洪略，高欢从父弟，封清河王，屡破西魏南梁）
  { id: 'gao_yue',    name: '高岳',   faction: 'dongwei', role: '宗室将',
    command: 84, force: 78, intel: 72, politics: 70, loyalty: 85, portrait: 'gao_yue' }, // 304
  // 历史：斛律羡（字丰乐，斛律光之弟，北齐边将，善驭军）
  { id: 'hu_luxian',  name: '斛律羡', faction: 'dongwei', role: '边将',
    command: 80, force: 82, intel: 65, politics: 60, loyalty: 82, portrait: 'hu_luxian' }, // 287

  // === 北周（12）===
  { id: 'yuwen_jue',  name: '宇文觉', faction: 'xiwei', role: '君主',
    command: 78, force: 75, intel: 78, politics: 85, loyalty: 100, portrait: 'yuwen_jue' }, // 316
  { id: 'yuwen_tai',  name: '宇文泰', faction: 'xiwei', role: '权臣',
    command: 90, force: 78, intel: 92, politics: 92, loyalty: 95, portrait: 'yuwen_tai' }, // 352
  { id: 'yuwen_yu',   name: '宇文毓', faction: 'xiwei', role: '明帝',
    command: 80, force: 74, intel: 85, politics: 86, loyalty: 88, portrait: 'yuwen_yu' }, // 325
  { id: 'yuwen_hu',   name: '宇文护', faction: 'xiwei', role: '权臣',
    command: 82, force: 76, intel: 85, politics: 80, loyalty: 70, portrait: 'yuwen_hu' }, // 313
  { id: 'yuwen_yong', name: '宇文邕', faction: 'xiwei', role: '武帝',
    command: 88, force: 80, intel: 85, politics: 88, loyalty: 92, portrait: 'yuwen_yong' }, // 341
  { id: 'wei_xiaokuan', name: '韦孝宽', faction: 'xiwei', role: '名将',
    command: 88, force: 70, intel: 90, politics: 70, loyalty: 85, portrait: 'wei_xiaokuan' }, // 313
  { id: 'dugu_xin',   name: '独孤信', faction: 'xiwei', role: '名将',
    command: 82, force: 80, intel: 75, politics: 78, loyalty: 82, portrait: 'dugu_xin' }, // 315
  { id: 'li_hu',      name: '李虎',   faction: 'xiwei', role: '八柱国',
    command: 80, force: 82, intel: 68, politics: 65, loyalty: 85, portrait: 'li_hu' }, // 295
  { id: 'yu_jin',     name: '于谨',   faction: 'xiwei', role: '谋将',
    command: 85, force: 72, intel: 86, politics: 78, loyalty: 85, portrait: 'yu_jin' }, // 321
  { id: 'zhao_gui',   name: '赵贵',   faction: 'xiwei', role: '柱国',
    command: 78, force: 80, intel: 65, politics: 62, loyalty: 80, portrait: 'zhao_gui' }, // 285
  { id: 'yang_zhong', name: '杨忠',   faction: 'xiwei', role: '猛将',
    command: 82, force: 88, intel: 68, politics: 60, loyalty: 82, portrait: 'yang_zhong' }, // 298
  { id: 'wang_xiong', name: '王雄',   faction: 'xiwei', role: '名将',
    command: 80, force: 84, intel: 66, politics: 58, loyalty: 80, portrait: 'wang_xiong' }, // 288

  // === V6.5 新增北周名将（4）===
  // 历史：尉迟迥（字薄居罗，宇文泰外甥，封蜀国公，后举兵讨杨坚兵败）
  { id: 'yu_chijiong', name: '尉迟迥', faction: 'xiwei', role: '蜀国公',
    command: 85, force: 82, intel: 72, politics: 70, loyalty: 82, portrait: 'yu_chijiong' }, // 309
  // 历史：李弼（字景和，北周八柱国之一，勇武有谋，马超后裔）
  { id: 'li_bi',      name: '李弼',   faction: 'xiwei', role: '八柱国',
    command: 86, force: 85, intel: 70, politics: 65, loyalty: 85, portrait: 'li_bi' }, // 306
  // 历史：贺若敦（北周名将，贺若弼之父，善骑射，屡破陈军，后以怨言自杀）
  { id: 'he_ruodun',  name: '贺若敦', faction: 'xiwei', role: '名将',
    command: 82, force: 84, intel: 68, politics: 55, loyalty: 75, portrait: 'he_ruodun' }, // 289
  // 历史：元景山（北周/隋名将，元魏宗室，从武帝伐齐，后入隋）
  { id: 'yuan_jingshan', name: '元景山', faction: 'xiwei', role: '宗室将',
    command: 80, force: 82, intel: 62, politics: 60, loyalty: 78, portrait: 'yuan_jingshan' }, // 284

  // === 后梁（3）===
  { id: 'xiao_cha',   name: '萧詧',   faction: 'hou_liang', role: '君主',
    command: 75, force: 65, intel: 80, politics: 85, loyalty: 100, portrait: 'xiao_cha' }, // 305
  { id: 'xiao_kui',   name: '萧岿',   faction: 'hou_liang', role: '明帝',
    command: 72, force: 60, intel: 78, politics: 82, loyalty: 90, portrait: 'xiao_kui' }, // 292
  { id: 'wang_cao',   name: '王操',   faction: 'hou_liang', role: '谋臣',
    command: 65, force: 55, intel: 80, politics: 82, loyalty: 85, portrait: 'wang_cao' }, // 282

  // === 王琳（3）===
  { id: 'wang_lin',   name: '王琳',   faction: 'wang_lin', role: '君主',
    command: 84, force: 86, intel: 72, politics: 70, loyalty: 100, portrait: 'wang_lin' }, // 312
  { id: 'pan_chuntuo', name: '潘纯陀', faction: 'wang_lin', role: '水军将',
    command: 74, force: 80, intel: 62, politics: 55, loyalty: 82, portrait: 'pan_chuntuo' }, // 271
  { id: 'lei_cizong', name: '雷次宗', faction: 'wang_lin', role: '谋士',
    command: 60, force: 50, intel: 82, politics: 75, loyalty: 80, portrait: 'lei_cizong' }, // 267

  // === 萧庄（1）===
  { id: 'xiao_zhuang', name: '萧庄', faction: 'xiao_zhuang', role: '君主',
    command: 70, force: 65, intel: 72, politics: 78, loyalty: 100, portrait: 'xiao_zhuang' }, // 285

  // === 在野（5）===
  { id: 'chen_qingzhi', name: '陈庆之', faction: null, role: '在野',
    command: 85, force: 60, intel: 78, politics: 55, loyalty: 60, portrait: 'chen_qingzhi' }, // 278
  { id: 'tan_daoji',  name: '檀道济',  faction: null, role: '在野',
    command: 86, force: 82, intel: 70, politics: 60, loyalty: 60, portrait: 'tan_daoji' }, // 298
  { id: 'cao_jingzong', name: '曹景宗', faction: null, role: '在野',
    command: 78, force: 85, intel: 60, politics: 45, loyalty: 55, portrait: 'cao_jingzong' }, // 268
  // 历史：韦夐（字远隐，韦孝宽之兄，北周名士隐士，屡辞不仕，号"逍遥公"）
  { id: 'wei_xuan',   name: '韦夐',   faction: null, role: '隐士',
    command: 40, force: 30, intel: 90, politics: 85, loyalty: 50, portrait: 'wei_xuan' }, // 245
  // 杨坚：隋公代周事件登场，初始在野，事件后归入北周
  { id: 'yang_jian',  name: '杨坚',   faction: null, role: '隋公',
    command: 90, force: 82, intel: 90, politics: 95, loyalty: 70, portrait: 'yang_jian' }  // 357
];

// ---------- V3.0 新武将技能映射 ----------
// skills.js 只读，无法在其中注册新技能。此处将新武将绑定到「已有技能 id」，
// game.js 初始化时合并到武将 skills 字段，并在战斗加成计算中并入。
// 复用的技能 id 均来自 skills.js 的 SKILLS 表，保证 getSkill() 可解析。
export const NEW_GENERAL_SKILLS = {
  // 南陈
  chen_xu:       ['jingtu_tuzhi'],
  hou_andu:      ['mengjiang'],
  zhang_zhaoda:  ['bianzhen_hanjiang'],
  wu_mingche:    ['hanshan_yanji'],
  xiao_mohe:     ['mengjiang'],
  zhou_wenyu:    ['xiaoyong_shanzhan'],
  shen_ke:       ['bianzhen_hanjiang'],
  // 北齐
  gao_yang:      ['xiaoxiong'],
  gao_yan:       ['mouliao_baichu'],
  gao_zhan:      ['xiaoxiong'],
  gao_xiaoyu:    ['rujiang'],
  he_shikai:     [],
  gao_rui:       ['bazhuguo_zhiyong'],
  duan_xiaoxian: ['mouliao_baichu'],
  // 北周
  yuwen_jue:     ['guanlong_jituan'],
  yuwen_yu:      ['jingtu_tuzhi'],
  yuwen_hu:      ['xiaoxiong'],
  yu_jin:        ['mouliao_baichu'],
  zhao_gui:      ['bazhuguo_zhiyong'],
  yang_zhong:    ['mengjiang'],
  wang_xiong:    ['bazhuguo_zhiyong'],
  // 后梁
  xiao_cha:      ['rujiang'],
  xiao_kui:      ['jingtu_tuzhi'],
  wang_cao:      ['rujiang'],
  // 王琳
  wang_lin:      ['hanshan_yanji'],
  pan_chuntuo:   ['bianzhen_hanjiang'],
  lei_cizong:    ['rujiang'],
  // 萧庄
  xiao_zhuang:   ['jingtu_tuzhi'],
  // ---- V6.5 新增武将技能映射 ----
  // 陈朝
  du_sengming:   ['mengjiang'],
  ren_zhong:     ['hanshan_yanji'],
  fan_yi:        ['bianzhen_hanjiang'],
  // 北齐
  gao_yue:       ['mouliao_baichu'],
  hu_luxian:     ['luodiao_dudu'],
  // 北周
  yu_chijiong:   ['guanlong_jituan'],
  li_bi:         ['bazhuguo_zhiyong'],
  he_ruodun:     ['mengjiang'],
  yuan_jingshan: ['xiaoxiong'],
  // 在野隐士
  wei_xuan:      ['rujiang']
};

// ---------- 事件表 ----------
export const EVENTS = [
  {
    id: 'drought', name: '旱灾', illustration: 'drought',
    description: '大旱千里，颗粒无收。百姓困苦，民心浮动。',
    options: [
      { text: '开仓放粮（耗粮草2000）', effect: { food: -2000, morale: +15, money: 0 } },
      { text: '听之任之', effect: { food: -3000, morale: -20, money: 0 } }
    ]
  },
  {
    id: 'plague', name: '瘟疫', illustration: 'plague',
    description: '瘟疫蔓延城中，百姓死伤枕藉。',
    options: [
      { text: '延医救治（耗金500）', effect: { money: -500, pop: -2000, morale: +5 } },
      { text: '隔离疫区', effect: { pop: -8000, morale: -15 } }
    ]
  },
  {
    id: 'harvest', name: '丰收', illustration: 'harvest',
    description: '风调雨顺，五谷丰登！百姓欢腾。',
    options: [
      { text: '庆贺丰收', effect: { food: +5000, morale: +10 } }
    ]
  },
  {
    id: 'barbarian_invasion', name: '蛮族入侵', illustration: 'barbarian_invasion',
    description: '北方蛮族南下劫掠，边境告急！',
    options: [
      { text: '出兵抵御（耗金300）', effect: { money: -300, armyLoss: 1000, morale: +5 } },
      { text: '议和进贡（耗金800）', effect: { money: -800, morale: -5 } }
    ]
  },
  {
    id: 'rebellion', name: '地方叛乱', illustration: 'rebellion',
    description: '地方豪族聚众叛乱，城池动摇！',
    options: [
      { text: '派兵镇压（耗兵力2000）', effect: { armyLoss: 2000, morale: +5 } },
      { text: '招安安抚（耗金600）', effect: { money: -600, morale: -5 } }
    ]
  },
  {
    id: 'flood', name: '洪水', illustration: 'drought',
    description: '连日暴雨，江水泛滥，良田被淹。',
    options: [
      { text: '赈灾修堤（耗金400）', effect: { money: -400, agri: -5, morale: +5 } },
      { text: '不予理会', effect: { agri: -15, morale: -15 } }
    ]
  },
  {
    id: 'refugees', name: '流民来投', illustration: 'harvest',
    description: '周边州郡流民辗转来投，人口增长。',
    options: [
      { text: '妥善安置', effect: { pop: +8000, food: -1000, morale: +5 } }
    ]
  },
  {
    id: 'talent_appears', name: '贤士出山', illustration: 'harvest',
    description: '有贤士听闻主公仁德，前来投奔！',
    options: [
      { text: '欣然接纳', effect: { recruitRandom: true } }
    ]
  },
  // ---------- V2.5 新事件 ----------
  {
    id: 'barbarian_envoys', name: '蛮族遣使', illustration: 'barbarian_invasion',
    description: '边境蛮族遣使前来，愿与天朝通好。或抚或剿，皆在主公一念。',
    options: [
      { text: '厚待来使（与诸蛮族关系+15）', effect: { barbarianRel: 15, money: -200 } },
      { text: '逐其使者', effect: { barbarianRel: -10 } }
    ]
  },
  {
    id: 'spy_master', name: '异人来投', illustration: 'harvest',
    description: '有异人自隐身民间，精通刺探离间之术，欲为主公效犬马之劳。',
    options: [
      { text: '以国士待之', effect: { spyMaster: true } }
    ]
  },

  // ---------- V4.5 新增随机事件（自然灾害/社会/军事/政治/特殊） ----------
  {
    id: 'earthquake', name: '地震', illustration: 'plague',
    description: '地动山摇，屋舍倾颓，城墙开裂，百姓伤亡惨重。',
    options: [
      { text: '赈灾修城（耗金600）', effect: { money: -600, pop: -3000, morale: +8 } },
      { text: '仅拨薄赈', effect: { pop: -9000, morale: -12 } }
    ]
  },
  {
    id: 'locust_swarm', name: '蝗灾', illustration: 'drought',
    description: '蝗蔽天日，遮月无光，田亩禾稼尽被吞噬，秋收无望。',
    options: [
      { text: '募民捕蝗（耗金300，减损）', effect: { money: -300, food: -1500 } },
      { text: '束手无策', effect: { food: -4500, morale: -10 } }
    ]
  },
  {
    id: 'early_frost', name: '早霜', illustration: 'drought',
    description: '秋初骤降严霜，晚熟作物尽皆冻死，民心惶惶。',
    options: [
      { text: '开仓减租（耗粮1500）', effect: { food: -1500, morale: +10 } },
      { text: '照常征收', effect: { food: -2500, morale: -12 } }
    ]
  },
  {
    id: 'artisans_flock', name: '工匠来投', illustration: 'harvest',
    description: '蜀地、关中工匠辗转而来，善冶铸、营缮、造弩。百工踊跃，愿效力麾下。',
    options: [
      { text: '厚待安置（耗金400，商业兴旺）', effect: { money: -400, comm: 8, prosperity: 6 } }
    ]
  },
  {
    id: 'merchant_caravan', name: '商队到来', illustration: 'harvest',
    description: '胡汉商队自西域、江南接踵而至，珍宝香料、战马皮货充盈市面。',
    options: [
      { text: '开市通商（税收大增）', effect: { money: 1200, comm: 5 } },
      { text: '重税盘剥', effect: { money: 500, comm: -6, morale: -5 } }
    ]
  },
  {
    id: 'elite_deserters', name: '逃兵', illustration: 'rebellion',
    description: '边军久戍无归，夜半结队逃亡，沿途劫掠，边郡骚动。',
    options: [
      { text: '派兵追击（损兵500）', effect: { armyLoss: 500, morale: -3 } },
      { text: '招抚还乡', effect: { money: -300, armyLoss: 1200, morale: +2 } }
    ]
  },
  {
    id: 'mutiny', name: '士兵哗变', illustration: 'rebellion',
    description: '营中积怨已久，士卒鼓噪哗变，欲杀将校以出怨气！',
    options: [
      { text: '主将弹压（损兵1500）', effect: { armyLoss: 1500, factionMorale: -5 } },
      { text: '出金安抚（耗金700）', effect: { money: -700, morale: +3 } }
    ]
  },
  {
    id: 'captured_weapons', name: '缴获军械', illustration: 'harvest',
    description: '斥候破山贼寨，缴获大量甲仗、弓弩、粮草，满载而归。',
    options: [
      { text: '收入库府', effect: { money: 800, food: 1200 } }
    ]
  },
  {
    id: 'prisoner_escape', name: '俘虏逃脱', illustration: 'rebellion',
    description: '羁押的敌国将校越狱逃走，边庭戒备空虚，恐生后患。',
    options: [
      { text: '加强戒备（耗金200）', effect: { money: -200, morale: -2 } },
      { text: '不以为意', effect: { factionMorale: -6 } }
    ]
  },
  {
    id: 'peasant_revolt', name: '农民起义', illustration: 'rebellion',
    description: '饥民揭竿为旗，劫掠乡邑，州郡告警！',
    options: [
      { text: '出兵剿抚（损兵2500）', effect: { armyLoss: 2500, morale: +5 } },
      { text: '遣使招抚（耗金500）', effect: { money: -500, morale: -8 } }
    ]
  },
  {
    id: 'factionalism', name: '大臣结党', illustration: 'plague',
    description: '朝中大臣暗中结党，互相倾轧，政令多有壅蔽。',
    options: [
      { text: '下诏申斥（众将忠诚-5）', effect: { generalLoyalty: { amt: -5 }, factionMorale: -3 } },
      { text: '分化制衡（耗金400）', effect: { money: -400, generalLoyalty: { amt: 3 } } }
    ]
  },
  {
    id: 'ancient_ruins', name: '发现古迹', illustration: 'harvest',
    description: '民夫掘地得前朝古碑断碣，文字斑驳，先贤遗泽，远近传颂。',
    options: [
      { text: '修葺纪念（耗金300，繁荣大增）', effect: { money: -300, prosperity: 10, morale: +8 } }
    ]
  },
  {
    id: 'buried_treasure', name: '挖到宝藏', illustration: 'harvest',
    description: '营中掘土，竟得前朝窖藏金帛，金光灿灿！',
    options: [
      { text: '充入库府', effect: { money: 2000 } },
      { text: '分赏三军（民心+10）', effect: { money: 800, morale: 10 } }
    ]
  },

  // ---------- V5.5 新增随机事件（天文/文化/军事/外交/特殊 共10个） ----------
  {
    id: 'comet_sky', name: '彗星袭月', illustration: 'plague',
    description: '夜有彗星长数丈，光芒竟天，扫过紫微。星官奏曰：除旧布新之象。朝野议论纷纷。',
    options: [
      { text: '下诏罪己（民心+8，耗金300）', effect: { money: -300, morale: 8 } },
      { text: '命太史占之（民心-5，耗金200）', effect: { money: -200, morale: -5 } }
    ]
  },
  {
    id: 'solar_eclipse', name: '日食', illustration: 'plague',
    description: '日食既，昼晦如夜，星见。百姓惊慌，以为上天示警。',
    options: [
      { text: '大赦天下以应天变（民心+12）', effect: { morale: 12, money: -400 } },
      { text: '安抚百姓（民心+5）', effect: { morale: 5 } }
    ]
  },
  {
    id: 'meteor_shower', name: '流星雨', illustration: 'harvest',
    description: '夜流星数万，西南流转，光烛天地。老兵曰：此破军之象，勇者胜。',
    options: [
      { text: '飨军誓师（军心+10）', effect: { armyMorale: 10, money: -300 } },
      { text: '置之不理（军心-3）', effect: { armyMorale: -3 } }
    ]
  },
  {
    id: 'build_temple', name: '修建佛寺', illustration: 'harvest',
    description: '有高僧自西域来，乞建佛寺以祈福。或倡或阻，皆在主公。',
    options: [
      { text: '敕建大寺（耗金800，民心+10，繁荣+5）', effect: { money: -800, morale: 10, prosperity: 5 } },
      { text: '劝阻靡费（繁荣-3，民心-3）', effect: { prosperity: -3, morale: -3 } }
    ]
  },
  {
    id: 'grotto_caves', name: '开凿石窟', illustration: 'harvest',
    description: '于山崖开窟造像，以为国祈福。工匠云集，千载之下尤见庄严。',
    options: [
      { text: '开山造像（耗金1200，繁荣+12，民心+6）', effect: { money: -1200, prosperity: 12, morale: 6 } }
    ]
  },
  {
    id: 'compile_history', name: '编修史书', illustration: 'harvest',
    description: '命史官起居注，集国史。笔削之间，褒贬当世。',
    options: [
      { text: '开馆修史（耗金600，政治提升，繁荣+8）', effect: { money: -600, prosperity: 8, generalPolitics: { amt: 3 } } }
    ]
  },
  {
    id: 'armory_explode', name: '军械库爆炸', illustration: 'rebellion',
    description: '城中军械库夜半爆炸，火光冲天，甲仗弓矢损毁无数！',
    options: [
      { text: '彻查工匠（耗金500，损兵1000）', effect: { money: -500, armyLoss: 1000, morale: -5 } },
      { text: '压下不报（军心-8）', effect: { armyMorale: -8, factionMorale: -4 } }
    ]
  },
  {
    id: 'horse_plague', name: '战马瘟疫', illustration: 'plague',
    description: '军中战马染疫，相继倒毙，骑兵战力大损！',
    options: [
      { text: '隔离病马（耗金700，损马3000）', effect: { money: -700, armyLoss: 3000 } },
      { text: '仓促购马（耗金1500）', effect: { money: -1500 } }
    ]
  },
  {
    id: 'envoy_visit', name: '邻国使者来访', illustration: 'harvest',
    description: '邻国遣使修好，献上方物。或接或拒，皆影响邦交。',
    options: [
      { text: '厚待来使（金钱-300，众将忠诚+5）', effect: { money: -300, generalLoyalty: { amt: 5 } } },
      { text: '仅薄礼相待（无得失）', effect: {} }
    ]
  },
  {
    id: 'swordsman_join', name: '侠客投奔', illustration: 'harvest',
    description: '有游侠仗剑来投，武艺高强，行踪飘忽。或可为将，或为斥候。',
    options: [
      { text: '以礼待之（招募一在野将）', effect: { recruitRandom: true } }
    ]
  },

  // ---------- V6.0 宗教文化事件 ----------
  {
    id: 'monk_visit', name: '高僧来访', illustration: 'harvest',
    description: '有高僧自西域来，登坛讲经，万众聆听。城中善男信女云集。',
    options: [
      { text: '虔诚迎奉（耗金300，文化+30，民心+10）', effect: { money: -300, culture: 30, morale: 10 } },
      { text: '以礼待之（文化+15，民心+5）', effect: { culture: 15, morale: 5 } }
    ]
  },
  {
    id: 'daoist_alchemy', name: '道士炼丹', illustration: 'harvest',
    description: '有道士居山间，炉火九转，炼成金丹。或献丹求试。',
    options: [
      { text: '取丹试服（耗金500，科技+20）', effect: { money: -500, tech: 20 } },
      { text: '厚赏道士（科技+10，文化+10）', effect: { tech: 10, culture: 10 } }
    ]
  },
  {
    id: 'grotto_carve_event', name: '开凿石窟', illustration: 'harvest',
    description: '于山崖开窟造像，以为国祈福。工匠云集，千载之下尤见庄严。',
    options: [
      { text: '开山造像（耗金1500，文化+80，繁荣+10）', effect: { money: -1500, culture: 80, prosperity: 10 } },
      { text: '量力而行（文化+30，繁荣+5）', effect: { culture: 30, prosperity: 5 } }
    ]
  }
];

// ---------- 历史事件链（V3.0 扩充至约20个，按时间线触发） ----------
// minTurn 以「开局=550年，1回合≈1年」折算。事件含前置条件（回合/势力/武将存活）。
// 新增 effect 类型：generalBuff{id,attr,amt} / generalDeath{id} / generalLoyalty{id,amt} /
//                  factionMorale{amt} / recruitGeneral（已有）/ massBattle（已有）
export const HISTORICAL_EVENTS = [
  // ---- 开局·东西争锋（534~547 背景，转入游戏后以战例形式重现） ----
  {
    id: 'liuzhen', name: '六镇起义', illustration: 'rebellion',
    minTurn: 2, factions: ['dongwei', 'xiwei'],
    description: '北方六镇戍卒哗变虽已渐平，余部仍啸聚山林。收揽骁勇，或成霸业之基。',
    options: [
      { text: '收编余部（损兵2000，募一将）', effect: { armyLoss: 2000, morale: +5, recruitRandom: true } },
      { text: '羁縻招安（耗金800）', effect: { money: -800, morale: -5, recruitRandom: true } }
    ]
  },
  {
    id: 'shayuan', name: '沙苑之战', illustration: 'cavalry_charge',
    minTurn: 3, factions: ['xiwei', 'dongwei'],
    description: '东西两军会于沙苑。宇文泰以轻兵伪遁，诱敌深入，芦苇荡中伏兵四起！',
    options: [
      { text: '设伏歼敌（西魏大胜，自动大战）', effect: { massBattle: true, morale: +10 } }
    ]
  },
  {
    id: 'heqiao', name: '河桥之战', illustration: 'cavalry_charge',
    minTurn: 4, factions: ['dongwei', 'xiwei'],
    description: '河桥两岸尸横遍野，两军旗鼓相当。此战胜负难料，唯勇者胜。',
    options: [
      { text: '倾国相争（自动大战）', effect: { massBattle: true } }
    ]
  },
  {
    id: 'yubi_siege', name: '玉璧围城', illustration: 'city_siege',
    minTurn: 6, factions: ['xiwei'],
    description: '北齐大军围玉璧数十日。韦孝宽随机应变，城中矢石俱尽而守意愈坚。',
    options: [
      { text: '全城死守（守城buff两回合）', effect: { garrisonBuff: true, morale: +10 } }
    ]
  },
  {
    id: 'gaohuan_die', name: '高欢病逝', illustration: 'plague',
    minTurn: 8, factions: ['dongwei'],
    description: '玉璧城下积愤成疾，神武皇帝高欢薨于晋阳。国丧期间人心浮动。',
    options: [
      { text: '悲诏临朝（主力将属性-5，士气-10）', effect: { generalDebuff: { id: 'gao_huan', amt: 5 }, factionMorale: -10 } },
      { text: '秘不发丧（稳住军心）', effect: { money: -500, factionMorale: -5 } }
    ]
  },

  // ---- 侯景之乱（南朝剧变） ----
  {
    id: 'hou_jing', name: '侯景之乱', illustration: 'rebellion',
    minTurn: 3, faction: 'nanchao',
    description: '侯景据寿阳举兵反，渡江围台城，江东涂炭！',
    options: [
      { text: '全力勤王（损兵4000）', effect: { money: -1000, armyLoss: 4000, morale: -10 } },
      { text: '坐观成败', effect: { shouyang_rebel: true, morale: -20 } }
    ]
  },
  {
    id: 'houjing_continue', name: '台城之围', illustration: 'rebellion',
    minTurn: 5, faction: 'nanchao',
    condition: (game) => {
      const c = game.cities.get('shouyang');
      return c && c.owner === null;
    },
    description: '台城被围经年，粮尽援绝。陈霸先自京口起兵，星夜赴援！',
    options: [
      { text: '率部勤王（损兵3000，收复失地）', effect: { armyLoss: 3000, morale: -5, recaptureJiankang: true } },
      { text: '割据自保（耗金1500）', effect: { money: -1500, morale: -15 } }
    ]
  },

  // ---- 三国禅代（550~557） ----
  {
    id: 'qi_dynasty', name: '高洋建齐', illustration: 'harvest',
    minTurn: 1, faction: 'dongwei',
    description: '高洋受魏禅，即皇帝位于邺，改元天保。齐运初启，群臣恭贺。',
    options: [
      { text: '大赦天下（民心+15）', effect: { factionMorale: 15, money: -800 } }
    ]
  },
  {
    id: 'jiangling_fall', name: '西魏破江陵', illustration: 'city_siege',
    minTurn: 6, factions: ['xiwei', 'hou_liang'],
    description: '于谨、杨忠破江陵，杀梁元帝。梁宗室萧詧遂据江陵，附庸于周。',
    options: [
      { text: '因势利导（后梁藩屏于我）', effect: { factionMorale: 8, money: +600 } }
    ]
  },
  {
    id: 'chen_found', name: '陈霸先建陈', illustration: 'harvest',
    minTurn: 7, faction: 'nanchao',
    description: '陈霸先受梁禅，国号陈，改元永定。江南再造，人心思定。',
    options: [
      { text: '与民更始（民心+15，商业+10）', effect: { factionMorale: 15, comm: 10 } }
    ]
  },
  {
    id: 'zhou_found', name: '宇文觉建周', illustration: 'harvest',
    minTurn: 7, faction: 'xiwei',
    description: '宇文觉受魏禅，国号周，改元闵帝。关陇本位，府兵始盛。',
    options: [
      { text: '行府兵制（步兵buff，民心+10）', effect: { factionMorale: 10, garrisonBuff: true } }
    ]
  },

  // ---- 中后期鏖战 ----
  {
    id: 'mangshan', name: '邙山大战', illustration: 'cavalry_charge',
    minTurn: 12, factions: ['dongwei', 'xiwei'],
    description: '周齐大军会战于邙山，戈甲照野，鼓角闻数十里！',
    options: [
      { text: '率军亲征（自动大战）', effect: { massBattle: true } }
    ]
  },
  {
    id: 'lanling_ruzhen', name: '兰陵王入阵', illustration: 'cavalry_charge',
    minTurn: 13, factions: ['dongwei'],
    condition: (game) => {
      const g = game.generals.get('gao_changgong');
      return g && g.faction === game.playerFaction;
    },
    description: '兰陵王高长恭戴面具，率五百骑突入周阵，至金墉城下，遂解金墉之围。军士共歌《兰陵王入阵曲》。',
    options: [
      { text: '重赏三军（高长恭属性+8，士气+10）', effect: { generalBuff: { id: 'gao_changgong', amt: 8 }, factionMorale: 10, money: -500 } }
    ]
  },
  {
    id: 'miefo_yundong', name: '周武灭佛', illustration: 'harvest',
    minTurn: 18, faction: 'xiwei',
    description: '武帝宇文邕断佛道二教，毁经像，僧尼还俗，遂得三百万户编入户籍。',
    options: [
      { text: '下诏灭佛（金钱+1500，兵源大增）', effect: { money: 1500, pop: +20000, factionMorale: -5 } },
      { text: '尊崇释教（民心+10，收入-500）', effect: { factionMorale: 10, money: -500 } }
    ]
  },
  {
    id: 'huluguang_death', name: '自毁长城', illustration: 'plague',
    minTurn: 22, faction: 'dongwei',
    description: '齐主猜忌，赐死落雕都督斛律光。周人闻之大喜，为之大赦。',
    options: [
      { text: '见谗而诛（斛律光死，齐战力大损）', effect: { generalDeath: 'hu_luguang', factionMorale: -15 } },
      { text: '力保忠良（耗金1000，众将心慰）', effect: { money: -1000, generalLoyalty: { amt: 10 } } }
    ]
  },
  {
    id: 'zhou_fa_qi', name: '周师伐齐', illustration: 'cavalry_charge',
    minTurn: 25, faction: 'xiwei',
    description: '周武帝亲统六师，东出潼关，直取晋州。齐师屡败。',
    options: [
      { text: '誓师东出（士气+15，自动大战）', effect: { massBattle: true, factionMorale: 15 } }
    ]
  },
  {
    id: 'mie_beiqi', name: '北周灭齐', illustration: 'cavalry_charge',
    minTurn: 27, faction: 'xiwei',
    description: '周师入邺，执齐主高纬以归。北方复归一统，周据有河北。',
    options: [
      { text: '抚定河北（金钱+2000，民心+10）', effect: { money: 2000, factionMorale: 10 } }
    ]
  },
  {
    id: 'xiaowen_reform', name: '汉化改制', illustration: 'harvest',
    minTurn: 15, factions: ['dongwei', 'xiwei'],
    condition: (game) => {
      const c = game.cities.get('luoyang');
      return c && c.owner === game.playerFaction;
    },
    description: '都洛已久，汉风渐染。或行汉化以兴文治，或守旧俗以安军心。',
    options: [
      { text: '推行汉化（繁荣+10 民心+15，军心-10）', effect: { prosperity: 10, morale: 15, armyMorale: -10 } },
      { text: '固守旧俗（军心+10，繁荣-10）', effect: { prosperity: -10, morale: -5, armyMorale: 10 } }
    ]
  },

  // ---- 终局前置（隋代周→隋灭陈） ----
  {
    id: 'yangjian_dynasty', name: '隋公代周', illustration: 'harvest',
    minTurn: 30, factions: ['xiwei'],
    description: '随国公杨坚受周禅，国号隋，改元开皇。天下瞻望，归于一统。',
    options: [
      { text: '受禅建隋（杨坚加入，全兵buff）', effect: { recruitGeneral: 'yang_jian', factionMorale: 15 } }
    ]
  },
  {
    id: 'sui_mie_chen', name: '隋灭陈', illustration: 'cavalry_charge',
    minTurn: 38, factions: ['xiwei', 'nanchao'],
    description: '韩擒虎自横江夜渡，王世献白下。金陵王气，黯然收焉——此为天下一统之先声。',
    options: [
      { text: '顺天应人（触发结局检测）', effect: { massBattle: true, factionMorale: 10 } }
    ]
  },

  // ---- V4.5 新增历史事件（重现前朝大战与中期政争） ----
  {
    id: 'heyin', name: '河阴之变', illustration: 'plague',
    minTurn: 1, factions: ['dongwei', 'xiwei'],
    description: '尔朱荣河阴屠朝，百官涂地，元氏为之一空。北朝士人或死或散，纲纪荡然。收揽遗逸，可网罗遗贤。',
    options: [
      { text: '寻访遗贤（招募一将）', effect: { recruitRandom: true, factionMorale: 5 } },
      { text: '坐观成败', effect: { money: -200, factionMorale: -5 } }
    ]
  },
  {
    id: 'zhongli', name: '钟离之战', illustration: 'river_battle',
    minTurn: 2, factions: ['nanchao', 'dongwei'],
    description: '邵阳洲上，魏军数十万围钟离。韦睿、曹景宗风雨兼程，火舰焚桥，魏师大溃，淮水为之不流！',
    options: [
      { text: '重演钟离大捷（自动大战）', effect: { massBattle: true, factionMorale: 10 } }
    ]
  },
  {
    id: 'qingzhi_expedition', name: '陈庆之北伐', illustration: 'cavalry_charge',
    minTurn: 2, faction: 'nanchao',
    description: '陈庆之率七千白袍军自铚县北伐，十四旬平三十二城，四十七战所向克捷，洛阳童谣曰：名师大将莫自牢，千兵万马避白袍！',
    options: [
      { text: '招募白袍统帅（陈庆之加入）', effect: { recruitGeneral: 'chen_qingzhi', factionMorale: 12 } },
      { text: '坐失良机', effect: { factionMorale: -5 } }
    ]
  },
  {
    id: 'gaojia_coup', name: '高氏内乱', illustration: 'plague',
    minTurn: 10, faction: 'dongwei',
    description: '北齐宗室相残，诸王疑惧，朝局动荡。或安宗社，或任其自溃。',
    options: [
      { text: '调和宗室（众将忠诚+8）', effect: { money: -600, generalLoyalty: { amt: 8 } } },
      { text: '任其相图（宗室将属性-5）', effect: { generalDebuff: { id: 'gao_rui', amt: 5 }, factionMorale: -8 } }
    ]
  },
  {
    id: 'chenxu_north', name: '太建北伐', illustration: 'cavalry_charge',
    minTurn: 20, faction: 'nanchao',
    description: '陈宣帝遣吴明彻北伐，兵锋直指吕梁，收复淮南。然师老于外，胜败之间系于一战。',
    options: [
      { text: '大举北伐（自动大战，损兵3000）', effect: { massBattle: true, armyLoss: 3000, factionMorale: 10 } },
      { text: '固守江左（耗金500）', effect: { money: -500, factionMorale: -3 } }
    ]
  },

  // ---- V5.5 新增历史事件（北魏分裂/高欢/宇文泰/陈霸先/杨广灭陈） ----
  {
    id: 'we_division', name: '魏分东西', illustration: 'plague',
    minTurn: 1, factions: ['dongwei', 'xiwei'],
    description: '高欢晋阳起兵，奉孝武帝于长安；孝武西奔，高欢更立孝静帝，迁都于邺。自此魏分东西，虎争鹿走。',
    options: [
      { text: '挟天子以令诸侯（民心+10，众将忠诚+5）', effect: { factionMorale: 10, generalLoyalty: { amt: 5 } } },
      { text: '奉迎车驾（耗金500，金钱+800）', effect: { money: 800, factionMorale: 5 } }
    ]
  },
  {
    id: 'hanling_battle', name: '韩陵之战', illustration: 'cavalry_charge',
    minTurn: 2, factions: ['dongwei'],
    description: '高欢以不足三万之众，于韩陵山设圆阵，连牛驴以塞归路，大破尔朱氏二十万大军！自此霸业基成。',
    options: [
      { text: '重演韩陵大捷（自动大战，主力将属性+5）', effect: { massBattle: true, generalBuff: { id: 'gao_huan', amt: 5 } } }
    ]
  },
  {
    id: 'xiaoguan_battle', name: '小关之战', illustration: 'cavalry_charge',
    minTurn: 3, factions: ['xiwei'],
    description: '东魏窦泰率众扑潼关，宇文泰潜军出小关，掩其不备，窦泰自缢。关西遂安。',
    options: [
      { text: '重演小关破敌（自动大战，民心+8）', effect: { massBattle: true, factionMorale: 8 } }
    ]
  },
  {
    id: 'chen_jian_chen', name: '陈霸先建陈', illustration: 'harvest',
    minTurn: 6, faction: 'nanchao',
    description: '侯景乱后，江南残破。陈霸先一战却齐，再定京邑，遂受梁禅，国号陈，改元永定。江南再造，百废待兴。',
    options: [
      { text: '与民更始（民心+15，商业+10，人口+10000）', effect: { factionMorale: 15, comm: 10, pop: 10000 } },
      { text: '大行封赏（众将忠诚+10，耗金1000）', effect: { money: -1000, generalLoyalty: { amt: 10 } } }
    ]
  },
  {
    id: 'yang_gong_mie_chen', name: '杨广灭陈', illustration: 'cavalry_charge',
    minTurn: 30, factions: ['xiwei'],
    condition: (game) => {
      // 北方已统一（隋），且南陈仍在
      const nanCities = game.getFactionCities('nanchao');
      return nanCities.length > 0;
    },
    description: '晋王杨广节度九十路总管，五十一万大军伐陈。韩擒虎夜渡采石，王世献入白下。王濬楼船下益州，金陵王气黯然收。',
    options: [
      { text: '顺天应人（自动大战，民心+15，触发统一结局检测）', effect: { massBattle: true, factionMorale: 15 } },
      { text: '缓师抚民（耗金2000，民心+5）', effect: { money: -2000, factionMorale: 5 } }
    ]
  }
];

// ============================================================
// V2.5 — 关隘要塞
// ============================================================
// 每个关隘扼守 cityA <-> cityB 之间的行军要道；
// built=false 时为未建造状态；建造后阻塞该段行军，敌军须先攻关隘。
// 平衡：defense ∈ [180, 280]，不超过 300（硬性上限）。
export const PASSES = [
  { id: 'hulao',     name: '虎牢关', cityA: 'luoyang',  cityB: 'shouyang',  terrain: 'plain',
    locationCity: 'luoyang',  defense: 200, desc: '洛阳东门户，扼守中原平原要道' },
  { id: 'hanguguan', name: '函谷关', cityA: 'changan',  cityB: 'luoyang',   terrain: 'mountain',
    locationCity: 'changan',  defense: 250, desc: '长安东方门户，崤山险塞' },
  { id: 'jiange',    name: '剑阁',   cityA: 'chengdu',  cityB: 'tianshui',  terrain: 'mountain',
    locationCity: 'chengdu',  defense: 280, desc: '蜀北咽喉，一夫当关万夫莫开' },
  { id: 'xiaoguan',  name: '萧关',   cityA: 'changan',  cityB: 'pingcheng', terrain: 'mountain',
    locationCity: 'changan',  defense: 220, desc: '长安西北屏障，防御胡骑南下' },
  { id: 'juyong',    name: '居庸关', cityA: 'youzhou',  cityB: 'pingcheng', terrain: 'mountain',
    locationCity: 'youzhou',  defense: 230, desc: '幽州北门锁钥，护卫燕山之南' },
  { id: 'caishiji',  name: '采石矶', cityA: 'jiankang', cityB: 'jiangling', terrain: 'river',
    locationCity: 'jiankang', defense: 180, desc: '建康西面江防要冲，扼守采石渡口' }
];
// 建造成本：1000 金 + 500 粮（"工匠"折算），工期 2 回合
export const PASS_BUILD_COST_MONEY = 1000;
export const PASS_BUILD_COST_FOOD = 500;
export const PASS_BUILD_TURNS = 2;
// 攻关隘：攻方战力 -20%；关隘守军 = defense × 10（防御值180~280 → 驻军1800~2800）
export const PASS_ATTACKER_PENALTY = 0.20;
export const PASS_GARRISON_PER_DEFENSE = 10;

// ============================================================
// V2.5 — 蛮族部落
// ============================================================
// anchorCity：蛮族与之相邻的己方城市（攻击/贸易以此为基地）
// 平衡：troops ∈ [8000, 15000]，不超过 20000（硬性上限）。
export const BARBARIAN_TRIBES = [
  { id: 'ruoran',    name: '柔然',   anchorCity: 'pingcheng', troops: 15000, relation: -10,
    specialty: '战马', unitType: 'cavalry', desc: '漠北霸主，控弦之士数十万，来去如风' },
  { id: 'tujue',     name: '突厥',   anchorCity: 'guzang',    troops: 12000, relation: -10,
    specialty: '战马', unitType: 'cavalry', desc: '西北草原雄强，铁骑剽悍善战' },
  { id: 'tuyuhun',   name: '吐谷浑', anchorCity: 'tianshui',  troops: 10000, relation: 0,
    specialty: '药材', unitType: 'archer',  desc: '羌胡混血，骑射皆精，逐水草而居' },
  { id: 'shanyue',   name: '山越',   anchorCity: 'guangzhou', troops: 8000,  relation: 0,
    specialty: '皮革', unitType: 'infantry', desc: '岭南密林劲旅，登山越涧如履平地' },
  { id: 'gaogouli',  name: '高句丽', anchorCity: 'youzhou',   troops: 11000, relation: -10,
    specialty: '皮革', unitType: 'mixed',    desc: '东北边隅强藩，城坚卒悍，屡犯边塞' }
];
// 蛮族数值公式
export const BARBARIAN_ATTACK_LOOT = 0.6;    // 战胜蛮族：缴获金钱 ≈ 蛮族兵力 ×0.6
export const BARBARIAN_RECRUIT_COST = 2000;  // 招安消耗金钱
export const BARBARIAN_RECRUIT_REL_MIN = 30; // 招安所需关系 ≥ 30
export const BARBARIAN_VASSAL_TRIBUTE = 300; // 附庸每回合进贡金钱
export const BARBARIAN_TRADE_COST = 500;     // 每次贸易花费金钱

// ============================================================
// V2.5 — 谍报 / 联姻 / 人质 平衡常量
// ============================================================
// 谍报：费用按任务分档；成功率公式见 espionage.js（硬上限 80%）
export const SPY_COST = { intel: 500, sabotage: 1200, defect: 2000 };
export const SPY_TURNS = 1;                 // 执行耗时
export const SPY_SUCCESS_CAP = 0.80;        // 成功率硬上限 80%
// 联姻
export const MARRIAGE_REL_BONUS = 30;       // 联姻成功双方关系 +30
export const MARRIAGE_INCOME_BONUS = 0.10;  // 联姻期间双方经济 +10%
export const MARRIAGE_BREAK_REL_PENALTY = 50; // 背盟后关系 -50
// 人质
export const HOSTAGE_RANSOM_COST = 2000;    // 赎金
export const HOSTAGE_RECALL_REL_MIN = 60;   // 关系≥60 可免费索回

// ---------- 图片路径工具 ----------
export const IMG = {
  titleBg: 'assets/images/title_bg.png',
  portrait: (id) => `assets/portraits/${id}.png`,
  battle: (id) => `assets/battles/${id}.png`,
  event: (id) => `assets/events/${id}.png`,
  cityView: 'assets/cities/city_view.png',
  // V5.0：重要城市专属鸟瞰图（无则回退 city_view）
  city: (id) => `assets/cities/${id}.png`
};

// ---------- 工具函数 ----------
export function getCityById(id) {
  return CITIES.find(c => c.id === id);
}
export function getGeneralById(id) {
  return GENERALS.find(g => g.id === id);
}
export function getFactionById(id) {
  return FACTIONS[id];
}
export function getPassById(id) {
  return PASSES.find(p => p.id === id);
}
export function getBarbarianById(id) {
  return BARBARIAN_TRIBES.find(b => b.id === id);
}
