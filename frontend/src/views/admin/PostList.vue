<template>
  <div>
    <div class="list-head">
      <h2 class="page-title">文章管理</h2>
      <div class="list-actions">
        <button class="btn btn-plain" @click="fileInput.click()">📥 导入</button>
        <button class="btn btn-plain" :disabled="exporting" @click="exportAll">
          {{ exporting ? '导出中…' : '📤 导出筛选结果' }}
        </button>
        <button
          v-if="selected.size"
          class="btn btn-primary"
          :disabled="exporting"
          @click="exportSelected"
        >
          📤 导出选中（{{ selected.size }}）
        </button>
        <RouterLink :to="adminUrl('/posts/new')" class="btn btn-primary">＋ 新建文章</RouterLink>
      </div>
    </div>

    <div class="toolbar">
      <input v-model="search" class="input toolbar-search" placeholder="搜索标题 / 内容…" @keydown.enter="reload" />
      <select v-model="tagFilter" class="input toolbar-select" @change="reload">
        <option value="">全部标签</option>
        <option v-for="t in filterOptions.tags" :key="t" :value="t">{{ t }}</option>
      </select>
      <select v-model="monthFilter" class="input toolbar-select" @change="reload">
        <option value="">全部时间</option>
        <option v-for="m in filterOptions.months" :key="m" :value="m">{{ m }}</option>
      </select>
      <select v-model="statusFilter" class="input toolbar-select" @change="reload">
        <option value="">全部状态</option>
        <option value="1">已发布</option>
        <option value="0">草稿</option>
      </select>
      <button class="btn btn-plain" @click="reload">搜索</button>
    </div>

    <div class="panel">
      <table class="table">
        <thead>
          <tr>
            <th class="th-check">
              <input
                type="checkbox"
                :checked="allPageChecked"
                title="全选本页"
                @change="togglePage"
              />
            </th>
            <th>ID</th>
            <th>标题</th>
            <th>标签</th>
            <th>状态</th>
            <th>置顶</th>
            <th>评论</th>
            <th>点赞</th>
            <th>发布时间</th>
            <th>更新时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in list" :key="p.id" :class="{ 'row-checked': selected.has(p.id) }">
            <td class="th-check">
              <input
                type="checkbox"
                :checked="selected.has(p.id)"
                @change="toggleOne(p.id)"
              />
            </td>
            <td>{{ p.id }}</td>
            <td class="td-title">
              <RouterLink :to="adminUrl(`/posts/${p.id}/edit`)">{{ p.title }}</RouterLink>
            </td>
            <td>
              <span v-for="t in p.tags" :key="t" class="tag-chip">#{{ t }}</span>
            </td>
            <td>
              <span class="badge" :class="p.status ? 'badge-ok' : 'badge-muted'">
                {{ p.status ? '已发布' : '草稿' }}
              </span>
            </td>
            <td>
              <span v-if="p.is_pinned" class="badge badge-pin">📌 置顶</span>
            </td>
            <td>{{ p.comment_count }}</td>
            <td>{{ p.like_count }}</td>
            <td class="td-time">{{ formatDateTime(p.created_at) }}</td>
            <td class="td-time">{{ formatDateTime(p.updated_at) }}</td>
            <td class="td-ops">
              <button class="btn btn-sm btn-plain" @click="togglePin(p)">
                {{ p.is_pinned ? '取消置顶' : '置顶' }}
              </button>
              <button class="btn btn-sm btn-plain" @click="toggleStatus(p)">
                {{ p.status ? '下架' : '发布' }}
              </button>
              <RouterLink :to="adminUrl(`/posts/${p.id}/edit`)" class="btn btn-sm btn-plain">编辑</RouterLink>
              <a :href="`/post/${p.id}`" target="_blank" class="btn btn-sm btn-plain">查看</a>
              <button class="btn btn-sm btn-danger" @click="remove(p)">删除</button>
            </td>
          </tr>
          <tr v-if="!list.length">
            <td colspan="11" class="td-empty">{{ loading ? '加载中…' : '暂无文章' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pager">
      <button class="btn btn-sm btn-plain" :disabled="page <= 1" @click="page--, reload()">上一页</button>
      <span class="pager-info">第 {{ page }} / {{ totalPages }} 页（共 {{ total }} 篇）</span>
      <button class="btn btn-sm btn-plain" :disabled="page >= totalPages" @click="page++, reload()">下一页</button>
    </div>

    <!-- 导入结果提示 -->
    <div v-if="importResult" class="import-result">
      <h3 class="import-title">
        {{ importResult.imported.length ? '✅ 导入完成' : '⚠️ 未导入任何文章' }}
        <button class="import-close" @click="importResult = null">✕</button>
      </h3>
      <div v-if="importResult.imported.length" class="import-section">
        <b>成功导入 {{ importResult.imported.length }} 篇：</b>
        <span v-for="(i, n) in importResult.imported" :key="i.id">
          <a :href="`/post/${i.id}`" target="_blank">{{ i.name }}</a>{{ i.created ? '' : '（更新）' }}<template v-if="n < importResult.imported.length - 1">、</template>
        </span>
      </div>
      <div v-if="importResult.skipped.length" class="import-section">
        <b>跳过 {{ importResult.skipped.length }}：</b>
        <span v-for="(s, n) in importResult.skipped" :key="n">{{ s.name }}（{{ s.reason }}）<template v-if="n < importResult.skipped.length - 1">、</template></span>
      </div>
      <div v-if="importResult.errors.length" class="import-section">
        <b>失败 {{ importResult.errors.length }}：</b>
        <span v-for="(e, n) in importResult.errors" :key="n">{{ e.name }}（{{ e.reason }}）<template v-if="n < importResult.errors.length - 1">、</template></span>
      </div>
    </div>

    <input ref="fileInput" type="file" accept=".md,.zip,application/zip" multiple hidden @change="onImportFiles" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import {
  adminPosts,
  adminFilters,
  setPostStatus,
  setPostPinned,
  deletePost,
  importFiles,
  exportPosts,
} from '../../api';
import { formatDateTime } from '../../utils/format';
import { adminUrl } from '../../utils/admin';

const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = 10;
const search = ref('');
const tagFilter = ref('');
const monthFilter = ref('');
const statusFilter = ref('');
const loading = ref(false);
const filterOptions = ref({ tags: [], months: [] });

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

// ---------- 多选（导出用） ----------
const selected = ref(new Set());
const allPageChecked = computed(
  () => list.value.length > 0 && list.value.every((p) => selected.value.has(p.id))
);
function toggleOne(id) {
  const s = new Set(selected.value);
  s.has(id) ? s.delete(id) : s.add(id);
  selected.value = s;
}
function togglePage(e) {
  const s = new Set(selected.value);
  if (e.target.checked) for (const p of list.value) s.add(p.id);
  else for (const p of list.value) s.delete(p.id);
  selected.value = s;
}

// ---------- 导入 ----------
const fileInput = ref(null);
const importResult = ref(null);
const importing = ref(false);

function onImportFiles(e) {
  const files = [...(e.target.files || [])];
  e.target.value = '';
  if (!files.length) return;
  importing.value = true;
  importFiles(files)
    .then((r) => {
      importResult.value = r;
      reload();
    })
    .catch((err) => {
      alert(err.response?.data?.error || '导入失败，请检查文件格式');
    })
    .finally(() => {
      importing.value = false;
    });
}

// ---------- 导出 ----------
const exporting = ref(false);
function currentParams() {
  return {
    search: search.value,
    tag: tagFilter.value,
    month: monthFilter.value,
    status: statusFilter.value,
  };
}

async function exportSelected() {
  if (!selected.value.size) return;
  await doExport({ ids: [...selected.value].join(',') });
}

async function exportAll() {
  await doExport(currentParams());
}

async function doExport(params) {
  exporting.value = true;
  try {
    const blob = await exportPosts(params);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blog-export-${new Date().toISOString().slice(0, 10)}.zip`;
    // 挂载到文档后再触发下载（兼容性更好），并兜底提示
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    alert(`导出成功 ✓\n压缩包已开始下载（blog-export-${new Date().toISOString().slice(0, 10)}.zip）\n\n每篇文章一个文件夹，含附件子文件夹，可直接导入 Obsidian。`);
  } catch (err) {
    alert('导出失败：' + (err.message || '请检查网络或登录状态'));
  } finally {
    exporting.value = false;
  }
}

async function reload() {
  loading.value = true;
  try {
    const r = await adminPosts({
      page: page.value,
      pageSize,
      search: search.value,
      tag: tagFilter.value,
      month: monthFilter.value,
      status: statusFilter.value,
    });
    list.value = r.list;
    total.value = r.total;
  } finally {
    loading.value = false;
  }
}

async function toggleStatus(p) {
  const next = p.status ? 0 : 1;
  await setPostStatus(p.id, next);
  p.status = next;
}

async function togglePin(p) {
  const next = !p.is_pinned;
  await setPostPinned(p.id, next);
  p.is_pinned = next;
}

async function remove(p) {
  if (!confirm(`确定删除《${p.title}》？该文章的所有评论也会被删除。`)) return;
  await deletePost(p.id);
  reload();
}

onMounted(async () => {
  try {
    filterOptions.value = await adminFilters();
  } catch (e) {
    /* ignore */
  }
  reload();
});
</script>

<style scoped>
.list-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}
.list-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.page-title {
  font-size: 18px;
}
.th-check {
  width: 36px;
  text-align: center;
}
.th-check input {
  accent-color: var(--green);
  cursor: pointer;
}
.row-checked {
  background: var(--chip-bg);
}
.toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}
.toolbar-search {
  max-width: 300px;
}
.toolbar-select {
  width: 130px;
}
.panel {
  background: var(--card);
  border-radius: 10px;
  border: 1px solid var(--border);
  overflow-x: auto;
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  min-width: 760px;
}
.table th,
.table td {
  padding: 10px 14px;
  text-align: left;
  border-bottom: 1px solid var(--border-light);
  vertical-align: middle;
}
.table th {
  color: var(--text-light);
  font-weight: 500;
  font-size: 13px;
  background: var(--surface-2);
  white-space: nowrap;
}
.td-title a {
  color: var(--text);
  font-weight: 500;
}
.td-title a:hover {
  color: var(--green);
}
.td-time {
  color: var(--text-light);
  font-size: 13px;
  white-space: nowrap;
}
.td-empty {
  text-align: center;
  color: var(--text-light);
  padding: 30px;
}
.td-ops {
  display: flex;
  gap: 6px;
  white-space: nowrap;
}
.badge {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 20px;
  white-space: nowrap;
}
.badge-ok {
  background: var(--chip-bg);
  color: var(--green-dark);
}
.badge-muted {
  background: var(--border-light);
  color: var(--text-light);
}
.badge-pin {
  background: #fff6e0;
  color: #d48806;
  white-space: nowrap;
}
.tag-chip {
  display: inline-block;
  background: var(--chip-bg);
  color: var(--green-dark);
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 10px;
  margin: 1px 4px 1px 0;
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
/* 导入结果 */
.import-result {
  margin-top: 16px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 16px;
}
.import-title {
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.import-close {
  color: var(--text-light);
  font-size: 14px;
  padding: 2px 8px;
}
.import-section {
  font-size: 13px;
  line-height: 1.9;
  color: var(--text);
}
.import-section a {
  color: var(--green);
}
.import-section b {
  font-weight: 600;
  margin-right: 4px;
}
</style>
