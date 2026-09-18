// ============================================================
// smoke_v105.mjs — V10.5 深度精修 冒烟测试
// 验证：新增随机事件(20) / 新增历史事件(5) / 新增剧本(2, 14→16) /
//       事件格式完整性 / 剧本势力与城市引用合法性 / 新增音效接口
// ============================================================
import { EVENTS, HISTORICAL_EVENTS, SCENARIOS, FACTIONS, CITIES } from '../src/js/data.js';
import { EventSystem } from '../src/js/events.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.log(`  ✗ FAIL: ${msg}`); }
}
const unique = (arr) => new Set(arr).size === arr.length;

console.log('=== V10.5 深度精修 冒烟测试 ===\n');

// ===== 1. 新增随机事件（20个，v105_ 前缀）=====
console.log('--- 1. 新增随机事件（V10.5） ---');
const v105Random = EVENTS.filter(e => /^v105_/.test(e.id));
console.log(`  新增随机事件数：${v105Random.length}`);
assert(v105Random.length === 20, `新增随机事件=20（实际${v105Random.length}）`);

// 每个新事件格式完整
for (const e of v105Random) {
  assert(!!e.name, `事件 ${e.id} 有名称`);
  assert(!!e.description, `事件 ${e.id} 有描述`);
  assert(Array.isArray(e.options) && e.options.length >= 1, `事件 ${e.id} 有选项`);
  if (e.options && e.options[0]) {
    assert(typeof e.options[0].effect === 'object' && e.options[0].effect !== null,
      `事件 ${e.id} 首选项有 effect 对象`);
  }
}
// 随机事件 ID 全局唯一
assert(unique(EVENTS.map(e => e.id)), `EVENTS ID 全局唯一（共${EVENTS.length}）`);

// ===== 2. 新增历史事件（5个，v105_ 前缀）=====
console.log('\n--- 2. 新增历史事件（V10.5） ---');
const v105Hist = HISTORICAL_EVENTS.filter(e => /^v105_/.test(e.id));
console.log(`  新增历史事件数：${v105Hist.length}`);
assert(v105Hist.length === 5, `新增历史事件=5（实际${v105Hist.length}）`);
const expectHist = ['v105_yuanjia_caocao', 'v105_guoshi_zhiyu', 'v105_fengshi_linchao',
                    'v105_damo_dongdu', 'v105_wumingshe_lüliang'];
for (const hid of expectHist) {
  assert(HISTORICAL_EVENTS.find(h => h.id === hid), `历史事件存在: ${hid}`);
}
for (const h of v105Hist) {
  assert(typeof h.minTurn === 'number', `历史事件 ${h.id} 有 minTurn`);
  assert(Array.isArray(h.options) && h.options.length >= 1, `历史事件 ${h.id} 有选项`);
}
assert(unique(HISTORICAL_EVENTS.map(e => e.id)), `HISTORICAL_EVENTS ID 全局唯一（共${HISTORICAL_EVENTS.length}）`);

// ===== 3. 新增剧本（2个，14→16）=====
console.log('\n--- 3. 新增剧本（V10.5） ---');
const scIds = Object.keys(SCENARIOS);
console.log(`  剧本总数：${scIds.length}`);
assert(scIds.length === 16, `剧本总数=16（实际${scIds.length}）`);
assert(SCENARIOS['479'], `新剧本存在: 479 齐初建元`);
assert(SCENARIOS['557'], `新剧本存在: 557 陈先代梁`);
assert(SCENARIOS['479'].year === 479, `剧本479年份正确`);
assert(SCENARIOS['557'].year === 557, `剧本557年份正确`);

// 每个新剧本：势力合法、覆盖字段完整
for (const sid of ['479', '557']) {
  const sc = SCENARIOS[sid];
  assert(Array.isArray(sc.factions) && sc.factions.length >= 2, `剧本${sid}势力数≥2`);
  for (const fid of sc.factions) {
    assert(FACTIONS[fid], `剧本${sid}引用合法势力: ${fid}`);
  }
  assert(typeof sc.description === 'string' && sc.description.length > 10, `剧本${sid}有历史简介`);
  // resources / cityMorale / garrisonMult 覆盖字段齐全
  assert(sc.resources && sc.cityMorale && sc.garrisonMult, `剧本${sid}开局数值覆盖完整`);
}

// 所有剧本引用的势力都必须在 FACTIONS 中
for (const sc of Object.values(SCENARIOS)) {
  for (const fid of sc.factions) {
    assert(!!FACTIONS[fid], `剧本${sc.id}引用合法势力 ${fid}`);
  }
}

// ===== 4. 事件系统接口（applyEvent/summarizeEffect 边界）=====
console.log('\n--- 4. 事件系统边界 ---');
const es = new EventSystem();
// summarizeEffect 对空/undefined 安全
assert(Array.isArray(es.summarizeEffect(null)), 'summarizeEffect(null) 不抛错');
assert(Array.isArray(es.summarizeEffect({})), 'summarizeEffect({}) 不抛错');
// serialize/deserialize 往返
const ser = es.serialize();
const es2 = EventSystem.deserialize(ser);
assert(es2 instanceof EventSystem, 'EventSystem.deserialize 返回实例');
assert(es2.history.length === es.history.length, '事件历史往返一致');

// ===== 5. 新增音效接口（V10.5）=====
console.log('\n--- 5. 新增音效接口 ---');
// 动态构造 AudioManager 不依赖 DOM（audio.js 在 node 下仅类定义可导入）
let audioMethods = null;
try {
  const mod = await import('../src/js/audio.js');
  const proto = mod.AudioManager.prototype;
  audioMethods = {
    upgrade: typeof proto.playUpgradeGlow === 'function',
    trade: typeof proto.playTradeCoins === 'function',
    throne: typeof proto.playEnthroneGold === 'function',
    gate: typeof proto._sfxGate === 'function',
  };
} catch (e) {
  audioMethods = { error: e.message };
}
assert(audioMethods.upgrade, '音效 playUpgradeGlow 存在');
assert(audioMethods.trade, '音效 playTradeCoins 存在');
assert(audioMethods.throne, '音效 playEnthroneGold 存在');
assert(audioMethods.gate, '音效重叠保护 _sfxGate 存在');

// ===== 6. 数据完整性：新事件插画回退 / 无悬空引用 =====
console.log('\n--- 6. 数据完整性 ---');
// 新历史事件 condition 必须可调用或缺失（不抛错）
for (const h of v105Hist) {
  assert(h.condition === undefined || typeof h.condition === 'function',
    `历史事件 ${h.id} condition 类型合法`);
}
// CITIES 引用（所有势力 startCities 城市存在）
let missingCity = 0;
for (const [fid, f] of Object.entries(FACTIONS)) {
  for (const cid of f.startCities) {
    if (!CITIES.find(c => c.id === cid)) missingCity++;
  }
}
assert(missingCity === 0, `所有势力起始城市存在（缺失${missingCity}）`);

// 总结
console.log(`\n=== 结果：${passed} 通过, ${failed} 失败 ===`);
process.exit(failed > 0 ? 1 : 0);
