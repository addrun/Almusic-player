<template>
  <setting-section :title="t('settings.sections.plugins')">
    <div class="flex gap-1 mb-4 p-0.5 bg-gray-100 dark:bg-white/5 rounded-lg">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="flex-1 py-1.5 text-xs font-medium rounded-md transition-all duration-200"
        :class="[
          activeTab === tab.key
            ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
        ]"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- 额外功能列表 -->
    <div v-show="activeTab === 'features'" class="space-y-px">
      <div
        v-for="feature in featureList"
        :key="feature.id"
        class="flex items-center p-4 transition-colors bg-transparent text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 last:border-b-0 hover:bg-gray-50 hover:dark:bg-white/5"
      >
        <div
          class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mr-3 bg-gray-100 dark:bg-white/10 text-lg"
        >
          <i :class="feature.icon"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-base font-medium">{{ feature.name }}</span>
            <span
              v-if="feature.locked"
              class="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400 leading-none"
            >
              内置
            </span>
            <span
              class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 leading-none capitalize"
            >
              {{ typeLabel(feature.type) }}
            </span>
          </div>
          <div class="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
            {{ feature.description }}
          </div>
        </div>
        <div class="shrink-0 ml-4 flex items-center gap-2">
          <s-btn v-if="feature.id === 'lyric-metaphor' && isFeatureEnabled(feature.id)" @click="showAIConfig = true">
            <i class="ri-settings-3-line"></i>
          </s-btn>
          <n-switch
            v-if="!feature.locked"
            :value="isFeatureEnabled(feature.id)"
            size="small"
            @update:value="(val) => toggleFeature(feature.id, val)"
          />
        </div>
      </div>
    </div>

    <!-- 导入 -->
    <div v-show="activeTab === 'import'" class="space-y-4">
      <div class="flex flex-col items-center justify-center py-8 text-sm text-gray-400">
        <i class="ri-upload-cloud-line text-3xl mb-3"></i>
        <p class="mb-1">{{ t('settings.plugins.importHint') }}</p>
        <div class="flex gap-2 mt-2">
          <s-btn @click="importLxMusic"> <i class="ri-file-js-line"></i> lxMusic </s-btn>
          <s-btn @click="importCustomApi"> <i class="ri-file-json-line"></i> customApi </s-btn>
        </div>
      </div>
    </div>
  </setting-section>

  <!-- AI 配置弹窗 -->
  <metaphor-config-modal v-model="showAIConfig" />
</template>

<script setup lang="ts">
import { inject, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { isFeatureEnabled, setFeatureEnabled, getAllFeatures } from '@/features/index';
import MetaphorConfigModal from '@/features/lyric-metaphor/MetaphorConfigModal.vue';
import type { FeatureType } from '@/features/index';

import { SETTINGS_MESSAGE_KEY } from '../keys';
import SBtn from '../SBtn.vue';
import SettingSection from '../SettingSection.vue';

const { t } = useI18n();
const message = inject(SETTINGS_MESSAGE_KEY)!;

const tabs = [
  { key: 'features', label: '额外功能' },
  { key: 'import', label: '导入' }
];

const activeTab = ref('features');
const showAIConfig = ref(false);

const featureList = getAllFeatures();

function typeLabel(type: FeatureType): string {
  const map: Record<FeatureType, string> = {
    playerStyle: '播放样式',
    analysis: '分析工具',
    tool: '工具'
  };
  return map[type] || type;
}

function toggleFeature(id: string, enabled: boolean) {
  setFeatureEnabled(id, enabled);
  if (enabled) {
    message.success(t('common.success'));
  }
}

async function importLxMusic(): Promise<void> {
  const result = await window.api.plugin.importFile('lxMusic');
  if (result) {
    message.success(`${t('common.success')}: ${result.name}`);
  }
}

async function importCustomApi(): Promise<void> {
  const result = await window.api.plugin.importFile('customApi');
  if (result) {
    message.success(`${t('common.success')}: ${result.name}`);
  }
}
</script>
