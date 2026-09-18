// ============================================================
// smoke_v80.mjs — V8.0 冒烟测试
// 验证：科举系统 / 赋税系统 / 徭役系统 / 新增武将(10) / 新增城市(5) / 存档读写
// ============================================================
import { GENERALS, CITIES, CITY_LINKS, NEW_GENERAL_SKILLS, EXAM_SUBJECTS, EXAM_HONORS,
         TAX_LEVELS, TAX_ADJUST_COOLDOWN, CORVEE_TYPES, CORVEE_DURATION,
         EXAM_INTERVAL, EXAM_BUILDING_REQ, EVENTS } from '../src/js/data.js';
import { City } from '../src/js/city.js';
import { BUILDINGS, getBuilding } from '../src/js/building.js';
import { ImperialExamSystem } from '../src/js/imperial_exam.js';
import { checkTaxEvent, aiAdjustTax } from '../src/js/tax.js';
import { checkCorveeEvent, canStartCorvee, getCorveeBag } from '../src/js/corvee.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.log(`  ✗ FAIL: ${msg}`); }
}

console.log('=== V8.0 冒烟测试 ===\n');

// ===== 1. 新增武将验证（10位） =====
console.log('--- 1. 新增武将（10位）---');
const newGeneralIds = [
  'yang_su', 'gao_jiong', 'han_qinhu', 'he_ruobi', 'shi_wansui',
  'li_mu', 'wang_yi', 'su_wei', 'zhangsun_sheng', 'mai_tiezhang'
];
assert(GENERALS.length >= 70, `武将总数 >= 70（实际${GENERALS.length}）`);
for (const gid of newGeneralIds) {
  const g = GENERALS.find(x => x.id === gid);
  assert(g, `武将存在: ${gid}`);
  if (g) {
    assert(g.command && g.force && g.intel && g.politics, `武将 ${gid} 五维完整`);
    assert(g.portrait, `武将 ${gid} 有立绘`);
  }
}
// 技能映射检查
for (const gid of newGeneralIds) {
  assert(Array.isArray(NEW_GENERAL_SKILLS[gid]), `技能映射存在: ${gid}`);
}
console.log(`  武将技能映射数: ${Object.keys(NEW_GENERAL_SKILLS).length}`);

// ===== 2. 新增城市验证（5座） =====
console.log('\n--- 2. 新增城市（5座）---');
const newCityIds = ['huatai', 'guangling', 'xiapi', 'shangdang', 'puban'];
assert(CITIES.length >= 40, `城市总数 >= 40（实际${CITIES.length}）`);
for (const cid of newCityIds) {
  const c = CITIES.find(x => x.id === cid);
  assert(c, `城市存在: ${cid}`);
  if (c) {
    assert(typeof c.isoX === 'number' && typeof c.isoY === 'number', `城市 ${cid} 坐标完整`);
    assert(c.terrain, `城市 ${cid} 有地形`);
    assert(c.pop > 0, `城市 ${cid} 有人口`);
    assert(Array.isArray(CITY_LINKS[cid]), `城市 ${cid} 有连接关系`);
    assert(CITY_LINKS[cid].length >= 2, `城市 ${cid} 至少连接2城`);
  }
}
// 坐标不重叠检查
const coordSet = new Set();
let coordOk = true;
for (const c of CITIES) {
  const key = `${c.isoX},${c.isoY}`;
  if (coordSet.has(key)) { coordOk = false; console.log(`    重叠坐标: ${key} (${c.name})`); }
  coordSet.add(key);
}
assert(coordOk, `所有城市坐标无重叠（共${CITIES.length}城）`);

// ===== 3. 科举系统验证 =====
console.log('\n--- 3. 科举系统 ---');
assert(Object.keys(EXAM_SUBJECTS).length === 3, `科举科目=3（明经/进士/武举）`);
assert(EXAM_SUBJECTS.mingjing && EXAM_SUBJECTS.jinshi && EXAM_SUBJECTS.wuju, `三科完整`);
assert(EXAM_HONORS.zhuangyuan.attrBonus === 5, `状元全属性+5`);
assert(EXAM_HONORS.bangyan.attrBonus === 3, `榜眼全属性+3`);
assert(EXAM_HONORS.tanhua.attrBonus === 2, `探花全属性+2`);
assert(EXAM_INTERVAL === 3, `科举周期=3回合`);

const ie = new ImperialExamSystem();
assert(ie.nextExamTurn === EXAM_INTERVAL + 1, `首次科举在第4回合`);
// 序列化/反序列化
const saved = ie.serialize();
const restored = ImperialExamSystem.deserialize(saved);
assert(restored.nextExamTurn === ie.nextExamTurn, `科举存档读写一致`);
// 旧存档兼容
const oldRestored = ImperialExamSystem.deserialize(null);
assert(oldRestored.nextExamTurn === EXAM_INTERVAL + 1, `旧存档默认值正确`);

// ===== 4. 赋税系统验证 =====
console.log('\n--- 4. 赋税系统 ---');
assert(TAX_LEVELS.length === 5, `赋税等级=5`);
assert(TAX_LEVELS[0].name === '轻徭薄赋', `1级=轻徭薄赋`);
assert(TAX_LEVELS[0].multiplier === 0.70, `轻徭薄赋收入-30%`);
assert(TAX_LEVELS[4].name === '苛捐杂税', `5级=苛捐杂税`);
assert(TAX_LEVELS[4].multiplier === 1.60, `苛捐杂税收入+60%`);
assert(TAX_ADJUST_COOLDOWN === 3, `赋税调整冷却=3回合`);

// 城市赋税等级测试
const testCity = new City(CITIES[0]);
assert(testCity.taxLevel === 2, `默认赋税=2(正常)`);
testCity.taxLevel = 5;
testCity.taxCooldown = 3;
const result = testCity.setTaxLevel(4);
assert(!result.ok, `冷却中调整赋税被拒绝`);
testCity.taxCooldown = 0;
const result2 = testCity.setTaxLevel(1);
assert(result2.ok, `冷却后可调整赋税`);
assert(testCity.taxLevel === 1, `赋税=1(轻徭薄赋)`);
// 序列化/反序列化
const savedCity = testCity.serialize();
const restoredCity = City.deserialize(savedCity);
assert(restoredCity.taxLevel === 1, `赋税等级存档一致`);
assert(restoredCity.taxCooldown === 3, `赋税冷却存档一致`);

// ===== 5. 徭役系统验证 =====
console.log('\n--- 5. 徭役系统 ---');
assert(Object.keys(CORVEE_TYPES).length === 4, `徭役类型=4（建造/城防/水利/运输）`);
assert(CORVEE_DURATION === 3, `徭役持续=3回合`);
assert(CORVEE_TYPES.build.effect.buildSpeedMult === 0.5, `建造徭役加速50%`);

// 城市徭役测试
const testCity2 = new City(CITIES[0]);
testCity2.buildings = { jiangzuojian: 3 };
const check = canStartCorvee(testCity2);
assert(check.ok, `将作监3级可征发徭役`);
const cvResult = testCity2.startCorvee('build');
assert(cvResult.ok, `征发建造徭役成功`);
assert(testCity2.corvee.type === 'build', `徭役类型=build`);
assert(testCity2.corvee.turnsLeft === 3, `徭役持续3回合`);
// 徭役效果袋
const bag = getCorveeBag(testCity2);
assert(bag.buildSpeedMult === 0.5, `徭役效果袋正确`);
// 重复征发
const cvResult2 = testCity2.startCorvee('water');
assert(!cvResult2.ok, `重复征发被拒绝`);
// 取消徭役
const cancelResult = testCity2.cancelCorvee();
assert(cancelResult.ok, `取消徭役成功`);
assert(testCity2.corvee === null, `徭役已清除`);

// ===== 6. 建筑验证 =====
console.log('\n--- 6. 新建筑 ---');
assert(BUILDINGS.taixue, `太学建筑存在`);
assert(BUILDINGS.taixue.maxLevel === 5, `太学最高5级`);
assert(BUILDINGS.jiangzuojian, `将作监建筑存在`);
assert(BUILDINGS.jiangzuojian.maxLevel === 5, `将作监最高5级`);
assert(EXAM_BUILDING_REQ === 'taixue', `科举需太学`);

// ===== 7. 新事件验证 =====
console.log('\n--- 7. 新事件 ---');
const newEventIds = ['tax_rebellion', 'tax_refugees', 'corvee_rebellion', 'corvee_deserters'];
for (const eid of newEventIds) {
  const ev = EVENTS.find(e => e.id === eid);
  assert(ev, `事件存在: ${eid}`);
}

// ===== 8. 存档读写验证 =====
console.log('\n--- 8. 存档读写 ---');
const testCity3 = new City(CITIES[0]);
testCity3.taxLevel = 4;
testCity3.corvee = { type: 'water', turnsLeft: 2 };
const ser = testCity3.serialize();
assert(ser.taxLevel === 4, `序列化赋税等级`);
assert(ser.corvee.type === 'water', `序列化徭役`);
const deser = City.deserialize(ser);
assert(deser.taxLevel === 4, `反序列化赋税等级`);
assert(deser.corvee.turnsLeft === 2, `反序列化徭役回合`);
// 旧存档兼容（无V8字段）
const oldCityData = { id: 'test', name: '测试', isoX: 0, isoY: 0, terrain: 'plain',
  size: 1, capital: false, pop: 10000, agri: 50, comm: 50, defense: 50,
  prosperity: 50, taxRate: 30 };
const oldCity = City.deserialize(oldCityData);
assert(oldCity.taxLevel === 2, `旧存档赋税默认=2`);
assert(oldCity.corvee === null, `旧存档徭役默认=null`);

// ===== 9. 赋税/徭役事件检查函数 =====
console.log('\n--- 9. 事件检查函数 ---');
// 构造 mock game
const mockGame = {
  getFactionCities: () => [
    { taxLevel: 5, morale: 15 }, // 苛捐杂税+民心极低
    { taxLevel: 4, morale: 20 }
  ],
  playerFaction: 'test'
};
const taxEvt = checkTaxEvent(mockGame, 'test');
// 可能返回 null（随机）或事件id，不抛异常即可
assert(typeof taxEvt === 'string' || taxEvt === null, `赋税事件检查函数正常`);

const mockGame2 = {
  getFactionCities: () => [
    { corvee: { type: 'build', turnsLeft: 2 }, morale: 20 },
    { corvee: null, morale: 30 }
  ],
  playerFaction: 'test'
};
const corveeEvt = checkCorveeEvent(mockGame2, 'test');
assert(typeof corveeEvt === 'string' || corveeEvt === null, `徭役事件检查函数正常`);

// ===== 结果汇总 =====
console.log(`\n=== 测试结果：${passed} 通过, ${failed} 失败 ===`);
process.exit(failed > 0 ? 1 : 0);
