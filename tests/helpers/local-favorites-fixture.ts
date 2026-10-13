import { reactive } from 'vue';

import type { SongResult } from '../../src/renderer/types/music';

export const accountWrites: Array<{ id: number; like: boolean }> = [];
export const likeSong = async (id: number, like: boolean) => {
  accountWrites.push({ id, like });
};
export const getLikedList = async () => ({ data: { ids: [] as number[] } });
export const hasPermission = () => true;
export const useUserStore = () => ({ user: { userId: 1 } });
export const dislikeRecommendedSong = async () => ({ data: { data: null } });
export const rendererPlayer = reactive({
  playMusic: {} as SongResult,
  isPlay: false,
  dislikeList: [] as Array<string | number>,
  async setPlay(song: SongResult) {
    rendererPlayer.playMusic = song;
    return true;
  }
});
export const usePlayerStore = () => rendererPlayer;
export const useRecommendStore = () => ({ dailyRecommendSongs: [] as SongResult[] });
export const useMessage = () => ({ success() {}, error() {} });
export const useI18n = () => ({ t: (key: string) => key });
export const useDownload = () => ({ async downloadMusic() {}, async downloadLyric() {} });
export const useArtist = () => ({ navigateToArtist() {} });
export const useOverlayNavigate = () => ({ navigate() {} });
export const getImgUrl = () => '';
export const getImageBackground = async () => ({ backgroundColor: '', primaryColor: '' });
