// Fetch and verify package archives only. No npm install, lifecycle script or build is run.
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(source, 'package.json'));
const tar = require(join(source, 'node_modules/.pnpm/tar@7.5.16/node_modules/tar'));
const cache = join(source, 'tests/.build/taskbar-package-cache');
await mkdir(cache, { recursive: true });
const sources = [
  {
    name: 'koffi',
    directory: 'koffi-3.3.3',
    registry: 'https://registry.npmjs.org/koffi/3.3.3',
    integrity: 'sha512-XWNI4eyxJJzR2MakPZzR3QeZ06JOklLbxglin0dHhx/qIQCby8lqHs9Acq4Q7CpCKnOrBSj+6b9J5y69wfr2ZA=='
  },
  {
    name: '@koromix/koffi-win32-x64',
    directory: 'koffi-win32-x64-3.3.3',
    registry: 'https://registry.npmjs.org/@koromix/koffi-win32-x64/3.3.3',
    integrity: 'sha512-tLTF17wl4CCwOlo1Tt0NbduwUduDvM6c8JSyearcLu6hpNHQo44RF3rKN2i7UkxwCqXyiudZK0lS421CC/TPZA=='
  }
];
const provenance = [];
for (const sourcePackage of sources) {
  const response = await fetch(sourcePackage.registry);
  if (!response.ok) throw new Error('Registry metadata unavailable');
  const metadata = await response.json();
  if (metadata.name !== sourcePackage.name || metadata.version !== '3.3.3' || metadata.dist.integrity !== sourcePackage.integrity) {
    throw new Error('Registry identity or expected integrity mismatch');
  }
  const url = new URL(metadata.dist.tarball);
  if (url.protocol !== 'https:' || url.hostname !== 'registry.npmjs.org') throw new Error('Untrusted archive origin');
  const archiveResponse = await fetch(url);
  if (!archiveResponse.ok) throw new Error('Archive unavailable');
  const bytes = Buffer.from(await archiveResponse.arrayBuffer());
  const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
  if (integrity !== sourcePackage.integrity) throw new Error('Archive SHA512 mismatch');
  const archive = join(cache, `${sourcePackage.directory}.tgz`);
  const extracted = join(cache, sourcePackage.directory);
  await writeFile(archive, bytes);
  await mkdir(extracted, { recursive: true });
  const entries = [];
  await tar.t({ file: archive, strict: true, onentry: (entry) => {
    if (!entry.path.startsWith('package/') || entry.path.split('/').includes('..') || !['File', 'Directory'].includes(entry.type)) {
      throw new Error('Archive contains an unsafe path or unsupported entry');
    }
    entries.push({ path: entry.path, size: entry.size, type: entry.type });
  } });
  await tar.x({ file: archive, cwd: extracted, strict: true });
  provenance.push({
    name: metadata.name,
    version: metadata.version,
    registry: sourcePackage.registry,
    tarball: metadata.dist.tarball,
    integrity,
    archiveSHA256: createHash('sha256').update(bytes).digest('hex'),
    license: metadata.license,
    installationScriptsExecuted: false,
    entries
  });
  console.log(JSON.stringify({ name: metadata.name, verifiedSHA512: true, archiveBytes: bytes.length, extracted, entries: entries.length }));
}
await writeFile(join(cache, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n', 'utf8');
