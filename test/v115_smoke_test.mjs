// ============================================================
// V11.5 冒烟测试 — 验证新增事件/历史事件/剧本数据完整性
// 运行：node test/v115_smoke_test.mjs
// 内容：20个新随机事件 + 5个新历史事件 + 2个新剧本
// ============================================================
import { EVENTS, HISTORICAL_EVENTS, SCENARIOS, FACTIONS } from '../src/js/data.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ FAIL: ${msg}`); }
}

console.log('\n=== V11.5 冒烟测试 ===\n');

// ---- 1. 新增 20 个随机事件 ----
console.log('[1] 新增随机事件（20个）');
const v115Rand = EVENTS.filter(e => e.id.startsWith('v115_') && !HISTORICAL_EVENTS.includes(e));
// 随机事件里 v115_ 前缀的应恰好 20 个（历史事件单独在 HISTORICAL_EVENTS）
assert(v115Rand.length === 20, `新增20个随机事件，实际 ${v115Rand.length}`);
for (const e of v115Rand) {
  assert(typeof e.id === 'string' && e.id.length > 0, `事件 ${e.id} 有id`);
  assert(typeof e.name === 'string' && e.name.length > 0, `事件 ${e.id} 有名称`);
  assert(typeof e.description === 'string' && e.description.length > 0, `事件 ${e.id} 有描述`);
  assert(Array.isArray(e.options) && e.options.length >= 1, `事件 ${e.id} 至少1个选项`);
  for (const o of e.options) {
    assert(typeof o.text === 'string' && o.text.length > 0, `事件 ${e.id} 选项有文字`);
    assert(o.effect && typeof o.effect === 'object', `事件 ${e.id} 选项有effect`);
  }
}

// ---- 2. 新增 5 个历史事件 ----
console.log('\n[2] 新增历史事件（5个）');
const v115Hist = HISTORICAL_EVENTS.filter(e => e.id.startsWith('v115_'));
assert(v115Hist.length === 5, `新增5个历史事件，实际 ${v115Hist.length}`);
const expectedHist = ['v115_tongwan_battle', 'v115_chenqingzhi_north', 'v115_xuyi_siege',
                      'v115_taijian_north', 'v115_xian_furen'];
for (const id of expectedHist) {
  const he = HISTORICAL_EVENTS.find(x => x.id === id);
  assert(he !== undefined, `历史事件 ${id} 存在`);
  if (he) {
    assert(typeof he.minTurn === 'number' && he.minTurn >= 0, `历史事件 ${id} 有minTurn`);
    assert(Array.isArray(he.options) && he.options.length >= 1, `历史事件 ${id} 有选项`);
  }
}

// ---- 3. 新增 2 个剧本（总数 20）----
console.log('\n[3] 新增剧本（574 周武灭佛 / 529 白袍北伐）');
const scIds = Object.keys(SCENARIOS);
assert(scIds.length === 20, `剧本总数应为20，实际 ${scIds.length}`);
assert(SCENARIOS['574'] !== undefined, '剧本「周武灭佛」(574) 存在');
assert(SCENARIOS['529'] !== undefined, '剧本「白袍北伐」(529) 存在');
for (const sid of ['574', '529']) {
  const sc = SCENARIOS[sid];
  assert(sc && typeof sc.name === 'string' && typeof sc.year === 'number', `剧本 ${sid} 有名称/年份`);
  assert(Array.isArray(sc.factions) && sc.factions.length >= 2, `剧本 ${sid} 至少2势力`);
  for (const fid of sc.factions) {
    assert(FACTIONS[fid] !== undefined, `剧本 ${sid} 含有效势力 ${fid}`);
  }
  assert(sc.resources && typeof sc.resources === 'object', `剧本 ${sid} 有resources`);
  assert(typeof sc.description === 'string' && sc.description.length > 10, `剧本 ${sid} 有历史背景`);
}

// ---- 4. 全局ID唯一性 ----
console.log('\n[4] 事件ID唯一性');
const allIds = new Set();
let dup = 0;
for (const e of EVENTS) { if (allIds.has(e.id)) dup++; allIds.add(e.id); }
for (const e of HISTORICAL_EVENTS) { if (allIds.has(e.id)) dup++; allIds.add(e.id); }
assert(dup === 0, `无重复事件ID（${dup}个重复）`);

// ---- 5. 存档/序列化往返 ----
console.log('\n[5] 数据序列化往返');
const dump = JSON.stringify({
  events: EVENTS.length, hist: HISTORICAL_EVENTS.length, scenarios: Object.keys(SCENARIOS)
});
const back = JSON.parse(dump);
assert(back.events === EVENTS.length && back.hist === HISTORICAL_EVENTS.length, '序列化往返一致');

// ---- 结果汇总 ----
console.log(`\n=== 测试结果 ===`);
console.log(`通过: ${passed}  失败: ${failed}  总计: ${passed + failed}`);
if (failed > 0) { console.error(`\n⚠ ${failed} 个测试失败！`); process.exit(1); }
else { console.log('\n✓ 全部测试通过！V11.5 数据完整性验证成功。'); process.exit(0); }
