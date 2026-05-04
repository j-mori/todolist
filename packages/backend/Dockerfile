# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/backend/package.json packages/backend/package.json
COPY packages/frontend/package.json packages/frontend/package.json
RUN npm ci --workspaces --include-workspace-root --include=dev
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/backend packages/backend
RUN npm run build --workspace=@todolist/backend

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/data/todolist.db
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/backend/package.json packages/backend/package.json
COPY packages/frontend/package.json packages/frontend/package.json
RUN npm ci --workspaces --include-workspace-root --omit=dev && npm cache clean --force
COPY packages/shared/src packages/shared/src
COPY --from=builder /app/packages/backend/dist packages/backend/dist
RUN mkdir -p /data && chown -R node:node /data
VOLUME ["/data"]
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:3000/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
WORKDIR /app/packages/backend
CMD ["node", "dist/index.js"]
