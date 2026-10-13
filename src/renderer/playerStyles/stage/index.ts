import StagePlayer from '@/components/lyric/StagePlayer.vue';

import { registerStyle } from '../registry';
import settings from './settings.json';

export default registerStyle({
  key: 'stage',
  label: '舞台',
  component: StagePlayer,
  isFullScreen: false,
  theme: 'light',
  showStyleSwitch: true,
  settings
});
