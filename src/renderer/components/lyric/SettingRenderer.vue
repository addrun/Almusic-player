<template>
  <div class="space-y-2 pt-2">
    <template v-for="(item, index) in settings" :key="index">
      <!-- 分割线 -->
      <div v-if="item.type === 'divider'" class="radio-group-divider"></div>

      <!-- 布尔开关 -->
      <div v-else-if="item.type === 'boolean' && isSettingVisible(item)" class="setting-item">
        <span>{{ item.label }}</span>
        <input
          type="checkbox"
          :checked="getConfigValue(item.key!)"
          @change="setConfigValue(item.key!, ($event.target as HTMLInputElement).checked)"
          class="toggle-switch"
        />
      </div>

      <!-- 滑块 -->
      <div v-else-if="item.type === 'slider' && isSettingVisible(item)" class="slider-group">
        <label class="slider-label">{{ item.label }}</label>
        <input
          type="range"
          :value="getConfigValue(item.key!)"
          @input="setConfigValue(item.key!, Number(($event.target as HTMLInputElement).value))"
          :min="item.min"
          :max="item.max"
          :step="item.step"
          class="slider-emerald"
          :style="{ '--val-pct': sliderPct(getConfigValue(item.key!), item.min!, item.max!) }"
        />
        <div v-if="item.marks" class="slider-marks">
          <span v-for="mark in item.marks" :key="mark">{{ mark }}</span>
        </div>
      </div>

      <!-- 颜色选择器 -->
      <div v-else-if="item.type === 'color' && isSettingVisible(item)" class="setting-item">
        <span>{{ item.label }}</span>
        <input
          type="color"
          :value="getConfigValue(item.key!)"
          @input="setConfigValue(item.key!, ($event.target as HTMLInputElement).value)"
          class="color-picker"
        />
      </div>

      <!-- 单选按钮组 -->
      <div v-else-if="item.type === 'radio' && item.options" class="space-y-2">
        <template v-for="(opt, optIdx) in item.options" :key="optIdx">
          <div v-if="isOptionVisible(item, opt)" class="setting-item">
            <span>{{ opt.label }}</span>
            <input
              type="checkbox"
              :checked="getConfigValue(item.key!) === opt.value"
              @change="setConfigValue(item.key!, opt.value)"
              class="toggle-switch"
            />
          </div>
        </template>
      </div>

      <!-- 字体选择 -->
      <div
        v-else-if="item.type === 'font' && isSettingVisible(item)"
        class="radio-group"
        style="position: relative"
      >
        <label class="radio-label">{{ item.label }}</label>
        <div class="font-dropdown" ref="fontDropdownRef">
          <div class="font-dropdown__trigger" @click="showFontDropdown = !showFontDropdown">
            <span :style="{ fontFamily: `'${getConfigValue(item.key!)}', sans-serif` }">{{
              getConfigValue(item.key!)
            }}</span>
            <i class="ri-arrow-down-s-line" :class="{ 'rotate-180': showFontDropdown }"></i>
          </div>
          <Transition name="dropdown">
            <div v-if="showFontDropdown" class="font-dropdown__panel">
              <div
                v-for="font in systemFontOptions"
                :key="font"
                class="font-dropdown__item"
                :class="{ active: getConfigValue(item.key!) === font }"
                :style="{ fontFamily: `'${font}', sans-serif` }"
                @click="
                  setConfigValue(item.key!, font);
                  showFontDropdown = false;
                "
              >
                {{ font }}
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import type { SettingItem } from '@/playerStyles/registry';
import type { LyricConfig } from '@/types/lyric';

interface Props {
  settings: SettingItem[];
  config: LyricConfig;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:config': [value: LyricConfig];
}>();

const showFontDropdown = ref(false);
const systemFontOptions = ref<string[]>([]);

// 获取系统字体列表
async function loadSystemFonts() {
  try {
    const fonts = await window.api.invoke('get-system-fonts');
    if (Array.isArray(fonts) && fonts.length > 0) {
      systemFontOptions.value = fonts;
    }
  } catch {
    systemFontOptions.value = ['PingFang SC', 'Microsoft YaHei', 'SimHei', 'Arial', 'Helvetica'];
  }
}

loadSystemFonts();

function sliderPct(val: number, min: number, max: number): string {
  return `${((val - min) / (max - min)) * 100}%`;
}

function getConfigValue(key: string): any {
  return (props.config as any)[key];
}

function setConfigValue(key: string, value: any) {
  const newConfig = { ...props.config, [key]: value };
  emit('update:config', newConfig);
}

function isSettingVisible(item: SettingItem): boolean {
  if (!item.showWhen) return true;
  return checkCondition(item.showWhen);
}

function isOptionVisible(
  item: SettingItem,
  opt: { showWhen?: { key: string; is?: string; not?: string; and?: { key: string; is?: string; not?: string } } }
): boolean {
  if (!opt.showWhen) return true;
  return checkCondition(opt.showWhen);
}

function checkCondition(condition: { key: string; is?: string; not?: string; and?: { key: string; is?: string; not?: string } }): boolean {
  const val = String(getConfigValue(condition.key));
  let result = true;
  if (condition.is !== undefined) result = val === condition.is;
  else if (condition.not !== undefined) result = val !== condition.not;
  if (result && condition.and) {
    const val2 = String(getConfigValue(condition.and.key));
    if (condition.and.is !== undefined) return val2 === condition.and.is;
    if (condition.and.not !== undefined) return val2 !== condition.and.not;
  }
  return result;
}
</script>

<style scoped>
/* Settings panel styles — scoped to SettingRenderer only */

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--d-surface-alt);
  border: 1px solid var(--d-border);
  border-radius: var(--d-radius-md, 12px);
  transition: var(--d-transition-colors);
  font-size: 13px;
  color: var(--d-text-primary);
}

.setting-item:hover {
  background: var(--d-surface-hover);
}

/* Toggle switch */
.toggle-switch {
  appearance: none;
  width: 44px;
  height: 24px;
  background: var(--d-surface-active);
  border-radius: 12px;
  position: relative;
  cursor: pointer;
  transition: var(--d-transition-colors);
  flex-shrink: 0;
}

.toggle-switch::before {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  left: 2px;
  top: 2px;
  transition: all 0.3s;
}

.toggle-switch:checked {
  background: var(--accent-color, #888);
}

.toggle-switch:checked::before {
  left: 22px;
}

/* Divider */
.radio-group-divider {
  height: 1px;
  background: var(--d-border-light);
  margin: 6px 0;
}

/* Slider */
.slider-group {
  padding: 10px 12px;
  background: var(--d-surface-alt);
  border: 1px solid var(--d-border);
  border-radius: var(--d-radius-md, 12px);
}

.slider-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--d-text-secondary, rgba(255, 255, 255, 0.8));
  opacity: 0.8;
  margin-bottom: 8px;
}

.slider-emerald {
  width: 100%;
  height: 4px;
  border-radius: 2px;
  outline: none;
  appearance: none;
  background: linear-gradient(
    to right,
    var(--accent-color, #888) 0%,
    var(--accent-color, #888) var(--val-pct, 50%),
    var(--d-border-strong, rgba(255, 255, 255, 0.1)) var(--val-pct, 50%),
    var(--d-border-strong, rgba(255, 255, 255, 0.1)) 100%
  );
}

.slider-emerald::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  background: var(--accent-color, #888);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(var(--accent-color-rgb, 136, 136, 136), 0.4);
}

.slider-emerald::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: var(--accent-color, #888);
  border-radius: 50%;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 8px rgba(var(--accent-color-rgb, 136, 136, 136), 0.4);
}

.slider-marks {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 11px;
  color: var(--d-text-muted, rgba(255, 255, 255, 0.8));
  opacity: 0.5;
}

/* Radio group */
.radio-group {
  padding: 16px;
  background: var(--d-surface-alt, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--d-border-light, rgba(255, 255, 255, 0.05));
  border-radius: var(--d-radius-md, 12px);
}

.radio-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--d-text-secondary, rgba(255, 255, 255, 0.8));
  opacity: 0.7;
  margin-bottom: 12px;
}

/* Color picker */
.color-picker {
  width: 100%;
  height: 48px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  background: transparent;
  flex-shrink: 0;
}

.color-picker::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-picker::-webkit-color-swatch {
  border: 1px solid var(--d-border, rgba(255, 255, 255, 0.1));
  border-radius: var(--d-radius-sm, 8px);
}

/* Font dropdown */
.font-dropdown {
  position: relative;
}

.font-dropdown__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 12px;
  background: var(--d-surface-active, rgba(0, 0, 0, 0.4));
  border: 1px solid var(--d-border, rgba(255, 255, 255, 0.12));
  border-radius: var(--d-radius-sm, 8px);
  color: var(--d-text-primary, rgba(255, 255, 255, 0.9));
  font-size: 14px;
  cursor: pointer;
  transition: border-color var(--d-duration-fast, 0.2s);
}

.font-dropdown__trigger:hover {
  border-color: var(--d-border-strong, rgba(255, 255, 255, 0.2));
}

.font-dropdown__trigger i {
  transition: transform var(--d-duration-fast, 0.2s);
  color: var(--d-text-muted, rgba(255, 255, 255, 0.5));
}

.font-dropdown__panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 280px;
  overflow-y: auto;
  background: var(--d-card, #1a1a1e);
  border: 1px solid var(--d-border, rgba(255, 255, 255, 0.12));
  border-radius: var(--d-radius-sm, 8px);
  box-shadow: var(--d-shadow-xl, 0 8px 32px rgba(0, 0, 0, 0.6));
  z-index: var(--d-z-dropdown, 100);
  padding: 4px;
}

.font-dropdown__item {
  padding: 8px 12px;
  border-radius: var(--d-radius-xs, 6px);
  color: var(--d-text-primary, rgba(255, 255, 255, 0.85));
  font-size: 13px;
  cursor: pointer;
  transition: background var(--d-duration-fast, 0.15s);
}

.font-dropdown__item:hover {
  background: var(--d-surface-hover, rgba(255, 255, 255, 0.08));
}

.font-dropdown__item.active {
  background: rgba(var(--accent-color-rgb, 136, 136, 136), 0.2);
  color: var(--accent-color, #888);
}

/* Dropdown transition */
.dropdown-enter-active,
.dropdown-leave-active {
  transition:
    opacity 0.15s,
    transform 0.15s;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
