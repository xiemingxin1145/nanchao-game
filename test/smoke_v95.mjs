// ============================================================
// smoke_v95.mjs — V9.5 冒烟测试
// 验证：音乐系统(BGM/解锁/播放列表) / 成就系统(30+成就/点数/段位) /
//       教程系统(20步/6章) / 新武将(5) / 新事件(20随机+5历史) /
//       新剧本(2) / 存档读写
// ============================================================
import { GENERALS, EVENTS, HISTORICAL_EVENTS, SCENARIOS, NEW_GENERAL_SKILLS } from '../src/js/data.js';
import { ACHIEVEMENTS, checkAchievements, getAchievementList,
         getAchievementPoints, getAchievementTier, ACH_CATEGORIES } from '../src/js/achievements.js';
import { Tutorial, TUTORIAL_CHAPTERS, GAME_GUIDE } from '../src/js/tutorial.js';
import { BGM_INFO } from '../src/js/audio.js';
import fs from 'fs';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.log(`  ✗ FAIL: ${msg}`); }
}

console.log('=== V9.5 冒烟测试 ===\n');

// ===== 1. 音乐系统 =====
console.log('--- 1. 音乐系统 ---');
const bgmIds = Object.keys(BGM_INFO);
assert(bgmIds.length >= 15, `BGM 总数≥15（实际${bgmIds.length}）`);
for (const must of ['dynasty','exam','grandbattle','culture','harem']) {
  assert(bgmIds.includes(must), `新 BGM 存在: ${must}`);
}
// AudioManager 实例化与播放列表/解锁
// 注意：不调用 resume() 以避免 AudioContext（Node 无 window）
const { AudioManager } = await import('../src/js/audio.js');
const am = new AudioManager();
assert(am.unlockedBGMs.length >= 10, `初始解锁BGM≥10（实际${am.unlockedBGMs.length}）`);
assert(am.unlockBGM('dynasty') === true, `首次解锁 dynasty`);
assert(am.unlockBGM('dynasty') === false, `重复解锁幂等`);
assert(am.isBGMUnlocked('dynasty'), `dynasty 已解锁`);
assert(am.toggleFavoriteBGM('menu') === true, `收藏 menu`);
assert(am.isFavoriteBGM('menu'), `menu 已收藏`);
am.setPlayMode('random'); assert(am.playMode === 'random', `切换随机播放`);
am.setPlayMode('sequential'); assert(am.playMode === 'sequential', `切回顺序播放`);
const pl = am.getPlaylist();
assert(Array.isArray(pl) && pl.includes('menu') && pl.includes('dynasty'), `播放列表含已解锁曲目`);
// 序列化/恢复
const musState = am.serializeMusic();
assert(Array.isArray(musState.unlocked) && musState.unlocked.includes('dynasty'), `音乐状态序列化`);
const am2 = new AudioManager();
am2.restoreMusic(musState);
assert(am2.isBGMUnlocked('dynasty') && am2.isFavoriteBGM('menu'), `音乐状态恢复`);
// 新音效方法存在
for (const fn of ['playLegionForm','playGrandBattleStart','playGrandBattleWin',
  'playFormationSwitch','playExamHuangbang','playTaxAdjust','playCorveeConscript',
  'playSolarTerm','playCelestialAnomaly','playPrinceBorn']) {
  assert(typeof am[fn] === 'function', `新音效方法存在: ${fn}`);
}

// ===== 2. 成就系统 =====
console.log('\n--- 2. 成就系统 ---');
assert(ACHIEVEMENTS.length >= 30, `成就总数≥30（实际${ACHIEVEMENTS.length}）`);
const cats = new Set(ACHIEVEMENTS.map(a => a.category));
for (const c of ['military','politics','economy','person','special']) {
  assert(cats.has(c), `含分类: ${c}`);
}
// 每个成就字段齐全
let bad = 0;
for (const a of ACHIEVEMENTS) {
  if (!a.id || !a.name || !a.description || typeof a.points !== 'number'
      || typeof a.condition !== 'function' || !a.category) bad++;
}
assert(bad === 0, `全部成就字段齐全（异常${bad}）`);
// 段位/点数
const tier = getAchievementTier(0); assert(tier.id === 'bronze', `0点=青铜`);
assert(getAchievementTier(800).id === 'diamond', `800点=钻石`);
// 成就检查：构造假 game 桩
const fakeGame = {
  turn: 2, playerFaction: 'nanchao',
  achievements: {}, pendingAchievements: [],
  stats: { citiesConquered: 0, bestWinStreak: 0, underdogWins: 0,
    siegesDefended: 0, idleRecruited: 0, grandBattlesWon: 0, navyWins: 0,
    cultureTotal: 0, examTopScholars: 0, wins: 0, wins: 0 },
  techs: [], factionRes: new Map([['nanchao', { money: 200000, food: 60000 }]]),
  tradeRoutes: new Array(11).fill({}),
  getPlayerRes() { return this.factionRes.get('nanchao'); },
  getFactionArmies() { return []; },
  getFactionCities() { return Array.from({length: 16}, () => ({ garrison: 10000 })); },
  getFactionGenerals() { return []; },
  gameStats: { buildingsBuilt: 60, recruited: 90, ngPlusLevel: 10 },
  ngPlusLevel: 10, unlockedTitles: {},
  dynastySystem: { abdicated: true },
  endings: { triggered: 'S_perfect' },
  pushLog() {}
};
const newly = checkAchievements(fakeGame);
assert(newly.length > 5, `假数据触发多个成就（实际${newly.length}）`);
assert(fakeGame.achievements['first_turn'], `first_turn 已解锁`);
assert(fakeGame.achievements['money_100k'], `money_100k 触发`);
assert(fakeGame.achievements['unify'], `unify 触发`);
assert(getAchievementPoints(fakeGame) > 0, `累计成就点>0`);
assert(Array.isArray(getAchievementList(fakeGame)), `成就列表可枚举`);

// ===== 3. 教程系统 =====
console.log('\n--- 3. 教程系统 ---');
assert(TUTORIAL_CHAPTERS.length === 6, `教程6章（实际${TUTORIAL_CHAPTERS.length}）`);
assert(GAME_GUIDE.length >= 8, `游戏指南≥8节（实际${GAME_GUIDE.length}）`);
const tut = new Tutorial(null);
const allSteps = tut._buildSteps();
assert(allSteps.length >= 20, `教程总步数≥20（实际${allSteps.length}）`);
const baseSteps = allSteps.filter(s => s.chapter === 'base');
assert(baseSteps.length >= 3 && baseSteps.every(s => s.title), `章节步骤数据完整（base=${baseSteps.length}）`);
// 每步含必需字段
const stepBad = allSteps.filter(s => !s.title || !s.text).length;
assert(stepBad === 0, `全部教程步骤含标题/说明（异常${stepBad}）`);

// ===== 4. 新武将（5） =====
console.log('\n--- 4. 新武将（80→85） ---');
assert(GENERALS.length >= 85, `武将总数≥85（实际${GENERALS.length}）`);
const v95g = ['tuoba_tao','cui_hao','feng_taihou','yang_dayan','yuan_xie'];
for (const gid of v95g) {
  const g = GENERALS.find(x => x.id === gid);
  assert(!!g, `新武将存在: ${gid}`);
  if (g) assert(g.command && g.force && g.intel && g.politics, `${g.name} 四维齐全`);
  assert(NEW_GENERAL_SKILLS[gid] !== undefined, `${gid} 已绑定技能`);
  assert(fs.existsSync(`assets/portraits/${gid}.png`), `立绘存在: ${gid}.png`);
}
const portraitCount = fs.readdirSync('assets/portraits').filter(f => f.endsWith('.png')).length;
assert(portraitCount >= 85, `portraits≥85张（实际${portraitCount}）`);

// ===== 5. 新事件 =====
console.log('\n--- 5. 新事件 ---');
const v95rand = EVENTS.filter(e => e.id.startsWith('v95_'));
assert(v95rand.length >= 20, `V9.5随机事件≥20（实际${v95rand.length}）`);
const v95hist = HISTORICAL_EVENTS.filter(e => e.id.startsWith('v95_'));
assert(v95hist.length === 5, `V9.5历史事件=5（实际${v95hist.length}）`);
for (const hid of ['v95_taiwu_miefo','v95_liangwu_sheshen','v95_houjing_detailed',
  'v95_zhouwu_miefo','v95_suiyang_nanxun']) {
  assert(HISTORICAL_EVENTS.some(e => e.id === hid), `历史事件存在: ${hid}`);
}

// ===== 6. 新剧本 =====
console.log('\n--- 6. 新剧本 ---');
assert(Object.keys(SCENARIOS).length >= 12, `剧本总数≥12（实际${Object.keys(SCENARIOS).length}）`);
for (const sid of ['446','527']) {
  assert(SCENARIOS[sid], `剧本存在: ${sid}`);
  assert(Array.isArray(SCENARIOS[sid].factions) && SCENARIOS[sid].factions.length >= 2, `${sid} 有势力`);
}

// ===== 7. 美术素材 =====
console.log('\n--- 7. 美术素材 ---');
const assetChecks = [
  'assets/images/musician.png', 'assets/images/achievement_hall.png', 'assets/images/taixue_lecture.png',
  'assets/cities/pingcheng_v2.png', 'assets/cities/jiankang_v5.png', 'assets/cities/luoyang_v4.png',
  'assets/battles/taiwu_miefo.png', 'assets/battles/liangwu_sheshen.png',
  'assets/events/houjing_v3.png', 'assets/events/sui_nanxun.png'
];
for (const p of assetChecks) assert(fs.existsSync(p), `素材存在: ${p}`);

console.log(`\n=== 结果：${passed} 通过, ${failed} 失败 ===`);
process.exit(failed > 0 ? 1 : 0);
