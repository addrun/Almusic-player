import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(directory, 'package.json'));
const { build } = createRequire(require.resolve('vite'))('esbuild');
const fixture = resolve(directory, 'tests/helpers/local-favorites-fixture.ts');
const output = resolve(directory, 'tests/.build/local-favorites.cjs');
await mkdir(dirname(output), { recursive: true });
await build({
  entryPoints: [resolve(directory, 'tests/local-favorites.test.ts')],
  outfile: output,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  alias: {
    '@/api/music': fixture,
    '@/utils/auth': fixture,
    '@/utils/linearColor': fixture,
    'naive-ui': fixture,
    'vue-i18n': fixture,
    '@': resolve(directory, 'src/renderer')
  },
  plugins: [
    {
      name: 'isolated-favorite-account',
      setup(build) {
        build.onResolve(
          {
            filter:
              /^(?:@\/store|@\/utils|\.\/useDownload|\.\/useArtist|\.\/useOverlayNavigate|\.\.\/api\/music)$/
          },
          (args) => {
            if (args.importer.endsWith('useSongItem.ts')) return { path: fixture };
          }
        );
        build.onResolve({ filter: /^\.\/user$/ }, (args) => {
          if (args.importer.endsWith('favorite.ts')) return { path: fixture };
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
