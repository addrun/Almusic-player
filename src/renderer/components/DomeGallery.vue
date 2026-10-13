<template>
  <div
    ref="containerRef"
    class="dome-gallery"
    :style="{ width: '100%', height: '100%' }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @wheel.prevent="onWheel"
  >
    <div class="dome-scene" :style="{ transform: `scale(${zoomLevel})` }">
      <div
        v-for="(item, index) in images"
        :key="item.id || index"
        class="dome-frame"
        :class="{
          'dome-frame--focused': focusIndex === index,
          'dome-frame--hover': hoverIndex === index
        }"
        :style="getElementStyle(index)"
        @click.stop="onElementClick(index)"
        @pointerenter="hoverIndex = index"
        @pointerleave="hoverIndex = -1"
      >
        <img :src="item.src" :alt="item.alt || ''" class="dome-image" draggable="false" />
        <div v-if="hoverIndex === index || focusIndex === index" class="dome-label">
          {{ item.alt }}
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

interface DomeImage {
  id?: number | string;
  src: string;
  alt?: string;
}

const props = withDefaults(
  defineProps<{
    images: DomeImage[];
    size?: number;
    gap?: number;
  }>(),
  {
    size: 110,
    gap: 16
  }
);

const emit = defineEmits<{
  (e: 'select', item: DomeImage, index: number): void;
}>();

const containerRef = ref<HTMLElement | null>(null);

// Rotation state
const rotationX = ref(-15);
const rotationY = ref(0);
const targetRotationX = ref(-15);
const targetRotationY = ref(0);

// Drag state
const isDragging = ref(false);
const lastPointer = ref({ x: 0, y: 0 });
const velocity = ref({ x: 0, y: 0 });
const lastMoveTime = ref(0);

// Focus/expand state
const focusIndex = ref(-1);

// Hover state
const hoverIndex = ref(-1);

// Zoom state
const zoomLevel = ref(1);
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3;
const ZOOM_SPEED = 0.002;

// Inertia animation
let inertiaRAF: number | null = null;

// Dome radius calculation
const radius = computed(() => {
  const count = props.images.length || 1;
  return Math.max(150, Math.min(300, count * props.size * 0.25));
});

// Calculate 3D position for each element
const getElementStyle = (index: number) => {
  const total = props.images.length;
  if (total === 0) return {};

  // Distribute items in a dome/sphere pattern
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const theta = goldenAngle * index;
  const phi = Math.acos(1 - (2 * (index + 0.5)) / total);

  // Spherical to Cartesian
  const baseX = Math.sin(phi) * Math.cos(theta);
  const baseY = Math.sin(phi) * Math.sin(theta);
  const baseZ = Math.cos(phi);

  // Apply rotation
  const rx = (rotationX.value * Math.PI) / 180;
  const ry = (rotationY.value * Math.PI) / 180;

  // Rotate around Y axis
  const x1 = baseX * Math.cos(ry) + baseZ * Math.sin(ry);
  const y1 = baseY;
  const z1 = -baseX * Math.sin(ry) + baseZ * Math.cos(ry);

  // Rotate around X axis
  const x2 = x1;
  const y2 = y1 * Math.cos(rx) - z1 * Math.sin(rx);
  const z2 = y1 * Math.sin(rx) + z1 * Math.cos(rx);

  const r = radius.value;
  const isFocused = focusIndex.value === index;
  const scale = isFocused ? 1.3 : 1;
  const tz = isFocused ? 100 : 0;

  return {
    width: `${props.size}px`,
    height: `${props.size}px`,
    transform: `translate3d(${x2 * r}px, ${y2 * r}px, ${z2 * r + tz}px) scale(${scale})`,
    zIndex: Math.round((z2 + 1) * 50) + (isFocused ? 1000 : 0),
    opacity: isFocused ? 1 : Math.max(0.3, (z2 + 1) / 2),
    transition: isDragging.value ? 'none' : 'transform 0.3s ease, opacity 0.3s ease'
  };
};

// Pointer events
const onPointerDown = (e: PointerEvent) => {
  if (e.button !== 0) return;
  isDragging.value = true;
  lastPointer.value = { x: e.clientX, y: e.clientY };
  lastMoveTime.value = Date.now();
  velocity.value = { x: 0, y: 0 };

  // Stop inertia
  if (inertiaRAF !== null) {
    cancelAnimationFrame(inertiaRAF);
    inertiaRAF = null;
  }

  // Capture pointer
  (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
};

const onPointerMove = (e: PointerEvent) => {
  if (!isDragging.value) return;

  const dx = e.clientX - lastPointer.value.x;
  const dy = e.clientY - lastPointer.value.y;
  const now = Date.now();
  const dt = Math.max(1, now - lastMoveTime.value);

  // Update rotation (negate dy so dragging up rotates up, dragging down rotates down)
  targetRotationY.value += dx * 0.3;
  targetRotationX.value = Math.max(-60, Math.min(30, targetRotationX.value - dy * 0.3));
  rotationY.value = targetRotationY.value;
  rotationX.value = targetRotationX.value;

  // Track velocity for inertia
  velocity.value = {
    x: (dx / dt) * 16,
    y: (dy / dt) * 16
  };

  lastPointer.value = { x: e.clientX, y: e.clientY };
  lastMoveTime.value = now;
};

const onPointerUp = () => {
  if (!isDragging.value) return;
  isDragging.value = false;

  // Apply inertia
  if (Math.abs(velocity.value.x) > 0.5 || Math.abs(velocity.value.y) > 0.5) {
    startInertia();
  }
};

const startInertia = () => {
  const friction = 0.95;
  const threshold = 0.1;

  const animate = () => {
    if (Math.abs(velocity.value.x) < threshold && Math.abs(velocity.value.y) < threshold) {
      inertiaRAF = null;
      return;
    }

    velocity.value.x *= friction;
    velocity.value.y *= friction;

    targetRotationY.value += velocity.value.x;
    targetRotationX.value = Math.max(-60, Math.min(30, targetRotationX.value - velocity.value.y));
    rotationY.value = targetRotationY.value;
    rotationX.value = targetRotationX.value;

    inertiaRAF = requestAnimationFrame(animate);
  };

  inertiaRAF = requestAnimationFrame(animate);
};

// Wheel: ctrl+scroll = zoom, otherwise = rotate
const onWheel = (e: WheelEvent) => {
  if (e.ctrlKey || e.metaKey) {
    // Zoom in/out
    e.preventDefault();
    const delta = -e.deltaY * ZOOM_SPEED;
    zoomLevel.value = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomLevel.value + delta));
  } else {
    // Rotate
    targetRotationY.value += e.deltaX * 0.3 + e.deltaY * 0.1;
    rotationY.value = targetRotationY.value;
  }
};

// Element click
const onElementClick = (index: number) => {
  if (Math.abs(velocity.value.x) > 2 || Math.abs(velocity.value.y) > 2) {
    return; // Ignore click if was dragging
  }

  if (focusIndex.value === index) {
    focusIndex.value = -1;
  } else {
    focusIndex.value = index;
    emit('select', props.images[index], index);
  }
};

// Cleanup
onUnmounted(() => {
  if (inertiaRAF !== null) {
    cancelAnimationFrame(inertiaRAF);
  }
});
</script>

<style scoped>
.dome-gallery {
  position: relative;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.dome-gallery:active {
  cursor: grabbing;
}

.dome-scene {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  perspective: 900px;
}

.dome-frame {
  position: absolute;
  border-radius: 12px;
  overflow: visible;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  transform-style: preserve-3d;
  will-change: transform, opacity;
  cursor: pointer;
}

.dome-frame:hover {
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
}

.dome-frame--focused {
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
}

.dome-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  border-radius: 12px;
}

.dome-label {
  position: absolute;
  bottom: -28px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 10px;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  color: white;
  font-size: 11px;
  font-weight: 500;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-radius: 6px;
  pointer-events: none;
  z-index: 10;
}
</style>
