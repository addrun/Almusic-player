import type { SongResult } from '@/types/music';
import {
  buildKugouPlaybackSearchQuery,
  scoreKugouPlaybackCandidate
} from '@/utils/kugouPlaybackMatch';

import type { MusicParseResult } from './musicParser';

export interface KugouPlaybackFallbackSource {
  name: string;
  search: (query: string, signal?: AbortSignal) => Promise<SongResult[]>;
  resolve: (candidate: SongResult, signal?: AbortSignal) => Promise<MusicParseResult | null>;
}

// Only remember rejected addresses in this process. Never persist signed audio
// URLs or replace the original playlist identity with a different platform ID.
const rejectedUrls = new Map<string, Map<string, number>>();

function songKey(song: SongResult): string {
  return `${song.id}:${song.platformId || ''}`;
}

export function rejectKugouPlaybackUrl(song: SongResult, url: string): void {
  if (!song.kugou || !url) return;
  if (rejectedUrls.size >= 200 && !rejectedUrls.has(songKey(song))) rejectedUrls.clear();
  const urls = rejectedUrls.get(songKey(song)) || new Map<string, number>();
  if (urls.size >= 10) urls.clear();
  urls.set(url, Date.now() + 5 * 60 * 1000);
  rejectedUrls.set(songKey(song), urls);
}

export function isRejectedKugouPlaybackUrl(song: SongResult, url: string): boolean {
  const urls = rejectedUrls.get(songKey(song));
  const expiresAt = urls?.get(url);
  if (!expiresAt) return false;
  if (expiresAt > Date.now()) return true;
  urls!.delete(url);
  if (!urls!.size) rejectedUrls.delete(songKey(song));
  return false;
}

async function bounded<T>(
  operation: () => Promise<T>,
  timeout: number,
  signal: AbortSignal
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  try {
    if (signal.aborted) throw new Error('Kugou fallback finished');
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Kugou fallback timeout')), timeout);
        abort = () => reject(new Error('Kugou fallback finished'));
        signal.addEventListener('abort', abort, { once: true });
      })
    ]);
  } finally {
    clearTimeout(timer);
    if (abort) signal.removeEventListener('abort', abort);
  }
}

/** Search independent catalogs together so a slow source cannot exhaust all playback time. */
export async function resolveKugouPlaybackFallback(
  song: SongResult,
  sources: KugouPlaybackFallbackSource[],
  budgetMs = 25000
): Promise<MusicParseResult | null> {
  const query = buildKugouPlaybackSearchQuery(song);
  if (!query || !sources.length || budgetMs <= 0) return null;
  const deadline = Date.now() + budgetMs;
  const timeout = () => Math.min(6500, Math.max(1, deadline - Date.now()));
  const controller = new AbortController();

  const resolveSource = async (source: KugouPlaybackFallbackSource): Promise<MusicParseResult> => {
    // A rejected search rejects this source only. Other verified catalogs remain available.
    const candidates = await bounded(
      () => source.search(query, controller.signal),
      timeout(),
      controller.signal
    );
    const ranked = candidates
      .map((candidate) => ({ candidate, score: scoreKugouPlaybackCandidate(song, candidate) }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3);

    for (const { candidate } of ranked) {
      if (controller.signal.aborted || Date.now() >= deadline) break;
      try {
        const result = await bounded(
          () => source.resolve(candidate, controller.signal),
          timeout(),
          controller.signal
        );
        const audio = result?.data?.data;
        if (audio?.url && !audio.freeTrialInfo && !isRejectedKugouPlaybackUrl(song, audio.url)) {
          return result!;
        }
      } catch {
        // A restricted version does not imply that the next exact match fails.
      }
    }
    throw new Error('No verified playable Kugou fallback candidate');
  };

  try {
    return await Promise.any(sources.map(resolveSource));
  } catch {
    return null;
  } finally {
    // Providers without cancellation support may finish their current read, but
    // they must not start more resolutions after another source has succeeded.
    controller.abort();
  }
}
