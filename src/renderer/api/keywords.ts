/**
 * 重点词 API
 * 服务器地址: https://www.mucang.xyz/api
 */

const API_BASE = 'https://www.mucang.xyz/api';

export interface KeywordWord {
  wordIndex: number;
  text: string;
  emphasis: 'strong';
}

export interface KeywordLine {
  lineIndex: number;
  words: KeywordWord[];
}

export interface KeywordMark {
  songId: string;
  songName: string;
  artist: string;
  lines: KeywordLine[];
  contributorName: string;
  uploadedAt: string;
}

export interface KeywordQueryResult {
  mark: KeywordMark | null;
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

export async function queryKeywords(songId: string): Promise<KeywordQueryResult> {
  try {
    const result = await request<KeywordQueryResult>(`/keywords/${songId}`);
    return result;
  } catch (e) {
    console.error('[KeywordsAPI] queryKeywords error:', e);
    return { mark: null };
  }
}

export async function loadKeywordsForSong(songId: string): Promise<KeywordMark | null> {
  try {
    const result = await queryKeywords(songId);
    return result.mark;
  } catch (e) {
    console.error('[KeywordsAPI] loadKeywordsForSong error:', e);
    return null;
  }
}
