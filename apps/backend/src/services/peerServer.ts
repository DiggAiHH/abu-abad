/**
 * PeerJS Server für WebRTC Video/Audio Calls
 * Ermöglicht P2P-Verbindungen mit Signaling
 * Quelle: PeerJS Docs (https://peerjs.com/docs/)
 */

import { ExpressPeerServer } from 'peer';
import express from 'express';
import { logger } from '../utils/logger.js';
import env from '../config/env.js';

/**
 * Startet PeerJS Signaling Server
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

  // Connection Event Logging
  peerServer.on('connection', (client: any) => {
    logger.info('Peer verbunden', { peerId: client.id });
  });

  peerServer.on('disconnect', (client: any) => {
    logger.info('Peer getrennt', { peerId: client.id });
  });

  app.use(peerPath, peerServer);

  // Health Check für PeerJS
  app.get('/health', (_req: express.Request, res: express.Response) => {
    res.json({ status: 'OK', service: 'PeerJS Signaling Server' });
  });

  return true;
}
