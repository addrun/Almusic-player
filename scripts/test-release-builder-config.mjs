import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createReleaseBuilderConfig } from './release-builder-config.mjs';

const metadata = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const require = createRequire(new URL('../package.json', import.meta.url));
const builderRequire = createRequire(require.resolve('electron-builder'));
const appBuilderRequire = createRequire(builderRequire.resolve('app-builder-lib'));
const { Arch } = appBuilderRequire('builder-util');
const { Platform } = appBuilderRequire('./core');
const { computeArchToTargetNamesMap } = appBuilderRequire('./targets/targetFactory');

function effectiveTargets(config, platform, arch) {
  const key = platform === 'windows' ? 'win' : platform;
  const electronPlatform = key === 'win' ? Platform.WINDOWS : key === 'mac' ? Platform.MAC : Platform.LINUX;
  return computeArchToTargetNamesMap(new Map([[Arch[arch], []]]), { platformSpecificBuildOptions: config[key] }, electronPlatform);
}

test('builder reproduces the original CLI architecture expansion', () => {
  assert.equal(effectiveTargets(metadata.build, 'windows', 'arm64').size, 3);
  assert.equal(effectiveTargets(metadata.build, 'linux', 'arm64').size, 2);
});

for (const [platform, arches] of Object.entries({ windows: ['x64', 'ia32', 'arm64'], mac: ['x64', 'arm64'], linux: ['x64', 'arm64'] })) {
  for (const arch of arches) test(`matrix ${platform} ${arch} resolves exactly one target architecture`, () => {
    const before = JSON.stringify(metadata);
    const config = createReleaseBuilderConfig(metadata, platform, arch);
    const effective = effectiveTargets(config, platform, arch);
    assert.deepEqual([...effective.keys()], [Arch[arch]]);
    assert.ok(effective.get(Arch[arch]).length > 0);
    assert.equal(config.directories.output, `dist/${platform}-${arch}`);
    assert.equal(config.extends, null);
    assert.deepEqual(config.files, metadata.build.files);
    assert.deepEqual(config.publish, metadata.build.publish);
    assert.equal(JSON.stringify(metadata), before);
  });
}

test('invalid targets cannot produce a release configuration', () => {
  assert.throws(() => createReleaseBuilderConfig(metadata, 'linux', 'ia32'), /Unsupported/);
  assert.throws(() => createReleaseBuilderConfig(metadata, 'mac', 'universal'), /Unsupported/);
});
