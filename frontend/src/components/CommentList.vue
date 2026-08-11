<template>
  <div class="comment-list">
    <div
      v-for="c in comments"
      :key="c.id"
      class="comment-item"
      :title="'点击回复 ' + c.nickname"
      @click="$emit('reply', c)"
    >
      <span class="c-nick">{{ c.nickname }}</span>
      <template v-if="parentOf(c)">
        <span class="c-reply-word"> 回复 </span>
        <span class="c-nick">{{ parentOf(c).nickname }}</span>
      </template>
      <span class="c-colon">：</span>
      <span class="c-text">{{ c.content }}</span>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  comments: { type: Array, default: () => [] },
});
defineEmits(['reply']);

// 在当前扁平列表中查找被回复的评论
function parentOf(c) {
  if (!c.parent_id) return null;
  return props.comments.find((x) => x.id === c.parent_id) || null;
}
</script>

<style scoped>
.comment-list {
  background: var(--comment-bg);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 14px;
  line-height: 1.6;
}
.comment-item {
  cursor: pointer;
  word-break: break-word;
}
.comment-item + .comment-item {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--border);
}
.c-nick {
  color: var(--text-sub);
  font-weight: 500;
}
.c-reply-word {
  color: var(--text-light);
}
.c-colon {
  color: var(--text-sub);
}
.c-text {
  color: var(--text);
}
</style>
