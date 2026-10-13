<template>
  <div
    @mouseenter="settingsStore.setSidebarHovered(true)"
    @mouseleave="settingsStore.setSidebarHovered(false)"
  >
    <!-- menu -->
    <div class="app-menu" :class="{ 'app-menu-expanded': isExpanded }">
      <div class="app-menu-header">
        <div class="app-menu-logo" @click="toggleMenu">
          <img :src="icon" class="w-9 h-9" alt="Almusic Player" />
        </div>
      </div>
      <div class="app-menu-list">
        <div v-for="(item, index) in menus" :key="item.path" class="app-menu-item">
          <n-tooltip :delay="200" :disabled="isExpanded || isMobile" placement="bottom">
            <template #trigger>
              <router-link class="app-menu-item-link" :to="item.path">
                <i
                  class="iconfont app-menu-item-icon"
                  :style="iconStyle(index)"
                  :class="item.meta.icon"
                ></i>
                <span
                  v-if="isExpanded"
                  class="app-menu-item-text ml-3"
                  :class="isChecked(index) ? 'text-[var(--accent-color)]' : ''"
                  >{{ t(item.meta.title) }}</span
                >
              </router-link>
            </template>
            <div v-if="!isExpanded">{{ t(item.meta.title) }}</div>
          </n-tooltip>

          <!-- 歌单子菜单（统一版，丝滑过渡） -->
          <div v-if="isMenuItemPlaylist(item)" class="app-menu-submenu-unified">
            <div class="app-menu-submenu-scroll-unified">
              <!-- 创建的歌单 -->
              <template v-if="createdPlaylists.length > 0">
                <div
                  v-for="pl in createdPlaylists"
                  :key="'c-' + pl.id"
                  class="app-menu-submenu-row"
                  @click="navigateToPlaylist(pl.id)"
                >
                  <img :src="getImgUrl(pl.coverImgUrl, '64y64')" class="app-menu-submenu-cover" />
                  <span v-show="isExpanded" class="app-menu-submenu-name">{{ pl.name }}</span>
                </div>
              </template>

              <!-- 收藏的歌单 -->
              <template v-if="collectedPlaylists.length > 0">
                <div
                  v-for="pl in collectedPlaylists"
                  :key="'d-' + pl.id"
                  class="app-menu-submenu-row"
                  @click="navigateToPlaylist(pl.id)"
                >
                  <img :src="getImgUrl(pl.coverImgUrl, '64y64')" class="app-menu-submenu-cover" />
                  <span v-show="isExpanded" class="app-menu-submenu-name">{{ pl.name }}</span>
                </div>
              </template>

              <!-- 收藏的专辑 -->
              <template v-if="collectedAlbums.length > 0">
                <div
                  v-for="al in collectedAlbums"
                  :key="'a-' + al.id"
                  class="app-menu-submenu-row"
                  @click="navigateToAlbum(al.id)"
                >
                  <img
                    :src="getImgUrl(al.picUrl || al.blurPicUrl, '64y64')"
                    class="app-menu-submenu-cover"
                  />
                  <span v-show="isExpanded" class="app-menu-submenu-name">{{ al.name }}</span>
                </div>
              </template>

              <div
                v-if="
                  createdPlaylists.length === 0 &&
                  collectedPlaylists.length === 0 &&
                  collectedAlbums.length === 0
                "
                class="app-menu-submenu-empty"
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
import { computed, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import icon from '@/assets/brand-logo.svg';
import { useCoverColor } from '@/hooks/useCoverColor';
import { useSettingsStore, useUserStore } from '@/store';
import { getImgUrl, isMobile } from '@/utils';

const props = defineProps({
  size: {
    type: String,
    default: '26px'
  },
  color: {
    type: String,
    default: '#aaa'
  },
  selectColor: {
    type: String,
    default: undefined
  },
  menus: {
    type: Array as any,
    default: () => []
  }
});

const route = useRoute();
const router = useRouter();
const path = ref(route.path);
const settingsStore = useSettingsStore();
const isExpanded = computed(() => settingsStore.isSidebarExpanded);
const userStore = useUserStore();
const { primaryColor } = useCoverColor();
watch(
  () => route.path,
  async (newParams) => {
    path.value = newParams;
  }
);

const { t } = useI18n();

const isChecked = (index: number) => {
  return path.value === props.menus[index].path;
};

const activeColor = computed(() => props.selectColor || primaryColor.value || '#888888');

const iconStyle = (index: number) => {
  const style = {
    fontSize: props.size,
    color: isChecked(index) ? activeColor.value : props.color
  };
  return style;
};

const toggleMenu = () => {
  settingsStore.setSetData({
    isMenuExpanded: !settingsStore.setData.isMenuExpanded
  });
};

onUnmounted(() => settingsStore.setSidebarHovered(false));

// 歌单子菜单相关
const isMenuItemPlaylist = (item: any) => {
  return item.path === '/list';
};

const createdPlaylists = computed(() => {
  if (!userStore.user) return [];
  return userStore.playList.filter((pl: any) => pl.creator?.userId === userStore.user?.userId);
});

const collectedPlaylists = computed(() => {
  if (!userStore.user) return [];
  return userStore.playList.filter((pl: any) => pl.creator?.userId !== userStore.user?.userId);
});

const collectedAlbums = computed(() => {
  return userStore.albumList;
});

const navigateToPlaylist = (id: number) => {
  router.push('/music-list/' + id + '?type=playlist');
};

const navigateToAlbum = (id: number) => {
  router.push('/music-list/' + id + '?type=album');
};
</script>

<style lang="scss" scoped>
.app-menu {
  @apply flex-col items-center justify-center transition-all duration-300 w-[100px] px-1;
}

.app-menu-list {
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  padding-bottom: 20px;
  transition: scrollbar-color 0.3s ease;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background-color: transparent;
    border-radius: 2px;
    transition: background-color 0.3s ease;
  }

  &:hover {
    scrollbar-color: rgba(156, 163, 175, 0.5) transparent;

    &::-webkit-scrollbar-thumb {
      background-color: rgba(156, 163, 175, 0.5);

      &:hover {
        background-color: rgba(156, 163, 175, 0.7);
      }
    }
  }
}

.app-menu-expanded {
  @apply w-[200px];

  .app-menu-item {
    @apply hover:bg-gray-100 dark:hover:bg-gray-800 rounded mr-4;
  }
}

.app-menu-item-link,
.app-menu-header {
  @apply flex items-center overflow-hidden ml-2 px-5;
}

.app-menu-header {
  @apply ml-1;
}

.app-menu-item-link {
  @apply mb-2 mt-4;
}

.app-menu-item-icon {
  @apply flex-shrink-0 transition-all duration-200 text-gray-500 dark:text-gray-400;

  &:hover {
    @apply text-[var(--accent-color)] scale-105 !important;
  }
}

.app-menu-item-text {
  @apply whitespace-nowrap overflow-hidden text-ellipsis;
}

// 歌单子菜单样式
.app-menu-submenu-unified {
  width: 100%;
  padding: 0 8px 8px 20px;
  transition: padding 0.3s ease;
}

.app-menu-submenu-scroll-unified {
  max-height: 300px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.app-menu-submenu-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  user-select: none;

  &:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }

  .dark &:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
}

.app-menu-submenu-cover {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
  transition:
    width 0.3s ease,
    height 0.3s ease,
    border-radius 0.3s ease;
}

.app-menu-submenu-name {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #666;
  transition:
    opacity 0.25s ease,
    max-width 0.3s ease;
  max-width: 120px;

  .dark & {
    color: #999;
  }
}

// 展开时：封面变大
.app-menu-expanded {
  .app-menu-submenu-cover {
    width: 32px;
    height: 32px;
    border-radius: 6px;
  }
}

// 收起时：padding-left 居中（容器100px - 封面24px）/2 - 8px(row padding) ≈ 28px
.app-menu:not(.app-menu-expanded) {
  .app-menu-submenu-unified {
    padding: 0 4px 4px 22px;
  }

  .app-menu-submenu-name {
    opacity: 0;
    max-width: 0;
  }
}

.app-menu-submenu-empty {
  font-size: 12px;
  color: #9ca3af;
  text-align: center;
  padding: 12px 8px;

  .dark & {
    color: #6b7280;
  }
}

.mobile {
  .app-menu {
    max-width: 100%;
    width: 100vw;
    position: relative;
    bottom: 0;
    left: 0;
    z-index: 99999;
    background: var(--m-bg, var(--bg-color));
    border: none;

    &-header {
      display: none;
    }

    &-list {
      @apply flex justify-around px-4;
      max-height: none !important;
      overflow: visible !important;
      padding-top: 4px;
      padding-bottom: 4px;
    }

    &-item {
      &-link {
        @apply flex flex-col items-center gap-1;
        width: auto !important;
        margin: 4px 0;
        padding: 4px 8px;

        .app-menu-item-icon {
          font-size: 22px;
          color: var(--m-text-muted, #9a9590);
          transition: color 0.2s;
        }

        &:hover {
          .app-menu-item-icon {
            color: var(--accent-color);
            transform: none !important;
          }
        }
      }

      &-text {
        font-size: 10px;
        color: var(--m-text-muted, #9a9590);
      }
    }

    /* 激活状态：图标使用强调色 */
    .app-menu-item-link.router-link-active {
      .app-menu-item-icon,
      .app-menu-item-text {
        color: var(--accent-color);
      }
    }

    &-expanded {
      @apply w-full;
    }
  }
}
</style>
