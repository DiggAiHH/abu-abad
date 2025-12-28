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

function App() {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner"></div>
      </div>
    );
  }

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
              user ? (
                user.role === 'therapist' ? <TherapistDashboard /> : <PatientDashboard />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          
          <Route
            path="/call/:roomId"
            element={user ? <VideoCall /> : <Navigate to="/login" />}
          />
          
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
