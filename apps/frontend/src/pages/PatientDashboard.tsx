import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { appointmentAPI, messageAPI, paymentAPI } from '../api/client';
import { Appointment, Message } from '../types';
import toast from 'react-hot-toast';
import { Calendar, Video, MessageSquare, LogOut, CreditCard, Clock, User } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { logger } from '../utils/logger';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

export default function PatientDashboard() {
  const { t: _t } = useTranslation('pages');
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availableSlots, setAvailableSlots] = useState<Appointment[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'my-appointments' | 'book' | 'messages'>('my-appointments');

  useEffect(() => {
    // Guard clause: User muss existieren
    if (!user?.id) {
      logger.warn('PatientDashboard: no user found, redirecting to login');
      navigate('/login');
      return;
    }
    
    loadData();
  }, [user?.id]);

  const loadData = async () => {
    setLoading(true);
    
    try {
      // Guard clause: User muss existieren
      if (!user?.id) {
        throw new Error('Benutzer nicht authentifiziert');
      }
      
      const [apptRes, availRes, msgRes] = await Promise.all([
        appointmentAPI.getAll({ status: 'booked' }),
        appointmentAPI.getAll({ status: 'available' }),
        messageAPI.getAll(),
      ]);
      
      // Defensive checks - sicherstellen dass Arrays zurückkommen
      const allAppointments = Array.isArray(apptRes.data) ? apptRes.data : [];
      const available = Array.isArray(availRes.data) ? availRes.data : [];
      const msgs = Array.isArray(msgRes.data) ? msgRes.data : [];
      
      setAppointments(allAppointments.filter((a: Appointment) => a.patientId === user.id));
      setAvailableSlots(available);
      setMessages(msgs);
    } catch (error: any) {
      logger.error('PatientDashboard: Fehler beim Laden', error);
      
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

  const bookAppointment = async (appointmentId: string) => {
    if (!appointmentId) {
      toast.error('Ungültige Termin-ID');
      return;
    }
    
    if (!user?.id) {
      toast.error('Sie müssen angemeldet sein');
      navigate('/login');
      return;
    }
    
    setLoading(true);
    
    try {
      await appointmentAPI.book(appointmentId);
      toast.success('Termin gebucht! Sie werden zur Zahlung weitergeleitet...');
      
      // Stripe Checkout
      const { data } = await paymentAPI.createCheckout(appointmentId);
      const stripe = await stripePromise;
      
      if (!stripe) {
        throw new Error('Stripe konnte nicht geladen werden');
      }
      
      if (!data?.sessionId) {
        throw new Error('Keine Stripe Session erhalten');
      }
      
      const { error } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
      
      if (error) {
        throw error;
      }
    } catch (error: any) {
      logger.error('PatientDashboard: Buchungsfehler', error);
      toast.error(error.message || 'Buchung fehlgeschlagen');
      await loadData(); // Daten neu laden nach Fehler
    } finally {
      setLoading(false);
    }
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
                Patienten-Dashboard
              </h1>
              <p className="text-sm text-gray-600">
                Willkommen, {user?.firstName} {user?.lastName}
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
                <p className="text-sm text-gray-600">Meine Termine</p>
                <p className="text-2xl font-bold">{appointments.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <Clock className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Verfügbare Slots</p>
                <p className="text-2xl font-bold">{availableSlots.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-4">
              <div className="bg-purple-100 p-3 rounded-lg">
                <MessageSquare className="text-purple-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Neue Nachrichten</p>
                <p className="text-2xl font-bold">
                  {messages.filter(m => !m.read).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition" onClick={() => navigate('/materials')}>
            <div className="flex items-center gap-4">
              <div className="bg-orange-100 p-3 rounded-lg">
                <User className="text-orange-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Vorbereitung</p>
                <p className="text-lg font-bold">Materialien</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
          <button
            onClick={() => navigate('/diary')}
            className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-lg shadow-lg p-5 hover:shadow-xl transition text-left"
          >
            <h3 className="text-lg font-bold mb-1">📔 Tagebuch</h3>
            <p className="text-indigo-100 text-sm">Stimmung & Symptome</p>
          </button>

          <button
            onClick={() => navigate('/screenings')}
            className="bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-lg shadow-lg p-5 hover:shadow-xl transition text-left"
          >
            <h3 className="text-lg font-bold mb-1">📊 Screenings</h3>
            <p className="text-teal-100 text-sm">PHQ-9, GAD-7 Tests</p>
          </button>

          <button
            onClick={() => navigate('/crisis-plan')}
            className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg shadow-lg p-5 hover:shadow-xl transition text-left"
          >
            <h3 className="text-lg font-bold mb-1">🆘 Krisenplan</h3>
            <p className="text-red-100 text-sm">Notfall-Kontakte</p>
          </button>

          <button
            onClick={() => navigate('/medications')}
            className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-lg shadow-lg p-5 hover:shadow-xl transition text-left"
          >
            <h3 className="text-lg font-bold mb-1">💊 Medikamente</h3>
            <p className="text-emerald-100 text-sm">Tracker & Einnahme</p>
          </button>

          <button
            onClick={() => navigate('/exercises')}
            className="bg-gradient-to-br from-violet-500 to-violet-600 text-white rounded-lg shadow-lg p-5 hover:shadow-xl transition text-left"
          >
            <h3 className="text-lg font-bold mb-1">📚 Übungen</h3>
            <p className="text-violet-100 text-sm">Hausaufgaben</p>
          </button>

          <button
            onClick={() => navigate('/materials')}
            className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg p-5 hover:shadow-xl transition text-left"
          >
            <h3 className="text-lg font-bold mb-1">📝 Materialien</h3>
            <p className="text-blue-100 text-sm">Dateien hochladen</p>
          </button>

          <button
            onClick={() => navigate('/questionnaires')}
            className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-lg p-5 hover:shadow-xl transition text-left"
          >
            <h3 className="text-lg font-bold mb-1">📋 Fragebögen</h3>
            <p className="text-green-100 text-sm">Zugewiesene Bögen</p>
          </button>

          <button
            onClick={() => navigate('/documents')}
            className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-lg p-5 hover:shadow-xl transition text-left"
          >
            <h3 className="text-lg font-bold mb-1">📄 Dokumente</h3>
            <p className="text-purple-100 text-sm">Uploads verwalten</p>
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('my-appointments')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'my-appointments'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Meine Termine
              </button>
              <button
                onClick={() => setActiveTab('book')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'book'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Termin buchen
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
            {activeTab === 'my-appointments' && (
              <div>
                <h2 className="text-xl font-semibold mb-6">Meine gebuchten Termine</h2>
                <div className="space-y-4">
                  {appointments.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">
                      Keine Termine gebucht
                    </p>
                  ) : (
                    appointments.map((apt) => (
                      <div
                        key={apt.id}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Clock size={16} className="text-gray-400" />
                              <span className="font-medium">
                                {format(new Date(apt.startTime), 'dd.MM.yyyy HH:mm', { locale: de })} - 
                                {format(new Date(apt.endTime), 'HH:mm')}
                              </span>
                            </div>
                            {apt.therapist && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <User size={14} />
                                <span>
                                  Dr. {apt.therapist.firstName} {apt.therapist.lastName}
                                </span>
                              </div>
                            )}
                            <div className="mt-3 flex items-center gap-2">
                              <span
                                className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                                  apt.status === 'booked'
                                    ? 'bg-blue-100 text-blue-800'
                                    : apt.status === 'completed'
                                    ? 'bg-gray-100 text-gray-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {apt.status === 'booked' && 'Gebucht'}
                                {apt.status === 'completed' && 'Abgeschlossen'}
                                {apt.status === 'cancelled' && 'Abgesagt'}
                              </span>
                              <span
                                className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                                  apt.paymentStatus === 'completed'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {apt.paymentStatus === 'completed' ? 'Bezahlt' : 'Zahlung ausstehend'}
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
                                Beitreten
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

            {activeTab === 'book' && (
              <div>
                <h2 className="text-xl font-semibold mb-6">Verfügbare Termine</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availableSlots.length === 0 ? (
                    <p className="col-span-2 text-center text-gray-500 py-8">
                      Keine freien Termine verfügbar
                    </p>
                  ) : (
                    availableSlots.map((slot) => (
                      <div
                        key={slot.id}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <Calendar size={18} className="text-blue-600" />
                          <span className="font-medium">
                            {format(new Date(slot.startTime), 'EEEE, dd.MM.yyyy', { locale: de })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
                          <Clock size={16} />
                          <span>
                            {format(new Date(slot.startTime), 'HH:mm')} - 
                            {format(new Date(slot.endTime), 'HH:mm')} Uhr
                          </span>
                        </div>
                        {slot.therapist && (
                          <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
                            <User size={16} />
                            <span>
                              Dr. {slot.therapist.firstName} {slot.therapist.lastName}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-4">
                          <span className="text-lg font-bold text-gray-900">
                            {slot.price.toFixed(2)} €
                          </span>
                          <button
                            onClick={() => bookAppointment(slot.id)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                          >
                            <CreditCard size={16} />
                            Jetzt buchen
                          </button>
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
    </div>
  );
}
