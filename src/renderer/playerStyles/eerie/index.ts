import EeriePlayer from '@/components/lyric/EeriePlayer.vue';

import { registerStyle } from '../registry';
import settings from './settings.json';

export default registerStyle({
  key: 'eerie',
  label: '诡谲',
  component: EeriePlayer,
  isFullScreen: true,
  theme: 'dark',
  showStyleSwitch: false,
  settings
});
