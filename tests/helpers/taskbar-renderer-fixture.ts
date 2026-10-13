import { computed, reactive, ref } from 'vue';
import type { SongResult } from '../../src/renderer/types/music';

export const rendererPlayer = reactive({
  playMusic: {} as SongResult,
  play: false,
  isPlay: false,
  actions: [] as string[],
  async handlePause() {
    rendererPlayer.actions.push('pause');
    rendererPlayer.play = rendererPlayer.isPlay = false;
  },
  async setPlay() {
    rendererPlayer.actions.push('play');
    rendererPlayer.play = rendererPlayer.isPlay = true;
  },
  async prevPlay() {
    rendererPlayer.actions.push('previous');
  },
  async nextPlay() {
    rendererPlayer.actions.push('next');
  },
  getVolume() {
    return 0.5;
  },
  increaseVolume() {
    return 0.6;
  },
  decreaseVolume() {
    return 0.4;
  }
});
export const playMusic = computed(() => rendererPlayer.playMusic);
export const usePlayerStore = () => rendererPlayer;
export const useSettingsStore = () => ({ isMiniMode: true });
export const isElectron = true;
export const isLyricWindow = ref(false);

// Fake account API calls are recorded, with no network transport or credentials.
export const accountWrites: Array<{ id: number; like: boolean }> = [];
export const likeSong = async (id: number, like: boolean) => {
  accountWrites.push({ id, like });
};
export const getLikedList = async () => ({ data: { ids: [] as number[] } });
export const hasPermission = () => true;
export const useUserStore = () => ({ user: { userId: 1 } });
export const showShortcutToast = () => {};
export default { global: { t: (key: string) => key } };
