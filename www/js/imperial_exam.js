// ============================================================
// imperial_exam.js — V8.0 科举系统（V15.0 系统深化版）
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

export class ImperialExamSystem {
  constructor() {
    this.nextExamTurn = EXAM_INTERVAL + 1;   // 第4回合首次科举（开局3年内）
    this.lastResults = null;                  // 上次科举结果
    this.examCount = 0;                       // 已举办次数
    this.currentLevel = 'dianshi';            // V15.0：当前考试级别（默认殿试=完整科举）
    this.examHistory = [];                    // V15.0：历次考试记录
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

  // 执行科举考试
  runExam(game, subjectId = 'jinshi') {
    const subject = EXAM_SUBJECTS[subjectId] || EXAM_SUBJECTS.jinshi;
    const taixueLv = this._getTaixueLevel(game);
    // V15.0：根据考试级别调整候选人数与质量
    const lv = EXAM_LEVELS[this.currentLevel] || EXAM_LEVELS.dianshi;
    // 太学每级增加选拔人数（基础5人，每级+1，最多10人），再乘以级别系数
    const candidateCount = Math.min(10, Math.round((5 + taixueLv) * (lv.candidateMult || 1)));

    // 从在野武将中选拔候选人
    const idle = game.getIdleGenerals();
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

    // 普通进士：也加入玩家势力但无属性加成
    for (const entry of jinshi) {
      const gen = entry.gen;
      gen.faction = game.playerFaction;
      gen.loyalty = Math.min(100, gen.loyalty + 10);
      const capital = game.cities.get(FACTIONS[game.playerFaction].capital);
      gen.location = capital ? capital.id : null;
      gen.examTitle = '进士';
      honored.push({ name: gen.name, rank: '进士', score: entry.score, title: null });
      game.pushLog(`科举进士：${gen.name}（成绩${entry.score}），赐出身。`);
    }

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
      message: `【${lv.name}·${subject.name}】放榜！状元：${zhuangyuan ? zhuangyuan.gen.name : '无'}。`
    };
    this.examHistory.push({ turn: game.turn, level: lv.name, subject: subject.name,
      zhuangyuan: zhuangyuan ? zhuangyuan.gen.name : null });
    return this.lastResults;
  }

  serialize() {
    return {
      nextExamTurn: this.nextExamTurn,
      lastResults: this.lastResults,
      examCount: this.examCount,
      currentLevel: this.currentLevel,
      examHistory: this.examHistory
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
    }
    return s;
  }
}
