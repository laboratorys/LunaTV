# ---- 第 1 阶段：安装依赖 ----
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
# 复制包括.git目录（需确保.dockerignore未排除.git）
COPY . .
# 仅保留依赖清单文件（减少后续层大小）
RUN rm -rf !("package.json"|"pnpm-lock.yaml")
RUN pnpm install --frozen-lockfile

# ---- 第 2 阶段：构建项目 ----
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
# 复制依赖和.git目录
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/.git ./.git
COPY . .
ENV DOCKER_ENV=true
RUN pnpm run build

# ---- 第 3 阶段：生成运行时镜像 ----
FROM node:20-alpine AS runner
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV DOCKER_ENV=true

# 复制运行时文件（不包含.git）
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/start.js ./start.js
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "start.js"]