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

# OCR deps (DSGVO-first, no external services): pdftoppm (poppler-utils) + tesseract (deu)
RUN apk add --no-cache poppler-utils tesseract-ocr tesseract-ocr-data-deu

# Copy built files
COPY --from=backend-builder /app/apps/backend/dist ./dist
COPY --from=backend-builder /app/apps/backend/package*.json ./

# Install production dependencies only
RUN npm install --omit=dev --no-audit --no-fund

EXPOSE 4000

CMD ["node", "dist/index.js"]
