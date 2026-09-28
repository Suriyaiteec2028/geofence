import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { Modal } from '../../components/common/Modal';
import { useNotification } from '../../context/NotificationContext';
import { CalendarDays, CheckCircle2, XCircle, Clock, User, FileText, RefreshCw } from 'lucide-react';

export const LeaveApplications = () => {
  const [applications, setApplications] = useState([]);
  const [grantedLeaves, setGrantedLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('applications'); // 'applications' | 'granted'
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLeave, setEditingLeave] = useState(null);
  const [editNote, setEditNote] = useState('');
  const { addToast } = useNotification();

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [appRes, leaveRes] = await Promise.all([
        axios.get('/api/leaves/applications'),
        axios.get('/api/leaves')
      ]);
      if (appRes.data.success) setApplications(appRes.data.applications || []);
      if (leaveRes.data.success) setGrantedLeaves(leaveRes.data.leaves || []);
    } catch { addToast('Error loading leave data', 'danger'); }
    finally { setLoading(false); }
  };

  const handleOpenReview = (app) => {
    setSelectedApp(app);
    setAdminNote('');
    setShowModal(true);
  };

  const handleReview = async (action) => {
    if (!selectedApp) return;
    setProcessing(true);
    try {
      const res = await axios.patch(`/api/leaves/applications/${selectedApp._id}/review`, { action, adminNote });
      if (res.data.success) {
        addToast(res.data.message, action === 'APPROVE' ? 'success' : 'warning');
        setShowModal(false);
        fetchAll();
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Review failed', 'danger');
    } finally { setProcessing(false); }
  };

  const handleOpenEdit = (leave) => {
    setEditingLeave(leave);
    setEditNote(leave.leaveNote || '');
    setShowEditModal(true);
  };

  const handleEditLeave = async (action) => {
    if (!editingLeave) return;
    setProcessing(true);
    try {
      const res = await axios.patch(`/api/leaves/${editingLeave._id}/edit`, { action, leaveNote: editNote });
      if (res.data.success) {
        addToast(res.data.message, 'success');
        setShowEditModal(false);
        fetchAll();
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed', 'danger');
    } finally { setProcessing(false); }
  };

  const statusBadge = (status) => {
    const map = {
      PENDING: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      APPROVED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      REJECTED: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      ACTIVE: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      CANCELLED: 'bg-slate-500/20 text-slate-400 border-slate-600/30',
      REVOKED: 'bg-rose-500/20 text-rose-300 border-rose-500/30'
    };
    return `px-2.5 py-1 rounded-full text-[10px] font-bold border ${map[status] || map.PENDING}`;
  };

  const pendingCount = applications.filter(a => a.status === 'PENDING').length;
  const activeLeaveCount = grantedLeaves.filter(l => l.status === 'ACTIVE').length;

  return (
    <div className="space-y-6">
      <Breadcrumb />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Leave Management</h2>
          <p className="text-xs text-slate-400">Review doctor leave applications and manage approved leaves.</p>
        </div>
        <button onClick={fetchAll} className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-white transition-all">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-3">
        <button onClick={() => setActiveTab('applications')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
            activeTab === 'applications' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}>
          Leave Applications
          {pendingCount > 0 && <span className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-900 text-[10px] font-bold">{pendingCount}</span>}
        </button>
        <button onClick={() => setActiveTab('granted')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
            activeTab === 'granted' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}>
          Granted Leaves ({activeLeaveCount} active)
        </button>
      </div>

      {loading ? <LoadingSkeleton type="table" count={4} /> : (
        <>
          {/* Leave Applications Tab */}
          {activeTab === 'applications' && (
            <div className="space-y-3">
              {applications.length === 0 ? (
                <div className="p-8 rounded-3xl bg-[#1E293B] border border-slate-700/80 text-center text-xs text-slate-400">
                  No leave applications found.
                </div>
              ) : applications.map((app) => (
                <div key={app._id} className="p-5 rounded-2xl bg-[#1E293B] border border-slate-700/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{app.doctorName}</span>
                      <span className={statusBadge(app.status)}>{app.status}</span>
                    </div>
                    <p className="text-xs text-slate-400">{app.phcName} · {app.leaveType}</p>
                    <p className="text-xs text-slate-300">📅 {app.startDate === app.endDate ? app.startDate : `${app.startDate} → ${app.endDate}`}</p>
                    <p className="text-[11px] text-slate-400 truncate max-w-md">{app.reason}</p>
                    {app.adminNote && <p className="text-[11px] text-rose-300 italic">Admin note: {app.adminNote}</p>}
                    <p className="text-[10px] text-slate-500">Submitted: {new Date(app.submittedAt).toLocaleString('en-IN')}</p>
                  </div>
                  {app.status === 'PENDING' && (
                    <button onClick={() => handleOpenReview(app)}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex-shrink-0">
                      Review
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Granted Leaves Tab */}
          {activeTab === 'granted' && (
            <div className="space-y-3">
              {grantedLeaves.length === 0 ? (
                <div className="p-8 rounded-3xl bg-[#1E293B] border border-slate-700/80 text-center text-xs text-slate-400">
                  No granted leaves found.
                </div>
              ) : grantedLeaves.map((leave) => (
                <div key={leave._id} className="p-5 rounded-2xl bg-[#1E293B] border border-slate-700/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{leave.doctorName}</span>
                      <span className={statusBadge(leave.status)}>{leave.status}</span>
                    </div>
                    <p className="text-xs text-slate-400">{leave.phcName}</p>
                    <p className="text-xs text-slate-300">📅 {leave.startDate === leave.endDate ? leave.startDate : `${leave.startDate} → ${leave.endDate}`}</p>
                    {leave.leaveNote && <p className="text-[11px] text-slate-400">{leave.leaveNote}</p>}
                  </div>
                  {leave.status === 'ACTIVE' && (
                    <button onClick={() => handleOpenEdit(leave)}
                      className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold flex-shrink-0">
                      Manage
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Review Application Modal */}
      {showModal && selectedApp && (
        <Modal title={`Review Leave Application — ${selectedApp.doctorName}`} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs">
              <div><span className="text-slate-400">Doctor:</span> <span className="text-white font-semibold">{selectedApp.doctorName}</span></div>
              <div><span className="text-slate-400">Hospital:</span> <span className="text-slate-200">{selectedApp.phcName}</span></div>
              <div><span className="text-slate-400">Leave Type:</span> <span className="text-slate-200">{selectedApp.leaveType}</span></div>
              <div><span className="text-slate-400">Dates:</span> <span className="text-white font-semibold">{selectedApp.startDate === selectedApp.endDate ? selectedApp.startDate : `${selectedApp.startDate} → ${selectedApp.endDate}`}</span></div>
              <div><span className="text-slate-400">Reason:</span> <span className="text-slate-200">{selectedApp.reason}</span></div>
              {selectedApp.note && <div><span className="text-slate-400">Note:</span> <span className="text-slate-200">{selectedApp.note}</span></div>}
              {selectedApp.proofUrl && <div><a href={selectedApp.proofUrl} target="_blank" rel="noreferrer" className="text-blue-400 underline text-xs">View Supporting Document</a></div>}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Admin Note (shown to doctor)</label>
              <textarea rows={2} value={adminNote} onChange={e => setAdminNote(e.target.value)}
                placeholder="Optional note for doctor..."
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white" />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl bg-slate-700 text-slate-200 text-xs font-semibold">Cancel</button>
              <button onClick={() => handleReview('REJECT')} disabled={processing}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
                <XCircle className="w-4 h-4" /> Reject
              </button>
              <button onClick={() => handleReview('APPROVE')} disabled={processing}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
                <CheckCircle2 className="w-4 h-4" /> Approve Leave
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit/Revoke Leave Modal */}
      {showEditModal && editingLeave && (
        <Modal title={`Manage Leave — ${editingLeave.doctorName}`} onClose={() => setShowEditModal(false)}>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs">
              <div><span className="text-slate-400">Period:</span> <span className="text-white font-semibold">{editingLeave.startDate} → {editingLeave.endDate}</span></div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Leave Note</label>
              <textarea rows={2} value={editNote} onChange={e => setEditNote(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white" />
            </div>
            <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-xs text-rose-300">
              ⚠️ Revoking this leave will restore absence records for affected dates.
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2 rounded-xl bg-slate-700 text-slate-200 text-xs font-semibold">Cancel</button>
              <button onClick={() => handleEditLeave('UPDATE')} disabled={processing}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50">Update Note</button>
              <button onClick={() => { if (window.confirm('Revoke this leave? Absence records will be restored.')) handleEditLeave('REVOKE'); }}
                disabled={processing}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold disabled:opacity-50">Revoke Leave</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
