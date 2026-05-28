import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  BookOpen, FileText, Users, Award, TrendingUp, 
  AlertTriangle, CheckCircle, Search, Filter, 
  ArrowUpDown, Download, BarChart2
} from 'lucide-react';
import { Module, Exam, Result } from '../../types';
import { Modal } from '../ui/Modal';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

interface ModuleInsightsModalProps {
  module: Module;
  onClose: () => void;
  exams: Exam[];
  results: Result[];
}

export const ModuleInsightsModal = ({
  module,
  onClose,
  exams,
  results
}: ModuleInsightsModalProps) => {
  const [activeTab, setActiveTab] = useState<'assessments' | 'ledger'>('assessments');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [sortField, setSortField] = useState<'name' | 'group' | 'average'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // 1. Get Exams of this Module
  const moduleExams = useMemo(() => {
    return exams.filter(e => e.moduleId === module.id && e.status === 'active');
  }, [exams, module.id]);

  const ccExams = useMemo(() => {
    return moduleExams.filter(e => e.type === 'controle-continu');
  }, [moduleExams]);

  const efmExams = useMemo(() => {
    return moduleExams.filter(e => e.type === 'fin-de-module');
  }, [moduleExams]);

  // 2. Get Results for these exams
  const examIds = useMemo(() => moduleExams.map(e => e.id), [moduleExams]);
  const moduleResults = useMemo(() => {
    return results.filter(r => examIds.includes(r.examId));
  }, [results, examIds]);

  // 3. Reconstruct student list dynamically with their grades
  const students = useMemo(() => {
    const map = new Map<number, {
      id: number;
      name: string;
      email: string;
      groupName: string;
      scores: Record<number, number>; // examId -> score
    }>();

    moduleResults.forEach(r => {
      if (!map.has(r.studentId)) {
        map.set(r.studentId, {
          id: r.studentId,
          name: r.studentName || 'Étudiant Anonyme',
          email: r.studentEmail || '',
          groupName: r.groupName || 'Sans groupe',
          scores: {}
        });
      }
      const s = map.get(r.studentId)!;
      s.scores[r.examId] = r.score;
    });

    return Array.from(map.values());
  }, [moduleResults]);

  // 4. Calculate stats for each student
  const studentGradesWithStats = useMemo(() => {
    return students.map(student => {
      // CC Average
      const ccScores = ccExams
        .map(e => student.scores[e.id])
        .filter(score => score !== undefined) as number[];
      const ccAvg = ccScores.length > 0 
        ? ccScores.reduce((sum, s) => sum + s, 0) / ccScores.length 
        : null;

      // EFM Score
      const efmScores = efmExams
        .map(e => student.scores[e.id])
        .filter(score => score !== undefined) as number[];
      const efmScore = efmScores.length > 0 ? efmScores[0] : null;

      // Blended final mark
      let finalAverage: number | null = null;
      if (ccAvg !== null && efmScore !== null) {
        finalAverage = (ccAvg + efmScore) / 2;
      } else if (ccAvg !== null) {
        finalAverage = ccAvg;
      } else if (efmScore !== null) {
        finalAverage = efmScore;
      }

      return {
        ...student,
        ccAvg,
        efmScore,
        finalAverage
      };
    });
  }, [students, ccExams, efmExams]);

  // 5. Compute distinct student groups
  const groupOptions = useMemo(() => {
    const list = new Set(students.map(s => s.groupName));
    return Array.from(list).sort();
  }, [students]);

  // 6. Stats for assessments
  const assessmentsStats = useMemo(() => {
    return moduleExams.map(exam => {
      const examResults = moduleResults.filter(r => r.examId === exam.id);
      const scores = examResults.map(r => r.score);
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const max = scores.length > 0 ? Math.max(...scores) : 0;
      const min = scores.length > 0 ? Math.min(...scores) : 0;
      const successCount = scores.filter(s => s >= 10).length;
      const successRate = scores.length > 0 ? Math.round((successCount / scores.length) * 100) : 0;

      return {
        exam,
        avg,
        max,
        min,
        successRate,
        resultsCount: examResults.length
      };
    });
  }, [moduleExams, moduleResults]);

  // 7. Global Aggregates
  const globalAggregates = useMemo(() => {
    const gradedStudents = studentGradesWithStats.filter(s => s.finalAverage !== null);
    const totalAssessed = gradedStudents.length;

    const scoresSum = gradedStudents.reduce((sum, s) => sum + (s.finalAverage || 0), 0);
    const overallAvg = totalAssessed > 0 ? scoresSum / totalAssessed : 0;

    const validatedCount = gradedStudents.filter(s => (s.finalAverage || 0) >= 10).length;
    const validationRate = totalAssessed > 0 ? Math.round((validatedCount / totalAssessed) * 100) : 0;

    return {
      totalAssessed,
      overallAvg,
      validationRate,
      examsCount: moduleExams.length
    };
  }, [studentGradesWithStats, moduleExams]);

  // Sort and Filter student rows
  const sortedAndFilteredLedger = useMemo(() => {
    let list = studentGradesWithStats.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
                            s.email.toLowerCase().includes(studentSearch.toLowerCase());
      const matchesGroup = selectedGroup === 'all' || s.groupName === selectedGroup;
      return matchesSearch && matchesGroup;
    });

    list.sort((a, b) => {
      let valA: any = a.name;
      let valB: any = b.name;

      if (sortField === 'group') {
        valA = a.groupName;
        valB = b.groupName;
      } else if (sortField === 'average') {
        valA = a.finalAverage ?? -1;
        valB = b.finalAverage ?? -1;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [studentGradesWithStats, studentSearch, selectedGroup, sortField, sortDirection]);

  const handleSort = (field: 'name' | 'group' | 'average') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleExportCSV = () => {
    const headers = ["Étudiant", "Email", "Classe/Groupe", ...moduleExams.map(e => e.groupName ? `${e.title} (${e.groupName})` : e.title), "Moyenne CC", "Note EFM", "Moyenne Finale"];
    const rows = studentGradesWithStats.map(s => {
      const examScores = moduleExams.map(e => s.scores[e.id] !== undefined ? s.scores[e.id].toString() : "-");
      return [
        s.name,
        s.email,
        s.groupName,
        ...examScores,
        s.ccAvg !== null ? s.ccAvg.toFixed(2) : "-",
        s.efmScore !== null ? s.efmScore.toFixed(2) : "-",
        s.finalAverage !== null ? s.finalAverage.toFixed(2) : "-"
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Analyse_Module_${module.code}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Modal 
      title={`Analyse de Performance : ${module.name}`} 
      onClose={onClose} 
      maxWidth="max-w-5xl"
      headerActions={
        <span className="px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-[10px] font-black uppercase text-indigo-600 tracking-wider">
          {module.code}
        </span>
      }
    >
      <div className="space-y-6 p-6 sm:p-8">
        
        {/* Module Header Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-indigo-50/10 border border-indigo-100/40 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-indigo-600">
              <Users className="w-4 h-4" />
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Étudiants évalués</span>
            </div>
            <p className="text-2xl font-black text-slate-800 mt-2">{globalAggregates.totalAssessed}</p>
          </Card>

          <Card className="p-4 bg-sky-50/10 border border-sky-100/40 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-sky-600">
              <FileText className="w-4 h-4" />
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Évaluations Actives</span>
            </div>
            <p className="text-2xl font-black text-slate-800 mt-2">{globalAggregates.examsCount}</p>
          </Card>

          <Card className="p-4 bg-emerald-50/10 border border-emerald-100/40 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Moyenne Générale</span>
            </div>
            <p className={cn(
              "text-2xl font-black mt-2",
              globalAggregates.overallAvg >= 10 ? "text-emerald-700" : "text-amber-600"
            )}>
              {globalAggregates.overallAvg > 0 ? globalAggregates.overallAvg.toFixed(2) : "0.00"}/20
            </p>
          </Card>

          <Card className="p-4 bg-purple-50/10 border border-purple-100/40 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-purple-600">
              <Award className="w-4 h-4" />
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Taux de Validation</span>
            </div>
            <p className="text-2xl font-black text-slate-800 mt-2">{globalAggregates.validationRate}%</p>
          </Card>
        </div>

        {/* Tab Selection Controls */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex bg-slate-100/75 p-1 rounded-2xl border border-slate-200/20">
            <button
              onClick={() => setActiveTab('assessments')}
              className={cn(
                "py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
                activeTab === 'assessments'
                  ? "bg-white text-indigo-650 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              <BarChart2 className="w-4 h-4" /> Détail Évaluations
            </button>
            <button
              onClick={() => setActiveTab('ledger')}
              className={cn(
                "py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
                activeTab === 'ledger'
                  ? "bg-white text-indigo-650 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              <Users className="w-4 h-4" /> Registre de Notes
            </button>
          </div>

          {activeTab === 'ledger' && students.length > 0 && (
            <Button
              onClick={handleExportCSV}
              variant="outline"
              size="sm"
              className="h-9 px-3 text-[10px] uppercase font-black tracking-wider flex items-center gap-2 border-emerald-100 text-emerald-600 hover:bg-emerald-50"
            >
              <Download className="w-3.5 h-3.5" /> Exporter CSV
            </Button>
          )}
        </div>

        {/* Active Tab View */}
        {activeTab === 'assessments' ? (
          <div className="space-y-4">
            {assessmentsStats.length === 0 ? (
              <div className="p-12 text-center bg-slate-50 border border-slate-100 rounded-3xl">
                <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3 opacity-70" />
                <h5 className="text-sm font-black text-slate-800 uppercase tracking-wider">Aucune évaluation programmée ou publiée</h5>
                <p className="text-xs text-slate-400 mt-1">Les contrôles ou examens requis n'ont pas encore été complétés pour ce module.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assessmentsStats.map(({ exam, avg, max, min, successRate, resultsCount }) => (
                  <Card key={exam.id} className="p-5 border-2 border-slate-50 hover:border-slate-100 hover:shadow-lg hover:shadow-slate-100/50 transition-all">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className={cn(
                          "px-2 py-0.5 text-[8px] font-black rounded uppercase tracking-wider",
                          exam.type === 'controle-continu' 
                            ? "bg-indigo-50 text-indigo-600 border border-indigo-100/50" 
                            : "bg-purple-50 text-purple-600 border border-purple-100/50"
                        )}>
                          {exam.type === 'controle-continu' ? 'Contrôle Continu' : 'Examen Fin de Module'}
                        </span>
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight mt-1.5 leading-tight">{exam.title}</h4>
                        <span className="text-[10px] font-bold text-slate-400 mt-0.5 block">{exam.groupName || "Tous Groupes"}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={cn(
                          "text-lg font-black block tracking-tight",
                          avg >= 10 ? "text-emerald-600" : "text-amber-500"
                        )}>
                          {avg.toFixed(2)}/20
                        </span>
                        <span className="text-[8px] text-slate-400 font-bold block uppercase mt-0.5">Moyenne de classe</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-4 bg-slate-55 p-2 rounded-xl border border-slate-100">
                      <div className="text-center">
                        <span className="text-[8px] font-black tracking-wider text-slate-400 uppercase block">Max</span>
                        <span className="text-xs font-black text-slate-700 block mt-0.5">{max.toFixed(2)}</span>
                      </div>
                      <div className="text-center border-x border-slate-100">
                        <span className="text-[8px] font-black tracking-wider text-slate-400 uppercase block">Min</span>
                        <span className="text-xs font-black text-slate-700 block mt-0.5">{min.toFixed(2)}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-[8px] font-black tracking-wider text-slate-400 uppercase block">Copies</span>
                        <span className="text-xs font-black text-slate-700 block mt-0.5">{resultsCount}</span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
                        <span>Taux de réussite (≥ 10)</span>
                        <span className="text-emerald-600 font-extrabold">{successRate}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${successRate}%` }}
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* Search and Filters inside Ledger */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                  <Search className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  placeholder="Filtrer un étudiant par nom ou email..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full bg-slate-50 text-slate-800 text-xs font-semibold pl-9 pr-4 py-2.5 rounded-xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all placeholder:text-slate-400"
                />
              </div>

              {groupOptions.length > 0 && (
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                  <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer border-none p-0 pr-6"
                  >
                    <option value="all">Tous Groupes</option>
                    {groupOptions.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Core Grades Ledger Table */}
            {sortedAndFilteredLedger.length === 0 ? (
              <div className="p-10 text-center bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-2xl">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Aucun étudiant trouvé</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Modifiez vos filtres ou relancez la recherche.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-100 bg-white rounded-2xl shadow-sm">
                <table className="w-full border-collapse text-left text-xs text-slate-600">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 font-black tracking-widest text-[9px] text-slate-400 uppercase select-none">
                      <th onClick={() => handleSort('name')} className="py-4 px-4 cursor-pointer hover:bg-slate-100/50 transition-colors">
                        <div className="flex items-center gap-1.5">
                          <span>Étudiant</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th onClick={() => handleSort('group')} className="py-4 px-4 cursor-pointer hover:bg-slate-100/50 transition-colors">
                        <div className="flex items-center gap-1.5">
                          <span>Classe</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      
                      {/* Interactive exam headers */}
                      {moduleExams.map(exam => (
                        <th key={exam.id} className="py-4 px-4 text-center">
                          <span className="block truncate max-w-[120px]" title={exam.title}>
                            {exam.title}
                          </span>
                        </th>
                      ))}

                      <th className="py-4 px-4 text-center">Moy. CC</th>
                      <th className="py-4 px-4 text-center">Note EFM</th>
                      <th onClick={() => handleSort('average')} className="py-4 px-4 text-center cursor-pointer hover:bg-slate-100/50 transition-colors">
                        <div className="flex items-center justify-center gap-1.5">
                          <span>Note Finale</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAndFilteredLedger.map((s) => {
                      const isAbs = s.finalAverage === null;
                      const isPassed = !isAbs && (s.finalAverage || 0) >= 10;

                      return (
                        <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors">
                          <td className="py-3 px-4 font-extrabold text-slate-800">
                            <div className="flex flex-col">
                              <span>{s.name}</span>
                              <span className="text-[10px] font-normal text-slate-400">{s.email}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-500">{s.groupName}</td>
                          
                          {moduleExams.map(exam => {
                            const score = s.scores[exam.id];
                            return (
                              <td key={exam.id} className="py-3 px-4 text-center">
                                {score !== undefined ? (
                                  <span className={cn(
                                    "font-black text-xs px-2 py-1 rounded-md",
                                    score >= 10 ? "text-emerald-700 bg-emerald-50/50" : "text-amber-600 bg-amber-50/40"
                                  )}>
                                    {score.toFixed(1)}
                                  </span>
                                ) : (
                                  <span className="text-slate-350 text-[10px] font-bold">Absent</span>
                                )}
                              </td>
                            );
                          })}

                          {/* CC Avg Cell */}
                          <td className="py-3 px-4 text-center font-bold">
                            {s.ccAvg !== null ? (
                              <span className={s.ccAvg >= 10 ? "text-emerald-650" : "text-amber-500"}>
                                {s.ccAvg.toFixed(2)}
                              </span>
                            ) : "-"}
                          </td>

                          {/* EFM Cell */}
                          <td className="py-3 px-4 text-center font-bold">
                            {s.efmScore !== null ? (
                              <span className={s.efmScore >= 10 ? "text-purple-650" : "text-amber-500"}>
                                {s.efmScore.toFixed(2)}
                              </span>
                            ) : "-"}
                          </td>

                          {/* Final Score blended badge */}
                          <td className="py-3 px-4 text-center">
                            {s.finalAverage !== null ? (
                              <span className={cn(
                                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black",
                                isPassed 
                                  ? "bg-emerald-100 text-emerald-850" 
                                  : "bg-rose-100 text-rose-850"
                              )}>
                                {isPassed ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />}
                                {s.finalAverage.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-bold italic">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        
      </div>
    </Modal>
  );
};
