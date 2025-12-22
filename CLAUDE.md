# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Desktop Starter App is an Electron desktop application template with production-quality infrastructure including auto-updates, SQLite database, settings management, and CI/CD pipelines.

## Tech Stack

- **Electron** - Desktop framework
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **better-sqlite3** - SQLite database
- **electron-updater** - Auto-updates
- **electron-forge** - Build/packaging

## Commands

```bash
npm run dev          # Start development server with hot reload
npm run start        # Clean build and start dev server
npm run make         # Build distributable packages for current platform
npm run publish      # Build and publish to GitHub Releases
npm run lint         # Run ESLint
npm run format       # Format with Prettier
npm run test         # Run tests
```

## Architecture

### Electron Process Model

1. **Main Process** (`src/main.ts`)

   - Node.js environment
   - Creates browser windows
   - Handles system APIs (file dialogs, menus)
   - Manages auto-updates
   - Initializes database

2. **Preload Script** (`src/preload.ts`)

   - Bridge between main and renderer
   - Exposes `window.api` object
   - Uses contextBridge for security

3. **Renderer Process** (`src/renderer/`)
   - React application
   - Isolated browser context
   - Communicates via `window.api`

### Key Directories

- `src/database/` - SQLite connection, config, and schema
- `src/ipc/handlers.ts` - IPC handlers for main process
- `src/types/window.ts` - Type definitions for `window.api`
- `src/renderer/` - React components and styles

### Database

Uses SQLite with better-sqlite3. WAL mode enabled for concurrent access.

**Tables:**

- `settings` - Key-value store for app configuration

Schema defined in `src/database/schema.ts`.

IMPORTANT: When making changes to existing tables, make sure to create migrations in separate files.

### IPC Pattern

All IPC handlers return `IPCResponse<T>`:

```typescript
interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}
```

### Adding New IPC Handlers

1. Add handler in `src/ipc/handlers.ts`:

   ```typescript
   ipcMain.handle('myFeature:action', async (_, arg) => {
     try {
       return { success: true, data: result };
     } catch (error) {
       return { success: false, error: { code: 'ERROR', message: String(error) } };
     }
   });
   ```

2. Add method in `src/preload.ts`:

   ```typescript
   const myFeatureAPI = {
     action: (arg: string) => ipcRenderer.invoke('myFeature:action', arg),
   };
   ```

3. Add types in `src/types/window.ts`

4. Add to `contextBridge.exposeInMainWorld()`

## Configuration

### App Config (`app.config.ts`)

The **single source of truth** for app configuration. This file is committed to the repo.

```typescript
export const config = {
  productName: 'Desktop Starter App',
  executableName: 'desktop-starter-app',
  appBundleId: 'com.example.desktop-starter-app',
  appDataFolder: 'DesktopStarterApp',
  dbFilename: 'app.db',
  github: {
    owner: 'dotnetfactory',
    repo: 'desktop-starter-app',
    private: false,
  },
  autoUpdateEnabled: true,
  maintainer: 'Your Name <your@email.com>',
};
```

The config is injected at build time via Vite's `define` and available as `__APP_CONFIG__` globally.

### Environment Variables (Secrets Only)

`.env` is for secrets only (gitignored):
- `GH_TOKEN` - GitHub PAT for private repo access
- `APPLE_*` - macOS signing credentials

### Build Configuration

- `forge.config.ts` - Imports `app.config.ts` for build settings
- `vite.main.config.ts` - Injects `__APP_CONFIG__` into main process
- `vite.renderer.config.ts` - Injects `__APP_CONFIG__` into renderer
- `vite.preload.config.ts` - Preload script build config

## Important Files

- `app.config.ts` - App configuration (single source of truth)
- `src/main.ts` - Main process entry, window creation, auto-updater
- `src/preload.ts` - API bridge exposed to renderer
- `src/ipc/handlers.ts` - All IPC handlers
- `src/database/schema.ts` - Database table definitions
- `src/renderer/App.tsx` - Main React component
- `forge.config.ts` - Build and packaging configuration

