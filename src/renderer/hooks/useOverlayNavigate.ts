import { useRouter } from 'vue-router';

import { useSettingsStore } from '@/store/modules/settings';
import { useWindowStore } from '@/store/modules/windowStore';

/**
 * 智能导航 hook
 *
 * 在浮动覆盖（overlay）布局模式下，页面内容通过浮动面板渲染而非 <router-view>，
 * 因此需要同时调用 router.push（更新路由参数供 useRoute() 读取）和 windowStore.openPanel（渲染面板）。
 * 在经典布局模式下，仅需 router.push 即可。
 */
export function useOverlayNavigate() {
  const router = useRouter();
  const settingsStore = useSettingsStore();
  const windowStore = useWindowStore();

  const isOverlayMode = () =>
    settingsStore.setData?.layoutMode === 'overlay' && !settingsStore.isMobile;

  /**
   * 智能导航
   * @param path 完整路径（含查询参数），如 /music-list/123?type=playlist
   * @param y 面板 Y 坐标（overlay 模式下使用）
   * @param title 面板标题（overlay 模式下使用）
   */
  const navigate = (path: string, y: number = 60, title?: string) => {
    router.push(path);
    if (isOverlayMode()) {
      windowStore.openPanel(path, y, title);
    }
  };

  return { navigate, isOverlayMode };
}
