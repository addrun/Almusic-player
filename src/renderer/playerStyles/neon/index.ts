import NeonPlayer from '@/components/lyric/NeonPlayer.vue';

import { registerStyle } from '../registry';
import settings from './settings.json';

export default registerStyle({
  key: 'neon',
  label: '陈旧',
  component: NeonPlayer,
  isFullScreen: true,
  theme: 'dark',
  showStyleSwitch: false,
  settings
});
