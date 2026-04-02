const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

let mainWindow

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'user-settings.json')
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    icon: path.join(__dirname, 'icon.icns'),
    backgroundColor: '#f7f7f8',
  })

  const isDev = process.env.ELECTRON_DEV === '1'

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    const distPath = path.join(__dirname, '../dist/index.html')
    mainWindow.loadFile(distPath)
  }
}

app.whenReady().then(() => {
  // Nuke stale/corrupted service worker DB left by vite-plugin-pwa
  const swPath = path.join(app.getPath('userData'), 'Service Worker')
  try { if (fs.existsSync(swPath)) fs.rmSync(swPath, { recursive: true, force: true }) } catch {}

  ipcMain.on('move-window', (event, { dx, dy }) => {
    if (!mainWindow) return
    const [x, y] = mainWindow.getPosition()
    mainWindow.setPosition(x + dx, y + dy)
  })

  ipcMain.handle('load-settings', () => {
    try {
      const filePath = getSettingsPath()
      if (!fs.existsSync(filePath)) return null
      return JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch {
      return null
    }
  })

  ipcMain.handle('save-settings', (event, data) => {
    try {
      fs.writeFileSync(getSettingsPath(), JSON.stringify(data), 'utf8')
      return true
    } catch {
      return false
    }
  })


  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})