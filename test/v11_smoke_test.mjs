// ============================================================
// V11.0 冒烟测试 — 验证新增数据完整性、存档读写、平衡性
// 运行：node test/v11_smoke_test.mjs
// ============================================================
import { GENERALS, CITIES, EVENTS, HISTORICAL_EVENTS, SCENARIOS,
         FACTIONS, CITY_LINKS, V11_BALANCE, V11_PERFORMANCE,
         NEW_GENERAL_SKILLS, getGeneralById, getCityById } from '../src/js/data.js';
import { BONDS, checkBonds } from '../src/js/equipment.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let passed = 0, failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ FAIL: ${msg}`); }
}

console.log('\n=== V11.0 冒烟测试 ===\n');

// ---- 1. 武将数量验证（95将）----
console.log('[1] 武将数据验证');
assert(GENERALS.length === 95, `武将总数应为95，实际${GENERALS.length}`);

const newGenerals = ['murong_baiyao', 'yuan_ying', 'xing_luan', 'chen_bozhi', 'xue_andu'];
for (const id of newGenerals) {
  const g = getGeneralById(id);
  assert(g !== undefined, `新武将 ${id} 存在`);
  if (g) {
    assert(g.command >= 40 && g.command <= 100, `${id} 统帅合理(${g.command})`);
    assert(g.force >= 30 && g.force <= 100, `${id} 武力合理(${g.force})`);
    assert(g.intel >= 30 && g.intel <= 100, `${id} 智力合理(${g.intel})`);
    assert(g.politics >= 20 && g.politics <= 100, `${id} 政治合理(${g.politics})`);
    assert(g.loyalty >= 30 && g.loyalty <= 100, `${id} 忠诚合理(${g.loyalty})`);
    assert(NEW_GENERAL_SKILLS[id] !== undefined, `${id} 技能映射存在`);
  }
}

// 检查是否有重复ID
const generalIds = new Set();
let dupGenerals = 0;
for (const g of GENERALS) {
  if (generalIds.has(g.id)) { dupGenerals++; console.error(`  重复武将ID: ${g.id}`); }
  generalIds.add(g.id);
}
assert(dupGenerals === 0, `无重复武将ID（${dupGenerals}个重复）`);

// ---- 2. 城市数量验证（50城）----
console.log('\n[2] 城市数据验证');
assert(CITIES.length === 50, `城市总数应为50，实际${CITIES.length}`);

const newCities = ['ningzhou', 'wuxing', 'yuzhang', 'tongwan', 'wuling'];
for (const id of newCities) {
  const c = getCityById(id);
  assert(c !== undefined, `新城市 ${id} 存在`);
  if (c) {
    assert(c.pop >= 5000 && c.pop <= 100000, `${id} 人口合理(${c.pop})`);
    assert(c.agri >= 20 && c.agri <= 100, `${id} 农业合理(${c.agri})`);
    assert(c.comm >= 20 && c.comm <= 100, `${id} 商业合理(${c.comm})`);
    assert(c.defense >= 20 && c.defense <= 100, `${id} 防御合理(${c.defense})`);
    assert(c.isoX >= 0 && c.isoX <= 20, `${id} isoX合理(${c.isoX})`);
    assert(c.isoY >= 0 && c.isoY <= 20, `${id} isoY合理(${c.isoY})`);
  }
}

// 检查城市坐标是否重叠
let overlapCount = 0;
const posMap = new Map();
for (const c of CITIES) {
  const key = `${c.isoX},${c.isoY}`;
  if (posMap.has(key)) {
    overlapCount++;
    console.error(`  城市坐标重叠: ${posMap.get(key)} 与 ${c.id} 在 (${c.isoX},${c.isoY})`);
  }
  posMap.set(key, c.id);
}
assert(overlapCount === 0, `无城市坐标重叠（${overlapCount}个重叠）`);

// 检查 CITY_LINKS 完整性
let linkErrors = 0;
for (const [cityId, links] of Object.entries(CITY_LINKS)) {
  if (!getCityById(cityId)) { console.error(`  CITY_LINKS中未知城市: ${cityId}`); linkErrors++; }
  for (const target of links) {
    if (!getCityById(target)) { console.error(`  CITY_LINKS中${cityId}指向未知城市: ${target}`); linkErrors++; }
    // 双向检查
    const backLinks = CITY_LINKS[target] || [];
    if (!backLinks.includes(cityId)) {
      console.error(`  CITY_LINKS非双向: ${cityId}→${target} 但 ${target}→${cityId} 不存在`);
      linkErrors++;
    }
  }
}
assert(linkErrors === 0, `CITY_LINKS完整且双向（${linkErrors}个错误）`);

// ---- 3. 事件数据验证 ----
console.log('\n[3] 事件数据验证');
assert(EVENTS.length > 100, `随机事件数量充足(${EVENTS.length})`);
assert(HISTORICAL_EVENTS.length > 70, `历史事件数量充足(${HISTORICAL_EVENTS.length})`);

// 检查新随机事件
const v11Events = EVENTS.filter(e => e.id.startsWith('v110_'));
assert(v11Events.length === 20, `V11.0新增20个随机事件，实际${v11Events.length}`);

// 检查新历史事件
const v11HistEvents = HISTORICAL_EVENTS.filter(e => e.id.startsWith('v110_'));
assert(v11HistEvents.length === 5, `V11.0新增5个历史事件，实际${v11HistEvents.length}`);

// ---- 4. 剧本数据验证 ----
console.log('\n[4] 剧本数据验证');
const scenarioIds = Object.keys(SCENARIOS);
assert(scenarioIds.length === 18, `剧本总数应为18，实际${scenarioIds.length}`);
assert(SCENARIOS['450'] !== undefined, '新剧本"元嘉草草"(450)存在');
assert(SCENARIOS['532'] !== undefined, '新剧本"韩陵举义"(532)存在');

// 检查每个剧本的势力配置
for (const [id, sc] of Object.entries(SCENARIOS)) {
  assert(sc.factions.length >= 2, `剧本${id}(${sc.name})至少2个势力`);
  for (const fid of sc.factions) {
    assert(FACTIONS[fid] !== undefined, `剧本${id}包含有效势力${fid}`);
  }
}

// ---- 5. 羁绊数据验证 ----
console.log('\n[5] 羁绊数据验证');
const v11Bonds = BONDS.filter(b => b.members.some(m => newGenerals.includes(m)));
assert(v11Bonds.length >= 3, `V11.0新增羁绊>=3，实际${v11Bonds.length}`);

// 检查羁绊成员是否存在
let bondErrors = 0;
for (const bond of BONDS) {
  for (const m of bond.members) {
    if (!getGeneralById(m)) { console.error(`  羁绊${bond.id}包含未知武将: ${m}`); bondErrors++; }
  }
}
assert(bondErrors === 0, `所有羁绊成员存在（${bondErrors}个错误）`);

// ---- 6. 平衡性调优验证 ----
console.log('\n[6] 平衡性调优验证');
assert(V11_BALANCE.counterBonus >= 0.20 && V11_BALANCE.counterBonus <= 0.35,
  `克制加成合理(${V11_BALANCE.counterBonus})`);
assert(V11_BALANCE.maxTaxRate >= 40 && V11_BALANCE.maxTaxRate <= 60,
  `税率上限合理(${V11_BALANCE.maxTaxRate})`);
assert(V11_PERFORMANCE.maxParticles >= 100 && V11_PERFORMANCE.maxParticles <= 500,
  `粒子上限合理(${V11_PERFORMANCE.maxParticles})`);

// ---- 7. 立绘文件验证 ----
console.log('\n[7] 立绘文件验证');
const portraitsDir = join(__dirname, '../assets/portraits');
let portraitCount = 0;
for (const g of GENERALS) {
  const p = join(portraitsDir, `${g.portrait}.png`);
  if (existsSync(p)) portraitCount++;
  else console.error(`  缺少立绘: ${g.portrait}.png`);
}
assert(portraitCount === 95, `95张立绘文件存在（${portraitCount}/95）`);

// ---- 8. 新城市美术文件验证 ----
console.log('\n[8] 城市美术文件验证');
const citiesDir = join(__dirname, '../assets/cities');
let cityArtCount = 0;
for (const id of newCities) {
  const p = join(citiesDir, `${id}.png`);
  if (existsSync(p)) cityArtCount++;
  else console.error(`  缺少城市图: ${id}.png`);
}
assert(cityArtCount === 5, `5张新城市美术存在（${cityArtCount}/5）`);

// ---- 9. 存档兼容性验证 ----
console.log('\n[9] 存档数据结构验证');
// 模拟存档结构
const mockSave = {
  version: '11.0',
  turn: 10,
  playerFaction: 'nanchao',
  cities: CITIES.map(c => ({ ...c, owner: 'nanchao', garrison: 5000, morale: 60 })),
  generals: GENERALS.map(g => ({ ...g, troops: 1000 })),
  factions: Object.keys(FACTIONS),
  resources: { nanchao: { money: 10000, food: 15000 } }
};
const saveStr = JSON.stringify(mockSave);
const restored = JSON.parse(saveStr);
assert(restored.cities.length === 50, '存档中城市数=50');
assert(restored.generals.length === 95, '存档中武将数=95');
assert(restored.version === '11.0', '存档版本正确');

// ---- 结果汇总 ----
console.log(`\n=== 测试结果 ===`);
console.log(`通过: ${passed}  失败: ${failed}  总计: ${passed + failed}`);
if (failed > 0) {
  console.error(`\n⚠ ${failed} 个测试失败！`);
  process.exit(1);
} else {
  console.log('\n✓ 全部测试通过！V11.0 数据完整性验证成功。');
  process.exit(0);
}
