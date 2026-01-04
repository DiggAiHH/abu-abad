import { useState, useEffect } from 'react';
import { api } from '../api/client';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { logger } from '../utils/logger';
import {
  ArrowLeft,
  BookOpen,
  Check,
  Clock,
  Play,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Calendar,
  Target,
  Smile,
  Frown,
} from 'lucide-react';

// ===== TYPES =====
interface Exercise {
  id: number;
  title: string;
  description?: string;
  category: string;
  categoryLabel: string;
  instructions?: string;
  frequency: string;
  dueDate?: string;
  estimatedMinutes?: number;
  status: string;
  completionCount: number;
  lastCompleted?: string;
  createdAt: string;
}

interface Completion {
  id: number;
  exerciseId: number;
  exerciseTitle: string;
  category: string;
  completed: boolean;
  duration?: number;
  difficulty?: number;
  moodBefore?: number;
  moodAfter?: number;
  notes?: string;
  completedAt: string;
}

interface Stats {
  totalExercises: number;
  totalCompletions: number;
  avgMoodChange: string | null;
  byCategory: Array<{ category: string; categoryLabel: string; completions: number }>;
  weeklyActivity: Array<{ week: string; completions: number }>;
}

const CATEGORY_COLORS: Record<string, string> = {
  behavioral_activation: 'bg-blue-500',
  exposure: 'bg-red-500',
  cognitive_restructuring: 'bg-purple-500',
  relaxation: 'bg-green-500',
  mindfulness: 'bg-teal-500',
  social_skills: 'bg-yellow-500',
  problem_solving: 'bg-orange-500',
  emotion_regulation: 'bg-pink-500',
  self_care: 'bg-indigo-500',
  journaling: 'bg-cyan-500',
  other: 'bg-gray-500',
};

const FREQUENCY_LABELS: Record<string, string> = {
  once: 'Einmalig',
  daily: 'Täglich',
  weekly: 'Wöchentlich',
  as_needed: 'Bei Bedarf',
};

export default function Exercises() {
  const navigate = useNavigate();

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'stats'>('active');
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);

  // Completion Modal
  const [completingExercise, setCompletingExercise] = useState<Exercise | null>(null);
  const [completionData, setCompletionData] = useState({
    duration: 0,
    difficulty: 5,
    moodBefore: 5,
    moodAfter: 5,
    notes: '',
    barriers: [] as string[],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [exercisesRes, completionsRes, statsRes] = await Promise.all([
        api.get('/exercises?status=active'),
        api.get('/exercises/completions?days=30'),
        api.get('/exercises/stats?days=30'),
      ]);

      setExercises(exercisesRes.data);
      setCompletions(completionsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      logger.error('Exercises: Fehler beim Laden', error);
      toast.error('Fehler beim Laden der Übungen');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteExercise = async () => {
    if (!completingExercise) return;
    try {
      await api.post('/exercises/complete', {
        exerciseId: completingExercise.id,
        completed: true,
        ...completionData,
      });
      toast.success('Übung als erledigt markiert! 🎉');
      setCompletingExercise(null);
      setCompletionData({
        duration: 0,
        difficulty: 5,
        moodBefore: 5,
        moodAfter: 5,
        notes: '',
        barriers: [],
      });
      loadData();
    } catch (error) {
      toast.error('Fehler beim Speichern');
    }
  };

  const todayCompleted = completions.filter(
    (c) => new Date(c.completedAt).toDateString() === new Date().toDateString()
  ).length;

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
      <header className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg">
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
                  <BookOpen size={28} />
                  Übungen & Hausaufgaben
                </h1>
                <p className="text-purple-100">
                  {exercises.length} aktive Übungen · {todayCompleted} heute erledigt
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <div className="flex bg-white rounded-lg shadow overflow-hidden">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'active'
                ? 'bg-purple-600 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Target size={16} className="inline mr-1" />
            Aktive Übungen
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'history'
                ? 'bg-purple-600 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Calendar size={16} className="inline mr-1" />
            Verlauf
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'stats'
                ? 'bg-purple-600 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <TrendingUp size={16} className="inline mr-1" />
            Statistik
          </button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* ACTIVE TAB */}
        {activeTab === 'active' && (
          <div className="space-y-4">
            {exercises.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Keine aktiven Übungen</p>
                <p className="text-sm text-gray-400 mt-2">
                  Ihr Therapeut kann Ihnen Übungen zuweisen
                </p>
              </div>
            ) : (
              exercises.map((exercise) => {
                const isExpanded = expandedExercise === exercise.id;
                const colorClass = CATEGORY_COLORS[exercise.category] || 'bg-gray-500';

                return (
                  <div key={exercise.id} className="bg-white rounded-lg shadow overflow-hidden">
                    <div
                      className="p-4 cursor-pointer hover:bg-gray-50"
                      onClick={() =>
                        setExpandedExercise(isExpanded ? null : exercise.id)
                      }
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-12 rounded ${colorClass}`} />
                          <div>
                            <h3 className="font-bold text-lg">{exercise.title}</h3>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <span className={`px-2 py-0.5 rounded-full text-white text-xs ${colorClass}`}>
                                {exercise.categoryLabel}
                              </span>
                              {exercise.estimatedMinutes && (
                                <span className="flex items-center gap-1">
                                  <Clock size={14} />
                                  {exercise.estimatedMinutes} Min
                                </span>
                              )}
                              <span>{FREQUENCY_LABELS[exercise.frequency]}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">
                            {exercise.completionCount}x erledigt
                          </span>
                          {isExpanded ? <ChevronUp /> : <ChevronDown />}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t">
                        {exercise.description && (
                          <p className="text-gray-600 mt-3">{exercise.description}</p>
                        )}

                        {exercise.instructions && (
                          <div className="mt-4">
                            <h4 className="font-medium mb-2">Anleitung:</h4>
                            <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                              {exercise.instructions}
                            </pre>
                          </div>
                        )}

                        {exercise.dueDate && (
                          <p className="text-sm text-gray-500 mt-3">
                            Fällig bis: {new Date(exercise.dueDate).toLocaleDateString('de-DE')}
                          </p>
                        )}

                        {exercise.lastCompleted && (
                          <p className="text-sm text-green-600 mt-2">
                            Zuletzt erledigt:{' '}
                            {new Date(exercise.lastCompleted).toLocaleString('de-DE', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCompletingExercise(exercise);
                          }}
                          className="mt-4 w-full py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 flex items-center justify-center gap-2"
                        >
                          <Play size={20} />
                          Übung durchführen & als erledigt markieren
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {completions.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Noch keine erledigten Übungen</p>
              </div>
            ) : (
              completions.map((completion) => {
                const moodChange = completion.moodBefore && completion.moodAfter
                  ? completion.moodAfter - completion.moodBefore
                  : null;

                return (
                  <div key={completion.id} className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold">{completion.exerciseTitle}</h3>
                        <p className="text-sm text-gray-500">
                          {new Date(completion.completedAt).toLocaleString('de-DE', {
                            weekday: 'short',
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      {completion.completed && (
                        <span className="flex items-center gap-1 text-green-600 bg-green-100 px-2 py-1 rounded-full text-sm">
                          <Check size={14} />
                          Erledigt
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-4 mt-3 text-sm">
                      {completion.duration && (
                        <span className="text-gray-600">
                          <Clock size={14} className="inline mr-1" />
                          {completion.duration} Min
                        </span>
                      )}
                      {completion.difficulty && (
                        <span className="text-gray-600">
                          Schwierigkeit: {completion.difficulty}/10
                        </span>
                      )}
                      {moodChange !== null && (
                        <span className={moodChange > 0 ? 'text-green-600' : moodChange < 0 ? 'text-red-600' : 'text-gray-600'}>
                          Stimmung: {moodChange > 0 ? '+' : ''}{moodChange}
                        </span>
                      )}
                    </div>

                    {completion.notes && (
                      <p className="text-sm text-gray-600 mt-2 italic">
                        "{completion.notes}"
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* STATS TAB */}
        {activeTab === 'stats' && stats && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <p className="text-3xl font-bold text-purple-600">
                  {stats.totalExercises}
                </p>
                <p className="text-sm text-gray-500">Übungen</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <p className="text-3xl font-bold text-green-600">
                  {stats.totalCompletions}
                </p>
                <p className="text-sm text-gray-500">Durchführungen</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <p className={`text-3xl font-bold ${
                  stats.avgMoodChange && parseFloat(stats.avgMoodChange) > 0
                    ? 'text-green-600'
                    : stats.avgMoodChange && parseFloat(stats.avgMoodChange) < 0
                    ? 'text-red-600'
                    : 'text-gray-400'
                }`}>
                  {stats.avgMoodChange
                    ? (parseFloat(stats.avgMoodChange) > 0 ? '+' : '') + stats.avgMoodChange
                    : '—'}
                </p>
                <p className="text-sm text-gray-500">Ø Stimmungsänderung</p>
              </div>
            </div>

            {/* By Category */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold mb-4">Nach Kategorie</h2>
              {stats.byCategory.filter(c => c.completions > 0).length === 0 ? (
                <p className="text-gray-500 text-center">Keine Daten</p>
              ) : (
                <div className="space-y-3">
                  {stats.byCategory
                    .filter((c) => c.completions > 0)
                    .sort((a, b) => b.completions - a.completions)
                    .map((cat) => {
                      const maxCompletions = Math.max(...stats.byCategory.map(c => c.completions));
                      const width = (cat.completions / maxCompletions) * 100;
                      const colorClass = CATEGORY_COLORS[cat.category] || 'bg-gray-500';

                      return (
                        <div key={cat.category}>
                          <div className="flex justify-between text-sm mb-1">
                            <span>{cat.categoryLabel}</span>
                            <span className="font-medium">{cat.completions}x</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${colorClass}`}
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Weekly Activity */}
            {stats.weeklyActivity.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-bold mb-4">Wöchentliche Aktivität</h2>
                <div className="flex items-end gap-2 h-32">
                  {stats.weeklyActivity.slice(0, 8).reverse().map((week, i) => {
                    const maxComp = Math.max(...stats.weeklyActivity.map(w => w.completions));
                    const height = (week.completions / maxComp) * 100;

                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs text-gray-600">{week.completions}</span>
                        <div
                          className="w-full bg-purple-500 rounded-t"
                          style={{ height: `${Math.max(height, 5)}%` }}
                        />
                        <span className="text-xs text-gray-500">
                          {new Date(week.week).toLocaleDateString('de-DE')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Completion Modal */}
      {completingExercise && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-purple-600 text-white p-4 rounded-t-lg">
              <h2 className="text-xl font-bold">Übung erledigt?</h2>
              <p>{completingExercise.title}</p>
            </div>

            <div className="p-4 space-y-4">
              {/* Duration */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Dauer (Minuten)
                </label>
                <input
                  type="number"
                  value={completionData.duration || ''}
                  onChange={(e) =>
                    setCompletionData({
                      ...completionData,
                      duration: parseInt(e.target.value) || 0,
                    })
                  }
                  placeholder={completingExercise.estimatedMinutes?.toString() || ''}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              {/* Mood Before */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Stimmung vorher: {completionData.moodBefore}/10
                </label>
                <div className="flex items-center gap-2">
                  <Frown className="text-red-500" size={20} />
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={completionData.moodBefore}
                    onChange={(e) =>
                      setCompletionData({
                        ...completionData,
                        moodBefore: parseInt(e.target.value),
                      })
                    }
                    className="flex-1"
                  />
                  <Smile className="text-green-500" size={20} />
                </div>
              </div>

              {/* Mood After */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Stimmung nachher: {completionData.moodAfter}/10
                </label>
                <div className="flex items-center gap-2">
                  <Frown className="text-red-500" size={20} />
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={completionData.moodAfter}
                    onChange={(e) =>
                      setCompletionData({
                        ...completionData,
                        moodAfter: parseInt(e.target.value),
                      })
                    }
                    className="flex-1"
                  />
                  <Smile className="text-green-500" size={20} />
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Schwierigkeit: {completionData.difficulty}/10
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={completionData.difficulty}
                  onChange={(e) =>
                    setCompletionData({
                      ...completionData,
                      difficulty: parseInt(e.target.value),
                    })
                  }
                  className="w-full"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Notizen (optional)
                </label>
                <textarea
                  value={completionData.notes}
                  onChange={(e) =>
                    setCompletionData({
                      ...completionData,
                      notes: e.target.value,
                    })
                  }
                  rows={3}
                  placeholder="Wie haben Sie sich gefühlt? Was haben Sie bemerkt?"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>

            <div className="p-4 border-t flex gap-2 justify-end">
              <button
                onClick={() => setCompletingExercise(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleCompleteExercise}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
              >
                <Check size={20} />
                Als erledigt speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
