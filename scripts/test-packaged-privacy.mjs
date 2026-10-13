import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { auditPackagedApp, readAsarEntries } from './audit-packaged-app.mjs';

function syntheticAsar(root, files) {
  mkdirSync(root, { recursive: true });
  const tree = { files: {} };
  const blobs = [];
  let offset = 0;
  for (const [name, content, unpacked = false] of files) {
    let branch = tree.files;
    const parts = name.split('/');
    for (const part of parts.slice(0, -1)) branch = (branch[part] ||= { files: {} }).files;
    const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
    branch[parts.at(-1)] = unpacked ? { size: bytes.length, unpacked: true } : { size: bytes.length, offset: String(offset) };
    if (unpacked) {
      const path = join(root, 'app.asar.unpacked', ...parts);
      mkdirSync(join(path, '..'), { recursive: true });
      writeFileSync(path, bytes);
    } else { blobs.push(bytes); offset += bytes.length; }
  }
  const json = Buffer.from(JSON.stringify(tree));
  const padding = (4 - (json.length % 4)) % 4;
  const headerSize = 8 + json.length + padding;
  const prefix = Buffer.alloc(16);
  prefix.writeUInt32LE(4, 0);
  prefix.writeUInt32LE(headerSize, 4);
  prefix.writeUInt32LE(headerSize - 4, 8);
  prefix.writeUInt32LE(json.length, 12);
  writeFileSync(join(root, 'app.asar'), Buffer.concat([prefix, json, Buffer.alloc(padding), ...blobs]));
}

const temporary = mkdtempSync(join(tmpdir(), 'almusic-packaged-privacy-'));
let checks = 0;
try {
  const clean = join(temporary, 'clean');
  syntheticAsar(clean, [
    ['package.json', JSON.stringify({ name: 'almusic-player', version: '0.1.1', author: 'contributors' })],
    ['node_modules/vendor/LICENSE', 'Public Author <public@example.org>\n141168900+mysterious-shhr@users.noreply.github.com'],
    ['resources/native.node', Buffer.from([0, 1, 2, 3]), true]
  ]);
  writeFileSync(join(clean, 'app-update.yml'), 'provider: github\nowner: mysterious-shhr\nrepo: Almusic-player\n');
  const cleanReport = auditPackagedApp(clean);
  assert.equal(cleanReport.result, 'pass'); checks += 1;
  assert.equal(cleanReport.filesScanned, 4); checks += 1;
  assert.equal(readAsarEntries(join(clean, 'app.asar')).length, 3); checks += 1;
  assert.equal(JSON.stringify(cleanReport).includes(temporary), false); checks += 1;

  const leaked = join(temporary, 'leaked');
  const fakeHome = ['C:', 'Users', 'private-fixture-user', 'Documents'].join(String.fromCharCode(92));
  const fakeToken = `ghp_${'Q'.repeat(36)}`;
  syntheticAsar(leaked, [
    ['out/main/index.js', `${fakeHome}\n${fakeToken}`],
    ['resources/native.node', Buffer.from(fakeHome, 'utf16le'), true],
    ['out/renderer/index.js.gz', gzipSync(Buffer.from(fakeHome))],
    ['resources/.env.production', 'API_KEY=placeholder'],
    ['resources/tests/accounts.json', '{}'],
    ['out/main/index.js.map', '{}']
  ]);
  writeFileSync(join(leaked, 'Cookies'), 'private fixture');
  const leakReport = auditPackagedApp(leaked, { privateUsers: ['private-fixture-user'] });
  assert.equal(leakReport.result, 'fail'); checks += 1;
  for (const [path, rule] of [
    ['app.asar/out/main/index.js', 'provider-token'],
    ['app.asar/out/main/index.js', 'private-home-or-local-build-path'],
    ['app.asar.unpacked/resources/native.node', 'private-home-or-local-build-path'],
    ['app.asar/out/renderer/index.js.gz', 'private-home-or-local-build-path'],
    ['app.asar/resources/.env.production', 'environment-file'],
    ['app.asar/resources/tests/accounts.json', 'development-fixture-or-account-directory'],
    ['app.asar/out/main/index.js.map', 'source-map'],
    ['Cookies', 'runtime-account-file']
  ]) { assert(leakReport.findings.some((finding) => finding.path === path && finding.rule === rule)); checks += 1; }
  assert.equal(JSON.stringify(leakReport).includes(fakeToken), false); checks += 1;
  assert.equal(JSON.stringify(leakReport).includes(fakeHome), false); checks += 1;
  assert.equal(JSON.stringify(leakReport).includes('private-fixture-user'), false); checks += 1;

  const absent = join(temporary, 'absent');
  syntheticAsar(absent, [['resources/native.node', 'stub', true]]);
  rmSync(join(absent, 'app.asar.unpacked'), { recursive: true });
  assert(auditPackagedApp(absent).findings.some((finding) => finding.rule === 'missing-or-external-unpacked-file')); checks += 1;

  const invalid = join(temporary, 'invalid');
  syntheticAsar(invalid, [['../outside', 'fixture']]);
  assert.throws(() => readAsarEntries(join(invalid, 'app.asar')), /invalid-archive-path/); checks += 1;
  console.log(JSON.stringify({ result: 'pass', checks }));
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
