import React, { useState, useMemo } from 'react';
import { 
  Users, BookOpen, ClipboardList, Bell, Plus, Search, Filter, 
  ChevronDown, Edit2, Trash2, LayoutDashboard, Database, Eye, History, CheckCircle2, Star, Clock, BarChart, Target,
  FileDown, Sparkles, FileText, Settings, Loader2, Copy, AlertTriangle, Radio
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
import { AdminUserManagement } from '../sections/AdminUserManagement';
import { AuditLogsView } from '../sections/AuditLogsView';
import { AiAssistantView } from './AiAssistantView';
import { ResultDetailModal } from '../modals/ResultDetailModal';
import { AddModuleForm } from '../forms/AddModuleForm';
import { AddNotificationForm } from '../forms/AddNotificationForm';
import { AddExamForm } from '../forms/AddExamForm';
import { ExamPerformanceModal } from '../modals/ExamPerformanceModal';
import { ActivateExamModal } from '../modals/ActivateExamModal';
import { ExamExportTemplate } from '../ExamExportTemplate';
import { ResultsExportTemplate } from '../ResultsExportTemplate';
import { PVExportTemplate } from '../PVExportTemplate';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { exportExamToWord } from '../../lib/docxExport';
import { exportPVToWord } from '../../lib/pvDocxExport';
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
  const resultsPerPage = 10;
  const [resultsViewMode, setResultsViewMode] = useState<'by-exam' | 'all-results'>('by-exam');
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
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

    return {
      list,
      total,
      avgScore: Math.round(avgScore),
      successPercent: Math.round(successPercent)
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

  const sortedAndPaginatedResults = useMemo(() => {
    const sorted = [...filteredResultsStats.list].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
    const totalPages = Math.ceil(sorted.length / resultsPerPage);
    const startIndex = (resultsPage - 1) * resultsPerPage;
    const paginated = sorted.slice(startIndex, startIndex + resultsPerPage);
    return {
      sorted,
      totalPages: Math.max(1, totalPages),
      paginated
    };
  }, [filteredResultsStats.list, resultsPage, resultsPerPage]);

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
  const [exportData, setExportData] = useState<{ exam: Exam, module: Module, filiereName: string, filiereLevel?: string, groupName: string, showAnswers: boolean } | null>(null);

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
          // Helper to scrub problematic CSS like oklch that crashes html2canvas
          const scrubOklch = (doc: Document) => {
            try {
              // 1. Remove all external stylesheets and existing style blocks
              const styles = doc.querySelectorAll('style, link[rel="stylesheet"]');
              styles.forEach(s => {
                try {
                  s.parentElement?.removeChild(s);
                } catch (e) {
                  s.remove();
                }
              });

              // 2. Explicitly disable all stylesheets in the clone in case some survived
              for (let i = 0; i < doc.styleSheets.length; i++) {
                try {
                  doc.styleSheets[i].disabled = true;
                } catch (e) {}
              }

              // 3. Inject a clean, safe style block
              const cleanStyle = doc.createElement('style');
              cleanStyle.innerHTML = `
                * { 
                  color: #000000 !important; 
                  border-color: #000000 !important;
                  box-shadow: none !important;
                  text-shadow: none !important;
                  background-image: none !important;
                }
                table, td, th { border: 1px solid #000 !important; border-collapse: collapse !important; }
                .text-emerald-600, .text-green-600 { color: #059669 !important; }
                .bg-emerald-50, .bg-green-50 { background-color: #f0fdf4 !important; }
                h1, h2, h3, h4, h5, h6 { color: #000 !important; }
              `;
              doc.head.appendChild(cleanStyle);

              // 4. Scrub all inline styles
              const allElements = doc.querySelectorAll('*');
              allElements.forEach(el => {
                const element = el as HTMLElement;
                if (element.style) {
                  element.style.fontVariantLigatures = 'none';
                }
                const styleAttr = element.getAttribute('style') || '';
                if (styleAttr.includes('oklch')) {
                  element.setAttribute('style', styleAttr.replace(/oklch\([^)]+\)/g, '#888888'));
                }
              });
            } catch (err) {
              console.warn("Scrubbing failed, but continuing:", err);
            }
          };

          const canvas = await html2canvas(resultsExportRef.current, {
            scale: 4, 
            useCORS: true,
            logging: false,
            allowTaint: true,
            backgroundColor: '#ffffff',
            windowWidth: 1200,
            onclone: (doc) => {
              scrubOklch(doc);
              // Force clean styles on the container itself
              const containerEl = doc.getElementById('results-export-container');
              if (containerEl) {
                containerEl.style.fontFamily = "'Times New Roman', Times, 'Amiri', serif";
                containerEl.style.backgroundColor = '#ffffff';
                containerEl.style.color = '#000000';
              }
            }
          });
          
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          const margin = 10;
          const contentWidth = pdfWidth - (2 * margin);

          const el = resultsExportRef.current;
          if (!el) return;

          // Helper to add an element to PDF
          const addElementToPdf = async (element: HTMLElement, addNewPage = false) => {
            if (addNewPage) pdf.addPage();

            const canvas = await html2canvas(element, {
              scale: 3,
              useCORS: true,
              logging: false,
              backgroundColor: '#ffffff',
              windowWidth: 1200,
              onclone: (doc) => {
                scrubOklch(doc);
              }
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const imgProps = pdf.getImageProperties(imgData);
            const imgHeight = (imgProps.height * contentWidth) / imgProps.width;
            
            // If it's too tall for one page, we might still need some slicing, 
            // but for one student it usually fits.
            pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, imgHeight, undefined, 'FAST');
            return imgHeight;
          };

          // 1. Capture Summary
          const summaryEl = el.querySelector('#export-summary-section') as HTMLElement;
          if (summaryEl) {
            await addElementToPdf(summaryEl);
          }

          // 2. Capture Each Student Card
          const studentCards = el.querySelectorAll('.student-detail-card');
          for (let i = 0; i < studentCards.length; i++) {
            await addElementToPdf(studentCards[i] as HTMLElement, true);
          }

          // Add Page Numbers to all pages
          const totalPages = pdf.getNumberOfPages();
          for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            pdf.setTextColor(150);
            pdf.text(`${exam.title} - Page ${i} / ${totalPages}`, margin, pdfHeight - 5);
            pdf.text(`Généré le ${new Date().toLocaleDateString()}`, pdfWidth - margin, pdfHeight - 5, { align: 'right' });
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
          // Helper to scrub problematic CSS like oklch that crashes html2canvas
          const scrubOklch = (doc: Document) => {
            try {
              // 1. Remove all external stylesheets and existing style blocks
              const styles = doc.querySelectorAll('style, link[rel="stylesheet"]');
              styles.forEach(s => {
                try {
                  s.parentElement?.removeChild(s);
                } catch (e) {
                  s.remove();
                }
              });

              // 2. Explicitly disable all stylesheets in the clone in case some survived
              for (let i = 0; i < doc.styleSheets.length; i++) {
                try {
                  doc.styleSheets[i].disabled = true;
                } catch (e) {}
              }

              // 3. Inject a clean, safe style block
              const cleanStyle = doc.createElement('style');
              cleanStyle.innerHTML = `
                * { 
                  color: #000000 !important; 
                  border-color: #000000 !important;
                  box-shadow: none !important;
                  text-shadow: none !important;
                  background-image: none !important;
                }
                table, td, th { border: 1px solid #000 !important; border-collapse: collapse !important; }
                h1, h2, h3, h4, h5, h6 { color: #000 !important; }
              `;
              doc.head.appendChild(cleanStyle);

              // 4. Scrub all inline styles
              const allElements = doc.querySelectorAll('*');
              allElements.forEach(el => {
                const node = el as HTMLElement;
                if (node.style) {
                  node.style.fontVariantLigatures = 'none';
                }
                const styleAttr = node.getAttribute('style') || '';
                if (styleAttr.includes('oklch')) {
                  node.setAttribute('style', styleAttr.replace(/oklch\([^)]+\)/g, '#888888'));
                }
              });
            } catch (err) {
              console.warn("Scrubbing failed, but continuing:", err);
            }
          };

          const canvas = await html2canvas(exportRef.current, {
            scale: 4, 
            useCORS: true,
            logging: false,
            allowTaint: true,
            backgroundColor: '#ffffff',
            windowWidth: 1200,
            onclone: (doc) => {
              scrubOklch(doc);
              // Force clean styles on the container itself
              const containerEl = doc.getElementById('export-container');
              if (containerEl) {
                containerEl.style.fontFamily = "'Times New Roman', Times, 'Amiri', serif";
                containerEl.style.backgroundColor = '#ffffff';
                containerEl.style.color = '#000000';
              }
            }
          });
          
          const filename = showAnswers ? `Correction_${exam.title.replace(/\s+/g, '_')}.pdf` : `Examen_${exam.title.replace(/\s+/g, '_')}.pdf`;
          
          const el = exportRef.current;
          if (!el) return;

          // Capture QR Code first if it exists
          const qrCodeEl = el.querySelector('.qr-code-verification-wrap') as HTMLElement;
          let qrCodeImgData = '';
          if (qrCodeEl) {
            const qrCanvas = await html2canvas(qrCodeEl, { 
              scale: 3, 
              backgroundColor: '#ffffff', 
              logging: false,
              onclone: (doc) => {
                scrubOklch(doc);
              }
            });
            qrCodeImgData = qrCanvas.toDataURL('image/png');
          }

          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          const margin = 12; // Slightly larger margins
          const contentWidth = pdfWidth - (2 * margin);

          const addPageFooter = (num: number, isLast = false) => {
            const hasTextFooter = orgSettings?.showFooter !== false;

            if (hasTextFooter) {
              pdf.setFontSize(8);
              pdf.setTextColor(150);
              pdf.text(`${exam.title} - Page ${num}`, margin, pdfHeight - 5);
              
              const baseFooter = orgSettings?.footerText || `OFPPT / ${module.code}`;
              const rightText = isLast 
                ? `${baseFooter} - Généré le ${new Date().toLocaleDateString()}`
                : baseFooter;
              
              pdf.text(rightText, pdfWidth - margin, pdfHeight - 5, { align: 'right' });
            }
            
            if (qrCodeImgData) {
              // Add QR code to the bottom center
              const qrSize = 10;
              pdf.addImage(qrCodeImgData, 'PNG', (pdfWidth / 2) - (qrSize / 2), pdfHeight - 14, qrSize, qrSize);
            }
          };

          // Select all logical blocks to capture separately
          // This prevents questions from being sliced in half
          const blocks = Array.from(el.querySelectorAll('.header-table, .metadata-table, .candidate-info-wrap, div[style*="border: 1.5px solid #000"], div[style*="border: 1px solid #000"], .section-header, .question-block, .correction-summary, div[style*="marginTop: 40px"]'));
          
          let currentY = margin;
          let pageCount = 1;

          for (const block of blocks) {
            const canvas = await html2canvas(block as HTMLElement, {
              scale: 3, // Higher scale for clarity
              useCORS: true,
              logging: false,
              backgroundColor: '#ffffff',
              windowWidth: 1200,
              onclone: (doc) => {
                scrubOklch(doc);
              }
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const imgProps = pdf.getImageProperties(imgData);
            const imgHeight = (imgProps.height * contentWidth) / imgProps.width;

            const blockEl = block as HTMLElement;
            const isHeader = blockEl.classList.contains('section-header');
            
            // Check if block fits on current page
            let needsNewPage = (currentY + imgHeight > pdfHeight - 15);

            // Orphan title prevention: If a section header is too close to the bottom of the page
            // we move it to the next page so it's not separated from the questions it introduces.
            if (!needsNewPage && isHeader) {
              // 45mm is a safe heuristic for: Header height (~15mm) + Gap (~10mm) + First question (~20mm)
              if (currentY + imgHeight + 45 > pdfHeight - 15) {
                needsNewPage = true;
              }
            }

            if (needsNewPage) {
              // Add Footer and Page Number before adding new page
              addPageFooter(pageCount);

              pdf.addPage();
              currentY = margin;
              pageCount++;
            }

            pdf.addImage(imgData, 'JPEG', margin, currentY, contentWidth, imgHeight, undefined, 'FAST');
            
            // Add spacing after block
            if (isHeader) {
              currentY += imgHeight + 8; // Medium gap after header
            } else if (blockEl.classList.contains('header-table') || blockEl.classList.contains('metadata-table')) {
              currentY += imgHeight + 6; // Standard gap
            } else {
              currentY += imgHeight + 4; // Small gap between questions
            }

            // If the next sibling is a section header, add extra space before it
            const nextBlock = blocks[blocks.indexOf(block) + 1] as HTMLElement | undefined;
            if (nextBlock && nextBlock.classList.contains('section-header')) {
              currentY += 12; // Extra breathing room before a new section
            }
          }

          // Final Footer and Page Number
          addPageFooter(pageCount, true);

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
        filiereLevel,
        user.displayName
      );
    } catch (err) {
      console.error("Word Export failed:", err);
      alert("Erreur lors de l'exportation Word.");
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
        { id: 'results', label: 'Résultats', icon: History },
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <Card className="p-6 bg-indigo-50/50 border-none">
                         <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Copies selectionnées</p>
                         <h4 className="text-3xl font-black text-indigo-900">{filteredResultsStats.total} / {results.length}</h4>
                       </Card>
                       <Card className="p-6 bg-emerald-50/50 border-none">
                         <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Taux de Réussite filtré</p>
                         <h4 className="text-3xl font-black text-emerald-900">
                           {filteredResultsStats.successPercent}%
                         </h4>
                       </Card>
                       <Card className="p-6 bg-amber-50/50 border-none">
                         <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2">Moyenne filtrée</p>
                         <h4 className="text-3xl font-black text-amber-900">
                            {filteredResultsStats.avgScore}%
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
              <AiAssistantView 
                modules={modules} 
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
               <AddNotificationForm user={user} groups={groups} onComplete={() => { setIsAddingNotification(false); onRefresh(); }} />
             </div>
          </Modal>
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
            settings={orgSettings}
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
