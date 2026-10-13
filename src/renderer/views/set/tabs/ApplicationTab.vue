<template>
  <setting-section v-if="isElectron" :title="t('settings.sections.application')">
    <setting-item
      :title="t('settings.application.closeAction')"
      :description="t('settings.application.closeActionDesc')"
    >
      <s-select
        v-model="setData.closeAction"
        :options="closeActionOptions"
        width="w-40 max-md:w-full"
      />
    </setting-item>

    <setting-item
      :title="t('settings.application.shortcut')"
      :description="t('settings.application.shortcutDesc')"
    >
      <s-btn @click="showShortcutModal = true">{{ t('common.configure') }}</s-btn>
    </setting-item>

    <setting-item title="桌面歌词解锁快捷键" description="歌词窗口锁定后，按下此快捷键解锁">
      <button class="shortcut-recorder" :class="{ recording: isRecording }" @click="startRecording">
        <template v-if="isRecording">按快捷键...</template>
        <template v-else>
          <kbd>{{ displayShortcut }}</kbd>
        </template>
      </button>
    </setting-item>

    <setting-item v-if="isElectron" :title="t('settings.application.download')">
      <template #description>
        <n-switch v-model:value="setData.alwaysShowDownloadButton" class="mr-2">
          <template #checked>{{ t('common.show') }}</template>
          <template #unchecked>{{ t('common.hide') }}</template>
        </n-switch>
        {{ t('settings.application.downloadDesc') }}
      </template>
      <s-btn @click="router.push('/downloads')">
        {{ t('settings.application.download') }}
      </s-btn>
    </setting-item>

    <setting-item :title="t('settings.application.unlimitedDownload')">
      <template #description>
        <n-switch v-model:value="setData.unlimitedDownload" class="mr-2">
          <template #checked>{{ t('common.on') }}</template>
          <template #unchecked>{{ t('common.off') }}</template>
        </n-switch>
        {{ t('settings.application.unlimitedDownloadDesc') }}
      </template>
    </setting-item>

    <setting-item :title="t('settings.application.downloadPath')">
      <template #description>
        <span class="break-all">{{
          setData.downloadPath || t('settings.application.downloadPathDesc')
        }}</span>
      </template>
      <template #action>
        <div class="flex items-center gap-2">
          <s-btn @click="openDownloadPath">{{ t('common.open') }}</s-btn>
          <s-btn @click="selectDownloadPath">{{ t('common.modify') }}</s-btn>
        </div>
      </template>
    </setting-item>

    <setting-item
      :title="t('settings.application.remoteControl')"
      :description="t('settings.application.remoteControlDesc')"
    >
      <s-btn @click="showRemoteControlModal = true">{{ t('common.configure') }}</s-btn>
    </setting-item>

    <shortcut-settings v-model:show="showShortcutModal" @change="handleShortcutsChange" />
    <remote-control-setting v-model:visible="showRemoteControlModal" />
  </setting-section>
</template>

<script setup lang="ts">
import { computed, inject, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import RemoteControlSetting from '@/components/settings/ServerSetting.vue';
import ShortcutSettings from '@/components/settings/ShortcutSettings.vue';
import { isElectron } from '@/utils';
import { openDirectory, selectDirectory } from '@/utils/fileOperation';
import { keyboardEventToAccelerator } from '@/utils/shortcutKeyboard';

import { SETTINGS_DATA_KEY, SETTINGS_MESSAGE_KEY } from '../keys';
import SBtn from '../SBtn.vue';
import SettingItem from '../SettingItem.vue';
import SettingSection from '../SettingSection.vue';
import SSelect from '../SSelect.vue';

const { t } = useI18n();
const router = useRouter();
const setData = inject(SETTINGS_DATA_KEY)!;
const message = inject(SETTINGS_MESSAGE_KEY)!;

const showShortcutModal = ref(false);
const showRemoteControlModal = ref(false);

const isRecording = ref(false);
const shortcutBadge = ref('');

const closeActionOptions = computed(() => [
  { label: t('settings.application.closeOptions.ask'), value: 'ask' },
  { label: t('settings.application.closeOptions.minimize'), value: 'minimize' },
  { label: t('settings.application.closeOptions.close'), value: 'close' }
]);

const isMac = navigator.platform?.includes('Mac') ?? false;

const displayShortcut = computed(() => {
  const raw = shortcutBadge.value || setData.value.lyricUnlockShortcut || 'CommandOrControl+L';
  return raw
    .split('+')
    .map((seg: string) => {
      const s = seg.toLowerCase();
      if (s === 'commandorcontrol' || s === 'ctrl' || s === 'cmd' || s === 'meta') {
        return isMac ? 'Cmd' : 'Ctrl';
      }
      if (s === 'alt' || s === 'option') return isMac ? 'Option' : 'Alt';
      if (s === 'shift') return 'Shift';
      return seg;
    })
    .join('+');
});

function formatAccelerator(raw: string): string {
  const parts = raw.split('+');
  const ordered: string[] = [];
  for (const m of ['CommandOrControl', 'Alt', 'Shift']) {
    if (parts.some((p) => p.toLowerCase() === m.toLowerCase())) ordered.push(m);
  }
  const key = parts.find((p) => !/^(commandorcontrol|ctrl|cmd|meta|alt|option|shift)$/i.test(p));
  if (key) ordered.push(key);
  return ordered.join('+');
}

function saveShortcut(accelerator: string) {
  const formatted = formatAccelerator(accelerator);
  shortcutBadge.value = formatted;
  setData.value = { ...setData.value, lyricUnlockShortcut: formatted };
  if (isElectron) {
    window.electron.ipcRenderer.send('lyric-update-shortcut', formatted);
  }
}

const recordHandler = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    isRecording.value = false;
    document.removeEventListener('keydown', recordHandler);
    return;
  }

  const accel = keyboardEventToAccelerator(e);
  if (accel) {
    e.preventDefault();
    e.stopPropagation();
    saveShortcut(accel);
    isRecording.value = false;
    document.removeEventListener('keydown', recordHandler);
  }
};

function startRecording() {
  isRecording.value = true;
  document.addEventListener('keydown', recordHandler);
}

onUnmounted(() => {
  document.removeEventListener('keydown', recordHandler);
});

const selectDownloadPath = async () => {
  const path = await selectDirectory(message);
  if (path) {
    setData.value = { ...setData.value, downloadPath: path };
  }
};

const openDownloadPath = () => {
  openDirectory(setData.value.downloadPath, message);
};

const handleShortcutsChange = (shortcuts: any) => {
};
</script>

<style scoped>
.shortcut-recorder {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s ease;
  min-width: 100px;
  justify-content: center;
}

.shortcut-recorder:hover {
  border-color: var(--accent-color);
  background: rgba(255, 255, 255, 0.05);
}

.shortcut-recorder.recording {
  border-color: var(--accent-color);
  background: rgba(255, 255, 255, 0.08);
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.shortcut-recorder kbd {
  font-family: inherit;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  font-size: 12px;
}
</style>
