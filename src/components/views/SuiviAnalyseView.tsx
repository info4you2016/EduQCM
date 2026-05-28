import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, Users, Award, BookOpen, Sparkles, BrainCircuit, CheckCircle2, 
  Target, Activity, FileDown, Search, AlertTriangle, Loader2, ChevronRight, 
  BarChart3, RefreshCw, Sparkle, Download, ShieldCheck
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Module, Exam, Result, Group } from '../../types';
import { generateCohortReportAI } from '../../lib/gemini';
import { cn } from '../../lib/utils';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';

interface SuiviAnalyseViewProps {
  modules: Module[];
  exams: Exam[];
  results: Result[];
  groups?: Group[];
  onRefresh?: () => void;
}

export const SuiviAnalyseView = ({
  modules,
  exams,
  results,
  groups = [],
  onRefresh
}: SuiviAnalyseViewProps) => {
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<string>('all');
  const [searchStudentQuery, setSearchStudentQuery] = useState<string>('');

  // AI Auditor States
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditTarget, setAuditTarget] = useState<string>(''); // Group or Module name
  const [aiReport, setAiReport] = useState<{
    overview: string;
    strengths: string[];
    weaknesses: string[];
    remediations: string[];
    conclusion: string;
  } | null>(null);

  // 1. Filtered Results based on selected filters
  const filteredResults = useMemo(() => {
    return results.filter(res => {
      const exam = exams.find(e => e.id === res.examId);
      if (!exam) return false;

      // Group filter
      if (selectedGroupFilter !== 'all') {
        const matchesGroup = res.groupName === selectedGroupFilter || exam.groupName === selectedGroupFilter;
        if (!matchesGroup) return false;
      }

      // Module filter
      if (selectedModuleFilter !== 'all') {
        if (exam.moduleId !== Number(selectedModuleFilter)) return false;
      }

      // Live Search by Student
      if (searchStudentQuery.trim() !== '') {
        const matchesSearch = res.studentName?.toLowerCase().includes(searchStudentQuery.toLowerCase());
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [results, exams, selectedGroupFilter, selectedModuleFilter, searchStudentQuery]);

  // All distinct group names in current results or database groups
  const distinctGroupsList = useMemo(() => {
    const list = new Set<string>();
    groups.forEach(g => { if (g.name) list.add(g.name); });
    results.forEach(r => { if (r.groupName) list.add(r.groupName); });
    return Array.from(list).sort();
  }, [groups, results]);

  // 2. Global statistics indicators for the filtered subset
  const calculatedStats = useMemo(() => {
    if (filteredResults.length === 0) {
      return {
        averageScore: 0,
        successRate: 0,
        highestScore: 0,
        integrityAverage: 100,
        excellentCount: 0,
        goodCount: 0,
        satisfactoryCount: 0,
        insufficientCount: 0
      };
    }

    const totalScoresPercent = filteredResults.reduce((acc, r) => acc + (r.score / (r.totalPoints || 1)), 0);
    const averageScore = Math.round((totalScoresPercent / filteredResults.length) * 100);

    const successfulAttempts = filteredResults.filter(r => (r.score / (r.totalPoints || 1)) >= 0.5).length;
    const successRate = Math.round((successfulAttempts / filteredResults.length) * 100);

    const percentages = filteredResults.map(r => (r.score / (r.totalPoints || 1)) * 100);
    const highestScore = Math.round(Math.max(...percentages));

    const totalIntegrity = filteredResults.reduce((acc, r) => acc + (r.integrityScore ?? 100), 0);
    const integrityAverage = Math.round(totalIntegrity / filteredResults.length);

    // Categories
    let excellentCount = 0; // >= 16/20 or 80%
    let goodCount = 0;      // 14-16/20 or 70% to 79%
    let satisfactoryCount = 0; // 10-14/20 or 50% to 69%
    let insufficientCount = 0; // < 10/20 or < 50%

    percentages.forEach(p => {
      if (p >= 80) excellentCount++;
      else if (p >= 70) goodCount++;
      else if (p >= 50) satisfactoryCount++;
      else insufficientCount++;
    });

    return {
      averageScore,
      successRate,
      highestScore,
      integrityAverage,
      excellentCount,
      goodCount,
      satisfactoryCount,
      insufficientCount
    };
  }, [filteredResults]);

  // 3. Recharts Grade Distribution data
  const chartGradeData = useMemo(() => {
    return [
      { name: 'En difficulté (<50%)', count: calculatedStats.insufficientCount, fill: '#ef4444' },
      { name: 'Moyen (50-69%)', count: calculatedStats.satisfactoryCount, fill: '#f59e0b' },
      { name: 'Bien (70-79%)', count: calculatedStats.goodCount, fill: '#3b82f6' },
      { name: 'Excellent (≥80%)', count: calculatedStats.excellentCount, fill: '#10b981' }
    ];
  }, [calculatedStats]);

  // 4. Recharts Module Averages comparison data
  const chartModulePerformanceData = useMemo(() => {
    return modules.map(m => {
      const moduleExams = exams.filter(e => e.moduleId === m.id);
      const moduleExamIds = moduleExams.map(e => e.id);
      const moduleResults = results.filter(r => moduleExamIds.includes(r.examId));
      
      const average = moduleResults.length > 0
        ? Math.round((moduleResults.reduce((acc, r) => acc + (r.score / (r.totalPoints || 1)), 0) / moduleResults.length) * 100)
        : 0;

      return {
        name: m.name.length > 25 ? `${m.name.slice(0, 22)}...` : m.name,
        average,
        totalCopies: moduleResults.length
      };
    }).filter(d => d.totalCopies > 0);
  }, [modules, exams, results]);

  // 5. Run AI Pedagogical Audit call
  const handleRunAiAudit = async () => {
    if (filteredResults.length === 0) return;
    
    setIsAuditing(true);
    setAiReport(null);

    // Set dynamic report target text
    let targetText = "Toutes les filières & modules";
    if (selectedGroupFilter !== 'all' && selectedModuleFilter !== 'all') {
      const modName = modules.find(m => m.id === Number(selectedModuleFilter))?.name || "Module";
      targetText = `Classe ${selectedGroupFilter} - Module ${modName}`;
    } else if (selectedGroupFilter !== 'all') {
      targetText = `Classe de ${selectedGroupFilter}`;
    } else if (selectedModuleFilter !== 'all') {
      const modName = modules.find(m => m.id === Number(selectedModuleFilter))?.name || "Module";
      targetText = `Module ${modName}`;
    }

    setAuditTarget(targetText);

    try {
      const serializedResults = filteredResults.map(r => {
        const examName = exams.find(e => e.id === r.examId)?.title || "Examen";
        return {
          studentName: r.studentName || "Étudiant",
          examTitle: examName,
          score: r.score,
          totalPoints: r.totalPoints || 1
        };
      });

      const totalExamsOfSubset = new Set(filteredResults.map(r => r.examId)).size;

      const report = await generateCohortReportAI(
        targetText,
        calculatedStats.averageScore,
        serializedResults,
        totalExamsOfSubset
      );

      setAiReport(report);
    } catch (err) {
      console.error("AI Cohort Audit failed:", err);
      alert("L'audit par l'IA a échoué. Veuillez réessayer.");
    } finally {
      setIsAuditing(false);
    }
  };

  // Export filtered performance as a CSV report
  const handleExportCSV = () => {
    if (filteredResults.length === 0) return;

    const data = filteredResults.map(r => {
      const exam = exams.find(e => e.id === r.examId);
      const percentage = Math.round((r.score / (r.totalPoints || 1)) * 100);
      return {
        'Étudiant': r.studentName || 'Anonyme',
        'Classe/Groupe': r.groupName || exam?.groupName || 'N/A',
        'Évaluation / Examen': exam?.title || 'N/A',
        'Module': modules.find(m => m.id === exam?.moduleId)?.name || 'N/A',
        'Type': exam?.type === 'fin-de-module' ? 'EFM' : 'Contrôle Continu',
        'Note brute': `${r.score} / ${r.totalPoints}`,
        'Score (%)': `${percentage}%`,
        'Score d\'Intégrité (%)': `${r.integrityScore ?? 100}%`,
        'Sorties Plein Écran': r.fullscreenExitsCount ?? 0,
        'Sorties Onglet': r.tabExitCount ?? 0,
        'Date d\'examen': new Date(r.completedAt).toLocaleDateString()
      };
    });

    const csvString = Papa.unparse(data);
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvString], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `Rapport_Suivi_Formateur_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 px-4 sm:px-6">
      {/* Banner / Strategic Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-200 shrink-0">
            <TrendingUp className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 font-serif italic tracking-tight">
              Suivi & Analyse de Performance
            </h2>
            <p className="text-slate-500 text-sm font-bold">
              Indicateurs académiques de niveau supérieur, cohortes et diagnostics IA.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="py-1.5 px-3 rounded-xl border border-slate-100 hover:border-indigo-100 text-slate-500 font-black text-xs uppercase tracking-wider"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Rafraîchir
            </Button>
          )}

          <Button
            onClick={handleExportCSV}
            disabled={filteredResults.length === 0}
            className="py-3 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider gap-2 shadow-lg"
          >
            <FileDown className="w-4 h-4" /> Export Complet CSV
          </Button>
        </div>
      </div>

      {/* Filter Toolbar Box */}
      <Card className="p-6 border-none shadow-xl shadow-slate-100/50 bg-white rounded-3xl flex flex-wrap items-center gap-4 justify-between">
        <div className="flex flex-wrap items-center gap-4 flex-1">
          {/* Group Filter */}
          <div className="flex flex-col gap-1.5 min-w-[180px]">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Filtrer par Groupe</span>
            <select
              value={selectedGroupFilter}
              onChange={(e) => setSelectedGroupFilter(e.target.value)}
              className="px-4 py-2 bg-slate-50 border-2 border-transparent text-slate-700 font-bold text-xs rounded-xl focus:border-indigo-500/20 focus:bg-white outline-none w-full transition-all cursor-pointer"
            >
              <option value="all">Tous les Groupes / Classes</option>
              {distinctGroupsList.map(groupName => (
                <option key={groupName} value={groupName}>{groupName}</option>
              ))}
            </select>
          </div>

          {/* Module Filter */}
          <div className="flex flex-col gap-1.5 min-w-[200px]">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Filtrer par Module</span>
            <select
              value={selectedModuleFilter}
              onChange={(e) => setSelectedModuleFilter(e.target.value)}
              className="px-4 py-2 bg-slate-50 border-2 border-transparent text-slate-700 font-bold text-xs rounded-xl focus:border-indigo-500/20 focus:bg-white outline-none w-full transition-all cursor-pointer"
            >
              <option value="all">Tous les Modules d'études</option>
              {modules.map(mod => (
                <option key={mod.id} value={mod.id}>{mod.name}</option>
              ))}
            </select>
          </div>

          {/* Live Search Input */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-[220px]">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Chercher un étudiant</span>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input
                type="text"
                value={searchStudentQuery}
                onChange={(e) => setSearchStudentQuery(e.target.value)}
                placeholder="Entrez le nom de l'étudiant..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-2 border-transparent text-slate-700 font-bold text-xs rounded-xl focus:border-indigo-500/20 focus:bg-white outline-none transition-all"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* KPI 1 : Moyenne */}
        <Card className="p-6 border-none shadow-xl shadow-indigo-100/30 bg-indigo-50 border-l-4 border-l-indigo-600 rounded-2xl flex flex-col justify-between h-36">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-indigo-700/60 uppercase tracking-widest">Moyenne Générale</span>
            <Award className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-3xl font-black text-indigo-950 tracking-tighter">{calculatedStats.averageScore}%</h3>
            <p className="text-xs text-indigo-600 font-bold mt-1">Sur l'ensemble des copies filtrées</p>
          </div>
        </Card>

        {/* KPI 2 : Taux de réussite */}
        <Card className="p-6 border-none shadow-xl shadow-emerald-100/30 bg-emerald-50 border-l-4 border-l-emerald-600 rounded-2xl flex flex-col justify-between h-36">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-emerald-700/60 uppercase tracking-widest">Taux de Réussite</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-3xl font-black text-emerald-950 tracking-tighter">{calculatedStats.successRate}%</h3>
            <p className="text-xs text-emerald-600 font-bold mt-1">Élèves obtenant ≥ 50% du barème</p>
          </div>
        </Card>

        {/* KPI 3 : Score Max */}
        <Card className="p-6 border-none shadow-xl shadow-amber-100/30 bg-amber-50 border-l-4 border-l-amber-600 rounded-2xl flex flex-col justify-between h-36">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-amber-700/60 uppercase tracking-widest">Performance Maximale</span>
            <Target className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-3xl font-black text-amber-950 tracking-tighter">{calculatedStats.highestScore}%</h3>
            <p className="text-xs text-amber-700 font-bold mt-1">Meilleur score enregistré</p>
          </div>
        </Card>

        {/* KPI 4 : Integrity */}
        <Card className="p-6 border-none shadow-xl shadow-rose-100/30 bg-rose-50 border-l-4 border-l-rose-600 rounded-2xl flex flex-col justify-between h-36">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-rose-700/60 uppercase tracking-widest">Degré de Confiance</span>
            <ShieldCheck className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h3 className="text-3xl font-black text-rose-950 tracking-tighter">{calculatedStats.integrityAverage}%</h3>
            <p className="text-xs text-rose-700 font-bold mt-1">Moyenne d'Intégrité de l'outil anti-triche</p>
          </div>
        </Card>
      </div>

      {/* Main Charts & Visualizations Row */}
      {filteredResults.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Chart 1: Grade breakdown */}
          <div className="lg:col-span-7 space-y-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest pl-2">Répartition des Cohortes par Niveau</h3>
            <Card className="p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-100/40 bg-white space-y-4">
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartGradeData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      tickLine={false} 
                      axisLine={false} 
                      tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} 
                    />
                    <YAxis 
                      tickLine={false} 
                      axisLine={false} 
                      tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} 
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-slate-900 text-white p-3 rounded-xl shadow-md text-xs font-bold font-sans">
                              {payload[0].name} : <span className="font-extrabold text-indigo-400">{payload[0].value} copies</span>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={45}>
                      {chartGradeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Chart 2: Module comparisons */}
          <div className="lg:col-span-5 space-y-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest pl-2">Performances par Module</h3>
            <Card className="p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-100/40 bg-white flex flex-col justify-between h-[328px]">
              {chartModulePerformanceData.length > 0 ? (
                <div className="h-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={chartModulePerformanceData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="2 2" horizontal={false} stroke="#f1f5f9" />
                      <XAxis 
                        type="number" 
                        domain={[0, 100]} 
                        tickLine={false} 
                        axisLine={false} 
                        tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }} 
                      />
                      <YAxis 
                        type="category" 
                        dataKey="name" 
                        tickLine={false} 
                        axisLine={false} 
                        tick={{ fontSize: 9, fontWeight: 'black', fill: '#1e293b' }}
                        width={110}
                      />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-slate-900 text-white p-3 rounded-xl shadow-md text-xs font-bold font-sans">
                                Moyenne : <span className="font-extrabold text-indigo-400">{payload[0].value}%</span>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="average" fill="#6366f1" radius={[0, 6, 6, 0]} maxBarSize={15} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <BookOpen className="w-10 h-10 mb-2 opacity-35" />
                  <p className="text-xs font-bold">Données insuffisantes pour dessiner le comparateur par module.</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      ) : (
        <Card className="py-20 p-8 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center text-slate-400 text-center bg-slate-50/50">
          <BarChart3 className="w-12 h-12 mb-4 text-slate-300" />
          <p className="font-extrabold text-slate-700 text-base">Aucune donnée correspondante</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">Ajustez vos filtres d'analyse ou de recherche au-dessus pour voir s'afficher l'analyse de performance.</p>
        </Card>
      )}

      {/* AI Cohort Audit Tool - Dynamic Generation segment */}
      {filteredResults.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between pl-2">
            <div className="flex items-center gap-2">
              <Sparkle className="w-5 h-5 text-indigo-600 animate-pulse animate-duration-[3s]" />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest pl-1">Auditeur Cohorte Généralisé (Propulsé par IA)</h3>
            </div>
          </div>

          <Card className="p-8 border-none shadow-2xl shadow-indigo-950/10 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-[2.5rem] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full -mr-20 -mt-20 blur-3xl group-hover:scale-110 transition-transform duration-1000" />
            
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-8 space-y-4">
                <span className="text-[10px] bg-indigo-500/50 text-indigo-100 px-3 py-1 rounded-full uppercase font-black tracking-widest">
                  Analyse qualitative automatisée de classe
                </span>
                
                <h4 className="text-2xl font-black text-white italic tracking-tight font-serif">
                  Soumettre cette cohorte sélectionnée à un diagnostic d'apprentissage complet
                </h4>
                
                <p className="text-slate-300 text-sm font-medium leading-relaxed max-w-2xl">
                  En prenant en compte les <strong className="text-white">{filteredResults.length} copies</strong> d'évaluations calculées au-dessus, l'IA dresse les forces collectives, identifie les thèmes non-assimilés et établit un plan rigoureux de remédiations au format académique standard.
                </p>
              </div>

              <div className="lg:col-span-4 flex justify-end w-full">
                <Button
                  onClick={handleRunAiAudit}
                  disabled={isAuditing}
                  className="w-full lg:w-auto h-16 px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl transition-all border-none group/btn"
                >
                  {isAuditing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analyse de cohorte en cours...
                    </>
                  ) : (
                    <>
                      <BrainCircuit className="w-5 h-5 group-hover/btn:scale-110 duration-200" />
                      Générer l'Audit IA
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>

          {/* AI Result Cards Display */}
          <AnimatePresence>
            {aiReport && (
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: 0.4 }}
                className="space-y-6"
              >
                {/* Audit Title Bar */}
                <Card className="p-6 border-none shadow-xl bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 rounded-2xl border-l-4 border-l-indigo-600">
                  <div>
                    <span className="text-[9px] bg-indigo-100 text-indigo-700 font-black px-2 py-0.5 rounded uppercase tracking-wider">Rapport d'apprentissage IA</span>
                    <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight mt-1">Audit : {auditTarget}</h4>
                  </div>
                  <button
                    onClick={() => {
                      const text = `RAPPORT DE COHORTE : ${auditTarget}\n\nOVERVIEW:\n${aiReport.overview}\n\nSTRENGTHS:\n${aiReport.strengths.join('\n')}\n\nWEAKNESSES:\n${aiReport.weaknesses.join('\n')}\n\nREMEDIATIONS:\n${aiReport.remediations.join('\n')}\n\nCONCLUSION:\n${aiReport.conclusion}`;
                      navigator.clipboard.writeText(text);
                      alert("Rapport copié dans le presse-papiers !");
                    }}
                    className="flex items-center gap-1.5 bg-slate-200/50 hover:bg-indigo-50 text-indigo-700 font-black text-[10px] px-3.5 py-2.5 rounded-xl uppercase tracking-wider transition-all"
                  >
                    <Download className="w-3.5 h-3.5" /> Copier l'Analyse
                  </button>
                </Card>

                {/* Audit Content grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* Global Overview Section */}
                  <div className="md:col-span-12">
                    <Card className="p-6 border-none shadow-xl bg-white space-y-3 rounded-2xl">
                      <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-widest flex items-center gap-2">
                        <Activity className="w-4 h-4 text-indigo-600" />
                        Analyse Diagnostique Collection Globale
                      </h5>
                      <p className="text-sm leading-relaxed text-slate-600 font-bold">
                        {aiReport.overview}
                      </p>
                    </Card>
                  </div>

                  {/* Strengths Card */}
                  <div className="md:col-span-4">
                    <Card className="p-6 border-none shadow-xl bg-emerald-50/50 border-l-4 border-l-emerald-500 rounded-2xl space-y-4 h-full">
                      <h5 className="font-extrabold text-emerald-800 text-xs uppercase tracking-widest flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Forces Clés Constatées
                      </h5>
                      <ul className="space-y-3">
                        {aiReport.strengths.map((item, i) => (
                          <li key={i} className="text-xs leading-relaxed text-slate-700 font-bold flex items-start gap-2">
                            <span className="text-emerald-500 font-black shrink-0">✓</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </div>

                  {/* Weaknesses Card */}
                  <div className="md:col-span-4">
                    <Card className="p-6 border-none shadow-xl bg-rose-50/50 border-l-4 border-l-rose-500 rounded-2xl space-y-4 h-full">
                      <h5 className="font-extrabold text-rose-800 text-xs uppercase tracking-widest flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        Axes de Progrès / Lacunes
                      </h5>
                      <ul className="space-y-3">
                        {aiReport.weaknesses.map((item, i) => (
                          <li key={i} className="text-xs leading-relaxed text-slate-700 font-bold flex items-start gap-2">
                            <span className="text-rose-500 font-black shrink-0">⚠</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </div>

                  {/* Remediation Action Plan Card */}
                  <div className="md:col-span-4">
                    <Card className="p-6 border-none shadow-xl bg-indigo-50/50 border-l-4 border-l-indigo-500 rounded-2xl space-y-4 h-full">
                      <h5 className="font-extrabold text-indigo-800 text-xs uppercase tracking-widest flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                        Actions de Remédiation IA
                      </h5>
                      <ul className="space-y-3">
                        {aiReport.remediations.map((item, i) => (
                          <li key={i} className="text-xs leading-relaxed text-slate-700 font-bold flex items-start gap-2">
                            <span className="text-indigo-500 font-black shrink-0">⚡</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </div>

                  {/* Conclusion footer word */}
                  <div className="md:col-span-12">
                    <Card className="p-5 border-none shadow-md bg-amber-50/40 border-l-4 border-l-amber-500 text-xs rounded-xl flex items-center gap-2 font-bold text-amber-900 leading-relaxed italic">
                      <span>💡 Conseil Inspecteur : "{aiReport.conclusion}"</span>
                    </Card>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Cohort Student Breakdown Table */}
      <section className="space-y-5">
        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest pl-2">Registre de Suivi et Progression Individuelle</h3>
        
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-100/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="px-8 py-4.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Nom de l'Étudiant</th>
                  <th className="px-8 py-4.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Classe / Groupe</th>
                  <th className="px-8 py-4.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Évaluation</th>
                  <th className="px-8 py-4.5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Score / Barème</th>
                  <th className="px-8 py-4.5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Niveau Atteint</th>
                  <th className="px-8 py-4.5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Anti-Triche Status</th>
                  <th className="px-8 py-4.5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Date Clé</th>
                </tr>
              </thead>
              
              <tbody className="divide-y divide-slate-100">
                {filteredResults.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-8 py-12 text-center text-slate-400 font-bold">
                      Aucun résultat d'étudiant enregistré sous ces critères de filtrage.
                    </td>
                  </tr>
                ) : (
                  [...filteredResults]
                    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
                    .map((item) => {
                      const exam = exams.find(e => e.id === item.examId);
                      const percentage = Math.round((item.score / (item.totalPoints || 1)) * 100);
                      
                      // Match styling of standard grades
                      let tierLabel = 'Excellent';
                      let tierClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                      if (percentage < 50) {
                        tierLabel = 'Insuffisant';
                        tierClass = 'bg-rose-50 text-rose-700 border-rose-100';
                      } else if (percentage < 70) {
                        tierLabel = 'Moyen';
                        tierClass = 'bg-amber-50 text-amber-700 border-amber-100';
                      } else if (percentage < 80) {
                        tierLabel = 'Bien';
                        tierClass = 'bg-blue-50 text-blue-700 border-blue-100';
                      }

                      return (
                        <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                          {/* Student identity */}
                          <td className="px-8 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[11px] font-black text-indigo-700 group-hover:scale-105 group-hover:bg-indigo-100 transition-all">
                                {item.studentName ? item.studentName[0].toUpperCase() : 'S'}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-extrabold text-xs text-slate-800">{item.studentName || 'Anonyme'}</span>
                                <span className="text-[9px] text-slate-400 font-medium">{item.studentEmail}</span>
                              </div>
                            </div>
                          </td>

                          {/* Student Class Group */}
                          <td className="px-8 py-4">
                            <span className="text-[10px] font-black text-slate-500 uppercase bg-slate-100 px-2 py-1 rounded">
                              {item.groupName || exam?.groupName || 'N/A'}
                            </span>
                          </td>

                          {/* Exam Title */}
                          <td className="px-8 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-xs text-slate-700 truncate max-w-[180px]">{exam?.title || 'Examen Supprimé'}</span>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                                {modules.find(m => m.id === exam?.moduleId)?.name || 'N/A'}
                              </span>
                            </div>
                          </td>

                          {/* Pure score */}
                          <td className="px-8 py-4 text-center">
                            <span className="font-extrabold text-xs text-slate-800">
                              {item.score} <span className="opacity-40">/ {item.totalPoints}</span>
                            </span>
                          </td>

                          {/* Progress Tier */}
                          <td className="px-8 py-4 text-center">
                            <span className={cn("px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border", tierClass)}>
                              {percentage}% • {tierLabel}
                            </span>
                          </td>

                          {/* Integrity indicator anti cheat warnings */}
                          <td className="px-8 py-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <span className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                (item.integrityScore ?? 100) >= 80 ? "bg-emerald-500" : (item.integrityScore ?? 100) >= 50 ? "bg-amber-500 animate-pulse" : "bg-rose-500 animate-pulse"
                              )} />
                              <span className="text-[10px] font-black text-slate-600 uppercase">
                                {(item.integrityScore ?? 100)}%
                              </span>
                            </div>
                          </td>

                          {/* Finished Date */}
                          <td className="px-8 py-4 text-right">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">
                              {new Date(item.completedAt).toLocaleDateString()}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};
