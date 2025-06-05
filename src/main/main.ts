import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Keep a global reference of the window object to prevent it from being garbage collected
let mainWindow: BrowserWindow | null = null;

// Declare the webpack entry constant
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

const createWindow = (): void => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Open the DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Set up IPC handlers for the main process

// Handle file open dialog
ipcMain.handle('dialog:openFile', async () => {
  if (!mainWindow) return { canceled: true };

  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Audio Files', extensions: ['wav'] }
    ]
  });

  if (canceled || filePaths.length === 0) {
    return { canceled: true };
  }
  
  return { canceled: false, filePath: filePaths[0] };
});

// Handle audio file loading
ipcMain.handle('audio:load', async (_, filePath: string) => {
  try {
    // Read the file using Node.js fs
    const fileBuffer = fs.readFileSync(filePath);
    
    // Return the buffer as an ArrayBuffer that can be sent to the renderer
    return { 
      success: true, 
      data: fileBuffer.buffer.slice(
        fileBuffer.byteOffset, 
        fileBuffer.byteOffset + fileBuffer.byteLength
      ),
      filePath 
    };
  } catch (error) {
    console.error('Error loading audio file:', error);
    return { success: false, error: (error as Error).message };
  }
});