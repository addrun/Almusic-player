<template>
  <div
    class="setting-nav w-32 h-full flex-shrink-0"
  >
    <div
      v-for="section in sections"
      :key="section.id"
      class="setting-nav-item"
      :class="{ 'is-active': currentSection === section.id }"
      @click="handleClick(section.id)"
    >
      {{ section.title }}
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({
  name: 'SettingNav'
});

export interface NavSection {
  id: string;
  title: string;
}

interface Props {
  /** 导航项列表*/
  sections: NavSection[];
  /** 褰撳墠婵€活的分组 ID */
  currentSection: string;
}

defineProps<Props>();

const emit = defineEmits<{
  navigate: [sectionId: string];
}>();

const handleClick = (sectionId: string) => {
  emit('navigate', sectionId);
};
</script>

<style scoped>
.setting-nav {
  border-right: 1px solid var(--d-border);
  background: var(--d-surface);
}

.setting-nav-item {
  padding: var(--d-space-2) var(--d-space-4);
  cursor: pointer;
  font-size: var(--d-text-sm);
  color: var(--d-text-secondary);
  border-left: 2px solid transparent;
  transition: var(--d-transition-colors);
}

.setting-nav-item:hover {
  color: var(--accent-color);
  background: var(--d-surface-hover);
}

.setting-nav-item.is-active {
  color: var(--accent-color);
  background: var(--d-surface-hover);
  border-left-color: var(--accent-color);
  font-weight: var(--d-font-medium);
}
</style>
