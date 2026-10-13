import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(directory, 'package.json'));
const { build } = createRequire(require.resolve('vite'))('esbuild');
const fixture = resolve(directory, 'tests/helpers/kugou-playback-parser-fixture.ts');
const output = resolve(directory, 'tests/.build/kugou-playback-parser.cjs');
await mkdir(dirname(output), { recursive: true });
await build({
  entryPoints: [resolve(directory, 'tests/kugou-playback-parser.test.ts')],
  outfile: output,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  alias: { '@': resolve(directory, 'src/renderer') },
  plugins: [
    {
      name: 'isolated-kugou-playback-providers',
      setup(build) {
        build.onResolve(
          {
            filter:
              /^(?:@\/hooks\/(?:MusicHook|usePlayerHooks)|@\/services\/SongSourceConfigManager|@\/store|@\/utils|@\/utils\/(?:request_music|kugouPlaybackBinding)|\.\/gdmusic|\.\/lxMusicStrategy|\.\/parseFromCustomApi|\.\/search|\.\/music)$/
          },
          (args) => {
            if (args.importer.endsWith('musicParser.ts')) return { path: fixture };
            // Keep the real cross-platform classification; isolate its GD provider import.
            if (args.importer.endsWith('crossPlatformSearch.ts') && args.path === './gdmusic') {
              return { path: fixture };
            }
          }
        );
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
