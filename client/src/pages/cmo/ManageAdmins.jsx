import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { Table } from '../../components/common/Table';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { UserAvatar } from '../../components/common/UserAvatar';
import { OTPVerificationModal } from '../../components/common/OTPVerificationModal';
import { useNotification } from '../../context/NotificationContext';
import { 
  UserPlus, Search, Edit3, Trash2, Mail, Shield, Building2, Lock, Eye, EyeOff, KeyRound, AlertTriangle 
} from 'lucide-react';

export const ManageAdmins = () => {
  const [admins, setAdmins] = useState([]);
  const [phcs, setPhcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // OTP Verification Modal State
  const [showOtpModal, setShowOtpModal] = useState(false);
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
        axios.get('/api/doctors/admins'),
        axios.get('/api/phcs')
      ]);
      if (adminRes.data.success) setAdmins(adminRes.data.admins);
      if (phcRes.data.success) setPhcs(phcRes.data.phcs);
    } catch (err) {
      addToast('Failed to load administrators list', 'danger');
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
    setShowModal(true);
  };

  const handleOpenEdit = (admin) => {
    setEditingAdmin(admin);
    setFormData({
      name: admin.name || '',
      email: admin.email || '',
      username: admin.username || '',
      password: '',
      gender: admin.gender || 'Male',
      mobile: admin.mobile || '',
      assignedPHC: admin.assignedPHC || (phcs.length > 0 ? phcs[0]._id : '')
    });
    setShowModal(true);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();

    if (!editingAdmin) {
      // Create Admin - No OTP required
      try {
        const res = await axios.post('/api/doctors/admins', formData);
        if (res.data.success) {
          addToast(res.data.message || 'Admin account appointed successfully', 'success');
          setShowModal(false);
          fetchData();
        }
      } catch (err) {
        addToast(err.response?.data?.message || 'Error creating admin account', 'danger');
      }
      return;
    }

    // Subsequent Edit: Check if Email or Password is changed
    const isEmailChanged = formData.email.trim().toLowerCase() !== editingAdmin.email.toLowerCase();
    const isPasswordChanged = formData.password && formData.password.trim() !== '';

    if (isEmailChanged || isPasswordChanged) {
      setSendingOtp(true);
      addToast(`Sending 6-digit security OTP to Admin ${editingAdmin.name}'s email (${editingAdmin.email})...`, 'info');
      try {
        const res = await axios.post(`/api/doctors/admins/${editingAdmin._id}/request-otp`);
        if (res.data.success) {
          addToast(`OTP Code sent live to ${editingAdmin.email}. Please enter OTP to authorize changes.`, 'success', 'OTP Sent');
          setShowOtpModal(true);
        }
      } catch (err) {
        addToast(err.response?.data?.message || 'Failed to send OTP code to existing admin email', 'danger');
      } finally {
        setSendingOtp(false);
      }
    } else {
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

  const handleResendOTP = async () => {
    if (!editingAdmin) return;
    const res = await axios.post(`/api/doctors/admins/${editingAdmin._id}/request-otp`);
    if (res.data.success) {
      addToast(`New OTP verification code sent live to ${editingAdmin.email}`, 'success', 'OTP Resent');
    }
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
      header: 'Administrator Name & Profile',
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
            <div className="text-[11px] text-purple-300 font-medium">{row.qualification || 'MBBS, MHA'} • Hospital Admin</div>
            {row.mobile && <div className="text-[10px] text-slate-500">{row.mobile}</div>}
          </div>
        </div>
      )
    },
    {
      header: 'Contact Credentials',
      accessor: 'email',
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
      header: 'Assigned PHC Hospital Center',
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
      header: 'Account Status',
      accessor: 'status',
      render: (row) => (
        <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center gap-1 w-fit">
          <Shield className="w-3.5 h-3.5" /> Active Admin
        </span>
      )
    },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleOpenEdit(row)}
            className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 transition-all"
            title="Edit Admin Credentials"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDeleteAdmin(row._id, row.name)}
            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all"
            title="Remove Admin Account"
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
      <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-950/60 via-slate-900 to-slate-950 border border-purple-500/20 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Manage Hospital Administrators</h2>
          <p className="text-xs text-slate-400 mt-1">
            Appoint administrators, assign Primary Health Center (PHC) governance, and manage credential security.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-all shadow-glow-purple flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" /> Appoint New Admin
          </button>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <LoadingSkeleton type="table" count={4} />
      ) : (
        <Table columns={columns} data={admins} searchPlaceholder="Search by admin name, email, or PHC hospital..." />
      )}

      {/* Universal Foreground OTP Verification Modal (Stacking z-[100]) */}
      <OTPVerificationModal
        isOpen={showOtpModal}
        onClose={() => setShowOtpModal(false)}
        email={editingAdmin?.email}
        title="Admin Security OTP Verification"
        subtitle={`Sent live to Admin ${editingAdmin?.name}'s email (${editingAdmin?.email})`}
        onVerify={(otpCode) => saveAdminUpdates({ otp: otpCode })}
        onResend={handleResendOTP}
        loading={savingWithOtp}
      />

      {/* Appoint / Edit Admin Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingAdmin ? `Edit Admin: ${editingAdmin.name}` : "Appoint New PHC Administrator"}
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          {editingAdmin && (
            <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-xs text-purple-300 flex items-center gap-2">
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
              <label className="text-xs font-semibold text-slate-300 block mb-1">Assigned Primary Health Center (PHC)</label>
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
              {sendingOtp ? 'Sending Security OTP...' : editingAdmin ? 'Save Admin Changes' : 'Appoint New Admin'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
