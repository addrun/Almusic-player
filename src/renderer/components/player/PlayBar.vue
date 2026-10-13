<template>
  <div class="play-bar-root" :class="{ mobile: settingsStore.isMobile }">
    <!-- ==================== Full Mode (贯穿) ==================== -->
    <div
      v-if="isFullMode"
      class="music-play-bar animate__animated animate__bounceInUp"
      :class="[
        showFullStyle ? 'play-bar-opcity' : '',
        showFullStyle && forcedBarTextColor === 'black' ? 'play-bar-forced-black' : '',
        showFullStyle && forcedBarTextColor === 'white' ? 'play-bar-forced-white' : '',
        showFullStyle && playBarCollapsed ? 'play-bar-collapsed' : '',
        showFullStyle && MusicFullRef?.musicFullRef?.config?.hidePlayBar ? 'play-bar-fade-out' : ''
      ]"
      @mousemove="handlePlayBarMouseMove"
      :style="{
        color: showFullStyle
          ? forcedBarTextColor === 'black'
            ? '#000000'
            : forcedBarTextColor === 'white'
              ? '#ffffff'
              : textColors.theme === 'dark'
                ? '#000000'
                : '#ffffff'
          : settingsStore.theme === 'dark'
            ? '#ffffff'
            : '#000000'
      }"
    >
      <!-- Progress bar at top -->
      <div class="music-time custom-slider">
        <div class="climax-track" v-if="climaxStore.hasSegments && allTime > 0">
          <div
            v-for="(seg, i) in climaxStore.segments"
            :key="'climax-' + i"
            class="climax-segment"
            :class="{ 'climax-active': nowTime >= seg.start && nowTime <= seg.end }"
            :style="{
              left: (seg.start / allTime) * 100 + '%',
              width: Math.max(0.5, ((seg.end - seg.start) / allTime) * 100) + '%'
            }"
          ></div>
        </div>
        <div
          class="slider-hover-tooltip"
          v-if="showSliderTooltip"
          :style="{ left: tooltipX + 'px' }"
        >
          <div v-if="hoverLyric" class="slider-hover-lyric">{{ hoverLyric }}</div>
          <div class="slider-hover-time">{{ hoverTimeStr }}</div>
        </div>
        <n-slider
          v-model:value="timeSlider"
          :step="1"
          :max="allTime"
          :min="0"
          :tooltip="false"
          @mouseenter="showSliderTooltip = true"
          @mouseleave="!isDragging && (showSliderTooltip = false)"
          @mousemove="handleSliderMouseMove"
          @mousedown="handleSliderMouseDown"
        ></n-slider>
      </div>

      <!-- Cover -->
      <div
        class="play-bar-img-wrapper"
        :class="{ 'no-hover-effect': isOverlayMode }"
        :style="coverTransition.blurStyle.value"
        @click="setMusicFull"
      >
        <n-image
          :src="coverTransition.displaySrc.value"
          class="play-bar-img"
          lazy
          preview-disabled
        />
        <n-image
          v-if="coverTransition.overlaySrc.value"
          :src="coverTransition.overlaySrc.value"
          class="play-bar-img-overlay"
          :style="{ opacity: coverTransition.overlayOpacity.value }"
          lazy
          preview-disabled
        />
        <div v-if="playMusic?.playLoading" class="loading-overlay">
          <i class="ri-loader-4-line loading-icon"></i>
        </div>
        <div v-if="!isOverlayMode" class="hover-arrow">
          <div class="hover-content">
            <i
              class="text-3xl"
              :class="musicFullVisible ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line'"
            ></i>
            <span class="hover-text">{{
              musicFullVisible ? t('player.playBar.collapse') : t('player.playBar.expand')
            }}</span>
          </div>
        </div>
      </div>

      <!-- Song info -->
      <div class="music-content" :style="coverTransition.blurStyle.value">
        <div class="music-content-title flex items-center">
          <n-ellipsis class="text-ellipsis" line-clamp="1">
            <p v-html="playMusic?.name || ''"></p>
          </n-ellipsis>
          <span v-if="playbackRate !== 1.0" class="playback-rate-badge">{{ playbackRate }}x</span>
        </div>
        <div class="music-content-name">
          <n-ellipsis class="text-ellipsis" line-clamp="1">
            <span
              v-for="(a, i) in artistList"
              :key="i"
              class="cursor-pointer hover:text-[var(--accent-color)]"
              @click.stop="handleArtistClick(a.id)"
              >{{ a.name }}{{ i < artistList.length - 1 ? ' / ' : '' }}</span
            >
          </n-ellipsis>
        </div>
      </div>

      <!-- Play controls -->
      <div class="music-buttons">
        <div class="music-buttons-prev" @click="handlePrev"><i class="iconfont icon-prev"></i></div>
        <div class="music-buttons-play" @click="playMusicEvent">
          <i class="iconfont icon" :class="play ? 'icon-stop' : 'icon-play'"></i>
        </div>
        <div class="music-buttons-next" @click="handleNext"><i class="iconfont icon-next"></i></div>
      </div>

      <!-- Function buttons -->
      <div class="audio-button">
        <!-- Volume -->
        <div class="audio-volume custom-slider" @wheel.prevent="handleVolumeWheel">
          <div class="volume-icon" @click="mute">
            <i class="iconfont" :class="getVolumeIcon"></i>
          </div>
          <div class="volume-slider">
            <div class="volume-percentage" :class="{ 'volume-percentage-disabled': isMuted }">
              {{ Math.round(volumeSlider) }}%
            </div>
            <n-slider
              v-model:value="volumeSlider"
              :step="0.01"
              :tooltip="false"
              :disabled="isMuted"
              vertical
            ></n-slider>
          </div>
        </div>

        <!-- Play mode -->
        <n-tooltip v-if="!isMobile" trigger="hover" :z-index="9999999">
          <template #trigger>
            <i
              class="iconfont"
              :class="[playModeIcon, { 'intelligence-active': playMode === 3 }]"
              @click="togglePlayMode"
            ></i>
          </template>
          {{ playModeText }}
        </n-tooltip>

        <!-- Favorite -->
        <n-tooltip v-if="!isMobile" trigger="hover" :z-index="9999999">
          <template #trigger>
            <i
              class="iconfont"
              :class="{
                'like-active': isFavorite,
                'ri-heart-3-fill': isFavorite,
                'ri-heart-3-line': !isFavorite
              }"
              @click="toggleFavorite"
            ></i>
          </template>
          {{ t('player.playBar.like') }}
        </n-tooltip>

        <!-- Lyric window -->
        <n-tooltip v-if="isElectron" trigger="hover" :z-index="9999999">
          <template #trigger>
            <i
              class="iconfont ri-netease-cloud-music-line"
              :class="{
                'text-[var(--accent-color)]': isLyricWindowOpen,
                'disabled-icon': !playMusic?.id
              }"
              @click="playMusic?.id && openLyricWindow()"
            ></i>
          </template>
          {{ playMusic?.id ? t('player.playBar.lyric') : t('player.playBar.noSongPlaying') }}
        </n-tooltip>

        <!-- Reparse -->
        <n-tooltip v-if="playMusic?.id && isElectron" trigger="hover" :z-index="9999999">
          <template #trigger>
            <reparse-popover v-if="playMusic?.id" />
          </template>
          {{ t('player.playBar.reparse') }}
        </n-tooltip>

        <!-- Advanced controls -->
        <advanced-controls-popover />

        <!-- Climax editor -->
        <n-tooltip trigger="hover" :z-index="9999999" v-if="isElectron">
          <template #trigger>
            <i
              class="iconfont ri-soundcloud-fill"
              :class="{ 'disabled-icon': !playMusic?.id }"
              @click="playMusic?.id && (showClimaxEditor = true)"
            ></i>
          </template>
          标记高潮
        </n-tooltip>

        <!-- Metaphor -->
        <n-tooltip v-if="metaphorButtonVisible" trigger="hover" :z-index="9999999">
          <template #trigger>
            <i
              class="iconfont ri-quill-pen-line"
              :class="{ 'text-[var(--accent-color)]': showMetaphorPanel }"
              @click="showMetaphorPanel = !showMetaphorPanel"
            ></i>
          </template>
          歌词隐喻分析
        </n-tooltip>

        <!-- Playlist -->
        <n-tooltip trigger="hover" :z-index="9999999">
          <template #trigger>
            <i class="iconfont icon-list" @click="openPlayListDrawer"></i>
          </template>
          {{ t('player.playBar.playList') }}
        </n-tooltip>
      </div>
    </div>

    <!-- ==================== Mini Mode (迷你) ==================== -->
    <template v-else>
      <!-- Progress bar (fixed at window bottom, synced with mini-bar) -->
      <div class="mini-bar-progress" :style="miniProgressStyle">
        <div class="fp-climax" v-if="climaxStore.hasSegments && allTime > 0">
          <div
            v-for="(seg, i) in climaxStore.segments"
            :key="'climax-' + i"
            class="fp-climax-seg"
            :class="{ 'fp-climax-active': nowTime >= seg.start && nowTime <= seg.end }"
            :style="{
              left: (seg.start / allTime) * 100 + '%',
              width: Math.max(0.5, ((seg.end - seg.start) / allTime) * 100) + '%'
            }"
          ></div>
        </div>
        <div class="fp-tooltip" v-if="showSliderTooltip" :style="{ left: tooltipX + 'px' }">
          <div v-if="hoverLyric" class="fp-tooltip-lyric">{{ hoverLyric }}</div>
          <div class="fp-tooltip-time">{{ hoverTimeStr }}</div>
        </div>
        <n-slider
          v-model:value="timeSlider"
          :step="1"
          :max="allTime"
          :min="0"
          :tooltip="false"
          @mouseenter="showSliderTooltip = true"
          @mouseleave="!isDragging && (showSliderTooltip = false)"
          @mousemove="handleSliderMouseMove"
          @mousedown="handleSliderMouseDown"
        ></n-slider>
      </div>

      <!-- Mini bar -->
      <div
        ref="miniBarRef"
        class="floating-bar mini-bar"
        :class="{
          'mini-expanded': miniHovered,
          'bar-hidden': showFullStyle && MusicFullRef?.musicFullRef?.config?.hidePlayBar
        }"
        :style="miniBarStyle"
        @mouseenter="miniHovered = true"
        @mouseleave="miniHovered = false"
      >
        <!-- Drag handle (hover only) -->
        <div class="mini-bar-handle" @mousedown="startDragMiniBar"></div>

        <!-- Cover -->
        <div class="bar-cover" :style="coverTransition.blurStyle.value" @click="setMusicFull">
          <n-image
            :src="coverTransition.displaySrc.value"
            class="bar-cover-img"
            lazy
            preview-disabled
          />
          <n-image
            v-if="coverTransition.overlaySrc.value"
            :src="coverTransition.overlaySrc.value"
            class="bar-cover-img-overlay"
            :style="{ opacity: coverTransition.overlayOpacity.value }"
            lazy
            preview-disabled
          />
          <div v-if="playMusic?.playLoading" class="bar-cover-loading">
            <i class="ri-loader-4-line loading-icon"></i>
          </div>
        </div>

        <!-- Song info -->
        <div class="bar-song-info" :style="coverTransition.blurStyle.value">
          <div class="bar-song-title">
            <n-ellipsis line-clamp="1"><p v-html="playMusic?.name || ''"></p></n-ellipsis>
          </div>
          <div class="bar-song-artist">
            <n-ellipsis line-clamp="1">
              <span
                v-for="(a, i) in artistList"
                :key="i"
                class="cursor-pointer hover:text-[var(--accent-color)]"
                @click.stop="handleArtistClick(a.id)"
                >{{ a.name }}{{ i < artistList.length - 1 ? ' / ' : '' }}</span
              >
            </n-ellipsis>
          </div>
        </div>

        <!-- Expanded controls (hover) -->
        <div class="mini-expanded-area" :class="{ 'area-visible': miniHovered }">
          <!-- Play controls -->
          <div class="mini-controls">
            <div class="bar-btn" @click="handlePrev"><i class="iconfont icon-prev"></i></div>
            <div class="bar-btn-play" @click="playMusicEvent">
              <i class="iconfont icon" :class="play ? 'icon-stop' : 'icon-play'"></i>
            </div>
            <div class="bar-btn" @click="handleNext"><i class="iconfont icon-next"></i></div>
          </div>

          <!-- 4-slot grid -->
          <div class="mini-slots">
            <template v-for="(slot, i) in miniSlots" :key="i">
              <div class="mini-slot">
                <!-- PlayMode -->
                <div v-if="slot === 'playMode'" class="bar-btn" @click="togglePlayMode">
                  <i
                    class="iconfont"
                    :class="[playModeIcon, { 'intelligence-active': playMode === 3 }]"
                  ></i>
                </div>
                <!-- Favorite -->
                <div
                  v-else-if="slot === 'favorite'"
                  class="bar-btn"
                  :class="{ 'like-active': isFavorite }"
                  @click="toggleFavorite"
                >
                  <i
                    class="iconfont"
                    :class="isFavorite ? 'ri-heart-3-fill' : 'ri-heart-3-line'"
                  ></i>
                </div>
                <!-- Lyric -->
                <div
                  v-else-if="slot === 'lyric'"
                  class="bar-btn"
                  :class="{ 'disabled-icon': !playMusic?.id }"
                  @click="playMusic?.id && openLyricWindow()"
                >
                  <i
                    class="iconfont ri-netease-cloud-music-line"
                    :class="{ 'text-[var(--accent-color)]': isLyricWindowOpen }"
                  ></i>
                </div>
                <!-- Playlist -->
                <div v-else-if="slot === 'playlist'" class="bar-btn" @click="openPlayListDrawer">
                  <i class="iconfont icon-list"></i>
                </div>
                <!-- Volume -->
                <div
                  v-else-if="slot === 'volume'"
                  class="bar-action-volume"
                  @wheel.prevent="handleVolumeWheel"
                >
                  <div class="volume-inner">
                    <div class="volume-slider">
                      <n-slider
                        v-model:value="volumeSlider"
                        :step="0.01"
                        :tooltip="false"
                        :disabled="isMuted"
                      ></n-slider>
                    </div>
                    <div class="bar-btn volume-icon" @click="mute">
                      <i class="iconfont" :class="getVolumeIcon"></i>
                    </div>
                  </div>
                </div>
                <!-- Advanced (EQ + timer + speed) -->
                <advanced-controls-popover v-else-if="slot === 'advanced'" />
                <!-- Climax -->
                <div
                  v-else-if="slot === 'climax'"
                  class="bar-btn"
                  :class="{ 'disabled-icon': !playMusic?.id }"
                  @click="playMusic?.id && (showClimaxEditor = true)"
                >
                  <i class="iconfont ri-soundcloud-fill"></i>
                </div>
                <!-- Metaphor -->
                <div
                  v-else-if="slot === 'metaphor' && metaphorButtonVisible"
                  class="bar-btn"
                  :class="{ 'text-[var(--accent-color)]': showMetaphorPanel }"
                  @click="showMetaphorPanel = !showMetaphorPanel"
                >
                  <i class="iconfont ri-quill-pen-line"></i>
                </div>
                <!-- Reparse -->
                <div v-else-if="slot === 'reparse' && playMusic?.id && isElectron" class="bar-btn">
                  <reparse-popover />
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </template>

    <!-- ==================== Common ==================== -->
    <music-full-wrapper
      v-if="!isOverlayMode"
      ref="MusicFullRef"
      v-model="musicFullVisible"
      :background="background"
    />

    <metaphor-panel
      v-model="showMetaphorPanel"
      :lyrics="lyricsText"
      :song-name="songName"
      :artist="artistName"
      :album-id="albumId"
      @configure="showMetaphorConfig = true"
    />
    <metaphor-config-modal v-model="showMetaphorConfig" />
    <climax-editor v-model="showClimaxEditor" />
  </div>
</template>

<script lang="ts" setup>
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import ClimaxEditor from '@/components/ClimaxEditor.vue';
import MusicFullWrapper from '@/components/lyric/MusicFullWrapper.vue';
import AdvancedControlsPopover from '@/components/player/AdvancedControlsPopover.vue';
import ReparsePopover from '@/components/player/ReparsePopover.vue';
import { useCoverTransition } from '@/composables/useCoverTransition';
import MetaphorConfigModal from '@/features/lyric-metaphor/MetaphorConfigModal.vue';
import MetaphorPanel from '@/features/lyric-metaphor/MetaphorPanel.vue';
import { isFeatureEnabled } from '@/features/store';
import {
  allTime,
  artistList,
  getLyricTextAtTime,
  isLyricWindowOpen,
  lrcArray,
  nowTime,
  openLyric,
  playMusic,
  textColors
} from '@/hooks/MusicHook';
import { useArtist } from '@/hooks/useArtist';
import { useCoverColor } from '@/hooks/useCoverColor';
import { useFavorite } from '@/hooks/useFavorite';
import { usePlaybackControl } from '@/hooks/usePlaybackControl';
import { usePlayMode } from '@/hooks/usePlayMode';
import { useVolumeControl } from '@/hooks/useVolumeControl';
import { audioService } from '@/services/audioService';
import { useClimaxStore } from '@/store/modules/climax';
import { usePlayerStore } from '@/store/modules/player';
import { useSettingsStore } from '@/store/modules/settings';
import { useTransitionStore } from '@/store/modules/transition';
import { getImgUrl, isElectron, isMobile, secondToMinute } from '@/utils';
import { animateGradient } from '@/utils/linearColor';

const playerStore = usePlayerStore();
const climaxStore = useClimaxStore();
const settingsStore = useSettingsStore();
const transitionStore = useTransitionStore();
useCoverColor();
const { t } = useI18n();

// ==================== 封面过渡动画（GSAP 驱动动态模糊 + 覆盖层渐显 swap）====================
const coverTransition = useCoverTransition({
  currentSrc: computed(() => getImgUrl(playMusic?.value?.picUrl, '100y100')),
  formatNextUrl: (raw) => getImgUrl(raw, '100y100')
});

// 浮动覆盖布局模式判断
const isOverlayMode = computed(
  () => settingsStore.setData?.layoutMode === 'overlay' && !settingsStore.isMobile
);

const { isPlaying: play, playMusicEvent, handleNext, handlePrev } = usePlaybackControl();
const {
  isMuted,
  volumeSlider,
  volumeIcon: getVolumeIcon,
  mute,
  handleVolumeWheel
} = useVolumeControl();
const { isFavorite, toggleFavorite } = useFavorite();
const { playMode, playModeIcon, playModeText, togglePlayMode } = usePlayMode();
const { playbackRate } = storeToRefs(playerStore);

// ==================== Background ====================
const background = ref('#000');
watch(
  () => playerStore.playMusic,
  async () => {
    if (playMusic?.value?.backgroundColor)
      background.value = playMusic.value.backgroundColor as string;
  },
  { immediate: true, deep: true }
);

// ==================== Smart Mix crossfade UI ====================
// crossfade 开始时渐变到下一首背景色，结束时渐回当前曲背景色
watch(
  () => transitionStore.isCrossfadingUI,
  (isCrossfading) => {
    if (isCrossfading && transitionStore.nextBackgroundColor) {
      animateGradient(
        background.value,
        transitionStore.nextBackgroundColor,
        (v) => {
          background.value = v;
        },
        400
      );
    } else {
      const targetBg = playMusic?.value?.backgroundColor as string;
      if (targetBg) {
        animateGradient(
          background.value,
          targetBg,
          (v) => {
            background.value = v;
          },
          400
        );
      }
    }
  }
);

// ==================== Climax segments ====================
watch(
  () => playMusic.value?.id,
  async (newId) => {
    if (newId) climaxStore.loadSegments(String(newId));
    else climaxStore.clear();
  },
  { immediate: true }
);

// ==================== Play bar style ====================
const isFullMode = computed(() => settingsStore.setData?.playBarStyle !== 'mini');
const miniSlots = computed(
  () => settingsStore.setData?.playBarMiniSlots || ['playMode', 'favorite', 'playlist', 'volume']
);

// ==================== Progress slider (shared) ====================
const isDragging = ref(false);
const dragValue = ref(0);
const showSliderTooltip = ref(false);
const tooltipX = ref(0);
const hoverLyric = ref<string | null>(null);
const hoverTimeStr = ref('');

const timeSlider = computed({
  get: () => (isDragging.value ? dragValue.value : nowTime.value),
  set: (val: number) => {
    if (isDragging.value) {
      dragValue.value = val;
    } else {
      audioService.seek(val);
      nowTime.value = val;
    }
  }
});

const handleSliderMouseDown = () => {
  isDragging.value = true;
  dragValue.value = nowTime.value;
  showSliderTooltip.value = true;
  document.addEventListener('mouseup', handleSliderMouseUp, { once: true });
};

const handleSliderMouseUp = () => {
  if (isDragging.value) {
    audioService.seek(dragValue.value);
    nowTime.value = dragValue.value;
    isDragging.value = false;
    showSliderTooltip.value = false;
  }
};

const handleSliderMouseMove = (e: MouseEvent) => {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const hoverTimeSec = pct * allTime.value;
  tooltipX.value = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
  hoverTimeStr.value = `${secondToMinute(hoverTimeSec)} / ${secondToMinute(allTime.value)}`;
  hoverLyric.value = getLyricTextAtTime(hoverTimeSec);
};

// ==================== Mini bar drag ====================
const miniHovered = ref(false);
const miniBarX = ref<number>(-1);

try {
  const saved = localStorage.getItem('miniBarPosition');
  if (saved !== null) miniBarX.value = parseFloat(saved);
} catch {}

const miniBarStyle = computed(() => {
  if (miniBarX.value >= 0) {
    return { left: miniBarX.value + 'px', right: 'auto', transform: 'none' };
  }
  return {};
});

// ==================== Mini bar width sync (for progress bar) ====================
const miniBarRef = ref<HTMLElement | null>(null);
const miniBarActualWidth = ref(280);
let miniBarResizeObserver: ResizeObserver | null = null;

const miniProgressStyle = computed(() => {
  const width = miniBarActualWidth.value + 'px';
  if (miniBarX.value >= 0) {
    return { left: miniBarX.value + 'px', right: 'auto', transform: 'none', width };
  }
  return { width };
});

function setupResizeObserver() {
  if (!miniBarRef.value) return;
  miniBarActualWidth.value = miniBarRef.value.offsetWidth;
  miniBarResizeObserver?.disconnect();
  miniBarResizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      miniBarActualWidth.value = entry.contentRect.width;
    }
  });
  miniBarResizeObserver.observe(miniBarRef.value);
}

watch(miniBarRef, (el) => {
  if (el) setupResizeObserver();
});

const startDragMiniBar = (e: MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  const barEl = (e.currentTarget as HTMLElement).closest('.floating-bar') as HTMLElement;
  if (!barEl) return;
  const barRect = barEl.getBoundingClientRect();
  const startX = e.clientX;
  const startLeft = barRect.left;

  const onMove = (moveEvent: MouseEvent) => {
    const delta = moveEvent.clientX - startX;
    let newLeft = startLeft + delta;
    const maxLeft = window.innerWidth - barRect.width;
    newLeft = Math.max(0, Math.min(maxLeft, newLeft));
    miniBarX.value = newLeft;
  };

  const onUp = () => {
    if (miniBarX.value >= 0) {
      try {
        localStorage.setItem('miniBarPosition', String(miniBarX.value));
      } catch {}
    }
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
};

// ==================== Music full ====================
const MusicFullRef = ref<any>(null);
const showClimaxEditor = ref(false);
const showMetaphorPanel = ref(false);
const showMetaphorConfig = ref(false);

const musicFullVisible = computed({
  get: () => playerStore.musicFull,
  set: (value) => playerStore.setMusicFull(value)
});

// overlay 模式下始终显示全屏样式（透明背景、渐隐等），不依赖 musicFullVisible
const showFullStyle = computed(() => isOverlayMode.value || musicFullVisible.value);

const setMusicFull = () => {
  if (isOverlayMode.value) return; // overlay 模式下不切换全屏状态
  musicFullVisible.value = !musicFullVisible.value;
  if (musicFullVisible.value) settingsStore.showArtistDrawer = false;
};

// ==================== Player style detection (frenzy/magazine → black, stage → white) ====================
const forcedBarTextColor = ref<'black' | 'white' | null>(null);
function updatePlayerMode() {
  try {
    const saved = localStorage.getItem('music-full-config');
    if (saved) {
      const cfg = JSON.parse(saved);
      if (cfg.playerStyle === 'frenzy' || cfg.playerStyle === 'magazine') {
        forcedBarTextColor.value = 'black';
      } else if (cfg.playerStyle === 'stage') {
        forcedBarTextColor.value = 'white';
      } else {
        forcedBarTextColor.value = null;
      }
      return;
    }
  } catch {}
  forcedBarTextColor.value = null;
}
updatePlayerMode();

// ==================== Play bar auto-collapse ====================
const playBarCollapsed = ref(false);
let collapseTimer: ReturnType<typeof setTimeout> | null = null;
const COLLAPSE_DELAY = 5000;
const HOVER_ZONE = 40;

function resetCollapseTimer() {
  if (collapseTimer) clearTimeout(collapseTimer);
  playBarCollapsed.value = false;
  collapseTimer = setTimeout(() => {
    playBarCollapsed.value = true;
  }, COLLAPSE_DELAY);
}

function clearCollapseTimer() {
  if (collapseTimer) clearTimeout(collapseTimer);
  playBarCollapsed.value = false;
}

const handlePlayBarMouseMove = () => {
  // overlay 模式下不自动收起
  if (isOverlayMode.value) return;
  if (showFullStyle.value) resetCollapseTimer();
};

const handleWindowMouseMove = (e: MouseEvent) => {
  // overlay 模式下不自动收起
  if (isOverlayMode.value) return;
  if (!showFullStyle.value) return;
  const isNearBottom = e.clientY >= window.innerHeight - HOVER_ZONE;
  if (isNearBottom && playBarCollapsed.value) resetCollapseTimer();
};

watch(showFullStyle, (visible) => {
  if (visible) {
    // overlay 模式下所有播放器样式都不自动收起 PlayBar
    // （overlay 模式的 PlayBar 已是透明浮动控件，收起会导致进度条和控件不可见）
    if (isOverlayMode.value) {
      playBarCollapsed.value = false;
      return;
    }
    try {
      const saved = localStorage.getItem('music-full-config');
      if (saved) {
        const cfg = JSON.parse(saved);
        if (cfg.playerStyle === 'frenzy') {
          playBarCollapsed.value = false;
          return;
        }
      }
    } catch {}
    resetCollapseTimer();
  } else {
    clearCollapseTimer();
  }
});

onMounted(() => {
  window.addEventListener('mousemove', handleWindowMouseMove);
  window.addEventListener('music-full-config-updated', updatePlayerMode);
});

onUnmounted(() => {
  window.removeEventListener('mousemove', handleWindowMouseMove);
  window.removeEventListener('music-full-config-updated', updatePlayerMode);
  if (collapseTimer) clearTimeout(collapseTimer);
  coverTransition.dispose();
});

// ==================== Misc ====================
const openLyricWindow = () => openLyric();
const { navigateToArtist } = useArtist();
const handleArtistClick = (id: number) => {
  musicFullVisible.value = false;
  navigateToArtist(id);
};
const openPlayListDrawer = () => playerStore.setPlayListDrawerVisible(true);
const metaphorButtonVisible = computed(
  () => isFeatureEnabled('lyric-metaphor') && !!playMusic?.value?.name
);
const lyricsText = computed(() => lrcArray.value.map((l) => l.text).join('\n'));
const songName = computed(() => playMusic?.value?.name || '');
const albumId = computed(() => playMusic?.value?.al?.id ?? playMusic?.value?.album?.id ?? null);
const artistName = computed(() =>
  Array.isArray(artistList.value) ? artistList.value.map((a: any) => a.name).join(' / ') : ''
);

// Cleanup
onBeforeUnmount(() => {
  document.removeEventListener('mouseup', handleSliderMouseUp);
  if (isDragging.value) isDragging.value = false;
  miniBarResizeObserver?.disconnect();
});
</script>

<style lang="scss" scoped>
// ==================== Common utilities ====================
.like-active {
  color: #ef4444 !important;
  &:hover {
    color: #dc2626 !important;
  }
}
.intelligence-active {
  color: var(--accent-color) !important;
}
.disabled-icon {
  opacity: 0.5;
  cursor: not-allowed !important;
  &:hover {
    color: inherit !important;
  }
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

// ==================== Slider tooltip (shared) ====================
.slider-hover-tooltip,
.fp-tooltip {
  position: absolute;
  bottom: 100%;
  margin-bottom: 6px;
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 100;
  white-space: nowrap;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  border-radius: 8px;
  padding: 6px 10px;
  text-align: center;
  .slider-hover-lyric,
  .fp-tooltip-lyric {
    font-size: 12px;
    color: #fff;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 2px;
  }
  .slider-hover-time,
  .fp-tooltip-time {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.6);
    font-family: monospace;
  }
}

// ==================== Climax segments (shared) ====================
.climax-track,
.fp-climax {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
  pointer-events: none;
  z-index: 1;
}
.climax-segment,
.fp-climax-seg {
  position: absolute;
  height: 100%;
  border-radius: 2px;
  background: rgba(255, 200, 50, 0.35);
  transition: background 0.2s ease;
  &.climax-active,
  &.fp-climax-active {
    background: rgba(255, 200, 50, 0.6);
  }
}

// ====================================================================
// FULL MODE (贯穿) — restored from 9adfb23
// ====================================================================
.music-play-bar {
  @apply h-20 w-full absolute bottom-0 left-0 flex items-center box-border px-6 py-2 pt-3;
  @apply bg-light dark:bg-dark shadow-2xl shadow-gray-300;
  z-index: 9999;
  animation-duration: 0.5s !important;
  transition: box-shadow 0.4s ease;

  // Content children (excluding progress bar) have fade transition
  > *:not(.music-time) {
    transition: opacity 0.4s ease;
  }

  // Transparent background when full player is open
  &.play-bar-opcity {
    @apply bg-transparent !important;
    box-shadow: 0 0 20px 5px #0000001d;
  }

  // Forced black text for frenzy/magazine mode
  &.play-bar-forced-black {
    :deep(*) {
      color: #000000 !important;
    }
    :deep(.iconfont):hover {
      color: var(--accent-color, #888) !important;
    }
  }

  // Forced white text for stage mode
  &.play-bar-forced-white {
    :deep(*) {
      color: #ffffff !important;
    }
    :deep(.iconfont):hover {
      color: var(--accent-color, #888) !important;
    }
  }

  // Auto-collapse: fade out content but keep progress bar visible
  &.play-bar-collapsed,
  &.play-bar-fade-out {
    pointer-events: none;
    box-shadow: none;

    > *:not(.music-time) {
      opacity: 0;
      pointer-events: none;
    }

    .music-time {
      pointer-events: auto;
    }
  }

  .music-content {
    width: 200px;
    @apply ml-4;
    &-title {
      @apply text-base;
    }
    &-name {
      @apply text-xs mt-1 opacity-80;
    }
  }
}

.text-ellipsis {
  width: 100%;
}

.play-bar-img-wrapper {
  @apply relative cursor-pointer w-14 h-14;
  .hover-arrow {
    @apply absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 rounded-2xl;
    background: rgba(0, 0, 0, 0.5);
    .hover-content {
      @apply flex flex-col items-center justify-center;
      i {
        @apply text-white mb-0.5;
      }
      .hover-text {
        @apply text-white text-xs scale-90;
      }
    }
  }
  &:hover .hover-arrow {
    @apply opacity-100;
  }
}

.play-bar-img {
  @apply w-14 h-14 rounded-2xl;
}

// 封面过渡覆盖层（全模式）
.play-bar-img-overlay {
  @apply absolute inset-0 w-14 h-14 rounded-2xl pointer-events-none;
  object-fit: cover;
}

.music-buttons {
  @apply mx-6 flex-1 flex justify-center items-center;
  .iconfont {
    @apply text-2xl transition hover:text-[var(--accent-color)];
  }
  .icon {
    @apply text-3xl hover:text-[var(--accent-color)];
  }
  > div {
    @apply cursor-pointer;
  }
  &-play {
    @apply flex justify-center items-center w-20 h-12 rounded-full mx-4 transition text-gray-500;
    @apply bg-gray-100 bg-opacity-60 dark:bg-gray-800 dark:bg-opacity-60 hover:bg-gray-200;
  }
}

.audio-volume {
  @apply flex items-center relative;
  &:hover .volume-slider {
    @apply opacity-100 visible;
  }
  .volume-icon {
    @apply cursor-pointer;
  }
  .iconfont {
    @apply text-2xl transition hover:text-[var(--accent-color)];
  }
  .volume-slider {
    @apply absolute opacity-0 invisible transition-all duration-300 bottom-[30px] left-1/2 -translate-x-1/2 h-[180px] px-2 py-4 rounded-xl;
    @apply bg-light dark:bg-dark-200 border border-gray-200 dark:border-gray-700;
    .volume-percentage {
      @apply absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium bg-light dark:bg-dark-200 px-2 py-1 rounded-md;
      @apply border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-white whitespace-nowrap;
      &.volume-percentage-disabled {
        @apply text-gray-400 dark:text-gray-500;
      }
    }
  }
}

.audio-button {
  @apply flex items-center;
  .iconfont {
    @apply text-2xl transition cursor-pointer mx-3 hover:text-[var(--accent-color)];
  }
}

.playback-rate-badge {
  @apply ml-2 px-1.5 h-4 flex items-center text-xs rounded bg-[var(--accent-color)] bg-opacity-15 text-[var(--accent-color-dark)] dark:text-[var(--accent-color-light)];
  font-weight: 500;
  vertical-align: 1px;
}

.loading-overlay {
  @apply absolute inset-0 flex items-center justify-center rounded-2xl;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 2;
}
.loading-icon {
  font-size: 24px;
  color: white;
  animation: spin 1s linear infinite;
}

// Full mode slider overrides
// Extended hit area: container is 16px tall, rail sits at bottom 4px,
// the 12px padding above clears the OS-level window resize zone.
.music-time {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 16px;
  z-index: 5;
  pointer-events: none;
}
.music-time .n-slider {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 16px;
  padding: 12px 0 0 0;
  box-sizing: border-box;
  border-radius: 0;
  pointer-events: auto;
}

.custom-slider {
  :deep(.n-slider) {
    --n-rail-height: 4px;
    --n-rail-color: rgba(0, 0, 0, 0.08);
    --n-rail-color-dark: rgba(255, 255, 255, 0.1);
    --n-fill-color: var(--accent-color, #888);
    --n-fill-color-hover: var(--accent-color, #888);
    --n-handle-size: 12px;
    --n-handle-color: var(--accent-color, #888);
    .n-slider-rail {
      @apply overflow-hidden transition-all duration-200;
      background-color: rgba(128, 128, 128, 0.12) !important;
    }
    .n-slider-handle {
      @apply transition-all duration-200;
      opacity: 0;
    }
    &:hover .n-slider-handle {
      opacity: 1;
    }
  }
  :deep(.n-slider-handle .n-slider-tooltip) {
    display: none !important;
  }

  // Align handle vertically with the bottom rail (extended hit area)
  &.music-time :deep(.n-slider-handle-wrapper) {
    top: calc(100% - var(--n-rail-height, 4px) / 2) !important;
  }
}

// ====================================================================
// MINI MODE (迷你)
// ====================================================================
.floating-bar.mini-bar {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  min-width: 280px;
  max-width: 480px;
  height: 64px;
  border-radius: 16px;
  z-index: 9999;
  display: flex;
  align-items: center;
  padding: 0 16px;
  padding-top: 10px;
  background: var(--bg-light, #fff);
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.08),
    0 1px 4px rgba(0, 0, 0, 0.04);
  transition:
    width 0.35s cubic-bezier(0.2, 0, 0.1, 1),
    box-shadow 0.3s ease,
    background 0.2s ease,
    opacity 0.4s ease,
    left 0s,
    right 0s;

  :global(.dark) & {
    background: var(--bg-dark, #1a1a1a);
    box-shadow:
      0 4px 24px rgba(0, 0, 0, 0.3),
      0 1px 4px rgba(0, 0, 0, 0.2);
  }

  &.bar-hidden {
    opacity: 0;
    pointer-events: none;
  }

  // Expand width on hover
  &.mini-expanded {
    min-width: 420px;
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.12),
      0 2px 8px rgba(0, 0, 0, 0.06);
  }
}

// Drag handle (right side, vertical)
.mini-bar-handle {
  position: absolute;
  right: 3px;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 40px;
  border-radius: 9999px;
  background: rgba(128, 128, 128, 0.3);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  cursor: grab;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  z-index: 10;

  .mini-bar:hover & {
    opacity: 0.6;
    pointer-events: auto;
  }
  &:active {
    cursor: grabbing;
    opacity: 0.8;
  }
  :global(.dark) & {
    background: rgba(255, 255, 255, 0.25);
  }
}

// Progress bar inside mini bar
.mini-bar-progress {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  height: 4px;
  border-radius: 0 0 8px 8px;
  overflow: visible;
  z-index: 9998;
  transition:
    width 0.35s cubic-bezier(0.2, 0, 0.1, 1),
    left 0s;

  .n-slider {
    --n-rail-height: 6px !important;
    --n-rail-color: rgba(0, 0, 0, 0.08) !important;
    --n-rail-color-active: var(--accent-color, #888) !important;
    --n-fill-color: var(--accent-color, #888) !important;
    --n-fill-color-hover: var(--accent-color, #888) !important;
  }
  .n-slider .n-slider-rail__fill {
    background: var(--accent-color, #888) !important;
  }
  :global(.dark) & .n-slider {
    --n-rail-color: rgba(255, 255, 255, 0.1) !important;
  }
}

// Cover
.bar-cover {
  position: relative;
  cursor: pointer;
  flex-shrink: 0;
}
.bar-cover-img {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  object-fit: cover;
}
// 封面过渡覆盖层（迷你模式）
.bar-cover-img-overlay {
  position: absolute;
  inset: 0;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  object-fit: cover;
  pointer-events: none;
}
.bar-cover-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.5);
  z-index: 2;
}

// Song info
.bar-song-info {
  flex: 1;
  min-width: 0;
  margin-left: 12px;
  overflow: hidden;
}
.bar-song-title {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  display: block;
}
.bar-song-artist {
  font-size: 12px;
  opacity: 0.55;
  margin-top: 2px;
  line-height: 1.3;
  display: block;
}

// Expanded area
.mini-expanded-area {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  opacity: 0;
  max-width: 0;
  overflow: hidden;
  transition:
    opacity 0.25s ease,
    max-width 0.35s cubic-bezier(0.2, 0, 0.1, 1);

  &.area-visible {
    opacity: 1;
    max-width: 300px;
  }
}

// Play controls
.mini-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.bar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  transition:
    background 0.2s ease,
    color 0.2s ease;
  color: inherit;
  flex-shrink: 0;
  &:hover {
    background: rgba(0, 0, 0, 0.06);
    :global(.dark) & {
      background: rgba(255, 255, 255, 0.08);
    }
  }
  .iconfont {
    font-size: 20px;
    transition: color 0.2s ease;
    &:hover {
      color: var(--accent-color, #888);
    }
  }
}
.bar-btn-play {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  cursor: pointer;
  transition:
    background 0.2s ease,
    transform 0.2s ease;
  background: rgba(0, 0, 0, 0.06);
  flex-shrink: 0;
  :global(.dark) & {
    background: rgba(255, 255, 255, 0.08);
  }
  &:hover {
    transform: scale(1.05);
    background: rgba(0, 0, 0, 0.1);
    :global(.dark) & {
      background: rgba(255, 255, 255, 0.12);
    }
  }
  .iconfont {
    font-size: 22px;
    transition: color 0.2s ease;
    &:hover {
      color: var(--accent-color, #888);
    }
  }
}

// 4-slot grid
.mini-slots {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}
.mini-slot {
  display: flex;
  align-items: center;
  justify-content: center;
}

// Volume in mini slot
.bar-action-volume {
  position: relative;
  .volume-inner {
    display: flex;
    align-items: center;
  }
  &:hover .volume-slider {
    width: 60px;
    opacity: 1;
    margin-right: 4px;
  }
  .volume-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .volume-slider {
    width: 0;
    opacity: 0;
    overflow: hidden;
    transition:
      width 0.3s ease,
      opacity 0.25s ease;
    display: flex;
    align-items: center;
  }
}

// ====================================================================
// Mobile overrides
// ====================================================================
:global(.mobile) .music-play-bar {
  @apply px-4 bottom-[56px];
}
:global(.mobile) .music-time {
  display: none;
}
:global(.mobile) .audio-volume {
  display: none;
}
:global(.mobile) .music-buttons {
  @apply m-0;
  &-prev,
  &-next {
    display: none;
  }
  &-play {
    @apply m-0;
  }
}
:global(.mobile) .music-content {
  flex: 1;
}
</style>

<style>
/* Hide slider tooltip indicator globally for play bar sliders */
.play-bar-root .n-slider-handle-indicator {
  display: none !important;
}
.play-bar-root .n-slider-handle {
  opacity: 0 !important;
  pointer-events: none !important;
  width: 8px !important;
  height: 8px !important;
}
.play-bar-root .mini-bar-progress .n-slider-handle {
  opacity: 0 !important;
}

/* Overlay mode: play bar fully transparent */
html.overlay-mode .music-play-bar {
  background: transparent !important;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: none !important;
}
</style>
