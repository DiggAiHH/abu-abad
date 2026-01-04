import { useState, useEffect } from 'react';
import { api } from '../api/client';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { useNavigate, useParams } from 'react-router-dom';
import { logger } from '../utils/logger';
import {
  ArrowLeft,
  Save,
  AlertTriangle,
  FileText,
  User,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Edit2,
} from 'lucide-react';

// ===== TYPES =====
interface TherapyNote {
  id: string;
  patient_id: string;
  first_name: string;
  last_name: string;
  session_date: string;
  session_number?: number;
  session_duration?: number;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  diagnosis: string[];
  interventions: string[];
  homework?: string;
  risk_assessment: 'none' | 'low' | 'moderate' | 'high' | 'acute';
  suicidal_ideation: boolean;
  mental_status: MentalStatus;
  progress_rating?: number;
  goals_addressed: string[];
  next_session_planned?: string;
  follow_up_required: boolean;
}

interface MentalStatus {
  appearance?: string;
  behavior?: string;
  speech?: string;
  mood?: string;
  affect?: string;
  thought?: string;
  perception?: string;
  cognition?: string;
  insight?: string;
  judgment?: string;
}

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
}

// ===== CONSTANTS =====
const RISK_COLORS = {
  none: 'bg-gray-100 text-gray-700',
  low: 'bg-green-100 text-green-700',
  moderate: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  acute: 'bg-red-100 text-red-700',
};

const RISK_LABELS = {
  none: 'Kein Risiko',
  low: 'Niedriges Risiko',
  moderate: 'Moderates Risiko',
  high: 'Hohes Risiko',
  acute: 'Akutes Risiko',
};

const COMMON_INTERVENTIONS = [
  'Kognitive Umstrukturierung',
  'Verhaltensexperimente',
  'Exposition',
  'Achtsamkeitsübungen',
  'Entspannungstechniken',
  'Psychoedukation',
  'Aktivitätsaufbau',
  'Problemlösetraining',
  'Soziales Kompetenztraining',
  'Stuhldialog',
  'EMDR',
  'Imaginative Verfahren',
];

// ===== MAIN COMPONENT =====
export default function TherapyNotes() {
  const navigate = useNavigate();
  const { patientId } = useParams<{ patientId?: string }>();

  const [notes, setNotes] = useState<TherapyNote[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>(patientId || '');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<TherapyNote | null>(null);
  const [expandedNote, setExpandedNote] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    sessionDate: string;
    sessionDuration: number;
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    diagnosis: string[];
    interventions: string[];
    homework: string;
    riskAssessment: 'none' | 'low' | 'moderate' | 'high' | 'acute';
    suicidalIdeation: boolean;
    mentalStatus: MentalStatus;
    progressRating: number;
    goalsAddressed: string[];
    followUpRequired: boolean;
  }>({
    sessionDate: new Date().toISOString().split('T')[0],
    sessionDuration: 50,
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    diagnosis: [] as string[],
    interventions: [] as string[],
    homework: '',
    riskAssessment: 'none',
    suicidalIdeation: false,
    mentalStatus: {} as MentalStatus,
    progressRating: 3,
    goalsAddressed: [] as string[],
    followUpRequired: false,
  });

  useEffect(() => {
    loadPatients();
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      loadNotes(selectedPatient);
    }
  }, [selectedPatient]);

  const loadPatients = async () => {
    try {
      // Lade Patienten mit aktiven Terminen
      const res = await api.get('/appointments?status=booked');
      const appointments = res.data || [];
      
      // Unique Patienten extrahieren
      const patientMap = new Map<string, Patient>();
      appointments.forEach((apt: any) => {
        if (apt.patientId && apt.patient) {
          patientMap.set(apt.patientId, {
            id: apt.patientId,
            first_name: apt.patient.firstName,
            last_name: apt.patient.lastName,
          });
        }
      });
      
      setPatients(Array.from(patientMap.values()));
    } catch (error) {
      logger.error('TherapyNotes: Fehler beim Laden der Patienten', error);
    } finally {
      setLoading(false);
    }
  };

  const loadNotes = async (patientId: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/therapy-notes/patient/${patientId}`);
      setNotes(res.data || []);
    } catch (error) {
      logger.error('TherapyNotes: Fehler beim Laden der Notizen', error);
      toast.error('Fehler beim Laden der Notizen');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      sessionDate: format(new Date(), 'yyyy-MM-dd'),
      sessionDuration: 50,
      subjective: '',
      objective: '',
      assessment: '',
      plan: '',
      diagnosis: [],
      interventions: [],
      homework: '',
      riskAssessment: 'none',
      suicidalIdeation: false,
      mentalStatus: {},
      progressRating: 3,
      goalsAddressed: [],
      followUpRequired: false,
    });
    setEditingNote(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPatient) {
      toast.error('Bitte wählen Sie einen Patienten');
      return;
    }

    try {
      if (editingNote) {
        await api.put(`/therapy-notes/${editingNote.id}`, formData);
        toast.success('Notiz aktualisiert');
      } else {
        await api.post('/therapy-notes', {
          ...formData,
          patientId: selectedPatient,
        });
        toast.success('Notiz erstellt');
      }
      
      setShowForm(false);
      resetForm();
      loadNotes(selectedPatient);
    } catch (error) {
      toast.error('Fehler beim Speichern');
    }
  };

  const handleEdit = (note: TherapyNote) => {
    setFormData({
      sessionDate: note.session_date.split('T')[0],
      sessionDuration: note.session_duration || 50,
      subjective: note.subjective || '',
      objective: note.objective || '',
      assessment: note.assessment || '',
      plan: note.plan || '',
      diagnosis: note.diagnosis || [],
      interventions: note.interventions || [],
      homework: note.homework || '',
      riskAssessment: note.risk_assessment,
      suicidalIdeation: note.suicidal_ideation,
      mentalStatus: note.mental_status || {},
      progressRating: note.progress_rating || 3,
      goalsAddressed: note.goals_addressed || [],
      followUpRequired: note.follow_up_required,
    });
    setEditingNote(note);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Möchten Sie diese Notiz wirklich löschen?')) return;
    
    try {
      await api.delete(`/therapy-notes/${id}`);
      toast.success('Notiz gelöscht');
      loadNotes(selectedPatient);
    } catch (error) {
      toast.error('Fehler beim Löschen');
    }
  };

  const toggleIntervention = (intervention: string) => {
    setFormData((prev) => ({
      ...prev,
      interventions: prev.interventions.includes(intervention)
        ? prev.interventions.filter((i) => i !== intervention)
        : [...prev.interventions, intervention],
    }));
  };

  if (loading && !selectedPatient) {
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
                  Therapie-Notizen
                </h1>
                <p className="text-sm text-gray-600">
                  Sitzungsdokumentation im SOAP-Format
                </p>
              </div>
            </div>
            {selectedPatient && (
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Plus size={20} />
                Neue Notiz
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Patient Selection */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <User className="inline mr-2" size={16} />
            Patient auswählen
          </label>
          <select
            value={selectedPatient}
            onChange={(e) => setSelectedPatient(e.target.value)}
            className="w-full md:w-1/2 border rounded-lg px-3 py-2"
          >
            <option value="">-- Patient wählen --</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.first_name} {p.last_name}
              </option>
            ))}
          </select>
        </div>

        {/* Notes Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-bold">
                  {editingNote ? 'Notiz bearbeiten' : 'Neue Sitzungsnotiz'}
                </h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Session Metadata */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sitzungsdatum
                    </label>
                    <input
                      type="date"
                      value={formData.sessionDate}
                      onChange={(e) =>
                        setFormData({ ...formData, sessionDate: e.target.value })
                      }
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dauer (Minuten)
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="180"
                      value={formData.sessionDuration}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          sessionDuration: parseInt(e.target.value),
                        })
                      }
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                {/* SOAP Format */}
                <div className="space-y-4">
                  <h3 className="font-bold text-lg border-b pb-2">
                    📋 SOAP-Dokumentation
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <span className="text-blue-600 font-bold">S</span>ubjektiv
                      - Patientenbericht
                    </label>
                    <textarea
                      value={formData.subjective}
                      onChange={(e) =>
                        setFormData({ ...formData, subjective: e.target.value })
                      }
                      rows={4}
                      placeholder="Was berichtet der Patient? Beschwerden, Ereignisse, Gefühle..."
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <span className="text-green-600 font-bold">O</span>bjektiv
                      - Beobachtungen
                    </label>
                    <textarea
                      value={formData.objective}
                      onChange={(e) =>
                        setFormData({ ...formData, objective: e.target.value })
                      }
                      rows={4}
                      placeholder="Therapeutische Beobachtungen: Verhalten, Affekt, Interaktion..."
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <span className="text-purple-600 font-bold">A</span>
                      ssessment - Einschätzung
                    </label>
                    <textarea
                      value={formData.assessment}
                      onChange={(e) =>
                        setFormData({ ...formData, assessment: e.target.value })
                      }
                      rows={4}
                      placeholder="Diagnostische Einschätzung, Hypothesen, Verlaufsbeurteilung..."
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <span className="text-orange-600 font-bold">P</span>lan -
                      Weiteres Vorgehen
                    </label>
                    <textarea
                      value={formData.plan}
                      onChange={(e) =>
                        setFormData({ ...formData, plan: e.target.value })
                      }
                      rows={4}
                      placeholder="Behandlungsplan, nächste Schritte, Interventionen..."
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                {/* Interventions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Durchgeführte Interventionen
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_INTERVENTIONS.map((int) => (
                      <button
                        key={int}
                        type="button"
                        onClick={() => toggleIntervention(int)}
                        className={`px-3 py-1 rounded-full text-sm transition ${
                          formData.interventions.includes(int)
                            ? 'bg-blue-100 text-blue-700 border-blue-300 border'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {int}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Homework */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hausaufgaben für den Patienten
                  </label>
                  <textarea
                    value={formData.homework}
                    onChange={(e) =>
                      setFormData({ ...formData, homework: e.target.value })
                    }
                    rows={2}
                    placeholder="Übungen, Tagebuch führen, Verhaltensexperimente..."
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>

                {/* Risk Assessment */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-bold text-red-700 mb-3 flex items-center gap-2">
                    <AlertTriangle size={20} />
                    Risikobewertung
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Risikostufe
                      </label>
                      <select
                        value={formData.riskAssessment}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            riskAssessment: e.target.value as any,
                          })
                        }
                        className="w-full border rounded-lg px-3 py-2"
                      >
                        <option value="none">Kein Risiko</option>
                        <option value="low">Niedriges Risiko</option>
                        <option value="moderate">Moderates Risiko</option>
                        <option value="high">Hohes Risiko</option>
                        <option value="acute">Akutes Risiko</option>
                      </select>
                    </div>
                    <div className="flex items-center">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.suicidalIdeation}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              suicidalIdeation: e.target.checked,
                            })
                          }
                          className="rounded"
                        />
                        <span className="text-sm font-medium text-red-700">
                          Suizidale Gedanken berichtet
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Progress */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fortschrittsbewertung: {formData.progressRating}/5
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={formData.progressRating}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        progressRating: parseInt(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Verschlechterung</span>
                    <span>Keine Änderung</span>
                    <span>Deutliche Besserung</span>
                  </div>
                </div>

                {/* Follow Up */}
                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.followUpRequired}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          followUpRequired: e.target.checked,
                        })
                      }
                      className="rounded"
                    />
                    <span className="text-sm font-medium">
                      Dringender Follow-up erforderlich
                    </span>
                  </label>
                </div>

                {/* Submit */}
                <div className="flex gap-4 pt-4">
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

        {/* Notes List */}
        {!selectedPatient ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <User size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Kein Patient ausgewählt
            </h3>
            <p className="text-gray-500">
              Wählen Sie einen Patienten, um dessen Therapienotizen zu sehen.
            </p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner" />
          </div>
        ) : notes.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <FileText size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Keine Notizen vorhanden
            </h3>
            <p className="text-gray-500 mb-4">
              Erstellen Sie die erste Sitzungsnotiz für diesen Patienten.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Erste Notiz erstellen
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {notes.map((note) => (
              <div
                key={note.id}
                className="bg-white rounded-lg shadow overflow-hidden"
              >
                {/* Note Header */}
                <div
                  className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50"
                  onClick={() =>
                    setExpandedNote(expandedNote === note.id ? null : note.id)
                  }
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {format(parseISO(note.session_date), 'dd', {
                          locale: de,
                        })}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(parseISO(note.session_date), 'MMM yy', {
                          locale: de,
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold">
                        {note.first_name} {note.last_name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {note.session_duration} Min | Fortschritt:{' '}
                        {note.progress_rating || '-'}/5
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        RISK_COLORS[note.risk_assessment]
                      }`}
                    >
                      {RISK_LABELS[note.risk_assessment]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(note);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(note.id);
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                    {expandedNote === note.id ? (
                      <ChevronUp size={20} />
                    ) : (
                      <ChevronDown size={20} />
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedNote === note.id && (
                  <div className="border-t p-4 space-y-4">
                    {/* SOAP Sections */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {note.subjective && (
                        <div className="bg-blue-50 rounded p-3">
                          <h4 className="font-bold text-blue-700 text-sm mb-1">
                            Subjektiv
                          </h4>
                          <p className="text-sm">{note.subjective}</p>
                        </div>
                      )}
                      {note.objective && (
                        <div className="bg-green-50 rounded p-3">
                          <h4 className="font-bold text-green-700 text-sm mb-1">
                            Objektiv
                          </h4>
                          <p className="text-sm">{note.objective}</p>
                        </div>
                      )}
                      {note.assessment && (
                        <div className="bg-purple-50 rounded p-3">
                          <h4 className="font-bold text-purple-700 text-sm mb-1">
                            Assessment
                          </h4>
                          <p className="text-sm">{note.assessment}</p>
                        </div>
                      )}
                      {note.plan && (
                        <div className="bg-orange-50 rounded p-3">
                          <h4 className="font-bold text-orange-700 text-sm mb-1">
                            Plan
                          </h4>
                          <p className="text-sm">{note.plan}</p>
                        </div>
                      )}
                    </div>

                    {/* Interventions */}
                    {note.interventions?.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm text-gray-700 mb-1">
                          Interventionen:
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {note.interventions.map((int, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full"
                            >
                              {int}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Homework */}
                    {note.homework && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                        <h4 className="font-bold text-yellow-700 text-sm mb-1">
                          📝 Hausaufgaben
                        </h4>
                        <p className="text-sm">{note.homework}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
