/**
 * Haupteinstiegspunkt für die Backend-API
 * DSGVO-konform: Alle Routen sind durch Authentifizierung geschützt
 * Sicherheit: Helmet, CORS, Rate-Limiting aktiviert
 * ENV: Validiert durch env.ts (Fail-Fast bei fehlenden Secrets)
 */

// WICHTIG: dotenv MUSS vor allen anderen Imports geladen werden
import dotenv from 'dotenv';

// .env liegt im Workspace-Root
dotenv.config({ path: '/workspaces/abu-abad/.env' });

import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';
import authRoutes from './routes/auth.routes.js';
import appointmentRoutes from './routes/appointment.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import userRoutes from './routes/user.routes.js';
import messageRoutes from './routes/message.routes.js';
import { initDatabase } from './database/init.js';
import { startPeerServer } from './services/peerServer.js';
import env from './config/env.js'; // Validiert alle ENV beim Import (nach dotenv.config())

const app = express();
const PORT = env.PORT;

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS Configuration - strikt auf Frontend-URL beschränkt
app.use(cors({
  origin: env.ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate Limiting - Schutz vor Brute-Force (OWASP: Automated Threats)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 100, // 100 Requests pro Window
  message: 'Zu viele Anfragen von dieser IP, bitte später erneut versuchen.',
  standardHeaders: true, // RateLimit-* headers
  legacyHeaders: false, // X-RateLimit-* headers aus
});

app.use(limiter);

// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Endpoint (unauthenticated)
app.get('/health', (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes (alle authenticated via middleware)
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

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

    // PeerJS Server für WebRTC starten
    await startPeerServer();
    logger.info('✓ PeerJS Server gestartet auf Port ' + env.PEER_PORT);

    // Express Server starten
    app.listen(PORT, () => {
      logger.info(`🚀 Server läuft auf Port ${PORT}`);
      logger.info(`📊 Environment: ${env.NODE_ENV}`);
      logger.info(`🌐 CORS Origins: ${env.ALLOWED_ORIGINS.join(', ')}`);
      logger.info(`🔒 Security: Helmet + Rate-Limiting aktiviert`);
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
