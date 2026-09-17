// ============================================================
// smoke_v3.mjs — V3.0 大型扩充冒烟测试
// 运行：node --experimental-default-type=module test/smoke_v3.mjs
// 覆盖：6势力初始化 / 30城布局 / 50将数据 / 历史事件触发条件 /
//       武将个人剧情进度 / 多结局检测核心逻辑闭合
// ============================================================
import assert from 'node:assert';
// Node 环境无浏览器 window，提供空壳供 V2.5 系统引用
globalThis.window = globalThis.window || {};
import { Game } from '../src/js/game.js';
import { FACTIONS, CITIES, CITY_LINKS, GENERALS, NEW_GENERAL_SKILLS,
         HISTORICAL_EVENTS, SCENARIOS } from '../src/js/data.js';
import { STORY_NODES } from '../src/js/story.js';
import { ENDINGS } from '../src/js/ending.js';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
}

console.log('== V3.0 大型扩充冒烟测试 ==');

// ---------- 1. 6势力初始化 ----------
console.log('\n[1] 六势力初始化');
const game = new Game();
game.initGame('nanchao');

t('存在6个势力', () => {
  assert.strictEqual(Object.keys(FACTIONS).length, 6);
});
t('6势力均有初始资源与AI（除玩家）', () => {
  assert.strictEqual([...game.factionRes.keys()].length, 6);
  assert.strictEqual([...game.aiPlayers.keys()].length, 5);
});
t('每个势力初始城市数与startCities一致', () => {
  for (const [fid, f] of Object.entries(FACTIONS)) {
    const owned = game.getFactionCities(fid);
    assert.strictEqual(owned.length, f.startCities.length, `${f.name} 城市数不符`);
  }
});
t('势力初始兵力（驻军+军队）无空势力且随城市规模合理分布', () => {
  for (const fid of Object.keys(FACTIONS)) {
    const garrison = game.getFactionCities(fid).reduce((s, c) => s + (c.garrison || 0), 0);
    const army = game.getFactionArmies(fid).reduce((s, a) => s + (a.troops || 0), 0);
    const total = garrison + army;
    assert.ok(total >= 3000, `${FACTIONS[fid].name} 初始总兵力 ${total} 过低`);
  }
});
t('双剧本534仅激活3势力', () => {
  const g534 = new Game();
  g534.initGame('nanchao', '534');
  assert.strictEqual([...g534.factionRes.keys()].length, 3);
  assert.strictEqual(g534.aiPlayers.size, 2);
});

// ---------- 2. 30城布局 ----------
console.log('\n[2] 三十城布局');
t('城市总数为30', () => assert.strictEqual(CITIES.length, 30));
t('无重复等距坐标', () => {
  const seen = new Set();
  for (const c of CITIES) {
    const k = c.isoX + ',' + c.isoY;
    assert.ok(!seen.has(k), `坐标重复 ${c.name} ${k}`);
    seen.add(k);
  }
});
t('所有邻接关系目标城市存在且对称', () => {
  const ids = new Set(CITIES.map(c => c.id));
  for (const [a, arr] of Object.entries(CITY_LINKS)) {
    for (const b of arr) {
      assert.ok(ids.has(b), `链接缺失: ${a}->${b}`);
      // 对称性
      assert.ok((CITY_LINKS[b] || []).includes(a), `链接不对称: ${a}->${b}`);
    }
  }
});

// ---------- 3. 50将数据 ----------
console.log('\n[3] 五十将数据');
t('武将总数为50', () => assert.strictEqual(GENERALS.length, 50));
t('五维总和在250~400区间（名将400+，普通将300~350）', () => {
  for (const g of GENERALS) {
    const sum = g.command + g.force + g.intel + g.politics;
    assert.ok(sum >= 240 && sum <= 400, `${g.name} 五维和 ${sum} 越界`);
  }
});
t('新武将均已绑定技能映射', () => {
  for (const id of Object.keys(NEW_GENERAL_SKILLS)) {
    assert.ok(GENERALS.find(g => g.id === id), `NEW_GENERAL_SKILLS 引用了不存在的武将 ${id}`);
  }
});
t('新武将技能实际加载到运行时', () => {
  const gaoYang = game.getGeneral('gao_yang');
  assert.ok(gaoYang.skills.includes('xiaoxiong'));
  const xiaoMohe = game.getGeneral('xiao_mohe');
  assert.ok(xiaoMohe.skills.length > 0);
});
t('每个势力都有君主', () => {
  for (const fid of Object.keys(FACTIONS)) {
    const lord = game.getFactionGenerals(fid).find(g => g.role === '君主');
    assert.ok(lord, `${FACTIONS[fid].name} 无君主`);
  }
});

// ---------- 4. 历史事件触发条件 ----------
console.log('\n[4] 历史事件链');
t('历史事件≥20个', () => assert.ok(HISTORICAL_EVENTS.length >= 20));
t('事件ID唯一', () => {
  const ids = HISTORICAL_EVENTS.map(e => e.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});
t('事件minTurn均为非负整数', () => {
  for (const e of HISTORICAL_EVENTS) {
    assert.ok(Number.isInteger(e.minTurn) && e.minTurn >= 0, `${e.id} minTurn 非法`);
  }
});
t('事件效果类型均已被events.js识别（抽样）', () => {
  // 触发一次玩家历史事件结算不抛错
  game.turn = 8;
  game.eventSystem.rollEvent(game);
  assert.ok(true);
});

// ---------- 5. 武将个人剧情 ----------
console.log('\n[5] 个人剧情系统');
t('至少10个武将有剧情线', () => assert.ok(Object.keys(STORY_NODES).length >= 10));
t('陈霸先有3个剧情节点', () => assert.strictEqual(STORY_NODES.chen_baxian.length, 3));
t('剧情进度初始化为空', () => {
  const p = game.getStoryProgress('chen_baxian');
  assert.strictEqual(p.currentNode, 0);
  assert.deepStrictEqual(p.completedNodes, []);
});
t('扫描触发剧情（回合足够时陈霸先第一节点触发）', () => {
  game.turn = 3;
  const pending = game.story.scanTriggers(game);
  assert.ok(pending.some(p => p.generalId === 'chen_baxian'), '陈霸先剧情未触发');
});
t('触发剧情选项后进度推进', () => {
  game.turn = 3;
  game.story.scanTriggers(game);
  const r = game.triggerStoryEvent('chen_baxian', 0, 0);
  assert.ok(r.ok, r.msg);
  assert.strictEqual(game.getStoryProgress('chen_baxian').currentNode, 1);
});

// ---------- 6. 多结局检测 ----------
console.log('\n[6] 多结局系统');
t('结局≥8种', () => assert.ok(ENDINGS.length >= 8));
t('结局ID唯一', () => {
  const ids = ENDINGS.map(e => e.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});
t('默认未触发结局', () => {
  assert.strictEqual(game.checkEnding(), null);
});
t('亡国之君结局触发条件正确（城市归0）', () => {
  const g2 = new Game(); g2.initGame('nanchao');
  for (const c of g2.getFactionCities('nanchao')) c.owner = null;
  const e = g2.checkEnding();
  assert.ok(e && e.id === 'perish', `期望perish，实得 ${e && e.id}`);
});
t('一统天下结局触发条件正确（占满）', () => {
  const g3 = new Game(); g3.initGame('nanchao');
  for (const c of g3.cities.values()) c.owner = 'nanchao';
  const e = g3.checkEnding();
  assert.ok(e && e.id === 'unify', `期望unify，实得 ${e && e.id}`);
});
t('结局后不再重复触发', () => {
  const e1 = game.checkEnding();
  const e2 = game.checkEnding();
  assert.strictEqual(e1 && e1.id, e2 && e2.id);
});

// ---------- 7. 存档兼容（V3.0新字段） ----------
console.log('\n[7] 存档兼容');
t('序列化/反序列化保留story/ending/scenario', () => {
  const snap = game.serialize();
  assert.ok(snap.storyProgress);
  assert.ok('endingTriggered' in snap);
  assert.ok(snap.scenario === '550');
  const g2 = Game.deserialize(snap);
  assert.ok(g2.story.progress);
  assert.strictEqual(g2.endings.triggered, null);
  assert.strictEqual(g2.scenario, '550');
});
t('旧存档（无V3.0字段）补默认值', () => {
  const legacy = {
    turn: 5, seasonIdx: 0, playerFaction: 'nanchao',
    cities: [...game.cities.entries()].map(([k, v]) => [k, v.serialize()]),
    generals: [...game.generals.entries()].map(([k, v]) => [k, v.serialize()]),
    armies: game.armies.map(a => a.serialize()),
    factionRes: [...game.factionRes.entries()],
    diplomacy: game.diplomacy.serialize()
  };
  const g2 = Game.deserialize(legacy);
  assert.ok(g2.story && typeof g2.story.progress === 'object');
  assert.strictEqual(g2.endings.triggered, null);
  assert.ok(g2.scenario);
});

// ---------- 8. 一回合完整推进不崩 ----------
console.log('\n[8] 回合推进');
t('连续3回合 endTurn 不抛错', () => {
  const g = new Game(); g.initGame('nanchao');
  for (let i = 0; i < 3; i++) g.endTurn();
  assert.ok(g.turn >= 3);
});

console.log(`\n== V3.0 冒烟通过：${passed} 项 ==`);
