# Backend Dockerfile
FROM node:18-alpine AS backend-builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/

# Install dependencies
RUN npm install

# Copy backend source
COPY apps/backend ./apps/backend

# Build
WORKDIR /app/apps/backend
RUN npm run build

# Production image
FROM node:18-alpine

WORKDIR /app

# Copy built files
COPY --from=backend-builder /app/apps/backend/dist ./dist
COPY --from=backend-builder /app/apps/backend/package*.json ./

# Install production dependencies only
RUN npm ci --only=production

EXPOSE 3000 3001

CMD ["node", "dist/server.js"]
