import { useState, useEffect } from 'react';
import { api } from '../api/client';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { logger } from '../utils/logger';
import {
  ArrowLeft,
  Plus,
  Calendar,
  Smile,
  Frown,
  Meh,
  Moon,
  Activity,
  AlertTriangle,
  Pill,
  Edit2,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  Save,
  X,
} from 'lucide-react';

// ===== TYPES =====
interface MoodEntry {
  id: string;
  entry_date: string;
  mood_score: number;
  anxiety_level?: number;
  sleep_quality?: number;
  sleep_hours?: number;
  energy_level?: number;
  stress_level?: number;
  symptoms: string[];
  triggers: string[];
  activities: string[];
  medications: { name: string; dosage?: string; taken: boolean }[];
  notes?: string;
}

interface DiaryStats {
  averages: {
    mood: number | null;
    anxiety: number | null;
    sleepQuality: number | null;
    sleepHours: number | null;
    energy: number | null;
    stress: number | null;
  };
  totalEntries: number;
  moodTrend: 'improving' | 'declining' | 'stable';
}

// ===== CONSTANTS =====
const COMMON_SYMPTOMS = [
  'Kopfschmerzen',
  'Müdigkeit',
  'Schlafstörungen',
  'Appetitlosigkeit',
  'Konzentrationsprobleme',
  'Innere Unruhe',
  'Herzrasen',
  'Schwindel',
  'Grübeln',
  'Antriebslosigkeit',
];

const COMMON_TRIGGERS = [
  'Arbeitsstress',
  'Beziehungsprobleme',
  'Familienkonflikte',
  'Finanzielle Sorgen',
  'Gesundheitliche Sorgen',
  'Einsamkeit',
  'Überforderung',
  'Schlafmangel',
  'Negative Nachrichten',
  'Soziale Medien',
];

const COMMON_ACTIVITIES = [
  'Sport/Bewegung',
  'Spaziergang',
  'Meditation',
  'Soziale Kontakte',
  'Hobbys',
  'Arbeit',
  'Entspannung',
  'Hausarbeit',
  'Lesen',
  'Musik hören',
];

// ===== HELPER COMPONENTS =====
function MoodIcon({ score }: { score: number }) {
  if (score >= 7)
    return <Smile className="text-green-500" size={24} />;
  if (score >= 4)
    return <Meh className="text-yellow-500" size={24} />;
  return <Frown className="text-red-500" size={24} />;
}

function TrendIcon({ trend }: { trend: string }) {
  switch (trend) {
    case 'improving':
      return <TrendingUp className="text-green-500" size={20} />;
    case 'declining':
      return <TrendingDown className="text-red-500" size={20} />;
    default:
      return <Minus className="text-gray-500" size={20} />;
  }
}

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  const percentage = (value / max) * 100;
  return (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div
        className={`h-2 rounded-full ${color}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

// ===== MAIN COMPONENT =====
export default function SymptomDiary() {
  const navigate = useNavigate();

  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [stats, setStats] = useState<DiaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MoodEntry | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    moodScore: 5,
    anxietyLevel: 0,
    sleepQuality: 3,
    sleepHours: 7,
    energyLevel: 5,
    stressLevel: 0,
    symptoms: [] as string[],
    triggers: [] as string[],
    activities: [] as string[],
    medications: [] as { name: string; dosage: string; taken: boolean }[],
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [entriesRes, statsRes] = await Promise.all([
        api.get('/symptom-diary'),
        api.get('/symptom-diary/stats'),
      ]);
      setEntries(entriesRes.data || []);
      setStats(statsRes.data || null);
    } catch (error) {
      logger.error('SymptomDiary: Fehler beim Laden', error);
      toast.error('Fehler beim Laden der Einträge');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      moodScore: 5,
      anxietyLevel: 0,
      sleepQuality: 3,
      sleepHours: 7,
      energyLevel: 5,
      stressLevel: 0,
      symptoms: [],
      triggers: [],
      activities: [],
      medications: [],
      notes: '',
    });
    setEditingEntry(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingEntry) {
        await api.put(`/symptom-diary/${editingEntry.id}`, formData);
        toast.success('Eintrag aktualisiert');
      } else {
        await api.post('/symptom-diary', formData);
        toast.success('Eintrag erstellt');
      }
      
      setShowForm(false);
      resetForm();
      loadData();
    } catch (error: any) {
      if (error.response?.status === 409) {
        toast.error('Für dieses Datum existiert bereits ein Eintrag');
      } else {
        toast.error('Fehler beim Speichern');
      }
    }
  };

  const handleEdit = (entry: MoodEntry) => {
    setFormData({
      date: entry.entry_date.split('T')[0],
      moodScore: entry.mood_score,
      anxietyLevel: entry.anxiety_level || 0,
      sleepQuality: entry.sleep_quality || 3,
      sleepHours: entry.sleep_hours || 7,
      energyLevel: entry.energy_level || 5,
      stressLevel: entry.stress_level || 0,
      symptoms: entry.symptoms || [],
      triggers: entry.triggers || [],
      activities: entry.activities || [],
      medications: (entry.medications || []).map(med => ({
        name: med.name,
        dosage: (med.dosage || '') as string,
        taken: med.taken
      })) as { name: string; dosage: string; taken: boolean }[],
      notes: entry.notes || '',
    });
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Möchten Sie diesen Eintrag wirklich löschen?')) return;
    
    try {
      await api.delete(`/symptom-diary/${id}`);
      toast.success('Eintrag gelöscht');
      loadData();
    } catch (error) {
      toast.error('Fehler beim Löschen');
    }
  };

  const toggleArrayItem = (
    field: 'symptoms' | 'triggers' | 'activities',
    item: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].includes(item)
        ? prev[field].filter((i) => i !== item)
        : [...prev[field], item],
    }));
  };

  const addMedication = () => {
    setFormData((prev) => ({
      ...prev,
      medications: [...prev.medications, { name: '', dosage: '', taken: false }],
    }));
  };

  const updateMedication = (
    index: number,
    field: 'name' | 'dosage' | 'taken',
    value: string | boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      medications: prev.medications.map((med, i) =>
        i === index ? { ...med, [field]: value } : med
      ),
    }));
  };

  const removeMedication = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index),
    }));
  };

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
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft size={24} />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Symptom-Tagebuch
                </h1>
                <p className="text-sm text-gray-600">
                  Verfolgen Sie Ihre tägliche Stimmung und Symptome
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus size={20} />
              Neuer Eintrag
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        {stats && stats.totalEntries > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Durchschnitt Stimmung</p>
                  <p className="text-2xl font-bold">
                    {stats.averages.mood?.toFixed(1) || '-'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <TrendIcon trend={stats.moodTrend} />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">Ø Schlaf</p>
              <p className="text-2xl font-bold">
                {stats.averages.sleepHours?.toFixed(1) || '-'}h
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">Ø Angst</p>
              <p className="text-2xl font-bold">
                {stats.averages.anxiety?.toFixed(1) || '-'}/10
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">Einträge gesamt</p>
              <p className="text-2xl font-bold">{stats.totalEntries}</p>
            </div>
          </div>
        )}

        {/* Entry Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-bold">
                  {editingEntry ? 'Eintrag bearbeiten' : 'Neuer Tagebucheintrag'}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="inline mr-2" size={16} />
                    Datum
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                    max={format(new Date(), 'yyyy-MM-dd')}
                    className="w-full border rounded-lg px-3 py-2"
                    disabled={!!editingEntry}
                  />
                </div>

                {/* Mood Score */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Smile className="inline mr-2" size={16} />
                    Stimmung: {formData.moodScore}/10
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={formData.moodScore}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        moodScore: parseInt(e.target.value),
                      })
                    }
                    className="w-full h-2 bg-gray-200 rounded-lg cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Sehr schlecht</span>
                    <span>Sehr gut</span>
                  </div>
                </div>

                {/* Anxiety Level */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <AlertTriangle className="inline mr-2" size={16} />
                    Angst/Anspannung: {formData.anxietyLevel}/10
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={formData.anxietyLevel}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        anxietyLevel: parseInt(e.target.value),
                      })
                    }
                    className="w-full h-2 bg-gray-200 rounded-lg cursor-pointer accent-orange-500"
                  />
                </div>

                {/* Sleep */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Moon className="inline mr-2" size={16} />
                      Schlafqualität
                    </label>
                    <select
                      value={formData.sleepQuality}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          sleepQuality: parseInt(e.target.value),
                        })
                      }
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value={1}>Sehr schlecht</option>
                      <option value={2}>Schlecht</option>
                      <option value={3}>Mittelmäßig</option>
                      <option value={4}>Gut</option>
                      <option value={5}>Sehr gut</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Schlafstunden
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="24"
                      step="0.5"
                      value={formData.sleepHours}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          sleepHours: parseFloat(e.target.value),
                        })
                      }
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                {/* Energy & Stress */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Activity className="inline mr-2" size={16} />
                      Energie: {formData.energyLevel}/10
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={formData.energyLevel}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          energyLevel: parseInt(e.target.value),
                        })
                      }
                      className="w-full h-2 bg-gray-200 rounded-lg cursor-pointer accent-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Stress: {formData.stressLevel}/10
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={formData.stressLevel}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          stressLevel: parseInt(e.target.value),
                        })
                      }
                      className="w-full h-2 bg-gray-200 rounded-lg cursor-pointer accent-red-500"
                    />
                  </div>
                </div>

                {/* Symptoms */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Symptome heute
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_SYMPTOMS.map((symptom) => (
                      <button
                        key={symptom}
                        type="button"
                        onClick={() => toggleArrayItem('symptoms', symptom)}
                        className={`px-3 py-1 rounded-full text-sm transition ${
                          formData.symptoms.includes(symptom)
                            ? 'bg-red-100 text-red-700 border-red-300 border'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {symptom}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Triggers */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Auslöser/Trigger
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_TRIGGERS.map((trigger) => (
                      <button
                        key={trigger}
                        type="button"
                        onClick={() => toggleArrayItem('triggers', trigger)}
                        className={`px-3 py-1 rounded-full text-sm transition ${
                          formData.triggers.includes(trigger)
                            ? 'bg-orange-100 text-orange-700 border-orange-300 border'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {trigger}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Activities */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Aktivitäten heute
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_ACTIVITIES.map((activity) => (
                      <button
                        key={activity}
                        type="button"
                        onClick={() => toggleArrayItem('activities', activity)}
                        className={`px-3 py-1 rounded-full text-sm transition ${
                          formData.activities.includes(activity)
                            ? 'bg-green-100 text-green-700 border-green-300 border'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {activity}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Medications */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Pill className="inline mr-2" size={16} />
                    Medikamente
                  </label>
                  {formData.medications.map((med, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="Medikament"
                        value={med.name}
                        onChange={(e) =>
                          updateMedication(index, 'name', e.target.value)
                        }
                        className="flex-1 border rounded-lg px-3 py-2"
                      />
                      <input
                        type="text"
                        placeholder="Dosierung"
                        value={med.dosage}
                        onChange={(e) =>
                          updateMedication(index, 'dosage', e.target.value)
                        }
                        className="w-28 border rounded-lg px-3 py-2"
                      />
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={med.taken}
                          onChange={(e) =>
                            updateMedication(index, 'taken', e.target.checked)
                          }
                          className="rounded"
                        />
                        <span className="text-sm">✓</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => removeMedication(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addMedication}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    + Medikament hinzufügen
                  </button>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notizen
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    rows={4}
                    placeholder="Wie war Ihr Tag? Was haben Sie beobachtet?"
                    className="w-full border rounded-lg px-3 py-2 resize-none"
                    maxLength={2000}
                  />
                </div>

                {/* Submit */}
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Save size={20} />
                    Speichern
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Entries List */}
        {entries.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-gray-400 mb-4">
              <Calendar size={48} className="mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Noch keine Einträge
            </h3>
            <p className="text-gray-500 mb-4">
              Beginnen Sie mit Ihrem ersten Tagebucheintrag, um Ihre Stimmung
              und Symptome zu verfolgen.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Ersten Eintrag erstellen
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="bg-white rounded-lg shadow p-4 hover:shadow-md transition"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <MoodIcon score={entry.mood_score} />
                    <div>
                      <p className="font-semibold">
                        {format(parseISO(entry.entry_date), 'EEEE, d. MMMM yyyy', {
                          locale: de,
                        })}
                      </p>
                      <p className="text-sm text-gray-600">
                        Stimmung: {entry.mood_score}/10 | Schlaf:{' '}
                        {entry.sleep_hours}h | Angst: {entry.anxiety_level || 0}
                        /10
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(entry)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Visual Bars */}
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Stimmung</p>
                    <ScoreBar
                      value={entry.mood_score}
                      max={10}
                      color="bg-blue-500"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Energie</p>
                    <ScoreBar
                      value={entry.energy_level || 5}
                      max={10}
                      color="bg-green-500"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Stress</p>
                    <ScoreBar
                      value={entry.stress_level || 0}
                      max={10}
                      color="bg-red-500"
                    />
                  </div>
                </div>

                {/* Tags */}
                {(entry.symptoms?.length > 0 ||
                  entry.triggers?.length > 0 ||
                  entry.activities?.length > 0) && (
                  <div className="mt-4 flex flex-wrap gap-1">
                    {entry.symptoms?.map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full"
                      >
                        {s}
                      </span>
                    ))}
                    {entry.triggers?.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full"
                      >
                        {t}
                      </span>
                    ))}
                    {entry.activities?.map((a) => (
                      <span
                        key={a}
                        className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                )}

                {/* Notes Preview */}
                {entry.notes && (
                  <p className="mt-3 text-sm text-gray-600 italic line-clamp-2">
                    "{entry.notes}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
