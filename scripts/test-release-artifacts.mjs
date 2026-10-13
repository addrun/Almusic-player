import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { collect, identify, parseUpdateInfo, stage, targets } from './release-artifacts.mjs';

const version = '0.1.2';
const tag = `v${version}`;
const commit = 'a'.repeat(40);
const sha512 = (bytes) => createHash('sha512').update(bytes).digest('base64');
const require = createRequire(new URL('../package.json', import.meta.url));
const builderRequire = createRequire(require.resolve('electron-builder'));
const appBuilderRequire = createRequire(builderRequire.resolve('app-builder-lib'));
const { Arch } = appBuilderRequire('builder-util');
// Initialize the public entrypoint before loading its internal packager (circular exports).
appBuilderRequire('./index');
const { PlatformPackager } = appBuilderRequire('./platformPackager');
const { expandMacro } = appBuilderRequire('./util/macroExpander');

function builderFilename(platform, arch, ext) {
  const key = platform === 'windows' ? 'win' : platform;
  const packager = {
    expandMacro(pattern, selectedArch, extra) {
      return expandMacro(pattern, selectedArch, { productName: 'Almusic', version }, { os: key, ...extra });
    }
  };
  // FpmTarget.build and AppImageTarget.build both use this exact filename expansion.
  return PlatformPackager.prototype.computeArtifactName.call(packager, `Almusic-\${version}-${key}-\${arch}.\${ext}`, ext, Arch[arch]);
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'almusic-release-assets-'));
  const bundle = join(root, 'bundle');
  await mkdir(bundle);
  for (const [platform, arch] of targets) {
    const source = join(root, `${platform}-${arch}`);
    await mkdir(source);
    const extensions = platform === 'windows' ? ['exe'] : platform === 'mac' ? ['dmg', 'zip'] : ['AppImage', 'deb', 'rpm'];
    const files = [];
    for (const ext of extensions) {
      const url = builderFilename(platform, arch, ext);
      const bytes = Buffer.from(`installer-fixture:${url}`);
      await writeFile(join(source, url), bytes);
      files.push({ url, sha512: sha512(bytes), size: bytes.length });
    }
    const channel = platform === 'windows' ? 'latest.yml' : platform === 'mac' ? 'latest-mac.yml' : `latest-linux${arch === 'x64' ? '' : '-arm64'}.yml`;
    // Linux AppImage, DEB and RPM all contribute metadata; the primary file may be RPM.
    const primary = platform === 'linux' ? files.at(-1) : files[0];
    await writeFile(join(source, channel), JSON.stringify({ version, files, path: primary.url, sha512: primary.sha512, releaseDate: '2026-10-14T00:00:00.000Z' }));
    await writeFile(join(source, 'builder-debug.yml'), 'private-directory-fixture');
    await stage({ platform, arch, version, tag, commit, source, out: bundle });
  }
  return { root, bundle, out: join(root, 'release') };
}

test('builder YAML parser preserves checksums and block map sizes', () => {
  assert.deepEqual(parseUpdateInfo("version: 0.1.2\nfiles:\n  - url: Almusic-0.1.2-win-x64.exe\n    sha512: abc=\n    size: 42\n    blockMapSize: 2\npath: Almusic-0.1.2-win-x64.exe\nsha512: abc=\nreleaseDate: '2026-10-14T00:00:00.000Z'\n"), {
    version, files: [{ url: 'Almusic-0.1.2-win-x64.exe', sha512: 'abc=', size: 42, blockMapSize: 2 }], path: 'Almusic-0.1.2-win-x64.exe', sha512: 'abc=', releaseDate: '2026-10-14T00:00:00.000Z'
  });
});

test('installer allowlist matches actual electron-builder architecture filename expansion', () => {
  for (const [platform, arch] of targets) {
    const extensions = platform === 'windows' ? ['exe'] : platform === 'mac' ? ['dmg', 'zip'] : ['AppImage', 'deb', 'rpm'];
    assert.deepEqual(identify(platform, arch, version).installers, extensions.map((ext) => builderFilename(platform, arch, ext)));
  }
  assert.deepEqual(identify('linux', 'x64', version).installers, [
    `Almusic-${version}-linux-x86_64.AppImage`, `Almusic-${version}-linux-amd64.deb`, `Almusic-${version}-linux-x86_64.rpm`
  ]);
  assert.deepEqual(identify('linux', 'arm64', version).installers, [
    `Almusic-${version}-linux-arm64.AppImage`, `Almusic-${version}-linux-arm64.deb`, `Almusic-${version}-linux-aarch64.rpm`
  ]);
});

test('seven builds merge architecture update lists without publishing debug files', async () => {
  const item = await fixture();
  try {
    const result = await collect({ version, tag, commit, source: item.bundle, out: item.out });
    assert.equal(result.asset_count, 19);
    const windows = JSON.parse(await readFile(join(item.out, 'latest.yml'), 'utf8'));
    const mac = JSON.parse(await readFile(join(item.out, 'latest-mac.yml'), 'utf8'));
    assert.equal(windows.files.length, 3);
    assert.equal(mac.files.length, 4);
    const linuxX64 = JSON.parse(await readFile(join(item.out, 'latest-linux.yml'), 'utf8'));
    const linuxArm64 = JSON.parse(await readFile(join(item.out, 'latest-linux-arm64.yml'), 'utf8'));
    assert.equal(linuxX64.files.length, 3);
    assert.equal(linuxArm64.files.length, 3);
    assert.equal(linuxX64.path, `Almusic-${version}-linux-x86_64.rpm`);
    assert.equal(linuxArm64.path, `Almusic-${version}-linux-aarch64.rpm`);
    const manifest = JSON.parse(await readFile(join(item.out, 'RELEASE-MANIFEST.json'), 'utf8'));
    assert.equal(manifest.source_commit, commit);
    assert.equal(manifest.targets.length, 7);
    assert.ok(manifest.files.every((file) => !file.name.includes('debug')));
  } finally { await rm(item.root, { recursive: true, force: true }); }
});

test('changed artifact bytes cannot be published', async () => {
  const item = await fixture();
  try {
    await writeFile(join(item.bundle, `Almusic-${version}-win-x64.exe`), 'tampered');
    await assert.rejects(collect({ version, tag, commit, source: item.bundle, out: item.out }), /checksum mismatch/);
  } finally { await rm(item.root, { recursive: true, force: true }); }
});

test('unknown files and mismatched source commit fail closed', async () => {
  const item = await fixture();
  try {
    await assert.rejects(collect({ version, tag, commit: 'b'.repeat(40), source: item.bundle, out: item.out }), /sources do not match/);
    await writeFile(join(item.bundle, 'account-fixture.txt'), 'not-to-publish');
    await assert.rejects(collect({ version, tag, commit, source: item.bundle, out: item.out }), /Unexpected file/);
  } finally { await rm(item.root, { recursive: true, force: true }); }
});
