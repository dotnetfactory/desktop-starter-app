import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ForgeGitHub from '@electron-forge/publisher-github/dist/util/github';
import { config as appConfig } from '../app.config';
import {
  LINUX_MANIFEST,
  MAC_MANIFEST,
  WINDOWS_MANIFEST,
  buildManifest,
  describeArtifact,
  githubAssetName,
  isUpdateArtifact,
  manifestFileName,
  mergeMacManifests,
  parseManifest,
  perArchMacManifest,
  referencedAssetNames,
  renderAppUpdateYml,
  serializeManifest,
  verifyReleaseManifests,
  writeManifestsForMakeResults,
  type UpdateManifest,
} from './release-manifests';

/** What the forge hook must package for THIS app: the public repo, no credential. */
const EXPECTED_APP_UPDATE_YML = ['provider: github', 'owner: dotnetfactory', 'repo: desktop-starter-app', 'private: false', ''].join('\n');

const appName = appConfig.productName.replace(/\s+/g, '');
const VERSION = '9.9.9';
const RELEASE_DATE = '2026-10-31T12:00:00.000Z';

let tmp: string;

function writeFixture(relativePath: string, content: string): string {
  const fullPath = path.join(tmp, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  return fullPath;
}

function expectedEntry(fullPath: string, content: string) {
  return {
    url: githubAssetName(fullPath),
    sha512: crypto.createHash('sha512').update(content).digest('base64'),
    size: Buffer.byteLength(content),
  };
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'release-manifests-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  delete process.env.GH_TOKEN;
  delete process.env.GITHUB_TOKEN;
  delete process.env.RELEASES_TOKEN;
});

describe('app-update.yml', () => {
  it('names the public releases repo for this app and nothing else', () => {
    expect(renderAppUpdateYml(appConfig.github)).toBe(EXPECTED_APP_UPDATE_YML);
  });

  it('never contains a token, even when the CI token variables are set', () => {
    process.env.GH_TOKEN = 'not-a-real-token';
    process.env.GITHUB_TOKEN = 'not-a-real-token';
    process.env.RELEASES_TOKEN = 'not-a-real-token';
    const yml = renderAppUpdateYml(appConfig.github);
    expect(yml).toBe(EXPECTED_APP_UPDATE_YML);
    expect(yml).not.toMatch(/token/i);
    expect(yml.split('\n').filter(Boolean)).toHaveLength(4);
  });

  it('points electron-updater at a public repo so no credential is needed', () => {
    expect(appConfig.github.private).toBe(false);
  });
});

describe('githubAssetName', () => {
  it('turns the space in the Squirrel installer name into the dot GitHub stores', () => {
    // v1.0.10 of Model Faceoff shipped a latest.yml naming "ModelFaceoff-1.0.10 Setup.exe" while
    // GitHub had stored "ModelFaceoff-1.0.10.Setup.exe"; updaters 404ed.
    expect(githubAssetName(`${appName}-${VERSION} Setup.exe`)).toBe(`${appName}-${VERSION}.Setup.exe`);
    expect(githubAssetName('ModelFaceoff-1.0.10 Setup.exe')).toBe('ModelFaceoff-1.0.10.Setup.exe');
  });

  it('leaves the zip, dmg, deb and rpm names alone', () => {
    for (const name of [
      `${appName}-darwin-arm64-${VERSION}.zip`,
      `${appName}-darwin-x64-${VERSION}.zip`,
      `${appName}-${VERSION}-arm64.dmg`,
      `${appName.toLowerCase()}_${VERSION}_amd64.deb`,
      `${appName.toLowerCase()}-${VERSION}-1.x86_64.rpm`,
      `${appName}-${VERSION}-full.nupkg`,
      'RELEASES',
    ]) {
      expect(githubAssetName(name)).toBe(name);
    }
  });

  it('matches the sanitizer the Forge GitHub publisher uses when it uploads', () => {
    for (const name of [
      `${appName}-${VERSION} Setup.exe`,
      'Désktop App-1.0.0 Setup.exe',
      'weird  name!!.zip',
      '.hidden.zip',
      'trailing.zip.',
      '/some/dir/App-1.2.3 Setup.exe',
    ]) {
      expect(githubAssetName(name)).toBe(ForgeGitHub.sanitizeName(name));
    }
  });
});

describe('describeArtifact', () => {
  it('reports the GitHub asset name, base64 sha512 and byte size of the file', async () => {
    const content = 'installer bytes '.repeat(1000);
    const artifact = writeFixture(`out/make/squirrel.windows/x64/${appName}-${VERSION} Setup.exe`, content);
    expect(await describeArtifact(artifact)).toEqual(expectedEntry(artifact, content));
  });
});

describe('writeManifestsForMakeResults', () => {
  it('writes a per-arch mac manifest, an exact-name Windows manifest and a Linux manifest', async () => {
    const armZip = writeFixture(`out/make/zip/darwin/arm64/${appName}-darwin-arm64-${VERSION}.zip`, 'arm64 zip');
    const armDmg = writeFixture(`out/make/${appName}-${VERSION}-arm64.dmg`, 'arm64 dmg');
    const nupkg = writeFixture(`out/make/squirrel.windows/x64/${appName}-${VERSION}-full.nupkg`, 'nupkg');
    const setupExe = writeFixture(`out/make/squirrel.windows/x64/${appName}-${VERSION} Setup.exe`, 'setup exe');
    const releasesFile = writeFixture('out/make/squirrel.windows/x64/RELEASES', 'RELEASES');
    const deb = writeFixture(`out/make/deb/x64/${appName.toLowerCase()}_${VERSION}_amd64.deb`, 'deb');
    const rpm = writeFixture(`out/make/rpm/x64/${appName.toLowerCase()}-${VERSION}-1.x86_64.rpm`, 'rpm');
    const linuxZip = writeFixture(`out/make/zip/linux/x64/${appName}-linux-x64-${VERSION}.zip`, 'linux zip');

    const results = [
      { platform: 'darwin', arch: 'arm64', artifacts: [armZip] },
      { platform: 'darwin', arch: 'arm64', artifacts: [armDmg] },
      { platform: 'win32', arch: 'x64', artifacts: [nupkg, setupExe, releasesFile] },
      { platform: 'linux', arch: 'x64', artifacts: [deb] },
      { platform: 'linux', arch: 'x64', artifacts: [rpm] },
      { platform: 'linux', arch: 'x64', artifacts: [linuxZip] },
    ];

    const written = await writeManifestsForMakeResults(results, VERSION, RELEASE_DATE);

    expect(written.map((file) => path.basename(file))).toEqual([perArchMacManifest('arm64'), WINDOWS_MANIFEST, LINUX_MANIFEST]);
    expect(written.map((file) => path.basename(file))).not.toContain(MAC_MANIFEST);

    const mac = parseManifest(fs.readFileSync(written[0], 'utf8'));
    expect(mac).toEqual({
      version: VERSION,
      files: [expectedEntry(armZip, 'arm64 zip')],
      path: `${appName}-darwin-arm64-${VERSION}.zip`,
      sha512: expectedEntry(armZip, 'arm64 zip').sha512,
      releaseDate: RELEASE_DATE,
    });

    const windows = parseManifest(fs.readFileSync(written[1], 'utf8'));
    expect(windows.files).toEqual([expectedEntry(setupExe, 'setup exe')]);
    expect(windows.files[0].url).toBe(`${appName}-${VERSION}.Setup.exe`);
    expect(windows.path).toBe(`${appName}-${VERSION}.Setup.exe`);
    expect(fs.readFileSync(written[1], 'utf8')).not.toContain(' Setup.exe');

    const linux = parseManifest(fs.readFileSync(written[2], 'utf8'));
    expect(linux.files).toEqual([expectedEntry(deb, 'deb')]);

    // Each manifest is appended to its own make result so the publisher uploads it.
    expect(results[0].artifacts).toEqual([armZip, written[0]]);
    expect(results[1].artifacts).toEqual([armDmg]);
    expect(results[2].artifacts).toEqual([nupkg, setupExe, releasesFile, written[1]]);
    expect(results[3].artifacts).toEqual([deb, written[2]]);
    expect(results[4].artifacts).toEqual([rpm]);
    expect(results[5].artifacts).toEqual([linuxZip]);
  });

  it('refuses to let two results overwrite the same manifest', async () => {
    const first = writeFixture(`a/${appName}-darwin-arm64-${VERSION}.zip`, 'a');
    const second = writeFixture(`b/${appName}-darwin-arm64-${VERSION}.zip`, 'b');
    await expect(
      writeManifestsForMakeResults(
        [
          { platform: 'darwin', arch: 'arm64', artifacts: [first] },
          { platform: 'darwin', arch: 'arm64', artifacts: [second] },
        ],
        VERSION
      )
    ).rejects.toThrow(/both write latest-mac-arm64\.yml/);
  });

  it('knows which artifact the updater downloads per platform', () => {
    expect(isUpdateArtifact('darwin', 'App.zip')).toBe(true);
    expect(isUpdateArtifact('darwin', 'App.dmg')).toBe(false);
    expect(isUpdateArtifact('win32', 'App Setup.exe')).toBe(true);
    expect(isUpdateArtifact('win32', 'App-full.nupkg')).toBe(false);
    expect(isUpdateArtifact('linux', 'app.deb')).toBe(true);
    expect(isUpdateArtifact('linux', 'app.rpm')).toBe(false);
    expect(isUpdateArtifact('linux', 'App-linux-x64.zip')).toBe(false);
    expect(manifestFileName('darwin', 'x64')).toBe('latest-mac-x64.yml');
    expect(manifestFileName('win32', 'x64')).toBe(WINDOWS_MANIFEST);
    expect(manifestFileName('linux', 'x64')).toBe(LINUX_MANIFEST);
    expect(manifestFileName('freebsd', 'x64')).toBeNull();
  });
});

function macManifest(arch: 'arm64' | 'x64', releaseDate = RELEASE_DATE, version = VERSION): UpdateManifest {
  const entry = {
    url: `${appName}-darwin-${arch}-${version}.zip`,
    sha512: crypto.createHash('sha512').update(`${arch} zip`).digest('base64'),
    size: arch === 'arm64' ? 1001 : 1002,
  };
  return buildManifest(version, [entry], releaseDate);
}

describe('mergeMacManifests', () => {
  it('lists both arches in one manifest, arm64 first and in the legacy fields', () => {
    const arm64 = macManifest('arm64', '2026-10-31T12:00:00.000Z');
    const x64 = macManifest('x64', '2026-10-31T12:05:00.000Z');

    const merged = mergeMacManifests([x64, arm64]);

    expect(merged.version).toBe(VERSION);
    expect(merged.files).toEqual([arm64.files[0], x64.files[0]]);
    expect(merged.path).toBe(arm64.files[0].url);
    expect(merged.sha512).toBe(arm64.files[0].sha512);
    expect(merged.releaseDate).toBe('2026-10-31T12:05:00.000Z');

    // electron-updater's MacUpdater keeps the entry whose url contains "arm64" on Apple Silicon.
    expect(merged.files.filter((file) => file.url.includes('arm64'))).toHaveLength(1);
    expect(merged.files.filter((file) => !file.url.includes('arm64'))).toHaveLength(1);
  });

  it('survives a serialize/parse round trip', () => {
    const merged = mergeMacManifests([macManifest('arm64'), macManifest('x64')]);
    expect(parseManifest(serializeManifest(merged))).toEqual(merged);
  });

  it('rejects a missing arch, a duplicated arch and mismatched versions', () => {
    expect(() => mergeMacManifests([macManifest('arm64')])).toThrow(/Need the arm64 and x64/);
    expect(() => mergeMacManifests([macManifest('arm64'), macManifest('arm64')])).toThrow(/exactly one arm64 and one x64/);
    expect(() => mergeMacManifests([macManifest('x64'), macManifest('x64')])).toThrow(/exactly one arm64 and one x64/);
    expect(() => mergeMacManifests([macManifest('arm64'), macManifest('x64', RELEASE_DATE, '1.0.0')])).toThrow(/disagree on the version/);
  });
});

describe('parseManifest', () => {
  it('reads the format electron-builder and this module write', () => {
    const text = [
      'version: 1.0.10',
      'files:',
      '  - url: ModelFaceoff-darwin-arm64-1.0.10.zip',
      '    sha512: Hs+L9E91/2zo6XrzH3U2k0spIgQmYIokamwJWdLGpgZTrFT6ZWAEGnvVCJW78IGDZM9+xhn34ZtrgaUFaD7KTA==',
      '    size: 119703960',
      'path: ModelFaceoff-darwin-arm64-1.0.10.zip',
      'sha512: Hs+L9E91/2zo6XrzH3U2k0spIgQmYIokamwJWdLGpgZTrFT6ZWAEGnvVCJW78IGDZM9+xhn34ZtrgaUFaD7KTA==',
      "releaseDate: '2026-08-20T20:31:34.077Z'",
      '',
    ].join('\n');
    expect(parseManifest(text)).toEqual({
      version: '1.0.10',
      files: [
        {
          url: 'ModelFaceoff-darwin-arm64-1.0.10.zip',
          sha512: 'Hs+L9E91/2zo6XrzH3U2k0spIgQmYIokamwJWdLGpgZTrFT6ZWAEGnvVCJW78IGDZM9+xhn34ZtrgaUFaD7KTA==',
          size: 119703960,
        },
      ],
      path: 'ModelFaceoff-darwin-arm64-1.0.10.zip',
      sha512: 'Hs+L9E91/2zo6XrzH3U2k0spIgQmYIokamwJWdLGpgZTrFT6ZWAEGnvVCJW78IGDZM9+xhn34ZtrgaUFaD7KTA==',
      releaseDate: '2026-08-20T20:31:34.077Z',
    });
  });

  it('rejects manifests without files, urls, hashes or sizes', () => {
    expect(() => parseManifest('version: 1.0.0\n')).toThrow(/lists no files/);
    expect(() => parseManifest('files:\n  - url: a.zip\n    sha512: x\n    size: 1\n')).toThrow(/no version/);
    expect(() => parseManifest('version: 1.0.0\nfiles:\n  - sha512: x\n    size: 1\n')).toThrow(/no url/);
    expect(() => parseManifest('version: 1.0.0\nfiles:\n  - url: a.zip\n    size: 1\n')).toThrow(/no sha512/);
    expect(() => parseManifest('version: 1.0.0\nfiles:\n  - url: a.zip\n    sha512: x\n    size: 0\n')).toThrow(/size/);
    expect(() => parseManifest('- just\n- a list\n')).toThrow(/not a YAML mapping/);
  });
});

describe('verifyReleaseManifests (pre-undraft gate)', () => {
  const tag = `v${VERSION}`;

  function goodRelease() {
    const armZip = writeFixture(`assets/${appName}-darwin-arm64-${VERSION}.zip`, 'arm64 zip bytes');
    const x64Zip = writeFixture(`assets/${appName}-darwin-x64-${VERSION}.zip`, 'x64 zip bytes!');
    const setupExe = writeFixture(`assets/${appName}-${VERSION}.Setup.exe`, 'setup exe bytes');
    const deb = writeFixture(`assets/${appName.toLowerCase()}_${VERSION}_amd64.deb`, 'deb bytes');
    const arm64Entry = expectedEntry(armZip, 'arm64 zip bytes');
    const x64Entry = expectedEntry(x64Zip, 'x64 zip bytes!');
    const manifests = {
      [MAC_MANIFEST]: serializeManifest(mergeMacManifests([
        buildManifest(VERSION, [arm64Entry], RELEASE_DATE),
        buildManifest(VERSION, [x64Entry], RELEASE_DATE),
      ])),
      [WINDOWS_MANIFEST]: serializeManifest(buildManifest(VERSION, [expectedEntry(setupExe, 'setup exe bytes')], RELEASE_DATE)),
      [LINUX_MANIFEST]: serializeManifest(buildManifest(VERSION, [expectedEntry(deb, 'deb bytes')], RELEASE_DATE)),
    };
    const assets = [armZip, x64Zip, setupExe, deb].map((file) => ({ name: path.basename(file), size: fs.statSync(file).size }));
    assets.push({ name: `${appName}-${VERSION}-arm64.dmg`, size: 5 }, { name: 'RELEASES', size: 5 }, { name: MAC_MANIFEST, size: 5 });
    return { manifests, assets, downloadsDir: path.join(tmp, 'assets') };
  }

  it('passes a complete draft whose manifests match the tag, the assets and their hashes', async () => {
    const release = goodRelease();
    expect(await verifyReleaseManifests({ tag, ...release })).toEqual([]);
    expect(referencedAssetNames(Object.values(release.manifests))).toEqual([
      `${appName}-darwin-arm64-${VERSION}.zip`,
      `${appName}-darwin-x64-${VERSION}.zip`,
      `${appName}-${VERSION}.Setup.exe`,
      `${appName.toLowerCase()}_${VERSION}_amd64.deb`,
    ]);
  });

  it('fails when the tag does not match the manifest version', async () => {
    const release = goodRelease();
    const problems = await verifyReleaseManifests({ tag: 'v1.2.3', ...release });
    expect(problems).toHaveLength(3);
    expect(problems.every((problem) => /does not match tag v1\.2\.3/.test(problem))).toBe(true);
  });

  it('fails when a manifest is missing from the draft', async () => {
    const { [LINUX_MANIFEST]: _linux, ...manifests } = goodRelease().manifests;
    const problems = await verifyReleaseManifests({ tag, manifests, assets: goodRelease().assets });
    expect(problems).toEqual([`${LINUX_MANIFEST}: missing from the release`]);
  });

  it('fails when the mac manifest advertises only one arch (the v1.0.29/v1.0.10 bug)', async () => {
    const release = goodRelease();
    const armOnly = parseManifest(release.manifests[MAC_MANIFEST]);
    armOnly.files = armOnly.files.filter((file) => file.url.includes('arm64'));
    release.manifests[MAC_MANIFEST] = serializeManifest(armOnly);
    const problems = await verifyReleaseManifests({ tag, ...release });
    expect(problems).toEqual([expect.stringMatching(/latest-mac\.yml: must list one arm64 and one x64 zip/)]);
  });

  it('fails when the Windows manifest names the on-disk file instead of the GitHub asset', async () => {
    const release = goodRelease();
    release.manifests[WINDOWS_MANIFEST] = release.manifests[WINDOWS_MANIFEST].replaceAll(`${appName}-${VERSION}.Setup.exe`, `${appName}-${VERSION} Setup.exe`);
    const problems = await verifyReleaseManifests({ tag, ...release });
    expect(problems).toContain(`${WINDOWS_MANIFEST}: ${appName}-${VERSION} Setup.exe is not the name GitHub stores (${appName}-${VERSION}.Setup.exe)`);
    expect(problems).toContain(`${WINDOWS_MANIFEST}: ${appName}-${VERSION} Setup.exe is not among the release assets`);
  });

  it('fails when a referenced asset is absent or has a different size', async () => {
    const release = goodRelease();
    const assets = release.assets.filter((asset) => !asset.name.endsWith('.deb'));
    expect(await verifyReleaseManifests({ tag, manifests: release.manifests, assets })).toEqual([
      `${LINUX_MANIFEST}: ${appName.toLowerCase()}_${VERSION}_amd64.deb is not among the release assets`,
    ]);

    const resized = release.assets.map((asset) => (asset.name.endsWith('.exe') ? { ...asset, size: asset.size + 1 } : asset));
    expect(await verifyReleaseManifests({ tag, manifests: release.manifests, assets: resized })).toEqual([
      expect.stringMatching(/latest\.yml: .*Setup\.exe is \d+ bytes in the manifest but the asset is \d+ bytes/),
    ]);
  });

  it('fails when a downloaded asset does not hash to the manifest sha512', async () => {
    const release = goodRelease();
    fs.writeFileSync(path.join(release.downloadsDir, `${appName}-darwin-x64-${VERSION}.zip`), 'tampered bytes!');
    const problems = await verifyReleaseManifests({ tag, ...release });
    expect(problems).toEqual([`${MAC_MANIFEST}: ${appName}-darwin-x64-${VERSION}.zip sha512 does not match the downloaded asset`]);
  });

  it('fails when the legacy path/sha512 do not point at a listed file', async () => {
    const release = goodRelease();
    const windows = parseManifest(release.manifests[WINDOWS_MANIFEST]);
    windows.sha512 = 'somethingelse';
    release.manifests[WINDOWS_MANIFEST] = serializeManifest(windows);
    expect(await verifyReleaseManifests({ tag, ...release })).toEqual([`${WINDOWS_MANIFEST}: top-level path/sha512 do not match any files[] entry`]);
  });
});
