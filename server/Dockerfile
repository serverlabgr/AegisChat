# Aegis API — Node 22 + Hono + PostgreSQL client
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV UPLOAD_DIR=/data/uploads

RUN apk add --no-cache tini wget libstdc++ \
  && addgroup -S aegis && adduser -S aegis -G aegis \
  && mkdir -p /data/uploads && chown -R aegis:aegis /data

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY sql ./sql
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh && chown -R aegis:aegis /app

USER aegis
EXPOSE 3001
ENTRYPOINT ["/sbin/tini", "--", "./docker-entrypoint.sh"]
