/**
 * IPC Handlers for Desktop Starter App
 *
 * Registers all IPC handlers for the main process.
 * Add your own handlers following the pattern below.
 */

import { ipcMain, dialog, shell, app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { getDatabase, closeDatabase, getCurrentDatabasePath } from '../database/connection';
import { getDatabaseInfo, migrateDatabase, getDefaultDatabasePath, saveDatabaseConfig } from '../database/config';

/**
 * Register all IPC handlers
 */
export function registerIPCHandlers(): void {
  // ============= Settings =============

  ipcMain.handle('settings:get', async (_, key: string) => {
    try {
      const db = getDatabase();
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
      return { success: true, data: row?.value || null };
    } catch (error) {
      return { success: false, error: { code: 'GET_SETTING_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('settings:set', async (_, key: string, value: string) => {
    try {
      const db = getDatabase();
      const now = Date.now();
      db.prepare(`
        INSERT INTO settings (key, value, created_at, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(key, value, now, now);
      return { success: true };
    } catch (error) {
      return { success: false, error: { code: 'SET_SETTING_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('settings:getAll', async () => {
    try {
      const db = getDatabase();
      const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
      const settings: Record<string, string> = {};
      for (const row of rows) {
        settings[row.key] = row.value;
      }
      return { success: true, data: settings };
    } catch (error) {
      return { success: false, error: { code: 'GET_ALL_SETTINGS_ERROR', message: String(error) } };
    }
  });

  // ============= Dialog =============

  ipcMain.handle(
    'dialog:showSaveDialog',
    async (_, options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => {
      const result = await dialog.showSaveDialog({
        defaultPath: options?.defaultPath,
        filters: options?.filters,
      });
      return result.canceled ? undefined : result.filePath;
    }
  );

  ipcMain.handle(
    'dialog:showOpenDialog',
    async (_, options?: { filters?: { name: string; extensions: string[] }[]; properties?: string[] }) => {
      const result = await dialog.showOpenDialog({
        filters: options?.filters,
        properties: options?.properties as ('openFile' | 'openDirectory' | 'multiSelections')[],
      });
      return result.canceled ? undefined : result.filePaths;
    }
  );

  // ============= Shell =============

  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    await shell.openExternal(url);
  });

  ipcMain.handle('shell:showItemInFolder', async (_, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  // ============= Database Location =============

  ipcMain.handle('database:getInfo', async () => {
    try {
      const info = getDatabaseInfo();
      const currentPath = getCurrentDatabasePath();
      return {
        success: true,
        data: {
          ...info,
          currentPath: currentPath || info.currentPath,
        },
      };
    } catch (error) {
      return { success: false, error: { code: 'GET_DB_INFO_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('database:migrateToDocuments', async () => {
    try {
      const info = getDatabaseInfo();
      const sourcePath = getCurrentDatabasePath() || info.currentPath;
      const destPath = getDefaultDatabasePath();

      if (sourcePath === destPath) {
        return {
          success: false,
          error: { code: 'ALREADY_IN_DOCUMENTS', message: 'Database is already in Documents folder' },
        };
      }

      // Close the current database connection
      closeDatabase();

      // Perform the migration
      const result = migrateDatabase(sourcePath, destPath);

      if (!result.success) {
        getDatabase(); // Re-open at old location
        return { success: false, error: { code: 'MIGRATION_FAILED', message: result.error } };
      }

      // Re-open the database at the new location
      getDatabase();

      return {
        success: true,
        data: { oldPath: sourcePath, newPath: destPath },
      };
    } catch (error) {
      try {
        getDatabase();
      } catch {
        // Ignore recovery errors
      }
      return { success: false, error: { code: 'MIGRATION_ERROR', message: String(error) } };
    }
  });

  ipcMain.handle('database:showInFinder', async () => {
    const currentPath = getCurrentDatabasePath();
    if (currentPath) {
      shell.showItemInFolder(currentPath);
      return { success: true };
    }
    return { success: false, error: { code: 'NO_DB_PATH', message: 'Database path not available' } };
  });

  ipcMain.handle('database:selectExisting', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Database',
        filters: [{ name: 'SQLite Database', extensions: ['db'] }],
        properties: ['openFile'],
        message: 'Select an existing database file',
      });

      if (result.canceled || !result.filePaths[0]) {
        return { success: false, error: { code: 'CANCELLED', message: 'Selection cancelled' } };
      }

      const selectedPath = result.filePaths[0];

      // Close the current database connection
      closeDatabase();

      // Save the new path to config
      saveDatabaseConfig({ dbPath: selectedPath });

      // Re-open the database at the new location
      getDatabase();

      return { success: true, data: { newPath: selectedPath } };
    } catch (error) {
      try {
        getDatabase();
      } catch {
        // Ignore recovery errors
      }
      return { success: false, error: { code: 'SELECT_ERROR', message: String(error) } };
    }
  });

  // ============= App =============

  ipcMain.handle('app:getVersion', () => {
    return { success: true, data: app.getVersion() };
  });

  ipcMain.handle('app:quitAndInstall', () => {
    autoUpdater.quitAndInstall();
    return { success: true };
  });

  // ============= Add Your Handlers Below =============
  // Example:
  // ipcMain.handle('myFeature:doSomething', async (_, arg: string) => {
  //   try {
  //     // Your logic here
  //     return { success: true, data: result };
  //   } catch (error) {
  //     return { success: false, error: { code: 'MY_ERROR', message: String(error) } };
  //   }
  // });

  console.log('[IPC] All handlers registered');
}
