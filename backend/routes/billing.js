const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { z } = require('zod');

// ===== VALIDATION SCHEMAS =====
const settingsSchema = z.object({
  practiceName: z.string().max(200).optional(),
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  zipCode: z.string().max(20).optional(),
  city: z.string().max(100).optional(),
  taxId: z.string().max(50).optional(),
  bankName: z.string().max(100).optional(),
  iban: z.string().max(50).optional(),
  bic: z.string().max(20).optional(),
  invoiceFooter: z.string().max(1000).optional(),
  nextInvoiceNumber: z.number().int().positive().optional(),
});

const invoiceItemSchema = z.object({
  description: z.string().min(1),
  code: z.string().optional(), // GOÄ/EBM Ziffer
  factor: z.number().min(1).optional(),
  price: z.number().min(0),
});

const invoiceSchema = z.object({
  patientId: z.number().positive(),
  date: z.string(),
  dueDate: z.string(),
  items: z.array(invoiceItemSchema).min(1),
  taxRate: z.number().min(0).default(0),
  notes: z.string().optional(),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).optional(),
});

// ===== ROUTES =====

// GET /api/billing/settings - Einstellungen abrufen
router.get('/settings', authenticateToken, authorizeRole('therapist'), async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM billing_settings WHERE therapist_id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.json({});
    }
    
    const row = result.rows[0];
    res.json({
      practiceName: row.practice_name,
      addressLine1: row.address_line1,
      addressLine2: row.address_line2,
      zipCode: row.zip_code,
      city: row.city,
      taxId: row.tax_id,
      bankName: row.bank_name,
      iban: row.iban,
      bic: row.bic,
      invoiceFooter: row.invoice_footer,
      nextInvoiceNumber: row.next_invoice_number,
    });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// PUT /api/billing/settings - Einstellungen speichern
router.put('/settings', authenticateToken, authorizeRole('therapist'), async (req, res) => {
  try {
    const data = settingsSchema.parse(req.body);
    
    await db.query(
      `INSERT INTO billing_settings (
         therapist_id, practice_name, address_line1, address_line2, 
         zip_code, city, tax_id, bank_name, iban, bic, invoice_footer, next_invoice_number
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (therapist_id) DO UPDATE SET
         practice_name = EXCLUDED.practice_name,
         address_line1 = EXCLUDED.address_line1,
         address_line2 = EXCLUDED.address_line2,
         zip_code = EXCLUDED.zip_code,
         city = EXCLUDED.city,
         tax_id = EXCLUDED.tax_id,
         bank_name = EXCLUDED.bank_name,
         iban = EXCLUDED.iban,
         bic = EXCLUDED.bic,
         invoice_footer = EXCLUDED.invoice_footer,
         next_invoice_number = COALESCE(EXCLUDED.next_invoice_number, billing_settings.next_invoice_number),
         updated_at = NOW()`,
      [
        req.user.id,
        data.practiceName,
        data.addressLine1,
        data.addressLine2,
        data.zipCode,
        data.city,
        data.taxId,
        data.bankName,
        data.iban,
        data.bic,
        data.invoiceFooter,
        data.nextInvoiceNumber,
      ]
    );
    
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Ungültige Daten', details: error.errors });
    }
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET /api/billing/invoices - Rechnungen abrufen
router.get('/invoices', authenticateToken, authorizeRole('therapist'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT i.*, p.name as patient_name
       FROM invoices i
       JOIN users p ON i.patient_id = p.id
       WHERE i.therapist_id = $1
       ORDER BY i.date DESC, i.invoice_number DESC`,
      [req.user.id]
    );
    
    res.json(result.rows.map(row => ({
      id: row.id,
      patientId: row.patient_id,
      patientName: row.patient_name,
      invoiceNumber: row.invoice_number,
      date: row.date,
      dueDate: row.due_date,
      total: parseFloat(row.total),
      status: row.status,
      createdAt: row.created_at,
    })));
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/billing/invoices - Neue Rechnung erstellen
router.post('/invoices', authenticateToken, authorizeRole('therapist'), async (req, res) => {
  try {
    const data = invoiceSchema.parse(req.body);
    
    // Einstellungen laden für Rechnungsnummer
    const settingsRes = await db.query(
      'SELECT next_invoice_number FROM billing_settings WHERE therapist_id = $1',
      [req.user.id]
    );
    
    let invoiceNumber = '1000';
    if (settingsRes.rows.length > 0 && settingsRes.rows[0].next_invoice_number) {
      invoiceNumber = settingsRes.rows[0].next_invoice_number.toString();
    }
    
    // Berechnungen
    const subtotal = data.items.reduce((sum, item) => sum + item.price, 0);
    const taxAmount = subtotal * (data.taxRate / 100);
    const total = subtotal + taxAmount;
    
    // Transaktion starten
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Rechnung erstellen
      const result = await client.query(
        `INSERT INTO invoices 
         (therapist_id, patient_id, invoice_number, date, due_date, items, 
          subtotal, tax_rate, tax_amount, total, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id`,
        [
          req.user.id,
          data.patientId,
          invoiceNumber,
          data.date,
          data.dueDate,
          JSON.stringify(data.items),
          subtotal,
          data.taxRate,
          taxAmount,
          total,
          data.status || 'draft',
          data.notes,
        ]
      );
      
      // Rechnungsnummer inkrementieren
      await client.query(
        `UPDATE billing_settings SET next_invoice_number = next_invoice_number + 1 
         WHERE therapist_id = $1`,
        [req.user.id]
      );
      
      await client.query('COMMIT');
      
      res.status(201).json({ 
        success: true, 
        id: result.rows[0].id,
        invoiceNumber 
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Ungültige Daten', details: error.errors });
    }
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET /api/billing/invoices/:id - Rechnung abrufen
router.get('/invoices/:id', authenticateToken, authorizeRole('therapist'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `SELECT i.*, p.name as patient_name, p.email as patient_email,
              p.address as patient_address
       FROM invoices i
       JOIN users p ON i.patient_id = p.id
       WHERE i.id = $1 AND i.therapist_id = $2`,
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rechnung nicht gefunden' });
    }
    
    const row = result.rows[0];
    res.json({
      id: row.id,
      patientId: row.patient_id,
      patientName: row.patient_name,
      patientEmail: row.patient_email,
      patientAddress: row.patient_address,
      invoiceNumber: row.invoice_number,
      date: row.date,
      dueDate: row.due_date,
      items: row.items,
      subtotal: parseFloat(row.subtotal),
      taxRate: parseFloat(row.tax_rate),
      taxAmount: parseFloat(row.tax_amount),
      total: parseFloat(row.total),
      status: row.status,
      notes: row.notes,
      generatedHtml: row.generated_html,
    });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/billing/invoices/:id/generate - HTML generieren
router.post('/invoices/:id/generate', authenticateToken, authorizeRole('therapist'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Daten laden
    const invResult = await db.query(
      `SELECT i.*, p.name as patient_name, p.address as patient_address,
              t.name as therapist_name
       FROM invoices i
       JOIN users p ON i.patient_id = p.id
       JOIN users t ON i.therapist_id = t.id
       WHERE i.id = $1 AND i.therapist_id = $2`,
      [id, req.user.id]
    );
    
    if (invResult.rows.length === 0) {
      return res.status(404).json({ error: 'Rechnung nicht gefunden' });
    }
    
    const invoice = invResult.rows[0];
    
    // Einstellungen laden
    const settingsRes = await db.query(
      'SELECT * FROM billing_settings WHERE therapist_id = $1',
      [req.user.id]
    );
    const settings = settingsRes.rows[0] || {};
    
    // HTML generieren
    const html = generateInvoiceHtml(invoice, settings);
    
    // Speichern
    await db.query(
      'UPDATE invoices SET generated_html = $1 WHERE id = $2',
      [html, id]
    );
    
    res.json({ success: true, html });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Helper: HTML Generator
function generateInvoiceHtml(invoice, settings) {
  const formatDate = (d) => new Date(d).toLocaleDateString('de-DE');
  const formatMoney = (m) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(m);
  
  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Rechnung ${invoice.invoice_number}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 210mm; margin: 0 auto; padding: 20mm; color: #333; }
    .header { display: flex; justify-content: space-between; margin-bottom: 50px; }
    .sender { font-size: 0.8em; color: #666; margin-bottom: 10px; }
    .recipient { margin-bottom: 40px; }
    .meta { text-align: right; }
    h1 { color: #2563eb; font-size: 24px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th { text-align: left; border-bottom: 2px solid #ddd; padding: 10px; }
    td { border-bottom: 1px solid #eee; padding: 10px; }
    .totals { float: right; width: 300px; }
    .totals-row { display: flex; justify-content: space-between; padding: 5px 0; }
    .total-final { font-weight: bold; font-size: 1.2em; border-top: 2px solid #333; margin-top: 10px; padding-top: 10px; }
    .footer { margin-top: 100px; font-size: 0.8em; color: #666; border-top: 1px solid #ddd; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="sender">
        ${settings.practice_name || invoice.therapist_name}<br>
        ${settings.address_line1 || ''} ${settings.address_line2 || ''}<br>
        ${settings.zip_code || ''} ${settings.city || ''}
      </div>
    </div>
    <div class="meta">
      <strong>Rechnung Nr. ${invoice.invoice_number}</strong><br>
      Datum: ${formatDate(invoice.date)}<br>
      Fällig am: ${formatDate(invoice.due_date)}
    </div>
  </div>

  <div class="recipient">
    <strong>Empfänger:</strong><br>
    ${invoice.patient_name}<br>
    ${invoice.patient_address || ''}
  </div>

  <h1>Rechnung</h1>

  <table>
    <thead>
      <tr>
        <th>Beschreibung</th>
        <th>Faktor</th>
        <th>Betrag</th>
      </tr>
    </thead>
    <tbody>
      ${invoice.items.map(item => `
      <tr>
        <td>
          ${item.description}
          ${item.code ? `<br><small style="color:#666">GOÄ/EBM: ${item.code}</small>` : ''}
        </td>
        <td>${item.factor || 1.0}x</td>
        <td style="text-align: right">${formatMoney(item.price)}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row">
      <span>Zwischensumme:</span>
      <span>${formatMoney(invoice.subtotal)}</span>
    </div>
    ${invoice.tax_rate > 0 ? `
    <div class="totals-row">
      <span>MwSt (${invoice.tax_rate}%):</span>
      <span>${formatMoney(invoice.tax_amount)}</span>
    </div>
    ` : ''}
    <div class="totals-row total-final">
      <span>Gesamtbetrag:</span>
      <span>${formatMoney(invoice.total)}</span>
    </div>
  </div>

  <div style="clear: both"></div>

  ${invoice.notes ? `<div style="margin-top: 40px; padding: 15px; background: #f9f9f9;">${invoice.notes}</div>` : ''}

  <div class="footer">
    <p>${settings.invoice_footer || 'Vielen Dank für Ihr Vertrauen.'}</p>
    <p>
      ${settings.bank_name ? `Bank: ${settings.bank_name} | IBAN: ${settings.iban} | BIC: ${settings.bic}` : ''}<br>
      ${settings.tax_id ? `Steuernummer: ${settings.tax_id}` : ''}
    </p>
  </div>
</body>
</html>
  `;
}

module.exports = router;
