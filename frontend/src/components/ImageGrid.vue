<template>
  <div class="img-grid" :class="`cols-${cols}`" @click.stop>
    <div
      v-for="(img, i) in images"
      :key="i"
      class="grid-cell"
      @click="$emit('preview', i)"
    >
      <img :src="img" :alt="`图片 ${i + 1}`" loading="lazy" referrerpolicy="no-referrer" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  images: { type: Array, default: () => [] },
});
defineEmits(['preview']);

// 微信朋友圈布局：1 张大图 / 2 张、4 张两列 / 其余三列
const cols = computed(() => {
  const n = props.images.length;
  if (n === 1 || n === 2 || n === 4) return n;
  return 3;
});
</script>

<style scoped>
.img-grid {
  display: grid;
  gap: 6px;
  width: 100%;
  margin-top: 10px;
}
.cols-1 {
  grid-template-columns: 1fr;
  max-width: 62%;
}
.cols-2,
.cols-4 {
  grid-template-columns: repeat(2, 1fr);
}
.cols-3,
.cols-5,
.cols-6,
.cols-7,
.cols-8,
.cols-9 {
  grid-template-columns: repeat(3, 1fr);
}
.grid-cell {
  cursor: zoom-in;
  overflow: hidden;
  border-radius: 4px;
  background: var(--border-light);
}
.grid-cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.2s;
}
.cols-1 .grid-cell {
  aspect-ratio: auto;
  border-radius: 6px;
}
.cols-1 .grid-cell img {
  width: auto;
  max-width: 100%;
  max-height: 340px;
  object-fit: contain;
}
.grid-cell:not(.cols-1 .grid-cell) {
  aspect-ratio: 1 / 1;
}
.grid-cell img:hover {
  transform: scale(1.04);
}
</style>
