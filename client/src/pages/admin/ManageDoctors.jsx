import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { Table } from '../../components/common/Table';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { FaceScannerModal } from '../../components/biometrics/FaceScannerModal';
import { OTPVerificationModal } from '../../components/common/OTPVerificationModal';
import { UserAvatar } from '../../components/common/UserAvatar';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { 
  UserPlus, Search, Edit3, Trash2, Mail, ShieldAlert, CheckCircle2, Clock, 
  Building2, Camera, Eye, EyeOff, Lock, Send, FileSpreadsheet, KeyRound, AlertTriangle, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const formatTime12h = (timeStr) => {
  if (!timeStr) return '';
  if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
  const parts = timeStr.split(':');
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) || 0;
  if (isNaN(h)) return timeStr;
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  const padH = h < 10 ? `0${h}` : `${h}`;
  const padM = m < 10 ? `0${m}` : `${m}`;
  return `${padH}:${padM} ${period}`;
};

export const ManageDoctors = () => {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [phcs, setPhcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // OTP Verification Modal State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [savingWithOtp, setSavingWithOtp] = useState(false);

  // Notice Modal State
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticeTarget, setNoticeTarget] = useState(null);
  const [noticeSubject, setNoticeSubject] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [sendingNotice, setSendingNotice] = useState(false);

  // Leave Modal State
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState(null);
  const [leaveStartDate, setLeaveStartDate] = useState('');
  const [leaveEndDate, setLeaveEndDate] = useState('');
  const [leaveNote, setLeaveNote] = useState('');
  const [leaveEvidence, setLeaveEvidence] = useState(null);
  const [grantingLeave, setGrantingLeave] = useState(false);
  const [doctorLeaves, setDoctorLeaves] = useState([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);

  const { addToast } = useNotification();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    gender: 'Male',
    mobile: '',
    qualification: 'MBBS, MD',
    specialization: 'General Physician',
    assignedPHC: '',
    shiftStart: '11:15',
    shiftEnd: '16:15',
    faceData: '',
    biometricRequired: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [docRes, phcRes] = await Promise.all([
        axios.get('/api/doctors'),
        axios.get('/api/phcs')
      ]);
      if (docRes.data.success) setDoctors(docRes.data.doctors);
      if (phcRes.data.success) setPhcs(phcRes.data.phcs);
    } catch (err) {
      addToast('Failed to load doctors list', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingDoc(null);
    const defaultPhc = user?.assignedPHC || (phcs.length > 0 ? phcs[0]._id : '');
    setFormData({
      name: '',
      email: '',
      username: '',
      password: '',
      gender: 'Male',
      mobile: '',
      qualification: 'MBBS, MD',
      specialization: 'General Physician',
      assignedPHC: defaultPhc,
      shiftStart: '11:15',
      shiftEnd: '16:15',
      faceData: '',
      biometricRequired: true
    });
    setShowModal(true);
  };

  const handleOpenEdit = (doc) => {
    setEditingDoc(doc);
    setFormData({
      name: doc.name || '',
      email: doc.email || '',
      username: doc.username || '',
      password: '',
      gender: doc.gender || 'Male',
      mobile: doc.mobile || '',
      qualification: doc.qualification || 'MBBS, MD',
      specialization: doc.specialization || 'General Physician',
      assignedPHC: doc.assignedPHC || (phcs.length > 0 ? phcs[0]._id : ''),
      shiftStart: doc.shiftStart || '11:15',
      shiftEnd: doc.shiftEnd || '16:15',
      faceData: doc.faceData || '',
      biometricRequired: doc.biometricRequired !== false
    });
    setShowModal(true);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();

    if (!editingDoc) {
      // New Doctor Registration - No OTP required
      try {
        const res = await axios.post('/api/doctors', formData);
        if (res.data.success) {
          addToast(res.data.message || 'Doctor account created successfully', 'success');
          setShowModal(false);
          fetchData();
        }
      } catch (err) {
        addToast(err.response?.data?.message || 'Error saving doctor details', 'danger');
      }
      return;
    }

    // Subsequent Edit: Check if Email, Password, OR Face Recognition is changed
    const isEmailChanged = formData.email.trim().toLowerCase() !== editingDoc.email.toLowerCase();
    const isPasswordChanged = formData.password && formData.password.trim() !== '';
    const isFaceChanged = formData.faceData && formData.faceData !== editingDoc.faceData;

    if (isEmailChanged || isPasswordChanged || isFaceChanged) {
      // Trigger OTP to Doctor's existing registered email inbox
      setSendingOtp(true);
      addToast(`Sending 6-digit security OTP to Dr. ${editingDoc.name}'s email (${editingDoc.email})...`, 'info');
      try {
        const res = await axios.post(`/api/doctors/${editingDoc._id}/request-otp`);
        if (res.data.success) {
          addToast(`OTP Code sent live to ${editingDoc.email}. Please enter OTP to authorize changes.`, 'success', 'OTP Sent');
          setShowOtpModal(true);
        }
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to send OTP code to existing doctor email', 'danger');
      } finally {
        setSendingOtp(false);
      }
    } else {
      // Non-sensitive details edit - No OTP required
      saveDoctorUpdates({});
    }
  };

  const saveDoctorUpdates = async (extraPayload = {}) => {
    setSavingWithOtp(true);
    try {
      const res = await axios.put(`/api/doctors/${editingDoc._id}`, {
        ...formData,
        ...extraPayload
      });
      if (res.data.success) {
        addToast(res.data.message || 'Doctor details updated successfully', 'success');
        setShowOtpModal(false);
        setShowModal(false);
        fetchData();
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Error updating doctor details', 'danger');
    } finally {
      setSavingWithOtp(false);
    }
  };

  const handleResendOTP = async () => {
    if (!editingDoc) return;
    const res = await axios.post(`/api/doctors/${editingDoc._id}/request-otp`);
    if (res.data.success) {
      addToast(`New OTP verification code sent live to ${editingDoc.email}`, 'success', 'OTP Resent');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove Dr. ${name}? This action will revoke doctor shift access.`)) return;
    try {
      const res = await axios.delete(`/api/doctors/${id}`);
      if (res.data.success) {
        addToast(res.data.message || 'Doctor removed', 'success');
        fetchData();
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Error removing doctor', 'danger');
    }
  };

  const handleOpenNoticeModal = (doc) => {
    setNoticeTarget(doc);
    setNoticeSubject(`Official Directorate Notice regarding Shift Schedule - Dr. ${doc.name}`);
    setNoticeMessage(`Dear Dr. ${doc.name},\n\nPlease be reminded of your mandatory duty shift window (${formatTime12h(doc.shiftStart)} - ${formatTime12h(doc.shiftEnd)}). Ensure you complete 60-minute geofence check-ins.\n\nRegards,\nHospital Administration`);
    setShowNoticeModal(true);
  };

  const handleSendCustomNotice = async (e) => {
    e.preventDefault();
    if (!noticeTarget || !noticeMessage) return;

    setSendingNotice(true);
    try {
      const res = await axios.post('/api/doctors/send-notice', {
        recipientEmail: noticeTarget.email,
        recipientName: noticeTarget.name,
        subject: noticeSubject,
        messageText: noticeMessage
      });

      if (res.data.success) {
        addToast(res.data.message || 'Official notice sent to doctor inbox', 'success', 'Email Delivered');
        setShowNoticeModal(false);
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to send notice email', 'danger');
    } finally {
      setSendingNotice(false);
    }
  };

  const handleOpenLeaveModal = async (doctor) => {
    setLeaveTarget(doctor);
    setLeaveStartDate('');
    setLeaveEndDate('');
    setLeaveNote('');
    setLeaveEvidence(null);
    setShowLeaveModal(true);
    setLoadingLeaves(true);
    try {
      const res = await axios.get(`/api/leaves/doctor/${doctor._id}`);
      setDoctorLeaves(res.data.leaves || []);
    } catch (err) {
      setDoctorLeaves([]);
    }
    setLoadingLeaves(false);
  };

  const handleGrantLeave = async () => {
    if (!leaveStartDate || !leaveEndDate) {
      addToast('Please select start and end dates', 'warning');
      return;
    }
    if (leaveStartDate > leaveEndDate) {
      addToast('Start date must be before or equal to end date', 'warning');
      return;
    }
    setGrantingLeave(true);
    try {
      const formPayload = new FormData();
      formPayload.append('doctorId', leaveTarget._id);
      formPayload.append('startDate', leaveStartDate);
      formPayload.append('endDate', leaveEndDate);
      formPayload.append('leaveNote', leaveNote);
      if (leaveEvidence) formPayload.append('evidenceFile', leaveEvidence);
      await axios.post('/api/leaves', formPayload);
      addToast('Official leave granted successfully', 'success', 'Leave Granted');
      
      const res = await axios.get(`/api/leaves/doctor/${leaveTarget._id}`);
      setDoctorLeaves(res.data.leaves || []);
      setLeaveStartDate('');
      setLeaveEndDate('');
      setLeaveNote('');
      setLeaveEvidence(null);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to grant leave', 'danger');
    }
    setGrantingLeave(false);
  };

  const handleCancelLeave = async (leaveId) => {
    if (!window.confirm('Cancel this official leave?')) return;
    try {
      await axios.patch(`/api/leaves/${leaveId}/cancel`);
      addToast('Leave cancelled', 'info');
      const res = await axios.get(`/api/leaves/doctor/${leaveTarget._id}`);
      setDoctorLeaves(res.data.leaves || []);
    } catch (err) {
      addToast('Failed to cancel leave', 'danger');
    }
  };

  const columns = [
    {
      header: 'Doctor Name & Profile',
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-3">
          <UserAvatar name={row.name} gender={row.gender || 'Male'} size="md" />
          <div>
            <div className="font-bold text-white text-xs flex items-center gap-1.5">
              {row.name}
              {row.status === 'ACTIVE' ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400" title="Active Account" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-slate-500" title="Inactive Account" />
              )}
            </div>
            <div className="text-[11px] text-slate-400 font-medium">{row.qualification || 'MBBS'} • {row.specialization || 'General Physician'}</div>
            {row.mobile && <div className="text-[10px] text-slate-500">{row.mobile}</div>}
          </div>
        </div>
      )
    },
    {
      header: 'Login Credentials',
      accessor: 'username',
      render: (row) => (
        <div className="space-y-0.5 text-xs">
          <div className="text-slate-300 flex items-center gap-1">
            <Mail className="w-3 h-3 text-sky-400" /> {row.email}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Username: <span className="text-slate-200">{row.username || row.email}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Assigned PHC Hospital',
      accessor: 'assignedPHC',
      render: (row) => {
        const phc = row.phcDetails || phcs.find(p => String(p._id) === String(row.assignedPHC));
        return (
          <div className="space-y-0.5 text-xs">
            <div className="font-bold text-slate-200 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-purple-400" />
              {phc ? phc.name : 'Unassigned'}
            </div>
            {phc && <div className="text-[11px] text-slate-400">{phc.district || phc.address}</div>}
          </div>
        );
      }
    },
    {
      header: 'Duty Shift Schedule',
      accessor: 'shiftStart',
      render: (row) => (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-amber-300 font-semibold font-mono">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          {formatTime12h(row.shiftStart)} - {formatTime12h(row.shiftEnd)}
        </div>
      )
    },
    {
      header: 'Biometric Status',
      accessor: 'faceData',
      render: (row) => {
        const hasEmbeddings = row.faceAuthentication && Array.isArray(row.faceAuthentication.embeddings) && row.faceAuthentication.embeddings.length > 0;
        const isEnrolled = hasEmbeddings || (row.faceData && row.faceData.length > 10);
        return (
          <div className="flex items-center gap-1.5 text-xs">
            {isEnrolled ? (
              <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold flex items-center gap-1">
                <Camera className="w-3.5 h-3.5" /> Enrolled
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Pending Scan
              </span>
            )}
          </div>
        );
      }
    },
    {
      header: 'Biometric Required',
      accessor: 'biometricRequired',
      render: (row) => (
        <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={row.biometricRequired !== false}
            onChange={async (e) => {
              const newValue = e.target.checked;
              try {
                await axios.put(`/api/doctors/${row._id}`, { biometricRequired: newValue });
                addToast(`Biometric authentication ${newValue ? 'enabled' : 'disabled'} for Dr. ${row.name}`, 'success');
                fetchData();
              } catch (err) {
                addToast('Failed to update biometric requirement', 'danger');
              }
            }}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
        </label>
      )
    },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleOpenNoticeModal(row)}
            className="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 transition-all"
            title="Send Direct Official Email Notice"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleOpenLeaveModal(row)}
            className="p-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 transition-all"
            title="Manage Official Leave"
          >
            <Calendar className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleOpenEdit(row)}
            className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 transition-all"
            title="Edit Doctor Profile"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDelete(row._id, row.name)}
            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all"
            title="Remove Doctor Account"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb />

      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-purple-950/50 border border-purple-500/20 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Manage Hospital Medical Officers</h2>
          <p className="text-xs text-slate-400 mt-1">
            Register doctors, configure shift timing windows, and manage biometric face recognition profiles.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-all shadow-glow-purple flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" /> Register New Doctor
          </button>
        </div>
      </div>

      {/* Main Doctors Data Table */}
      {loading ? (
        <LoadingSkeleton type="table" count={5} />
      ) : (
        <Table columns={columns} data={doctors} searchPlaceholder="Search by name, email, or specialization..." />
      )}

      {/* Webcam Biometric Face Enrollment Modal */}
      <FaceScannerModal
        isOpen={showFaceModal}
        onClose={() => setShowFaceModal(false)}
        onCapture={(scannedData) => {
          setFormData({ ...formData, faceData: JSON.stringify(scannedData) });
          addToast('Biometric face landmark matrix enrolled for doctor profile.', 'success');
          setShowFaceModal(false);
        }}
        title="Biometric Doctor Face Enrollment"
        subtitle="Align doctor's face in frame to enroll webcam biometric profile"
      />

      {/* Universal Foreground OTP Verification Modal (Stacking z-[100]) */}
      <OTPVerificationModal
        isOpen={showOtpModal}
        onClose={() => setShowOtpModal(false)}
        email={editingDoc?.email}
        title="Security OTP Verification Required"
        subtitle={`Sent live to Dr. ${editingDoc?.name}'s email (${editingDoc?.email})`}
        onVerify={(otpCode) => saveDoctorUpdates({ otp: otpCode })}
        onResend={handleResendOTP}
        loading={savingWithOtp}
      />

      {/* Official Notice Email Modal */}
      <Modal
        isOpen={showNoticeModal}
        onClose={() => setShowNoticeModal(false)}
        title={`Send Notice Email - Dr. ${noticeTarget?.name}`}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSendCustomNotice} className="space-y-4">
          <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-500/30 text-xs text-sky-200">
            Send an official notice email directly to <strong className="text-white">{noticeTarget?.email}</strong>.
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Email Subject Line</label>
            <input
              type="text"
              required
              value={noticeSubject}
              onChange={(e) => setNoticeSubject(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Message Content</label>
            <textarea
              required
              rows={5}
              value={noticeMessage}
              onChange={(e) => setNoticeMessage(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowNoticeModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sendingNotice}
              className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-glow-blue disabled:opacity-50 flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {sendingNotice ? 'Delivering Email...' : 'Send Notice Email'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Official Leave Modal */}
      <Modal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        title={`Manage Official Leave - Dr. ${leaveTarget?.name}`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-6">
          <div className="p-3 rounded-xl bg-orange-950/40 border border-orange-500/30 text-xs text-orange-200">
            Grant and manage official leaves for <strong className="text-white">{leaveTarget?.name}</strong>.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Start Date</label>
              <input
                type="date"
                value={leaveStartDate}
                onChange={(e) => setLeaveStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">End Date</label>
              <input
                type="date"
                value={leaveEndDate}
                onChange={(e) => setLeaveEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-300 block mb-1">Leave Note / Reason (Optional)</label>
              <textarea
                rows={2}
                value={leaveNote}
                onChange={(e) => setLeaveNote(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-300 block mb-1">Evidence File (Optional)</label>
              <input
                type="file"
                onChange={(e) => setLeaveEvidence(e.target.files[0])}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleGrantLeave}
              disabled={grantingLeave}
              className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs shadow-glow-orange disabled:opacity-50 flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              {grantingLeave ? 'Processing...' : 'Grant Leave'}
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <h4 className="text-sm font-semibold text-white mb-3">Leave History</h4>
            {loadingLeaves ? (
              <div className="text-xs text-slate-400">Loading leave history...</div>
            ) : doctorLeaves.length === 0 ? (
              <div className="text-xs text-slate-400">No leaves recorded for this doctor.</div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {doctorLeaves.map(leave => (
                  <div key={leave._id} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 flex justify-between items-center">
                    <div>
                      <div className="text-xs font-semibold text-white">
                        {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">{leave.leaveNote || 'No note provided'}</div>
                      <div className="mt-1">
                        {leave.status === 'ACTIVE' ? (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">ACTIVE</span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-500/20 text-slate-400 font-medium">{leave.status}</span>
                        )}
                      </div>
                    </div>
                    {leave.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleCancelLeave(leave._id)}
                        className="p-1.5 text-xs bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded border border-rose-500/20"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Create / Edit Doctor Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingDoc ? `Edit Doctor Profile: ${editingDoc.name}` : 'Register New Medical Officer'}
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          {editingDoc && (
            <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200 space-y-1">
              <span className="font-bold text-amber-300 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" /> Security Verification Policy
              </span>
              <span>Modifying <strong>Email Address</strong>, <strong>Password</strong>, or <strong>Biometric Face Profile</strong> triggers a 6-digit OTP sent live to <strong>{editingDoc.email}</strong>. Existing password values are never shown for security.</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Doctor Full Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Dr. Full Name"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            {/* Gender Selector Field */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Gender Select</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: 'Male' })}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                    formData.gender === 'Male'
                      ? 'bg-blue-600/30 border-blue-500 text-blue-300 shadow-lg'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ♂️ Male Doctor
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: 'Female' })}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                    formData.gender === 'Female'
                      ? 'bg-pink-600/30 border-pink-500 text-pink-300 shadow-glow-pink'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ♀️ Female Doctor
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Email Address {editingDoc && '(Requires OTP to change)'}
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="doctor@gmail.com"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Username / System ID</label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="doctor_username"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Password {editingDoc ? '(Requires OTP to change)' : '(Set Initial Password)'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required={!editingDoc}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingDoc ? 'Leave blank to keep existing password' : 'Set doctor account password'}
                  className="w-full px-3 py-2 pr-9 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Mobile Phone Number</label>
              <input
                type="text"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                placeholder="+91 9876543210"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Medical Qualifications</label>
              <input
                type="text"
                value={formData.qualification}
                onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                placeholder="e.g. MBBS, MD (General Medicine)"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Medical Specialization</label>
              <input
                type="text"
                value={formData.specialization}
                onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                placeholder="e.g. General Physician, Emergency Medicine"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-300 block mb-1">Assigned PHC Hospital Center</label>
              <select
                value={formData.assignedPHC}
                onChange={(e) => setFormData({ ...formData, assignedPHC: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              >
                {phcs.map(p => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.district || 'PHC'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Shift Start Time (12h/24h Format)</label>
              <input
                type="text"
                value={formData.shiftStart}
                onChange={(e) => setFormData({ ...formData, shiftStart: e.target.value })}
                placeholder="e.g. 10:00 PM or 22:00"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Shift End Time (12h/24h Format)</label>
              <input
                type="text"
                value={formData.shiftEnd}
                onChange={(e) => setFormData({ ...formData, shiftEnd: e.target.value })}
                placeholder="e.g. 04:00 AM or 04:00"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
              />
            </div>
          </div>

          {/* Biometric Face Capture Trigger Button */}
          <div className="pt-2 border-t border-slate-800 space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <div>
                <label className="text-sm font-medium text-slate-200">Require Biometric Authentication</label>
                <p className="text-xs text-slate-400 mt-0.5">When enabled, doctor must complete face scan during login</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.biometricRequired}
                  onChange={(e) => setFormData(prev => ({ ...prev, biometricRequired: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-semibold text-slate-200">
                  {formData.faceData ? 'Face Landmark Vector Enrolled ✅' : 'Biometric Face Enrolment Pending'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowFaceModal(true)}
                className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-bold transition-all"
              >
                {formData.faceData ? 'Re-scan Face' : 'Scan Webcam Face'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sendingOtp}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-glow-purple disabled:opacity-50"
            >
              {sendingOtp ? 'Sending Security OTP...' : editingDoc ? 'Save Doctor Changes' : 'Register New Doctor'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
