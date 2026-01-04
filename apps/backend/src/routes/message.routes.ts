/**
 * Nachrichten-Routes (verschlüsselte Kommunikation)
 * DSGVO Art. 32: Verschlüsselung personenbezogener Daten
 */

import { Router, Request, Response } from 'express';
import { query } from '../database/init.js';
import { authenticate } from '../middleware/auth.js';
import { sendMessageSchema } from '../utils/validation.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { AppError } from '../middleware/errorHandler.js';
import { writeAuditLog } from '../utils/audit.js';

const router = Router();

function buildDisplayName(firstEncrypted: string | null, lastEncrypted: string | null): string {
  const first = firstEncrypted ? decrypt(firstEncrypted) : '';
  const last = lastEncrypted ? decrypt(lastEncrypted) : '';
  const full = `${first} ${last}`.trim();
  return full || 'Unbekannt';
}

/**
 * POST /api/messages
 * Sendet eine verschlüsselte Nachricht
 */
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const validatedData = sendMessageSchema.parse(req.body);

    // Prüfe ob Empfänger existiert
    const receiver = await query(
      'SELECT id, role FROM users WHERE id = $1',
      [validatedData.receiverId]
    );

    if (receiver.rows.length === 0) {
      throw new AppError('Empfänger nicht gefunden', 404);
    }

    // Verschlüssele Nachricht
    const contentEncrypted = encrypt(validatedData.content);

    const result = await query<{ id: string }>(
      `INSERT INTO messages (
        sender_id, receiver_id, content_encrypted, appointment_id
      ) VALUES ($1, $2, $3, $4)
      RETURNING id`,
      [
        req.user!.userId,
        validatedData.receiverId,
        contentEncrypted,
        validatedData.appointmentId || null
      ]
    );

    await writeAuditLog({
      userId: req.user!.userId,
      action: 'message.send',
      req,
      resourceType: 'message',
      resourceId: result.rows[0].id,
      metadata: {
        receiverId: validatedData.receiverId,
        appointmentId: validatedData.appointmentId ?? null,
      },
    });

    res.status(201).json({
      message: 'Nachricht gesendet',
      messageId: result.rows[0].id
    });
  } catch (error) {
    throw error;
  }
});

/**
 * GET /api/messages
 * Zeigt Nachrichten (Posteingang + Postausgang)
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { conversationWith } = req.query;

    if (conversationWith && typeof conversationWith === 'string') {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(conversationWith)) {
        throw new AppError('Ungültiger Parameter conversationWith', 400);
      }
    }

    let queryText = `
      SELECT 
        m.id, m.sender_id, m.receiver_id, 
        m.content_encrypted, m.is_read, m.read_at,
        m.created_at,
        s.role as sender_role,
        s.first_name_encrypted as sender_first_name_encrypted,
        s.last_name_encrypted as sender_last_name_encrypted,
        r.role as receiver_role,
        r.first_name_encrypted as receiver_first_name_encrypted,
        r.last_name_encrypted as receiver_last_name_encrypted
      FROM messages m
      JOIN users s ON m.sender_id = s.id
      JOIN users r ON m.receiver_id = r.id
      WHERE (m.sender_id = $1 OR m.receiver_id = $1)
    `;

    const params: any[] = [req.user!.userId];

    if (conversationWith) {
      queryText += ` AND (m.sender_id = $2 OR m.receiver_id = $2)`;
      params.push(conversationWith);
    }

    queryText += ' ORDER BY m.created_at DESC';

    const result = await query(queryText, params);

    // Entschlüssele Nachrichten
    const messages = result.rows.map((msg: any) => ({
      id: msg.id,
      sender: {
        id: msg.sender_id,
        role: msg.sender_role,
        displayName: buildDisplayName(msg.sender_first_name_encrypted, msg.sender_last_name_encrypted),
      },
      receiver: {
        id: msg.receiver_id,
        role: msg.receiver_role,
        displayName: buildDisplayName(msg.receiver_first_name_encrypted, msg.receiver_last_name_encrypted),
      },
      content: decrypt(msg.content_encrypted),
      isRead: msg.is_read,
      readAt: msg.read_at,
      createdAt: msg.created_at
    }));

    res.json({ messages });
  } catch (error) {
    throw error;
  }
});

/**
 * PATCH /api/messages/:id/read
 * Markiert Nachricht als gelesen
 */
router.patch('/:id/read', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Prüfe ob Nachricht dem User gehört
    const message = await query<{ receiver_id: string }>(
      'SELECT receiver_id FROM messages WHERE id = $1',
      [id]
    );

    if (message.rows.length === 0) {
      throw new AppError('Nachricht nicht gefunden', 404);
    }

    if (message.rows[0].receiver_id !== req.user!.userId) {
      throw new AppError('Keine Berechtigung', 403);
    }

    await query(
      `UPDATE messages 
       SET is_read = true, read_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [id]
    );

    res.json({ message: 'Nachricht als gelesen markiert' });
  } catch (error) {
    throw error;
  }
});

/**
 * GET /api/messages/conversations
 * Zeigt Liste aller Konversationen
 */
router.get('/conversations', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT DISTINCT ON (other_user_id)
        other_user_id as user_id,
        u.role,
        u.first_name_encrypted,
        u.last_name_encrypted,
        last_message_at,
        unread_count
      FROM (
        SELECT 
          CASE 
            WHEN sender_id = $1 THEN receiver_id 
            ELSE sender_id 
          END as other_user_id,
          MAX(created_at) as last_message_at,
          COUNT(*) FILTER (WHERE receiver_id = $1 AND NOT is_read) as unread_count
        FROM messages
        WHERE sender_id = $1 OR receiver_id = $1
        GROUP BY other_user_id
      ) conv
      JOIN users u ON conv.other_user_id = u.id
      ORDER BY other_user_id, last_message_at DESC`,
      [req.user!.userId]
    );

    res.json({
      conversations: result.rows.map((row: any) => ({
        userId: row.user_id,
        role: row.role,
        displayName: buildDisplayName(row.first_name_encrypted, row.last_name_encrypted),
        lastMessageAt: row.last_message_at,
        unreadCount: Number(row.unread_count ?? 0),
      }))
    });
  } catch (error) {
    throw error;
  }
});

export default router;
