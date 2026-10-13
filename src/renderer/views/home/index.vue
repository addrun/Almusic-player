<template>
  <div class="home-container h-full w-full transition-colors duration-500">
    <n-scrollbar class="h-full">
      <div class="home-content w-full pb-32 page-padding">
        <!-- Hero Section -->
        <home-hero class="enter-fade" />

        <!-- Main Content Sections -->
        <div class="content-sections space-y-10 md:space-y-8 lg:space-y-12">
          <!-- Recommended Playlists (Grid Section) -->
          <home-playlist-section :title="t('comp.recommendSonglist.title')" :limit="18" class="enter-stagger" />

          <!-- Hot Artists (Horizontal Scroll Section) -->
          <home-artists :title="t('comp.recommendSinger.title')" :limit="15" class="enter-stagger" />

          <!-- New Albums (NEW - 新碟上架) -->
          <home-album-section
            :title="t('comp.newAlbum.title')"
            :limit="6"
            :columns="5"
            :rows="1"
            class="enter-stagger"
            @more="router.push('/album')"
          />

          <!-- New Songs (Compact Grid Section) -->
          <home-new-songs :title="t('comp.recommendNewMusic.title')" :limit="20" class="enter-stagger" />
        </div>
      </div>
    </n-scrollbar>
  </div>
</template>

<script lang="ts" setup>
import { NScrollbar } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import HomeAlbumSection from './components/HomeAlbumSection.vue';
import HomeArtists from './components/HomeArtists.vue';
import HomeHero from './components/HomeHero.vue';
import HomeNewSongs from './components/HomeNewSongs.vue';
import HomePlaylistSection from './components/HomePlaylistSection.vue';

defineOptions({
  name: 'Home'
});

const { t } = useI18n();
const router = useRouter();
</script>

<style lang="scss" scoped>
.home-container {
  position: relative;
  background: var(--bg-color);
}

/* 移动端使用暖色基底 */
.mobile .home-container {
  background: var(--m-bg, var(--bg-color));
}

/* 入场动画 - 使用自定义缓动曲线（Emil Kowalski 风格） */
:deep(.animate-item) {
  animation: fadeInUp 0.6s var(--m-ease-out, cubic-bezier(0.23, 1, 0.32, 1)) backwards;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 交错延迟 - 50ms 间隔（技能建议 30-80ms） */
:deep(.animate-item) {
  @for $i from 1 through 20 {
    &:nth-child(#{$i}) {
      animation-delay: #{$i * 0.05}s;
    }
  }
}
</style>
