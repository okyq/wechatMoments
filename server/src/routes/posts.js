const express = require('express');
const db = require('../db');
const { excerpt } = require('../utils');
const { createRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// 防恶意刷赞：每 IP 每分钟最多 20 次
const likeLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 20, message: '操作太频繁了，请稍后再试' });

const BASE_SQL = `SELECT p.*,
  (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.status = 1) AS comment_count
  FROM posts p`;

function toPublic(row) {
  return {
    id: row.id,
    title: row.title,
    cover: row.cover,
    images: JSON.parse(row.images || '[]'),
    tags: JSON.parse(row.tags || '[]'),
    location: row.location,
    content: row.content,
    excerpt: excerpt(row.content, 160),
    truncated: excerpt(row.content, 160).endsWith('…'),
    like_count: row.like_count,
    comment_count: row.comment_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// 筛选条件构造（search 标题/内容、tag 标签、month YYYY-MM）
function buildWhere(query) {
  const where = ['p.status = 1'];
  const args = [];
  const search = String(query.search || '').trim();
  const tag = String(query.tag || '').trim();
  const month = String(query.month || '').trim();
  if (search) {
    where.push('(p.title LIKE ? OR p.content LIKE ?)');
    args.push(`%${search}%`, `%${search}%`);
  }
  if (tag) {
    where.push("p.tags LIKE ?");
    args.push(`%"${tag}"%`);
  }
  if (/^\d{4}-\d{2}$/.test(month)) {
    where.push("p.created_at LIKE ?");
    args.push(month + '%');
  }
  return { whereSql: 'WHERE ' + where.join(' AND '), args };
}

// 已发布文章分页列表（支持 search/tag/month 筛选，按更新时间排序）
router.get('/', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(20, Math.max(1, parseInt(req.query.pageSize) || 10));
  const { whereSql, args } = buildWhere(req.query);
  const total = db.prepare(`SELECT COUNT(*) AS c FROM posts p ${whereSql}`).get(...args).c;
  const rows = db
    .prepare(`${BASE_SQL} ${whereSql} ORDER BY p.updated_at DESC, p.id DESC LIMIT ? OFFSET ?`)
    .all(...args, pageSize, (page - 1) * pageSize);
  res.json({ list: rows.map(toPublic), page, pageSize, total });
});

// 筛选选项：全部已发布文章的标签与月份（需在 /:id 之前注册）
router.get('/filters', (req, res) => {
  const rows = db.prepare('SELECT tags, created_at FROM posts WHERE status = 1').all();
  const tags = new Set();
  const months = new Set();
  for (const r of rows) {
    for (const t of JSON.parse(r.tags || '[]')) tags.add(t);
    months.add(String(r.created_at).slice(0, 7));
  }
  res.json({ tags: [...tags].sort(), months: [...months].sort().reverse() });
});

// 文章详情
router.get('/:id', (req, res) => {
  const row = db.prepare(`${BASE_SQL} WHERE p.id = ? AND p.status = 1`).get(req.params.id);
  if (!row) return res.status(404).json({ error: '文章不存在' });
  res.json({ ...toPublic(row), content: row.content });
});

// 点赞 / 取消点赞（游客可点，前端用 localStorage 限制每浏览器一次）
router.post('/:id/like', likeLimiter, (req, res) => {
  const row = db.prepare('SELECT like_count FROM posts WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '文章不存在' });
  const { action } = req.body || {};
  const delta = action === 'unlike' ? -1 : 1;
  const next = Math.max(0, row.like_count + delta);
  db.prepare('UPDATE posts SET like_count = ? WHERE id = ?').run(next, req.params.id);
  res.json({ like_count: next });
});

module.exports = router;
