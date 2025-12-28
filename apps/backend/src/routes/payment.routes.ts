/**
 * Stripe Payment Integration
 * PCI-DSS konform: Keine Kartendaten auf eigenem Server
 * Quelle: Stripe Docs (https://stripe.com/docs/payments/accept-a-payment)
 * ENV: Validiert durch env.ts (Test-Keys in Prod verboten)
 */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { query } from '../database/init.js';
import { authenticate } from '../middleware/auth';
import { createPaymentIntentSchema } from '../utils/validation.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import env from '../config/env.js';

const router = Router();

// STRIPE_SECRET_KEY ist durch env.ts garantiert vorhanden und prod-safe
const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16' // Stable API-Version (latest supported by @types/stripe)
});

/**
 * POST /api/payments/create-payment-intent
 * Erstellt Stripe Payment Intent für Terminbuchung
 */
router.post('/create-payment-intent', authenticate, async (req: Request, res: Response): Promise<void> => {
  const { pool } = await import('../config/database.js');
  const client = await pool.connect();
  try {
    const validatedData = createPaymentIntentSchema.parse(req.body);
    await client.query('BEGIN');
    
    // Idempotenz: Prüfe, ob PaymentIntent für diesen Termin schon existiert
    const existingPaymentCheck = await client.query(
      `SELECT id FROM payments WHERE appointment_id = $1 AND status = 'succeeded'`,
      [validatedData.appointmentId]
    );
    
    if (existingPaymentCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      client.release();
      res.status(409).json({ error: 'Zahlung für diesen Termin existiert bereits.' });
      return;
    }
    // Prüfe ob Termin existiert und Patient berechtigt ist (mit Locking)
    const appointment = await client.query<{
      id: string;
      patient_id: string;
      therapist_id: string;
      price: number;
      status: string;
    }>(
      `SELECT id, patient_id, therapist_id, price, status 
       FROM appointments 
       WHERE id = $1
       FOR UPDATE`,
      [validatedData.appointmentId]
    );
    if (!appointment.rows || appointment.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new AppError('Termin nicht gefunden', 404);
    }
    const apt = appointment.rows[0];
    if (apt.patient_id !== req.user!.userId) {
      await client.query('ROLLBACK');
      throw new AppError('Nicht autorisiert für diesen Termin', 403);
    }

    if (apt.status !== 'booked') {
      await client.query('ROLLBACK');
      throw new AppError('Termin kann nicht bezahlt werden', 400);
    }
    
    // Validiere Amount gegen Appointment Price
    if (Math.abs(validatedData.amount - apt.price) > 0.01) {
      await client.query('ROLLBACK');
      throw new AppError('Betrag stimmt nicht mit Terminpreis überein', 400);
    }

    // Prüfe ob bereits ein Payment für diesen Termin existiert
    const duplicatePaymentCheck = await client.query(
      `SELECT id FROM payments 
       WHERE appointment_id = $1 
       AND status IN ('pending', 'succeeded')`,
      [apt.id]
    );

    if (duplicatePaymentCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      client.release();
      throw new AppError('Für diesen Termin existiert bereits eine Zahlung', 409);
    }

    // Betrag in Cents (Stripe benötigt kleinste Währungseinheit)
    const amount = Math.round(validatedData.amount * 100);
    
    // Idempotency Key für Stripe
    const idempotencyKey = `payment_${apt.id}_${Date.now()}`;

    // Erstelle Payment Intent mit Idempotency
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'eur',
      metadata: {
        appointmentId: apt.id,
        patientId: apt.patient_id,
        therapistId: apt.therapist_id
      },
      automatic_payment_methods: {
        enabled: true
      }
    }, {
      idempotencyKey
    });

    // Speichere Payment in DB
    await client.query(
      `INSERT INTO payments (
        appointment_id, patient_id, therapist_id,
        stripe_payment_intent_id, amount, currency, status
      ) VALUES ($1, $2, $3, $4, $5, 'EUR', 'pending')`,
      [apt.id, apt.patient_id, apt.therapist_id, paymentIntent.id, validatedData.amount]
    );
    
    await client.query('COMMIT');
    
    logger.info('Payment Intent created', { 
      appointmentId: apt.id, 
      paymentIntentId: paymentIntent.id 
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    await client.query('ROLLBACK');
    
    logger.error('Fehler beim Erstellen des Payment Intent:', {
      error,
      userId: req.user?.userId,
      body: req.body
    });
    
    throw error;
  } finally {
    client.release();
  }
});

/**
 * POST /api/payments/webhook
 * Webhook-Endpoint für Stripe Events
 * WICHTIG: Muss ohne Authentication sein!
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    logger.error('STRIPE_WEBHOOK_SECRET nicht konfiguriert');
    res.status(400).send('Webhook-Secret fehlt');
    return;
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    logger.error('Webhook-Signatur ungültig:', err);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Handle Event
  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // Update Payment Status
        await query(
          `UPDATE payments 
           SET status = 'succeeded', paid_at = CURRENT_TIMESTAMP
           WHERE stripe_payment_intent_id = $1`,
          [paymentIntent.id]
        );

        // Update Appointment Payment Status
        const appointmentId = paymentIntent.metadata.appointmentId;
        if (appointmentId) {
          await query(
            `UPDATE appointments 
             SET payment_status = 'paid'
             WHERE id = $1`,
            [appointmentId]
          );
        }

        logger.info('Payment succeeded', { paymentIntentId: paymentIntent.id });
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        await query(
          `UPDATE payments 
           SET status = 'failed'
           WHERE stripe_payment_intent_id = $1`,
          [paymentIntent.id]
        );

        logger.warn('Payment failed', { paymentIntentId: paymentIntent.id });
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        
        await query(
          `UPDATE payments 
           SET status = 'refunded', refunded_at = CURRENT_TIMESTAMP
           WHERE stripe_charge_id = $1`,
          [charge.id]
        );

        logger.info('Payment refunded', { chargeId: charge.id });
        break;
      }

      default:
        logger.debug('Unhandled event type', { type: event.type });
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Fehler bei Webhook-Verarbeitung:', error);
    res.status(500).send('Webhook-Verarbeitung fehlgeschlagen');
  }
});

/**
 * GET /api/payments/my
 * Zeigt eigene Zahlungen
 */
router.get('/my', authenticate, async (req: Request, res: Response) => {
  try {
    const { role, userId } = req.user!;
    const field = role === 'patient' ? 'patient_id' : 'therapist_id';

    const result = await query(
      `SELECT 
        p.id, p.amount, p.currency, p.status,
        p.paid_at, p.created_at,
        a.start_time, a.end_time
      FROM payments p
      LEFT JOIN appointments a ON p.appointment_id = a.id
      WHERE p.${field} = $1
      ORDER BY p.created_at DESC`,
      [userId]
    );

    res.json({
      payments: result.rows
    });
  } catch (error) {
    throw error;
  }
});

/**
 * POST /api/payments/:id/refund
 * Therapeut kann Zahlung erstatten
 */
router.post('/:id/refund', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'therapist') {
      throw new AppError('Nur Therapeuten können Erstattungen vornehmen', 403);
    }

    const { id } = req.params;

    const payment = await query<{
      stripe_payment_intent_id: string;
      therapist_id: string;
      status: string;
    }>(
      'SELECT stripe_payment_intent_id, therapist_id, status FROM payments WHERE id = $1',
      [id]
    );

    if (payment.rows.length === 0) {
      throw new AppError('Zahlung nicht gefunden', 404);
    }

    const pmt = payment.rows[0];

    if (pmt.therapist_id !== req.user!.userId) {
      throw new AppError('Keine Berechtigung', 403);
    }

    if (pmt.status !== 'succeeded') {
      throw new AppError('Zahlung kann nicht erstattet werden', 400);
    }

    // Stripe Refund
    const refund = await stripe.refunds.create({
      payment_intent: pmt.stripe_payment_intent_id
    });

    logger.info('Refund erstellt', { refundId: refund.id });

    res.json({
      message: 'Erstattung erfolgreich',
      refundId: refund.id
    });
  } catch (error) {
    throw error;
  }
});

export default router;
