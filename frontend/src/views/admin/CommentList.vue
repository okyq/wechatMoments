<template>
  <div>
    <h2 class="page-title">评论管理</h2>

    <div class="toolbar">
      <input v-model="search" class="input toolbar-search" placeholder="搜索昵称 / 内容…" @keydown.enter="reload" />
      <button class="btn btn-plain" @click="reload">搜索</button>
    </div>

    <div class="panel">
      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>文章</th>
            <th>昵称</th>
            <th>内容</th>
            <th>回复对象</th>
            <th>状态</th>
            <th>时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in list" :key="c.id">
            <td>{{ c.id }}</td>
            <td class="td-title">
              <RouterLink :to="adminUrl(`/posts/${c.post_id}/edit`)" :title="c.post_title">
                {{ c.post_title || `文章 #${c.post_id}` }}
              </RouterLink>
            </td>
            <td class="td-nick">{{ c.nickname }}</td>
            <td class="td-content" :title="c.content">{{ c.content }}</td>
            <td>{{ c.parent_id ? '#' + c.parent_id : '—' }}</td>
            <td>
              <span class="badge" :class="c.status ? 'badge-ok' : 'badge-danger'">
                {{ c.status ? '正常' : '已删除' }}
              </span>
            </td>
            <td class="td-time">{{ formatDateTime(c.created_at) }}</td>
            <td>
              <button v-if="c.status" class="btn btn-sm btn-danger" @click="remove(c)">删除</button>
            </td>
          </tr>
          <tr v-if="!list.length">
            <td colspan="8" class="td-empty">{{ loading ? '加载中…' : '暂无评论' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pager">
      <button class="btn btn-sm btn-plain" :disabled="page <= 1" @click="page--, reload()">上一页</button>
      <span class="pager-info">第 {{ page }} / {{ totalPages }} 页（共 {{ total }} 条）</span>
      <button class="btn btn-sm btn-plain" :disabled="page >= totalPages" @click="page++, reload()">下一页</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { adminComments, deleteComment } from '../../api';
import { formatDateTime } from '../../utils/format';
import { adminUrl } from '../../utils/admin';

const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = 10;
const search = ref('');
const loading = ref(false);

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

async function reload() {
  loading.value = true;
  try {
    const r = await adminComments({ page: page.value, pageSize, search: search.value });
    list.value = r.list;
    total.value = r.total;
  } finally {
    loading.value = false;
  }
}

async function remove(c) {
  if (!confirm(`确定删除「${c.nickname}」的这条评论？`)) return;
  await deleteComment(c.id);
  reload();
}

onMounted(reload);
</script>

<style scoped>
.page-title {
  font-size: 18px;
  margin-bottom: 14px;
}
.toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}
.toolbar-search {
  max-width: 300px;
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
  min-width: 820px;
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
}
.td-title a:hover {
  color: var(--green);
}
.td-nick {
  font-weight: 500;
}
.td-content {
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
.badge-danger {
  background: var(--like-bg);
  color: var(--danger);
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
