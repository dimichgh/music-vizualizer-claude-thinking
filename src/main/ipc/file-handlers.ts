import { BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'fs';

/**
 * Register IPC handlers related to file operations
 * @param mainWindow The main application window
 */
export function registerFileHandlers(mainWindow: BrowserWindow): void {
  // Handle file open dialog
  ipcMain.handle('dialog:openFile', async () => {
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
}