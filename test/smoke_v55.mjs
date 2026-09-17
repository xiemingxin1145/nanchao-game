// ============================================================
// smoke_v55.mjs — V5.5 冒烟测试
// 覆盖：局域网 TCP 收发、剧本5/6加载、新事件加载、LZ77压缩、存档读写
// ============================================================
import net from 'net';
globalThis.window = globalThis;
window.__game = null;

// localStorage 模拟
const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null),
  setItem: (k, v) => _store.set(k, String(v)),
  removeItem: (k) => _store.delete(k)
};

import { FACTIONS, SCENARIOS, EVENTS, HISTORICAL_EVENTS } from '../src/js/data.js';
import { Game } from '../src/js/game.js';
import { saveGame, loadGame, getSaveInfo, deleteSave } from '../src/js/save.js';
import { LANManager, encodeMessage, decodeBuffer, lz77Compress, lz77Decompress, parseStateMessage, LAN_DEFAULTS } from '../src/js/network.js';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓', msg); }
  else { failed++; console.log('  ✗ FAIL:', msg); }
}

console.log('========================================');
console.log('  南北朝 V5.5 冒烟测试');
console.log('========================================\n');

// ---------- 1. 新剧本加载 ----------
console.log('【1. 新剧本（侯景之乱 / 三国归隋）】');
assert(Object.keys(SCENARIOS).length >= 6, `剧本数 >= 6 (实际 ${Object.keys(SCENARIOS).length})`);
assert(SCENARIOS['548'] && SCENARIOS['548'].name === '侯景之乱', '剧本548 侯景之乱存在');
assert(SCENARIOS['589'] && SCENARIOS['589'].name === '三国归隋', '剧本589 三国归隋存在');
assert(SCENARIOS['548'].factions.length === 4, '548 激活4势力');
assert(SCENARIOS['589'].factions.length === 2, '589 激活2势力（隋 vs 陈）');
{
  const g = new Game();
  g.initGame('nanchao', '548');
  assert(g.scenario === '548', '548 剧本正确加载');
  const nanCities = g.getFactionCities('nanchao');
  assert(nanCities.length > 0 && nanCities[0].morale <= 40, `南梁初始民心低 (实际 ${nanCities[0].morale})`);
}
{
  const g = new Game();
  g.initGame('xiwei', '589');
  assert(g.scenario === '589', '589 剧本正确加载');
  const xiRes = g.factionRes.get('xiwei');
  assert(xiRes.money >= 5000, `隋初始金钱充足 (实际 ${xiRes.money})`);
}

// ---------- 2. 新事件 ----------
console.log('\n【2. 新事件】');
assert(EVENTS.length >= 28, `随机事件数 >= 28 (实际 ${EVENTS.length})`);
const newRandom = ['comet_sky', 'solar_eclipse', 'meteor_shower', 'build_temple', 'grotto_caves',
  'compile_history', 'armory_explode', 'horse_plague', 'envoy_visit', 'swordsman_join'];
for (const id of newRandom) {
  assert(EVENTS.some(e => e.id === id), `随机事件 ${id} 存在`);
}
assert(HISTORICAL_EVENTS.length >= 24, `历史事件数 >= 24 (实际 ${HISTORICAL_EVENTS.length})`);
const newHist = ['we_division', 'hanling_battle', 'xiaoguan_battle', 'chen_jian_chen', 'yang_gong_mie_chen'];
for (const id of newHist) {
  assert(HISTORICAL_EVENTS.some(e => e.id === id), `历史事件 ${id} 存在`);
}

// ---------- 3. LZ77 压缩 ----------
console.log('\n【3. LZ77 压缩】');
{
  const sample = JSON.stringify({ a: 1, b: '重复字符串'.repeat(50), c: '1,2,3,'.repeat(30) });
  const compressed = lz77Compress(sample);
  const decompressed = lz77Decompress(compressed);
  assert(decompressed === sample, 'LZ77 压缩→解压 往返一致');
  assert(compressed.length < sample.length, `LZ77 压缩生效 (${sample.length} → ${compressed.length} 字节)`);
}
{
  const g = new Game();
  g.initGame('xiwei', '550');
  const snap = g.serialize();
  const compressed = lz77Compress(JSON.stringify(snap));
  const restored = JSON.parse(lz77Decompress(compressed));
  assert(restored.turn === 1 && restored.armies.length === snap.armies.length, '游戏快照 LZ77 往返一致');
}

// ---------- 4. 消息协议编解码 ----------
console.log('\n【4. 网络消息协议】');
{
  const msg = { type: 'state', data: 'test', yourTurn: 'host' };
  const encoded = encodeMessage(msg);
  assert(encoded.endsWith('\n'), '消息以换行结尾');
  const { msgs, rest } = decodeBuffer(encoded + '{"type":"chat"}' + '\n');
  assert(msgs.length === 2 && msgs[0].type === 'state' && msgs[1].type === 'chat', '解帧正确解析2条消息');
  assert(rest === '', '解帧无残留');
  // 粘包测试：不完整帧
  const partial = decodeBuffer('{"type":"move","data":123');
  assert(partial.msgs.length === 0 && partial.rest.length > 0, '不完整帧被正确缓冲');
}

// ---------- 5. 存档读写（含 LZ77） ----------
console.log('\n【5. 存档读写（LZ77+键名缩写）】');
{
  const g = new Game();
  g.initGame('xiwei', '550');
  const r = saveGame(g, 2);
  assert(r.ok === true, '存档成功');
  const loaded = loadGame(2);
  assert(loaded !== null, '读档成功');
  assert(loaded.turn === 1, '回合数恢复正确');
  assert(loaded.cities.size === g.cities.size, `城市数一致 (${loaded.cities.size})`);
  // 旧档兼容：手动构造无 v 标记数据
  const oldData = g.serialize();
  delete oldData.isHotSeat;
  const gd = Game.deserialize(oldData);
  assert(gd.isHotSeat === false, '旧档默认单人');
  deleteSave(2);
}

// ---------- 6. 局域网 TCP 端到端（真实 socket） ----------
console.log('\n【6. 局域网 TCP 端到端】');
{
  const PORT = 18888;
  let serverReceived = [];
  let clientReceived = [];

  await new Promise((resolve) => {
    const server = net.createServer((socket) => {
      socket.setEncoding('utf8');
      let buf = '';
      socket.on('data', (chunk) => {
        buf += chunk;
        const { msgs, rest } = decodeBuffer(buf);
        buf = rest;
        serverReceived.push(...msgs);
        // 收到客户端消息后回 state
        if (msgs.some(m => m.type === 'endTurn')) {
          const line = encodeMessage({ type: 'state', yourTurn: 'host' });
          socket.write(line);
        }
      });
    });
    server.listen(PORT, '127.0.0.1', () => {
      const client = net.createConnection({ port: PORT, host: '127.0.0.1' }, () => {
        client.write(encodeMessage({ type: 'handshake', hostFaction: 'xiwei' }));
        client.write(encodeMessage({ type: 'endTurn' }));
      });
      client.setEncoding('utf8');
      let cbuf = '';
      client.on('data', (chunk) => {
        cbuf += chunk;
        const { msgs, rest } = decodeBuffer(cbuf);
        cbuf = rest;
        clientReceived.push(...msgs);
        if (clientReceived.some(m => m.type === 'state')) {
          client.end();
          server.close();
          resolve();
        }
      });
    });
    // 3 秒超时兜底
    setTimeout(resolve, 3000);
  });

  assert(serverReceived.some(m => m.type === 'handshake'), '服务器收到 handshake');
  assert(serverReceived.some(m => m.type === 'endTurn'), '服务器收到 endTurn');
  assert(clientReceived.some(m => m.type === 'state'), '客机收到 state 广播');
}

// ---------- 汇总 ----------
console.log('\n========================================');
console.log(`  V5.5 结果: ${passed} 通过, ${failed} 失败`);
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
