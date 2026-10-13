import { randomBytes } from 'node:crypto';

import type {
  KugouLibrary, KugouLoginCheck, KugouLoginQr, KugouLyrics, KugouLyricsRequest,
  KugouPlaylist, KugouPlaylistTracks, KugouSongUrl, KugouSongUrlRequest,
  KugouStatus, KugouSyncProgress
} from '../../shared/kugou';
import type { KugouPaginationResult } from './pagination';
import { paginateKugou } from './pagination';
import type { JsonObject, KugouDevice } from './protocol';
import {
  asObject, count, createDevice, imageUrl, KugouApiError, KugouClient,
  KugouProtocol, md5, normalizeTrack, playlistPage, text, trackIdentity, trackPage
} from './protocol';
import type { KugouAccount, KugouCache } from './storage';
import { KugouStorage } from './storage';

interface LoginSession {
  id: string;
  key: string;
  client: KugouClient;
  expiresAt: number;
  generation: number;
  busy: boolean;
}

interface SongCacheEntry {
  result: KugouSongUrl;
  expiresAt: number;
}

function cleanError(error: unknown): string {
  return error instanceof KugouApiError ? error.message : '酷狗请求未完成，请重试。';
}

function requireHash(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-fA-F0-9]{32}$/.test(value)) {
    throw new KugouApiError('无效的酷狗歌曲标识。');
  }
  return value.toUpperCase();
}

function numericId(value: unknown): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !/^\d{1,20}$/.test(value)) throw new KugouApiError('无效的酷狗专辑或歌曲编号。');
  return value;
}

function validFileId(value: unknown): string {
  const id = text(value, 20);
  return /^\d{1,20}$/.test(id) && !/^0+$/.test(id) ? id : '';
}

/** Combine account/private and public read sources without discarding either source's entries. */
export function mergeTrackSources(
  primary: KugouPaginationResult<JsonObject>,
  fallback: KugouPaginationResult<JsonObject>
): KugouPaginationResult<JsonObject> {
  const rows = primary.rows.map((row) => ({ ...row }));
  const byFile = new Map<string, number>();
  const byHash = new Map<string, number>();
  const addKeys = (row: JsonObject, index: number) => {
    const file = validFileId(row.fileid);
    const hash = text(row.hash || row.FileHash).toUpperCase();
    if (file) byFile.set(file, index);
    if (/^[A-F0-9]{32}$/.test(hash)) byHash.set(hash, index);
  };
  rows.forEach(addKeys);
  for (const row of fallback.rows) {
    const file = validFileId(row.fileid);
    const hash = text(row.hash || row.FileHash).toUpperCase();
    const match = (file ? byFile.get(file) : undefined) ?? (hash ? byHash.get(hash) : undefined);
    if (match !== undefined) {
      if (normalizeTrack(rows[match], match).unavailable && !normalizeTrack(row, match).unavailable) {
        const accountRow = rows[match];
        const merged: JsonObject = { ...accountRow, ...row, shield: 0 };
        // Public song details repair playback metadata, but must not replace
        // membership metadata from this account's cloud list with the author's
        // collection time or order from a public list.
        for (const field of ['collecttime', 'sort', 'fileid', 'user_id']) {
          if (Object.prototype.hasOwnProperty.call(accountRow, field)) merged[field] = accountRow[field];
        }
        rows[match] = merged;
        addKeys(rows[match], match);
      }
    } else {
      rows.push({ ...row });
      addKeys(row, rows.length - 1);
    }
  }
  const total = primary.total ?? fallback.total;
  const disagreement = primary.total !== undefined && fallback.total !== undefined && primary.total !== fallback.total;
  const complete = !disagreement && (primary.complete || fallback.complete) && (total === undefined || rows.length === total);
  const warnings = complete ? [] : [...primary.warnings, ...fallback.warnings];
  if (disagreement) warnings.push(`账号接口标示 ${primary.total} 首，公开接口标示 ${fallback.total} 首，已合并可获取的歌曲，请再次刷新确认。`);
  if (total !== undefined && rows.length !== total) warnings.push(`合并后读取到 ${rows.length} 首，云端标示 ${total} 首，无法确认列表完整。`);
  return { rows, total, complete, warnings: [...new Set(warnings)], pages: primary.pages + fallback.pages };
}

export class KugouService {
  private account?: KugouAccount;
  private cache?: KugouCache;
  private readonly storage: KugouStorage;
  private client: KugouClient;
  private device: KugouDevice;
  private login?: LoginSession;
  private loginSequence = 0;
  private generation = 0;
  private syncing?: Promise<KugouLibrary>;
  private syncController?: AbortController;
  private readonly refreshControllers = new Set<AbortController>();
  private warning?: string;
  private readonly songCache = new Map<string, SongCacheEntry>();

  constructor(directory: string) {
    this.storage = new KugouStorage(directory);
    this.account = this.storage.loadAccount();
    this.device = this.account?.credentials.device || createDevice();
    this.client = new KugouClient(this.device);
    if (this.account) this.cache = this.storage.loadCache(this.account.profile.userId);
  }

  status(): KugouStatus {
    return {
      loggedIn: !!this.account,
      profile: this.account ? { ...this.account.profile } : undefined,
      persistenceAvailable: this.storage.available(),
      cacheAvailable: !!this.cache,
      syncing: !!this.syncing,
      lastSyncAt: this.cache?.library.syncedAt,
      warning: this.warning || (!this.storage.available() ? '系统安全存储不可用，登录与歌单只保存在本次运行内存中。' : undefined)
    };
  }

  library(): KugouLibrary | null {
    return this.cache?.library || null;
  }

  async createLogin(): Promise<KugouLoginQr> {
    this.cancelLogin();
    const generation = this.generation;
    const loginSequence = this.loginSequence;
    const client = new KugouClient(createDevice());
    try {
      const body = await client.request({
        host: 'login-user.kugou.com', path: '/v2/qrcode', web: true,
        params: {
          appid: 1001, type: 1, plat: 4, srcappid: 2919,
          qrcode_txt: `https://h5.kugou.com/apps/loginQRCode/html/index.html?appid=${KugouProtocol.appId}&`
        }
      });
      if (generation !== this.generation || loginSequence !== this.loginSequence) throw new KugouApiError('登录已取消，请重新获取二维码。');
      const data = asObject(body.data);
      const key = text(data.qrcode, 200);
      if (!/^[a-zA-Z0-9_-]{8,200}$/.test(key)) throw new KugouApiError('酷狗未返回有效的登录二维码。');
      const id = randomBytes(16).toString('hex');
      const expiresAt = Date.now() + 180000;
      this.login = { id, key, client, expiresAt, generation, busy: false };
      const encoded = text(data.qrcode_img, 2 * 1024 * 1024);
      const imageDataUrl = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(encoded)
        ? encoded
        : (/^[A-Za-z0-9+/=]+$/.test(encoded) && encoded.length > 30 ? `data:image/png;base64,${encoded}` : undefined);
      return {
        sessionId: id,
        url: `https://h5.kugou.com/apps/loginQRCode/html/index.html?qrcode=${encodeURIComponent(key)}`,
        imageDataUrl,
        expiresAt
      };
    } catch (error) {
      client.destroy();
      throw error;
    }
  }

  async checkLogin(sessionId: string): Promise<KugouLoginCheck> {
    const login = this.login;
    if (!login || login.id !== sessionId || login.generation !== this.generation || Date.now() >= login.expiresAt) {
      if (login?.id === sessionId) this.cancelLogin();
      return { state: 'expired' };
    }
    if (login.busy) return { state: 'waiting' };
    login.busy = true;
    try {
      const body = await login.client.request({
        host: 'login-user.kugou.com', path: '/v2/get_userinfo_qrcode', web: true,
        params: { plat: 4, appid: KugouProtocol.appId, srcappid: 2919, qrcode: login.key, dev: login.client.device.dev }
      });
      if (this.login !== login || login.generation !== this.generation || Date.now() >= login.expiresAt) {
        return { state: 'expired' };
      }
      const data = asObject(body.data);
      const state = Number(data.status);
      if (state === 0) { this.cancelLogin(); return { state: 'expired' }; }
      if (state !== 4) return { state: state === 2 ? 'scanned' : 'waiting' };
      const token = text(data.token, 4096);
      const userId = text(data.userid, 20);
      if (!token || !/^\d{1,20}$/.test(userId)) throw new KugouApiError('酷狗登录未返回有效凭据，请重新扫码。');
      const info = asObject(data.userinfo || data.user_info);
      const account: KugouAccount = {
        credentials: { token, userId, device: login.client.device },
        profile: {
          userId,
          nickname: text(data.nickname || data.username || info.nickname || info.username, 100) || '酷狗用户',
          avatarUrl: imageUrl(data.pic || data.avatar || data.userpic || info.pic || info.avatar)
        }
      };
      this.syncController?.abort();
      this.abortRefreshes();
      this.syncing = undefined;
      this.syncController = undefined;
      this.generation += 1;
      this.client.destroy();
      this.client = login.client;
      this.device = login.client.device;
      this.login = undefined;
      this.account = account;
      this.cache = undefined;
      this.songCache.clear();
      this.warning = undefined;
      try {
        this.storage.clear();
        this.storage.saveAccount(account);
      } catch (error) {
        this.warning = cleanError(error);
      }
      return { state: 'confirmed', status: this.status() };
    } finally {
      login.busy = false;
    }
  }

  cancelLogin(sessionId?: string): boolean {
    if (sessionId && this.login?.id !== sessionId) return false;
    this.loginSequence += 1;
    if (this.login) this.login.client.destroy();
    this.login = undefined;
    return true;
  }

  logout(): KugouStatus {
    this.generation += 1;
    this.syncController?.abort();
    this.abortRefreshes();
    this.syncing = undefined;
    this.syncController = undefined;
    this.cancelLogin();
    this.client.destroy();
    this.account = undefined;
    this.cache = undefined;
    this.warning = undefined;
    this.songCache.clear();
    this.device = createDevice();
    this.client = new KugouClient(this.device);
    try { this.storage.clear(); } catch { this.warning = '无法删除部分本机酷狗缓存，请关闭软件后检查文件占用。'; }
    return this.status();
  }

  async sync(onProgress: (progress: KugouSyncProgress) => void): Promise<KugouLibrary> {
    if (this.syncing) return this.syncing;
    const account = this.requireAccount();
    const generation = this.generation;
    const controller = new AbortController();
    const client = this.client;
    this.abortRefreshes();
    this.syncController = controller;
    const operation = this.performSync(account, generation, client, controller.signal, onProgress);
    this.syncing = operation;
    try { return await operation; }
    finally {
      if (this.syncing === operation) this.syncing = undefined;
      if (this.syncController === controller) this.syncController = undefined;
    }
  }

  private async performSync(
    account: KugouAccount,
    generation: number,
    client: KugouClient,
    signal: AbortSignal,
    onProgress: (progress: KugouSyncProgress) => void
  ): Promise<KugouLibrary> {
    const progress: KugouSyncProgress = { stage: 'playlists', completedPlaylists: 0, totalPlaylists: 0, fetchedTracks: 0, message: '正在读取酷狗云端全部歌单…' };
    onProgress({ ...progress });
    const catalogue = await paginateKugou({
      pageSize: 100, maxPages: 1000, signal,
      identity: (playlist: KugouPlaylist) => playlist.id,
      fetchPage: async (page, pageSize) => playlistPage(await client.request({
        path: '/v7/get_all_list', router: 'cloudlist.service.kugou.com', credentials: account.credentials,
        params: { plat: 1, userid: account.credentials.userId, token: account.credentials.token },
        data: { userid: account.credentials.userId, token: account.credentials.token, total_ver: 0, type: 2, page, pagesize: pageSize }, signal
      }), account.credentials.userId, page),
      onPage: (fetched) => { progress.totalPlaylists = fetched; onProgress({ ...progress }); }
    });
    this.assertGeneration(generation, signal);
    const warnings = [...catalogue.warnings];
    const previous = this.cache;
    const tracks: Record<string, KugouPlaylistTracks> = {};
    const playlists = [...catalogue.rows];
    const retainedAfterNullTail = new Set<string>();
    if (!playlists.some((playlist) => playlist.category === 'liked')) {
      warnings.push('酷狗云端目录未返回“我喜欢”；请确认官方客户端已完成云同步后再次刷新。');
    }
    // Keep missing cache entries for incomplete reads and the observed null tail.
    if ((!catalogue.complete || catalogue.nullInfoEnd) && previous) {
      let retainedMissing = false;
      for (const old of previous.library.playlists) {
        if (!playlists.some((playlist) => playlist.id === old.id)) {
          retainedMissing = true;
          if (catalogue.nullInfoEnd) retainedAfterNullTail.add(old.id);
          playlists.push({ ...old, complete: false, warnings: [...old.warnings, '本次云端目录未完整返回，暂时保留上次缓存。'] });
          if (previous.tracks[old.id]) tracks[old.id] = { ...previous.tracks[old.id], playlist: playlists[playlists.length - 1] };
        }
      }
      if (catalogue.complete && retainedMissing) {
        warnings.push('酷狗以空尾页结束目录，但本次未返回部分已缓存歌单，已保留，请再次刷新确认。');
      }
    }
    progress.stage = 'tracks';
    progress.totalPlaylists = playlists.length;
    for (let index = 0; index < playlists.length; index += 1) {
      this.assertGeneration(generation, signal);
      const playlist = playlists[index];
      progress.currentPlaylist = playlist.name;
      progress.message = `正在同步 ${playlist.name}（${index + 1}/${playlists.length}）…`;
      onProgress({ ...progress });
      try {
        if (retainedAfterNullTail.has(playlist.id)) {
          // A directory omission on this compatibility path is not a deletion.
          // Do not let an empty detail response discard its preserved songs.
          tracks[playlist.id] ||= { playlist, tracks: [] };
        } else {
          const fetched = await this.fetchPlaylist(playlist, account, client, signal);
          this.assertGeneration(generation, signal);
          const old = previous?.tracks[playlist.id];
          if (!fetched.playlist.complete && old) {
            this.retainCachedTracks(fetched, old);
          }
          tracks[playlist.id] = fetched;
          playlists[index] = fetched.playlist;
        }
      } catch (error) {
        this.assertGeneration(generation, signal);
        const old = previous?.tracks[playlist.id];
        const updated: KugouPlaylist = { ...playlist, complete: false, fetchedTrackCount: old?.tracks.length || 0, warnings: [cleanError(error)] };
        tracks[playlist.id] = { playlist: updated, tracks: old?.tracks || [] };
        playlists[index] = updated;
      }
      progress.completedPlaylists = index + 1;
      progress.fetchedTracks = Object.values(tracks).reduce((total, list) => total + list.tracks.length, 0);
      onProgress({ ...progress });
    }
    this.assertGeneration(generation, signal);
    const library: KugouLibrary = {
      profile: { ...account.profile }, playlists, syncedAt: Date.now(),
      complete: catalogue.complete && playlists.every((playlist) => playlist.complete) && warnings.length === 0,
      expectedPlaylistCount: catalogue.total, warnings
    };
    this.cache = { version: 1, userId: account.profile.userId, library, tracks };
    this.persistCache();
    onProgress({ ...progress, stage: 'finished', currentPlaylist: undefined, message: library.complete ? '全部云端歌单同步完成。' : '同步结束，部分数据需要再次刷新或确认。' });
    return library;
  }

  async playlistTracks(playlistId: string, refresh = false): Promise<KugouPlaylistTracks> {
    const account = this.requireAccount();
    const cached = this.cache?.tracks[playlistId];
    if (!cached) throw new KugouApiError('请先同步酷狗歌单，再打开歌曲列表。');
    if (!refresh) return cached;
    if (this.syncing) throw new KugouApiError('全部歌单正在同步，请完成后再刷新单个歌单。');
    const generation = this.generation;
    const controller = new AbortController();
    this.refreshControllers.add(controller);
    let fetched: KugouPlaylistTracks;
    try {
      fetched = await this.fetchPlaylist(cached.playlist, account, this.client, controller.signal);
      this.assertGeneration(generation, controller.signal);
    } finally {
      this.refreshControllers.delete(controller);
    }
    if (!fetched.playlist.complete) this.retainCachedTracks(fetched, cached);
    if (this.cache) {
      this.cache.tracks[playlistId] = fetched;
      this.cache.library.playlists = this.cache.library.playlists.map((p) => p.id === playlistId ? fetched.playlist : p);
      this.cache.library.complete = this.cache.library.warnings.length === 0 && this.cache.library.playlists.every((p) => p.complete);
      this.persistCache();
    }
    return fetched;
  }

  private async fetchPlaylist(playlist: KugouPlaylist, account: KugouAccount, client: KugouClient, signal?: AbortSignal): Promise<KugouPlaylistTracks> {
    const fetchSource = async (cloud: boolean) => paginateKugou({
      pageSize: cloud ? 300 : 100, maxPages: 10000, expectedTotal: playlist.trackCount, signal,
      identity: trackIdentity,
      fetchPage: async (page, pageSize) => trackPage(await client.request(cloud ? {
        path: '/v4/get_list_all_file_v3', router: 'cloudlist.service.kugou.com', credentials: account.credentials,
        data: {
          listid: playlist.listId, userid: account.credentials.userId, token: account.credentials.token,
          type: playlist.type, page, pagesize: pageSize, area_code: 1, allplatform: 1, show_cover: 1
        }, signal
      } : {
        path: '/pubsongs/v2/get_other_list_file_nofilt', credentials: account.credentials,
        params: {
          area_code: 1, begin_idx: (page - 1) * pageSize, plat: 1, type: 1, mode: 1,
          personal_switch: 1, extend_fields: 'abtags,hot_cmt,popularization', pagesize: pageSize,
          global_collection_id: playlist.globalCollectionId || ''
        }, signal
      }))
    });
    let result: Awaited<ReturnType<typeof fetchSource>> | undefined;
    let cloudFailure: string | undefined;
    if (playlist.listId) {
      try { result = await fetchSource(true); }
      catch (error) { if (signal?.aborted) throw error; cloudFailure = cleanError(error); }
    }
    const needsFallback = !result?.complete || result.rows.some((row) => normalizeTrack(row, 0).unavailable);
    if (playlist.globalCollectionId && needsFallback) {
      try {
        const fallback = await fetchSource(false);
        result = result ? mergeTrackSources(result, fallback) : fallback;
      } catch (error) {
        if (signal?.aborted) throw error;
        if (!result) throw new KugouApiError(cloudFailure || cleanError(error));
      }
    }
    if (!result) throw new KugouApiError(cloudFailure || '歌单没有可用的云端读取标识。');
    const normalized = result.rows.map(normalizeTrack);
    const unavailable = normalized.filter((track) => track.unavailable).length;
    const warnings = [...result.warnings];
    if (unavailable) warnings.push(`${unavailable} 首歌曲被酷狗隐藏或缺少有效标识，已保留占位，暂时无法播放。`);
    const updated: KugouPlaylist = {
      ...playlist,
      trackCount: result.total ?? playlist.trackCount,
      fetchedTrackCount: normalized.length,
      complete: result.complete && unavailable === 0,
      warnings
    };
    return { playlist: updated, tracks: normalized };
  }

  async songUrl(request: KugouSongUrlRequest): Promise<KugouSongUrl> {
    const hash = requireHash(request.hash);
    const albumId = numericId(request.albumId) || '0';
    const albumAudioId = numericId(request.albumAudioId) || '0';
    const quality = request.quality || '320';
    if (!['128', '320', 'flac', 'high'].includes(quality)) throw new KugouApiError('无效的酷狗音质选项。');
    const generation = this.generation;
    const client = this.client;
    const credentials = this.account?.credentials;
    const qualities = quality === 'flac' || quality === 'high' ? ['flac', '320', '128'] : (quality === '320' ? ['320', '128'] : ['128']);
    let lastError: unknown;
    for (const current of qualities) {
      this.assertGeneration(generation);
      const cacheKey = `${hash}:${albumId}:${albumAudioId}:${current}`;
      const cached = this.songCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) return cached.result;
      try {
        const lowerHash = hash.toLowerCase();
        const body = await client.request({
          path: '/v5/url', router: 'trackercdn.kugou.com', credentials,
          params: {
            album_id: albumId, area_code: 1, hash: lowerHash, ssa_flag: 'is_fromtrack', version: 11430,
            page_id: 151369488, quality: current, album_audio_id: albumAudioId, behavior: 'play',
            pid: 2, cmd: 26, pidversion: 3001, IsFreePart: 0, ppage_id: '463467626,350369493,788954147',
            cdnBackup: 1, module: '', clientver: 11430,
            key: md5(`${lowerHash}57ae12eb6890223e355ccfcb74edf70d${KugouProtocol.appId}${client.device.mid}${credentials?.userId || 0}`)
          }
        });
        this.assertGeneration(generation);
        const result = this.extractSongUrl(body);
        if (!result) throw new KugouApiError('酷狗未提供可播放的完整音频；可能需要账号权限或该歌曲暂不可用。');
        if (this.songCache.size > 300) this.songCache.clear();
        this.songCache.set(cacheKey, { result, expiresAt: Date.now() + 5 * 60 * 1000 });
        return result;
      } catch (error) {
        this.assertGeneration(generation);
        lastError = error;
      }
    }
    throw new KugouApiError(cleanError(lastError));
  }

  private extractSongUrl(body: JsonObject): KugouSongUrl | undefined {
    const candidates: JsonObject[] = [body, asObject(body.data)];
    if (Array.isArray(body.data)) candidates.push(...body.data.map(asObject));
    for (const item of [...candidates]) {
      candidates.push(asObject(item.info));
      if (Array.isArray(item.relate_goods)) {
        for (const related of item.relate_goods) {
          const object = asObject(related);
          candidates.push(object, asObject(object.info));
        }
      }
    }
    for (const item of candidates) {
      if (Number(item.is_free_part || item.isFreePart || 0) === 1) continue;
      const values: unknown[] = [];
      for (const key of ['url', 'urls', 'backup_url', 'backupUrl', 'tracker_url']) {
        if (Array.isArray(item[key])) values.push(...item[key] as unknown[]);
        else if (typeof item[key] === 'string') values.push(item[key]);
      }
      for (const candidate of values) {
        try {
          const url = new URL(text(candidate, 8192));
          if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) continue;
          if (!(url.hostname === 'kugou.com' || url.hostname.endsWith('.kugou.com') || url.hostname.endsWith('.kgimg.com'))) continue;
          if (/\.(?:mgg|kgm|vpr)(?:$|\?)/i.test(url.pathname)) continue;
          if ([...url.searchParams.keys()].some((key) => /^(?:token|userid|accesskey)$/i.test(key))) continue;
          url.protocol = 'https:';
          return { url: url.toString(), bitrate: count(item.bitrate ?? item.bitRate) };
        } catch { /* try next candidate */ }
      }
    }
    return undefined;
  }

  async lyrics(request: KugouLyricsRequest): Promise<KugouLyrics> {
    const hash = requireHash(request.hash);
    if (request.name !== undefined && (typeof request.name !== 'string' || request.name.length > 500)) throw new KugouApiError('无效的歌词查询名称。');
    const duration = request.durationMs ?? 0;
    if (!Number.isSafeInteger(duration) || duration < 0 || duration > 24 * 60 * 60 * 1000) throw new KugouApiError('无效的歌曲时长。');
    const search = await this.client.request({
      host: 'lyrics.kugou.com', path: '/v1/search', defaults: false,
      params: { album_audio_id: 0, appid: KugouProtocol.appId, clientver: KugouProtocol.clientVersion, duration, hash, keyword: request.name || '', lrctxt: 1, man: 'no' }
    });
    const data = asObject(search.data);
    const candidates = Array.isArray(search.candidates) ? search.candidates : (Array.isArray(data.candidates) ? data.candidates : []);
    const candidate = asObject(candidates[0]);
    const id = text(candidate.id, 100);
    const accessKey = text(candidate.accesskey, 200);
    if (!id || !accessKey) return { lyric: '' };
    const body = await this.client.request({
      host: 'lyrics.kugou.com', path: '/download',
      params: { ver: 1, client: 'android', id, accesskey: accessKey, fmt: 'lrc', charset: 'utf8' }
    });
    const content = text(body.content || asObject(body.data).content, 2 * 1024 * 1024);
    if (!/^[A-Za-z0-9+/=\r\n]*$/.test(content)) return { lyric: '' };
    return { lyric: Buffer.from(content, 'base64').toString('utf8') };
  }

  dispose(): void {
    this.generation += 1;
    this.syncController?.abort();
    this.abortRefreshes();
    this.cancelLogin();
    this.client.destroy();
  }

  private requireAccount(): KugouAccount {
    if (!this.account) throw new KugouApiError('请先用酷狗手机 App 扫码登录。');
    return this.account;
  }

  private abortRefreshes(): void {
    for (const controller of this.refreshControllers) controller.abort();
    this.refreshControllers.clear();
  }

  private retainCachedTracks(current: KugouPlaylistTracks, previous: KugouPlaylistTracks): void {
    const identifiers = new Set(current.tracks.map((track) => track.fileId ? `file:${track.fileId}` : track.id));
    let retained = 0;
    for (const track of previous.tracks) {
      const identity = track.fileId ? `file:${track.fileId}` : track.id;
      if (!identifiers.has(identity)) {
        current.tracks.push(track);
        identifiers.add(identity);
        retained += 1;
      }
    }
    current.playlist.fetchedTrackCount = current.tracks.length;
    if (retained) current.playlist.warnings.push(`本次数据不完整，另保留 ${retained} 首上次缓存歌曲。`);
  }

  private assertGeneration(generation: number, signal?: AbortSignal): void {
    if (this.generation !== generation || signal?.aborted) throw new KugouApiError('账号已切换或同步已取消。');
  }

  private persistCache(): void {
    if (!this.cache) return;
    try {
      if (!this.storage.saveCache(this.cache)) this.warning = '系统安全存储不可用，本次歌单未持久化。';
    } catch (error) {
      this.warning = cleanError(error);
      this.cache.library.warnings.push(this.warning);
      this.cache.library.complete = false;
    }
  }
}
