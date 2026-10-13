<template>
  <div
    class="kugou-page h-full w-full page-bg"
    :class="{ 'kg-motion-off': settingsStore.setData.noAnimate }"
  >
    <div ref="pageScrollRef" class="kg-page-scroll" @scroll="handlePageScroll">
      <main ref="pageShellRef" class="kg-shell">
        <div class="kg-topbar">
          <button v-if="selectedPlaylist" class="kg-back" @click="closePlaylist">
            <i class="ri-arrow-left-line" />我的歌单
          </button>
          <span v-else class="kg-eyebrow">音乐资料库 <span>/</span> 酷狗</span>
          <div class="kg-account-actions">
            <span v-if="profile" class="kg-account-name"
              ><i class="ri-user-3-line" />{{ profile.nickname }}</span
            >
            <button
              v-if="!status?.loggedIn"
              class="kg-button kg-button-small"
              :disabled="busy"
              @click="startLogin"
            >
              <i class="ri-qr-code-line" />登录酷狗
            </button>
            <button v-else class="kg-button kg-button-small" :disabled="busy" @click="syncAll">
              <i class="ri-refresh-line" :class="{ 'kg-spinning': syncing }" />{{
                syncing ? '正在同步' : '同步歌单'
              }}
            </button>
            <button
              v-if="status?.loggedIn || library"
              class="kg-icon-button"
              :disabled="busy"
              title="退出酷狗"
              aria-label="退出酷狗"
              @click="confirmLogout"
            >
              <i class="ri-logout-circle-r-line" />
            </button>
          </div>
        </div>

        <header v-if="!selectedPlaylist" class="kg-library-hero">
          <div>
            <p class="kg-kicker">听过的，喜欢的，留在这里。</p>
            <h1>酷狗歌单<span class="kg-heading-dot">.</span></h1>
            <p class="kg-intro">我喜欢的音乐，自己创建和收藏的歌单。</p>
            <div v-if="library" class="kg-library-meta">
              <span
                ><strong>{{ library.playlists.length }}</strong> 个歌单</span
              >
              <span
                ><strong>{{ totalTrackCount }}</strong> 条曲目</span
              >
              <span class="kg-sync-state" :class="{ 'kg-sync-incomplete': !library.complete }"
                ><span class="kg-status-dot" />{{
                  library.complete ? '已同步' : '部分待补全'
                }}</span
              >
            </div>
          </div>
          <div class="kg-library-art" aria-hidden="true">
            <div class="kg-record"><span /><i class="ri-music-2-line" /></div>
            <span class="kg-art-caption">YOUR MUSIC, AT HOME</span>
          </div>
        </header>

        <header v-else class="kg-playlist-hero">
          <div class="kg-hero-cover" :class="`kg-cover-${selectedPlaylist.category}`">
            <img v-if="selectedPlaylist.coverUrl" :src="selectedPlaylist.coverUrl" alt="" />
            <div v-else class="kg-cover-placeholder" aria-hidden="true">
              <span class="kg-cover-ring" /><i
                :class="selectedPlaylist.category === 'liked' ? 'ri-heart-fill' : 'ri-music-2-line'"
              />
            </div>
          </div>
          <div class="kg-hero-info">
            <div class="kg-hero-type">
              <span>{{ categoryLabel(selectedPlaylist.category) }}</span
              ><span class="kg-quiet-tag">酷狗歌单</span>
            </div>
            <h1 :title="selectedPlaylist.name">{{ selectedPlaylist.name }}</h1>
            <p class="kg-hero-owner">
              <i class="ri-user-3-line" />{{
                selectedPlaylist.ownerName || profile?.nickname || '我的音乐'
              }}
            </p>
            <div class="kg-hero-meta">
              <span
                >{{ selectedTracks?.tracks.length ?? selectedPlaylist.fetchedTrackCount
                }}<template
                  v-if="
                    selectedPlaylist.trackCount !== undefined &&
                    selectedPlaylist.trackCount !==
                      (selectedTracks?.tracks.length ?? selectedPlaylist.fetchedTrackCount)
                  "
                >
                  / {{ selectedPlaylist.trackCount }}</template
                >
                首歌曲</span
              >
              <span v-if="selectedTracks">{{ playlistDurationLabel }}</span>
              <span
                class="kg-sync-state"
                :class="{ 'kg-sync-incomplete': !selectedPlaylist.complete }"
                ><span class="kg-status-dot" />{{
                  selectedPlaylist.complete ? '已同步' : '待补全'
                }}</span
              >
            </div>
            <button
              class="kg-text-button"
              :disabled="tracksLoading || syncing || !status?.loggedIn"
              @click="loadTracks(true)"
            >
              <i class="ri-refresh-line" :class="{ 'kg-spinning': tracksLoading }" />{{
                tracksLoading ? '正在刷新' : '刷新此歌单'
              }}
            </button>
          </div>
        </header>

        <n-alert v-if="status?.warning" type="warning" class="kg-alert">{{
          status.warning
        }}</n-alert>
        <n-alert v-if="errorText" type="error" closable class="kg-alert" @close="errorText = ''"
          >{{ errorText }}
          <p v-if="library">上次同步的数据仍可查看和播放。</p></n-alert
        >
        <section v-if="syncing" class="kg-sync-progress" aria-live="polite">
          <n-spin :size="18" />
          <div>
            <p>{{ progress?.message || '正在读取酷狗云端歌单…' }}</p>
            <span v-if="progress"
              >{{ progress.completedPlaylists }} / {{ progress.totalPlaylists }} 个歌单 ·
              {{ progress.fetchedTracks }} 条曲目<template v-if="progress.currentPlaylist">
                · {{ progress.currentPlaylist }}</template
              ></span
            ><n-progress
              v-if="progress && progress.totalPlaylists > 0"
              type="line"
              :percentage="syncPercent"
              :show-indicator="false"
              :height="3"
            />
          </div>
        </section>
        <details v-if="library?.warnings.length && !syncing" class="kg-notes">
          <summary>
            <i class="ri-information-line" />{{ library.warnings.length }} 条同步提示<span
              >查看详情</span
            >
          </summary>
          <ul>
            <li v-for="(warning, index) in library.warnings" :key="index">{{ warning }}</li>
          </ul>
        </details>

        <section v-if="!library && !syncing" class="kg-welcome">
          <div v-if="loading" class="kg-loading">
            <n-spin :size="24" />
            <p>正在打开音乐资料库…</p>
          </div>
          <template v-else>
            <div class="kg-welcome-icon"><i class="ri-cloud-line" /></div>
            <h2>{{ status?.loggedIn ? '让歌单回到身边' : '把你的酷狗歌单带进来' }}</h2>
            <p>同步我喜欢、我创建和我收藏的云端歌单。</p>
            <button
              class="kg-button kg-button-primary"
              :disabled="busy"
              @click="status?.loggedIn ? syncAll() : startLogin()"
            >
              <i :class="status?.loggedIn ? 'ri-refresh-line' : 'ri-qr-code-line'" />{{
                status?.loggedIn ? '同步全部歌单' : '扫码登录酷狗'
              }}
            </button>
            <span class="kg-welcome-note">只读同步，不改变酷狗里的歌单与收藏。</span>
          </template>
        </section>

        <section v-if="library && !selectedPlaylist" class="kg-library-content">
          <div class="kg-library-toolbar">
            <nav class="kg-tabs" aria-label="歌单分类">
              <button
                v-for="tab in categoryTabs"
                :key="tab.key"
                :class="{ 'kg-tab-active': category === tab.key }"
                :aria-pressed="category === tab.key"
                @click="category = tab.key"
              >
                {{ tab.label }}<span>{{ tab.count }}</span>
              </button>
            </nav>
            <n-input
              v-model:value="playlistQuery"
              round
              clearable
              placeholder="搜索歌单"
              aria-label="搜索歌单"
              class="kg-search"
              ><template #prefix><i class="ri-search-line" /></template
            ></n-input>
          </div>
          <div v-if="filteredPlaylists.length" class="kg-playlist-grid">
            <article
              v-for="(playlist, index) in filteredPlaylists"
              :key="playlist.id"
              class="kg-playlist-card"
              :style="{ '--card-delay': `${Math.min(index, 7) * 35}ms` }"
            >
              <div class="kg-card-cover" :class="`kg-cover-${playlist.category}`">
                <button
                  class="kg-cover-open"
                  :aria-label="`打开歌单：${playlist.name}`"
                  @click="openPlaylist(playlist.id)"
                >
                  <img v-if="playlist.coverUrl" :src="playlist.coverUrl" alt="" loading="lazy" />
                  <div v-else class="kg-cover-placeholder" aria-hidden="true">
                    <span class="kg-cover-ring" /><i
                      :class="playlist.category === 'liked' ? 'ri-heart-fill' : 'ri-music-2-line'"
                    />
                  </div>
                  <span class="kg-card-open"><i class="ri-arrow-right-up-line" /></span>
                </button>
                <button
                  class="kg-card-favorite"
                  :class="{ 'kg-is-favorite': isPlaylistFavorite(playlist.id) }"
                  :aria-label="`${isPlaylistFavorite(playlist.id) ? '取消本机收藏' : '本机收藏'}：${playlist.name}`"
                  :aria-pressed="isPlaylistFavorite(playlist.id)"
                  :title="isPlaylistFavorite(playlist.id) ? '取消本机收藏' : '收藏到此电脑'"
                  @click="togglePlaylistFavorite(playlist.id)"
                >
                  <i :class="isPlaylistFavorite(playlist.id) ? 'ri-heart-fill' : 'ri-heart-line'" />
                </button>
              </div>
              <button
                class="kg-card-name"
                :title="playlist.name"
                @click="openPlaylist(playlist.id)"
              >
                {{ playlist.name }}
              </button>
              <p class="kg-card-meta">
                <span
                  >{{ playlist.fetchedTrackCount }} 首 ·
                  {{ categoryLabel(playlist.category) }}</span
                ><span v-if="!playlist.complete" class="kg-pending-dot" title="同步尚未完整" />
              </p>
            </article>
          </div>
          <div v-else class="kg-empty">
            <i :class="category === 'favorites' ? 'ri-heart-line' : 'ri-search-line'" />
            <h3>
              {{
                playlistQuery
                  ? '没有找到这个歌单'
                  : category === 'favorites'
                    ? '给常听的歌单一个位置'
                    : '这里还没有歌单'
              }}
            </h3>
            <p>
              {{
                category === 'favorites' && !playlistQuery
                  ? '点击歌单上的心形按钮，收藏到此电脑。'
                  : '试试其他关键词或分类。'
              }}
            </p>
          </div>
          <footer class="kg-library-footer">
            <span><i class="ri-cloud-check-line" />上次更新 {{ formatTime(library.syncedAt) }}</span
            ><span>仅保存在酷狗本机的列表，请先同步至酷狗云端。</span>
          </footer>
        </section>

        <section v-if="selectedPlaylist" class="kg-song-section">
          <n-alert v-if="selectedPlaylist.warnings.length" type="warning" class="kg-alert"
            ><p v-for="(warning, index) in selectedPlaylist.warnings" :key="index">
              {{ warning }}
            </p></n-alert
          >
          <n-alert v-if="tracksError" type="error" class="kg-alert">{{ tracksError }}</n-alert>
          <div ref="toolsAnchorRef" class="kg-tools-anchor" aria-hidden="true" />
          <div
            ref="stickyToolsRef"
            class="kg-sticky-tools"
            :class="{ 'kg-tools-stuck': toolsAreSticky }"
          >
            <div class="kg-song-toolbar">
              <div class="kg-primary-actions">
                <button
                  class="kg-button kg-button-primary"
                  :disabled="!playableSongs.length"
                  @click="playAll"
                >
                  <i class="ri-play-circle-line" />{{
                    trackQuery.trim() ? '播放搜索结果' : '播放全部'
                  }}
                </button>
                <button
                  class="kg-button"
                  :class="{ 'kg-is-favorite': isPlaylistFavorite(selectedPlaylist.id) }"
                  :aria-pressed="isPlaylistFavorite(selectedPlaylist.id)"
                  title="收藏到此电脑，不修改酷狗账号"
                  @click="togglePlaylistFavorite(selectedPlaylist.id)"
                >
                  <i
                    :class="
                      isPlaylistFavorite(selectedPlaylist.id) ? 'ri-heart-fill' : 'ri-heart-line'
                    "
                  />{{ isPlaylistFavorite(selectedPlaylist.id) ? '已收藏' : '收藏' }}
                </button>
                <span class="kg-tool-divider" />
                <button
                  class="kg-icon-button"
                  :class="{ 'kg-tool-active': selecting }"
                  :disabled="!displayTracks.length"
                  :aria-pressed="selecting"
                  :aria-label="selecting ? '退出批量选择' : '批量选择歌曲'"
                  :title="selecting ? '退出批量选择' : '批量选择'"
                  @click="selecting ? cancelSelection() : (selecting = true)"
                >
                  <i class="ri-checkbox-multiple-line" />
                </button>
                <button
                  class="kg-icon-button"
                  :disabled="!playableSongs.length"
                  title="将当前列表加入播放队列"
                  aria-label="加入播放队列"
                  @click="enqueueSongs()"
                >
                  <i class="ri-play-list-add-line" />
                </button>
              </div>
              <div class="kg-view-tools">
                <n-input
                  v-model:value="trackQuery"
                  round
                  clearable
                  placeholder="搜索歌曲、歌手、专辑"
                  aria-label="搜索歌曲、歌手、专辑"
                  class="kg-search kg-song-search"
                  ><template #prefix><i class="ri-search-line" /></template
                ></n-input>
                <button
                  v-if="currentPlayingIndex >= 0"
                  class="kg-icon-button"
                  title="定位正在播放的歌曲"
                  aria-label="定位正在播放的歌曲"
                  @click="locateCurrentTrack"
                >
                  <i class="ri-focus-3-line" />
                </button>
                <button
                  class="kg-icon-button"
                  :aria-pressed="compact"
                  :title="compact ? '切换到舒展列表' : '切换到紧凑列表'"
                  :aria-label="compact ? '切换到舒展列表' : '切换到紧凑列表'"
                  @click="savePreference({ compact: !compact })"
                >
                  <i :class="compact ? 'ri-list-check-2' : 'ri-grid-line'" />
                </button>
                <n-dropdown
                  trigger="click"
                  placement="bottom-end"
                  :options="sortOptions"
                  :value="sortBy"
                  @select="changeSort"
                  ><button
                    class="kg-icon-button"
                    :class="{ 'kg-tool-active': sortBy !== 'default' }"
                    :title="`排序：${sortLabel}`"
                    :aria-label="`排序：${sortLabel}`"
                  >
                    <i :class="sortIcon" /></button
                ></n-dropdown>
              </div>
            </div>

            <transition name="kg-selection">
              <div v-if="selecting" class="kg-selection-bar">
                <n-checkbox
                  :checked="allSelected"
                  :indeterminate="partiallySelected"
                  @update:checked="selectAll"
                  >全选当前列表</n-checkbox
                >
                <span>已选 {{ selectedRowKeys.size }} 首</span>
                <button
                  class="kg-text-button"
                  :disabled="!selectedSongs.length"
                  @click="enqueueSongs(true)"
                >
                  <i class="ri-play-list-add-line" />加入队列<template v-if="selectedSongs.length"
                    >（{{ selectedSongs.length }}）</template
                  >
                </button>
                <button class="kg-text-button kg-selection-cancel" @click="cancelSelection">
                  完成
                </button>
              </div>
            </transition>
            <div class="kg-list-summary">
              <span
                >{{
                  trackQuery.trim()
                    ? `找到 ${displayTracks.length} 首歌曲`
                    : `${displayTracks.length} 首歌曲`
                }}<template v-if="sortBy !== 'default'"> · {{ sortLabel }}</template></span
              ><span>双击播放 · 收藏仅保存在本机</span>
            </div>
            <p v-if="sortHint" class="kg-sort-note" role="status">
              <i class="ri-information-line" />{{ sortHint }}
            </p>
            <div class="kg-list-heading" aria-hidden="true">
              <span>{{ selecting ? '选择' : '#' }}</span
              ><span>歌曲 / 歌手</span><span class="kg-album-column">专辑</span><span>时长</span
              ><span />
            </div>
          </div>
          <div v-if="tracksLoading && !selectedTracks" class="kg-loading">
            <n-spin :size="24" />
            <p>正在打开歌单…</p>
          </div>
          <div
            v-else-if="displayTracks.length"
            ref="tracksListRef"
            class="kg-tracks"
            :class="{ 'kg-tracks-compact': compact }"
            :style="{ height: `${tracksHeight}px` }"
          >
            <div
              class="kg-track-window"
              :style="{ transform: `translateY(${virtualStart * rowHeight}px)` }"
            >
              <div
                v-for="item in visibleTracks"
                :key="item.rowKey"
                class="kg-track"
                :class="{
                  'kg-track-active': playerStore.playMusic.id === item.song.id,
                  'kg-track-selected': selectedRowKeys.has(item.rowKey),
                  'kg-track-unavailable': !canPlayKugouTrack(item.track)
                }"
                @dblclick="!selecting && playTrack(item.track)"
              >
                <div class="kg-track-index">
                  <n-checkbox
                    v-if="selecting"
                    :checked="selectedRowKeys.has(item.rowKey)"
                    :aria-label="`选择：${item.track.name}`"
                    @update:checked="toggleSelection(item.rowKey, $event)"
                    @click.stop
                    @dblclick.stop
                  /><span
                    v-else-if="playerStore.playMusic.id === item.song.id && playerStore.isPlay"
                    class="kg-equalizer"
                    aria-label="正在播放"
                    ><i /><i /><i /></span
                  ><span v-else>{{ String(item.position + 1).padStart(2, '0') }}</span>
                </div>
                <div class="kg-track-main">
                  <div v-if="!compact" class="kg-track-cover">
                    <img
                      v-if="item.track.coverUrl"
                      :src="item.track.coverUrl"
                      alt=""
                      loading="lazy"
                    /><i v-else class="ri-music-2-line" />
                  </div>
                  <div class="kg-track-title">
                    <p :title="item.track.name">
                      {{ item.track.name
                      }}<span v-if="!canPlayKugouTrack(item.track)" class="kg-unavailable-label"
                        >待匹配</span
                      >
                    </p>
                    <span :title="artistsLabel(item.track)">{{ artistsLabel(item.track) }}</span>
                  </div>
                </div>
                <span class="kg-track-album kg-album-column" :title="item.track.albumName">{{
                  item.track.albumName || '—'
                }}</span>
                <span class="kg-track-duration">{{ formatDuration(item.track.durationMs) }}</span>
                <div class="kg-track-actions">
                  <button
                    class="kg-row-button"
                    :aria-label="`搜索其他音源：${item.track.name}`"
                    title="搜索其他音源"
                    @click.stop="searchOtherSources(item.track)"
                    @dblclick.stop
                  >
                    <i class="ri-search-line" /></button
                  ><button
                    class="kg-row-button"
                    :disabled="!canPlayKugouTrack(item.track)"
                    :aria-label="`播放：${item.track.name}`"
                    :title="
                      playerStore.playMusic.id === item.song.id && playerStore.isPlay
                        ? '暂停'
                        : '播放'
                    "
                    @click.stop="playTrack(item.track)"
                    @dblclick.stop
                  >
                    <i
                      :class="
                        playerStore.playMusic.id === item.song.id && playerStore.isPlay
                          ? 'ri-pause-fill'
                          : 'ri-play-fill'
                      "
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="kg-empty">
            <i :class="trackQuery ? 'ri-search-line' : 'ri-music-2-line'" />
            <h3>
              {{
                trackQuery
                  ? '没有找到这首歌'
                  : tracksError
                    ? '暂时无法打开歌单'
                    : selectedPlaylist.complete
                      ? '歌单还是空的'
                      : '曲目尚未读取完整'
              }}
            </h3>
            <p>
              {{ trackQuery ? '试试歌曲、歌手或专辑名，也可以组合关键词。' : '刷新歌单后再试试。' }}
            </p>
            <button v-if="trackQuery" class="kg-text-button" @click="trackQuery = ''">
              清除搜索
            </button>
          </div>
          <p class="kg-playback-note">
            <i
              class="ri-information-line"
            />播放受账号权限和可用音源影响。“待匹配”歌曲可用右侧搜索寻找其他音源。
          </p>
        </section>
      </main>
    </div>
    <transition name="kg-return-top">
      <button
        v-if="showReturnTop"
        class="kg-return-top"
        type="button"
        title="回到顶部"
        aria-label="回到顶部"
        @click="returnToTop"
      >
        <span class="kg-return-top-ring" aria-hidden="true" />
        <i class="ri-arrow-up-line" aria-hidden="true" />
      </button>
    </transition>
    <n-modal
      v-model:show="loginOpen"
      preset="card"
      title="登录酷狗"
      :style="{ width: '380px', maxWidth: 'calc(100vw - 32px)' }"
      :mask-closable="false"
    >
      <div class="kugou-login">
        <p>使用酷狗手机 App 的扫一扫，并在手机上确认登录。</p>
        <div class="kugou-qr">
          <n-spin v-if="loginBusy" />
          <template v-else-if="loginQr">
            <img v-if="loginQr.imageDataUrl" :src="loginQr.imageDataUrl" alt="酷狗登录二维码" />
            <n-qr-code v-else :value="loginQr.url" :size="220" :padding="0" />
          </template>
          <i v-else class="ri-qr-code-line" />
        </div>
        <p v-if="loginQr && loginState !== 'expired'" class="mt-3" aria-live="polite">
          {{ loginState === 'scanned' ? '已扫码，请在手机上确认' : '等待扫码' }} ·
          {{ qrSeconds }} 秒后过期
        </p>
        <n-alert v-if="loginState === 'expired'" type="warning" class="mt-3"
          >二维码已过期，请刷新后重新扫描。</n-alert
        >
        <n-alert v-if="loginError" type="error" class="mt-3">{{ loginError }}</n-alert>
        <div class="flex justify-center gap-2 mt-5">
          <n-button :disabled="loginBusy" @click="startLogin">刷新二维码</n-button>
          <n-button @click="loginOpen = false">取消</n-button>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { type DropdownOption, useDialog, useMessage } from 'naive-ui';
import {
  computed,
  h,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  watch
} from 'vue';

import {
  canPlayKugouTrack,
  kugouApi,
  kugouErrorText,
  type KugouLibrary,
  type KugouLoginCheck,
  type KugouLoginQr,
  type KugouPlaylistCategory,
  type KugouPlaylistTracks,
  type KugouStatus,
  type KugouSyncProgress,
  type KugouTrack,
  toKugouSongResult
} from '@/api/kugou';
import { useOverlayNavigate } from '@/hooks/useOverlayNavigate';
import { usePlaylistConfirm } from '@/hooks/usePlaylistConfirm';
import { usePlayerStore } from '@/store/modules/player';
import { usePlayHistoryStore } from '@/store/modules/playHistory';
import { useSearchStore } from '@/store/modules/search';
import { useSettingsStore } from '@/store/modules/settings';
import {
  getKugouLocalPlayCounts,
  getKugouTrackRows,
  isKugouSortKey,
  type KugouSortKey,
  kugouSortOptions
} from '@/utils/kugouLibraryView';
import { stripAudioFileExtension } from '@/utils/kugouPlaybackMatch';

defineOptions({ name: 'KugouPlaylists' });

const message = useMessage();
const dialog = useDialog();
const playerStore = usePlayerStore();
const playHistoryStore = usePlayHistoryStore();
const searchStore = useSearchStore();
const settingsStore = useSettingsStore();
const { navigate } = useOverlayNavigate();
const { confirmPlaylistReplace } = usePlaylistConfirm();
const status = ref<KugouStatus | null>(null);
const library = ref<KugouLibrary | null>(null);
const loading = ref(true);
const syncRunning = ref(false);
const loggingOut = ref(false);
const errorText = ref('');
const progress = ref<KugouSyncProgress | null>(null);
const category = ref<'all' | 'favorites' | KugouPlaylistCategory>('all');
const playlistQuery = ref('');
const selectedId = ref<string | null>(null);
const selectedTracks = ref<KugouPlaylistTracks | null>(null);
const trackQuery = ref('');
const tracksLoading = ref(false);
const tracksError = ref('');
const selecting = ref(false);
const selectedRowKeys = ref(new Set<string>());
const randomSeed = ref(Math.floor(Math.random() * 4294967296));
const pageScrollRef = ref<HTMLElement | null>(null);
const pageShellRef = ref<HTMLElement | null>(null);
const tracksListRef = ref<HTMLElement | null>(null);
const toolsAnchorRef = ref<HTMLElement | null>(null);
const stickyToolsRef = ref<HTMLElement | null>(null);
const pageScrollTop = ref(0);
const pageViewportHeight = ref(600);
const tracksOffsetTop = ref(0);
const toolsOffsetTop = ref(0);
const stickyToolsHeight = ref(0);
const toolsAreSticky = computed(
  () => stickyToolsHeight.value > 0 && pageScrollTop.value > toolsOffsetTop.value
);
const reducedMotion = ref(false);
const rowHeight = computed(() => (compact.value ? 52 : 76));
const showReturnTop = computed(() => pageScrollTop.value > 280);
let pageResizeObserver: ResizeObserver | undefined;
let scrollFrame: number | undefined;
let motionQuery: MediaQueryList | undefined;
const preferences = computed(() => settingsStore.setData.kugouUi || {});
const compact = computed(() => preferences.value.compact === true);
const sortBy = computed<KugouSortKey>(() =>
  isKugouSortKey(preferences.value.sortBy) ? preferences.value.sortBy : 'default'
);
const sortLabel = computed(
  () => kugouSortOptions.find((option) => option.key === sortBy.value)?.label || '默认顺序'
);
const sortIcon = computed(() =>
  sortBy.value === 'random'
    ? 'ri-shuffle-line'
    : sortBy.value.endsWith('-desc')
      ? 'ri-sort-desc'
      : 'ri-sort-asc'
);
const sortGroups = [
  ['added', '添加时间', 'ri-time-line'],
  ['name', '歌曲名', 'ri-music-2-line'],
  ['artist', '歌手', 'ri-mic-line'],
  ['album', '专辑', 'ri-album-line'],
  ['duration', '时长', 'ri-timer-line'],
  ['playcount', '播放次数（本机）', 'ri-bar-chart-line']
] as const;
const sortOptions = computed<DropdownOption[]>(() => [
  {
    label: '默认顺序',
    key: 'default-order',
    icon: () => h('i', { class: 'ri-list-ordered' }),
    children: [
      { label: '默认顺序 正序', key: 'default' },
      { label: '默认顺序 倒序', key: 'default-desc' }
    ]
  },
  ...sortGroups.map(([field, label, icon]) => ({
    label,
    key: field,
    icon: () => h('i', { class: icon }),
    children: kugouSortOptions
      .filter((option) => option.key.startsWith(`${field}-`))
      .map((option) => ({ ...option }))
  })),
  {
    label: sortBy.value === 'random' ? '随机排序 · 重新打乱' : '随机排序',
    key: 'random',
    icon: () => h('i', { class: 'ri-shuffle-line' })
  }
]);
const favoritePlaylistIds = computed<string[]>(() => {
  const ids = preferences.value.favorites?.[profile.value?.userId || ''];
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
});
const isPlaylistFavorite = (id: string) => favoritePlaylistIds.value.includes(id);
function savePreference(data: Record<string, unknown>): void {
  settingsStore.setSetData({ kugouUi: { ...preferences.value, ...data } });
}
function togglePlaylistFavorite(id: string): void {
  const account = profile.value?.userId;
  if (!account) return;
  const remove = isPlaylistFavorite(id);
  const ids = remove
    ? favoritePlaylistIds.value.filter((value) => value !== id)
    : [...favoritePlaylistIds.value, id];
  savePreference({ favorites: { ...preferences.value.favorites, [account]: ids } });
  message.success(remove ? '已取消本机收藏' : '已加入本机收藏，可在“本机收藏”中找到');
}
let tracksRequest = 0;
let removeProgressListener: (() => void) | undefined;
let stateRequest: Promise<void> | undefined;
let stateEpoch = 0;
let alive = true;

const syncing = computed(() => syncRunning.value || status.value?.syncing === true);
const busy = computed(() => loading.value || syncing.value || loggingOut.value);
const profile = computed(() => status.value?.profile || library.value?.profile);
const totalTrackCount = computed(
  () => library.value?.playlists.reduce((sum, playlist) => sum + playlist.fetchedTrackCount, 0) || 0
);
const syncPercent = computed(() =>
  !progress.value?.totalPlaylists
    ? 0
    : Math.min(
        100,
        Math.floor((progress.value.completedPlaylists / progress.value.totalPlaylists) * 100)
      )
);
const labels: Record<KugouPlaylistCategory, string> = {
  liked: '我喜欢',
  created: '我创建的',
  collected: '我收藏的'
};
const categoryLabel = (key: KugouPlaylistCategory) => labels[key];
const categoryTabs = computed(() =>
  ['all', 'liked', 'created', 'collected', 'favorites'].map((key) => ({
    key: key as 'all' | 'favorites' | KugouPlaylistCategory,
    label:
      key === 'all'
        ? '全部歌单'
        : key === 'favorites'
          ? '本机收藏'
          : categoryLabel(key as KugouPlaylistCategory),
    count:
      library.value?.playlists.filter(
        (playlist) =>
          key === 'all' ||
          (key === 'favorites' ? isPlaylistFavorite(playlist.id) : playlist.category === key)
      ).length || 0
  }))
);
const filteredPlaylists = computed(
  () =>
    library.value?.playlists.filter(
      (playlist) =>
        (category.value === 'all' ||
          (category.value === 'favorites'
            ? isPlaylistFavorite(playlist.id)
            : playlist.category === category.value)) &&
        playlist.name.toLocaleLowerCase().includes(playlistQuery.value.trim().toLocaleLowerCase())
    ) || []
);
const selectedPlaylist = computed(() =>
  library.value?.playlists.find((playlist) => playlist.id === selectedId.value)
);
const localPlayCounts = computed(() => getKugouLocalPlayCounts(playHistoryStore.musicHistory));
const sortHint = computed(() => {
  if (sortBy.value.startsWith('playcount-')) {
    return '按软件现有的本机播放记录排序；无记录的歌曲排在末尾。';
  }
  if (sortBy.value.startsWith('added-')) {
    return selectedTracks.value?.tracks.some((track) => track.addedAtMs !== undefined)
      ? '按来源歌单的歌曲添加时间排序；缺失时间的歌曲排在末尾。'
      : '当前没有歌曲添加时间，可刷新此歌单后再试；接口未提供的时间保持未知。';
  }
  return sortBy.value === 'random' ? '当前随机顺序已固定，重新选择“随机排序”可再次打乱。' : '';
});
const displayTracks = computed(() =>
  getKugouTrackRows(selectedTracks.value?.tracks || [], trackQuery.value, sortBy.value, {
    randomSeed: randomSeed.value,
    localPlayCounts: sortBy.value.startsWith('playcount-') ? localPlayCounts.value : undefined
  }).map((row) => ({ ...row, song: toKugouSongResult(row.track) }))
);
// Only the page scrolls. A fixed-height row window keeps large cloud playlists cheap
// to render without a second scroll viewport or changes to full-list playback order.
const tracksHeight = computed(() => displayTracks.value.length * rowHeight.value);
const virtualStart = computed(() =>
  Math.max(
    0,
    Math.min(
      displayTracks.value.length - 1,
      Math.floor((pageScrollTop.value - tracksOffsetTop.value) / rowHeight.value) - 8
    )
  )
);
const virtualEnd = computed(() =>
  Math.min(
    displayTracks.value.length,
    Math.max(
      virtualStart.value + 1,
      Math.ceil(
        (Math.max(0, pageScrollTop.value - tracksOffsetTop.value) + pageViewportHeight.value) /
          rowHeight.value
      ) + 8
    )
  )
);
const visibleTracks = computed(() =>
  displayTracks.value.slice(virtualStart.value, virtualEnd.value)
);
const playableSongs = computed(() =>
  displayTracks.value.filter(({ track }) => canPlayKugouTrack(track)).map(({ song }) => song)
);
const selectedSongs = computed(() =>
  displayTracks.value
    .filter((row) => selectedRowKeys.value.has(row.rowKey) && canPlayKugouTrack(row.track))
    .map((row) => row.song)
);
const allSelected = computed(
  () =>
    displayTracks.value.length > 0 &&
    displayTracks.value.every((row) => selectedRowKeys.value.has(row.rowKey))
);
const partiallySelected = computed(() => selectedRowKeys.value.size > 0 && !allSelected.value);
const currentPlayingIndex = computed(() =>
  displayTracks.value.findIndex((row) => row.song.id === playerStore.playMusic.id)
);
const playlistDuration = computed(() =>
  (selectedTracks.value?.tracks || []).reduce((sum, track) => sum + track.durationMs, 0)
);
const playlistDurationLabel = computed(() => {
  const minutes = Math.round(playlistDuration.value / 60000);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`
    : `${minutes} 分钟`;
});

function toggleSelection(rowKey: string, checked: boolean): void {
  const keys = new Set(selectedRowKeys.value);
  if (checked) keys.add(rowKey);
  else keys.delete(rowKey);
  selectedRowKeys.value = keys;
}
function selectAll(checked: boolean): void {
  selectedRowKeys.value = new Set(checked ? displayTracks.value.map((row) => row.rowKey) : []);
}
function cancelSelection(): void {
  selecting.value = false;
  selectedRowKeys.value = new Set();
}
function changeSort(key: string): void {
  if (!isKugouSortKey(key)) return;
  if (key === 'random') randomSeed.value = (randomSeed.value + 0x9e3779b9) >>> 0;
  savePreference({ sortBy: key });
}
async function locateCurrentTrack(): Promise<void> {
  if (currentPlayingIndex.value < 0) return;
  await nextTick();
  measurePageScroll();
  pageScrollRef.value?.scrollTo({
    top: Math.max(
      0,
      tracksOffsetTop.value +
        currentPlayingIndex.value * rowHeight.value -
        stickyToolsHeight.value -
        Math.max(0, (pageViewportHeight.value - stickyToolsHeight.value - rowHeight.value) / 2)
    ),
    behavior: scrollBehavior()
  });
}
function scrollBehavior(): ScrollBehavior {
  return settingsStore.setData.noAnimate || reducedMotion.value ? 'auto' : 'smooth';
}
function measurePageScroll(): void {
  const page = pageScrollRef.value;
  if (!page) return;
  pageScrollTop.value = page.scrollTop;
  pageViewportHeight.value = page.clientHeight;
  const list = tracksListRef.value;
  tracksOffsetTop.value = list
    ? list.getBoundingClientRect().top -
      page.getBoundingClientRect().top +
      page.scrollTop -
      page.clientTop
    : 0;
  const anchor = toolsAnchorRef.value;
  toolsOffsetTop.value = anchor
    ? anchor.getBoundingClientRect().top -
      page.getBoundingClientRect().top +
      page.scrollTop -
      page.clientTop
    : 0;
  stickyToolsHeight.value = stickyToolsRef.value?.getBoundingClientRect().height || 0;
}
function handlePageScroll(): void {
  if (scrollFrame !== undefined) return;
  scrollFrame = window.requestAnimationFrame(() => {
    scrollFrame = undefined;
    measurePageScroll();
  });
}
function returnToTop(): void {
  pageScrollRef.value?.scrollTo({ top: 0, behavior: scrollBehavior() });
}
function onScrollMotionChange(event: MediaQueryListEvent): void {
  reducedMotion.value = event.matches;
}
watch(displayTracks, async (rows) => {
  const visible = new Set(rows.map((row) => row.rowKey));
  selectedRowKeys.value = new Set([...selectedRowKeys.value].filter((key) => visible.has(key)));
  await nextTick();
  measurePageScroll();
  // Search and sort keep the list in view when it was already being browsed.
  // Opening a playlist retains its header instead of jumping past it.
  const listStart = Math.max(0, tracksOffsetTop.value - stickyToolsHeight.value);
  if (pageScrollTop.value > listStart) {
    pageScrollRef.value?.scrollTo({ top: listStart, behavior: 'auto' });
    measurePageScroll();
  }
});
watch(compact, async (_value, previous) => {
  const page = pageScrollRef.value;
  if (!page) return;
  const oldRowHeight = previous ? 52 : 76;
  const listTop = tracksOffsetTop.value;
  const oldTop = page.scrollTop;
  const oldOverlay = oldTop >= toolsOffsetTop.value ? stickyToolsHeight.value : 0;
  const anchor = Math.max(0, (oldTop + oldOverlay - listTop) / oldRowHeight);
  await nextTick();
  measurePageScroll();
  if (oldTop + oldOverlay >= listTop) {
    page.scrollTo({
      top: Math.max(0, tracksOffsetTop.value + anchor * rowHeight.value - stickyToolsHeight.value),
      behavior: 'auto'
    });
    measurePageScroll();
  }
});
watch(
  stickyToolsRef,
  (element, previous) => {
    if (previous) pageResizeObserver?.unobserve(previous);
    if (element) pageResizeObserver?.observe(element);
    measurePageScroll();
  },
  { flush: 'post' }
);
watch(selectedId, async () => {
  cancelSelection();
  await nextTick();
  pageScrollRef.value?.scrollTo({ top: 0, behavior: 'auto' });
  measurePageScroll();
});

function formatTime(value: number): string {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}
function formatDuration(value: number): string {
  if (!value) return '—';
  const seconds = Math.floor(value / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
function artistsLabel(track: KugouTrack): string {
  return track.artists.map((artist) => artist.name).join(' / ') || '未知歌手';
}

function invalidateState(): void {
  stateEpoch++;
  stateRequest = undefined;
}

async function loadState(): Promise<void> {
  if (!alive || loggingOut.value) return;
  if (stateRequest) return stateRequest;
  const epoch = stateEpoch;
  stateRequest = (async () => {
    try {
      const [nextStatus, nextLibrary] = await Promise.all([
        kugouApi.getStatus(),
        kugouApi.getLibrary()
      ]);
      if (!alive || epoch !== stateEpoch) return;
      status.value = nextStatus;
      library.value = nextLibrary;
      if (
        selectedId.value &&
        !nextLibrary?.playlists.some((playlist) => playlist.id === selectedId.value)
      )
        closePlaylist();
    } catch (error) {
      if (alive && epoch === stateEpoch)
        errorText.value = kugouErrorText(error, '读取酷狗同步状态失败');
    } finally {
      // An obsolete request must not release a newer read or restore pre-mutation state.
      if (alive && epoch === stateEpoch) {
        loading.value = false;
        stateRequest = undefined;
      }
    }
  })();
  return stateRequest;
}

async function syncAll(): Promise<void> {
  if (syncing.value || !status.value?.loggedIn) return;
  invalidateState();
  syncRunning.value = true;
  errorText.value = '';
  progress.value = null;
  try {
    const result = await kugouApi.sync();
    if (!alive) return;
    invalidateState();
    library.value = result;
    if (result.complete) message.success(`已同步 ${result.playlists.length} 个酷狗歌单`);
    else message.warning('已保留本次读取的数据，部分歌单或曲目仍待补全');
    if (selectedId.value) await loadTracks();
  } catch (error) {
    if (alive) errorText.value = kugouErrorText(error, '同步失败，请稍后重试');
  } finally {
    syncRunning.value = false;
    if (status.value) status.value.syncing = false;
    if (alive) {
      invalidateState();
      await loadState();
    }
  }
}

function openPlaylist(id: string): void {
  selectedId.value = id;
  selectedTracks.value = null;
  trackQuery.value = '';
  void loadTracks();
}
function closePlaylist(): void {
  tracksRequest++;
  selectedId.value = null;
  selectedTracks.value = null;
  tracksError.value = '';
  tracksLoading.value = false;
}
async function loadTracks(refresh = false): Promise<void> {
  const id = selectedId.value;
  if (!id) return;
  const request = ++tracksRequest;
  if (refresh) invalidateState();
  tracksLoading.value = true;
  tracksError.value = '';
  try {
    const result = await kugouApi.getPlaylistTracks(id, refresh);
    if (!alive || request !== tracksRequest || selectedId.value !== id) return;
    if (refresh) invalidateState();
    selectedTracks.value = result;
    if (library.value)
      library.value.playlists = library.value.playlists.map((playlist) =>
        playlist.id === id ? result.playlist : playlist
      );
    if (refresh) await loadState();
  } catch (error) {
    if (alive && request === tracksRequest)
      tracksError.value = kugouErrorText(error, '读取歌单曲目失败，请刷新重试');
  } finally {
    if (request === tracksRequest) tracksLoading.value = false;
  }
}

function playTrack(track: KugouTrack): void {
  if (!canPlayKugouTrack(track)) return;
  const song = toKugouSongResult(track);
  if (playerStore.playMusic.id === song.id) {
    void playerStore.setPlay(playerStore.playMusic);
    return;
  }
  const songs = [...playableSongs.value];
  confirmPlaylistReplace(async () => {
    playerStore.setPlayList(songs);
    await playerStore.setPlay(song);
  });
}
function playAll(): void {
  const songs = [...playableSongs.value];
  if (!songs.length) return;
  confirmPlaylistReplace(async () => {
    playerStore.setPlayList(songs);
    await playerStore.setPlay(songs[0]);
  });
}
function enqueueSongs(onlySelected = false): void {
  const keys = new Set(playerStore.playList.map((song) => song.id));
  const additions = (onlySelected ? selectedSongs.value : playableSongs.value).filter((song) => {
    if (keys.has(song.id)) return false;
    keys.add(song.id);
    return true;
  });
  if (!additions.length) {
    message.info('这些歌曲已在播放队列中');
    return;
  }
  playerStore.setPlayList([...playerStore.playList, ...additions], true);
  message.success(`已加入 ${additions.length} 首歌曲`);
}
function searchOtherSources(track: KugouTrack): void {
  const keyword = [
    stripAudioFileExtension(track.name),
    track.artists.map((artist) => artist.name).join(' ')
  ]
    .filter(Boolean)
    .join(' ');
  searchStore.setSearchValue(keyword);
  searchStore.setSearchType(1);
  searchStore.setKugouBindingTarget(toKugouSongResult(track), keyword);
  navigate(
    `/search-result?keyword=${encodeURIComponent(keyword)}&type=1&kugouTarget=${encodeURIComponent(toKugouSongResult(track).id)}`,
    60,
    '搜索其他音源'
  );
}

function confirmLogout(): void {
  dialog.warning({
    title: '退出酷狗',
    content: '退出后会清除本机保存的酷狗登录信息和同步缓存，酷狗里的歌单不会改变。',
    positiveText: '退出并清除',
    negativeText: '取消',
    onPositiveClick: async () => {
      invalidateState();
      loggingOut.value = true;
      try {
        const nextStatus = await kugouApi.logout();
        if (!alive) return;
        invalidateState();
        status.value = nextStatus;
        library.value = null;
        progress.value = null;
        errorText.value = '';
        closePlaylist();
      } catch (error) {
        message.error(kugouErrorText(error, '退出酷狗失败'));
      } finally {
        loggingOut.value = false;
        if (alive) {
          invalidateState();
          loading.value = false;
        }
      }
    }
  });
}

// Each new/closed QR dialog invalidates pending responses from earlier sessions.
const loginOpen = ref(false);
const loginBusy = ref(false);
const loginQr = ref<KugouLoginQr | null>(null);
const loginState = ref<KugouLoginCheck['state']>('waiting');
const loginError = ref('');
const now = ref(Date.now());
const qrSeconds = computed(() =>
  loginQr.value ? Math.max(0, Math.ceil((loginQr.value.expiresAt - now.value) / 1000)) : 0
);
let loginEpoch = 0;
let loginTimer: ReturnType<typeof setTimeout> | undefined;
let clockTimer: ReturnType<typeof setInterval> | undefined;

async function cancelPendingLogin(): Promise<void> {
  loginEpoch++;
  clearTimeout(loginTimer);
  loginTimer = undefined;
  const previous = loginQr.value;
  loginQr.value = null;
  loginBusy.value = false;
  if (previous) {
    try {
      await kugouApi.cancelLogin(previous.sessionId);
    } catch {
      /* Closing remains possible while offline. */
    }
  }
}
function expireLogin(): void {
  if (!loginQr.value || loginState.value === 'expired') return;
  loginState.value = 'expired';
  clearTimeout(loginTimer);
  void kugouApi.cancelLogin(loginQr.value.sessionId).catch(() => undefined);
}
function scheduleLoginCheck(epoch: number): void {
  if (!alive || !loginOpen.value || epoch !== loginEpoch || loginState.value === 'expired') return;
  loginTimer = setTimeout(() => {
    void checkLogin(epoch);
  }, 1800);
}
async function checkLogin(epoch: number): Promise<void> {
  const qr = loginQr.value;
  if (!qr || !loginOpen.value || epoch !== loginEpoch) return;
  if (Date.now() >= qr.expiresAt) {
    expireLogin();
    return;
  }
  try {
    const result = await kugouApi.checkLogin(qr.sessionId);
    if (!alive || !loginOpen.value || epoch !== loginEpoch || loginState.value === 'expired')
      return;
    loginError.value = '';
    loginState.value = result.state;
    if (result.state === 'confirmed') {
      invalidateState();
      loginQr.value = null;
      loginOpen.value = false;
      const nextStatus = result.status || (await kugouApi.getStatus());
      if (!alive) return;
      invalidateState();
      status.value = nextStatus;
      library.value = null;
      closePlaylist();
      message.success('酷狗登录成功，开始同步歌单');
      await loadState();
      await syncAll();
      return;
    }
    if (result.state === 'expired') return;
  } catch (error) {
    if (!alive || !loginOpen.value || epoch !== loginEpoch) return;
    loginError.value = kugouErrorText(error, '检查登录状态失败，可刷新二维码重试');
  }
  scheduleLoginCheck(epoch);
}
async function startLogin(): Promise<void> {
  await cancelPendingLogin();
  if (!alive) return;
  loginOpen.value = true;
  loginBusy.value = true;
  loginState.value = 'waiting';
  loginError.value = '';
  const epoch = ++loginEpoch;
  try {
    const qr = await kugouApi.createLogin();
    if (!alive || !loginOpen.value || epoch !== loginEpoch) {
      void kugouApi.cancelLogin(qr.sessionId).catch(() => undefined);
      return;
    }
    loginQr.value = qr;
    now.value = Date.now();
    scheduleLoginCheck(epoch);
  } catch (error) {
    if (alive && epoch === loginEpoch)
      loginError.value = kugouErrorText(error, '获取登录二维码失败，请重试');
  } finally {
    if (epoch === loginEpoch) loginBusy.value = false;
  }
}
watch(loginOpen, (show) => {
  if (!show) void cancelPendingLogin();
});

onMounted(() => {
  motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  reducedMotion.value = motionQuery?.matches === true;
  motionQuery?.addEventListener('change', onScrollMotionChange);
  if (typeof ResizeObserver !== 'undefined') {
    pageResizeObserver = new ResizeObserver(measurePageScroll);
    if (pageScrollRef.value) pageResizeObserver.observe(pageScrollRef.value);
    if (pageShellRef.value) pageResizeObserver.observe(pageShellRef.value);
    if (stickyToolsRef.value) pageResizeObserver.observe(stickyToolsRef.value);
  }
  void nextTick(measurePageScroll);
  clockTimer = setInterval(() => {
    now.value = Date.now();
    if (loginOpen.value && loginQr.value && qrSeconds.value === 0) expireLogin();
  }, 1000);
  try {
    removeProgressListener = kugouApi.onSyncProgress((update) => {
      progress.value = update;
      if (status.value) status.value.syncing = update.stage !== 'finished';
      if (update.stage === 'finished') {
        invalidateState();
        void loadState();
      }
    });
  } catch {
    /* loadState reports unavailable desktop APIs. */
  }
  void loadState();
});
onActivated(() => {
  void nextTick(measurePageScroll);
  void loadState();
});
onDeactivated(() => {
  loginOpen.value = false;
  void cancelPendingLogin();
});
onBeforeUnmount(() => {
  alive = false;
  pageResizeObserver?.disconnect();
  if (scrollFrame !== undefined) window.cancelAnimationFrame(scrollFrame);
  motionQuery?.removeEventListener('change', onScrollMotionChange);
  invalidateState();
  tracksRequest++;
  clearInterval(clockTimer);
  removeProgressListener?.();
  void cancelPendingLogin();
});
</script>

<style src="./collection.css" scoped></style>
