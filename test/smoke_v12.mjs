// ============================================================
// V12.0 冒烟测试 — 验证新增武将/城市/事件/剧本/数据完整性
// ============================================================
import { GENERALS, CITIES, SCENARIOS, EVENTS, HISTORICAL_EVENTS, CITY_LINKS, NEW_GENERAL_SKILLS, FACTIONS, UNIT_TYPES, COUNTER_RELATION, COUNTER_BONUS } from '../src/js/data.js';
import { BONDS } from '../src/js/equipment.js';
import fs from 'fs';

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  PASS:', msg); }
  else { fail++; console.log('  FAIL:', msg); }
}

console.log('\n=== V12.0 冒烟测试 ===\n');

// 1. 武将测试 (100位)
console.log('--- 1. 武将数据 ---');
assert(GENERALS.length === 100, `武将总数=100 (实际: ${GENERALS.length})`);
const newGens = ['yuwen_xian','cheng_lingxi','xiao_daocheng','shen_qingzhi','feng_daogen'];
for (const g of newGens) {
  const gen = GENERALS.find(x => x.id === g);
  assert(gen, `新武将 ${g} 存在`);
  if (gen) {
    assert(gen.command >= 0 && gen.command <= 100, `${g} 统帅合理(${gen.command})`);
    assert(gen.force >= 0 && gen.force <= 100, `${g} 武力合理(${gen.force})`);
    assert(gen.intel >= 0 && gen.intel <= 100, `${g} 智力合理(${gen.intel})`);
    assert(gen.politics >= 0 && gen.politics <= 100, `${g} 政治合理(${gen.politics})`);
    assert(gen.loyalty >= 0 && gen.loyalty <= 100, `${g} 忠诚合理(${gen.loyalty})`);
    assert(gen.portrait && fs.existsSync(`./assets/portraits/${gen.portrait}.png`), `${g} 立绘存在`);
  }
}
// 技能映射
for (const g of newGens) {
  assert(NEW_GENERAL_SKILLS[g], `技能映射 ${g} 存在`);
}

// 2. 城市测试 (55座)
console.log('\n--- 2. 城市数据 ---');
assert(CITIES.length === 55, `城市总数=55 (实际: ${CITIES.length})`);
const newCities = ['jingkou','yiyang','zhongli2','licheng','wuchang'];
for (const c of newCities) {
  const city = CITIES.find(x => x.id === c);
  assert(city, `新城市 ${c} 存在`);
  if (city) {
    assert(city.isoX >= 0 && city.isoX <= 20, `${c} isoX合理(${city.isoX})`);
    assert(city.isoY >= 0 && city.isoY <= 20, `${c} isoY合理(${city.isoY})`);
    assert(city.pop > 0, `${c} 人口>0`);
    assert(city.agri >= 0 && city.agri <= 100, `${c} 农业合理`);
    assert(city.comm >= 0 && city.comm <= 100, `${c} 商业合理`);
    assert(city.defense >= 0 && city.defense <= 100, `${c} 防御合理`);
    assert(CITY_LINKS[c], `${c} 有邻接关系`);
    // 坐标不重叠检查
    const dup = CITIES.filter(x => x.isoX === city.isoX && x.isoY === city.isoY);
    assert(dup.length === 1, `${c} 坐标不重叠`);
  }
}

// 3. CITY_LINKS 完整性
console.log('\n--- 3. 城市连接完整性 ---');
const cityIds = new Set(CITIES.map(c => c.id));
let broken = 0;
for (const [from, tos] of Object.entries(CITY_LINKS)) {
  if (!cityIds.has(from)) { console.log('  BROKEN from:', from); broken++; }
  for (const to of tos) {
    if (!cityIds.has(to)) { console.log('  BROKEN:', from, '->', to); broken++; }
  }
}
assert(broken === 0, `无断链 (断链数: ${broken})`);
assert(Object.keys(CITY_LINKS).length === 55, `CITY_LINKS覆盖55城 (实际: ${Object.keys(CITY_LINKS).length})`);

// 4. 事件测试
console.log('\n--- 4. 随机事件 ---');
const v120Events = EVENTS.filter(e => e.id.startsWith('v120_'));
assert(v120Events.length === 20, `新增20个随机事件 (实际: ${v120Events.length})`);
for (const e of v120Events) {
  assert(e.name && e.description && e.options && e.options.length >= 1, `事件 ${e.id} 格式完整`);
  for (const opt of e.options) {
    assert(opt.text && opt.effect, `事件 ${e.id} 选项完整`);
  }
}

// 5. 历史事件测试
console.log('\n--- 5. 历史事件 ---');
const v120HistEvents = HISTORICAL_EVENTS.filter(e => e.id.startsWith('v120_'));
assert(v120HistEvents.length === 5, `新增5个历史事件 (实际: ${v120HistEvents.length})`);
for (const e of v120HistEvents) {
  assert(e.name && e.description, `历史事件 ${e.id} 格式完整`);
  assert(typeof e.minTurn === 'number', `历史事件 ${e.id} 有minTurn`);
}

// 6. 剧本测试
console.log('\n--- 6. 剧本 ---');
assert(Object.keys(SCENARIOS).length === 24, `剧本总数=24 (实际: ${Object.keys(SCENARIOS).length})`);
const newScenarios = ['416', '526'];
for (const s of newScenarios) {
  assert(SCENARIOS[s], `新剧本 ${s} 存在`);
  if (SCENARIOS[s]) {
    assert(SCENARIOS[s].name && SCENARIOS[s].year, `剧本 ${s} 元数据完整`);
    assert(SCENARIOS[s].factions && SCENARIOS[s].factions.length >= 2, `剧本 ${s} 势力配置完整`);
  }
}

// 7. 羁绊测试
console.log('\n--- 7. 羁绊 ---');
const v120Bonds = BONDS.filter(b => {
  const newGenIds = new Set(newGens);
  return b.members.some(m => newGenIds.has(m));
});
assert(v120Bonds.length >= 5, `新增至少5个羁绊 (实际: ${v120Bonds.length})`);

// 8. 平衡性常量测试
console.log('\n--- 8. 平衡性常量 ---');
assert(COUNTER_BONUS > 0 && COUNTER_BONUS < 0.5, `兵种克制系数合理(${COUNTER_BONUS})`);
assert(Object.keys(COUNTER_RELATION).length === 3, `兵种克制关系完整`);
assert(Object.keys(UNIT_TYPES).length >= 5, `兵种类型完整(含水军)`);

// 9. 立绘数量测试
console.log('\n--- 9. 美术素材 ---');
const portraitFiles = fs.readdirSync('./assets/portraits').filter(f => f.endsWith('.png'));
assert(portraitFiles.length === 100, `立绘总数=100 (实际: ${portraitFiles.length})`);

// 10. 存档兼容性（版本号）
console.log('\n--- 10. 数据一致性 ---');
// 所有武将 faction 必须有效（null 表示在野）
const validFids = new Set([...Object.keys(FACTIONS), null]);
let badFaction = 0;
for (const g of GENERALS) {
  if (!validFids.has(g.faction)) { console.log('  BAD faction:', g.id, g.faction); badFaction++; }
}
assert(badFaction === 0, `所有武将势力有效 (异常: ${badFaction})`);

// 11. 新城市初始势力归属测试
console.log('\n--- 11. 新城归属 ---');
for (const c of newCities) {
  const city = CITIES.find(x => x.id === c);
  assert(city && city.owner === undefined, `新城 ${c} 无预设归属(开局按剧本分配)`);
}

console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
process.exit(fail > 0 ? 1 : 0);
