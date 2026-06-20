import React, { createContext, useContext, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, AlertCircle, HelpCircle, X } from 'lucide-react';
import { Button } from './Button';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
}

interface ConfirmState {
  isOpen: boolean;
  options: ConfirmOptions;
  resolve: ((value: boolean) => void) | null;
}

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};

export const ConfirmProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<ConfirmState>({
    isOpen: false,
    options: { title: '', message: '' },
    resolve: null,
  });

  const confirm = (options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({
        isOpen: true,
        options,
        resolve,
      });
    });
  };

  const handleConfirm = () => {
    if (state.resolve) state.resolve(true);
    setState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  };

  const handleCancel = () => {
    if (state.resolve) state.resolve(false);
    setState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  };

  const { options, isOpen } = state;
  const { title, message, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', variant = 'primary' } = options;

  // Visual assets configuration based on variant
  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-rose-600" />,
          iconBg: 'bg-rose-50 border border-rose-100',
          confirmBtnClass: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-100',
          accentBorder: 'border-t-4 border-rose-500',
        };
      case 'warning':
        return {
          icon: <AlertCircle className="w-6 h-6 text-amber-600" />,
          iconBg: 'bg-amber-50 border border-amber-100',
          confirmBtnClass: 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-100',
          accentBorder: 'border-t-4 border-amber-500',
        };
      case 'primary':
      default:
        return {
          icon: <HelpCircle className="w-6 h-6 text-blue-600" />,
          iconBg: 'bg-blue-50 border border-blue-100',
          confirmBtnClass: 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-200',
          accentBorder: 'border-t-4 border-slate-900',
        };
    }
  };

  const currentStyles = getVariantStyles();

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm">
            {/* Backdrop cover */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
              onClick={handleCancel}
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className={`relative bg-white w-full max-w-md rounded-3xl shadow-[0_32px_64px_-16px_rgba(15,23,42,0.18)] border border-slate-100 overflow-hidden ${currentStyles.accentBorder} z-10`}
            >
              {/* Top Close Button */}
              <button
                onClick={handleCancel}
                className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex gap-4">
                  {/* Decorative Icon Wrapper */}
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${currentStyles.iconBg}`}>
                    {currentStyles.icon}
                  </div>

                  {/* Content */}
                  <div className="space-y-2">
                    <h3 className="text-lg font-black text-slate-900 tracking-tight leading-none leading-tight">
                      {title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed font-medium">
                      {message}
                    </p>
                  </div>
                </div>

                {/* Actions Panel */}
                <div className="flex gap-3 justify-end pt-2">
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    className="text-xs uppercase font-black tracking-widest text-slate-500 hover:text-slate-800 hover:bg-slate-50 px-5 py-3 rounded-2xl border-slate-200 transition-all active:scale-95"
                  >
                    {cancelLabel}
                  </Button>
                  <Button
                    onClick={handleConfirm}
                    className={`text-xs uppercase font-black tracking-widest px-5 py-3 rounded-2xl shadow-lg hover:shadow-none transition-all duration-200 active:scale-95 ${currentStyles.confirmBtnClass}`}
                  >
                    {confirmLabel}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
};
