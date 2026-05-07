import React from 'react';
import { AlertCircle, LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  message: string;
  icon?: LucideIcon;
}

export const EmptyState = ({ message, icon: Icon = AlertCircle }: EmptyStateProps) => {
  return (
    <div className="p-12 text-center border-2 border-dashed border-slate-200/60 rounded-[2rem] bg-white/50 backdrop-blur-sm flex flex-col items-center">
      <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-slate-300" />
      </div>
      <p className="text-slate-500 font-medium max-w-[200px] leading-relaxed">{message}</p>
    </div>
  );
};
