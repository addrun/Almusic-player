/**
 * 高潮模式驱动器 (Climax Driver)
 *
 * 读取 ClimaxEditor 标记的高潮段落 + drumDetector 实时鼓点
 * 驱动排版播放器的三种高潮颜色模式
 */

import { type Ref,ref, watch } from 'vue';

import { nowTime } from '@/hooks/MusicHook';
import { type BeatInfo,drumDetector } from '@/services/drumDetector';

/** 高潮模式 */
export type ClimaxMode = 1 | 2 | 3;

/** 颜色状态 */
export interface ClimaxColorState {
  /** 模式1: 当前使用强调色(true)还是主色(false) */
  phase: boolean;
  /** 模式2: 是否反转（背景与文字互换） */
  inverted: boolean;
  /** 模式3: 当前背景色索引 (0=白, 1=强调色, 2=主色) */
  bgIndex: number;
}

/**
 * 创建高潮驱动器
 *
 * @param climaxSegments 高潮段落数据 [{start, end}]
 * @param onModeChange 模式切换回调
 */
export function createClimaxDriver(
  climaxSegments: Ref<{ start: number; end: number }[]>,
  onModeChange?: (mode: ClimaxMode, beat: BeatInfo) => void
) {
  const isInClimax = ref(false);
  const currentMode = ref<ClimaxMode>(1);
  const colorState = ref<ClimaxColorState>({
    phase: false,
    inverted: false,
    bgIndex: 0,
  });

  // 手动切换模式
  function cycleMode() {
    currentMode.value = ((currentMode.value % 3) + 1) as ClimaxMode;
  }

  // 监听鼓点
  function handleBeat(info: BeatInfo) {
    if (!isInClimax.value) return;

    switch (currentMode.value) {
      case 1:
        // 模式一：文字和色块颜色在强调色和主色之间交替
        colorState.value.phase = !colorState.value.phase;
        break;
      case 2:
        // 模式二：背景与文字和色块的颜色不断互换
        colorState.value.inverted = !colorState.value.inverted;
        break;
      case 3:
        // 模式三：背景颜色在白色、强调色、主色中不断切换
        colorState.value.bgIndex = (colorState.value.bgIndex + 1) % 3;
        break;
    }

    onModeChange?.(currentMode.value, info);
  }

  // 注册鼓点监听
  let unsubscribeBeat: (() => void) | null = null;

  function startListening() {
    if (unsubscribeBeat) return;
    drumDetector.start();
    unsubscribeBeat = drumDetector.onBeat(handleBeat);
  }

  function stopListening() {
    if (unsubscribeBeat) {
      unsubscribeBeat();
      unsubscribeBeat = null;
    }
    drumDetector.stop();
  }

  // 监听播放时间，判断是否在高潮段落内
  watch(
    nowTime,
    (time) => {
      const segments = climaxSegments.value;
      if (!segments || segments.length === 0) {
        if (isInClimax.value) {
          isInClimax.value = false;
          // 重置状态
          colorState.value = { phase: false, inverted: false, bgIndex: 0 };
        }
        return;
      }

      const inSegment = segments.some(
        (seg) => time >= seg.start && time <= seg.end
      );

      if (inSegment && !isInClimax.value) {
        isInClimax.value = true;
        startListening();
      } else if (!inSegment && isInClimax.value) {
        isInClimax.value = false;
        stopListening();
        // 重置状态
        colorState.value = { phase: false, inverted: false, bgIndex: 0 };
      }
    },
    { immediate: true }
  );

  return {
    isInClimax,
    currentMode,
    colorState,
    cycleMode,
    startListening,
    stopListening,
  };
}
