import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { UserAvatar } from '../common/UserAvatar';
import { Bell, LogOut, ChevronDown, CheckCheck, Clock, Shield, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Header = () => {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead } = useNotification();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <header className="h-16 bg-[#0F172A]/80 backdrop-blur-md border-b border-slate-800/80 px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wide uppercase bg-gradient-to-r from-blue-600/20 to-sky-500/20 border border-blue-500/30 text-blue-400">
          Role: {user?.role}
        </span>
        <h1 className="text-sm font-bold text-slate-200 hidden sm:block">
          Govt. Health Services GeoAttendance Portal
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications Dropdown (Strip Passwords/OTPs) */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/80 hover:border-slate-600 text-slate-300 relative transition-all"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute right-0 mt-2 w-80 bg-[#1E293B] border border-slate-700 rounded-2xl shadow-2xl p-4 z-50 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-blue-400" />
                    <h3 className="text-xs font-bold text-white">Notifications Panel</h3>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAsRead('all')}
                      className="text-[10px] text-blue-400 hover:underline font-semibold flex items-center gap-1"
                    >
                      <CheckCheck className="w-3 h-3" /> Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {notifications.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400">
                      No notifications available.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n._id}
                        onClick={() => markAsRead(n._id)}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          !n.isRead && !n.read
                            ? 'bg-blue-500/10 border-blue-500/30 text-white'
                            : 'bg-slate-900/60 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold mb-0.5 text-blue-300">
                          <span>{n.title}</span>
                          <span className="text-[9px] text-slate-400 font-mono">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-snug">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2.5 p-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 hover:border-slate-600 transition-all"
          >
            {/* Gender-Based Profile Avatar */}
            <UserAvatar gender={user?.gender} role={user?.role} name={user?.name} size="sm" />
            <div className="text-left hidden md:block">
              <div className="text-xs font-semibold text-slate-100">{user?.name}</div>
              <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                {user?.gender === 'Female' ? '♀ Lady Officer' : '♂ Officer'} • {user?.email}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <AnimatePresence>
            {showProfileMenu && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute right-0 mt-2 w-56 bg-[#1E293B] border border-slate-700 rounded-2xl shadow-2xl p-2 z-50"
              >
                <div className="px-3 py-2 border-b border-slate-700/80 mb-1 flex items-center gap-2.5">
                  <UserAvatar gender={user?.gender} role={user?.role} name={user?.name} size="sm" />
                  <div>
                    <p className="text-xs font-bold text-white">{user?.name}</p>
                    <p className="text-[10px] text-slate-400">{user?.qualification || user?.role}</p>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
