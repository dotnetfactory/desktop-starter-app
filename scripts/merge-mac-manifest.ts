/**
 * Merge the per-arch macOS manifests the release jobs uploaded into the single latest-mac.yml
 * electron-updater fetches. Run by the release workflow's finalize job:
 *
 *   npm run manifests:merge-mac -- --out latest-mac.yml latest-mac-arm64.yml latest-mac-x64.yml
 */
import fs from 'fs';
import { mergeMacManifests, parseManifest, serializeManifest } from './release-manifests';

function usage(): never {
  console.error('Usage: merge-mac-manifest --out <latest-mac.yml> <latest-mac-arm64.yml> <latest-mac-x64.yml>');
  process.exit(2);
}

function main(argv: string[]): void {
  const outIndex = argv.indexOf('--out');
  const outPath = outIndex === -1 ? undefined : argv[outIndex + 1];
  if (!outPath) {
    usage();
  }
  const inputs = argv.filter((_, index) => index !== outIndex && index !== outIndex + 1);
  if (inputs.length < 2) {
    usage();
  }
  const merged = mergeMacManifests(inputs.map((inputPath) => parseManifest(fs.readFileSync(inputPath, 'utf8'))));
  fs.writeFileSync(outPath, serializeManifest(merged));
  console.log(`Wrote ${outPath} (${merged.version}): ${merged.files.map((file) => file.url).join(', ')}`);
}

main(process.argv.slice(2));
