FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --production

FROM node:22-alpine AS runner
WORKDIR /app
# Short links (src/lib/server/collections.ts); a volume in docker-compose.yaml. Created here so that the volume
# starts owned by the user the app runs as
RUN mkdir -p /data && chown node:node /data
ENV DATA_DIR=/data
USER node
COPY --from=builder --chown=node:node /app/build ./build
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000
CMD ["node", "build/index.js"]