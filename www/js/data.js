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
  },
  // ---- V17.0 剧本29：邙山对峙（543年）----
  '543': {
    id: '543', name: '邙山大战', year: 543,
    description: '东魏武定元年（543），北豫州刺史高仲密以虎牢降西魏。宇文泰率诸军东下，围河桥南城。高欢率十万众自河东济，据邙山为阵。泰欲夜袭欢，欢将彭乐以数千骑冲之，泰军大败。明日合战，泰中军大破欢，欢失马，赫连阳顺下马以授欢。欢阵复振，泰几不振，乃引还。东西魏邙山之会，丧师数万，关、洛为之耗。',
    factions: ['dongwei', 'xiwei', 'nanchao'],
    factionNameOverride: {
      dongwei: '东魏（高欢）', xiwei: '西魏（宇文泰）', nanchao: '南梁（萧衍）'
    },
    // 特殊规则：高欢山东之众尚盛，邙山据险；宇文泰锐师东出，初胜后挫；南梁年迈，坐观成败
    resources: {
      dongwei: { money: 3000, food: 4000 },
      xiwei: { money: 2600, food: 3400 },
      nanchao: { money: 2000, food: 3000 }
    },
    cityMorale: { dongwei: 62, xiwei: 60, nanchao: 55 },
    generalLoyalty: { dongwei: 72, xiwei: 80, nanchao: 60 },
    garrisonMult: { dongwei: 1.2, xiwei: 1.15, nanchao: 1.0 }
  },
  // ---- V18.0 剧本：北周灭齐（577年）----
  '577': {
    id: '577', name: '北周灭齐', year: 577,
    description: '北周建德六年（577），周武帝宇文邕再驾东出，克晋州，破高纬亲军于平阳，遂围邺城。北齐数十年之业，一朝瓦解。周遂灭齐，尽有河北之地，与陈划江为界，混一之势已成。',
    factions: ['xiwei', 'dongwei', 'nanchao', 'hou_liang'],
    factionNameOverride: {
      xiwei: '北周', dongwei: '北齐', nanchao: '南陈', hou_liang: '后梁'
    },
    // 特殊规则：周武帝亲征，府兵精锐；齐后主奔邺，军心崩沮；南陈遣吴明彻北伐，已没于彭城
    resources: {
      xiwei: { money: 3600, food: 4800 },
      dongwei: { money: 1400, food: 2400 },
      nanchao: { money: 1500, food: 2800 },
      hou_liang: { money: 800, food: 1600 }
    },
    cityMorale: { xiwei: 78, dongwei: 30, nanchao: 52, hou_liang: 55 },
    generalLoyalty: { xiwei: 85, dongwei: 35, nanchao: 62, hou_liang: 60 },
    garrisonMult: { xiwei: 1.5, dongwei: 0.7, nanchao: 1.0, hou_liang: 0.9 }
  },

  // ============================================================
  // V19.0 新增剧本（1个，30→31）
  // ---- 剧本31：唐定中原（621年）----
  // 历史背景：唐武德四年（621），秦王李世民围王世充于洛阳。
  //   夏王窦建德自河北引十余众来救，太宗分兵围洛阳，自率骁骑三千五百
  //   东据虎牢。建德屯军汜水，数战不利。太宗伺其饥惰，亲率轻骑直薄其阵，
  //   建德军大溃，追奔三十里，俘五万余人，建德被槊走，追获之。遂降世充。
  //   河南河北悉平。唐室统一之势成，唯刘黑闼、辅公祏余烬未熄。
  // 此时江南杜伏威已入朝，江陵萧铣已平；北方突厥仍为边患。
  // ============================================================
  '621': {
    id: '621', name: '唐定中原', year: 621,
    description: '唐武德四年（621），秦王世民围王世充于洛阳。河北夏王窦建德率众十余万，自荥阳西上来救。太宗分兵围洛阳，自率骁骑三千五百东据虎牢，以拒建德。建德屯军汜水，数战不利。太宗伺其饥惰，亲率轻骑，东西汜水而上，直薄其阵。建德军大溃，追奔三十里，俘五万余人，建德被槊走，追获之。遂降世充。河南河北悉平，唐室统一之势已成。',
    factions: ['xiwei', 'dongwei', 'nanchao'],
    factionNameOverride: {
      xiwei: '唐（李唐）', dongwei: '夏（窦建德）', nanchao: '郑（王世充）'
    },
    // 特殊规则：秦王新定关东，府兵精锐，谋臣猛将如云；窦建德起于河北，人多望附；王世充据洛阳孤城，内外离心
    resources: {
      xiwei: { money: 3800, food: 5200 },
      dongwei: { money: 2600, food: 3600 },
      nanchao: { money: 1800, food: 2600 }
    },
    cityMorale: { xiwei: 72, dongwei: 60, nanchao: 40 },
    generalLoyalty: { xiwei: 88, dongwei: 65, nanchao: 45 },
    garrisonMult: { xiwei: 1.35, dongwei: 1.1, nanchao: 0.85 }
  },
  // ---- V20.0 剧本32：晋阳起兵（617年）----
  '617': {
    id: '617', name: '晋阳起兵', year: 617,
    description: '隋大业十三年（617），炀帝南巡江都，中原鼎沸。唐公李渊为太原留守，次子世民阴结豪杰，与晋阳令刘文静、宫监裴寂定谋，斩王威、高君雅，自太原举义。西河平，霍邑破，济河入长安，立代王侑，自为大丞相。北结突厥，东制群盗，入关之业，肇基于此。',
    factions: ['xiwei', 'dongwei', 'nanchao'],
    factionNameOverride: {
      xiwei: '唐（李渊）', dongwei: '洛都（杨侗）', nanchao: '马邑（刘武周）'
    },
    resources: {
      xiwei: { money: 3200, food: 4600 },
      dongwei: { money: 2200, food: 3000 },
      nanchao: { money: 1600, food: 2400 }
    },
    cityMorale: { xiwei: 68, dongwei: 55, nanchao: 62 },
    generalLoyalty: { xiwei: 85, dongwei: 50, nanchao: 60 },
    garrisonMult: { xiwei: 1.30, dongwei: 0.95, nanchao: 1.0 }
  },
  // ---- V21.0 剧本33：贞观灭突厥（630年）----
  '630': {
    id: '630', name: '贞观灭突厥', year: 630,
    description: '唐贞观四年（630），太宗既即位四年，贞观之治方兴。东突厥颉利可汗数为边患，太宗以李靖、李勣统十余万众，分道北伐。李靖夜袭阴山，颉利走，寻为张宝相所禽。于是斥地自阴山北至大漠，四夷君长请上尊号为天可汗。唐之威德，西尽西海，东极辽东。',
    factions: ['xiwei', 'dongwei', 'nanchao'],
    factionNameOverride: {
      xiwei: '唐（太宗）', dongwei: '东突厥（颉利）', nanchao: '薛延陀（夷男）'
    },
    resources: {
      xiwei: { money: 4200, food: 5600 },
      dongwei: { money: 2400, food: 3200 },
      nanchao: { money: 2000, food: 2800 }
    },
    cityMorale: { xiwei: 78, dongwei: 50, nanchao: 55 },
    generalLoyalty: { xiwei: 90, dongwei: 55, nanchao: 60 },
    garrisonMult: { xiwei: 1.35, dongwei: 0.95, nanchao: 1.0 }
  },
  // ===== V22.0 新剧本 =====
  // 755：天宝乱世·安史起兵
  '755': {
    id: '755', name: '天宝乱世·安史起兵', year: 755,
    description: '唐天宝十四载（755）冬，安禄山矫诏讨杨国忠，发范阳、平卢、河东三镇及同罗、奚、室韦十五万众，烟尘千里，河北郡县望风瓦解。东都洛阳、西京长安相继陷落。玄宗奔蜀，肃宗即位于灵武。郭子仪、李光弼起于朔方，借回纥之师，谋复两京。然藩镇跋扈，宦寺弄权，唐室之衰，自此始矣。玩家当择主而事：中兴唐室，或逐鹿中原。',
    factions: ['xiwei', 'dongwei', 'nanchao'],
    factionNameOverride: {
      xiwei: '唐（肃宗灵武）', dongwei: '大燕（安禄山）', nanchao: '回纥（怀仁可汗）'
    },
    resources: {
      xiwei: { money: 3800, food: 5200 },
      dongwei: { money: 4200, food: 5800 },
      nanchao: { money: 2400, food: 3000 }
    },
    cityMorale: { xiwei: 62, dongwei: 70, nanchao: 55 },
    generalLoyalty: { xiwei: 78, dongwei: 72, nanchao: 60 },
    garrisonMult: { xiwei: 1.05, dongwei: 1.25, nanchao: 1.0 }
  },
  // ===== V23.0 新剧本 =====
  // 817：元和中兴·淮西用兵
  '817': {
    id: '817', name: '元和中兴·淮西用兵', year: 817,
    description: '唐元和十二年（817），宪宗即位以来，慨然发愤，以法度裁制藩镇。先平西川刘辟，次平镇海李锜，又平魏博田兴。唯淮西吴元济，阻兵申、光、蔡三州，拒命三年。朝廷遣唐邓节度使李愬，雪夜入蔡州，擒元济。成德王承宗、淄青李师道，闻淮西平，皆惧而听命。唐室威令，复振于河北，号为元和中兴。玩家当择主而事：辅佐宪宗，成削藩之功；或据方镇，逐鹿中原。',
    factions: ['xiwei', 'dongwei', 'nanchao'],
    factionNameOverride: {
      xiwei: '唐（宪宗）', dongwei: '淮西（吴元济）', nanchao: '淄青（李师道）'
    },
    resources: {
      xiwei: { money: 4200, food: 5600 },
      dongwei: { money: 3200, food: 4200 },
      nanchao: { money: 3600, food: 4600 }
    },
    cityMorale: { xiwei: 66, dongwei: 64, nanchao: 62 },
    generalLoyalty: { xiwei: 80, dongwei: 70, nanchao: 68 },
    garrisonMult: { xiwei: 1.05, dongwei: 1.15, nanchao: 1.1 }
  },
  // ===== V24.0 新剧本 =====
  // 907：朱温代唐·梁晋争霸
  '907': {
    id: '907', name: '朱温代唐·梁晋争霸', year: 907,
    description: '唐天祐四年（907），朱温既诛朝士，弑昭宗，乃迫哀帝禅位，国号梁，都汴州。唐室既亡，天下分裂：河东李克用仍称唐天祐，与梁世仇；淮南杨渥嗣父之业；两浙钱镠称吴越王；福建王审知保境。沙陀骑兵骁锐，梁兵重甲据中原。梁晋夹河争雄，大小数十战。玩家当择主而事：辅朱温以定中原，或佐李克用以复唐室，或据一方以观天下之变。',
    factions: ['xiwei', 'dongwei', 'nanchao'],
    factionNameOverride: {
      xiwei: '后梁（朱温）', dongwei: '晋（李克用）', nanchao: '吴（杨渥）'
    },
    resources: {
      xiwei: { money: 4600, food: 6000 },
      dongwei: { money: 3800, food: 5000 },
      nanchao: { money: 4000, food: 5200 }
    },
    cityMorale: { xiwei: 64, dongwei: 68, nanchao: 62 },
    generalLoyalty: { xiwei: 76, dongwei: 82, nanchao: 70 },
    garrisonMult: { xiwei: 1.05, dongwei: 1.2, nanchao: 1.05 }
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
    pop: 15000, agri: 30, comm: 35, defense: 35, prosperity: 30, taxRate: 30 },

  // === V18.0 西北边疆十二州（河西走廊/河湟/西域）===
  // 历史地理参考：
  // 盐州（今陕西定边，盐川城，北边塞，盐池之利）
  // 会州（今甘肃靖远，黄河渡口，会宁关，陇右门户）
  // 河州（今甘肃临夏，枹罕故地，羌汉交错，丝路重镇）
  // 鄯州（今青海乐都，南凉故都，湟水流域，吐谷浑门户）
  // 廓州（今青海化隆，浇河城，河湟要塞）
  // 叠州（今甘肃迭部，洮州西南，山险林密，羌氐故地）
  // 宕州（今甘肃宕昌，羌中之道，陇南要冲）
  // 瓜州（今甘肃安西，敦煌郡西境，丝路咽喉）
  // 沙州（今甘肃敦煌，莫高窟所在，河西最西都会）
  // 伊州（今新疆哈密，西域门户，伊吾故地）
  // 西州（今新疆吐鲁番，高昌故城，丝路重镇）
  // 庭州（今新疆吉木萨尔，北庭都护府，西域极边）
  { id: 'v18_yanshuo',  name: '盐州', isoX: 2,  isoY: 1, terrain: 'desert',  size: 1, capital: false,
    pop: 16000, agri: 30, comm: 40, defense: 55, prosperity: 32, taxRate: 30 },
  { id: 'v18_huizhou',  name: '会州', isoX: 2,  isoY: 2, terrain: 'desert',  size: 1, capital: false,
    pop: 18000, agri: 35, comm: 38, defense: 58, prosperity: 35, taxRate: 30 },
  { id: 'v18_hezhou',   name: '河州', isoX: 1,  isoY: 3, terrain: 'mountain', size: 2, capital: false,
    pop: 25000, agri: 45, comm: 50, defense: 60, prosperity: 45, taxRate: 30 },
  { id: 'v18_shanzhou', name: '鄯州', isoX: 1,  isoY: 4, terrain: 'mountain', size: 2, capital: false,
    pop: 26000, agri: 42, comm: 48, defense: 62, prosperity: 46, taxRate: 30 },
  { id: 'v18_kuozhou',  name: '廓州', isoX: 0,  isoY: 4, terrain: 'mountain', size: 1, capital: false,
    pop: 18000, agri: 35, comm: 35, defense: 55, prosperity: 33, taxRate: 30 },
  { id: 'v18_diezhou',  name: '叠州', isoX: 1,  isoY: 5, terrain: 'forest',  size: 1, capital: false,
    pop: 15000, agri: 32, comm: 25, defense: 50, prosperity: 28, taxRate: 30 },
  { id: 'v18_dangzhou', name: '宕州', isoX: 2,  isoY: 5, terrain: 'mountain', size: 1, capital: false,
    pop: 16000, agri: 33, comm: 28, defense: 52, prosperity: 30, taxRate: 30 },
  { id: 'v18_guazhou',  name: '瓜州', isoX: -1, isoY: 3, terrain: 'desert',  size: 2, capital: false,
    pop: 22000, agri: 30, comm: 55, defense: 55, prosperity: 42, taxRate: 30 },
  { id: 'v18_shazhou',  name: '沙州', isoX: 0,  isoY: 2, terrain: 'desert',  size: 2, capital: false,
    pop: 28000, agri: 32, comm: 60, defense: 55, prosperity: 50, taxRate: 30 },
  { id: 'v18_yizhou',   name: '伊州', isoX: -2, isoY: 2, terrain: 'desert',  size: 1, capital: false,
    pop: 15000, agri: 25, comm: 45, defense: 50, prosperity: 35, taxRate: 30 },
  { id: 'v18_xizhou',   name: '西州', isoX: -1, isoY: 1, terrain: 'desert',  size: 2, capital: false,
    pop: 24000, agri: 35, comm: 58, defense: 52, prosperity: 48, taxRate: 30 },
  { id: 'v18_tingzhou', name: '庭州', isoX: -2, isoY: 0, terrain: 'desert',  size: 1, capital: false,
    pop: 14000, agri: 22, comm: 40, defense: 55, prosperity: 30, taxRate: 30 },

  // ============================================================
  // V19.0 新增城市十二（v19_ 前缀，84→96）
  // 陇右/河西/河北边镇：原州/渭州/兰州/岷州/洮州/甘州/肃州/
  //                   柳城(营州)/卢龙(平州)/云中(云州)/朔州/广昌(蔚州)
  // ============================================================
  // 原州（今宁夏固原，关中西北门户，萧关古道所经）
  { id: 'v19_yuanzhou',  name: '原州', isoX: 3,  isoY: 2, terrain: 'plain',   size: 2, capital: false,
    pop: 28000, agri: 48, comm: 52, defense: 65, prosperity: 48, taxRate: 30 },
  // 渭州（今甘肃陇西，陇右东陲，秦州西出首镇）
  { id: 'v19_weizhou',  name: '渭州', isoX: 2,  isoY: 4, terrain: 'mountain', size: 2, capital: false,
    pop: 26000, agri: 46, comm: 45, defense: 60, prosperity: 44, taxRate: 30 },
  // 兰州（今甘肃兰州，黄河金城关，陇右河西要津）
  { id: 'v19_lanzhou',  name: '兰州', isoX: 1,  isoY: 3, terrain: 'mountain', size: 2, capital: false,
    pop: 30000, agri: 42, comm: 58, defense: 62, prosperity: 50, taxRate: 30 },
  // 岷州（今甘肃岷县，陇西重镇，氐羌故地）
  { id: 'v19_minzhou',  name: '岷州', isoX: 1,  isoY: 5, terrain: 'mountain', size: 1, capital: false,
    pop: 18000, agri: 35, comm: 32, defense: 55, prosperity: 32, taxRate: 30 },
  // 洮州（今甘肃临潭，西番门户，边塞要冲）
  { id: 'v19_taozhou',  name: '洮州', isoX: 0,  isoY: 5, terrain: 'mountain', size: 1, capital: false,
    pop: 16000, agri: 30, comm: 28, defense: 58, prosperity: 30, taxRate: 30 },
  // 甘州（今甘肃张掖，河西四郡之一，丝路咽喉）
  { id: 'v19_ganzhou',  name: '甘州', isoX: -1, isoY: 2, terrain: 'desert',  size: 3, capital: false,
    pop: 35000, agri: 40, comm: 68, defense: 65, prosperity: 60, taxRate: 30 },
  // 肃州（今甘肃酒泉东，河西四郡之一，与酒泉同城而别）
  { id: 'v19_suzhou',   name: '肃州', isoX: -1, isoY: 1, terrain: 'desert',  size: 2, capital: false,
    pop: 24000, agri: 35, comm: 58, defense: 60, prosperity: 50, taxRate: 30 },
  // 柳城（营州治所，今辽宁朝阳，东北边镇）
  { id: 'v19_liucheng', name: '柳城', isoX: 6,  isoY: 0, terrain: 'plain',   size: 2, capital: false,
    pop: 22000, agri: 40, comm: 45, defense: 62, prosperity: 42, taxRate: 30 },
  // 卢龙（平州治所，今河北卢龙，幽燕东门）
  { id: 'v19_lulong',   name: '卢龙', isoX: 5,  isoY: 0, terrain: 'mountain', size: 2, capital: false,
    pop: 25000, agri: 45, comm: 50, defense: 65, prosperity: 46, taxRate: 30 },
  // 云中（云州治所，今山西大同，代北重镇）
  { id: 'v19_yunzhong', name: '云中', isoX: 4,  isoY: -1, terrain: 'mountain', size: 2, capital: false,
    pop: 28000, agri: 42, comm: 48, defense: 68, prosperity: 48, taxRate: 30 },
  // 朔州（善阳，今山西朔州，马邑故地）
  { id: 'v19_shuozhou', name: '朔州', isoX: 4,  isoY: 1, terrain: 'plain',   size: 2, capital: false,
    pop: 26000, agri: 48, comm: 45, defense: 65, prosperity: 46, taxRate: 30 },
  // 广昌（蔚州治所，今河北蔚县，太行八陉北陉）
  { id: 'v19_guangchang', name: '广昌', isoX: 5, isoY: 1, terrain: 'mountain', size: 1, capital: false,
    pop: 18000, agri: 38, comm: 38, defense: 58, prosperity: 36, taxRate: 30 },

  // === V20.0 新增边疆重镇十二（西域/漠北/辽东都护府）===
  // 安西都护府（唐平高昌后置，治龟兹，统西域三十六国，天山以南军政中枢）
  { id: 'v20_anxi',     name: '安西都护府', isoX: -3, isoY: 2, terrain: 'desert', size: 2, capital: false,
    pop: 16000, agri: 25, comm: 62, defense: 72, prosperity: 50, taxRate: 30 },
  // 北庭都护府（长安二年分安西置，治庭州，统天山以北诸蕃）
  { id: 'v20_beiting',  name: '北庭都护府', isoX: -3, isoY: 0, terrain: 'desert', size: 2, capital: false,
    pop: 15000, agri: 22, comm: 55, defense: 70, prosperity: 46, taxRate: 30 },
  // 龟兹（西域大国，王延城，安西都护府治所，佛国乐舞之乡）
  { id: 'v20_qiuci',    name: '龟兹', isoX: -2, isoY: 2, terrain: 'desert', size: 2, capital: false,
    pop: 18000, agri: 30, comm: 60, defense: 55, prosperity: 52, taxRate: 30 },
  // 疏勒（西域南道要冲，王疏勒城，葱岭北口）
  { id: 'v20_shule',    name: '疏勒', isoX: -4, isoY: 2, terrain: 'desert', size: 1, capital: false,
    pop: 12000, agri: 20, comm: 50, defense: 58, prosperity: 40, taxRate: 30 },
  // 焉耆（西域北道大国，王员渠城，博斯腾湖畔）
  { id: 'v20_yanqi',    name: '焉耆', isoX: -3, isoY: 1, terrain: 'desert', size: 1, capital: false,
    pop: 14000, agri: 28, comm: 48, defense: 50, prosperity: 42, taxRate: 30 },
  // 鄯善（古楼兰，汉昭帝更名，西域门户，戈壁绿洲）
  { id: 'v20_shanshan', name: '鄯善', isoX: -2, isoY: 1, terrain: 'desert', size: 1, capital: false,
    pop: 13000, agri: 25, comm: 45, defense: 48, prosperity: 40, taxRate: 30 },
  // 安北都护府（贞观平薛延陀置，初治单于台，统漠北铁勒诸部）
  { id: 'v20_anbei',    name: '安北都护府', isoX: 3, isoY: -2, terrain: 'desert', size: 1, capital: false,
    pop: 12000, agri: 18, comm: 40, defense: 68, prosperity: 38, taxRate: 30 },
  // 单于都护府（永徽初置，治云中故城，统漠南突厥降部）
  { id: 'v20_chanyu',   name: '单于都护府', isoX: 4, isoY: -2, terrain: 'desert', size: 1, capital: false,
    pop: 14000, agri: 22, comm: 42, defense: 66, prosperity: 40, taxRate: 30 },
  // 燕州（辽东北境，古辽东郡地，高句骊故边）
  { id: 'v20_yanzhou',  name: '燕州', isoX: 7, isoY: -1, terrain: 'mountain', size: 1, capital: false,
    pop: 16000, agri: 35, comm: 40, defense: 62, prosperity: 42, taxRate: 30 },
  // 平州（辽西重镇，治卢龙，临榆关，东北水陆门户）
  { id: 'v20_pingzhou', name: '平州', isoX: 7, isoY: 1, terrain: 'plain', size: 2, capital: false,
    pop: 22000, agri: 45, comm: 48, defense: 60, prosperity: 46, taxRate: 30 },
  // 安东都护府（总章元年平高丽置，治平壤城，统辽东高丽诸部）
  { id: 'v20_andong',   name: '安东都护府', isoX: 8, isoY: 0, terrain: 'plain', size: 2, capital: false,
    pop: 20000, agri: 42, comm: 46, defense: 64, prosperity: 48, taxRate: 30 },
  // 黑水都护府（开元平黑水靺鞨置，治黑水之畔，东北极边）
  { id: 'v20_heishui',  name: '黑水都护府', isoX: 8, isoY: -1, terrain: 'mountain', size: 1, capital: false,
    pop: 10000, agri: 15, comm: 35, defense: 60, prosperity: 34, taxRate: 30 },
  // ===== V21.0 西域丝路十二城 =====
  // 伊吾（伊吾卢，汉宜禾都尉地，唐伊州，丝路北道门户，天山南麓绿洲）
  { id: 'v21_yiwu',     name: '伊吾', isoX: -4, isoY: -1, terrain: 'desert', size: 1, capital: false,
    pop: 13000, agri: 25, comm: 58, defense: 55, prosperity: 44, taxRate: 30 },
  // 高昌（汉高昌壁，唐西州，麴氏高昌国都，丝路北道重镇，佛塔林立）
  { id: 'v21_gaochang', name: '高昌', isoX: -4, isoY: 0, terrain: 'desert', size: 2, capital: false,
    pop: 22000, agri: 38, comm: 66, defense: 58, prosperity: 55, taxRate: 30 },
  // 且末（汉且末国，唐播仙镇，丝路南道要驿，沙州西行首站）
  { id: 'v21_qiemo',    name: '且末', isoX: -5, isoY: 1, terrain: 'desert', size: 1, capital: false,
    pop: 11000, agri: 22, comm: 46, defense: 46, prosperity: 38, taxRate: 30 },
  // 精绝（汉精绝国，尼雅遗址，丝路南道小国，佛塔废墟）
  { id: 'v21_jingjue',  name: '精绝', isoX: -6, isoY: 2, terrain: 'desert', size: 1, capital: false,
    pop: 9000, agri: 18, comm: 42, defense: 40, prosperity: 34, taxRate: 30 },
  // 戎卢（汉戎卢国，小宛东，昆仑山下绿洲小国）
  { id: 'v21_ronglu',   name: '戎卢', isoX: -7, isoY: 2, terrain: 'desert', size: 1, capital: false,
    pop: 8000, agri: 16, comm: 38, defense: 38, prosperity: 32, taxRate: 30 },
  // 小宛（汉小宛国，且末南山中，西域小国）
  { id: 'v21_xiaoyuan', name: '小宛', isoX: -8, isoY: 2, terrain: 'mountain', size: 1, capital: false,
    pop: 7000, agri: 14, comm: 34, defense: 40, prosperity: 30, taxRate: 30 },
  // 渠勒（汉渠勒国，于阗东，西域南道小国）
  { id: 'v21_qule',     name: '渠勒', isoX: -8, isoY: 3, terrain: 'mountain', size: 1, capital: false,
    pop: 8000, agri: 15, comm: 36, defense: 40, prosperity: 31, taxRate: 30 },
  // 皮山（汉皮山国，于阗西，丝路南道要冲）
  { id: 'v21_pishan',   name: '皮山', isoX: -7, isoY: 3, terrain: 'desert', size: 1, capital: false,
    pop: 10000, agri: 20, comm: 44, defense: 44, prosperity: 36, taxRate: 30 },
  // 于阗（西域大国，王西城，美玉所出，丝路南道都会，佛教昌炽）
  { id: 'v21_yutian',   name: '于阗', isoX: -6, isoY: 3, terrain: 'desert', size: 2, capital: false,
    pop: 20000, agri: 32, comm: 64, defense: 52, prosperity: 54, taxRate: 30 },
  // 莎车（汉莎车国，唐叶州，丝路南道西端都会，西通葱岭）
  { id: 'v21_shache',   name: '莎车', isoX: -6, isoY: 4, terrain: 'desert', size: 1, capital: false,
    pop: 14000, agri: 24, comm: 52, defense: 50, prosperity: 42, taxRate: 30 },
  // 蒲犁（汉蒲犁国，羯盘陀，葱岭东陲，丝路越帕米尔要隘）
  { id: 'v21_puli',     name: '蒲犁', isoX: -6, isoY: 5, terrain: 'mountain', size: 1, capital: false,
    pop: 8000, agri: 12, comm: 40, defense: 52, prosperity: 32, taxRate: 30 },
  // 碎叶（西突厥重镇，安西四镇之一，楚河畔，丝路极西都会）
  { id: 'v21_suiye',    name: '碎叶', isoX: -9, isoY: 3, terrain: 'desert', size: 1, capital: false,
    pop: 12000, agri: 18, comm: 56, defense: 60, prosperity: 44, taxRate: 30 },
  // ===== V22.0 河北藩镇/中原转运十二城 =====
  // 魏州（汉魏郡，唐河北大名，安史之乱后河北三镇雄城，河朔咽喉）
  { id: 'v22_weizhou',  name: '魏州', isoX: 12, isoY: 2, terrain: 'plain', size: 3, capital: false,
    pop: 28000, agri: 55, comm: 60, defense: 62, prosperity: 58, taxRate: 30 },
  // 邢州（汉襄国故地，唐邢州，河北丝织重镇，磁窑冶铁所出）
  { id: 'v22_xingzhou', name: '邢州', isoX: 11, isoY: 1, terrain: 'plain', size: 2, capital: false,
    pop: 18000, agri: 48, comm: 52, defense: 54, prosperity: 48, taxRate: 30 },
  // 洺州（汉广平，唐洺州，临洺关险，河北用兵必争）
  { id: 'v22_mingzhou', name: '洺州', isoX: 12, isoY: 1, terrain: 'plain', size: 2, capital: false,
    pop: 16000, agri: 46, comm: 48, defense: 56, prosperity: 44, taxRate: 30 },
  // 沧州（唐沧州，东临渤海，渔盐之利，海运漕运要津）
  { id: 'v22_cangzhou', name: '沧州', isoX: 13, isoY: 1, terrain: 'coast', size: 2, capital: false,
    pop: 17000, agri: 40, comm: 62, defense: 50, prosperity: 50, taxRate: 30 },
  // 汴州（唐汴州，后梁东都，大运河咽喉，江淮漕运所萃，水陆都会）
  { id: 'v22_bianzhou', name: '汴州', isoX: 11, isoY: 4, terrain: 'river', size: 3, capital: false,
    pop: 30000, agri: 52, comm: 72, defense: 56, prosperity: 62, taxRate: 30 },
  // 宋州（唐宋州，汉梁国，睢阳所在，运河重镇，江淮屏蔽）
  { id: 'v22_songzhou', name: '宋州', isoX: 12, isoY: 4, terrain: 'plain', size: 2, capital: false,
    pop: 22000, agri: 54, comm: 58, defense: 58, prosperity: 52, taxRate: 30 },
  // 兖州（汉鲁郡，唐兖州，曲阜所在，岱南都会，淄青孔道）
  { id: 'v22_yanzhou',  name: '兖州', isoX: 12, isoY: 3, terrain: 'plain', size: 2, capital: false,
    pop: 20000, agri: 56, comm: 50, defense: 52, prosperity: 50, taxRate: 30 },
  // 陕州（汉弘农，唐陕州，崤函咽喉，黄河三门峡，关中门户）
  { id: 'v22_shanzhou', name: '陕州', isoX: 8,  isoY: 3, terrain: 'mountain', size: 2, capital: false,
    pop: 15000, agri: 38, comm: 54, defense: 64, prosperity: 46, taxRate: 30 },
  // 泾州（汉安定，唐泾州，关中西北屏藩，陇右节制要镇）
  { id: 'v22_jingzhou', name: '泾州', isoX: 3,  isoY: 3, terrain: 'mountain', size: 2, capital: false,
    pop: 14000, agri: 36, comm: 38, defense: 60, prosperity: 40, taxRate: 30 },
  // 绥州（唐绥州，秦上郡地，无定河川，党项杂处，陕北边镇）
  { id: 'v22_suizhou',  name: '绥州', isoX: 5,  isoY: 0, terrain: 'mountain', size: 1, capital: false,
    pop: 9000, agri: 18, comm: 30, defense: 52, prosperity: 30, taxRate: 30 },
  // 檀州（唐檀州，汉渔阳故城，密云所置，幽州北门锁钥）
  { id: 'v22_tanzhou',  name: '檀州', isoX: 10, isoY: -1, terrain: 'mountain', size: 1, capital: false,
    pop: 10000, agri: 22, comm: 36, defense: 54, prosperity: 34, taxRate: 30 },
  // 渝州（唐渝州，巴郡故地，嘉陵江入长江口，巴蜀东下水陆都会）
  { id: 'v22_yuzhou',   name: '渝州', isoX: 7,  isoY: 8, terrain: 'river', size: 2, capital: false,
    pop: 16000, agri: 42, comm: 56, defense: 50, prosperity: 48, taxRate: 30 },
  // ===== V23.0 中原漕运/江南海贸十二城 =====
  // 郑州（唐管城县，武周所立神都，黄河南岸水陆都会，东都畿辅）
  { id: 'v23_zhengzhou', name: '郑州', isoX: 9,  isoY: 4, terrain: 'plain', size: 3, capital: false,
    pop: 26000, agri: 56, comm: 66, defense: 56, prosperity: 60, taxRate: 30 },
  // 怀州（唐河内郡，黄河北岸太行第一陉，河阳桥所在，东都北门）
  { id: 'v23_huaizhou', name: '怀州', isoX: 9,  isoY: 2, terrain: 'mountain', size: 2, capital: false,
    pop: 15000, agri: 40, comm: 46, defense: 62, prosperity: 44, taxRate: 30 },
  // 博州（唐博州聊城，河北魏博北鄙，永济渠所经，牧马屯驻）
  { id: 'v23_bazhou',   name: '博州', isoX: 12, isoY: 0, terrain: 'plain', size: 1, capital: false,
    pop: 11000, agri: 34, comm: 38, defense: 50, prosperity: 36, taxRate: 30 },
  // 曹州（唐济阴郡，黄巢故里，汴宋之间，广济渠所经，漕运要冲）
  { id: 'v23_caozhou',  name: '曹州', isoX: 11, isoY: 5, terrain: 'plain', size: 2, capital: false,
    pop: 18000, agri: 50, comm: 52, defense: 52, prosperity: 48, taxRate: 30 },
  // 郓州（唐东平郡，天平军治所，汶水所经，山东水陆都会）
  { id: 'v23_yunzhou',  name: '郓州', isoX: 13, isoY: 3, terrain: 'plain', size: 2, capital: false,
    pop: 20000, agri: 54, comm: 56, defense: 56, prosperity: 52, taxRate: 30 },
  // 陈州（唐宛丘县，淮西屏蔽，蔡州东北门户，藩镇必争）
  { id: 'v23_chenzhou', name: '陈州', isoX: 10, isoY: 5, terrain: 'plain', size: 2, capital: false,
    pop: 17000, agri: 50, comm: 48, defense: 54, prosperity: 46, taxRate: 30 },
  // 颍州（唐汝阴郡，颍水入淮之口，汴宋东南走寿春孔道）
  { id: 'v23_yingzhou', name: '颍州', isoX: 13, isoY: 4, terrain: 'river', size: 2, capital: false,
    pop: 15000, agri: 46, comm: 50, defense: 48, prosperity: 44, taxRate: 30 },
  // 汝州（唐临汝郡，洛阳东南，汝水所经，东都畿辅，瓷窑所出）
  { id: 'v23_ruzhou',   name: '汝州', isoX: 9,  isoY: 5, terrain: 'mountain', size: 2, capital: false,
    pop: 14000, agri: 40, comm: 48, defense: 54, prosperity: 46, taxRate: 30 },
  // 杭州（唐余杭郡，江南运河南端，西湖所在，东南水陆都会）
  { id: 'v23_hangzhou', name: '杭州', isoX: 14, isoY: 7, terrain: 'river', size: 3, capital: false,
    pop: 24000, agri: 48, comm: 72, defense: 50, prosperity: 64, taxRate: 30 },
  // 明州（唐余姚郡，鄮县所在，东海海运贸易港，倭人新罗往来）
  { id: 'v23_mingzhou', name: '明州', isoX: 15, isoY: 8, terrain: 'coast', size: 2, capital: false,
    pop: 16000, agri: 36, comm: 68, defense: 48, prosperity: 52, taxRate: 30 },
  // 潭州（唐长沙郡，湖南观察使治所，湘水所经，岭北都会）
  { id: 'v23_tanzhou',  name: '潭州', isoX: 11, isoY: 10, terrain: 'river', size: 2, capital: false,
    pop: 19000, agri: 50, comm: 54, defense: 50, prosperity: 50, taxRate: 30 },
  // 岳州（唐巴陵郡，洞庭湖畔，湘江入江之口，江淮荆湖要冲）
  { id: 'v23_yuezhou',  name: '岳州', isoX: 11, isoY: 8, terrain: 'river', size: 2, capital: false,
    pop: 16000, agri: 46, comm: 56, defense: 48, prosperity: 48, taxRate: 30 },
  // ===== V24.0 唐末五代·岭南福建/黔滇十二城 =====
  // 桂州（唐始安郡，静江军治所，岭南西道重镇，湘桂走廊咽喉）
  { id: 'v24_guizhou',  name: '桂州', isoX: 10, isoY: 11, terrain: 'forest', size: 2, capital: false,
    pop: 18000, agri: 44, comm: 52, defense: 56, prosperity: 48, taxRate: 30 },
  // 邕州（唐朗宁郡，邕管经略治所，左、右江合流，控扼西原蛮）
  { id: 'v24_yongzhou', name: '邕州', isoX: 9,  isoY: 12, terrain: 'forest', size: 1, capital: false,
    pop: 12000, agri: 34, comm: 42, defense: 52, prosperity: 36, taxRate: 30 },
  // 容州（唐普宁郡，容管经略治所，北控桂岭，南接交趾）
  { id: 'v24_rongzhou', name: '容州', isoX: 10, isoY: 12, terrain: 'forest', size: 1, capital: false,
    pop: 11000, agri: 32, comm: 40, defense: 50, prosperity: 34, taxRate: 30 },
  // 泉州（唐清源郡，晋江入海，海贸蕃舶所聚，闽越都会）
  { id: 'v24_quanzhou', name: '泉州', isoX: 15, isoY: 9,  terrain: 'coast', size: 2, capital: false,
    pop: 17000, agri: 38, comm: 72, defense: 48, prosperity: 56, taxRate: 30 },
  // 福州（唐长乐郡，威武军治所，闽王王审知所据，东南海疆大镇）
  { id: 'v24_fuzhou',   name: '福州', isoX: 14, isoY: 9,  terrain: 'coast', size: 3, capital: false,
    pop: 22000, agri: 44, comm: 66, defense: 54, prosperity: 58, taxRate: 30 },
  // 温州（唐永嘉郡，东瓯故地，浙江南入海，海贸所经）
  { id: 'v24_wenzhou',  name: '温州', isoX: 15, isoY: 7,  terrain: 'coast', size: 2, capital: false,
    pop: 15000, agri: 40, comm: 62, defense: 46, prosperity: 50, taxRate: 30 },
  // 潮州（唐潮阳郡，岭南东鄙，韩江入海，蛮獠所居）
  { id: 'v24_chaozhou', name: '潮州', isoX: 12, isoY: 11, terrain: 'coast', size: 1, capital: false,
    pop: 12000, agri: 36, comm: 48, defense: 46, prosperity: 38, taxRate: 30 },
  // 夔州（唐云安郡，三峡之首，巴东咽喉，楚蜀必争）
  { id: 'v24_kuizhou',  name: '夔州', isoX: 7,  isoY: 9,  terrain: 'mountain', size: 2, capital: false,
    pop: 14000, agri: 38, comm: 46, defense: 62, prosperity: 42, taxRate: 30 },
  // 黔州（唐黔中郡，黔中观察使治所，五溪蛮地，涪陵江所经）
  { id: 'v24_qianzhou', name: '黔州', isoX: 8,  isoY: 11, terrain: 'mountain', size: 1, capital: false,
    pop: 11000, agri: 30, comm: 38, defense: 54, prosperity: 34, taxRate: 30 },
  // 播州（唐播川郡，遵义故地，川黔咽喉，夜郎旧境）
  { id: 'v24_bozhou',   name: '播州', isoX: 8,  isoY: 12, terrain: 'mountain', size: 1, capital: false,
    pop: 9000,  agri: 28, comm: 32, defense: 52, prosperity: 30, taxRate: 30 },
  // 永州（唐零陵郡，湘水上游，衡桂之间，潇湘要冲）
  { id: 'v24_yongling', name: '永州', isoX: 9,  isoY: 11, terrain: 'river', size: 1, capital: false,
    pop: 13000, agri: 40, comm: 42, defense: 48, prosperity: 40, taxRate: 30 },
  // 韶州（唐始兴郡，北江上游，岭南东道门户，铜冶所出）
  { id: 'v24_shaozhou', name: '韶州', isoX: 12, isoY: 10, terrain: 'forest', size: 2, capital: false,
    pop: 15000, agri: 42, comm: 54, defense: 50, prosperity: 46, taxRate: 30 }
];

// 城市邻接关系（行军路径，双向对称）— V6.5 覆盖全部 35 城
export const CITY_LINKS = {
  // 江东
  jiankang:   ['jiangling', 'shouyang', 'guangzhou', 'wujun', 'jiangzhou', 'yingcheng', 'yuzhou', 'hefei', 'guangling', 'jingkou'],
  wujun:      ['jiankang', 'kuaiji', 'jiangzhou', 'guangling', 'wuxing', 'jingkou', 'v23_hangzhou'],
  kuaiji:     ['wujun', 'jiangzhou', 'wuxing', 'v23_hangzhou', 'v23_mingzhou'],
  jiangzhou:  ['jiankang', 'guangzhou', 'yingcheng', 'wujun', 'kuaiji', 'xiangzhou', 'jiangxia', 'guangling', 'yuzhang', 'jingkou', 'v23_yuezhou'],
  guangzhou:  ['jiankang', 'jiangzhou', 'xiangzhou', 'jiaozhou', 'ningzhou', 'guiyang', 'v14_yaizhou', 'v24_guizhou', 'v24_chaozhou', 'v24_shaozhou'],
  jiaozhou:   ['guangzhou', 'xiangzhou', 'v14_yaizhou', 'v24_yongzhou', 'v24_rongzhou'],
  // 河北
  yecheng:    ['jinyang', 'luoyang', 'pengcheng', 'xiangguo', 'xindu', 'puyang', 'v22_weizhou', 'v23_huaizhou'],
  jinyang:    ['yecheng', 'pingcheng', 'luoyang', 'xiangguo', 'dingzhou', 'shangdang', 'v19_shuozhou'],
  luoyang:    ['yecheng', 'jinyang', 'shouyang', 'xiangyang', 'changan', 'runan', 'nanyang', 'huatai', 'shangdang', 'puyang', 'v14_huazhou', 'v22_bianzhou', 'v22_shanzhou', 'v23_zhengzhou', 'v23_huaizhou', 'v23_ruzhou'],
  pengcheng:  ['yecheng', 'qingzhou', 'shouyang', 'xindu', 'yuzhou', 'qiaojun', 'hefei', 'xiapi', 'zhongli2', 'licheng', 'v22_bianzhou', 'v22_songzhou', 'v22_yanzhou', 'v23_yunzhou'],
  qingzhou:   ['pengcheng', 'youzhou', 'xindu', 'yingzhou', 'xiapi', 'longcheng', 'licheng', 'yuyang', 'v22_cangzhou', 'v22_yanzhou', 'v23_yunzhou'],
  youzhou:    ['qingzhou', 'pingcheng', 'dingzhou', 'yingzhou', 'zhongshan', 'yuyang', 'v19_lulong', 'v19_guangchang', 'v19_yunzhong', 'v20_pingzhou', 'v22_cangzhou', 'v22_tanzhou'],
  shouyang:   ['pengcheng', 'luoyang', 'xiangyang', 'jiankang', 'jiangling', 'yuzhou', 'runan', 'hefei', 'zhongli2'],
  xiangguo:   ['jinyang', 'yecheng', 'dingzhou', 'xindu', 'zhongshan', 'v19_guangchang', 'v22_xingzhou'],
  xindu:      ['yecheng', 'qingzhou', 'pengcheng', 'xiangguo', 'yingzhou', 'qiaojun', 'zhongshan', 'puyang', 'v22_weizhou', 'v22_xingzhou'],
  dingzhou:   ['jinyang', 'youzhou', 'pingcheng', 'xiangguo', 'v19_guangchang'],
  yingzhou:   ['youzhou', 'qingzhou', 'xindu', 'zhongshan', 'longcheng', 'yuyang'],
  // 关中巴蜀
  changan:    ['luoyang', 'tianshui', 'pingcheng', 'xiangyang', 'longyou', 'hanzhong', 'huatai', 'puban', 'tongwan', 'v14_yanzhou', 'v14_huazhou', 'v22_shanzhou'],
  tianshui:   ['changan', 'guzang', 'chengdu', 'longyou', 'puban', 'qiuchi', 'v14_qizhou', 'v19_weizhou'],
  guzang:     ['tianshui', 'pingcheng', 'longyou', 'dunhuang', 'shuofang', 'jiuquan', 'v14_lingwu', 'v14_bingzhou', 'v19_ganzhou', 'v20_beiting'],
  pingcheng:  ['guzang', 'changan', 'jinyang', 'youzhou', 'dingzhou', 'shangdang', 'shuofang', 'tongwan', 'v14_xiazhou', 'v14_yanzhou', 'v19_liucheng', 'v19_yunzhong', 'v19_shuozhou', 'v19_guangchang', 'v20_chanyu'],
  longyou:    ['guzang', 'tianshui', 'changan', 'puban', 'shuofang', 'jiuquan', 'v14_qizhou', 'v14_bingzhou'],
  hanzhong:   ['changan', 'chengdu', 'xinye', 'qiuchi', 'v14_fengzhou', 'v14_lizhou', 'v18_dangzhou'],
  chengdu:    ['jiangling', 'tianshui', 'hanzhong', 'ningzhou', 'v14_lizhou', 'v22_yuzhou'],
  // 荆州（后梁）
  jiangling:  ['jiankang', 'chengdu', 'xiangyang', 'shouyang', 'yingcheng', 'xiangzhou', 'xinye', 'jiangxia', 'nanyang', 'wuling', 'wuchang', 'jingling', 'v14_xinzhou', 'v24_kuizhou', 'v24_qianzhou'],
  xiangyang:  ['jiangling', 'shouyang', 'luoyang', 'changan', 'xinye', 'nanyang', 'jingling'],
  // 湘郢（王琳）
  yingcheng:  ['jiangling', 'jiankang', 'jiangzhou', 'xiangzhou', 'jiangxia', 'yuzhang'],
  xiangzhou:  ['jiangling', 'guangzhou', 'yingcheng', 'jiaozhou', 'jiangzhou', 'yuzhang', 'wuling', 'wuchang', 'guiyang', 'v14_hengzhou', 'v14_chenzhou', 'v23_tanzhou', 'v23_yuezhou'],
  // 豫州（萧庄）
  yuzhou:     ['shouyang', 'jiankang', 'pengcheng', 'hefei', 'jiangxia', 'v23_caozhou', 'v23_chenzhou'],
  xinye:      ['xiangyang', 'jiangling', 'hanzhong', 'nanyang', 'wuling', 'yiyang', 'jingling', 'v14_fengzhou', 'v23_chenzhou', 'v23_ruzhou'],
  // ---- V6.5 新增城市连接 ----
  jiangxia:   ['jiangling', 'yingcheng', 'jiangzhou', 'yuzhou', 'hefei', 'yiyang', 'wuchang'],
  nanyang:    ['jiangling', 'xiangyang', 'xinye', 'luoyang', 'huatai', 'puban', 'yiyang'],
  runan:      ['luoyang', 'shouyang', 'qiaojun', 'yiyang', 'puyang', 'jingling', 'v23_zhengzhou', 'v23_caozhou', 'v23_chenzhou', 'v23_ruzhou'],
  qiaojun:    ['pengcheng', 'xindu', 'runan', 'zhongli2', 'puyang'],
  hefei:      ['pengcheng', 'shouyang', 'jiankang', 'yuzhou', 'jiangxia', 'xiapi', 'zhongli2', 'v23_yingzhou'],
  // ---- V8.0 新增城市连接（5座）----
  huatai:     ['luoyang', 'changan', 'nanyang', 'shangdang', 'puban', 'v14_huazhou', 'v23_zhengzhou', 'v23_huaizhou'],
  guangling:  ['jiankang', 'wujun', 'xiapi', 'jiangzhou', 'wuxing', 'jingkou', 'v23_yingzhou'],
  xiapi:      ['guangling', 'pengcheng', 'qingzhou', 'hefei', 'licheng'],
  shangdang:  ['jinyang', 'luoyang', 'huatai', 'pingcheng', 'v23_huaizhou'],
  puban:      ['changan', 'huatai', 'tianshui', 'longyou', 'nanyang', 'v14_yanzhou', 'v14_huazhou', 'v14_qizhou', 'v22_shanzhou'],
  // ---- V10.0 新增城市连接（5座）----
  dunhuang:  ['guzang', 'jiuquan', 'v18_shazhou', 'v20_shanshan', 'v20_beiting', 'v21_yiwu'],
  zhongshan:  ['xiangguo', 'youzhou', 'yingzhou', 'xindu', 'v22_xingzhou', 'v22_mingzhou'],
  longcheng:  ['qingzhou', 'yingzhou', 'licheng', 'yuyang', 'v19_liucheng'],
  shuofang:   ['pingcheng', 'guzang', 'longyou', 'tongwan', 'v14_lingwu', 'v14_xiazhou', 'v20_anbei', 'v22_suizhou'],
  qiuchi:     ['hanzhong', 'tianshui', 'v14_lizhou'],
  // ---- V11.0 新增城市连接（5座）----
  ningzhou:   ['chengdu', 'guangzhou'],
  wuxing:     ['wujun', 'kuaiji', 'guangling', 'yuzhang', 'v23_hangzhou'],
  yuzhang:    ['jiangzhou', 'wuxing', 'yingcheng', 'xiangzhou', 'wuling', 'wuchang', 'guiyang', 'v14_chenzhou', 'v23_tanzhou', 'v23_yuezhou', 'v24_fuzhou', 'v24_shaozhou'],
  tongwan:    ['pingcheng', 'shuofang', 'changan', 'v14_lingwu', 'v14_xiazhou', 'v14_yanzhou'],
  wuling:     ['jiangling', 'xiangzhou', 'yuzhang', 'xinye', 'guiyang', 'v14_xinzhou', 'v14_hengzhou', 'v22_yuzhou', 'v23_tanzhou', 'v23_yuezhou'],
  // ---- V12.0 新增城市连接（5座）----
  jingkou:    ['jiankang', 'guangling', 'wujun', 'jiangzhou'],
  yiyang:     ['xinye', 'jiangxia', 'nanyang', 'runan', 'jingling'],
  zhongli2:   ['pengcheng', 'shouyang', 'qiaojun', 'hefei', 'yuyang'],
  licheng:    ['qingzhou', 'pengcheng', 'xiapi', 'longcheng'],
  wuchang:    ['jiangxia', 'jiangling', 'xiangzhou', 'yuzhang', 'v14_xinzhou', 'v14_hengzhou'],
  // ---- V13.0 新增城市连接（5座）----
  jiuquan:    ['dunhuang', 'guzang', 'longyou', 'v18_guazhou', 'v19_ganzhou', 'v19_suzhou', 'v20_yanqi'],
  puyang:     ['yecheng', 'luoyang', 'runan', 'xindu', 'qiaojun', 'v22_weizhou', 'v22_bianzhou', 'v22_yanzhou', 'v23_zhengzhou'],
  jingling:   ['xiangyang', 'jiangling', 'runan', 'yiyang', 'xinye'],
  guiyang:    ['guangzhou', 'xiangzhou', 'wuling', 'yuzhang', 'v14_chenzhou', 'v23_tanzhou', 'v24_chaozhou', 'v24_yongling', 'v24_shaozhou'],
  yuyang:     ['youzhou', 'yingzhou', 'zhongli2', 'qingzhou', 'longcheng', 'v19_lulong'],
  // ---- V14.0 新增城市连接（12座）----
  // 每座新城连接 2~3 座相邻城市，双向对称。
  v14_lingwu:  ['guzang', 'shuofang', 'tongwan', 'v14_xiazhou', 'v18_yanshuo', 'v18_huizhou', 'v19_yuanzhou'],
  v14_xiazhou: ['tongwan', 'shuofang', 'pingcheng', 'v14_lingwu', 'v14_yanzhou', 'v18_yanshuo', 'v22_suizhou'],
  v14_yanzhou: ['pingcheng', 'tongwan', 'changan', 'puban', 'v14_xiazhou', 'v14_huazhou', 'v22_suizhou'],
  v14_huazhou: ['changan', 'puban', 'luoyang', 'huatai', 'v14_yanzhou', 'v22_shanzhou'],
  v14_qizhou:  ['tianshui', 'longyou', 'puban', 'v14_bingzhou', 'v18_hezhou', 'v18_shanzhou', 'v18_huizhou', 'v19_yuanzhou', 'v22_jingzhou'],
  v14_bingzhou:['longyou', 'guzang', 'v14_qizhou', 'v18_hezhou', 'v22_jingzhou'],
  v14_fengzhou:['hanzhong', 'xinye', 'v14_xinzhou', 'v14_lizhou', 'v24_kuizhou'],
  v14_lizhou:  ['chengdu', 'hanzhong', 'qiuchi', 'v14_fengzhou'],
  v14_xinzhou: ['wuchang', 'jiangling', 'wuling', 'v14_fengzhou', 'v14_hengzhou', 'v22_yuzhou'],
  v14_hengzhou:['xiangzhou', 'wuling', 'wuchang', 'v14_xinzhou', 'v14_chenzhou', 'v24_yongling'],
  v14_chenzhou:['xiangzhou', 'guiyang', 'yuzhang', 'v14_hengzhou', 'v24_guizhou'],
  v14_yaizhou: ['jiaozhou', 'guangzhou', 'v24_rongzhou'],
  // === V18.0 西北边疆十二州邻接 ===
  v18_yanshuo:  ['v14_lingwu', 'v14_xiazhou', 'v18_huizhou'],
  v18_huizhou:  ['v14_lingwu', 'v14_qizhou', 'v18_yanshuo', 'v18_hezhou', 'v18_shazhou', 'v19_yuanzhou'],
  v18_hezhou:   ['v14_qizhou', 'v14_bingzhou', 'v18_huizhou', 'v18_shanzhou', 'v18_shazhou', 'v19_lanzhou'],
  v18_shanzhou: ['v18_hezhou', 'v18_kuozhou', 'v18_dangzhou', 'v14_qizhou', 'v19_taozhou'],
  v18_kuozhou:  ['v18_shanzhou', 'v18_diezhou', 'v18_guazhou'],
  v18_diezhou:  ['v18_kuozhou', 'v18_dangzhou', 'v19_taozhou'],
  v18_dangzhou: ['v18_diezhou', 'v18_shanzhou', 'hanzhong'],
  v18_guazhou:  ['v18_kuozhou', 'v18_shazhou', 'v18_yizhou', 'jiuquan', 'v19_ganzhou'],
  v18_shazhou:  ['v18_guazhou', 'v18_hezhou', 'v18_xizhou', 'dunhuang', 'v18_huizhou', 'v19_suzhou'],
  v18_yizhou:   ['v18_guazhou', 'v18_xizhou', 'v18_tingzhou'],
  v18_xizhou:   ['v18_yizhou', 'v18_shazhou', 'v18_tingzhou'],
  v18_tingzhou: ['v18_yizhou', 'v18_xizhou'],
  // === V19.0 陇右/河西/河北边镇十二州邻接 ===
  v19_yuanzhou:   ['v14_lingwu', 'v14_qizhou', 'v18_huizhou', 'v19_lanzhou', 'v19_weizhou', 'v22_jingzhou'],
  v19_weizhou:    ['tianshui', 'v19_lanzhou', 'v19_minzhou', 'v19_yuanzhou'],
  v19_lanzhou:    ['v19_weizhou', 'v19_minzhou', 'v19_taozhou', 'v18_hezhou', 'v19_yuanzhou'],
  v19_minzhou:    ['v19_weizhou', 'v19_lanzhou', 'v19_taozhou'],
  v19_taozhou:    ['v19_minzhou', 'v19_lanzhou', 'v18_shanzhou', 'v18_diezhou'],
  v19_ganzhou:    ['guzang', 'jiuquan', 'v19_suzhou', 'v18_guazhou'],
  v19_suzhou:     ['jiuquan', 'v19_ganzhou', 'v18_shazhou'],
  v19_liucheng:   ['longcheng', 'v19_lulong', 'pingcheng', 'v20_yanzhou'],
  v19_lulong:     ['youzhou', 'yuyang', 'v19_liucheng', 'v20_pingzhou'],
  v19_yunzhong:   ['pingcheng', 'v19_shuozhou', 'youzhou', 'v20_chanyu'],
  v19_shuozhou:   ['pingcheng', 'jinyang', 'v19_yunzhong'],
  v19_guangchang: ['youzhou', 'pingcheng', 'dingzhou', 'xiangguo'],
  // === V20.0 边疆都护府邻接（12座，双向对称）===
  v20_shule:     ['v20_anxi', 'v21_yutian', 'v21_shache', 'v21_puli'],
  v20_anxi:      ['v20_shule', 'v20_qiuci', 'v20_yanqi', 'v21_suiye'],
  v20_qiuci:     ['v20_anxi', 'v20_yanqi', 'v20_shanshan'],
  v20_yanqi:     ['v20_anxi', 'v20_qiuci', 'v20_shanshan', 'v20_beiting', 'jiuquan', 'v21_gaochang'],
  v20_shanshan:  ['v20_qiuci', 'v20_yanqi', 'dunhuang', 'v21_qiemo'],
  v20_beiting:   ['v20_yanqi', 'dunhuang', 'guzang', 'v21_yiwu', 'v21_gaochang'],
  v20_anbei:     ['v20_chanyu', 'shuofang'],
  v20_chanyu:    ['v20_anbei', 'v19_yunzhong', 'pingcheng'],
  v20_heishui:   ['v20_yanzhou', 'v20_andong'],
  v20_yanzhou:   ['v20_heishui', 'v20_andong', 'v19_liucheng', 'v22_tanzhou'],
  v20_andong:    ['v20_heishui', 'v20_yanzhou', 'v20_pingzhou'],
  v20_pingzhou:  ['v20_andong', 'v19_lulong', 'youzhou', 'v22_cangzhou', 'v22_tanzhou'],
  // === V21.0 西域丝路十二城邻接（双向对称）===
  v21_yiwu:      ['dunhuang', 'v21_gaochang', 'v20_beiting'],
  v21_gaochang:  ['v21_yiwu', 'v20_beiting', 'v20_yanqi'],
  v21_qiemo:     ['v20_shanshan', 'v21_jingjue', 'v21_pishan'],
  v21_jingjue:   ['v21_qiemo', 'v21_ronglu'],
  v21_ronglu:    ['v21_jingjue', 'v21_xiaoyuan'],
  v21_xiaoyuan:  ['v21_ronglu', 'v21_qule'],
  v21_qule:      ['v21_xiaoyuan', 'v21_pishan', 'v21_yutian'],
  v21_pishan:    ['v21_qule', 'v21_yutian', 'v21_qiemo'],
  v21_yutian:    ['v21_pishan', 'v21_qule', 'v21_shache', 'v20_shule'],
  v21_shache:    ['v21_yutian', 'v21_puli', 'v20_shule'],
  v21_puli:      ['v21_shache', 'v20_shule'],
  v21_suiye:     ['v20_anxi'],
  // ===== V22.0 河北藩镇/中原转运十二城（双向）=====
  v22_weizhou:   ['yecheng', 'xindu', 'puyang', 'v22_mingzhou', 'v22_xingzhou', 'v22_cangzhou', 'v23_bazhou'],
  v22_xingzhou:  ['xiangguo', 'zhongshan', 'xindu', 'v22_weizhou', 'v22_mingzhou'],
  v22_mingzhou:  ['v22_xingzhou', 'v22_weizhou', 'zhongshan', 'v23_bazhou'],
  v22_cangzhou:  ['youzhou', 'qingzhou', 'v22_weizhou', 'v20_pingzhou', 'v23_bazhou', 'v23_yunzhou'],
  v22_bianzhou:  ['luoyang', 'puyang', 'v22_songzhou', 'v22_yanzhou', 'pengcheng', 'v23_caozhou'],
  v22_songzhou:  ['v22_bianzhou', 'pengcheng', 'v22_yanzhou', 'v23_caozhou', 'v23_yingzhou'],
  v22_yanzhou:   ['pengcheng', 'puyang', 'v22_bianzhou', 'v22_songzhou', 'qingzhou', 'v23_yunzhou'],
  v22_shanzhou:  ['luoyang', 'changan', 'v14_huazhou', 'puban'],
  v22_jingzhou:  ['v19_yuanzhou', 'v14_qizhou', 'v14_bingzhou'],
  v22_suizhou:   ['v14_yanzhou', 'v14_xiazhou', 'shuofang'],
  v22_tanzhou:   ['youzhou', 'v20_pingzhou', 'v20_yanzhou'],
  v22_yuzhou:    ['chengdu', 'v14_xinzhou', 'wuling'],
  // ===== V23.0 中原漕运/江南海贸十二城（双向）=====
  v23_zhengzhou: ['luoyang', 'huatai', 'runan', 'puyang', 'v23_ruzhou'],
  v23_huaizhou:  ['shangdang', 'luoyang', 'yecheng', 'huatai'],
  v23_bazhou:    ['v22_mingzhou', 'v22_weizhou', 'v22_cangzhou'],
  v23_caozhou:   ['v22_bianzhou', 'v22_songzhou', 'runan', 'yuzhou', 'v23_chenzhou', 'v23_yingzhou'],
  v23_yunzhou:   ['v22_yanzhou', 'qingzhou', 'pengcheng', 'v22_cangzhou'],
  v23_chenzhou:  ['runan', 'v23_ruzhou', 'xinye', 'v23_caozhou', 'yuzhou'],
  v23_yingzhou:  ['v22_songzhou', 'hefei', 'v23_caozhou', 'guangling'],
  v23_ruzhou:    ['luoyang', 'v23_zhengzhou', 'runan', 'xinye', 'v23_chenzhou'],
  v23_hangzhou:  ['wujun', 'kuaiji', 'wuxing', 'v24_wenzhou'],
  v23_mingzhou:  ['kuaiji', 'v24_quanzhou', 'v24_wenzhou'],
  v23_tanzhou:   ['yuzhang', 'xiangzhou', 'wuling', 'v23_yuezhou', 'guiyang'],
  v23_yuezhou:   ['jiangzhou', 'yuzhang', 'xiangzhou', 'v23_tanzhou', 'wuling'],
  // ===== V24.0 岭南福建/黔滇十二城（双向）=====
  v24_guizhou:   ['v14_chenzhou', 'guangzhou', 'v24_rongzhou', 'v24_yongling', 'v24_yongzhou', 'v24_bozhou'],
  v24_yongzhou:  ['v24_guizhou', 'v24_rongzhou', 'jiaozhou'],
  v24_rongzhou:  ['v24_guizhou', 'v24_yongzhou', 'jiaozhou', 'v14_yaizhou'],
  v24_quanzhou:  ['v24_fuzhou', 'v23_mingzhou'],
  v24_fuzhou:    ['v24_quanzhou', 'v24_wenzhou', 'yuzhang'],
  v24_wenzhou:   ['v24_fuzhou', 'v23_mingzhou', 'v23_hangzhou'],
  v24_chaozhou:  ['guangzhou', 'v24_shaozhou', 'guiyang'],
  v24_kuizhou:   ['jiangling', 'v24_qianzhou', 'v14_fengzhou'],
  v24_qianzhou:  ['v24_kuizhou', 'v24_bozhou', 'v24_yongling', 'jiangling'],
  v24_bozhou:    ['v24_qianzhou', 'v24_guizhou'],
  v24_yongling:  ['v24_guizhou', 'v24_qianzhou', 'v14_hengzhou', 'guiyang'],
  v24_shaozhou:  ['guangzhou', 'v24_chaozhou', 'guiyang', 'yuzhang']
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
    description: '字法言，会稽山阴人。容止都雅，文章赡丽。后主即位，与江总等并为狎客。善为媚，恶闻人过，群臣有违之者，皆被诋毁。又自谓文武略，举朝莫及。隋师渡江，范请出战，未阵而北，与后主俱入井。' },

  // ============================================================
  // V17.0 新增武将（15位，v17_ 前缀）—— 隋宗室·陈佞臣·梁将·隋末唐初群雄
  // ============================================================
  // 历史参考：《隋书》《陈书》《南史》《北史》《旧唐书》
  // 覆盖：隋宗室(3) · 陈佞臣(2) · 梁将(1) · 隋末群雄(4) · 唐初开国(5)

  // ---- 隋宗室（3） ----
  { id: 'v17_yang_xiu', name: '杨秀', faction: 'xiwei', role: '隋蜀王',
    command: 60, force: 62, intel: 50, politics: 45, loyalty: 60, portrait: 'v17_yang_xiu',
    age: 35, skills: ['wangzhe_qiqi', 'dudu_zhongwai'],
    bonds: ['yang_jian', 'yang_liang'],
    description: '隋文帝第四子，封蜀王，镇江州。性好奢侈，违犯制度，车马被服拟于天子。及太子勇以谗废，晋王广为太子，秀意甚不平。炀帝畏之，杨素媒构成其罪，废为庶人，幽内侍省。宇文化及弑逆，秀见害。' },
  { id: 'v17_yang_liang', name: '杨谅', faction: 'xiwei', role: '隋汉王',
    command: 72, force: 70, intel: 48, politics: 40, loyalty: 55, portrait: 'v17_yang_liang',
    age: 30, skills: ['wangzhe_qiqi', 'dudu_zhongwai'],
    bonds: ['yang_jian', 'yang_xiu'],
    description: '隋文帝第五子，封汉王，为并州总管，自山以东至于沧海，河南至于黄河，五十二州皆属焉。文帝崩，炀帝遣车骑将军屈突通以玺书召之。谅不自安，遂举兵反，从者十九州。杨素率师讨之，谅战败穷蹙，降，除名为民，竟以幽死。' },
  { id: 'v17_yang_jun', name: '杨俊', faction: 'xiwei', role: '隋秦王',
    command: 45, force: 40, intel: 55, politics: 50, loyalty: 75, portrait: 'v17_yang_jun',
    age: 30, skills: ['wangzhe_qiqi', 'rujiang'],
    bonds: ['yang_jian', 'yang_guang'],
    description: '隋文帝第三子，封秦王。仁恕慈爱，崇敬佛道。渐好奢侈，违犯制度，出钱求息，民吏苦之。又起 盛 室， 水 山 列 树， 穷 极 侈丽。 王 妃 崔氏 以 王 好 姬 妾， 于 瓜 中 进 毒， 王 因 疾 薨， 时 三 十。' },

  // ---- 陈佞臣（2） ----
  { id: 'v17_shen_keqing', name: '沈客卿', faction: 'nanchao', role: '陈中书舍人',
    command: 15, force: 10, intel: 70, politics: 65, loyalty: 35, portrait: 'v17_shen_keqing',
    age: 45, skills: ['mouliao_baichu'],
    bonds: ['chen_shubao', 'shi_wenqing'],
    description: '吴兴吴人。性便佞，善承候颜色。后主至德初，与施文庆俱为中书通事舍人。客卿每以利进，后主大悦，加兼中书舍人。建议以军储簿领，每岁聚敛，过小即籍没，公私烦毒。隋师济江，客卿与文庆掌机密，不发兵。及城陷，皆为晋王广所斩。' },
  { id: 'v17_shi_wenqing', name: '施文庆', faction: 'nanchao', role: '陈中书舍人',
    command: 15, force: 10, intel: 68, politics: 62, loyalty: 35, portrait: 'v17_shi_wenqing',
    age: 45, skills: ['mouliao_baichu'],
    bonds: ['chen_shubao', 'shen_keqing'],
    description: '吴兴乌程人。家本吏门，少颇涉书记。后主在东宫，文庆自是驱使。及即位，擢为中书舍人，颇亲用之。隋师临江，文庆称有疾，自知军大事，不以关白。袁宪等请于京口、采石遣使益兵，文庆与客庆互沮之。及隋军克建康，文庆犹侍后主，隋军执之，斩于阙下，以其误陈也。' },

  // ---- 梁将（1） ----
  { id: 'v17_ren_yue', name: '任约', faction: 'nanchao', role: '梁叛将',
    command: 72, force: 78, intel: 60, politics: 40, loyalty: 45, portrait: 'v17_ren_yue',
    age: 50, skills: ['mengjiang', 'xiaoyong_shanzhan'],
    bonds: ['hou_jing', 'wang_sengbian'],
    description: '本西魏镇南将军，后降梁。侯景之乱，约以所部会景，为景佐命。台城陷，景以为南徐州刺史。及景败，约西奔江陵，元帝赦之，以为领军人。后从陆法和拒任约于赤沙亭，遂禽约。王僧辩以约降将，不之杀，后竟卒于江陵。' },

  // ---- 隋末群雄（4） ----
  { id: 'v17_yuwen_huaji', name: '宇文化及', faction: null, role: '隋末弑逆',
    command: 55, force: 60, intel: 40, politics: 30, loyalty: 20, portrait: 'v17_yuwen_huaji',
    age: 45, skills: ['xiaoxiong'],
    bonds: ['yuwen_shu', 'v17_yuwen_huaji'],
    description: '代武川人，宇文述之子。性凶险，不守法度，长安谓之轻薄公子。炀帝幸江都，化及与弟智及、司马德戡合谋，夜率骁果作乱，引帝出，弑之。立秦王浩为帝，自称大丞相。引兵西归，为李密所败，北走魏县。乃鸩杀浩，自称许帝，国号许。后为窦建德所擒，斩之。' },
  { id: 'v17_wang_shichong', name: '王世充', faction: null, role: '隋末郑王',
    command: 75, force: 72, intel: 70, politics: 68, loyalty: 40, portrait: 'v17_wang_shichong',
    age: 45, skills: ['xiaoxiong', 'mouliao_baichu'],
    bonds: ['yang_guang', 'du_weiwei'],
    description: '本西域胡人，姓支氏，父收从母嫁王氏，因姓王。世充颇窥书传，好兵法，明习法律。炀帝时，以军功累迁江都郡丞。李密逼东都，世充为大将，与密相持洛口。及炀帝弑，世充奉越王侗，后废侗自立，国号郑，年号开明。唐秦王李世民东讨，世充降，至长安，为仇家所杀。' },
  { id: 'v17_dou_jiande', name: '窦建德', faction: null, role: '隋末夏王',
    command: 82, force: 80, intel: 72, politics: 75, loyalty: 70, portrait: 'v17_dou_jiande',
    age: 45, skills: ['xiaoxiong', 'jingtu_tuzhi'],
    bonds: ['v17_yuwen_huaji', 'liu_heita'],
    description: '清河漳南人。少时颇然然诺，尚豪侠。隋末为里长，犯法亡，会赦归。乡人以县杀其家属，遂亡居高鸡县中，群盗往归之，得百余万人。自称长乐王，建都乐寿，国号夏。化及弑炀帝于江都，建德为隋帝发丧，改元五凤。后李世民讨王世充，建德引兵救之，兵败于虎牢，被擒，斩于长安。' },
  { id: 'v17_xiao_xian', name: '萧铣', faction: 'hou_liang', role: '隋末梁帝',
    command: 60, force: 55, intel: 65, politics: 60, loyalty: 55, portrait: 'v17_xiao_xian',
    age: 35, skills: ['wangzhe_qiqi', 'rujiang'],
    bonds: ['xiao_cha', 'xiao_kui'],
    description: '后梁宣帝曾孙，岩之孙。少孤贫，自鬻为书。大业末，岳州校尉董景珍等谋起兵，以铣为梁宗室，推为主。铣自称梁王，建元鸣凤，称帝，都江陵。至广壤，南交趾，北距汉，皆附之。唐赵郡王李孝恭、李靖率舟师自夔州东下，铣势穷，降，送长安，斩之。' },

  // ---- 唐初开国（5） ----
  { id: 'v17_xu_shiji', name: '李勣', faction: null, role: '唐初名将',
    command: 90, force: 82, intel: 85, politics: 80, loyalty: 85, portrait: 'v17_xu_shiji',
    age: 40, skills: ['dudu_zhongwai', 'mouliao_baichu'],
    bonds: ['wei_zheng', 'qin_shubao'],
    description: '本姓徐，世勣，曹州离孤人。家富，多积粟。隋末，与翟让同起瓦岗，说让袭取荥阳、黎阳仓。密败，归唐，赐姓李氏，宗属。从太宗平王世充、窦建德，破刘黑闼、徐圆朗。高宗朝，为并州都督，大破突厥，封英国公。与李靖同称初朝名将。' },
  { id: 'v17_qin_shubao', name: '秦叔宝', faction: null, role: '唐初猛将',
    command: 82, force: 92, intel: 60, politics: 50, loyalty: 85, portrait: 'v17_qin_shubao',
    age: 40, skills: ['mengjiang', 'xiaoyong_shanzhan'],
    bonds: ['cheng_yaojin', 'luo_shixin'],
    description: '名琼，以字行，齐州历城人。始为隋将来护儿帐内，母丧，护儿遣使吊之。后从张须陀击卢明月，须陀死，又从裴仁基降密。密败，归王世充，恶世充之为人，与程知节西奔长安，事秦王李世民。从征四方，每敌阵有骁将锐卒震出矜夸者，太宗辄命叔宝取之，必刺万众中。以功封翼国公。' },
  { id: 'v17_cheng_yaojin', name: '程知节', faction: null, role: '唐初猛将',
    command: 80, force: 88, intel: 62, politics: 55, loyalty: 85, portrait: 'v17_cheng_yaojin',
    age: 42, skills: ['mengjiang', 'xiaoyong_shanzhan'],
    bonds: ['qin_shubao', 'v17_xu_shiji'],
    description: '本名程咬金，后改名知节，济州东阿人。善用马槊。隋末，聚徒数百，共保乡里，以备他盗。后依李密，为内军骠骑。密败，为王世充所得。世充遇之厚，知节谓秦叔宝曰：世充器度浅狭，多妄语，非拨乱主。及战于九曲，立马与叔宝西归，拜秦王府左三统军。从破宋金刚、窦建德、王世充，封卢国公。' },
  { id: 'v17_wei_zheng', name: '魏徵', faction: null, role: '唐初谏臣',
    command: 20, force: 15, intel: 92, politics: 90, loyalty: 85, portrait: 'v17_wei_zheng',
    age: 45, skills: ['mouliao_baichu', 'rujiang'],
    bonds: ['v17_xu_shiji', 'fang_xuanling'],
    description: '字玄成，巨鹿曲城人。少孤贫，落拓有大志，好读书，多所该通。初为武阳郡丞元宝藏书记，元宝藏以书疏事李密，皆徵为之。密败，归唐，久未知名，自请安辑山东，说李勣归国。后隐太子建成见杀，太宗素其才，引为詹事主簿。前后谏二百余奏，无不剀切。郑文贞公。' },
  { id: 'v17_li_jing', name: '李靖', faction: null, role: '唐初军神',
    command: 95, force: 80, intel: 92, politics: 75, loyalty: 85, portrait: 'v17_li_jing',
    age: 50, skills: ['dudu_zhongwai', 'mouliao_baichu'],
    bonds: ['v17_xiao_xian', 'li_jing'],
    description: '字药师，京兆三原人。姿貌瑰伟，以文武才略自言。每云：大丈夫当以功名取富贵。隋末，为马邑郡丞。唐高祖克长安，得靖，将斩之，靖大呼曰：公起义兵，本为天下除暴，以私怨杀壮士乎？太宗释之。从平萧铣，取江陵；辅公祏反，靖讨平之。太宗朝，大破突厥颉利于阴山，俘其众。封卫国公。' },

  // ---- V18.0 隋末唐初群雄（15）----
  // 历史：刘武周，河间景城人，迁马邑。隋末斩太守王仁恭，自称太守，附突厥，立为定扬可汗，
  // 袭破并州，大败齐王李元吉。后为秦王李世民所破，奔突厥，为突厥所杀。
  { id: 'v18_liu_wuzhou', name: '刘武周', faction: null, role: '隋末割据',
    command: 82, force: 88, intel: 65, politics: 60, loyalty: 70, portrait: 'v18_liu_wuzhou',
    age: 40, skills: ['mengjiang', 'xiaoxiong'],
    bonds: ['v18_si_xing', 'v18_liang_shidu'],
    description: '河间景城人，后徙马邑。骁勇善骑射，交通豪侠。隋末，杀马邑太守王仁恭，开仓赈穷，自称太守。遣使附突厥，突厥立为定杨可汗。遂破并州，败齐王元吉，关中震动。秦王李世民率众拒之，武周大将宋金刚败绩，武周奔突厥，后为突厥所杀。' },
  // 历史：梁师都，夏州朔方人，隋末据朔方郡，自称大丞相，后称帝，国号梁，引突厥南下，
  // 割据十余年，唐贞观初太宗遣柴绍等破之，从父弟洛仁杀之以降。
  { id: 'v18_liang_shidu', name: '梁师都', faction: null, role: '隋末割据',
    command: 70, force: 65, intel: 60, politics: 68, loyalty: 70, portrait: 'v18_liang_shidu',
    age: 45, skills: ['xiaoxiong', 'shoucheng_mingjiang'],
    bonds: ['v18_liu_wuzhou'],
    description: '夏州朔方人。隋末罢归乡，阴结徒党。大业十三年，杀郡丞唐世宗，据朔方郡，自称大丞相，连突厥。突厥号为大度毗伽可汗。遂即皇帝位，国号梁，建元永隆。频引突厥入寇，唐高祖屡讨不克。贞观初，太宗遣柴绍、薛万均击之，其从父弟洛仁斩师都以城降。' },
  // 历史：林士弘，鄱阳人，隋末据虔州，自称皇帝，国号楚，控制北至九江、南至番禺之地，
  // 后为唐将张善安、洪州兵所破，走死安城。
  { id: 'v18_lin_shihong', name: '林士弘', faction: null, role: '隋末楚帝',
    command: 72, force: 70, intel: 58, politics: 62, loyalty: 70, portrait: 'v18_lin_shihong',
    age: 38, skills: ['wangzhe_qiqi', 'xiaoxiong'],
    bonds: ['v18_li_zitong'],
    description: '鄱阳人。隋末从乡人操师乞起,师乞没，士弘代领其众，大败隋将刘子翊于彭蠡，众至十余万。遂据虔州，自称皇帝，国号楚，建元太平。北自九江，南及番禺，皆有之。后徙余干，为唐兵所破，走安城，病死。' },
  // 历史：杜伏威，齐州章丘人，隋末与辅公祏起事，转战淮南，号上冢王，降唐后拜和州总管，
  // 封吴王，入朝留长安，暴卒。
  { id: 'v18_du_fuwei', name: '杜伏威', faction: null, role: '隋末吴王',
    command: 80, force: 86, intel: 68, politics: 70, loyalty: 72, portrait: 'v18_du_fuwei',
    age: 32, skills: ['mengjiang', 'xiaoxiong'],
    bonds: ['v18_fu_gongshi'],
    description: '齐州章丘人。少落拓，不治生业。与辅公祏友善，俱亡命为盗，时年十六。隋末转掠淮南，众渐盛，号为上冢王。隋将陈棱击之，伏威大破其军。遂据历阳，自称总管。武德初，降唐，和州总管，封吴王，赐姓李氏。后入朝，留长安，未几暴薨。' },
  // 历史：辅公祏，齐州临济人，与杜伏威同起，伏威入朝后留守丹阳，遂反，称帝国号宋，
  // 为李孝恭、李靖所讨平。
  { id: 'v18_fu_gongshi', name: '辅公祏', faction: null, role: '隋末宋帝',
    command: 76, force: 80, intel: 60, politics: 62, loyalty: 65, portrait: 'v18_fu_gongshi',
    age: 36, skills: ['mengjiang', 'xiaoxiong'],
    bonds: ['v18_du_fuwei'],
    description: '齐州临济人。与杜伏威少相爱，同起为盗，伏威推为盟主。后伏威据历阳，公祏为长史，独当方面。伏威入朝，留公祏守丹阳。公祏遂矫称伏威不得还江南，书令起兵，即称帝，国号宋。唐以李孝恭、李靖、李勣等讨之，公祏败走，被杀。' },
  // 历史：沈法兴，湖州武康人，隋末起兵据江南十余郡，自称梁王，后为李子通所败，赴江死。
  { id: 'v18_shen_faxing', name: '沈法兴', faction: null, role: '隋末梁王',
    command: 68, force: 60, intel: 62, politics: 70, loyalty: 68, portrait: 'v18_shen_faxing',
    age: 45, skills: ['rujiang', 'xiaoxiong'],
    bonds: ['v18_li_zitong'],
    description: '湖州武康人。隋末为吴兴郡守，以讨宇文化及为名，发兵东下，据江表十余郡，自称江南道大总管，承制置百官。遂称梁王，建元延康。后李子通渡江攻之，法兴数败，左右多离散，乃赴江死。' },
  // 历史：李子通，东海人，隋末起于长白山，渡淮据江都，称吴帝，后为杜伏威所破，被执死。
  { id: 'v18_li_zitong', name: '李子通', faction: null, role: '隋末吴帝',
    command: 74, force: 78, intel: 60, politics: 62, loyalty: 68, portrait: 'v18_li_zitong',
    age: 35, skills: ['mengjiang', 'wangzhe_qiqi'],
    bonds: ['v18_lin_shihong', 'v18_shen_faxing'],
    description: '东海人。少以渔猎为生，轻死好施。隋末依长白山贼左才相，渐自聚众。渡淮，与杜伏威合。隋将来整破之，子通走海陵，有众二万，自称将军。遂据江都，称皇帝，国号吴，建元明政。后杜伏威遣王雄诞击破之，子通穷蹙请降，至长安，谋叛，死。' },
  // 历史：薛举，河东汾阴人，隋末据金城，自称西秦霸王，旋称帝，号秦，大破唐军于浅水原，
  // 方欲进取长安，会病死。
  { id: 'v18_xue_ju', name: '薛举', faction: null, role: '隋末秦帝',
    command: 80, force: 85, intel: 62, politics: 65, loyalty: 72, portrait: 'v18_xue_ju',
    age: 42, skills: ['mengjiang', 'wangzhe_qiqi'],
    bonds: ['v18_xue_rengao'],
    description: '河东汾阴人，徙兰州金城。举凶悍善射，骁武绝伦，家巨富，好交结豪侠。隋末，金城令郝瑗募兵讨贼，举因其集，劫郡县官，开仓赈施，自称西秦霸王，建元秦兴。尽有陇西之地，众至十三万，遂称帝。唐秦王世民击之，举大破唐军于浅水原，方乘胜进取，会疾卒。' },
  // 历史：薛仁杲，薛举子，多力善骑射，军中号万人敌，性贪好杀。父死继立，为秦王李世民
  // 破于浅水原，追降，斩于长安。
  { id: 'v18_xue_rengao', name: '薛仁杲', faction: null, role: '隋末秦太子',
    command: 78, force: 90, intel: 55, politics: 45, loyalty: 70, portrait: 'v18_xue_rengao',
    age: 25, skills: ['mengjiang', 'xiaoyong_shanzhan'],
    bonds: ['v18_xue_ju'],
    description: '薛举之子。多力善骑射，军中号为万人敌，所战无前。然性贪而好杀，嗜杀人，务为苛虐。举卒，仁杲立，居于折墌城。秦王世民率军围之，泾水原一战，仁杲大将浑折支、翟长孙等降，仁杲计穷，出城降。至长安，斩于市。' },
  // 历史：李轨，武威姑臧人，隋末据河西五郡，自称河西大凉王，旋称帝，后为唐所执杀。
  { id: 'v18_li_gui', name: '李轨', faction: null, role: '隋末凉王',
    command: 66, force: 60, intel: 65, politics: 70, loyalty: 68, portrait: 'v18_li_gui',
    age: 43, skills: ['rujiang', 'xiaoxiong'],
    bonds: ['v18_xue_ju'],
    description: '字处则，武威姑臧人。略知书，有智辩，家以财称，好周人之急。隋末，河西饥，盗贼起，轨与同郡曹珍等谋，共起兵据河西，自称河西大凉王，建元安乐。未几，尽有河西五郡之地，遂称帝。唐高祖遣张俟德拜为凉王，轨不受，后其将安兴贵执之送长安，斩。' },
  // 历史：李密，辽东襄平人，隋末瓦岗军后期领袖，自称魏公，据洛口，号令天下，后败降唐
  // 复叛，为唐军所杀。
  { id: 'v18_li_mi', name: '李密', faction: null, role: '隋末魏公',
    command: 86, force: 70, intel: 90, politics: 82, loyalty: 75, portrait: 'v18_li_mi',
    age: 38, skills: ['mouliao_baichu', 'wangzhe_qiqi'],
    bonds: ['v18_zhai_rang', 'v18_pei_renshi'],
    description: '字玄邃，本辽东襄平人，徙京兆长安。父宽，隋上柱国、蒲山郡公。密以父荫为左亲侍，好学，尝乘黄牛，挂《汉书》于角，且行且读。杨玄感反，引为谋主。玄感败，密亡命，抵瓦岗，说翟让聚众。让推密为主，号魏公，年号永平，破兴洛仓，开仓恣食，众至数十万。后与王世充战，败，归唐，又叛，兵败死。' },
  // 历史：翟让，东郡韦城人，隋末瓦岗军初代领袖，后推李密为主，为密所杀。
  { id: 'v18_zhai_rang', name: '翟让', faction: null, role: '瓦岗初代',
    command: 74, force: 82, intel: 58, politics: 50, loyalty: 70, portrait: 'v18_zhai_rang',
    age: 42, skills: ['mengjiang', 'xiaoxiong'],
    bonds: ['v18_li_mi'],
    description: '东郡韦城人。初为东郡法曹，坐事当斩，越狱亡命，亡入瓦岗寨，聚众起为盗。同郡单雄信、徐世勣皆往从之，众至万余。会杨密亡命来归，密为画策，说诸小股皆附，让乃推密为魏公，自为司徒。后密忌之，会置酒，伏壮士斩让及兄弘、兄子摩侯等。' },
  // 历史：罗艺，襄州襄阳人，隋末据幽州，自称幽州总管，先归唐赐姓李，封燕郡王，后叛突厥，
  // 为左右所杀。
  { id: 'v18_luo_yi', name: '罗艺', faction: null, role: '唐初燕王',
    command: 80, force: 85, intel: 62, politics: 58, loyalty: 60, portrait: 'v18_luo_yi',
    age: 40, skills: ['mengjiang', 'guanlong_jituan'],
    bonds: ['v17_xu_shiji'],
    description: '字子延，本襄州襄阳人，寓居京兆云阳。父荣，隋监门将军。艺性桀黠，刚愎不仁，勇于攻战，善射，能弄槊。大业中，以军功补虎贲郎将，擢涿郡通守。隋末，逐郡丞，自称幽州总管。唐初，奉表归国，封燕王，赐姓李，预籍宗正属籍。后举兵反唐，据豳州，败，奔突厥，为左右所杀。' },
  // 历史：屈突通，长安人，隋末名将，镇关中，唐兵渡河，通战败被擒，太宗释之，从平天下，
  // 凌烟阁二十四功臣之一。
  { id: 'v18_qu_tutong', name: '屈突通', faction: null, role: '隋唐名将',
    command: 84, force: 78, intel: 75, politics: 72, loyalty: 85, portrait: 'v18_qu_tutong',
    age: 50, skills: ['dudu_zhongwai', 'mouliao_baichu'],
    bonds: ['v17_li_jing', 'v17_xu_shiji'],
    description: '雍州长安人。父长卿，隋邛州刺史。通性刚毅，自奉谨至，好武略，善骑射。仕隋，累迁左骁卫大将军，讨杨玄感有破功。唐兵起，隋主遣通镇潼关。及刘文静渡河，通出战，大败，被擒。高祖释之，授兵部尚书，为秦王府行军长史。从平薛举、王世充，论功第一，封蒋国公。图形凌烟阁。' },
  // 历史：裴仁基，河东人，隋末名将，监军怀荣，为李密所逼降密，后谋暗杀密复隋室，事泄为
  // 密所杀。子裴行俨，号万人敌。
  { id: 'v18_pei_renshi', name: '裴仁基', faction: null, role: '隋唐名将',
    command: 80, force: 76, intel: 68, politics: 60, loyalty: 65, portrait: 'v18_pei_renshi',
    age: 48, skills: ['dudu_zhongwai', 'shoucheng_mingjiang'],
    bonds: ['v18_li_mi', 'v17_qin_shubao'],
    description: '河东人。少骁勇，善弓马，以军功为隋将。炀帝时，为光禄大夫，遣讨李密，监军怀荣。为御史所讥，惧而杀御史，以众降密。密待之厚，使与孟让袭回洛仓。后王世充密战，仁基与子行俨并力赴敌，行俨中流矢坠马，仁基驰救之，所杀数十人。后谋诛世充，复越王侗，事泄，为世充所杀。' },

  // ---- V19.0 隋末唐初群雄/唐初功臣（15）----
  // 历史：杨玄感，司徒杨素之子，袭爵楚国公。隋炀帝伐高句丽，命黎阳督运。
  // 见天下思乱，遂谋叛，屯黎阳，众至十余万。围东都不克，西欲图关右，
  // 至弘农宫，为追兵所及，众溃，自杀。
  { id: 'v19_yang_xuangan', name: '杨玄感', faction: null, role: '隋末叛臣',
    command: 70, force: 65, intel: 72, politics: 68, loyalty: 30, portrait: 'v19_yang_xuangan',
    age: 38, skills: ['xiaoxiong', 'mouliao_baichu'],
    bonds: ['v18_li_mi', 'v15_yuwen_shu'],
    description: '字崇山，弘农华阴人，司徒杨素之子。晚好读书，善骑射，以父勋拜柱国，累迁礼部尚书。炀帝伐高句丽，命于黎阳督运。时天下思乱，玄感遂谋叛，入黎阳，索舟屯，募运夫，得万余人，众至十余万。围东都，不克。西欲图关右，至弘农宫，为追兵所及，众溃，玄感自知不免，令其弟积善杀己。传首东都，磔于市。' },
  // 历史：司马德戡，扶风雍人，隋末屯卫骁果将领。炀帝在江都，骁果思归，
  // 德戡与宇文智及、裴虔通等合谋，夜率骁果作乱，弑炀帝。后为宇文化及所杀。
  { id: 'v19_sima_dekan', name: '司马德戡', faction: null, role: '江都弑逆',
    command: 65, force: 70, intel: 55, politics: 45, loyalty: 25, portrait: 'v19_sima_dekan',
    age: 35, skills: ['xiaoxiong', 'mengjiang'],
    bonds: ['v19_pei_qiantong', 'v17_yuwen_huaji'],
    description: '扶风雍人。幼孤，以屠豕为业。有膂力，善骑射，走马若飞。仕隋，为大都督，从炀帝至江都，领左右骁果。时关中士马思归，德戡与宇文化及、智及、裴虔通等合谋，夜率骁果作乱，引帝出，弑之。化及自称大丞相，以德戡为礼部尚书，外示美迁，实夺其兵。德戡怨，谋攻化及，事泄，为所杀。' },
  // 历史：裴虔通，河东人，炀帝为晋王时亲信。炀帝在江都，虔通与司马德戡
  // 同谋弑逆，引兵入宫。唐贞观初，以弑君之罪除名徙边。
  { id: 'v19_pei_qiantong', name: '裴虔通', faction: null, role: '江都弑逆',
    command: 60, force: 65, intel: 50, politics: 40, loyalty: 20, portrait: 'v19_pei_qiantong',
    age: 40, skills: ['mengjiang', 'xiaoxiong'],
    bonds: ['v19_sima_dekan', 'v17_yuwen_huaji'],
    description: '河东人。炀帝为晋王时，以亲信左右从入东宫。及即位，累迁监门直阁。江都之变，虔通与司马德戡同谋，夜领宫城门兵，引化及之众入玄武门。帝闻变，易服逃西阁，虔通引兵入，执帝。及化及僭号，以为光禄大夫。唐武德初，以罪徙岭表。贞观中，以弑逆之罪，除名削爵，徙于驩州而死。' },
  // 历史：柴绍，晋州临汾人，唐初名将。娶李渊女平阳昭公主。从李渊起兵，
  // 平长安，破薛举、破宋金刚、灭王世充、窦建德，又平梁师都。
  // 凌烟阁二十四功臣之一。
  { id: 'v19_chai_shao', name: '柴绍', faction: null, role: '唐初名将',
    command: 84, force: 82, intel: 75, politics: 70, loyalty: 90, portrait: 'v19_chai_shao',
    age: 38, skills: ['dudu_zhongwai', 'mengjiang'],
    bonds: ['v17_li_jing', 'v18_li_gui'],
    description: '字嗣昌，晋州临汾人。幼趫捷，有武力，任侠闻于关中。尚唐高祖女平阳昭公主。唐高祖起兵，绍即赴太原，领马军总管。从平长安，破薛举，破宋金刚，灭王世充、窦建德，皆有功。贞观初，迁右卫大将军，累转右骁卫大将军，柴绍又破突厥，平梁师都。图形凌烟阁。' },
  // 历史：尉迟敬德，朔州善阳人，名恭，以字行。初从刘武周，后降唐。
  // 从太宗讨王世充、破窦建德、破刘黑闼。玄武门之变，射杀李元吉，
  // 功居第一。凌烟阁二十四功臣之一。
  { id: 'v19_yuchi_jingde', name: '尉迟敬德', faction: null, role: '唐初名将',
    command: 86, force: 92, intel: 70, politics: 65, loyalty: 92, portrait: 'v19_yuchi_jingde',
    age: 38, skills: ['dudu_zhongwai', 'xiaoyong_shanzhan'],
    bonds: ['v17_qin_shubao', 'v17_cheng_yaojin'],
    description: '朔州善阳人，名恭，以字行。善骑射，善避矟，每单骑入贼阵，贼兵攒矟，终莫能伤。初从刘武周，为偏将。武周败，敬德举介州降唐。太宗素闻其勇，引为右一府统军。从讨王世充、破窦建德、破刘黑闼，每陷阵却敌。玄武门之变，敬德射杀李元吉，首建成、元吉二府，功居第一。累迁右武候大将军，封鄂国公。图形凌烟阁。' },
  // 历史：长孙无忌，河南洛阳人，长孙晟之子，长孙皇后之兄。
  // 从太宗起兵，为心腹，玄武门之变主谋。太宗朝，累迁尚书右仆射，
  // 封赵国公。凌烟阁二十四功臣之首。
  { id: 'v19_changsun_wuji', name: '长孙无忌', faction: null, role: '唐初宰相',
    command: 55, force: 40, intel: 90, politics: 95, loyalty: 90, portrait: 'v19_changsun_wuji',
    age: 35, skills: ['mouliao_baichu', 'guanlong_jituan'],
    bonds: ['v19_fang_xuanling', 'v19_du_ruhui'],
    description: '字辅机，河南洛阳人，右骁卫将军长孙晟之子，太宗长孙皇后之兄。贵戚好学，该博文史，性通悟，有筹略。太宗为秦王时，无忌常从征伐，引为心腹，出入卧内。玄武门之变，无忌与房玄龄、杜如晦等劝秦王定计，事平，转太子左庶子。太宗即位，累迁尚书右仆射，封赵国公。图形凌烟阁，位居第一。' },
  // 历史：房玄龄，齐州临淄人，唐初名相。年十八，本州举进士。
  // 太宗入渭北，玄龄杖策谒军门，太宗一见如旧识。
  // 贞观朝为相十五年，与杜如晦合称房谋杜断。
  { id: 'v19_fang_xuanling', name: '房玄龄', faction: null, role: '唐初宰相',
    command: 30, force: 20, intel: 92, politics: 95, loyalty: 88, portrait: 'v19_fang_xuanling',
    age: 38, skills: ['mouliao_baichu', 'guanlong_jituan'],
    bonds: ['v19_changsun_wuji', 'v19_du_ruhui'],
    description: '齐州临淄人，字乔。幼聪敏，博贯经史，善属文，书兼草隶。年十八，本州举进士。唐太宗徇地渭北，玄龄杖策谒于军门，一见便如旧识，署渭北道行军记室参军。每征伐，恒掌书记，军中书檄，驻马立成。贞观元年，为中书令，封邢国公。三年，拜尚书左仆射，总司百揆。与杜如晦共掌朝政，世称房谋杜断。' },
  // 历史：杜如晦，京兆杜陵人，唐初名相。太宗为秦王，如晦为王府属，
  // 从征四方，常典机要。贞观初，与房玄龄共掌朝政，世称房谋杜断。
  { id: 'v19_du_ruhui', name: '杜如晦', faction: null, role: '唐初宰相',
    command: 35, force: 25, intel: 90, politics: 92, loyalty: 88, portrait: 'v19_du_ruhui',
    age: 36, skills: ['mouliao_baichu', 'guanlong_jituan'],
    bonds: ['v19_changsun_wuji', 'v19_fang_xuanling'],
    description: '字克明，京兆杜陵人。聪悟多能，克应机辨，同舍莫能屈。隋大业中，吏部侍郎高孝基深器重之，谓有栋梁之用。太宗平京城，引为秦王府兵曹参军，常参征伐，常典机要。隐太子以如晦、房玄龄为秦王心膂，谮之于高祖，遂与玄龄同逐。及玄武门事定，太宗即位，拜兵部尚书，封蔡国公。贞观二年，迁右仆射，与玄龄共掌朝政。世称房谋杜断。' },
  // 历史：李孝恭，唐宗室，李渊从侄。唐高祖起兵，孝恭招慰山南，
  // 自金川出击，所至多降下。平萧铣、辅公祏，经略江淮。
  // 凌烟阁二十四功臣之一。
  { id: 'v19_li_xiaogong', name: '李孝恭', faction: null, role: '唐初宗室名将',
    command: 82, force: 75, intel: 78, politics: 80, loyalty: 85, portrait: 'v19_li_xiaogong',
    age: 32, skills: ['dudu_zhongwai', 'mouliao_baichu'],
    bonds: ['v17_li_jing', 'v18_fu_gongshi'],
    description: '唐宗室，趡王李蔚之孙，唐高祖从父兄子。少有识量。唐高祖起兵，孝恭招慰山南，自金川出击，所至皆下。进击朱粲，破之。荆门纵兵，尽取岭南地。迁荆州总管，大治屯田，为政清易。及辅公祏反，命孝恭为行军元帅，李靖副之，东讨，破公祏，江南遂定。迁礼部尚书，封河间王。图形凌烟阁。' },
  // 历史：李建成，唐高祖李渊长子。隋末，李渊起兵太原，建成率兵
  // 定西河、下新丰、破长安。武德元年，立为皇太子。后与秦王李世民
  // 有隙，武德九年玄武门之变，为李世民所射杀。
  { id: 'v19_li_jiancheng', name: '李建成', faction: null, role: '唐太子',
    command: 70, force: 65, intel: 70, politics: 75, loyalty: 75, portrait: 'v19_li_jiancheng',
    age: 35, skills: ['wangzhe_qiqi', 'guanlong_jituan'],
    bonds: ['v19_li_yuanji', 'v17_wei_zheng'],
    description: '唐高祖李渊长子。隋末，高祖起兵太原，建成与弟世民率兵定西河、下永丰仓、破长安。武德元年，立为皇太子。时太宗功业日盛，建成与齐王元吉谋倾太宗，数以毒酒隐太子。武德九年，太白经天，秦王乃密奏建成、元吉淫乱后宫。六月四日，太宗伏兵玄武门，射杀建成，元吉亦为尉迟敬德所杀。高祖遂立太宗为太子。' },
  // 历史：李元吉，唐高祖李渊第四子，封齐王。从太宗讨王世充、
  // 刘黑闼。与太子建成谋倾太宗，玄武门之变，为尉迟敬德所杀。
  { id: 'v19_li_yuanji', name: '李元吉', faction: null, role: '唐齐王',
    command: 72, force: 80, intel: 55, politics: 50, loyalty: 72, portrait: 'v19_li_yuanji',
    age: 24, skills: ['mengjiang', 'xiaoyong_shanzhan'],
    bonds: ['v19_li_jiancheng', 'v19_yuchi_jingde'],
    description: '唐高祖李渊第四子。初封姑臧郡公，进封齐王。从太宗平东都，破刘黑闼。元吉素骄侈，多养奴婢，纵左右侵扰百姓。及秦王与建成有隙，元吉劝建成早除秦王，许以天下。武德九年六月，太宗伏兵玄武门，建成先为太宗射杀，元吉驰赴，敬德跃马叱之，元吉坠马，为敬德所射杀。' },
  // 历史：刘黑闼，贝州漳南人，隋末从窦建德为将，建德败，黑闼归乡里。
  // 建德故将畏罪，复推黑闼为主，复建德故地，称汉东王。
  // 后为太宗、太子建成所破，败走突厥，复来，为唐将所斩。
  { id: 'v19_liu_heita', name: '刘黑闼', faction: null, role: '隋末汉东王',
    command: 82, force: 86, intel: 65, politics: 60, loyalty: 70, portrait: 'v19_liu_heita',
    age: 40, skills: ['mengjiang', 'xiaoxiong'],
    bonds: ['v17_dou_jiande', 'v18_li_mi'],
    description: '贝州漳南人。隋末从郝孝德为盗，后归李密。密败，为王世充所获，使骑将。后亡归窦建德，建德以为将军，封汉东郡公。建德败，黑闼归乡里，杜门称疾。建德故将多残暴，畏不自安，乃相与求得建德故将刘雅，雅不从，杀之。因诣漳南，迎黑闼为主，举兵复建德故地，半年悉复。称汉东王，建元天造。唐太宗、太子建成相继讨之，黑闼数败，奔突厥，复引突厥来，至饶阳，为其部下诸葛德威所执，送太子建成，斩于洺州。' },
  // 历史：单雄信，曹州济阴人，隋末与翟让同起瓦岗，善用马槊，
  // 军中号飞将。李密败，降王世充。洛阳平，为李世民所斩。
  { id: 'v19_dan_xiongxin', name: '单雄信', faction: null, role: '瓦岗飞将',
    command: 80, force: 88, intel: 55, politics: 45, loyalty: 65, portrait: 'v19_dan_xiongxin',
    age: 38, skills: ['mengjiang', 'xiaoyong_shanzhan'],
    bonds: ['v18_zhai_rang', 'v18_li_mi', 'v19_wang_bodang'],
    description: '曹州济阴人。少骁健，善用马槊，瓦岗军中号为飞将。隋末与翟让同起瓦岗，李密之让也，雄信与徐世勣俱属密。密与王世充战，雄信领内马军，屯偃师。密败，雄信遂降世充，世充以为大将军。秦王太宗围东都，雄信拒战，几及太宗，徐世勣呵止之，乃止。洛阳平，太宗命斩雄信于洛水之上。' },
  // 历史：王伯当，隋末瓦岗军将。初从李密，密败，王伯当从之入关。
  // 后密欲叛唐，伯当谏止，密不听，伯当曰：义士之举，不系成败，
  // 吾荷公恩，当与公共死。遂与密同被杀。
  { id: 'v19_wang_bodang', name: '王伯当', faction: null, role: '瓦岗义将',
    command: 72, force: 78, intel: 68, politics: 60, loyalty: 88, portrait: 'v19_wang_bodang',
    age: 32, skills: ['mengjiang', 'shoucheng_mingjiang'],
    bonds: ['v18_li_mi', 'v19_dan_xiongxin'],
    description: '隋末瓦岗军将。初从李密，为密腹心。密之败也，伯当随密入关，唐授密光禄卿，封邢国公。密自以失位，意不平，遂谋叛，谓伯当曰：今若复叛，吾必以众还山东。伯当谏曰：天下事岂有如此！明公，世之丈夫，义之所在，不系成败。然荷公恩深，不敢负耳。密不听，遂与密同起兵桃林，袭其县，驱掠徒党，南趣南山，诡言往襄城。唐将盛彦师邀击之，遂与密同被害。' },
  // 历史：苏定方，冀州武邑人，唐初名将。隋末从窦建德，后归唐。
  // 从李靖袭突厥颉利于碛口，灭西突厥，平葱岭，灭百济，
  // 封邢国公。图像凌烟阁。
  { id: 'v19_su_dingfang', name: '苏定方', faction: null, role: '唐初名将',
    command: 88, force: 85, intel: 78, politics: 70, loyalty: 85, portrait: 'v19_su_dingfang',
    age: 35, skills: ['dudu_zhongwai', 'mengjiang'],
    bonds: ['v17_li_jing', 'v17_xu_shiji'],
    description: '冀州武邑人，名烈，以字行。少慷慨，有奇节，年十余岁，从父讨贼，先驱陷阵。隋末，依窦建德，建德将高雅之爱之，养为子。及建德败，归乡里。贞观初，李靖辟为匡道府折冲。从李靖袭突厥颉利于碛口，率二百骑为前锋，乘雾而行，去颉利牙帐七里，雾止，见其庐帐，掩击之，斩获数万。累迁伊丽道行军大总管，西突厥沙钵罗可汗，悉收其地。又东渡海，灭百济，执其王义慈。封邢国公。' },

  // === V20.0 新增武将十五（隋末唐初扩编）===
  // 历史：李渊，字叔德，陇西成纪人。七岁袭唐国公。隋末为太原留守，
  // 乘乱起兵，入长安，受隋禅称帝，建国唐。
  { id: 'v20_li_yuan', name: '李渊', faction: null, role: '唐高祖',
    command: 85, force: 78, intel: 86, politics: 92, loyalty: 100, portrait: 'v20_li_yuan',
    age: 52, skills: ['wangzhe_qiqi', 'guanlong_jituan'],
    bonds: ['v20_li_shimin', 'v20_peiji'],
    description: '字叔德，陇西成纪人，西魏八柱国李虎之孙。七岁袭封唐国公。隋受禅，为千牛备身。大业中，历谯、陇、岐三州刺史。炀帝南幸江都，拜李渊为太原留守。时隋政已失，盗贼蜂起，次子世民阴结豪杰，与晋阳令刘文静、晋阳宫监裴寂谋起兵。乃自太原举义，西入长安，立代王侑为帝。逾年，受隋禅，即皇帝位，国号唐。平薛举、王世充、窦建德，天下悉定。后传位太子，是为太上皇。' },
  // 历史：李世民，李渊次子。封秦王，数将兵平群雄。玄武门之变后立为太子，即位为唐太宗。
  { id: 'v20_li_shimin', name: '李世民', faction: null, role: '唐太宗',
    command: 96, force: 90, intel: 94, politics: 92, loyalty: 95, portrait: 'v20_li_shimin',
    age: 22, skills: ['wangzhe_qiqi', 'dudu_zhongwai'],
    bonds: ['v20_li_yuan', 'v20_liu_wenjing', 'v19_yuchi_jingde', 'v17_qin_shubao'],
    description: '唐高祖次子。少聪明，玄鉴深远，临机果断。隋末，劝高祖起兵太原，自领右领军大都督，封敦煌郡公。徇渭北，下长安。武德元年，为尚书令，封秦王。先后破薛举于浅水原，破刘武周于太原，围王世充于洛阳，擒窦建德于虎牢，降世充。山东河北悉定。武德九年，玄武门之变，射杀太子建成、齐王元吉。遂立为太子，寻受内禅。即位后，屈己纳谏，任贤用能，贞观之治，号为太平。' },
  // 历史：杨侗，隋炀帝孙，封越王。炀帝被弑后，东都群臣奉为帝，年号皇泰。
  { id: 'v20_yang_dong', name: '杨侗', faction: null, role: '隋皇泰主',
    command: 45, force: 40, intel: 60, politics: 62, loyalty: 70, portrait: 'v20_yang_dong',
    age: 14, skills: ['mouliao_baichu', 'wangzhe_qiqi'],
    bonds: ['v20_yang_you', 'v19_wang_shichong'],
    description: '隋炀帝之孙，元德太子昭之子，初封越王。炀帝巡幸江都，命侗留守东都洛阳。义宁二年，炀帝被弑于江都，东都官员段达、王世充等乃奉侗即皇帝位，年号皇泰。时年方幼，政事皆决于王世充。未几，世充自称郑王，寻废侗为潞国公，寻杀之，隋祀遂绝。' },
  // 历史：杨侑，隋炀帝孙，封代王。李渊入长安，立为帝，年号义宁，旋禅位于唐。
  { id: 'v20_yang_you', name: '杨侑', faction: null, role: '隋恭帝',
    command: 40, force: 38, intel: 58, politics: 60, loyalty: 70, portrait: 'v20_yang_you',
    age: 12, skills: ['mouliao_baichu', 'wangzhe_qiqi'],
    bonds: ['v20_li_yuan', 'v20_yang_dong'],
    description: '隋炀帝孙，元德太子昭第三子，初封代王。炀帝亲征辽东，命侑留守京师。大业十三年，李渊自太原起兵，渡河克长安，迎侑即皇帝位，改元义宁，遥尊炀帝为太上皇。渊自为大丞相，封唐王。明年五月，炀帝凶问至长安，渊遂受禅，废侑为酅国公。唐武德二年薨，年十五，谥恭皇帝，隋亡。' },
  // 历史：杨浩，隋文帝孙，秦孝王俊之子。宇文化及弑炀帝，立浩为帝，寻鸩杀之。
  { id: 'v20_yang_hao', name: '杨浩', faction: null, role: '隋秦王',
    command: 38, force: 35, intel: 50, politics: 48, loyalty: 60, portrait: 'v20_yang_hao',
    age: 22, skills: ['mouliao_baichu', 'xiaoxiong'],
    bonds: ['v20_yong', 'v19_yuwen_huaji'],
    description: '隋文帝孙，秦孝王杨俊之子。俊妃崔氏毒杀俊，浩坐失爵。炀帝即位，封浩为秦王。从炀帝幸江都。宇文化及弑炀帝，秘不发丧，立浩为帝，居之别室，令诏敕署名而已。化及自江都还，至彭城，鸩杀浩，僭即帝位。浩在位无几，为化及所篡。' },
  // 历史：杨勇，隋文帝长子，初立为太子。后失宠，废为庶人。炀帝即位，赐死。
  { id: 'v20_yong', name: '杨勇', faction: null, role: '隋废太子',
    command: 60, force: 58, intel: 65, politics: 60, loyalty: 75, portrait: 'v20_yong',
    age: 40, skills: ['guanlong_jituan', 'mouliao_baichu'],
    bonds: ['v20_dugu_qieluo', 'v19_yang_jian'],
    description: '隋文帝长子。仕周，封博平侯。受禅，立为皇太子。勇颇好学，属词赋，然率意任情，无矫饰之行。多内宠，昭训云氏擅宠，母独孤皇后不悦。晋王广与杨素等媒孽其短，文皇惑之，遂废勇为庶人，立广为太子。及文皇崩，广即炀帝，伪为文皇诏，赐死勇。诸子皆徙岭表。' },
  // 历史：冼夫人，高凉冼氏女，世为南越首领。历梁陈隋三世，保境安民，封谯国夫人。
  { id: 'v20_xian_furen', name: '冼夫人', faction: null, role: '谯国夫人',
    command: 80, force: 72, intel: 82, politics: 88, loyalty: 90, portrait: 'v20_xian_furen',
    age: 60, skills: ['shoucheng_mingjiang', 'jingtu_tuzhi'],
    bonds: ['v20_fang_ang', 'v17_chen_baxian'],
    description: '高凉冼氏之女。世为南越首领，部落十余万家。夫人幼贤明，多筹略，在父母家，抚循部众，能行军用师，压服诸越。嫁高凉太守冯宝。梁永定二年，子冯仆率诸峒长入朝，拜阳春郡守。陈亡，岭南数郡共奉夫人，号为圣母。隋遣总管韦洸安抚岭表，夫人遣孙魂迎洸入广州，岭南遂定。隋册为谯国夫人，开幕置僚属，有章奏，听发六州兵马，若有急切，便宜行事。' },
  // 历史：冯盎，冼夫人之孙。隋末据岭南，唐初举地归唐，封越国公。
  { id: 'v20_fang_ang', name: '冯盎', faction: null, role: '唐越国公',
    command: 78, force: 82, intel: 70, politics: 72, loyalty: 80, portrait: 'v20_fang_ang',
    age: 45, skills: ['mengjiang', 'shoucheng_mingjiang'],
    bonds: ['v20_xian_furen'],
    description: '字明远，冼夫人之孙，唐初越国公。少有武略。隋仁果初，为宋康令，从杨素击平獠乱。还，拜汉阳太守。从炀帝伐辽东，迁左武卫大将军。隋亡，奔还岭表，啸聚首领，有众五万，自守番禺、苍梧、朱崖地。武德四年，以南越之地降唐，授上柱国，封越国公。贞观初，太宗遣蔺暮发江岭兵击之，盎子智戴请拒战，盎曰：吾居越五世，惟愧不能殖产。遂入朝，太宗劳之，令还。' },
  // 历史：王薄，齐郡邹平人。隋大业首举义旗于长白山，作《无向辽东浪死歌》。
  { id: 'v20_wang_bo', name: '王薄', faction: null, role: '长白山起义首领',
    command: 65, force: 72, intel: 58, politics: 50, loyalty: 65, portrait: 'v20_wang_bo',
    age: 35, skills: ['xiaoxiong', 'mengjiang'],
    bonds: ['v18_zhai_rang', 'v17_dou_jiande'],
    description: '齐郡邹平人。隋炀帝大业七年，帝征兵伐高丽，百姓失业。薄拥众据长白山，首举义旗，自称知世郎。作《无向辽东浪死歌》以相号召，辞曰：长白山前知世郎，纯著红罗绵背裆。长槊侵天半，轮刀耀日光。上山吃獐鹿，下山吃牛羊。忽闻官军至，提刀向前荡。譬如辽东死，斩头何所伤！避征役者多往归之，众至数万。后转战山东，兵败降唐。' },
  // 历史：刘弘基，雍州池阳人。从李渊起兵，数从征伐，凌烟阁二十四功臣之一。
  { id: 'v20_liu_hongji', name: '刘弘基', faction: null, role: '唐夔国公',
    command: 78, force: 84, intel: 62, politics: 58, loyalty: 85, portrait: 'v20_liu_hongji',
    age: 35, skills: ['mengjiang', 'xiaoyong_shanzhan'],
    bonds: ['v20_li_shimin', 'v20_changsun_shunde'],
    description: '雍州池阳人。父刘升，隋河州刺史。弘基以父荫为右勋侍。大业末，从炀帝征辽东，后亡命亡命太原，阴事李渊。李世民亦深结之。及举兵，弘基自西河至，隶太宗。从克长安，破宋老生，击屈突通，功多。累迁右骁卫大将军，封夔国公。贞观末，以凌烟阁图形。高宗永徽初薨。' },
  // 历史：长孙顺德，长孙无忌族叔，李世民妻族。从唐起兵，凌烟阁功臣之一。
  { id: 'v20_changsun_shunde', name: '长孙顺德', faction: null, role: '唐薛国公',
    command: 75, force: 80, intel: 60, politics: 62, loyalty: 82, portrait: 'v20_changsun_shunde',
    age: 40, skills: ['mengjiang', 'xiaoyong_shanzhan'],
    bonds: ['v20_liu_hongji', 'v19_changsun_wuji'],
    description: '长孙顺德，文德顺圣皇后长孙氏之族叔。隋末为右勋卫，避辽东之役，亡命太原，依李渊。李世民厚加礼遇。及起兵，与刘弘基俱募兵于太原。从克霍邑，破临汾，下绛郡，擒屈突通，略地陕东，多所降下。累迁左骁卫大将军，封薛国公。贞观中，以受赇事发，除名。后召拜泽州刺史，复爵。图形凌烟阁。' },
  // 历史：段志玄，齐州临淄人。从李世民征伐，凌烟阁二十四功臣之一，封褒国公。
  { id: 'v20_duan_zhixuan', name: '段志玄', faction: null, role: '唐褒国公',
    command: 80, force: 85, intel: 66, politics: 60, loyalty: 88, portrait: 'v20_duan_zhixuan',
    age: 32, skills: ['mengjiang', 'xiaoyong_shanzhan'],
    bonds: ['v20_li_shimin', 'v19_changsun_wuji'],
    description: '名雄，以字行，齐州临淄人。父段偃师，为太原郡司法书佐。志玄从父客太原，常从李世民游，深自结纳。及高祖起兵，志玄募兵得千余人，授右领大都督府军头。从平霍邑，下绛郡，攻潼关，破屈突通。骁勇善骑射，数先登陷阵。贞观中，迁右卫大将军，封褒国公。太宗尝令敦宿卫，不俟诏命，即归营，帝益重之。图形凌烟阁。' },
  // 历史：刘文静，字肇仁，彭城人。晋阳起兵首谋，唐初宰相，封鲁国公。
  { id: 'v20_liu_wenjing', name: '刘文静', faction: null, role: '唐鲁国公',
    command: 65, force: 55, intel: 88, politics: 80, loyalty: 75, portrait: 'v20_liu_wenjing',
    age: 40, skills: ['mouliao_baichu', 'guanlong_jituan'],
    bonds: ['v20_li_yuan', 'v20_li_shimin', 'v20_pei_ji'],
    description: '字肇仁，自言彭城人，世居京兆武功。隋末为晋阳令，与晋阳宫监裴寂善。见天下方乱，自以有命世才。察李渊有四方志，深自结纳，又与李世民定谋，劝李渊起兵。大将军府建，为司马。劝改旗，连突厥，以壮军势。唐禅代，纳言。从太宗平薛举，以功授户部尚书、陕东道行台左仆射，封鲁国公。后以功高位出裴寂下，有怨言，与弟文起呼厌胜，事发被诛。' },
  // 历史：裴寂，字玄真，蒲州桑泉人。晋阳宫监，首佐李渊起兵，唐初尚书左仆射。
  { id: 'v20_pei_ji', name: '裴寂', faction: null, role: '唐梁国公',
    command: 55, force: 48, intel: 80, politics: 85, loyalty: 80, portrait: 'v20_pei_ji',
    age: 48, skills: ['mouliao_baichu', 'guanlong_jituan'],
    bonds: ['v20_li_yuan', 'v20_liu_wenjing'],
    description: '字玄真，蒲州桑泉人。隋末为晋阳宫副监，与李渊情契款洽。李世民谋起兵，恐渊不从，寂乃私以晋阳宫人侍渊，渊从之。寂因说渊起兵，发宫库、武库以佐军。大将军府建，寂为长史，封闻喜县公。唐受禅，迁尚书右仆射，赐与无数，朝贵无以为比。后改魏国公，加左仆射。与刘文静素不平，构成其狱。太宗贞观初，坐事免官，放归私第，卒。' },
  // 历史：独孤伽罗，云中洛阳人，北周大司马独孤信之女，隋文帝皇后。
  { id: 'v20_dugu_qieluo', name: '独孤伽罗', faction: null, role: '隋文献皇后',
    command: 40, force: 35, intel: 82, politics: 88, loyalty: 90, portrait: 'v20_dugu_qieluo',
    age: 48, skills: ['wangzhe_qiqi', 'ciemao_fengliu'],
    bonds: ['v19_yang_jian', 'v20_yong'],
    description: '云中洛阳人，北周大司马、河内公独孤信之女。信见杨坚奇之，以女伽罗嫁之。年十四。及杨坚受禅，立为皇后。后初亦柔顺恭孝，不失妇道。然性尤妒忌，又好读书，与政。开皇初，突厥与中国交市，有明珠一箧，价直八百万，幽州总管阴寿白后市之。后曰：非我所须也，不如以颁有功。由是六宫咨仰。后以太子杨勇多内宠，爱晋王广，与杨素谮之，竟废勇立广，隋祚遂移。' },
  // ===== V21.0 新增武将（15位，隋唐/突厥）=====
  // 薛仁贵，绛州龙门人。唐初名将，善骑射，三箭定天山，威震夷狄。
  { id: 'v21_xue_rengui', name: '薛仁贵', faction: null, role: '唐平阳郡公',
    command: 88, force: 92, intel: 74, politics: 60, loyalty: 88, portrait: 'v21_xue_rengui',
    age: 30, skills: ['mengjiang', 'xiaoyong_shanzhan'],
    bonds: ['v20_li_shimin', 'v21_zhang_gongjin'],
    description: '绛州龙门人。少贫贱，以田为业。善骑射。太宗征辽东，仁贵应募。及安地城外，莫离支将兵拒战，仁贵恃骁悍，欲立奇功，乃著白衣，自标异，持戟，腰鞬两弓，呼而驰，所向披靡。帝望见，驰遣问：白衣先锋谁？曰薛仁贵。帝召见，赐金马甚厚。自是屡从征伐。高宗时，领兵击九姓突厥于天山，将行，帝赐之甲，谓曰：古善射有穿七札者，卿且射五甲。仁贵一发洞贯。九姓众十余万，令骁骑数十来挑战，仁贵三矢辄杀三人，于是虏气慑，皆降。军中歌曰：将军三箭定天山，壮士长歌入汉关。' },
  // 裴行俭，绛州闻喜人。唐初名将，兼通历术，平定西突厥阿史那都支。
  { id: 'v21_pei_xingjian', name: '裴行俭', faction: null, role: '唐闻喜县公',
    command: 84, force: 70, intel: 90, politics: 82, loyalty: 85, portrait: 'v21_pei_xingjian',
    age: 45, skills: ['mouliao_baichu', 'jingtu_tuzhi'],
    bonds: ['v20_li_shimin', 'v21_hou_junji'],
    description: '字守约，绛州闻喜人。隋礼部尚书裴仁基之子。幼以门荫为弘文生。贞观中，举明经，拜左屯卫仓曹参军。时苏定方为大将军，一见异之，尽以用兵奇术授之。仪凤二年，十姓可汗阿史那都支叛，诱扇蕃落。朝廷欲发兵讨之，行俭以为大讨之后方，不可再劳师。会波斯王卒，子在京师，请遣使送之还国，道须便图都支。乃命行俭册送波斯王。行俭少学兵法，及是，假借缮修，过漠北，计擒都支，悉降诸部。遂立碑纪功而还。' },
  // 张公谨，魏州繁水人。凌烟阁二十四功臣，预玄武门之谋。
  { id: 'v21_zhang_gongjin', name: '张公谨', faction: null, role: '唐郯国公',
    command: 78, force: 76, intel: 84, politics: 80, loyalty: 88, portrait: 'v21_zhang_gongjin',
    age: 35, skills: ['mouliao_baichu', 'guanlong_jituan'],
    bonds: ['v20_li_shimin', 'v21_hou_junji'],
    description: '字弘慎，魏州繁水人。初为王世充洧州长史，与刺史以城归国。李勣、尉迟敬德荐于秦王，引入幕府，数有参谋。秦王将讨建成、元吉，卜之，公谨自外入，取龟投地，曰：卜以决疑，今事在不疑，尚何卜乎！卜而不吉，庸得已乎！王大悟。及诛建成，公谨独闭关拒战，以功授左武候将军。贞观初，代李靖为定襄道行军总管，击破突厥，颉利可汗遁走。进封邹国公。卒于官，图形凌烟阁。' },
  // 侯君集，豳州三水人。凌烟阁功臣，从太宗征伐，讨高昌。
  { id: 'v21_hou_junji', name: '侯君集', faction: null, role: '唐陈国公',
    command: 82, force: 80, intel: 78, politics: 66, loyalty: 70, portrait: 'v21_hou_junji',
    age: 40, skills: ['mengjiang', 'dudu_zhongwai'],
    bonds: ['v20_li_shimin', 'v21_zhang_gongjin'],
    description: '豳州三水人。性骄饰，好夸诞，姿仪矯捷，矜弓矢。秦王素知之，引入幕府，数从征战，累除左虞候车骑将军。武德间，预诛建成、元吉，其力居多。贞观中，为西海道行军大总管，督诸将讨吐谷浑，与李靖大破之。又为交河道行军大总管，率兵讨高昌王麴智盛，拔其城，下三郡、五县、二十二城，户八千。及还，以私取宝物，有司劾之，系狱。既得出，怏怏不平。后以太子承乾事，牵连被诛。' },
  // 牛进达，唐初名将，从太宗征高丽，累迁右武卫大将军。
  { id: 'v21_niu_jinda', name: '牛进达', faction: null, role: '唐琅玡郡公',
    command: 78, force: 82, intel: 64, politics: 58, loyalty: 85, portrait: 'v21_niu_jinda',
    age: 38, skills: ['mengjiang', 'xiaoyong_shanzhan'],
    bonds: ['v20_li_shimin', 'v21_xue_rengui'],
    description: '名秀，以字行，陇西人。隋末群雄并起，进达先据城自守，后与秦叔宝等共降唐，事秦王。从太宗平刘武周、窦建德、王世充，每陷阵却敌，功居多，授右武卫中郎将。贞观中，从征吐谷浑，破其众。帝征高丽，进达为浿江道行军总管，率舟师自莱州泛海，破高丽于积利城，斩首二千余级。累迁右武卫大将军，封琅玡郡公。' },
  // 钱九陇，唐初功臣，善骑射，从高祖太原起兵。
  { id: 'v21_qian_jiulong', name: '钱九陇', faction: null, role: '唐巢国公',
    command: 74, force: 80, intel: 60, politics: 56, loyalty: 86, portrait: 'v21_qian_jiulong',
    age: 42, skills: ['mengjiang', 'xiaoyong_shanzhan'],
    bonds: ['v20_li_yuan', 'v20_liu_hongji'],
    description: '字永兴，晋陵人。善骑射，事李渊于太原，以勇力闻。及高祖起兵，九陇常从左右，典左右羽林军。从平霍邑、绛郡，击桑显和，破之，授金紫光禄大夫。从平长安，追破屈突通于潼关，功最。又从太宗击薛举、刘武周，数先登陷阵。累迁右武卫大将军，封巢国公。贞观初卒。' },
  // 樊兴，唐初功臣，从太宗平突厥，积战功。
  { id: 'v21_fan_xing', name: '樊兴', faction: null, role: '唐襄城郡公',
    command: 72, force: 78, intel: 58, politics: 55, loyalty: 85, portrait: 'v21_fan_xing',
    age: 40, skills: ['mengjiang', 'xiaoyong_shanzhan'],
    bonds: ['v20_li_shimin', 'v21_qiu_xinggong'],
    description: '安州人。少事秦王，以战功除右监门将军。太宗贞观初，突厥寇边，兴从李靖击之，追奔逐北，败其别部。又从侯君集讨高昌，先登拔其城。累封襄城郡公，检校右武候将军。兴自以起细微，位至方面，小心畏慎，未尝有过。' },
  // 公孙武达，唐初名将，从太宗讨刘武周，屡立战功。
  { id: 'v21_gongsun_wuda', name: '公孙武达', faction: null, role: '唐东莱郡公',
    command: 75, force: 84, intel: 56, politics: 52, loyalty: 86, portrait: 'v21_gongsun_wuda',
    age: 38, skills: ['mengjiang', 'xiaoyong_shanzhan'],
    bonds: ['v20_li_shimin', 'v21_qiu_xinggong'],
    description: '京兆栎阳人。有膂力，号为骁果。隋末为禁军。闻太宗起兵长春宫，乃自归于长安，拜右三军骠骑。从太宗破刘武周，力战，功第一。又从平窦建德、王世充，累迁右监门将军，封清水县公。贞观初，累除右武卫大将军，东莱郡公。性任气，不护细行，然以忠谨称。' },
  // 麦孟才，隋名将麦铁杖之子。炀帝被弑，志在复仇，为宇文化及所害。
  { id: 'v21_mai_mengcai', name: '麦孟才', faction: null, role: '隋武贲郎将',
    command: 68, force: 80, intel: 58, politics: 50, loyalty: 90, portrait: 'v21_mai_mengcai',
    age: 28, skills: ['mengjiang', 'xiaoyong_shanzhan'],
    bonds: ['v19_yuwen_huaji'],
    description: '始兴人，隋柱国麦铁杖之子。以父死王事，拜武贲郎将。孟才少有父风，果烈敢死。及炀帝被弑于江都，孟才泣谓所厚曰：吾荷先帝恩深，今不能死，尚复何颜立人世！遂与钱杰等谋，纠集旧恩士，将袭宇文化及，以雪国耻。谋泄，化及夜遣人收之。孟才不肯屈，骂贼而死。时人义之。' },
  // 王君廓，唐初猛将。随太宗平王世充，后叛入突厥，被杀。
  { id: 'v21_wang_junkuo', name: '王君廓', faction: null, role: '唐幽州都督',
    command: 76, force: 82, intel: 60, politics: 48, loyalty: 55, portrait: 'v21_wang_junkuo',
    age: 32, skills: ['xiaoxiong', 'mengjiang'],
    bonds: ['v20_li_shimin', 'v21_luo_shixin'],
    description: '并州石艾人。少孤，为驵侩，无乡曲誉。善盗。隋季，聚群亡命，转掠长平、夏县间。李密招之，不即应。乃归唐，授上柱国，封常山郡公。从太宗围王世充，数破奇兵。又破刘黑闼将刘十善，以功迁右武卫将军，累封幽州都督。在职骄纵，法事多不法，被召，中道杀驿史，奔突厥，为野人所杀。' },
  // 罗士信，齐州历城人。唐初少年名将，守洺水，战死，年二十。
  { id: 'v21_luo_shixin', name: '罗士信', faction: null, role: '唐郯国公',
    command: 78, force: 88, intel: 62, politics: 55, loyalty: 85, portrait: 'v21_luo_shixin',
    age: 18, skills: ['xiaoyong_shanzhan', 'mengjiang'],
    bonds: ['v21_wang_junkuo', 'v17_li_jing'],
    description: '齐州历城人。年十四，短而悍，从张须陀击贼于潍水上。贼始陈，士信驰至阵前，刺倒数人，斩一人首，掷于空，承之以枪。贼皆睥睨，不敢逼。须陀壮而用之。每战，须陀先登，士信为副。后归唐，事秦王。从太宗击刘黑闼，王君廓守洺水，黑闼攻之急，太宗遣士信助守。会大雪，外援绝，城陷，黑闼杀之，年二十。太宗闻而惜之，购得其尸，葬之。' },
  // 丘行恭，唐初名将。从太宗征伐，尝于阵前为太宗拔马。
  { id: 'v21_qiu_xinggong', name: '丘行恭', faction: null, role: '唐天水郡公',
    command: 76, force: 82, intel: 60, politics: 58, loyalty: 88, portrait: 'v21_qiu_xinggong',
    age: 38, skills: ['mengjiang', 'xiaoyong_shanzhan'],
    bonds: ['v20_li_shimin', 'v21_yin_kaishan'],
    description: '河南洛阳人。善骑射。隋末，与师利聚兵保故郿城，众至一万，据宝鸡。及太宗引兵徇地，行恭与师利俱率众归。从太宗破泾阳，攻长安，多所战克。从讨薛举、刘武周、窦建德、王世充，每先陷阵，勇冠三军。太宗尝从数骑逐敌，遇贼追及，行恭为右，所射皆应弦而仆，贼乃披靡。及昭陵列象，有石象人行恭侍立状，以旌其功。' },
  // 殷开山，雍州鄠人。凌烟阁功臣，秦王府十八学士之一。
  { id: 'v21_yin_kaishan', name: '殷开山', faction: null, role: '唐郧国公',
    command: 62, force: 55, intel: 82, politics: 80, loyalty: 85, portrait: 'v21_yin_kaishan',
    age: 40, skills: ['mouliao_baichu', 'guanlong_jituan'],
    bonds: ['v20_li_shimin', 'v21_tang_jian'],
    description: '名嶠，以字行，雍州鄠人。少学，遍览经史，隋为太谷长。高祖起兵，召补大将军府掾，参预谋略，委以心腹。从太宗攻破卫文升，迁陕东道大行台兵部尚书。太宗为秦王，开天策府，开山为府长史，与杜如晦、房玄龄等并见亲重，号十八学士。从讨薛仁杲、刘黑闼，道病卒。太宗哭之甚恸，赠陕东道大行台右仆射，后图形凌烟阁。' },
  // 唐俭，并州晋阳人。唐初名臣，使突厥，还献突厥可取之状。
  { id: 'v21_tang_jian', name: '唐俭', faction: null, role: '唐莒国公',
    command: 58, force: 45, intel: 86, politics: 84, loyalty: 82, portrait: 'v21_tang_jian',
    age: 45, skills: ['mouliao_baichu', 'jingtu_tuzhi'],
    bonds: ['v20_li_yuan', 'v20_liu_wenjing'],
    description: '字茂约，并州晋阳人。父鉴，与高祖有旧，同领禁卫。俭雅识，与太宗故善，见隋政昏，阴说太宗举大事。及太原起兵，俭为记室参军，与温大雅同掌机密。武德中，使突厥，见颉利可汗政乱，民多内附，归言可取。太宗因命李靖袭之，遂破突厥。俭在虏中，说颉利，为靖所乘，几被害，竟得还。永徽初致仕，卒。' },
  // 阿史那贺鲁，西突厥室点密可汗五世孙。叛唐，自号沙钵罗可汗，后为苏定方所擒。
  { id: 'v21_ashi_helu', name: '阿史那贺鲁', faction: null, role: '西突厥沙钵罗可汗',
    command: 80, force: 86, intel: 66, politics: 60, loyalty: 40, portrait: 'v21_ashi_helu',
    age: 45, skills: ['xiaoxiong', 'mengjiang'],
    bonds: ['v21_pei_xingjian', 'v20_li_shimin'],
    description: '西突厥室点密可汗之五世孙。贞观中，泥孰可汗之世，贺鲁居多逻斯川，抚持诸部，渐盛。帝征回纥兵，乃遣贺鲁为崑丘道行军总管，仍将其部落，居庭州之莫贺城。贺鲁因胜兵强，遂拥众西走，击破乙毗射匮可汗，建牙于双河及千泉，自号沙钵罗可汗，五弩失毕、五咄陆十姓皆归之，胜兵数十万。显庆二年，高宗遣苏定方等大破之，追至石国，执贺鲁，送京师。帝赦不诛，闰月卒，葬之颉利墓左。' },
  // ===== V22.0 安史之乱/贞观文臣十五将 =====
  // 郭子仪，华州郑县人。唐中兴名将，平安史，再造唐室，以副元帅收两京。
  { id: 'v22_guo_ziyi', name: '郭子仪', faction: null, role: '唐汾阳郡王',
    command: 92, force: 80, intel: 88, politics: 86, loyalty: 90, portrait: 'v22_guo_ziyi',
    age: 58, skills: ['wangzhe_qiqi', 'dudu_zhongwai'],
    bonds: ['v22_li_guangbi', 'v22_pugu_huaien'],
    description: '华州郑人。长七尺二寸。以武举异等补左卫长史。天宝末，为朔方节度使。安禄山反，朔方兵东讨，收云中、马邑。与李光弼大破史思明于常山。肃宗即位灵武，子仪班师赴行在，以天下兵马副元帅从广平王俶，率回纥大食之众，复长安、洛阳。相州之败，鱼朝恩归罪，子仪罢京师。及河中军乱，复起。代宗时，仆固怀恩诱吐蕃、回纥入寇，子仪单骑见回纥，说之，与共击破吐蕃。身为国大树，权倾天下而朝不忌，功盖一代而主不疑。年八十五卒，赠太师，谥忠武。' },
  // 李光弼，营州柳城人。契丹酋长之后，与郭子仪齐名，平安史第一功。
  { id: 'v22_li_guangbi', name: '李光弼', faction: null, role: '唐临淮郡王',
    command: 90, force: 86, intel: 84, politics: 70, loyalty: 85, portrait: 'v22_li_guangbi',
    age: 48, skills: ['mengjiang', 'shoucheng_mingjiang'],
    bonds: ['v22_guo_ziyi', 'v22_geshuhan'],
    description: '营州柳城契丹人。父楷洛，开元中左羽林大将军。光弼严毅沉果，有大略，善骑射。起家左卫亲府左郎将。肃宗拜为河东节度使，与郭子仪井陉东出，拔常山，破史思明于九门。太原之战，以残卒不满万人，却思明十万之众。及收洛阳，战于邙山，为史思明所乘，败。后镇临淮，以病卒于徐州。与子仪齐名，世称李郭，战功推中兴第一。' },
  // 仆固怀恩，铁勒歌滥拔延之孙。从平安史，满门死王事，后叛。
  { id: 'v22_pugu_huaien', name: '仆固怀恩', faction: null, role: '唐大宁郡王',
    command: 82, force: 84, intel: 68, politics: 55, loyalty: 60, portrait: 'v22_pugu_huaien',
    age: 48, skills: ['mengjiang', 'xiaoyong_shanzhan'],
    bonds: ['v22_guo_ziyi', 'v22_li_guangbi'],
    description: '铁勒部人。世袭都督。怀恩善战斗，识军情。从郭子仪、李光弼，常为先锋，勇冠军中。肃宗求回纥兵，以怀恩为可汗可敦之兄弟，奉使回纥，以宁国公主嫁之，因得回纥兵，从收两京。累战有功，一门死于王事者四十二人。然为人刚戾，为宦官骆奉先所构，惧罪，遂以汾州叛，诱回纥、吐蕃入寇。代宗以其有旧功，不问。俄得暴疾，死于军中。' },
  // 哥舒翰，突骑施酋长之后。唐陇右节度使，守潼关，败于灵宝。
  { id: 'v22_geshuhan', name: '哥舒翰', faction: null, role: '唐西平郡王',
    command: 84, force: 86, intel: 62, politics: 50, loyalty: 80, portrait: 'v22_geshuhan',
    age: 52, skills: ['mengjiang', 'xiaoyong_shanzhan'],
    bonds: ['v22_gaoxianzhi', 'v22_fengchangqing'],
    description: '突骑施哥舒部之裔。居安西。年四十余，遭父丧，客居京师。王忠嗣署为衙将。破吐蕃于积石，斩获不可胜计。累功为陇右节度副大使。筑神威军于青海上，吐蕃至，破之。又筑应龙城，吐蕃屏迹不敢近青海。安禄山反，召翰拜兵马副元帅，守潼关。翰知贼锋锐，利在坚守，而杨国忠促战。不得已，恸哭出关，战于灵宝，大败，为火拔归仁执以降贼。禄山杀之。' },
  // 高仙芝，高丽人。唐安西节度使，怛罗斯之战，后潼关退守，为宦官所杀。
  { id: 'v22_gaoxianzhi', name: '高仙芝', faction: null, role: '唐密云郡公',
    command: 85, force: 84, intel: 76, politics: 60, loyalty: 85, portrait: 'v22_gaoxianzhi',
    age: 45, skills: ['mengjiang', 'jingtu_tuzhi'],
    bonds: ['v22_fengchangqing', 'v22_geshuhan'],
    description: '本高丽人。美姿容，善骑射，勇决骁果。随父至安西，以子补诸卫将军。事田仁琬、盖嘉运，未知名。夫蒙灵詧一见奇之，累擢安西副都护。小勃律王没吐蕃，西二十余国皆为吐蕃所制，仙芝自安西讨之，越葱岭，涉播密川，平小勃律，拂菻、大食诸胡七十二国皆震慑降附。及安禄山反，拜副元帅，统兵讨贼，战败退保潼关。监军边令诚诬其盗军粮，斩之，军士皆呼冤。' },
  // 封常清，蒲州猗氏人。唐安西节度判官，东征败，斩于潼关。
  { id: 'v22_fengchangqing', name: '封常清', faction: null, role: '唐密云郡公',
    command: 80, force: 74, intel: 78, politics: 66, loyalty: 85, portrait: 'v22_fengchangqing',
    age: 42, skills: ['mouliao_baichu', 'jingtu_tuzhi'],
    bonds: ['v22_gaoxianzhi', 'v22_geshuhan'],
    description: '蒲州猗氏人。少孤贫，细瘦斜脚。年三十余，投高仙芝。仙芝初不礼，常清乃自进书，所论皆中，仙芝留为侍从。仙芝征讨，常清必密揣胜败，豫为条教，一皆如志，军中号为判官。性清严，赏罚必信。安禄山反，玄宗召常清，问以讨贼之略。常清大言：请走马赴东京，开府库，募骁勇，挑马箠渡河，计日取逆胡之首。及至洛阳，募兵六万，皆市井白徒。贼战，败，至关中。玄宗怒，斩之，以其首送哥舒翰军，令观之。' },
  // 张巡，蒲州河东人。唐睢阳守将，以寡敌众，障蔽江淮，城陷死节。
  { id: 'v22_zhang_xun', name: '张巡', faction: null, role: '唐南阳郡公',
    command: 82, force: 78, intel: 86, politics: 74, loyalty: 95, portrait: 'v22_zhang_xun',
    age: 48, skills: ['shoucheng_mingjiang', 'mouliao_baichu'],
    bonds: ['v22_nanji_yun'],
    description: '邓州南阳人。博通群书，晓战阵法。开元末进士。为真源令。安禄山反，巡率吏民哭于玄元皇帝祠，起兵讨贼，得众二千人。雍丘令令狐潮叛，巡击破之。又与许远守睢阳，贼将尹子奇合众十万攻城。巡大小数百战，士虽饥，犹殊死斗。城中粮尽，易子而食，巡犹厉士固守，以障江淮。凡十月，城陷，巡与南霁云、雷万春等皆被执。巡不下拜，西向再拜，曰：臣为陛下守城，力竭矣，不能全城。死，为厉鬼以击贼。遂死之。' },
  // 南霁云，魏州顿丘人。张巡部将，乞师贺兰进明，断指明志，同死睢阳。
  { id: 'v22_nanji_yun', name: '南霁云', faction: null, role: '唐睢阳将',
    command: 74, force: 88, intel: 60, politics: 50, loyalty: 95, portrait: 'v22_nanji_yun',
    age: 32, skills: ['xiaoyong_shanzhan', 'mengjiang'],
    bonds: ['v22_zhang_xun'],
    description: '魏州顿丘人。少微贱，为人操舟。善骑射。从张巡守雍丘，为将。及围睢阳，城中急，巡命霁云犯围出，告急于临淮贺兰进明。进明无出师意，爱霁云勇壮，强留之，为设食。霁云泣曰：霁云来，睢阳之人不食月余矣！霁云虽欲独食，义不忍；虽食，且不下咽！因断一指，吞之以示进明。一军皆泣。霁云出城，抽矢回射佛寺浮图，矢著砖，曰：吾破贼还，必灭进明！城陷，与巡同被执，不屈死。' },
  // 安禄山，营州柳城杂胡。本姓康，玄宗宠之，兼三镇节度使，后反。
  { id: 'v22_an_lushan', name: '安禄山', faction: null, role: '唐东平郡王（叛）',
    command: 78, force: 82, intel: 64, politics: 58, loyalty: 30, portrait: 'v22_an_lushan',
    age: 50, skills: ['xiaoxiong', 'mengjiang'],
    bonds: ['v22_shi_siming'],
    description: '营州柳城杂种胡人。本无姓，初名轧荦山。少孤，随母嫁安氏，冒姓安。通六蕃语，为互市牙郎。忮忍多智，善亿测人情。张守珪养为子，以骁勇闻。厚赂往来，自言：我生蕃戎，蒙陛下恩宠至矣，无可为陛下死者，愿许身。帝益亲厚之。兼平卢、范阳、河东三节度使，封东平郡王。见武事堕弛，遂谋逆。天宝十四载，反范阳，称大燕皇帝。东都、西京相继陷。后目盲，躁急，左右不堪。为其子庆绪与宦者李猪儿所弑。' },
  // 史思明，宁夷州突厥。与安禄山同乡里，同反，杀庆绪继之，为子朝义所杀。
  { id: 'v22_shi_siming', name: '史思明', faction: null, role: '唐妫川郡王（叛）',
    command: 80, force: 84, intel: 62, politics: 54, loyalty: 30, portrait: 'v22_shi_siming',
    age: 48, skills: ['xiaoxiong', 'mengjiang'],
    bonds: ['v22_an_lushan'],
    description: '宁夷州突厥种。初名窣干，与安禄山同乡里，长不相能，然善往来。玄宗因奏事，赐名思明。颖悟，善算缗。累功为平卢节度都知兵马使。安禄山反，思明将兵南下，陷河北。郭子仪、李光弼围常山，思明突围走。肃宗时，安庆绪弑禄山，思明以范阳降，已而复叛。及庆绪为郭子仪所围，思明发兵救之，解邺围。寻杀庆绪，并其众，还范阳，自称大燕皇帝。又子朝义，思明欲立少子，朝义惧，缢杀之。' },
  // 虞世南，越州余姚人。唐十八学士，永兴公，书法名世，太宗称五绝。
  { id: 'v22_yu_shinan', name: '虞世南', faction: null, role: '唐永兴县公',
    command: 30, force: 20, intel: 88, politics: 86, loyalty: 85, portrait: 'v22_yu_shinan',
    age: 60, skills: ['mouliao_baichu', 'rujiang'],
    bonds: ['v20_li_shimin', 'v21_yin_kaishan'],
    description: '越州余姚人。沉静寡欲，精思不倦。兄世基，隋内史侍郎。世南初为隋秘书郎。炀帝崩，宇文化及杀世基，世南抱持号泣，请代兄死，化及不许。乃随化及至聊城。窦建德破化及，引为黄门侍郎。太宗灭建德，引为秦府记室参军，与房玄龄、褚亮、姚思廉等同为十八学士。太宗重其博识，每机务之隙，引之谈论，共观经史。世南虽容貌懦懦，若不衣胜衣，而志性抗烈，每论及古先帝王为政得失，必存规讽。太宗称其德行、忠直、博学、文辞、书翰五绝。' },
  // 褚亮，杭州钱塘人。唐十八学士，杜如晦父友，太宗秦王府学士。
  { id: 'v22_chu_liang', name: '褚亮', faction: null, role: '唐阳翟县男',
    command: 28, force: 18, intel: 86, politics: 82, loyalty: 85, portrait: 'v22_chu_liang',
    age: 58, skills: ['mouliao_baichu', 'rujiang'],
    bonds: ['v20_li_shimin', 'v21_yin_kaishan'],
    description: '杭州钱塘人。幼聪敏，善属文，博览无所不至。陈至建，召为尚书殿中侍郎。陈亡，入隋，为太常博士。大业中，炀帝将改宗庙，亮议合礼。后为薛举黄门侍郎。秦王破薛仁杲，素知亮名，引入幕府，赐乘马，拜王府文学参军。太宗每征伐，亮尝在帷幄，有善默启，必手疏闻之。与杜如晦等并号十八学士，图其状貌，署之，以表礼贤。贞观中卒。' },
  // 温彦博，并州祁人。唐宰相，贞观中中书令，有治剧才。
  { id: 'v22_wen_yubo', name: '温彦博', faction: null, role: '唐虞国公',
    command: 40, force: 30, intel: 86, politics: 88, loyalty: 85, portrait: 'v22_wen_yubo',
    age: 55, skills: ['mouliao_baichu', 'guanlong_jituan'],
    bonds: ['v20_li_shimin'],
    description: '并州祁人。幼对策高第，为文林郎。隋末，幽州总管罗艺引为司马。劝艺归国，授幽州总管府长史。太宗为秦王，引为学士。突厥入寇，彦博以并州道行军长史，没于突厥。可汗囚之，苦辱，卒不屈。帝数遣使赎还之。贞观中，迁中书侍郎，进中书令，封虞国公。彦博自掌知机务，即杜绝宾客，国之利害，必言于上。家贫无正寝，及薨，太宗叹惜，命为造堂。' },
  // 马周，清河茌平人。唐宰相，太宗常称：暂不见周，便即思之。
  { id: 'v22_ma_zhou', name: '马周', faction: null, role: '唐高唐县公',
    command: 35, force: 25, intel: 88, politics: 90, loyalty: 85, portrait: 'v22_ma_zhou',
    age: 40, skills: ['mouliao_baichu', 'jingtu_tuzhi'],
    bonds: ['v20_li_shimin'],
    description: '清河茌平人。孤贫好学，善诗、《春秋》。补州助教，不治职，去之。客长安，舍于中郎将常何之家。太宗诏百官言事，何为武吏，不涉学，周为何条二十余事，皆中旨。帝怪问之，何对：此非臣所能，家客马周教臣言之。帝即召之，及见，与语，大悦，命直门下省。明年，拜监察御史，俄拜给事中，转中书侍郎，迁中书令。周善敷奏，机辩明锐，事或占对，必尽知其情状，故言无不从。太宗尝曰：我于马周，暂不见则便思之。' },
  // 岑文本，南阳棘阳人。唐中书令，文思敏速，太宗诏诰，出其手。
  { id: 'v22_cen_wenben', name: '岑文本', faction: null, role: '唐江宁县子',
    command: 32, force: 22, intel: 86, politics: 86, loyalty: 85, portrait: 'v22_cen_wenben',
    age: 50, skills: ['mouliao_baichu', 'guanlong_jituan'],
    bonds: ['v20_li_shimin'],
    description: '南阳棘阳人。祖善方，后梁尚书令。父之象，隋邯郸令，尝为人所讼，不得直。文本年十四，诣司隶，冤辩哀切，辞情不屈，众咸异之，由是知名。萧铣僭号，召为中书侍郎。江陵平，太宗以为荆州别驾。召拜中书舍人。是时，诏诰或大事，皆文本立成。始，太宗既行，文本所草，群臣莫能高下。颜师古既罢，乃以文本专掌机密。俄拜中书令。文本每自以出自布衣，居处卑陋，虽居显位，未尝自满。薨从太宗伐辽东，守所卒。' },
  // ===== V23.0 中唐藩镇/出将入相十五将 =====
  // 李道宗，唐宗室，任城王，从太宗灭刘武周、破突厥、征吐谷浑，略地未始败。
  { id: 'v23_li_daozong', name: '李道宗', faction: null, role: '唐江夏王',
    command: 86, force: 80, intel: 82, politics: 74, loyalty: 85, portrait: 'v23_li_daozong',
    age: 42, skills: ['mengjiang', 'jingtu_tuzhi'],
    bonds: ['v20_li_shimin', 'v20_li_jing'],
    description: '唐宗室，字承范。从太宗讨刘武周，破之，遂平并州。又从平窦建德、王世充。贞观中，略地突厥，以功擢灵州道行军总管。太宗征高丽，道宗与李勣为前锋，拔盖牟、辽东。又尝与侯君集平吐谷浑。道宗晚年好学，敬慕贤士，不以地势骄物。高宗永徽初，为长孙无忌、褚遂良所构，流象州，卒于道。' },
  // 阿史那社尔，突厥处罗可汗子，率部归唐，尚公主，从灭高昌、龟兹。
  { id: 'v23_ashi_na_heer', name: '阿史那社尔', faction: null, role: '唐毕国公',
    command: 85, force: 86, intel: 76, politics: 64, loyalty: 90, portrait: 'v23_ashi_na_heer',
    age: 45, skills: ['mengjiang', 'xiaoyong_shanzhan'],
    bonds: ['v23_qibi_heli', 'v20_li_jing'],
    description: '突厥处罗可汗之次子。年十一，智勇出绝，建牙于漠北。遇薛延陀之乱，乃率众内属，太宗入朝，尚衡阳长公主，拜驸马都尉。太宗征高丽，社尔引兵从，屡陷阵。又从侯君集平高昌。及昆丘道行军，社尔为大总管，破龟兹，大破西突厥，下五大城，降小城七百，勒石纪功。卒，陪葬昭陵。' },
  // 契苾何力，铁勒哥论易勿施莫贺可汗之孙，归唐，尚公主，从征四方，忠勤不渝。
  { id: 'v23_qibi_heli', name: '契苾何力', faction: null, role: '唐凉国公',
    command: 84, force: 88, intel: 72, politics: 60, loyalty: 92, portrait: 'v23_qibi_heli',
    age: 46, skills: ['mengjiang', 'xiaoyong_shanzhan'],
    bonds: ['v23_ashi_na_heer', 'v20_li_shimin'],
    description: '铁勒哥论易勿施莫贺可汗之孙。九岁而孤，号大特勒。贞观六年，随母内属，太宗置其部于甘、凉间。何力沉毅有断，有将帅才。从太宗征吐谷浑，突骑追击，斩获千计。又从平高昌。尝为薛延陀所执，拔佩刀东向大呼曰：岂有唐烈士而受屈虏庭！割左耳以誓。太宗知其忠，许以公主归之，遂得还。从征高丽，攻白岩城，身被数创，大战破之。' },
  // 薛万彻，唐名将，万均之弟，从李靖破突厥、从李勣破薛延陀，尚丹阳公主。
  { id: 'v23_xue_wanche', name: '薛万彻', faction: null, role: '唐武安县侯',
    command: 82, force: 88, intel: 64, politics: 50, loyalty: 75, portrait: 'v23_xue_wanche',
    age: 44, skills: ['mengjiang', 'xiaoyong_shanzhan'],
    bonds: ['v20_li_jing', 'v23_qibi_heli'],
    description: '京兆咸阳人，薛万均之弟。与兄俱以武略事隐太子。太宗即位，释之，渐见委用。从李靖破突厥颉利于塞北，以功授左卫将军。又从李勣破薛延陀于郁督军山，力战有功。尚丹阳公主。太宗尝谓：当今名将，唯李勣、道宗、万彻三人而已。后坐与房遗爱谋反，斩于长安。临刑，谓监刑者曰：薛万彻大健儿，留为国家效死力，岂坐房遗爱杀之！顾谓弟万备趣斩。言色不屈。' },
  // 黑齿常之，百济西部人，骁勇有谋略，降唐，御吐蕃，破突厥，军威震于河西。
  { id: 'v23_heichi_changzhi', name: '黑齿常之', faction: null, role: '燕国公',
    command: 84, force: 86, intel: 78, politics: 62, loyalty: 80, portrait: 'v23_heichi_changzhi',
    age: 48, skills: ['shoucheng_mingjiang', 'mengjiang'],
    bonds: ['v23_wang_xiaojie', 'v20_li_jing'],
    description: '百济西部人。长七尺余，骁勇有谋略。初在本国，为达率兼郡将。苏定方平百济，常之率所部降。后从李敬玄征吐蕃，湟川之役，官军不利，常之夜率敢死士三百人袭破虏营，吐蕃引去。以功迁河源军副使。吐蕃犯边，常之引兵击于良非川，破之，获羊马数万。在军七年，吐蕃畏之，不敢犯边。武后时，破突厥于朔州。后为酷吏周兴所构，诬其谋反，缢杀之。' },
  // 王孝杰，唐名将，仪凤中御吐蕃败，武后时复安西四镇，破吐蕃，战死素罗汗山。
  { id: 'v23_wang_xiaojie', name: '王孝杰', faction: null, role: '清源县男',
    command: 80, force: 82, intel: 70, politics: 58, loyalty: 85, portrait: 'v23_wang_xiaojie',
    age: 52, skills: ['mengjiang', 'jingtu_tuzhi'],
    bonds: ['v23_heichi_changzhi'],
    description: '京兆新丰人。高宗仪凤中，以副总管从刘审礼讨吐蕃，大战于大非川，官军败，审礼没于阵。孝杰亦陷于虏。吐蕃赞普见孝杰，泣曰：貌类我父。厚礼之，竟得归。武后长寿元年，武后思其在虏知吐蕃虚实，乃命为武威军总管，与阿史那忠节率众以讨吐蕃，克复龟兹、于阗、疏勒、碎叶四镇，复置安西都护府于龟兹。证圣初，又破吐蕃于大岭谷。后与吐蕃战于素罗汗山，败绩，免官。万岁登封初，复起为肃边道总管，讨契丹，战死。' },
  // 王忠嗣，唐名将，兼四镇节度使，持重安边，识郭子仪、李光弼于行间。
  { id: 'v23_wang_zhongsi', name: '王忠嗣', faction: null, role: '唐清源县公',
    command: 88, force: 80, intel: 88, politics: 82, loyalty: 88, portrait: 'v23_wang_zhongsi',
    age: 42, skills: ['wangzhe_qiqi', 'dudu_zhongwai'],
    bonds: ['v22_guo_ziyi', 'v22_li_guangbi'],
    description: '华州郑人，本名训。父海宾，战死于吐蕃。忠嗣时年九岁，入见玄宗，帝抚之曰：此去病孤也。养于宫中，肃宗与游。及长，雄毅有武略，沈勇好兵。玄宗与之论兵，应对纵横，皆出意表。帝曰：尔后必为良将。天宝中，兼河东、朔方、河西、陇右四节度使，控制万里，天下劲兵重镇，皆在掌握。尝上平戎十八策。识郭子仪于行伍间，拔李光弼为裨将。后玄宗欲取石堡城，忠嗣上言：石堡险固，非杀数万人不能克。帝不悦。竟以沮军意，贬汉阳太守，卒。' },
  // 李嗣业，唐陌刀将，壮勇绝伦，香积寺之战，袒持陌刀，大呼陷阵，官军复振。
  { id: 'v23_li_siye', name: '李嗣业', faction: null, role: '唐虢国公',
    command: 82, force: 94, intel: 62, politics: 48, loyalty: 92, portrait: 'v23_li_siye',
    age: 38, skills: ['xiaoyong_shanzhan', 'mengjiang'],
    bonds: ['v22_guo_ziyi', 'v22_pugu_huaien'],
    description: '京兆高陵人。长七尺，壮勇绝伦。天宝中，从高仙芝讨勃律，为陌刀将。每战，必袒持陌刀，大呼奋击，当者人马俱碎。高仙芝讨石国，遇大食，怛罗斯之败，诸军拔白刃，嗣业奋斫走之，得全军。安禄山反，肃宗在灵武，召嗣业，即率五千兵赴行在。香积寺之战，李嗣业为前军，谓官属曰：今日不以身饵敌，军无遗矣。乃肉袒持陌刀，大呼，杀数十人，阵乃整。前军之士，皆执陌刀而进，如墙而前，贼大败。遂收长安。后讨安庆绪，中流矢，卒于军。' },
  // 浑瑊，铁勒九姓浑部人，从平安史，平朱泚，复咸阳，与李晟俱为唐室屏藩。
  { id: 'v23_hun_jian', name: '浑瑊', faction: null, role: '唐咸宁郡王',
    command: 86, force: 84, intel: 80, politics: 76, loyalty: 92, portrait: 'v23_hun_jian',
    age: 40, skills: ['mengjiang', 'shoucheng_mingjiang'],
    bonds: ['v23_li_sheng', 'v23_ma_sui'],
    description: '铁勒九姓浑部人。父释之，从郭子仪，积劳至开府仪同三司。瑊年十余岁，即善骑射，随父破回纥、吐番，勇冠军中。安史乱起，从郭子仪复两京，讨安庆绪、史思明，大小数十战，功居多。德宗时，泾原兵乱，泚据长安，瑊扈从至奉天，拒城血战，昼夜数十。及李晟收复京师，瑊与晟东西相应，卒平朱泚。贞元中，为河中绛隰等州节度使。在军十年，似若无他，而沉勇多算，为唐室倚为西陲屏障者，凡十余年。卒，赠太师。' },
  // 马燧，唐名将，沉勇多算，平汴州李灵曜、平河中李怀光，与李晟、浑瑊齐名。
  { id: 'v23_ma_sui', name: '马燧', faction: null, role: '唐北平郡王',
    command: 84, force: 78, intel: 86, politics: 80, loyalty: 85, portrait: 'v23_ma_sui',
    age: 48, skills: ['mouliao_baichu', 'mengjiang'],
    bonds: ['v23_li_sheng', 'v23_hun_jian'],
    description: '汝州郏城人，字洵美。姿度魁杰，长七尺，与诸兄学，辄辍策曰：大丈夫当立功济于天下，何能为俗儒！安禄山反，燧说贾循以范阳归国，不克，间道走。代宗时，累迁郑州刺史，以治行闻。河中李怀光反，燧为河东节度使，与浑瑊、骆光合，破长春宫，降其将，遂平河中。燧沉勇多算，常以计取下，不专杀戮。及平汴州李灵曜，威震山东。然贞元中讨吐蕃，误信其盟，致平凉之劫，由是失势。卒，赠太尉。' },
  // 李晟，唐名将，字良器，器伟雄烈，平朱泚，复长安，德宗还京，功第一。
  { id: 'v23_li_sheng', name: '李晟', faction: null, role: '唐西平郡王',
    command: 90, force: 84, intel: 88, politics: 84, loyalty: 95, portrait: 'v23_li_sheng',
    age: 48, skills: ['wangzhe_qiqi', 'dudu_zhongwai'],
    bonds: ['v23_hun_jian', 'v23_li_su'],
    description: '洮州临潭人，字良器。年十八，事王忠嗣，从击吐蕃，射其酋，毙之，忠嗣抚其背曰：此万人敌也。德宗时，为神策先锋都知兵马使。泾原兵乱，朱泚据长安，帝幸奉天。晟时在河北，闻难，即日引军而西，至渭北，壁东渭桥。时朱泚据宫苑，晟孤军，外无救援，乃善抚士卒，以忠义感激之。及战，晟身先士卒，溃贼众，遂入长安，市不易肆。帝还京师，赐第永崇里，图形凌烟阁。晟性忠恳，每临大事，必尽忠孝。贞元中卒，谥忠武。' },
  // 李愬，唐名将，李晟之子，有筹略，善骑射，雪夜入蔡州，擒吴元济。
  { id: 'v23_li_su', name: '李愬', faction: null, role: '唐凉国公',
    command: 82, force: 74, intel: 90, politics: 76, loyalty: 90, portrait: 'v23_li_su',
    age: 36, skills: ['mouliao_baichu', 'xiaoyong_shanzhan'],
    bonds: ['v23_li_sheng', 'v23_li_guangyan'],
    description: '洮州临潭人，李晟之子。有筹略，善骑射。以父荫授太常寺协律郎。宪宗讨蔡州吴元济，高霞寓败，袁滋逗留。愬以白衣见宰相李吉甫，自请于军。乃以愬为唐邓节度使。愬至军，沉毅，善养士卒。病敌之骄，不设备。既而擒贼将李祐，释缚，用其谋。乃募死士三千为突将，乘雪夜，行七十里，至蔡州。自罅城而入，登城，斩门者，开门纳军。比明，元济尚不知。愬屯其外，攻牙城，元济乃降。凡下蔡州，申、光二州亦降。唐自肃宗以来，崛强河南河北，至是，始归朝廷。' },
  // 李光颜，唐名将，阿跌氏，勇健善骑射，讨淮西，破吴元济，功冠诸将。
  { id: 'v23_li_guangyan', name: '李光颜', faction: null, role: '唐河东郡王',
    command: 84, force: 88, intel: 74, politics: 62, loyalty: 85, portrait: 'v23_li_guangyan',
    age: 42, skills: ['mengjiang', 'xiaoyong_shanzhan'],
    bonds: ['v23_li_su', 'v23_ma_sui'],
    description: '河曲羌人，本姓阿跌氏，赐姓李。父良臣，为鸡田州刺史。光颜少姊夫，河东节度使，光颜与其兄光进，皆以善骑射，从河东军。讨李怀光、刘辟，功出诸将上。元和讨淮西，光颜为忠武军节度使，数破吴元济。时韩弘欲苟贼以自重，私为光颜取一美妇人，使说之。光颜曰：光颜许身报国，誓不与贼同生！士卒数万，皆感泣，争致死。遂破贼于时曲，克凌云栅。及李愬入蔡，光颜亦先登，入贼壁，降其卒。平蔡功成，光颜功最高。' },
  // 田承嗣，卢龙人，为安禄山将，安史乱平，据魏博，外示顺命，内缮甲兵，河北藩镇之始。
  { id: 'v23_tian_chengsi', name: '田承嗣', faction: null, role: '唐雁门郡王（叛）',
    command: 78, force: 80, intel: 72, politics: 66, loyalty: 30, portrait: 'v23_tian_chengsi',
    age: 55, skills: ['xiaoxiong', 'mengjiang'],
    bonds: ['v23_li_baochen', 'v22_an_lushan'],
    description: '平州卢龙人。世事卢龙军，为安禄山裨将。安禄山反，承嗣为前锋，陷洛阳。及史思明再叛，承嗣数犯河南。史朝义败，承嗣以莫州降。代宗务姑息，即授魏博防御使。承嗣既得魏博，乃举管内户口，以壮者皆籍为兵，使老弱耕，数年间，有众十万。选其魁伟强力者万人，以自卫，谓之牙兵。郡官自署，版不上于有司。外示顺命，实蓄异志。又取贝、博、沧、瀛、德、洺七州，自置官吏。朝廷不能制，遂为河朔三镇之始。卒，子悦自立。' },
  // 李宝臣，范阳奚人，为本将张锁高养子，名忠志，降唐，赐姓名，据成德，与田承嗣结。
  { id: 'v23_li_baochen', name: '李宝臣', faction: null, role: '唐陇西郡王（叛）',
    command: 76, force: 82, intel: 70, politics: 64, loyalty: 35, portrait: 'v23_li_baochen',
    age: 52, skills: ['xiaoxiong', 'mengjiang'],
    bonds: ['v23_tian_chengsi', 'v22_shi_siming'],
    description: '范阳奚人。本姓张，名忠志，为安禄山养子。禄山反，忠志为盗镇守。史朝义败，忠志以恒、赵、深、定、易五州降。朝廷乃擢为恒州刺史，赐姓名李宝臣，封陇西郡王，为成德节度使。宝臣既得六州，乃治城邑，练甲兵，以自固。与田承嗣、李正己、梁崇义，皆为割据，虽外奉朝命，而内擅土地。宝臣与承嗣为婚，及承嗣击昭义，宝臣怒其轻己，与朱滔合兵讨之。晚年，乃北望恒州，谓左右曰：吾欲北取幽州，为不朽业。既而误信妖人，饮其药而卒。' },
  // ===== V24.0 唐末五代·黄巢起义/梁晋争霸十五将 =====
  // 黄巢，曹州冤句人，私盐贩出身，起兵曹濮，渡江陷两京，称大齐皇帝。
  { id: 'v24_huang_chao', name: '黄巢', faction: null, role: '大齐皇帝（叛）',
    command: 78, force: 82, intel: 76, politics: 58, loyalty: 15, portrait: 'v24_huang_chao',
    age: 50, skills: ['xiaoxiong', 'mengjiang'],
    bonds: ['v24_zhu_wen', 'v24_gao_pian'],
    description: '曹州冤句人，世鬻盐，富于赀。善击剑骑射，稍通书记，辩给，喜养亡命。咸通末，仍岁饥，盗起河南。乾符中，濮州人王仙芝起兵长垣，巢乃募众数千应之。巢善众，号冲天大将军。渡江，陷虔、吉、饶、信，遂陷浙东，开山路七百里，趋建州，陷福州。广明元年，陷东都，破潼关，入长安。巢乘金装肩舆，众皆被发，约以红缯，执兵以从。即皇帝位，国号大齐。后李克用破巢，巢走狼虎谷，为其甥林言所斩。' },
  // 朱温，宋州砀山人，从黄巢，后降唐，赐名全忠，终篡唐，是为后梁太祖。
  { id: 'v24_zhu_wen', name: '朱温', faction: null, role: '后梁太祖（叛）',
    command: 88, force: 84, intel: 82, politics: 80, loyalty: 20, portrait: 'v24_zhu_wen',
    age: 48, skills: ['xiaoxiong', 'dudu_zhongwai'],
    bonds: ['v24_huang_chao', 'v24_ge_congzhou', 'v24_zhang_quanyi'],
    description: '宋州砀山人。父诚，以《五经》教授里中。温幼孤，与兄存、帝，随母佣食刘崇家。既壮，不事生业，以雄勇自负。黄巢起，温乃亡入贼，以力战，渐为队长。巢入长安，以温为东南面行营先锋使。温见巢兵势日蹙，乃杀其监军，以同州降于王重荣。唐僖宗赐名全忠，拜左金吾大将军，为河中行营副招讨使。既而与李克用破巢、破秦宗权，遂据汴州，封梁王。天祐末，温迁唐帝于洛阳，寻弑之，代唐自立，国号梁。温深沈有大略，善用人，然果于杀戮。' },
  // 李克用，沙陀人，别号李鸦儿，一目失明，号独眼龙，据河东，与梁争天下。
  { id: 'v24_li_keyong', name: '李克用', faction: null, role: '唐晋王',
    command: 90, force: 88, intel: 80, politics: 70, loyalty: 40, portrait: 'v24_li_keyong',
    age: 42, skills: ['wangzhe_qiqi', 'mengjiang'],
    bonds: ['v24_li_cunxu', 'v24_zhou_dewei', 'v24_li_maozhen'],
    description: '西突厥别部沙陀人。本姓朱邪氏。父赤心，讨庞勋有功，赐姓李。克用少骁勇，军中号李鸦儿。其一目眇，及贵，又号独眼龙。善骑射，能仰射双雁。黄巢陷长安，克用率沙陀骑赴难，败巢于梁田陂，遂复京师。以功拜河东节度使，镇太原。后与朱全忠争汴州，全忠设会上源驿，克用仅而免，由是与梁构怨，垂二十年。克用据河东，与全忠夹河相持。性仁恕，待士有恩，故其下多为之死。卒，子存勖立，竟灭梁。' },
  // 李存勖，沙陀，李克用子，骁勇善骑射，灭梁复唐，是为后唐庄宗。
  { id: 'v24_li_cunxu', name: '李存勖', faction: null, role: '后唐庄宗',
    command: 90, force: 88, intel: 78, politics: 60, loyalty: 40, portrait: 'v24_li_cunxu',
    age: 34, skills: ['wangzhe_qiqi', 'xiaoyong_shanzhan'],
    bonds: ['v24_li_keyong', 'v24_zhou_dewei', 'v24_guo_chongtao'],
    description: '沙陀人，李克用长子。初，克用破孟方立于邢州，还军上党，置酒三垂岗。伶人奏《百年歌》，至于衰老之声，坐皆凄怆。时存勖在侧，方五岁。克用指而笑曰：吾后二十年，此子必能代我战于此。及长，善骑射，胆勇过人，稍习《春秋》，通大义。尤喜音声歌舞俳优之戏。天祐五年，克用卒，存勖立。乃与周德威等，夹河与梁战。同光元年，灭梁，定都洛阳，国号唐。既灭梁，骄于得志，宠信伶人，疏忌勋旧。四年，贝州军乱，存勖为流矢所中，崩。' },
  // 钱镠，临安人，贩盐为盗，董昌裨将，据两浙，称吴越王，保境安民。
  { id: 'v24_qian_liu', name: '钱镠', faction: null, role: '吴越王',
    command: 76, force: 70, intel: 84, politics: 88, loyalty: 60, portrait: 'v24_qian_liu',
    age: 55, skills: ['mouliao_baichu', 'jingtu_tuzhi'],
    bonds: ['v24_yang_xingmi', 'v24_zhu_wen'],
    description: '杭州临安人。少拳勇，喜任侠，以贩盐为事。唐乾符中，镇乱，石镜镇将董昌募为偏将。昌为威胜军节度使，以镠为都指挥使。昌僭号称罗平国，镠谏，不听，乃讨昌，越州，斩之。唐以镠为镇海、镇东军节度使，遂有两浙之地。镠自梁、唐以来，常受封，称吴越国王。镠在杭州，自以镇将起，习见兵革之弊，乃完城垒，招抚流散，劝课农桑，兴水利，筑捍海塘。两浙间，为之老死不见兵革。性节俭，然自奉亦奢。卒，谥武肃。' },
  // 杨行密，庐州人，起于群盗，据淮南，称吴王，宽简得士心。
  { id: 'v24_yang_xingmi', name: '杨行密', faction: null, role: '吴武王',
    command: 84, force: 82, intel: 80, politics: 78, loyalty: 50, portrait: 'v24_yang_xingmi',
    age: 48, skills: ['mengjiang', 'mouliao_baichu'],
    bonds: ['v24_qian_liu', 'v24_zhu_wen'],
    description: '庐州合肥人。或曰行愍。少孤贫，有膂力，日行三百里。唐乾符中，群盗起，行密年二十，亡入盗中，为吏所得。刺史郑棨奇其状貌，释之。后为庐州牙将。高骈表为庐州刺史。毕师铎之乱，行密入扬州，遂据淮南。是时，城邑丘墟，行密乃招合遗散，轻衣薄赋，劝务农桑，未及数年，公私富庶。朱温攻之，行密败梁师于清口，梁兵不复能窥淮南。遂尽有江淮之地，封吴王。宽简有智略，善抚士卒，同甘苦。卒，子渥立。' },
  // 王建，许州舞阳人，屠牛盗驴，从田令孜，据蜀，称帝，是为前蜀高祖。
  { id: 'v24_wang_jian', name: '王建', faction: null, role: '前蜀高祖',
    command: 78, force: 76, intel: 76, politics: 80, loyalty: 50, portrait: 'v24_wang_jian',
    age: 55, skills: ['xiaoxiong', 'mouliao_baichu'],
    bonds: ['v24_li_keyong', 'v24_zhu_wen'],
    description: '许州舞阳人。少无赖，以屠牛、盗驴、贩私盐为事，里人谓之贼王八。后为忠武军卒。黄巢犯长安，唐僖宗在蜀，监军田令孜募神策新军，建为将领。令孜养为假子。僖宗还长安，建与令孜俱。及令孜失势，建出为壁州刺史。王建乃招亡命，得八千人，攻陷阆州。遂以兵袭成都，陈敬瑄降。唐以建为西川节度使。及梁祖代唐，建乃亦称帝于成都，国号蜀。建起于群盗，而为人重厚，足知谋略。在蜀，留心政事，容纳谏诤。卒，谥高祖。' },
  // 马殷，许州鄢陵人，秦宗权将，据湖南，称楚王，通商贾，国以富饶。
  { id: 'v24_ma_yin', name: '马殷', faction: null, role: '楚武穆王',
    command: 72, force: 68, intel: 74, politics: 82, loyalty: 55, portrait: 'v24_ma_yin',
    age: 58, skills: ['mouliao_baichu', 'jingtu_tuzhi'],
    bonds: ['v24_yang_xingmi', 'v24_zhu_wen'],
    description: '许州鄢陵人。初为秦宗权将，孙儒之乱，殷从儒攻杨行密。儒败死，殷乃推其众，渡江，入湖南，据潭州。唐以殷为湖南节度使。殷既得湖南，乃遣使修贡于梁，梁封殷楚王。殷土宇既广，乃遂自王国。殷少为木工，及贵，尚节俭。湖南诸州，听民得自采茶，北卖于中原，收其征以赡军。又铸铅铁钱，商旅出境，无所用之，皆易他货而去，故能以境内所余之物，易天下百货，国以富饶。卒，子希声立。' },
  // 王审知，光州固始人，从王潮入闽，据福建，称闽王，宁为开门节度使。
  { id: 'v24_wang_shenzhi', name: '王审知', faction: null, role: '闽忠懿王',
    command: 70, force: 66, intel: 76, politics: 84, loyalty: 60, portrait: 'v24_wang_shenzhi',
    age: 50, skills: ['mouliao_baichu', 'jingtu_tuzhi'],
    bonds: ['v24_wang_jian', 'v24_gao_pian'],
    description: '光州固始人。兄潮，为王绪军正。绪以兵入闽，所至剽掠。潮因众心，逐绪。潮遂据泉、闽，唐以潮为福建观察使。潮卒，审知继立。唐以审知为威武军节度使，封琅琊王。梁太祖时，封闽王。审知为人，俭约好礼。及为闽王，宁为开门节度使，不作闭门天子。乃起四门学，以教闽士之秀者。招徕海中蕃舶，商贾至。四境休息。三十年间，一境晏然。卒，谥忠懿。' },
  // 高骈，幽州人，家世禁卫，破南诏，复交州，后镇扬州，惑于吕用之，终为毕师铎所囚。
  { id: 'v24_gao_pian', name: '高骈', faction: null, role: '唐渤海郡王',
    command: 84, force: 80, intel: 82, politics: 58, loyalty: 65, portrait: 'v24_gao_pian',
    age: 58, skills: ['mengjiang', 'jingtu_tuzhi'],
    bonds: ['v24_huang_chao', 'v24_wang_shenzhi'],
    description: '幽州人。家世禁卫。骈少为右神策军都虞候。南诏寇巂、黔，迁安南都护，大败蛮人，遂复交州。以功迁天平军节度使。黄巢北渡江，骈为淮南节度使，总督诸军。骈失兵柄，内怀怏怏，乃缮城壁，缮甲兵，阴割据之计。骈好神仙，以吕用之为用。用之用事，诸将多为所谗。骈子之侄，毕师铎，本黄巢降将，惧为用之所图，乃引兵攻扬州。骈出见师铎，师铎囚之于道院。既而骈并其子弟皆见杀。骈好为诗，尝谓吾为大唐《诗》家之高。' },
  // 周德威，马邑人，事李克用、存勖，勇知权变，柏乡之役，灭梁精锐。
  { id: 'v24_zhou_dewei', name: '周德威', faction: null, role: '唐燕王',
    command: 86, force: 86, intel: 80, politics: 60, loyalty: 85, portrait: 'v24_zhou_dewei',
    age: 48, skills: ['mengjiang', 'shoucheng_mingjiang'],
    bonds: ['v24_li_keyong', 'v24_li_cunxu'],
    description: '马邑人。小名阳五。事李克用，为骑将。勇而知权变。梁祖攻晋州，克用使德威救之，遂解晋州之围。柏乡之战，梁兵精锐，铠胄皆被缯绮，曜日，晋人望之，有惧色。德威谓史建瑭曰：梁兵非素斗者，特以服饰夸人耳。乃鼓而进，大败梁兵，斩首二万级。德威常以骑驰突，勇冠三军。及从存勖伐幽州，灭刘守光。胡柳之役，德威与其子皆战没。存勖哭之恸，曰：丧吾良将，吾之过也。' },
  // 葛从周，濮州人，从黄巢，降朱温，为后梁名将，屡破河东、山东。
  { id: 'v24_ge_congzhou', name: '葛从周', faction: null, role: '后梁陈留郡王',
    command: 84, force: 84, intel: 76, politics: 58, loyalty: 80, portrait: 'v24_ge_congzhou',
    age: 50, skills: ['mengjiang', 'xiaoyong_shanzhan'],
    bonds: ['v24_zhu_wen', 'v24_zhang_quanyi'],
    description: '濮州鄄城人。从黄巢为军。黄巢败，从周与张归霸等，皆降于梁太祖。太祖镇宣武，从周与朱珍等，为大将。太祖攻蔡州，秦宗权弃城走，从追击，破之。又攻兖州朱瑾、郓州朱瑄，皆破之。河东兵攻山东，从周屡破之。是时，梁之名将，曰葛从周、曰庞师古、曰刘鄩。从周善用兵，所向有功。及老，以疾罢，拜右卫上将军，居洛阳。卒，赠太尉。' },
  // 郭崇韬，代州雁门人，后唐谋臣，为庄宗画策，灭梁平蜀，后为宦官所谗死。
  { id: 'v24_guo_chongtao', name: '郭崇韬', faction: null, role: '后唐侍中',
    command: 70, force: 50, intel: 90, politics: 84, loyalty: 75, portrait: 'v24_guo_chongtao',
    age: 48, skills: ['mouliao_baichu', 'jingtu_tuzhi'],
    bonds: ['v24_li_cunxu', 'v24_zhou_dewei'],
    description: '代州雁门人。为河东教练使。为人明敏，善应对。庄宗即位，崇韬为中门使，凡谋议，皆与闻。庄宗与梁夹河相距十年，军事，皆以委崇韬。及梁人破杨刘，庄宗患之。崇韬请筑垒于博州，以通河津。梁兵来攻，崇韬坚守，卒破梁军。及庄宗入汴，崇韬谋为多。灭梁后，崇韬为侍中、成德军节度使。及伐蜀，崇韬为招讨使，以魏王继岌为都统，兵事一决于崇韬。凡七十日，灭蜀。是时，宦官乐从晟等，谗之于刘皇后。皇后自为教，与继岌，杀崇韬。天下冤之。' },
  // 张全义，濮州人，原名言，事黄巢，后降唐，治洛阳，务农积谷，卒成梁唐之资。
  { id: 'v24_zhang_quanyi', name: '张全义', faction: null, role: '后梁/后唐齐王',
    command: 50, force: 40, intel: 78, politics: 88, loyalty: 70, portrait: 'v24_zhang_quanyi',
    age: 60, skills: ['mouliao_baichu', 'rujiang'],
    bonds: ['v24_zhu_wen', 'v24_li_cunxu'],
    description: '濮州临濮人。初名言，字国维。少为县役，受令长之辱，乃亡入黄巢中。巢入长安，以言为吏部尚书。巢败，言降于诸葛爽。爽卒，言与李罕之，分据河阳、洛阳。罕之性暴，言潜兵逐之，遂据洛阳。是时，洛阳自张全义、孙儒之后，都城灰烬，满目荆榛。全义乃披荆棘，招抚流散，劝耕桑。数年之间，京畿畿，无闲田，编户五六万。乃筑堡垒，立市肆。全义每见麦蚕之良，必亲拜之。由是，归附者如归。全义事梁、唐，累官至太师、尚书令，封齐王。卒，谥忠肃。' },
  // 李茂贞，深州博野人，本姓宋，为凤翔节度使，割据凤翔，陵弱王室，称岐王。
  { id: 'v24_li_maozhen', name: '李茂贞', faction: null, role: '唐岐王（叛）',
    command: 78, force: 80, intel: 72, politics: 66, loyalty: 35, portrait: 'v24_li_maozhen',
    age: 52, skills: ['xiaoxiong', 'mengjiang'],
    bonds: ['v24_li_keyong', 'v24_zhu_wen'],
    description: '深州博野人。本姓宋，名文通。为博野军卒，戍凤翔。黄巢犯长安，文通以队正，击贼有功，神策军。郑畋署为指挥使。以功，赐姓李，名茂贞，为凤翔节度使。及昭宗即位，茂贞有兵，遂骄。尝上书，言：臣本家奴，今为天子，是谁家天子？朝廷不能问。茂贞遂与王行瑜、韩建，举兵犯京师，杀宰相韦昭度。李克用举兵讨茂贞，茂贞乃惧，称藩。及梁太祖将篡唐，茂贞乃以岐王自居，开府置百官，称制。然卒不能有为。庄宗已灭梁，茂贞乃上表称臣。卒，子从曮袭。' }
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

// ============================================================
// V17.0 新武将技能映射（15位，v17_ 前缀）
// ============================================================
export const V170_NEW_GENERAL_SKILLS = {
  v17_yang_xiu:      ['wangzhe_qiqi', 'dudu_zhongwai'],   // 杨秀：蜀王
  v17_yang_liang:    ['wangzhe_qiqi', 'dudu_zhongwai'],   // 杨谅：汉王并州
  v17_yang_jun:      ['wangzhe_qiqi', 'rujiang'],         // 杨俊：秦王
  v17_shen_keqing:   ['mouliao_baichu'],                  // 沈客卿：陈佞
  v17_shi_wenqing:   ['mouliao_baichu'],                  // 施文庆：陈佞
  v17_ren_yue:       ['mengjiang', 'xiaoyong_shanzhan'],  // 任约：梁叛将
  v17_yuwen_huaji:   ['xiaoxiong'],                       // 宇文化及：江都弑逆
  v17_wang_shichong: ['xiaoxiong', 'mouliao_baichu'],     // 王世充：郑王洛阳
  v17_dou_jiande:    ['xiaoxiong', 'jingtu_tuzhi'],       // 窦建德：夏王河北
  v17_xiao_xian:     ['wangzhe_qiqi', 'rujiang'],         // 萧铣：后梁余绪
  v17_xu_shiji:      ['dudu_zhongwai', 'mouliao_baichu'], // 李勣：瓦岗归唐
  v17_qin_shubao:    ['mengjiang', 'xiaoyong_shanzhan'],  // 秦叔宝：万军取将
  v17_cheng_yaojin:  ['mengjiang', 'xiaoyong_shanzhan'],  // 程知节：马槊先锋
  v17_wei_zheng:     ['mouliao_baichu', 'rujiang'],       // 魏徵：贞观谏臣
  v17_li_jing:       ['dudu_zhongwai', 'mouliao_baichu']  // 李靖：初唐军神
};
Object.assign(NEW_GENERAL_SKILLS, V170_NEW_GENERAL_SKILLS);

// ============================================================
// V18.0 新武将技能映射（15位，v18_ 前缀）
// ============================================================
export const V180_NEW_GENERAL_SKILLS = {
  v18_liu_wuzhou:    ['mengjiang', 'xiaoxiong'],          // 刘武周：马邑定杨
  v18_liang_shidu:   ['xiaoxiong', 'shoucheng_mingjiang'], // 梁师都：朔方梁帝
  v18_lin_shihong:   ['wangzhe_qiqi', 'xiaoxiong'],       // 林士弘：九江楚帝
  v18_du_fuwei:      ['mengjiang', 'xiaoxiong'],          // 杜伏威：江淮吴王
  v18_fu_gongshi:    ['mengjiang', 'xiaoxiong'],          // 辅公祏：丹阳宋帝
  v18_shen_faxing:   ['rujiang', 'xiaoxiong'],            // 沈法兴：吴兴梁王
  v18_li_zitong:     ['mengjiang', 'wangzhe_qiqi'],       // 李子通：江都吴帝
  v18_xue_ju:        ['mengjiang', 'wangzhe_qiqi'],       // 薛举：陇西秦帝
  v18_xue_rengao:    ['mengjiang', 'xiaoyong_shanzhan'],  // 薛仁杲：万人敌
  v18_li_gui:        ['rujiang', 'xiaoxiong'],            // 李轨：河西凉王
  v18_li_mi:         ['mouliao_baichu', 'wangzhe_qiqi'],  // 李密：瓦岗魏公
  v18_zhai_rang:     ['mengjiang', 'xiaoxiong'],          // 翟让：瓦岗初代
  v18_luo_yi:        ['mengjiang', 'guanlong_jituan'],     // 罗艺：幽州燕王
  v18_qu_tutong:     ['dudu_zhongwai', 'mouliao_baichu'], // 屈突通：隋唐名将
  v18_pei_renshi:    ['dudu_zhongwai', 'shoucheng_mingjiang'] // 裴仁基：隋末名将
};
Object.assign(NEW_GENERAL_SKILLS, V180_NEW_GENERAL_SKILLS);

// ============================================================
// V19.0 新武将技能映射（15位，v19_ 前缀）
// ============================================================
export const V190_NEW_GENERAL_SKILLS = {
  v19_yang_xuangan:    ['xiaoxiong', 'mouliao_baichu'],        // 杨玄感：黎阳叛隋
  v19_sima_dekan:      ['xiaoxiong', 'mengjiang'],             // 司马德戡：江都骁果
  v19_pei_qiantong:    ['mengjiang', 'xiaoxiong'],            // 裴虔通：宫门禁旅
  v19_chai_shao:       ['dudu_zhongwai', 'mengjiang'],         // 柴绍：唐初驸马
  v19_yuchi_jingde:    ['dudu_zhongwai', 'xiaoyong_shanzhan'], // 尉迟敬德：马槊无双
  v19_changsun_wuji:   ['mouliao_baichu', 'guanlong_jituan'],  // 长孙无忌：凌烟阁首
  v19_fang_xuanling:   ['mouliao_baichu', 'guanlong_jituan'],  // 房玄龄：贞观贤相
  v19_du_ruhui:        ['mouliao_baichu', 'guanlong_jituan'],  // 杜如晦：房谋杜断
  v19_li_xiaogong:     ['dudu_zhongwai', 'mouliao_baichu'],    // 李孝恭：江南元帅
  v19_li_jiancheng:    ['wangzhe_qiqi', 'guanlong_jituan'],   // 李建成：东宫太子
  v19_li_yuanji:       ['mengjiang', 'xiaoyong_shanzhan'],    // 李元吉：齐王勇鸷
  v19_liu_heita:       ['mengjiang', 'xiaoxiong'],            // 刘黑闼：汉东复起
  v19_dan_xiongxin:    ['mengjiang', 'xiaoyong_shanzhan'],     // 单雄信：瓦岗飞将
  v19_wang_bodang:     ['mengjiang', 'shoucheng_mingjiang'],  // 王伯当：死义之士
  v19_su_dingfang:     ['dudu_zhongwai', 'mengjiang']         // 苏定方：灭三国
};
Object.assign(NEW_GENERAL_SKILLS, V190_NEW_GENERAL_SKILLS);

// ============================================================
// V20.0 新武将技能映射（15位，v20_ 前缀）
// ============================================================
export const V200_NEW_GENERAL_SKILLS = {
  v20_li_yuan:          ['wangzhe_qiqi', 'guanlong_jituan'],  // 李渊：太原起兵
  v20_li_shimin:        ['wangzhe_qiqi', 'dudu_zhongwai'],    // 李世民：天策上将
  v20_yang_dong:        ['mouliao_baichu', 'wangzhe_qiqi'],   // 杨侗：东都皇泰
  v20_yang_you:         ['mouliao_baichu', 'wangzhe_qiqi'],   // 杨侑：代王禅唐
  v20_yang_hao:         ['mouliao_baichu', 'xiaoxiong'],      // 杨浩：宇文化及所立
  v20_yong:             ['guanlong_jituan', 'mouliao_baichu'], // 杨勇：废太子
  v20_xian_furen:       ['shoucheng_mingjiang', 'jingtu_tuzhi'], // 冼夫人：岭南圣母
  v20_fang_ang:         ['mengjiang', 'shoucheng_mingjiang'], // 冯盎：南越归唐
  v20_wang_bo:          ['xiaoxiong', 'mengjiang'],           // 王薄：长白山首义
  v20_liu_hongji:       ['mengjiang', 'xiaoyong_shanzhan'],   // 刘弘基：太原元从
  v20_changsun_shunde:  ['mengjiang', 'xiaoyong_shanzhan'],   // 长孙顺德：元从功臣
  v20_duan_zhixuan:     ['mengjiang', 'xiaoyong_shanzhan'],   // 段志玄：褒国忠勇
  v20_liu_wenjing:      ['mouliao_baichu', 'guanlong_jituan'], // 刘文静：首谋定策
  v20_pei_ji:           ['mouliao_baichu', 'guanlong_jituan'], // 裴寂：晋阳元谋
  v20_dugu_qieluo:      ['wangzhe_qiqi', 'ciemao_fengliu']    // 独孤伽罗：隋文献后
};
Object.assign(NEW_GENERAL_SKILLS, V200_NEW_GENERAL_SKILLS);

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
  },

  // ============================================================
  // V17.0 新增随机事件（20个，v17_ 前缀）
  // 分类：军事(5) / 政治(4) / 经济(4) / 文化(4) / 特殊(3)
  // effect 键均复用 events.js applyEvent 已支持的键。
  // ============================================================

  // ---- 军事（5） ----
  {
    id: 'v17_hu_qi_raobian', name: '胡骑扰边', illustration: 'barbarian_invasion',
    description: '边吏驰奏：突厥数千骑自榆林入塞，掠吏民畜牧而去。镇将请举兵追蹑，或曰当坚壁清野，俟其骄惰。',
    options: [
      { text: '选精骑追之，邀其归路（自动大战，损兵1000，金+1000）', effect: { massBattle: true, armyLoss: 1000, money: 1000 } },
      { text: '坚壁清野，徐图后举（守城buff两回合，金-300）', effect: { garrisonBuff: true, money: -300 } }
    ]
  },
  {
    id: 'v17_jian_ying_lian_zhai', name: '连营列栅', illustration: 'recruit_camp',
    description: '大军顿于野，诸将请连营列栅，为久驻之计。或曰当轻兵速进，以掩敌不虞。',
    options: [
      { text: '连营为久驻之计（军心+6，金-400）', effect: { armyMorale: 6, money: -400 } },
      { text: '轻兵速进，掩其不虞（自动大战，损兵1500，金+1500）', effect: { massBattle: true, armyLoss: 1500, money: 1500 } }
    ]
  },
  {
    id: 'v17_shui_jun_chu_haikou', name: '水军出海', illustration: 'maritime_trade',
    description: '沿海州郡奏：有倭舶数十，漂至会稽，欲以所产硫黄、布易丝绢。或请因之以图海上之利，或请禁绝不与通。',
    options: [
      { text: '因置互市，以收其利（金+1500，商业+5）', effect: { money: 1500, comm: 5 } },
      { text: '禁绝互市，恐生他变（民心+2）', effect: { morale: 2 } }
    ]
  },
  {
    id: 'v17_jiang_zhong_jing_bian', name: '军中惊夜', illustration: 'mutiny',
    description: '夜中，军中讹言敌至，一军尽惊。主将莫辨真伪，或请按军无动，或请亟斩为首者以徇。',
    options: [
      { text: '按军无动，徐察其由（军心+5，忠诚+3）', effect: { armyMorale: 5, generalLoyalty: { amt: 3 } } },
      { text: '立斩讹言者以徇（军心-4，忠诚-4）', effect: { armyMorale: -4, generalLoyalty: { amt: -4 } } }
    ]
  },
  {
    id: 'v17_gong_cheng_lei_shi', name: '攻城累日', illustration: 'city_siege',
    description: '我围敌城，累月不下，士卒疲敝，杀伤相枕。或请筑土山以临之，或请穿地道以入之。',
    options: [
      { text: '筑土山临城，矢石交下（自动大战，损兵1600，金+1200）', effect: { massBattle: true, armyLoss: 1600, money: 1200 } },
      { text: '穿地道，内外夹攻（守城buff两回合，损兵600）', effect: { garrisonBuff: true, armyLoss: 600 } }
    ]
  },

  // ---- 政治（4） ----
  {
    id: 'v17_tai_zi_jian_guo', name: '太子监国', illustration: 'court',
    description: '天子有疾，命太子监国，百官奏事皆取处分。太子富于春秋，或请择师傅辅之，或请专达以练政事。',
    options: [
      { text: '择名儒为师傅，辅导春宫（文化+6，金-400）', effect: { culture: 6, money: -400 } },
      { text: '令太子专决庶务（忠诚+4，民心-3）', effect: { generalLoyalty: { amt: 4 }, factionMorale: -3 } }
    ]
  },
  {
    id: 'v17_zaixiang_xie_chu', name: '宰相谢除', illustration: 'court',
    description: '宰臣以老病乞骸骨，表三上乃许。或请就第，加优礼；或请起复，勿听其去。',
    options: [
      { text: '赐第东都，归老于家（金+1000，文化+4）', effect: { money: 1000, culture: 4 } },
      { text: '手诏慰留，起复视事（忠诚+6，民心+2）', effect: { generalLoyalty: { amt: 6 }, factionMorale: 2 } }
    ]
  },
  {
    id: 'v17_zongshi_neidou', name: '宗室相攻', illustration: 'court',
    description: '两宗室以争田宅，忿争于朝，辞语不逊。有司请论如律，或请以亲亲，两解之。',
    options: [
      { text: '付有司，论如律（忠诚+5，民心-3）', effect: { generalLoyalty: { amt: 5 }, factionMorale: -3 } },
      { text: '以亲亲，两解之（金-300，民心+4）', effect: { money: -300, factionMorale: 4 } }
    ]
  },
  {
    id: 'v17_keqing_jian_tu', name: '客卿献图', illustration: 'taixue_lecture',
    description: '有客卿自西州来，献《西域图》一卷，具言山川要害、蕃夷风俗，云可因之以谋西域。',
    options: [
      { text: '召问方略，拜为参谋（招募一将，科技+4）', effect: { recruitRandom: true, tech: 4 } },
      { text: '但留其图，厚遣之（金+400）', effect: { money: 400 } }
    ]
  },

  // ---- 经济（4） ----
  {
    id: 'v17_tuntian_fengshou', name: '屯田丰稔', illustration: 'harvest',
    description: '边郡屯田，比岁丰稔，谷支十年。有司请广募民佃，或请因以减漕运。',
    options: [
      { text: '广募民佃，益广屯田（粮+1800，农业+4）', effect: { food: 1800, agri: 4 } },
      { text: '减漕运，以宽民力（民心+4，粮+600）', effect: { morale: 4, food: 600 } }
    ]
  },
  {
    id: 'v17_cao_yun_shutong', name: '漕运通利', illustration: 'maritime_trade',
    description: '漕渠新开，岁运关东粟四百万石，京师丰积。或请加运以实边，或请停转以惜劳。',
    options: [
      { text: '加运实边，边储以充（粮+2000，金-300）', effect: { food: 2000, money: -300 } },
      { text: '停转惜劳，与民休息（民心+5）', effect: { morale: 5 } }
    ]
  },
  {
    id: 'v17_guanshi_tongshang', name: '关市通商', illustration: 'bazaar',
    description: '南北初通，商旅辐辏，舳舻相属。有司请于要路置市令，平其物价。',
    options: [
      { text: '置市令，平物价（金+1200，商业+6）', effect: { money: 1200, comm: 6 } },
      { text: '关市不征，与民共利（民心+4，金+500）', effect: { morale: 4, money: 500 } }
    ]
  },
  {
    id: 'v17_yantie_yezhu', name: '盐铁私铸', illustration: 'ancient_ruins',
    description: '民间多私铸铁钱，轻重不一，物价踊贵。或请禁民私铸，专归县官；或请兼铸以足用。',
    options: [
      { text: '禁民私铸，专归县官（金+1600，民心-4）', effect: { money: 1600, morale: -4 } },
      { text: '兼铸以足用，不专其利（金+700，民心+3）', effect: { money: 700, morale: 3 } }
    ]
  },

  // ---- 文化（4） ----
  {
    id: 'v17_taixue_jiangxue', name: '太学讲经', illustration: 'taixue_lecture',
    description: '太学新成，博士请讲《孝经》《论语》，诸生执经问难者数百人。',
    options: [
      { text: '临幸太学，讲经赐帛（文化+10，金-500）', effect: { culture: 10, money: -500 } },
      { text: '命中书撰定章句（文化+4）', effect: { culture: 4 } }
    ]
  },
  {
    id: 'v17_fo_xiang_kaiguang', name: '佛像开光', illustration: 'buddhist_temple',
    description: '佛寺新铸金像，高十丈，僧尼请王临幸，设斋行香。',
    options: [
      { text: '临幸设斋，听民瞻礼（文化+8，金-400）', effect: { culture: 8, money: -400 } },
      { text: '以其糜费，罢之（文化+2，民心+2）', effect: { culture: 2, morale: 2 } }
    ]
  },
  {
    id: 'v17_shufa_dajia', name: '书法大家', illustration: 'musician',
    description: '有僧善书，为王献之、羊欣之亚，尺牍为世所宝。或请召为侍书，或请听其在山。',
    options: [
      { text: '召为侍书，侍书内殿（文化+7，金-300）', effect: { culture: 7, money: -300 } },
      { text: '听其在山，勿加强仕（文化+3，民心+2）', effect: { culture: 3, morale: 2 } }
    ]
  },
  {
    id: 'v17_shijing_kance', name: '石经刊定', illustration: 'taixue_lecture',
    description: '秘书监奏：经籍散佚，文字多舛。请选通儒，刊定六经，勒石太学，以一传习。',
    options: [
      { text: '诏选通儒，刊定勒石（文化+12，金-700）', effect: { culture: 12, money: -700 } },
      { text: '且写定本，不烦勒石（文化+4）', effect: { culture: 4 } }
    ]
  },

  // ---- 特殊（3） ----
  {
    id: 'v17_long_jian_jianghai', name: '龙见江海', illustration: 'harvest',
    description: '州郡奏：江津有白龙见，长十数丈，蜿蜒水面，良久乃没。占者以为非常之瑞。',
    options: [
      { text: '受瑞，班行天下（民心+9，金-400）', effect: { factionMorale: 9, money: -400 } },
      { text: '却瑞不贺，戒饬郡县（民心+2，金+300）', effect: { morale: 2, money: 300 } }
    ]
  },
  {
    id: 'v17_mingma_chuchu', name: '名马出厩', illustration: 'nomad_market',
    description: '陇右牧司献马，龙颈而豹膺，号为的颅，一日千里。或请留以亲御，或请以赐将士。',
    options: [
      { text: '留以亲御（军心+6，金-200）', effect: { armyMorale: 6, money: -200 } },
      { text: '以赐骁将（忠诚+5）', effect: { generalLoyalty: { amt: 5 } } }
    ]
  },
  {
    id: 'v17_yiren_xiabao', name: '异人献宝', illustration: 'ancient_ruins',
    description: '有野人于山石中得古鼎，文曰"天子万寿"，形制奇古。或曰当献之宗庙，或曰当藏之秘府。',
    options: [
      { text: '献之宗庙，受百僚朝贺（民心+8，金+800）', effect: { factionMorale: 8, money: 800 } },
      { text: '藏之秘府，不形喜惧（文化+4）', effect: { culture: 4 } }
    ]
  },

  // === V18.0 随机事件二十（军事5/政治4/经济4/文化4/特殊3）===
  // ---- 军事 5 ----
  {
    id: 'v18_mu_shahui', name: '沙暴来袭', illustration: 'barbarian_invasion',
    description: '西北边塞骤起黑风，飞沙走石，戍卒迷路失马，边防几近瘫痪。',
    options: [
      { text: '出塞寻救，抚恤伤卒（金-400，军心+6）', effect: { money: -400, armyMorale: 6 } },
      { text: '闭城自守，待风自息（损兵1500，军心-5）', effect: { armyLoss: 1500, armyMorale: -5 } }
    ]
  },
  {
    id: 'v18_mu_tielie', name: '边将献马', illustration: 'harvest',
    description: '陇右驿奏：牧马监蕃息，获良马三千匹，皆龙种也，可补骑士之缺。',
    options: [
      { text: '尽收国厩，补充骑兵（兵+2000，金-300）', effect: { money: -300, armyLoss: -2000 } },
      { text: '半入折冲，半酬边将（兵+800）', effect: { armyLoss: -800 } }
    ]
  },
  {
    id: 'v18_mu_chengbian', name: '城堞倾颓', illustration: 'city_siege',
    description: '边地秋雨连绵，版筑颓圮，雉堞多有崩处，守御空虚。',
    options: [
      { text: '发民修筑，整缮城防（金-600，守城buff两回合）', effect: { money: -600, garrisonBuff: true } },
      { text: '留待来春再修（民心-6，防守空虚）', effect: { morale: -6 } }
    ]
  },
  {
    id: 'v18_mu_liudu', name: '流寇掠边', illustration: 'rebellion',
    description: '河东逃卒聚为流寇，抄掠县邑，乡野震恐。',
    options: [
      { text: '轻骑追剿（损兵1000，民心+6）', effect: { armyLoss: 1000, morale: 6 } },
      { text: '招抚归农（金-500，兵+500）', effect: { money: -500, armyLoss: -500 } }
    ]
  },
  {
    id: 'v18_mu_jiangxiao', name: '降将输诚', illustration: 'barbarian_invasion',
    description: '敌镇偏将密遣腹心，献图请降，约以献城。',
    options: [
      { text: '率军接应（损兵800，招募一将）', effect: { armyLoss: 800, recruitRandom: true } },
      { text: '疑其有诈，拒之（军心-4）', effect: { armyMorale: -4 } }
    ]
  },
  // ---- 政治 4 ----
  {
    id: 'v18_zheng_junchen', name: '君臣宴对', illustration: 'harvest',
    description: '春和景明，与群臣宴于内殿，论及古今兴亡，君臣相得。',
    options: [
      { text: '推心置腹，共图治道（民心+6，文化+3）', effect: { morale: 6, culture: 3 } },
      { text: '耽乐流连，渐废政事（民心-5，军心-3）', effect: { morale: -5, armyMorale: -3 } }
    ]
  },
  {
    id: 'v18_zheng_gaoliao', name: '高寮求退', illustration: 'plague',
    description: '一位老臣以年老多病，上表乞骸骨，情辞恳切。',
    options: [
      { text: '优诏慰留，加禄赐帛（金-400，民心+5）', effect: { money: -400, morale: 5 } },
      { text: '听其致仕，归养乡里（文化+2，军心-2）', effect: { culture: 2, armyMorale: -2 } }
    ]
  },
  {
    id: 'v18_zheng_tangji', name: '堂吏舞文', illustration: 'rebellion',
    description: '宪司奏：郡国掾史多挟私舞文，舞智以弄法，百姓苦之。',
    options: [
      { text: '严核诸曹，杖黜奸吏（民心+5，金+300）', effect: { morale: 5, money: 300 } },
      { text: '下诏戒饬，不究其罪（民心-4）', effect: { morale: -4 } }
    ]
  },
  {
    id: 'v18_zheng_heqin', name: '邻境请婚', illustration: 'harvest',
    description: '邻国遣使请结姻好，愿以公主下嫁，永修邻好。',
    options: [
      { text: '许婚和亲，修结旧好（民心+4，金+600）', effect: { morale: 4, money: 600 } },
      { text: '辞以宗女未笄，婉拒（军心+3，民心-2）', effect: { armyMorale: 3, morale: -2 } }
    ]
  },
  // ---- 经济 4 ----
  {
    id: 'v18_jing_guanlong', name: '关陇丰稔', illustration: 'harvest',
    description: '关辅之地，麦禾弥望，比岁屡登，仓廪充实。',
    options: [
      { text: '轻徭薄赋，与民休息（粮+4000，民心+5）', effect: { food: 4000, morale: 5 } },
      { text: '增收关市之税（金+1500，民心-3）', effect: { money: 1500, morale: -3 } }
    ]
  },
  {
    id: 'v18_jing_gujiao', name: '古道通商', illustration: 'harvest',
    description: '西域商队重至敦煌，明珠、香药、善马踵于路，关市大悦。',
    options: [
      { text: '弛关市之禁，厚来远人（商业+8，金+1000）', effect: { comm: 8, money: 1000 } },
      { text: '重征商税以实府库（金+1800，商业-4）', effect: { money: 1800, comm: -4 } }
    ]
  },
  {
    id: 'v18_jing_heijun', name: '河决溃堰', illustration: 'drought',
    description: '河溢坏防，漂没民田数千顷，老弱转乎沟壑。',
    options: [
      { text: '发卒塞河，赈济灾民（金-800，粮-2000，民心+4）', effect: { money: -800, food: -2000, morale: 4 } },
      { text: '遣使循行，听其自复（人口-5000，民心-8）', effect: { pop: -5000, morale: -8 } }
    ]
  },
  {
    id: 'v18_jing_kuqian', name: '库钱贯朽', illustration: 'harvest',
    description: '有司奏：帑藏充盈，贯朽而不可校，太仓之粟陈陈相因。',
    options: [
      { text: '大酺三日，犒赏六军（金-1000，军心+8）', effect: { money: -1000, armyMorale: 8 } },
      { text: '积而不散，以崇节俭（文化+3）', effect: { culture: 3 } }
    ]
  },
  // ---- 文化 4 ----
  {
    id: 'v18_wen_rui_cao', name: '瑞草呈祥', illustration: 'harvest',
    description: '南郡献嘉禾，一茎九穗；又有赤雀翔于殿隅，议者以为祥瑞。',
    options: [
      { text: '受贺改元，宣付史馆（文化+6，民心+4）', effect: { culture: 6, morale: 4 } },
      { text: '以符瑞为不足应，却之（文化+2，军心+2）', effect: { culture: 2, armyMorale: 2 } }
    ]
  },
  {
    id: 'v18_wen_yiji', name: '逸士献书', illustration: 'harvest',
    description: '嵩山逸民献《河洛图》及古乐经三十篇，辞义弘远。',
    options: [
      { text: '诏秘书监缮写，藏之秘阁（文化+8，金-200）', effect: { culture: 8, money: -200 } },
      { text: '问其术而罢之（科技+3）', effect: { tech: 3 } }
    ]
  },
  {
    id: 'v18_wen_shidafu', name: '士大夫论辩', illustration: 'harvest',
    description: '集诸生于学宫，讲《孝经》《礼记》，辩难终日，观者如堵。',
    options: [
      { text: '亲临幸，赏帛有差（文化+5，民心+3）', effect: { culture: 5, morale: 3 } },
      { text: '命有司第其高下（科技+4）', effect: { tech: 4 } }
    ]
  },
  {
    id: 'v18_wen_fosi', name: '山寺落成', illustration: 'harvest',
    description: '州郡奏：浮图寺观新成，轮奂甚美，远近归依者众。',
    options: [
      { text: '赐额褒崇，以彰风化（文化+6，金-300）', effect: { culture: 6, money: -300 } },
      { text: '沙汰僧尼，归之南亩（人口+3000，文化-2）', effect: { pop: 3000, culture: -2 } }
    ]
  },
  // ---- 特殊 3 ----
  {
    id: 'v18_te_touming', name: '投名相托', illustration: 'harvest',
    description: '有亡命壮士，怀一剑、裹一毡，叩辕门以托身，自言可当一面。',
    options: [
      { text: '引而试之，置之麾下（招募一将，金-200）', effect: { recruitRandom: true, money: -200 } },
      { text: '察其无可取，遣归田里（军心-2）', effect: { armyMorale: -2 } }
    ]
  },
  {
    id: 'v18_te_mayi', name: '马疫流行', illustration: 'plague',
    description: '陇右牧马多染疫死，十丧四五，骑士失马。',
    options: [
      { text: '厚赏市胡马以补（金-1000，军心+2）', effect: { money: -1000, armyMorale: 2 } },
      { text: '听其自蕃，徐图补充（损兵2000，军心-6）', effect: { armyLoss: 2000, armyMorale: -6 } }
    ]
  },
  {
    id: 'v18_te_juntun', name: '军屯丰收', illustration: 'harvest',
    description: '诸镇屯田，麦禾大稔，边食颇饶，可省和籴之费。',
    options: [
      { text: '收其入以实边廪（粮+3000，军心+4）', effect: { food: 3000, armyMorale: 4 } },
      { text: '归其耕牛于兵（兵+1000，粮+1000）', effect: { armyLoss: -1000, food: 1000 } }
    ]
  },

  // === V19.0 随机事件二十（军事5/政治4/经济4/文化4/特殊3）===
  // ---- 军事 5 ----
  {
    id: 'v19_mu_yanmen', name: '雁门被围', illustration: 'city_siege',
    description: '边将急奏：突厥始毕可汗率数十万骑入塞，围天子于雁门，城中兵民十五万，粮仅支二旬。',
    options: [
      { text: '发诸郡兵勤王（损兵2000，金-800，军心+8）', effect: { armyLoss: 2000, money: -800, armyMorale: 8 } },
      { text: '间道遣使求援于义成公主（金-1500，民心+4）', effect: { money: -1500, morale: 4 } }
    ]
  },
  {
    id: 'v19_mu_xueye', name: '雪夜袭营', illustration: 'cavalry_charge',
    description: '大雪数尺，边将言：敌营近塞，恃雪不设备，可遣精骑夜袭，必得其王庭。',
    options: [
      { text: '选精骑一万，赍二十日粮雪夜出塞（损兵800，金-600，歼敌万计）', effect: { armyLoss: 800, money: -600, armyMorale: 8 } },
      { text: '雪寒道远，未可轻动（军心-4）', effect: { armyMorale: -4 } }
    ]
  },
  {
    id: 'v19_mu_houshao', name: '边谍来归', illustration: 'barbarian_invasion',
    description: '有突厥小酋，因边人奉密图来降，言其国内虚实、部落强弱。',
    options: [
      { text: '厚赏留之，问其委曲（金-300，科技+5）', effect: { money: -300, tech: 5 } },
      { text: '疑其为间，遣还（军心-2）', effect: { armyMorale: -2 } }
    ]
  },
  {
    id: 'v19_mu_jiehu', name: '突厥请和', illustration: 'harvest',
    description: '突厥遣使请和亲，愿献马二千匹，求公主下嫁。',
    options: [
      { text: '许婚互市，以安北边（金+800，民心+4，军心+2）', effect: { money: 800, morale: 4, armyMorale: 2 } },
      { text: '厉兵秣马，以伐其谋（军心+6，民心-3）', effect: { armyMorale: 6, morale: -3 } }
    ]
  },
  {
    id: 'v19_mu_jianchen', name: '降将献城', illustration: 'rebellion',
    description: '敌镇副将密遣腹心，以城图来献，约以举事之日开门纳师。',
    options: [
      { text: '潜师应之，夜半薄城（损兵500，招募一将）', effect: { armyLoss: 500, recruitRandom: true } },
      { text: '疑其有诈，按甲勿动（军心-3）', effect: { armyMorale: -3 } }
    ]
  },
  // ---- 政治 4 ----
  {
    id: 'v19_zheng_tangyi', name: '朝堂议事', illustration: 'harvest',
    description: '春正御殿，群臣朝贺，议及封禅、巡狩、征伐诸大事，争论久之不决。',
    options: [
      { text: '折衷群议，从其所长（民心+6，文化+3）', effect: { morale: 6, culture: 3 } },
      { text: '独断独决，不恤群言（军心+4，民心-5）', effect: { armyMorale: 4, morale: -5 } }
    ]
  },
  {
    id: 'v19_zheng_laoqie', name: '老臣乞骨', illustration: 'plague',
    description: '一位三朝老臣，以耄耋之年，累表乞骸骨，情辞哀切。',
    options: [
      { text: '赐几杖，听其归第（金-500，文化+4，民心+3）', effect: { money: -500, culture: 4, morale: 3 } },
      { text: '优诏慰留，进位三公（金-300，军心+2，文化+2）', effect: { money: -300, armyMorale: 2, culture: 2 } }
    ]
  },
  {
    id: 'v19_zheng_wufang', name: '武备弛废', illustration: 'rebellion',
    description: '有司言：天下久承平，州郡武备多弛，甲仗朽钝，士卒骄堕。',
    options: [
      { text: '诏诸州修缮甲兵，阅武教习（金-700，军心+6）', effect: { money: -700, armyMorale: 6 } },
      { text: '置而不问，以彰文德（文化+2，军心-6）', effect: { culture: 2, armyMorale: -6 } }
    ]
  },
  {
    id: 'v19_zheng_jingcheng', name: '京师地震', illustration: 'drought',
    description: '地大震，京师屋瓦皆飞，宫墙多圮，百姓讹言相惊。',
    options: [
      { text: '下诏罪己，赈恤灾民（金-800，民心+8）', effect: { money: -800, morale: 8 } },
      { text: '命有司禳厌，不罪己（民心-4，文化+2）', effect: { morale: -4, culture: 2 } }
    ]
  },
  // ---- 经济 4 ----
  {
    id: 'v19_jing_huanghe', name: '黄河水清', illustration: 'harvest',
    description: '潼关以东，河清数千里，吏民称庆，以为千年之瑞。',
    options: [
      { text: '受贺改元，宣付史馆（文化+6，民心+5）', effect: { culture: 6, morale: 5 } },
      { text: '以河清为偶然，却贺（金+500，军心+2）', effect: { money: 500, armyMorale: 2 } }
    ]
  },
  {
    id: 'v19_jing_chama', name: '茶马互市', illustration: 'harvest',
    description: '突厥、吐谷浑诸部请以马易茶，岁以数万匹为率，边民便之。',
    options: [
      { text: '弛茶马之禁，厚来远人（商业+10，金+1200）', effect: { comm: 10, money: 1200 } },
      { text: '重征其税，以实边廪（金+2000，商业-5）', effect: { money: 2000, comm: -5 } }
    ]
  },
  {
    id: 'v19_jing_yantie', name: '盐铁大熟', illustration: 'harvest',
    description: '河东盐池、蜀中铁冶，比岁丰羡，盐铁之利十倍于常。',
    options: [
      { text: '弛盐铁之禁，与民共利（民心+6，金+1000）', effect: { morale: 6, money: 1000 } },
      { text: '榷盐铁以专其利（金+2500，民心-5）', effect: { money: 2500, morale: -5 } }
    ]
  },
  {
    id: 'v19_jing_huangtun', name: '荒田垦辟', illustration: 'harvest',
    description: '诸州奏：流民自占，垦辟荒田数千顷，岁入租课十余万石。',
    options: [
      { text: '免新垦田租三年（粮+4000，民心+6）', effect: { food: 4000, morale: 6 } },
      { text: '依例征税，以实帑藏（金+1500，民心-3）', effect: { money: 1500, morale: -3 } }
    ]
  },
  // ---- 文化 4 ----
  {
    id: 'v19_wen_shigu', name: '石鼓出土', illustration: 'ancient_ruins',
    description: '岐州奏：于野中得古石鼓十，状如鼓而细，上刻古篆，莫能识者。',
    options: [
      { text: '诏秘书监考释，列于太学（文化+10，金-400）', effect: { culture: 10, money: -400 } },
      { text: '以其奇怪，却而勿受（文化+2）', effect: { culture: 2 } }
    ]
  },
  {
    id: 'v19_wen_guozijian', name: '国子建学', illustration: 'harvest',
    description: '有司奏：国子学倾圮，生徒离散，请加修葺，选经师以授诸生。',
    options: [
      { text: '大启学舍，广召生徒（文化+8，金-600）', effect: { culture: 8, money: -600 } },
      { text: '权宜修补，勿大劳费（文化+3）', effect: { culture: 3 } }
    ]
  },
  {
    id: 'v19_wen_yuefu', name: '乐府新声', illustration: 'harvest',
    description: '乐工献新曲数十篇，音辞清雅，云得之于河右诸胡。',
    options: [
      { text: '被之管弦，颁行天下（文化+6，民心+3）', effect: { culture: 6, morale: 3 } },
      { text: '以郑卫之音，罢勿用（科技+3）', effect: { tech: 3 } }
    ]
  },
  {
    id: 'v19_wen_fangji', name: '方士献丹', illustration: 'harvest',
    description: '有昆仑胡僧，献炼丹术，云可致黄金、延年寿。',
    options: [
      { text: '命试之于内殿，不亲饵（金-500，文化+4）', effect: { money: -500, culture: 4 } },
      { text: '斥其妖妄，逐出境（民心+4，军心+2）', effect: { morale: 4, armyMorale: 2 } }
    ]
  },
  // ---- 特殊 3 ----
  {
    id: 'v19_te_longmen', name: '龙门跃鳞', illustration: 'harvest',
    description: '河津奏：黄河春冰初泮，有鱼跃龙门者，化龙而去，观者数千人。',
    options: [
      { text: '遣官致祭，以答灵贶（金-300，文化+5，民心+3）', effect: { money: -300, culture: 5, morale: 3 } },
      { text: '曰此常事，不足异（军心+2）', effect: { armyMorale: 2 } }
    ]
  },
  {
    id: 'v19_te_yima', name: '义士献马', illustration: 'harvest',
    description: '有边地义士，献天马一匹，龙颈麟身，骨相非凡，云得之于西极。',
    options: [
      { text: '拜献马者为郎，马入内厩（兵+1500，金-200）', effect: { armyLoss: -1500, money: -200 } },
      { text: '厚赐遣归，马充战骑（兵+800）', effect: { armyLoss: -800 } }
    ]
  },
  {
    id: 'v19_te_baichan', name: '海国求兵', illustration: 'harvest',
    description: '百济遣使浮海来告急，言高丽、新罗相攻，愿得师徒数千以纾国难。',
    options: [
      { text: '发兵数千，浮海赴救（损兵1000，金-500，文化+6）', effect: { armyLoss: 1000, money: -500, culture: 6 } },
      { text: '外藩自相攻，不足恤（民心-3）', effect: { morale: -3 } }
    ]
  },

  // ============================================================
  // V20.0 新增随机事件二十（军事5/政治4/经济4/文化4/特殊3）
  // ============================================================
  // ---- 军事 5 ----
  {
    id: 'v20_mu_fengsui', name: '烽燧昼警', illustration: 'barbarian_invasion',
    description: '边堠驰奏：虏骑出没塞下，烽燧连昼不绝，戍卒戒严。',
    options: [
      { text: '命将出师巡塞（损兵800，军心+6）', effect: { armyLoss: 800, armyMorale: 6 } },
      { text: '固垒自守，徐图后举（金-300，民心-2）', effect: { money: -300, morale: -2 } }
    ]
  },
  {
    id: 'v20_mu_liangdao', name: '粮道被劫', illustration: 'rebellion',
    description: '斥候来报：押运粮队过山谷，为游骑所钞，损失过半。',
    options: [
      { text: '发精骑追讨（损兵1200，粮-1500）', effect: { armyLoss: 1200, food: -1500 } },
      { text: '改道厚护，暂避其锋（粮-2500，军心-4）', effect: { food: -2500, armyMorale: -4 } }
    ]
  },
  {
    id: 'v20_mu_mudu', name: '陇右马牧孳息', illustration: 'harvest',
    description: '陇右监牧奏：今年牧马蕃息，驹充汗血者数千匹，堪充战骑。',
    options: [
      { text: '选良马入战马（兵+2000，金-400）', effect: { armyLoss: -2000, money: -400 } },
      { text: '尽数赏军功（军心+6）', effect: { armyMorale: 6 } }
    ]
  },
  {
    id: 'v20_mu_tujue', name: '突厥叩边', illustration: 'barbarian_invasion',
    description: '突厥大可汗纵骑数万，大入长城，边郡烽埃相望，杀掠吏民。',
    options: [
      { text: '亲将大军北伐（损兵3000，蛮族关系-20）', effect: { armyLoss: 3000, barbarianRel: -20 } },
      { text: '厚赂和亲以纾难（金-1500，民心-6）', effect: { money: -1500, morale: -6 } }
    ]
  },
  {
    id: 'v20_mu_huobing', name: '军户逃散', illustration: 'rebellion',
    description: '诸府军户以征役繁数，多亡匿山泽，府兵渐耗。',
    options: [
      { text: '遣使检括，复其家（金-600，兵+1500）', effect: { money: -600, armyLoss: -1500 } },
      { text: '峻法督捕（兵-1000，民心-5）', effect: { armyLoss: 1000, morale: -5 } }
    ]
  },
  // ---- 政治 4 ----
  {
    id: 'v20_zheng_baibi', name: '选官考课', illustration: 'harvest',
    description: '吏部上天下州县考课簿，欲严殿最，以清吏治。',
    options: [
      { text: '精核能否，黜陟幽明（金+800，民心+5）', effect: { money: 800, morale: 5 } },
      { text: '一切仍旧，勿扰为安（文化-3）', effect: { culture: -3 } }
    ]
  },
  {
    id: 'v20_zheng_dangyi', name: '士大夫党议', illustration: 'rebellion',
    description: '朝士分朋植党，更相诋訾，殿阁之间议论蜂起。',
    options: [
      { text: '明加分别，抑其浮竞（民心-3，金-300）', effect: { morale: -3, money: -300 } },
      { text: '两存之，以观其能（军心+2，文化+3）', effect: { armyMorale: 2, culture: 3 } }
    ]
  },
  {
    id: 'v20_zheng_chushi', name: '遣使巡省', illustration: 'harvest',
    description: '灾异数见，诏遣大使分行州县，观风俗，理冤滞。',
    options: [
      { text: '选清直名臣分行四方（金-500，民心+8）', effect: { money: -500, morale: 8 } },
      { text: '但下诏书，不劳遣使（民心+2）', effect: { morale: 2 } }
    ]
  },
  {
    id: 'v20_zheng_fengshan', name: '封禅之议', illustration: 'harvest',
    description: '群臣表请封禅泰山，告成功于天地，以彰盛德。',
    options: [
      { text: '允其请，勒石岱宗（金-3000，文化+15，民心+10）', effect: { money: -3000, culture: 15, morale: 10 } },
      { text: '劳民伤财，寝其奏（金+500，民心-2）', effect: { money: 500, morale: -2 } }
    ]
  },
  // ---- 经济 4 ----
  {
    id: 'v20_jing_tiantong', name: '铜冶兴铸', illustration: 'harvest',
    description: '诸道铜坑大出，有司请广置钱监，铸五铢以通货泉。',
    options: [
      { text: '广置钱监，开炉鼓铸（金+2000，金-800工本）', effect: { money: 2000, food: -800 } },
      { text: '恐钱轻物重，止之（金+200）', effect: { money: 200 } }
    ]
  },
  {
    id: 'v20_jing_shidian', name: '市易丰阜', illustration: 'harvest',
    description: '都下及列郡泉市骈集，商贾辐辏，货赂山积。',
    options: [
      { text: '轻关市之税，通商惠工（comm+8，金+1000）', effect: { money: 1000, comm: 8 } },
      { text: '厚敛以实府库（金+1500，民心-4）', effect: { money: 1500, morale: -4 } }
    ]
  },
  {
    id: 'v20_jing_yingtian', name: '屯田积谷', illustration: 'harvest',
    description: '塞上屯田大有年，谷支十年，可以省馈运。',
    options: [
      { text: '增拓屯田，广积刍粟（粮+4000，兵-500）', effect: { food: 4000, armyLoss: 500 } },
      { text: '输之京师，以实太仓（金+1200）', effect: { money: 1200 } }
    ]
  },
  {
    id: 'v20_jing_huangzai', name: '蝗灾蔽野', illustration: 'drought',
    description: '飞蝗自东来，蔽日翳天，所过禾黍一空，赤地数千里。',
    options: [
      { text: '官民捕蝗，以米易蝗（粮-1500，民心+4）', effect: { food: -1500, morale: 4 } },
      { text: '坐视不救（agri-15，民心-10）', effect: { agri: -15, morale: -10 } }
    ]
  },
  // ---- 文化 4 ----
  {
    id: 'v20_wen_shijing', name: '石经校勘', illustration: 'harvest',
    description: '国子监上言：经典文字舛驳，请勒石经于太学，以正经术。',
    options: [
      { text: '诏群儒刊定，立石太学（金-600，文化+10）', effect: { money: -600, culture: 10 } },
      { text: '未遑文教，且止（文化-2）', effect: { culture: -2 } }
    ]
  },
  {
    id: 'v20_wen_fota', name: '浮图造寺', illustration: 'harvest',
    description: '有司奏：国家隆佛，请大起伽蓝，铸金像，以资福祐。',
    options: [
      { text: '从其请，营构大寺（金-1000，文化+8，民心+2）', effect: { money: -1000, culture: 8, morale: 2 } },
      { text: '崇饰无用，罢之（金+400，文化-3）', effect: { money: 400, culture: -3 } }
    ]
  },
  {
    id: 'v20_wen_yanle', name: '燕乐制新', illustration: 'harvest',
    description: '太常奏：朝会燕乐，旧章残阙，博征知音，缉而补之。',
    options: [
      { text: '诏定雅乐，被之弦歌（金-400，文化+7）', effect: { money: -400, culture: 7 } },
      { text: '率由旧章而已（文化+2）', effect: { culture: 2 } }
    ]
  },
  {
    id: 'v20_wen_mingchen', name: '名臣上谥', illustration: 'harvest',
    description: '故开国元老薨，有司考行，请易名以劝百官。',
    options: [
      { text: '赐美谥，录其子孙（金-300，民心+6，军心+4）', effect: { money: -300, morale: 6, armyMorale: 4 } },
      { text: '有司故常而已（民心+1）', effect: { morale: 1 } }
    ]
  },
  // ---- 特殊 3（灾害）----
  {
    id: 'v20_te_dizhen', name: '地震山崩', illustration: 'plague',
    description: '地大震，京师及郡国皆震，山崩水涌，坏城郭庐舍，压死者众。',
    options: [
      { text: '发使赈恤，瘗埋死者（金-1000，pop-3000，民心+6）', effect: { money: -1000, pop: -3000, morale: 6 } },
      { text: '灾异自致，勿恤（pop-10000，民心-12）', effect: { pop: -10000, morale: -12 } }
    ]
  },
  {
    id: 'v20_te_hongshui', name: '河决洪水', illustration: 'drought',
    description: '大河决堤，洪水横流，漂没田庐，流民蔽路，城郭为沼。',
    options: [
      { text: '发卒塞决，沿河赈济（金-1200，粮-2000，agri-5，民心+5）', effect: { money: -1200, food: -2000, agri: -5, morale: 5 } },
      { text: '沿河州县自当之（agri-18，pop-8000，民心-10）', effect: { agri: -18, pop: -8000, morale: -10 } }
    ]
  },
  {
    id: 'v20_te_gunhan', name: '大旱赤地', illustration: 'drought',
    description: '自春徂夏不雨，百川皆竭，苗稼枯焦，民至采草根木皮为食。',
    options: [
      { text: '避殿减膳，遣使虑囚（粮-1500，民心+7）', effect: { food: -1500, morale: 7 } },
      { text: '一切不问（agri-12，pop-5000，民心-9）', effect: { agri: -12, pop: -5000, morale: -9 } }
    ]
  },
  // ===== V21.0 新增随机事件（20个，丝路贸易主题）=====
  // ---- 军事 5 ----
  {
    id: 'v21_mu_shanbei', name: '碛北追袭', illustration: 'cavalry_charge',
    description: '碛北斥候驰报：突厥别部南徙，畜牧散居漠南，可轻骑掩袭，得其孳畜。',
    options: [
      { text: '简精骑绝漠掩袭（损兵1000，金+2000，蛮族关系-15）', effect: { armyLoss: 1000, money: 2000, barbarianRel: -15 } },
      { text: '远袭疲师，不可（军心-3）', effect: { armyMorale: -3 } }
    ]
  },
  {
    id: 'v21_mu_hushan', name: '互市胡商', illustration: 'harvest',
    description: '碛口互市，突厥、西域诸胡驱马牛羊至塞下，与汉民贸易，市门喧阗。',
    options: [
      { text: '厚招互市，市良马入军（comm+8，金+1200，兵+1000）', effect: { comm: 8, money: 1200, armyLoss: -1000 } },
      { text: '严闭关市，禁马出塞（民心+2，comm-5）', effect: { morale: 2, comm: -5 } }
    ]
  },
  {
    id: 'v21_mu_hanshui', name: '瀚海烽烟', illustration: 'barbarian_invasion',
    description: '瀚海以北，回纥、黠戛斯诸部相攻，边亭传警，恐虏骑乘隙南牧。',
    options: [
      { text: '命都护勒兵备边（金-500，兵+1500）', effect: { money: -500, armyLoss: -1500 } },
      { text: '遣使和解诸部（蛮族关系+10，金-800）', effect: { barbarianRel: 10, money: -800 } }
    ]
  },
  {
    id: 'v21_mu_shazhou', name: '沙州警尘', illustration: 'rebellion',
    description: '沙州以西汉塞之外，游尘张天，谍者以为吐蕃游骑窥边，居民震恐。',
    options: [
      { text: '发州兵逐捕，护商路（损兵800，comm+5）', effect: { armyLoss: 800, comm: 5 } },
      { text: '婴城自守，闭关（comm-6，民心-4）', effect: { comm: -6, morale: -4 } }
    ]
  },
  {
    id: 'v21_mu_chitu', name: '赤水军马', illustration: 'harvest',
    description: '赤水军奏：陇右监牧蕃息，岁市突厥马三千匹，充入战马，骑军益强。',
    options: [
      { text: '选骏马补骑军（兵+2500，金-600）', effect: { armyLoss: -2500, money: -600 } },
      { text: '卖马市利以佐军（金+1500，兵-1000）', effect: { money: 1500, armyLoss: 1000 } }
    ]
  },
  // ---- 政治 4 ----
  {
    id: 'v21_zheng_duhu', name: '都护开府', illustration: 'harvest',
    description: '西域初定，诸蕃款塞。有司请择重臣为都护，开府置僚，绥抚远人。',
    options: [
      { text: '选威望重臣开府（金-800，文化+6，民心+4）', effect: { money: -800, culture: 6, morale: 4 } },
      { text: '因循旧制，不烦改作（文化+1）', effect: { culture: 1 } }
    ]
  },
  {
    id: 'v21_zheng_huya', name: '互市牙郎', illustration: 'harvest',
    description: '列郡互市，多有西域商胡，因缘为奸，高下其直。有司请选牙人，平物价。',
    options: [
      { text: '平立牙行，禁欺罔（comm+8，金+800）', effect: { comm: 8, money: 800 } },
      { text: '纵之自为市（comm-4，民心-2）', effect: { comm: -4, morale: -2 } }
    ]
  },
  {
    id: 'v21_zheng_jiebing', name: '借兵蕃骑', illustration: 'cavalry_charge',
    description: '边将请：发使诣回纥、突厥，借精骑数千，以助讨叛，厚以金帛。',
    options: [
      { text: '许之，厚赂借骑（金-2000，兵+3000）', effect: { money: -2000, armyLoss: -3000 } },
      { text: '借兵示弱，且止（兵-1500，军心+2）', effect: { armyLoss: 1500, armyMorale: 2 } }
    ]
  },
  {
    id: 'v21_zheng_jimi', name: '羁縻州议', illustration: 'harvest',
    description: '归降蕃部日众，议者请因其部落，列置羁縻州县，以其酋为都督刺史。',
    options: [
      { text: '广置羁縻州，随俗而治（comm+6，文化+5，金-600）', effect: { comm: 6, culture: 5, money: -600 } },
      { text: '劳费难继，省其州县（金+400，蛮族关系-8）', effect: { money: 400, barbarianRel: -8 } }
    ]
  },
  // ---- 经济 4（丝路贸易）----
  {
    id: 'v21_jing_silu', name: '丝路商队', illustration: 'harvest',
    description: '高昌、于阗以西，胡商负玉、锦、香料，千驼成队，塞于道。都护请护送至京。',
    options: [
      { text: '遣卒护商队入关（comm+10，金+2500，金-500护费）', effect: { comm: 10, money: 2500 } },
      { text: '任其自来，不烦护送（金+800，comm-3）', effect: { money: 800, comm: -3 } }
    ]
  },
  {
    id: 'v21_jing_yushi', name: '于阗献玉', illustration: 'harvest',
    description: '于阗国遣使献美玉千斤，云河源出昆冈，玉璞尤良，可琢为国宝。',
    options: [
      { text: '受玉，赐使者帛（金+1800，文化+6）', effect: { money: 1800, culture: 6 } },
      { text: '却其献，示不贵异物（民心+5，金-200）', effect: { morale: 5, money: -200 } }
    ]
  },
  {
    id: 'v21_jing_xiangliao', name: '西域香料', illustration: 'harvest',
    description: '波斯、大食商胡至，献熏陆、苏合、沉水诸香，价直巨万，都下争市之。',
    options: [
      { text: '官市其香，转卖获利（金+2200，comm+6）', effect: { money: 2200, comm: 6 } },
      { text: '奇货害民，禁之（comm-5，民心+3）', effect: { comm: -5, morale: 3 } }
    ]
  },
  {
    id: 'v21_jing_hushi', name: '胡商献宝', illustration: 'harvest',
    description: '有大食胡商，献径寸大珠、码碯碗，云得自拂菻国，愿易中国缯帛。',
    options: [
      { text: '以缯帛易之，入内府（金+1500，金-1000易货）', effect: { money: 1500 } },
      { text: '不贵异物，还其宝（民心+4，金-300）', effect: { morale: 4, money: -300 } }
    ]
  },
  // ---- 文化 4 ----
  {
    id: 'v21_wen_yuqu', name: '于阗佛曲', illustration: 'harvest',
    description: '于阗沙门来朝，献胡旋、于阗佛曲，琵琶箜篌之属，太常请肄习之。',
    options: [
      { text: '诏太常肄习，入雅乐（金-400，文化+8）', effect: { money: -400, culture: 8 } },
      { text: '郑声烦且慢，罢之（文化+1）', effect: { culture: 1 } }
    ]
  },
  {
    id: 'v21_wen_jingjiao', name: '景教东传', illustration: 'harvest',
    description: '大秦胡僧阿罗本至长安，献经像，云其法出于大秦，与佛屠相表里。请建寺。',
    options: [
      { text: '听其建寺，译经于京师（金-500，文化+7）', effect: { money: -500, culture: 7 } },
      { text: '异学乱常，禁勿听（文化-2，民心+1）', effect: { culture: -2, morale: 1 } }
    ]
  },
  {
    id: 'v21_wen_hulei', name: '龟兹胡乐', illustration: 'harvest',
    description: '龟兹乐工至，善琵琶、五弦、筚篥，声调诡发，号为西国之妙，教坊请传其法。',
    options: [
      { text: '选乐工传习，以备燕乐（金-300，文化+6）', effect: { money: -300, culture: 6 } },
      { text: '华夷异制，弗取（文化+1）', effect: { culture: 1 } }
    ]
  },
  {
    id: 'v21_wen_yijing', name: '三藏译经', illustration: 'harvest',
    description: '玄奘法师自西域归，携梵本六百余部，聚于弘福寺，请择义学沙门，共译新经。',
    options: [
      { text: '诏译场，助以官给（金-700，文化+12，民心+3）', effect: { money: -700, culture: 12, morale: 3 } },
      { text: '未遑内典，且止（文化-2）', effect: { culture: -2 } }
    ]
  },
  // ---- 特殊 3 ----
  {
    id: 'v21_te_shachen', name: '沙暴埋城', illustration: 'drought',
    description: '大风吹沙，飞石蔽天，一夜沙埋郭下，城郭庐舍皆在沙中，民多压死。',
    options: [
      { text: '发卒徙城，赈济流民（金-1200，pop-4000，民心+6）', effect: { money: -1200, pop: -4000, morale: 6 } },
      { text: '沙暴自天，勿恤（pop-12000，民心-12）', effect: { pop: -12000, morale: -12 } }
    ]
  },
  {
    id: 'v21_te_hushi', name: '胡商道阻', illustration: 'drought',
    description: '碛中大雪，商队百余驼为雪所困，胡商多冻死，货弃于道，边郡震动。',
    options: [
      { text: '发廪赈之，护其余众（粮-1000，金-400，comm+5）', effect: { food: -1000, money: -400, comm: 5 } },
      { text: '道路既梗，听之（comm-10，民心-5）', effect: { comm: -10, morale: -5 } }
    ]
  },
  {
    id: 'v21_te_zouji', name: '走驼惊尘', illustration: 'barbarian_invasion',
    description: '塞外风沙忽起，群驼惊走，谍者疑为虏骑大至，边城严备，竟风止无事。',
    options: [
      { text: '劳问戍卒，安其惊（金-300，军心+4）', effect: { money: -300, armyMorale: 4 } },
      { text: '虚惊自解，不劳（军心-3）', effect: { armyMorale: -3 } }
    ]
  },
  // ===== V22.0 安史乱/科举漕运二十事件 =====
  // ---- 军事 5 ----
  {
    id: 'v22_mu_fanyang', name: '范阳兵锋', illustration: 'barbarian_invasion',
    description: '范阳节镇积年练兵，控弦十万，铁骑南压河北。边将驰奏：禄山缮甲兵，籍良马，谋欲不轨。',
    options: [
      { text: '急发朔方、范阳兵备之（损兵1500，金-800，comm-6）', effect: { armyLoss: 1500, money: -800, comm: -6 } },
      { text: '不信谗言，遣使慰谕（军心-4，金-400）', effect: { armyMorale: -4, money: -400 } }
    ]
  },
  {
    id: 'v22_mu_tongguan', name: '潼关戍鼓', illustration: 'rebellion',
    description: '潼关守卒告急：贼将崔乾祐顿兵关下，渐修攻具。关上尘起，守将欲出师迎击。',
    options: [
      { text: '坚壁勿战，以老其师（兵+1000，金-500）', effect: { armyLoss: -1000, money: -500 } },
      { text: '开关迎敌，侥幸一决（损兵2500，军心-8）', effect: { armyLoss: 2500, armyMorale: -8 } }
    ]
  },
  {
    id: 'v22_mu_suiyang', name: '睢阳望援', illustration: 'city_siege',
    description: '睢阳被围日久，城中食尽，士皆米糠而食。南霁云冒围出，泣告临淮，乞师以救一城之命。',
    options: [
      { text: '发兵赴援，护江淮（金-1500，兵+2000，民心+6）', effect: { money: -1500, armyLoss: -2000, morale: 6 } },
      { text: '坐视不救，畏贼不进（comm-8，民心-10）', effect: { comm: -8, morale: -10 } }
    ]
  },
  {
    id: 'v22_mu_heyang', name: '河阳桥断', illustration: 'drought',
    description: '河阳浮桥跨河，北兵若渡，可直叩东都。谍者言贼谋断河阳桥，绝南北之路。',
    options: [
      { text: '发兵戍桥，护往来（金-600，兵+1200）', effect: { money: -600, armyLoss: -1200 } },
      { text: '桥自危，徐图之（comm-5，民心-3）', effect: { comm: -5, morale: -3 } }
    ]
  },
  {
    id: 'v22_mu_shuofang', name: '朔方骑集', illustration: 'cavalry_charge',
    description: '朔方节度使奏：兵精马良，屯于河外，请率精骑五万，东出讨贼，以收两京。',
    options: [
      { text: '促其东讨，克复两京（损兵2000，金-1000，军心+8）', effect: { armyLoss: 2000, money: -1000, armyMorale: 8 } },
      { text: '兵疲马瘦，且休（军心-3）', effect: { armyMorale: -3 } }
    ]
  },
  // ---- 政治 4 ----
  {
    id: 'v22_zheng_jixia', name: '集贤校书', illustration: 'harvest',
    description: '集贤殿聚天下图书八万卷，学士请选儒臣校勘，缮写四部，以广文德。',
    options: [
      { text: '开馆校书，厚赐学士（金-800，文化+10）', effect: { money: -800, culture: 10 } },
      { text: '戎马倥偬，未遑斯文（文化+1）', effect: { culture: 1 } }
    ]
  },
  {
    id: 'v22_zheng_zhongshu', name: '政事堂议', illustration: 'harvest',
    description: '中书门下政事堂，宰相合议军国大政。有司请增谏官，广开言路。',
    options: [
      { text: '增置谏官，下诏求言（金-400，民心+5，文化+4）', effect: { money: -400, morale: 5, culture: 4 } },
      { text: '率由旧章，不必改作（文化+1）', effect: { culture: 1 } }
    ]
  },
  {
    id: 'v22_zheng_jiedu', name: '藩镇入觐', illustration: 'harvest',
    description: '河北、朔方诸镇节度使表请入朝，贡奉相望。朝廷疑其邀功，或欲留之京师。',
    options: [
      { text: '厚礼遣还，各守封疆（comm+6，蛮族关系+8）', effect: { comm: 6, barbarianRel: 8 } },
      { text: '留之京师，夺其兵柄（军心-6，金+1000）', effect: { armyMorale: -6, money: 1000 } }
    ]
  },
  {
    id: 'v22_zheng_jianjun', name: '宦官监军', illustration: 'harvest',
    description: '边将出征，例遣宦官监其军，诸将皆受制于中人，多不平。有司请罢之。',
    options: [
      { text: '罢监军，专任将帅（军心+6，文化+3）', effect: { armyMorale: 6, culture: 3 } },
      { text: '仍遣监军，以防将帅（军心-5，民心-2）', effect: { armyMorale: -5, morale: -2 } }
    ]
  },
  // ---- 经济 4 ----
  {
    id: 'v22_jing_caoyun', name: '汴渠漕运', illustration: 'harvest',
    description: '汴渠贯河淮，转江淮之粟以给关中。岁漕四百万石，舟船相属。会漕渠淤浅，有司请浚治。',
    options: [
      { text: '发卒浚渠，岁漕增益（金-1200，comm+10，粮+1500）', effect: { money: -1200, comm: 10, food: 1500 } },
      { text: '因循不浚，漕运渐阻（comm-8，粮-1000）', effect: { comm: -8, food: -1000 } }
    ]
  },
  {
    id: 'v22_jing_yanyi', name: '沧州海盐', illustration: 'harvest',
    description: '沧州滨海，煮海为盐，岁利百万。有司请置盐院，榷其利以佐军。',
    options: [
      { text: '置榷盐院，岁增其利（金+2000，comm+6，民心-4）', effect: { money: 2000, comm: 6, morale: -4 } },
      { text: '弛盐禁，与民共之（民心+5，comm-3）', effect: { morale: 5, comm: -3 } }
    ]
  },
  {
    id: 'v22_jing_bosijuan', name: '博陵丝绢', illustration: 'harvest',
    description: '河北博陵、定州绫绢之精，甲于天下，商贾贸迁，岁直巨万。请置官市，平其价。',
    options: [
      { text: '官市绫绢，转售获利（金+1800，comm+7）', effect: { money: 1800, comm: 7 } },
      { text: '任民贸易，不与争利（comm+2，民心+2）', effect: { comm: 2, morale: 2 } }
    ]
  },
  {
    id: 'v22_jing_quanhe', name: '关中市易', illustration: 'harvest',
    description: '长安东市，四夷商胡骈集，玉帛珍货山积。有司请增税关市，以赡国用。',
    options: [
      { text: '增关市之税（金+1500，comm-4，民心-3）', effect: { money: 1500, comm: -4, morale: -3 } },
      { text: '薄赋来远，安四夷（comm+6，蛮族关系+8）', effect: { comm: 6, barbarianRel: 8 } }
    ]
  },
  // ---- 文化 4（科举类）----
  {
    id: 'v22_wen_fangbang', name: '春闱放榜', illustration: 'harvest',
    description: '礼部春闱，举子数千人，糊名考定。榜出，进士及第者三十人，皆衣绿袍，拜于廊下。',
    options: [
      { text: '临轩问策，拔擢寒俊（金-500，文化+10，民心+6）', effect: { money: -500, culture: 10, morale: 6 } },
      { text: '循故事，不亲阅（文化+2）', effect: { culture: 2 } }
    ]
  },
  {
    id: 'v22_wen_zhuangyuan', name: '状元游街', illustration: 'harvest',
    description: '新科状元跨马游街，长安士女倾都观之，槐阴夹道，丝竹骈阗，真太平盛事。',
    options: [
      { text: '赐曲江宴，宠荣之（金-600，文化+8，民心+5）', effect: { money: -600, culture: 8, morale: 5 } },
      { text: '浮费无益，罢之（文化+1）', effect: { culture: 1 } }
    ]
  },
  {
    id: 'v22_wen_luodi', name: '举子落第', illustration: 'drought',
    description: '举子赴试不第，落魄长安，或有老于场屋者，自叹：太宗皇帝真长策，赚得英雄尽白头。',
    options: [
      { text: '赐落第者出身，慰之（金-300，文化+6，民心+4）', effect: { money: -300, culture: 6, morale: 4 } },
      { text: '科第自有程，何恤焉（民心-3）', effect: { morale: -3 } }
    ]
  },
  {
    id: 'v22_wen_tongnian', name: '同年宴集', illustration: 'harvest',
    description: '新进士曲江杏园宴，题名雁塔，朝之公卿家竞观之，或于其间选东床快婿。',
    options: [
      { text: '赐宴曲江，荣宠同年（金-500，文化+7，民心+3）', effect: { money: -500, culture: 7, morale: 3 } },
      { text: '宴饮浮费，省之（文化+1）', effect: { culture: 1 } }
    ]
  },
  // ---- 特殊 3 ----
  {
    id: 'v22_te_changan_huo', name: '宫阙兵火', illustration: 'rebellion',
    description: '贼骑入长安，宫室焚掠，九衢灰烬，士民奔走，哭声震野。行宫宝货，散入人家。',
    options: [
      { text: '收复后裒聚重修（金-2000，文化-8，民心-6）', effect: { money: -2000, culture: -8, morale: -6 } },
      { text: '先复宫阙，再图修补（金-800，民心+2）', effect: { money: -800, morale: 2 } }
    ]
  },
  {
    id: 'v22_te_majie', name: '马嵬惊变', illustration: 'drought',
    description: '驾幸蜀，次马嵬，军士饥疲，陈玄礼以祸国由杨国忠，遂斩国忠。六军不发，请诛贵妃。',
    options: [
      { text: '忍痛赐死，以安军情（军心+10，民心-8，文化-4）', effect: { armyMorale: 10, morale: -8, culture: -4 } },
      { text: '拥贵妃以谢军（军心-12，民心+4）', effect: { armyMorale: -12, morale: 4 } }
    ]
  },
  {
    id: 'v22_te_huihe_yuan', name: '回纥入援', illustration: 'cavalry_charge',
    description: '回纥怀仁可汗遣太子叶护，将精骑四千助唐，云愿助天子复两京，事平，愿得金帛子女。',
    options: [
      { text: '厚约共收两京（金-1500，兵+3000，comm+4）', effect: { money: -1500, armyLoss: -3000, comm: 4 } },
      { text: '借兵夷狄，国之耻也（兵-2000，军心+3）', effect: { armyLoss: 2000, armyMorale: 3 } }
    ]
  },
  // ===== V23.0 中唐藩镇/科举选官二十事件 =====
  // ---- 军事 5 ----
  {
    id: 'v23_mu_yabing', name: '魏博牙兵', illustration: 'cavalry_charge',
    description: '魏博节度使选军中魁锐万人，号为牙兵，禀给优厚，父子世袭，变易主帅，如在掌握。将吏皆畏之。',
    options: [
      { text: '厚赐牙兵，以固其心（金-1500，军心+6）', effect: { money: -1500, armyMorale: 6 } },
      { text: '稍裁其额，渐收兵权（军心-8，comm+4）', effect: { armyMorale: -8, comm: 4 } }
    ]
  },
  {
    id: 'v23_mu_xueye', name: '雪夜袭蔡', illustration: 'city_siege',
    description: '唐邓节度使李愬谋袭蔡州。会大雪，裂旗旆，持枒马，行七十里。夜半至城下，元济犹未知。此出其不意之奇也。',
    options: [
      { text: '用奇雪夜进兵（自动大战，兵-1500，军心+8）', effect: { massBattle: true, armyLoss: 1500, armyMorale: 8 } },
      { text: '天寒道阻，不可以进（军心-4，comm-3）', effect: { armyMorale: -4, comm: -3 } }
    ]
  },
  {
    id: 'v23_mu_liangyuan', name: '平凉劫盟', illustration: 'rebellion',
    description: '吐蕃请盟于平凉。唐将马燧信其言，劝帝许之。及盟，伏兵起，劫宋奉朝，浑瑊跃得马免。群臣震恐。',
    options: [
      { text: '勒兵备边，绝其和（金-800，兵+1000，comm-4）', effect: { money: -800, armyLoss: -1000, comm: -4 } },
      { text: '再遣使修好，羁縻之（蛮族关系+6，军心-5）', effect: { barbarianRel: 6, armyMorale: -5 } }
    ]
  },
  {
    id: 'v23_mu_mubing', name: '方镇募兵', illustration: 'cavalry_charge',
    description: '河北诸镇各募勇士，增缮甲兵，厚自奉养，名为牙兵、衙队，以自卫。朝廷疑之，或请制其额。',
    options: [
      { text: '听其自募，以备边（兵+2000，金-600）', effect: { armyLoss: -2000, money: -600 } },
      { text: '下诏禁其增募（comm-6，军心-3）', effect: { comm: -6, armyMorale: -3 } }
    ]
  },
  {
    id: 'v23_mu_jianghuan', name: '骄军逐帅', illustration: 'rebellion',
    description: '汴州军乱，逐其帅。军士利剽掠，乃相与哗变。朝廷议遣重臣镇抚，或欲因而讨之。',
    options: [
      { text: '遣重臣抚定，赦其乱（金-1000，comm+5，民心+4）', effect: { money: -1000, comm: 5, morale: 4 } },
      { text: '兴师讨乱，诛首恶（自动大战，兵-2500，民心-6）', effect: { massBattle: true, armyLoss: 2500, morale: -6 } }
    ]
  },
  // ---- 政治 4 ----
  {
    id: 'v23_zheng_juzhi', name: '吏部注拟', illustration: 'harvest',
    description: '吏部三铨，集选人，考身言书判，注拟州县官。季春，唱第。选人或有淹滞，或有幸进。',
    options: [
      { text: '严选曹，杜幸门（金-400，文化+6，民心+4）', effect: { money: -400, culture: 6, morale: 4 } },
      { text: '循资格，不亲察（文化+1）', effect: { culture: 1 } }
    ]
  },
  {
    id: 'v23_zheng_guancha', name: '观察巡行', illustration: 'harvest',
    description: '诸道观察使分巡州县，察官吏能否，问民疾苦。有司请遣使巡行，以观风俗。',
    options: [
      { text: '遣御史分察州县（金-600，comm+6，民心+5）', effect: { money: -600, comm: 6, morale: 5 } },
      { text: '委观察使自察（comm+2）', effect: { comm: 2 } }
    ]
  },
  {
    id: 'v23_zheng_liubo', name: '流外入流', illustration: 'harvest',
    description: '诸司令史、书令史等流外官，积考入流，或得为令录。议者以为刀笔之人，不可委民政。',
    options: [
      { text: '限流外不得为清资（文化+5，民心+3）', effect: { culture: 5, morale: 3 } },
      { text: '任其积劳叙进（comm+3，文化-2）', effect: { comm: 3, culture: -2 } }
    ]
  },
  {
    id: 'v23_zheng_yizhou', name: '朝廷易帅', illustration: 'harvest',
    description: '方镇帅死，或其子自请继袭，或军中推立。朝廷或因而命之，或别遣将。议者以为不可长姑息。',
    options: [
      { text: '别遣文臣代之（金-800，comm+6，军心-4）', effect: { money: -800, comm: 6, armyMorale: -4 } },
      { text: '因其请而命之（comm-4，军心+5）', effect: { comm: -4, armyMorale: 5 } }
    ]
  },
  // ---- 经济 4 ----
  {
    id: 'v23_jing_liangshui', name: '两税定法', illustration: 'harvest',
    description: '度支使杨炎建议：凡百役之费，一钱之敛，先度其数而赋于人，量出以制入。夏输无过六月，秋输无过十一月。',
    options: [
      { text: '行两税法，罢租庸（金+1500，comm+8，民心-4）', effect: { money: 1500, comm: 8, morale: -4 } },
      { text: '仍行租庸旧法（comm+2，民心+2）', effect: { comm: 2, morale: 2 } }
    ]
  },
  {
    id: 'v23_jing_quecha', name: '榷茶之利', illustration: 'harvest',
    description: '江淮间人酷嗜茶，茶商贸迁，岁利甚博。有司请榷茶，置吏出茶，以佐军。',
    options: [
      { text: '置榷茶使，岁增其利（金+1800，comm+5，民心-3）', effect: { money: 1800, comm: 5, morale: -3 } },
      { text: '弛茶禁，与民共之（民心+4，comm-2）', effect: { morale: 4, comm: -2 } }
    ]
  },
  {
    id: 'v23_jing_haiyun', name: '明州市舶', illustration: 'harvest',
    description: '明州东控大海，倭人、新罗、百济商舶岁至，市易珍宝香药。有司请置市舶院，平其价。',
    options: [
      { text: '置市舶院，收其利（金+2000，comm+10）', effect: { money: 2000, comm: 10 } },
      { text: '薄赋来远，通商旅（comm+5，蛮族关系+6）', effect: { comm: 5, barbarianRel: 6 } }
    ]
  },
  {
    id: 'v23_jing_hesu', name: '河朔盐利', illustration: 'harvest',
    description: '河北诸州，盐利皆入于军，不复上供。有司请榷其盐，以助国用。然河北未平，恐生变。',
    options: [
      { text: '遣使榷盐，收其利（金+1600，comm+4，军心-5）', effect: { money: 1600, comm: 4, armyMorale: -5 } },
      { text: '因之不取，以安其心（comm+2，蛮族关系+4）', effect: { comm: 2, barbarianRel: 4 } }
    ]
  },
  // ---- 文化 4（科举/选官）----
  {
    id: 'v23_wen_dianshi', name: '殿试制策', illustration: 'harvest',
    description: '举人及第前，天子御殿，亲试之，观其文词，第其高下。谓之殿试。由是，进士皆为天子门生。',
    options: [
      { text: '临轩亲试，拔擢寒俊（金-500，文化+10，民心+6）', effect: { money: -500, culture: 10, morale: 6 } },
      { text: '委考功，不亲试（文化+2）', effect: { culture: 2 } }
    ]
  },
  {
    id: 'v23_wen_hongwen', name: '弘文崇文', illustration: 'harvest',
    description: '弘文馆、崇文馆，皆聚学士，以教贵游子弟。有司请选耆儒，校理图书，讲论经义。',
    options: [
      { text: '选儒臣，讲经籍（金-700，文化+9，民心+3）', effect: { money: -700, culture: 9, morale: 3 } },
      { text: '戎务方殷，未遑斯文（文化+1）', effect: { culture: 1 } }
    ]
  },
  {
    id: 'v23_wen_shifu', name: '诗赋取士', illustration: 'harvest',
    description: '进士科先试诗赋、帖经，然后策问。或病其浮华，不切时务，请罢诗赋，专考经义。',
    options: [
      { text: '罢诗赋，先策论（文化+8，民心+4）', effect: { culture: 8, morale: 4 } },
      { text: '仍以诗赋取士（文化+3）', effect: { culture: 3 } }
    ]
  },
  {
    id: 'v23_wen_siku', name: '四库校书', illustration: 'harvest',
    description: '集贤殿聚四库书，甲乙丙丁，分库藏之。学士请选儒臣缮写校勘，以广秘籍。',
    options: [
      { text: '开馆缮写，厚赐学士（金-900，文化+10）', effect: { money: -900, culture: 10 } },
      { text: '因循旧藏，不事缮写（文化+1）', effect: { culture: 1 } }
    ]
  },
  // ---- 特殊 3 ----
  {
    id: 'v23_te_shixi', name: '父死子继', illustration: 'rebellion',
    description: '魏博帅田承嗣卒，军中请以其侄悦知留后。朝廷若不许，则其兵自拒；若许之，则方镇之祸成矣。',
    options: [
      { text: '因其请而命之（comm-8，蛮族关系+6）', effect: { comm: -8, barbarianRel: 6 } },
      { text: '兴师问罪，别命帅（自动大战，兵-3000，民心-8）', effect: { massBattle: true, armyLoss: 3000, morale: -8 } }
    ]
  },
  {
    id: 'v23_te_mishu', name: '枢密用事', illustration: 'drought',
    description: '宦官为枢密使，掌机密，出纳王命，宰相但行文书而已。或有请罢之者，中人皆怒。',
    options: [
      { text: '罢枢密，归政宰相（军心+6，民心+5，文化+3）', effect: { armyMorale: 6, morale: 5, culture: 3 } },
      { text: '仍用宦官掌枢密（军心-4，民心-3）', effect: { armyMorale: -4, morale: -3 } }
    ]
  },
  {
    id: 'v23_te_hebei', name: '河朔三镇', illustration: 'barbarian_invasion',
    description: '成德、魏博、卢龙三镇，相与根据，虽称臣，不禀朝命，官爵自署，租税不上，以土地传子孙。朝廷不能制。',
    options: [
      { text: '姑务姑息，许其世袭（comm-10，蛮族关系+8）', effect: { comm: -10, barbarianRel: 8 } },
      { text: '下诏削地，命诸道进讨（自动大战，兵-4000，金-2000）', effect: { massBattle: true, armyLoss: 4000, money: -2000 } }
    ]
  },
  // ===== V24.0 唐末五代·黄巢起义/梁晋争霸二十事件 =====
  // ---- 军事 5 ----
  {
    id: 'v24_mi_huangchao', name: '黄巢渡淮', illustration: 'barbarian_invasion',
    description: '黄巢自广州北上，众号百万，渡淮而北，所至镇戍，望风降款。淮南节度使高骈，拥兵不讨。朝廷大震。',
    options: [
      { text: '诸道会兵扼淮（自动大战，兵-2000，金-1000）', effect: { massBattle: true, armyLoss: 2000, money: -1000 } },
      { text: '赦巢以天平节钺，冀其降（comm-8，军心-6）', effect: { comm: -8, armyMorale: -6 } }
    ]
  },
  {
    id: 'v24_mi_pangxun', name: '庞勋戍卒', illustration: 'rebellion',
    description: '徐泗戍卒桂州，三岁当代，帅朱泚不听。众怨，杀将，引兵北还，陷徐州，江淮骚然。',
    options: [
      { text: '发诸道兵讨之（自动大战，兵-2500，金-1200）', effect: { massBattle: true, armyLoss: 2500, money: -1200 } },
      { text: '赦其罪，罢归田里（民心+6，comm-4）', effect: { morale: 6, comm: -4 } }
    ]
  },
  {
    id: 'v24_mi_shangyuan', name: '上源驿之变', illustration: 'rebellion',
    description: '朱温邀李克用入城，馆于上源驿，夜置酒。既罢，伏兵起，纵火。克用缒城得免，监军陈景思已下皆死。由是梁晋之怨，终其身不解。',
    options: [
      { text: '克用驰归，誓众复仇（comm-6，军心+5）', effect: { comm: -6, armyMorale: 5 } },
      { text: '遣使和解，姑置勿较（蛮族关系+5，comm-3）', effect: { barbarianRel: 5, comm: -3 } }
    ]
  },
  {
    id: 'v24_mi_jiahe', name: '梁晋夹河', illustration: 'cavalry_charge',
    description: '梁晋兵争河北，夹河为栅，大小百余战。杨刘、德胜，为必争之地。军士疲于奔命，河南北之民，不得耕织。',
    options: [
      { text: '筑垒德胜，以扼河津（金-1500，comm+6，军心+4）', effect: { money: -1500, comm: 6, armyMorale: 4 } },
      { text: '退军河北，休养士卒（军心-5，comm-3）', effect: { armyMorale: -5, comm: -3 } }
    ]
  },
  {
    id: 'v24_mi_yajun', name: '魏博牙军', illustration: 'rebellion',
    description: '魏博牙军，父子世袭，丰给厚赐，骄益骄。主帅或有进退，牙军辄杀之，易置主帅，如反掌耳。朝廷不能制。',
    options: [
      { text: '因而抚之，厚加赐与（金-1800，军心+6，民心-4）', effect: { money: -1800, armyMorale: 6, morale: -4 } },
      { text: '密图牙首，渐次诛之（自动大战，兵-2000，comm+5）', effect: { massBattle: true, armyLoss: 2000, comm: 5 } }
    ]
  },
  // ---- 政治 4 ----
  {
    id: 'v24_zh_nanya', name: '南衙北司', illustration: 'harvest',
    description: '南衙，宰相百官也；北司，宦官也。文宗以后，宦官握神策军，弑立皆出其手。宰相但奉行文书，至有：吾辈为天子，孰为我家！',
    options: [
      { text: '与宰相谋，尽除宦官（军心+6，民心+5，文化+3）', effect: { armyMorale: 6, morale: 5, culture: 3 } },
      { text: '仍用宦官掌枢密（军心-5，民心-4）', effect: { armyMorale: -5, morale: -4 } }
    ]
  },
  {
    id: 'v24_zh_baimayi', name: '白马驿之祸', illustration: 'drought',
    description: '柳逢谓朱温曰：此辈自谓清流，宜投之黄河，使为浊流。朱温然之。于是裴枢、陆扆等三十余朝士，皆杀于滑州白马驿，投尸于河。唐之缙绅，遂尽。',
    options: [
      { text: '从邪说，尽杀朝士（文化-15，民心-10，comm+4）', effect: { culture: -15, morale: -10, comm: 4 } },
      { text: '不听，保全缙绅（文化+8，民心+6）', effect: { culture: 8, morale: 6 } }
    ]
  },
  {
    id: 'v24_zh_mufu', name: '方镇辟署', illustration: 'harvest',
    description: '唐中叶以后，方镇得自辟署判官、掌书记。士人不得志于有司者，多游诸侯幕府。由是，诸侯得自选其才，而朝廷之选官，益轻。',
    options: [
      { text: '听幕府自辟才俊（comm+6，文化+4，金-600）', effect: { comm: 6, culture: 4, money: -600 } },
      { text: '罢幕府辟署，一归吏部（comm-4，文化-2）', effect: { comm: -4, culture: -2 } }
    ]
  },
  {
    id: 'v24_zh_tangming', name: '唐室南迁', illustration: 'harvest',
    description: '黄巢犯长安，天子幸蜀。百官从者，什无二三。及收复，朝廷命令，所行才数十州。议者以为宜建都金陵，以图兴复。',
    options: [
      { text: '幸蜀图存，徐图兴复（金-1500，comm-4，民心+3）', effect: { money: -1500, comm: -4, morale: 3 } },
      { text: '坚守长安，不去宗庙（comm+5，军心+4，民心-4）', effect: { comm: 5, armyMorale: 4, morale: -4 } }
    ]
  },
  // ---- 经济 4 ----
  {
    id: 'v24_jing_cha', name: '榷茶重敛', illustration: 'harvest',
    description: '武宗、宣宗以来，茶价日增。江淮间，茶贩私鬻，犯法者众。有司请增榷茶之赋，以佐军兴。',
    options: [
      { text: '增榷茶钱，岁入其利（金+2000，comm+6，民心-5）', effect: { money: 2000, comm: 6, morale: -5 } },
      { text: '弛茶禁，与民共之（民心+5，comm-3）', effect: { morale: 5, comm: -3 } }
    ]
  },
  {
    id: 'v24_jing_yan', name: '盐铁专卖', illustration: 'harvest',
    description: '唐世盐铁，刘晏为相，最为得人。及晏死，盐法寖坏。藩镇擅盐利，有司不能制。有司请复榷盐之法，以收利权。',
    options: [
      { text: '遣榷盐使，收其利（金+2200，comm+5，民心-4）', effect: { money: 2200, comm: 5, morale: -4 } },
      { text: '因藩镇之利，不急征（comm+2，蛮族关系+5）', effect: { comm: 2, barbarianRel: 5 } }
    ]
  },
  {
    id: 'v24_jing_hai', name: '泉州蕃舶', illustration: 'harvest',
    description: '泉州、福州，海舶岁至，蕃商云集，象犀、珠玑、香药，积如丘山。闽王审知，招徕海贾，府库充实。',
    options: [
      { text: '置市舶司，收其利（金+2400，comm+8）', effect: { money: 2400, comm: 8 } },
      { text: '薄赋通商，以来远人（comm+5，蛮族关系+7）', effect: { comm: 5, barbarianRel: 7 } }
    ]
  },
  {
    id: 'v24_jing_nong', name: '张全义劝农', illustration: 'harvest',
    description: '洛阳自丧乱后，县城丘墟。张全义为河南尹，选屯将十八人，督民耕桑。数年，京畿之间，遂无闲田，户口完实。',
    options: [
      { text: '选屯将，督耕桑（金-800，agri+10，民心+6）', effect: { money: -800, agri: 10, morale: 6 } },
      { text: '军旅方兴，未遑农务（agri+2）', effect: { agri: 2 } }
    ]
  },
  // ---- 文化 4（科举/选官深化）----
  {
    id: 'v24_wen_jinshi', name: '进士及第', illustration: 'harvest',
    description: '唐世进士科，最为贵科。每岁，试于尚书省，放榜，得人最盛。然宗室、公卿子弟，多假名及第；寒士或老死文场。议者请复试之。',
    options: [
      { text: '严复试，拔寒俊（金-500，文化+10，民心+6）', effect: { money: -500, culture: 10, morale: 6 } },
      { text: '循故事，不复核（文化+2）', effect: { culture: 2 } }
    ]
  },
  {
    id: 'v24_wen_zhijie', name: '制举召试', illustration: 'harvest',
    description: '天子自诏，举贤良方正直言极谏之士，亲策于殿。谓之制举。非常选，以待非常之才。唐末，久不举，士多失职。',
    options: [
      { text: '诏制举，求直言（金-700，文化+9，民心+5）', effect: { money: -700, culture: 9, morale: 5 } },
      { text: '戎务方殷，罢制举（文化+1）', effect: { culture: 1 } }
    ]
  },
  {
    id: 'v24_wen_guanlu', name: '关试春关', illustration: 'harvest',
    description: '进士及第，吏部关试，然后春关。关试之日，状元以下，皆列拜于座主。谓之门生。由是，座主、门生，结为朋党。',
    options: [
      { text: '严关试，禁朋党（文化+7，民心+4）', effect: { culture: 7, morale: 4 } },
      { text: '仍听座主、门生相结（文化+2，comm-2）', effect: { culture: 2, comm: -2 } }
    ]
  },
  {
    id: 'v24_wen_xueguan', name: '学官选任', illustration: 'harvest',
    description: '国子监祭酒、司业，皆儒学之官。唐末，多以贵游子弟为之，不由科第。太学弟子，或多不习。议者请选经术之士，以掌教。',
    options: [
      { text: '选经术儒臣为学官（金-600，文化+9，民心+3）', effect: { money: -600, culture: 9, morale: 3 } },
      { text: '仍以他官兼判（文化+1）', effect: { culture: 1 } }
    ]
  },
  // ---- 特殊 3 ----
  {
    id: 'v24_te_daitang', name: '朱温代唐', illustration: 'drought',
    description: '朱温既杀昭宗，立哀帝。又杀太后，诛朝士。乃迫哀帝禅位，国号梁。唐高祖、太宗之业，遂绝。二十四史，遂入五代。',
    options: [
      { text: '受唐禅，即皇帝位（comm+10，民心-15，文化-8）', effect: { comm: 10, morale: -15, culture: -8 } },
      { text: '挟天子，令诸侯（comm+5，蛮族关系+5）', effect: { comm: 5, barbarianRel: 5 } }
    ]
  },
  {
    id: 'v24_te_shatuo', name: '沙陀入据', illustration: 'barbarian_invasion',
    description: '沙陀本西突厥别部，自朱邪赤心赐姓李氏，世守河东。及李克用，以沙陀骑破黄巢，遂强。梁、唐、晋、汉，皆沙陀之胤。夷狄之盛，未有甚于此时者。',
    options: [
      { text: '厚抚沙陀，借其兵（金-2000，comm+6，蛮族关系+8）', effect: { money: -2000, comm: 6, barbarianRel: 8 } },
      { text: '渐削其权，不使强（comm-6，军心-4）', effect: { comm: -6, armyMorale: -4 } }
    ]
  },
  {
    id: 'v24_te_shiguo', name: '十国割据', illustration: 'rebellion',
    description: '梁唐之际，王建称帝蜀，杨吴据淮南，钱镠王吴越，马殷王楚，王审知王闽，刘岩王南汉，高季兴据荆南。天下分裂，大者帝，小者王。',
    options: [
      { text: '姑务自治，徐图混一（comm+4，民心+4）', effect: { comm: 4, morale: 4 } },
      { text: '兴师讨不庭（自动大战，兵-3500，金-1500）', effect: { massBattle: true, armyLoss: 3500, money: -1500 } }
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
  },

  // ============================================================
  // V17.0 新增历史事件（5个，v17_ 前缀）—— 隋·隋末唐初大事
  // ============================================================

  // ---- 1) 炀帝一征高句丽（612年）----
  {
    id: 'v17_sui_zheng_gaogouli', name: '炀帝征辽', illustration: 'barbarian_invasion',
    minTurn: 18, factions: ['xiwei'],
    description: '大业八年，炀帝下诏征高丽。左十二军、右十二军，络绎引途，总一百一十三万，馈运者倍之。车驾度辽，围辽东。高丽数度请降，每降辄停攻，使得修守，卒不克。九军并溃，唯卫文升一军独全。帝由是班师，而天下盗起。',
    options: [
      { text: '大举亲征，志在平辽（自动大战，损兵3000，金-1500）', effect: { massBattle: true, armyLoss: 3000, money: -1500 } },
      { text: '下诏罢征，以安百姓（民心+10，金-500）', effect: { factionMorale: 10, money: -500 } }
    ]
  },
  // ---- 2) 隋废后梁（587年）----
  {
    id: 'v17_mie_houliang', name: '隋废后梁', illustration: 'court',
    minTurn: 9, factions: ['xiwei'],
    description: '开皇七年，后梁主萧琮朝于长安，文帝留琮不遣。其叔父萧岩、弟萧瓛率文武十万人，驱居民奔陈。文帝乃下诏废梁，拜琮为上柱国，封莒国公。后梁自萧詧都江陵，凡三主三十三年而亡。',
    options: [
      { text: '遂废其国，郡县江陵（金+1200，民心+4）', effect: { money: 1200, factionMorale: 4 } },
      { text: '复立萧琮，以守梁祀（金-400，忠诚+5）', effect: { money: -400, generalLoyalty: { amt: 5 } } }
    ]
  },
  // ---- 3) 炀帝开大运河（605年）----
  {
    id: 'v17_kai_dayunhe', name: '开通济渠', illustration: 'maritime_trade',
    minTurn: 12, factions: ['xiwei'],
    description: '大业元年，炀帝发河南、淮北诸郡男女百余万，开通济渠。自西苑引谷、洛水达于河，又自板渚引河历荥泽入汴，复自大梁之东引汴水入泗，达于淮。又发淮南民十万开邗沟。渠广四十步，旁筑御道，树以柳。自长安至江都，置离宫四十余所。',
    options: [
      { text: '大兴土木，贯通南北（粮+2000，金-1200，民心-5）', effect: { food: 2000, money: -1200, factionMorale: -5 } },
      { text: '暂罢民力，徐议开浚（民心+3，金+300）', effect: { factionMorale: 3, money: 300 } }
    ]
  },
  // ---- 4) 太原李渊起兵（617年）----
  {
    id: 'v17_taiyuan_bingqi', name: '太原起兵', illustration: 'rebellion',
    minTurn: 20, factions: ['xiwei'],
    description: '大业十三年，唐公李渊为太原留守。突厥寇马邑，诏系渊。渊子世民阳与晋阳宫监裴寂谋，阴结死士，因寂入官，胁渊起兵。乃杀太原副留守，开大将军府，建旗誓众。西河、绛郡皆下，遂西向关中，长安镇奔溃。关中豪杰争归之，所向皆下。',
    options: [
      { text: '发兵急击，以讨逆节（自动大战，损兵2000，金-800）', effect: { massBattle: true, armyLoss: 2000, money: -800 } },
      { text: '下诏招抚，许以王爵（忠诚+6，金+500）', effect: { generalLoyalty: { amt: 6 }, money: 500 } }
    ]
  },
  // ---- 5) 江都之变（618年）----
  {
    id: 'v17_jiangdu_zhibian', name: '江都之变', illustration: 'mutiny',
    minTurn: 22, factions: ['xiwei'],
    description: '大业十四年，炀帝在江都，荒淫益甚，而骁果思归。宇文化及、司马德戡因骁果思归之心，夜营于东城，引兵入玄武门。帝闻变，易服逃于西阁。乱兵入，欲弑之。帝曰：天子死自有法，何加锋刃！乃进之。遂崩，年五十。隋亡。',
    options: [
      { text: '出师讨逆，以复君仇（自动大战，损兵2500，金+1000）', effect: { massBattle: true, armyLoss: 2500, money: 1000 } },
      { text: '社稷倾矣，权宜迁都（民心-15，金-500）', effect: { factionMorale: -15, money: -500 } }
    ]
  },

  // === V18.0 历史事件五（隋末唐初扩展）===
  // 仁寿宫变（604）：隋文帝崩于仁寿宫，杨广即位，是为炀帝
  {
    id: 'v18_renshou_bian', name: '仁寿宫变', illustration: 'abdication',
    minTurn: 45, factions: ['xiwei'],
    description: '隋仁寿四年（604），文帝崩于仁寿宫。中外颇有异言，或疑宫闱之变。晋王广入奉遗诏，即皇帝位，是为炀帝。一时朝野屏息，人心未安。',
    options: [
      { text: '奉遗诏正大位，恩赏百官（民心+8，金+1000）', effect: { factionMorale: 8, money: 1000 } },
      { text: '收缚异议，以塞众口（军心+6，民心-8）', effect: { armyMorale: 6, morale: -8 } }
    ]
  },
  // 炀帝西巡（609）：炀帝亲巡河右，破吐谷浑，置西海、河源等郡
  {
    id: 'v18_yangdi_xixun', name: '炀帝西巡', illustration: 'cavalry_charge',
    minTurn: 48, factions: ['xiwei'],
    description: '隋大业五年（609），炀帝西巡河右，次焉支山。高昌王麴伯雅、伊吾吐屯设等二十七国谒于道左。遂破吐谷浑，拓地数千里，置西海、河源、鄯善、且末等郡，天下轻罪徙以实之。',
    options: [
      { text: '耀兵西域，列郡置戍（金-1500，文化+8，招募一将）', effect: { money: -1500, culture: 8, recruitRandom: true } },
      { text: '厚赐诸国，耀威而还（金-800，民心+5）', effect: { money: -800, morale: 5 } }
    ]
  },
  // 玄武门之变（626）：秦王李世民伏兵玄武门，诛建成元吉，旋立为太子
  {
    id: 'v18_xuanwumen', name: '玄武门之变', illustration: 'cavalry_charge',
    minTurn: 55, factions: ['xiwei'],
    description: '唐武德九年（626），秦王世民与太子建成、齐王元吉隙已成。六月，世民伏兵玄武门，射杀建成，元吉亦为尉迟敬德所杀。高祖遂立世民为太子，旋禅位。喋血禁门，天人之变。',
    options: [
      { text: '遂定大计，入继大统（军心+12，民心-6）', effect: { armyMorale: 12, morale: -6 } },
      { text: '推功于下，大赦天下（民心+10，金+800）', effect: { morale: 10, money: 800 } }
    ]
  },
  // 唐灭东突厥（630）：李靖、李勣破突厥于阴山，颉利可汗被俘
  {
    id: 'v18_tang_mie_tujue', name: '唐灭东突厥', illustration: 'cavalry_charge',
    minTurn: 60, factions: ['xiwei'],
    description: '唐贞观四年（630），李靖、李勣分道出塞。靖率骁骑三千自马邑趋恶阳岭，夜袭定襄；勣出云中，会靖于白道。颉利可汗退保铁山，欲请举国内附，靖勒兵袭之，大破其众，遂擒颉利，送长安。东突厥遂亡。',
    options: [
      { text: '犁庭扫穴，勒石燕然（自动大战，民心+12）', effect: { massBattle: true, factionMorale: 12 } },
      { text: '受其降，置之河南（金+1500，军心+4）', effect: { money: 1500, armyMorale: 4 } }
    ]
  },
  // 贞观之治（627起）：太宗任魏徵、房玄龄，轻徭薄赋，天下大治
  {
    id: 'v18_zhenguan_zhizhi', name: '贞观之治', illustration: 'harvest',
    minTurn: 58, factions: ['xiwei'],
    description: '唐贞观初，太宗锐精为政，任房玄龄、杜如晦为相，从魏徵之谏，去奢省费，轻徭薄赋，厉以清静。岁终断囚二十九，外户不闭，行旅不赍粮，东至于海，南尽于岭，皆外户不闭，行旅不赍粮。',
    options: [
      { text: '选贤任能，从谏如流（民心+15，文化+10）', effect: { factionMorale: 15, culture: 10 } },
      { text: '偃武修文，与民休息（粮+5000，民心+8）', effect: { food: 5000, morale: 8 } }
    ]
  },

  // === V19.0 历史事件五（隋末唐初扩展）===
  // 雁门之围（615）：炀帝北巡，突厥始毕可汗围之于雁门
  {
    id: 'v19_yanmen_zhiwei', name: '雁门之围', illustration: 'city_siege',
    minTurn: 50, factions: ['xiwei'],
    description: '隋大业十一年（615），炀帝北巡，至雁门。突厥始毕可汗探知之，率数十万骑奄至，围雁门。城城中兵民十五万，粮仅支二旬。炀帝大惧，抱赵王杲而泣，目尽肿。乃下诏天下诸郡募兵赴难，来护儿、王世充等皆将兵至。始毕闻援兵大集，乃解围去。隋氏声威，自此尽矣。',
    options: [
      { text: '下诏诸郡勤王，厚赏战士（金-1500，军心+10）', effect: { money: -1500, armyMorale: 10 } },
      { text: '间道遣使求援于义成公主（金-800，民心+5）', effect: { money: -800, morale: 5 } }
    ]
  },
  // 浅水原之战（618）：李世民破薛仁杲
  {
    id: 'v19_qianshuiyuan', name: '浅水原之战', illustration: 'cavalry_charge',
    minTurn: 52, factions: ['xiwei'],
    description: '唐武德元年（618），薛举寇泾州，太宗李世民拒之。会太宗有疾，卧阁中，诸将为举所败。举死，子仁杲立，居于折墌城。太宗复总统诸军，曰：彼胜而骄，宜坚壁以老之。相持六十余日，仁杲粮尽，将多叛。太宗度其可击，遣庞玉阵于浅水原南，以诱之。大军自原北出其不意，仁杲大溃，太宗率骑追之，遂围折墌。仁杲计穷，出城降。陇西悉平。',
    options: [
      { text: '乘胜长驱，遂平陇西（自动大战，金+1500）', effect: { massBattle: true, money: 1500 } },
      { text: '受其降，置吏抚之（民心+8，粮+3000）', effect: { morale: 8, food: 3000 } }
    ]
  },
  // 唐平李轨（619）：安兴贵执李轨送长安
  {
    id: 'v19_ping_ligui', name: '唐平李轨', illustration: 'cavalry_charge',
    minTurn: 53, factions: ['xiwei'],
    description: '唐武德二年（619），李轨据河西，自称凉王，复称帝。高祖遣使招之，轨不受。轨将安修仁兄兴贵，先在长安，自请诣凉州图轨。兴仁至凉州，阴结诸胡，起兵攻轨。轨不能拒，城陷，遂执轨送长安，河西悉平。',
    options: [
      { text: '犁庭扫穴，遂定河西（金+1200，军心+6）', effect: { money: 1200, armyMorale: 6 } },
      { text: '受其降，宥其妻子（民心+5，金+500）', effect: { morale: 5, money: 500 } }
    ]
  },
  // 唐平萧铣（621）：李靖率水军围江陵
  {
    id: 'v19_ping_xiaoxian', name: '唐平萧铣', illustration: 'cavalry_charge',
    minTurn: 55, factions: ['xiwei'],
    description: '唐武德四年（621），高祖命赵郡王李孝恭为荆湘道行军总管，李靖为行军长史，统十二总管，自夔州顺流东下。时秋水泛涨，铣以江路险绝，官军必不能进，不设备。孝恭、靖乘水涨，骤兵至江陵。铣仓猝征兵，皆未至，遂空城出战。铣兵大败，孝恭围其城。铣困迫，率群臣降。江陵平，南方州县皆望风归附。',
    options: [
      { text: '顺流而下，遂平江陵（自动大战，金+1800）', effect: { massBattle: true, money: 1800 } },
      { text: '受其降，抚安百姓（民心+8，文化+4）', effect: { morale: 8, culture: 4 } }
    ]
  },
  // 唐平刘黑闼（623）：太子建成讨平汉东
  {
    id: 'v19_ping_liuheita', name: '唐平刘黑闼', illustration: 'cavalry_charge',
    minTurn: 57, factions: ['xiwei'],
    description: '唐武德五年（622），刘黑闼引突厥入寇，山东州县多叛应之。太宗太宗讨之，初战于洺水，破黑闼。黑闼奔突厥。未几，复引突厥入，陷沧州。太子建成、齐王元吉讨之。建成纳魏徵之策，悉解俘囚，以示恩信。黑闼食尽，众多亡。黑闼夜走，至饶阳，其下诸葛德威执之以降，斩于洺州。山东遂平。',
    options: [
      { text: '缓兵怀柔，不战而屈人之兵（民心+10，金+1000）', effect: { morale: 10, money: 1000 } },
      { text: '长围急攻，必灭之而后已（自动大战，军心+8）', effect: { massBattle: true, armyMorale: 8 } }
    ]
  },

  // === V20.0 历史事件五（隋唐鼎革扩展）===
  // 隋灭陈（589）：晋王广督师渡江，灭南陈，天下一统
  {
    id: 'v20_suimiefuchen', name: '隋灭陈', illustration: 'city_siege',
    minTurn: 40, factions: ['xiwei', 'nanchao'],
    description: '隋开皇八年（588），文帝以晋王广为元帅，杨素、高颎、韩擒虎、贺若弼并受节度，发兵五十余万，大举伐陈。九年正月，贺若弼自广陵济，韩擒虎自横江济，两道俱入。弼战于钟山，擒虎自新林直趣建康。陈主叔宝与张、孔二妃匿井中，隋兵出之，陈国亡。于是天下复归一统。',
    options: [
      { text: '师出以律，混一区宇（自动大战，金+2000，民心+10）', effect: { massBattle: true, money: 2000, morale: 10 } },
      { text: '纳降抚民，安集江南（文化+10，民心+8）', effect: { culture: 10, morale: 8 } }
    ]
  },
  // 晋阳起兵（617）：李渊自太原起兵，西入关中
  {
    id: 'v20_jinyang_qibing', name: '晋阳起兵', illustration: 'cavalry_charge',
    minTurn: 49, factions: ['xiwei'],
    description: '隋大业十三年（617），李渊为太原留守。次子世民与晋阳令刘文静、宫监裴寂谋，阴结豪杰。斩太原副留守王威、高君雅，传檄称义兵，开仓库以赈穷乏。西河士庶趋赴。渊自将甲士三万，西向关中。破宋老生于霍邑，屈突通守河东不下。渊遂济河，朝邑、蒲阪相次而降，直入长安。立代王侑为帝，渊自为大丞相，封唐王。',
    options: [
      { text: '奋剑唱义，远图关中（自动大战，兵+3000，金+1500）', effect: { massBattle: true, armyLoss: -3000, money: 1500 } },
      { text: '缓甲抚民，以观时变（民心+10，金+800）', effect: { morale: 10, money: 800 } }
    ]
  },
  // 邙山之败（618）：李密邙山败于王世充，瓦岗崩散
  {
    id: 'v20_mangshan_zhan', name: '邙山之败', illustration: 'cavalry_charge',
    minTurn: 51, factions: ['dongwei'],
    description: '唐武德元年（618），李密既破宇文化及，劲兵良马多死。王世充乘其弊，简精卒二万，骑二千，营于洛水。密留王伯当守金墉，自率精兵出偃师，北阻邙山以待之。世充夜遣兵潜入北山，伏兵发，密师大溃。密将张童仁、陈智略皆降。密惧，将万余骑走河阳，王伯当自金墉来会。密欲南阻河，北守太行，东连黎阳，以图进取。诸将皆不可，密遂与伯当归唐。瓦岗之业遂隳。',
    options: [
      { text: '整军再战，雪此一败（自动大战，军心-8，损兵2000）', effect: { massBattle: true, armyMorale: -8, armyLoss: 2000 } },
      { text: '折节归命，另图后举（金-500，民心-5）', effect: { money: -500, morale: -5 } }
    ]
  },
  // 唐受隋禅（618）：李渊受隋恭帝禅，建元武德
  {
    id: 'v20_tangshoushuchan', name: '唐受隋禅', illustration: 'harvest',
    minTurn: 53, factions: ['xiwei'],
    description: '唐武德元年（618）五月，隋恭帝禅位于唐王李渊。渊辞让再三，乃即皇帝位于太极殿，改元武德，国号唐。追尊高祖、世祖，立世子建成为皇太子，世民为秦王，元吉为齐王。遣李世民徇渭北，关中郡县相次降下。隋氏既亡，天下群雄并争，唐遂应运而兴。',
    options: [
      { text: '应天顺人，正位号（民心+15，文化+10，金+2000）', effect: { morale: 15, culture: 10, money: 2000 } },
      { text: '谦让示德，未遽受命（民心+5，金+500）', effect: { morale: 5, money: 500 } }
    ]
  },
  // 玄武门之变（626）：世民伏兵玄武门，杀建成、元吉
  {
    id: 'v20_xuanwu_zhibian', name: '玄武门之变', illustration: 'city_siege',
    minTurn: 59, factions: ['xiwei'],
    description: '唐武德九年（626），秦王世民功高，为太子建成、齐王元吉所忌。六月，太白经天。世民密奏建成、元吉淫乱后宫。高祖命鞫之。庚申，世民率长孙无忌、尉迟敬德等伏兵玄武门。建成、元吉至临湖殿，觉变，欲东归宫府。世民从后呼之，元吉张弓不再三发，世民射建成，杀之。敬德驰骑追元吉，坠马。东宫、齐府兵攻玄武门，敬德持建成、元吉首示之，宫府兵溃。高祖乃立世民为太子，庶政皆决焉。',
    options: [
      { text: '果断乾坤，正位储闱（军心+10，民心+5，金+1000）', effect: { armyMorale: 10, morale: 5, money: 1000 } },
      { text: '姑息嫌隙，隐忍不发（军心-10，民心-5）', effect: { armyMorale: -10, morale: -5 } }
    ]
  },
  // ===== V21.0 新增历史事件（5个，唐初开疆拓土）=====
  // 唐灭东突厥（630）：李靖夜袭阴山，颉利可汗被擒
  {
    id: 'v21_tang_mie_tujue', name: '唐灭东突厥', illustration: 'cavalry_charge',
    minTurn: 80, factions: ['xiwei'],
    description: '唐贞观四年（630），太宗以李靖为定襄道行军总管，统李勣、薛万均等，十余万众，分道击突厥。靖乘雾而行，去牙帐七里，虏始觉。颉利乘千里马先走，靖纵兵纵击，斩首万余级，获男女十余万。颉利往依沙钵罗，为西道总管张宝相所禽，送京师。于是斥地自阴山北至大漠。太宗御顺天城楼，颉利可汗俘献。四夷君长请上尊号为天可汗。',
    options: [
      { text: '犁庭扫穴，威加北荒（自动大战，金+3000，民心+12）', effect: { massBattle: true, money: 3000, morale: 12 } },
      { text: '纳其降部，边吏绥怀（蛮族关系+15，民心+6）', effect: { barbarianRel: 15, morale: 6 } }
    ]
  },
  // 唐灭高昌（640）：侯君集讨麴智盛，置西州
  {
    id: 'v21_tang_mie_gaochang', name: '唐灭高昌', illustration: 'city_siege',
    minTurn: 90, factions: ['xiwei'],
    description: '唐贞观十四年（640），高昌王麴文泰遏绝西域朝贡，太宗以侯君集为交河道行军大总管，将兵讨之。文泰自恃漠远，不设备。及大军至碛口，文泰忧惧不知所为，发病死，子智盛立。君集进兵，填堑攻楼，飞石雨下，城中人皆室处。智盛穷蹙，面缚出降。乃下其郡三、县五、城二十二。以其地为西州，置安西都护府。唐之号令，西尽于西海。',
    options: [
      { text: '灭国置州，开地千里（自动大战，comm+10，金+2000）', effect: { massBattle: true, comm: 10, money: 2000 } },
      { text: '立其王，岁遣入贡（蛮族关系+10，comm+4）', effect: { barbarianRel: 10, comm: 4 } }
    ]
  },
  // 苏定方西平贺鲁（657）：西域十姓平，置昆陵濛池二都护
  {
    id: 'v21_su_dingfang_xiyu', name: '苏定方西平贺鲁', illustration: 'cavalry_charge',
    minTurn: 100, factions: ['xiwei'],
    description: '唐显庆二年（657），高宗遣苏定方为伊丽道行军大总管，讨西突厥沙钵罗可汗阿史那贺鲁。定方合回纥兵，至曳咥河西，贺鲁将十姓十万众来拒。定方以步兵据原，自将骑阵于原北。贼三犯步兵，不动。定方乘其阵乱，纵骑击之，贼大溃，追奔三十里。会天大风吹雪，定方冒雪兼行，至双河，距贺牙二百里，鼓行而西。贺鲁方将出猎，定方掩其不备，众遂溃。贺鲁走石国，石国执以降。西突厥十姓悉平。',
    options: [
      { text: '冒雪穷追，俘其可汗（自动大战，金+2500，comm+8）', effect: { massBattle: true, money: 2500, comm: 8 } },
      { text: '招其部众，裂地而封（蛮族关系+12，民心+4）', effect: { barbarianRel: 12, morale: 4 } }
    ]
  },
  // 白江口之战（663）：刘仁轨破倭援，焚其舟舰
  {
    id: 'v21_baijiang_kouchuan', name: '白江口破倭', illustration: 'city_siege',
    minTurn: 108, factions: ['xiwei'],
    description: '唐龙朔三年（663），百济福信引倭人兵，围刘仁轨于熊津。仁轨率舟师，遇倭人于白江口。四战皆捷，焚其舟四百艘，烟焰灼天，海水尽赤。倭人大败，百济残众皆溃。于是高丽益孤。仁轨遂留镇百济，经略海东。自唐之威，东渐于海。',
    options: [
      { text: '火攻破倭，扬威海东（自动大战，金+2000，军心+10）', effect: { massBattle: true, money: 2000, armyMorale: 10 } },
      { text: '乘胜抚定，绥新罗（民心+6，comm+4）', effect: { morale: 6, comm: 4 } }
    ]
  },
  // 唐灭高丽（668）：李勣拔平壤，置安东都护府
  {
    id: 'v21_tang_mie_gaoli', name: '唐灭高丽', illustration: 'city_siege',
    minTurn: 115, factions: ['xiwei'],
    description: '唐总章元年（668），司空李勣为辽东道行军大总管，统诸道兵，数道俱进。官军拔新城，十六城皆降。进至鸭绿水，高丽遣莫离支男生以兵五万来拒，击破之，追奔二百余里。遂围平壤。二月，勣破其城，执高丽王藏，执莫离支男建等。凡拔城一百七十，户六十九万。以其地为安东都护府，统之。唐之东土，至是极焉。',
    options: [
      { text: '毕数世之烈，混一辽东（自动大战，金+3500，文化+12）', effect: { massBattle: true, money: 3500, culture: 12 } },
      { text: '抚其遗黎，置官戍守（民心+10，comm+6）', effect: { morale: 10, comm: 6 } }
    ]
  },
  // ===== V22.0 安史之乱五历史事件 =====
  // 范阳起兵（755）：安禄山反于范阳，河北尽陷
  {
    id: 'v22_fanyang_qibing', name: '范阳起兵', illustration: 'barbarian_invasion',
    minTurn: 120, factions: ['xiwei'],
    description: '唐天宝十四载（755）冬十一月，安禄山矫称奉恩命，以兵讨杨国忠，发所部兵及同罗、奚、室韦十五万，反于范阳。步骑精锐，烟尘千里，所过州县，望风瓦解。河北尽没，东都、西京相继陷。玄宗幸蜀，肃宗即位于灵武。唐室几于再造。',
    options: [
      { text: '下诏亲征，布告天下（自动大战，军心+10，民心-8）', effect: { massBattle: true, armyMorale: 10, morale: -8 } },
      { text: '遣使宣慰，冀其悔祸（comm-10，民心-6）', effect: { comm: -10, morale: -6 } }
    ]
  },
  // 灵宝潼关之战（756）：哥舒翰恸哭出关，大败，关陷
  {
    id: 'v22_lingbao_tongguan', name: '灵宝潼关失守', illustration: 'city_siege',
    minTurn: 124, factions: ['xiwei'],
    description: '唐至德元载（756），安禄山陷东都。哥舒翰守潼关，固关不战。杨国忠疑翰谋己，促帝使翰出关。翰不得已，抚膺恸哭，引兵出关。遇贼崔乾祐于灵宝西原。贼乘高下木石，击杀甚众。翰以毡车驾马为前驱，贼纵火焚之，官军大败，二十万唯存八千。关遂陷，翰为麾下执送洛阳。自是长安不守。',
    options: [
      { text: '退守关中，图后举（自动大战，兵-5000，金-1500）', effect: { massBattle: true, armyLoss: 5000, money: -1500 } },
      { text: '婴城死战，与关俱碎（兵-8000，军心+5）', effect: { armyLoss: 8000, armyMorale: 5 } }
    ]
  },
  // 马嵬之变（756）：将士诛杨国忠，贵妃缢死
  {
    id: 'v22_mawei_zhibian', name: '马嵬之变', illustration: 'drought',
    minTurn: 126, factions: ['xiwei'],
    description: '唐至德元载（756），玄宗避贼幸蜀，至马嵬。将士饥疲，皆愤怒。龙武大将军陈玄礼以天下祸乱，皆由杨国忠，欲诛之。会吐蕃使者遮国忠，军士大呼：国忠与胡虏谋反！追杀国忠，屠割。上命高力士引贵妃于佛堂，缢杀之。军士乃呼万岁。自是太子分兵北趋灵武，即位，是为肃宗。',
    options: [
      { text: '从军心，诛杨国忠（军心+12，民心-6）', effect: { armyMorale: 12, morale: -6 } },
      { text: '护贵妃，慰将士（军心-10，民心+4）', effect: { armyMorale: -10, morale: 4 } }
    ]
  },
  // 睢阳保卫战（757）：张巡、许远以孤城障蔽江淮
  {
    id: 'v22_suiyang_baowei', name: '睢阳保卫战', illustration: 'city_siege',
    minTurn: 130, factions: ['xiwei'],
    description: '唐至德二载（757），尹子奇围睢阳。张巡、许远以残卒数千，拒贼十三万。巡尝出师，贼众大合，巡鸣鼓卧鼓，贼不测。城中粮尽，士皆饿得无人色，而莫有叛心。巡每战，必身先士卒，故能以少制众，凡大小四百余战，杀贼十二万。城卒陷，巡与南霁云等皆死。然江淮赖以完，唐之赋饷，赖以济师。',
    options: [
      { text: '死守江淮屏障（自动大战，民心+12，兵-3000）', effect: { massBattle: true, morale: 12, armyLoss: 3000 } },
      { text: '弃城东走，以图再举（comm-8，民心+2）', effect: { comm: -8, morale: 2 } }
    ]
  },
  // 收复两京（757）：郭子仪借回纥兵，克复长安、洛阳
  {
    id: 'v22_shoufu_liangjing', name: '收复两京', illustration: 'cavalry_charge',
    minTurn: 134, factions: ['xiwei'],
    description: '唐至德二载（757），广平王俶为天下兵马元帅，郭子仪副之，率朔方、安西及回纥、西域之众十五万，发凤翔。初战于长安西，贼众大败，追奔十万。遂收西京。贼严庄弃陕郡走东都。官军乘胜东进，回纥又自南山出，夹击破之。庆绪弃洛阳，渡河走保相州。于是两京皆复。天子还长安，父老出迎，皆泣曰：不图今日复见官军！',
    options: [
      { text: '克复两京，再造唐室（自动大战，金+3000，民心+15，文化+8）', effect: { massBattle: true, money: 3000, morale: 15, culture: 8 } },
      { text: '招抚残余，休养生息（民心+10，comm+6）', effect: { morale: 10, comm: 6 } }
    ]
  },
  // ===== V23.0 中唐削藩五历史事件 =====
  // 泾原兵变（783）：泾原兵在长安作乱，奉朱泚，德宗幸奉天
  {
    id: 'v23_jingyuan_bian', name: '泾原兵变', illustration: 'rebellion',
    minTurn: 140, factions: ['xiwei'],
    description: '唐建中四年（783），泾原节度使姚令言将兵赴关东，过京师。军士冒雨，寒甚，多携子弟来，冀得厚赐遗其家，既至，一无所赐。至浐水，诏京兆尹王翃犒师，惟粝食菜啖。众怒，蹴翻食具，扬言曰：吾辈将死于敌，而食且不饱！遂作乱，鼓噪而入。帝与诸王、公主走幸奉天。泾原兵遂迎朱泚，泚僭号，据长安。',
    options: [
      { text: '仓促出幸，下诏罪己（自动大战，兵-3000，民心-8）', effect: { massBattle: true, armyLoss: 3000, morale: -8 } },
      { text: '闭城拒乱，厚赐以安军心（金-2000，comm-6）', effect: { money: -2000, comm: -6 } }
    ]
  },
  // 李晟复长安（784）：李晟孤军收京城，迎德宗还京
  {
    id: 'v23_lisheng_fuchangan', name: '李晟复长安', illustration: 'cavalry_charge',
    minTurn: 144, factions: ['xiwei'],
    description: '唐兴元元年（784），朱泚据长安，德宗在奉天。李晟时为神策将，孤军力战，以忠义感激将士。晟乃约将士，期以明旦进讨。自光泰门入，贼大败。泚狼狈走，其将斩首来降。晟入长安，号令诸军：长安士庶，久陷贼庭，若有惊扰，非伐罪吊人之义。百姓安堵，秋毫不犯。帝还长安，曰：天生晟，为社稷万人，岂独朕哉！',
    options: [
      { text: '孤军克复京师（自动大战，金+2500，民心+15，文化+6）', effect: { massBattle: true, money: 2500, morale: 15, culture: 6 } },
      { text: '招抚余孽，休兵息民（民心+10，comm+5）', effect: { morale: 10, comm: 5 } }
    ]
  },
  // 雪夜入蔡州（817）：李愬雪夜奇袭，擒吴元济
  {
    id: 'v23_xueye_rucaizhou', name: '雪夜入蔡州', illustration: 'city_siege',
    minTurn: 148, factions: ['xiwei'],
    description: '唐元和十二年（817），李愬为唐邓节度使，谋袭蔡州。初，愬擒贼将李祐，释而用之。祐言于愬：蔡之精兵，皆在洄曲及四境，守州城者皆羸老。可以乘虚直抵城下。愬然之。乃以李祐为前锋，李进诚继之。会大雨雪，旌旗裂，人马冻死者相望。夜半，雪益甚，行七十里，至蔡州城下。城旁有鹅鸭池，愬令击之，以混军声。四鼓，愬至城下，无一人知者。元济尚寝，官军登城，开门纳军。元济乃闻官军号令，始帅左右登牙城拒战。愬梯而登，降其众，元济乃降。',
    options: [
      { text: '用奇雪夜擒元济（自动大战，金+2000，民心+12，comm+6）', effect: { massBattle: true, money: 2000, morale: 12, comm: 6 } },
      { text: '天寒道阻，缓师（comm-5，军心-3）', effect: { comm: -5, armyMorale: -3 } }
    ]
  },
  // 宪宗平淮西（818）：吴元济既擒，申、光二州降，淮西平
  {
    id: 'v23_ping_huaixi', name: '宪宗平淮西', illustration: 'cavalry_charge',
    minTurn: 150, factions: ['xiwei'],
    description: '唐元和十三年（818），吴元济既擒，送京师，斩于独柳。申、光二州闻元济败，皆降。淮西自李忠臣以来，割据五十余年，至是，复为王土。先是，诸军讨淮西四年，馈运疲弊，帝以裴度为彰义节度使，彰义军，遂平淮西。河北藩镇闻之，皆惧，田弘正请以魏博六州听朝廷。唐室中兴，号为元和。',
    options: [
      { text: '淮西平，诸镇皆惧（自动大战，金+3000，民心+15，comm+10）', effect: { massBattle: true, money: 3000, morale: 15, comm: 10 } },
      { text: '恩宥降卒，安淮西（民心+10，comm+6）', effect: { morale: 10, comm: 6 } }
    ]
  },
  // 平淄青李师道（819）：淄青平，镇、冀、沧、景皆归朝
  {
    id: 'v23_ping_ziqing', name: '平淄青', illustration: 'cavalry_charge',
    minTurn: 153, factions: ['xiwei'],
    description: '唐元和十四年（819），平卢淄青节度使李师道叛。帝命田弘正、宣武等诸道兵讨之。师道昏懦，政事皆决于左右。其将刘悟，乃召军中大言曰：司徒何罪！而欲屠之！且天子所诛者，司徒一人耳。曹濮之众，皆为贼驱。今日当与公等斩反者，取富贵。遂勒兵趣郓州，至牙城，擒师道，斩之。淄青十二州皆平。自广德以来，垂六十年，藩镇跋扈，河南北三十余州，自除官吏，不贡赋，至是，尽遵朝廷约束。',
    options: [
      { text: '淄青平，藩镇皆服（自动大战，金+3500，民心+18，comm+12）', effect: { massBattle: true, money: 3500, morale: 18, comm: 12 } },
      { text: '宥其将，分镇淄青（民心+10，comm+8）', effect: { morale: 10, comm: 8 } }
    ]
  },
  // ===== V24.0 唐末五代五历史事件 =====
  // 黄巢入长安（880）：黄巢陷潼关，入长安，称大齐
  {
    id: 'v24_huangchao_changan', name: '黄巢入长安', illustration: 'rebellion',
    minTurn: 330, factions: ['xiwei'],
    description: '唐广明元年（880），黄巢自采石渡江，众号六十万。十一月，陷东都。十二月，破潼关。唐僖宗仓幸自开远门出，幸兴元。巢乘金装肩舆，其徒皆被发约以红缯，执兵以从，甲骑如流，辎重塞涂。入长安，百姓夹道聚观。尚让宣言于众曰：黄王起兵，本为百姓，非如李氏不爱汝曹。乃府库，以班贫民。巢即皇帝位，含元殿，国号大齐。后三年，李克用破巢，巢走死狼虎谷。',
    options: [
      { text: '天子幸蜀，下诏讨贼（自动大战，兵-3000，民心-10）', effect: { massBattle: true, armyLoss: 3000, morale: -10 } },
      { text: '募沙陀，共复京师（金-2000，comm+6，蛮族关系+8）', effect: { money: -2000, comm: 6, barbarianRel: 8 } }
    ]
  },
  // 上源驿之变（884）：朱温图李克用，梁晋构怨
  {
    id: 'v24_shangyuan_zhiyi', name: '上源驿之变', illustration: 'rebellion',
    minTurn: 334, factions: ['xiwei'],
    description: '唐中和四年（884），黄巢既平，李克用追贼还，过汴州。朱温邀入城，馆于上源驿，置酒。克用酒酣，语颇侵温。温怒，是夜，伏兵起，围驿。会大雨震电，克用因霹雳，逾垣得出，独缒而免。监军陈景思、大将史敬思已下，皆死。克用至营，欲引兵攻温。其妻刘氏劝止之，乃上诉于朝。唐僖宗和解之。然梁晋之怨，自此始，兵争者垂四十年。',
    options: [
      { text: '克用上诉，天子和解（comm-6，蛮族关系+5）', effect: { comm: -6, barbarianRel: 5 } },
      { text: '克用举兵攻汴，誓报怨（自动大战，兵-2500，金-1500）', effect: { massBattle: true, armyLoss: 2500, money: -1500 } }
    ]
  },
  // 白马驿之祸（905）：朱温杀朝士，投尸黄河
  {
    id: 'v24_baimayi_zhihuo', name: '白马驿之祸', illustration: 'drought',
    minTurn: 355, factions: ['xiwei'],
    description: '唐天祐二年（905），朱温已杀昭宗，立哀帝。柳逢素不齿于士大夫，乃言于温曰：此辈常自谓清流，宜投之黄河，使为浊流。温笑而从之。于是裴枢、独孤损、崔远、陆扆等，朝士三十余人，皆聚于滑州白马驿，尽杀之，投尸于河。唐之搢绅，于是尽矣。温自为相国，总百揆，封魏王，加九锡。唐之神器，已移于梁。',
    options: [
      { text: '从邪说，尽杀朝士（文化-18，民心-12，comm+6）', effect: { culture: -18, morale: -12, comm: 6 } },
      { text: '不听，保全缙绅（文化+8，民心+6）', effect: { culture: 8, morale: 6 } }
    ]
  },
  // 朱温代唐（907）：朱温受禅，国号梁，唐亡
  {
    id: 'v24_zhuwen_daitang', name: '朱温代唐', illustration: 'drought',
    minTurn: 362, factions: ['xiwei'],
    description: '唐天祐四年（907），唐哀帝禅位于梁王朱温。温更名晃，即皇帝位，国号大梁，都大梁。奉哀帝为济阴王，明年杀之。唐自武德至是，二百八十八年而亡。是时，李克用据河东，仍称唐天祐；王建称帝成都，国号蜀；杨渥据淮南；钱镠称吴越王；马殷称楚王；王审知称闽王；刘隐据岭南。天下分裂，五代十国之局，自此始。',
    options: [
      { text: '受唐禅，即皇帝位（comm+12，民心-18，文化-10）', effect: { comm: 12, morale: -18, culture: -10 } },
      { text: '仍奉唐正朔，不奉梁（comm-5，蛮族关系+6）', effect: { comm: -5, barbarianRel: 6 } }
    ]
  },
  // 李存勖灭梁（923）：后唐庄宗灭后梁，复唐
  {
    id: 'v24_cunxu_mieliang', name: '李存勖灭梁', illustration: 'cavalry_charge',
    minTurn: 373, factions: ['xiwei'],
    description: '后梁龙德三年（923），晋王李存勖魏州即皇帝位，国号唐，是为庄宗。梁末帝在汴，遣段凝率兵拒河上。庄宗用郭崇韬之策，自杨刘渡河，长驱趋汴。梁军无备，末帝登建国楼，召群臣，皆散。末帝建国楼之，召皇甫麟使杀己。麟亦自刃。唐兵入汴，梁亡。自朱温篡唐，凡十七年。庄宗定都洛阳，仍称唐。时人谓之：朱三算甚麽，养子却来填！然庄宗既得志，遽宠伶人，不四年，而贝州军乱，死于流矢。',
    options: [
      { text: '长驱入汴，遂灭梁（自动大战，金+3000，民心+15，comm+10）', effect: { massBattle: true, money: 3000, morale: 15, comm: 10 } },
      { text: '受梁降，赦其君臣（民心+8，comm+6）', effect: { morale: 8, comm: 6 } }
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
  },

  // ============================================================
  // V17.0 新增战役关卡（5个，v17_ 前缀，6→10）
  // ============================================================

  // ---- 战役6：邙山大战（543年）—— 高欢vs宇文泰 ----
  {
    id: 'v17_mangshan_dazhan',
    name: '邙山大战',
    description: '东魏武定元年（543），高仲密以虎牢降西魏。宇文泰率诸军东出，围河桥南城。高欢将十万众自蒲坂济，据邙山为阵，不进者数日。泰留辎重于瀍曲，夜衔枚袭欢。欢将彭乐以数千骑潜自河北驰趣之，大破泰，擒西魏临洮王森等。明日合战，泰中军、右军大破欢，欢坐骑中流矢，殆为西魏所执。既而欢阵复振，泰军不利，乃夜引还。欢追之，杀俘三万。邙山之役，为东西魏决战之最大者。',
    year: 543,
    illustration: 'v17_mangshan_dazhan',
    objective: '在 15 回合内于邙山击溃宇文泰主力（歼敌 8 万）。',
    defeatCondition: '高欢主力被击溃（我方损失超过 70%），或洛阳被西魏攻陷。',
    startingState: {
      troops: 28000,
      money: 3500,
      food: 5000,
      generals: ['gao_huan', 'v13_peng_le', 'hu_luguang', 'murong_shaozong']
    },
    reward: { money: 5000, food: 7000 },
    mapSetup: [
      { id: 'mangshan',   owner: 'player', garrison: 12000, isBase: true,  name: '邙山（高欢主力）' },
      { id: 'luoyang',     owner: 'player', garrison: 6000,  name: '洛阳（东魏重镇）' },
      { id: 'hutuo',       owner: 'enemy',  garrison: 18000, isObjective: true, name: '虎牢（宇文泰大军）' },
      { id: 'puban',       owner: 'enemy',  garrison: 5000,  name: '蒲坂（西魏后路）' }
    ]
  },
  // ---- 战役7：玉壁鏖战（546年）—— 韦孝宽守城 ----
  {
    id: 'v17_ybi_aozhan',
    name: '玉壁鏖战',
    description: '西魏大统十二年（546），高欢悉山东之众，顿于玉壁，志在必取。韦孝宽守御备至，城外尽攻凿之术，城中尽御备之方。欢于城南起土山，欲乘以入；孝宽接为两楼，使相敌。欢又于城北凿十道，潜地道；孝宽掘长堑邀之，外焚其柱，穿陷者皆死。又攻以冲车，孝宽以布幔随向张之，车不能坏。欢攻围六旬，死者什四五，智力俱困，因而发疾，明年正月殂于晋阳。',
    year: 546,
    illustration: 'v17_ybi_aozhan',
    objective: '在玉壁坚守 35 回合，使高欢攻城失败并粮尽退兵。',
    defeatCondition: '玉壁城被攻破，或韦孝宽战死。',
    startingState: {
      troops: 7000,
      money: 1200,
      food: 2500,
      generals: ['wei_xiaokuan', 'wang_pi']
    },
    reward: { money: 3000, food: 4500 },
    mapSetup: [
      { id: 'ybi2',        owner: 'player', garrison: 7000, isBase: true, isObjective: true, name: '玉壁城（韦孝宽坚守）' },
      { id: 'jinyang2',    owner: 'enemy',  garrison: 30000, name: '晋阳方向（高欢倾国之众）' },
      { id: 'puban2',      owner: 'player', garrison: 2500,  name: '蒲坂（西魏后援）' }
    ]
  },
  // ---- 战役8：江陵陷落（554年）—— 西魏破江陵 ----
  {
    id: 'v17_jiangling_xianluo',
    name: '江陵陷落',
    description: '西魏恭帝元年（554），梁元帝萧绎都江陵，外称臣于魏，而密与齐通，辞不逊。周太祖怒，命于谨、宇文护、杨忠率步骑五万南伐。谨至, 先遣宇文护、杨忠率精骑先据江津，断其东路。梁主出战，大败。魏兵傅城为长围，中外信命遂绝。或劝梁主降，梁主曰："朕，梁之天子，安能降！"乃入东阁行。城陷，为萧詧以土囊陨之。魏人尽俘百官士庶，还长安。',
    year: 554,
    illustration: 'v17_jiangling_xianluo',
    objective: '在 20 回合内攻克江陵，俘获梁元帝。',
    defeatCondition: '于谨主力被歼灭，或江陵久攻不下（food < 0）。',
    startingState: {
      troops: 16000,
      money: 2000,
      food: 3500,
      generals: ['yuwen_hu', 'yang_zhong', 'yuwen_xian']
    },
    reward: { money: 4000, food: 6000 },
    mapSetup: [
      { id: 'jiangling2',  owner: 'enemy',  garrison: 10000, isBase: false, isObjective: true, name: '江陵（梁元帝都城）' },
      { id: 'xiangyang',   owner: 'player', garrison: 5000,  isBase: true,  name: '襄阳（于谨出师）' },
      { id: 'xinye',       owner: 'player', garrison: 3000,  name: '新野（后路）' },
      { id: 'jiankang2',   owner: 'enemy',  garrison: 6000,  name: '建康（王僧辩援军方向）' }
    ]
  },
  // ---- 战役9：淮南北伐（573年）—— 吴明彻北伐 ----
  {
    id: 'v17_huainan_beifa',
    name: '淮南北伐',
    description: '陈太建五年（573），宣帝议北伐，公卿互有异同，唯吴明彻决策请行。乃以明彻为都督征讨诸军事，统十万众北伐。明彻发自京师，军至秦州，败齐师于栅口，遂克秦州。进克仁州，又克合肥，戍望风降下。进至寿阳，齐遣皮景和、王延贵率大军数十万来救。明彻乘其未合，急攻之，克寿阳，擒王琳。景和等退保淮北，淮南悉平。',
    year: 573,
    illustration: 'v17_huainan_beifa',
    objective: '在 20 回合内攻克寿阳，尽复淮南之地。',
    defeatCondition: '吴明彻主力被歼灭，或广陵失陷。',
    startingState: {
      troops: 18000,
      money: 2500,
      food: 4000,
      generals: ['wu_mingche', 'xiao_mohe', 'ren_zhong']
    },
    reward: { money: 4500, food: 6500 },
    mapSetup: [
      { id: 'jiankang3',   owner: 'player', garrison: 5000,  isBase: true,  name: '建康（陈出师）' },
      { id: 'guangling2',  owner: 'player', garrison: 4000,  name: '广陵（淮南江北重镇）' },
      { id: 'shouyang2',   owner: 'enemy',  garrison: 9000,  isObjective: true, name: '寿阳（淮南要冲）' },
      { id: 'qiaojun2',    owner: 'enemy',  garrison: 6000,  name: '谯郡（北齐援军方向）' }
    ]
  },
  // ---- 战役10：晋阳之战（576年）—— 北周灭齐 ----
  {
    id: 'v17_jinyang_zhizhan',
    name: '晋阳之战',
    description: '北周建德五年（576），周武帝宇文邕亲率六军东伐，以越王盛、齐王宪为右军，梁士彦为晋州刺史。晋州初下，齐后主方与冯淑妃猎于天池，晋州告急。齐主将还，淑妃请更杀一围，遂从之。既而周武帝还长安，留梁士彦守晋州。齐主自将围晋州，土山地道，昼夜攻之。帝复率诸军八万赴救，齐师大溃，齐主单骑走。明年，周师逼邺，齐主传位太子，后皆被执。齐亡。',
    year: 576,
    illustration: 'v17_jinyang_zhizhan',
    objective: '在 25 回合内攻克晋阳与邺城，灭亡北齐。',
    defeatCondition: '周武帝主力被歼灭，或晋州失守。',
    startingState: {
      troops: 30000,
      money: 4000,
      food: 7000,
      generals: ['yuwen_yong', 'yuwen_xian', 'li_mu', 'wang_qian']
    },
    reward: { money: 7000, food: 12000, generalId: 'gao_wei' },
    mapSetup: [
      { id: 'changan2',   owner: 'player', garrison: 6000,  isBase: true,  name: '长安（周武帝出师）' },
      { id: 'jinzhou',    owner: 'player', garrison: 5000,  name: '晋州（梁士彦镇守）' },
      { id: 'jinyang3',   owner: 'enemy',  garrison: 12000, isObjective: true, name: '晋阳（高氏根本）' },
      { id: 'yecheng2',   owner: 'enemy',  garrison: 10000, name: '邺城（北齐都城）' }
    ]
  },

  // ---- 战役11：玉壁攻城（546年）—— 高欢攻玉壁 ----
  {
    id: 'v18_yubi_gongcheng',
    name: '玉壁攻城',
    description: '东魏武定四年（546）十月，神武高欢倾山东之众十余万，自晋阳赴攻西魏玉壁。西魏王思政初筑玉壁，韦孝宽代守。高欢连营数十里，至于城下。城南起土山，欲乘之入；孝宽接木楼，使高于山。欢又凿十道、攻冲车、绷绳、烧柱，孝宽随机御之。城外尽攻凿之术，城中尽御备之方。攻守五十余日，士卒死者七万人，欢智力俱困，因而发疾。十一月，解围去，明年正月，薨于晋阳。',
    year: 546,
    illustration: 'v18_yubi_gongcheng',
    objective: '作为攻城方，在 30 回合内攻破玉壁城（韦孝宽）。',
    defeatCondition: '攻城大军损失超过 70%，或高欢发病退兵。',
    startingState: {
      troops: 30000,
      money: 4000,
      food: 7000,
      generals: ['gao_huan', 'dai_zongxian', 'hulü_guang']
    },
    reward: { money: 5000, food: 8000 },
    mapSetup: [
      { id: 'jinyang',     owner: 'player', garrison: 10000, isBase: true,  name: '晋阳（高欢出师）' },
      { id: 'yubi',        owner: 'enemy',  garrison: 10000, isObjective: true, name: '玉壁城（韦孝宽坚守）' },
      { id: 'puban',       owner: 'enemy',  garrison: 4000,  name: '蒲坂（西魏后援）' }
    ]
  },
  // ---- 战役12：邙山追击（543年）—— 高欢追击宇文泰 ----
  {
    id: 'v18_mangshan_zhuiji',
    name: '邙山追击',
    description: '东魏武定元年（543），高慎以虎牢降西魏。宇文泰率诸军东出至洛阳，围河桥南城。高欢率十万众渡河，据邙山为阵。泰夜欲袭欢，欢侦知，伏兵以待。合战，泰军大败，失步卒三万。欢将彭乐追泰，泰窘，谓乐曰：汝非彭乐耶？痴男子！今日无我，明日岂有汝耶？何不急还营收汝金宝。乐遂还。明日复战，泰不利，遂入关。邙山之役，东西盛衰之机也。',
    year: 543,
    illustration: 'v18_mangshan_zhuiji',
    objective: '在邙山以南 15 回合内击溃宇文泰主力（歼敌 3 万）。',
    defeatCondition: '高欢主力被击溃，或彭乐纵敌使宇文泰脱归关中。',
    startingState: {
      troops: 25000,
      money: 3000,
      food: 6000,
      generals: ['gao_huan', 'peng_le', 'hulü_guang']
    },
    reward: { money: 4500, food: 7000 },
    mapSetup: [
      { id: 'mangshan',    owner: 'player', garrison: 8000,  isBase: true,  name: '邙山（高欢阵）' },
      { id: 'luoyang',     owner: 'enemy',  garrison: 6000,  name: '洛阳（宇文泰前军）' },
      { id: 'hengnong',    owner: 'enemy',  garrison: 15000, isObjective: true, name: '弘农（宇文泰主力）' },
      { id: 'tongguan',    owner: 'enemy',  garrison: 3000,  name: '潼关（泰退路）' }
    ]
  },
  // ---- 战役13：隋军渡江（588年）—— 韩擒虎贺若弼渡江 ----
  {
    id: 'v18_suijun_dujiang',
    name: '隋军渡江',
    description: '隋开皇八年（588）冬，文帝以晋王广为元帅，众总管咸受节度，大举伐陈。清河公杨素出永安，秦王俊出襄阳，庐州总管韩擒虎出庐江，吴州总管贺若弼出广陵。弼以老马买陈船，藏之；又每防人代，必于广陵大列旗帜，营幕若山，陈人初谓隋兵大至，后习之，不复设备。开皇九年正月朔，弼自广陵济江，擒虎自横江济采石，陈人弗之觉。弼遂拔京口，擒虎入姑孰，合军直趣建康。',
    year: 588,
    illustration: 'v18_suijun_dujiang',
    objective: '分兵渡江，在 20 回合内攻克建康，俘获陈叔宝。',
    defeatCondition: '渡江主力被全歼，或长江防线被陈军逆击破。',
    startingState: {
      troops: 28000,
      money: 4000,
      food: 7000,
      generals: ['v15_lai_huer', 'he_ruobi', 'han_qinhu']
    },
    reward: { money: 5000, food: 9000, generalId: 'chen_shubao' },
    mapSetup: [
      { id: 'guangling',   owner: 'player', garrison: 8000,  isBase: true,  name: '广陵（贺若弼渡江处）' },
      { id: 'caishiji',    owner: 'enemy',  garrison: 4000,  name: '采石（韩擒虎渡江处）' },
      { id: 'jingkou',     owner: 'player', garrison: 4000,  name: '京口（渡江后据点）' },
      { id: 'jiankang',    owner: 'enemy',  garrison: 12000, isObjective: true, name: '建康（陈叔宝都城）' }
    ]
  },
  // ---- 战役14：漠北远征（630年）—— 李靖灭东突厥 ----
  {
    id: 'v18_mobei_yuanzheng',
    name: '漠北远征',
    description: '唐贞观三年（629）冬，太宗以突厥频岁为边患，命并州都督李勣为通汉道行军总管，兵部尚书李靖为定襄道行军总管，合六总管十余万众，皆受靖节度，分道出击突厥。四年正月，靖率骁骑三千自马邑出恶阳岭，夜袭定襄，颉利不意唐兵猝至，大惊。勣出云中，大破突厥于白道。靖又选精骑一万，赍二十日粮，自白道袭之，颉利走保铁山，靖纵兵蹑之，遂灭其国，俘颉利可汗至长安。',
    year: 630,
    illustration: 'v18_mobei_yuanzheng',
    objective: '出塞远征，在 25 回合内击破颉利可汗王庭，俘获之。',
    defeatCondition: '远征大军在漠北因补给断绝而溃散。',
    startingState: {
      troops: 20000,
      money: 3500,
      food: 8000,
      generals: ['v17_li_jing', 'v17_xu_shiji', 'v18_qu_tutong']
    },
    reward: { money: 6000, food: 10000 },
    mapSetup: [
      { id: 'mayi',        owner: 'player', garrison: 6000,  isBase: true,  name: '马邑（李靖出塞处）' },
      { id: 'dingxiang',   owner: 'enemy',  garrison: 5000,  name: '定襄（突厥南牙）' },
      { id: 'v18_tingzhou', owner: 'enemy', garrison: 4000,  name: '庭州方向（漠北）' },
      { id: 'tieli_shan',  owner: 'enemy',  garrison: 12000, isObjective: true, name: '铁山（颉利可汗王庭）' }
    ]
  },
  // ---- 战役15：虎牢之战（621年）—— 李世民破窦建德 ----
  {
    id: 'v18_hulao_zizhan',
    name: '虎牢之战',
    description: '唐武德四年（621），太宗秦王李世民围王世充于洛阳。夏王窦建德率众十余万，自荥阳西上，救王世充。太宗分兵围洛阳，自率骁骑三千五百，东据虎牢以拒之。建德屯军汜水，数战不利。太宗伺其饥惰，命宇文士及将三百骑诱之，亲率轻骑，东西汜水而上，直薄其阵。建德阵久，士皆饥疲，遂大溃，追奔三十里，俘五万余人，建德被槊走，追获之。遂降世充。河南河北悉平。',
    year: 621,
    illustration: 'v18_hulao_zizhan',
    objective: '据虎牢天险，在 15 回合内击溃窦建德援军，迫降王世充。',
    defeatCondition: '虎牢失守，或洛阳围师被内外夹击歼灭。',
    startingState: {
      troops: 15000,
      money: 3000,
      food: 5000,
      generals: ['v17_xu_shiji', 'v17_qin_shubao', 'v17_cheng_yaojin']
    },
    reward: { money: 7000, food: 12000 },
    mapSetup: [
      { id: 'hulao',       owner: 'player', garrison: 8000,  isBase: true,  isObjective: true, name: '虎牢关（李世民据险）' },
      { id: 'luoyang',     owner: 'player', garrison: 4000,  name: '洛阳（围王世充）' },
      { id: 'fanshui',     owner: 'enemy',  garrison: 15000, isObjective: true, name: '汜水（窦建德大军）' }
    ]
  },

  // ============================================================
  // V19.0 新增战役关卡（5个，v19_ 前缀，15→20）
  // ============================================================

  // ---- 战役16：浅水原之战（618年）—— 李世民破薛仁杲 ----
  {
    id: 'v19_qianshuiyuan',
    name: '浅水原之战',
    description: '唐武德元年（618），薛举寇泾州，秦王世民拒之。会世民有疾，卧阁中，诸将为举所败。举死，子仁杲立，居于折墌城。世民复总统诸军，曰：彼胜而骄，宜坚壁以老之。相持六十余日，仁杲粮尽，将多叛。世民度其可击，遣庞玉阵于浅水原南以诱之。大军自原北出其不意，仁杲大溃。世民率骑追之，遂围折墌。仁杲计穷，出城降。陇西悉平。',
    year: 618,
    illustration: 'v19_qianshuiyuan',
    objective: '坚壁相持，在 25 回合内击破薛仁杲主力，攻克折墌城。',
    defeatCondition: '唐军主力被击溃，或长安受到威胁。',
    startingState: {
      troops: 18000,
      money: 2500,
      food: 4500,
      generals: ['v17_xu_shiji', 'v18_qu_tutong', 'v19_chai_shao']
    },
    reward: { money: 5000, food: 8000 },
    mapSetup: [
      { id: 'qianyang',     owner: 'player', garrison: 6000,  isBase: true,  name: '泾州（唐军基地）' },
      { id: 'qianshui_yuan', owner: 'enemy', garrison: 5000,  name: '浅水原（薛仁杲前军）' },
      { id: 'zhezhi_cheng',  owner: 'enemy', garrison: 10000, isObjective: true, name: '折墌城（薛仁杲都城）' }
    ]
  },
  // ---- 战役17：晋阳保卫战（619年）—— 李世民破刘武周 ----
  {
    id: 'v19_jinyang_baowei',
    name: '晋阳保卫战',
    description: '唐武德二年（619），刘武周遣大将宋金刚寇并州，破齐王元吉，并州陷。武周据并州，金刚逼龙门。关中震动。唐高祖欲弃河东，世民曰：太原王业所基，国之根本，河东殷实，京邑所资，若弃之，臣窃可恨。愿假精兵三万，必望平殄武周。高祖乃发关中之兵以益之。世民率众自龙门乘冰坚渡河，屯柏壁，与宋金刚相持。坚壁不战，遣兵抄其粮道。金刚食尽而遁，世民追之，一昼夜行二百余里，战数十合，大破金刚。武周惧，奔突厥。并州遂平。',
    year: 619,
    illustration: 'v19_jinyang_baowei',
    objective: '在柏壁坚壁相持，在 30 回合内追击并击溃宋金刚主力，收复晋阳。',
    defeatCondition: '唐军主力被击溃，或蒲津关失守。',
    startingState: {
      troops: 22000,
      money: 3000,
      food: 5000,
      generals: ['v17_xu_shiji', 'v19_yuchi_jingde', 'v19_chai_shao']
    },
    reward: { money: 6000, food: 9000 },
    mapSetup: [
      { id: 'puban',        owner: 'player', garrison: 5000,  isBase: true,  name: '蒲坂（李世民渡河处）' },
      { id: 'baibi',        owner: 'player', garrison: 4000,  name: '柏壁（相持要地）' },
      { id: 'jinyang',      owner: 'enemy',  garrison: 8000,  name: '晋阳（刘武周据守）' },
      { id: 'songjingang',  owner: 'enemy',  garrison: 12000, isObjective: true, name: '宋金刚大营（刘武周主力）' }
    ]
  },
  // ---- 战役18：江陵平萧铣（621年）—— 李靖顺江而下 ----
  {
    id: 'v19_jingling_pingxiao',
    name: '江陵平萧铣',
    description: '唐武德四年（621），高祖命赵郡王李孝恭为荆湘道行军总管，李靖为行军长史，统十二总管，自夔州顺流东下。时秋水泛涨，萧铣以江路险绝，官军必不能进，不设备。孝恭、靖乘水涨，骤兵至夷陵，大破铣将文士弘，进逼江陵。铣仓猝征兵，皆未至，遂空城出战。铣兵大败，孝恭围其城。铣困迫，率群臣降。江陵平，南方州县皆望风归附。',
    year: 621,
    illustration: 'v19_jingling_pingxiao',
    objective: '顺江而下，在 20 回合内攻克江陵，俘获萧铣。',
    defeatCondition: '水军主力被歼灭，或李孝恭战死。',
    startingState: {
      troops: 20000,
      money: 3000,
      food: 5500,
      generals: ['v17_li_jing', 'v19_li_xiaogong', 'v19_chai_shao']
    },
    reward: { money: 5500, food: 9000 },
    mapSetup: [
      { id: 'kuizhou',      owner: 'player', garrison: 5000,  isBase: true,  name: '夔州（水军基地）' },
      { id: 'yingling',     owner: 'enemy',  garrison: 4000,  name: '夷陵（铣将文士弘）' },
      { id: 'jiangling',    owner: 'enemy',  garrison: 10000, isObjective: true, name: '江陵（萧铣都城）' }
    ]
  },
  // ---- 战役19：洺水破刘黑闼（622年）—— 李世民洺水之战 ----
  {
    id: 'v19_mingshui_pingheita',
    name: '洺水破刘黑闼',
    description: '唐武德五年（622），刘黑闼引突厥入寇，陷瀛州、贝州，山东州县多叛应之。太宗太宗讨之，屯于洺水。黑闼数挑战，太宗坚壁不战，以老其师。别遣奇兵绝其粮道。黑闼城中食尽，太宗度其必来决战，乃堰洺水上流，谓守吏曰：待我与贼战，乃可决水。既而黑闼率步骑二万南渡洺水，压唐营而阵。太宗亲率精骑，击其骑兵，破之，乘胜蹂其步卒。守吏乃决堰，水大至，深丈余。黑闼众大溃，斩首万余级，溺死数千人。黑闼与范愿等奔突厥。山东遂平。',
    year: 622,
    illustration: 'v19_mingshui_pingheita',
    objective: '堰洺水，在 20 回合内击溃刘黑闼主力。',
    defeatCondition: '唐军主力被击溃，或洺水防线被突破。',
    startingState: {
      troops: 18000,
      money: 2800,
      food: 5000,
      generals: ['v17_xu_shiji', 'v19_yuchi_jingde', 'v17_qin_shubao']
    },
    reward: { money: 6000, food: 10000 },
    mapSetup: [
      { id: 'luonan',       owner: 'player', garrison: 6000,  isBase: true,  name: '洺南（唐军大营）' },
      { id: 'ming_shui',   owner: 'player', garrison: 3000,  name: '洺水堰（决水之处）' },
      { id: 'mingzhou',     owner: 'enemy',  garrison: 6000,  name: '洺州（黑闼据守）' },
      { id: 'heita_daying', owner: 'enemy',  garrison: 12000, isObjective: true, name: '刘黑闼主力（决战之地）' }
    ]
  },
  // ---- 战役20：渡江灭辅公祏（624年）—— 李孝恭李靖讨丹阳 ----
  {
    id: 'v19_dujiang_miefu',
    name: '渡江灭辅公祏',
    description: '唐武德七年（624），辅公祏据丹阳反，称帝，国号宋。高祖命赵郡王李孝恭为元帅，李靖副之，李勣、黄君汉等七总管并受节度。孝恭自荆州趣江州，李靖趋宣州，李勣自淮南，三道俱进。公祏遣将冯惠亮屯博望山，陈正通屯青林山，以拒之。孝恭乃以奇兵断其粮道，惠亮等军饥，夜薄孝恭营，孝恭坚卧不动。明日，遣老弱挑战，引锐士阵以待。贼众追，伏兵发，大破之。惠亮等单遁。公祏惧，弃城东走，欲趋突厥。至句容，从兵能属者裁五百人。为野人所执，送丹阳，斩之。江南遂平。',
    year: 624,
    illustration: 'v19_dujiang_miefu',
    objective: '三道俱进，在 25 回合内攻克丹阳，俘获辅公祏。',
    defeatCondition: '渡江主力被歼灭，或李孝恭战死。',
    startingState: {
      troops: 22000,
      money: 3500,
      food: 6000,
      generals: ['v17_li_jing', 'v19_li_xiaogong', 'v17_xu_shiji']
    },
    reward: { money: 7000, food: 11000 },
    mapSetup: [
      { id: 'jiangling3',  owner: 'player', garrison: 5000,  isBase: true,  name: '江陵（李孝恭出师）' },
      { id: 'bo_wang_shan', owner: 'enemy', garrison: 6000,  name: '博望山（冯惠亮）' },
      { id: 'qinglin_shan', owner: 'enemy', garrison: 5000,  name: '青林山（陈正通）' },
      { id: 'jiankang4',   owner: 'enemy',  garrison: 10000, isObjective: true, name: '丹阳（辅公祏都城）' }
    ]
  },
  // ---- 战役21：晋阳起兵（617年）—— 李渊太原举义 ----
  {
    id: 'v20_jinyang_qibing',
    name: '晋阳起兵',
    description: '隋大业十三年（617），李渊为太原留守。次子世民与晋阳令刘文静、宫监裴寂定谋，阴结豪杰。既斩太原副留守王威、高君雅，乃开太原仓库以赈穷乏，传檄称义兵。西河郡不从，渊使建成、世民攻拔之。秋，渊自将甲士三万，西向关中。师次贾胡堡，雨久不得进。渊用世民之谋，促师而前，遂有入关之渐。',
    year: 617,
    illustration: 'v20_jinyang_qibing',
    objective: '自太原南下，在 20 回合内攻克长安，拥立代王。',
    defeatCondition: '义兵主力被歼灭，或太原老营被攻破。',
    startingState: {
      troops: 20000,
      money: 3000,
      food: 5000,
      generals: ['v20_li_yuan', 'v20_li_shimin', 'v20_liu_wenjing', 'v20_pei_ji']
    },
    reward: { money: 6000, food: 10000 },
    mapSetup: [
      { id: 'jinyang',     owner: 'player', garrison: 6000,  isBase: true,  name: '晋阳（义兵老营）' },
      { id: 'huoyi',       owner: 'enemy',  garrison: 5000,  name: '霍邑（宋老生拒守）' },
      { id: 'hedong',      owner: 'enemy',  garrison: 6000,  name: '河东（屈突通）' },
      { id: 'changan',     owner: 'enemy',  garrison: 9000,  isObjective: true, name: '长安（代王留守）' }
    ]
  },
  // ---- 战役22：霍邑破宋老生（617年）—— 李世民霍邑之战 ----
  {
    id: 'v20_huoyi_zhan',
    name: '霍邑破宋老生',
    description: '隋大业十三年（617），李渊义军西至贾胡堡。隋将宋老生守霍邑，有兵二万。会久雨，馈运不继，李渊欲还太原。世民切谏曰：本兴大义，当先入咸阳；今遇小敌，遽欲班师，徒散众耳。雨霁，渊以轻骑先趣霍邑。老生背城而阵。世民与建成自南原驰下，冲其阵后。老生兵溃，斩于城下。霍邑平，关中响震。',
    year: 617,
    illustration: 'v20_huoyi_zhan',
    objective: '击破宋老生，在 12 回合内攻克霍邑。',
    defeatCondition: '义军主力被击溃，或粮尽退军。',
    startingState: {
      troops: 15000,
      money: 2000,
      food: 3500,
      generals: ['v20_li_shimin', 'v20_li_yuan', 'v20_liu_wenjing']
    },
    reward: { money: 4500, food: 8000 },
    mapSetup: [
      { id: 'jiahu_bao',   owner: 'player', garrison: 5000,  isBase: true,  name: '贾胡堡（义军大营）' },
      { id: 'huoyi',       owner: 'enemy',  garrison: 8000,  isObjective: true, name: '霍邑（宋老生）' }
    ]
  },
  // ---- 战役23：邙山败李密（618年）—— 王世充邙山之战 ----
  {
    id: 'v20_mangshan_zhan',
    name: '邙山败李密',
    description: '唐武德元年（618），李密既破宇文化及，劲兵良马多死，未得善抚。王世充乘其弊，简精卒二万、骑二千，营于洛水，潜军夜出北山。密留王伯当守金墉，自将精兵出偃师，北阻邙山以待。世充帅其徒薄密营，伏兵发，纵火焚密营垒。密众大溃，张童仁、陈智略皆降。密与万余骑走河阳，将南阻河以图再举，诸将不可，遂归唐。',
    year: 618,
    illustration: 'v20_mangshan_zhan',
    objective: '据邙山设伏，在 15 回合内击溃李密主力。',
    defeatCondition: '郑军主力被击溃，或洛阳营垒被袭破。',
    startingState: {
      troops: 18000,
      money: 2800,
      food: 4500,
      generals: ['v17_wang_shichong', 'v19_dan_xiongxin']
    },
    reward: { money: 5000, food: 9000 },
    mapSetup: [
      { id: 'luoyang',     owner: 'player', garrison: 6000,  isBase: true,  name: '洛阳（王世充大营）' },
      { id: 'beishan',     owner: 'enemy',  garrison: 4000,  name: '北山（伏兵设处）' },
      { id: 'mangshan',    owner: 'enemy',  garrison: 9000,  isObjective: true, name: '邙山（李密主力）' }
    ]
  },
  // ---- 战役24：岭南归唐（622年）—— 冯盎举地归唐 ----
  {
    id: 'v20_lingnan_guifu',
    name: '岭南归唐',
    description: '唐武德四年（621），李靖既定江陵，分道抚慰岭表。明年，番州总管冯盎，冼夫人之孙也，据番禺、苍梧、朱崖二十余州。或说盎割据南越，自称南越王。盎曰：吾居越五世，今唐新定，中国未宁，吾安敢窃地自娱！遂以岭南之地降唐。高祖析其地为高、罗、春、白、崖、儋、林、振八州。岭南遂平，不复烦兵革。',
    year: 622,
    illustration: 'v20_lingnan_guifu',
    objective: '遣使抚慰，在 18 回合内传檄而定岭南诸州。',
    defeatCondition: '岭南诸州皆叛，或抚慰使被杀。',
    startingState: {
      troops: 12000,
      money: 3500,
      food: 5000,
      generals: ['v20_fang_ang', 'v20_xian_furen', 'v17_li_jing']
    },
    reward: { money: 5500, food: 9000 },
    mapSetup: [
      { id: 'guangzhou',   owner: 'player', garrison: 5000,  isBase: true,  name: '广州（岭南大都）' },
      { id: 'panyu',       owner: 'player', garrison: 3000,  name: '番禺（冯盎旧治）' },
      { id: 'jiaozhou',    owner: 'enemy',  garrison: 5000,  isObjective: true, name: '交州（南陲未定）' }
    ]
  },
  // ---- 战役25：玄武门之变（626年）—— 秦王定乾坤 ----
  {
    id: 'v20_xuanwu_zhibian',
    name: '玄武门之变',
    description: '唐武德九年（626），秦王世民功高，为太子建成、齐王元吉所忌。六月，太白经天。世民密奏其罪。庚申，世民率长孙无忌、尉迟敬德等九人，伏兵于玄武门。建成、元吉入玄武门，至临湖殿，觉变，欲东归。世民从后呼之，射杀建成。敬德射杀元吉。东宫、齐府精兵二千鼓噪攻玄武门，敬德持建成、元吉首示之，宫府兵遂溃。高祖乃立世民为皇太子，庶政皆决。',
    year: 626,
    illustration: 'v20_xuanwu_zhibian',
    objective: '伏兵玄武门，在 8 回合内控制宫城，正位东宫。',
    defeatCondition: '秦王护卫被歼灭，或宫城落入太子党。',
    startingState: {
      troops: 8000,
      money: 4000,
      food: 4000,
      generals: ['v20_li_shimin', 'v19_yuchi_jingde', 'v19_changsun_wuji', 'v20_duan_zhixuan']
    },
    reward: { money: 8000, food: 12000 },
    mapSetup: [
      { id: 'xuanwumen',   owner: 'player', garrison: 4000,  isBase: true,  name: '玄武门（秦王伏兵）' },
      { id: 'taigong_dian', owner: 'enemy', garrison: 6000,  isObjective: true, name: '宫城（太子齐王党）' }
    ]
  },
  // ---- 战役26：阴山夜袭（630年）—— 李靖夜袭颉利可汗 ----
  {
    id: 'v21_yinshan_yixi',
    name: '阴山夜袭',
    description: '唐贞观四年（630），李靖破突厥于定襄，颉利可汗退保铁山，遣使请举国内附，实欲俟草壮，走入漠北。靖与李勣议，选精骑一万，赍二十日粮，自白道袭之。副将张公谨固谏不可，靖不听。师夜发，前锋乘雾而行，去牙帐七里，虏乃觉。颉利乘千里马先走，靖纵兵纵击，斩首万余，俘男女十余万。颉利走吐谷浑，寻为张宝相所禽。漠南无王庭。',
    year: 630,
    illustration: 'v21_yinshan_yixi',
    objective: '自白道夜袭，在 15 回合内击破颉利牙帐。',
    defeatCondition: '唐军精骑被歼灭，或粮尽退军。',
    startingState: {
      troops: 16000,
      money: 3000,
      food: 4000,
      generals: ['v17_li_jing', 'v21_zhang_gongjin', 'v21_qiu_xinggong']
    },
    reward: { money: 6500, food: 11000 },
    mapSetup: [
      { id: 'shuofang',    owner: 'player', garrison: 5000,  isBase: true,  name: '白道（唐军精骑）' },
      { id: 'v20_chanyu',  owner: 'enemy',  garrison: 6000,  name: '铁山（颉利伪降）' },
      { id: 'v20_anbei',   owner: 'enemy',  garrison: 8000,  isObjective: true, name: '突厥牙帐（颉利可汗）' }
    ]
  },
  // ---- 战役27：攻灭高昌（640年）—— 侯君集伐麴智盛 ----
  {
    id: 'v21_mie_gaochang',
    name: '攻灭高昌',
    description: '唐贞观十四年（640），高昌王麴文泰遏绝西域朝贡，太宗以侯君集为交河道行军大总管，将兵数万讨之。文泰自恃漠远，及闻大军临碛口，忧惧发病死，子智盛立。君集进至高昌，填堑攻城，为巢车以瞰城中，石下如雨，城上人皆室处。智盛穷蹙，面缚出降。乃下三郡五县二十二城，以其地为西州。',
    year: 640,
    illustration: 'v21_mie_gaochang',
    objective: '出碛口攻城，在 18 回合内攻克高昌王城。',
    defeatCondition: '唐军主力被歼灭，或碛口粮道被断。',
    startingState: {
      troops: 20000,
      money: 3500,
      food: 5000,
      generals: ['v21_hou_junji', 'v21_niu_jinda', 'v21_qiu_xinggong']
    },
    reward: { money: 7000, food: 12000 },
    mapSetup: [
      { id: 'dunhuang',    owner: 'player', garrison: 6000,  isBase: true,  name: '敦煌（出碭大营）' },
      { id: 'v21_yiwu',    owner: 'enemy',  garrison: 5000,  name: '伊吾（高昌北障）' },
      { id: 'v21_gaochang', owner: 'enemy', garrison: 9000,  isObjective: true, name: '高昌王城（麴智盛）' }
    ]
  },
  // ---- 战役28：曳咥河破贺鲁（657年）—— 苏定方冒雪西征 ----
  {
    id: 'v21_yedie_pohelu',
    name: '曳咥河破贺鲁',
    description: '唐显庆二年（657），苏定方为伊丽道行军大总管，讨西突厥沙钵罗可汗阿史那贺鲁。至曳咥河西，贺鲁将十姓十万众来拒。定方令步兵据原南，攒槊外向，自将汉骑阵于原北。贼三犯步阵，不动。定方乘其气衰，纵骑驰之，贼大溃，追奔三十里，斩获数万人。会大雪，平地二尺，定方冒雪兼行，至双河，距贺鲁牙二百里，长围而掩之。贺鲁走石国，国人执以降。十姓悉平。',
    year: 657,
    illustration: 'v21_yedie_pohelu',
    objective: '据原结阵，冒雪穷追，在 20 回合内擒贺鲁。',
    defeatCondition: '唐军步骑被击溃，或大雪断粮。',
    startingState: {
      troops: 18000,
      money: 3200,
      food: 4800,
      generals: ['v21_pei_xingjian', 'v21_xue_rengui', 'v21_fan_xing']
    },
    reward: { money: 7500, food: 13000 },
    mapSetup: [
      { id: 'v20_beiting', owner: 'player', garrison: 5000,  isBase: true,  name: '北庭（唐军西征大营）' },
      { id: 'v20_anxi',    owner: 'enemy',  garrison: 6000,  name: '曳咥河（贺鲁拒战）' },
      { id: 'v21_suiye',   owner: 'enemy',  garrison: 8000,  isObjective: true, name: '碎叶水（贺鲁牙帐）' }
    ]
  },
  // ---- 战役29：白江口焚舟（663年）—— 刘仁轨火攻破倭 ----
  {
    id: 'v21_baijiang_fenzhou',
    name: '白江口焚舟',
    description: '唐龙朔三年（663），百济福信引倭兵围刘仁轨于熊津。仁轨率舟师，与倭人遇于白江口。倭船千艘，塞江而陈。仁轨命分舟师为左右翼，顺风纵火。烟焰灼天，海水尽赤，四战皆捷，焚倭舟四百艘。倭人大败，赴水死者万数。百济残众皆溃走。海东遂定，唐威东渐于海。',
    year: 663,
    illustration: 'v21_baijiang_fenzhou',
    objective: '乘风纵火，在 12 回合内焚毁倭人舟师。',
    defeatCondition: '唐军舟师被歼灭，或熊津被攻破。',
    startingState: {
      troops: 14000,
      money: 3000,
      food: 4500,
      generals: ['v21_xue_rengui', 'v21_niu_jinda', 'v21_gongsun_wuda']
    },
    reward: { money: 6000, food: 10000 },
    mapSetup: [
      { id: 'v20_pingzhou', owner: 'player', garrison: 5000,  isBase: true,  name: '平州（唐军舟师）' },
      { id: 'v20_andong',  owner: 'enemy',  garrison: 7000,  isObjective: true, name: '白江口（倭人舟舰）' }
    ]
  },
  // ---- 战役30：围平壤灭高丽（668年）—— 李勣拔平壤 ----
  {
    id: 'v21_weiping_miegaoli',
    name: '围平壤灭高丽',
    description: '唐总章元年（668），司空李勣为辽东道行军大总管，统薛仁贵等诸道兵，数道俱进。官军拔新城，十六城皆降。薛仁贵乘胜将三千人攻扶余，拔之，杀万余人。勣遂合军，进至鸭绿水。高丽遣兵五万来拒，击破之，追奔二百余里。遂围平壤，月余，王藏遣男产率首领六十八人，素服以降。执莫离支男建，高丽遂亡。凡拔城百七十，户六十九万。',
    year: 668,
    illustration: 'v21_weiping_miegaoli',
    objective: '连拔诸城，在 24 回合内攻克平壤。',
    defeatCondition: '唐军主力被歼灭，或辽东久攻不下。',
    startingState: {
      troops: 24000,
      money: 4000,
      food: 6000,
      generals: ['v17_li_jing', 'v21_xue_rengui', 'v21_qiu_xinggong']
    },
    reward: { money: 9000, food: 15000 },
    mapSetup: [
      { id: 'v20_pingzhou', owner: 'player', garrison: 6000,  isBase: true,  name: '平州（辽东出师）' },
      { id: 'v20_yanzhou',  owner: 'enemy',  garrison: 6000,  name: '新城（高丽西障）' },
      { id: 'v20_andong',   owner: 'enemy',  garrison: 10000, isObjective: true, name: '平壤（高丽王城）' }
    ]
  },
  // ---- 战役31：灵宝潼关之战（756年）—— 哥舒翰恸哭出关 ----
  {
    id: 'v22_lingbao_tongguan',
    name: '灵宝潼关之战',
    description: '唐至德元载（756），安禄山陷东都，哥舒翰守潼关。杨国忠促战，翰不得已，抚膺恸哭，引兵出关。遇贼崔乾祐于灵宝西原，贼据险，乘高下木石，纵火毡车，官军大败，二十万唯存八千。潼关遂陷，翰为麾下所执。此关一失，长安不守，肃宗遂即位灵武。',
    year: 756,
    illustration: 'v22_lingbao_tongguan',
    objective: '坚守潼关，在 12 回合内击破出陕之贼。',
    defeatCondition: '潼关被攻破，或哥舒翰主力被歼灭。',
    startingState: {
      troops: 18000,
      money: 2800,
      food: 4000,
      generals: ['v22_geshuhan', 'v22_gaoxianzhi', 'v22_fengchangqing']
    },
    reward: { money: 6000, food: 10000 },
    mapSetup: [
      { id: 'v22_shanzhou', owner: 'player', garrison: 7000,  isBase: true,  name: '潼关（唐军扼守）' },
      { id: 'luoyang',      owner: 'enemy',  garrison: 8000,  isObjective: true, name: '陕郡（崔乾祐拒战）' }
    ]
  },
  // ---- 战役32：睢阳保卫战（757年）—— 张巡、许远障蔽江淮 ----
  {
    id: 'v22_suiyang_baowei',
    name: '睢阳保卫战',
    description: '唐至德二载（757），尹子奇以十三万之众围睢阳。张巡、许远以残卒数千拒之，鸣鼓卧鼓，贼莫测。城中粮尽，士皆饿得无人色，而莫有叛心。巡与南霁云大小四百余战，杀贼十二万。霁云冒围出，断指乞师于贺兰进明，不获。城卒陷，巡等皆死，然江淮赖以全，唐之赋饷赖以济师。',
    year: 757,
    illustration: 'v22_suiyang_baowei',
    objective: '死守睢阳，在 24 回合内击退尹子奇大军。',
    defeatCondition: '睢阳被攻破，或守军全军覆没。',
    startingState: {
      troops: 9000,
      money: 1500,
      food: 2000,
      generals: ['v22_zhang_xun', 'v22_nanji_yun']
    },
    reward: { money: 5500, food: 9000 },
    mapSetup: [
      { id: 'v22_songzhou', owner: 'player', garrison: 5000,  isBase: true,  name: '睢阳（张巡孤守）' },
      { id: 'v22_bianzhou', owner: 'enemy',  garrison: 7000,  name: '汴州（贼兵南压）' },
      { id: 'v22_yanzhou',  owner: 'enemy',  garrison: 6000,  isObjective: true, name: '兖州（尹子奇大营）' }
    ]
  },
  // ---- 战役33：香积寺之战（757年）—— 郭子仪收复长安 ----
  {
    id: 'v22_xiangjizi_shaan',
    name: '香积寺收复长安',
    description: '唐至德二载（757），广平王俶为元帅，郭子仪副之，率朔方、安西及回纥十五万众，发凤翔。遇贼安守忠于长安西香积寺北。李嗣业前军奋击，贼阵动。回纥又自南山出，夹击破之，斩首六万。贼众大溃，余党入长安，宵遁。遂收西京，百姓老幼百万，夹道呼曰：不图今日复见官军！',
    year: 757,
    illustration: 'v22_xiangjizi_shaan',
    objective: '出凤翔决战，在 16 回合内克复长安。',
    defeatCondition: '唐军主力被击溃，或凤翔失守。',
    startingState: {
      troops: 22000,
      money: 3500,
      food: 5000,
      generals: ['v22_guo_ziyi', 'v22_pugu_huaien', 'v22_li_guangbi']
    },
    reward: { money: 7500, food: 12000 },
    mapSetup: [
      { id: 'v14_qizhou',    owner: 'player', garrison: 6000, isBase: true,  name: '凤翔（灵武行在）' },
      { id: 'v14_huazhou',   owner: 'enemy',  garrison: 6000, name: '华州（贼兵东障）' },
      { id: 'changan',       owner: 'enemy',  garrison: 9000, isObjective: true, name: '长安（西京收复）' }
    ]
  },
  // ---- 战役34：新店陕郡之战（757年）—— 收复洛阳 ----
  {
    id: 'v22_xindian_shanjun',
    name: '新店收东都',
    description: '唐至德二载（757），官军既复长安，乘胜东讨。严庄悉洛阳之众十五万，阵于陕郡山西。郭子仪以大军当其前，回纥自南山蹑其后。贼方陈，回纥扬尘噪呼，贼顾视骇溃。官军夹击之，贼大败，僵尸蔽野。严庄走洛阳，庆绪渡河走保相州。东都遂复。',
    year: 757,
    illustration: 'v22_xindian_shanjun',
    objective: '出潼关东进，在 18 回合内克复洛阳。',
    defeatCondition: '唐军主力被击溃，或潼关粮道被断。',
    startingState: {
      troops: 20000,
      money: 3300,
      food: 4800,
      generals: ['v22_guo_ziyi', 'v22_li_guangbi', 'v22_pugu_huaien']
    },
    reward: { money: 7000, food: 11000 },
    mapSetup: [
      { id: 'v22_shanzhou', owner: 'player', garrison: 5500, isBase: true,  name: '陕州（出潼关）' },
      { id: 'luoyang',      owner: 'enemy',  garrison: 9000, isObjective: true, name: '洛阳（东都收复）' }
    ]
  },
  // ---- 战役35：相州邺城之战（759年）—— 九节度之师溃于邺城 ----
  {
    id: 'v22_yecheng_zhizhan',
    name: '相州邺城之战',
    description: '唐乾元二年（759），郭子仪、李光弼等九节度之兵二十万，围安庆绪于相州。史思明自范阳来救。官军战于愁思冈，思明锐出，大风忽起，吹沙拔木，天地昼晦，两军相视惊溃。思明遂杀庆绪，并其众。然官军亦退屯洛阳，唐室不能复振，藩镇之祸成矣。',
    year: 759,
    illustration: 'v22_yecheng_zhizhan',
    objective: '合围邺城，在 22 回合内击破史思明援军。',
    defeatCondition: '唐军九节度之师溃于大风，或邺城久攻不下。',
    startingState: {
      troops: 26000,
      money: 4000,
      food: 6000,
      generals: ['v22_guo_ziyi', 'v22_li_guangbi', 'v22_pugu_huaien']
    },
    reward: { money: 8500, food: 14000 },
    mapSetup: [
      { id: 'v22_weizhou', owner: 'player', garrison: 6000,  isBase: true,  name: '魏州（九节度大营）' },
      { id: 'v22_xingzhou', owner: 'enemy', garrison: 6000,  name: '邢州（史思明援兵）' },
      { id: 'yecheng',     owner: 'enemy',  garrison: 10000, isObjective: true, name: '相州邺城（安庆绪固守）' }
    ]
  },
  // ---- 战役36：泾原兵变（783年）—— 朱泚据长安，德宗幸奉天 ----
  {
    id: 'v23_jingyuan_bian',
    name: '泾原兵变',
    description: '唐建中四年（783），泾原兵过京师，以赐薄作乱，奉朱泚。泚僭据长安，德宗仓卒幸奉天。泚合泾原、凤翔之众，急攻奉天。赖浑瑊死守，城中矢石且尽。及李晟率神策兵自河北赴难，屯东渭桥，与李晟东西相应。此役也，唐社几危，赖忠力之士，仅而获济。',
    year: 783,
    illustration: 'v23_jingyuan_bian',
    objective: '守奉天待援，在 16 回合内击破朱泚之众。',
    defeatCondition: '奉天被攻破，或德宗行在失守。',
    startingState: {
      troops: 14000,
      money: 2200,
      food: 3200,
      generals: ['v23_hun_jian', 'v23_ma_sui']
    },
    reward: { money: 6000, food: 10000 },
    mapSetup: [
      { id: 'v14_qizhou',  owner: 'player', garrison: 6000,  isBase: true,  name: '奉天（德宗行在）' },
      { id: 'v22_shanzhou', owner: 'enemy',  garrison: 6000,  name: '潼关（泾原乱军西压）' },
      { id: 'changan',      owner: 'enemy',  garrison: 9000,  isObjective: true, name: '长安（朱泚僭据）' }
    ]
  },
  // ---- 战役37：李晟复长安（784年）—— 孤军收复京师 ----
  {
    id: 'v23_lisheng_fuchangan',
    name: '李晟复长安',
    description: '唐兴元元年（784），李晟在东渭桥，孤军当大敌，内无资粮，外无救援。乃以忠义感激将士，士皆泣下。晟乃决策，自光泰门入，贼众大溃。泚走彭原，其将斩之以降。晟入长安，号令诸军：士庶安堵，秋毫无犯。百姓老幼，夹道迎拜，或感泣。德宗自兴元还长安，见晟，执其手曰：天生晟，为社稷万人。',
    year: 784,
    illustration: 'v23_lisheng_fuchangan',
    objective: '出东渭桥决战，在 18 回合内克复长安。',
    defeatCondition: '李晟主力被击溃，或东渭桥粮道被断。',
    startingState: {
      troops: 18000,
      money: 2800,
      food: 4200,
      generals: ['v23_li_sheng', 'v23_hun_jian']
    },
    reward: { money: 7000, food: 11000 },
    mapSetup: [
      { id: 'v14_qizhou',  owner: 'player', garrison: 5500,  isBase: true,  name: '东渭桥（李晟大营）' },
      { id: 'v22_shanzhou', owner: 'enemy', garrison: 6000,  name: '华州（贼兵东障）' },
      { id: 'changan',      owner: 'enemy', garrison: 9500,  isObjective: true, name: '长安（克复京师）' }
    ]
  },
  // ---- 战役38：雪夜入蔡州（817年）—— 李愬雪夜奇袭 ----
  {
    id: 'v23_xueye_rucaizhou',
    name: '雪夜入蔡州',
    description: '唐元和十二年（817），李愬为唐邓节度使，擒贼将李祐而用之。祐言于愬：蔡之精兵皆在洄曲，守州城者皆羸老，可以乘虚直抵城下。愬然之。会大雨雪，行七十里，夜半至蔡州城下。城旁有鹅鸭池，愬令击之以混军声。四鼓，无一人知。元济登牙城拒战，愬梯而登，降其众，元济乃降。自唐兴以来，藩镇之强，未有若此奇捷者也。',
    year: 817,
    illustration: 'v23_xueye_rucaizhou',
    objective: '以奇师雪夜进兵，在 12 回合内奇袭蔡州。',
    defeatCondition: '奇谋败露，或李愬主力被歼灭。',
    startingState: {
      troops: 9000,
      money: 1500,
      food: 2200,
      generals: ['v23_li_su', 'v23_li_guangyan']
    },
    reward: { money: 6500, food: 10000 },
    mapSetup: [
      { id: 'v23_chenzhou',  owner: 'player', garrison: 4500,  isBase: true,  name: '陈州（唐邓军前沿）' },
      { id: 'v23_ruzhou',    owner: 'enemy',  garrison: 5000,  name: '汝州（淮西外围）' },
      { id: 'v23_zhengzhou',  owner: 'enemy',  garrison: 8000,  isObjective: true, name: '蔡州（吴元济固守）' }
    ]
  },
  // ---- 战役39：宪宗平淮西（818年）—— 申光二州降，淮西平 ----
  {
    id: 'v23_ping_huaixi',
    name: '宪宗平淮西',
    description: '唐元和十三年（818），吴元济既擒，送京师，斩于独柳。申、光二州闻元济败，皆开门降。淮西自李忠臣以来，割据五十余年，至是复为王土。诸道兵讨淮西，四年馈运疲弊，赖裴度督师，李愬用奇，卒成大功。河北藩镇闻之，皆惧，田弘正请以魏博六州听命。唐室威令，复振于河北。',
    year: 818,
    illustration: 'v23_ping_huaixi',
    objective: '合围申、光，在 20 回合内平定淮西三州。',
    defeatCondition: '淮西久攻不下，或诸道粮尽退师。',
    startingState: {
      troops: 20000,
      money: 3200,
      food: 4800,
      generals: ['v23_li_su', 'v23_li_guangyan', 'v23_hun_jian']
    },
    reward: { money: 8000, food: 13000 },
    mapSetup: [
      { id: 'v23_chenzhou', owner: 'player', garrison: 5000,  isBase: true,  name: '陈州（行营都统）' },
      { id: 'v23_yingzhou', owner: 'enemy',  garrison: 6000,  name: '颍州（申州方向）' },
      { id: 'v23_zhengzhou', owner: 'enemy',  garrison: 9000,  isObjective: true, name: '蔡州（淮西既克）' }
    ]
  },
  // ---- 战役40：平淄青李师道（819年）—— 淄青十二州平 ----
  {
    id: 'v23_ping_ziqing',
    name: '平淄青',
    description: '唐元和十四年（819），平卢淄青节度使李师道叛。帝命田弘正自魏博渡河，宣武等诸道并进。师道昏懦，其将刘悟，勒兵趣郓州，斩师道，自淄青降。淄青十二州皆平。自广德以来，垂六十年，藩镇跋扈，河南北三十余州，自除官吏，不贡赋，至是尽遵朝廷约束。唐室中兴，号为元和。',
    year: 819,
    illustration: 'v23_ping_ziqing',
    objective: '诸道并进，在 22 回合内克郓州，平淄青十二州。',
    defeatCondition: '淄青久攻不下，或魏博军被歼。',
    startingState: {
      troops: 24000,
      money: 3800,
      food: 5600,
      generals: ['v23_li_guangyan', 'v23_hun_jian', 'v23_li_su']
    },
    reward: { money: 9000, food: 15000 },
    mapSetup: [
      { id: 'v23_yunzhou',  owner: 'player', garrison: 6000,  isBase: true,  name: '郓州（平卢行营）' },
      { id: 'v22_cangzhou',  owner: 'enemy',  garrison: 6000,  name: '沧州（淄青北境）' },
      { id: 'qingzhou',      owner: 'enemy',  garrison: 10000, isObjective: true, name: '青州（李师道巢穴）' }
    ]
  },
  // ---- 战役41：黄巢入长安（880年）—— 沙陀破巢，复京师 ----
  {
    id: 'v24_huangchao_changan',
    name: '黄巢入长安',
    description: '唐广明元年（880），黄巢自采石渡江，众号六十万，破潼关，入长安。僖宗幸蜀。黄巢称大齐皇帝。三年，李克用率沙陀骑自雁门南下，会诸道兵，败巢于梁田陂。巢退保长安，克用进攻，巢食尽，夜走。京师复。自黄巢陷长安，凡三年，宫阙萧条，鞠为茂草。',
    year: 880,
    illustration: 'v24_huangchao_changan',
    objective: '率沙陀骑自潼关东进，在 18 回合内克复长安。',
    defeatCondition: '沙陀主力被击溃，或粮道断绝。',
    startingState: {
      troops: 20000,
      money: 3000,
      food: 4500,
      generals: ['v24_li_keyong', 'v24_gao_pian']
    },
    reward: { money: 7000, food: 11000 },
    mapSetup: [
      { id: 'v14_qizhou',  owner: 'player', garrison: 6000,  isBase: true,  name: '渭北行营（沙陀大营）' },
      { id: 'huatai',       owner: 'enemy',  garrison: 7000,  name: '华州（黄巢东线）' },
      { id: 'changan',      owner: 'enemy',  garrison: 10000, isObjective: true, name: '长安（黄巢大齐所据）' }
    ]
  },
  // ---- 战役42：上源驿之变（884年）—— 朱温图李克用 ----
  {
    id: 'v24_shangyuan_zhiyi',
    name: '上源驿之变',
    description: '唐中和四年（884），黄巢既平，李克用过汴州。朱温邀入城，宴于上源驿。克用酒语侵温。温夜伏兵攻驿，会大雨震电，克用逾垣得出，缒城仅免，监军已下皆死。克用诉于朝，天子两解之。然梁晋之怨，自此始，兵争者四十年。此役也，汴卒夜围驿馆，火光照天。',
    year: 884,
    illustration: 'v24_shangyuan_zhiyi',
    objective: '在汴州城中突围而出，在 10 回合内撤回魏州。',
    defeatCondition: '李克用被俘，或突围失败。',
    startingState: {
      troops: 8000,
      money: 1200,
      food: 1800,
      generals: ['v24_li_keyong', 'v24_zhou_dewei']
    },
    reward: { money: 6000, food: 9000 },
    mapSetup: [
      { id: 'v22_bianzhou', owner: 'player', garrison: 4000,  isBase: true,  name: '汴州上源驿（被困）' },
      { id: 'puyang',       owner: 'enemy',  garrison: 5000,  name: '濮州（汴军追骑）' },
      { id: 'v22_weizhou', owner: 'enemy',  garrison: 6000,  isObjective: true, name: '魏州（河东归路）' }
    ]
  },
  // ---- 战役43：白马驿之祸（905年）—— 朱温诛朝士 ----
  {
    id: 'v24_baimayi_zhihuo',
    name: '白马驿之祸',
    description: '唐天祐二年（905），朱温已诛昭宗，柳逢言于温曰：此辈自谓清流，宜投之黄河，使为浊流。温从之。裴枢、陆扆等三十余朝士，皆杀于滑州白马驿，投尸于河。唐之搢绅尽矣。温自为相国，封魏王，加九锡。唐之神器已移。此役为朱温篡唐之先声。',
    year: 905,
    illustration: 'v24_baimayi_zhihuo',
    objective: '进据滑州白马驿，在 14 回合内逼唐廷。',
    defeatCondition: '汴军久顿白马，或诸镇勤王兵至。',
    startingState: {
      troops: 16000,
      money: 2600,
      food: 3800,
      generals: ['v24_zhu_wen', 'v24_ge_congzhou']
    },
    reward: { money: 6500, food: 10000 },
    mapSetup: [
      { id: 'v22_bianzhou', owner: 'player', garrison: 5500,  isBase: true,  name: '汴州（大梁元帅府）' },
      { id: 'puyang',       owner: 'enemy',  garrison: 5000,  name: '白马驿（朝士所在）' },
      { id: 'luoyang',      owner: 'enemy',  garrison: 8000,  isObjective: true, name: '洛阳（唐哀帝所在）' }
    ]
  },
  // ---- 战役44：朱温代唐（907年）—— 受禅建梁 ----
  {
    id: 'v24_zhuwen_daitang',
    name: '朱温代唐',
    description: '唐天祐四年（907），朱温更名晃，受唐哀帝禅，即皇帝位，国号大梁，都汴州。奉哀帝为济阴王，明年杀之。唐自武德，二百八十八年而亡。是时，李克用据河东仍称天祐，王建称帝蜀，杨渥据淮南，钱镠王吴越。五代十国之局，自此始。此役为梁室定鼎之战。',
    year: 907,
    illustration: 'v24_zhuwen_daitang',
    objective: '受唐禅，定大梁，在 16 回合内降服关东诸镇。',
    defeatCondition: '河东李克用渡河来争，或诸镇皆叛。',
    startingState: {
      troops: 22000,
      money: 3600,
      food: 5400,
      generals: ['v24_zhu_wen', 'v24_ge_congzhou', 'v24_zhang_quanyi']
    },
    reward: { money: 8000, food: 13000 },
    mapSetup: [
      { id: 'v22_bianzhou', owner: 'player', garrison: 6500,  isBase: true,  name: '汴州大梁宫（受禅）' },
      { id: 'luoyang',      owner: 'enemy',  garrison: 7000,  name: '洛阳（唐东都）' },
      { id: 'yecheng',      owner: 'enemy',  garrison: 9000,  isObjective: true, name: '魏州（河北强藩）' }
    ]
  },
  // ---- 战役45：李存勖灭梁（923年）—— 后唐定鼎 ----
  {
    id: 'v24_cunxu_mieliang',
    name: '李存勖灭梁',
    description: '后梁龙德三年（923），晋王李存勖即皇帝位于魏州，国号唐。梁末帝在汴，遣段凝拒河上。庄宗用郭崇韬策，自杨刘渡河，长驱趋汴。梁军无备，末帝登建国楼，召群臣，皆散。末帝命皇甫麟杀己，麟亦自刃。唐兵入汴，梁亡。自朱温篡唐，凡十七年。时人谓之：朱三算甚麽，养子却来填。',
    year: 923,
    illustration: 'v24_cunxu_mieliang',
    objective: '自魏州渡河，长驱趋汴，在 15 回合内灭后梁。',
    defeatCondition: '杨刘河津受阻，或魏州根本被袭。',
    startingState: {
      troops: 24000,
      money: 4000,
      food: 5800,
      generals: ['v24_li_cunxu', 'v24_zhou_dewei', 'v24_guo_chongtao']
    },
    reward: { money: 9500, food: 15000 },
    mapSetup: [
      { id: 'v22_weizhou',  owner: 'player', garrison: 6000,  isBase: true,  name: '魏州（后唐即位）' },
      { id: 'v22_yanzhou',  owner: 'enemy',  garrison: 6000,  name: '郓州（梁军河防）' },
      { id: 'v22_bianzhou', owner: 'enemy',  garrison: 10000, isObjective: true, name: '汴州（梁末帝都城）' }
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

// ============================================================
// V17.0 — 平衡性调优常量
// ============================================================
// 说明：V17.0 新增 15 位武将、20 个随机事件、5 个历史事件、1 个剧本、5 个战役关卡。
//   内容量再扩后，对数值做以下微调：
//   1) 兵种克制加成维持 V16=0.27，名将密度继续上升，不再增强克制；
//   2) AI 进攻阈值 V16=0.36 → V17=0.37，战役模式 AI 略趋激进；
//   3) 随机事件基础触发概率 V16=0.17 → V17=0.18，事件池再扩大后略升触达；
//   4) 忠诚自然衰减维持 V16=0.22；
//   5) 新招募武将初始忠诚下限 V16=70 → V17=72，在野将池继续扩大；
//   6) 战役模式胜利奖励倍率维持 campaignRewardMult=1.0；
//   7) 战役模式敌军难度倍率维持 campaignEnemyMult=1.0；
//   8) 税率上限维持 V16=45%。
// 注意：本常量仅作为数值配置集中声明，实际读取由 game.js/ai.js/tax.js 决定。
// ------------------------------------------------------------
export const V17_BALANCE = {
  // 兵种克制加成（维持 V16=0.27）
  counterBonus: 0.27,
  // 阵型克制加成（维持 V16=0.22）
  formationCounterBonus: 0.22,
  // AI 进攻阈值（V16=0.36 → V17=0.37，战役内容新增后 AI 略趋激进）
  aiAttackThreshold: 0.37,
  // AI 防御权重（维持 V16=0.60）
  aiDefenseWeight: 0.60,
  // 随机事件基础触发概率（V16=0.17 → V17=0.18，事件池再扩后略升触达）
  eventBaseProbability: 0.18,
  // 忠诚自然衰减速率（维持 V16=0.22）
  loyaltyDecayRate: 0.22,
  // 新招募武将初始忠诚下限（V16=70 → V17=72，在野将池继续扩大）
  recruitInitialLoyalty: 72,
  // 基础税率上限（维持 V16=45%）
  maxTaxRate: 45,
  // 税率超过 35% 后每 1% 的民心衰减（维持 V16=0.08）
  taxOverThresholdMoraleDecay: 0.08,
  // 税率低于 20% 时每 1% 的民心增益（维持 V16=0.05）
  taxUnderThresholdMoraleBonus: 0.05,
  // 城市收入人口系数（维持 V16=0.075）
  incomePopFactor: 0.075,
  // 冬季粮草消耗系数（维持 V16=0.05）
  winterFoodWaste: 0.05,
  // 科技研究费用系数（维持 V16=0.9）
  techCostMult: 0.9,
  // 困难模式 AI 资源倍率（维持 V16=1.4）
  hardModeResourceMult: 1.4,
  // 简单模式 AI 资源倍率（维持 V16=0.68）
  easyModeResourceMult: 0.68,
  // 新将招募费用折扣（维持 V16=0.15）
  recruitCostDiscount: 0.15,
  // 城市维护费系数（维持 V16=0.95）
  cityUpkeepFactor: 0.95,
  // 战役模式：胜利奖励倍率（维持 V16=1.0）
  campaignRewardMult: 1.0,
  // 战役模式：敌军兵力难度倍率（维持 V16=1.0）
  campaignEnemyMult: 1.0
};

// ============================================================
// V18.0 — 平衡性调优常量
// ============================================================
// 说明：V18.0 新增 15 位武将、20 个随机事件、5 个历史事件、1 个剧本、5 个战役关卡、
//       12 座西北边疆城市。内容量再扩后，对数值做以下微调：
//   1) 兵种克制加成维持 V17=0.27，名将密度继续上升，不再增强克制；
//   2) AI 进攻阈值 V17=0.37 → V18=0.38，西北新城市拉长出击线，AI 略趋激进；
//   3) 随机事件基础触发概率 V17=0.18 → V18=0.19，事件池扩至 377，略升触达；
//   4) 忠诚自然衰减维持 V17=0.22；
//   5) 新招募武将初始忠诚下限 V17=72 → V18=73，在野将池继续扩大；
//   6) 西北沙漠城市补给惩罚略增 desertSupplyPenalty=0.32，避免新城过于易守；
//   7) 战役模式胜利奖励倍率 V17=1.0 → V18=1.05，新战役战线更长，略增回报；
//   8) 战役模式敌军难度倍率维持 V17=1.0。
// 注意：本常量仅作为数值配置集中声明，实际读取由 game.js/ai.js/tax.js 决定。
// ------------------------------------------------------------
export const V18_BALANCE = {
  // 兵种克制加成（维持 V17=0.27）
  counterBonus: 0.27,
  // 阵型克制加成（维持 V17=0.22）
  formationCounterBonus: 0.22,
  // AI 进攻阈值（V17=0.37 → V18=0.38）
  aiAttackThreshold: 0.38,
  // AI 防御权重（维持 V17=0.60）
  aiDefenseWeight: 0.60,
  // 随机事件基础触发概率（V17=0.18 → V18=0.19）
  eventBaseProbability: 0.19,
  // 忠诚自然衰减速率（维持 V17=0.22）
  loyaltyDecayRate: 0.22,
  // 新招募武将初始忠诚下限（V17=72 → V18=73）
  recruitInitialLoyalty: 73,
  // 基础税率上限（维持 V17=45%）
  maxTaxRate: 45,
  // 税率超过 35% 后每 1% 的民心衰减（维持 V17=0.08）
  taxOverThresholdMoraleDecay: 0.08,
  // 税率低于 20% 时每 1% 的民心增益（维持 V17=0.05）
  taxUnderThresholdMoraleBonus: 0.05,
  // 城市收入人口系数（维持 V17=0.075）
  incomePopFactor: 0.075,
  // 冬季粮草消耗系数（维持 V17=0.05）
  winterFoodWaste: 0.05,
  // 科技研究费用系数（维持 V17=0.9）
  techCostMult: 0.9,
  // 困难模式 AI 资源倍率（维持 V17=1.4）
  hardModeResourceMult: 1.4,
  // 简单模式 AI 资源倍率（维持 V17=0.68）
  easyModeResourceMult: 0.68,
  // 新将招募费用折扣（维持 V17=0.15）
  recruitCostDiscount: 0.15,
  // 城市维护费系数（维持 V17=0.95）
  cityUpkeepFactor: 0.95,
  // 沙漠地形行军补给惩罚（V18 新增，西北边疆城市专用）
  desertSupplyPenalty: 0.32,
  // 战役模式：胜利奖励倍率（V17=1.0 → V18=1.05）
  campaignRewardMult: 1.05,
  // 战役模式：敌军兵力难度倍率（维持 V17=1.0）
  campaignEnemyMult: 1.0
};

// ============================================================
// V19.0 — 平衡性调优常量
// ============================================================
// 说明：V19.0 新增 15 位武将、20 个随机事件、5 个历史事件、1 个剧本、
//       5 个战役关卡、12 座陇右/河西/河北边镇城市。内容量再扩后，对数值做以下微调：
//   1) 兵种克制加成维持 V18=0.27，名将密度继续上升，不再增强克制；
//   2) AI 进攻阈值 V18=0.38 → V19=0.39，新城市拉长出击线，AI 略趋激进；
//   3) 随机事件基础触发概率 V18=0.19 → V19=0.20，事件池扩至 397，略升触达；
//   4) 忠诚自然衰减维持 V18=0.22；
//   5) 新招募武将初始忠诚下限 V18=73 → V19=74，在野将池继续扩大；
//   6) 边镇沙漠/山地补给惩罚沿用 V18=0.32；
//   7) 战役模式胜利奖励倍率 V18=1.05 → V19=1.10，新战役战线更长，略增回报；
//   8) 战役模式敌军难度倍率 V18=1.0 → V19=1.05，新战役关略增难度。
// 注意：本常量仅作为数值配置集中声明，实际读取由 game.js/ai.js/tax.js 决定。
// ------------------------------------------------------------
export const V19_BALANCE = {
  // 兵种克制加成（维持 V18=0.27）
  counterBonus: 0.27,
  // 阵型克制加成（维持 V18=0.22）
  formationCounterBonus: 0.22,
  // AI 进攻阈值（V18=0.38 → V19=0.39）
  aiAttackThreshold: 0.39,
  // AI 防御权重（维持 V18=0.60）
  aiDefenseWeight: 0.60,
  // 随机事件基础触发概率（V18=0.19 → V19=0.20）
  eventBaseProbability: 0.20,
  // 忠诚自然衰减速率（维持 V18=0.22）
  loyaltyDecayRate: 0.22,
  // 新招募武将初始忠诚下限（V18=73 → V19=74）
  recruitInitialLoyalty: 74,
  // 基础税率上限（维持 V18=45%）
  maxTaxRate: 45,
  // 税率超过 35% 后每 1% 的民心衰减（维持 V18=0.08）
  taxOverThresholdMoraleDecay: 0.08,
  // 税率低于 20% 时每 1% 的民心增益（维持 V18=0.05）
  taxUnderThresholdMoraleBonus: 0.05,
  // 城市收入人口系数（维持 V18=0.075）
  incomePopFactor: 0.075,
  // 冬季粮草消耗系数（维持 V18=0.05）
  winterFoodWaste: 0.05,
  // 科技研究费用系数（维持 V18=0.9）
  techCostMult: 0.9,
  // 困难模式 AI 资源倍率（维持 V18=1.4）
  hardModeResourceMult: 1.4,
  // 简单模式 AI 资源倍率（维持 V18=0.68）
  easyModeResourceMult: 0.68,
  // 新将招募费用折扣（维持 V18=0.15）
  recruitCostDiscount: 0.15,
  // 城市维护费系数（维持 V18=0.95）
  cityUpkeepFactor: 0.95,
  // 沙漠地形行军补给惩罚（沿用 V18=0.32）
  desertSupplyPenalty: 0.32,
  // 战役模式：胜利奖励倍率（V18=1.05 → V19=1.10）
  campaignRewardMult: 1.10,
  // 战役模式：敌军兵力难度倍率（V18=1.0 → V19=1.05）
  campaignEnemyMult: 1.05
};

// ============================================================
// V20.0 — 平衡性调优常量
// ============================================================
// 说明：V20.0 新增 15 位武将、12 座边疆都护府、20 个随机事件（含灾害）、
//   5 个历史事件、1 个剧本（晋阳起兵）、5 个战役关卡。
//   内容量再扩后，对数值做以下微调：
//   1) 兵种克制加成维持 V19=0.27；
//   2) AI 进攻阈值 V19=0.39 → V20=0.40，西域/漠北边镇新增后 AI 更趋主动；
//   3) 随机事件基础触发概率 V19=0.20 → V20=0.21，灾害类事件加入后略升触达；
//   4) 忠诚自然衰减维持 V19=0.22；
//   5) 新招募武将初始忠诚下限 V19=74 → V20=75，在野将池继续扩大；
//   6) 战役模式胜利奖励倍率 V19=1.10 → V20=1.12；
//   7) 战役模式敌军难度倍率 V19=1.05 → V20=1.08；
//   8) 税率上限维持 V19=45%；
//   9) 沙漠地形行军补给惩罚 V19=0.32 → V20=0.34（西域都护府新增后强化戈壁补给压力）。
// 注意：本常量仅作为数值配置集中声明，实际读取由 game.js/ai.js/tax.js 决定。
// ------------------------------------------------------------
export const V20_BALANCE = {
  // 兵种克制加成（维持 V19=0.27）
  counterBonus: 0.27,
  // 阵型克制加成（维持 V19=0.22）
  formationCounterBonus: 0.22,
  // AI 进攻阈值（V19=0.39 → V20=0.40）
  aiAttackThreshold: 0.40,
  // AI 防御权重（维持 V19=0.60）
  aiDefenseWeight: 0.60,
  // 随机事件基础触发概率（V19=0.20 → V20=0.21）
  eventBaseProbability: 0.21,
  // 忠诚自然衰减速率（维持 V19=0.22）
  loyaltyDecayRate: 0.22,
  // 新招募武将初始忠诚下限（V19=74 → V20=75）
  recruitInitialLoyalty: 75,
  // 基础税率上限（维持 V19=45%）
  maxTaxRate: 45,
  // 税率超过 35% 后每 1% 的民心衰减（维持 V19=0.08）
  taxOverThresholdMoraleDecay: 0.08,
  // 税率低于 20% 时每 1% 的民心增益（维持 V19=0.05）
  taxUnderThresholdMoraleBonus: 0.05,
  // 城市收入人口系数（维持 V19=0.075）
  incomePopFactor: 0.075,
  // 冬季粮草消耗系数（维持 V19=0.05）
  winterFoodWaste: 0.05,
  // 科技研究费用系数（维持 V19=0.9）
  techCostMult: 0.9,
  // 困难模式 AI 资源倍率（维持 V19=1.4）
  hardModeResourceMult: 1.4,
  // 简单模式 AI 资源倍率（维持 V19=0.68）
  easyModeResourceMult: 0.68,
  // 新将招募费用折扣（维持 V19=0.15）
  recruitCostDiscount: 0.15,
  // 城市维护费系数（维持 V19=0.95）
  cityUpkeepFactor: 0.95,
  // 沙漠地形行军补给惩罚（V19=0.32 → V20=0.34）
  desertSupplyPenalty: 0.34,
  // 战役模式：胜利奖励倍率（V19=1.10 → V20=1.12）
  campaignRewardMult: 1.12,
  // 战役模式：敌军兵力难度倍率（V19=1.05 → V20=1.08）
  campaignEnemyMult: 1.08
};

// ============================================================
// V21.0 — 新武将技能注册（隋唐/突厥十五将，绑定已有技能 id）
// ============================================================
export const V210_NEW_GENERAL_SKILLS = {
  v21_xue_rengui:      ['mengjiang', 'xiaoyong_shanzhan'],     // 薛仁贵：三箭定天山
  v21_pei_xingjian:    ['mouliao_baichu', 'jingtu_tuzhi'],     // 裴行俭：碑纪碎叶
  v21_zhang_gongjin:   ['mouliao_baichu', 'guanlong_jituan'],  // 张公谨：投龟定议
  v21_hou_junji:       ['mengjiang', 'dudu_zhongwai'],         // 侯君集：灭高昌
  v21_niu_jinda:       ['mengjiang', 'xiaoyong_shanzhan'],     // 牛进达：征海东
  v21_qian_jiulong:    ['mengjiang', 'xiaoyong_shanzhan'],     // 钱九陇：元从功臣
  v21_fan_xing:        ['mengjiang', 'xiaoyong_shanzhan'],     // 樊兴：从平高昌
  v21_gongsun_wuda:    ['mengjiang', 'xiaoyong_shanzhan'],     // 公孙武达：陷阵先登
  v21_mai_mengcai:     ['mengjiang', 'xiaoyong_shanzhan'],     // 麦孟才：志复仇
  v21_wang_junkuo:     ['xiaoxiong', 'mengjiang'],              // 王君廓：骁将反复
  v21_luo_shixin:      ['xiaoyong_shanzhan', 'mengjiang'],     // 罗士信：少年死节
  v21_qiu_xinggong:    ['mengjiang', 'xiaoyong_shanzhan'],     // 丘行恭：马前拔矢
  v21_yin_kaishan:     ['mouliao_baichu', 'guanlong_jituan'],  // 殷开山：十八学士
  v21_tang_jian:       ['mouliao_baichu', 'jingtu_tuzhi'],     // 唐俭：使定突厥
  v21_ashi_helu:       ['xiaoxiong', 'mengjiang']               // 阿史那贺鲁：沙钵罗可汗
};
Object.assign(NEW_GENERAL_SKILLS, V210_NEW_GENERAL_SKILLS);

// ============================================================
// V21.0 — 平衡性调优常量
// ============================================================
// 说明：V21.0 新增 15 位武将、12 座西域丝路城市、20 个随机事件、5 个历史事件、1 个剧本、5 个战役关卡。
//   西域沙漠城市增多、丝路贸易事件增加，对数值做以下微调：
//   1) 兵种克制加成维持 V20=0.27，名将密度继续上升，不再增强克制；
//   2) AI 进攻阈值 V20=0.40 → V21=0.41，西域城邦众多后 AI 略趋激进；
//   3) 随机事件基础触发概率 V20=0.21 → V21=0.22，事件池再扩后略升触达；
//   4) 忠诚自然衰减速率维持 V20=0.22；
//   5) 新招募武将初始忠诚下限 V20=75 → V21=76，在野将池继续扩大；
//   6) 沙漠地形行军补给惩罚 V20=0.34 → V21=0.36，西域新城多在沙漠；
//   7) 战役模式胜利奖励倍率 V20=1.12 → V21=1.14；
//   8) 战役模式敌军难度倍率 V20=1.08 → V21=1.10；
//   9) 税率上限维持 V20=45%。
// 注意：本常量仅作为数值配置集中声明，实际读取由 game.js/ai.js/tax.js 决定。
// ------------------------------------------------------------
export const V21_BALANCE = {
  // 兵种克制加成（维持 V20=0.27）
  counterBonus: 0.27,
  // 阵型克制加成（维持 V20=0.22）
  formationCounterBonus: 0.22,
  // AI 进攻阈值（V20=0.40 → V21=0.41）
  aiAttackThreshold: 0.41,
  // AI 防御权重（维持 V20=0.60）
  aiDefenseWeight: 0.60,
  // 随机事件基础触发概率（V20=0.21 → V21=0.22）
  eventBaseProbability: 0.22,
  // 忠诚自然衰减速率（维持 V20=0.22）
  loyaltyDecayRate: 0.22,
  // 新招募武将初始忠诚下限（V20=75 → V21=76）
  recruitInitialLoyalty: 76,
  // 基础税率上限（维持 V20=45%）
  maxTaxRate: 45,
  // 税率超过 35% 后每 1% 的民心衰减（维持 V20=0.08）
  taxOverThresholdMoraleDecay: 0.08,
  // 税率低于 20% 时每 1% 的民心增益（维持 V20=0.05）
  taxUnderThresholdMoraleBonus: 0.05,
  // 城市收入人口系数（维持 V20=0.075）
  incomePopFactor: 0.075,
  // 冬季粮草消耗系数（维持 V20=0.05）
  winterFoodWaste: 0.05,
  // 科技研究费用系数（维持 V20=0.9）
  techCostMult: 0.9,
  // 困难模式 AI 资源倍率（维持 V20=1.4）
  hardModeResourceMult: 1.4,
  // 简单模式 AI 资源倍率（维持 V20=0.68）
  easyModeResourceMult: 0.68,
  // 新将招募费用折扣（维持 V20=0.15）
  recruitCostDiscount: 0.15,
  // 城市维护费系数（维持 V20=0.95）
  cityUpkeepFactor: 0.95,
  // 沙漠地形行军补给惩罚（V20=0.34 → V21=0.36，西域新城增多）
  desertSupplyPenalty: 0.36,
  // 战役模式：胜利奖励倍率（V20=1.12 → V21=1.14）
  campaignRewardMult: 1.14,
  // 战役模式：敌军兵力难度倍率（V20=1.08 → V21=1.10）
  campaignEnemyMult: 1.10
};

// ============================================================
// V22.0 — 新武将技能注册（安史之乱/贞观文臣十五将，绑定已有技能 id）
// ============================================================
export const V220_NEW_GENERAL_SKILLS = {
  v22_guo_ziyi:      ['wangzhe_qiqi', 'dudu_zhongwai'],       // 郭子仪：再造唐室
  v22_li_guangbi:   ['mengjiang', 'shoucheng_mingjiang'],     // 李光弼：中兴第一
  v22_pugu_huaien:  ['mengjiang', 'xiaoyong_shanzhan'],       // 仆固怀恩：一门死国
  v22_geshuhan:     ['mengjiang', 'xiaoyong_shanzhan'],       // 哥舒翰：青海石堡
  v22_gaoxianzhi:   ['mengjiang', 'jingtu_tuzhi'],           // 高仙芝：翻越葱岭
  v22_fengchangqing:['mouliao_baichu', 'jingtu_tuzhi'],       // 封常清：安西判官
  v22_zhang_xun:    ['shoucheng_mingjiang', 'mouliao_baichu'], // 张巡：睢阳死节
  v22_nanji_yun:    ['xiaoyong_shanzhan', 'mengjiang'],       // 南霁云：断指乞师
  v22_an_lushan:    ['xiaoxiong', 'mengjiang'],               // 安禄山：范阳叛
  v22_shi_siming:   ['xiaoxiong', 'mengjiang'],               // 史思明：继乱
  v22_yu_shinan:    ['mouliao_baichu', 'rujiang'],            // 虞世南：五绝文臣
  v22_chu_liang:    ['mouliao_baichu', 'rujiang'],            // 褚亮：十八学士
  v22_wen_yubo:     ['mouliao_baichu', 'guanlong_jituan'],    // 温彦博：中书令
  v22_ma_zhou:      ['mouliao_baichu', 'jingtu_tuzhi'],       // 马周：布衣宰相
  v22_cen_wenben:   ['mouliao_baichu', 'guanlong_jituan']     // 岑文本：诏诰出手
};
Object.assign(NEW_GENERAL_SKILLS, V220_NEW_GENERAL_SKILLS);

// ============================================================
// V22.0 — 平衡性调优常量
// ============================================================
// 说明：V22.0 新增 15 位武将、12 座河北/中原城市、20 个随机事件、5 个历史事件、1 个剧本、5 个战役关卡。
//   安史之乱剧本开启后，藩镇割据、河北新战场地形增多，对数值做以下微调：
//   1) 兵种克制加成维持 V21=0.27，名将密度继续上升，不再增强；
//   2) AI 进攻阈值 V21=0.41 → V22=0.42，河北中原新战场更密；
//   3) 随机事件基础触发概率 V21=0.22 → V22=0.23，事件池再扩后略升触达；
//   4) 忠诚自然衰减速率维持 V21=0.22；
//   5) 新招募武将初始忠诚下限 V21=76 → V22=77，在野将池继续扩大；
//   6) 沙漠地形行军补给惩罚维持 V21=0.36；
//   7) 战役模式胜利奖励倍率 V21=1.14 → V22=1.16；
//   8) 战役模式敌军难度倍率 V21=1.10 → V22=1.12；
//   9) 税率上限维持 V21=45%。
// 注意：本常量仅作为数值配置集中声明，实际读取由 game.js/ai.js/tax.js 决定。
// ------------------------------------------------------------
export const V22_BALANCE = {
  // 兵种克制加成（维持 V21=0.27）
  counterBonus: 0.27,
  // 阵型克制加成（维持 V21=0.22）
  formationCounterBonus: 0.22,
  // AI 进攻阈值（V21=0.41 → V22=0.42）
  aiAttackThreshold: 0.42,
  // AI 防御权重（维持 V21=0.60）
  aiDefenseWeight: 0.60,
  // 随机事件基础触发概率（V21=0.22 → V22=0.23）
  eventBaseProbability: 0.23,
  // 忠诚自然衰减速率（维持 V21=0.22）
  loyaltyDecayRate: 0.22,
  // 新招募武将初始忠诚下限（V21=76 → V22=77）
  recruitInitialLoyalty: 77,
  // 基础税率上限（维持 V21=45%）
  maxTaxRate: 45,
  // 税率超过 35% 后每 1% 的民心衰减（维持 V21=0.08）
  taxOverThresholdMoraleDecay: 0.08,
  // 税率低于 20% 时每 1% 的民心增益（维持 V21=0.05）
  taxUnderThresholdMoraleBonus: 0.05,
  // 城市收入人口系数（维持 V21=0.075）
  incomePopFactor: 0.075,
  // 冬季粮草消耗系数（维持 V21=0.05）
  winterFoodWaste: 0.05,
  // 科技研究费用系数（维持 V21=0.9）
  techCostMult: 0.9,
  // 困难模式 AI 资源倍率（维持 V21=1.4）
  hardModeResourceMult: 1.4,
  // 简单模式 AI 资源倍率（维持 V21=0.68）
  easyModeResourceMult: 0.68,
  // 新将招募费用折扣（维持 V21=0.15）
  recruitCostDiscount: 0.15,
  // 城市维护费系数（维持 V21=0.95）
  cityUpkeepFactor: 0.95,
  // 沙漠地形行军补给惩罚（维持 V21=0.36）
  desertSupplyPenalty: 0.36,
  // 战役模式：胜利奖励倍率（V21=1.14 → V22=1.16）
  campaignRewardMult: 1.16,
  // 战役模式：敌军兵力难度倍率（V21=1.10 → V22=1.12）
  campaignEnemyMult: 1.12
};

// ============================================================
// V23.0 — 新武将技能注册（中唐藩镇/出将入相十五将，绑定已有技能 id）
// ============================================================
export const V230_NEW_GENERAL_SKILLS = {
  v23_li_daozong:      ['mengjiang', 'jingtu_tuzhi'],          // 李道宗：江夏王
  v23_ashi_na_heer:    ['mengjiang', 'xiaoyong_shanzhan'],      // 阿史那社尔：突厥归唐
  v23_qibi_heli:       ['mengjiang', 'xiaoyong_shanzhan'],      // 契苾何力：铁勒名将
  v23_xue_wanche:      ['mengjiang', 'xiaoyong_shanzhan'],      // 薛万彻：尚主骁将
  v23_heichi_changzhi: ['shoucheng_mingjiang', 'mengjiang'],   // 黑齿常之：御吐蕃
  v23_wang_xiaojie:    ['mengjiang', 'jingtu_tuzhi'],          // 王孝杰：复四镇
  v23_wang_zhongsi:    ['wangzhe_qiqi', 'dudu_zhongwai'],       // 王忠嗣：四节度使
  v23_li_siye:         ['xiaoyong_shanzhan', 'mengjiang'],      // 李嗣业：陌刀将
  v23_hun_jian:        ['mengjiang', 'shoucheng_mingjiang'],   // 浑瑊：奉天死守
  v23_ma_sui:          ['mouliao_baichu', 'mengjiang'],         // 马燧：平河中
  v23_li_sheng:        ['wangzhe_qiqi', 'dudu_zhongwai'],       // 李晟：复长安
  v23_li_su:           ['mouliao_baichu', 'xiaoyong_shanzhan'], // 李愬：雪夜入蔡
  v23_li_guangyan:     ['mengjiang', 'xiaoyong_shanzhan'],      // 李光颜：平蔡先锋
  v23_tian_chengsi:    ['xiaoxiong', 'mengjiang'],              // 田承嗣：魏博牙兵
  v23_li_baochen:      ['xiaoxiong', 'mengjiang']               // 李宝臣：成德割据
};
Object.assign(NEW_GENERAL_SKILLS, V230_NEW_GENERAL_SKILLS);

// ============================================================
// V23.0 — 平衡性调优常量
// ============================================================
// 说明：V23.0 新增 15 位武将、12 座中原漕运/江南海贸城市、20 个随机事件、5 个历史事件、1 个剧本、5 个战役关卡。
//   元和削藩剧本开启后，方镇牙兵、科举选官、两税法等新内容上线，对数值做以下微调：
//   1) 兵种克制加成维持 V22=0.27，名将密度继续上升，不再增强；
//   2) AI 进攻阈值 V22=0.42 → V23=0.43，中原江南新战场地形更密；
//   3) 随机事件基础触发概率 V22=0.23 → V23=0.24，事件池再扩后略升触达；
//   4) 忠诚自然衰减速率维持 V22=0.22；
//   5) 新招募武将初始忠诚下限 V22=77 → V23=78，在野将池继续扩大；
//   6) 沙漠地形行军补给惩罚维持 V22=0.36；
//   7) 战役模式胜利奖励倍率 V22=1.16 → V23=1.18；
//   8) 战役模式敌军难度倍率 V22=1.12 → V23=1.14；
//   9) 税率上限维持 V22=45%；
//  10) 两税法/榷茶等经济事件新增后，城市商业收入系数 V22=0.075 → V23=0.078。
// 注意：本常量仅作为数值配置集中声明，实际读取由 game.js/ai.js/tax.js 决定。
// ------------------------------------------------------------
export const V23_BALANCE = {
  // 兵种克制加成（维持 V22=0.27）
  counterBonus: 0.27,
  // 阵型克制加成（维持 V22=0.22）
  formationCounterBonus: 0.22,
  // AI 进攻阈值（V22=0.42 → V23=0.43）
  aiAttackThreshold: 0.43,
  // AI 防御权重（维持 V22=0.60）
  aiDefenseWeight: 0.60,
  // 随机事件基础触发概率（V22=0.23 → V23=0.24）
  eventBaseProbability: 0.24,
  // 忠诚自然衰减速率（维持 V22=0.22）
  loyaltyDecayRate: 0.22,
  // 新招募武将初始忠诚下限（V22=77 → V23=78）
  recruitInitialLoyalty: 78,
  // 基础税率上限（维持 V22=45%）
  maxTaxRate: 45,
  // 税率超过 35% 后每 1% 的民心衰减（维持 V22=0.08）
  taxOverThresholdMoraleDecay: 0.08,
  // 税率低于 20% 时每 1% 的民心增益（维持 V22=0.05）
  taxUnderThresholdMoraleBonus: 0.05,
  // 城市收入人口系数（V22=0.075 → V23=0.078，两税法/榷茶上线）
  incomePopFactor: 0.078,
  // 冬季粮草消耗系数（维持 V22=0.05）
  winterFoodWaste: 0.05,
  // 科技研究费用系数（维持 V22=0.9）
  techCostMult: 0.9,
  // 困难模式 AI 资源倍率（维持 V22=1.4）
  hardModeResourceMult: 1.4,
  // 简单模式 AI 资源倍率（维持 V22=0.68）
  easyModeResourceMult: 0.68,
  // 新将招募费用折扣（维持 V22=0.15）
  recruitCostDiscount: 0.15,
  // 城市维护费系数（维持 V22=0.95）
  cityUpkeepFactor: 0.95,
  // 沙漠地形行军补给惩罚（维持 V22=0.36）
  desertSupplyPenalty: 0.36,
  // 战役模式：胜利奖励倍率（V22=1.16 → V23=1.18）
  campaignRewardMult: 1.18,
  // 战役模式：敌军兵力难度倍率（V22=1.12 → V23=1.14）
  campaignEnemyMult: 1.14
};

// ============================================================
// V24.0 — 新武将技能注册（唐末五代·黄巢起义/梁晋争霸十五将，绑定已有技能 id）
// ============================================================
export const V240_NEW_GENERAL_SKILLS = {
  v24_huang_chao:    ['xiaoxiong', 'mengjiang'],              // 黄巢：大齐皇帝
  v24_zhu_wen:        ['xiaoxiong', 'dudu_zhongwai'],          // 朱温：后梁太祖
  v24_li_keyong:      ['wangzhe_qiqi', 'mengjiang'],           // 李克用：沙陀晋王
  v24_li_cunxu:       ['wangzhe_qiqi', 'xiaoyong_shanzhan'], // 李存勖：后唐庄宗
  v24_qian_liu:       ['mouliao_baichu', 'jingtu_tuzhi'],     // 钱镠：吴越王
  v24_yang_xingmi:    ['mengjiang', 'mouliao_baichu'],         // 杨行密：吴王
  v24_wang_jian:      ['xiaoxiong', 'mouliao_baichu'],         // 王建：前蜀高祖
  v24_ma_yin:         ['mouliao_baichu', 'jingtu_tuzhi'],      // 马殷：楚王
  v24_wang_shenzhi:   ['mouliao_baichu', 'jingtu_tuzhi'],      // 王审知：闽王
  v24_gao_pian:       ['mengjiang', 'jingtu_tuzhi'],           // 高骈：破南诏
  v24_zhou_dewei:     ['mengjiang', 'shoucheng_mingjiang'],    // 周德威：柏乡灭梁
  v24_ge_congzhou:    ['mengjiang', 'xiaoyong_shanzhan'],      // 葛从周：后梁名将
  v24_guo_chongtao:   ['mouliao_baichu', 'jingtu_tuzhi'],      // 郭崇韬：灭梁平蜀
  v24_zhang_quanyi:   ['mouliao_baichu', 'rujiang'],            // 张全义：洛阳劝农
  v24_li_maozhen:     ['xiaoxiong', 'mengjiang']                // 李茂贞：岐王
};
Object.assign(NEW_GENERAL_SKILLS, V240_NEW_GENERAL_SKILLS);

// ============================================================
// V24.0 — 平衡性调优常量
// ============================================================
// 说明：V24.0 新增 15 位武将、12 座岭南福建/黔滇城市、20 个随机事件、5 个历史事件、1 个剧本、5 个战役关卡。
//   唐末五代·梁晋争霸剧本开启后，藩镇牙兵、十国割据、科举选官深化等新内容上线，对数值做以下微调：
//   1) 兵种克制加成维持 V23=0.27，名将密度继续上升，不再增强；
//   2) AI 进攻阈值 V23=0.43 → V24=0.44，岭南福建新城战场地形更密；
//   3) 随机事件基础触发概率 V23=0.24 → V24=0.25，事件池再扩后略升触达；
//   4) 忠诚自然衰减速率维持 V23=0.22；
//   5) 新招募武将初始忠诚下限 V23=78 → V24=79，在野将池继续扩大；
//   6) 沙漠地形行军补给惩罚维持 V23=0.36；
//   7) 战役模式胜利奖励倍率 V23=1.18 → V24=1.20；
//   8) 战役模式敌军难度倍率 V23=1.14 → V24=1.16；
//   9) 税率上限维持 V23=45%；
//  10) 岭南福建海贸事件新增后，城市商业收入系数 V23=0.078 → V24=0.080。
// 注意：本常量仅作为数值配置集中声明，实际读取由 game.js/ai.js/tax.js 决定。
// ------------------------------------------------------------
export const V24_BALANCE = {
  // 兵种克制加成（维持 V23=0.27）
  counterBonus: 0.27,
  // 阵型克制加成（维持 V23=0.22）
  formationCounterBonus: 0.22,
  // AI 进攻阈值（V23=0.43 → V24=0.44）
  aiAttackThreshold: 0.44,
  // AI 防御权重（维持 V23=0.60）
  aiDefenseWeight: 0.60,
  // 随机事件基础触发概率（V23=0.24 → V24=0.25）
  eventBaseProbability: 0.25,
  // 忠诚自然衰减速率（维持 V23=0.22）
  loyaltyDecayRate: 0.22,
  // 新招募武将初始忠诚下限（V23=78 → V24=79）
  recruitInitialLoyalty: 79,
  // 基础税率上限（维持 V23=45%）
  maxTaxRate: 45,
  // 税率超过 35% 后每 1% 的民心衰减（维持 V23=0.08）
  taxOverThresholdMoraleDecay: 0.08,
  // 税率低于 20% 时每 1% 的民心增益（维持 V23=0.05）
  taxUnderThresholdMoraleBonus: 0.05,
  // 城市收入人口系数（V23=0.078 → V24=0.080，岭南海贸上线）
  incomePopFactor: 0.080,
  // 冬季粮草消耗系数（维持 V23=0.05）
  winterFoodWaste: 0.05,
  // 科技研究费用系数（维持 V23=0.9）
  techCostMult: 0.9,
  // 困难模式 AI 资源倍率（维持 V23=1.4）
  hardModeResourceMult: 1.4,
  // 简单模式 AI 资源倍率（维持 V23=0.68）
  easyModeResourceMult: 0.68,
  // 新将招募费用折扣（维持 V23=0.15）
  recruitCostDiscount: 0.15,
  // 城市维护费系数（维持 V23=0.95）
  cityUpkeepFactor: 0.95,
  // 沙漠地形行军补给惩罚（维持 V23=0.36）
  desertSupplyPenalty: 0.36,
  // 战役模式：胜利奖励倍率（V23=1.18 → V24=1.20）
  campaignRewardMult: 1.20,
  // 战役模式：敌军兵力难度倍率（V23=1.14 → V24=1.16）
  campaignEnemyMult: 1.16
};
