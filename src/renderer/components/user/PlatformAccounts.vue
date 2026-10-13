<template>
  <div class="platform-accounts">
    <div class="flex items-center justify-between mb-3">
      <h3 class="pa-title text-sm font-bold flex items-center gap-2">
        <i class="ri-global-line text-lg" style="color: var(--accent-color)"></i>
        {{ t('settings.playback.platforms.title') }}
      </h3>
      <button
        v-if="anyLoggedIn"
        @click="refreshStatus"
        class="pa-refresh text-xs"
      >
        <i class="ri-refresh-line"></i>
      </button>
    </div>

    <p class="pa-desc text-xs mb-3">
      {{ t('settings.playback.platforms.desc') }}
    </p>

    <!-- 平台列表 -->
    <div class="space-y-2">
      <div
        v-for="platform in platformList"
        :key="platform.key"
        class="pa-card flex items-center p-2.5"
        :class="{ 'is-logged-in': platform.loginStatus }"
      >
        <div
          class="flex items-center justify-center w-8 h-8 rounded-full mr-2.5 shrink-0"
          :style="{ backgroundColor: platform.color + '20', color: platform.color }"
        >
          <i :class="platform.icon" class="text-base"></i>
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="pa-name font-medium text-sm truncate">{{
              platform.name
            }}</span>
            <span
              v-if="platform.loginStatus"
              class="pa-badge pa-badge-success text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
            >
              {{ t('settings.playback.platforms.loggedIn') }}
            </span>
            <span
              v-else-if="platform.requiresLogin"
              class="pa-badge pa-badge-default text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
            >
              {{ t('settings.playback.platforms.notLoggedIn') }}
            </span>
            <span
              v-else
              class="pa-badge pa-badge-info text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
            >
              {{ t('settings.playback.platforms.noLoginRequired') }}
            </span>
          </div>
          <p class="pa-card-desc text-[10px] mt-0.5 truncate">
            {{ platform.desc }}
          </p>
        </div>

        <!-- 操作按钮 -->
        <div class="flex items-center gap-1.5 ml-2 shrink-0">
          <button
            v-if="platform.requiresLogin"
            @click="loginPlatform(platform.key)"
            :disabled="platform.loggingIn"
            class="pa-login-btn px-2.5 py-1 text-xs font-medium flex items-center gap-1"
            :class="{ 'is-active': platform.loginStatus }"
          >
            <i v-if="platform.loggingIn" class="ri-loader-4-line animate-spin"></i>
            <i
              v-else
              :class="platform.loginStatus ? 'ri-refresh-line' : 'ri-login-circle-line'"
            ></i>
            {{
              platform.loggingIn
                ? t('settings.playback.platforms.loggingIn')
                : platform.loginStatus
                  ? t('settings.playback.platforms.relogin')
                  : t('settings.playback.platforms.login')
            }}
          </button>
          <button
            v-if="platform.loginStatus && platform.requiresLogin"
            @click="logoutPlatform(platform.key)"
            class="pa-logout-btn px-2 py-1 text-xs"
          >
            <i class="ri-logout-circle-line"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- 手动输入 Cookie（可折叠） -->
    <div class="mt-3">
      <button
        @click="showManualInput = !showManualInput"
        class="pa-toggle text-xs flex items-center gap-1"
      >
        <i :class="showManualInput ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'"></i>
        {{ t('settings.playback.platforms.manualCookie') }}
      </button>

      <Transition name="expand">
        <div v-if="showManualInput" class="mt-2 space-y-2">
          <select
            v-model="manualCookiePlatform"
            class="pa-select w-full px-3 py-1.5 text-xs"
          >
            <option value="qq">QQ 音乐</option>
            <option value="migu">咪咕音乐</option>
            <option value="joox">JOOX</option>
          </select>
          <textarea
            v-model="manualCookieValue"
            :placeholder="t('settings.playback.platforms.cookiePlaceholder')"
            rows="2"
            class="pa-textarea w-full px-3 py-1.5 text-xs font-mono resize-none"
          ></textarea>
          <button
            @click="saveManualCookie"
            :disabled="!manualCookieValue.trim()"
            class="pa-save-btn px-3 py-1.5 text-white text-xs font-medium flex items-center gap-1"
          >
            <i class="ri-save-line"></i>
            {{ t('settings.playback.platforms.saveCookie') }}
          </button>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMessage } from 'naive-ui';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

interface PlatformAccount {
  key: string;
  name: string;
  icon: string;
  color: string;
  desc: string;
  requiresLogin: boolean;
  loginStatus: boolean;
  loggingIn: boolean;
}

const { t } = useI18n();
const message = useMessage();

const platformList = ref<PlatformAccount[]>([
  {
    key: 'qq',
    name: 'QQ 音乐',
    icon: 'ri-qq-fill',
    color: '#1296db',
    desc: t('settings.playback.platforms.qq.desc'),
    requiresLogin: true,
    loginStatus: false,
    loggingIn: false
  },
  {
    key: 'migu',
    name: '咪咕音乐',
    icon: 'ri-music-fill',
    color: '#ff6b35',
    desc: t('settings.playback.platforms.migu.desc'),
    requiresLogin: true,
    loginStatus: false,
    loggingIn: false
  },
  {
    key: 'joox',
    name: 'JOOX',
    icon: 'ri-global-line',
    color: '#42b883',
    desc: t('settings.playback.platforms.joox.desc'),
    requiresLogin: true,
    loginStatus: false,
    loggingIn: false
  },
  {
    key: 'kugou',
    name: '酷狗音乐',
    icon: 'ri-music-2-fill',
    color: '#2196f3',
    desc: t('settings.playback.platforms.kugou.desc'),
    requiresLogin: false,
    loginStatus: true,
    loggingIn: false
  },
  {
    key: 'kuwo',
    name: '酷我音乐',
    icon: 'ri-radio-fill',
    color: '#ff9800',
    desc: t('settings.playback.platforms.kuwo.desc'),
    requiresLogin: false,
    loginStatus: true,
    loggingIn: false
  }
]);

const showManualInput = ref(false);
const manualCookiePlatform = ref('qq');
const manualCookieValue = ref('');

const anyLoggedIn = computed(() =>
  platformList.value.some((p) => p.requiresLogin && p.loginStatus)
);

// 刷新平台登录状态
const refreshStatus = async () => {
  try {
    const status = await window.api.getPlatformLoginStatus();
    platformList.value.forEach((p) => {
      if (p.requiresLogin) {
        p.loginStatus = Boolean(status[p.key]);
      }
    });
  } catch (error) {
    console.error('获取平台登录状态失败:', error);
  }
};

// 登录平台
const loginPlatform = async (platformKey: string) => {
  const platform = platformList.value.find((p) => p.key === platformKey);
  if (!platform) return;

  platform.loggingIn = true;
  try {
    const result = await window.api.openPlatformLogin(platformKey);
    if (!result) {
      message.warning(t('settings.playback.platforms.loginWindowFailed'));
    }
  } catch (error: any) {
    message.error(`${t('common.error')}：${error.message}`);
  } finally {
    platform.loggingIn = false;
  }
};

// 退出登录
const logoutPlatform = async (platformKey: string) => {
  try {
    await window.api.setPlatformCookie(platformKey, '');
    const platform = platformList.value.find((p) => p.key === platformKey);
    if (platform) {
      platform.loginStatus = false;
    }
    message.success(t('settings.playback.platforms.logoutSuccess'));
  } catch (error: any) {
    message.error(`${t('common.error')}：${error.message}`);
  }
};

// 保存手动输入的 Cookie
const saveManualCookie = async () => {
  const platform = manualCookiePlatform.value;
  const cookie = manualCookieValue.value.trim();
  if (!cookie) return;

  try {
    await window.api.setPlatformCookie(platform, cookie);
    const p = platformList.value.find((item) => item.key === platform);
    if (p) {
      p.loginStatus = true;
    }
    message.success(t('settings.playback.platforms.cookieSaved'));
    manualCookieValue.value = '';
    showManualInput.value = false;
  } catch (error: any) {
    message.error(`${t('common.error')}：${error.message}`);
  }
};

// 监听平台登录 Cookie 到达
window.api?.onPlatformLoginCookie?.((platform: string, _cookie: string) => {
  const p = platformList.value.find((item) => item.key === platform);
  if (p) {
    p.loginStatus = true;
    p.loggingIn = false;
  }
  message.success(
    t('settings.playback.platforms.loginSuccess', { platform: p?.name || platform })
  );
});

onMounted(() => {
  refreshStatus();
});
</script>

<style scoped>
.platform-accounts {
  --pa-success-bg: rgba(34, 197, 94, 0.1);
  --pa-success-border: rgba(34, 197, 94, 0.2);
  --pa-success-color: #16a34a;
  --pa-info-bg: rgba(59, 130, 246, 0.1);
  --pa-info-color: #2563eb;
}

.pa-title {
  color: var(--d-text-primary);
}

.pa-refresh {
  color: var(--d-text-muted);
  transition: var(--d-transition-colors);
  cursor: pointer;
  background: none;
  border: none;
}

.pa-refresh:hover {
  color: var(--accent-color);
}

.pa-desc {
  color: var(--d-text-secondary);
}

.pa-card {
  border-radius: var(--d-radius-lg);
  border: 1px solid var(--d-border-light);
  background: var(--d-surface-alt);
  transition: var(--d-transition-colors);
}

.pa-card.is-logged-in {
  background: var(--pa-success-bg);
  border-color: var(--pa-success-border);
}

.pa-name {
  color: var(--d-text-primary);
}

.pa-card-desc {
  color: var(--d-text-secondary);
}

.pa-badge {
  font-weight: var(--d-font-medium);
}

.pa-badge-success {
  background: var(--pa-success-bg);
  color: var(--pa-success-color);
}

.pa-badge-default {
  background: var(--d-surface-active);
  color: var(--d-text-secondary);
}

.pa-badge-info {
  background: var(--pa-info-bg);
  color: var(--pa-info-color);
}

.pa-login-btn {
  border-radius: var(--d-radius-sm);
  border: none;
  cursor: pointer;
  background: var(--accent-color);
  color: #fff;
  transition: var(--d-transition-colors);
}

.pa-login-btn:hover {
  filter: brightness(1.1);
}

.pa-login-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pa-login-btn.is-active {
  background: var(--d-surface-active);
  color: var(--d-text-secondary);
}

.pa-login-btn.is-active:hover {
  background: var(--d-border-strong);
}

.pa-logout-btn {
  color: #ef4444;
  background: none;
  border: none;
  border-radius: var(--d-radius-sm);
  cursor: pointer;
  transition: var(--d-transition-colors);
}

.pa-logout-btn:hover {
  background: rgba(239, 68, 68, 0.1);
}

.pa-toggle {
  color: var(--d-text-muted);
  transition: var(--d-transition-colors);
  cursor: pointer;
  background: none;
  border: none;
}

.pa-toggle:hover {
  color: var(--accent-color);
}

.pa-select,
.pa-textarea {
  border: 1px solid var(--d-border);
  background: var(--d-surface-alt);
  color: var(--d-text-primary);
  border-radius: var(--d-radius-lg);
  outline: none;
  transition: border-color var(--d-duration-fast) var(--d-ease-out);
}

.pa-select:focus,
.pa-textarea:focus {
  border-color: var(--accent-color);
}

.pa-save-btn {
  border-radius: var(--d-radius-lg);
  background: var(--accent-color);
  border: none;
  cursor: pointer;
  transition: var(--d-transition-colors);
}

.pa-save-btn:hover {
  filter: brightness(1.1);
}

.pa-save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.expand-enter-active,
.expand-leave-active {
  transition: all var(--d-duration-normal) var(--d-ease-out);
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 300px;
}
</style>
