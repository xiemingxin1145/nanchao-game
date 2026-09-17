// ============================================================
// smoke_v60.mjs — V6.0 冒烟测试
// 验证：水战规则、水军建造/移动、宗教系统、文化值、存档读写
// ============================================================
import { NAVY_UNITS, NAVY_UNIT_KEYS, RIVER_CITIES, GROTTO_CITIES,
         isNavalBattle, applyWaterTerrainMod, checkFireAttack,
         canBuildNavy, getNavyMoveableCities, isWaterLink,
         FIRE_ATTACK_PENALTY } from '../src/js/navy.js';
import { ReligionSystem, calcCityCulturePerTurn, calcFactionCulture,
         CULTURE_VICTION_THRESHOLD, RELIGION_BUILDINGS,
         canBuildGrotto, getGrottoBuildCost } from '../src/js/religion.js';
import { UNIT_TYPES, CITIES, CITY_LINKS } from '../src/js/data.js';
import { BUILDINGS } from '../src/js/building.js';
import { City } from '../src/js/city.js';
import { Army, computeBattle, startMultiBattle, resolveBattleRound } from '../src/js/army.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.log(`  ✗ FAIL: ${msg}`); }
}

console.log('=== V6.0 冒烟测试 ===\n');

// ===== 1. 水军兵种定义 =====
console.log('--- 1. 水军兵种定义 ---');
assert(NAVY_UNITS.louchuan, '楼船兵种存在');
assert(NAVY_UNITS.mengchong, '蒙冲兵种存在');
assert(NAVY_UNITS.douchian, '斗舰兵种存在');
assert(NAVY_UNITS.louchuan.waterBonus === 1.5, '楼船水战+50%');
assert(NAVY_UNITS.mengchong.waterBonus === 1.6, '蒙冲水战+60%');
assert(NAVY_UNITS.mengchong.speed === 2, '蒙冲移动速度2');
assert(UNIT_TYPES.louchuan, '楼船已注册到UNIT_TYPES');
assert(UNIT_TYPES.mengchong, '蒙冲已注册到UNIT_TYPES');
assert(UNIT_TYPES.douchian, '斗舰已注册到UNIT_TYPES');

// ===== 2. 水战地形判定 =====
console.log('\n--- 2. 水战地形判定 ---');
assert(isNavalBattle('jiankang', 'yingcheng') === true, '建康↔郢城为水战');
assert(isNavalBattle('jiankang', 'jiangling') === true, '建康↔江陵为水战');
assert(isNavalBattle('yecheng', 'jinyang') === false, '邺城↔晋阳非水战');
assert(applyWaterTerrainMod('louchuan', true) === 1.5, '楼船在水上×1.5');
assert(applyWaterTerrainMod('infantry', true) === 0.7, '步兵在水上×0.7');
assert(applyWaterTerrainMod('louchuan', false) === 0.3, '楼船在陆上×0.3');
assert(applyWaterTerrainMod('infantry', false) === 1.0, '步兵在陆上×1.0');

// ===== 3. 火攻机制 =====
console.log('\n--- 3. 火攻机制 ---');
const fireResult = checkFireAttack(80, true, 'favorable');
assert(fireResult.chance > 0, '火攻概率>0');
assert(fireResult.chance <= 0.6, '火攻概率≤60%');
assert(FIRE_ATTACK_PENALTY === 0.70, '火攻惩罚×0.70');

// ===== 4. 河流城市标记 =====
console.log('\n--- 4. 河流城市标记 ---');
assert(RIVER_CITIES.includes('jiankang'), '建康是河流城市');
assert(RIVER_CITIES.includes('yingcheng'), '郢城是河流城市');
assert(RIVER_CITIES.includes('guangzhou'), '广州是河流城市');
assert(GROTTO_CITIES.includes('pingcheng'), '平城可建石窟');
assert(GROTTO_CITIES.includes('luoyang'), '洛阳可建石窟');
assert(GROTTO_CITIES.includes('jiankang'), '建康可建石窟');

// ===== 5. 水军建造条件 =====
console.log('\n--- 5. 水军建造条件 ---');
const jiankangCity = new City(CITIES.find(c => c.id === 'jiankang'));
jiankangCity.buildings = { dock: 5 }; // 码头5级
assert(canBuildNavy(jiankangCity) === true, '建康码头5级可建水军');
jiankangCity.buildings = { dock: 2 }; // 码头2级
assert(canBuildNavy(jiankangCity) === false, '码头2级不可建水军');
const yechengCity = new City(CITIES.find(c => c.id === 'yecheng'));
yechengCity.buildings = { dock: 10 };
assert(canBuildNavy(yechengCity) === false, '邺城非河流城市不可建水军');

// ===== 6. 宗教建筑定义 =====
console.log('\n--- 6. 宗教建筑定义 ---');
assert(BUILDINGS.buddhist_temple, '佛寺建筑存在');
assert(BUILDINGS.daoist_temple, '道观建筑存在');
assert(BUILDINGS.grotto, '石窟建筑存在');
assert(BUILDINGS.buddhist_temple.perLevel.moralePerTurn === 2, '佛寺每级民心+2');
assert(BUILDINGS.grotto.maxLevel === 3, '石窟最高3级');

// ===== 7. 宗教文化系统 =====
console.log('\n--- 7. 宗教文化系统 ---');
const testCity = new City(CITIES.find(c => c.id === 'pingcheng'));
testCity.buildings = { buddhist_temple: 2, grotto: 1 };
testCity.religion = { buddhist: 2, daoist: 0, culture: 100 };
const cultureGain = calcCityCulturePerTurn(testCity);
assert(cultureGain > 0, `每回合文化产出>0 (实际${cultureGain})`);
assert(cultureGain >= 2 + 10 + 10, '文化产出=基础2+佛寺10+石窟10');

// 文化胜利检测
const rs = new ReligionSystem();
assert(rs.cultureStreak === 0, '初始文化连胜=0');
assert(CULTURE_VICTION_THRESHOLD === 1000, '文化胜利阈值=1000');

// ===== 8. 石窟建造检查 =====
console.log('\n--- 8. 石窟建造检查 ---');
assert(canBuildGrotto(testCity) === true, '平城可建石窟');
assert(canBuildGrotto(new City(CITIES.find(c => c.id === 'wujun'))) === false, '吴郡不可建石窟');
const grottoCost = getGrottoBuildCost();
assert(grottoCost.money === 1000, '石窟建造成本1000金');
assert(grottoCost.turns === 3, '石窟建造3回合');

// ===== 9. 战斗结算边界 =====
console.log('\n--- 9. 战斗结算边界 ---');
// 0兵力边界
const zeroResult = computeBattle(
  { troops: 0, unitCoeff: 1, general: {command: 50, force: 50, intel: 50, name: 'A'}, bags: [], unitType: 'infantry', cityId: 'jiankang' },
  { troops: 1000, unitCoeff: 1, general: {command: 50, force: 50, intel: 50, name: 'D'}, bags: [], unitType: 'infantry', cityId: 'yingcheng' }
);
assert(zeroResult.draw === true, '攻方0兵→平局');

// 守方0兵
const winResult = computeBattle(
  { troops: 1000, unitCoeff: 1, general: {command: 50, force: 50, intel: 50, name: 'A'}, bags: [], unitType: 'infantry', cityId: 'jiankang' },
  { troops: 0, unitCoeff: 1, general: {command: 50, force: 50, intel: 50, name: 'D'}, bags: [], unitType: 'infantry', cityId: 'yingcheng' }
);
assert(winResult.attackerWin === true, '守方0兵→攻方胜');

// ===== 10. 序列化/反序列化 =====
console.log('\n--- 10. 序列化/反序列化 ---');
const serCity = testCity.serialize();
assert(serCity.religion !== undefined, 'City序列化包含religion');
assert(serCity.religion.culture === 100, '文化值序列化正确');
const deserCity = City.deserialize(serCity);
assert(deserCity.religion.culture === 100, '文化值反序列化正确');

// 旧存档兼容（无religion字段）
const oldSer = { id: 'test', name: 'Test', isoX: 5, isoY: 5, terrain: 'plain', size: 2, pop: 10000, agri: 50, comm: 50, defense: 50, prosperity: 50, taxRate: 30 };
const oldCity = City.deserialize(oldSer);
assert(oldCity.religion !== undefined, '旧存档补religion字段');
assert(oldCity.religion.culture === 0, '旧存档文化值默认0');

// 宗教系统序列化
const rsSer = rs.serialize();
assert(rsSer.cultureStreak === 0, '宗教系统序列化');
const rsDeser = ReligionSystem.deserialize(rsSer);
assert(rsDeser.cultureStreak === 0, '宗教系统反序列化');

// ===== 11. 水军移动规则 =====
console.log('\n--- 11. 水军移动规则 ---');
const mockCities = new Map();
for (const c of CITIES) mockCities.set(c.id, new City(c));
const navyArmy = new Army({ factionId: 'nanchao', generalId: 'chen_baxian', cityId: 'jiankang', troops: 3000, unitMix: { louchuan: 3000 } });
navyArmy.isNavy = true;
const movable = getNavyMoveableCities(navyArmy, mockCities);
assert(movable.includes('yingcheng') || movable.includes('jiangzhou'), '水军可移动到相邻水路城市');

// ===== 12. 建筑效果袋 =====
console.log('\n--- 12. 宗教建筑效果袋 ---');
const { getBuildingBag } = await import('../src/js/building.js');
const relBag = getBuildingBag({ buddhist_temple: 3, daoist_temple: 2, grotto: 1 });
assert(relBag.moralePerTurn === 6, `佛寺3级民心+6 (实际${relBag.moralePerTurn})`);
assert(relBag.culturePerTurn >= 21, `文化产出>21 (实际${relBag.culturePerTurn})`);

console.log(`\n=== 测试结果: ${passed} 通过, ${failed} 失败 ===`);
process.exit(failed > 0 ? 1 : 0);
