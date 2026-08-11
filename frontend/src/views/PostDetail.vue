<template>
  <div class="detail-page">
    <!-- 顶栏（圆角） -->
    <header class="detail-bar">
      <button class="back-btn" @click="router.back()">
        <span class="back-arrow">‹</span> 返回
      </button>
      <span class="detail-bar-title">文章详情</span>
      <div class="detail-bar-right">
        <ThemeSwitcher />
      </div>
    </header>

    <div v-if="post" class="detail-card">
      <!-- 头部 -->
      <div class="d-head">
        <img v-if="site.site_avatar" class="avatar d-avatar" :src="site.site_avatar" alt="" referrerpolicy="no-referrer" />
        <span v-else class="avatar-fallback d-avatar">{{ initial }}</span>
        <div class="d-meta">
          <div class="d-nickname">{{ site.site_title || '我' }}</div>
          <div class="d-sub">
            <span>发布于 {{ formatDate(post.created_at) }}</span>
            <span v-if="post.updated_at !== post.created_at" class="d-updated">
              更新于 {{ formatDate(post.updated_at) }}
            </span>
            <span v-if="post.location" class="d-location">📍 {{ post.location }}</span>
          </div>
        </div>
      </div>

      <h1 class="d-title">{{ post.title }}</h1>

      <!-- 标签 -->
      <div v-if="post.tags && post.tags.length" class="d-tags">
        <span v-for="t in post.tags" :key="t" class="tag-chip"># {{ t }}</span>
      </div>

      <!-- 正文 -->
      <div class="d-content">
        <MarkdownView :content="post.content" />
      </div>

      <!-- 详情页大图 -->
      <div v-if="post.images && post.images.length" class="d-images">
        <ImageGrid :images="post.images" @preview="(i) => (viewerIndex = i)" />
      </div>

      <!-- 点赞 -->
      <div class="d-like-bar">
        <button class="btn d-like-btn" :class="{ liked }" @click="toggleLike">
          <span class="d-like-icon">{{ liked ? '❤️' : '🤍' }}</span>
          {{ liked ? '已赞' : '点赞' }}
          <span v-if="post.like_count" class="d-like-count">({{ post.like_count }})</span>
        </button>
      </div>

      <!-- 评论区 -->
      <section class="d-comments">
        <h2 class="d-comments-title">
          评论
          <span v-if="comments.length" class="d-comments-count">({{ comments.length }})</span>
        </h2>
        <CommentList v-if="comments.length" :comments="comments" @reply="startReply" />
        <div v-if="!comments.length" class="d-no-comments">还没有评论，来抢沙发吧～</div>
        <CommentInput
          class="d-comment-input"
          :reply-to="replyTo"
          @submit="submitComment"
          @cancel-reply="replyTo = null"
        />
      </section>
    </div>

    <div v-else class="detail-empty">{{ loadError || '加载中…' }}</div>

    <ImageViewer v-model="viewerIndex" :images="post?.images || []" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MarkdownView from '../components/MarkdownView.vue';
import ImageGrid from '../components/ImageGrid.vue';
import ImageViewer from '../components/ImageViewer.vue';
import CommentList from '../components/CommentList.vue';
import CommentInput from '../components/CommentInput.vue';
import ThemeSwitcher from '../components/ThemeSwitcher.vue';
import { getPost, getComments, addComment, likePost, getSite } from '../api';
import { initialOf, formatDateTime } from '../utils/format';

const route = useRoute();
const router = useRouter();

const site = ref({});
const initial = computed(() => initialOf(site.value.site_title));

const post = ref(null);
const loadError = ref('');
const comments = ref([]);
const replyTo = ref(null);
const viewerIndex = ref(null);

const liked = ref(false);

function formatDate(iso) {
  return formatDateTime(iso).slice(0, 16);
}

function updateSeo(p) {
  const siteName = site.value.site_title || '我的朋友圈';
  document.title = `${p.title} - ${siteName}`;
  const desc = (p.excerpt || '').replace(/\s+/g, ' ').slice(0, 120);
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'description';
    document.head.appendChild(meta);
  }
  meta.content = desc;
  let og = document.querySelector('meta[property="og:title"]');
  if (!og) {
    og = document.createElement('meta');
    og.setAttribute('property', 'og:title');
    document.head.appendChild(og);
  }
  og.content = p.title;
  const ogImg = document.querySelector('meta[property="og:image"]') || document.createElement('meta');
  ogImg.setAttribute('property', 'og:image');
  ogImg.content = p.cover || (p.images && p.images[0]) || '';
  if (!document.querySelector('meta[property="og:image"]')) document.head.appendChild(ogImg);
}

async function load() {
  post.value = null;
  loadError.value = '';
  try {
    const [p, c] = await Promise.all([getPost(route.params.id), getComments(route.params.id)]);
    post.value = p;
    comments.value = c.list;
    liked.value = JSON.parse(localStorage.getItem('blog_liked_posts') || '[]').includes(p.id);
    updateSeo(p);
  } catch (e) {
    loadError.value = e.response?.data?.error || '文章不存在或已下架';
    document.title = '文章不存在 - ' + (site.value.site_title || '我的朋友圈');
  }
}

function toggleLike() {
  const list = JSON.parse(localStorage.getItem('blog_liked_posts') || '[]');
  if (liked.value) {
    liked.value = false;
    post.value.like_count = Math.max(0, post.value.like_count - 1);
    likePost(post.value.id, 'unlike').then((r) => (post.value.like_count = r.like_count));
    localStorage.setItem('blog_liked_posts', JSON.stringify(list.filter((x) => x !== post.value.id)));
  } else {
    liked.value = true;
    post.value.like_count += 1;
    likePost(post.value.id, 'like').then((r) => (post.value.like_count = r.like_count));
    list.push(post.value.id);
    localStorage.setItem('blog_liked_posts', JSON.stringify(list));
  }
}

function startReply(c) {
  replyTo.value = c;
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

async function submitComment(data) {
  try {
    const row = await addComment(post.value.id, data);
    comments.value.push(row);
    replyTo.value = null;
  } catch (e) {
    alert(e.response?.data?.error || '评论失败，请稍后再试');
  }
}

onMounted(async () => {
  try {
    site.value = await getSite();
  } catch (e) {
    /* ignore */
  }
  await load();
});

watch(() => route.params.id, load);
</script>

<style scoped>
.detail-page {
  min-height: 100vh;
}

/* 顶栏（圆角浮层） */
.detail-bar {
  position: sticky;
  top: 8px;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 8px 12px 0;
  padding: 8px 14px;
  background: var(--card-translucent);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}
.back-btn {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 14px;
  color: var(--text);
}
.back-arrow {
  font-size: 26px;
  line-height: 1;
  color: var(--green);
}
.detail-bar-title {
  font-size: 15px;
  font-weight: 600;
}
.detail-bar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.admin-link {
  font-size: 13px;
  color: var(--text-light);
}

/* 卡片 */
.detail-card {
  background: var(--card);
  border-radius: var(--radius);
  margin: 14px 12px;
  padding: 18px 16px;
  box-shadow: var(--shadow);
}
.d-head {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
}
.d-avatar {
  width: 46px;
  height: 46px;
  font-size: 22px;
}
.d-nickname {
  font-size: 16px;
  font-weight: 600;
}
.d-sub {
  font-size: 12px;
  color: var(--text-light);
  margin-top: 2px;
  display: flex;
  gap: 10px;
}
.d-location {
  color: var(--text-sub);
}
.d-updated {
  color: var(--green);
}

.d-title {
  font-size: 22px;
  line-height: 1.4;
  margin-bottom: 10px;
}
.d-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.tag-chip {
  background: var(--chip-bg);
  color: var(--green-dark);
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 20px;
}
.d-content {
  margin-bottom: 10px;
}

/* 点赞 */
.d-like-bar {
  display: flex;
  justify-content: center;
  padding: 14px 0 6px;
  border-top: 1px dashed var(--border);
  margin-top: 14px;
}
.d-like-btn {
  background: var(--hover-bg);
  color: var(--text);
  border-radius: 20px;
  padding: 7px 22px;
}
.d-like-btn.liked {
  background: var(--like-bg);
  color: var(--like-text);
}
.d-like-icon {
  font-size: 15px;
}
.d-like-count {
  font-size: 12px;
  opacity: 0.8;
}

/* 评论区 */
.d-comments {
  margin-top: 16px;
}
.d-comments-title {
  font-size: 16px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.d-comments-count {
  font-size: 13px;
  color: var(--text-light);
  font-weight: normal;
}
.d-no-comments {
  text-align: center;
  color: var(--text-light);
  font-size: 13px;
  padding: 18px 0;
}
.d-comment-input {
  margin-top: 12px;
}
.detail-empty {
  text-align: center;
  color: var(--text-light);
  padding: 80px 20px;
  font-size: 15px;
}
</style>
