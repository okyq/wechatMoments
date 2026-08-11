<template>
  <div class="feed-page">
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
  try {
    site.value = await getSite();
    document.title = site.value.site_title || '我的朋友圈';
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', site.value.site_desc || '');
    // 访客未手动选择主题时，应用后台配置的默认主题
    if (!hasStoredTheme('site')) applyTheme(site.value.site_theme || 'wechat', 'site', false);
  } catch (e) {
    /* 站点信息加载失败时使用默认值 */
  }
  try {
    filterOptions.value = await getFilters();
  } catch (e) {
    /* 筛选选项加载失败时保持为空 */
  }
  await loadPage(1);
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
</style>
