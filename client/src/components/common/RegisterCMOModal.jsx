import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Mail, KeyRound, Lock, User, ArrowRight, RefreshCw, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useNavigate } from 'react-router-dom';

export const RegisterCMOModal = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: Set Password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // OTP Cooldown & Attempt Limit States
  const [cooldown, setCooldown] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [loading, setLoading] = useState(false);

  const { addToast } = useNotification();
  const navigate = useNavigate();

  // Cooldown Countdown Ticker
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  if (!isOpen) return null;

  const handleResetModal = () => {
    setStep(1);
    setEmail('');
    setOtp('');
    setFullName('');
    setPassword('');
    setConfirmPassword('');
    setCooldown(0);
    setAttemptsLeft(3);
    setLoading(false);
    onClose();
  };

  // Step 1: Send OTP to Email
  const handleSendOTP = async (e) => {
    if (e) e.preventDefault();
    if (!email || !email.includes('@')) {
      addToast('Please enter a valid official email address.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/auth/cmo-request-otp', { email });
      if (res.data.success) {
        addToast(res.data.message || 'OTP verification code sent to your email inbox.', 'success', 'OTP Dispatched');
        setStep(2);
        setCooldown(res.data.cooldownSeconds || 60);
        setAttemptsLeft(3);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send OTP code.';
      addToast(msg, 'danger', 'OTP Request Failed');
      if (err.response?.status === 429) {
        setCooldown(err.response?.data?.cooldownSeconds || 60);
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Resend OTP (Respects 60-Second Cooldown)
  const handleResendOTP = async () => {
    if (cooldown > 0) return;
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/cmo-request-otp', { email });
      if (res.data.success) {
        addToast(`New verification OTP code sent to ${email}`, 'success', 'OTP Resent');
        setCooldown(res.data.cooldownSeconds || 60);
        setAttemptsLeft(3);
        setOtp('');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to resend OTP.';
      addToast(msg, 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP (Max 3 Attempts Enforcement)
  const handleVerifyOTP = async (e) => {
    if (e) e.preventDefault();
    if (!otp || otp.length < 6) {
      addToast('Please enter the 6-digit OTP code received in your email.', 'warning');
      return;
    }

    if (attemptsLeft <= 0) {
      addToast('Maximum 3 invalid attempts reached. Please wait for cooldown to request a new OTP.', 'danger', 'Attempts Exceeded');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/auth/cmo-verify-otp', { email, otp });
      if (res.data.success) {
        addToast('OTP Verified Successfully! Please set up your Master CMO credentials.', 'success', 'OTP Verified');
        setStep(3);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid OTP code.';
      const remaining = err.response?.data?.attemptsLeft !== undefined ? err.response.data.attemptsLeft : (attemptsLeft - 1);
      setAttemptsLeft(remaining);
      addToast(msg, 'danger', `Verification Failed (${remaining}/3 Remaining)`);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Complete CMO Registration & Sign In
  const handleCompleteRegistration = async (e) => {
    if (e) e.preventDefault();
    if (!fullName || !password) {
      addToast('Please enter your full name and password.', 'warning');
      return;
    }

    if (password !== confirmPassword) {
      addToast('Passwords do not match. Please verify your password entry.', 'warning', 'Password Mismatch');
      return;
    }

    if (password.length < 6) {
      addToast('Password must be at least 6 characters long.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/auth/cmo-register', {
        name: fullName,
        email,
        otp,
        password
      });

      if (res.data.success) {
        addToast(res.data.message || 'Master CMO account registered successfully!', 'success', 'CMO Account Active');
        if (res.data.token) {
          localStorage.setItem('geo_auth_token', res.data.token);
          localStorage.setItem('geo_user_role', 'CMO');
        }
        handleResetModal();
        navigate('/cmo');
        window.location.reload();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to complete CMO registration.';
      addToast(msg, 'danger', 'Registration Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-[#1E293B] border border-purple-500/30 rounded-3xl p-6 shadow-2xl space-y-5 text-white relative overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Register Master CMO Account</h3>
              <p className="text-[10px] text-slate-400">Live Email OTP Security Verification Workflow</p>
            </div>
          </div>
          <button
            onClick={handleResetModal}
            className="text-slate-400 hover:text-white transition-all text-xs w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Step Indicator Progress Bar */}
        <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold">
          <div className={`py-1.5 rounded-lg border transition-all ${step >= 1 ? 'bg-purple-600/30 border-purple-500 text-purple-300' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
            1. Email ID
          </div>
          <div className={`py-1.5 rounded-lg border transition-all ${step >= 2 ? 'bg-purple-600/30 border-purple-500 text-purple-300' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
            2. Live OTP
          </div>
          <div className={`py-1.5 rounded-lg border transition-all ${step >= 3 ? 'bg-purple-600/30 border-purple-500 text-purple-300' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
            3. Set Password
          </div>
        </div>

        {/* STEP 1: ENTER EMAIL ID */}
        {step === 1 && (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/20 text-xs text-purple-200 leading-relaxed">
              Enter your official email address to receive a live 6-digit OTP verification code for Master CMO activation.
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">CMO Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. suriyachandru2006@gmail.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-glow-purple flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? 'Sending Live OTP Email...' : 'Send Live OTP Email'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* STEP 2: VERIFY OTP & ATTEMPT COUNTDOWN */}
        {step === 2 && (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-700/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Target Email:</span>
                <span className="font-bold text-purple-300">{email}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                <span className="text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" /> Resend Cooldown:
                </span>
                <span className={`font-bold ${cooldown > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {cooldown > 0 ? `${cooldown}s` : 'Ready to Resend'}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                <span className="text-slate-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400" /> Attempts Left:
                </span>
                <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${attemptsLeft > 1 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                  {attemptsLeft} / 3 Attempts
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Enter 6-Digit OTP Code</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 123456"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-center text-base font-mono font-bold tracking-widest text-emerald-400 placeholder-slate-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={cooldown > 0 || loading}
                className="w-1/3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center justify-center gap-1 transition-all disabled:opacity-40"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                {cooldown > 0 ? `${cooldown}s` : 'Resend OTP'}
              </button>

              <button
                type="submit"
                disabled={loading || otp.length < 6 || attemptsLeft <= 0}
                className="w-2/3 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-glow-purple flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify OTP Code'}
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: SETUP USERNAME & PASSWORD */}
        {step === 3 && (
          <form onSubmit={handleCompleteRegistration} className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span>Email verified! Create your Master CMO login credentials below.</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Dr. Suriya N (Chief Medical Officer)"
                  className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Login Username / Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  disabled
                  value={email}
                  className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-purple-300 font-semibold cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Account Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create strong account password"
                  className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Confirm Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter account password"
                  className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !fullName || !password}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-glow-purple flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? 'Completing Registration...' : 'Complete CMO Registration & Sign In'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};
