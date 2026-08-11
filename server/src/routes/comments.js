const express = require('express');
const db = require('../db');
const { now } = require('../utils');
const { createRateLimiter } = require('../middleware/rateLimit');

const router = express.Router({ mergeParams: true });

// 防恶意刷评论：每 IP 每分钟最多 10 条
const commentLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 10, message: '评论太频繁了，请稍后再试' });

function postPublished(id) {
  return !!db.prepare('SELECT id FROM posts WHERE id = ? AND status = 1').get(id);
}

// 文章评论列表
router.get('/', (req, res) => {
  const rows = db
    .prepare(
      'SELECT id, post_id, nickname, content, parent_id, created_at FROM comments WHERE post_id = ? AND status = 1 ORDER BY created_at ASC'
    )
    .all(req.params.id);
  res.json({ list: rows });
});

// 游客发表评论（支持回复）
router.post('/', commentLimiter, (req, res) => {
  const postId = parseInt(req.params.id, 10);
  if (!postPublished(postId)) return res.status(404).json({ error: '文章不存在' });

  const nickname = String(req.body.nickname || '').trim();
  const content = String(req.body.content || '').trim();
  const parentId = req.body.parent_id ? parseInt(req.body.parent_id, 10) : null;
  if (!nickname || nickname.length > 20) return res.status(400).json({ error: '昵称需为 1-20 个字符' });
  if (!content || content.length > 500) return res.status(400).json({ error: '评论内容需为 1-500 个字符' });
  if (parentId) {
    const parent = db.prepare('SELECT id FROM comments WHERE id = ? AND post_id = ?').get(parentId, postId);
    if (!parent) return res.status(400).json({ error: '回复的评论不存在' });
  }

  const info = db
    .prepare('INSERT INTO comments (post_id, nickname, content, parent_id, status, created_at) VALUES (?, ?, ?, ?, 1, ?)')
    .run(postId, nickname, content, parentId, now());
  const row = db
    .prepare('SELECT id, post_id, nickname, content, parent_id, created_at FROM comments WHERE id = ?')
    .get(info.lastInsertRowid);
  res.status(201).json(row);
});

module.exports = router;
