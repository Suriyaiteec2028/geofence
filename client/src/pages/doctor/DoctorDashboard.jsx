import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { useNotification } from '../../context/NotificationContext';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale,
  LinearScale, BarElement, Title
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  CheckCircle2, XCircle, Calendar, BarChart2, TrendingUp,
  Navigation, ShieldCheck, AlertCircle, RefreshCw, Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

// ── Helpers ────────────────────────────────────────────────────────────────
const formatTime12h = (timeStr) => {
  if (!timeStr) return '';
  if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
  const parts = timeStr.split(':');
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) || 0;
  if (isNaN(h)) return timeStr;
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m} ${period}`;
};

const getMonthRange = (offset = 0) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offset;
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  const fmt = (d) => d.toISOString().split('T')[0];
  return { start: fmt(start), end: fmt(end), label: start.toLocaleString('default', { month: 'long', year: 'numeric' }) };
};

const computeStats = (records, rangeStart, rangeEnd, activeLeaves = []) => {
  const filtered = records.filter(r => r.date >= rangeStart && r.date <= rangeEnd);

  // Helper to check if a date falls in an active official leave
  const isDateOnLeave = (dateStr) => {
    return activeLeaves.some(l => l.status === 'ACTIVE' && l.startDate <= dateStr && l.endDate >= dateStr);
  };

  // Present = any checkpoint with PRESENT or EXPLANATION_APPROVED on that date
  const presentDates = new Set(
    filtered
      .filter(r => (r.status === 'PRESENT' || r.status === 'EXPLANATION_APPROVED') && !isDateOnLeave(r.date))
      .map(r => r.date)
  );

  // Absent = dates with ABSENT or PENDING_EXPLANATION that have NO present checkpoint and are NOT on leave
  const absentDates = new Set(
    filtered
      .filter(r => (r.status === 'ABSENT' || r.status === 'PENDING_EXPLANATION' || r.status === 'EXPLANATION_REJECTED') && !presentDates.has(r.date) && !isDateOnLeave(r.date))
      .map(r => r.date)
  );

  // Requirement 3.3: Exclude approved leave dates from working days total
  const totalWorkingDays = presentDates.size + absentDates.size;
  const present = presentDates.size;
  const absent = absentDates.size;
  const pct = totalWorkingDays > 0 ? Math.round((present / totalWorkingDays) * 1000) / 10 : 0;
  return { totalWorkingDays, present, absent, pct, filtered };
};

const getLast14DaysTrend = (records, activeLeaves = []) => {
  const today = new Date();
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('default', { month: 'short', day: 'numeric' });
    const isLeave = activeLeaves.some(l => l.status === 'ACTIVE' && l.startDate <= dateStr && l.endDate >= dateStr);
    const dayRecords = records.filter(r => r.date === dateStr);
    const hasPresent = dayRecords.some(r => r.status === 'PRESENT' || r.status === 'EXPLANATION_APPROVED');
    const hasAbsent = !isLeave && dayRecords.length > 0 && !hasPresent && !dayRecords.every(r => r.status === 'OFFICIAL_LEAVE');
    days.push({ dateStr, label, hasPresent, hasAbsent, isLeave, count: dayRecords.length });
  }
  return days;
};
// ──────────────────────────────────────────────────────────────────────────

export const DoctorDashboard = () => {
  const [shiftData, setShiftData] = useState(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [attendances, setAttendances] = useState([]);
  const [histLoading, setHistLoading] = useState(true);
  const [leaveInfo, setLeaveInfo] = useState(null);
  const [period, setPeriod] = useState('this'); // 'this' | 'last'
  const { addToast } = useNotification();
  const navigate = useNavigate();
  const isMounted = useRef(true);

  const fetchShiftStatus = useCallback(async () => {
    try {
      setErrorMsg(null);
      const res = await axios.get('/api/attendance/shift-status');
      if (res.data.success && isMounted.current) setShiftData(res.data);
    } catch (err) {
      if (isMounted.current)
        setErrorMsg(err.response?.data?.message || 'Unable to connect to attendance server.');
    } finally {
      if (isMounted.current) setShiftLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get('/api/attendance/history');
      if (res.data.success && isMounted.current) setAttendances(res.data.attendances || []);
    } catch {
      // silently fail — analytics will just show 0
    } finally {
      if (isMounted.current) setHistLoading(false);
    }
  }, []);

  const fetchLeaves = useCallback(async () => {
    try {
      const res = await axios.get('/api/leaves/my');
      const active = (res.data.leaves || []).filter(l => l.status === 'ACTIVE');
      const today = new Date().toISOString().split('T')[0];
      if (isMounted.current)
        setLeaveInfo({
          currentLeave: active.find(l => l.startDate <= today && l.endDate >= today),
          upcomingLeave: active.find(l => l.startDate > today),
          activeLeaves: active
        });
    } catch { if (isMounted.current) setLeaveInfo(null); }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    fetchShiftStatus();
    fetchHistory();
    fetchLeaves();

    // Listen for attendance-marked event dispatched by MarkAttendance page
    const onAttendanceMarked = () => {
      fetchHistory();
      fetchShiftStatus();
    };
    window.addEventListener('attendance-marked', onAttendanceMarked);

    return () => {
      isMounted.current = false;
      window.removeEventListener('attendance-marked', onAttendanceMarked);
    };
  }, [fetchShiftStatus, fetchHistory, fetchLeaves]);

  if (shiftLoading) return <LoadingSkeleton type="card" count={3} />;

  if (errorMsg) {
    return (
      <div className="space-y-6">
        <Breadcrumb />
        <div className="p-8 rounded-3xl bg-rose-950/30 border border-rose-500/30 text-center space-y-4 max-w-xl mx-auto my-12">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Shift Status Notice</h3>
          <p className="text-xs text-rose-300/80">{errorMsg}</p>
          <button
            onClick={() => { setShiftLoading(true); fetchShiftStatus(); }}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center justify-center gap-2 mx-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Status
          </button>
        </div>
      </div>
    );
  }

  const doctor = shiftData?.doctor;
  const phc = shiftData?.phc;

  // ── Period filter ──────────────────────────────────────────────────────
  const thisMonth = getMonthRange(0);
  const lastMonth = getMonthRange(-1);
  const range = period === 'this' ? thisMonth : lastMonth;
  const stats = computeStats(attendances, range.start, range.end, leaveInfo?.activeLeaves || []);
  const trend = getLast14DaysTrend(attendances, leaveInfo?.activeLeaves || []);

  // ── Chart data ─────────────────────────────────────────────────────────
  const donutData = {
    labels: ['Present', 'Absent'],
    datasets: [{
      data: [stats.present, stats.absent],
      backgroundColor: ['rgba(16,185,129,0.8)', 'rgba(239,68,68,0.7)'],
      borderColor: ['rgba(16,185,129,1)', 'rgba(239,68,68,1)'],
      borderWidth: 2,
      hoverOffset: 6
    }]
  };

  const donutOptions = {
    responsive: true,
    cutout: '72%',
    plugins: {
      legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 }, padding: 16 } },
      tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed} day${ctx.parsed !== 1 ? 's' : ''}` } }
    }
  };

  const barData = {
    labels: trend.map(d => d.label),
    datasets: [
      {
        label: 'Present',
        data: trend.map(d => (d.hasPresent ? 1 : 0)),
        backgroundColor: 'rgba(16,185,129,0.75)',
        borderRadius: 4,
        borderSkipped: false
      },
      {
        label: 'Absent (no record)',
        data: trend.map(d => (d.hasAbsent ? 1 : 0)),
        backgroundColor: 'rgba(239,68,68,0.65)',
        borderRadius: 4,
        borderSkipped: false
      }
    ]
  };

  const barOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 }, padding: 12 } },
      title: { display: false }
    },
    scales: {
      x: { stacked: true, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 45 } },
      y: { stacked: true, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { size: 10 }, stepSize: 1 }, max: 1 }
    }
  };

  const statCards = [
    { label: 'Total Working Days', value: stats.totalWorkingDays, icon: Calendar, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { label: 'Present Days', value: stats.present, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { label: 'Absent Days', value: stats.absent, icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
    { label: 'Attendance %', value: `${stats.pct}%`, icon: TrendingUp, color: stats.pct >= 75 ? 'text-emerald-400' : 'text-amber-400', bg: stats.pct >= 75 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20' }
  ];

  // Recent 5 records
  const recentRecords = [...attendances]
    .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <Breadcrumb />

      {/* ── Doctor Info Header ── */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-950 border border-emerald-500/30 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" /> Duty Officer Attendance Portal
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">{doctor?.name}</h2>
          <p className="text-xs text-slate-400">
            Assigned Hospital: <strong className="text-slate-200">{phc?.name || 'Primary Health Center'}</strong> | Shift: {formatTime12h(doctor?.shiftStart)} – {formatTime12h(doctor?.shiftEnd)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/doctor/mark')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all ${
              leaveInfo?.currentLeave
                ? 'bg-blue-600/30 text-blue-300 border border-blue-500/30'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
            }`}
          >
            <Navigation className="w-4 h-4" />
            {leaveInfo?.currentLeave ? '🌴 On Leave Today' : 'Mark Attendance'}
          </button>
          <button
            onClick={() => navigate('/doctor/explanation')}
            className="px-3.5 py-2 rounded-xl bg-amber-600/20 text-amber-300 hover:bg-amber-600/30 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5"
          >
            Submit Absence Explanation
          </button>
        </div>
      </div>

      {/* ── Official Leave Notice (Requirement 3.2) ── */}
      {leaveInfo && (leaveInfo.currentLeave || leaveInfo.upcomingLeave) && (
        <div className="bg-gradient-to-r from-blue-900/50 via-indigo-900/40 to-slate-900 rounded-3xl p-6 border border-blue-500/30 shadow-2xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-300 uppercase tracking-wider">
            <Calendar className="w-4 h-4" /> Official Leave Status
          </div>
          {leaveInfo.currentLeave && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-3 py-1 text-xs font-extrabold bg-blue-500 text-white rounded-full flex items-center gap-1 shadow-lg shadow-blue-500/30">
                  🌴 You are on Official Leave Today
                </span>
                <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Status: Approved
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs text-slate-300">
                <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Leave Period</span>
                  <span className="text-white font-semibold">{leaveInfo.currentLeave.startDate} to {leaveInfo.currentLeave.endDate}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Leave Type</span>
                  <span className="text-white font-semibold">{leaveInfo.currentLeave.leaveType || 'Official Leave'}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Admin Note</span>
                  <span className="text-slate-300">{leaveInfo.currentLeave.leaveNote || 'Approved by Administration'}</span>
                </div>
              </div>
              <p className="text-[11px] text-blue-300/80">
                Attendance requirements are excused for today. Attendance windows are not required on approved leave days.
              </p>
            </div>
          )}
          {leaveInfo.upcomingLeave && !leaveInfo.currentLeave && (
            <div className="bg-indigo-800/30 rounded-2xl p-4 border border-indigo-700/30">
              <span className="inline-block px-2.5 py-0.5 text-xs font-bold bg-indigo-500 text-white rounded-full mb-1">
                Upcoming Approved Leave
              </span>
              <p className="text-sm text-slate-200 mt-1">
                {leaveInfo.upcomingLeave.startDate} to {leaveInfo.upcomingLeave.endDate}
                {leaveInfo.upcomingLeave.leaveNote && ` · Note: ${leaveInfo.upcomingLeave.leaveNote}`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Attendance Overview Header + Period Filter ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-400" /> Attendance Overview
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">{range.label}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPeriod('this')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${period === 'this' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-500'}`}
          >
            This Month
          </button>
          <button
            onClick={() => setPeriod('last')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${period === 'last' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-500'}`}
          >
            Last Month
          </button>
          <button
            onClick={() => { fetchHistory(); fetchShiftStatus(); }}
            className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-all"
            title="Refresh data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Summary Stat Cards ── */}
      {histLoading ? (
        <LoadingSkeleton type="card" count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <div key={card.label} className={`p-5 rounded-2xl bg-[#1E293B] border ${card.bg} flex flex-col gap-3`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{card.label}</span>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <div className={`text-3xl font-extrabold ${card.color}`}>{card.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Charts Row ── */}
      {!histLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Donut chart */}
          <div className="lg:col-span-4 p-6 rounded-3xl bg-[#1E293B] border border-slate-700/80 shadow-xl">
            <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Present vs Absent
            </h4>
            {stats.totalWorkingDays === 0 ? (
              <div className="flex flex-col items-center justify-center h-44 text-slate-500 text-xs gap-2">
                <Calendar className="w-8 h-8 opacity-30" />
                No attendance records for this period
              </div>
            ) : (
              <div className="relative">
                <Doughnut data={donutData} options={donutOptions} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className={`text-2xl font-extrabold ${stats.pct >= 75 ? 'text-emerald-400' : 'text-amber-400'}`}>{stats.pct}%</span>
                  <span className="text-[10px] text-slate-400">Attendance</span>
                </div>
              </div>
            )}
          </div>

          {/* Bar trend chart */}
          <div className="lg:col-span-8 p-6 rounded-3xl bg-[#1E293B] border border-slate-700/80 shadow-xl">
            <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" /> Last 14 Days Attendance Trend
            </h4>
            {attendances.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-44 text-slate-500 text-xs gap-2">
                <BarChart2 className="w-8 h-8 opacity-30" />
                No records to display
              </div>
            ) : (
              <Bar data={barData} options={barOptions} />
            )}
          </div>
        </div>
      )}

      {/* ── Recent Attendance Records ── */}
      {!histLoading && (
        <div className="p-6 rounded-3xl bg-[#1E293B] border border-slate-700/80 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" /> Recent Attendance
            </h4>
            <button
              onClick={() => navigate('/doctor/history')}
              className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold"
            >
              View Full History →
            </button>
          </div>

          {recentRecords.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">No attendance records yet.</div>
          ) : (
            <div className="space-y-2">
              {recentRecords.map((rec, idx) => (
                <div key={rec._id || idx} className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${rec.status === 'PRESENT' || rec.status === 'EXPLANATION_APPROVED' ? 'bg-emerald-400' : rec.status === 'PENDING_EXPLANATION' ? 'bg-amber-400' : 'bg-rose-400'}`} />
                    <div>
                      <div className="text-xs font-semibold text-white">{rec.date}</div>
                      <div className="text-[11px] text-slate-400">{rec.checkpointTime || rec.windowLabel || '—'}</div>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                    rec.status === 'PRESENT' || rec.status === 'EXPLANATION_APPROVED'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : rec.status === 'PENDING_EXPLANATION'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  }`}>
                    {rec.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
