/** Ship only already-verified runtime files. No package manager or lifecycle script is used. */
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cache = join(source, 'tests/.build/taskbar-package-cache');
const destination = join(source, 'resources/taskbar-native');
const packages = JSON.parse(await readFile(join(cache, 'provenance.json'), 'utf8'));
for (const item of packages) {
  const name = item.name === 'koffi' ? 'koffi-3.3.3.tgz' : 'koffi-win32-x64-3.3.3.tgz';
  const bytes = await readFile(join(cache, name));
  if (`sha512-${createHash('sha512').update(bytes).digest('base64')}` !== item.integrity) {
    throw new Error('Cached archive integrity no longer matches.');
  }
}
const files = [
  ['koffi-3.3.3/package/LICENSE.txt', 'LICENSE.txt'],
  ['koffi-3.3.3/package/index.cjs', 'koffi/index.cjs'],
  ['koffi-3.3.3/package/src/koffi/index.cjs', 'koffi/src/koffi/index.cjs'],
  ['koffi-3.3.3/package/src/koffi/src/static.cjs', 'koffi/src/koffi/src/static.cjs'],
  ['koffi-win32-x64-3.3.3/package/win32_x64/koffi.node', 'koffi/build/koffi/win32_x64/koffi.node']
];
const shippedFiles = [];
for (const [original, relative] of files) {
  const origin = join(cache, original);
  const target = join(destination, relative);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(origin, target);
  const bytes = await readFile(target);
  shippedFiles.push({
    path: relative,
    original,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex')
  });
}
const provenance = {
  purpose: 'In-process Windows DWM/GDI taskbar thumbnail; Windows x64 only.',
  installationScriptsExecuted: false,
  sources: packages.map((item) => ({
    name: item.name,
    version: item.version,
    registry: item.registry,
    tarball: item.tarball,
    integrity: item.integrity,
    archiveSHA256: item.archiveSHA256,
    license: item.license,
    installationScriptsExecuted: item.installationScriptsExecuted
  })),
  shippedFiles
};
await writeFile(
  join(destination, 'hashes.json'),
  JSON.stringify(provenance, null, 2) + '\n',
  'utf8'
);
await writeFile(
  join(destination, 'SOURCES.md'),
  `# Taskbar native runtime\n\nKoffi 3.3.3, MIT license (see LICENSE.txt).\n\nThe JavaScript loader is copied unchanged from the integrity-verified npm archive. The Windows x64 Node-API binary is copied unchanged from @koromix/koffi-win32-x64 3.3.3. No install, postinstall, compiler or lifecycle script was run. This directory does not require npm installation at runtime.\n\nSources, expected npm SHA512 integrity, archive SHA256 and every shipped file SHA256 are recorded in hashes.json. Reproduce with tests/download-taskbar-native.mjs followed by tests/prepare-taskbar-native.mjs.\n\nThis binary runs in the Electron main process. There is no helper process, account storage or network client. On unsupported architecture or native load failure the application retains the ordinary taskbar preview.\n`,
  'utf8'
);
console.log(
  JSON.stringify({ destination, shippedFiles, installationScriptsExecuted: false }, null, 2)
);
