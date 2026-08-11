const express = require('express');
const db = require('../db');
const { now, sanitizeSlug, normalizeTags, extractImages } = require('../utils');
const { requireObsidian } = require('../middleware/auth');

const router = express.Router();
router.use(requireObsidian);

// 查询某个 slug 是否已存在（插件判断新建/更新）
router.get('/posts', (req, res) => {
  const slug = String(req.query.slug || '');
  if (!slug) return res.status(400).json({ error: '缺少 slug' });
  const row = db.prepare('SELECT id, title, status, updated_at FROM posts WHERE slug = ?').get(slug);
  res.json({ exists: !!row, post: row || null });
});

// 按 slug 创建或更新文章（Obsidian 插件调用）
router.post('/posts', (req, res) => {
  const { title, content = '', cover = '', tags, location = '', slug = '', status } = req.body || {};
  const finalTitle = String(title || '').trim();
  if (!finalTitle) return res.status(400).json({ error: '缺少标题' });

  const finalSlug = sanitizeSlug(slug || title);
  const images = extractImages(content);
  const finalCover = String(cover || '').trim() || images[0] || '';
  const finalTags = JSON.stringify(normalizeTags(tags));
  const finalLocation = String(location || '').trim();
  const finalStatus = status === 0 || status === 1 ? status : 1;
  const t = now();

  const existing = db.prepare('SELECT id FROM posts WHERE slug = ?').get(finalSlug);
  if (existing) {
    db.prepare(
      `UPDATE posts SET title = ?, content = ?, cover = ?, images = ?, tags = ?, location = ?, status = ?, updated_at = ? WHERE id = ?`
    ).run(finalTitle, content, finalCover, JSON.stringify(images), finalTags, finalLocation, finalStatus, t, existing.id);
    return res.json({ id: existing.id, created: false, url: '/post/' + existing.id });
  }

  const info = db
    .prepare(
      `INSERT INTO posts (title, content, cover, images, tags, location, slug, status, like_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    )
    .run(finalTitle, content, finalCover, JSON.stringify(images), finalTags, finalLocation, finalSlug, finalStatus, t, t);
  res.status(201).json({ id: info.lastInsertRowid, created: true, url: '/post/' + info.lastInsertRowid });
});

module.exports = router;
