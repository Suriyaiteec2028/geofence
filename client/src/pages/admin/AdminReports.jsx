import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { Table } from '../../components/common/Table';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { useNotification } from '../../context/NotificationContext';
import { FileText, Download, User, Calendar, MapPin, CheckCircle2, XCircle } from 'lucide-react';

export const AdminReports = () => {
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useNotification();

  useEffect(() => {
    fetchAttendances();
  }, []);

  const fetchAttendances = async () => {
    try {
      const res = await axios.get('/api/attendance/history');
      if (res.data.success) setAttendances(res.data.attendances);
    } catch (err) {
      addToast('Failed to load attendance logs', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      addToast('Generating PDF Report...', 'info');
      const res = await axios.get('/api/reports/export-pdf', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Admin_Attendance_Report_${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      addToast('PDF Report downloaded!', 'success');
    } catch (err) {
      addToast('Download failed', 'danger');
    }
  };

  const columns = [
    {
      header: 'Doctor Name',
      key: 'doctorName',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
            <User className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-white text-xs">{row.doctorName}</div>
            <div className="text-[10px] text-slate-400">{row.doctorSpecialization}</div>
          </div>
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
      header: 'GPS Distance & Radius',
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
            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
        }`}>
          {row.status}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Hospital Shift Attendance Logs</h2>
          <p className="text-xs text-slate-400">Detailed shift logs and downloadable PDF reports.</p>
        </div>
        <button
          onClick={handleDownloadPDF}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-glow-blue transition-all"
        >
          <Download className="w-4 h-4" /> Export PDF Report
        </button>
      </div>

      {loading ? (
        <LoadingSkeleton type="table" count={6} />
      ) : (
        <Table columns={columns} data={attendances} searchPlaceholder="Search doctor or date..." />
      )}
    </div>
  );
};
