import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { Table } from '../../components/common/Table';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { FaceScannerModal } from '../../components/biometrics/FaceScannerModal';
import { UserAvatar } from '../../components/common/UserAvatar';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { 
  UserPlus, Search, Edit3, Trash2, Mail, ShieldAlert, CheckCircle2, Clock, 
  Building2, Camera, Eye, EyeOff, Lock, Send, FileSpreadsheet, KeyRound, AlertTriangle 
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
  const [otpInput, setOtpInput] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [savingWithOtp, setSavingWithOtp] = useState(false);

  // Notice Modal State
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticeTarget, setNoticeTarget] = useState(null);
  const [noticeSubject, setNoticeSubject] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [sendingNotice, setSendingNotice] = useState(false);

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
    faceData: ''
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
      faceData: ''
    });
    setShowPassword(false);
    setShowModal(true);
  };

  const handleOpenEdit = (doc) => {
    setEditingDoc(doc);
    setFormData({
      name: doc.name || '',
      email: doc.email || '',
      username: doc.username || '',
      password: '', // Keep sensitive password blank
      gender: doc.gender || 'Male',
      mobile: doc.mobile || '',
      qualification: doc.qualification || 'MBBS',
      specialization: doc.specialization || 'General Physician',
      assignedPHC: doc.assignedPHC || '',
      shiftStart: doc.shiftStart || '09:00',
      shiftEnd: doc.shiftEnd || '17:00',
      faceData: doc.faceData || ''
    });
    setShowPassword(false);
    setShowModal(true);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();

    if (!editingDoc) {
      // 1st Time Creation by Admin
      if (!formData.password) {
        addToast('Please enter a password for the doctor account', 'warning');
        return;
      }
      if (!formData.faceData) {
        addToast('📸 Doctor biometric face capture required! Opening webcam camera scanner frame...', 'info');
        setShowFaceModal(true);
        return;
      }
      try {
        const res = await axios.post('/api/doctors', formData);
        if (res.data.success) {
          addToast(res.data.message || 'New Doctor registered & credentials email sent', 'success');
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
      addToast(`Sending 6-digit security OTP to Dr. ${editingDoc.name}'s existing email (${editingDoc.email})...`, 'info');
      try {
        const res = await axios.post(`/api/doctors/${editingDoc._id}/request-otp`);
        if (res.data.success) {
          addToast(`OTP Code sent live to ${editingDoc.email}. Please enter OTP to authorize credential changes.`, 'success', 'OTP Sent');
          setOtpInput('');
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

  const handleVerifyOtpAndSaveDoctor = (e) => {
    e.preventDefault();
    if (!otpInput || otpInput.trim().length !== 6) {
      addToast('Please enter the 6-digit OTP code sent to existing doctor email.', 'warning');
      return;
    }
    saveDoctorUpdates({ otp: otpInput.trim() });
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
      addToast('Error removing doctor', 'danger');
    }
  };

  const handleOpenNoticeModal = (doc) => {
    setNoticeTarget(doc);
    setNoticeSubject(`Official Duty Notice: Dr. ${doc.name}`);
    setNoticeMessage(`Dear Dr. ${doc.name},\n\nPlease ensure strict compliance during your scheduled shift (${formatTime12h(doc.shiftStart)} - ${formatTime12h(doc.shiftEnd)}) at ${doc.phcDetails?.name || 'Assigned PHC'}.`);
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
        addToast(res.data.message || 'Notice delivered to doctor inbox', 'success');
        setShowNoticeModal(false);
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to dispatch notice email', 'danger');
    } finally {
      setSendingNotice(false);
    }
  };

  const columns = [
    {
      header: 'Doctor Name & Profile',
      key: 'name',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          {/* Gender-Based Doctor Avatar Illustration */}
          <UserAvatar gender={row.gender} role="DOCTOR" name={row.name} size="md" />
          <div>
            <div className="font-bold text-white text-xs flex items-center gap-1.5">
              {row.name}
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-semibold ${
                row.gender === 'Female' ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              }`}>
                {row.gender === 'Female' ? '♀ Lady Doctor' : '♂ Male Doctor'}
              </span>
            </div>
            <div className="text-[10px] text-slate-400">{row.specialization} • {row.qualification}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Login Credentials',
      key: 'username',
      render: (row) => (
        <div className="text-xs space-y-0.5">
          <div className="text-slate-200 font-semibold flex items-center gap-1">
            <Mail className="w-3 h-3 text-blue-400" /> {row.email}
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            Username: <strong className="text-blue-300">{row.username}</strong>
          </div>
        </div>
      )
    },
    {
      header: 'Assigned PHC Hospital',
      key: 'assignedPHC',
      render: (row) => (
        <div className="text-xs">
          <div className="text-slate-200 font-semibold flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-emerald-400" />
            {row.phcDetails ? row.phcDetails.name : 'Central Health Center'}
          </div>
          <div className="text-[10px] text-slate-400">{row.phcDetails?.district || 'District Center'}</div>
        </div>
      )
    },
    {
      header: 'Duty Shift Schedule',
      key: 'shiftStart',
      sortable: true,
      render: (row) => (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1 w-fit">
          <Clock className="w-3 h-3" /> {formatTime12h(row.shiftStart)} – {formatTime12h(row.shiftEnd)}
        </span>
      )
    },
    {
      header: 'Biometric Status',
      key: 'faceData',
      render: (row) => (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit ${
          row.faceData 
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
            : 'bg-slate-800 text-slate-400 border border-slate-700'
        }`}>
          <Camera className="w-3 h-3" />
          {row.faceData ? 'Face Enrolled' : 'Pending Scan'}
        </span>
      )
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenEdit(row)}
            className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 transition-all text-xs font-semibold flex items-center gap-1"
            title="Edit Doctor Details"
          >
            <Edit3 className="w-3.5 h-3.5" /> Edit
          </button>
          <button
            onClick={() => handleOpenNoticeModal(row)}
            className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 transition-all text-xs font-semibold flex items-center gap-1"
            title="Send Official Notice Email"
          >
            <Mail className="w-3.5 h-3.5" /> Send Notice
          </button>
          <button
            onClick={() => handleDelete(row._id, row.name)}
            className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30 transition-all"
            title="Remove Doctor"
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Manage Hospital Medical Officers</h2>
          <p className="text-xs text-slate-400">Register doctors, configure shift timing windows, and manage biometric profiles.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-glow-blue transition-all"
        >
          <UserPlus className="w-4 h-4" /> Register New Doctor
        </button>
      </div>

      {loading ? (
        <LoadingSkeleton type="table" count={5} />
      ) : (
        <Table columns={columns} data={doctors} searchPlaceholder="Search by name, email, or specialization..." />
      )}

      {/* Biometric Face Scanner Modal */}
      <FaceScannerModal
        isOpen={showFaceModal}
        onClose={() => setShowFaceModal(false)}
        onCapture={(capturedData) => {
          setFormData(prev => ({ ...prev, faceData: capturedData }));
          addToast('Biometric Face Profile captured! Save changes to update profile.', 'success', 'Face Enrolled');
        }}
        title="Register Doctor Biometric Face"
        subtitle="Align doctor's face in frame to enroll webcam biometric profile"
      />

      {/* 6-Digit OTP Security Modal */}
      <AnimatePresence>
        {showOtpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#1E293B] border border-blue-500/30 rounded-3xl p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Security OTP Verification Required</h3>
                  <p className="text-[11px] text-slate-400">Sent live to Dr. {editingDoc?.name}'s email ({editingDoc?.email})</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                  <ShieldAlert className="w-4 h-4" /> Sensitive Credential Modification
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Modifying a Doctor's <strong>Email Address</strong>, <strong>Password</strong>, or <strong>Biometric Face Profile</strong> requires OTP security code verification. Please enter the 6-digit OTP code sent live to <strong>{editingDoc?.email}</strong>.
                </p>
              </div>

              <form onSubmit={handleVerifyOtpAndSaveDoctor} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Enter 6-Digit Verification OTP</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full px-4 py-3 bg-slate-900 border border-blue-500/40 rounded-xl text-lg font-mono font-bold tracking-widest text-center text-emerald-400 placeholder-slate-600 focus:outline-none focus:border-blue-400"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowOtpModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingWithOtp || otpInput.length !== 6}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-glow-emerald disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {savingWithOtp ? 'Verifying OTP...' : 'Verify OTP & Apply Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Official Notice Email Modal */}
      <AnimatePresence>
        {showNoticeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-[#1E293B] border border-amber-500/30 rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">Send Official Notice Email</h3>
                </div>
                <button onClick={() => setShowNoticeModal(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              <form onSubmit={handleSendCustomNotice} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Recipient Doctor</label>
                  <input
                    type="text"
                    disabled
                    value={`${noticeTarget?.name} (${noticeTarget?.email})`}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Email Subject Line</label>
                  <input
                    type="text"
                    required
                    value={noticeSubject}
                    onChange={(e) => setNoticeSubject(e.target.value)}
                    placeholder="Notice Subject"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Notice Message Text</label>
                  <textarea
                    required
                    rows={5}
                    value={noticeMessage}
                    onChange={(e) => setNoticeMessage(e.target.value)}
                    placeholder="Enter official warning notice text..."
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowNoticeModal(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sendingNotice}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg"
                  >
                    <Send className="w-3.5 h-3.5" /> {sendingNotice ? 'Dispatching Email...' : 'Send Notice Email'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Registration / Edit Doctor Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingDoc ? `Edit Doctor: Dr. ${editingDoc.name}` : "Register New Medical Doctor"}
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          {editingDoc && (
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300 flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-400 flex-shrink-0" />
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
                      ? 'bg-blue-600/30 border-blue-500 text-blue-300 shadow-glow-blue'
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
                  ♀️ Lady Doctor
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
              <label className="text-xs font-semibold text-slate-300 block mb-1">Username</label>
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
              <label className="text-xs font-semibold text-slate-300 block mb-1">Specialization</label>
              <input
                type="text"
                value={formData.specialization}
                onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                placeholder="General Physician, Pediatric, Surgery, etc."
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
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

            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-300 block mb-1">Assigned PHC Hospital</label>
              <select
                value={formData.assignedPHC}
                onChange={(e) => setFormData({ ...formData, assignedPHC: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              >
                <option value="">Select Primary Health Center (PHC)</option>
                {phcs.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.district})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Shift Start Time</label>
              <input
                type="time"
                required
                value={formData.shiftStart}
                onChange={(e) => setFormData({ ...formData, shiftStart: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Shift End Time</label>
              <input
                type="time"
                required
                value={formData.shiftEnd}
                onChange={(e) => setFormData({ ...formData, shiftEnd: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>
          </div>

          {/* Biometric Face Enrolment Section */}
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-700/80 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-sky-400" /> Biometric Face Enrolment {editingDoc && '(Requires OTP to re-enroll)'}
              </span>
              <span className="text-[11px] text-slate-400 block">
                {formData.faceData ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Doctor Biometric Face Profile Enrolled
                  </span>
                ) : (
                  'Enroll doctor face using webcam to prevent proxy attendance.'
                )}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowFaceModal(true)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                formData.faceData
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500 shadow-glow-blue'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              {formData.faceData ? 'Re-enroll Face' : '📸 Register Face'}
            </button>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">
              Cancel
            </button>
            <button
              type="submit"
              disabled={sendingOtp}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-glow-blue disabled:opacity-50"
            >
              {sendingOtp ? 'Sending Security OTP...' : editingDoc ? 'Save Doctor Changes' : 'Register New Doctor'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
