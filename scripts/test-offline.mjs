/** Run isolated regression suites without reading account data or launching the player. */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const suites = [
  'test-app-identity.mjs',
  'test-kugou.mjs',
  'test-kugou-catalogue.mjs',
  'test-kugou-playback-parser.mjs',
  'test-kugou-playback-match.mjs',
  'test-kugou-playback-fallback.mjs',
  'test-kugou-playback-binding.mjs',
  'test-kugou-audio-recovery.mjs',
  'test-preload-kugou.mjs',
  'test-local-favorites.mjs',
  'test-taskbar.mjs'
];
for (const suite of suites) {
  const result = spawnSync(process.execPath, [resolve(root, 'scripts', suite)], {
    cwd: root,
    stdio: 'inherit',
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
