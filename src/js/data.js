// ============================================================
// data.js — 静态数据：势力、城市、武将、兵种、事件
// ============================================================

// ---------- 势力 ----------
export const FACTIONS = {
  nanchao: {
    id: 'nanchao',
    name: '南朝·梁',
    color: '#1B7A5A',
    colorLight: '#2E9E7A',
    capital: 'jiankang',
    description: '据长江天险，经济发达，水军强盛，然骑兵孱弱。',
    bonus: '商业+20%，弓兵战力+10%',
    startCities: ['jiankang', 'jiangling', 'chengdu', 'guangzhou', 'xiangyang']
  },
  dongwei: {
    id: 'dongwei',
    name: '东魏',
    color: '#A0522D',
    colorLight: '#C07840',
    capital: 'yecheng',
    description: '据中原富庶之地，人口众多，骑兵精锐，然四面受敌。',
    bonus: '骑兵战力+15%，人口+10%',
    startCities: ['yecheng', 'jinyang', 'luoyang', 'pengcheng', 'qingzhou', 'youzhou', 'shouyang']
  },
  xiwei: {
    id: 'xiwei',
    name: '西魏',
    color: '#2C3E6B',
    colorLight: '#4A6090',
    capital: 'changan',
    description: '据关中形胜之地，步兵精锐，民风强悍，然经济较弱。',
    bonus: '步兵战力+15%，防御+20%',
    startCities: ['changan', 'tianshui', 'guzang', 'pingcheng']
  }
};

// ---------- 兵种 ----------
export const UNIT_TYPES = {
  infantry: { name: '步兵', coefficient: 1.0, cost: 10, counter: 'cavalry' },
  cavalry:  { name: '骑兵', coefficient: 1.3, cost: 25, counter: 'archer' },
  archer:   { name: '弓兵', coefficient: 1.1, cost: 15, counter: 'infantry' }
};

// 克制关系：key 克 value
export const COUNTER_RELATION = {
  cavalry: 'archer',   // 骑兵克弓兵
  archer: 'infantry',  // 弓兵克步兵
  infantry: 'cavalry'  // 步兵克骑兵
};
export const COUNTER_BONUS = 0.25; // +25%

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

// ---------- 16 座城市 ----------
// isoX, isoY 为等距坐标（自由排布，参考中国地理：南低北高、东西展开）
// terrain 为该城市所在地形
export const CITIES = [
  // --- 南梁 ---
  { id: 'jiankang', name: '建康', isoX: 12, isoY: 6,  terrain: 'plain',    size: 4, capital: true,
    pop: 80000, agri: 70, comm: 90, defense: 60, prosperity: 85, taxRate: 30 },
  { id: 'jiangling', name: '江陵', isoX: 10, isoY: 7,  terrain: 'river',   size: 3, capital: false,
    pop: 50000, agri: 65, comm: 60, defense: 55, prosperity: 65, taxRate: 30 },
  { id: 'chengdu',  name: '成都', isoX: 6,  isoY: 8,  terrain: 'plain',    size: 3, capital: false,
    pop: 60000, agri: 80, comm: 55, defense: 50, prosperity: 70, taxRate: 30 },
  { id: 'guangzhou', name: '广州', isoX: 11, isoY: 10, terrain: 'forest',  size: 2, capital: false,
    pop: 35000, agri: 55, comm: 70, defense: 40, prosperity: 60, taxRate: 30 },
  { id: 'xiangyang',name: '襄阳', isoX: 9,  isoY: 5,  terrain: 'mountain', size: 3, capital: false,
    pop: 45000, agri: 60, comm: 50, defense: 70, prosperity: 60, taxRate: 30 },

  // --- 东魏 ---
  { id: 'yecheng',  name: '邺城', isoX: 10, isoY: 2,  terrain: 'plain',    size: 4, capital: true,
    pop: 90000, agri: 75, comm: 85, defense: 65, prosperity: 85, taxRate: 30 },
  { id: 'jinyang',  name: '晋阳', isoX: 9,  isoY: 1,  terrain: 'mountain', size: 3, capital: false,
    pop: 55000, agri: 60, comm: 55, defense: 60, prosperity: 65, taxRate: 30 },
  { id: 'luoyang',  name: '洛阳', isoX: 9,  isoY: 3,  terrain: 'plain',    size: 4, capital: false,
    pop: 70000, agri: 70, comm: 90, defense: 55, prosperity: 80, taxRate: 30 },
  { id: 'pengcheng',name: '彭城', isoX: 12, isoY: 3,  terrain: 'plain',    size: 3, capital: false,
    pop: 50000, agri: 65, comm: 65, defense: 50, prosperity: 65, taxRate: 30 },
  { id: 'qingzhou', name: '青州', isoX: 13, isoY: 2,  terrain: 'plain',    size: 3, capital: false,
    pop: 45000, agri: 60, comm: 70, defense: 45, prosperity: 65, taxRate: 30 },
  { id: 'youzhou',  name: '幽州', isoX: 11, isoY: 0,  terrain: 'desert',   size: 2, capital: false,
    pop: 30000, agri: 45, comm: 40, defense: 50, prosperity: 45, taxRate: 30 },
  { id: 'shouyang', name: '寿阳', isoX: 11, isoY: 4,  terrain: 'plain',    size: 2, capital: false,
    pop: 35000, agri: 55, comm: 50, defense: 55, prosperity: 55, taxRate: 30 },

  // --- 西魏 ---
  { id: 'changan',  name: '长安', isoX: 6,  isoY: 3,  terrain: 'plain',    size: 4, capital: true,
    pop: 65000, agri: 65, comm: 70, defense: 70, prosperity: 75, taxRate: 30 },
  { id: 'tianshui', name: '天水', isoX: 5,  isoY: 4,  terrain: 'mountain', size: 2, capital: false,
    pop: 30000, agri: 45, comm: 35, defense: 55, prosperity: 45, taxRate: 30 },
  { id: 'guzang',   name: '姑臧', isoX: 4,  isoY: 2,  terrain: 'desert',   size: 2, capital: false,
    pop: 25000, agri: 40, comm: 45, defense: 45, prosperity: 40, taxRate: 30 },
  { id: 'pingcheng',name: '平城', isoX: 7,  isoY: 1,  terrain: 'mountain', size: 2, capital: false,
    pop: 28000, agri: 45, comm: 35, defense: 50, prosperity: 42, taxRate: 30 }
];

// 城市邻接关系（行军路径）
export const CITY_LINKS = {
  jiankang:   ['jiangling', 'shouyang', 'guangzhou'],
  jiangling:  ['jiankang', 'chengdu', 'xiangyang', 'shouyang'],
  chengdu:    ['jiangling', 'tianshui'],
  guangzhou:  ['jiankang'],
  xiangyang:  ['jiangling', 'shouyang', 'luoyang', 'changan'],
  yecheng:    ['jinyang', 'luoyang', 'pengcheng'],
  jinyang:    ['yecheng', 'pingcheng', 'luoyang'],
  luoyang:    ['yecheng', 'jinyang', 'shouyang', 'xiangyang', 'changan'],
  pengcheng:  ['yecheng', 'qingzhou', 'shouyang'],
  qingzhou:   ['pengcheng', 'youzhou'],
  youzhou:    ['qingzhou', 'pingcheng'],
  shouyang:   ['pengcheng', 'luoyang', 'xiangyang', 'jiankang', 'jiangling'],
  changan:    ['luoyang', 'tianshui', 'pingcheng', 'xiangyang'],
  tianshui:   ['changan', 'guzang', 'chengdu'],
  guzang:     ['tianshui', 'pingcheng'],
  pingcheng:  ['guzang', 'changan', 'jinyang', 'youzhou']
};

// ---------- 15 位武将 ----------
// portrait 对应 assets/portraits/{id}.png
export const GENERALS = [
  // 南梁
  { id: 'chen_baxian', name: '陈霸先', faction: 'nanchao', role: '君主',
    command: 88, force: 82, intel: 85, politics: 90, loyalty: 100, portrait: 'chen_baxian' },
  { id: 'wang_sengbian', name: '王僧辩', faction: 'nanchao', role: '都督',
    command: 85, force: 78, intel: 75, politics: 70, loyalty: 85, portrait: 'wang_sengbian' },
  { id: 'yang_kan',   name: '羊侃',   faction: 'nanchao', role: '名将',
    command: 80, force: 88, intel: 70, politics: 55, loyalty: 80, portrait: 'yang_kan' },
  { id: 'wei_rui',    name: '韦睿',   faction: 'nanchao', role: '儒将',
    command: 90, force: 65, intel: 82, politics: 75, loyalty: 88, portrait: 'wei_rui' },
  { id: 'chen_qian',  name: '陈蒨',   faction: 'nanchao', role: '文帝',
    command: 82, force: 75, intel: 80, politics: 85, loyalty: 90, portrait: 'chen_qian' },
  { id: 'yang_yaren', name: '羊鸦仁', faction: 'nanchao', role: '边将',
    command: 75, force: 82, intel: 60, politics: 50, loyalty: 75, portrait: 'yang_yaren' },

  // 东魏
  { id: 'gao_huan',   name: '高欢',   faction: 'dongwei', role: '君主',
    command: 92, force: 80, intel: 88, politics: 90, loyalty: 100, portrait: 'gao_huan' },
  { id: 'hu_luguang', name: '斛律光', faction: 'dongwei', role: '名将',
    command: 88, force: 90, intel: 72, politics: 60, loyalty: 82, portrait: 'hu_luguang' },
  { id: 'gao_aocao',  name: '高敖曹', faction: 'dongwei', role: '猛将',
    command: 78, force: 95, intel: 55, politics: 40, loyalty: 78, portrait: 'gao_aocao' },
  { id: 'murong_shaozong', name: '慕容绍宗', faction: 'dongwei', role: '名将',
    command: 86, force: 75, intel: 80, politics: 65, loyalty: 80, portrait: 'murong_shaozong' },
  { id: 'gao_changgong', name: '高长恭', faction: 'dongwei', role: '兰陵王',
    command: 85, force: 92, intel: 70, politics: 60, loyalty: 80, portrait: 'gao_changgong' },
  { id: 'duan_shao',  name: '段韶',   faction: 'dongwei', role: '谋将',
    command: 86, force: 78, intel: 82, politics: 75, loyalty: 82, portrait: 'duan_shao' },

  // 西魏
  { id: 'yuwen_tai',  name: '宇文泰', faction: 'xiwei', role: '君主',
    command: 90, force: 78, intel: 92, politics: 92, loyalty: 100, portrait: 'yuwen_tai' },
  { id: 'wei_xiaokuan', name: '韦孝宽', faction: 'xiwei', role: '名将',
    command: 88, force: 70, intel: 90, politics: 70, loyalty: 85, portrait: 'wei_xiaokuan' },
  { id: 'dugu_xin',   name: '独孤信', faction: 'xiwei', role: '名将',
    command: 82, force: 80, intel: 75, politics: 78, loyalty: 82, portrait: 'dugu_xin' },
  { id: 'li_hu',      name: '李虎',   faction: 'xiwei', role: '八柱国',
    command: 80, force: 82, intel: 68, politics: 65, loyalty: 85, portrait: 'li_hu' },
  { id: 'yuwen_yong', name: '宇文邕', faction: 'xiwei', role: '武帝',
    command: 88, force: 80, intel: 85, politics: 88, loyalty: 92, portrait: 'yuwen_yong' },

  // 在野
  { id: 'chen_qingzhi', name: '陈庆之', faction: null, role: '在野',
    command: 85, force: 60, intel: 78, politics: 55, loyalty: 60, portrait: 'chen_qingzhi' },
  { id: 'tan_daoji',  name: '檀道济', faction: null, role: '在野',
    command: 86, force: 82, intel: 70, politics: 60, loyalty: 60, portrait: 'tan_daoji' },
  { id: 'cao_jingzong', name: '曹景宗', faction: null, role: '在野',
    command: 78, force: 85, intel: 60, politics: 45, loyalty: 55, portrait: 'cao_jingzong' },
  // 杨坚：隋公代周事件登场，初始在野，事件后归入西魏
  { id: 'yang_jian',  name: '杨坚',   faction: null, role: '隋公',
    command: 90, force: 82, intel: 90, politics: 95, loyalty: 70, portrait: 'yang_jian' }
];

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
  }
];

// ---------- 历史事件 ----------
export const HISTORICAL_EVENTS = [
  {
    id: 'hou_jing', name: '侯景之乱', illustration: 'rebellion',
    minTurn: 8, faction: 'nanchao',
    description: '侯景于寿阳发动叛乱，南梁朝野震动！',
    options: [
      { text: '全力平叛', effect: { money: -1000, armyLoss: 5000, morale: -10 } },
      { text: '妥协招安', effect: { shouyang_rebel: true, morale: -20 } }
    ]
  },
  {
    id: 'heyin', name: '河阴之变', illustration: 'plague',
    minTurn: 5, faction: 'dongwei',
    description: '河阴之变，朝堂震荡，百官惶恐。',
    options: [
      { text: '铁腕整肃', effect: { morale: -15, comm: +10 } },
      { text: '怀柔安抚', effect: { money: -500, morale: +5 } }
    ]
  },

  // ---------- 新增历史事件 ----------
  {
    id: 'liuzhen', name: '六镇起义', illustration: 'rebellion',
    minTurn: 3, factions: ['dongwei', 'xiwei'],
    description: '北方六镇戍卒哗变，边地狼烟四起！平叛虽损兵折将，却可收揽骁勇。',
    options: [
      { text: '出兵平叛（损兵3000）', effect: { armyLoss: 3000, morale: +5, recruitRandom: true } },
      { text: '羁縻招安（耗金800）', effect: { money: -800, morale: -5, recruitRandom: true } }
    ]
  },
  {
    id: 'xiaowen_reform', name: '孝文帝改革', illustration: 'harvest',
    minTurn: 12, factions: ['dongwei', 'xiwei'],
    // 仅当控制洛阳时触发
    condition: (game) => {
      const c = game.cities.get('luoyang');
      return c && c.owner === game.playerFaction;
    },
    description: '迁都洛阳已久，汉风渐染。或行汉化以兴文治，或守旧俗以安军心。',
    options: [
      { text: '推行汉化改革（繁荣+10 民心+15，军心-10）', effect: { prosperity: 10, morale: 15, armyMorale: -10 } },
      { text: '固守鲜卑旧俗（军心+10，繁荣-10）', effect: { prosperity: -10, morale: -5, armyMorale: 10 } }
    ]
  },
  {
    id: 'mangshan', name: '邙山之战', illustration: 'cavalry_charge',
    minTurn: 10, factions: ['dongwei', 'xiwei'],
    description: '东西魏大军会战于邙山，野战遮天蔽日！此战自动结算一场大规模野战。',
    options: [
      { text: '率军亲征（自动大战）', effect: { massBattle: true } }
    ]
  },
  {
    id: 'yubi_siege', name: '玉璧围城', illustration: 'city_siege',
    minTurn: 9, factions: ['xiwei'],
    description: '东魏大军围玉璧，韦孝宽临危受命，守城意志坚如磐石。',
    options: [
      { text: '全城死守（守城战力大幅提升，本回合免伤）', effect: { garrisonBuff: true, morale: +10 } }
    ]
  },
  {
    id: 'houjing_continue', name: '侯景之乱·续', illustration: 'rebellion',
    minTurn: 11, factions: ['nanchao'],
    // 侯景之乱后第3回合仍未平定（寿阳无主）时触发
    condition: (game) => {
      const c = game.cities.get('shouyang');
      return c && c.owner === null;
    },
    description: '侯景余部卷土重来，建康危在旦夕！若不速平，社稷倾颓。',
    options: [
      { text: '倾国之兵勤王（损兵4000）', effect: { armyLoss: 4000, morale: -5, recaptureJiankang: true } },
      { text: '求和纳贡（耗金1500）', effect: { money: -1500, morale: -15 } }
    ]
  },
  {
    id: 'yangjian_dynasty', name: '隋公代周', illustration: 'harvest',
    minTurn: 25, factions: ['xiwei'],
    description: '随国公杨坚素有人望，百官归心，入朝辅政。',
    options: [
      { text: '召杨坚入朝（超高属性武将加入）', effect: { recruitGeneral: 'yang_jian', morale: +10 } }
    ]
  }
];

// ---------- 图片路径工具 ----------
export const IMG = {
  titleBg: 'assets/images/title_bg.png',
  portrait: (id) => `assets/portraits/${id}.png`,
  battle: (id) => `assets/battles/${id}.png`,
  event: (id) => `assets/events/${id}.png`,
  cityView: 'assets/cities/city_view.png'
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
