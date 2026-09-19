// ============================================================
// imperial_exam.js — V8.0 科举系统（V22.0.0 科举/选官系统深化版）
//
// 历史背景：南北朝后期九品中正制衰落，科举萌芽。南朝已有射策、明经等科，
// 北齐允许士子"怀牒自试"，北周苏绰废门荫以贤愚定高下。
// 隋文帝废九品中正，隋炀帝始建进士科——科举雏形出现。
//
// 游戏设计：
//  - 每3回合（春季）举行一次科举，太学≥3级解锁
//  - 三科：明经（文臣）/进士（综合）/武举（武将）
//  - 从在野武将中选拔，前三名授官，直接加入玩家势力
//  - 状元全属性+5忠诚+20；榜眼+3+15；探花+2+10
//  - 太学等级影响选拔人数与人才质量加成
//
// V15.0 新增三级考试流程：乡试 → 会试 → 殿试
//  - 乡试（地方）：基础选拔，产出普通在野武将
//  - 会试（礼部）：中级选拔，产出中等品质武将
//  - 殿试（御前）：最高级选拔，可能产出高品质传奇武将
//  - 考试频率：每3年一次（EXAM_INTERVAL=3）
//  - 新增 API：startExam(examType) / runExam(game) / getExamResult()
//
// V22.0.0 科举/选官系统深化：
//  - 殿试细节：状元/榜眼/探花分授不同官职与加成，状元可入翰林院
//  - 同年网络：同榜进士结为「同年」，互相加成（忠诚/政治）
//  - 科举舞弊：概率事件，被发觉则主考贬官、考生禁考
//  - 翰林院：状元入馆，每回合产出文化值
//  - 武举：startMilitaryExam 选拔武将，重统帅/武力
//  - 科举周期：每3年一次（沿用 EXAM_INTERVAL=3）
//  - 选官系统：察举制 / 九品中正制 / 模式切换 / 官员考核
//  - 新 API：startImperialExam / getTopScholars / getFellowNetwork /
//            startMilitaryExam / recommendScholar / getOfficialRank /
//            evaluateOfficial / switchRecruitmentMode
// ============================================================
import { EXAM_SUBJECTS, EXAM_HONORS, EXAM_INTERVAL, EXAM_BUILDING_REQ, EXAM_BUILDING_MIN_LEVEL, FACTIONS } from './data.js';

// V15.0：三级考试定义
export const EXAM_LEVELS = {
  xiangshi: {
    id: 'xiangshi', name: '乡试', order: 1,
    candidateMult: 0.6, qualityBonus: 0,
    description: '地方选拔，秀才举人。'
  },
  huishi: {
    id: 'huishi', name: '会试', order: 2,
    candidateMult: 0.8, qualityBonus: 3,
    description: '礼部会试，贡士及第。'
  },
  dianshi: {
    id: 'dianshi', name: '殿试', order: 3,
    candidateMult: 1.0, qualityBonus: 8,
    description: '御前策问，进士出身，或出传奇。'
  }
};

// ---------- V22.0.0 新增：殿试鼎三甲官职与加成 ----------
// 状元：翰林院修撰（从六品），文臣清要之职
// 榜眼：翰林院编修（正七品）
// 探花：翰林院检讨（从七品）
export const V22_DIANSHI_OFFICE = {
  zhuangyuan: { office: '翰林院修撰', attrBonus: 5, loyaltyBonus: 25, culturePerTurn: 2, joinHanlin: true },
  bangyan:    { office: '翰林院编修', attrBonus: 3, loyaltyBonus: 15, culturePerTurn: 1, joinHanlin: false },
  tanhua:     { office: '翰林院检讨', attrBonus: 2, loyaltyBonus: 10, culturePerTurn: 1, joinHanlin: false }
};

// ---------- V22.0.0 新增：选官模式 ----------
// keju  = 科举取士（考试选才，出身寒门可仕）
// cha   = 察举制（地方官推荐，重名望举主）
// zhongzheng = 九品中正制（按家世/道德/才能定品，门第为重）
export const V22_RECRUIT_MODES = {
  keju: {
    id: 'keju', name: '科举取士',
    desc: '分科考试，怀牒自试。寒门可进，人才质量稳定，三年一开科。',
    talentMult: 1.0, costGold: 500, recommendPerYear: 0
  },
  cha: {
    id: 'cha', name: '察举征辟',
    desc: '州郡举孝廉秀才，每年可荐1~2人。举主与被举者形成故吏关系。',
    talentMult: 0.9, costGold: 200, recommendPerYear: 1
  },
  zhongzheng: {
    id: 'zhongzheng', name: '九品中正',
    desc: '中正官按家世/道德/才定九品，上品无寒门，下品无势族。',
    talentMult: 0.8, costGold: 100, recommendPerYear: 1
  }
};

// ---------- V22.0.0 新增：科举舞弊概率 ----------
export const V22_FRAUD_CHANCE = 0.08;       // 每场科举有8%概率出现舞弊
export const V22_FRAUD_CAUGHT = 0.50;       // 舞弊被发觉的概率
export const V22_BAN_TURNS = 12;            // 舞弊考生禁考回合数

export class ImperialExamSystem {
  constructor() {
    this.nextExamTurn = EXAM_INTERVAL + 1;   // 第4回合首次科举（开局3年内）
    this.lastResults = null;                  // 上次科举结果
    this.examCount = 0;                       // 已举办次数
    this.currentLevel = 'dianshi';            // V15.0：当前考试级别（默认殿试=完整科举）
    this.examHistory = [];                    // V15.0：历次考试记录

    // ---------- V22.0.0 新增状态 ----------
    this.v22_recruitMode = 'keju';            // 当前选官模式
    this.v22_fellowGroups = [];               // 同年网络：[{turn, subject, members:[generalId]}]
    this.v22_hanlin = [];                      // 翰林院学士 generalId 列表（状元领衔）
    this.v22_banList = {};                     // 禁考名单 { generalId: 解禁回合 }
    this.v22_officerRank = {};                 // 九品中正品级 { generalId: {grade, bg, mor, tal, turn} }
    this.v22_lastEvaluateTurn = 0;             // 上次官员考核回合
    this.v22_recommendUsed = {};               // { factionId: { year: count } }
    this.v22_stats = {
      zhuangyuan: 0,           // 状元总数
      militaryTop: 0,           // 武举魁首数
      recommended: 0,           // 察举推荐数
      fraudCaught: 0,           // 舞弊被破获次数
      promoted: 0,              // 考核晋升人数
      demoted: 0,               // 考核贬官人数
      hanlinCulture: 0,         // 翰林院累计产出文化
      fellowBonds: 0            // 缔结同年对数
    };
  }

  // V15.0：开始指定级别的考试
  // examType: xiangshi / huishi / dianshi
  startExam(examType = 'dianshi') {
    const lv = EXAM_LEVELS[examType];
    if (!lv) return { ok: false, msg: '未知考试级别' };
    this.currentLevel = examType;
    return { ok: true, msg: `已启动【${lv.name}】`, level: lv };
  }

  // V15.0：获取最近一次考试结果
  getExamResult() {
    return this.lastResults;
  }

  // 检查是否到了科举时间（春季=seasonIdx===0，且回合数匹配）
  isExamDue(game) {
    if (game.turn < this.nextExamTurn) return false;
    // 太学≥3级解锁：检查玩家首都是否有太学
    const capital = game.cities.get(FACTIONS[game.playerFaction]?.capital);
    if (!capital) return false;
    const txLevel = capital.buildings?.[EXAM_BUILDING_REQ] || 0;
    return txLevel >= EXAM_BUILDING_MIN_LEVEL;
  }

  // 获取太学等级（影响人才质量）
  _getTaixueLevel(game) {
    const capital = game.cities.get(FACTIONS[game.playerFaction]?.capital);
    return capital?.buildings?.[EXAM_BUILDING_REQ] || 0;
  }

  // 计算某武将在某科目的成绩
  _calcScore(gen, subjectId) {
    const subj = EXAM_SUBJECTS[subjectId];
    if (!subj) return 0;
    const w = subj.scoreWeights;
    // 基础分 = 加权属性和（属性范围30~96，加权后约30~96）
    const base = (gen.politics * w.politics + gen.intel * w.intel +
                  gen.command * w.command + gen.force * w.force);
    // 随机系数 0.85~1.15
    const rand = 0.85 + Math.random() * 0.30;
    return Math.round(base * rand);
  }

  // V22.0.0：判断某武将是否在禁考期
  _isBanned(genId, game) {
    const until = this.v22_banList[genId];
    return until != null && game.turn < until;
  }

  // V22.0.0：本场科举是否发生舞弊并被发觉
  _rollFraud(game, selected) {
    if (Math.random() >= V22_FRAUD_CHANCE) return null;
    // 选定一名作弊者（从进士中随机）
    const pool = selected.slice(2);
    if (pool.length === 0) return null;
    const cheater = pool[Math.floor(Math.random() * pool.length)].gen;
    const caught = Math.random() < V22_FRAUD_CAUGHT;
    if (!caught) {
      // 未被发觉：作弊者成绩虚高，事后略降忠诚
      if (game.pushLog) game.pushLog(`科场传闻：${cheater.name}似有夹带，然未得实据。`);
      return { caught: false, cheater };
    }
    // 被发觉：主考贬官，考生禁考
    this.v22_stats.fraudCaught++;
    this.v22_banList[cheater.id] = game.turn + V22_BAN_TURNS;
    // 主考 = 朝中政治最高者（非君主），忠诚-15、政治-5
    const court = (game.getFactionGenerals(game.playerFaction) || [])
      .filter(g => g.role !== '君主' && g.faction === game.playerFaction)
      .sort((a, b) => b.politics - a.politics);
    const examiner = court[0] || null;
    if (examiner) {
      examiner.loyalty = Math.max(0, examiner.loyalty - 15);
      examiner.politics = Math.max(1, examiner.politics - 5);
      if (game.pushLog) game.pushLog(`◆ 科举舞弊：${cheater.name}夹带作弊，主考${examiner.name}失察贬官，${cheater.name}禁考${V22_BAN_TURNS}回合！`);
    } else {
      if (game.pushLog) game.pushLog(`◆ 科举舞弊：${cheater.name}夹带作弊，革去出身，禁考${V22_BAN_TURNS}回合！`);
    }
    // 作弊者逐出朝廷、忠诚崩落
    cheater.loyalty = Math.max(0, cheater.loyalty - 50);
    cheater.examTitle = '舞弊革黜';
    return { caught: true, cheater, examiner };
  }

  // 执行科举考试
  runExam(game, subjectId = 'jinshi') {
    const subject = EXAM_SUBJECTS[subjectId] || EXAM_SUBJECTS.jinshi;
    const taixueLv = this._getTaixueLevel(game);
    // V15.0：根据考试级别调整候选人数与质量
    const lv = EXAM_LEVELS[this.currentLevel] || EXAM_LEVELS.dianshi;
    // 太学每级增加选拔人数（基础5人，每级+1，最多10人），再乘以级别系数
    const candidateCount = Math.min(10, Math.round((5 + taixueLv) * (lv.candidateMult || 1)));

    // 从在野武将中选拔候选人（V22：排除禁考者）
    const idle = game.getIdleGenerals().filter(g => !this._isBanned(g.id, game));
    if (idle.length === 0) {
      this.lastResults = {
        subject: subject.name, zhuangyuan: null, bangyan: null, tanhua: null,
        jinshi: [], message: '今岁科举，在野无人应考，竟无一人及第。'
      };
      this.nextExamTurn = game.turn + EXAM_INTERVAL;
      return this.lastResults;
    }

    // 计算所有在野武将成绩，取前 candidateCount 名
    // V15.0：殿试级别给予质量加成（可能产出高品质武将）
    const qualityBonus = lv.qualityBonus || 0;
    const scored = idle.map(g => ({
      gen: g,
      score: this._calcScore(g, subjectId) + qualityBonus
    })).sort((a, b) => b.score - a.score);

    const selected = scored.slice(0, Math.min(candidateCount, scored.length));

    // 前三名
    const zhuangyuan = selected[0] || null;
    const bangyan = selected[1] || null;
    const tanhua = selected[2] || null;
    const jinshi = selected.slice(3); // 普通进士

    // 放榜：前三名加入玩家势力并获得加成
    const honored = [];
    const applyHonor = (entry, honorKey) => {
      if (!entry) return;
      const honor = EXAM_HONORS[honorKey];
      const gen = entry.gen;
      gen.politics += honor.attrBonus;
      gen.intel += honor.attrBonus;
      gen.command += honor.attrBonus;
      gen.force += honor.attrBonus;
      gen.loyalty = Math.min(100, gen.loyalty + honor.loyaltyBonus);
      gen.faction = game.playerFaction;
      const capital = game.cities.get(FACTIONS[game.playerFaction].capital);
      gen.location = capital ? capital.id : null;
      gen.examTitle = honor.title; // 科举出身标记
      honored.push({ name: gen.name, rank: honor.rank, score: entry.score, title: honor.title });
      game.pushLog(`科举${honor.rank}：${gen.name}（成绩${entry.score}），授官入仕！`);
    };

    applyHonor(zhuangyuan, 'zhuangyuan');
    applyHonor(bangyan, 'bangyan');
    applyHonor(tanhua, 'tanhua');

    // V22.0.0：殿试鼎三甲分授官职，状元入翰林院
    const cohortMembers = [];
    const applyDianshiOffice = (entry, key) => {
      if (!entry) return;
      const gen = entry.gen;
      const off = V22_DIANSHI_OFFICE[key];
      if (!off) return;
      gen.office = off.office;
      gen.loyalty = Math.min(100, gen.loyalty + off.loyaltyBonus);
      if (off.joinHanlin && !this.v22_hanlin.includes(gen.id)) {
        this.v22_hanlin.push(gen.id);
        this.v22_stats.zhuangyuan++;
        game.pushLog(`翰林院：${gen.name}以状元及第，入翰林院修撰，掌国史、备顾问。`);
      }
      cohortMembers.push(gen.id);
    };
    applyDianshiOffice(zhuangyuan, 'zhuangyuan');
    applyDianshiOffice(bangyan, 'bangyan');
    applyDianshiOffice(tanhua, 'tanhua');

    // 普通进士：也加入玩家势力但无属性加成
    for (const entry of jinshi) {
      const gen = entry.gen;
      gen.faction = game.playerFaction;
      gen.loyalty = Math.min(100, gen.loyalty + 10);
      const capital = game.cities.get(FACTIONS[game.playerFaction].capital);
      gen.location = capital ? capital.id : null;
      gen.examTitle = '进士';
      honored.push({ name: gen.name, rank: '进士', score: entry.score, title: null });
      cohortMembers.push(gen.id);
      game.pushLog(`科举进士：${gen.name}（成绩${entry.score}），赐出身。`);
    }

    // V22.0.0：缔结「同年」网络（同榜进士互为年谊）
    let fraud = null;
    if (cohortMembers.length >= 2) {
      this.v22_fellowGroups.push({
        turn: game.turn, subject: subject.name, members: cohortMembers.slice()
      });
      this.v22_stats.fellowBonds += Math.floor(cohortMembers.length * (cohortMembers.length - 1) / 2);
      if (game.pushLog) game.pushLog(`◆ 同榜进士 ${cohortMembers.length} 人结为「同年」，年谊相维，仕途互援。`);
    }

    // V22.0.0：舞弊判定（在放榜后）
    fraud = this._rollFraud(game, selected);

    this.examCount++;
    this.nextExamTurn = game.turn + EXAM_INTERVAL;
    this.lastResults = {
      subject: subject.name,
      level: lv.name,  // V15.0：考试级别
      zhuangyuan: zhuangyuan ? { name: zhuangyuan.gen.name, score: zhuangyuan.score } : null,
      bangyan: bangyan ? { name: bangyan.gen.name, score: bangyan.score } : null,
      tanhua: tanhua ? { name: tanhua.gen.name, score: tanhua.score } : null,
      jinshi: jinshi.map(e => ({ name: e.gen.name, score: e.score })),
      honored,
      fraud,  // V22.0.0：舞弊结果
      message: `【${lv.name}·${subject.name}】放榜！状元：${zhuangyuan ? zhuangyuan.gen.name : '无'}。`
    };
    this.examHistory.push({ turn: game.turn, level: lv.name, subject: subject.name,
      zhuangyuan: zhuangyuan ? zhuangyuan.gen.name : null });
    return this.lastResults;
  }

  // ============================================================
  // V22.0.0 新增 API
  // ============================================================

  // 开科取士（文举/武举统一入口）
  // examType: 'wen'（文举·进士科） | 'wu'（武举·武举科）
  startImperialExam(examType = 'wen', game) {
    if (!game) return { ok: false, msg: '缺少 game 上下文' };
    // 文举走进士科；武举走武举科
    const subjectId = (examType === 'wu') ? 'wuju' : 'jinshi';
    this.startExam('dianshi');
    const result = this.runExam(game, subjectId);
    return { ok: true, examType, result };
  }

  // 武举：选拔武将（重统帅/武力）
  startMilitaryExam(game) {
    if (!game) return { ok: false, msg: '缺少 game 上下文' };
    const result = this.runExam(game, 'wuju');
    this.v22_stats.militaryTop++;
    // 武举魁首额外授武职、忠诚加成
    if (result && result.zhuangyuan) {
      const top = game.getGeneral ? game.getGeneral(result.zhuangyuan._id) : null;
      if (top) {
        top.office = '武状元 · 殿前司指挥使';
        top.loyalty = Math.min(100, top.loyalty + 10);
        if (game.pushLog) game.pushLog(`武举魁首：${top.name} 授殿前司指挥使，赐甲第。`);
      }
    }
    return { ok: true, result };
  }

  // 取本势力历届状元（含武举）名单，按名次成绩排序
  getTopScholars(game) {
    try {
      const mine = new Set((game.getFactionGenerals(game.playerFaction) || []).map(g => g.id));
      const list = [];
      for (const rec of this.examHistory) {
        if (!rec.zhuangyuan) continue;
        // 从武将表反查
        for (const g of game.generals.values()) {
          if (g.name === rec.zhuangyuan && mine.has(g.id)) {
            list.push({
              id: g.id, name: g.name, turn: rec.turn,
              subject: rec.subject, title: g.examTitle || '状元',
              score: g.command + g.force + g.intel + g.politics
            });
          }
        }
      }
      return list.sort((a, b) => b.score - a.score).slice(0, 10);
    } catch (e) { return []; }
  }

  // 查询某武将的「同年」网络（同榜进士）
  getFellowNetwork(generalId, game) {
    try {
      const group = this.v22_fellowGroups.find(g => g.members.includes(generalId));
      if (!group) return { generalId, fellows: [], size: 0, bonus: 0 };
      const fellows = group.members
        .filter(id => id !== generalId)
        .map(id => game.getGeneral ? game.getGeneral(id) : null)
        .filter(Boolean)
        .map(g => ({ id: g.id, name: g.name, title: g.examTitle || '进士' }));
      // 同年加成：每名在世同党给予持有者忠诚/政治微加成
      const bonus = Math.min(10, fellows.length * 2);
      return { generalId, fellows, size: fellows.length, bonus, turn: group.turn };
    } catch (e) { return { generalId, fellows: [], size: 0, bonus: 0 }; }
  }

  // ---------- 选官系统：察举制 ----------
  // 地方官（太守）向朝廷推荐人才，每年可荐 1~2 人
  recommendScholar(factionId, cityId, game) {
    if (!game) return { ok: false, msg: '缺少 game 上下文' };
    if (this.v22_recruitMode !== 'cha' && this.v22_recruitMode !== 'zhongzheng') {
      return { ok: false, msg: '当前为科举取士模式，未开察举' };
    }
    const city = game.cities.get(cityId);
    if (!city || city.owner !== factionId) return { ok: false, msg: '非我方城池，不可察举' };
    const mayor = city.mayor ? game.getGeneral(city.mayor) : null;
    if (!mayor) return { ok: false, msg: '该城未任太守，无人举主' };

    // 每年（每3回合）该城可荐人数
    const year = Math.floor(game.turn / EXAM_INTERVAL);
    const used = (this.v22_recommendUsed[cityId] && this.v22_recommendUsed[cityId][year]) || 0;
    if (used >= 2) return { ok: false, msg: '本年该城察举名额已用尽' };

    // 从在野武将中选最优；举主政治越高，荐得人才越好
    const idle = game.getIdleGenerals().filter(g => !this._isBanned(g.id, game));
    if (idle.length === 0) return { ok: false, msg: '在野无人可举' };
    // 举主清廉（忠诚高）→ 按才举；举主贪浊（忠诚低）→ 举亲故（随机差才）
    const bias = mayor.loyalty >= 60 ? 1 : (0.5 + Math.random() * 0.6);
    const scored = idle.map(g => ({
      g, s: (g.politics + g.intel) * bias + Math.random() * 10
    })).sort((a, b) => b.s - a.s);
    const pick = scored[0].g;

    pick.faction = factionId;
    pick.location = cityId;
    pick.loyalty = Math.min(100, pick.loyalty + 8);
    pick.examTitle = '察举出身';
    if (mayor.loyalty < 40) {
      // 举主徇私：被举者才具平庸，政治-3
      pick.politics = Math.max(1, pick.politics - 3);
      if (game.pushLog) game.pushLog(`察举：${mayor.name}举${pick.name}（孝廉），然物议汹汹，谓其徇私。`);
    } else {
      if (game.pushLog) game.pushLog(`察举：${mayor.name}举${pick.name}为孝廉，州郡得人。`);
    }
    this.v22_recommendUsed[cityId] = this.v22_recommendUsed[cityId] || {};
    this.v22_recommendUsed[cityId][year] = used + 1;
    this.v22_stats.recommended++;
    return { ok: true, msg: `${mayor.name} 举 ${pick.name} 入仕`, scholar: { id: pick.id, name: pick.name } };
  }

  // ---------- 选官系统：九品中正制 ----------
  // 按家世 / 道德 / 才能定品（一品最高，九品最低）
  getOfficialRank(generalId) {
    return this.v22_officerRank[generalId] || null;
  }

  // 计算九品中正品级（不落库，仅供预览）
  _calcRank(gen) {
    // 家世：有爵/有官/科举出身者门第高
    const bg = (gen.title ? 30 : 0) + (gen.office ? 20 : 0) + (gen.examTitle ? 15 : 0) + 10;
    // 道德：取忠诚
    const mor = gen.loyalty || 50;
    // 才能：四维均值
    const tal = ((gen.command + gen.force + gen.intel + gen.politics) / 4) || 30;
    const total = bg * 0.30 + mor * 0.20 + tal * 0.50;
    // 映射到九品：total 越高品级越高（数字越小）
    let grade = Math.round(10 - total / 11.1);
    grade = Math.max(1, Math.min(9, grade));
    return { grade, bg: Math.round(bg), mor: Math.round(mor), tal: Math.round(tal) };
  }

  // 刷新某武将的中正品级（授官/考核时调用）
  refreshOfficialRank(generalId, game) {
    const gen = game.getGeneral ? game.getGeneral(generalId) : null;
    if (!gen) return null;
    const r = this._calcRank(gen);
    this.v22_officerRank[generalId] = { ...r, turn: game.turn };
    return this.v22_officerRank[generalId];
  }

  // ---------- 选官系统：官员考核（每3年一次） ----------
  // 优秀者晋升（忠诚上升/品级提升），不合格者贬官（忠诚下降/去职）
  evaluateOfficial(generalId, game) {
    if (!game) return { ok: false, msg: '缺少 game 上下文' };
    const gen = game.getGeneral ? game.getGeneral(generalId) : null;
    if (!gen) return { ok: false, msg: '未找到该武将' };
    if (gen.faction !== game.playerFaction) return { ok: false, msg: '非我方官员' };

    const r = this.refreshOfficialRank(generalId, game);
    // 考核绩效：忠诚 + 在官时长 + 品级
    const perf = (gen.loyalty || 50) + (r.tal || 50) - (r.grade - 5) * 3;
    let result;
    if (perf >= 120) {
      // 称职以上：晋升
      gen.loyalty = Math.min(100, gen.loyalty + 8);
      if (r.grade > 1) r.grade--; // 品级升半阶
      this.v22_stats.promoted++;
      result = { ok: true, verdict: '上考', msg: `${gen.name} 考绩上，迁官进秩，忠诚+8。` };
      if (game.pushLog) game.pushLog(`◆ 考课：${gen.name} 上上考，加秩进品。`);
    } else if (perf < 70) {
      // 不称职：贬官
      gen.loyalty = Math.max(0, gen.loyalty - 12);
      if (r.grade < 9) r.grade++;
      this.v22_stats.demoted++;
      result = { ok: true, verdict: '下考', msg: `${gen.name} 考绩下，左降官秩，忠诚-12。` };
      if (game.pushLog) game.pushLog(`◆ 考课：${gen.name} 下考，贬官一等。`);
    } else {
      result = { ok: true, verdict: '中考', msg: `${gen.name} 考绩中，仍旧任。` };
    }
    return result;
  }

  // 批量考核：每3年（EXAM_INTERVAL回合）对全体在朝官员考课一次
  v22_batchEvaluate(game) {
    if (!game) return { evaluated: 0 };
    if (game.turn - this.v22_lastEvaluateTurn < EXAM_INTERVAL) return { evaluated: 0 };
    this.v22_lastEvaluateTurn = game.turn;
    const mine = (game.getFactionGenerals(game.playerFaction) || [])
      .filter(g => g.role !== '君主' && g.office);
    let n = 0;
    for (const g of mine) { this.evaluateOfficial(g.id, game); n++; }
    if (n > 0 && game.pushLog) game.pushLog(`◆ 三岁考课毕：共考课 ${n} 名在朝官员。`);
    return { evaluated: n };
  }

  // ---------- 选官系统：科举 / 察举 模式切换 ----------
  switchRecruitmentMode(factionId, mode) {
    if (!V22_RECRUIT_MODES[mode]) return { ok: false, msg: '未知选官模式' };
    this.v22_recruitMode = mode;
    const m = V22_RECRUIT_MODES[mode];
    return { ok: true, msg: `选官制度已切换为【${m.name}】：${m.desc}`, mode };
  }

  // ---------- 翰林院：每回合产出文化值 ----------
  v22_hanlinCulturePerTurn() {
    // 每位在馆翰林学士每回合产出文化（状元领衔者更多）
    return this.v22_hanlin.length * 2;
  }

  // 回合结算：翰林院产出文化 + 触发三岁考课
  v22_processTurn(game) {
    if (!game) return { culture: 0, evaluated: 0 };
    let culture = 0;
    try {
      const c = this.v22_hanlinCulturePerTurn();
      if (c > 0 && game.cultureSystem && typeof game.cultureSystem.addCulture === 'function') {
        game.cultureSystem.addCulture(game.playerFaction, c);
        culture = c;
        this.v22_stats.hanlinCulture += c;
      }
    } catch (e) { /* 文化系统异常不阻断 */ }
    const ev = this.v22_batchEvaluate(game);
    return { culture, evaluated: ev.evaluated || 0 };
  }

  serialize() {
    return {
      nextExamTurn: this.nextExamTurn,
      lastResults: this.lastResults,
      examCount: this.examCount,
      currentLevel: this.currentLevel,
      examHistory: this.examHistory,
      // V22.0.0
      v22_recruitMode: this.v22_recruitMode,
      v22_fellowGroups: this.v22_fellowGroups,
      v22_hanlin: this.v22_hanlin,
      v22_banList: this.v22_banList,
      v22_officerRank: this.v22_officerRank,
      v22_lastEvaluateTurn: this.v22_lastEvaluateTurn,
      v22_recommendUsed: this.v22_recommendUsed,
      v22_stats: this.v22_stats
    };
  }

  static deserialize(data) {
    const s = new ImperialExamSystem();
    if (data) {
      s.nextExamTurn = data.nextExamTurn || (EXAM_INTERVAL + 1);
      s.lastResults = data.lastResults || null;
      s.examCount = data.examCount || 0;
      s.currentLevel = data.currentLevel || 'dianshi';
      s.examHistory = Array.isArray(data.examHistory) ? data.examHistory : [];
      // V22.0.0 兼容旧存档
      s.v22_recruitMode = data.v22_recruitMode || 'keju';
      s.v22_fellowGroups = Array.isArray(data.v22_fellowGroups) ? data.v22_fellowGroups : [];
      s.v22_hanlin = Array.isArray(data.v22_hanlin) ? data.v22_hanlin : [];
      s.v22_banList = data.v22_banList || {};
      s.v22_officerRank = data.v22_officerRank || {};
      s.v22_lastEvaluateTurn = data.v22_lastEvaluateTurn || 0;
      s.v22_recommendUsed = data.v22_recommendUsed || {};
      s.v22_stats = Object.assign({
        zhuangyuan: 0, militaryTop: 0, recommended: 0, fraudCaught: 0,
        promoted: 0, demoted: 0, hanlinCulture: 0, fellowBonds: 0
      }, data.v22_stats || {});
    }
    return s;
  }
}
