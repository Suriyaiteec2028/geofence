import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { useNotification } from '../../context/NotificationContext';
import { Cpu, FileText, Download, Sparkles, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

export const CMOReports = () => {
  const [aiData, setAiData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useNotification();

  useEffect(() => {
    fetchAI();
  }, []);

  const fetchAI = async () => {
    try {
      const res = await axios.get('/api/ai/analytics');
      if (res.data.success) {
        setAiData(res.data.aiSummary);
      }
    } catch (err) {
      addToast('Error fetching AI analytics', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      addToast('Preparing PDF export...', 'info');
      const response = await axios.get('/api/reports/export-pdf', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `CMO_Official_Attendance_Report_${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      addToast('PDF Report downloaded successfully!', 'success');
    } catch (err) {
      addToast('PDF download failed.', 'danger');
    }
  };

  if (loading) return <LoadingSkeleton type="card" count={3} />;

  return (
    <div className="space-y-6">
      <Breadcrumb />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-purple-400 uppercase tracking-wider">
            <Cpu className="w-4 h-4" /> AI Governance Engine
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">AI Compliance & Executive Reports</h2>
        </div>
        <button
          onClick={handleDownloadPDF}
          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg transition-all"
        >
          <Download className="w-4 h-4" /> Download Official PDF Report
        </button>
      </div>

      {/* AI Score Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-950/80 via-slate-900 to-slate-950 border border-purple-500/30 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-purple-600/30 border border-purple-400/40 flex items-center justify-center text-purple-300 font-extrabold text-2xl shadow-glow-blue">
            {aiData?.overallScore}%
          </div>
          <div>
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              System AI Governance Score <Sparkles className="w-4 h-4 text-purple-400" />
            </h3>
            <p className="text-xs text-slate-400">Calculated based on shift checkpoint punctuality, geofence compliance, and explanation turnaround.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-300">Risk Assessment Level:</span>
          <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${
            aiData?.riskLevel === 'LOW' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
          }`}>
            {aiData?.riskLevel || 'LOW'} RISK
          </span>
        </div>
      </div>

      {/* AI Recommendations Cards */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-200">Intelligent Insights & Governance Action Items</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {aiData?.recommendations?.map((rec) => (
            <motion.div
              key={rec.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-2xl bg-[#1E293B] border border-slate-700/80 shadow-lg space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-purple-400 uppercase tracking-wider">{rec.category}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  rec.severity === 'HIGH' ? 'bg-rose-500/20 text-rose-300' : rec.severity === 'MEDIUM' ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'
                }`}>
                  {rec.severity}
                </span>
              </div>
              <h4 className="font-bold text-xs text-white leading-snug">{rec.title}</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">{rec.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
