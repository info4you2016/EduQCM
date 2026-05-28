import React, { useState, useMemo } from 'react';
import { BookOpen, FileDown, Edit2, Trash2, AlertTriangle, FileText, History, Plus, Search, Filter, CheckCircle, Clock, BarChart2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { Module, Exam, Result, Filiere, OrganizationSettings } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ModuleInsightsModal } from '../modals/ModuleInsightsModal';

interface ModulesTabProps {
  modules: Module[];
  exams: Exam[];
  results: Result[];
  filieres: Filiere[];
  orgSettings: OrganizationSettings | null;
  isExportingPV: boolean;
  setIsAddingModule: (val: boolean) => void;
  setEditingModule: (module: Module | null) => void;
  handleExportModuleExcel: (module: Module) => void;
  handleDeleteModule: (id: number) => void;
  handleExportPV: (exam: Exam) => void;
}

export const ModulesTab = ({
  modules,
  exams,
  results,
  filieres,
  orgSettings,
  isExportingPV,
  setIsAddingModule,
  setEditingModule,
  handleExportModuleExcel,
  handleDeleteModule,
  handleExportPV
}: ModulesTabProps) => {
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiliereId, setSelectedFiliereId] = useState<string>('all');
  const [planningStatusFilter, setPlanningStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [selectedModuleForInsights, setSelectedModuleForInsights] = useState<Module | null>(null);

  const getRequiredCCForVolume = (hours: number) => {
    if (orgSettings?.ccRules && orgSettings.ccRules.length > 0) {
      const sortedRules = [...orgSettings.ccRules].sort((a, b) => a.min - b.min);
      let count = 0;
      for (const rule of sortedRules) {
        if (hours >= rule.min) {
          count = rule.count;
        }
      }
      return count;
    }
    // Fallback to default logic
    if (hours < 10) return 0;
    if (hours < 20) return 1;
    if (hours <= 50) return 2;
    return 3;
  };

  // Compute Global Analytics Stats
  const globalStats = useMemo(() => {
    const totalModules = modules.length;
    const totalHours = modules.reduce((sum, m) => sum + m.durationHours, 0);
    
    let totalRequiredCC = 0;
    let totalCreatedCC = 0;
    let modulesWithEFM = 0;

    modules.forEach(m => {
      const required = getRequiredCCForVolume(m.durationHours);
      totalRequiredCC += required;

      const moduleExams = exams.filter(e => e.moduleId === m.id);
      const createdCC = moduleExams.filter(e => e.type === 'controle-continu').length;
      totalCreatedCC += Math.min(createdCC, required);

      const hasEFM = moduleExams.some(e => e.type === 'fin-de-module');
      if (hasEFM) {
        modulesWithEFM++;
      }
    });

    const ccCoverage = totalRequiredCC > 0 ? Math.round((totalCreatedCC / totalRequiredCC) * 100) : 0;
    const efmCoverage = totalModules > 0 ? Math.round((modulesWithEFM / totalModules) * 100) : 0;

    const alertCount = modules.filter(m => {
      const required = getRequiredCCForVolume(m.durationHours);
      const created = exams.filter(e => e.moduleId === m.id && e.type === 'controle-continu').length;
      const hasEFM = exams.some(e => e.moduleId === m.id && e.type === 'fin-de-module');
      return (required - created > 0) || !hasEFM;
    }).length;

    return {
      totalModules,
      totalHours,
      ccCoverage,
      efmCoverage,
      alertCount
    };
  }, [modules, exams, orgSettings]);

  // Filter Logic
  const filteredModules = useMemo(() => {
    return modules.filter(m => {
      // 1. Search Query
      const matchesSearch = 
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        m.code.toLowerCase().includes(searchQuery.toLowerCase());
        
      // 2. Filiere
      const matchesFiliere = selectedFiliereId === 'all' || m.filiereId?.toString() === selectedFiliereId;

      // 3. Status
      const requiredCC = getRequiredCCForVolume(m.durationHours);
      const createdCC = exams.filter(e => e.moduleId === m.id && e.type === 'controle-continu').length;
      const hasEFM = exams.some(e => e.moduleId === m.id && e.type === 'fin-de-module');
      const isComplete = (requiredCC - createdCC <= 0) && hasEFM;

      const matchesStatus = 
        planningStatusFilter === 'all' ||
        (planningStatusFilter === 'completed' && isComplete) ||
        (planningStatusFilter === 'pending' && !isComplete);

      return matchesSearch && matchesFiliere && matchesStatus;
    });
  }, [modules, exams, searchQuery, selectedFiliereId, planningStatusFilter, orgSettings]);

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 font-serif italic tracking-tight">Gestion des Modules</h2>
          <p className="text-slate-500 mt-1">Configurez les modules, suivez l'avancement des évaluations et préparez les PV de fin de module.</p>
        </div>
        <Button onClick={() => setIsAddingModule(true)} className="gap-2 text-xs uppercase tracking-widest font-black py-4 px-6 shadow-xl shadow-indigo-100 shrink-0">
          <Plus className="w-4 h-4" /> Nouveau Module
        </Button>
      </div>

      {/* Global Analytics Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-indigo-50/20 border border-indigo-100/30 flex flex-col justify-between">
          <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Modules Total</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-950">{globalStats.totalModules}</span>
            <span className="text-[10px] font-bold text-indigo-600">Enseignés</span>
          </div>
        </Card>

        <Card className="p-5 bg-sky-50/20 border border-sky-100/30 flex flex-col justify-between">
          <span className="text-[9px] font-black text-sky-500 uppercase tracking-widest">Volume Horaire</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-sky-950">{globalStats.totalHours}H</span>
            <span className="text-[10px] font-bold text-sky-600">Heures cumulées</span>
          </div>
        </Card>

        <Card className="p-5 bg-emerald-50/20 border border-emerald-100/30 flex flex-col justify-between">
          <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Couverture CC</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-950">{globalStats.ccCoverage}%</span>
            <span className="text-[10px] font-bold text-emerald-600">Fait vs requis</span>
          </div>
        </Card>

        <Card className="p-5 bg-purple-50/20 border border-purple-100/30 flex flex-col justify-between">
          <span className="text-[9px] font-black text-purple-500 uppercase tracking-widest">Couverture EFM</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-950">{globalStats.efmCoverage}%</span>
            <span className="text-[10px] font-bold text-purple-600">Saisis</span>
          </div>
        </Card>
      </div>

      {/* Advanced Filters & Interactive Controls Area */}
      <div className="bg-slate-50/60 p-5 rounded-[2rem] border border-slate-200/40 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Searching */}
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Rechercher par code ou nom de module..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white text-slate-800 text-xs font-bold pl-10 pr-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filtre Filière */}
            <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-2xl border border-slate-200 shadow-sm">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedFiliereId}
                onChange={(e) => setSelectedFiliereId(e.target.value)}
                className="bg-transparent text-xs font-black uppercase tracking-wider text-slate-700 focus:outline-none cursor-pointer border-none p-1 pr-6"
              >
                <option value="all">Toutes Filières</option>
                {filieres.map((filiere) => (
                  <option key={filiere.id} value={filiere.id.toString()}>
                    {filiere.code} - {filiere.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabs for Planning Status Filter */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200/50">
          <div className="flex bg-slate-200/50 p-1 rounded-xl">
            <button
              onClick={() => setPlanningStatusFilter('all')}
              className={cn(
                "py-1.5 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                planningStatusFilter === 'all'
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              Tous ({modules.length})
            </button>
            <button
              onClick={() => setPlanningStatusFilter('pending')}
              className={cn(
                "py-1.5 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
                planningStatusFilter === 'pending'
                  ? "bg-white text-amber-600 shadow-sm"
                  : "text-slate-500 hover:text-amber-600"
              )}
            >
              <AlertTriangle className="w-3 h-3" /> Incomplets ({globalStats.alertCount})
            </button>
            <button
              onClick={() => setPlanningStatusFilter('completed')}
              className={cn(
                "py-1.5 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
                planningStatusFilter === 'completed'
                  ? "bg-white text-emerald-600 shadow-sm"
                  : "text-slate-500 hover:text-emerald-600"
              )}
            >
              <CheckCircle className="w-3 h-3" /> Complétés ({modules.length - globalStats.alertCount})
            </button>
          </div>

          {(searchQuery || selectedFiliereId !== 'all' || planningStatusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedFiliereId('all');
                setPlanningStatusFilter('all');
              }}
              className="text-[9px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-800"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      </div>

      {/* Modules List Grid */}
      {filteredModules.length === 0 ? (
        <Card className="p-12 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem]">
          <div className="max-w-md mx-auto flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-400">
              <Search className="w-8 h-8 opacity-40" />
            </div>
            <div>
              <h4 className="text-base font-black text-slate-800 uppercase tracking-wider">Aucun module correspondant</h4>
              <p className="text-xs text-slate-400 mt-1 font-medium">Modifiez vos filtres ou lancez une autre recherche pour trouver le module souhaité.</p>
            </div>
            <Button
              onClick={() => {
                setSearchQuery('');
                setSelectedFiliereId('all');
                setPlanningStatusFilter('all');
              }}
              variant="outline"
              className="mt-2 text-[10px] font-black uppercase tracking-wider h-9 px-4 rounded-xl"
            >
              Tout afficher
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredModules.map((module, index) => {
            const moduleExams = exams.filter(e => e.moduleId === module.id);
            const ccExams = moduleExams.filter(e => e.type === 'controle-continu');
            const efmExam = moduleExams.find(e => e.type === 'fin-de-module');
            
            const requiredCC = getRequiredCCForVolume(module.durationHours);
            const createdCC = ccExams.length;
            const remainingCC = Math.max(0, requiredCC - createdCC);
            const missingEFM = !efmExam;
            const efmExams = moduleExams.filter(e => e.type === 'fin-de-module');

            return (
              <motion.div
                key={module.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(index * 0.04, 0.4) }}
              >
                <Card className="p-1 group overflow-hidden border-2 border-slate-100 hover:border-indigo-150 transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/40">
                  <div className="p-6 bg-white rounded-[1.75rem] h-full flex flex-col group-hover:bg-slate-50/30">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100/50 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-all">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedModuleForInsights(module)} className="text-slate-400 hover:text-indigo-600 h-10 w-10 p-0 rounded-xl" title="Statistiques & Registre de notes du module"><BarChart2 className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleExportModuleExcel(module)} className="text-slate-400 hover:text-emerald-600 h-10 w-10 p-0 rounded-xl" title="Exporter les notes vers Excel"><FileDown className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditingModule(module)} className="text-slate-400 hover:text-indigo-650 h-10 w-10 p-0 rounded-xl"><Edit2 className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteModule(module.id)} className="text-slate-400 hover:text-rose-600 h-10 w-10 p-0 rounded-xl"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-lg uppercase tracking-widest border border-indigo-100/60">{module.code}</span>
                        <span className="px-2 py-0.5 bg-slate-50 text-slate-500 text-[10px] font-black rounded-lg uppercase tracking-widest border border-slate-100">{module.durationHours}H</span>
                        {(remainingCC > 0 || missingEFM) ? (
                          <span className="ml-auto flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 text-amber-600 text-[8px] font-black rounded-lg uppercase tracking-widest border border-amber-100 animate-pulse">
                            <AlertTriangle className="w-2.5 h-2.5" /> Planification
                          </span>
                        ) : (
                          <span className="ml-auto flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] font-black rounded-lg uppercase tracking-widest border border-emerald-100">
                            <CheckCircle className="w-2.5 h-2.5" /> Complet
                          </span>
                        )}
                    </div>
                    <h4 className="text-lg font-black text-slate-900 group-hover:text-indigo-650 transition-colors uppercase tracking-tight mb-1.5">{module.name}</h4>
                    <div className="text-xs text-slate-500 line-clamp-2 mb-4 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: module.description }} />
                    
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className={cn(
                        "p-3 rounded-2xl border flex flex-col gap-1 transition-all",
                        remainingCC === 0 ? "bg-emerald-50/30 border-emerald-100/50" : "bg-slate-50/50 border-slate-100"
                      )}>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Contrôles (CC)</span>
                        <div className="flex items-center justify-between">
                          <span className={cn("text-xs font-black", remainingCC === 0 ? "text-emerald-600" : "text-slate-700")}>
                            {createdCC} / {requiredCC}
                          </span>
                          {remainingCC > 0 && <span className="text-[8px] text-amber-500 font-bold bg-amber-50 px-1.5 py-0.5 rounded-md">-{remainingCC}</span>}
                        </div>
                        <div className="w-full h-1 bg-slate-200/60 rounded-full mt-1 overflow-hidden">
                          <div 
                            className={cn("h-full transition-all duration-1000", remainingCC === 0 ? "bg-emerald-500" : "bg-indigo-500")}
                            style={{ width: `${requiredCC > 0 ? (createdCC / requiredCC) * 100 : 100}%` }}
                          />
                        </div>
                      </div>
                      <div className={cn(
                        "p-3 rounded-2xl border flex flex-col gap-1 transition-all",
                        !missingEFM ? "bg-emerald-50/30 border-emerald-100/50" : "bg-slate-50/50 border-slate-100"
                      )}>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Examen (EFM)</span>
                        <div className="flex items-center justify-between">
                          <span className={cn("text-xs font-black", !missingEFM ? "text-emerald-600" : "text-slate-700")}>
                            {!missingEFM ? 'Prêt' : 'Manquant'}
                          </span>
                          {missingEFM && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                        </div>
                        <div className="w-full h-1 bg-slate-200/60 rounded-full mt-1 overflow-hidden">
                          <div 
                            className={cn("h-full transition-all duration-1000", !missingEFM ? "bg-emerald-500" : "bg-slate-300")}
                            style={{ width: !missingEFM ? '100%' : '0%' }}
                          />
                        </div>
                      </div>
                    </div>

                    {efmExams.length > 0 && (
                      <div className="mt-4 p-3 bg-slate-50/70 border border-slate-100 rounded-2xl">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">PV de Fin de Module</span>
                        <div className="space-y-1.5">
                          {efmExams.map(exam => {
                            const examResults = results.filter(r => r.examId === exam.id);
                            const hasResults = examResults.length > 0;
                            return (
                              <div key={exam.id} className="flex items-center justify-between text-[11px] bg-white p-2 border border-slate-100 rounded-xl shadow-sm">
                                <div className="flex flex-col">
                                  <span className="font-extrabold text-slate-700">{exam.groupName || exam.title}</span>
                                  <span className="text-[9px] text-slate-400 font-medium">
                                    {hasResults ? `${examResults.length} copies terminées` : 'Aucun résultat'}
                                  </span>
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleExportPV(exam)} 
                                  className={cn(
                                    "h-7 py-0.5 px-2 text-[9px] font-black rounded-lg uppercase tracking-wider flex items-center gap-1 transition-all shadow-sm border",
                                    hasResults 
                                      ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-100" 
                                      : "bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed"
                                  )}
                                  disabled={!hasResults || isExportingPV}
                                >
                                  <FileText className="w-3 h-3" />
                                  <span>PV</span>
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="mt-auto pt-6 border-t border-slate-100 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                       <span>{filieres.find(f => f.id === module.filiereId)?.name || 'Toutes filières'}</span>
                       <span className="flex items-center gap-1.5"><History className="w-3 h-3" /> {new Date(module.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
          <motion.button 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: Math.min(filteredModules.length * 0.04, 0.4) }}
            onClick={() => setIsAddingModule(true)}
            className="group p-8 border-2 border-dashed border-slate-200 rounded-[2.5rem] text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/5 transition-all flex flex-col items-center justify-center gap-4 min-h-[280px]"
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-50 transition-all duration-500">
              <Plus className="w-8 h-8" />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.2em]">Ajouter un Module</span>
          </motion.button>
        </div>
      )}

      {selectedModuleForInsights && (
        <ModuleInsightsModal
          module={selectedModuleForInsights}
          onClose={() => setSelectedModuleForInsights(null)}
          exams={exams}
          results={results}
        />
      )}
    </div>
  );
};
