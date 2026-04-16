const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  moveWindow: (dx, dy) => ipcRenderer.send('move-window', { dx, dy }),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (data) => ipcRenderer.invoke('save-settings', data),
  exportWidgetData: (data) => ipcRenderer.invoke('export-widget-data', data),
  exportPomodoroState: (data) => ipcRenderer.invoke('export-pomodoro-state', data),
  readDoneQueue: () => ipcRenderer.invoke('read-done-queue'),
  clearDoneQueue: () => ipcRenderer.invoke('clear-done-queue'),
  onDoneQueueChanged: (cb) => ipcRenderer.on('done-queue-changed', cb),
  offDoneQueueChanged: (cb) => ipcRenderer.removeListener('done-queue-changed', cb),
})