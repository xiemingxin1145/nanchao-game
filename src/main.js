const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// 兼容性标志：确保在各类 Linux 环境下稳定运行
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-dev-shm-usage');

let mainWindow = null;
let updateDownloaded = false;

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

  // 开发时可打开 DevTools
  // mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============ 自动更新系统 ============
// 机制：启动后静默检查 GitHub Releases 新版本 → 发现新版本后台差分下载（只下载变化部分）
//      → 下载完成弹窗提示 → 一键重启完成更新（覆盖原安装，存档不丢失）
function setupAutoUpdater() {
  // 仅在打包发布版本中启用（开发模式跳过）
  if (!app.isPackaged) return;

  // 不自动下载，由下载完成事件统一处理（避免重复下载）
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  // 有新版本可用
  autoUpdater.on('update-available', (info) => {
    console.log(`[updater] 发现新版本 v${info.version}，开始后台下载...`);
    autoUpdater.downloadUpdate().catch((err) => {
      console.error('[updater] 下载失败:', err);
    });
  });

  // 当前已是最新版本
  autoUpdater.on('update-not-available', (info) => {
    console.log('[updater] 当前已是最新版本');
  });

  // 下载进度（便于排查）
  autoUpdater.on('download-progress', (progressObj) => {
    if (progressObj.percent % 25 < 1) {
      console.log(`[updater] 下载进度: ${Math.floor(progressObj.percent)}%`);
    }
  });

  // 下载完成 → 弹窗提示重启安装
  autoUpdater.on('update-downloaded', (info) => {
    updateDownloaded = true;
    console.log(`[updater] v${info.version} 下载完成，等待安装`);
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '游戏更新完成',
        message: `新版本 v${info.version} 已下载完成`,
        detail: '点击「立即重启更新」后游戏将自动重启完成升级（游戏存档不会丢失）。',
        buttons: ['立即重启更新', '稍后再说'],
        defaultId: 0,
        cancelId: 1
      }).then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater] 更新出错:', err.message);
  });

  // 启动 3 秒后检查更新，之后每 30 分钟自动检查一次
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 3000);
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 30 * 60 * 1000);
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 退出游戏
ipcMain.on('quit-game', () => {
  app.quit();
});
