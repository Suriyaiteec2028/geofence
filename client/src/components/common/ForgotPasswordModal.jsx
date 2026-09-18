import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Modal } from './Modal';
import { useNotification } from '../../context/NotificationContext';
import { Mail, KeyRound, Lock, Eye, EyeOff, CheckCircle2, ArrowRight, ShieldCheck, RefreshCw, Clock } from 'lucide-react';

export const ForgotPasswordModal = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // OTP Cooldown State
  const [cooldown, setCooldown] = useState(0);

  const { addToast } = useNotification();
  const otpInputRef = useRef(null);

  // Cooldown Countdown Ticker
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  // Auto-focus OTP input when moving to Step 2
  useEffect(() => {
    if (step === 2) {
      const timer = setTimeout(() => {
        if (otpInputRef.current) {
          otpInputRef.current.focus();
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const handleClose = () => {
    setStep(1);
    setEmail('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setCooldown(0);
    setSubmitting(false);
    onClose();
  };

  // Step 1: Request 6-Digit OTP
  const handleRequestOTP = async (e) => {
    if (e) e.preventDefault();
    if (!email || !email.includes('@')) {
      addToast('Please enter a valid registered email address.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post('/api/auth/request-otp', { email });
      if (res.data.success) {
        addToast(res.data.message || 'OTP verification code sent to your email!', 'success', 'OTP Sent');
        setStep(2);
        setCooldown(60);
        setOtp('');
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to send OTP code. Check email address.', 'danger', 'Request Failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: Resend OTP
  const handleResendOTP = async () => {
    if (cooldown > 0 || submitting) return;
    setSubmitting(true);
    try {
      const res = await axios.post('/api/auth/request-otp', { email });
      if (res.data.success) {
        addToast(`New verification OTP code sent to ${email}`, 'success', 'OTP Resent');
        setCooldown(60);
        setOtp('');
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to resend OTP code.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: Verify 6-Digit OTP
  const handleVerifyOTP = async (e) => {
    if (e) e.preventDefault();
    if (!otp || otp.trim().length !== 6) {
      addToast('Please enter the 6-digit OTP code sent to your email.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post('/api/auth/verify-otp', { email, otp });
      if (res.data.success) {
        addToast('OTP Code Verified! Please enter your new password.', 'success', 'OTP Verified');
        setStep(3);
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Invalid or expired OTP code.', 'danger', 'Verification Failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e) => {
    if (e) e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      addToast('New password must be at least 6 characters long.', 'warning');
      return;
    }

    if (newPassword !== confirmPassword) {
      addToast('Passwords do not match. Please re-enter your password.', 'danger', 'Mismatch');
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post('/api/auth/reset-password', { email, otp, newPassword });
      if (res.data.success) {
        addToast('Password updated successfully! You can now log in with your new password.', 'success', 'Password Changed');
        handleClose();
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Error updating password.', 'danger', 'Reset Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Account Password Reset & Security OTP"
      maxWidth="max-w-md"
    >
      <div className="space-y-5">
        {/* Step Indicator Badges */}
        <div className="flex items-center justify-between px-2 py-1 bg-slate-900/80 rounded-xl border border-slate-800 text-[11px] font-bold text-slate-400">
          <span className={`px-2.5 py-1 rounded-lg transition-all ${step === 1 ? 'bg-blue-600 text-white' : step > 1 ? 'text-emerald-400' : ''}`}>
            1. Email
          </span>
          <span>➔</span>
          <span className={`px-2.5 py-1 rounded-lg transition-all ${step === 2 ? 'bg-blue-600 text-white shadow-glow-blue' : step > 2 ? 'text-emerald-400' : ''}`}>
            2. Verify OTP
          </span>
          <span>➔</span>
          <span className={`px-2.5 py-1 rounded-lg transition-all ${step === 3 ? 'bg-emerald-600 text-white' : ''}`}>
            3. New Password
          </span>
        </div>

        {/* STEP 1: Enter Registered Email */}
        {step === 1 && (
          <form onSubmit={handleRequestOTP} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/30 text-xs text-blue-300 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-blue-200">
                <ShieldCheck className="w-4 h-4 text-blue-400" /> Account Security Verification
              </span>
              <p>Enter the registered email address for your Doctor, Admin, or CMO account.</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Registered Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. doctor@gmail.com or admin@hospital.gov.in"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-glow-blue flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? 'Sending OTP Code...' : 'Send 6-Digit Security OTP Email'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* STEP 2: Active Foreground OTP Verification */}
        {step === 2 && (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-300 space-y-1.5">
              <span className="font-bold flex items-center gap-1.5 text-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> OTP Sent Successfully!
              </span>
              <p className="leading-relaxed">We sent a 6-digit security OTP to <strong className="text-white font-mono">{email}</strong>. Check your email inbox.</p>
              <div className="flex items-center justify-between text-[11px] pt-1 text-slate-400 border-t border-emerald-500/20">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" /> Cooldown:
                </span>
                <span className={`font-bold ${cooldown > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {cooldown > 0 ? `${cooldown}s` : 'Ready to Resend'}
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Enter 6-Digit OTP Code</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={otpInputRef}
                  type="text"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-emerald-500/50 rounded-xl text-lg font-mono font-bold tracking-widest text-center text-emerald-400 placeholder-slate-600 focus:border-emerald-400 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={cooldown > 0 || submitting}
                className="w-1/3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center justify-center gap-1 transition-all disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${submitting ? 'animate-spin' : ''}`} />
                {cooldown > 0 ? `${cooldown}s` : 'Resend'}
              </button>

              <button
                type="submit"
                disabled={submitting || otp.length !== 6}
                className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-glow-emerald flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                {submitting ? 'Verifying OTP...' : 'Verify OTP Code'}
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Set New Password */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-1">
              <span className="font-bold text-white block">Create New Password</span>
              <p className="text-[11px] text-slate-400">Set your new password below for account <strong className="text-slate-200">{email}</strong>.</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">New Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min. 6 chars)"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
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

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Confirm New Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-glow-blue flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? 'Updating Password...' : 'Confirm & Change Password'}
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
};
