const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const net = require('net');

let mainWindow = null;

// ============================================================
// V5.5 局域网对战：主进程 TCP 收发
// 参考：Electron contextBridge / ipcMain 官方文档。
// 主进程持有 TCP socket，把字节流按「换行分隔 JSON 帧」解帧后转发给渲染进程；
// 渲染进程发来的 send 消息原样写入 socket。
// ============================================================
let lanServer = null;        // TCP server 实例
let lanClientSocket = null;  // 客机模式下的连接 socket
let lanClientSockets = [];   // 主机模式下已接入的客户端 socket 列表

// 增量解帧（与渲染进程 network.js 一致的换行分隔 JSON）
function _makeFrameHandler(sender) {
  let buffer = '';
  return (chunk) => {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        // pong 不上抛业务层（心跳内部处理）
        sender.send('lan:message', msg);
      } catch (e) { /* 坏帧丢弃 */ }
    }
  };
}

function _sendLanEvent(sender, type, data) {
  try { sender.send('lan:event', { type, data }); } catch (e) {}
}

function _writeLine(socket, obj) {
  try { socket.write(JSON.stringify(obj) + '\n'); } catch (e) {}
}

function _broadcastToClients(obj) {
  const line = JSON.stringify(obj) + '\n';
  for (const s of lanClientSockets) {
    try { s.write(line); } catch (e) {}
  }
}

// 关闭所有 LAN 连接
function _closeAllLan() {
  for (const s of lanClientSockets) { try { s.end(); } catch (e) {} }
  lanClientSockets = [];
  if (lanServer) { try { lanServer.close(); } catch (e) {} lanServer = null; }
  if (lanClientSocket) { try { lanClientSocket.end(); } catch (e) {} lanClientSocket = null; }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: '南北朝',
    backgroundColor: '#1A1A1A',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', () => {
    _closeAllLan();
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  _closeAllLan();
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('quit-game', () => {
  app.quit();
});

// ============================================================
// LAN IPC 通道
// ============================================================
// 主机：创建 TCP 服务器
ipcMain.on('lan:create-server', (e, port) => {
  const sender = e.sender;
  try {
    _closeAllLan();
    lanServer = net.createServer((socket) => {
      socket.setEncoding('utf8');
      lanClientSockets.push(socket);
      const onFrame = _makeFrameHandler(sender);
      socket.on('data', onFrame);
      socket.on('close', () => {
        lanClientSockets = lanClientSockets.filter(s => s !== socket);
        _sendLanEvent(sender, 'client-disconnect');
      });
      socket.on('error', () => {});
      _sendLanEvent(sender, 'client-connected', { remote: socket.remoteAddress || '' });
    });
    lanServer.on('error', (err) => {
      _sendLanEvent(sender, 'error', err && err.message ? err.message : '端口被占用或网络错误');
    });
    lanServer.listen(port, '0.0.0.0', () => {
      _sendLanEvent(sender, 'server-listening', { port });
    });
  } catch (err) {
    _sendLanEvent(sender, 'error', err.message || '创建服务器失败');
  }
});

// 客机：连接主机
ipcMain.on('lan:connect-client', (e, opts) => {
  const sender = e.sender;
  const host = (opts && opts.host) || '127.0.0.1';
  const port = (opts && opts.port) || 8888;
  try {
    _closeAllLan();
    lanClientSocket = net.createConnection({ host, port }, () => {
      _sendLanEvent(sender, 'connected', { host, port });
    });
    lanClientSocket.setEncoding('utf8');
    const onFrame = _makeFrameHandler(sender);
    lanClientSocket.on('data', onFrame);
    lanClientSocket.on('close', () => {
      lanClientSocket = null;
      _sendLanEvent(sender, 'disconnected');
    });
    lanClientSocket.on('error', (err) => {
      _sendLanEvent(sender, 'error', err && err.message ? err.message : '无法连接主机');
    });
  } catch (err) {
    _sendLanEvent(sender, 'error', err.message || '连接失败');
  }
});

// 发送消息：主机→广播给所有客户端；客机→发给主机
ipcMain.on('lan:send', (e, obj) => {
  if (!obj) return;
  if (lanClientSockets.length > 0) {
    _broadcastToClients(obj);
  } else if (lanClientSocket) {
    _writeLine(lanClientSocket, obj);
  }
});

// 关闭 LAN
ipcMain.on('lan:close', () => {
  _closeAllLan();
});
