import React, { useState, useRef } from 'react';
import { Users, Shield, GraduationCap, MonitorPlay } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Card } from './ui/Card';

interface OnlineUser {
  id: number;
  displayName: string;
  email: string;
  role: string;
  lastActive: number;
}

interface OnlineUsersDropdownProps {
  onlineUsers: OnlineUser[];
  className?: string;
}

export const OnlineUsersDropdown: React.FC<OnlineUsersDropdownProps> = ({ 
  onlineUsers = [], 
  className 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 200); // 200ms delay to keep it smooth when moving between button and dropdown
  };

  return (
    <div 
      className={cn("relative", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className={cn(
          "relative w-12 h-12 rounded-[1.25rem] flex items-center justify-center transition-all duration-300 group outline-none",
          isOpen ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200" : "bg-slate-50 border border-slate-100 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-100"
        )}
        aria-label="Utilisateurs connectés"
      >
        <Users className={cn("w-5 h-5 transition-transform duration-300", isOpen ? "scale-110" : "group-hover:scale-110")} />
        
        {/* Real-time pulse indicator */}
        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 text-[9px] font-black text-white items-center justify-center">
            {onlineUsers.length}
          </span>
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 mt-3 w-72 md:w-80 bg-white rounded-[2rem] shadow-2xl border border-slate-100 z-50 overflow-hidden"
          >
            <div className="p-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest leading-none">Actifs sur la plateforme</h3>
                <p className="text-[10px] font-bold text-emerald-500 mt-1 uppercase tracking-wider flex items-center gap-1.5 leading-none">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  {onlineUsers.length} {onlineUsers.length > 1 ? 'utilisateurs en ligne' : 'utilisateur en ligne'}
                </p>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[320px] p-4 space-y-2 custom-scrollbar">
              {onlineUsers.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs font-semibold">
                  Il n'y a aucun utilisateur connecté.
                </div>
              ) : (
                onlineUsers.map((u) => {
                  let roleLabel = 'Étudiant';
                  let roleColor = 'bg-slate-50 border-slate-200 text-slate-500';
                  let RoleIcon = GraduationCap;

                  if (u.role === 'admin') {
                    roleLabel = 'Admin';
                    roleColor = 'bg-rose-50 border-rose-100 text-rose-600';
                    RoleIcon = Shield;
                  } else if (u.role === 'teacher') {
                    roleLabel = 'Tableau/Enseignant';
                    roleColor = 'bg-indigo-50 border-indigo-100 text-indigo-600';
                    RoleIcon = MonitorPlay;
                  }

                  const initials = u.displayName.trim().slice(0, 2).toUpperCase() || '??';

                  return (
                    <div 
                      key={u.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-slate-50 hover:bg-slate-50/70 hover:border-slate-100 transition-all duration-200"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200/50 flex items-center justify-center text-xs font-bold text-slate-600 select-none">
                            {initials}
                          </div>
                          <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate leading-tight">
                            {u.displayName}
                          </p>
                          <p className="text-[9px] text-slate-400 font-mono truncate leading-normal">
                            {u.email}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 border rounded-full text-[8px] font-black uppercase tracking-wider", roleColor)}>
                          <RoleIcon className="w-2.5 h-2.5" />
                          {roleLabel}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
