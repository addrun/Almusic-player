import { defineStore } from 'pinia';
import { ref } from 'vue';

import homeRouter from '@/router/home';
import otherRouter from '@/router/other';

const allRoutes = [...homeRouter, ...otherRouter];
function findRoute(path: string) {
  // 去除查询参数
  const basePath = path.split('?')[0];
  // 先尝试精确匹配
  let route = allRoutes.find((r) => r.path === basePath);
  if (route) return route;
  // 动态路由匹配（如 /music-list/:id? /artist/detail/:id）
  route = allRoutes.find((r) => {
    if (!r.path.includes(':')) return false;
    const pattern = r.path
      .replace(/:\w+\?/g, '([^/]+)') // 可选参数
      .replace(/:\w+/g, '([^/]+)'); // 必需参数
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(basePath);
  });
  return route;
}

export const useWindowStore = defineStore('windowStore', () => {
  // 当前激活的面板路径（null = 无面板）
  const activePath = ref<string | null>(null);
  // 面板的 Y 坐标（从触发按钮的位置计算）
  const panelY = ref(0);
  // 面板标题
  const panelTitle = ref('');
  // 面板组件加载函数
  const panelComponent = ref<(() => Promise<any>) | null>(null);
  // 唯一递增 key，用于强制重新挂载组件
  const panelKey = ref(0);

  // 打开面板（同一时间只有一个）
  const openPanel = (path: string, y: number = 0, title?: string) => {
    const route = findRoute(path);
    if (!route) return false;

    // 如果点击的是当前已打开的面板，则关闭它
    if (activePath.value === path) {
      closePanel();
      return true;
    }

    activePath.value = path;
    panelY.value = y;
    panelTitle.value = title || (route.meta?.title as string) || path;
    panelComponent.value = route.component as () => Promise<any>;
    panelKey.value++;
    return true;
  };

  const closePanel = () => {
    activePath.value = null;
    panelComponent.value = null;
    panelTitle.value = '';
  };

  return {
    activePath,
    panelY,
    panelTitle,
    panelComponent,
    panelKey,
    openPanel,
    closePanel
  };
});
