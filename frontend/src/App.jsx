import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { CampusManagement } from './pages/CampusManagement';
import { TransportMap } from './pages/TransportMap';
import { StudentProfile } from './pages/StudentProfile';
import { ProfilesManagement } from './pages/ProfilesManagement';
import { MyFeedback } from './pages/MyFeedback';
import { FeedbackManagement } from './pages/FeedbackManagement';

/**
 * Role-based feedback page switcher.
 * Students → MyFeedback, Admin/HOD → FeedbackManagement.
 * Staff are redirected to dashboard (no feedback access).
 */
function FeedbackPage() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role?.name === 'student') return <MyFeedback />;
  if (user.role?.name === 'admin' || user.role?.name === 'hod') return <FeedbackManagement />;
  // Staff and other roles → redirect to dashboard
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/directory"
            element={
              <ProtectedRoute allowedRoles={['admin', 'hod', 'staff']}>
                <ProfilesManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/campus"
            element={
              <ProtectedRoute>
                <CampusManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transport"
            element={
              <ProtectedRoute>
                <TransportMap />
              </ProtectedRoute>
            }
          />
          {/* /feedback renders MyFeedback for students, FeedbackManagement for admin/hod */}
          <Route
            path="/feedback"
            element={
              <ProtectedRoute>
                <FeedbackPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
