# frys 工作流管理系统 - 单架构生产镜像
FROM node:20-alpine

# 设置标签
LABEL org.opencontainers.image.title="frys" \
      org.opencontainers.image.description="企业级工作流管理系统" \
      org.opencontainers.image.vendor="frys Team" \
      org.opencontainers.image.version="1.0.0"

# 安装运行时依赖
RUN apk add --no-cache \
    curl \
    && rm -rf /var/cache/apk/*

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S frys -u 1001

# 设置工作目录
WORKDIR /app

# 复制源码文件
COPY package*.json ./
COPY pnpm-lock.yaml ./
COPY src/ ./src/
COPY config/ ./config/

# 安装生产依赖（不构建，直接运行源码）
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile --prod && \
    pnpm store prune

# 创建必要的目录
RUN mkdir -p /app/data /app/logs && \
    chown -R frys:nodejs /app

# 切换到非root用户
USER frys

# 设置环境变量
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# 启动应用
CMD ["node", "src/index-fixed.js"]