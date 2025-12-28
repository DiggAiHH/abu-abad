/**
 * PeerJS Server für WebRTC Video/Audio Calls
 * Ermöglicht P2P-Verbindungen mit Signaling
 * Quelle: PeerJS Docs (https://peerjs.com/docs/)
 */

import { ExpressPeerServer } from 'peer';
import express from 'express';
import { logger } from '../utils/logger.js';

const PEER_PORT = parseInt(process.env.PEER_SERVER_PORT || '9000');

/**
 * Startet PeerJS Signaling Server
 */
export async function startPeerServer(): Promise<void> {
  const app = express();
  
  const server = app.listen(PEER_PORT, () => {
    logger.info(`PeerJS Server läuft auf Port ${PEER_PORT}`);
  });

  const peerServer = ExpressPeerServer(server, {
    path: process.env.PEER_SERVER_PATH || '/peerjs',
    allow_discovery: false, // Sicherheit: Keine Peer-Discovery
  });

  // Connection Event Logging
  peerServer.on('connection', (client: any) => {
    logger.info('Peer verbunden', { peerId: client.id });
  });

  peerServer.on('disconnect', (client: any) => {
    logger.info('Peer getrennt', { peerId: client.id });
  });

  app.use('/peerjs', peerServer);

  // Health Check für PeerJS
  app.get('/health', (_req: express.Request, res: express.Response) => {
    res.json({ status: 'OK', service: 'PeerJS Signaling Server' });
  });
}
