/**
 * 播放控制器服务
 */
import { usePlayerStore } from '@/store/modules/player';

import { audioService } from './audioService';

/**
 * 重新解析当前歌曲
 */
export async function reparseCurrentSong(): Promise<void> {
  const playerStore = usePlayerStore();
  const currentSong = playerStore.playMusic;

  if (!currentSong?.id) {
    throw new Error('没有正在播放的歌曲');
  }

  // 停止当前播放
  audioService.stop();

  // 重新获取播放链接并播放
  const url = currentSong.playMusicUrl;
  if (url) {
    await audioService.play(url, currentSong, true);
  }
}

export default {
  reparseCurrentSong
};
