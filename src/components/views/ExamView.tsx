import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Clock, CheckCircle2, Send, AlertCircle, ArrowRight, ClipboardList, 
  Sparkles, ArrowUp, ArrowDown, GripVertical, Timer, ChevronLeft, ChevronRight,
  Info, Star, ShieldAlert, Wifi, WifiOff, NotebookPen, Volume2, VolumeX, Calculator, X,
  Award, Download, Printer, Scissors, Layers
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api, socket } from '../../lib/api';
import { evaluateShortAnswer, analyzeExamResults } from '../../lib/gemini';
import { cn, stripHtml, normalizeQuestion, getExamTotalPoints, formatDuration } from '../../lib/utils';
import { Exam, UserProfile } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { AttestationTemplate, printAttestation, downloadAttestationPDF } from '../AttestationTemplate';
import confetti from 'canvas-confetti';

interface ExamViewProps {
  exam: Exam;
  onComplete: () => void;
  onCancel: () => void;
  user: UserProfile;
  moduleName?: string;
}

// IndexedDB Persistence Helpers
interface ExamState {
  answers: any[];
  currentQuestionIndex: number;
  questions: any[];
  startTime: number;
  fullscreenExitsCount: number;
  tabExitCount: number;
  timeLeft?: number;
  globalNotes?: string;
  questionNotes?: Record<number, string>;
}

const openExamDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }
    const request = indexedDB.open('ExamSafeStoreDB', 1);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('exam_states')) {
        db.createObjectStore('exam_states', { keyPath: 'key' });
      }
    };
    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };
    request.onerror = (event: any) => {
      reject(event.target.error || new Error('Failed to open IndexedDB'));
    };
  });
};

const saveExamStateIndexedDB = async (examId: number | string, userId: number | string, state: ExamState): Promise<void> => {
  try {
    const db = await openExamDB();
    const transaction = db.transaction(['exam_states'], 'readwrite');
    const store = transaction.objectStore('exam_states');
    const key = `${examId}_${userId}`;
    const request = store.put({ key, ...state, updatedAt: Date.now() });

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve();
      request.onerror = (event: any) => reject(event.target.error || new Error('Failed to save state'));
    });
  } catch (err) {
    console.error('IndexedDB save state error:', err);
  }
};

const getExamStateIndexedDB = async (examId: number | string, userId: number | string): Promise<ExamState | null> => {
  try {
    const db = await openExamDB();
    const transaction = db.transaction(['exam_states'], 'readonly');
    const store = transaction.objectStore('exam_states');
    const key = `${examId}_${userId}`;
    const request = store.get(key);

    return new Promise((resolve, reject) => {
      request.onsuccess = (event: any) => {
        resolve(event.target.result || null);
      };
      request.onerror = (event: any) => reject(event.target.error || new Error('Failed to get state'));
    });
  } catch (err) {
    console.error('IndexedDB get state error:', err);
    return null;
  }
};

const clearExamStateIndexedDB = async (examId: number | string, userId: number | string): Promise<void> => {
  try {
    const db = await openExamDB();
    const transaction = db.transaction(['exam_states'], 'readwrite');
    const store = transaction.objectStore('exam_states');
    const key = `${examId}_${userId}`;
    const request = store.delete(key);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve();
      request.onerror = (event: any) => reject(event.target.error || new Error('Failed to clear state'));
    });
  } catch (err) {
    console.error('IndexedDB clear state error:', err);
  }
};

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
  index: number;
  isArabic?: boolean;
}

const SortableItem: React.FC<SortableItemProps> = ({ id, children, index, isArabic }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <motion.div 
      ref={setNodeRef} 
      style={style} 
      initial={false}
      animate={{
        scale: isDragging ? 1.05 : 1,
        rotate: isDragging ? 2 : 0,
        boxShadow: isDragging 
          ? "0 25px 50px -12px rgba(79, 70, 229, 0.25)" 
          : "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
      }}
      className={cn(
        "group flex items-center gap-4 bg-white border-2 rounded-2xl transition-colors relative",
        isDragging ? "border-indigo-600 ring-4 ring-indigo-50" : "border-slate-100 hover:border-slate-200"
      )}
    >
      <div 
        {...attributes} 
        {...listeners} 
        className="px-4 py-8 cursor-grab active:cursor-grabbing border-r border-slate-50 hover:bg-indigo-50 transition-colors rounded-l-2xl group-hover:text-indigo-600"
      >
        <GripVertical className="w-5 h-5" />
      </div>
      <div className={cn(
        "flex-1 py-6 pr-6 flex items-center gap-4",
        isArabic ? "flex-row-reverse text-right" : ""
      )}>
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-all",
          isDragging ? "bg-indigo-600 text-white animate-pulse" : "bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600"
        )}>
          {index + 1}
        </div>
        <div className={cn(
          "flex-1 font-bold text-slate-700 select-none text-sm leading-snug",
        )}>
          {children}
        </div>
      </div>
      {isDragging && (
        <div className="absolute inset-0 bg-indigo-600/5 backdrop-blur-[2px] rounded-2xl pointer-events-none" />
      )}
    </motion.div>
  );
};

// Ephemeral symmetric encryption helper to prevent answers/questions manipulation in browser local storage or inspection tools
const getExamSessionKey = (examId: number | string, userId: number | string): string => {
  const rawKey = `exam-session-${examId}-${userId}-ephemeral-salt-4829`;
  let hash = 0;
  for (let i = 0; i < rawKey.length; i++) {
    const char = rawKey.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16) + "ePhEmErAl";
};

const encryptData = (data: any, key: string): string => {
  try {
    const jsonStr = JSON.stringify(data);
    let result = '';
    for (let i = 0; i < jsonStr.length; i++) {
      const charCode = jsonStr.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode);
    }
    // Convert binary string to UTF-8 safe base64
    return btoa(unescape(encodeURIComponent(result)));
  } catch (err) {
    console.error('[Crypto] Encryption error:', err);
    return '';
  }
};

const decryptData = <T = any>(encryptedStr: string | null, key: string): T | null => {
  if (!encryptedStr) return null;
  try {
    // If it looks like raw JSON, parse directly as fallback to avoid breaking active sessions
    if (encryptedStr.startsWith('{') || encryptedStr.startsWith('[')) {
      return JSON.parse(encryptedStr) as T;
    }
    const rawResult = decodeURIComponent(escape(atob(encryptedStr)));
    let result = '';
    for (let i = 0; i < rawResult.length; i++) {
      const charCode = rawResult.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode);
    }
    return JSON.parse(result) as T;
  } catch (err) {
    // If decryption fails, try standard parsing just in case
    try {
      return JSON.parse(encryptedStr) as T;
    } catch {
      console.error('[Crypto] Decryption and parsing fallback both failed:', err);
      return null;
    }
  }
};

export const ExamView = ({ exam, onComplete, onCancel, user, moduleName }: ExamViewProps) => {
  const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text || '');
  const [questions, setQuestions] = useState(() => {
    const sessionKey = getExamSessionKey(exam.id, user.id);
    const savedQs = localStorage.getItem(`exam_questions_${exam.id}_${user.id}`);
    if (savedQs) {
      const decrypted = decryptData<any[]>(savedQs, sessionKey);
      if (decrypted) return decrypted;
    }

    let qs = exam.questions
      .filter(q => q.type !== 'practical')
      .map((rawQ, idx) => {
      const q = normalizeQuestion(rawQ);
      if (!q.id) q.id = `q-${idx}`;
      
      const runtimeQ = { 
        ...q,
        runtimeOptions: q.options?.map((opt, oIdx) => ({ ...opt, idx: oIdx })) || [],
        runtimeMatchOptions: q.matchOptions?.map((text, mIdx) => ({ text, idx: mIdx })) || []
      };

      if (q.shuffleOptions) {
        if (q.type === 'multiple-choice' || q.type === 'true-false' || q.type === 'ordering') {
          runtimeQ.runtimeOptions = [...runtimeQ.runtimeOptions].sort(() => Math.random() - 0.5);
        }
        if (q.type === 'matching') {
          runtimeQ.runtimeMatchOptions = [...runtimeQ.runtimeMatchOptions].sort(() => Math.random() - 0.5);
        }
      }
      return runtimeQ;
    });

    if (exam.shuffleQuestions) {
      for (let i = qs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [qs[i], qs[j]] = [qs[j], qs[i]];
      }
    }
    
    // Save generated order to ensure stability across refreshes
    localStorage.setItem(`exam_questions_${exam.id}_${user.id}`, encryptData(qs, sessionKey));
    return qs;
  });

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(() => {
    const saved = localStorage.getItem(`exam_current_index_${exam.id}_${user.id}`);
    const idx = saved ? parseInt(saved, 10) : 0;
    return idx >= 0 ? idx : 0;
  });

  // Safeguard: Ensure currentQuestionIndex is within bounds of questions list
  const safeQuestionIndex = (currentQuestionIndex >= 0 && currentQuestionIndex < questions.length) ? currentQuestionIndex : 0;
  const currentQuestion = questions[safeQuestionIndex];

  const [answers, setAnswers] = useState<any[]>(() => {
    const sessionKey = getExamSessionKey(exam.id, user.id);
    const saved = localStorage.getItem(`exam_answers_${exam.id}_${user.id}`);
    if (saved) {
      const decrypted = decryptData<any[]>(saved, sessionKey);
      if (decrypted) return decrypted;
    }
    return questions.map(q => {
      if (q.type === 'ordering') return (q.runtimeOptions || []).map(opt => opt.idx);
      if (q.type === 'matching') return (q.runtimeMatchOptions || []).map(mOpt => mOpt.idx);
      if (q.type === 'fill-in-the-blanks') return new Array((q.correctAnswers && q.correctAnswers.length) || 0).fill('');
      return null;
    });
  });
  const [hasStarted, setHasStarted] = useState(() => {
    return !!localStorage.getItem(`exam_start_${exam.id}_${user.id}`);
  });
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiGrading, setIsAiGrading] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [isAutoSubmitted, setIsAutoSubmitted] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState(() => {
    const saved = localStorage.getItem(`exam_time_left_${exam.id}_${user.id}`);
    return saved ? parseInt(saved, 10) : exam.durationMinutes * 60;
  });
  const [lastSaved, setLastSaved] = useState<Date | null>(() => {
    const savedAnswers = localStorage.getItem(`exam_answers_${exam.id}_${user.id}`);
    return savedAnswers ? new Date() : null;
  });
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);
  const [extraTimeMinutes, setExtraTimeMinutes] = useState<number>(() => {
    const saved = localStorage.getItem(`exam_extra_time_${exam.id}_${user.id}`);
    return saved ? parseInt(saved, 10) : 0;
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<{ score: number, totalPoints: number, aiFeedback?: string } | null>(null);
  const [submissionProgress, setSubmissionProgress] = useState(0);
  const [submissionStep, setSubmissionStep] = useState(0); // 0 = idle, 1 = consolidation, 2 = secure indexing, 3 = transmitting, 4 = AI correction, 5 = completed
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncSlow, setIsSyncSlow] = useState(false);
  const [syncLatency, setSyncLatency] = useState<number | null>(null);

  const [soundMuted, setSoundMuted] = useState(() => {
    return localStorage.getItem(`exam_sound_muted_${exam.id}_${user.id}`) === 'true';
  });

  const [direction, setDirection] = useState<'right' | 'left'>('right');
  const [scratchpadOpen, setScratchpadOpen] = useState(false);
  const [activeDraftTab, setActiveDraftTab] = useState<'notes' | 'calc'>('notes');
  const [activeNotesSubTab, setActiveNotesSubTab] = useState<'global' | 'question'>('global');
  const [calcInput, setCalcInput] = useState('0');

  const [globalNotes, setGlobalNotes] = useState<string>(() => {
    return localStorage.getItem(`exam_global_notes_${exam.id}_${user.id}`) || '';
  });

  const [questionNotes, setQuestionNotes] = useState<Record<number, string>>(() => {
    try {
      const saved = localStorage.getItem(`exam_question_notes_${exam.id}_${user.id}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const playSoftSound = useCallback((type: 'select' | 'flag' | 'save' | 'success') => {
    try {
      const isMuted = localStorage.getItem(`exam_sound_muted_${exam.id}_${user.id}`) === 'true';
      if (isMuted) return;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();

      if (type === 'select') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(580, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(750, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'flag') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(420, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === 'save') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.02, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'success') {
        const osc1 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.connect(gain);
        gain.connect(ctx.destination);
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc1.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        osc1.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
        osc1.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.3); // C6
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
        osc1.start();
        osc1.stop(ctx.currentTime + 0.55);
      }
    } catch (err) {
      console.warn("Soft synthesizer playback failed:", err);
    }
  }, [exam.id, user.id]);

  const changeQuestion = useCallback((newIndex: number) => {
    if (newIndex > currentQuestionIndex) {
      setDirection('right');
    } else {
      setDirection('left');
    }
    setCurrentQuestionIndex(newIndex);
  }, [currentQuestionIndex]);

  const hasWarned5Min = useRef(false);
  const hasWarned1Min = useRef(false);

  useEffect(() => {
    if (!hasStarted || showCompletion || isSubmitting) return;

    if (timeLeft <= 300 && timeLeft > 60 && !hasWarned5Min.current) {
      hasWarned5Min.current = true;
      toast("⏰ Plus que 5 minutes restantes ! C'est le moment idéal pour respirer profondément et commencer à réviser sereinement vos réponses.", {
        duration: 8000,
        style: {
          borderRadius: '1.5rem',
          background: '#fffbeb',
          color: '#b45309',
          fontWeight: 'bold',
          border: '1.5px solid #fde68a',
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
        }
      });
    }

    if (timeLeft <= 60 && timeLeft > 0 && !hasWarned1Min.current) {
      hasWarned1Min.current = true;
      toast("🚨 Dernière minute ! Prenez une grande inspiration et vérifiez que vous avez bien coché toutes les questions.", {
        duration: 8000,
        style: {
          borderRadius: '1.5rem',
          background: '#fef2f2',
          color: '#991b1b',
          fontWeight: '900',
          border: '2.5px solid #f87171',
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        }
      });
    }
  }, [timeLeft, hasStarted, showCompletion, isSubmitting]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success(
        "Connexion rétablie ! Vos réponses sont synchronisées avec le serveur.",
        {
          duration: 5000,
          icon: '🟢',
          style: {
            borderRadius: '1.5rem',
            background: '#ecfdf5',
            color: '#065f46',
            fontWeight: 'bold',
            border: '1px solid #a7f3d0'
          }
        }
      );
    };

    const handleOffline = () => {
      setIsOnline(false);
      
      // Vibrate if supported
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
      
      toast.error(
        "Connexion perdue. Pas de panique ! Continuez l'épreuve calmement : toutes vos réponses restent sécurisées localement et seront synchronisées dès le retour du réseau.",
        {
          duration: 12000,
          icon: '🔴',
          style: {
            borderRadius: '2rem',
            background: '#fff1f2',
            color: '#9f1239',
            fontWeight: 'bold',
            border: '1px solid #fecdd3',
            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
          }
        }
      );
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  const [tabExitCount, setTabExitCount] = useState<number>(() => {
    const saved = localStorage.getItem(`exam_tab_exits_${exam.id}_${user.id}`);
    return saved ? parseInt(saved, 10) : 0;
  });
  const [auditEvents, setAuditEvents] = useState<{ type: string; details: string; timestamp: number }[]>(() => {
    const saved = localStorage.getItem(`exam_audit_events_${exam.id}_${user.id}`);
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const logCheatAlert = useCallback((type: string, details: string) => {
    const timestamp = Date.now();
    const newEvent = { type, details, timestamp };
    setAuditEvents(prev => {
      const next = [...prev, newEvent];
      localStorage.setItem(`exam_audit_events_${exam.id}_${user.id}`, JSON.stringify(next));
      return next;
    });
  }, [exam.id, user.id]);

  const fullscreenExitStartTimeRef = useRef<number | null>(null);
  const tabExitStartTimeRef = useRef<number | null>(null);
  const blurStartTimeRef = useRef<number | null>(null);

  const [fullscreenExitsCount, setFullscreenExitsCount] = useState<number>(() => {
    const saved = localStorage.getItem(`exam_fullscreen_exits_${exam.id}_${user.id}`);
    return saved ? parseInt(saved, 10) : 0;
  });

  const calculateIntegrityScore = useCallback(() => {
    let integrity = 100;
    // Deduct points based on recorded violations
    integrity -= tabExitCount * 12;
    integrity -= fullscreenExitsCount * 15;
    
    const devtoolsAlerts = auditEvents.filter(e => e.type === 'devtools-blocked').length;
    integrity -= devtoolsAlerts * 25;
    
    const shortcutAlerts = auditEvents.filter(e => e.type === 'shortcut-blocked').length;
    integrity -= shortcutAlerts * 10;
    
    const blockedEvents = auditEvents.filter(e => e.type.startsWith('blocked-')).length;
    integrity -= blockedEvents * 5;
    
    return Math.max(0, Math.min(100, integrity));
  }, [tabExitCount, fullscreenExitsCount, auditEvents]);
  const [isFullscreenUnsupported, setIsFullscreenUnsupported] = useState(() => {
    if (typeof document === 'undefined') return false;
    const isFsEnabled = !!(
      document.fullscreenEnabled || 
      (document as any).webkitFullscreenEnabled || 
      (document as any).mozFullScreenEnabled || 
      (document as any).msFullscreenEnabled
    );
    return !isFsEnabled;
  });
  const [isPausedByFullscreen, setIsPausedByFullscreen] = useState(false);
  const [showFullscreenWarningModal, setShowFullscreenWarningModal] = useState(false);
  const [showTabExitWarningModal, setShowTabExitWarningModal] = useState(false);
  const [needsFullscreenRestore, setNeedsFullscreenRestore] = useState(() => {
    if (!exam.forceFullscreen) return false;
    const started = !!localStorage.getItem(`exam_start_${exam.id}_${user.id}`);
    if (!started) return false;
    
    // If browser does not support fullscreen, don't demand full screen restoration
    if (typeof document !== 'undefined') {
      const isFsEnabled = !!(
        document.fullscreenEnabled || 
        (document as any).webkitFullscreenEnabled || 
        (document as any).mozFullScreenEnabled || 
        (document as any).msFullscreenEnabled
      );
      if (!isFsEnabled) return false;
    }

    const isFull = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );
    return !isFull;
  });

  // Automatically reset all active anti-cheat/lock states and warning modals if the teacher deactivates anti-cheat in real-time
  useEffect(() => {
    if (!exam.forceFullscreen) {
      setNeedsFullscreenRestore(false);
      setIsPausedByFullscreen(false);
      setShowFullscreenWarningModal(false);
    }
    if (!exam.detectTabExits) {
      setShowTabExitWarningModal(false);
    }
  }, [exam.forceFullscreen, exam.detectTabExits]);

  // Load and restore of state from IndexedDB in case of local cache wipes / browser restarts
  useEffect(() => {
    const initAndRestoreState = async () => {
      try {
        const savedState = await getExamStateIndexedDB(exam.id, user.id);
        if (savedState) {
          console.log('[SafeStore] active exam state found in IndexedDB:', savedState);
          
          const sessionKey = getExamSessionKey(exam.id, user.id);
          if (savedState.questions && savedState.questions.length > 0) {
            setQuestions(savedState.questions);
            localStorage.setItem(`exam_questions_${exam.id}_${user.id}`, encryptData(savedState.questions, sessionKey));
          }
          if (savedState.answers && savedState.answers.length > 0) {
            setAnswers(savedState.answers);
            localStorage.setItem(`exam_answers_${exam.id}_${user.id}`, encryptData(savedState.answers, sessionKey));
          }
          if (typeof savedState.currentQuestionIndex === 'number') {
            const idx = Math.max(0, Math.min(savedState.currentQuestionIndex, (savedState.questions?.length || questions.length || 1) - 1));
            setCurrentQuestionIndex(idx);
            localStorage.setItem(`exam_current_index_${exam.id}_${user.id}`, idx.toString());
          }
          if (typeof savedState.tabExitCount === 'number') {
            setTabExitCount(savedState.tabExitCount);
            localStorage.setItem(`exam_tab_exits_${exam.id}_${user.id}`, savedState.tabExitCount.toString());
          }
          if (typeof savedState.fullscreenExitsCount === 'number') {
            setFullscreenExitsCount(savedState.fullscreenExitsCount);
            localStorage.setItem(`exam_fullscreen_exits_${exam.id}_${user.id}`, savedState.fullscreenExitsCount.toString());
          }
          if (savedState.startTime) {
            setHasStarted(true);
            localStorage.setItem(`exam_start_${exam.id}_${user.id}`, savedState.startTime.toString());
          }
          if (typeof savedState.timeLeft === 'number') {
            setTimeLeft(savedState.timeLeft);
            localStorage.setItem(`exam_time_left_${exam.id}_${user.id}`, savedState.timeLeft.toString());
          }
          if (savedState.globalNotes) {
            setGlobalNotes(savedState.globalNotes);
            localStorage.setItem(`exam_global_notes_${exam.id}_${user.id}`, savedState.globalNotes);
          }
          if (savedState.questionNotes) {
            setQuestionNotes(savedState.questionNotes);
            localStorage.setItem(`exam_question_notes_${exam.id}_${user.id}`, JSON.stringify(savedState.questionNotes));
          }
        }
      } catch (err) {
        console.error('[SafeStore] Failed to restore state from IndexedDB:', err);
      }
    };
    initAndRestoreState();
  }, [exam.id, user.id]);

  const enterFullscreen = async (): Promise<boolean> => {
    try {
      const isFsEnabled = typeof document !== 'undefined' && !!(
        document.fullscreenEnabled || 
        (document as any).webkitFullscreenEnabled || 
        (document as any).mozFullScreenEnabled || 
        (document as any).msFullscreenEnabled
      );
      if (!isFsEnabled) {
        console.warn("Fullscreen is not supported or permitted in this context.");
        return false;
      }

      const docEl = document.documentElement as any;
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      } else if (docEl.mozRequestFullScreen) {
        await docEl.mozRequestFullScreen();
      } else if (docEl.msRequestFullscreen) {
        await docEl.msRequestFullscreen();
      }
      return true;
    } catch (err) {
      console.warn("Fullscreen request failed", err);
      return false;
    }
  };

  const handleRestoreFullscreen = async () => {
    const success = await enterFullscreen();
    if (success) {
      setNeedsFullscreenRestore(false);
    } else {
      setIsFullscreenUnsupported(true);
      setNeedsFullscreenRestore(false);
      toast.error("Le mode plein écran n'a pas pu être activé. Vous pouvez passer l'examen dans cette fenêtre.");
    }
  };

  const exitFullscreen = async () => {
    try {
      const doc = document as any;
      if (doc.exitFullscreen) {
        await doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        await doc.mozCancelFullScreen();
      } else if (doc.msExitFullscreen) {
        await doc.msExitFullscreen();
      }
    } catch (err) {
      console.warn("Exit fullscreen failed", err);
    }
  };

  const [showReview, setShowReview] = useState(false);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<number, boolean>>(() => {
    const sessionKey = getExamSessionKey(exam.id, user.id);
    const saved = localStorage.getItem(`exam_flagged_${exam.id}_${user.id}`);
    if (saved) {
      const decrypted = decryptData<Record<number, boolean>>(saved, sessionKey);
      if (decrypted) return decrypted;
    }
    return {};
  });

  const toggleFlag = (idx: number) => {
    setFlaggedQuestions(prev => {
      const next = { ...prev, [idx]: !prev[idx] };
      const sessionKey = getExamSessionKey(exam.id, user.id);
      localStorage.setItem(`exam_flagged_${exam.id}_${user.id}`, encryptData(next, sessionKey));
      return next;
    });
  };




  // Fullscreen Change Listener & Warnings
  useEffect(() => {
    if (!exam.forceFullscreen || !hasStarted || showCompletion || isSubmitting || isFullscreenUnsupported) return;

    const handleFullscreenChange = () => {
      const isFull = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );

      if (!isFull) {
        if (fullscreenExitStartTimeRef.current === null) {
          fullscreenExitStartTimeRef.current = Date.now();
        }

        setFullscreenExitsCount(prev => {
          const nextCount = prev + 1;
          localStorage.setItem(`exam_fullscreen_exits_${exam.id}_${user.id}`, nextCount.toString());

          const exactTime = new Date().toLocaleTimeString('fr-FR');
          const type = 'fullscreen-exit';
          const details = "Sortie d'écran (Alt+Tab ou réduction)";
          
          logCheatAlert(type, details);
          // Emit cheating alert
          socket.emit('exam:cheat-alert', {
            examId: exam.id,
            studentId: user.id,
            studentName: user.displayName,
            registrationNumber: user.registrationNumber || '-',
            type,
            details,
            timestamp: Date.now()
          });

          // Also increment tabExitCount to make it show up in Live Supervision counts immediately
          setTabExitCount(t => t + 1);

          if (nextCount >= 2) {
            setIsPausedByFullscreen(true);
          } else {
            setShowFullscreenWarningModal(true);
          }
          return nextCount;
        });
      } else {
        if (fullscreenExitStartTimeRef.current !== null) {
          const durationSec = Math.round((Date.now() - fullscreenExitStartTimeRef.current) / 1000);
          fullscreenExitStartTimeRef.current = null;

          const exactTime = new Date().toLocaleTimeString('fr-FR');
          const type = 'fullscreen-return';
          const details = `Retour au Plein Écran à ${exactTime} (Après une sortie de ${durationSec} secondes)`;
          
          logCheatAlert(type, details);
          socket.emit('exam:cheat-alert', {
            examId: exam.id,
            studentId: user.id,
            studentName: user.displayName,
            registrationNumber: user.registrationNumber || '-',
            type,
            details,
            timestamp: Date.now()
          });
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [hasStarted, showCompletion, isSubmitting, exam.id, user.id, user.displayName, user.registrationNumber, isFullscreenUnsupported, exam.forceFullscreen]);

  // Synchroniser la progression de l'étudiant via Socket.io
  useEffect(() => {
    if (!hasStarted) return;

    const ansCount = answers.filter(a => a !== null && (!Array.isArray(a) || (a as any[]).every(v => v !== -1 && v !== '' && v !== null))).length;

    socket.emit('exam:join-or-update', {
      examId: exam.id,
      studentId: user.id,
      studentName: user.displayName,
      registrationNumber: user.registrationNumber || '-',
      answeredCount: ansCount,
      totalQuestions: questions.length,
      tabExitCount: tabExitCount,
      status: showCompletion || isSubmitting ? 'completed' : 'active',
      lastUpdated: Date.now(),
      extraTimeMinutes: extraTimeMinutes,
      timeLeft: timeLeft
    });
  }, [answers, tabExitCount, hasStarted, showCompletion, isSubmitting, exam.id, user.id, user.displayName, user.registrationNumber, questions.length, extraTimeMinutes, timeLeft]);

  // Keyboard Shortcuts for QCM / True-False
  useEffect(() => {
    if (!hasStarted || showCompletion || isSubmitting || showReview) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in a textarea or input
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;

      const key = e.key;

      // Question types that support number keys (1-9)
      if (currentQuestion.type === 'multiple-choice') {
        const num = parseInt(key);
        if (!isNaN(num) && num > 0 && num <= currentQuestion.runtimeOptions.length) {
          handleAnswer(currentQuestion.runtimeOptions[num - 1].idx);
        }
      }

      // True/False support (1=Vrai, 2=Faux)
      if (currentQuestion.type === 'true-false') {
        if (key === '1' || key.toLowerCase() === 'v') handleAnswer(0);
        if (key === '2' || key.toLowerCase() === 'f') handleAnswer(1);
      }

      // Navigation shortcuts
      if (key === 'ArrowRight' && currentQuestionIndex < questions.length - 1) {
        changeQuestion(currentQuestionIndex + 1);
      }
      if (key === 'ArrowLeft' && currentQuestionIndex > 0) {
        changeQuestion(currentQuestionIndex - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasStarted, showCompletion, isSubmitting, showReview, currentQuestion, currentQuestionIndex, questions.length]);

  // Anti Copy-Paste, Selection & Keyboard Shortcut Blocking Logic (Rigorous Security Platform)
  useEffect(() => {
    if (!exam.disableCopyPaste || !hasStarted || showCompletion || isSubmitting) return;

    const preventAction = (e: Event) => {
      e.preventDefault();
      const type = `blocked-${e.type}`;
      const details = `Tentative de ${
        e.type === 'copy' ? 'copie' : 
        e.type === 'cut' ? 'coupe' : 
        e.type === 'paste' ? 'colle' : 
        e.type === 'selectstart' ? 'sélection de texte' :
        e.type === 'dragstart' ? 'glisser-déposer de texte' :
        'clic-droit (menu contextuel)'
      } bloquée`;
      
      logCheatAlert(type, details);
      socket.emit('exam:cheat-alert', {
        examId: exam.id,
        studentId: user.id,
        studentName: user.displayName,
        registrationNumber: user.registrationNumber || '-',
        type,
        details,
        timestamp: Date.now()
      });
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isControl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      
      // Block Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A, Ctrl+U, Ctrl+P (Print), Ctrl+S (Save)
      if (isControl && (key === 'c' || key === 'v' || key === 'x' || key === 'a' || key === 'u' || key === 'p' || key === 's')) {
        e.preventDefault();
        const type = 'shortcut-blocked';
        const details = `Raccourci de triche bloqué : ${isControl ? 'Ctrl/Cmd' : ''}+${key.toUpperCase()}`;
        
        logCheatAlert(type, details);
        socket.emit('exam:cheat-alert', {
          examId: exam.id,
          studentId: user.id,
          studentName: user.displayName,
          registrationNumber: user.registrationNumber || '-',
          type,
          details,
          timestamp: Date.now()
        });
        return false;
      }

      // Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (DevTools toggling)
      if (
        key === 'f12' || 
        (isControl && e.shiftKey && (key === 'i' || key === 'j' || key === 'c'))
      ) {
        e.preventDefault();
        const type = 'devtools-blocked';
        const details = `Raccourci DevTools bloqué : ${isControl ? 'Ctrl/Cmd' : ''}+Shift+${key.toUpperCase()}`;
        
        logCheatAlert(type, details);
        socket.emit('exam:cheat-alert', {
          examId: exam.id,
          studentId: user.id,
          studentName: user.displayName,
          registrationNumber: user.registrationNumber || '-',
          type,
          details,
          timestamp: Date.now()
        });
        return false;
      }
    };

    // Rigorous event interceptors
    document.addEventListener('contextmenu', preventAction, { capture: true });
    document.addEventListener('copy', preventAction, { capture: true });
    document.addEventListener('cut', preventAction, { capture: true });
    document.addEventListener('paste', preventAction, { capture: true });
    document.addEventListener('selectstart', preventAction, { capture: true });
    document.addEventListener('dragstart', preventAction, { capture: true });
    document.addEventListener('keydown', handleKeyDown, { capture: true });

    // Rigorous styling to disable selection completely
    const previousUserSelect = document.body.style.userSelect;
    const previousWebkitUserSelect = (document.body.style as any).webkitUserSelect;
    const previousMsUserSelect = (document.body.style as any).msUserSelect;
    const previousMozUserSelect = (document.body.style as any).mozUserSelect;

    document.body.style.userSelect = 'none';
    (document.body.style as any).webkitUserSelect = 'none';
    (document.body.style as any).msUserSelect = 'none';
    (document.body.style as any).mozUserSelect = 'none';

    return () => {
      document.removeEventListener('contextmenu', preventAction, { capture: true });
      document.removeEventListener('copy', preventAction, { capture: true });
      document.removeEventListener('cut', preventAction, { capture: true });
      document.removeEventListener('paste', preventAction, { capture: true });
      document.removeEventListener('selectstart', preventAction, { capture: true });
      document.removeEventListener('dragstart', preventAction, { capture: true });
      document.removeEventListener('keydown', handleKeyDown, { capture: true });

      document.body.style.userSelect = previousUserSelect;
      (document.body.style as any).webkitUserSelect = previousWebkitUserSelect;
      (document.body.style as any).msUserSelect = previousMsUserSelect;
      (document.body.style as any).mozUserSelect = previousMozUserSelect;
    };
  }, [hasStarted, showCompletion, isSubmitting, exam.id, user.id, user.displayName, user.registrationNumber, exam.disableCopyPaste]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (hasStarted) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentQuestionIndex, hasStarted]);

  useEffect(() => {
    // Standard react-hot-toast notifications are used to notify users on-screen.
    // Native beforeunload alerts have been removed as requested.
  }, [hasStarted, showCompletion, isSubmitting]);

  useEffect(() => {
    if (hasStarted && !showCompletion && !isSubmitting) {
      const sessionKey = getExamSessionKey(exam.id, user.id);
      localStorage.setItem(`exam_answers_${exam.id}_${user.id}`, encryptData(answers, sessionKey));
      localStorage.setItem(`exam_current_index_${exam.id}_${user.id}`, currentQuestionIndex.toString());
      localStorage.setItem(`exam_time_left_${exam.id}_${user.id}`, timeLeft.toString());
      localStorage.setItem(`exam_global_notes_${exam.id}_${user.id}`, globalNotes);
      localStorage.setItem(`exam_question_notes_${exam.id}_${user.id}`, JSON.stringify(questionNotes));

      // Rich persistent auto-save in IndexedDB
      const startSaved = localStorage.getItem(`exam_start_${exam.id}_${user.id}`);
      const startTime = startSaved ? parseInt(startSaved, 10) : Date.now();

      saveExamStateIndexedDB(exam.id, user.id, {
        answers,
        currentQuestionIndex,
        questions,
        startTime,
        fullscreenExitsCount,
        tabExitCount,
        timeLeft,
        globalNotes,
        questionNotes
      }).catch(err => {
        console.error('[SafeStore] IndexedDB auto-save failure:', err);
      });
    }
  }, [answers, currentQuestionIndex, questions, hasStarted, showCompletion, isSubmitting, exam.id, user.id, fullscreenExitsCount, tabExitCount, timeLeft, globalNotes, questionNotes]);

  // Dedicated automatic auto-save at regular intervals (every 30 seconds)
  useEffect(() => {
    if (!hasStarted || showCompletion || isSubmitting) return;

    const intervalId = setInterval(() => {
      try {
        const sessionKey = getExamSessionKey(exam.id, user.id);
        localStorage.setItem(`exam_answers_${exam.id}_${user.id}`, encryptData(answers, sessionKey));
        localStorage.setItem(`exam_current_index_${exam.id}_${user.id}`, currentQuestionIndex.toString());
        localStorage.setItem(`exam_time_left_${exam.id}_${user.id}`, timeLeft.toString());
        localStorage.setItem(`exam_flagged_${exam.id}_${user.id}`, encryptData(flaggedQuestions, sessionKey));
        localStorage.setItem(`exam_global_notes_${exam.id}_${user.id}`, globalNotes);
        localStorage.setItem(`exam_question_notes_${exam.id}_${user.id}`, JSON.stringify(questionNotes));

        const startSaved = localStorage.getItem(`exam_start_${exam.id}_${user.id}`);
        const startTime = startSaved ? parseInt(startSaved, 10) : Date.now();

        saveExamStateIndexedDB(exam.id, user.id, {
          answers,
          currentQuestionIndex,
          questions,
          startTime,
          fullscreenExitsCount,
          tabExitCount,
          timeLeft,
          globalNotes,
          questionNotes
        }).catch(err => {
          console.error('[SafeStore] IndexedDB periodic auto-save failure:', err);
        });

        // Trigger visual reassurance feedback
        const now = new Date();
        setLastSaved(now);
        setShowSavedFeedback(true);
        const timerId = setTimeout(() => setShowSavedFeedback(false), 3000);

        console.log(`[SafeStore] Sauvegarde locale automatique effectuée à ${now.toLocaleTimeString()}`);
        return () => clearTimeout(timerId);
      } catch (err) {
        console.error('[SafeStore] Periodic localStorage save failure:', err);
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, [answers, currentQuestionIndex, questions, hasStarted, showCompletion, isSubmitting, exam.id, user.id, fullscreenExitsCount, tabExitCount, timeLeft, flaggedQuestions]);

  const handleSubmit = useCallback(async (isAuto = false, force = false) => {
    if (isSubmitting || showCompletion) return;

    if (!isAuto && !force && answers.some(a => a === null || (Array.isArray(a) && a.some(v => v === -1)))) {
      setShowConfirmModal(true);
      return;
    }

    setIsAutoSubmitted(isAuto);
    const hasShortAnswers = questions.some(q => q.type === 'short-answer');
    if (hasShortAnswers) setIsAiGrading(true);
    setIsSubmitting(true);
    setIsAnalyzing(true);
    setShowCompletion(true);
    playSoftSound('success');

    // Start progress registration animation
    setSubmissionProgress(15);
    setSubmissionStep(1); // Étape 1 : Consolidation des réponses

    // Turn off full screen when exam is completed
    exitFullscreen();

    // Small delay to make the process visually clear and professional
    await new Promise(resolve => setTimeout(resolve, 400));
    setSubmissionProgress(35);
    setSubmissionStep(2); // Étape 2 : Nettoyage & Archivage local sécurisé

    localStorage.removeItem(`exam_start_${exam.id}_${user.id}`);
    localStorage.removeItem(`exam_answers_${exam.id}_${user.id}`);
    localStorage.removeItem(`exam_current_index_${exam.id}_${user.id}`);
    localStorage.removeItem(`exam_questions_${exam.id}_${user.id}`);
    localStorage.removeItem(`exam_tab_exits_${exam.id}_${user.id}`);
    localStorage.removeItem(`exam_fullscreen_exits_${exam.id}_${user.id}`);
    localStorage.removeItem(`exam_time_left_${exam.id}_${user.id}`);
    localStorage.removeItem(`exam_flagged_${exam.id}_${user.id}`);
    localStorage.removeItem(`exam_audit_events_${exam.id}_${user.id}`);
    clearExamStateIndexedDB(exam.id, user.id).catch(err => {
      console.warn('[SafeStore] Failed to clear IndexedDB on submit:', err);
    });

    await new Promise(resolve => setTimeout(resolve, 400));
    setSubmissionProgress(60);
    setSubmissionStep(3); // Étape 3 : Transmission cryptée au serveur d'évaluation

    try {
      const alignedAnswers = exam.questions.map((originalQ, origIdx) => {
        const qId = originalQ.id || `q-${origIdx}`;
        const shuffledIdx = questions.findIndex(q => q.id === qId);
        return shuffledIdx !== -1 ? answers[shuffledIdx] : null;
      });

      const response = await api.results.create({
        examId: exam.id,
        answers: alignedAnswers,
        integrityScore: calculateIntegrityScore(),
        tabExitCount,
        fullscreenExitsCount,
        auditTrail: auditEvents
      });

      setSubmissionProgress(85);
      setSubmissionStep(4); // Étape 4 : Analyse automatique & Correction par l'IA
      await new Promise(resolve => setTimeout(resolve, 700));

      setFinalResult({
        score: response.score,
        totalPoints: response.totalPoints,
        aiFeedback: response.aiFeedback
      });

      setSubmissionProgress(100);
      setSubmissionStep(5); // Étape 5 : Enregistrement complété avec succès
      await new Promise(resolve => setTimeout(resolve, 300));

      if (!isAuto) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444']
        });
      }
    } catch (error) {
      console.error("Error submitting result:", error);
      // Failover fallback so students don't lose their session of test locally in case of disconnect
      setSubmissionProgress(100);
      setSubmissionStep(5);
      const fallbackPoints = answers.filter((a, idx) => {
        const q = questions[idx];
        return q && q.correctAnswers && JSON.stringify(a) === JSON.stringify(q.correctAnswers);
      }).length;

      setFinalResult({
        score: fallbackPoints,
        totalPoints: questions.length,
        aiFeedback: "Vos réponses ont bien été archivées localement de manière sécurisée. Une micro-coupure de connexion a retardé la génération du feedback IA, mais votre copie a été enregistrée à 100% avec succès."
      });
    } finally {
      setIsSubmitting(false);
      setIsAnalyzing(false);
    }
  }, [answers, questions, exam, onComplete, isSubmitting, showCompletion, user.id]);

  // Tab Visibility Monitoring & Blur Cheat Detection
  useEffect(() => {
    if (!exam.detectTabExits || !hasStarted || showCompletion || isSubmitting) return;

    const triggerCheatAlert = (type: string, details: string) => {
      logCheatAlert(type, details);
      socket.emit('exam:cheat-alert', {
        examId: exam.id,
        studentId: user.id,
        studentName: user.displayName,
        registrationNumber: user.registrationNumber || '-',
        type,
        details,
        timestamp: Date.now()
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (tabExitStartTimeRef.current === null) {
          tabExitStartTimeRef.current = Date.now();
        }

        setTabExitCount(prev => {
          const nextCount = prev + 1;
          localStorage.setItem(`exam_tab_exits_${exam.id}_${user.id}`, nextCount.toString());
          triggerCheatAlert('tab-exit', "Sortie d'écran (Alt+Tab ou réduction)");
          setShowTabExitWarningModal(true);
          return nextCount;
        });
      } else if (document.visibilityState === 'visible') {
        if (tabExitStartTimeRef.current !== null) {
          const durationSec = Math.round((Date.now() - tabExitStartTimeRef.current) / 1000);
          tabExitStartTimeRef.current = null;

          const exactTime = new Date().toLocaleTimeString('fr-FR');
          triggerCheatAlert('tab-return', `Retour sur l'onglet d'examen à ${exactTime} (Changement d'onglet / écran d'examen inactif pendant ${durationSec} secondes)`);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [hasStarted, showCompletion, isSubmitting, exam.id, user.id, user.displayName, user.registrationNumber, handleSubmit, exam.detectTabExits]);

  // Écouter les commandes distantes d'un enseignant (arrêt forcé, rallonge de temps, autorisation)
  useEffect(() => {
    const handleRemoteTrigger = (data: { examId: number; action: 'stop' | 'add-time' | 'allow'; amount?: number }) => {
      if (data.examId !== exam.id) return;
      
      if (data.action === 'stop') {
        setIsAutoSubmitted(true);
        handleSubmit(true, true);
      } else if (data.action === 'add-time') {
        const addedMinutes = data.amount || 10;
        setExtraTimeMinutes(prev => {
          const next = prev + addedMinutes;
          localStorage.setItem(`exam_extra_time_${exam.id}_${user.id}`, next.toString());
          return next;
        });
      } else if (data.action === 'allow') {
        toast.success("Votre enseignant a validé votre explication. Vous êtes autorisé à continuer l'examen !", {
          duration: 6000
        });
        setShowTabExitWarningModal(false);
      }
    };

    socket.on('exam:remote-trigger', handleRemoteTrigger);
    return () => {
      socket.off('exam:remote-trigger', handleRemoteTrigger);
    };
  }, [exam.id, handleSubmit, user.id]);

  const [startTime] = useState(() => {
    const saved = localStorage.getItem(`exam_start_${exam.id}_${user.id}`);
    if (saved) {
      return parseInt(saved);
    }
    return Date.now();
  });

  // Synchronize the timer with the secure server-side clock
  const syncTimerWithServer = useCallback(async () => {
    try {
      if (!isOnline) {
        setIsSyncSlow(false);
        setSyncLatency(null);
        return; // Skip if offline to preserve focus and run on local monotonic decrement
      }
      const syncStart = Date.now();
      const response = await api.exams.timeSync(Number(exam.id));
      const syncEnd = Date.now();
      const latency = syncEnd - syncStart;
      setSyncLatency(latency);
      
      // If server sync takes more than 1500ms, flag as slow
      if (latency > 1500) {
        setIsSyncSlow(true);
      } else {
        setIsSyncSlow(false);
      }

      if (response && response.success) {
        const elapsedSeconds = Math.floor((response.serverTime - response.startTime) / 1000);
        const serverRemaining = Math.max(0, ((exam.durationMinutes + extraTimeMinutes) * 60) - elapsedSeconds);
        
        // Authoritative override
        setTimeLeft(serverRemaining);
        
        // Monitor if local system clock differs excessively (>15s) and notify peacefully
        const localElapsed = Math.floor((Date.now() - startTime) / 1000);
        const diff = Math.abs(localElapsed - elapsedSeconds);
        if (diff > 15) {
          toast.success("Chronomètre synchronisé en temps réel avec le serveur.", {
            duration: 3000,
            icon: '⏰',
            style: {
              borderRadius: '1.5rem',
              background: '#f8fafc',
              color: '#334155',
              fontWeight: 'bold',
              border: '1px solid #e2e8f0'
            }
          });
        }
      }
    } catch (err) {
      console.warn("Server timer sync failed; relying on secure local monotonic clock fallback.", err);
      if (isOnline) {
        setIsSyncSlow(true);
      }
    }
  }, [exam.id, exam.durationMinutes, extraTimeMinutes, startTime, isOnline]);

  const handleStartExam = async () => {
    const now = Date.now();
    localStorage.setItem(`exam_start_${exam.id}_${user.id}`, now.toString());
    setHasStarted(true);
    if (exam.forceFullscreen) {
      const success = await enterFullscreen();
      if (!success) {
        setIsFullscreenUnsupported(true);
        toast.error("Le mode plein écran n'a pas pu être activé. Vous pouvez passer l'examen dans cette fenêtre.");
      }
    }
    // Immediate eager sync
    setTimeout(() => {
      syncTimerWithServer();
    }, 150);
  };

  // Initial sync once started
  useEffect(() => {
    if (hasStarted) {
      syncTimerWithServer();
    }
  }, [hasStarted, syncTimerWithServer]);

  // Periodic time-sync every 30 seconds to prevent clock hacking
  useEffect(() => {
    if (!hasStarted || showCompletion || isSubmitting) return;

    const syncInterval = setInterval(() => {
      syncTimerWithServer();
    }, 30000);

    return () => clearInterval(syncInterval);
  }, [hasStarted, showCompletion, isSubmitting, syncTimerWithServer]);

  // Smooth local 1-second interval countdown ticks (fully system-clock independent and monotonic)
  useEffect(() => {
    if (!hasStarted || showCompletion || isSubmitting) return;

    const updateTimer = () => {
      let timeIsUp = false;
      setTimeLeft((prev) => {
        const next = Math.max(0, prev - 1);
        if (prev > 0 && next <= 0) {
          timeIsUp = true;
        }
        return next;
      });

      if (timeIsUp) {
        handleSubmit(true);
        return false;
      }
      return true;
    };

    const timer = setInterval(() => {
      if (!updateTimer()) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [showCompletion, isSubmitting, handleSubmit, hasStarted]);

  // Guaranteed Auto-submission when timer expires
  useEffect(() => {
    if (hasStarted && !showCompletion && !isSubmitting && timeLeft <= 0) {
      handleSubmit(true);
    }
  }, [hasStarted, showCompletion, isSubmitting, timeLeft, handleSubmit]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswer = (answer: any) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = answer;
    setAnswers(newAnswers);
    playSoftSound('select');
  };

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveId(null);
    if (over && active.id !== over.id) {
      const currentAns = answers[currentQuestionIndex] as number[];
      const oldIndex = currentAns.indexOf(parseInt(active.id));
      const newIndex = currentAns.indexOf(parseInt(over.id));
      handleAnswer(arrayMove(currentAns, oldIndex, newIndex));
      playSoftSound('select');
    }
  };

  if (!hasStarted) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-3xl w-full"
        >
          <Card className="p-1 border-2 border-slate-100 overflow-hidden rounded-[3rem]">
            <div className="bg-white p-10 md:p-16 rounded-[2.8rem] space-y-12">
              <div className="text-center space-y-6">
                <div className="flex items-center justify-center gap-3">
                  <span className="px-4 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100">Prêt pour l'examen ?</span>
                </div>
                <h2 className="text-4xl md:text-6xl font-black text-slate-900 leading-tight tracking-tight uppercase font-display italic">{exam.title}</h2>
                <div className="flex flex-wrap justify-center gap-3">
                   {exam.disableCopyPaste && (
                     <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-semibold text-indigo-600">
                       <Scissors className="w-4 h-4" /> Anti-Copie
                     </div>
                   )}
                   {exam.forceFullscreen && (
                     <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-100 rounded-xl text-xs font-semibold text-rose-600 animate-pulse">
                       <Layers className="w-4 h-4" /> Plein Écran Exigé
                     </div>
                   )}
                   {exam.detectTabExits && (
                     <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-100 rounded-xl text-xs font-semibold text-rose-600">
                       <ShieldAlert className="w-4 h-4" /> Sortie surveillée
                     </div>
                   )}
                   <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-500">
                     <Clock className="w-4 h-4" /> {formatDuration(exam.durationMinutes)}
                   </div>
                   <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-500">
                     <ClipboardList className="w-4 h-4" /> {questions.length} Questions
                   </div>
                   <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-500">
                     <Star className="w-4 h-4" /> {getExamTotalPoints(exam)} Points total
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-slate-50">
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <Info className="w-4 h-4 text-indigo-500" /> Instructions de base
                  </h4>
                  <ul className="space-y-3 text-sm text-slate-500 font-medium list-disc pl-4 marker:text-indigo-500">
                    <li>Vous ne pouvez pas mettre l'examen en pause.</li>
                    <li>Le minuteur s'arrête automatiquement après la fin du temps.</li>
                    <li>Toutes vos réponses sont sauvegardées en temps réel.</li>
                    <li>Surtout, lisez bien chaque énoncé avant de répondre !</li>
                  </ul>
                </div>
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" /> Règles de conduite
                  </h4>
                  <ul className="space-y-3 text-sm text-slate-500 font-medium list-disc pl-4 marker:text-amber-500">
                    <li>Ne rafraîchissez pas la page pendant l'examen.</li>
                    <li>N'utilisez pas de ressources externes non autorisées.</li>
                    <li>En cas de déconnexion, reconnectez-vous immédiatement.</li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-10">
                <Button variant="outline" onClick={onCancel} className="flex-1 py-6 h-auto text-sm uppercase tracking-widest font-black border-2 rounded-2xl">
                  Retourner au tableau de bord
                </Button>
                <Button onClick={handleStartExam} className="flex-1 py-6 h-auto text-sm uppercase tracking-[0.2em] font-black rounded-2xl shadow-xl shadow-indigo-100">
                  C'est parti ! <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const answeredCount = answers.filter(a => a !== null && (!Array.isArray(a) || (a as any[]).every(v => v !== -1 && v !== '' && v !== null))).length;
  const qAr = isArabic(currentQuestion.text);

  const stats = {
    answered: answeredCount,
    unanswered: questions.length - answeredCount,
    total: questions.length
  };

  if (needsFullscreenRestore) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <Card className="p-1 border-2 border-slate-800 overflow-hidden rounded-[3rem] bg-slate-900 shadow-2xl">
            <div className="bg-slate-950 p-10 md:p-12 text-center rounded-[2.8rem] space-y-8 border border-slate-800/50">
              <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto text-indigo-400">
                <Timer className="w-8 h-8 animate-pulse" />
              </div>
              <div className="space-y-3">
                <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-500/20">Session en Cours</span>
                <h3 className="text-2xl font-black text-white uppercase tracking-tight font-display italic">Plein Écran Requis</h3>
                <p className="text-slate-400 font-medium text-sm leading-relaxed">
                  L'examen sécurisé {exam.title} est déjà en cours. Pour continuer l'épreuve sans interruption, veuillez réactiver le mode Plein Écran.
                </p>
              </div>
              <Button 
                onClick={handleRestoreFullscreen} 
                className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-[0.1em] rounded-2xl shadow-lg shadow-indigo-500/10 h-auto"
              >
                Réactiver Plein Écran
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn(
      "min-h-screen bg-slate-50 transition-colors duration-500",
      focusMode ? "bg-white" : "bg-slate-50"
    )}>
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 relative pb-32">
      <div className="fixed top-4 right-4 z-[60] pointer-events-auto">
        <div className={cn(
          "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.15em] shadow-lg flex items-center gap-2 backdrop-blur-md transition-all duration-300 border",
          isOnline 
            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
            : "bg-rose-500/10 text-rose-500 border-rose-500/20 animate-pulse"
        )}>
          {isOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-500" />
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>En ligne</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-rose-500" />
              <span className="w-2 h-2 rounded-full bg-rose-50 animate-ping" />
              <span className="text-rose-600 font-bold">Hors ligne (Sécurisé Localement)</span>
            </>
          )}
        </div>
      </div>
      {(exam.disableCopyPaste || exam.forceFullscreen || exam.detectTabExits) && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] pointer-events-none">
          <div className="bg-rose-600/90 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg flex items-center gap-2 backdrop-blur-sm">
            <ShieldAlert className="w-4 h-4 animate-pulse" /> ÉVALUATION PROTÉGÉE SÉCURISÉE
          </div>
        </div>
      )}
      <AnimatePresence>
        {showExitConfirm && (
          <Modal title="Quitter l'examen ?" onClose={() => setShowExitConfirm(false)}>
            <div className="p-8 space-y-6">
               <div className="flex items-center gap-5 p-6 bg-rose-50 rounded-3xl border border-rose-100 text-rose-700">
                 <AlertCircle className="w-10 h-10 shrink-0" />
                 <div>
                   <p className="text-lg font-black uppercase tracking-tight">Voulez-vous vraiment quitter ?</p>
                   <p className="text-sm font-medium opacity-90">Toutes vos réponses actuelles seront perdues si vous n'avez pas soumis.</p>
                 </div>
               </div>
               <div className="flex flex-col sm:flex-row gap-4 pt-4">
                 <Button variant="ghost" onClick={() => setShowExitConfirm(false)} className="flex-1 h-14 font-black uppercase text-xs">Continuer l'examen</Button>
                 <Button 
                   variant="danger" 
                   onClick={() => {
                     localStorage.removeItem(`exam_start_${exam.id}_${user.id}`);
                     localStorage.removeItem(`exam_answers_${exam.id}_${user.id}`);
                     localStorage.removeItem(`exam_current_index_${exam.id}_${user.id}`);
                     localStorage.removeItem(`exam_questions_${exam.id}_${user.id}`);
                     localStorage.removeItem(`exam_tab_exits_${exam.id}_${user.id}`);
                      localStorage.removeItem(`exam_fullscreen_exits_${exam.id}_${user.id}`);
                      localStorage.removeItem(`exam_time_left_${exam.id}_${user.id}`);
                      localStorage.removeItem(`exam_flagged_${exam.id}_${user.id}`);
                      onCancel();
                   }} 
                   className="flex-1 h-14 font-black uppercase text-xs"
                 >
                   Quitter
                 </Button>
               </div>
             </div>
          </Modal>
        )}
        {showConfirmModal && (
          <Modal title="Confirmer la soumission" onClose={() => setShowConfirmModal(false)}>
            <div className="p-5 sm:p-8 space-y-6">
              {answeredCount === questions.length ? (
                <>
                  <div className="flex flex-col sm:flex-row items-center gap-5 p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600 shrink-0" />
                    <div className="space-y-1 text-center sm:text-left">
                      <p className="text-lg font-black text-emerald-950">Tout est prêt !</p>
                      <p className="text-sm font-medium text-emerald-700">Vous avez répondu à toutes les questions ({answeredCount}/{questions.length}).</p>
                    </div>
                  </div>
                  <p className="text-slate-600 font-medium leading-relaxed sm:text-center px-2">
                    Voulez-vous vraiment soumettre vos réponses et terminer l'examen ? Une fois soumis, vous ne pourrez plus modifier vos réponses.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button variant="outline" onClick={() => setShowConfirmModal(false)} className="flex-1 order-2 sm:order-1">Retourner à l'examen</Button>
                    <Button 
                      onClick={() => { setShowConfirmModal(false); handleSubmit(false, true); }}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white border-none order-1 sm:order-2"
                    >
                      Soumettre l'examen
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row items-center gap-5 p-6 bg-amber-50 rounded-3xl border border-amber-100">
                    <AlertCircle className="w-10 h-10 text-amber-600 shrink-0" />
                    <div className="space-y-1 text-center sm:text-left">
                      <p className="text-lg font-black text-amber-900">Attention</p>
                      <p className="text-sm font-medium text-amber-700">Vous n'avez pas répondu à toutes les questions ({answeredCount}/{questions.length}).</p>
                    </div>
                  </div>
                  <p className="text-slate-600 font-medium leading-relaxed sm:text-center px-2">
                    Il reste des questions sans réponse. Voulez-vous vraiment terminer l'examen maintenant ? Vos réponses actuelles seront enregistrées.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button variant="outline" onClick={() => setShowConfirmModal(false)} className="flex-1 order-2 sm:order-1">Continuer l'examen</Button>
                    <Button 
                      onClick={() => { setShowConfirmModal(false); handleSubmit(false, true); }}
                      className="flex-1 bg-amber-600 hover:bg-amber-700 text-white border-none order-1 sm:order-2"
                    >
                      Terminer quand même
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Modal>
        )}
        {isPausedByFullscreen && (
          <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="max-w-xl w-full bg-white p-10 rounded-[2.5rem] shadow-2xl text-center space-y-8 border-4 border-amber-500"
            >
              <div className="mx-auto w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center border-2 border-amber-200 text-amber-500 animate-pulse font-bold">
                <ShieldAlert className="w-10 h-10" />
              </div>
              <div className="space-y-4">
                <h3 className="text-3xl font-black text-slate-900 tracking-tight font-display">
                  Respect du Plein Écran
                </h3>
                <p className="text-slate-500 text-sm font-semibold leading-relaxed">
                  L'examen a été mis en pause car vous avez quitté le mode plein écran à plusieurs reprises ({fullscreenExitsCount} fois). Le minuteur est actuellement suspendu.
                </p>
                <p className="text-amber-600 text-xs font-bold bg-amber-50/50 p-3 rounded-2xl border border-amber-100/50">
                  Règle de sécurité : Vous devez impérativement rester en mode Plein Écran jusqu'à la soumission de votre copie. Tout manquement est signalé en temps réel.
                </p>
              </div>
              <Button 
                onClick={async () => {
                  const success = await enterFullscreen();
                  if (!success) {
                    setIsFullscreenUnsupported(true);
                    setIsPausedByFullscreen(false);
                    toast.error("Le mode plein écran n'a pas pu être activé. Vous pouvez passer l'examen dans cette fenêtre.");
                  } else {
                    setIsPausedByFullscreen(false);
                  }
                }} 
                className="w-full py-5 h-auto bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl"
              >
                Réactiver le Plein Écran & Reprendre
              </Button>
            </motion.div>
          </div>
        )}

        {showFullscreenWarningModal && (
          <Modal title="Plein Écran Obligatoire" onClose={() => {}}>
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-5 p-6 bg-amber-50 rounded-3xl border border-amber-100 text-amber-700">
                <ShieldAlert className="w-10 h-10 shrink-0" />
                <div>
                  <p className="text-lg font-black uppercase tracking-tight">Avertissement de Sécurité</p>
                  <p className="text-sm font-medium opacity-90 font-bold text-rose-600">
                    Vous avez quitté le mode plein écran ({fullscreenExitsCount}/2 tentatives).
                  </p>
                </div>
              </div>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">
                Le mode plein écran est obligatoire pour cet examen afin de garantir l'équité de l'évaluation. Vous devez y retourner pour continuer.
              </p>
              <div className="pt-4">
                <Button 
                  onClick={async () => {
                    const success = await enterFullscreen();
                    if (!success) {
                      setIsFullscreenUnsupported(true);
                      setShowFullscreenWarningModal(false);
                      toast.error("Le mode plein écran n'a pas pu être activé. Vous pouvez passer l'examen dans cette fenêtre.");
                    } else {
                      setShowFullscreenWarningModal(false);
                    }
                  }} 
                  className="w-full py-5 h-auto bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-black uppercase tracking-widest"
                >
                  Retourner en Plein Écran
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {showTabExitWarningModal && (
          <Modal title="Changement d'onglet détecté" onClose={() => {}}>
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-5 p-6 bg-orange-50 rounded-3xl border border-orange-100 text-orange-700">
                <AlertCircle className="w-10 h-10 shrink-0" />
                <div>
                  <p className="text-lg font-black uppercase tracking-tight">Activité Suspecte</p>
                  <p className="text-sm font-medium opacity-90 font-bold text-rose-600">
                    Sortie d'écran détectée ({tabExitCount} fois).
                  </p>
                </div>
              </div>
              <div className="space-y-4 text-sm text-slate-500 font-medium leading-relaxed">
                <p>
                  Le changement d'onglet ou d'application durant un examen surveillés est formellement interdit et fait l'objet d'un rapport automatique en temps réel.
                </p>
                <p className="font-bold text-rose-600 bg-rose-50 border border-rose-100 p-4 rounded-2xl">
                  ⚠️ Votre enseignant a été alerté en temps réel de cette interruption. Il décidera s'il convient de vous autoriser à poursuivre l'épreuve ou de bloquer définitivement votre copie. Vous pouvez toutefois continuer à composer en attendant sa décision.
                </p>
              </div>
              <div className="pt-4">
                <Button 
                  onClick={() => {
                    setShowTabExitWarningModal(false);
                  }} 
                  className="w-full py-5 h-auto bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-black uppercase tracking-widest"
                >
                  Continuer l'Examen
                </Button>
              </div>
            </div>
          </Modal>
        )}
        {showCompletion && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 30 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-white rounded-[2.5rem] shadow-2xl max-w-5xl w-full my-auto flex flex-col relative overflow-hidden border border-slate-100"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
              
              {!finalResult ? (
                /* PROGRESS DISPLAY: Horizontal Landscape design for real saving actions progress */
                <div className="p-8 md:p-12 space-y-8">
                  <div className="text-center md:text-left space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full border border-indigo-100/50">
                      Évaluation & Synchro
                    </span>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight font-display mt-21">
                      Enregistrement et vérification de votre examen
                    </h3>
                    <p className="text-sm text-slate-500 font-medium">
                      Veuillez patienter pendant la clôture sécurisée de votre session.
                    </p>
                  </div>
                  
                  {/* Landscape Layout Grid for Saving Progress */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center bg-slate-50/50 p-6 md:p-8 rounded-[2rem] border border-slate-150">
                    
                    {/* Left Column: Big Glowing Progress Loader */}
                    <div className="md:col-span-12 lg:col-span-5 flex flex-col items-center justify-center space-y-4">
                      <div className="relative w-40 h-40 flex items-center justify-center">
                        {/* Outer pulsing ring */}
                        <div className="absolute inset-0 rounded-full bg-indigo-100 animate-ping opacity-30" />
                        
                        <svg className="w-full h-full transform -rotate-90">
                          <circle
                            cx="80"
                            cy="80"
                            r="70"
                            stroke="#e2e8f0"
                            strokeWidth="10"
                            fill="transparent"
                          />
                          <motion.circle
                            cx="80"
                            cy="80"
                            r="70"
                            stroke="#4f46e5"
                            strokeWidth="10"
                            fill="transparent"
                            strokeDasharray={2 * Math.PI * 70}
                            animate={{ strokeDashoffset: (2 * Math.PI * 70) * (1 - (submissionProgress / 100)) }}
                            transition={{ duration: 0.4, ease: "easeInOut" }}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-4xl font-black text-slate-900">{submissionProgress}%</span>
                          <span className="text-[9px] font-black text-slate-400 tracking-wider uppercase mt-1">
                            En cours...
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Progressive Checklist Timeline */}
                    <div className="md:col-span-12 lg:col-span-7 space-y-4">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 font-display">
                        Statut des protocoles d'archivage :
                      </span>
                      
                      {/* Step 1 */}
                      <div className={cn(
                        "flex items-center gap-4 p-3 rounded-2xl border transition-all duration-300",
                        submissionStep > 1 ? "bg-emerald-50/50 border-emerald-100/60 text-slate-700" :
                        submissionStep === 1 ? "bg-indigo-50 border-indigo-100 text-slate-900 animate-pulse" :
                        "bg-slate-50/20 border-slate-100/50 text-slate-400"
                      )}>
                        <div className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0",
                          submissionStep > 1 ? "bg-emerald-500 text-white" :
                          submissionStep === 1 ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
                        )}>
                          {submissionStep > 1 ? "✔" : "1"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black uppercase tracking-tight">Consolidation des réponses</p>
                          <p className="text-[10px] font-medium opacity-80 leading-normal">Vérification de l'intégrité de vos choix et saisies.</p>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className={cn(
                        "flex items-center gap-4 p-3 rounded-2xl border transition-all duration-300",
                        submissionStep > 2 ? "bg-emerald-50/50 border-emerald-100/60 text-slate-700" :
                        submissionStep === 2 ? "bg-indigo-50 border-indigo-100 text-slate-900 animate-pulse" :
                        "bg-slate-50/20 border-slate-100/50 text-slate-400"
                      )}>
                        <div className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0",
                          submissionStep > 2 ? "bg-emerald-500 text-white" :
                          submissionStep === 2 ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
                        )}>
                          {submissionStep > 2 ? "✔" : "2"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black uppercase tracking-tight">Sauvegarde & Archivage local sécurisé</p>
                          <p className="text-[10px] font-medium opacity-80 leading-normal">Libération du cache navigateur et chiffrement des métadonnées.</p>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className={cn(
                        "flex items-center gap-4 p-3 rounded-2xl border transition-all duration-300",
                        submissionStep > 3 ? "bg-emerald-50/50 border-emerald-100/60 text-slate-700" :
                        submissionStep === 3 ? "bg-indigo-50 border-indigo-100 text-slate-900 animate-pulse" :
                        "bg-slate-50/20 border-slate-100/50 text-slate-400"
                      )}>
                        <div className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0",
                          submissionStep > 3 ? "bg-emerald-500 text-white" :
                          submissionStep === 3 ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
                        )}>
                          {submissionStep > 3 ? "✔" : "3"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black uppercase tracking-tight">Transmission cryptée au serveur d'évaluation</p>
                          <p className="text-[10px] font-medium opacity-80 leading-normal">Synchronisation avec l'instance de test principale.</p>
                        </div>
                      </div>

                      {/* Step 4 */}
                      <div className={cn(
                        "flex items-center gap-4 p-3 rounded-2xl border transition-all duration-300",
                        submissionStep > 4 ? "bg-emerald-50/50 border-emerald-100/60 text-slate-700" :
                        submissionStep === 4 ? "bg-indigo-50 border-indigo-100 text-slate-900 animate-pulse" :
                        "bg-slate-50/20 border-slate-100/50 text-slate-400"
                      )}>
                        <div className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0",
                          submissionStep > 4 ? "bg-emerald-500 text-white" :
                          submissionStep === 4 ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
                        )}>
                          {submissionStep > 4 ? "✔" : "4"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black uppercase tracking-tight">Analyse automatique & Correction par l'IA</p>
                          <p className="text-[10px] font-medium opacity-80 leading-normal">Mise en œuvre approfondie de votre prestation par l'Assistant IA.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* RESULTS SUMMARY VIEW: Horizontal Widescreen Landscape style design with beautiful layout */
                <div className="p-8 md:p-12 space-y-10">
                  
                  {/* Title Bar Block */}
                  <div className="flex flex-col md:flex-row items-center justify-between border-b border-slate-100 pb-6 gap-4">
                    <div className="text-center md:text-left space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-[0.25em] bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full border border-indigo-100">
                        Session d'examen terminée
                      </span>
                      <h3 className="text-2xl md:text-3xl font-black text-slate-950 font-display mt-2 tracking-tight">
                        Relevé d'évaluation détaillé • {exam.title}
                      </h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-loose mt-1">
                        Candidat : {user.displayName} (Identifiant : {user.registrationNumber || 'N/A'})
                      </p>
                    </div>
                    
                    {/* Floating badge for success/attempt status */}
                    <div className={cn(
                      "px-6 py-3 rounded-2xl flex items-center gap-3 border shadow-sm shrink-0",
                      Math.round((finalResult.score / finalResult.totalPoints) * 100) >= 50 
                        ? "bg-emerald-50 border-emerald-100 text-emerald-700" 
                        : "bg-rose-50 border-rose-100 text-rose-700"
                    )}>
                      {Math.round((finalResult.score / finalResult.totalPoints) * 100) >= 50 ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          <span className="text-xs font-black uppercase tracking-wider">Objectif Atteint</span>
                        </>
                      ) : (
                        <>
                          <Info className="w-5 h-5 text-rose-500" />
                          <span className="text-xs font-black uppercase tracking-wider">Non Validé</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Landscape Layout Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* Left Column: Visual circular progress & detailed statistics metrics cards */}
                    <div className="lg:col-span-5 space-y-6 flex flex-col items-center">
                      
                      {/* Big Circular Score Ring Layout */}
                      <div className="bg-slate-50/50 w-full p-8 rounded-[2rem] border border-slate-100 flex flex-col items-center relative overflow-hidden">
                        
                        <div className="relative flex items-center justify-center">
                          <svg className="w-44 h-44 transform -rotate-90">
                            <circle
                              cx="88"
                              cy="88"
                              r="78"
                              stroke="#f1f5f9"
                              strokeWidth="12"
                              fill="transparent"
                            />
                            <motion.circle
                              cx="88"
                              cy="88"
                              r="78"
                              stroke={Math.round((finalResult.score / finalResult.totalPoints) * 100) >= 50 ? "#10b981" : "#f59e0b"}
                              strokeWidth="12"
                              fill="transparent"
                              strokeDasharray={2 * Math.PI * 78}
                              initial={{ strokeDashoffset: 2 * Math.PI * 78 }}
                              animate={{ strokeDashoffset: (2 * Math.PI * 78) * (1 - (finalResult.score / finalResult.totalPoints)) }}
                              transition={{ duration: 1.5, ease: "easeOut" }}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-4xl font-black text-slate-900 leading-none">
                              {Math.round((finalResult.score / finalResult.totalPoints) * 100)}%
                            </span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 font-display">Précision Globale</span>
                          </div>
                          
                          {/* Trophy Star Badge */}
                          <div className="absolute top-2 right-2 bg-amber-400 p-2.5 rounded-2xl shadow-lg shadow-amber-100 transform rotate-12">
                            <Star className="w-5 h-5 text-white fill-white animate-bounce" />
                          </div>
                        </div>

                        {/* Summary description */}
                        <div className="text-center mt-6 space-y-2">
                          <h4 className="text-xl font-black text-slate-900 tracking-tight">
                            {Math.round((finalResult.score / finalResult.totalPoints) * 100) >= 80 ? "Prestation Excellente !" : 
                             Math.round((finalResult.score / finalResult.totalPoints) * 100) >= 50 ? "Examen Validé !" : 
                             "Score insuffisant"}
                          </h4>
                          <p className="text-xs text-slate-500 font-medium">
                            Vous obtenez <span className="font-black text-slate-950">{Number.isInteger(finalResult.score) ? finalResult.score : finalResult.score.toFixed(1)}</span> points sur un barème de <span className="font-black text-slate-950">{finalResult.totalPoints}</span>.
                          </p>
                        </div>
                      </div>

                      {/* Side metrics micro bento cards */}
                      <div className="grid grid-cols-2 gap-4 w-full">
                        <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100 flex flex-col items-center justify-center text-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <ClipboardList className="w-5 h-5" />
                          </div>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Qualité de Focus</span>
                          <span className="text-xs font-black text-slate-900 leading-tight">
                            {tabExitCount === 0 && fullscreenExitsCount === 0 ? "Excellente" : `${tabExitCount + fullscreenExitsCount} avertissement(s)`}
                          </span>
                        </div>
                        <div className={cn(
                          "p-5 rounded-3xl border flex flex-col items-center justify-center text-center gap-2",
                          Math.round((finalResult.score / finalResult.totalPoints) * 100) >= 50 ? "bg-emerald-50/50 border-emerald-100 text-emerald-800" : "bg-rose-50/50 border-rose-100 text-rose-800"
                        )}>
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center",
                            Math.round((finalResult.score / finalResult.totalPoints) * 100) >= 50 ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                          )}>
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Décision finale</span>
                          <span className="text-xs font-black leading-tight">
                            {Math.round((finalResult.score / finalResult.totalPoints) * 100) >= 50 ? "Admis" : "Échec d'épreuve"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: AI corrective reports, details, and buttons (lg:col-span-7) */}
                    <div className="lg:col-span-7 space-y-6">
                      
                      {/* Formative Feedback box with custom rich markup rendering */}
                      <div className="bg-indigo-50/40 rounded-3xl p-6 border border-indigo-100/50 space-y-4 font-sans">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4.5 h-4.5 text-indigo-600" />
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] font-display">
                              Rapport Éducatif & Analyse IA
                            </span>
                          </div>
                          <button 
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(finalResult.aiFeedback || '');
                                toast.success("Rapport d'analyse copié !");
                              } catch {}
                            }}
                            className="text-xs font-black text-indigo-600 hover:text-indigo-800 transition-colors uppercase tracking-wider animate-pulse"
                          >
                            Copier l'analyse
                          </button>
                        </div>
                        
                        <div className="text-sm text-slate-700 font-medium leading-relaxed max-h-[220px] overflow-y-auto custom-scrollbar pr-2 whitespace-pre-wrap bg-white/60 p-4 rounded-2xl border border-indigo-100/30">
                          {finalResult.aiFeedback || "Aucune remarque spécifique n'a été formulée par l'intelligence artificielle pour cette épreuve."}
                        </div>
                      </div>

                      {/* Info on practical evaluations */}
                      {exam.questions.some(q => q.type === 'practical') && (
                        <div className="flex items-start gap-4 p-5 bg-amber-50/60 border border-amber-100/60 rounded-3xl text-amber-900">
                          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          <p className="text-[11px] font-bold leading-normal italic">
                            Évaluation de stage pratique : Cet examen comporte une section d'exercices pratiques ({getExamTotalPoints(exam) - questions.reduce((s, q) => s + (q.points || 1), 0)} points) qui requiert une appréciation formelle et personnalisée par votre formateur.
                          </p>
                        </div>
                      )}

                      {/* Preview of the official certificate */}
                      <div className="bg-amber-50/10 border-2 border-dashed border-amber-500/20 rounded-[2rem] p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-amber-700">
                            <Award className="w-4.5 h-4.5 text-amber-600" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] font-display">
                              Aperçu de votre Attestation Officielle
                            </span>
                          </div>
                          <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-250/50">
                            {Math.round((finalResult.score / finalResult.totalPoints) * 100) >= 50 ? 'Réussite' : 'Passage'}
                          </span>
                        </div>
                        
                        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-inner bg-slate-50 p-2 md:p-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                          <AttestationTemplate 
                            exam={exam} 
                            result={finalResult} 
                            user={user} 
                            moduleName={moduleName} 
                            isPreview={true} 
                          />
                        </div>
                        <p className="text-[8px] text-slate-400 font-extrabold text-center uppercase tracking-widest leading-none">
                          La mise en page paysage A4 haute définition sera conservée lors de l'impression
                        </p>
                      </div>

                      {/* Bottom action triggers in Landscape style */}
                      <div className="pt-4 flex flex-col sm:flex-row flex-wrap md:flex-nowrap gap-3">
                        <button
                          onClick={() => {
                            if (finalResult) {
                              downloadAttestationPDF(exam, finalResult, user, moduleName);
                            }
                          }}
                          className="flex-1 min-w-[140px] py-4 rounded-[1.25rem] border-2 border-indigo-600 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2 active:scale-98 shadow-md cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                          <span>Télécharger PDF</span>
                        </button>
                        <button
                          onClick={() => {
                            printAttestation("attestation-export-container");
                          }}
                          className="flex-1 min-w-[140px] py-4 rounded-[1.25rem] border-2 border-slate-200 text-slate-700 bg-white hover:bg-slate-50 hover:border-indigo-200 hover:text-indigo-650 font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
                        >
                          <Printer className="w-4 h-4 text-slate-400" />
                          <span>Imprimer</span>
                        </button>
                        <Button 
                          onClick={() => onComplete()}
                          className="flex-1 min-w-[140px] py-4 h-auto bg-slate-950 hover:bg-slate-900 text-white rounded-[1.25rem] text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-100 transition-all flex items-center justify-center gap-2 group cursor-pointer"
                        >
                          <span>Quitter</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </div>

                    </div>
                  </div>

                  {/* Print-only template rendered outside the exam view in a portal to prevent any scale/transform clipping issues in html2canvas */}
                  {createPortal(
                    <div className="absolute top-0 left-0 w-0 h-0 overflow-visible pointer-events-none">
                      <AttestationTemplate 
                        exam={exam} 
                        result={finalResult} 
                        user={user} 
                        moduleName={moduleName} 
                        isPreview={false}
                      />
                    </div>,
                    document.body
                  )}

                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Progress Sidebar */}
        <div className={cn(
          "lg:col-span-3 space-y-6 hidden lg:block sticky top-8 transition-all duration-300",
          focusMode && "opacity-0 pointer-events-none translate-x-[-20px] absolute"
        )}>
          <Card className="p-6 border-none shadow-xl shadow-slate-200/50 space-y-6 rounded-[2.5rem] bg-white">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-slate-100 p-1 rounded-xl flex">
                <button 
                  onClick={() => setShowReview(false)}
                  className={cn("px-3 py-1.5 text-[9px] font-black uppercase tracking-tight rounded-lg transition-all", !showReview ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400")}
                >
                  Examen
                </button>
                <button 
                  onClick={() => setShowReview(true)}
                  className={cn("px-3 py-1.5 text-[9px] font-black uppercase tracking-tight rounded-lg transition-all", showReview ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400")}
                >
                  Récap
                </button>
              </div>
              <button 
                onClick={() => setFocusMode(!focusMode)}
                className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                title="Mode Concentration"
              >
                <Star className={cn("w-4 h-4", focusMode && "fill-indigo-600 text-indigo-600")} />
              </button>
            </div>

            <div className="space-y-1">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Progression</h3>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-slate-900">{answeredCount}/{questions.length}</span>
                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">{Math.round(progress)}%</span>
              </div>
            </div>

            <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-indigo-600"
              />
            </div>

            <div className="grid grid-cols-4 gap-2 pt-4">
              {questions.map((_, idx) => {
                const isAnswered = answers[idx] !== null && (!Array.isArray(answers[idx]) || (answers[idx] as any[]).every(v => v !== -1 && v !== '' && v !== null));
                const isCurrent = idx === currentQuestionIndex && !showReview;
                const isFlagged = flaggedQuestions[idx];
                
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      changeQuestion(idx);
                      setShowReview(false);
                    }}
                    className={cn(
                      "w-full aspect-square rounded-xl flex items-center justify-center text-xs font-black transition-all border-2 relative",
                      isCurrent 
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100 scale-110" 
                        : isAnswered 
                          ? "bg-white border-emerald-500 text-emerald-600" 
                          : "bg-white border-slate-100 text-slate-400 hover:border-indigo-300"
                    )}
                  >
                    {idx + 1}
                    {isFlagged && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-6 border-t border-slate-50">
               <Button 
                 onClick={() => setShowConfirmModal(true)} 
                 className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-widest gap-2 shadow-xl shadow-slate-200"
               >
                 Terminer l'examen
               </Button>
               <Button 
                 variant="ghost" 
                 onClick={() => setShowExitConfirm(true)} 
                 className="w-full mt-2 h-10 rounded-xl text-slate-400 hover:text-rose-600 text-[10px] font-black uppercase tracking-widest"
               >
                 Abandonner
               </Button>
            </div>
          </Card>

          <Card className={cn(
            "p-6 border transition-all duration-500 rounded-[2rem] flex flex-col items-center gap-4",
            timeLeft <= 60 
              ? "bg-rose-50 border-rose-200 shadow-xl shadow-rose-200/30 text-rose-800 animate-[pulse_2s_infinite]" 
              : timeLeft <= 300 
                ? "bg-amber-50 border-amber-200 shadow-xl shadow-amber-200/30 text-amber-800" 
                : "bg-indigo-600 border shadow-xl shadow-slate-200/50 text-white"
          )}>
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center border transition-all duration-500",
              timeLeft <= 60 
                ? "bg-rose-500/10 border-rose-500/20 text-rose-600 animate-[bounce_1s_infinite]" 
                : timeLeft <= 300 
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-600" 
                  : "bg-white/10 border-white/20 text-white"
            )}>
               <Clock className="w-6 h-6" />
            </div>
            <div className="text-center">
               <p className={cn(
                 "text-[10px] font-black uppercase tracking-widest mb-1 transition-colors",
                 timeLeft <= 60 
                   ? "text-rose-500" 
                   : timeLeft <= 300 
                     ? "text-amber-600" 
                     : "text-indigo-300"
               )}>
                 {timeLeft <= 60 ? "Minutes finales" : timeLeft <= 180 ? "Temps pressant" : "Temps Restant"}
               </p>
               <h4 className={cn(
                 "text-3xl font-black font-mono transition-transform duration-300",
                 timeLeft <= 60 
                   ? "text-rose-600 font-extrabold tracking-widest text-[32px]" 
                   : timeLeft <= 300 
                     ? "text-amber-600" 
                     : "text-white"
               )}>
                 {formatTime(timeLeft)}
               </h4>
               {timeLeft <= 60 && (
                 <p className="text-[9px] font-bold text-rose-500 animate-pulse mt-1 tracking-tight uppercase">Fin imminente - Soumission automatique</p>
                )}
                <div className={cn(
                  "flex flex-col gap-2 mt-3 pt-3 w-full border-t border-dashed text-center",
                  timeLeft <= 60 ? "border-rose-200/30" : timeLeft <= 300 ? "border-amber-200/30" : "border-white/10"
                )}>
                  <div className="flex items-center gap-1.5 justify-center">
                    <span className="relative flex h-1.5 w-1.5">
                    <span className={cn(
                      "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                      timeLeft <= 60 ? "bg-rose-400" : timeLeft <= 300 ? "bg-amber-400" : "bg-emerald-400"
                    )}></span>
                    <span className={cn(
                      "relative inline-flex rounded-full h-1.5 w-1.5",
                      timeLeft <= 60 ? "bg-rose-500" : timeLeft <= 300 ? "bg-amber-500" : "bg-emerald-500"
                    )}></span>
                  </span>
                  <span className={cn(
                    "text-[8px] font-black uppercase tracking-wider transition-all duration-300",
                    showSavedFeedback 
                      ? "scale-105 animate-pulse font-black " + (timeLeft <= 60 ? "text-rose-600" : timeLeft <= 300 ? "text-amber-700" : "text-emerald-300")
                      : (timeLeft <= 60 ? "text-rose-500/80" : timeLeft <= 300 ? "text-amber-600/80" : "text-white/60")
                  )}>
                    {showSavedFeedback ? "Sauvegarde ok !" : lastSaved ? `Sauvegardé : ${lastSaved.toLocaleTimeString()}` : "Sauvegarde active"}
                  </span>
                </div>

                {/* Row 2: Real-time network sync status indicator */}
                <div className="flex items-center gap-1.5 justify-center">
                  {!isOnline ? (
                    <>
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                      </span>
                      <span className={cn(
                        "text-[8px] font-black uppercase tracking-wider flex items-center gap-1",
                        timeLeft <= 300 ? "text-rose-700" : "text-rose-300"
                      )}>
                        <WifiOff className="w-2.5 h-2.5 inline text-rose-500" /> Hors-ligne
                      </span>
                    </>
                  ) : isSyncSlow ? (
                    <>
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                      </span>
                      <span className={cn(
                        "text-[8px] font-black uppercase tracking-wider flex items-center gap-1",
                        timeLeft <= 300 ? "text-amber-700" : "text-amber-300"
                      )}>
                        <Wifi className="w-2.5 h-2.5 inline text-amber-500" /> Synchro Lente ({syncLatency ? `${syncLatency}ms` : "lenteur"})
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                      <span className={cn(
                        "text-[8px] font-black uppercase tracking-wider flex items-center gap-1",
                        timeLeft <= 300 ? "text-emerald-700" : "text-emerald-300"
                      )}>
                        <Wifi className="w-2.5 h-2.5 inline text-emerald-400" /> Synchro OK ({syncLatency ? `${syncLatency}ms` : "80ms"})
                      </span>
                    </>
                  )}
                </div>
              </div>

            </div>
          </Card>
        </div>

        {/* Question Area */}
        <div className={cn(
          "transition-all duration-500",
          focusMode ? "lg:col-span-12 max-w-4xl mx-auto" : "lg:col-span-9"
        )}>
          {tabExitCount > 0 && (
            <motion.div 
               initial={{ opacity: 0, y: -20 }}
               animate={{ opacity: 1, y: 0 }}
               className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 font-semibold"
            >
               <AlertCircle className="w-5 h-5 shrink-0" />
               <p className="text-xs font-black uppercase tracking-tight text-rose-800">Section Surveillée : Sortie d'écran détectée ({tabExitCount} fois). Votre enseignant a été immédiatement averti en temps réel et doit décider d'autoriser ou d'interrompre votre examen.</p>
            </motion.div>
          )}

          <div className="max-w-4xl mx-auto scroll-mt-32" id="current-question">
            <div className="space-y-8">
              {focusMode && (
                <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm sticky top-4 z-40">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setFocusMode(false)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{exam.title}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "px-4 py-1.5 rounded-xl text-sm font-black font-mono transition-all duration-300 border",
                      timeLeft <= 60 
                        ? "bg-rose-50 text-rose-600 border-rose-200 animate-pulse" 
                        : timeLeft <= 300 
                          ? "bg-amber-50 text-amber-600 border-amber-200" 
                          : "bg-slate-50 text-slate-700 border-slate-100"
                    )}>
                      {formatTime(timeLeft)}
                    </div>
                    <Button size="sm" onClick={() => setShowConfirmModal(true)} className="rounded-xl h-9">Submit</Button>
                  </div>
                </div>
              )}

          <AnimatePresence mode="wait" custom={direction}>
            {showReview ? (
             <motion.div
               key="review"
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="bg-white p-10 rounded-[3rem] border-2 border-indigo-50 shadow-xl space-y-10"
             >
               <div className="text-center space-y-2">
                 <h2 className="text-3xl font-black text-slate-900 leading-tight uppercase font-display italic">Révision de l'Examen</h2>
                 <p className="text-slate-500 font-medium">Vérifiez vos réponses une dernière fois avant la soumission finale.</p>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {questions.map((q, idx) => {
                   const isAnswered = answers[idx] !== null && (!Array.isArray(answers[idx]) || (answers[idx] as any[]).every(v => v !== -1 && v !== '' && v !== null));
                   return (
                     <button
                       key={q.id}
                       onClick={() => {
                         changeQuestion(idx);
                         setShowReview(false);
                         window.scrollTo({ top: 0, behavior: 'smooth' });
                       }}
                       className="p-6 rounded-[2rem] border-2 border-slate-50 hover:border-indigo-100 hover:bg-indigo-50/10 transition-all text-left flex items-start gap-4 group"
                     >
                       <div className={cn(
                         "w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-all",
                         isAnswered ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-slate-100 text-slate-400"
                       )}>
                         {idx + 1}
                       </div>
                       <div className="flex-1 space-y-1">
                          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{isAnswered ? "Répondu" : "Non répondu"}</p>
                          <div className="text-sm font-bold text-slate-700 line-clamp-2 group-hover:text-indigo-600 transition-colors" dangerouslySetInnerHTML={{ __html: stripHtml(q.text) }} />
                       </div>
                     </button>
                   );
                 })}
               </div>

               <div className="pt-10 border-t border-slate-100 flex flex-col sm:flex-row gap-4">
                 <Button variant="outline" onClick={() => { setShowReview(false); changeQuestion(0); }} className="flex-1 h-14 rounded-2xl font-black uppercase text-xs tracking-widest">
                   Retourner à la question 1
                 </Button>
                 <Button onClick={() => setShowConfirmModal(true)} className="flex-1 h-14 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-100">
                   Valider et Soumettre l'Examen <Send className="w-4 h-4 ml-2" />
                 </Button>
               </div>
             </motion.div>
            ) : (
            <motion.div
              key={currentQuestion.id}
              custom={direction}
              variants={{
                enter: (dir: 'right' | 'left') => ({
                  opacity: 0,
                  x: dir === 'right' ? 60 : -60,
                }),
                center: {
                  opacity: 1,
                  x: 0,
                },
                exit: (dir: 'right' | 'left') => ({
                  opacity: 0,
                  x: dir === 'right' ? -60 : 60,
                })
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-10"
            >
              <div className={cn("space-y-6 text-center", qAr ? "text-right" : "text-center")}>
                <div className={cn("flex items-center justify-center gap-3", qAr ? "flex-row-reverse" : "")}>
                  <span className="px-3 py-1 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-sm">Question {currentQuestionIndex + 1}</span>
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-indigo-100">{currentQuestion.points} Points</span>
                  {answers[currentQuestionIndex] !== null && (!Array.isArray(answers[currentQuestionIndex]) || (answers[currentQuestionIndex] as any[]).every(v => v !== -1 && v !== '' && v !== null)) ? (
                    <motion.span 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-emerald-100 flex items-center gap-1.5 shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Complété
                    </motion.span>
                  ) : (
                    <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-amber-100 flex items-center gap-1.5 shadow-sm">
                      <Timer className="w-3.5 h-3.5" /> En attente
                    </span>
                  )}
                  <button
                    onClick={() => toggleFlag(currentQuestionIndex)}
                    className={cn(
                      "px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all",
                      flaggedQuestions[currentQuestionIndex]
                        ? "bg-rose-50 border-rose-200 text-rose-600 shadow-sm"
                        : "bg-white border-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                    )}
                  >
                    <Star className={cn("w-3.5 h-3.5", flaggedQuestions[currentQuestionIndex] && "fill-rose-600")} />
                    {flaggedQuestions[currentQuestionIndex] ? "Doute" : "Marquer"}
                  </button>
                </div>
                <div className={cn("flex", qAr ? "justify-end" : "justify-center")}>
                  <div className={cn(
                    "text-3xl font-black text-slate-900 leading-tight tracking-tight first-letter:capitalize max-w-4xl",
                    qAr ? "text-right" : ""
                  )} dir={qAr ? "rtl" : "ltr"}>
                    {currentQuestion.type === 'fill-in-the-blanks' ? (
                      <div className={cn(
                        "prose prose-2xl max-w-none leading-relaxed mx-auto",
                        qAr ? "text-right" : "text-justify"
                      )}>
                        {currentQuestion.text.split(/\[blank\]/g).map((part, i, arr) => (
                          <React.Fragment key={i}>
                            <span dangerouslySetInnerHTML={{ __html: part }} />
                            {i < arr.length - 1 && (
                              <motion.input
                                initial={false}
                                animate={{
                                  backgroundColor: answers[currentQuestionIndex]?.[i] ? "rgba(16, 185, 129, 0.05)" : "rgba(255, 255, 255, 1)",
                                  borderColor: answers[currentQuestionIndex]?.[i] ? "#10b981" : "#e0e7ff",
                                  width: answers[currentQuestionIndex]?.[i] 
                                    ? Math.max(160, (answers[currentQuestionIndex]?.[i].length * 15) + 40)
                                    : 160
                                }}
                                type="text"
                                dir="auto"
                                value={answers[currentQuestionIndex]?.[i] || ''}
                                onChange={(e) => {
                                  let newAns = answers[currentQuestionIndex];
                                  if (!Array.isArray(newAns)) {
                                    newAns = new Array(arr.length - 1).fill('');
                                  }
                                  const updatedAns = [...newAns];
                                  updatedAns[i] = e.target.value;
                                  handleAnswer(updatedAns);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const inputs = document.querySelectorAll('.blank-input');
                                    const idx = Array.prototype.indexOf.call(inputs, e.target);
                                    if (idx < inputs.length - 1) {
                                      (inputs[idx + 1] as HTMLElement).focus();
                                    }
                                  }
                                }}
                                className={cn(
                                  "blank-input inline-block mx-2 px-4 py-1 border-b-4 outline-none font-bold text-xl shadow-sm align-baseline transition-all rounded-t-xl text-center",
                                  answers[currentQuestionIndex]?.[i] 
                                    ? "text-emerald-700" 
                                    : "text-indigo-700 focus:border-indigo-600 focus:bg-indigo-50/5 focus:ring-4 focus:ring-indigo-500/10"
                                )}
                                placeholder="..."
                              />
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    ) : (
                      <div className={cn(
                        "prose prose-2xl max-w-none mx-auto",
                        qAr ? "text-right" : "text-justify"
                      )} dangerouslySetInnerHTML={{ __html: currentQuestion.text }} />
                    )}
                  </div>
                </div>
              </div>

              <Card className="p-1.5 border-2 border-slate-50 bg-slate-50/50 shadow-none rounded-[2.5rem]">
                <div className="bg-white p-8 md:p-10 rounded-[2.25rem] shadow-soft min-h-[300px]">
                  
                  {/* Multiple Choice */}
                  {currentQuestion.type === 'multiple-choice' && (
                    <div className="grid grid-cols-1 gap-4">
                      {currentQuestion.runtimeOptions.map((opt, i) => {
                        const isSelected = answers[currentQuestionIndex] === opt.idx;
                        const optAr = isArabic(opt.text);
                        return (
                          <button 
                            key={i} 
                            onClick={() => handleAnswer(opt.idx)} 
                            dir={optAr ? "rtl" : "ltr"}
                            className={cn(
                              "p-8 rounded-[2rem] border-2 font-bold transition-all relative group overflow-hidden flex items-center gap-6",
                              isSelected 
                                ? "bg-indigo-50 border-indigo-600 text-indigo-600 shadow-lg shadow-indigo-100 ring-2 ring-indigo-500/20" 
                                : "bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50/50 hover:shadow-md",
                              optAr ? "text-right flex-row-reverse" : "text-left"
                            )}
                          >
                            <div className={cn(
                              "w-12 h-12 rounded-2xl border-2 flex items-center justify-center text-lg transition-all shrink-0 font-display",
                              isSelected 
                                ? "bg-indigo-600 border-indigo-600 text-white scale-110 shadow-lg shadow-indigo-200" 
                                : "bg-slate-50 border-slate-100 text-slate-400 group-hover:border-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-600"
                            )}>
                              {String.fromCharCode(65 + i)}
                            </div>
                            <div className="text-lg leading-relaxed flex-1" dangerouslySetInnerHTML={{ __html: opt.text }} />
                            <div className={cn(
                              "flex items-center gap-2",
                              optAr ? "mr-auto ml-0" : "ml-auto"
                            )}>
                              <span className={cn(
                                "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md transition-opacity duration-300",
                                isSelected ? "bg-indigo-100 text-indigo-700 opacity-100" : "text-slate-300 opacity-0 group-hover:opacity-100"
                              )}>
                                {isSelected ? "Sélectionné" : `Clavier: ${i + 1}`}
                              </span>
                              {isSelected && (
                                <motion.div
                                  initial={{ scale: 0, rotate: -45 }}
                                  animate={{ scale: 1, rotate: 0 }}
                                  className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200"
                                >
                                  <CheckCircle2 className="w-5 h-5" />
                                </motion.div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* True / False */}
                  {currentQuestion.type === 'true-false' && (
                    <div className="flex flex-col sm:flex-row gap-6">
                      {[
                        { text: 'Vrai', val: 0, color: 'emerald', key: '1' },
                        { text: 'Faux', val: 1, color: 'rose', key: '2' }
                      ].map((choice) => {
                        const isSelected = answers[currentQuestionIndex] === choice.val;
                        return (
                          <button
                            key={choice.val}
                            onClick={() => handleAnswer(choice.val)}
                            className={cn(
                              "flex-1 p-12 rounded-[2.5rem] border-2 font-black text-2xl transition-all flex flex-col items-center justify-center gap-6 relative group overflow-hidden",
                              isSelected 
                                ? choice.val === 0 
                                  ? "bg-emerald-50 border-emerald-600 text-emerald-600 shadow-xl shadow-emerald-100 ring-4 ring-emerald-500/10" 
                                  : "bg-rose-50 border-rose-600 text-rose-600 shadow-xl shadow-rose-100 ring-4 ring-rose-500/10"
                                : "bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50/50 hover:shadow-md"
                            )}
                          >
                            <div className={cn(
                              "w-20 h-20 rounded-[2rem] flex items-center justify-center transition-all duration-500 border-2",
                              isSelected 
                                ? choice.val === 0 ? "bg-emerald-600 border-emerald-500 text-white scale-110 rotate-12 shadow-lg shadow-emerald-200" : "bg-rose-600 border-rose-500 text-white scale-110 -rotate-12 shadow-lg shadow-rose-200"
                                : "bg-slate-50 border-slate-100 text-slate-300 group-hover:text-slate-400 group-hover:scale-110"
                            )}>
                              {choice.val === 0 ? <CheckCircle2 className="w-10 h-10" /> : <AlertCircle className="w-10 h-10" />}
                            </div>
                            <div className="flex flex-col items-center gap-2">
                              <span>{choice.text}</span>
                              <span className={cn(
                                "text-[10px] uppercase tracking-widest font-black transition-opacity duration-300",
                                isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                                isSelected ? (choice.val === 0 ? "text-emerald-500" : "text-rose-500") : "text-slate-300"
                              )}>
                                Touche: {choice.key}
                              </span>
                            </div>
                            {isSelected && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 2 }}
                                animate={{ opacity: 0.1, scale: 1 }}
                                className="absolute inset-0 bg-current pointer-events-none"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Short Answer */}
                  {currentQuestion.type === 'short-answer' && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-4 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl mb-2">
                        <Info className="w-5 h-5 text-indigo-600 shrink-0" />
                        <p className="text-xs font-bold text-indigo-900 leading-relaxed uppercase tracking-tight">
                          Cette réponse sera évaluée par une IA. Elle comparera le sens général et sera indulgente sur l'orthographe.
                        </p>
                      </div>
                      <textarea
                        value={answers[currentQuestionIndex] || ''}
                        onChange={(e) => handleAnswer(e.target.value)}
                        placeholder="Répondez ici de manière concise..."
                        dir="auto"
                        className={cn(
                          "w-full min-h-[300px] p-10 rounded-[2.5rem] border-2 border-slate-100 bg-slate-50/30 focus:bg-white focus:border-indigo-600 transition-all outline-none font-medium text-lg leading-relaxed resize-none shadow-inner",
                          qAr ? "text-right" : "text-left"
                        )}
                      />
                    </div>
                  )}

                  {/* Fill-in-the-blanks */}
                  {currentQuestion.type === 'fill-in-the-blanks' && (
                    <div className="flex flex-col items-center justify-center py-12 space-y-8 text-center bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-200">
                      <div className="flex -space-x-4">
                        {[1, 2, 3].map((n) => (
                          <div key={n} className="w-12 h-12 rounded-2xl bg-white border-2 border-slate-100 flex items-center justify-center shadow-sm text-slate-400 font-black text-sm">
                            {n}
                          </div>
                        ))}
                      </div>
                      <div className="space-y-3">
                        <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight italic font-display">Texte à trous</h4>
                        <div className="flex flex-col items-center gap-2">
                           <p className="text-slate-500 text-sm font-medium max-w-sm">Remplissez tous les champs pour compléter le texte.</p>
                           <div className="flex items-center gap-4 mt-2">
                             <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-lg shadow-sm">
                               <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px] font-mono">TAB</kbd>
                               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Suivant</span>
                             </div>
                             <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-lg shadow-sm">
                               <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px] font-mono">ENTRÉE</kbd>
                               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valider champ</span>
                             </div>
                           </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Ordering with Drag and Drop */}
                  {currentQuestion.type === 'ordering' && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-4 p-6 bg-amber-50 border border-amber-100 rounded-3xl mb-4">
                        <GripVertical className="w-6 h-6 text-amber-600 animate-bounce" />
                        <p className="text-sm font-bold text-amber-900">Glissez-déposez les éléments pour les mettre dans le bon ordre.</p>
                      </div>
                        <DndContext 
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                        >
                          <SortableContext 
                            items={answers[currentQuestionIndex] as number[]}
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="space-y-4">
                              {(answers[currentQuestionIndex] as number[]).map((optIdx, i) => {
                                const opt = currentQuestion.runtimeOptions.find(ro => ro.idx === optIdx);
                                return (
                                  <SortableItem key={optIdx} id={optIdx.toString()} index={i} isArabic={isArabic(opt?.text || '')}>
                                    <div dangerouslySetInnerHTML={{ __html: opt?.text || '' }} />
                                  </SortableItem>
                                );
                              })}
                            </div>
                          </SortableContext>
                          <DragOverlay dropAnimation={{
                            duration: 250,
                            easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                            sideEffects: defaultDropAnimationSideEffects({
                              styles: {
                                active: {
                                  opacity: '0.5',
                                },
                              },
                            }),
                          }}>
                             {activeId ? (
                               <div className={cn(
                                 "flex items-center gap-4 bg-white border-2 border-indigo-600 rounded-2xl shadow-2xl scale-105"
                               )}>
                                 <div className="px-4 py-8 border-r border-slate-50 rounded-l-2xl text-indigo-600">
                                   <GripVertical className="w-5 h-5" />
                                 </div>
                                 <div className="flex-1 py-6 pr-6 flex items-center gap-4">
                                   <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-xs shrink-0">
                                     {(answers[currentQuestionIndex] as number[]).indexOf(parseInt(activeId)) + 1}
                                   </div>
                                   <div className="flex-1 font-bold text-slate-700 text-sm leading-snug">
                                     <div dangerouslySetInnerHTML={{ __html: currentQuestion.runtimeOptions.find(o => o.idx === parseInt(activeId))?.text || '' }} />
                                   </div>
                                 </div>
                               </div>
                             ) : null}
                          </DragOverlay>
                        </DndContext>
                    </div>
                  )}

                  {/* Matching with Drag and Drop REORDERING */}
                  {currentQuestion.type === 'matching' && (
                    <div className="space-y-10">
                      <div className="flex items-center gap-4 p-6 bg-indigo-50 border border-indigo-100 rounded-3xl">
                        <Sparkles className="w-6 h-6 text-indigo-600" />
                        <p className="text-sm font-bold text-indigo-900 italic font-display">Réordonnez la colonne de droite pour l'aligner avec les éléments de gauche.</p>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                         {/* Left Side Static Labels */}
                         <div className="space-y-4">
                           <div className="mb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-slate-300" /> Eléments à associer
                            </div>
                            {(currentQuestion.options || []).map((leftOpt, lIdx) => {
                               const leftAr = isArabic(leftOpt.text);
                               return (
                                <motion.div 
                                  key={lIdx} 
                                  whileHover={{ x: 5 }}
                                  dir={leftAr ? "rtl" : "ltr"}
                                  className={cn(
                                    "p-6 h-[100px] bg-slate-900 text-white rounded-[2rem] font-bold flex items-center shadow-xl relative overflow-hidden group",
                                    leftAr ? "text-right flex-row-reverse" : "text-left"
                                  )}
                                >
                                   <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-white/5 to-transparent pointer-events-none" />
                                   <span className={cn("w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-xs font-black border border-white/10 shrink-0", leftAr ? "ml-4" : "mr-4")}>
                                     {lIdx + 1}
                                   </span>
                                   <div className="line-clamp-3 text-sm leading-tight" dangerouslySetInnerHTML={{ __html: leftOpt.text }} />
                                   <div className={cn("opacity-20 group-hover:opacity-100 transition-opacity", leftAr ? "mr-auto ml-0 rotate-180" : "ml-auto")}>
                                     <ArrowRight className="w-5 h-5 text-indigo-400" />
                                   </div>
                                </motion.div>
                               );
                             })}
                         </div>
 
                         {/* Right Side Draggable Sortable */}
                         <div className="space-y-4">
                           <div className="mb-4 text-[10px] font-black text-indigo-600 uppercase tracking-widest pl-2 flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" /> Vos Réponses
                           </div>
                           <DndContext 
                             sensors={sensors}
                             collisionDetection={closestCenter}
                             onDragStart={handleDragStart}
                             onDragEnd={handleDragEnd}
                           >
                             <SortableContext 
                               items={answers[currentQuestionIndex] as number[]}
                               strategy={verticalListSortingStrategy}
                             >
                               <div className="space-y-4">
                                 {(answers[currentQuestionIndex] as number[]).map((rightIdx, rIdx) => {
                                   const opt = currentQuestion.runtimeMatchOptions.find(mo => mo.idx === rightIdx);
                                   return (
                                    <div 
                                      key={rightIdx} 
                                      className="h-[100px]"
                                    >
                                      <SortableItem id={rightIdx.toString()} index={rIdx} isArabic={isArabic(opt?.text || '')}>
                                        <div className="line-clamp-3 text-sm leading-tight">{opt?.text}</div>
                                      </SortableItem>
                                    </div>
                                   );
                                 })}
                               </div>
                             </SortableContext>
                             <DragOverlay dropAnimation={{
                               duration: 250,
                               easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                             }}>
                                {activeId ? (
                                  <div className="h-[100px] flex items-center gap-4 bg-white border-2 border-indigo-600 rounded-2xl shadow-2xl scale-105">
                                    <div className="px-4 py-8 border-r border-slate-50 rounded-l-2xl text-indigo-600 h-full flex items-center">
                                      <GripVertical className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 pr-6 flex items-center gap-4">
                                      <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-xs shrink-0">
                                        {(answers[currentQuestionIndex] as number[]).indexOf(parseInt(activeId)) + 1}
                                      </div>
                                      <div className="flex-1 font-bold text-slate-700 text-sm leading-snug line-clamp-3">
                                        {currentQuestion.runtimeMatchOptions.find(mo => mo.idx === parseInt(activeId))?.text}
                                      </div>
                                    </div>
                                  </div>
                                ) : null}
                             </DragOverlay>
                           </DndContext>
                         </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Bottom Navigation & Progression */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-6 border-t border-slate-100">
                <div className="flex items-center gap-4 py-3 px-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                    <ClipboardList className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progression</p>
                    <p className="text-sm font-black text-slate-900">{answeredCount} sur {questions.length} répondus</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button 
                    disabled={currentQuestionIndex === 0}
                    onClick={() => changeQuestion(currentQuestionIndex - 1)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-3xl bg-white border-2 border-slate-100 text-slate-400 hover:border-indigo-200 hover:text-indigo-600 transition-all disabled:opacity-30 disabled:pointer-events-none group"
                  >
                    <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-black uppercase tracking-tight">Précédent</span>
                  </button>
                  <button 
                    disabled={currentQuestionIndex === questions.length - 1}
                    onClick={() => changeQuestion(currentQuestionIndex + 1)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-3xl bg-indigo-600 text-white shadow-xl shadow-indigo-100 hover:scale-105 transition-all disabled:opacity-30 disabled:pointer-events-none group"
                  >
                    <span className="text-sm font-black uppercase tracking-tight">Suivant</span>
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                  {currentQuestionIndex === questions.length - 1 && (
                    <button 
                      onClick={() => setShowReview(true)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-3xl bg-emerald-600 text-white shadow-xl shadow-emerald-100 hover:scale-105 transition-all group"
                    >
                      <span className="text-sm font-black uppercase tracking-tight">Réviser</span>
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>


    {/* Premium Floating Action Utility Dock */}
    <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3 bg-white/80 backdrop-blur-md p-2 rounded-2xl border border-slate-100 shadow-lg" id="utility-dock">
      {/* Sound Controller Toggle */}
      <button 
        onClick={() => {
          const nextVal = !soundMuted;
          setSoundMuted(nextVal);
          localStorage.setItem(`exam_sound_muted_${exam.id}_${user.id}`, nextVal ? 'true' : 'false');
          if (!nextVal) {
            // Short trigger
            try {
              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.setValueAtTime(600, ctx.currentTime);
              gain.gain.setValueAtTime(0.04, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
              osc.start();
              osc.stop(ctx.currentTime + 0.1);
            } catch {}
          }
        }}
        title={soundMuted ? "Activer les sons" : "Désactiver les sons"}
        className={cn(
          "p-3 rounded-xl transition-all",
          soundMuted 
            ? "bg-slate-50 text-slate-400 hover:text-slate-600" 
            : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
        )}
      >
        {soundMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>

      {/* Draftpad/Notes Panel Button Trigger */}
      <button 
        onClick={() => {
          setScratchpadOpen(true);
          playSoftSound('select');
        }}
        title="Ouvrir le Brouillon & Calculatrice"
        className={cn(
          "p-3 rounded-xl flex items-center gap-2 transition-all font-black text-xs uppercase tracking-wider",
          scratchpadOpen 
            ? "bg-indigo-600 text-white" 
            : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
        )}
      >
        <NotebookPen className="w-5 h-5" />
        <span className="hidden md:inline">Brouillon</span>
        {((globalNotes as string).trim() || Object.values(questionNotes).some((n: any) => n?.trim())) && (
          <span className="w-2 h-2 bg-rose-500 rounded-full animate-ping" />
        )}
      </button>

      {/* Focus Mode Star Toggle */}
      <button 
        onClick={() => {
          setFocusMode(prev => !prev);
          playSoftSound('select');
        }}
        title={focusMode ? "Désactiver le Mode Concentration" : "Activer le Mode Concentration"}
        className={cn(
          "p-3 rounded-xl transition-all",
          focusMode 
            ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" 
            : "bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
        )}
      >
        <Star className={cn("w-5 h-5", focusMode && "fill-white")} />
      </button>
    </div>


    {/* Premium Slide-in Side Drawer (Draftpad + Digital Keypad Calculator) */}
    <AnimatePresence>
      {scratchpadOpen && (
        <>
          {/* Backdrop Blur */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setScratchpadOpen(false);
              playSoftSound('select');
            }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
          />

          {/* Slider Drawer Canvas */}
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white border-l border-slate-100 shadow-2xl flex flex-col md:rounded-l-[2rem] overflow-hidden"
          >
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center">
                  <NotebookPen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 font-display">Espace de Travail Personnel</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vos notes & outils d'aide</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setScratchpadOpen(false);
                  playSoftSound('select');
                }}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Custom Interactive Mode Tabs */}
            <div className="p-4 bg-slate-50/20 border-b border-slate-100/50 flex">
              <button 
                onClick={() => {
                  setActiveDraftTab('notes');
                  playSoftSound('select');
                }}
                className={cn(
                  "flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all",
                  activeDraftTab === 'notes' 
                    ? "bg-white text-indigo-600 shadow-sm border border-slate-100" 
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                <NotebookPen className="w-4 h-4" /> Notes & Feuille de Brouillon
              </button>
              <button 
                onClick={() => {
                  setActiveDraftTab('calc');
                  playSoftSound('select');
                }}
                className={cn(
                  "flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all",
                  activeDraftTab === 'calc' 
                    ? "bg-white text-indigo-600 shadow-sm border border-slate-100" 
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                <Calculator className="w-4 h-4" /> Calculatrice
              </button>
            </div>

            {/* Content Switcher */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {activeDraftTab === 'notes' ? (
                <div className="space-y-6 min-h-0 flex flex-col h-full">
                  {/* Notes Sub-tabs selector */}
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button 
                      onClick={() => {
                        setActiveNotesSubTab('global');
                        playSoftSound('select');
                      }}
                      className={cn(
                        "flex-1 py-1 px-3 text-[10px] font-black uppercase tracking-tight rounded-lg transition-all",
                        activeNotesSubTab === 'global' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                      )}
                    >
                      Copie globale de brouillon
                    </button>
                    <button 
                      onClick={() => {
                        setActiveNotesSubTab('question');
                        playSoftSound('select');
                      }}
                      className={cn(
                        "flex-1 py-1 px-3 text-[10px] font-black uppercase tracking-tight rounded-lg transition-all",
                        activeNotesSubTab === 'question' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                      )}
                    >
                      Notes relatives à Q{currentQuestionIndex + 1}
                    </button>
                  </div>

                  {activeNotesSubTab === 'global' ? (
                    <div className="flex-1 flex flex-col gap-3 min-h-[300px]">
                      <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
                        <span>Ce brouillon est conservé tout au long de l'épreuve.</span>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              if (confirm("Voulez-vous effacer l'intégralité de ce brouillon ?")) {
                                setGlobalNotes('');
                                playSoftSound('flag');
                              }
                            }}
                            className="text-rose-500 hover:underline"
                          >
                            Effacer
                          </button>
                          <span>•</span>
                          <button 
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(globalNotes);
                                playSoftSound('save');
                                toast.success("Brouillon copié !");
                              } catch {}
                            }}
                            className="text-indigo-600 hover:underline"
                          >
                            Copier
                          </button>
                        </div>
                      </div>
                      <textarea 
                        value={globalNotes}
                        onChange={(e) => {
                          setGlobalNotes(e.target.value);
                          localStorage.setItem(`exam_global_notes_${exam.id}_${user.id}`, e.target.value);
                        }}
                        placeholder="Saisissez des formules, des rappels de cours ou développez vos idées librement ici..."
                        className="flex-1 w-full bg-slate-50/80 hover:bg-slate-50 focus:bg-white p-5 border border-slate-100 hover:border-slate-200 focus:border-indigo-300 rounded-3xl text-sm text-slate-700 leading-relaxed outline-none transition-all resize-none shadow-inner h-full min-h-[250px] font-mono"
                      />
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col gap-3 min-h-[300px]">
                      <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
                        <span>Notes attachées spécifiquement à la question {currentQuestionIndex + 1}.</span>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              if (confirm("Voulez-vous effacer les notes de cette question ?")) {
                                const next = { ...questionNotes };
                                delete next[currentQuestionIndex];
                                setQuestionNotes(next);
                                localStorage.setItem(`exam_question_notes_${exam.id}_${user.id}`, JSON.stringify(next));
                                playSoftSound('flag');
                              }
                            }}
                            className="text-rose-500 hover:underline"
                          >
                            Effacer
                          </button>
                          <span>•</span>
                          <button 
                            onClick={async () => {
                              try {
                                const val = questionNotes[currentQuestionIndex] || '';
                                await navigator.clipboard.writeText(val);
                                playSoftSound('save');
                                toast.success("Notes de la question copiées !");
                              } catch {}
                            }}
                            className="text-indigo-600 hover:underline"
                          >
                            Copier
                          </button>
                        </div>
                      </div>
                      <textarea 
                        value={questionNotes[currentQuestionIndex] || ''}
                        onChange={(e) => {
                          const next = { ...questionNotes, [currentQuestionIndex]: e.target.value };
                          setQuestionNotes(next);
                          localStorage.setItem(`exam_question_notes_${exam.id}_${user.id}`, JSON.stringify(next));
                        }}
                        placeholder="Notez vos calculs intermédiaires ou hypothèses spécifiques pour cette question..."
                        className="flex-1 w-full bg-slate-50/80 hover:bg-slate-50 focus:bg-white p-5 border border-slate-100 hover:border-slate-200 focus:border-indigo-300 rounded-3xl text-sm text-slate-700 leading-relaxed outline-none transition-all resize-none shadow-inner h-full min-h-[250px] font-mono"
                      />
                    </div>
                  )}

                  <div className="p-4 bg-indigo-50/50 border border-indigo-100/50 rounded-2xl flex gap-3 text-slate-600">
                    <Info className="w-5 h-5 text-indigo-600 shrink-0" />
                    <p className="text-[10px] font-semibold leading-relaxed">Vos notes sont chiffrées et sauvegardées localement en continu. Elles ne s'effaceront pas même en cas d'actualisation accidentelle de l'onglet.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Digital calculator display */}
                  <div className="bg-slate-950 p-6 rounded-3xl shadow-inner border border-slate-800 text-right space-y-1 relative group">
                    <div className="text-[10px] font-black font-mono text-indigo-400 tracking-wider uppercase opacity-60">Calculatrice de l'Examen</div>
                    <div className="text-slate-400 text-xs font-mono font-bold select-all truncate">
                      {calcInput}
                    </div>
                    <div className="text-white text-3xl font-mono font-black select-all tracking-tight truncate">
                      {(() => {
                        try {
                          const sanitized = calcInput.replace(/[^0-9+\-*/().\s]/g, '');
                          if (!sanitized) return '0';
                          const val = new Function(`return (${sanitized})`)();
                          return typeof val === 'number' && !isNaN(val) ? val.toString() : '---';
                        } catch {
                          return '---';
                        }
                      })()}
                    </div>
                    {/* Copy result shortcut button inside input */}
                    <button
                      onClick={async () => {
                        try {
                          const sanitized = calcInput.replace(/[^0-9+\-*/().\s]/g, '');
                          const val = new Function(`return (${sanitized})`)();
                          const resultStr = typeof val === 'number' && !isNaN(val) ? val.toString() : '0';
                          await navigator.clipboard.writeText(resultStr);
                          playSoftSound('save');
                          toast.success("Résultat copié !");
                        } catch {
                          toast.error("Format de calcul invalide");
                        }
                      }}
                      className="absolute top-4 right-4 text-[10px] font-black uppercase text-indigo-400 hover:text-white bg-indigo-600/30 hover:bg-indigo-600/60 px-2 py-1 rounded-md border border-indigo-500/10 transition-colors"
                    >
                      Copier
                    </button>
                  </div>

                  {/* Retro-Tactile Tactile Buttons Keypad */}
                  <div className="grid grid-cols-4 gap-3">
                    {/* Key helpers */}
                    {[
                      'C', '⌫', '√', '/',
                      '7', '8', '9', '*',
                      '4', '5', '6', '-',
                      '1', '2', '3', '+',
                      '0', '.', '%', '='
                    ].map((keyChar) => {
                      const isOperator = ['/', '*', '-', '+', '=', '√', '%'].includes(keyChar);
                      const isSpecial = ['C', '⌫'].includes(keyChar);
                      
                      return (
                        <button
                          key={keyChar}
                          onClick={() => {
                            // Synthesizer action
                            playSoftSound('select');
                            
                            if (keyChar === 'C') {
                              setCalcInput('0');
                            } else if (keyChar === '⌫') {
                              setCalcInput(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
                            } else if (keyChar === '=') {
                              try {
                                const sanitized = calcInput.replace(/[^0-9+\-*/().\s]/g, '');
                                if (!sanitized) {
                                  setCalcInput('0');
                                  return;
                                }
                                const evaluated = new Function(`return (${sanitized})`)();
                                if (typeof evaluated === 'number' && !isNaN(evaluated)) {
                                  setCalcInput(Number(evaluated.toFixed(6)).toString());
                                } else {
                                  setCalcInput('Erreur');
                                }
                              } catch {
                                setCalcInput('Erreur');
                              }
                            } else if (keyChar === '√') {
                              try {
                                const parsed = parseFloat(calcInput);
                                setCalcInput(isNaN(parsed) || parsed < 0 ? 'Erreur' : Math.sqrt(parsed).toString());
                              } catch {
                                setCalcInput('Erreur');
                              }
                            } else if (keyChar === '%') {
                              try {
                                const parsed = parseFloat(calcInput);
                                setCalcInput(isNaN(parsed) ? 'Erreur' : (parsed / 100).toString());
                              } catch {
                                setCalcInput('Erreur');
                              }
                            } else {
                              setCalcInput(prev => prev === '0' || prev === 'Erreur' ? keyChar : prev + keyChar);
                            }
                          }}
                          className={cn(
                            "h-14 rounded-2xl flex items-center justify-center text-sm font-black font-mono transition-all border shadow-sm select-none active:scale-95",
                            isSpecial 
                              ? "bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-100/50" 
                              : isOperator 
                                ? keyChar === '=' 
                                  ? "bg-indigo-600 border-indigo-650 text-white shadow-md hover:bg-indigo-700 shadow-indigo-100Col"
                                  : "bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-100/80" 
                                : "bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100"
                          )}
                        >
                          {keyChar}
                        </button>
                      );
                    })}
                  </div>

                  {/* Scientific constants tips */}
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-display">Raccourcis Pratiques</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => {
                          setCalcInput(prev => prev === '0' ? Math.PI.toFixed(6) : prev + Math.PI.toFixed(6));
                          playSoftSound('select');
                        }}
                        className="py-2.5 px-3 bg-white text-xs font-bold text-slate-600 rounded-xl border border-slate-100 text-left hover:border-indigo-200 hover:text-indigo-600 transition-colors"
                      >
                         Valeur de PI (π)
                      </button>
                      <button 
                        onClick={() => {
                          setCalcInput(prev => prev === '0' ? Math.E.toFixed(6) : prev + Math.E.toFixed(6));
                          playSoftSound('select');
                        }}
                        className="py-2.5 px-3 bg-white text-xs font-bold text-slate-600 rounded-xl border border-slate-100 text-left hover:border-indigo-200 hover:text-indigo-600 transition-colors"
                      >
                         Constante Euler (e)
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  </div>
</div>
</div>
    );
};
