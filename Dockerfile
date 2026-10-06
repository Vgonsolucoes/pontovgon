# syntax = docker/dockerfile:1

ARG NODE_VERSION=20-alpine
ARG ALPINE_VERSION=3.20
ARG BUILDKIT_CACHE_BUST=20261006_v35_cp_agents_standalone_builder_com_true_nao_quebrar_build

# ---------- DEPS ----------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
ARG BUILDKIT_CACHE_BUST
ENV CACHE_BUST=${BUILDKIT_CACHE_BUST}
RUN apk add --no-cache libc6-compat python3 make g++
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
RUN find /app/node_modules/.prisma/client -name 'libquery_engine-linux-musl*.so.node' ! -name '*openssl-3.0.x*' -delete 2>/dev/null || true
RUN ls -la /app/node_modules/.prisma/client/ 2>/dev/null || true

# ---------- BUILDER ----------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
ARG BUILDKIT_CACHE_BUST
ENV NEXT_TELEMETRY_DISABLED=1
ENV CACHE_BUST=${BUILDKIT_CACHE_BUST}
ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.prisma/client/libquery_engine-linux-musl-openssl-3.0.x.so.node
COPY --from=deps /app/node_modules ./node_modules

# === DEPLOY 30 FIX: INSTALAR OPENSSL NO BUILDER ANTES DO PRISMA GENERATE ===
# Sem openssl aqui, Prisma detecta errado → gera engine openssl-1.1.x e falha
# pois nosso ENV força PRISMA_QUERY_ENGINE_LIBRARY=openssl-3.0.x
RUN apk add --no-cache openssl ca-certificates libc6-compat \
  && echo "=== OPENSSL VERSION (BUILDER) ===" \
  && openssl version || echo "openssl nao encontrado"

# ============================================================
# INVALIDACAO CACHE LITERAL (NAO USAR ${VAR} INTERPOLACAO)
# A CADA DEPLOY ALTERAR O TEXTO ABAIXO PARA FORCAR NOVA LAYER
# ============================================================
RUN echo "LITERAL_CACHE_BUST_2026_10_06_DEPLOY_35_FINAL_RUN_CP_AGENTS_STANDALONE_COM_TRUE"

COPY . .

# DEBUG: listar arquivos page/route apos COPY
RUN echo "=== [BUILDER v27] ARQUIVOS PAGE/ROUTE APOS COPY . . ===" \
  && (find /app/app -maxdepth 5 -type f \( -name "page.tsx" -o -name "route.ts" \) 2>/dev/null | sort) \
  && echo "=== /app/app du ===" \
  && du -sh /app/app 2>/dev/null || true

# Prisma generate
RUN echo "LITERAL_PRISMA_GEN_BUST_2026_10_06_DEPLOY_35_FINAL_RUN_CP_AGENTS_STANDALONE" \
  && openssl version \
  && npx prisma generate \
  && find /app/node_modules/.prisma/client -name 'libquery_engine-linux-musl*.so.node' ! -name '*openssl-3.0.x*' -delete 2>/dev/null || true \
  && ls -la /app/node_modules/.prisma/client/ 2>/dev/null || true

ENV NEXT_BUILT=1
RUN npm run build \
  && test -f /app/.next/standalone/server.js \
  && echo "BUILD OK: Next.js standalone gerado"

RUN echo "=== DEPLOY 35 FINAL FIX NFT: cp api/agents e api/auth p/ standalone (builder) ===" \
  && mkdir -p /app/.next/standalone/.next/server/app/api 2>/dev/null || true \
  && (if [ -d /app/.next/server/app/api/agents ]; then \
       rm -rf /app/.next/standalone/.next/server/app/api/agents 2>/dev/null || true; \
       cp -R /app/.next/server/app/api/agents /app/.next/standalone/.next/server/app/api/ 2>/dev/null || true; \
       echo "NFT FIX: api/agents COPIADO builder -> standalone"; \
     fi) \
  && (cp -R /app/.next/server/app/api/auth /app/.next/standalone/.next/server/app/api/ 2>/dev/null || true) \
  && (find /app/.next/standalone/.next/server/app/api -maxdepth 5 -type f -name "route.js" 2>/dev/null | sort | head -20 || true) \
  || true

# ---------- RUNNER ----------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.prisma/client/libquery_engine-linux-musl-openssl-3.0.x.so.node

RUN apk add --no-cache ca-certificates openssl tini libc6-compat

RUN addgroup -S -g 1001 nodejs \
  && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/package-lock.json* ./
COPY --from=builder --chown=nextjs:nodejs /app/entrypoint.sh ./entrypoint.sh

# === DEPLOY 31 NFT FIX RUNTIME: Copiar api/agents ORIGINAL (sem NFT apagou) para pasta temporaria RUNNER que entrypoint.sh ira cp runtime ===
USER root
RUN mkdir -p /tmp/nft-originals \
  && echo "=== DEPLOY 31 NFT FIX: COPY api/agents e api/auth builder originais p/ /tmp/nft-originals ==="
COPY --from=builder /app/.next/server/app/api/agents /tmp/nft-originals/api-agents
RUN echo "=== /tmp/nft-originals/api-agents contents after COPY:" && find /tmp/nft-originals/api-agents -maxdepth 5 -type f 2>/dev/null | sort | head -20 || true
RUN chown -R 1001:1001 /tmp/nft-originals
USER nextjs

# Remocao final openssl 1.1
RUN find /app/node_modules/.prisma/client -name 'libquery_engine-linux-musl*.so.node' ! -name '*openssl-3.0.x*' -delete 2>/dev/null || true
RUN ls -la /app/node_modules/.prisma/client/ 2>/dev/null || true

RUN chmod +x /app/entrypoint.sh \
  && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

ENTRYPOINT ["/sbin/tini", "--", "/app/entrypoint.sh"]
CMD ["node", "server.js"]
