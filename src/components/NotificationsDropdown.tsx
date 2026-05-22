import React, { useState, useRef, useEffect } from 'react';
import { Bell, ClipboardList, Clock, X, Check, Plus, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Notification, UserProfile } from '../types';
import { cn } from '../lib/utils';
import { Card } from './ui/Card';
import { api } from '../lib/api';

interface NotificationsDropdownProps {
  notifications: Notification[];
  user?: UserProfile | null;
  onRefresh?: () => void;
  onAddNotification?: () => void;
  onManageNotifications?: () => void;
  className?: string;
}

export const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({ 
  notifications = [], 
  user,
  onRefresh, 
  onAddNotification,
  onManageNotifications,
  className 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isTeacher = user?.role === 'teacher';

  const unreadNotifications = (notifications || []).filter(n => !n.read);
  const unreadCount = unreadNotifications.length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative w-12 h-12 rounded-[1.25rem] flex items-center justify-center transition-all group",
          isOpen ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "bg-slate-50 border border-slate-100 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100"
        )}
      >
        <Bell className={cn("w-5 h-5 transition-transform", isOpen ? "scale-110" : "group-hover:scale-110")} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white animate-bounce-short">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute right-0 mt-4 w-80 md:w-96 max-h-[500px] bg-white rounded-[2rem] shadow-2xl border border-slate-100 z-50 overflow-hidden"
          >
            <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest leading-none">Annonces</h3>
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{unreadCount} nouvelles annonces</p>
              </div>
              <div className="flex items-center gap-2">
                {isTeacher && (
                  <button 
                    onClick={() => { setIsOpen(false); onAddNotification?.(); }}
                    className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                    title="Nouvelle annonce"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
                <button 
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 transition-colors"
                  title="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[380px] p-4 space-y-3 custom-scrollbar">
              {(notifications || []).length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Bell className="w-8 h-8 text-slate-200" />
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aucune annonce</p>
                </div>
              ) : (
                (notifications || []).map((notif) => (
                  <Card 
                    key={notif.id} 
                    className={cn(
                      "p-4 border-2 transition-all hover:bg-slate-50/50 cursor-default relative overflow-hidden",
                      notif.type === 'exam' ? "border-indigo-50 bg-indigo-50/5" : "border-slate-50",
                      !notif.read && "border-indigo-200 bg-indigo-50/10 shadow-sm"
                    )}
                    onClick={async () => {
                      if (!notif.read) {
                        try {
                          await api.notifications.markRead(notif.id);
                          onRefresh?.();
                        } catch (err) {
                          console.error("Error marking as read:", err);
                        }
                      }
                    }}
                  >
                    {!notif.read && (
                      <div className="absolute top-0 right-0 w-2 h-2 bg-indigo-600 rounded-bl-lg" />
                    )}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {notif.type === 'exam' ? (
                          <ClipboardList className="w-3.5 h-3.5 text-indigo-600" />
                        ) : (
                          <Bell className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        <span className={cn(
                          "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded",
                          notif.type === 'exam' ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"
                        )}>
                          {notif.type === 'exam' ? 'Examen' : 'Annonce'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-300">
                        <Clock className="w-3 h-3" />
                        <span className="text-[9px] font-black uppercase tracking-widest">
                          {new Date(notif.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                    </div>
                    <h4 className="font-black text-slate-900 text-xs mb-1 leading-tight">{notif.title}</h4>
                    <div 
                      className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed" 
                      dangerouslySetInnerHTML={{ __html: notif.content }} 
                    />
                  </Card>
                ))
              )}
            </div>

            {(unreadCount > 0 || isTeacher) && (
              <div className="p-4 border-t border-slate-50 bg-slate-50/30 flex flex-col gap-2">
                {unreadCount > 0 && (
                  <button 
                    disabled={markingAll}
                    onClick={async () => {
                      setMarkingAll(true);
                      try {
                        await api.notifications.markAllRead();
                        onRefresh?.();
                      } catch (err) {
                        console.error("Error marking all as read:", err);
                      } finally {
                        setMarkingAll(false);
                      }
                    }}
                    className="w-full py-3 text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] hover:bg-white rounded-xl transition-all border border-transparent hover:border-indigo-100 shadow-sm active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {markingAll ? (
                      <div className="w-3 h-3 border-2 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                    Tout marquer comme lu
                  </button>
                )}
                
                {isTeacher && (
                  <button 
                    onClick={() => { setIsOpen(false); onManageNotifications?.(); }}
                    className="w-full py-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-100 shadow-sm active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Settings className="w-3 h-3" />
                    Gérer les annonces
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
