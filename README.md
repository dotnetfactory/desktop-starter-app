# Desktop Starter App

<p align="center">
  <img src="assets/logo.png" alt="Desktop Starter App" width="200">
</p>

<p align="center">
  A production-ready Electron + React + TypeScript desktop application template.
</p>

<p align="center">
  <em>Built from lessons learned creating production desktop apps including <a href="https://www.usestoryflow.com">StoryFlow</a>.</em>
</p>

## Features

- **Auto-updates** via GitHub Releases (electron-updater)
- **SQLite database** with better-sqlite3 (WAL mode for performance)
- **Settings management** with key-value store
- **Window state persistence** (size, position, maximized state)
- **Cross-platform builds** for macOS, Windows, and Linux
- **CI/CD** with GitHub Actions
- **Code signing** support for macOS (notarization ready)
- **Dark mode** support

## Try the Demo

Download the latest release to see the template in action:

**[Download from GitHub Releases](https://github.com/dotnetfactory/desktop-starter-app/releases)**

| Platform | File |
|----------|------|
| macOS (Apple Silicon) | `DesktopStarterApp-x.x.x-arm64.dmg` |
| macOS (Intel) | `DesktopStarterApp-x.x.x-x64.dmg` |
| Windows | `DesktopStarterApp-x.x.x.Setup.exe` |
| Linux | `desktop-starter-app_x.x.x_amd64.deb` |

> **Test auto-updates:** Download an older version from [releases](https://github.com/dotnetfactory/desktop-starter-app/releases), install it, and watch it automatically update to the latest version!

## Quick Start

1. **Clone this repository**

   ```bash
   git clone https://github.com/dotnetfactory/desktop-starter-app.git
   cd YOUR_REPO_NAME
   ```

2. **Update placeholders** (see [Configuration](#configuration) below)

3. **Install dependencies**

   ```bash
   npm install
   ```

4. **Run development**
   ```bash
   npm run dev
   ```

## Configuration

### 1. Update App Config

Edit `app.config.ts` - this is the **single source of truth** for your app:

```typescript
export const config = {
  // App Identity
  productName: 'Your App Name',
  executableName: 'your-app-name',
  appBundleId: 'com.yourcompany.yourapp',

  // Database
  appDataFolder: 'YourAppName',
  dbFilename: 'app.db',

  // GitHub (for releases & auto-updates)
  github: {
    owner: 'your-username',
    repo: 'your-repo',
    private: false,
  },

  // Features
  autoUpdateEnabled: true,

  maintainer: 'Your Name <your@email.com>',
};
```

### 2. Update Package Info

Edit `package.json`:

```json
{
  "name": "your-app-name",
  "productName": "Your App Name",
  "description": "Your app description",
  "author": {
    "name": "Your Name",
    "email": "your@email.com"
  },
  "homepage": "https://github.com/YOUR_USERNAME/YOUR_REPO"
}
```

### 3. Environment Variables (Secrets Only)

The `.env` file is only for **secrets** (API keys, tokens, certificates). App configuration is in `app.config.ts`.

```bash
cp .env.example .env
```

| Variable    | Description                          | When Needed       |
| ----------- | ------------------------------------ | ----------------- |
| `GH_TOKEN`  | GitHub PAT for private repo access   | Private repos     |
| `APPLE_*`   | macOS signing credentials            | macOS releases    |

### 4. GitHub Secrets (for releases)

Add these secrets to your GitHub repository for automated releases:

| Secret                     | Description                     | Required |
| -------------------------- | ------------------------------- | -------- |
| `GH_TOKEN`                 | Personal Access Token (private) | Yes\*    |
| `APPLE_ID`                 | Apple Developer email           | macOS    |
| `APPLE_PASSWORD`           | App-specific password           | macOS    |
| `APPLE_TEAM_ID`            | Apple Team ID                   | macOS    |
| `APPLE_CERTIFICATE`        | Base64-encoded .p12 certificate | macOS    |
| `APPLE_CERTIFICATE_PASSWORD` | Certificate password            | macOS    |

\*Required only for private repositories

## Development

```bash
npm run dev          # Start with hot reload
npm run lint         # Run ESLint
npm run format       # Format with Prettier
npm run test         # Run tests
```

## Building & Releasing

### Local Build

```bash
npm run make         # Build for current platform
```

### Create a Release

```bash
# Bump version (creates git tag)
npm run version:patch   # 1.0.0 -> 1.0.1
npm run version:minor   # 1.0.0 -> 1.1.0
npm run version:major   # 1.0.0 -> 2.0.0

# Push tag to trigger release workflow
git push --follow-tags
```

GitHub Actions will automatically build for all platforms and create a release.

## Project Structure

```
├── app.config.ts        # App configuration (committed to repo)
├── forge.config.ts      # Electron Forge build config
├── src/
│   ├── main.ts          # Electron main process
│   ├── preload.ts       # IPC bridge (window.api)
│   ├── database/
│   │   ├── connection.ts    # Database singleton
│   │   ├── config.ts        # Database path management
│   │   └── schema.ts        # Schema definition
│   ├── ipc/
│   │   └── handlers.ts      # IPC handlers
│   ├── types/
│   │   └── window.ts        # TypeScript types for window.api
│   └── renderer/
│       ├── App.tsx          # Main React component
│       ├── index.tsx        # Entry point
│       ├── components/      # React components
│       └── styles/          # CSS
└── .env                 # Secrets only (gitignored)
```

## Extending the Template

### Adding a New Database Table

1. Add create function in `src/database/schema.ts`:

   ```typescript
   function createYourTable(db: Database.Database): void {
     const tableExists = db
       .prepare(
         `
       SELECT name FROM sqlite_master WHERE type='table' AND name='your_table'
     `
       )
       .get();

     if (!tableExists) {
       db.exec(`
         CREATE TABLE your_table (
           id TEXT PRIMARY KEY,
           name TEXT NOT NULL,
           created_at INTEGER NOT NULL
         );
       `);
     }
   }
   ```

2. Call it from `initializeDatabase()`:
   ```typescript
   export function initializeDatabase(db: Database.Database): void {
     createSettingsTable(db);
     createYourTable(db); // Add this
   }
   ```

### Adding New IPC Functionality

1. **Add handler** in `src/ipc/handlers.ts`:

   ```typescript
   ipcMain.handle('myFeature:doSomething', async (_, arg: string) => {
     try {
       // Your logic here
       return { success: true, data: result };
     } catch (error) {
       return { success: false, error: { code: 'ERROR', message: String(error) } };
     }
   });
   ```

2. **Add API method** in `src/preload.ts`:

   ```typescript
   const myFeatureAPI = {
     doSomething: (arg: string) => ipcRenderer.invoke('myFeature:doSomething', arg),
   };

   // Add to exposeInMainWorld
   contextBridge.exposeInMainWorld('api', {
     // ... existing APIs
     myFeature: myFeatureAPI,
   });
   ```

3. **Add types** in `src/types/window.ts`:
   ```typescript
   export interface MyFeatureAPI {
     doSomething: (arg: string) => Promise<IPCResponse<YourResultType>>;
   }
   ```

### Using Settings

Settings are stored as key-value pairs:

```typescript
// Set a setting
await window.api.settings.set('my_setting', 'value');

// Get a setting
const result = await window.api.settings.get('my_setting');
if (result.success) {
  console.log(result.data); // 'value'
}

// Get all settings
const allSettings = await window.api.settings.getAll();
```

## Auto-Updates

The app automatically checks for updates on startup when running in production. Updates are downloaded in the background and users are prompted to restart.

For detailed setup instructions, see [docs/updater.md](docs/updater.md).

## Apps Built with This Template

| App | Description |
|-----|-------------|
| [StoryFlow](https://www.usestoryflow.com) | AI-powered book writing app |
| [Model Faceoff](https://www.modelfaceoff.com) | Compare AI models side-by-side |
| [MarkdownFlows](https://github.com/dotnetfactory/markdownflows) | Markdown editor with workflows |

*Built something with this template? Open a PR to add it here!*

## Sponsored By

<a href="https://elitecoders.co">
  <img src="https://elitecoders-web.nyc3.cdn.digitaloceanspaces.com/wp-content/uploads/2023/12/logo_01.svg" alt="Elite Coders" height="40">
</a>

**[Elite Coders](https://www.elitecoders.co)** - Premium software development and consulting services.

---

## Author

Built by **[Emad Ibrahim](https://www.emadibrahim.com)**.

## License

MIT
