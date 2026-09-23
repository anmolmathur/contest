# Multi-stage Dockerfile for Next.js 16 Application
#
# Base image is a build arg so each environment can pick its registry:
#   TeamLease AWS (prod):  --build-arg NODE_IMAGE=163742846785.dkr.ecr.ap-south-1.amazonaws.com/node-20-alpine@sha256:1565ec2a76d08d442a300c142d9e513e51a76acbfca3c67ca385ab76bc9b9a1f
#   Hetzner / local:       default public node:20-alpine
ARG NODE_IMAGE=node:20-alpine
FROM ${NODE_IMAGE} AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Configure npm for better network resilience
RUN npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 5 && \
    npm config set fetch-timeout 300000

# Install dependencies with retry logic.
# `--legacy-peer-deps` is needed because next-auth@5 beta declares a peer
# on nodemailer@7 which npm's strict resolver doesn't like when we also
# add it as a direct dependency for the notifications engine.
RUN npm ci --legacy-peer-deps || npm ci --legacy-peer-deps || npm ci --legacy-peer-deps

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Dummy DATABASE_URL for build time (actual URL provided at runtime).
# Never put a real credential here — it is baked into image layers.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
ENV AUTH_SECRET="build-time-secret-will-be-replaced-at-runtime"
ENV NEXTAUTH_URL="http://localhost:3000"

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Local upload storage (used when AWS_S3_BUCKET is not set). Mount a volume
# here so uploaded decks/screenshots survive redeploys.
ENV UPLOADS_DIR=/app/uploads
RUN mkdir -p /app/uploads

# Set permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

