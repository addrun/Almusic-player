import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const directory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(directory, 'package.json'));
const { build } = createRequire(require.resolve('vite'))('esbuild');
const fixture = resolve(directory, 'tests/helpers/taskbar-renderer-fixture.ts');
const output = resolve(directory, 'tests/.build/taskbar-native.cjs');
await mkdir(dirname(output), { recursive: true });
await build({
  entryPoints: [resolve(directory, 'tests/taskbar-native.test.ts')],
  outfile: output,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  alias: {
    electron: resolve(directory, 'tests/helpers/taskbar-electron-fixture.ts'),
    '@/store': fixture,
    '@/store/modules/favorite': resolve(directory, 'src/renderer/store/modules/favorite.ts'),
    '@/api/music': fixture,
    '@/utils/auth': fixture,
    '@/hooks/MusicHook': fixture,
    '@': resolve(directory, 'src/renderer')
  },
  plugins: [
    {
      name: 'isolated-taskbar-integrations',
      setup(build) {
        build.onResolve({ filter: /[\\/]i18n[\\/]renderer$/ }, (args) => {
          if (args.importer.endsWith('appShortcuts.ts')) return { path: fixture };
        });
        build.onResolve({ filter: /^(?:\.|\.\/user|\.\/shortcutToast)$/ }, (args) => {
          if (args.importer.endsWith('appShortcuts.ts') || args.importer.endsWith('favorite.ts')) {
            return { path: fixture };
          }
        });
      }
    }
  ],
  logLevel: 'warning'
});
const result = spawnSync(process.execPath, ['--test', output], {
  cwd: directory,
  stdio: 'inherit',
  shell: false
});
process.exitCode = result.status ?? 1;
