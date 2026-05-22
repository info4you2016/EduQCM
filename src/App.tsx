import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LogOut, 
  BookOpen,
  Menu,
  X,
  User,
  LayoutDashboard,
  ClipboardList,
  History,
  Users,
  Database,
  Sparkles,
  Settings
} from 'lucide-react';
import { api, socket } from './lib/api';
import { cn } from './lib/utils';
import { UserProfile, Module, Exam, Result, Notification, Filiere, Group } from './types';

// UI Components
import { Button } from './components/ui/Button';

// Dashboard Views
import { TeacherDashboard } from './components/views/TeacherDashboard';
import { StudentDashboard } from './components/views/StudentDashboard';
import { ExamView } from './components/views/ExamView';
import { AuthView } from './components/views/AuthView';
import { ProfileModal } from './components/modals/ProfileModal';
import { NotificationsDropdown } from './components/NotificationsDropdown';
import { Modal } from './components/ui/Modal';
import { AddNotificationForm } from './components/forms/AddNotificationForm';
import { Toaster } from 'react-hot-toast';
import { useAppStore } from './store/useAppStore';

export default function App() {
  const {
    user,
    setUser,
    view,
    setView,
    activeExam,
    setActiveExam,
    checkAuth,
    logout,
    loadingAuth
  } = useAppStore();

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isAddingNotification, setIsAddingNotification] = useState(false);
  const [activeTeacherTab, setActiveTeacherTab] = useState<string>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Data states
  const [modules, setModules] = useState<Module[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filieres, setFilieres] = useState<Filiere[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [studentCount, setStudentCount] = useState(0);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      // Use individual try-catch for each data fetch to avoid blocking everything if one fails
      const fetchWithTimeout = async <T extends any>(promise: Promise<T>, fallback: T): Promise<T> => {
        try {
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
          );
          return await Promise.race([promise, timeoutPromise]) as T;
        } catch (err) {
          console.warn('Individual fetch failed:', err);
          return fallback;
        }
      };

      const [modulesData, examsData, resultsData, notificationsData, filieresData, groupsData] = await Promise.all([
        fetchWithTimeout(api.modules.list(), []),
        fetchWithTimeout(api.exams.list(), []),
        fetchWithTimeout(api.results.list(), []),
        fetchWithTimeout(api.notifications.list(), []),
        fetchWithTimeout(api.filieres.list(), []),
        fetchWithTimeout(api.groups.list(), [])
      ]);
      
      setModules(modulesData);
      setExams(examsData);
      setResults(resultsData);
      setNotifications(notificationsData);
      setFilieres(filieresData);
      setGroups(groupsData);

      if (user.role === 'teacher' || user.role === 'admin') {
        try {
          const countData = await api.admin.getStudentCount();
          setStudentCount(countData.count);
        } catch (e) {
          console.error("Failed to fetch student count:", e);
        }
      }
    } catch (error: any) {
      console.error("Global Error fetching data:", error);
    }
  }, [user]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (user) {
      fetchData();
      
      // Tell server about user to join rooms
      socket.emit("authenticate", user);
      
      const handleNotification = (notif: Notification) => {
        // Double check filtering on client side for safety
        if (user.role === 'teacher' || user.role === 'admin') {
          setNotifications(prev => [notif, ...prev]);
        } else {
          // If student, only accept global or group-specific
          if (!notif.groupId || notif.groupId === user.groupId) {
            setNotifications(prev => [notif, ...prev]);
          }
        }
      };
      
      const handleDataRefresh = () => {
        fetchData();
      };

      socket.on('notification', handleNotification);
      socket.on('data-update', handleDataRefresh);

      return () => {
        socket.off('notification', handleNotification);
        socket.off('data-update', handleDataRefresh);
      };
    }
  }, [user, fetchData]);

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em]">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthView onLogin={(u) => { setUser(u); setView('dashboard'); }} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Navigation Header */}
      {view !== 'exam' && (
        <>
          <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200/60">
            <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
              <div className="flex items-center gap-10">
                <div className="flex items-center gap-3 group cursor-pointer" onClick={() => { setActiveExam(null); setView('dashboard'); }}>
                  <div className="w-12 h-12 bg-indigo-600 rounded-[1.25rem] flex items-center justify-center shadow-lg shadow-indigo-200 group-hover:rotate-6 transition-transform">
                    <BookOpen className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">Excellence<span className="text-indigo-600">Pro</span></h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Plateforme d'Examen</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <NotificationsDropdown 
                  notifications={notifications} 
                  user={user}
                  onRefresh={fetchData} 
                  onAddNotification={() => setIsAddingNotification(true)}
                  onManageNotifications={() => {
                    setActiveTeacherTab('notifications');
                    setView('dashboard');
                  }}
                />
                
                {/* Desktop Profile & Logout */}
                <div className="hidden lg:flex items-center gap-4">
                  <div 
                    className="flex flex-col items-end mr-2 cursor-pointer hover:opacity-70 transition-opacity"
                    onClick={() => setShowProfileModal(true)}
                  >
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-none">
                        {user.role === 'teacher' ? 'Enseignant' : user.role === 'admin' ? 'Administrateur' : 'Étudiant'}
                        {user.registrationNumber && <span className="text-slate-400 ml-2">[{user.registrationNumber}]</span>}
                      </span>
                      <span className="text-sm font-bold text-slate-900 mt-1">{user.displayName}</span>
                      {(user.groupName || user.filiere) && (
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">
                          {user.groupName} {user.filiere && `• ${user.filiere}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={logout}
                    className="w-12 h-12 rounded-[1.25rem] bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-100 transition-all group"
                  >
                    <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  </button>
                </div>

                {/* Mobile Menu Button */}
                <button 
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="lg:hidden w-12 h-12 rounded-[1.25rem] bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-all"
                >
                  {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
              </div>
            </div>

          </header>

          <AnimatePresence>
            {isMobileMenuOpen && user && (
              <>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] lg:hidden"
                />
                <motion.div 
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className="fixed right-0 top-0 bottom-0 w-[280px] bg-white z-[70] shadow-2xl p-6 flex flex-col lg:hidden"
                >
                  <div className="flex items-center justify-between mb-10">
                    <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Menu</h2>
                    <button 
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-2 focus:outline-none">
                    <div 
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-100 cursor-pointer"
                      onClick={() => {
                        setShowProfileModal(true);
                        setIsMobileMenuOpen(false);
                      }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                          <User className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{user.role === 'teacher' ? 'Enseignant' : user.role === 'admin' ? 'Administrateur' : 'Étudiant'}</p>
                          <p className="text-sm font-bold text-slate-900 line-clamp-1">{user.displayName}</p>
                        </div>
                      </div>
                      <button className="w-full py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors text-left border-t border-slate-200 mt-2 pt-2">
                        Modifier le profil
                      </button>
                    </div>

                    <div className="space-y-8 pt-4 border-t border-slate-100">
                      {user.role === 'teacher' || user.role === 'admin' ? (
                        <>
                          {[
                            {
                              title: 'Pilotage',
                              items: [
                                { id: 'overview', label: 'Vue d\'ensemble', icon: LayoutDashboard },
                                { id: 'ai', label: 'Assistant IA', icon: Sparkles },
                              ]
                            },
                            {
                              title: 'Académique',
                              items: [
                                { id: 'modules', label: 'Modules', icon: BookOpen },
                                { id: 'exams', label: 'Examens', icon: ClipboardList },
                                { id: 'filieres', label: 'Filières', icon: Database },
                              ]
                            },
                            {
                              title: 'Suivi & Étudiants',
                              items: [
                                { id: 'results', label: 'Résultats', icon: History },
                                { id: 'groups', label: 'Groupes', icon: Users },
                              ]
                            },
                            {
                              title: 'Administration',
                              items: [
                                { id: 'users', label: 'Utilisateurs', icon: Users },
                                { id: 'system', label: 'Système', icon: LayoutDashboard },
                                { id: 'settings', label: 'Paramètres', icon: Settings },
                              ]
                            }
                          ].map((group) => (
                            <div key={group.title} className="space-y-2">
                              <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] ml-4 mb-2">{group.title}</p>
                              <div className="space-y-1">
                                {group.items.map((item) => (
                                  <button
                                    key={item.id}
                                    onClick={() => {
                                      setActiveTeacherTab(item.id);
                                      setView('dashboard');
                                      setIsMobileMenuOpen(false);
                                    }}
                                    className={cn(
                                      "w-full flex items-center gap-4 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                                      activeTeacherTab === item.id 
                                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                                        : "text-slate-500 hover:bg-slate-50 hover:text-indigo-600"
                                    )}
                                  >
                                    <item.icon className={cn("w-4 h-4", activeTeacherTab === item.id ? "text-white" : "text-slate-400")} />
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] ml-4 mb-2">Navigation</p>
                          <button
                            onClick={() => {
                              setView('dashboard');
                              setIsMobileMenuOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                              view === 'dashboard' 
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                                : "text-slate-500 hover:bg-slate-50 hover:text-indigo-600"
                            )}
                          >
                            <LayoutDashboard className={cn("w-4 h-4", view === 'dashboard' ? "text-white" : "text-slate-400")} />
                            Tableau de bord
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-auto pt-6 border-t border-slate-100">
                    <button 
                      onClick={async () => {
                        await logout();
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-rose-50 text-rose-600 font-black text-xs uppercase tracking-widest border border-rose-100 active:scale-95 transition-all"
                    >
                      <LogOut className="w-4 h-4" />
                      Déconnexion
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}

      <main className={cn("max-w-7xl mx-auto px-4 transition-all duration-500", view === 'exam' ? "py-8 md:py-12" : "py-12")}>
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="w-full"
            >
              {user.role === 'teacher' || user.role === 'admin' ? (
                <TeacherDashboard 
                  modules={modules} 
                  exams={exams} 
                  results={results} 
                  notifications={notifications}
                  filieres={filieres}
                  groups={groups}
                  studentCount={studentCount}
                  user={user}
                  onRefresh={fetchData}
                  activeTabOverride={activeTeacherTab}
                  onTabChange={setActiveTeacherTab}
                />
              ) : (
                <StudentDashboard 
                  exams={exams} 
                  results={results} 
                  modules={modules}
                  user={user}
                  onStartExam={(exam) => {
                    setActiveExam(exam);
                    setView('exam');
                  }}
                />
              )}
            </motion.div>
          )}

          {view === 'exam' && activeExam && (
            <motion.div
              key="exam-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full"
            >
              <ExamView 
                exam={activeExam} 
                user={user}
                moduleName={modules.find(m => m.id === activeExam.moduleId)?.name}
                onComplete={async () => {
                  await fetchData();
                  setView('dashboard');
                  setActiveExam(null);
                }}
                onCancel={() => {
                  setView('dashboard');
                  setActiveExam(null);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
      <Toaster position="top-right" />
      
      {showProfileModal && (
        <ProfileModal 
          user={user} 
          onClose={() => setShowProfileModal(false)} 
          onUpdate={(updatedUser) => setUser(updatedUser)} 
        />
      )}

      {isAddingNotification && (
        <Modal title="Publier une Annonce" onClose={() => setIsAddingNotification(false)}>
           <div className="p-5 sm:p-8">
             <AddNotificationForm user={user} groups={groups} onComplete={() => { setIsAddingNotification(false); fetchData(); }} />
           </div>
        </Modal>
      )}
    </div>
  );
}
