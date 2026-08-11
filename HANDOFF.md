# 🤝 项目交接文档（AI 接手指南）

> 本文档写给接替开发的 AI 助手。**先读这份文档，再读 README.md 和 DEPLOY.md**。
> 最后更新：2026-08-11

---

## 1. 项目一句话

**朋友圈风格个人博客**：前台仿微信朋友圈（卡片流 + 点赞 + 评论回复），带独立管理后台，支持 Obsidian 插件一键发布、Markdown 导入导出、多主题、SEO、Docker 部署。

## 2. 环境与账号（⚠️ 最重要，先记住）

| 项 | 值 | 备注 |
|---|---|---|
| 本地路径 | `D:\ai\myblog` | Windows + Git Bash 环境 |
| **后端端口** | **51021** | 全局统一（代码默认值、.env、compose、Dockerfile、文档均已改，**不要再改回 3000**） |
| **后台路径** | **`/hahaha`** | 用户自定义（数据库 settings.admin_path），访问 `http://localhost:51021/hahaha/login`；**前台上无入口按钮，只能地址访问**；路径可在后台设置页改 |
| 本地管理员 | `admin / admin123` | 生产部署后必须已改强密码（服务器 .env 配置） |
| GitHub | `okyq/wechatMoments`（main 分支） | 已配置 credential.helper=manager，**用户已授权 AI 直接推送**（先 git status 检查再推） |
| npm registry | npmmirror（`registry.npmmirror.com`） | 本机 GitHub Releases 被墙，better-sqlite3 预编译下载失败，见 §8 坑 |
| 当前数据 | 14 篇文章、16 条评论、0 置顶 | SQLite 单文件 `server/data/blog.db` |

## 3. 架构总览

```
frontend/  Vue 3 + Vite（SPA，生产构建后由 server 托管 dist/）
server/    Express + better-sqlite3（REST API + 静态托管 + SEO 预渲染）
obsidian-plugin/  Obsidian 插件（TypeScript，独立构建，发布笔记到 /api/obsidian）
deploy/    一键部署脚本（push.sh 本地推送 / update.sh 服务器更新）
uploads/   上传的图片（项目根目录，静态服务 /uploads）
```

**关键流程**：前端启动时 `main.js → bootstrap()` 先请求 `/api/site`（拿后台路径、默认主题、favicon），**再动态注册路由并挂载应用**（`router.js` 是工厂函数 `createAppRouter(adminPath)`）。

## 4. 核心设计决策（改代码前必读）

### 4.1 后台路径动态化
- 后台路径存 `settings.admin_path`（当前 `hahaha`），所有后台链接**必须用 `utils/admin.js` 的 `adminUrl('/xxx')`**，禁止硬编码 `/admin/xxx`
- `api/index.js` 的 401 拦截也用 `isAdminPath()` 判断
- 修改路径的后端校验：`/^[a-zA-Z0-9_-]{2,30}$/`（admin.js PUT /settings）

### 4.2 主题系统（4 套 + 前后台独立）
- `styles/main.css` 顶部用 CSS 变量定义 4 套主题：`wechat`（默认）/ `sunset` / `ocean` / `night`（夜间）
- 切换：`utils/theme.js`，作用域 `site` / `admin` 各自记忆（localStorage `blog_theme_site` / `blog_theme_admin`）
- 默认主题由后台配置（`site_theme` 前台 / `admin_theme` 后台），用户未手动选择时生效
- **所有组件颜色必须用 `var(--xxx)`**，不得写死颜色（历史教训：管理后台曾被 #app 的 680px 窄栏限制，用 `body.admin-body` 解除）
- 夜间模式代码高亮覆盖写在 main.css `[data-theme='night']` 段

### 4.3 时间体系
- 前台列表**按更新时间排序**（`ORDER BY is_pinned DESC, updated_at DESC, id DESC`）
- 卡片/详情页同时显示「发布时间 + 更新时间」（未更新只显示发布时间，`updated_at !== created_at` 判断）
- 导出 frontmatter 带 `date`（创建）+ `updated`（更新）两个字段，导入时恢复

### 4.4 其他设置项（settings 表，后台可配）
`post_page_size`（首页分页，默认 10）、`post_preview_length`（内容截断字符数，默认 500，超长显示「查看详情」）、`site_favicon`（地址栏图标，空则用头像）、`site_theme`/`admin_theme`、`site_avatar`/`site_background`/`site_title`/`site_desc`、`admin_path`

### 4.5 安全设计（已实现，勿削弱）
- JWT_SECRET：未配置时自动生成存 `server/data/jwt-secret`（不再有硬编码默认值）
- 限流（内存滑动窗口 `middleware/rateLimit.js`）：评论 10/min/IP、登录 5/min/IP、点赞 20/min/IP
- 上传：白名单（**无 svg**，XSS 风险）+ 魔数校验 `utils.checkImageMagic` + 10MB + 随机文件名；静态服务带 `nosniff`
- 错误处理：`NODE_ENV=production` 时隐藏细节；multer 超限映射 413
- `TRUST_PROXY=true`（Nginx 反代时）才信任 X-Forwarded-For
- 附件删除防目录穿越（path.basename）

### 4.6 SEO
- 前端动态 title/description/og（PostDetail 里 `updateSeo`）
- `server/src/prerender.js`：爬虫 UA 返回预渲染 HTML（markdown-it 渲染正文）；`/sitemap.xml`、`/robots.txt`、动态 `/favicon.ico`（favicon 回退链：自定义 → 头像 → 内置 SVG）

### 4.7 导入导出（Obsidian 兼容）
- `server/src/routes/transfer.js`：导出为「每篇文章一个文件夹 + 附件/ 子文件夹」的 zip；导入支持 .md 与 .zip（解析 frontmatter、重写 wikilink/相对路径图片引用、按 slug upsert 幂等）
- 附件保存也走魔数校验；导出的附件用服务器随机文件名（保证唯一）

## 5. 功能清单（全部已完成并验证）

**前台**：朋友圈卡片流（markdown 直接渲染 + 长文截断「查看详情」）、图片九宫格 1/2/3/4/9、全屏查看器（滑动/缩放/Esc）、点赞（localStorage 防重复）、游客评论+回复、置顶📌、分页、搜索/标签/月份筛选、双时间显示、骨架屏加载、4 套主题切换、移动端自适应、SEO 预渲染

**后台**（`/hahaha`）：登录（JWT 365 天）、仪表盘统计、文章 CRUD（Markdown 编辑+预览+插入图片）、发布/下架、**置顶/取消置顶**、标签/月份/状态筛选、评论管理、**附件管理**（缩略图/复制链接/删除+引用检查）、**导入/导出**（筛选/多选/全选）、站点设置（基本信息/主题/预览长度/分页大小/**后台路径**/favicon/密码/令牌）、响应式抽屉布局、主题切换

**Obsidian 插件**：命令面板 + 侧边栏图标发布、frontmatter（title/slug/tags/location/cover/date/updated）、内嵌图片自动上传并重写、同 slug 更新幂等、支持手机端（isDesktopOnly=false）

## 6. 代码约定

- 注释用中文，与现有代码风格一致（单引号、无分号、4 空格缩进——Vue/JS）
- 组件：MomentCard / ImageGrid / ImageViewer / MarkdownView / CommentList / CommentInput / ThemeSwitcher
- 后台视图在 `views/admin/`，**路由链接用 `adminUrl()`**
- 服务端新路由挂载在 `server/src/index.js`；API 前缀 `/api`
- SQLite 迁移模式：建表加字段 + `PRAGMA table_info` 检查 + `ALTER TABLE`（参考 db.js 的 is_pinned 迁移）
- settings 新键：加进 db.js 的 DEFAULT_SETTINGS（INSERT OR IGNORE 自动补）+ site.js 返回 + admin.js PUT 白名单

## 7. 常用操作

```bash
# 本地启动（生产模式，托管 frontend/dist）——注意端口 51021
cd server && npm start
# 前端开发模式（vite 代理 /api → 51021）
cd frontend && npm run dev
# 前端构建（改动前端后必须 build + 重启 server）
cd frontend && npm run build

# 测试：curl 冒烟 + 浏览器验证（本会话有 IAB 浏览器工具可用）
curl -s http://localhost:51021/api/site
# 登录拿 token：POST /api/auth/login {admin, admin123}

# 推送（用户已授权；先 git status 确认无敏感文件）
git add -A && git commit -m "说明" && git push
# 服务器更新：deploy/update.sh（git pull + docker compose up -d --build）
```

**后台地址**：`http://localhost:51021/hahaha/login`（后台登录后 UI 操作验证）
**验证清单**：前台首页（骨架→内容）、分页、筛选、置顶排序、主题切换（前后台）、评论、附件管理、导入导出往返（scripts/transfer-test.cjs 可参考）、爬虫预渲染（curl -A "Googlebot"）

## 8. 已知的坑（务必注意）

1. **better-sqlite3 安装**：本机 GitHub 被墙，`npm install` 会因预编译下载失败而编译报错。解法（README 常见问题有详版）：`npm install --ignore-scripts` + 从 `cdn.npmmirror.com/binaries/better-sqlite3` 手动下载 tar.gz 解压进 node_modules（Node 18 对应 node-v108）
2. **端口是 51021 不是 3000**：搜索 "3000" 时注意 `api/index.js` 的 `timeout: 30000` 是毫秒，不是端口
3. **后台路径是 /hahaha**：`/admin` 访问会显示首页（路由未注册，这是预期行为，不是 bug）
4. **上线前提醒用户**：服务器 .env 的 PORT、Nginx 反代端口需为 51021；部署时 .env 不会随代码同步
5. 上传不支持 svg（故意禁用）；魔数校验会拒绝伪造扩展名的文件（测试占位文件会 400）
6. 本机 `npm audit` 因网络不可用；依赖版本均为较新维护版
7. IAB 浏览器工具限制：Playwright click 偶发超时（用 dom_cua / cua 坐标点击兜底）、不支持文件上传选择器、evaluate 只读

## 9. 未来方向（用户可能的需求，未实现）

- 暂无明确待办。可考虑：RSS 订阅、文章分类、定时发布、评论通知、GitHub Actions 自动部署、多语言
- 用户当前关注点：部署上线（GitHub 推送 → 服务器 Docker）、细节打磨（最近连续提了时间显示、置顶、加载闪烁、favicon、端口、后台路径）

## 10. 交接验证清单（接替后 10 分钟内确认）

- [ ] `cd server && npm start` 后 `curl localhost:51021/api/site` 返回站点信息
- [ ] 浏览器打开 `localhost:51021/`：骨架屏 → 14 篇文章（10 条/页，共 2 页）
- [ ] `localhost:51021/hahaha/login` 用 admin/admin123 登录进后台
- [ ] `git log --oneline -3` 看到最新提交 `253822b`，`git status` 干净
- [ ] `git push` 可直达 GitHub（凭据已记住）
