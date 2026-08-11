const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'blog.db');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  obsidian_token TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  cover      TEXT NOT NULL DEFAULT '',
  images     TEXT NOT NULL DEFAULT '[]',
  tags       TEXT NOT NULL DEFAULT '[]',
  location   TEXT NOT NULL DEFAULT '',
  slug       TEXT NOT NULL UNIQUE,
  status     INTEGER NOT NULL DEFAULT 1,
  is_pinned  INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL,
  nickname   TEXT NOT NULL,
  content    TEXT NOT NULL,
  parent_id  INTEGER,
  status     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
`);

// 已有数据库迁移：补充新字段（is_pinned 置顶）
const postCols = db.prepare('PRAGMA table_info(posts)').all().map((c) => c.name);
if (!postCols.includes('is_pinned')) {
  db.exec('ALTER TABLE posts ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0');
  console.log('[db] 已迁移：posts 表新增 is_pinned 字段');
}

// 首次启动创建管理员账号
const adminCount = db.prepare('SELECT COUNT(*) AS c FROM admin').get().c;
if (adminCount === 0) {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const hash = bcrypt.hashSync(password, 10);
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO admin (username, password_hash, obsidian_token) VALUES (?, ?, ?)').run(username, hash, token);
  console.log(`[db] 已创建管理员账号：${username} / ${password}（首次登录后请尽快修改）`);
}

// 站点默认设置
const DEFAULT_SETTINGS = {
  site_title: '我的朋友圈',
  site_desc: '记录生活与思考',
  site_avatar: '',
  site_background: '',
  site_favicon: '',          // 浏览器地址栏图标（留空则用站点头像，再为空则用内置图标）
  site_theme: 'wechat',        // 前台默认主题
  admin_theme: 'wechat',       // 后台默认主题
  post_preview_length: '500',  // 朋友圈内容展示最大字符数，超长显示"查看详情"
  post_page_size: '10',        // 朋友圈每页展示数量
  admin_path: 'admin',         // 后台访问路径（如 admin → /admin；仅字母数字下划线连字符）
};
const setStmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) setStmt.run(k, v);

// 首启动种子数据（演示用，可在管理后台删除）
const postCount = db.prepare('SELECT COUNT(*) AS c FROM posts').get().c;
if (postCount === 0) {
  const t = nowIso();
  const insertPost = db.prepare(`INSERT INTO posts
    (title, content, cover, images, tags, location, slug, status, like_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`);
  const insertComment = db.prepare(`INSERT INTO comments (post_id, nickname, content, parent_id, status, created_at) VALUES (?, ?, ?, ?, 1, ?)`);

  const seed = db.transaction(() => {
    const img = (seed) => `https://picsum.photos/seed/${seed}/800/600`;

    const p1 = insertPost.run(
      '你好，世界 🌍',
      '这是我的第一篇博客。\n\n这个博客系统支持 **Markdown** 语法，风格参考了微信朋友圈。\n\n- 发布文章\n- 游客评论\n- Obsidian 一键发布\n\n![一张图片](' + img('hello') + ')',
      img('hello'), JSON.stringify([img('hello')]), JSON.stringify(['随笔', '公告']), '', 'hello-world', 12, t, t
    );
    const p2 = insertPost.run(
      '用 Obsidian 写作的日常',
      '日常用 **Obsidian** 管理笔记，写完直接发布到博客，图片会自动上传。\n\n来看看四张图的布局效果：\n\n![a](' + img('a') + ') ![b](' + img('b') + ') ![c](' + img('c') + ') ![d](' + img('d') + ')',
      img('a'), JSON.stringify([img('a'), img('b'), img('c'), img('d')]), JSON.stringify(['Obsidian']), '书桌前', 'obsidian-writing', 8, t, t
    );
    insertPost.run(
      '九宫格之美',
      '微信朋友圈的九宫格布局，9 张图的效果：\n\n' + Array.from({ length: 9 }, (_, i) => `![img${i}](${img('grid' + i)})`).join(' '),
      img('grid0'), JSON.stringify(Array.from({ length: 9 }, (_, i) => img('grid' + i))), JSON.stringify(['摄影']), '', 'nine-grid', 5, t, t
    );

    insertComment.run(p1.lastInsertRowid, '小明', '沙发！恭喜开站 🎉', null, t);
    const c2 = insertComment.run(p1.lastInsertRowid, '小红', '博客很好看，期待更多内容~', null, t);
    insertComment.run(p1.lastInsertRowid, '小明', '回复一下试试', c2.lastInsertRowid, t);
  });
  seed();
  console.log('[db] 已写入 3 篇演示文章，可在管理后台删除');
}

function nowIso() {
  return new Date().toISOString();
}

module.exports = db;
