<template>
  <div ref="containerRef" class="aurora-container" />
</template>

<script setup lang="ts">
/**
 * Aurora 极光 WebGL 背景组件
 *
 * 使用 OGL 渲染 WebGL 极光特效
 * Props 控制颜色、振幅、混合度、速度
 */
import { Color, Mesh, Program, Renderer, Triangle } from 'ogl';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

interface Props {
  colorStops?: string[];
  amplitude?: number;
  blend?: number;
  speed?: number;
}

const props = withDefaults(defineProps<Props>(), {
  colorStops: () => ['#5227FF', '#7cff67', '#5227FF'],
  amplitude: 1.0,
  blend: 0.5,
  speed: 1.0
});

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;

out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v){
  const vec4 C = vec4(
      0.211324865405187, 0.366025403784439,
      -0.577350269189626, 0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);

  vec3 p = permute(
      permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
      0.5 - vec3(
          dot(x0, x0),
          dot(x12.xy, x12.xy),
          dot(x12.zw, x12.zw)
      ),
      0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);

  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

struct ColorStop {
  vec3 color;
  float position;
};

#define COLOR_RAMP(colors, factor, finalColor) {              \
  int index = 0;                                            \
  for (int i = 0; i < 2; i++) {                               \
     ColorStop currentColor = colors[i];                    \
     bool isInBetween = currentColor.position <= factor;    \
     index = int(mix(float(index), float(i), float(isInBetween))); \
  }                                                         \
  ColorStop currentColor = colors[index];                   \
  ColorStop nextColor = colors[index + 1];                  \
  float range = nextColor.position - currentColor.position; \
  float lerpFactor = (factor - currentColor.position) / range; \
  finalColor = mix(currentColor.color, nextColor.color, lerpFactor); \
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  ColorStop colors[3];
  colors[0] = ColorStop(uColorStops[0], 0.0);
  colors[1] = ColorStop(uColorStops[1], 0.5);
  colors[2] = ColorStop(uColorStops[2], 1.0);

  vec3 rampColor;
  COLOR_RAMP(colors, uv.x, rampColor);

  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  height = exp(height);
  height = (uv.y * 2.0 - height + 0.2);
  float intensity = 0.6 * height;

  float midPoint = 0.20;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);

  vec3 auroraColor = intensity * rampColor;

  fragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);
}
`;

const containerRef = ref<HTMLDivElement | null>(null);

let renderer: Renderer | null = null;
let program: Program | null = null;
let mesh: Mesh | null = null;
let animateId = 0;
let startTime = 0;

function hexToRgb(hex: string): [number, number, number] {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
}

onMounted(() => {
  const ctn = containerRef.value;
  if (!ctn) return;

  renderer = new Renderer({
    alpha: true,
    premultipliedAlpha: true,
    antialias: true
  });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.canvas.style.backgroundColor = 'transparent';

  const geometry = new Triangle(gl);
  if (geometry.attributes.uv) {
    delete geometry.attributes.uv;
  }

  const colorStopsArray = props.colorStops.map(hexToRgb);

  program = new Program(gl, {
    vertex: VERT,
    fragment: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uAmplitude: { value: props.amplitude },
      uColorStops: { value: colorStopsArray },
      uResolution: { value: [ctn.offsetWidth, ctn.offsetHeight] },
      uBlend: { value: props.blend }
    }
  });

  mesh = new Mesh(gl, { geometry, program });
  ctn.appendChild(gl.canvas);

  startTime = performance.now();

  const update = (t: number) => {
    animateId = requestAnimationFrame(update);
    if (!program || !renderer || !mesh) return;
    const elapsed = (t - startTime) * 0.001;
    program.uniforms.uTime.value = elapsed * props.speed * 0.1;
    program.uniforms.uAmplitude.value = props.amplitude;
    program.uniforms.uBlend.value = props.blend;
    program.uniforms.uColorStops.value = props.colorStops.map(hexToRgb);
    renderer.render({ scene: mesh });
  };
  animateId = requestAnimationFrame(update);

  const resize = () => {
    if (!ctn || !renderer || !program) return;
    const width = ctn.offsetWidth;
    const height = ctn.offsetHeight;
    renderer.setSize(width, height);
    program.uniforms.uResolution.value = [width, height];
  };
  window.addEventListener('resize', resize);
  resize();

  // cleanup on unmount via internal flag
  onBeforeUnmount(() => {
    cancelAnimationFrame(animateId);
    window.removeEventListener('resize', resize);
    if (ctn && gl.canvas.parentNode === ctn) {
      ctn.removeChild(gl.canvas);
    }
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    renderer = null;
    program = null;
    mesh = null;
  });
});
</script>

<style scoped>
.aurora-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.aurora-container :deep(canvas) {
  width: 100% !important;
  height: 100% !important;
  display: block;
}
</style>
