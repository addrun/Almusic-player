<template>
  <div
    class="splash-screen"
    :class="{ 'is-leaving': leaving, 'is-still': prefersStill || settingsStore.setData?.noAnimate }"
    :data-theme="settingsStore.theme"
    @transitionend="onTransitionEnd"
  >
    <div class="splash-frame" aria-hidden="true"></div>

    <main class="splash-content" role="status" aria-label="Almusic 正在启动">
      <svg
        class="splash-mark"
        width="184"
        height="160"
        viewBox="0 0 184 160"
        fill="none"
        aria-hidden="true"
      >
        <g class="splash-record" stroke="currentColor">
          <circle cx="100" cy="77" r="48" stroke-width="1" opacity="0.28" />
          <circle cx="100" cy="77" r="39" stroke-width="0.75" opacity="0.17" />
          <circle cx="100" cy="77" r="31" stroke-width="0.75" opacity="0.12" />
          <circle cx="100" cy="77" r="18" stroke-width="1" opacity="0.48" />
          <circle cx="100" cy="77" r="3" fill="currentColor" stroke="none" opacity="0.7" />
          <path
            d="M112 38A41 41 0 0 1 139 64"
            stroke-width="1.5"
            stroke-linecap="round"
            opacity="0.52"
          />
        </g>
        <g class="splash-wind" stroke="currentColor" stroke-linecap="round">
          <path
            class="splash-wind-line splash-wind-first"
            d="M20 89H66C78 89 83 84 89 73C95 62 100 57 113 57H165"
            pathLength="1"
            stroke-width="1.3"
            opacity="0.86"
          />
          <path
            class="splash-wind-line splash-wind-second"
            d="M28 101H69C87 101 91 91 97 81C102 72 108 69 121 69H154"
            pathLength="1"
            stroke-width="1"
            opacity="0.5"
          />
          <path
            class="splash-wind-line splash-wind-third"
            d="M43 113H73C89 113 99 108 105 98"
            pathLength="1"
            stroke-width="0.85"
            opacity="0.32"
          />
        </g>
        <path d="M72 142H112" stroke="currentColor" stroke-width="0.8" opacity="0.2" />
      </svg>

      <p class="splash-wordmark">Almusic</p>
      <h1 class="splash-title">Almusic</h1>
      <p class="splash-caption">让音乐，随风而来。</p>
    </main>

    <footer class="splash-footer">
      <span class="splash-credit">基于 AlgerMusicPlayer · cang-dot</span>
      <button type="button" class="splash-skip" aria-label="跳过开屏动画" @click="leave">
        跳过<span aria-hidden="true">↗</span>
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { useSettingsStore } from '@/store/modules/settings';

const emit = defineEmits<{ finish: [] }>();
const settingsStore = useSettingsStore();
const leaving = ref(false);
const prefersStill = ref(false);
let finished = false;
let disposed = false;
let holdTimer: ReturnType<typeof setTimeout> | undefined;
let finishTimer: ReturnType<typeof setTimeout> | undefined;
let motionQuery: MediaQueryList | undefined;

function clearTimers(): void {
  clearTimeout(holdTimer);
  clearTimeout(finishTimer);
  holdTimer = undefined;
  finishTimer = undefined;
}

function finish(): void {
  if (finished || disposed) return;
  finished = true;
  clearTimers();
  emit('finish');
}

function leave(): void {
  if (finished || disposed || leaving.value) return;
  clearTimers();
  if (prefersStill.value || settingsStore.setData?.noAnimate) {
    finish();
    return;
  }
  leaving.value = true;
  // A timer also finishes when CSS transitions are suppressed or their event is lost.
  finishTimer = setTimeout(finish, 380);
}

function onTransitionEnd(event: TransitionEvent): void {
  if (leaving.value && event.target === event.currentTarget && event.propertyName === 'opacity') {
    finish();
  }
}

function onMotionChange(event: MediaQueryListEvent): void {
  prefersStill.value = event.matches;
  if (event.matches) finish();
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') leave();
}

watch(
  () => settingsStore.setData?.noAnimate,
  (disabled) => {
    if (disabled) finish();
  }
);

onMounted(() => {
  // The bounded fallback is armed before querying optional browser capabilities.
  finishTimer = setTimeout(finish, 1660);
  try {
    motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    prefersStill.value = !!motionQuery?.matches;
    if (prefersStill.value || settingsStore.setData?.noAnimate) {
      finish();
      return;
    }
    motionQuery?.addEventListener('change', onMotionChange);
    window.addEventListener('keydown', onKeydown);
    holdTimer = setTimeout(leave, 1200);
  } catch {
    // Startup must remain usable if preference detection or an event API fails.
    finish();
  }
});

onBeforeUnmount(() => {
  disposed = true;
  clearTimers();
  motionQuery?.removeEventListener?.('change', onMotionChange);
  window.removeEventListener('keydown', onKeydown);
});
</script>

<style scoped>
.splash-screen {
  --splash-paper: #f5f3ec;
  --splash-ink: #353a31;
  --splash-muted: #87897d;
  --splash-olive: #737d61;
  --splash-line: rgba(83, 91, 71, 0.13);

  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  overflow: hidden;
  isolation: isolate;
  background: var(--splash-paper);
  color: var(--splash-ink);
  opacity: 1;
  transition: opacity 340ms ease;
}

.splash-screen[data-theme='dark'] {
  --splash-paper: #1b1e19;
  --splash-ink: #e4e6db;
  --splash-muted: #8d9484;
  --splash-olive: #a8b293;
  --splash-line: rgba(183, 193, 164, 0.12);
}

.splash-frame {
  position: absolute;
  inset: 24px;
  border: 1px solid var(--splash-line);
  pointer-events: none;
}

.splash-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px 80px;
  text-align: center;
  animation: splash-arrive 680ms cubic-bezier(0.2, 0.65, 0.3, 1) both;
}

.splash-mark {
  width: 184px;
  height: 160px;
  margin-bottom: 24px;
  color: var(--splash-olive);
}

.splash-record {
  transform-origin: 100px 77px;
  animation: splash-record-settle 1250ms cubic-bezier(0.2, 0.65, 0.3, 1) both;
}

.splash-wind-line {
  stroke-dasharray: 1;
  stroke-dashoffset: 0;
  animation: splash-wind-arrive 950ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
}

.splash-wind-second {
  animation-delay: 90ms;
}

.splash-wind-third {
  animation-delay: 160ms;
}

.splash-wordmark {
  margin: 0 0 14px;
  padding-left: 0.32em;
  color: var(--splash-olive);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.5;
  letter-spacing: 0.32em;
  text-transform: uppercase;
}

.splash-title {
  margin: 0;
  padding-left: 0.15em;
  font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', SimSun, serif;
  font-size: clamp(26px, 3vw, 32px);
  font-weight: 400;
  line-height: 1.5;
  letter-spacing: 0.15em;
}

.splash-caption {
  margin: 17px 0 0;
  color: var(--splash-muted);
  font-size: 11px;
  font-weight: 400;
  line-height: 1.8;
  letter-spacing: 0.13em;
}

.splash-footer {
  position: absolute;
  right: 48px;
  bottom: 42px;
  left: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  color: var(--splash-muted);
  animation: splash-arrive 680ms ease both;
}

.splash-credit {
  font-size: 10px;
  line-height: 1.5;
  letter-spacing: 0.025em;
}

.splash-skip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-width: 64px;
  min-height: 36px;
  margin: 0;
  padding: 6px 2px;
  border: 0;
  border-radius: 2px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 11px;
  letter-spacing: 0.06em;
  cursor: pointer;
}

.splash-skip:hover,
.splash-skip:focus-visible {
  color: var(--splash-ink);
}

.splash-skip:focus-visible {
  outline: 1px solid var(--splash-olive);
  outline-offset: 5px;
}

.splash-screen.is-leaving {
  opacity: 0;
}

.splash-screen.is-still,
.splash-screen.is-still * {
  animation: none !important;
  transition: none !important;
}

@keyframes splash-arrive {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes splash-record-settle {
  from {
    transform: rotate(-16deg);
  }
  to {
    transform: rotate(0);
  }
}

@keyframes splash-wind-arrive {
  from {
    stroke-dashoffset: 1;
  }
  to {
    stroke-dashoffset: 0;
  }
}

@media (max-width: 520px) {
  .splash-frame {
    inset: 16px;
  }

  .splash-footer {
    right: 30px;
    bottom: 26px;
    left: 30px;
  }

  .splash-credit {
    max-width: 190px;
    font-size: 9px;
  }
}

@media (max-height: 440px) {
  .splash-mark {
    width: 138px;
    height: 120px;
    margin-bottom: 10px;
  }

  .splash-content {
    padding: 30px 24px 70px;
  }

  .splash-wordmark {
    margin-bottom: 7px;
  }

  .splash-caption {
    margin-top: 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .splash-screen,
  .splash-screen * {
    animation: none !important;
    transition: none !important;
  }
}
</style>
