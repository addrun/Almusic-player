<template>
  <div class="mobile-search-page">
    <!-- 搜索头部 -->
    <div class="search-header" :class="{ 'safe-area-top': hasSafeArea }">
      <div class="header-back" @click="goBack">
        <i class="ri-arrow-left-s-line"></i>
      </div>
      <div class="search-input-wrapper">
        <i class="ri-search-line search-icon"></i>
        <input
          ref="searchInputRef"
          v-model="searchValue"
          type="text"
          class="search-input"
          :placeholder="hotSearchKeyword"
          @input="handleInput"
          @keydown.enter="handleSearch"
        />
        <i v-if="searchValue" class="ri-close-circle-fill clear-icon" @click="clearSearch"></i>
      </div>
      <div class="search-button" @click="handleSearch">
        {{ t('common.search') }}
      </div>
    </div>

    <!-- 搜索类型标签 -->
    <div class="search-types">
      <div
        v-for="type in searchTypes"
        :key="type.key"
        class="type-tag"
        :class="{ active: searchType === type.key }"
        @click="selectType(type.key)"
      >
        {{ type.label }}
      </div>
    </div>

    <!-- 搜索内容区域 -->
    <div class="search-content">
      <!-- 搜索建议 -->
      <div v-if="suggestions.length > 0" class="search-section">
        <div class="section-title">{{ t('search.suggestions') }}</div>
        <div class="suggestion-list">
          <div
            v-for="(item, index) in suggestions"
            :key="index"
            class="suggestion-item"
            @click="selectSuggestion(item)"
          >
            <i class="ri-search-line"></i>
            <span>{{ item }}</span>
          </div>
        </div>
      </div>

      <!-- 搜索历史 -->
      <div v-else-if="searchHistory.length > 0" class="search-section">
        <div class="section-header">
          <span class="section-title">{{ t('search.history') }}</span>
          <span class="clear-history" @click="clearHistory">{{ t('common.clear') }}</span>
        </div>
        <div class="history-tags">
          <div
            v-for="(item, index) in searchHistory"
            :key="index"
            class="history-tag"
            @click="selectSuggestion(item)"
          >
            {{ item }}
          </div>
        </div>
      </div>

      <!-- 热门搜索 -->
      <div v-if="hotSearchList.length > 0 && !searchValue" class="search-section">
        <div class="section-title">{{ t('search.hot') }}</div>
        <div class="hot-list">
          <div
            v-for="(item, index) in hotSearchList"
            :key="index"
            class="hot-item"
            @click="selectSuggestion(item.searchWord)"
          >
            <span class="hot-rank" :class="{ top: index < 3 }">{{ index + 1 }}</span>
            <span class="hot-word">{{ item.searchWord }}</span>
            <span v-if="item.iconUrl" class="hot-icon">
              <img :src="item.iconUrl" alt="" />
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core';
import { computed, inject, nextTick, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { getHotSearch, getSearchKeyword } from '@/api/home';
import { getSearchSuggestions } from '@/api/search';
import { SEARCH_TYPES } from '@/const/bar-const';
import { useSearchStore } from '@/store/modules/search';

const { t, locale } = useI18n();
const router = useRouter();
const searchStore = useSearchStore();

// 注入是否有安全区域
const hasSafeArea = inject('hasSafeArea', false);

// 搜索值
const searchValue = ref('');
const searchInputRef = ref<HTMLInputElement | null>(null);

// 热门搜索关键词占位符
const hotSearchKeyword = ref('搜索音乐、歌手、歌单');

// 搜索类型
const searchType = ref(searchStore.searchType || 1);
const searchTypes = computed(() => {
  locale.value;
  return SEARCH_TYPES.map((type) => ({
    label: t(type.label),
    key: type.key
  }));
});

// 搜索建议
const suggestions = ref<string[]>([]);

// 搜索历史
const HISTORY_KEY = 'mobile_search_history';
const searchHistory = ref<string[]>([]);

// 热门搜索
const hotSearchList = ref<any[]>([]);

// 加载热门搜索关键词
const loadHotSearchKeyword = async () => {
  try {
    const { data } = await getSearchKeyword();
    hotSearchKeyword.value = data.data.showKeyword;
  } catch (e) {
    console.error('加载热门搜索关键词失败:', e);
  }
};

// 加载热门搜索列表
const loadHotSearchList = async () => {
  try {
    const { data } = await getHotSearch();
    hotSearchList.value = data.data || [];
  } catch (e) {
    console.error('加载热门搜索失败:', e);
  }
};

// 加载搜索历史
const loadSearchHistory = () => {
  try {
    const history = localStorage.getItem(HISTORY_KEY);
    searchHistory.value = history ? JSON.parse(history) : [];
  } catch (e) {
    console.error('加载搜索历史失败:', e);
    searchHistory.value = [];
  }
};

// 保存搜索历史
const saveSearchHistory = (keyword: string) => {
  if (!keyword.trim()) return;

  // 移除重复项并添加到开头
  const history = searchHistory.value.filter((item) => item !== keyword);
  history.unshift(keyword);

  // 最多保存20条
  searchHistory.value = history.slice(0, 20);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory.value));
};

// 清除搜索历史
const clearHistory = () => {
  searchHistory.value = [];
  localStorage.removeItem(HISTORY_KEY);
};

// 获取搜索建议（防抖）
const debouncedGetSuggestions = useDebounceFn(async (keyword: string) => {
  if (!keyword.trim()) {
    suggestions.value = [];
    return;
  }
  suggestions.value = await getSearchSuggestions(keyword);
}, 300);

// 处理输入
const handleInput = () => {
  debouncedGetSuggestions(searchValue.value);
};

// 清除搜索
const clearSearch = () => {
  searchValue.value = '';
  suggestions.value = [];
};

// 选择搜索类型
const selectType = (type: number) => {
  searchType.value = type;
  searchStore.searchType = type;
};

// 选择建议
const selectSuggestion = (keyword: string) => {
  searchValue.value = keyword;
  handleSearch();
};

// 执行搜索
const handleSearch = () => {
  const keyword = searchValue.value.trim();
  if (!keyword) return;

  // 保存搜索历史
  saveSearchHistory(keyword);

  // 跳转到搜索结果页
  router.push({
    path: '/mobile-search-result',
    query: {
      keyword,
      type: searchType.value
    }
  });
};

// 返回上一页
const goBack = () => {
  router.back();
};

onMounted(() => {
  loadHotSearchKeyword();
  loadHotSearchList();
  loadSearchHistory();
  nextTick(() => {
    searchInputRef.value?.focus();
  });
});
</script>

<style lang="scss" scoped>
.mobile-search-page {
  @apply fixed inset-0 z-50;
  @apply flex flex-col;
  background: var(--m-bg, var(--bg-color));
}

.search-header {
  @apply flex items-center gap-3 pl-1 pr-3 py-3;
  border-bottom: 1px solid var(--m-border, transparent);

  &.safe-area-top {
    padding-top: calc(var(--safe-area-inset-top, 0px) + 12px);
  }
}

.header-back {
  @apply flex items-center justify-center;
  @apply w-8 h-8 rounded-full text-2xl;
  color: var(--m-text-secondary, #6b6560);
  transition: transform var(--m-duration-press, 160ms) var(--m-ease-out, ease-out);

  &:active {
    transform: scale(0.97);
    background: var(--m-surface, rgba(0, 0, 0, 0.05));
  }
}

.search-input-wrapper {
  @apply flex-1 flex items-center gap-2;
  @apply rounded-full;
  @apply px-4 py-1;
  background: var(--m-surface, #eae6df);
}

.search-icon {
  @apply text-gray-400 text-lg;
}

.search-input {
  @apply flex-1 bg-transparent border-none outline-none;
  @apply text-base;
  color: var(--m-text-primary, #2c2c2c);

  &::placeholder {
    color: var(--m-text-muted, #9a9590);
  }
}

.clear-icon {
  @apply text-lg cursor-pointer;
  color: var(--m-text-muted, #9a9590);
}

.search-types {
  @apply flex gap-2 px-4 py-3 overflow-x-auto;
  border-bottom: 1px solid var(--m-border, transparent);

  &::-webkit-scrollbar {
    display: none;
  }
}

.type-tag {
  @apply px-4 py-1.5 rounded-full text-sm whitespace-nowrap;
  background: var(--m-surface, #eae6df);
  color: var(--m-text-secondary, #6b6560);
  transition: background var(--m-duration-press, 160ms) var(--m-ease-out, ease-out),
              color var(--m-duration-press, 160ms) var(--m-ease-out, ease-out),
              transform var(--m-duration-press, 160ms) var(--m-ease-out, ease-out);

  &:active {
    transform: scale(0.97);
  }

  &.active {
    background: var(--accent-color);
    color: #ffffff;
  }
}

.search-content {
  @apply flex-1 overflow-y-auto px-4 py-3;
}

.search-section {
  @apply mb-6;
}

.section-header {
  @apply flex items-center justify-between mb-3;
}

.section-title {
  @apply text-sm font-medium mb-3;
  color: var(--m-text-muted, #9a9590);
}

.clear-history {
  @apply text-sm;
  color: var(--m-text-muted, #9a9590);
}

.suggestion-list {
  @apply space-y-1;
}

.suggestion-item {
  @apply flex items-center gap-3 py-3;
  color: var(--m-text-primary, #2c2c2c);
  transition: background var(--m-duration-press, 160ms) var(--m-ease-out, ease-out);

  &:active {
    background: var(--m-surface, rgba(0, 0, 0, 0.03));
  }

  i {
    color: var(--m-text-muted, #9a9590);
  }
}

.history-tags {
  @apply flex flex-wrap gap-2;
}

.history-tag {
  @apply px-3 py-1.5 rounded-full text-sm;
  background: var(--m-surface, #eae6df);
  color: var(--m-text-secondary, #6b6560);
  transition: transform var(--m-duration-press, 160ms) var(--m-ease-out, ease-out);

  &:active {
    transform: scale(0.97);
    background: var(--m-surface-alt, #e0dbd3);
  }
}

.hot-list {
  @apply space-y-1;
}

.hot-item {
  @apply flex items-center gap-3 py-2.5;
  transition: background var(--m-duration-press, 160ms) var(--m-ease-out, ease-out);

  &:active {
    background: var(--m-surface, rgba(0, 0, 0, 0.03));
  }
}

.hot-rank {
  @apply w-5 text-center text-sm font-medium;
  color: var(--m-text-muted, #9a9590);

  &.top {
    @apply text-red-500;
  }
}

.hot-word {
  @apply flex-1 text-gray-700 dark:text-gray-200;
}

.hot-icon {
  img {
    @apply h-4;
  }
}
</style>
