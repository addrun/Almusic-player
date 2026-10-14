/** Exercise real updater installer arguments and app IPC with virtual files and processes. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, win32 } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));
const ts = require('typescript');
const { NsisUpdater } = require('electron-updater/out/NsisUpdater');
const compile = (text) =>
  ts.transpileModule(text, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  }).outputText;
const helperCode = compile(await readFile(join(root, 'src/main/modules/updateInstall.ts'), 'utf8'));
const updateCode = compile(await readFile(join(root, 'src/main/modules/update.ts'), 'utf8'));

function helper(protectedNames = []) {
  const exports = {};
  runInNewContext(helperCode, {
    exports,
    require(id) {
      if (id === 'node:path') return win32;
      if (id === 'node:fs')
        return {
          existsSync: (value) =>
            protectedNames.some((name) => value === win32.join('E:\\音乐 player', name))
        };
      throw new Error(`Unexpected helper dependency: ${id}`);
    }
  });
  return exports;
}

test('Windows update follows the current EXE directory including spaces and Unicode', () => {
  const updater = { autoInstallOnAppQuit: true, installDirectory: 'C:\\stale-install' };
  helper().configureUpdateInstall(updater, 'win32', true, 'E:\\音乐 player\\Almusic.exe');
  assert.equal(updater.installDirectory, 'E:\\音乐 player');
  assert.equal(updater.autoInstallOnAppQuit, false);
});

for (const [platform, packaged] of [
  ['win32', false],
  ['darwin', true],
  ['linux', true]
]) {
  test(`${platform} packaged=${packaged} does not set a Windows installer destination`, () => {
    const updater = { autoInstallOnAppQuit: true };
    helper().configureUpdateInstall(updater, platform, packaged, 'E:\\音乐 player\\Almusic.exe');
    assert.equal(updater.installDirectory, undefined);
    assert.equal(updater.autoInstallOnAppQuit, false);
  });
}

for (const name of [
  'kugou-sync-work',
  'publish-audit',
  '.git',
  '.agents',
  '.codex',
  '.aws',
  '.pnpm-store',
  'node_modules'
]) {
  test(`NSIS is blocked before touching protected ${name}`, () => {
    assert.match(
      helper([name]).getUpdateInstallError('win32', true, 'E:\\音乐 player\\Almusic.exe'),
      /已停止安装/
    );
  });
}
test('clean install and other platforms permit explicit installation', () => {
  assert.equal(helper().getUpdateInstallError('win32', true, 'E:\\音乐 player\\Almusic.exe'), null);
  assert.equal(
    helper(['publish-audit']).getUpdateInstallError('darwin', true, 'E:\\音乐 player\\Almusic.exe'),
    null
  );
});

for (const isSilent of [false, true]) {
  test(`real NsisUpdater passes current directory in ${isSilent ? 'silent' : 'explicit'} installer arguments`, () => {
    const spawns = [];
    const updater = {
      installerPath: 'C:\\update-cache\\installer.exe',
      downloadedUpdateHelper: { packageFile: null },
      autoInstallOnAppQuit: true,
      spawnLog(command, args) {
        spawns.push({ command, args });
        return Promise.resolve();
      },
      dispatchError(error) {
        throw error;
      },
      _logger: { info() {} }
    };
    helper().configureUpdateInstall(updater, 'win32', true, 'E:\\音乐 player\\Almusic.exe');
    assert.equal(
      NsisUpdater.prototype.doInstall.call(updater, {
        isSilent,
        isForceRunAfter: false,
        isAdminRightsRequired: false
      }),
      true
    );
    assert.deepEqual(spawns[0].args, [
      '--updated',
      ...(isSilent ? ['/S'] : []),
      '/D=E:\\音乐 player'
    ]);
  });
}

function appFixture(protectedNames = []) {
  const handlers = new Map();
  const events = new Map();
  const broadcasts = [];
  let installations = 0;
  const updater = {
    autoInstallOnAppQuit: true,
    on(name, callback) {
      events.set(name, callback);
    },
    quitAndInstall() {
      installations++;
    }
  };
  const states = { idle: 'idle', available: 'available', downloaded: 'downloaded', error: 'error' };
  const exports = {};
  runInNewContext(updateCode, {
    exports,
    process: { platform: 'win32' },
    Date,
    require(id) {
      if (id === 'electron')
        return {
          app: {
            isPackaged: true,
            getVersion: () => '0.1.4',
            getPath: (name) => {
              assert.equal(name, 'exe');
              return 'E:\\音乐 player\\Almusic.exe';
            }
          },
          ipcMain: {
            handle(name, callback) {
              handlers.set(name, callback);
            }
          },
          BrowserWindow: {
            getAllWindows: () => [
              {
                webContents: {
                  send(_name, state) {
                    broadcasts.push({ ...state });
                  }
                }
              }
            ]
          },
          shell: {
            openExternal() {
              throw new Error('Unexpected browser call');
            }
          }
        };
      if (id === 'electron-updater') return { autoUpdater: updater };
      if (id === './updateInstall') return helper(protectedNames);
      if (id === '../../shared/appUpdate')
        return {
          APP_UPDATE_STATUS: states,
          APP_UPDATE_RELEASE_URL: 'https://example.invalid',
          createDefaultAppUpdateState: (currentVersion) => ({
            status: 'idle',
            supported: true,
            currentVersion
          })
        };
      throw new Error(`Unexpected updater dependency: ${id}`);
    }
  });
  exports.setupUpdateHandlers({ webContents: { once() {} } });
  return { handlers, events, broadcasts, updater, installations: () => installations };
}

test('IPC ignores installation until the update has downloaded', async () => {
  const fixture = appFixture();
  assert.equal(await fixture.handlers.get('app-update:quit-and-install')(), false);
  assert.equal(fixture.installations(), 0);
});
test('IPC reports a protected-directory error and never starts the installer', async () => {
  const fixture = appFixture(['publish-audit']);
  fixture.events.get('update-downloaded')({ version: '0.1.5', files: [] });
  assert.equal(await fixture.handlers.get('app-update:quit-and-install')(), false);
  assert.equal(fixture.installations(), 0);
  assert.equal(fixture.broadcasts.at(-1).status, 'error');
  assert.match(fixture.broadcasts.at(-1).errorMessage, /已停止安装/);
  assert.equal(fixture.updater.autoInstallOnAppQuit, false);
});
test('clean runtime explicitly installs a downloaded update at its EXE directory', async () => {
  const fixture = appFixture();
  fixture.events.get('update-downloaded')({ version: '0.1.5', files: [] });
  assert.equal(await fixture.handlers.get('app-update:quit-and-install')(), true);
  assert.equal(fixture.installations(), 1);
  assert.equal(fixture.updater.installDirectory, 'E:\\音乐 player');
});
