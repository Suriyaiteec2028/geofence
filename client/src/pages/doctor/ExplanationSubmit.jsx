import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { 
  ClipboardCheck, Upload, Send, Calendar, Clock, AlertTriangle, 
  CheckCircle2, XCircle, ShieldAlert, Check, User, FileText, Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const EXPLANATION_REASONS = [
  'Medical Emergency',
  'Personal Emergency',
  'Network Connectivity Issue',
  'GPS or Location Issue',
  'Official Duty',
  'Transportation Issue',
  'Other'
];

export const ExplanationSubmit = () => {
  const { user } = useAuth();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Calculate 3-day minimum date
  const minDateObj = new Date(now);
  minDateObj.setDate(now.getDate() - 3);
  const minDateStr = minDateObj.toISOString().split('T')[0];

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [dateData, setDateData] = useState(null);
  const [loadingWindows, setLoadingWindows] = useState(true);
  const [selectedWindows, setSelectedWindows] = useState([]);
  
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [effectiveMinDate, setEffectiveMinDate] = useState(minDateStr);
  const [onLeaveMessage, setOnLeaveMessage] = useState('');
  const [myExplanations, setMyExplanations] = useState([]);
  const [loadingExplanations, setLoadingExplanations] = useState(true);

  const { addToast } = useNotification();
  const navigate = useNavigate();

  // Strictly formatted as 12:00 AM on the 3rd calendar day after missed date
  const getDeadlineText = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const temp = new Date(Date.UTC(y, m - 1, d + 3, 0, 0, 0, 0));
    const day = String(temp.getUTCDate()).padStart(2, '0');
    const month = temp.toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' });
    const year = temp.getUTCFullYear();
    return `${day} ${month} ${year}, 12:00 AM`;
  };

  useEffect(() => {
    fetchDateWindows(selectedDate);
    fetchMyExplanations();
  }, [selectedDate]);

  const fetchMyExplanations = async () => {
    setLoadingExplanations(true);
    try {
      const res = await axios.get('/api/explanations/my');
      if (res.data.success) {
        setMyExplanations(res.data.explanations || []);
      }
    } catch {
      setMyExplanations([]);
    } finally {
      setLoadingExplanations(false);
    }
  };

  const fetchDateWindows = async (dateStr) => {
    setLoadingWindows(true);
    setSelectedWindows([]);
    try {
      const res = await axios.get(`/api/attendance/doctor-date-windows?date=${dateStr}`);
      if (res.data.success) {
        const data = res.data;
        setDateData(data);
        
        if (data.doctorActiveDate && data.doctorActiveDate > minDateStr) {
          setEffectiveMinDate(data.doctorActiveDate);
        }

        if (data.isOnLeave) {
          setOnLeaveMessage(`This date is covered by Official Leave. ${data.leaveNote ? 'Note: ' + data.leaveNote : ''}`); 
        } else {
          setOnLeaveMessage('');
        }

        // Pre-select past missing windows that are selectable within the 3-day window
        if (!data.isExpired && data.windows) {
          const selectable = data.windows
            .filter(w => w.isSelectable)
            .map(w => w.windowLabel);
          setSelectedWindows(selectable);
        }
      }
    } catch {
      addToast('Failed to load shift schedule for selected date', 'danger');
    } finally {
      setLoadingWindows(false);
    }
  };

  const toggleWindowSelection = (w) => {
    if (!w.isSelectable || dateData?.isExpired) {
      if (w.isOpenWindow) {
        addToast('Active open window cannot be selected here. Please mark present on Mark Attendance.', 'warning');
      } else if (w.isFutureWindow) {
        addToast('Future shift windows cannot be selected for absence explanation.', 'warning');
      } else if (dateData?.isExpired) {
        addToast('This date is older than 3 days. Explanations can no longer be submitted.', 'danger');
      }
      return;
    }

    if (selectedWindows.includes(w.windowLabel)) {
      setSelectedWindows(selectedWindows.filter(item => item !== w.windowLabel));
    } else {
      setSelectedWindows([...selectedWindows, w.windowLabel]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (dateData?.isExpired) {
      addToast('Your explanation submission deadline has expired. Explanations for this attendance date can no longer be submitted.', 'danger');
      return;
    }

    if (selectedWindows.length === 0) {
      addToast('Please select at least one eligible missed attendance window.', 'warning');
      return;
    }

    const finalReason = reason === 'Other' ? customReason.trim() : reason;
    if (!finalReason) {
      addToast('Please select or specify the reason for absence.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('date', selectedDate);
      formData.append('selectedCheckpoints', JSON.stringify(selectedWindows));
      formData.append('reason', finalReason);
      formData.append('remarks', remarks);
      if (proofFile) formData.append('proofFile', proofFile);

      const res = await axios.post('/api/explanations/submit', formData);
      if (res.data.success) {
        addToast('Absence explanation submitted successfully! Pending Admin review.', 'success');
        setReason('');
        setCustomReason('');
        setRemarks('');
        setProofFile(null);
        fetchDateWindows(selectedDate);
        fetchMyExplanations();
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Error submitting explanation', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  // Filter windows to display past missed / pending / reviewed windows
  const pastMissingWindows = dateData?.windows?.filter(w => 
    w.isPastWindow && 
    w.status !== 'PRESENT' && 
    w.status !== 'EXPLANATION_APPROVED' && 
    w.status !== 'PRESENT_APPROVED_EXPLANATION' &&
    w.status !== 'NOT_APPLICABLE'
  ) || [];

  const currentDeadline = dateData?.explanationDeadlineFormatted || getDeadlineText(selectedDate);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Breadcrumb />

      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-[#1E293B] border border-slate-700/80 shadow-2xl space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-700/80 pb-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Duty Absence Explanation Management</h2>
            <p className="text-xs text-slate-400">
              Submit explanations for missed duty windows within the strict 3-day deadline ({formatDateDisplay(minDateStr)} to {formatDateDisplay(todayStr)}).
            </p>
          </div>
        </div>

        {/* Date Selector & 3-Day Rule Status */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5">
            <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-400" /> Select Attendance Date *
            </label>
            <input
              type="date"
              required
              min={effectiveMinDate}
              max={todayStr}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-2xl text-xs text-white focus:border-blue-500 outline-none font-semibold"
            />
            {onLeaveMessage && (
              <div className="mt-3 bg-blue-900/40 border border-blue-700/30 rounded-lg p-3 text-sm text-blue-300">
                <Calendar className="w-4 h-4 inline mr-2" />
                {onLeaveMessage}
              </div>
            )}
          </div>

          <div className="md:col-span-7">
            <div className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2.5 ${
              dateData?.isExpired
                ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
            }`}>
              {dateData?.isExpired ? (
                <ShieldAlert className="w-5 h-5 flex-shrink-0 text-rose-400" />
              ) : (
                <Clock className="w-5 h-5 flex-shrink-0 text-amber-400" />
              )}
              <div>
                <span className="font-bold block">
                  {dateData?.isExpired ? '❌ 3-Day Submission Period Expired' : '⏳ Strict 3-Day Rule Active'}
                </span>
                <span className="text-[11px] opacity-90 block">
                  {dateData?.isExpired
                    ? 'Your explanation submission deadline has expired. Explanations for this attendance date can no longer be submitted.'
                    : `Submission Deadline: ${currentDeadline}`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 4.1: Eligible Missed Attendance Windows Table (All 7 Required Fields) ── */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" /> Eligible Missed Attendance Windows
            </h3>
            <span className="text-[11px] text-slate-400">
              Selected: <strong className="text-amber-300">{selectedWindows.length} window(s)</strong>
            </span>
          </div>

          {loadingWindows ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800">
              Loading attendance windows for {formatDateDisplay(selectedDate)}...
            </div>
          ) : dateData?.isExpired ? (
            <div className="p-6 text-center text-xs text-rose-300 bg-rose-950/30 rounded-2xl border border-rose-800/40">
              ⚠️ Explanations can only be submitted within 3 days. Deadline for {formatDateDisplay(selectedDate)} expired at {currentDeadline}.
            </div>
          ) : pastMissingWindows.length === 0 ? (
            <div className="p-6 text-center text-xs text-emerald-300 bg-emerald-950/20 rounded-2xl border border-emerald-500/30 space-y-1">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
              <p className="font-bold">No Missed Windows Found for {formatDateDisplay(selectedDate)}</p>
              <p className="text-[11px] text-slate-400">All windows are marked PRESENT or approved. No explanation required.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-700/80 bg-slate-900/60">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/80 text-[11px] text-slate-400 font-semibold border-b border-slate-700">
                  <tr>
                    <th className="p-3">Select</th>
                    <th className="p-3">1. Date</th>
                    <th className="p-3">2. Duty Window</th>
                    <th className="p-3">3. Status</th>
                    <th className="p-3">4. Missed Time</th>
                    <th className="p-3">5. Deadline</th>
                    <th className="p-3">6. Explanation Status</th>
                    <th className="p-3">7. Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {pastMissingWindows.map((w) => {
                    const isPending = w.status === 'PENDING_EXPLANATION';
                    const isSelected = selectedWindows.includes(w.windowLabel);
                    const isSelectable = w.isSelectable && !dateData?.isExpired;
                    const linkedExp = myExplanations.find(e => 
                      e.date === selectedDate && 
                      (e.windowLabel === w.windowLabel || e.checkpointTime === w.windowStartFormatted)
                    );
                    const expStatus = linkedExp ? linkedExp.status : (isPending ? 'PENDING' : 'NOT_SUBMITTED');

                    return (
                      <tr 
                        key={w.checkpointIndex}
                        className={`transition-colors ${
                          isSelected ? 'bg-amber-500/10' : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            disabled={!isSelectable}
                            checked={isSelected}
                            onChange={() => toggleWindowSelection(w)}
                            className="rounded border-slate-700 text-amber-500 focus:ring-0 focus:outline-none cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-semibold text-white whitespace-nowrap">
                          {formatDateDisplay(selectedDate)}
                        </td>
                        <td className="p-3 font-mono text-slate-200 whitespace-nowrap">
                          {w.windowLabel}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Absent
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-400 whitespace-nowrap">
                          {w.windowEndFormatted || 'Window Closed'}
                        </td>
                        <td className="p-3 text-[11px] text-amber-300 whitespace-nowrap">
                          {currentDeadline}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {expStatus === 'APPROVED' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Approved
                            </span>
                          ) : expStatus === 'REJECTED' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              Rejected
                            </span>
                          ) : expStatus === 'PENDING' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Pending Review
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-700/40 text-slate-400">
                              Not Submitted
                            </span>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {isSelectable ? (
                            <button
                              type="button"
                              onClick={() => toggleWindowSelection(w)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                                isSelected 
                                  ? 'bg-amber-500 text-slate-950 font-bold' 
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                              }`}
                            >
                              {isSelected ? 'Selected' : 'Select'}
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">
                              {dateData?.isExpired ? 'Expired' : 'Submitted'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── SECTION 4.2: Comprehensive Submission Form ── */}
        <form onSubmit={handleSubmit} className="space-y-5 pt-4 border-t border-slate-700/80">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <FileText className="w-4 h-4 text-blue-400" /> Explanation Submission Form
          </div>

          {/* Read-Only Doctor & Window Metadata Block */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px]">Doctor ID / Name:</span>
              <p className="font-semibold text-white mt-0.5 truncate">
                {user?.name || 'Doctor'} ({user?.id || user?._id || 'doc'})
              </p>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Attendance Date:</span>
              <p className="font-semibold text-white mt-0.5">{formatDateDisplay(selectedDate)}</p>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Selected Window(s):</span>
              <p className="font-semibold text-amber-300 mt-0.5 truncate">
                {selectedWindows.length > 0 ? selectedWindows.join(', ') : 'None selected'}
              </p>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Submission Deadline:</span>
              <p className="font-semibold text-amber-300 mt-0.5">{currentDeadline}</p>
            </div>
          </div>

          {/* Selectable Reason Dropdown (The 7 Exact Prompt Categories) */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                Reason for Absence *
              </label>
              <select
                required
                disabled={dateData?.isExpired || pastMissingWindows.length === 0}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900/80 border border-slate-700 rounded-2xl text-xs text-white focus:border-blue-500 outline-none disabled:opacity-50"
              >
                <option value="">Select reason from categories...</option>
                {EXPLANATION_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Custom Reason Input if "Other" is Selected */}
            {reason === 'Other' && (
              <div>
                <label className="text-xs font-bold text-amber-300 block mb-1">
                  Specify Custom Reason *
                </label>
                <input
                  type="text"
                  required
                  disabled={dateData?.isExpired || pastMissingWindows.length === 0}
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Please describe your specific absence reason..."
                  className="w-full px-4 py-2.5 bg-slate-900/80 border border-amber-500/40 rounded-xl text-xs text-white placeholder-slate-500 focus:border-amber-500 outline-none disabled:opacity-50"
                />
              </div>
            )}

            {/* Additional Remarks */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                Additional Remarks / Clinical Context (Optional)
              </label>
              <textarea
                rows={2}
                disabled={dateData?.isExpired || pastMissingWindows.length === 0}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Attending emergency trauma stabilization in Ward B, patient referral..."
                className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none disabled:opacity-50"
              />
            </div>

            {/* Proof Document Upload */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                Attach Supporting Document / Proof (Optional)
              </label>
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-dashed border-slate-700 text-center space-y-2">
                <Upload className="w-6 h-6 text-blue-400 mx-auto" />
                <input
                  type="file"
                  disabled={dateData?.isExpired || pastMissingWindows.length === 0}
                  accept="image/*,.pdf"
                  onChange={(e) => setProofFile(e.target.files[0])}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:bg-blue-600/20 file:text-blue-300 hover:file:bg-blue-600/30 disabled:opacity-50"
                />
                <p className="text-[10px] text-slate-500">Supports JPG, PNG, WEBP, and PDF files up to 10MB</p>
              </div>
            </div>
          </div>

          {/* Form Controls */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-700/80">
            <button
              type="button"
              onClick={() => navigate('/doctor')}
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || dateData?.isExpired || selectedWindows.length === 0 || !!onLeaveMessage}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-glow-blue transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" /> {submitting ? 'Submitting Explanation...' : 'Submit Explanation to Admin'}
            </button>
          </div>
        </form>
      </div>

      {/* ── SECTION 4.3: My Submitted Explanations & Admin Review Status ── */}
      <div className="p-6 rounded-3xl bg-[#1E293B] border border-slate-700/80 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-blue-400" /> My Submitted Explanations & Admin Review Status
        </h3>

        {loadingExplanations ? (
          <div className="text-center py-6 text-xs text-slate-400">Loading explanations...</div>
        ) : myExplanations.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500">No explanations submitted yet.</div>
        ) : (
          <div className="space-y-3">
            {myExplanations.map((exp, idx) => {
              const isApproved = exp.status === 'APPROVED';
              const isRejected = exp.status === 'REJECTED';
              return (
                <div key={exp._id || idx} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">📅 {exp.date}</span>
                      <span className="text-xs text-slate-400 font-mono">({exp.windowLabel || exp.checkpointTime})</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      isApproved
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : isRejected
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}>
                      {isApproved ? 'Approved — Present' : isRejected ? 'Rejected — Absent' : 'Pending Admin Approval'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-300">
                    <strong className="text-slate-400">Reason:</strong> {exp.reason}
                    {exp.remarks && <span className="ml-2 text-slate-400">({exp.remarks})</span>}
                  </div>

                  {/* Prominent Admin Rejection Note when status is Rejected */}
                  {isRejected && exp.adminRemarks && (
                    <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200">
                      <strong className="text-rose-400 block mb-0.5">Admin Rejection Note:</strong>
                      {exp.adminRemarks}
                    </div>
                  )}

                  {/* Regular Admin Remarks if Approved */}
                  {isApproved && exp.adminRemarks && (
                    <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-300">
                      <strong>Admin Note:</strong> {exp.adminRemarks}
                    </div>
                  )}

                  <div className="text-[10px] text-slate-500">
                    Submitted: {new Date(exp.createdAt).toLocaleString('en-IN')}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
