import { Router, Request, Response } from 'express';
import { query } from '../database/init.js';
import { authenticate, requireTherapist } from '../middleware/auth.js';
import { decrypt } from '../utils/encryption.js';
import { billingSettingsSchema, invoiceCreateSchema } from '../utils/validation.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

type InvoiceItem = { description: string; code?: string; factor?: number; price: number };

function toMoney(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

router.get('/settings', authenticate, requireTherapist, async (req: Request, res: Response) => {
  const therapistId = req.user!.userId;

  const result = await query<{
    practice_name: string | null;
    address_line1: string | null;
    address_line2: string | null;
    zip_code: string | null;
    city: string | null;
    tax_id: string | null;
    bank_name: string | null;
    iban: string | null;
    bic: string | null;
    invoice_footer: string | null;
    next_invoice_number: number;
  }>(
    `SELECT
      practice_name,
      address_line1,
      address_line2,
      zip_code,
      city,
      tax_id,
      bank_name,
      iban,
      bic,
      invoice_footer,
      next_invoice_number
     FROM billing_settings
     WHERE therapist_id = $1`,
    [therapistId]
  );

  const row = result.rows[0];
  if (!row) {
    res.json({});
    return;
  }

  res.json({
    practiceName: row.practice_name ?? '',
    addressLine1: row.address_line1 ?? '',
    addressLine2: row.address_line2 ?? '',
    zipCode: row.zip_code ?? '',
    city: row.city ?? '',
    taxId: row.tax_id ?? '',
    bankName: row.bank_name ?? '',
    iban: row.iban ?? '',
    bic: row.bic ?? '',
    invoiceFooter: row.invoice_footer ?? '',
    nextInvoiceNumber: row.next_invoice_number,
  });
});

router.put('/settings', authenticate, requireTherapist, async (req: Request, res: Response) => {
  const therapistId = req.user!.userId;
  const data = billingSettingsSchema.parse(req.body);

  await query(
    `INSERT INTO billing_settings (
      therapist_id,
      practice_name,
      address_line1,
      address_line2,
      zip_code,
      city,
      tax_id,
      bank_name,
      iban,
      bic,
      invoice_footer,
      next_invoice_number
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
    )
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
      next_invoice_number = EXCLUDED.next_invoice_number`,
    [
      therapistId,
      data.practiceName ?? null,
      data.addressLine1 ?? null,
      data.addressLine2 ?? null,
      data.zipCode ?? null,
      data.city ?? null,
      data.taxId ?? null,
      data.bankName ?? null,
      data.iban ?? null,
      data.bic ?? null,
      data.invoiceFooter ?? null,
      data.nextInvoiceNumber ?? 1000,
    ]
  );

  res.json({ message: 'Einstellungen gespeichert' });
});

router.get('/invoices', authenticate, requireTherapist, async (req: Request, res: Response) => {
  const therapistId = req.user!.userId;

  const result = await query<{
    id: string;
    patient_id: string;
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    total: string;
    status: string;
    first_name_encrypted: string;
    last_name_encrypted: string;
  }>(
    `SELECT
      i.id::text as id,
      i.patient_id,
      i.invoice_number,
      i.invoice_date::text as invoice_date,
      i.due_date::text as due_date,
      i.total::text as total,
      i.status,
      u.first_name_encrypted,
      u.last_name_encrypted
     FROM invoices i
     JOIN users u ON u.id = i.patient_id
     WHERE i.therapist_id = $1
     ORDER BY i.invoice_date DESC, i.id DESC`,
    [therapistId]
  );

  const invoices = result.rows.map((r) => ({
    id: Number(r.id),
    patientId: r.patient_id,
    patientName: `${decrypt(r.first_name_encrypted)} ${decrypt(r.last_name_encrypted)}`.trim(),
    invoiceNumber: r.invoice_number,
    date: r.invoice_date,
    dueDate: r.due_date,
    total: Number(r.total),
    status: r.status,
  }));

  res.json(invoices);
});

router.post('/invoices', authenticate, requireTherapist, async (req: Request, res: Response) => {
  const therapistId = req.user!.userId;
  const data = invoiceCreateSchema.parse(req.body);

  // Ensure patient exists
  const patientRow = await query<{ id: string }>('SELECT id FROM users WHERE id = $1 AND role = $2', [data.patientId, 'patient']);
  if (patientRow.rows.length === 0) throw new AppError('Patient nicht gefunden', 404);

  // Ensure settings exist and atomically increment invoice number
  const client = await (await import('../config/database.js')).pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO billing_settings (therapist_id, next_invoice_number)
       VALUES ($1, 1000)
       ON CONFLICT (therapist_id) DO NOTHING`,
      [therapistId]
    );

    const counter = await client.query<{ next_invoice_number: number }>(
      `SELECT next_invoice_number
       FROM billing_settings
       WHERE therapist_id = $1
       FOR UPDATE`,
      [therapistId]
    );

    const nextNum = counter.rows[0]?.next_invoice_number ?? 1000;
    const invoiceNumber = String(nextNum);

    const items: InvoiceItem[] = (data.items as any) ?? [];
    const total = items.reduce((sum, it) => sum + Number(it.price ?? 0), 0);

    const inv = await client.query<{ id: number }>(
      `INSERT INTO invoices (
        therapist_id,
        patient_id,
        invoice_number,
        invoice_date,
        due_date,
        items,
        tax_rate,
        notes,
        total,
        status
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,'draft'
      ) RETURNING id`,
      [
        therapistId,
        data.patientId,
        invoiceNumber,
        data.date,
        data.dueDate,
        JSON.stringify(items),
        data.taxRate ?? 0,
        data.notes ?? null,
        total,
      ]
    );

    await client.query(
      'UPDATE billing_settings SET next_invoice_number = $1 WHERE therapist_id = $2',
      [nextNum + 1, therapistId]
    );

    await client.query('COMMIT');

    res.status(201).json({ id: inv.rows[0].id, invoiceNumber });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

router.post('/invoices/:id/generate', authenticate, requireTherapist, async (req: Request, res: Response) => {
  const therapistId = req.user!.userId;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) throw new AppError('Ungültige ID', 400);

  const settings = await query<{
    practice_name: string | null;
    address_line1: string | null;
    address_line2: string | null;
    zip_code: string | null;
    city: string | null;
    tax_id: string | null;
    bank_name: string | null;
    iban: string | null;
    bic: string | null;
    invoice_footer: string | null;
  }>(
    `SELECT
      practice_name,
      address_line1,
      address_line2,
      zip_code,
      city,
      tax_id,
      bank_name,
      iban,
      bic,
      invoice_footer
     FROM billing_settings
     WHERE therapist_id = $1`,
    [therapistId]
  );

  const invoice = await query<{
    id: string;
    patient_id: string;
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    items: any;
    tax_rate: string;
    notes: string | null;
    total: string;
    status: string;
    first_name_encrypted: string;
    last_name_encrypted: string;
  }>(
    `SELECT
      i.id::text as id,
      i.patient_id,
      i.invoice_number,
      i.invoice_date::text as invoice_date,
      i.due_date::text as due_date,
      i.items,
      i.tax_rate::text as tax_rate,
      i.notes,
      i.total::text as total,
      i.status,
      u.first_name_encrypted,
      u.last_name_encrypted
     FROM invoices i
     JOIN users u ON u.id = i.patient_id
     WHERE i.id = $1 AND i.therapist_id = $2`,
    [id, therapistId]
  );

  if (invoice.rows.length === 0) throw new AppError('Rechnung nicht gefunden', 404);

  const inv = invoice.rows[0];
  const s = settings.rows[0];
  const items: InvoiceItem[] = (inv.items as any) ?? [];

  const patientName = `${decrypt(inv.first_name_encrypted)} ${decrypt(inv.last_name_encrypted)}`.trim();

  const html = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Rechnung ${inv.invoice_number}</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 40px; color: #111; }
    .row { display: flex; justify-content: space-between; gap: 24px; }
    h1 { font-size: 24px; margin: 0 0 8px; }
    .muted { color: #555; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border-bottom: 1px solid #eee; padding: 10px 6px; text-align: left; vertical-align: top; }
    th { background: #fafafa; }
    .right { text-align: right; }
    .total { font-weight: 700; font-size: 18px; }
    .box { border: 1px solid #eee; padding: 12px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="row">
    <div>
      <h1>Rechnung</h1>
      <div class="muted">Rechnungsnummer: <strong>${inv.invoice_number}</strong></div>
      <div class="muted">Datum: ${inv.invoice_date}</div>
      <div class="muted">Fällig am: ${inv.due_date}</div>
    </div>
    <div class="box">
      <div><strong>${s?.practice_name ?? ''}</strong></div>
      <div>${s?.address_line1 ?? ''}</div>
      <div>${[s?.zip_code, s?.city].filter(Boolean).join(' ')}</div>
      <div class="muted">Steuer-Nr.: ${s?.tax_id ?? ''}</div>
    </div>
  </div>

  <div style="height: 18px"></div>

  <div class="box">
    <div class="muted">Rechnung an</div>
    <div><strong>${patientName}</strong></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Leistung</th>
        <th>GOÄ</th>
        <th class="right">Faktor</th>
        <th class="right">Preis</th>
      </tr>
    </thead>
    <tbody>
      ${items
        .map(
          (it) => `
      <tr>
        <td>${String(it.description ?? '')}</td>
        <td>${it.code ?? ''}</td>
        <td class="right">${it.factor ?? ''}</td>
        <td class="right">${toMoney(Number(it.price ?? 0))} €</td>
      </tr>`
        )
        .join('')}
      <tr>
        <td colspan="3" class="right total">Gesamt</td>
        <td class="right total">${toMoney(Number(inv.total))} €</td>
      </tr>
    </tbody>
  </table>

  ${inv.notes ? `<div class="box" style="margin-top: 18px"><strong>Hinweise</strong><div>${inv.notes}</div></div>` : ''}

  <div class="box" style="margin-top: 18px">
    <div><strong>Bankverbindung</strong></div>
    <div>${s?.bank_name ?? ''}</div>
    <div>IBAN: ${s?.iban ?? ''}</div>
    <div>BIC: ${s?.bic ?? ''}</div>
  </div>

  ${s?.invoice_footer ? `<div class="muted" style="margin-top: 18px">${s.invoice_footer}</div>` : ''}
</body>
</html>`;

  res.json({ html });
});

export default router;
