import type { KugouPage } from './protocol';
import { KugouApiError } from './protocol';

export interface KugouPaginationResult<T> {
  rows: T[];
  total?: number;
  complete: boolean;
  warnings: string[];
  pages: number;
  nullInfoEnd?: boolean;
}

export interface KugouPaginationOptions<T> {
  fetchPage: (page: number, pageSize: number) => Promise<KugouPage<T>>;
  identity: (row: T, index: number) => string;
  pageSize: number;
  maxPages?: number;
  /** A previous catalogue count is a hint, never a reason to stop reading. */
  expectedTotal?: number;
  signal?: AbortSignal;
  onPage?: (count: number, page: number) => void;
}

/** Fetch every page, retain partial results, and never silently call a truncated list complete. */
export async function paginateKugou<T>(options: KugouPaginationOptions<T>): Promise<KugouPaginationResult<T>> {
  const result: KugouPaginationResult<T> = { rows: [], complete: false, warnings: [], pages: 0 };
  const seen = new Set<string>();
  const fingerprints = new Set<string>();
  let total = options.expectedTotal;
  let responseTotal: number | undefined;
  let pageSize = options.pageSize;
  const maxPages = options.maxPages ?? 10000;
  let stopped = false;
  for (let page = 1; page <= maxPages; page += 1) {
    if (options.signal?.aborted) throw new KugouApiError('同步已取消。');
    let response: KugouPage<T>;
    try {
      response = await options.fetchPage(page, pageSize);
    } catch (error) {
      if (options.signal?.aborted) throw new KugouApiError('同步已取消。');
      if (page === 1) throw error;
      result.warnings.push(`第 ${page} 页读取失败，已保留前 ${result.rows.length} 项：${error instanceof KugouApiError ? error.message : '请求未完成。'}`);
      stopped = true;
      break;
    }
    result.pages = page;
    if (response.total !== undefined) {
      if (responseTotal !== undefined && responseTotal !== response.total) {
        result.warnings.push('同步期间云端数量发生变化，请再次刷新以确认最新完整列表。');
      }
      responseTotal = response.total;
      total = response.total;
    }
    // Respect a server-clamped page size on the following request.
    if (response.pageSize && response.pageSize < pageSize) pageSize = response.pageSize;
    if (!response.rows.length) {
      if (response.nullInfoEnd) result.nullInfoEnd = true;
      result.complete = total === undefined || result.rows.length >= total;
      if (!result.complete) result.warnings.push(`云端标示 ${total} 项，但分页提前结束，只读取到 ${result.rows.length} 项。`);
      stopped = true;
      break;
    }
    const keys = response.rows.map((row, index) => options.identity(row, (page - 1) * pageSize + index));
    const fingerprint = keys.join('\u0000');
    if (fingerprints.has(fingerprint)) {
      result.warnings.push('酷狗返回了重复页，已停止继续请求；无法确认列表是否完整。');
      stopped = true;
      break;
    }
    fingerprints.add(fingerprint);
    let newRows = 0;
    response.rows.forEach((row, index) => {
      if (!seen.has(keys[index])) {
        seen.add(keys[index]);
        result.rows.push(row);
        newRows += 1;
      }
    });
    options.onPage?.(result.rows.length, page);
    if (newRows === 0) {
      result.warnings.push('酷狗后续页面没有新增条目，已停止请求；无法确认列表是否完整。');
      stopped = true;
      break;
    }
    if (responseTotal !== undefined && result.rows.length >= responseTotal) {
      result.complete = result.rows.length === responseTotal;
      if (!result.complete) result.warnings.push(`云端标示 ${responseTotal} 项，实际返回 ${result.rows.length} 项，请重新刷新。`);
      stopped = true;
      break;
    }
    // Without a reliable cloud total, even a short page is followed by one more page.
    // This handles services that cap page size without advertising that cap.
  }
  if (!stopped) result.warnings.push(`分页超过 ${maxPages} 页保护上限，请稍后重新同步。`);
  if (result.warnings.length) result.complete = false;
  result.total = responseTotal ?? total;
  return result;
}
