// ============================================================
// stats.js — V3.5 全局统计面板
// ------------------------------------------------------------
// 技术参考：
// 1) 统计面板通用做法：一个扁平的 gameStats 对象，每回合 endTurn
//    时累加；战斗/招募/建造等关键事件实时累加。
// 2) 内存优化：游戏时间用 performance.now() 差值累计（秒），
//    存档时序列化；不在内存中维护长数组。
// 3) 存档兼容：所有字段在 deserialize 时用 Object.assign 补默认值。
// ============================================================

export function defaultGameStats() {
  return {
    // 时间/回合
    playTime: 0,            // 本局游戏时间（秒）
    startTimestamp: 0,      // 开局时间戳（ms）
    totalTurns: 0,          // 总回合数
    // 战斗
    battles: 0,             // 战斗次数
    victories: 0,          // 胜利次数
    kills: 0,               // 总杀敌数
    losses: 0,              // 总损兵数
    // 城市
    citiesConquered: 0,     // 占领城市数
    maxCities: 0,           // 最大城市数
    // 武将
    recruited: 0,           // 招募武将数
    idleGenerals: 0,        // 结束时在野武将数
    // 内政
    buildingsBuilt: 0,      // 建造建筑数
    researched: 0,          // 研究科技数
    eventsTriggered: 0,    // 触发事件数
    tradeRoutes: 0,         // 建立商路数
    spySuccess: 0,          // 密探成功数
    alliances: 0,           // 同盟成功数
    defects: 0,             // 策反成功数
    barbarianWins: 0,       // 征讨蛮族胜利数
    // 资源累计
    totalMoney: 0,          // 累计金钱收入
    totalFood: 0,           // 累计粮草收入
    highMoraleTurns: 0,     // 民心>90维持回合数
    // 解锁
    achievements: 0,        // 解锁成就数
    titles: 0,              // 解锁称号数
    // 结局
    endings: {},            // { endingId: count }
    // 周目
    ngPlusLevel: 0
  };
}

// 每回合更新（在 game.endTurn() 末尾调用）
// 性能优化：民心均值统计——原实现用 cities.reduce 一次累加 + 长度，
// 单次循环内即可同时完成求和与计数，避免 reduce 闭包开销；
// 并把 maxCities 更新合并进同一循环。城市数 72 时收益有限，
// 但每回合稳定执行，累积收益可观。
export function recordTurn(game) {
  const s = game.gameStats;
  if (!s) return;
  s.totalTurns = game.turn;
  // 民心>90 维持回合
  const cities = game.getFactionCities(game.playerFaction);
  if (cities.length) {
    let sum = 0;
    for (let i = 0; i < cities.length; i++) sum += (cities[i].morale || 0);
    const avg = sum / cities.length;
    if (avg > 90) s.highMoraleTurns++;
    if (cities.length > s.maxCities) s.maxCities = cities.length;
  }
  s.idleGenerals = game.getIdleGenerals ? game.getIdleGenerals().length : 0;
}

// 战斗记录
export function recordBattle(game, opts) {
  const s = game.gameStats;
  if (!s) return;
  s.battles++;
  if (opts.win) s.victories++;
  s.kills += opts.kills || 0;
  s.losses += opts.losses || 0;
}

// 资源记录
export function recordIncome(game, money, food) {
  const s = game.gameStats;
  if (!s) return;
  s.totalMoney += Math.max(0, money || 0);
  s.totalFood += Math.max(0, food || 0);
}

// 游戏结束时调用：累计通关次数/结局
export function recordEnding(game, endingId, ngplusLevel) {
  const s = game.gameStats;
  if (!s) return;
  // BUG修复（stats.js）：旧存档/异常状态下 s.endings 可能为 undefined 或非对象
  //   （如手动编辑存档、跨版本迁移），直接 `s.endings[endingId] = ...` 会抛
  //   TypeError，导致通关时崩溃。此处做防御性兜底。
  if (!s.endings || typeof s.endings !== 'object') s.endings = {};
  s.endings[endingId] = (s.endings[endingId] || 0) + 1;
  s.ngPlusLevel = ngplusLevel || 0;
  // 累计成就/称号解锁数
  s.achievements = Object.keys(game.achievements || {}).length;
  let titleCount = 0;
  for (const tids of Object.values(game.unlockedTitles || {})) titleCount += (tids || []).length;
  s.titles = titleCount;
}

// 计算胜率
export function winRate(s) {
  if (!s || !s.battles) return 0;
  return Math.round((s.victories / s.battles) * 100);
}

// 格式化时间
export function formatPlayTime(sec) {
  sec = Math.floor(sec || 0);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return (h > 0 ? h + '时' : '') + m + '分' + s + '秒';
}
