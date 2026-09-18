// ============================================================
// data.js — 静态数据：势力、城市、武将、兵种、事件  [V13.0.0]
// V8.1：HISTORICAL_EVENTS 末尾追加 12 个历史事件（v81_* 前缀），不改既有数据。
// V13.0.0：「数据内容扩充」子代理交付——
//   1) GENERALS 末尾追加 6 位新武将（v13_ 前缀 id）：苏绰/贺拔岳/彭乐/独孤永业/陆法和/鲁广达
//   2) EVENTS 末尾追加 15 个随机事件（v13_ 前缀），覆盖军事/政治/经济/文化/特殊五类
//   3) HISTORICAL_EVENTS 末尾追加 4 个历史事件（v13_ 前缀）：颍川之围/巴陵之战/河阴之变/吕梁覆军
//   4) 新增 V13_BALANCE 平衡调优常量（兵种克制/AI 阈值/事件概率/忠诚衰减/税率）
//   5) 新增 6 张武将立绘 + 2 张战斗插画 + 2 张事件插画（assets/ 对应目录）
//   所有新 id 均带 v13_ 前缀，不改动既有数据；effect 键均复用 events.js applyEvent 已支持的键。
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
  },

  // ---- V6.5 剧本7：六镇起义（523年）----
  // 历史背景：北魏正光四年（523年），沃野镇民破六韩拔陵起义，六镇响应。
  // 北魏朝政腐败，柔然南下，南梁北伐。尔朱荣乘势崛起，高欢、宇文泰皆起于六镇。
  '523': {
    id: '523', name: '六镇起义', year: 523,
    description: '北魏正光四年，沃野镇民破六韩拔陵聚众反，六镇并起，烽火连天。魏廷衰微，柔然犯塞，南朝萧衍图谋北伐。英雄起于草泽，霸业基于戎马。',
    factions: ['nanchao', 'dongwei', 'xiwei'],
    factionNameOverride: {
      nanchao: '南梁', dongwei: '北魏', xiwei: '起义军'
    },
    // 特殊规则：北魏民心低、武将忠诚低；起义军初始兵力少但士气高；南梁中等
    resources: {
      nanchao: { money: 2000, food: 3000 },
      dongwei: { money: 1200, food: 2000 },
      xiwei: { money: 600, food: 1000 }
    },
    cityMorale: { nanchao: 55, dongwei: 30, xiwei: 40 },
    generalLoyalty: { nanchao: 65, dongwei: 40, xiwei: 75 },
    garrisonMult: { nanchao: 1.0, dongwei: 0.7, xiwei: 1.2 }
  },

  // ---- V6.5 剧本8：隋文统一（588年详细版）----
  // 历史背景：开皇八年，杨坚已篡周建隋八年，灭后梁，据有整个北方。
  // 晋王杨广节度九十路总管，五十一万大军临江。南陈后主陈叔宝荒于诗酒。
  '588': {
    id: '588', name: '隋文统一', year: 588,
    description: '开皇八年，隋文帝杨坚奋五世之余烈，命晋王杨广节度九十路总管，五十一万大军八路伐陈。韩擒虎出庐江，贺若弼出广陵，舟舰横江。南陈后主恃长江天险，奏伎纵酒，作诗不辍。此一战，天下归一。',
    factions: ['xiwei', 'nanchao', 'hou_liang', 'wang_lin'],
    factionNameOverride: {
      xiwei: '隋', nanchao: '南陈', hou_liang: '后梁', wang_lin: '王琳余烬'
    },
    // 特殊规则：隋极强；南陈民心低、兵力弱；后梁附庸；王琳残余
    resources: {
      xiwei: { money: 7000, food: 9000 },
      nanchao: { money: 800, food: 1500 },
      hou_liang: { money: 500, food: 1000 },
      wang_lin: { money: 400, food: 800 }
    },
    cityMorale: { xiwei: 80, nanchao: 25, hou_liang: 45, wang_lin: 40 },
    generalLoyalty: { xiwei: 92, nanchao: 42, hou_liang: 55, wang_lin: 48 },
    garrisonMult: { xiwei: 2.0, nanchao: 0.6, hou_liang: 0.7, wang_lin: 0.7 }
  },

  // ---- V7.5 剧本9：孝文改革（494年）----
  // 历史背景：北魏太和十八年（494年），孝文帝拓跋宏力排众议，迁都洛阳，
  // 推行汉化改革：改汉姓、穿汉服、说汉语、与汉人士族通婚。民族融合加深，
  // 但鲜卑旧贵族阻力巨大，六镇将士地位骤降，埋下日后六镇起义的隐患。
  // 南齐偏安江东，柔然雄踞漠南。此局北魏汉化阻力大（民心低），但文治科技鼎盛。
  '494': {
    id: '494', name: '孝文改革', year: 494,
    description: '北魏孝文帝迁都洛阳，力推汉化：禁胡服、断北语、改汉姓、定族姓。胡汉融合，文教大兴。然六镇武人怨望，旧贵族离心。南齐据江东，柔然扰漠南。改革成则天下治，改革败则社稷倾。',
    factions: ['dongwei', 'nanchao', 'xiwei'],
    factionNameOverride: {
      dongwei: '北魏', nanchao: '南齐', xiwei: '柔然'
    },
    // 特殊规则：北魏初始民心低（汉化阻力），但文治科技高、经济强；南齐中等；柔然兵强但经济弱
    resources: {
      dongwei: { money: 3000, food: 3800 },
      nanchao: { money: 1800, food: 2800 },
      xiwei: { money: 800, food: 1500 }
    },
    cityMorale: { dongwei: 35, nanchao: 55, xiwei: 50 },
    generalLoyalty: { dongwei: 50, nanchao: 65, xiwei: 70 },
    garrisonMult: { dongwei: 1.1, nanchao: 1.0, xiwei: 1.3 }
  },

  // ---- V7.5 剧本10：周武灭齐（576年）----
  // 历史背景：北周建德五年（576年），武帝宇文邕已灭佛强国，府兵精锐。
  // 亲率大军伐齐，破晋州，围平阳。齐后主高纬昏庸，冯淑妃红颜误军，
  // 朝政崩坏，斛律光已死，兰陵王被鸩。北周乘势东出，志在混一北方。
  // 南陈据江东，后梁附庸江陵。
  '576': {
    id: '576', name: '周武灭齐', year: 576,
    description: '北周武帝宇文邕灭佛强国，府兵精强，亲征北齐。齐后主高纬荒于宠信，自毁长城，斛律光、兰陵王相继冤死。周师东出潼关，破晋州、围平阳，兵锋直指邺城。北方一统，在此一战。',
    factions: ['xiwei', 'dongwei', 'nanchao', 'hou_liang'],
    factionNameOverride: {
      xiwei: '北周', dongwei: '北齐', nanchao: '南陈', hou_liang: '后梁'
    },
    // 特殊规则：北齐民心低、武将忠诚低；北周兵力强、经济强
    resources: {
      xiwei: { money: 3600, food: 4800 },
      dongwei: { money: 900, food: 1800 },
      nanchao: { money: 1500, food: 2600 },
      hou_liang: { money: 700, food: 1300 }
    },
    cityMorale: { xiwei: 72, dongwei: 25, nanchao: 52, hou_liang: 55 },
    generalLoyalty: { xiwei: 85, dongwei: 32, nanchao: 66, hou_liang: 58 },
    garrisonMult: { xiwei: 1.5, dongwei: 0.7, nanchao: 1.0, hou_liang: 0.85 }
  },

  // ---- V9.5 剧本11：太武灭佛（446年）----
  // 历史背景：北魏太平真君七年（446），太武帝拓跋焘从崔浩之言下诏灭佛。
  // 佛教遭受重创，北方寺院经像多毁。然北魏铁骑纵横，一统北方之势已成。
  // 刘宋据江南（刘义隆元嘉之治），柔然雄踞漠南屡犯塞。
  '446': {
    id: '446', name: '太武灭佛', year: 446,
    description: '北魏太武帝拓跋焘下诏灭佛，毁寺坑僧，北方佛教遭劫。然魏师铁骑四出，一统北方；刘宋文帝元嘉治世，江南晏然；柔然雄踞漠南，屡犯塞下。灭佛强国，还是绥靖怀柔？',
    factions: ['dongwei', 'nanchao', 'xiwei'],
    factionNameOverride: {
      dongwei: '北魏', nanchao: '刘宋', xiwei: '柔然'
    },
    // 特殊规则：北魏灭佛中民心低（灭佛阻力），但军事强；刘宋文治中等；柔然兵强经济弱
    resources: {
      dongwei: { money: 3400, food: 4600 },
      nanchao: { money: 2200, food: 3200 },
      xiwei: { money: 700, food: 1600 }
    },
    cityMorale: { dongwei: 32, nanchao: 62, xiwei: 50 },
    generalLoyalty: { dongwei: 70, nanchao: 68, xiwei: 72 },
    garrisonMult: { dongwei: 1.55, nanchao: 1.0, xiwei: 1.35 }
  },

  // ---- V9.5 剧本12：梁武舍身（527年）----
  // 历史背景：北魏孝明帝正光后，朝政腐败，六镇将乱（523已起）。
  // 南梁武帝萧衍大通元年舍身同泰寺，佛教极盛，文化繁荣。
  // 北朝将分东西（高欢/宇文泰将出），此局北魏内乱，南梁文治鼎盛而武备渐弛。
  '527': {
    id: '527', name: '梁武舍身', year: 527,
    description: '南梁武帝萧衍舍身同泰寺，佛教极盛，江东文物殷阜。北魏历经孝文汉化，然朝政渐紊，六镇怨望，内乱将作。南朝文治极盛而兵备渐弛，北朝虽乱而铁骑犹强。守文 vs 进取，在此一局。',
    factions: ['nanchao', 'dongwei', 'xiwei', 'hou_liang'],
    factionNameOverride: {
      nanchao: '南梁', dongwei: '北魏', xiwei: '东魏萌芽', hou_liang: '西魏萌芽'
    },
    // 特殊规则：南梁初始文化高、佛教建筑多、民心高，但军事弱；北魏内乱民心低
    resources: {
      nanchao: { money: 3600, food: 4000 },
      dongwei: { money: 1800, food: 2800 },
      xiwei: { money: 1200, food: 2000 },
      hou_liang: { money: 900, food: 1500 }
    },
    cityMorale: { nanchao: 70, dongwei: 35, xiwei: 45, hou_liang: 50 },
    generalLoyalty: { nanchao: 75, dongwei: 42, xiwei: 55, hou_liang: 60 },
    garrisonMult: { nanchao: 0.85, dongwei: 0.95, xiwei: 0.9, hou_liang: 0.85 }
  },

  // ---- V10.0 剧本13：淝水之战（383年） ----
  // 历史背景：东晋太元八年（383），前秦苻坚统一北方后，率众百万南征。
  // 东晋谢安为征讨大都督，谢玄率八万北府兵北上御敌。洛涧首捷后，
  // 两军夹淝水而阵。谢玄请秦军少退以便渡河决战，苻坚欲乘晋军半渡击之，
  // 佯退而不可止，朱序大呼「秦兵败矣」，秦军大溃，风声鹤唳草木皆兵。
  // 此役为历史上最著名的以少胜多战役，奠定南北对峙格局。
  '383': {
    id: '383', name: '淝水之战', year: 383,
    description: '前秦苻坚统一北方，率众百万南下，投鞭断流，志在混一。东晋谢安东山再起，以谢玄为前锋，率八万北府兵御敌。众寡悬殊，朝野震恐。然北府精锐，谢安从容，淝水一战，千古留名。',
    factions: ['xiwei', 'nanchao', 'dongwei'],
    factionNameOverride: {
      xiwei: '前秦', nanchao: '东晋', dongwei: '后燕'
    },
    // 特殊规则：前秦极强（统一北方之众）；东晋弱而精锐（北府兵士气极高）；
    //           后燕新兴弱燕，慕容垂部曲尚存
    resources: {
      xiwei: { money: 5000, food: 7000 },
      nanchao: { money: 1500, food: 2800 },
      dongwei: { money: 800, food: 1500 }
    },
    cityMorale: { xiwei: 60, nanchao: 55, dongwei: 50 },
    generalLoyalty: { xiwei: 65, nanchao: 85, dongwei: 70 },
    garrisonMult: { xiwei: 1.8, nanchao: 0.8, dongwei: 0.7 }
  },

  // ---- V10.0 剧本14：刘裕代晋（420年） ----
  // 历史背景：东晋元熙二年（420），刘裕北伐灭南燕后秦，却月阵破北魏铁骑，
  // 收复长安洛阳，武功为南渡之冠。晋恭帝禅位于刘裕，国号宋，南朝始此。
  // 此时北方北魏拓跋珪已建代国（后改魏），渐强；北凉沮渠蒙逊据河西，
  // 西秦、夏赫连勃勃割据关中。刘裕以布衣取天下，为南朝第一帝。
  '420': {
    id: '420', name: '刘裕代晋', year: 420,
    description: '刘裕北府起兵，灭南燕、后秦，却月阵破北魏铁骑，收复两京。威望盖世，晋祚将终。元熙二年，恭帝禅位，刘裕称帝，国号宋，改元永初。南朝自此始，元嘉之治在望。',
    factions: ['nanchao', 'dongwei', 'xiwei', 'hou_liang'],
    factionNameOverride: {
      nanchao: '刘宋', dongwei: '北魏', xiwei: '北凉', hou_liang: '夏'
    },
    // 特殊规则：刘宋极强（刘裕开国，北府精锐）；北魏新兴中等；北凉/夏弱小
    resources: {
      nanchao: { money: 4200, food: 5500 },
      dongwei: { money: 2000, food: 3200 },
      xiwei: { money: 700, food: 1400 },
      hou_liang: { money: 600, food: 1200 }
    },
    cityMorale: { nanchao: 68, dongwei: 50, xiwei: 45, hou_liang: 42 },
    generalLoyalty: { nanchao: 88, dongwei: 60, xiwei: 55, hou_liang: 50 },
    garrisonMult: { nanchao: 1.5, dongwei: 1.0, xiwei: 0.7, hou_liang: 0.65 }
  },

  // ---- V10.5 剧本15：齐初建元（479年） ----
  // 历史背景：刘宋末年宗室相屠，萧道成乘势掌权。昇明三年（479）顺帝禅位，
  // 道成称帝，国号齐，改元建元，是为齐高帝。帝戒奢崇俭，务从简约。
  // 此时北魏孝文帝即位不久（冯太后临朝），汉化改革将启；柔然雄踞漠南。
  '479': {
    id: '479', name: '齐初建元', year: 479,
    description: '宋末骨肉相残，萧道成乘时禅代，国号齐，改元建元。帝起自布衣，知民疾苦，务崇俭约。北魏孝文冲幼，冯太后临朝，班禄均田之制方行；柔然控弦数十万，岁犯北边。',
    factions: ['nanchao', 'dongwei', 'xiwei'],
    factionNameOverride: {
      nanchao: '南齐', dongwei: '北魏', xiwei: '柔然'
    },
    // 特殊规则：南齐新朝民心初定、文治尚可；北魏改革中兵强；柔然骑兵剽悍而国用不足
    resources: {
      nanchao: { money: 2400, food: 3400 },
      dongwei: { money: 2800, food: 3600 },
      xiwei: { money: 700, food: 1500 }
    },
    cityMorale: { nanchao: 58, dongwei: 52, xiwei: 48 },
    generalLoyalty: { nanchao: 72, dongwei: 66, xiwei: 70 },
    garrisonMult: { nanchao: 1.0, dongwei: 1.2, xiwei: 1.3 }
  },

  // ---- V10.5 剧本16：陈先代梁（557年） ----
  // 历史背景：侯景之乱后江南残破。陈霸先先破侯景、却北齐，于永定元年（557）
  // 受梁敬帝禅，国号陈，是为陈武帝。新朝立国于丘墟之上，文轨日新。
  // 北方高洋已代东魏建齐，宇文觉已代西魏建周，三国鼎立之势成。
  '557': {
    id: '557', name: '陈先代梁', year: 557,
    description: '侯景乱后，江南丘墟。陈霸先起于寒微，破景却齐，再造江南。永定元年受禅称帝，国号陈。然土宇日蹙，威力不用远图。北齐据河北，北周有关中，三国鼎峙，混一无期。',
    factions: ['nanchao', 'dongwei', 'xiwei', 'hou_liang'],
    factionNameOverride: {
      nanchao: '南陈', dongwei: '北齐', xiwei: '北周', hou_liang: '后梁'
    },
    // 特殊规则：南陈新造、残破而民心初附；北齐北周皆已代魏、国力方张
    resources: {
      nanchao: { money: 1600, food: 2600 },
      dongwei: { money: 3200, food: 4200 },
      xiwei: { money: 3000, food: 4000 },
      hou_liang: { money: 800, food: 1500 }
    },
    cityMorale: { nanchao: 50, dongwei: 62, xiwei: 60, hou_liang: 52 },
    generalLoyalty: { nanchao: 78, dongwei: 70, xiwei: 72, hou_liang: 60 },
    garrisonMult: { nanchao: 0.9, dongwei: 1.2, xiwei: 1.2, hou_liang: 0.85 }
  },

  // ---- V11.0 剧本17：元嘉草草（450年） ----
  // 历史背景：北魏太平真君十一年（450），宋文帝刘义隆元嘉之治已近三十年，
  //   仓廪充实，乃决意北伐。以王玄谟为帅，水路并进。然王玄谟贪愎好杀，
  //   大败于滑台。魏太武帝拓跋焘反推，连破兖徐，直抵瓜步，建康震恐。
  //   "元嘉草草，封狼居胥，赢得仓皇北顾"——辛弃疾词咏此局。
  '450': {
    id: '450', name: '元嘉草草', year: 450,
    description: '元嘉之治三十年，宋文帝锐意北伐。王玄谟陈说方略，上有封狼居胥之意。然滑台一败，魏太武帝亲率大军反推，直抵瓜步，声言渡江。元嘉草草，赢得仓皇北顾。',
    factions: ['nanchao', 'dongwei', 'xiwei'],
    factionNameOverride: {
      nanchao: '刘宋', dongwei: '北魏', xiwei: '柔然'
    },
    // 特殊规则：刘宋经济强但军事准备不足；北魏铁骑极强；柔然扰北
    resources: {
      nanchao: { money: 3500, food: 5000 },
      dongwei: { money: 3000, food: 4000 },
      xiwei: { money: 700, food: 1500 }
    },
    cityMorale: { nanchao: 60, dongwei: 55, xiwei: 48 },
    generalLoyalty: { nanchao: 70, dongwei: 75, xiwei: 68 },
    garrisonMult: { nanchao: 0.9, dongwei: 1.5, xiwei: 1.3 }
  },

  // ---- V11.0 剧本18：韩陵举义（532年） ----
  // 历史背景：北魏普泰二年（532），高欢在信都起兵，讨尔朱氏。
  //   尔朱兆、尔朱天光等合二十万来攻。高欢战马不满二千，步兵不至三万，
  //   于韩陵山为圆阵，系牛驴以塞归道。将士皆有死志，大破尔朱联军。
  //   贺拔胜阵前降欢。尔朱兆走死。自此魏朝大权归于高欢。
  '532': {
    id: '532', name: '韩陵举义', year: 532,
    description: '高欢信都起兵，讨尔朱氏。尔朱兆等合众二十万来攻，欢战马不满二千，步兵三万。韩陵为圆阵，系牛驴塞归道，将士皆有死志。一战而破尔朱，魏朝大权归欢。此局之后，魏分东西之局将成。',
    factions: ['dongwei', 'xiwei', 'nanchao'],
    factionNameOverride: {
      dongwei: '高欢军', xiwei: '尔朱军', nanchao: '南梁'
    },
    // 特殊规则：高欢兵少而精锐、士气极高；尔朱兵多而离心；南梁偏安
    resources: {
      dongwei: { money: 1500, food: 2500 },
      xiwei: { money: 2500, food: 3500 },
      nanchao: { money: 2000, food: 3000 }
    },
    cityMorale: { dongwei: 65, xiwei: 35, nanchao: 55 },
    generalLoyalty: { dongwei: 85, xiwei: 40, nanchao: 65 },
    garrisonMult: { dongwei: 1.2, xiwei: 1.3, nanchao: 1.0 }
  },

  // ---- V11.5 剧本19：周武灭佛（574年） ----
  // 历史背景：北周建德三年（574），武帝宇文邕下诏废佛道二教，毁经像、令僧道还俗，
  //   三百万僧尼复归编户，寺产金宝悉入官府。北周由此府库充裕、兵源大增。
  //   北齐后主高纬荒于宠信，朝政崩坏；南陈据江东、后梁附庸江陵。
  //   此局北周「灭佛强国」但佛门城市民心受挫；北齐虽强而内乱。
  '574': {
    id: '574', name: '周武灭佛', year: 574,
    description: '北周武帝宇文邕灭佛强周，毁寺驱僧，三百万僧尼复归编户，府库充盈、甲兵益盛。北齐后主高纬自毁长城，冯淑妃红颜误军；南陈偏安江东。灭佛以富国，还是绥靖以安众？',
    factions: ['xiwei', 'dongwei', 'nanchao', 'hou_liang'],
    factionNameOverride: {
      xiwei: '北周', dongwei: '北齐', nanchao: '南陈', hou_liang: '后梁'
    },
    // 特殊规则：北周灭佛中、佛门城市民心低但经济军事强；北齐昏乱忠诚低；南陈中等
    resources: {
      xiwei: { money: 3400, food: 4600 },
      dongwei: { money: 1300, food: 2400 },
      nanchao: { money: 1500, food: 2700 },
      hou_liang: { money: 700, food: 1400 }
    },
    cityMorale: { xiwei: 38, dongwei: 30, nanchao: 52, hou_liang: 52 },
    generalLoyalty: { xiwei: 84, dongwei: 35, nanchao: 66, hou_liang: 58 },
    garrisonMult: { xiwei: 1.5, dongwei: 0.78, nanchao: 1.0, hou_liang: 0.85 }
  },

  // ---- V11.5 剧本20：白袍北伐（529年） ----
  // 历史背景：北魏永安二年（529），梁武帝遣陈庆之率七千白袍军送元颢北归。
  //   十四旬取三十二城，四十七战皆捷，攻入洛阳。然孤军深入，后援不继，
  //   尔朱荣反攻，陈庆之步骑数千转斗而归。此局南梁精锐悬师深入、北魏内乱方炽。
  '529': {
    id: '529', name: '白袍北伐', year: 529,
    description: '梁武帝以七千白袍军送北海王元颢北归。陈庆之所向无前，十四旬取三十二城，饮马洛阳。童谣谓「千兵万马避白袍」。然悬师深入、后援不继，尔朱荣铁骑蔽野而来。孤注一掷，还是见好就收？',
    factions: ['nanchao', 'dongwei', 'xiwei'],
    factionNameOverride: {
      nanchao: '南梁', dongwei: '北魏', xiwei: '尔朱荣军'
    },
    // 特殊规则：南梁孤军精锐、士气极高但兵少；北魏内乱民心低；尔朱兵多离心
    resources: {
      nanchao: { money: 2200, food: 3200 },
      dongwei: { money: 1600, food: 2600 },
      xiwei: { money: 2800, food: 3800 }
    },
    cityMorale: { nanchao: 60, dongwei: 32, xiwei: 40 },
    generalLoyalty: { nanchao: 78, dongwei: 40, xiwei: 60 },
    garrisonMult: { nanchao: 1.15, dongwei: 0.75, xiwei: 1.25 }
  },

  // ---- V12.0 剧本21：却月北伐（416年） ----
  // 历史背景：东晋义熙十二年（416），刘裕北伐后秦。
  // 王镇恶水军自黄河入渭水克长安，却月阵破北魏铁骑于黄河南岸。
  // 此时北魏明元帝拓跋嗣在位，夏赫连勃勃据统万，后秦姚兴新丧。
  '416': {
    id: '416', name: '却月北伐', year: 416,
    description: '刘裕北伐后秦，王镇恶克洛阳入潼关，却月阵大破北魏铁骑于河上。关中指日可下，然刘裕岂久为人下？此一役也，收复两旧都，亦为禅代张本。',
    factions: ['nanchao', 'dongwei', 'xiwei', 'hou_liang'],
    factionNameOverride: {
      nanchao: '东晋', dongwei: '北魏', xiwei: '后秦', hou_liang: '夏'
    },
    // 特殊规则：东晋极强（刘裕北府精锐）；北魏新兴中等；后秦/夏弱小
    resources: {
      nanchao: { money: 4000, food: 5500 },
      dongwei: { money: 2200, food: 3200 },
      xiwei: { money: 900, food: 1800 },
      hou_liang: { money: 700, food: 1400 }
    },
    cityMorale: { nanchao: 68, dongwei: 50, xiwei: 40, hou_liang: 45 },
    generalLoyalty: { nanchao: 88, dongwei: 60, xiwei: 50, hou_liang: 55 },
    garrisonMult: { nanchao: 1.45, dongwei: 1.0, xiwei: 0.75, hou_liang: 0.8 }
  },

  // ---- V12.0 剧本22：葛荣百万（526年） ----
  // 历史背景：北魏孝昌二年（526），六镇起义后葛荣兼并杜洛周，
  // 众号百万，据河北冀州，南趋邺城。尔朱荣于秀容川蓄养假子，
  // 率七千精骑东出滏口，一鼓破葛荣。然高欢、宇文泰皆在其军中，
  // 东西魏之胚胎已伏于此局。
  '526': {
    id: '526', name: '葛荣百万', year: 526,
    description: '六镇余烬，葛荣并杜洛周，众号百万，据冀南欲取邺。魏廷震恐，河北州郡望风而降。尔朱荣蓄养假子铁骑七千，东出滏口，鼓噪而进。高欢、宇文泰皆在行间，霸业将自此始。',
    factions: ['dongwei', 'xiwei', 'nanchao'],
    factionNameOverride: {
      dongwei: '北魏朝廷', xiwei: '葛荣叛军', nanchao: '南梁'
    },
    // 特殊规则：葛荣兵多但离心；北魏朝廷衰弱但尔朱荣部精锐；南梁坐山观虎斗
    resources: {
      dongwei: { money: 1500, food: 2800 },
      xiwei: { money: 2500, food: 4000 },
      nanchao: { money: 2000, food: 3000 }
    },
    cityMorale: { dongwei: 30, xiwei: 45, nanchao: 58 },
    generalLoyalty: { dongwei: 45, xiwei: 55, nanchao: 65 },
    garrisonMult: { dongwei: 0.8, xiwei: 1.3, nanchao: 1.0 }
  },

  // ============================================================
  // V12.5 剧本23：统万破夏（427年）
  // 历史背景：北魏始光四年（427），太武帝拓跋焘亲征赫连夏。
  //   夏王赫连勃勃新死，子赫连昌继。魏师至统万，拓跋焘用计示弱，
  //   夏兵出城追击，大破之，遂克统万。夏主赫连昌奔上邽。
  //   此役北魏尽收关中形胜，一统北方之势成。
  //   此时刘宋文帝元嘉之治，江南晏然；柔然仍雄踞漠南。
  // 历史考证：《魏书·世祖纪》《魏书·铁弗刘虎传》。
  // ============================================================
  '427': {
    id: '427', name: '统万破夏', year: 427,
    description: '北魏太武帝拓跋焘亲征赫连夏。夏主赫连昌婴城固守，魏以羸师诱敌，夏兵出城，伏兵四起，大破之，遂克统万。关中形胜尽入魏。刘宋元嘉治世，柔然仍窥漠南。',
    factions: ['dongwei', 'nanchao', 'xiwei', 'hou_liang'],
    factionNameOverride: {
      dongwei: '北魏', nanchao: '刘宋', xiwei: '柔然', hou_liang: '赫连夏'
    },
    // 特殊规则：北魏铁骑极强；夏国新丧主、内乱；刘宋文治中等；柔然骑兵剽悍
    resources: {
      dongwei: { money: 3800, food: 5000 },
      nanchao: { money: 2800, food: 3800 },
      xiwei: { money: 800, food: 1800 },
      hou_liang: { money: 900, food: 1800 }
    },
    cityMorale: { dongwei: 65, nanchao: 60, xiwei: 50, hou_liang: 38 },
    generalLoyalty: { dongwei: 80, nanchao: 68, xiwei: 72, hou_liang: 45 },
    garrisonMult: { dongwei: 1.6, nanchao: 1.0, xiwei: 1.3, hou_liang: 0.8 }
  },

  // ============================================================
  // V12.5 剧本24：沙苑之战（537年）
  // 历史背景：东魏天平四年（537），高欢率二十万大军西伐西魏。
  //   关中大饥，宇文泰军士不满万人。宇文泰进至沙苑，
  //   渭曲芦苇荡中伏兵，李弼、赵贵横击之，东魏师大溃，
  //   丧甲士八万。高欢狼狈遁归。东西魏强弱之势自此逆转。
  //   此役为东西魏五次大战之第二战，以少胜多。
  // 历史考证：《周书·文帝纪》《北齐书·神武纪》。
  // ============================================================
  '537': {
    id: '537', name: '沙苑之战', year: 537,
    description: '东魏高欢率二十万西伐，关中大饥，宇文泰兵不满万。泰进至沙苑，渭曲苇荡中伏兵四起，李弼横击其腰，东师大溃，丧甲士八万。此一役也，西魏以弱胜强，关中转危为安。',
    factions: ['xiwei', 'dongwei', 'nanchao'],
    factionNameOverride: {
      xiwei: '西魏', dongwei: '东魏', nanchao: '南梁'
    },
    // 特殊规则：西魏兵少而精锐、士气极高；东魏兵多而轻敌；南梁坐观
    resources: {
      xiwei: { money: 1500, food: 2000 },
      dongwei: { money: 3500, food: 4500 },
      nanchao: { money: 2200, food: 3200 }
    },
    cityMorale: { xiwei: 50, dongwei: 55, nanchao: 55 },
    generalLoyalty: { xiwei: 85, dongwei: 65, nanchao: 65 },
    garrisonMult: { xiwei: 0.85, dongwei: 1.4, nanchao: 1.0 }
  },

  // ============================================================
  // V14.0 新增剧本（2个，24→26）
  // ============================================================

  // ---- 剧本25：元嘉北伐（430年）----
  // 历史背景：南朝宋文帝刘义隆元嘉七年（430），到彦之率军北伐北魏。
  // 北魏太武帝拓跋焘以诱敌深入之计，先弃河南四镇，待宋军分散后大举反击。
  // 到彦之焚甲弃军而走，委弃荡尽。后遣檀道济救之，至历城，烧营而还。
  // "元嘉草草，封狼居胥，赢得仓皇北顾"——此一役奠定南北对峙格局。
  '430': {
    id: '430', name: '元嘉北伐', year: 430,
    description: '宋文帝即位日久，江南晏然，欲恢复河南。命到彦之率舟师入河，北魏太武帝拓跋焘敛兵北退。宋军不战而得河南四镇，皆大喜。然魏师秋高马肥，大举反攻，彦之溃退。檀道济继救，亦仅能全军而还。元嘉之治，自此折色。',
    factions: ['nanchao', 'dongwei'],
    factionNameOverride: {
      nanchao: '刘宋', dongwei: '北魏'
    },
    // 特殊规则：刘宋初胜后败，民心波动；北魏铁骑彪悍
    resources: {
      nanchao: { money: 2800, food: 3800 },
      dongwei: { money: 2500, food: 3500 }
    },
    cityMorale: { nanchao: 60, dongwei: 55 },
    generalLoyalty: { nanchao: 72, dongwei: 78 },
    garrisonMult: { nanchao: 1.1, dongwei: 1.2 }
  },

  // ---- 剧本26：江陵之陷（554年）----
  // 历史背景：梁元帝萧绎定都江陵，西魏宇文泰遣于谨、宇文护、杨忠五万骑南下。
  // 梁元帝自负才高，不设备。魏师围城十月，江陵城破，元帝焚藏书十四万卷，被俘遇害。
  // 王僧辩、陈霸先在建康闻讯，遂迎方智。西魏立萧詧为后梁附庸，江陵成为空城。
  '554': {
    id: '554', name: '江陵之陷', year: 554,
    description: '梁元帝萧绎即位江陵，笃好文学，不恤军事。西魏于谨、宇文护突骑五万奄至，梁师连败。城陷，元帝入东阁行殿，焚古今图书十四万卷，以玉柄麈尾扣地曰："读书万卷，犹有今日！"遂为魏军所杀。江南正统，至此不绝如线。',
    factions: ['xiwei', 'nanchao', 'hou_liang'],
    factionNameOverride: {
      xiwei: '西魏', nanchao: '南梁', hou_liang: '后梁'
    },
    // 特殊规则：西魏兵精将猛；梁元帝文弱无备，民心低；后梁为附庸
    resources: {
      xiwei: { money: 3000, food: 4000 },
      nanchao: { money: 1200, food: 2000 },
      hou_liang: { money: 600, food: 1200 }
    },
    cityMorale: { xiwei: 65, nanchao: 35, hou_liang: 50 },
    generalLoyalty: { xiwei: 82, nanchao: 45, hou_liang: 60 },
    garrisonMult: { xiwei: 1.35, nanchao: 0.65, hou_liang: 0.8 }
  },

  // ---- 剧本27：梁武革命（502年）----
  // 历史背景：齐雍州刺史萧衍乘齐末内乱，自襄阳东下，入建康，
  // 杀东昏侯萧宝卷，迎立和帝，寻又受禅自立，改元天监，国号梁。
  // 是时北朝为北魏宣武帝，孝文汉化方盛，南北相持于淮南。
  '502': {
    id: '502', name: '梁武革命', year: 502,
    description: '齐末昏乱，萧衍自襄阳杖义东下，甲士数万，舟楼千里。既平京邑，寻受齐禅，即位南郊，改元天监，是为梁武帝。帝博学能文，在位四十八年，江左文物为南朝之盛。于时北魏承孝文汉化之余，国势方强，屡争淮南。',
    factions: ['nanchao', 'dongwei'],
    factionNameOverride: {
      nanchao: '南梁', dongwei: '北魏'
    },
    // 特殊规则：梁武新造，君臣辑睦，文治方兴；北魏据中原，马步皆精
    resources: {
      nanchao: { money: 2600, food: 3400 },
      dongwei: { money: 2800, food: 3600 }
    },
    cityMorale: { nanchao: 62, dongwei: 58 },
    generalLoyalty: { nanchao: 75, dongwei: 72 },
    garrisonMult: { nanchao: 1.05, dongwei: 1.15 }
  },

  // ============================================================
  // V16.0 新增剧本（1个，27→28）
  // ---- 剧本28：尉迟迥之乱（580年）----
  // 历史背景：北周大象二年（580），周宣帝崩，静帝幼冲，外戚杨坚假黄钺总己以政。
  //   相州总管尉迟迥（宇文泰甥）以宗室重臣，自以受遗寄，不平杨坚专权，遂起兵相州，
  //   赵、魏之士，从者如归，众至数十万。鄴城、青州、赵州皆应之。
  //   杨坚遣韦孝宽、高颎东讨，隔河而阵。孝�为土狗以遏迥船，又焚迥桥以挫其气。
  //   两军战于鄴南，迥军小却，孝宽乘之，迥走保鄴城，城陷，迥登楼射杀数人，
  //   遂被追逼，自刎而死。关中之柄遂专于杨氏，禅代之形已成。
  // 此时南陈宣帝太建十二年，吴明彻已没于周，淮南初失；南陈惟守江而已。
  // 历史考证：《周书·尉迟迥传》《隋书·高祖纪》。
  // ============================================================
  '580': {
    id: '580', name: '尉迟迥之乱', year: 580,
    description: '周宣帝崩，静帝幼冲，外戚杨坚入总朝政。相州总管尉迟迥以周室懿亲，据邺举义，赵魏数十州应之，众数十万。杨坚命韦孝宽东讨，高颎监其军。孝宽临阵，为土狗以遏迥船，又焚桥以挫其气。两军合战，迥军大溃，退保邺城。城陷，迥登楼格杀数人，乃自刎。关东再定，杨氏之业成矣。南陈宣帝闻乱，复谋进取，然吴明彻已没，不复能振。',
    factions: ['xiwei', 'dongwei', 'nanchao'],
    factionNameOverride: {
      xiwei: '北周（杨坚）', dongwei: '相州（尉迟迥）', nanchao: '南陈'
    },
    // 特殊规则：杨坚挟幼主以令百官，关中府兵精悍；尉迟迥义旗一举，山东响应，新附未固；南陈乘虚北窥
    resources: {
      xiwei: { money: 3200, food: 4200 },
      dongwei: { money: 2400, food: 3200 },
      nanchao: { money: 2200, food: 3000 }
    },
    cityMorale: { xiwei: 60, dongwei: 55, nanchao: 55 },
    generalLoyalty: { xiwei: 78, dongwei: 65, nanchao: 68 },
    garrisonMult: { xiwei: 1.25, dongwei: 1.1, nanchao: 1.0 }
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
    pop: 32000, agri: 58, comm: 50, defense: 55, prosperity: 52, taxRate: 30 },

  // === V8.0 新增城市（5座，35→40）===
  // 历史地理参考：
  // 滑台（今河南滑县，兖州治所，黄河渡口，南北要冲）
  // 广陵（今扬州，江北重镇，长江北岸渡口）
  // 下邳（今江苏睢宁，徐州重镇，泗水沿线）
  // 上党（今山西长治，并州门户，太行山地）
  // 蒲坂（今山西永济，河东渡口，黄河要津）
  { id: 'huatai',   name: '滑台', isoX: 8,  isoY: 4,  terrain: 'river',   size: 2, capital: false,
    pop: 32000, agri: 55, comm: 50, defense: 60, prosperity: 50, taxRate: 30 },
  { id: 'guangling', name: '广陵', isoX: 13, isoY: 5,  terrain: 'river',   size: 3, capital: false,
    pop: 48000, agri: 60, comm: 75, defense: 50, prosperity: 65, taxRate: 30 },
  { id: 'xiapi',    name: '下邳', isoX: 13, isoY: 4,  terrain: 'plain',    size: 2, capital: false,
    pop: 30000, agri: 55, comm: 50, defense: 48, prosperity: 48, taxRate: 30 },
  { id: 'shangdang', name: '上党', isoX: 8,  isoY: 2,  terrain: 'mountain', size: 2, capital: false,
    pop: 28000, agri: 45, comm: 35, defense: 65, prosperity: 42, taxRate: 30 },
  { id: 'puban',    name: '蒲坂', isoX: 7,  isoY: 4,  terrain: 'river',   size: 2, capital: false,
    pop: 30000, agri: 55, comm: 45, defense: 60, prosperity: 48, taxRate: 30 },

  // === V10.0 新增城市（5座，40→45）===
  // 历史地理参考：
  // 敦煌（河西走廊西端，丝绸之路重镇，沙漠绿洲，佛教东传节点）
  // 中山（今河北定州一带，河北重镇，后燕都城，太行山东麓）
  // 龙城（今辽宁朝阳，营州治所，鲜卑慕容氏龙兴之地，东北边防）
  // 朔方（今内蒙古河套以南，匈奴故地，北魏六镇前沿，黄河冲积平原）
  // 仇池（今甘肃东南部，氐人杨氏割据，山川险固，战马良马产地）
  { id: 'dunhuang', name: '敦煌', isoX: 2,  isoY: 2,  terrain: 'desert',  size: 2, capital: false,
    pop: 20000, agri: 30, comm: 55, defense: 45, prosperity: 45, taxRate: 30 },
  { id: 'zhongshan', name: '中山', isoX: 10, isoY: 0,  terrain: 'plain',   size: 3, capital: false,
    pop: 38000, agri: 65, comm: 60, defense: 55, prosperity: 60, taxRate: 30 },
  { id: 'longcheng', name: '龙城', isoX: 13, isoY: 1,  terrain: 'plain',   size: 2, capital: false,
    pop: 25000, agri: 45, comm: 40, defense: 55, prosperity: 42, taxRate: 30 },
  { id: 'shuofang', name: '朔方', isoX: 5,  isoY: 1,  terrain: 'desert',  size: 2, capital: false,
    pop: 22000, agri: 40, comm: 35, defense: 55, prosperity: 38, taxRate: 30 },
  { id: 'qiuchi',   name: '仇池', isoX: 5,  isoY: 6,  terrain: 'mountain', size: 1, capital: false,
    pop: 15000, agri: 40, comm: 30, defense: 65, prosperity: 30, taxRate: 30 },

  // === V11.0 新增城市（5座，45→50）===
  // 历史地理参考：
  // 宁州（味县，今云南曲靖，南中重镇，诸葛亮南征后设置，西南边陲）
  // 吴兴（今浙江湖州，江南富庶之地，沈氏钱氏望族聚居，丝绸之府）
  // 豫章（今江西南昌，江州治所，长江中游重镇，扼鄱阳湖之口）
  // 统万（今陕西靖边北，匈奴赫连勃勃所建大夏国都，"一统天下，君临万邦"）
  // 武陵（今湖南常德，荆州南部要冲，五溪蛮地，沅水流域）
  { id: 'ningzhou',  name: '宁州', isoX: 3,  isoY: 10, terrain: 'forest',  size: 1, capital: false,
    pop: 18000, agri: 35, comm: 40, defense: 40, prosperity: 35, taxRate: 30 },
  { id: 'wuxing',    name: '吴兴', isoX: 13, isoY: 8,  terrain: 'plain',   size: 3, capital: false,
    pop: 48000, agri: 72, comm: 72, defense: 45, prosperity: 68, taxRate: 30 },
  { id: 'yuzhang',   name: '豫章', isoX: 12, isoY: 9,  terrain: 'river',   size: 3, capital: false,
    pop: 45000, agri: 65, comm: 60, defense: 50, prosperity: 60, taxRate: 30 },
  { id: 'tongwan',   name: '统万', isoX: 6,  isoY: 0,  terrain: 'desert',  size: 2, capital: false,
    pop: 22000, agri: 35, comm: 30, defense: 70, prosperity: 35, taxRate: 30 },
  { id: 'wuling',    name: '武陵', isoX: 9,  isoY: 8,  terrain: 'river',   size: 2, capital: false,
    pop: 28000, agri: 50, comm: 40, defense: 45, prosperity: 42, taxRate: 30 },

  // === V12.0 新增城市（5座，50→55）===
  // 历史地理参考：
  // 京口（今江苏镇江，北府兵根据地，刘裕故乡，建康北门，长江渡口重镇）
  // 义阳（今河南信阳，南北要冲，北防南阳洛阳，南控江夏，义阳三关）
  // 钟离（今安徽凤阳，北魏南征要塞，钟离之战（507）韦睿大破元英之地）
  // 历城（今山东济南，山东重镇，慕容白曜平齐地时攻破历城擒沈文秀）
  // 武昌（今湖北鄂州，长江中游重镇，孙权古都，与夏口隔江呼应）
  { id: 'jingkou',   name: '京口', isoX: 12, isoY: 7,  terrain: 'river',   size: 2, capital: false,
    pop: 35000, agri: 55, comm: 55, defense: 55, prosperity: 55, taxRate: 30 },
  { id: 'yiyang',    name: '义阳', isoX: 10, isoY: 6,  terrain: 'mountain', size: 2, capital: false,
    pop: 30000, agri: 50, comm: 40, defense: 60, prosperity: 45, taxRate: 30 },
  { id: 'zhongli2',  name: '钟离', isoX: 12, isoY: 2,  terrain: 'plain',    size: 2, capital: false,
    pop: 28000, agri: 50, comm: 40, defense: 55, prosperity: 45, taxRate: 30 },
  { id: 'licheng',   name: '历城', isoX: 13, isoY: 3,  terrain: 'plain',    size: 2, capital: false,
    pop: 32000, agri: 55, comm: 50, defense: 48, prosperity: 50, taxRate: 30 },
  { id: 'wuchang',   name: '武昌', isoX: 10, isoY: 8,  terrain: 'river',    size: 2, capital: false,
    pop: 28000, agri: 50, comm: 45, defense: 50, prosperity: 48, taxRate: 30 },

  // === V13.0 新增城市（5座，55→60）===
  // 历史地理参考：
  // 酒泉（今甘肃酒泉，河西走廊重镇，丝绸之路要冲，霍去病击匈奴得名"酒泉"）
  // 濮阳（今河南濮阳，黄河古渡，南北要冲，北魏南征必经之地）
  // 竟陵（今湖北钟祥，荆州北部重镇，竟陵郡，武陵王萧骏曾镇于此）
  // 桂阳（今湖南郴州，岭南咽喉，湘桂门户，五岭通道）
  // 渔阳（今北京密云西南，幽州南部重镇，乌桓鲜卑南下要冲）
  { id: 'jiuquan',   name: '酒泉', isoX: 2,  isoY: 3,  terrain: 'desert',  size: 2, capital: false,
    pop: 22000, agri: 35, comm: 50, defense: 45, prosperity: 42, taxRate: 30 },
  { id: 'puyang',   name: '濮阳', isoX: 10, isoY: 3,  terrain: 'river',   size: 2, capital: false,
    pop: 32000, agri: 55, comm: 50, defense: 55, prosperity: 50, taxRate: 30 },
  { id: 'jingling',  name: '竟陵', isoX: 10, isoY: 5,  terrain: 'mountain', size: 2, capital: false,
    pop: 28000, agri: 50, comm: 40, defense: 55, prosperity: 45, taxRate: 30 },
  { id: 'guiyang',  name: '桂阳', isoX: 11, isoY: 9,  terrain: 'river',   size: 2, capital: false,
    pop: 25000, agri: 45, comm: 50, defense: 40, prosperity: 45, taxRate: 30 },
  { id: 'yuyang',    name: '渔阳', isoX: 12, isoY: 1,  terrain: 'plain',   size: 2, capital: false,
    pop: 30000, agri: 50, comm: 45, defense: 50, prosperity: 48, taxRate: 30 }

  // === V14.0 新增城市（12座，60→72，v14_ 前缀 id）===
  // 历史地理参考：
  // 灵武（今宁夏灵武，朔方重镇，黄河河套，唐肃宗即位之地）
  // 夏州（今陕西靖边北，统万城故地，赫连勃勃所建，大夏都城）
  // 延州（今陕西延安，陕北重镇，鄜延路，边防要冲）
  // 华州（今陕西华县，潼关附近，京畿东门，郑县故地）
  // 岐州（今陕西凤翔，关中西部，扶风郡，丝绸之路重镇）
  // 豳州（今陕西彬县，关中西北，古公亶父之国，丝绸之路要道）
  // 凤州（今陕西凤县，连云栈道北口，关中入蜀咽喉）
  // 利州（今四川广元，蜀北门户，金牛道上，武则天出生地）
  // 信州（今重庆奉节，三峡西口，白帝城，江关要塞）
  // 衡州（今湖南衡阳，湘水流域，岭南门户）
  // 郴州（今湖南郴州，五岭北麓，湘粤通道）
  // 崖州（今海南琼山，珠崖故地，岭南最南，海疆重镇）
  // 坐标原则：不与现有城市重叠，覆盖西北、西南、岭南空白区域。
  ,
  { id: 'v14_lingwu',  name: '灵武', isoX: 4,  isoY: 1,  terrain: 'desert',  size: 2, capital: false,
    pop: 25000, agri: 40, comm: 35, defense: 55, prosperity: 40, taxRate: 30 },
  { id: 'v14_xiazhou', name: '夏州', isoX: 5,  isoY: 0,  terrain: 'desert',  size: 2, capital: false,
    pop: 22000, agri: 35, comm: 30, defense: 60, prosperity: 38, taxRate: 30 },
  { id: 'v14_yanzhou', name: '延州', isoX: 6,  isoY: 2,  terrain: 'mountain', size: 2, capital: false,
    pop: 28000, agri: 45, comm: 35, defense: 60, prosperity: 42, taxRate: 30 },
  { id: 'v14_huazhou', name: '华州', isoX: 7,  isoY: 3,  terrain: 'plain',   size: 2, capital: false,
    pop: 32000, agri: 55, comm: 45, defense: 60, prosperity: 50, taxRate: 30 },
  { id: 'v14_qizhou',  name: '岐州', isoX: 4,  isoY: 4,  terrain: 'mountain', size: 2, capital: false,
    pop: 30000, agri: 50, comm: 45, defense: 50, prosperity: 48, taxRate: 30 },
  { id: 'v14_bingzhou', name: '豳州', isoX: 3,  isoY: 4,  terrain: 'mountain', size: 1, capital: false,
    pop: 18000, agri: 35, comm: 25, defense: 45, prosperity: 32, taxRate: 30 },
  { id: 'v14_fengzhou', name: '凤州', isoX: 7,  isoY: 6,  terrain: 'mountain', size: 1, capital: false,
    pop: 18000, agri: 35, comm: 30, defense: 55, prosperity: 35, taxRate: 30 },
  { id: 'v14_lizhou',  name: '利州', isoX: 5,  isoY: 7,  terrain: 'mountain', size: 2, capital: false,
    pop: 28000, agri: 45, comm: 40, defense: 55, prosperity: 45, taxRate: 30 },
  { id: 'v14_xinzhou',  name: '信州', isoX: 8,  isoY: 7,  terrain: 'river',   size: 2, capital: false,
    pop: 30000, agri: 50, comm: 45, defense: 60, prosperity: 48, taxRate: 30 },
  { id: 'v14_hengzhou', name: '衡州', isoX: 9,  isoY: 9,  terrain: 'river',   size: 2, capital: false,
    pop: 28000, agri: 50, comm: 40, defense: 45, prosperity: 45, taxRate: 30 },
  { id: 'v14_chenzhou', name: '郴州', isoX: 10, isoY: 10, terrain: 'river',   size: 2, capital: false,
    pop: 25000, agri: 45, comm: 45, defense: 40, prosperity: 42, taxRate: 30 },
  { id: 'v14_yaizhou',  name: '崖州', isoX: 11, isoY: 12, terrain: 'forest',  size: 1, capital: false,
    pop: 15000, agri: 30, comm: 35, defense: 35, prosperity: 30, taxRate: 30 }
];

// 城市邻接关系（行军路径，双向对称）— V6.5 覆盖全部 35 城
export const CITY_LINKS = {
  // 江东
  jiankang:   ['jiangling', 'shouyang', 'guangzhou', 'wujun', 'jiangzhou', 'yingcheng', 'yuzhou', 'hefei', 'guangling', 'jingkou'],
  wujun:      ['jiankang', 'kuaiji', 'jiangzhou', 'guangling', 'wuxing', 'jingkou'],
  kuaiji:     ['wujun', 'jiangzhou', 'wuxing'],
  jiangzhou:  ['jiankang', 'guangzhou', 'yingcheng', 'wujun', 'kuaiji', 'xiangzhou', 'jiangxia', 'guangling', 'yuzhang', 'jingkou'],
  guangzhou:  ['jiankang', 'jiangzhou', 'xiangzhou', 'jiaozhou', 'ningzhou', 'guiyang', 'v14_yaizhou'],
  jiaozhou:   ['guangzhou', 'xiangzhou', 'v14_yaizhou'],
  // 河北
  yecheng:    ['jinyang', 'luoyang', 'pengcheng', 'xiangguo', 'xindu', 'puyang'],
  jinyang:    ['yecheng', 'pingcheng', 'luoyang', 'xiangguo', 'dingzhou', 'shangdang'],
  luoyang:    ['yecheng', 'jinyang', 'shouyang', 'xiangyang', 'changan', 'runan', 'nanyang', 'huatai', 'shangdang', 'puyang', 'v14_huazhou'],
  pengcheng:  ['yecheng', 'qingzhou', 'shouyang', 'xindu', 'yuzhou', 'qiaojun', 'hefei', 'xiapi', 'zhongli2', 'licheng'],
  qingzhou:   ['pengcheng', 'youzhou', 'xindu', 'yingzhou', 'xiapi', 'longcheng', 'licheng', 'yuyang'],
  youzhou:    ['qingzhou', 'pingcheng', 'dingzhou', 'yingzhou', 'zhongshan', 'yuyang'],
  shouyang:   ['pengcheng', 'luoyang', 'xiangyang', 'jiankang', 'jiangling', 'yuzhou', 'runan', 'hefei', 'zhongli2'],
  xiangguo:   ['jinyang', 'yecheng', 'dingzhou', 'xindu', 'zhongshan'],
  xindu:      ['yecheng', 'qingzhou', 'pengcheng', 'xiangguo', 'yingzhou', 'qiaojun', 'zhongshan', 'puyang'],
  dingzhou:   ['jinyang', 'youzhou', 'pingcheng', 'xiangguo'],
  yingzhou:   ['youzhou', 'qingzhou', 'xindu', 'zhongshan', 'longcheng', 'yuyang'],
  // 关中巴蜀
  changan:    ['luoyang', 'tianshui', 'pingcheng', 'xiangyang', 'longyou', 'hanzhong', 'huatai', 'puban', 'tongwan', 'v14_yanzhou', 'v14_huazhou'],
  tianshui:   ['changan', 'guzang', 'chengdu', 'longyou', 'puban', 'qiuchi', 'v14_qizhou'],
  guzang:     ['tianshui', 'pingcheng', 'longyou', 'dunhuang', 'shuofang', 'jiuquan', 'v14_lingwu', 'v14_bingzhou'],
  pingcheng:  ['guzang', 'changan', 'jinyang', 'youzhou', 'dingzhou', 'shangdang', 'shuofang', 'tongwan', 'v14_xiazhou', 'v14_yanzhou'],
  longyou:    ['guzang', 'tianshui', 'changan', 'puban', 'shuofang', 'jiuquan', 'v14_qizhou', 'v14_bingzhou'],
  hanzhong:   ['changan', 'chengdu', 'xinye', 'qiuchi', 'v14_fengzhou', 'v14_lizhou'],
  chengdu:    ['jiangling', 'tianshui', 'hanzhong', 'ningzhou', 'v14_lizhou'],
  // 荆州（后梁）
  jiangling:  ['jiankang', 'chengdu', 'xiangyang', 'shouyang', 'yingcheng', 'xiangzhou', 'xinye', 'jiangxia', 'nanyang', 'wuling', 'wuchang', 'jingling', 'v14_xinzhou'],
  xiangyang:  ['jiangling', 'shouyang', 'luoyang', 'changan', 'xinye', 'nanyang', 'jingling'],
  // 湘郢（王琳）
  yingcheng:  ['jiangling', 'jiankang', 'jiangzhou', 'xiangzhou', 'jiangxia', 'yuzhang'],
  xiangzhou:  ['jiangling', 'guangzhou', 'yingcheng', 'jiaozhou', 'jiangzhou', 'yuzhang', 'wuling', 'wuchang', 'guiyang', 'v14_hengzhou', 'v14_chenzhou'],
  // 豫州（萧庄）
  yuzhou:     ['shouyang', 'jiankang', 'pengcheng', 'hefei', 'jiangxia'],
  xinye:      ['xiangyang', 'jiangling', 'hanzhong', 'nanyang', 'wuling', 'yiyang', 'jingling', 'v14_fengzhou'],
  // ---- V6.5 新增城市连接 ----
  jiangxia:   ['jiangling', 'yingcheng', 'jiangzhou', 'yuzhou', 'hefei', 'yiyang', 'wuchang'],
  nanyang:    ['jiangling', 'xiangyang', 'xinye', 'luoyang', 'huatai', 'puban', 'yiyang'],
  runan:      ['luoyang', 'shouyang', 'qiaojun', 'yiyang', 'puyang', 'jingling'],
  qiaojun:    ['pengcheng', 'xindu', 'runan', 'zhongli2', 'puyang'],
  hefei:      ['pengcheng', 'shouyang', 'jiankang', 'yuzhou', 'jiangxia', 'xiapi', 'zhongli2'],
  // ---- V8.0 新增城市连接（5座）----
  huatai:     ['luoyang', 'changan', 'nanyang', 'shangdang', 'puban', 'v14_huazhou'],
  guangling:  ['jiankang', 'wujun', 'xiapi', 'jiangzhou', 'wuxing', 'jingkou'],
  xiapi:      ['guangling', 'pengcheng', 'qingzhou', 'hefei', 'licheng'],
  shangdang:  ['jinyang', 'luoyang', 'huatai', 'pingcheng'],
  puban:      ['changan', 'huatai', 'tianshui', 'longyou', 'nanyang', 'v14_yanzhou', 'v14_huazhou', 'v14_qizhou'],
  // ---- V10.0 新增城市连接（5座）----
  dunhuang:  ['guzang', 'jiuquan'],
  zhongshan:  ['xiangguo', 'youzhou', 'yingzhou', 'xindu'],
  longcheng:  ['qingzhou', 'yingzhou', 'licheng', 'yuyang'],
  shuofang:   ['pingcheng', 'guzang', 'longyou', 'tongwan', 'v14_lingwu', 'v14_xiazhou'],
  qiuchi:     ['hanzhong', 'tianshui', 'v14_lizhou'],
  // ---- V11.0 新增城市连接（5座）----
  ningzhou:   ['chengdu', 'guangzhou'],
  wuxing:     ['wujun', 'kuaiji', 'guangling', 'yuzhang'],
  yuzhang:    ['jiangzhou', 'wuxing', 'yingcheng', 'xiangzhou', 'wuling', 'wuchang', 'guiyang', 'v14_chenzhou'],
  tongwan:    ['pingcheng', 'shuofang', 'changan', 'v14_lingwu', 'v14_xiazhou', 'v14_yanzhou'],
  wuling:     ['jiangling', 'xiangzhou', 'yuzhang', 'xinye', 'guiyang', 'v14_xinzhou', 'v14_hengzhou'],
  // ---- V12.0 新增城市连接（5座）----
  jingkou:    ['jiankang', 'guangling', 'wujun', 'jiangzhou'],
  yiyang:     ['xinye', 'jiangxia', 'nanyang', 'runan', 'jingling'],
  zhongli2:   ['pengcheng', 'shouyang', 'qiaojun', 'hefei', 'yuyang'],
  licheng:    ['qingzhou', 'pengcheng', 'xiapi', 'longcheng'],
  wuchang:    ['jiangxia', 'jiangling', 'xiangzhou', 'yuzhang', 'v14_xinzhou', 'v14_hengzhou'],
  // ---- V13.0 新增城市连接（5座）----
  jiuquan:    ['dunhuang', 'guzang', 'longyou'],
  puyang:     ['yecheng', 'luoyang', 'runan', 'xindu', 'qiaojun'],
  jingling:   ['xiangyang', 'jiangling', 'runan', 'yiyang', 'xinye'],
  guiyang:    ['guangzhou', 'xiangzhou', 'wuling', 'yuzhang', 'v14_chenzhou'],
  yuyang:     ['youzhou', 'yingzhou', 'zhongli2', 'qingzhou', 'longcheng'],
  // ---- V14.0 新增城市连接（12座）----
  // 每座新城连接 2~3 座相邻城市，双向对称。
  v14_lingwu:  ['guzang', 'shuofang', 'tongwan', 'v14_xiazhou'],
  v14_xiazhou: ['tongwan', 'shuofang', 'pingcheng', 'v14_lingwu', 'v14_yanzhou'],
  v14_yanzhou: ['pingcheng', 'tongwan', 'changan', 'puban', 'v14_xiazhou', 'v14_huazhou'],
  v14_huazhou: ['changan', 'puban', 'luoyang', 'huatai', 'v14_yanzhou'],
  v14_qizhou:  ['tianshui', 'longyou', 'puban', 'v14_bingzhou'],
  v14_bingzhou:['longyou', 'guzang', 'v14_qizhou'],
  v14_fengzhou:['hanzhong', 'xinye', 'v14_xinzhou', 'v14_lizhou'],
  v14_lizhou:  ['chengdu', 'hanzhong', 'qiuchi', 'v14_fengzhou'],
  v14_xinzhou: ['wuchang', 'jiangling', 'wuling', 'v14_fengzhou', 'v14_hengzhou'],
  v14_hengzhou:['xiangzhou', 'wuling', 'wuchang', 'v14_xinzhou', 'v14_chenzhou'],
  v14_chenzhou:['xiangzhou', 'guiyang', 'yuzhang', 'v14_hengzhou'],
  v14_yaizhou: ['jiaozhou', 'guangzhou']
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
    command: 90, force: 82, intel: 90, politics: 95, loyalty: 70, portrait: 'yang_jian' }, // 357

  // === V8.0 新增武将（10位，60→70）===
  // 历史背景：南北朝末期，北周（隋）代周建隋、灭陈统一之名将名臣。
  // 杨素（字处道，弘农华阴人，隋灭陈主帅，率水军自三峡东下，战功赫赫）
  { id: 'yang_su',    name: '杨素',   faction: 'xiwei', role: '谋将',
    command: 92, force: 80, intel: 85, politics: 82, loyalty: 85, portrait: 'yang_su' }, // 339
  // 高颎（字昭玄，隋开国首相，平陈元帅长史，荐韩擒虎贺若弼，治国良才）
  { id: 'gao_jiong',  name: '高颎',   faction: 'xiwei', role: '谋臣',
    command: 70, force: 55, intel: 88, politics: 92, loyalty: 85, portrait: 'gao_jiong' }, // 305
  // 韩擒虎（字子通，隋灭陈先锋，率五百骑夜渡采石直取建康，俘陈叔宝）
  { id: 'han_qinhu',  name: '韩擒虎', faction: 'xiwei', role: '猛将',
    command: 82, force: 92, intel: 70, politics: 55, loyalty: 82, portrait: 'han_qinhu' }, // 299
  // 贺若弼（字辅伯，隋灭陈主帅，广陵屯兵，渡江破京口，其父刺舌诫慎口）
  { id: 'he_ruobi',   name: '贺若弼', faction: 'xiwei', role: '名将',
    command: 88, force: 85, intel: 78, politics: 60, loyalty: 80, portrait: 'he_ruobi' }, // 311
  // 史万岁（京兆杜陵人，隋第一猛将，单骑冲阵千余，转战千里竹筒传书）
  { id: 'shi_wansui', name: '史万岁', faction: 'xiwei', role: '猛将',
    command: 82, force: 96, intel: 65, politics: 50, loyalty: 78, portrait: 'shi_wansui' }, // 293
  // 李穆（字显庆，北周名将，附杨坚代周，累功上柱国）
  { id: 'li_mu',      name: '李穆',   faction: 'xiwei', role: '名臣',
    command: 78, force: 72, intel: 75, politics: 85, loyalty: 85, portrait: 'li_mu' }, // 310
  // 王谊（字宜君，北周名将，伐陈破蛮，杨坚少时与同学情好）
  { id: 'wang_yi',    name: '王谊',   faction: 'xiwei', role: '名将',
    command: 76, force: 74, intel: 70, politics: 72, loyalty: 80, portrait: 'wang_yi' }, // 292
  // ---- 在野人才（科举/招募目标）----
  // 苏威（字无畏，隋名臣，苏绰之子，治绩天下第一）
  { id: 'su_wei',     name: '苏威',   faction: null, role: '文臣',
    command: 45, force: 35, intel: 82, politics: 88, loyalty: 60, portrait: 'su_wei' }, // 250
  // 长孙晟（字季晟，一箭双雕，隋突厥外交家，唐太宗长孙皇后之父）
  { id: 'zhangsun_sheng', name: '长孙晟', faction: null, role: '外交家',
    command: 75, force: 80, intel: 90, politics: 78, loyalty: 60, portrait: 'zhangsun_sheng' }, // 323
  // 麦铁杖（隋猛将，骁勇膂力绝人，后征高句丽战死）
  { id: 'mai_tiezhang', name: '麦铁杖', faction: null, role: '猛将',
    command: 70, force: 94, intel: 45, politics: 35, loyalty: 55, portrait: 'mai_tiezhang' }, // 244

  // === V8.5 新增武将（5位，70→75）===
  // 历史背景：南北朝末世「昏主名将」——陈后主叔宝、北周宣帝赟、北齐后主纬，
  // 及北周三总管之乱中的司马消难、王谦。此数人皆为隋文统一前夜的关键人物。
  // 陈叔宝（字元秀，陈朝末代皇帝，即陈后主，好诗文耽酒色，隋师渡江时犹唱《玉树后庭花》）
  { id: 'chen_shubao', name: '陈叔宝', faction: 'nanchao', role: '后主',
    command: 40, force: 35, intel: 75, politics: 50, loyalty: 80, portrait: 'chen_shubao' }, // 200
  // 宇文赟（字乾伯，北周宣帝，骄奢淫佚，即位即大肆奢靡，禅位太子自称天元皇帝）
  { id: 'yuwen_yun', name: '宇文赟', faction: 'xiwei', role: '宣帝',
    command: 45, force: 40, intel: 60, politics: 35, loyalty: 70, portrait: 'yuwen_yun' }, // 180
  // 高纬（字仁纲，北齐后主，宠冯淑妃，杀斛律光高长恭，亡国之君，无愁天子）
  { id: 'gao_wei', name: '高纬', faction: 'dongwei', role: '后主',
    command: 42, force: 38, intel: 55, politics: 30, loyalty: 65, portrait: 'gao_wei' }, // 165
  // 司马消难（北齐降将，北周郧国公，尉迟迥起兵讨杨坚时举兵应之，败奔陈）
  { id: 'sima_xiaonan', name: '司马消难', faction: 'xiwei', role: '叛将',
    command: 70, force: 65, intel: 68, politics: 60, loyalty: 50, portrait: 'sima_xiaonan' }, // 263
  // 王谦（北周益州总管，以匡复为辞举兵讨杨坚，兵败被杀，蜀地响应）
  { id: 'wang_qian', name: '王谦', faction: 'xiwei', role: '叛将',
    command: 68, force: 70, intel: 55, politics: 58, loyalty: 55, portrait: 'wang_qian' }, // 251

  // === V9.0 新增武将（5位，75→80）===
  // 历史背景：北魏末乱世枭雄与梁魏英主——补全六镇之乱至东西魏对峙一代人物。
  // 尔朱荣（字天宝，北秀容人，北魏权臣太原王，河阴之变溺胡太后、诛百官，
  //   破六镇、定河北，用兵如神，功高震主，后为孝庄帝所杀）
  { id: 'er_zhurong', name: '尔朱荣', faction: 'dongwei', role: '权臣',
    command: 95, force: 85, intel: 88, politics: 88, loyalty: 90, portrait: 'er_zhurong' }, // 356
  // 侯景（字万景，朔方人，羯族，先属尔朱荣、再降高欢、后叛降萧衍，
  //   发动侯景之乱困死梁武帝，篡汉自立，凶残反复，终为部下所杀）
  { id: 'hou_jing', name: '侯景', faction: null, role: '叛将',
    command: 82, force: 88, intel: 70, politics: 40, loyalty: 30, portrait: 'hou_jing' }, // 280
  // 萧衍（即梁武帝，字叔达，南梁开国皇帝，三次舍身同泰寺，
  //   早年雄才大略中兴梁业，晚年佞信佛纳侯景，终遭台城之围饿死）
  { id: 'xiao_yan', name: '萧衍', faction: 'nanchao', role: '武帝',
    command: 78, force: 55, intel: 88, politics: 90, loyalty: 95, portrait: 'xiao_yan' }, // 311
  // 元宏（即魏孝文帝拓跋宏，迁都洛阳、改姓元、汉化改制，
  //   南征北略，文治武功，为北魏鼎盛之主，英年早逝）
  { id: 'yuan_hong', name: '元宏', faction: 'xiwei', role: '孝文帝',
    command: 75, force: 50, intel: 90, politics: 95, loyalty: 95, portrait: 'yuan_hong' }, // 310
  // 王思政（西魏名将，韦孝宽同侪，守颍川以少敌众，
  //   城陷以身殉，忠勇不屈，玉璧/颍川守城典范）
  { id: 'wang_sizheng', name: '王思政', faction: 'xiwei', role: '名将',
    command: 84, force: 78, intel: 82, politics: 70, loyalty: 88, portrait: 'wang_sizheng' },  // 302

  // === V9.5 新增武将（5位）：北魏太武帝一朝及前期 ===
  // 历史：拓跋焘（北魏太武帝，鲜卑雄主，北击柔然南拒刘宋，一统北方，太平真君年间灭佛）
  { id: 'tuoba_tao', name: '拓跋焘', faction: 'dongwei', role: '君主',
    command: 90, force: 85, intel: 82, politics: 86, loyalty: 100, portrait: 'tuoba_tao' }, // 343
  // 历史：崔浩（北魏司徒，汉人士族领袖，辅佐太武灭佛、统一北方，后因国史之狱被诛）
  { id: 'cui_hao', name: '崔浩', faction: 'dongwei', role: '谋主',
    command: 70, force: 40, intel: 92, politics: 90, loyalty: 80, portrait: 'cui_hao' }, // 292
  // 历史：冯太后（北魏文明太后，临朝听政，推行太和改制，孝文帝汉化改革之先导）
  { id: 'feng_taihou', name: '冯太后', faction: 'dongwei', role: '女主',
    command: 60, force: 45, intel: 88, politics: 95, loyalty: 90, portrait: 'feng_taihou' }, // 288
  // 历史：杨大眼（北魏猛将，骁勇善战，当世推其胆气，王朗之伦也）
  { id: 'yang_dayan', name: '杨大眼', faction: 'dongwei', role: '猛将',
    command: 80, force: 94, intel: 50, politics: 40, loyalty: 75, portrait: 'yang_dayan' }, // 264
  // 历史：元勰（北魏彭城王，孝文帝弟，孝友恪慎，才望兼济，后为高肇所谮死）
  { id: 'yuan_xie', name: '元勰', faction: 'dongwei', role: '宗室',
    command: 78, force: 72, intel: 85, politics: 88, loyalty: 92, portrait: 'yuan_xie' },  // 285

  // === V10.0 新增武将（5位，85→90）：东晋北府一代 ===
  // 历史背景：淝水之战（383）至刘裕代晋（420）——东晋北府兵兴起、
  //   刘裕北伐代晋建宋一代人物。补全六朝偏安与北伐脉络。
  // 谢安（字安石，陈郡阳夏人，东晋宰相，淝水之战征讨大都督，
  //   从容镇定，围棋赌墅，举荐谢玄练北府兵，东山再起）
  { id: 'xie_an',    name: '谢安',   faction: 'nanchao', role: '宰相',
    command: 75, force: 45, intel: 92, politics: 95, loyalty: 95, portrait: 'xie_an' }, // 307
  // 谢玄（字幼度，谢安侄，北府兵创建者，淝水之战前锋都督，
  //   率八千北府兵渡淝水大破苻坚，收复徐兖青司豫梁六州）
  { id: 'xie_xuan',  name: '谢玄',   faction: 'nanchao', role: '名将',
    command: 88, force: 82, intel: 85, politics: 75, loyalty: 85, portrait: 'xie_xuan' }, // 330
  // 苻坚（字永固，氐族，前秦宣昭帝，王猛辅佐统一北方，
  //   淝水之战大败，风声鹤唳草木皆兵，后为姚苌所弑）
  { id: 'fu_jian',   name: '苻坚',   faction: 'xiwei', role: '君主',
    command: 85, force: 75, intel: 80, politics: 85, loyalty: 100, portrait: 'fu_jian' }, // 325
  // 刘裕（字德舆，小名寄奴，北府兵出身，灭南燕后秦，
  //   却月阵破北魏铁骑，收复长安洛阳，代晋建宋，为宋武帝）
  { id: 'liu_yu',    name: '刘裕',   faction: 'nanchao', role: '武帝',
    command: 95, force: 88, intel: 85, politics: 90, loyalty: 100, portrait: 'liu_yu' }, // 358
  // 王镇恶（王猛之孙，刘裕北伐前锋，攻克长安灭后秦，
  //   勇略过人，后与沈田子相疑遇害于长安）
  { id: 'wang_zhen_e', name: '王镇恶', faction: 'nanchao', role: '名将',
    command: 86, force: 85, intel: 75, politics: 60, loyalty: 80, portrait: 'wang_zhen_e' }, // 316

  // === V11.0 新增武将（5位，90→95）：北魏中期及南朝齐梁名将 ===
  // 历史背景：北魏献文孝文时期（466~499），魏宋（齐）在青冀淮北拉锯，
  //   慕容白曜平齐地、元英镇南梁、邢峦经略梁益；南朝陈伯之反复于齐魏之间，
  //   薛安都骁勇归魏献徐州。补全南北中期名将图谱。
  // 慕容白曜（前燕慕容氏后裔，北魏名将，皇兴初攻宋青冀，一旬拔四城，
  //   围历城破东阳擒沈文秀，封济南王。后因依附乙浑被诛，时人冤之）
  { id: 'murong_baiyao', name: '慕容白曜', faction: 'dongwei', role: '济南王',
    command: 88, force: 80, intel: 78, politics: 72, loyalty: 82, portrait: 'murong_baiyao' }, // 318
  // 元英（拓跋桢之子，北魏景穆帝嫡孙，封中山王，骁勇善战有将帅才，
  //   屡破南朝梁军，钟离之败后惭愤而卒）
  { id: 'yuan_ying', name: '元英', faction: 'dongwei', role: '中山王',
    command: 84, force: 82, intel: 70, politics: 65, loyalty: 85, portrait: 'yuan_ying' }, // 301
  // 邢峦（字洪宾，北魏名将，文才武略兼备，征梁益破诸葛俨，
  //   克巴西平仇池，有"薛太朱"之目，朝野倚重）
  { id: 'xing_luan', name: '邢峦', faction: 'dongwei', role: '谋将',
    command: 82, force: 68, intel: 86, politics: 80, loyalty: 80, portrait: 'xing_luan' }, // 316
  // 陈伯之（南朝齐梁间名将，为江州刺史，后降魏，梁武帝遣丘迟作《与陈伯之书》
  //   "暮春三月江南草长"招之，复归梁。骁勇善战，目不知书）
  { id: 'chen_bozhi', name: '陈伯之', faction: 'nanchao', role: '边将',
    command: 78, force: 84, intel: 55, politics: 45, loyalty: 65, portrait: 'chen_bozhi' }, // 262
  // 薛安都（河东汾阴人，刘宋猛将，骁勇善骑射，举彭城降魏，
  //   北魏授徐州刺史河东公。渭口之战单骑冲阵，勇冠三军）
  { id: 'xue_andu', name: '薛安都', faction: 'dongwei', role: '猛将',
    command: 80, force: 92, intel: 55, politics: 50, loyalty: 75, portrait: 'xue_andu' }, // 277

  // === V12.0 新增武将（5位，95→100）：南北朝名将补遗 ===
  // 历史背景：补全十七史百将传及南北朝关键人物——
  //   宇文宪（北周齐炀王，周武帝异母弟，灭齐先锋，后为宣帝所忌杀）
  //   程灵洗（陈朝水军名将，大破王琳于芜湖，守郢城拒周师，谥忠壮）
  //   萧道成（齐高帝，刘宋末领军将军，乘宗室相残代宋建齐，改元建元）
  //   沈庆之（刘宋宿将，字弘先，三朝元老，平刘劭、破蛮族，后为前废帝所杀）
  //   冯道根（梁名将，字巨基，阜城、邵阳之捷，谨厚寡言，为南朝良将典范）
  // 历史参考：《周书·齐炀王宪传》《陈书·程灵洗传》《南齐书·高帝纪》
  //           《宋书·沈庆之传》《梁书·冯道根传》《十七史百将传》
  { id: 'yuwen_xian', name: '宇文宪', faction: 'xiwei', role: '齐炀王',
    command: 88, force: 82, intel: 80, politics: 78, loyalty: 92, portrait: 'yuwen_xian' }, // 328
  { id: 'cheng_lingxi', name: '程灵洗', faction: 'nanchao', role: '水军名将',
    command: 82, force: 80, intel: 72, politics: 65, loyalty: 82, portrait: 'cheng_lingxi' }, // 299
  { id: 'xiao_daocheng', name: '萧道成', faction: 'nanchao', role: '齐高帝',
    command: 82, force: 72, intel: 85, politics: 92, loyalty: 95, portrait: 'xiao_daocheng' }, // 331
  { id: 'shen_qingzhi', name: '沈庆之', faction: 'nanchao', role: '宿将',
    command: 86, force: 80, intel: 75, politics: 68, loyalty: 85, portrait: 'shen_qingzhi' }, // 309
  { id: 'feng_daogen', name: '冯道根', faction: 'nanchao', role: '名将',
    command: 80, force: 78, intel: 72, politics: 75, loyalty: 85, portrait: 'feng_daogen' }, // 305

  // === V13.0 新增武将（5位，100→105）：南齐东魏西魏中期名将补遗 ===
  // 历史背景：南北朝中期（480~540）南北拉锯战关键人物。
  //   裴叔业（南齐豫州刺史，500年举寿阳降魏，南北疆域大变）
  //   陈显达（南齐太尉，499年北伐兵败，后起兵东昏侯败死）
  //   垣崇祖（南齐豫州刺史，守寿春堰水灌魏师，萧道成心腹）
  //   尧雄（东魏豫州刺史，韩陵后镇河南，破梁军有治绩）
  //   王罴（西魏华州刺史，沙苑战前守冯翊，赤足陷阵，宇文泰西方屏障）
  // 历史参考：《南齐书·裴叔业传》《南齐书·陈显达传》《南齐书·垣崇祖传》
  //           《北史·尧雄传》《北史·王罴传》
  // 势力映射：南齐→nanchao（在野），东魏→dongwei，西魏→xiwei
  { id: 'pei_shuye',  name: '裴叔业', faction: null, role: '边将',
    command: 82, force: 78, intel: 72, politics: 65, loyalty: 55, portrait: 'pei_shuye' }, // 297
  { id: 'chen_xianda', name: '陈显达', faction: null, role: '太尉',
    command: 84, force: 80, intel: 70, politics: 68, loyalty: 60, portrait: 'chen_xianda' }, // 302
  { id: 'yuan_chongzu', name: '垣崇祖', faction: null, role: '豫州刺史',
    command: 80, force: 82, intel: 75, politics: 60, loyalty: 75, portrait: 'yuan_chongzu' }, // 297
  { id: 'yao_xiong',  name: '尧雄',   faction: 'dongwei', role: '豫州刺史',
    command: 82, force: 80, intel: 70, politics: 75, loyalty: 82, portrait: 'yao_xiong' }, // 307
  { id: 'wang_pi',    name: '王罴',   faction: 'xiwei', role: '华州刺史',
    command: 80, force: 88, intel: 65, politics: 70, loyalty: 90, portrait: 'wang_pi' }, // 303

  // === V13.0 新增武将（6位，105→111，v13_ 前缀）：南北朝中期名臣名将补遗 ===
  // 历史背景：补全关陇创业、东西魏拉锯、陈梁易代之际尚未收录的关键人物。
  //   苏绰（西魏谋主，制六条诏书，宇文泰革心理政之臣）
  //   贺拔岳（关陇集团奠基人，宇文泰旧主，为高欢所忌，卒为侯莫陈悦所害）
  //   彭乐（东魏猛将，邙山之战追宇文泰几获之，后以怨望被诛）
  //   独孤永业（北齐名将，善抚士卒，守河阳、并州，齐亡后入周）
  //   陆法和（南朝奇人，僧衣从军，破任约于赤沙湖，志节瑰伟）
  //   鲁广达（陈朝名将，陈末与隋军力战，悲恸而卒）
  // 历史参考：《周书·苏绰传》《周书·贺拔岳传》《北齐书·彭乐传》
  //           《北齐书·独孤永业传》《北齐书·陆法和传》《陈书·鲁广达传》
  { id: 'v13_su_chuo',     name: '苏绰',   faction: 'xiwei', role: '谋主',
    command: 55, force: 35, intel: 92, politics: 95, loyalty: 85, portrait: 'v13_su_chuo',
    age: 48, skills: ['jingtu_tuzhi', 'mouliao_baichu'],
    bonds: ['yuwen_tai', 'yu_jin'],
    description: '西魏武功文治之臣。字绰，少好学，博览群书，尤善算术。为宇文泰草六条诏书，清心、敦教化、尽地利、擢贤良、恤狱讼、均赋役，周之开国规模实基于此。卒时家无余财。' },
  { id: 'v13_heba_yue',    name: '贺拔岳', faction: 'xiwei', role: '关陇奠基人',
    command: 85, force: 82, intel: 75, politics: 70, loyalty: 80, portrait: 'v13_heba_yue',
    age: 36, skills: ['guanlong_jituan', 'mengjiang'],
    bonds: ['yuwen_tai', 'hu_luguang'],
    description: '一名阿斗泥，神武尖山人。从尔朱荣破葛荣、平元颢，后入关讨万俟丑奴，据有关陇。高欢忌其强，使侯莫陈悦诱而杀之。其部众后归宇文泰，遂成周室之基。' },
  { id: 'v13_peng_le',     name: '彭乐',   faction: 'dongwei', role: '猛将',
    command: 78, force: 93, intel: 48, politics: 38, loyalty: 72, portrait: 'v13_peng_le',
    age: 42, skills: ['mengjiang', 'xiaoyong_shanzhan'],
    bonds: ['gao_huan', 'duan_shao'],
    description: '北安人，从高欢举义。邙山之战，彭乐以数千骑深入西魏，追宇文泰几获之，泰遗之金带。后以谋反赐死。性粗勇，然临阵摧锋，常为军锋。' },
  { id: 'v13_dugu_yongye', name: '独孤永业', faction: 'dongwei', role: '名将',
    command: 80, force: 78, intel: 70, politics: 65, loyalty: 82, portrait: 'v13_dugu_yongye',
    age: 50, skills: ['shoucheng_mingjiang', 'mouliao_baichu'],
    bonds: ['hu_luguang', 'gao_rui'],
    description: '字世基，本姓刘。北齐名将，解知书计，能安集士卒。守河阳、并州，周师惮之。齐亡后入周，拜上柱国。为人廉慎，所在见思。' },
  { id: 'v13_lu_fahe',     name: '陆法和', faction: 'nanchao', role: '奇人',
    command: 76, force: 60, intel: 90, politics: 72, loyalty: 70, portrait: 'v13_lu_fahe',
    age: 60, skills: ['mouliao_baichu', 'rujiang'],
    bonds: ['wang_sengbian', 'hou_jing'],
    description: '不详其所出，隐于江陵百里洲，入僧衣。侯景之乱，率弟子赴任约，大破之赤沙湖。用兵若神，多有占验。后为梁豫州刺史，志节瑰伟，世以异之。' },
  { id: 'v13_lu_guangda',  name: '鲁广达', faction: 'nanchao', role: '名将',
    command: 80, force: 82, intel: 68, politics: 65, loyalty: 88, portrait: 'v13_lu_guangda',
    age: 55, skills: ['shoucheng_mingjiang', 'xiaoyong_shanzhan'],
    bonds: ['xiao_mohe', 'chen_shubao'],
    description: '字遍览，陈朝名将。吴明彻北伐，广达监其军事。吕梁之败，独全军而返。陈亡入隋，怆然国亡，不食而卒。其忠勇为江南所推。' },

  // ============================================================
  // V14.0 新增武将（18位，111→129，v14_ 前缀）：南北朝人物大扩充
  // ============================================================
  // 历史背景：补全南北朝三百年间尚未收录的名将、谋主、文宗、高僧。
  //   南朝名将：昌义之（钟离守城）、裴邃（汝南北伐）、夏侯夔（寿阳屯田）
  //   刘宋开国：到彦之、朱龄石、沈田子、沈林子、刘穆之（刘裕左膀右臂）
  //   文史科学：何承天、祖冲之、范晔、谢灵运、沈约
  //   宗教大德：陶弘景（茅山宗）、寇谦之（北天师道）、法显、昙鸾、智顗
  // 势力映射：在野人物 faction=null（玩家可招募）；南梁系名将归 nanchao。
  // 历史参考：《梁书》《宋书》《南齐书》《南史》《北史》《高僧传》
  // ------------------------------------------------------------
  // ---- 南朝名将（3） ----
  { id: 'v14_chang_yizhi', name: '昌义之', faction: 'nanchao', role: '守城名将',
    command: 82, force: 85, intel: 60, politics: 50, loyalty: 85, portrait: 'v14_chang_yizhi',
    age: 48, skills: ['shoucheng_mingjiang', 'mengjiang'],
    bonds: ['wei_rui', 'cao_jingzong'],
    description: '历阳乌江人。南梁名将。钟离之战，魏元英数十万围城，义之率三千人守城，悬釜而炊，士卒皆死战，竟全其城。韦睿、曹景宗赴援，大破魏军。历仕三朝，号为名将。' },
  { id: 'v14_pei_sui', name: '裴邃', faction: 'nanchao', role: '北伐名将',
    command: 86, force: 80, intel: 78, politics: 72, loyalty: 82, portrait: 'v14_pei_sui',
    age: 52, skills: ['hanshan_yanji', 'mouliao_baichu'],
    bonds: ['wei_rui', 'xiaohong'],
    description: '字渊明，河东闻喜人。南梁名将。自魏南归，梁初北伐，邃所至辄克。破魏寿阳，拔狄丘、甓城，所向皆下。治军严明，得士死心。未几卒于军，武帝痛惜之。' },
  { id: 'v14_xiahou_kui', name: '夏侯夔', faction: 'nanchao', role: '豫州刺史',
    command: 78, force: 75, intel: 72, politics: 80, loyalty: 80, portrait: 'v14_xiahou_kui',
    age: 45, skills: ['jingtu_tuzhi', 'mouliao_baichu'],
    bonds: ['pei_sui', 'wei_rui'],
    description: '字季龙，谯郡人。南梁豫州刺史。镇寿阳，立屯田，积谷十万石，抚遣流离，民安之。与裴邃屡破魏军，功为方面。性奢豪，然善抚士卒，皆为致死。' },

  // ---- 刘宋开国（5） ----
  { id: 'v14_dao_yanzhi', name: '到彦之', faction: null, role: '刘宋名将',
    command: 78, force: 80, intel: 62, politics: 65, loyalty: 70, portrait: 'v14_dao_yanzhi',
    age: 50, skills: ['mengjiang', 'hanshan_yanji'],
    bonds: ['liu_yu', 'tan_daoji'],
    description: '字道豫，彭城武原人。刘裕旧将，从平桓玄、卢循。元嘉七年（430）北伐，至滑台，魏兵大至，彦之焚甲弃军而走，委弃荡尽，府藏为空虚。文帝遣檀道济救之，不克而还。' },
  { id: 'v14_zhu_lingshi', name: '朱龄石', faction: null, role: '灭蜀名将',
    command: 80, force: 85, intel: 70, politics: 60, loyalty: 78, portrait: 'v14_zhu_lingshi',
    age: 38, skills: ['mengjiang', 'mouliao_baichu'],
    bonds: ['liu_yu', 'wang_zhen_e'],
    description: '字儿伯，沛郡沛人。刘裕谋主，从平桓玄。义熙九年（413），龄石以元帅伐蜀，克成都，斩谯纵，蜀地平。后关中陷没，龄石战败被杀。武烈有将略，为刘裕所任。' },
  { id: 'v14_shen_tianzi', name: '沈田子', faction: null, role: '北伐前锋',
    command: 76, force: 88, intel: 55, politics: 40, loyalty: 72, portrait: 'v14_shen_tianzi',
    age: 32, skills: ['mengjiang', 'xiaoyong_shanzhan'],
    bonds: ['liu_yu', 'wang_zhen_e', 'shen_linzi'],
    description: '字敬国，吴兴武康人。沈林子兄。刘裕伐后秦，田子以偏军入武关，大破姚泓青泥之众，所向无前。后与王镇恶不平，擅杀镇恶，军府大乱，田子亦以擅杀伏诛。' },
  { id: 'v14_shen_linzi', name: '沈林子', faction: null, role: '刘裕谋将',
    command: 80, force: 78, intel: 82, politics: 70, loyalty: 85, portrait: 'v14_shen_linzi',
    age: 36, skills: ['mouliao_baichu', 'hanshan_yanji'],
    bonds: ['liu_yu', 'liu_muzhi', 'shen_tianzi'],
    description: '字敬士，吴兴武康人。沈田子弟。从刘裕平桓玄、伐南燕、后秦，常为前锋，身先士卒。既克长安，以母忧归。刘裕尝曰："林子一人，足当吾十万众。"早卒，追赠。' },
  { id: 'v14_liu_muzhi', name: '刘穆之', faction: null, role: '刘裕谋主',
    command: 40, force: 25, intel: 95, politics: 95, loyalty: 90, portrait: 'v14_liu_muzhi',
    age: 58, skills: ['mouliao_baichu', 'jingtu_tuzhi'],
    bonds: ['liu_yu', 'shen_linzi'],
    description: '字道和，小字道民，东莞莒人。刘裕王佐之才，从镇建邺，内总朝政，外供军旅，决断如流，事无壅滞。刘裕北伐，穆之留守，卒于官。武帝即位，思之不忘，曰："穆之不死，当助我治天下。"' },

  // ---- 文史科学（6） ----
  { id: 'v14_he_chengtian', name: '何承天', faction: null, role: '天文历算家',
    command: 20, force: 15, intel: 88, politics: 70, loyalty: 65, portrait: 'v14_he_chengtian',
    age: 70, skills: ['rujiang', 'mouliao_baichu'],
    bonds: ['zu_chongzhi', 'fan_ye'],
    description: '东海郯人。刘宋太史令。博通经史，精历算。元嘉中，承天造《元嘉历》，改景初之法，岁差之理始显。又纂《篡文》《姓苑》诸书。儒史之士，推为宗师。' },
  { id: 'v14_zu_chongzhi', name: '祖冲之', faction: null, role: '大科学家',
    command: 15, force: 10, intel: 96, politics: 60, loyalty: 60, portrait: 'v14_zu_chongzhi',
    age: 50, skills: ['rujiang', 'mouliao_baichu'],
    bonds: ['he_chengtian', 'xiaodao_cheng'],
    description: '字文远，范阳遒人。南朝天算大家。造《大明历》，首次引入岁差；算圆周率至 3.1415926~3.1415927 之间，密率 355/113，千年后欧洲乃知。又改造指南车、千里船、水碓磨，机思若神。' },
  { id: 'v14_fan_ye', name: '范晔', faction: null, role: '史学家',
    command: 30, force: 35, intel: 88, politics: 60, loyalty: 50, portrait: 'v14_fan_ye',
    age: 48, skills: ['rujiang', 'mouliao_baichu'],
    bonds: ['he_chengtian', 'shen_yue'],
    description: '字蔚宗，顺阳人。刘宋史学家。博涉经史，善为文章，能隶书，晓音律。删众家《后汉书》为一家之作，今称《后汉书》。后以孔熙先事谋立彭城王义康，事泄伏诛。' },
  { id: 'v14_xie_lingyun', name: '谢灵运', faction: null, role: '山水诗人',
    command: 25, force: 30, intel: 85, politics: 55, loyalty: 45, portrait: 'v14_xie_lingyun',
    age: 48, skills: ['rujiang'],
    bonds: ['xie_an', 'bao_zhao'],
    description: '陈郡阳夏人。谢玄之孙，袭封康乐公。东晋末入宋，为临川内史。文章之美，江左第一，山水诗开山之祖。自谓"天下才共一石，曹子建独得八斗，我得一斗"。后以谋反弃市广州。' },
  { id: 'v14_shen_yue', name: '沈约', faction: null, role: '文宗',
    command: 30, force: 20, intel: 90, politics: 85, loyalty: 70, portrait: 'v14_shen_yue',
    age: 65, skills: ['rujiang', 'jingtu_tuzhi'],
    bonds: ['xiao_yan', 'jiang_yan', 'ren_fang'],
    description: '字休文，吴兴武康人。历仕宋齐梁三朝，梁武帝开国功臣。撰《宋书》百卷。创"四声八病"之说，为永明体诗律之祖。一时文宗，与谢朓、王融并称。卒谥隐。' },
  { id: 'v14_jiang_yan', name: '江淹', faction: null, role: '文学家',
    command: 20, force: 15, intel: 85, politics: 75, loyalty: 65, portrait: 'v14_jiang_yan',
    age: 62, skills: ['rujiang'],
    bonds: ['shen_yue', 'ren_fang'],
    description: '字文通，济阳考城人。少孤贫，笃志好学。文章诗赋，早有重名。历仕宋齐梁三朝。晚年才思微退，时人谓之"江郎才尽"。《恨赋》《别赋》，千古绝唱。' },

  // ---- 宗教大德（4） ----
  { id: 'v14_tao_hongjing', name: '陶弘景', faction: null, role: '茅山宗祖',
    command: 10, force: 10, intel: 92, politics: 70, loyalty: 55, portrait: 'v14_tao_hongjing',
    age: 75, skills: ['rujiang', 'mouliao_baichu'],
    bonds: ['xiao_yan', 'ke_qianzhi'],
    description: '字通明，自号华阳隐居，丹阳秣陵人。齐梁间隐士，茅山宗创始人。梁武帝早与之游，即位后，每有大事，辄就谘询，时谓"山中宰相"。著《真诰》《本草集注》，兼通历算、地理、医药。' },
  { id: 'v14_ke_qianzhi', name: '寇谦之', faction: null, role: '北天师道祖',
    command: 10, force: 10, intel: 85, politics: 75, loyalty: 50, portrait: 'v14_ke_qianzhi',
    age: 70, skills: ['rujiang'],
    bonds: ['cui_hao', 'tuoba_tao'],
    description: '上谷昌平人。北魏道士。嵩山修道，称太上老君授以天师之位，清整道教，除去三张伪法。始光初，至平城，太武礼遇之，崔浩师事焉。北朝道教由此大盛，国之大典皆禀受符箓。' },
  { id: 'v14_fa_xian', name: '法显', faction: null, role: '西行求法高僧',
    command: 5, force: 5, intel: 88, politics: 40, loyalty: 40, portrait: 'v14_fa_xian',
    age: 80, skills: ['rujiang'],
    bonds: [],
    description: '俗姓龚，平阳武阳人。东晋隆安三年（399），自长安西行，逾葱岭，历三十余国，至天竺求戒律，前后十五年。浮海归青州，译《大般泥洹经》等，撰《佛国记》一卷，为中亚南海地理要典。' },
  { id: 'v14_tan_luan', name: '昙鸾', faction: null, role: '净土宗祖师',
    command: 5, force: 5, intel: 86, politics: 45, loyalty: 40, portrait: 'v14_tan_luan',
    age: 65, skills: ['rujiang'],
    bonds: ['tao_hongjing', 'ke_qianzhi'],
    description: '雁门人。南朝高僧。初习老庄，陶弘景授以仙经。后于江南遇菩提流支，授以《观无量寿经》，遂焚仙经，专修净土。东魏孝静帝重之，号"神鸾"。为日本净土宗远祖。' },

  // ------------------------------------------------------------
  // V15.0 新增武将（15位，v15_ 前缀）—— 南北朝·隋初未收录人物
  // 覆盖：统帅/猛将(5) · 谋士内政(1) · 文化文史(5) · 宗室政治(2) · 后宫才媛(1) · 轻侠(1)
  // 历史参考：《隋书》《陈书》《南史》《北史》
  // ------------------------------------------------------------

  // ---- 隋室将臣（6） ----
  { id: 'v15_yang_guang', name: '杨广', faction: null, role: '晋王·雄略明主',
    command: 88, force: 80, intel: 75, politics: 82, loyalty: 60, portrait: 'v15_yang_guang',
    age: 26, skills: ['wangzhe_qiqi', 'dudu_zhongwai'],
    bonds: ['yang_jian', 'yang_su'],
    description: '一名英，小字阿𪡏，杨坚次子。美仪姿，性敏慧。平陈之役，为行军元帅，虽居中节制，而声名隆盛。后夺宗为太子，即位为炀帝。营建东都，开运河，三征高丽，海内骚然。' },
  { id: 'v15_yuwen_shu', name: '宇文述', faction: null, role: '隋代宿将',
    command: 84, force: 80, intel: 72, politics: 78, loyalty: 70, portrait: 'v15_yuwen_shu',
    age: 55, skills: ['dudu_zhongwai', 'mouliao_baichu'],
    bonds: ['yang_guang', 'lai_huer'],
    description: '字伯通，代郡武川人。周、隋间大将。谨密严整，善抚士卒。从韦孝宽破尉迟迥，以功进位。晋王广素与昵，赞其夺宗。后从征吐谷浑、伐高丽，宠待冠绝一时。' },
  { id: 'v15_lai_huer', name: '来护儿', faction: null, role: '水军名将',
    command: 85, force: 82, intel: 75, politics: 65, loyalty: 78, portrait: 'v15_lai_huer',
    age: 50, skills: ['hanshan_yanji', 'mouliao_baichu'],
    bonds: ['yang_guang', 'yuwen_shu'],
    description: '字崇善，江都人。隋水军名将。少倜傥，有大志。平陈之役，数有战功。后率楼船自海上趋平壤，三征高丽，所向克捷。江都之变，为宇文化及所害。' },
  { id: 'v15_daxi_changru', name: '达奚长儒', faction: null, role: '北周捍边名将',
    command: 82, force: 85, intel: 70, politics: 60, loyalty: 82, portrait: 'v15_daxi_changru',
    age: 50, skills: ['yubi_jianshou', 'shoucheng_mingjiang'],
    bonds: ['yuwen_yong'],
    description: '字富仁，代人。北周名将。少果毅，胆略过人。突厥可汗十余万众入寇，长儒以二千卒遇于周盘，且战且行，转斗三日，五兵咸尽，士卒以拳殴之，杀伤以万计，突厥遂退。' },
  { id: 'v15_yu_juluo', name: '鱼俱罗', faction: null, role: '隋代猛将',
    command: 80, force: 92, intel: 55, politics: 40, loyalty: 62, portrait: 'v15_yu_juluo',
    age: 45, skills: ['mengjiang', 'xiaoyong_shanzhan'],
    bonds: ['yang_guang'],
    description: '冯翊下邽人。隋猛将。身长八尺，膂力绝人，声气雄壮，言闻数百家。从晋王广平陈，又从杨素击突厥，每战先登，目有重瞳，炀帝忌之，竟坐事诛。' },
  { id: 'v15_shen_guang', name: '沈光', faction: null, role: '轻侠猛士',
    command: 70, force: 90, intel: 50, politics: 30, loyalty: 75, portrait: 'v15_shen_guang',
    age: 24, skills: ['xiaoyong_shanzhan', 'mengjiang'],
    bonds: ['lai_huer'],
    description: '字总持，吴兴人。隋末轻侠。骁捷不可当，善骑射。初为吴王杨秀引为门客。炀帝擢为给使，常从左右。江都之变，光奋挺而起，为乱兵所杀，时人义之。' },

  // ---- 隋初文臣（1） ----
  { id: 'v15_li_delin', name: '李德林', faction: null, role: '隋初内史令',
    command: 30, force: 20, intel: 88, politics: 88, loyalty: 70, portrait: 'v15_li_delin',
    age: 56, skills: ['mouliao_baichu', 'rujiang'],
    bonds: ['yang_jian', 'gao_jiong'],
    description: '字公辅，博陵安平人。幼聪敏，年数岁诵左思《蜀都赋》。历仕北齐、北周。杨坚入相，引为内参，禅代诏册，皆出其手。开皇初，撰《霸朝杂集》。与高颎同掌机密，文翰之美，冠于一时。' },

  // ---- 南陈文武（4） ----
  { id: 'v15_zhou_luohou', name: '周罗睺', faction: 'nanchao', role: '南陈水军名将',
    command: 83, force: 84, intel: 70, politics: 62, loyalty: 82, portrait: 'v15_zhou_luohou',
    age: 48, skills: ['mengjiang', 'hanshan_yanji'],
    bonds: ['chen_shubao'],
    description: '字公布，九江寻阳人。南陈名将。善骑射，晓军旅，性任侠。吴明彻北讨，罗睺每为前锋，数挫周师。陈亡，犹据上流拒命，后主手书谕之，始涕泣降隋。' },
  { id: 'v15_zhang_lihua', name: '张丽华', faction: 'nanchao', role: '陈后主贵妃',
    command: 10, force: 10, intel: 72, politics: 55, loyalty: 70, portrait: 'v15_zhang_lihua',
    age: 25, skills: ['rujiang', 'ciemao_fengliu'],
    bonds: ['chen_shubao', 'jiang_zong'],
    description: '兵家女也。发长七尺，鬒黑如漆，其光可鉴。特聪慧，有神采，容色端丽。每瞻视盼睐，光彩照映左右。后主嬖之，至于预朝政。隋军克台城，晋王广命斩之于青溪。' },
  { id: 'v15_jiang_zong', name: '江总', faction: 'nanchao', role: '陈朝宰辅·文宗',
    command: 25, force: 15, intel: 82, politics: 68, loyalty: 60, portrait: 'v15_jiang_zong',
    age: 62, skills: ['rujiang', 'mouliao_baichu'],
    bonds: ['chen_shubao', 'zhang_lihua'],
    description: '字总持，济阳考城人。幼孤，笃学有辞采。仕梁、陈，官至尚书令。与后主为文友，游宴后庭，共赋诗赋，采其尤艳丽者以为曲。然身居宰辅，不持政务，陈政遂荒。' },
  { id: 'v15_xie_zhen', name: '谢贞', faction: 'nanchao', role: '陈朝儒林学士',
    command: 10, force: 10, intel: 80, politics: 55, loyalty: 62, portrait: 'v15_xie_zhen',
    age: 40, skills: ['rujiang'],
    bonds: ['jiang_zong'],
    description: '字元正，陈郡阳夏人。晋太傅谢安九世孙。性至孝，笃好文史。尝在北周，尝侍后主子。八岁尝为《春日闲居》诗，从舅王筠叹曰："王家风流，复在谢氏。"清贫早卒。' },

  // ---- 文史书画（2） ----
  { id: 'v15_yao_cha', name: '姚察', faction: 'nanchao', role: '《梁书》史臣',
    command: 15, force: 10, intel: 88, politics: 70, loyalty: 66, portrait: 'v15_yao_cha',
    age: 56, skills: ['rujiang'],
    bonds: ['shen_yue', 'yao_zui'],
    description: '字伯审，吴兴武康人。历仕梁陈，领大著作。史学家。陈亡入隋，诏撰梁、陈二史，未就而卒。子姚思廉续成之。清廉恭俭，终日静默，尝一不言及财利。' },
  { id: 'v15_yao_zui', name: '姚最', faction: null, role: '书画名家',
    command: 10, force: 10, intel: 85, politics: 50, loyalty: 55, portrait: 'v15_yao_zui',
    age: 45, skills: ['rujiang'],
    bonds: ['yao_cha'],
    description: '字士会，吴兴人。姚僧垣子。北朝书画家、医家。博综群籍，好著述。撰《续画品》一卷，论魏晋以来画工优劣，多所发明。又传父医术，知名于周隋间。' },

  // ---- 宗室政治（2） ----
  { id: 'v15_xiao_zhengde', name: '萧正德', faction: 'nanchao', role: '临贺王·叛宗',
    command: 50, force: 55, intel: 45, politics: 40, loyalty: 28, portrait: 'v15_xiao_zhengde',
    age: 40, skills: ['xiaoxiong'],
    bonds: ['xiao_yan', 'hou_jing'],
    description: '字公和，临川王萧宏第三子，梁帝萧正德。初养于武帝，后还本，怨望。侯景潜与交通，许立为帝。景围台城，正德率众应之，即伪位。景城陷，寻矫诏杀之。' },
  { id: 'v15_xiao_yuanming', name: '萧渊明', faction: 'nanchao', role: '建安公·北朝附庸',
    command: 45, force: 50, intel: 40, politics: 45, loyalty: 45, portrait: 'v15_xiao_yuanming',
    age: 45, skills: ['xiaoxiong'],
    bonds: ['xiao_yan', 'gao_huan'],
    description: '字靖通，长沙王萧懿子，梁武帝侄。嗣封。寒山之役，武帝使率军应寒山，兵败为东魏所俘。贞阳侯。后齐人送之南归，王僧辩立之为帝，未几陈霸先废之，立敬帝。' },

  // ------------------------------------------------------------
  // V16.0 新增武将（15位，v16_ 前缀）—— 隋初·北周·后梁·陈末未收录人物
  // 覆盖：隋室文臣(6) · 隋室武将(6) · 隋宗室(1) · 后梁(1) · 陈佞臣(1)
  // 历史参考：《隋书》《陈书》《南史》《北史》
  // ------------------------------------------------------------

  // ---- 隋室文臣（6） ----
  { id: 'v16_niu_hong', name: '牛弘', faction: 'xiwei', role: '隋初大史官',
    command: 25, force: 20, intel: 88, politics: 90, loyalty: 82, portrait: 'v16_niu_hong',
    age: 55, skills: ['rujiang', 'mouliao_baichu'],
    bonds: ['yang_jian', 'su_chuo'],
    description: '字里仁，安定鹑觚人。本姓寮，父允仕魏，赐姓牛氏。好学博闻，隋初任秘书监，表请分遣使人，搜访异本，天下图书，稍更披览。修《五礼》，定律令，牛弘身为外戚，而恭俭自居，杨素甚推服之。' },
  { id: 'v16_xue_daoheng', name: '薛道衡', faction: 'xiwei', role: '隋内史侍郎',
    command: 20, force: 15, intel: 86, politics: 72, loyalty: 65, portrait: 'v16_xue_daoheng',
    age: 58, skills: ['rujiang'],
    bonds: ['yang_jian', 'yu_shiji'],
    description: '字玄卿，河东汾阴人。少有才名，十岁讲《左氏春秋》。历仕北齐、北周。隋内史侍郎，每致文帝书，南北称善。《昔昔盐》"空梁落燕泥"之句，为时所诵。炀帝以宿旧忌之，竟坐自尽。' },
  { id: 'v16_xu_shanshen', name: '许善心', faction: 'xiwei', role: '隋秘书丞',
    command: 15, force: 10, intel: 82, politics: 78, loyalty: 80, portrait: 'v16_xu_shanshen',
    age: 50, skills: ['rujiang'],
    bonds: ['yang_jian', 'pei_ju'],
    description: '字务本，高阳北新城人。幼有神童之号。陈使隋，留不遣。隋秘书丞，仿阮孝绪《七录》，更制《七林》，搜籍校书。宇文化及弑炀帝于江都，善心以隋室旧臣，不屈而死。' },
  { id: 'v16_yu_shiji', name: '虞世基', faction: 'xiwei', role: '隋内史合人',
    command: 30, force: 25, intel: 80, politics: 75, loyalty: 55, portrait: 'v16_yu_shiji',
    age: 55, skills: ['mouliao_baichu'],
    bonds: ['yang_guang', 'pei_ju'],
    description: '字茂世，会稽余姚人。博学有高才，兼善草隶。陈亡入隋，炀帝重其才，专典机密。然从容不断，知天下危乱而不敢言，又受赂公行，朝野共疾之。江都之变，为宇文化及所诛。' },
  { id: 'v16_pei_ju', name: '裴矩', faction: 'xiwei', role: '隋黄门郎·外交地理',
    command: 40, force: 30, intel: 88, politics: 84, loyalty: 70, portrait: 'v16_pei_ju',
    age: 60, skills: ['mouliao_baichu', 'rujiang'],
    bonds: ['yang_jian', 'yang_guang'],
    description: '字弘大，河东闻喜人。好学，有文智。隋文帝时，使于张掖，掌诸蕃交易，访探西域山川风俗，撰《西域图记》三卷，入朝奏之。炀帝于张掖引见西域数十国，矩之力也。后入唐，民部尚书。' },
  { id: 'v16_cui_zhongfang', name: '崔仲方', faction: 'xiwei', role: '隋内史令',
    command: 45, force: 40, intel: 82, politics: 84, loyalty: 75, portrait: 'v16_cui_zhongfang',
    age: 58, skills: ['mouliao_baichu'],
    bonds: ['yang_jian', 'gao_jiong'],
    description: '字不周，博陵安平人。少好奇略，览兵书。周武帝时，为宫尹端，与杨坚少同学。及杨坚辅政，仲方劝之受命，又上《受命论》。开皇初，坐事免。后迁虢州刺史，论伐陈之势，甚有宏略。' },

  // ---- 隋室武将（6） ----
  { id: 'v16_yuwen_kai', name: '宇文恺', faction: 'xiwei', role: '隋将作大匠',
    command: 55, force: 45, intel: 86, politics: 78, loyalty: 72, portrait: 'v16_yuwen_kai',
    age: 50, skills: ['mouliao_baichu'],
    bonds: ['yang_jian', 'yang_guang'],
    description: '字安乐，杞公忻弟。少有大志，好学博览，号为名公子。隋文帝营新都，以恺为营建副监，新城制度，多出于恺。后炀帝幸江都，恺造龙舟、大帐，穷极宏丽。又撰《东都图记》《明堂图议》。' },
  { id: 'v16_yang_yichen', name: '杨义臣', faction: 'xiwei', role: '隋末名将',
    command: 82, force: 80, intel: 70, politics: 60, loyalty: 80, portrait: 'v16_yang_yichen',
    age: 45, skills: ['dudu_zhongwai', 'mengjiang'],
    bonds: ['yang_jian', 'yuwen_shu'],
    description: '本姓尉迟，父崇战死，幼养宫中，赐姓杨氏。性谨厚，善骑射，有将略。从征突厥、吐谷浑，数有战功。大业中，破高士达、斩张金称，河北群盗为之丧气。炀帝忌其威名，追入朝，拜礼部尚书，卒于官。' },
  { id: 'v16_zhang_xutuo', name: '张须陀', faction: null, role: '隋末名将',
    command: 84, force: 85, intel: 68, politics: 55, loyalty: 70, portrait: 'v16_zhang_xutuo',
    age: 45, skills: ['mengjiang', 'dudu_zhongwai'],
    bonds: ['yang_yichen', 'luo_shixin'],
    description: '弘农阌乡人。性刚烈，有勇略。从史万岁讨西爨，以功授仪同。大业中，齐郡通守，领河南道十二郡黜陟讨捕大使。屡破王薄、裴长才、郭方预诸盗，号为名将。后与李密战于荥阳海神庙，兵败，战死。' },
  { id: 'v16_chen_leng', name: '陈稜', faction: 'xiwei', role: '隋朝请大夫',
    command: 76, force: 74, intel: 65, politics: 55, loyalty: 72, portrait: 'v16_chen_leng',
    age: 48, skills: ['hanshan_yanji', 'mengjiang'],
    bonds: ['yang_su', 'yang_guang'],
    description: '庐江襄安人。以将军子，炀帝大业三年，拜武贲郎将。与朝请大夫张镇周发东阳兵万余人，自义安泛海击流求国，月余而至，虏其王渴刺兜，胜还。后宇文化及引之，为李子通所杀。' },
  { id: 'v16_zhou_fashang', name: '周法尚', faction: 'xiwei', role: '隋武卫将军',
    command: 80, force: 76, intel: 70, politics: 60, loyalty: 78, portrait: 'v16_zhou_fashang',
    age: 55, skills: ['dudu_zhongwai', 'mengjiang'],
    bonds: ['yang_jian', 'yang_su'],
    description: '字德迈，汝南安成人。少果劲，有将帅气。本陈将，后奔周。隋初，拜巴州刺史。平陈之役，以功迁永州总管。后从杨素击突厥，又从讨吐谷浑。大业末，卒于军。' },
  { id: 'v16_xue_shixiong', name: '薛世雄', faction: 'xiwei', role: '隋左御卫大将军',
    command: 78, force: 78, intel: 62, politics: 55, loyalty: 75, portrait: 'v16_xue_shixiong',
    age: 55, skills: ['mengjiang', 'dudu_zhongwai'],
    bonds: ['yang_jian', 'yang_guang'],
    description: '字世英，河东汾阴人。年十七，从周武帝平齐。隋初，以数行军总管，数有战功。大业中，为左御卫大将军，领涿郡留守。李密逼东都，炀帝命世雄率幽蓟劲兵讨之，为窦建德所袭，败归，惭恚发病卒。' },

  // ---- 隋宗室（1） ----
  { id: 'v16_yang_shuang', name: '杨爽', faction: 'xiwei', role: '隋卫王',
    command: 82, force: 78, intel: 72, politics: 75, loyalty: 90, portrait: 'v16_yang_shuang',
    age: 30, skills: ['wangzhe_qiqi', 'dudu_zhongwai'],
    bonds: ['yang_jian', 'dou_ruding'],
    description: '字师仁，杨坚异母弟。幼为献皇后所鞠，教以书计。开皇初，立为卫王。以行军元帅步骑七万，出平凉以备胡，突厥引退。复为元帅，步骑十五万出合川，突厥遁逃。早卒，年二十五。' },

  // ---- 后梁（1） ----
  { id: 'v16_xiao_cong', name: '萧琮', faction: 'hou_liang', role: '后梁莒公',
    command: 40, force: 35, intel: 78, politics: 70, loyalty: 60, portrait: 'v16_xiao_cong',
    age: 35, skills: ['rujiang'],
    bonds: ['xiao_kui', 'yang_jian'],
    description: '字温文，萧岿太子。博学好文，尤善音律。岿卒，嗣位。开皇七年，隋文帝征琮入朝，遂废后梁，拜莒国公。其叔萧岩等据江陵奔陈。炀帝以萧皇后故，甚见亲重，改封梁公。' },

  // ---- 陈佞臣（1） ----
  { id: 'v16_kong_fan', name: '孔范', faction: 'nanchao', role: '陈都官尚书',
    command: 20, force: 15, intel: 65, politics: 55, loyalty: 40, portrait: 'v16_kong_fan',
    age: 50, skills: ['mouliao_baichu'],
    bonds: ['chen_shubao', 'zhang_lihua'],
    description: '字法言，会稽山阴人。容止都雅，文章赡丽。后主即位，与江总等并为狎客。善为媚，恶闻人过，群臣有违之者，皆被诋毁。又自谓文武略，举朝莫及。隋师渡江，范请出战，未阵而北，与后主俱入井。' }
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
  wei_xuan:      ['rujiang'],
  // ---- V8.0 新增武将技能映射 ----
  yang_su:       ['mouliao_baichu'],   // 杨素：隋谋将，多谋略
  gao_jiong:     ['rujiang'],          // 高颎：隋开国谋臣，治国良才
  han_qinhu:     ['mengjiang'],        // 韩擒虎：隋灭陈先锋，猛将
  he_ruobi:      ['hanshan_yanji'],    // 贺若弼：隋名将，灭陈主帅
  shi_wansui:    ['mengjiang'],        // 史万岁：隋第一猛将
  li_mu:         ['jingtu_tuzhi'],     // 李穆：北周名臣，附隋定鼎
  wang_yi:       ['xiaoxiong'],        // 王谊：北周名将
  su_wei:        ['rujiang'],          // 苏威：隋文臣，治绩第一
  zhangsun_sheng:['mouliao_baichu'],   // 长孙晟：隋外交家，一箭双雕
  mai_tiezhang:  ['xiaoyong_shanzhan'] // 麦铁杖：隋猛将，骁勇绝伦
};

// ---------- V9.0 新武将技能映射（5位） ----------
// 复用已有技能 id，保证 getSkill() 可解析（skills.js 只读不改）。
export const V90_NEW_GENERAL_SKILLS = {
  er_zhurong:    ['bazhuguo_zhiyong'],  // 尔朱荣：枭雄用兵，柱国之勇
  hou_jing:      ['xiaoxiong'],         // 侯景：反复枭雄
  xiao_yan:      ['jingtu_tuzhi'],      // 梁武帝：开国守文
  yuan_hong:     ['jingtu_tuzhi'],      // 魏孝文帝：汉化改制文治
  wang_sizheng:  ['hanshan_yanji']      // 王思政：善守孤城
};
Object.assign(NEW_GENERAL_SKILLS, V90_NEW_GENERAL_SKILLS);

// ---------- V8.5 新武将技能映射（昏主/叛将复用已有技能 id） ----------
// 陈后主/北齐后主/北周宣帝为昏庸之主，无勇略，仅以文辞/逸事附会；
// 司马消难、王谦为起兵讨隋之叛将，附小勇。
export const V85_NEW_GENERAL_SKILLS = {
  chen_shubao:   [],                    // 陈后主：耽于诗酒，无御下之才
  yuwen_yun:     [],                    // 北周宣帝：荒淫失度
  gao_wei:       [],                    // 北齐后主：亡国昏主
  sima_xiaonan:  ['xiaoxiong'],         // 司马消难：反复于齐周陈之间
  wang_qian:     ['xiaoyong_shanzhan']  // 王谦：举兵蜀地
};
// V8.5：将新武将技能映射并入总表（general.js / game.js 只读 NEW_GENERAL_SKILLS）
Object.assign(NEW_GENERAL_SKILLS, V85_NEW_GENERAL_SKILLS);

// ---------- V9.5 新武将技能映射（5位北魏人物） ----------
// 复用已有技能 id，保证 getSkill() 可解析（skills.js 只读不改）。
export const V95_NEW_GENERAL_SKILLS = {
  tuoba_tao:   ['xiaoxiong'],          // 拓跋焘：雄才大略，枭雄用兵
  cui_hao:     ['mouliao_baichu'],      // 崔浩：王佐谋主，算无遗策
  feng_taihou: ['jingtu_tuzhi'],        // 冯太后：临朝改制，文治图治
  yang_dayan:  ['mengjiang'],           // 杨大眼：当世猛将，骁勇绝伦
  yuan_xie:    ['rujiang']              // 元勰：宗室儒将，才望兼济
};
Object.assign(NEW_GENERAL_SKILLS, V95_NEW_GENERAL_SKILLS);

// ---------- V10.0 新武将技能映射（5位东晋北府人物） ----------
// 复用已有技能 id，保证 getSkill() 可解析（skills.js 只读不改）。
export const V100_NEW_GENERAL_SKILLS = {
  xie_an:         ['rujiang'],          // 谢安：东晋名相，儒将风度，围棋赌墅
  xie_xuan:       ['hanshan_yanji'],    // 谢玄：北府兵前锋，淝水破敌
  fu_jian:        ['xiaoxiong'],        // 苻坚：前秦雄主，统一北方
  liu_yu:         ['mouliao_baichu'],   // 刘裕：寄奴北伐，代晋建宋
  wang_zhen_e:    ['mengjiang']         // 王镇恶：北伐前锋，勇略过人
};
Object.assign(NEW_GENERAL_SKILLS, V100_NEW_GENERAL_SKILLS);

// ---------- V11.0 新武将技能映射（5位北魏中期及南朝名将） ----------
// 复用已有技能 id，保证 getSkill() 可解析（skills.js 只读不改）。
export const V110_NEW_GENERAL_SKILLS = {
  murong_baiyao: ['mouliao_baichu'],     // 慕容白曜：平齐地谋勇兼备
  yuan_ying:     ['bazhuguo_zhiyong'],   // 元英：中山王将帅之勇
  xing_luan:     ['mouliao_baichu'],     // 邢峦：征梁益谋将
  chen_bozhi:    ['xiaoyong_shanzhan'],  // 陈伯之：骁勇善战反复之将
  xue_andu:      ['mengjiang']            // 薛安都：单骑冲阵猛将
};
Object.assign(NEW_GENERAL_SKILLS, V110_NEW_GENERAL_SKILLS);

// ---------- V12.0 新武将技能映射（5位） ----------
// 复用已有技能 id，保证 getSkill() 可解析（skills.js 只读不改）。
export const V120_NEW_GENERAL_SKILLS = {
  yuwen_xian:     ['mouliao_baichu'],     // 宇文宪：齐王谋勇兼备，灭齐主帅
  cheng_lingxi:   ['bianzhen_hanjiang'],  // 程灵洗：陈朝水军名将，善治水军
  xiao_daocheng:  ['jingtu_tuzhi'],       // 萧道成：齐高帝开国图治
  shen_qingzhi:   ['hanshan_yanji'],      // 沈庆之：刘宋宿将，善攻坚野战
  feng_daogen:    ['xiaoyong_shanzhan']   // 冯道根：谨厚勇将，善守善攻
};
Object.assign(NEW_GENERAL_SKILLS, V120_NEW_GENERAL_SKILLS);

// ---------- V13.0 新武将技能映射（5位） ----------
// 复用已有技能 id，保证 getSkill() 可解析（skills.js 只读不改）。
export const V130_NEW_GENERAL_SKILLS = {
  pei_shuye:     ['hanshan_yanji'],     // 裴叔业：南齐边将，寿阳降魏
  chen_xianda:   ['mouliao_baichu'],    // 陈显达：南齐太尉，北伐名将
  yuan_chongzu:  ['hanshan_yanji'],    // 垣崇祖：守寿春堰水灌魏
  yao_xiong:     ['mouliao_baichu'],    // 尧雄：东魏豫州刺史，治绩兼备
  wang_pi:       ['mengjiang']          // 王罴：西魏守城猛将，赤足陷阵
};
Object.assign(NEW_GENERAL_SKILLS, V130_NEW_GENERAL_SKILLS);

// ---------- V13.0 第二批新武将技能映射（v13_ 前缀） ----------
// 复用 skills.js 已有技能 id，game.js 初始化时合并到武将 skills 字段。
export const V130_V2_NEW_GENERAL_SKILLS = {
  v13_su_chuo:     ['jingtu_tuzhi', 'mouliao_baichu'],  // 苏绰：六条诏书，励精图治
  v13_heba_yue:    ['guanlong_jituan', 'mengjiang'],    // 贺拔岳：关陇奠基
  v13_peng_le:     ['mengjiang', 'xiaoyong_shanzhan'],  // 彭乐：邙山陷阵
  v13_dugu_yongye: ['shoucheng_mingjiang', 'mouliao_baichu'], // 独孤永业：守河阳
  v13_lu_fahe:     ['mouliao_baichu', 'rujiang'],       // 陆法和：僧衣用兵
  v13_lu_guangda:  ['shoucheng_mingjiang', 'xiaoyong_shanzhan'] // 鲁广达：陈末力战
};
Object.assign(NEW_GENERAL_SKILLS, V130_V2_NEW_GENERAL_SKILLS);

// ---------- V14.0 新武将技能映射（18位，v14_ 前缀） ----------
// 复用 skills.js 已有技能 id，game.js 初始化时合并到武将 skills 字段。
// GENERALS 表中已直接写入 skills 数组，此处再注册一份以兼容 game.js 的合并逻辑。
export const V140_NEW_GENERAL_SKILLS = {
  v14_chang_yizhi: ['shoucheng_mingjiang', 'mengjiang'],       // 昌义之：钟离守城
  v14_pei_sui:     ['hanshan_yanji', 'mouliao_baichu'],        // 裴邃：北伐名将
  v14_xiahou_kui:  ['jingtu_tuzhi', 'mouliao_baichu'],         // 夏侯夔：寿阳屯田
  v14_dao_yanzhi:  ['mengjiang', 'hanshan_yanji'],              // 到彦之：元嘉北伐
  v14_zhu_lingshi: ['mengjiang', 'mouliao_baichu'],             // 朱龄石：灭谯蜀
  v14_shen_tianzi: ['mengjiang', 'xiaoyong_shanzhan'],          // 沈田子：青泥破敌
  v14_shen_linzi:  ['mouliao_baichu', 'hanshan_yanji'],         // 沈林子：刘裕谋将
  v14_liu_muzhi:   ['mouliao_baichu', 'jingtu_tuzhi'],          // 刘穆之：宋武谋主
  v14_he_chengtian:['rujiang', 'mouliao_baichu'],               // 何承天：元嘉历
  v14_zu_chongzhi: ['rujiang', 'mouliao_baichu'],               // 祖冲之：大明历
  v14_fan_ye:      ['rujiang', 'mouliao_baichu'],               // 范晔：后汉书
  v14_xie_lingyun: ['rujiang'],                                  // 谢灵运：山水诗祖
  v14_shen_yue:    ['rujiang', 'jingtu_tuzhi'],                 // 沈约：四声八病
  v14_jiang_yan:   ['rujiang'],                                  // 江淹：江郎才尽
  v14_tao_hongjing:['rujiang', 'mouliao_baichu'],               // 陶弘景：山中宰相
  v14_ke_qianzhi:  ['rujiang'],                                  // 寇谦之：北天师道
  v14_fa_xian:     ['rujiang'],                                  // 法显：佛国记
  v14_tan_luan:    ['rujiang']                                   // 昙鸾：净土宗
};
Object.assign(NEW_GENERAL_SKILLS, V140_NEW_GENERAL_SKILLS);

// ---------- V15.0 新武将技能映射（15将） ----------
// 复用 skills.js 已有技能 id，保证 getSkill() 可解析。
export const V150_NEW_GENERAL_SKILLS = {
  v15_yang_guang:    ['wangzhe_qiqi', 'dudu_zhongwai'],   // 杨广：晋王伐陈
  v15_yuwen_shu:     ['dudu_zhongwai', 'mouliao_baichu'], // 宇文述：隋室宿将
  v15_lai_huer:      ['hanshan_yanji', 'mouliao_baichu'], // 来护儿：楼船跨海
  v15_daxi_changru:  ['yubi_jianshou', 'shoucheng_mingjiang'], // 达奚长儒：周盘御突厥
  v15_yu_juluo:      ['mengjiang', 'xiaoyong_shanzhan'],  // 鱼俱罗：重瞳猛将
  v15_shen_guang:    ['xiaoyong_shanzhan', 'mengjiang'],  // 沈光：江都轻侠
  v15_li_delin:      ['mouliao_baichu', 'rujiang'],       // 李德林：禅代文翰
  v15_zhou_luohou:   ['mengjiang', 'hanshan_yanji'],      // 周罗睺：上游水战
  v15_zhang_lihua:   ['rujiang', 'ciemao_fengliu'],       // 张丽华：发七尺
  v15_jiang_zong:    ['rujiang', 'mouliao_baichu'],       // 江总：后庭文友
  v15_xie_zhen:      ['rujiang'],                          // 谢贞：至孝儒林
  v15_yao_cha:       ['rujiang'],                          // 姚察：梁书史臣
  v15_yao_zui:       ['rujiang'],                          // 姚最：续画品
  v15_xiao_zhengde:  ['xiaoxiong'],                        // 萧正德：侯景内应
  v15_xiao_yuanming: ['xiaoxiong']                         // 萧渊明：贞阳入嗣
};
Object.assign(NEW_GENERAL_SKILLS, V150_NEW_GENERAL_SKILLS);

// ============================================================
// V16.0 新武将技能映射（15位，v16_ 前缀）
// ============================================================
export const V160_NEW_GENERAL_SKILLS = {
  v16_niu_hong:       ['rujiang', 'mouliao_baichu'],       // 牛弘：搜籍修礼
  v16_xue_daoheng:    ['rujiang'],                          // 薛道衡：昔昔盐
  v16_xu_shanshen:    ['rujiang'],                          // 许善心：七林校书
  v16_yu_shiji:       ['mouliao_baichu'],                   // 虞世基：专典机密
  v16_pei_ju:         ['mouliao_baichu', 'rujiang'],       // 裴矩：西域图记
  v16_cui_zhongfang:  ['mouliao_baichu'],                   // 崔仲方：受命论
  v16_yuwen_kai:      ['mouliao_baichu'],                   // 宇文恺：营新都
  v16_yang_yichen:    ['dudu_zhongwai', 'mengjiang'],       // 杨义臣：破河北贼
  v16_zhang_xutuo:    ['mengjiang', 'dudu_zhongwai'],       // 张须陀：齐郡悍将
  v16_chen_leng:      ['hanshan_yanji', 'mengjiang'],       // 陈稜：泛海击流求
  v16_zhou_fashang:   ['dudu_zhongwai', 'mengjiang'],       // 周法尚：平陈旧将
  v16_xue_shixiong:   ['mengjiang', 'dudu_zhongwai'],       // 薛世雄：涿郡留守
  v16_yang_shuang:    ['wangzhe_qiqi', 'dudu_zhongwai'],    // 杨爽：卫王北略
  v16_xiao_cong:      ['rujiang'],                          // 萧琮：后梁末主
  v16_kong_fan:       ['mouliao_baichu']                    // 孔范：狎客佞臣
};
Object.assign(NEW_GENERAL_SKILLS, V160_NEW_GENERAL_SKILLS);

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
  },

  // ---------- V6.5 新增随机事件（天文/文化/军事/经济/政治/特殊 共15个） ----------
  // 历史：太白经天——金星白昼见于东方，古人以为兵象，主大将执掌兵权
  {
    id: 'taibai_jingtian', name: '太白经天', illustration: 'plague',
    description: '白昼太白经天，光芒赫然。星官奏曰：此兵象也，主大将握权，天下将有大战。',
    options: [
      { text: '整军经武（军心+8，耗金400）', effect: { money: -400, armyMorale: 8 } },
      { text: '下罪己诏（民心+5，军心-3）', effect: { morale: 5, armyMorale: -3 } }
    ]
  },
  // 历史：南北朝官学制度——太学为国子学，培育人才
  {
    id: 'establish_taixue', name: '设立太学', illustration: 'harvest',
    description: '命有司设立太学，招纳生徒，讲习五经。教化大行，人才辈出。',
    options: [
      { text: '大兴太学（耗金1000，繁荣+12，政治+5）', effect: { money: -1000, prosperity: 12, generalPolitics: { amt: 5 } } },
      { text: '暂以养民（繁荣+3）', effect: { prosperity: 3 } }
    ]
  },
  {
    id: 'recruit_camp', name: '新兵训练营', illustration: 'harvest',
    description: '诸县送新兵至营，操练三月。弓马娴熟，可堪一战。',
    options: [
      { text: '厚赏操练（耗金500，兵源+3000）', effect: { money: -500, pop: 3000 } },
      { text: '草草操练（兵源+1000）', effect: { pop: 1000 } }
    ]
  },
  {
    id: 'price_inflation', name: '物价飞涨', illustration: 'plague',
    description: '岁币浩繁，钱货不通，长安建业两市物价腾踊数倍，百姓怨声载道。',
    options: [
      { text: '平抑物价（耗金800，民心+5）', effect: { money: -800, morale: 5 } },
      { text: '放任自流（民心-10，商业-5）', effect: { morale: -10, comm: -5 } }
    ]
  },
  {
    id: 'royal_succession', name: '宗室争位', illustration: 'rebellion',
    description: '宗室诸王各树党羽，觊觎大位。流言四起，人心不安。',
    options: [
      { text: '立储定国（众将忠诚+8，耗金600）', effect: { money: -600, generalLoyalty: { amt: 8 } } },
      { text: '含糊其辞（众将忠诚-5）', effect: { generalLoyalty: { amt: -5 } } }
    ]
  },
  {
    id: 'famous_doctor', name: '名医出诊', illustration: 'harvest',
    description: '有神医自彭城来，善治金疮瘟疫。军中将士争延致之。',
    options: [
      { text: '重金聘之（耗金400，伤兵归队，民心+5）', effect: { money: -400, morale: 5, pop: 2000 } },
      { text: '仅赐酒食（民心+2）', effect: { morale: 2 } }
    ]
  },
  {
    id: 'trade_routes_broken', name: '商路断绝', illustration: 'plague',
    description: '边境不宁，胡汉商队裹足不前，丝路断绝，市易萧然。',
    options: [
      { text: '派兵护商（耗金500，商业+5）', effect: { money: -500, comm: 5 } },
      { text: '听之任之（商业-8，金钱-300）', effect: { comm: -8, money: -300 } }
    ]
  },
  {
    id: 'border_farming', name: '边疆屯田', illustration: 'harvest',
    description: '诸将建议于边地屯田，且耕且战，以实仓廪。',
    options: [
      { text: '大兴屯田（耗金600，粮草+3000）', effect: { money: -600, food: 3000 } },
      { text: '小试屯田（粮草+1000）', effect: { food: 1000 } }
    ]
  },
  {
    id: 'literary_boom', name: '文学兴盛', illustration: 'harvest',
    description: '江南文会大兴，诗赋唱和，江左风流复振。有献文章者接踵于路。',
    options: [
      { text: '褒奖文士（耗金500，繁荣+10，文化+20）', effect: { money: -500, prosperity: 10, culture: 20 } }
    ]
  },
  {
    id: 'hu_merchant_horses', name: '胡商献马', illustration: 'harvest',
    description: '突厥、柔然商队驱骏马千匹至塞下，请求互市。良马可得，骑兵可强。',
    options: [
      { text: '以茶帛易马（耗金800，骑兵战力提升）', effect: { money: -800, armyMorale: 8 } },
      { text: '厚值强买（耗金1500，骑兵+10，民心-3）', effect: { money: -1500, armyMorale: 10, morale: -3 } }
    ]
  },
  {
    id: 'wall_donation', name: '城防捐资', illustration: 'harvest',
    description: '城中父老感念主公恩德，集资修缮城墙，雉堞一新。',
    options: [
      { text: '受之无愧（防御+8，民心+3）', effect: { defense: 8, morale: 3 } },
      { text: '婉辞不受（民心+5）', effect: { morale: 5 } }
    ]
  },
  {
    id: 'scholar_flees', name: '名士来奔', illustration: 'harvest',
    description: '有北朝名士因避乱南奔，身怀经史，欲为主公讲论治道。',
    options: [
      { text: '拜为祭酒（招募一在野将，耗金300）', effect: { money: -300, recruitRandom: true } }
    ]
  },
  {
    id: 'baihong_guanri', name: '白虹贯日', illustration: 'plague',
    description: '白虹横贯日轮，太史占之曰：贵人当之，兵大起。朝野惊骇。',
    options: [
      { text: '祭天禳灾（耗金500，民心+6）', effect: { money: -500, morale: 6 } },
      { text: '严备边患（军心+6）', effect: { armyMorale: 6 } }
    ]
  },
  {
    id: 'craftsman_contest', name: '百工竞技', illustration: 'harvest',
    description: '召集天下工匠于城中竞技，良匠辈出，百工精巧。',
    options: [
      { text: '设金奖优（耗金400，商业+8，繁荣+5）', effect: { money: -400, comm: 8, prosperity: 5 } }
    ]
  },
  {
    id: 'nomad_market', name: '互市开市', illustration: 'harvest',
    description: '与边境蛮族约定互市，以茶帛盐铁易马匹皮毛。边民两利，邦交亦睦。',
    options: [
      { text: '开互市（金钱+800，蛮族关系+10）', effect: { money: 800, barbarianRel: 10 } },
      { text: '限市（金钱+300）', effect: { money: 300 } }
    ]
  },

  // ============================================================
  // V7.5 新增随机事件（天文/文化/军事/经济/政治/特殊 共20个）
  // 技术：沿用现有 EVENTS 格式 { id, name, illustration, description, options:[{text,effect}] }
  //       effect 字段与 events.js applyEvent 支持的类型一一对应。
  // ============================================================
  // ---- 天文（4） ----
  // 荧惑守心：火星停留在心宿（天蝎座），古人以为大凶，主天子驾崩
  {
    id: 'yinghuo_shouxin', name: '荧惑守心', illustration: 'plague',
    description: '荧惑（火星）守于心宿，经月不移。太史占之曰：大人恶之，天子恐有大祸。朝野震恐，星夜不安。',
    options: [
      { text: '下诏罪己，大赦天下（民心+10，耗金500）', effect: { money: -500, morale: 10 } },
      { text: '密令太史禳星（民心-8，军心+5）', effect: { morale: -8, armyMorale: 5 } }
    ]
  },
  // 老人星见：南天寿星（船底座α）出现，主长治久安
  {
    id: 'laoren_xing', name: '老人星见', illustration: 'harvest',
    description: '南极老人星见于南郊，色黄而明。太史奏曰：此寿星也，见则天下安宁，仁寿无疆。百姓争相传颂。',
    options: [
      { text: '南郊祭祀庆贺（民心+12，耗金400）', effect: { money: -400, morale: 12, prosperity: 5 } },
      { text: '史官记录祥瑞（繁荣+5）', effect: { prosperity: 5 } }
    ]
  },
  // 客星犯紫微：新星闯入紫微垣，主大臣擅权
  {
    id: 'kexing_ziwei', name: '客星犯紫微', illustration: 'plague',
    description: '忽有客星苍白色，渐入紫微垣，光芒侵逼帝座。太史令惶惶奏报：此非人臣之象，恐有权臣谋逆。',
    options: [
      { text: '收揽兵权，整肃朝纲（众将忠诚+6，耗金600）', effect: { money: -600, generalLoyalty: { amt: 6 } } },
      { text: '不以为意（众将忠诚-6）', effect: { generalLoyalty: { amt: -6 } } }
    ]
  },
  // 月食：月被地影遮蔽，女主之象
  {
    id: 'yue_shi', name: '月食', illustration: 'plague',
    description: '月食既，赤如丹霞，良久乃复。百姓惊走，以为天狗吞月。宫中击鼓救月，彻夜不宁。',
    options: [
      { text: '宫中击鼓救月，大赦天下（民心+8，耗金300）', effect: { money: -300, morale: 8 } },
      { text: '命史官记之（民心-3）', effect: { morale: -3 } }
    ]
  },
  // ---- 文化（3） ----
  // 书法大家：王羲之式的书法家出现
  {
    id: 'shufa_dajia', name: '书法大家', illustration: 'harvest',
    description: '有书家隐居东山，一笔行书飘若浮云、矫若惊龙。求书者踏破门槛，片纸只字皆为珍宝。',
    options: [
      { text: '聘为侍书，弘扬书道（耗金500，繁荣+10，文化+20）', effect: { money: -500, prosperity: 10, culture: 20 } }
    ]
  },
  // 诗会雅集：文人集会赋诗
  {
    id: 'shihui_yaji', name: '诗会雅集', illustration: 'harvest',
    description: '江东文士会于兰亭曲水，流觞赋诗，江左风流复振。有献诗者，篇篇珠玉。',
    options: [
      { text: '命百官和诗，编为集子（耗金400，繁荣+8，文化+15）', effect: { money: -400, prosperity: 8, culture: 15 } }
    ]
  },
  // 胡乐东来：西域音乐传入
  {
    id: 'huyue_donglai', name: '胡乐东来', illustration: 'harvest',
    description: '西域龟兹乐师东来，琵琶、箜篌、羌胡之声铿锵悦耳。宫廷教坊争相习之，胡汉交融。',
    options: [
      { text: '设教坊教习胡乐（耗金300，繁荣+6，文化+10）', effect: { money: -300, prosperity: 6, culture: 10 } },
      { text: '以礼乐为正，拒胡乐（繁荣-3）', effect: { prosperity: -3 } }
    ]
  },
  // ---- 军事（3） ----
  // 战马繁殖：牧马蕃息
  {
    id: 'zhanma_fanzhi', name: '战马繁殖', illustration: 'harvest',
    description: '陇右牧场水草丰美，战马蕃息，骟驹成群。牧马监报：今年马驹翻倍，骑兵可大强。',
    options: [
      { text: '扩建牧场（耗金500，骑兵战力提升，军心+8）', effect: { money: -500, armyMorale: 8 } }
    ]
  },
  // 军械改良：改进兵器
  {
    id: 'junxie_gailiang', name: '军械改良', illustration: 'harvest',
    description: '有匠人改良百炼钢法，铠甲强韧锋利，弩机射程大增。诸营争相仿制，军备焕然一新。',
    options: [
      { text: '推广新法（耗金700，军心+10）', effect: { money: -700, armyMorale: 10 } },
      { text: '仅试造（军心+4）', effect: { armyMorale: 4 } }
    ]
  },
  // 水军操练：操练水师
  {
    id: 'shuijun_caochuan', name: '水军操练', illustration: 'harvest',
    description: '沿江诸郡操练楼船水军，习水战、习接舷、习火攻。江面旌旗蔽日，楼船千艘。',
    options: [
      { text: '大阅水军（耗金600，军心+8，民心+3）', effect: { money: -600, armyMorale: 8, morale: 3 } }
    ]
  },
  // ---- 经济（3） ----
  // 市集扩建：扩建市场
  {
    id: 'shiji_kuojian', name: '市集扩建', illustration: 'harvest',
    description: '城中旧市狭小，商贾拥挤。父老请扩建新市，分列谷物、布帛、珠玉、马市四区。',
    options: [
      { text: '扩建新市（耗金800，商业+10，繁荣+8）', effect: { money: -800, comm: 10, prosperity: 8 } },
      { text: '因陋就简（商业+3）', effect: { comm: 3 } }
    ]
  },
  // 水利兴修：兴修水利
  {
    id: 'shuili_xingxiu', name: '水利兴修', illustration: 'harvest',
    description: '有河渠年久淤塞，诸将建议征发民夫疏浚旧渠，引水灌田。功成则旱涝保收。',
    options: [
      { text: '大兴水利（耗金700，粮草+4000，民心+5）', effect: { money: -700, food: 4000, morale: 5 } }
    ]
  },
  // 五谷丰登：好收成
  {
    id: 'wugu_fengdeng', name: '五谷丰登', illustration: 'harvest',
    description: '风调雨顺，五谷丰登。田野金黄，仓廪充实。百姓奔走相告，歌于途，舞于室。',
    options: [
      { text: '减免今年赋税（民心+12，粮草+3000）', effect: { food: 3000, morale: 12 } },
      { text: '照常征收（粮草+5000）', effect: { food: 5000, morale: -5 } }
    ]
  },
  // ---- 政治（3） ----
  // 大臣谏言：直臣进谏
  {
    id: 'dachen_jianyan', name: '大臣谏言', illustration: 'harvest',
    description: '有直臣当殿叩头，痛陈时政得失，言辞恳切，涕泪横流。或纳之则社稷安，或拒之则忠良寒心。',
    options: [
      { text: '虚心纳谏（民心+8，众将忠诚+5）', effect: { morale: 8, generalLoyalty: { amt: 5 } } },
      { text: '斥其狂妄（众将忠诚-5，民心-3）', effect: { generalLoyalty: { amt: -5 }, morale: -3 } }
    ]
  },
  // 宗室和睦：宗室团结
  {
    id: 'zongshi_hemu', name: '宗室和睦', illustration: 'harvest',
    description: '宗室诸王放下嫌隙，宴饮于朝堂，携手共辅王室。国中宗室雍睦，人心安定。',
    options: [
      { text: '厚赏诸王（耗金500，众将忠诚+8）', effect: { money: -500, generalLoyalty: { amt: 8 } } }
    ]
  },
  // 百姓拥戴：万民拥戴
  {
    id: 'baixiong_yongdai', name: '百姓拥戴', illustration: 'harvest',
    description: '治下百姓感主公恩德，父老牵羊担酒，叩伏于道，争献万民伞。歌曰：明公在世，父母不过。',
    options: [
      { text: '慰劳父老（民心+15，金钱+500）', effect: { morale: 15, money: 500 } }
    ]
  },
  // ---- 特殊（4） ----
  // 异人献宝：异人献宝物
  {
    id: 'yiren_xianbao', name: '异人献宝', illustration: 'harvest',
    description: '有异人自称自昆仑来，献上古宝剑一口，剑锷晶莹，削铁如泥。云此剑当赠明主。',
    options: [
      { text: '厚赏异人（金钱+1500，招募一将）', effect: { money: 1500, recruitRandom: true } },
      { text: '疑其为妖，逐之（民心-3）', effect: { morale: -3 } }
    ]
  },
  // 高僧译经：高僧翻译佛经
  {
    id: 'gaoseng_yijing', name: '高僧译经', illustration: 'harvest',
    description: '有西域高僧携贝叶经东来，于寺中开译场，手执笔授，口诵梵音。十年译经千卷，佛法大明。',
    options: [
      { text: '护持译场（耗金600，文化+50，民心+5）', effect: { money: -600, culture: 50, morale: 5 } },
      { text: '仅以客礼待之（文化+20）', effect: { culture: 20 } }
    ]
  },
  // 道士飞升：道士尸解
  {
    id: 'daoshi_feisheng', name: '道士飞升', illustration: 'harvest',
    description: '有道士于山中炼形辟谷，忽一日云气绕室，异香满谷，弟子启户，但余衣履在榻，人已羽化而去。',
    options: [
      { text: '敕建观宇供奉（耗金500，文化+30，科技+10）', effect: { money: -500, culture: 30, tech: 10 } }
    ]
  },
  // 名医预防：防疫
  {
    id: 'mingyi_yufang', name: '名医备瘟', illustration: 'harvest',
    description: '有名医言今岁疠气将流行，建议预遣医官巡行郡县，施药散、掘深井、烧熏辟瘟。',
    options: [
      { text: '遣使巡行防疫（耗金500，人口+5000，民心+5）', effect: { money: -500, pop: 5000, morale: 5 } },
      { text: '备而不用（人口+1000）', effect: { pop: 1000 } }
    ]
  },

  // ---- V8.0 赋税/徭役系统事件 ----
  // 农民起义：赋税过重触发
  {
    id: 'tax_rebellion', name: '农民起义', illustration: 'rebellion',
    description: '赋税苛重，百姓不堪盘剥，聚众揭竿而起！地方动荡。',
    options: [
      { text: '减免赋税安抚（民心+15，收入-10%一回合）', effect: { morale: 15, money: -300 } },
      { text: '派兵镇压（耗兵力3000，民心-10）', effect: { armyLoss: 3000, morale: -10 } }
    ]
  },
  // 百姓逃亡：赋税过重人口流失
  {
    id: 'tax_refugees', name: '百姓逃亡', illustration: 'harvest',
    description: '赋税沉重，百姓不堪苛政，扶老携幼逃亡他乡。户口锐减。',
    options: [
      { text: '开仓恤民（耗粮2000，民心+8）', effect: { food: -2000, morale: 8 } },
      { text: '听之任之（人口-8000，民心-5）', effect: { pop: -8000, morale: -5 } }
    ]
  },
  // 徭役起义：徭役过重触发
  {
    id: 'corvee_rebellion', name: '徭役起义', illustration: 'rebellion',
    description: '徭役繁重，民夫怨声载道，聚众哗变！工程废弃。',
    options: [
      { text: '遣散民夫（民心+10，暂停徭役）', effect: { morale: 10 } },
      { text: '强令继续（耗兵力2000，民心-15）', effect: { armyLoss: 2000, morale: -15 } }
    ]
  },
  // 民夫逃亡：徭役过重
  {
    id: 'corvee_deserters', name: '民夫逃亡', illustration: 'harvest',
    description: '徭役无期，民夫相继逃亡，工地上十不存一。',
    options: [
      { text: '加赐酒食安抚（耗金400，民心+5）', effect: { money: -400, morale: 5 } },
      { text: '严刑督工（人口-5000，民心-8）', effect: { pop: -5000, morale: -8 } }
    ]
  },

  // ========== V8.5 天文异象事件（calendar.js 推送） ==========
  // 日食：阴侵阳，君道有亏。修德可弭天变。
  {
    id: 'anomaly_solar_eclipse', name: '日食', illustration: 'harvest',
    description: '白昼如夜，日为月所掩。太史令跪奏：「日者阳精，人君之象；今为阴所侵，恐有亡国失君之祸。」',
    options: [
      { text: '下诏罪己，避正殿、减膳（民心+10，正统+5）', effect: { morale: 10 } },
      { text: '大赦天下以应天变（耗金500，民心+5）', effect: { money: -500, morale: 5 } },
      { text: '不以为然', effect: { morale: -5 } }
    ]
  },
  // 月食：兵阴之象，外侮将临。
  {
    id: 'anomaly_lunar_eclipse', name: '月食', illustration: 'harvest',
    description: '望月而月忽蚀，血色荧荧。占曰：「月为太阴之精，主兵阴，将有边警。」',
    options: [
      { text: '警备边亭，犒赏三军（耗金400，军心+5）', effect: { money: -400, armyMorale: 5 } },
      { text: '修书与邻国修好', effect: { morale: 3 } }
    ]
  },
  // 彗星：除旧布新，天下将革。
  {
    id: 'anomaly_comet', name: '彗星见', illustration: 'harvest',
    description: '彗星长竟天，芒柄指西南。《星传》曰：「彗所以除旧布新也。」民间相传将有革代之变。',
    options: [
      { text: '修德省刑，以答天谴（民心+8）', effect: { morale: 8 } },
      { text: '求直言，举隐逸（招募一名在野贤才）', effect: { recruitRandom: true, morale: 3 } }
    ]
  },
  // 流星：异人星象，应在谋臣。
  {
    id: 'anomaly_meteor', name: '流星', illustration: 'harvest',
    description: '大星出紫宫，流光照地。占曰：「星陨而下，有异人起于草泽。」宜求之。',
    options: [
      { text: '遣使四方求异人（高智在野贤士来投）', effect: { spyMaster: true } },
      { text: '观而不问', effect: {} }
    ]
  },
  // 荧惑守心：王者恶之，兵革大丧。
  {
    id: 'anomaly_yinghuo', name: '荧惑守心', illustration: 'rebellion',
    description: '荧惑（火星）留守心宿，连日不去。占曰：「大人易政，主去其宫，天下兵革！」朝野震恐。',
    options: [
      { text: '避殿素服，亲祀郊坛（耗金800，民心+12）', effect: { money: -800, morale: 12 } },
      { text: '大赦天下，分置兵备（民心+5，耗兵力1500）', effect: { morale: 5, armyLoss: 1500 } },
      { text: '置之不理（民心-10）', effect: { morale: -10 } }
    ]
  },

  // ========== V8.5 节气特别事件 ==========
  // 清明：扫墓祭祖。
  {
    id: 'term_qingming', name: '清明扫墓', illustration: 'harvest',
    description: '清明时节，朝野祭扫先陵。孝子慈孙，追思祖德。',
    options: [
      { text: '亲率百官谒陵（正统+，文化+10）', effect: { culture: 10, morale: 5 } },
      { text: '赏赐孤寡（耗金300，民心+5）', effect: { money: -300, morale: 5 } }
    ]
  },
  // 冬至：祭天。
  {
    id: 'term_dongzhi', name: '冬至祭天', illustration: 'harvest',
    description: '冬至一阳生，天子郊祀昊天上帝。大祀毕，大赦天下，与民更始。',
    options: [
      { text: '亲祀南郊，大赦天下（正统+，民心+10）', effect: { morale: 10 } },
      { text: '朝会群臣，赏赐宗室（耗金600，忠诚+）', effect: { money: -600, generalLoyalty: { amt: 5 } } }
    ]
  },

  // ========== V9.0 新增随机事件（20个） ==========
  // ---- 军事 ----
  {
    id: 'v9_dajun_yajing', name: '大军压境', illustration: 'barbarian_invasion',
    description: '斥候来报，敌军大集于边境，旌旗数十里。边将请坚壁清野，以待其疲。',
    options: [
      { text: '坚壁清野（民心-5，守备稳固）', effect: { morale: -5, garrisonBuff: true } },
      { text: '主动出击（损兵2000，士气+）', effect: { armyLoss: 2000, morale: 5 } }
    ]
  },
  {
    id: 'v9_chihou_laibao', name: '斥候来报', illustration: 'harvest',
    description: '斥候星夜驰归，探明敌营虚实、粮草多寡。此乃天赐军机。',
    options: [
      { text: '厚赏斥候（耗金200，知敌情）', effect: { money: -200, tech: 5 } },
      { text: '令其再探', effect: { tech: 3 } }
    ]
  },
  {
    id: 'v9_jiehuo_zizhong', name: '缴获辎重', illustration: 'harvest',
    description: '偏师截敌粮道，夺得牛羊粮草无算！军资充裕。',
    options: [
      { text: '犒赏三军（粮草+3000，士气+8）', effect: { food: 3000, morale: 8 } }
    ]
  },
  {
    id: 'v9_fulu_dijiang', name: '俘虏敌将', illustration: 'barbarian_invasion',
    description: '阵前生缚敌将一员，槛送帐下。或劝降以用，或斩之以警。',
    options: [
      { text: '劝降纳之（募一将）', effect: { recruitRandom: true } },
      { text: '斩以徇军（士气+10，民心-5）', effect: { morale: 10, factionMorale: -5 } }
    ]
  },
  {
    id: 'v9_jiangshi_yongming', name: '将士用命', illustration: 'harvest',
    description: '三军将士感主公恩义，皆愿效死。磨刀霍霍，士气高涨！',
    options: [
      { text: '临阵激励（军心+15）', effect: { armyMorale: 15 } }
    ]
  },
  // ---- 政治 ----
  {
    id: 'v9_chaochen_tanhe', name: '朝臣弹劾', illustration: 'court',
    description: '御史台交章弹劾某刺史贪墨不法。或按律治罪，或曲为庇护。',
    options: [
      { text: '按律治罪（民心+10，忠诚-5）', effect: { factionMorale: 10, generalLoyalty: { amt: -5 } } },
      { text: '曲为庇护（金钱+800，民心-10）', effect: { money: 800, factionMorale: -10 } }
    ]
  },
  {
    id: 'v9_zongshi_neidou', name: '宗室内斗', illustration: 'court',
    description: '宗室诸王争权夺利，暗相倾轧。朝局暗流涌动，须早为制衡。',
    options: [
      { text: '调解分封（耗金500，忠诚+5）', effect: { money: -500, generalLoyalty: { amt: 5 } } },
      { text: '各打五十大板（忠诚-8）', effect: { generalLoyalty: { amt: -8 } } }
    ]
  },
  {
    id: 'v9_difang_jingong', name: '地方进贡', illustration: 'bazaar',
    description: '四方州郡贡献方物：良马、蜀锦、南珠。府库为之充实。',
    options: [
      { text: '悉数纳贡（金钱+1500）', effect: { money: 1500 } },
      { text: '优诏免贡（民心+10）', effect: { factionMorale: 10 } }
    ]
  },
  {
    id: 'v9_baixiang_qingyuan', name: '百姓请愿', illustration: 'harvest',
    description: '耆老伏阙请愿，恳请减赋缓刑。民情汹汹，不可不察。',
    options: [
      { text: '准其所请（民心+15，金钱-500）', effect: { factionMorale: 15, money: -500 } },
      { text: '驳回（民心-15）', effect: { factionMorale: -15 } }
    ]
  },
  {
    id: 'v9_yinshi_chushan', name: '隐士出山', illustration: 'harvest',
    description: '有隐士抱道隐居，闻主公求贤若渴，愿出茅庐以匡大业。',
    options: [
      { text: '备礼聘请（募一文臣）', effect: { recruitRandom: true, factionMorale: 5 } }
    ]
  },
  // ---- 经济 ----
  {
    id: 'v9_yantie_zhuanmai', name: '盐铁专卖', illustration: 'bazaar',
    description: '议者请盐铁官营，以收山泽之利。大利所在，然商贾怨之。',
    options: [
      { text: '行专卖（金钱+2000，商业-8）', effect: { money: 2000, comm: -8 } },
      { text: '从民便（商业+8）', effect: { comm: 8 } }
    ]
  },
  {
    id: 'v9_zhujian_jiangqing', name: '铸钱减重', illustration: 'bazaar',
    description: '府库空虚，有司请减重铸钱以足用。然钱轻物重，恐伤民生。',
    options: [
      { text: '铸大钱（金钱+1000，民心-10）', effect: { money: 1000, factionMorale: -10 } },
      { text: '恪守钱制（民心+5）', effect: { factionMorale: 5 } }
    ]
  },
  {
    id: 'v9_wujia_baozhang', name: '物价暴涨', illustration: 'drought',
    description: '谷价腾踊，斗米千钱。市井骚动，贫民难以为生。',
    options: [
      { text: '平抑物价（耗金800，民心+8）', effect: { money: -800, factionMorale: 8 } },
      { text: '听其自定价（民心-12）', effect: { factionMorale: -12 } }
    ]
  },
  {
    id: 'v9_shanglu_changtong', name: '商路畅通', illustration: 'silkroad',
    description: '关市无禁，商旅辐辏。蜀锦吴盐、胡马珍货络绎于道。',
    options: [
      { text: '轻关易道（金钱+1200，商业+10）', effect: { money: 1200, comm: 10 } }
    ]
  },
  {
    id: 'v9_huangnian_zhenzai', name: '荒年赈灾', illustration: 'drought',
    description: '连年歉收，流民塞路。不赈则饿殍载道，赈之则府库告急。',
    options: [
      { text: '开仓赈灾（耗粮3000，民心+15）', effect: { food: -3000, factionMorale: 15 } },
      { text: '赈粥度日（耗粮1000，民心+5）', effect: { food: -1000, factionMorale: 5 } }
    ]
  },
  // ---- 文化 ----
  {
    id: 'v9_shihui_yaji', name: '诗会雅集', illustration: 'harvest',
    description: '江南文士雅集于乌衣巷，诗酒唱和，名动江东。可遣使招揽。',
    options: [
      { text: '赐金润笔（文化+15，耗金500）', effect: { culture: 15, money: -500 } },
      { text: '与其风流（文化+8）', effect: { culture: 8 } }
    ]
  },
  {
    id: 'v9_shufa_dajia', name: '书法大家', illustration: 'bazaar',
    description: '有书家独步一时，龙蟠凤翥。得其墨宝，可光典册。',
    options: [
      { text: '厚礼求书（文化+10，耗金300）', effect: { culture: 10, money: -300 } }
    ]
  },
  {
    id: 'v9_minghua_wenshi', name: '名画问世', illustration: 'harvest',
    description: '画工绘就《春江晚景》，层峦耸翠，烟霞万顷，精妙入神。',
    options: [
      { text: '内府珍藏（文化+12，繁荣+5）', effect: { culture: 12, prosperity: 5 } }
    ]
  },
  {
    id: 'v9_cangshulou_cheng', name: '藏书楼成', illustration: 'bazaar',
    description: '集贤院藏书楼落成，经史子集充栋。文教大兴，英才毕至。',
    options: [
      { text: '赐额褒奖（文化+15，科技+5）', effect: { culture: 15, tech: 5 } }
    ]
  },
  {
    id: 'v9_taixue_kuazhao', name: '太学扩招', illustration: 'court',
    description: '有司请广太学名额，以广教化、育人才。',
    options: [
      { text: '广置生员（文化+10，耗金400）', effect: { culture: 10, money: -400 } },
      { text: '依旧制（无）', effect: { money: 0 } }
    ]
  },
  // ---- 特殊 ----
  {
    id: 'v9_yiren_xiance', name: '异人献策', illustration: 'harvest',
    description: '有异人自山间来，献奇策一卷，多为布阵练兵之术。',
    options: [
      { text: '拜为参军（科技+10，阵型经验）', effect: { tech: 10 } },
      { text: '束之高阁（无）', effect: { money: 0 } }
    ]
  },
  {
    id: 'v9_baojian_chutu', name: '宝剑出土', illustration: 'harvest',
    description: '农人掘地得古宝剑，锋锷如新，龙吟隐隐，盖干将莫邪之流亚。',
    options: [
      { text: '藏于武库（募一猛将）', effect: { recruitRandom: true } }
    ]
  },
  {
    id: 'v9_mingma_xianshi', name: '名马现世', illustration: 'harvest',
    description: '边郡献千里马，汗透疑血，日行千里。此乃飞兔騕褭之伦。',
    options: [
      { text: '赐给猛将（武将属性+5）', effect: { generalBuff: { id: null, amt: 5 }, recruitRandom: true } },
      { text: '闲厩饲养（金钱+500）', effect: { money: 500 } }
    ]
  },
  {
    id: 'v9_shenyi_chuzhen', name: '神医出诊', illustration: 'plague',
    description: '有神医自民间来，望闻问切，药到病除。军中伤病多赖以全。',
    options: [
      { text: '随军行医（士气+10，民心+5）', effect: { armyMorale: 10, morale: 5 } },
      { text: '厚遣之（耗金200）', effect: { money: -200 } }
    ]
  },
  {
    id: 'v9_gaoseng_doufa', name: '高僧斗法', illustration: 'buddhist_sermon',
    description: '名僧登坛讲经，辩才无碍，听者数千。或崇或抑，皆关风化。',
    options: [
      { text: '礼敬高僧（文化+15，民心+5）', effect: { culture: 15, factionMorale: 5 } },
      { text: '与之论难（文化+8）', effect: { culture: 8 } }
    ]
  },

  // ============================================================
  // V9.5 新增随机事件（20 个）：军事/政治/经济/文化/特殊
  // 沿用 EVENTS 格式 { id, name, illustration, description, options:[{text,effect}] }
  // ============================================================
  // ---- 军事（5）----
  {
    id: 'v95_sci_report', name: '斥候来报', illustration: 'barbarian_invasion',
    description: '斥候探得敌军虚实，粮道空虚，可乘虚而击。',
    options: [
      { text: '轻骑奔袭（损兵1000，敌疲敝）', effect: { armyLoss: 1000, morale: 5 } },
      { text: '按兵不动', effect: { } }
    ]
  },
  {
    id: 'v95_capture_baggage', name: '缴获辎重', illustration: 'harvest',
    description: '巡哨截获敌军运粮队，粮草军械堆积如山！',
    options: [
      { text: '尽数充公（粮草+2500）', effect: { food: 2500, money: 500 } }
    ]
  },
  {
    id: 'v95_capture_general', name: '俘虏敌将', illustration: 'battle',
    description: '阵前生擒敌方一员上将，敌营震动。或收降或献俘。',
    options: [
      { text: '劝降收用（募一将）', effect: { recruitRandom: true, morale: 5 } },
      { text: '斩之殉军（士气+10）', effect: { morale: 10 } }
    ]
  },
  {
    id: 'v95_soldiers_vow', name: '将士用命', illustration: 'cavalry_charge',
    description: '三军将士感念主公恩义，愿效死疆场，士气大振。',
    options: [
      { text: '犒赏三军（耗金500，士气+12）', effect: { money: -500, morale: 12 } }
    ]
  },
  {
    id: 'v95_elite_troops', name: '兵精粮足', illustration: 'harvest',
    description: '操练经年，卒伍精练，军械齐备，可堪大用。',
    options: [
      { text: '编入精锐（驻军+3000）', effect: { garrisonBoost: 3000, food: -800 } }
    ]
  },
  // ---- 政治（5）----
  {
    id: 'v95_official_impeach', name: '朝臣弹劾', illustration: 'court',
    description: '御史台联名弹劾某太守贪墨枉法，朝野哗然。',
    options: [
      { text: '严查问罪（民心+8，金钱+800）', effect: { money: 800, morale: 8 } },
      { text: '压下不究（忠诚-5，民心-5）', effect: { morale: -5 } }
    ]
  },
  {
    id: 'v95_clan_strife', name: '宗室内斗', illustration: 'court',
    description: '宗室诸王争权，各树党羽，朝堂暗流涌动。',
    options: [
      { text: '调停安抚（耗金600）', effect: { money: -600, morale: 3 } },
      { text: '严厉弹压（忠诚-10）', effect: { morale: -8 } }
    ]
  },
  {
    id: 'v95_local_tribute', name: '地方进贡', illustration: 'bazaar',
    description: '州郡牧守进献方物、珍玩良马，以表忠悃。',
    options: [
      { text: '欣然受之（金钱+1500）', effect: { money: 1500 } }
    ]
  },
  {
    id: 'v95_petition', name: '百姓请愿', illustration: 'harvest',
    description: '百姓父老叩阙请愿，求减赋息役，与民休息。',
    options: [
      { text: '准其所请（民心+12，金钱-500）', effect: { money: -500, morale: 12 } },
      { text: '婉拒之（民心-8）', effect: { morale: -8 } }
    ]
  },
  {
    id: 'v95_recluse_comes', name: '隐士出山', illustration: 'harvest',
    description: '山中隐士闻主公招贤，携策来投，有王佐之才。',
    options: [
      { text: '拜为谋主（募一将，智力+）', effect: { recruitRandom: true, morale: 3 } }
    ]
  },
  // ---- 经济（5）----
  {
    id: 'v95_salt_iron', name: '盐铁专卖', illustration: 'bazaar',
    description: '议实行盐铁官营，可充裕国库，然商贾不便。',
    options: [
      { text: '推行专卖（金钱+2000，商业-5）', effect: { money: 2000, comm: -5 } },
      { text: '仍行旧制', effect: { } }
    ]
  },
  {
    id: 'v95_coin_debase', name: '铸钱减重', illustration: 'bazaar',
    description: '钱重货轻，或可铸减重钱以济国用，然恐物价腾贵。',
    options: [
      { text: '减重铸钱（金钱+1000，民心-5）', effect: { money: 1000, morale: -5 } },
      { text: '恪守钱制（民心+3）', effect: { morale: 3 } }
    ]
  },
  {
    id: 'v95_price_hike', name: '物价暴涨', illustration: 'drought',
    description: '市井米珠薪桂，百物踊贵，百姓怨嗟。',
    options: [
      { text: '平抑物价（耗金800，民心+8）', effect: { money: -800, morale: 8 } },
      { text: '听之任之（民心-10）', effect: { morale: -10 } }
    ]
  },
  {
    id: 'v95_trade_flourish', name: '商路畅通', illustration: 'silkroad',
    description: '关梁无禁，商旅辐辏，南北货殖流通，税利倍增。',
    options: [
      { text: '弛关通商（金钱+1800，商业+6）', effect: { money: 1800, comm: 6 } }
    ]
  },
  {
    id: 'v95_famine_relief', name: '荒年赈灾', illustration: 'plague',
    description: '邻郡歉收，流民入境，或赈或逐，民心所系。',
    options: [
      { text: '开仓赈济（耗粮2000，民心+15）', effect: { food: -2000, morale: 15 } },
      { text: '关隘拒之（民心-12）', effect: { morale: -12 } }
    ]
  },
  // ---- 文化（5）----
  {
    id: 'v95_poetry_gathering', name: '诗会雅集', illustration: 'buddhist_sermon',
    description: '文人雅士会于兰亭曲水，赋诗论道，风流蕴藉。',
    options: [
      { text: '亲临主持（文化+12，民心+5）', effect: { culture: 12, morale: 5 } },
      { text: '资助雅集（文化+8）', effect: { money: -300, culture: 8 } }
    ]
  },
  {
    id: 'v95_calligrapher', name: '书法大家', illustration: 'buddhist_sermon',
    description: '有书法家献隶楷真迹，笔走龙蛇，堪为国宝。',
    options: [
      { text: '珍藏内府（文化+10）', effect: { culture: 10 } }
    ]
  },
  {
    id: 'v95_famous_painting', name: '名画问世', illustration: 'buddhist_sermon',
    description: '画工进《长江万里图》，咫尺千里，山水尽在缣素。',
    options: [
      { text: '传之后世（文化+12）', effect: { culture: 12 } }
    ]
  },
  {
    id: 'v95_library', name: '藏书楼成', illustration: 'buddhist_temple',
    description: '聚书万卷，建楼皮藏，学者云集，文教大兴。',
    options: [
      { text: '颁行天下（文化+15）', effect: { culture: 15, money: -500 } }
    ]
  },
  {
    id: 'v95_taixue_expand', name: '太学扩招', illustration: 'buddhist_temple',
    description: '太学诸生请增广生员，以广教化。',
    options: [
      { text: '广招生徒（文化+10，金钱-400）', effect: { money: -400, culture: 10 } }
    ]
  },
  // ---- 特殊（5）----
  {
    id: 'v95_stranger_advises', name: '异人献策', illustration: 'court',
    description: '有异人献攻守奇策，语多玄机，或可一试。',
    options: [
      { text: '采纳其策（科技点+1）', effect: { techPoint: 1 } },
      { text: '姑妄听之', effect: { } }
    ]
  },
  {
    id: 'v95_sword_excavated', name: '宝剑出土', illustration: 'harvest',
    description: '耕人于野掘得古剑，霜锋凛凛，斩金截玉，非凡物也。',
    options: [
      { text: '藏入武库（得一件宝物）', effect: { treasure: true } }
    ]
  },
  {
    id: 'v95_famous_horse', name: '名马现世', illustration: 'cavalry_charge',
    description: '边将进献大宛良驹，嘶风逐电，可骋千里。',
    options: [
      { text: '收入厩苑（得一匹良马）', effect: { treasure: true } }
    ]
  },
  {
    id: 'v95_divine_doctor', name: '神医出诊', illustration: 'harvest',
    description: '神医华佗再世，云游至此，军中病卒赖以全活。',
    options: [
      { text: '厚待留用（伤兵痊愈，民心+5）', effect: { morale: 5, money: -300 } }
    ]
  },
  {
    id: 'v95_buddhist_debate', name: '三教论衡', illustration: 'buddhist_sermon',
    description: '佛道儒三教名流齐聚殿前，论辩高下，观听者如堵。',
    options: [
      { text: '亲自主持（文化+15，民心+5）', effect: { culture: 15, morale: 5 } },
      { text: '命官主之（文化+8）', effect: { culture: 8 } }
    ]
  },

  // ============ V10.0 新增随机事件（25个） ============
  // ---- 军事类（7个）----
  {
    id: 'v100_dajun_yajing', name: '大军压境', illustration: 'rebellion',
    description: '斥候急报：邻国大军已压我边境，烽燧相望，军营连绵数十里。',
    options: [
      { text: '坚壁清野（耗金500，民心+5）', effect: { money: -500, morale: 5, defense: 5 } },
      { text: '遣使议和（耗金1000）', effect: { money: -1000, morale: -3 } }
    ]
  },
  {
    id: 'v100_chihou_laibao', name: '斥候来报', illustration: 'harvest',
    description: '斥候探得敌军虚实：营寨空虚，可乘虚而击！',
    options: [
      { text: '发兵奇袭（损兵1000，获敌粮2000）', effect: { armyLoss: 1000, food: 2000, morale: 3 } },
      { text: '按兵不动', effect: {} }
    ]
  },
  {
    id: 'v100_jiehuo_ziyang', name: '缴获辎重', illustration: 'harvest',
    description: '偏师截击敌军粮道，获其辎重粮草无数，满载而归。',
    options: [
      { text: '分赏三军（粮草+3000，民心+5）', effect: { food: 3000, morale: 5 } }
    ]
  },
  {
    id: 'v100_fulu_dijiang', name: '俘虏敌将', illustration: 'harvest',
    description: '前锋力战，生擒敌名将押至帐下。或斩或留，皆在主公。',
    options: [
      { text: '劝降归我（在野将来投）', effect: { recruitRandom: true, morale: 5 } },
      { text: '斩之以徇（民心+3，敌国怒）', effect: { morale: 3, barbarianRel: -10 } }
    ]
  },
  {
    id: 'v100_jiangshi_yongming', name: '将士用命', illustration: 'harvest',
    description: '三军将士感主公之恩，皆愿效死，士气如虹！',
    options: [
      { text: '犒赏三军（耗金300，士气+10）', effect: { money: -300, morale: 10 } }
    ]
  },
  {
    id: 'v100_bingjing_liangzu', name: '兵精粮足', illustration: 'harvest',
    description: '府库充盈，仓廪充实，兵马未动而粮草已备。',
    options: [
      { text: '整军经武（金钱+500，粮草+1000）', effect: { money: 500, food: 1000 } }
    ]
  },
  {
    id: 'v100_laojiang_tuyi', name: '老将退役', illustration: 'plague',
    description: '某老将年事已高，上表乞骸骨归乡。戎马一生，功成身退。',
    options: [
      { text: '厚加赏赐以荣之（耗金400，民心+5）', effect: { money: -400, morale: 5 } },
      { text: '挽留续任（属性-5，忠诚+10）', effect: { generalLoyalty: { amt: 5 } } }
    ]
  },
  // ---- 政治类（8个）----
  {
    id: 'v100_chaochen_tanhe', name: '朝臣弹劾', illustration: 'plague',
    description: '御史台联名弹劾某重臣，罪状累累，朝堂震动。',
    options: [
      { text: '命有司查勘（忠诚-5，耗金200）', effect: { money: -200, generalLoyalty: { amt: -3 } } },
      { text: '下狱问罪（民心+5，众将自危）', effect: { morale: 5, generalLoyalty: { amt: -8 } } }
    ]
  },
  {
    id: 'v100_zongshi_neidou', name: '宗室内斗', illustration: 'rebellion',
    description: '宗室诸王各树党羽，明争暗斗，政令多出多门。',
    options: [
      { text: '分藩就国（耗金600，民心-5）', effect: { money: -600, morale: -5 } },
      { text: '压制宗王（忠诚+5，民心-3）', effect: { generalLoyalty: { amt: 5 }, morale: -3 } }
    ]
  },
  {
    id: 'v100_difang_jingong', name: '地方进贡', illustration: 'harvest',
    description: '诸州郡表贺，献本地特产珍奇，珠玑、良马、香料络绎于道。',
    options: [
      { text: '受之国库（金钱+800）', effect: { money: 800 } },
      { text: '却而不受（民心+8）', effect: { morale: 8 } }
    ]
  },
  {
    id: 'v100_yinshi_chushan', name: '隐士出山', illustration: 'harvest',
    description: '有隐士隐居山林数十年，闻主公仁德，幡然来归。',
    options: [
      { text: '以礼聘之（在野名士来投）', effect: { recruitRandom: true, morale: 3 } }
    ]
  },
  {
    id: 'v100_chengyao_laitou', name: '贤臣来投', illustration: 'harvest',
    description: '邻国贤臣受排挤，渡江南来投奔，愿为主公运筹帷幄。',
    options: [
      { text: '辟为掾属（在野将来投）', effect: { recruitRandom: true, money: -200 } }
    ]
  },
  {
    id: 'v100_jiangchen_dangdao', name: '奸臣当道', illustration: 'plague',
    description: '奸臣蔽主，贿赂公行，忠直之士多被排挤，朝政日非。',
    options: [
      { text: '斥退奸臣（民心+8，耗金500）', effect: { money: -500, morale: 8 } },
      { text: '隐忍不发（民心-10）', effect: { morale: -10 } }
    ]
  },
  {
    id: 'v100_taizi_jianguo', name: '太子监国', illustration: 'harvest',
    description: '主公以太子监国，练其政事。东宫官属齐备，国本渐固。',
    options: [
      { text: '选师傅教之（耗金400，文化+10）', effect: { money: -400, culture: 10 } }
    ]
  },
  {
    id: 'v100_taihou_linchao', name: '太后临朝', illustration: 'harvest',
    description: '太后临朝听政，崇佛尊儒，政治修明，然女主之议纷纷。',
    options: [
      { text: '承制听政（政治+10，民心+5）', effect: { morale: 5, culture: 8 } },
      { text: '还政于帝（民心+3）', effect: { morale: 3 } }
    ]
  },
  // ---- 经济类（6个）----
  {
    id: 'v100_yantie_zhuanying', name: '盐铁专卖', illustration: 'harvest',
    description: '议者请置盐铁官，专卖盐铁以富国。民怨或生，然国库可充。',
    options: [
      { text: '行专卖法（金钱+1500，民心-5）', effect: { money: 1500, morale: -5 } },
      { text: '仍听民营（商业+5）', effect: { comm: 5 } }
    ]
  },
  {
    id: 'v100_zhufang_jiangzhong', name: '铸钱减重', illustration: 'plague',
    description: '府库空虚，有司请铸小钱以足用。钱愈轻而物愈贵，民以为病。',
    options: [
      { text: '从之（金钱+800，商业-8）', effect: { money: 800, comm: -8 } },
      { text: '不许（民心+3）', effect: { morale: 3 } }
    ]
  },
  {
    id: 'v100_shanglu_changtong', name: '商路畅通', illustration: 'harvest',
    description: '边境无事，胡汉商路畅通，西域珍宝、江南珍货云集。',
    options: [
      { text: '轻税通商（金钱+1000，商业+8）', effect: { money: 1000, comm: 8 } }
    ]
  },
  {
    id: 'v100_kuangshan_faxian', name: '矿山发现', illustration: 'harvest',
    description: '山民报：某地发现铜矿，苗脉甚旺。开之可富国。',
    options: [
      { text: '设官开矿（金钱+600，农业-3）', effect: { money: 600, agri: -3 } },
      { text: '暂不开采（人口+2000）', effect: { pop: 2000 } }
    ]
  },
  {
    id: 'v100_yanchi_kaifa', name: '盐池开发', illustration: 'harvest',
    description: '解池盐卤丰厚，遣吏煮盐，岁获利甚厚。',
    options: [
      { text: '大兴煮盐（金钱+700，商业+5）', effect: { money: 700, comm: 5 } }
    ]
  },
  {
    id: 'v100_gongjiang_laitou', name: '工匠来投', illustration: 'harvest',
    description: '关东、蜀地工匠辗转来投，善冶铸、造弩、营缮。',
    options: [
      { text: '厚待安置（耗金300，商业+6）', effect: { money: -300, comm: 6, prosperity: 4 } }
    ]
  },
  // ---- 文化类（4个）----
  {
    id: 'v100_minghua_wenshi', name: '名画问世', illustration: 'harvest',
    description: '有画工绘《长江万里图》，笔意精妙，江东胜景尽收绢素。',
    options: [
      { text: '购藏内府（耗金300，文化+12）', effect: { money: -300, culture: 12 } }
    ]
  },
  {
    id: 'v100_cangshulou_cheng', name: '藏书楼成', illustration: 'harvest',
    description: '聚经史子集三万余卷，建楼贮藏，嘉惠后学。',
    options: [
      { text: '颁赐四部（耗金500，文化+15）', effect: { money: -500, culture: 15 } }
    ]
  },
  {
    id: 'v100_taixue_kuojiao', name: '太学扩招', illustration: 'buddhist_temple',
    description: '太学生员倍增，名儒云集，讲经论义，文化大兴。',
    options: [
      { text: '广选生徒（耗金400，文化+10）', effect: { money: -400, culture: 10 } }
    ]
  },
  {
    id: 'v100_yueji_xianyi', name: '乐师献艺', illustration: 'musician',
    description: '有乐师妙解音律，奏《清商三调》，金石丝竹，绕梁三日。',
    options: [
      { text: '留于乐府（耗金200，文化+8）', effect: { money: -200, culture: 8 } }
    ]
  },

  // ============================================================
  // V10.5 新增随机事件（20个，v105_ 前缀）
  // 历史背景：南北朝祥瑞、胡汉文化交融、门阀清议、马政漕运、山越吐谷浑边患。
  // 技术：复用既有 effect 键（money/food/morale/pop/comm/prosperity/culture/tech/
  //       armyMorale/factionMorale/armyLoss/recruitRandom/barbarianRel），插画用已存在键并 onerror 回退。
  // ============================================================

  // ---- 祥瑞类（天文/政治） ----
  {
    id: 'v105_huanghe_qing', name: '黄河清', illustration: 'harvest',
    description: '黄河千载一清，百里澄碧，父老聚观。史臣曰：圣人出，黄河清，此一统之兆也。',
    options: [
      { text: '下诏庆瑞（耗金500，民心+15，文化+10）', effect: { money: -500, morale: 15, culture: 10 } },
      { text: '史官记瑞而已（文化+5）', effect: { culture: 5 } }
    ]
  },
  {
    id: 'v105_huanglong_xian', name: '黄龙现', illustration: 'harvest',
    description: '醴泉宫中见黄龙，蜿蜒蟠柱，久之乃去。群臣称贺，以为受命之符。',
    options: [
      { text: '大赦改元（民心+12，耗金600）', effect: { money: -600, morale: 12 } },
      { text: '秘之不宣（军心+5）', effect: { armyMorale: 5 } }
    ]
  },
  {
    id: 'v105_bailu_xian', name: '白鹿现', illustration: 'harvest',
    description: '苑囿获白鹿，角歧而趾雪。太常奏曰：王者明恕，则白鹿见。',
    options: [
      { text: '荐之宗庙（民心+8，文化+5）', effect: { morale: 8, culture: 5 } }
    ]
  },
  {
    id: 'v105_tianyusu', name: '天雨粟', illustration: 'harvest',
    description: '秋夜天雨粟于野，粒粒如珠，民争取食。父老以为丰年之兆。',
    options: [
      { text: '与民同庆（粮草+2000，民心+8）', effect: { food: 2000, morale: 8 } },
      { text: '藏入太仓（粮草+3500）', effect: { food: 3500 } }
    ]
  },
  {
    id: 'v105_liquang_chu', name: '醴泉涌出', illustration: 'harvest',
    description: '宫中阶下醴泉涌出，味如甘醴，疮痍饮之辄愈。此水德瑞应。',
    options: [
      { text: '饮以疗军（军心+10，人口+2000）', effect: { armyMorale: 10, pop: 2000 } },
      { text: '封而祀之（民心+5，文化+5）', effect: { morale: 5, culture: 5 } }
    ]
  },

  // ---- 文化交融类 ----
  {
    id: 'v105_guiyue_yue', name: '龟兹乐来', illustration: 'harvest',
    description: '龟兹遣使献其乐，琵琶箜篌，铿锵新声。胡乐入于雅部，朝野竞习之。',
    options: [
      { text: '教习乐府（耗金300，文化+15）', effect: { money: -300, culture: 15 } },
      { text: '散于民间（文化+8）', effect: { culture: 8 } }
    ]
  },
  {
    id: 'v105_pipa_miaoshou', name: '琵琶妙手', illustration: 'harvest',
    description: '有胡儿善琵琶，一声欲裂，众乐皆废。洛下豪右，争迎致之。',
    options: [
      { text: '置之左右（耗金200，文化+10）', effect: { money: -200, culture: 10 } }
    ]
  },
  {
    id: 'v105_xuantan_qingyi', name: '玄谈清议', illustration: 'harvest',
    description: '名士于洛水之滨清谈，祖玄理，辨名实，辞锋玄远。江东士子，望风归慕。',
    options: [
      { text: '与诸贤论难（耗金400，文化+18，政治将才+3）', effect: { money: -400, culture: 18, generalPolitics: { amt: 3 } } },
      { text: '漠然不答（文化+3）', effect: { culture: 3 } }
    ]
  },
  {
    id: 'v105_wuji_xianyi', name: '舞姬献艺', illustration: 'harvest',
    description: '江南舞姬善《前溪》《明君》之舞，罗袜生尘，回风舞雪。',
    options: [
      { text: '留之教坊（耗金250，民心+5，文化+8）', effect: { money: -250, morale: 5, culture: 8 } },
      { text: '厚遣还家（民心+8）', effect: { morale: 8 } }
    ]
  },

  // ---- 经济民生类 ----
  {
    id: 'v105_chama_hushi', name: '茶马互市', illustration: 'bazaar',
    description: '西羌慕义，请以马市茶。边民两利，岁得良马数千匹，国用赖焉。',
    options: [
      { text: '开市互市（金钱+1500，兵源+2000，商业+6）', effect: { money: 1500, pop: 2000, comm: 6 } },
      { text: '禁马出塞（商业-3，军心+5）', effect: { comm: -3, armyMorale: 5 } }
    ]
  },
  {
    id: 'v105_yeti_guzhu', name: '冶铁鼓铸', illustration: 'harvest',
    description: '鼓铸于山，铁精钢坚，器用犀利。盐铁之利，尽入于官。',
    options: [
      { text: '官营鼓铸（耗金500，科技+15，兵源+1500）', effect: { money: -500, tech: 15, pop: 1500 } },
      { text: '听民自铸（金钱+800，商业+5）', effect: { money: 800, comm: 5 } }
    ]
  },
  {
    id: 'v105_caoyun_shutong', name: '漕运疏通', illustration: 'harvest',
    description: '发卒疏漕渠，自江达河，舟楫无阻。关东之粟，可溯流而至。',
    options: [
      { text: '力役开渠（耗金700，粮草+3000，商业+5）', effect: { money: -700, food: 3000, comm: 5 } }
    ]
  },
  {
    id: 'v105_yicang_dafeng', name: '义仓大丰', illustration: 'harvest',
    description: '诸郡义仓积谷充盈，陈陈相因。虽遇水旱，民无菜色。',
    options: [
      { text: '出陈易新（粮草+4000，民心+6）', effect: { food: 4000, morale: 6 } },
      { text: '留以备荒（粮草+2000）', effect: { food: 2000 } }
    ]
  },
  {
    id: 'v105_yanchi_ruiying', name: '盐池瑞应', illustration: 'harvest',
    description: '解池盐花自生，不假人工，色白如雪，岁入倍增。',
    options: [
      { text: '官收其利（金钱+2500，商业+4）', effect: { money: 2500, comm: 4 } }
    ]
  },

  // ---- 军事武备类 ----
  {
    id: 'v105_mazheng_daxing', name: '马政大兴', illustration: 'harvest',
    description: '陇右牧监蕃息，牧马数十万，蹄角相望。铁骑可成，逐利中原。',
    options: [
      { text: '广置牧监（耗金600，兵源+3000，军心+6）', effect: { money: -600, pop: 3000, armyMorale: 6 } },
      { text: '互市易马（金钱-400，兵源+1500）', effect: { money: -400, pop: 1500 } }
    ]
  },
  {
    id: 'v105_bazhen_yanwu', name: '八阵演武', illustration: 'cavalry_charge',
    description: '大将演八阵于郊，天地风云，龙虎鸟蛇，奇正相生，士皆习之。',
    options: [
      { text: '亲阅大军（耗金300，军心+12）', effect: { money: -300, armyMorale: 12 } },
      { text: '止而不阅（军心-4）', effect: { armyMorale: -4 } }
    ]
  },
  {
    id: 'v105_fuqiao_cheng', name: '浮桥建成', illustration: 'harvest',
    description: '于大江连舟为桥，铁锁横流，人马可渡。天堑变通途，经略江南有望。',
    options: [
      { text: '厚赏工匠（耗金800，科技+12，军心+5）', effect: { money: -800, tech: 12, armyMorale: 5 } }
    ]
  },
  {
    id: 'v105_tuyuhun_raobian', name: '吐谷浑扰边', illustration: 'barbarian_invasion',
    description: '吐谷浑骑数千，寇掠凉鄯，杀长吏，边烽昼警。',
    options: [
      { text: '发兵驱逐（损兵1500，军心+5）', effect: { armyLoss: 1500, armyMorale: 5 } },
      { text: '赂以金帛（金钱-900，民心-4）', effect: { money: -900, morale: -4 } }
    ]
  },
  {
    id: 'v105_shanyue_chujiang', name: '山越出降', illustration: 'harvest',
    description: '丹阳山越阻险自守，累世不宾。今帅种落三千余户出山，愿为王民。',
    options: [
      { text: '处之内地（人口+5000，粮草+1500）', effect: { pop: 5000, food: 1500 } },
      { text: '编为劲卒（兵源+3000，军心+4）', effect: { pop: 3000, armyMorale: 4 } }
    ]
  },
  {
    id: 'v105_haichuan_laigong', name: '海船来贡', illustration: 'maritime',
    description: '海外昆仑舶随风而至，献明珠、玳瑁、香料。译言其国慕义，愿常朝贡。',
    options: [
      { text: '厚答其使（金钱+2000，商业+8，文化+5）', effect: { money: 2000, comm: 8, culture: 5 } },
      { text: '却而不受（民心+5）', effect: { morale: 5 } }
    ]
  },

  // ---------- V11.0 新增随机事件（20个） ----------
  {
    id: 'v110_xinbing_ruwu', name: '新兵入伍', illustration: 'harvest',
    description: '各州郡征发的新兵陆续抵达军营，操演阵法，军容渐盛。',
    options: [
      { text: '严加操练（兵源+2000，军心+3）', effect: { pop: 2000, armyMorale: 3 } },
      { text: '散归务农（粮草+1000）', effect: { food: 1000 } }
    ]
  },
  {
    id: 'v110_quanchen_shanzheng', name: '权臣擅政', illustration: 'court',
    description: '朝中权臣结党营私，排斥异己，政令多由其门出，主公威权渐替。',
    options: [
      { text: '削权制衡（耗金800，众将忠诚+5）', effect: { money: -800, generalLoyalty: { amt: 5 } } },
      { text: '隐忍待时（忠诚-8）', effect: { generalLoyalty: { amt: -8 } } }
    ]
  },
  {
    id: 'v110_wuji_xianyi', name: '舞姬献艺', illustration: 'musician',
    description: '江南舞姬入献，翘袖折腰，姿容绝世。军中宴饮，士气稍振。',
    options: [
      { text: '纳入后营（金钱-500，军心+5）', effect: { money: -500, armyMorale: 5 } },
      { text: '赐还归家（民心+3）', effect: { morale: 3 } }
    ]
  },
  {
    id: 'v110_tuntian_fengshou', name: '屯田丰收', illustration: 'harvest',
    description: '各军屯田连年丰收，积谷数十万斛，军粮充足。',
    options: [
      { text: '充入军仓（粮草+3000）', effect: { food: 3000 } }
    ]
  },
  {
    id: 'v110_zhanma_bingsi', name: '战马病死', illustration: 'horse_plague',
    description: '塞外传入马疫，军中战马成群倒毙，骑兵战力大损。',
    options: [
      { text: '隔离救治（耗金600，骑兵折损减半）', effect: { money: -600, cavalryLoss: 0.5 } },
      { text: '听之任之（骑兵损失惨重）', effect: { cavalryLoss: 1.0 } }
    ]
  },
  {
    id: 'v110_chengqiang_xiushan', name: '城墙修缮', illustration: 'wall_donation',
    description: '各地城墙年久失修，多处坍塌，需及时修缮以防敌袭。',
    options: [
      { text: '征发民夫修缮（耗金500，防御+8）', effect: { money: -500, defense: 8 } },
      { text: '暂不修葺（防御-5）', effect: { defense: -5 } }
    ]
  },
  {
    id: 'v110_shangdui_yujie', name: '商队遇劫', illustration: 'rebellion',
    description: '过路商队在山道为山贼所劫，货物被抢，商人逃归哭诉。',
    options: [
      { text: '派兵剿匪（损兵500，商业+3）', effect: { armyLoss: 500, comm: 3 } },
      { text: '赔偿安抚（耗金400）', effect: { money: -400 } }
    ]
  },
  {
    id: 'v110_rusheng_yizheng', name: '儒生议政', illustration: 'taixue_lecture',
    description: '太学生聚议朝政，直言得失，言辞激烈。或可为治道之资。',
    options: [
      { text: '虚心纳谏（民心+8，政治+5）', effect: { morale: 8, politics: 5 } },
      { text: '斥其妄言（民心-8）', effect: { morale: -8 } }
    ]
  },
  {
    id: 'v110_hushang_xianma', name: '胡商献马', illustration: 'hu_merchant_horses',
    description: '西域胡商带来大宛良马千匹，汗血龙种，可充军马。',
    options: [
      { text: '重金购买（耗金1000，骑兵+1500）', effect: { money: -1000, cavalryGain: 1500 } },
      { text: '婉拒不受', effect: {} }
    ]
  },
  {
    id: 'v110_heqing_haiyan', name: '河清海晏', illustration: 'harvest',
    description: '黄河清、海波平，天下安定之象。百姓讴歌，朝野称庆。',
    options: [
      { text: '大赦天下（民心+12）', effect: { morale: 12, money: -300 } }
    ]
  },
  {
    id: 'v110_huangguo_guojing', name: '蝗群过境', illustration: 'locust_swarm',
    description: '大群飞蝗自西北而来，遮天蔽日，所过田亩皆尽。',
    options: [
      { text: '募民捕蝗（耗金400，损失减半）', effect: { money: -400, food: -1000 } },
      { text: '束手无策（粮草-3000）', effect: { food: -3000, morale: -8 } }
    ]
  },
  {
    id: 'v110_liumin_baodong', name: '流民暴动', illustration: 'peasant_revolt',
    description: '饥民聚集成群，攻打城邑，州郡告急！',
    options: [
      { text: '出兵镇压（损兵2000）', effect: { armyLoss: 2000, morale: 3 } },
      { text: '开仓赈济（耗粮2000）', effect: { food: -2000, morale: 5 } }
    ]
  },
  {
    id: 'v110_jiangxiao_biwu', name: '将校比武', illustration: 'cavalry_charge',
    description: '军中举行比武大会，将校各显身手，优胜者赏赐金帛。',
    options: [
      { text: '亲自主持（军心+8，武力+3）', effect: { armyMorale: 8, force: 3 } },
      { text: '略加赏赐（军心+3）', effect: { armyMorale: 3, money: -200 } }
    ]
  },
  {
    id: 'v110_sengdao_zhengdi', name: '僧道争地', illustration: 'buddhist_temple',
    description: '佛寺与道观为田产水源争讼不休，地方官难以裁决。',
    options: [
      { text: '秉公裁断（民心+5，文化+3）', effect: { morale: 5, culture: 3 } },
      { text: '各打五十大板（耗金200）', effect: { money: -200 } }
    ]
  },
  {
    id: 'v110_tongkuang_faxian', name: '铜矿发现', illustration: 'ancient_ruins',
    description: '民夫在山中发现新铜矿，矿脉丰沛，可鼓铸钱币兵器。',
    options: [
      { text: '设官开采（金钱每回合+200，商业+5）', effect: { money: 500, comm: 5, passiveIncome: 200 } }
    ]
  },
  {
    id: 'v110_yunhe_shujun', name: '运河疏浚', illustration: 'maritime_trade',
    description: '旧运河淤塞多年，漕运不畅。若疏浚可通漕运，利及数州。',
    options: [
      { text: '征发民夫疏浚（耗金800，粮草-1000，商业+10）', effect: { money: -800, food: -1000, comm: 10 } },
      { text: '暂不疏浚', effect: {} }
    ]
  },
  {
    id: 'v110_bianguan_hushi', name: '边关互市', illustration: 'nomad_market',
    description: '边境将领奏请开放互市，与柔然突厥交易战马皮毛。',
    options: [
      { text: '开放互市（金钱+1500，商业+8）', effect: { money: 1500, comm: 8, barbarianRel: 10 } },
      { text: '禁止互市（民心+3）', effect: { morale: 3, barbarianRel: -5 } }
    ]
  },
  {
    id: 'v110_wenyi_chuqi', name: '瘟疫初起', illustration: 'plague',
    description: '边境传来瘟疫消息，尚未蔓延至腹地。宜早做防备。',
    options: [
      { text: '封锁边境（耗金300，防止蔓延）', effect: { money: -300, morale: 2 } },
      { text: '不以为意（瘟疫可能蔓延）', effect: { plagueRisk: true } }
    ]
  },
  {
    id: 'v110_xiangrui_xianrui', name: '地方献瑞', illustration: 'buddhist_sermon',
    description: '地方奏称凤凰来仪、嘉禾生亩，种种祥瑞不一而足。',
    options: [
      { text: '宣付史馆（民心+8，文化+5）', effect: { morale: 8, culture: 5 } },
      { text: '据实驳斥（民心+3）', effect: { morale: 3 } }
    ]
  },
  {
    id: 'v110_laochen_qihaiigu', name: '老臣乞骸骨', illustration: 'court',
    description: '跟随主公多年的老臣年事已高，上表请求致仕归乡。',
    options: [
      { text: '准许致仕（该将退休，民心+3）', effect: { generalRetire: true, morale: 3 } },
      { text: '慰留重用（忠诚+5，但老臣疲惫）', effect: { generalLoyalty: { amt: 5 }, healthDebuff: true } }
    ]
  },

  // ============================================================
  // V11.5 新增随机事件（20个）：军事/政治/经济/文化/特殊
  // 历史依据：参考《南北朝年谱》《魏书》《南齐书》《陈书》《资治通鉴》。
  // 效果字段复用 events.js applyEvent 已支持的键：money/food/pop/morale/factionMorale/
  //   agri/comm/prosperity/culture/armyMorale/armyLoss/recruitRandom/barbarianRel/generalLoyalty。
  // ============================================================
  // ---- 军事（4）----
  {
    id: 'v115_scout_report', name: '斥候来报', illustration: 'barbarian_invasion',
    description: '斥候星夜驰还，详陈敌营虚实、粮草多寡、主将动静。军情可握，胜机在先。',
    options: [
      { text: '厚赏斥候（耗金200，军心+5）', effect: { money: -200, armyMorale: 5 } },
      { text: '简略问之', effect: { armyMorale: 2 } }
    ]
  },
  {
    id: 'v115_captured_general', name: '俘虏敌将', illustration: 'rebellion',
    description: '两军交锋，我军生俘敌阵一员战将。其人勇武知名，或可为我所用。',
    options: [
      { text: '解缚劝降（耗金300，招募一将）', effect: { money: -300, recruitRandom: true } },
      { text: '当众枭首（立威，民心-5）', effect: { money: 200, morale: -5 } }
    ]
  },
  {
    id: 'v115_troops_eager', name: '将士用命', illustration: 'cavalry_charge',
    description: '校场演武，三军踊跃，皆言愿为主公效死疆场。士气可用，当厚赏以励之。',
    options: [
      { text: '犒赏三军（耗金600，军心+15）', effect: { money: -600, armyMorale: 15 } },
      { text: '温言慰勉（军心+5）', effect: { armyMorale: 5 } }
    ]
  },
  {
    id: 'v115_siege_engine', name: '攻城器械成', illustration: 'city_siege',
    description: '军器监督造楼车、撞车、飞云梯毕工，列于校场。临城之日，破竹可期。',
    options: [
      { text: '拨款营造（耗金500，商业+5）', effect: { money: -500, comm: 5 } },
      { text: '暂缓修葺', effect: { comm: 0 } }
    ]
  },
  // ---- 政治（4）----
  {
    id: 'v115_court_impeach', name: '朝臣弹劾', illustration: 'court',
    description: '御史台联名上疏，弹劾某位重臣植党营私、纳贿乱政。朝堂之上，议论汹汹。',
    options: [
      { text: '命有司查问（群臣忠诚-5）', effect: { generalLoyalty: { amt: -5 } } },
      { text: '留中不发（群臣忠诚+5，民心-5）', effect: { generalLoyalty: { amt: 5 }, morale: -5 } }
    ]
  },
  {
    id: 'v115_local_tribute', name: '地方进贡', illustration: 'harvest',
    description: '州郡牧守遣使进贡地方珍异：良马、明珠、蜀锦、名香，充溢阙下。',
    options: [
      { text: '悉数收纳（金钱+800，商业+3）', effect: { money: 800, comm: 3 } },
      { text: '却还不受（民心+5）', effect: { morale: 5 } }
    ]
  },
  {
    id: 'v115_people_petition', name: '百姓请愿', illustration: 'harvest',
    description: '父老数千人伏于阙下，恳请减免今年赋调、抚恤鳏寡。民心向背，在此一举。',
    options: [
      { text: '准其所请（耗粮1000，民心+12）', effect: { food: -1000, morale: 12 } },
      { text: '婉言遣散（民心-10）', effect: { morale: -10 } }
    ]
  },
  {
    id: 'v115_regent_minister', name: '权臣秉政', illustration: 'court',
    description: '辅政大臣总揽朝纲，文武将吏多出其门。借其力则上下帖然，久则主少国疑。',
    options: [
      { text: '借力行政（金钱+500，群臣忠诚-8）', effect: { money: 500, generalLoyalty: { amt: -8 } } },
      { text: '渐收权柄（耗金300，群臣忠诚+5）', effect: { money: -300, generalLoyalty: { amt: 5 } } }
    ]
  },
  // ---- 经济（5）----
  {
    id: 'v115_salt_iron_monopoly', name: '盐铁专卖', illustration: 'harvest',
    description: '计臣建言：盐铁乃国之大利，宜收归官营，置监鬻卖，以实府库。然与民争利。',
    options: [
      { text: '推行专卖（金钱+1500，商业-3，民心-3）', effect: { money: 1500, comm: -3, morale: -3 } },
      { text: '仍许民卖（民心+3）', effect: { morale: 3 } }
    ]
  },
  {
    id: 'v115_coin_debase', name: '铸钱减重', illustration: 'harvest',
    description: '府库空匮，少府欲铸减重大钱，一当五而行之。钱值日轻，物价腾踊。',
    options: [
      { text: '铸大钱（金钱+1000，商业-8）', effect: { money: 1000, comm: -8 } },
      { text: '维持旧制', effect: { comm: 0 } }
    ]
  },
  {
    id: 'v115_charity_granary', name: '义仓备荒', illustration: 'harvest',
    description: '有司请于州郡置义仓，丰年纳粟、荒年出赈。虽暂耗仓储，实乃百年之长计。',
    options: [
      { text: '诏置义仓（耗粮1500，民心+8）', effect: { food: -1500, morale: 8 } }
    ]
  },
  {
    id: 'v115_canal_dredge', name: '漕运疏浚', illustration: 'harvest',
    description: '漕渠年久淤塞，舟楫不通。发民疏浚，可通转运、溉田畴，公私两便。',
    options: [
      { text: '发夫疏浚（耗粮800，商业+8，农业+5）', effect: { food: -800, comm: 8, agri: 5 } },
      { text: '暂不兴工（商业-3）', effect: { comm: -3 } }
    ]
  },
  {
    id: 'v115_border_market', name: '互市开市', illustration: 'barbarian_invasion',
    description: '边将奏请于关隘置互市，以我缯彩茶盐易彼牛马皮货。边货流通，两族皆安。',
    options: [
      { text: '开市通商（金钱+900，商业+5，诸胡关系+10）', effect: { money: 900, comm: 5, barbarianRel: 10 } },
      { text: '禁绝互市（诸胡关系-8）', effect: { barbarianRel: -8 } }
    ]
  },
  // ---- 文化（4）----
  {
    id: 'v115_famous_painting', name: '名画问世', illustration: 'buddhist_sermon',
    description: '吴中画工绘《南都赋图》成，山水人物，尺幅千里，见者惊叹。江东文物，于斯为盛。',
    options: [
      { text: '购藏内府（耗金400，文化+10）', effect: { money: -400, culture: 10 } },
      { text: '厚赐画工（文化+6）', effect: { culture: 6 } }
    ]
  },
  {
    id: 'v115_grand_library', name: '藏书楼成', illustration: 'buddhist_sermon',
    description: '秘书监校定经史子集三万余卷，建楼以藏。卷轴盈栋，文教大兴，学者归之。',
    options: [
      { text: '赐名开放（耗金500，文化+12）', effect: { money: -500, culture: 12 } }
    ]
  },
  {
    id: 'v115_taixue_expand', name: '太学扩招', illustration: 'buddhist_sermon',
    description: '太学诸生员阙日隘，远方儒者不得入。有司请增广学舍、广召生徒，以崇文治。',
    options: [
      { text: '诏扩招（耗金600，文化+10，民心+3）', effect: { money: -600, culture: 10, morale: 3 } },
      { text: '维持旧额', effect: {} }
    ]
  },
  {
    id: 'v115_yuefu_song', name: '乐府新声', illustration: 'buddhist_sermon',
    description: '乐府采诗官巡行州里，得江南新曲、塞北胡乐，协以音律，被之管弦。天颜大悦。',
    options: [
      { text: '命协律郎润色（文化+6，民心+3）', effect: { culture: 6, morale: 3 } }
    ]
  },
  // ---- 特殊（3）----
  {
    id: 'v115_divine_sword', name: '宝剑出土', illustration: 'court',
    description: '耕民于野掘得古铜剑一，寒光射人，刻篆不可识。识者谓是吴王阖闾故物。神兵现世，其有兆乎？',
    options: [
      { text: '供奉武库（军心+8）', effect: { armyMorale: 8 } },
      { text: '赐麾下猛将（群臣忠诚+5）', effect: { generalLoyalty: { amt: 5 }, armyMorale: 3 } }
    ]
  },
  {
    id: 'v115_famous_horse', name: '名马现世', illustration: 'cavalry_charge',
    description: '边郡献千里马，逐驰逐影，汗透赤色，号为「赤龙」。此乃绝尘之足，可补骑兵。',
    options: [
      { text: '以重价购得（耗金300，军心+8）', effect: { money: -300, armyMorale: 8 } },
      { text: '却而不受', effect: { morale: 2 } }
    ]
  },
  {
    id: 'v115_phoenix_appears', name: '凤凰来仪', illustration: 'buddhist_sermon',
    description: '南山奏称有五彩鸟翔于乔木，鸣声中宫商，疑是凤凰。朝野相庆，以为王者之瑞。',
    options: [
      { text: '受瑞大赦（民心+10，文化+5）', effect: { morale: 10, culture: 5 } },
      { text: '修德应之（民心+5）', effect: { morale: 5 } }
    ]
  },

  // === V12.0 新增随机事件（20个）===
  // 军事类
  {
    id: 'v120_yueyue_lian_zhen', name: '却月列阵', illustration: 'cavalry_charge',
    description: '诸将于演武场演练却月阵。车步协同，弓弩交错，北府旧法焕然复新。',
    options: [
      { text: '加赏军士（耗金400，弓兵经验+5）', effect: { money: -400, archerExp: 5 } },
      { text: '仅阅而已', effect: {} }
    ]
  },
  {
    id: 'v120_tubu_fubing_zhi', name: '府兵整训', illustration: 'harvest',
    description: '关陇府兵耕战一体，农事之余操练弓马。农隙讲武，兵农合一。',
    options: [
      { text: '整饬府兵（兵精粮足，步兵+5%）', effect: { infantryMult: 0.05, morale: 5 } },
      { text: '从轻简阅', effect: {} }
    ]
  },
  {
    id: 'v120_jiehu_dajie', name: '截获商队', illustration: 'bazaar',
    description: '边境游骑截获胡商商队，货物堆积如山。或取或还，皆在主公。',
    options: [
      { text: '没收货物（金钱+800，民心-5）', effect: { money: 800, morale: -5 } },
      { text: '护送归还（民心+8，商人好感）', effect: { morale: 8, comm: 5 } }
    ]
  },
  {
    id: 'v120_jiangjun_bingju', name: '将军病卒', illustration: 'plague',
    description: '一员宿将染疾不治，军中失柱石。三军缟素，士气低落。',
    options: [
      { text: '厚赠抚恤（耗金500，军心安定）', effect: { money: -500, morale: 3 } },
      { text: '依礼发丧', effect: { morale: -8 } }
    ]
  },
  // 政治类
  {
    id: 'v120_tanhe_chengjixian', name: '弹劾成济', illustration: 'court',
    description: '有臣下弹劾某臣骄纵不法，罪证确凿。或严惩或宽宥，关乎朝纲。',
    options: [
      { text: '严惩不贷（金钱-300，民心+8）', effect: { money: -300, morale: 8 } },
      { text: '念旧宽宥（忠诚-10，臣下不安）', effect: { loyaltyPenalty: 10 } }
    ]
  },
  {
    id: 'v120_zongshi_fenfeng', name: '宗室分封', illustration: 'court',
    description: '宗室子弟渐长，当分封各镇。或委以方面，或留京宿卫。',
    options: [
      { text: '分封要郡（忠诚+10，兵力分散）', effect: { loyaltyBonus: 10, armyLoss: 1000 } },
      { text: '留京优养（耗金600）', effect: { money: -600, morale: 3 } }
    ]
  },
  {
    id: 'v120_dachen_qingming', name: '大臣清明', illustration: 'court',
    description: '某臣为官清廉，一郡大治，吏畏民怀。宜加褒奖以励群臣。',
    options: [
      { text: '下诏褒奖（民心+8，政治+5）', effect: { morale: 8, politics: 5 } },
      { text: '降诏考察', effect: {} }
    ]
  },
  {
    id: 'v120_youjiang_toucheng', name: '敌将来投', illustration: 'harvest',
    description: '敌国一员边将因受猜忌，率部曲千余来降。来投者可用，亦防有诈。',
    options: [
      { text: '接纳重用（募一将，忠诚+15）', effect: { recruitRandom: true, loyaltyBonus: 15 } },
      { text: '安置边郡（兵力+1500）', effect: { armyGain: 1500 } }
    ]
  },
  // 经济类
  {
    id: 'v120_yanchi_dafa', name: '盐池大发', illustration: 'bazaar',
    description: '河东盐池卤水丰足，采盐获利颇丰。岁入大增，国用饶足。',
    options: [
      { text: '扩大采盐（金钱+1200，商业+5）', effect: { money: 1200, comm: 5 } },
      { text: '官营专卖（金钱+800）', effect: { money: 800 } }
    ]
  },
  {
    id: 'v120_tiekuang_kaishan', name: '铁矿开山', illustration: 'harvest',
    description: '山中发现富铁矿脉，募工开采可充军器。百炼精钢，足以益军。',
    options: [
      { text: '设炉鼓铸（军械+10，金钱-300）', effect: { money: -300, armyExp: 10 } },
      { text: '留作后备', effect: {} }
    ]
  },
  {
    id: 'v120_canzhi_fangcan', name: '蚕桑丰收', illustration: 'harvest',
    description: '江南蚕茧大熟，缫丝织绢，府库充实。商贾云集，丝价大贱。',
    options: [
      { text: '收绢充府库（金钱+1000，商业+8）', effect: { money: 1000, comm: 8 } },
      { text: '听民贸易（民心+5）', effect: { morale: 5 } }
    ]
  },
  {
    id: 'v120_caoyun_yunhe', name: '漕运畅通', illustration: 'maritime',
    description: '漕船自江入淮，自淮入河，转运粮食源源不断。京师仓廪充实。',
    options: [
      { text: '疏浚漕渠（粮食+2000，金钱-400）', effect: { food: 2000, money: -400 } },
      { text: '维持现状（粮食+1000）', effect: { food: 1000 } }
    ]
  },
  // 文化类
  {
    id: 'v120_taixue_zoushu', name: '太学奏疏', illustration: 'court',
    description: '太学诸生上疏论时政，引经据典，言辞恳切。或纳或拒，关乎文治。',
    options: [
      { text: '采纳其言（文化+10，民心+5）', effect: { culture: 10, morale: 5 } },
      { text: '留中不报（文化+3）', effect: { culture: 3 } }
    ]
  },
  {
    id: 'v120_fojing_kanxing', name: '佛经刊行', illustration: 'buddhist_temple',
    description: '高僧于寺中刊刻佛经，流布四方。信徒云集，香火鼎盛。',
    options: [
      { text: '资助刊刻（耗金500，文化+8）', effect: { money: -500, culture: 8 } },
      { text: '听其自化（文化+3）', effect: { culture: 3 } }
    ]
  },
  {
    id: 'v120_shufa_lijia', name: '书法大家', illustration: 'bazaar',
    description: '有书法家来献墨宝，其书遒逸绝伦，可藏秘阁。或为友于金石之交。',
    options: [
      { text: '厚礼延聘（耗金300，文化+6）', effect: { money: -300, culture: 6 } },
      { text: '留墨而去（文化+3）', effect: { culture: 3 } }
    ]
  },
  {
    id: 'v120_shijie_qingtan', name: '士结清谈', illustration: 'harvest',
    description: '名士们聚集山林清谈玄理，三教九流无所不包。风流传于江左。',
    options: [
      { text: '与名士游（文化+8，政治-3）', effect: { culture: 8, politics: -3 } },
      { text: '励精图治（政治+5）', effect: { politics: 5 } }
    ]
  },
  // 特殊类
  {
    id: 'v120_tianzhu_seng', name: '天竺高僧', illustration: 'buddhist_sermon',
    description: '有天竺高僧泛海而来，善瑜伽咒术，欲为主公讲经说法。',
    options: [
      { text: '供养于寺（耗金600，文化+10，民心+5）', effect: { money: -600, culture: 10, morale: 5 } },
      { text: '礼送出境（金钱+200）', effect: { money: 200 } }
    ]
  },
  {
    id: 'v120_mingma_chuchu', name: '名马出牧', illustration: 'cavalry_charge',
    description: '牧马监得一良驹，龙颅雀臆，汗当血出，或为大宛天马之种。',
    options: [
      { text: '收入内厩（骑兵经验+8）', effect: { cavalryExp: 8 } },
      { text: '赐给猛将（募一将忠诚+10）', effect: { recruitRandom: true, loyaltyBonus: 10 } }
    ]
  },
  {
    id: 'v120_baojian_chutu2', name: '古剑出土', illustration: 'harvest',
    description: '农人耕于野，得古剑一，土花斑驳，刃口犹利，铭篆古不可识。',
    options: [
      { text: '献于府库（兵器经验+10）', effect: { armyExp: 10 } },
      { text: '赐给勇士（武力+5）', effect: { forceBonus: 5 } }
    ]
  },
  {
    id: 'v120_yiqing_zhanbu', name: '易占显兆', illustration: 'harvest',
    description: '有隐士善易占，为主公卜一卦。卦象大吉，利出征。',
    options: [
      { text: '依卦出征（全军攻击+10%三回合）', effect: { allUnitMult: 0.10, buffTurns: 3 } },
      { text: '敬而远之', effect: {} }
    ]
  },

  // ============================================================
  // V12.5 新增 20 个随机事件（v125_ 前缀）
  // 分类：军事6 / 政治4 / 经济3 / 文化3 / 特殊4
  // 历史参考：南北朝军制（府兵/部曲/私兵）、门阀政治、
  //   均田制租调制、清谈玄学、佛道二教兴盛。
  // ============================================================

  // ---- 军事（6） ----
  {
    id: 'v125_ye_xiying', name: '夜袭敌营', illustration: 'barbarian_invasion',
    description: '斥候来报，敌营寨栅不修、巡哨懈怠。可遣轻骑衔枚夜袭，破其辎重。',
    options: [
      { text: '遣轻骑夜袭（大胜，缴获金800粮1500，损兵500）', effect: { money: 800, food: 1500, armyLoss: 500, morale: 8 } },
      { text: '稳妥不袭', effect: {} }
    ]
  },
  {
    id: 'v125_duan_lun_yong', name: '断敌粮道', illustration: 'rebellion',
    description: '敌军远来，粮道悬于千里。若遣奇兵断其甬道，可不战而溃。',
    options: [
      { text: '派奇兵断粮（敌势大衰，我方军粮+1200）', effect: { food: 1200, morale: 6, armyLoss: 800 } },
      { text: '正面相持', effect: { food: -500 } }
    ]
  },
  {
    id: 'v125_huo_gong_ying', name: '火攻敌营', illustration: 'plague',
    description: '夜风顺吹敌营，草枯木燥，若纵火焚之，可破数万之众。然风势难测。',
    options: [
      { text: '纵火焚营（大破敌军，金+600，但损兵1000）', effect: { money: 600, armyLoss: 1000, morale: 10 } },
      { text: '风大难行，作罢', effect: {} }
    ]
  },
  {
    id: 'v125_fu_bing_siqi', name: '伏兵四起', illustration: 'cavalry_charge',
    description: '山谷间地形险要，可设伏兵。待敌军入瓮，鼓噪四起，必获全胜。',
    options: [
      { text: '设伏歼敌（斩获颇丰，金+700兵+2000）', effect: { money: 700, army: 2000, morale: 9 } },
      { text: '不设伏', effect: {} }
    ]
  },
  {
    id: 'v125_qi_bing_yu_hui', name: '骑兵迂回', illustration: 'cavalry_charge',
    description: '敌阵正面坚整，然侧翼空虚。精骑迂回敌后，可乱其阵脚。',
    options: [
      { text: '精骑迂回（破敌侧翼，弓兵+10%两回合）', effect: { archerMult: 0.10, buffTurns: 2, morale: 7 } },
      { text: '正面攻坚', effect: { armyLoss: 600 } }
    ]
  },
  {
    id: 'v125_huan_xiang_ji', name: '诈降诱敌', illustration: 'court',
    description: '有将校愿诈降敌军为内应。事成则破敌，事泄则将校性命难保。',
    options: [
      { text: '行诈降计（成则大破敌军，败则损一将）', effect: { recruitRandom: false, morale: 12, armyLoss: 1500 } },
      { text: '不用诈降', effect: {} }
    ]
  },

  // ---- 政治（4） ----
  {
    id: 'v125_ehuan_ganzheng', name: '宦官干政', illustration: 'plague',
    description: '有宦官侍帝侧，渐预政事，四方贿赂辐凑其门。朝臣侧目。',
    options: [
      { text: '抑禁宦官（忠-5，民心+8）', effect: { loyalty: -5, morale: 8 } },
      { text: '听之任之（忠+5，民心-10）', effect: { loyalty: 5, morale: -10 } }
    ]
  },
  {
    id: 'v125_waiqi_zhuanquan', name: '外戚专权', illustration: 'court',
    description: '皇后父兄恃恩骄横，卖官鬻爵，朝廷侧目。宗室与功臣皆愤。',
    options: [
      { text: '裁抑外戚（忠-8，民心+12）', effect: { loyalty: -8, morale: 12 } },
      { text: '姑息纵容（忠+8，民心-15）', effect: { loyalty: 8, morale: -15 } }
    ]
  },
  {
    id: 'v125_jia_jiuxi', name: '加九锡', illustration: 'accession',
    description: '臣下劝进，谓主公勋格天地，宜加九锡、殊礼。此乃禅代之渐。',
    options: [
      { text: '受九锡（正统+15，民心-5）', effect: { legitimacy: 15, morale: -5 } },
      { text: '辞而不受（正统-5，民心+8）', effect: { legitimacy: -5, morale: 8 } }
    ]
  },
  {
    id: 'v125_qiandu_zhiyi', name: '迁都之议', illustration: 'court',
    description: '有臣下建议迁都中原以经略四方。然旧都宗庙陵寝在此，动则人心不安。',
    options: [
      { text: '决意迁都（耗金2000粮3000，正统+10）', effect: { money: -2000, food: -3000, legitimacy: 10, morale: -8 } },
      { text: '暂不迁都', effect: {} }
    ]
  },

  // ---- 经济（3） ----
  {
    id: 'v125_juntian_zhi', name: '推行均田', illustration: 'harvest',
    description: '计口授田，劝农桑。如此则耕者有其田，赋税有常，国库渐充。',
    options: [
      { text: '行均田制（民心+15，金+1000，三回合）', effect: { morale: 15, money: 1000, buffTurns: 3 } },
      { text: '不夺人田', effect: { morale: -5 } }
    ]
  },
  {
    id: 'v125_zutiao_zhishui', name: '租调整顿', illustration: 'bazaar',
    description: '按户征租，按床出调。整理户籍，严查隐冒，税基大增。',
    options: [
      { text: '整顿户籍（金+1500，民心-8）', effect: { money: 1500, morale: -8 } },
      { text: '从轻简赋', effect: { money: -500, morale: 10 } }
    ]
  },
  {
    id: 'v125_zhu_wuzhu', name: '铸造五铢', illustration: 'bazaar',
    description: '民间私铸成风，币制混乱。可官铸五铢，统一钱法，通商惠民。',
    options: [
      { text: '官铸五铢（金+800，商业+10%三回合）', effect: { money: 800, buffTurns: 3 } },
      { text: '听民自铸', effect: { money: -300, morale: -5 } }
    ]
  },

  // ---- 文化（3） ----
  {
    id: 'v125_shizu_lianyin', name: '士族联姻', illustration: 'bazaar',
    description: '山东大姓、江东望族前来求婚。与士族联姻，可收人心、固国本。',
    options: [
      { text: '联姻士族（忠诚+10，金-500）', effect: { loyalty: 10, money: -500 } },
      { text: '不与世家婚', effect: { loyalty: -5 } }
    ]
  },
  {
    id: 'v125_zaofo_zaoxiang', name: '开凿佛像', illustration: 'buddhist_temple',
    description: '有高僧建议于山崖开凿大石佛，以镇江山。工费浩繁，然功德无量。',
    options: [
      { text: '凿大佛（耗金1500粮1000，文化+15）', effect: { money: -1500, food: -1000, culture: 15 } },
      { text: '不凿大佛', effect: { culture: -5 } }
    ]
  },
  {
    id: 'v125_qingtanyanjiu', name: '清谈玄理', illustration: 'taixue_lecture',
    description: '名士齐聚，谈玄论道，老庄周易，辩难终日。江东文风为之一振。',
    options: [
      { text: '参与清谈（文化+10，民心+3）', effect: { culture: 10, morale: 3 } },
      { text: '重实务轻玄谈', effect: { culture: -5, money: 500 } }
    ]
  },

  // ---- 特殊（4） ----
  {
    id: 'v125_baique_ruixiang', name: '白雀祥瑞', illustration: 'harvest',
    description: '有白雀见于太庙，群臣称庆，以为王者嘉瑞。此乃天命所归之兆。',
    options: [
      { text: '宣示祥瑞（正统+10，民心+5）', effect: { legitimacy: 10, morale: 5 } },
      { text: '不以为意', effect: {} }
    ]
  },
  {
    id: 'v125_mingjiang_houyi', name: '名将后裔', illustration: 'harvest',
    description: '有古名将之后流落民间，闻主公招贤，前来投奔。虽不及其祖，亦有将才。',
    options: [
      { text: '辟为军将（招募一将）', effect: { recruitRandom: true, morale: 3 } },
      { text: '赐金遣归', effect: { money: -200 } }
    ]
  },
  {
    id: 'v125_yichen_shangbiao', name: '遗臣上表', illustration: 'court',
    description: '有前朝遗老密表，陈述本朝得失，言辞恳切，多有可采。',
    options: [
      { text: '采纳忠言（忠诚+8，民心+5）', effect: { loyalty: 8, morale: 5 } },
      { text: '留中不发', effect: { loyalty: -3 } }
    ]
  },
  {
    id: 'v125_manzu_huanzi', name: '蛮族质子', illustration: 'barbarian_invasion',
    description: '边境蛮族遣使送子入侍，愿永结盟好。纳质则边境安，不纳则恐生变。',
    options: [
      { text: '受质子（蛮族关系+20，金-300）', effect: { barbarianRel: 20, money: -300 } },
      { text: '却还质子（蛮族关系-10）', effect: { barbarianRel: -10 } }
    ]
  },

  // ============================================================
  // V13.0 新增随机事件（15个，v13_ 前缀）
  // 分类：军事(3) / 政治(3) / 经济(3) / 文化(3) / 特殊(3)
  // effect 键均复用 events.js applyEvent 已支持的键。
  // ============================================================

  // ---- 军事（3） ----
  {
    id: 'v13_shibing_jinglian', name: '大阅三军', illustration: 'cavalry_charge',
    description: '秋冬之交，上将请大阅。校场士卒擐甲操兵，旌旗蔽野，欲以耀武观衅。',
    options: [
      { text: '亲临大阅，精练卒伍（金-500，军心+10）', effect: { money: -500, armyMorale: 10 } },
      { text: '但令有司讲武（军心+3）', effect: { armyMorale: 3 } }
    ]
  },
  {
    id: 'v13_liangdao_bei_chao', name: '粮道被抄', illustration: 'fire_attack_event',
    description: '边将急报：敌轻骑抄绝我粮道，烧刍聚而去。前线大军乏食，人心惶惶。',
    options: [
      { text: '发兵护粮道（损兵1500，粮-800）', effect: { armyLoss: 1500, food: -800 } },
      { text: '坚壁清野，就食于敌（民心-5，粮+500）', effect: { morale: -5, food: 500 } }
    ]
  },
  {
    id: 'v13_di_bi_cheng_xia', name: '敌逼城下', illustration: 'city_siege',
    description: '敌军奄至，围我外城。城中士女汹汹，或议出降，或议死守。',
    options: [
      { text: '全城誓死固守（守城buff两回合，军心+8）', effect: { garrisonBuff: true, armyMorale: 8 } },
      { text: '开门列阵野战（自动大战）', effect: { massBattle: true } }
    ]
  },

  // ---- 政治（3） ----
  {
    id: 'v13_tanhe_quanchen', name: '御史弹劾', illustration: 'court',
    description: '宪台上章，劾某重臣黩货营私、浊乱朝政。章下中书，皆莫敢言。',
    options: [
      { text: '穷治其罪（全军忠诚-5，抄家得金+800）', effect: { generalLoyalty: { amt: -5 }, money: 800 } },
      { text: '留中不问（全军忠诚+3）', effect: { generalLoyalty: { amt: 3 } } }
    ]
  },
  {
    id: 'v13_chaju_xianliang', name: '察举贤良', illustration: 'taixue_lecture',
    description: '州郡察举孝廉、秀才送台。皆草泽幽隐，或有王佐之才，宜亲加策试。',
    options: [
      { text: '亲临殿试，擢用真才（招募一将，文化+5）', effect: { recruitRandom: true, culture: 5 } },
      { text: '但受其贡，付铨曹（金钱+500）', effect: { money: 500 } }
    ]
  },
  {
    id: 'v13_juanfu_kuang_min', name: '蠲赋宽民', illustration: 'bazaar',
    description: '诸郡水旱相仍，户口流散。刺史表请蠲今年租调，以恤凋残。',
    options: [
      { text: '下诏蠲免（全势力民心+10，金-600）', effect: { factionMorale: 10, money: -600 } },
      { text: '不许，依常征发（全势力民心-5，金+400）', effect: { factionMorale: -5, money: 400 } }
    ]
  },

  // ---- 经济（3） ----
  {
    id: 'v13_quannong_sang', name: '亲耕籍田', illustration: 'harvest',
    description: '立春之节，有司奏请行籍田礼。劝农桑，宽徭役，所以崇本重谷也。',
    options: [
      { text: '亲耕东郊，躬劝农桑（粮+1200，农业+5）', effect: { food: 1200, agri: 5 } },
      { text: '遣使分行州县（粮+600）', effect: { food: 600 } }
    ]
  },
  {
    id: 'v13_guanshi_tong_shang', name: '关市互市', illustration: 'nomad_market',
    description: '北朝边将以马千匹求互市。遣官交市，可致戎马之足；然亦恐泄虚实。',
    options: [
      { text: '开互市通商（金+1500，商业+5）', effect: { money: 1500, comm: 5 } },
      { text: '闭关绝市，戒严边防（民心+3，金-300）', effect: { morale: 3, money: -300 } }
    ]
  },
  {
    id: 'v13_caoqu_jiyun', name: '漕渠济运', illustration: 'maritime_trade',
    description: '司农奏：关中、江东漕渠年久淤塞，岁漕不给。若发卒浚治，可省转运之费。',
    options: [
      { text: '发卒浚漕（金-800，粮+1500）', effect: { money: -800, food: 1500 } },
      { text: '因循旧弊，不烦民力（无变化）', effect: {} }
    ]
  },

  // ---- 文化（3） ----
  {
    id: 'v13_xieshu_chuanlu', name: '求遗书校经', illustration: 'taixue_lecture',
    description: '丧乱以来，经籍遗落。有司请遣人诣阙下写定经史，藏之秘阁，以广文教。',
    options: [
      { text: '开馆校书（文化+12，金-400）', effect: { culture: 12, money: -400 } },
      { text: '军旅方殷，未遑斯文（文化-3）', effect: { culture: -3 } }
    ]
  },
  {
    id: 'v13_yilin_jiangjing', name: '义林讲经', illustration: 'buddhist_sermon',
    description: '名儒大师聚徒于国学，讲《礼》《传》，听者千数。诸生请王亲临释奠。',
    options: [
      { text: '亲临讲论，奖励学徒（文化+8，民心+3）', effect: { culture: 8, morale: 3 } },
      { text: '遣官侍听（文化+3）', effect: { culture: 3 } }
    ]
  },
  {
    id: 'v13_wenxuan_qushi', name: '文选举士', illustration: 'taixue_lecture',
    description: '门下省奏：今文墨之士沉滞下僚，宜开文选，试以策论诗赋，拔其尤者。',
    options: [
      { text: '亲策贡士，选任英俊（招募一将，文化+8）', effect: { recruitRandom: true, culture: 8 } },
      { text: '依旧停年格选（文化+3）', effect: { culture: 3 } }
    ]
  },

  // ---- 特殊（3） ----
  {
    id: 'v13_yishi_lai_gui', name: '义士来归', illustration: 'harvest',
    description: '有客杖剑登门，自言智略过人，愿效命于麾下。察其言貌，非常人也。',
    options: [
      { text: '辟为腹心，随才任使（招募一将，全军忠诚+5）', effect: { recruitRandom: true, generalLoyalty: { amt: 5 } } },
      { text: '赐金帛遣归（金-200，民心+2）', effect: { money: -200, morale: 2 } }
    ]
  },
  {
    id: 'v13_fengrui_zhuzhi', name: '凤皇来仪', illustration: 'harvest',
    description: '太常奏：凤皇见于南郊，群鸟从之，蔽野而来。此王者之嘉瑞也，宜改元告庙。',
    options: [
      { text: '受朝贺，改元大赦（全势力民心+8，金-500）', effect: { factionMorale: 8, money: -500 } },
      { text: '不事虚文，但付史馆（文化+3）', effect: { culture: 3 } }
    ]
  },
  {
    id: 'v13_yiren_yijia', name: '异人献术', illustration: 'buddhist_sermon',
    description: '有异人自云能辟谷却老，又善占候。公卿竞往问之，或云可用，或云当远。',
    options: [
      { text: '留之左右，访以占候（科技+8）', effect: { tech: 8 } },
      { text: '斥为妖妄，驱逐出境（民心+3）', effect: { morale: 3 } }
    ]
  },

  // ============================================================
  // V14.0 新增随机事件（25个，v14_ 前缀）
  // 分类：军事(6) / 政治(5) / 经济(5) / 文化(5) / 特殊(4)
  // effect 键均复用 events.js applyEvent 已支持的键。
  // ============================================================

  // ---- 军事（6） ----
  {
    id: 'v14_qingye_zhaying', name: '轻夜扎营', illustration: 'cavalry_charge',
    description: '斥候来报：敌营疏于防备，篝火零落，哨骑不警。诸将请夜袭，或曰可乘，或曰恐有伏。',
    options: [
      { text: '选精骑三千夜袭（损兵800，金+1000）', effect: { armyLoss: 800, money: 1000 } },
      { text: '持重不动，固守营垒（军心+3）', effect: { armyMorale: 3 } }
    ]
  },
  {
    id: 'v14_qibing_huanfang', name: '骑兵换防', illustration: 'cavalry_charge',
    description: '北边戍卒久役思归，冬衣不备。若换防，可苏士卒；若不换，恐生怨望。',
    options: [
      { text: '按期换防，赐冬衣（金-600，忠诚+5）', effect: { money: -600, generalLoyalty: { amt: 5 } } },
      { text: '暂留戍边，待春再换（忠诚-5，金+400）', effect: { generalLoyalty: { amt: -5 }, money: 400 } }
    ]
  },
  {
    id: 'v14_chengguo_jiangzuo', name: '城郭将作', illustration: 'city_siege',
    description: '将作大匠奏：边城岁久颓圮，敌至难守。请发卒筑之，可保十年无事。',
    options: [
      { text: '发卒修城（金-800，守城buff两回合）', effect: { money: -800, garrisonBuff: true } },
      { text: '因循旧弊，不烦民力（民心-5）', effect: { morale: -5 } }
    ]
  },
  {
    id: 'v14_bingbu_dajia', name: '兵部大阅', illustration: 'cavalry_charge',
    description: '岁终，兵部请大阅诸军。骑步水步，旗鼓相望，欲以观武德而训戎旅。',
    options: [
      { text: '亲临阅武，赏赉三军（金-500，军心+8）', effect: { money: -500, armyMorale: 8 } },
      { text: '但令有司阅视（军心+2）', effect: { armyMorale: 2 } }
    ]
  },
  {
    id: 'v14_jianting_yongbing', name: '坚庭练兵', illustration: 'cavalry_charge',
    description: '诸军久不战，士卒惰。有将请于城郊立屯田府，且耕且战，以实边储。',
    options: [
      { text: '从其议，立屯田府（粮+1000，军心+5）', effect: { food: 1000, armyMorale: 5 } },
      { text: '不许，但令讲武（无变化）', effect: {} }
    ]
  },
  {
    id: 'v14_dijun_biancheng', name: '敌犯边城', illustration: 'barbarian_invasion',
    description: '边将急奏：敌骑数千抄略塞外，杀掠吏民。或议发兵追讨，或议闭关自守。',
    options: [
      { text: '发兵追讨（损兵1200，金+800）', effect: { armyLoss: 1200, money: 800 } },
      { text: '闭关自守，俟其自退（民心-5）', effect: { morale: -5 } }
    ]
  },

  // ---- 政治（5） ----
  {
    id: 'v14_menxia_zhengquan', name: '门下争权', illustration: 'court',
    description: '门下省侍中与中书监不协，各树朋党，奏议多异同。事下尚书，皆莫敢决。',
    options: [
      { text: '两罢之，另选中立者（忠诚-5，金-300）', effect: { generalLoyalty: { amt: -5 }, money: -300 } },
      { text: '择一而用，逐其余（忠诚+3，民心-5）', effect: { generalLoyalty: { amt: 3 }, morale: -5 } }
    ]
  },
  {
    id: 'v14_shangshu_zoushi', name: '尚书奏事', illustration: 'court',
    description: '尚书省奏：诸州户口岁增，而簿书不治，请遣检籍使分行四方，以正版籍。',
    options: [
      { text: '遣使出巡，严正版籍（金+800，民心-5）', effect: { money: 800, morale: -5 } },
      { text: '不许，恐扰民（民心+3）', effect: { morale: 3 } }
    ]
  },
  {
    id: 'v14_yushi_fengshi', name: '御史封事', illustration: 'court',
    description: '御史台上封事，言某方镇擅兴兵甲、私筑城垒，渐有不臣之迹。请早为之所。',
    options: [
      { text: '遣使按验，若实则征还（忠诚+5，金-500）', effect: { generalLoyalty: { amt: 5 }, money: -500 } },
      { text: '优诏慰勉，不问（忠诚-3）', effect: { generalLoyalty: { amt: -3 } } }
    ]
  },
  {
    id: 'v14_zongshi_fengguo', name: '宗室奉国', illustration: 'court',
    description: '宗正卿奏：宗室疏属贫不能自存，请量赐田宅，以广亲亲之恩。',
    options: [
      { text: '从其请，赐田宅（金-700，忠诚+5）', effect: { money: -700, generalLoyalty: { amt: 5 } } },
      { text: '不许，依常给（忠诚-3）', effect: { generalLoyalty: { amt: -3 } } }
    ]
  },
  {
    id: 'v14_guichen_yintu', name: '贵臣隐退', illustration: 'court',
    description: '有重臣以老病乞骸骨。朝野惜之，或言当留，或言当遂其志。',
    options: [
      { text: '不听，遣太医视疾（忠诚+8，金-400）', effect: { generalLoyalty: { amt: 8 }, money: -400 } },
      { text: '许之，赐钱百万（招募一将）', effect: { money: 1000, recruitRandom: true } }
    ]
  },

  // ---- 经济（5） ----
  {
    id: 'v14_quannong_shijin', name: '劝农使巡', illustration: 'harvest',
    description: '司农奏：诸州或水旱不常，耕桑失时。请遣劝农使分行州县，敦本重谷。',
    options: [
      { text: '遣劝农使二十二人（粮+1200，农业+5）', effect: { food: 1200, agri: 5 } },
      { text: '但下诏书而已（粮+400）', effect: { food: 400 } }
    ]
  },
  {
    id: 'v14_yantie_gongying', name: '盐铁宫营', illustration: 'bazaar',
    description: '少府奏：盐铁之利，岁入巨万。若悉归宫营，可裨国用；然与民争利，或招怨言。',
    options: [
      { text: '悉归宫营，置盐铁官（金+1500，民心-5）', effect: { money: 1500, morale: -5 } },
      { text: '仍旧，与民共之（民心+3，金+300）', effect: { morale: 3, money: 300 } }
    ]
  },
  {
    id: 'v14_hedu_zhuli', name: '河道潴利', illustration: 'maritime_trade',
    description: '都水使者奏：扬州漕渠淤浅，船运不通。若发卒浚治，可省转运之费，岁活百万石。',
    options: [
      { text: '发卒浚漕（金-900，粮+1500）', effect: { money: -900, food: 1500 } },
      { text: '因循旧弊，不烦民力（无变化）', effect: {} }
    ]
  },
  {
    id: 'v14_sichou_gongshi', name: '丝绸公使', illustration: 'bazaar',
    description: '有西域商客至，愿以善马、香药易我丝绸。边关守将以闻，或言可通商，或言泄虚实。',
    options: [
      { text: '开边市通商（金+1800，商业+5）', effect: { money: 1800, comm: 5 } },
      { text: '闭关绝市（民心+3，金-200）', effect: { morale: 3, money: -200 } }
    ]
  },
  {
    id: 'v14_yangma_fanxi', name: '牧马蕃息', illustration: 'cavalry_charge',
    description: '陇右牧奏：今年马蕃息，驹至三万匹。请择其良者入尚乘，余者分给诸军。',
    options: [
      { text: '分给诸军，壮骑兵（军心+8，金+500）', effect: { armyMorale: 8, money: 500 } },
      { text: '尽入内厩，以供御驾（金+1000，民心-3）', effect: { money: 1000, morale: -3 } }
    ]
  },

  // ---- 文化（5） ----
  {
    id: 'v14_wenxue_qingtan', name: '文学清谈', illustration: 'taixue_lecture',
    description: '建康名士于新亭清谈，论名理，议古今。士大夫争往听之，洛下遗风犹在。',
    options: [
      { text: '遣使赴会，录其名言（文化+8）', effect: { culture: 8 } },
      { text: '以其虚诞，不禁不奖（文化+2）', effect: { culture: 2 } }
    ]
  },
  {
    id: 'v14_fojiao_kaisui', name: '佛教开岁', illustration: 'buddhist_sermon',
    description: '岁首，诸寺设斋，行像巡城。万民纵观，或有施舍。有司以闻，欲加禁约。',
    options: [
      { text: '听民瞻仰，不加禁约（文化+6，金-200）', effect: { culture: 6, money: -200 } },
      { text: '禁之，虑其惑民（民心-5，文化+2）', effect: { morale: -5, culture: 2 } }
    ]
  },
  {
    id: 'v14_daozang_chuanjing', name: '道藏传经', illustration: 'daoist_temple',
    description: '茅山道士献所撰道经百二十卷，言可修养性命。公卿或信或谤，宜加裁择。',
    options: [
      { text: '命有司缮写，藏于秘阁（科技+6，文化+4）', effect: { tech: 6, culture: 4 } },
      { text: '还其经，不听（无变化）', effect: {} }
    ]
  },
  {
    id: 'v14_shufa_dadian', name: '书法大典', illustration: 'bazaar',
    description: '有献二王真迹者，笔势翩然，纸墨如新。或言当藏之内府，或言当赐近臣。',
    options: [
      { text: '藏之内府，命侍臣临仿（文化+8）', effect: { culture: 8 } },
      { text: '赐有功之臣（金+800，文化+2）', effect: { money: 800, culture: 2 } }
    ]
  },
  {
    id: 'v14_yinyue_guchui', name: '音乐鼓吹', illustration: 'musician',
    description: '太乐奏：旧曲多亡，江左工师犹有存者。请定律吕，修复雅乐，以备庙朝。',
    options: [
      { text: '从其请，修雅乐（文化+8，金-500）', effect: { culture: 8, money: -500 } },
      { text: '且仍旧，俟丰年再议（文化+2）', effect: { culture: 2 } }
    ]
  },

  // ---- 特殊（4） ----
  {
    id: 'v14_chenxing_jishi', name: '辰星计时', illustration: 'harvest',
    description: '有太史言：辰星见东方，主农人急作。宜趣耕桑，以应天时。',
    options: [
      { text: '下书州县，趣耕桑（粮+1000，农业+5）', effect: { food: 1000, agri: 5 } },
      { text: '但记之而已（粮+300）', effect: { food: 300 } }
    ]
  },
  {
    id: 'v14_longma_chutu', name: '龙马出图', illustration: 'harvest',
    description: '汾阴有司奏：后土祠旁，龙马出河，背负图箓。此非常之瑞，当以告宗庙。',
    options: [
      { text: '大赦天下，改元应瑞（民心+15，金-500）', effect: { factionMorale: 15, money: -500 } },
      { text: '不受，付史馆而已（民心+3）', effect: { morale: 3 } }
    ]
  },
  {
    id: 'v14_fengming_qishan', name: '凤鸣岐山', illustration: 'buddhist_sermon',
    description: '岐山民言有凤集于祠下，三日乃去。地方以闻，或以为周室将兴之兆。',
    options: [
      { text: '遣使祭凤，大赦天下（民心+12，忠诚+5）', effect: { factionMorale: 12, generalLoyalty: { amt: 5 } } },
      { text: '以其虚诞，不问（民心-3）', effect: { morale: -3 } }
    ]
  },
  {
    id: 'v14_yiren_xiabao', name: '异人献宝', illustration: 'ancient_ruins',
    description: '有野人于山中得古鼎，丹文镂篆，云是三代之物。或言当献于庙，或言可铸为器。',
    options: [
      { text: '献于宗庙，藏于太府（文化+8，金+500）', effect: { culture: 8, money: 500 } },
      { text: '铸为鼎彝，以赐功臣（金+1200，文化+2）', effect: { money: 1200, culture: 2 } }
    ]
  },

  // ============================================================
  // V15.0 新增随机事件（20个，v15_ 前缀）
  // 分类：军事(5) / 政治(4) / 经济(4) / 文化(4) / 特殊(3)
  // effect 键均复用 events.js applyEvent 已支持的键。
  // ============================================================

  // ---- 军事（5） ----
  {
    id: 'v15_yingyang_jiaozhan', name: '营阳交战', illustration: 'cavalry_charge',
    description: '前锋与敌游骑遇于营阳川谷，尘大起。将校请速战，或曰当固垒以俟大军。',
    options: [
      { text: '纵兵奋击，逐北数十里（损兵1000，金+900）', effect: { armyLoss: 1000, money: 900 } },
      { text: '敛军固垒，勿与争锋（军心+3）', effect: { armyMorale: 3 } }
    ]
  },
  {
    id: 'v15_qibing_jieji', name: '轻骑截击', illustration: 'cavalry_charge',
    description: '谍报：敌粮运自东道来，护兵寡弱。诸将请选轻骑三千间道邀击，焚其积聚。',
    options: [
      { text: '轻骑夜袭，烧其刍粟（损兵700，粮+1200）', effect: { armyLoss: 700, food: 1200 } },
      { text: '恐有伏，按兵不动（无变化）', effect: {} }
    ]
  },
  {
    id: 'v15_shuijun_chuhai', name: '楼船出海', illustration: 'maritime_trade',
    description: '沿江将奏：海人言东夷可通，愿率楼船浮海，市易奇物，且可窥敌虚实。',
    options: [
      { text: '从其请，遣楼船浮海（金+1500，损兵600）', effect: { money: 1500, armyLoss: 600 } },
      { text: '海道险远，不许（民心+2）', effect: { morale: 2 } }
    ]
  },
  {
    id: 'v15_junzhong_jingbian', name: '军中惊变', illustration: 'mutiny',
    description: '营中夜惊，讹言敌至，士卒扰乱，自相杀伤。主将亟出抚循，久乃定。',
    options: [
      { text:'斩为首乱者以徇（军心+6，忠诚-4）', effect: { armyMorale: 6, generalLoyalty: { amt: -4 } } },
      { text: '慰谕之，置不问（军心-4，忠诚+4）', effect: { armyMorale: -4, generalLoyalty: { amt: 4 } } }
    ]
  },
  {
    id: 'v15_chengxia_yuandian', name: '城下援师', illustration: 'city_siege',
    description: '敌围城数重，城中食尽。谍言援师已在近境，当固守待之，或开门决一死战。',
    options: [
      { text: '婴城固守，以待外援（守城buff两回合，军心+8）', effect: { garrisonBuff: true, armyMorale: 8 } },
      { text: '开门突击，内外夹击（自动大战，损兵1500）', effect: { massBattle: true, armyLoss: 1500 } }
    ]
  },

  // ---- 政治（4） ----
  {
    id: 'v15_zaixiang_xiechu', name: '宰臣谢除', illustration: 'court',
    description: '中书奏：今宰臣员阙，或曰宜用旧德宿望，或曰宜擢新进明习政事者。',
    options: [
      { text: '用旧德宿望（全军忠诚+6，金-400）', effect: { generalLoyalty: { amt: 6 }, money: -400 } },
      { text: '擢新进才望者（招募一将，文化+4）', effect: { recruitRandom: true, culture: 4 } }
    ]
  },
  {
    id: 'v15_jiangjun_jinjie', name: '将军进爵', illustration: 'court',
    description: '大司马以军功上功状，请进诸将爵邑。或言宜厚赏以劝功，或言宜惜名器。',
    options: [
      { text: '量功进爵，遍赏三军（金-700，忠诚+6）', effect: { money: -700, generalLoyalty: { amt: 6 } } },
      { text: '但赐金帛，不进爵（金+300，忠诚-3）', effect: { money: 300, generalLoyalty: { amt: -3 } } }
    ]
  },
  {
    id: 'v15_zongshi_xiangqin', name: '宗室相倾', illustration: 'court',
    description: '二王争讼，各引宾客，言于上前。宗正请平其曲直，恐久而成隙。',
    options: [
      { text: '命宗正平理，各加训敕（忠诚+4，金-200）', effect: { generalLoyalty: { amt: 4 }, money: -200 } },
      { text: '两打之，以厌众心（忠诚-5）', effect: { generalLoyalty: { amt: -5 } } }
    ]
  },
  {
    id: 'v15_keshen_jianshi', name: '客卿荐士', illustration: 'taixue_lecture',
    description: '有北土流寓之士，深明典制，自陈时务数十条。宰相以闻，欲试其能。',
    options: [
      { text: '召对称旨，授官任用（招募一将，文化+5）', effect: { recruitRandom: true, culture: 5 } },
      { text: '但赐帛，遣归馆（金+300）', effect: { money: 300 } }
    ]
  },

  // ---- 经济（4） ----
  {
    id: 'v15_tianjuan_kaitang', name: '田绢开塘', illustration: 'harvest',
    description: '丹杨、吴兴守奏：民田陂塘久废，旱则无溉。若发民开筑，可溉良田数千顷。',
    options: [
      { text: '发民开塘（金-700，粮+1400，农业+5）', effect: { money: -700, food: 1400, agri: 5 } },
      { text: '但下诏书劝农（粮+400）', effect: { food: 400 } }
    ]
  },
  {
    id: 'v15_guanshi_sijin', name: '关市丝锦', illustration: 'bazaar',
    description: '江北商人以贱缯易我锦绮，岁以为常。有司恐亏官课，请增其征。',
    options: [
      { text: '弛其征，以徕远商（金+1600，商业+5）', effect: { money: 1600, comm: 5 } },
      { text: '重征之，以实府库（金+900，民心-4）', effect: { money: 900, morale: -4 } }
    ]
  },
  {
    id: 'v15_canglin_xiangshi', name: '仓廪相实', illustration: 'harvest',
    description: '诸郡奏：岁比登稔，官仓露积，陈陈相因。或请出陈易新，或请增价和籴。',
    options: [
      { text: '出陈易新，以利细民（粮+1000，民心+6）', effect: { food: 1000, morale: 6 } },
      { text: '增价和籴，实京师（金-500，粮+2000）', effect: { money: -500, food: 2000 } }
    ]
  },
  {
    id: 'v15_zhutie_yezhu', name: '铜铁冶铸', illustration: 'ancient_ruins',
    description: '上虞、铁官奏：铜铅铅锡大发于山，可置冶鼓铸，以广钱布、以赡戎器。',
    options: [
      { text: '开置铜官，广铸钱布（金+1700，科技+4）', effect: { money: 1700, tech: 4 } },
      { text: '与民共之，不专其利（民心+3，金+400）', effect: { morale: 3, money: 400 } }
    ]
  },

  // ---- 文化（4） ----
  {
    id: 'v15_guozijian_jiangxue', name: '国学讲经', illustration: 'taixue_lecture',
    description: '国学博士率诸生讲《礼》《易》，都下缙绅往听如堵。有司请王亲临释奠。',
    options: [
      { text: '亲临释奠，劳赐诸生（文化+8，民心+3）', effect: { culture: 8, morale: 3 } },
      { text: '遣祭酒侍听（文化+3）', effect: { culture: 3 } }
    ]
  },
  {
    id: 'v15_foshi_kaiguang', name: '佛像开光', illustration: 'buddhist_sermon',
    description: '新铸丈六金像成，刹刹光明，道俗万礼。僧徒请设斋行道，以福邦国。',
    options: [
      { text: '设斋行道，听民瞻礼（文化+6，金-300）', effect: { culture: 6, money: -300 } },
      { text: '以其糜费，罢之（民心-3，文化+2）', effect: { morale: -3, culture: 2 } }
    ]
  },
  {
    id: 'v15_shijing_kance', name: '石经刊刻', illustration: 'taixue_lecture',
    description: '秘书监奏：丧乱以来，经籍舛驳，文字多讹。请选通儒校定，勒石太学，以一经典。',
    options: [
      { text: '从之，刊石经于太学（文化+10，金-500）', effect: { culture: 10, money: -500 } },
      { text: '且写定本而已（文化+4）', effect: { culture: 4 } }
    ]
  },
  {
    id: 'v15_mingtong_huijing', name: '名童慧经', illustration: 'taixue_lecture',
    description: '有童子十岁，诵五经如流，史臣表其异。或以为当养于秘书，或以为恐伤其性。',
    options: [
      { text: '养于秘书，亲加奖诲（招募一将，文化+5）', effect: { recruitRandom: true, culture: 5 } },
      { text: '听其归里就学（文化+2，民心+2）', effect: { culture: 2, morale: 2 } }
    ]
  },

  // ---- 特殊（3） ----
  {
    id: 'v15_longjian_jianghai', name: '龙见江海', illustration: 'maritime_trade',
    description: '京口奏：见黑龙见于江，拿空而上，良久乃没。父老以为非常之瑞，宜以闻。',
    options: [
      { text: '告庙受贺，大赦天下（民心+10，金-400）', effect: { factionMorale: 10, money: -400 } },
      { text: '付史馆，不形喜惧（民心+2）', effect: { morale: 2 } }
    ]
  },
  {
    id: 'v15_yilao_yishi', name: '义老遗世', illustration: 'daoist_temple',
    description: '山中一老父，须眉皓白，自言历见数朝，叩以兴亡之迹，历历可听。言讫不知所之。',
    options: [
      { text: '访其藏书，录其所言（科技+8，文化+4）', effect: { tech: 8, culture: 4 } },
      { text: '以为怪，不之异（无变化）', effect: {} }
    ]
  },
  {
    id: 'v15_yiyu_laike', name: '异域来使', illustration: 'nomad_market',
    description: '远夷重译来朝，献方物、善马、琉璃、香药。辞云愿世为藩臣，朝贡不绝。',
    options: [
      { text: '厚加馆待，赐而遣之（金+1000，蛮族关系+15）', effect: { money: 1000, barbarianRel: 15 } },
      { text: '不受其献，却还使者（蛮族关系-8）', effect: { barbarianRel: -8 } }
    ]
  },

  // ============================================================
  // V16.0 新增随机事件（20个，v16_ 前缀）
  // 分类：军事(5) / 政治(4) / 经济(4) / 文化(4) / 特殊(3)
  // effect 键均复用 events.js applyEvent 已支持的键。
  // ============================================================

  // ---- 军事（5） ----
  {
    id: 'v16_bianfeng_baojing', name: '边烽报警', illustration: 'barbarian_invasion',
    description: '北边堠骑驰至：突厥数千骑入塞，掠武威、陇西，驱羊马而去。边将请举兵追之，或曰当清野固守，俟其归而击之。',
    options: [
      { text: '出塞追蹑，邀其归路（自动大战，损兵1200，金+1200）', effect: { massBattle: true, armyLoss: 1200, money: 1200 } },
      { text: '清野固守，俟其自退（守城buff两回合，金-300）', effect: { garrisonBuff: true, money: -300 } }
    ]
  },
  {
    id: 'v16_qingqi_zhanyao', name: '轻骑截道', illustration: 'cavalry_charge',
    description: '谍者言：敌之粮道自蒲坂赴蒲津，所过无备。诸将请选精骑三千，间道绝其转输，以困其师。',
    options: [
      { text: '轻骑夜出，烧其积聚（损兵800，粮+1500）', effect: { armyLoss: 800, food: 1500 } },
      { text: '恐其有伏，不许（无变化）', effect: {} }
    ]
  },
  {
    id: 'v16_louchuan_xiajiang', name: '楼船下濑', illustration: 'river_battle',
    description: '蜀帅杨素造大舰于永安，名曰五牙，起楼五层，高百余尺，左右六柏竿，皆高五十尺，可容战士八百人。今东下之势已成，当乘流以临金陵。',
    options: [
      { text: '楼船顺流，直趣建康（自动大战，金+1800）', effect: { massBattle: true, money: 1800 } },
      { text: '先营巴蜀，徐图东下（金-600，守城buff两回合）', effect: { money: -600, garrisonBuff: true } }
    ]
  },
  {
    id: 'v16_junzhong_caoze', name: '军中草泽', illustration: 'mutiny',
    description: '久戍之卒，谋逃归乡里。夜聚草泽，约以举火为号。主将微闻之，左右请按兵无动，或请亟收首谋者。',
    options: [
      { text: '亟收首谋，斩以徇（军心+7，忠诚-5）', effect: { armyMorale: 7, generalLoyalty: { amt: -5 } } },
      { text: '劳遣之，分隶诸营（军心-3，忠诚+5）', effect: { armyMorale: -3, generalLoyalty: { amt: 5 } } }
    ]
  },
  {
    id: 'v16_chengxi_lei_gong', name: '城西累攻', illustration: 'city_siege',
    description: '敌悉众攻我城西，云梯地道，昼夜不息。城中矢石俱尽，将士皆有惧色。或议退保子城，或议开门突击。',
    options: [
      { text: '婴城死战，俟其疲敝（守城buff两回合，军心+9）', effect: { garrisonBuff: true, armyMorale: 9 } },
      { text: '开门突击，决一死战（自动大战，损兵1800）', effect: { massBattle: true, armyLoss: 1800 } }
    ]
  },

  // ---- 政治（4） ----
  {
    id: 'v16_shengui_liuzhi', name: '三省留直', illustration: 'court',
    description: '尚书省奏：军国多务，须令朝臣更日直宿，以决万机。或曰宜用旧德，或曰宜择明习文法者。',
    options: [
      { text: '选明习者直宿，庶务立决（金+800，忠诚+3）', effect: { money: 800, generalLoyalty: { amt: 3 } } },
      { text: '用旧德宿望，从容议政（文化+4，金-200）', effect: { culture: 4, money: -200 } }
    ]
  },
  {
    id: 'v16_yushi_fengwen', name: '御史风闻', illustration: 'court',
    description: '御史台上封事，言大臣交通宾客、货赂公行。天子以风闻言事，本欲广开言路，然所弹奏多不实。',
    options: [
      { text: '付有司核实，虚实皆行（忠诚+5，金-300）', effect: { generalLoyalty: { amt: 5 }, money: -300 } },
      { text: '以风闻为渎奏，切责之（忠诚-5，金+400）', effect: { generalLoyalty: { amt: -5 }, money: 400 } }
    ]
  },
  {
    id: 'v16_zongshi_ruwei', name: '宗室入卫', illustration: 'court',
    description: '宗正奏：宗室子弟入仕者少，多居散地。或请令高年宗室入直殿省，以彰亲亲；或请授实任，试其能否。',
    options: [
      { text: '令入直殿省，以为屏藩（忠诚+6，金-400）', effect: { generalLoyalty: { amt: 6 }, money: -400 } },
      { text: '量才授任，不专用亲（招募一将，文化+3）', effect: { recruitRandom: true, culture: 3 } }
    ]
  },
  {
    id: 'v16_mensheng_jianju', name: '门生荐举', illustration: 'taixue_lecture',
    description: '有下土贫士，负笈远至，献《新论》十篇，言历代兴亡之验。宰相览而异之，欲以名闻。',
    options: [
      { text: '召对称旨，授馆职（招募一将，文化+5）', effect: { recruitRandom: true, culture: 5 } },
      { text: '但赐束帛，遣归乡里（民心+2，金+200）', effect: { morale: 2, money: 200 } }
    ]
  },

  // ---- 经济（4） ----
  {
    id: 'v16_juntun_kaitian', name: '屯田开田', illustration: 'harvest',
    description: '边郡奏：营户旧屯田，久废不治。若发卒耕于塞上，且田且守，可省漕运之半。',
    options: [
      { text: '大兴屯田，且田且守（金-600，粮+1600，农业+5）', effect: { money: -600, food: 1600, agri: 5 } },
      { text: '但下诏书劝农（粮+500）', effect: { food: 500 } }
    ]
  },
  {
    id: 'v16_yunchao_zhili', name: '运漕治利', illustration: 'maritime_trade',
    description: '河漕不通，关中谷贵。户部请开渭水渠，引渭达河，以通关东之粟。功费不赀，然可久利。',
    options: [
      { text: '开漕渠，以通关中（金-900，粮+2000，科技+4）', effect: { money: -900, food: 2000, tech: 4 } },
      { text: '陆运而已，不烦民力（粮+600，民心-2）', effect: { food: 600, morale: -2 } }
    ]
  },
  {
    id: 'v16_guanshi_zhiju', name: '关市置邸', illustration: 'bazaar',
    description: '边州胡商辐辏，多以马市易缯絮。有司请置邸舍，专掌交易，岁入可观。',
    options: [
      { text: '置邸专掌，岁入官库（金+1800，商业+6）', effect: { money: 1800, comm: 6 } },
      { text: '与民共市，不专其利（民心+3，金+600）', effect: { morale: 3, money: 600 } }
    ]
  },
  {
    id: 'v16_yantie_shiguan', name: '盐铁市官', illustration: 'ancient_ruins',
    description: '河东池盐、蜀中铁山，民私采者众。或请置盐铁官，禁民私铸；或曰纵民为之，而收其税。',
    options: [
      { text: '置官专卖，以专其利（金+1500，民心-4）', effect: { money: 1500, morale: -4 } },
      { text: '弛禁收税，与民共之（金+800，民心+3）', effect: { money: 800, morale: 3 } }
    ]
  },

  // ---- 文化（4） ----
  {
    id: 'v16_mingtang_yashi', name: '明堂雅什', illustration: 'taixue_lecture',
    description: '有司奏：明堂新成，宜定雅乐，以郊祀上帝。太常请召诸生议声律，或曰当用周之旧曲，或曰当改换新声。',
    options: [
      { text: '改换新声，以彰王业（文化+10，金-500）', effect: { culture: 10, money: -500 } },
      { text: '仍用周旧，以存古意（文化+4）', effect: { culture: 4 } }
    ]
  },
  {
    id: 'v16_dazang_jinglou', name: '大藏经楼', illustration: 'buddhist_temple',
    description: '佛寺新成藏经楼，凡一万余卷。沙门请王临幸，设斋讲经，以结众缘。',
    options: [
      { text: '临幸设斋，听民瞻礼（文化+7，金-400）', effect: { culture: 7, money: -400 } },
      { text: '以其糜费，罢之（文化+2，民心+2）', effect: { culture: 2, morale: 2 } }
    ]
  },
  {
    id: 'v16_yinshi_jiangxue', name: '隐士讲学', illustration: 'daoist_temple',
    description: '有隐士结庐山中，聚徒数百人，讲《礼》《传》。州郡以闻，或请征之，或恐其聚徒生变。',
    options: [
      { text: '征入京师，拜为博士（招募一将，文化+6）', effect: { recruitRandom: true, culture: 6 } },
      { text: '听其在山，勿加征命（文化+3，民心+2）', effect: { culture: 3, morale: 2 } }
    ]
  },
  {
    id: 'v16_lezhi_dingzhang', name: '乐制定章', illustration: 'musician',
    description: '太常奏：江左旧乐，多所阙遗。今四海一家，宜集南北之工，考定钟律，勒为一代之典。',
    options: [
      { text: '诏集工官，考定钟律（文化+12，金-600）', effect: { culture: 12, money: -600 } },
      { text: '且仍旧，不烦改作（文化+3）', effect: { culture: 3 } }
    ]
  },

  // ---- 特殊（3） ----
  {
    id: 'v16_jingxing_chutu', name: '景星出', illustration: 'harvest',
    description: '太史奏：景星见于东北，状如半月，光明润泽。占者以为德星，主王朝有福，当赦天下。',
    options: [
      { text: '大赦天下，告庙受贺（民心+10，金-500）', effect: { factionMorale: 10, money: -500 } },
      { text: '付史官，不形喜惧（民心+2）', effect: { morale: 2 } }
    ]
  },
  {
    id: 'v16_renhe_xianqing', name: '仁和献庆', illustration: 'harvest',
    description: '梓州献瑞禾，一茎九穗。太守表称陛下德政所致，宜以闻。或曰此乃常事，不足示人。',
    options: [
      { text: '受贺，班行天下（民心+8，金-300）', effect: { factionMorale: 8, money: -300 } },
      { text: '却瑞不贺，戒饬郡县（民心+3，金+200）', effect: { morale: 3, money: 200 } }
    ]
  },
  {
    id: 'v16_jiquan_baoma', name: '骑进宝马', illustration: 'nomad_market',
    description: '突厥献马千匹，曰此汗之良马也，日行千里。请和亲以修旧好。',
    options: [
      { text: '受马许和，厚赐使者（金+800，蛮族关系+20）', effect: { money: 800, barbarianRel: 20 } },
      { text: '却其马，不与和亲（蛮族关系-10）', effect: { barbarianRel: -10 } }
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
  },

  // ---- V6.5 新增历史事件（5个：尔朱荣/陈霸先破齐/宇文护专政/齐后主/杨坚受禅） ----
  {
    id: 'erzhu_rong_hetian', name: '尔朱荣入洛', illustration: 'plague',
    minTurn: 1, factions: ['dongwei', 'xiwei'],
    description: '契胡酋长尔朱荣举兵入洛，沉胡太后及幼主于河阴，纵兵杀百官两千余人，史称"河阴之变"。朝士为之一空，魏室遂衰。',
    options: [
      { text: '收编尔朱余部（招募一将，耗金500）', effect: { recruitRandom: true, money: -500, factionMorale: 5 } },
      { text: '声讨尔朱氏（民心+8，军心+5）', effect: { factionMorale: 8, armyMorale: 5 } }
    ]
  },
  {
    id: 'chen_baikuan', name: '陈霸先破齐', illustration: 'cavalry_charge',
    minTurn: 5, faction: 'nanchao',
    description: '北齐大军十万逼建康，陈霸先率精兵潜出北郊，于白下/莫府山大破齐师，斩数千人，虏萧轨等。江左转危为安。',
    options: [
      { text: '重演白下大捷（自动大战，民心+12）', effect: { massBattle: true, factionMorale: 12 } }
    ]
  },
  {
    id: 'yuwen_hu_regent', name: '宇文护专政', illustration: 'plague',
    minTurn: 8, faction: 'xiwei',
    description: '宇文护连废三帝，大权独揽，群臣屏息。或亲之以为援，或除之以安社稷。',
    options: [
      { text: '隐忍待命（众将忠诚-5，军心+5）', effect: { generalLoyalty: { amt: -5 }, armyMorale: 5 } },
      { text: '密谋诛护（耗金800，众将忠诚+8）', effect: { money: -800, generalLoyalty: { amt: 8 } } }
    ]
  },
  {
    id: 'gao_wei_ainin', name: '齐后主宠佞', illustration: 'plague',
    minTurn: 20, faction: 'dongwei',
    description: '齐后主高纬宠信陆令萱、和士开等奸佞，诛杀忠良，朝政日坏。北周闻之，皆曰可伐。',
    options: [
      { text: '直言极谏（耗金500，众将忠诚+5）', effect: { money: -500, generalLoyalty: { amt: 5 } } },
      { text: '同流合污（民心-10，商业+5）', effect: { factionMorale: -10, comm: 5 } }
    ]
  },
  {
    id: 'yang_jian_shouchan', name: '杨坚受禅建隋', illustration: 'harvest',
    minTurn: 28, faction: 'xiwei',
    condition: (game) => {
      const g = game.generals.get('yang_jian');
      return g && g.faction === game.playerFaction;
    },
    description: '随国公杨坚受周静帝禅让，即皇帝位，国号隋，改元开皇。大崇改革，北镇突厥，南图江左。',
    options: [
      { text: '与民更始（民心+15，金钱+1500，全兵buff）', effect: { factionMorale: 15, money: 1500, garrisonBuff: true } },
      { text: '大杀周室（众将忠诚-8，军心+5）', effect: { generalLoyalty: { amt: -8 }, armyMorale: 5 } }
    ]
  },

  // ============================================================
  // V7.5 新增历史事件（5个详细版：孝文改革/六镇起义/河阴之变/沙苑之战/周武灭佛）
  // 技术：沿用 HISTORICAL_EVENTS 格式。minTurn 以开局年份折算回合。
  //       condition 回调用于校验城市归属/武将存活/势力存续。
  // ============================================================
  // 北魏孝文帝改革（494年）：迁都洛阳，全面汉化
  // 历史：太和十七年，孝文帝以南伐为名，率众至洛阳，定迁都之计。
  // 禁胡服、断北语、改鲜卑姓为汉姓（拓跋→元），定族姓，鼓励胡汉通婚。
  // 改革文治大兴，但六镇武人地位骤降，埋下分裂隐患。
  {
    id: 'xiaowen_banjin', name: '孝文汉化迁都', illustration: 'harvest',
    minTurn: 1, faction: 'dongwei',
    description: '孝文帝驾至洛阳，诏禁胡服、断北语，改拓跋氏为元氏，定国族四姓，鼓励胡汉通婚。文武衣冠，一如中原。然六镇旧人怨望，北边将有大变。',
    options: [
      { text: '全面推行汉化（繁荣+20，文化+60，民心+10，军心-8）', effect: { prosperity: 20, culture: 60, morale: 10, armyMorale: -8 } },
      { text: '渐进改革，兼顾武人（繁荣+8，文化+25，军心+5）', effect: { prosperity: 8, culture: 25, armyMorale: 5 } }
    ]
  },
  // 六镇起义详细版（523年）：沃野镇破六韩拔陵起义
  // 历史：正光四年，沃野镇民破六韩拔陵聚众杀镇将，改元真王。
  // 六镇并应，武川、怀朔相继陷落。魏廷束手无策，引柔然夹击，事虽暂平，
  // 然高欢、宇文泰皆起于六镇，北魏遂分裂。
  {
    id: 'liuzhen_qiyi_full', name: '六镇烽烟', illustration: 'rebellion',
    minTurn: 1, factions: ['dongwei', 'xiwei'],
    description: '沃野镇民破六韩拔陵杀镇将，改元真王。六镇并起，烽火千里。镇兵皆百战余勇，官军望风奔溃。收揽其众，可成霸业之基。',
    options: [
      { text: '出兵镇压（损兵3000，民心+5）', effect: { armyLoss: 3000, morale: 5 } },
      { text: '招抚收编（耗金1000，招募两将）', effect: { money: -1000, recruitRandom: true } }
    ]
  },
  // 河阴之变详细版（528年）：尔朱荣屠百官
  // 历史：胡太后毒杀孝明帝，尔朱荣以清君侧为名举兵入洛。
  // 迎立孝庄帝，沉胡太后及幼主于河阴，纵兵杀丞相以下百官两千余人。
  // 朝士为之一空，元氏宗室凋零，魏室名存实亡。
  {
    id: 'heyin_tusha', name: '河阴之变', illustration: 'plague',
    minTurn: 3, factions: ['dongwei', 'xiwei'],
    description: '尔朱荣引百官迎驾于河阴，责天下丧乱皆由朝臣不忠，纵骑杀两千余人，朝士为之一空。元氏公卿，喋血涂地。自此魏政归尔朱氏。',
    options: [
      { text: '收罗幸存朝士（招募一将，耗金500）', effect: { recruitRandom: true, money: -500, factionMorale: 5 } },
      { text: '引兵自保（民心-8，军心+5）', effect: { factionMorale: -8, armyMorale: 5 } }
    ]
  },
  // 沙苑之战详细版（537年）：宇文泰以少胜多
  // 历史：东魏高欢率二十万大军攻西魏，宇文泰不满万人屯沙苑。
  // 李弼建议于渭曲芦苇荡中设伏。东魏军见西魏兵少，争先进击，军阵乱。
  // 伏兵四起，于谨等合战，李弼横击其腹，东魏军大败，丧甲士八万。
  // 关中遂安，东西魏鼎立之势成。
  {
    id: 'shayuan_dajie', name: '沙苑芦伏', illustration: 'cavalry_charge',
    minTurn: 4, factions: ['xiwei', 'dongwei'],
    description: '东魏军大至，连营数十里。宇文泰以轻骑万人伏于渭曲芦苇荡中。敌兵争进，阵列紊乱，伏鼓骤鸣，芦中戈甲如林。高欢大败，丧甲士八万，丧服资仗无数。',
    options: [
      { text: '重演沙苑大捷（自动大战，民心+12，金钱+1000）', effect: { massBattle: true, factionMorale: 12, money: 1000 } }
    ]
  },
  // 北周武帝灭佛详细版（574年）：毁佛道二教
  // 历史：北周武帝宇文邕亲御大德殿，集百僚讨论释老。
  // 下诏断佛道二教，经像悉毁，沙门道士并令还俗。
  // 三百万僧尼编入户贯，寺观财产皆没官。国库大增，兵源广拓，为灭齐奠基。
  {
    id: 'zhoushu_miefu', name: '周武灭佛', illustration: 'harvest',
    minTurn: 16, faction: 'xiwei',
    description: '周武帝御大德殿，集百僚及沙门道士，亲讲《礼记》，下诏断佛道二教。经像毁弃，僧尼还俗三百万，寺观财物县官。国用大饶，兵源广拓。',
    options: [
      { text: '推行灭佛（金钱+2000，人口+30000，民心-10）', effect: { money: 2000, pop: 30000, factionMorale: -10, destroyTemple: true } },
      { text: '尊崇释道（民心+10，金钱-800）', effect: { factionMorale: 10, money: -800 } }
    ]
  },

  // ============================================================
  // V8.1 新增历史事件（12个：孝文改制/六镇起义/河阴之变/梁武崇佛/侯景之乱/
  //   周武灭佛/齐后宠佞/杨坚辅政/隋灭陈/木兰从军/祖冲之算历/云冈石窟）
  // 势力映射：北魏·北齐 → dongwei；北周·隋 → xiwei；南梁·南陈 → nanchao。
  // condition 回调统一做防御性取值（game.getFactionGenerals / getFactionCities）。
  // ============================================================
  {
    id: 'v81_xiaowen_gaizhi', name: '孝文帝改制', illustration: 'harvest',
    minTurn: 21, faction: 'dongwei',
    condition: (game) => {
      const gens = game.getFactionGenerals ? game.getFactionGenerals(game.playerFaction) : [];
      if (!gens.length) return false;
      const ruler = gens.reduce((a, b) => ((b.politics || 0) > (a.politics || 0) ? b : a));
      return (ruler.politics || 0) >= 70;
    },
    description: '魏都洛阳，华风日盛。孝文帝欲革鲜卑旧俗，断北语、易胡服、改汉姓、定族姓。然六镇武人勋旧，恐失其利。或大举更化，或徐图渐进。',
    options: [
      { text: '全面汉化（民心+10，繁荣+15，鲜卑旧将忠诚-5）', effect: { factionMorale: 10, prosperity: 15, generalLoyalty: { amt: -5 } } },
      { text: '渐进改革（民心+5，繁荣+8）', effect: { factionMorale: 5, prosperity: 8 } },
      { text: '维持旧制（众将忠诚+3）', effect: { generalLoyalty: { amt: 3 } } }
    ]
  },
  {
    id: 'v81_liuzhen_qibao', name: '六镇起义爆发', illustration: 'rebellion',
    minTurn: 41, factions: ['dongwei', 'xiwei'],
    condition: (game) => {
      const cities = game.getFactionCities ? game.getFactionCities(game.playerFaction) : [];
      if (!cities.length) return false;
      const avg = cities.reduce((s, c) => s + (c.morale || 0), 0) / cities.length;
      return avg < 40;
    },
    description: '沃野镇戍卒杀镇将，改元真王。六镇并起，烽火千里。镇兵皆百战余勇，官军望风奔溃。或倾国力镇压，或招安以收其锐，或迁都以避其锋。',
    options: [
      { text: '全力镇压（损兵5000，耗金2000，民心+10）', effect: { armyLoss: 5000, money: -2000, factionMorale: 10 } },
      { text: '招安收编（耗金3000，募一将）', effect: { money: -3000, recruitRandom: true, factionMorale: 5 } },
      { text: '迁都避祸（北方人心离散，民心-15）', effect: { factionMorale: -15, money: -500 } }
    ]
  },
  {
    id: 'v81_heyin_zhibian', name: '河阴之变', illustration: 'plague',
    minTurn: 51, factions: ['dongwei', 'xiwei'],
    description: '权臣挟震主之威，百官屏息。或起兵诛之以清君侧，或隐忍以俟其变，或单骑出奔以图后举。',
    options: [
      { text: '密谋诛杀权臣（内战，损兵3000）', effect: { massBattle: true, armyLoss: 3000, factionMorale: 5 } },
      { text: '隐忍待变（众将忠诚-10）', effect: { generalLoyalty: { amt: -10 } } },
      { text: '出逃南奔（招募一将，民心-5）', effect: { recruitRandom: true, factionMorale: -5 } }
    ]
  },
  {
    id: 'v81_liangwu_chonfo', name: '梁武帝崇佛', illustration: 'harvest',
    minTurn: 10, faction: 'nanchao',
    condition: (game) => {
      const cities = game.getFactionCities ? game.getFactionCities(game.playerFaction) : [];
      if (!cities.length) return false;
      const avg = cities.reduce((s, c) => s + ((c.religion && c.religion.buddhist) || 0), 0) / cities.length;
      return avg >= 40;
    },
    description: '江南上自皇室下至黎庶，竞以福田为务。梁武帝亲临同泰寺讲经，舍身入寺。广建伽蓝则梵刹遍江左，然国用由此耗矣。',
    options: [
      { text: '广建佛寺（文化+20，佛教兴盛，耗金3000）', effect: { culture: 20, money: -3000 } },
      { text: '三次舍身（正统+10，民心-5，耗金5000）', effect: { factionMorale: 10, money: -5000, morale: -5 } },
      { text: '理性崇佛（文化+10，耗金1000）', effect: { culture: 10, money: -1000 } }
    ]
  },
  {
    id: 'v81_houjing_zhiluan', name: '侯景之乱', illustration: 'rebellion',
    minTurn: 81, faction: 'nanchao',
    description: '东魏叛将侯景拥众来归，勇而无义，反复乱常。纳之则如养虎自患，拒之则失北归之士心，或用之北伐以收其用。',
    options: [
      { text: '接纳侯景（获猛将，民心-5）', effect: { recruitRandom: true, factionMorale: -5 } },
      { text: '拒绝接纳（民心+3）', effect: { factionMorale: 3 } },
      { text: '利用其北伐（自动大战，损兵2000）', effect: { massBattle: true, armyLoss: 2000, factionMorale: 5 } }
    ]
  },
  {
    id: 'v81_zhouwu_miefu2', name: '北周武帝灭佛', illustration: 'harvest',
    minTurn: 30, faction: 'xiwei',
    condition: (game) => {
      const gens = game.getFactionGenerals ? game.getFactionGenerals(game.playerFaction) : [];
      if (!gens.length) return false;
      const ruler = gens.reduce((a, b) => ((b.politics || 0) > (a.politics || 0) ? b : a));
      return (ruler.politics || 0) >= 75;
    },
    description: '周武帝亲御大德殿，集百僚讨论释老。寺观广占田产，僧尼不耕而食，国用日匮。或断教还俗以富国，或限其田而存其教，或曲护佛法以结人心。',
    options: [
      { text: '灭佛还俗（金钱+2000，人口+20000，民心-5，毁寺）', effect: { money: 2000, pop: 20000, factionMorale: -5, destroyTemple: true } },
      { text: '限制佛田（金钱+1000，文化-5）', effect: { money: 1000, culture: -5 } },
      { text: '保护佛教（民心+5，文化+10）', effect: { factionMorale: 5, culture: 10 } }
    ]
  },
  {
    id: 'v81_beiqi_zhunning', name: '北齐后主宠佞', illustration: 'plague',
    minTurn: 41, faction: 'dongwei',
    condition: (game) => {
      const gens = game.getFactionGenerals ? game.getFactionGenerals(game.playerFaction) : [];
      if (!gens.length) return false;
      const ruler = gens.reduce((a, b) => ((b.politics || 0) > (a.politics || 0) ? b : a));
      return (ruler.politics || 0) < 50;
    },
    description: '齐后主高纬昏弱，宠陆令萱、和士开等，日夕宴乐，朝政日紊。忠良侧目，北周闻之皆曰可伐。',
    options: [
      { text: '任用和士开（众将忠诚+5，繁荣-10）', effect: { generalLoyalty: { amt: 5 }, prosperity: -10 } },
      { text: '诛杀佞臣（众将忠诚-5，金钱+500）', effect: { generalLoyalty: { amt: -5 }, money: 500 } },
      { text: '不理朝政（民心-10）', effect: { factionMorale: -10 } }
    ]
  },
  {
    id: 'v81_yangjian_fuzheng', name: '杨坚辅政', illustration: 'harvest',
    minTurn: 121, faction: 'xiwei',
    condition: (game) => {
      const g = game.generals && game.generals.get ? game.generals.get('yang_jian') : null;
      return !!(g && g.faction === game.playerFaction);
    },
    description: '随国公杨坚出自功臣，朝野归心。少主暗弱，或拜为太傅以托孤，或外放方镇以远其势，或早图之以免尾大不掉。',
    options: [
      { text: '拜为辅政（杨坚属性+10，众将忠诚+5）', effect: { generalBuff: { id: 'yang_jian', amt: 10 }, generalLoyalty: { amt: 5 } } },
      { text: '外放杨坚（其出镇方镇，众将忠诚-3）', effect: { generalDebuff: { id: 'yang_jian', amt: 3 }, generalLoyalty: { amt: -3 } } },
      { text: '诛杀杨坚（杨坚去势，众将忠诚-15）', effect: { generalDeath: 'yang_jian', generalLoyalty: { amt: -15 } } }
    ]
  },
  {
    id: 'v81_sui_miechen2', name: '隋灭陈之战', illustration: 'cavalry_charge',
    minTurn: 100, faction: 'xiwei',
    condition: (game) => {
      const myCities = game.getFactionCities ? game.getFactionCities(game.playerFaction) : [];
      if (myCities.length < 25) return false;
      const nan = game.getFactionCities ? game.getFactionCities('nanchao') : [];
      return nan.length > 0;
    },
    description: '隋据有江北，财阜兵强。晋王杨广节度诸军，临江而陈。长江天险，一旦可渡，金陵王气尽矣。',
    options: [
      { text: '八路伐陈（自动大战，损兵5000，民心+10）', effect: { massBattle: true, armyLoss: 5000, factionMorale: 10 } },
      { text: '缓图之（备战舰，耗金1000，民心+5）', effect: { money: -1000, factionMorale: 5, garrisonBuff: true } },
      { text: '外交招降（耗金2000，民心+8）', effect: { money: -2000, factionMorale: 8 } }
    ]
  },
  {
    id: 'v81_mulan_congjun', name: '花木兰从军', illustration: 'cavalry_charge',
    minTurn: 31,
    condition: (game) => Math.random() < 0.6,
    description: '军书旁午，可汗大点兵。有女子木兰，其父老病，弟幼，乃易戎装，市鞍马，代父从军。万里赴戎机，关山度若飞。',
    options: [
      { text: '征召入伍（募得一骁勇）', effect: { recruitRandom: true, factionMorale: 3 } },
      { text: '赏赐还乡（民心+5，耗金500）', effect: { factionMorale: 5, money: -500 } }
    ]
  },
  {
    id: 'v81_zuchongzhi_suanli', name: '祖冲之算历', illustration: 'harvest',
    minTurn: 16, faction: 'nanchao',
    condition: (game) => Math.random() < 0.6,
    description: '南徐州从事祖冲之，博塞精思，穷微入妙。所造《大明历》，一岁之日与天行密合，又推圆周率至密。可赐官以成其书。',
    options: [
      { text: '支持编历（文化+15，科技+10，耗金1000）', effect: { culture: 15, tech: 10, money: -1000 } },
      { text: '任命为官（募一文臣，民心+5）', effect: { recruitRandom: true, factionMorale: 5 } },
      { text: '不感兴趣（无）', effect: { money: 0 } }
    ]
  },
  {
    id: 'v81_yungang_shiku', name: '云冈石窟开凿', illustration: 'harvest',
    minTurn: 20, factions: ['xiwei'],
    condition: (game) => {
      const pc = game.cities && game.cities.get ? game.cities.get('pingcheng') : null;
      if (!pc || pc.owner !== game.playerFaction) return false;
      const cities = game.getFactionCities ? game.getFactionCities(game.playerFaction) : [];
      const avg = cities.reduce((s, c) => s + ((c.religion && c.religion.buddhist) || 0), 0) / Math.max(1, cities.length);
      return avg >= 20;
    },
    description: '都平城，武州塞山崖，沙门昙曜请凿石壁，开五所大窟，镌佛形象，高者七十尺。工程浩大，梵宇辉煌，然财力耗竭亦所不免。',
    options: [
      { text: '开凿石窟（文化+25，耗金4000）', effect: { culture: 25, money: -4000 } },
      { text: '小规模开凿（文化+10，耗金1500）', effect: { culture: 10, money: -1500 } },
      { text: '停止工程（民心+3）', effect: { factionMorale: 3 } }
    ]
  },

  // ========== V9.0 新增历史事件（5个，按时间线） ==========
  // 尔朱荣入洛·河阴之变（528）
  {
    id: 'v90_erzhu_rong_luo', name: '尔朱荣入洛', illustration: 'heyin',
    minTurn: 1, factions: ['dongwei', 'xiwei'],
    description: '契胡尔朱荣自晋阳举兵入洛，沉胡太后及幼主于河阴，纵兵围杀王公百官两千余人，朝市为之一空。魏室屠戮殆尽，尔朱荣遂专朝政。',
    options: [
      { text: '依附尔朱氏（募猛将，忠诚-10）', effect: { recruitRandom: true, generalLoyalty: { amt: -10 }, factionMorale: -5 } },
      { text: '潜谋诛凶（军心+10，损兵1000）', effect: { armyLoss: 1000, armyMorale: 10, generalLoyalty: { amt: 8 } } }
    ]
  },
  // 高欢灭尔朱氏·韩陵之战（531/532）
  {
    id: 'v90_gao_huan_hanling', name: '高欢灭尔朱氏', illustration: 'cavalry_charge',
    minTurn: 3, faction: 'dongwei',
    condition: (game) => {
      const g = game.generals && game.generals.get ? game.generals.get('gao_huan') : null;
      return !!(g && g.faction === game.playerFaction);
    },
    description: '高欢以众寡之势，于韩陵山为圆阵，连系牛驴以塞归道。三军致死，大破尔朱氏二十万。尔朱兆走死，尔朱氏遂灭。高欢由此执魏政。',
    options: [
      { text: '韩陵决战（自动大会战，士气+15）', effect: { massBattle: true, factionMorale: 15 } },
      { text: '徐图渐进（金钱+1000，募一将）', effect: { money: 1000, recruitRandom: true } }
    ]
  },
  // 宇文泰割据关中（534，北魏分裂）
  {
    id: 'v90_yuwen_taiguanzhong', name: '宇文泰割据关中', illustration: 'cavalry_charge',
    minTurn: 4, faction: 'xiwei',
    condition: (game) => {
      const g = game.generals && game.generals.get ? game.generals.get('yuwen_tai') : null;
      return !!(g && g.faction === game.playerFaction);
    },
    description: '孝武帝西奔长安，宇文泰迎帝入关。北魏自此分裂为东西。高欢别立孝静帝迁都于邺，宇文泰鸩孝武帝而立文帝，专关中之政。',
    options: [
      { text: '据关陇以成霸业（民心+10，正统+）', effect: { factionMorale: 10, culture: 8 } },
      { text: '挟天子令诸侯（募一将，忠诚+5）', effect: { recruitRandom: true, generalLoyalty: { amt: 5 } } }
    ]
  },
  // 陈霸先建国（557，陈朝建立）
  {
    id: 'v90_chen_founding', name: '陈霸先建国', illustration: 'accession',
    minTurn: 8, faction: 'nanchao',
    condition: (game) => {
      const g = game.generals && game.generals.get ? game.generals.get('chen_baxian') : null;
      return !!(g && g.faction === game.playerFaction);
    },
    description: '陈王霸先受梁禅，即皇帝位于南郊，国号陈，改元永定。江南百废待兴，百僚上表称贺。',
    options: [
      { text: '与民更始（民心+15，商业+10）', effect: { factionMorale: 15, comm: 10 } },
      { text: '大赏功臣（耗金1500，忠诚+10）', effect: { money: -1500, generalLoyalty: { amt: 10 } } }
    ]
  },
  // 杨坚代周（581，隋朝建立）
  {
    id: 'v90_yangjian_daizhou', name: '杨坚代周', illustration: 'abdication',
    minTurn: 120, faction: 'xiwei',
    condition: (game) => {
      const g = game.generals && game.generals.get ? game.generals.get('yang_jian') : null;
      return !!(g && g.faction === game.playerFaction);
    },
    description: '随王杨坚受周静帝禅，即皇帝位，国号隋，改元开皇。大崇改革，躬履俭素，天下归心。混一之势成矣。',
    options: [
      { text: '改元开皇（全兵种+，民心+15）', effect: { factionMorale: 15, culture: 15 } },
      { text: '大赐群臣（耗金2000，忠诚+15）', effect: { money: -2000, generalLoyalty: { amt: 15 } } }
    ]
  },

  // ============================================================
  // V9.5 新增历史事件（5 个）：三武灭佛 / 梁武舍身 / 侯景之乱详版 / 隋炀南巡
  // 历史参考：
  //  - 太武灭佛：太平真君七年(446)，太武帝拓跋焘至长安，
  //    以寺中藏兵器、酿酒、淫乱为由，从崔浩之言诏诛沙门，毁佛像经卷。
  //  - 梁武舍身：大通元年(527)，武帝萧衍舍身同泰寺，群臣以钱一亿万奉赎。
  //  - 侯景之乱：太清二年(548)，侯景寿阳举兵渡江围台城，江南残破。
  //  - 周武灭佛：建德三年(574)，武帝宇文邕诏废佛道二教，僧尼还俗，融佛焚经。
  //  - 隋炀南巡：大业元年(605)，隋炀帝杨广开通济渠，龙舟巡幸江都。
  // ============================================================
  // 1. 北魏太武帝灭佛（446）
  {
    id: 'v95_taiwu_miefo', name: '太武灭佛', illustration: 'yungang_grotto',
    minTurn: 2, faction: 'dongwei',
    description: '太平真君七年，太武帝拓跋焘至长安，见佛寺藏兵器、酿酒具，司徒崔浩进言请诛天下沙门。遂诏毁佛像、焚经卷、坑杀僧众。佛教遭传入中原以来第一次法难。',
    options: [
      { text: '从崔浩议，大举灭佛（兵源/钱粮+，民心-20，文化-20）', effect: { money: 2000, food: 2000, factionMorale: -20, culture: -20 } },
      { text: '缓其诛，仅沙汰（经济+，民心-5）', effect: { money: 800, factionMorale: -5, culture: -8 } }
    ]
  },
  // 2. 梁武帝舍身同泰寺（527）
  {
    id: 'v95_liangwu_sheshen', name: '梁武舍身', illustration: 'buddhist_temple',
    minTurn: 2, faction: 'nanchao',
    description: '大通元年，梁武帝萧衍幸同泰寺，舍身入寺为奴。群臣敛钱一亿万奉赎皇帝菩萨。朝野喧腾，佛教鼎盛，然国库为之一空。',
    options: [
      { text: '大肆崇佛（文化+25，民心+10，金钱-3000）', effect: { money: -3000, culture: 25, factionMorale: 10 } },
      { text: '速还宫理政（文化+5，民心+3）', effect: { culture: 5, factionMorale: 3 } }
    ]
  },
  // 3. 侯景之乱详细版（548）
  {
    id: 'v95_houjing_detailed', name: '侯景之乱·详版', illustration: 'houjing_rebellion',
    minTurn: 4, faction: 'nanchao',
    condition: (game) => {
      const g = game.generals && game.generals.get ? game.generals.get('hou_jing') : null;
      return !!g;
    },
    description: '太清二年，侯景自寿阳举兵反，诡称清君侧，渡江直逼台城。临贺王萧正德为之内应，城中久围粮尽，人相食。江南千里绝烟，白骨成聚。',
    options: [
      { text: '召四方勤王（损兵4000，耗金1500）', effect: { money: -1500, armyLoss: 4000, factionMorale: -5 } },
      { text: '与景议和（民心-25，国威扫地）', effect: { factionMorale: -25, culture: -10 } }
    ]
  },
  // 4. 北周武帝灭佛详细版（574）
  {
    id: 'v95_zhouwu_miefo', name: '周武灭佛', illustration: 'yungang_grotto',
    minTurn: 6, faction: 'xiwei',
    description: '建德三年，武帝宇文邕集百官、沙门、道士辩论三教，定儒为先。下诏断佛道二教，经像悉毁，罢沙门道士并令还民。三百万僧尼编户，国库兵源大增。',
    options: [
      { text: '厉行灭佛（金钱+3000，粮草+3000，民心-15）', effect: { money: 3000, food: 3000, factionMorale: -15 } },
      { text:'仅沙汰僧尼（金钱+1000，民心-5）', effect: { money: 1000, factionMorale: -5 } }
    ]
  },
  // 5. 隋炀帝南巡（605，虚构延伸）
  {
    id: 'v95_suiyang_nanxun', name: '炀帝南巡', illustration: 'maritime',
    minTurn: 8, faction: 'xiwei',
    description: '大业元年，隋炀帝杨广发河南诸郡百余万开通济渠，造龙舟四重，率后妃诸王百官巡幸江都。舳舻千里，耗费无度，百姓困敝，乱萌渐起。',
    options: [
      { text: '盛仪南巡（金钱-4000，文化+15，民心-15）', effect: { money: -4000, culture: 15, factionMorale: -15 } },
      { text: '罢役恤民（民心+10）', effect: { factionMorale: 10 } }
    ]
  },

  // ============ V10.0 新增历史事件（5个） ============
  // 1. 淝水之战（383）：前秦苻坚南征，东晋谢安谢玄以八万北府兵大破百万秦军
  {
    id: 'v100_feishui_zhan', name: '淝水之战', illustration: 'feishui',
    minTurn: 3, factions: ['nanchao', 'xiwei'],
    condition: (game) => {
      const g = game.generals && game.generals.get ? game.generals.get('xie_xuan') : null;
      return !!g;
    },
    description: '太元八年，苻坚率众百万南下，号称投鞭断流。东晋谢安从容运筹，谢玄率八万北府兵渡淝水而阵。秦军一退不可止，风声鹤唳皆以为追兵。此一战，南北对峙之势成。',
    options: [
      { text: '北府决胜（东晋大胜，自动大战）', effect: { massBattle: true, morale: 15, culture: 10 } },
      { text: '据守不战（相持日久，耗粮2000）', effect: { food: -2000, factionMorale: -5 } }
    ]
  },
  // 2. 刘裕北伐（416-417）：刘裕率王镇恶等北伐，灭南燕后秦，收复长安洛阳
  {
    id: 'v100_liu_yu_beifa', name: '刘裕北伐', illustration: 'cavalry_charge',
    minTurn: 5, faction: 'nanchao',
    condition: (game) => {
      const g = game.generals && game.generals.get ? game.generals.get('liu_yu') : null;
      return !!g;
    },
    description: '义熙十二年，刘裕北伐后秦。王镇恶水军自黄河入渭，克长安，后秦亡。又以却月阵破北魏铁骑。自江南未有武功之盛如此者。',
    options: [
      { text: '倾国北伐（自动大战，收复两京）', effect: { massBattle: true, morale: 12, money: 1500 } },
      { text: '偏师进取（损兵2000，获粮2000）', effect: { armyLoss: 2000, food: 2000, morale: 5 } }
    ]
  },
  // 3. 刘裕代晋（420）：刘裕受晋恭帝禅，建立宋朝，南朝始此
  {
    id: 'v100_liu_yu_daijin', name: '刘裕代晋', illustration: 'accession',
    minTurn: 8, faction: 'nanchao',
    condition: (game) => {
      const g = game.generals && game.generals.get ? game.generals.get('liu_yu') : null;
      return g && g.faction === game.playerFaction;
    },
    description: '元熙二年，宋王刘裕受晋恭帝禅，即皇帝位，国号宋，改元永初。晋祚终结，南朝始此。刘裕起自布衣，却月破阵、北伐定中原，为南朝武功第一。',
    options: [
      { text: '与民更始（大赦天下，民心+15）', effect: { factionMorale: 15, money: -800, culture: 10 } }
    ]
  },
  // 4. 萧道成代宋（479）：齐高帝萧道成代宋建齐
  {
    id: 'v100_xiaodao_cheng', name: '萧齐代宋', illustration: 'abdication',
    minTurn: 10, faction: 'nanchao',
    description: '宋末宗室相屠，萧道成乘势掌权。昇明三年，顺帝禅位，道成称帝，国号齐，改元建元。戒奢崇俭，颜意哀恕，齐业初基。',
    options: [
      { text: '革宋之弊（民心+12，文化+8）', effect: { factionMorale: 12, culture: 8 } },
      { text: '因循守旧（民心+5）', effect: { factionMorale: 5 } }
    ]
  },
  // 5. 萧衍代齐（502）：梁武帝萧衍代齐建梁
  {
    id: 'v100_xiao_yan_daiqi', name: '萧梁代齐', illustration: 'accession',
    minTurn: 12, faction: 'nanchao',
    condition: (game) => {
      const g = game.generals && game.generals.get ? game.generals.get('xiao_yan') : null;
      return !!g;
    },
    description: '齐末东昏侯昏暴，萧衍自襄阳东下，围建康。中兴二年，和帝禅位于萧衍，国号梁，改元天监。衍初即位，崇儒兴学，天监之治为南朝文物之冠。',
    options: [
      { text: '崇儒兴学（文化+15，民心+10）', effect: { culture: 15, factionMorale: 10, money: -600 } }
    ]
  },

  // ============ V10.5 新增历史事件（5个，v105_ 前缀） ============
  // 历史：均为南北朝正史确有、且此前历史事件链未收录的重要节点。
  // 1. 元嘉草草（450）：北魏太武帝拓跋焘南征至瓜步，刘宋元嘉之治终结，"赢得仓皇北顾"
  {
    id: 'v105_yuanjia_caocao', name: '元嘉草草', illustration: 'fire_attack_event',
    minTurn: 4, faction: 'nanchao',
    description: '元嘉二十七年，王玄谟北伐溃败。魏太武帝拓跋焘纵骑南下，直抵瓜步，声言渡江。建康震惧，内宫戒严。元嘉之治，一朝萧瑟。',
    options: [
      { text: '沿江拒守（损兵3000，民心-8）', effect: { armyLoss: 3000, factionMorale: -8 } },
      { text: '遣使求和（金钱-1500，民心-5）', effect: { money: -1500, factionMorale: -5 } }
    ]
  },
  // 2. 国史之狱（450）：北魏崔浩监修国史，直书拓跋氏旧事，拓跋焘族诛崔浩，士族震恐
  {
    id: 'v105_guoshi_zhiyu', name: '国史之狱', illustration: 'court',
    minTurn: 5, faction: 'dongwei',
    description: '太平真君十一年，司徒崔浩监修国史，备而不典，刊石通衢。魏主大怒，置浩于理，清河崔氏尽夷，河北士族震慑。',
    options: [
      { text: '穷治其狱（众将忠诚-8，文化-10）', effect: { generalLoyalty: { amt: -8 }, culture: -10 } },
      { text: '赦而不问（众将忠诚+5）', effect: { generalLoyalty: { amt: 5 } } }
    ]
  },
  // 3. 冯氏临朝（476）：北魏文明冯太后临朝称制，行班禄、均田、三长，太和改革之先声
  {
    id: 'v105_fengshi_linchao', name: '文明称制', illustration: 'harvest',
    minTurn: 6, faction: 'dongwei',
    description: '承明元年，文明冯太后临朝听政。颁俸禄、行均田、立三长，班禄之制一改北魏无官之弊。国用浸裕，太和文治基于此。',
    options: [
      { text: '力行新政（金钱+1500，粮草+1500，文化+12，民心+5）', effect: { money: 1500, food: 1500, culture: 12, factionMorale: 5 } },
      { text: '因循旧制（民心+3）', effect: { factionMorale: 3 } }
    ]
  },
  // 4. 达摩东渡（约520）：菩提达摩泛海至广州，一苇渡江，嵩山面壁九年，禅宗东土初祖
  {
    id: 'v105_damo_dongdu', name: '达摩东渡', illustration: 'buddhist_temple',
    minTurn: 3, factions: ['nanchao', 'dongwei'],
    description: '南天竺僧菩提达摩泛海而至，广陵王迎问，机语不契。遂一苇渡江，栖止嵩山少林寺，面壁九年。禅宗一脉，自此东传。',
    options: [
      { text: '请问禅要（耗金300，文化+20，科技+10）', effect: { money: -300, culture: 20, tech: 10 } },
      { text: '以礼送之（文化+8）', effect: { culture: 8 } }
    ]
  },
  // 5. 吕梁之败（577）：陈将吴明彻北伐围彭城，周将王轨断其归路，陈之精锐尽丧于吕梁
  {
    id: 'v105_wumingshe_lüliang', name: '吕梁之败', illustration: 'fire_attack_event',
    minTurn: 8, faction: 'nanchao',
    description: '太建九年，吴明彻北伐围彭城。周将王轨轻行自清水入淮口，横流竖木，铁锁绝舟。陈水军退路被断，将士溃散，明彻被俘。南朝锐卒，一战尽丧。',
    options: [
      { text: '拼死突围（损兵5000，军心-12）', effect: { armyLoss: 5000, armyMorale: -12 } },
      { text: '敛师南还（损兵2500，民心-6）', effect: { armyLoss: 2500, factionMorale: -6 } }
    ]
  },

  // ---------- V11.0 新增历史事件（5个） ----------
  // 1. 瓜步之战（450年）：北魏太武帝拓跋焘南征至瓜步，声言渡江，建康震恐
  {
    id: 'v110_guabu_zhizhan', name: '瓜步之战', illustration: 'cavalry_charge',
    minTurn: 5, factions: ['dongwei', 'nanchao'],
    description: '元嘉二十七年，魏太武帝拓跋焘亲率步骑十余万南征，连破兖、徐、豫诸州，直抵瓜步，伐苇为筏，声言渡江。建康内外戒严，丹阳统内尽户发丁。宋文帝登烽火楼，始有北顾之悔。',
    options: [
      { text: '临江决战（魏军大胜，自动大战）', effect: { massBattle: true, factionMorale: -10 } },
      { text: '议和求和（耗金2000，割地赔款）', effect: { money: -2000, factionMorale: -5, territoryLoss: true } }
    ]
  },
  // 2. 潼关斩窦泰（537年）：宇文泰奇袭潼关，斩高欢大将窦泰
  {
    id: 'v110_tongguan_doutai', name: '潼关大捷', illustration: 'cavalry_charge',
    minTurn: 4, factions: ['xiwei', 'dongwei'],
    description: '天平四年，高欢分三路伐西魏，使窦泰率精兵趋潼关。宇文泰潜军东出，潜至小关，窦泰不意西师猝至，自投冈涧而死，万余精兵尽没。高欢失臂，遂撤围。',
    options: [
      { text: '奇袭制胜（西魏大胜，自动大战）', effect: { massBattle: true, armyMorale: 15 } },
      { text: '坚守不战（双方相持）', effect: { money: -500, armyMorale: 5 } }
    ]
  },
  // 3. 颍川陷落（549年）：王思政守颍川，东魏慕容绍宗决水灌城
  {
    id: 'v110_yingchuan_xianluo', name: '颍川陷落', illustration: 'city_siege',
    minTurn: 6, factions: ['xiwei', 'dongwei'],
    description: '武定七年，王思政守颍川，东魏慕容绍宗、刘丰生率军十万攻之。绍宗堰洧水以灌城，城崩。思政率士卒巷战，力屈被执。绍宗亦于城下溺水而死。一城之守，牵动两国之运。',
    options: [
      { text: '死守到底（损兵4000，城池陷落）', effect: { armyLoss: 4000, cityFall: true, armyMorale: -8 } },
      { text: '突围而走（损兵2000，保存实力）', effect: { armyLoss: 2000, armyMorale: -3 } }
    ]
  },
  // 4. 巴陵大捷（551年）：王僧辩守巴陵，大破侯景
  {
    id: 'v110_baling_dajie', name: '巴陵大捷', illustration: 'fire_attack_event',
    minTurn: 5, faction: 'nanchao',
    description: '大宝二年，侯景率大军西上，围巴陵。王僧辩闭城固守，偃旗卧鼓。侯景攻城不克，军中食尽，疾疫死伤太半。王僧辩纵兵出击，大破之。景烧营夜遁。自是景不复强军。',
    options: [
      { text: '出击破敌（南梁大胜，自动大战）', effect: { massBattle: true, armyMorale: 18, factionMorale: 10 } }
    ]
  },
  // 5. 沌口之战（567年）：吴明彻讨华皎，大破后梁水军
  {
    id: 'v110_zhunkou_zhizhan', name: '沌口之战', illustration: 'naval_battle_event',
    minTurn: 7, factions: ['nanchao', 'xiwei', 'hou_liang'],
    description: '光大元年，陈湘州刺史华皎叛降后梁。陈将吴明彻率舟师三万讨之，战于沌口。明彻募军中小善快船，先发拍舰，击后梁水军，尽焚其舟。皎与梁将王操单舸遁走。长江上流遂定。',
    options: [
      { text: '水军决战（南陈大胜，水战大捷）', effect: { massBattle: true, navyMorale: 20, factionMorale: 8 } },
      { text: '陆师进讨（损兵3000，相持不下）', effect: { armyLoss: 3000, factionMorale: 3 } }
    ]
  },

  // ============================================================
  // V11.5 新增历史事件（5个）：统万破夏 / 陈庆之北伐 / 盱眙之围 / 太建北伐 / 冼夫人归隋
  // 历史依据：《魏书·世祖纪》《梁书·陈庆之传》《宋书·臧质传》《陈书·宣帝纪》《隋书·列女传》。
  // minTurn 折算：开局≈1回合/年；各事件按其剧本历史时点设置触发回合。
  // ============================================================
  // 1. 统万破夏（427年）：北魏拓跋焘千里奔袭，破赫连勃勃都统万城
  {
    id: 'v115_tongwan_battle', name: '统万破夏', illustration: 'city_siege',
    minTurn: 3, faction: 'dongwei',
    description: '始光四年，魏太武帝拓跋焘率轻骑二千里奔袭大夏都统万城。夏主赫连昌出战大败，奔上邽。魏军入统万，俘夏公卿宫人万数，获马三十余万匹。关中门户遂开。',
    options: [
      { text: '轻骑奔袭（北魏大胜，自动大战）', effect: { massBattle: true, armyMorale: 15, factionMorale: 8 } },
      { text: '缓师围困（耗粮1000，相持）', effect: { food: -1000, armyMorale: 5 } }
    ]
  },
  // 2. 陈庆之北伐（529年）：七千白袍入洛阳
  {
    id: 'v115_chenqingzhi_north', name: '白袍北伐', illustration: 'cavalry_charge',
    minTurn: 4, faction: 'nanchao',
    description: '中大通元年，梁将陈庆之率七千白袍军送北海王元颢北归。十四旬取三十二城，四十七战所向克捷，遂入洛阳。洛阳童谣曰：「名师大将莫自牢，千兵万马避白袍。」',
    options: [
      { text: '长驱入洛（南梁大捷，自动大战）', effect: { massBattle: true, armyMorale: 20, factionMorale: 12 } },
      { text: '稳守淮北（耗金500）', effect: { money: -500, armyMorale: 6 } }
    ]
  },
  // 3. 盱眙之围（451年）：臧质以弱卒死守盱眙，却魏太武帝
  {
    id: 'v115_xuyi_siege', name: '盱眙却敌', illustration: 'city_siege',
    minTurn: 5, faction: 'nanchao',
    description: '元嘉二十八年，魏太武帝拓跋焘瓜步退师，以数十万围盱眙。守将臧质闭城拒守，掷溺器以辱魏主。魏军围城三旬，死伤涂地，弗克而还。江左危而复安。',
    options: [
      { text: '全城死守（守城buff两回合，民心+10）', effect: { garrisonBuff: true, factionMorale: 10 } }
    ]
  },
  // 4. 太建北伐（573年）：陈宣帝遣吴明彻收复淮南
  {
    id: 'v115_taijian_north', name: '太建北伐', illustration: 'cavalry_charge',
    minTurn: 3, faction: 'nanchao',
    description: '太建五年，陈宣帝决意北伐，以吴明彻为都督，统十万众出秦郡。所向降下，克复江北、淮南数十城。江淮之地复归于陈，南朝兵威为东晋以来所未有。',
    options: [
      { text: '倾国北伐（南陈大胜，自动大战）', effect: { massBattle: true, armyMorale: 16, factionMorale: 10 } },
      { text: '蚕食边境（耗粮1500，稳进）', effect: { food: -1500, comm: 6 } }
    ]
  },
  // 5. 冼夫人归隋（589年）：岭南谯国夫人举地归附
  {
    id: 'v115_xian_furen', name: '岭南归附', illustration: 'buddhist_sermon',
    minTurn: 4, faction: 'xiwei',
    description: '隋灭陈后，岭南数郡共奉高凉冼夫人为主，号「圣母」，保境拒守。隋遣韦洸招抚，夫人集首领数千尽日恸哭，乃遣孙冯魂迎洸入广州。岭南遂定，不烦兵戈。',
    options: [
      { text: '遣使招抚（岭南归附，金钱+1000，民心+8）', effect: { money: 1000, factionMorale: 8, comm: 8 } },
      { text: '出兵压境（损兵2000，强取）', effect: { armyLoss: 2000, factionMorale: 4 } }
    ]
  },

  // === V12.0 新增历史事件（5个）===
  // 历史参考：《陈书·吴明彻传》《魏书·肃宗纪》《宋书·二凶传》《梁书·武帝纪》《宋书·索虏传》
  {
    id: 'v120_lvliang_zhibai', name: '吕梁之败', illustration: 'cavalry_charge',
    minTurn: 28, factions: ['nanchao'],
    description: '太建北伐以来，吴明彻围彭城已逾数月。周遣王轨轻兵断清口，水师退路被绝。明彻军溃，被俘北去。江北得而复失，陈朝气运中衰。',
    options: [
      { text: '全军撤退（损兵5000，兵力保存）', effect: { armyLoss: 5000, factionMorale: -10 } },
      { text: '决战突围（自动大战，惨胜）', effect: { massBattle: true, armyLoss: 3000, factionMorale: -5 } }
    ]
  },
  {
    id: 'v120_gegong_luanqi', name: '葛荣百万', illustration: 'rebellion',
    minTurn: 15, factions: ['dongwei'],
    description: '六镇余众葛荣兼并杜洛周，众号百万，南趋邺城。尔朱荣率七千精骑东出滏口，鼓噪而进，葛荣众溃，一战擒之。河北平定，尔朱氏威震天下。',
    options: [
      { text: '尔朱荣出战（大捷，收编降众）', effect: { massBattle: true, armyGain: 8000, factionMorale: 10 } },
      { text: '固守邺城（耗金1000，僵持）', effect: { money: -1000, factionMorale: -5 } }
    ]
  },
  {
    id: 'v120_yuanxiong_shifu', name: '元凶伏诛', illustration: 'plague',
    minTurn: 10, factions: ['nanchao'],
    description: '元嘉末，太子刘劭弑父刘义隆篡位。江州刺史刘骏举兵东下，诸方镇响应。劭、濬伏诛，刘骏即位是为孝武帝。然宗室相屠之端自此始。',
    options: [
      { text: '讨贼建功（兵力+3000，民心+10）', effect: { armyGain: 3000, factionMorale: 10 } },
      { text: '坐观成败（忠诚-15，宗室离心）', effect: { loyaltyPenalty: 15, factionMorale: -5 } }
    ]
  },
  {
    id: 'v120_huanyuan_cuanjin', name: '桓玄篡晋', illustration: 'accession',
    minTurn: 8, factions: ['nanchao'],
    description: '桓玄乘北府兵弱，举兵东下，攻入建康，废晋安帝自立，国号楚。刘裕潜结北府旧将，起兵京口，覆桓玄复晋祚。然晋祚亦自此移于刘裕。',
    options: [
      { text: '起兵匡复（自动大战，兵力+2000）', effect: { massBattle: true, armyGain: 2000, factionMorale: 8 } },
      { text: '出降仕楚（金钱+500，忠诚-20）', effect: { money: 500, loyaltyPenalty: 20 } }
    ]
  },
  {
    id: 'v120_queyue_zhenwei', name: '却月破魏', illustration: 'cavalry_charge',
    minTurn: 12, factions: ['nanchao'],
    description: '刘裕北伐至黄河，魏骑数万屯北岸。裕命白直队丁旿率七百人车百乘，陈兵河北为却月阵。魏骑三面来攻，阵中大弩齐发，魏军奔溃，斩获千计。魏人夺气，不敢复逼。',
    options: [
      { text: '布却月阵（大胜魏军，弓兵+20%）', effect: { archerMult: 0.20, massBattle: true, factionMorale: 12 } },
      { text: '谨慎渡江（稳扎稳打，无大胜亦无败）', effect: { food: -1000 } }
    ]
  },

  // ============================================================
  // V12.5 新增 5 个历史事件（v125_ 前缀）
  // 历史考证：
  // 1) 尉迟迥之乱（580）：杨坚辅政，相州总管尉迟迥举兵，
  //    司马消难、王谦应之，韦孝宽破邺城，迥自杀。——《周书·尉迟迥传》
  // 2) 裴叔业降魏（500）：南齐豫州刺史裴叔业以寿阳降魏，
  //    魏遣元王、杨大眼赴寿春。南朝失淮南重镇。——《魏书·裴叔业传》
  // 3) 邢杲起义（528）：河北流民十余万推邢杲为主，
  //    起兵反魏，后尔朱兆破之。——《魏书·邢杲传》
  // 4) 北魏破柔然（429）：拓跋焘亲征柔然，
  //    柔然可汗大檀烧遁，国中高车亦叛，柔然自此衰。——《魏书·蠕蠕传》
  // 5) 陈霸先杀王僧辩（555）：王僧辩迎萧渊明于齐，
  //    陈霸先京口起兵袭杀僧辩，立萧方智。——《陈书·高祖纪》
  // ============================================================

  // ---- 1) 尉迟迥之乱（580年）----
  {
    id: 'v125_yuchi_jiong_luan', name: '尉迟迥之乱', illustration: 'rebellion',
    minTurn: 30, factions: ['xiwei', 'nanchao'],
    condition: function(g) { return g.year >= 580; },
    description: '杨坚辅政，威福自己。相州总管尉迟迥周之旧臣，仗兵甲精强，举兵匡复周氏。郧州司马消难、益州王谦并应之，关东骚动。',
    options: [
      { text: '支持杨坚讨叛（灭迥，关中空，得正统+20）', effect: { legitimacy: 20, morale: 10, money: 1000 } },
      { text: '响应尉迟迥（忠周室，与杨坚为敌）', effect: { morale: -5, armyLoss: 2000 } }
    ]
  },
  // ---- 2) 裴叔业降魏（500年）----
  {
    id: 'v125_pei_shuye_jiangwei', name: '裴叔业降魏', illustration: 'court',
    minTurn: 25, factions: ['nanchao', 'dongwei'],
    condition: function(g) { return g.year >= 500 && g.faction === 'nanchao'; },
    description: '南齐豫州刺史裴叔业惧朝廷见杀，遣使以寿阳降魏。魏遣元王、杨大眼赴寿春。南朝失淮南重镇，边防为之一空。',
    options: [
      { text: '失寿阳，固守淮南（民心-10，兵+3000补防）', effect: { morale: -10, army: 3000 } },
      { text: '反攻寿阳（损兵3000，若胜则复寿阳）', effect: { armyLoss: 3000, morale: 5, money: -800 } }
    ]
  },
  // ---- 3) 邢杲起义（528年）----
  {
    id: 'v125_xing_gao_qiyi', name: '邢杲起义', illustration: 'rebellion',
    minTurn: 28, factions: ['dongwei', 'nanchao'],
    condition: function(g) { return g.year >= 528 && g.faction === 'dongwei'; },
    description: '河北流民十余万推北海人邢杲为主，起兵反魏，号汉王。劫掠青州，山东骚动。',
    options: [
      { text: '出兵镇压（损兵2000，金-500）', effect: { armyLoss: 2000, money: -500, morale: 5 } },
      { text: '招安授官（民心-5，得兵5000）', effect: { morale: -5, army: 5000 } }
    ]
  },
  // ---- 4) 北魏破柔然（429年）----
  {
    id: 'v125_beipo_rouran', name: '大破柔然', illustration: 'cavalry_charge',
    minTurn: 20, factions: ['dongwei'],
    condition: function(g) { return g.year >= 429 && g.faction === 'dongwei'; },
    description: '魏太武帝拓跋焘亲征柔然，五路并进。柔然可汗大檀惶恐，将族庐烧遁。国中高车诸部亦叛附魏。柔然自此衰弱，北边少事。',
    options: [
      { text: '大破柔然（金+1500，民心+10，北疆安）', effect: { money: 1500, morale: 10, barbarianRel: -20 } },
      { text: '驱逐而已（无大胜）', effect: { armyLoss: 1000 } }
    ]
  },
  // ---- 5) 陈霸先杀王僧辩（555年）----
  {
    id: 'v125_chen_baxian_shawang', name: '袭杀王僧辩', illustration: 'court',
    minTurn: 26, factions: ['nanchao'],
    condition: function(g) { return g.year >= 555 && g.faction === 'nanchao'; },
    description: '王僧辩受北齐兵威，迎贞阳侯萧渊明为帝。陈霸先耻之，自京口举兵，夜袭石头城，缢杀僧辩父子。废渊明，立晋安王。江南大权归霸先。',
    options: [
      { text: '诛僧辩，立敬帝（民心-5，全军忠诚+10）', effect: { morale: -5, generalLoyalty: { amt: 10 } } },
      { text: '与僧辩和（无大变）', effect: {} }
    ]
  },

  // ============================================================
  // V13.0 新增历史事件（4个，v13_ 前缀）
  // 1) 颍川之围（548-549）：王思政守颍川，东魏倾国围攻
  // 2) 巴陵之战（551）：王僧辩、陈霸先大破侯景于巴陵
  // 3) 河阴之变（528）：尔朱荣沉胡太后及百官于河阴
  // 4) 吕梁覆军（577-578）：吴明彻北伐败于北周王轨，陈锐卒尽丧
  // ============================================================

  // ---- 1) 颍川之围（548-549）----
  {
    id: 'v13_yingchuan_zhi_wei', name: '颍川之围', illustration: 'city_siege',
    minTurn: 28, factions: ['xiwei', 'dongwei'],
    condition: function(g) { return g.year >= 548; },
    description: '西魏将王思政守颍川，东魏高岳、慕容绍宗、刘丰生步骑十万围之。思政随机拒守，绍宗、丰生竟没于水。东魏复益兵，城陷，思政被俘，终不屈。',
    options: [
      { text: '死守孤城（守城buff两回合，民心+10）', effect: { garrisonBuff: true, factionMorale: 10 } },
      { text: '弃城北归（损兵3000，金-500）', effect: { armyLoss: 3000, money: -500 } }
    ]
  },
  // ---- 2) 巴陵之战（551）----
  {
    id: 'v13_baling_zhi_zhan', name: '巴陵之战', illustration: 'river_battle',
    minTurn: 24, factions: ['nanchao'],
    condition: function(g) { return g.year >= 551 && g.faction === 'nanchao'; },
    description: '侯景水陆围巴陵，王僧辩、陈霸先坚守。景军中大疫，死伤相枕。王琳、侯瑱自下游合击，景烧营夜遁。自此南朝复振，景势遂衰。',
    options: [
      { text: '水陆夹击，大破侯景（自动大战，民心+10）', effect: { massBattle: true, factionMorale: 10 } },
      { text: '婴城自守，不与争锋（军心+5，金-800）', effect: { armyMorale: 5, money: -800 } }
    ]
  },
  // ---- 3) 河阴之变（528）----
  {
    id: 'v13_heyin_zhi_bian', name: '河阴之变', illustration: 'heyin',
    minTurn: 20, factions: ['dongwei'],
    condition: function(g) { return g.year >= 528 && g.faction === 'dongwei'; },
    description: '尔朱荣入洛，沉胡太后及幼主于河阴，纵兵杀百官公卿二千余人。朝士为之一空，魏朝元从大族殄尽。荣遂专命，迁于晋阳。',
    options: [
      { text: '从荣定策，更立新主（全军忠诚-8，金+1000）', effect: { generalLoyalty: { amt: -8 }, money: 1000 } },
      { text: '抗争不从，称疾不朝（全军忠诚+5，民心-5）', effect: { generalLoyalty: { amt: 5 }, morale: -5 } }
    ]
  },
  // ---- 4) 吕梁覆军（577-578）----
  {
    id: 'v13_lvliang_fu_jun', name: '吕梁覆军', illustration: 'cavalry_charge',
    minTurn: 32, factions: ['nanchao', 'xiwei'],
    condition: function(g) { return g.year >= 577; },
    description: '陈将吴明彻北伐围彭城，周遣王轨轻兵断清口，陈水军退路绝。明彻以下皆为周所虏，三万锐卒尽丧。陈朝自此不复能争淮北。',
    options: [
      { text: '轻军深入，致有覆军之败（损兵5000，金-1500）', effect: { armyLoss: 5000, money: -1500 } },
      { text: '持重缓进，全师而还（军心-5，粮-1000）', effect: { armyMorale: -5, food: -1000 } }
    ]
  },

  // ============================================================
  // V14.0 新增历史事件（6个，v14_ 前缀）
  // ============================================================

  // ---- 1) 永嘉南渡（311年）----
  {
    id: 'v14_yongjia_nandu', name: '永嘉南渡', illustration: 'accession',
    minTurn: 2, faction: 'nanchao',
    description: '永嘉五年，匈奴刘聪陷洛阳，执晋怀帝，纵兵大掠，发掘陵墓，焚烧宫庙。中州士女避乱江左者十六七，衣冠南渡，自此中原陆沉，百年不复。',
    options: [
      { text: '收纳流民，厚抚遗黎（人口+10000，民心+10）', effect: { pop: 10000, factionMorale: 10 } },
      { text: '闭关自守，不纳流民（民心-10，金+500）', effect: { factionMorale: -10, money: 500 } }
    ]
  },
  // ---- 2) 刘裕灭南燕（409年）----
  {
    id: 'v14_liuyu_mie_nanyan', name: '刘裕灭南燕', illustration: 'cavalry_charge',
    minTurn: 3, faction: 'nanchao',
    description: '晋义熙五年，刘裕率大军伐南燕。越大岘，燕兵不出。裕举手指天，喜形于色。六月，临朐大战，燕师大败。遂围广固，明年城破，斩慕容超，南燕亡。',
    options: [
      { text: '越大岘深入，破广固（自动大战，金+1000）', effect: { massBattle: true, money: 1000 } },
      { text: '持重缓进，屯兵大岘（粮-1000，军心+3）', effect: { food: -1000, armyMorale: 3 } }
    ]
  },
  // ---- 3) 刘裕灭后秦（417年）----
  {
    id: 'v14_liuyu_mie_houqin', name: '刘裕灭后秦', illustration: 'cavalry_charge',
    minTurn: 5, faction: 'nanchao',
    description: '义熙十三年，刘裕再次北伐，水军自淮泗入清河，溯河西上。王镇恶、檀道济为前锋，所至皆下。遂入长安，后秦主姚泓降。关中克复，晋室百余年未有之盛。',
    options: [
      { text: '乘胜入关，修复山陵（自动大战，民心+15）', effect: { massBattle: true, factionMorale: 15 } },
      { text: '留兵戍守，南归建康（金+800，民心-5）', effect: { money: 800, factionMorale: -5 } }
    ]
  },
  // ---- 4) 滑台之败（430年）----
  {
    id: 'v14_huatai_zhibai', name: '滑台之败', illustration: 'fire_attack_event',
    minTurn: 6, factions: ['nanchao', 'dongwei'],
    description: '元嘉七年，到彦之北伐，不战而复河南四镇。冬，魏太武帝渡河反攻，彦之大惧，欲焚舟步走。王仲德固谏，不听。遂弃滑台，南走青冀，委弃荡尽，府藏为空虚。',
    options: [
      { text: '焚甲弃军，狼狈南奔（损兵3000，金-1000）', effect: { armyLoss: 3000, money: -1000 } },
      { text: '命将坚守，徐图后举（守城buff两回合，粮-800）', effect: { garrisonBuff: true, food: -800 } }
    ]
  },
  // ---- 5) 悬瓠之战（450年）----
  {
    id: 'v14_xuanhu_zhizhan', name: '悬瓠之战', illustration: 'city_siege',
    minTurn: 8, factions: ['nanchao', 'dongwei'],
    description: '元嘉二十七年，魏太武帝率十万众南攻悬瓠。任城人陈宪行郡事，城中战士不满千人。宪督厉将士，昼夜拒战，杀伤万计。魏尸与城等，竟不能克而还。',
    options: [
      { text: '全城死守，魏师自退（守城buff两回合，民心+12）', effect: { garrisonBuff: true, factionMorale: 12 } },
      { text: '出兵野战，与魏争锋（自动大战，损兵2000）', effect: { massBattle: true, armyLoss: 2000 } }
    ]
  },
  // ---- 6) 义嘉之难（466年）----
  {
    id: 'v14_yijia_zhinan', name: '义嘉之难', illustration: 'rebellion',
    minTurn: 10, faction: 'nanchao',
    description: '宋泰始二年，晋安王子勋在寻阳称帝，改元义嘉。四方回应，宋明帝仅保丹阳一郡。或劝明帝禅位，或劝明帝死战。建安王休仁督军拒战，竟大捷，杀子勋于寻阳。',
    options: [
      { text: '命将拒战，天下遂定（自动大战，金+1000）', effect: { massBattle: true, money: 1000 } },
      { text: '禅位寻阳，苟延岁月（民心-20，金-500）', effect: { factionMorale: -20, money: -500 } }
    ]
  },

  // ============================================================
  // V15.0 新增历史事件（5个，v15_ 前缀）—— 未收录之南北朝·隋初大事
  // ============================================================

  // ---- 1) 孝文汉化迁都（494年）----
  {
    id: 'v15_qiandu_luoyang', name: '孝文迁都', illustration: 'v15_qiandu_luoyang',
    minTurn: 2, factions: ['dongwei'],
    description: '北魏太和十七年，孝文帝拓跋宏以南伐为名，率群臣大军至洛阳。时霖雨不止，群臣稽颡于马前，请停南伐。帝乃许，遂定都洛阳。禁胡服胡语，改姓元氏，典章文物，一依汉制。',
    options: [
      { text: '力排众议，定都洛阳（文化+15，忠诚+5，金-800）', effect: { culture: 15, generalLoyalty: { amt: 5 }, money: -800 } },
      { text: '仍都平城，缓行汉化（文化+3，忠诚-4）', effect: { culture: 3, generalLoyalty: { amt: -4 } } }
    ]
  },
  // ---- 2) 梁武舍身同泰寺（529年）----
  {
    id: 'v15_sheshen_tongtai', name: '梁武舍身', illustration: 'v15_sheshen_tongtai',
    minTurn: 4, faction: 'nanchao',
    description: '梁武帝大通元年，幸同泰寺，设四部无遮大会，帝释御服，披法衣，行清净大舍，素床瓦器，乘小车，躬为大众开讲。群臣以钱一亿万奉赎皇帝菩萨，三请乃许。',
    options: [
      { text: '从容讲法，以结众缘（文化+12，金-600）', effect: { culture: 12, money: -600 } },
      { text: '还宫理政，罢无遮会（金+500，文化+2）', effect: { money: 500, culture: 2 } }
    ]
  },
  // ---- 3) 杨坚受禅代周（581年）----
  {
    id: 'v15_dai_zhou_jian_sui', name: '杨坚代周', illustration: 'v15_dai_zhou_jian_sui',
    minTurn: 3, factions: ['xiwei'],
    description: '大定元年，北周静帝幼冲，外戚杨坚总己以听。李德林、高颎密为帷幄，郑译、刘昉阴承其意。隋王杨坚乃受周禅，即皇帝位，改元开周。尽翦周室诸王，易太极而更乾坤。',
    options: [
      { text: '顺天应人，受禅建隋（全势力民心+12，金+1500）', effect: { factionMorale: 12, money: 1500 } },
      { text: '辅政称王，徐图禅代（忠诚+6，民心-4）', effect: { generalLoyalty: { amt: 6 }, factionMorale: -4 } }
    ]
  },
  // ---- 4) 隋军下江灭陈（588年）----
  {
    id: 'v15_bing_xia_jiangdu', name: '韩贺渡江', illustration: 'v15_bing_xia_jiangdu',
    minTurn: 8, factions: ['xiwei', 'nanchao'],
    description: '开皇八年，隋以晋王广为元帅，高颎长史，命杨素出永安，韩擒虎出庐江，贺若弼出广陵，大举伐陈。陈后主以"王气在此"，不为深备。隋师临江，贺若弼自广陵济，韩擒虎自横江济，东西趋建康。',
    options: [
      { text: '大举伐陈，一网江南（自动大战，金+2000）', effect: { massBattle: true, money: 2000 } },
      { text: '陈备江防，固国金陵（守城buff两回合，粮-1000）', effect: { garrisonBuff: true, food: -1000 } }
    ]
  },
  // ---- 5) 隋初北击突厥（583年）----
  {
    id: 'v15_tujue_nanxia', name: '隋御突厥', illustration: 'v15_tujue_nanxia',
    minTurn: 6, factions: ['xiwei', 'dongwei'],
    description: '开皇三年，突厥沙钵略可汗悉众入塞，武威、天水六畜咸尽。隋命杨爽出朔州，窦荣定出凉州，分道北伐。达奚长儒以二千众遇敌十万于周盘，力战三昼夜，突厥乃退。',
    options: [
      { text: '出师塞外，耀兵河朔（自动大战，损兵1500，金+1000）', effect: { massBattle: true, armyLoss: 1500, money: 1000 } },
      { text: '修塞上城堡，坚壁清野（守城buff两回合，金-500）', effect: { garrisonBuff: true, money: -500 } }
    ]
  },

  // ============================================================
  // V16.0 新增历史事件（5个，v16_ 前缀）—— 隋末大乱群雄并起
  // ============================================================

  // ---- 1) 王薄长白山首义（611年）----
  {
    id: 'v16_wangbo_shouyi', name: '王薄首义', illustration: 'peasant_revolt',
    minTurn: 15, factions: ['xiwei'],
    description: '大业七年，炀帝征高丽，天下骚动。齐人王薄聚众长白山，自称知世郎，作《无向辽东浪死歌》，避征役者多往归之。山东郡县不能制，天下遂乱。',
    options: [
      { text: '发兵讨捕，以靖东土（自动大战，损兵1200，金+800）', effect: { massBattle: true, armyLoss: 1200, money: 800 } },
      { text: '下诏停征，安抚流民（民心+8，金-400）', effect: { factionMorale: 8, money: -400 } }
    ]
  },
  // ---- 2) 杨玄感黎阳之叛（613年）----
  {
    id: 'v16_yangxuangan_zhiluan', name: '玄感黎阳', illustration: 'rebellion',
    minTurn: 17, factions: ['xiwei'],
    description: '大业九年，炀帝再征高丽。礼部尚书杨玄感于黎阳督运，遂与蒲山公李密谋，叛于河北，进逼东都。从者十万，天下响应。炀帝惧，密召诸军还。',
    options: [
      { text: '召诸军还，急击叛者（自动大战，损兵2000，金-800）', effect: { massBattle: true, armyLoss: 2000, money: -800 } },
      { text: '下诏赦其诖误，以散其党（忠诚+5，民心+5）', effect: { generalLoyalty: { amt: 5 }, factionMorale: 5 } }
    ]
  },
  // ---- 3) 李密瓦岗据洛口（617年）----
  {
    id: 'v16_limi_wagang', name: '李密瓦岗', illustration: 'peasant_revolt',
    minTurn: 21, factions: ['xiwei'],
    description: '大业十三年，李密说瓦岗翟让，袭破金堤关，荥阳太守死之。密又设伏击斩张须陀于大海寺，河南郡县震恐。让乃推密为主，号魏公，开洛口仓，散米以赈贫民，徒众数十万。',
    options: [
      { text: '大发关东兵，讨李密（自动大战，损兵2500，金-1000）', effect: { massBattle: true, armyLoss: 2500, money: -1000 } },
      { text: '内修政事，外遣间离（忠诚+6，金+500）', effect: { generalLoyalty: { amt: 6 }, money: 500 } }
    ]
  },
  // ---- 4) 窦建德河北称夏（618年）----
  {
    id: 'v16_jiande_hebei', name: '建德夏王', illustration: 'rebellion',
    minTurn: 22, factions: ['xiwei', 'dongwei'],
    description: '大业十四年，窦建德据河北，建都乐寿，自称长乐王，国号夏。化及弑炀帝于江都，建德为隋帝发丧，改元五凤。其署置百官，颇有文帝遗风，河北州县多陷。',
    options: [
      { text: '出师河北，讨平僭伪（自动大战，损兵2000，金+1500）', effect: { massBattle: true, armyLoss: 2000, money: 1500 } },
      { text: '遣使招抚，许以王爵（蛮族关系-5，金+800）', effect: { barbarianRel: -5, money: 800 } }
    ]
  },
  // ---- 5) 杜伏威江淮纵横（613年）----
  {
    id: 'v16_fuwei_jianghuai', name: '伏威江淮', illustration: 'rebellion',
    minTurn: 17, factions: ['nanchao'],
    description: '大业九年，章丘杜伏威与辅公祏亡命，聚众为盗，转掠淮南。伏威敢出敢死，每战辄冠，众推为帅。隋遣宋颢讨之，反为所败。遂破高邮，据历阳，江淮间群盗争附之。',
    options: [
      { text: '发兵渡江，讨平群盗（自动大战，损兵1500，金+1000）', effect: { massBattle: true, armyLoss: 1500, money: 1000 } },
      { text: '招抚之，署为总管（招募一将，金-300）', effect: { recruitRandom: true, money: -300 } }
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

// ---------- V8.0 科举系统 ----------
// 历史背景：南北朝后期九品中正制衰落，科举萌芽。南朝已有射策、明经等科，
// 北齐允许士子"怀牒自试"，北周苏绰废门荫以贤愚定高下。隋文帝废九品中正，
// 隋炀帝始建进士科。游戏中还原这一制度萌芽期。
// 科举周期：每3回合（春季）举行一次；太学≥3级解锁。
export const EXAM_INTERVAL = 3;            // 每3回合一次科举
export const EXAM_BUILDING_REQ = 'taixue'; // 太学≥3级解锁
export const EXAM_BUILDING_MIN_LEVEL = 3;

// 科举科目：
//  明经科：考儒家经典，重政治/智力，选拔文臣
//  进士科：考诗赋策论，综合选拔人才
//  武举科：考武艺兵法，重统帅/武力，选拔武将
export const EXAM_SUBJECTS = {
  mingjing: {
    id: 'mingjing', name: '明经科', icon: '📖',
    description: '考儒家经典章句，重政治、智力，选拔文臣。',
    scoreWeights: { politics: 0.35, intel: 0.30, command: 0.20, force: 0.15 }
  },
  jinshi: {
    id: 'jinshi', name: '进士科', icon: '✍️',
    description: '考诗赋策论，综合选拔，重智力与政治。',
    scoreWeights: { politics: 0.25, intel: 0.35, command: 0.20, force: 0.20 }
  },
  wuju: {
    id: 'wuju', name: '武举科', icon: '⚔️',
    description: '考武艺兵法，重统帅、武力，选拔武将。',
    scoreWeights: { politics: 0.10, intel: 0.20, command: 0.35, force: 0.35 }
  }
};

// 科举名次奖励
export const EXAM_HONORS = {
  zhuangyuan: { rank: '状元', attrBonus: 5, loyaltyBonus: 20, title: '状元' },
  bangyan:    { rank: '榜眼', attrBonus: 3, loyaltyBonus: 15, title: '榜眼' },
  tanhua:     { rank: '探花', attrBonus: 2, loyaltyBonus: 10, title: '探花' },
  jinshi:     { rank: '进士', attrBonus: 0, loyaltyBonus: 0, title: null }
};

// ---------- V8.0 赋税系统 ----------
// 历史背景：南北朝赋税制度复杂，曹魏租调制→北魏均田制→隋唐租庸调制。
// 赋税轻重直接影响民心、人口与叛乱。5级赋税可调节，调整有3回合冷却。
// taxLevel: 1=轻徭薄赋 2=正常 3=稍重 4=沉重 5=苛捐杂税
export const TAX_LEVELS = [
  { level: 1, name: '轻徭薄赋', multiplier: 0.70, moraleDelta: 5,  popMult: 0.20, rebellionMod: 0,    desc: '轻徭薄赋：收入-30%，民心+5/回合，人口+20%' },
  { level: 2, name: '正常赋税', multiplier: 1.00, moraleDelta: 0,  popMult: 0.00, rebellionMod: 0,    desc: '正常赋税：收入100%，民心不变' },
  { level: 3, name: '稍重赋税', multiplier: 1.20, moraleDelta: -2, popMult: 0.00, rebellionMod: 0.1,  desc: '稍重赋税：收入+20%，民心-2/回合' },
  { level: 4, name: '沉重赋税', multiplier: 1.40, moraleDelta: -5, popMult: -0.20, rebellionMod: 0.3,  desc: '沉重赋税：收入+40%，民心-5/回合，人口-20%' },
  { level: 5, name: '苛捐杂税', multiplier: 1.60, moraleDelta: -10, popMult: -0.40, rebellionMod: 0.8,  desc: '苛捐杂税：收入+60%，民心-10/回合，人口-40%，叛乱频发' }
];
export const TAX_ADJUST_COOLDOWN = 3; // 赋税调整冷却回合数

// ---------- V8.0 徭役系统 ----------
// 历史背景：南北朝徭役繁重，成年男子每年服役二十日。徭役可加速营建，
// 但过度征发导致民心下降、人口流失甚至起义。将作监≥3级解锁徭役管理。
export const CORVEE_BUILDING_REQ = 'jiangzuojian'; // 将作监≥3级
export const CORVEE_BUILDING_MIN_LEVEL = 3;
export const CORVEE_DURATION = 3;       // 徭役持续3回合
export const CORVEE_MORALE_COST = 3;   // 每回合民心-3
export const CORVEE_POP_COST = 0.01;   // 征发时人口-1%

export const CORVEE_TYPES = {
  build: {
    id: 'build', name: '建造徭役', icon: '🏗️',
    description: '征发民夫加速建筑建造（建造时间-50%）。',
    effect: { buildSpeedMult: 0.5 }
  },
  defense: {
    id: 'defense', name: '城防徭役', icon: '🧱',
    description: '征发民夫修缮城防（每回合防御+10）。',
    effect: { defensePerTurn: 10 }
  },
  water: {
    id: 'water', name: '水利徭役', icon: '🌊',
    description: '兴修水利（每回合农业+5，粮食+10%）。',
    effect: { agriPerTurn: 5, foodMult: 0.10 }
  },
  transport: {
    id: 'transport', name: '运输徭役', icon: '🐂',
    description: '征发民夫运输补给（军队粮草消耗-20%）。',
    effect: { supplyMult: -0.20 }
  }
};

// ============================================================
// V8.5 历法节气系统
// ------------------------------------------------------------
// 历史背景：二十四节气至《淮南子·天文训》（西汉）已完整定型，
// 南北朝沿用太初/景初之法，太史令掌天文历法。正史《宋书·天文志》
// 《魏书·天象志》《隋书·天文志》大量记载日食、月犯、荧惑守心、彗星、
// 流星等异象，占辞多「王者恶之」「除旧布新」「大人易政」。
// 设计：每回合（=游戏一年）细分为 4 季×6 节气 = 24 节气循环；
//   节气效果在 settleTurn 结算时统一应用到玩家势力；
//   天文异象每回合按概率触发，叠加惩罚并推送特殊事件。
// ============================================================

// 二十四节气（每季 6 个），与 SEASONS 四季一一对应
export const SOLAR_TERMS = [
  // 春
  { id: 'lichun',    name: '立春', season: 0, icon: '🌱', desc: '东风解冻，蛰虫始振。阳气初回，万物滋萌。',
    effect: { moraleFlat: 2, recruitBonus: 0.05 } },
  { id: 'yushui',    name: '雨水', season: 0, icon: '🌧', desc: '冰雪皆散而为水，化而为雨。',
    effect: { agriFlat: 2 } },
  { id: 'jingzhe',   name: '惊蛰', season: 0, icon: '🐛', desc: '桃始华，仓庚鸣，蛰虫惊而出走。',
    effect: {} },
  { id: 'chunfen',   name: '春分', season: 0, icon: '🌗', desc: '阴阳相半，昼夜均而寒暑平。',
    effect: { techFlat: 3, cultureFlat: 5 } },
  { id: 'qingming',  name: '清明', season: 0, icon: '🍃', desc: '气清景明，万物皆显。祭祖扫墓，慎终追远。',
    effect: { cultureFlat: 10, eventChanceBonus: 0.08 }, special: 'qingming' },
  { id: 'guyu',      name: '谷雨', season: 0, icon: '🌾', desc: '雨生百谷，萍始生，鸣鸠拂羽。',
    effect: { foodMult: 0.05 } },
  // 夏
  { id: 'lixia',     name: '立夏', season: 1, icon: '🌿', desc: '蝼蝈鸣，蚯蚓出，王瓜生。',
    effect: {} },
  { id: 'xiaoman',   name: '小满', season: 1, icon: '🌾', desc: '麦秋至，蚕事毕，小得盈满。',
    effect: { foodMult: 0.05 } },
  { id: 'mangzhong', name: '芒种', season: 1, icon: '🌾', desc: '螳螂生，鵙始鸣，有芒可种。',
    effect: { agriFlat: 3 } },
  { id: 'xiazhi',    name: '夏至', season: 1, icon: '☀', desc: '日长之至，日影短至，鹿角解。',
    effect: { agriMult: 0.05, foodMult: 0.08 } },
  { id: 'xiaoshu',   name: '小暑', season: 1, icon: '🌡', desc: '温风至，蟋蟀居壁，鹰始挚。',
    effect: {} },
  { id: 'dashu',     name: '大暑', season: 1, icon: '🔥', desc: '湿热如蒸，腐草为萤，土润溽暑。',
    effect: { moraleFlat: -1 } },
  // 秋
  { id: 'liqiu',     name: '立秋', season: 2, icon: '🍂', desc: '凉风至，白露降，寒蝉鸣。',
    effect: { milFlat: 3, recruitBonus: 0.05 } },
  { id: 'chushu',    name: '处暑', season: 2, icon: '🌾', desc: '鹰乃祭鸟，天地始肃，暑气止。',
    effect: {} },
  { id: 'bailu',     name: '白露', season: 2, icon: '💧', desc: '鸿雁来，玄鸟归，群鸟养羞。',
    effect: {} },
  { id: 'qiufen',    name: '秋分', season: 2, icon: '🌓', desc: '昼夜均，寒暑平，蛰虫坯户。',
    effect: { commFlat: 5, moneyMult: 0.05 } },
  { id: 'hanlu',     name: '寒露', season: 2, icon: '❄', desc: '鸿雁来宾，雀入大水为蛤。',
    effect: {} },
  { id: 'shuangjiang',name: '霜降', season: 2, icon: '🧊', desc: '豺乃祭兽，草木黄落，蛰虫咸俯。',
    effect: { agriFlat: -2 } },
  // 冬
  { id: 'lidong',    name: '立冬', season: 3, icon: '❄', desc: '水始冰，地始冻，雉入大水为蜃。',
    effect: {} },
  { id: 'xiaoxue',   name: '小雪', season: 3, icon: '🌨', desc: '虹藏不见，天气上升，闭塞成冬。',
    effect: {} },
  { id: 'daxue',     name: '大雪', season: 3, icon: '⛄', desc: '鹖鴠不鸣，虎始交，荔挺出。',
    effect: {} },
  { id: 'dongzhi',   name: '冬至', season: 3, icon: '🕎', desc: '日南至，日影长至，一阳始生。祭天。',
    effect: { moraleFlat: 5, legitFlat: 2 }, special: 'dongzhi' },
  { id: 'xiaohan',   name: '小寒', season: 3, icon: '🥶', desc: '雁北乡，鹊始巢，雉雊。',
    effect: { moraleFlat: -1 } },
  { id: 'dahan',     name: '大寒', season: 3, icon: '🧊', desc: '鸡始乳，征鸟厉疾，水泽腹坚。',
    effect: { moraleFlat: -2, milFlat: -2 } }
];

// 天文异象（每回合概率触发）
export const CELESTIAL_ANOMALIES = [
  { id: 'solar_eclipse', name: '日食', icon: '🌑', weight: 25,
    desc: '日有食之，阴侵阳，君道有亏。太史令奏：「国有大忧，君其修德」。',
    effect: { moraleFlat: -5, legitFlat: -3 }, eventId: 'anomaly_solar_eclipse' },
  { id: 'lunar_eclipse', name: '月食', icon: '🌕', weight: 20,
    desc: '月当望而食，兵阴之象。太史令占曰：「将有外侮，警备边亭」。',
    effect: { milFlat: -3 }, eventId: 'anomaly_lunar_eclipse' },
  { id: 'comet', name: '彗星', icon: '☄', weight: 15,
    desc: '彗星见，长竟天。《星传》曰：「彗所以除旧布新也」。天下将革。',
    effect: { polFlat: -5 }, eventId: 'anomaly_comet' },
  { id: 'meteor_shower', name: '流星', icon: '☄', weight: 15,
    desc: '流星大如桃，出紫宫，或五三相续。占曰：「有异人星象」。',
    effect: { intelFlat: 3 }, eventId: 'anomaly_meteor' },
  { id: 'yinghuo_shouxing', name: '荧惑守心', icon: '🔴', weight: 10,
    desc: '荧惑守心，王者恶之！占曰：「大人易政，主去其宫，天下兵革」。',
    effect: { cmdFlat: -5 }, eventId: 'anomaly_yinghuo' }
];

// 天文异象每回合触发基础概率
export const ANOMALY_BASE_CHANCE = 0.05;

// ============================================================
// V8.5 后宫 / 皇室系统
// ------------------------------------------------------------
// 历史背景：晋武采汉魏之制，三夫人（贵嫔/夫人/贵人）位视三公，
//   九嫔（淑妃/淑媛/淑仪/修华/修容/修仪/婕妤/容华/充华）位视九卿，
//   余有美人、才人、中才人。北魏孝文改定内官：左右昭仪、三夫人、
//   三嫔、六嫔、世妇、御女。南北朝选后极重门第，政治联姻频繁；
//   立子以嫡，太子承统，皇女出降以结好邻国。
// ============================================================
export const HAREM_RANKS = [
  { id: 'empress',   name: '皇后', max: 1,  legit: 5, morale: 3, birthChance: 0.18 },
  { id: 'guifei',    name: '贵妃', max: 2,  legit: 3, morale: 2, birthChance: 0.12 },
  { id: 'fei',       name: '妃',   max: 4,  legit: 2, morale: 1, birthChance: 0.08 },
  { id: 'pin',       name: '嫔',   max: 6,  legit: 1, morale: 0, birthChance: 0.05 },
  { id: 'meiren',    name: '美人', max: 99, legit: 0, morale: 0, birthChance: 0.03 }
];

// 新选妃嫔姓名池（按势力取向取用，避免重名）
export const HAREM_NAME_POOL = [
  '张丽华', '孔贵嫔', '龚贵嫔', '沈婺华', '王皇后', '冯小怜', '穆黄花',
  '胡妃', '元氏', '尉迟繁炽', '陈月仪', '元乐尚', '孙氏', '赵氏',
  '李氏', '崔氏', '卢氏', '郑氏', '王氏', '谢氏', '袁氏', '萧氏'
];

// 后宫系统常量
export const HAREM_BIRTH_BASE = 0.04;        // 基础生育概率（每回合）
export const HAREM_CHARM_BONUS = 0.02;       // 君主魅力(四维均值)每10点 +2% 生育
export const HAREM_PRINCE_AGE_ADULT = 15;    // 皇子成年年龄（可立太子）
export const HAREM_MARRY_PRINCESS_MIN_AGE = 12; // 皇女可联姻年龄

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

// ============================================================
// V11.0 — 平衡性调优常量 & 性能优化开关
// ============================================================
// 参考：canvas game performance optimization 最佳实践：
//   1. 视口裁剪（viewport culling）：仅绘制可见范围内的实体
//   2. 静态层缓存（offscreen canvas）：不变内容离屏缓存
//   3. 对象池（object pool）：粒子复用避免 GC 压力
//   4. AI 决策缓存：相同状态不重复计算
//   5. 存档压缩：LZ77 压缩 JSON 减小存储
// ------------------------------------------------------------

// 平衡性调优（V11.0）
export const V11_BALANCE = {
  // 战斗平衡：兵种克制加成微调（原 0.25 → 0.28，增强克制感）
  counterBonus: 0.28,
  // 阵型克制加成（原 0.20 → 0.22）
  formationCounterBonus: 0.22,
  // 经济平衡：基础税率上限调整（原 50% → 45%，防止过度剥削）
  maxTaxRate: 45,
  // 城市收入公式微调（人口系数 0.1 → 0.08，防止后期收入爆炸）
  incomePopFactor: 0.08,
  // 科技平衡：研究费用系数（原 1.0 → 0.9，降低后期科技成本）
  techCostMult: 0.9,
  // 武将平衡：忠诚自然衰减速率（原 0.5/回合 → 0.3/回合）
  loyaltyDecayRate: 0.3,
  // AI 平衡：进攻阈值（原 0.3 → 0.35，AI 更谨慎）
  aiAttackThreshold: 0.35,
  // AI 防御策略权重（原 0.6 → 0.65，AI 更倾向守城）
  aiDefenseWeight: 0.65,
  // 事件平衡：随机事件基础触发概率（原 0.15 → 0.12）
  eventBaseProbability: 0.12,
  // 难度平衡：困难模式 AI 资源倍率（原 1.5 → 1.4）
  hardModeResourceMult: 1.4,
  // 难度平衡：简单模式 AI 资源倍率（原 0.7 → 0.8）
  easyModeResourceMult: 0.8
};

// 性能优化开关（V11.0）
export const V11_PERFORMANCE = {
  // 视口裁剪边距（像素）
  viewportMargin: 150,
  // 粒子系统最大粒子数（原 150 → 200，对象池上限）
  maxParticles: 200,
  // AI 决策缓存有效期（回合数）
  aiCacheRounds: 3,
  // 地图静态层自动刷新间隔（毫秒，0=手动）
  staticLayerRefreshMs: 0,
  // 图片懒加载阈值（像素，距离视口多远开始加载）
  lazyLoadThreshold: 200,
  // 存档压缩开关（LZ77）
  saveCompression: true
};

// ============================================================
// V13.0 — 平衡性调优常量（在 V11_BALANCE 基础上微调）
// ============================================================
// 调优思路：
//   1) 兵种克制：原 0.28 → 0.30，进一步放大兵种配阵的战术价值，
//      弥补后期兵力堆砌导致的战术稀释；
//   2) AI 进攻阈值：原 0.35 → 0.32，让 AI 在优势时更敢出击，
//      避免后期 AI 龟缩、玩家围城无压力；
//   3) AI 防御权重：原 0.65 → 0.60，与进攻阈值联动，攻守更均衡；
//   4) 随机事件触发概率：原 0.12 → 0.14，V13 新增 15 个事件，
//      提高触发频次以让新内容被玩家感知；
//   5) 忠诚自然衰减：原 0.3/回合 → 0.25/回合，
//      配合 V13 新武将多为中途来投，避免初期忠诚过低频繁叛逃；
//   6) 税率上限：维持 V11 的 45%，但补充税率每超 35% 的民心衰减系数；
//   7) 经济：收入人口系数维持 0.08，但补充荒年（冬）粮耗系数；
//   8) 难度：困难 AI 资源倍率维持 1.4，简单模式下调至 0.75 降低新手门槛。
// 注意：本常量仅作为数值配置集中声明，实际读取由 game.js/ai.js/tax.js 决定；
//       若旧代码未读取某字段，则该字段暂不生效，仅作文档与后续接线用。
// ------------------------------------------------------------
export const V13_BALANCE = {
  // 兵种克制加成（V11=0.28 → V13=0.30，战术放大）
  counterBonus: 0.30,
  // 阵型克制加成（V11=0.22 维持）
  formationCounterBonus: 0.22,
  // AI 进攻阈值（V11=0.35 → V13=0.32，AI 更敢打）
  aiAttackThreshold: 0.32,
  // AI 防御权重（V11=0.65 → V13=0.60，攻守平衡）
  aiDefenseWeight: 0.60,
  // 随机事件基础触发概率（V11=0.12 → V13=0.14，新事件更多曝光）
  eventBaseProbability: 0.14,
  // 忠诚自然衰减速率（V11=0.3 → V13=0.25，减少新将叛逃）
  loyaltyDecayRate: 0.25,
  // 基础税率上限（维持 V11=45%，防止过度剥削）
  maxTaxRate: 45,
  // 税率超过 35% 后每 1% 的民心衰减（新增，用于 tax.js 接线）
  taxOverThresholdMoraleDecay: 0.08,
  // 城市收入人口系数（维持 V11=0.08）
  incomePopFactor: 0.08,
  // 冬季粮草消耗系数（SEASON_FOOD_MULT 冬=0.7 基础上，额外损耗）
  winterFoodWaste: 0.05,
  // 科技研究费用系数（维持 V11=0.9）
  techCostMult: 0.9,
  // 困难模式 AI 资源倍率（维持 V11=1.4）
  hardModeResourceMult: 1.4,
  // 简单模式 AI 资源倍率（V11=0.8 → V13=0.75，降低新手门槛）
  easyModeResourceMult: 0.75
};

// ============================================================
// V14.0 — 平衡性调优常量（在 V13_BALANCE 基础上微调）
// ============================================================
// 调优思路：
//   1) 新城市加入后经济平衡：新增12城（60→72），城市总数+20%。
//      为防止经济膨胀，将收入人口系数从 V13=0.08 微降至 0.075，
//      抵消新城带来的额外税基；
//   2) 武将数量增大后招募/忠诚平衡：新增18将（111→129），在野武将池扩大。
//      将忠诚自然衰减从 V13=0.25 微降至 0.22，避免新招募在野将频繁叛逃；
//   3) 战斗数值微调：兵种克制加成从 V13=0.30 微调至 0.28，
//      因武将总数增多、名将密度上升，适当降低克制以避免一击必杀；
//   4) 随机事件触发概率：V13=0.14 → V14=0.15，新增25个事件（272→297），
//      提高触发频次让新内容被玩家感知；
//   5) AI 平衡：进攻阈值从 V13=0.32 微调至 0.34，
//      城市增多后 AI 需要更多决策路径，略增谨慎度；
//   6) 税率上限维持 V13=45%，但补充低税率红利系数，鼓励轻徭薄赋；
//   7) 难度：困难 AI 资源倍率维持 1.4，简单模式从 0.75 降至 0.7，
//      配合内容量增大降低新手压力。
// 注意：本常量仅作为数值配置集中声明，实际读取由 game.js/ai.js/tax.js 决定。
// ------------------------------------------------------------
export const V14_BALANCE = {
  // 兵种克制加成（V13=0.30 → V14=0.28，名将密度上升后略降克制）
  counterBonus: 0.28,
  // 阵型克制加成（维持 V13=0.22）
  formationCounterBonus: 0.22,
  // AI 进攻阈值（V13=0.32 → V14=0.34，城市增多后 AI 略增谨慎）
  aiAttackThreshold: 0.34,
  // AI 防御权重（维持 V13=0.60）
  aiDefenseWeight: 0.60,
  // 随机事件基础触发概率（V13=0.14 → V14=0.15，新事件更多曝光）
  eventBaseProbability: 0.15,
  // 忠诚自然衰减速率（V13=0.25 → V14=0.22，在野将池扩大后减少叛逃）
  loyaltyDecayRate: 0.22,
  // 基础税率上限（维持 V13=45%）
  maxTaxRate: 45,
  // 税率超过 35% 后每 1% 的民心衰减（维持 V13=0.08）
  taxOverThresholdMoraleDecay: 0.08,
  // 税率低于 20% 时每 1% 的民心增益（新增，鼓励轻徭薄赋）
  taxUnderThresholdMoraleBonus: 0.05,
  // 城市收入人口系数（V13=0.08 → V14=0.075，新城增多后略降防膨胀）
  incomePopFactor: 0.075,
  // 冬季粮草消耗系数（维持 V13=0.05）
  winterFoodWaste: 0.05,
  // 科技研究费用系数（维持 V13=0.9）
  techCostMult: 0.9,
  // 困难模式 AI 资源倍率（维持 V13=1.4）
  hardModeResourceMult: 1.4,
  // 简单模式 AI 资源倍率（V13=0.75 → V14=0.7，内容量增大后降低新手压力）
  easyModeResourceMult: 0.7,
  // 新将招募费用折扣（新增，在野将池扩大后降低招募成本）
  recruitCostDiscount: 0.15,
  // 城市维护费系数（新增，新城增多后防止维护费爆炸）
  cityUpkeepFactor: 0.95
};

// ============================================================
// V15.0 — 平衡性调优常量（在 V14_BALANCE 基础上微调）
// ============================================================
// 调优思路：
//   1) 内容量继续增大：新增15将（129→144）、20随机事件（297→317）、
//      5历史事件（102→107）、1剧本（26→27）。内容密度上升，需防数值通胀；
//   2) 武将名将密度再升：克制加成从 V14=0.28 微降至 0.27，避免名将一击破阵；
//   3) 随机事件从 297→317，事件池变大，基础触发概率从 V14=0.15 微升至 0.16，
//      保证新事件被玩家触达的频次不下降；
//   4) 在野将池进一步扩大（129→144），忠诚自然衰减维持 V14=0.22 不变，
//      招募折扣维持 0.15；但补充新将初始忠诚下限，减少招募即叛逃；
//   5) AI 进攻阈值从 V14=0.34 微升至 0.35，事件/将更多、变量更复杂，AI 略增谨慎；
//   6) 收入人口系数维持 V14=0.075，配合城市无新增，避免经济膨胀；
//   7) 简单模式 AI 资源倍率从 V14=0.70 降至 0.68，进一步降低内容量增大后的新手压力；
//   8) 税率上限维持 V14=45%，低税率红利系数维持 0.05。
// 注意：本常量仅作为数值配置集中声明，实际读取由 game.js/ai.js/tax.js 决定。
// ------------------------------------------------------------
export const V15_BALANCE = {
  // 兵种克制加成（V14=0.28 → V15=0.27，名将密度再升后略降克制）
  counterBonus: 0.27,
  // 阵型克制加成（维持 V14=0.22）
  formationCounterBonus: 0.22,
  // AI 进攻阈值（V14=0.34 → V15=0.35，事件武将更多后 AI 略增谨慎）
  aiAttackThreshold: 0.35,
  // AI 防御权重（维持 V14=0.60）
  aiDefenseWeight: 0.60,
  // 随机事件基础触发概率（V14=0.15 → V15=0.16，事件池扩大后略升触达）
  eventBaseProbability: 0.16,
  // 忠诚自然衰减速率（维持 V14=0.22）
  loyaltyDecayRate: 0.22,
  // 新招募武将初始忠诚下限（新增，在野将池扩大后减少招募即叛逃）
  recruitInitialLoyalty: 68,
  // 基础税率上限（维持 V14=45%）
  maxTaxRate: 45,
  // 税率超过 35% 后每 1% 的民心衰减（维持 V14=0.08）
  taxOverThresholdMoraleDecay: 0.08,
  // 税率低于 20% 时每 1% 的民心增益（维持 V14=0.05）
  taxUnderThresholdMoraleBonus: 0.05,
  // 城市收入人口系数（维持 V14=0.075）
  incomePopFactor: 0.075,
  // 冬季粮草消耗系数（维持 V14=0.05）
  winterFoodWaste: 0.05,
  // 科技研究费用系数（维持 V14=0.9）
  techCostMult: 0.9,
  // 困难模式 AI 资源倍率（维持 V14=1.4）
  hardModeResourceMult: 1.4,
  // 简单模式 AI 资源倍率（V14=0.70 → V15=0.68，内容更多后降低新手压力）
  easyModeResourceMult: 0.68,
  // 新将招募费用折扣（维持 V14=0.15）
  recruitCostDiscount: 0.15,
  // 城市维护费系数（维持 V14=0.95）
  cityUpkeepFactor: 0.95
};

// ============================================================
// V16.0 — 战役模式（CAMPAIGN_SCENARIOS）
// ============================================================
// 5 个独立战役关卡，每关为线性小沙盘：
//   - id / name / description / year
//   - objective: 胜利条件描述
//   - defeatCondition: 失败条件描述
//   - startingState: { troops, money, food, generals: [ids] }
//   - reward: 通关奖励 { money, food, generalId? }
//   - mapSetup: 城市配置 [{ id, owner, garrison, isObjective? }]
// illustration: 战役主插画（assets/campaigns/<id>.png）
// 历史参考：《宋书》《梁书》《周书》《隋书》
// ------------------------------------------------------------
export const CAMPAIGN_SCENARIOS = [
  // ---- 战役1：刘裕北伐（409年）—— 灭南燕 ----
  {
    id: 'v16_liuyu_beifa',
    name: '刘裕北伐',
    description: '东晋义熙五年（409），刘裕抗表北伐南燕。大军自淮入泗，越大岘。燕主慕容超不据大岘之险，纵敌入平地。刘裕以车四千乘为两翼，徐行而进，临朐以南，燕骑大至。裕命檀韶潜师克临朐，超单骑走。遂围广固，明年正月，克之，斩慕容超，尽复青齐之地。',
    year: 409,
    illustration: 'v16_liuyu_beifa',
    objective: '在 20 回合内攻克广固（南燕都城），俘获慕容超。',
    defeatCondition: '我方主力被歼灭，或广固城外粮草耗尽（food < 0）。',
    startingState: {
      troops: 24000,
      money: 3000,
      food: 6000,
      generals: ['tan_daoji', 'zhu_lingshi', 'shen_linzi', 'shen_tianzi']
    },
    reward: { money: 5000, food: 8000 },
    mapSetup: [
      { id: 'pengcheng',  owner: 'player', garrison: 8000,  isBase: true,  name: '彭城（我军基地）' },
      { id: 'xuzhou',     owner: 'player', garrison: 4000,  name: '徐州（后路）' },
      { id: 'qingzhou',   owner: 'enemy',  garrison: 6000,  name: '青州' },
      { id: 'guanggu',     owner: 'enemy',  garrison: 12000, isObjective: true, name: '广固（南燕都城）' }
    ]
  },
  // ---- 战役2：钟离大捷（507年）—— 梁军保卫钟离 ----
  {
    id: 'v16_zhongli_dajie',
    name: '钟离大捷',
    description: '梁天监六年（507），魏中山王元英、平东将军杨大眼率数十万众围钟离。梁将昌义之守城，众才三千。梁武帝命韦睿、曹景宗赴救。睿自合肥径道阴陵，旬日至邵阳，夜筑城于城上，魏军大惊。景宗募勇士潜岸，置邵阳洲。睿以火舰焚魏桥，风猛火烈，魏兵大溃，魏军趋水死者十余万，斩首亦如之。',
    year: 507,
    illustration: 'v16_zhongli_dajie',
    objective: '守住钟离 15 回合，并烧毁魏军邵阳桥砦，击退元英主力。',
    defeatCondition: '钟离被攻破（昌义之战死），或援军被全歼。',
    startingState: {
      troops: 18000,
      money: 2000,
      food: 4000,
      generals: ['wei_rui', 'cao_jingzong', 'v14_chang_yizhi']
    },
    reward: { money: 4000, food: 6000 },
    mapSetup: [
      { id: 'zhongli',     owner: 'player', garrison: 3000,  isBase: true,  name: '钟离（昌义之固守）' },
      { id: 'shaoyang_zhou', owner: 'enemy', garrison: 15000, isObjective: true, name: '邵阳洲（魏军桥砦）' },
      { id: 'hefei',       owner: 'player', garrison: 5000,  name: '合肥（韦睿进军处）' },
      { id: 'shouyang',    owner: 'enemy',  garrison: 8000,  name: '寿阳（魏军后军）' }
    ]
  },
  // ---- 战役3：玉璧保卫战（546年）—— 韦孝宽守玉璧 ----
  {
    id: 'v16_yubi_baowei',
    name: '玉璧保卫战',
    description: '西魏大统十二年（546），东魏高欢倾山东之众，志以西魏玉璧一戍。西魏韦孝宽随机拒守，城外尽攻凿之术，城中尽御备之方。欢乃于城南凿十道，又于城北筑山，昼夜攻围六旬。城中死伤十四五，孝宽意气自若。城中无水，汲于汾，欢使移汾水，一夕而毕。又攻以冲车，孝宽以布幔随向分之，车不能坏。欢智力俱困，因而发疾，次年正月卒于邺。玉璧之守，遂为南北守城战之冠。',
    year: 546,
    illustration: 'v16_yubi_baowei',
    objective: '在玉璧坚守 30 回合，使高欢攻城失败。',
    defeatCondition: '玉璧城被攻破，或韦孝宽被俘。',
    startingState: {
      troops: 8000,
      money: 1500,
      food: 3000,
      generals: ['wei_xiaokuan']
    },
    reward: { money: 3000, food: 4000 },
    mapSetup: [
      { id: 'yubi',        owner: 'player', garrison: 8000, isBase: true, isObjective: true, name: '玉璧城（韦孝宽坚守）' },
      { id: 'jinyang',     owner: 'enemy',  garrison: 25000, name: '晋阳方向（高欢主力）' },
      { id: 'puban',       owner: 'player', garrison: 3000,  name: '蒲坂（西魏后援）' }
    ]
  },
  // ---- 战役4：沙苑伏击（537年）—— 宇文泰伏击高欢 ----
  {
    id: 'v16_shayuan_fuji',
    name: '沙苑伏击',
    description: '西魏大统三年（537），东魏高欢将二十万讨西魏，屯许原西。宇文泰率轻骑渡渭，至沙苑，距东魏军六十里。诸将以众寡不敌，请待。泰曰：欢若至咸阳，人心惧矣。今及其远来新至，可击。乃命李弼、赵贵等伏兵于渭曲苇中，闻鼓而起。李弼横击之，东魏兵乱，丧甲士八万，弃铠仗十八万。高欢夜遁，虏至河上，复多散亡。关中之围遂解。',
    year: 537,
    illustration: 'v16_shayuan_fuji',
    objective: '在渭曲设伏，于 10 回合内击溃高欢主力（歼敌 10 万）。',
    defeatCondition: '宇文泰主力被击溃（我方损失超过 70%）。',
    startingState: {
      troops: 10000,
      money: 1000,
      food: 2000,
      generals: ['yuwen_tai', 'li_bi', 'yu_jin']
    },
    reward: { money: 3500, food: 5000 },
    mapSetup: [
      { id: 'weiqu',       owner: 'player', garrison: 3000,  isBase: true,  name: '渭曲（设伏之地）' },
      { id: 'shayuan',     owner: 'enemy',  garrison: 20000, isObjective: true, name: '沙苑（高欢主力）' },
      { id: 'tongguan',    owner: 'player', garrison: 2000,  name: '潼关（退路）' }
    ]
  },
  // ---- 战役5：隋灭南陈（589年）—— 杨素水军顺江而下 ----
  {
    id: 'v16_suimie_chen',
    name: '隋灭南陈',
    description: '隋开皇八年（588），文帝以晋王广为元帅，杨素出永安，秦王俊出襄阳，清河公杨素率水军东下，舟舻被江，旌甲曜日。素坐大船，名曰五牙，帅东下。陈将戚欣以青龙百余艘，屯狼尾滩以遏之。素夜引舟师掩之，水陆俱发，欣众大败。素东下，舟舻千里，滨江镇戍，皆望风请降。九年正月，韩擒虎入建业，擒后主陈叔宝，陈亡。',
    year: 589,
    illustration: 'v16_suimie_chen',
    objective: '顺江而下，在 25 回合内攻克建康，俘获陈叔宝。',
    defeatCondition: '水军主力被全歼，或杨素战死。',
    startingState: {
      troops: 30000,
      money: 4000,
      food: 8000,
      generals: ['yang_su', 'v15_lai_huer', 'he_ruobi']
    },
    reward: { money: 6000, food: 10000, generalId: 'chen_shubao' },
    mapSetup: [
      { id: 'yongan',      owner: 'player', garrison: 6000,  isBase: true,  name: '永安（杨素水军基地）' },
      { id: 'jiangling',   owner: 'player', garrison: 4000,  name: '江陵（秦王俊陆军）' },
      { id: 'jiangxia',   owner: 'enemy',  garrison: 6000,  name: '江夏（陈江防）' },
      { id: 'jiankang',   owner: 'enemy',  garrison: 10000, isObjective: true, name: '建康（陈都）' }
    ]
  }
];

// ============================================================
// V16.0 — 平衡性调优常量
// ============================================================
// 说明：V16.0 新增 15 位武将、20 个随机事件、5 个历史事件、1 个剧本、5 个战役关卡。
//   内容量再扩后，对数值做以下微调：
//   1) 兵种克制加成维持 V15=0.27，名将密度继续上升，不再增强克制；
//   2) AI 进攻阈值 V15=0.35 → V16=0.36，战役模式 AI 略趋激进；
//   3) 随机事件基础触发概率 V15=0.16 → V16=0.17，事件池扩大后略升触达；
//   4) 忠诚自然衰减维持 V15=0.22；
//   5) 新招募武将初始忠诚下限 V15=68 → V16=70，在野将池继续扩大；
//   6) 战役模式胜利奖励倍率新增 campaignRewardMult=1.0，作为外部调参入口；
//   7) 战役模式敌军难度倍率新增 campaignEnemyMult=1.0；
//   8) 税率上限维持 V15=45%。
// 注意：本常量仅作为数值配置集中声明，实际读取由 game.js/ai.js/tax.js 决定。
// ------------------------------------------------------------
export const V16_BALANCE = {
  // 兵种克制加成（维持 V15=0.27）
  counterBonus: 0.27,
  // 阵型克制加成（维持 V15=0.22）
  formationCounterBonus: 0.22,
  // AI 进攻阈值（V15=0.35 → V16=0.36，战役内容新增后 AI 略趋激进）
  aiAttackThreshold: 0.36,
  // AI 防御权重（维持 V15=0.60）
  aiDefenseWeight: 0.60,
  // 随机事件基础触发概率（V15=0.16 → V16=0.17，事件池再扩后略升触达）
  eventBaseProbability: 0.17,
  // 忠诚自然衰减速率（维持 V15=0.22）
  loyaltyDecayRate: 0.22,
  // 新招募武将初始忠诚下限（V15=68 → V16=70，在野将池继续扩大）
  recruitInitialLoyalty: 70,
  // 基础税率上限（维持 V15=45%）
  maxTaxRate: 45,
  // 税率超过 35% 后每 1% 的民心衰减（维持 V15=0.08）
  taxOverThresholdMoraleDecay: 0.08,
  // 税率低于 20% 时每 1% 的民心增益（维持 V15=0.05）
  taxUnderThresholdMoraleBonus: 0.05,
  // 城市收入人口系数（维持 V15=0.075）
  incomePopFactor: 0.075,
  // 冬季粮草消耗系数（维持 V15=0.05）
  winterFoodWaste: 0.05,
  // 科技研究费用系数（维持 V15=0.9）
  techCostMult: 0.9,
  // 困难模式 AI 资源倍率（维持 V15=1.4）
  hardModeResourceMult: 1.4,
  // 简单模式 AI 资源倍率（维持 V15=0.68）
  easyModeResourceMult: 0.68,
  // 新将招募费用折扣（维持 V15=0.15）
  recruitCostDiscount: 0.15,
  // 城市维护费系数（维持 V15=0.95）
  cityUpkeepFactor: 0.95,
  // 战役模式：胜利奖励倍率（新增）
  campaignRewardMult: 1.0,
  // 战役模式：敌军兵力难度倍率（新增）
  campaignEnemyMult: 1.0
};
