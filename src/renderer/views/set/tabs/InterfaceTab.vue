<template>
  <setting-section :title="t('settings.sections.interface')">
    <!-- 启动默认页 -->
    <setting-item
      :title="t('settings.interface.defaultPage')"
      :description="t('settings.interface.defaultPageDesc')"
    >
      <s-select
        v-model="setData.defaultPage"
        :options="defaultPageOptions"
        width="w-40 max-md:w-full"
      />
    </setting-item>
  </setting-section>

  <!-- 布局模式 -->
  <setting-section
    title="布局模式"
    description="切换主界面布局方式。浮动覆盖模式将播放界面作为背景，侧栏和页面变为悬浮窗口"
  >
    <setting-item
      title="界面布局"
      description="经典：传统侧边栏+页面 / 浮动覆盖：播放界面为主+悬浮窗口"
    >
      <s-select
        v-model="setData.layoutMode"
        :options="layoutModeOptions"
        width="w-40 max-md:w-full"
      />
    </setting-item>

    <template v-if="setData.layoutMode === 'overlay'">
      <setting-item title="自动收起" description="无操作时自动将侧栏和搜索栏移出屏幕">
        <n-switch v-model:value="setData.overlayAutoCollapse" />
      </setting-item>

      <setting-item
        v-if="setData.overlayAutoCollapse !== false"
        title="收起延迟"
        description="无操作后多少秒自动收起（3-10秒）"
      >
        <n-slider
          v-model:value="overlayCollapseDelay"
          :min="3"
          :max="10"
          :step="1"
          :marks="{ 3: '3s', 5: '5s', 7: '7s', 10: '10s' }"
          style="max-width: 260px"
        />
      </setting-item>
    </template>
  </setting-section>

  <!-- 播放器样式 -->
  <setting-section title="播放器样式" description="选择全屏播放界面的视觉样式">
    <setting-item title="播放器样式" :description="playerStyleDesc">
      <s-select
        :model-value="currentPlayerStyle"
        :options="playerStyleOptions"
        width="w-40 max-md:w-full"
        @update:model-value="updatePlayerStyle"
      />
    </setting-item>
  </setting-section>

  <!-- 底栏样式 -->
  <setting-section
    title="底栏样式"
    description="选择播放底栏的显示样式，迷你模式下可自定义快捷组件"
  >
    <setting-item title="底栏样式" description="贯穿：全宽底栏 / 迷你：浮动圆角底栏">
      <s-select
        v-model="setData.playBarStyle"
        :options="playBarStyleOptions"
        width="w-40 max-md:w-full"
      />
    </setting-item>

    <template v-if="setData.playBarStyle === 'mini'">
      <setting-item
        v-for="(slot, i) in 4"
        :key="i"
        :title="`快捷组件 ${i + 1}`"
        :description="`迷你底栏悬停时显示的第 ${i + 1} 个组件`"
      >
        <s-select
          :model-value="setData.playBarMiniSlots?.[i] || 'none'"
          :options="miniSlotOptions"
          width="w-40 max-md:w-full"
          @update:model-value="(val: any) => updateMiniSlot(i, val)"
        />
      </setting-item>
    </template>
  </setting-section>

  <!-- 本地歌词文件指定 -->
  <setting-section
    title="本地歌词文件"
    description="为当前歌曲指定本地 TTML/LRC 歌词文件（也可右键歌曲绑定）"
  >
    <template v-if="currentSongId">
      <setting-item :title="currentSongName" :description="localLyricPath || '未指定歌词文件'">
        <div class="flex items-center gap-2">
          <button
            class="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
            @click="selectLocalLyric"
          >
            选择文件
          </button>
          <button
            v-if="localLyricPath"
            class="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
            @click="clearLocalLyric"
          >
            清除
          </button>
        </div>
      </setting-item>
    </template>
    <div v-else class="p-4 text-sm text-gray-500 dark:text-gray-400 italic">请先播放一首歌曲</div>

    <!-- 已绑定歌词列表 -->
    <template v-if="boundLyrics.length > 0">
      <setting-item
        v-for="item in boundLyrics"
        :key="item.songId"
        :title="item.songName"
        :description="item.filePath.split(/[/\\]/).pop()"
      >
        <button
          class="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
          @click="removeBoundLyric(item.songId)"
        >
          解除绑定
        </button>
      </setting-item>
    </template>
  </setting-section>

  <!-- 桌面歌词设置 -->
  <setting-section
    title="桌面歌词"
    description="自定义桌面歌词的字体、颜色和描边（重启歌词窗口后生效）"
  >
    <!-- 字体 -->
    <setting-item title="字体" description="选择已安装的系统字体，留空使用默认">
      <div class="font-select-wrapper relative w-full max-w-[260px]">
        <input
          ref="fontInputRef"
          v-model="setData.lyricFontFamily"
          type="text"
          class="font-select-input w-full px-3 py-1.5 rounded-lg border text-sm bg-white dark:bg-white/10 outline-none transition-colors"
          :class="
            fontDropdownOpen
              ? 'font-select-input--open'
              : 'border-gray-300 dark:border-white/20 hover:border-gray-400 dark:hover:border-white/30'
          "
          placeholder="搜索字体..."
          @focus="openFontDropdown"
          @input="onFontSearchInput"
          @keydown.escape="fontDropdownOpen = false"
          @keydown.enter.prevent="onFontEnter"
          @keydown.down.prevent="onFontArrowDown"
          @keydown.up.prevent="onFontArrowUp"
        />
        <button
          v-if="setData.lyricFontFamily"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm leading-none"
          @click="clearFont"
        >
          &times;
        </button>
        <Transition name="fade">
          <div
            v-if="fontDropdownOpen && filteredFonts.length > 0"
            class="absolute z-50 mt-1 w-full max-h-[280px] overflow-y-auto rounded-xl border bg-white shadow-lg dark:bg-neutral-900 dark:border-neutral-700"
          >
            <div
              v-for="(font, idx) in filteredFonts"
              :key="font"
              class="flex cursor-pointer items-center px-3 py-2 text-sm transition-colors"
              :class="[
                idx === fontHighlightIndex
                  ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)]'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5',
                setData.lyricFontFamily === font ? 'font-medium' : ''
              ]"
              :style="{ fontFamily: font }"
              @mousedown.prevent="selectFont(font)"
              @mouseenter="fontHighlightIndex = idx"
            >
              {{ font }}
            </div>
          </div>
        </Transition>
      </div>
    </setting-item>

    <!-- 文本颜色 -->
    <setting-item title="文本颜色" description="歌词文字颜色，留空跟随主题">
      <div class="flex items-center gap-2">
        <input
          type="color"
          :value="setData.lyricTextColor || '#ffffff'"
          class="w-8 h-8 rounded cursor-pointer border border-gray-300 dark:border-white/20"
          @input="onColorInput($event, 'lyricTextColor')"
        />
        <button
          class="px-2 py-0.5 text-xs rounded-md text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
          @click="
            setData.lyricTextColor = '';
            sendLyricStyle();
          "
        >
          重置
        </button>
      </div>
    </setting-item>

    <!-- 已播放颜色 -->
    <setting-item title="已播放颜色" description="当前播放行的高亮颜色，留空使用封面取色">
      <div class="flex items-center gap-2">
        <input
          type="color"
          :value="setData.lyricPlayedColor || '#1db954'"
          class="w-8 h-8 rounded cursor-pointer border border-gray-300 dark:border-white/20"
          @input="onColorInput($event, 'lyricPlayedColor')"
        />
        <button
          class="px-2 py-0.5 text-xs rounded-md text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
          @click="
            setData.lyricPlayedColor = '';
            sendLyricStyle();
          "
        >
          重置
        </button>
      </div>
    </setting-item>

    <!-- 未播放颜色 -->
    <setting-item title="未播放颜色" description="未播放歌词行的文字颜色，留空跟随主题">
      <div class="flex items-center gap-2">
        <input
          type="color"
          :value="setData.lyricUnplayedColor || '#ffffff'"
          class="w-8 h-8 rounded cursor-pointer border border-gray-300 dark:border-white/20"
          @input="onColorInput($event, 'lyricUnplayedColor')"
        />
        <button
          class="px-2 py-0.5 text-xs rounded-md text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
          @click="
            setData.lyricUnplayedColor = '';
            sendLyricStyle();
          "
        >
          重置
        </button>
      </div>
    </setting-item>

    <!-- 描边颜色 -->
    <setting-item title="描边颜色" description="歌词文字描边/阴影颜色，留空无描边">
      <div class="flex items-center gap-2">
        <input
          type="color"
          :value="setData.lyricStrokeColor || '#000000'"
          class="w-8 h-8 rounded cursor-pointer border border-gray-300 dark:border-white/20"
          @input="onColorInput($event, 'lyricStrokeColor')"
        />
        <button
          class="px-2 py-0.5 text-xs rounded-md text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
          @click="
            setData.lyricStrokeColor = '';
            sendLyricStyle();
          "
        >
          重置
        </button>
      </div>
    </setting-item>

    <!-- 封面取色 -->
    <setting-item title="封面取色" description="自动跟随当前播放歌曲封面提取颜色">
      <n-switch v-model:value="setData.lyricUseCoverColor" @update:value="sendLyricStyle" />
    </setting-item>
  </setting-section>

  <!-- 侧边栏项目排序 -->
  <setting-section
    :title="t('settings.interface.sidebarOrder')"
    :description="t('settings.interface.sidebarOrderDesc')"
  >
    <setting-item
      :title="t('settings.interface.sidebarHoverExpand')"
      :description="t('settings.interface.sidebarHoverExpandDesc')"
    >
      <n-switch v-model:value="sidebarHoverExpand" />
    </setting-item>
    <div class="sidebar-sorter">
      <div
        v-for="(item, index) in sidebarItems"
        :key="item.path"
        class="flex items-center justify-between px-3 py-2 rounded-lg border transition-all"
        :class="
          item.hidden
            ? 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/8 opacity-50'
            : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/8 hover:bg-gray-100 dark:hover:bg-white/8'
        "
      >
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400 dark:text-white/40 min-w-[16px]">{{ index + 1 }}</span>
          <i :class="item.icon" class="iconfont text-base text-gray-600 dark:text-white/80"></i>
          <span class="text-[13px] text-gray-800 dark:text-white/90">{{ item.name }}</span>
        </div>
        <div class="flex gap-1">
          <button
            class="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-gray-800 dark:hover:text-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            :disabled="index === 0"
            @click="moveUp(index)"
            title="上移"
          >
            <i class="ri-arrow-up-s-line"></i>
          </button>
          <button
            class="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-gray-800 dark:hover:text-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            :disabled="index === sidebarItems.length - 1"
            @click="moveDown(index)"
            title="下移"
          >
            <i class="ri-arrow-down-s-line"></i>
          </button>
          <button
            v-if="item.path !== '/set'"
            class="w-7 h-7 flex items-center justify-center rounded-md transition-colors"
            :class="
              item.hidden
                ? 'text-gray-400 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/10'
                : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
            "
            @click="toggleHidden(item.path)"
            :title="item.hidden ? '显示' : '隐藏'"
          >
            <i :class="item.hidden ? 'ri-eye-off-line' : 'ri-eye-line'"></i>
          </button>
        </div>
      </div>
    </div>
  </setting-section>
</template>

<script setup lang="ts">
import { NSlider, NSwitch } from 'naive-ui';
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { getAllStyles } from '@/playerStyles';
import homeRouter from '@/router/home';
import { usePlayerStore } from '@/store/modules/player';
import { isElectron } from '@/utils';
import {
  getLocalLyricMap,
  getLocalLyricPath,
  readLocalLyricFile,
  removeLocalLyricPath,
  selectLyricFile,
  setLocalLyricPath
} from '@/utils/localLyricStorage';
import { parseTtml } from '@/utils/ttmlParser';
import { parseLyrics } from '@/utils/yrcParser';

import { SETTINGS_DATA_KEY } from '../keys';
import SettingItem from '../SettingItem.vue';
import SettingSection from '../SettingSection.vue';
import SSelect from '../SSelect.vue';

const { t } = useI18n();
const setData = inject(SETTINGS_DATA_KEY)!;
const sidebarHoverExpand = computed({
  get: () => setData.value.sidebarHoverExpand !== false,
  set: (value: boolean) => {
    setData.value = { ...setData.value, sidebarHoverExpand: value };
  }
});

// 布局模式选项
const layoutModeOptions = computed(() => [
  { label: '经典布局', value: 'classic' },
  { label: '浮动覆盖', value: 'overlay' }
]);

// 自动收起延迟（双向绑定到 setData）
const overlayCollapseDelay = computed({
  get: () => setData.value?.overlayAutoCollapseDelay ?? 5,
  set: (val: number) => {
    setData.value = { ...setData.value, overlayAutoCollapseDelay: val };
  }
});

// ==================== 播放器样式 ====================
const currentPlayerStyle = ref('default');

const playerStyleOptions = computed(() =>
  getAllStyles().map((s) => ({ label: s.label, value: s.key }))
);

const playerStyleDesc = computed(() =>
  getAllStyles()
    .map((s) => s.label)
    .join(' / ')
);

// 从 localStorage 加载当前播放器样式
function loadPlayerStyle() {
  try {
    const saved = localStorage.getItem('music-full-config');
    if (saved) {
      const parsed = JSON.parse(saved);
      currentPlayerStyle.value = parsed.playerStyle || 'default';
    }
  } catch {
    // Keep the default style if the saved preference is invalid.
  }
}
loadPlayerStyle();

const updatePlayerStyle = (val: string) => {
  currentPlayerStyle.value = val;
  try {
    const saved = localStorage.getItem('music-full-config');
    const config = saved ? JSON.parse(saved) : {};
    config.playerStyle = val;
    localStorage.setItem('music-full-config', JSON.stringify(config));
    // 触发更新事件
    window.dispatchEvent(new CustomEvent('music-full-config-updated'));
  } catch (e) {
    console.error('更新播放器样式失败:', e);
  }
};

// 监听外部变更
window.addEventListener('music-full-config-updated', loadPlayerStyle);
onUnmounted(() => {
  window.removeEventListener('music-full-config-updated', loadPlayerStyle);
});

// 底栏样式选项
const playBarStyleOptions = computed(() => [
  { label: '贯穿', value: 'full' },
  { label: '迷你底栏', value: 'mini' }
]);

// 迷你底栏快捷组件选项
const miniSlotOptions = computed(() => [
  { label: '空', value: 'none' },
  { label: '播放模式', value: 'playMode' },
  { label: '收藏', value: 'favorite' },
  { label: '桌面歌词', value: 'lyric' },
  { label: '播放列表', value: 'playlist' },
  { label: '音量', value: 'volume' },
  { label: '高级控制', value: 'advanced' },
  { label: '高潮标记', value: 'climax' },
  { label: '歌词隐喻', value: 'metaphor' },
  { label: '重新解析', value: 'reparse' }
]);

// 更新迷你底栏槽位
function updateMiniSlot(index: number, value: any) {
  const slots = [...(setData.value.playBarMiniSlots || ['none', 'none', 'none', 'none'])];
  slots[index] = value;
  setData.value = { ...setData.value, playBarMiniSlots: slots };
}
const playerStore = usePlayerStore();

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function sendLyricStyle() {
  window.electron.ipcRenderer.send('lyric-update-style', {
    fontFamily: setData.value.lyricFontFamily || '',
    textColor: setData.value.lyricTextColor || '',
    playedColor: setData.value.lyricPlayedColor || '',
    unplayedColor: setData.value.lyricUnplayedColor || '',
    strokeColor: setData.value.lyricStrokeColor || '',
    useCoverColor: setData.value.lyricUseCoverColor !== false
  });
}

function debouncedSendLyricStyle() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(sendLyricStyle, 400);
}

function onColorInput(event: Event, key: string) {
  const target = event.target as HTMLInputElement;
  setData.value[key] = target.value;
  sendLyricStyle();
}

// ── 字体选择下拉 ──
const fontList = ref<string[]>([]);
const fontDropdownOpen = ref(false);
const fontSearchQuery = ref('');
const fontHighlightIndex = ref(0);
const fontInputRef = ref<HTMLInputElement | null>(null);

const filteredFonts = computed(() => {
  const q = fontSearchQuery.value.toLowerCase().trim();
  if (!q) return fontList.value.slice(0, 200);
  return fontList.value.filter((name) => name.toLowerCase().includes(q)).slice(0, 200);
});

function openFontDropdown() {
  fontDropdownOpen.value = true;
  fontHighlightIndex.value = 0;
}

function onFontSearchInput() {
  fontSearchQuery.value = setData.value.lyricFontFamily || '';
  fontDropdownOpen.value = true;
  fontHighlightIndex.value = 0;
  debouncedSendLyricStyle();
}

function onFontEnter() {
  if (filteredFonts.value[fontHighlightIndex.value]) {
    selectFont(filteredFonts.value[fontHighlightIndex.value]);
  }
}

function onFontArrowDown() {
  fontHighlightIndex.value = Math.min(fontHighlightIndex.value + 1, filteredFonts.value.length - 1);
  scrollFontIntoView();
}

function onFontArrowUp() {
  fontHighlightIndex.value = Math.max(fontHighlightIndex.value - 1, 0);
  scrollFontIntoView();
}

function scrollFontIntoView() {
  // 滚动到高亮项
}

function selectFont(name: string) {
  setData.value.lyricFontFamily = name;
  fontDropdownOpen.value = false;
  fontSearchQuery.value = name;
  sendLyricStyle();
}

function clearFont() {
  setData.value.lyricFontFamily = '';
  fontSearchQuery.value = '';
  sendLyricStyle();
  fontInputRef.value?.focus();
}

function onFontClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest('.font-select-wrapper')) {
    fontDropdownOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', onFontClickOutside);
  window.api.invoke('get-system-fonts').then((fonts: string[]) => {
    fontList.value = fonts as string[];
  });
});

onUnmounted(() => {
  document.removeEventListener('click', onFontClickOutside);
});

// 本地歌词相关
const currentSongId = computed(() => playerStore.playMusic?.id?.toString() || '');
const currentSongName = computed(() => playerStore.playMusic?.name || '');

const localLyricPath = computed(() => {
  if (!currentSongId.value) return null;
  return getLocalLyricPath(currentSongId.value);
});

// 所有已绑定的歌词列表
const boundLyrics = computed(() => {
  const map = getLocalLyricMap();
  const playerStore = usePlayerStore();
  return Object.entries(map).map(([songId, filePath]) => {
    // 尝试从播放列表中获取歌曲名
    let songName = `歌曲 ${songId}`;
    const playList = playerStore.playList;
    if (playList) {
      const found = playList.find((item: any) => item.id?.toString() === songId);
      if (found) songName = found.name || songName;
    }
    return { songId, songName, filePath };
  });
});

async function selectLocalLyric() {
  if (!currentSongId.value) return;
  const filePath = await selectLyricFile();
  if (filePath) {
    setLocalLyricPath(currentSongId.value, filePath);
    // 重新加载歌词
    await reloadCurrentLyric();
  }
}

function clearLocalLyric() {
  if (!currentSongId.value) return;
  removeLocalLyricPath(currentSongId.value);
}

function removeBoundLyric(songId: string) {
  removeLocalLyricPath(songId);
}

async function reloadCurrentLyric() {
  if (!currentSongId.value) return;
  const filePath = getLocalLyricPath(currentSongId.value);
  if (!filePath) return;

  const content = await readLocalLyricFile(filePath);
  if (!content) return;

  // 根据文件扩展名判断格式
  const isTtml = filePath.toLowerCase().endsWith('.ttml');
  if (isTtml) {
    const ttmlLines = parseTtml(content);
    // 触发歌词更新
    playerStore.playMusic.lyric = {
      lrcArray: ttmlLines,
      lrcTimeArray: ttmlLines.map((l) => l.startTime || 0)
    };
  } else {
    // LRC 格式
    const { lyrics } = parseLyrics(content);
    const lrcArray = lyrics.map((l) => ({
      text: l.fullText,
      trText: '',
      words: l.words?.map((w) => ({ text: w.text, startTime: w.startTime, duration: w.duration })),
      hasWordByWord: l.words && l.words.length > 1,
      startTime: l.startTime,
      duration: l.duration
    }));
    playerStore.playMusic.lyric = {
      lrcArray,
      lrcTimeArray: lrcArray.map((l) => l.startTime || 0)
    };
  }
}

// Use the same route catalogue as the sidebar, including newly added pages.
const allSidebarRoutes = homeRouter
  .filter((item) => !item.meta.hideInSidebar && (!item.meta.electronOnly || isElectron))
  .map((item) => ({ path: item.path, icon: item.meta.icon, nameKey: item.meta.title }));

// 启动默认页选项
const defaultPageOptions = computed(() =>
  allSidebarRoutes.map((item) => ({ label: t(item.nameKey), value: item.path }))
);

// 侧边栏项目列表（带翻译名称）
const sidebarItems = computed(() => {
  const order = setData.value?.sidebarItems?.order || [];
  const hidden = setData.value?.sidebarItems?.hidden || [];

  // 按用户定义的顺序排列
  const sorted = [...allSidebarRoutes].sort((a, b) => {
    const indexA = order.indexOf(a.path);
    const indexB = order.indexOf(b.path);
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  });

  return sorted.map((item) => ({
    ...item,
    name: t(item.nameKey),
    hidden: hidden.includes(item.path)
  }));
});

// 上移
function moveUp(index: number) {
  if (index <= 0) return;
  const order = getOrderedPaths();
  [order[index - 1], order[index]] = [order[index], order[index - 1]];
  saveOrder(order);
}

// 下移
function moveDown(index: number) {
  const order = getOrderedPaths();
  if (index >= order.length - 1) return;
  [order[index], order[index + 1]] = [order[index + 1], order[index]];
  saveOrder(order);
}

// 切换隐藏状态
function toggleHidden(path: string) {
  if (path === '/set') return; // 设置页不可隐藏
  const hidden = setData.value?.sidebarItems?.hidden || [];
  const index = hidden.indexOf(path);
  if (index === -1) {
    hidden.push(path);
  } else {
    hidden.splice(index, 1);
  }
  setData.value.sidebarItems = {
    ...setData.value.sidebarItems,
    hidden: [...hidden]
  };
}

// 获取当前顺序
function getOrderedPaths(): string[] {
  // Match the displayed rows; obsolete paths must not shift the button indexes.
  return sidebarItems.value.map((item) => item.path);
}

// 保存顺序
function saveOrder(order: string[]) {
  setData.value.sidebarItems = {
    ...setData.value?.sidebarItems,
    order
  };
}
</script>

<style scoped>
.sidebar-sorter {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 280px;
  max-width: 400px;
}

.font-select-wrapper input {
  padding-right: 24px;
}

.font-select-input--open {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px rgba(var(--accent-color-rgb, 136, 136, 136), 0.2);
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
