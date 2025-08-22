const { app, BrowserWindow, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile('index.html');

  // Trimite versiunea aplicației către renderer după ce fereastra se încarcă
  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow) {
      mainWindow.webContents.send('app-version', app.getVersion());
    }
  });

  // Verifică update-uri la pornire (silent)
  autoUpdater.checkForUpdates().catch(err => {
    console.error('Eroare la verificarea update-ului:', err);
  });

  // Update disponibil
  autoUpdater.on('update-available', () => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Actualizează acum', 'Amintește mai târziu'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update disponibil',
      message: 'O versiune nouă este disponibilă. Vrei să faci update acum?'
    }).then(result => {
      if (result.response === 0) autoUpdater.downloadUpdate();
    });
  });

  // Update descărcat
  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Restart Acum', 'Mai târziu'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update descărcat',
      message: 'Update-ul a fost descărcat. Vrei să restartezi aplicația acum?'
    }).then(result => {
      if (result.response === 0) autoUpdater.quitAndInstall();
    });
  });

  // Update not available – silent
  autoUpdater.on('update-not-available', () => {});

  // Eroare la update – doar log
  autoUpdater.on('error', (err) => {
    console.error('Eroare la update:', err);
  });
}

// Evenimente Electron
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
