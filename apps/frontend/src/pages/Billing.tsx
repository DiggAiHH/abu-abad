import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../api/client';
import toast from 'react-hot-toast';
import { FileText, Settings, Plus, Download, Euro, Save } from 'lucide-react';
import { logger } from '../utils/logger';

interface InvoiceItem {
  description: string;
  code?: string;
  factor?: number;
  price: number;
}

interface Invoice {
  id: number;
  patientId: number;
  patientName: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  total: number;
  status: string;
}

interface BillingSettings {
  practiceName: string;
  addressLine1: string;
  addressLine2: string;
  zipCode: string;
  city: string;
  taxId: string;
  bankName: string;
  iban: string;
  bic: string;
  invoiceFooter: string;
  nextInvoiceNumber: number;
}

const Billing = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'invoices' | 'create' | 'settings'>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settings, setSettings] = useState<BillingSettings>({
    practiceName: '',
    addressLine1: '',
    addressLine2: '',
    zipCode: '',
    city: '',
    taxId: '',
    bankName: '',
    iban: '',
    bic: '',
    invoiceFooter: '',
    nextInvoiceNumber: 1000
  });
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Invoice State
  const [newInvoice, setNewInvoice] = useState({
    patientId: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    items: [{ description: 'Psychotherapeutische Sitzung (50 Min)', code: '870', factor: 2.3, price: 100.55 }] as InvoiceItem[],
    taxRate: 0,
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [invRes, setRes, patRes] = await Promise.all([
        api.get('/billing/invoices'),
        api.get('/billing/settings'),
        api.get('/patients') // Assuming this endpoint exists
      ]);
      setInvoices(invRes.data);
      setSettings(prev => ({ ...prev, ...setRes.data }));
      setPatients(patRes.data);
    } catch (error) {
      logger.error('Billing: Error fetching billing data', error);
      // toast.error('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await api.put('/billing/settings', settings);
      toast.success('Einstellungen gespeichert');
    } catch (error) {
      toast.error('Fehler beim Speichern');
    }
  };

  const handleCreateInvoice = async () => {
    if (!newInvoice.patientId) {
      toast.error('Bitte wählen Sie einen Patienten aus');
      return;
    }

    try {
      await api.post('/billing/invoices', {
        ...newInvoice,
        patientId: parseInt(newInvoice.patientId)
      });
      toast.success('Rechnung erstellt');
      setActiveTab('invoices');
      fetchData();
    } catch (error) {
      toast.error('Fehler beim Erstellen der Rechnung');
    }
  };

  const handleGenerateHtml = async (id: number) => {
    try {
      const res = await api.post(`/billing/invoices/${id}/generate`);
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(res.data.html);
        win.document.close();
      }
    } catch (error) {
      toast.error('Fehler beim Generieren der Vorschau');
    }
  };

  const addItem = () => {
    setNewInvoice(prev => ({
      ...prev,
      items: [...prev.items, { description: '', price: 0 }]
    }));
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...newInvoice.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setNewInvoice(prev => ({ ...prev, items: newItems }));
  };

  const removeItem = (index: number) => {
    setNewInvoice(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  if (user?.role !== 'therapist') {
    return <div className="p-8 text-center">Zugriff verweigert. Nur für Therapeuten.</div>;
  }

  if (loading) return <div className="p-8 text-center">Laden...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <Euro className="w-8 h-8 text-blue-600" />
          Abrechnung & Rechnungen
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${activeTab === 'invoices' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}
          >
            <FileText size={18} /> Rechnungen
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${activeTab === 'create' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}
          >
            <Plus size={18} /> Neu
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${activeTab === 'settings' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}
          >
            <Settings size={18} /> Einstellungen
          </button>
        </div>
      </div>

      {activeTab === 'invoices' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-4 font-semibold text-gray-600">Nr.</th>
                <th className="p-4 font-semibold text-gray-600">Patient</th>
                <th className="p-4 font-semibold text-gray-600">Datum</th>
                <th className="p-4 font-semibold text-gray-600">Betrag</th>
                <th className="p-4 font-semibold text-gray-600">Status</th>
                <th className="p-4 font-semibold text-gray-600">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="p-4 font-medium">{inv.invoiceNumber}</td>
                  <td className="p-4">{inv.patientName}</td>
                  <td className="p-4">{new Date(inv.date).toLocaleDateString('de-DE')}</td>
                  <td className="p-4 font-medium">{inv.total.toFixed(2)} €</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      inv.status === 'paid' ? 'bg-green-100 text-green-800' :
                      inv.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {inv.status === 'draft' ? 'Entwurf' : 
                       inv.status === 'sent' ? 'Versendet' : 
                       inv.status === 'paid' ? 'Bezahlt' : inv.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <button 
                      onClick={() => handleGenerateHtml(inv.id)}
                      className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
                    >
                      <Download size={16} /> PDF/Druck
                    </button>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">Keine Rechnungen gefunden</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'create' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-6">Neue Rechnung erstellen</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
              <select
                value={newInvoice.patientId}
                onChange={(e) => setNewInvoice({...newInvoice, patientId: e.target.value})}
                className="w-full p-2 border rounded-lg"
              >
                <option value="">Bitte wählen...</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rechnungsdatum</label>
                <input
                  type="date"
                  value={newInvoice.date}
                  onChange={(e) => setNewInvoice({...newInvoice, date: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fällig am</label>
                <input
                  type="date"
                  value={newInvoice.dueDate}
                  onChange={(e) => setNewInvoice({...newInvoice, dueDate: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Positionen</label>
            <div className="space-y-2">
              {newInvoice.items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <input
                    placeholder="Beschreibung"
                    value={item.description}
                    onChange={(e) => updateItem(idx, 'description', e.target.value)}
                    className="flex-grow p-2 border rounded-lg"
                  />
                  <input
                    placeholder="GOÄ"
                    value={item.code || ''}
                    onChange={(e) => updateItem(idx, 'code', e.target.value)}
                    className="w-20 p-2 border rounded-lg"
                  />
                  <input
                    type="number"
                    placeholder="Faktor"
                    value={item.factor || ''}
                    onChange={(e) => updateItem(idx, 'factor', parseFloat(e.target.value))}
                    className="w-20 p-2 border rounded-lg"
                    step="0.1"
                  />
                  <input
                    type="number"
                    placeholder="Preis"
                    value={item.price}
                    onChange={(e) => updateItem(idx, 'price', parseFloat(e.target.value))}
                    className="w-24 p-2 border rounded-lg"
                    step="0.01"
                  />
                  <button
                    onClick={() => removeItem(idx)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addItem}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + Position hinzufügen
            </button>
          </div>

          <div className="flex justify-end gap-4 border-t pt-6">
            <div className="text-right">
              <div className="text-sm text-gray-600 mb-1">Gesamtsumme</div>
              <div className="text-2xl font-bold">
                {newInvoice.items.reduce((sum, i) => sum + (i.price || 0), 0).toFixed(2)} €
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleCreateInvoice}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Save size={18} /> Rechnung erstellen
            </button>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-6">Rechnungseinstellungen</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 border-b pb-2">Praxisdaten</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Praxisname / Absender</label>
                <input
                  value={settings.practiceName || ''}
                  onChange={(e) => setSettings({...settings, practiceName: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Straße & Hausnummer</label>
                <input
                  value={settings.addressLine1 || ''}
                  onChange={(e) => setSettings({...settings, addressLine1: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">PLZ</label>
                  <input
                    value={settings.zipCode || ''}
                    onChange={(e) => setSettings({...settings, zipCode: e.target.value})}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stadt</label>
                  <input
                    value={settings.city || ''}
                    onChange={(e) => setSettings({...settings, city: e.target.value})}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 border-b pb-2">Bankverbindung & Steuer</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bankname</label>
                <input
                  value={settings.bankName || ''}
                  onChange={(e) => setSettings({...settings, bankName: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
                <input
                  value={settings.iban || ''}
                  onChange={(e) => setSettings({...settings, iban: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">BIC</label>
                <input
                  value={settings.bic || ''}
                  onChange={(e) => setSettings({...settings, bic: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Steuernummer</label>
                <input
                  value={settings.taxId || ''}
                  onChange={(e) => setSettings({...settings, taxId: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
            </div>

            <div className="md:col-span-2 space-y-4">
              <h3 className="font-medium text-gray-900 border-b pb-2">Sonstiges</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fußzeile (Text)</label>
                <textarea
                  value={settings.invoiceFooter || ''}
                  onChange={(e) => setSettings({...settings, invoiceFooter: e.target.value})}
                  className="w-full p-2 border rounded-lg h-20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nächste Rechnungsnummer</label>
                <input
                  type="number"
                  value={settings.nextInvoiceNumber || ''}
                  onChange={(e) => setSettings({...settings, nextInvoiceNumber: parseInt(e.target.value)})}
                  className="w-full p-2 border rounded-lg max-w-xs"
                />
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={handleSaveSettings}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Save size={18} /> Einstellungen speichern
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Billing;
