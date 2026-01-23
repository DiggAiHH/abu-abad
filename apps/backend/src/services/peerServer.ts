/**
 * PeerJS Server für WebRTC Video/Audio Calls
 * Ermöglicht P2P-Verbindungen mit Signaling
 * 
 * @security DSGVO-konform: Keine PII-Logs, nur maskierte Peer-IDs
 * Quelle: PeerJS Docs (https://peerjs.com/docs/)
 */

import { ExpressPeerServer } from 'peer';
import express from 'express';
import { logger } from '../utils/logger.js';
import env from '../config/env.js';

// Rate Limiting für Signaling (Schutz vor DoS)
const connectionAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_CONNECTIONS_PER_MINUTE = 10;
const RATE_LIMIT_WINDOW_MS = 60000;

/**
 * Maskiert Peer-ID für Logging (DSGVO-konform)
 * @security Verhindert PII-Leakage in Logs
 */
function maskPeerId(peerId: string): string {
  if (!peerId || peerId.length < 8) return '***';
  return `${peerId.slice(0, 4)}...${peerId.slice(-4)}`;
}

/**
 * Prüft Rate-Limit für Peer-Verbindungen
 */
function checkRateLimit(peerId: string): boolean {
  const now = Date.now();
  const entry = connectionAttempts.get(peerId);
  
  if (!entry || (now - entry.lastAttempt) > RATE_LIMIT_WINDOW_MS) {
    connectionAttempts.set(peerId, { count: 1, lastAttempt: now });
    return true;
  }
  
  if (entry.count >= MAX_CONNECTIONS_PER_MINUTE) {
    logger.warn('PeerJS Rate-Limit erreicht', { peerId: maskPeerId(peerId) });
    return false;
  }
  
  entry.count++;
  entry.lastAttempt = now;
  return true;
}

/**
 * Startet PeerJS Signaling Server
 * @security Rate-Limiting, keine Discovery, maskierte Logs
 */
export async function startPeerServer(): Promise<boolean> {
  const peerPort = env.PEER_PORT;
  const peerPath = env.PEER_PATH;

  const app = express();
  
  const server = app.listen(peerPort, '0.0.0.0');
  let started = false;

  await new Promise<void>((resolve) => {
    server.once('listening', () => {
      started = true;
      logger.info(`PeerJS Server läuft auf Port ${peerPort} (mount: ${peerPath})`);
      resolve();
    });

    server.once('error', (error: any) => {
      if (error?.code === 'EADDRINUSE') {
        // Stabilität: PeerJS darf den gesamten Backend-Start nicht killen (Login/Auth muss laufen).
        logger.warn(`PeerJS Port ${peerPort} ist bereits belegt; PeerJS wird in dieser Session deaktiviert.`);
        resolve();
        return;
      }

      logger.error('PeerJS Server konnte nicht gestartet werden; PeerJS wird deaktiviert.', error);
      resolve();
    });
  });

  if (!started) {
    try {
      server.close();
    } catch {
      // ignore
    }
    return false;
  }

  const peerServer = ExpressPeerServer(server, {
    // Wichtig: ExpressPeerServer wird unter PEER_PATH gemountet.
    // Daher muss die interne path-Option '/' bleiben, um kein doppeltes '/peerjs/peerjs' zu erzeugen.
    path: '/',
    allow_discovery: false, // Sicherheit: Keine Peer-Discovery
  });

  // Connection Event Logging (DSGVO-konform: maskierte IDs)
  peerServer.on('connection', (client: any) => {
    if (!checkRateLimit(client.id)) {
      try { client.socket?.close(); } catch { /* ignore */ }
      return;
    }
    logger.info('Peer verbunden', { peerId: maskPeerId(client.id) });
  });

  peerServer.on('disconnect', (client: any) => {
    logger.info('Peer getrennt', { peerId: maskPeerId(client.id) });
  });

  peerServer.on('error', (error: Error) => {
    logger.error('PeerJS Fehler', { message: error.message });
  });

  app.use(peerPath, peerServer);

  // Health Check für PeerJS
  app.get('/health', (_req: express.Request, res: express.Response) => {
    res.json({ 
      status: 'OK', 
      service: 'PeerJS Signaling Server',
      connections: connectionAttempts.size 
    });
  });

  // Periodisches Cleanup der Rate-Limit Map (Memory-Leak Prevention)
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of connectionAttempts.entries()) {
      if (now - value.lastAttempt > RATE_LIMIT_WINDOW_MS * 2) {
        connectionAttempts.delete(key);
      }
    }
  }, RATE_LIMIT_WINDOW_MS);

  return true;
}
