const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('chembilliardDesktop', {
  isElectron: true,
  getUpdateState: () => ipcRenderer.invoke('chembilliard:get-update-state'),
  checkForUpdates: () => ipcRenderer.invoke('chembilliard:check-for-updates'),
  installUpdateNow: () => ipcRenderer.invoke('chembilliard:install-update'),
  onUpdateStatus: (cb) => {
    if (typeof cb !== 'function') return;
    ipcRenderer.on('chembilliard:update-status', (_ev, data) => cb(data));
  }
});
