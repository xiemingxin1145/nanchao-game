// ============================================================
// smoke_v75.mjs — V7.5 冒烟测试
// 验证：新增事件(20随机+5历史) / 新增剧本(孝文改革/周武灭齐) / 存档读写 / UI接口
// ============================================================
import { EVENTS, HISTORICAL_EVENTS, SCENARIOS, FACTIONS, GENERALS } from '../src/js/data.js';
import { EventSystem } from '../src/js/events.js';
import { Game } from '../src/js/game.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.log(`  ✗ FAIL: ${msg}`); }
}

console.log('=== V7.5 冒烟测试 ===\n');

// ===== 1. 新增随机事件数量与结构 =====
console.log('--- 1. 新增随机事件 ---');
const newEventIds = [
  'yinghuo_shouxin', 'laoren_xing', 'kexing_ziwei', 'yue_shi',
  'shufa_dajia', 'shihui_yaji', 'huyue_donglai',
  'zhanma_fanzhi', 'junxie_gailiang', 'shuijun_caochuan',
  'shiji_kuojian', 'shuili_xingxiu', 'wugu_fengdeng',
  'dachen_jianyan', 'zongshi_hemu', 'baixiong_yongdai',
  'yiren_xianbao', 'gaoseng_yijing', 'daoshi_feisheng', 'mingyi_yufang'
];
for (const id of newEventIds) {
  const ev = EVENTS.find(e => e.id === id);
  assert(ev, `事件存在: ${id}`);
  if (ev) {
    assert(ev.name && ev.description, `事件 ${id} 有名称和描述`);
    assert(Array.isArray(ev.options) && ev.options.length > 0, `事件 ${id} 有选项`);
  }
}
assert(EVENTS.length >= 60, `EVENTS 总数≥60 (实际${EVENTS.length})`);

// ===== 2. 新增历史事件 =====
console.log('\n--- 2. 新增历史事件 ---');
const newHistIds = [
  'xiaowen_banjin', 'liuzhen_qiyi_full', 'heyin_tusha',
  'shayuan_dajie', 'zhoushu_miefu'
];
for (const id of newHistIds) {
  const ev = HISTORICAL_EVENTS.find(e => e.id === id);
  assert(ev, `历史事件存在: ${id}`);
  if (ev) {
    assert(typeof ev.minTurn === 'number', `历史事件 ${id} 有 minTurn`);
    assert(Array.isArray(ev.options) && ev.options.length > 0, `历史事件 ${id} 有选项`);
  }
}
assert(HISTORICAL_EVENTS.length >= 30, `HISTORICAL_EVENTS 总数≥30 (实际${HISTORICAL_EVENTS.length})`);

// ===== 3. 新增剧本 =====
console.log('\n--- 3. 新增剧本 ---');
assert(SCENARIOS['494'], '剧本9「孝文改革」存在');
assert(SCENARIOS['576'], '剧本10「周武灭齐」存在');
if (SCENARIOS['494']) {
  assert(SCENARIOS['494'].year === 494, '孝文改革年份=494');
  assert(SCENARIOS['494'].factions.length >= 3, '孝文改革≥3势力');
  assert(SCENARIOS['494'].cityMorale, '孝文改革有心律规则');
  assert(SCENARIOS['494'].garrisonMult, '孝文改革有驻军倍率');
}
if (SCENARIOS['576']) {
  assert(SCENARIOS['576'].year === 576, '周武灭齐年份=576');
  assert(SCENARIOS['576'].factions.length >= 4, '周武灭齐≥4势力');
  // 验证北齐民心低、北周强
  if (SCENARIOS['576'].cityMorale) {
    assert(SCENARIOS['576'].cityMorale.dongwei < 40, '北齐民心低(<40)');
    assert(SCENARIOS['576'].cityMorale.xiwei > 60, '北周民心高(>60)');
  }
}
// 剧本总数应≥10
assert(Object.keys(SCENARIOS).length >= 10, `剧本总数≥10 (实际${Object.keys(SCENARIOS).length})`);

// ===== 4. 事件系统触发与应用 =====
console.log('\n--- 4. 事件系统触发/应用 ---');
const es = new EventSystem();
assert(es.pendingEvents.length === 0, '初始无待处理事件');

// 构造最小 game stub 测试事件应用
const stubGame = {
  turn: 5, playerFaction: 'nanchao',
  cities: new Map(), generals: new Map(),
  log: [], pushLog(msg) { this.log.push(msg); },
  getPlayerRes() { return stubGame._res; },
  getFactionCities(fid) {
    return [...this.cities.values()].filter(c => c.owner === fid);
  },
  getFactionGenerals(fid) {
    return [...this.generals.values()].filter(g => g.faction === fid);
  },
  getIdleGenerals() {
    return [...this.generals.values()].filter(g => g.faction === null);
  },
  getGeneral(id) { return this.generals.get(id); },
  recruitIdleGeneral(id) {
    const g = this.generals.get(id);
    if (g) g.faction = 'nanchao';
    return { ok: true, msg: 'ok' };
  },
  barbarianTribes: [],
  resolveMassBattle() {},
  garrisonBuffTurns: 0,
  pendingAchievements: [], pendingTitles: [],
  unlockedTitles: {}, activeTitles: {},
  getStats() { return {}; }
};
stubGame._res = { money: 2000, food: 3000, totalMorale: 60 };
// 给南陈 3 个城市
const CITIES = (await import('../src/js/data.js')).CITIES;
['jiankang', 'wujun', 'kuaiji'].forEach(cid => {
  const c = CITIES.find(x => x.id === cid);
  if (c) stubGame.cities.set(cid, { ...c, owner: 'nanchao', morale: 60, pop: 10000, agri: 50, comm: 50, prosperity: 50, religion: { buddhist: 0, daoist: 0, culture: 0 } });
});

// 测试一个新随机事件的应用
const fengshou = EVENTS.find(e => e.id === 'wugu_fengdeng');
if (fengshou) {
  const beforeFood = stubGame.getPlayerRes().food;
  es.applyEvent(stubGame, fengshou, 0);
  assert(stubGame.getPlayerRes().food > beforeFood, `丰收年事件应用成功(粮草+)`);
}

// 测试灭佛事件的 destroyTemple 效果
const miefu = HISTORICAL_EVENTS.find(e => e.id === 'zhoushu_miefu');
if (miefu) {
  // 给城市一个佛寺
  const jk = stubGame.cities.get('jiankang');
  if (jk) jk.buildings = { buddhist_temple: 3 };
  es.applyEvent(stubGame, miefu, 0); // 选灭佛选项
  assert(jk.buildings.buddhist_temple <= 2, `灭佛事件降低佛寺等级`);
}

// ===== 5. 剧本加载（Game.initGame） =====
console.log('\n--- 5. 剧本加载 ---');
// 测试新剧本能否初始化（不实际启动 Electron，仅验证数据校验）
assert(SCENARIOS['494'].factions.every(f => FACTIONS[f]), '孝文改革势力ID均有效');
assert(SCENARIOS['576'].factions.every(f => FACTIONS[f]), '周武灭齐势力ID均有效');
// 验证 factionNameOverride
assert(SCENARIOS['494'].factionNameOverride.dongwei === '北魏', '孝文改革 dongwei→北魏');
assert(SCENARIOS['576'].factionNameOverride.xiwei === '北周', '周武灭齐 xiwei→北周');

// ===== 6. 存档序列化兼容性 =====
console.log('\n--- 6. 事件序列化 ---');
es.history = ['test_evt_1', 'test_evt_2'];
const s = es.serialize();
const d = EventSystem.deserialize(s);
assert(d.history.length === 2, '事件历史序列化还原');
assert(d.history[0] === 'test_evt_1', '事件历史内容保留');

// ===== 7. 武将数据完整性 =====
console.log('\n--- 7. 武将数据 ---');
assert(GENERALS.length >= 50, `武将总数≥50 (实际${GENERALS.length})`);
// 验证所有武将有五维属性
const missingApt = GENERALS.filter(g =>
  typeof g.command !== 'number' || typeof g.force !== 'number' ||
  typeof g.intel !== 'number' || typeof g.politics !== 'number'
);
assert(missingApt.length === 0, `所有武将有完整五维 (缺失${missingApt.length})`);

// ===== 8. 音效接口存在性（不实际播放） =====
console.log('\n--- 8. 音效接口 ---');
const { AudioManager } = await import('../src/js/audio.js');
const am = new AudioManager();
const newSfx = ['playAccession', 'playAbdication', 'playAppointOffice', 'playGrantTitle',
  'playTradeIncome', 'playCaravanDepart', 'playCultureBoom', 'playExamSelect',
  'playDynastyFall', 'playUnifyChina'];
for (const m of newSfx) {
  assert(typeof am[m] === 'function', `音效方法存在: ${m}`);
}

// ===== 9. 动画接口存在性 =====
console.log('\n--- 9. 动画接口 ---');
const { Animator } = await import('../src/js/animation.js');
assert(Animator._maxParticles >= 150, `粒子上限≥150 (实际${Animator._maxParticles})`);
// 测试新粒子生成（不依赖 ctx）
Animator._maxParticles = 150;
Animator.spawnParticle(100, 100, 'accession_gold');
Animator.spawnParticle(100, 100, 'trade_coin');
assert(Animator.particles.length > 0, '新粒子类型生成成功');

console.log(`\n=== 测试结果: ${passed} 通过, ${failed} 失败 ===`);
process.exit(failed > 0 ? 1 : 0);
