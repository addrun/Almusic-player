/**
 * 社区歌词 API
 * 服务器地址: https://www.mucang.xyz/api
 */

const API_BASE = 'https://www.mucang.xyz/api';

export interface CommunityLyric {
  id: number;
  songId: string;
  songName: string;
  artist: string;
  album: string;
  lrc: string;
  trLrc?: string;
  contributorName: string;
  uploadedAt: string;
  likes: number;
}

export interface CommunityLyricQueryResult {
  entries: CommunityLyric[];
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

export async function queryCommunityLyrics(songId: string): Promise<CommunityLyricQueryResult> {
  try {
    return await request<CommunityLyricQueryResult>(`/lyrics/${songId}`);
  } catch {
    return { entries: [], activeEntryId: null };
  }
}

export async function loadCommunityLyricForSong(songId: string): Promise<CommunityLyric | null> {
  try {
    const result = await queryCommunityLyrics(songId);
    if (result.entries.length === 0) return null;
    return result.entries[0];
  } catch {
    return null;
  }
}
