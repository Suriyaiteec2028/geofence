import React, { useState } from 'react';
import axios from 'axios';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { useNotification } from '../../context/NotificationContext';
import { ClipboardCheck, Upload, Send, FileText, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ExplanationSubmit = () => {
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const { addToast } = useNotification();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      addToast('Please enter the reason for absence.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('reason', reason);
      formData.append('remarks', remarks);
      if (proofFile) formData.append('proofFile', proofFile);

      const res = await axios.post('/api/explanations/submit', formData);
      if (res.data.success) {
        addToast('Absence explanation submitted successfully! Awaiting Admin review.', 'success');
        navigate('/doctor/history');
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Error submitting explanation', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Breadcrumb />

      <div className="p-6 rounded-3xl bg-[#1E293B] border border-slate-700/80 shadow-2xl space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-700/80 pb-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Submit Absence Explanation</h2>
            <p className="text-xs text-slate-400">Provide official justification for missed shift checkpoint windows.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Reason for Absence / Window Miss *
            </label>
            <textarea
              rows={4}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Detailed reason (e.g. Called for emergency VIP ward surgery, trauma stabilization, OPD overflow...)"
              className="w-full px-4 py-3 bg-slate-900/80 border border-slate-700 rounded-2xl text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Additional Remarks (Optional)
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Ward B OT Consultation Room 4"
              className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-xs text-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Attach Supporting Proof (Document or Image)
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

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => navigate('/doctor')}
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-glow-blue transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" /> {submitting ? 'Submitting...' : 'Submit Explanation to Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
