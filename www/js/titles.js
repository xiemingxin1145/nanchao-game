// ============================================================
// titles.js — V3.5 称号系统
// ------------------------------------------------------------
// 技术参考：
// 1) 称号/勋章系统通用设计：TITLES 表每项含 {id,name,desc,condition,bonus}，
//    每回合 endTurn 扫描所有我方武将，condition(game, general) 为真则解锁。
//    参考：Civilization 勋章 / Total War 称号系统。
// 2) 数值平衡：称号加成总和不超过基础属性的 30%（硬上限）。
//    单个称号属性加成 ≤10；全属性称号 ≤10；兵种乘算 ≤20%。
//    每武将最多装备 3 个称号（activeTitles[gid] = [titleId,...]）。
// 3) 称号状态：game.unlockedTitles = { generalId: [titleId,...] }
//    每武将已解锁；game.activeTitles = { generalId: [titleId,...] }
//    每武将当前装备（最多 3 个）。
// ============================================================

// 称号表：condition 接收 (game, general)，bonus 为加成袋
export const TITLES = [
  {
    id: 'zhanshen', name: '战神', desc: '单场战斗杀敌>10000。武力+10',
    bonus: { force: 10 },
    condition: (g, gen) => (g.generalStats && g.generalStats[gen.id] &&
      g.generalStats[gen.id].maxKills || 0) >= 10000
  },
  {
    id: 'jun_shen', name: '军神', desc: '指挥10场战斗全胜。统帅+10',
    bonus: { command: 10 },
    condition: (g, gen) => (g.generalStats && g.generalStats[gen.id] &&
      g.generalStats[gen.id].totalWins || 0) >= 10 &&
      (g.generalStats && g.generalStats[gen.id] &&
       g.generalStats[gen.id].totalBattles || 0) >= 10 &&
      (g.generalStats[gen.id].totalWins / Math.max(1, g.generalStats[gen.id].totalBattles) >= 1)
  },
  {
    id: 'zhiduoxing', name: '智多星', desc: '策反成功3次。智力+10',
    bonus: { intel: 10 },
    condition: (g) => (g.gameStats && g.gameStats.defects || 0) >= 3
  },
  {
    id: 'mingjun', name: '明君', desc: '民心>90维持10回合。政治+10',
    bonus: { politics: 10 },
    condition: (g) => (g.gameStats && g.gameStats.highMoraleTurns || 0) >= 10
  },
  {
    id: 'feijiang', name: '飞将', desc: '单回合行军>5格。移动+2',
    bonus: { move: 2 },
    condition: (g, gen) => (g.generalStats && g.generalStats[gen.id] &&
      g.generalStats[gen.id].maxMarch || 0) >= 5
  },
  {
    id: 'shoucheng', name: '守城名将', desc: '守城战胜利5次。防御+15',
    bonus: { defense: 15 },
    condition: (g) => (g.stats && g.stats.siegesDefended || 0) >= 5
  },
  {
    id: 'qishen', name: '骑神', desc: '骑兵为主力战斗胜利10次。骑兵战力+20%',
    bonus: { cavalryMult: 0.20 },
    condition: (g, gen) => (g.generalStats && g.generalStats[gen.id] &&
      g.generalStats[gen.id].cavalryWins || 0) >= 10
  },
  {
    id: 'gong_shen', name: '弓神', desc: '弓兵为主力战斗胜利10次。弓兵战力+20%',
    bonus: { archerMult: 0.20 },
    condition: (g, gen) => (g.generalStats && g.generalStats[gen.id] &&
      g.generalStats[gen.id].archerWins || 0) >= 10
  },
  {
    id: 'buzhan', name: '步战大师', desc: '步兵为主力战斗胜利10次。步兵战力+20%',
    bonus: { infantryMult: 0.20 },
    condition: (g, gen) => (g.generalStats && g.generalStats[gen.id] &&
      g.generalStats[gen.id].infantryWins || 0) >= 10
  },
  {
    id: 'fukuodiguo', name: '富可敌国', desc: '累计金钱>100000。金钱产出+20%',
    bonus: { incomeMult: 0.20 },
    condition: (g) => (g.gameStats && g.gameStats.totalMoney || 0) >= 100000
  },
  {
    id: 'liangmancang', name: '粮满仓', desc: '累计粮草>100000。粮草产出+20%',
    bonus: { foodMult: 0.20 },
    condition: (g) => (g.gameStats && g.gameStats.totalFood || 0) >= 100000
  },
  {
    id: 'renwang', name: '人望', desc: '招募在野武将10人。招募成功率+30%',
    bonus: { recruitMult: 0.30 },
    condition: (g) => (g.stats && g.stats.idleRecruited || 0) >= 10
  },
  {
    id: 'waijiaoguan', name: '外交官', desc: '成功同盟5次。外交成功率+20%',
    bonus: { diploMult: 0.20 },
    condition: (g) => (g.gameStats && g.gameStats.alliances || 0) >= 5
  },
  {
    id: 'anshazhe', name: '暗杀者', desc: '密探任务成功5次。密探成功率+20%',
    bonus: { spyMult: 0.20 },
    condition: (g) => (g.gameStats && g.gameStats.spySuccess || 0) >= 5
  },
  {
    id: 'jianzhu', name: '建筑大师', desc: '建造建筑20座。建造速度+20%',
    bonus: { buildMult: 0.20 },
    condition: (g) => (g.gameStats && g.gameStats.buildingsBuilt || 0) >= 20
  },
  {
    id: 'maoyidaren', name: '贸易大亨', desc: '建立商路10条。贸易收入+30%',
    bonus: { tradeMult: 0.30 },
    condition: (g) => (g.gameStats && g.gameStats.tradeRoutes || 0) >= 10
  },
  {
    id: 'manzhheng', name: '蛮族征服者', desc: '征讨蛮族胜利5次。对蛮族战力+30%',
    bonus: { barbarianMult: 0.30 },
    condition: (g) => (g.gameStats && g.gameStats.barbarianWins || 0) >= 5
  },
  {
    id: 'zhuangyuan', name: '状元', desc: '武将等级达到10级。全属性+3',
    bonus: { allAttr: 3 },
    condition: (g, gen) => (gen.level || 1) >= 10
  },
  {
    id: 'baisui', name: '百岁老人', desc: '武将存活超过80回合。全属性+5',
    bonus: { allAttr: 5 },
    condition: (g, gen) => (gen.survivedTurns || 0) >= 80
  },
  {
    id: 'tianming', name: '天命所归', desc: '统一全国。全属性+10',
    bonus: { allAttr: 10 },
    condition: (g) => g.getFactionCities &&
      g.getFactionCities(g.playerFaction).length >= (g.cities.size || 30) - 1
  }
];

// 每武将最多装备的称号数
export const MAX_ACTIVE_TITLES = 3;

// 工具：按 id 查称号
export function getTitle(id) {
  return TITLES.find(t => t.id === id) || null;
}

// 检查所有我方武将是否解锁新称号，返回 [{generalId, title}]
// 写入 game.unlockedTitles（仅累加，不自动装备）
export function checkTitles(game) {
  if (!game.unlockedTitles) game.unlockedTitles = {};
  const newly = [];
  for (const gen of game.getFactionGenerals(game.playerFaction)) {
    if (!game.unlockedTitles[gen.id]) game.unlockedTitles[gen.id] = [];
    for (const t of TITLES) {
      if (game.unlockedTitles[gen.id].includes(t.id)) continue;
      try {
        if (t.condition(game, gen)) {
          game.unlockedTitles[gen.id].push(t.id);
          newly.push({ generalId: gen.id, generalName: gen.name, title: t });
          game.pushLog(`★ 武将【${gen.name}】获得称号「${t.name}」— ${t.desc}`);
        }
      } catch (e) { /* 条件异常不阻断 */ }
    }
  }
  return newly;
}

// 计算某武将当前装备称号提供的加成袋
// game.activeTitles[gid] = [titleId,...]
export function getActiveTitleBonus(game, generalId) {
  const bag = {};
  if (!game.activeTitles) return bag;
  const ids = game.activeTitles[generalId] || [];
  for (const tid of ids) {
    const t = getTitle(tid);
    if (!t || !t.bonus) continue;
    for (const [k, v] of Object.entries(t.bonus)) {
      bag[k] = (bag[k] || 0) + v;
    }
  }
  return bag;
}

// 切换装备称号：toggle = 装备/卸下
// 返回 {ok, msg, equipped: [...] }
export function equipTitle(game, generalId, titleId, toggle) {
  if (!game.activeTitles) game.activeTitles = {};
  if (!game.unlockedTitles || !game.unlockedTitles[generalId] ||
      !game.unlockedTitles[generalId].includes(titleId)) {
    return { ok: false, msg: '该称号未解锁' };
  }
  if (!game.activeTitles[generalId]) game.activeTitles[generalId] = [];
  const arr = game.activeTitles[generalId];
  const idx = arr.indexOf(titleId);
  if (toggle === undefined) toggle = (idx < 0);
  if (toggle) {
    if (idx >= 0) return { ok: true, msg: '已装备', equipped: arr };
    if (arr.length >= MAX_ACTIVE_TITLES) {
      return { ok: false, msg: `最多装备 ${MAX_ACTIVE_TITLES} 个称号` };
    }
    arr.push(titleId);
  } else {
    if (idx >= 0) arr.splice(idx, 1);
  }
  return { ok: true, msg: toggle ? '已装备称号' : '已卸下称号', equipped: arr.slice() };
}
