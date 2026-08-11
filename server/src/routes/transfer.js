/**
 * 文章导入/导出（Obsidian 兼容）
 *
 * 导出：GET /api/admin/export?search=&tag=&month=&ids=1,2,3
 *   每篇文章打包为一个文件夹：{标题}/{标题}.md + {标题}/附件/*.png
 *   正文与封面中的图片引用重写为相对路径（附件/xxx.png），frontmatter 携带完整元数据，
 *   导入 Obsidian 等笔记软件后可直接打开且附件路径正确。
 *
 * 导入：POST /api/admin/import（multipart files[]，支持 .md 与 .zip 混传）
 *   解析 frontmatter（title/tags/slug/location/cover/date），
 *   zip 中的附件自动上传并按引用路径重写正文图片链接，
 *   同 slug 重复导入为更新（幂等）。
 */
const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const AdmZip = require('adm-zip');
const yaml = require('js-yaml');
const db = require('../db');
const { now, sanitizeSlug, normalizeTags, extractImages, checkImageMagic } = require('../utils');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const UPLOAD_DIR = path.join(__dirname, '..', '..', '..', 'uploads');
// 不含 svg（SVG 可内嵌脚本，存在存储型 XSS 风险，见 upload.js 说明）
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|avif)$/i;

// ---------- 工具 ----------

function newUploadName(originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  return Date.now().toString(36) + '-' + crypto.randomBytes(6).toString('hex') + (IMAGE_EXT.test(ext) ? ext : '.png');
}

/** 保存上传内容；非图片或魔数不符返回 null（防存储型 XSS） */
function saveUpload(buf, originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  if (!IMAGE_EXT.test(ext)) return null;
  if (!checkImageMagic(buf, ext)) return null;
  const name = newUploadName(originalName);
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return '/uploads/' + name;
}

/** 解析 frontmatter，返回 { fm, body }（解析失败视为无 frontmatter） */
function parseFrontMatter(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { fm: {}, body: content };
  let fm = {};
  try {
    const parsed = yaml.load(m[1]);
    if (parsed && typeof parsed === 'object') fm = parsed;
  } catch (e) {
    /* frontmatter 解析失败按无处理 */
  }
  return { fm, body: content.slice(m[0].length) };
}

/** 按 slug upsert 文章（与 Obsidian 插件接口同语义；createdAt/updatedAt 可由导入文件指定） */
function upsertPost({ title, slug, tags, location, cover, content, status, createdAt, updatedAt }) {
  const finalSlug = sanitizeSlug(slug || title);
  const finalLocation = String(location || '').trim();
  const images = extractImages(content);
  const finalCover = cover || images[0] || '';
  const t = now();
  const finalCreated = createdAt || t;
  const finalUpdated = updatedAt || t;
  const existing = db.prepare('SELECT id FROM posts WHERE slug = ?').get(finalSlug);
  if (existing) {
    db.prepare(
      'UPDATE posts SET title = ?, content = ?, cover = ?, images = ?, tags = ?, location = ?, status = ?, updated_at = ? WHERE id = ?'
    ).run(title, content, finalCover, JSON.stringify(images), JSON.stringify(normalizeTags(tags)), finalLocation, status === 0 || status === 1 ? status : 1, finalUpdated, existing.id);
    return { id: existing.id, created: false };
  }
  const info = db
    .prepare(
      `INSERT INTO posts (title, content, cover, images, tags, location, slug, status, like_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    )
    .run(title, content, finalCover, JSON.stringify(images), JSON.stringify(normalizeTags(tags)), finalLocation, finalSlug, status === 0 || status === 1 ? status : 1, finalCreated, finalUpdated);
  return { id: info.lastInsertRowid, created: true };
}

// ---------- 导出 ----------

/** 清洗为安全的文件夹名 */
function safeFolderName(title, id) {
  let name = String(title || '文章')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return name || '文章-' + id;
}

/** 生成 frontmatter YAML（js-yaml 保证特殊字符安全转义）；date=发布时间，updated=更新时间 */
function buildFrontMatter(p, coverRel) {
  const fm = {
    title: p.title,
    tags: JSON.parse(p.tags || '[]'),
    location: p.location || undefined,
    cover: coverRel || undefined,
    slug: p.slug,
    date: String(p.created_at),
    updated: String(p.updated_at),
  };
  return yaml.dump(fm, { lineWidth: 120 }).trim();
}

// 导出（支持 search/tag/month/status/ids 组合筛选）
router.get('/export', (req, res) => {
  const where = ['1=1'];
  const args = [];
  const search = String(req.query.search || '').trim();
  const tag = String(req.query.tag || '').trim();
  const month = String(req.query.month || '').trim();
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
  const ids = String(req.query.ids || '')
    .split(',')
    .map((x) => parseInt(x, 10))
    .filter((x) => x > 0);
  if (ids.length) {
    where.push(`id IN (${ids.map(() => '?').join(',')})`);
    args.push(...ids);
  }
  const posts = db
    .prepare(`SELECT * FROM posts WHERE ${where.join(' AND ')} ORDER BY created_at DESC`)
    .all(...args);

  const zip = new AdmZip();
  const usedFolders = new Set();

  for (const p of posts) {
    let folder = safeFolderName(p.title, p.id);
    if (usedFolders.has(folder)) folder = `${folder}-${p.id}`;
    usedFolders.add(folder);

    // 收集正文与封面中引用的服务器附件
    const urls = [...new Set([...(extractImages(p.content) || []), p.cover].filter(Boolean))];
    const attachMap = {};
    for (const u of urls) {
      if (!u.startsWith('/uploads/')) continue;
      const file = path.basename(u);
      const src = path.join(UPLOAD_DIR, file);
      if (!fs.existsSync(src)) continue;
      const zipPath = `${folder}/附件/${file}`;
      zip.addFile(zipPath, fs.readFileSync(src));
      attachMap[u] = `附件/${file}`;
    }

    // 重写正文与封面中的附件 URL 为相对路径
    let content = p.content;
    for (const [u, rel] of Object.entries(attachMap)) {
      content = content.split(u).join(rel);
    }
    const coverRel = attachMap[p.cover] || p.cover || '';

    const md = `---\n${buildFrontMatter(p, coverRel)}\n---\n\n${content.replace(/^\n+/, '')}`;
    zip.addFile(`${folder}/${safeFolderName(p.title, p.id)}.md`, Buffer.from(md, 'utf8'));
  }

  const buf = zip.toBuffer();
  const dateStr = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="blog-export-${dateStr}.zip"`);
  res.send(buf);
});

// ---------- 导入 ----------

const tmpUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()),
    filename: (req, file, cb) => cb(null, 'blog-import-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex') + path.extname(file.originalname || '')),
  }),
  limits: { fileSize: 200 * 1024 * 1024, files: 50 },
});

// 导入 .md 文件或 .zip 文件夹（multipart files[]）
router.post('/import', tmpUpload.array('files', 50), (req, res) => {
  if (!req.files || !req.files.length) return res.status(400).json({ error: '请选择要导入的 .md 文件或 .zip 压缩包' });

  const imported = [];
  const skipped = [];
  const errors = [];

  try {
    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase();
      try {
        if (ext === '.md') {
          const content = fs.readFileSync(file.path, 'utf8');
          const r = importMarkdown(content, path.basename(file.originalname, '.md'));
          (r.ok ? imported : skipped).push(r);
        } else if (ext === '.zip') {
          const r = importZip(file.path);
          for (const item of r) (item.ok ? imported : item.reason ? skipped : errors).push(item);
        } else {
          skipped.push({ name: file.originalname, reason: '仅支持 .md 与 .zip 文件' });
        }
      } catch (e) {
        errors.push({ name: file.originalname, reason: e.message });
      }
    }
  } finally {
    for (const file of req.files) {
      try {
        fs.unlinkSync(file.path);
      } catch (e) {
        /* ignore */
      }
    }
  }

  res.json({ imported, skipped, errors });
});

/** 解析 frontmatter 中的时间字段（date=发布时间，updated=更新时间），非法日期返回 undefined */
function parseDates(fm) {
  const toIso = (v) => {
    if (!v) return undefined;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  };
  return { createdAt: toIso(fm.date), updatedAt: toIso(fm.updated) };
}

/** 导入单个 markdown 文本 */
function importMarkdown(content, defaultName) {
  const { fm, body } = parseFrontMatter(content);
  const title = String(fm.title || defaultName || '').trim();
  if (!title) return { name: defaultName, ok: false, reason: '缺少标题' };
  const { createdAt, updatedAt } = parseDates(fm);
  const r = upsertPost({
    title,
    slug: String(fm.slug || defaultName || title),
    tags: fm.tags,
    location: fm.location,
    cover: /^(https?:|data:)/.test(String(fm.cover || '')) ? String(fm.cover) : '',
    content: body.replace(/^\n+/, ''),
    status: 1,
    createdAt,
    updatedAt,
  });
  return { name: title, id: r.id, ok: true, created: r.created };
}

/** 导入 zip：解压、上传附件、重写正文引用、逐篇创建文章 */
function importZip(zipPath) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const mdEntries = entries.filter((e) => !e.isDirectory && /\.md$/i.test(e.entryName));
  if (!mdEntries.length) return [{ name: path.basename(zipPath), ok: false, reason: '压缩包内未找到 .md 文件' }];

  // 附件映射：标准化路径 / basename → 已上传的服务器 URL（同一附件只上传一次）
  const attachCache = new Map();
  const resolveFile = (mdEntry, target) => {
    let t = String(target).replace(/^\.?\//, '');
    // 解析相对 md 所在目录的路径（../ 上跳）
    const dir = path.posix.dirname(mdEntry.entryName);
    const full = path.posix.normalize(path.posix.join(dir, t)).replace(/^\/+/, '');
    const tryPaths = [full, t, path.posix.basename(t)];
    for (const p of tryPaths) {
      if (attachCache.has(p)) return attachCache.get(p);
      const entry = entries.find((e) => !e.isDirectory && e.entryName.replace(/^\.?\//, '') === p);
      if (entry) {
        const buf = entry.getData();
        const url = saveUpload(buf, path.posix.basename(entry.entryName));
        attachCache.set(p, url);
        if (p !== path.posix.basename(t)) attachCache.set(path.posix.basename(t), url);
        return url;
      }
    }
    return null;
  };

  const results = [];
  for (const mdEntry of mdEntries) {
    const content = mdEntry.getData().toString('utf8');
    const { fm, body } = parseFrontMatter(content);
    const fileName = path.posix.basename(mdEntry.entryName, '.md');
    const title = String(fm.title || fileName || '').trim();
    if (!title) {
      results.push({ name: mdEntry.entryName, ok: false, reason: '缺少标题' });
      continue;
    }

    // 重写正文图片引用
    let newBody = body;
    newBody = newBody.replace(/!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (full, target, alt) => {
      const url = resolveFile(mdEntry, target.trim());
      if (!url) return full;
      return `![${(alt || path.posix.basename(target.trim())).replace(/\.\w+$/, '')}](${url})`;
    });
    newBody = newBody.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (full, alt, target) => {
      if (/^(https?:|data:|obsidian:|#|\/uploads\/)/.test(target)) return full;
      const url = resolveFile(mdEntry, target);
      if (!url) return full;
      return `![${alt || path.posix.basename(target)}](${url})`;
    });

    // 封面附件同样上传
    let cover = String(fm.cover || '');
    if (cover && !/^(https?:|data:)/.test(cover)) {
      const coverUrl = resolveFile(mdEntry, cover);
      if (coverUrl) cover = coverUrl;
    }

    const { createdAt, updatedAt } = parseDates(fm);
    const r = upsertPost({
      title,
      slug: String(fm.slug || fileName || title),
      tags: fm.tags,
      location: fm.location,
      cover,
      content: newBody.replace(/^\n+/, ''),
      status: 1,
      createdAt,
      updatedAt,
    });
    results.push({ name: title, id: r.id, ok: true, created: r.created });
  }
  return results;
}

module.exports = router;
