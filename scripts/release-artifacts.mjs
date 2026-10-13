/** Stage only release assets, then combine verified architecture-specific builds. */
import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const targets = [
  ['windows', 'x64'], ['windows', 'ia32'], ['windows', 'arm64'],
  ['mac', 'x64'], ['mac', 'arm64'], ['linux', 'x64'], ['linux', 'arm64']
];
const digest = (data, algorithm = 'sha256') => createHash(algorithm).update(data).digest(algorithm === 'sha512' ? 'base64' : 'hex');
const scalar = (value) => {
  const text = value.trim();
  if (text.startsWith('"')) return JSON.parse(text);
  return text.startsWith("'") && text.endsWith("'") ? text.slice(1, -1).replaceAll("''", "'") : text;
};

export function parseUpdateInfo(text) {
  if (text.trimStart().startsWith('{')) return JSON.parse(text);
  const result = { files: [] };
  let file;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    let match;
    if (line === 'files:') continue;
    if ((match = line.match(/^  - url: (.+)$/))) {
      file = { url: scalar(match[1]) };
      result.files.push(file);
    } else if ((match = line.match(/^    (sha512|size|blockMapSize): (.+)$/)) && file) {
      file[match[1]] = match[1] === 'sha512' ? scalar(match[2]) : Number(match[2]);
    } else if ((match = line.match(/^(version|path|sha512|releaseDate): (.+)$/))) {
      result[match[1]] = scalar(match[2]);
    } else throw new Error('Unsupported update metadata field');
  }
  return result;
}

function identify(platform, arch, version) {
  if (!targets.some(([p, a]) => p === platform && a === arch)) throw new Error('Unsupported build target');
  const prefix = `Almusic-${version}-${platform === 'windows' ? 'win' : platform}-${arch}`;
  const extensions = platform === 'windows' ? ['exe'] : platform === 'mac' ? ['dmg', 'zip'] : ['AppImage', 'deb', 'rpm'];
  const installers = extensions.map((ext) => `${prefix}.${ext}`);
  const channel = platform === 'windows' ? 'latest.yml' : platform === 'mac' ? 'latest-mac.yml' : `latest-linux${arch === 'x64' ? '' : '-arm64'}.yml`;
  const stagedChannel = platform === 'windows' ? `latest-win-${arch}.yml` : platform === 'mac' ? `latest-mac-${arch}.yml` : channel;
  return { installers, channel, stagedChannel, id: `${platform}-${arch}` };
}

function validateSource(version, tag, commit) {
  if (!/^\d+\.\d+\.\d+$/.test(version) || tag !== `v${version}`) throw new Error('Release tag does not match package version');
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid release source commit');
}

async function regularFile(path) {
  const entry = await lstat(path);
  if (!entry.isFile() || entry.isSymbolicLink()) throw new Error('Release assets must be regular files');
  return readFile(path);
}

function validateMetadata(metadata, version, assets, installers) {
  if (metadata.version !== version || !Array.isArray(metadata.files) || metadata.files.length === 0) throw new Error('Update metadata version or files invalid');
  const files = metadata.files.map((file) => {
    if (!installers.includes(file.url) || basename(file.url) !== file.url) throw new Error('Unexpected file in update metadata');
    const bytes = assets.get(file.url);
    if (!bytes || digest(bytes, 'sha512') !== file.sha512 || bytes.length !== file.size) throw new Error('Update metadata checksum or size mismatch');
    const item = { url: file.url, sha512: file.sha512, size: file.size };
    if (file.blockMapSize !== undefined) {
      if (!Number.isSafeInteger(file.blockMapSize) || file.blockMapSize < 0) throw new Error('Invalid blockmap size');
      item.blockMapSize = file.blockMapSize;
    }
    return item;
  });
  const primary = files.find((file) => file.url === metadata.path);
  if (!primary || primary.sha512 !== metadata.sha512) throw new Error('Update metadata primary file invalid');
  if (typeof metadata.releaseDate !== 'string' || !Number.isFinite(Date.parse(metadata.releaseDate))) throw new Error('Update metadata release date invalid');
  return { version, files, path: primary.url, sha512: primary.sha512, releaseDate: metadata.releaseDate };
}

async function saveJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function stage({ platform, arch, version, tag, commit, source, out }) {
  validateSource(version, tag, commit);
  const spec = identify(platform, arch, version);
  const entries = await readdir(source);
  const assets = new Map();
  for (const name of spec.installers) {
    assets.set(name, await regularFile(join(source, name)));
    if (entries.includes(`${name}.blockmap`)) assets.set(`${name}.blockmap`, await regularFile(join(source, `${name}.blockmap`)));
  }
  const metadata = validateMetadata(parseUpdateInfo((await regularFile(join(source, spec.channel))).toString('utf8')), version, assets, spec.installers);
  if (platform === 'mac' && !metadata.files.some((file) => file.url.endsWith('.zip'))) throw new Error('macOS update ZIP is missing');
  await mkdir(out, { recursive: true });
  for (const name of assets.keys()) await copyFile(join(source, name), join(out, name));
  await saveJson(join(out, spec.stagedChannel), metadata);
  const files = [];
  for (const name of [...assets.keys(), spec.stagedChannel].sort()) {
    const bytes = await regularFile(join(out, name));
    files.push({ name, size: bytes.length, sha256: digest(bytes) });
  }
  await saveJson(join(out, `build-${spec.id}.json`), { version, source_tag: tag, source_commit: commit, platform, arch, files });
  await writeFile(join(out, `SHA256SUMS-${spec.id}.txt`), files.map((file) => `${file.sha256}  ${file.name}`).join('\n') + '\n', 'utf8');
  return { target: spec.id, asset_count: assets.size, source_commit: commit };
}

async function listFiles(root) {
  const files = new Map();
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Artifact contains a symbolic link');
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) {
        if (files.has(entry.name)) throw new Error('Duplicate artifact filename');
        files.set(entry.name, path);
      } else throw new Error('Unexpected artifact entry');
    }
  }
  await visit(root);
  return files;
}

export async function collect({ version, tag, commit, source, out }) {
  validateSource(version, tag, commit);
  const paths = await listFiles(source);
  const accepted = new Set();
  const assets = new Map();
  const channels = new Map();
  for (const [platform, arch] of targets) {
    const spec = identify(platform, arch, version);
    const manifestName = `build-${spec.id}.json`;
    const manifest = JSON.parse((await regularFile(paths.get(manifestName) ?? join(source, manifestName))).toString('utf8'));
    if (manifest.version !== version || manifest.source_tag !== tag || manifest.source_commit !== commit || manifest.platform !== platform || manifest.arch !== arch) throw new Error('Build sources do not match the release tag');
    const permitted = new Set([...spec.installers, ...spec.installers.map((name) => `${name}.blockmap`), spec.stagedChannel]);
    const buildAssets = new Map();
    const declared = new Set();
    for (const file of manifest.files) {
      if (!permitted.has(file.name) || declared.has(file.name)) throw new Error('Unexpected or duplicate declared asset');
      const bytes = await regularFile(paths.get(file.name) ?? join(source, file.name));
      if (bytes.length !== file.size || digest(bytes) !== file.sha256) throw new Error('Staged artifact checksum mismatch');
      declared.add(file.name);
      accepted.add(file.name);
      buildAssets.set(file.name, bytes);
      if (file.name !== spec.stagedChannel) assets.set(file.name, bytes);
    }
    for (const name of [...spec.installers, spec.stagedChannel]) if (!declared.has(name)) throw new Error('Required release asset missing');
    const metadata = validateMetadata(parseUpdateInfo(buildAssets.get(spec.stagedChannel).toString('utf8')), version, buildAssets, spec.installers);
    const channelName = platform === 'linux' ? spec.channel : platform === 'windows' ? 'latest.yml' : 'latest-mac.yml';
    const previous = channels.get(channelName);
    channels.set(channelName, previous ? { ...previous, files: [...previous.files, ...metadata.files] } : metadata);
    accepted.add(manifestName);
    const sumName = `SHA256SUMS-${spec.id}.txt`;
    const sum = (await regularFile(paths.get(sumName) ?? join(source, sumName))).toString('utf8');
    if (sum !== [...manifest.files].sort((a, b) => a.name.localeCompare(b.name, 'en')).map((file) => `${file.sha256}  ${file.name}`).join('\n') + '\n') {
      // Stage uses Unicode lexical order; compare a set to avoid locale-specific ordering.
      if (new Set(sum.trimEnd().split('\n')).size !== manifest.files.length || manifest.files.some((file) => !sum.split('\n').includes(`${file.sha256}  ${file.name}`))) throw new Error('Architecture checksum list mismatch');
    }
    accepted.add(sumName);
  }
  for (const name of paths.keys()) if (!accepted.has(name)) throw new Error('Unexpected file in release artifact bundle');
  await mkdir(out, { recursive: true });
  for (const [name, bytes] of assets) await writeFile(join(out, name), bytes);
  for (const [name, metadata] of channels) await saveJson(join(out, name), metadata);
  const publicFiles = [];
  for (const name of [...assets.keys(), ...channels.keys()].sort()) {
    const bytes = await regularFile(join(out, name));
    publicFiles.push({ name, size: bytes.length, sha256: digest(bytes) });
  }
  await saveJson(join(out, 'RELEASE-MANIFEST.json'), { version, source_tag: tag, source_commit: commit, targets: targets.map(([platform, arch]) => ({ platform, arch })), files: publicFiles });
  const manifestBytes = await regularFile(join(out, 'RELEASE-MANIFEST.json'));
  await writeFile(join(out, 'SHA256SUMS.txt'), [...publicFiles, { name: 'RELEASE-MANIFEST.json', sha256: digest(manifestBytes) }].map((file) => `${file.sha256}  ${file.name}`).join('\n') + '\n', 'utf8');
  return { version, source_commit: commit, asset_count: publicFiles.length + 2 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, ...args] = process.argv.slice(2);
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    if (!args[index]?.startsWith('--') || !args[index + 1]) throw new Error('Expected --option value');
    options[args[index].slice(2)] = args[index + 1];
  }
  options.version ??= JSON.parse(await readFile('package.json', 'utf8')).version;
  if (!['stage', 'collect'].includes(mode)) throw new Error('Usage: release-artifacts.mjs stage|collect --source directory --out directory --tag vX.Y.Z --commit SHA [--platform platform --arch architecture]');
  console.log(JSON.stringify(await (mode === 'stage' ? stage(options) : collect(options))));
}
