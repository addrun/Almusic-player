<template>
  <div v-if="internalVisible" class="metaphor-overlay" @click="closePanel"></div>
  <div
    v-if="internalVisible"
    class="metaphor-panel"
    :class="[
      'animate__animated',
      closing
        ? isMobile ? 'animate__slideOutDown' : 'animate__slideOutRight'
        : isMobile ? 'animate__slideInUp' : 'animate__slideInRight'
    ]"
    @animationend="onAnimationEnd"
  >
    <div class="metaphor-panel-header">
      <div class="title">
        <i class="iconfont ri-quill-pen-line mr-2"></i>
        歌词隐喻分析
      </div>
      <div class="header-actions">
        <n-tooltip trigger="hover" v-if="result">
          <template #trigger>
            <div class="action-btn" @click="handleReanalyze">
              <i class="iconfont ri-refresh-line"></i>
            </div>
          </template>
          重新分析
        </n-tooltip>
        <n-tooltip trigger="hover">
          <template #trigger>
            <div class="action-btn" @click="handleConfigure">
              <i class="iconfont ri-settings-3-line"></i>
            </div>
          </template>
          API 设置
        </n-tooltip>
        <div class="close-btn" @click="closePanel">
          <i class="iconfont ri-close-line"></i>
        </div>
      </div>
    </div>
    <div class="metaphor-panel-content">
      <template v-if="loading">
        <div class="metaphor-loading">
          <i class="ri-loader-4-line animate-spin text-3xl"></i>
          <p>正在分析歌词隐喻...</p>
          <p class="text-xs opacity-60 mt-1">使用 AI 分析可能需要 10-30 秒</p>
        </div>
      </template>
      <template v-else-if="error">
        <div class="metaphor-error">
          <i class="ri-error-warning-line text-3xl"></i>
          <p>{{ error }}</p>
          <s-btn class="mt-3" @click="handleReanalyze">重试</s-btn>
          <s-btn class="mt-2" @click="handleConfigure">API 设置</s-btn>
        </div>
      </template>
      <template v-else-if="result">
        <div class="metaphor-result" v-html="sanitizedResult"></div>
        <div v-if="cached" class="metaphor-cached-badge">
          <i class="ri-database-2-line mr-1"></i> 缓存结果
        </div>
      </template>
      <template v-else>
        <div class="metaphor-empty">
          <i class="ri-quill-pen-line text-5xl"></i>
          <p>点击播放栏的 <i class="iconfont ri-quill-pen-line"></i> 按钮</p>
          <p class="text-xs opacity-60 mt-1">分析当前歌词的隐喻和修辞手法</p>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

import { getAlbum } from '@/api/list';
import { useMetaphor } from '@/features/lyric-metaphor/useMetaphor';
import { isMobile } from '@/utils';

import SBtn from '@/views/set/SBtn.vue';

const props = defineProps<{
  modelValue: boolean;
  lyrics: string;
  songName: string;
  artist: string;
  albumId: number | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  configure: [];
}>();
const internalVisible = ref(false);
const closing = ref(false);

const { loading, error, result, cached, analyze, clear } = useMetaphor();

const lastSongKey = ref('');

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      internalVisible.value = true;
      closing.value = false;
      const currentKey = `${props.songName}|${props.artist}`;
      if (lastSongKey.value && lastSongKey.value !== currentKey) {
        clear();
      }
      if (props.lyrics) {
        doAnalyze();
      }
    } else {
      if (!internalVisible.value) return;
      closing.value = true;
    }
  },
  { immediate: true }
);

watch(
  [() => props.songName, () => props.artist],
  () => {
    lastSongKey.value = '';
    if (props.modelValue && props.lyrics) {
      clear();
      doAnalyze();
    }
  }
);

function closePanel() {
  emit('update:modelValue', false);
}

function onAnimationEnd() {
  if (closing.value) {
    internalVisible.value = false;
  }
}

async function doAnalyze() {
  if (!props.lyrics) return;
  let albumDesc = '';
  if (props.albumId) {
    try {
      const res = await getAlbum(props.albumId);
      albumDesc = res?.data?.album?.description || '';
    } catch {}
  }
  await analyze(props.lyrics, props.songName, props.artist, albumDesc);
  lastSongKey.value = `${props.songName}|${props.artist}`;
}

function handleReanalyze() {
  doAnalyze();
}

function handleConfigure() {
  emit('configure');
}

const sanitizedResult = computed(() => {
  if (!result.value) return '';
  const tokens = marked.lexer(result.value);
  const html = marked.parser(tokens);
  return DOMPurify.sanitize(html);
});

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && internalVisible.value) {
    closePanel();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<style lang="scss" scoped>
.metaphor-overlay {
  @apply fixed inset-0 z-[999998];
  pointer-events: auto;
  cursor: default;
}

.metaphor-panel {
  @apply fixed right-0 z-[999999] rounded-l-xl overflow-hidden;
  width: 420px;
  height: 70vh;
  top: 15vh;
  animation-duration: 0.4s !important;
  @apply bg-light dark:bg-dark shadow-2xl dark:border dark:border-gray-700;

  &-header {
    @apply flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-900;
    backdrop-filter: blur(10px);
    background-color: rgba(255, 255, 255, 0.7);

    .dark & {
      background-color: rgba(18, 18, 18, 0.7);
    }

    .title {
      @apply text-base font-medium text-gray-800 dark:text-gray-200 flex items-center;
    }

    .header-actions {
      @apply flex items-center;
    }

    .action-btn,
    .close-btn {
      @apply w-8 h-8 flex items-center justify-center rounded-full cursor-pointer mx-1 text-gray-800 dark:text-gray-200;
      @apply hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors;

      .iconfont {
        @apply text-xl;
      }
    }

    .action-btn {
      @apply text-gray-500 dark:text-gray-400;
      &:hover {
        @apply text-[var(--accent-color)] dark:text-[var(--accent-color-light)];
      }
    }
  }

  &-content {
    @apply h-[calc(70vh-56px)] overflow-y-auto;
    @apply px-4 py-4;
  }
}

.metaphor-loading {
  @apply flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500;

  i {
    @apply mb-4;
  }

  p {
    @apply text-sm;
  }
}

.metaphor-error {
  @apply flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 text-center;

  i {
    @apply mb-3 text-red-400;
  }

  p {
    @apply text-sm max-w-xs;
  }
}

.metaphor-result {
  @apply text-sm leading-relaxed text-gray-700 dark:text-gray-300;

  :deep(h1) {
    @apply text-lg font-bold mb-3 mt-4;
  }

  :deep(h2) {
    @apply text-base font-bold mb-2 mt-4;
  }

  :deep(h3) {
    @apply text-sm font-bold mb-2 mt-3;
  }

  :deep(p) {
    @apply mb-3;
  }

  :deep(ul) {
    @apply list-disc pl-5 mb-3;
  }

  :deep(ol) {
    @apply list-decimal pl-5 mb-3;
  }

  :deep(li) {
    @apply mb-1;
  }

  :deep(blockquote) {
    @apply border-l-4 border-[var(--accent-color-light)] pl-3 italic text-gray-500 dark:text-gray-400 mb-3;
  }

  :deep(code) {
    @apply bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-xs;
  }

  :deep(strong) {
    @apply font-semibold;
  }

  :deep(hr) {
    @apply my-4 border-gray-200 dark:border-gray-700;
  }
}

.metaphor-cached-badge {
  @apply flex items-center justify-center mt-4 text-xs text-gray-400;
}

.metaphor-empty {
  @apply flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500;

  i {
    @apply mb-3;
  }

  p {
    @apply text-sm;
  }
}

@media (max-width: 768px) {
  .metaphor-panel {
    width: 100%;
    height: 80vh;
    top: auto;
    bottom: 0;
    border-radius: 30px 30px 0 0;
    border-left: none;
    border-top: 1px solid theme('colors.gray.200');
    box-shadow: 0 -5px 20px rgba(0, 0, 0, 0.1);

    &-header {
      @apply text-center relative px-4;

      &::before {
        content: '';
        position: absolute;
        top: -15px;
        left: 50%;
        transform: translateX(-50%);
        width: 40px;
        height: 5px;
        border-radius: 5px;
        background-color: rgba(150, 150, 150, 0.3);
      }
    }

    &-content {
      height: calc(80vh - 56px);
    }
  }
}
</style>
