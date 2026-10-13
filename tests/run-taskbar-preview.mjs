/** Temporary ASAR in the existing isolated test-player. Restore/hash-check on every exit path. */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, cp, mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') throw new Error('This native fixture requires Windows.');
const probe = process.argv.includes('--probe');
const interactive = process.argv.includes('--interactive');
const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = dirname(source);
const testPlayer = join(work, 'test-player');
const executable = join(testPlayer, 'ZephyrusPlayer.exe');
const testArchive = join(testPlayer, 'resources/app.asar');
const runDirectory = join(
  work,
  'tests',
  `${probe ? 'koffi-asar-probe' : interactive ? 'taskbar-preview-hover' : 'taskbar-preview-native'}-${Date.now()}`
);
const staging = join(runDirectory, 'fixture-app');
const require = createRequire(join(source, 'package.json'));
const { build } = createRequire(require.resolve('vite'))('esbuild');
const { createPackage } = require(
  join(source, 'node_modules/.pnpm/@electron+asar@3.4.1/node_modules/@electron/asar')
);
await mkdir(staging, { recursive: true });
await writeFile(
  join(staging, 'package.json'),
  JSON.stringify({ name: 'zephyrus-dwm-fixture', version: '1.0.0', main: 'fixture-main.cjs' })
);
if (probe) {
  await copyFile(
    join(source, 'tests/taskbar-preview-probe.cjs'),
    join(staging, 'fixture-main.cjs')
  );
} else {
  await build({
    entryPoints: [
      join(source, `tests/taskbar-preview-${interactive ? 'interactive' : 'native'}.ts`)
    ],
    outfile: join(staging, 'fixture-main.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['electron'],
    target: 'node22',
    logLevel: 'warning'
  });
}
await cp(join(source, 'resources/taskbar-native'), join(staging, 'resources/taskbar-native'), {
  recursive: true
});
if (interactive) {
  await cp(join(source, 'resources/icons'), join(staging, 'resources/icons'), { recursive: true });
  await copyFile(join(source, 'resources/icon.png'), join(staging, 'resources/icon.png'));
  await copyFile(
    join(source, 'tests/taskbar-windows-smoke-preload.cjs'),
    join(staging, 'fixture-preload.cjs')
  );
  await copyFile(
    join(source, 'tests/taskbar-preview-interactive.html'),
    join(staging, 'fixture.html')
  );
}
const fixtureArchive = join(runDirectory, 'fixture-app.asar');
await createPackage(staging, fixtureArchive);
const lockPath = join(testPlayer, 'resources/taskbar-preview-test.lock');
const lock = await open(lockPath, 'wx');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const originalHash = hash(await readFile(testArchive));
const backup = join(runDirectory, 'test-app-before-preview.asar');
let child;
let launchExitCode;
let stdoutBytes = 0;
let stderrBytes = 0;
let stderr = '';
let archiveRestored = false;
let watchdogTriggered = false;
try {
  await copyFile(testArchive, backup);
  if (hash(await readFile(backup)) !== originalHash)
    throw new Error('Test archive backup hash mismatch.');
  await copyFile(fixtureArchive, testArchive);
  console.log(JSON.stringify({ runDirectory, interactive, fixturePrepared: true }));
  const env = { ...process.env, ZEPHYRUS_PREVIEW_TEST_DIR: runDirectory };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.NODE_OPTIONS;
  child = spawn(executable, ['--disable-background-networking', '--disable-component-update'], {
    cwd: testPlayer,
    env,
    windowsHide: true,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (data) => {
    stdoutBytes += data.length;
  });
  child.stderr.on('data', (data) => {
    stderrBytes += data.length;
    if (stderr.length < 2000) stderr += data.toString('utf8');
  });
  const watchdog = setTimeout(
    () => {
      watchdogTriggered = true;
      child.kill();
    },
    interactive ? 165000 : 18000
  );
  await new Promise((resolveExit, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => {
      launchExitCode = code;
      resolveExit();
    });
  }).finally(() => clearTimeout(watchdog));
} finally {
  if (child && child.exitCode === null) child.kill();
  const restore = join(testPlayer, 'resources/app.preview-test-restore.asar');
  await copyFile(backup, restore);
  await rename(restore, testArchive);
  archiveRestored = hash(await readFile(testArchive)) === originalHash;
  await lock.close();
  await unlink(lockPath);
}
let runtime;
try {
  runtime = JSON.parse(await readFile(join(runDirectory, 'native-evidence.json'), 'utf8'));
} catch {
  runtime = { success: false, errors: ['no-runtime-evidence'], checks: {} };
}
const evidence = {
  ...runtime,
  runner: {
    testCopyUsed: true,
    installedAppTouched: false,
    launchExitCode,
    archiveRestored,
    originalHash,
    watchdogTriggered,
    stdoutBytes,
    stderrBytes
  },
  fixtureDiagnostics: stderr.replace(/E:[^\s"']*/gi, '[fixture-path]').slice(0, 2000),
  boundaries: [
    'No account data, music playback, remote cover or installed application is used.',
    interactive
      ? 'No synthetic DWM messages are sent; HRESULTs record actual Windows requests. No taskbar screenshot was captured.'
      : 'Synthetic DWM messages exercise native hooks; real Explorer hover appearance requires separate visual verification.'
  ]
};
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
      errors: evidence.errors,
      runner: evidence.runner
    },
    null,
    2
  )
);
process.exitCode = evidence.success && archiveRestored && launchExitCode === 0 ? 0 : 1;
