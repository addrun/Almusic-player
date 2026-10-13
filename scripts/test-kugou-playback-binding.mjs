import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(directory, 'package.json'));
const { build } = createRequire(require.resolve('vite'))('esbuild');
const output = resolve(directory, 'tests/.build/kugou-playback-binding.cjs');
await mkdir(dirname(output), { recursive: true });
await build({
  entryPoints: [resolve(directory, 'tests/kugou-playback-binding.test.ts')],
  outfile: output,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  logLevel: 'warning'
});
const result = spawnSync(process.execPath, ['--test', output], {
  cwd: directory,
  stdio: 'inherit',
  shell: false
});
process.exitCode = result.status ?? 1;
