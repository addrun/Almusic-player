import axios from 'axios';
import { get } from 'lodash';

import { useSettingsStore } from '@/store';

import type { ParsedMusicResult } from './gdmusic';

/**
 * 定义自定义API JSON插件的结构
 */
interface CustomApiPlugin {
  name: string;
  apiUrl: string;
  method?: 'GET' | 'POST';
  params: Record<string, string>;
  qualityMapping?: Record<string, string>;
  responseUrlPath: string;
}

/**
 * 从用户导入的自定义API JSON配置中解析音乐URL
 */
export const parseFromCustomApi = async (
  id: number,
  _songData: any,
  quality: string = 'higher',
  timeout: number = 10000
): Promise<ParsedMusicResult | null> => {
  const settingsStore = useSettingsStore();
  const pluginString = settingsStore.setData.customApiPlugin;

  if (!pluginString) {
    return null;
  }

  let plugin: CustomApiPlugin;
  try {
    plugin = JSON.parse(pluginString);
    if (!plugin.apiUrl || !plugin.params || !plugin.responseUrlPath) {
      console.error('自定义API：JSON配置文件格式不正确。');
      return null;
    }
  } catch (error) {
    console.error('自定义API：解析JSON配置文件失败。', error);
    return null;
  }


  try {
    // 1. 准备请求参数，替换占位符
    const finalParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(plugin.params)) {
      if (value === '{songId}') {
        finalParams[key] = String(id);
      } else if (value === '{quality}') {
        // 使用 qualityMapping (如果存在) 进行音质翻译，否则直接使用原quality
        finalParams[key] = plugin.qualityMapping?.[quality] ?? quality;
      } else {
        // 固定值参数
        finalParams[key] = value;
      }
    }

    // 2. 判断请求方法，默认为GET
    const method = plugin.method?.toUpperCase() === 'POST' ? 'POST' : 'GET';
    let response;

    // 3. 根据方法发送不同的请求
    if (method === 'POST') {
      response = await axios.post(plugin.apiUrl, finalParams, { timeout });
    } else {
      // 默认为 GET
      const finalUrl = `${plugin.apiUrl}?${new URLSearchParams(finalParams).toString()}`;
      response = await axios.get(finalUrl, { timeout });
    }

    // 4. 使用 lodash.get 安全地从响应数据中提取URL
    const musicUrl = get(response.data, plugin.responseUrlPath);

    if (musicUrl && typeof musicUrl === 'string') {
      // 5. 组装成应用所需的标准格式并返回
      return {
        data: {
          data: {
            url: musicUrl,
            br: parseInt(quality) * 1000,
            size: 0,
            md5: '',
            platform: plugin.name.toLowerCase().replace(/\s/g, ''),
            gain: 0
          },
          params: { id, type: 'song' }
        }
      };
    } else {
      console.error('自定义API：根据路径未能从响应中找到URL:', plugin.responseUrlPath);
      return null;
    }
  } catch (error) {
    console.error(`自定义API [${plugin.name}] 执行失败:`, error);
    return null;
  }
};
