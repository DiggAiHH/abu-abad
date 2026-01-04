import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Clock,
  Video,
  Heart,
  Moon,
  MessageSquare,
  CheckCircle,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Send,
  Pill,
  Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';

interface WaitingRoomData {
  sessionToken: string;
  appointment: {
    id: number;
    startTime: string;
    therapistName: string;
    roomId: string;
  };
  moodLabels: Record<number, string>;
  sleepLabels: Record<number, string>;
}

interface PreSessionData {
  currentMood: number;
  anxietyLevel: number;
  sleepQuality: number;
  mainConcerns: string;
  questionsForTherapist: string;
  medicationTaken: boolean;
  significantEvents: string;
}

const WaitingRoom: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get('appointment');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [waitingData, setWaitingData] = useState<WaitingRoomData | null>(null);
  const [, setStatus] = useState<string>('joining');
  const [preSessionCompleted, setPreSessionCompleted] = useState(false);
  const [therapistReady, setTherapistReady] = useState(false);
  const [waitingTime, setWaitingTime] = useState(0);

  // Pre-Session Formular
  const [preSession, setPreSession] = useState<PreSessionData>({
    currentMood: 5,
    anxietyLevel: 0,
    sleepQuality: 3,
    mainConcerns: '',
    questionsForTherapist: '',
    medicationTaken: false,
    significantEvents: '',
  });

  // Wartezimmer beitreten
  useEffect(() => {
    if (!appointmentId) {
      setError('Keine Termin-ID angegeben');
      setLoading(false);
      return;
    }

    joinWaitingRoom();
  }, [appointmentId]);

  // Status-Polling
  useEffect(() => {
    if (!waitingData) return;

    const interval = setInterval(() => {
      checkStatus();
      setWaitingTime((prev) => prev + 1);
    }, 5000);

    return () => clearInterval(interval);
  }, [waitingData]);

  // Bei Therapist-Ready navigieren
  useEffect(() => {
    if (therapistReady && waitingData) {
      toast.success('Ihr Therapeut ist bereit!');
      setTimeout(() => {
        navigate(`/call/${waitingData.appointment.roomId}`);
      }, 1500);
    }
  }, [therapistReady, waitingData, navigate]);

  const joinWaitingRoom = async () => {
    try {
      const res = await api.post('/waiting-room/join', {
        appointmentId: parseInt(appointmentId!, 10),
      });
      setWaitingData(res.data);
      setStatus('waiting');
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Konnte Wartezimmer nicht beitreten';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    if (!appointmentId) return;

    try {
      const res = await api.get('/waiting-room/status', {
        params: { appointmentId },
      });
      const data = res.data;
      if (data?.status === 'admitted' || data?.therapistReady) {
        setTherapistReady(true);
      }
    } catch (error) {
      // Ignorieren: Polling soll nicht spammen
    }
  };

  const submitPreSession = async () => {
    try {
      await api.post('/waiting-room/pre-session', {
        appointmentId: parseInt(appointmentId!, 10),
        ...preSession,
      });
      setPreSessionCompleted(true);
      toast.success('Fragebogen gespeichert');
    } catch (error) {
      toast.error('Netzwerkfehler');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatStartTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Wartezimmer wird vorbereitet...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Fehler</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <ArrowLeft className="w-4 h-4 inline mr-2" />
            Zurück
          </button>
        </div>
      </div>
    );
  }

  if (therapistReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4 animate-bounce" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Ihr Therapeut ist bereit!</h2>
          <p className="text-gray-600 mb-4">Sie werden jetzt zur Videositzung weitergeleitet...</p>
          <Loader2 className="w-6 h-6 animate-spin text-green-600 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">🏥 Wartezimmer</h1>
              {waitingData && (
                <p className="text-sm text-gray-500">
                  Termin um {formatStartTime(waitingData.appointment.startTime)} mit{' '}
                  {waitingData.appointment.therapistName}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Clock className="w-5 h-5" />
            <span className="font-mono">{formatTime(waitingTime * 5)}</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Status-Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="text-center mb-6">
                <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Video className="w-12 h-12 text-blue-600" />
                </div>
                <h2 className="text-lg font-semibold">Warten auf Therapeuten</h2>
                <p className="text-gray-500 text-sm">
                  Sie werden benachrichtigt, sobald Ihr Therapeut bereit ist
                </p>
              </div>

              {/* Status-Schritte */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <span className="text-gray-700">Im Wartezimmer</span>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      preSessionCompleted
                        ? 'bg-green-500 text-white'
                        : 'bg-blue-500 text-white animate-pulse'
                    }`}
                  >
                    {preSessionCompleted ? <CheckCircle className="w-5 h-5" /> : '2'}
                  </div>
                  <span className="text-gray-700">Fragebogen ausfüllen</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-200 text-gray-400 rounded-full flex items-center justify-center">
                    3
                  </div>
                  <span className="text-gray-400">Therapeut ruft auf</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-200 text-gray-400 rounded-full flex items-center justify-center">
                    4
                  </div>
                  <span className="text-gray-400">Videositzung starten</span>
                </div>
              </div>

              {/* Hinweis */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  💡 Tipp: Füllen Sie den Fragebogen aus, während Sie warten. So kann Ihr Therapeut
                  sich optimal vorbereiten.
                </p>
              </div>
            </div>
          </div>

          {/* Pre-Session Fragebogen */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                Vor-Sitzungs-Fragebogen
              </h2>

              {preSessionCompleted ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-gray-900 mb-2">
                    Fragebogen abgeschlossen
                  </h3>
                  <p className="text-gray-500">
                    Ihr Therapeut wird Ihre Angaben vor der Sitzung einsehen.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Stimmung */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      <Heart className="w-4 h-4 inline mr-2 text-red-500" />
                      Wie ist Ihre aktuelle Stimmung? (1-10)
                    </label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <button
                          key={n}
                          onClick={() => setPreSession({ ...preSession, currentMood: n })}
                          className={`w-10 h-10 rounded-full text-sm font-medium transition ${
                            preSession.currentMood === n
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      {waitingData?.moodLabels[preSession.currentMood]}
                    </p>
                  </div>

                  {/* Angst-Level */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      <AlertCircle className="w-4 h-4 inline mr-2 text-orange-500" />
                      Angst-/Anspannungslevel (0-10)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={preSession.anxietyLevel}
                      onChange={(e) =>
                        setPreSession({ ...preSession, anxietyLevel: parseInt(e.target.value) })
                      }
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Keine Angst</span>
                      <span className="font-medium text-blue-600">{preSession.anxietyLevel}</span>
                      <span>Sehr stark</span>
                    </div>
                  </div>

                  {/* Schlafqualität */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      <Moon className="w-4 h-4 inline mr-2 text-indigo-500" />
                      Schlafqualität letzte Nacht
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          onClick={() => setPreSession({ ...preSession, sleepQuality: n })}
                          className={`flex-1 py-2 px-3 rounded-lg text-sm transition ${
                            preSession.sleepQuality === n
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {'⭐'.repeat(n)}
                        </button>
                      ))}
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      {waitingData?.sleepLabels[preSession.sleepQuality]}
                    </p>
                  </div>

                  {/* Medikamente */}
                  <div>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={preSession.medicationTaken}
                        onChange={(e) =>
                          setPreSession({ ...preSession, medicationTaken: e.target.checked })
                        }
                        className="w-5 h-5 rounded border-gray-300"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        <Pill className="w-4 h-4 inline mr-2 text-green-500" />
                        Medikamente heute eingenommen
                      </span>
                    </label>
                  </div>

                  {/* Hauptanliegen */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Was möchten Sie heute besprechen?
                    </label>
                    <textarea
                      value={preSession.mainConcerns}
                      onChange={(e) =>
                        setPreSession({ ...preSession, mainConcerns: e.target.value })
                      }
                      rows={3}
                      placeholder="Ihre Hauptthemen für die heutige Sitzung..."
                      className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Fragen */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Haben Sie Fragen an Ihren Therapeuten?
                    </label>
                    <textarea
                      value={preSession.questionsForTherapist}
                      onChange={(e) =>
                        setPreSession({ ...preSession, questionsForTherapist: e.target.value })
                      }
                      rows={2}
                      placeholder="Fragen, die Sie stellen möchten..."
                      className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Besondere Ereignisse */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Calendar className="w-4 h-4 inline mr-2 text-purple-500" />
                      Besondere Ereignisse seit der letzten Sitzung
                    </label>
                    <textarea
                      value={preSession.significantEvents}
                      onChange={(e) =>
                        setPreSession({ ...preSession, significantEvents: e.target.value })
                      }
                      rows={2}
                      placeholder="Wichtige Ereignisse, Veränderungen..."
                      className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Absenden */}
                  <button
                    onClick={submitPreSession}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
                  >
                    <Send className="w-5 h-5" />
                    Fragebogen absenden
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default WaitingRoom;
