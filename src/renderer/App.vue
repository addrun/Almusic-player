<template>
  <div class="app-container h-full w-full" :class="{ mobile: isMobile, noElectron: !isElectron }">
    <n-config-provider
      :theme="theme === 'dark' ? darkTheme : lightTheme"
      :theme-overrides="themeOverrides"
    >
      <n-dialog-provider>
        <n-message-provider>
          <router-view></router-view>
          <traffic-warning-drawer v-if="!isElectron"></traffic-warning-drawer>
          <disclaimer-modal></disclaimer-modal>
        </n-message-provider>
      </n-dialog-provider>
    </n-config-provider>
    <splash-screen v-if="!isLyricWindow && showSplash" @finish="showSplash = false" />
  </div>
</template>

<script setup lang="ts">
import { cloneDeep } from 'lodash';
import { darkTheme, lightTheme } from 'naive-ui';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import DisclaimerModal from '@/components/common/DisclaimerModal.vue';
import SplashScreen from '@/components/splash/SplashScreen.vue';
import TrafficWarningDrawer from '@/components/TrafficWarningDrawer.vue';
import { setSmartAudioInstance, useSmartAudio } from '@/composables/useSmartAudio';
import { registerBuiltinFeatures } from '@/features/register';
import { usePlayerStore } from '@/store/modules/player';
import { usePlayerCoreStore } from '@/store/modules/playerCore';
import { useSettingsStore } from '@/store/modules/settings';
import { useUserStore } from '@/store/modules/user';
import { isElectron, isLyricWindow } from '@/utils';
import { checkLoginStatus } from '@/utils/auth';

import { initAudioListeners, initMusicHook } from './hooks/MusicHook';
import { initCoverColor, useCoverColor } from './hooks/useCoverColor';
import { audioService } from './services/audioService';
import { initLxMusicRunner } from './services/LxMusicSourceRunner';
import { useStyleEngineStore } from './store/modules/styleEngine';
import { isMobile } from './utils';
import { useAppShortcuts } from './utils/appShortcuts';

const showSplash = ref(true);
const { locale } = useI18n();
const settingsStore = useSettingsStore();
const playerStore = usePlayerStore();
const playerCoreStore = usePlayerCoreStore();
const userStore = useUserStore();
const router = useRouter();
const { primaryColor } = useCoverColor();
const styleEngine = useStyleEngineStore();

// naive-ui 主题覆盖：组件强调色跟随封面取色
const themeOverrides = computed(() => {
  const pc = primaryColor.value || '#888888';
  return {
    common: {
      primaryColor: pc,
      primaryColorHover: pc,
      primaryColorPressed: pc,
      primaryColorSuppl: pc,
      infoColor: pc,
      successColor: pc,
      warningColor: pc,
      errorColor: '#e53e3e'
    },
    Slider: {
      fillColor: pc,
      fillColorHover: pc,
      handleColor: pc,
      dotColor: pc,
      dotColorActive: pc
    },
    Switch: {
      railColorActive: pc,
      loadingColor: pc,
      boxShadowFocus: `0 0 0 2px ${pc}33`
    },
    Button: {
      color: pc,
      colorHover: pc,
      colorFocus: pc,
      textColor: '#fff',
      textColorHover: '#fff',
      textColorFocus: '#fff'
    },
    Radio: {
      colorActive: 'transparent',
      dotColorActive: pc,
      boxShadowActive: `inset 0 0 0 1px ${pc}`,
      boxShadowFocus: `inset 0 0 0 1px ${pc}`,
      boxShadowHover: `inset 0 0 0 1px ${pc}`
    },
    RadioButton: {
      colorActive: pc,
      textColorActive: '#fff'
    },
    Tag: {
      colorSuccess: pc,
      textColorSuccess: '#fff',
      borderSuccess: pc
    },
    Input: {
      color: 'transparent',
      colorFocus: 'transparent',
      border: `1px solid #d9d9d9`,
      borderHover: `1px solid ${pc}`,
      borderFocus: `1px solid ${pc}`,
      borderDisabled: '1px solid #e0e0e0',
      boxShadowFocus: `0 0 0 1px ${pc}`,
      textColor: '#333',
      placeholderColor: '#999'
    },
    Dropdown: {
      optionColorActive: `${pc}15`,
      optionColorActiveHover: `${pc}20`,
      optionTextColorActive: pc
    },
    Menu: {
      colorActive: pc,
      itemTextColorActive: pc,
      itemIconColorActive: pc
    },
    Select: {
      peers: {
        InternalSelectMenu: {
          optionColorActive: `${pc}15`,
          optionColorActiveHover: `${pc}20`,
          optionTextColorActive: pc
        },
        Selection: {
          border: `1px solid #d9d9d9`,
          borderHover: `1px solid ${pc}`,
          borderActive: `1px solid ${pc}`,
          borderFocus: `1px solid ${pc}`,
          boxShadowFocus: `0 0 0 1px ${pc}`,
          boxShadowActive: `0 0 0 1px ${pc}`
        }
      }
    },
    Slider: {
      fillColor: pc,
      fillColorHover: pc,
      handleColor: pc,
      dotColor: pc,
      dotColorActive: pc,
      dotColorModal: pc,
      dotColorPopover: pc,
      indicatorColor: pc,
      indicatorTextColor: '#fff'
    },
    Checkbox: {
      colorChecked: pc,
      borderChecked: pc,
      boxShadowChecked: `inset 0 0 0 1px ${pc}`
    },
    Spin: {
      color: pc
    }
  };
});

// 监听语言变化
watch(
  () => settingsStore.setData.language,
  (newLanguage) => {
    if (newLanguage && newLanguage !== locale.value) {
      locale.value = newLanguage;
    }
  },
  { immediate: true }
);

const theme = computed(() => {
  return settingsStore.theme;
});

// 监听字体变化并应用
watch(
  () => [settingsStore.setData.fontFamily, settingsStore.setData.fontScope],
  ([newFont, fontScope]) => {
    const appElement = document.body;
    if (newFont && fontScope === 'global') {
      appElement.style.fontFamily = newFont;
    } else {
      appElement.style.fontFamily = '';
    }
  }
);

const handleSetLanguage = (value: string) => {
  if (value) {
    locale.value = value;
  }
};

// 挂载智能混音引擎：触发 AudioScheduler / BPM Worker / 硬件评估初始化，
// 并注册为全局单例供 audioService.crossfadeToNext 在过渡时调用三级策略。
const smartAudio = useSmartAudio();
let smartAudioRegistered = false;
if (!isLyricWindow.value) {
  setSmartAudioInstance(smartAudio);
  smartAudioRegistered = true;
}

if (!isLyricWindow.value) {
  settingsStore.initializeSettings();
  settingsStore.initializeTheme();
  settingsStore.initializeSystemFonts();

  // 初始化登录状态 - 从 localStorage 恢复用户信息和登录类型
  const loginInfo = checkLoginStatus();
  if (loginInfo.isLoggedIn) {
    if (loginInfo.user && !userStore.user) {
      userStore.setUser(loginInfo.user);
    }
    if (loginInfo.loginType && !userStore.loginType) {
      userStore.setLoginType(loginInfo.loginType);
    }
    // 异步加载歌单、专辑、收藏列表（不阻塞渲染）
    userStore.initializeUser().catch((err) => {
      console.error('[App] 初始化用户数据失败:', err);
    });
  }
}

handleSetLanguage(settingsStore.setData.language);

// 监听迷你模式状态
if (isElectron) {
  window.api.onLanguageChanged(handleSetLanguage);
  window.electron.ipcRenderer.on('mini-mode', (_, value) => {
    settingsStore.setMiniMode(value);
    if (value) {
      // 存储当前路由
      localStorage.setItem('currentRoute', router.currentRoute.value.path);
      router.push('/mini');
    } else {
      // 恢复当前路由
      const currentRoute = localStorage.getItem('currentRoute');
      if (currentRoute) {
        router.push(currentRoute);
        localStorage.removeItem('currentRoute');
      } else {
        router.push('/');
      }
    }
  });
}

// 使用应用内快捷键
useAppShortcuts();

let focusTrapObserver: MutationObserver | null = null;

onMounted(async () => {
  playerStore.setIsPlay(false);

  // 修复 vueuc FocusTrap 哨兵元素的 aria-hidden 警告
  focusTrapObserver = new MutationObserver(() => {
    document.querySelectorAll('[aria-hidden="true"][tabindex="0"]').forEach((el) => {
      el.setAttribute('tabindex', '-1');
    });
  });
  focusTrapObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['tabindex', 'aria-hidden']
  });
  document.querySelectorAll('[aria-hidden="true"][tabindex="0"]').forEach((el) => {
    el.setAttribute('tabindex', '-1');
  });

  // 注册内置功能
  registerBuiltinFeatures();

  // 加载已安装插件并激活播放器样式
  const { pluginManager } = await import('@/services/pluginManager');
  await pluginManager.loadInstalled();

  if (isLyricWindow.value) {
    return;
  }

  // 检查网络状态，离线时自动跳转到本地音乐页面
  if (!navigator.onLine) {
    router.push('/local-music');
  }

  // 监听网络状态变化，断网时跳转到本地音乐页面
  window.addEventListener('offline', () => {
    router.push('/local-music');
  });

  // 初始化 MusicHook，注入 playerStore
  initMusicHook(playerStore);
  // 初始化封面取色（替换全局绿色主色）
  initCoverColor();
  // 初始化播放状态
  await playerStore.initializePlayState();

  // 初始化音频设备变化监听器
  playerCoreStore.initAudioDeviceListener();

  // 初始化落雪音源（如果有激活的音源）
  const activeLxApiId = settingsStore.setData?.activeLxMusicApiId;
  if (activeLxApiId) {
    const lxMusicScripts = settingsStore.setData?.lxMusicScripts || [];
    const activeScript = lxMusicScripts.find((script: any) => script.id === activeLxApiId);
    if (activeScript && activeScript.script) {
      try {
        await initLxMusicRunner(activeScript.script);
      } catch (error) {
        console.error('[App] 初始化落雪音源失败:', error);
      }
    }
  }

  // 如果有正在播放的音乐，则初始化音频监听器
  if (playerStore.playMusic && playerStore.playMusic.id) {
    // 使用 nextTick 确保 DOM 更新后再初始化
    await nextTick();
    initAudioListeners();
    if (isElectron) {
      window.api.sendSong(cloneDeep(playerStore.playMusic));
    }
  }

  audioService.releaseOperationLock();

  // 初始化样式引擎（启动鼓点/高潮检测器）
  styleEngine.init();
});

onBeforeUnmount(() => {
  styleEngine.dispose();
  focusTrapObserver?.disconnect();
  if (smartAudioRegistered) {
    smartAudio.dispose();
  }
});
</script>

<style lang="scss" scoped>
.app-container {
  user-select: none;
}

.mobile {
  .text-base {
    font-size: 14px !important;
  }
}

.html:has(.mobile) {
  font-size: 14px;
}
</style>
