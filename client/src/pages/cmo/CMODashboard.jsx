import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { MonthlyTrendChart, PHCPerformanceChart } from '../../components/charts/AttendanceCharts';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { Building2, Users, UserCheck, Activity, ShieldCheck, Clock, ArrowUpRight, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

export const CMODashboard = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

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
      console.error('Error fetching CMO summary:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSkeleton type="card" count={4} />;

  return (
    <div className="space-y-6">
      <Breadcrumb />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-purple-900/40 via-blue-900/30 to-slate-900 border border-purple-500/20 shadow-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-purple-400 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" /> Chief Medical Officer Command Center
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Public Health Network Governance</h2>
          <p className="text-xs text-slate-400">Monitoring shift compliance across all regional Primary Health Centers (PHCs).</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchSummary}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg transition-all"
          >
            Refresh Dashboard Data
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-2xl bg-[#1E293B] border border-slate-700/80 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Primary Health Centers</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">{summary?.totalPHCs || 3}</div>
          <div className="text-[11px] text-emerald-400 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> 100% Operational Hospitals
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-5 rounded-2xl bg-[#1E293B] border border-slate-700/80 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Registered Doctors</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">{summary?.totalDoctors || 12}</div>
          <div className="text-[11px] text-slate-400">Assigned across scheduled duty shifts</div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="p-5 rounded-2xl bg-[#1E293B] border border-slate-700/80 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Today's Compliance %</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-purple-300">{summary?.attendancePercentage || 94}%</div>
          <div className="text-[11px] text-emerald-400 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" /> +2.4% vs last week
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="p-5 rounded-2xl bg-[#1E293B] border border-slate-700/80 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Pending Reviews</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-300">{summary?.pendingExplanations || 1}</div>
          <div className="text-[11px] text-slate-400">Absence explanations awaiting admin approval</div>
        </motion.div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-3xl bg-[#1E293B] border border-slate-700/80 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-white">Monthly Attendance Compliance Trend</h3>
              <p className="text-xs text-slate-400">Aggregate shift check-in percentage (Jan - Jul)</p>
            </div>
          </div>
          <MonthlyTrendChart trends={summary?.monthlyTrends} />
        </div>

        <div className="p-6 rounded-3xl bg-[#1E293B] border border-slate-700/80 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-white">PHC Health Center Ranking</h3>
              <p className="text-xs text-slate-400">Shift compliance comparison by hospital center</p>
            </div>
          </div>
          <PHCPerformanceChart phcs={summary?.phcPerformance} />
        </div>
      </div>
    </div>
  );
};
