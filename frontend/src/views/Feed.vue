<template>
  <!-- 加载骨架屏：数据未到位时不渲染默认值，避免闪烁 -->
  <div v-if="!ready" class="feed-page">
    <div class="feed-banner skeleton-banner">
      <div class="skeleton-block skeleton-banner-bg"></div>
      <div class="skeleton-block skeleton-banner-name"></div>
      <div class="skeleton-block skeleton-banner-avatar"></div>
    </div>
    <div class="feed-filters">
      <div class="skeleton-block skeleton-search"></div>
      <div class="skeleton-block skeleton-select"></div>
      <div class="skeleton-block skeleton-select"></div>
    </div>
    <main class="feed-list">
      <div v-for="i in 3" :key="i" class="moment-card skeleton-card">
        <div class="skeleton-row">
          <div class="skeleton-block skeleton-avatar-sm"></div>
          <div class="skeleton-col">
            <div class="skeleton-block skeleton-line w60"></div>
            <div class="skeleton-block skeleton-line w30"></div>
          </div>
        </div>
        <div class="skeleton-block skeleton-line w90"></div>
        <div class="skeleton-block skeleton-line w80"></div>
        <div class="skeleton-block skeleton-line w95"></div>
        <div class="skeleton-grid">
          <div v-for="j in 4" :key="j" class="skeleton-block skeleton-img"></div>
        </div>
      </div>
    </main>
  </div>

  <!-- 真实内容 -->
  <div v-else class="feed-page">
    <!-- 顶部个人横幅（仿朋友圈，圆角） -->
    <header class="feed-banner">
      <div class="banner-bg" :style="bannerStyle"></div>
      <div class="banner-info">
        <div class="banner-name">{{ site.site_title || '我的朋友圈' }}</div>
        <div class="banner-desc">{{ site.site_desc }}</div>
      </div>
      <img
        v-if="site.site_avatar"
        class="avatar banner-avatar"
        :src="site.site_avatar"
        alt=""
        referrerpolicy="no-referrer"
      />
      <span v-else class="avatar-fallback banner-avatar">{{ initial }}</span>
      <div class="banner-theme">
        <ThemeSwitcher />
      </div>
    </header>

    <!-- 筛选栏 -->
    <div class="feed-filters">
      <div class="filter-search">
        <span class="filter-icon">🔍</span>
        <input
          v-model="filters.search"
          class="filter-input"
          placeholder="搜索文章内容…"
          @input="onSearchInput"
        />
        <button v-if="filters.search" class="filter-clear" title="清空搜索" @click="clearSearch">✕</button>
      </div>
      <select v-model="filters.tag" class="filter-select" title="按标签筛选" @change="resetAndLoad">
        <option value="">全部标签</option>
        <option v-for="t in filterOptions.tags" :key="t" :value="t">{{ t }}</option>
      </select>
      <select v-model="filters.month" class="filter-select" title="按月份筛选" @change="resetAndLoad">
        <option value="">全部时间</option>
        <option v-for="m in filterOptions.months" :key="m" :value="m">{{ m }}</option>
      </select>
      <button
        v-if="hasActiveFilters"
        class="filter-reset"
        title="清除筛选"
        @click="resetFilters"
      >清除筛选</button>
    </div>

    <!-- 时间线列表 -->
    <main class="feed-list">
      <MomentCard
        v-for="p in posts"
        :key="p.id"
        :post="p"
        :site="site"
        @open="(post) => router.push(`/post/${post.id}`)"
      />

      <div v-if="!posts.length && !loading" class="feed-empty">
        {{ hasActiveFilters ? '没有找到符合条件的文章' : '还没有发布任何内容' }}<br />
        <span class="feed-empty-sub">
          {{ hasActiveFilters ? '换个筛选条件试试' : '去管理后台写一篇，或用 Obsidian 一键发布吧 ✍️' }}
        </span>
      </div>

      <!-- 分页 -->
      <div v-if="totalPages > 1" class="feed-pager">
        <button class="btn btn-sm btn-plain" :disabled="page <= 1" @click="changePage(page - 1)">
          ‹ 上一页
        </button>
        <span class="feed-pager-info">第 {{ page }} / {{ totalPages }} 页</span>
        <button class="btn btn-sm btn-plain" :disabled="page >= totalPages" @click="changePage(page + 1)">
          下一页 ›
        </button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import MomentCard from '../components/MomentCard.vue';
import ThemeSwitcher from '../components/ThemeSwitcher.vue';
import { getPosts, getSite, getFilters } from '../api';
import { initialOf } from '../utils/format';
import { applyTheme, hasStoredTheme } from '../utils/theme';

const router = useRouter();

// 首屏是否加载完成（完成前显示骨架屏，避免默认数据闪现）
const ready = ref(false);

// 站点信息
const site = ref({});
const initial = computed(() => initialOf(site.value.site_title));
const bannerStyle = computed(() =>
  site.value.site_background
    ? { backgroundImage: `url(${site.value.site_background})` }
    : {}
);

// 筛选
const filters = ref({ search: '', tag: '', month: '' });
const filterOptions = ref({ tags: [], months: [] });
const hasActiveFilters = computed(
  () => !!filters.value.search.trim() || !!filters.value.tag || !!filters.value.month
);
let searchTimer = null;

function onSearchInput() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(resetAndLoad, 400);
}
function clearSearch() {
  filters.value.search = '';
  resetAndLoad();
}
function resetFilters() {
  filters.value = { search: '', tag: '', month: '' };
  resetAndLoad();
}

// 列表 + 分页（每页条数由后台「站点设置」配置，默认 10）
const posts = ref([]);
const page = ref(1);
const total = ref(0);
const loading = ref(false);
const pageSize = computed(() => Math.max(1, site.value.post_page_size || 10));
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));

async function loadPage(n) {
  if (loading.value) return;
  loading.value = true;
  try {
    const { list, total: t } = await getPosts({
      page: n,
      pageSize: pageSize.value,
      search: filters.value.search.trim() || undefined,
      tag: filters.value.tag || undefined,
      month: filters.value.month || undefined,
    });
    posts.value = list;
    total.value = t;
    page.value = n;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    /* 加载失败静默处理 */
  } finally {
    loading.value = false;
  }
}

function changePage(n) {
  if (n < 1 || n > totalPages.value || n === page.value) return;
  loadPage(n);
}

async function resetAndLoad() {
  posts.value = [];
  total.value = 0;
  await loadPage(1);
}

onMounted(async () => {
  document.title = '我的朋友圈';
  // 站点信息、筛选选项、首屏文章并行加载，一次到位
  const [siteRes, filterRes] = await Promise.allSettled([getSite(), getFilters()]);
  if (siteRes.status === 'fulfilled') {
    site.value = siteRes.value;
    document.title = site.value.site_title || '我的朋友圈';
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', site.value.site_desc || '');
    // 访客未手动选择主题时，应用后台配置的默认主题
    if (!hasStoredTheme('site')) applyTheme(site.value.site_theme || 'wechat', 'site', false);
  }
  if (filterRes.status === 'fulfilled') filterOptions.value = filterRes.value;
  await loadPage(1);
  // 全部数据到位后再显示真实内容
  ready.value = true;
});

onBeforeUnmount(() => {
  clearTimeout(searchTimer);
});
</script>

<style scoped>
.feed-page {
  min-height: 100vh;
}

/* 横幅（圆角） */
.feed-banner {
  position: relative;
  height: 300px;
  margin: 12px 12px 44px;
  border-radius: var(--radius);
  overflow: visible;
  /* 注意：不能在这里 overflow: hidden，否则底部探出的头像会被裁剪；
     margin-bottom 预留头像探出的空间，避免与下方筛选模块重叠 */
}
.banner-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: var(--radius);
  background-image: var(--banner-grad);
  background-size: cover;
  background-position: center;
  background-color: var(--green);
}
.banner-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--banner-overlay);
}
.banner-info {
  position: absolute;
  left: 20px;
  bottom: 92px;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  z-index: 1;
}
.banner-name {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 1px;
}
.banner-desc {
  margin-top: 6px;
  font-size: 14px;
  opacity: 0.92;
}
.banner-avatar {
  position: absolute;
  right: 20px;
  bottom: -32px;
  width: 76px;
  height: 76px;
  border: 3px solid var(--card);
  border-radius: 8px;
  z-index: 2;
  font-size: 36px;
  box-shadow: var(--shadow-hover);
}
.banner-theme {
  position: absolute;
  top: 12px;
  right: 14px;
  z-index: 3;
}
@media (max-width: 480px) {
  .feed-banner {
    height: 240px;
  }
  .banner-avatar {
    width: 62px;
    height: 62px;
    font-size: 30px;
  }
  .banner-name {
    font-size: 22px;
  }
}

/* 筛选栏 */
.feed-filters {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 14px 12px 4px;
  flex-wrap: wrap;
}
.filter-search {
  position: relative;
  flex: 1;
  min-width: 180px;
}
.filter-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 13px;
  opacity: 0.7;
}
.filter-input {
  width: 100%;
  border: 1px solid var(--input-border);
  border-radius: 20px;
  padding: 8px 34px 8px 32px;
  font-size: 13px;
  background: var(--card);
  color: var(--text);
  transition: border-color 0.15s;
}
.filter-input:focus {
  border-color: var(--green);
}
.filter-clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--hover-bg);
  color: var(--text-light);
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.filter-select {
  border: 1px solid var(--input-border);
  border-radius: 20px;
  padding: 8px 12px;
  font-size: 13px;
  background: var(--card);
  color: var(--text);
  cursor: pointer;
  max-width: 150px;
}
.filter-reset {
  font-size: 12px;
  color: var(--text-sub);
  padding: 6px 10px;
  border-radius: 20px;
  background: var(--chip-bg);
  transition: opacity 0.15s;
}
.filter-reset:hover {
  opacity: 0.8;
}

/* 列表 */
.feed-list {
  padding-top: 44px;
}
.feed-empty {
  text-align: center;
  color: var(--text-light);
  padding: 60px 20px;
  font-size: 15px;
  line-height: 2;
}
.feed-empty-sub {
  font-size: 13px;
}
/* 分页 */
.feed-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 18px 0 40px;
}
.feed-pager-info {
  font-size: 13px;
  color: var(--text-light);
}

/* ============ 骨架屏 ============ */
.skeleton-block {
  background: linear-gradient(
    90deg,
    var(--border-light) 25%,
    var(--surface-2) 37%,
    var(--border-light) 63%
  );
  background-size: 400% 100%;
  animation: skeleton-shimmer 1.4s ease infinite;
  border-radius: 6px;
}
@keyframes skeleton-shimmer {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}
.skeleton-banner {
  height: 300px;
  position: relative;
}
.skeleton-banner-bg {
  position: absolute;
  inset: 0;
  border-radius: var(--radius);
}
.skeleton-banner-name {
  position: absolute;
  left: 20px;
  bottom: 92px;
  width: 140px;
  height: 26px;
}
.skeleton-banner-avatar {
  position: absolute;
  right: 20px;
  bottom: -32px;
  width: 76px;
  height: 76px;
  border-radius: 8px;
  border: 3px solid var(--card);
}
.skeleton-search {
  flex: 1;
  min-width: 180px;
  height: 36px;
  border-radius: 20px;
}
.skeleton-select {
  width: 110px;
  height: 36px;
  border-radius: 20px;
}
.skeleton-card {
  min-height: 200px;
}
.skeleton-row {
  display: flex;
  gap: 10px;
  align-items: center;
}
.skeleton-avatar-sm {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  flex-shrink: 0;
}
.skeleton-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.skeleton-line {
  height: 14px;
}
.skeleton-line + .skeleton-line {
  margin-top: 10px;
}
.w30 { width: 30%; }
.w60 { width: 60%; }
.w80 { width: 80%; }
.w90 { width: 90%; }
.w95 { width: 95%; }
.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-top: 12px;
}
.skeleton-img {
  aspect-ratio: 1 / 1;
  border-radius: 4px;
}
</style>
