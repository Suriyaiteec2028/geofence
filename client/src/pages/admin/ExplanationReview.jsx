import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { Table } from '../../components/common/Table';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { useNotification } from '../../context/NotificationContext';
import { ClipboardCheck, CheckCircle2, XCircle, FileText, Image, User, Calendar, Clock, MessageSquare } from 'lucide-react';

export const ExplanationReview = () => {
  const [explanations, setExplanations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExp, setSelectedExp] = useState(null);
  const [adminRemarks, setAdminRemarks] = useState('');
  const [showModal, setShowModal] = useState(false);

  const { addToast } = useNotification();

  useEffect(() => {
    fetchExplanations();
  }, []);

  const fetchExplanations = async () => {
    try {
      const res = await axios.get('/api/explanations/pending');
      if (res.data.success) {
        setExplanations(res.data.explanations);
      }
    } catch (err) {
      addToast('Error loading explanation requests', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReview = (exp) => {
    setSelectedExp(exp);
    setAdminRemarks('');
    setShowModal(true);
  };

  const handleReviewAction = async (action) => {
    if (!selectedExp) return;
    try {
      const res = await axios.patch(`/api/explanations/${selectedExp._id}/review`, {
        action,
        adminRemarks
      });
      if (res.data.success) {
        addToast(res.data.message, action === 'APPROVE' ? 'success' : 'warning');
        setShowModal(false);
        fetchExplanations();
      }
    } catch (err) {
      addToast('Review submission failed', 'danger');
    }
  };

  const columns = [
    {
      header: 'Doctor Name',
      key: 'doctorName',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
            <User className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-white text-xs">{row.doctorName}</div>
            <div className="text-[10px] text-slate-400">{row.doctorSpecialization}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Checkpoint Date & Time',
      key: 'date',
      render: (row) => (
        <div className="text-xs space-y-0.5">
          <div className="text-slate-200 flex items-center gap-1"><Calendar className="w-3 h-3 text-blue-400" /> {row.date}</div>
          <div className="text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3 text-slate-500" /> {row.checkpointTime || row.windowLabel}</div>
        </div>
      )
    },
    {
      header: 'Submitted Reason',
      key: 'reason',
      render: (row) => (
        <div className="max-w-xs">
          <p className="text-xs font-semibold text-slate-200 line-clamp-1">{row.reason}</p>
          <p className="text-[10px] text-slate-400 line-clamp-1">{row.remarks || 'No additional remarks'}</p>
        </div>
      )
    },
    {
      header: 'Proof File',
      key: 'proofUrl',
      render: (row) => row.proofUrl ? (
        <a
          href={row.proofUrl}
          target="_blank"
          rel="noreferrer"
          className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1 w-fit hover:underline"
        >
          <Image className="w-3 h-3" /> View Proof Document
        </a>
      ) : (
        <span className="text-[11px] text-slate-500 italic">No proof attached</span>
      )
    },
    {
      header: 'Review Status',
      key: 'status',
      render: (row) => (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
          row.status === 'APPROVED'
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            : row.status === 'REJECTED'
            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
        }`}>
          {row.status}
        </span>
      )
    },
    {
      header: 'Action',
      key: 'actions',
      render: (row) => row.status === 'PENDING' ? (
        <button
          onClick={() => handleOpenReview(row)}
          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1 shadow-glow-blue"
        >
          <ClipboardCheck className="w-3.5 h-3.5" /> Review Request
        </button>
      ) : (
        <span className="text-[11px] text-slate-500">Reviewed</span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb />

      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Absence Explanation Review Console</h2>
        <p className="text-xs text-slate-400">Review doctor absence justifications and supporting proof documents.</p>
      </div>

      {loading ? (
        <LoadingSkeleton type="table" count={4} />
      ) : (
        <Table
          columns={columns}
          data={explanations}
          searchPlaceholder="Search doctor or reason..."
          statusOptions={[
            { label: 'Pending Approval', value: 'PENDING' },
            { label: 'Approved', value: 'APPROVED' },
            { label: 'Rejected', value: 'REJECTED' }
          ]}
        />
      )}

      {/* Review Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={`Review Request: ${selectedExp?.doctorName}`}
      >
        {selectedExp && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
              <div>
                <span className="text-slate-400">Absence Reason:</span>
                <p className="font-semibold text-white mt-0.5">{selectedExp.reason}</p>
              </div>
              {selectedExp.remarks && (
                <div>
                  <span className="text-slate-400">Doctor Remarks:</span>
                  <p className="text-slate-300 mt-0.5">{selectedExp.remarks}</p>
                </div>
              )}
              {selectedExp.proofUrl && (
                <div className="pt-2">
                  <a
                    href={selectedExp.proofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <Image className="w-4 h-4" /> Open Attached Supporting Document
                  </a>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Admin Review Remarks (Optional)
              </label>
              <textarea
                rows={3}
                value={adminRemarks}
                onChange={(e) => setAdminRemarks(e.target.value)}
                placeholder="Enter remarks for approval or rejection..."
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleReviewAction('REJECT')}
                className="px-4 py-2.5 rounded-xl bg-rose-600/20 text-rose-300 hover:bg-rose-600/30 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5"
              >
                <XCircle className="w-4 h-4" /> Reject Request
              </button>
              <button
                type="button"
                onClick={() => handleReviewAction('APPROVE')}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg"
              >
                <CheckCircle2 className="w-4 h-4" /> Approve (Update to Present)
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
