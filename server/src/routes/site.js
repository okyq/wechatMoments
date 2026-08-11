const express = require('express');
const db = require('../db');

const router = express.Router();

// 前台公开的站点信息（横幅、头像、默认主题、内容预览长度、分页大小、后台路径等）
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  res.json({
    site_title: s.site_title,
    site_desc: s.site_desc,
    site_avatar: s.site_avatar,
    site_background: s.site_background,
    site_favicon: s.site_favicon || '',
    site_theme: s.site_theme || 'wechat',
    post_preview_length: parseInt(s.post_preview_length, 10) || 500,
    post_page_size: parseInt(s.post_page_size, 10) || 10,
    admin_path: s.admin_path || 'admin',
  });
});

module.exports = router;
