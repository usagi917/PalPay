FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# --- deps ---
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- builder ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_RPC_URL=""
ARG NEXT_PUBLIC_CHAIN_ID=""
ARG NEXT_PUBLIC_FACTORY_ADDRESS=""
ARG NEXT_PUBLIC_TOKEN_ADDRESS=""
ARG NEXT_PUBLIC_BLOCK_EXPLORER_TX_BASE=""
ARG NEXT_PUBLIC_XMTP_ENV="dev"
ARG CHAIN_ID=""
ARG GCP_PROJECT_ID=""
ARG GCP_LOCATION="us-central1"
ARG OPENAI_MODEL="gpt-5-nano"

ENV NEXT_PUBLIC_RPC_URL=${NEXT_PUBLIC_RPC_URL} \
    NEXT_PUBLIC_CHAIN_ID=${NEXT_PUBLIC_CHAIN_ID} \
    NEXT_PUBLIC_FACTORY_ADDRESS=${NEXT_PUBLIC_FACTORY_ADDRESS} \
    NEXT_PUBLIC_TOKEN_ADDRESS=${NEXT_PUBLIC_TOKEN_ADDRESS} \
    NEXT_PUBLIC_BLOCK_EXPLORER_TX_BASE=${NEXT_PUBLIC_BLOCK_EXPLORER_TX_BASE} \
    NEXT_PUBLIC_XMTP_ENV=${NEXT_PUBLIC_XMTP_ENV} \
    CHAIN_ID=${CHAIN_ID} \
    GCP_PROJECT_ID=${GCP_PROJECT_ID} \
    GCP_LOCATION=${GCP_LOCATION} \
    OPENAI_MODEL=${OPENAI_MODEL}

RUN pnpm build

# --- runner ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
