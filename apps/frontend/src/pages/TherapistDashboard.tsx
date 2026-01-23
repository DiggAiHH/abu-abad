import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { appointmentAPI, messageAPI } from '../api/client';
import { Appointment, Message } from '../types';
import toast from 'react-hot-toast';
import { Calendar, Video, MessageSquare, LogOut, Plus, Clock, User } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { logger } from '../utils/logger';

export default function TherapistDashboard() {
  const { t: _t } = useTranslation('pages');
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'appointments' | 'messages'>('appointments');

  useEffect(() => {
    // Guard clause: User muss existieren
    if (!user?.id) {
      logger.warn('TherapistDashboard: no user found, redirecting to login');
      navigate('/login');
      return;
    }
    
    loadData();
  }, [user?.id, navigate]);

  const loadData = async () => {
    setLoading(true);
    
    try {
      // Guard clause: User muss existieren
      if (!user?.id) {
        throw new Error('Benutzer nicht authentifiziert');
      }
      
      const [apptRes, msgRes] = await Promise.all([
        appointmentAPI.getAll(),
        messageAPI.getAll(),
      ]);
      
      // Defensive checks - sicherstellen dass Arrays zurückkommen
      const allAppointments = Array.isArray(apptRes.data) ? apptRes.data : [];
      const msgs = Array.isArray(msgRes.data) ? msgRes.data : [];
      
      setAppointments(allAppointments);
      setMessages(msgs);
    } catch (error: any) {
      logger.error('TherapistDashboard: Fehler beim Laden', error);
      
      if (error.response?.status === 401) {
        toast.error('Sitzung abgelaufen. Bitte neu anmelden.');
        void logout();
        navigate('/login');
      } else if (!error.response) {
        toast.error('Keine Verbindung zum Server. Daten werden nicht aktualisiert.');
      } else {
        toast.error('Fehler beim Laden der Daten');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    void logout();
    navigate('/login');
    toast.success('Erfolgreich abgemeldet');
  };

  const startVideoCall = (roomId: string) => {
    navigate(`/call/${roomId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Therapeuten-Dashboard
              </h1>
              <p className="text-sm text-gray-600">
                Willkommen, Dr. {user?.firstName} {user?.lastName}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <LogOut size={20} />
              Abmelden
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <Calendar className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Termine heute</p>
                <p className="text-2xl font-bold">
                  {appointments.filter(a => {
                    try {
                      if (!a?.startTime) return false;
                      const appointmentDate = new Date(a.startTime);
                      const today = new Date();
                      // Normalize to start of day in local timezone
                      const aptDay = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate());
                      const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                      return aptDay.getTime() === todayDay.getTime();
                    } catch {
                      return false;
                    }
                  }).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <Video className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Offene Slots</p>
                <p className="text-2xl font-bold">
                  {appointments.filter(a => a?.status === 'available').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition" onClick={() => navigate('/questionnaires')}>
            <div className="flex items-center gap-4">
              <div className="bg-purple-100 p-3 rounded-lg">
                <MessageSquare className="text-purple-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Fragebögen</p>
                <p className="text-lg font-bold">Verwalten</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition" onClick={() => navigate('/documents')}>
            <div className="flex items-center gap-4">
              <div className="bg-orange-100 p-3 rounded-lg">
                <User className="text-orange-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Dokumente</p>
                <p className="text-lg font-bold">Anfragen</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-6 mb-8">
          <button
            onClick={() => navigate('/therapy-notes')}
            className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-lg shadow-lg p-6 hover:shadow-xl transition text-left"
          >
            <h3 className="text-xl font-bold mb-2">📔 Therapie-Notizen</h3>
            <p className="text-indigo-100">SOAP-Dokumentation und Sitzungsprotokolle</p>
          </button>

          <button
            onClick={() => navigate('/reports')}
            className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white rounded-lg shadow-lg p-6 hover:shadow-xl transition text-left"
          >
            <h3 className="text-xl font-bold mb-2">📄 Berichte</h3>
            <p className="text-cyan-100">Behandlungsberichte erstellen und exportieren</p>
          </button>

          <button
            onClick={() => navigate('/queue')}
            className="bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-lg shadow-lg p-6 hover:shadow-xl transition text-left"
          >
            <h3 className="text-xl font-bold mb-2">👥 Wartezimmer</h3>
            <p className="text-teal-100">Wartende Patienten einsehen und aufrufen</p>
          </button>

          <button
            onClick={() => navigate('/questionnaires')}
            className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-6 hover:shadow-xl transition text-left"
          >
            <h3 className="text-xl font-bold mb-2">📋 Fragebogen erstellen</h3>
            <p className="text-blue-100">Anamnese, Symptom-Check oder individuelle Fragebögen</p>
          </button>

          <button
            onClick={() => navigate('/documents')}
            className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg p-6 hover:shadow-xl transition text-left"
          >
            <h3 className="text-xl font-bold mb-2">📄 Dokumente anfordern</h3>
            <p className="text-green-100">Scans, Befunde oder spezifische Unterlagen von Patienten anfordern</p>
          </button>

          <button
            onClick={() => navigate('/materials')}
            className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-lg p-6 hover:shadow-xl transition text-left"
          >
            <h3 className="text-xl font-bold mb-2">📝 Patientenmaterialien</h3>
            <p className="text-purple-100">Notizen und Vorbereitungen der Patienten einsehen</p>
          </button>

          <button
            onClick={() => navigate('/billing')}
            className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-lg shadow-lg p-6 hover:shadow-xl transition text-left"
          >
            <h3 className="text-xl font-bold mb-2">💶 Abrechnung</h3>
            <p className="text-emerald-100">Rechnungen erstellen und verwalten</p>
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('appointments')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'appointments'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Termine
              </button>
              <button
                onClick={() => setActiveTab('messages')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'messages'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Nachrichten
                {messages.filter(m => !m.read).length > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                    {messages.filter(m => !m.read).length}
                  </span>
                )}
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'appointments' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">Meine Termine</h2>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    <Plus size={20} />
                    Slot erstellen
                  </button>
                </div>

                <div className="space-y-4">
                  {appointments.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">
                      Keine Termine vorhanden
                    </p>
                  ) : (
                    appointments.map((apt) => (
                      <div
                        key={apt.id}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Clock size={16} className="text-gray-400" />
                              <span className="font-medium">
                                {format(new Date(apt.startTime), 'dd.MM.yyyy HH:mm', { locale: de })} - 
                                {format(new Date(apt.endTime), 'HH:mm')}
                              </span>
                            </div>
                            {apt.patient && (
                              <p className="text-sm text-gray-600">
                                Patient: {apt.patient.firstName} {apt.patient.lastName}
                              </p>
                            )}
                            <div className="mt-2">
                              <span
                                className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                                  apt.status === 'available'
                                    ? 'bg-green-100 text-green-800'
                                    : apt.status === 'booked'
                                    ? 'bg-blue-100 text-blue-800'
                                    : apt.status === 'completed'
                                    ? 'bg-gray-100 text-gray-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {apt.status === 'available' && 'Verfügbar'}
                                {apt.status === 'booked' && 'Gebucht'}
                                {apt.status === 'completed' && 'Abgeschlossen'}
                                {apt.status === 'cancelled' && 'Abgesagt'}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {apt.status === 'booked' && apt.meetingRoomId && (
                              <button
                                onClick={() => startVideoCall(apt.meetingRoomId!)}
                                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
                              >
                                <Video size={16} />
                                Sitzung starten
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'messages' && (
              <div>
                <h2 className="text-xl font-semibold mb-6">Nachrichten</h2>
                <div className="space-y-3">
                  {messages.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">
                      Keine Nachrichten
                    </p>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`border rounded-lg p-4 ${
                          !msg.read ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">
                              {msg.sender?.firstName} {msg.sender?.lastName}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">{msg.content}</p>
                            <p className="text-xs text-gray-400 mt-2">
                              {format(new Date(msg.createdAt), 'dd.MM.yyyy HH:mm')}
                            </p>
                          </div>
                          {!msg.read && (
                            <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                              Neu
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create Appointment Modal */}
      {showCreateModal && (
        <CreateAppointmentModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}

function CreateAppointmentModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    startTime: '',
    endTime: '',
    price: 120,
    appointmentType: 'video' as 'video' | 'audio' | 'in-person',
  });
  const [loading, setLoading] = useState(false);
  const minDateTime = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.startTime || !formData.endTime) {
      toast.error('Start- und Endzeit sind erforderlich');
      return;
    }

    const start = new Date(formData.startTime);
    const end = new Date(formData.endTime);
    if (end <= start) {
      toast.error('Endzeit muss nach Startzeit liegen');
      return;
    }
    if (start.getTime() < Date.now()) {
      toast.error('Startzeit darf nicht in der Vergangenheit liegen');
      return;
    }
    if (formData.price <= 0) {
      toast.error('Preis muss größer als 0 sein');
      return;
    }

    setLoading(true);

    try {
      await appointmentAPI.create(formData);
      toast.success('Termin-Slot erstellt!');
      onSuccess();
    } catch (error: any) {
      const errorData = error?.response?.data;
      const message =
        (typeof errorData?.error === 'string' && errorData.error) ||
        (typeof errorData?.message === 'string' && errorData.message) ||
        error?.message ||
        'Termin konnte nicht erstellt werden';
      const normalized =
        message.toLowerCase().includes('überschneid')
          ? `Überschneidung: ${message}`
          : message;
      toast.error(normalized);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-4">Neuer Termin-Slot</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Startzeit</label>
            <input
              type="datetime-local"
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              required
              min={minDateTime}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Endzeit</label>
            <input
              type="datetime-local"
              value={formData.endTime}
              onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
              required
              min={formData.startTime || minDateTime}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Preis (€)</label>
            <input
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
              required
              min={1}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Erstelle...' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
