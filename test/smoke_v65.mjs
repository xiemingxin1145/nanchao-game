// ============================================================
// smoke_v65.mjs — V6.5 冒烟测试
// 验证：新武将数据、新城市数据、新事件、新剧本、数据完整性、存档读写
// ============================================================
import { GENERALS, CITIES, CITY_LINKS, EVENTS, HISTORICAL_EVENTS,
         SCENARIOS, FACTIONS, NEW_GENERAL_SKILLS } from '../src/js/data.js';
import { General, createInitialGenerals } from '../src/js/general.js';
import { City, createInitialCities } from '../src/js/city.js';
import { BONDS, checkBonds, getItem } from '../src/js/equipment.js';
import { RIVER_CITIES } from '../src/js/navy.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.log(`  ✗ FAIL: ${msg}`); }
}

console.log('=== V6.5 冒烟测试 ===\n');

// ===== 1. 武将数量验证 =====
console.log('--- 1. 武将数量验证（50→60）---');
assert(GENERALS.length >= 60, `武将总数 >= 60 (实际${GENERALS.length})`);

const newGenerals = ['du_sengming', 'gao_yue', 'hu_luxian', 'yu_chijiong',
  'li_bi', 'he_ruodun', 'yuan_jingshan', 'ren_zhong', 'fan_yi', 'wei_xuan'];
for (const gid of newGenerals) {
  const g = GENERALS.find(x => x.id === gid);
  assert(g !== undefined, `新武将 ${gid} 存在`);
  if (g) {
    assert(g.command >= 1 && g.command <= 100, `${gid} 统帅有效(${g.command})`);
    assert(g.force >= 1 && g.force <= 100, `${gid} 武力有效(${g.force})`);
    assert(g.intel >= 1 && g.intel <= 100, `${gid} 智力有效(${g.intel})`);
    assert(g.politics >= 1 && g.politics <= 100, `${gid} 政治有效(${g.politics})`);
  }
}

// ===== 2. 武将技能映射验证 =====
console.log('\n--- 2. 武将技能映射验证 ---');
for (const gid of newGenerals) {
  const skills = NEW_GENERAL_SKILLS[gid];
  assert(skills !== undefined, `${gid} 有技能映射`);
}

// ===== 3. 城市数量验证 =====
console.log('\n--- 3. 城市数量验证（30→35）---');
assert(CITIES.length >= 35, `城市总数 >= 35 (实际${CITIES.length})`);

const newCities = ['jiangxia', 'nanyang', 'runan', 'qiaojun', 'hefei'];
for (const cid of newCities) {
  const c = CITIES.find(x => x.id === cid);
  assert(c !== undefined, `新城市 ${cid} 存在`);
  if (c) {
    assert(c.pop > 0, `${cid} 人口>0 (${c.pop})`);
    assert(c.isoX >= 0 && c.isoY >= 0, `${cid} 坐标有效 (${c.isoX},${c.isoY})`);
    assert(c.terrain, `${cid} 地形=${c.terrain}`);
  }
}

// ===== 4. 城市坐标不重叠验证 =====
console.log('\n--- 4. 城市坐标不重叠验证 ---');
const coordMap = new Map();
let overlapFound = false;
for (const c of CITIES) {
  const key = `${c.isoX},${c.isoY}`;
  if (coordMap.has(key)) {
    console.log(`  ✗ FAIL: 坐标重叠 ${key}: ${coordMap.get(key)} 和 ${c.id}`);
    overlapFound = true;
  }
  coordMap.set(key, c.id);
}
assert(!overlapFound, '所有城市坐标无重叠');

// ===== 5. CITY_LINKS 完整性验证 =====
console.log('\n--- 5. CITY_LINKS 完整性验证 ---');
let brokenLinks = 0;
for (const [from, tos] of Object.entries(CITY_LINKS)) {
  for (const to of tos) {
    if (!CITIES.find(c => c.id === to)) {
      console.log(`  ✗ FAIL: ${from} -> ${to} 目标城市不存在`);
      brokenLinks++;
    }
    // 双向性检查
    const backLinks = CITY_LINKS[to] || [];
    if (!backLinks.includes(from)) {
      console.log(`  ✗ FAIL: ${to} -> ${from} 缺少反向连接`);
      brokenLinks++;
    }
  }
}
assert(brokenLinks === 0, `CITY_LINKS 无断裂/单向 (${brokenLinks}个问题)`);

// 新城市都有连接
for (const cid of newCities) {
  const links = CITY_LINKS[cid];
  assert(links && links.length >= 2, `${cid} 有${links ? links.length : 0}个连接 (≥2)`);
}

// ===== 6. 河流城市验证 =====
console.log('\n--- 6. 河流城市验证 ---');
assert(RIVER_CITIES.includes('jiangxia'), '江夏是河流城市');
assert(RIVER_CITIES.includes('jiankang'), '建康是河流城市');

// ===== 7. 事件数量验证 =====
console.log('\n--- 7. 事件数量验证 ---');
assert(EVENTS.length >= 40, `随机事件≥40 (实际${EVENTS.length})`);
assert(HISTORICAL_EVENTS.length >= 25, `历史事件≥25 (实际${HISTORICAL_EVENTS.length})`);

// 验证新随机事件
const newEventIds = ['taibai_jingtian', 'establish_taixue', 'recruit_camp',
  'price_inflation', 'royal_succession', 'famous_doctor', 'trade_routes_broken',
  'border_farming', 'literary_boom', 'hu_merchant_horses', 'wall_donation',
  'scholar_flees', 'baihong_guanri', 'craftsman_contest', 'nomad_market'];
for (const eid of newEventIds) {
  const e = EVENTS.find(x => x.id === eid);
  assert(e !== undefined, `新随机事件 ${eid} 存在`);
  if (e) {
    assert(e.options && e.options.length >= 1, `${eid} 有选项`);
    assert(e.description && e.description.length > 0, `${eid} 有描述`);
  }
}

// 验证新历史事件
const newHistEvents = ['erzhu_rong_hetian', 'chen_baikuan', 'yuwen_hu_regent',
  'gao_wei_ainin', 'yang_jian_shouchan'];
for (const eid of newHistEvents) {
  const e = HISTORICAL_EVENTS.find(x => x.id === eid);
  assert(e !== undefined, `新历史事件 ${eid} 存在`);
}

// ===== 8. 剧本数量验证 =====
console.log('\n--- 8. 剧本数量验证（V7.5：8→10）---');
assert(Object.keys(SCENARIOS).length === 10, `剧本总数=10 (实际${Object.keys(SCENARIOS).length})`);
assert(SCENARIOS['523'], '剧本7：六镇起义(523) 存在');
assert(SCENARIOS['588'], '剧本8：隋文统一(588) 存在');
if (SCENARIOS['523']) {
  assert(SCENARIOS['523'].factions.length >= 3, '523剧本势力≥3');
  assert(SCENARIOS['523'].resources, '523剧本有资源配置');
}
if (SCENARIOS['588']) {
  assert(SCENARIOS['588'].factions.length >= 2, '588剧本势力≥2');
  assert(SCENARIOS['588'].garrisonMult, '588剧本有驻军倍率');
}

// ===== 9. 武将序列化/反序列化 =====
console.log('\n--- 9. 武将序列化/反序列化 ---');
const testGen = new General(GENERALS.find(g => g.id === 'du_sengming'));
const ser = testGen.serialize();
const deser = General.deserialize(ser);
assert(deser.name === '杜僧明', '武将序列化/反序列化正确');
assert(deser.skills.length >= 1, '武将技能保留');

// ===== 10. 城市序列化/反序列化 =====
console.log('\n--- 10. 城市序列化/反序列化 ---');
const testCity = new City(CITIES.find(c => c.id === 'jiangxia'));
const serCity = testCity.serialize();
const deserCity = City.deserialize(serCity);
assert(deserCity.name === '江夏', '城市序列化/反序列化正确');
assert(deserCity.religion, '城市宗教字段存在');

// ===== 11. 羁绊系统验证 =====
console.log('\n--- 11. 羁绊系统验证 ---');
assert(BONDS.length >= 15, `羁绊总数≥15 (实际${BONDS.length})`);
const chenBond = BONDS.find(b => b.id === 'chen_chu_kaijiang');
assert(chenBond, '陈朝开疆羁绊存在');
if (chenBond) {
  const { activated } = checkBonds(['chen_baxian', 'zhou_wenyu', 'du_sengming']);
  assert(activated.length > 0, '陈朝开疆羁绊可激活');
}

// ===== 12. 新武将立绘文件验证 =====
console.log('\n--- 12. 新武将立绘文件验证 ---');
import('fs').then(fs => {
  const portraitDir = new URL('../assets/portraits/', import.meta.url).pathname;
  for (const gid of newGenerals) {
    const p = portraitDir + gid + '.png';
    assert(fs.existsSync(p), `立绘 ${gid}.png 存在`);
  }

  console.log(`\n=== 测试结果: ${passed} 通过, ${failed} 失败 ===`);
  process.exit(failed > 0 ? 1 : 0);
});
