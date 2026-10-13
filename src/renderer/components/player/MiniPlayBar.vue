<template>
  <div
    class="mini-play-bar"
    :class="{ 'mini-mode': settingsStore.isMiniMode }"
  >
    <div class="mini-bar-container">
      <!-- 专辑封面 -->
      <div class="album-cover">
        <n-image
          :src="getImgUrl(playMusic?.picUrl, '100y100')"
          fallback-src="/placeholder.png"
          class="cover-img"
          preview-disabled
        />
      </div>

      <!-- 歌曲信息 -->
      <div class="song-info">
        <div class="song-title" v-html="playMusic?.name || '未播放'"></div>
        <div class="song-artist">
          <span
            v-for="(artists, artistsindex) in artistList"
            :key="artistsindex"
          >
            {{ artists.name }}{{ artistsindex < artistList.length - 1 ? ' / ' : '' }}
          </span>
        </div>
      </div>

      <!-- 控制按钮 -->
      <div class="control-buttons">
        <div class="control-button previous" @click="handlePrev">
          <i class="iconfont icon-prev"></i>
        </div>
        <div class="control-button play" @click="playMusicEvent">
          <i class="iconfont" :class="play ? 'icon-stop' : 'icon-play'"></i>
        </div>
        <div class="control-button next" @click="handleNext">
          <i class="iconfont icon-next"></i>
        </div>
      </div>

      <!-- 右侧功能按钮 -->
      <div class="function-buttons">
        <div class="function-button" @click="handleNext" title="下一首">
          <i class="iconfont icon-next"></i>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { artistList, playMusic } from '@/hooks/MusicHook';
import { usePlayerStore } from '@/store/modules/player';
import { useSettingsStore } from '@/store/modules/settings';
import { getImgUrl } from '@/utils';

const { t } = useI18n();
const playerStore = usePlayerStore();
const settingsStore = useSettingsStore();

const play = computed(() => playerStore.isPlay);

const playMusicEvent = async () => {
  try {
    await playerStore.setPlay({ ...playMusic.value });
    if (playerStore.isPlay) {
      playerStore.setPlayMusic(true);
    }
  } catch (error) {
    console.error('播放失败:', error);
  }
};

const handlePrev = () => {
  playerStore.prevPlay();
};

const handleNext = () => {
  playerStore.nextPlay();
};
</script>

<style scoped lang="scss">
.mini-play-bar {
  position: relative;
  width: 100%;
  flex: 1;
  background: var(--bg-color, #fff);
  display: flex;
  align-items: center;
}

.mini-bar-container {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0 16px;
  gap: 12px;
}

.album-cover {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  cursor: pointer;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.song-info {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.song-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color, #333);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-artist {
  font-size: 12px;
  color: var(--text-color-200, #999);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.control-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-button {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text-color, #333);

  &:hover {
    background: rgba(0, 0, 0, 0.05);
    color: var(--accent-color, #888888);
  }

  &.play {
    width: 36px;
    height: 36px;
    background: var(--accent-color, #888888);
    color: #fff;

    &:hover {
      background: var(--accent-color-dark, #747474);
    }
  }
}

.function-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.function-button {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text-color, #333);

  &:hover {
    background: rgba(0, 0, 0, 0.05);
    color: var(--accent-color, #888888);
  }
}
</style>
