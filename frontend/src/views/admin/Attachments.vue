<template>
  <div>
    <div class="list-head">
      <h2 class="page-title">附件管理</h2>
      <span class="attach-total">共 {{ total }} 个附件</span>
    </div>

    <div class="toolbar">
      <input v-model="search" class="input toolbar-search" placeholder="搜索文件名…" @keydown.enter="reload" />
      <button class="btn btn-plain" @click="reload">搜索</button>
      <span class="toolbar-hint">附件来自文章图片与站点图片上传</span>
    </div>

    <div class="attach-grid">
      <div v-for="a in list" :key="a.name" class="attach-card">
        <div class="attach-preview" @click="openPreview(a)">
          <img :src="a.url" alt="" loading="lazy" referrerpolicy="no-referrer" />
          <span class="attach-zoom">🔍</span>
        </div>
        <div class="attach-info">
          <div class="attach-name" :title="a.name">{{ a.name }}</div>
          <div class="attach-meta">{{ formatSize(a.size) }} · {{ formatDateTime(a.mtime) }}</div>
        </div>
        <div class="attach-ops">
          <button class="btn btn-sm btn-plain" @click="copyUrl(a)">复制链接</button>
          <button class="btn btn-sm btn-danger" @click="remove(a)">删除</button>
        </div>
      </div>
    </div>

    <div v-if="!list.length && !loading" class="attach-empty">暂无附件</div>

    <div class="pager">
      <button class="btn btn-sm btn-plain" :disabled="page <= 1" @click="page--, reload()">上一页</button>
      <span class="pager-info">第 {{ page }} / {{ totalPages }} 页</span>
      <button class="btn btn-sm btn-plain" :disabled="page >= totalPages" @click="page++, reload()">下一页</button>
    </div>

    <!-- 大图预览 -->
    <ImageViewer v-model="previewIndex" :images="previewImages" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import ImageViewer from '../../components/ImageViewer.vue';
import { adminAttachments, deleteAttachment } from '../../api';
import { formatDateTime } from '../../utils/format';

const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = 18;
const search = ref('');
const loading = ref(false);

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

async function reload() {
  loading.value = true;
  try {
    const r = await adminAttachments({ page: page.value, pageSize, search: search.value });
    list.value = r.list;
    total.value = r.total;
  } finally {
    loading.value = false;
  }
}

// 大图预览
const previewIndex = ref(null);
const previewImages = computed(() => list.value.map((a) => a.url));
function openPreview(a) {
  previewIndex.value = list.value.indexOf(a);
}

async function copyUrl(a) {
  try {
    await navigator.clipboard.writeText(window.location.origin + a.url);
    alert(`已复制链接：${a.url}`);
  } catch (e) {
    alert(`复制失败，请手动复制：${window.location.origin}${a.url}`);
  }
}

async function remove(a) {
  if (!confirm(`确定删除附件 ${a.name}？`)) return;
  try {
    await deleteAttachment(a.name);
    reload();
  } catch (e) {
    const data = e.response?.data;
    if (data?.refs?.length) {
      const refsText = data.refs.map((r) => `· ${r.type}《${r.title}》`).join('\n');
      alert(`无法删除：该附件正被引用：\n${refsText}\n\n请先在对应位置更换图片后再删除。`);
    } else {
      alert(data?.error || '删除失败');
    }
  }
}

onMounted(reload);
</script>

<style scoped>
.list-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}
.page-title {
  font-size: 18px;
}
.attach-total {
  font-size: 13px;
  color: var(--text-light);
}
.toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 14px;
}
.toolbar-search {
  max-width: 280px;
}
.toolbar-hint {
  font-size: 12px;
  color: var(--text-light);
}

/* 缩略图网格 */
.attach-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 12px;
}
.attach-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  transition: box-shadow 0.15s;
}
.attach-card:hover {
  box-shadow: var(--shadow-hover);
}
.attach-preview {
  position: relative;
  aspect-ratio: 4 / 3;
  background: var(--surface-2);
  cursor: zoom-in;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.attach-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: cover;
  width: 100%;
  height: 100%;
  transition: transform 0.2s;
}
.attach-preview:hover img {
  transform: scale(1.05);
}
.attach-zoom {
  position: absolute;
  right: 8px;
  bottom: 8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s;
}
.attach-preview:hover .attach-zoom {
  opacity: 1;
}
.attach-info {
  padding: 8px 10px 4px;
}
.attach-name {
  font-size: 12px;
  word-break: break-all;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'SF Mono', Consolas, Menlo, monospace;
}
.attach-meta {
  font-size: 12px;
  color: var(--text-light);
  margin-top: 2px;
}
.attach-ops {
  display: flex;
  gap: 6px;
  padding: 6px 10px 10px;
}
.attach-empty {
  text-align: center;
  color: var(--text-light);
  padding: 60px 0;
  font-size: 14px;
}
.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-top: 16px;
}
.pager-info {
  font-size: 13px;
  color: var(--text-light);
}
</style>
