# ---- 第 1 阶段：安装依赖 ----
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
WORKDIR /app
# 复制整个项目（包括 .git，确保 .dockerignore 未排除）
COPY . .
# 删除除 package.json 和 pnpm-lock.yaml 外的文件
RUN find . -type f -not -name 'package.json' -not -name 'pnpm-lock.yaml' -delete && find . -type d -not -path './.git' -not -path './.git/*' -empty -delete
RUN pnpm install --frozen-lockfile

# ---- 第 2 阶段：构建项目 ----
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
WORKDIR /app
# 复制依赖和 .git 目录
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/.git ./.git
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
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

# 复制运行时文件（不包含 .git）
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/start.js ./start.js
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "start.js"]