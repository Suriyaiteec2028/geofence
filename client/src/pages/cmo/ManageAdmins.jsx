import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { Table } from '../../components/common/Table';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { useNotification } from '../../context/NotificationContext';
import { Users, Plus, Shield, Mail, Phone, Building2, Eye, EyeOff, Edit, Trash2, KeyRound, ShieldAlert, CheckCircle2 } from 'lucide-react';

export const ManageAdmins = () => {
  const [admins, setAdmins] = useState([]);
  const [phcs, setPhcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // OTP Verification Modal State for Email / Password Edits
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
    mobile: '',
    qualification: 'MBBS, MHA',
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
      addToast('Error loading admins', 'danger');
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
      mobile: '',
      qualification: 'MBBS, MHA',
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
      password: '',
      mobile: admin.mobile || '',
      qualification: admin.qualification || 'MBBS, MHA',
      assignedPHC: admin.assignedPHC || ''
    });
    setShowPassword(false);
    setShowModal(true);
  };

  // Pre-check if OTP is required for email or password change
  const handleSubmitForm = async (e) => {
    e.preventDefault();

    if (!editingAdmin) {
      // 1st Time Creation by CMO (No OTP required)
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
      // Trigger OTP to Admin's existing registered email
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
      // Non-sensitive details edit (Name, Mobile, Qualification, PHC) - No OTP required
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
          <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-white text-xs">{row.name}</div>
            <div className="text-[10px] text-slate-400">@{row.username}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Contact Info',
      key: 'email',
      render: (row) => (
        <div className="text-xs space-y-0.5">
          <div className="text-slate-200 flex items-center gap-1"><Mail className="w-3 h-3 text-blue-400" /> {row.email}</div>
          <div className="text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3 text-slate-500" /> {row.mobile || 'N/A'}</div>
        </div>
      )
    },
    {
      header: 'Assigned PHC Hospital',
      key: 'phcName',
      render: (row) => (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1 w-fit">
          <Building2 className="w-3 h-3" /> {row.phcName}
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
            title="Edit Admin Account (Email/Password change requires OTP)"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 border border-blue-500/20 transition-all"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteAdmin(row._id, row.name)}
            title="Delete Admin Account"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-rose-400 hover:text-rose-300 border border-rose-500/20 transition-all"
          >
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
          <h2 className="text-xl font-bold text-white tracking-tight">PHC Administrators</h2>
          <p className="text-xs text-slate-400">Manage administrator accounts. Email/Password edits require OTP authorization to existing registered email.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg transition-all"
        >
          <Plus className="w-4 h-4" /> Create New Admin
        </button>
      </div>

      {loading ? (
        <LoadingSkeleton type="table" count={4} />
      ) : (
        <Table columns={columns} data={admins} searchPlaceholder="Search admin name or email..." />
      )}

      {/* OTP Verification Modal for Email/Password Edits */}
      <Modal
        isOpen={showOtpModal}
        onClose={() => setShowOtpModal(false)}
        title="Admin Email / Password OTP Authorization"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleVerifyOtpAndSave} className="space-y-4">
          <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/40 text-xs text-purple-200 space-y-1">
            <span className="font-bold flex items-center gap-1.5 text-purple-300">
              <ShieldAlert className="w-4 h-4 text-purple-400" /> Existing Admin Email OTP Required
            </span>
            <p>
              A 6-digit security code has been sent live to Admin's registered email: <strong className="text-white">{editingAdmin?.email}</strong>.
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
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono tracking-widest text-center text-purple-400 placeholder-slate-600 focus:border-purple-500 outline-none font-bold"
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
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {savingWithOtp ? 'Verifying & Saving...' : 'Verify OTP & Apply Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create / Edit Admin Modal */}
      <Modal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        title={editingAdmin ? `Edit Admin Account: ${editingAdmin.name}` : 'Create New PHC Admin Account'}
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Full Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Dr. Full Name"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Email Address {editingAdmin && '(Requires OTP to change)'}
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="admin@hospital.gov.in"
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
          </div>

          <div className="grid grid-cols-2 gap-3">
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
                  placeholder={editingAdmin ? 'Leave blank to keep current' : 'Set Admin Password'}
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
              <label className="text-xs font-semibold text-slate-300 block mb-1">Mobile Number</label>
              <input
                type="text"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                placeholder="+91 9876543210"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Assign PHC Center</label>
            <select
              value={formData.assignedPHC}
              onChange={(e) => setFormData({ ...formData, assignedPHC: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
            >
              <option value="">Select Hospital PHC</option>
              {phcs.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.district})
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sendingOtp}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold disabled:opacity-50"
            >
              {sendingOtp ? 'Sending Security OTP...' : editingAdmin ? 'Save Changes' : 'Create Account'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
