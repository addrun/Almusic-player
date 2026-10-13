import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { SongResult } from '@/types/music';

export const useSearchStore = defineStore('search', () => {
  const searchValue = ref('');
  const searchType = ref(1);
  const kugouBindingTarget = ref<SongResult | null>(null);
  const kugouBindingKeyword = ref('');

  const setKugouBindingTarget = (song: SongResult, keyword: string) => {
    kugouBindingTarget.value = song;
    kugouBindingKeyword.value = keyword;
  };

  const setSearchValue = (value: string) => {
    searchValue.value = value;
  };

  const setSearchType = (type: number) => {
    searchType.value = type;
  };

  return {
    searchValue,
    searchType,
    kugouBindingTarget,
    kugouBindingKeyword,
    setKugouBindingTarget,
    setSearchValue,
    setSearchType
  };
});
