import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, TrendingUp, AlertCircle, Search, Download, CheckCircle2, 
  ChevronRight, BarChart, ListOrdered, FileDown, ArrowUpDown, 
  ChevronDown, ChevronUp, PieChart as PieChartIcon
} from 'lucide-react';
import { 
  BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import Papa from 'papaparse';
import { Modal } from '../ui/Modal';
import { Exam, Result, Module, Filiere, Group, OrganizationSettings, UserProfile } from '../../types';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { cn, stripHtml, normalizeQuestion, formatScore, formatPercent } from '../../lib/utils';
import { ResultDetailsModal } from './ResultDetailsModal';
import { ResultsExportTemplate } from '../ResultsExportTemplate';
import { generateResultsPDF } from '../../lib/pdfExport';
import { toast } from 'react-hot-toast';

interface ExamPerformanceModalProps {
  exam: Exam;
  onClose: () => void;
  modules: Module[];
  filieres: Filiere[];
  groups: Group[];
  settings: OrganizationSettings | null;
}

export const ExamPerformanceModal = ({ exam, onClose, modules, filieres, groups, settings }: ExamPerformanceModalProps) => {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'students' | 'analytics' | 'questions'>('analytics');
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: 'studentName' | 'score' | 'completedAt', direction: 'asc' | 'desc' }>({ key: 'score', direction: 'desc' });

  // Export states
  const resultsExportRef = React.useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportData, setExportData] = useState<{ exam: Exam, results: Result[], module: Module, filiereName: string, groupName: string } | null>(null);

  const handleExportPDF = async () => {
    const module = modules.find(m => m.id === exam.moduleId);
    if (!module || results.length === 0) return;

    const groupId = exam.groupId || groups.find(g => g.name === exam.groupName)?.id;
    const group = groups.find(g => g.id === groupId);
    const filiere = filieres.find(f => f.id === group?.filiereId || module.filiereId);

    const groupName = group?.name || exam.groupName || 'N/A';
    const filiereName = filiere ? `[${filiere.code}] ${filiere.name}` : 'N/A';
    const filiereLevel = filiere?.niveau || '';

    setIsExporting(true);
    try {
      await generateResultsPDF(
        exam,
        results,
        module,
        filiereName,
        filiereLevel,
        groupName,
        settings
      );
    } catch (err: any) {
      console.error("PDF Export failed:", err);
      toast.error("Erreur lors de l'exportation PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = () => {
    if (results.length === 0) return;
    
    const csvData = results.map(r => ({
      'Étudiant': r.studentName,
      'Email': r.studentEmail,
      'Groupe': r.groupName,
      'Note': r.score,
      'Total': r.totalPoints,
      'Pourcentage': `${formatPercent((r.score / (r.totalPoints || 1)) * 100)}%`,
      'Date': new Date(r.completedAt).toLocaleString('fr-FR')
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Resultats_${exam.title.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const data = await api.exams.getResults(exam.id);
        setResults(data);
      } catch (err) {
        console.error("Error fetching exam results:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [exam.id]);

  const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text || '');

  const stats = useMemo(() => {
    if (results.length === 0) return null;
    const scores = results.map(r => (r.score / (r.totalPoints || 1)) * 100);
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;
    const highest = Math.max(...scores);
    const lowest = Math.min(...scores);
    const passCount = scores.filter(s => s >= 50).length;
    const passRate = (passCount / scores.length) * 100;
    
    // Score distribution for histogram
    const distribution = [
      { bin: '0-20', count: 0, color: '#f43f5e' },
      { bin: '21-40', count: 0, color: '#fb923c' },
      { bin: '41-60', count: 0, color: '#facc15' },
      { bin: '61-80', count: 0, color: '#4ade80' },
      { bin: '81-100', count: 0, color: '#10b981' }
    ];

    scores.forEach(s => {
      if (s <= 20) distribution[0].count++;
      else if (s <= 40) distribution[1].count++;
      else if (s <= 60) distribution[2].count++;
      else if (s <= 80) distribution[3].count++;
      else distribution[4].count++;
    });

    const pieData = [
      { name: 'Réussite', value: passCount, color: '#10b981' },
      { name: 'Échec', value: results.length - passCount, color: '#f43f5e' }
    ];
    
    return { 
      average: formatPercent(average), 
      highest: formatPercent(highest), 
      lowest: formatPercent(lowest), 
      passRate: formatPercent(passRate),
      distribution,
      pieData
    };
  }, [results]);

  const questionStats = useMemo(() => {
    if (results.length === 0 || !exam.questions) return null;
    
    return exam.questions.map((q, qIdx) => {
      const correctCount = results.filter(r => r.questionResults?.[qIdx]?.isCorrect).length;
      const totalPointsEarned = results.reduce((sum, r) => sum + (r.questionResults?.[qIdx]?.pointsEarned || 0), 0);
      const avgPoints = totalPointsEarned / results.length;
      const successRate = (correctCount / results.length) * 100;
      
      return {
        questionText: q.text,
        fullText: stripHtml(q.text),
        type: q.type,
        successRate: Math.round(successRate),
        avgPoints: Number(avgPoints.toFixed(2)),
        maxPoints: q.points,
        correctCount,
        id: idxToNumber(qIdx)
      };
    });

    function idxToNumber(idx: number) { return `Q${idx + 1}`; }
  }, [results, exam.questions]);

  const filteredResults = useMemo(() => {
    let filtered = results.filter(r => 
      r.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      r.studentEmail?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return filtered.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });
  }, [results, searchQuery, sortConfig]);

  const toggleSort = (key: 'studentName' | 'score' | 'completedAt') => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  return (
    <Modal title={`Performance : ${exam.title}`} onClose={onClose} maxWidth="sm:max-w-[80%]">
      <div className="flex flex-col h-full bg-slate-50/30">
        {loading ? (
          <div className="p-10 sm:p-20 flex flex-col items-center justify-center space-y-4">
             <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
             <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Chargement des données...</p>
          </div>
        ) : stats ? (
          <>
            {/* Stats Overview */}
            <div className="p-5 sm:p-8 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 bg-white border-b border-slate-100">
               <Card className="p-4 sm:p-6 bg-indigo-50/50 border-none shadow-none">
                 <p className="text-[9px] sm:text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1 sm:mb-2 flex items-center gap-1.5"><TrendingUp className="w-3 h-3" /> Moyenne</p>
                 <h4 className="text-2xl sm:text-3xl font-black text-indigo-900">{stats.average}%</h4>
               </Card>
               <Card className="p-4 sm:p-6 bg-emerald-50/50 border-none shadow-none">
                 <p className="text-[9px] sm:text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 sm:mb-2 flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" /> Taux de réussite</p>
                 <h4 className="text-2xl sm:text-3xl font-black text-emerald-900">{stats.passRate}%</h4>
               </Card>
               <Card className="p-4 sm:p-6 bg-slate-50 border-none shadow-none">
                 <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 sm:mb-2 flex items-center gap-1.5"><Users className="w-3 h-3" /> Participants</p>
                 <h4 className="text-2xl sm:text-3xl font-black text-slate-900">{results.length}</h4>
               </Card>
               <Card className="p-4 sm:p-6 bg-rose-50/50 border-none shadow-none">
                 <p className="text-[9px] sm:text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1 sm:mb-2 flex items-center gap-1.5"><AlertCircle className="w-3 h-3" /> Note minimale</p>
                 <h4 className="text-2xl sm:text-3xl font-black text-rose-900">{stats.lowest}%</h4>
               </Card>
            </div>

            {/* Tabs */}
            <div className="flex px-5 sm:px-8 border-b border-slate-100 bg-white sticky top-0 z-20">
              <button 
                onClick={() => setActiveTab('analytics')}
                className={cn(
                  "px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2",
                  activeTab === 'analytics' 
                    ? "text-indigo-600 border-indigo-600 bg-indigo-50/5" 
                    : "text-slate-400 border-transparent hover:text-slate-600"
                )}
              >
                Analytiques
              </button>
              <button 
                onClick={() => setActiveTab('students')}
                className={cn(
                  "px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2",
                  activeTab === 'students' 
                    ? "text-indigo-600 border-indigo-600 bg-indigo-50/5" 
                    : "text-slate-400 border-transparent hover:text-slate-600"
                )}
              >
                Résultats par Étudiant
              </button>
              <button 
                onClick={() => setActiveTab('questions')}
                className={cn(
                  "px-6 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2",
                  activeTab === 'questions' 
                    ? "text-indigo-600 border-indigo-600 bg-indigo-50/5" 
                    : "text-slate-400 border-transparent hover:text-slate-600"
                )}
              >
                Analyse par Question
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 custom-scrollbar">
              {activeTab === 'analytics' ? (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card className="p-6">
                      <div className="flex items-center gap-2 mb-6">
                        <BarChart className="w-5 h-5 text-indigo-600" />
                        <h5 className="text-sm font-black text-slate-900 uppercase tracking-tight">Répartition des Notes</h5>
                      </div>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ReBarChart data={stats.distribution}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="bin" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <Tooltip 
                              cursor={{ fill: '#f8fafc' }}
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px' }}
                            />
                            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                              {stats.distribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                              ))}
                            </Bar>
                          </ReBarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>

                    <Card className="p-6">
                      <div className="flex items-center gap-2 mb-6">
                        <PieChartIcon className="w-5 h-5 text-emerald-600" />
                        <h5 className="text-sm font-black text-slate-900 uppercase tracking-tight">Taux de Réussite vs Échec</h5>
                      </div>
                      <div className="h-64 w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={stats.pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {stats.pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute flex flex-col items-center">
                          <span className="text-2xl font-black text-emerald-600">{stats.passRate}%</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Réussite</span>
                        </div>
                      </div>
                    </Card>
                  </div>

                  <Card className="p-6">
                    <div className="flex items-center gap-2 mb-6">
                      <TrendingUp className="w-5 h-5 text-indigo-600" />
                      <h5 className="text-sm font-black text-slate-900 uppercase tracking-tight">Comparaison des Questions</h5>
                    </div>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ReBarChart data={questionStats} layout="vertical" margin={{ left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                          <XAxis type="number" domain={[0, 100]} hide />
                          <YAxis dataKey="id" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} width={30} />
                          <Tooltip 
                            formatter={(value: number) => [`${value}%`, 'Taux de réussite']}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px' }}
                          />
                          <Bar dataKey="successRate" radius={[0, 4, 4, 0]}>
                            {questionStats.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.successRate >= 50 ? '#818cf8' : '#f87171'} />
                            ))}
                          </Bar>
                        </ReBarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </div>
              ) : activeTab === 'students' ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 bg-slate-50/10 backdrop-blur-sm z-10 py-2">
                    <h5 className="text-sm font-black text-slate-900 uppercase tracking-tight">Liste des Étudiants ({filteredResults.length})</h5>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        placeholder="Chercher par nom ou email..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full sm:w-80 pl-9 pr-4 py-2 bg-white border-2 border-slate-100 focus:border-indigo-500/20 rounded-xl text-xs font-bold transition-all outline-none shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                          <th className="p-4">
                            <button onClick={() => toggleSort('studentName')} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">
                              Étudiant {sortConfig.key === 'studentName' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                            </button>
                          </th>
                          <th className="p-4">
                            <button onClick={() => toggleSort('score')} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">
                              Score {sortConfig.key === 'score' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                            </button>
                          </th>
                          <th className="p-4">
                            <button onClick={() => toggleSort('completedAt')} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">
                              Date (Fait le) {sortConfig.key === 'completedAt' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                            </button>
                          </th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredResults.map(r => {
                          const scorePercent = (r.score / (r.totalPoints || 1)) * 100;
                          return (
                            <tr key={r.id} className="group hover:bg-slate-50/30 transition-colors cursor-pointer" onClick={() => setSelectedResult(r)}>
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0",
                                    scorePercent >= 50 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                  )}>
                                    {r.studentName?.[0]}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-900 text-xs leading-none mb-1 group-hover:text-indigo-600 transition-colors truncate">{r.studentName}</p>
                                    <p className="text-[9px] text-slate-400 truncate">{r.studentEmail}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="inline-flex flex-col">
                                  <span className={cn(
                                    "text-xs font-black",
                                    scorePercent >= 80 ? "text-emerald-600" : scorePercent >= 50 ? "text-slate-700" : "text-rose-600"
                                  )}>
                                    {formatScore(r.score)} / {r.totalPoints}
                                  </span>
                                  <div className="w-16 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                    <div className={cn("h-full", scorePercent >= 50 ? "bg-emerald-500" : "bg-rose-500")} style={{ width: `${scorePercent}%` }} />
                                  </div>
                                </div>
                              </td>
                              <td className="p-4">
                                <span className="text-[10px] font-medium text-slate-500">{new Date(r.completedAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                              </td>
                              <td className="p-4 text-right">
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg text-slate-300 group-hover:text-indigo-600">
                                  <ChevronRight className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-4 sticky top-0 bg-slate-50/10 backdrop-blur-sm z-10 py-2">
                    <h5 className="text-sm font-black text-slate-900 uppercase tracking-tight">Analyse détaillée par Question</h5>
                  </div>

                  <div className="space-y-4">
                    {questionStats?.map((q, idx) => {
                      const qAr = isArabic(q.questionText);
                      return (
                        <div key={idx} className={cn("bg-white p-5 sm:p-6 rounded-2xl border border-slate-100 space-y-4", qAr ? "text-right" : "text-left")} dir={qAr ? "rtl" : "ltr"}>
                          <div className={cn("flex justify-between items-start gap-4", qAr ? "flex-row-reverse" : "")}>
                            <div className={cn("flex items-start gap-3 flex-1 min-w-0", qAr ? "flex-row-reverse" : "")}>
                              <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center text-xs font-black shrink-0">
                                #{idx + 1}
                              </span>
                              <div className="min-w-0">
                                <span className={cn("text-[9px] font-black bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded uppercase tracking-widest mb-1.5 inline-block", qAr ? "ml-auto" : "")}>
                                  {q.type}
                                </span>
                                <div className={cn("text-sm font-bold text-slate-700 leading-relaxed break-words line-clamp-2", qAr ? "text-right" : "text-left")} dangerouslySetInnerHTML={{ __html: q.questionText }} />
                              </div>
                            </div>
                            <div className={cn("shrink-0", qAr ? "text-left" : "text-right")}>
                              <span className="text-xl font-black text-slate-900 leading-none block">{q.successRate}%</span>
                              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Réussite</span>
                            </div>
                          </div>

                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                          <div className="space-y-1">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Étudiants Corrects</p>
                            <p className="text-sm font-bold text-slate-700">{q.correctCount} / {results.length}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Point Moyens</p>
                            <div className="flex items-end gap-1.5">
                              <p className="text-sm font-bold text-slate-700 leading-none">{formatScore(q.avgPoints)}</p>
                              <p className="text-[10px] font-bold text-slate-300 leading-none mb-0.5">/ {q.maxPoints}</p>
                            </div>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden mt-2">
                          <div 
                            className={cn(
                              "h-full transition-all duration-1000 ease-out rounded-full",
                              q.successRate >= 70 ? "bg-emerald-500" : q.successRate >= 40 ? "bg-amber-500" : "bg-rose-500"
                            )}
                            style={{ width: `${q.successRate}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="p-10 sm:p-20 flex flex-col items-center justify-center text-center space-y-4">
             <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
               <Users className="w-8 h-8 text-slate-300" />
             </div>
             <div>
               <h4 className="font-black text-slate-900">Aucun résultat</h4>
               <p className="text-sm text-slate-400 max-w-[240px] mt-2">Cet examen n'a pas encore été passé par des étudiants.</p>
             </div>
          </div>
        )}

        <div className="p-6 bg-white border-t border-slate-100 flex gap-3">
           <Button onClick={onClose} variant="outline" className="flex-1">Fermer</Button>
           <Button variant="outline" className="flex-1 gap-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50" onClick={handleExportPDF} disabled={!stats || isExporting}>
             <FileDown className="w-4 h-4" /> {isExporting ? 'Exportation...' : 'Exporter PDF'}
           </Button>
           <Button variant="outline" className="flex-1 gap-2 border-slate-200 text-slate-600 hover:bg-slate-50" onClick={handleExportCSV} disabled={!stats}>
             <Download className="w-4 h-4" /> Exporter CSV (Excel)
           </Button>
        </div>

        {/* Hidden Export Template */}
        <div style={{ position: 'absolute', left: '-9999px', top: '0' }}>
          {exportData && (
            <ResultsExportTemplate 
              ref={resultsExportRef}
              exam={exportData.exam}
              results={exportData.results}
              module={exportData.module}
              filiereName={exportData.filiereName}
              groupName={exportData.groupName}
              settings={settings}
            />
          )}
        </div>

        {selectedResult && (
          <ResultDetailsModal 
            exam={exam}
            result={selectedResult}
            user={{
              id: selectedResult.studentId,
              email: selectedResult.studentEmail || '',
              displayName: selectedResult.studentName || '',
              role: 'student',
              groupName: selectedResult.groupName,
              filiere: selectedResult.filiere,
              createdAt: selectedResult.completedAt,
            }}
            modules={modules}
            onClose={() => setSelectedResult(null)}
          />
        )}
      </div>
    </Modal>
  );
};
