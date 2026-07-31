import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { User, Mail, Phone, Clock, Building2, ShieldCheck, Award } from 'lucide-react';

export const DoctorProfile = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Breadcrumb />

      <div className="p-8 rounded-3xl bg-[#1E293B] border border-slate-700/80 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row items-center gap-6 border-b border-slate-700/80 pb-6">
          <img
            src={user?.profilePhoto || 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150'}
            alt={user?.name}
            className="w-24 h-24 rounded-2xl object-cover border-2 border-blue-500/40 shadow-glow-blue"
          />
          <div className="text-center sm:text-left space-y-1">
            <h2 className="text-2xl font-bold text-white tracking-tight">{user?.name}</h2>
            <p className="text-xs font-semibold text-blue-400">{user?.specialization || 'Medical Officer'}</p>
            <p className="text-xs text-slate-400">{user?.qualification || 'MBBS, MS'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="text-slate-400 flex items-center gap-1.5"><Mail className="w-4 h-4 text-blue-400" /> Email Address</span>
            <p className="font-semibold text-white">{user?.email}</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="text-slate-400 flex items-center gap-1.5"><Phone className="w-4 h-4 text-emerald-400" /> Mobile Contact</span>
            <p className="font-semibold text-white">{user?.mobile || '+91 98765 43213'}</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="text-slate-400 flex items-center gap-1.5"><Building2 className="w-4 h-4 text-purple-400" /> Assigned Hospital PHC</span>
            <p className="font-semibold text-white">{user?.phcDetails ? user.phcDetails.name : 'Central District Hospital PHC'}</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="text-slate-400 flex items-center gap-1.5"><Clock className="w-4 h-4 text-amber-400" /> Duty Shift Timing</span>
            <p className="font-semibold font-mono text-sky-300">{user?.shiftStart || '11:15'} – {user?.shiftEnd || '16:15'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
