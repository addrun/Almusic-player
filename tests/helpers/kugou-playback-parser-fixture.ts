import type { GDCrossPlatformSearchItem } from '../../src/renderer/api/gdmusic';
import type { SongResult } from '../../src/renderer/types/music';

export const parserFixture = {
  settings: {
    setData: {
      enableMusicUnblock: true,
      enabledMusicSources: ['gdmusic'],
      musicQuality: 'higher',
      customApiPlugin: undefined as unknown
    }
  },
  directResult: { url: '', bitrate: 0 },
  unblockResult: null as unknown,
  neteaseSongs: [] as SongResult[],
  neteaseSearchError: false,
  neteaseAudio: new Map<number, { url: string; freeTrialInfo?: object }>(),
  gdItems: new Map<string, GDCrossPlatformSearchItem[]>(),
  gdSearchErrors: new Set<string>(),
  gdUrls: new Map<string, string>(),
  gdQualityUrls: new Map<string, string>(),
  binding: null as SongResult | null,
  boundUrl: null as string | null,
  boundError: false,
  boundCalls: [] as Array<{ id: string | number; song: SongResult; isDownloaded: boolean }>,
  directCalls: [] as Array<{ channel: string; payload: Record<string, unknown> }>,
  unblockCalls: [] as Array<{ id: number; data: any; sources: string[] }>,
  neteaseSearchCalls: [] as Array<{ keywords: string; type: number; limit: number }>,
  neteaseUrlCalls: [] as number[],
  gdSearchCalls: [] as Array<{ platform: string; query: string }>,
  gdUrlCalls: [] as Array<{ platform: string; id: string; quality: string }>,
  requestMusicCalls: [] as unknown[]
};

export function resetParserFixture(): void {
  parserFixture.settings.setData.enableMusicUnblock = true;
  parserFixture.settings.setData.enabledMusicSources = ['gdmusic'];
  parserFixture.settings.setData.musicQuality = 'higher';
  parserFixture.settings.setData.customApiPlugin = undefined;
  parserFixture.directResult = { url: '', bitrate: 0 };
  parserFixture.unblockResult = null;
  parserFixture.neteaseSongs = [];
  parserFixture.neteaseSearchError = false;
  parserFixture.neteaseAudio.clear();
  parserFixture.gdItems.clear();
  parserFixture.gdSearchErrors.clear();
  parserFixture.gdUrls.clear();
  parserFixture.gdQualityUrls.clear();
  parserFixture.binding = null;
  parserFixture.boundUrl = null;
  parserFixture.boundError = false;
  for (const calls of [
    parserFixture.directCalls,
    parserFixture.unblockCalls,
    parserFixture.neteaseSearchCalls,
    parserFixture.neteaseUrlCalls,
    parserFixture.gdSearchCalls,
    parserFixture.gdUrlCalls,
    parserFixture.boundCalls,
    parserFixture.requestMusicCalls
  ])
    calls.length = 0;
  Object.assign(globalThis, {
    window: {
      electron: {
        ipcRenderer: {
          async invoke(channel: string, payload: Record<string, unknown>) {
            parserFixture.directCalls.push({ channel, payload });
            return parserFixture.directResult;
          }
        }
      },
      api: {
        async unblockMusic(id: number, data: any, sources: string[]) {
          parserFixture.unblockCalls.push({ id, data, sources });
          return parserFixture.unblockResult;
        }
      }
    }
  });
}

export const isElectron = true;
export const getKugouPlaybackBinding = () => parserFixture.binding;
export async function getSongUrl(id: string | number, song: SongResult, isDownloaded: boolean) {
  parserFixture.boundCalls.push({ id, song, isDownloaded });
  if (parserFixture.boundError) throw new Error('fixture bound version unavailable');
  return parserFixture.boundUrl;
}
export const useSettingsStore = () => parserFixture.settings;
export const SongSourceConfigManager = { getConfig: () => undefined };
export const getMusicDB = async () => ({
  async getData() {
    return undefined;
  },
  async saveData() {},
  async deleteData() {}
});
export default {
  async get(...args: unknown[]) {
    parserFixture.requestMusicCalls.push(args);
    return { data: { code: 404, message: 'fixture API unavailable' } };
  }
};

export async function getSearch(params: { keywords: string; type: number; limit: number }) {
  parserFixture.neteaseSearchCalls.push(params);
  if (parserFixture.neteaseSearchError) throw new Error('fixture Netease search unavailable');
  return { data: { result: { songs: parserFixture.neteaseSongs } } };
}
export async function getMusicUrl(id: number) {
  parserFixture.neteaseUrlCalls.push(id);
  return { data: { data: [parserFixture.neteaseAudio.get(id) || { url: '' }] } };
}
export async function searchFromGDMusic(platform: string, query: string) {
  parserFixture.gdSearchCalls.push({ platform, query });
  if (parserFixture.gdSearchErrors.has(platform)) throw new Error('fixture GD search unavailable');
  return parserFixture.gdItems.get(platform) || [];
}
export async function getUrlByPlatform(platform: string, id: string, quality: string) {
  parserFixture.gdUrlCalls.push({ platform, id, quality });
  const qualityKey = `${platform}:${id}:${quality}`;
  const url = parserFixture.gdQualityUrls.has(qualityKey)
    ? parserFixture.gdQualityUrls.get(qualityKey)
    : parserFixture.gdUrls.get(`${platform}:${id}`);
  return url ? { data: { code: 200, message: 'GD fixture', data: { url } } } : null;
}
export const parseFromGDMusic = async () => null;
export const parseFromCustomApi = async () => null;
export class LxMusicStrategy {
  name = 'lxMusic';
  priority = 2;
  canHandle(sources: string[]) {
    return sources.includes('lxMusic');
  }
  async parse() {
    return null;
  }
}
