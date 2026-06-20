import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, BookOpen, CheckCircle2, BarChart3, Clock, Search, Star, ClipboardList, ArrowRight, Target, TrendingUp,
  Award, Trophy, ShieldAlert, Zap, Flame, Lock, Bell, Grid, List as ListIcon, RotateCcw, SlidersHorizontal, BookOpenCheck, GraduationCap
} from 'lucide-react';
import { cn, getExamTotalPoints, formatDuration } from '../../lib/utils';
import { Exam, Result, Module, UserProfile, Notification, Group, Filiere } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { ResultDetailsModal } from '../modals/ResultDetailsModal';
import { DetailedNotificationCard } from '../DetailedNotificationCard';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';

interface StudentDashboardProps {
  exams: Exam[];
  results: Result[];
  onStartExam: (exam: Exam) => void;
  user: UserProfile;
  modules: Module[];
  notifications: Notification[];
  groups?: Group[];
  filieres?: Filiere[];
  onRefresh?: () => void;
}

export const StudentDashboard = ({ exams, results, onStartExam, user, modules, notifications = [], groups = [], filieres = [], onRefresh = () => {} }: StudentDashboardProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'completed'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'controle-continu' | 'fin-de-module' | 'autre'>('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'title'>('createdAt');
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');
  const [selectedResult, setSelectedResult] = useState<{ exam: Exam, result: Result } | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);

  const studentNotifications = useMemo(() => {
    return notifications.filter(notif => {
      // Must be student-appropriate audience
      const isTargetedToStudentRole = !notif.audienceRole || notif.audienceRole === 'all' || notif.audienceRole === 'students';
      if (!isTargetedToStudentRole) return false;

      const notifGroup = notif.groupId ? Number(notif.groupId) : null;
      const notifFiliere = notif.filiereId ? Number(notif.filiereId) : null;
      
      const userGroup = user?.groupId ? Number(user.groupId) : null;
      const userFiliere = user?.filiereId ? Number(user.filiereId) : null;

      // Global if there are NO specific targets
      const isGlobal = (!notifGroup || notifGroup === 0) && (!notifFiliere || notifFiliere === 0);
      
      const matchesGroup = notifGroup && notifGroup !== 0 && userGroup && userGroup !== 0 && notifGroup === userGroup;
      const matchesFiliere = notifFiliere && notifFiliere !== 0 && userFiliere && userFiliere !== 0 && notifFiliere === userFiliere;

      return isGlobal || matchesGroup || matchesFiliere;
    });
  }, [notifications, user?.groupId, user?.filiereId]);

  const [notifPage, setNotifPage] = useState(1);
  const [notifsPerPage, setNotifsPerPage] = useState(3);

  const totalNotifPages = Math.ceil(studentNotifications.length / notifsPerPage);

  const currentNotifications = useMemo(() => {
    const startIndex = (notifPage - 1) * notifsPerPage;
    return studentNotifications.slice(startIndex, startIndex + notifsPerPage);
  }, [studentNotifications, notifPage, notifsPerPage]);

  // Adjust current notification page if notifications count changes
  React.useEffect(() => {
    if (notifPage > totalNotifPages && totalNotifPages > 0) {
      setNotifPage(totalNotifPages);
    }
  }, [studentNotifications.length, totalNotifPages, notifPage]);

  // Reset page when sorting/filtering/searching changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedModuleId, statusFilter, typeFilter, sortBy]);

  // Computed status counts for the selected module and search query context
  const statusCounts = useMemo(() => {
    let all = 0;
    let todo = 0;
    let completed = 0;

    exams.forEach(e => {
      const matchesSearch = (e.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
        (modules.find(m => m.id === e.moduleId)?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesModule = selectedModuleId === null || e.moduleId === selectedModuleId;
      const matchesType = typeFilter === 'all' || e.type === typeFilter;

      if (matchesSearch && matchesModule && matchesType) {
        all++;
        const hasTaken = results.some(r => r.examId === e.id);
        if (hasTaken) {
          completed++;
        } else {
          todo++;
        }
      }
    });

    return { all, todo, completed };
  }, [exams, results, searchQuery, selectedModuleId, typeFilter, modules]);

  // Handle global filters reset
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedModuleId(null);
    setStatusFilter('all');
    setTypeFilter('all');
    setSortBy('createdAt');
  };

  const examsWithStatus = useMemo(() => {
    return exams
      .filter(e => {
        const matchesSearch = (e.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
          (modules.find(m => m.id === e.moduleId)?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesModule = selectedModuleId === null || e.moduleId === selectedModuleId;
        const hasTaken = results.some(r => r.examId === e.id);
        const matchesStatus = statusFilter === 'all' || 
          (statusFilter === 'todo' && !hasTaken) || 
          (statusFilter === 'completed' && hasTaken);
        const matchesType = typeFilter === 'all' || e.type === typeFilter;
        return matchesSearch && matchesModule && matchesStatus && matchesType;
      })
      .map(exam => ({
        ...exam,
        hasTaken: results.some(r => r.examId === exam.id),
        isNew: new Date(exam.createdAt).getTime() > Date.now() - (2 * 24 * 60 * 60 * 1000)
      }))
      .sort((a, b) => {
        if (sortBy === 'createdAt') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return (a.title || '').localeCompare(b.title || '');
      });
  }, [exams, results, searchQuery, modules, sortBy, selectedModuleId, statusFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(examsWithStatus.length / itemsPerPage));
  const paginatedExams = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return examsWithStatus.slice(startIndex, startIndex + itemsPerPage);
  }, [examsWithStatus, currentPage, itemsPerPage]);

  const stats = useMemo(() => {
    const totalTaken = results.length;
    const averageScore = results.length > 0 
      ? Math.round(results.reduce((acc, r) => acc + (r.score / (r.totalPoints || 1)) * 100, 0) / results.length)
      : 0;
    const pendingExams = examsWithStatus.filter(e => !e.hasTaken).length;
    
    // Module performance
    const modulePerf = modules.map(m => {
      const moduleResults = results.filter(r => {
        const exam = exams.find(e => e.id === r.examId);
        return exam?.moduleId === m.id;
      });
      if (moduleResults.length === 0) return { id: m.id, name: m.name, avg: -1 };
      const avg = Math.round(moduleResults.reduce((acc, r) => acc + (r.score / (r.totalPoints || 1)) * 100, 0) / moduleResults.length);
      return { id: m.id, name: m.name, avg };
    });

    const bestModule = modulePerf.filter(m => m.avg !== -1).sort((a, b) => b.avg - a.avg)[0] || null;
    const worstModule = modulePerf.filter(m => m.avg !== -1).sort((a, b) => a.avg - b.avg)[0] || null;

    const totalPointsEarned = results.reduce((acc, r) => acc + r.score, 0);
    const level = Math.floor(totalPointsEarned / 100) + 1;
    const nextLevelPoints = level * 100;
    const progressToNext = Math.round(((totalPointsEarned % 100) / 100) * 100);

    return { totalTaken, averageScore, pendingExams, bestModule, worstModule, level, totalPointsEarned, nextLevelPoints, progressToNext };
  }, [results, examsWithStatus, modules, exams]);

  const chartData = useMemo(() => {
    return results
      .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime())
      .map(r => ({
        date: new Date(r.completedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        score: Math.round((r.score / (r.totalPoints || 1)) * 100),
        title: exams.find(e => e.id === r.examId)?.title || 'Examen'
      }));
  }, [results, exams]);

  const badges = useMemo(() => {
    if (!results) return [];
    const hasTakenAny = results.length > 0;
    const isSavant = results.length >= 3;
    const hasPerfectScore = results.some(r => {
      const percentage = (r.score / (r.totalPoints || 1)) * 100;
      return percentage >= 100;
    });
    const avgScore = results.length > 0 
      ? results.reduce((acc, r) => acc + (r.score / (r.totalPoints || 1)) * 100, 0) / results.length
      : 0;
    const isMajor = avgScore >= 80 && results.length >= 2;

    return [
      {
        id: 'pioneer',
        title: 'Explorateur',
        desc: 'Complété votre tout premier examen.',
        icon: Zap,
        unlocked: hasTakenAny,
        colorClass: 'opacity-40 border-slate-250 bg-slate-50 text-slate-400',
        unlockedClass: 'border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 text-amber-600 font-bold shadow-md shadow-amber-100',
        iconColor: 'bg-amber-100 text-amber-600'
      },
      {
        id: 'perfect',
        title: 'Perfectionniste',
        desc: 'A obtenu un score parfait de 100% à une épreuve.',
        icon: Trophy,
        unlocked: hasPerfectScore,
        colorClass: 'opacity-40 border-slate-200 bg-slate-50 text-slate-400',
        unlockedClass: 'border-yellow-300 bg-gradient-to-br from-yellow-50/70 to-amber-50 text-yellow-600 font-bold shadow-md shadow-yellow-100',
        iconColor: 'bg-yellow-100 text-yellow-600'
      },
      {
        id: 'savant',
        title: 'Érudit',
        desc: 'A complété au moins 3 examens distincts.',
        icon: Award,
        unlocked: isSavant,
        colorClass: 'opacity-40 border-slate-200 bg-slate-50 text-slate-400',
        unlockedClass: 'border-indigo-300 bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-600 font-bold shadow-md shadow-indigo-100',
        iconColor: 'bg-indigo-100 text-indigo-600'
      },
      {
        id: 'major',
        title: 'Major de Promo',
        desc: 'Maintenu une moyenne générale sup. à 80% (min 2 tests).',
        icon: Flame,
        unlocked: isMajor,
        colorClass: 'opacity-40 border-slate-200 bg-slate-50 text-slate-400',
        unlockedClass: 'border-rose-300 bg-gradient-to-br from-rose-50 to-red-50 text-rose-600 font-bold shadow-md shadow-rose-100',
        iconColor: 'bg-rose-100 text-rose-600'
      }
    ];
  }, [results]);

  // Track module-by-module metrics for granular progression monitoring
  const moduleDetailedStats = useMemo(() => {
    return modules.map(m => {
      const moduleExams = exams.filter(e => e.moduleId === m.id);
      const totalExams = moduleExams.length;
      
      const moduleResults = results.filter(r => {
        const exam = exams.find(e => e.id === r.examId);
        return exam?.moduleId === m.id;
      });
      const completedCount = moduleResults.length;
      
      const avg = completedCount > 0 
        ? Math.round(moduleResults.reduce((acc, r) => acc + (r.score / (r.totalPoints || 1)) * 100, 0) / completedCount)
        : -1;

      return {
        id: m.id,
        name: m.name,
        code: m.code,
        totalExams,
        completedCount,
        avg
      };
    });
  }, [modules, exams, results]);

  // Find the single most urgent pending exam for the prominent top objective banner
  const mostUrgentExam = useMemo(() => {
    const pending = exams
      .filter(e => !results.some(r => r.examId === e.id))
      .map(e => ({
        ...e,
        totalPoints: getExamTotalPoints(e)
      }));
    if (pending.length === 0) return null;

    // Ongoing exam session (started but not finished) has absolute top priority, then fin-de-module, then recency
    return pending.sort((a, b) => {
      const priorityA = a.sessionStartTime ? 3 : (a.type === 'fin-de-module' ? 2 : 1);
      const priorityB = b.sessionStartTime ? 3 : (b.type === 'fin-de-module' ? 2 : 1);
      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })[0];
  }, [exams, results]);

  // Smooth-scroll focus helper that updates status filter
  const handleStatCardClick = (targetStatus: 'all' | 'todo' | 'completed') => {
    setStatusFilter(targetStatus);
    setTimeout(() => {
      document.getElementById('examens-disponibles')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="space-y-12">
      {/* Welcome Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b-2 border-slate-100"
      >
        <div className="space-y-2">
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-2 text-indigo-600"
          >
            <Sparkles className="w-5 h-5 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Tableau de bord Étudiant</span>
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight font-display"
          >
            Salut, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600 italic font-serif leading-normal uppercase">{user?.displayName?.split(' ')[0] || 'Étudiant'}</span> 👋
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-slate-400 font-bold text-sm"
          >
            Vous avez <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 bg-indigo-600 text-white rounded-md mx-1">{stats.pendingExams}</span> examens en attente.
          </motion.p>
        </div>
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          whileHover={{ scale: 1.02 }}
          className="flex items-center gap-5 bg-white px-6 py-4 rounded-[2rem] border-2 border-slate-50 shadow-soft min-w-[320px]"
        >
          <div className="relative group">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex flex-col items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-200 transition-transform group-hover:rotate-6">
              <span className="text-[10px] font-black uppercase opacity-60">Niv.</span>
              <span className="text-xl font-black">{stats.level}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex justify-between items-end">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Expérience</p>
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-none">{stats.totalPointsEarned % 100}/100 XP</p>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${stats.progressToNext}%` }}
                 className="h-full bg-indigo-600 rounded-full"
               />
            </div>
            <p className="text-[9px] font-bold text-slate-400 italic">Encore {100 - (stats.totalPointsEarned % 100)} XP avant le niveau {stats.level + 1}!</p>
          </div>
        </motion.div>
      </motion.div>

      {/* Target Active Objective Hero Card (Épreuve Prioritaire) */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        {mostUrgentExam ? (
          <div className="relative bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-2 border-indigo-500/30 rounded-[2.5rem] p-6 md:p-8 text-white overflow-hidden shadow-xl shadow-indigo-950/20">
            {/* Ambient gradients */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-violet-500/15 rounded-full blur-2xl pointer-events-none" />
            
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-4 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-300">
                    Objectif principal : Épreuve prioritaire à relever
                  </span>
                  {mostUrgentExam.type === 'fin-de-module' && (
                    <span className="text-[8px] font-black bg-rose-600 text-white px-2 py-0.5 rounded-md uppercase tracking-wider animate-pulse">
                      Examen Fin de Module (EFM)
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-indigo-300/90 font-black uppercase tracking-wider">
                    {modules.find(m => m.id === mostUrgentExam.moduleId)?.name || 'Module Académique'}
                  </p>
                  <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-none mb-1">
                    {mostUrgentExam.title}
                  </h3>
                  <p className="text-slate-300 text-xs font-semibold max-w-xl leading-relaxed">
                    {mostUrgentExam.description || "Cette évaluation est requise pour valider vos compétences dans ce module d'enseignement. Installez-vous confortablement avant de lancer."}
                  </p>
                </div>

                {/* Info parameters cards layout */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-black text-slate-300 pt-1">
                  <div className="flex items-center gap-1.5 bg-slate-800/40 px-3 py-1.5 rounded-xl border border-slate-700/30">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Durée : <strong className="text-white font-black">{formatDuration(mostUrgentExam.durationMinutes)}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-800/40 px-3 py-1.5 rounded-xl border border-slate-700/30">
                    <ClipboardList className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Structure : <strong className="text-white font-black">{mostUrgentExam.questions.length} questions</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-800/40 px-3 py-1.5 rounded-xl border border-slate-700/30">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                    <span>Récompense : <strong className="text-amber-400 font-black">{mostUrgentExam.totalPoints} points</strong></span>
                  </div>
                </div>
              </div>

              {/* Call-to-action wrapper */}
              <div className="shrink-0 w-full lg:w-auto flex flex-col sm:flex-row items-center gap-4 border-t border-slate-800 lg:border-t-0 pt-4 lg:pt-0">
                <div className="text-center sm:text-right hidden xl:block">
                  <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest leading-none">Concentration de rigueur</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-1.5">Chronomètre opérationnel dès le clic.</p>
                </div>
                <Button
                  onClick={() => onStartExam(mostUrgentExam)}
                  size="lg"
                  className={cn(
                    "w-full lg:w-auto h-16 px-8 rounded-2xl text-white font-black text-xs uppercase tracking-[0.2em] shadow-lg border hover:scale-[1.03] transition-all flex items-center justify-center gap-2 group cursor-pointer",
                    mostUrgentExam.sessionStartTime 
                      ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-amber-500/20 border-amber-400 animate-pulse"
                      : "bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 shadow-indigo-600/30 border-indigo-400/30"
                  )}
                >
                  {mostUrgentExam.sessionStartTime ? "Reprendre l'épreuve en cours" : "Démarrer l'épreuve maintenant"} 
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative bg-gradient-to-br from-emerald-50/80 to-teal-50/50 border-2 border-emerald-100 rounded-[2.5rem] p-6 md:p-8 text-center space-y-4 shadow-soft">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white mx-auto flex items-center justify-center shadow-md shadow-emerald-100">
              <CheckCircle2 className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">🏆 Toutes vos épreuves sont validées !</h3>
              <p className="text-xs text-slate-500 max-w-lg mx-auto font-bold leading-relaxed">
                Félicitations ! Vous avez complété toutes les évaluations disponibles pour vos cours d'enseignement. Vous n'avez aucun examen en attente de passage. Profitez-en pour réviser ou analyser vos communications officielles.
              </p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
        {[
          { 
            label: 'Examen Passés', 
            value: stats.totalTaken, 
            icon: CheckCircle2, 
            bg: 'bg-emerald-50', 
            color: 'text-emerald-300', 
            border: 'border-emerald-100/30',
            interactive: true,
            onClick: () => handleStatCardClick('completed'),
            colorText: 'text-emerald-700 bg-emerald-50 border-emerald-100'
          },
          { 
            label: 'Score Moyen', 
            value: `${stats.averageScore}%`, 
            icon: BarChart3, 
            bg: 'bg-indigo-50', 
            color: 'text-indigo-600', 
            border: 'border-indigo-100/40',
            sub: 'Moyenne générale académique'
          },
          { 
            label: 'À Compléter', 
            value: stats.pendingExams, 
            icon: Clock, 
            bg: 'bg-amber-50', 
            color: 'text-amber-500', 
            border: 'border-amber-100/30',
            interactive: true,
            onClick: () => handleStatCardClick('all'),
            colorText: 'text-amber-700 bg-amber-50 border-amber-100'
          },
          { 
            label: 'Force Majeure', 
            value: stats.bestModule ? stats.bestModule.name : 'N/A', 
            icon: Star, 
            bg: 'bg-violet-50', 
            color: 'text-violet-600', 
            border: 'border-violet-100/40',
            sub: stats.bestModule ? `${stats.bestModule.avg}% de moyenne` : 'Analyse en cours...'
          },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={stat.onClick}
            className={cn(
              "bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 flex flex-col justify-between shadow-soft group transition-all duration-300",
              'interactive' in stat 
                ? "cursor-pointer hover:border-indigo-300/80 hover:scale-[1.03] active:scale-[0.98] hover:shadow-lg hover:shadow-indigo-100/50" 
                : "hover:border-indigo-100/60 cursor-default"
            )}
          >
            <div className="flex justify-between items-start mb-4">
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 shadow-sm border", stat.bg, stat.color, stat.border)}>
                <stat.icon className="w-6 h-6 text-slate-800" />
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center justify-end gap-1">
                  {stat.label}
                  {'interactive' in stat && <ArrowRight className="w-2.5 h-2.5 text-indigo-400 group-hover:translate-x-0.5 transition-transform" />}
                </p>
                <h4 className="text-2xl font-black text-slate-900 tracking-tighter truncate max-w-[140px]">{stat.value}</h4>
              </div>
            </div>
            {'sub' in stat ? (
              <p className="text-[10px] font-bold text-slate-400 mt-2 border-t border-slate-50 pt-2">{stat.sub}</p>
            ) : 'interactive' in stat ? (
              <p className="text-[10px] font-black text-indigo-600/80 mt-2 border-t border-slate-50 pt-2 flex items-center gap-1 group-hover:text-indigo-600 transition-colors">
                Examiner les épreuves ↓
              </p>
            ) : null}
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-12">

          <section className="space-y-8" id="examens-disponibles">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Examens Disponibles</h3>
                <p className="text-xs text-slate-400 font-bold">
                  {examsWithStatus.length} {examsWithStatus.length > 1 ? 'épreuves trouvées' : 'épreuve trouvée'}
                </p>
              </div>
              
              {/* Layout Mode Toggle Grid vs List */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/50 w-fit">
                <button
                  type="button"
                  onClick={() => setLayoutMode('grid')}
                  title="Affichage en Grille"
                  className={cn(
                    "p-2 rounded-xl transition-all",
                    layoutMode === 'grid' 
                      ? "bg-white text-indigo-600 shadow-sm border border-slate-200/40" 
                      : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode('list')}
                  title="Affichage en Liste"
                  className={cn(
                    "p-2 rounded-xl transition-all",
                    layoutMode === 'list' 
                      ? "bg-white text-indigo-600 shadow-sm border border-slate-200/40" 
                      : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  <ListIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Comprehensive Search & Filtration Bar */}
            <div className="bg-slate-50/50 p-5 rounded-3xl border-2 border-slate-100/70 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                {/* Search Term */}
                <div className="relative md:col-span-4">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Rechercher par titre ou module..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600/10 rounded-xl text-xs font-bold transition-all outline-none text-slate-800 placeholder-slate-400"
                  />
                </div>

                {/* Sorting Select */}
                <div className="md:col-span-4">
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'createdAt' | 'title')}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 focus:border-indigo-600 rounded-xl text-xs font-bold text-slate-600 outline-none transition-all cursor-pointer"
                  >
                    <option value="createdAt">📅 Récents d'abord</option>
                    <option value="title">🔤 Nom d'examen</option>
                  </select>
                </div>

                {/* Exam Typology Filter (CC vs EFM) */}
                <div className="md:col-span-4">
                  <select 
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as 'all' | 'controle-continu' | 'fin-de-module' | 'autre')}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 focus:border-indigo-600 rounded-xl text-xs font-bold text-slate-600 outline-none transition-all cursor-pointer"
                  >
                    <option value="all">📝 Tous types (CC & EFM)</option>
                    <option value="controle-continu">✏️ Contrôles Continus (CC)</option>
                    <option value="fin-de-module">🎓 Examens Fin de Module (EFM)</option>
                    <option value="autre">✨ Autres Évaluations (Libre)</option>
                  </select>
                </div>
              </div>

              {/* Course Module Slide Pills */}
              <div className="space-y-2 pt-2 border-t border-slate-100/80">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Filtrer par Module d'enseignement</p>
                  {(searchQuery || selectedModuleId !== null || statusFilter !== 'all' || typeFilter !== 'all') && (
                    <button
                      onClick={handleResetFilters}
                      className="text-[9px] font-black text-rose-600 hover:text-rose-700 uppercase tracking-wide flex items-center gap-1 bg-rose-50 hover:bg-rose-100/60 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" /> Réinitialiser les filtres
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                  <button
                    onClick={() => setSelectedModuleId(null)}
                    className={cn(
                      "px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border",
                      selectedModuleId === null 
                        ? "bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-200" 
                        : "bg-white text-slate-500 border-slate-150 hover:border-slate-300 hover:text-slate-700"
                    )}
                  >
                    Tous les modules ({exams.length})
                  </button>
                  {modules.map(module => {
                    const countInModule = exams.filter(e => e.moduleId === module.id).length;
                    return (
                      <button
                        key={module.id}
                        onClick={() => setSelectedModuleId(module.id)}
                        className={cn(
                          "px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border",
                          selectedModuleId === module.id 
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100" 
                            : "bg-white text-slate-500 border-slate-150 hover:border-slate-300 hover:text-slate-700"
                        )}
                      >
                        {module.name} ({countInModule})
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Status Filter Tabs (with active dynamic stats) */}
            <div className="flex bg-slate-100/80 p-1 rounded-2xl max-w-sm border border-slate-200/30">
              {[
                { id: 'all', label: 'Tous', count: statusCounts.all },
                { id: 'todo', label: 'À faire', count: statusCounts.todo },
                { id: 'completed', label: 'Complétés', count: statusCounts.completed }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id as 'all' | 'todo' | 'completed')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    statusFilter === tab.id 
                      ? "bg-white text-slate-800 shadow-sm border border-slate-200/40 font-bold" 
                      : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  <span>{tab.label}</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-md text-[9px] font-bold",
                    statusFilter === tab.id 
                      ? "bg-indigo-50 text-indigo-600" 
                      : "bg-slate-200/60 text-slate-500"
                  )}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
            
            {examsWithStatus.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50/50 rounded-[2.5rem] border-2 border-dashed border-slate-200/50">
                <EmptyState message={searchQuery ? "Aucune épreuve ne correspond à vos critères de recherche." : "Aucune épreuve disponible pour le moment."} />
                {(searchQuery || selectedModuleId !== null || statusFilter !== 'all' || typeFilter !== 'all') && (
                  <Button 
                    onClick={handleResetFilters} 
                    className="mt-6 flex items-center gap-2 text-xs font-black uppercase tracking-widest rounded-xl"
                  >
                    <RotateCcw className="w-4 h-4" /> Réinitialiser les filtres
                  </Button>
                )}
              </div>
            ) : layoutMode === 'list' ? (
              /* Sleek Streamlined List View Layout */
              <div className="flex flex-col gap-4">
                {paginatedExams.map((exam, index) => {
                  const totalPoints = getExamTotalPoints(exam);
                  const examResult = results.find(r => r.examId === exam.id);
                  return (
                    <motion.div
                      key={exam.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <Card className="hover:border-indigo-200/80 transition-all hover:bg-slate-50/30 p-5 md:p-6 rounded-2xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex-1 space-y-2 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {exam.isNew && !exam.hasTaken && (
                              <span className="text-[8px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                                Nouveau
                              </span>
                            )}
                            <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded uppercase tracking-wide">
                              {modules.find(m => m.id === exam.moduleId)?.name || 'Module inconnu'}
                            </span>
                            {exam.type && (
                              <span className={cn(
                                "text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wide",
                                exam.type === 'fin-de-module' 
                                  ? "text-purple-600 bg-purple-50" 
                                  : exam.type === 'controle-continu'
                                    ? "text-blue-600 bg-blue-50"
                                    : "text-amber-600 bg-amber-50"
                              )}>
                                {exam.type === 'fin-de-module' ? 'EFM' : exam.type === 'controle-continu' ? 'CC' : 'Autre'}
                              </span>
                            )}
                            <span className="text-[9px] font-bold text-slate-400">
                              Créé le {new Date(exam.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          
                          <h4 className="font-extrabold text-slate-900 text-lg leading-tight truncate">{exam.title}</h4>
                          <p className="text-xs text-slate-400 line-clamp-1 max-w-2xl">{exam.description || 'Aucune description.'}</p>
                        </div>

                        {/* Mid Section stats info */}
                        <div className="flex items-center gap-6 text-slate-500 shrink-0">
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Durée</span>
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1 mt-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" /> {formatDuration(exam.durationMinutes)}
                            </span>
                          </div>
                          <div className="h-6 w-px bg-slate-100" />
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Questions</span>
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1 mt-1">
                              <ClipboardList className="w-3.5 h-3.5 text-slate-400" /> {exam.questions.length} Qs
                            </span>
                          </div>
                          <div className="h-6 w-px bg-slate-100" />
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Valeur</span>
                            <span className="text-xs font-black text-amber-600 flex items-center gap-1 mt-1">
                              <Star className="w-3 fill-amber-400 text-amber-400" /> {totalPoints} pts
                            </span>
                          </div>
                        </div>

                        {/* Action buttons columns */}
                        <div className="shrink-0 min-w-[140px] md:text-right flex md:flex-col justify-end gap-3">
                          {exam.hasTaken ? (
                            <div className="flex flex-row md:flex-col items-end gap-2 w-full justify-between md:justify-end">
                              <span className="px-2.5 py-1 text-[10px] font-extrabold text-emerald-600 bg-emerald-50 rounded-lg inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Complété
                              </span>
                              {examResult && (
                                <button
                                  onClick={() => setSelectedResult({ exam, result: examResult })}
                                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline uppercase tracking-wider"
                                >
                                  Score: {Number.isInteger(examResult.score) ? examResult.score : examResult.score.toFixed(1)} / {examResult.totalPoints || totalPoints}
                                </button>
                              )}
                            </div>
                          ) : (
                            <Button 
                              onClick={() => onStartExam(exam)} 
                              size="sm" 
                              className="rounded-xl text-[10px] uppercase font-black tracking-widest flex items-center gap-1.5"
                            >
                              Commencer <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              /* Original Highly Visual Grid Layout */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {paginatedExams.map((exam, index) => {
                  const totalPoints = getExamTotalPoints(exam);
                  const examResult = results.find(r => r.examId === exam.id);
                  return (
                    <motion.div
                      key={exam.id}
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ y: -4 }}
                    >
                      <Card className="p-1 group overflow-hidden border-2 border-slate-100 hover:border-indigo-100 h-full hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300">
                        <div className="p-6 flex flex-col h-full bg-white rounded-[1.75rem] transition-colors group-hover:bg-slate-50/50">
                          <div className="flex items-start justify-between mb-4">
                            {exam.isNew && !exam.hasTaken && (
                              <span className="text-[9px] font-black bg-rose-500 text-white px-2 py-1 rounded-lg uppercase tracking-[0.2em] animate-pulse">
                                Nouveau
                              </span>
                            )}
                            <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                              {exam.moduleName || modules.find(m => m.id === exam.moduleId)?.name || 'Module inconnu'}
                            </span>
                            <span className="text-[10px] font-black text-amber-600 flex items-center gap-1 uppercase tracking-widest bg-amber-50 px-2 py-1 rounded-lg group-hover:scale-110 transition-transform">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> {totalPoints} PTS
                            </span>
                            {exam.type && (
                              <span className={cn(
                                "text-[10px] font-black flex items-center gap-1 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg",
                                exam.type === 'fin-de-module' 
                                  ? "text-purple-600 bg-purple-50" 
                                  : exam.type === 'controle-continu'
                                    ? "text-blue-600 bg-blue-50"
                                    : "text-amber-600 bg-amber-50"
                              )}>
                                {exam.type === 'fin-de-module' ? 'EFM' : exam.type === 'controle-continu' ? 'CC' : 'Autre'}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex-1">
                            <h4 className="font-black text-slate-900 text-xl leading-tight group-hover:text-indigo-600 transition-colors mb-2">{exam.title}</h4>
                            <p className="text-xs font-medium text-slate-400 line-clamp-2 leading-relaxed mb-6">{exam.description || 'Pas de description fournie.'}</p>
                            
                            <div className="flex items-center gap-4 py-4 border-y border-slate-100 mb-6 group-hover:border-indigo-100/50 transition-colors">
                              <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Durée</span>
                                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5 mt-0.5">
                                  <Clock className="w-3.5 h-3.5 text-slate-400 group-hover:rotate-12 transition-transform" /> {formatDuration(exam.durationMinutes)}
                                </span>
                              </div>
                              <div className="w-px h-6 bg-slate-100" />
                              <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Questions</span>
                                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5 mt-0.5">
                                  <ClipboardList className="w-3.5 h-3.5 text-slate-400 group-hover:-rotate-12 transition-transform" /> {exam.questions.length} Qs
                                </span>
                              </div>
                            </div>
                          </div>

                          {exam.hasTaken ? (
                            <div className="space-y-3 mt-auto">
                              <button 
                                onClick={() => examResult && setSelectedResult({ exam, result: examResult })}
                                className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-50 text-emerald-600 rounded-2xl font-black text-xs uppercase tracking-widest border border-emerald-100/50 hover:bg-emerald-100 transition-colors active:scale-[0.98]"
                              >
                                <CheckCircle2 className="w-4 h-4" /> Voir Détails
                              </button>
                              {examResult && (
                                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Score Obtenu</span>
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-black text-indigo-600 tracking-tighter">{Number.isInteger(examResult.score) ? examResult.score : examResult.score.toFixed(2)}</span>
                                    <span className="text-xs text-slate-300 font-black">/ {examResult.totalPoints || totalPoints}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <Button 
                              onClick={() => onStartExam(exam)} 
                              className={cn(
                                "w-full h-14 rounded-2xl text-xs uppercase tracking-[0.2em] font-black mt-auto group-hover:shadow-xl flex items-center justify-center gap-2",
                                exam.sessionStartTime 
                                  ? "bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/10 group-hover:shadow-amber-500/30 animate-pulse border-2 border-amber-400"
                                  : "bg-indigo-600 hover:bg-indigo-700 text-white group-hover:shadow-indigo-100"
                              )}
                            >
                              {exam.sessionStartTime ? "Reprendre" : "Commencer"}
                              <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                            </Button>
                          )}
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Exam Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-5 bg-white border border-slate-100 rounded-[2rem] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 mt-8">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full sm:w-auto">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] text-center sm:text-left">
                    Affichage {examsWithStatus.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} à {Math.min(currentPage * itemsPerPage, examsWithStatus.length)} sur {examsWithStatus.length} épreuves
                  </span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="text-[10px] font-black uppercase tracking-widest bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 rounded-xl px-2.5 py-1.5 text-slate-500 focus:outline-none cursor-pointer hover:border-slate-300 transition-all w-full sm:w-auto text-center"
                  >
                    <option value={4}>4 par page</option>
                    <option value={6}>6 par page</option>
                    <option value={10}>10 par page</option>
                    <option value={20}>20 par page</option>
                  </select>
                </div>
                
                <div className="flex items-center justify-center gap-2 w-full sm:w-auto">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="h-8 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border-slate-200 text-slate-500 hover:text-indigo-600 bg-white"
                  >
                    Précédent
                  </Button>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 min-w-[100px] text-center">
                    Page {currentPage} sur {totalPages}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="h-8 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border-slate-200 text-slate-500 hover:text-indigo-600 bg-white"
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            )}
          </section>

          {/* 2. Dernières Performances (moved here) */}
          {results.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Dernières Performances</h3>
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                   <Target className="w-5 h-5 text-slate-300" />
                </div>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                {[...results].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()).slice(0, 4).map(result => {
                  const exam = exams.find(e => e.id === result.examId);
                  if (!exam) return null;
                  const percentage = Math.round((result.score / (result.totalPoints || 1)) * 100);
                  return (
                    <Card key={result.id} className="min-w-[280px] p-6 border-2 border-slate-50 hover:border-indigo-100 transition-all cursor-pointer" onClick={() => setSelectedResult({ exam, result })}>
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                            {modules.find(m => m.id === exam.moduleId)?.name}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">{new Date(result.completedAt).toLocaleDateString()}</span>
                        </div>
                        <h4 className="font-black text-slate-900 line-clamp-1">{exam.title}</h4>
                        <div className="flex items-end justify-between">
                           <div className="space-y-1">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Score</p>
                             <p className="text-2xl font-black text-slate-900 tracking-tighter">{Number.isInteger(result.score) ? result.score : result.score.toFixed(2)}<span className="text-sm text-slate-300">/{result.totalPoints}</span></p>
                           </div>
                           <div className={cn(
                             "px-3 py-1.5 rounded-xl text-xs font-black",
                             percentage >= 80 ? "bg-emerald-50 text-emerald-600" : percentage >= 50 ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                           )}>
                             {percentage}%
                           </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {/* 3. Class Announcements & Communications segment (moved here) */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Annonces de classe & Communiqués</h3>
              </div>
              <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl">
                {studentNotifications.length} {studentNotifications.length > 1 ? 'annonces' : 'annonce'}
              </span>
            </div>
            {studentNotifications.length === 0 ? (
              <div className="p-8 text-center bg-slate-50/60 rounded-[2rem] border-2 border-dashed border-slate-100">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Aucun communiqué officiel</p>
                <p className="text-[10px] text-slate-400 mt-2">Votre enseignant n'a publié aucune annonce pour l'instant.</p>
              </div>
            ) : (
              <>
                <div className="space-y-6">
                  {currentNotifications.map((notif) => (
                    <DetailedNotificationCard 
                      key={notif.id} 
                      notification={notif} 
                      user={user} 
                      groups={groups}
                      filieres={filieres}
                      onRefresh={onRefresh} 
                    />
                  ))}
                </div>

                {/* Announcement Pagination Controls */}
                {totalNotifPages > 1 && (
                  <div className="p-4 bg-white border border-slate-100 rounded-[2rem] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 mt-8">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full sm:w-auto">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] text-center sm:text-left">
                        Affichage {studentNotifications.length > 0 ? (notifPage - 1) * notifsPerPage + 1 : 0} à {Math.min(notifPage * notifsPerPage, studentNotifications.length)} sur {studentNotifications.length} annonces
                      </span>
                      <select
                        value={notifsPerPage}
                        onChange={(e) => {
                          setNotifsPerPage(Number(e.target.value));
                          setNotifPage(1);
                        }}
                        className="text-[10px] font-black uppercase tracking-widest bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 rounded-xl px-2.5 py-1.5 text-slate-500 focus:outline-none cursor-pointer hover:border-slate-300 transition-all w-full sm:w-auto text-center"
                      >
                        <option value={2}>2 par page</option>
                        <option value={3}>3 par page</option>
                        <option value={5}>5 par page</option>
                        <option value={10}>10 par page</option>
                      </select>
                    </div>
                    
                    <div className="flex items-center justify-center gap-2 w-full sm:w-auto">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={notifPage === 1}
                        onClick={() => setNotifPage(prev => Math.max(1, prev - 1))}
                        className="h-8 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border-slate-200 text-slate-500 hover:text-indigo-600 bg-white"
                      >
                        Précédent
                      </Button>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 min-w-[100px] text-center">
                        Page {notifPage} sur {totalNotifPages}
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={notifPage === totalNotifPages}
                        onClick={() => setNotifPage(prev => Math.min(totalNotifPages, prev + 1))}
                        className="h-8 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border-slate-200 text-slate-500 hover:text-indigo-600 bg-white"
                      >
                        Suivant
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        <aside className="lg:col-span-4 space-y-10">
          <section className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-50 shadow-soft">
            <div className="flex items-center justify-between mb-8">
              <div className="space-y-1">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Progression</p>
                 <h3 className="text-xl font-black text-slate-900 tracking-tight">Performances</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                 <TrendingUp className="w-5 h-5 text-indigo-600" />
              </div>
            </div>

            {results.length > 1 ? (
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} 
                    />
                    <YAxis 
                      hide 
                      domain={[0, 100]} 
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-100">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{payload[0].payload.title}</p>
                              <p className="text-base font-black text-indigo-600">{payload[0].value}%</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="score" 
                      stroke="#4f46e5" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorScore)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[200px] flex flex-col items-center justify-center bg-slate-50 rounded-3xl border border-dashed border-slate-200 p-6 text-center">
                <BarChart3 className="w-8 h-8 text-slate-300 mb-3" />
                <p className="text-xs font-bold text-slate-400">Passez au moins 2 examens pour voir votre progression.</p>
              </div>
            )}
          </section>

          {/* Module-by-Module Mastery Progression Track */}
          <section className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 shadow-soft space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-orange-500 animate-pulse" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Modules</p>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">Maîtrise Académique</h3>
                </div>
              </div>
              <span className="text-[9px] font-black uppercase text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg">
                {moduleDetailedStats.filter(m => m.completedCount > 0).length} / {modules.length} entamés
              </span>
            </div>

            <div className="space-y-4 max-h-[340px] overflow-y-auto pr-1 no-scrollbar">
              {moduleDetailedStats.map(moduleInfo => {
                const percentDone = moduleInfo.totalExams > 0 
                  ? Math.round((moduleInfo.completedCount / moduleInfo.totalExams) * 105) 
                  : 0;
                const normalizedPercent = Math.min(percentDone, 100);
                
                return (
                  <div key={moduleInfo.id} className="p-3.5 bg-slate-50/70 rounded-2xl border border-slate-100 space-y-2 group transition-all duration-300 hover:bg-white hover:border-orange-200/50 hover:shadow-soft">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <span className="text-[8px] font-black text-orange-500 bg-orange-50/75 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">
                          {moduleInfo.code}
                        </span>
                        <h5 className="font-extrabold text-xs text-slate-800 line-clamp-1 mt-1 group-hover:text-orange-500 transition-colors">
                          {moduleInfo.name}
                        </h5>
                      </div>
                      
                      {moduleInfo.avg !== -1 ? (
                        <div className={cn(
                          "px-2 py-0.5 rounded-lg text-[10px] font-black shrink-0",
                          moduleInfo.avg >= 80 ? "bg-emerald-50 text-emerald-600" : moduleInfo.avg >= 50 ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                        )}>
                          Avg: {moduleInfo.avg}%
                        </div>
                      ) : (
                        <div className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded-lg text-[9px] font-extrabold shrink-0 uppercase tracking-wider">
                          0%
                        </div>
                      )}
                    </div>

                    {/* Progress Slider */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[9px] font-bold text-slate-400">
                        <span>Progression</span>
                        <span>{moduleInfo.completedCount}/{moduleInfo.totalExams || 1} examens</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200/60 rounded-full overflow-hidden border border-slate-250/10">
                        <div 
                          className="h-full bg-orange-400 rounded-full transition-all duration-700"
                          style={{ width: `${normalizedPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Smart Study Recommendations widget */}
          {results.length > 0 && (
            <section className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 shadow-soft space-y-4">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-600 animate-pulse" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest leading-none">Coach d'Étude Intelligent</h3>
              </div>
              
              {stats.worstModule && stats.worstModule.avg < 70 && stats.worstModule.avg !== -1 ? (
                <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-amber-700">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span className="text-[9px] font-black uppercase tracking-wider">Priorité suggérée</span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium">
                    Nous vous suggérons de revisiter le module <strong className="text-slate-900 font-extrabold">{stats.worstModule.name}</strong>. Votre score moyen y est de <strong className="text-amber-700 font-black">{stats.worstModule.avg}%</strong>.
                  </p>
                  <p className="text-[10px] text-slate-400 italic font-medium leading-relaxed">
                    "L'échec n'est qu'une opportunité de recommencer plus intelligemment."
                  </p>
                </div>
              ) : stats.averageScore >= 80 ? (
                <div className="bg-emerald-50/50 border border-emerald-200/50 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-[9px] font-black uppercase tracking-wider">Excellent profil</span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium">
                    Félicitations ! Votre moyenne générale de <strong className="text-emerald-700 font-black">{stats.averageScore}%</strong> démontre une superbe maîtrise des différents concepts.
                  </p>
                  <p className="text-[10px] text-slate-400 italic">
                    Continuez sur cette lancée pour les examens finaux ! 🚀
                  </p>
                </div>
              ) : (
                <div className="bg-indigo-50/50 border border-indigo-200/50 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-700">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-[9px] font-black uppercase tracking-wider">Bonne progression</span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium">
                    Vous êtes sur la bonne voie. Continuez à vous entraîner régulièrement pour solidifier vos acquis.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Achievements & Milestones widget */}
          <section className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 shadow-soft space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-indigo-600" />
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest leading-none">Objectifs & Badges</h4>
              </div>
              <span className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                {badges.filter(b => b.unlocked).length} / {badges.length} Unlocked
              </span>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {badges.map(badge => {
                const Icon = badge.icon;
                return (
                  <div 
                    key={badge.id}
                    className={cn(
                      "flex items-center gap-4 p-3 rounded-2xl border transition-all duration-300",
                      badge.unlocked ? badge.unlockedClass : "border-slate-100 bg-white"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-300",
                      badge.unlocked ? badge.iconColor : "bg-slate-50 text-slate-300 border-slate-100"
                    )}>
                      {badge.unlocked ? (
                        <Icon className="w-5 h-5" />
                      ) : (
                        <Lock className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={cn(
                        "text-xs font-black leading-none",
                        badge.unlocked ? "text-slate-900" : "text-slate-400"
                      )}>
                        {badge.title}
                      </p>
                      <p className="text-[10px] font-medium text-slate-400 leading-tight mt-1 whitespace-normal">
                        {badge.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-deep">
             <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
             <div className="relative z-10">
               <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-6">
                 <Target className="w-6 h-6 text-white" />
               </div>
               <h3 className="text-xl font-black mb-2 tracking-tight">Préparez vos examens</h3>
               <p className="text-indigo-100 text-sm font-medium mb-6">Restez à jour avec vos cours et assurez une révision régulière.</p>
               <button className="w-full py-3 bg-white text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-50 transition-colors">Explorer les ressources</button>
             </div>
          </section>
        </aside>
      </div>
      
      {selectedResult && (
        <ResultDetailsModal 
          exam={selectedResult.exam} 
          result={selectedResult.result} 
          user={user}
          modules={modules}
          onClose={() => setSelectedResult(null)} 
        />
      )}
    </div>
  );
};
