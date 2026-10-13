<template>
  <div class="h-full w-full bg-[#f5f5f5] dark:bg-[#111] transition-colors duration-500">
    <n-scrollbar class="h-full">
      <div class="w-full">
        <!-- Loading -->
        <div v-if="loading">
          <div class="relative h-[300px] overflow-hidden">
            <div class="absolute inset-0 skeleton-shimmer" />
          </div>
          <div class="px-5 md:px-8 xl:px-16 -mt-8 relative z-20 max-w-7xl mx-auto">
            <div class="page-card overflow-hidden">
              <div class="grid grid-cols-1 md:grid-cols-2">
                <div
                  class="p-5 md:p-6 space-y-4 border-b md:border-b-0 md:border-r border-neutral-100 dark:border-neutral-800"
                >
                  <div class="flex gap-2">
                    <div class="h-9 w-16 skeleton-shimmer rounded-lg" />
                    <div class="h-9 w-16 skeleton-shimmer rounded-lg" />
                    <div class="h-9 w-16 skeleton-shimmer rounded-lg" />
                  </div>
                  <div v-for="i in 5" :key="i" class="flex items-center gap-3">
                    <div class="w-14 h-14 skeleton-shimmer rounded-xl shrink-0" />
                    <div class="flex-1 space-y-1.5">
                      <div class="h-4 w-3/4 skeleton-shimmer rounded-md" />
                      <div class="h-3 w-1/2 skeleton-shimmer rounded-md" />
                    </div>
                  </div>
                </div>
                <div class="p-5 md:p-6 space-y-3">
                  <div class="h-6 w-24 skeleton-shimmer rounded-md" />
                  <div v-for="i in 6" :key="i" class="flex items-center gap-3">
                    <div class="w-8 h-4 skeleton-shimmer rounded-md shrink-0" />
                    <div class="w-10 h-10 skeleton-shimmer rounded-xl shrink-0" />
                    <div class="flex-1 space-y-1">
                      <div class="h-3.5 w-2/3 skeleton-shimmer rounded-md" />
                      <div class="h-3 w-1/3 skeleton-shimmer rounded-md" />
                    </div>
                    <div class="flex gap-2 shrink-0">
                      <div class="w-7 h-7 skeleton-shimmer rounded-full" />
                      <div class="w-7 h-7 skeleton-shimmer rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Content -->
        <div v-else-if="userDetail">
          <!-- Hero -->
          <section class="relative w-full h-[300px] md:h-[340px] overflow-hidden">
            <div
              class="absolute inset-0 bg-cover bg-center bg-no-repeat"
              :style="{
                backgroundImage: `url(${getImgUrl(userDetail.profile.backgroundUrl)})`,
                WebkitMaskImage: 'linear-gradient(to bottom, black 35%, transparent 100%)',
                maskImage: 'linear-gradient(to bottom, black 35%, transparent 100%)'
              }"
            />
            <div
              class="absolute inset-x-6 md:inset-x-12 xl:inset-x-16 bottom-16 z-10 max-w-7xl mx-auto"
            >
              <div class="flex items-end justify-between">
                <div class="flex items-center gap-4 md:gap-5">
                  <div
                    class="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden shrink-0 ring-2 ring-white/40 shadow-xl"
                  >
                    <img
                      :src="getImgUrl(userDetail.profile.avatarUrl, '200y200')"
                      :alt="userDetail.profile.nickname"
                      class="w-full h-full object-cover"
                    />
                  </div>
                  <div class="text-white">
                    <div v-if="isArtist(userDetail.profile)" class="mb-1">
                      <span
                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 text-white/90 text-[11px] font-semibold"
                      >
                        <i class="ri-verified-badge-fill text-xs" />
                        音乐人
                      </span>
                    </div>
                    <h1 class="text-xl md:text-2xl font-bold tracking-tight">
                      {{ userDetail.profile.nickname }}
                    </h1>
                    <p
                      v-if="userDetail.profile.signature"
                      class="text-sm text-white/70 mt-0.5 max-w-md truncate"
                    >
                      {{ userDetail.profile.signature }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-5 md:gap-7 text-white shrink-0">
                  <button class="text-center" @click="showFollowerList">
                    <span class="text-lg md:text-xl font-bold block leading-none font-mono">
                      {{ formatNumber(userDetail.profile.followeds) }}
                    </span>
                    <span class="text-xs text-white/60 mt-1 block">{{
                      t('user.profile.followers')
                    }}</span>
                  </button>
                  <button class="text-center" @click="showFollowList">
                    <span class="text-lg md:text-xl font-bold block leading-none font-mono">
                      {{ formatNumber(userDetail.profile.follows) }}
                    </span>
                    <span class="text-xs text-white/60 mt-1 block">{{
                      t('user.profile.following')
                    }}</span>
                  </button>
                  <div class="text-center">
                    <span class="text-lg md:text-xl font-bold block leading-none font-mono"
                      >Lv.{{ userDetail.level }}</span
                    >
                    <span class="text-xs text-white/60 mt-1 block">{{
                      t('user.profile.level')
                    }}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Two-column content -->
          <div class="px-5 md:px-8 xl:px-16 -mt-8 relative z-20 max-w-7xl mx-auto w-full pb-8">
            <div class="page-card overflow-hidden">
              <div class="grid grid-cols-1 md:grid-cols-2">
                <!-- Left: Playlists -->
                <div
                  class="p-5 md:p-6 border-b md:border-b-0 md:border-r border-neutral-100 dark:border-neutral-800"
                >
                  <div class="flex gap-1.5 p-1.5 bg-neutral-100 dark:bg-neutral-800/60 rounded-2xl">
                    <button
                      v-for="plTab in playlistTabs"
                      :key="plTab.key"
                      class="flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all duration-200"
                      :class="
                        activePlTab === plTab.key
                          ? 'bg-white dark:bg-gray-700 text-neutral-900 dark:text-white shadow-sm'
                          : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
                      "
                      @click="activePlTab = plTab.key"
                    >
                      {{ plTab.label }}
                    </button>
                  </div>

                  <div class="mt-3 space-y-1">
                    <div
                      v-if="activePlTab === 'created' && isElectron"
                      class="flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer bg-neutral-50 dark:bg-neutral-800/40 hover:bg-neutral-100 dark:hover:bg-neutral-700/60 transition-colors duration-200"
                      @click="goToImportPlaylist"
                    >
                      <div
                        class="w-14 h-14 rounded-2xl bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center shrink-0"
                      >
                        <i class="ri-add-line text-xl text-neutral-400 dark:text-neutral-500" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-neutral-800 dark:text-neutral-100">
                          {{ t('comp.playlist.import.button') }}
                        </p>
                        <p class="text-xs text-neutral-400 dark:text-neutral-500">
                          {{ t('comp.playlist.import.description') }}
                        </p>
                      </div>
                    </div>

                    <div
                      v-for="(item, index) in currentPlaylists"
                      :key="item.id || index"
                      class="flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer transition-colors duration-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
                      @click="openPlaylist(item)"
                    >
                      <div
                        class="w-14 h-14 rounded-2xl overflow-hidden shrink-0 bg-neutral-200 dark:bg-neutral-700 shadow-sm"
                      >
                        <img
                          :src="getImgUrl(item.coverImgUrl, '100y100')"
                          :alt="item.name"
                          class="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div class="flex-1 min-w-0">
                        <p
                          class="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate"
                        >
                          {{ item.name }}
                        </p>
                        <p class="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                          {{ item.trackCount }}首，播放{{ formatNumber(item.playCount) }}次
                        </p>
                      </div>
                    </div>

                    <div
                      v-if="currentPlaylists.length === 0"
                      class="flex flex-col items-center justify-center py-10 text-neutral-400 dark:text-neutral-500"
                    >
                      <i class="ri-play-list-line text-3xl mb-2 opacity-40" />
                      <p class="text-xs">{{ t('user.detail.noPlaylists') }}</p>
                    </div>
                  </div>
                </div>

                <!-- Right: Records -->
                <div class="p-5 md:p-6" v-if="hasRecordPermission && recordList.length > 0">
                  <h2 class="text-base font-bold text-neutral-900 dark:text-white mb-4">
                    {{ t('user.ranking.title') }}
                  </h2>
                  <div class="space-y-0.5">
                    <div
                      v-for="(item, index) in recordList"
                      :key="item.id"
                      class="flex items-center gap-3 px-2.5 py-2 rounded-2xl cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800/50 group transition-colors duration-200"
                    >
                      <span
                        class="w-6 text-xs text-neutral-400 dark:text-neutral-500 font-mono text-right shrink-0"
                        >{{ index + 1 }}</span
                      >
                      <div
                        class="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-neutral-200 dark:bg-neutral-700 shadow-sm"
                      >
                        <img
                          :src="getImgUrl(item.picUrl, '100y100')"
                          :alt="item.name"
                          class="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div class="flex-1 min-w-0">
                        <p
                          class="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate"
                        >
                          {{ item.name }}
                        </p>
                        <p class="text-xs text-neutral-400 dark:text-neutral-500 truncate">
                          {{ getArtistNames(item) }}
                        </p>
                      </div>
                      <div
                        class="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      >
                        <button
                          class="w-7 h-7 flex items-center justify-center rounded-full text-base transition-all duration-200"
                          :class="
                            isFavorited(item.id)
                              ? 'ri-heart-fill text-red-500'
                              : 'ri-heart-line text-neutral-400 hover:text-red-500 hover:bg-red-500/10'
                          "
                          @click="toggleFavorite(item.id)"
                        />
                        <button
                          class="w-7 h-7 rounded-full flex items-center justify-center bg-neutral-200 dark:bg-neutral-700 hover:bg-[var(--accent-color)] hover:text-white transition-all duration-200"
                          @click="handlePlayRecord(item)"
                        >
                          <i class="ri-play-fill text-sm ml-0.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else-if="!hasRecordPermission" class="p-5 md:p-6">
                  <h2 class="text-base font-bold text-neutral-900 dark:text-white mb-4">
                    {{ t('user.ranking.title') }}
                  </h2>
                  <div
                    class="flex flex-col items-center justify-center py-12 text-neutral-400 dark:text-neutral-500"
                  >
                    <i class="ri-lock-line text-4xl mb-3 opacity-40" />
                    <p class="text-sm">
                      {{
                        t('user.detail.noRecordPermission', { name: userDetail.profile.nickname })
                      }}
                    </p>
                  </div>
                </div>
                <div v-else class="p-5 md:p-6">
                  <h2 class="text-base font-bold text-neutral-900 dark:text-white mb-4">
                    {{ t('user.ranking.title') }}
                  </h2>
                  <div
                    class="flex flex-col items-center justify-center py-12 text-neutral-400 dark:text-neutral-500"
                  >
                    <i class="ri-music-2-line text-4xl mb-3 opacity-40" />
                    <p class="text-sm">{{ t('user.detail.noRecords') }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty -->
        <div
          v-else-if="!loading"
          class="flex flex-col items-center justify-center min-h-[60vh] text-neutral-400 dark:text-neutral-500"
        >
          <i class="ri-user-line text-6xl mb-4 opacity-30" />
          <p>{{ t('user.message.loadFailed') }}</p>
        </div>
      </div>
    </n-scrollbar>

    <play-bottom />
  </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { getUserDetail, getUserPlaylist, getUserRecord } from '@/api/user';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import PlayBottom from '@/components/common/PlayBottom.vue';
import { usePlayerStore } from '@/store/modules/player';
import type { IUserDetail } from '@/types/user';
import { formatNumber, getImgUrl, isElectron } from '@/utils';

defineOptions({ name: 'UserDetail' });

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const message = useMessage();
const playerStore = usePlayerStore();

const userId = ref<number>(Number(route.params.uid));
const userDetail = ref<IUserDetail>();
const playList = ref<any[]>([]);
const recordList = ref<any[]>([]);
const loading = ref(true);
const hasRecordPermission = ref(true);
const activePlTab = ref('created');

const playlistTabs = computed(() => [
  { key: 'created', label: t('user.tabs.created') },
  { key: 'favorite', label: t('user.tabs.favorite') },
  { key: 'album', label: t('user.tabs.album') }
]);

const createdPlaylists = computed(() =>
  playList.value.filter((item: any) => item.creator?.userId === userId.value)
);

const favoritePlaylists = computed(() =>
  playList.value.filter((item: any) => item.creator?.userId !== userId.value)
);

const currentPlaylists = computed(() => {
  if (activePlTab.value === 'created') return createdPlaylists.value;
  if (activePlTab.value === 'favorite') return favoritePlaylists.value;
  return [];
});

const loadUserData = async () => {
  if (!userId.value) {
    message.error(t('user.detail.invalidUserId'));
    router.back();
    return;
  }
  try {
    loading.value = true;
    recordList.value = [];
    hasRecordPermission.value = true;
    try {
      const [userDetailRes, playlistRes] = await Promise.all([
        getUserDetail(userId.value),
        getUserPlaylist(userId.value)
      ]);
      userDetail.value = userDetailRes.data;
      playList.value = playlistRes.data.playlist;
    } catch (error) {
      console.error('Failed to load user info:', error);
      message.error(t('user.message.loadFailed'));
      return;
    }
    try {
      const recordRes = await getUserRecord(userId.value);
      if (recordRes.data?.allData) {
        recordList.value = recordRes.data.allData.map((item: any) => ({
          ...item,
          ...item.song,
          picUrl: item.song.al.picUrl
        }));
      }
    } catch (error: any) {
      console.error('Failed to load records:', error);
      if (error.response?.data?.code === -2 || error.data?.code === -2) {
        hasRecordPermission.value = false;
      }
    }
  } catch (error) {
    console.error('Failed to load user data:', error);
    message.error(t('user.message.loadFailed'));
  } finally {
    loading.value = false;
  }
};

onMounted(loadUserData);

watch(
  () => route.params.uid,
  (newUid) => {
    if (newUid && Number(newUid) !== userId.value) {
      userId.value = Number(newUid);
      activePlTab.value = 'created';
      loadUserData();
    }
  }
);

const openPlaylist = (item: any) => {
  navigateToMusicList(router, {
    id: item.id,
    type: 'playlist',
    name: item.name,
    listInfo: item,
    canRemove: false
  });
};

const handlePlayRecord = (item: any) => {
  if (!recordList.value || recordList.value.length === 0) return;
  const idx = recordList.value.findIndex((r: any) => r.id === item.id);
  if (idx >= 0) {
    playerStore.setPlayList(recordList.value);
    playerStore.setPlay(item);
  }
};

const isFavorited = (id: number) => playerStore.favoriteList.some((s: any) => s.id === id);

const toggleFavorite = (id: number) => {
  if (isFavorited(id)) {
    playerStore.removeFromFavorite(id);
  } else {
    playerStore.addToFavorite(id);
  }
};

const getArtistNames = (item: any) => {
  if (item.ar) return item.ar.map((a: any) => a.name).join(' / ');
  if (item.artists) return item.artists.map((a: any) => a.name).join(' / ');
  return '';
};

const showFollowList = () => {
  if (!userDetail.value) return;
  router.push({
    path: '/user/follows',
    query: { uid: userId.value.toString(), name: userDetail.value.profile.nickname }
  });
};

const showFollowerList = () => {
  if (!userDetail.value) return;
  router.push({
    path: '/user/followers',
    query: { uid: userId.value.toString(), name: userDetail.value.profile.nickname }
  });
};

const goToImportPlaylist = () => {
  router.push('/playlist/import');
};

const isArtist = (profile: any) => {
  return profile.userType === 4 || profile.userType === 2 || profile.accountType === 2;
};
</script>

<style lang="scss" scoped>
.record-row {
  transition: background-color 0.2s ease;
}
</style>
