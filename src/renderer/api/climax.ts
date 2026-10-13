/**
 * 高潮数据 API
 * 服务器地址: https://www.mucang.xyz/api
 */

const API_BASE = 'https://www.mucang.xyz/api';

export interface ClimaxSegment {
  start: number;
  end: number;
}

export interface ClimaxEntry {
  id: number;
  song_id: string;
  song_name: string;
  artist: string;
  album: string;
  duration: number;
  segments: ClimaxSegment[];
  contributor_name: string;
  uploaded_at: string;
  likes: number;
  is_liked_by_me: number;
}

export interface ClimaxQueryResult {
  entries: ClimaxEntry[];
  activeEntryId: number | null;
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export async function queryClimax(songId: string, username?: string): Promise<ClimaxQueryResult> {
  const params = username ? `?username=${encodeURIComponent(username)}` : '';
  return request<ClimaxQueryResult>(`/climax/${songId}${params}`);
}

export async function uploadClimax(data: {
  songId: string;
  songName: string;
  artist: string;
  album: string;
  duration: number;
  segments: ClimaxSegment[];
  contributorName: string;
}) {
  return request<{ success: boolean; entry: ClimaxEntry }>('/climax', {
    method: 'POST',
    body: JSON.stringify({
      songId: data.songId,
      songName: data.songName,
      artist: data.artist,
      album: data.album,
      duration: data.duration,
      segments: data.segments,
      contributorName: data.contributorName
    })
  });
}

export async function deleteClimaxEntry(entryId: number, contributorName?: string) {
  const params = contributorName ? `?contributorName=${encodeURIComponent(contributorName)}` : '';
  return request<{ success: boolean }>(`/climax/${entryId}${params}`, { method: 'DELETE' });
}

export async function likeClimaxEntry(entryId: number, username: string) {
  return request<{ success: boolean; likes: number }>(`/climax/${entryId}/like`, {
    method: 'POST',
    body: JSON.stringify({ username })
  });
}

export async function unlikeClimaxEntry(entryId: number, username: string) {
  return request<{ success: boolean; likes: number }>(`/climax/${entryId}/like?username=${encodeURIComponent(username)}`, {
    method: 'DELETE'
  });
}

/**
 * 加载歌曲的高潮段落（优先使用最高优先级的条目）
 */
export async function loadClimaxForSong(songId: string, username?: string) {
  try {
    const result = await queryClimax(songId, username);
    if (result.entries.length === 0) {
      return { segments: [], contributor: null };
    }
    const active = result.entries[0];
    return {
      segments: active.segments,
      contributor: active.contributor_name,
      entryId: active.id,
      likes: active.likes
    };
  } catch (err) {
    console.error('[ClimaxAPI] 加载高潮数据失败:', err);
    return { segments: [], contributor: null };
  }
}
