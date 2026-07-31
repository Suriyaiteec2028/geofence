import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { ToastContainer } from './components/notifications/ToastContainer';

// Pages
import { Login } from './pages/Login';

// CMO Pages
import { CMODashboard } from './pages/cmo/CMODashboard';
import { ManagePHCs } from './pages/cmo/ManagePHCs';
import { ManageAdmins } from './pages/cmo/ManageAdmins';
import { CMOReports } from './pages/cmo/CMOReports';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { ManageDoctors } from './pages/admin/ManageDoctors';
import { GeofenceSettings } from './pages/admin/GeofenceSettings';
import { ExplanationReview } from './pages/admin/ExplanationReview';
import { AdminReports } from './pages/admin/AdminReports';

// Doctor Pages
import { DoctorDashboard } from './pages/doctor/DoctorDashboard';
import { ExplanationSubmit } from './pages/doctor/ExplanationSubmit';
import { AttendanceHistory } from './pages/doctor/AttendanceHistory';
import { DoctorProfile } from './pages/doctor/DoctorProfile';

function ProtectedLayout({ allowedRoles }) {
  const { user, token } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'CMO') return <Navigate to="/cmo" replace />;
    if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
    return <Navigate to="/doctor" replace />;
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col md:flex-row">
      <ToastContainer />
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <Routes>
            {/* CMO Routes */}
            <Route path="/cmo" element={<CMODashboard />} />
            <Route path="/cmo/phcs" element={<ManagePHCs />} />
            <Route path="/cmo/admins" element={<ManageAdmins />} />
            <Route path="/cmo/reports" element={<CMOReports />} />

            {/* Admin Routes */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/doctors" element={<ManageDoctors />} />
            <Route path="/admin/geofence" element={<GeofenceSettings />} />
            <Route path="/admin/explanations" element={<ExplanationReview />} />
            <Route path="/admin/reports" element={<AdminReports />} />

            {/* Doctor Routes */}
            <Route path="/doctor" element={<DoctorDashboard />} />
            <Route path="/doctor/mark" element={<DoctorDashboard />} />
            <Route path="/doctor/explanation" element={<ExplanationSubmit />} />
            <Route path="/doctor/history" element={<AttendanceHistory />} />
            <Route path="/doctor/profile" element={<DoctorProfile />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedLayout
            allowedRoles={user?.role ? [user.role] : ['CMO', 'ADMIN', 'DOCTOR']}
          />
        }
      />
      <Route
        path="/"
        element={
          user?.role === 'CMO' ? (
            <Navigate to="/cmo" replace />
          ) : user?.role === 'ADMIN' ? (
            <Navigate to="/admin" replace />
          ) : user?.role === 'DOCTOR' ? (
            <Navigate to="/doctor" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}
