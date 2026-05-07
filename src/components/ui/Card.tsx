import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  key?: React.Key;
}

export const Card = ({ children, className, onClick, ...props }: CardProps) => (
  <div 
    onClick={onClick}
    className={cn(
      'bg-white rounded-[2rem] border border-slate-200/50 shadow-subtle transition-all duration-500',
      onClick && 'cursor-pointer hover:shadow-deep hover:-translate-y-1 active:scale-[0.99]',
      className
    )}
    {...props}
  >
    {children}
  </div>
);
