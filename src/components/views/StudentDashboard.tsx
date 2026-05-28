import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, BookOpen, CheckCircle2, BarChart3, Clock, Search, Star, ClipboardList, ArrowRight, Target, TrendingUp,
  Award, Trophy, ShieldAlert, Zap, Flame, Lock, Bell
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
  const [sortBy, setSortBy] = useState<'createdAt' | 'title'>('createdAt');
  const [selectedResult, setSelectedResult] = useState<{ exam: Exam, result: Result } | null>(null);

  const examsWithStatus = useMemo(() => {
    return exams
      .filter(e => {
        const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
          modules.find(m => m.id === e.moduleId)?.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesModule = selectedModuleId === null || e.moduleId === selectedModuleId;
        const hasTaken = results.some(r => r.examId === e.id);
        const matchesStatus = statusFilter === 'all' || 
          (statusFilter === 'todo' && !hasTaken) || 
          (statusFilter === 'completed' && hasTaken);
        return matchesSearch && matchesModule && matchesStatus;
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
        return a.title.localeCompare(b.title);
      });
  }, [exams, results, searchQuery, modules, sortBy, selectedModuleId, statusFilter]);

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

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
        {[
          { label: 'Examen Passés', value: stats.totalTaken, icon: CheckCircle2, bg: 'bg-emerald-50', color: 'text-emerald-600', border: 'border-emerald-100' },
          { label: 'Score Moyen', value: `${stats.averageScore}%`, icon: BarChart3, bg: 'bg-indigo-50', color: 'text-indigo-600', border: 'border-indigo-100' },
          { label: 'À Compléter', value: stats.pendingExams, icon: Clock, bg: 'bg-amber-50', color: 'text-amber-600', border: 'border-amber-100' },
          { 
            label: 'Force Majeure', 
            value: stats.bestModule ? stats.bestModule.name : 'N/A', 
            icon: Star, 
            bg: 'bg-violet-50', 
            color: 'text-violet-600', 
            border: 'border-violet-100',
            sub: stats.bestModule ? `${stats.bestModule.avg}% de moyenne` : 'Continuez à pratiquer'
          },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-50 flex flex-col justify-between shadow-soft group hover:border-indigo-100 transition-all duration-500 cursor-default"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 shadow-sm border", stat.bg, stat.color, stat.border)}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{stat.label}</p>
                <h4 className="text-2xl font-black text-slate-900 tracking-tighter truncate max-w-[140px]">{stat.value}</h4>
              </div>
            </div>
            {'sub' in stat && (
              <p className="text-[10px] font-bold text-slate-400 mt-2 border-t border-slate-50 pt-2">{stat.sub}</p>
            )}
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-12">
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

          {/* Class Announcements & Communications segment */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Annonces de classe & Communiqués</h3>
              </div>
              <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl">
                {notifications.length} {notifications.length > 1 ? 'annonces' : 'annonce'}
              </span>
            </div>
            {notifications.length === 0 ? (
              <div className="p-8 text-center bg-slate-50/60 rounded-[2rem] border-2 border-dashed border-slate-100">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Aucun communiqué officiel</p>
                <p className="text-[10px] text-slate-400 mt-2">Votre enseignant n'a publié aucune annonce pour l'instant.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {notifications.map((notif) => (
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
            )}
          </section>

          <section className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Examens Disponibles</h3>
              
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input 
                    type="text" 
                    placeholder="Filtrer..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-40 pl-9 pr-4 py-2 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all outline-none"
                  />
                </div>
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'createdAt' | 'title')}
                  className="px-3 py-2 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all outline-none text-slate-600"
                >
                  <option value="createdAt">Récent</option>
                  <option value="title">Titre</option>
                </select>
              </div>
            </div>

            {/* Module Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
              <button
                onClick={() => setSelectedModuleId(null)}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border-2",
                  selectedModuleId === null 
                    ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200" 
                    : "bg-white text-slate-500 border-slate-100 hover:border-slate-200"
                )}
              >
                Tous les modules
              </button>
              {modules.map(module => (
                <button
                  key={module.id}
                  onClick={() => setSelectedModuleId(module.id)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border-2",
                    selectedModuleId === module.id 
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100" 
                      : "bg-white text-slate-500 border-slate-100 hover:border-slate-200"
                  )}
                >
                  {module.name}
                </button>
              ))}
            </div>

            {/* Status Filter Tabs (All / To Do / Completed) */}
            <div className="flex bg-slate-100/80 p-1 rounded-2xl max-w-sm border border-slate-200/30">
              {[
                { id: 'all', label: 'Tous' },
                { id: 'todo', label: 'À faire' },
                { id: 'completed', label: 'Complétés' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id as 'all' | 'todo' | 'completed')}
                  className={cn(
                    "flex-1 py-1 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    statusFilter === tab.id 
                      ? "bg-white text-slate-800 shadow-sm border border-slate-200/40 font-bold" 
                      : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {examsWithStatus.length === 0 ? (
                <div className="col-span-full"><EmptyState message={searchQuery ? "Aucun examen trouvé." : "Aucun examen disponible."} /></div>
              ) : (
                examsWithStatus.map((exam, index) => {
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
                              {modules.find(m => m.id === exam.moduleId)?.name || 'Module inconnu'}
                            </span>
                            <span className="text-[10px] font-black text-amber-600 flex items-center gap-1 uppercase tracking-widest bg-amber-50 px-2 py-1 rounded-lg group-hover:scale-110 transition-transform">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> {totalPoints} PTS
                            </span>
                            {exam.type && (
                              <span className={cn(
                                "text-[10px] font-black flex items-center gap-1 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg",
                                exam.type === 'fin-de-module' ? "text-purple-600 bg-purple-50" : "text-blue-600 bg-blue-50"
                              )}>
                                {exam.type === 'fin-de-module' ? 'EFM' : 'CC'}
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
                            <Button onClick={() => onStartExam(exam)} className="w-full h-14 rounded-2xl text-xs uppercase tracking-[0.2em] font-black mt-auto group-hover:shadow-xl group-hover:shadow-indigo-100">
                              Commencer <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                            </Button>
                          )}
                        </div>
                      </Card>
                    </motion.div>
                  );
                })
              )}
            </div>
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
          onClose={() => setSelectedResult(null)} 
        />
      )}
    </div>
  );
};
