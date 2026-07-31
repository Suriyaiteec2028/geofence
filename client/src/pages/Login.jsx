import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { FaceScannerModal } from '../components/biometrics/FaceScannerModal';
import { ForgotPasswordModal } from '../components/common/ForgotPasswordModal';
import { Hospital, Shield, User, Lock, Eye, EyeOff, ArrowRight, Check, Camera, KeyRound } from 'lucide-react';
import { motion } from 'framer-motion';

export const Login = () => {
  const [usernameOrEmail, setUsernameOrEmail] = useState('suriyachandru2006@gmail.com');
  const [password, setPassword] = useState('Suriya@2006');
  const [role, setRole] = useState('CMO');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Biometric Doctor Face Verification State
  const [showDoctorFaceModal, setShowDoctorFaceModal] = useState(false);
  const [doctorName, setDoctorName] = useState('');
  const [verifyingCredentials, setVerifyingCredentials] = useState(false);

  // Forgot Password OTP Reset Modal State
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  const { login, doctorFaceLogin, loading } = useAuth();
  const { addToast } = useNotification();
  const navigate = useNavigate();

  const handleRoleSelect = (selectedRole) => {
    setRole(selectedRole);
    if (selectedRole === 'CMO') {
      setUsernameOrEmail('suriyachandru2006@gmail.com');
      setPassword('Suriya@2006');
    } else {
      if (usernameOrEmail === 'suriyachandru2006@gmail.com') {
        setUsernameOrEmail('');
        setPassword('');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!usernameOrEmail || !password) {
      addToast('Please enter your username or email address and password.', 'warning', 'Missing Fields');
      return;
    }

    if (role === 'DOCTOR') {
      setVerifyingCredentials(true);
      try {
        const res = await axios.post('/api/auth/verify-doctor', { usernameOrEmail, password });
        if (res.data.success) {
          setDoctorName(res.data.doctorName || usernameOrEmail);
          addToast('Credentials verified! Please align your face to authorize login.', 'info', 'Step 1 Verified');
          setShowDoctorFaceModal(true);
        }
      } catch (err) {
        addToast(err.response?.data?.message || 'Doctor login failed. Check username and password.', 'danger', 'Verification Failed');
      } finally {
        setVerifyingCredentials(false);
      }
      return;
    }

    // Standard Login for CMO and Admin
    const res = await login(usernameOrEmail, password, role);
    if (res?.success) {
      addToast(`Welcome back! Logged in as ${res.role}`, 'success', 'Login Successful');
      if (res.role === 'CMO') navigate('/cmo');
      else if (res.role === 'ADMIN') navigate('/admin');
    } else {
      addToast(res?.message || 'Invalid login credentials.', 'danger', 'Authentication Failed');
    }
  };

  const handleFaceCapturedForLogin = async (liveFaceData) => {
    addToast('Verifying facial biometric structure...', 'info');
    const res = await doctorFaceLogin(usernameOrEmail, password, liveFaceData);
    if (res?.success) {
      addToast(res.message || 'Biometric Face Verified!', 'success', 'Access Granted');
      setShowDoctorFaceModal(false);
      navigate('/doctor');
    } else {
      addToast(res?.message || 'Biometric verification rejected. Face mismatch.', 'danger', 'Biometric Rejected');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0F172A] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glowing Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-500/15 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />

      {/* Biometric Doctor Face Scanner Modal */}
      <FaceScannerModal
        isOpen={showDoctorFaceModal}
        onClose={() => setShowDoctorFaceModal(false)}
        title="Doctor Biometric Authentication"
        subtitle={`Align face inside guide frame to authorize portal access for Dr. ${doctorName}`}
        onCapture={handleFaceCapturedForLogin}
      />

      {/* Forgot Password OTP Reset Modal */}
      <ForgotPasswordModal
        isOpen={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
      />

      <motion.div
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 rounded-3xl border border-slate-700/60 bg-[#1E293B]/70 backdrop-blur-xl shadow-2xl overflow-hidden z-10"
      >
        {/* Left Graphics Panel */}
        <div className="lg:col-span-5 bg-gradient-to-br from-blue-900/40 via-slate-900/80 to-slate-950 p-8 lg:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-700/60 relative overflow-hidden">
          <div className="space-y-6 z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400 shadow-glow-blue">
                <Hospital className="w-7 h-7" />
              </div>
              <div>
                <span className="text-xs font-semibold text-blue-400 tracking-wider uppercase">Govt. Public Health Services</span>
                <h2 className="text-xl font-extrabold text-white tracking-tight">GeoAttendance SaaS</h2>
              </div>
            </div>

            <div className="space-y-3 pt-4">
              <h3 className="text-2xl font-bold text-slate-100 leading-snug">
                Precision Geofenced & Biometric Attendance
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Enterprise shift checkpoint tracking, real-time OpenStreetMap boundary enforcement, dynamic countdown windows, and mandatory AI facial recognition.
              </p>
            </div>

            {/* Features Bullet List */}
            <div className="space-y-2.5 pt-2 text-xs">
              <div className="flex items-center gap-2.5 text-slate-300">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <Camera className="w-3 h-3" />
                </div>
                <span>2-Step Biometric Face Recognition for Doctors</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-300">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                  <KeyRound className="w-3 h-3" />
                </div>
                <span>Admin OTP Email Password Reset Workflow</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-300">
                <div className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3" />
                </div>
                <span>Haversine GPS Radius & Audit Log</span>
              </div>
            </div>
          </div>

          {/* System Role Selector Info */}
          <div className="pt-8 z-10 space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Active Portal Selection:
            </span>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/60 text-xs">
              <div className="font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {role} Login Portal
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {role === 'CMO' && 'State Chief Medical Officer Access'}
                {role === 'ADMIN' && 'Hospital PHC Administrator Access (Includes OTP Password Reset)'}
                {role === 'DOCTOR' && 'Medical Doctor Biometric Portal (Credentials + Face Recognition)'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="lg:col-span-7 p-8 lg:p-12 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Portal Authentication</h2>
              <p className="text-xs text-slate-400 mt-1">Select your designated system role to continue.</p>
            </div>

            {/* Role Selection Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900/80 rounded-2xl border border-slate-700/80">
              <button
                type="button"
                onClick={() => handleRoleSelect('CMO')}
                className={`py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  role === 'CMO' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5" /> CMO
              </button>
              <button
                type="button"
                onClick={() => handleRoleSelect('ADMIN')}
                className={`py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  role === 'ADMIN' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5" /> Admin
              </button>
              <button
                type="button"
                onClick={() => handleRoleSelect('DOCTOR')}
                className={`py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  role === 'DOCTOR' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <User className="w-3.5 h-3.5" /> Doctor
              </button>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  {role === 'DOCTOR' ? 'Doctor Username or Email' : 'Username or Email Address'}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    placeholder={role === 'DOCTOR' ? "e.g. doctor_username or email" : "Enter email or username"}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">Password</label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPasswordModal(true)}
                    className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 transition-all"
                  >
                    <KeyRound className="w-3 h-3" /> Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter account password"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-900/60 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0"
                  />
                  <span>Remember session</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || verifyingCredentials}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-glow-blue flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {verifyingCredentials
                  ? 'Verifying Credentials...'
                  : loading
                  ? 'Authenticating...'
                  : role === 'DOCTOR'
                  ? 'Proceed to Biometric Face Scan'
                  : `Sign In to ${role} Portal`}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
