/** Minimal real Electron/ASAR probe, isolated profile, no renderer or account. */
const { app, session } = require('electron');
const { mkdirSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const directory = resolve(process.env.ZEPHYRUS_PREVIEW_TEST_DIR);
mkdirSync(join(directory, 'profile'), { recursive: true });
mkdirSync(join(directory, 'session'), { recursive: true });
app.setName('ZephyrusDwmLoadProbe');
app.setPath('userData', join(directory, 'profile'));
app.setPath('sessionData', join(directory, 'session'));
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');

const evidence = {
  fixture: 'isolated-koffi-asar-load',
  electron: process.versions.electron,
  platform: process.platform,
  arch: process.arch,
  externalRequestsBlocked: 0,
  checks: {},
  errors: [],
  success: false
};
function finish(error) {
  if (error) evidence.errors.push(String(error.message || error).slice(0, 500));
  evidence.success = evidence.errors.length === 0 && Object.values(evidence.checks).every(Boolean);
  writeFileSync(
    join(directory, 'native-evidence.json'),
    JSON.stringify(evidence, null, 2) + '\n',
    'utf8'
  );
  app.exit(evidence.success ? 0 : 1);
}
process.on('uncaughtException', finish);
process.on('unhandledRejection', finish);
void app
  .whenReady()
  .then(() => {
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ['http://*/*', 'https://*/*'] },
      (_details, callback) => {
        evidence.externalRequestsBlocked++;
        callback({ cancel: true });
      }
    );
    const koffi = require(join(app.getAppPath(), 'resources/taskbar-native/koffi/index.cjs'));
    evidence.checks.loadedFromAsar = app.getAppPath().endsWith('app.asar');
    evidence.checks.fixedVersion = koffi.version === '3.3.3';
    const composition = koffi
      .load(join(process.env.SystemRoot, 'System32/dwmapi.dll'))
      .func('int __stdcall DwmIsCompositionEnabled(_Out_ int *enabled)');
    const enabled = [0];
    evidence.nativeResult = { hresult: composition(enabled), enabled: enabled[0] };
    evidence.checks.nativeApiSucceeded = evidence.nativeResult.hresult === 0;
    evidence.checks.compositionEnabled = enabled[0] === 1;
    evidence.checks.noExternalRequests = evidence.externalRequestsBlocked === 0;
    finish();
  })
  .catch(finish);
setTimeout(() => finish(new Error('probe-timeout')), 8000).unref();
