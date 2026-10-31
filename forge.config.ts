import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { PublisherGithub } from '@electron-forge/publisher-github';
import fs from 'fs';
import path from 'path';

// Import app configuration (committed to repo)
import { config as appConfig } from './app.config';
// Update metadata: app-update.yml and the latest-*.yml manifests. Never embeds a credential.
import { renderAppUpdateYml, writeManifestsForMakeResults } from './scripts/release-manifests';

// Modules that need to be copied to the packaged app (native modules)
const modulesToCopy = ['better-sqlite3', 'bindings', 'file-uri-to-path', 'electron-squirrel-startup'];

// Helper to copy directory recursively
function copyDirSync(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const config: ForgeConfig = {
  packagerConfig: {
    name: appConfig.productName.replace(/\s+/g, ''), // Remove spaces for app name
    executableName: appConfig.executableName,
    icon: './assets/icon',
    appBundleId: appConfig.appBundleId,
    appCategoryType: appConfig.appCategory,
    asar: {
      unpack: '**/*.{node,dylib}',
    },
    extraResource: [],
    // macOS code signing (only applied when env vars are set)
    // These MUST remain as environment variables (secrets)
    ...(process.env.APPLE_ID &&
      process.env.APPLE_PASSWORD &&
      process.env.APPLE_TEAM_ID && {
        osxSign: {
          identity: process.env.APPLE_SIGNING_IDENTITY || 'Developer ID Application',
          identityValidation: true,
        },
        osxNotarize: {
          appleId: process.env.APPLE_ID,
          appleIdPassword: process.env.APPLE_PASSWORD,
          teamId: process.env.APPLE_TEAM_ID,
        },
      }),
  },
  rebuildConfig: {
    // Rebuild native modules for Electron
    onlyModules: ['better-sqlite3'],
    force: true,
  },
  hooks: {
    packageAfterCopy: async (_config, buildPath) => {
      // Copy native modules to the build directory
      const nodeModulesSrc = path.resolve(__dirname, 'node_modules');
      const nodeModulesDest = path.join(buildPath, 'node_modules');

      for (const moduleName of modulesToCopy) {
        const src = path.join(nodeModulesSrc, moduleName);
        const dest = path.join(nodeModulesDest, moduleName);
        if (fs.existsSync(src)) {
          console.log(`Copying native module: ${moduleName}`);
          copyDirSync(src, dest);
        }
      }

      // Generate app-update.yml, which tells electron-updater where releases live.
      // IMPORTANT: This must be done BEFORE code signing (in packageAfterCopy, not postPackage)
      // Adding files after signing invalidates the code signature!
      //
      // The file ships inside every installer, so it never carries a credential: installed apps
      // read releases anonymously from a PUBLIC repo (`private: false`). A private source repo
      // therefore publishes to a public `<app>-releases` repo, using a RELEASES_TOKEN secret
      // scoped to that repo for publishing only (see storyflow-app and nitrosocial-app). Nothing
      // here reads GH_TOKEN or writes a `token:` line; scripts/release-manifests.test.ts asserts it.
      if (appConfig.github.private) {
        console.warn(
          'Warning: app.config.ts github.private is true. electron-updater cannot read a private repo without a token, and this build never embeds one; publish to a public <app>-releases repo instead.'
        );
      }
      const appUpdateYml = renderAppUpdateYml(appConfig.github);

      // buildPath is the app's Contents/Resources/app directory
      // We need to write to the parent Resources directory (outside asar)
      const resourcesPath = path.resolve(buildPath, '..');
      const updateYmlDest = path.join(resourcesPath, 'app-update.yml');
      console.log(`Writing app-update.yml to ${resourcesPath}`);
      fs.writeFileSync(updateYmlDest, appUpdateYml);
    },
    postMake: async (_config, makeResults) => {
      // Generate the latest-*.yml manifests electron-updater reads (version, asset name, sha512).
      // One per platform: latest.yml (Windows), latest-linux.yml, and latest-mac-<arch>.yml, which
      // the release workflow's finalize job merges into the single latest-mac.yml listing both
      // architectures. Asset names are the ones GitHub stores (no spaces); see
      // scripts/release-manifests.ts for the rules and the bugs they fix.
      const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
      const written = await writeManifestsForMakeResults(makeResults, packageJson.version);
      for (const manifestPath of written) {
        console.log(`Wrote ${path.basename(manifestPath)} -> ${manifestPath}`);
      }
    },
  },
  makers: [
    new MakerSquirrel({
      name: appConfig.productName.replace(/\s+/g, ''),
      setupIcon: './assets/icon.ico',
    }),
    new MakerZIP({}, ['darwin', 'linux']),
    new MakerDMG({
      format: 'ULFO',
      icon: './assets/icon.icns',
    }),
    new MakerDeb({
      options: {
        icon: './assets/icon.png',
        maintainer: appConfig.maintainer,
        homepage: `https://github.com/${appConfig.github.owner}/${appConfig.github.repo}`,
      },
    }),
    new MakerRpm({
      options: {
        icon: './assets/icon.png',
        homepage: `https://github.com/${appConfig.github.owner}/${appConfig.github.repo}`,
      },
    }),
  ],
  publishers: [
    new PublisherGithub({
      // Publishes to this repo's own releases with the workflow's GITHUB_TOKEN.
      repository: {
        owner: appConfig.github.owner,
        name: appConfig.github.repo,
      },
      authToken: process.env.GITHUB_TOKEN,
      prerelease: false,
      // Matrix jobs append to the draft pre-created by the workflow's prepare job; the finalize
      // job merges the macOS manifests, verifies every manifest against the uploaded assets and
      // only then publishes the draft.
      draft: true,
    }),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
};

export default config;
