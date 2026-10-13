import FrenzyPlayer from '@/components/lyric/FrenzyPlayer.vue';

import { registerStyle } from '../registry';
import settings from './settings.json';

export default registerStyle({
  key: 'frenzy',
  label: '狂躁',
  component: FrenzyPlayer,
  isFullScreen: true,
  theme: 'dark',
  showStyleSwitch: false,
  settings
});
