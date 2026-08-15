import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, User as UserIcon, Shield, Sparkles, GraduationCap, Building2, Bus, LayoutDashboard, UserCheck, Users, MessageSquare } from 'lucide-react';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getRoleBadge = (roleName) => {
    switch (roleName) {
      case 'admin':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'hod':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'staff':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case 'student':
      default:
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    }
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Navigation Links */}
          <div className="flex items-center space-x-6">
            <Link to="/dashboard" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-lg font-bold bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent">
                    KRMU CampusIQ
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium hidden sm:block">Campus Intelligence Platform</p>
              </div>
            </Link>

            {user && (
              <div className="hidden md:flex items-center space-x-1">
                <Link
                  to="/dashboard"
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive('/dashboard')
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                </Link>

                {user.role?.name === 'student' && (
                  <>
                    <Link
                      to="/profile"
                      className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isActive('/profile')
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>My Profile</span>
                    </Link>
                    <Link
                      to="/feedback"
                      className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isActive('/feedback')
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>My Feedback</span>
                    </Link>
                  </>
                )}

                {(user.role?.name === 'admin' || user.role?.name === 'hod' || user.role?.name === 'staff') && (
                  <>
                    <Link
                      to="/directory"
                      className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isActive('/directory')
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      <span>Profiles Directory</span>
                    </Link>
                    {(user.role?.name === 'admin' || user.role?.name === 'hod') && (
                      <Link
                        to="/feedback"
                        className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                          isActive('/feedback')
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                        }`}
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Feedback</span>
                      </Link>
                    )}
                  </>
                )}

                <Link
                  to="/campus"
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive('/campus')
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Campus Structure</span>
                </Link>

                <Link
                  to="/transport"
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive('/transport')
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Bus className="w-4 h-4" />
                  <span>Transport Map</span>
                </Link>
              </div>
            )}
          </div>

          {/* User Section */}
          {user && (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 bg-slate-800/60 border border-slate-700/60 rounded-xl py-1.5 px-3">
                <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-slate-300">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-sm font-semibold text-slate-200 leading-tight">
                    {user.full_name}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate max-w-[140px]">
                    {user.email}
                  </div>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide border ${getRoleBadge(user.role?.name)}`}>
                  {user.role?.name}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 py-2 px-3 bg-slate-800 hover:bg-rose-500/10 hover:text-rose-400 text-slate-300 border border-slate-700 hover:border-rose-500/30 rounded-xl text-sm font-medium transition-all duration-200"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
