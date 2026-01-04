const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { z } = require('zod');

// ===== VALIDATION SCHEMAS =====
const reportSchema = z.object({
  patientId: z.number().positive(),
  reportType: z.enum([
    'treatment_summary',
    'progress_report',
    'referral_letter',
    'discharge_report',
    'medical_certificate',
    'insurance_report',
  ]),
  title: z.string().min(1).max(200),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  content: z.object({
    patientInfo: z.boolean().optional(),
    diagnoses: z.boolean().optional(),
    medications: z.boolean().optional(),
    therapyNotes: z.boolean().optional(),
    screeningResults: z.boolean().optional(),
    treatmentPlan: z.boolean().optional(),
    recommendations: z.string().max(5000).optional(),
    customSections: z.array(z.object({
      title: z.string(),
      content: z.string(),
    })).optional(),
  }).optional(),
  recipientInfo: z.object({
    name: z.string().max(200).optional(),
    institution: z.string().max(200).optional(),
    address: z.string().max(500).optional(),
  }).optional(),
});

// ===== REPORT TEMPLATES =====
const REPORT_TEMPLATES = {
  treatment_summary: {
    name: 'Behandlungszusammenfassung',
    description: 'Überblick über die bisherige Behandlung',
    defaultSections: ['patientInfo', 'diagnoses', 'medications', 'treatmentPlan'],
  },
  progress_report: {
    name: 'Verlaufsbericht',
    description: 'Dokumentation des Therapiefortschritts',
    defaultSections: ['patientInfo', 'diagnoses', 'therapyNotes', 'screeningResults'],
  },
  referral_letter: {
    name: 'Überweisungsschreiben',
    description: 'Brief an weiterbehandelnde Ärzte',
    defaultSections: ['patientInfo', 'diagnoses', 'medications', 'recommendations'],
  },
  discharge_report: {
    name: 'Entlassungsbericht',
    description: 'Abschlussbericht nach Therapieende',
    defaultSections: ['patientInfo', 'diagnoses', 'medications', 'treatmentPlan', 'recommendations'],
  },
  medical_certificate: {
    name: 'Ärztliches Attest',
    description: 'Attestierung für Arbeitgeber o.ä.',
    defaultSections: ['patientInfo'],
  },
  insurance_report: {
    name: 'Bericht für Kostenträger',
    description: 'Bericht an Krankenkasse/Versicherung',
    defaultSections: ['patientInfo', 'diagnoses', 'therapyNotes', 'treatmentPlan'],
  },
};

// ===== ROUTES =====

// GET /api/reports/templates - Berichtsvorlagen abrufen
router.get('/templates', authenticateToken, authorizeRole('therapist'), (req, res) => {
  res.json({
    templates: Object.entries(REPORT_TEMPLATES).map(([id, template]) => ({
      id,
      ...template,
    })),
  });
});

// GET /api/reports - Berichte eines Therapeuten abrufen
router.get('/', authenticateToken, authorizeRole('therapist'), async (req, res) => {
  try {
    const { patientId, reportType } = req.query;
    
    let query = `
      SELECT r.*, p.name as patient_name
      FROM treatment_reports r
      JOIN users p ON r.patient_id = p.id
      WHERE r.therapist_id = $1
    `;
    const params = [req.user.id];
    let paramIndex = 2;
    
    if (patientId) {
      query += ` AND r.patient_id = $${paramIndex++}`;
      params.push(patientId);
    }
    
    if (reportType) {
      query += ` AND r.report_type = $${paramIndex++}`;
      params.push(reportType);
    }
    
    query += ` ORDER BY r.created_at DESC`;
    
    const result = await db.query(query, params);
    
    res.json(result.rows.map(row => ({
      id: row.id,
      patientId: row.patient_id,
      patientName: row.patient_name,
      reportType: row.report_type,
      reportTypeName: REPORT_TEMPLATES[row.report_type]?.name || row.report_type,
      title: row.title,
      dateFrom: row.date_from,
      dateTo: row.date_to,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })));
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET /api/reports/:id - Einzelnen Bericht abrufen
router.get('/:id', authenticateToken, authorizeRole('therapist'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `SELECT r.*, p.name as patient_name, p.email as patient_email, p.date_of_birth
       FROM treatment_reports r
       JOIN users p ON r.patient_id = p.id
       WHERE r.id = $1 AND r.therapist_id = $2`,
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bericht nicht gefunden' });
    }
    
    const row = result.rows[0];
    res.json({
      id: row.id,
      patientId: row.patient_id,
      patientName: row.patient_name,
      patientEmail: row.patient_email,
      patientDob: row.date_of_birth,
      reportType: row.report_type,
      reportTypeName: REPORT_TEMPLATES[row.report_type]?.name || row.report_type,
      title: row.title,
      dateFrom: row.date_from,
      dateTo: row.date_to,
      content: row.content,
      recipientInfo: row.recipient_info,
      generatedHtml: row.generated_html,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/reports - Neuen Bericht erstellen
router.post('/', authenticateToken, authorizeRole('therapist'), async (req, res) => {
  try {
    const data = reportSchema.parse(req.body);
    
    const result = await db.query(
      `INSERT INTO treatment_reports 
       (therapist_id, patient_id, report_type, title, date_from, date_to, 
        content, recipient_info, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft')
       RETURNING *`,
      [
        req.user.id,
        data.patientId,
        data.reportType,
        data.title,
        data.dateFrom || null,
        data.dateTo || null,
        JSON.stringify(data.content || {}),
        JSON.stringify(data.recipientInfo || {}),
      ]
    );
    
    res.status(201).json({
      id: result.rows[0].id,
      title: result.rows[0].title,
      createdAt: result.rows[0].created_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Ungültige Daten', details: error.errors });
    }
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// PUT /api/reports/:id - Bericht aktualisieren
router.put('/:id', authenticateToken, authorizeRole('therapist'), async (req, res) => {
  try {
    const { id } = req.params;
    const data = reportSchema.partial().parse(req.body);
    
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (data.title) { updates.push(`title = $${paramIndex++}`); values.push(data.title); }
    if (data.dateFrom !== undefined) { updates.push(`date_from = $${paramIndex++}`); values.push(data.dateFrom); }
    if (data.dateTo !== undefined) { updates.push(`date_to = $${paramIndex++}`); values.push(data.dateTo); }
    if (data.content) { updates.push(`content = $${paramIndex++}`); values.push(JSON.stringify(data.content)); }
    if (data.recipientInfo) { updates.push(`recipient_info = $${paramIndex++}`); values.push(JSON.stringify(data.recipientInfo)); }
    
    updates.push(`updated_at = NOW()`);
    values.push(id, req.user.id);
    
    await db.query(
      `UPDATE treatment_reports SET ${updates.join(', ')} 
       WHERE id = $${paramIndex++} AND therapist_id = $${paramIndex}`,
      values
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/reports/:id/generate - Bericht generieren (HTML)
router.post('/:id/generate', authenticateToken, authorizeRole('therapist'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Bericht laden
    const reportResult = await db.query(
      `SELECT r.*, p.name as patient_name, p.email as patient_email, p.date_of_birth,
              t.name as therapist_name
       FROM treatment_reports r
       JOIN users p ON r.patient_id = p.id
       JOIN users t ON r.therapist_id = t.id
       WHERE r.id = $1 AND r.therapist_id = $2`,
      [id, req.user.id]
    );
    
    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bericht nicht gefunden' });
    }
    
    const report = reportResult.rows[0];
    const content = typeof report.content === 'string' ? JSON.parse(report.content) : report.content || {};
    const recipientInfo = typeof report.recipient_info === 'string' ? JSON.parse(report.recipient_info) : report.recipient_info || {};
    
    // Daten sammeln
    let diagnoses = [];
    let medications = [];
    let screenings = [];
    let therapyNotes = [];
    
    if (content.diagnoses) {
      const diagResult = await db.query(
        `SELECT * FROM patient_diagnoses WHERE patient_id = $1 AND status = 'active'`,
        [report.patient_id]
      );
      diagnoses = diagResult.rows;
    }
    
    if (content.medications) {
      const medResult = await db.query(
        `SELECT * FROM patient_medications WHERE patient_id = $1 AND is_active = true`,
        [report.patient_id]
      );
      medications = medResult.rows;
    }
    
    if (content.screeningResults) {
      const screenResult = await db.query(
        `SELECT * FROM screening_results WHERE patient_id = $1 ORDER BY completed_at DESC LIMIT 10`,
        [report.patient_id]
      );
      screenings = screenResult.rows;
    }
    
    if (content.therapyNotes && report.date_from && report.date_to) {
      const notesResult = await db.query(
        `SELECT session_date, note_type FROM therapy_notes 
         WHERE patient_id = $1 AND session_date BETWEEN $2 AND $3
         ORDER BY session_date DESC`,
        [report.patient_id, report.date_from, report.date_to]
      );
      therapyNotes = notesResult.rows;
    }
    
    // HTML generieren
    const html = generateReportHtml({
      report,
      content,
      recipientInfo,
      diagnoses,
      medications,
      screenings,
      therapyNotes,
      template: REPORT_TEMPLATES[report.report_type],
    });
    
    // HTML speichern
    await db.query(
      `UPDATE treatment_reports SET generated_html = $1, status = 'generated', updated_at = NOW()
       WHERE id = $2`,
      [html, id]
    );
    
    res.json({ 
      success: true,
      html,
    });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// DELETE /api/reports/:id - Bericht löschen
router.delete('/:id', authenticateToken, authorizeRole('therapist'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'DELETE FROM treatment_reports WHERE id = $1 AND therapist_id = $2 RETURNING id',
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bericht nicht gefunden' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Fehler:', error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ===== HTML GENERATOR =====
function generateReportHtml(data) {
  const { report, content, recipientInfo, diagnoses, medications, screenings, therapyNotes, template } = data;
  
  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('de-DE');
  };
  
  let html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>${report.title}</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #333;
      max-width: 210mm;
      margin: 0 auto;
      padding: 20mm;
    }
    .header {
      border-bottom: 2px solid #2563eb;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .header h1 {
      color: #2563eb;
      margin: 0;
      font-size: 18pt;
    }
    .header .subtitle {
      color: #666;
      font-size: 10pt;
    }
    .meta-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      font-size: 10pt;
    }
    .meta-box {
      background: #f5f5f5;
      padding: 10px;
      border-radius: 4px;
    }
    h2 {
      color: #2563eb;
      font-size: 13pt;
      border-bottom: 1px solid #ddd;
      padding-bottom: 5px;
      margin-top: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    th {
      background: #f5f5f5;
    }
    .signature {
      margin-top: 40px;
      border-top: 1px solid #333;
      width: 200px;
      padding-top: 10px;
    }
    @media print {
      body { padding: 10mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${report.title}</h1>
    <div class="subtitle">${template?.name || report.report_type}</div>
  </div>
  
  <div class="meta-info">
    <div class="meta-box">
      <strong>Patient:</strong><br>
      ${report.patient_name}<br>
      ${report.date_of_birth ? `Geb.: ${formatDate(report.date_of_birth)}` : ''}
    </div>
    <div class="meta-box">
      <strong>Behandler:</strong><br>
      ${report.therapist_name}<br>
      Datum: ${formatDate(new Date())}
    </div>
  </div>
`;

  if (recipientInfo.name || recipientInfo.institution) {
    html += `
  <div class="meta-box">
    <strong>Empfänger:</strong><br>
    ${recipientInfo.name || ''}<br>
    ${recipientInfo.institution || ''}<br>
    ${recipientInfo.address || ''}
  </div>
`;
  }

  if (report.date_from && report.date_to) {
    html += `
  <p><strong>Berichtszeitraum:</strong> ${formatDate(report.date_from)} bis ${formatDate(report.date_to)}</p>
`;
  }

  if (diagnoses.length > 0) {
    html += `
  <h2>Diagnosen</h2>
  <table>
    <tr><th>ICD-10</th><th>Diagnose</th><th>Status</th></tr>
    ${diagnoses.map(d => `
    <tr>
      <td>${d.icd_code}</td>
      <td>${d.diagnosis_name}</td>
      <td>${d.certainty === 'confirmed' ? 'Gesichert' : d.certainty === 'suspected' ? 'Verdacht' : 'Z.n.'}</td>
    </tr>
    `).join('')}
  </table>
`;
  }

  if (medications.length > 0) {
    html += `
  <h2>Aktuelle Medikation</h2>
  <table>
    <tr><th>Medikament</th><th>Dosierung</th><th>Häufigkeit</th></tr>
    ${medications.map(m => `
    <tr>
      <td>${m.name}</td>
      <td>${m.dosage}</td>
      <td>${m.frequency}</td>
    </tr>
    `).join('')}
  </table>
`;
  }

  if (screenings.length > 0) {
    html += `
  <h2>Screening-Ergebnisse</h2>
  <table>
    <tr><th>Test</th><th>Datum</th><th>Punktzahl</th><th>Schweregrad</th></tr>
    ${screenings.map(s => `
    <tr>
      <td>${s.template_id?.toUpperCase() || 'Test'}</td>
      <td>${formatDate(s.completed_at)}</td>
      <td>${s.total_score}</td>
      <td>${s.severity || '-'}</td>
    </tr>
    `).join('')}
  </table>
`;
  }

  if (therapyNotes.length > 0) {
    html += `
  <h2>Therapieverlauf</h2>
  <p>Im Berichtszeitraum fanden ${therapyNotes.length} dokumentierte Sitzungen statt.</p>
`;
  }

  if (content.treatmentPlan) {
    html += `
  <h2>Behandlungsplan</h2>
  <p>[Behandlungsplan hier einfügen]</p>
`;
  }

  if (content.recommendations) {
    html += `
  <h2>Empfehlungen</h2>
  <p>${content.recommendations.replace(/\n/g, '<br>')}</p>
`;
  }

  if (content.customSections) {
    for (const section of content.customSections) {
      html += `
  <h2>${section.title}</h2>
  <p>${section.content.replace(/\n/g, '<br>')}</p>
`;
    }
  }

  html += `
  <div class="signature">
    ${report.therapist_name}<br>
    ${formatDate(new Date())}
  </div>
</body>
</html>
`;

  return html;
}

module.exports = router;
