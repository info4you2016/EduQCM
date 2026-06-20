import React, { useState, useMemo } from 'react';
import { 
  Search, Plus, Filter, Clock, ClipboardList, Target, Users, CheckCircle2, 
  FileDown, FileText, Sparkles, BarChart, Eye, Radio, Edit2, Copy, Loader2, Trash2,
  Folder, List
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDuration } from '../../lib/utils';
import { Exam, Module, Result, Group } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';

interface ExamsTabProps {
  exams: Exam[];
  modules: Module[];
  results: Result[];
  groups?: Group[];
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
  groups = [],
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
  const [viewMode, setViewMode] = useState<'flat' | 'module' | 'group'>('flat');
  const [selectedModuleId, setSelectedModuleId] = useState<string>('all');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);

  // Reset page when sorting/filtering changes ou viewMode change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, viewMode, selectedModuleId, selectedGroupId]);

  const filteredExams = useMemo(() => {
    return exams
      .filter(e => {
        // Search query check
        const matchSearch = (e.title || '').toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchSearch) return false;

        // Module filter check
        if (selectedModuleId !== 'all') {
          if (e.moduleId !== Number(selectedModuleId)) {
            return false;
          }
        }

        // Group filter check
        if (selectedGroupId !== 'all') {
          const gIdNum = Number(selectedGroupId);
          const filterGroupObj = groups.find(g => g.id === gIdNum);
          
          const examGId = e.groupId;
          const examGName = e.groupName;
          
          if (examGId) {
            if (examGId !== gIdNum) return false;
          } else if (examGName && filterGroupObj) {
            if (examGName.toLowerCase() !== filterGroupObj.name.toLowerCase()) return false;
          } else {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'createdAt') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return (a.title || '').localeCompare(b.title || '');
      });
  }, [exams, searchQuery, sortBy, selectedModuleId, selectedGroupId, groups]);

  const totalPages = Math.max(1, Math.ceil(filteredExams.length / itemsPerPage));
  const paginatedExams = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredExams.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredExams, currentPage, itemsPerPage]);

  const examsByModule = useMemo(() => {
    if (viewMode !== 'module') return null;
    
    const groupsMap: { [key: number]: Exam[] } = {};
    filteredExams.forEach(exam => {
      const mId = exam.moduleId;
      if (!groupsMap[mId]) groupsMap[mId] = [];
      groupsMap[mId].push(exam);
    });

    return Object.keys(groupsMap).map(mIdStr => {
      const mId = Number(mIdStr);
      const mObj = modules.find(m => m.id === mId);
      return {
        id: mId,
        name: mObj ? `${mObj.code || ''} - ${mObj.name}` : "Module inconnu ou autre",
        exams: groupsMap[mId]
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredExams, viewMode, modules]);

  const examsByGroup = useMemo(() => {
    if (viewMode !== 'group') return null;

    const groupsMap: { [key: string]: Exam[] } = {};
    filteredExams.forEach(exam => {
      const gName = exam.groupName || (exam.groupId && groups?.find(g => g.id === exam.groupId)?.name) || "Tous les Groupes / Non spécifié";
      if (!groupsMap[gName]) groupsMap[gName] = [];
      groupsMap[gName].push(exam);
    });

    return Object.keys(groupsMap).map(gName => {
      return {
        name: gName,
        exams: groupsMap[gName]
      };
    }).sort((a, b) => {
      if (a.name === "Tous les Groupes / Non spécifié") return 1;
      if (b.name === "Tous les Groupes / Non spécifié") return -1;
      return a.name.localeCompare(b.name);
    });
  }, [filteredExams, viewMode, groups]);

  const renderExamCard = (exam: Exam) => {
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
                  exam.type === 'fin-de-module' 
                    ? "bg-purple-50 border-purple-100 text-purple-600" 
                    : exam.type === 'controle-continu'
                      ? "bg-blue-50 border-blue-100 text-blue-600"
                      : "bg-amber-50 border-amber-100 text-amber-600"
                )}>
                  <Target className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {exam.type === 'fin-de-module' ? 'EFM' : exam.type === 'controle-continu' ? 'CC' : 'Autre'}
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
  };

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

      <div className="bg-white p-4 rounded-3xl border border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-y-3 gap-x-2">
          {/* Sort selection */}
          <div className="flex items-center gap-2 px-3 border-r border-slate-150">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trier par</span>
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-slate-600 focus:outline-none cursor-pointer ml-1"
            >
              <option value="createdAt">Date de création</option>
              <option value="title">Titre (A-Z)</option>
            </select>
          </div>

          {/* Module Filter */}
          <div className="flex items-center gap-2 px-3 border-r border-slate-150">
            <Folder className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Module</span>
            <select 
              value={selectedModuleId}
              onChange={(e) => setSelectedModuleId(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-600 focus:outline-none cursor-pointer ml-1 max-w-[180px] truncate"
            >
              <option value="all">Tous les modules</option>
              {modules.map(mod => (
                <option key={mod.id} value={mod.id}>{mod.code ? `${mod.code} - ` : ''}{mod.name}</option>
              ))}
            </select>
          </div>

          {/* Group Filter */}
          <div className="flex items-center gap-2 px-3">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Groupe</span>
            <select 
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-600 focus:outline-none cursor-pointer ml-1 max-w-[180px] truncate"
            >
              <option value="all">Tous les groupes</option>
              {groups.map(grp => (
                <option key={grp.id} value={grp.id}>{grp.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Dynamic Regroupment View Mode Switches */}
        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-2xl border border-slate-100/50">
          <button
            onClick={() => setViewMode('flat')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
              viewMode === 'flat'
                ? "bg-white text-indigo-600 shadow-md border border-slate-100"
                : "text-slate-400 hover:text-slate-700"
            )}
          >
            <List className="w-3.5 h-3.5" />
            Liste à plat
          </button>
          <button
            onClick={() => setViewMode('module')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
              viewMode === 'module'
                ? "bg-white text-indigo-600 shadow-md border border-slate-100"
                : "text-slate-400 hover:text-slate-700"
            )}
          >
            <Folder className="w-3.5 h-3.5" />
            Par Module
          </button>
          <button
            onClick={() => setViewMode('group')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
              viewMode === 'group'
                ? "bg-white text-indigo-600 shadow-md border border-slate-100"
                : "text-slate-400 hover:text-slate-700"
            )}
          >
            <Users className="w-3.5 h-3.5" />
            Par Groupe
          </button>
        </div>
      </div>

      {filteredExams.length === 0 ? (
        <Card className="p-8 border-2 border-slate-150 rounded-[2.5rem]">
          <EmptyState message="Aucun examen trouvé pour les critères de recherche." />
        </Card>
      ) : (
        <>
          {viewMode === 'flat' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {paginatedExams.map(exam => renderExamCard(exam))}
            </div>
          )}

          {viewMode === 'module' && examsByModule && (
            <div className="space-y-12">
              {examsByModule.map(groupObj => (
                <div key={groupObj.id} className="space-y-4">
                  <div className="flex items-center gap-3 pb-2 border-b-2 border-slate-100">
                    <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                      <Folder className="w-5 h-5" />
                    </span>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                      {groupObj.name} 
                      <span className="text-[11px] font-bold text-indigo-500 bg-indigo-50/50 px-2 py-0.5 rounded-lg ml-2">
                        {groupObj.exams.length} examen{groupObj.exams.length > 1 ? 's' : ''}
                      </span>
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {groupObj.exams.map(exam => renderExamCard(exam))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {viewMode === 'group' && examsByGroup && (
            <div className="space-y-12">
              {examsByGroup.map((groupObj, idx) => (
                <div key={idx} className="space-y-4">
                  <div className="flex items-center gap-3 pb-2 border-b-2 border-slate-100">
                    <span className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                      <Users className="w-5 h-5" />
                    </span>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                      {groupObj.name}
                      <span className="text-[11px] font-bold text-purple-600 bg-purple-50/50 px-2 py-0.5 rounded-lg ml-2">
                        {groupObj.exams.length} examen{groupObj.exams.length > 1 ? 's' : ''}
                      </span>
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {groupObj.exams.map(exam => renderExamCard(exam))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Pagination Controls - only visible in flat view */}
      {viewMode === 'flat' && totalPages > 1 && (
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
