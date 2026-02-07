# Multi-Stage Build for Production-Optimized Frontend
# Stage 1: Builder - Dependencies & Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/frontend/package*.json ./apps/frontend/

# Install dependencies with cache mount for faster builds
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace=frontend

# Copy source files
COPY apps/frontend ./apps/frontend

# Build with optimizations
WORKDIR /app/apps/frontend
ENV NODE_ENV=production
RUN npm run build

# Stage 2: Production Runtime with Nginx
FROM nginx:1.25-alpine AS runner

# Security: Remove default nginx user and create custom
RUN deluser nginx && \
    addgroup -g 101 -S nginx && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx nginx

# Copy custom nginx configuration
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files
COPY --from=builder --chown=nginx:nginx /app/apps/frontend/dist /usr/share/nginx/html

# Security: Remove unnecessary files
RUN rm -rf /usr/share/nginx/html/*.map

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

EXPOSE 80

# Run as non-root user
USER nginx

CMD ["nginx", "-g", "daemon off;"]

