import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { 
  ClipboardCheck, Upload, Send, Calendar, Clock, AlertTriangle, 
  CheckCircle2, XCircle, ShieldAlert, Check, User, FileText, Info,
  RefreshCw, Eye
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
  const [windows, setWindows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // Selected window for explanation submission
  const [selectedWindow, setSelectedWindow] = useState(null);
  
  // Explanation form states
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Details modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);

  // My submitted explanations
  const [myExplanations, setMyExplanations] = useState([]);
  const [loadingExplanations, setLoadingExplanations] = useState(true);

  // Optional date filter
  const [dateFilter, setDateFilter] = useState('');

  const { addToast } = useNotification();
  const navigate = useNavigate();
  const formRef = useRef(null);

  const fetchEligibleWindows = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await axios.get('/api/explanations/eligible-windows');
      if (res.data.success) {
        setWindows(res.data.windows || []);
      } else {
        setErrorMsg(res.data.message || 'Unable to fetch eligible missed windows.');
      }
    } catch (err) {
      console.error('Fetch eligible windows error:', err);
      setErrorMsg(err.response?.data?.message || 'Unable to connect to attendance server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    fetchEligibleWindows();
    fetchMyExplanations();
  }, []);

  const handleSelectWindowForSubmission = (w) => {
    setSelectedWindow(w);
    setReason('');
    setCustomReason('');
    setRemarks('');
    setProofFile(null);
    // Smooth scroll to submission form
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleOpenDetails = (item) => {
    setDetailItem(item);
    setDetailModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedWindow) {
      addToast('Please select an eligible missed attendance window first.', 'warning');
      return;
    }

    if (selectedWindow.isExpired) {
      addToast('Your explanation submission deadline has expired. Explanations for this attendance date can no longer be submitted.', 'danger');
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
      formData.append('date', selectedWindow.attendanceDate);
      formData.append('selectedCheckpoints', JSON.stringify([selectedWindow.dutyWindow || selectedWindow.windowLabel]));
      formData.append('reason', finalReason);
      formData.append('remarks', remarks);
      if (proofFile) formData.append('proofFile', proofFile);

      const res = await axios.post('/api/explanations/submit', formData);
      if (res.data.success) {
        addToast('Absence explanation submitted successfully! Pending Admin review.', 'success');
        setSelectedWindow(null);
        setReason('');
        setCustomReason('');
        setRemarks('');
        setProofFile(null);
        fetchEligibleWindows();
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
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const renderAttendanceBadge = (status) => {
    if (status.includes('Pending')) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 w-fit">
          <Clock className="w-3 h-3 text-amber-400" /> Absent — Explanation Pending
        </span>
      );
    }
    if (status.includes('Present')) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 w-fit">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Present — Approved Explanation
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1 w-fit">
        <XCircle className="w-3 h-3 text-rose-400" /> Absent
      </span>
    );
  };

  const renderExplanationBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            Approved
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            Rejected
          </span>
        );
      case 'PENDING':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            Pending
          </span>
        );
      case 'NOT_SUBMITTED':
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-700/40 text-slate-400 border border-slate-700">
            Not Submitted
          </span>
        );
    }
  };

  // Filter windows if dateFilter is set
  const displayedWindows = dateFilter 
    ? windows.filter(w => w.attendanceDate === dateFilter)
    : windows;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Breadcrumb />

      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-[#1E293B] border border-slate-700/80 shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Duty Absence Explanation Management</h2>
              <p className="text-xs text-slate-400">
                Review missed duty windows and submit explanations before the strict 3-day deadline.
              </p>
            </div>
          </div>

          <button
            onClick={() => { fetchEligibleWindows(); fetchMyExplanations(); }}
            className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-all flex items-center gap-2 text-xs font-semibold self-start md:self-auto"
            title="Refresh Records"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* SECTION 1: Error State with Retry Button */}
        {errorMsg && (
          <div className="p-6 rounded-2xl bg-rose-950/30 border border-rose-500/40 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
            <h3 className="text-sm font-bold text-white">Error Loading Absence Records</h3>
            <p className="text-xs text-rose-300">{errorMsg}</p>
            <button
              onClick={fetchEligibleWindows}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2 mx-auto transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        )}

        {/* Date Filter Bar */}
        {!errorMsg && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span className="font-semibold text-slate-300">Filter by Date:</span>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:border-blue-500 outline-none"
              />
              {dateFilter && (
                <button
                  onClick={() => setDateFilter('')}
                  className="px-2 py-1 rounded-lg bg-slate-700 text-slate-300 text-[10px] hover:text-white"
                >
                  Clear Filter
                </button>
              )}
            </div>

            <span className="text-[11px] text-slate-400">
              Showing <strong>{displayedWindows.length}</strong> missed window(s)
            </span>
          </div>
        )}

        {/* SECTION 1: Eligible Missed Attendance Windows Table */}
        {!errorMsg && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" /> Missed Duty Attendance Windows
              </h3>
              {selectedWindow && (
                <span className="text-xs text-amber-300 font-semibold">
                  Selected: {selectedWindow.attendanceDate} ({selectedWindow.dutyWindow})
                </span>
              )}
            </div>

            {loading ? (
              <LoadingSkeleton type="table" count={4} />
            ) : displayedWindows.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="font-bold text-white text-sm">No eligible missed attendance windows found.</p>
                <p className="text-slate-400">
                  You have no pending or unsubmitted absences within the 3-day explanation window.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-700/80 bg-slate-900/60">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/80 text-[11px] text-slate-400 font-semibold border-b border-slate-700">
                    <tr>
                      <th className="p-3 whitespace-nowrap">Attendance Date</th>
                      <th className="p-3 whitespace-nowrap">Duty Window</th>
                      <th className="p-3 whitespace-nowrap">Attendance Status</th>
                      <th className="p-3 whitespace-nowrap">Explanation Deadline</th>
                      <th className="p-3 whitespace-nowrap">Explanation Status</th>
                      <th className="p-3 whitespace-nowrap text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {displayedWindows.map((w, idx) => {
                      const isSelected = selectedWindow && selectedWindow.attendanceDate === w.attendanceDate && selectedWindow.dutyWindow === w.dutyWindow;
                      const hasSubmitted = w.explanationStatus !== 'NOT_SUBMITTED';

                      return (
                        <tr
                          key={w.attendanceId || idx}
                          className={`transition-colors ${
                            isSelected ? 'bg-amber-500/10' : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="p-3 font-semibold text-white whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-blue-400" />
                              {formatDateDisplay(w.attendanceDate)}
                            </div>
                          </td>
                          <td className="p-3 font-mono text-slate-200 whitespace-nowrap">
                            {w.dutyWindow}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {renderAttendanceBadge(w.attendanceStatus)}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={`text-[11px] font-semibold ${
                              w.isExpired ? 'text-rose-400' : 'text-amber-300'
                            }`}>
                              {w.explanationDeadline}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {renderExplanationBadge(w.explanationStatus)}
                          </td>
                          <td className="p-3 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                              {w.isEligible && (
                                <button
                                  type="button"
                                  onClick={() => handleSelectWindowForSubmission(w)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                    isSelected
                                      ? 'bg-amber-500 text-slate-950 font-bold shadow-glow-amber'
                                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                                  }`}
                                >
                                  {isSelected ? 'Selected' : 'Submit Explanation'}
                                </button>
                              )}

                              {hasSubmitted && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenDetails(w)}
                                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 border border-slate-700 hover:text-white"
                                >
                                  <Eye className="w-3.5 h-3.5 text-blue-400" /> View Details
                                </button>
                              )}

                              {!w.isEligible && !hasSubmitted && (
                                <span className="text-[11px] text-slate-500 italic">
                                  {w.isExpired ? 'Expired' : 'Not Eligible'}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SECTION 1 & 2: Explanation Submission Form */}
        <div ref={formRef}>
          {selectedWindow ? (
            <form onSubmit={handleSubmit} className="space-y-5 pt-4 border-t border-slate-700/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <FileText className="w-4 h-4 text-blue-400" /> Submit Absence Explanation
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedWindow(null)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Clear Selection
                </button>
              </div>

              {/* Read-Only Doctor & Window Metadata Block */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Doctor:</span>
                  <p className="font-semibold text-white mt-0.5 truncate">
                    {user?.name || 'Doctor'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Attendance Date:</span>
                  <p className="font-semibold text-white mt-0.5">{formatDateDisplay(selectedWindow.attendanceDate)}</p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Duty Window:</span>
                  <p className="font-semibold text-amber-300 mt-0.5">{selectedWindow.dutyWindow}</p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Explanation Deadline:</span>
                  <p className="font-semibold text-amber-300 mt-0.5">{selectedWindow.explanationDeadline}</p>
                </div>
              </div>

              {/* Reason Dropdown (The 7 Exact Prompt Categories) */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">
                    Reason for Absence *
                  </label>
                  <select
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900/80 border border-slate-700 rounded-2xl text-xs text-white focus:border-blue-500 outline-none"
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
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="Please describe your specific absence reason..."
                      className="w-full px-4 py-2.5 bg-slate-900/80 border border-amber-500/40 rounded-xl text-xs text-white placeholder-slate-500 focus:border-amber-500 outline-none"
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
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="e.g. Attending emergency trauma stabilization in Ward B, patient referral..."
                    className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
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
                      accept="image/*,.pdf"
                      onChange={(e) => setProofFile(e.target.files[0])}
                      className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:bg-blue-600/20 file:text-blue-300 hover:file:bg-blue-600/30"
                    />
                    <p className="text-[10px] text-slate-500">Supports JPG, PNG, WEBP, and PDF files up to 10MB</p>
                  </div>
                </div>
              </div>

              {/* Form Controls */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setSelectedWindow(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || selectedWindow.isExpired}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-glow-blue transition-all disabled:opacity-50"
                >
                  <Send className="w-4 h-4" /> {submitting ? 'Submitting Explanation...' : 'Submit Explanation to Admin'}
                </button>
              </div>
            </form>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400 text-center">
              💡 Select an eligible window from the table above to submit an absence explanation.
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: My Submitted Explanations & Admin Review Status */}
      <div className="p-6 rounded-3xl bg-[#1E293B] border border-slate-700/80 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-blue-400" /> My Submitted Explanations & Review History
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
                <div key={exp._id || idx} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2.5">
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

                  {/* Section 2 Step 5: Prominent Admin Rejection Note */}
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

                  <div className="text-[10px] text-slate-500 flex justify-between items-center pt-1 border-t border-slate-800">
                    <span>Submitted: {new Date(exp.createdAt).toLocaleString('en-IN')}</span>
                    {exp.reviewedAt && <span>Reviewed: {new Date(exp.reviewedAt).toLocaleString('en-IN')}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Details Modal */}
      {detailModalOpen && detailItem && (
        <Modal
          title={`Explanation Details — ${detailItem.attendanceDate} (${detailItem.dutyWindow})`}
          onClose={() => setDetailModalOpen(false)}
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2.5">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-slate-400">Attendance Status:</span>
                <div>{renderAttendanceBadge(detailItem.attendanceStatus)}</div>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Attendance Date:</span>
                <span className="text-white font-semibold">{formatDateDisplay(detailItem.attendanceDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Duty Window:</span>
                <span className="text-slate-200 font-mono">{detailItem.dutyWindow}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Explanation Deadline:</span>
                <span className="text-amber-300 font-semibold">{detailItem.explanationDeadline}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Explanation Status:</span>
                <div>{renderExplanationBadge(detailItem.explanationStatus)}</div>
              </div>
            </div>

            {/* Explanation Details */}
            {detailItem.explanation && (
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-400" /> Submitted Reason
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Reason:</span>
                  <span className="text-white font-semibold">{detailItem.explanation.reason}</span>
                </div>
                {detailItem.explanation.remarks && (
                  <div>
                    <span className="text-slate-400 block text-[11px]">Remarks:</span>
                    <span className="text-slate-300">{detailItem.explanation.remarks}</span>
                  </div>
                )}
                {detailItem.explanation.adminRemarks && (
                  <div className={`p-3 rounded-xl border text-xs ${
                    detailItem.explanation.status === 'REJECTED'
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                      : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                  }`}>
                    <span className="font-bold block mb-0.5">Admin Note:</span>
                    {detailItem.explanation.adminRemarks}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDetailModalOpen(false)}
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
