import { registerFeature } from './registry';

export function registerBuiltinFeatures() {
  registerFeature({
    id: 'lyric-metaphor',
    name: '歌词隐喻分析',
    description: '使用 AI 分析当前歌词中的隐喻、象征等修辞手法，以 Markdown 形式在侧边面板展示',
    icon: 'ri-quill-pen-line',
    type: 'analysis'
  });

  registerFeature({
    id: 'default-style',
    name: '默认样式',
    description: '标准的歌词播放器样式',
    icon: 'ri-file-text-line',
    type: 'playerStyle',
    locked: true
  });

  registerFeature({
    id: 'stage-style',
    name: '舞台样式',
    description: '沉浸式舞台风格的歌词展示',
    icon: 'ri-flood-fill',
    type: 'playerStyle'
  });

  registerFeature({
    id: 'magazine-style',
    name: '杂志样式',
    description: '杂志排版风格的歌词展示',
    icon: 'ri-article-line',
    type: 'playerStyle'
  });

  registerFeature({
    id: 'frenzy-style',
    name: '狂躁样式',
    description: '全屏动态效果的歌词展示',
    icon: 'ri-fire-line',
    type: 'playerStyle'
  });

  registerFeature({
    id: 'eerie-style',
    name: '诡谲样式',
    description: '书法字体+裂纹噪点背景+报纸滤镜的艺术风格歌词展示',
    icon: 'ri-ghost-line',
    type: 'playerStyle'
  });

  registerFeature({
    id: 'neon-style',
    name: '陈旧样式',
    description: '歌词拆笔画陈旧褪色效果+老旧墙面背景',
    icon: 'ri-time-line',
    type: 'playerStyle'
  });
}
