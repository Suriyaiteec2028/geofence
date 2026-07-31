import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';

export const ToastContainer = () => {
  const { toasts, removeToast } = useNotification();

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />;
      case 'danger':
      case 'error':
        return <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />;
      default:
        return <Info className="w-5 h-5 text-sky-400 flex-shrink-0" />;
    }
  };

  const getBorderColor = (type) => {
    switch (type) {
      case 'success':
        return 'border-emerald-500/40 bg-emerald-950/80 text-emerald-100';
      case 'warning':
        return 'border-amber-500/40 bg-amber-950/80 text-amber-100';
      case 'danger':
      case 'error':
        return 'border-rose-500/40 bg-rose-950/80 text-rose-100';
      default:
        return 'border-sky-500/40 bg-sky-950/80 text-sky-100';
    }
  };

  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-none px-4">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            transition={{ duration: 0.25 }}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-2xl ${getBorderColor(toast.type)}`}
          >
            {getIcon(toast.type)}
            <div className="flex-1">
              {toast.title && <h4 className="font-semibold text-sm mb-0.5">{toast.title}</h4>}
              <p className="text-xs leading-relaxed opacity-90">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="opacity-70 hover:opacity-100 transition-opacity p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
