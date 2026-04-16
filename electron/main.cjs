const { app, BrowserWindow, ipcMain, session } = require('electron')
const path = require('path')
const fs = require('fs')

let mainWindow

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'user-settings.json')
}

function getWidgetDataPath() {
  return path.join(app.getPath('home'), '.wsidnext-widget.json')
}

function createWindow() {
  const isDev = process.env.ELECTRON_DEV === '1'

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,     // keep renderer isolated from Node
      webSecurity: true,          // enforce same-origin policy; never disable
      allowRunningInsecureContent: false, // block mixed HTTP/HTTPS content
      preload: path.join(__dirname, 'preload.cjs'),
    },
    icon: path.join(__dirname, 'icon.icns'),
    backgroundColor: '#f7f7f8',
  })

  // ── Block navigation to unexpected origins ──────────────────────────────────
  // Prevents renderer-level XSS from redirecting the window to an attacker URL.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    let parsed
    try { parsed = new URL(url) } catch { event.preventDefault(); return }

    const allowed =
      parsed.protocol === 'file:' ||                               // prod build
      (isDev && url.startsWith('http://localhost:5173')) ||        // dev server
      parsed.hostname.endsWith('supabase.co') ||                   // Supabase auth
      parsed.hostname === 'accounts.google.com'                    // Google OAuth

    if (!allowed) {
      console.warn(`[SECURITY] Blocked navigation to: ${url}`)
      event.preventDefault()
    }
  })

  // ── Block unexpected popup windows ──────────────────────────────────────────
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    let parsed
    try { parsed = new URL(url) } catch { return { action: 'deny' } }

    const allowed =
      parsed.hostname === 'accounts.google.com' ||
      parsed.hostname.endsWith('supabase.co')

    if (!allowed) {
      console.warn(`[SECURITY] Blocked window.open to: ${url}`)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    const distPath = path.join(__dirname, '../dist/index.html')
    mainWindow.loadFile(distPath)
  }
}

app.whenReady().then(() => {
  // ── Block all plaintext HTTP to external hosts (HTTPS only) ────────────────
  // Requests to localhost are exempt so the Vite dev server works normally.
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['http://*/*'] },
    (details, callback) => {
      const url = details.url
      if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
        callback({ cancel: false })
      } else {
        console.warn(`[SECURITY] Blocked plaintext HTTP request: ${url}`)
        callback({ cancel: true })
      }
    }
  )

  // ── Add security response headers to all requests ──────────────────────────
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'X-Content-Type-Options': ['nosniff'],
        'X-Frame-Options': ['DENY'],
        'Referrer-Policy': ['strict-origin-when-cross-origin'],
      },
    })
  })

  // Nuke stale/corrupted service worker DB left by vite-plugin-pwa
  const swPath = path.join(app.getPath('userData'), 'Service Worker')
  try { if (fs.existsSync(swPath)) fs.rmSync(swPath, { recursive: true, force: true }) } catch {}

  // Observa o ficheiro da fila da widget e notifica o renderer imediatamente
  const queuePath = path.join(app.getPath('home'), '.wsidnext-done-queue.json')
  let queueWatcher = null
  let watchDebounce = null
  function startQueueWatcher() {
    try {
      queueWatcher = fs.watch(queuePath, () => {
        clearTimeout(watchDebounce)
        watchDebounce = setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('done-queue-changed')
          }
        }, 100)
      })
    } catch {}
  }
  // Começa a observar se o ficheiro já existe, caso contrário espera pela sua criação
  if (fs.existsSync(queuePath)) {
    startQueueWatcher()
  } else {
    const dirWatcher = fs.watch(app.getPath('home'), (event, filename) => {
      if (filename === '.wsidnext-done-queue.json' && fs.existsSync(queuePath)) {
        dirWatcher.close()
        startQueueWatcher()
      }
    })
  }

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

  ipcMain.handle('export-widget-data', (event, data) => {
    try {
      fs.writeFileSync(getWidgetDataPath(), JSON.stringify(data, null, 2), 'utf8')
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('read-done-queue', () => {
    try {
      const qf = path.join(app.getPath('home'), '.wsidnext-done-queue.json')
      if (!fs.existsSync(qf)) return []
      return JSON.parse(fs.readFileSync(qf, 'utf8'))
    } catch { return [] }
  })

  ipcMain.handle('clear-done-queue', () => {
    try {
      const qf = path.join(app.getPath('home'), '.wsidnext-done-queue.json')
      fs.writeFileSync(qf, '[]', 'utf8')
      return true
    } catch { return false }
  })

  ipcMain.handle('export-pomodoro-state', (event, data) => {
    try {
      const widgetPath = getWidgetDataPath()
      let existing = {}
      try { existing = JSON.parse(fs.readFileSync(widgetPath, 'utf8')) } catch {}
      existing.pomodoro = data
      fs.writeFileSync(widgetPath, JSON.stringify(existing, null, 2), 'utf8')
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