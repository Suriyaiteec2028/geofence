import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { Table } from '../../components/common/Table';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { UserAvatar } from '../../components/common/UserAvatar';
import { useNotification } from '../../context/NotificationContext';
import { 
  UserCheck, Shield, Edit3, Trash2, Mail, Building2, KeyRound, Lock, Eye, EyeOff, ShieldAlert, Phone 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const ManageAdmins = () => {
  const [admins, setAdmins] = useState([]);
  const [phcs, setPhcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // OTP Verification Modal State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [savingWithOtp, setSavingWithOtp] = useState(false);

  const { addToast } = useNotification();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    gender: 'Male',
    mobile: '',
    assignedPHC: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [adminRes, phcRes] = await Promise.all([
        axios.get('/api/doctors/admins/list'),
        axios.get('/api/phcs')
      ]);
      if (adminRes.data.success) setAdmins(adminRes.data.admins);
      if (phcRes.data.success) setPhcs(phcRes.data.phcs);
    } catch (err) {
      addToast('Failed to load admins list', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingAdmin(null);
    setFormData({
      name: '',
      email: '',
      username: '',
      password: '',
      gender: 'Male',
      mobile: '',
      assignedPHC: phcs.length > 0 ? phcs[0]._id : ''
    });
    setShowPassword(false);
    setShowModal(true);
  };

  const handleOpenEdit = (admin) => {
    setEditingAdmin(admin);
    setFormData({
      name: admin.name || '',
      email: admin.email || '',
      username: admin.username || '',
      password: '', // Keep password blank
      gender: admin.gender || 'Male',
      mobile: admin.mobile || '',
      assignedPHC: admin.assignedPHC || ''
    });
    setShowPassword(false);
    setShowModal(true);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();

    if (!editingAdmin) {
      // 1st Time Creation by CMO
      if (!formData.password) {
        addToast('Please enter a password for the new admin account', 'warning');
        return;
      }
      try {
        const res = await axios.post('/api/doctors/admins/create', formData);
        if (res.data.success) {
          addToast(res.data.message || 'New PHC Administrator created successfully', 'success');
          setShowModal(false);
          fetchData();
        }
      } catch (err) {
        addToast(err.response?.data?.message || 'Error creating admin', 'danger');
      }
      return;
    }

    // Subsequent Edit by CMO: Check if Email or Password is changed
    const isEmailChanged = formData.email.trim().toLowerCase() !== editingAdmin.email.toLowerCase();
    const isPasswordChanged = formData.password && formData.password.trim() !== '';

    if (isEmailChanged || isPasswordChanged) {
      // Trigger OTP to Admin's existing registered email inbox
      setSendingOtp(true);
      addToast(`Sending 6-digit security OTP to existing email (${editingAdmin.email})...`, 'info');
      try {
        const res = await axios.post(`/api/doctors/admins/${editingAdmin._id}/request-otp`);
        if (res.data.success) {
          addToast(`OTP Code sent live to ${editingAdmin.email}. Please enter OTP to authorize changes.`, 'success', 'OTP Sent');
          setOtpInput('');
          setShowOtpModal(true);
        }
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to send OTP code to existing admin email', 'danger');
      } finally {
        setSendingOtp(false);
      }
    } else {
      // Non-sensitive details edit - No OTP required
      saveAdminUpdates({});
    }
  };

  const saveAdminUpdates = async (extraPayload = {}) => {
    setSavingWithOtp(true);
    try {
      const res = await axios.put(`/api/doctors/admins/${editingAdmin._id}`, {
        ...formData,
        ...extraPayload
      });
      if (res.data.success) {
        addToast(res.data.message || 'Admin details updated successfully', 'success');
        setShowOtpModal(false);
        setShowModal(false);
        fetchData();
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Error updating admin details', 'danger');
    } finally {
      setSavingWithOtp(false);
    }
  };

  const handleVerifyOtpAndSave = (e) => {
    e.preventDefault();
    if (!otpInput || otpInput.trim().length !== 6) {
      addToast('Please enter the 6-digit OTP code sent to existing email.', 'warning');
      return;
    }
    saveAdminUpdates({ otp: otpInput.trim() });
  };

  const handleDeleteAdmin = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete Admin account "${name}"? This action cannot be undone.`)) return;
    try {
      const res = await axios.delete(`/api/doctors/admins/${id}`);
      if (res.data.success) {
        addToast(res.data.message || 'Admin account deleted', 'success');
        fetchData();
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Delete admin failed', 'danger');
    }
  };

  const columns = [
    {
      header: 'Administrator Name',
      key: 'name',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          {/* Gender-Based Admin Avatar */}
          <UserAvatar gender={row.gender} role="ADMIN" name={row.name} size="md" />
          <div>
            <div className="font-bold text-white text-xs flex items-center gap-1.5">
              {row.name}
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-semibold ${
                row.gender === 'Female' ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30' : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
              }`}>
                {row.gender === 'Female' ? '♀ Female Admin' : '♂ Male Admin'}
              </span>
            </div>
            <div className="text-[10px] text-purple-400 font-semibold">PHC Administrator</div>
          </div>
        </div>
      )
    },
    {
      header: 'Credentials & Email',
      key: 'email',
      render: (row) => (
        <div className="text-xs space-y-0.5">
          <div className="text-slate-200 font-semibold flex items-center gap-1">
            <Mail className="w-3.5 h-3.5 text-blue-400" /> {row.email}
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            Username: <strong className="text-purple-300">{row.username}</strong>
          </div>
        </div>
      )
    },
    {
      header: 'Assigned Hospital Center',
      key: 'assignedPHC',
      render: (row) => (
        <div className="text-xs">
          <div className="text-slate-200 font-semibold flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-emerald-400" />
            {row.phcDetails ? row.phcDetails.name : 'All Regional PHCs'}
          </div>
          <div className="text-[10px] text-slate-400">{row.phcDetails?.district || 'District Center'}</div>
        </div>
      )
    },
    {
      header: 'Contact Number',
      key: 'mobile',
      render: (row) => (
        <div className="text-xs text-slate-300 flex items-center gap-1">
          <Phone className="w-3.5 h-3.5 text-slate-400" />
          {row.mobile || '+91 Unspecified'}
        </div>
      )
    },
    {
      header: 'Governance Action',
      key: 'actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenEdit(row)}
            className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 transition-all text-xs font-semibold flex items-center gap-1.5"
            title="Edit Admin Details"
          >
            <Edit3 className="w-3.5 h-3.5" /> Edit Admin
          </button>
          <button
            onClick={() => handleDeleteAdmin(row._id, row.name)}
            className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30 transition-all"
            title="Delete Admin Account"
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
          <h2 className="text-xl font-bold text-white tracking-tight">Manage PHC Administrators</h2>
          <p className="text-xs text-slate-400">Appoint hospital admins, assign health centers, and manage admin credentials.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg transition-all"
        >
          <UserCheck className="w-4 h-4" /> Appoint New Admin
        </button>
      </div>

      {loading ? (
        <LoadingSkeleton type="table" count={4} />
      ) : (
        <Table columns={columns} data={admins} searchPlaceholder="Search admin name, email, or PHC..." />
      )}

      {/* 6-Digit Security OTP Modal */}
      <AnimatePresence>
        {showOtpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#1E293B] border border-purple-500/30 rounded-3xl p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Security OTP Verification Required</h3>
                  <p className="text-[11px] text-slate-400">Sent live to {editingAdmin?.name}'s email ({editingAdmin?.email})</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                  <ShieldAlert className="w-4 h-4" /> Sensitive Credential Modification
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Modifying an Admin's <strong>Email Address</strong> or <strong>Password</strong> requires OTP security verification. Please enter the 6-digit OTP code sent live to <strong>{editingAdmin?.email}</strong>.
                </p>
              </div>

              <form onSubmit={handleVerifyOtpAndSave} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Enter 6-Digit Verification OTP</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full px-4 py-3 bg-slate-900 border border-purple-500/40 rounded-xl text-lg font-mono font-bold tracking-widest text-center text-emerald-400 placeholder-slate-600 focus:outline-none focus:border-purple-400"
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
                    {savingWithOtp ? 'Verifying OTP...' : 'Verify OTP & Save Updates'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Appoint / Edit Admin Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingAdmin ? `Edit Admin: ${editingAdmin.name}` : "Appoint New PHC Administrator"}
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          {editingAdmin && (
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs text-purple-300 flex items-center gap-2">
              <Lock className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <span>Modifying <strong>Email Address</strong> or <strong>Password</strong> sends a 6-digit OTP code live to <strong>{editingAdmin.email}</strong>. Existing passwords are never shown for security.</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Administrator Full Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Full Name"
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
                      ? 'bg-purple-600/30 border-purple-500 text-purple-300 shadow-lg'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ♂️ Male Admin
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
                  ♀️ Female Admin
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Email Address {editingAdmin && '(Requires OTP to change)'}
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="admin@gmail.com"
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
                placeholder="admin_username"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Password {editingAdmin ? '(Requires OTP to change)' : '(Set Initial Password)'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required={!editingAdmin}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingAdmin ? 'Leave blank to keep existing password' : 'Set admin account password'}
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

            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-300 block mb-1">Assigned Health Center (PHC)</label>
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
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">
              Cancel
            </button>
            <button
              type="submit"
              disabled={sendingOtp}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg disabled:opacity-50"
            >
              {sendingOtp ? 'Sending Security OTP...' : editingAdmin ? 'Save Admin Changes' : 'Appoint Admin'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
