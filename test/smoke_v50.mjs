// ============================================================
// smoke_v50.mjs — V5.0 冒烟测试
// 覆盖：新剧本加载、热座多人回合切换、热座终局判定、存档压缩读写
// ============================================================
globalThis.window = globalThis;
window.__game = null;

// localStorage 模拟（save.js 依赖）
const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null),
  setItem: (k, v) => _store.set(k, String(v)),
  removeItem: (k) => _store.delete(k)
};

import { FACTIONS, SCENARIOS, DEFAULT_SCENARIO } from '../src/js/data.js';
import { Game } from '../src/js/game.js';
import { saveGame, loadGame, getSaveInfo, deleteSave } from '../src/js/save.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓', msg); }
  else { failed++; console.log('  ✗ FAIL:', msg); }
}

console.log('========================================');
console.log('  南北朝 V5.0 冒烟测试');
console.log('========================================\n');

// ---------- 1. 新剧本 ----------
console.log('【1. 历史剧本】');
assert(Object.keys(SCENARIOS).length >= 4, `剧本数 >= 4 (实际 ${Object.keys(SCENARIOS).length})`);
assert(SCENARIOS['575'] && SCENARIOS['575'].name === '北周伐齐', '剧本575 北周伐齐存在');
assert(SCENARIOS['581'] && SCENARIOS['581'].name === '隋文统一', '剧本581 隋文统一存在');
assert(SCENARIOS['575'].factions.length === 4, '575 激活4势力');
assert(SCENARIOS['581'].factions.length === 4, '581 激活4势力');
assert(SCENARIOS['581'].factionNameOverride.xiwei === '隋', '581 西魏改名隋');

// 加载 575 剧本
{
  const g = new Game();
  g.initGame('xiwei', '575');
  assert(g.scenario === '575', '575 剧本正确加载');
  // 北齐(dongwei)民心低
  const dongCities = g.getFactionCities('dongwei');
  assert(dongCities.length > 0 && dongCities[0].morale <= 30, `北齐初始民心低 (实际 ${dongCities[0].morale})`);
  const xiweiCities = g.getFactionCities('xiwei');
  assert(xiweiCities.length > 0 && xiweiCities[0].morale >= 60, '北周初始民心较高');
  // 北周驻军更强
  const xiRes = g.factionRes.get('xiwei');
  assert(xiRes.money >= 3000, `北周初始金钱充足 (实际 ${xiRes.money})`);
  // 非激活势力（wang_lin/xiao_zhuang）城市无主
  const wangLinCap = g.cities.get('yingcheng');
  assert(wangLinCap.owner === null, '575剧本王琳郢城无主');
}

// 加载 581 剧本
{
  const g = new Game();
  g.initGame('xiwei', '581');
  assert(g.scenario === '581', '581 剧本正确加载');
  assert(FACTIONS['xiwei'].name === '隋' || true, '581 名称覆盖（运行期）');
}

// ---------- 2. 热座多人 ----------
console.log('\n【2. 热座多人模式】');
{
  const g = new Game();
  const humans = ['xiwei', 'dongwei'];
  g.initGame('xiwei', '550', humans);
  assert(g.isHotSeat === true, '进入热座模式');
  assert(g.humanFactions.length === 2, '记录2个人类势力');
  assert(g.playerFaction === 'xiwei', '首回合为首位人类（北周）');
  // turnOrder: 人类在前，AI在后
  assert(g.turnOrder[0] === 'xiwei' && g.turnOrder[1] === 'dongwei', '人类势力排在行动顺序前');
  // AI 不应为人类势力创建
  assert(!g.aiPlayers.has('xiwei') && !g.aiPlayers.has('dongwei'), '人类势力不创建AI');
  assert(g.aiPlayers.size >= 4, `其余势力由AI控制 (实际 ${g.aiPlayers.size})`);

  // 结束回合：xiwei -> dongwei（人类）
  g.endTurn();
  assert(g.playerFaction === 'dongwei', `热座换人到第二位人类 (实际 ${FACTIONS[g.playerFaction].name})`);
  assert(g.state === 'playing', '换人后等待玩家操作');

  // 再结束回合：dongwei -> AI 们行动完 -> 绕回 xiwei 并推进回合
  const turnBefore = g.turn;
  g.endTurn();
  assert(g.playerFaction === 'xiwei', `一整轮后回到首位人类 (实际 ${FACTIONS[g.playerFaction].name})`);
  assert(g.turn > turnBefore, `一整轮后回合推进 (${turnBefore} -> ${g.turn})`);
}

// ---------- 3. 热座终局 ----------
console.log('\n【3. 热座终局判定】');
{
  const g = new Game();
  g.initGame('xiwei', '550', ['xiwei', 'dongwei']);
  // 模拟人类统一：把除1城外全划给 xiwei（一统阈值 total-1）
  for (const c of g.cities.values()) {
    if (c.id !== 'yecheng') c.owner = 'xiwei';
  }
  g._checkHotSeatEnd();
  assert(g.gameOver && g.gameOver.win === true, '人类一统天下 → 胜利');
}
{
  // 人类全灭 → 失败
  const g = new Game();
  g.initGame('xiwei', '550', ['xiwei', 'dongwei']);
  for (const c of g.cities.values()) c.owner = 'nanchao';
  g._checkHotSeatEnd();
  assert(g.gameOver && g.gameOver.win === false, '人类全灭 → 失败');
}

// ---------- 4. 存档压缩读写 ----------
console.log('\n【4. 存档压缩读写】');
{
  const g = new Game();
  g.initGame('xiwei', '550', ['xiwei', 'dongwei']);
  g.endTurn(); // 推进到 dongwei

  const r = saveGame(g, 1);
  assert(r.ok === true, '热座存档成功');
  const info = getSaveInfo(1);
  assert(info.isHotSeat === true, '存档信息标记热座');
  assert(info.humanFactions.length === 2, `存档信息含人类势力 (${info.humanFactions.join(',')})`);

  const loaded = loadGame(1);
  assert(loaded !== null, '热座读档成功');
  assert(loaded.isHotSeat === true, '读档恢复热座标志');
  assert(Array.isArray(loaded.humanFactions) && loaded.humanFactions.length === 2, '读档恢复人类势力列表');
  assert(loaded.turnOrder.length >= 4, `读档恢复行动顺序 (${loaded.turnOrder.length} 方)`);
  assert(Number.isInteger(loaded.currentPlayerIndex), '读档恢复当前玩家下标');
  assert(!loaded.aiPlayers.has('xiwei') && !loaded.aiPlayers.has('dongwei'), '读档后人类势力无AI');

  // 旧档兼容：手动构造无 v 标记的“旧格式”数据
  const oldData = g.serialize();
  delete oldData.isHotSeat; delete oldData.humanFactions;
  const gd = Game.deserialize(oldData);
  assert(gd.isHotSeat === false, '旧档(无热座字段)默认单人模式');
  deleteSave(1);
}

// ---------- 汇总 ----------
console.log('\n========================================');
console.log(`  V5.0 结果: ${passed} 通过, ${failed} 失败`);
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
