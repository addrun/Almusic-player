<template>
  <div class="fs-zone" @mouseenter="handleZoneEnter" @mouseleave="handleZoneLeave">
    <div
      class="floating-sidebar"
      :class="{
        'fs-expanded': isExpanded,
        'fs-offscreen': isOffscreen
      }"
    >
      <!-- Logo / 样式切换 -->
      <div class="fs-header" @click="toggleExpand">
        <img :src="icon" class="fs-logo" alt="Almusic" />
      </div>

      <!-- 菜单列表 -->
      <div class="fs-list">
        <div v-for="(item, index) in menus" :key="item.path" class="fs-item">
          <n-tooltip :delay="200" :disabled="isExpanded" placement="right">
            <template #trigger>
              <div
                class="fs-item-link"
                :class="{ 'fs-item-active': isActive(item.path) }"
                @click="openPage($event, item)"
              >
                <i
                  class="iconfont fs-item-icon"
                  :style="iconStyle(index)"
                  :class="item.meta.icon"
                ></i>
                <span
                  v-if="isExpanded"
                  class="fs-item-text"
                  :class="isActive(item.path) ? 'fs-text-active' : ''"
                  >{{ t(item.meta.title) }}</span
                >
              </div>
            </template>
            <div>{{ t(item.meta.title) }}</div>
          </n-tooltip>

          <!-- 歌单子菜单 -->
          <div v-if="isMenuItemPlaylist(item)" class="fs-submenu">
            <div class="fs-submenu-scroll">
              <template v-if="createdPlaylists.length > 0">
                <div
                  v-for="pl in createdPlaylists"
                  :key="'c-' + pl.id"
                  class="fs-submenu-row"
                  @click="navigateToPlaylist(pl.id)"
                >
                  <img :src="getImgUrl(pl.coverImgUrl, '64y64')" class="fs-submenu-cover" />
                  <span v-show="isExpanded" class="fs-submenu-name">{{ pl.name }}</span>
                </div>
              </template>
              <template v-if="collectedPlaylists.length > 0">
                <div
                  v-for="pl in collectedPlaylists"
                  :key="'d-' + pl.id"
                  class="fs-submenu-row"
                  @click="navigateToPlaylist(pl.id)"
                >
                  <img :src="getImgUrl(pl.coverImgUrl, '64y64')" class="fs-submenu-cover" />
                  <span v-show="isExpanded" class="fs-submenu-name">{{ pl.name }}</span>
                </div>
              </template>
              <template v-if="collectedAlbums.length > 0">
                <div
                  v-for="al in collectedAlbums"
                  :key="'a-' + al.id"
                  class="fs-submenu-row"
                  @click="navigateToAlbum(al.id)"
                >
                  <img
                    :src="getImgUrl(al.picUrl || al.blurPicUrl, '64y64')"
                    class="fs-submenu-cover"
                  />
                  <span v-show="isExpanded" class="fs-submenu-name">{{ al.name }}</span>
                </div>
              </template>
              <div
                v-if="
                  createdPlaylists.length === 0 &&
                  collectedPlaylists.length === 0 &&
                  collectedAlbums.length === 0
                "
                class="fs-submenu-empty"
              >
                暂无歌单
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import icon from '@/assets/brand-logo.svg';
import { useCoverColor } from '@/hooks/useCoverColor';
import { useOverlayNavigate } from '@/hooks/useOverlayNavigate';
import { useSettingsStore, useUserStore } from '@/store';
import { useWindowStore } from '@/store/modules/windowStore';
import { getImgUrl } from '@/utils';

const props = defineProps({
  menus: { type: Array as any, default: () => [] },
  size: { type: String, default: '22px' },
  color: { type: String, default: '#888' },
  selectColor: { type: String, default: undefined }
});

const route = useRoute();
const router = useRouter();
const settingsStore = useSettingsStore();
const userStore = useUserStore();
const windowStore = useWindowStore();
const { primaryColor } = useCoverColor();
const { t } = useI18n();

// Hover expands temporarily; the logo controls the saved pinned state.
const isExpanded = computed(() => settingsStore.isSidebarExpanded);

const toggleExpand = () => {
  settingsStore.setSetData({ isMenuExpanded: !settingsStore.setData.isMenuExpanded });
};

// ==================== 自动收起 = 移出屏幕 ====================
const isOffscreen = ref(false);
let offscreenTimer: ReturnType<typeof setTimeout> | null = null;

const getAutoCollapseDelay = () => {
  return (settingsStore.setData?.overlayAutoCollapseDelay || 5) * 1000;
};

const isAutoCollapseEnabled = () => {
  return settingsStore.setData?.overlayAutoCollapse !== false;
};

const startOffscreenTimer = () => {
  if (!isAutoCollapseEnabled()) return;
  // 有悬浮面板打开时不收起
  if (windowStore.activePath || settingsStore.sidebarHovered) return;
  cancelOffscreenTimer();
  offscreenTimer = setTimeout(() => {
    // 再次检查面板状态
    if (windowStore.activePath || settingsStore.sidebarHovered) return;
    isOffscreen.value = true;
  }, getAutoCollapseDelay());
};

const cancelOffscreenTimer = () => {
  if (offscreenTimer) {
    clearTimeout(offscreenTimer);
    offscreenTimer = null;
  }
};

// 鼠标进入触发区域：滑回 + 取消计时
const handleZoneEnter = () => {
  cancelOffscreenTimer();
  settingsStore.setSidebarHovered(true);
  isOffscreen.value = false;
};

// 鼠标离开触发区域：启动移出计时
const handleZoneLeave = () => {
  settingsStore.setSidebarHovered(false);
  startOffscreenTimer();
};

// ==================== 导航 ====================
const isActive = (path: string) => route.path === path;

const openPage = (e: MouseEvent, item: any) => {
  // 获取点击元素的 Y 坐标
  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const y = rect.top;

  const opened = windowStore.openPanel(item.path, y, t(item.meta.title));
  if (!opened) {
    router.push(item.path);
  }
};

const isMenuItemPlaylist = (item: any) => item.path === '/list';

const createdPlaylists = computed(() => {
  if (!userStore.user) return [];
  return userStore.playList.filter((pl: any) => pl.creator?.userId === userStore.user?.userId);
});

const collectedPlaylists = computed(() => {
  if (!userStore.user) return [];
  return userStore.playList.filter((pl: any) => pl.creator?.userId !== userStore.user?.userId);
});

const collectedAlbums = computed(() => userStore.albumList);

const { navigate } = useOverlayNavigate();
const navigateToPlaylist = (id: number) => navigate('/music-list/' + id + '?type=playlist');
const navigateToAlbum = (id: number) => navigate('/music-list/' + id + '?type=album');

const activeColor = computed(() => props.selectColor || primaryColor.value || '#888888');

const iconStyle = (index: number) => ({
  fontSize: props.size,
  color: isActive(props.menus[index]?.path) ? activeColor.value : props.color
});

onMounted(() => {
  // 启动初始计时
  startOffscreenTimer();
});

// 面板关闭后重新启动收起计时
watch(
  () => windowStore.activePath,
  (newPath) => {
    if (!newPath) {
      // 面板关闭了，重新启动收起计时
      isOffscreen.value = false;
      startOffscreenTimer();
    } else {
      // 面板打开了，确保侧栏可见
      cancelOffscreenTimer();
      isOffscreen.value = false;
    }
  }
);

onUnmounted(() => {
  cancelOffscreenTimer();
  settingsStore.setSidebarHovered(false);
});
</script>

<style lang="scss" scoped>
// 触发区域：侧栏左侧的一小条，用于鼠标移入唤回
.fs-zone {
  position: fixed;
  left: 0;
  top: 0;
  width: 16px;
  height: 100vh;
  z-index: 199;
}

.floating-sidebar {
  position: fixed;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 52px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(24px) saturate(1.8);
  -webkit-backdrop-filter: blur(24px) saturate(1.8);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  padding: 8px 4px;
  z-index: 200;
  transition:
    width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    background 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-height: calc(100vh - 100px);
}

.dark .floating-sidebar {
  background: rgba(30, 30, 30, 0.78);
  border-color: rgba(255, 255, 255, 0.06);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.floating-sidebar.fs-expanded {
  width: 200px;
  align-items: stretch;
}

// 移出屏幕
.floating-sidebar.fs-offscreen {
  transform: translateY(-50%) translateX(-120%);
}

// Logo
.fs-header {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 4px 0 8px;
  cursor: pointer;
}

.fs-logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  flex-shrink: 0;
}

// 菜单列表
.fs-list {
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  padding-bottom: 8px;

  &::-webkit-scrollbar {
    display: none;
  }
}

.fs-item {
  margin-bottom: 2px;
}

.fs-item-link {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s ease;
  user-select: none;

  &:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  .dark & {
    &:hover {
      background: rgba(255, 255, 255, 0.06);
    }
  }
}

.fs-expanded .fs-item-link {
  padding: 8px 12px;
}

.fs-item-icon {
  transition: all 0.2s;
  flex-shrink: 0;
  text-align: center;
  width: 28px;

  &:hover {
    transform: scale(1.05);
  }
}

.fs-item-text {
  margin-left: 10px;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #4b5563;
}

.dark .fs-item-text {
  color: #d1d5db;
}

.fs-text-active {
  color: var(--accent-color, #888) !important;
}

// 子菜单
.fs-submenu {
  padding: 0 6px 6px 16px;
}

.fs-submenu-scroll {
  max-height: 250px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.fs-submenu-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  .dark & {
    &:hover {
      background: rgba(255, 255, 255, 0.06);
    }
  }
}

.fs-submenu-cover {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}

.fs-expanded .fs-submenu-cover {
  width: 30px;
  height: 30px;
  border-radius: 6px;
}

.fs-submenu-name {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #6b7280;
  max-width: 120px;
}

.dark .fs-submenu-name {
  color: #9ca3af;
}

.fs-submenu-empty {
  font-size: 11px;
  color: #9ca3af;
  text-align: center;
  padding: 10px 4px;

  .dark & {
    color: #6b7280;
  }
}
</style>
