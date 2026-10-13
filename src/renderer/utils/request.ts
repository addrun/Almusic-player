import axios, { InternalAxiosRequestConfig } from 'axios';

import { useUserStore } from '@/store/modules/user';

import { getSetData, isElectron, isMobile } from '.';

let setData: any = null;

// 扩展请求配置接口
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  retryCount?: number;
  noRetry?: boolean;
}

/**
 * 检测 Capacitor 环境（Android/iOS 原生壳）
 * Capacitor 会在 window 上注入 Capacitor 对象
 */
function isCapacitor(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor;
}

/**
 * 计算 API baseURL
 * - Electron: 本地 Express 服务（netease-cloud-music-api）
 * - Capacitor: 远程 API（通过 VITE_API 环境变量配置）
 * - Web: VITE_API 环境变量
 */
function computeBaseURL(): string {
  if (window.electron) {
    // Electron: 本地 API 服务
    const port = setData?.musicApiPort || 30488;
    return `http://127.0.0.1:${port}`;
  }
  // 非 Electron（Web / Capacitor）: 使用环境变量
  const api = import.meta.env.VITE_API;
  if (api) return api;
  // 兜底：开发环境默认
  if (import.meta.env.DEV) return 'http://localhost:30488';
  // 生产环境无 API 地址时返回空字符串（请求会失败但不崩溃）
  console.warn('[request] VITE_API 未配置，非 Electron 环境下 API 请求将失败');
  return '';
}

const baseURL = computeBaseURL();

const request = axios.create({
  baseURL,
  timeout: 15000,
  withCredentials: true
});

// 最大重试次数
const MAX_RETRIES = 1;
// 重试延迟（毫秒）
const RETRY_DELAY = 500;

// 请求拦截器
request.interceptors.request.use(
  (config: CustomAxiosRequestConfig) => {
    try {
      setData = getSetData();
    } catch (e) {
      // 在 Pinia 未激活时（如 Axios 拦截器早期调用），使用空对象
      setData = setData || {};
    }
    config.baseURL = computeBaseURL();
    // 只在retryCount未定义时初始化为0
    if (config.retryCount === undefined) {
      config.retryCount = 0;
    }

    // 在请求发送之前做一些处理
    // 在get请求params中添加timestamp
    config.params = {
      ...config.params,
      timestamp: Date.now(),
      device: isElectron ? 'pc' : isMobile ? 'mobile' : isCapacitor() ? 'capacitor' : 'web'
    };
    const token = localStorage.getItem('token');
    if (token && config.method !== 'post') {
      config.params.cookie = config.params.cookie !== undefined ? config.params.cookie : token;
    } else if (token && config.method === 'post') {
      config.data = {
        ...config.data,
        cookie: token
      };
    }
    if (isElectron) {
      const proxyConfig = setData?.proxyConfig;
      if (proxyConfig?.enable && ['http', 'https'].includes(proxyConfig?.protocol)) {
        config.params.proxy = `${proxyConfig.protocol}://${proxyConfig.host}:${proxyConfig.port}`;
      }
      if (setData.enableRealIP && setData.realIP) {
        config.params.realIP = setData.realIP;
      }
    }

    return config;
  },
  (error) => {
    // 当请求异常时做一些处理
    return Promise.reject(error);
  }
);

const NO_RETRY_URLS = ['暂时没有'];

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    console.error('error', error);
    const config = error.config as CustomAxiosRequestConfig;

    // 如果没有配置，直接返回错误
    if (!config) {
      return Promise.reject(error);
    }

    // 处理 301 状态码
    if (error.response?.status === 301 && config.params.noLogin !== true) {
      // 使用 store mutation 清除用户信息
      const userStore = useUserStore();
      userStore.handleLogout();
      config.retryCount = 3;
    }

    // 检查是否还可以重试
    if (
      config.retryCount !== undefined &&
      config.retryCount < MAX_RETRIES &&
      !NO_RETRY_URLS.includes(config.url as string) &&
      !config.noRetry
    ) {
      config.retryCount++;
      console.error(`请求重试第 ${config.retryCount} 次`);

      // 延迟重试
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));

      // 重新发起请求
      return request(config);
    }

    console.error(`重试${MAX_RETRIES}次后仍然失败`);
    return Promise.reject(error);
  }
);

export default request;
