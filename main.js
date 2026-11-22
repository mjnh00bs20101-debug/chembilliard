const path = require('path');
const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');

let autoUpdater = null;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch (_) {
  autoUpdater = null;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let mainWindow = null;
let updaterState = {
  status: 'idle',
  currentVersion: app.getVersion(),
  version: '',
  percent: 0,
  message: ''
};

function broadcastUpdateState(patch) {
  updaterState = Object.assign({}, updaterState, patch, { currentVersion: app.getVersion() });
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    try {
      mainWindow.webContents.send('chembilliard:update-status', updaterState);
    } catch (_) {}
  }
}

function setupAutoUpdater() {
  if (!autoUpdater) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('checking-for-update', () => broadcastUpdateState({ status: 'checking', percent: 0, message: '' }));
  autoUpdater.on('update-available', (info) => broadcastUpdateState({ status: 'available', version: info?.version ? String(info.version) : '', percent: 0 }));
  autoUpdater.on('download-progress', (prog) => broadcastUpdateState({ status: 'downloading', percent: typeof prog?.percent === 'number' ? Math.round(prog.percent) : 0 }));
  autoUpdater.on('update-downloaded', (info) => broadcastUpdateState({ status: 'downloaded', version: info?.version ? String(info.version) : updaterState.version, percent: 100 }));
  autoUpdater.on('update-not-available', (info) => broadcastUpdateState({ status: 'not-available', version: info?.version ? String(info.version) : app.getVersion(), percent: 0 }));
  autoUpdater.on('error', (err) => broadcastUpdateState({ status: 'error', message: err?.message ? String(err.message) : String(err || 'Update error') }));
}

ipcMain.handle('chembilliard:get-update-state', () => Object.assign({}, updaterState, { currentVersion: app.getVersion(), isPackaged: app.isPackaged }));
ipcMain.handle('chembilliard:check-for-updates', async () => {
  if (!autoUpdater || !app.isPackaged) {
    broadcastUpdateState({ status: 'not-available', version: app.getVersion() });
    return updaterState;
  }
  try { await autoUpdater.checkForUpdates(); } catch (err) { broadcastUpdateState({ status: 'error', message: String(err?.message || err) }); }
  return updaterState;
});
ipcMain.handle('chembilliard:install-update', () => {
  if (autoUpdater && updaterState.status === 'downloaded') {
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
    return { ok: true };
  }
  return { ok: false };
});

function createMainWindow() {
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#050914',
    title: 'ChemBilliard 3D Pro',
    icon: path.join(__dirname, 'icons', 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  setupAutoUpdater();
  createMainWindow();
  if (app.isPackaged && autoUpdater) {
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 3500);
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
