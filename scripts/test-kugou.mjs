import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(projectDirectory, 'package.json'));
// Reuse the already installed build tool; no testing package is required.
const viteRequire = createRequire(require.resolve('vite'));
const { build } = viteRequire('esbuild');
const output = resolve(projectDirectory, 'tests/.build/kugou-integration.cjs');
await mkdir(dirname(output), { recursive: true });
await build({
  entryPoints: [resolve(projectDirectory, 'tests/kugou-integration.test.ts')],
  outfile: output,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  alias: { electron: resolve(projectDirectory, 'tests/helpers/electron-fixture.ts') },
  logLevel: 'warning'
});
const result = spawnSync(process.execPath, ['--test', output], {
  cwd: projectDirectory,
  stdio: 'inherit',
  shell: false
});
process.exitCode = result.status ?? 1;
