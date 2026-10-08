const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    titleBarStyle: 'hidden',
    webPreferences: {
      contextIsolation: true,
      webSecurity: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../dist/index.html')).catch(err => {
    console.error(err);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
