import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { Table } from '../../components/common/Table';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { UserAvatar } from '../../components/common/UserAvatar';
import { Modal } from '../../components/common/Modal';
import { useNotification } from '../../context/NotificationContext';
import {
  FileText, Download, User, Calendar, MapPin, CheckCircle2,
  XCircle, Filter, Search, Building2, Eye, Shield, Clock,
  AlertTriangle, RefreshCw, Layers, History, Check, X, RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const AdminReports = () => {
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' | 'audit'

  // Attendance Records State
  const [attendances, setAttendances] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [phcs, setPhcs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [filterDoctor, setFilterDoctor] = useState('all');
  const [filterPHC, setFilterPHC] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Row Details Modal
  const [selectedRecord, setSelectedRecord] = useState(null);

  // Date Range Filter Modal for PDF Export
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDoctorId, setExportDoctorId] = useState('all');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exporting, setExporting] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [auditSearch, setAuditSearch] = useState('');

  const { addToast } = useNotification();

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [attRes, docRes, phcRes] = await Promise.all([
        axios.get('/api/attendance/history'),
        axios.get('/api/doctors'),
        axios.get('/api/phcs').catch(() => ({ data: { phcs: [] } }))
      ]);
      if (attRes.data.success) setAttendances(attRes.data.attendances || []);
      if (docRes.data.success) setDoctors(docRes.data.doctors || []);
      if (phcRes.data.phcs) setPhcs(phcRes.data.phcs || []);
    } catch (err) {
      addToast('Failed to load attendance logs', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const res = await axios.get('/api/audit-logs?limit=200');
      if (res.data.success) {
        setAuditLogs(res.data.auditLogs || []);
      }
    } catch (err) {
      addToast('Failed to load audit logs', 'danger');
    } finally {
      setAuditLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'audit' && auditLogs.length === 0) {
      fetchAuditLogs();
    }
  };

  const handleResetFilters = () => {
    setFilterDoctor('all');
    setFilterPHC('all');
    setFilterStatus('all');
    setStartDate('');
    setEndDate('');
  };

  const handleDownloadPDF = async (params = {}) => {
    try {
      setExporting(true);
      addToast('Generating PDF Report...', 'info');

      const queryParams = new URLSearchParams();
      if (params.doctorId && params.doctorId !== 'all') queryParams.append('doctorId', params.doctorId);
      if (params.startDate) queryParams.append('startDate', params.startDate);
      if (params.endDate) queryParams.append('endDate', params.endDate);

      const res = await axios.get(`/api/reports/export-pdf?${queryParams.toString()}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Attendance_Report_${params.doctorId || 'All'}_${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      addToast('PDF Report generated & downloaded successfully!', 'success');
      setShowExportModal(false);
    } catch (err) {
      addToast('PDF Report generation failed', 'danger');
    } finally {
      setExporting(false);
    }
  };

  // Filtered attendances based on active controls
  const filteredAttendances = useMemo(() => {
    return attendances.filter((row) => {
      // Doctor filter
      if (filterDoctor !== 'all') {
        const rowDocId = String(row.doctor?._id || row.doctor || row.doctorId || '');
        if (rowDocId !== String(filterDoctor)) return false;
      }

      // PHC filter
      if (filterPHC !== 'all') {
        const rowPhcId = String(row.phc?._id || row.phc || row.phcId || '');
        if (rowPhcId !== String(filterPHC) && row.phcName !== filterPHC) return false;
      }

      // Status filter
      if (filterStatus !== 'all') {
        if (filterStatus === 'PRESENT') {
          if (row.status !== 'PRESENT' && row.status !== 'EXPLANATION_APPROVED' && row.status !== 'PRESENT_APPROVED') return false;
        } else if (filterStatus === 'ABSENT') {
          if (row.status !== 'ABSENT' && row.status !== 'EXPLANATION_REJECTED') return false;
        } else if (filterStatus === 'PENDING_EXPLANATION') {
          if (row.status !== 'PENDING_EXPLANATION' && row.status !== 'EXPLANATION_PENDING') return false;
        } else if (filterStatus === 'OFFICIAL_LEAVE') {
          if (row.status !== 'OFFICIAL_LEAVE' && row.status !== 'ON_LEAVE') return false;
        } else if (row.status !== filterStatus) {
          return false;
        }
      }

      // Date Range filter
      if (startDate && row.date < startDate) return false;
      if (endDate && row.date > endDate) return false;

      return true;
    });
  }, [attendances, filterDoctor, filterPHC, filterStatus, startDate, endDate]);

  // Filtered audit logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (auditActionFilter !== 'all' && log.action !== auditActionFilter) return false;
      if (auditSearch.trim()) {
        const query = auditSearch.toLowerCase();
        const userName = (log.userName || '').toLowerCase();
        const action = (log.action || '').toLowerCase();
        const detailsStr = JSON.stringify(log.details || {}).toLowerCase();
        if (!userName.includes(query) && !action.includes(query) && !detailsStr.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [auditLogs, auditActionFilter, auditSearch]);

  // Format Status Badge
  const renderStatusBadge = (status) => {
    if (status === 'OFFICIAL_LEAVE' || status === 'ON_LEAVE') {
      return <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">OFFICIAL LEAVE</span>;
    }
    if (status === 'PRESENT' || status === 'EXPLANATION_APPROVED' || status === 'PRESENT_APPROVED') {
      return (
        <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          {status === 'EXPLANATION_APPROVED' || status === 'PRESENT_APPROVED' ? 'APPROVED (PRESENT)' : 'PRESENT'}
        </span>
      );
    }
    if (status === 'PENDING_EXPLANATION' || status === 'EXPLANATION_PENDING') {
      return <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">EXPLANATION PENDING</span>;
    }
    if (status === 'EXPLANATION_REJECTED') {
      return <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">EXPLANATION REJECTED</span>;
    }
    return <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">{status || 'ABSENT'}</span>;
  };

  // Table Columns
  const attendanceColumns = [
    {
      header: 'Doctor Name',
      key: 'doctorName',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <UserAvatar gender={row.gender || row.doctorGender || 'Male'} role="DOCTOR" name={row.doctorName || 'Doctor'} size="sm" />
          <div>
            <div className="font-bold text-white text-xs">{row.doctorName || 'Unknown Doctor'}</div>
            <div className="text-[10px] text-slate-400">{row.doctorSpecialization || 'Medical Officer'}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Hospital Center',
      key: 'phcName',
      render: (row) => (
        <div className="text-xs">
          <div className="text-slate-200 font-semibold">{row.phcName || 'Central PHC'}</div>
        </div>
      )
    },
    {
      header: 'Date & Checkpoint',
      key: 'date',
      sortable: true,
      render: (row) => (
        <div className="text-xs">
          <div className="text-slate-200 font-semibold">{row.date}</div>
          <div className="text-[10px] text-slate-400">{row.checkpointTime || row.windowLabel || 'Scheduled Window'}</div>
        </div>
      )
    },
    {
      header: 'GPS / Verification',
      key: 'distanceMeters',
      render: (row) => (
        <div className="text-xs">
          {row.distanceMeters !== null && row.distanceMeters !== undefined ? (
            <span className={`font-semibold ${row.withinGeofence ? 'text-emerald-400' : 'text-amber-400'}`}>
              {row.distanceMeters}m from center {row.withinGeofence ? '✓' : '⚠️'}
            </span>
          ) : row.status === 'OFFICIAL_LEAVE' ? (
            <span className="text-blue-400 font-semibold">Excused (Leave)</span>
          ) : (
            <span className="text-slate-500 italic">No GPS log</span>
          )}
        </div>
      )
    },
    {
      header: 'Status',
      key: 'status',
      sortable: true,
      render: (row) => renderStatusBadge(row.status)
    },
    {
      header: 'Action',
      key: 'action',
      render: (row) => (
        <button
          onClick={() => setSelectedRecord(row)}
          className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-[11px] font-semibold flex items-center gap-1 transition-all"
        >
          <Eye className="w-3.5 h-3.5" /> Details
        </button>
      )
    }
  ];

  // Audit Log Action Badges
  const getAuditBadge = (action) => {
    const map = {
      ATTENDANCE_MARKED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      ATTENDANCE_WINDOW_MISSED: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      EXPLANATION_SUBMITTED: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      EXPLANATION_APPROVED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      EXPLANATION_REJECTED: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      LEAVE_GRANTED: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
      LEAVE_REVOKED: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      LEAVE_APPLIED: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      LEAVE_APPROVED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      LEAVE_REJECTED: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      STARTUP_RECONCILIATION: 'bg-slate-500/20 text-slate-300 border-slate-500/30'
    };
    return map[action] || 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  };

  return (
    <div className="space-y-6">
      <Breadcrumb />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Hospital Duty Reports & System Audit Log</h2>
          <p className="text-xs text-slate-400">Generate doctor reports, filter attendance records, and review immutable audit events.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowExportModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Filter className="w-4 h-4 text-blue-400" /> Filter PDF Export
          </button>
          <button
            onClick={() => handleDownloadPDF({ doctorId: 'all' })}
            disabled={exporting}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-glow-blue transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> {exporting ? 'Generating PDF...' : 'Export All Doctors PDF'}
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-2">
        <button
          onClick={() => handleTabChange('attendance')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
            activeTab === 'attendance'
              ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/20'
              : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:text-white hover:border-slate-600'
          }`}
        >
          <Layers className="w-4 h-4" /> Attendance Records
          <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-900/60 font-mono">
            {filteredAttendances.length}
          </span>
        </button>
        <button
          onClick={() => handleTabChange('audit')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
            activeTab === 'audit'
              ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/20'
              : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:text-white hover:border-slate-600'
          }`}
        >
          <History className="w-4 h-4 text-emerald-400" /> System Audit Log
          {auditLogs.length > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-900/60 font-mono">
              {auditLogs.length}
            </span>
          )}
        </button>
      </div>

      {/* ── TAB 1: ATTENDANCE RECORDS ── */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          {/* Individual Doctor PDF Generator Cards */}
          <div className="p-5 rounded-3xl bg-[#1E293B] border border-slate-700/80 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-sky-400" /> Quick Doctor PDF Export
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {doctors.slice(0, 6).map((d) => (
                <div
                  key={d._id}
                  className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <UserAvatar gender={d.gender} role="DOCTOR" name={d.name} size="sm" />
                    <div>
                      <div className="font-bold text-white text-xs">{d.name}</div>
                      <div className="text-[10px] text-slate-400">{d.specialization}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownloadPDF({ doctorId: d._id })}
                    disabled={exporting}
                    className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-[11px] font-bold flex items-center gap-1 transition-all"
                    title={`Generate PDF report for Dr. ${d.name}`}
                  >
                    <FileText className="w-3.5 h-3.5" /> PDF
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Comprehensive Filter Bar (Section 8) */}
          <div className="p-5 rounded-3xl bg-[#1E293B] border border-slate-700/80 shadow-xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-400" /> Attendance Filters
              </h3>
              <button
                onClick={handleResetFilters}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 hover:underline"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Doctor filter */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Doctor</label>
                <select
                  value={filterDoctor}
                  onChange={(e) => setFilterDoctor(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:border-blue-500 outline-none"
                >
                  <option value="all">All Doctors</option>
                  {doctors.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* PHC filter */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Hospital / PHC</label>
                <select
                  value={filterPHC}
                  onChange={(e) => setFilterPHC(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:border-blue-500 outline-none"
                >
                  <option value="all">All Hospitals / PHCs</option>
                  {phcs.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status filter */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:border-blue-500 outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="PRESENT">Present (Marked & Approved)</option>
                  <option value="ABSENT">Absent</option>
                  <option value="PENDING_EXPLANATION">Explanation Pending</option>
                  <option value="OFFICIAL_LEAVE">Official Leave</option>
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">From Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:border-blue-500 outline-none"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">To Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Main Attendance Logs Table */}
          {loading ? (
            <LoadingSkeleton type="table" count={6} />
          ) : (
            <Table
              columns={attendanceColumns}
              data={filteredAttendances}
              searchPlaceholder="Search doctor, hospital, or date..."
            />
          )}
        </div>
      )}

      {/* ── TAB 2: SYSTEM AUDIT LOG ── */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <div className="p-5 rounded-3xl bg-[#1E293B] border border-slate-700/80 shadow-xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" /> Immutable System Audit Trail (Section 7)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Permanent record of all attendance markings, auto-missed detections, explanation reviews, and official leave actions.
                </p>
              </div>
              <button
                onClick={fetchAuditLogs}
                disabled={auditLoading}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${auditLoading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>

            {/* Audit Filter Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Filter by Event Action</label>
                <select
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:border-blue-500 outline-none"
                >
                  <option value="all">All Events ({auditLogs.length})</option>
                  <option value="ATTENDANCE_MARKED">Attendance Marked</option>
                  <option value="ATTENDANCE_WINDOW_MISSED">Attendance Window Missed</option>
                  <option value="EXPLANATION_SUBMITTED">Explanation Submitted</option>
                  <option value="EXPLANATION_APPROVED">Explanation Approved</option>
                  <option value="EXPLANATION_REJECTED">Explanation Rejected</option>
                  <option value="LEAVE_GRANTED">Leave Granted (Admin Direct)</option>
                  <option value="LEAVE_APPLIED">Leave Applied (Doctor)</option>
                  <option value="LEAVE_APPROVED">Leave Approved</option>
                  <option value="LEAVE_REJECTED">Leave Rejected</option>
                  <option value="LEAVE_REVOKED">Leave Revoked</option>
                  <option value="STARTUP_RECONCILIATION">Startup Reconciliation</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Search Audit Logs</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Search user, action, details..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {auditLoading ? (
            <LoadingSkeleton type="table" count={8} />
          ) : filteredAuditLogs.length === 0 ? (
            <div className="p-12 rounded-3xl bg-[#1E293B] border border-slate-700/80 text-center space-y-3">
              <Shield className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-slate-400">No audit log entries found</div>
              <p className="text-xs text-slate-500">System actions like marking attendance or reviewing explanations will appear here permanently.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAuditLogs.map((log) => (
                <div
                  key={log._id}
                  className="p-4 rounded-2xl bg-[#1E293B] border border-slate-700/80 shadow-md space-y-2 hover:border-slate-600 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${getAuditBadge(log.action)}`}>
                        {log.action}
                      </span>
                      <span className="text-xs font-bold text-white">{log.userName || 'System'}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                        {log.userRole || 'SYSTEM'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {new Date(log.timestamp).toLocaleString('en-IN', {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit', second: '2-digit'
                      })}
                    </div>
                  </div>

                  {log.details && (
                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 text-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {log.details.doctorName && (
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">Doctor</span>
                          <span className="text-slate-200">{log.details.doctorName}</span>
                        </div>
                      )}
                      {log.details.date && (
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">Target Date</span>
                          <span className="text-slate-200">{log.details.date}</span>
                        </div>
                      )}
                      {log.details.windowLabel && (
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">Window</span>
                          <span className="text-slate-200">{log.details.windowLabel}</span>
                        </div>
                      )}
                      {log.details.reason && (
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">Reason</span>
                          <span className="text-slate-200">{log.details.reason}</span>
                        </div>
                      )}
                      {log.details.decision && (
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">Decision</span>
                          <span className={log.details.decision === 'APPROVED' ? 'text-emerald-400' : 'text-rose-400'}>
                            {log.details.decision}
                          </span>
                        </div>
                      )}
                      {log.details.leaveType && (
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">Leave Type</span>
                          <span className="text-slate-200">{log.details.leaveType}</span>
                        </div>
                      )}
                      {log.details.distanceMeters !== undefined && (
                        <div>
                          <span className="text-[10px] text-slate-500 block uppercase font-bold">Distance</span>
                          <span className="text-slate-200">{log.details.distanceMeters}m (Within Geofence: {log.details.withinGeofence ? 'Yes' : 'No'})</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ROW DETAILS MODAL (Section 8) ── */}
      {selectedRecord && (
        <Modal
          isOpen={true}
          title={`Attendance Record Details — Dr. ${selectedRecord.doctorName || 'Doctor'}`}
          onClose={() => setSelectedRecord(null)}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4">
            {/* Doctor & Hospital Header */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Doctor Name</span>
                <span className="font-bold text-white text-sm">{selectedRecord.doctorName}</span>
                <div className="text-[11px] text-slate-400">{selectedRecord.doctorSpecialization}</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Hospital Center</span>
                <span className="font-semibold text-slate-200 text-sm">{selectedRecord.phcName || 'Central PHC'}</span>
              </div>
            </div>

            {/* Attendance Window & Status */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Date</span>
                <span className="font-semibold text-white">{selectedRecord.date}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Duty Window</span>
                <span className="font-semibold text-slate-200">{selectedRecord.checkpointTime || selectedRecord.windowLabel || 'Standard Window'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Attendance Status</span>
                <div className="mt-1">{renderStatusBadge(selectedRecord.status)}</div>
              </div>
            </div>

            {/* Verification & GPS details */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs">
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Geofence & GPS Verification</span>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-slate-400">Marked Time:</span>{' '}
                  <span className="text-slate-200 font-mono">
                    {selectedRecord.markedAt ? new Date(selectedRecord.markedAt).toLocaleTimeString('en-IN') : 'No Check-in'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Geofence Status:</span>{' '}
                  <span className={`font-bold ${selectedRecord.withinGeofence ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {selectedRecord.withinGeofence ? 'Inside Geofence' : 'Outside / Not Verified'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Distance to Center:</span>{' '}
                  <span className="text-blue-400 font-mono">
                    {selectedRecord.distanceMeters !== null && selectedRecord.distanceMeters !== undefined ? `${selectedRecord.distanceMeters}m` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Doctor Coordinates:</span>{' '}
                  <span className="text-slate-300 font-mono">
                    {selectedRecord.latitude && selectedRecord.longitude ? `${selectedRecord.latitude}, ${selectedRecord.longitude}` : 'No GPS Log'}
                  </span>
                </div>
              </div>
            </div>

            {/* Linked Explanation if available */}
            {selectedRecord.explanation && (
              <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-2 text-xs">
                <span className="text-[10px] text-amber-400 block uppercase font-bold">Absence Explanation Details</span>
                <div className="space-y-1">
                  <div>
                    <span className="text-slate-400">Reason:</span>{' '}
                    <span className="text-white font-semibold">{selectedRecord.explanation.reason || selectedRecord.explanation}</span>
                  </div>
                  {selectedRecord.explanation.remarks && (
                    <div>
                      <span className="text-slate-400">Doctor Remarks:</span>{' '}
                      <span className="text-slate-300">{selectedRecord.explanation.remarks}</span>
                    </div>
                  )}
                  {selectedRecord.explanation.adminRemarks && (
                    <div>
                      <span className="text-slate-400">Admin Review Note:</span>{' '}
                      <span className="text-amber-300 font-semibold">{selectedRecord.explanation.adminRemarks}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400">Explanation Status:</span>{' '}
                    <span className="text-amber-400 font-bold">{selectedRecord.explanation.status || 'PENDING'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Linked Leave if available */}
            {selectedRecord.leave && (
              <div className="p-4 rounded-2xl bg-blue-950/20 border border-blue-500/30 space-y-2 text-xs">
                <span className="text-[10px] text-blue-400 block uppercase font-bold">Approved Official Leave</span>
                <div className="space-y-1">
                  <div>
                    <span className="text-slate-400">Period:</span>{' '}
                    <span className="text-white font-semibold">{selectedRecord.leave.startDate} to {selectedRecord.leave.endDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Leave Note:</span>{' '}
                    <span className="text-slate-300">{selectedRecord.leave.leaveNote || selectedRecord.leave.reason || 'Official Leave'}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── PDF EXPORT MODAL ── */}
      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#1E293B] border border-blue-500/30 rounded-3xl p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  <h3 className="text-sm font-bold text-white">Filter Report by Date Range</h3>
                </div>
                <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Select Doctor</label>
                  <select
                    value={exportDoctorId}
                    onChange={(e) => setExportDoctorId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  >
                    <option value="all">All Registered Medical Doctors</option>
                    {doctors.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} ({d.specialization})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">End Date</label>
                  <input
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadPDF({ doctorId: exportDoctorId, startDate: exportStartDate, endDate: exportEndDate })}
                  disabled={exporting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-glow-blue flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" /> {exporting ? 'Generating...' : 'Generate PDF Report'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
