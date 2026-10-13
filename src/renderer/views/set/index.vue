<template>
  <div class="h-full w-full page-bg transition-colors duration-500 flex flex-col flex-1 min-h-0">
    <div class="flex-shrink-0 page-padding pt-6 pb-2">
      <div class="flex items-center justify-between gap-4">
        <h1 class="d-page-title">
          {{ t('common.settings') }}
        </h1>
        <!-- 搜索框 -->
        <div class="settings-search-wrap">
          <i class="ri-search-line settings-search-icon" />
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            class="settings-search-input d-input"
            :placeholder="t('comp.searchBar.searchPlaceholder')"
            @input="onSearchInput"
            @keydown.escape="clearSearch"
          />
          <button
            v-if="searchQuery"
            class="settings-search-clear"
            @click="clearSearch"
          >
            <i class="ri-close-line" />
          </button>
        </div>
      </div>
    </div>
    <div class="flex flex-1 min-h-0">
      <!-- 搜索模式下隐藏左侧导航 -->
      <setting-nav
        v-show="!isSearching"
        :sections="navSections"
        :current-section="currentSection"
        @navigate="currentSection = $event"
      />
      <div ref="contentRef" class="flex-1 overflow-y-auto min-h-0">
        <div class="w-full mx-auto pb-32 pt-6 page-padding">
          <!-- 搜索结果模式 -->
          <template v-if="isSearching">
            <div v-if="searchResults.length > 0" class="animate-fade-in">
              <div class="search-results-header">
                <i class="ri-search-line" />
                <span>找到 {{ searchResults.length }} 项匹配 "{{ searchQuery }}" 的设置</span>
              </div>
              <div
                v-for="(result, idx) in searchResults"
                :key="idx"
                class="d-search-card search-result-card"
                @click="jumpToResult(result)"
              >
                <div class="d-tag-sm search-result-tab">{{ result.tabLabel }}</div>
                <div class="search-result-info">
                  <div class="search-result-title" v-html="highlight(result.title)" />
                  <div v-if="result.desc" class="search-result-desc" v-html="highlight(result.desc)" />
                </div>
                <i class="ri-arrow-right-s-line search-result-arrow" />
              </div>
            </div>
            <div v-else class="d-empty-state search-no-results">
              <i class="ri-search-eye-line"></i>
              <p>未找到与 "{{ searchQuery }}" 相关的设置</p>
            </div>
          </template>

          <!-- 正常模式 -->
          <template v-else>
            <div v-show="currentSection === 'basic'" class="animate-fade-in">
              <basic-tab />
            </div>
            <div v-show="currentSection === 'interface'" class="animate-fade-in">
              <interface-tab />
            </div>
            <div v-show="currentSection === 'playback'" class="animate-fade-in">
              <playback-tab />
            </div>
            <div v-show="currentSection === 'application'" class="animate-fade-in">
              <application-tab />
            </div>
            <div v-show="currentSection === 'network'" class="animate-fade-in">
              <network-tab />
            </div>
            <div v-show="currentSection === 'system'" class="animate-fade-in">
              <system-tab />
            </div>
            <div v-show="currentSection === 'about'" class="animate-fade-in">
              <about-tab />
            </div>
            <div v-show="currentSection === 'plugins'" class="animate-fade-in">
              <extra-features-tab />
            </div>
          </template>
          <div class="h-20"></div>
          <play-bottom />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core';
import { useDialog, useMessage } from 'naive-ui';
import { computed, nextTick, onMounted, onUnmounted, provide, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import PlayBottom from '@/components/common/PlayBottom.vue';
import { useSettingsStore } from '@/store/modules/settings';
import { isElectron } from '@/utils';
import SettingNav from '@/views/set/SettingNav.vue';

import config from '../../../../package.json';
import { createDefaultAppUpdateState } from '../../../shared/appUpdate';
import { SETTINGS_DATA_KEY, SETTINGS_DIALOG_KEY, SETTINGS_MESSAGE_KEY } from './keys';
import AboutTab from './tabs/AboutTab.vue';
import ApplicationTab from './tabs/ApplicationTab.vue';
import BasicTab from './tabs/BasicTab.vue';
import InterfaceTab from './tabs/InterfaceTab.vue';
import NetworkTab from './tabs/NetworkTab.vue';
import PlaybackTab from './tabs/PlaybackTab.vue';
import ExtraFeaturesTab from './tabs/ExtraFeaturesTab.vue';
import SystemTab from './tabs/SystemTab.vue';

const settingsStore = useSettingsStore();
const message = useMessage();
const dialog = useDialog();
const { t } = useI18n();

// ==================== 设置数据管理 ====================
const saveSettings = useDebounceFn((data) => {
  settingsStore.setSetData(data);
}, 500);

const localSetData = ref({ ...settingsStore.setData });

const setData = computed({
  get: () => localSetData.value,
  set: (newData) => {
    localSetData.value = newData;
  }
});

watch(
  () => localSetData.value,
  (newValue) => saveSettings(newValue),
  { deep: true }
);

watch(
  () => settingsStore.setData,
  (newValue) => {
    if (JSON.stringify(localSetData.value) !== JSON.stringify(newValue)) {
      localSetData.value = { ...newValue };
    }
  },
  { deep: true, immediate: true }
);

onUnmounted(() => {
  settingsStore.setSetData(localSetData.value);
});

// ==================== Provide ====================
provide(SETTINGS_DATA_KEY, setData);
provide(SETTINGS_MESSAGE_KEY, message);
provide(SETTINGS_DIALOG_KEY, dialog);

// ==================== 导航相关 ====================
type SettingSectionConfig = {
  id: string;
  electron?: boolean;
};

const settingSections: SettingSectionConfig[] = [
  { id: 'basic' },
  { id: 'interface' },
  { id: 'playback' },
  { id: 'application', electron: true },
  { id: 'network', electron: true },
  { id: 'system', electron: true },
  { id: 'plugins' },
  { id: 'about' }
];

const navSections = computed(() => {
  return settingSections
    .filter((section) => !section.electron || isElectron)
    .map((section) => ({
      id: section.id,
      title: t(`settings.sections.${section.id}`)
    }));
});

const currentSection = ref('basic');

// ==================== 设置搜索（模糊匹配） ====================
const searchInputRef = ref<HTMLInputElement | null>(null);
const contentRef = ref<HTMLElement | null>(null);
const searchQuery = ref('');
const isSearching = ref(false);
const searchResults = ref<SearchResult[]>([]);

interface SearchResult {
  tabId: string;
  tabLabel: string;
  title: string;
  desc: string;
  titlePath: string; // 用于跳转后定位
}

// 模糊匹配：检查 query 是否是 target 的子序列（不区分大小写）
function fuzzyMatch(query: string, target: string): boolean {
  if (!query || !target) return false;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

// 高亮匹配的文本
function highlight(text: string): string {
  if (!searchQuery.value || !text) return text;
  const q = searchQuery.value.toLowerCase();
  const t = text;
  let result = '';
  let qi = 0;
  for (let ti = 0; ti < t.length; ti++) {
    if (qi < q.length && t[ti].toLowerCase() === q[qi]) {
      result += `<mark>${t[ti]}</mark>`;
      qi++;
    } else {
      result += t[ti];
    }
  }
  return result;
}

// 所有设置项的索引（预定义）
const settingIndex = computed<SearchResult[]>(() => {
  const items: SearchResult[] = [];
  const tabLabels: Record<string, string> = {};
  navSections.value.forEach((s) => { tabLabels[s.id] = s.title; });

  // 基础设置
  const basicItems = [
    { title: t('settings.basic.themeMode'), desc: t('settings.basic.themeModeDesc') },
    { title: t('settings.basic.language'), desc: t('settings.basic.languageDesc') },
    { title: t('settings.basic.font'), desc: t('settings.basic.fontDesc') },
    { title: t('settings.basic.animation'), desc: t('settings.basic.animationDesc') },
    { title: t('settings.basic.animationSpeed'), desc: t('settings.basic.animationSpeedDesc') },
    { title: t('settings.basic.defaultPage'), desc: t('settings.basic.defaultPageDesc') }
  ];
  basicItems.forEach((item) => {
    items.push({ tabId: 'basic', tabLabel: tabLabels['basic'], title: item.title, desc: item.desc, titlePath: item.title });
  });

  // 界面设置
  const interfaceItems = [
    { title: '界面布局', desc: '经典：传统侧边栏+页面 / 浮动覆盖：播放界面为主+悬浮窗口' },
    { title: '自动收起', desc: '无操作时自动将侧栏和搜索栏移出屏幕' },
    { title: '收起延迟', desc: '无操作后多少秒自动收起' },
    { title: '播放器样式', desc: '默认 / 舞台 / 杂志 / 狂躁' },
    { title: '底栏样式', desc: '贯穿：全宽底栏 / 迷你：浮动圆角底栏' },
    { title: '快捷组件', desc: '迷你底栏悬停时显示的组件' },
    { title: '本地歌词文件', desc: '为当前歌曲指定本地 TTML/LRC 歌词文件' },
    { title: '桌面歌词字体', desc: '选择已安装的系统字体' },
    { title: '桌面歌词文本颜色', desc: '歌词文字颜色' },
    { title: '桌面歌词已播放颜色', desc: '当前播放行的高亮颜色' },
    { title: '桌面歌词未播放颜色', desc: '未播放歌词行的文字颜色' },
    { title: '桌面歌词描边颜色', desc: '歌词文字描边/阴影颜色' },
    { title: '封面取色', desc: '自动跟随当前播放歌曲封面提取颜色' },
    { title: t('settings.interface.sidebarOrder'), desc: t('settings.interface.sidebarOrderDesc') },
    { title: t('settings.interface.sidebarHoverExpand'), desc: t('settings.interface.sidebarHoverExpandDesc') },
    { title: '酷狗歌单', desc: '调整酷狗歌单的侧边栏顺序和显示状态，也可设为启动默认页', titlePath: t('settings.interface.sidebarOrder') }
  ];
  interfaceItems.forEach((item) => {
    items.push({ tabId: 'interface', tabLabel: tabLabels['interface'], title: item.title, desc: item.desc, titlePath: item.titlePath || item.title });
  });

  // 播放设置
  const playbackItems = [
    { title: t('settings.playback.quality'), desc: t('settings.playback.qualityDesc') },
    { title: t('settings.playback.autoPlay'), desc: t('settings.playback.autoPlayDesc') },
    { title: t('settings.playback.volume'), desc: t('settings.playback.volumeDesc') },
    { title: t('settings.playback.crossfade'), desc: t('settings.playback.crossfadeDesc') },
    { title: t('settings.playback.gapless'), desc: t('settings.playback.gaplessDesc') }
  ];
  playbackItems.forEach((item) => {
    items.push({ tabId: 'playback', tabLabel: tabLabels['playback'], title: item.title, desc: item.desc, titlePath: item.title });
  });

  // 应用设置
  if (isElectron) {
    const appItems = [
      { title: t('settings.application.gpu'), desc: t('settings.application.gpuDesc') },
      { title: t('settings.application.diskCache'), desc: t('settings.application.diskCacheDesc') },
      { title: t('settings.application.cacheSize'), desc: t('settings.application.cacheSizeDesc') },
      { title: t('settings.application.downloadPath'), desc: t('settings.application.downloadPathDesc') },
      { title: t('settings.application.closeAction'), desc: t('settings.application.closeActionDesc') }
    ];
    appItems.forEach((item) => {
      items.push({ tabId: 'application', tabLabel: tabLabels['application'], title: item.title, desc: item.desc, titlePath: item.title });
    });
  }

  // 网络设置
  if (isElectron) {
    const networkItems = [
      { title: t('settings.network.proxy'), desc: t('settings.network.proxyDesc') },
      { title: t('settings.network.realIP'), desc: t('settings.network.realIPDesc') },
      { title: t('settings.network.musicUnblock'), desc: t('settings.network.musicUnblockDesc') },
      { title: t('settings.network.musicSources'), desc: t('settings.network.musicSourcesDesc') }
    ];
    networkItems.forEach((item) => {
      items.push({ tabId: 'network', tabLabel: tabLabels['network'], title: item.title, desc: item.desc, titlePath: item.title });
    });
  }

  // 系统设置
  if (isElectron) {
    const systemItems = [
      { title: t('settings.system.update'), desc: t('settings.system.updateDesc') },
      { title: t('settings.system.restart'), desc: t('settings.system.restartDesc') },
      { title: t('settings.system.clearCache'), desc: t('settings.system.clearCacheDesc') }
    ];
    systemItems.forEach((item) => {
      items.push({ tabId: 'system', tabLabel: tabLabels['system'], title: item.title, desc: item.desc, titlePath: item.title });
    });
  }

  // 插件/扩展功能
  const pluginItems = [
    { title: '播放器样式插件', desc: '管理自定义播放器样式' },
    { title: '歌词翻译引擎', desc: '选择歌词翻译引擎' },
    { title: '自定义 API 插件', desc: '管理 API 数据源插件' }
  ];
  pluginItems.forEach((item) => {
    items.push({ tabId: 'plugins', tabLabel: tabLabels['plugins'], title: item.title, desc: item.desc, titlePath: item.title });
  });

  // 关于
  const aboutItems = [
    { title: t('settings.about.version'), desc: t('settings.about.versionDesc') },
    { title: t('settings.about.github'), desc: t('settings.about.githubDesc') },
    { title: t('settings.about.feedback'), desc: t('settings.about.feedbackDesc') }
  ];
  aboutItems.forEach((item) => {
    items.push({ tabId: 'about', tabLabel: tabLabels['about'], title: item.title, desc: item.desc, titlePath: item.title });
  });

  return items;
});

const performSearch = useDebounceFn(() => {
  const q = searchQuery.value.trim();
  if (!q) {
    isSearching.value = false;
    searchResults.value = [];
    return;
  }
  isSearching.value = true;
  searchResults.value = settingIndex.value.filter((item) => {
    return fuzzyMatch(q, item.title) || fuzzyMatch(q, item.desc) || fuzzyMatch(q, item.tabLabel);
  });
}, 200);

const onSearchInput = () => {
  performSearch();
};

const clearSearch = () => {
  searchQuery.value = '';
  isSearching.value = false;
  searchResults.value = [];
};

const jumpToResult = (result: SearchResult) => {
  clearSearch();
  currentSection.value = result.tabId;
  nextTick(() => {
    // 尝试滚动到匹配的设置项
    nextTick(() => {
      const items = contentRef.value?.querySelectorAll('.setting-item');
      if (items) {
        for (const item of items) {
          const titleEl = item.querySelector('.setting-item-title, [class*="title"]');
          if (titleEl && titleEl.textContent?.includes(result.titlePath)) {
            item.scrollIntoView({ behavior: 'smooth', block: 'center' });
            item.classList.add('setting-item-flash');
            setTimeout(() => item.classList.remove('setting-item-flash'), 2000);
            break;
          }
        }
      }
    });
  });
};

// ==================== 初始化 ====================
onMounted(() => {
  if (isElectron && settingsStore.appUpdateState.currentVersion === '') {
    settingsStore.setAppUpdateState(createDefaultAppUpdateState(config.version));
  }
  if (setData.value.enableRealIP === undefined) {
    setData.value = { ...setData.value, enableRealIP: false };
  }
  if (setData.value.enableDiskCache === undefined) {
    setData.value = { ...setData.value, enableDiskCache: true };
  }
  if (!setData.value.diskCacheMaxSizeMB) {
    setData.value = { ...setData.value, diskCacheMaxSizeMB: 4096 };
  }
  if (!['lru', 'fifo'].includes(setData.value.diskCacheCleanupPolicy)) {
    setData.value = { ...setData.value, diskCacheCleanupPolicy: 'lru' };
  }
});
</script>

<style scoped>
:deep(.n-select .n-base-selection) {
  border-radius: var(--d-radius-md);
}

.animate-fade-in {
  animation: fadeIn var(--d-duration-slow) var(--d-ease-out);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 搜索框 */
.settings-search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 280px;
  max-width: 40vw;
}

.settings-search-icon {
  position: absolute;
  left: 12px;
  font-size: 16px;
  color: var(--d-text-muted);
  pointer-events: none;
  z-index: 1;
}

/* d-input 提供基础样式，这里仅补充 padding 以腾出图标位置 */
.settings-search-input {
  padding: 0 32px 0 36px;
  height: 36px;
}

.settings-search-clear {
  position: absolute;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: var(--d-radius-full);
  border: none;
  background: var(--d-surface-active);
  color: var(--d-text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: background var(--d-duration-fast) var(--d-ease-out);
}

.settings-search-clear:hover {
  background: var(--d-border-strong);
}

/* 搜索结果 */
.search-results-header {
  display: flex;
  align-items: center;
  gap: var(--d-space-2);
  font-size: var(--d-text-sm);
  color: var(--d-text-secondary);
  margin-bottom: var(--d-space-4);
  padding: 0 var(--d-space-1);
}

.search-result-info {
  flex: 1;
  min-width: 0;
}

.search-result-title {
  font-size: var(--d-text-sm);
  font-weight: var(--d-font-medium);
  color: var(--d-text-primary);
  margin-bottom: 2px;
}

.search-result-desc {
  font-size: var(--d-text-xs);
  color: var(--d-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-result-arrow {
  font-size: 18px;
  color: var(--d-text-muted);
  flex-shrink: 0;
}

.search-result-title :deep(mark),
.search-result-desc :deep(mark) {
  background: rgba(var(--accent-color-rgb), 0.15);
  color: var(--accent-color);
  border-radius: 2px;
  padding: 0 1px;
  font-weight: var(--d-font-semibold);
}

/* 跳转后闪烁 */
:deep(.setting-item-flash) {
  animation: flashHighlight 2s ease;
}

@keyframes flashHighlight {
  0%, 100% { background: transparent; }
  10%, 30% { background: rgba(var(--accent-color-rgb), 0.08); }
}
</style>
