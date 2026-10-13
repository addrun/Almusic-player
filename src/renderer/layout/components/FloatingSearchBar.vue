<template>
  <!-- 顶部触发区域：鼠标移入唤回搜索栏 -->
  <div class="fsb-trigger-zone" @mouseenter="handleZoneEnter" @mouseleave="handleZoneLeave"></div>
  <div
    class="floating-search-bar"
    :class="{
      'fsb-expanded': isExpanded,
      'fsb-offscreen': isOffscreen
    }"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- 收起态：仅图标 -->
    <div v-if="!isExpanded" class="fsb-collapsed" @click="expand">
      <i class="iconfont icon-search fsb-search-icon" />
    </div>

    <!-- 展开态：搜索框 -->
    <div v-else class="fsb-expanded-wrap">
      <n-popover
        trigger="manual"
        placement="bottom-start"
        width="trigger"
        :show="showSuggestions"
        :show-arrow="false"
        style="margin-top: 6px"
        content-style="padding:0;border-radius:12px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,0.12);"
        raw
      >
        <template #trigger>
          <div class="fsb-inner" :class="{ 'fsb-inner--focus': inputFocused }">
            <i class="iconfont icon-search fsb-glyph" />
            <input
              ref="inputRef"
              v-model="searchValue"
              class="fsb-input"
              :placeholder="hotSearchKeyword"
              @input="handleInput(searchValue)"
              @keydown="handleKeydown"
              @focus="handleFocus"
              @blur="handleBlur"
            />
            <n-dropdown
              v-if="searchTypeOptions.length"
              trigger="hover"
              :options="searchTypeOptions"
              @select="selectSearchType"
              @mousedown.prevent
            >
              <div class="fsb-type-chip" @mousedown.prevent>
                <span>{{ searchTypeOptions.find((i) => i.key === searchStore.searchType)?.label }}</span>
                <i class="iconfont icon-xiasanjiaoxing text-[10px]" />
              </div>
            </n-dropdown>
          </div>
        </template>
        <div class="fsb-suggestions">
          <n-scrollbar style="max-height: 260px">
            <div v-if="suggestionsLoading" class="fsb-suggest-loading">
              <n-spin size="small" />
            </div>
            <div
              v-for="(s, i) in suggestions"
              :key="i"
              class="fsb-suggest-row"
              :class="{ 'fsb-suggest-row--hi': i === highlightedIndex }"
              @mousedown.prevent="selectSuggestion(s)"
              @mouseenter="highlightedIndex = i"
            >
              <i class="ri-search-line fsb-suggest-icon" />
              <span>{{ s }}</span>
            </div>
          </n-scrollbar>
        </div>
      </n-popover>

      <!-- 用户按钮 -->
      <n-popover trigger="hover" placement="bottom-end" :show-arrow="false" raw>
        <template #trigger>
          <div class="fsb-user-btn">
            <n-avatar
              v-if="userStore.user"
              circle
              :size="24"
              :src="getImgUrl(userStore.user.avatarUrl)"
              class="cursor-pointer"
              @click="selectItem('user')"
            />
            <span v-else class="fsb-login" @click="toLogin">{{ t('comp.searchBar.login') }}</span>
          </div>
        </template>
        <div class="fsb-user-menu">
          <div v-if="userStore.user" class="fsb-user-top" @click="selectItem('user')">
            <n-avatar circle :size="28" :src="getImgUrl(userStore.user?.avatarUrl)" />
            <span class="fsb-user-name">{{ userStore.user?.nickname }}</span>
          </div>
          <div v-if="userStore.user" class="fsb-sep" />
          <div class="fsb-menu-list">
            <div v-if="!userStore.user" class="fsb-menu-row" @click="toLogin">
              <i class="ri-login-box-line" /><span>{{ t('comp.searchBar.toLogin') }}</span>
            </div>
            <div v-if="userStore.user" class="fsb-menu-row" @click="selectItem('logout')">
              <i class="ri-logout-box-r-line" /><span>{{ t('comp.searchBar.logout') }}</span>
            </div>
            <div class="fsb-menu-row" @click="selectItem('set')">
              <i class="ri-settings-3-line" /><span>{{ t('comp.searchBar.set') }}</span>
            </div>
            <div class="fsb-menu-row">
              <i :class="isDark ? 'ri-moon-line' : 'ri-sun-line'" />
              <span>{{ t('comp.searchBar.theme') }}</span>
              <n-switch v-model:value="isDark" class="ml-auto" size="small">
                <template #checked><i class="ri-moon-line text-[10px]" /></template>
                <template #unchecked><i class="ri-sun-line text-[10px]" /></template>
              </n-switch>
            </div>
            <div class="fsb-menu-row" @click="restartApp">
              <i class="ri-restart-line" /><span>{{ t('comp.searchBar.restart') }}</span>
            </div>
            <div class="fsb-menu-row" @click="selectItem('refresh')">
              <i class="ri-refresh-line" /><span>{{ t('comp.searchBar.refresh') }}</span>
            </div>
            <div class="fsb-sep" />
            <div class="fsb-menu-row" @click="toGithubRelease">
              <i class="ri-github-fill" /><span>{{ t('comp.searchBar.currentVersion') }}</span>
              <span class="fsb-ver ml-auto">{{ updateInfo.currentVersion }}</span>
            </div>
          </div>
        </div>
      </n-popover>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useDebounceFn } from '@vueuse/core';
import { computed, nextTick, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { getSearchKeyword } from '@/api/home';
import { getUserDetail } from '@/api/login';
import { getSearchSuggestions } from '@/api/search';
import { SEARCH_TYPES, USER_SET_OPTIONS } from '@/const/bar-const';
import { useWindowStore } from '@/store/modules/windowStore';
import { useNavTitleStore } from '@/store/modules/navTitle';
import { useSearchStore } from '@/store/modules/search';
import { useSettingsStore } from '@/store/modules/settings';
import { useUserStore } from '@/store/modules/user';
import { getImgUrl, isElectron } from '@/utils';
import { checkUpdate, UpdateResult } from '@/utils/update';

import config from '../../../../package.json';

const router = useRouter();
const searchStore = useSearchStore();
const settingsStore = useSettingsStore();
const userStore = useUserStore();
const windowStore = useWindowStore();
const userSetOptions = ref(USER_SET_OPTIONS);
const { t, locale } = useI18n();

// ==================== 展开/收起 ====================
const isExpanded = ref(false);
let collapseTimer: ReturnType<typeof setTimeout> | null = null;
const inputRef = ref<HTMLInputElement | null>(null);
const inputFocused = ref(false);

// ==================== 自动收起 = 移出屏幕（与侧栏一致） ====================
const isOffscreen = ref(false);
let offscreenTimer: ReturnType<typeof setTimeout> | null = null;

const getCollapseDelay = () => {
  return (settingsStore.setData?.overlayAutoCollapseDelay || 5) * 1000;
};
const isAutoCollapseEnabled = () => {
  return settingsStore.setData?.overlayAutoCollapse !== false;
};

// 启动移出屏幕计时
const startOffscreenTimer = () => {
  if (!isAutoCollapseEnabled()) return;
  // 有悬浮面板打开时不收起
  if (windowStore.activePath) return;
  cancelOffscreenTimer();
  offscreenTimer = setTimeout(() => {
    if (windowStore.activePath) return;
    // 输入框有焦点或有搜索建议时不收起
    if (inputFocused.value || showSuggestions.value) {
      startOffscreenTimer();
      return;
    }
    isOffscreen.value = true;
    // 同时收起展开态
    isExpanded.value = false;
  }, getCollapseDelay());
};

const cancelOffscreenTimer = () => {
  if (offscreenTimer) {
    clearTimeout(offscreenTimer);
    offscreenTimer = null;
  }
};

// 顶部触发区域：鼠标移入唤回
const handleZoneEnter = () => {
  cancelOffscreenTimer();
  isOffscreen.value = false;
};

const handleZoneLeave = () => {
  startOffscreenTimer();
};

const expand = () => {
  isExpanded.value = true;
  cancelCollapseTimer();
  nextTick(() => inputRef.value?.focus());
};

const collapse = () => {
  if (inputFocused.value || showSuggestions.value) return;
  isExpanded.value = false;
};

const startCollapseTimer = () => {
  if (!isAutoCollapseEnabled()) return;
  cancelCollapseTimer();
  collapseTimer = setTimeout(() => collapse(), getCollapseDelay());
};

const cancelCollapseTimer = () => {
  if (collapseTimer) {
    clearTimeout(collapseTimer);
    collapseTimer = null;
  }
};

const handleMouseEnter = () => {
  cancelCollapseTimer();
  cancelOffscreenTimer();
  isOffscreen.value = false;
};

const handleMouseLeave = () => {
  startCollapseTimer();
  startOffscreenTimer();
};

// ==================== 搜索 ====================
const hotSearchKeyword = ref(t('comp.searchBar.searchPlaceholder'));
const hotSearchValue = ref('');
const searchValue = ref('');

watch(
  () => searchStore.searchValue,
  (v) => { if (v) searchValue.value = v; },
  { immediate: true }
);

const search = () => {
  const val = searchValue.value;
  if (!val) {
    searchValue.value = hotSearchValue.value;
    return;
  }
  const q = { keyword: val, type: searchStore.searchType };
  searchStore.searchValue = val;
  router.push({ path: '/search-result', query: q });
  showSuggestions.value = false;
  // 用浮动面板打开
  windowStore.openPanel('/search-result', 60, '搜索结果');
};

const selectSearchType = (key: number) => {
  searchStore.searchType = key;
  if (searchValue.value) {
    router.push({ path: '/search-result', query: { keyword: searchValue.value, type: key } });
    windowStore.openPanel('/search-result', 60, '搜索结果');
  }
  nextTick(() => inputRef.value?.focus());
};

const rawSearchTypes = ref(SEARCH_TYPES);
const searchTypeOptions = computed(() => {
  locale.value;
  return rawSearchTypes.value.filter(() => isElectron).map((type) => ({ label: t(type.label), key: type.key }));
});

const suggestions = ref<string[]>([]);
const showSuggestions = ref(false);
const suggestionsLoading = ref(false);
const highlightedIndex = ref(-1);

const debouncedSuggest = useDebounceFn(async (kw: string) => {
  if (!kw.trim()) {
    suggestions.value = [];
    showSuggestions.value = false;
    return;
  }
  suggestionsLoading.value = true;
  suggestions.value = await getSearchSuggestions(kw);
  suggestionsLoading.value = false;
  showSuggestions.value = suggestions.value.length > 0;
  highlightedIndex.value = -1;
}, 300);

const handleInput = (v: string) => debouncedSuggest(v);

const selectSuggestion = (s: string) => {
  searchValue.value = s;
  showSuggestions.value = false;
  search();
};

const handleKeydown = (e: KeyboardEvent) => {
  const len = suggestions.value.length;
  if (!showSuggestions.value || !len) {
    if (e.key === 'Enter') search();
    return;
  }
  if (e.key === 'ArrowDown') { e.preventDefault(); highlightedIndex.value = (highlightedIndex.value + 1) % len; }
  if (e.key === 'ArrowUp') { e.preventDefault(); highlightedIndex.value = (highlightedIndex.value - 1 + len) % len; }
  if (e.key === 'Enter') {
    e.preventDefault();
    highlightedIndex.value >= 0 ? selectSuggestion(suggestions.value[highlightedIndex.value]) : search();
  }
  if (e.key === 'Escape') showSuggestions.value = false;
};

const handleFocus = () => {
  inputFocused.value = true;
  cancelCollapseTimer();
  if (searchValue.value && suggestions.value.length) showSuggestions.value = true;
};

const handleBlur = () => {
  inputFocused.value = false;
  setTimeout(() => { showSuggestions.value = false; }, 150);
  startCollapseTimer();
};

// ==================== 热搜 & 用户 ====================
const loadHotSearch = async () => {
  try {
    const { data } = await getSearchKeyword();
    hotSearchKeyword.value = data.data.showKeyword;
    hotSearchValue.value = data.data.realkeyword;
  } catch {}
};

const loadPage = async () => {
  if (!localStorage.getItem('token')) return;
  try {
    const { data } = await getUserDetail();
    userStore.user = data.profile || userStore.user || JSON.parse(localStorage.getItem('user') || '{}');
    localStorage.setItem('user', JSON.stringify(userStore.user));
  } catch {}
};

watchEffect(() => {
  userSetOptions.value = userStore.user ? USER_SET_OPTIONS : USER_SET_OPTIONS.filter((i) => i.key !== 'logout');
});

const restartApp = () => window.electron?.ipcRenderer?.send('restart');
const toLogin = () => { router.push('/user'); windowStore.openPanel('/user', 60, t('comp.my')); };
const toGithubRelease = () => window.open('https://github.com/mysterious-shhr/Almusic-player/releases', '_blank');

const isDark = computed({
  get: () => settingsStore.theme === 'dark',
  set: () => settingsStore.toggleTheme()
});

const selectItem = (key: string) => {
  switch (key) {
    case 'logout': userStore.handleLogout(); break;
    case 'set': router.push('/set'); windowStore.openPanel('/set', 60, t('comp.settings')); break;
    case 'user': router.push('/user'); windowStore.openPanel('/user', 60, t('comp.my')); break;
    case 'refresh': window.location.reload(); break;
  }
};

const updateInfo = ref<UpdateResult>({
  hasUpdate: false,
  latestVersion: '',
  currentVersion: config.version,
  releaseInfo: null
});

const checkForUpdates = async () => {
  try {
    const r = await checkUpdate(config.version);
    if (r) updateInfo.value = r;
  } catch {}
};

onMounted(() => {
  loadHotSearch();
  loadPage();
  checkForUpdates();
  // 启动初始自动收起计时
  startOffscreenTimer();
});

// 面板状态变化时更新收起计时
watch(
  () => windowStore.activePath,
  (newPath) => {
    if (!newPath) {
      // 面板关闭了，重新启动收起计时
      isOffscreen.value = false;
      startOffscreenTimer();
    } else {
      // 面板打开了，确保搜索栏可见
      cancelOffscreenTimer();
      isOffscreen.value = false;
    }
  }
);

onUnmounted(() => {
  cancelOffscreenTimer();
  cancelCollapseTimer();
});
</script>

<style scoped>
/* 顶部触发区域：鼠标移入唤回搜索栏 */
.fsb-trigger-zone {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 8px;
  z-index: 3001;
}

.floating-search-bar {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3002;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 移出屏幕（自动收起） */
.floating-search-bar.fsb-offscreen {
  transform: translateX(-50%) translateY(-120%);
  pointer-events: none;
}

/* 收起态 */
.fsb-collapsed {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(24px) saturate(1.8);
  -webkit-backdrop-filter: blur(24px) saturate(1.8);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: all 0.2s;
}

.fsb-collapsed:hover {
  background: rgba(255, 255, 255, 0.9);
  transform: scale(1.05);
}

.dark .fsb-collapsed {
  background: rgba(30, 30, 30, 0.78);
  border-color: rgba(255, 255, 255, 0.06);
}

.dark .fsb-collapsed:hover {
  background: rgba(50, 50, 50, 0.85);
}

.fsb-search-icon {
  font-size: 16px;
  color: #6b7280;
}

.dark .fsb-search-icon {
  color: #9ca3af;
}

/* 展开态 */
.fsb-expanded-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fsb-inner {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 12px;
  border-radius: 9999px;
  border: 1.5px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(24px) saturate(1.8);
  -webkit-backdrop-filter: blur(24px) saturate(1.8);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
  width: 380px;
}

.dark .fsb-inner {
  background: rgba(30, 30, 30, 0.85);
  border-color: rgba(255, 255, 255, 0.08);
}

.fsb-inner--focus {
  border-color: var(--accent-color, #888888);
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 0 0 3px rgba(var(--accent-color-rgb, 136, 136, 136), 0.1);
}

.dark .fsb-inner--focus {
  background: rgba(20, 20, 20, 0.9);
}

.fsb-glyph {
  font-size: 14px;
  color: #9ca3af;
  flex-shrink: 0;
}

.fsb-inner--focus .fsb-glyph {
  color: var(--accent-color, #888888);
}

.fsb-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: #374151;
}

.dark .fsb-input {
  color: #f3f4f6;
}

.fsb-input::placeholder {
  color: #9ca3af;
}

.fsb-type-chip {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.05);
  font-size: 11px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}

.dark .fsb-type-chip {
  background: rgba(255, 255, 255, 0.08);
  color: #9ca3af;
}

.fsb-type-chip:hover {
  background: rgba(var(--accent-color-rgb, 136, 136, 136), 0.2);
  color: var(--accent-color, #888888);
}

/* 用户按钮 */
.fsb-user-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 38px;
  height: 38px;
  padding: 2px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(24px) saturate(1.8);
  -webkit-backdrop-filter: blur(24px) saturate(1.8);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.dark .fsb-user-btn {
  background: rgba(30, 30, 30, 0.78);
  border-color: rgba(255, 255, 255, 0.06);
}

.fsb-user-btn:hover {
  border-color: var(--accent-color, #888888);
  box-shadow: 0 0 0 2px rgba(var(--accent-color-rgb, 136, 136, 136), 0.12);
}

.fsb-login {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  padding: 0 8px;
}

.dark .fsb-login {
  color: #9ca3af;
}

/* 用户菜单 */
.fsb-user-menu {
  min-width: 220px;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  border: 1px solid #f3f4f6;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1), 0 1px 4px rgba(0, 0, 0, 0.05);
}
.dark .fsb-user-menu {
  background: #111827;
  border-color: #1f2937;
}

.fsb-user-top {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 12px 14px 10px;
  cursor: pointer;
  transition: background 0.15s;
}
.fsb-user-top:hover { background: #f9fafb; }
.dark .fsb-user-top:hover { background: #1f2937; }

.fsb-user-name {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dark .fsb-user-name { color: #f3f4f6; }

.fsb-sep {
  height: 1px;
  background: #f3f4f6;
  margin: 2px 0;
}
.dark .fsb-sep { background: #1f2937; }

.fsb-menu-list { padding: 3px 0 5px; }

.fsb-menu-row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 14px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
  transition: background 0.12s;
}
.dark .fsb-menu-row { color: #d1d5db; }
.fsb-menu-row:hover { background: #f9fafb; }
.dark .fsb-menu-row:hover { background: #1f2937; }
.fsb-menu-row i {
  font-size: 15px;
  color: #9ca3af;
  flex-shrink: 0;
  width: 16px;
  text-align: center;
}

.fsb-ver {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 5px;
  background: #f3f4f6;
  color: #6b7280;
}
.dark .fsb-ver { background: #1f2937; color: #9ca3af; }

/* 搜索建议 */
.fsb-suggestions {
  background: #fff;
}
.dark .fsb-suggestions { background: #111827; }

.fsb-suggest-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
  transition: background 0.1s;
}
.dark .fsb-suggest-row { color: #d1d5db; }
.fsb-suggest-row:hover,
.fsb-suggest-row--hi {
  background: rgba(var(--accent-color-rgb, 136, 136, 136), 0.06);
  color: var(--accent-color, #888888);
}
.fsb-suggest-icon {
  font-size: 13px;
  color: #9ca3af;
  flex-shrink: 0;
}
.fsb-suggest-loading {
  display: flex;
  justify-content: center;
  padding: 12px;
}
</style>
