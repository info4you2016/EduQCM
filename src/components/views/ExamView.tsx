import React, { useState, useEffect, useCallback } from 'react';
import { 
  Clock, CheckCircle2, Send, AlertCircle, ArrowRight, ClipboardList, 
  Sparkles, ArrowUp, ArrowDown, GripVertical, Timer, ChevronLeft, ChevronRight,
  Info, Star
} from 'lucide-react';
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
import { api } from '../../lib/api';
import { evaluateShortAnswer } from '../../lib/gemini';
import { cn, stripHtml, normalizeQuestion, getExamTotalPoints, formatDuration } from '../../lib/utils';
import { Exam, UserProfile } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import confetti from 'canvas-confetti';

interface ExamViewProps {
  exam: Exam;
  onComplete: () => void;
  onCancel: () => void;
  user: UserProfile;
  moduleName?: string;
}

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

export const ExamView = ({ exam, onComplete, onCancel, user, moduleName }: ExamViewProps) => {
  const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text || '');
  const [questions] = useState(() => {
    const savedQs = localStorage.getItem(`exam_questions_${exam.id}_${user.id}`);
    if (savedQs) {
      try {
        return JSON.parse(savedQs);
      } catch (e) {
        console.error("Error parsing saved questions", e);
      }
    }

    let qs = exam.questions.map((rawQ, idx) => {
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
    localStorage.setItem(`exam_questions_${exam.id}_${user.id}`, JSON.stringify(qs));
    return qs;
  });

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(() => {
    const saved = localStorage.getItem(`exam_current_index_${exam.id}_${user.id}`);
    return saved ? parseInt(saved) : 0;
  });
  const [answers, setAnswers] = useState<any[]>(() => {
    const saved = localStorage.getItem(`exam_answers_${exam.id}_${user.id}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing saved answers", e);
      }
    }
    return questions.map(q => {
      if (q.type === 'ordering') return q.runtimeOptions.map(opt => opt.idx);
      if (q.type === 'matching') return q.runtimeMatchOptions.map(mOpt => mOpt.idx);
      if (q.type === 'fill-in-the-blanks') return new Array(q.correctAnswers?.length || 0).fill('');
      return null;
    });
  });
  const [hasStarted, setHasStarted] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiGrading, setIsAiGrading] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [isAutoSubmitted, setIsAutoSubmitted] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState(exam.durationMinutes * 60);
  const [activeId, setActiveId] = useState<string | null>(null);

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
    if (!hasStarted || showCompletion || isSubmitting) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasStarted, showCompletion, isSubmitting]);

  useEffect(() => {
    if (hasStarted && !showCompletion && !isSubmitting) {
      localStorage.setItem(`exam_answers_${exam.id}_${user.id}`, JSON.stringify(answers));
      localStorage.setItem(`exam_current_index_${exam.id}_${user.id}`, currentQuestionIndex.toString());
    }
  }, [answers, currentQuestionIndex, hasStarted, showCompletion, isSubmitting, exam.id, user.id]);

  const currentQuestion = questions[currentQuestionIndex];

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
    localStorage.removeItem(`exam_start_${exam.id}_${user.id}`);
    localStorage.removeItem(`exam_answers_${exam.id}_${user.id}`);
    localStorage.removeItem(`exam_current_index_${exam.id}_${user.id}`);
    localStorage.removeItem(`exam_questions_${exam.id}_${user.id}`);
    
    const normalizeStr = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");

    const gradingPromises = questions.map(async (q, idx) => {
      const ans = answers[idx];
      if (!q) return { isCorrect: false, pointsEarned: 0 };

      const points = q.points || 1;
      let pointsEarned = 0;
      let isCorrect = false;

      if (q.type === 'short-answer') {
        const studentAns = ans?.toString().trim() || '';
        const studentAnsPlainText = stripHtml(studentAns);
        const expectedAns = stripHtml(q.correctAnswer || '').trim();
        
        if (normalizeStr(studentAnsPlainText) === normalizeStr(expectedAns)) {
          isCorrect = true;
          pointsEarned = points;
        } else if (studentAnsPlainText && expectedAns) {
          try {
            const scoreMultiplier = await evaluateShortAnswer(stripHtml(q.text), expectedAns, studentAns);
            pointsEarned = scoreMultiplier * points;
            isCorrect = scoreMultiplier >= 0.8; 
          } catch (e) {
            isCorrect = normalizeStr(studentAnsPlainText) === normalizeStr(expectedAns);
            pointsEarned = isCorrect ? points : 0;
          }
        }
      } else if (q.type === 'fill-in-the-blanks') {
        const totalBlanks = (q.correctAnswers || []).length;
        if (totalBlanks > 0) {
          const correctCount = (q.correctAnswers || []).filter((ca, i) => normalizeStr(ans?.[i]?.toString() || '') === normalizeStr(ca)).length;
          pointsEarned = (correctCount / totalBlanks) * points;
          isCorrect = correctCount === totalBlanks;
        }
      } else if (q.type === 'ordering') {
        const totalItems = (q.correctOrder || []).length;
        if (totalItems > 0) {
          const correctPositions = (q.correctOrder || []).filter((correctIdx, i) => ans?.[i] === correctIdx).length;
          pointsEarned = (correctPositions / totalItems) * points;
          isCorrect = correctPositions === totalItems;
        }
      } else if (q.type === 'matching') {
        const totalMatches = (q.correctMatches || []).length;
        if (totalMatches > 0) {
          const correctMatches = (q.correctMatches || []).filter((correctRightIdx, i) => ans?.[i] === correctRightIdx).length;
          pointsEarned = (correctMatches / totalMatches) * points;
          isCorrect = correctMatches === totalMatches;
        }
      } else {
        isCorrect = ans !== null && ans !== undefined && q.options?.[ans as number]?.isCorrect === true;
        pointsEarned = isCorrect ? points : 0;
      }

      return { isCorrect, pointsEarned };
    });

    const finalQuestionResults = await Promise.all(gradingPromises);
    const totalScore = finalQuestionResults.reduce((sum, res) => sum + res.pointsEarned, 0);
    const totalPossiblePoints = questions.reduce((sum, q) => sum + (q.points || 1), 0);

    try {
      await api.results.create({
        examId: exam.id,
        score: totalScore,
        totalQuestions: questions.length,
        totalPoints: totalPossiblePoints,
        answers: exam.questions.map((originalQ, origIdx) => {
          const qId = originalQ.id || `q-${origIdx}`;
          const shuffledIdx = questions.findIndex(q => q.id === qId);
          return shuffledIdx !== -1 ? answers[shuffledIdx] : null;
        }),
        questionResults: exam.questions.map((originalQ, origIdx) => {
          const qId = originalQ.id || `q-${origIdx}`;
          const shuffledIdx = questions.findIndex(q => q.id === qId);
          return shuffledIdx !== -1 ? finalQuestionResults[shuffledIdx] : { isCorrect: false, pointsEarned: 0 };
        })
      });

      if (!isAuto) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444']
        });
      }

      setShowCompletion(true);
      setTimeout(() => onComplete(), 3000);
    } catch (error) {
      console.error("Error submitting result:", error);
    } finally {
      setIsSubmitting(false);
      setIsAiGrading(false);
    }
  }, [answers, questions, exam, onComplete, isSubmitting, showCompletion, user.id]);

  const [startTime] = useState(() => {
    const saved = localStorage.getItem(`exam_start_${exam.id}_${user.id}`);
    if (saved) {
      setHasStarted(true);
      return parseInt(saved);
    }
    return Date.now();
  });

  const handleStartExam = () => {
    const now = Date.now();
    localStorage.setItem(`exam_start_${exam.id}_${user.id}`, now.toString());
    setHasStarted(true);
  };

  useEffect(() => {
    if (!hasStarted || showCompletion || isSubmitting) return;
    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, (exam.durationMinutes * 60) - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        handleSubmit(true);
        return false;
      }
      return true;
    };
    if (!updateTimer()) return;
    const timer = setInterval(() => { if (!updateTimer()) clearInterval(timer); }, 1000);
    return () => clearInterval(timer);
  }, [startTime, exam.durationMinutes, showCompletion, isSubmitting, handleSubmit, hasStarted]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswer = (answer: any) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = answer;
    setAnswers(newAnswers);
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
    }
  };

  if (!currentQuestion) return null;

  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const answeredCount = answers.filter(a => a !== null && (!Array.isArray(a) || a.every(v => v !== -1))).length;
  const qAr = isArabic(currentQuestion.text);

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

  return (
    <div className="max-w-5xl mx-auto space-y-8 relative pb-32">
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
            </div>
          </Modal>
        )}
        {showCompletion && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-white p-8 sm:p-12 rounded-none sm:rounded-[3.5rem] shadow-2xl max-w-md w-full h-full sm:h-auto flex flex-col justify-center space-y-6"
            >
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">{isAutoSubmitted ? "Temps écoulé !" : "Félicitations !"}</h3>
                <p className="text-slate-500 font-medium px-4">Votre examen a été soumis avec succès. Nous calculons vos résultats.</p>
              </div>
              <div className="flex items-center justify-center gap-3 py-2">
                <div className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern Header (Static) */}
      <div className="bg-white border-b border-slate-100 -mx-4 px-4 py-4 md:py-6 mb-8 md:mb-12 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6">
        <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto">
          <div className={cn(
            "flex items-center gap-2 md:gap-4 px-4 md:px-6 py-2 md:py-3 rounded-xl md:2xl border-2 transition-all shrink-0",
            timeLeft < 60 ? "bg-rose-50 border-rose-200 text-rose-600 animate-pulse" : "bg-white border-slate-100 text-slate-900"
          )}>
            <Timer className={cn("w-5 h-5 md:w-6 md:h-6", timeLeft < 60 ? "text-rose-500" : "text-indigo-600")} />
            <span className="font-mono text-xl md:text-2xl font-black">{formatTime(timeLeft)}</span>
          </div>
          <div className="flex-1 md:w-64 space-y-1.5 md:space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Progression</span>
              <span className="text-[9px] md:text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-none">{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 md:h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }} 
                animate={{ width: `${progress}%` }} 
                className="h-full bg-indigo-600 rounded-full" 
              />
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowExitConfirm(true)} 
            className="flex-1 md:flex-none text-slate-400 font-bold hover:text-rose-500 hover:bg-rose-50 text-[10px] md:text-xs"
          >
            Abandonner
          </Button>
          <Button 
            onClick={() => handleSubmit()} 
            disabled={isSubmitting}
            size="sm"
            className="flex-[2] md:flex-none px-6 md:px-8 shadow-lg shadow-indigo-200 border-none text-[10px] md:text-xs font-black uppercase tracking-widest"
          >
            Soumettre
          </Button>
        </div>
      </div>

      {/* Question Indicators (Top Navigator) */}
      <div className="mb-10 max-w-5xl mx-auto">
        <div className="flex flex-wrap justify-center gap-2 md:gap-3">
          {questions.map((_, idx) => {
            const isAnswered = answers[idx] !== null && (!Array.isArray(answers[idx]) || answers[idx].every(v => v !== -1));
            const isActive = currentQuestionIndex === idx;
            
            return (
              <button 
                key={idx} 
                onClick={() => setCurrentQuestionIndex(idx)} 
                className={cn(
                  "w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl border-2 font-black text-xs md:text-sm flex items-center justify-center transition-all relative group",
                  isActive 
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100 scale-110 z-10" 
                    : isAnswered 
                      ? "bg-white border-emerald-500 text-emerald-600 hover:bg-emerald-50" 
                      : "bg-white border-slate-100 text-slate-400 hover:border-indigo-300 hover:text-indigo-600"
                )}
              >
                {idx + 1}
                {isAnswered && !isActive && (
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Question Interface */}
      <div className="max-w-4xl mx-auto scroll-mt-32" id="current-question">
        <div className="space-y-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="space-y-10"
            >
              <div className={cn("space-y-6 text-center", qAr ? "text-right" : "text-center")}>
                <div className={cn("flex items-center justify-center gap-3", qAr ? "flex-row-reverse" : "")}>
                  <span className="px-3 py-1 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg">Question {currentQuestionIndex + 1}</span>
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-lg">{currentQuestion.points} Points</span>
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
                              <input
                                type="text"
                                dir="auto"
                                value={answers[currentQuestionIndex]?.[i] || ''}
                                onChange={(e) => {
                                  const newAns = [...(answers[currentQuestionIndex] || [])];
                                  newAns[i] = e.target.value;
                                  handleAnswer(newAns);
                                }}
                                className="inline-block mx-2 px-4 py-1 bg-white border-b-4 border-indigo-200 focus:border-indigo-600 outline-none font-bold text-xl min-w-[140px] shadow-sm align-baseline transition-all text-indigo-700 placeholder:text-slate-200"
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
                              isSelected ? "bg-indigo-50 border-indigo-600 text-indigo-600 shadow-lg shadow-indigo-100" : "bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50/50",
                              optAr ? "text-right flex-row-reverse" : "text-left"
                            )}
                          >
                            <div className={cn(
                              "w-12 h-12 rounded-2xl border-2 flex items-center justify-center text-lg transition-all shrink-0",
                              isSelected ? "bg-indigo-600 border-indigo-600 text-white scale-110 shadow-indigo-200" : "bg-slate-50 border-slate-100 text-slate-400 group-hover:border-slate-300"
                            )}>
                              {String.fromCharCode(65 + i)}
                            </div>
                            <div className="text-lg leading-relaxed" dangerouslySetInnerHTML={{ __html: opt.text }} />
                            {isSelected && (
                              <div className={cn("ml-auto", optAr ? "mr-auto ml-0" : "ml-auto")}>
                                <CheckCircle2 className="w-6 h-6 text-indigo-600" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* True / False */}
                  {currentQuestion.type === 'true-false' && (
                    <div className="flex flex-col sm:flex-row gap-6">
                      {[
                        { text: 'Vrai', val: 0, color: 'emerald' },
                        { text: 'Faux', val: 1, color: 'rose' }
                      ].map((choice) => {
                        const isSelected = answers[currentQuestionIndex] === choice.val;
                        return (
                          <button
                            key={choice.val}
                            onClick={() => handleAnswer(choice.val)}
                            className={cn(
                              "flex-1 p-12 rounded-[2.5rem] border-2 font-black text-2xl transition-all flex flex-col items-center justify-center gap-4",
                              isSelected 
                                ? choice.val === 0 
                                  ? "bg-emerald-50 border-emerald-600 text-emerald-600 shadow-xl shadow-emerald-100" 
                                  : "bg-rose-50 border-rose-600 text-rose-600 shadow-xl shadow-rose-100"
                                : "bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50/50"
                            )}
                          >
                            <div className={cn(
                              "w-16 h-16 rounded-3xl flex items-center justify-center transition-transform",
                              isSelected ? "scale-110" : "bg-slate-100 text-slate-400"
                            )}>
                              {choice.val === 0 ? <CheckCircle2 className="w-10 h-10" /> : <AlertCircle className="w-10 h-10" />}
                            </div>
                            {choice.text}
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
                    <div className="flex flex-col items-center justify-center py-10 space-y-6 text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                        <Info className="w-8 h-8 text-slate-400" />
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Espaces à remplir</h4>
                        <p className="text-slate-500 text-sm font-medium max-w-sm">Veuillez renseigner tous les champs vides dans le texte ci-dessus.</p>
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
                    onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-3xl bg-white border-2 border-slate-100 text-slate-400 hover:border-indigo-200 hover:text-indigo-600 transition-all disabled:opacity-30 disabled:pointer-events-none group"
                  >
                    <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-black uppercase tracking-tight">Précédent</span>
                  </button>
                  <button 
                    disabled={currentQuestionIndex === questions.length - 1}
                    onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-3xl bg-indigo-600 text-white shadow-xl shadow-indigo-100 hover:scale-105 transition-all disabled:opacity-30 disabled:pointer-events-none group"
                  >
                    <span className="text-sm font-black uppercase tracking-tight">Suivant</span>
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
