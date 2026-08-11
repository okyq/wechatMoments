<template>
  <Teleport to="body">
    <transition name="viewer-fade">
      <div v-if="modelValue !== null" class="viewer" @click.self="close">
        <div class="viewer-top">
          <span class="viewer-count">{{ modelValue + 1 }} / {{ images.length }}</span>
          <button class="viewer-btn viewer-close" @click="close">✕</button>
        </div>

        <div
          class="viewer-stage"
          @touchstart="onTouchStart"
          @touchend="onTouchEnd"
          @dblclick="toggleZoom"
        >
          <img
            :src="images[modelValue]"
            class="viewer-img"
            :class="{ zoomed: zoomed }"
            referrerpolicy="no-referrer"
            draggable="false"
          />
        </div>

        <button
          v-if="modelValue > 0"
          class="viewer-btn viewer-nav nav-left"
          @click="prev"
        >‹</button>
        <button
          v-if="modelValue < images.length - 1"
          class="viewer-btn viewer-nav nav-right"
          @click="next"
        >›</button>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  modelValue: { type: Number, default: null },
  images: { type: Array, default: () => [] },
});
const emit = defineEmits(['update:modelValue']);

const zoomed = ref(false);
let touchX = 0;
let touchY = 0;

function close() {
  emit('update:modelValue', null);
}
function prev() {
  zoomed.value = false;
  emit('update:modelValue', Math.max(0, props.modelValue - 1));
}
function next() {
  zoomed.value = false;
  emit('update:modelValue', Math.min(props.images.length - 1, props.modelValue + 1));
}
function toggleZoom() {
  zoomed.value = !zoomed.value;
}
function onTouchStart(e) {
  touchX = e.changedTouches[0].clientX;
  touchY = e.changedTouches[0].clientY;
}
function onTouchEnd(e) {
  const dx = e.changedTouches[0].clientX - touchX;
  const dy = e.changedTouches[0].clientY - touchY;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
    dx > 0 ? prev() : next();
  }
}

function onKeydown(e) {
  if (props.modelValue === null) return;
  if (e.key === 'Escape') close();
  if (e.key === 'ArrowLeft') prev();
  if (e.key === 'ArrowRight') next();
}

watch(
  () => props.modelValue,
  (v) => {
    zoomed.value = false;
    if (v !== null) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
  }
);

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  document.body.style.overflow = '';
});
</script>

<style scoped>
.viewer {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.96);
  user-select: none;
}
.viewer-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  z-index: 2;
}
.viewer-count {
  color: #fff;
  font-size: 15px;
  opacity: 0.85;
}
.viewer-btn {
  color: #fff;
  font-size: 22px;
  opacity: 0.9;
  transition: opacity 0.15s;
}
.viewer-btn:hover {
  opacity: 1;
}
.viewer-close {
  font-size: 18px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}
.viewer-stage {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 12px;
}
.viewer-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 4px;
  transition: transform 0.3s ease;
  cursor: zoom-in;
}
.viewer-img.zoomed {
  transform: scale(2);
  cursor: zoom-out;
}
.viewer-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 72px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.12);
  font-size: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav-left {
  left: 10px;
}
.nav-right {
  right: 10px;
}
.viewer-fade-enter-active,
.viewer-fade-leave-active {
  transition: opacity 0.2s;
}
.viewer-fade-enter-from,
.viewer-fade-leave-to {
  opacity: 0;
}
</style>
