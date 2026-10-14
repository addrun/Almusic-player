/** Verify the Windows taskbar/tray identity without launching Electron or reading user data. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));
const typescript = require('typescript');

const helperSource = await readFile(join(root, 'src/main/modules/taskbarIdentity.ts'), 'utf8');
const helperCode = typescript.transpileModule(helperSource, {
  compilerOptions: {
    module: typescript.ModuleKind.CommonJS,
    target: typescript.ScriptTarget.ES2022
  }
}).outputText;

function loadHelper(iconExists) {
  const exports = {};
  const module = { exports };
  runInNewContext(helperCode, {
    exports,
    module,
    require(id) {
      if (id === 'node:fs') return { existsSync: () => iconExists };
      if (id === 'node:path') return require('node:path');
      throw new Error(`Unexpected dependency: ${id}`);
    }
  });
  return module.exports;
}

test('Windows helper sets the stable app identity and external ICO path', () => {
  const helper = loadHelper(true);
  const calls = [];
  const resources = join('virtual', '音乐 player', 'resources');
  const executable = join('virtual', '音乐 player', 'Almusic.exe');
  helper.applyTaskbarIdentity(
    { setAppDetails: (details) => calls.push(details) },
    'win32',
    executable,
    resources
  );
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    {
      appId: 'com.almusic.player',
      appIconPath: join(resources, 'app-icon-light-v2.ico'),
      appIconIndex: 0,
      relaunchCommand: `"${executable}"`,
      relaunchDisplayName: 'Almusic'
    }
  ]);
});

test('missing external ICO safely falls back to the executable', () => {
  const helper = loadHelper(false);
  const calls = [];
  const executable = join('virtual', 'Almusic.exe');
  helper.applyTaskbarIdentity(
    { setAppDetails: (details) => calls.push(details) },
    'win32',
    executable,
    'virtual'
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].appIconPath, executable);
  assert.equal(calls[0].appId, 'com.almusic.player');
});

test('non-Windows leaves BrowserWindow app details untouched', () => {
  const helper = loadHelper(true);
  let called = false;
  helper.applyTaskbarIdentity(
    {
      setAppDetails: () => {
        called = true;
      }
    },
    'linux',
    'virtual/Almusic',
    'virtual'
  );
  assert.equal(called, false);
});

test('runtime sources use the same identity and packaged ICO path', async () => {
  const index = await readFile(join(root, 'src/main/index.ts'), 'utf8');
  const window = await readFile(join(root, 'src/main/modules/window.ts'), 'utf8');
  const tray = await readFile(join(root, 'src/main/modules/tray.ts'), 'utf8');
  assert.match(index, /setAppUserModelId\(WINDOWS_APP_ID\)/);
  assert.doesNotMatch(index, /mysterious-shhr\.AlmusicPlayer/);
  assert.match(window, /applyTaskbarIdentity\(mainWindow, process\.platform/);
  assert.match(tray, /process\.platform === 'win32' && app\.isPackaged/);
  assert.match(tray, /process\.resourcesPath/);
});

test('package build exports the same external ICO and nine native sizes', async () => {
  const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const helper = loadHelper(true);
  assert.equal(packageJson.build.appId, helper.WINDOWS_APP_ID);
  assert.deepEqual(
    packageJson.build.extraResources.filter((entry) => entry.to === helper.WINDOWS_ICON_NAME),
    [{ from: `resources/${helper.WINDOWS_ICON_NAME}`, to: helper.WINDOWS_ICON_NAME }]
  );
  const ico = await readFile(join(root, 'resources', helper.WINDOWS_ICON_NAME));
  assert.equal(ico.readUInt16LE(2), 1);
  const count = ico.readUInt16LE(4);
  const sizes = Array.from({ length: count }, (_, index) => ico[6 + index * 16] || 256);
  assert.deepEqual(sizes, [16, 20, 24, 32, 40, 48, 64, 128, 256]);
});
