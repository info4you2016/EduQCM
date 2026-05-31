import React, { useState, useMemo } from 'react';
import { 
  Users, BookOpen, ClipboardList, Bell, Plus, Search, Filter, 
  ChevronDown, Edit2, Trash2, LayoutDashboard, Database, Eye, History, CheckCircle2, Star, Clock, BarChart, Target,
  FileDown, Sparkles, FileText, Settings, Loader2, Copy, AlertTriangle, Radio,
  ArrowUpDown, ArrowUp, ArrowDown, Trophy, TrendingUp, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../../lib/api';
import { cn, normalizeQuestion, stripHtml, formatScore, formatPercent, formatDuration } from '../../lib/utils';
import { Module, Exam, Result, Notification, Filiere, UserProfile, Group, Question, QuestionType, OrganizationSettings } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { StatCard } from '../ui/StatCard';
import { EmptyState } from '../ui/EmptyState';
import { Modal } from '../ui/Modal';
import { DatabaseManagement } from '../sections/DatabaseManagement';
import { OrganizationSettingsView } from '../sections/OrganizationSettingsView';
import { ModulesTab } from '../sections/ModulesTab';
import { ExamsTab } from '../sections/ExamsTab';
import { StatisticsTab } from '../sections/StatisticsTab';
import { ExamPreviewModal } from '../modals/ExamPreviewModal';
import { LiveSupervisionModal } from '../modals/LiveSupervisionModal';
import { FiliereGroupManagement } from './FiliereGroupManagement';
import { DetailedNotificationCard } from '../DetailedNotificationCard';
import { AdminUserManagement } from '../sections/AdminUserManagement';
import { AuditLogsView } from '../sections/AuditLogsView';
import { AiAssistantView } from './AiAssistantView';
import { SuiviAnalyseView } from './SuiviAnalyseView';
import { ResultDetailModal } from '../modals/ResultDetailModal';
import { AddModuleForm } from '../forms/AddModuleForm';
import { AddNotificationForm } from '../forms/AddNotificationForm';
import { AddExamForm } from '../forms/AddExamForm';
import { ExamPerformanceModal } from '../modals/ExamPerformanceModal';
import { ActivateExamModal } from '../modals/ActivateExamModal';
import { ExportModelModal } from '../modals/ExportModelModal';
import { ExamExportTemplate } from '../ExamExportTemplate';
import { ResultsExportTemplate } from '../ResultsExportTemplate';
import { PVExportTemplate } from '../PVExportTemplate';
import { exportExamToWord } from '../../lib/docxExport';
import { exportPVToWord } from '../../lib/pvDocxExport';
import { generateExamPDF, generateResultsPDF } from '../../lib/pdfExport';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

interface TeacherDashboardProps {
  modules: Module[];
  exams: Exam[];
  results: Result[];
  notifications: Notification[];
  filieres: Filiere[];
  studentCount: number;
  user: UserProfile;
  onRefresh: () => void;
  groups: Group[];
  activeTabOverride?: string;
  onTabChange?: (tab: any) => void;
}

export const TeacherDashboard = ({ 
  modules, 
  exams, 
  results, 
  notifications, 
  filieres, 
  studentCount, 
  user, 
  onRefresh,
  groups,
  activeTabOverride,
  onTabChange
}: TeacherDashboardProps) => {
  const [activeTab, setActiveInternalTab] = useState<'overview' | 'modules' | 'exams' | 'results' | 'notifications' | 'groups' | 'filieres' | 'system' | 'ai' | 'settings' | 'users' | 'audit'>(
    (activeTabOverride as any) || 'overview'
  );

  const setActiveTab = (tab: any) => {
    setActiveInternalTab(tab);
    onTabChange?.(tab);
  };

  React.useEffect(() => {
    if (activeTabOverride && activeTabOverride !== activeTab) {
      setActiveInternalTab(activeTabOverride as any);
    }
  }, [activeTabOverride]);

  const [isAddingModule, setIsAddingModule] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [isAddingExam, setIsAddingExam] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [isAddingNotification, setIsAddingNotification] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [resultsFilterModule, setResultsFilterModule] = useState<string>('all');
  const [resultsFilterGroup, setResultsFilterGroup] = useState<string>('all');
  const [resultsFilterScore, setResultsFilterScore] = useState<string>('all');
  const [resultsPage, setResultsPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(10);
  const [resultsMainMode, setResultsMainMode] = useState<'suivi' | 'registry'>('suivi');
  const [resultsViewMode, setResultsViewMode] = useState<'by-exam' | 'all-results'>('by-exam');
  const [resultsSortField, setResultsSortField] = useState<'name' | 'score' | 'date'>('date');
  const [resultsSortOrder, setResultsSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [selectedExamSubTab, setSelectedExamSubTab] = useState<'copies' | 'questions'>('copies');
  const [expandedQuestionIdx, setExpandedQuestionIdx] = useState<number | null>(null);

  React.useEffect(() => {
    setSelectedExamSubTab('copies');
    setExpandedQuestionIdx(null);
  }, [selectedExamId]);

  const [sortBy, setSortBy] = useState<'createdAt' | 'title'>('createdAt');
  const [previewExam, setPreviewExam] = useState<Exam | null>(null);
  const [supervisingExam, setSupervisingExam] = useState<Exam | null>(null);
  const [performanceExam, setPerformanceExam] = useState<Exam | null>(null);
  const [viewingResult, setViewingResult] = useState<Result | null>(null);
  const [activatingExam, setActivatingExam] = useState<Exam | null>(null);
  const [orgSettings, setOrgSettings] = useState<OrganizationSettings | null>(null);

  const filteredResultsStats = useMemo(() => {
    const list = results.filter(r => {
      const exam = exams.find(e => e.id === r.examId);
      const matchesSearch = r.studentName?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesExam = !selectedExamId || r.examId === selectedExamId;
      const matchesModule = resultsFilterModule === 'all' || exam?.moduleId === Number(resultsFilterModule);
      const matchesGroup = resultsFilterGroup === 'all' || r.groupName === groups.find(g => g.id === Number(resultsFilterGroup))?.name;
      
      const pct = (r.score / (r.totalPoints || 1)) * 100;
      const matchesScore = resultsFilterScore === 'all' ||
        (resultsFilterScore === 'excellent' && pct >= 80) ||
        (resultsFilterScore === 'average' && pct >= 50 && pct < 80) ||
        (resultsFilterScore === 'fail' && pct < 50);

      return matchesSearch && matchesExam && matchesModule && matchesGroup && matchesScore;
    });

    const total = list.length;
    const avgScore = total > 0 ? (list.reduce((acc, r) => acc + (r.score / (r.totalPoints || 1)), 0) / total) * 100 : 0;
    const successCount = list.filter(r => (r.score / (r.totalPoints || 1)) >= 0.5).length;
    const successPercent = total > 0 ? (successCount / total) * 100 : 0;

    const percentages = list.map(r => (r.score / (r.totalPoints || 1)) * 100).sort((a, b) => a - b);
    const maxScore = percentages.length > 0 ? Math.max(...percentages) : 0;
    const minScore = percentages.length > 0 ? Math.min(...percentages) : 0;
    let medianScore = 0;
    if (percentages.length > 0) {
      const mid = Math.floor(percentages.length / 2);
      medianScore = percentages.length % 2 !== 0 ? percentages[mid] : (percentages[mid - 1] + percentages[mid]) / 2;
    }

    const distribution = {
      excellent: list.filter(r => ((r.score / (r.totalPoints || 1)) * 100) >= 80).length,
      good: list.filter(r => {
        const pct = (r.score / (r.totalPoints || 1)) * 100;
        return pct >= 60 && pct < 80;
      }).length,
      pass: list.filter(r => {
        const pct = (r.score / (r.totalPoints || 1)) * 100;
        return pct >= 50 && pct < 60;
      }).length,
      fail: list.filter(r => ((r.score / (r.totalPoints || 1)) * 100) < 50).length
    };

    return {
      list,
      total,
      avgScore: Math.round(avgScore),
      successPercent: Math.round(successPercent),
      maxScore: Math.round(maxScore),
      minScore: Math.round(minScore),
      medianScore: Math.round(medianScore),
      distribution
    };
  }, [results, exams, searchQuery, selectedExamId, resultsFilterModule, resultsFilterGroup, resultsFilterScore, groups]);

  const resultsSummaryStats = useMemo(() => {
    if (results.length === 0) return { avg: 0, success: 0, total: 0 };
    const total = results.length;
    const avg = results.reduce((acc, r) => acc + (r.score / (r.totalPoints || 1)), 0) / total;
    const successCount = results.filter(r => (r.score / (r.totalPoints || 1)) >= 0.5).length;
    return {
      avg: Math.round(avg * 100),
      success: Math.round((successCount / total) * 100),
      total
    };
  }, [results]);

  const questionStats = useMemo(() => {
    if (!selectedExamId) return [];
    const exam = exams.find(e => e.id === selectedExamId);
    if (!exam) return [];

    const examResults = results.filter(r => r.examId === selectedExamId);
    const totalStudents = examResults.length;

    return exam.questions.map((q, idx) => {
      let correctCount = 0;
      let partialCount = 0;
      let incorrectCount = 0;
      let totalPointsEarned = 0;

      examResults.forEach(r => {
        const qRes = r.questionResults?.[idx];
        const pointsEarned = qRes?.pointsEarned || 0;
        totalPointsEarned += pointsEarned;

        if (qRes?.isCorrect) {
          correctCount++;
        } else if (pointsEarned > 0) {
          partialCount++;
        } else {
          incorrectCount++;
        }
      });

      const successPercent = totalStudents > 0 
        ? Math.round((correctCount / totalStudents) * 100) 
        : 0;

      const partialPercent = totalStudents > 0 
        ? Math.round((partialCount / totalStudents) * 100) 
        : 0;

      const incorrectPercent = totalStudents > 0 
        ? Math.round((incorrectCount / totalStudents) * 100) 
        : 0;

      const avgPoints = totalStudents > 0 ? (totalPointsEarned / totalStudents) : 0;
      const avgScorePct = Math.round((avgPoints / (q.points || 1)) * 100);

      // Student details who got a score of 0 on this question
      const strugglingStudents = examResults
        .filter(r => {
          const qRes = r.questionResults?.[idx];
          return !qRes || qRes.pointsEarned === 0;
        })
        .map(r => ({
          name: r.studentName || 'Étudiant',
          email: r.studentEmail || '',
          group: r.groupName || ''
        }));

      return {
        index: idx,
        questionText: q.text,
        type: q.type,
        points: q.points || 1,
        correctCount,
        partialCount,
        incorrectCount,
        successPercent,
        partialPercent,
        incorrectPercent,
        avgPoints,
        avgScorePct,
        strugglingStudents
      };
    });
  }, [selectedExamId, exams, results]);

  const sortedAndPaginatedResults = useMemo(() => {
    const sorted = [...filteredResultsStats.list].sort((a, b) => {
      let comparison = 0;
      if (resultsSortField === 'name') {
        comparison = (a.studentName || '').localeCompare(b.studentName || '');
      } else if (resultsSortField === 'score') {
        const pctA = a.score / (a.totalPoints || 1);
        const pctB = b.score / (b.totalPoints || 1);
        comparison = pctA - pctB;
      } else {
        comparison = new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime();
      }
      return resultsSortOrder === 'desc' ? -comparison : comparison;
    });
    const totalPages = Math.ceil(sorted.length / resultsPerPage);
    const startIndex = (resultsPage - 1) * resultsPerPage;
    const paginated = sorted.slice(startIndex, startIndex + resultsPerPage);
    return {
      sorted,
      totalPages: Math.max(1, totalPages),
      paginated
    };
  }, [filteredResultsStats.list, resultsSortField, resultsSortOrder, resultsPage, resultsPerPage]);

  const SortIcon = ({ field }: { field: 'name' | 'score' | 'date' }) => {
    if (resultsSortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 ml-1.5 inline text-slate-300 opacity-50 group-hover:opacity-100 transition-opacity" />;
    }
    return resultsSortOrder === 'asc' 
      ? <ArrowUp className="w-3.5 h-3.5 ml-1.5 inline text-indigo-600 font-black" />
      : <ArrowDown className="w-3.5 h-3.5 ml-1.5 inline text-indigo-600 font-black" />;
  };

  const handleSort = (field: 'name' | 'score' | 'date') => {
    if (resultsSortField === field) {
      setResultsSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setResultsSortField(field);
      setResultsSortOrder('desc');
    }
    setResultsPage(1);
  };

  const statsCards = (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <StatCard 
        title="Total Copies" 
        value={resultsSummaryStats.total} 
        icon={ClipboardList} 
        color="indigo" 
      />
      <StatCard 
        title="Moyenne Générale" 
        value={`${resultsSummaryStats.avg}%`} 
        icon={Star} 
        color="emerald" 
      />
      <StatCard 
        title="Taux de Réussite" 
        value={`${resultsSummaryStats.success}%`} 
        icon={CheckCircle2} 
        color="amber" 
      />
    </div>
  );

  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await api.settings.get();
        setOrgSettings(data);
      } catch (err) {
        console.error("Failed to fetch settings:", err);
      }
    };
    fetchSettings();
  }, []);
  
  // Export states
  const exportRef = React.useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportData, setExportData] = useState<{ 
    exam: Exam, 
    module: Module, 
    filiereName: string, 
    filiereLevel?: string, 
    groupName: string, 
    showAnswers: boolean, 
    paperSaver?: boolean, 
    qcmDoubleColumn?: boolean,
    customSettings?: OrganizationSettings | null 
  } | null>(null);

  // Export selection modal states
  const [exportConfigModalExam, setExportConfigModalExam] = useState<Exam | null>(null);
  const [exportConfigModalFormat, setExportConfigModalFormat] = useState<'pdf' | 'docx'>('pdf');
  const [exportConfigModalShowAnswers, setExportConfigModalShowAnswers] = useState<boolean>(false);

  // Results Export states
  const resultsExportRef = React.useRef<HTMLDivElement>(null);
  const [isExportingResults, setIsExportingResults] = useState(false);
  const [resultsExportData, setResultsExportData] = useState<{ exam: Exam, results: Result[], module: Module, filiereName: string, filiereLevel?: string, groupName: string } | null>(null);

  // PV Export states
  const pvExportRef = React.useRef<HTMLDivElement>(null);
  const [isExportingPV, setIsExportingPV] = useState(false);
  const [pvExportData, setPvExportData] = useState<{ exam: Exam, results: Result[], module: Module, filiereName: string, filiereLevel?: string, groupName: string } | null>(null);

  const handleExportPV = async (exam: Exam) => {
    const module = modules.find(m => m.id === exam.moduleId);
    const examResults = results.filter(r => r.examId === exam.id);
    if (!module || examResults.length === 0) {
      alert("Aucun résultat à exporter ou module introuvable.");
      return;
    }

    const groupId = exam.groupId || groups.find(g => g.name === exam.groupName)?.id;
    const group = groups.find(g => g.id === groupId);
    const filiere = filieres.find(f => f.id === group?.filiereId || module.filiereId);

    const groupName = group?.name || exam.groupName || 'N/A';
    const filiereName = filiere ? `[${filiere.code}] ${filiere.name}` : 'N/A';
    const filiereLevel = filiere?.niveau || '';

    setIsExportingPV(true);
    try {
      await exportPVToWord(
        exam,
        examResults,
        module,
        filiereName,
        filiereLevel,
        groupName,
        orgSettings
      );
    } catch (err) {
      console.error("PV Word Export failed:", err);
      alert("Erreur lors de l'exportation du PV de fin de module au format Word.");
    } finally {
      setIsExportingPV(false);
    }
  };

  const handleExportResultsPDF = async (exam: Exam) => {
    const module = modules.find(m => m.id === exam.moduleId);
    const examResults = results.filter(r => r.examId === exam.id);
    if (!module || examResults.length === 0) {
      alert("Aucun résultat à exporter ou module introuvable.");
      return;
    }

    const groupId = exam.groupId || groups.find(g => g.name === exam.groupName)?.id;
    const group = groups.find(g => g.id === groupId);
    const filiere = filieres.find(f => f.id === group?.filiereId || module.filiereId);

    const groupName = group?.name || exam.groupName || 'N/A';
    const filiereName = filiere ? `[${filiere.code}] ${filiere.name}` : 'N/A';
    const filiereLevel = filiere?.niveau || '';

    setIsExportingResults(true);
    try {
      setResultsExportData({ exam, results: examResults, module, filiereName, filiereLevel, groupName });
      // Wait for React to render/mount the results export template in DOM
      await new Promise(resolve => setTimeout(resolve, 600));

      await generateResultsPDF(
        exam,
        examResults,
        module,
        filiereName,
        filiereLevel,
        groupName,
        orgSettings
      );
    } catch (err) {
      console.error("Results PDF Export failed:", err);
      alert("Erreur lors de l'exportation des résultats.");
    } finally {
      setResultsExportData(null);
      setIsExportingResults(false);
    }
  };

  const handleExportPDF = (exam: Exam, showAnswers = false) => {
    setExportConfigModalExam(exam);
    setExportConfigModalFormat('pdf');
    setExportConfigModalShowAnswers(showAnswers);
  };

  const handleExportWord = (exam: Exam, showAnswers = false) => {
    setExportConfigModalExam(exam);
    setExportConfigModalFormat('docx');
    setExportConfigModalShowAnswers(showAnswers);
  };

  const executeExport = async (options: {
    templateId: string | 'default';
    format: 'pdf' | 'docx';
    showAnswers: boolean;
    paperSaver: boolean;
    qcmDoubleColumn?: boolean;
  }) => {
    const exam = exportConfigModalExam;
    if (!exam) return;

    // Close options modal
    setExportConfigModalExam(null);

    const module = modules.find(m => m.id === exam.moduleId);
    if (!module) return;

    const groupId = exam.groupId || groups.find(g => g.name === exam.groupName)?.id;
    const group = groups.find(g => g.id === groupId);
    const filiere = filieres.find(f => f.id === group?.filiereId || module.filiereId);

    const groupName = group?.name || exam.groupName || '';
    const filiereName = filiere ? `[${filiere.code}] ${filiere.name}` : 'N/A';
    const filiereLevel = filiere?.niveau || '';

    // Choose custom template settings if defined
    let finalSettings = orgSettings;
    if (options.templateId !== 'default' && orgSettings?.templates) {
      const template = orgSettings.templates.find(t => t.id === options.templateId);
      if (template) {
        finalSettings = {
          ...orgSettings,
          headerColumns: template.headerColumns,
          showHeaderLines: template.showHeaderLines,
          showFooter: template.showFooter,
          footerText: template.footerText,
          footerTable: template.footerTable,
          footerColumns: template.footerColumns,
          footerFontSize: template.footerFontSize,
          footerFontFamily: template.footerFontFamily
        };
      }
    }

    if (options.format === 'pdf') {
      setIsExporting(true);
      try {
        setExportData({ 
          exam, 
          module, 
          filiereName, 
          filiereLevel, 
          groupName, 
          showAnswers: options.showAnswers,
          paperSaver: options.paperSaver,
          qcmDoubleColumn: options.qcmDoubleColumn,
          customSettings: finalSettings
        });
        
        // Wait for React to render/mount the exam export template in DOM
        await new Promise(resolve => setTimeout(resolve, 800));

        await generateExamPDF(
          exam,
          module,
          filiereName,
          filiereLevel,
          groupName,
          options.showAnswers,
          finalSettings,
          user?.displayName || '',
          options.paperSaver,
          options.qcmDoubleColumn
        );
      } catch (err) {
         console.error("Exam PDF Export failed:", err);
         alert("Erreur lors de l'exportation PDF de l'examen.");
      } finally {
        setExportData(null);
        setIsExporting(false);
      }
    } else {
      const totalPoints = exam.questions.reduce((sum, q) => sum + (q.points || 0), 0);
      try {
        await exportExamToWord(
          exam,
          module,
          filiereName,
          groupName,
          totalPoints,
          options.showAnswers,
          finalSettings,
          filiereLevel,
          user?.displayName || '',
          options.paperSaver,
          options.qcmDoubleColumn
        );
      } catch (err) {
        console.error("Word Export failed:", err);
        alert("Erreur lors de l'exportation Word.");
      }
    }
  };

  const handleExportModuleExcel = async (module: Module) => {
    try {
      setIsExporting(true);
      
      // 1. Fetch relevant students
      // We'll get all students from the filiere assigned to this module
      let students: UserProfile[] = [];
      
      try {
        const allUsers = await api.admin.listUsers();
        if (module.filiereId) {
          students = allUsers.filter((u: any) => u.filiereId === module.filiereId && u.role === 'student');
        } else {
          // If no filiere fixed to module, get students who have taken at least one exam in this module
          const moduleExamIds = exams.filter(e => e.moduleId === module.id).map(e => e.id);
          const studentIdsWithResults = new Set(results.filter(r => moduleExamIds.includes(r.examId)).map(r => r.studentId));
          students = allUsers.filter((u: any) => studentIdsWithResults.has(u.id) && u.role === 'student');
        }
      } catch (err) {
        console.error("Failed to fetch students for export:", err);
        // Fallback to students present in results if admin list fails
        const moduleExamIds = exams.filter(e => e.moduleId === module.id).map(e => e.id);
        const studentIdsWithResults = new Set(results.filter(r => moduleExamIds.includes(r.examId)).map(r => r.studentId));
        
        // We don't have full info but we can try to reconstruct from results
        const uniqueStudentsMap = new Map();
        results.forEach(r => {
          if (moduleExamIds.includes(r.examId) && !uniqueStudentsMap.has(r.studentId)) {
            uniqueStudentsMap.set(r.studentId, {
              id: r.studentId,
              displayName: r.studentName,
              groupName: r.groupName,
              registrationNumber: '' // We don't have it in results
            });
          }
        });
        students = Array.from(uniqueStudentsMap.values());
      }

      if (students.length === 0) {
        alert("Aucun étudiant trouvé pour ce module.");
        setIsExporting(false);
        return;
      }

      // 2. Identify Exams (CCs and EFM)
      const moduleExams = exams
        .filter(e => e.moduleId === module.id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      const ccExams = moduleExams.filter(e => e.type !== 'fin-de-module');
      const efmExam = moduleExams.find(e => e.type === 'fin-de-module');

      // 3. Prepare Data Rows
      const rows = students.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '')).map(student => {
        // Handle name splitting (Assumption: LASTNAME Firstname or Firstname LASTNAME)
        // We'll try to split and put them in columns.
        const nameParts = (student.displayName || '').trim().split(/\s+/);
        let nom = student.displayName || '';
        let prenom = '';
        
        if (nameParts.length >= 2) {
          nom = nameParts[0].toUpperCase();
          prenom = nameParts.slice(1).join(' ');
        }

        const row: any = {
          'CEF': student.registrationNumber || '-',
          'Nom': nom,
          'Prénom': prenom,
        };

        // Add CC columns
        ccExams.forEach((exam, idx) => {
          const result = results.find(r => r.examId === exam.id && r.studentId === student.id);
          row[`CC${idx + 1}`] = result ? result.score : '-';
        });

        // Add EFM column
        if (efmExam) {
          const result = results.find(r => r.examId === efmExam.id && r.studentId === student.id);
          row['Fin de module'] = result ? result.score : '-';
        }

        return row;
      });

      // 4. Create Workbook and Download
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Notes");

      // Auto-size columns
      const colWidths = Object.keys(rows[0] || {}).map(key => {
        const headerLen = key.length;
        const maxContentLen = rows.reduce((max, row) => Math.max(max, String(row[key]).length), 0);
        return { wch: Math.max(headerLen, maxContentLen) + 2 };
      });
      worksheet['!cols'] = colWidths;

      XLSX.writeFile(workbook, `Notes_${module.code}_${module.name.replace(/\s+/g, '_')}.xlsx`);

    } catch (err) {
      console.error("Excel Export Error:", err);
      alert("Une erreur est survenue lors de l'exportation vers Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  const stats = useMemo(() => {
    return [
      { label: 'Modules', value: modules.length, icon: BookOpen, color: 'indigo' },
      { label: 'Examens', value: exams.length, icon: ClipboardList, color: 'amber' },
      { label: 'Étudiants', value: studentCount, icon: Users, color: 'emerald' },
      { label: 'Résultats', value: results.length, icon: History, color: 'violet' },
    ];
  }, [modules, exams, studentCount, results]);

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

  const handleDeleteModule = async (id: number) => {
    if (!confirm("Voulez-vous vraiment supprimer ce module ?")) return;
    try {
      await api.modules.delete(id);
      onRefresh();
    } catch (error) {
      console.error("Error deleting module:", error);
    }
  };

  const [deletingExamId, setDeletingExamId] = React.useState<number | null>(null);

  const handleDeleteExam = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (deletingExamId !== id) {
      setDeletingExamId(id);
      // Auto-reset after 3 seconds if not confirmed
      setTimeout(() => {
        setDeletingExamId(currentId => currentId === id ? null : currentId);
      }, 3000);
      return;
    }
    
    try {
      await api.exams.delete(id);
      setDeletingExamId(null);
      window.alert("Examen supprimé avec succès !");
      onRefresh();
    } catch (error: any) {
      console.error("Error deleting exam:", error);
      window.alert(error.message || "Erreur lors de la suppression de l'examen");
      setDeletingExamId(null);
    }
  };

  const [togglingExamId, setTogglingExamId] = useState<number | null>(null);
  const [duplicatingExamId, setDuplicatingExamId] = useState<number | null>(null);

  const handleDuplicateExam = async (exam: Exam) => {
    try {
      setDuplicatingExamId(exam.id);
      await api.exams.create({
        ...exam,
        title: `${exam.title} (Copie)`,
        status: 'draft',
        // Preserve other properties
        questions: exam.questions.map(q => ({
          ...q,
          id: Math.random().toString(36).substr(2, 9)
        }))
      });
      alert("Examen dupliqué avec succès !");
      onRefresh();
    } catch (error: any) {
      console.error("Error duplicating exam:", error);
      alert(`Erreur: ${error.message || "Impossible de dupliquer l'examen"}`);
    } finally {
      setDuplicatingExamId(null);
    }
  };

  const toggleExamStatus = async (exam: Exam) => {
    try {
      setTogglingExamId(exam.id);
      if (exam.status === 'active') {
        await api.exams.unpublish(exam.id);
        alert("Examen désactivé !");
      } else {
        setActivatingExam(exam);
        return; // handleActivateExam will handle the rest
      }
      onRefresh();
    } catch (error: any) {
      console.error("Error toggling exam status:", error);
      alert(`Erreur: ${error.message || "Action impossible"}`);
    } finally {
      setTogglingExamId(null);
    }
  };

  const handleActivateExam = async (groupId: number) => {
    if (!activatingExam) return;
    try {
      setTogglingExamId(activatingExam.id);
      await api.exams.publish(activatingExam.id, groupId);
      alert("Examen activé avec succès.");
      setActivatingExam(null);
      onRefresh();
    } catch (error: any) {
      console.error("Error activating exam:", error);
      alert(`Erreur: ${error.message || "Erreur lors de l'activation"}`);
    } finally {
      setTogglingExamId(null);
    }
  };

  const navGroups = [
    {
      title: 'Pilotage',
      items: [
        { id: 'overview', label: 'Vue d\'ensemble', icon: LayoutDashboard },
        { id: 'ai', label: 'Assistant IA', icon: Sparkles },
      ]
    },
    {
      title: 'Académique',
      items: [
        { id: 'modules', label: 'Modules', icon: BookOpen },
        { id: 'exams', label: 'Examens', icon: ClipboardList },
        { id: 'filieres', label: 'Filières', icon: Database },
      ]
    },
    {
      title: 'Suivi & Étudiants',
      items: [
        { id: 'results', label: 'Suivi & Analyse', icon: TrendingUp },
        { id: 'groups', label: 'Groupes', icon: Users },
      ]
    },
    {
      title: 'Administration',
      items: [
        { id: 'users', label: 'Utilisateurs', icon: Users },
        { id: 'audit', label: 'Audit / Logs', icon: History },
        { id: 'system', label: 'Système', icon: LayoutDashboard },
        { id: 'settings', label: 'Paramètres', icon: Settings },
      ]
    }
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-10">
      {/* Sidebar Navigation - Hidden on mobile, shown on lg screens */}
      <aside className="hidden lg:block lg:w-72 shrink-0">
        <div className="sticky top-10 space-y-10">
          <div className="space-y-8">
            {navGroups.map((group, groupIdx) => (
              <div key={group.title} className="px-2">
                <h3 className="text-[9px] font-black text-slate-300 uppercase tracking-[0.25em] mb-4 ml-4">{group.title}</h3>
                <nav className="space-y-1.5">
                  {group.items.map((item, idx) => (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ 
                        delay: (groupIdx * 10 + idx) * 0.03,
                        type: "spring",
                        stiffness: 260,
                        damping: 20 
                      }}
                      whileHover={{ x: 8 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setActiveTab(item.id as any)}
                      className={cn(
                        "w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold transition-all relative group",
                        activeTab === item.id 
                          ? "bg-indigo-600 text-white shadow-xl shadow-indigo-200" 
                          : "text-slate-500 hover:bg-slate-50 hover:text-indigo-600"
                      )}
                    >
                      <item.icon className={cn("w-5 h-5 transition-transform duration-500 group-hover:rotate-12", activeTab === item.id ? "text-white" : "text-slate-400 group-hover:text-indigo-600")} />
                      <span className="truncate">{item.label}</span>
                      {activeTab === item.id && (
                        <motion.div 
                          layoutId="active-tab" 
                          className="absolute left-[-1.5rem] w-1.5 h-6 bg-indigo-600 rounded-r-full"
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      )}
                    </motion.button>
                  ))}
                </nav>
              </div>
            ))}
          </div>
          
          {/* User Profile Card */}
          <div className="p-6 bg-slate-900 rounded-[2.5rem] text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-indigo-500/20 transition-all duration-700" />
            <div className="relative z-10 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center text-xl font-black">
                {user?.displayName ? user.displayName[0] : 'T'}
              </div>
              <div>
                <p className="text-xs font-black text-indigo-300 uppercase tracking-widest mb-1">Enseignant</p>
                <p className="font-bold truncate">{user?.displayName || 'Enseignant'}</p>
              </div>
              <Button size="sm" className="w-full bg-white/10 hover:bg-white/20 text-white border-none py-4 text-xs font-black" onClick={() => api.auth.logout().then(() => window.location.reload())}>
                Déconnexion
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'overview' && (
              <StatisticsTab
                user={user}
                modules={modules}
                exams={exams}
                results={results}
                studentCount={studentCount}
                toggleExamStatus={toggleExamStatus}
                togglingExamId={togglingExamId}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === 'modules' && (
              <ModulesTab
                modules={modules}
                exams={exams}
                results={results}
                filieres={filieres}
                orgSettings={orgSettings}
                isExportingPV={isExportingPV}
                setIsAddingModule={setIsAddingModule}
                setEditingModule={setEditingModule}
                handleExportModuleExcel={handleExportModuleExcel}
                handleDeleteModule={handleDeleteModule}
                handleExportPV={handleExportPV}
              />
            )}

            {activeTab === 'exams' && (
              <ExamsTab
                exams={exams}
                modules={modules}
                results={results}
                setIsAddingExam={setIsAddingExam}
                setEditingExam={setEditingExam}
                setPreviewExam={setPreviewExam}
                setSupervisingExam={setSupervisingExam}
                setPerformanceExam={setPerformanceExam}
                toggleExamStatus={toggleExamStatus}
                togglingExamId={togglingExamId}
                handleDuplicateExam={handleDuplicateExam}
                duplicatingExamId={duplicatingExamId}
                handleDeleteExam={handleDeleteExam}
                deletingExamId={deletingExamId}
                handleExportPDF={handleExportPDF}
                handleExportWord={handleExportWord}
                handleExportResultsPDF={handleExportResultsPDF}
              />
            )}

            {activeTab === 'results' && (
              <div className="space-y-8">
                {/* Visual subtab switcher for Suivi & Analyse */}
                <div className="flex bg-slate-100/80 p-1 rounded-2xl max-w-md shadow-inner border border-slate-200/20">
                  <button
                    onClick={() => setResultsMainMode('suivi')}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer",
                      resultsMainMode === 'suivi'
                        ? "bg-white text-indigo-600 shadow-md"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    <TrendingUp className="w-4 h-4 text-indigo-600" /> Suivi & Analyses IA
                  </button>
                  <button
                    onClick={() => setResultsMainMode('registry')}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer",
                      resultsMainMode === 'registry'
                        ? "bg-white text-indigo-600 shadow-md"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    <History className="w-4 h-4 text-indigo-600" /> Registre des Copies
                  </button>
                </div>

                {resultsMainMode === 'suivi' ? (
                  <SuiviAnalyseView
                    modules={modules}
                    exams={exams}
                    results={results}
                    groups={groups}
                    onRefresh={onRefresh}
                  />
                ) : (
                  <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div>
                        <h2 className="text-3xl font-black text-slate-900 font-serif italic tracking-tight">Gestion des Résultats</h2>
                        <p className="text-slate-500 mt-1">Consultez et exportez les performances de tous vos étudiants.</p>
                      </div>
                    </div>

                    {statsCards}

                <div className="flex items-center gap-3">
                  <div className="relative hidden md:block">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        type="text" 
                        placeholder="Rechercher un étudiant..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-48 pl-9 pr-4 py-2.5 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all outline-none"
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        const csvData = results.map(r => ({
                          'Étudiant': r.studentName,
                          'Examen': exams.find(e => e.id === r.examId)?.title,
                          'Score': r.score,
                          'Total': r.totalPoints,
                          'Pourcentage': ((r.score / (r.totalPoints || 1)) * 100).toFixed(2) + '%',
                          'Date': new Date(r.completedAt).toLocaleString()
                        }));
                        const csvString = Papa.unparse(csvData);
                        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
                        saveAs(blob, `Resultats_Complets_${new Date().toISOString().slice(0,10)}.csv`);
                      }}
                      className="h-10 px-4 gap-2 text-[10px] font-black uppercase tracking-widest hidden sm:flex border-2 border-slate-100 hover:border-indigo-100 rounded-xl transition-all"
                    >
                      <FileDown className="w-4 h-4" /> CSV
                    </Button>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button 
                        onClick={() => { setResultsViewMode('by-exam'); setSelectedExamId(null); }}
                        className={cn(
                          "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                          resultsViewMode === 'by-exam' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        Par Examen
                      </button>
                      <button 
                        onClick={() => setResultsViewMode('all-results')}
                        className={cn(
                          "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                          resultsViewMode === 'all-results' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        Tous les résultats
                      </button>
                    </div>
                  </div>

                {resultsViewMode === 'by-exam' && !selectedExamId ? (
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {exams.filter(e => results.some(r => r.examId === e.id)).map(exam => {
                       const examResults = results.filter(r => r.examId === exam.id);
                       const avgScore = examResults.length > 0 
                         ? Math.round(examResults.reduce((acc, r) => acc + (r.score / (r.totalPoints || 1)), 0) / examResults.length * 100) 
                         : 0;
                       const module = modules.find(m => m.id === exam.moduleId);
                       return (
                         <Card key={exam.id} className="p-6 cursor-pointer hover:border-indigo-200 hover:shadow-xl transition-all group" onClick={() => setSelectedExamId(exam.id)}>
                            <div className="flex justify-between items-start mb-4">
                              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                                <ClipboardList className="w-6 h-6" />
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Moyenne</p>
                                <p className="text-xl font-black text-indigo-600">{avgScore}%</p>
                              </div>
                            </div>
                            <h4 className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight mb-1">{exam.title}</h4>
                            <p className="text-[10px] font-bold text-slate-400 mb-4">{module?.name}</p>
                            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{examResults.length} copies</span>
                              <Button variant="ghost" size="sm" className="text-indigo-600 h-8 px-3 text-[10px] uppercase font-black">Voir détails</Button>
                            </div>
                         </Card>
                       );
                     })}
                     {exams.filter(e => results.some(r => r.examId === e.id)).length === 0 && (
                       <div className="col-span-full py-20 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                          <History className="w-12 h-12 mb-4 opacity-20" />
                          <p className="font-bold">Aucun résultat d'examen pour le moment.</p>
                       </div>
                     )}
                   </div>
                ) : (
                  <div className="space-y-6">
                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-2 px-3 border-r border-slate-100">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filtres</span>
                      </div>
                      
                      <div className="flex-1 min-w-[200px] relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <input 
                          type="text" 
                          placeholder="Chercher un étudiant..." 
                          value={searchQuery}
                          onChange={(e) => { setSearchQuery(e.target.value); setResultsPage(1); }}
                          className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        />
                      </div>

                      <select 
                        value={resultsFilterModule}
                        onChange={(e) => { setResultsFilterModule(e.target.value); setResultsPage(1); }}
                        className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                      >
                        <option value="all">Tous les modules</option>
                        {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>

                      <select 
                        value={resultsFilterGroup}
                        onChange={(e) => { setResultsFilterGroup(e.target.value); setResultsPage(1); }}
                        className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                      >
                        <option value="all">Tous les groupes</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>

                      <select 
                        value={resultsFilterScore}
                        onChange={(e) => { setResultsFilterScore(e.target.value); setResultsPage(1); }}
                        className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                      >
                        <option value="all">Toutes les performances</option>
                        <option value="excellent">Excellents (≥ 80%)</option>
                        <option value="average">Moyens (50% - 79%)</option>
                        <option value="fail">En difficulté (&lt; 50%)</option>
                      </select>

                      {selectedExamId && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setSelectedExamId(null)}
                          className="text-[10px] font-black uppercase tracking-widest border-indigo-100 text-indigo-600 hover:bg-indigo-50"
                        >
                          Retour à la liste
                        </Button>
                      )}
                    </div>

                    {selectedExamId && (
                      <div className="flex bg-slate-100/60 p-1.5 rounded-2xl max-w-sm border border-slate-200/40 shadow-sm mb-6">
                        <button
                          onClick={() => setSelectedExamSubTab('copies')}
                          className={cn(
                            "flex-1 py-1.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5",
                            selectedExamSubTab === 'copies'
                              ? "bg-white text-indigo-600 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          )}
                        >
                          <History className="w-3.5 h-3.5" /> Copies ({filteredResultsStats.total})
                        </button>
                        <button
                          onClick={() => setSelectedExamSubTab('questions')}
                          className={cn(
                            "flex-1 py-1.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5",
                            selectedExamSubTab === 'questions'
                              ? "bg-white text-indigo-600 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          )}
                        >
                          <Target className="w-3.5 h-3.5" /> Analyse Questions
                        </button>
                      </div>
                    )}

                    {(!selectedExamId || selectedExamSubTab === 'copies') ? (
                      <>
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                      {/* Left: Metric analysis cards */}
                      <div className="lg:col-span-5 grid grid-cols-2 gap-4">
                        <Card className="p-5 bg-indigo-50/40 border border-indigo-100/30 flex flex-col justify-between">
                          <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Copies Filtrées</p>
                          <div className="mt-4">
                            <h4 className="text-2xl font-black text-indigo-900 tracking-tight">{filteredResultsStats.total} <span className="text-indigo-400 text-xs font-normal">/ {results.length}</span></h4>
                            <p className="text-[9px] font-bold text-indigo-400 mt-1">Copies dans le filtre</p>
                          </div>
                        </Card>

                        <Card className="p-5 bg-emerald-50/40 border border-emerald-100/30 flex flex-col justify-between">
                          <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Taux de Réussite</p>
                          <div className="mt-4">
                            <h4 className="text-2xl font-black text-emerald-900 tracking-tight">{filteredResultsStats.successPercent}%</h4>
                            <div className="w-full bg-emerald-100/55 h-1 rounded-full overflow-hidden mt-2">
                              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${filteredResultsStats.successPercent}%` }} />
                            </div>
                          </div>
                        </Card>

                        <Card className="p-5 bg-amber-50/40 border border-amber-100/30 flex flex-col justify-between">
                          <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Moyenne Filtrée</p>
                          <div className="mt-4">
                            <h4 className="text-2xl font-black text-amber-900 tracking-tight">{filteredResultsStats.avgScore}%</h4>
                            <p className="text-[9px] font-bold text-amber-500 mt-1">Note médiane : <span className="font-extrabold">{filteredResultsStats.medianScore}%</span></p>
                          </div>
                        </Card>

                        <Card className="p-5 bg-slate-50/50 border border-slate-200/40 flex flex-col justify-between">
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Val. Extrêmes (Min ↔ Max)</p>
                          <div className="mt-4">
                            <h4 className="text-xl font-black text-slate-800 tracking-tight">
                              {filteredResultsStats.minScore}% <span className="text-slate-400 font-bold mx-0.5">↔</span> {filteredResultsStats.maxScore}%
                            </h4>
                            <p className="text-[9px] font-bold text-slate-400 mt-1">Écart de niveau constaté</p>
                          </div>
                        </Card>
                      </div>

                      {/* Right: Score distribution visualizer */}
                      <Card className="lg:col-span-7 p-6 border-2 border-slate-100 flex flex-col justify-between shadow-sm">
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                              <BarChart className="w-4 h-4 text-indigo-500 hover:rotate-12 transition-transform" /> Distribution des Performances
                            </h4>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Histogramme</span>
                          </div>

                          <div className="space-y-3.5">
                            {/* Excellent */}
                            <div>
                              <div className="flex justify-between text-[10px] font-bold text-slate-600 mb-1">
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-md bg-emerald-500 block" /> Excellent (≥ 80%)</span>
                                <span className="font-mono text-slate-500">{filteredResultsStats.distribution.excellent} copies ({filteredResultsStats.total > 0 ? Math.round(filteredResultsStats.distribution.excellent / filteredResultsStats.total * 100) : 0}%)</span>
                              </div>
                              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${filteredResultsStats.total > 0 ? (filteredResultsStats.distribution.excellent / filteredResultsStats.total * 100) : 0}%` }} />
                              </div>
                            </div>

                            {/* Good */}
                            <div>
                              <div className="flex justify-between text-[10px] font-bold text-slate-600 mb-1">
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-md bg-indigo-500 block" /> Bien / Satisfaisant (60% - 79%)</span>
                                <span className="font-mono text-slate-500">{filteredResultsStats.distribution.good} copies ({filteredResultsStats.total > 0 ? Math.round(filteredResultsStats.distribution.good / filteredResultsStats.total * 100) : 0}%)</span>
                              </div>
                              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div className="bg-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${filteredResultsStats.total > 0 ? (filteredResultsStats.distribution.good / filteredResultsStats.total * 100) : 0}%` }} />
                              </div>
                            </div>

                            {/* Pass */}
                            <div>
                              <div className="flex justify-between text-[10px] font-bold text-slate-600 mb-1">
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-md bg-amber-500 block" /> Passable (50% - 59%)</span>
                                <span className="font-mono text-slate-500">{filteredResultsStats.distribution.pass} copies ({filteredResultsStats.total > 0 ? Math.round(filteredResultsStats.distribution.pass / filteredResultsStats.total * 100) : 0}%)</span>
                              </div>
                              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${filteredResultsStats.total > 0 ? (filteredResultsStats.distribution.pass / filteredResultsStats.total * 100) : 0}%` }} />
                              </div>
                            </div>

                            {/* Fail */}
                            <div>
                              <div className="flex justify-between text-[10px] font-bold text-slate-600 mb-1">
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-md bg-rose-500 block" /> En difficulté (&lt; 50%)</span>
                                <span className="font-mono text-slate-500">{filteredResultsStats.distribution.fail} copies ({filteredResultsStats.total > 0 ? Math.round(filteredResultsStats.distribution.fail / filteredResultsStats.total * 100) : 0}%)</span>
                              </div>
                              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: `${filteredResultsStats.total > 0 ? (filteredResultsStats.distribution.fail / filteredResultsStats.total * 100) : 0}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>

                    <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-soft overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-slate-50/50 border-b-2 border-slate-100 font-display">
                              <th 
                                onClick={() => handleSort('name')}
                                className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer select-none hover:text-indigo-600 transition-colors group"
                              >
                                Étudiant 
                                <SortIcon field="name" />
                              </th>
                              <th 
                                onClick={() => handleSort('date')}
                                className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer select-none hover:text-indigo-600 transition-colors group"
                              >
                                Examen & Module
                                <SortIcon field="date" />
                              </th>
                              <th 
                                onClick={() => handleSort('score')}
                                className="px-8 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer select-none hover:text-indigo-600 transition-colors group"
                              >
                                Score %
                                <SortIcon field="score" />
                              </th>
                              <th 
                                onClick={() => handleSort('score')}
                                className="px-8 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer select-none hover:text-indigo-600 transition-colors group"
                              >
                                Note brute
                                <SortIcon field="score" />
                              </th>
                              <th className="px-8 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Intégrité</th>
                              <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Détails</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y-2 divide-slate-50">
                            {(() => {
                              const currentResults = sortedAndPaginatedResults.paginated;
                              const totalPages = sortedAndPaginatedResults.totalPages;

                              if (currentResults.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={5} className="px-8 py-10 text-center text-slate-400 font-bold">Aucun résultat trouvé avec ces filtres.</td>
                                  </tr>
                                );
                              }

                              return (
                                <>
                                  {currentResults.map(result => {
                                    const exam = exams.find(e => e.id === result.examId);
                                    const module = modules.find(m => m.id === exam?.moduleId);
                                    const percentVal = (result.score / (result.totalPoints || 1)) * 100;
                                    const percent = formatPercent(percentVal);
                                    return (
                                      <tr key={result.id} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-5">
                                          <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-black">
                                              {result.studentName?.[0]}
                                            </div>
                                            <div>
                                              <p className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight text-xs flex items-center gap-1.5">
                                                {result.studentName}
                                                {percentVal === filteredResultsStats.maxScore && (
                                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-[8px] font-black uppercase rounded-md tracking-wider">
                                                    <Trophy className="w-2.5 h-2.5 text-amber-500 fill-amber-300" /> Major
                                                  </span>
                                                )}
                                              </p>
                                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{result.groupName}</p>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="px-8 py-5">
                                          <div>
                                            <p className="font-bold text-slate-700 text-xs">{exam?.title}</p>
                                            <p className="text-[9px] text-slate-400 font-medium">{module?.name}</p>
                                          </div>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                          <div className="flex flex-col items-center gap-1.5">
                                            <span className={cn(
                                              "text-sm font-black",
                                              percentVal >= 80 ? "text-emerald-500" : percentVal >= 50 ? "text-slate-800" : "text-rose-500"
                                            )}>
                                              {percent}%
                                            </span>
                                            <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                                              <div className={cn("h-full", percentVal >= 50 ? "bg-emerald-500" : "bg-rose-500")} style={{ width: `${percentVal}%` }} />
                                            </div>
                                          </div>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                          <span className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg text-xs font-black text-slate-600">
                                            {formatScore(result.score)} <span className="text-slate-300">/ {result.totalPoints}</span>
                                          </span>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                          {(() => {
                                            const integrity = result.integrityScore !== undefined ? result.integrityScore : 100;
                                            return (
                                              <span className={cn(
                                                "px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg border",
                                                integrity >= 90
                                                  ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                                                  : integrity >= 70
                                                    ? "bg-amber-50 border-amber-100 text-amber-600"
                                                    : "bg-rose-50 border-rose-100 text-rose-600"
                                              )}>
                                                {integrity}%
                                              </span>
                                            );
                                          })()}
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                          {exam && (
                                            <Button 
                                              variant="ghost" 
                                              size="sm" 
                                              onClick={() => setViewingResult(result)}
                                              className="text-indigo-600 hover:bg-indigo-50 gap-2 font-black text-[10px] uppercase tracking-widest"
                                            >
                                              <Eye className="w-4 h-4" /> Détails
                                            </Button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                  {totalPages > 1 && (
                                    <tr>
                                      <td colSpan={5} className="px-8 py-4 bg-slate-50/30">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Page {resultsPage} sur {totalPages}
                                          </span>
                                          <div className="flex gap-2">
                                            <Button 
                                              variant="outline" 
                                              size="sm" 
                                              disabled={resultsPage === 1}
                                              onClick={() => setResultsPage(prev => Math.max(1, prev - 1))}
                                              className="h-8 px-3 text-[10px] font-black uppercase tracking-widest"
                                            >
                                              Précédent
                                            </Button>
                                            <Button 
                                              variant="outline" 
                                              size="sm" 
                                              disabled={resultsPage === totalPages}
                                              onClick={() => setResultsPage(prev => Math.min(totalPages, prev + 1))}
                                              className="h-8 px-3 text-[10px] font-black uppercase tracking-widest"
                                            >
                                              Suivant
                                            </Button>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </>
                              );
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    </>
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0, y: 15 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        transition={{ duration: 0.35 }}
                        className="space-y-8"
                      >
                        {(() => {
                          const easiestQIdx = questionStats.length > 0 
                            ? [...questionStats].sort((a,b) => b.avgScorePct - a.avgScorePct)[0]?.index 
                            : null;
                          const hardestQIdx = questionStats.length > 0 
                            ? [...questionStats].sort((a,b) => a.avgScorePct - b.avgScorePct)[0]?.index 
                            : null;
                          const avgConceptPct = questionStats.length > 0 
                            ? Math.round(questionStats.reduce((acc, q) => acc + q.avgScorePct, 0) / questionStats.length) 
                            : 0;

                          const criticalQs = questionStats.filter(q => q.avgScorePct < 55);

                          if (questionStats.length === 0) {
                            return (
                              <div className="p-12 text-center text-slate-400 font-bold bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                                <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p>Aucune donnée analytique disponible pour cet examen.</p>
                              </div>
                            );
                          }

                          return (
                            <>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Card className="p-6 bg-emerald-50/40 border border-emerald-100/30 flex flex-col justify-between">
                                  <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Question la plus simple</p>
                                  <div className="mt-4 border-t border-emerald-100/20 pt-4">
                                    <h4 className="text-2xl font-black text-emerald-950">
                                      {easiestQIdx !== null ? `Question ${easiestQIdx + 1}` : 'N/A'}
                                    </h4>
                                    <p className="text-[10px] font-bold text-emerald-600 mt-2">
                                      {easiestQIdx !== null ? `${questionStats[easiestQIdx].avgScorePct}% d'assimilation` : ''}
                                    </p>
                                  </div>
                                </Card>

                                <Card className="p-6 bg-rose-50/40 border border-rose-100/30 flex flex-col justify-between">
                                  <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Question la plus difficile</p>
                                  <div className="mt-4 border-t border-rose-100/20 pt-4">
                                    <h4 className="text-2xl font-black text-rose-950">
                                      {hardestQIdx !== null ? `Question ${hardestQIdx + 1}` : 'N/A'}
                                    </h4>
                                    <p className="text-[10px] font-bold text-rose-600 mt-2">
                                      {hardestQIdx !== null ? `${questionStats[hardestQIdx].avgScorePct}% d'assimilation` : ''}
                                    </p>
                                  </div>
                                </Card>

                                <Card className="p-6 bg-slate-50/50 border border-slate-200/40 flex flex-col justify-between">
                                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Réussite Globale</p>
                                  <div className="mt-4 border-t border-slate-200/20 pt-4">
                                    <h4 className="text-2xl font-black text-slate-800 font-sans tracking-tight">
                                      {avgConceptPct}%
                                    </h4>
                                    <p className="text-[10px] font-bold text-slate-400 mt-2">Moyenne de maîtrise des concepts</p>
                                  </div>
                                </Card>
                              </div>

                              {criticalQs.length > 0 && (
                                <Card className="p-6 bg-amber-50/60 border-2 border-amber-200/55 rounded-[2rem] flex items-start gap-4">
                                  <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl shrink-0">
                                    <AlertTriangle className="w-5 h-5" />
                                  </div>
                                  <div className="space-y-1">
                                    <h5 className="font-black text-amber-900 text-xs uppercase tracking-wider">Alerte d'assimilation ({criticalQs.length} question(s) critique(s))</h5>
                                    <p className="text-xs text-amber-700 font-bold leading-relaxed">
                                      Certains concepts font l'objet de difficultés récurrentes (taux de réussite &lt; 55%). Nous vous recommandons de revoir les questions : {criticalQs.map(q => `Q${q.index + 1}`).join(', ')}.
                                    </p>
                                  </div>
                                </Card>
                              )}

                              <div className="space-y-4">
                                <div className="flex items-center justify-between px-2">
                                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Diagnostic par Question</h4>
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Taux de validation</span>
                                </div>

                                {questionStats.map((stat, sIdx) => {
                                  const isExpanded = expandedQuestionIdx === sIdx;
                                  return (
                                    <Card key={sIdx} className="p-6 border-2 border-slate-100 hover:border-slate-200/60 transition-all rounded-[2rem]">
                                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="space-y-2 flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-black px-2.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg uppercase tracking-wider">
                                              Q{stat.index + 1}
                                            </span>
                                            <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 text-slate-500 rounded uppercase tracking-wider">
                                              {stat.type}
                                            </span>
                                            <span className="text-[9px] font-bold text-slate-400">
                                              {stat.points} PTS
                                            </span>
                                          </div>
                                          <div 
                                            className="font-bold text-slate-800 leading-relaxed text-xs line-clamp-1" 
                                            dangerouslySetInnerHTML={{ __html: stat.questionText }} 
                                          />
                                        </div>

                                        <div className="flex items-center gap-6 shrink-0">
                                          <div className="space-y-1 text-right">
                                            <p className="text-xs font-black text-slate-900">{stat.avgScorePct}% réussite</p>
                                            <p className="text-[9px] font-bold text-slate-400 font-mono">
                                              {stat.correctCount} / {stat.correctCount + stat.partialCount + stat.incorrectCount} correct
                                            </p>
                                          </div>

                                          <div className="w-24 h-3 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                                            {stat.successPercent > 0 && (
                                              <div 
                                                className="bg-emerald-500 h-full" 
                                                style={{ width: `${stat.successPercent}%` }} 
                                                title={`Favorable: ${stat.successPercent}%`}
                                              />
                                            )}
                                            {stat.partialPercent > 0 && (
                                              <div 
                                                className="bg-amber-500 h-full" 
                                                style={{ width: `${stat.partialPercent}%` }} 
                                                title={`Partiel: ${stat.partialPercent}%`}
                                              />
                                            )}
                                            {stat.incorrectPercent > 0 && (
                                              <div 
                                                className="bg-rose-500 h-full" 
                                                style={{ width: `${stat.incorrectPercent}%` }} 
                                                title={`Incorrect: ${stat.incorrectPercent}%`}
                                              />
                                            )}
                                          </div>

                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setExpandedQuestionIdx(isExpanded ? null : sIdx)}
                                            className="text-[9px] font-black uppercase text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 h-8 px-3 rounded-xl border border-transparent hover:border-indigo-100/30"
                                          >
                                            {isExpanded ? 'Masquer' : 'Détails'}
                                          </Button>
                                        </div>
                                      </div>

                                      {isExpanded && (
                                        <div className="mt-5 pt-5 border-t border-slate-100 space-y-4">
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Contenu de la question</p>
                                              <div 
                                                className="p-4 bg-slate-50/50 rounded-2xl text-xs font-bold text-slate-700 leading-relaxed border border-slate-100" 
                                                dangerouslySetInnerHTML={{ __html: stat.questionText }} 
                                              />
                                            </div>

                                            <div className="space-y-2">
                                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Diagnostic d'assimilation</p>
                                              <div className="p-4 bg-indigo-50/20 border border-indigo-100/40 rounded-2xl text-xs text-indigo-900 leading-relaxed space-y-3">
                                                <div className="flex justify-between items-center pb-2 border-b border-indigo-100/20">
                                                  <span className="font-bold flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-emerald-500" /> Parfait (100% des points)</span>
                                                  <span className="font-mono font-black text-emerald-600">{stat.correctCount} élève(s)</span>
                                                </div>
                                                {stat.partialPercent > 0 && (
                                                  <div className="flex justify-between items-center pb-2 border-b border-indigo-100/20">
                                                    <span className="font-bold flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-amber-500" /> Partiel (Points partiels)</span>
                                                    <span className="font-mono font-black text-amber-600">{stat.partialCount} élève(s)</span>
                                                  </div>
                                                )}
                                                <div className="flex justify-between items-center">
                                                  <span className="font-bold flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-rose-500" /> Échec (0 point)</span>
                                                  <span className="font-mono font-black text-rose-600">{stat.incorrectCount} élève(s)</span>
                                                </div>
                                              </div>
                                            </div>
                                          </div>

                                          {stat.strugglingStudents.length > 0 ? (
                                            <div className="space-y-2.5">
                                              <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Étudiants à accompagner pour ce concept ({stat.strugglingStudents.length})</p>
                                              <div className="flex flex-wrap gap-2">
                                                {stat.strugglingStudents.map((stud, sNewIdx) => (
                                                  <div key={sNewIdx} className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50/50 border border-amber-200/50 rounded-xl" title={stud.email}>
                                                    <div className="w-5 h-5 rounded-md bg-amber-100 text-[9px] font-black text-amber-700 flex items-center justify-center">
                                                      {stud.name[0]}
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-700">{stud.name}</span>
                                                    <span className="text-[8px] font-black uppercase text-amber-600 bg-amber-100/40 px-1.5 rounded">{stud.group}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-100/35">
                                              🎉 Aucun élève n'est resté en situation de blocage total sur cette question !
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </Card>
                                  );
                                })}
                              </div>
                            </>
                          );
                        })()}
                      </motion.div>
                    )}
                  </div>
                )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 font-serif italic tracking-tight">Annonces & Notifications</h2>
                    <p className="text-slate-500 mt-1">Communiquez avec vos étudiants ou vos groupes.</p>
                  </div>
                  <Button onClick={() => setIsAddingNotification(true)} className="gap-2 text-xs uppercase tracking-widest font-black py-4 px-6 shadow-xl shadow-indigo-100">
                    <Plus className="w-4 h-4" /> Nouvelle Annonce
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-6">
                  {notifications.length === 0 ? (
                    <EmptyState message="Aucune annonce publiée." />
                  ) : (
                    notifications.map(notif => (
                      <DetailedNotificationCard 
                        key={notif.id} 
                        notification={notif} 
                        user={user} 
                        groups={groups}
                        filieres={filieres}
                        onRefresh={onRefresh} 
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'groups' && (
              <FiliereGroupManagement filieres={filieres} groups={groups} onRefresh={onRefresh} mode="groups" />
            )}

            {activeTab === 'filieres' && (
              <FiliereGroupManagement filieres={filieres} groups={groups} onRefresh={onRefresh} mode="filieres" />
            )}

            {activeTab === 'system' && (
              <DatabaseManagement />
            )}

            {activeTab === 'ai' && (
              <AiAssistantView 
                modules={modules} 
                groups={groups}
                filieres={filieres}
                onRefresh={onRefresh} 
                onSelectTab={setActiveTab} 
              />
            )}

            {activeTab === 'settings' && (
              <OrganizationSettingsView onUpdate={setOrgSettings} />
            )}

            {activeTab === 'users' && (
              <AdminUserManagement />
            )}

            {activeTab === 'audit' && (
              <AuditLogsView />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {(isAddingModule || editingModule) && (
          <Modal title={editingModule ? "Modifier le Module" : "Nouveau Module"} onClose={() => { setIsAddingModule(false); setEditingModule(null); }}>
             <div className="p-5 sm:p-8">
               <AddModuleForm user={user} filieres={filieres} initialData={editingModule} onComplete={() => { setIsAddingModule(false); setEditingModule(null); onRefresh(); }} />
             </div>
          </Modal>
        )}
        {(isAddingExam || editingExam) && (
          <Modal title={editingExam ? "Modifier l'Examen" : "Nouveau Examen"} onClose={() => { setIsAddingExam(false); setEditingExam(null); }} maxWidth="max-w-6xl">
             <div className="p-5 sm:p-8">
               <AddExamForm modules={modules} onComplete={() => { setIsAddingExam(false); setEditingExam(null); onRefresh(); }} user={user} initialData={editingExam} />
             </div>
          </Modal>
        )}
        {previewExam && (
          <ExamPreviewModal 
            exam={previewExam} 
            onClose={() => setPreviewExam(null)} 
            moduleName={modules.find(m => m.id === previewExam.moduleId)?.name} 
          />
        )}
        {supervisingExam && (
          <LiveSupervisionModal 
            exam={supervisingExam} 
            onClose={() => setSupervisingExam(null)} 
            moduleName={modules.find(m => m.id === supervisingExam.moduleId)?.name} 
          />
        )}
        {performanceExam && (
          <ExamPerformanceModal 
            exam={performanceExam} 
            onClose={() => setPerformanceExam(null)} 
            modules={modules}
            filieres={filieres}
            groups={groups}
            settings={orgSettings}
          />
        )}
        {viewingResult && (
          <ResultDetailModal
            result={viewingResult}
            exam={exams.find(e => e.id === viewingResult.examId)!}
            onClose={() => setViewingResult(null)}
          />
        )}
        {activatingExam && (
          <ActivateExamModal
            exam={activatingExam}
            groups={groups}
            onConfirm={handleActivateExam}
            onClose={() => setActivatingExam(null)}
          />
        )}
        {isAddingNotification && (
          <Modal title="Publier une Annonce" onClose={() => setIsAddingNotification(false)}>
             <div className="p-5 sm:p-8">
               <AddNotificationForm user={user} groups={groups} filieres={filieres} onComplete={() => { setIsAddingNotification(false); onRefresh(); }} />
             </div>
          </Modal>
        )}
        {exportConfigModalExam && (
          <ExportModelModal
            exam={exportConfigModalExam}
            templates={orgSettings?.templates || []}
            defaultSettings={orgSettings}
            initialFormat={exportConfigModalFormat}
            initialShowAnswers={exportConfigModalShowAnswers}
            onClose={() => setExportConfigModalExam(null)}
            onExport={executeExport}
          />
        )}
      </AnimatePresence>

      {(isExporting || isExportingResults || isExportingPV) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
            <p className="font-black text-slate-900 uppercase tracking-widest text-xs">Génération du PDF...</p>
          </div>
        </div>
      )}

      {/* Hidden container for PDF generation */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        {exportData && (
          <ExamExportTemplate 
            ref={exportRef}
            exam={exportData.exam}
            module={exportData.module}
            filiereName={exportData.filiereName}
            filiereLevel={exportData.filiereLevel}
            groupName={exportData.groupName}
            showAnswers={exportData.showAnswers}
            paperSaver={exportData.paperSaver}
            qcmDoubleColumn={exportData.qcmDoubleColumn}
            settings={exportData.customSettings || orgSettings}
            teacherName={user.displayName}
          />
        )}

        {resultsExportData && (
          <ResultsExportTemplate 
            ref={resultsExportRef}
            exam={resultsExportData.exam}
            results={resultsExportData.results}
            module={resultsExportData.module}
            filiereName={resultsExportData.filiereName}
            filiereLevel={resultsExportData.filiereLevel}
            groupName={resultsExportData.groupName}
            settings={orgSettings}
          />
        )}

        {pvExportData && (
          <PVExportTemplate 
            ref={pvExportRef}
            exam={pvExportData.exam}
            results={pvExportData.results}
            module={pvExportData.module}
            filiereName={pvExportData.filiereName}
            filiereLevel={pvExportData.filiereLevel}
            groupName={pvExportData.groupName}
            settings={orgSettings}
          />
        )}
      </div>
    </div>
  );
};
