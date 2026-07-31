import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { 
  Bell, Shield, User, LogOut, Hospital, CheckCircle2, AlertCircle, X, ChevronDown 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Header = ({ toggleSidebar }) => {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead } = useNotification();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const getRoleBadge = (role) => {
    switch (role) {
      case 'CMO':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1"><Shield className="w-3 h-3" /> CMO Chief Officer</span>;
      case 'ADMIN':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1"><Shield className="w-3 h-3" /> PHC Admin</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1"><User className="w-3 h-3" /> Medical Officer</span>;
    }
  };

  return (
    <header className="h-16 bg-[#1E293B]/80 backdrop-blur-md border-b border-slate-700/60 sticky top-0 z-40 px-4 md:px-6 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors md:hidden"
        >
          <Hospital className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold shadow-glow-blue">
            <Hospital className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-sm md:text-base text-white tracking-wide flex items-center gap-2">
              Govt. Hospital Geofence Attendance System
            </h1>
            <p className="text-xs text-slate-400 hidden sm:block">
              {user?.phcDetails ? user.phcDetails.name : 'State Public Health Services & Healthcare Network'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        {user?.role && getRoleBadge(user.role)}

        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-blue-500/40 transition-all"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Drawer */}
          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 mt-3 w-80 sm:w-96 bg-[#1E293B] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50"
              >
                <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-900/50">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-blue-400" />
                    <h3 className="font-semibold text-sm text-white">Notifications Center</h3>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAsRead('all')}
                      className="text-xs text-blue-400 hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-800 p-2">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs">
                      No notifications available
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n._id}
                        onClick={() => markAsRead(n._id)}
                        className={`p-3 rounded-xl transition-colors cursor-pointer text-xs ${
                          n.isRead ? 'opacity-60 bg-transparent' : 'bg-slate-800/80 border-l-2 border-blue-500'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-200">{n.title}</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-slate-300 leading-normal">{n.message}</p>
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
            <img
              src={user?.profilePhoto || 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150'}
              alt={user?.name}
              className="w-8 h-8 rounded-lg object-cover border border-slate-600"
            />
            <div className="text-left hidden md:block">
              <div className="text-xs font-semibold text-slate-100">{user?.name}</div>
              <div className="text-[10px] text-slate-400 truncate max-w-[120px]">{user?.email}</div>
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
                <div className="px-3 py-2 border-b border-slate-700/80 mb-1">
                  <p className="text-xs font-bold text-white">{user?.name}</p>
                  <p className="text-[10px] text-slate-400">{user?.qualification || user?.role}</p>
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
