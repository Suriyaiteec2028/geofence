import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { Table } from '../../components/common/Table';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { FaceScannerModal } from '../../components/biometrics/FaceScannerModal';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { UserCheck, Plus, Edit, Trash2, Mail, Phone, Clock, Eye, EyeOff, Camera, CheckCircle2, Send, FileText, AlertTriangle, KeyRound, ShieldAlert } from 'lucide-react';

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
  const [sendingReportId, setSendingReportId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // Doctor Edit OTP Verification State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [savingWithOtp, setSavingWithOtp] = useState(false);

  // Send Notice / Warning Email Modal State
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [targetRecipient, setTargetRecipient] = useState(null);
  const [messageSubject, setMessageSubject] = useState('');
  const [messageText, setMessageText] = useState('');
  const [sendingNotice, setSendingNotice] = useState(false);

  const { addToast } = useNotification();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
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
      password: '',
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
      // 1st Time Creation by Admin (No OTP required)
      if (!formData.password) {
        addToast('Please enter a password for the doctor account', 'warning');
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

    // Subsequent Edit: Check if Email or Password is changed
    const isEmailChanged = formData.email.trim().toLowerCase() !== editingDoc.email.toLowerCase();
    const isPasswordChanged = formData.password && formData.password.trim() !== '';

    if (isEmailChanged || isPasswordChanged) {
      // Trigger OTP to Doctor's existing registered email
      setSendingOtp(true);
      addToast(`Sending 6-digit security OTP to Dr. ${editingDoc.name}'s existing email (${editingDoc.email})...`, 'info');
      try {
        const res = await axios.post(`/api/doctors/${editingDoc._id}/request-otp`);
        if (res.data.success) {
          addToast(`OTP Code sent live to ${editingDoc.email}. Please enter OTP to authorize email/password changes.`, 'success', 'OTP Sent');
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
      addToast('Please enter the 6-digit OTP code sent to existing email.', 'warning');
      return;
    }
    saveDoctorUpdates({ otp: otpInput.trim() });
  };

  const handleSendAttendanceReport = async (doc) => {
    setSendingReportId(doc._id);
    addToast(`Generating and sending attendance report to ${doc.email}...`, 'info');
    try {
      const res = await axios.post(`/api/doctors/${doc._id}/send-report`);
      if (res.data.success) {
        addToast(`Attendance Report email delivered live to ${doc.email}!`, 'success', 'Report Sent');
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to send attendance report email', 'danger');
    } finally {
      setSendingReportId(null);
    }
  };

  const handleOpenNoticeModal = (doc) => {
    setTargetRecipient(doc);
    setMessageSubject(`Duty Warning / Notice for Dr. ${doc.name}`);
    setMessageText(`Dear Dr. ${doc.name},\n\nThis is an official communication regarding your assigned duty shift (${formatTime12h(doc.shiftStart)} - ${formatTime12h(doc.shiftEnd)}). Please ensure strict compliance with 60-minute geofenced attendance checkpoints.\n\nRegards,\nHospital Administration`);
    setShowMessageModal(true);
  };

  const handleSendNoticeEmail = async (e) => {
    e.preventDefault();
    if (!targetRecipient || !messageText) return;

    setSendingNotice(true);
    try {
      const res = await axios.post('/api/doctors/send-notice', {
        recipientEmail: targetRecipient.email,
        recipientName: targetRecipient.name,
        subject: messageSubject,
        messageText
      });
      if (res.data.success) {
        addToast(res.data.message || `Notice email sent to ${targetRecipient.email}`, 'success', 'Notice Sent');
        setShowMessageModal(false);
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to send notice email', 'danger');
    } finally {
      setSendingNotice(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this doctor account?')) return;
    try {
      const res = await axios.delete(`/api/doctors/${id}`);
      if (res.data.success) {
        addToast('Doctor account deleted', 'success');
        fetchData();
      }
    } catch (err) {
      addToast('Delete failed', 'danger');
    }
  };

  const columns = [
    {
      header: 'Doctor Name & Username',
      key: 'name',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-white text-xs flex items-center gap-1.5">
              {row.name}
              {row.faceData && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold">
                  Face Enrolled
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-400">{row.specialization} (@{row.username})</div>
          </div>
        </div>
      )
    },
    {
      header: 'Duty Shift Window',
      key: 'shiftStart',
      render: (row) => (
        <div className="text-xs font-mono text-sky-300 bg-sky-500/10 px-2.5 py-1 rounded-full border border-sky-500/20 flex items-center gap-1 w-fit">
          <Clock className="w-3 h-3 text-sky-400" /> {formatTime12h(row.shiftStart)} – {formatTime12h(row.shiftEnd)}
        </div>
      )
    },
    {
      header: 'Contact Details',
      key: 'email',
      render: (row) => (
        <div className="text-xs space-y-0.5">
          <div className="text-slate-200 flex items-center gap-1"><Mail className="w-3 h-3 text-blue-400" /> {row.email}</div>
          <div className="text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3 text-slate-500" /> {row.mobile || 'N/A'}</div>
        </div>
      )
    },
    {
      header: 'Assigned PHC',
      key: 'phcName',
      render: (row) => <span className="text-xs text-slate-300 font-semibold">{row.phcName}</span>
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSendAttendanceReport(row)}
            disabled={sendingReportId === row._id}
            title="Send Attendance Audit Summary Report to Doctor Inbox"
            className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1 transition-all disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            {sendingReportId === row._id ? 'Sending...' : 'Send Report'}
          </button>
          <button
            onClick={() => handleOpenNoticeModal(row)}
            title="Send Warning / Notice Email"
            className="p-1.5 rounded-lg bg-slate-800 text-amber-400 hover:bg-slate-700"
          >
            <Send className="w-4 h-4" />
          </button>
          <button onClick={() => handleOpenEdit(row)} title="Edit Doctor Details (Email/Password edit requires OTP)" className="p-1.5 rounded-lg bg-slate-800 text-blue-400 hover:bg-slate-700">
            <Edit className="w-4 h-4" />
          </button>
          <button onClick={() => handleDelete(row._id)} className="p-1.5 rounded-lg bg-slate-800 text-rose-400 hover:bg-slate-700">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Doctor Account Management</h2>
          <p className="text-xs text-slate-400">Register doctors. Email/Password edits require OTP authorization to existing registered email.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-glow-blue transition-all"
        >
          <Plus className="w-4 h-4" /> Register New Doctor
        </button>
      </div>

      {loading ? (
        <LoadingSkeleton type="table" count={5} />
      ) : (
        <Table columns={columns} data={doctors} searchPlaceholder="Search doctor name, email, or specialization..." />
      )}

      {/* Doctor Edit OTP Verification Modal */}
      <Modal
        isOpen={showOtpModal}
        onClose={() => setShowOtpModal(false)}
        title="Doctor Email / Password OTP Authorization"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleVerifyOtpAndSaveDoctor} className="space-y-4">
          <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/40 text-xs text-blue-200 space-y-1">
            <span className="font-bold flex items-center gap-1.5 text-blue-300">
              <ShieldAlert className="w-4 h-4 text-blue-400" /> Existing Doctor Email OTP Required
            </span>
            <p>
              A 6-digit security code has been sent live to Dr. {editingDoc?.name}'s registered email: <strong className="text-white">{editingDoc?.email}</strong>.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">Enter 6-Digit Security OTP</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                maxLength={6}
                required
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 582914"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono tracking-widest text-center text-blue-400 placeholder-slate-600 focus:border-blue-500 outline-none font-bold"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowOtpModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingWithOtp}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {savingWithOtp ? 'Verifying & Saving...' : 'Verify OTP & Apply Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Face Scanner Modal */}
      <FaceScannerModal
        isOpen={showFaceModal}
        onClose={() => setShowFaceModal(false)}
        title="Doctor Biometric Face Enrollment"
        subtitle={`Enrolling facial profile for ${formData.name || 'Doctor'}`}
        onCapture={(faceImageBase64) => {
          setFormData((prev) => ({ ...prev, faceData: faceImageBase64 }));
          addToast('Doctor biometric face captured and ready for saving!', 'success');
        }}
      />

      {/* Send Notice / Warning Email Modal */}
      <Modal
        isOpen={showMessageModal}
        onClose={() => setShowMessageModal(false)}
        title={`Send Notice Email to Dr. ${targetRecipient?.name || 'Doctor'}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSendNoticeEmail} className="space-y-4">
          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-200 block">Direct Email Warning Dispatch</span>
              Notice will be delivered live to <strong className="text-white">{targetRecipient?.email}</strong>.
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Subject / Warning Title</label>
            <input
              type="text"
              required
              value={messageSubject}
              onChange={(e) => setMessageSubject(e.target.value)}
              placeholder="e.g. Official Warning: Shift Checkpoint Compliance"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Warning Message Text</label>
            <textarea
              required
              rows={5}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type your official warning or message..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowMessageModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sendingNotice}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {sendingNotice ? 'Dispatching...' : 'Send Notice Email'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Doctor Registration / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingDoc ? `Edit Doctor Profile: ${editingDoc.name}` : 'Register New Medical Doctor'}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Full Doctor Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Dr. Full Name"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
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
                  placeholder={editingDoc ? 'Leave blank to keep current' : 'Set doctor account password'}
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
                <Camera className="w-4 h-4 text-sky-400" /> Biometric Face Enrolment
              </span>
              <span className="text-[11px] text-slate-400 block">
                {formData.faceData ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Doctor Biometric Face Enrolled
                  </span>
                ) : (
                  'Enroll face using webcam to prevent proxy attendance.'
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
