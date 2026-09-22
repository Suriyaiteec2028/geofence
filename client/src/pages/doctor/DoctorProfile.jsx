import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { User, Mail, Phone, Clock, Building2, ShieldCheck, Award } from 'lucide-react';

export const DoctorProfile = () => {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);

  useEffect(() => {
    const fetchLeaves = async () => {
      try {
        const res = await axios.get('/api/leaves/my');
        setLeaves(res.data.leaves || []);
      } catch (err) { setLeaves([]); }
    };
    fetchLeaves();
  }, []);

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

        {leaves.length > 0 && (
          <div className="mt-6 bg-slate-800/60 rounded-xl p-5 border border-slate-700/50">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Official Leave History</h3>
            <div className="space-y-2">
              {leaves.map((leave, idx) => (
                <div key={idx} className="flex items-center justify-between bg-slate-900/50 rounded-lg p-3">
                  <div>
                    <p className="text-sm text-slate-200">{leave.startDate} → {leave.endDate}</p>
                    {leave.leaveNote && <p className="text-xs text-slate-400 mt-0.5">{leave.leaveNote}</p>}
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                    leave.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-600/40 text-slate-400'
                  }`}>
                    {leave.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
