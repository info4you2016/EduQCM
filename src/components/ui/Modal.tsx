import React from 'react';
import { motion } from 'motion/react';
import { XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
  headerActions?: React.ReactNode;
}

export const Modal = ({ 
  title, 
  children, 
  onClose, 
  maxWidth = "max-w-lg", 
  headerActions 
}: ModalProps) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-md"
      onClick={(e: React.MouseEvent) => e.target === e.currentTarget && onClose()}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", damping: 30, stiffness: 400 }}
        className={cn(
          "bg-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] w-full overflow-hidden flex flex-col",
          "h-full sm:h-auto max-h-screen sm:max-h-[90vh]",
          "rounded-none sm:rounded-[2.5rem]",
          maxWidth
        )}
      >
        <div className="px-5 sm:px-8 py-4 sm:py-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white z-10">
          <div className="flex items-center gap-3 sm:gap-4 truncate pr-4">
            <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight truncate">{title}</h3>
            {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
          </div>
          <button 
            onClick={onClose} 
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all active:scale-90 shrink-0"
          >
            <XCircle className="w-5 h-5 sm:w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto w-full overflow-x-hidden custom-scrollbar relative">
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
};
