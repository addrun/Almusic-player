# Taskbar native runtime

Koffi 3.3.3, MIT license (see LICENSE.txt).

The JavaScript loader is copied unchanged from the integrity-verified npm archive. The Windows x64 Node-API binary is copied unchanged from @koromix/koffi-win32-x64 3.3.3. No install, postinstall, compiler or lifecycle script was run. This directory does not require npm installation at runtime.

Sources, expected npm SHA512 integrity, archive SHA256 and every shipped file SHA256 are recorded in hashes.json. Reproduce with tests/download-taskbar-native.mjs followed by tests/prepare-taskbar-native.mjs.

This binary runs in the Electron main process. There is no helper process, account storage or network client. On unsupported architecture or native load failure the application retains the ordinary taskbar preview.
