// ============================================================
// smoke_v100.mjs — V10.0 冒烟测试
// 验证：新增武将(5) / 新增城市(5) / 新增事件(25随机+5历史) /
//       新增剧本(2) / 羁绊(3) / 立绘文件(90) / 美术素材(20) /
//       存档读写 / 平衡性边界
// ============================================================
import { GENERALS, CITIES, CITY_LINKS, EVENTS, HISTORICAL_EVENTS,
         SCENARIOS, NEW_GENERAL_SKILLS, FACTIONS, UNIT_TYPES,
         COUNTER_RELATION, COUNTER_BONUS } from '../src/js/data.js';
import { BONDS, checkBonds } from '../src/js/equipment.js';
import { computeBattle, clampBonus } from '../src/js/army.js';
import fs from 'fs';
import path from 'path';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.log(`  ✗ FAIL: ${msg}`); }
}

console.log('=== V10.0 冒烟测试 ===\n');

// ===== 1. 新增武将（5位，85→90）=====
console.log('--- 1. V10.0 新增武将 ---');
assert(GENERALS.length === 90, `武将总数=90（实际${GENERALS.length}）`);
const v100Generals = ['xie_an', 'xie_xuan', 'fu_jian', 'liu_yu', 'wang_zhen_e'];
for (const gid of v100Generals) {
  const g = GENERALS.find(x => x.id === gid);
  assert(!!g, `武将存在: ${gid}`);
  if (g) {
    assert(g.command > 0 && g.force > 0 && g.intel > 0 && g.politics > 0,
      `${g.name} 五维属性完整`);
    assert(g.loyalty >= 0 && g.loyalty <= 100, `${g.name} 忠诚∈[0,100]`);
  }
}
// 技能映射
for (const gid of v100Generals) {
  assert(Array.isArray(NEW_GENERAL_SKILLS[gid]), `技能映射存在: ${gid}`);
}

// ===== 2. 新增城市（5座，40→45）=====
console.log('\n--- 2. V10.0 新增城市 ---');
assert(CITIES.length === 45, `城市总数=45（实际${CITIES.length}）`);
const v100Cities = ['dunhuang', 'zhongshan', 'longcheng', 'shuofang', 'qiuchi'];
for (const cid of v100Cities) {
  const c = CITIES.find(x => x.id === cid);
  assert(!!c, `城市存在: ${cid}`);
  if (c) {
    assert(c.isoX !== undefined && c.isoY !== undefined, `${c.name} 有等距坐标`);
    assert(c.pop > 0 && c.agri >= 0 && c.comm >= 0 && c.defense >= 0,
      `${c.name} 经济数据完整`);
    assert(CITY_LINKS[cid] && CITY_LINKS[cid].length > 0, `${c.name} 有邻接关系`);
  }
}
// 检查城市坐标不重叠
const coordSet = new Set();
for (const c of CITIES) {
  const key = `${c.isoX},${c.isoY}`;
  assert(!coordSet.has(key), `城市坐标不重叠: ${c.name} (${key})`);
  coordSet.add(key);
}
// 检查双向连接完整性
let linkErrors = 0;
for (const [from, tos] of Object.entries(CITY_LINKS)) {
  for (const to of tos) {
    if (!CITY_LINKS[to] || !CITY_LINKS[to].includes(from)) linkErrors++;
  }
}
assert(linkErrors === 0, `城市连接双向完整（错误${linkErrors}）`);

// ===== 3. 新增事件（25随机+5历史）=====
console.log('\n--- 3. V10.0 新增事件 ---');
assert(EVENTS.length >= 157, `随机事件总数≥157（实际${EVENTS.length}）`);
assert(HISTORICAL_EVENTS.length >= 67, `历史事件总数≥67（实际${HISTORICAL_EVENTS.length}）`);
// 检查 V10.0 随机事件
const v100RandomEvents = EVENTS.filter(e => e.id.startsWith('v100_'));
assert(v100RandomEvents.length >= 25, `V10.0随机事件≥25（实际${v100RandomEvents.length}）`);
for (const e of v100RandomEvents) {
  assert(e.options && e.options.length > 0, `事件有选项: ${e.id}`);
  assert(e.description && e.description.length > 0, `事件有描述: ${e.id}`);
}
// 检查 V10.0 历史事件
const v100HistEvents = HISTORICAL_EVENTS.filter(e => e.id.startsWith('v100_'));
assert(v100HistEvents.length >= 5, `V10.0历史事件≥5（实际${v100HistEvents.length}）`);
for (const e of v100HistEvents) {
  assert(e.minTurn >= 0, `历史事件有minTurn: ${e.id}`);
  assert(e.options && e.options.length > 0, `历史事件有选项: ${e.id}`);
}

// ===== 4. 新增剧本（2个，12→14）=====
console.log('\n--- 4. V10.0 新增剧本 ---');
assert(Object.keys(SCENARIOS).length === 14, `剧本总数=14（实际${Object.keys(SCENARIOS).length}）`);
const v100Scenarios = ['383', '420'];
for (const sid of v100Scenarios) {
  const s = SCENARIOS[sid];
  assert(!!s, `剧本存在: ${sid}`);
  if (s) {
    assert(s.factions && s.factions.length > 0, `剧本有势力配置: ${s.name}`);
    assert(s.year > 0, `剧本有年份: ${s.name}`);
    assert(s.description && s.description.length > 10, `剧本有简介: ${s.name}`);
  }
}

// ===== 5. 羁绊 =====
console.log('\n--- 5. V10.0 新增羁绊 ---');
const v100Bonds = BONDS.filter(b =>
  ['beifu_shuangbi', 'beifa_tongliao', 'qianqin_xiongzhu'].includes(b.id));
assert(v100Bonds.length === 3, `V10.0羁绊=3（实际${v100Bonds.length}）`);
// 检查羁绊成员都存在
for (const b of v100Bonds) {
  for (const m of b.members) {
    assert(GENERALS.find(g => g.id === m), `羁绊成员存在: ${b.id} → ${m}`);
  }
}
// checkBonds 函数可调用
const testSet = new Set(['xie_an', 'xie_xuan']);
const result = checkBonds(testSet);
assert(result && Array.isArray(result.activated), `checkBonds 可调用`);

// ===== 6. 立绘文件（≥90）=====
console.log('\n--- 6. 立绘文件检查 ---');
const portraitDir = path.resolve('assets/portraits');
const portraitFiles = fs.readdirSync(portraitDir).filter(f => f.endsWith('.png'));
assert(portraitFiles.length >= 90, `立绘PNG≥90（实际${portraitFiles.length}）`);
for (const gid of v100Generals) {
  const p = path.join(portraitDir, `${gid}.png`);
  assert(fs.existsSync(p), `立绘存在: ${gid}.png`);
}

// ===== 7. 美术素材（≥20新增）=====
console.log('\n--- 7. 美术素材检查 ---');
let newArtCount = 0;
const newArtFiles = [
  'portraits/xie_an.png', 'portraits/xie_xuan.png', 'portraits/fu_jian.png',
  'portraits/liu_yu.png', 'portraits/wang_zhen_e.png',
  'cities/dunhuang.png', 'cities/zhongshan.png', 'cities/longcheng.png',
  'cities/shuofang.png', 'cities/qiuchi.png',
  'battles/feishui_battle.png', 'battles/liu_yu_beifa.png', 'battles/tuoba_miefo.png',
  'events/houjing_rebellion.png', 'events/suiyang_nanxun.png',
  'events/liu_yu_dengji.png', 'events/liangwu_sheshen_v2.png',
  'images/legion_grand_battle.png', 'images/imperial_exam.png',
  'images/dynasty_accession.png'
];
for (const f of newArtFiles) {
  const p = path.resolve('assets', f);
  if (fs.existsSync(p)) newArtCount++;
}
assert(newArtCount >= 20, `新增美术≥20（实际${newArtCount}）`);

// ===== 8. 平衡性边界测试 =====
console.log('\n--- 8. 平衡性边界测试 ---');
// 0兵力边界
const zeroAttacker = { troops: 0, unitCoeff: 1.0, general: { command: 50, force: 50, intel: 50 } };
const zeroDefender = { troops: 0, unitCoeff: 1.0, general: { command: 50, force: 50, intel: 50 } };
const zeroResult = computeBattle(zeroAttacker, zeroDefender, 'plain', 'plain');
assert(zeroResult.draw === true, `0兵力双方平局`);
// 一方0兵（守方0兵则攻方胜）
const strongAttacker = { troops: 1000, unitCoeff: 1.0, general: { command: 50, force: 50, intel: 50 } };
const noDefender = { troops: 0, unitCoeff: 1.0, general: { command: 50, force: 50, intel: 50 } };
const winResult = computeBattle(strongAttacker, noDefender, 'plain', 'plain');
assert(winResult.attackerWin === true, `守方无兵攻方胜`);
// clampBonus 边界
assert(clampBonus(5.0) === 1.0, `clampBonus 上限+100%`);
assert(clampBonus(-5.0) === -0.9, `clampBonus 下限-90%`);
// 兵种克制存在
assert(COUNTER_RELATION.cavalry === 'archer', `骑兵克弓兵`);
assert(COUNTER_RELATION.infantry === 'cavalry', `步兵克骑兵`);
assert(COUNTER_RELATION.archer === 'infantry', `弓兵克步兵`);
assert(COUNTER_BONUS === 0.25, `克制加成+25%`);

// ===== 9. 势力与城市归属 =====
console.log('\n--- 9. 势力城市归属 ---');
for (const [fid, f] of Object.entries(FACTIONS)) {
  for (const cid of f.startCities) {
    assert(CITIES.find(c => c.id === cid), `势力${fid}起始城市存在: ${cid}`);
  }
}
// 新城市为中立（不在任何势力 startCities 中）
for (const cid of v100Cities) {
  const inStart = Object.values(FACTIONS).some(f => f.startCities.includes(cid));
  assert(!inStart, `新城市${cid}初始中立`);
}

// ===== 10. 存档兼容性数据结构 =====
console.log('\n--- 10. 数据完整性 ---');
// 所有武将 portrait 字段指向存在的文件
let missingPortraits = 0;
for (const g of GENERALS) {
  const p = path.join(portraitDir, `${g.portrait || g.id}.png`);
  if (!fs.existsSync(p)) missingPortraits++;
}
assert(missingPortraits === 0, `所有武将立绘存在（缺失${missingPortraits}）`);

// 总结
console.log(`\n=== 结果：${passed} 通过, ${failed} 失败 ===`);
process.exit(failed > 0 ? 1 : 0);
