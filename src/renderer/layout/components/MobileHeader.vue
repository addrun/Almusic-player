<template>
  <div class="mobile-header" :class="{ 'safe-area-top': hasSafeArea }">
    <!-- 左侧区域 -->
    <div class="header-left">
      <div v-if="showBack" class="header-btn" @click="goBack">
        <i class="ri-arrow-left-s-line"></i>
      </div>
      <div v-else class="header-logo">
        <span class="logo-text">Almusic Player</span>
      </div>
    </div>

    <!-- 中间标题 -->
    <div class="header-title">
      <span v-if="title">{{ t(title) }}</span>
    </div>

    <!-- 右侧区域 -->
    <div class="header-right">
      <div class="header-btn" @click="openSearch">
        <i class="ri-search-line"></i>
      </div>
      <div class="header-btn" @click="openSettings">
        <i class="ri-settings-3-line"></i>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const hasSafeArea = inject('hasSafeArea', false);

const showBack = computed(() => {
  return route.meta.back === true;
});

const title = computed(() => {
  return (route.meta.title as string) || '';
});

const goBack = () => {
  router.back();
};

// 打开搜索
const openSearch = () => {
  router.push('/mobile-search');
};

const openSettings = () => {
  router.push('/set');
};
</script>

<style lang="scss" scoped>
.mobile-header {
  @apply flex items-center justify-between px-4 py-3;
  border-bottom: 1px solid var(--m-border, transparent);
  background: var(--m-bg, var(--bg-color));
  min-height: 56px;
  flex-shrink: 0;

  &.safe-area-top {
    padding-top: calc(var(--safe-area-inset-top, 0px) + 16px);
  }
}

.header-left {
  @apply flex items-center;
  min-width: 80px;
}

.header-logo {
  @apply flex items-center;

  .logo-text {
    font-family: var(--m-font-serif, 'Cormorant Garamond', serif);
    font-weight: 700;
    font-size: 20px;
    color: var(--m-text-primary, var(--text-color));
  }
}

.header-title {
  @apply flex-1 text-center;

  span {
    font-size: 16px;
    font-weight: 500;
    color: var(--m-text-primary, var(--text-color));
  }
}

.header-right {
  @apply flex items-center gap-2;
  min-width: 80px;
  justify-content: flex-end;
}

.header-btn {
  @apply flex items-center justify-center;
  @apply w-10 h-10 rounded-full;
  @apply text-xl;
  color: var(--m-text-secondary, #6b6560);
  @apply transition-colors duration-150;
  cursor: pointer;

  &:active {
    background: var(--m-surface, rgba(0, 0, 0, 0.05));
  }
}
</style>
