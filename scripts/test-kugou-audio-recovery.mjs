import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(projectDirectory, 'package.json'));
const viteRequire = createRequire(require.resolve('vite'));
const { build } = viteRequire('esbuild');
const output = resolve(projectDirectory, 'tests/.build/kugou-audio-recovery.cjs');
await mkdir(dirname(output), { recursive: true });
await build({
  entryPoints: [resolve(projectDirectory, 'tests/kugou-audio-recovery.test.ts')],
  outfile: output,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  logLevel: 'warning'
});
const result = spawnSync(process.execPath, ['--test', output], {
  cwd: projectDirectory,
  stdio: 'inherit',
  shell: false
});
process.exitCode = result.status ?? 1;
