import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from './store/authStore';
import ErrorBoundary from './components/ErrorBoundary';
import { applyDirection } from './i18n/rtlLanguages';

import Login from './pages/Login';
import Register from './pages/Register';
import NotFound from './pages/NotFound';

const Landing = lazy(() => import('./pages/Landing'));
const Share = lazy(() => import('./pages/Share'));
const Privacy = lazy(() => import('./pages/Privacy'));

const TherapistDashboard = lazy(() => import('./pages/TherapistDashboard'));
const PatientDashboard = lazy(() => import('./pages/PatientDashboard'));
const VideoCall = lazy(() => import('./pages/VideoCall'));
const PatientMaterials = lazy(() => import('./pages/PatientMaterials'));
const QuestionnaireBuilder = lazy(() => import('./pages/QuestionnaireBuilder'));
const PatientQuestionnaires = lazy(() => import('./pages/PatientQuestionnaires'));
const DocumentRequests = lazy(() => import('./pages/DocumentRequests'));
const SymptomDiary = lazy(() => import('./pages/SymptomDiary'));
const TherapyNotes = lazy(() => import('./pages/TherapyNotes'));
const PsychScreenings = lazy(() => import('./pages/PsychScreenings'));
const CrisisPlan = lazy(() => import('./pages/CrisisPlan'));
const MedicationTracker = lazy(() => import('./pages/MedicationTracker'));
const Exercises = lazy(() => import('./pages/Exercises'));
const ReminderSettings = lazy(() => import('./pages/ReminderSettings'));
const Reports = lazy(() => import('./pages/Reports'));
const WaitingRoom = lazy(() => import('./pages/WaitingRoom'));
const TherapistQueue = lazy(() => import('./pages/TherapistQueue'));
const Billing = lazy(() => import('./pages/Billing'));

function App() {
  const { user, loading, checkAuth } = useAuthStore();
  const { i18n } = useTranslation();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Apply RTL direction when language changes
  useEffect(() => {
    applyDirection(i18n.language);
  }, [i18n.language]);

  const spinner = (
    <div className="flex items-center justify-center min-h-screen">
      <div className="spinner"></div>
    </div>
  );

  const withSuspense = (node: JSX.Element) => <Suspense fallback={spinner}>{node}</Suspense>;

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/" element={user ? <Navigate to="/dashboard" /> : withSuspense(<Landing />)} />
          <Route path="/share" element={withSuspense(<Share />)} />

          <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
          <Route path="/register" element={!user ? <Register /> : <Navigate to="/dashboard" />} />
          <Route path="/privacy" element={withSuspense(<Privacy />)} />
          
          <Route
            path="/dashboard"
            element={
              loading ? (
                spinner
              ) : user ? (
                user.role === 'therapist'
                  ? withSuspense(<TherapistDashboard />)
                  : withSuspense(<PatientDashboard />)
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          
          <Route
            path="/call/:roomId"
            element={loading ? spinner : user ? withSuspense(<VideoCall />) : <Navigate to="/login" />}
          />
          
          {/* Patient Pre-Session Materials */}
          <Route
            path="/materials"
            element={loading ? spinner : user ? withSuspense(<PatientMaterials />) : <Navigate to="/login" />}
          />
          
          {/* Questionnaire System */}
          <Route
            path="/questionnaires"
            element={
              loading ? (
                spinner
              ) : user ? (
                user.role === 'therapist'
                  ? withSuspense(<QuestionnaireBuilder />)
                  : withSuspense(<PatientQuestionnaires />)
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          
          {/* Document Requests */}
          <Route
            path="/documents"
            element={loading ? spinner : user ? withSuspense(<DocumentRequests />) : <Navigate to="/login" />}
          />
          
          {/* Symptom Diary - Patient Only */}
          <Route
            path="/diary"
            element={
              loading ? (
                spinner
              ) : user?.role === 'patient' ? (
                withSuspense(<SymptomDiary />)
              ) : (
                <Navigate to="/dashboard" />
              )
            }
          />
          
          {/* Therapy Notes - Therapist Only */}
          <Route
            path="/therapy-notes"
            element={
              loading ? (
                spinner
              ) : user?.role === 'therapist' ? (
                withSuspense(<TherapyNotes />)
              ) : (
                <Navigate to="/dashboard" />
              )
            }
          />
          <Route
            path="/therapy-notes/:patientId"
            element={
              loading ? (
                spinner
              ) : user?.role === 'therapist' ? (
                withSuspense(<TherapyNotes />)
              ) : (
                <Navigate to="/dashboard" />
              )
            }
          />
          
          {/* Psychological Screenings - Patient Only */}
          <Route
            path="/screenings"
            element={
              loading ? (
                spinner
              ) : user?.role === 'patient' ? (
                withSuspense(<PsychScreenings />)
              ) : (
                <Navigate to="/dashboard" />
              )
            }
          />
          
          {/* Crisis Plan - Patient Only */}
          <Route
            path="/crisis-plan"
            element={
              loading ? (
                spinner
              ) : user?.role === 'patient' ? (
                withSuspense(<CrisisPlan />)
              ) : (
                <Navigate to="/dashboard" />
              )
            }
          />
          
          {/* Medication Tracker - Patient Only */}
          <Route
            path="/medications"
            element={
              loading ? (
                spinner
              ) : user?.role === 'patient' ? (
                withSuspense(<MedicationTracker />)
              ) : (
                <Navigate to="/dashboard" />
              )
            }
          />
          
          {/* Exercises & Homework - Patient Only */}
          <Route
            path="/exercises"
            element={
              loading ? (
                spinner
              ) : user?.role === 'patient' ? (
                withSuspense(<Exercises />)
              ) : (
                <Navigate to="/dashboard" />
              )
            }
          />
          
          {/* Reminder Settings - Both Roles */}
          <Route
            path="/reminders"
            element={loading ? spinner : user ? withSuspense(<ReminderSettings />) : <Navigate to="/login" />}
          />
          
          {/* Treatment Reports - Therapist Only */}
          <Route
            path="/reports"
            element={
              loading ? (
                spinner
              ) : user?.role === 'therapist' ? (
                withSuspense(<Reports />)
              ) : (
                <Navigate to="/dashboard" />
              )
            }
          />
          
          {/* Waiting Room - Patient Only */}
          <Route
            path="/waiting-room"
            element={
              loading ? (
                spinner
              ) : user?.role === 'patient' ? (
                withSuspense(<WaitingRoom />)
              ) : (
                <Navigate to="/dashboard" />
              )
            }
          />
          
          {/* Therapist Queue - Therapist Only */}
          <Route
            path="/queue"
            element={
              loading ? (
                spinner
              ) : user?.role === 'therapist' ? (
                withSuspense(<TherapistQueue />)
              ) : (
                <Navigate to="/dashboard" />
              )
            }
          />

          {/* Billing - Therapist Only */}
          <Route
            path="/billing"
            element={
              loading ? (
                spinner
              ) : user?.role === 'therapist' ? (
                withSuspense(<Billing />)
              ) : (
                <Navigate to="/dashboard" />
              )
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
