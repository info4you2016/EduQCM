import React, { useState, useMemo } from 'react';
import { 
  Search, Plus, Filter, Clock, ClipboardList, Target, Users, CheckCircle2, 
  FileDown, FileText, Sparkles, BarChart, Eye, Radio, Edit2, Copy, Loader2, Trash2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDuration } from '../../lib/utils';
import { Exam, Module, Result } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';

interface ExamsTabProps {
  exams: Exam[];
  modules: Module[];
  results: Result[];
  setIsAddingExam: (val: boolean) => void;
  setEditingExam: (exam: Exam | null) => void;
  setPreviewExam: (exam: Exam | null) => void;
  setSupervisingExam: (exam: Exam | null) => void;
  setPerformanceExam: (exam: Exam | null) => void;
  toggleExamStatus: (exam: Exam) => void;
  togglingExamId: number | null;
  handleDuplicateExam: (exam: Exam) => void;
  duplicatingExamId: number | null;
  handleDeleteExam: (e: React.MouseEvent, id: number) => void;
  deletingExamId: number | null;
  handleExportPDF: (exam: Exam, showAnswers: boolean) => void;
  handleExportWord: (exam: Exam, showAnswers: boolean) => void;
  handleExportResultsPDF: (exam: Exam) => void;
}

export const ExamsTab = ({
  exams,
  modules,
  results,
  setIsAddingExam,
  setEditingExam,
  setPreviewExam,
  setSupervisingExam,
  setPerformanceExam,
  toggleExamStatus,
  togglingExamId,
  handleDuplicateExam,
  duplicatingExamId,
  handleDeleteExam,
  deletingExamId,
  handleExportPDF,
  handleExportWord,
  handleExportResultsPDF
}: ExamsTabProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'title'>('createdAt');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);

  // Reset page when sorting/filtering changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy]);

  const filteredExams = useMemo(() => {
    return exams
      .filter(e => (e.title || '').toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'createdAt') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return (a.title || '').localeCompare(b.title || '');
      });
  }, [exams, searchQuery, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredExams.length / itemsPerPage));
  const paginatedExams = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredExams.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredExams, currentPage, itemsPerPage]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 font-serif italic tracking-tight">Examens</h2>
          <p className="text-slate-500 mt-1">Gérez vos évaluations et suivez les progrès.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input 
              type="text" 
              placeholder="Rechercher..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 pl-9 pr-4 py-2.5 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-xl text-xs font-bold transition-all outline-none"
            />
          </div>
          <Button onClick={() => setIsAddingExam(true)} className="gap-2 text-xs uppercase tracking-widest font-black py-4 px-6 shadow-xl shadow-indigo-100">
            <Plus className="w-4 h-4" /> Créer un Examen
          </Button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center gap-4">
        <div className="flex items-center gap-2 px-4 border-r border-slate-100">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trier par</span>
        </div>
        <select 
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="bg-transparent text-xs font-bold text-slate-600 focus:outline-none cursor-pointer"
        >
          <option value="createdAt">Date de création</option>
          <option value="title">Titre (A-Z)</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {filteredExams.length === 0 ? (
          <div className="col-span-full"><EmptyState message="Aucun examen trouvé." /></div>
        ) : (
          paginatedExams.map(exam => {
            const examResults = results.filter(r => r.examId === exam.id);
            const module = modules.find(m => m.id === exam.moduleId);
            
            return (
              <motion.div
                key={exam.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="group"
              >
                <Card className="h-full flex flex-col p-0 border-2 border-slate-100 hover:border-indigo-100 transition-all duration-500 overflow-hidden rounded-[2.5rem] hover:shadow-2xl hover:shadow-indigo-500/10">
                  {/* Card Header Background */}
                  <div className="h-2 bg-indigo-500 w-full" />
                  
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex justify-between items-start mb-4">
                      <div className="space-y-1 max-w-[70%]">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            exam.status === 'active' ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                          )} />
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{module?.name}</p>
                        </div>
                        <h4 className="text-lg font-black text-slate-900 group-hover:text-indigo-600 transition-colors leading-tight uppercase tracking-tight line-clamp-2">
                          {exam.title}
                        </h4>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all duration-300 shadow-sm",
                          exam.status === 'active' 
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                            : "bg-slate-50 text-slate-400 border-slate-100"
                        )}>
                          {exam.status === 'active' ? 'En Ligne' : 'Brouillon'}
                        </span>
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleExamStatus(exam); }}
                          disabled={togglingExamId === exam.id}
                          className={cn(
                            "w-12 h-6 rounded-full p-1 transition-all duration-500 relative focus:outline-none shadow-sm",
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

                    <div className="flex flex-wrap gap-2 mb-6">
                      <div className="bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-1.5 flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{formatDuration(exam.durationMinutes)}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-1.5 flex items-center gap-2">
                        <ClipboardList className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{exam.questions.length} Qs</span>
                      </div>
                      {exam.type && (
                        <div className={cn(
                          "rounded-xl px-2.5 py-1.5 flex items-center gap-2 border shadow-sm transition-all",
                          exam.type === 'fin-de-module' ? "bg-purple-50 border-purple-100 text-purple-600" : "bg-blue-50 border-blue-100 text-blue-600"
                        )}>
                          <Target className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            {exam.type === 'fin-de-module' ? 'EFM' : 'CC'}
                          </span>
                        </div>
                      )}
                      {exam.groupName && (
                        <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl px-2.5 py-1.5 flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{exam.groupName}</span>
                        </div>
                      )}
                      {examResults.length > 0 && (
                        <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl px-2.5 py-1.5 flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{examResults.length} Terminés</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-auto space-y-4">
                      <div className="pt-4 border-t-2 border-slate-50 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="primary" 
                            size="sm" 
                            onClick={() => handleExportPDF(exam, false)} 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 px-3 h-9 shadow-sm transition-all"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                            Exporter l'examen
                          </Button>
                          {examResults.length > 0 && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleExportResultsPDF(exam)} 
                              className="border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-slate-50 font-semibold rounded-xl text-xs flex items-center gap-1.5 px-3 h-9 transition-all"
                              title="Exporter les Résultats (PDF)"
                            >
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              Résultats (.pdf)
                            </Button>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setPerformanceExam(exam)} className="h-9 w-9 p-0 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all" title="Performance">
                            <BarChart className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setPreviewExam(exam)} className="h-9 w-9 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Aperçu">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setSupervisingExam(exam)} className="h-9 w-9 p-0 text-rose-500 hover:bg-rose-50 rounded-xl transition-all relative" title="Supervision Live">
                            <Radio className="w-4 h-4 text-rose-500" />
                            <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                            </span>
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditingExam(exam)} className="h-9 w-9 p-0 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all" title="Modifier">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDuplicateExam(exam)} 
                            disabled={duplicatingExamId === exam.id}
                            className="h-9 w-9 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" 
                            title="Dupliquer"
                          >
                            {duplicatingExamId === exam.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                          {examResults.length === 0 && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={(e) => handleDeleteExam(e, exam.id)} 
                              className={cn(
                                "h-9 p-0 transition-all rounded-xl",
                                deletingExamId === exam.id 
                                  ? "w-auto px-3 bg-rose-600 text-white hover:bg-rose-700" 
                                  : "w-9 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              )} 
                              title={deletingExamId === exam.id ? "Confirmer la suppression" : "Supprimer"}
                            >
                              {deletingExamId === exam.id ? (
                                <span className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap flex items-center gap-1.5">
                                  <Trash2 className="w-3 h-3" />
                                  Confirmer
                                </span>
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-center">
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                          Créé le {new Date(exam.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="p-5 bg-white border border-slate-100 rounded-[2rem] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 mt-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full sm:w-auto">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] text-center sm:text-left">
              Affichage {filteredExams.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} à {Math.min(currentPage * itemsPerPage, filteredExams.length)} sur {filteredExams.length} examens (total: {exams.length})
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
    </div>
  );
};
