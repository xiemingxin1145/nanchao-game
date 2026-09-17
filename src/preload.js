const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  quitGame: () => ipcRenderer.send('quit-game')
});

// ============================================================
// V5.5 局域网对战桥接（preload → 渲染进程）
// 参考 Electron contextBridge 官方示例：只暴露安全的函数，不直接暴露 ipcRenderer。
// ============================================================
contextBridge.exposeInMainWorld('lan', {
  // 创建主机（监听端口）
  createServer: (port) => ipcRenderer.send('lan:create-server', port),
  // 客机连接主机
  connectClient: (host, port) => ipcRenderer.send('lan:connect-client', { host, port }),
  // 发送一条游戏消息
  send: (obj) => ipcRenderer.send('lan:send', obj),
  // 关闭所有连接
  close: () => ipcRenderer.send('lan:close'),
  // 业务消息（状态/操作/聊天/心跳）
  onMessage: (cb) => ipcRenderer.on('lan:message', (e, msg) => cb(msg)),
  // 连接状态事件
  onEvent: (cb) => ipcRenderer.on('lan:event', (e, evt) => cb(evt))
});
