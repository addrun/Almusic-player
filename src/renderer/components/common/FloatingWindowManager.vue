<template>
  <floating-panel v-if="windowStore.activePath" />
</template>

<script setup lang="ts">
import FloatingPanel from './FloatingPanel.vue';
import { useWindowStore } from '@/store/modules/windowStore';

const windowStore = useWindowStore();
</script>
