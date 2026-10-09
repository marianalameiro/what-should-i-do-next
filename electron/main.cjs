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
      webSecurity: true, // Mantemos ativo porque a rota interna agora está correta
      nodeIntegration: false
    }
  });

  // Rota à prova de bala: deteta se está a rodar empacotado no asar ou em dev local
  const indexPath = app.isPackaged 
    ? path.join(__dirname, '..', 'dist', 'index.html')
    : path.join(__dirname, '../dist/index.html');

  mainWindow.loadFile(indexPath).catch(err => {
    console.error("Erro ao abrir index.html:", err);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
