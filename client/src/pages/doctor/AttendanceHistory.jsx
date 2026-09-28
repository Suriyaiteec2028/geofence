import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { Table } from '../../components/common/Table';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { useNotification } from '../../context/NotificationContext';
import { FileText, Calendar, Clock, MapPin, RefreshCw } from 'lucide-react';

export const AttendanceHistory = () => {
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useNotification();
  const isMounted = useRef(true);

  const fetchHistory = useCallback(async (showToast = false) => {
    try {
      const res = await axios.get('/api/attendance/history');
      if (res.data.success && isMounted.current) {
        setAttendances(res.data.attendances);
        if (showToast) addToast('Attendance history refreshed', 'info');
      }
    } catch (err) {
      if (isMounted.current) addToast('Error fetching attendance history', 'danger');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    isMounted.current = true;
    fetchHistory();

    // Auto-refresh when attendance is marked from the MarkAttendance page
    const onAttendanceMarked = () => fetchHistory(false);
    window.addEventListener('attendance-marked', onAttendanceMarked);

    return () => {
      isMounted.current = false;
      window.removeEventListener('attendance-marked', onAttendanceMarked);
    };
  }, [fetchHistory]);

  const columns = [
    {
      header: 'Date',
      key: 'date',
      sortable: true,
      render: (row) => (
        <div className="font-semibold text-white text-xs flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-blue-400" /> {row.date}
        </div>
      )
    },
    {
      header: 'Checkpoint Window',
      key: 'checkpointTime',
      render: (row) => (
        <div className="text-xs text-slate-300 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-slate-500" /> {row.checkpointTime || row.windowLabel}
        </div>
      )
    },
    {
      header: 'GPS Verification',
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
          <h2 className="text-xl font-bold text-white tracking-tight">My Attendance Log</h2>
          <p className="text-xs text-slate-400">Complete historical record of duty shift check-ins.</p>
        </div>
        <button
          onClick={() => fetchHistory(true)}
          className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-all"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <LoadingSkeleton type="table" count={5} />
      ) : (
        <Table columns={columns} data={attendances} searchPlaceholder="Search date or status..." />
      )}
    </div>
  );
};
