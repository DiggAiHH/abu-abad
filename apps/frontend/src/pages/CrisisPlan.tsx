import { useState, useEffect } from 'react';
import { api } from '../api/client';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { logger } from '../utils/logger';
import {
  ArrowLeft,
  AlertTriangle,
  Phone,
  Users,
  Heart,
  Shield,
  Plus,
  Save,
  Trash2,
  Star,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ===== TYPES =====
interface CopingStrategy {
  strategy: string;
  category: string;
  effectiveness?: number;
}

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  availableWhen?: string;
}

interface ProfessionalContact {
  name: string;
  role: string;
  phone: string;
  organization?: string;
}

interface CrisisHotline {
  name: string;
  phone: string;
  available?: string;
}

interface CrisisPlan {
  warningSignsThoughts: string[];
  warningSignsBehaviors: string[];
  warningSignsPhysical: string[];
  warningSignsEmotional: string[];
  copingStrategies: CopingStrategy[];
  safeEnvironmentSteps: string[];
  itemsToRemove: string[];
  safePlace: string;
  emergencyContacts: EmergencyContact[];
  professionalContacts: ProfessionalContact[];
  reasonsToLive: string[];
  crisisHotlines: CrisisHotline[];
  additionalNotes: string;
}

const EMPTY_PLAN: CrisisPlan = {
  warningSignsThoughts: [],
  warningSignsBehaviors: [],
  warningSignsPhysical: [],
  warningSignsEmotional: [],
  copingStrategies: [],
  safeEnvironmentSteps: [],
  itemsToRemove: [],
  safePlace: '',
  emergencyContacts: [],
  professionalContacts: [],
  reasonsToLive: [],
  crisisHotlines: [],
  additionalNotes: '',
};

// ===== MAIN COMPONENT =====
export default function CrisisPlan() {
  const navigate = useNavigate();

  const [plan, setPlan] = useState<CrisisPlan>(EMPTY_PLAN);
  const [defaults, setDefaults] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['hotlines', 'contacts'])
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [planRes, defaultsRes] = await Promise.all([
        api.get('/crisis-plan'),
        api.get('/crisis-plan/defaults'),
      ]);

      setDefaults(defaultsRes.data);

      if (planRes.data.exists && planRes.data.plan) {
        setPlan({ ...EMPTY_PLAN, ...planRes.data.plan });
      } else {
        // Pre-fill with default hotlines
        setPlan({
          ...EMPTY_PLAN,
          crisisHotlines: defaultsRes.data.crisisHotlines || [],
        });
      }
    } catch (error) {
      logger.error('CrisisPlan: Fehler beim Laden', error);
      toast.error('Fehler beim Laden des Krisenplans');
    } finally {
      setLoading(false);
    }
  };

  const savePlan = async () => {
    setSaving(true);
    try {
      await api.post('/crisis-plan', plan);
      toast.success('Krisenplan gespeichert');
    } catch (error) {
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const addToArray = (field: keyof CrisisPlan, value: any) => {
    setPlan((prev) => ({
      ...prev,
      [field]: [...(prev[field] as any[]), value],
    }));
  };

  const removeFromArray = (field: keyof CrisisPlan, index: number) => {
    setPlan((prev) => ({
      ...prev,
      [field]: (prev[field] as any[]).filter((_, i) => i !== index),
    }));
  };

  const updateArrayItem = (
    field: keyof CrisisPlan,
    index: number,
    key: string,
    value: any
  ) => {
    setPlan((prev) => ({
      ...prev,
      [field]: (prev[field] as any[]).map((item, i) =>
        i === index ? { ...item, [key]: value } : item
      ),
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  // ===== SECTION COMPONENT =====
  const Section = ({
    id,
    title,
    icon,
    color,
    children,
  }: {
    id: string;
    title: string;
    icon: React.ReactNode;
    color: string;
    children: React.ReactNode;
  }) => {
    const isExpanded = expandedSections.has(id);
    return (
      <div className={`bg-white rounded-lg shadow overflow-hidden border-l-4 ${color}`}>
        <button
          onClick={() => toggleSection(id)}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            {icon}
            <h3 className="font-bold">{title}</h3>
          </div>
          {isExpanded ? <ChevronUp /> : <ChevronDown />}
        </button>
        {isExpanded && <div className="px-4 pb-4">{children}</div>}
      </div>
    );
  };

  // ===== STRING LIST COMPONENT =====
  const StringList = ({
    items,
    field,
    placeholder,
    examples,
  }: {
    items: string[];
    field: keyof CrisisPlan;
    placeholder: string;
    examples?: string[];
  }) => {
    const [newItem, setNewItem] = useState('');

    const handleAdd = () => {
      if (newItem.trim()) {
        addToArray(field, newItem.trim());
        setNewItem('');
      }
    };

    return (
      <div>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
            placeholder={placeholder}
            className="flex-1 border rounded px-3 py-2"
          />
          <button
            onClick={handleAdd}
            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Plus size={20} />
          </button>
        </div>
        {examples && items.length === 0 && (
          <div className="text-sm text-gray-500 mb-2">
            Beispiele:{' '}
            {examples.map((ex, i) => (
              <button
                key={i}
                onClick={() => addToArray(field, ex)}
                className="text-blue-600 hover:underline mr-2"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {items.map((item, i) => (
            <span
              key={i}
              className="px-3 py-1 bg-gray-100 rounded-full flex items-center gap-2"
            >
              {item}
              <button
                onClick={() => removeFromArray(field, i)}
                className="text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-red-600 text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-red-700 rounded-lg"
              >
                <ArrowLeft size={24} />
              </button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Shield size={28} />
                  Mein Krisenplan
                </h1>
                <p className="text-red-100">
                  Sicherheitsnetz für schwierige Momente
                </p>
              </div>
            </div>
            <button
              onClick={savePlan}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-white text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              <Save size={20} />
              {saving ? 'Speichert...' : 'Speichern'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Emergency Quick Access */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-bold text-red-700 flex items-center gap-2 mb-3">
            <AlertTriangle />
            Notfall-Hotlines
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(plan.crisisHotlines.length > 0
              ? plan.crisisHotlines
              : defaults?.crisisHotlines || []
            ).map((hotline: CrisisHotline, i: number) => (
              <a
                key={i}
                href={`tel:${hotline.phone.replace(/\s/g, '')}`}
                className="flex items-center gap-3 p-3 bg-white rounded-lg hover:bg-red-50 transition"
              >
                <Phone className="text-red-600" />
                <div>
                  <p className="font-semibold">{hotline.name}</p>
                  <p className="text-lg text-red-600">{hotline.phone}</p>
                  {hotline.available && (
                    <p className="text-xs text-gray-500">{hotline.available}</p>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Warning Signs */}
        <Section
          id="warning"
          title="Meine Warnsignale"
          icon={<AlertTriangle className="text-orange-500" />}
          color="border-orange-500"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Gedanken
              </label>
              <StringList
                items={plan.warningSignsThoughts}
                field="warningSignsThoughts"
                placeholder="z.B. 'Alles ist hoffnungslos'"
                examples={defaults?.warningSignExamples?.thoughts}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Verhaltensweisen
              </label>
              <StringList
                items={plan.warningSignsBehaviors}
                field="warningSignsBehaviors"
                placeholder="z.B. 'Sozialer Rückzug'"
                examples={defaults?.warningSignExamples?.behaviors}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Körperliche Anzeichen
              </label>
              <StringList
                items={plan.warningSignsPhysical}
                field="warningSignsPhysical"
                placeholder="z.B. 'Schlafstörungen'"
                examples={defaults?.warningSignExamples?.physical}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Gefühle
              </label>
              <StringList
                items={plan.warningSignsEmotional}
                field="warningSignsEmotional"
                placeholder="z.B. 'Überwältigende Traurigkeit'"
                examples={defaults?.warningSignExamples?.emotional}
              />
            </div>
          </div>
        </Section>

        {/* Coping Strategies */}
        <Section
          id="coping"
          title="Meine Bewältigungsstrategien"
          icon={<Star className="text-yellow-500" />}
          color="border-yellow-500"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {defaults?.copingCategories?.map((cat: any) => (
                <div key={cat.id} className="text-sm">
                  <p className="font-medium">{cat.name}:</p>
                  <p className="text-gray-500">{cat.examples.join(', ')}</p>
                </div>
              ))}
            </div>
            <hr />
            {plan.copingStrategies.map((strategy, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-50 p-2 rounded">
                <input
                  type="text"
                  value={strategy.strategy}
                  onChange={(e) =>
                    updateArrayItem('copingStrategies', i, 'strategy', e.target.value)
                  }
                  className="flex-1 border rounded px-2 py-1"
                />
                <select
                  value={strategy.effectiveness || 3}
                  onChange={(e) =>
                    updateArrayItem(
                      'copingStrategies',
                      i,
                      'effectiveness',
                      parseInt(e.target.value)
                    )
                  }
                  className="border rounded px-2 py-1"
                >
                  <option value={1}>★</option>
                  <option value={2}>★★</option>
                  <option value={3}>★★★</option>
                  <option value={4}>★★★★</option>
                  <option value={5}>★★★★★</option>
                </select>
                <button
                  onClick={() => removeFromArray('copingStrategies', i)}
                  className="text-red-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                addToArray('copingStrategies', {
                  strategy: '',
                  category: 'other',
                  effectiveness: 3,
                })
              }
              className="text-blue-600 hover:underline flex items-center gap-1"
            >
              <Plus size={16} /> Strategie hinzufügen
            </button>
          </div>
        </Section>

        {/* Emergency Contacts */}
        <Section
          id="contacts"
          title="Meine Notfallkontakte"
          icon={<Users className="text-blue-500" />}
          color="border-blue-500"
        >
          <div className="space-y-4">
            <h4 className="font-medium">Persönliche Kontakte</h4>
            {plan.emergencyContacts.map((contact, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 items-center">
                <input
                  type="text"
                  value={contact.name}
                  onChange={(e) =>
                    updateArrayItem('emergencyContacts', i, 'name', e.target.value)
                  }
                  placeholder="Name"
                  className="border rounded px-2 py-1"
                />
                <input
                  type="text"
                  value={contact.relationship}
                  onChange={(e) =>
                    updateArrayItem('emergencyContacts', i, 'relationship', e.target.value)
                  }
                  placeholder="Beziehung"
                  className="border rounded px-2 py-1"
                />
                <input
                  type="tel"
                  value={contact.phone}
                  onChange={(e) =>
                    updateArrayItem('emergencyContacts', i, 'phone', e.target.value)
                  }
                  placeholder="Telefon"
                  className="border rounded px-2 py-1"
                />
                <button
                  onClick={() => removeFromArray('emergencyContacts', i)}
                  className="text-red-500 justify-self-center"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                addToArray('emergencyContacts', {
                  name: '',
                  relationship: '',
                  phone: '',
                })
              }
              className="text-blue-600 hover:underline flex items-center gap-1"
            >
              <Plus size={16} /> Kontakt hinzufügen
            </button>

            <hr />

            <h4 className="font-medium">Professionelle Kontakte</h4>
            {plan.professionalContacts.map((contact, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 items-center">
                <input
                  type="text"
                  value={contact.name}
                  onChange={(e) =>
                    updateArrayItem('professionalContacts', i, 'name', e.target.value)
                  }
                  placeholder="Name"
                  className="border rounded px-2 py-1"
                />
                <input
                  type="text"
                  value={contact.role}
                  onChange={(e) =>
                    updateArrayItem('professionalContacts', i, 'role', e.target.value)
                  }
                  placeholder="Rolle (z.B. Therapeut)"
                  className="border rounded px-2 py-1"
                />
                <input
                  type="tel"
                  value={contact.phone}
                  onChange={(e) =>
                    updateArrayItem('professionalContacts', i, 'phone', e.target.value)
                  }
                  placeholder="Telefon"
                  className="border rounded px-2 py-1"
                />
                <button
                  onClick={() => removeFromArray('professionalContacts', i)}
                  className="text-red-500 justify-self-center"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                addToArray('professionalContacts', {
                  name: '',
                  role: '',
                  phone: '',
                })
              }
              className="text-blue-600 hover:underline flex items-center gap-1"
            >
              <Plus size={16} /> Professionellen Kontakt hinzufügen
            </button>
          </div>
        </Section>

        {/* Reasons to Live */}
        <Section
          id="reasons"
          title="Meine Gründe zu leben"
          icon={<Heart className="text-pink-500" />}
          color="border-pink-500"
        >
          <p className="text-gray-600 text-sm mb-4">
            Was ist Ihnen wichtig? Wofür lohnt es sich weiterzumachen?
          </p>
          <StringList
            items={plan.reasonsToLive}
            field="reasonsToLive"
            placeholder="z.B. 'Meine Familie', 'Mein Haustier', 'Zukunftspläne'"
          />
        </Section>

        {/* Safe Environment */}
        <Section
          id="safe"
          title="Sichere Umgebung"
          icon={<Shield className="text-green-500" />}
          color="border-green-500"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Mein sicherer Ort
              </label>
              <input
                type="text"
                value={plan.safePlace}
                onChange={(e) => setPlan({ ...plan, safePlace: e.target.value })}
                placeholder="Wo fühlen Sie sich sicher?"
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Schritte zur sicheren Umgebung
              </label>
              <StringList
                items={plan.safeEnvironmentSteps}
                field="safeEnvironmentSteps"
                placeholder="z.B. 'Medikamente wegschließen'"
              />
            </div>
          </div>
        </Section>

        {/* Additional Notes */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-bold mb-3">Zusätzliche Notizen</h3>
          <textarea
            value={plan.additionalNotes}
            onChange={(e) =>
              setPlan({ ...plan, additionalNotes: e.target.value })
            }
            rows={4}
            placeholder="Weitere wichtige Informationen für Krisensituationen..."
            className="w-full border rounded px-3 py-2"
          />
        </div>

        {/* Save Button */}
        <button
          onClick={savePlan}
          disabled={saving}
          className="w-full py-4 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Save size={24} />
          {saving ? 'Speichert...' : 'Krisenplan speichern'}
        </button>
      </main>
    </div>
  );
}
