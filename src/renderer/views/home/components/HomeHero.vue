<template>
  <div class="hero-section mb-6 md:mb-10">
    <!-- Skeleton Loading -->
    <div v-if="loading" class="space-y-4">
      <div class="flex gap-1.5 overflow-hidden md:hidden">
        <div v-for="i in 6" :key="i" class="h-9 w-20 flex-shrink-0 skeleton-shimmer rounded-full" />
      </div>
      <div class="hero-grid grid gap-3">
        <div class="skeleton-shimmer rounded-2xl" style="height: 160px" />
        <div class="skeleton-shimmer rounded-2xl" style="height: 160px" />
      </div>
    </div>

    <!-- Main Content -->
    <div v-else class="space-y-4">
      <!-- Quick Navigation (mobile only) -->
      <nav class="scrollbar-hide flex gap-1.5 overflow-x-auto pb-0.5 md:hidden">
        <button
          v-for="(item, index) in quickNavItems"
          :key="item.key"
          class="nav-chip flex flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 py-[7px] text-[13px] font-medium transition-all duration-250 hover:text-neutral-900 dark:hover:text-neutral-100"
          :class="[
            item.active
              ? 'bg-[var(--accent-color)] text-white'
              : 'bg-neutral-100/60 text-neutral-500 hover:bg-neutral-200/80 dark:bg-white/[0.04] dark:text-neutral-400 dark:hover:bg-white/[0.07]'
          ]"
          :style="{ animationDelay: `${index * 0.03}s` }"
          @click="item.action"
        >
          <i :class="item.icon" class="text-sm" />
          <span class="whitespace-nowrap">{{ item.label }}</span>
          <span v-if="item.active" class="h-[5px] w-[5px] rounded-full bg-white/50" />
        </button>
      </nav>

      <!-- Hero Cards -->
      <div class="hero-grid grid gap-3">
        <!-- ===== 每日推荐 (Left - Large Card) ===== -->
        <div class="hero-card" :style="{ animationDelay: '0.12s' }">
          <!-- Card -->
          <div
            class="daily-card group relative cursor-pointer overflow-hidden rounded-2xl shadow-sm transition-all duration-300 ease-out hover:shadow-xl"
            :style="{ background: dailyCardBg }"
            @click="showDayRecommend"
          >
            <!-- Background Image -->
            <img
              v-if="dayRecommendCover"
              ref="dailyCoverRef"
              :src="getImgUrl(dayRecommendCover, '512y512')"
              alt=""
              class="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              crossorigin="anonymous"
              @load="extractDailyColor"
            />
            <!-- Gradient Overlay -->
            <div class="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/20" />

            <!-- Content -->
            <div class="relative flex h-full flex-col justify-between p-5 md:p-6">
              <!-- Top: Title + Badge -->
              <div>
                <h3 class="text-2xl font-black leading-tight tracking-wider text-white md:text-3xl">
                  {{ t('comp.homeHero.dailyRecommend') }}
                </h3>
                <span
                  class="mt-1.5 inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white/80 backdrop-blur-sm"
                >
                  <i class="ri-calendar-check-fill" />
                  {{ dayRecommendSongs.length }} {{ t('comp.homeHero.songs') }}
                </span>
              </div>
              <!-- Bottom: Song List + Play -->
              <div class="flex items-end justify-between gap-4">
                <!-- Song Preview List (bottom-left) -->
                <div
                  v-if="dayRecommendSongs.length > 0"
                  class="hidden min-w-0 flex-1 flex-col gap-0.5 md:flex"
                >
                  <div
                    v-for="(song, idx) in dayRecommendSongs.slice(0, 3)"
                    :key="song.id"
                    class="flex items-center gap-2 py-0.5"
                  >
                    <span class="w-4 flex-shrink-0 text-center text-xs tabular-nums text-white/40">
                      {{ idx + 1 }}
                    </span>
                    <span class="min-w-0 flex-1 truncate text-sm font-medium text-white/90">
                      {{ song.name }}
                    </span>
                    <span class="flex-shrink-0 truncate text-xs text-white/40">
                      {{ song.ar?.[0]?.name }}
                    </span>
                  </div>
                </div>
                <button
                  class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-lg transition-all duration-300 hover:scale-110 hover:bg-white active:scale-95"
                  @click.stop="playDayRecommend"
                >
                  <i class="ri-play-fill ml-0.5 text-xl" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ===== 已登录 私人FM (Full Width) ===== -->
        <div v-if="isLoggedIn" class="hero-card" :style="{ animationDelay: '0.22s' }">
          <div
            class="fm-card fm-card--expanded group relative cursor-pointer overflow-hidden rounded-2xl shadow-sm transition-all duration-300 ease-out hover:shadow-xl"
            :style="{ background: fmCardBg }"
          >
            <!-- Background blur image -->
            <img
              v-if="displayCover"
              ref="fmCoverRef"
              :src="getImgUrl(displayCover, '512y512')"
              alt=""
              class="absolute inset-0 h-full w-full scale-150 object-cover opacity-20 blur-3xl"
              :class="isFmPlaying ? 'fm-bg-flow' : ''"
              crossorigin="anonymous"
              @load="extractFmColor"
            />
            <div class="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-black/10" />

            <!-- Content -->
            <div class="relative flex h-full gap-6 p-6">
              <!-- Left: Cover + Song Info -->
              <div class="flex flex-col items-center gap-3 flex-shrink-0">
                <!-- Album Cover -->
                <div
                  class="fm-cover-lg relative w-28 h-28 md:w-36 md:h-36 overflow-hidden rounded-2xl shadow-2xl transition-transform duration-500 group-hover:scale-[1.03]"
                >
                  <img
                    v-if="displayCover"
                    :src="getImgUrl(displayCover, '512y512')"
                    alt=""
                    class="h-full w-full object-cover"
                  />
                  <div v-else class="flex h-full w-full items-center justify-center bg-white/10">
                    <i class="ri-radio-fill text-4xl text-white/40" />
                  </div>
                  <!-- Playing equalizer overlay -->
                  <div
                    v-if="isFmPlaying"
                    class="absolute bottom-2 right-2 flex items-end gap-[2px]"
                  >
                    <span
                      v-for="i in 3"
                      :key="i"
                      class="eq-bar"
                      :style="{
                        animationDelay: `${(i - 1) * 0.15}s`,
                        '--eq-color': primaryColor || '#888888'
                      }"
                    />
                  </div>
                </div>
                <!-- Song Info -->
                <div class="text-center max-w-[180px]">
                  <h3 class="truncate text-sm font-bold text-white">
                    {{ displaySong?.name || t('comp.homeHero.discoverMusic') }}
                  </h3>
                  <p class="mt-0.5 truncate text-xs text-white/50">
                    {{ displayArtist }}
                  </p>
                </div>
              </div>

              <!-- Center: Lyrics -->
              <home-fm-lyrics :key="activeMode" class="flex-1 min-w-0" />

              <!-- Right: Controls + Badge -->
              <div class="flex flex-col items-end justify-between flex-shrink-0">
                <!-- Mode Badge / Dropdown -->
                <n-dropdown
                  v-if="isCookieUser"
                  trigger="click"
                  :options="modeOptions"
                  @select="switchMode"
                >
                  <span
                    class="flex items-center gap-1 text-xs font-semibold text-white/50 cursor-pointer hover:text-white/80 transition-colors"
                  >
                    <i
                      :class="
                        activeMode === 'intelligence' ? 'ri-heart-pulse-fill' : 'ri-radio-fill'
                      "
                    />
                    {{
                      activeMode === 'intelligence'
                        ? t('comp.homeHero.intelligenceMode')
                        : t('comp.homeHero.personalFm')
                    }}
                    <i class="ri-arrow-down-s-line text-[10px]" />
                  </span>
                </n-dropdown>
                <span v-else class="flex items-center gap-1 text-xs font-semibold text-white/50">
                  <i class="ri-radio-fill" />
                  {{ t('comp.homeHero.personalFm') }}
                </span>

                <!-- Playback Controls -->
                <div class="flex items-center gap-3">
                  <button
                    v-if="activeMode === 'intelligence'"
                    class="flex h-9 w-9 items-center justify-center rounded-full transition-colors"
                    :class="isFavorite ? 'text-red-500' : 'text-white/50 hover:text-white'"
                    :title="
                      isFavorite ? t('comp.songItem.unfavorite') : t('comp.songItem.favorite')
                    "
                    @click.stop="toggleFavorite"
                  >
                    <i
                      :class="isFavorite ? 'ri-heart-3-fill' : 'ri-heart-3-line'"
                      class="text-lg"
                    />
                  </button>
                  <button
                    v-else
                    class="flex h-9 w-9 items-center justify-center rounded-full text-white/50 transition-colors hover:text-white"
                    :title="t('comp.homeHero.fmTrash')"
                    @click.stop="handleFmTrash"
                  >
                    <i class="ri-thumb-down-line text-lg" />
                  </button>
                  <button
                    class="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:bg-white/30 active:scale-95"
                    @click.stop="handleFmPlay"
                  >
                    <i
                      :class="isFmPlaying ? 'ri-pause-fill' : 'ri-play-fill ml-0.5'"
                      class="text-xl"
                    />
                  </button>
                  <button
                    class="flex h-9 w-9 items-center justify-center rounded-full text-white/50 transition-colors hover:text-white"
                    :title="t('comp.homeHero.fmNext')"
                    @click.stop="handleNext"
                  >
                    <i class="ri-skip-forward-fill text-lg" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ===== 鏈登录 推荐歌单 (Right Card) ===== -->
        <div
          v-if="!isLoggedIn"
          class="hero-card group cursor-pointer"
          :style="{ animationDelay: '0.22s' }"
          @click="router.push('/list')"
        >
          <div
            class="fm-card relative overflow-hidden rounded-2xl bg-neutral-100 shadow-sm transition-all duration-300 ease-out group-hover:shadow-xl dark:bg-neutral-800"
          >
            <!-- 2x2 Cover Grid -->
            <div class="absolute inset-0 grid grid-cols-2 grid-rows-2">
              <template v-if="hotPlaylists.length > 0">
                <div
                  v-for="(pl, idx) in hotPlaylists.slice(0, 4)"
                  :key="idx"
                  class="overflow-hidden"
                >
                  <img
                    :src="getImgUrl(pl.picUrl, '256y256')"
                    alt=""
                    class="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                </div>
              </template>
              <template v-else>
                <div
                  v-for="i in 4"
                  :key="`empty-${i}`"
                  class="flex items-center justify-center bg-neutral-200/80 dark:bg-neutral-700/50"
                >
                  <i class="ri-play-list-2-line text-lg text-neutral-300 dark:text-neutral-600" />
                </div>
              </template>
            </div>
            <!-- Overlay -->
            <div class="absolute inset-0 bg-black/30 transition-colors group-hover:bg-black/40" />
            <!-- Content -->
            <div class="relative flex h-full flex-col justify-between p-5">
              <span
                class="inline-flex w-fit items-center gap-1 rounded-md bg-black/30 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm"
              >
                <i class="ri-play-list-2-line" />
                {{ t('comp.homeHero.hotPlaylists') }}
              </span>
              <div class="flex items-end justify-between gap-4">
                <div>
                  <h3 class="text-lg font-bold text-white">
                    {{ t('comp.homeHero.hotPlaylists') }}
                  </h3>
                  <p class="mt-0.5 text-sm text-white/70">
                    {{ t('comp.homeHero.discoverNewReleases') }}
                  </p>
                </div>
                <div
                  class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:bg-white/30"
                >
                  <i class="ri-arrow-right-s-line text-xl" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MenuOption } from 'naive-ui';
import { computed, h, onActivated, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { getHotSinger, getPersonalFM, getPersonalizedPlaylist } from '@/api/home';
import { fmTrash } from '@/api/music';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import { useCoverColor } from '@/hooks/useCoverColor';
import { useFavorite } from '@/hooks/useFavorite';
import {
  useIntelligenceModeStore,
  usePlayerCoreStore,
  usePlayerStore,
  useRecommendStore,
  useUserStore
} from '@/store';
import { getImgUrl } from '@/utils';
import { getImageBackground } from '@/utils/linearColor';
import HomeFmLyrics from '@/views/home/components/HomeFmLyrics.vue';

const { t } = useI18n();
const router = useRouter();
const recommendStore = useRecommendStore();
const intelligenceModeStore = useIntelligenceModeStore();
const userStore = useUserStore();
const playerCoreStore = usePlayerCoreStore();
const playerStore = usePlayerStore();
const { isFavorite, toggleFavorite } = useFavorite();
const { primaryColor } = useCoverColor();

const loading = ref(false);

// FM state —current + preloaded next (YesPlayMusic pattern)
const fmCurrentSong = ref<any>(null);
const fmNextSong = ref<any>(null);
const fmLoading = ref(false);

const hotPlaylists = ref<any[]>([]);
const hotArtistsList = ref<any[]>([]);
const dailyCoverRef = ref<HTMLImageElement | null>(null);
const fmCoverRef = ref<HTMLImageElement | null>(null);
const dailyCardBg = ref('linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
const fmCardBg = ref('linear-gradient(135deg, #e91e63 0%, #c2185b 100%)');

const isLoggedIn = computed(() => !!userStore.user);
const dayRecommendSongs = computed(() => recommendStore.dailyRecommendSongs);
const dayRecommendCover = computed(() => dayRecommendSongs.value[0]?.al?.picUrl || '');

const fmCurrentCover = computed(
  () => fmCurrentSong.value?.album?.picUrl || fmCurrentSong.value?.al?.picUrl || ''
);
const fmCurrentArtist = computed(() => {
  const song = fmCurrentSong.value;
  if (!song) return t('comp.homeHero.personalFmDesc');
  const artists = song.artists || song.ar;
  return artists?.map((a: any) => a.name).join(' / ') || '';
});

const isCookieUser = computed(() => !!userStore.user && userStore.loginType === 'cookie');
const activeMode = computed(() =>
  intelligenceModeStore.isIntelligenceMode ? 'intelligence' : 'fm'
);

const modeOptions = computed<MenuOption[]>(() => [
  {
    key: 'fm',
    label: t('comp.homeHero.personalFm'),
    icon: () => h('i', { class: 'ri-radio-fill' })
  },
  {
    key: 'intelligence',
    label: t('comp.homeHero.intelligenceMode'),
    icon: () => h('i', { class: 'ri-heart-pulse-fill' })
  }
]);

const displaySong = computed(() => {
  if (activeMode.value === 'intelligence') return playerCoreStore.currentSong;
  return fmCurrentSong.value;
});
const displayCover = computed(() => {
  if (activeMode.value === 'intelligence')
    return (
      playerCoreStore.currentSong?.al?.picUrl || playerCoreStore.currentSong?.album?.picUrl || ''
    );
  return fmCurrentCover.value;
});
const displayArtist = computed(() => {
  if (activeMode.value === 'intelligence') {
    const song = playerCoreStore.currentSong;
    if (!song) return '';
    const artists = song.artists || song.ar;
    return artists?.map((a: any) => a.name).join(' / ') || '';
  }
  return fmCurrentArtist.value;
});

const isFmPlaying = computed(() => {
  if (activeMode.value === 'intelligence') {
    return !!playerCoreStore.currentSong?.id && playerCoreStore.isPlaying;
  }
  return (
    !!fmCurrentSong.value &&
    playerCoreStore.currentSong?.id === fmCurrentSong.value.id &&
    playerCoreStore.isPlaying
  );
});

// ==================== Color extraction ====================

const extractDailyColor = async () => {
  const img = dailyCoverRef.value;
  if (!img) return;
  try {
    const { primaryColor } = await getImageBackground(img);
    if (primaryColor) {
      const tinycolor = (await import('tinycolor2')).default;
      const base = tinycolor(primaryColor);
      const hsl = base.toHsl();
      const c1 = tinycolor({ h: hsl.h, s: Math.min(hsl.s * 1.2, 1), l: 0.35 });
      const c2 = tinycolor({ h: (hsl.h + 30) % 360, s: Math.min(hsl.s * 1.1, 1), l: 0.25 });
      dailyCardBg.value = `linear-gradient(135deg, ${c1.toHexString()} 0%, ${c2.toHexString()} 100%)`;
    }
  } catch {
    // keep default gradient
  }
};

const extractFmColor = async () => {
  const img = fmCoverRef.value;
  if (!img) return;
  try {
    const { primaryColor } = await getImageBackground(img);
    if (primaryColor) {
      const tinycolor = (await import('tinycolor2')).default;
      const base = tinycolor(primaryColor);
      const hsl = base.toHsl();
      const c1 = tinycolor({ h: hsl.h, s: Math.min(hsl.s * 1.3, 1), l: 0.4 });
      const c2 = tinycolor({ h: (hsl.h + 20) % 360, s: Math.min(hsl.s * 1.1, 1), l: 0.3 });
      fmCardBg.value = `linear-gradient(135deg, ${c1.toHexString()} 0%, ${c2.toHexString()} 100%)`;
    }
  } catch {
    // keep default gradient
  }
};

// ==================== FM logic (YesPlayMusic pattern) ====================

/** Fetch FM songs from API, with retry */
const fetchFmSongs = async (retries = 3): Promise<any[]> => {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await getPersonalFM();
      // axios response: res.data = { data: [...], code: 200 }
      const songs = res.data?.data;
      if (Array.isArray(songs) && songs.length > 0) return songs;
    } catch {
      if (i < retries - 1) await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return [];
};

/** Load current + preload next FM song */
const loadFmSongs = async () => {
  if (fmLoading.value) return;
  fmLoading.value = true;
  try {
    const songs = await fetchFmSongs();
    if (songs.length > 0) {
      fmCurrentSong.value = songs[0];
      fmNextSong.value = songs[1] || null;
    }
  } finally {
    fmLoading.value = false;
  }
};

/** Preload next FM song in background */
const preloadNextFm = async () => {
  if (fmNextSong.value) return; // already have next
  try {
    const songs = await fetchFmSongs(1);
    if (songs.length > 0) {
      fmNextSong.value = songs[0];
    }
  } catch {
    // silent
  }
};

/** Play/pause current song */
const handleFmPlay = async () => {
  if (activeMode.value === 'intelligence') {
    const { usePlaylistStore } = await import('@/store/modules/playlist');
    const playlistStore = usePlaylistStore();
    await playlistStore.setPlay(playerCoreStore.currentSong);
    return;
  }
  // FM mode
  if (!fmCurrentSong.value) return;
  if (playerCoreStore.currentSong?.id === fmCurrentSong.value.id) {
    const { usePlaylistStore } = await import('@/store/modules/playlist');
    const playlistStore = usePlaylistStore();
    await playlistStore.setPlay(playerCoreStore.currentSong);
    return;
  }
  try {
    const { usePlayerCoreStore } = await import('@/store/modules/playerCore');
    const { usePlaylistStore } = await import('@/store/modules/playlist');
    const playerCore = usePlayerCoreStore();
    const playlistStore = usePlaylistStore();
    const song = fmCurrentSong.value;
    const playlist = [
      {
        id: song.id,
        name: song.name,
        picUrl: song.al?.picUrl || song.album?.picUrl,
        ar: song.artists || song.ar,
        al: song.al || song.album,
        source: 'netease' as const,
        song,
        ...song,
        playLoading: false
      }
    ];
    playlistStore.setPlayList(playlist, false, false);
    playerCore.isFmPlaying = true;
    await playerCore.handlePlayMusic(playlist[0], true);
  } catch (error) {
    console.error('Failed to play Personal FM:', error);
  }
};

/** Next FM track —promote preloaded, fetch new one in background */
const handleFmNext = async () => {
  if (fmLoading.value) return;
  if (fmNextSong.value) {
    fmCurrentSong.value = fmNextSong.value;
    fmNextSong.value = null;
    preloadNextFm();
  } else {
    await loadFmSongs();
  }
  await handleFmPlay();
};

/** Trash/dislike current FM song —call API then skip to next */
const handleFmTrash = async () => {
  const song = fmCurrentSong.value;
  if (!song) return;
  try {
    await fmTrash(song.id);
  } catch {
    // even if trash API fails, still skip
  }
  await handleFmNext();
};

/** Next track --- dispatch by active mode */
const handleNext = async () => {
  if (activeMode.value === 'intelligence') {
    playerStore.nextPlay();
    return;
  }
  await handleFmNext();
};

// ==================== Quick Nav ====================

const quickNavItems = computed(() => {
  const items = [
    {
      key: 'intelligence',
      label: t('comp.homeHero.intelligenceMode'),
      icon: 'ri-heart-pulse-fill',
      active: intelligenceModeStore.isIntelligenceMode,
      action: toggleIntelligenceMode,
      show: isLoggedIn.value
    },
    {
      key: 'toplist',
      label: t('comp.toplist'),
      icon: 'ri-trophy-line',
      active: false,
      action: () => router.push('/toplist'),
      show: true
    },
    {
      key: 'favorite',
      label: t('comp.homeHero.quickNav.myFavorite'),
      icon: 'ri-heart-3-line',
      active: false,
      action: () => router.push('/favorite'),
      show: true
    },
    {
      key: 'podcast',
      label: t('podcast.podcast'),
      icon: 'ri-radio-2-line',
      active: false,
      action: () => router.push('/podcast'),
      show: true
    },
    {
      key: 'mv',
      label: t('comp.mv'),
      icon: 'ri-movie-2-line',
      active: false,
      action: () => router.push('/mv'),
      show: true
    },
    {
      key: 'playlist',
      label: t('comp.list'),
      icon: 'ri-play-list-2-line',
      active: false,
      action: () => router.push('/list'),
      show: true
    },
    {
      key: 'album',
      label: t('comp.newAlbum.title'),
      icon: 'ri-album-line',
      active: false,
      action: () => router.push('/album'),
      show: true
    },
    {
      key: 'history',
      label: t('comp.history'),
      icon: 'ri-history-line',
      active: false,
      action: () => router.push('/history'),
      show: true
    }
  ];
  return items.filter((item) => item.show);
});

// ==================== Data fetching ====================

const fetchHeroData = async () => {
  try {
    loading.value = true;
    const promises: Promise<any>[] = [];

    promises.push(recommendStore.refreshIfStale());

    promises.push(
      getPersonalizedPlaylist(8)
        .then((res: any) => {
          const list = res.result || res.data;
          if (list && !isLoggedIn.value) hotPlaylists.value = list;
        })
        .catch(() => {})
    );

    if (isLoggedIn.value) {
      promises.push(loadFmSongs());
    } else {
      promises.push(
        getHotSinger({ offset: 0, limit: 6 })
          .then((res: any) => {
            if (res.artists) hotArtistsList.value = res.artists;
          })
          .catch(() => {})
      );
    }

    await Promise.all(promises);
  } catch (error) {
    console.error('Failed to fetch hero data:', error);
  } finally {
    loading.value = false;
  }
};

// ==================== Daily recommend actions ====================

const showDayRecommend = () => {
  if (dayRecommendSongs.value.length === 0) return;
  navigateToMusicList(router, {
    type: 'dailyRecommend',
    name: t('comp.recommendSinger.songlist'),
    songList: dayRecommendSongs.value,
    canRemove: false
  });
};

const playDayRecommend = async () => {
  if (dayRecommendSongs.value.length === 0) return;
  try {
    const { usePlayerCoreStore } = await import('@/store/modules/playerCore');
    const { usePlaylistStore } = await import('@/store/modules/playlist');
    const playerCore = usePlayerCoreStore();
    const playlistStore = usePlaylistStore();
    const songs = dayRecommendSongs.value.map((s: any) => ({
      id: s.id,
      name: s.name,
      picUrl: s.al?.picUrl,
      source: 'netease',
      song: s,
      ...s,
      playLoading: false
    }));
    playlistStore.setPlayList(songs, false, false);
    await playerCore.handlePlayMusic(songs[0], true);
  } catch (error) {
    console.error('Failed to play daily recommend:', error);
  }
};

const switchMode = (key: string) => {
  if (key === 'intelligence') {
    intelligenceModeStore.playIntelligenceMode();
  } else {
    intelligenceModeStore.clearIntelligenceMode();
  }
};

const toggleIntelligenceMode = () => {
  if (intelligenceModeStore.isIntelligenceMode) {
    intelligenceModeStore.clearIntelligenceMode();
  } else {
    intelligenceModeStore.playIntelligenceMode();
  }
};

// ==================== Lifecycle ====================

onMounted(() => {
  fetchHeroData();
});

onActivated(() => {
  recommendStore.refreshIfStale();
});
</script>

<style scoped>
/* Scrollbar hide */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/* Nav chip animation */
.nav-chip {
  animation: chipIn 0.4s ease both;
}
@keyframes chipIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Hero grid — single column stack */
.hero-grid {
  grid-template-columns: 1fr;
}

/* Cards fill grid row height equally */
.hero-grid > .hero-card {
  height: 100%;
}
.hero-grid > .hero-card > .daily-card {
  height: 100%;
  min-height: 140px;
  max-height: 180px;
}
.hero-grid > .hero-card > .fm-card {
  height: 100%;
}
.fm-card--expanded {
  height: 380px;
  min-height: 380px;
  max-height: 380px;
}
.hero-grid > .hero-card:has(.fm-card--expanded) {
  height: 380px;
  min-height: 380px;
}

/* Card animation */
.hero-card {
  animation: cardUp 0.5s ease both;
}
@keyframes cardUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* FM background flow animation when playing */
.fm-bg-flow {
  animation: bgFlow 8s ease-in-out infinite alternate;
}
@keyframes bgFlow {
  0% {
    transform: scale(1.5) translate(0, 0);
  }
  33% {
    transform: scale(1.6) translate(-3%, 2%);
  }
  66% {
    transform: scale(1.55) translate(2%, -2%);
  }
  100% {
    transform: scale(1.5) translate(-1%, 1%);
  }
}

/* FM cover — sized relative to card, leaving padding space */
.fm-cover-lg {
  flex-shrink: 0;
}

/* FM equalizer bars */
.eq-bar {
  width: 3px;
  border-radius: 9999px;
  background-color: var(--eq-color, #888888);
  animation: eqPulse 0.8s ease-in-out infinite;
}
.eq-bar:nth-child(1) {
  height: 6px;
}
.eq-bar:nth-child(2) {
  height: 12px;
}
.eq-bar:nth-child(3) {
  height: 8px;
}
@keyframes eqPulse {
  0%,
  100% {
    transform: scaleY(1);
  }
  50% {
    transform: scaleY(1.6);
  }
}

/* Skeleton shimmer */
.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    theme('colors.neutral.200') 25%,
    theme('colors.neutral.100') 50%,
    theme('colors.neutral.200') 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
:deep(.dark) .skeleton-shimmer,
.dark .skeleton-shimmer {
  background: linear-gradient(
    90deg,
    theme('colors.neutral.800') 25%,
    theme('colors.neutral.700') 50%,
    theme('colors.neutral.800') 75%
  );
  background-size: 200% 100%;
}
@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
