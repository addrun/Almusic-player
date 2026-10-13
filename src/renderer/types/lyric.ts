export interface LyricConfig {
  hideCover: boolean;
  centerLyrics: boolean;
  fontSize: number;
  letterSpacing: number;
  fontWeight: number;
  lineHeight: number;
  showTranslation: boolean;
  theme: 'default' | 'light' | 'dark';
  hidePlayBar: boolean;
  translationEngine?: 'none' | 'opencc';
  pureModeEnabled: boolean;
  hideMiniPlayBar: boolean;
  hideLyrics: boolean;
  contentWidth: number; // 内容区域宽度百分比
  playerStyle: 'default' | 'classic' | 'stage' | 'magazine' | 'frenzy';
  animationIntensity: 'soft' | 'normal' | 'power'; // 舞台模式歌词动画幅度
  // 移动端配置
  mobileLayout: 'default' | 'ios' | 'android';
  mobileCoverStyle: 'record' | 'square' | 'full';
  mobileShowLyricLines: number;
  // 背景自定义功能
  useCustomBackground: boolean; // 是否使用自定义背景
  backgroundMode: 'solid' | 'gradient' | 'image' | 'css'; // 背景模式
  solidColor: string; // 纯色背景颜色值
  gradientColors: {
    colors: string[]; // 渐变颜色数组
    direction: string; // 渐变方向
  };
  backgroundImage?: string; // 图片背景 (Base64 或 URL)
  imageBlur: number; // 图片模糊度 (0-20px)
  imageBrightness: number; // 图片明暗度 (0-200%, 100为正常)
  customCss?: string; // 自定义 CSS 样式
  // 杂志样式配置
  gridRhythmClimaxBoost: boolean; // 高潮闪烁增强
  gridRhythmSize: string; // 网格密度
  gridRhythmColor: boolean; // 颜色反转
  // 狂躁样式配置（白色背景、轻微故障、黑字可拉伸、红字正常）
  frenzyGlitchIntensity: number; // 故障强度 0-1
  frenzyVerticalStretch: number; // 垂直拉伸 1-2
  frenzyScale: number; // 整体缩放 0.5-2
  frenzyFontWeight: number; // 字体粗细 100-900
  frenzyCustomFont: string; // 系统字体名
  frenzyEmotionalDict: string[]; // 自定义情感词典
  frenzyShowEmphasisWords: boolean; // 显示强调词（总开关）
  frenzyShowRedKeywords: boolean; // 始终红色（级联第一级）
  frenzyUseCoverColor: boolean; // 跟随封面取色（级联第二级）
  frenzyShowScanlines: boolean; // 背景扫描线开关
  frenzyCrtIntensity: number; // CRT 失真强度 0-1
  frenzyKeywordCustomColor: string; // 强调字自定义颜色
  frenzyUseWhiteBackground: boolean; // 白色背景（级联第一级）
  frenzyUseCoverBackground: boolean; // 跟随封面背景（级联第二级）
  frenzyBackgroundCustomColor: string; // 背景自定义颜色
  frenzyShowBackgroundColor: boolean; // 自定义背景（总开关）

}

export const DEFAULT_LYRIC_CONFIG: LyricConfig = {
  hideCover: false,
  centerLyrics: false,
  fontSize: 22,
  letterSpacing: 0,
  fontWeight: 500,
  lineHeight: 2,
  showTranslation: true,
  theme: 'default',
  hidePlayBar: true,
  hideMiniPlayBar: false,
  pureModeEnabled: false,
  hideLyrics: false,
  contentWidth: 75, // 默认100%宽度
  playerStyle: 'default',
  animationIntensity: 'normal',
  // 移动端默认配置
  mobileLayout: 'ios',
  mobileCoverStyle: 'full',
  mobileShowLyricLines: 3,
  // 翻译引擎: 'none' or 'opencc'
  translationEngine: 'none',
  // 背景自定义功能默认值
  useCustomBackground: false,
  backgroundMode: 'solid',
  solidColor: '#1a1a1a',
  gradientColors: {
    colors: ['#1a1a1a', '#000000'],
    direction: 'to bottom'
  },
  backgroundImage: undefined,
  imageBlur: 0,
  imageBrightness: 100,
  customCss: undefined,
  // 杂志样式默认值
  gridRhythmClimaxBoost: false,
  gridRhythmSize: 'medium',
  gridRhythmColor: false,
  // 狂躁样式默认值（白色背景、轻微故障）
  frenzyGlitchIntensity: 0.3,
  frenzyVerticalStretch: 1.3,
  frenzyScale: 1.0,
  frenzyFontWeight: 900,
  frenzyCustomFont: 'PingFang SC',
  frenzyEmotionalDict: [],
  frenzyShowEmphasisWords: true,
  frenzyShowRedKeywords: true,
  frenzyUseCoverColor: true,
  frenzyShowScanlines: true,
  frenzyCrtIntensity: 0.35,
  frenzyKeywordCustomColor: '#ff0000',
  frenzyUseWhiteBackground: true,
  frenzyUseCoverBackground: true,
  frenzyBackgroundCustomColor: '#ffffff',
  frenzyShowBackgroundColor: false,

};

export interface ILyric {
  sgc: boolean;
  sfy: boolean;
  qfy: boolean;
  lrc: Lrc;
  klyric: Lrc;
  tlyric: Lrc;
  code: number;
}

interface Lrc {
  version: number;
  lyric: string;
}
