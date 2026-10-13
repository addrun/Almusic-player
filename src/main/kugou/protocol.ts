import { createHash, randomBytes } from 'node:crypto';
import { Agent, request as httpsRequest } from 'node:https';

import type { KugouPlaylist, KugouTrack } from '../../shared/kugou';

// Protocol constants follow MakcRe/KuGouMusicApi (MIT), revision
// ba3645f2c89e6b9d4fec82ff783c15287e4c5f43. Only read-only endpoints are exposed.
// Native HTTPS keeps certificate validation enabled independently of Chromium switches.
const APP_ID = 1005;
const CLIENT_VERSION = 20489;
const ANDROID_SALT = 'OIlwieks28dk2k092lksi2UIkp';
const WEB_SALT = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt';
const HOSTS = new Set(['gateway.kugou.com', 'login-user.kugou.com', 'lyrics.kugou.com']);
const RESPONSE_LIMIT = 16 * 1024 * 1024;

export type JsonObject = Record<string, unknown>;

export interface KugouDevice {
  mid: string;
  dev: string;
  dfid: string;
}

export interface KugouCredentials {
  userId: string;
  token: string;
  device: KugouDevice;
}

export class KugouApiError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly retryable = false
  ) {
    super(message);
    this.name = 'KugouApiError';
  }
}

export function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

export function text(value: unknown, limit = 1000): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).slice(0, limit)
    : '';
}

export function count(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : undefined;
}

export function md5(value: string): string {
  return createHash('md5').update(value).digest('hex');
}

export function createDevice(): KugouDevice {
  // Random application-local identifiers; no hardware IDs or local-client data are read.
  return {
    mid: BigInt(`0x${md5(randomBytes(16).toString('hex'))}`).toString(),
    dev: randomBytes(5).toString('hex').toUpperCase(),
    dfid: '-'
  };
}

export function imageUrl(value: unknown): string | undefined {
  let candidate = text(value, 2048).replace(/\{size\}/g, '480');
  if (!candidate) return undefined;
  if (/^(?:custom|stdmusic|softhead|uploadpic)\//.test(candidate)) {
    candidate = `https://imge.kugou.com/${candidate}`;
  }
  try {
    const url = new URL(candidate);
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      !(url.hostname === 'kugou.com' || url.hostname.endsWith('.kugou.com')) ||
      url.username ||
      url.password
    ) return undefined;
    url.protocol = 'https:';
    return url.toString();
  } catch {
    return undefined;
  }
}

export interface KugouPage<T> {
  rows: T[];
  total?: number;
  pageSize?: number;
  /** Observed successful directory tail; retain missing cached playlists until confirmed. */
  nullInfoEnd?: boolean;
}

function rowsFrom(data: unknown, names: string[]): unknown[] | undefined {
  if (Array.isArray(data)) return data;
  const obj = asObject(data);
  for (const key of names) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
  }
  return undefined;
}

function responseValueType(value: unknown): string {
  if (value === undefined) return 'missing';
  if (value === null) return 'null';
  return Array.isArray(value) ? 'array' : typeof value;
}

/** Only allowlisted schema labels and bounded numeric status codes may leave the protocol layer. */
function catalogueShapeDiagnostic(body: JsonObject): string {
  const statusFields = ['status', 'error_code', 'errcode', '_errno'].map((field) => {
    const value = body[field];
    const code = (typeof value === 'number' && Number.isSafeInteger(value) && Math.abs(value) <= 2147483647)
      || (typeof value === 'string' && /^-?\d{1,9}$/.test(value));
    return `${field}=${code ? String(value) : responseValueType(value)}`;
  });
  const data = asObject(body.data);
  const fields = ['info', 'lists', 'list', 'total', 'total_count', 'count', 'pagesize', 'page', 'total_ver']
    .filter((field) => Object.prototype.hasOwnProperty.call(data, field))
    .map((field) => `${field}:${responseValueType(data[field])}`);
  return `响应结构：${statusFields.join('；')}；data=${responseValueType(body.data)}；目录字段=${fields.join(',') || '无'}`;
}

export function playlistPage(body: JsonObject, userId: string, page = 1): KugouPage<KugouPlaylist> {
  const data = asObject(body.data);
  const rows = rowsFrom(body.data, ['info', 'lists', 'list']);
  if (!rows) {
    // The account's page-2 response is successful but uses info:null for its tail.
    // Do not generalize this to first-page emptiness, missing fields, API failures,
    // alternate malformed lists or contradictory counts. total_ver is a revision.
    const own = (key: string) => Object.prototype.hasOwnProperty.call(data, key);
    const successTail = Number.isSafeInteger(page) && page > 1 &&
      ['status', 'error_code'].every((key) => Object.prototype.hasOwnProperty.call(body, key)) &&
      body.status === 1 && body.error_code === 0 &&
      ['errcode', '_errno'].every((key) => body[key] === undefined || body[key] === 0) &&
      own('info') && data.info === null &&
      own('total_ver') && typeof data.total_ver === 'number' &&
      Number.isSafeInteger(data.total_ver) && data.total_ver >= 0 &&
      ['lists', 'list', 'total', 'total_count', 'count'].every((key) => !own(key));
    if (successTail) return { rows: [], nullInfoEnd: true };
    throw new KugouApiError(`酷狗返回了无法识别的歌单目录，已保留原有缓存。（${catalogueShapeDiagnostic(body)}）`);
  }
  const result: KugouPlaylist[] = [];
  for (const row of rows) {
    const obj = asObject(row);
    if (Number(obj.is_drop) === 1) continue;
    const listId = text(obj.listid, 120);
    const globalId = text(obj.global_collection_id || obj.list_create_gid, 120);
    const safeListId = /^\d{1,20}$/.test(listId) ? listId : '';
    const safeGlobalId = /^[a-zA-Z0-9_-]{1,120}$/.test(globalId) ? globalId : undefined;
    if (!safeListId && !safeGlobalId) {
      throw new KugouApiError('酷狗歌单缺少有效标识，无法确认目录完整性。');
    }
    const ownerId = text(obj.list_create_userid || obj.userid, 20);
    const type: 0 | 1 = obj.type !== undefined
      ? (Number(obj.type) === 1 ? 1 : 0)
      : (ownerId && ownerId !== userId ? 1 : 0);
    const name = text(obj.name || obj.specialname, 300) || '未命名歌单';
    const liked = ['我喜欢', '我喜欢的音乐', '我喜欢的歌曲'].includes(name.trim());
    result.push({
      id: `${type}:${safeListId || safeGlobalId}`,
      listId: safeListId,
      type,
      globalCollectionId: safeGlobalId,
      name,
      coverUrl: imageUrl(obj.pic || obj.cover || obj.flexible_cover),
      category: liked ? 'liked' : (type === 1 || (ownerId && ownerId !== userId) ? 'collected' : 'created'),
      ownerName: text(obj.list_create_username || obj.username, 100) || undefined,
      trackCount: count(obj.count ?? obj.song_count ?? obj.total),
      fetchedTrackCount: 0,
      complete: false,
      warnings: []
    });
  }
  return {
    rows: result,
    total: count(data.total ?? data.total_count ?? data.count),
    pageSize: count(data.pagesize)
  };
}

export function trackPage(body: JsonObject): KugouPage<JsonObject> {
  const data = asObject(body.data);
  const info = asObject(data.info);
  const listInfo = asObject(data.list_info);
  const rows = rowsFrom(body.data, ['songs', 'files', 'list', 'info']);
  if (!rows) throw new KugouApiError('酷狗返回了无法识别的歌曲列表，不能确认歌曲已全部同步。');
  return {
    rows: rows.map(asObject),
    total: count(data.count ?? data.total ?? data.total_count ?? listInfo.count ?? info.count),
    pageSize: count(data.pagesize)
  };
}

export function trackIdentity(row: JsonObject, index: number): string {
  const fileId = text(row.fileid);
  if (/^\d+$/.test(fileId) && !/^0+$/.test(fileId)) return `file:${fileId}`;
  const hash = text(row.hash || row.FileHash).toUpperCase();
  return /^[a-fA-F0-9]{32}$/.test(hash)
    ? `hash:${hash}:${text(row.sort)}`
    : `missing:${text(row.sort) || index}`;
}

/** Only collecttime is observed on these playlist entries; do not guess from publish dates. */
export function collectionTimeMs(value: unknown): number | undefined {
  if (typeof value !== 'number' && !(typeof value === 'string' && /^\d+$/.test(value))) return undefined;
  const timestamp = Number(value);
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) return undefined;
  // Accept Unix seconds or milliseconds. A plausible playlist-era range also
  // rejects zero, relative times, YYYYMMDD integers and corrupt remote values.
  const milliseconds = timestamp < 100000000000 ? timestamp * 1000 : timestamp;
  return milliseconds >= Date.UTC(2000, 0, 1) && milliseconds < Date.UTC(2100, 0, 1)
    ? milliseconds
    : undefined;
}

export function normalizeTrack(row: JsonObject, index: number): KugouTrack {
  const hash = text(row.hash || row.FileHash, 32).toUpperCase();
  const validHash = /^[a-fA-F0-9]{32}$/.test(hash) ? hash : '';
  const fullName = text(row.name || row.filename || row.FileName || row.songname, 500);
  const separator = fullName.indexOf(' - ');
  const parsedSinger = separator >= 0 ? fullName.slice(0, separator) : '';
  const parsedName = separator >= 0 ? fullName.slice(separator + 3) : fullName;
  const album = asObject(row.albuminfo || row.album_info);
  const singerInfo = Array.isArray(row.singerinfo) ? row.singerinfo : [];
  const artists = singerInfo.map((value) => {
    const singer = asObject(value);
    return { id: text(singer.id, 20) || undefined, name: text(singer.name, 200) };
  }).filter((singer) => !!singer.name);
  if (!artists.length && (row.singername || parsedSinger)) {
    artists.push({ id: undefined, name: text(row.singername || parsedSinger, 200) });
  }
  const rawFileId = text(row.fileid, 20);
  const fileId = /^\d{1,20}$/.test(rawFileId) && !/^0+$/.test(rawFileId) ? rawFileId : undefined;
  const unavailable = !validHash || Number(row.shield) === 1;
  const seconds = count(row.duration ?? row.Duration);
  return {
    id: validHash || `unavailable_${fileId || index}`,
    hash: validHash,
    name: text(row.songname || row.song_name, 300) || parsedName || `暂不可用歌曲${fileId ? `（编号 ${fileId}）` : ''}`,
    artists,
    albumId: text(row.album_id || album.id || row.AlbumID, 20) || undefined,
    albumName: text(album.name || row.albumname || row.AlbumName, 300),
    coverUrl: imageUrl(row.cover || asObject(row.trans_param).union_cover || row.img),
    durationMs: count(row.timelen ?? row.time_length ?? row.DurationMs) ?? (seconds === undefined ? 0 : seconds * 1000),
    albumAudioId: text(row.album_audio_id || row.mixsongid || row.add_mixsongid, 20) || undefined,
    fileId,
    addedAtMs: collectionTimeMs(row.collecttime),
    // No verified personal play-count field exists in the playlist protocol.
    // In particular heat, number, playcount and counts on shared lists must not
    // be interpreted as this account's listening history.
    unavailable
  };
}

interface RequestOptions {
  host?: string;
  path: string;
  params?: Record<string, string | number>;
  data?: JsonObject;
  router?: string;
  web?: boolean;
  credentials?: KugouCredentials;
  defaults?: boolean;
  signal?: AbortSignal;
}

export class KugouClient {
  private readonly agent = new Agent({ keepAlive: true, rejectUnauthorized: true, maxSockets: 4 });
  private destroyed = false;

  constructor(public readonly device: KugouDevice) {}

  destroy(): void {
    this.destroyed = true;
    this.agent.destroy();
  }

  async request(options: RequestOptions): Promise<JsonObject> {
    if (this.destroyed) throw new KugouApiError('酷狗请求已取消。');
    const host = options.host || 'gateway.kugou.com';
    if (!HOSTS.has(host) || !options.path.startsWith('/')) {
      throw new KugouApiError('无效的酷狗服务地址。');
    }
    const device = options.credentials?.device || this.device;
    const clientTime = Math.floor(Date.now() / 1000);
    const params: Record<string, string | number> = options.defaults === false ? {} : {
      dfid: device.dfid,
      mid: device.mid,
      uuid: '-',
      appid: APP_ID,
      clientver: CLIENT_VERSION,
      clienttime: clientTime
    };
    if (options.credentials) {
      params.userid = options.credentials.userId;
      params.token = options.credentials.token;
    }
    Object.assign(params, options.params || {});
    const payload = options.data ? JSON.stringify(options.data) : '';
    const salt = options.web ? WEB_SALT : ANDROID_SALT;
    const serialized = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join('');
    params.signature = md5(`${salt}${serialized}${payload}${salt}`);
    const url = new URL(`https://${host}${options.path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));

    for (let attempt = 0; ; attempt += 1) {
      if (this.destroyed) throw new KugouApiError('酷狗请求已取消。');
      try {
        return await this.fetch(url, payload, options, device);
      } catch (error) {
        if (this.destroyed || !(error instanceof KugouApiError) || !error.retryable || attempt >= 2 || options.signal?.aborted) throw error;
        await new Promise<void>((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
      }
    }
  }

  private fetch(url: URL, payload: string, options: RequestOptions, device: KugouDevice): Promise<JsonObject> {
    return new Promise((resolve, reject) => {
      if (this.destroyed || options.signal?.aborted) {
        reject(new KugouApiError('同步已取消。'));
        return;
      }
      const body = Buffer.from(payload, 'utf8');
      const headers: Record<string, string> = {
        'User-Agent': 'Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi',
        dfid: device.dfid,
        mid: device.mid,
        clienttime: url.searchParams.get('clienttime') || String(Math.floor(Date.now() / 1000)),
        'kg-rc': '1',
        'kg-thash': '5d816a0',
        'kg-rec': '1',
        'kg-rf': 'B9EDA08A64250DEFFBCADDEE00F8F25F'
      };
      if (options.router) headers['x-router'] = options.router;
      if (payload) {
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = String(body.length);
      }
      const req = httpsRequest(url, {
        method: payload ? 'POST' : 'GET',
        headers,
        agent: this.agent,
        rejectUnauthorized: true,
        signal: options.signal
      }, (res) => {
        if ((res.statusCode || 500) >= 400) {
          res.resume();
          reject(new KugouApiError(`酷狗服务请求失败（HTTP ${res.statusCode || 500}）。`, undefined, (res.statusCode || 500) >= 500));
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new KugouApiError('酷狗服务返回了非预期响应。'));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > RESPONSE_LIMIT) {
            req.destroy(new Error('response too large'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('error', () => reject(new KugouApiError('读取酷狗服务响应失败，请稍后重试。', undefined, true)));
        res.on('end', () => {
          try {
            const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            const data = asObject(parsed);
            const code = Number(data.error_code || data.errcode || data._errno || 0);
            // The lyric search endpoint uses status=200/errcode=200 for success.
            const lyricSuccess = url.hostname === 'lyrics.kugou.com' && data.status === 200 && code === 200;
            if (data.status === 0 || (code !== 0 && !lyricSuccess)) {
              const authError = [20010, 20018, 20019, 20020].includes(code);
              reject(new KugouApiError(
                authError ? `酷狗登录凭据失效或校验未通过，请重新扫码（错误码 ${code}）。` : `酷狗接口未完成请求${code ? `（错误码 ${code}）` : ''}。`,
                code || undefined
              ));
              return;
            }
            if (res.headers['ssa-code']) {
              reject(new KugouApiError('酷狗要求额外安全验证，请在官方客户端确认后重新扫码登录。'));
              return;
            }
            resolve(data);
          } catch {
            reject(new KugouApiError('酷狗服务返回了无法识别的响应。'));
          }
        });
      });
      const deadline = setTimeout(() => req.destroy(new Error('request timeout')), 25000);
      req.once('close', () => clearTimeout(deadline));
      // Do not propagate native errors: they may contain request URLs and login tokens.
      req.on('error', () => reject(new KugouApiError(
        options.signal?.aborted ? '同步已取消。' : '无法连接酷狗服务，请检查网络后重试。',
        undefined,
        !options.signal?.aborted
      )));
      if (payload) req.write(body);
      req.end();
    });
  }
}

export const KugouProtocol = { appId: APP_ID, clientVersion: CLIENT_VERSION };
