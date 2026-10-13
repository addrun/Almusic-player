# Kugou regression checks

Run from this source directory:

```powershell
node scripts/test-offline.mjs
# Or run the synchronization suite alone:
node scripts/test-kugou.mjs
node_modules/.bin/tsc.cmd -p tests/tsconfig.kugou.json
```

The runner reuses the installed Vite/esbuild dependency and Node's built-in test
runner. It does not install another test framework.

The application-identity suite also checks renamed and legacy profile selection
using a virtual filesystem and Electron fixture; it never reads existing profile
files or creates directories under a real user's app-data folder.

These checks exercise real pagination, response conversion, source merging,
main-process projection, cache selection, cancellation and IPC validation code.
Network responses are explicit isolated fixtures, including a 751-song list,
repeated pages, count disagreement, partial failure and account logout races.
All filesystem checks use new temporary directories and a clearly labelled
safeStorage fixture; existing personal account files are never read.

Passing this suite does **not** confirm a real scan/login, the latest authenticated
Kugou API response shape, Windows DPAPI encryption, playback privileges or actual
audio output. Those require separately labelled live desktop/account verification.

## Native Windows taskbar regression checks

```powershell
node scripts/test-taskbar.mjs
node_modules/.bin/tsc.cmd -p tests/tsconfig.taskbar.json
```

The taskbar suite exercises the real native-control module, renderer shortcut
handler, favorite store, playback-bar hook and Vue state synchronization. Electron
window methods and account APIs are explicit isolated fixtures. It covers early
startup retries, unavailable icons, playing/paused state, current-track changes,
local Kugou/QQ/Bilibili identities, preserved NetEase collection behavior,
reload/crash state reset, rejected sender frames and shutdown cleanup. No existing
account storage is read, no track is played, and no network call is made.

This confirms control wiring and state transitions. Windows Explorer's visible
thumbnail and native hit targets still need a desktop smoke check. On Windows x64,
the implementation draws a song information card in the existing main process;
it falls back to the ordinary window preview if the native runtime is unavailable.
No cover-rendering helper process is started.

The following historical smoke runner requires a separately prepared, disposable
Electron installation beside the source directory. It is not a portable clone-and-run
check and must never point at a normal player installation or its user profile.
For a real Windows native API check using that isolated copy:

```powershell
node scripts/test-taskbar-windows.mjs
```

This runner backs up the test copy's `app.asar`, packages only the taskbar module
with a standalone fixture, creates a separate profile and automatically exits.
It restores the test ASAR and verifies its hash. The structured evidence reports
actual `setThumbarButtons` results, native icon sizes, real main-frame IPC and
control dispatch. It does not open the installed player, read account data, play
music, perform network calls, or automate the taskbar mouse. On a restricted
Windows process sandbox, Electron renderer child launch can fail; that environment
error must be distinguished from a native taskbar API result.
