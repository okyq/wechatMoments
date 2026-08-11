# ============ 阶段 1：构建前端 ============
FROM node:18-slim AS frontend-build
WORKDIR /app/frontend
# 国内网络友好：使用 npmmirror 镜像源（可删除以使用官方源）
RUN npm config set registry https://registry.npmmirror.com
COPY frontend/package*.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ============ 阶段 2：后端运行环境 ============
FROM node:18-slim

# 安装编译工具链（better-sqlite3 预编译二进制下载失败的兜底，可源码编译）
# ca-certificates：HTTPS 请求（Obsidian 插件上传、爬虫外链）需要
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential python3 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY server/package*.json ./server/
# 国内网络友好：npmmirror 源 + better-sqlite3 预编译二进制镜像（无效则走编译兜底）
RUN npm config set registry https://registry.npmmirror.com \
    && npm config set better_sqlite3_binary_host_mirror https://cdn.npmmirror.com/binaries/better-sqlite3 \
    && cd server && npm install --omit=dev --no-audit --no-fund

COPY server/ ./server/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# 数据目录（挂载卷持久化）
RUN mkdir -p /app/server/data /app/uploads

ENV NODE_ENV=production
EXPOSE 51021

# 健康检查（无需额外安装 curl）
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:51021/api/site').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

WORKDIR /app/server
CMD ["node", "src/index.js"]
