/** Read-only publication privacy check. Reports rules and relative paths, never matched values. */
import { createHash } from 'node:crypto';
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const posix = (value) => value.split(sep).join('/');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pathRegex = (value) => new RegExp(value.split(/[\\/]+/).map(escapeRegex).join('[\\\\/]+'), 'i');
const secretPatterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/i],
  ['provider-token', /(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|npm_[A-Za-z0-9]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{30,}|AKIA[0-9A-Z]{16})/],
  ['frontend-github-token', new RegExp(['VITE', 'GITHUB', 'TOKEN'].join('_'), 'i')]
];

function safeArchivePath(value) {
  if (!value || value.includes('\\') || value.startsWith('/') || value.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('invalid-archive-path');
  }
  return value;
}

/** ASAR uses an 8-byte size pickle, followed by a pickle containing its JSON header. */
export function readAsarEntries(archive) {
  const descriptor = openSync(archive, 'r');
  try {
    const size = statSync(archive).size;
    const prefix = Buffer.alloc(16);
    if (readSync(descriptor, prefix, 0, 16, 0) !== 16 || prefix.readUInt32LE(0) !== 4) throw new Error('invalid-asar-header');
    const headerSize = prefix.readUInt32LE(4);
    const jsonSize = prefix.readUInt32LE(12);
    if (headerSize < 8 || headerSize > 64 * 1024 * 1024 || jsonSize > headerSize - 8 || 8 + headerSize > size) throw new Error('invalid-asar-header-size');
    const headerBytes = Buffer.alloc(jsonSize);
    if (readSync(descriptor, headerBytes, 0, jsonSize, 16) !== jsonSize) throw new Error('truncated-asar-header');
    const header = JSON.parse(headerBytes.toString('utf8'));
    const dataStart = 8 + headerSize;
    const entries = [];
    function walk(files, prefixPath = '') {
      if (!files || typeof files !== 'object' || Array.isArray(files)) throw new Error('invalid-asar-tree');
      for (const [name, entry] of Object.entries(files)) {
        const path = safeArchivePath(prefixPath ? `${prefixPath}/${name}` : name);
        if (entry.files) walk(entry.files, path);
        else if (entry.link) {
          safeArchivePath(entry.link);
          entries.push({ path, link: entry.link });
        } else {
          if (!Number.isSafeInteger(entry.size) || entry.size < 0) throw new Error('invalid-asar-entry-size');
          if (entry.unpacked) entries.push({ path, size: entry.size, unpacked: true });
          else {
            const offset = Number(entry.offset);
            if (!Number.isSafeInteger(offset) || offset < 0 || dataStart + offset + entry.size > size) throw new Error('invalid-asar-entry-offset');
            entries.push({ path, size: entry.size, offset: dataStart + offset });
          }
        }
      }
    }
    walk(header.files);
    return entries;
  } finally {
    closeSync(descriptor);
  }
}

function forbiddenPath(path) {
  const components = path.split('/');
  const name = components.at(-1);
  const reasons = [];
  if (components.some((part) => /^(?:publish-audit|deployment-backup.*|test-profile|Local Storage|Session Storage|IndexedDB|Cache|Code Cache|GPUCache|\.git|\.codex|\.aws)$/i.test(part))) reasons.push('local-account-cache-or-backup');
  if (!components.includes('node_modules') && components.some((part) => /^(?:tests?|fixtures?|screenshots?|accounts?)$/i.test(part))) reasons.push('development-fixture-or-account-directory');
  if (/^(?:Cookies(?:-journal)?|Login Data(?:-journal)?|Web Data(?:-journal)?|Local State|config\.json|downloads\.json|disk-cache\.json|audioCache\.json)$/i.test(name)) reasons.push('runtime-account-file');
  if (/^\.env(?:\..*)?$/i.test(name) && name !== '.env.example') reasons.push('environment-file');
  if (/^(?:\.npmrc|\.netrc|\.git-credentials|credentials|id_rsa|id_ed25519)$/i.test(name)) reasons.push('credential-configuration-file');
  if (/\.(?:pfx|p12|pem|key|safe|sqlite\w*|db|session|log)$/i.test(name)) reasons.push('private-or-runtime-file');
  if (/\.map$/i.test(name)) reasons.push('source-map');
  return reasons;
}

export function auditPackagedApp(rootInput, options = {}) {
  const root = realpathSync(resolve(rootInput));
  const findings = [];
  const review = [];
  const inventory = [];
  const seen = new Set();
  const sensitivePaths = [...(options.privatePaths || [])];
  if (!process.env.CI) sensitivePaths.push(process.env.USERPROFILE, homedir(), resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  const homePatterns = sensitivePaths.filter((value) => value && isAbsolute(value)).map(pathRegex);
  for (const user of options.privateUsers || []) {
    if (user) homePatterns.push(new RegExp(`(?:[A-Z]:[\\\\/]+Users[\\\\/]+|/(?:Users|home)/)${escapeRegex(user)}(?:[\\\\/]|$)`, 'i'));
  }
  const add = (target, path, rule) => {
    const key = `${target === findings ? 'fail' : 'review'}:${path}:${rule}`;
    if (!seen.has(key)) { seen.add(key); target.push({ path, rule }); }
  };
  function inspect(path, bytes) {
    for (const reason of forbiddenPath(path)) add(findings, path, reason);
    inventory.push({ path, bytes: bytes.length, sha256: hash(bytes) });
    // Scan text and native binaries. UTF-16LE strings may appear in PE resources.
    const contents = [bytes.toString('utf8'), bytes.toString('utf16le')];
    if (path.endsWith('.gz')) {
      try { contents.push(gunzipSync(bytes, { maxOutputLength: 256 * 1024 * 1024 }).toString('utf8')); }
      catch { add(findings, path, 'unreadable-gzip'); }
    }
    for (const text of contents) {
      for (const [rule, pattern] of secretPatterns) if (pattern.test(text)) add(findings, path, rule);
      if (homePatterns.some((pattern) => pattern.test(text))) add(findings, path, 'private-home-or-local-build-path');
      if (/WEISTUDIOWEI@126\.com/i.test(text)) add(findings, path, 'legacy-personal-email');
      if (/(?:hm\.baidu\.com\/hm\.js|google-analytics\.com|googletagmanager\.com\/gtag|cnzz\.com\/)/i.test(text)) add(review, path, 'analytics-review');
      // Generic assignment matches are review candidates: dependencies can contain public examples.
      if (/\b(?:token|cookie|password|api[_-]?key|client[_-]?secret)\s*[:=]\s*(['"])([^\r\n'"]{8,})\1/i.test(text)) add(review, path, 'literal-credential-review');
    }
  }
  function withinRoot(path) {
    const rel = relative(root, path);
    return rel && !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`);
  }
  function readLoose(path) {
    const rel = posix(relative(root, path));
    if (!withinRoot(realpathSync(path))) { add(findings, rel, 'external-resource-link'); return; }
    inspect(rel, readFileSync(path));
  }
  function walkLoose(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      const rel = posix(relative(root, path));
      if (entry.isSymbolicLink()) { add(findings, rel, 'resource-symlink'); continue; }
      if (entry.isDirectory()) {
        for (const rule of forbiddenPath(`${rel}/_`)) add(findings, rel, rule);
        walkLoose(path);
      } else if (entry.isFile() && rel !== 'app.asar') readLoose(path);
    }
  }
  const archive = resolve(root, 'app.asar');
  if (!existsSync(archive) || !lstatSync(archive).isFile()) throw new Error('app-asar-required');
  const entries = readAsarEntries(archive);
  const descriptor = openSync(archive, 'r');
  try {
    for (const entry of entries) {
      const path = `app.asar/${entry.path}`;
      if (entry.link) {
        for (const rule of forbiddenPath(path)) add(findings, path, rule);
      } else if (entry.unpacked) {
        const actual = resolve(`${archive}.unpacked`, ...entry.path.split('/'));
        if (!existsSync(actual) || !lstatSync(actual).isFile() || !withinRoot(realpathSync(actual))) add(findings, path, 'missing-or-external-unpacked-file');
        else if (statSync(actual).size !== entry.size) add(findings, path, 'unpacked-file-size-mismatch');
      } else {
        const bytes = Buffer.alloc(entry.size);
        if (readSync(descriptor, bytes, 0, entry.size, entry.offset) !== entry.size) throw new Error('truncated-asar-file');
        inspect(path, bytes);
      }
    }
  } finally { closeSync(descriptor); }
  walkLoose(root);
  inventory.sort((a, b) => a.path.localeCompare(b.path));
  findings.sort((a, b) => a.path.localeCompare(b.path) || a.rule.localeCompare(b.rule));
  review.sort((a, b) => a.path.localeCompare(b.path) || a.rule.localeCompare(b.rule));
  return {
    schema: 1,
    scope: 'app.asar contents, app.asar.unpacked, and other loose files in the supplied resources directory',
    result: findings.length ? 'fail' : 'pass',
    archive: { name: 'app.asar', bytes: statSync(archive).size, sha256: hash(readFileSync(archive)), entries: entries.length },
    filesScanned: inventory.length,
    findings,
    review,
    inventory,
    limitations: 'Pattern checks and file inventory do not prove the absence of all sensitive data. Review candidates require human assessment. This check does not inspect the installer container or run the application.'
  };
}

function main(args) {
  const options = { privateUsers: [], privatePaths: [] };
  let root;
  let report;
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error('missing-option-value');
    if (flag === '--root') root = value;
    else if (flag === '--report') report = value;
    else if (flag === '--private-user') options.privateUsers.push(value);
    else if (flag === '--private-path') options.privatePaths.push(value);
    else throw new Error('unknown-option');
    index += 1;
  }
  if (!root || !report) throw new Error('usage: --root <packaged-resources> --report <report.json> [--private-user <username>] [--private-path <path>]');
  const reportRelative = relative(resolve(root), resolve(report));
  if (!isAbsolute(reportRelative) && reportRelative !== '..' && !reportRelative.startsWith(`..${sep}`)) throw new Error('report-must-be-outside-packaged-resources');
  const result = auditPackagedApp(root, options);
  mkdirSync(dirname(resolve(report)), { recursive: true });
  writeFileSync(report, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ result: result.result, filesScanned: result.filesScanned, findings: result.findings.length, review: result.review.length, archiveSHA256: result.archive.sha256 }));
  process.exitCode = result.result === 'pass' ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) {
    // Native filesystem errors can include a private absolute path. Emit only a stable code.
    const code = /^[a-z-]+(?:\:.*)?$/.test(error.message) ? error.message : 'packaged-audit-error';
    console.error(JSON.stringify({ result: 'error', code }));
    process.exitCode = 2;
  }
}
