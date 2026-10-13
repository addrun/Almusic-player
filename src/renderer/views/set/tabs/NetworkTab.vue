<template>
  <setting-section v-if="isElectron" :title="t('settings.sections.network')">
    <setting-item
      :title="t('settings.network.apiPort')"
      :description="t('settings.network.apiPortDesc')"
    >
      <s-input
        v-model="setData.musicApiPort"
        type="number"
        :min="1024"
        :max="65535"
        :step="1"
        width="w-[140px] max-md:w-32"
      />
    </setting-item>

    <setting-item
      :title="t('settings.network.proxy')"
      :description="t('settings.network.proxyDesc')"
    >
      <template #action>
        <div class="flex items-center gap-2">
          <n-switch v-model:value="setData.proxyConfig.enable">
            <template #checked>{{ t('common.on') }}</template>
            <template #unchecked>{{ t('common.off') }}</template>
          </n-switch>
          <s-btn @click="showProxyModal = true">{{ t('common.configure') }}</s-btn>
        </div>
      </template>
    </setting-item>

    <setting-item
      :title="t('settings.network.githubMirror')"
      :description="t('settings.network.githubMirrorDesc')"
    >
      <template #action>
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <s-select
              v-model="mirrorSelectValue"
              :options="mirrorOptions"
              width="w-[200px] max-md:w-[160px]"
            />
            <s-btn :loading="testing" @click="testMirrors">
              <i class="ri-speed-line"></i>
              {{ t('settings.network.testMirror') }}
            </s-btn>
          </div>
          <div v-if="mirrorSelectValue === '__custom__'" class="flex items-center gap-2">
            <s-input
              v-model="githubMirrorInput"
              :placeholder="t('settings.network.githubMirrorPlaceholder')"
              width="w-[260px] max-md:w-full"
              @blur="saveMirror"
            />
          </div>
        </div>
      </template>
    </setting-item>

    <!-- 镜像测试结果 -->
    <div
      v-if="mirrorResults.length > 0"
      class="mx-4 mb-4 p-3 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800"
    >
      <div class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
        {{ t('settings.network.mirrorTestResults') }}
      </div>
      <div class="space-y-1.5">
        <div
          v-for="r in mirrorResults"
          :key="r.name"
          class="flex items-center justify-between text-xs"
        >
          <div class="flex items-center gap-2">
            <i
              :class="r.ok ? 'ri-checkbox-circle-fill text-[var(--accent-color)]' : 'ri-close-circle-fill text-red-400'"
            ></i>
            <span class="text-gray-700 dark:text-gray-300">{{ r.name }}</span>
          </div>
          <div class="flex items-center gap-3 text-gray-500 dark:text-gray-400">
            <span v-if="r.ok">{{ r.latencyMs }}ms</span>
            <span v-if="r.ok && r.speed > 0">{{ formatSpeed(r.speed) }}</span>
            <span v-if="!r.ok" class="text-red-400">{{ r.error }}</span>
            <button
              v-if="r.ok"
              class="text-[var(--accent-color)] hover:underline"
              @click="applyMirror(r.url)"
            >
              {{ t('settings.network.useThisMirror') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <setting-item
      :title="t('settings.network.realIP')"
      :description="t('settings.network.realIPDesc')"
    >
      <template #action>
        <div class="flex items-center gap-2 max-md:flex-wrap">
          <n-switch v-model:value="setData.enableRealIP">
            <template #checked>{{ t('common.on') }}</template>
            <template #unchecked>{{ t('common.off') }}</template>
          </n-switch>
          <s-input
            v-if="setData.enableRealIP"
            v-model="setData.realIP"
            placeholder="realIP"
            width="w-[200px] max-md:w-full"
            @blur="validateAndSaveRealIP"
          />
        </div>
      </template>
    </setting-item>

    <proxy-settings
      v-model:show="showProxyModal"
      :config="proxyForm"
      @confirm="handleProxyConfirm"
    />
  </setting-section>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import ProxySettings from '@/components/settings/ProxySettings.vue';
import { isElectron } from '@/utils';

import { SETTINGS_DATA_KEY, SETTINGS_MESSAGE_KEY } from '../keys';
import SBtn from '../SBtn.vue';
import SSelect from '../SSelect.vue';
import SettingItem from '../SettingItem.vue';
import SettingSection from '../SettingSection.vue';
import SInput from '../SInput.vue';

const { t } = useI18n();
const setData = inject(SETTINGS_DATA_KEY)!;
const message = inject(SETTINGS_MESSAGE_KEY)!;

const showProxyModal = ref(false);
const proxyForm = ref({ protocol: 'http', host: '127.0.0.1', port: 7890 });

const MIRROR_PRESETS = [
  { label: 'GitHub 直连', value: '' },
  { label: 'gh-proxy.com', value: 'https://gh-proxy.com' },
  { label: 'ghproxy.net', value: 'https://ghproxy.net' },
  { label: 'ghproxy.link', value: 'https://ghproxy.link' },
  { label: 'ghfast.top', value: 'https://ghfast.top' },
  { label: 'ghproxy.cxkpro.top', value: 'https://ghproxy.cxkpro.top' },
  { label: 'github-proxy.memory-echoes.cn', value: 'https://github-proxy.memory-echoes.cn' },
  { label: '---custom---', value: '__custom__' }
];

const mirrorOptions = computed(() =>
  MIRROR_PRESETS.map((m) => ({
    label: m.value === '__custom__' ? t('settings.network.githubMirrorCustom') : m.label,
    value: m.value
  }))
);

const githubMirrorInput = ref((setData.value.githubMirror as string) || '');
const testing = ref(false);
const mirrorResults = ref<
  { name: string; url: string; ok: boolean; latencyMs: number; speed: number; error?: string }[]
>([]);

const isCustomMirror = computed(() => {
  const val = (setData.value.githubMirror as string) || '';
  return val !== '' && !MIRROR_PRESETS.some((m) => m.value === val && m.value !== '__custom__');
});

const mirrorSelectValue = computed({
  get: () => {
    const val = (setData.value.githubMirror as string) || '';
    if (val === '') return '';
    if (MIRROR_PRESETS.some((m) => m.value === val && m.value !== '__custom__')) return val;
    return '__custom__';
  },
  set: (val: string) => {
    if (val === '__custom__') {
      setData.value = { ...setData.value, githubMirror: githubMirrorInput.value || '' };
    } else {
      setData.value = { ...setData.value, githubMirror: val };
      githubMirrorInput.value = val;
    }
  }
});

watch(
  () => setData.value.proxyConfig,
  (newVal) => {
    if (newVal) {
      proxyForm.value = {
        protocol: newVal.protocol || 'http',
        host: newVal.host || '127.0.0.1',
        port: newVal.port || 7890
      };
    }
  },
  { immediate: true, deep: true }
);

const saveMirror = () => {
  setData.value = { ...setData.value, githubMirror: githubMirrorInput.value };
};

const applyMirror = (url: string) => {
  githubMirrorInput.value = url;
  setData.value = { ...setData.value, githubMirror: url };
  message.success(t('settings.network.mirrorSelected'));
};

const formatSpeed = (bytesPerSec: number): string => {
  if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`;
  if (bytesPerSec >= 1024) return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  return `${bytesPerSec} B/s`;
};

const testMirrors = async () => {
  testing.value = true;
  mirrorResults.value = [];
  try {
    const results = await window.api.plugin.testMirrors();
    mirrorResults.value = results;
  } catch {
    message.error(t('settings.network.mirrorTestFailed'));
  } finally {
    testing.value = false;
  }
};

const handleProxyConfirm = async (proxyConfig: any) => {
  setData.value = {
    ...setData.value,
    proxyConfig: { enable: setData.value.proxyConfig?.enable || false, ...proxyConfig }
  };
  message.success(t('settings.network.messages.proxySuccess'));
};

const validateAndSaveRealIP = () => {
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!setData.value.realIP || ipRegex.test(setData.value.realIP)) {
    setData.value = { ...setData.value, realIP: setData.value.realIP, enableRealIP: true };
    if (setData.value.realIP) {
      message.success(t('settings.network.messages.realIPSuccess'));
    }
  } else {
    message.error(t('settings.network.messages.realIPError'));
    setData.value = { ...setData.value, realIP: '' };
  }
};

watch(
  () => setData.value.enableRealIP,
  (newVal) => {
    if (!newVal) {
      setData.value = { ...setData.value, realIP: '', enableRealIP: false };
    }
  }
);
</script>
