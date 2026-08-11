# 朋友圈风格个人博客系统

一个仿微信朋友圈风格的个人博客：游客可浏览文章、点赞、评论，管理员有独立后台管理内容，还能在 Obsidian 里一键把笔记发布到博客（内嵌图片自动上传）。

> 📦 **部署服务器请阅读 [DEPLOY.md](./DEPLOY.md)**（Nginx + PM2 + HTTPS + 备份的完整教程）

```
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  前台（朋友圈）  │   │  管理后台        │   │  Obsidian 插件   │
│  Vue 3 + Vite   │──▶│  /admin 路由     │──▶│  TypeScript      │
└─────────────────┘   └─────────────────┘   └─────────────────┘
          │                    │                     │
          └─────────┬──────────┴─────────────────────┘
                    ▼
        Express + SQLite (better-sqlite3)
        数据库: server/data/blog.db
        图片:   uploads/
```

## 目录结构

| 目录 | 说明 |
| --- | --- |
| `server/` | 后端：Express + SQLite，提供 REST API 与静态资源服务 |
| `frontend/` | 前端：Vue 3 + Vite，朋友圈首页 + 文章详情 + 管理后台 |
| `obsidian-plugin/` | Obsidian 插件：一键发布笔记到博客 |

## 快速开始（本地开发）

环境要求：Node.js ≥ 18

```bash
# 1. 启动后端（首次启动自动建库、建管理员账号、写入演示文章）
cd server
npm install
npm run dev          # http://localhost:51021

# 2. 另开一个终端，启动前端
cd frontend
npm install
npm run dev          # http://localhost:5173
```

浏览器打开 http://localhost:5173 查看朋友圈首页；http://localhost:5173/admin 进入管理后台。

**初始管理员账号**：`admin / admin123`（首次登录后请在「站点设置 → 账号安全」中修改密码）。

> 首次启动会在库里写入 3 篇演示文章（展示 1/4/9 宫格布局效果），可在管理后台删除。

## 功能一览

### 前台（朋友圈风格）
- 顶部个人横幅（背景图 / 头像 / 昵称 / 简介，后台可配置，圆角卡片样式）
- 朋友圈卡片：头像、昵称、**首页直接渲染完整 Markdown 正文**（内容长度后台可配，超过后显示「查看详情」跳转详情页）、图片九宫格（1/2/3/4/9 张自动布局）、位置、相对时间
  - **时间体系**：列表按**更新时间**排序；卡片与详情页同时展示「发布时间」与「更新时间」（未更新过的文章只显示发布时间）
- **主题系统**：4 套主题（青竹绿 / 落霞橙 / 海盐蓝 / 子夜·夜间模式），前台与后台右上角一键切换并各自记忆；**后台「站点设置」可配置前台与后台的默认主题**，访客未手动切换时自动加载
- **筛选**：首页支持按关键词搜索、标签、月份筛选
- **分页**：首页按页展示（每页条数后台可配，默认 10），底部上一页/下一页
- 点赞（游客可点，❤️ 计数）、评论与回复（无需注册，昵称 + 内容）
- 全屏图片查看器（左右滑动 / 箭头切换 / 双击缩放 / Esc 关闭）
- 无限滚动加载、代码高亮（夜间模式自动切换深色高亮）、文章详情页
- 移动端自适应
- **SEO**：每篇文章动态 title/description/og 标签；服务端对搜索引擎爬虫返回预渲染 HTML（含完整正文）；自动生成 `sitemap.xml` 与 `robots.txt`

### 管理后台（`/admin`）
- 登录（JWT，365 天有效），**响应式布局**：窄屏侧边栏自动收起为抽屉菜单
- **入口隐藏**：前台不显示后台入口按钮，只能通过地址访问（默认 `/admin`，**路径可在后台「站点设置」自定义**，如 `/manage`，修改后旧路径立即失效）
- 仪表盘：文章 / 草稿 / 评论 / 点赞统计
- 文章管理：搜索、标签 / 月份筛选、分页、新建 / 编辑（Markdown 编辑 + 预览 + 插入图片）、发布 / 下架、删除
  - **📥 导入**：直接上传 `.md` 文件或 Obsidian 导出/任意包含 markdown 与附件的 `.zip` 文件夹（可批量、混传）。自动解析 frontmatter（title/tags/slug/location/cover/date），zip 内附件自动上传并重写正文引用（支持 `![[wikilink]]`、`![](相对路径)`、`![](./路径)`），同 slug 重复导入为更新
  - **📤 导出（Obsidian 兼容）**：按当前筛选结果（搜索/标签/月份/状态）、或勾选指定文章（支持全选）导出为 zip。每篇文章一个文件夹：`{标题}/{标题}.md + {标题}/附件/*`，frontmatter 完整、正文图片引用重写为相对路径，导入 Obsidian 等笔记软件后可直接无损耗打开
- 评论管理：全站评论搜索与删除
- **附件管理**：上传图片统一管理（缩略图网格 / 搜索 / 复制链接 / 删除），被文章或站点引用时阻止删除并提示引用位置
- 站点设置：站点名、简介、头像、横幅背景、**前台/后台默认主题、朋友圈内容预览长度、朋友圈每页展示数量、后台访问路径**、修改密码、Obsidian 访问令牌（复制 / 重新生成）
- 主题切换（与前台同一套主题）

### Obsidian 插件
- 命令面板「发布当前笔记到博客」+ 侧边栏发送图标
- 解析 frontmatter：`title` / `tags` / `location` / `cover` / `slug`
- 自动上传正文中的内嵌图片（`![[xxx.png]]` 与相对路径 `![](...)`），替换为服务器 URL
- 按 `slug` 创建或更新文章（再次发布同 slug 的笔记即更新，不会重复建文章）
- 发布后自动在浏览器打开文章页（桌面端）；手机端显示文章链接供复制
- **支持手机端 Obsidian**：桌面和移动版均可使用；手机端请务必填写 `https://` 地址（Android 默认拦截明文 HTTP），令牌从后台「站点设置」复制

## Obsidian 插件安装

```bash
cd obsidian-plugin
npm install
npm run build        # 产出 main.js + manifest.json + styles.css
```

然后把 `main.js`、`manifest.json`、`styles.css` 三个文件复制到 Obsidian 库目录的
`.obsidian/plugins/blog-publisher/` 下，重启 Obsidian，在「设置 → 第三方插件」中启用即可。

开发时热更新（修改代码自动重新构建并复制）：

```bash
# 把 OUTDIR 换成你的库路径
OUTDIR="D:/my-vault/.obsidian/plugins/blog-publisher" npm run dev
```

### 插件配置

设置 → Blog Publisher（朋友圈博客）：
- **服务器地址**：如 `http://localhost:51021` 或 `https://blog.example.com`
- **访问令牌**：在博客管理后台「站点设置 → Obsidian 发布插件」复制
- **默认发布状态**：直接发布 / 存为草稿

### 笔记 frontmatter 约定

```yaml
---
title: 我的第一篇博客      # 可选，默认用文件名
slug: my-first-post       # 可选，唯一标识；同 slug 重复发布=更新文章
tags: [技术, 随笔]         # 可选
location: 书桌前           # 可选，朋友圈位置
cover: "![[cover.png]]"   # 可选，封面（URL / 文件名 / wikilink）
---
正文内容……
```

## 生产部署

> 📦 **完整教程见 [DEPLOY.md](./DEPLOY.md)**，提供两种方式：**Docker（推荐，一条命令启动）** 与传统 Nginx + PM2。

### 日常快速更新（改完代码 → 一条命令推到服务器）

项目已内置一键部署脚本（`deploy/` 目录）：

```bash
# 本地（Git Bash / macOS / Linux）：
# 首次部署请先按 DEPLOY.md 完成，之后每次改完代码只需：
./deploy/push.sh root@1.2.3.4          # 打包→上传→服务器自动构建并重启
# 自定义端口/目录：
./deploy/push.sh root@1.2.3.4 22 /var/www/myblog
```

自动排除依赖/数据库/上传图片/构建产物/`.env`（**不会覆盖服务器上的数据和配置**），并自动识别 Docker 或 PM2 方式重启。

> 如果使用 git 远程仓库，服务器上执行 `./deploy/update.sh` 即可（git pull + 构建 + 重启）。

### Docker 方式（推荐）

```bash
# 服务器安装 Docker 后，上传代码，配置 server/.env（JWT_SECRET / 密码），然后：
docker compose up -d --build
```

镜像已内置多阶段构建（前端构建 → 后端运行）与国内网络适配（npmmirror 源 + better-sqlite3 编译兜底），数据持久化在 `./server/data` 与 `./uploads`。

### 传统方式（Nginx + PM2）

```bash
# 1. 构建前端
cd frontend && npm install && npm run build

# 2. 启动后端（会自动托管 frontend/dist，单进程即可对外服务）
cd ../server && npm install
cp .env.example .env      # 修改 JWT_SECRET、管理员密码
npm start                 # 监听 51021 端口
```

- 服务器建议使用 PM2 守护：`pm2 start src/index.js --name myblog`
- 用 Nginx 反代：`location / { proxy_pass http://127.0.0.1:51021; }`（并配置 HTTPS）
- 数据都在 `server/data/blog.db` 与 `uploads/`，备份这两个目录即可
- 如需 Docker 化，可自行编写 `Dockerfile`（node:18-alpine + 三个目录 + npm ci）

## API 概览

公开接口：
- `GET /api/site` 站点信息
- `GET /api/posts?page=&pageSize=` 已发布文章分页
- `GET /api/posts/:id` 文章详情
- `POST /api/posts/:id/like` 点赞/取消 `{action: like|unlike}`
- `GET /api/posts/:id/comments` 评论列表
- `POST /api/posts/:id/comments` 发表评论 `{nickname, content, parent_id?}`

管理接口（JWT，`Authorization: Bearer <token>`）：
- `POST /api/auth/login` 登录
- `GET /api/admin/stats` · `GET|POST|PUT|DELETE /api/admin/posts` · `PUT /api/admin/posts/:id/status`
- `GET|DELETE /api/admin/comments` · `GET|PUT /api/admin/settings` · `PUT /api/admin/password`
- `POST /api/upload` 图片上传（multipart 字段 `file`）

插件接口（JWT 或 Obsidian 令牌）：
- `POST /api/obsidian/posts` 按 slug 创建/更新文章

## 安全说明

针对个人博客常见风险内置的防护：

| 风险 | 防护措施 |
| --- | --- |
| 恶意刷评论 / 刷赞 / 暴力破解密码 | 内存滑动窗口限流：评论 10 条/分钟/IP、点赞 20 次/分钟/IP、登录 5 次/分钟/IP，超限返回 429 |
| SQL 注入 | 全部使用 better-sqlite3 参数化查询 |
| 评论 XSS | 评论内容经 Vue 自动转义渲染（纯文本），不解析 HTML |
| 上传攻击 | 仅允许图片类型（png/jpg/gif/webp/svg 等）+ 10MB 大小限制 + 随机文件名 + 接口需令牌 |
| 接口越权 | 管理接口全部要求 JWT；上传/插件接口要求 JWT 或 Obsidian 专用令牌 |
| 超大请求体 | JSON 请求体限制 10MB |

部署上线前建议：

1. **修改默认密码**（`admin/admin123`）：后台「站点设置 → 账号安全」或 `.env` 配置
2. **修改 `JWT_SECRET`**：复制 `.env.example` 为 `.env` 并改为随机长字符串
3. **启用 HTTPS**（推荐 Nginx 反代 + 证书）
4. Nginx 层可再叠加连接数/请求频率限制（`limit_req`），防御层更深
5. 若部署在 Nginx 反代后，设置环境变量 `TRUST_PROXY=true`，限流才能按真实客户端 IP 生效
6. 定期备份 `server/data/blog.db` 和 `uploads/` 目录

> 说明：限流器为进程内存实现，单进程部署下有效；SQLite 单文件数据库对个人博客的写入量绰绰有余，正常使用不存在性能瓶颈。

## 常见问题

- **better-sqlite3 安装失败（无 VS 编译工具链 / GitHub 被屏蔽）**：better-sqlite3 是唯一需要原生编译的依赖，默认从 GitHub Releases 下载预编译二进制。若下载失败会回退到 node-gyp 源码编译（需要 VS Build Tools）。解决办法：
  ```bash
  # 跳过安装脚本，先装好 JS 部分
  cd server && npm install --ignore-scripts
  # 从 npmmirror 镜像手动下载预编译二进制并解压（示例为 Node 18 / win32-x64）
  curl -L -o /tmp/bs3.tar.gz "https://cdn.npmmirror.com/binaries/better-sqlite3/v11.10.0/better-sqlite3-v11.10.0-node-v108-win32-x64.tar.gz"
  cd node_modules/better-sqlite3 && tar -xzf /tmp/bs3.tar.gz
  ```
  二进制文件名中的 `node-v108` 是 Node 18 的 ABI 编号（Node 20 为 `node-v115`，Node 22 为 `node-v127`），可按实际版本替换。
- **演示文章不想要**：管理后台「文章管理」里删除即可；删除后不会再次生成。
- **修改默认账号密码**：首次登录后到「站点设置 → 账号安全」修改；也可在 `.env` 中配置 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 后删除 `server/data/blog.db` 重新初始化。
