// ============================================================
// network.js — V5.5 局域网对战网络模块
// ============================================================
// 架构（参考 Electron 官方 IPC / contextBridge 文档）：
//   主进程（main.js）使用 Node.js 原生 net 模块创建 TCP 服务器/客户端，
//   不依赖 WebSocket 或任何外部 npm 包。
//   渲染进程通过 preload.js 暴露的 window.lan 桥调用主进程：
//     createServer(port) / connectClient(host,port) / send(msg) / close()
//   主进程把收到的字节流按「换行分隔 JSON 帧」解帧后转发给渲染进程。
//
// 权威服务器模型（参考 turn-based 权威同步实践）：
//   - 主机（Host）= 权威服务器，运行唯一一份真实游戏状态。
//   - 客机（Client）= 镜像终端：接收主机广播的完整状态快照后反序列化恢复；
//     自己回合内的操作先在本地镜像上乐观执行，点「结束回合」时向主机发送
//     {type:'endTurn'}；主机执行 AI 回合 + 整轮结算后，再把完整序列化状态
//     广播回客机。每回合结束即做一次全量快照同步，天然纠正任何随机分歧。
//
// 消息协议（JSON，每条消息以 \n 结尾，避免粘包）：
//   { type:'handshake',   hostFaction, clientFaction, scenarioId }
//   { type:'factionPick', factionId }
//   { type:'state',       data:<Game.serialize()> , yourTurn:'host'|'client' }
//   { type:'endTurn' }
//   { type:'chat',        text, from }
//   { type:'ping' } / { type:'pong' }   （心跳，10 秒无响应判定断开）
//   { type:'bye' }                       （正常断开）
// ============================================================

// ---------- 纯函数：换行分隔 JSON 帧编解码（可在 Node 单测中直接用） ----------
// 把一条消息编码为「JSON 字符串 + \n」。
export function encodeMessage(obj) {
  return JSON.stringify(obj) + '\n';
}

// 增量解帧：传入新收到的字节串片段，返回完整消息数组 + 剩余未完成片段。
// 用法：this._buf = decodeBuffer(this._buf + chunk).rest;  for (const msg of msgs) ...
export function decodeBuffer(buf) {
  const msgs = [];
  let rest = buf;
  let idx;
  while ((idx = rest.indexOf('\n')) >= 0) {
    const line = rest.slice(0, idx);
    rest = rest.slice(idx + 1);
    if (!line.trim()) continue;
    try {
      msgs.push(JSON.parse(line));
    } catch (e) {
      // 跳过坏行，避免污染后续消息
    }
  }
  return { msgs, rest };
}

// ============================================================
// LZ77 简单压缩（存档 / 网络状态快照共用）
// 原理：滑动窗口匹配重复子串，命中≥3 字节则用 [offset,length] 回引，
//       否则输出字面字符。对 JSON 文本（含大量重复键名/标点）压缩率约 30~50%。
// 纯字符串处理，可在 Node 与浏览器两端直接运行。
// ============================================================
export function lz77Compress(input) {
  if (typeof input !== 'string') input = String(input);
  if (input.length === 0) return '[]';
  const WINDOW = 8192;
  const LOOKAHEAD = 32;
  const out = [];
  let i = 0;
  while (i < input.length) {
    let bestOff = 0, bestLen = 0;
    const wStart = Math.max(0, i - WINDOW);
    const maxLen = Math.min(LOOKAHEAD, input.length - i);
    // 滑窗内找最长匹配
    for (let j = wStart; j < i; j++) {
      let len = 0;
      while (len < maxLen && input[j + len] === input[i + len]) len++;
      if (len > bestLen) { bestLen = len; bestOff = i - j; }
    }
    if (bestLen >= 3) {
      out.push([bestOff, bestLen]);   // 回引：[相对偏移, 长度]
      i += bestLen;
    } else {
      out.push(input[i]);             // 字面字符
      i++;
    }
  }
  return JSON.stringify(out);
}

export function lz77Decompress(compressed) {
  if (typeof compressed !== 'string' || compressed.length === 0) return '';
  let arr;
  try { arr = JSON.parse(compressed); } catch (e) { return ''; }
  if (!Array.isArray(arr)) return '';
  let out = '';
  for (const item of arr) {
    if (typeof item === 'string') {
      out += item;
    } else if (Array.isArray(item) && item.length === 2) {
      const off = item[0], len = item[1];
      const start = out.length - off;
      if (start < 0) continue;
      for (let k = 0; k < len; k++) out += out[start + k];
    }
  }
  return out;
}

// ============================================================
// LANManager — 渲染进程侧网络管理器
// 通过 window.lan（preload 桥）与主进程 TCP 收发。
// 所有回调异步触发：onMessage / onStatusChange。
// ============================================================
export const LAN_DEFAULTS = {
  port: 8888,
  timeoutMs: 10000,   // 10 秒无心跳/无消息判定断开
  pingMs: 5000        // 每 5 秒 ping 一次
};

export class LANManager {
  constructor() {
    this.isHost = false;
    this.connected = false;
    this.listening = false;
    this.port = LAN_DEFAULTS.port;
    this.hostAddr = '';
    this._bound = false;
    this._chatLog = [];
    this._lastRecv = 0;
    this._heartbeatTimer = null;
    this.onMessage = null;       // (msg) => void
    this.onStatusChange = null;  // (evt:{type,data}) => void
  }

  // 是否运行在具备桥接能力的 Electron 环境
  isAvailable() {
    return typeof window !== 'undefined' && !!window.lan && typeof window.lan.send === 'function';
  }

  // 主机：监听端口，等待客机连接
  host(port = LAN_DEFAULTS.port) {
    if (!this.isAvailable()) return { ok: false, msg: '局域网功能不可用（请在 Electron 桌面端运行）' };
    this.isHost = true;
    this.port = port;
    this._bind();
    window.lan.createServer(port);
    this._startHeartbeat();
    return { ok: true };
  }

  // 客机：连接主机 IP
  join(hostAddr, port = LAN_DEFAULTS.port) {
    if (!this.isAvailable()) return { ok: false, msg: '局域网功能不可用（请在 Electron 桌面端运行）' };
    this.isHost = false;
    this.hostAddr = hostAddr;
    this.port = port;
    this._bind();
    window.lan.connectClient(hostAddr, port);
    this._startHeartbeat();
    return { ok: true };
  }

  _bind() {
    if (this._bound) return;
    this._bound = true;
    window.lan.onMessage((msg) => {
      this._lastRecv = Date.now();
      // 心跳应答不向上层业务派发
      if (msg && msg.type === 'pong') return;
      if (this.onMessage) this.onMessage(msg);
    });
    window.lan.onEvent((evt) => {
      switch (evt.type) {
        case 'server-listening':
          this.listening = true;
          this._emit('listening', evt.data);
          break;
        case 'connected':
        case 'client-connected':
          this.connected = true;
          this._emit(evt.type, evt.data);
          break;
        case 'disconnected':
        case 'client-disconnect':
          this.connected = false;
          this._emit(evt.type, evt.data);
          break;
        case 'error':
          this._emit('error', evt.data);
          break;
        default:
          this._emit(evt.type, evt.data);
      }
    });
  }

  _emit(type, data) {
    if (this.onStatusChange) this.onStatusChange({ type, data });
  }

  _startHeartbeat() {
    // BUG修复（network.js #1）：重复调用 host()/join() 时若不先停旧定时器，
    //   会叠加多个 setInterval 心跳——每个 interval 都 send 一次 ping，
    //   导致 _lastRecv 被错误刷新、超时判定失灵，且网络帧冗余。
    //   修复：启动新心跳前先清理旧定时器。
    this._stopHeartbeat();
    this._lastRecv = Date.now();
    this._heartbeatTimer = setInterval(() => {
      // 超时检测
      if (this.connected && Date.now() - this._lastRecv > LAN_DEFAULTS.timeoutMs) {
        this._emit('timeout', { after: LAN_DEFAULTS.timeoutMs });
      }
      // 主动 ping
      if (this.connected) this.send({ type: 'ping', timestamp: Date.now() });
    }, LAN_DEFAULTS.pingMs);
  }

  _stopHeartbeat() {
    if (this._heartbeatTimer) { clearInterval(this._heartbeatTimer); this._heartbeatTimer = null; }
  }

  // 发送任意消息（自动加时间戳）
  send(msg) {
    // BUG修复（network.js #2）：原实现此处为一个空 if 块——
    //   `if (!this.isAvailable() || !this.connected && !this.listening) { /* 空 */ }`
    //   本意是「不可用/未连接时早退」，但漏掉了 return，导致继续执行 window.lan.send()，
    //   在非 Electron 浏览器环境下 window.lan 为 undefined，必然抛错（仅靠 try/catch 静默）。
    //   修复：改为真正的早退——桥不存在或既未连接也未监听时直接返回，不抛错。
    if (!this.isAvailable()) return;
    if (!this.connected && !this.listening) return;
    try {
      msg.timestamp = Date.now();
      window.lan.send(msg);
      this._lastRecv = Date.now(); // 发出也计为活跃
    } catch (e) { /* 静默 */ }
  }

  sendChat(text, from) {
    this.send({ type: 'chat', text, from: from || (this.isHost ? 'host' : 'client') });
  }

  sendState(serialized, yourTurn) {
    // 全量状态快照 + 压缩，降低带宽
    const compressed = lz77Compress(JSON.stringify(serialized));
    this.send({ type: 'state', data: compressed, compressed: true, yourTurn });
  }

  close() {
    this._stopHeartbeat();
    if (this.isAvailable()) { try { window.lan.send({ type: 'bye' }); window.lan.close(); } catch (e) {} }
    this.connected = false;
    this.listening = false;
  }
}

// 从网络消息还原状态快照（客机侧调用）
export function parseStateMessage(msg) {
  if (!msg || msg.type !== 'state' || typeof msg.data !== 'string') return null;
  try {
    const json = msg.compressed ? lz77Decompress(msg.data) : msg.data;
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

export default { LANManager, encodeMessage, decodeBuffer, lz77Compress, lz77Decompress, parseStateMessage, LAN_DEFAULTS };
