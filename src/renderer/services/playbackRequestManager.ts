/**
 * 播放请求管理器
 * 负责管理播放请求的队列、取消、状态跟踪，防止竞态条件
 */

import type { SongResult } from '@/types/music';

/**
 * 请求状态枚举
 */
export enum RequestStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FAILED = 'failed'
}

/**
 * 播放请求接口
 */
export interface PlaybackRequest {
  id: string;
  song: SongResult;
  status: RequestStatus;
  timestamp: number;
  abortController?: AbortController;
}

/**
 * 播放请求管理器类
 */
class PlaybackRequestManager {
  private currentRequestId: string | null = null;
  private requestMap: Map<string, PlaybackRequest> = new Map();
  private requestCounter = 0;

  /**
   * 生成唯一的请求ID
   */
  private generateRequestId(): string {
    return `playback_${Date.now()}_${++this.requestCounter}`;
  }

  /**
   * 创建新的播放请求
   * @param song 要播放的歌曲
   * @returns 新请求的ID
   */
  createRequest(song: SongResult): string {
    // 取消所有之前的请求
    this.cancelAllRequests();

    const requestId = this.generateRequestId();
    const abortController = new AbortController();

    const request: PlaybackRequest = {
      id: requestId,
      song,
      status: RequestStatus.PENDING,
      timestamp: Date.now(),
      abortController
    };

    this.requestMap.set(requestId, request);
    this.currentRequestId = requestId;


    return requestId;
  }

  /**
   * 激活请求（标记为正在处理）
   * @param requestId 请求ID
   */
  activateRequest(requestId: string): boolean {
    const request = this.requestMap.get(requestId);
    if (!request) {
      console.warn(`[PlaybackRequestManager] 请求不存在: ${requestId}`);
      return false;
    }

    if (request.status === RequestStatus.CANCELLED) {
      console.warn(`[PlaybackRequestManager] 请求已被取消: ${requestId}`);
      return false;
    }

    request.status = RequestStatus.ACTIVE;
    return true;
  }

  /**
   * 完成请求
   * @param requestId 请求ID
   */
  completeRequest(requestId: string): void {
    const request = this.requestMap.get(requestId);
    if (!request) {
      return;
    }

    request.status = RequestStatus.COMPLETED;

    // 清理旧请求（保留最近3个）
    this.cleanupOldRequests();
  }

  /**
   * 标记请求失败
   * @param requestId 请求ID
   */
  failRequest(requestId: string): void {
    const request = this.requestMap.get(requestId);
    if (!request) {
      return;
    }

    request.status = RequestStatus.FAILED;
  }

  /**
   * 取消指定请求
   * @param requestId 请求ID
   */
  cancelRequest(requestId: string): void {
    const request = this.requestMap.get(requestId);
    if (!request) {
      return;
    }

    if (request.status === RequestStatus.CANCELLED) {
      return;
    }

    // 取消AbortController
    if (request.abortController && !request.abortController.signal.aborted) {
      request.abortController.abort();
    }

    request.status = RequestStatus.CANCELLED;

    // 如果是当前请求，清除当前请求ID
    if (this.currentRequestId === requestId) {
      this.currentRequestId = null;
    }
  }

  /**
   * 取消所有请求
   */
  cancelAllRequests(): void {

    this.requestMap.forEach((request) => {
      if (
        request.status !== RequestStatus.COMPLETED &&
        request.status !== RequestStatus.CANCELLED
      ) {
        this.cancelRequest(request.id);
      }
    });
  }

  /**
   * 检查请求是否仍然有效（是当前活动请求）
   * @param requestId 请求ID
   * @returns 是否有效
   */
  isRequestValid(requestId: string): boolean {
    // 检查是否是当前请求
    if (this.currentRequestId !== requestId) {
      console.warn(
        `[PlaybackRequestManager] 请求已过期: ${requestId}, 当前请求: ${this.currentRequestId}`
      );
      return false;
    }

    const request = this.requestMap.get(requestId);
    if (!request) {
      console.warn(`[PlaybackRequestManager] 请求不存在: ${requestId}`);
      return false;
    }

    // 检查请求状态
    if (request.status === RequestStatus.CANCELLED) {
      console.warn(`[PlaybackRequestManager] 请求已被取消: ${requestId}`);
      return false;
    }

    return true;
  }

  /**
   * 检查请求是否应该中止（用于 AbortController）
   * @param requestId 请求ID
   * @returns AbortSignal 或 undefined
   */
  getAbortSignal(requestId: string): AbortSignal | undefined {
    const request = this.requestMap.get(requestId);
    return request?.abortController?.signal;
  }

  /**
   * 获取当前请求ID
   */
  getCurrentRequestId(): string | null {
    return this.currentRequestId;
  }

  /**
   * 获取请求信息
   * @param requestId 请求ID
   */
  getRequest(requestId: string): PlaybackRequest | undefined {
    return this.requestMap.get(requestId);
  }

  /**
   * 清理旧请求（保留最近3个）
   */
  private cleanupOldRequests(): void {
    if (this.requestMap.size <= 3) {
      return;
    }

    // 按时间戳排序，保留最新的3个
    const sortedRequests = Array.from(this.requestMap.values()).sort(
      (a, b) => b.timestamp - a.timestamp
    );

    const toKeep = new Set(sortedRequests.slice(0, 3).map((r) => r.id));
    const toDelete: string[] = [];

    this.requestMap.forEach((_, id) => {
      if (!toKeep.has(id)) {
        toDelete.push(id);
      }
    });

    toDelete.forEach((id) => {
      this.requestMap.delete(id);
    });

    if (toDelete.length > 0) {
    }
  }

  /**
   * 重置管理器（用于调试或特殊情况）
   */
  reset(): void {
    this.cancelAllRequests();
    this.requestMap.clear();
    this.currentRequestId = null;
    this.requestCounter = 0;
  }

  /**
   * 获取调试信息
   */
  getDebugInfo(): {
    currentRequestId: string | null;
    totalRequests: number;
    requestsByStatus: Record<string, number>;
  } {
    const requestsByStatus: Record<string, number> = {
      [RequestStatus.PENDING]: 0,
      [RequestStatus.ACTIVE]: 0,
      [RequestStatus.COMPLETED]: 0,
      [RequestStatus.CANCELLED]: 0,
      [RequestStatus.FAILED]: 0
    };

    this.requestMap.forEach((request) => {
      requestsByStatus[request.status]++;
    });

    return {
      currentRequestId: this.currentRequestId,
      totalRequests: this.requestMap.size,
      requestsByStatus
    };
  }
}

// 导出单例实例
export const playbackRequestManager = new PlaybackRequestManager();
