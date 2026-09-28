import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { Table } from '../../components/common/Table';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { useNotification } from '../../context/NotificationContext';
import { Calendar, Clock, MapPin, RefreshCw, Eye, CheckCircle2, XCircle, AlertCircle, ShieldCheck, FileText } from 'lucide-react';

export const AttendanceHistory = () => {
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const { addToast } = useNotification();
  const isMounted = useRef(true);

  const fetchHistory = useCallback(async (showToast = false) => {
    try {
      const res = await axios.get('/api/attendance/history');
      if (res.data.success && isMounted.current) {
        setAttendances(res.data.attendances || []);
        if (showToast) addToast('Attendance history refreshed', 'info');
      }
    } catch {
      if (isMounted.current) addToast('Error fetching attendance history', 'danger');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    isMounted.current = true;
    fetchHistory();

    const onAttendanceMarked = () => fetchHistory(false);
    window.addEventListener('attendance-marked', onAttendanceMarked);

    return () => {
      isMounted.current = false;
      window.removeEventListener('attendance-marked', onAttendanceMarked);
    };
  }, [fetchHistory]);

  const handleOpenDetails = (row) => {
    setSelectedRecord(row);
    setShowDetailModal(true);
  };

  // Status mapping & badges per Section 5.1 & 5.2
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'PRESENT':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 w-fit">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Present
          </span>
        );
      case 'EXPLANATION_APPROVED':
      case 'PRESENT_APPROVED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 w-fit">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Present — Approved Explanation
          </span>
        );
      case 'PENDING_EXPLANATION':
      case 'EXPLANATION_PENDING':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 w-fit">
            <AlertCircle className="w-3 h-3 text-amber-400" /> Absent — Explanation Pending
          </span>
        );
      case 'OFFICIAL_LEAVE':
      case 'ON_LEAVE':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1 w-fit">
            <Calendar className="w-3 h-3 text-blue-400" /> Official Leave
          </span>
        );
      case 'UPCOMING':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-600/30 text-slate-400 border border-slate-600/30 flex items-center gap-1 w-fit">
            Upcoming
          </span>
        );
      case 'NOT_APPLICABLE':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-700/30 text-slate-400 border border-slate-700/30 flex items-center gap-1 w-fit">
            Not Applicable
          </span>
        );
      case 'ABSENT':
      case 'EXPLANATION_REJECTED':
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1 w-fit">
            <XCircle className="w-3 h-3 text-rose-400" /> Absent
          </span>
        );
    }
  };

  // Section 5.1 Columns Definition
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
      header: 'Duty Window',
      key: 'dutyWindow',
      render: (row) => (
        <div className="text-xs text-slate-300 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-slate-500" /> {row.windowLabel || row.checkpointTime || 'Shift Window'}
        </div>
      )
    },
    {
      header: 'Check-in Time',
      key: 'checkInTime',
      render: (row) => {
        if (!row.markedAt) return <span className="text-slate-500 text-xs">—</span>;
        const timeStr = new Date(row.markedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return <span className="font-mono text-emerald-400 text-xs font-semibold">{timeStr}</span>;
      }
    },
    {
      header: 'Location',
      key: 'location',
      render: (row) => {
        if (row.status === 'OFFICIAL_LEAVE') {
          return <span className="text-blue-300 text-xs font-medium">Approved Leave</span>;
        }
        if (row.withinGeofence) {
          return (
            <div className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Inside ({row.distanceMeters !== undefined ? `${row.distanceMeters}m` : 'Verified'})
            </div>
          );
        }
        if (row.distanceMeters !== null && row.distanceMeters !== undefined) {
          return (
            <div className="text-xs text-rose-400 flex items-center gap-1 font-semibold">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              Outside ({row.distanceMeters}m)
            </div>
          );
        }
        return <span className="text-slate-500 text-xs italic">No GPS Log</span>;
      }
    },
    {
      header: 'Status',
      key: 'status',
      sortable: true,
      render: (row) => renderStatusBadge(row.status)
    },
    {
      header: 'Explanation',
      key: 'explanation',
      render: (row) => {
        if (!row.explanation && row.status !== 'PENDING_EXPLANATION') {
          return <span className="text-slate-500 text-xs">—</span>;
        }
        const expStatus = row.explanation?.status || (row.status === 'PENDING_EXPLANATION' ? 'PENDING' : 'N/A');
        const badgeMap = {
          PENDING: 'text-amber-400 bg-amber-500/10 border border-amber-500/20',
          APPROVED: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20',
          REJECTED: 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
        };
        const labelMap = {
          PENDING: 'Pending Approval',
          APPROVED: 'Approved',
          REJECTED: 'Rejected'
        };
        return (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${badgeMap[expStatus] || 'text-slate-400'}`}>
            {labelMap[expStatus] || expStatus}
          </span>
        );
      }
    },
    {
      header: 'Action',
      key: 'action',
      render: (row) => (
        <button
          onClick={() => handleOpenDetails(row)}
          className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 border border-slate-700 transition-all hover:text-white"
        >
          <Eye className="w-3.5 h-3.5 text-blue-400" /> Details
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Attendance History</h2>
          <p className="text-xs text-slate-400">Date-wise breakdown of scheduled shift checkpoint windows and verification logs.</p>
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
        <Table columns={columns} data={attendances} searchPlaceholder="Search by date, window, or status..." />
      )}

      {/* Detail Modal per Section 5.1 */}
      {showDetailModal && selectedRecord && (
        <Modal
          title={`Attendance Details — ${selectedRecord.date} (${selectedRecord.windowLabel || selectedRecord.checkpointTime})`}
          onClose={() => setShowDetailModal(false)}
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2.5">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-slate-400">Attendance Status:</span>
                <div>{renderStatusBadge(selectedRecord.status)}</div>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Duty Date:</span>
                <span className="text-white font-semibold">{selectedRecord.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Scheduled Checkpoint Window:</span>
                <span className="text-slate-200">{selectedRecord.windowLabel || selectedRecord.checkpointTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Actual Check-in Time:</span>
                <span className="text-slate-200 font-mono">
                  {selectedRecord.markedAt ? new Date(selectedRecord.markedAt).toLocaleString('en-IN') : 'Not Checked In'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Hospital Center:</span>
                <span className="text-slate-200">{selectedRecord.phcName || 'Primary Health Center'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Geofence Distance:</span>
                <span className="text-slate-200">
                  {selectedRecord.distanceMeters !== undefined ? `${selectedRecord.distanceMeters}m from hospital center` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Within Geofence Radius:</span>
                <span className={selectedRecord.withinGeofence ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                  {selectedRecord.withinGeofence ? '✓ Yes (Verified)' : 'No'}
                </span>
              </div>
            </div>

            {/* Explanation Section */}
            {selectedRecord.explanation && (
              <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-2">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" /> Absence Explanation Details
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Reason:</span>
                  <span className="text-slate-200 font-semibold">{selectedRecord.explanation.reason}</span>
                </div>
                {selectedRecord.explanation.remarks && (
                  <div>
                    <span className="text-slate-400 block text-[11px]">Additional Remarks:</span>
                    <span className="text-slate-300">{selectedRecord.explanation.remarks}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-400 block text-[11px]">Explanation Status:</span>
                  <span className="font-bold text-amber-400">{selectedRecord.explanation.status}</span>
                </div>
                {selectedRecord.explanation.adminRemarks && (
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-amber-500/20 text-amber-200">
                    <span className="text-[10px] text-amber-400 font-bold block uppercase">Admin Note:</span>
                    {selectedRecord.explanation.adminRemarks}
                  </div>
                )}
              </div>
            )}

            {/* Leave Section */}
            {selectedRecord.leave && (
              <div className="p-4 rounded-2xl bg-blue-950/20 border border-blue-500/30 space-y-2">
                <div className="font-bold text-blue-300 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" /> Official Leave Coverage
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Leave Type:</span>
                  <span className="text-slate-200">{selectedRecord.leave.leaveType}</span>
                </div>
                {selectedRecord.leave.leaveNote && (
                  <div>
                    <span className="text-slate-400 block text-[11px]">Leave Note:</span>
                    <span className="text-slate-300">{selectedRecord.leave.leaveNote}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-700 text-slate-200 text-xs font-semibold hover:bg-slate-600"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
