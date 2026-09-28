import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { useNotification } from '../../context/NotificationContext';
import { CalendarDays, Upload, Send, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LEAVE_TYPES = ['Casual Leave', 'Medical Leave', 'Emergency Leave', 'Personal Leave', 'Official Duty Leave'];

export const DoctorLeaveApply = () => {
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [leaveType, setLeaveType] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [applications, setApplications] = useState([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const { addToast } = useNotification();
  const navigate = useNavigate();

  useEffect(() => {
    fetchMyApplications();
  }, []);

  const fetchMyApplications = async () => {
    try {
      const res = await axios.get('/api/leaves/my-applications');
      if (res.data.success) setApplications(res.data.applications || []);
    } catch { setApplications([]); }
    finally { setLoadingApps(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!leaveType) { addToast('Please select a leave type.', 'warning'); return; }
    if (!reason.trim()) { addToast('Reason for leave is required.', 'warning'); return; }
    if (startDate > endDate) { addToast('Start date must be before or equal to end date.', 'warning'); return; }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('startDate', startDate);
      formData.append('endDate', endDate);
      formData.append('leaveType', leaveType);
      formData.append('reason', reason);
      formData.append('note', note);
      if (proofFile) formData.append('proofFile', proofFile);
      const res = await axios.post('/api/leaves/apply', formData);
      if (res.data.success) {
        addToast('Leave application submitted. Pending Admin approval.', 'success');
        setStartDate(today); setEndDate(today); setLeaveType(''); setReason(''); setNote(''); setProofFile(null);
        fetchMyApplications();
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Error submitting leave application.', 'danger');
    } finally { setSubmitting(false); }
  };

  const statusBadge = (status) => {
    const map = {
      PENDING: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      APPROVED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      REJECTED: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      REVOKED: 'bg-slate-500/20 text-slate-300 border-slate-600/30'
    };
    return `px-2.5 py-1 rounded-full text-[10px] font-bold border ${map[status] || map.PENDING}`;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Breadcrumb />

      {/* Application Form */}
      <div className="p-6 rounded-3xl bg-[#1E293B] border border-slate-700/80 shadow-2xl space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-700/80 pb-4">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Apply for Leave</h2>
            <p className="text-xs text-slate-400">Submit a leave application for Admin approval. Approved leaves exclude you from attendance requirements.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Start Date *</label>
              <input type="date" required value={startDate} min={today}
                onChange={e => { setStartDate(e.target.value); if (e.target.value > endDate) setEndDate(e.target.value); }}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-2xl text-xs text-white focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">End Date *</label>
              <input type="date" required value={endDate} min={startDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-2xl text-xs text-white focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Leave Type *</label>
              <select required value={leaveType} onChange={e => setLeaveType(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-2xl text-xs text-white focus:border-blue-500 outline-none">
                <option value="">Select leave type...</option>
                {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">Reason for Leave *</label>
            <textarea rows={3} required value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Explain the reason for your leave request..."
              className="w-full px-4 py-3 bg-slate-900/80 border border-slate-700 rounded-2xl text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none" />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">Additional Note (Optional)</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="Any additional details..."
              className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-xs text-white" />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">Supporting Document (Optional)</label>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-dashed border-slate-700 text-center space-y-2">
              <Upload className="w-6 h-6 text-blue-400 mx-auto" />
              <input type="file" accept="image/*,.pdf" onChange={e => setProofFile(e.target.files[0])}
                className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:bg-blue-600/20 file:text-blue-300 hover:file:bg-blue-600/30" />
              <p className="text-[10px] text-slate-500">Medical certificate, official letter, etc.</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-700/80">
            <button type="button" onClick={() => navigate('/doctor')}
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700">Cancel</button>
            <button type="submit" disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50">
              <Send className="w-4 h-4" /> {submitting ? 'Submitting...' : 'Submit Leave Application'}
            </button>
          </div>
        </form>
      </div>

      {/* My Leave Applications History */}
      <div className="p-6 rounded-3xl bg-[#1E293B] border border-slate-700/80 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" /> My Leave Applications
        </h3>
        {loadingApps ? (
          <div className="text-center py-6 text-xs text-slate-400">Loading applications...</div>
        ) : applications.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500">No leave applications submitted yet.</div>
        ) : (
          <div className="space-y-3">
            {applications.map((app, idx) => (
              <div key={app._id || idx} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white">{app.startDate === app.endDate ? app.startDate : `${app.startDate} → ${app.endDate}`}</span>
                    <span className="ml-2 text-[11px] text-slate-400">{app.leaveType}</span>
                  </div>
                  <span className={statusBadge(app.status)}>{app.status}</span>
                </div>
                <p className="text-[11px] text-slate-300">{app.reason}</p>
                {app.adminNote && <p className="text-[11px] text-rose-300 italic">Admin: {app.adminNote}</p>}
                <p className="text-[10px] text-slate-500">Submitted: {new Date(app.submittedAt).toLocaleString('en-IN')}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
