import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Register from './pages/Register';
import TherapistDashboard from './pages/TherapistDashboard';
import PatientDashboard from './pages/PatientDashboard';
import VideoCall from './pages/VideoCall';
import NotFound from './pages/NotFound';
import PatientMaterials from './pages/PatientMaterials';
import QuestionnaireBuilder from './pages/QuestionnaireBuilder';
import PatientQuestionnaires from './pages/PatientQuestionnaires';
import DocumentRequests from './pages/DocumentRequests';
import SymptomDiary from './pages/SymptomDiary';
import TherapyNotes from './pages/TherapyNotes';
import PsychScreenings from './pages/PsychScreenings';
import CrisisPlan from './pages/CrisisPlan';
import MedicationTracker from './pages/MedicationTracker';
import Exercises from './pages/Exercises';
import ReminderSettings from './pages/ReminderSettings';
import Reports from './pages/Reports';
import WaitingRoom from './pages/WaitingRoom';
import TherapistQueue from './pages/TherapistQueue';
import Billing from './pages/Billing';

function App() {
  const { user, loading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const spinner = (
    <div className="flex items-center justify-center min-h-screen">
      <div className="spinner"></div>
    </div>
  );

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
          <Route path="/register" element={!user ? <Register /> : <Navigate to="/dashboard" />} />
          
          <Route
            path="/dashboard"
            element={
              loading ? (
                spinner
              ) : user ? (
                user.role === 'therapist' ? <TherapistDashboard /> : <PatientDashboard />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          
          <Route
            path="/call/:roomId"
            element={loading ? spinner : user ? <VideoCall /> : <Navigate to="/login" />}
          />
          
          {/* Patient Pre-Session Materials */}
          <Route
            path="/materials"
            element={loading ? spinner : user ? <PatientMaterials /> : <Navigate to="/login" />}
          />
          
          {/* Questionnaire System */}
          <Route
            path="/questionnaires"
            element={
              loading ? (
                spinner
              ) : user ? (
                user.role === 'therapist' ? <QuestionnaireBuilder /> : <PatientQuestionnaires />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          
          {/* Document Requests */}
          <Route
            path="/documents"
            element={loading ? spinner : user ? <DocumentRequests /> : <Navigate to="/login" />}
          />
          
          {/* Symptom Diary - Patient Only */}
          <Route
            path="/diary"
            element={
              loading ? (
                spinner
              ) : user?.role === 'patient' ? (
                <SymptomDiary />
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
                <TherapyNotes />
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
                <TherapyNotes />
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
                <PsychScreenings />
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
                <CrisisPlan />
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
                <MedicationTracker />
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
                <Exercises />
              ) : (
                <Navigate to="/dashboard" />
              )
            }
          />
          
          {/* Reminder Settings - Both Roles */}
          <Route
            path="/reminders"
            element={loading ? spinner : user ? <ReminderSettings /> : <Navigate to="/login" />}
          />
          
          {/* Treatment Reports - Therapist Only */}
          <Route
            path="/reports"
            element={
              loading ? (
                spinner
              ) : user?.role === 'therapist' ? (
                <Reports />
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
                <WaitingRoom />
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
                <TherapistQueue />
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
                <Billing />
              ) : (
                <Navigate to="/dashboard" />
              )
            }
          />
          
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
