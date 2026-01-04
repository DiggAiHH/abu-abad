import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Download,
  Eye,
  Trash2,
  Calendar,
  User,
  FileCheck,
  ArrowLeft,
  Printer,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { logger } from '../utils/logger';

interface Report {
  id: number;
  patientId: number;
  patientName: string;
  reportType: string;
  reportTypeName: string;
  title: string;
  dateFrom: string | null;
  dateTo: string | null;
  status: string;
  createdAt: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  defaultSections: string[];
}

interface Patient {
  id: number;
  name: string;
  email: string;
}

const Reports: React.FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'preview'>('list');
  const [previewHtml, setPreviewHtml] = useState<string>('');

  // Formular für neuen Bericht
  const [newReport, setNewReport] = useState({
    patientId: 0,
    reportType: 'treatment_summary',
    title: '',
    dateFrom: '',
    dateTo: '',
    content: {
      patientInfo: true,
      diagnoses: true,
      medications: true,
      therapyNotes: false,
      screeningResults: false,
      treatmentPlan: false,
      recommendations: '',
    },
    recipientInfo: {
      name: '',
      institution: '',
      address: '',
    },
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reportsRes, templatesRes, patientsRes] = await Promise.all([
        api.get('/reports'),
        api.get('/reports/templates'),
        api.get('/patients'),
      ]);

      setReports(reportsRes.data || []);
      setTemplates(templatesRes.data?.templates || []);
      setPatients(patientsRes.data || []);
    } catch (error) {
      logger.error('Reports: Fehler', error);
      toast.error('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const createReport = async () => {
    if (!newReport.patientId) {
      toast.error('Bitte wählen Sie einen Patienten');
      return;
    }
    if (!newReport.title.trim()) {
      toast.error('Bitte geben Sie einen Titel ein');
      return;
    }

    try {
      await api.post('/reports', newReport);
        toast.success('Bericht erstellt');
        setActiveTab('list');
        fetchData();
        setNewReport({
          patientId: 0,
          reportType: 'treatment_summary',
          title: '',
          dateFrom: '',
          dateTo: '',
          content: {
            patientInfo: true,
            diagnoses: true,
            medications: true,
            therapyNotes: false,
            screeningResults: false,
            treatmentPlan: false,
            recommendations: '',
          },
          recipientInfo: {
            name: '',
            institution: '',
            address: '',
          },
        });
    } catch (error) {
      logger.error('Reports: Fehler', error);
      toast.error('Netzwerkfehler');
    }
  };

  const generateReport = async (reportId: number) => {
    try {
      const res = await api.post(`/reports/${reportId}/generate`, {});
      setPreviewHtml(res.data?.html || '');
      setActiveTab('preview');
      toast.success('Bericht generiert');
      fetchData();
    } catch (error) {
      logger.error('Reports: Fehler', error);
      toast.error('Netzwerkfehler');
    }
  };

  const viewReport = async (reportId: number) => {
    try {
      const res = await api.get(`/reports/${reportId}`);
      const data = res.data;
      if (data?.generatedHtml) {
        setPreviewHtml(data.generatedHtml);
        setActiveTab('preview');
      } else {
        toast.error('Bericht noch nicht generiert');
      }
    } catch (error) {
      logger.error('Reports: Fehler', error);
    }
  };

  const deleteReport = async (reportId: number) => {
    if (!confirm('Bericht wirklich löschen?')) return;

    try {
      await api.delete(`/reports/${reportId}`);
      toast.success('Bericht gelöscht');
      fetchData();
    } catch (error) {
      logger.error('Reports: Fehler', error);
      toast.error('Fehler beim Löschen');
    }
  };

  const printReport = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(previewHtml);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const downloadReport = () => {
    const blob = new Blob([previewHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bericht.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      generated: 'bg-blue-100 text-blue-700',
      finalized: 'bg-green-100 text-green-700',
      sent: 'bg-purple-100 text-purple-700',
    };
    const labels: Record<string, string> = {
      draft: 'Entwurf',
      generated: 'Generiert',
      finalized: 'Finalisiert',
      sent: 'Versendet',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
        {labels[status] || status}
      </span>
    );
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('de-DE');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">📄 Behandlungsberichte</h1>
              <p className="text-sm text-gray-500">Berichte erstellen und verwalten</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'list'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Übersicht
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'create'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Neuer Bericht
          </button>
          {previewHtml && (
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'preview'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Eye className="w-4 h-4 inline mr-2" />
              Vorschau
            </button>
          )}
        </div>

        {/* Liste */}
        {activeTab === 'list' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {reports.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Berichte</h3>
                <p className="text-gray-500 mb-4">Erstellen Sie Ihren ersten Behandlungsbericht</p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 inline mr-2" />
                  Bericht erstellen
                </button>
              </div>
            ) : (
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Titel
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Patient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Typ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Erstellt
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Aktionen
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{report.title}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{report.patientName}</td>
                      <td className="px-6 py-4 text-gray-600">{report.reportTypeName}</td>
                      <td className="px-6 py-4">{getStatusBadge(report.status)}</td>
                      <td className="px-6 py-4 text-gray-600">{formatDate(report.createdAt)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {report.status === 'draft' && (
                            <button
                              onClick={() => generateReport(report.id)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="Generieren"
                            >
                              <FileCheck className="w-4 h-4" />
                            </button>
                          )}
                          {report.status !== 'draft' && (
                            <button
                              onClick={() => viewReport(report.id)}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                              title="Anzeigen"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteReport(report.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Löschen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Neuer Bericht */}
        {activeTab === 'create' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-6">Neuen Bericht erstellen</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Patient */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4 inline mr-1" />
                  Patient
                </label>
                <select
                  value={newReport.patientId}
                  onChange={(e) =>
                    setNewReport({ ...newReport, patientId: parseInt(e.target.value) })
                  }
                  className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value={0}>Patient auswählen...</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Berichtstyp */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Berichtstyp
                </label>
                <select
                  value={newReport.reportType}
                  onChange={(e) => setNewReport({ ...newReport, reportType: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Titel */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Titel</label>
                <input
                  type="text"
                  value={newReport.title}
                  onChange={(e) => setNewReport({ ...newReport, title: e.target.value })}
                  placeholder="z.B. Verlaufsbericht Q4 2024"
                  className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Zeitraum */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Von
                </label>
                <input
                  type="date"
                  value={newReport.dateFrom}
                  onChange={(e) => setNewReport({ ...newReport, dateFrom: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Bis
                </label>
                <input
                  type="date"
                  value={newReport.dateTo}
                  onChange={(e) => setNewReport({ ...newReport, dateTo: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Inhalt */}
            <div className="mt-6">
              <h3 className="font-medium text-gray-900 mb-4">Berichtsinhalte</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { key: 'patientInfo', label: 'Patienteninformationen' },
                  { key: 'diagnoses', label: 'Diagnosen' },
                  { key: 'medications', label: 'Medikation' },
                  { key: 'therapyNotes', label: 'Therapieverlauf' },
                  { key: 'screeningResults', label: 'Screening-Ergebnisse' },
                  { key: 'treatmentPlan', label: 'Behandlungsplan' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newReport.content[key as keyof typeof newReport.content] as boolean}
                      onChange={(e) =>
                        setNewReport({
                          ...newReport,
                          content: { ...newReport.content, [key]: e.target.checked },
                        })
                      }
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Empfehlungen */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Empfehlungen / Anmerkungen
              </label>
              <textarea
                value={newReport.content.recommendations}
                onChange={(e) =>
                  setNewReport({
                    ...newReport,
                    content: { ...newReport.content, recommendations: e.target.value },
                  })
                }
                rows={4}
                placeholder="Weitere Empfehlungen für den Bericht..."
                className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Empfänger */}
            <div className="mt-6">
              <h3 className="font-medium text-gray-900 mb-4">Empfänger (optional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Name</label>
                  <input
                    type="text"
                    value={newReport.recipientInfo.name}
                    onChange={(e) =>
                      setNewReport({
                        ...newReport,
                        recipientInfo: { ...newReport.recipientInfo, name: e.target.value },
                      })
                    }
                    placeholder="Dr. Max Mustermann"
                    className="w-full border rounded-lg px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Institution</label>
                  <input
                    type="text"
                    value={newReport.recipientInfo.institution}
                    onChange={(e) =>
                      setNewReport({
                        ...newReport,
                        recipientInfo: { ...newReport.recipientInfo, institution: e.target.value },
                      })
                    }
                    placeholder="Universitätsklinikum"
                    className="w-full border rounded-lg px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Adresse</label>
                  <input
                    type="text"
                    value={newReport.recipientInfo.address}
                    onChange={(e) =>
                      setNewReport({
                        ...newReport,
                        recipientInfo: { ...newReport.recipientInfo, address: e.target.value },
                      })
                    }
                    placeholder="Musterstr. 1, 12345 Stadt"
                    className="w-full border rounded-lg px-4 py-2"
                  />
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="mt-8 flex justify-end gap-4">
              <button
                onClick={() => setActiveTab('list')}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Abbrechen
              </button>
              <button
                onClick={createReport}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Bericht erstellen
              </button>
            </div>
          </div>
        )}

        {/* Vorschau */}
        {activeTab === 'preview' && previewHtml && (
          <div className="space-y-4">
            <div className="flex justify-end gap-2">
              <button
                onClick={printReport}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                <Printer className="w-4 h-4 inline mr-2" />
                Drucken
              </button>
              <button
                onClick={downloadReport}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Download className="w-4 h-4 inline mr-2" />
                Download HTML
              </button>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-8">
              <iframe
                srcDoc={previewHtml}
                className="w-full h-[800px] border rounded-lg"
                title="Berichtsvorschau"
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Reports;
