import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KeyRound, ShieldAlert, CheckCircle2, Clock, RefreshCw, X, AlertCircle } from 'lucide-react';

export const OTPVerificationModal = ({
  isOpen,
  onClose,
  email,
  title = "Security OTP Verification Required",
  subtitle,
  onVerify,
  onResend,
  loading = false,
  attemptsLeft,
  cooldownSeconds = 60
}) => {
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(cooldownSeconds);
  const [resending, setResending] = useState(false);
  const inputRef = useRef(null);

  // Auto-focus OTP input field when modal opens
  useEffect(() => {
    if (isOpen) {
      setOtp('');
      setCooldown(cooldownSeconds);
      // Timeout to ensure DOM animation & portal render complete before focusing
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, cooldownSeconds]);

  // Resend Cooldown Countdown Ticker
  useEffect(() => {
    let timer;
    if (isOpen && cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen, cooldown]);

  if (!isOpen) return null;

  const handleFormSubmit = (e) => {
    if (e) e.preventDefault();
    if (!otp || otp.trim().length !== 6) return;
    onVerify(otp.trim());
  };

  const handleResendClick = async () => {
    if (cooldown > 0 || resending || loading) return;
    setResending(true);
    try {
      if (onResend) {
        await onResend();
      }
      setCooldown(cooldownSeconds);
      setOtp('');
    } catch (err) {
      console.error('Resend OTP error:', err);
    } finally {
      setResending(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md bg-[#1E293B] border border-blue-500/40 rounded-3xl p-6 shadow-2xl space-y-5 text-white relative overflow-hidden my-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>
                <p className="text-[11px] text-slate-400">
                  {subtitle || (email ? `Sent to registered email (${email})` : 'Enter the 6-digit security code')}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="text-slate-400 hover:text-white transition-all text-xs w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Info Banner */}
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-700/80 space-y-2 text-xs">
            {email && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Target Inbox:</span>
                <span className="font-bold text-blue-300 font-mono">{email}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-slate-800/80 pt-2">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" /> Resend Cooldown:
              </span>
              <span className={`font-bold ${cooldown > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {cooldown > 0 ? `${cooldown}s` : 'Ready to Resend'}
              </span>
            </div>
            {attemptsLeft !== undefined && (
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-2">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400" /> Security Attempts:
                </span>
                <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${attemptsLeft > 1 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                  {attemptsLeft} / 3 Attempts Left
                </span>
              </div>
            )}
          </div>

          {/* OTP Verification Form */}
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Enter 6-Digit Security OTP
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={inputRef}
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-blue-500/40 rounded-xl text-lg font-mono font-bold tracking-widest text-center text-emerald-400 placeholder-slate-600 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              {onResend && (
                <button
                  type="button"
                  onClick={handleResendClick}
                  disabled={cooldown > 0 || resending || loading}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-40"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                  {cooldown > 0 ? `${cooldown}s` : 'Resend'}
                </button>
              )}

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className={`${onResend ? 'w-2/3' : 'w-full'} py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-glow-emerald flex items-center justify-center gap-1.5 transition-all disabled:opacity-50`}
              >
                {loading ? 'Verifying OTP...' : 'Verify OTP Code'}
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
