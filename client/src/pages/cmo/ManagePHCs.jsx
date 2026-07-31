import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Breadcrumb } from '../../components/layout/Breadcrumb';
import { Table } from '../../components/common/Table';
import { Modal } from '../../components/common/Modal';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { useNotification } from '../../context/NotificationContext';
import { Building2, Plus, Edit, Trash2, Power, UserPlus, Eye, EyeOff, ShieldCheck } from 'lucide-react';

export const ManagePHCs = () => {
  const [phcs, setPhcs] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPhc, setEditingPhc] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const { addToast } = useNotification();

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    district: 'Central Metro',
    assignedAdmin: '',
    createNewAdmin: false,
    adminData: {
      adminName: '',
      adminEmail: '',
      adminUsername: '',
      adminPassword: '',
      adminMobile: '',
      adminQualification: 'MBBS, MHA'
    }
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [phcRes, adminRes] = await Promise.all([
        axios.get('/api/phcs'),
        axios.get('/api/doctors/admins/list')
      ]);
      if (phcRes.data.success) setPhcs(phcRes.data.phcs);
      if (adminRes.data.success) setAdmins(adminRes.data.admins);
    } catch (err) {
      addToast('Failed to load PHC records.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingPhc(null);
    setFormData({
      name: '',
      code: 'PHC-' + Math.floor(100 + Math.random() * 900),
      address: '',
      district: 'Central Metro',
      assignedAdmin: '',
      createNewAdmin: false,
      adminData: {
        adminName: '',
        adminEmail: '',
        adminUsername: '',
        adminPassword: '',
        adminMobile: '',
        adminQualification: 'MBBS, MHA'
      }
    });
    setShowModal(true);
  };

  const handleOpenEdit = (phc) => {
    setEditingPhc(phc);
    setFormData({
      name: phc.name,
      code: phc.code,
      address: phc.address,
      district: phc.district,
      assignedAdmin: phc.assignedAdmin || '',
      createNewAdmin: false,
      adminData: {
        adminName: '',
        adminEmail: '',
        adminUsername: '',
        adminPassword: '',
        adminMobile: '',
        adminQualification: 'MBBS, MHA'
      }
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPhc) {
        const res = await axios.put(`/api/phcs/${editingPhc._id}`, formData);
        if (res.data.success) addToast('PHC details updated successfully', 'success');
      } else {
        const res = await axios.post('/api/phcs', formData);
        if (res.data.success) addToast('New Primary Health Center created successfully. Admin assigned.', 'success');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      addToast(err.response?.data?.message || 'Error saving PHC details', 'danger');
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      const res = await axios.patch(`/api/phcs/${id}/toggle-status`);
      if (res.data.success) {
        addToast(res.data.message, 'info');
        fetchData();
      }
    } catch (err) {
      addToast('Status toggle failed', 'danger');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this PHC?')) return;
    try {
      const res = await axios.delete(`/api/phcs/${id}`);
      if (res.data.success) {
        addToast('PHC removed successfully', 'success');
        fetchData();
      }
    } catch (err) {
      addToast('Delete failed', 'danger');
    }
  };

  const columns = [
    {
      header: 'PHC Center & Code',
      key: 'name',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-white text-xs">{row.name}</div>
            <div className="text-[10px] text-slate-400 font-mono">{row.code}</div>
          </div>
        </div>
      )
    },
    {
      header: 'District & Location',
      key: 'district',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-200">{row.district}</div>
          <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{row.address}</div>
        </div>
      )
    },
    {
      header: 'Assigned Admin',
      key: 'adminName',
      render: (row) => (
        <div className="text-xs">
          <span className="font-semibold text-purple-300 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" /> {row.adminName}
          </span>
          <div className="text-[10px] text-slate-400">{row.doctorCount} doctors registered</div>
        </div>
      )
    },
    {
      header: 'Status',
      key: 'status',
      render: (row) => (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
          row.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
        }`}>
          {row.status}
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
            className="p-1.5 rounded-lg bg-slate-800 text-blue-400 hover:bg-slate-700 transition-colors"
            title="Edit PHC Details"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleToggleStatus(row._id)}
            className="p-1.5 rounded-lg bg-slate-800 text-amber-400 hover:bg-slate-700 transition-colors"
            title="Toggle Status"
          >
            <Power className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(row._id)}
            className="p-1.5 rounded-lg bg-slate-800 text-rose-400 hover:bg-slate-700 transition-colors"
            title="Delete PHC"
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Primary Health Centers (PHCs)</h2>
          <p className="text-xs text-slate-400">Create PHCs and assign Administrators. (Geofence map setting is configured by Admin).</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-glow-blue transition-all"
        >
          <Plus className="w-4 h-4" /> Add New PHC
        </button>
      </div>

      {loading ? (
        <LoadingSkeleton type="table" count={5} />
      ) : (
        <Table
          columns={columns}
          data={phcs}
          searchPlaceholder="Search PHC name, code, or district..."
          statusOptions={[
            { label: 'Active', value: 'ACTIVE' },
            { label: 'Inactive', value: 'INACTIVE' }
          ]}
        />
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingPhc ? `Edit PHC Center: ${editingPhc.name}` : 'Register New Primary Health Center'}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">PHC Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Central District Hospital PHC"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">PHC Code</label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="PHC-101"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">District</label>
              <input
                type="text"
                required
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                placeholder="Central Metro"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Assign Hospital Admin</label>
              <select
                value={formData.createNewAdmin ? 'CREATE_NEW' : formData.assignedAdmin}
                onChange={(e) => {
                  if (e.target.value === 'CREATE_NEW') {
                    setFormData({ ...formData, createNewAdmin: true, assignedAdmin: '' });
                  } else {
                    setFormData({ ...formData, createNewAdmin: false, assignedAdmin: e.target.value });
                  }
                }}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              >
                <option value="">Select Existing Admin...</option>
                {admins.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name} ({a.email})
                  </option>
                ))}
                {!editingPhc && (
                  <option value="CREATE_NEW" className="text-purple-400 font-bold">
                    ➕ Create & Register New Admin Account...
                  </option>
                )}
              </select>
            </div>

            {/* Inline New Admin Creation Panel */}
            {formData.createNewAdmin && !editingPhc && (
              <div className="md:col-span-2 p-4 rounded-xl bg-purple-950/30 border border-purple-500/30 space-y-3">
                <div className="flex items-center gap-2 text-purple-400 font-bold text-xs">
                  <UserPlus className="w-4 h-4" /> Create New Admin Account & Set Password
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-300 block mb-1">Admin Full Name</label>
                    <input
                      type="text"
                      required
                      value={formData.adminData.adminName}
                      onChange={(e) => setFormData({
                        ...formData,
                        adminData: { ...formData.adminData, adminName: e.target.value }
                      })}
                      placeholder="Dr. Full Name"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-300 block mb-1">Admin Email</label>
                    <input
                      type="email"
                      required
                      value={formData.adminData.adminEmail}
                      onChange={(e) => setFormData({
                        ...formData,
                        adminData: { ...formData.adminData, adminEmail: e.target.value }
                      })}
                      placeholder="admin.phc@hospital.gov.in"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-300 block mb-1">Username</label>
                    <input
                      type="text"
                      required
                      value={formData.adminData.adminUsername}
                      onChange={(e) => setFormData({
                        ...formData,
                        adminData: { ...formData.adminData, adminUsername: e.target.value }
                      })}
                      placeholder="admin_username"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-300 block mb-1">Admin Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={formData.adminData.adminPassword}
                        onChange={(e) => setFormData({
                          ...formData,
                          adminData: { ...formData.adminData, adminPassword: e.target.value }
                        })}
                        placeholder="Set Admin Password"
                        className="w-full px-3 py-1.5 pr-8 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-300 block mb-1">Physical Address</label>
              <input
                type="text"
                required
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Full hospital address string..."
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>
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
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-glow-blue"
            >
              Save PHC Settings
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
