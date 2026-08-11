/**
 * SEO：为搜索引擎爬虫提供预渲染 HTML（SPA 本身对爬虫不友好）
 * - 检测常见爬虫 UA（Google/Bing/百度/搜狗/360/字节/社交平台抓取）
 * - GET / 和 /post/:id 时返回完整 HTML（标题、描述、正文内容、og 标签）
 * - GET /sitemap.xml 输出站点地图（所有 UA 可访问）
 * - GET /robots.txt 输出爬虫规则
 */
const MarkdownIt = require('markdown-it');
const db = require('./db');
const { excerpt } = require('./utils');

const md = new MarkdownIt({ html: false, linkify: true, breaks: false });

// 常见爬虫与社交抓取 UA
const CRAWLER_RE =
  /googlebot|bingbot|baiduspider|yisouspider|sogou|360spider|bytespider|petalbot|duckduckbot|slurp|facebookexternalhit|twitterbot|linkedinbot|pinterest|semrushbot|ahrefsbot|yandex|qwantify|seznambot/i;

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pageHtml({ title, description, contentHtml, siteTitle }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:site_name" content="${escapeHtml(siteTitle)}">
</head>
<body>
${contentHtml}
</body>
</html>`;
}

function settings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// 爬虫预渲染中间件：仅对爬虫 UA 生效，正常浏览器不受影响
function prerender(req, res, next) {
  const ua = req.headers['user-agent'] || '';
  if (!CRAWLER_RE.test(ua)) return next();

  const s = settings();
  const siteTitle = s.site_title || '我的朋友圈';
  const base = `${req.protocol}://${req.get('host')}`;

  // 首页：渲染文章列表
  if (req.path === '/') {
    const rows = db
      .prepare('SELECT * FROM posts WHERE status = 1 ORDER BY created_at DESC LIMIT 20')
      .all();
    const items = rows
      .map(
        (p) => `<article style="margin:16px 0">
<h2><a href="${base}/post/${p.id}">${escapeHtml(p.title)}</a></h2>
<p>${escapeHtml(p.location || '')} · ${escapeHtml(String(p.created_at).slice(0, 10))} · ${p.like_count} 赞</p>
<p>${escapeHtml(excerpt(p.content, 200))}</p>
</article>`
      )
      .join('');
    return res.send(
      pageHtml({
        title: siteTitle,
        description: s.site_desc || '',
        contentHtml: `<h1>${escapeHtml(siteTitle)}</h1><p>${escapeHtml(s.site_desc || '')}</p>${items}`,
        siteTitle,
      })
    );
  }

  // 文章详情：渲染完整正文
  const m = req.path.match(/^\/post\/(\d+)\/?$/);
  if (m) {
    const p = db.prepare('SELECT * FROM posts WHERE id = ? AND status = 1').get(m[1]);
    if (p) {
      const cover = p.cover
        ? `<meta property="og:image" content="${escapeHtml(p.cover.startsWith('http') ? p.cover : base + p.cover)}">`
        : '';
      return res.send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(p.title)} - ${escapeHtml(siteTitle)}</title>
<meta name="description" content="${escapeHtml(excerpt(p.content, 150))}">
<meta property="og:title" content="${escapeHtml(p.title)}">
<meta property="og:description" content="${escapeHtml(excerpt(p.content, 150))}">
<meta property="og:site_name" content="${escapeHtml(siteTitle)}">
${cover}
<link rel="canonical" href="${base}/post/${p.id}">
</head>
<body>
<article style="max-width:720px;margin:0 auto;padding:16px;line-height:1.8">
<h1>${escapeHtml(p.title)}</h1>
<p style="color:#888">${escapeHtml(String(p.created_at).slice(0, 10))} · ${escapeHtml(p.location || '')} · ${p.like_count} 赞</p>
${md.render(p.content)}
</article>
</body>
</html>`);
    }
  }

  return next();
}

// 站点地图
function sitemap(req, res) {
  const base = `${req.protocol}://${req.get('host')}`;
  const rows = db.prepare('SELECT id, updated_at FROM posts WHERE status = 1 ORDER BY created_at DESC').all();
  const urls = rows
    .map(
      (p) => `  <url>
    <loc>${base}/post/${p.id}</loc>
    <lastmod>${String(p.updated_at).slice(0, 10)}</lastmod>
  </url>`
    )
    .join('\n');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${base}/</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
  </url>
${urls}
</urlset>`);
}

// 爬虫规则
function robots(req, res) {
  const base = `${req.protocol}://${req.get('host')}`;
  res.type('text/plain').send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /api

Sitemap: ${base}/sitemap.xml`);
}

module.exports = { prerender, sitemap, robots };
