import { useState, useEffect } from 'react';
import { api } from '../api/client';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { logger } from '../utils/logger';
import {
  ArrowLeft,
  Pill,
  Plus,
  Check,
  X,
  Clock,
  AlertTriangle,
  TrendingUp,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';

// ===== TYPES =====
interface Medication {
  id: number;
  name: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  frequencyDetails?: string;
  timing?: string[];
  prescribedBy?: string;
  startDate?: string;
  endDate?: string;
  reason?: string;
  category?: string;
  notes?: string;
  sideEffects?: string[];
  isActive: boolean;
}

interface IntakeLog {
  id: number;
  medicationId: number;
  medicationName: string;
  dosage: string;
  taken: boolean;
  scheduledTime?: string;
  actualTime?: string;
  skippedReason?: string;
  sideEffectsNoted?: string[];
  notes?: string;
  loggedAt: string;
}

interface DbMedication {
  name: string;
  genericName: string;
  category: string;
  commonDosages: string[];
}

interface Adherence {
  overall: {
    adherenceRate: number | null;
    taken: number;
    total: number;
    period: string;
  };
  byMedication: Array<{
    id: number;
    name: string;
    dosage: string;
    adherenceRate: number | null;
    taken: number;
    total: number;
  }>;
  sideEffects: Array<{ effect: string; count: number }>;
}

const FREQUENCY_LABELS: Record<string, string> = {
  once_daily: '1x täglich',
  twice_daily: '2x täglich',
  three_times: '3x täglich',
  four_times: '4x täglich',
  as_needed: 'Bei Bedarf',
  weekly: 'Wöchentlich',
  other: 'Andere',
};

const CATEGORY_LABELS: Record<string, string> = {
  antidepressant: 'Antidepressiva',
  anxiolytic: 'Anxiolytika',
  antipsychotic: 'Antipsychotika',
  mood_stabilizer: 'Stimmungsstabilisierer',
  stimulant: 'Stimulanzien',
  sedative: 'Schlafmittel',
  other_psychiatric: 'Sonstige Psychiatrische',
  other_medical: 'Sonstige Medikamente',
};

export default function MedicationTracker() {
  const navigate = useNavigate();

  const [medications, setMedications] = useState<Medication[]>([]);
  const [intakeLogs, setIntakeLogs] = useState<IntakeLog[]>([]);
  const [adherence, setAdherence] = useState<Adherence | null>(null);
  const [dbMedications, setDbMedications] = useState<DbMedication[]>([]);
  const [sideEffectOptions, setSideEffectOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'today' | 'medications' | 'stats'>('today');

  // Add/Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    genericName: '',
    dosage: '',
    frequency: 'once_daily',
    frequencyDetails: '',
    timing: [] as string[],
    prescribedBy: '',
    startDate: '',
    reason: '',
    category: 'other_psychiatric',
    notes: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Intake Modal
  const [intakeModal, setIntakeModal] = useState<{
    medication: Medication;
    taken: boolean;
  } | null>(null);
  const [intakeData, setIntakeData] = useState({
    skippedReason: '',
    sideEffectsNoted: [] as string[],
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [medsRes, dbRes, logsRes, adherenceRes] = await Promise.all([
        api.get('/medications'),
        api.get('/medications/database'),
        api.get('/medications/intake?days=7'),
        api.get('/medications/adherence?days=30'),
      ]);

      setMedications(medsRes.data);
      setDbMedications(dbRes.data.medications);
      setSideEffectOptions(dbRes.data.sideEffects);
      setIntakeLogs(logsRes.data);
      setAdherence(adherenceRes.data);
    } catch (error) {
      logger.error('MedicationTracker: Fehler beim Laden', error);
      toast.error('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMedication = async () => {
    try {
      await api.post('/medications', formData);
      toast.success('Medikament hinzugefügt');
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      toast.error('Fehler beim Hinzufügen');
    }
  };

  const handleUpdateMedication = async () => {
    if (!editingMed) return;
    try {
      await api.put(`/medications/${editingMed.id}`, formData);
      toast.success('Medikament aktualisiert');
      setShowModal(false);
      setEditingMed(null);
      resetForm();
      loadData();
    } catch (error) {
      toast.error('Fehler beim Aktualisieren');
    }
  };

  const handleDeactivateMedication = async (med: Medication) => {
    if (!confirm(`Möchten Sie "${med.name}" als abgesetzt markieren?`)) return;
    try {
      await api.post(`/medications/${med.id}/deactivate`, {
        endDate: new Date().toISOString().split('T')[0],
      });
      toast.success('Medikament als abgesetzt markiert');
      loadData();
    } catch (error) {
      toast.error('Fehler');
    }
  };

  const handleDeleteMedication = async (med: Medication) => {
    if (!confirm(`Möchten Sie "${med.name}" wirklich löschen? Dies entfernt auch alle Einnahme-Protokolle.`)) return;
    try {
      await api.delete(`/medications/${med.id}`);
      toast.success('Medikament gelöscht');
      loadData();
    } catch (error) {
      toast.error('Fehler beim Löschen');
    }
  };

  const handleLogIntake = async () => {
    if (!intakeModal) return;
    try {
      await api.post('/medications/intake', {
        medicationId: intakeModal.medication.id,
        taken: intakeModal.taken,
        actualTime: new Date().toTimeString().slice(0, 5),
        ...intakeData,
      });
      toast.success(intakeModal.taken ? '✓ Einnahme protokolliert' : 'Ausgelassen protokolliert');
      setIntakeModal(null);
      setIntakeData({ skippedReason: '', sideEffectsNoted: [], notes: '' });
      loadData();
    } catch (error) {
      toast.error('Fehler beim Protokollieren');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      genericName: '',
      dosage: '',
      frequency: 'once_daily',
      frequencyDetails: '',
      timing: [],
      prescribedBy: '',
      startDate: '',
      reason: '',
      category: 'other_psychiatric',
      notes: '',
    });
    setSearchTerm('');
  };

  const openEditModal = (med: Medication) => {
    setEditingMed(med);
    setFormData({
      name: med.name,
      genericName: med.genericName || '',
      dosage: med.dosage,
      frequency: med.frequency,
      frequencyDetails: med.frequencyDetails || '',
      timing: med.timing || [],
      prescribedBy: med.prescribedBy || '',
      startDate: med.startDate || '',
      reason: med.reason || '',
      category: med.category || 'other_psychiatric',
      notes: med.notes || '',
    });
    setShowModal(true);
  };

  const selectSuggestion = (med: DbMedication) => {
    setFormData({
      ...formData,
      name: med.name,
      genericName: med.genericName,
      category: med.category,
      dosage: med.commonDosages[0] || '',
    });
    setSearchTerm(med.name);
    setShowSuggestions(false);
  };

  const filteredSuggestions = dbMedications.filter(
    (m) =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.genericName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeMeds = medications.filter((m) => m.isActive);
  const inactiveMeds = medications.filter((m) => !m.isActive);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-600 to-teal-600 text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-white/20 rounded-lg"
              >
                <ArrowLeft size={24} />
              </button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Pill size={28} />
                  Meine Medikamente
                </h1>
                <p className="text-green-100">
                  {activeMeds.length} aktive Medikamente
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                resetForm();
                setEditingMed(null);
                setShowModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white text-green-600 rounded-lg hover:bg-green-50"
            >
              <Plus size={20} />
              Hinzufügen
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <div className="flex bg-white rounded-lg shadow overflow-hidden">
          <button
            onClick={() => setActiveTab('today')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'today'
                ? 'bg-green-600 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Clock size={16} className="inline mr-1" />
            Heute
          </button>
          <button
            onClick={() => setActiveTab('medications')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'medications'
                ? 'bg-green-600 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Pill size={16} className="inline mr-1" />
            Übersicht
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'stats'
                ? 'bg-green-600 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <TrendingUp size={16} className="inline mr-1" />
            Statistik
          </button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* TODAY TAB */}
        {activeTab === 'today' && (
          <div className="space-y-4">
            {activeMeds.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <Pill size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Noch keine Medikamente eingetragen</p>
                <button
                  onClick={() => setShowModal(true)}
                  className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg"
                >
                  Erstes Medikament hinzufügen
                </button>
              </div>
            ) : (
              activeMeds.map((med) => {
                const todayLogs = intakeLogs.filter(
                  (l) =>
                    l.medicationId === med.id &&
                    new Date(l.loggedAt).toDateString() === new Date().toDateString()
                );
                const alreadyLogged = todayLogs.length > 0;

                return (
                  <div
                    key={med.id}
                    className={`bg-white rounded-lg shadow p-4 border-l-4 ${
                      alreadyLogged
                        ? todayLogs[0]?.taken
                          ? 'border-green-500'
                          : 'border-orange-500'
                        : 'border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-lg">{med.name}</h3>
                        <p className="text-gray-600">
                          {med.dosage} · {FREQUENCY_LABELS[med.frequency]}
                        </p>
                        {med.timing && med.timing.length > 0 && (
                          <p className="text-sm text-gray-500">
                            Zeiten: {med.timing.join(', ')} Uhr
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {alreadyLogged ? (
                          <span
                            className={`px-3 py-1 rounded-full text-sm ${
                              todayLogs[0]?.taken
                                ? 'bg-green-100 text-green-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}
                          >
                            {todayLogs[0]?.taken ? '✓ Genommen' : 'Ausgelassen'}
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => setIntakeModal({ medication: med, taken: true })}
                              className="p-3 bg-green-100 text-green-600 rounded-full hover:bg-green-200"
                              title="Genommen"
                            >
                              <Check size={24} />
                            </button>
                            <button
                              onClick={() => setIntakeModal({ medication: med, taken: false })}
                              className="p-3 bg-orange-100 text-orange-600 rounded-full hover:bg-orange-200"
                              title="Ausgelassen"
                            >
                              <X size={24} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* MEDICATIONS TAB */}
        {activeTab === 'medications' && (
          <div className="space-y-6">
            {/* Active Medications */}
            <div>
              <h2 className="text-lg font-bold mb-3 text-gray-700">
                Aktive Medikamente ({activeMeds.length})
              </h2>
              {activeMeds.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Keine aktiven Medikamente</p>
              ) : (
                <div className="space-y-3">
                  {activeMeds.map((med) => (
                    <MedicationCard
                      key={med.id}
                      medication={med}
                      onEdit={() => openEditModal(med)}
                      onDeactivate={() => handleDeactivateMedication(med)}
                      onDelete={() => handleDeleteMedication(med)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Inactive Medications */}
            {inactiveMeds.length > 0 && (
              <div>
                <h2 className="text-lg font-bold mb-3 text-gray-400">
                  Abgesetzte Medikamente ({inactiveMeds.length})
                </h2>
                <div className="space-y-3 opacity-60">
                  {inactiveMeds.map((med) => (
                    <MedicationCard
                      key={med.id}
                      medication={med}
                      onEdit={() => openEditModal(med)}
                      onDeactivate={() => {}}
                      onDelete={() => handleDeleteMedication(med)}
                      inactive
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STATS TAB */}
        {activeTab === 'stats' && adherence && (
          <div className="space-y-6">
            {/* Overall Adherence */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold mb-4">Therapietreue (30 Tage)</h2>
              <div className="flex items-center justify-center gap-4">
                <div
                  className={`text-5xl font-bold ${
                    adherence.overall.adherenceRate === null
                      ? 'text-gray-400'
                      : adherence.overall.adherenceRate >= 80
                      ? 'text-green-500'
                      : adherence.overall.adherenceRate >= 50
                      ? 'text-yellow-500'
                      : 'text-red-500'
                  }`}
                >
                  {adherence.overall.adherenceRate !== null
                    ? `${adherence.overall.adherenceRate}%`
                    : '—'}
                </div>
                <div className="text-sm text-gray-500">
                  <p>{adherence.overall.taken} von {adherence.overall.total}</p>
                  <p>protokollierten Einnahmen</p>
                </div>
              </div>
            </div>

            {/* Per Medication */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold mb-4">Nach Medikament</h2>
              {adherence.byMedication.length === 0 ? (
                <p className="text-gray-500 text-center">Keine Daten verfügbar</p>
              ) : (
                <div className="space-y-3">
                  {adherence.byMedication.map((med) => (
                    <div key={med.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{med.name}</p>
                        <p className="text-sm text-gray-500">{med.dosage}</p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-bold ${
                            med.adherenceRate === null
                              ? 'text-gray-400'
                              : med.adherenceRate >= 80
                              ? 'text-green-500'
                              : 'text-orange-500'
                          }`}
                        >
                          {med.adherenceRate !== null ? `${med.adherenceRate}%` : '—'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {med.taken}/{med.total}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Side Effects */}
            {adherence.sideEffects.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <AlertTriangle className="text-orange-500" />
                  Häufige Nebenwirkungen
                </h2>
                <div className="flex flex-wrap gap-2">
                  {adherence.sideEffects.map((se) => (
                    <span
                      key={se.effect}
                      className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm"
                    >
                      {se.effect} ({se.count}x)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">
                {editingMed ? 'Medikament bearbeiten' : 'Neues Medikament'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500">
                <X size={24} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Name with autocomplete */}
              <div className="relative">
                <label className="block text-sm font-medium mb-1">Medikament</label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm || formData.name}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setFormData({ ...formData, name: e.target.value });
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder="Name eingeben oder suchen..."
                    className="w-full border rounded pl-10 pr-3 py-2"
                  />
                </div>
                {showSuggestions && searchTerm.length >= 2 && filteredSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {filteredSuggestions.slice(0, 8).map((med, i) => (
                      <button
                        key={i}
                        onClick={() => selectSuggestion(med)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-b-0"
                      >
                        <p className="font-medium">{med.name}</p>
                        <p className="text-xs text-gray-500">
                          {med.genericName} · {CATEGORY_LABELS[med.category]}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Dosage */}
              <div>
                <label className="block text-sm font-medium mb-1">Dosierung *</label>
                <input
                  type="text"
                  value={formData.dosage}
                  onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                  placeholder="z.B. 10 mg"
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              {/* Frequency */}
              <div>
                <label className="block text-sm font-medium mb-1">Häufigkeit</label>
                <select
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium mb-1">Kategorie</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Prescribed By */}
              <div>
                <label className="block text-sm font-medium mb-1">Verschrieben von</label>
                <input
                  type="text"
                  value={formData.prescribedBy}
                  onChange={(e) => setFormData({ ...formData, prescribedBy: e.target.value })}
                  placeholder="z.B. Dr. Müller"
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium mb-1">Grund/Indikation</label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="z.B. Depression, Schlafstörungen"
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium mb-1">Startdatum</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-1">Notizen</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  placeholder="Besondere Hinweise..."
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                onClick={editingMed ? handleUpdateMedication : handleAddMedication}
                disabled={!formData.name || !formData.dosage}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {editingMed ? 'Speichern' : 'Hinzufügen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Intake Log Modal */}
      {intakeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div
              className={`p-4 ${
                intakeModal.taken ? 'bg-green-600' : 'bg-orange-600'
              } text-white rounded-t-lg`}
            >
              <h2 className="text-xl font-bold">
                {intakeModal.taken ? '✓ Einnahme bestätigen' : 'Einnahme ausgelassen'}
              </h2>
              <p>
                {intakeModal.medication.name} · {intakeModal.medication.dosage}
              </p>
            </div>
            <div className="p-4 space-y-4">
              {!intakeModal.taken && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Warum ausgelassen?
                  </label>
                  <input
                    type="text"
                    value={intakeData.skippedReason}
                    onChange={(e) =>
                      setIntakeData({ ...intakeData, skippedReason: e.target.value })
                    }
                    placeholder="z.B. Vergessen, Nebenwirkungen..."
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Nebenwirkungen bemerkt?
                </label>
                <div className="flex flex-wrap gap-2">
                  {sideEffectOptions.slice(0, 12).map((se) => (
                    <button
                      key={se}
                      onClick={() => {
                        const current = intakeData.sideEffectsNoted;
                        if (current.includes(se)) {
                          setIntakeData({
                            ...intakeData,
                            sideEffectsNoted: current.filter((s) => s !== se),
                          });
                        } else {
                          setIntakeData({
                            ...intakeData,
                            sideEffectsNoted: [...current, se],
                          });
                        }
                      }}
                      className={`px-2 py-1 text-sm rounded-full border ${
                        intakeData.sideEffectsNoted.includes(se)
                          ? 'bg-orange-100 border-orange-500 text-orange-700'
                          : 'border-gray-300 text-gray-600'
                      }`}
                    >
                      {se}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notizen</label>
                <input
                  type="text"
                  value={intakeData.notes}
                  onChange={(e) =>
                    setIntakeData({ ...intakeData, notes: e.target.value })
                  }
                  placeholder="Optional..."
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <button
                onClick={() => setIntakeModal(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleLogIntake}
                className={`px-4 py-2 text-white rounded-lg ${
                  intakeModal.taken
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                Bestätigen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== MEDICATION CARD COMPONENT =====
function MedicationCard({
  medication,
  onEdit,
  onDeactivate,
  onDelete,
  inactive = false,
}: {
  medication: Medication;
  onEdit: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
  inactive?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow">
      <div
        className="p-4 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <h3 className="font-bold">{medication.name}</h3>
          <p className="text-gray-600 text-sm">
            {medication.dosage} · {FREQUENCY_LABELS[medication.frequency]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600">
            {CATEGORY_LABELS[medication.category || 'other_psychiatric']}
          </span>
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t pt-3">
          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
            {medication.prescribedBy && (
              <div>
                <span className="text-gray-500">Verschrieben von:</span>
                <p>{medication.prescribedBy}</p>
              </div>
            )}
            {medication.reason && (
              <div>
                <span className="text-gray-500">Indikation:</span>
                <p>{medication.reason}</p>
              </div>
            )}
            {medication.startDate && (
              <div>
                <span className="text-gray-500">Seit:</span>
                <p>{new Date(medication.startDate).toLocaleDateString('de-DE')}</p>
              </div>
            )}
            {medication.endDate && (
              <div>
                <span className="text-gray-500">Bis:</span>
                <p>{new Date(medication.endDate).toLocaleDateString('de-DE')}</p>
              </div>
            )}
          </div>
          {medication.notes && (
            <p className="text-sm text-gray-600 mb-4">{medication.notes}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="flex items-center gap-1 px-3 py-1 text-sm border rounded hover:bg-gray-50"
            >
              <Edit2 size={14} /> Bearbeiten
            </button>
            {!inactive && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeactivate();
                }}
                className="flex items-center gap-1 px-3 py-1 text-sm border border-orange-500 text-orange-500 rounded hover:bg-orange-50"
              >
                Absetzen
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="flex items-center gap-1 px-3 py-1 text-sm text-red-500 hover:bg-red-50 rounded"
            >
              <Trash2 size={14} /> Löschen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
