/** Limit a matrix build to its selected architecture before electron-builder loads targets. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function createReleaseBuilderConfig(packageMetadata, platform, arch) {
  const platformKey = platform === 'windows' ? 'win' : platform;
  const allowed = { win: ['x64', 'ia32', 'arm64'], mac: ['x64', 'arm64'], linux: ['x64', 'arm64'] };
  if (!allowed[platformKey]?.includes(arch)) throw new Error('Unsupported release platform or architecture');
  const configuration = structuredClone(packageMetadata.build);
  if (!configuration || !configuration[platformKey]?.target) throw new Error('Build targets are missing');
  const targetEntries = Array.isArray(configuration[platformKey].target) ? configuration[platformKey].target : [configuration[platformKey].target];
  // CLI architecture flags alone are combined with every architecture in target.arch.
  configuration[platformKey].target = targetEntries.map((entry) => ({
    ...(typeof entry === 'string' ? { target: entry } : entry),
    arch: [arch]
  }));
  configuration.extends = null;
  configuration.directories = { ...configuration.directories, output: `dist/${platform}-${arch}` };
  return configuration;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [platform, arch, output] = process.argv.slice(2);
  if (!output || process.argv.length !== 5) throw new Error('Usage: release-builder-config.mjs platform architecture output.json');
  const metadata = JSON.parse(await readFile('package.json', 'utf8'));
  const configuration = createReleaseBuilderConfig(metadata, platform, arch);
  await mkdir(dirname(resolve(output)), { recursive: true });
  await writeFile(output, `${JSON.stringify(configuration, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ platform, arch, output: configuration.directories.output, targets: configuration[platform === 'windows' ? 'win' : platform].target.map((entry) => entry.target) }));
}
