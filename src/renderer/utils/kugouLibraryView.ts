import type { KugouTrack } from '../../shared/kugou';

export const kugouSortOptions = [
  { label: '默认顺序', key: 'default' },
  { label: '默认顺序 倒序', key: 'default-desc' },
  { label: '添加时间 新 → 旧', key: 'added-desc' },
  { label: '添加时间 旧 → 新', key: 'added-asc' },
  { label: '歌曲名 A → Z', key: 'name-asc' },
  { label: '歌曲名 Z → A', key: 'name-desc' },
  { label: '歌手 A → Z', key: 'artist-asc' },
  { label: '歌手 Z → A', key: 'artist-desc' },
  { label: '专辑 A → Z', key: 'album-asc' },
  { label: '专辑 Z → A', key: 'album-desc' },
  { label: '时长 短 → 长', key: 'duration-asc' },
  { label: '时长 长 → 短', key: 'duration-desc' },
  { label: '播放次数（本机）多 → 少', key: 'playcount-desc' },
  { label: '播放次数（本机）少 → 多', key: 'playcount-asc' },
  { label: '随机排序', key: 'random' }
] as const;
export type KugouSortKey = (typeof kugouSortOptions)[number]['key'];
export const isKugouSortKey = (value: unknown): value is KugouSortKey =>
  kugouSortOptions.some((option) => option.key === value);

const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase();

export function getKugouLocalPlayCounts(history: readonly { id: unknown; count?: unknown }[]) {
  const counts = new Map<string, number>();
  for (const item of history) {
    if (
      typeof item.id === 'string' &&
      item.id.startsWith('kugou:') &&
      typeof item.count === 'number' &&
      Number.isSafeInteger(item.count) &&
      item.count >= 0
    ) {
      counts.set(item.id.slice(6), item.count);
    }
  }
  return counts;
}

interface KugouSortContext {
  randomSeed?: number;
  localPlayCounts?: ReadonlyMap<string, number>;
}

// A seeded Fisher-Yates permutation of the entire playlist preserves its order
// while filtering. Only an explicit shuffle changes the seed.
function shuffled<T>(items: T[], seed: number): T[] {
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** Stable view order only: never mutate the cloud snapshot or drop unavailable rows. */
export function getKugouTrackRows(
  tracks: KugouTrack[],
  query: string,
  sort: KugouSortKey,
  context: KugouSortContext = {}
) {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  let rows = tracks.map((track, sourcePosition) => ({
    track,
    sourcePosition,
    rowKey: `${track.id}_${sourcePosition}`
  }));
  if (sort === 'random') {
    rows = shuffled(rows, context.randomSeed ?? 0);
  } else if (sort === 'default-desc') {
    rows.reverse();
  } else if (sort !== 'default') {
    const direction = sort.endsWith('-desc') ? -1 : 1;
    const field = sort.split('-')[0];
    rows.sort((a, b) => {
      if (field === 'added' || field === 'playcount') {
        const numeric = (track: KugouTrack) => {
          const value =
            field === 'added' ? track.addedAtMs : context.localPlayCounts?.get(track.id);
          return typeof value === 'number' &&
            Number.isFinite(value) &&
            (field === 'added' ? value > 0 : value >= 0)
            ? value
            : undefined;
        };
        const left = numeric(a.track);
        const right = numeric(b.track);
        // Unknown is never fabricated as zero, and stays last in both directions.
        if (left === undefined || right === undefined) {
          return (
            (left === undefined ? 1 : 0) - (right === undefined ? 1 : 0) ||
            a.sourcePosition - b.sourcePosition
          );
        }
        return (left - right) * direction || a.sourcePosition - b.sourcePosition;
      }
      const value = (track: KugouTrack) =>
        field === 'name'
          ? track.name
          : field === 'artist'
            ? track.artists.map((artist) => artist.name).join(' / ')
            : track.albumName;
      const compared =
        field === 'duration'
          ? a.track.durationMs - b.track.durationMs
          : collator.compare(value(a.track), value(b.track));
      return compared * direction || a.sourcePosition - b.sourcePosition;
    });
  }
  return rows
    .filter(({ track }) => {
      const text = normalize(
        [track.name, track.albumName, ...track.artists.map((a) => a.name)].join(' ')
      );
      return terms.every((term) => text.includes(term));
    })
    .map((row, position) => ({ ...row, position }));
}
