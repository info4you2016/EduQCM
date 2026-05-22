import React from 'react';
import { cn } from '../../lib/utils';
import { LucideIcon } from 'lucide-react';

interface InputProps {
  label?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  icon?: LucideIcon;
  className?: string;
  [key: string]: any;
}

export const Input = ({ 
  label, 
  value, 
  onChange, 
  type = 'text', 
  placeholder,
  required = false,
  icon: Icon,
  className,
  ...props
}: InputProps) => (
  <div className={cn("space-y-1.5", className)}>
    {label && <label className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">{label}</label>}
    <div className="relative">
      {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />}
      <input
        type={type}
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className={cn(
          "w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl focus:outline-none focus:bg-white focus:border-indigo-500/30 ring-indigo-500/10 focus:ring-4 transition-all duration-300 font-medium placeholder:text-slate-300",
          Icon && "pl-11"
        )}
        {...props}
      />
    </div>
  </div>
);
