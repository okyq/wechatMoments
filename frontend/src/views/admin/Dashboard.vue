<template>
  <div>
    <h2 class="page-title">仪表盘</h2>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-num">{{ stats.postCount ?? '—' }}</div>
        <div class="stat-label">文章总数</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ stats.draftCount ?? '—' }}</div>
        <div class="stat-label">草稿</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ stats.commentCount ?? '—' }}</div>
        <div class="stat-label">评论总数</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{ stats.likeCount ?? '—' }}</div>
        <div class="stat-label">总点赞</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <span>最近文章</span>
        <RouterLink :to="adminUrl('/posts')" class="panel-more">查看全部 ›</RouterLink>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>标题</th>
            <th>状态</th>
            <th>发布时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in stats.recent || []" :key="p.id">
            <td>{{ p.id }}</td>
            <td class="td-title">
              <RouterLink :to="adminUrl(`/posts/${p.id}/edit`)">{{ p.title }}</RouterLink>
            </td>
            <td><span class="badge" :class="p.status ? 'badge-ok' : 'badge-muted'">{{ p.status ? '已发布' : '草稿' }}</span></td>
            <td class="td-time">{{ formatDateTime(p.created_at) }}</td>
          </tr>
          <tr v-if="!stats.recent || !stats.recent.length">
            <td colspan="4" class="td-empty">暂无文章</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { adminStats } from '../../api';
import { formatDateTime } from '../../utils/format';
import { adminUrl } from '../../utils/admin';

const stats = ref({});

onMounted(async () => {
  stats.value = await adminStats();
});
</script>

<style scoped>
.page-title {
  font-size: 18px;
  margin-bottom: 16px;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}
.stat-card {
  background: var(--card);
  border-radius: 10px;
  padding: 18px;
  text-align: center;
  border: 1px solid var(--border);
}
.stat-num {
  font-size: 28px;
  font-weight: 700;
  color: var(--green);
}
.stat-label {
  font-size: 13px;
  color: var(--text-light);
  margin-top: 4px;
}
.panel {
  background: var(--card);
  border-radius: 10px;
  border: 1px solid var(--border);
  overflow: hidden;
}
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  font-weight: 600;
  border-bottom: 1px solid var(--border);
}
.panel-more {
  font-size: 13px;
  font-weight: normal;
  color: var(--green);
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.table th,
.table td {
  padding: 10px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border-light);
}
.table th {
  color: var(--text-light);
  font-weight: 500;
  font-size: 13px;
  background: var(--surface-2);
}
.td-title a {
  color: var(--text);
}
.td-title a:hover {
  color: var(--green);
}
.td-time {
  color: var(--text-light);
  font-size: 13px;
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
}
.badge-ok {
  background: var(--chip-bg);
  color: var(--green-dark);
}
.badge-muted {
  background: var(--border-light);
  color: var(--text-light);
}
</style>
