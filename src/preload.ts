/**
 * Preload script for Desktop Starter App
 *
 * Exposes the API to the renderer process via contextBridge.
 * This file runs in a sandboxed context with access to Node.js APIs.
 *
 * Add your own APIs following the pattern below.
 */

import { contextBridge, ipcRenderer } from 'electron';

// Settings API
const settingsAPI = {
  get: (key: string) => ipcRenderer.invoke('settings:get', key),
  set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
  getAll: () => ipcRenderer.invoke('settings:getAll'),
};

// Dialog API
const dialogAPI = {
  showSaveDialog: (options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) =>
    ipcRenderer.invoke('dialog:showSaveDialog', options),
  showOpenDialog: (options?: { filters?: { name: string; extensions: string[] }[]; properties?: string[] }) =>
    ipcRenderer.invoke('dialog:showOpenDialog', options),
};

// Shell API
const shellAPI = {
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('shell:showItemInFolder', filePath),
};

// Database API
const databaseAPI = {
  getInfo: () => ipcRenderer.invoke('database:getInfo'),
  migrateToDocuments: () => ipcRenderer.invoke('database:migrateToDocuments'),
  showInFinder: () => ipcRenderer.invoke('database:showInFinder'),
  selectExisting: () => ipcRenderer.invoke('database:selectExisting'),
};

// App API
const appAPI = {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  quitAndInstall: () => ipcRenderer.invoke('app:quitAndInstall'),
  onUpdateAvailable: (callback: (version: string) => void) => {
    ipcRenderer.on('update:available', (_, version) => callback(version));
  },
  onUpdateDownloaded: (callback: (version: string) => void) => {
    ipcRenderer.on('update:downloaded', (_, version) => callback(version));
  },
  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update:available');
    ipcRenderer.removeAllListeners('update:downloaded');
  },
};

// Expose APIs to renderer
contextBridge.exposeInMainWorld('api', {
  settings: settingsAPI,
  dialog: dialogAPI,
  shell: shellAPI,
  database: databaseAPI,
  app: appAPI,
});

// Add your own APIs below:
// const myFeatureAPI = {
//   doSomething: (arg: string) => ipcRenderer.invoke('myFeature:doSomething', arg),
// };
// Then add to exposeInMainWorld: myFeature: myFeatureAPI,
