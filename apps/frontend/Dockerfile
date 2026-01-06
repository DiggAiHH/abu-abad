# Frontend Dockerfile
# Vite 7 requires Node.js >= 20.19
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/frontend/package*.json ./apps/frontend/

# Install dependencies
RUN npm install

# Copy frontend source
COPY apps/frontend ./apps/frontend

# Build
WORKDIR /app/apps/frontend
RUN npm run build

# Production image with nginx
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

# Copy nginx config
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
