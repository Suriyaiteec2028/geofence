import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { Table } from '../../components/common/Table';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { useNotification } from '../../context/NotificationContext';
import { ClipboardCheck, CheckCircle2, XCircle, Image, User, Calendar, Clock, Filter, RotateCcw, Building2 } from 'lucide-react';

export const ExplanationReview = () => {
  const [explanations, setExplanations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExp, setSelectedExp] = useState(null);
  const [adminRemarks, setAdminRemarks] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filters (Section 6: doctor, PHC, date range, status)
  const [selectedDoctor, setSelectedDoctor] = useState('ALL');
  const [selectedPHC, setSelectedPHC] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { addToast } = useNotification();

  useEffect(() => {
    fetchExplanations();
  }, []);

  const fetchExplanations = async () => {
    try {
      const res = await axios.get('/api/explanations/pending');
      if (res.data.success) {
        setExplanations(res.data.explanations || []);
      }
    } catch {
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

    if (action === 'REJECT' && (!adminRemarks || !adminRemarks.trim())) {
      addToast('Rejection reason is mandatory when rejecting an explanation.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.patch(`/api/explanations/${selectedExp._id}/review`, {
        action,
        adminRemarks: adminRemarks.trim()
      });
      if (res.data.success) {
        addToast(res.data.message, action === 'APPROVE' ? 'success' : 'warning');
        setShowModal(false);
        fetchExplanations();
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Review submission failed', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const uniqueDoctors = useMemo(() => {
    return Array.from(new Set(explanations.map(e => e.doctorName).filter(Boolean))).sort();
  }, [explanations]);

  const uniquePHCs = useMemo(() => {
    return Array.from(new Set(explanations.map(e => e.phcName).filter(Boolean))).sort();
  }, [explanations]);

  const filteredData = useMemo(() => {
    return explanations.filter(item => {
      if (selectedDoctor !== 'ALL' && item.doctorName !== selectedDoctor) return false;
      if (selectedPHC !== 'ALL' && item.phcName !== selectedPHC) return false;
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'APPROVED' && item.status !== 'APPROVED' && item.status !== 'PRESENT_APPROVED_EXPLANATION') return false;
        if (selectedStatus === 'REJECTED' && item.status !== 'REJECTED' && item.status !== 'EXPLANATION_REJECTED') return false;
        if (selectedStatus === 'PENDING' && item.status !== 'PENDING') return false;
      }
      if (startDate && item.date < startDate) return false;
      if (endDate && item.date > endDate) return false;
      return true;
    });
  }, [explanations, selectedDoctor, selectedPHC, selectedStatus, startDate, endDate]);

  const handleResetFilters = () => {
    setSelectedDoctor('ALL');
    setSelectedPHC('ALL');
    setSelectedStatus('ALL');
    setStartDate('');
    setEndDate('');
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
            <div className="text-[10px] text-slate-400">{row.doctorSpecialization || 'Medical Officer'}</div>
            <div className="text-[10px] text-blue-400">{row.phcName}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Checkpoint Date & Window',
      key: 'date',
      render: (row) => (
        <div className="text-xs space-y-0.5">
          <div className="text-slate-200 flex items-center gap-1 font-semibold">
            <Calendar className="w-3 h-3 text-blue-400" /> {row.date}
          </div>
          <div className="text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500" /> {row.windowLabel || row.checkpointTime}
          </div>
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
          {row.adminRemarks && (
            <p className="text-[10px] text-rose-300 italic mt-0.5">Admin: {row.adminRemarks}</p>
          )}
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
      render: (row) => {
        const isApproved = row.status === 'APPROVED' || row.status === 'PRESENT_APPROVED_EXPLANATION';
        const isRejected = row.status === 'REJECTED' || row.status === 'EXPLANATION_REJECTED';
        return (
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit ${
            isApproved
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : isRejected
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
          }`}>
            {isApproved ? (
              <><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Approved (Present)</>
            ) : isRejected ? (
              <><XCircle className="w-3 h-3 text-rose-400" /> Rejected (Absent)</>
            ) : (
              <><Clock className="w-3 h-3 text-amber-400" /> Pending Review</>
            )}
          </span>
        );
      }
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

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Absence Explanation Review Console</h2>
          <p className="text-xs text-slate-400">Review doctor absence justifications and supporting proof documents.</p>
        </div>
      </div>

      {/* Filter Toolbar (Doctor, PHC, Status, Date Range) */}
      <div className="p-4 rounded-2xl bg-[#1E293B] border border-slate-700/80 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-blue-400" /> Filter Explanations
          </span>
          {(selectedDoctor !== 'ALL' || selectedPHC !== 'ALL' || selectedStatus !== 'ALL' || startDate || endDate) && (
            <button
              onClick={handleResetFilters}
              className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          {/* Doctor Filter */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Doctor</label>
            <select
              value={selectedDoctor}
              onChange={(e) => setSelectedDoctor(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 outline-none focus:border-blue-500"
            >
              <option value="ALL">All Doctors</option>
              {uniqueDoctors.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* PHC Filter */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">PHC Hospital</label>
            <select
              value={selectedPHC}
              onChange={(e) => setSelectedPHC(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 outline-none focus:border-blue-500"
            >
              <option value="ALL">All PHCs</option>
              {uniquePHCs.map(phc => (
                <option key={phc} value={phc}>{phc}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 outline-none focus:border-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Review</option>
              <option value="APPROVED">Approved (Present)</option>
              <option value="REJECTED">Rejected (Absent)</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 outline-none focus:border-blue-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="text-[11px] text-slate-400 block mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton type="table" count={4} />
      ) : (
        <Table
          columns={columns}
          data={filteredData}
          searchPlaceholder="Search doctor or reason..."
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
              <div className="grid grid-cols-2 gap-2 pb-2 border-b border-slate-800">
                <div>
                  <span className="text-slate-400">Doctor:</span>
                  <p className="font-semibold text-white">{selectedExp.doctorName}</p>
                </div>
                <div>
                  <span className="text-slate-400">Hospital:</span>
                  <p className="font-semibold text-white">{selectedExp.phcName}</p>
                </div>
                <div>
                  <span className="text-slate-400">Duty Date:</span>
                  <p className="font-semibold text-white">{selectedExp.date}</p>
                </div>
                <div>
                  <span className="text-slate-400">Window:</span>
                  <p className="font-semibold text-white">{selectedExp.windowLabel || selectedExp.checkpointTime}</p>
                </div>
              </div>

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
                Admin Review Remarks <span className="text-rose-400 font-normal">*(Mandatory for Rejection)</span>
              </label>
              <textarea
                rows={3}
                value={adminRemarks}
                onChange={(e) => setAdminRemarks(e.target.value)}
                placeholder="Enter justification or reason for rejection/approval..."
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:border-blue-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleReviewAction('REJECT')}
                className="px-4 py-2.5 rounded-xl bg-rose-600/20 text-rose-300 hover:bg-rose-600/30 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" /> Reject Request
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleReviewAction('APPROVE')}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg disabled:opacity-50"
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
