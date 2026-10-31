# Auto-Update & Deployment

## Overview

This template uses GitHub Releases for hosting updates with `electron-updater` for auto-update functionality.

## Architecture

| Component           | Choice                | Reason                                             |
| ------------------- | --------------------- | -------------------------------------------------- |
| Update hosting      | GitHub Releases       | No extra infrastructure, native CI/CD integration  |
| Auto-update library | `electron-updater`    | Reads public GitHub releases anonymously, no token |
| CI/CD               | GitHub Actions        | Multi-platform builds, integrated with GitHub      |
| Code signing        | macOS: Apple Developer | macOS required for auto-updates to work correctly |

## Setup Checklist

- [x] Dependencies installed (`electron-updater`, `@electron-forge/publisher-github`)
- [x] forge.config.ts updated with GitHub publisher
- [x] Auto-updater added to main process
- [x] GitHub Actions workflows created
- [x] Version scripts added
- [ ] Update `app.config.ts` with your GitHub repo info
- [ ] Releases live in a PUBLIC repo (a private source repo publishes to a public `<app>-releases` repo)
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
  private: false,  // keep false: the app reads releases anonymously, no token is ever embedded
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
   - `prepare`: checks that the tag equals `v<package.json version>`, then creates the draft release
   - `release` (matrix): builds macOS arm64 + x64, Windows and Linux, signs macOS when certs are
     configured, and uploads the installers plus this platform's `latest-*.yml` into the draft
   - `finalize`: merges `latest-mac-arm64.yml` + `latest-mac-x64.yml` into one `latest-mac.yml`,
     verifies every manifest against the tag and the uploaded assets (names, sizes, sha512), and
     only then publishes the draft. A failed check leaves the draft unpublished.
4. Users with installed app receive update notification

## GitHub Actions Workflows

### build.yml (CI)

- **Trigger**: Push to main, Pull requests
- **Platforms**: macOS, Windows, Ubuntu
- **Steps**: Checkout, Node 20 setup, npm ci, vitest, make, assert the packaged `app-update.yml` names the public repo and has no token
- **Purpose**: Validate builds on every change

### release.yml (Publish)

- **Trigger**: Push tags `v*`
- **Platforms**: macOS (arm64 + x64), Windows, Linux
- **Jobs**: prepare (draft) → release matrix (`npm run publish` into the draft) → finalize (merge mac manifests, verify, undraft)
- **Purpose**: Build and publish releases

## GitHub Secrets Required

| Secret                       | Platform | Purpose                                      |
| ---------------------------- | -------- | -------------------------------------------- |
| `GITHUB_TOKEN`               | All      | Auto-provided by GitHub Actions; publishes to this repo's releases |
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

## Private Source Repositories

The app never carries a GitHub credential: `app-update.yml` (written by `forge.config.ts` into
`Contents/Resources`) names a public repo with `private: false`, and electron-updater reads its
releases anonymously. A token embedded in that file ships in every installer and will leak (one
did, in Oct 2026). So if the source repo is private:

1. Create a PUBLIC `<app>-releases` repo (README only) for the installers
2. Point `app.config.ts` `github.repo` at it and keep `private: false`
3. Create a fine-grained PAT with Contents read/write on that repo only, add it as the
   `RELEASES_TOKEN` secret, set `authToken: process.env.RELEASES_TOKEN` on the publisher in
   `forge.config.ts`, and pass it ONLY to the steps that need it: the `npm run publish` step of
   the matrix and the gh CLI steps in `prepare` / `finalize`. Never set it at job or workflow
   level, and never on `npm ci`, whose install scripts would see it. The packaging hook never
   reads it.

storyflow-app and nitrosocial-app are the reference implementations.

## Release Manifests

`scripts/release-manifests.ts` generates `latest-mac.yml`, `latest.yml` and `latest-linux.yml`
(unit tests in `scripts/release-manifests.test.ts`). Two rules it enforces:

- Asset names are the ones GitHub stores. GitHub rewrites spaces to dots on upload, so the Squirrel
  installer `App-1.0.0 Setup.exe` becomes `App-1.0.0.Setup.exe`; a manifest naming the on-disk
  file makes every Windows update 404.
- macOS ships ONE `latest-mac.yml` listing both the arm64 and the x64 zip. electron-updater's
  `MacUpdater` keeps the entry whose url contains `arm64` on Apple Silicon and the other on Intel.
  Each mac job uploads `latest-mac-<arch>.yml`; the finalize job merges them
  (`npm run manifests:merge-mac`) and verifies the result (`npm run manifests:verify`).

## Troubleshooting

### Auto-update not working

- Check `app.isPackaged` is true (only works in production builds)
- Verify the releases repo is public and the latest release carries `latest-mac.yml` (both arches), `latest.yml` and `latest-linux.yml`
- Check GitHub Releases has assets for current platform
- Look at the console logs for `[AutoUpdater]` messages

### macOS "app is damaged" error

- App needs to be signed and notarized
- Set up Apple Developer certificates in GitHub secrets

### Windows SmartScreen warning

- Expected without code signing
- Users click "More info" -> "Run anyway"
