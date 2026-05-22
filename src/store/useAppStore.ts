import { create } from 'zustand';
import { UserProfile, Exam, LiveStudentSession, CheatAlertLog } from '../types';
import { api, socket } from '../lib/api';

interface AppState {
  // Authentication State
  user: UserProfile | null;
  loadingAuth: boolean;
  setUser: (user: UserProfile | null) => void;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;

  // Active Exam state
  view: 'dashboard' | 'exam';
  activeExam: Exam | null;
  setView: (view: 'dashboard' | 'exam') => void;
  setActiveExam: (exam: Exam | null) => void;

  // Real-time student supervision state
  supervisedSessions: LiveStudentSession[];
  alertsLog: CheatAlertLog[];
  soundEnabled: boolean;
  
  setSupervisedSessions: (sessions: LiveStudentSession[]) => void;
  setAlertsLog: (updater: CheatAlertLog[] | ((prev: CheatAlertLog[]) => CheatAlertLog[])) => void;
  clearAlertsLog: () => void;
  setSoundEnabled: (enabled: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Authentication
  user: null,
  loadingAuth: true,
  setUser: (user) => set({ user }),
  checkAuth: async () => {
    try {
      const response = await api.auth.getProfile();
      set({ user: response?.user || null, loadingAuth: false });
    } catch (err) {
      console.error('Auth check error in store:', err);
      set({ user: null, loadingAuth: false });
    }
  },
  logout: async () => {
    try {
      await api.auth.logout();
    } catch (err) {
      console.error('Logout error in store:', err);
    } finally {
      // Disconnect socket authenticate on logout
      set({ user: null, activeExam: null, view: 'dashboard', supervisedSessions: [], alertsLog: [] });
    }
  },

  // Active Exam view & state
  view: 'dashboard',
  activeExam: null,
  setView: (view) => set({ view }),
  setActiveExam: (activeExam) => set({ activeExam }),

  // Supervision
  supervisedSessions: [],
  alertsLog: [],
  soundEnabled: true,
  
  setSupervisedSessions: (supervisedSessions) => set({ supervisedSessions }),
  setAlertsLog: (updater) => {
    if (typeof updater === 'function') {
      set((state) => ({ alertsLog: updater(state.alertsLog) }));
    } else {
      set({ alertsLog: updater });
    }
  },
  clearAlertsLog: () => set({ alertsLog: [] }),
  setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
}));
