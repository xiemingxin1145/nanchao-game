// ============================================================
// smoke.mjs — V2.0 核心系统冒烟测试
// 运行：node --experimental-default-type=module test/smoke.mjs
// 覆盖：装备穿卸 / 阵型切换 / 建筑建造 / 羁绊检测 / 兵种进阶 / 贸易路线
// ============================================================
import assert from 'node:assert';
import { Game } from '../src/js/game.js';
import { checkBonds } from '../src/js/equipment.js';
import { getFormationBag, FORMATION_COUNTER } from '../src/js/formation.js';
import { BUILDINGS, getBuildingBag } from '../src/js/building.js';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
}

console.log('== V2.0 核心系统冒烟测试 ==');

// 构造一局游戏（玩家选南梁）
const game = new Game();
game.initGame('nanchao');

// ---------- 1. 装备穿戴/卸下 ----------
console.log('\n[1] 装备系统');
const chen = game.getGeneral('chen_baxian');
const forceBefore = chen.effForce;
game.getInventory('nanchao').push('fangtian_ji'); // 方天画戟 武力+15
t('库存包含方天画戟', () => {
  assert.ok(game.getInventory('nanchao').includes('fangtian_ji'));
});
t('装备方天画戟后武力+15', () => {
  const r = game.equipItem('chen_baxian', 'weapon', 'fangtian_ji');
  assert.ok(r.ok, r.msg);
  assert.strictEqual(chen.equipment.weapon, 'fangtian_ji');
  assert.strictEqual(chen.effForce, forceBefore + 15);
});
t('卸下后回到库存且武力还原', () => {
  const r = game.unequipItem('chen_baxian', 'weapon');
  assert.ok(r.ok, r.msg);
  assert.strictEqual(chen.equipment.weapon, null);
  assert.strictEqual(chen.effForce, forceBefore);
  assert.ok(game.getInventory('nanchao').includes('fangtian_ji'));
});
t('槽位错配拒绝穿戴', () => {
  game.getInventory('nanchao').push('mingguang_kai');
  const r = game.equipItem('chen_baxian', 'weapon', 'mingguang_kai');
  assert.ok(!r.ok);
});

// ---------- 2. 阵型切换 ----------
console.log('\n[2] 阵型系统');
const army = game.armies[0];
t('默认阵型为鹤翼', () => {
  assert.strictEqual(game.getFormation(army.id), 'heyi');
});
t('切换为锋矢阵', () => {
  const r = game.setFormation(army.id, 'fengshi');
  assert.ok(r.ok, r.msg);
  assert.strictEqual(game.getFormation(army.id), 'fengshi');
});
t('克制关系正确', () => {
  assert.strictEqual(FORMATION_COUNTER.fengshi, 'yanxing');
  // 锋矢克雁形：克制成功应 +15% 全兵
  const bag = getFormationBag('fengshi', 'yanxing');
  const bagNoCounter = getFormationBag('fengshi', 'heyi');
  assert.ok(bag.allUnitMult > bagNoCounter.allUnitMult, '克制应加攻击');
});

// ---------- 3. 建筑建造 ----------
console.log('\n[3] 城市建筑树');
const jiankang = game.getCity('jiankang');
t('建造农田成功', () => {
  const r = game.buildBuilding('jiankang', 'farm');
  assert.ok(r.ok, r.msg);
  assert.strictEqual(jiankang.buildings['farm'], 1);
});
t('每城每回合仅建一个（第二次被拒）', () => {
  const r = game.buildBuilding('jiankang', 'market');
  assert.ok(!r.ok);
});
t('建筑聚合效果正确（农田1级 +8农业 +5%粮）', () => {
  const bag = getBuildingBag(jiankang.buildings);
  assert.strictEqual(bag.agriFlat, 8);
  assert.strictEqual(bag.foodMult, 0.05);
});
t('码头不可建于非河流城市', () => {
  const r = game.buildBuilding('yecheng', 'dock'); // 邺城非玩家，应先拒权
  assert.ok(!r.ok);
});

// ---------- 4. 羁绊检测 ----------
console.log('\n[4] 羁绊系统');
t('高欢+斛律光 激活「北齐双璧」', () => {
  const { activated, bag } = checkBonds(new Set(['gao_huan', 'hu_luguang', 'yuwen_tai']));
  assert.ok(activated.some(b => b.id === 'beiqi_shuangbi'));
  assert.ok(Math.abs(bag.cavalryMult - 0.20) < 1e-9);
});
t('缺一员不激活', () => {
  const { activated } = checkBonds(new Set(['gao_huan']));
  assert.ok(!activated.some(b => b.id === 'beiqi_shuangbi'));
});

// ---------- 5. 兵种进阶 ----------
console.log('\n[5] 兵种进阶');
t('校场不足时进阶被拒', () => {
  const r = game.advanceUnit('jiankang', army.id, 'infantry');
  assert.ok(!r.ok);
});
t('校场3级后进阶进入待整训，1回合后生效', () => {
  jiankang.buildings['drill'] = 3;
  const res = game.getPlayerRes();
  res.money = 99999; res.food = 99999;
  const r = game.advanceUnit('jiankang', army.id, 'infantry');
  assert.ok(r.ok, r.msg);
  assert.strictEqual(army.unitTier.infantry, 0); // 尚未生效
  assert.strictEqual(army.pendingUpgrades.length, 1);
  // 回合推进
  const done = army.endTurn();
  assert.strictEqual(army.unitTier.infantry, 1);
  assert.strictEqual(done.length, 1);
});

// ---------- 6. 贸易路线 ----------
console.log('\n[6] 贸易路线');
const jiangling = game.getCity('jiangling');
t('需先有市集才能建商路', () => {
  const r = game.establishTradeRoute('jiankang', 'jiangling');
  assert.ok(!r.ok);
});
t('两市集建成后可建商路，收入公式正确', () => {
  jiankang.buildings['market'] = 1;
  jiangling.buildings['market'] = 1;
  game.getPlayerRes().money = 99999;
  const r = game.establishTradeRoute('jiankang', 'jiangling');
  assert.ok(r.ok, r.msg);
  // 预期收入 = (建康comm 90 + 江陵comm 60) × 5% = 7.5 ≈ 8
  const expect = Math.round((jiankang.comm + jiangling.comm) * 0.05);
  assert.strictEqual(game.calcTradeIncome(), expect);
});
t('最多 5 条商路', () => {
  jiankang.buildings['market'] = 1;
  const c3 = game.getCity('chengdu'); c3.owner = 'nanchao'; c3.buildings = { market: 1 };
  const c4 = game.getCity('guangzhou'); c4.owner = 'nanchao'; c4.buildings = { market: 1 };
  const c5 = game.getCity('xiangyang'); c5.owner = 'nanchao'; c5.buildings = { market: 1 };
  game.getPlayerRes().money = 99999;
  game.establishTradeRoute('jiankang', 'chengdu');
  game.establishTradeRoute('jiankang', 'guangzhou');
  game.establishTradeRoute('jiankang', 'xiangyang');
  game.establishTradeRoute('chengdu', 'jiangling');
  // 第 6 条应被拒
  const before = game.getTradeRoutes().length;
  const r = game.establishTradeRoute('chengdu', 'guangzhou');
  assert.ok(!r.ok);
  assert.strictEqual(game.getTradeRoutes().length, Math.min(before, 5));
});

// ---------- 7. 存档兼容 ----------
console.log('\n[7] 存档兼容');
t('序列化/反序列化新字段无损', () => {
  const snap = game.serialize();
  const g2 = Game.deserialize(snap);
  assert.ok(Array.isArray(g2.tradeRoutes));
  const g2army = g2.armies.find(a => a.id === army.id);
  assert.strictEqual(g2army.formation, 'fengshi');
  const g2gen = g2.getGeneral('chen_baxian');
  assert.deepStrictEqual(Object.keys(g2gen.equipment).sort(), ['armor', 'mount', 'treasure', 'weapon'].sort());
  assert.ok(g2.getCity('jiankang').buildings);
});

console.log(`\n== 全部通过：${passed} 项 ==`);
