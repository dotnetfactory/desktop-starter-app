# Auto-Update & Deployment

## Overview

This template uses GitHub Releases for hosting updates with `electron-updater` for auto-update functionality.

## Architecture

| Component           | Choice                | Reason                                             |
| ------------------- | --------------------- | -------------------------------------------------- |
| Update hosting      | GitHub Releases       | No extra infrastructure, native CI/CD integration  |
| Auto-update library | `electron-updater`    | Works with private repos via GH_TOKEN              |
| CI/CD               | GitHub Actions        | Multi-platform builds, integrated with GitHub      |
| Code signing        | macOS: Apple Developer | macOS required for auto-updates to work correctly |

## Setup Checklist

- [x] Dependencies installed (`electron-updater`, `@electron-forge/publisher-github`)
- [x] forge.config.ts updated with GitHub publisher
- [x] Auto-updater added to main process
- [x] GitHub Actions workflows created
- [x] Version scripts added
- [ ] Update `app.config.ts` with your GitHub repo info
- [ ] GitHub PAT created for update checks (required for private repos)
- [ ] App icons added to assets/ (icon.icns, icon.ico, icon.png)
- [ ] Apple Developer account setup (for macOS code signing) - optional

## Configuration

### Enabling Auto-Updates

Auto-updates are controlled by `autoUpdateEnabled` in `app.config.ts`:

```typescript
// app.config.ts
export const config = {
  // ...
  autoUpdateEnabled: true,  // Set to true to enable auto-updates
  // ...
};
```

This setting is baked into the app at build time and cannot be changed by end users after installation.

### app.config.ts

Update the GitHub section in `app.config.ts`:

```typescript
github: {
  owner: 'your-username',
  repo: 'your-repo',
  private: false,  // Set to true for private repos (requires GH_TOKEN)
},
```

### How It Works

The auto-updater in `src/main.ts` checks `__APP_CONFIG__.autoUpdateEnabled`:

```typescript
if (app.isPackaged && __APP_CONFIG__.autoUpdateEnabled) {
  autoUpdater.checkForUpdates();
}
```

## Release Workflow

1. Make changes and commit to main
2. Run version bump:
   ```bash
   npm run version:patch   # 1.0.0 -> 1.0.1
   npm run version:minor   # 1.0.0 -> 1.1.0
   npm run version:major   # 1.0.0 -> 2.0.0
   ```
3. GitHub Actions automatically:
   - Builds for macOS, Windows, Linux
   - Signs macOS build (when certs configured)
   - Publishes to GitHub Releases
4. Users with installed app receive update notification

## GitHub Actions Workflows

### build.yml (CI)

- **Trigger**: Push to main, Pull requests
- **Platforms**: macOS, Windows, Ubuntu
- **Steps**: Checkout, Node 20 setup, npm ci, lint, test, make
- **Purpose**: Validate builds on every change

### release.yml (Publish)

- **Trigger**: Push tags `v*`
- **Platforms**: macOS (arm64 + x64), Windows, Linux
- **Steps**: Checkout, Node setup, npm ci, publish
- **Purpose**: Build and publish releases

## GitHub Secrets Required

| Secret                       | Platform | Purpose                                      |
| ---------------------------- | -------- | -------------------------------------------- |
| `GITHUB_TOKEN`               | All      | Auto-provided by GitHub Actions              |
| `GH_TOKEN`                   | App      | PAT for checking updates (private repo only) |
| `APPLE_CERTIFICATE`          | macOS    | Base64-encoded .p12 certificate              |
| `APPLE_CERTIFICATE_PASSWORD` | macOS    | Certificate password                         |
| `APPLE_ID`                   | macOS    | Apple ID email for notarization              |
| `APPLE_PASSWORD`             | macOS    | App-specific password                        |
| `APPLE_TEAM_ID`              | macOS    | 10-character Team ID                         |

## Code Signing

### macOS (Required for auto-updates)

1. Join Apple Developer Program ($99/year)
2. Create "Developer ID Application" certificate in developer.apple.com
3. Export as .p12 file with password
4. Base64 encode: `base64 -i certificate.p12 | pbcopy`
5. Add to GitHub repo secrets

### Windows (Optional)

Currently skipped - users see SmartScreen warning on first install.
Can add Azure Trusted Signing later if needed.

## Local Development

Build without code signing:

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run make
```

Test the built app:

```bash
# macOS
open out/make/dmg/darwin-arm64/DesktopStarterApp.dmg

# Windows
./out/make/squirrel.windows/x64/DesktopStarterApp-1.0.0\ Setup.exe
```

## Testing Auto-Updates

1. Build and install version 1.0.0
2. Bump to 1.0.1: `npm run version:patch`
3. Wait for GitHub Actions to publish
4. Open installed 1.0.0 app
5. Update notification should appear

## Private Repository Token

For private repositories, the app needs a GitHub PAT to check for updates:

1. Create fine-grained PAT at github.com/settings/tokens
2. Scope: `contents:read` on your repository only
3. Add as `GH_TOKEN` in GitHub Secrets
4. The token is embedded in the app during build

The token is read-only and only provides access to release assets.

## Troubleshooting

### Auto-update not working

- Check `app.isPackaged` is true (only works in production builds)
- Verify GH_TOKEN is set for private repos
- Check GitHub Releases has assets for current platform
- Look at the console logs for `[AutoUpdater]` messages

### macOS "app is damaged" error

- App needs to be signed and notarized
- Set up Apple Developer certificates in GitHub secrets

### Windows SmartScreen warning

- Expected without code signing
- Users click "More info" -> "Run anyway"
