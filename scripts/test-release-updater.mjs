/** Verify architecture selection using the exact updater resolved by npm ci. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const require = createRequire(new URL('../package.json', import.meta.url));
const metadata = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
const updaterVersion = require('electron-updater/package.json').version;
const { findFile, parseUpdateInfo, resolveFiles, Provider } = require('electron-updater/out/providers/Provider');
const baseUrl = new URL(`https://example.invalid/releases/${metadata.version}/`);

function selectedFiles(platform) {
  const architectures = platform === 'win' ? ['x64', 'ia32', 'arm64'] : ['x64', 'arm64'];
  const extension = platform === 'win' ? 'exe' : 'zip';
  const files = architectures.map((arch) => ({ url: `Almusic-${metadata.version}-${platform}-${arch}.${extension}`, sha512: 'synthetic-fixture-checksum', size: 1 }));
  // The collector writes JSON documents as .yml; the updater must parse that output.
  const raw = JSON.stringify({ version: metadata.version, files, path: files[0].url, sha512: files[0].sha512, releaseDate: '2026-10-14T00:00:00.000Z' });
  return resolveFiles(parseUpdateInfo(raw, 'fixture.yml', `${baseUrl}fixture.yml`), baseUrl);
}

function withArchitecture(arch, callback) {
  const descriptor = Object.getOwnPropertyDescriptor(process, 'arch');
  Object.defineProperty(process, 'arch', { ...descriptor, value: arch });
  try { return callback(); }
  finally { Object.defineProperty(process, 'arch', descriptor); }
}

test('installed updater matches the committed dependency lock', () => {
  assert.equal(updaterVersion, lock.packages['node_modules/electron-updater'].version);
});

for (const arch of ['x64', 'ia32', 'arm64']) {
  test(`merged Windows update metadata selects ${arch} installer`, () => withArchitecture(arch, () => {
    const selected = findFile(selectedFiles('win'), 'exe');
    assert.equal(selected.url.pathname.split('/').at(-1), `Almusic-${metadata.version}-win-${arch}.exe`);
    const provider = new Provider({ platform: 'win32', executor: null });
    assert.equal(provider.getDefaultChannelName(), 'latest');
  }));
}

for (const arch of ['x64', 'arm64']) {
  test(`merged macOS update metadata selects ${arch} ZIP`, () => withArchitecture(arch, () => {
    const selected = findFile(selectedFiles('mac'), 'zip');
    assert.equal(selected.url.pathname.split('/').at(-1), `Almusic-${metadata.version}-mac-${arch}.zip`);
  }));
  test(`Linux ${arch} updater requests its own metadata channel`, () => withArchitecture(arch, () => {
    const provider = new Provider({ platform: 'linux', executor: null });
    assert.equal(provider.getDefaultChannelName(), arch === 'x64' ? 'latest-linux' : 'latest-linux-arm64');
  }));
}
