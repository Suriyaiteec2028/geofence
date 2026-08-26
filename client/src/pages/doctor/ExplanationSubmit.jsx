import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { useNotification } from '../../context/NotificationContext';
import { ClipboardCheck, Upload, Send, Calendar, Clock, AlertTriangle, CheckCircle2, XCircle, ShieldAlert, Lock, Radio, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export const ExplanationSubmit = () => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Calculate 3-day minimum date (e.g. today 26/08/2026 -> minDate 23/08/2026)
  const minDateObj = new Date(now);
  minDateObj.setDate(now.getDate() - 3);
  const minDateStr = minDateObj.toISOString().split('T')[0];

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [dateData, setDateData] = useState(null);
  const [loadingWindows, setLoadingWindows] = useState(true);
  const [selectedWindows, setSelectedWindows] = useState([]);
  
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const { addToast } = useNotification();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDateWindows(selectedDate);
  }, [selectedDate]);

  const fetchDateWindows = async (dateStr) => {
    setLoadingWindows(true);
    setSelectedWindows([]);
    try {
      const res = await axios.get(`/api/attendance/doctor-date-windows?date=${dateStr}`);
      if (res.data.success) {
        setDateData(res.data);
        // Pre-select ONLY past missing windows that are selectable within the 3-day window
        if (!res.data.isExpired && res.data.windows) {
          const selectable = res.data.windows
            .filter(w => w.isSelectable)
            .map(w => w.windowLabel);
          setSelectedWindows(selectable);
        }
      }
    } catch (err) {
      addToast('Failed to load shift schedule for selected date', 'danger');
    } finally {
      setLoadingWindows(false);
    }
  };

  const toggleWindowSelection = (w) => {
    if (!w.isSelectable || dateData?.isExpired) {
      if (w.isOpenWindow) {
        addToast('Active open window cannot be selected here. Please mark present on the main Doctor Dashboard.', 'warning');
      } else if (w.isFutureWindow) {
        addToast('Future shift windows cannot be selected for absence explanation.', 'warning');
      } else if (dateData?.isExpired) {
        addToast('This date is older than 3 days. Missing attendance remains permanently ABSENT.', 'danger');
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
      addToast('Explanation deadline expired! Explanations must be submitted within 3 days of missed shift.', 'danger');
      return;
    }

    if (selectedWindows.length === 0) {
      addToast('Please select at least one past missed shift checkpoint hour below.', 'warning');
      return;
    }

    if (!reason.trim()) {
      addToast('Please enter the reason for absence.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('date', selectedDate);
      formData.append('selectedCheckpoints', JSON.stringify(selectedWindows));
      formData.append('reason', reason);
      formData.append('remarks', remarks);
      if (proofFile) formData.append('proofFile', proofFile);

      const res = await axios.post('/api/explanations/submit', formData);
      if (res.data.success) {
        addToast('Absence explanation submitted successfully! Status set to PENDING until Admin review.', 'success');
        navigate('/doctor');
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

  // Filter windows to display ONLY past missing/absent windows (Not future, not active open, not already present)
  const pastMissingWindows = dateData?.windows?.filter(w => w.isPastWindow && w.status !== 'PRESENT' && w.status !== 'EXPLANATION_APPROVED') || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Breadcrumb />

      <div className="p-6 rounded-3xl bg-[#1E293B] border border-slate-700/80 shadow-2xl space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-700/80 pb-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Submit Duty Absence Explanation</h2>
            <p className="text-xs text-slate-400">Select shift date from last 3 days ({formatDateDisplay(minDateStr)} to {formatDateDisplay(todayStr)}), select past missed windows, and submit justification.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Select Shift Date (Restricted to Last 3 Days) & 3-Day Rule Indicator */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-5">
              <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-400" /> Select Duty Shift Date *
              </label>
              <input
                type="date"
                required
                min={minDateStr}
                max={todayStr}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-2xl text-xs text-white focus:border-blue-500 outline-none font-semibold"
              />
            </div>

            <div className="md:col-span-7">
              <div className={`p-3 rounded-2xl border text-xs flex items-center gap-2.5 ${
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
                    {dateData?.isExpired ? '❌ 3-Day Submission Period Expired' : '⏳ 3-Day Submission Rule Active'}
                  </span>
                  <span className="text-[11px] opacity-90 block">
                    {dateData?.isExpired
                      ? `Selected date is older than 3 days. Absence remains PERMANENT and cannot be converted to present.`
                      : `Allowed Range: ${formatDateDisplay(minDateStr)} to ${formatDateDisplay(todayStr)}. Submitting converts ABSENT ➔ PENDING ➔ PRESENT (on Admin approval).`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Past Missing Absent Windows Grid (Future and Active Open Windows Excluded) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" /> Select Past Missed Shift Windows for {formatDateDisplay(selectedDate)} *
              </label>
              <span className="text-[11px] text-slate-400">
                Selected: <strong className="text-amber-300">{selectedWindows.length} past hour(s)</strong>
              </span>
            </div>

            {loadingWindows ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800">
                Loading assigned shift schedule for {formatDateDisplay(selectedDate)}...
              </div>
            ) : dateData?.isExpired ? (
              <div className="p-6 text-center text-xs text-rose-300 bg-rose-950/30 rounded-2xl border border-rose-800/40">
                ⚠️ Explanations can only be submitted for duty dates within the last 3 days ({formatDateDisplay(minDateStr)} to {formatDateDisplay(todayStr)}).
              </div>
            ) : pastMissingWindows.length === 0 ? (
              <div className="p-6 text-center text-xs text-emerald-300 bg-emerald-950/20 rounded-2xl border border-emerald-500/30 space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                <p className="font-bold">No Past Missed Windows Found for {formatDateDisplay(selectedDate)}</p>
                <p className="text-[11px] text-slate-400">All completed shift windows were marked PRESENT or approved. No explanation required!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {pastMissingWindows.map((w) => {
                  const isPending = w.status === 'PENDING_EXPLANATION';
                  const isSelected = selectedWindows.includes(w.windowLabel);
                  const isSelectable = w.isSelectable && !dateData.isExpired;

                  return (
                    <button
                      key={w.checkpointIndex}
                      type="button"
                      disabled={!isSelectable}
                      onClick={() => toggleWindowSelection(w)}
                      className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                        isPending
                          ? 'bg-amber-950/30 border-amber-500/40 text-amber-300 cursor-not-allowed opacity-90'
                          : isSelected
                          ? 'bg-amber-500/20 border-amber-500 text-white shadow-glow-amber'
                          : isSelectable
                          ? 'bg-slate-900/80 border-slate-700/80 text-slate-300 hover:border-slate-500 cursor-pointer'
                          : 'bg-slate-950 border-slate-800/80 text-slate-500 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-400">Hour #{w.checkpointIndex}</span>
                        {isPending ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            PENDING REVIEW
                          </span>
                        ) : isSelected ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500 text-slate-950 flex items-center gap-1 font-mono">
                            SELECTED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> MISSED ABSENT
                          </span>
                        )}
                      </div>

                      <div className="font-extrabold text-sm text-white">{w.windowLabel}</div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {isPending
                          ? 'Submitted - Awaiting Admin Review'
                          : isSelectable
                          ? 'Click to select past missed hour'
                          : 'Deadline Expired'}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 3: Enter Reason & Attach Proof */}
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                Reason for Absence / Window Miss *
              </label>
              <textarea
                rows={3}
                required
                disabled={dateData?.isExpired || pastMissingWindows.length === 0}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Detailed reason (e.g. Attending emergency trauma stabilization in Ward B, VIP consultation, OPD overflow...)"
                className="w-full px-4 py-3 bg-slate-900/80 border border-slate-700 rounded-2xl text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                Additional Remarks (Optional)
              </label>
              <input
                type="text"
                disabled={dateData?.isExpired || pastMissingWindows.length === 0}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Emergency OT Room 3, Consultation Record #491"
                className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-xs text-white disabled:opacity-50"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                Attach Supporting Proof (Optional Image or Document)
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
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700/80">
            <button
              type="button"
              onClick={() => navigate('/doctor')}
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || dateData?.isExpired || selectedWindows.length === 0}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-glow-blue transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" /> {submitting ? 'Submitting Explanation...' : 'Submit Explanation to Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
