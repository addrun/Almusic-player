import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import homeRouter from '@/router/home';
import { useSettingsStore } from '@/store/modules/settings';
import { isElectron } from '@/utils';

export const useMenuStore = defineStore('menu', () => {
  const allMenus = ref(homeRouter);
  const settingsStore = useSettingsStore();

  const menus = computed(() => {
    // 基础过滤：Electron 专属、侧边栏隐藏、移动端
    let filtered = allMenus.value.filter((item) => {
      if (item.meta?.electronOnly && !isElectron) {
        return false;
      }
      if (item.meta?.hideInSidebar) {
        return false;
      }
      if (settingsStore.isMobile) {
        return item.meta?.isMobile !== false;
      }
      return true;
    });

    // 应用用户自定义的隐藏项
    const hidden = settingsStore.setData?.sidebarItems?.hidden || [];
    if (hidden.length > 0) {
      filtered = filtered.filter((item) => !hidden.includes(item.path));
    }

    // 应用用户自定义的排序
    const order = settingsStore.setData?.sidebarItems?.order || [];
    if (order.length > 0) {
      filtered.sort((a, b) => {
        const indexA = order.indexOf(a.path);
        const indexB = order.indexOf(b.path);
        // 未在 order 中的项排在最后
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      });
    }

    return filtered;
  });

  const setMenus = (newMenus: any[]) => {
    allMenus.value = newMenus;
  };

  return {
    menus,
    setMenus
  };
});
