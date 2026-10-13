/** Profile-selection regression using virtual directories; never reads account files. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));
const { transform } = createRequire(require.resolve('vite'))('esbuild');
const { code } = await transform(await readFile(join(root, 'src/main/appIdentity.ts'), 'utf8'), {
  loader: 'ts',
  format: 'cjs',
  target: 'node20'
});

function runIdentity(entries = {}) {
  const appData = join('virtual-profile-root', 'app-data');
  const directories = new Map(
    Object.entries(entries).map(([name, type]) => [join(appData, name), type])
  );
  const calls = [];
  const created = [];
  let selected;
  const app = {
    setName(name) {
      calls.push(['name', name]);
    },
    getPath(name) {
      assert.equal(name, 'appData');
      calls.push(['getPath', name]);
      return appData;
    },
    setPath(name, value) {
      assert.equal(name, 'userData');
      assert.equal(directories.get(value), 'directory');
      calls.push(['path', value]);
      selected = value;
    }
  };
  const virtualFs = {
    existsSync(value) {
      return directories.has(value);
    },
    statSync(value) {
      return { isDirectory: () => directories.get(value) === 'directory' };
    },
    mkdirSync(value, options) {
      assert.equal(options.recursive, true);
      created.push(value);
      directories.set(value, 'directory');
    }
  };
  runInNewContext(code, {
    require(id) {
      if (id === 'electron') return { app };
      if (id === 'node:fs') return virtualFs;
      if (id === 'node:path') return { join };
      throw new Error(`Unexpected dependency: ${id}`);
    },
    exports: {},
    module: { exports: {} }
  });
  assert.deepEqual(calls.slice(0, 2), [
    ['name', 'Almusic'],
    ['getPath', 'appData']
  ]);
  return { appData, selected, created };
}

test('existing Almusic profile takes precedence without copying or creating data', () => {
  const result = runIdentity({ Almusic: 'directory', ZephyrusPlayer: 'directory' });
  assert.equal(result.selected, join(result.appData, 'Almusic'));
  assert.deepEqual(result.created, []);
});

test('rename reuses an existing legacy profile without creating a separate empty profile', () => {
  const result = runIdentity({ ZephyrusPlayer: 'directory' });
  assert.equal(result.selected, join(result.appData, 'ZephyrusPlayer'));
  assert.deepEqual(result.created, []);
});

test('fresh install creates the Almusic directory before selecting userData', () => {
  const result = runIdentity();
  assert.equal(result.selected, join(result.appData, 'Almusic'));
  assert.deepEqual(result.created, [result.selected]);
});

test('a file named Almusic is not mistaken for a usable profile directory', () => {
  const result = runIdentity({ Almusic: 'file', ZephyrusPlayer: 'directory' });
  assert.equal(result.selected, join(result.appData, 'ZephyrusPlayer'));
  assert.deepEqual(result.created, []);
});
