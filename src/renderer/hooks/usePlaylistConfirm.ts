/**
 * 播放列表替换确认 Composable
 *
 * 在歌单界面点击播放按钮时，替换播放列表前弹出确认弹窗。
 * 用户可勾选"以后不再提示"，后续操作直接执行。
 */

import { useDialog, useCheckbox } from 'naive-ui';
import { h, ref } from 'vue';

const STORAGE_KEY = 'playlistReplaceConfirmDisabled';

function isConfirmDisabled(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

function setConfirmDisabled(disabled: boolean): void {
  if (disabled) {
    localStorage.setItem(STORAGE_KEY, 'true');
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * 使用播放列表替换确认
 *
 * @example
 * ```ts
 * const { confirmPlaylistReplace } = usePlaylistConfirm();
 *
 * function handlePlayAll() {
 *   confirmPlaylistReplace(() => {
 *     playerStore.setPlayList(songs);
 *     playerStore.setPlay(songs[0]);
 *   });
 * }
 * ```
 */
export function usePlaylistConfirm() {
  const dialog = useDialog();
  const skipChecked = ref(false);

  /**
   * 确认后执行播放列表替换操作
   * @param callback 确认后的回调（执行 setPlayList 等操作）
   */
  function confirmPlaylistReplace(callback: () => void | Promise<void>): void {
    if (isConfirmDisabled()) {
      callback();
      return;
    }

    skipChecked.value = false;

    dialog.warning({
      title: '替换播放列表',
      content: () => {
        // 使用 h() 渲染包含 checkbox 的内容
        return [
          h('div', { style: { marginBottom: '12px' } }, '该操作将会使播放列表被替换为当前歌单，是否继续？'),
          h('label', {
            style: { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#999', fontSize: '13px' }
          }, [
            h('input', {
              type: 'checkbox',
              checked: skipChecked.value,
              onChange: (e: Event) => {
                skipChecked.value = (e.target as HTMLInputElement).checked;
              }
            }),
            '以后不再提示'
          ])
        ];
      },
      positiveText: '继续',
      negativeText: '取消',
      style: { zIndex: 999999999 },
      onPositiveClick: () => {
        if (skipChecked.value) {
          setConfirmDisabled(true);
        }
        callback();
      }
    });
  }

  return { confirmPlaylistReplace };
}
