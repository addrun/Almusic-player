import TypographicPlayer from '@/components/lyric/TypographicPlayer.vue';

import { registerStyle } from '../registry';
import settings from './settings.json';

export default registerStyle({
  key: 'magazine',
  label: '杂志',
  component: TypographicPlayer,
  isFullScreen: false,
  theme: 'light',
  showStyleSwitch: true,
  settings
});
