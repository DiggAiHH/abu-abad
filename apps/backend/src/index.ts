/**
 * Haupteinstiegspunkt für die Backend-API
 * DSGVO-konform: Alle Routen sind durch Authentifizierung geschützt
 * Sicherheit: Helmet, CORS, Rate-Limiting aktiviert
 * ENV: Validiert durch env.ts (Fail-Fast bei fehlenden Secrets)
 */

// WICHTIG: dotenv MUSS vor allen anderen Imports geladen werden
// Dev: tsx wird bereits mit --env-file gestartet. Prod: ENV kommt vom Runtime-Environment.
import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';
import authRoutes from './routes/auth.routes.js';
import appointmentRoutes from './routes/appointment.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import userRoutes from './routes/user.routes.js';
import messageRoutes from './routes/message.routes.js';
import patientMaterialsRoutes from './routes/patient-materials.routes.js';
import questionnaireRoutes from './routes/questionnaire.routes.js';
import documentRequestsRoutes from './routes/document-requests.routes.js';
import errorRoutes from './routes/error.routes.js';
import healthRoutes from './routes/health.routes.js';
import { initDatabase, getPool } from './database/init.js';
import { startPeerServer } from './services/peerServer.js';
import env from './config/env.js'; // Validiert alle ENV beim Import (nach dotenv.config())

const app = express();
const PORT = env.PORT;

// HISTORY-AWARE: Enable trust proxy for reverse proxy support (Codespaces)
app.set('trust proxy', 1);

// Security Middleware (OWASP ASVS / BSI: Secure Defaults)
// API-Service: CSP ist primär Browser-Frontend-relevant, daher deaktiviert (verhindert Fehlkonfigurationen).
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// CORS Configuration - strikt auf Frontend-URL beschränkt
const allowedOrigins = Array.isArray(env.ALLOWED_ORIGINS) ? env.ALLOWED_ORIGINS : [];
const allowedOriginSet = new Set(allowedOrigins);

function isCodespacesOrPreviewOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    return host.endsWith('.app.github.dev') || host.endsWith('.githubpreview.dev');
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Server-to-server / curl / same-origin kann origin undefined haben
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOriginSet.has(origin)) {
        return callback(null, true);
      }

      // DEV ONLY: Codespaces/Preview Domains zulassen
      if (env.NODE_ENV !== 'production' && isCodespacesOrPreviewOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Globales Rate Limiting (OWASP ASVS: Brute-Force / Abuse Prevention)
const globalRateLimitMax = Number(
  process.env.GLOBAL_RATE_LIMIT_MAX ?? (env.NODE_ENV === 'production' ? 300 : 2000)
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number.isFinite(globalRateLimitMax) && globalRateLimitMax > 0 ? globalRateLimitMax : 300,
    message: { error: 'Zu viele Anfragen. Bitte später erneut versuchen.' },
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Cookies (für HttpOnly Refresh Token)
app.use(cookieParser());

// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Inject DB pool into request context for routes
app.use((req: Request, _res: Response, next) => {
  (req as any).pool = getPool();
  next();
});

// Health Check Endpoint (unauthenticated)
app.get('/', (_req: Request, res: Response): void => {
  res.status(200).json({
    service: 'Abu-Abad Therapeuten-Plattform API',
    version: '8.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      healthReady: '/health/ready',
      healthLive: '/health/live',
      healthMetrics: '/health/metrics',
      auth: '/api/auth',
      docs: '/api/docs'
    },
    timestamp: new Date().toISOString()
  });
});

// Enhanced health check routes (Kubernetes-ready)
app.use('/health', healthRoutes);

// Legacy health check (backward compatibility)
app.get('/api/health', (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: 'connected',
    peerjs: 'running'
  });
});

// API Routes (alle authenticated via middleware)
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/patient-materials', patientMaterialsRoutes);
app.use('/api/questionnaires', questionnaireRoutes);
app.use('/api/document-requests', documentRequestsRoutes);
app.use('/api/errors', errorRoutes);

// 404 Handler für unbekannte Routes
app.use((req: Request, res: Response): void => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path
  });
});

// Global Error Handler
app.use(errorHandler);

// Initialize Database and Start Server
async function startServer(): Promise<void> {
  try {
    // ENV bereits validiert durch env.ts import (Fail-Fast)
    logger.info('✓ ENV-Variablen validiert');
    
    // Datenbankverbindung initialisieren
    await initDatabase();
    logger.info('✓ Datenbankverbindung hergestellt');

    // PeerJS Server für WebRTC starten (darf bei Port-Konflikt nicht den Backend-Start blockieren)
    const peerStarted = await startPeerServer();
    if (peerStarted) {
      logger.info('✓ PeerJS Server gestartet auf Port ' + env.PEER_PORT);
    } else {
      logger.warn('PeerJS Server nicht gestartet (Port belegt oder Fehler).');
    }

    // HISTORY-AWARE: Bind to 0.0.0.0 instead of localhost for Codespaces/Docker
    // Express Server starten
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server läuft auf Port ${PORT}`);
      logger.info(`📊 Environment: ${env.NODE_ENV}`);
      logger.info(`🌐 CORS Origins: ${env.ALLOWED_ORIGINS.join(', ')}`);
      logger.info(`🔒 Security: Helmet + Rate-Limiting aktiv`);
      logger.info(`🔗 Listening on: http://0.0.0.0:${PORT}`);
    });

    // Handle server errors
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${PORT} ist bereits belegt!`);
        process.exit(1);
      } else {
        logger.error('❌ Server-Fehler:', error);
        process.exit(1);
      }
    });
  } catch (error) {
    logger.error('❌ Server-Start fehlgeschlagen:', error);
    process.exit(1);
  }
}

// Graceful Shutdown (SIGTERM/SIGINT)
process.on('SIGTERM', () => {
  logger.info('SIGTERM Signal empfangen. Server wird heruntergefahren...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT Signal empfangen. Server wird heruntergefahren...');
  process.exit(0);
});

// Server starten (Async-Main Pattern)
startServer();
