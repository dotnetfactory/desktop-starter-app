/**
 * Desktop Starter App - Main Process Entry Point
 *
 * This is the main entry point for the Electron application.
 * It creates the browser window and initializes the application.
 */

// Load environment variables from .env file (for secrets like GH_TOKEN during development)
import dotenv from 'dotenv';
dotenv.config();

import { app, BrowserWindow, Menu, nativeTheme, screen } from 'electron';
import path from 'path';
import fs from 'fs';
import { autoUpdater } from 'electron-updater';
import { getDatabase } from './database/connection';
import { registerIPCHandlers } from './ipc/handlers';
import './types/app-config.d';

// Window state persistence
interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

const DEFAULT_WINDOW_STATE: WindowState = {
  width: 1200,
  height: 800,
  isMaximized: false,
};

function getWindowStateFilePath(): string {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState(): WindowState {
  try {
    const filePath = getWindowStateFilePath();
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      const state = JSON.parse(data) as WindowState;

      // Validate that the window position is still on a visible display
      if (state.x !== undefined && state.y !== undefined) {
        const displays = screen.getAllDisplays();
        const windowBounds = {
          x: state.x,
          y: state.y,
          width: state.width,
          height: state.height,
        };

        // Check if window center is within any display
        const centerX = windowBounds.x + windowBounds.width / 2;
        const centerY = windowBounds.y + windowBounds.height / 2;

        const isOnScreen = displays.some((display) => {
          const { x, y, width, height } = display.bounds;
          return centerX >= x && centerX < x + width && centerY >= y && centerY < y + height;
        });

        if (!isOnScreen) {
          // Window would be off-screen, reset position but keep size
          return { ...state, x: undefined, y: undefined };
        }
      }

      return state;
    }
  } catch (error) {
    console.error('[App] Failed to load window state:', error);
  }
  return DEFAULT_WINDOW_STATE;
}

function saveWindowState(state: WindowState): void {
  try {
    const filePath = getWindowStateFilePath();
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('[App] Failed to save window state:', error);
  }
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
  // Load saved window state
  const windowState = loadWindowState();

  // Create the browser window with saved state
  mainWindow = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1a1a1a' : '#ffffff',
  });

  // Restore maximized state if applicable
  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  // Track window state changes
  const saveCurrentState = () => {
    if (!mainWindow) return;

    const isMaximized = mainWindow.isMaximized();
    const bounds = mainWindow.getBounds();

    // Only save bounds if not maximized (we want to restore to non-maximized size)
    if (!isMaximized) {
      saveWindowState({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized: false,
      });
    } else {
      // When maximized, preserve the last known non-maximized bounds
      const currentState = loadWindowState();
      saveWindowState({
        ...currentState,
        isMaximized: true,
      });
    }
  };

  // Save state on resize and move (debounced via close event)
  mainWindow.on('resize', saveCurrentState);
  mainWindow.on('move', saveCurrentState);
  mainWindow.on('maximize', saveCurrentState);
  mainWindow.on('unmaximize', saveCurrentState);

  // Load the app
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    // mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// Build application menu
const buildMenu = (): void => {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),

    // File menu
    {
      label: 'File',
      submenu: [isMac ? { role: 'close' } : { role: 'quit' }],
    },

    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },

    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },

    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [{ type: 'separator' as const }, { role: 'front' as const }] : [{ role: 'close' as const }]),
      ],
    },

    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal(`https://github.com/${__APP_CONFIG__.github.owner}/${__APP_CONFIG__.github.repo}`);
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

// App ready
app.whenReady().then(() => {
  console.log('[App] Starting...');

  // Initialize auto-updater (production only, when enabled in app.config.ts)
  if (app.isPackaged && __APP_CONFIG__.autoUpdateEnabled) {
    console.log('[App] Checking for updates...');

    // Configure for private GitHub repo
    // Token is injected at build time via GH_TOKEN env var, or can be set at runtime
    const ghToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
    if (ghToken) {
      autoUpdater.requestHeaders = { Authorization: `token ${ghToken}` };
    }

    autoUpdater.logger = {
      info: (msg: string) => console.log('[AutoUpdater]', msg),
      warn: (msg: string) => console.warn('[AutoUpdater]', msg),
      error: (msg: string) => console.error('[AutoUpdater]', msg),
      debug: (msg: string) => console.log('[AutoUpdater:debug]', msg),
    };

    // Enable auto-download but use custom notifications instead of OS notifications
    autoUpdater.autoDownload = true;

    autoUpdater.on('update-available', (info) => {
      console.log('[App] Update available, downloading...', info.version);
      // Notify renderer to show in-app toast
      mainWindow?.webContents.send('update:available', info.version);
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[App] Update downloaded, ready to install', info.version);
      // Notify renderer to show persistent toast with restart button
      mainWindow?.webContents.send('update:downloaded', info.version);
    });

    autoUpdater.on('error', (err) => {
      console.error('[App] Auto-updater error:', err);
    });

    // Use checkForUpdates instead of checkForUpdatesAndNotify
    // We handle notifications in the renderer for better UX
    autoUpdater.checkForUpdates();
  }

  // Initialize database
  getDatabase();
  console.log('[App] Database initialized');

  // Register IPC handlers
  registerIPCHandlers();
  console.log('[App] IPC handlers registered');

  // Build menu
  buildMenu();

  // Create main window
  createWindow();

  // macOS: Re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  app.quit();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[App] Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('[App] Unhandled rejection:', error);
});

// Declare global constants (injected by Vite)
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
