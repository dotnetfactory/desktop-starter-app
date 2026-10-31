/**
 * Pre-undraft gate for the release workflow's finalize job. Nothing is published until the
 * three manifests on the draft release agree with the tag and with the assets actually uploaded.
 *
 *   # names of every installer the manifests point at (to download them for hashing)
 *   npm run manifests:verify -- --tag v1.0.14 --manifests DIR --list-referenced
 *
 *   # the gate itself; exits 1 and lists every problem if the draft must stay unpublished
 *   npm run manifests:verify -- --tag v1.0.14 --manifests DIR --assets assets.json [--downloads DIR]
 *
 * DIR holds latest-mac.yml, latest.yml and latest-linux.yml as downloaded from the draft;
 * assets.json is the output of `gh release view TAG --json assets`; --downloads is a directory
 * holding the referenced installers, each of which must hash to its manifest sha512.
 */
import fs from 'fs';
import path from 'path';
import {
  RELEASE_MANIFESTS,
  ReleaseAssetLike,
  ReleaseManifestName,
  referencedAssetNames,
  verifyReleaseManifests,
} from './release-manifests';

function usage(): never {
  console.error(
    'Usage: verify-release-manifests --tag <vX.Y.Z> --manifests <dir> (--list-referenced | --assets <assets.json> [--downloads <dir>])'
  );
  process.exit(2);
}

function option(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}

function readManifests(dir: string): Partial<Record<ReleaseManifestName, string>> {
  const manifests: Partial<Record<ReleaseManifestName, string>> = {};
  for (const name of RELEASE_MANIFESTS) {
    const manifestPath = path.join(dir, name);
    if (fs.existsSync(manifestPath)) {
      manifests[name] = fs.readFileSync(manifestPath, 'utf8');
    }
  }
  return manifests;
}

async function main(argv: string[]): Promise<void> {
  const tag = option(argv, '--tag');
  const manifestsDir = option(argv, '--manifests');
  if (!tag || !manifestsDir) {
    usage();
  }
  const manifests = readManifests(manifestsDir);

  if (argv.includes('--list-referenced')) {
    for (const name of referencedAssetNames(Object.values(manifests))) {
      console.log(name);
    }
    return;
  }

  const assetsPath = option(argv, '--assets');
  if (!assetsPath) {
    usage();
  }
  const parsed = JSON.parse(fs.readFileSync(assetsPath, 'utf8')) as { assets?: ReleaseAssetLike[] } | ReleaseAssetLike[];
  const assets = Array.isArray(parsed) ? parsed : (parsed.assets ?? []);

  const problems = await verifyReleaseManifests({ tag, manifests, assets, downloadsDir: option(argv, '--downloads') });
  if (problems.length > 0) {
    console.error(`Release ${tag} must stay a draft; ${problems.length} problem(s):`);
    for (const problem of problems) {
      console.error(`  - ${problem}`);
    }
    process.exit(1);
  }
  console.log(`Release ${tag}: ${RELEASE_MANIFESTS.join(', ')} match the tag and the uploaded assets.`);
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
