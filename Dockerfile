# syntax = docker/dockerfile:1

ARG NODE_VERSION=20-alpine
ARG ALPINE_VERSION=3.20
ARG BUILDKIT_CACHE_BUST=20261006_v28_nft_outputFileTracingIncludes_plus_manual_cp_api_agents

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

# ============================================================
# INVALIDACAO CACHE LITERAL (NAO USAR ${VAR} INTERPOLACAO)
# A CADA DEPLOY ALTERAR O TEXTO ABAIXO PARA FORCAR NOVA LAYER
# ============================================================
RUN echo "LITERAL_CACHE_BUST_2026_10_06_DEPLOY_28_NFT_MANUAL_CP_API_AGENTS_OK"

COPY . .

# DEBUG: listar arquivos page/route apos COPY
RUN echo "=== [BUILDER v27] ARQUIVOS PAGE/ROUTE APOS COPY . . ===" \
  && (find /app/app -maxdepth 5 -type f \( -name "page.tsx" -o -name "route.ts" \) 2>/dev/null | sort) \
  && echo "=== /app/app du ===" \
  && du -sh /app/app 2>/dev/null || true

# Prisma generate
RUN echo "LITERAL_PRISMA_GEN_BUST_2026_10_06_DEPLOY_27" \
  && npx prisma generate \
  && find /app/node_modules/.prisma/client -name 'libquery_engine-linux-musl*.so.node' ! -name '*openssl-3.0.x*' -delete 2>/dev/null || true \
  && ls -la /app/node_modules/.prisma/client/ 2>/dev/null || true

# Build Next.js standalone (ASSERT: .next/standalone/server.js DEVE existir no fim)
ENV NEXT_BUILT=1
RUN npm run build \
  && echo "=== [BUILDER v28] ROTAS GERADAS NO .next/server/app ===" \
  && (find /app/.next/server/app -maxdepth 6 -type f 2>/dev/null | sort | head -80 || true) \
  && echo "=== .next/standalone contents ===" \
  && ls -la /app/.next/standalone/ 2>/dev/null \
  && echo "=== BEFORE MANUAL FIX: standalone .next/server/app/api ===" \
  && (ls -laR /app/.next/standalone/.next/server/app/api 2>/dev/null || echo "--- .next/standalone/.next/server/app/api NAO EXISTE ---") \
  && echo "=== ASSERT .next/standalone/server.js EXISTE ===" \
  && test -f /app/.next/standalone/server.js \
  && echo "STANDALONE OK (server.js found)" \
  && echo "=== MANUAL NFT FIX (Garante que api/agents nao foi apagado pelo tracing no Alpine) ===" \
  && mkdir -p /app/.next/standalone/.next/server/app/api \
  && if [ -d /app/.next/server/app/api/agents ]; then \
       rm -rf /app/.next/standalone/.next/server/app/api/agents && \
       cp -R /app/.next/server/app/api/agents /app/.next/standalone/.next/server/app/api/ && \
       echo "MANUAL CP OK: api/agents copiado para standalone"; \
     else \
       echo "MANUAL CP FALHOU: /app/.next/server/app/api/agents NÃO EXISTE (npm build falhou em gerar route agents!)" 1>&2; \
       exit 1; \
     fi \
  && (cp -R /app/.next/server/app/api/auth /app/.next/standalone/.next/server/app/api/ 2>/dev/null || true) \
  && echo "=== AFTER MANUAL FIX: standalone .next/server/app/api ===" \
  && (find /app/.next/standalone/.next/server/app/api -maxdepth 5 -type f -name "route.js" 2>/dev/null | sort || true) \
  && echo "MANUAL NFT FIX DONE (api/agents garantido no standalone output!)"

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
