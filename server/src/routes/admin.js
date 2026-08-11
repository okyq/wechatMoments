const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { now, sanitizeSlug, normalizeTags, extractImages } = require('../utils');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// 附件目录（与上传接口、静态服务一致；不含 svg，见 upload.js 说明）
const UPLOAD_DIR = path.join(__dirname, '..', '..', '..', 'uploads');
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|avif)$/i;

// ---------- 统计 ----------
router.get('/stats', (req, res) => {
  const one = (sql, ...args) => db.prepare(sql).get(...args);
  const stats = {
    postCount: one('SELECT COUNT(*) AS c FROM posts').c,
    draftCount: one('SELECT COUNT(*) AS c FROM posts WHERE status = 0').c,
    commentCount: one('SELECT COUNT(*) AS c FROM comments WHERE status = 1').c,
    likeCount: one('SELECT COALESCE(SUM(like_count), 0) AS s FROM posts').s,
  };
  const recent = db.prepare('SELECT id, title, status, created_at FROM posts ORDER BY created_at DESC LIMIT 5').all();
  res.json({ ...stats, recent });
});

// ---------- 文章管理 ----------
function parseListQuery(req) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 10));
  const search = String(req.query.search || '').trim();
  const tag = String(req.query.tag || '').trim();
  const month = String(req.query.month || '').trim();
  const status = req.query.status === undefined || req.query.status === '' ? null : parseInt(req.query.status, 10);
  return { page, pageSize, search, tag, month, status };
}

router.get('/posts', (req, res) => {
  const { page, pageSize, search, tag, month, status } = parseListQuery(req);
  const where = [];
  const args = [];
  if (search) {
    where.push('(title LIKE ? OR content LIKE ?)');
    args.push(`%${search}%`, `%${search}%`);
  }
  if (tag) {
    where.push('tags LIKE ?');
    args.push(`%"${tag}"%`);
  }
  if (/^\d{4}-\d{2}$/.test(month)) {
    where.push("created_at LIKE ?");
    args.push(month + '%');
  }
  if (status === 0 || status === 1) {
    where.push('status = ?');
    args.push(status);
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) AS c FROM posts ${whereSql}`).get(...args).c;
  const list = db
    .prepare(
      `SELECT id, title, cover, tags, status, is_pinned, like_count, created_at, updated_at,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = posts.id AND c.status = 1) AS comment_count
       FROM posts ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(...args, pageSize, (page - 1) * pageSize)
    .map((r) => ({ ...r, tags: JSON.parse(r.tags || '[]'), is_pinned: !!r.is_pinned }));
  res.json({ list, total, page, pageSize });
});

// 筛选选项（含草稿，需在 /posts/:id 之前注册）
router.get('/filters', (req, res) => {
  const rows = db.prepare('SELECT tags, created_at FROM posts').all();
  const tags = new Set();
  const months = new Set();
  for (const r of rows) {
    for (const t of JSON.parse(r.tags || '[]')) tags.add(t);
    months.add(String(r.created_at).slice(0, 7));
  }
  res.json({ tags: [...tags].sort(), months: [...months].sort().reverse() });
});

router.get('/posts/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '文章不存在' });
  res.json({ ...row, tags: JSON.parse(row.tags || '[]'), images: JSON.parse(row.images || '[]') });
});

function prepareBody(body) {
  const title = String(body.title || '').trim();
  const content = String(body.content || '');
  const location = String(body.location || '').trim();
  const tags = normalizeTags(body.tags);
  const status = body.status === 0 ? 0 : 1;
  const images = extractImages(content);
  const cover = String(body.cover || '').trim() || images[0] || '';
  return { title, content, location, tags, status, images, cover };
}

router.post('/posts', (req, res) => {
  const { title, content, location, tags, status, images, cover } = prepareBody(req.body || {});
  if (!title) return res.status(400).json({ error: '标题不能为空' });
  const slug = sanitizeSlug(req.body.slug || title);
  const t = now();
  const info = db
    .prepare(
      `INSERT INTO posts (title, content, cover, images, tags, location, slug, status, like_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    )
    .run(title, content, cover, JSON.stringify(images), JSON.stringify(tags), location, slug, status, t, t);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/posts/:id', (req, res) => {
  const row = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '文章不存在' });
  const { title, content, location, tags, status, images, cover } = prepareBody(req.body || {});
  if (!title) return res.status(400).json({ error: '标题不能为空' });
  const slug = sanitizeSlug(req.body.slug || title);
  db.prepare(
    `UPDATE posts SET title = ?, content = ?, cover = ?, images = ?, tags = ?, location = ?, slug = ?, status = ?, updated_at = ? WHERE id = ?`
  ).run(title, content, cover, JSON.stringify(images), JSON.stringify(tags), location, slug, status, now(), req.params.id);
  res.json({ ok: true });
});

router.put('/posts/:id/status', (req, res) => {
  const status = req.body.status === 0 ? 0 : 1;
  const info = db.prepare('UPDATE posts SET status = ?, updated_at = ? WHERE id = ?').run(status, now(), req.params.id);
  if (!info.changes) return res.status(404).json({ error: '文章不存在' });
  res.json({ ok: true, status });
});

// 置顶 / 取消置顶
router.put('/posts/:id/pin', (req, res) => {
  const isPinned = req.body.is_pinned === 1 || req.body.is_pinned === true ? 1 : 0;
  const info = db.prepare('UPDATE posts SET is_pinned = ? WHERE id = ?').run(isPinned, req.params.id);
  if (!info.changes) return res.status(404).json({ error: '文章不存在' });
  res.json({ ok: true, is_pinned: !!isPinned });
});

router.delete('/posts/:id', (req, res) => {
  const info = db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: '文章不存在' });
  res.json({ ok: true });
});

// ---------- 评论管理 ----------
router.get('/comments', (req, res) => {
  const { page, pageSize, search } = parseListQuery(req);
  const where = [];
  const args = [];
  if (search) {
    where.push('(c.nickname LIKE ? OR c.content LIKE ?)');
    args.push(`%${search}%`, `%${search}%`);
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) AS c FROM comments c ${whereSql}`).get(...args).c;
  const list = db
    .prepare(
      `SELECT c.id, c.post_id, c.nickname, c.content, c.parent_id, c.status, c.created_at, p.title AS post_title
       FROM comments c LEFT JOIN posts p ON p.id = c.post_id
       ${whereSql} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`
    )
    .all(...args, pageSize, (page - 1) * pageSize);
  res.json({ list, total, page, pageSize });
});

router.delete('/comments/:id', (req, res) => {
  const info = db.prepare('UPDATE comments SET status = 0 WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: '评论不存在' });
  res.json({ ok: true });
});

// ---------- 站点设置 ----------
function allSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

router.get('/settings', (req, res) => {
  const admin = db.prepare('SELECT username, obsidian_token FROM admin LIMIT 1').get();
  res.json({ ...allSettings(), username: admin.username, obsidian_token: admin.obsidian_token });
});

router.put('/settings', (req, res) => {
  const body = req.body || {};
  const upd = db.prepare('UPDATE settings SET value = ? WHERE key = ?');
  for (const key of ['site_title', 'site_desc', 'site_avatar', 'site_background', 'site_favicon', 'site_theme', 'admin_theme', 'post_preview_length', 'post_page_size']) {
    if (body[key] !== undefined) upd.run(String(body[key]), key);
  }
  // 后台路径校验：仅字母数字下划线连字符（2-30 位），防止路径注入
  if (body.admin_path !== undefined) {
    const p = String(body.admin_path).trim();
    if (/^[a-zA-Z0-9_-]{2,30}$/.test(p)) {
      upd.run(p, 'admin_path');
    } else {
      return res.status(400).json({ error: '后台路径只能包含字母、数字、下划线、连字符（2-30 位）' });
    }
  }
  let obsidian_token = null;
  if (body.regenerate_token) {
    obsidian_token = crypto.randomBytes(24).toString('hex');
    db.prepare('UPDATE admin SET obsidian_token = ?').run(obsidian_token);
  }
  const admin = db.prepare('SELECT username, obsidian_token FROM admin LIMIT 1').get();
  res.json({ ...allSettings(), username: admin.username, obsidian_token: obsidian_token || admin.obsidian_token });
});

// ---------- 修改密码 ----------
router.put('/password', (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  const admin = db.prepare('SELECT * FROM admin LIMIT 1').get();
  if (!bcrypt.compareSync(String(oldPassword || ''), admin.password_hash)) {
    return res.status(400).json({ error: '原密码错误' });
  }
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: '新密码至少 6 位' });
  }
  db.prepare('UPDATE admin SET password_hash = ?').run(bcrypt.hashSync(String(newPassword), 10));
  res.json({ ok: true });
});

// ---------- 附件管理 ----------
function listAttachments({ page, pageSize, search }) {
  const files = fs
    .readdirSync(UPLOAD_DIR)
    .filter((f) => IMAGE_EXT.test(f))
    .map((f) => {
      const st = fs.statSync(path.join(UPLOAD_DIR, f));
      return { name: f, size: st.size, mtime: st.mtime.toISOString() };
    })
    .sort((a, b) => b.mtime.localeCompare(a.mtime));
  const filtered = search ? files.filter((f) => f.name.includes(search)) : files;
  const total = filtered.length;
  const list = filtered
    .slice((page - 1) * pageSize, page * pageSize)
    .map((f) => ({ ...f, url: '/uploads/' + f.name }));
  return { list, total, page, pageSize };
}

// 检查附件被哪些位置引用（文章封面/正文图片、站点头像/背景）
function findRefs(name) {
  const url = '/uploads/' + name;
  const refs = [];
  const posts = db.prepare('SELECT id, title, cover, images FROM posts').all();
  for (const p of posts) {
    const images = JSON.parse(p.images || '[]');
    if (p.cover === url || images.includes(url)) {
      refs.push({ type: '文章', title: p.title, link: `/admin/posts/${p.id}/edit` });
    }
  }
  const s = allSettings();
  if (s.site_avatar === url) refs.push({ type: '设置', title: '站点头像' });
  if (s.site_background === url) refs.push({ type: '设置', title: '横幅背景图' });
  return refs;
}

// 附件列表（扫描 uploads/ 目录，支持搜索与分页）
router.get('/attachments', (req, res) => {
  try {
    const { page, pageSize, search } = parseListQuery(req);
    res.json(listAttachments({ page, pageSize, search }));
  } catch (e) {
    res.status(500).json({ error: '读取附件目录失败' });
  }
});

// 删除附件（被引用时拒绝并提示引用位置）
router.delete('/attachments/:name', (req, res) => {
  const name = path.basename(String(req.params.name)); // 防目录穿越
  if (!name || name.includes('..')) return res.status(400).json({ error: '非法的文件名' });
  const file = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return res.status(404).json({ error: '文件不存在' });
  const refs = findRefs(name);
  if (refs.length) {
    return res.status(409).json({ error: '该附件正被引用，删除后引用会失效', refs });
  }
  fs.unlinkSync(file);
  res.json({ ok: true, name });
});

module.exports = router;
