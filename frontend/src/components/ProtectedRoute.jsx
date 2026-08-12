import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Loader2 } from 'lucide-react';

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <div className="flex items-center space-x-3 bg-slate-800/80 backdrop-blur-md px-6 py-4 rounded-xl border border-slate-700 shadow-xl">
          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          <span className="text-slate-300 font-medium">Verifying Session...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role.name)) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/90 backdrop-blur-md p-8 rounded-2xl border border-rose-500/30 text-center shadow-2xl">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-500/10 text-rose-400 mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Access Denied</h2>
          <p className="text-slate-400 text-sm mb-6">
            Your account role (<span className="text-rose-400 font-semibold uppercase">{user.role.name}</span>) does not have permission to access this view.
          </p>
          <button
            onClick={() => window.history.back()}
            className="w-full py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg transition-colors duration-200"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return children;
};
