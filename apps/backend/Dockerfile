# Multi-Stage Build for Production-Optimized Backend
# Stage 1: Builder - Dependencies & Compilation
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/

# Install ALL dependencies (including devDependencies for build)
RUN npm ci --workspace=backend --include=dev

# Copy backend source code
COPY apps/backend ./apps/backend

# Build TypeScript
WORKDIR /app/apps/backend
RUN npm run build

# Stage 2: Production Dependencies
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/

# Install ONLY production dependencies (no devDependencies)
RUN npm ci --workspace=backend --omit=dev --no-audit --no-fund && \
    npm cache clean --force

# Stage 3: Production Runtime
FROM node:20-alpine AS runner

# Security: Run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 backend

# Install runtime dependencies (OCR for GDPR-compliant document processing)
RUN apk add --no-cache \
    dumb-init \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-data-deu

WORKDIR /app

# Copy production dependencies
COPY --from=deps --chown=backend:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=backend:nodejs /app/apps/backend/node_modules ./apps/backend/node_modules

# Copy built application
COPY --from=builder --chown=backend:nodejs /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder --chown=backend:nodejs /app/apps/backend/package.json ./apps/backend/

# Environment
ENV NODE_ENV=production \
    PORT=4000

USER backend

EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health/live', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Use dumb-init to handle signals properly (SIGTERM for graceful shutdown)
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/backend/dist/index.js"]

