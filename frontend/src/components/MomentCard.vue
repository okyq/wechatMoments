<template>
  <article class="moment-card" @click="$emit('open', post)">
    <!-- 头部：头像 + 昵称 -->
    <header class="mc-head">
      <img
        v-if="site.site_avatar"
        class="avatar mc-avatar"
        :src="site.site_avatar"
        alt=""
        referrerpolicy="no-referrer"
      />
      <span v-else class="avatar-fallback mc-avatar">{{ initial }}</span>
      <div class="mc-meta">
        <div class="mc-nickname">
          {{ site.site_title || '我' }}
          <span v-if="post.is_pinned" class="mc-pin-badge">📌 置顶</span>
        </div>
        <div class="mc-time">
          <template v-if="updated">
            更新于 {{ relativeTime(post.updated_at) }}
          </template>
          <template v-else>发布于 {{ relativeTime(post.created_at) }}</template>
        </div>
      </div>
    </header>

    <!-- 正文：完整 markdown 渲染，超长截断显示"查看详情" -->
    <div
      class="mc-content"
      @click.stop="$emit('open', post)"
    >
      <MarkdownView :content="displayContent" />
    </div>
    <div v-if="truncated" class="mc-detail-row" @click.stop>
      <button class="mc-detail-btn" @click="$emit('open', post)">
        查看详情 ›
      </button>
    </div>

    <!-- 图片九宫格 -->
    <div v-if="post.images && post.images.length" class="mc-images">
      <ImageGrid :images="post.images" @preview="(i) => (viewerIndex = i)" />
    </div>
    <img
      v-else-if="post.cover"
      class="mc-cover"
      :src="post.cover"
      alt=""
      referrerpolicy="no-referrer"
      @click.stop="(viewerIndex = 0)"
    />

    <!-- 位置 -->
    <div v-if="post.location" class="mc-location" @click.stop="$emit('open', post)">
      📍 {{ post.location }}
    </div>

    <!-- 操作栏 -->
    <footer class="mc-actions">
      <div class="mc-actions-left">
        <span class="mc-time">发布于 {{ relativeTime(post.created_at) }}</span>
        <span v-if="updated" class="mc-updated">更新于 {{ relativeTime(post.updated_at) }}</span>
        <span v-if="post.location" class="mc-location-inline">📍 {{ post.location }}</span>
      </div>
      <div class="mc-actions-right" @click.stop>
        <button
          class="action-btn"
          :class="{ liked: liked }"
          :title="liked ? '取消点赞' : '点赞'"
          @click="toggleLike"
        >
          <span class="action-icon">{{ liked ? '❤️' : '🤍' }}</span>
        </button>
        <button class="action-btn" title="评论" @click="toggleComment">
          <span class="action-icon">💬</span>
        </button>
      </div>
    </footer>

    <!-- 点赞 + 评论区 -->
    <section v-if="post.like_count > 0 || comments.length" class="mc-social">
      <div v-if="post.like_count > 0" class="mc-likes" @click.stop>
        <span class="like-heart">❤️</span>
        <span>{{ post.like_count }} 人觉得很赞</span>
      </div>
      <template v-if="comments.length">
        <CommentList :comments="comments.slice(0, 3)" @reply="startReply" />
        <div v-if="post.comment_count > 3" class="mc-more-comments" @click.stop="$emit('open', post)">
          查看全部 {{ post.comment_count }} 条评论
        </div>
      </template>
    </section>

    <!-- 评论输入 -->
    <CommentInput
      v-if="commentOpen"
      class="mc-comment-input"
      :reply-to="replyTo"
      @submit="submitComment"
      @cancel-reply="replyTo = null"
    />

    <!-- 图片查看器 -->
    <ImageViewer v-model="viewerIndex" :images="post.images || []" />
  </article>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import MarkdownView from './MarkdownView.vue';
import ImageGrid from './ImageGrid.vue';
import ImageViewer from './ImageViewer.vue';
import CommentList from './CommentList.vue';
import CommentInput from './CommentInput.vue';
import { getComments, addComment, likePost } from '../api';
import { relativeTime, initialOf } from '../utils/format';

const props = defineProps({
  post: { type: Object, required: true },
  site: { type: Object, default: () => ({}) },
});
const emit = defineEmits(['open']);

const initial = computed(() => initialOf(props.site.site_title));

// 是否被更新过（更新时间与发布时间不同）
const updated = computed(() => props.post.updated_at !== props.post.created_at);

// 内容预览：超过后台配置的最大长度时截断，并显示"查看详情"
const maxLen = computed(() => props.site.post_preview_length || 500);
const truncated = computed(() => (props.post.content || '').length > maxLen.value);
const displayContent = computed(() => {
  const c = props.post.content || '';
  if (!truncated.value) return c;
  return c.slice(0, maxLen.value).replace(/\n+$/, '') + '\n\n…';
});

// 点赞（localStorage 限制每浏览器一次）
const liked = ref(false);
function toggleLike() {
  const list = JSON.parse(localStorage.getItem('blog_liked_posts') || '[]');
  if (liked.value) {
    liked.value = false;
    props.post.like_count = Math.max(0, props.post.like_count - 1);
    likePost(props.post.id, 'unlike').then((r) => (props.post.like_count = r.like_count));
    localStorage.setItem('blog_liked_posts', JSON.stringify(list.filter((x) => x !== props.post.id)));
  } else {
    liked.value = true;
    props.post.like_count += 1;
    likePost(props.post.id, 'like').then((r) => (props.post.like_count = r.like_count));
    list.push(props.post.id);
    localStorage.setItem('blog_liked_posts', JSON.stringify(list));
  }
}

// 评论
const comments = ref([]);
const commentOpen = ref(false);
const replyTo = ref(null);

onMounted(async () => {
  liked.value = (JSON.parse(localStorage.getItem('blog_liked_posts') || '[]')).includes(props.post.id);
  try {
    const { list } = await getComments(props.post.id);
    comments.value = list;
  } catch (e) {
    /* 评论加载失败不影响卡片 */
  }
});

function toggleComment() {
  commentOpen.value = !commentOpen.value;
  replyTo.value = null;
}
function startReply(c) {
  replyTo.value = c;
  commentOpen.value = true;
}
async function submitComment(data) {
  try {
    const row = await addComment(props.post.id, data);
    comments.value.push(row);
    props.post.comment_count += 1;
    replyTo.value = null;
  } catch (e) {
    alert(e.response?.data?.error || '评论失败，请稍后再试');
  }
}

// 图片查看器
const viewerIndex = ref(null);
</script>

<style scoped>
.moment-card {
  background: var(--card);
  border-radius: var(--radius);
  padding: 14px 14px 12px;
  margin: 0 12px 12px;
  box-shadow: var(--shadow);
  cursor: pointer;
  transition: box-shadow 0.2s;
}
.moment-card:hover {
  box-shadow: var(--shadow-hover);
}

/* 头部 */
.mc-head {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.mc-avatar {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  font-size: 20px;
}
.mc-meta {
  padding-top: 2px;
}
.mc-nickname {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 6px;
}
.mc-pin-badge {
  font-size: 11px;
  font-weight: 500;
  background: #fff6e0;
  color: #d48806;
  padding: 1px 8px;
  border-radius: 10px;
  white-space: nowrap;
}
.mc-time {
  font-size: 12px;
  color: var(--text-light);
  margin-top: 2px;
  display: block;
}

/* 正文：完整 markdown + 查看详情 */
.mc-content {
  margin-top: 8px;
  position: relative;
}
/* 正文内嵌图片由九宫格统一展示，这里隐藏避免重复 */
.mc-content :deep(.markdown-body img) {
  display: none;
}
.mc-detail-row {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}
.mc-detail-btn {
  color: var(--text-sub);
  font-size: 13px;
  padding: 5px 18px;
  border-radius: 14px;
  background: var(--comment-bg);
  transition: background 0.15s;
}
.mc-detail-btn:hover {
  background: var(--hover-bg);
}

/* 图片 */
.mc-images {
  margin-top: 2px;
}
.mc-cover {
  margin-top: 10px;
  max-width: 62%;
  border-radius: 6px;
  cursor: zoom-in;
  display: block;
}
.mc-location {
  margin-top: 8px;
  font-size: 13px;
  color: var(--text-sub);
}

/* 操作栏 */
.mc-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}
.mc-actions-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.mc-location-inline {
  font-size: 12px;
  color: var(--text-sub);
}
.mc-updated {
  font-size: 12px;
  color: var(--green);
  background: var(--chip-bg);
  padding: 1px 8px;
  border-radius: 10px;
}
.mc-actions-right {
  display: flex;
  gap: 6px;
}
.action-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--hover-bg);
  transition: transform 0.15s, background 0.15s;
}
.action-btn:hover {
  background: var(--border-light);
  transform: scale(1.08);
}
.action-btn.liked {
  animation: pop 0.3s;
}
.action-icon {
  font-size: 16px;
  line-height: 1;
}
@keyframes pop {
  0% { transform: scale(0.8); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

/* 社交区 */
.mc-social {
  margin-top: 8px;
}
.mc-likes {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text);
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--comment-bg);
}
.like-heart {
  font-size: 14px;
}
.mc-more-comments {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-sub);
  text-align: center;
  padding: 4px 0;
}
.mc-more-comments:hover {
  text-decoration: underline;
}
.mc-comment-input {
  margin-top: 8px;
}
</style>
