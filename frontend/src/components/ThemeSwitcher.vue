<template>
  <div ref="rootEl" class="theme-switcher" @click.stop>
    <button
      class="theme-toggle"
      :title="`切换主题（当前：${currentName}）`"
      :aria-label="`切换主题（当前：${currentName}）`"
      @click="open = !open"
    >
      <span class="theme-toggle-icon" :style="{ background: currentGradient }"></span>
    </button>

    <transition name="pop">
      <div v-if="open" class="theme-panel">
        <div class="theme-panel-title">选择主题</div>
        <div
          v-for="t in THEMES"
          :key="t.id"
          class="theme-option"
          :class="{ active: theme === t.id }"
          @click="set(t.id)"
        >
          <span class="theme-swatch" :style="{ background: t.gradient }"></span>
          <span class="theme-option-name">{{ t.name }}</span>
          <span v-if="theme === t.id" class="theme-check">✓</span>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { THEMES, currentTheme, applyTheme, themeName } from '../utils/theme';

const props = defineProps({
  // 主题偏好作用域：site（前台）/ admin（后台），各自独立记忆
  scope: { type: String, default: 'site' },
});

const theme = ref(currentTheme());
const open = ref(false);
const rootEl = ref(null);

const currentName = computed(() => themeName(theme.value));
const currentGradient = computed(
  () => THEMES.find((t) => t.id === theme.value)?.gradient || THEMES[0].gradient
);

// 点击组件外部区域 / 按 Esc 时收起面板
function onDocClick(e) {
  if (rootEl.value && !rootEl.value.contains(e.target)) open.value = false;
}
function onDocKeydown(e) {
  if (e.key === 'Escape') open.value = false;
}

onMounted(() => {
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onDocKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick);
  document.removeEventListener('keydown', onDocKeydown);
});

function set(id) {
  theme.value = id;
  applyTheme(id, props.scope);
  open.value = false;
}
</script>

<style scoped>
.theme-switcher {
  position: relative;
  display: inline-block;
}
.theme-toggle {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--card-translucent);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s;
}
.theme-toggle:hover {
  transform: scale(1.08);
}
.theme-toggle-icon {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.85);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.theme-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow-hover);
  padding: 10px;
  min-width: 150px;
  z-index: 300;
}
.theme-panel-title {
  font-size: 12px;
  color: var(--text-light);
  padding: 2px 6px 8px;
}
.theme-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
}
.theme-option:hover {
  background: var(--hover-bg);
}
.theme-option.active {
  background: var(--hover-bg);
  color: var(--green);
  font-weight: 600;
}
.theme-swatch {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  flex-shrink: 0;
}
.theme-option-name {
  flex: 1;
}
.theme-check {
  font-size: 13px;
}
.pop-enter-active,
.pop-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
