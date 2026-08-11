#!/bin/bash
# ============================================================
# 服务器端一键更新脚本（配合 git 远程仓库）
# 用法: 登录服务器后在项目根目录执行: ./deploy/update.sh
# 流程: git pull → 按部署方式重新构建并重启（自动识别 Docker / PM2）
# ============================================================
set -e
cd "$(dirname "$0")/.."

echo "==> [1/3] 拉取最新代码..."
git pull

if command -v docker >/dev/null 2>&1 && [ -f docker-compose.yml ]; then
  echo "==> [2/3] Docker 方式：重新构建并重启容器..."
  docker compose up -d --build
  echo "==> [3/3] 完成"
else
  echo "==> [2/3] 传统方式：构建前端..."
  cd frontend && npm install --no-audit --no-fund && npm run build
  echo "==> [3/3] 重启服务..."
  cd ../server
  npm install --omit=dev --no-audit --no-fund
  if command -v pm2 >/dev/null 2>&1; then
    pm2 restart myblog
  else
    pkill -f "node src/index.js" || true
    (npm start > /tmp/myblog.log 2>&1 &)
  fi
fi

echo ""
echo "✅ 更新完成"
