<template>
  <div class="smart-mix-settings">
    <!-- 总开关 -->
    <div class="sm-switch-row">
      <div class="sm-switch-info">
        <span class="sm-switch-label">智能混音引擎</span>
        <span class="sm-switch-desc">切歌时自动平滑过渡，避免硬切中断</span>
      </div>
      <n-switch v-model:value="enabled" size="small">
        <template #checked>开</template>
        <template #unchecked>关</template>
      </n-switch>
    </div>

    <!-- 三种模式选择 -->
    <transition name="sm-expand">
      <div v-if="enabled" class="sm-modes">
        <div class="sm-modes-grid">
          <div
            v-for="mode in modes"
            :key="mode.level"
            class="sm-mode-card"
            :class="{
              'is-selected': transitionLevel === mode.level,
              'is-recommended': recommendedLevel === mode.level,
              'is-disabled': !mode.available
            }"
            @click="selectMode(mode.level)"
          >
            <!-- 推荐徽章 -->
            <div v-if="recommendedLevel === mode.level" class="sm-badge">
              <i class="ri-star-fill"></i> 推荐
            </div>

            <!-- 图标 -->
            <div class="sm-mode-icon">
              <i :class="mode.icon"></i>
            </div>

            <!-- 标题 -->
            <div class="sm-mode-title">{{ mode.title }}</div>
            <div class="sm-mode-subtitle">Level {{ mode.level }}</div>

            <!-- 描述 -->
            <div class="sm-mode-desc">{{ mode.desc }}</div>

            <!-- 不可用提示 -->
            <div v-if="!mode.available" class="sm-unavailable">
              {{ mode.unavailableReason }}
            </div>
          </div>
        </div>

        <!-- 硬件信息 -->
        <div class="sm-hardware">
          <div class="sm-hw-item">
            <i class="ri-cpu-line"></i>
            <span>CPU: {{ hardwareCores }} 核</span>
          </div>
          <div class="sm-hw-item">
            <i class="ri-ram-line"></i>
            <span>内存: {{ hardwareMem }} GB</span>
          </div>
          <div class="sm-hw-reason">{{ hardwareReason }}</div>
        </div>

        <!-- 过渡时长 -->
        <div class="sm-duration-row">
          <span class="sm-duration-label">过渡时长</span>
          <n-slider
            v-model:value="duration"
            :min="2"
            :max="15"
            :step="0.5"
            :marks="{ 2: '2s', 5: '5s', 8: '8s', 12: '12s', 15: '15s' }"
            style="max-width: 300px"
          />
          <span class="sm-duration-value">{{ duration.toFixed(1) }}s</span>
        </div>

        <!-- BPM 预分析 -->
        <div class="sm-bpm-row">
          <div class="sm-bpm-info">
            <span class="sm-bpm-label">BPM 预分析</span>
            <span class="sm-bpm-desc">后台计算精确 BPM，提升节拍对齐质量（占用额外 CPU）</span>
          </div>
          <n-switch v-model:value="bpmPreAnalysis" size="small" />
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { NSlider, NSwitch } from 'naive-ui';

import { isLevelAvailable, useMixEngineStore, type TransitionLevel } from '@/store/modules/mixEngine';

const mixEngine = useMixEngineStore();

// 状态
const enabled = ref(mixEngine.smartMixEnabled);
const transitionLevel = ref<TransitionLevel>(mixEngine.transitionLevel);
const duration = ref(mixEngine.crossfadeDuration);
const bpmPreAnalysis = ref(mixEngine.bpmPreAnalysis);

const recommendedLevel = computed(() => mixEngine.hardwareScore?.level ?? 1);
const hardwareCores = computed(() => mixEngine.hardwareScore?.cpuCores ?? navigator.hardwareConcurrency ?? 4);
const hardwareMem = computed(() => (navigator as any).deviceMemory ?? 4);
const hardwareReason = computed(() => mixEngine.hardwareScore?.reason ?? '');

// 模式定义
const modes = computed(() => [
  {
    level: 1 as TransitionLevel,
    title: '等功率',
    icon: 'ri-equalizer-line',
    desc: '余弦曲线淡入淡出\n总功率恒定，避免音量凹陷',
    available: isLevelAvailable(1),
    unavailableReason: ''
  },
  {
    level: 2 as TransitionLevel,
    title: '节拍对齐',
    icon: 'ri-pulse-line',
    desc: 'BPM 对齐 + 乐句边界\n4 拍过渡窗口',
    available: isLevelAvailable(2),
    unavailableReason: isLevelAvailable(2) ? '' : '需要至少 2 核 CPU / 2GB 内存'
  },
  {
    level: 3 as TransitionLevel,
    title: '频域拼接',
    icon: 'ri-equalizer-2-line',
    desc: '三频段独立淡出\n低频晚/中频早/高频中等',
    available: isLevelAvailable(3),
    unavailableReason: isLevelAvailable(3) ? '' : '需要至少 4 核 CPU / 4GB 内存'
  }
]);

// 选择模式
const selectMode = (level: TransitionLevel) => {
  if (!isLevelAvailable(level)) return;
  transitionLevel.value = level;
  mixEngine.setTransitionLevel(level);
};

// watch 状态变化
watch(enabled, (val) => mixEngine.setSmartMixEnabled(val));
watch(duration, (val) => mixEngine.setCrossfadeDuration(val));
watch(bpmPreAnalysis, (val) => mixEngine.setBpmPreAnalysis(val));

onMounted(() => {
  mixEngine.evaluateAndRecommend();
});
</script>

<style lang="scss" scoped>
.smart-mix-settings {
  width: 100%;
}

.sm-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}

.sm-switch-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sm-switch-label {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
  .dark & { color: #e0e0e0; }
}

.sm-switch-desc {
  font-size: 12px;
  color: #888;
}

.sm-modes {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sm-modes-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.sm-mode-card {
  position: relative;
  padding: 16px 12px;
  border-radius: 12px;
  border: 2px solid rgba(0, 0, 0, 0.06);
  background: rgba(0, 0, 0, 0.02);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;

  .dark & {
    border-color: rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.03);
  }

  &:hover:not(.is-disabled) {
    border-color: rgba(var(--accent-color-rgb, 100, 100, 100), 0.4);
    background: rgba(var(--accent-color-rgb, 100, 100, 100), 0.05);
  }

  &.is-selected {
    border-color: var(--accent-color, #4f46e5);
    background: rgba(var(--accent-color-rgb, 79, 70, 229), 0.08);
  }

  &.is-recommended {
    &::before {
      content: '';
      position: absolute;
      inset: -2px;
      border-radius: 12px;
      border: 2px solid rgba(var(--accent-color-rgb, 79, 70, 229), 0.3);
      pointer-events: none;
    }
  }

  &.is-disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.sm-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  background: var(--accent-color, #4f46e5);
  padding: 2px 6px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 2px;

  i {
    font-size: 10px;
  }
}

.sm-mode-icon {
  font-size: 28px;
  color: var(--accent-color, #4f46e5);
  margin-bottom: 8px;
  opacity: 0.7;

  .is-selected & {
    opacity: 1;
  }
}

.sm-mode-title {
  font-size: 14px;
  font-weight: 700;
  color: #1a1a1a;
  .dark & { color: #e0e0e0; }
}

.sm-mode-subtitle {
  font-size: 11px;
  color: #999;
  margin-bottom: 6px;
}

.sm-mode-desc {
  font-size: 11px;
  color: #777;
  line-height: 1.5;
  white-space: pre-line;

  .dark & { color: #999; }
}

.sm-unavailable {
  margin-top: 6px;
  font-size: 10px;
  color: #ef4444;
}

.sm-hardware {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.03);
  .dark & { background: rgba(255, 255, 255, 0.03); }
}

.sm-hw-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #666;
  .dark & { color: #aaa; }

  i { font-size: 16px; }
}

.sm-hw-reason {
  font-size: 12px;
  color: var(--accent-color, #4f46e5);
  margin-left: auto;
  font-weight: 500;
}

.sm-duration-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sm-duration-label {
  font-size: 13px;
  font-weight: 500;
  color: #333;
  .dark & { color: #ccc; }
  white-space: nowrap;
}

.sm-duration-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent-color, #4f46e5);
  min-width: 36px;
  text-align: right;
}

.sm-bpm-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sm-bpm-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sm-bpm-label {
  font-size: 13px;
  font-weight: 500;
  color: #333;
  .dark & { color: #ccc; }
}

.sm-bpm-desc {
  font-size: 11px;
  color: #888;
}

// 过渡动画
.sm-expand-enter-active,
.sm-expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}
.sm-expand-enter-from,
.sm-expand-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0;
}
.sm-expand-enter-to,
.sm-expand-leave-from {
  max-height: 500px;
}

// 响应式
@media (max-width: 640px) {
  .sm-modes-grid {
    grid-template-columns: 1fr;
  }
}
</style>
