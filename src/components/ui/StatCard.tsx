import React from 'react';
import { cn } from '../../lib/utils';
import { Card } from './Card';

import { AlertCircle, LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  color?: 'indigo' | 'amber' | 'emerald' | 'violet' | 'rose';
}

export const StatCard = ({ title, value, subValue, icon: Icon, color = 'indigo' }: StatCardProps) => {
  const colors = {
    indigo: 'bg-indigo-50 border-indigo-100 text-indigo-600',
    amber: 'bg-amber-50 border-amber-100 text-amber-600',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-600',
    violet: 'bg-violet-50 border-violet-100 text-violet-600',
    rose: 'bg-rose-50 border-rose-100 text-rose-600'
  };

  return (
    <Card className="p-6 relative overflow-hidden group border-none shadow-xl shadow-slate-200/40">
      <div className={cn("absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-10 transition-transform duration-700 group-hover:scale-150", colors[color])} />
      <div className="relative flex items-center gap-5">
        <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center border-2 shrink-0 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6", colors[color])}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <h4 className="text-2xl font-black text-slate-900 tracking-tight font-display">{value}</h4>
          </div>
          {subValue && (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{subValue}</p>
          )}
        </div>
      </div>
    </Card>
  );
};
