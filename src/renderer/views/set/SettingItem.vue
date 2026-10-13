<template>
  <div
    class="setting-item flex items-start justify-between p-4 transition-colors bg-transparent"
    :class="[
      // 移动端垂直布局
      { 'max-md:flex-col max-md:items-start max-md:gap-3': !inline },
      // 可点击样式
      {
        'cursor-pointer': clickable
      },
      customClass
    ]"
    @click="handleClick"
  >
    <!-- 左侧：标题和描述 -->
    <div class="flex-1 min-w-0 mr-4">
      <div class="text-base font-medium mb-0.5 setting-item-title">
        <slot name="title">{{ title }}</slot>
      </div>
      <div
        v-if="description || $slots.description"
        class="text-sm leading-normal setting-item-desc"
      >
        <slot name="description">{{ description }}</slot>
      </div>
      <!-- 额外内容插槽 -->
      <div v-if="$slots.extra" class="mt-2">
        <slot name="extra"></slot>
      </div>
    </div>

    <!-- 右侧：操作区 -->
    <div
      v-if="$slots.action || $slots.default"
      class="flex items-center gap-2 flex-shrink-0"
      :class="{ 'max-md:w-full max-md:justify-end': !inline }"
    >
      <slot name="action">
        <slot></slot>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({
  name: 'SettingItem'
});

interface Props {
  /** 设置项标题 */
  title?: string;
  /** 设置项描述 */
  description?: string;
  /** 是否可点击 */
  clickable?: boolean;
  /** 是否保持水平布局（不响应移动端） */
  inline?: boolean;
  /** 自定义类名 */
  customClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  description: '',
  clickable: false,
  inline: false,
  customClass: ''
});

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const handleClick = (event: MouseEvent) => {
  if (props.clickable) {
    emit('click', event);
  }
};
</script>

<style scoped>
.setting-item {
  color: var(--d-text-primary);
  border-bottom: 1px solid var(--d-border-light);
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item:hover {
  background: var(--d-surface-hover);
}

.setting-item:active {
  background: var(--d-surface-active);
}

.setting-item-title {
  color: var(--d-text-primary);
}

.setting-item-desc {
  color: var(--d-text-secondary);
}
</style>
