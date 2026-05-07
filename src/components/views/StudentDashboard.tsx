import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, BookOpen, CheckCircle2, BarChart3, Clock, Search, Star, ClipboardList, ArrowRight, Target 
} from 'lucide-react';
import { cn, getExamTotalPoints, formatDuration } from '../../lib/utils';
import { Exam, Result, Module, UserProfile } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { ResultDetailsModal } from '../modals/ResultDetailsModal';

interface StudentDashboardProps {
  exams: Exam[];
  results: Result[];
  onStartExam: (exam: Exam) => void;
  user: UserProfile;
  modules: Module[];
}

export const StudentDashboard = ({ exams, results, onStartExam, user, modules }: StudentDashboardProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'title'>('createdAt');
  const [selectedResult, setSelectedResult] = useState<{ exam: Exam, result: Result } | null>(null);

  const examsWithStatus = useMemo(() => {
    return exams
      .filter(e => 
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        modules.find(m => m.id === e.moduleId)?.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .map(exam => ({
        ...exam,
        hasTaken: results.some(r => r.examId === exam.id)
      }))
      .sort((a, b) => {
        if (sortBy === 'createdAt') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return a.title.localeCompare(b.title);
      });
  }, [exams, results, searchQuery, modules, sortBy]);

  const stats = useMemo(() => {
    const totalTaken = results.length;
    const averageScore = results.length > 0 
      ? Math.round(results.reduce((acc, r) => acc + (r.score / (r.totalPoints || 1)) * 100, 0) / results.length)
      : 0;
    const pendingExams = examsWithStatus.filter(e => !e.hasTaken).length;
    
    return { totalTaken, averageScore, pendingExams };
  }, [results, examsWithStatus]);

  return (
    <div className="space-y-12">
      {/* Welcome Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b-2 border-slate-100"
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-indigo-600">
            <Sparkles className="w-5 h-5 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Tableau de bord Étudiant</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight font-display">
            Salut, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600 italic font-serif leading-normal uppercase">{user?.displayName?.split(' ')[0] || 'Étudiant'}</span> 👋
          </h2>
          <p className="text-slate-400 font-bold text-sm">
            Vous avez <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 bg-indigo-600 text-white rounded-md mx-1">{stats.pendingExams}</span> examens en attente.
          </p>
        </div>
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-5 bg-white px-6 py-4 rounded-[2rem] border-2 border-slate-50 shadow-soft min-w-[280px]"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center border-2 border-indigo-100 shrink-0 shadow-sm">
            <BookOpen className="w-7 h-7 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Votre Classe</p>
            <p className="text-base font-black text-slate-900 truncate tracking-tight">{user.filiere} • {user.groupName}</p>
          </div>
        </motion.div>
      </motion.div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { label: 'Examens Passés', value: stats.totalTaken, icon: CheckCircle2, bg: 'bg-emerald-50', color: 'text-emerald-600', border: 'border-emerald-100' },
          { label: 'Score Moyen', value: `${stats.averageScore}%`, icon: BarChart3, bg: 'bg-indigo-50', color: 'text-indigo-600', border: 'border-indigo-100' },
          { label: 'À Compléter', value: stats.pendingExams, icon: Clock, bg: 'bg-amber-50', color: 'text-amber-600', border: 'border-amber-100' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-50 flex items-center justify-between shadow-soft group hover:border-indigo-100 transition-all duration-500 cursor-default"
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{stat.label}</p>
              <h4 className="text-4xl font-black text-slate-900 tracking-tighter">{stat.value}</h4>
            </div>
            <div className={cn("w-16 h-16 rounded-[1.75rem] flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 shadow-sm border", stat.bg, stat.color, stat.border)}>
              <stat.icon className="w-8 h-8" />
            </div>
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
                {results.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()).slice(0, 4).map(result => {
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

          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Examens Disponibles</h3>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input 
                    type="text" 
                    placeholder="Rechercher..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-48 pl-9 pr-4 py-2 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-xl text-xs font-bold transition-all outline-none"
                  />
                </div>
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'createdAt' | 'title')}
                  className="px-3 py-2 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-xl text-xs font-bold transition-all outline-none text-slate-600"
                >
                  <option value="createdAt">Date (Récent)</option>
                  <option value="title">Titre (A-Z)</option>
                </select>
              </div>
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
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="p-1 group overflow-hidden border-2 border-slate-100 hover:border-indigo-100 h-full">
                        <div className="p-6 flex flex-col h-full bg-white rounded-[1.75rem] transition-colors group-hover:bg-slate-50/50">
                          <div className="flex items-start justify-between mb-4">
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
                                  <Clock className="w-3.5 h-3.5 text-slate-400" /> {formatDuration(exam.durationMinutes)}
                                </span>
                              </div>
                              <div className="w-px h-6 bg-slate-100" />
                              <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Questions</span>
                                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5 mt-0.5">
                                  <ClipboardList className="w-3.5 h-3.5 text-slate-400" /> {exam.questions.length} Qs
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
