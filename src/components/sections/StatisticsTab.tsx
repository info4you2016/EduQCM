import React, { useMemo } from 'react';
import { 
  Users, BookOpen, ClipboardList, CheckCircle2, History, Target, Clock 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatPercent, formatScore, formatDuration } from '../../lib/utils';
import { Module, Exam, Result, UserProfile } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { StatCard } from '../ui/StatCard';
import { EmptyState } from '../ui/EmptyState';

interface StatisticsTabProps {
  user: UserProfile;
  modules: Module[];
  exams: Exam[];
  results: Result[];
  studentCount: number;
  toggleExamStatus: (exam: Exam) => void;
  togglingExamId: number | null;
  setActiveTab: (tab: any) => void;
}

export const StatisticsTab = ({
  user,
  modules,
  exams,
  results,
  studentCount,
  toggleExamStatus,
  togglingExamId,
  setActiveTab
}: StatisticsTabProps) => {
  const stats = useMemo(() => {
    return [
      { label: 'Modules', value: modules.length, icon: BookOpen, color: 'indigo' },
      { label: 'Examens', value: exams.length, icon: ClipboardList, color: 'amber' },
      { label: 'Étudiants', value: studentCount, icon: Users, color: 'emerald' },
      { label: 'Résultats', value: results.length, icon: History, color: 'violet' },
    ];
  }, [modules, exams, studentCount, results]);

  return (
    <div className="space-y-12">
      <div className="space-y-2">
        <h2 className="text-4xl font-black text-slate-900 tracking-tight font-serif italic">Bonjour, {user?.displayName || 'Enseignant'}</h2>
        <p className="text-slate-500 font-medium tracking-tight">Voici l'état actuel de vos cours et examens.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ 
              delay: i * 0.1,
              type: "spring",
              stiffness: 260,
              damping: 20 
            }}
          >
            <StatCard title={stat.label} {...stat} />
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-10">
        <div className="xl:col-span-12 space-y-12">
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Vue d'ensemble de la classe</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-8 border-2 border-slate-50 bg-white/50 backdrop-blur shadow-soft flex flex-col justify-center gap-6">
                 <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
                     <CheckCircle2 className="w-6 h-6" />
                   </div>
                   <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Taux de réussite moyen</p>
                     <h4 className="text-3xl font-black text-slate-900 tracking-tighter">
                       {results.length > 0 ? formatPercent((results.filter(r => (r.score / (r.totalPoints || 1)) >= 0.5).length / results.length) * 100) : 0}%
                     </h4>
                   </div>
                 </div>
                 <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full" 
                      style={{ width: `${results.length > 0 ? (results.filter(r => (r.score / (r.totalPoints || 1)) >= 0.5).length / results.length) * 100 : 0}%` }} 
                    />
                 </div>
              </Card>
              <Card className="p-8 border-2 border-slate-50 bg-white/50 backdrop-blur shadow-soft flex flex-col justify-center gap-6">
                 <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                     <Target className="w-6 h-6" />
                   </div>
                   <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Moyenne Globale</p>
                     <h4 className="text-3xl font-black text-slate-900 tracking-tighter">
                       {results.length > 0 ? formatPercent(results.reduce((acc, r) => acc + (r.score / (r.totalPoints || 1)), 0) / results.length * 100) : 0}%
                     </h4>
                   </div>
                 </div>
                 <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full" 
                      style={{ width: `${results.length > 0 ? results.reduce((acc, r) => acc + (r.score / (r.totalPoints || 1)), 0) / results.length * 100 : 0}%` }} 
                    />
                 </div>
              </Card>
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Derniers Résultats Étudiants</h3>
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                <History className="w-5 h-5 text-slate-300" />
              </div>
            </div>
            <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-soft overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/50 border-b-2 border-slate-100 font-display">
                      <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Étudiant</th>
                      <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Examen</th>
                      <th className="px-8 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Score</th>
                      <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-slate-50">
                    <AnimatePresence mode="popLayout">
                      {results.length === 0 ? (
                        <motion.tr 
                          key="empty"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          <td colSpan={4} className="px-8 py-10 text-center text-slate-400 font-bold">Aucun résultat enregistré.</td>
                        </motion.tr>
                      ) : (
                        [...results].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()).slice(0, 5).map((result, idx) => {
                          const exam = exams.find(e => e.id === result.examId);
                          const percentage = Math.round((result.score / (result.totalPoints || 1)) * 100);
                          return (
                            <motion.tr 
                              key={result.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.05 }}
                              className="group hover:bg-slate-50/50 transition-colors"
                            >
                              <td className="px-8 py-5">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-[10px] font-black text-indigo-600 group-hover:scale-110 group-hover:bg-indigo-200 transition-all duration-300 shadow-sm border border-indigo-100">
                                    {result.studentName?.[0] || 'S'}
                                  </div>
                                  <span className="font-bold text-slate-700">{result.studentName}</span>
                                </div>
                              </td>
                              <td className="px-8 py-5">
                                <div className="space-y-0.5">
                                  <p className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight text-xs">{exam?.title || 'Examen inconnu'}</p>
                                  <div className="flex items-center gap-2">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                      {modules.find(m => m.id === exam?.moduleId)?.name}
                                    </p>
                                    {exam?.type && (
                                      <span className={cn(
                                        "text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest",
                                        exam.type === 'fin-de-module' ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"
                                      )}>
                                        {exam.type === 'fin-de-module' ? 'EFM' : 'CC'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-8 py-5">
                                <div className="flex flex-col items-center">
                                  <div className={cn(
                                    "px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1.5 transition-transform group-hover:scale-110",
                                    percentage >= 80 ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : percentage >= 50 ? "bg-amber-50 text-amber-600 border border-amber-100" : "bg-rose-50 text-rose-600 border border-rose-100"
                                  )}>
                                    {formatScore(result.score)} / {result.totalPoints}
                                  </div>
                                </div>
                              </td>
                              <td className="px-8 py-5 text-right">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">{new Date(result.completedAt).toLocaleDateString()}</span>
                              </td>
                            </motion.tr>
                          );
                        })
                      )}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Examens Récents</h3>
              <Button variant="ghost" size="sm" onClick={() => setActiveTab('exams')} className="text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50">Voir tout</Button>
            </div>
            <div className="grid grid-cols-1 gap-6">
              <AnimatePresence mode="popLayout">
                {exams.length === 0 ? (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <EmptyState message="Aucun examen créé pour le moment." />
                  </motion.div>
                ) : (
                  exams.slice(0, 3).map((exam, idx) => {
                    const module = modules.find(m => m.id === exam.moduleId);
                    return (
                      <motion.div
                        key={exam.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                      >
                        <Card className="p-6 flex flex-col md:flex-row md:items-center justify-between group border-2 border-slate-100 hover:border-indigo-100 transition-all duration-300 rounded-[2rem] hover:shadow-xl hover:shadow-slate-200/50 cursor-default">
                          <div className="flex items-center gap-6">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                              <ClipboardList className="w-7 h-7" />
                            </div>
                            <div className="space-y-1">
                              <h4 className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight text-lg">{exam.title}</h4>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                                  {module?.name}
                                </p>
                                <span className="w-1 h-1 rounded-full bg-slate-200 hidden sm:block" />
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-slate-400 group-hover:rotate-12 transition-transform" /> {formatDuration(exam.durationMinutes)}
                                </p>
                                <span className="w-1 h-1 rounded-full bg-slate-200 hidden sm:block" />
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-1.5">
                                  <ClipboardList className="w-3.5 h-3.5 text-slate-400 group-hover:-rotate-12 transition-transform" /> {exam.questions.length} questions
                                </p>
                                {exam.type && (
                                  <div className={cn(
                                    "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-sm",
                                    exam.type === 'fin-de-module' ? "bg-purple-50 text-purple-600 border-purple-100" : "bg-blue-50 text-blue-600 border-blue-100"
                                  )}>
                                    {exam.type === 'fin-de-module' ? 'Fin de Module' : 'Contrôle Continu'}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between md:justify-end gap-6 mt-6 md:mt-0 pt-6 md:pt-0 border-t md:border-t-0 border-slate-50">
                            <div className="flex flex-col items-end gap-2 text-right">
                              <span className={cn(
                                "text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border transition-all shadow-sm",
                                exam.status === 'active' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-400 border-slate-100"
                              )}>
                                {exam.status === 'active' ? 'En Ligne' : 'Brouillon'}
                              </span>
                              <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); toggleExamStatus(exam); }}
                                disabled={togglingExamId === exam.id}
                                className={cn(
                                  "w-12 h-6 rounded-full p-1 transition-all duration-500 relative focus:outline-none shadow-inner",
                                  exam.status === 'active' ? "bg-emerald-500 shadow-emerald-500/20" : "bg-slate-200",
                                  togglingExamId === exam.id && "opacity-50 cursor-not-allowed"
                                )}
                              >
                                <div className={cn(
                                  "w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-500 transform flex items-center justify-center",
                                  exam.status === 'active' ? "translate-x-6" : "translate-x-0"
                                )}>
                                  {togglingExamId === exam.id && (
                                    <div className="w-2 h-2 border-[1.5px] border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
                                  )}
                                </div>
                              </button>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
