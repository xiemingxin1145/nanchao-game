// ============================================================
// smoke_v35.mjs — V3.5 元游戏系统冒烟测试
// 运行：node --experimental-default-type=module test/smoke_v35.mjs
// 覆盖：周目继承数据读取/加成计算、称号解锁条件/加成、
//       统计数据记录/读取、开场演出状态管理
// ============================================================
import assert from 'node:assert';
// Node 环境无浏览器 window/localStorage，提供空壳
globalThis.window = globalThis.window || {};
const _lsStore = {};
globalThis.localStorage = {
  getItem: (k) => _lsStore[k] || null,
  setItem: (k, v) => { _lsStore[k] = v; },
  removeItem: (k) => { delete _lsStore[k]; }
};

import { Game } from '../src/js/game.js';
import {
  loadNGPlusData, saveNGPlusData, getNGPlusBonus, clearNGPlusData,
  isIntroCompleted, markIntroCompleted, resetIntroCompleted,
  MAX_NGPLUS_LEVEL
} from '../src/js/ngplus.js';
import { TITLES, checkTitles, getActiveTitleBonus, equipTitle, MAX_ACTIVE_TITLES } from '../src/js/titles.js';
import { defaultGameStats, recordTurn, recordBattle, recordEnding, winRate, formatPlayTime } from '../src/js/stats.js';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
}

console.log('== V3.5 元游戏系统冒烟测试 ==\n');

// ---------- 1. 周目继承 ----------
console.log('[1] 周目继承（New Game+）');

t('初始无继承数据', () => {
  clearNGPlusData();
  assert.strictEqual(loadNGPlusData(), null);
});

t('getNGPlusBonus 第0周目无加成', () => {
  const b = getNGPlusBonus(0);
  assert.strictEqual(b.aiArmyMult, 1);
  assert.strictEqual(b.aiEconMult, 1);
  assert.strictEqual(b.techPointBonus, 0);
  assert.strictEqual(b.loyaltyBonus, 0);
});

t('getNGPlusBonus 第1周目加成正确', () => {
  const b = getNGPlusBonus(1);
  assert.strictEqual(b.aiArmyMult, 1.10);
  assert.strictEqual(b.aiEconMult, 1.05);
  assert.strictEqual(b.techPointBonus, 0.10);
  assert.strictEqual(b.loyaltyBonus, 20);
});

t('getNGPlusBonus 10周目封顶', () => {
  const b = getNGPlusBonus(10);
  assert.strictEqual(b.aiArmyMult, 2.0);
  assert.strictEqual(b.aiEconMult, 1.5);
});

t('getNGPlusBonus 超过10周目不超限', () => {
  const b = getNGPlusBonus(99);
  assert.strictEqual(b.level, MAX_NGPLUS_LEVEL);
  assert.ok(b.aiArmyMult <= 2.0);
});

t('saveNGPlusData 写入并读取', () => {
  const game = new Game();
  game.initGame('nanchao');
  game.gameOver = { win: true, endingId: 'unify' };
  saveNGPlusData(game);
  const data = loadNGPlusData();
  assert.ok(data);
  assert.strictEqual(data.level, 1);
  assert.ok(data.generals.length > 0); // 有武将
});

t('saveNGPlusData 累加周目', () => {
  const game = new Game();
  game.initGame('nanchao');
  game.gameOver = { win: true, endingId: 'unify' };
  saveNGPlusData(game);
  const data = loadNGPlusData();
  assert.strictEqual(data.level, 2);
  assert.strictEqual(data.totalRuns, 2);
});

t('game.startNewGamePlus 返回加成', () => {
  const game = new Game();
  const r = game.startNewGamePlus();
  assert.ok(r.ok);
  assert.strictEqual(r.level, 2);
  assert.ok(r.bonus.aiArmyMult > 1);
});

clearNGPlusData();

// ---------- 2. 称号系统 ----------
console.log('\n[2] 称号系统');

t('称号表至少20个', () => {
  assert.ok(TITLES.length >= 20, `实际 ${TITLES.length}`);
});

t('每个称号有 id/name/desc/condition/bonus', () => {
  for (const t of TITLES) {
    assert.ok(t.id && t.name && t.desc && typeof t.condition === 'function' && t.bonus,
      `称号 ${t.id} 缺字段`);
  }
});

t('checkTitles 解锁条件满足的称号', () => {
  const game = new Game();
  game.initGame('nanchao');
  // 模拟：守城胜利5次
  game.stats.siegesDefended = 5;
  const newly = checkTitles(game);
  // 应该解锁「守城名将」
  const hasShoucheng = newly.some(x => x.title.id === 'shoucheng');
  assert.ok(hasShoucheng, '守城名将应解锁');
});

t('equipTitle 最多装备3个', () => {
  const game = new Game();
  game.initGame('nanchao');
  const lord = game.getFactionGenerals('nanchao')[0];
  // 手动解锁3个称号
  game.unlockedTitles[lord.id] = ['zhanshen', 'jun_shen', 'zhiduoxing', 'mingjun'];
  // 装备3个
  equipTitle(game, lord.id, 'zhanshen', true);
  equipTitle(game, lord.id, 'jun_shen', true);
  equipTitle(game, lord.id, 'zhiduoxing', true);
  // 第4个应失败
  const r = equipTitle(game, lord.id, 'mingjun', true);
  assert.strictEqual(r.ok, false);
});

t('getActiveTitleBonus 计算加成', () => {
  const game = new Game();
  game.initGame('nanchao');
  const lord = game.getFactionGenerals('nanchao')[0];
  game.unlockedTitles[lord.id] = ['zhanshen'];
  equipTitle(game, lord.id, 'zhanshen', true);
  const bag = getActiveTitleBonus(game, lord.id);
  assert.strictEqual(bag.force, 10);
});

t('称号加成不超过基础30%（校验公式注释）', () => {
  // 验证：全属性称号 max = 10（天命），单属性 max = 10（战神等）
  // 3个装备槽 × 单属性10 = 30，正好封顶30%
  for (const t of TITLES) {
    for (const [k, v] of Object.entries(t.bonus)) {
      if (k === 'allAttr') assert.ok(v <= 10, `${t.name} allAttr=${v} 超限`);
      else if (k === 'defense') assert.ok(v <= 15, `${t.name} defense=${v} 超限`);
      else if (k === 'move') assert.ok(v <= 2, `${t.name} move=${v} 超限`);
      else if (typeof v === 'number' && v > 0 && v < 1) {
        // 乘算型 ≤ 0.30
        assert.ok(v <= 0.30, `${t.name} ${k}=${v} 超限`);
      } else if (typeof v === 'number' && v > 1) {
        assert.ok(v <= 10, `${t.name} ${k}=${v} 超限`);
      }
    }
  }
});

// ---------- 3. 统计面板 ----------
console.log('\n[3] 统计面板');

t('defaultGameStats 字段完整', () => {
  const s = defaultGameStats();
  assert.ok(s.totalTurns !== undefined);
  assert.ok(s.battles !== undefined);
  assert.ok(s.victories !== undefined);
  assert.ok(s.kills !== undefined);
  assert.ok(s.maxCities !== undefined);
  assert.ok(s.buildingsBuilt !== undefined);
  assert.ok(s.researched !== undefined);
  assert.ok(s.endings !== undefined);
});

t('recordBattle 记录战斗', () => {
  const game = new Game();
  game.initGame('nanchao');
  recordBattle(game, { win: true, kills: 1000, losses: 500 });
  assert.strictEqual(game.gameStats.battles, 1);
  assert.strictEqual(game.gameStats.victories, 1);
  assert.strictEqual(game.gameStats.kills, 1000);
  assert.strictEqual(game.gameStats.losses, 500);
});

t('winRate 计算正确', () => {
  const s = { battles: 10, victories: 7 };
  assert.strictEqual(winRate(s), 70);
});

t('recordEnding 记录结局', () => {
  const game = new Game();
  game.initGame('nanchao');
  game.achievements = { a: 1, b: 2 };
  recordEnding(game, 'unify', 1);
  assert.strictEqual(game.gameStats.endings.unify, 1);
  assert.strictEqual(game.gameStats.ngPlusLevel, 1);
});

t('formatPlayTime 格式化', () => {
  assert.ok(formatPlayTime(3661).includes('1时'));
  assert.ok(formatPlayTime(65).includes('1分'));
});

// ---------- 4. 开场演出状态 ----------
console.log('\n[4] 开场演出状态');

t('初始未完成', () => {
  resetIntroCompleted();
  assert.strictEqual(isIntroCompleted(), false);
});

t('markIntroCompleted 后完成', () => {
  markIntroCompleted();
  assert.strictEqual(isIntroCompleted(), true);
});

t('resetIntroCompleted 重置', () => {
  resetIntroCompleted();
  assert.strictEqual(isIntroCompleted(), false);
});

t('game.getIntroState 返回状态', () => {
  const game = new Game();
  const st = game.getIntroState();
  assert.ok(typeof st.completed === 'boolean');
});

t('game.skipIntro 设置完成', () => {
  const game = new Game();
  game.skipIntro();
  assert.strictEqual(game.introCompleted, true);
});

// ---------- 5. 存档兼容 ----------
console.log('\n[5] 存档兼容');

t('serialize/deserialize 新字段补全', () => {
  const game = new Game();
  game.initGame('nanchao');
  game.ngPlusLevel = 2;
  game.unlockedTitles = { 'chen_baxian': ['zhanshen'] };
  game.activeTitles = { 'chen_baxian': ['zhanshen'] };
  const data = game.serialize();
  // 模拟旧存档（无新字段）
  delete data.ngPlusLevel;
  delete data.unlockedTitles;
  delete data.activeTitles;
  delete data.gameStats;
  delete data.introCompleted;
  const restored = Game.deserialize(data);
  assert.strictEqual(restored.ngPlusLevel, 0); // 旧存档默认0
  assert.deepStrictEqual(restored.unlockedTitles, {});
  assert.ok(restored.gameStats); // 有默认值
  assert.strictEqual(typeof restored.introCompleted, 'boolean');
});

t('serialize 包含新字段', () => {
  const game = new Game();
  game.initGame('nanchao');
  const data = game.serialize();
  assert.ok('ngPlusLevel' in data);
  assert.ok('unlockedTitles' in data);
  assert.ok('gameStats' in data);
  assert.ok('introCompleted' in data);
});

// ---------- 6. 游戏 API 接口 ----------
console.log('\n[6] 游戏 API 接口');

t('game.getTitles 返回已解锁/装备', () => {
  const game = new Game();
  game.initGame('nanchao');
  const lord = game.getFactionGenerals('nanchao')[0];
  game.unlockedTitles[lord.id] = ['zhanshen'];
  game.activeTitles[lord.id] = ['zhanshen'];
  const r = game.getTitles(lord.id);
  assert.deepStrictEqual(r.unlocked, ['zhanshen']);
  assert.deepStrictEqual(r.active, ['zhanshen']);
});

t('game.getStats 返回统计', () => {
  const game = new Game();
  game.initGame('nanchao');
  const s = game.getStats();
  assert.ok(s.currentTurn >= 1);
  assert.ok(typeof s.winRate === 'number');
});

t('game.getNGPlusBonus 返回加成', () => {
  const game = new Game();
  const b = game.getNGPlusBonus();
  assert.ok(b.aiArmyMult >= 1);
});

console.log(`\n== 通过 ${passed} 项测试 ==`);
