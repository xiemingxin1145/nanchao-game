// ============================================================
// smoke_v40.mjs — V4.0 全面冒烟测试（50+ 断言）
// 覆盖：战斗结算、经济收入、科技研究、装备穿戴、阵型切换、
//       建筑建造、事件触发、外交状态、AI决策、存档读写、模组加载
// ============================================================

// Node.js 环境模拟 window 对象（city.js 等模块依赖 window.__game）
globalThis.window = globalThis;
window.__game = null;

import {
  FACTIONS, CITIES, GENERALS, UNIT_TYPES, COUNTER_RELATION, COUNTER_BONUS,
  EVENTS, HISTORICAL_EVENTS, PASSES, BARBARIAN_TRIBES,
  NEW_GENERAL_SKILLS, CITY_LINKS, TERRAIN, SEASON_FOOD_MULT,
  getCityById, getGeneralById, getFactionById, getPassById
} from '../src/js/data.js';
import { Army, computeBattle, clampBonus, startMultiBattle, resolveBattleRound, autoAction } from '../src/js/army.js';
import { City, createInitialCities } from '../src/js/city.js';
import { General, createInitialGenerals } from '../src/js/general.js';
import { TECHS, getTech, isTechAvailable, aggregateTechEffects } from '../src/js/tech.js';
import { getItem, checkBonds, rollForgeItem, maxRarityByWorkshop, EQUIPMENT_ITEMS, BONDS } from '../src/js/equipment.js';
import { getFormation, getFormationBag, FORMATIONS, suggestFormation, DEFAULT_FORMATION } from '../src/js/formation.js';
import { BUILDINGS, buildBuildingOnCity, getBuildingBag, buildingCost } from '../src/js/building.js';
import { SKILLS, getSkill, getGeneralSkills, getActiveSkills } from '../src/js/skills.js';
import { EventSystem } from '../src/js/events.js';
import { DiplomacySystem } from '../src/js/diplomacy.js';
import { modManager, deepMerge, clamp, deepClone } from '../src/js/modding.js';

let passed = 0, failed = 0;
const results = [];

function assert(condition, msg) {
  if (condition) {
    passed++;
    results.push(`  ✓ ${msg}`);
  } else {
    failed++;
    results.push(`  ✗ FAIL: ${msg}`);
  }
}

function assertEqual(actual, expected, msg) {
  const ok = actual === expected;
  assert(ok, `${msg} (expected=${expected}, actual=${actual})`);
}

console.log('========================================');
console.log('  南北朝 V4.0 冒烟测试');
console.log('========================================\n');

// ============================================================
// 1. 数据完整性测试 (10 项)
// ============================================================
console.log('【1. 数据完整性】');
assert(Object.keys(FACTIONS).length >= 6, `势力数量 >= 6 (实际: ${Object.keys(FACTIONS).length})`);
assert(CITIES.length >= 30, `城市数量 >= 30 (实际: ${CITIES.length})`);
assert(GENERALS.length >= 50, `武将数量 >= 50 (实际: ${GENERALS.length})`);
assert(Object.keys(UNIT_TYPES).length >= 3, `兵种数量 >= 3 (实际: ${Object.keys(UNIT_TYPES).length})`);
assert(TECHS.length === 18, `科技数量 = 18 (实际: ${TECHS.length})`);
assert(Object.keys(EQUIPMENT_ITEMS).length >= 30, `装备数量 >= 30 (实际: ${Object.keys(EQUIPMENT_ITEMS).length})`);
assert(Object.keys(FORMATIONS).length === 6, `阵型数量 = 6 (实际: ${Object.keys(FORMATIONS).length})`);
assert(Object.keys(BUILDINGS).length >= 8, `建筑数量 >= 8 (实际: ${Object.keys(BUILDINGS).length})`);
assert(EVENTS.length >= 10, `随机事件 >= 10 (实际: ${EVENTS.length})`);
assert(HISTORICAL_EVENTS.length >= 15, `历史事件 >= 15 (实际: ${HISTORICAL_EVENTS.length})`);

// ============================================================
// 2. 战斗结算测试 (10 项)
// ============================================================
console.log('\n【2. 战斗结算】');
const atkSide = {
  troops: 5000, unitType: 'cavalry', unitCoeff: 1.3,
  general: { command: 80, force: 85, intel: 70, name: '测试将' },
  bags: []
};
const defSide = {
  troops: 3000, unitType: 'archer', unitCoeff: 1.1,
  general: { command: 60, force: 55, intel: 60, name: '守城将' },
  bags: [], cityDefense: 50
};
const battleResult = computeBattle(atkSide, defSide, 'plain', 'plain');
assert(typeof battleResult.attackerWin === 'boolean', 'computeBattle 返回 attackerWin 布尔值');
assert(battleResult.attackerLoss >= 0, '攻方损失 >= 0');
assert(battleResult.defenderLoss >= 0, '守方损失 >= 0');
assert(battleResult.attackerLoss <= atkSide.troops, '攻方损失不超过初始兵力');
assert(battleResult.defenderLoss <= defSide.troops, '守方损失不超过初始兵力');

// 0 兵力边界
const zeroAtk = { troops: 0, unitType: 'infantry', unitCoeff: 1.0, general: {command:50,force:50,intel:50}, bags: [] };
const zeroDef = { troops: 1000, unitType: 'infantry', unitCoeff: 1.0, general: {command:50,force:50,intel:50}, bags: [] };
const r1 = computeBattle(zeroAtk, zeroDef, 'plain', 'plain');
assert(r1.draw === true, '0攻方兵力 → 平局');

const r2 = computeBattle(zeroDef, zeroAtk, 'plain', 'plain');
assert(r2.attackerWin === true, '0守方兵力 → 攻方胜');

// clampBonus 测试
assert(clampBonus(0.5) === 0.5, 'clampBonus(0.5) = 0.5');
assert(clampBonus(2.0) === 1.0, 'clampBonus(2.0) 封顶 1.0');
assert(clampBonus(-1.5) === -0.9, 'clampBonus(-1.5) 下限 -0.9');

// ============================================================
// 3. 经济收入测试 (5 项)
// ============================================================
console.log('\n【3. 经济收入】');
const testCity = new City(CITIES[0]); // jiankang
testCity.owner = 'test_faction';
testCity.morale = 60;
testCity.garrison = 5000;

// 模拟 window.__game 不存在时的降级
const income = testCity.calcIncome('春');
assert(income > 0, `城市金钱收入 > 0 (实际: ${income})`);
const food = testCity.calcFood('秋');
assert(food > 0, `城市粮草产出 > 0 (实际: ${food})`);

// 征兵费用计算
const recruitResult = testCity.recruit('infantry', 100, { money: 1000, food: 1000 });
assert(recruitResult.ok === true, '征兵成功');
assert(testCity.garrison === 5100, `征兵后驻军增加 (实际: ${testCity.garrison})`);

// 建筑费用曲线
const cost0 = buildingCost(0);
const cost5 = buildingCost(5);
const cost9 = buildingCost(9);
assert(cost0 === 150, `建筑0级费用=150 (实际: ${cost0})`);
assert(cost9 > cost5 && cost5 > cost0, '建筑费用随等级递增');

// ============================================================
// 4. 科技研究测试 (5 项)
// ============================================================
console.log('\n【4. 科技研究】');
const tech1 = getTech('m1');
assert(tech1 !== null, '科技 m1 存在');
assert(tech1.cost === 500, `科技 m1 费用=500 (实际: ${tech1.cost})`);
assert(isTechAvailable('m1', [], null) === true, 'm1 无前置可研究');
assert(isTechAvailable('m2', [], null) === false, 'm2 需前置 m1');
const agg = aggregateTechEffects(['m1', 'm2']);
assert(agg.cavalryMult === 0.15, `m1+m2 骑兵加成=0.15 (实际: ${agg.cavalryMult})`);

// ============================================================
// 5. 装备系统测试 (5 项)
// ============================================================
console.log('\n【5. 装备系统】');
const legItem = getItem('fangtian_ji');
assert(legItem !== null && legItem.rarity === 'legendary', '传说装备方天画戟存在');
assert(legItem.stats.force === 15, `方天画戟武力+15 (实际: ${legItem.stats.force})`);
const fineItem = getItem('mu_qiang');
assert(fineItem.rarity === 'fine', '精良装备木枪存在');
const maxRar = maxRarityByWorkshop(9);
assert(maxRar === 'legendary', `工坊9级可造传说 (实际: ${maxRar})`);
const forged = rollForgeItem(9, () => 0.99);
assert(forged !== null, '工坊打造返回装备ID');

// ============================================================
// 6. 阵型系统测试 (5 项)
// ============================================================
console.log('\n【6. 阵型系统】');
const defaultForm = getFormation(DEFAULT_FORMATION);
assert(defaultForm.name === '鹤翼阵', '默认阵型为鹤翼阵');
const bag = getFormationBag('fengshi', 'yanxing');
assert(bag.cavalryMult === 0.25, `锋矢阵骑兵+0.25 (实际: ${bag.cavalryMult})`);
const counterBag = getFormationBag('fengshi', 'yanxing');
assert(counterBag.allUnitMult !== undefined, '阵型克制加成存在');
const suggest = suggestFormation('cavalry');
assert(suggest === 'fengshi', '骑兵推荐锋矢阵');
const noCounter = getFormationBag('heyi', 'fengshi');
assert(noCounter.allUnitMult === 0.10, '鹤翼阵无克制，全兵种+10%');

// ============================================================
// 7. 建筑系统测试 (4 项)
// ============================================================
console.log('\n【7. 建筑系统】');
const bBag = getBuildingBag({ farm: 3, market: 2 });
assert(bBag.agriFlat === 24, `3级农田农业+24 (实际: ${bBag.agriFlat})`);
assert(Math.abs(bBag.foodMult - 0.15) < 0.001, `3级农田粮草+15% (实际: ${bBag.foodMult})`);
assert(bBag.commFlat === 16, `2级市集商业+16 (实际: ${bBag.commFlat})`);
const testCity2 = new City(CITIES[0]);
testCity2.owner = 'test';
const bResult = buildBuildingOnCity(testCity2, 'farm', { money: 500 });
assert(bResult.ok === true, '建造农田成功');

// ============================================================
// 8. 事件系统测试 (4 项)
// ============================================================
console.log('\n【8. 事件系统】');
const evtSys = new EventSystem();
assert(Array.isArray(evtSys.pendingEvents), '事件系统初始化正常');
const droughtEvt = EVENTS.find(e => e.id === 'drought');
assert(droughtEvt !== undefined, '旱灾事件存在');
assert(droughtEvt.options.length === 2, '旱灾有2个选项');
const serialEvt = evtSys.serialize();
assert(serialEvt.history !== undefined, '事件系统序列化正常');

// ============================================================
// 9. 外交状态机测试 (4 项)
// ============================================================
console.log('\n【9. 外交状态机】');
const dip = new DiplomacySystem();
const rel = dip.getRelation('nanchao', 'dongwei');
assert(rel !== undefined, '获取外交关系成功');
assert(rel.alliance === false, '初始无同盟');
const allianceResult = dip.proposeAlliance('nanchao', 'dongwei');
assert(allianceResult.ok === true, '结盟成功');
assert(dip.getRelation('nanchao', 'dongwei').alliance === true, '结盟后同盟状态为true');

// ============================================================
// 10. 模组系统测试 (5 项)
// ============================================================
console.log('\n【10. 模组系统】');
assert(typeof deepMerge === 'function', 'deepMerge 函数存在');
assert(typeof modManager === 'object', 'modManager 单例存在');
assert(typeof modManager.loadMods === 'function', 'loadMods 方法存在');
assert(typeof modManager.applyMods === 'function', 'applyMods 方法存在');
// deepMerge 测试
const testBase = { a: 1, b: { c: 2 } };
const testMod = { b: { c: 99, d: 3 } };
deepMerge(testBase, testMod);
assert(testBase.b.c === 99 && testBase.b.d === 3, 'deepMerge 正确合并嵌套对象');
// clamp 测试
assert(clamp(5, 0, 10) === 5, 'clamp(5,0,10)=5');
assert(clamp(-1, 0, 10) === 0, 'clamp(-1,0,10)=0');
assert(clamp(15, 0, 10) === 10, 'clamp(15,0,10)=10');

// ============================================================
// 11. 武将系统测试 (5 项)
// ============================================================
console.log('\n【11. 武将系统】');
const genData = GENERALS.find(g => g.id === 'gao_huan');
assert(genData !== undefined, '高欢数据存在');
assert(genData.command === 92, `高欢统帅=92 (实际: ${genData.command})`);
const gen = new General(genData);
assert(gen.level === 1, '新武将等级=1');
assert(gen.exp === 0, '新武将经验=0');
const ups = gen.gainExp(130);
assert(gen.exp === 10 && gen.level === 2, `获得130经验升级到2级 (exp=${gen.exp}, level=${gen.level})`);

// ============================================================
// 12. 军队/多回合战斗测试 (4 项)
// ============================================================
console.log('\n【12. 多回合战斗】');
const aSide2 = {
  faction: 'test', generalId: 'test',
  general: { command: 80, force: 85, intel: 70, name: '攻' },
  troops: 5000, unitType: 'cavalry', unitCoeff: 1.3, bags: [],
  cityDefense: 0, activeSkillList: []
};
const dSide2 = {
  faction: 'def', generalId: 'test2',
  general: { command: 60, force: 55, intel: 60, name: '守' },
  troops: 3000, unitType: 'infantry', unitCoeff: 1.0, bags: [],
  cityDefense: 50, activeSkillList: []
};
const battle = startMultiBattle(aSide2, dSide2, { siege: true, cityDefense: 50 });
assert(battle.round === 1, '多回合战斗从第1回合开始');
assert(battle.phase === 'active', '战斗状态为active');
const roundResult = resolveBattleRound(battle, 'storm', 'steady');
assert(battle.round === 2, '回合推进到第2回合');
assert(battle.attacker.troops < 5000, '攻方兵力有损耗');

// ============================================================
// 13. 羁绊系统测试 (3 项)
// ============================================================
console.log('\n【13. 羁绊系统】');
const bondResult = checkBonds(['chen_baxian', 'hou_zhen']);
assert(bondResult.activated.length > 0, '君臣同心羁绊激活');
assert(bondResult.bag.allUnitMult === 0.15, `君臣同心全兵种+0.15 (实际: ${bondResult.bag.allUnitMult})`);
const noBond = checkBonds(['chen_baxian']);
assert(noBond.activated.length === 0, '单人不触发羁绊');

// ============================================================
// 汇总
// ============================================================
console.log('\n========================================');
console.log(`  测试结果: ${passed} 通过, ${failed} 失败, 共 ${passed + failed} 项`);
console.log('========================================');
if (failed > 0) {
  console.log('\n失败项:');
  results.filter(r => r.includes('FAIL')).forEach(r => console.log(r));
  process.exit(1);
} else {
  console.log('\n✓ 全部通过！');
}
