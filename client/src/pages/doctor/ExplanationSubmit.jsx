import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { useNotification } from '../../context/NotificationContext';
import { ClipboardCheck, Upload, Send, Calendar, Clock, AlertTriangle, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export const ExplanationSubmit = () => {
  const todayStr = new Date().toISOString().split('T')[0];
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
        // Pre-select absent windows by default if available and not expired
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

  const toggleWindowSelection = (windowLabel) => {
    if (dateData?.isExpired) return;
    if (selectedWindows.includes(windowLabel)) {
      setSelectedWindows(selectedWindows.filter(w => w !== windowLabel));
    } else {
      setSelectedWindows([...selectedWindows, windowLabel]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (dateData?.isExpired) {
      addToast('Explanation deadline expired! Must be submitted within 3 days of missed shift.', 'danger');
      return;
    }

    if (selectedWindows.length === 0) {
      addToast('Please select at least one missed shift checkpoint hour below.', 'warning');
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
        addToast('Absence explanation submitted successfully! Awaiting Admin review.', 'success');
        navigate('/doctor');
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Error submitting explanation', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDeadlineDate = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' at 11:59 PM';
  };

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
            <p className="text-xs text-slate-400">Select shift date, choose missed checkpoint hours, and submit official justification (3-day deadline rule).</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Select Shift Date & 3-Day Deadline Indicator */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-5">
              <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-400" /> Select Duty Shift Date *
              </label>
              <input
                type="date"
                required
                max={todayStr}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-2xl text-xs text-white focus:border-blue-500 outline-none font-semibold"
              />
            </div>

            <div className="md:col-span-7">
              {dateData && (
                <div className={`p-3 rounded-2xl border text-xs flex items-center gap-2.5 ${
                  dateData.isExpired
                    ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                    : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                }`}>
                  {dateData.isExpired ? (
                    <ShieldAlert className="w-5 h-5 flex-shrink-0 text-rose-400" />
                  ) : (
                    <Clock className="w-5 h-5 flex-shrink-0 text-emerald-400" />
                  )}
                  <div>
                    <span className="font-bold block">
                      {dateData.isExpired ? '❌ Submission Deadline Expired' : '⏳ 3-Day Submission Deadline Window Active'}
                    </span>
                    <span className="text-[11px] opacity-90 block">
                      {dateData.isExpired
                        ? 'Explanations must be submitted within 3 calendar days of missed shift.'
                        : `Shift Date: ${selectedDate} ➔ Submission Deadline: ${formatDeadlineDate(dateData.deadlineDate)}`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Select Missed Checkpoint Hours Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" /> Select Missed Shift Checkpoint Hours for {selectedDate} *
              </label>
              <span className="text-[11px] text-slate-400">
                Selected: <strong className="text-amber-300">{selectedWindows.length} hour(s)</strong>
              </span>
            </div>

            {loadingWindows ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800">
                Loading assigned shift schedule for {selectedDate}...
              </div>
            ) : dateData?.windows?.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800">
                No active duty shift scheduled on {selectedDate}.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {dateData?.windows?.map((w) => {
                  const isPresent = w.status === 'PRESENT' || w.status === 'EXPLANATION_APPROVED';
                  const isSelected = selectedWindows.includes(w.windowLabel);
                  const isSelectable = w.isSelectable && !dateData.isExpired;

                  return (
                    <button
                      key={w.checkpointIndex}
                      type="button"
                      disabled={!isSelectable}
                      onClick={() => toggleWindowSelection(w.windowLabel)}
                      className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                        isPresent
                          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300 cursor-not-allowed opacity-80'
                          : isSelected
                          ? 'bg-amber-500/20 border-amber-500 text-white shadow-glow-amber'
                          : isSelectable
                          ? 'bg-slate-900/80 border-slate-700/80 text-slate-300 hover:border-slate-500'
                          : 'bg-slate-950 border-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-400">Hour #{w.checkpointIndex}</span>
                        {isPresent ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> PRESENT
                          </span>
                        ) : isSelected ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500 text-slate-950 flex items-center gap-1">
                            SELECTED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> ABSENT
                          </span>
                        )}
                      </div>

                      <div className="font-extrabold text-sm text-white">{w.windowLabel}</div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {isPresent ? 'Verified Present (No Action Required)' : isSelectable ? 'Click to select for explanation' : 'Deadline Expired'}
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
                disabled={dateData?.isExpired}
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
                disabled={dateData?.isExpired}
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
                  disabled={dateData?.isExpired}
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
