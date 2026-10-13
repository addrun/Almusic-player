import MusicFull from '@/components/lyric/MusicFull.vue';

import { registerStyle } from '../registry';
import settings from './settings.json';

export default registerStyle({
  key: 'default',
  label: '默认',
  component: MusicFull,
  isFullScreen: false,
  theme: 'light',
  showStyleSwitch: false,
  settings
});
