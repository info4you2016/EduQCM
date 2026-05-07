import React, { useState, useMemo } from 'react';
import { 
  Users, BookOpen, ClipboardList, Bell, Plus, Search, Filter, 
  ChevronDown, Edit2, Trash2, LayoutDashboard, Database, Eye, History, CheckCircle2, Star, Clock, BarChart, Target,
  FileDown, Sparkles, FileText, Settings 
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
import { ExamPreviewModal } from '../modals/ExamPreviewModal';
import { FiliereGroupManagement } from './FiliereGroupManagement';
import { AddModuleForm } from '../forms/AddModuleForm';
import { AddNotificationForm } from '../forms/AddNotificationForm';
import { AddExamForm } from '../forms/AddExamForm';
import { ExamPerformanceModal } from '../modals/ExamPerformanceModal';
import { ActivateExamModal } from '../modals/ActivateExamModal';
import { ExamExportTemplate } from '../ExamExportTemplate';
import { ResultsExportTemplate } from '../ResultsExportTemplate';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { exportExamToWord } from '../../lib/docxExport';

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
  const [activeTab, setActiveInternalTab] = useState<'overview' | 'modules' | 'exams' | 'results' | 'notifications' | 'groups' | 'filieres' | 'system' | 'ai' | 'settings'>(
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
  const [resultsPage, setResultsPage] = useState(1);
  const resultsPerPage = 10;
  const [resultsViewMode, setResultsViewMode] = useState<'by-exam' | 'all-results'>('by-exam');
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'createdAt' | 'title'>('createdAt');
  const [previewExam, setPreviewExam] = useState<Exam | null>(null);
  const [performanceExam, setPerformanceExam] = useState<Exam | null>(null);
  const [activatingExam, setActivatingExam] = useState<Exam | null>(null);
  const [orgSettings, setOrgSettings] = useState<OrganizationSettings | null>(null);

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
  const [exportData, setExportData] = useState<{ exam: Exam, module: Module, filiereName: string, filiereLevel?: string, groupName: string, showAnswers: boolean } | null>(null);

  // Results Export states
  const resultsExportRef = React.useRef<HTMLDivElement>(null);
  const [isExportingResults, setIsExportingResults] = useState(false);
  const [resultsExportData, setResultsExportData] = useState<{ exam: Exam, results: Result[], module: Module, filiereName: string, filiereLevel?: string, groupName: string } | null>(null);

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

    setResultsExportData({
      exam,
      results: examResults,
      module,
      filiereName,
      filiereLevel,
      groupName
    });

    setIsExportingResults(true);
    
    setTimeout(async () => {
      if (resultsExportRef.current) {
        try {
          const canvas = await html2canvas(resultsExportRef.current, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: 1200,
            onclone: (doc) => {
              // Remove all style and link tags to prevent html2canvas from parsing oklch colors
              const styles = doc.querySelectorAll('style, link[rel="stylesheet"]');
              styles.forEach(s => s.remove());
              
              // Force clean styles on the container itself
              const el = doc.getElementById('results-export-container');
              if (el) {
                el.style.fontFamily = "'Times New Roman', Times, serif";
                el.style.backgroundColor = '#ffffff';
                el.style.color = '#000000';
              }
            }
          });
          
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          
          const imgProps = pdf.getImageProperties(imgData);
          const totalImgHeight = (imgProps.height * pdfWidth) / imgProps.width;
          
          let heightLeft = totalImgHeight;
          let position = 0;
          const totalPages = Math.ceil(totalImgHeight / pdfHeight);
          let currentPage = 1;

          pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, totalImgHeight, undefined, 'FAST');
          
          // Add page number
          pdf.setFontSize(8);
          pdf.setTextColor(100);
          pdf.text(`Page ${currentPage} / ${totalPages}`, pdfWidth / 2, pdfHeight - 7, { align: 'center' });
          
          heightLeft -= pdfHeight;

          while (heightLeft > 0) {
            position = heightLeft - totalImgHeight;
            pdf.addPage();
            currentPage++;
            pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, totalImgHeight, undefined, 'FAST');
            
            // Add page number
            pdf.setFontSize(8);
            pdf.setTextColor(100);
            pdf.text(`Page ${currentPage} / ${totalPages}`, pdfWidth / 2, pdfHeight - 7, { align: 'center' });
            
            heightLeft -= pdfHeight;
          }

          pdf.save(`Resultats_${exam.title.replace(/\s+/g, '_')}.pdf`);
        } catch (err) {
          console.error("Results PDF Export failed:", err);
          alert("Erreur lors de l'exportation des résultats.");
        } finally {
          setIsExportingResults(false);
          setResultsExportData(null);
        }
      }
    }, 400);
  };

  const handleExportPDF = async (exam: Exam, showAnswers = false) => {
    const module = modules.find(m => m.id === exam.moduleId);
    if (!module) return;

    const groupId = exam.groupId || groups.find(g => g.name === exam.groupName)?.id;
    const group = groups.find(g => g.id === groupId);
    const filiere = filieres.find(f => f.id === group?.filiereId || module.filiereId);

    const groupName = group?.name || exam.groupName || '';
    const filiereName = filiere ? `[${filiere.code}] ${filiere.name}` : 'N/A';
    const filiereLevel = filiere?.niveau || '';

    setExportData({
      exam,
      module,
      filiereName,
      filiereLevel,
      groupName,
      showAnswers
    });

    setIsExporting(true);
    
    // Tiny delay to ensure React renders the hidden template
    setTimeout(async () => {
      if (exportRef.current) {
        try {
          const canvas = await html2canvas(exportRef.current, {
            scale: 3, // Higher scale for crisp text
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: 1200,
            onclone: (doc) => {
              // Remove all style and link tags to prevent html2canvas from parsing oklch colors
              const styles = doc.querySelectorAll('style, link[rel="stylesheet"]');
              styles.forEach(s => s.remove());
              
              // Force clean styles on the container itself
              const el = doc.getElementById('export-container');
              if (el) {
                el.style.fontFamily = "'Times New Roman', Times, serif";
                el.style.backgroundColor = '#ffffff';
                el.style.color = '#000000';
              }
            }
          });
          
          const imgData = canvas.toDataURL('image/jpeg', 0.9); // Use JPEG for better scaling
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          
          const imgProps = pdf.getImageProperties(imgData);
          const totalImgHeight = (imgProps.height * pdfWidth) / imgProps.width;
          
          let heightLeft = totalImgHeight;
          let position = 0;
          const totalPages = Math.ceil(totalImgHeight / pdfHeight);
          let currentPage = 1;

          // Page 1
          pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, totalImgHeight, undefined, 'FAST');
          
          // Add page number
          pdf.setFontSize(8);
          pdf.setTextColor(100);
          pdf.text(`Page ${currentPage} / ${totalPages}`, pdfWidth / 2, pdfHeight - 7, { align: 'center' });

          heightLeft -= pdfHeight;

          // Additional pages if needed
          while (heightLeft > 0) {
            position = heightLeft - totalImgHeight;
            pdf.addPage();
            currentPage++;
            pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, totalImgHeight, undefined, 'FAST');
            
            // Add page number
            pdf.setFontSize(8);
            pdf.setTextColor(100);
            pdf.text(`Page ${currentPage} / ${totalPages}`, pdfWidth / 2, pdfHeight - 7, { align: 'center' });
            
            heightLeft -= pdfHeight;
          }

          const filename = showAnswers ? `Correction_${exam.title.replace(/\s+/g, '_')}.pdf` : `Examen_${exam.title.replace(/\s+/g, '_')}.pdf`;
          pdf.save(filename);
        } catch (err) {
          console.error("PDF Export failed:", err);
        } finally {
          setIsExporting(false);
          setExportData(null);
        }
      }
    }, 200);
  };

  const handleExportWord = async (exam: Exam, showAnswers = false) => {
    const module = modules.find(m => m.id === exam.moduleId);
    if (!module) return;

    const groupId = exam.groupId || groups.find(g => g.name === exam.groupName)?.id;
    const group = groups.find(g => g.id === groupId);
    const filiere = filieres.find(f => f.id === group?.filiereId || module.filiereId);
    const filiereName = filiere ? `[${filiere.code}] ${filiere.name}` : 'N/A';
    const filiereLevel = filiere?.niveau || '';

    const totalPoints = exam.questions.reduce((sum, q) => sum + (q.points || 0), 0);

    const groupName = group?.name || exam.groupName || '';

    try {
      await exportExamToWord(
        exam,
        module,
        filiereName,
        groupName,
        totalPoints,
        showAnswers,
        orgSettings,
        filiereLevel
      );
    } catch (err) {
      console.error("Word Export failed:", err);
      alert("Erreur lors de l'exportation Word.");
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
      .filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'createdAt') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return a.title.localeCompare(b.title);
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

  return (
    <div className="flex flex-col lg:flex-row gap-10">
      {/* Sidebar Navigation - Hidden on mobile, shown on lg screens */}
      <aside className="hidden lg:block lg:w-72 shrink-0">
        <div className="sticky top-10 space-y-8">
          <div className="px-2">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Menu Principal</h3>
            <nav className="space-y-1.5">
              {[
                { id: 'overview', label: 'Vue d\'ensemble', icon: LayoutDashboard },
                { id: 'modules', label: 'Modules', icon: BookOpen },
                { id: 'exams', label: 'Examens', icon: ClipboardList },
                { id: 'results', label: 'Résultats', icon: History },
                { id: 'groups', label: 'Groupes', icon: Users },
                { id: 'filieres', label: 'Filières', icon: Database },
                { id: 'system', label: 'Système', icon: Database },
                { id: 'ai', label: 'Assistant IA', icon: Sparkles },
                { id: 'settings', label: 'Paramètres', icon: Settings },
              ].map((item, idx) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => setActiveTab(item.id as any)}
                  className={cn(
                    "w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold transition-all relative group",
                    activeTab === item.id 
                      ? "bg-indigo-600 text-white shadow-xl shadow-indigo-200 translate-x-2" 
                      : "text-slate-500 hover:bg-slate-50 hover:text-indigo-600"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-white" : "text-slate-400 group-hover:text-indigo-600")} />
                  {item.label}
                  {activeTab === item.id && (
                    <motion.div layoutId="active-tab" className="absolute left-[-1.5rem] w-1.5 h-6 bg-indigo-600 rounded-r-full" />
                  )}
                </motion.button>
              ))}
            </nav>
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
              <div className="space-y-12">
                <div className="space-y-2">
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight font-serif italic">Bonjour, {user?.displayName || 'Enseignant'}</h2>
                  <p className="text-slate-500 font-medium tracking-tight">Voici l'état actuel de vos cours et examens.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                  {stats.map((stat, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
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
                              {results.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="px-8 py-10 text-center text-slate-400 font-bold">Aucun résultat enregistré.</td>
                                </tr>
                              ) : (
                                results.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()).slice(0, 5).map(result => {
                                  const exam = exams.find(e => e.id === result.examId);
                                  const percentage = Math.round((result.score / (result.totalPoints || 1)) * 100);
                                  return (
                                    <tr key={result.id} className="group hover:bg-slate-50/50 transition-colors">
                                      <td className="px-8 py-5">
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-[10px] font-black text-indigo-600">
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
                                            "px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1.5",
                                            percentage >= 80 ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : percentage >= 50 ? "bg-amber-50 text-amber-600 border border-amber-100" : "bg-rose-50 text-rose-600 border border-rose-100"
                                          )}>
                                            {formatScore(result.score)} / {result.totalPoints}
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-8 py-5 text-right">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{new Date(result.completedAt).toLocaleDateString()}</span>
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

                    <section className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Examens Récents</h3>
                        <Button variant="ghost" size="sm" onClick={() => setActiveTab('exams')} className="text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50">Voir tout</Button>
                      </div>
                      <div className="grid grid-cols-1 gap-6">
                        {exams.length === 0 ? (
                          <EmptyState message="Aucun examen créé pour le moment." />
                        ) : (
                          exams.slice(0, 3).map(exam => {
                            const module = modules.find(m => m.id === exam.moduleId);
                            return (
                              <Card key={exam.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between group border-2 border-slate-100 hover:border-indigo-100 transition-all duration-300 rounded-[2rem] hover:shadow-xl hover:shadow-slate-200/50">
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
                                        <Clock className="w-3 h-3" /> {formatDuration(exam.durationMinutes)}
                                      </p>
                                      <span className="w-1 h-1 rounded-full bg-slate-200 hidden sm:block" />
                                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-1.5">
                                        <ClipboardList className="w-3 h-3" /> {exam.questions.length} questions
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
                                  <div className="flex flex-col items-end gap-2">
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

                                  <div className="flex items-center gap-1 bg-slate-50/50 p-1 rounded-2xl border border-slate-100">
                                    <div className="flex">
                                      <Button variant="ghost" size="sm" onClick={() => handleExportPDF(exam, false)} className="h-10 w-10 p-0 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all" title="PDF">
                                        <FileDown className="w-4 h-4" />
                                      </Button>
                                      <Button variant="ghost" size="sm" onClick={() => handleExportWord(exam, false)} className="h-10 w-10 p-0 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all" title="Word">
                                        <FileText className="w-4 h-4" />
                                      </Button>
                                    </div>
                                    <div className="w-px h-5 bg-slate-200 self-center mx-1" />
                                    <div className="flex gap-1">
                                      <Button variant="ghost" size="sm" onClick={() => setPreviewExam(exam)} className="h-10 w-10 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Aperçu">
                                        <Eye className="w-4.5 h-4.5" />
                                      </Button>
                                      <Button variant="ghost" size="sm" onClick={() => setEditingExam(exam)} className="h-10 w-10 p-0 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all" title="Modifier">
                                        <Edit2 className="w-4.5 h-4.5" />
                                      </Button>
                                      {results.filter(r => r.examId === exam.id).length === 0 && (
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          onClick={(e) => handleDeleteExam(e, exam.id)} 
                                          className={cn(
                                            "h-10 p-0 transition-all rounded-xl",
                                            deletingExamId === exam.id 
                                              ? "w-auto px-4 bg-rose-600 text-white hover:bg-rose-700" 
                                              : "w-10 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                          )} 
                                          title={deletingExamId === exam.id ? "Confirmer la suppression" : "Supprimer"}
                                        >
                                          {deletingExamId === exam.id ? (
                                            <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap flex items-center gap-2">
                                              <Trash2 className="w-3.5 h-3.5" />
                                              Confirmer
                                            </span>
                                          ) : (
                                            <Trash2 className="w-4.5 h-4.5" />
                                          )}
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </Card>
                            );
                          })
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'modules' && (
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
                  {modules.length === 0 ? (
                    <div className="col-span-full"><EmptyState message="Commencez par créer votre premier module." /></div>
                  ) : (
                    modules.map((module, index) => (
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
                                <Button variant="ghost" size="sm" onClick={() => setEditingModule(module)} className="text-slate-400 hover:text-indigo-600 h-10 w-10 p-0 rounded-xl"><Edit2 className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteModule(module.id)} className="text-slate-400 hover:text-rose-600 h-10 w-10 p-0 rounded-xl"><Trash2 className="w-4 h-4" /></Button>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-lg uppercase tracking-widest border border-indigo-100">{module.code}</span>
                                <span className="px-2 py-0.5 bg-slate-50 text-slate-500 text-[10px] font-black rounded-lg uppercase tracking-widest border border-slate-100">{module.durationHours}H</span>
                            </div>
                            <h4 className="text-xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight mb-2">{module.name}</h4>
                            <div className="text-xs text-slate-500 line-clamp-3 mb-6 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: module.description }} />
                            <div className="mt-auto pt-6 border-t border-slate-100 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                               <span>{filieres.find(f => f.id === module.filiereId)?.name || 'Toutes filières'}</span>
                               <span className="flex items-center gap-1.5"><History className="w-3 h-3" /> {new Date(module.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'exams' && (
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
                    filteredExams.map(exam => {
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
                                  <div className="flex bg-slate-50 border border-slate-100 p-1 rounded-2xl shrink-0">
                                    <div className="flex">
                                      <Button variant="ghost" size="sm" onClick={() => handleExportPDF(exam, false)} className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all" title="PDF">
                                        <FileDown className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button variant="ghost" size="sm" onClick={() => handleExportWord(exam, false)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all" title="Word">
                                        <FileText className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                    <div className="w-px h-3.5 bg-slate-200 self-center mx-1" />
                                    <div className="flex">
                                      <Button variant="ghost" size="sm" onClick={() => handleExportPDF(exam, true)} className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-600 hover:bg-white rounded-xl transition-all" title="Corrigé PDF">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button variant="ghost" size="sm" onClick={() => handleExportWord(exam, true)} className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-500 hover:bg-white rounded-xl transition-all" title="Corrigé Word">
                                        <Sparkles className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                    {examResults.length > 0 && (
                                      <>
                                        <div className="w-px h-3.5 bg-slate-200 self-center mx-1" />
                                        <Button variant="ghost" size="sm" onClick={() => handleExportResultsPDF(exam)} className="h-8 w-8 p-0 text-violet-500 hover:bg-white rounded-xl transition-all" title="Exporter les Résultats (PDF)">
                                          <Users className="w-3.5 h-3.5" />
                                        </Button>
                                      </>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => setPerformanceExam(exam)} className="h-9 w-9 p-0 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all" title="Performance">
                                      <BarChart className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => setPreviewExam(exam)} className="h-9 w-9 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Aperçu">
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => setEditingExam(exam)} className="h-9 w-9 p-0 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all" title="Modifier">
                                      <Edit2 className="w-4 h-4" />
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
              </div>
            )}

            {activeTab === 'results' && (
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 font-serif italic tracking-tight">Gestion des Résultats</h2>
                    <p className="text-slate-500 mt-1">Consultez et exportez les performances de tous vos étudiants.</p>
                  </div>
                  <div className="flex items-center gap-3">
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <Card className="p-6 bg-indigo-50/50 border-none">
                         <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Total Examens Terminés</p>
                         <h4 className="text-3xl font-black text-indigo-900">{results.length}</h4>
                       </Card>
                       <Card className="p-6 bg-emerald-50/50 border-none">
                         <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Taux de Réussite Global</p>
                         <h4 className="text-3xl font-black text-emerald-900">
                           {results.length > 0 ? formatPercent((results.filter(r => (r.score / (r.totalPoints || 1)) >= 0.5).length / results.length) * 100) : 0}%
                         </h4>
                       </Card>
                       <Card className="p-6 bg-amber-50/50 border-none">
                         <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2">Moyenne de la Classe</p>
                         <h4 className="text-3xl font-black text-amber-900">
                            {results.length > 0 ? formatPercent((results.reduce((acc, r) => acc + (r.score / (r.totalPoints || 1)), 0) / results.length) * 100) : 0}%
                         </h4>
                       </Card>
                    </div>

                    <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-soft overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-slate-50/50 border-b-2 border-slate-100 font-display">
                              <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Étudiant</th>
                              <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Examen & Module</th>
                              <th className="px-8 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Score %</th>
                              <th className="px-8 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Note brute</th>
                              <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Détails</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y-2 divide-slate-50">
                            {(() => {
                              const filteredResultsList = results
                                .filter(r => {
                                  const exam = exams.find(e => e.id === r.examId);
                                  const matchesSearch = r.studentName?.toLowerCase().includes(searchQuery.toLowerCase());
                                  const matchesExam = !selectedExamId || r.examId === selectedExamId;
                                  const matchesModule = resultsFilterModule === 'all' || exam?.moduleId === Number(resultsFilterModule);
                                  const matchesGroup = resultsFilterGroup === 'all' || r.groupName === groups.find(g => g.id === Number(resultsFilterGroup))?.name;
                                  return matchesSearch && matchesExam && matchesModule && matchesGroup;
                                })
                                .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

                              const startIndex = (resultsPage - 1) * resultsPerPage;
                              const currentResults = filteredResultsList.slice(startIndex, startIndex + resultsPerPage);
                              const totalPages = Math.ceil(filteredResultsList.length / resultsPerPage);

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
                                              <p className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight text-xs">{result.studentName}</p>
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
                                        <td className="px-8 py-5 text-right">
                                          {exam && (
                                            <Button 
                                              variant="ghost" 
                                              size="sm" 
                                              onClick={() => setPerformanceExam(exam)}
                                              className="text-indigo-600 hover:bg-indigo-50 gap-2"
                                            >
                                              <Eye className="w-4 h-4" /> Analyse
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
                  </div>
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
                    notifications.map(notif => {
                      const targetGroup = notif.groupId ? groups.find(g => g.id === notif.groupId) : null;
                      return (
                        <Card key={notif.id} className="p-8 border-none shadow-xl shadow-slate-200/40 relative group overflow-hidden rounded-[2.5rem]">
                          <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm" className="text-rose-500 hover:bg-rose-50 rounded-xl" onClick={async () => {
                              if(confirm("Supprimer cette annonce ?")) {
                                await api.notifications.delete(notif.id);
                                onRefresh();
                              }
                            }}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-3 mb-4">
                             <div className={cn(
                               "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.2em]",
                               targetGroup ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                             )}>
                               {targetGroup ? `Groupe: ${targetGroup.name}` : 'Annonce Globale'}
                             </div>
                             <span className="text-xs text-slate-400 font-bold">{new Date(notif.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                          </div>
                          <h4 className="text-2xl font-black text-slate-900 mb-4 tracking-tight uppercase group-hover:text-indigo-600 transition-colors">{notif.title}</h4>
                          <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-loose" dangerouslySetInnerHTML={{ __html: notif.content }} />
                        </Card>
                      );
                    })
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
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 font-serif italic tracking-tight">Assistant IA Pédagogique</h2>
                    <p className="text-slate-500 mt-1">Générez du contenu pédagogique de haute qualité instantanément.</p>
                  </div>
                </div>
                
                <Card className="p-0 border-none shadow-2xl overflow-hidden bg-slate-900 text-white rounded-[2.5rem]">
                  <div className="p-8 md:p-12 space-y-8">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shadow-xl shadow-indigo-500/20">
                        <Sparkles className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black tracking-tight uppercase">Générateur de Questions</h3>
                        <p className="text-indigo-300 font-medium">L'IA Gemini analyse votre sujet et propose des questions prêtes à l'emploi.</p>
                      </div>
                    </div>

                    <div className="bg-white/5 p-8 rounded-3xl border border-white/10 space-y-6">
                      <p className="text-sm text-white/70 italic">Note: Les questions générées ici peuvent être copiées ou utilisées pour créer un nouvel examen après validation.</p>
                      <Button 
                        onClick={() => setIsAddingExam(true)} 
                        className="w-full md:w-auto bg-indigo-500 hover:bg-indigo-400 text-white font-black py-4 px-8 rounded-2xl flex items-center gap-3"
                      >
                        <Plus className="w-5 h-5" /> Créer un examen avec l'IA
                      </Button>
                    </div>
                  </div>
                  
                  <div className="bg-indigo-600 p-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex -space-x-2">
                        {[1,2,3].map(i => (
                          <div key={i} className="w-8 h-8 rounded-full border-2 border-indigo-600 bg-indigo-400 flex items-center justify-center text-[10px] font-black">
                            {i}
                          </div>
                        ))}
                      </div>
                      <span className="text-xs font-bold text-indigo-100">Plus de 1000 questions générées ce mois-ci</span>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {activeTab === 'settings' && (
              <OrganizationSettingsView />
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
        {activatingExam && (
          <ActivateExamModal
            exam={activatingExam}
            groups={groups}
            onConfirm={handleActivateExam}
            onClose={() => setActivatingExam(null)}
          />
        )}
      </AnimatePresence>
      {isExporting && (
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
            settings={orgSettings}
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
      </div>
    </div>
  );
};
