# ========================================================
# 🐶 PetNest Backend - Production Multi-Stage Dockerfile
# ========================================================

# 1. Base dependencies stage
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# 2. Builder stage
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig*.json nest-cli.json prisma.config.ts ./
COPY prisma ./prisma

# Generate Prisma Client
RUN npx prisma generate

# Copy application source & build
COPY src ./src
RUN npm run build

# Prune dev dependencies for lean production runner
RUN npm prune --omit=dev

# 3. Production runner stage
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl curl
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Security: run as non-root user
RUN addgroup --system --gid 1001 nestjs && \
    adduser --system --uid 1001 nestjs

# Copy artifacts from builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Set ownership
RUN chown -R nestjs:nestjs /app

USER nestjs

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:5000/ || exit 1

# Push schema if needed and launch NestJS production server
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/main"]
