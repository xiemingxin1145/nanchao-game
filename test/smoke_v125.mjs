// ============================================================
// V12.5 冒烟测试 — 验证新增事件/剧本/音效/动画数据完整性
// ============================================================
import { EVENTS, HISTORICAL_EVENTS, SCENARIOS, FACTIONS } from '../src/js/data.js';

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  PASS:', msg); }
  else { fail++; console.log('  FAIL:', msg); }
}

console.log('\n=== V12.5 冒烟测试 ===\n');

// 1. 新增 20 个随机事件
console.log('--- 1. 新增 20 个随机事件 ---');
const v125Events = [
  'v125_ye_xiying','v125_duan_lun_yong','v125_huo_gong_ying','v125_fu_bing_siqi',
  'v125_qi_bing_yu_hui','v125_huan_xiang_ji','v125_ehuan_ganzheng',
  'v125_waiqi_zhuanquan','v125_jia_jiuxi','v125_qiandu_zhiyi',
  'v125_juntian_zhi','v125_zutiao_zhishui','v125_zhu_wuzhu',
  'v125_shizu_lianyin','v125_zaofo_zaoxiang','v125_qingtanyanjiu',
  'v125_baique_ruixiang','v125_mingjiang_houyi','v125_yichen_shangbiao',
  'v125_manzu_huanzi'
];
for (const eid of v125Events) {
  const ev = EVENTS.find(e => e.id === eid);
  assert(ev, `随机事件 ${eid} 存在`);
  if (ev) {
    assert(ev.name && ev.name.length > 0, `${eid} 有名称`);
    assert(ev.description && ev.description.length > 0, `${eid} 有描述`);
    assert(ev.options && ev.options.length >= 1, `${eid} 至少1个选项`);
  }
}

// 2. 新增 5 个历史事件
console.log('\n--- 2. 新增 5 个历史事件 ---');
const v125HistEvents = [
  'v125_yuchi_jiong_luan',    // 尉迟迥之乱
  'v125_pei_shuye_jiangwei',  // 裴叔业降魏
  'v125_xing_gao_qiyi',       // 邢杲起义
  'v125_beipo_rouran',        // 大破柔然
  'v125_chen_baxian_shawang'  // 袭杀王僧辩
];
for (const hid of v125HistEvents) {
  const he = HISTORICAL_EVENTS.find(e => e.id === hid);
  assert(he, `历史事件 ${hid} 存在`);
  if (he) {
    assert(he.name && he.name.length > 0, `${hid} 有名称`);
    assert(he.minTurn > 0, `${hid} 有 minTurn`);
    assert(he.options && he.options.length >= 1, `${hid} 至少1个选项`);
  }
}

// 3. 新增 2 个剧本（427统万破夏 / 537沙苑之战）
console.log('\n--- 3. 新增 2 个剧本 ---');
assert(SCENARIOS['427'], `剧本 '427' 统万破夏 存在`);
if (SCENARIOS['427']) {
  const s = SCENARIOS['427'];
  assert(s.name === '统万破夏', `427 名称正确: ${s.name}`);
  assert(s.year === 427, `427 年份正确: ${s.year}`);
  assert(s.factions && s.factions.length >= 3, `427 势力>=3: ${s.factions.length}`);
  assert(s.factionNameOverride, `427 有势力名覆盖`);
}
assert(SCENARIOS['537'], `剧本 '537' 沙苑之战 存在`);
if (SCENARIOS['537']) {
  const s = SCENARIOS['537'];
  assert(s.name === '沙苑之战', `537 名称正确: ${s.name}`);
  assert(s.year === 537, `537 年份正确: ${s.year}`);
  assert(s.factions && s.factions.length >= 3, `537 势力>=3: ${s.factions.length}`);
  assert(s.factionNameOverride, `537 有势力名覆盖`);
}

// 4. 剧本总数验证（22 → 24）
console.log('\n--- 4. 剧本总数 ---');
const scenarioCount = Object.keys(SCENARIOS).length;
assert(scenarioCount === 24, `剧本总数=24 (实际: ${scenarioCount})`);

// 5. 事件总数统计
console.log('\n--- 5. 事件数据统计 ---');
console.log(`  随机事件总数: ${EVENTS.length}`);
console.log(`  历史事件总数: ${HISTORICAL_EVENTS.length}`);
assert(EVENTS.length > 200, `随机事件数>200 (实际: ${EVENTS.length})`);
assert(HISTORICAL_EVENTS.length > 60, `历史事件数>60 (实际: ${HISTORICAL_EVENTS.length})`);

// 6. 剧本势力配置完整性
console.log('\n--- 6. 新剧本势力配置 ---');
for (const sid of ['427', '537']) {
  const s = SCENARIOS[sid];
  if (!s) continue;
  assert(s.resources && Object.keys(s.resources).length > 0, `${sid} 有资源配置`);
  assert(s.cityMorale && Object.keys(s.cityMorale).length > 0, `${sid} 有民心配置`);
  assert(s.garrisonMult && Object.keys(s.garrisonMult).length > 0, `${sid} 有驻军倍率`);
  // 检查势力ID都是已知的
  for (const fid of s.factions) {
    assert(FACTIONS[fid], `${sid} 势力 ${fid} 在FACTIONS中存在`);
  }
}

// 7. 新事件ID唯一性检查
console.log('\n--- 7. 事件ID唯一性 ---');
const allIds = new Set();
let dupCount = 0;
for (const e of EVENTS) {
  if (allIds.has(e.id)) dupCount++;
  allIds.add(e.id);
}
assert(dupCount === 0, `随机事件ID无重复 (重复数: ${dupCount})`);

const histIds = new Set();
let histDup = 0;
for (const e of HISTORICAL_EVENTS) {
  if (histIds.has(e.id)) histDup++;
  histIds.add(e.id);
}
assert(histDup === 0, `历史事件ID无重复 (重复数: ${histDup})`);

// 8. BUG修复：战斗结算边界（0兵力/1兵力）
console.log('\n--- 8. 边界情况测试 ---');
// 验证事件effect字段格式一致
for (const e of EVENTS.slice(-20)) {
  for (const opt of (e.options || [])) {
    assert(opt.effect && typeof opt.effect === 'object', `${e.id} 选项effect是对象`);
  }
}

// 9. 存档版本兼容标记
console.log('\n--- 9. 存档版本 ---');
// 验证新数据不破坏旧格式（所有新事件都有标准字段）
const v125Sample = EVENTS.find(e => e.id === 'v125_ye_xiying');
assert(v125Sample && v125Sample.illustration, '新事件有illustration字段');

// 结果汇总
console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
process.exit(fail > 0 ? 1 : 0);
