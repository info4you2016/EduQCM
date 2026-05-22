import React from 'react';
import { BookOpen, FileDown, Edit2, Trash2, AlertTriangle, FileText, History, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { Module, Exam, Result, Filiere, OrganizationSettings } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 font-serif italic tracking-tight">Gestion des Modules</h2>
          <p className="text-slate-500 mt-1">Créez et gérez vos modules d'enseignement.</p>
        </div>
        <Button onClick={() => setIsAddingModule(true)} className="gap-2 text-xs uppercase tracking-widest font-black py-4 px-6 shadow-xl shadow-indigo-100">
          <Plus className="w-4 h-4" /> Nouveau Module
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modules.map((module, index) => {
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
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="p-1 group overflow-hidden border-2 border-slate-50 hover:border-indigo-100 transition-all duration-500 hover:shadow-2xl hover:shadow-slate-200/50">
                <div className="p-6 bg-white rounded-[1.75rem] h-full flex flex-col group-hover:bg-slate-50/50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 group-hover:scale-110 group-hover:rotate-6 transition-all">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleExportModuleExcel(module)} className="text-slate-400 hover:text-emerald-600 h-10 w-10 p-0 rounded-xl" title="Exporter les notes vers Excel"><FileDown className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingModule(module)} className="text-slate-400 hover:text-indigo-600 h-10 w-10 p-0 rounded-xl"><Edit2 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteModule(module.id)} className="text-slate-400 hover:text-rose-600 h-10 w-10 p-0 rounded-xl"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-lg uppercase tracking-widest border border-indigo-100">{module.code}</span>
                      <span className="px-2 py-0.5 bg-slate-50 text-slate-500 text-[10px] font-black rounded-lg uppercase tracking-widest border border-slate-100">{module.durationHours}H</span>
                      {(remainingCC > 0 || missingEFM) && (
                        <span className="ml-auto flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 text-[8px] font-black rounded-lg uppercase tracking-widest border border-amber-100 animate-pulse">
                          <AlertTriangle className="w-2.5 h-2.5" /> Planification
                        </span>
                      )}
                  </div>
                  <h4 className="text-xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight mb-2">{module.name}</h4>
                  <div className="text-xs text-slate-500 line-clamp-2 mb-4 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: module.description }} />
                  
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className={cn(
                      "p-3 rounded-2xl border flex flex-col gap-1 transition-all",
                      remainingCC === 0 ? "bg-emerald-50/50 border-emerald-100" : "bg-slate-50 border-slate-100"
                    )}>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Contrôles (CC)</span>
                      <div className="flex items-center justify-between">
                        <span className={cn("text-xs font-black", remainingCC === 0 ? "text-emerald-600" : "text-slate-700")}>
                          {createdCC} / {requiredCC}
                        </span>
                        {remainingCC > 0 && <span className="text-[8px] text-amber-500 font-bold bg-amber-50 px-1.5 py-0.5 rounded-md">-{remainingCC}</span>}
                      </div>
                      <div className="w-full h-1 bg-slate-200 rounded-full mt-1 overflow-hidden">
                        <div 
                          className={cn("h-full transition-all duration-1000", remainingCC === 0 ? "bg-emerald-500" : "bg-indigo-400")}
                          style={{ width: `${requiredCC > 0 ? (createdCC / requiredCC) * 100 : 100}%` }}
                        />
                      </div>
                    </div>
                    <div className={cn(
                      "p-3 rounded-2xl border flex flex-col gap-1 transition-all",
                      !missingEFM ? "bg-emerald-50/50 border-emerald-100" : "bg-slate-50 border-slate-100"
                    )}>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Examen (EFM)</span>
                      <div className="flex items-center justify-between">
                        <span className={cn("text-xs font-black", !missingEFM ? "text-emerald-600" : "text-slate-700")}>
                          {!missingEFM ? 'Prêt' : 'Manquant'}
                        </span>
                        {missingEFM && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                      </div>
                      <div className="w-full h-1 bg-slate-200 rounded-full mt-1 overflow-hidden">
                        <div 
                          className={cn("h-full transition-all duration-1000", !missingEFM ? "bg-emerald-500" : "bg-slate-300")}
                          style={{ width: !missingEFM ? '100%' : '0%' }}
                        />
                      </div>
                    </div>
                  </div>

                  {efmExams.length > 0 && (
                    <div className="mt-4 p-3 bg-slate-50 border border-slate-100 rounded-2xl">
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
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: modules.length * 0.05 }}
          onClick={() => setIsAddingModule(true)}
          className="group p-8 border-2 border-dashed border-slate-200 rounded-[2.5rem] text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/5 transition-all flex flex-col items-center justify-center gap-4 min-h-[280px]"
        >
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-50 transition-all duration-500">
            <Plus className="w-8 h-8" />
          </div>
          <span className="text-xs font-black uppercase tracking-[0.2em]">Ajouter un Module</span>
        </motion.button>
      </div>
    </div>
  );
};
