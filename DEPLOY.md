# 部署教程（生产环境）

本教程提供两种部署方式，任选其一：

- **方式 B：Docker（推荐）** — 环境一致、一条命令启动、升级方便（见下文「方式 B」）
- **方式 A：传统部署** — Nginx + PM2，适合不想用 Docker 的服务器（见第 1~14 节）

本教程以 **Ubuntu 22.04 LTS** 为例，其他 Linux 发行版操作类似。

## 目录

0. [方式 B：Docker 部署](#方式-bdocker-部署)
1. [服务器准备](#1-服务器准备)
2. [安装环境](#2-安装环境)
3. [上传代码](#3-上传代码)
4. [安装依赖](#4-安装依赖)
5. [配置环境变量](#5-配置环境变量)
6. [构建前端并首次启动](#6-构建前端并首次启动)
7. [PM2 守护进程](#7-pm2-守护进程)
8. [Nginx 反向代理](#8-nginx-反向代理)
9. [启用 HTTPS](#9-启用-https)
10. [防火墙与安全加固](#10-防火墙与安全加固)
11. [部署验证清单](#11-部署验证清单)
12. [备份与恢复](#12-备份与恢复)
13. [更新部署](#13-更新部署)
14. [常见问题排查](#14-常见问题排查)

---

## 方式 B：Docker 部署

> 项目已内置 `Dockerfile`（多阶段构建：前端构建 → 后端运行）与 `docker-compose.yml`。
> 镜像内已适配国内网络（npmmirror 源 + better-sqlite3 预编译镜像 + 编译工具链兜底）。

### B1. 服务器安装 Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # 把当前用户加入 docker 组
# 重新登录 SSH 后验证
docker --version
docker compose version
```

### B2. 上传代码

同[第 3 节](#3-上传代码)（git clone 或 scp），上传时排除 `node_modules`、`server/data`、`uploads`、`frontend/dist`（构建时会自动生成）。

### B3. 配置环境变量

```bash
cd /var/www/myblog/server
cp .env.example .env
nano .env
```

```ini
PORT=51021
# ★ 必改：随机生成（node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"）
JWT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# ★ 必改：强密码
ADMIN_USERNAME=admin
ADMIN_PASSWORD=请改成强密码
# 部署在 Nginx 反代后必开
TRUST_PROXY=true
# NODE_ENV 由 docker-compose.yml 自动设置，无需在此配置
```

### B4. 构建并启动

```bash
cd /var/www/myblog
docker compose up -d --build
```

首次构建需要几分钟（安装依赖 + 编译 better-sqlite3），之后增量构建很快。

### B5. 验证

```bash
docker compose ps
# STATUS 列应为 Up (healthy)

curl -s http://localhost:51021/api/site
# 应返回 {"site_title":"我的朋友圈",...}
```

### B6. Nginx 反代 + HTTPS

同[第 8 节](#8-nginx-反向代理)与[第 9 节](#9-启用-https)（代理到 `127.0.0.1:51021`，不需要 PM2）。

### B7. 更新部署

```bash
cd /var/www/myblog
git pull
docker compose up -d --build
```

### B8. 备份与恢复

数据持久化在宿主机的两个目录（与第 12 节备份脚本完全兼容）：

```bash
/var/www/myblog/server/data/    # SQLite 数据库
/var/www/myblog/uploads/        # 上传的图片
```

恢复后执行 `docker compose restart blog` 即可。

### B9. 常用命令

```bash
docker compose logs -f blog     # 查看日志
docker compose restart blog     # 重启
docker compose down             # 停止（数据保留在卷中，不会丢失）
docker compose up -d            # 重新启动
```

---

## 方式 A：传统部署（Nginx + PM2）

---

## 1. 服务器准备

**最低配置**：1 核 1G 内存、20G 磁盘（个人博客绰绰有余）

- 一台可公网访问的服务器（阿里云 / 腾讯云 / 搬瓦工 / Vultr 等均可）
- 一个域名（可选但强烈建议，HTTPS 必需）：
  - 在域名服务商处添加 **A 记录** 指向服务器 IP，如 `blog.example.com → 1.2.3.4`
- 准备好 SSH 登录方式（root 或 sudo 用户）

---

## 2. 安装环境

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js 18 LTS（NodeSource 源）
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs nginx git

# 验证
node -v   # 应输出 v18.x
npm -v
```

> **提示**：国内服务器若访问 GitHub/NodeSource 慢，可使用淘宝镜像：
> ```bash
> npm config set registry https://registry.npmmirror.com
> ```

---

## 3. 上传代码

方式一：**git**（推荐，便于以后更新）

```bash
cd /var/www
sudo git clone <你的仓库地址> myblog
sudo chown -R $USER:$USER myblog
```

方式二：**scp 直接上传**

```bash
# 在本地电脑执行（把 D:\ai\myblog 上传到服务器）
scp -r /d/ai/myblog ubuntu@1.2.3.4:/var/www/myblog
```

> 上传时排除 `node_modules`、`server/data`、`uploads`、`frontend/dist`（到服务器后重新安装/构建）。

---

## 4. 安装依赖

```bash
cd /var/www/myblog

# 后端
cd server && npm install --omit=dev

# 前端
cd ../frontend && npm install

# Obsidian 插件（可选，在本地构建后复制到 Obsidian 即可，服务器不需要）
```

**better-sqlite3 安装失败？**（服务器无法访问 GitHub 下载预编译二进制时会回退到源码编译，需要 VS Build Tools）

```bash
# 方案 A：安装编译工具链
sudo apt install -y build-essential python3

# 方案 B（推荐，国内服务器）：从 npmmirror 镜像手动下载预编译二进制
cd server
npm install --omit=dev --ignore-scripts
# 查看 Node 大版本对应的 ABI（node -p "process.versions.modules"）：
#   Node 18 → v108，Node 20 → v115，Node 22 → v127
curl -L -o /tmp/bs3.tar.gz \
  "https://cdn.npmmirror.com/binaries/better-sqlite3/v11.10.0/better-sqlite3-v11.10.0-node-v108-linux-x64.tar.gz"
cd node_modules/better-sqlite3 && tar -xzf /tmp/bs3.tar.gz
# 验证
node -e "require('better-sqlite3'); console.log('better-sqlite3 OK')"
```

---

## 5. 配置环境变量

```bash
cd /var/www/myblog/server
cp .env.example .env
nano .env
```

```ini
# 端口（Nginx 反代时保持默认 51021 即可）
PORT=51021

# ★ 必改：JWT 签名密钥（生成随机字符串，见下方命令）
JWT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 管理员账号（首次启动自动创建，之后修改请用后台「站点设置」）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=请改成强密码

# ★ 生产环境必开：隐藏错误细节
NODE_ENV=production

# 部署在 Nginx 反代后必开：让限流按真实客户端 IP 生效
TRUST_PROXY=true
```

生成随机密钥：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> 未配置 `JWT_SECRET` 时系统会自动生成并保存到 `server/data/jwt-secret`（同样安全，但显式配置更可控）。
> **请务必修改默认管理员密码**，默认 `admin/admin123` 是公开信息。

---

## 6. 构建前端并首次启动

```bash
cd /var/www/myblog/frontend
npm run build          # 产出 dist/（后端会自动托管）

cd ../server
npm start              # 首次启动自动建库、建表、创建管理员、写入演示文章
```

验证：

```bash
curl -s http://localhost:51021/api/site
# 应返回 {"site_title":"我的朋友圈",...}

curl -s -o /dev/null -w "%{http_code}\n" http://localhost:51021/
# 应返回 200（前端页面）
```

看到输出后按 `Ctrl+C` 停止，进入下一步 PM2 守护。

---

## 7. PM2 守护进程

```bash
sudo npm install -g pm2

cd /var/www/myblog/server
pm2 start src/index.js --name myblog
pm2 save                       # 保存进程列表
pm2 startup                    # 开机自启（按提示执行输出的命令）
```

常用命令：

```bash
pm2 status           # 查看状态
pm2 logs myblog      # 查看日志
pm2 restart myblog   # 重启
pm2 stop myblog      # 停止
```

---

## 8. Nginx 反向代理

```bash
sudo nano /etc/nginx/sites-available/myblog
```

```nginx
# blog.example.com 换成你的域名
server {
    listen 80;
    server_name blog.example.com;

    # 大文件上传限制（与后端 10MB 保持一致，留余量）
    client_max_body_size 15m;

    # 全局限流（纵深防御，防恶意刷）
    limit_req_zone $binary_remote_addr zone=blog_limit:10m rate=30r/s;
    limit_req zone=blog_limit burst=60 nodelay;

    location / {
        proxy_pass http://127.0.0.1:51021;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # 静态资源缓存（上传的图片 + 前端构建产物）
    location ~* \.(png|jpe?g|gif|webp|bmp|avif|css|js|svg|ico)$ {
        proxy_pass http://127.0.0.1:51021;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        expires 7d;
        add_header Cache-Control "public";
    }
}
```

启用并重载：

```bash
sudo ln -s /etc/nginx/sites-available/myblog /etc/nginx/sites-enabled/
sudo nginx -t          # 检查配置
sudo systemctl reload nginx
```

> ⚠️ 配置了 Nginx 后，**必须**在 `.env` 中设置 `TRUST_PROXY=true`，否则登录限流等会按 Nginx 内网 IP 计算，防护失效。

---

## 9. 启用 HTTPS

```bash
# 安装 certbot
sudo apt install -y certbot python3-certbot-nginx

# 自动签发证书并改写 Nginx 配置（含 HTTP→HTTPS 跳转）
sudo certbot --nginx -d blog.example.com

# 测试自动续期
sudo certbot renew --dry-run
```

完成后访问 `https://blog.example.com` 验证。

> certbot 会自动在 `systemd` 中注册续期任务，无需额外配置。

---

## 10. 防火墙与安全加固

```bash
# UFW 防火墙（先开放 SSH，再开 80/443）
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

**加固清单**（对照检查）：

| 项目 | 状态 |
| --- | --- |
| 修改默认管理员密码 | 后台「站点设置 → 账号安全」 |
| `.env` 配置随机 `JWT_SECRET` | ✅ 教程第 5 步 |
| `NODE_ENV=production` | ✅ 隐藏错误细节 |
| `TRUST_PROXY=true`（Nginx 反代时） | ✅ 限流按真实 IP |
| 禁用服务器 root 密码登录，改用密钥 | `sudo nano /etc/ssh/sshd_config` → `PermitRootLogin prohibit-password` |
| 定期备份（见第 12 步） | 建议 cron 定时 |
| 服务器 51021 端口不对公网开放 | 防火墙只开 80/443，Nginx 反代 127.0.0.1:51021 |

**内置安全机制**（系统自带，无需配置）：
- 评论限流 10 条/分钟/IP、登录限流 5 次/分钟/IP、点赞限流 20 次/分钟/IP（超限 429）
- SQL 注入防护（全参数化查询）
- 评论 XSS 防护（自动转义）
- 上传防护：仅图片白名单 + 文件魔数校验 + 10MB 限制 + 随机文件名 + nosniff 响应头
- 管理接口 JWT 鉴权 + 令牌随机化
- 附件删除防目录穿越

---

## 11. 部署验证清单

部署完成后逐项验证：

```bash
# 1. 前台可访问
curl -I https://blog.example.com
# 2. API 正常
curl -s https://blog.example.com/api/site
# 3. SEO 文件
curl -s https://blog.example.com/sitemap.xml | head
curl -s https://blog.example.com/robots.txt
# 4. 爬虫预渲染（Googlebot UA）
curl -s -A "Googlebot" https://blog.example.com/post/1 | grep "<title>"
# 5. 图片上传正常（后台发一篇文章带图）
# 6. 管理后台登录正常
# 7. 恶意请求被拦截
curl -s -X POST https://blog.example.com/api/auth/login \
  -H "Content-Type: application/json" -d '{"username":"admin","password":"wrong"}' \
  -w "\n%{http_code}\n"    # 连试 6 次，第 6 次应返回 429
```

---

## 12. 备份与恢复

**需要备份的数据**（都在 `server/` 下）：

```bash
/var/www/myblog/server/data/       # SQLite 数据库（blog.db + jwt-secret）
/var/www/myblog/uploads/           # 上传的图片
```

**一键备份脚本**（保存为 `/var/www/backup-blog.sh`）：

```bash
#!/bin/bash
# 每日备份：保留最近 7 份
BACKUP_DIR=/var/backups/myblog
mkdir -p $BACKUP_DIR
DATE=$(date +%Y%m%d-%H%M)
cd /var/www/myblog
tar -czf $BACKUP_DIR/blog-$DATE.tar.gz server/data uploads
find $BACKUP_DIR -name "blog-*.tar.gz" -mtime +7 -delete
echo "备份完成: $BACKUP_DIR/blog-$DATE.tar.gz"
```

```bash
chmod +x /var/www/backup-blog.sh
# 每天凌晨 3 点备份
(crontab -l 2>/dev/null; echo "0 3 * * * /var/www/backup-blog.sh") | crontab -
```

**恢复**：

```bash
cd /var/www/myblog
# 停止服务
pm2 stop myblog
# 解压备份（覆盖 server/data 和 uploads）
tar -xzf /var/backups/myblog/blog-xxxx.tar.gz
# 重启
pm2 start myblog
```

---

## 13. 更新部署

```bash
cd /var/www/myblog
git pull                # 拉取最新代码
cd server && npm install --omit=dev
cd ../frontend && npm install && npm run build
pm2 restart myblog
```

---

## 14. 常见问题排查

| 现象 | 排查 |
| --- | --- |
| Docker 构建很慢 / better-sqlite3 编译报错 | 国内服务器 `apt` 换国内源（如清华/阿里）后重新 `docker compose build --no-cache`；构建机网络受限时 Dockerfile 已内置 npmmirror 源与编译兜底，耐心等待首次构建即可 |
| 容器起来了但健康检查失败 | `docker compose logs blog` 查看启动日志；确认 `server/.env` 存在且 `PORT=51021` |
| 页面 502 Bad Gateway | 后端没启动：`pm2 status`；或端口不对：`curl localhost:51021` |
| 登录后马上被限流 429 | `.env` 忘开 `TRUST_PROXY=true`（Nginx 场景） |
| 图片上传 413 | Nginx `client_max_body_size` 未配置或过小 |
| 上传成功但图片打不开 | 确认 `uploads/` 目录权限：`chown -R $USER:$USER uploads` |
| 页面白屏 | 前端未构建：`cd frontend && npm run build` |
| 修改了 .env 不生效 | 必须 `pm2 restart myblog` |
| 时区问题（发布时间差 8 小时） | 服务器时区：`sudo timedatectl set-timezone Asia/Shanghai` |
| HTTPS 证书不自动续 | `sudo systemctl status certbot.timer`；`sudo certbot renew --dry-run` |

---

**相关文档**：[README.md](./README.md)（功能说明）| [安全说明](./README.md#安全说明)
