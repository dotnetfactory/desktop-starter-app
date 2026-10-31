/**
 * electron-updater release metadata. Everything the updater reads is produced here:
 *
 *  - app-update.yml, packaged into Contents/Resources by the forge `packageAfterCopy` hook. It
 *    names the PUBLIC GitHub repo electron-updater polls. The file ships inside every installer,
 *    so it must never carry a credential: with `private: false` and no token electron-updater
 *    picks its anonymous GitHubProvider (releases.atom + releases/download/..., no API calls,
 *    see node_modules/electron-updater/out/providerFactory.js). A PAT embedded in this file
 *    leaked in Oct 2026, which is why this module cannot emit one.
 *  - latest-mac.yml / latest.yml / latest-linux.yml, uploaded next to the installers by
 *    `npm run publish`. Two things have to hold for the updater to find the download:
 *      1. The `url` of every entry is the EXACT name GitHub stores for the asset. GitHub rewrites
 *         names on upload (spaces become dots), so "App-1.0.0 Setup.exe" is stored as
 *         "App-1.0.0.Setup.exe"; a manifest naming the on-disk file 404s. `githubAssetName`
 *         mirrors @electron-forge/publisher-github's sanitizeName, the same rewrite.
 *      2. macOS ships one latest-mac.yml listing BOTH architectures. electron-updater's
 *         MacUpdater keeps the entry whose url contains "arm64" on Apple Silicon and the other
 *         one on Intel (node_modules/electron-updater/out/MacUpdater.js, `isArm64`). Each mac
 *         release job only knows its own arch, so it writes latest-mac-<arch>.yml and the
 *         workflow's finalize job merges them with `mergeMacManifests` before publishing.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// ---------------------------------------------------------------------------------------------
// app-update.yml
// ---------------------------------------------------------------------------------------------

export interface GithubUpdateTarget {
  owner: string;
  repo: string;
  private: boolean;
}

/**
 * Contents of app-update.yml. Fixed shape, four lines, no token. `private` is passed through
 * from app.config.ts, but a private repo cannot auto-update without a credential in the app and
 * this build never embeds one, so `private: true` is refused rather than shipped broken: keep
 * the source private if you like, publish the installers to a public `<app>-releases` repo.
 */
export function renderAppUpdateYml(target: GithubUpdateTarget): string {
  if (target.private) {
    throw new Error(
      `app.config.ts github.private is true for ${target.owner}/${target.repo}. electron-updater cannot read a private repo ` +
        'without a token and this build never embeds one (a token in app-update.yml ships in every installer). ' +
        'Publish releases to a public <app>-releases repo (see storyflow-app / nitrosocial-app) and set private: false.'
    );
  }
  return ['provider: github', `owner: ${target.owner}`, `repo: ${target.repo}`, `private: ${target.private}`, ''].join('\n');
}

// ---------------------------------------------------------------------------------------------
// Asset names
// ---------------------------------------------------------------------------------------------

/**
 * The name GitHub stores for an uploaded release asset. Copy of
 * @electron-forge/publisher-github 7.10.2 `GitHub.sanitizeName` (dist/util/github.js), which in
 * turn mirrors the gh CLI; the unit tests assert the two stay identical.
 */
export function githubAssetName(fileName: string): string {
  return (
    path
      .basename(fileName)
      // Remove diacritics (e.g. é -> e)
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      // Replace special characters with dot
      .replace(/[^\w_.@+-]+/g, '.')
      // Replace multiple dots with a single dot
      .replace(/\.+/g, '.')
      // Remove leading dot if present
      .replace(/^\./g, '')
      // Remove trailing dot if present
      .replace(/\.$/g, '')
  );
}

/** electron-updater's own test for an Apple Silicon build (MacUpdater.js `isArm64`). */
export function isArm64Asset(name: string): boolean {
  return name.includes('arm64');
}

// ---------------------------------------------------------------------------------------------
// Manifest model
// ---------------------------------------------------------------------------------------------

export interface ManifestFile {
  url: string;
  sha512: string;
  size: number;
}

export interface UpdateManifest {
  version: string;
  files: ManifestFile[];
  /** Legacy single-file fields; electron-updater prefers `files`, these mirror files[0]. */
  path: string;
  sha512: string;
  releaseDate: string;
}

export const MAC_MANIFEST = 'latest-mac.yml';
export const WINDOWS_MANIFEST = 'latest.yml';
export const LINUX_MANIFEST = 'latest-linux.yml';
/** The three files a published release must carry, one per platform. */
export const RELEASE_MANIFESTS = [MAC_MANIFEST, WINDOWS_MANIFEST, LINUX_MANIFEST] as const;
export type ReleaseManifestName = (typeof RELEASE_MANIFESTS)[number];

/** What each mac job uploads; the finalize job merges them into MAC_MANIFEST. */
export function perArchMacManifest(arch: string): string {
  return `latest-mac-${arch}.yml`;
}

export function sha512Base64(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha512');
    fs.createReadStream(filePath)
      .on('error', reject)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('base64')));
  });
}

/** Hash and measure an artifact; `url` is the name GitHub will store it under. */
export async function describeArtifact(artifactPath: string): Promise<ManifestFile> {
  const [sha512, stat] = await Promise.all([sha512Base64(artifactPath), fs.promises.stat(artifactPath)]);
  return { url: githubAssetName(artifactPath), sha512, size: stat.size };
}

export function buildManifest(version: string, files: ManifestFile[], releaseDate: string): UpdateManifest {
  if (files.length === 0) {
    throw new Error('A release manifest needs at least one file');
  }
  return { version, files, path: files[0].url, sha512: files[0].sha512, releaseDate };
}

/** Same layout electron-builder writes, so existing installs keep parsing it. */
export function serializeManifest(manifest: UpdateManifest): string {
  const lines = [`version: ${manifest.version}`, 'files:'];
  for (const file of manifest.files) {
    lines.push(`  - url: ${file.url}`, `    sha512: ${file.sha512}`, `    size: ${file.size}`);
  }
  lines.push(`path: ${manifest.path}`, `sha512: ${manifest.sha512}`, `releaseDate: '${manifest.releaseDate}'`, '');
  return lines.join('\n');
}

export function parseManifest(text: string): UpdateManifest {
  const raw = yaml.load(text);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Manifest is not a YAML mapping');
  }
  const record = raw as Record<string, unknown>;
  const version = record.version === undefined ? '' : String(record.version);
  if (!version) {
    throw new Error('Manifest has no version');
  }
  if (!Array.isArray(record.files) || record.files.length === 0) {
    throw new Error('Manifest lists no files');
  }
  const files = record.files.map((entry, index): ManifestFile => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`files[${index}] is not a mapping`);
    }
    const { url, sha512, size } = entry as Record<string, unknown>;
    if (typeof url !== 'string' || url === '') {
      throw new Error(`files[${index}] has no url`);
    }
    if (typeof sha512 !== 'string' || sha512 === '') {
      throw new Error(`files[${index}] (${url}) has no sha512`);
    }
    if (typeof size !== 'number' || !Number.isInteger(size) || size <= 0) {
      throw new Error(`files[${index}] (${url}) has no positive integer size`);
    }
    return { url, sha512, size };
  });
  return {
    version,
    files,
    path: record.path === undefined ? files[0].url : String(record.path),
    sha512: record.sha512 === undefined ? files[0].sha512 : String(record.sha512),
    releaseDate: record.releaseDate === undefined ? '' : String(record.releaseDate),
  };
}

// ---------------------------------------------------------------------------------------------
// postMake: one manifest per make result
// ---------------------------------------------------------------------------------------------

/** The artifact electron-updater downloads on each platform. */
const UPDATE_ARTIFACT_EXTENSION: Record<string, string> = {
  darwin: '.zip', // MacUpdater installs from the zip (the dmg is for humans)
  win32: '.exe', // the Squirrel Setup.exe
  linux: '.deb',
};

export function isUpdateArtifact(platform: string, artifactPath: string): boolean {
  const extension = UPDATE_ARTIFACT_EXTENSION[platform];
  return extension !== undefined && artifactPath.toLowerCase().endsWith(extension);
}

/**
 * The manifest a single make job writes for its platform/arch, or null if the platform has none.
 * Only macOS is built for two architectures, so only it gets a per-arch file (merged later);
 * Windows and Linux keep electron-updater's fixed names. A second Windows or Linux arch would
 * make two jobs write the same file, which `writeManifestsForMakeResults` refuses: give those
 * platforms per-arch names and a merge step too before adding such a matrix leg.
 */
export function manifestFileName(platform: string, arch: string): string | null {
  switch (platform) {
    case 'darwin':
      return perArchMacManifest(arch);
    case 'win32':
      return WINDOWS_MANIFEST;
    case 'linux':
      return LINUX_MANIFEST;
    default:
      return null;
  }
}

/** The subset of Forge's ForgeMakeResult this module needs. */
export interface MakeResultLike {
  platform: string;
  arch: string;
  artifacts: string[];
}

/**
 * Write the manifest for every make result that produced an update artifact and append it to
 * that result's artifacts so the publisher uploads it. Returns the written paths.
 */
export async function writeManifestsForMakeResults(
  results: MakeResultLike[],
  version: string,
  releaseDate: string = new Date().toISOString()
): Promise<string[]> {
  const written: string[] = [];
  const writtenBy = new Map<string, string>();
  for (const result of results) {
    const updateArtifacts = result.artifacts.filter((artifact) => isUpdateArtifact(result.platform, artifact));
    if (updateArtifacts.length === 0) {
      continue;
    }
    const fileName = manifestFileName(result.platform, result.arch);
    if (!fileName) {
      continue;
    }
    const previous = writtenBy.get(fileName);
    if (previous) {
      throw new Error(
        `Two make results would both write ${fileName} (${previous} and ${updateArtifacts[0]}); electron-updater can only use one`
      );
    }
    const files = await Promise.all(updateArtifacts.map((artifact) => describeArtifact(artifact)));
    const manifest = buildManifest(version, files, releaseDate);
    const manifestPath = path.join(path.dirname(updateArtifacts[0]), fileName);
    await fs.promises.writeFile(manifestPath, serializeManifest(manifest));
    result.artifacts.push(manifestPath);
    writtenBy.set(fileName, updateArtifacts[0]);
    written.push(manifestPath);
  }
  return written;
}

// ---------------------------------------------------------------------------------------------
// finalize: merge the two macOS manifests
// ---------------------------------------------------------------------------------------------

/**
 * Combine the per-arch mac manifests into the single latest-mac.yml electron-updater fetches.
 * Exactly one arm64 and one x64 zip must be present; the arm64 entry fills the legacy
 * path/sha512 fields.
 */
export function mergeMacManifests(manifests: UpdateManifest[]): UpdateManifest {
  if (manifests.length < 2) {
    throw new Error(`Need the arm64 and x64 macOS manifests, got ${manifests.length}`);
  }
  const versions = [...new Set(manifests.map((manifest) => manifest.version))];
  if (versions.length !== 1) {
    throw new Error(`macOS manifests disagree on the version: ${versions.join(', ')}`);
  }
  const files = manifests.flatMap((manifest) => manifest.files);
  const arm64 = files.filter((file) => isArm64Asset(file.url));
  const x64 = files.filter((file) => !isArm64Asset(file.url));
  if (arm64.length !== 1 || x64.length !== 1) {
    const list = (entries: ManifestFile[]) => entries.map((file) => file.url).join(', ') || 'none';
    throw new Error(`Expected exactly one arm64 and one x64 zip; arm64: ${list(arm64)}; x64: ${list(x64)}`);
  }
  const releaseDate =
    manifests
      .map((manifest) => manifest.releaseDate)
      .filter(Boolean)
      .sort()
      .at(-1) ?? new Date().toISOString();
  return { version: versions[0], files: [arm64[0], x64[0]], path: arm64[0].url, sha512: arm64[0].sha512, releaseDate };
}

// ---------------------------------------------------------------------------------------------
// finalize: pre-undraft gate
// ---------------------------------------------------------------------------------------------

export interface ReleaseAssetLike {
  name: string;
  size: number;
}

export interface VerifyReleaseInput {
  /** The git tag, e.g. v1.0.14; manifests must carry 1.0.14. */
  tag: string;
  /** Manifest text keyed by file name; a missing entry is a failure. */
  manifests: Partial<Record<ReleaseManifestName, string>>;
  /** The draft release's assets (name and size). */
  assets: ReleaseAssetLike[];
  /** When set, every referenced file must exist here and hash to its manifest sha512. */
  downloadsDir?: string;
}

const MANIFEST_EXTENSION: Record<ReleaseManifestName, string> = {
  [MAC_MANIFEST]: '.zip',
  [WINDOWS_MANIFEST]: '.exe',
  [LINUX_MANIFEST]: '.deb',
};

/** Every asset name the manifests point at (deduplicated, in manifest order). */
export function referencedAssetNames(manifestTexts: string[]): string[] {
  const names = new Set<string>();
  for (const text of manifestTexts) {
    for (const file of parseManifest(text).files) {
      names.add(file.url);
    }
  }
  return [...names];
}

/**
 * Check a draft release's manifests against its assets before it is published. Returns the
 * list of problems; an empty list means the release may be undrafted.
 */
export async function verifyReleaseManifests(input: VerifyReleaseInput): Promise<string[]> {
  const problems: string[] = [];
  const expectedVersion = input.tag.replace(/^v/, '');
  const assetsByName = new Map(input.assets.map((asset) => [asset.name, asset]));

  for (const name of RELEASE_MANIFESTS) {
    const text = input.manifests[name];
    if (text === undefined) {
      problems.push(`${name}: missing from the release`);
      continue;
    }
    let manifest: UpdateManifest;
    try {
      manifest = parseManifest(text);
    } catch (error) {
      problems.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (manifest.version !== expectedVersion) {
      problems.push(`${name}: version ${manifest.version} does not match tag ${input.tag}`);
    }
    if (name === MAC_MANIFEST) {
      const arm64Count = manifest.files.filter((file) => isArm64Asset(file.url)).length;
      const x64Count = manifest.files.length - arm64Count;
      if (arm64Count !== 1 || x64Count !== 1) {
        problems.push(
          `${name}: must list one arm64 and one x64 zip, lists ${manifest.files.map((file) => file.url).join(', ')}`
        );
      }
    }
    if (!manifest.files.some((file) => file.url === manifest.path && file.sha512 === manifest.sha512)) {
      problems.push(`${name}: top-level path/sha512 do not match any files[] entry`);
    }
    for (const file of manifest.files) {
      if (!file.url.toLowerCase().endsWith(MANIFEST_EXTENSION[name])) {
        problems.push(`${name}: ${file.url} is not a ${MANIFEST_EXTENSION[name]} file`);
      }
      if (file.url !== githubAssetName(file.url)) {
        problems.push(`${name}: ${file.url} is not the name GitHub stores (${githubAssetName(file.url)})`);
      }
      const asset = assetsByName.get(file.url);
      if (!asset) {
        problems.push(`${name}: ${file.url} is not among the release assets`);
        continue;
      }
      if (asset.size !== file.size) {
        problems.push(`${name}: ${file.url} is ${file.size} bytes in the manifest but the asset is ${asset.size} bytes`);
      }
      if (input.downloadsDir) {
        const localPath = path.join(input.downloadsDir, file.url);
        if (!fs.existsSync(localPath)) {
          problems.push(`${name}: ${file.url} was not downloaded, cannot verify its sha512`);
          continue;
        }
        const actual = await sha512Base64(localPath);
        if (actual !== file.sha512) {
          problems.push(`${name}: ${file.url} sha512 does not match the downloaded asset`);
        }
      }
    }
  }
  return problems;
}
