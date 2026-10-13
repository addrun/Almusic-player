/** Only runs an isolated existing Electron copy, never the installed player. */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, cp, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') throw new Error('This isolated smoke check requires Windows.');
const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = dirname(source);
const testPlayer = join(work, 'test-player');
const executable = join(testPlayer, 'ZephyrusPlayer.exe');
const testArchive = join(testPlayer, 'resources', 'app.asar');
const runDirectory = join(work, 'tests', `taskbar-native-${Date.now()}`);
const staging = join(runDirectory, 'fixture-app');
const require = createRequire(join(source, 'package.json'));
const { build } = createRequire(require.resolve('vite'))('esbuild');
const { createPackage } = require(
  join(source, 'node_modules/.pnpm/@electron+asar@3.4.1/node_modules/@electron/asar')
);
await mkdir(join(staging, 'resources', 'icons'), { recursive: true });
await writeFile(
  join(staging, 'package.json'),
  JSON.stringify({
    name: 'zephyrus-taskbar-api-fixture',
    version: '1.0.0',
    main: 'fixture-main.cjs'
  })
);
await build({
  entryPoints: [join(source, 'tests/taskbar-windows-smoke-main.ts')],
  outfile: join(staging, 'fixture-main.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
  target: 'node22',
  logLevel: 'warning'
});
await copyFile(
  join(source, 'tests/taskbar-windows-smoke-preload.cjs'),
  join(staging, 'fixture-preload.cjs')
);
await copyFile(join(source, 'tests/taskbar-windows-smoke.html'), join(staging, 'fixture.html'));
for (const name of ['prev', 'play', 'pause', 'next', 'favorite', 'favorite-active']) {
  for (const suffix of ['', '-dark']) {
    await copyFile(
      join(source, 'resources/icons', `${name}${suffix}.png`),
      join(staging, 'resources/icons', `${name}${suffix}.png`)
    );
  }
}
await cp(join(source, 'resources/taskbar-native'), join(staging, 'resources/taskbar-native'), {
  recursive: true
});
const fixtureArchive = join(runDirectory, 'fixture-app.asar');
await createPackage(staging, fixtureArchive);
const originalHash = createHash('sha256')
  .update(await readFile(testArchive))
  .digest('hex');
const backup = join(runDirectory, 'test-app-before-smoke.asar');
await copyFile(testArchive, backup);
if (
  createHash('sha256')
    .update(await readFile(backup))
    .digest('hex') !== originalHash
) {
  throw new Error('Test archive backup did not verify.');
}

let child;
let launchExitCode;
let stdoutBytes = 0;
let stderrBytes = 0;
let fixtureStderr = '';
let archiveRestored = false;
let watchdogTriggered = false;
try {
  await copyFile(fixtureArchive, testArchive);
  const environment = { ...process.env, ZEPHYRUS_TASKBAR_SMOKE_DIR: runDirectory };
  delete environment.ELECTRON_RUN_AS_NODE;
  delete environment.NODE_OPTIONS;
  child = spawn(executable, ['--disable-background-networking', '--disable-component-update'], {
    cwd: testPlayer,
    env: environment,
    windowsHide: true,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (data) => {
    stdoutBytes += data.length;
  });
  child.stderr.on('data', (data) => {
    stderrBytes += data.length;
    if (fixtureStderr.length < 2000) fixtureStderr += data.toString('utf8');
  });
  const watchdog = setTimeout(() => {
    watchdogTriggered = true;
    child.kill();
  }, 17000);
  await new Promise((resolveExit, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => {
      launchExitCode = code;
      resolveExit();
    });
  }).finally(() => clearTimeout(watchdog));
} finally {
  if (child && child.exitCode === null) child.kill();
  // Restore only the existing test copy. The installed resources/app.asar is never opened here.
  const restoreStaging = join(testPlayer, 'resources', 'app.taskbar-test-restore.asar');
  await copyFile(backup, restoreStaging);
  await rename(restoreStaging, testArchive);
  archiveRestored =
    createHash('sha256')
      .update(await readFile(testArchive))
      .digest('hex') === originalHash;
}
let runtime;
try {
  runtime = JSON.parse(await readFile(join(runDirectory, 'native-evidence.json'), 'utf8'));
} catch {
  runtime = {
    fixture: 'isolated-native-taskbar-api',
    success: false,
    errors: ['no-runtime-evidence'],
    checks: {}
  };
}
const evidence = {
  ...runtime,
  taskbarSourceSha256: Object.fromEntries(
    await Promise.all(
      ['src/main/modules/taskbar.ts', 'src/main/modules/taskbarPreview.ts'].map(async (name) => [
        name,
        createHash('sha256')
          .update(await readFile(join(source, name)))
          .digest('hex')
      ])
    )
  ),
  runner: {
    isolatedExecutable: basename(executable),
    testCopyUsed: true,
    installedAppTouched: false,
    launchExitCode,
    archiveRestored,
    watchdogTriggered,
    stdoutBytes,
    stderrBytes
  },
  boundaries: [
    'Real Electron Windows native API results and main-frame IPC are checked.',
    'Button callbacks are invoked by the fixture; no taskbar mouse automation is performed.',
    'Windows Explorer hover appearance and native hit targets are not visually verified.',
    'No account files, playlist API, playback or installed application are used.'
  ]
};
evidence.fixtureDiagnostics = fixtureStderr
  .replace(/E:[^\s"']*/gi, '[fixture-path]')
  .slice(0, 2000);
await writeFile(
  join(runDirectory, 'evidence.json'),
  JSON.stringify(evidence, null, 2) + '\n',
  'utf8'
);
console.log(
  JSON.stringify(
    {
      evidence: join(runDirectory, 'evidence.json'),
      success: evidence.success,
      checks: evidence.checks,
      runner: evidence.runner
    },
    null,
    2
  )
);
process.exitCode = evidence.success && archiveRestored && launchExitCode === 0 ? 0 : 1;
