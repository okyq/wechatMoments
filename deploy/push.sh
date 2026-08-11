#!/bin/bash
# ============================================================
# 本地一键部署脚本（Windows Git Bash / macOS / Linux 均可运行）
# 用法: ./deploy/push.sh user@服务器IP [SSH端口] [远程目录]
# 示例: ./deploy/push.sh root@1.2.3.4 22 /var/www/myblog
#
# 流程: 打包代码 → scp 上传 → 服务器解压 → 重新构建并重启
# 自动排除: node_modules / 数据库 / 上传图片 / 构建产物 / .env
# ============================================================
set -e

SERVER="${1:?用法: ./deploy/push.sh user@host [port] [remote_dir]}"
PORT="${2:-22}"
REMOTE_DIR="${3:-/var/www/myblog}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TARBALL="/tmp/myblog-deploy-$(date +%s).tar.gz"

echo "==> [1/4] 打包代码（排除依赖/数据/密钥）..."
tar -czf "$TARBALL" \
  --exclude='node_modules' \
  --exclude='server/node_modules' \
  --exclude='frontend/node_modules' \
  --exclude='server/data' \
  --exclude='server/.env' \
  --exclude='uploads' \
  --exclude='frontend/dist' \
  --exclude='.git' \
  --exclude='gui-test-screenshots' \
  --exclude='obsidian-plugin/main.js' \
  -C "$PROJECT_DIR" .

echo "==> [2/4] 上传到服务器 $SERVER ..."
scp -P "$PORT" "$TARBALL" "$SERVER:/tmp/myblog-deploy.tar.gz"
rm -f "$TARBALL"

echo "==> [3/4] 服务器解压覆盖代码（保留数据目录）..."
ssh -p "$PORT" "$SERVER" "cd $REMOTE_DIR && tar -xzf /tmp/myblog-deploy.tar.gz && rm /tmp/myblog-deploy.tar.gz"

echo "==> [4/4] 服务器重新构建并重启服务..."
ssh -p "$PORT" "$SERVER" "
  cd $REMOTE_DIR
  if command -v docker >/dev/null 2>&1 && [ -f docker-compose.yml ]; then
    docker compose up -d --build
  else
    cd frontend && npm install --no-audit --no-fund && npm run build
    cd ../server && npm install --omit=dev --no-audit --no-fund
    if command -v pm2 >/dev/null 2>&1; then pm2 restart myblog; else (npm start > /tmp/myblog.log 2>&1 &); fi
  fi
"

echo ""
echo "✅ 部署完成！"
echo "   访问 http://$SERVER:51021 验证（或通过 Nginx 域名访问）"
