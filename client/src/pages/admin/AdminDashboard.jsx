import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { DoctorStatusDoughnut } from '../../components/charts/AttendanceCharts';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { UserCheck, Users, Clock, AlertTriangle, MapPin, ClipboardCheck, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export const AdminDashboard = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      const res = await axios.get('/api/reports/summary');
      if (res.data.success) {
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.error('Error fetching admin summary:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSkeleton type="card" count={4} />;

  return (
    <div className="space-y-6">
      <Breadcrumb />

      {/* Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-950/60 via-slate-900 to-slate-950 border border-blue-500/20 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Hospital Administration Console</h2>
          <p className="text-xs text-slate-400">Manage assigned doctors, geofence parameters, and absence explanations.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/admin/geofence')}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-glow-blue transition-all"
          >
            <MapPin className="w-3.5 h-3.5" /> Geofence Settings
          </button>
          <button
            onClick={() => navigate('/admin/explanations')}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg transition-all"
          >
            <ClipboardCheck className="w-3.5 h-3.5" /> Review Explanations ({summary?.pendingExplanations ?? 0})
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-2xl bg-[#1E293B] border border-slate-700/80 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Assigned Doctors</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">{summary?.totalDoctors ?? 0}</div>
          <div className="text-[11px] text-slate-400">Active medical staff</div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-5 rounded-2xl bg-[#1E293B] border border-slate-700/80 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Doctors Present Today</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-400">{summary?.presentCount ?? 0}</div>
          <div className="text-[11px] text-emerald-400 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" /> Punctual Check-in
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="p-5 rounded-2xl bg-[#1E293B] border border-slate-700/80 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Doctors Absent Today</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-rose-400">{summary?.absentCount ?? 0}</div>
          <div className="text-[11px] text-slate-400">Missed checkpoint window</div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="p-5 rounded-2xl bg-[#1E293B] border border-slate-700/80 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Pending Review Requests</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-300">{summary?.pendingExplanations ?? 0}</div>
          <div className="text-[11px] text-amber-400 cursor-pointer hover:underline" onClick={() => navigate('/admin/explanations')}>
            Review explanations &rarr;
          </div>
        </motion.div>
      </div>

      {/* Doughnut Chart & Quick Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 p-6 rounded-3xl bg-[#1E293B] border border-slate-700/80 shadow-xl space-y-4">
          <h3 className="font-bold text-sm text-white">Today's Attendance Breakdown</h3>
          <DoctorStatusDoughnut
            present={summary?.presentCount ?? 0}
            absent={summary?.absentCount ?? 0}
            pending={summary?.pendingExplanations ?? 0}
          />
        </div>

        <div className="lg:col-span-2 p-6 rounded-3xl bg-[#1E293B] border border-slate-700/80 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-white">Shift Checkpoint Business Rules</h3>
            <span className="text-[11px] text-blue-400 font-semibold bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
              Interval: 60m | Duration: 5m
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Attendance windows open automatically every hour during doctor's duty shift (e.g. 11:15 AM - 4:15 PM) and remain open for exactly 5 minutes. GPS coordinates are validated against OpenStreetMap geofence limits.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs">
              <span className="font-bold text-slate-200">Inside Geofence:</span>
              <p className="text-[11px] text-slate-400 mt-0.5">Recorded as PRESENT with exact meter distance log.</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs">
              <span className="font-bold text-slate-200">Outside Geofence / Missed Window:</span>
              <p className="text-[11px] text-slate-400 mt-0.5">Marked ABSENT. Doctor can submit supporting explanation & proof.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
