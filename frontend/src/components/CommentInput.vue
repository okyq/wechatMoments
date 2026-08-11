<template>
  <div class="comment-input">
    <div v-if="replyTo" class="ci-reply-bar">
      回复 <span class="ci-reply-nick">@{{ replyTo.nickname }}</span>
      <button class="ci-cancel" @click="$emit('cancel-reply')">取消回复</button>
    </div>
    <div class="ci-row">
      <input
        v-model="nickname"
        class="input ci-nick"
        placeholder="你的昵称"
        maxlength="20"
        @blur="saveNickname"
      />
      <textarea
        v-model="text"
        class="textarea ci-text"
        :placeholder="replyTo ? `回复 @${replyTo.nickname}…` : '说点什么…'"
        rows="2"
        maxlength="500"
        @keydown.enter.exact.prevent="submit"
      ></textarea>
      <button class="btn btn-primary ci-send" :disabled="!canSend" @click="submit">发送</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

const props = defineProps({
  replyTo: { type: Object, default: null },
});
const emit = defineEmits(['submit', 'cancel-reply']);

const nickname = ref('');
const text = ref('');

const canSend = computed(() => text.value.trim().length > 0);

onMounted(() => {
  nickname.value = localStorage.getItem('blog_nickname') || '';
});

function saveNickname() {
  const v = nickname.value.trim();
  if (v) localStorage.setItem('blog_nickname', v);
}

function submit() {
  const nick = nickname.value.trim();
  const content = text.value.trim();
  if (!content) return;
  if (!nick) {
    // 未填昵称时聚焦昵称框
    document.querySelector('.ci-nick')?.focus();
    return;
  }
  emit('submit', { nickname: nick, content, parent_id: props.replyTo ? props.replyTo.id : null });
  text.value = '';
}
</script>

<style scoped>
.comment-input {
  padding: 10px 12px;
  background: var(--comment-bg);
  border-radius: 6px;
}
.ci-reply-bar {
  font-size: 13px;
  color: var(--text-light);
  margin-bottom: 8px;
}
.ci-reply-nick {
  color: var(--text-sub);
}
.ci-cancel {
  color: var(--green);
  margin-left: 8px;
  font-size: 12px;
}
.ci-row {
  display: grid;
  grid-template-columns: 84px 1fr auto;
  gap: 8px;
  align-items: start;
}
.ci-nick {
  font-size: 13px;
}
.ci-text {
  font-size: 13px;
  min-height: 52px;
  max-height: 120px;
}
.ci-send {
  font-size: 13px;
  padding: 6px 14px;
}
@media (max-width: 420px) {
  .ci-row {
    grid-template-columns: 1fr;
  }
}
</style>
