import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutDashboard, Building2, Users, MapPin, ClipboardCheck, 
  FileText, Cpu, Clock, CheckSquare, UserCheck, ChevronLeft, ChevronRight, Hospital 
} from 'lucide-react';
import { motion } from 'framer-motion';

export const Sidebar = ({ isOpen, setIsOpen }) => {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const role = user?.role || 'DOCTOR';

  const cmoNav = [
    { path: '/cmo', label: 'CMO Overview', icon: LayoutDashboard },
    { path: '/cmo/phcs', label: 'Manage PHCs', icon: Building2 },
    { path: '/cmo/admins', label: 'Manage Admins', icon: Users },
    { path: '/cmo/reports', label: 'Reports & AI Insights', icon: Cpu }
  ];

  const adminNav = [
    { path: '/admin', label: 'Admin Overview', icon: LayoutDashboard },
    { path: '/admin/doctors', label: 'Doctor Accounts', icon: UserCheck },
    { path: '/admin/geofence', label: 'Geofence Settings', icon: MapPin },
    { path: '/admin/explanations', label: 'Explanation Review', icon: ClipboardCheck },
    { path: '/admin/reports', label: 'Attendance Reports', icon: FileText }
  ];

  const doctorNav = [
    { path: '/doctor', label: 'Doctor Dashboard', icon: Clock },
    { path: '/doctor/mark', label: 'Mark Attendance', icon: CheckSquare },
    { path: '/doctor/explanation', label: 'Absence Explanation', icon: ClipboardCheck },
    { path: '/doctor/history', label: 'Attendance History', icon: FileText },
    { path: '/doctor/profile', label: 'Doctor Profile', icon: Users }
  ];

  const navItems = role === 'CMO' ? cmoNav : role === 'ADMIN' ? adminNav : doctorNav;

  return (
    <aside
      className={`fixed md:static inset-y-0 left-0 z-30 bg-[#1E293B] border-r border-slate-700/60 transition-all duration-300 flex flex-col ${
        collapsed ? 'w-20' : 'w-64'
      } ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
    >
      {/* Sidebar Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-700/60">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400">
            <Hospital className="w-5 h-5 flex-shrink-0" />
          </div>
          {!collapsed && (
            <span className="font-bold text-sm text-white tracking-wide truncate">
              {role === 'CMO' ? 'CMO PORTAL' : role === 'ADMIN' ? 'ADMIN PORTAL' : 'DOCTOR PORTAL'}
            </span>
          )}
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/cmo' || item.path === '/admin' || item.path === '/doctor'}
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-3 py-3 rounded-xl font-medium text-xs md:text-sm transition-all group ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-glow-blue font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
                }`
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Sidebar Footer info */}
      {!collapsed && (
        <div className="p-4 m-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400">
          <div className="flex items-center gap-2 font-medium text-slate-300 mb-1">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            System Status: Active
          </div>
          <p className="text-[11px] text-slate-400">Dynamic Shift Geofence Engine v2.4</p>
        </div>
      )}
    </aside>
  );
};
