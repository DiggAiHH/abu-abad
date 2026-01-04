import { useState, useEffect } from 'react';
import { api } from '../api/client';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { logger } from '../utils/logger';
import {
  ArrowLeft,
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Clock,
  Check,
  X,
  Settings,
  Calendar,
  Trash2,
} from 'lucide-react';

// ===== TYPES =====
interface ReminderPreferences {
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  reminderTimes: number[];
  dailySummaryEnabled: boolean;
  dailySummaryTime: string;
}

interface ScheduledReminder {
  id: number;
  appointmentId: number;
  type: string;
  scheduledFor: string;
  message?: string;
  status: string;
  appointmentTime: string;
  otherPartyName?: string;
  sentAt?: string;
}

interface ReminderTime {
  minutes: number;
  label: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  email: <Mail size={16} />,
  sms: <MessageSquare size={16} />,
  push: <Smartphone size={16} />,
};

const TYPE_LABELS: Record<string, string> = {
  email: 'E-Mail',
  sms: 'SMS',
  push: 'Push-Nachricht',
};

export default function ReminderSettings() {
  const navigate = useNavigate();

  const [preferences, setPreferences] = useState<ReminderPreferences>({
    emailEnabled: true,
    smsEnabled: false,
    pushEnabled: true,
    reminderTimes: [1440, 60, 15],
    dailySummaryEnabled: false,
    dailySummaryTime: '08:00',
  });
  const [upcomingReminders, setUpcomingReminders] = useState<ScheduledReminder[]>([]);
  const [reminderHistory, setReminderHistory] = useState<ScheduledReminder[]>([]);
  const [availableTimes, setAvailableTimes] = useState<ReminderTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'upcoming' | 'history'>('settings');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prefsRes, upcomingRes, historyRes, timesRes] = await Promise.all([
        api.get('/reminders/preferences'),
        api.get('/reminders/upcoming'),
        api.get('/reminders/history?days=30'),
        api.get('/reminders/available-times'),
      ]);

      setPreferences(prefsRes.data);
      setUpcomingReminders(upcomingRes.data);
      setReminderHistory(historyRes.data);
      setAvailableTimes(timesRes.data.times);
    } catch (error) {
      logger.error('ReminderSettings: Fehler beim Laden', error);
      toast.error('Fehler beim Laden der Einstellungen');
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      await api.put('/reminders/preferences', preferences);
      toast.success('Einstellungen gespeichert');
    } catch (error) {
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const cancelReminder = async (id: number) => {
    try {
      await api.delete(`/reminders/${id}`);
      toast.success('Erinnerung storniert');
      loadData();
    } catch (error) {
      toast.error('Fehler beim Stornieren');
    }
  };

  const toggleReminderTime = (minutes: number) => {
    const current = preferences.reminderTimes;
    if (current.includes(minutes)) {
      setPreferences({
        ...preferences,
        reminderTimes: current.filter((t) => t !== minutes),
      });
    } else {
      setPreferences({
        ...preferences,
        reminderTimes: [...current, minutes].sort((a, b) => b - a),
      });
    }
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
      <header className="bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-white/20 rounded-lg"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Bell size={28} />
                Termin-Erinnerungen
              </h1>
              <p className="text-amber-100">
                {upcomingReminders.length} geplante Erinnerungen
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <div className="flex bg-white rounded-lg shadow overflow-hidden">
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'settings'
                ? 'bg-amber-500 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Settings size={16} className="inline mr-1" />
            Einstellungen
          </button>
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'upcoming'
                ? 'bg-amber-500 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Clock size={16} className="inline mr-1" />
            Geplant ({upcomingReminders.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === 'history'
                ? 'bg-amber-500 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Calendar size={16} className="inline mr-1" />
            Verlauf
          </button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Notification Types */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold mb-4">Benachrichtigungsarten</h2>
              <div className="space-y-4">
                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                  <div className="flex items-center gap-3">
                    <Mail className="text-blue-500" />
                    <div>
                      <p className="font-medium">E-Mail</p>
                      <p className="text-sm text-gray-500">
                        Erinnerungen per E-Mail erhalten
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.emailEnabled}
                    onChange={(e) =>
                      setPreferences({ ...preferences, emailEnabled: e.target.checked })
                    }
                    className="w-5 h-5 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                  <div className="flex items-center gap-3">
                    <Smartphone className="text-green-500" />
                    <div>
                      <p className="font-medium">Push-Nachricht</p>
                      <p className="text-sm text-gray-500">
                        In-App Benachrichtigungen
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.pushEnabled}
                    onChange={(e) =>
                      setPreferences({ ...preferences, pushEnabled: e.target.checked })
                    }
                    className="w-5 h-5 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 opacity-60">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="text-purple-500" />
                    <div>
                      <p className="font-medium">SMS</p>
                      <p className="text-sm text-gray-500">
                        SMS-Erinnerungen (Premium)
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.smsEnabled}
                    onChange={(e) =>
                      setPreferences({ ...preferences, smsEnabled: e.target.checked })
                    }
                    disabled
                    className="w-5 h-5 rounded border-gray-300"
                  />
                </label>
              </div>
            </div>

            {/* Reminder Times */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold mb-4">Erinnerungszeitpunkte</h2>
              <p className="text-sm text-gray-500 mb-4">
                Wählen Sie, wann Sie vor einem Termin erinnert werden möchten
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {availableTimes.map((time) => {
                  const isSelected = preferences.reminderTimes.includes(time.minutes);
                  return (
                    <button
                      key={time.minutes}
                      onClick={() => toggleReminderTime(time.minutes)}
                      className={`p-3 rounded-lg border-2 text-left transition ${
                        isSelected
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{time.label}</span>
                        {isSelected && <Check size={18} className="text-amber-500" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Daily Summary */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold mb-4">Tägliche Zusammenfassung</h2>
              <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                <div>
                  <p className="font-medium">Tagesübersicht aktivieren</p>
                  <p className="text-sm text-gray-500">
                    Morgendliche E-Mail mit allen Terminen des Tages
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.dailySummaryEnabled}
                  onChange={(e) =>
                    setPreferences({ ...preferences, dailySummaryEnabled: e.target.checked })
                  }
                  className="w-5 h-5 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                />
              </label>

              {preferences.dailySummaryEnabled && (
                <div className="mt-4">
                  <label className="block text-sm font-medium mb-1">Uhrzeit</label>
                  <input
                    type="time"
                    value={preferences.dailySummaryTime}
                    onChange={(e) =>
                      setPreferences({ ...preferences, dailySummaryTime: e.target.value })
                    }
                    className="border rounded px-3 py-2"
                  />
                </div>
              )}
            </div>

            {/* Save Button */}
            <button
              onClick={savePreferences}
              disabled={saving}
              className="w-full py-4 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600 disabled:opacity-50"
            >
              {saving ? 'Speichert...' : 'Einstellungen speichern'}
            </button>
          </div>
        )}

        {/* UPCOMING TAB */}
        {activeTab === 'upcoming' && (
          <div className="space-y-4">
            {upcomingReminders.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <Bell size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Keine geplanten Erinnerungen</p>
                <p className="text-sm text-gray-400 mt-2">
                  Erinnerungen werden automatisch für neue Termine erstellt
                </p>
              </div>
            ) : (
              upcomingReminders.map((reminder) => (
                <div key={reminder.id} className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                        {TYPE_ICONS[reminder.type]}
                      </div>
                      <div>
                        <p className="font-medium">
                          Termin am{' '}
                          {new Date(reminder.appointmentTime).toLocaleDateString('de-DE', {
                            weekday: 'short',
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        {reminder.otherPartyName && (
                          <p className="text-sm text-gray-600">
                            mit {reminder.otherPartyName}
                          </p>
                        )}
                        <p className="text-sm text-gray-500">
                          {TYPE_LABELS[reminder.type]} um{' '}
                          {new Date(reminder.scheduledFor).toLocaleString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => cancelReminder(reminder.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      title="Stornieren"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {reminderHistory.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Keine Erinnerungen gesendet</p>
              </div>
            ) : (
              reminderHistory.map((reminder) => (
                <div
                  key={reminder.id}
                  className={`bg-white rounded-lg shadow p-4 border-l-4 ${
                    reminder.status === 'sent' ? 'border-green-500' : 'border-red-500'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        reminder.status === 'sent'
                          ? 'bg-green-100 text-green-600'
                          : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {reminder.status === 'sent' ? <Check size={16} /> : <X size={16} />}
                    </div>
                    <div>
                      <p className="font-medium">
                        {TYPE_LABELS[reminder.type]} {reminder.status === 'sent' ? 'gesendet' : 'fehlgeschlagen'}
                      </p>
                      <p className="text-sm text-gray-500">
                        Termin am{' '}
                        {new Date(reminder.appointmentTime).toLocaleDateString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      {reminder.sentAt && (
                        <p className="text-xs text-gray-400">
                          Gesendet: {new Date(reminder.sentAt).toLocaleString('de-DE')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
