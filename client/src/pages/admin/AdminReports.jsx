import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { Table } from '../../components/common/Table';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { UserAvatar } from '../../components/common/UserAvatar';
import { useNotification } from '../../context/NotificationContext';
import { FileText, Download, User, Calendar, MapPin, CheckCircle2, XCircle, Filter, Search, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const AdminReports = () => {
  const [attendances, setAttendances] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Date Range Filter Modal State
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exporting, setExporting] = useState(false);

  const { addToast } = useNotification();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [attRes, docRes] = await Promise.all([
        axios.get('/api/attendance/history'),
        axios.get('/api/doctors')
      ]);
      if (attRes.data.success) setAttendances(attRes.data.attendances);
      if (docRes.data.success) setDoctors(docRes.data.doctors);
    } catch (err) {
      addToast('Failed to load attendance logs', 'danger');
    } finally {
      setLoading(false);
    }
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
      setShowFilterModal(false);
    } catch (err) {
      addToast('PDF Report generation failed', 'danger');
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    {
      header: 'Doctor Name',
      key: 'doctorName',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <UserAvatar gender={row.gender || 'Male'} role="DOCTOR" name={row.doctorName} size="sm" />
          <div>
            <div className="font-bold text-white text-xs">{row.doctorName}</div>
            <div className="text-[10px] text-slate-400">{row.doctorSpecialization}</div>
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
          <div className="text-[10px] text-slate-400">{row.checkpointTime || row.windowLabel}</div>
        </div>
      )
    },
    {
      header: 'GPS Distance',
      key: 'distanceMeters',
      render: (row) => (
        <div className="text-xs">
          {row.distanceMeters !== null && row.distanceMeters !== undefined ? (
            <span className="text-blue-400 font-semibold">{row.distanceMeters}m from center</span>
          ) : (
            <span className="text-slate-500 italic">No GPS log</span>
          )}
        </div>
      )
    },
    {
      header: 'Attendance Status',
      key: 'status',
      sortable: true,
      render: (row) => (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
          row.status === 'PRESENT' || row.status === 'EXPLANATION_APPROVED'
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            : row.status === 'PENDING_EXPLANATION'
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
        }`}>
          {row.status === 'EXPLANATION_APPROVED' ? 'APPROVED (PRESENT)' : row.status}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Hospital Duty Reports & PDF Export</h2>
          <p className="text-xs text-slate-400">Generate individual doctor reports and filter logs by date range.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilterModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Filter className="w-4 h-4 text-blue-400" /> Filter Date Range Report
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

      {/* Doctor-wise Report Generation Cards */}
      <div className="p-5 rounded-3xl bg-[#1E293B] border border-slate-700/80 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <User className="w-4 h-4 text-sky-400" /> Individual Doctor Report Generator (All Days)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {doctors.map((d) => (
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

      {/* Date Range Filter Modal */}
      <AnimatePresence>
        {showFilterModal && (
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
                <button onClick={() => setShowFilterModal(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Select Doctor</label>
                  <select
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
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
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-700">
                <button type="button" onClick={() => setShowFilterModal(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadPDF({ doctorId: selectedDoctorId, startDate, endDate })}
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

      {/* Main Attendance Logs Table */}
      {loading ? (
        <LoadingSkeleton type="table" count={6} />
      ) : (
        <Table columns={columns} data={attendances} searchPlaceholder="Search doctor or date..." />
      )}
    </div>
  );
};
