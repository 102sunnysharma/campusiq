import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  Bell, CheckCircle2, AlertTriangle, MessageSquare, ShieldAlert,
  Clock, Check, ExternalLink, X, RotateCcw, AlertCircle
} from 'lucide-react';

const typeConfig = {
  grievance_submitted:     { icon: AlertTriangle, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  grievance_assigned:      { icon: AlertTriangle, color: 'text-sky-400',    bg: 'bg-sky-500/10' },
  grievance_status_changed: { icon: Clock,         color: 'text-amber-400',  bg: 'bg-amber-500/10' },
  grievance_reopened:      { icon: RotateCcw,     color: 'text-rose-400',   bg: 'bg-rose-500/10' },
  sla_warning:             { icon: AlertTriangle, color: 'text-amber-400',  bg: 'bg-amber-500/10' },
  sla_breached:            { icon: ShieldAlert,   color: 'text-rose-400',   bg: 'bg-rose-500/10' },
  feedback_analyzed:       { icon: MessageSquare, color: 'text-emerald-400',bg: 'bg-emerald-500/10' },
};

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.get('/notifications/unread-count');
      setUnreadCount(res.data.count || 0);
    } catch (e) {
      // Silent error on polling
    }
  }, []);

  const fetchLatestNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications?page=1&page_size=5');
      setNotifications(res.data.items || []);
    } catch (e) {
      console.warn('Failed to load notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // 30s poll
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (isOpen) {
      fetchLatestNotifications();
    }
  }, [isOpen]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (notif, e) => {
    e.stopPropagation();
    if (notif.is_read) return;
    try {
      await api.patch(`/notifications/${notif.id}/mark-read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.warn('Failed to mark notification read:', err);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      try {
        await api.patch(`/notifications/${notif.id}/mark-read`);
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (e) {}
    }
    setIsOpen(false);

    if (notif.reference_type === 'grievance') {
      navigate('/grievances');
    } else if (notif.reference_type === 'feedback') {
      navigate('/feedback');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.warn('Failed to mark all as read:', e);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors focus:outline-none"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-slate-950 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
            <div className="flex items-center space-x-2">
              <Bell className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center space-y-2">
                <CheckCircle2 className="w-6 h-6 text-slate-600" />
                <span>You're all caught up! No notifications.</span>
              </div>
            ) : (
              notifications.map((notif) => {
                const conf = typeConfig[notif.type] || { icon: Bell, color: 'text-slate-400', bg: 'bg-slate-800' };
                const IconComponent = conf.icon;

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3.5 hover:bg-slate-800/50 cursor-pointer transition-colors flex items-start space-x-3 text-xs ${
                      !notif.is_read ? 'bg-indigo-950/20' : ''
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${conf.bg} ${conf.color} shrink-0 mt-0.5`}>
                      <IconComponent className="w-3.5 h-3.5" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200 truncate pr-2">{notif.title}</span>
                        {!notif.is_read && (
                          <button
                            onClick={(e) => handleMarkRead(notif, e)}
                            className="p-1 text-slate-500 hover:text-indigo-400"
                            title="Mark as read"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{notif.message}</p>
                      <span className="text-[10px] text-slate-500 block">
                        {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-3 bg-slate-950/80 border-t border-slate-800 text-center">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/notifications');
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              View Notification Center →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
