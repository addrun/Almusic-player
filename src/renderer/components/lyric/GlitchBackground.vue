<template>
  <div ref="containerRef" class="glitch-bg-container" />
</template>

<script setup lang="ts">
/**
 * GlitchBackground - 狂躁模式 WebGL GLitch 故障背景
 *
 * RGB 通道偏移、扫描线、块状像素错位
 * 根据能量级别调整故障强度
 */
import { Mesh, Program, Renderer, Triangle } from 'ogl';
import { onBeforeUnmount, onMounted, ref } from 'vue';

interface Props {
  baseColor?: string;
  accentColor?: string;
  intensity?: number;
  crtIntensity?: number;
  speed?: number;
  showScanlines?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  baseColor: '#1a1a2e',
  accentColor: '#e94560',
  intensity: 0.5,
  crtIntensity: 0,
  speed: 1.0,
  showScanlines: true
});

const containerRef = ref<HTMLDivElement | null>(null);

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uIntensity;
uniform float uCrtIntensity;
uniform vec3 uBaseColor;
uniform vec3 uAccentColor;
uniform float uShowScanlines;
out vec4 fragColor;

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// CRT 桶形失真
vec2 crtDistort(vec2 uv, float strength) {
  vec2 centered = uv - 0.5;
  float r2 = dot(centered, centered);
  return centered * (1.0 + r2 * strength) + 0.5;
}

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  float t = iTime * 0.5;
  float crt = uCrtIntensity; // 高潮时才为非零

  // CRT 桶形失真（常态由 uIntensity 驱动，高潮时 crt 额外加强）
  float barrelStrength = uIntensity * 0.35 + crt * 0.3;
  uv = crtDistort(uv, barrelStrength);

  // 水平同步抖动
  float jitter = sin(uv.y * 80.0 + t * 5.0) * 0.008 * uIntensity;
  // 高潮时额外高频抖动
  jitter += sin(uv.y * 200.0 + t * 15.0) * 0.02 * crt;
  // 随机撕裂线（高潮时加强）
  float tearLine = step(0.96, random(vec2(floor(uv.y * 100.0), floor(t * 3.0))));
  jitter += tearLine * (0.03 * uIntensity + 0.06 * crt) * sin(t * 30.0);
  uv.x += jitter;

  uv = clamp(uv, 0.0, 1.0);

  vec3 col = uBaseColor;

  // 扫描线
  if (uShowScanlines > 0.5) {
    float scanline = sin(uv.y * iResolution.y * 0.5) * 0.5 + 0.5;
    scanline = pow(scanline, 6.0) * uIntensity * 0.25;
    col -= scanline;
    // 高潮时扫描线亮度闪烁
    float flicker = sin(uv.y * iResolution.y * 3.0 + t * 2.0) * 0.1 * crt;
    col *= (1.0 - flicker);
  }

  // RGB 通道偏移（常态由 uIntensity，高潮时大幅偏移）
  float rgbOffset = sin(t * 2.0) * (uIntensity * 0.02 + crt * 0.05);
  col.r += rgbOffset;
  col.b -= rgbOffset;
  // 高潮时垂直方向 RGB 偏移
  col.g += cos(t * 3.0) * crt * 0.02;

  // 强调色闪烁
  float flash = sin(t * 8.0) * 0.5 + 0.5;
  if (flash > 0.93 && uIntensity > 0.3) {
    col = mix(col, uAccentColor, 0.12 * uIntensity);
  }

  // 高潮时暖色调偏移（老电视偏黄）
  col.r *= 1.0 + crt * 0.15;
  col.g *= 1.0 + crt * 0.08;
  col.b *= 1.0 - crt * 0.1;

  // 噪点
  float grain = random(uv + t) * (0.06 * uIntensity + 0.1 * crt);
  col += grain;

  // 暗角
  float vignette = 1.0 - length((uv - 0.5) * 1.0);
  vignette = clamp(vignette, 0.0, 1.0);
  col *= mix(0.92, 1.0, vignette);
  // CRT 暗角增强（高潮时压暗边缘）
  float crtVignette = 1.0 - length((uv - 0.5) * 1.5);
  crtVignette = clamp(crtVignette, 0.0, 1.0);
  crtVignette = pow(crtVignette, 0.6);
  col *= mix(1.0, mix(0.4, 1.0, crtVignette), crt);

  // CRT 边缘衰减（高潮时）
  float edgeFade = 1.0 - 0.35 * crt * pow(abs(uv.x - 0.5) * 2.0, 2.0);
  col *= edgeFade;

  fragColor = vec4(col, 1.0);
}
`;

let renderer: Renderer | null = null;
let program: Program | null = null;
let mesh: Mesh | null = null;
let animateId = 0;
let startTime = 0;
let resizeHandler: (() => void) | null = null;

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0.1, 0.1, 0.2];
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255
  ];
}

onMounted(() => {
  const ctn = containerRef.value;
  if (!ctn) return;

  try {
    renderer = new Renderer({
      webgl: 2,
      alpha: false,
      antialias: false,
      dpr: Math.min(window.devicePixelRatio || 1, 2)
    });

    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 1);

    const geometry = new Triangle(gl);

    program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Float32Array([ctn.offsetWidth, ctn.offsetHeight]) },
        uIntensity: { value: props.intensity },
        uCrtIntensity: { value: props.crtIntensity },
        uBaseColor: { value: new Float32Array(hexToRgb(props.baseColor)) },
        uAccentColor: { value: new Float32Array(hexToRgb(props.accentColor)) },
        uShowScanlines: { value: props.showScanlines ? 1.0 : 0.0 }
      }
    });

    mesh = new Mesh(gl, { geometry, program });
    ctn.appendChild(gl.canvas);

    startTime = performance.now();

    const update = (t: number) => {
      animateId = requestAnimationFrame(update);
      if (!program || !renderer || !mesh) return;
      const elapsed = (t - startTime) * 0.001;
      program.uniforms.iTime.value = elapsed * props.speed;
      program.uniforms.uIntensity.value = props.intensity;
      program.uniforms.uCrtIntensity.value = props.crtIntensity;
      program.uniforms.uBaseColor.value = new Float32Array(hexToRgb(props.baseColor));
      program.uniforms.uAccentColor.value = new Float32Array(hexToRgb(props.accentColor));
      program.uniforms.uShowScanlines.value = props.showScanlines ? 1.0 : 0.0;
      renderer.render({ scene: mesh });
    };
    animateId = requestAnimationFrame(update);

    resizeHandler = () => {
      if (!ctn || !renderer || !program) return;
      const width = ctn.offsetWidth;
      const height = ctn.offsetHeight;
      renderer.setSize(width, height);
      (program.uniforms.iResolution.value as Float32Array)[0] = gl.drawingBufferWidth;
      (program.uniforms.iResolution.value as Float32Array)[1] = gl.drawingBufferHeight;
    };
    window.addEventListener('resize', resizeHandler);
    resizeHandler();
  } catch (e) {
    console.warn('[GlitchBackground] WebGL init failed, falling back to CSS:', e);
    renderer = null;
    program = null;
    mesh = null;
  }
});

onBeforeUnmount(() => {
  cancelAnimationFrame(animateId);
  if (resizeHandler) window.removeEventListener('resize', resizeHandler);
  try {
    if (containerRef.value && renderer?.gl?.canvas?.parentNode === containerRef.value) {
      containerRef.value.removeChild(renderer.gl.canvas);
    }
    renderer?.gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch (e) {
    console.warn('[GlitchBackground] cleanup error:', e);
  }
  renderer = null;
  program = null;
  mesh = null;
});
</script>

<style scoped>
.glitch-bg-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.glitch-bg-container :deep(canvas) {
  width: 100% !important;
  height: 100% !important;
  display: block;
}
</style>
