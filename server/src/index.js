require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

require('./db'); // 初始化数据库与种子数据

const seo = require('./prerender');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 上传的图片（nosniff 防止浏览器内容嗅探执行非图片内容）
app.use(
  '/uploads',
  express.static(path.join(__dirname, '..', '..', 'uploads'), {
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  })
);

// API 路由
app.use('/api/site', require('./routes/site'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/posts/:id/comments', require('./routes/comments'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/admin', require('./routes/transfer'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/obsidian', require('./routes/obsidian'));

// API 404
app.use('/api', (req, res) => res.status(404).json({ error: 'Not Found' }));

// SEO：sitemap / robots（所有请求可访问）
app.get('/sitemap.xml', seo.sitemap);
app.get('/robots.txt', seo.robots);

// 爬虫预渲染（仅爬虫 UA 命中，浏览器不受影响）
app.use(seo.prerender);

// 生产模式：托管前端构建产物（SPA 回退）
const distDir = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(distDir)) {
  // index.html 禁止强缓存（保证更新后用户立即拿到新版本）；
  // 带 hash 的静态资源（assets/*）可长缓存
  app.use(
    express.static(distDir, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );
  app.get('*', (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

// 统一错误处理（multer 等）
// 注意：生产环境隐藏错误细节，防止泄露内部路径/结构信息
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  // multer 大小/数量限制 → 413
  const status = err.status || (err.code && String(err.code).startsWith('LIMIT_') ? 413 : 500);
  const message = process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message;
  res.status(status).json({ error: message });
});

const PORT = process.env.PORT || 51021;
app.listen(PORT, () => {
  console.log(`[server] 博客后端已启动: http://localhost:${PORT}`);
});
