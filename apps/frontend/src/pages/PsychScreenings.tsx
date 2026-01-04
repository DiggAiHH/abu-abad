import { useState, useEffect } from 'react';
import { api } from '../api/client';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { logger } from '../utils/logger';
import {
  ArrowLeft,
  ClipboardCheck,
  AlertTriangle,
  ChevronRight,
  CheckCircle,
  Clock,
} from 'lucide-react';

// ===== TYPES =====
interface ScreeningTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  questionCount: number;
  maxScore: number;
}

interface ScreeningResult {
  id: string;
  screening_type: string;
  total_score: number;
  severity: string;
  result_data: {
    totalScore: number;
    maxScore: number;
    percentage: number;
    severity: string;
    severityLabel: string;
    suicidalIdeation?: boolean;
    criticalAlert?: string;
  };
  created_at: string;
}

interface PendingAssignment {
  id: string;
  screening_type: string;
  due_date?: string;
  message?: string;
  therapist_first: string;
  therapist_last: string;
}

interface ScreeningQuestion {
  id: number;
  text: string;
}

interface ScreeningOption {
  value: number;
  label: string;
}

// ===== SEVERITY COLORS =====
const SEVERITY_COLORS: Record<string, string> = {
  none: 'bg-gray-100 text-gray-700',
  mild: 'bg-green-100 text-green-700',
  moderate: 'bg-yellow-100 text-yellow-700',
  'moderately-severe': 'bg-orange-100 text-orange-700',
  severe: 'bg-red-100 text-red-700',
};

// ===== MAIN COMPONENT =====
export default function PsychScreenings() {
  const navigate = useNavigate();

  const [templates, setTemplates] = useState<ScreeningTemplate[]>([]);
  const [results, setResults] = useState<ScreeningResult[]>([]);
  const [pending, setPending] = useState<PendingAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Screening State
  const [activeScreening, setActiveScreening] = useState<{
    type: string;
    name: string;
    questions: ScreeningQuestion[];
    options: ScreeningOption[];
  } | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResult, setShowResult] = useState<ScreeningResult | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [templatesRes, resultsRes, pendingRes] = await Promise.all([
        api.get('/screenings/templates'),
        api.get('/screenings/my-results'),
        api.get('/screenings/pending'),
      ]);
      setTemplates(templatesRes.data || []);
      setResults(resultsRes.data || []);
      setPending(pendingRes.data || []);
    } catch (error) {
      logger.error('PsychScreenings: Fehler beim Laden', error);
      toast.error('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const startScreening = async (type: string) => {
    try {
      const res = await api.get(`/screenings/template/${type}`);
      setActiveScreening({
        type,
        name: res.data.name,
        questions: res.data.questions,
        options: res.data.options,
      });
      setAnswers({});
    } catch (error) {
      toast.error('Fehler beim Laden des Fragebogens');
    }
  };

  const submitScreening = async () => {
    if (!activeScreening) return;

    // Prüfen ob alle Fragen beantwortet
    const unanswered = activeScreening.questions.filter(
      (q) => answers[q.id] === undefined
    );
    if (unanswered.length > 0) {
      toast.error(`Bitte beantworten Sie alle Fragen (${unanswered.length} fehlen)`);
      return;
    }

    try {
      const res = await api.post('/screenings', {
        screeningType: activeScreening.type,
        answers: Object.entries(answers).map(([id, value]) => ({
          questionId: parseInt(id),
          value,
        })),
      });

      setShowResult({
        ...res.data.result,
        screening_type: activeScreening.type,
      } as ScreeningResult);
      setActiveScreening(null);
      loadData();
    } catch (error) {
      toast.error('Fehler beim Absenden');
    }
  };

  const getScoreColor = (percentage: number) => {
    if (percentage <= 20) return 'text-gray-500';
    if (percentage <= 40) return 'text-green-500';
    if (percentage <= 60) return 'text-yellow-500';
    if (percentage <= 80) return 'text-orange-500';
    return 'text-red-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  // Result Modal
  if (showResult) {
    const data = showResult.result_data;
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
          <div className="text-center mb-6">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold">Fragebogen abgeschlossen</h2>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 mb-2">{showResult.screening_type}</p>
            <div className="flex justify-between items-center">
              <span className="text-4xl font-bold">{data.totalScore}</span>
              <span className="text-gray-400">/ {data.maxScore}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 mt-2">
              <div
                className={`h-3 rounded-full ${
                  data.percentage <= 30
                    ? 'bg-green-500'
                    : data.percentage <= 60
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${data.percentage}%` }}
              />
            </div>
          </div>

          <div
            className={`rounded-lg p-4 mb-6 ${
              SEVERITY_COLORS[data.severity] || 'bg-gray-100'
            }`}
          >
            <p className="font-semibold text-lg">{data.severityLabel}</p>
          </div>

          {data.criticalAlert && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-red-500 flex-shrink-0" />
                <div>
                  <p className="font-bold text-red-700">Wichtiger Hinweis</p>
                  <p className="text-sm text-red-600">{data.criticalAlert}</p>
                  <p className="text-sm text-red-600 mt-2">
                    Bitte wenden Sie sich an Ihren Therapeuten oder bei akuter
                    Not an die Telefonseelsorge: 0800 111 0 111
                  </p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => setShowResult(null)}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Zurück zur Übersicht
          </button>
        </div>
      </div>
    );
  }

  // Active Screening Form
  if (activeScreening) {
    const answeredCount = Object.keys(answers).length;
    const progress = (answeredCount / activeScreening.questions.length) * 100;

    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setActiveScreening(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft size={24} />
              </button>
              <span className="text-sm text-gray-500">
                {answeredCount} / {activeScreening.questions.length}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-6">
          <h2 className="text-xl font-bold mb-2">{activeScreening.name}</h2>
          <p className="text-gray-600 mb-6">
            In den letzten 2 Wochen, wie oft wurden Sie von den folgenden
            Problemen beeinträchtigt?
          </p>

          <div className="space-y-6">
            {activeScreening.questions.map((question, index) => (
              <div key={question.id} className="bg-white rounded-lg shadow p-4">
                <p className="font-medium mb-4">
                  {index + 1}. {question.text}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {activeScreening.options.map((option) => (
                    <button
                      key={option.value}
                      onClick={() =>
                        setAnswers({ ...answers, [question.id]: option.value })
                      }
                      className={`p-3 rounded-lg text-sm transition ${
                        answers[question.id] === option.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={submitScreening}
            disabled={answeredCount < activeScreening.questions.length}
            className="w-full mt-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Fragebogen absenden
          </button>
        </main>
      </div>
    );
  }

  // Main Dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Psychologische Fragebögen
              </h1>
              <p className="text-sm text-gray-600">
                PHQ-9, GAD-7 und weitere standardisierte Tests
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Pending Assignments */}
        {pending.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Clock className="text-orange-500" />
              Ausstehende Fragebögen
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pending.map((assignment) => (
                <div
                  key={assignment.id}
                  className="bg-orange-50 border border-orange-200 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{assignment.screening_type}</p>
                      <p className="text-sm text-gray-600">
                        Zugewiesen von Dr. {assignment.therapist_first}{' '}
                        {assignment.therapist_last}
                      </p>
                      {assignment.due_date && (
                        <p className="text-sm text-orange-600">
                          Fällig bis:{' '}
                          {format(parseISO(assignment.due_date), 'dd.MM.yyyy', {
                            locale: de,
                          })}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => startScreening(assignment.screening_type)}
                      className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                    >
                      Starten
                    </button>
                  </div>
                  {assignment.message && (
                    <p className="mt-2 text-sm italic text-gray-600">
                      "{assignment.message}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available Templates */}
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-4">Verfügbare Fragebögen</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition cursor-pointer"
                onClick={() => startScreening(template.id)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                      {template.category}
                    </span>
                    <h3 className="font-bold mt-2">{template.id}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {template.description}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      {template.questionCount} Fragen
                    </p>
                  </div>
                  <ChevronRight className="text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Previous Results */}
        <div>
          <h2 className="text-lg font-bold mb-4">Meine Ergebnisse</h2>
          {results.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <ClipboardCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Noch keine Fragebögen ausgefüllt</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((result) => {
                const data = result.result_data;
                return (
                  <div
                    key={result.id}
                    className="bg-white rounded-lg shadow p-4"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold">{result.screening_type}</p>
                        <p className="text-sm text-gray-500">
                          {format(parseISO(result.created_at), 'dd.MM.yyyy HH:mm', {
                            locale: de,
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-2xl font-bold ${getScoreColor(data.percentage)}`}>
                          {data.totalScore}/{data.maxScore}
                        </p>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            SEVERITY_COLORS[data.severity] || 'bg-gray-100'
                          }`}
                        >
                          {data.severityLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
