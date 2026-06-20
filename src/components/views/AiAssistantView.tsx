import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Send, BrainCircuit, ClipboardList, AlertCircle, Loader2, Trash2, 
  Bell, BookOpen, Copy, Check, CheckSquare, Award, Target, HelpCircle, 
  FileText, ListTodo, Plus, Pin, ExternalLink, RefreshCw, Download,
  Calculator, Wrench, GraduationCap, UserCheck, Edit, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  generateQuestions, 
  generateAnnouncementAI, 
  generateStudyGuideAI, 
  generateRubricAI,
  generatePracticalExamAI,
  optimizePracticalExamRubricsAI,
  generateCandidatePracticalFeedbackAI
} from '../../lib/gemini';
import { exportPracticalExamToWord } from '../../lib/practicalDocxExport';
import { exportPracticalSolutionToWord } from '../../lib/practicalSolutionDocxExport';
import { exportProvidedFile } from '../../lib/providedFileExporter';
import { PREBUILT_STARTER_TEMPLATES, PrebuildStarterTemplate } from '../../lib/starterTemplates';
import { Button } from '../ui/Button';
import { useConfirm } from '../ui/ConfirmDialog';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Module, Question, Group, Filiere, PracticalExamSheet } from '../../types';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { toast } from 'react-hot-toast';

interface AiAssistantViewProps {
  modules: Module[];
  groups?: Group[];
  filieres?: Filiere[];
  onRefresh: () => void;
  onSelectTab: (tab: string) => void;
}

export const AiAssistantView = ({ 
  modules, 
  groups = [], 
  filieres = [], 
  onRefresh, 
  onSelectTab 
}: AiAssistantViewProps) => {
  const confirm = useConfirm();
  // Active Automation Tool/Tab
  const [activeTool, setActiveTool] = useState<'exams' | 'announcements' | 'guides' | 'rubrics' | 'practicals'>('exams');

  // Common UI states
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // ==========================================
  // STATE: Tool 1 - Examine Engine
  // ==========================================
  const [prompt, setPrompt] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState<number>(modules[0]?.id || 0);
  const [difficulty, setDifficulty] = useState('Standard');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedExam, setGeneratedExam] = useState<{ title: string, questions: Question[] } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ==========================================
  // STATE: Tool 2 - Announcements Engine
  // ==========================================
  const [announceTopic, setAnnounceTopic] = useState('');
  const [announceTone, setAnnounceTone] = useState('Académique & Professionnel');
  const [announceAudienceText, setAnnounceAudienceText] = useState('Tous les étudiants');
  const [isGeneratingAnnounce, setIsGeneratingAnnounce] = useState(false);
  const [generatedAnnounce, setGeneratedAnnounce] = useState<{ title: string; content: string; importance: 'normal' | 'low' | 'high' } | null>(null);
  const [announceTargetType, setAnnounceTargetType] = useState<'global' | 'filiere' | 'group'>('global');
  const [selectedFiliereId, setSelectedFiliereId] = useState<number | ''>('');
  const [selectedGroupId, setSelectedGroupId] = useState<number | ''>('');
  const [announceAudienceRole, setAnnounceAudienceRole] = useState<'all' | 'students' | 'teachers'>('all');
  const [announceIsPinned, setAnnounceIsPinned] = useState(false);
  const [isPublishingAnnounce, setIsPublishingAnnounce] = useState(false);
  const [isCustomAudience, setIsCustomAudience] = useState(false);

  const currentAudienceKey = isCustomAudience ? 'custom' :
    announceTargetType === 'filiere' && selectedFiliereId ? `filiere:${selectedFiliereId}` :
    announceTargetType === 'group' && selectedGroupId ? `group:${selectedGroupId}` :
    `global:${announceAudienceRole}`;

  const handleAudienceChange = (val: string) => {
    if (val === 'custom') {
      setIsCustomAudience(true);
      setAnnounceAudienceText('');
    } else {
      setIsCustomAudience(false);
      if (val.startsWith('filiere:')) {
        const fId = Number(val.replace('filiere:', ''));
        const filiereName = filieres.find(f => f.id === fId)?.name || '';
        setAnnounceTargetType('filiere');
        setSelectedFiliereId(fId);
        setAnnounceAudienceRole('all');
        setAnnounceAudienceText(`Les étudiants de la filière ${filiereName}`);
      } else if (val.startsWith('group:')) {
        const gId = Number(val.replace('group:', ''));
        const groupName = groups.find(g => g.id === gId)?.name || '';
        setAnnounceTargetType('group');
        setSelectedGroupId(gId);
        setAnnounceAudienceRole('all');
        setAnnounceAudienceText(`Les étudiants du groupe de classe ${groupName}`);
      } else if (val === 'global:students') {
        setAnnounceTargetType('global');
        setAnnounceAudienceRole('students');
        setAnnounceAudienceText('Tous les étudiants');
      } else if (val === 'global:teachers') {
        setAnnounceTargetType('global');
        setAnnounceAudienceRole('teachers');
        setAnnounceAudienceText('Tous les formateurs / enseignants');
      } else if (val === 'global:all') {
        setAnnounceTargetType('global');
        setAnnounceAudienceRole('all');
        setAnnounceAudienceText("Tout l'établissement (Étudiants et Formateurs)");
      }
    }
  };

  // ==========================================
  // STATE: Tool 3 - Course Fiches Guide Engine
  // ==========================================
  const [guideTopic, setGuideTopic] = useState('');
  const [guideSelectedModuleId, setGuideSelectedModuleId] = useState<number>(modules[0]?.id || 0);
  const [isGeneratingGuide, setIsGeneratingGuide] = useState(false);
  const [generatedGuide, setGeneratedGuide] = useState<{ 
    title: string; 
    sections: { subtitle: string; markdownContent: string }[]; 
    keyTakeaways: string[] 
  } | null>(null);

  // ==========================================
  // STATE: Tool 4 - Class rubrics/Grilles Corrector Engine
  // ==========================================
  const [rubricAssignment, setRubricAssignment] = useState('');
  const [rubricPoints, setRubricPoints] = useState(20);
  const [isGeneratingRubric, setIsGeneratingRubric] = useState(false);
  const [generatedRubric, setGeneratedRubric] = useState<{ 
    title: string; 
    criteriaList: { criteriaName: string; maxPoints: number; description: string }[]; 
    tips: string 
  } | null>(null);

  // ==========================================
  // STATE: Tool 5 - Practical Certification Exam Engine
  // ==========================================
  const [practicalVendor, setPracticalVendor] = useState('Microsoft Office');
  const [practicalCertName, setPracticalCertName] = useState('MOS Excel Associate');
  const [practicalTopic, setPracticalTopic] = useState('');
  const [practicalPoints, setPracticalPoints] = useState(40);
  const [practicalDuration, setPracticalDuration] = useState(120);
  const [isGeneratingPractical, setIsGeneratingPractical] = useState(false);
  const [generatedPractical, setGeneratedPractical] = useState<PracticalExamSheet | null>(null);
  const [isSavingPractical, setIsSavingPractical] = useState(false);
  const [practicalSelectedModuleId, setPracticalSelectedModuleId] = useState<number>(modules[0]?.id || 0);

  const [savedPracticals, setSavedPracticals] = useState<any[]>([]);
  const [isLoadingSavedPracticals, setIsLoadingSavedPracticals] = useState(false);

  const fetchSavedPracticals = async () => {
    setIsLoadingSavedPracticals(true);
    try {
      const examsList = await api.exams.list();
      const filtered = examsList.filter((ex: any) => 
        ex.questions && ex.questions.some((q: any) => q.type === 'practical')
      );
      setSavedPracticals(filtered);
    } catch (err) {
      console.error("Failed to load saved practical sheets:", err);
    } finally {
      setIsLoadingSavedPracticals(false);
    }
  };

  useEffect(() => {
    if (activeTool === 'practicals') {
      fetchSavedPracticals();
    }
  }, [activeTool]);

  const handleLoadPractical = (exam: any) => {
    try {
      const q = exam.questions.find((quest: any) => quest.type === 'practical');
      if (q && q.correctAnswer) {
        const sheet = JSON.parse(q.correctAnswer) as PracticalExamSheet;
        setGeneratedPractical(sheet);
        setPracticalSelectedModuleId(exam.moduleId);
        setPracticalVendor(sheet.vendor || 'Microsoft Office');
        setPracticalCertName(sheet.certificationName || 'MOS Excel Associate');
        setPracticalTopic('');
        setPracticalPoints(sheet.evaluationCriteria ? sheet.evaluationCriteria.reduce((sum, c) => sum + (c.points > 0 ? c.points : 0), 0) : 40);
        setPracticalDuration(sheet.durationMinutes || 120);
        toast.success(`Fiche "${sheet.title}" chargée avec succès !`);
      } else {
        toast.error("Cette fiche ne possède pas de données structurées exploitables.");
      }
    } catch (err) {
      console.error("Failed to parse loaded practical:", err);
      toast.error("Erreur de décodage des données de la fiche.");
    }
  };

  const handleDeletePractical = async (examId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      title: "Supprimer la fiche pratique",
      message: "Êtes-vous sûr de vouloir supprimer cette fiche d'examen pratique ?",
      confirmLabel: "Supprimer",
      cancelLabel: "Annuler",
      variant: "danger"
    });
    if (!ok) {
      return;
    }
    try {
      await api.exams.delete(examId);
      toast.success("Fiche pratique supprimée avec succès.");
      fetchSavedPracticals();
      onRefresh();
    } catch (err) {
      console.error("Failed to delete practical sheet:", err);
      toast.error("Erreur de suppression.");
    }
  };

  // States for enriched technical starter templates library
  const [showStartersLibrary, setShowStartersLibrary] = useState(false);
  const [previewingTemplate, setPreviewingTemplate] = useState<PrebuildStarterTemplate | null>(null);

  // States for enhanced correction grid (Grille d'Évaluation)
  const [isRatingMode, setIsRatingMode] = useState(false);
  const [candidateName, setCandidateName] = useState('');
  const [candidateGroup, setCandidateGroup] = useState('');
  const [assignedPoints, setAssignedPoints] = useState<Record<number, number>>({});
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [studentFeedbackText, setStudentFeedbackText] = useState('');
  const [isOptimizingRubric, setIsOptimizingRubric] = useState(false);
  const [editingCriterionIndex, setEditingCriterionIndex] = useState<number | null>(null);
  const [editingCriterion, setEditingCriterion] = useState<{
    taskTitle: string;
    criteriaName: string;
    points: number;
    guidelines: string;
  } | null>(null);
  const [isAddingCriterion, setIsAddingCriterion] = useState(false);
  const [newCriterion, setNewCriterion] = useState({
    taskTitle: '',
    criteriaName: '',
    points: 5,
    guidelines: ''
  });

  // Filter for Candidate vs Trainer view (Mode d'Affichage Filtre)
  const [practicalViewFilter, setPracticalViewFilter] = useState<'teacher' | 'candidate'>('teacher');


  // Copy to clipboard helper
  const handleCopyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2500);
  };

  // ==========================================
  // LOGIC: Tool 1 - Examine Generator
  // ==========================================
  const handleGenerateExam = async () => {
    if (!prompt || !selectedModuleId) return;

    setIsGenerating(true);
    setGeneratedExam(null);

    try {
      const module = modules.find(m => m.id === selectedModuleId);
      const promptContext = `Sujet/Contenu: ${prompt}. Module: ${module?.name}. Niveau de difficulté attendu: ${difficulty}.`;
      const questions = await generateQuestions(promptContext, 10);
      setGeneratedExam({
        title: `Examen IA - ${prompt.slice(0, 30)}${prompt.length > 30 ? '...' : ''}`,
        questions: questions.map(q => ({
          ...q,
          id: Math.random().toString(36).substr(2, 9)
        })) as any
      });
    } catch (err: any) {
      console.error("AI Generation failed:", err);
      toast.error("La génération d'examen a échoué. Veuillez réessayer.");
    } finally {
      setIsGenerating(false);
    }
  };

  const removeQuestion = (idx: number) => {
    if (!generatedExam) return;
    const newQs = [...generatedExam.questions];
    newQs.splice(idx, 1);
    setGeneratedExam({ ...generatedExam, questions: newQs });
  };

  const updateQuestion = (idx: number, field: string, value: any) => {
    if (!generatedExam) return;
    const newQs = [...generatedExam.questions];
    newQs[idx] = { ...newQs[idx], [field]: value };
    setGeneratedExam({ ...generatedExam, questions: newQs });
  };

  const handleSaveExam = async () => {
    if (!generatedExam || !selectedModuleId) return;

    setIsSaving(true);
    try {
      await api.exams.create({
        title: generatedExam.title,
        moduleId: selectedModuleId,
        questions: generatedExam.questions,
        durationMinutes: 60,
        type: 'controle-continu',
        description: `Généré par l'Assistant IA pour le sujet: ${prompt} (${difficulty})`
      });
      toast.success("Examen sauvegardé avec succès en tant que brouillon !");
      onRefresh();
      onSelectTab('exams');
    } catch (err: any) {
      console.error("Failed to save exam:", err);
      toast.error("Erreur lors de la sauvegarde de l'examen.");
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================
  // LOGIC: Tool 2 - Announcement Generator
  // ==========================================
  const handleGenerateAnnounce = async () => {
    if (!announceTopic) return;
    setIsGeneratingAnnounce(true);
    setGeneratedAnnounce(null);

    try {
      const result = await generateAnnouncementAI(announceTopic, announceAudienceText, announceTone);
      setGeneratedAnnounce(result);
    } catch (err: any) {
      console.error("AI Announcement gen failed:", err);
      toast.error("La génération d'annonce a échoué. Veuillez réessayer.");
    } finally {
      setIsGeneratingAnnounce(false);
    }
  };

  const handlePublishAnnounce = async () => {
    if (!generatedAnnounce) return;
    
    if (announceTargetType === 'group' && !selectedGroupId) {
      toast.error("Veuillez choisir une classe cible.");
      return;
    }

    if (announceTargetType === 'filiere' && !selectedFiliereId) {
      toast.error("Veuillez choisir une filière cible.");
      return;
    }

    setIsPublishingAnnounce(true);
    try {
      await api.notifications.create({
        title: generatedAnnounce.title,
        content: generatedAnnounce.content,
        groupId: announceTargetType === 'group' ? selectedGroupId : null,
        filiereId: announceTargetType === 'filiere' ? selectedFiliereId : null,
        audienceRole: announceAudienceRole,
        type: 'announcement',
        isPinned: announceIsPinned,
        importance: generatedAnnounce.importance || 'normal',
      });
      toast.success("L'annonce générée par l'IA a été publiée avec succès !");
      setGeneratedAnnounce(null);
      setAnnounceTopic('');
      onRefresh();
    } catch (err: any) {
      console.error("Failed to publish AI announcement:", err);
      toast.error("Erreur lors de la publication.");
    } finally {
      setIsPublishingAnnounce(false);
    }
  };

  // ==========================================
  // LOGIC: Tool 3 - Study Guide Creator
  // ==========================================
  const handleGenerateGuide = async () => {
    if (!guideTopic) return;
    setIsGeneratingGuide(true);
    setGeneratedGuide(null);

    try {
      const module = modules.find(m => m.id === guideSelectedModuleId);
      const result = await generateStudyGuideAI(module?.name || 'Général', guideTopic);
      setGeneratedGuide(result);
    } catch (err: any) {
      console.error("AI Guide gen failed:", err);
      toast.error("La génération de la fiche synthétique a échoué.");
    } finally {
      setIsGeneratingGuide(false);
    }
  };

  // ==========================================
  // LOGIC: Tool 4 - Rubric / Grille de correction Creator
  // ==========================================
  const handleGenerateRubric = async () => {
    if (!rubricAssignment) return;
    setIsGeneratingRubric(true);
    setGeneratedRubric(null);

    try {
      const result = await generateRubricAI(rubricAssignment, rubricPoints);
      setGeneratedRubric(result);
    } catch (err: any) {
      console.error("AI Rubric gen failed:", err);
      toast.error("La génération de la grille d'évaluation a échoué.");
    } finally {
      setIsGeneratingRubric(false);
    }
  };

  // ==========================================
  // LOGIC: Tool 5 - Practical Certification Generator
  // ==========================================
  const handleGeneratePractical = async () => {
    if (!practicalTopic.trim()) {
      toast.error("Veuillez décrire le sujet technique de l'examen.");
      return;
    }
    setIsGeneratingPractical(true);
    setGeneratedPractical(null);
    try {
      const result = await generatePracticalExamAI(
        practicalVendor,
        practicalCertName,
        practicalTopic,
        practicalPoints,
        practicalDuration
      );
      setGeneratedPractical(result);
      toast.success("La fiche d'examen pratique a été générée avec succès !");
    } catch (err: any) {
      console.error("AI Practical gen failed:", err);
      toast.error("La génération de la fiche pratique a échoué.");
    } finally {
      setIsGeneratingPractical(false);
    }
  };

  const handleSavePractical = async () => {
    if (!generatedPractical || !practicalSelectedModuleId) {
      toast.error("Données invalides ou aucun module sélectionné.");
      return;
    }

    setIsSavingPractical(true);
    try {
      const markdownContent = `
### 🎓 Certification ${generatedPractical.vendor} : ${generatedPractical.certificationName}
**Sujet d'examen :** ${generatedPractical.title}
**Durée de l'épreuve :** ${generatedPractical.durationMinutes} minutes
**Barème total :** ${practicalPoints} points

---

#### 🏢 Scénario d'entreprise & Contexte professionnel
${generatedPractical.scenario}

---

#### ⚙️ Environnement Technique & Prérequis matériels/logiciels
${generatedPractical.requirements.map(req => `- ${req}`).join('\n')}

---

#### 🛠️ Tâches pratiques à réaliser par le candidat
${generatedPractical.tasks.map((task, index) => `
##### Tâche ${index + 1} : ${task.title} (${task.points} points)
*Description :* ${task.description}
*Étapes de réalisation :*
${task.steps.map((step, idx) => `  ${idx + 1}. ${step}`).join('\n')}
`).join('\n')}

---

#### 📊 Critères d'évaluation détaillés & Grille de notation
${generatedPractical.evaluationCriteria.map((crit, index) => `
- **${crit.taskTitle} - ${crit.criteriaName} (${crit.points} points) :**
  *Consignes de correction pour le formateur :* ${crit.guidelines}
`).join('\n')}

---

#### 💡 Conseils de correction de l'examinateur
${generatedPractical.generalTipsForTeacher}
`;

      const mockQuestion: Question = {
        id: Date.now().toString(),
        type: 'practical',
        text: markdownContent,
        points: practicalPoints,
        section: "Évaluation Pratique de Certification",
        correctAnswer: JSON.stringify(generatedPractical)
      };

      await api.exams.create({
        title: generatedPractical.title,
        moduleId: practicalSelectedModuleId,
        questions: [mockQuestion],
        durationMinutes: generatedPractical.durationMinutes,
        type: 'fin-de-module',
        description: `Examen pratique de certification ${generatedPractical.vendor} (${generatedPractical.certificationName}) généré par l'IA.`
      });

      toast.success("Fiche d'examen pratique sauvegardée avec succès en tant que brouillon !");
      await fetchSavedPracticals();
      onRefresh();
      onSelectTab('exams');
    } catch (err: any) {
      console.error("Failed to save practical exam:", err);
      toast.error("Erreur lors de la sauvegarde de l'examen.");
    } finally {
      setIsSavingPractical(false);
    }
  };

  const handleExportPracticalToWord = async () => {
    if (!generatedPractical) return;
    try {
      toast.loading("Génération du sujet Word (.docx) en cours...", { id: "docx-export" });
      await exportPracticalExamToWord(generatedPractical);
      toast.success("Enoncé Word généré avec succès !", { id: "docx-export" });
    } catch (err) {
      console.error(err);
      toast.error("Échec de l'exportation du sujet Word.", { id: "docx-export" });
    }
  };

  const handleExportPracticalSolutionToWord = async () => {
    if (!generatedPractical) return;
    try {
      toast.loading("Génération du corrigé Word (.docx) en cours...", { id: "docx-solution-export" });
      await exportPracticalSolutionToWord(generatedPractical);
      toast.success("Corrigé Word généré avec succès !", { id: "docx-solution-export" });
    } catch (err) {
      console.error(err);
      toast.error("Échec de l'exportation du corrigé Word.", { id: "docx-solution-export" });
    }
  };

  const handleDownloadProvidedFile = async (file: any, asSolution: boolean = false) => {
    try {
      const displayName = asSolution ? `CORRIGE_${file.fileName}` : file.fileName;
      toast.loading(`Téléchargement de ${displayName} en cours...`, { id: "provided-export" });
      await exportProvidedFile(file, asSolution);
      toast.success(`${displayName} téléchargé avec succès !`, { id: "provided-export" });
    } catch (err) {
      console.error(err);
      toast.error(`Échec du téléchargement de ${file.fileName}`, { id: "provided-export" });
    }
  };

  const handleInjectTemplate = (template: PrebuildStarterTemplate) => {
    if (!generatedPractical) return;
    
    const newFile: any = {
      fileName: template.fileName,
      fileType: template.fileType,
      description: template.description,
      contentStructure: template.contentStructure,
      rawContentText: template.rawContentText,
      excelSheets: template.excelSheets
    };

    const alreadyExists = (generatedPractical.providedFiles || []).some(f => f.fileName === template.fileName);
    if (alreadyExists) {
      toast.error(`Le fichier '${template.fileName}' est déjà présent dans cette fiche d'épreuve !`);
      return;
    }

    const updatedFiles = [...(generatedPractical.providedFiles || []), newFile];
    setGeneratedPractical({
      ...generatedPractical,
      providedFiles: updatedFiles
    });
    toast.success(`Le modèle '${template.title}' a été inséré avec succès !`);
  };

  const handleDeleteProvidedFile = (fileName: string) => {
    if (!generatedPractical) return;
    const updatedFiles = (generatedPractical.providedFiles || []).filter(f => f.fileName !== fileName);
    setGeneratedPractical({
      ...generatedPractical,
      providedFiles: updatedFiles
    });
    toast.success(`Fichier '${fileName}' retiré de l'épreuve.`);
  };

  // --- Evaluation Grid Enhancements Handlers ---
  const handleOptimizeRubricWithAI = async () => {
    if (!generatedPractical) return;
    setIsOptimizingRubric(true);
    const toastId = toast.loading("Audit de la grille par l'IA et optimisation des critères...", { id: "optimizing-rubric" });
    try {
      const optimized = await optimizePracticalExamRubricsAI(generatedPractical);
      if (optimized && optimized.length > 0) {
        setGeneratedPractical({
          ...generatedPractical,
          evaluationCriteria: optimized
        });
        // Clear ratings to avoid offset mismatch
        setAssignedPoints({});
        setStudentFeedbackText('');
        toast.success("Grille de correction enrichie et optimisée avec succès !", { id: toastId });
      } else {
        toast.error("L'optimisation n'a pas retourné de critère valide.", { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'optimisation de la grille de correction.", { id: toastId });
    } finally {
      setIsOptimizingRubric(false);
    }
  };

  const handleGenerateStudentFeedbackWithAI = async () => {
    if (!generatedPractical) return;
    if (!candidateName.trim()) {
      toast.error("Veuillez saisir le nom du candidat pour générer un feedback.");
      return;
    }
    setIsGeneratingFeedback(true);
    const toastId = toast.loading(`Génération du feedback personnalisé pour ${candidateName}...`, { id: "generating-feedback" });
    try {
      const totalPoints = generatedPractical.evaluationCriteria.reduce((sum, c) => sum + (c.points > 0 ? c.points : 0), 0);
      const score = generatedPractical.evaluationCriteria.reduce((sum, c, idx) => {
        const pts = assignedPoints[idx] !== undefined ? assignedPoints[idx] : (c.points > 0 ? c.points : 0);
        return sum + pts;
      }, 0);
      
      const criteriaResults = generatedPractical.evaluationCriteria.map((c, idx) => ({
        criteriaName: c.criteriaName,
        maxPoints: c.points,
        pointsAwarded: assignedPoints[idx] !== undefined ? assignedPoints[idx] : (c.points > 0 ? c.points : 0),
        guidelines: c.guidelines
      }));

      const feedback = await generateCandidatePracticalFeedbackAI(
        generatedPractical.title,
        totalPoints,
        candidateName,
        candidateGroup || "Général",
        score,
        criteriaResults
      );

      setStudentFeedbackText(feedback);
      toast.success("Feedback candidat généré avec succès !", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la génération du feedback.", { id: toastId });
    } finally {
      setIsGeneratingFeedback(false);
    }
  };

  const handleStartEditingCriterion = (index: number) => {
    const crit = generatedPractical?.evaluationCriteria[index];
    if (!crit) return;
    setEditingCriterionIndex(index);
    setEditingCriterion({ ...crit });
  };

  const handleSaveEditedCriterion = () => {
    if (!generatedPractical || editingCriterionIndex === null || !editingCriterion) return;
    
    const updatedCriteria = [...generatedPractical.evaluationCriteria];
    updatedCriteria[editingCriterionIndex] = { ...editingCriterion };

    setGeneratedPractical({
      ...generatedPractical,
      evaluationCriteria: updatedCriteria
    });
    
    setEditingCriterionIndex(null);
    setEditingCriterion(null);
    toast.success("Critère de correction mis à jour.");
  };

  const handleStartAddingCriterion = () => {
    if (!generatedPractical) return;
    setIsAddingCriterion(true);
    setNewCriterion({
      taskTitle: generatedPractical.tasks[0]?.title || 'Tâche Générale',
      criteriaName: '',
      points: 5,
      guidelines: ''
    });
  };

  const handleSubmitNewCriterion = () => {
    if (!generatedPractical) return;
    if (!newCriterion.criteriaName.trim()) {
      toast.error("Le nom du critère ne peut pas être vide.");
      return;
    }

    const updatedCriteria = [...(generatedPractical.evaluationCriteria || []), { ...newCriterion }];
    setGeneratedPractical({
      ...generatedPractical,
      evaluationCriteria: updatedCriteria
    });

    setIsAddingCriterion(false);
    toast.success("Nouveau critère inséré avec succès !");
  };

  const handleDeleteCriterion = (index: number) => {
    if (!generatedPractical) return;
    const updatedCriteria = (generatedPractical.evaluationCriteria || []).filter((_, i) => i !== index);
    
    const newAssigned = { ...assignedPoints };
    delete newAssigned[index];
    setAssignedPoints(newAssigned);

    setGeneratedPractical({
      ...generatedPractical,
      evaluationCriteria: updatedCriteria
    });
    toast.success("Critère retiré de la grille.");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 px-4 sm:px-6">
      {/* Visual Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-200">
            <Sparkles className="w-7 h-7 animate-pulse" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 font-serif italic tracking-tight">
              Automatisation & Productivité
            </h2>
            <p className="text-slate-500 font-bold text-sm">
              L'IA Pédagogique au service du temps et de la clarté des formateurs.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation of Automation tools */}
      <div className="flex flex-wrap items-center bg-slate-100 p-1.5 rounded-2xl gap-1">
        <button
          onClick={() => setActiveTool('exams')}
          className={cn(
            "flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
            activeTool === 'exams' 
              ? "bg-white text-indigo-700 shadow-md font-extrabold" 
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          )}
        >
          <BrainCircuit className="w-4 h-4" />
          Conception d'Examens
        </button>

        <button
          onClick={() => setActiveTool('announcements')}
          className={cn(
            "flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
            activeTool === 'announcements' 
              ? "bg-white text-indigo-700 shadow-md font-extrabold" 
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          )}
        >
          <Bell className="w-4 h-4" />
          Création d'Annonces
        </button>

        <button
          onClick={() => setActiveTool('guides')}
          className={cn(
            "flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
            activeTool === 'guides' 
              ? "bg-white text-indigo-700 shadow-md font-extrabold" 
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          )}
        >
          <BookOpen className="w-4 h-4" />
          Fiches de Synthèse
        </button>

        <button
          onClick={() => setActiveTool('rubrics')}
          className={cn(
            "flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
            activeTool === 'rubrics' 
              ? "bg-white text-indigo-700 shadow-md font-extrabold" 
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          )}
        >
          <CheckSquare className="w-4 h-4" />
          Grilles de Correction
        </button>

        <button
          onClick={() => setActiveTool('practicals')}
          className={cn(
            "flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
            activeTool === 'practicals' 
              ? "bg-white text-indigo-700 shadow-md font-extrabold" 
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          )}
        >
          <Award className="w-4 h-4" />
          Fiches Pratiques
        </button>
      </div>

      {/* Main Container based on activeTool */}
      <div className="space-y-8">
        
        {/* ======================================================== */}
        {/* TAB 1: EXAM GENERATOR                                    */}
        {/* ======================================================== */}
        {activeTool === 'exams' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <Card className="p-8 border-none shadow-2xl shadow-slate-200/50 bg-slate-900 text-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-indigo-500/20 transition-all duration-1000" />
              
              <div className="relative z-10 space-y-6">
                <div className="space-y-2">
                  <span className="text-[10px] bg-indigo-600/50 text-indigo-100 font-black px-3 py-1 rounded-full uppercase tracking-widest leading-none">
                    Option d'Évaluation automatique
                  </span>
                  <h3 className="text-xl font-black tracking-tight">Super-Générateur d'Épreuves d'Examen</h3>
                  <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-3xl">
                    Soumettez un résumé de cours, des concepts clés ou importez la thématique. L'IA planifie et compose une épreuve complète de 10 questions (QCM, Vrai/Faux, Réponse Courte) calibrée selon la difficulté souhaitée.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] ml-1">Module académique cible</label>
                    <select 
                      value={selectedModuleId} 
                      onChange={(e) => setSelectedModuleId(Number(e.target.value))}
                      className="w-full h-14 px-5 bg-white/5 border-2 border-white/10 rounded-xl text-white font-bold outline-none focus:border-indigo-500/50 transition-all appearance-none"
                    >
                      {modules.map(m => <option key={m.id} value={m.id} className="text-slate-900 font-bold">{m.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] ml-1">Difficulté calibrée</label>
                    <select 
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                      className="w-full h-14 px-5 bg-white/5 border-2 border-white/10 rounded-xl text-white font-bold outline-none focus:border-indigo-500/50 transition-all appearance-none"
                    >
                      <option value="Fondamental" className="text-slate-900 font-bold">Fondamental (Facile / Entrée)</option>
                      <option value="Standard" className="text-slate-900 font-bold">Standard (Niveau Intermédiaire)</option>
                      <option value="Avancé" className="text-slate-900 font-bold">Avancé (Difficile / Expert)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] ml-1">Concepts clés à évaluer</label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Exprimez le sujet en détails: ex: Le protocole HTTP, requêtes GET/POST, codes de statut et architecture REST, ou collez directement des paragraphes de cours..."
                    className="w-full min-h-[120px] p-5 bg-white/5 border-2 border-white/10 rounded-2xl text-white placeholder-slate-500 font-medium outline-none focus:border-indigo-500/50 transition-all resize-none"
                  />
                </div>

                <Button 
                  onClick={handleGenerateExam}
                  disabled={isGenerating || !prompt}
                  className="w-full py-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm uppercase tracking-widest gap-2 shadow-xl shadow-indigo-950 border-none"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Génération intelligente en cours...
                    </>
                  ) : (
                    <>
                      <BrainCircuit className="w-5 h-5" />
                      Lancer la génération de l'épreuve
                    </>
                  )}
                </Button>
              </div>
            </Card>

            {/* Generated Results Panel */}
            <AnimatePresence>
              {generatedExam && (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-lg">Projet d'Épreuve : {generatedExam.title}</h4>
                      <p className="text-xs text-slate-400 font-bold">{generatedExam.questions.length} questions prêtes à révision.</p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button variant="outline" onClick={() => setGeneratedExam(null)} className="flex-1 sm:flex-initial py-3 text-xs bg-white rounded-xl">Recommencer</Button>
                      <Button onClick={handleSaveExam} disabled={isSaving} className="flex-1 sm:flex-initial py-3 text-xs bg-emerald-600 hover:bg-emerald-500 select-none rounded-xl">
                        {isSaving ? "Sauvegarde..." : "Enregistrer et publier"}
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {generatedExam.questions.map((q, idx) => (
                      <Card key={idx} className="p-5 border-2 border-slate-100 hover:border-indigo-100 transition-all duration-300 rounded-2xl space-y-4 group/q">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2.5 py-1 rounded-[0.5rem] uppercase tracking-widest">Question {idx + 1}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded">{q.type}</span>
                            <button 
                              type="button"
                              onClick={() => removeQuestion(idx)}
                              className="p-1 text-slate-300 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 rounded transition-all"
                              title="Retirer cette question"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <textarea 
                          value={q.text || ''}
                          onChange={(e) => updateQuestion(idx, 'text', e.target.value)}
                          className="w-full bg-transparent font-bold text-slate-800 text-sm leading-relaxed border-none focus:ring-0 p-0 resize-none"
                          rows={2}
                        />
                        {q.options && (
                          <div className="space-y-2">
                            {q.options.map((opt, i) => {
                              const isCorrect = typeof opt === 'string' ? opt === q.correctAnswer : (opt as any).isCorrect;
                              const text = typeof opt === 'string' ? opt : (opt as any).text;
                              return (
                                <div key={i} className={cn(
                                  "text-xs p-3 rounded-xl border-2 font-bold transition-all",
                                  isCorrect 
                                    ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
                                    : "bg-slate-50 border-slate-100 text-slate-600"
                                )}>
                                  <span className="mr-2 opacity-50">{String.fromCharCode(65 + i)})</span>
                                  {text}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: ANNOUNCEMENT GENERATOR                             */}
        {/* ======================================================== */}
        {activeTool === 'announcements' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Creator control panel */}
              <div className="lg:col-span-5 space-y-6">
                <Card className="p-6 border-none shadow-xl shadow-slate-200/40 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-base">Rédacteur d'Annonces IA</h4>
                      <p className="text-[11px] text-slate-400 font-bold">Structurez un message de classe en 3 secondes.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sujet / Consignes du message</label>
                    <textarea
                      value={announceTopic}
                      onChange={(e) => setAnnounceTopic(e.target.value)}
                      placeholder="Ex: Rappeler de ramener les ordinateurs demain pour les TP de DevOps, mentionner les dates clés..."
                      className="w-full h-24 p-4 bg-slate-50 border-2 border-slate-100 rounded-xl text-slate-700 placeholder-slate-400 font-bold text-xs focus:border-indigo-500 transition-all outline-none resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Ton attendu</label>
                      <select
                        value={announceTone}
                        onChange={(e) => setAnnounceTone(e.target.value)}
                        className="w-full px-3 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 appearance-none"
                      >
                        <option value="Académique & Professionnel">Professionnel</option>
                        <option value="Motivant & Chaleureux">Motivant / Fun</option>
                        <option value="Vigilant / Alerte Urgente">Alerte urgente</option>
                        <option value="Minimaliste Strict">Minimaliste</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Qui est ciblé ?</label>
                      <select
                        value={currentAudienceKey}
                        onChange={(e) => handleAudienceChange(e.target.value)}
                        className="w-full h-11 px-3 py-2 rounded-xl bg-slate-50 border-2 border-slate-100 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 appearance-none selection:font-bold"
                      >
                        <optgroup label="Global / Général">
                          <option value="global:students">Tous les étudiants</option>
                          <option value="global:teachers">Tous les formateurs</option>
                          <option value="global:all">Tout l'établissement (Élèves & Profs)</option>
                        </optgroup>

                        {filieres && filieres.length > 0 && (
                          <optgroup label="Par Filière">
                            {filieres.map(f => (
                              <option key={f.id} value={`filiere:${f.id}`}>Filière : {f.name}</option>
                            ))}
                          </optgroup>
                        )}

                        {groups && groups.length > 0 && (
                          <optgroup label="Par Classe / Groupe">
                            {groups.map(g => (
                              <option key={g.id} value={`group:${g.id}`}>Classe : {g.name}</option>
                            ))}
                          </optgroup>
                        )}

                        <optgroup label="Autre">
                          <option value="custom">Saisie personnalisée...</option>
                        </optgroup>
                      </select>

                      {isCustomAudience && (
                        <input
                          type="text"
                          value={announceAudienceText}
                          onChange={(e) => setAnnounceAudienceText(e.target.value)}
                          placeholder="Spécifiez qui est visé (ex: Étudiants en retard)"
                          className="w-full px-3 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 animate-in slide-in-from-top-1 duration-150"
                        />
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={handleGenerateAnnounce}
                    disabled={isGeneratingAnnounce || !announceTopic}
                    className="w-full py-4 rounded-xl text-xs uppercase tracking-widest font-black bg-indigo-600 hover:bg-indigo-500 text-white gap-2"
                  >
                    {isGeneratingAnnounce ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Rédaction par l'IA...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Rédiger l'annonce
                      </>
                    )}
                  </Button>
                </Card>

                {/* Target setup panel visible only once announcement is ready */}
                {generatedAnnounce && (
                  <Card className="p-6 border-none shadow-xl shadow-slate-200/40 space-y-5 animate-in slide-in-from-bottom duration-300">
                    <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-widest text-indigo-600">Périmètre et Publication</h5>
                    
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Diffusion</label>
                      <div className="grid grid-cols-3 gap-1 bg-slate-100 p-0.5 rounded-lg">
                        {(['global', 'filiere', 'group'] as const).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setAnnounceTargetType(type)}
                            className={cn(
                              "py-1.5 text-[9px] font-black rounded uppercase tracking-wider transition-all",
                              announceTargetType === type ? "bg-white text-indigo-700 font-extrabold shadow-sm" : "text-slate-500"
                            )}
                          >
                            {type === 'global' ? 'Tous' : type === 'filiere' ? 'Filière' : 'Classe'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {announceTargetType === 'filiere' && (
                      <div className="space-y-1">
                        <select
                          value={selectedFiliereId}
                          onChange={(e) => setSelectedFiliereId(Number(e.target.value))}
                          className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold text-slate-700 focus:border-indigo-500 outline-none"
                        >
                          <option value="">-- Choisir la Filière --</option>
                          {filieres.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {announceTargetType === 'group' && (
                      <div className="space-y-1">
                        <select
                          value={selectedGroupId}
                          onChange={(e) => setSelectedGroupId(Number(e.target.value))}
                          className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold text-slate-700 focus:border-indigo-500 outline-none"
                        >
                          <option value="">-- Choisir la Classe --</option>
                          {groups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Audience Rôle</label>
                        <select
                          value={announceAudienceRole}
                          onChange={(e) => setAnnounceAudienceRole(e.target.value as any)}
                          className="w-full p-2.5 rounded-xl bg-slate-50 border-2 border-slate-100 text-[10px] font-bold text-slate-700 focus:border-indigo-500 outline-none"
                        >
                          <option value="all">Élèves & Profs</option>
                          <option value="students">Élèves SEUL</option>
                          <option value="teachers">Profs SEUL</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Épingler</label>
                        <button
                          type="button"
                          onClick={() => setAnnounceIsPinned(!announceIsPinned)}
                          className={cn(
                            "w-full p-2 rounded-xl text-[10px] font-black uppercase border-2 transition-all flex items-center justify-center gap-1.5",
                            announceIsPinned ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-slate-50 border-slate-100 text-slate-400"
                          )}
                        >
                          <Pin className="w-3.5 h-3.5" />
                          {announceIsPinned ? 'Épinglé' : 'Non'}
                        </button>
                      </div>
                    </div>

                    <Button
                      onClick={handlePublishAnnounce}
                      disabled={isPublishingAnnounce}
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-100"
                    >
                      {isPublishingAnnounce ? 'Publication...' : 'Publier immédiatement'}
                    </Button>
                  </Card>
                )}
              </div>

              {/* Display & Review Generated Block */}
              <div className="lg:col-span-7">
                <Card className="h-full border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center p-8 bg-slate-50 min-h-[350px]">
                  {generatedAnnounce ? (
                    <div className="w-full h-full space-y-6 flex flex-col justify-between animate-in fade-in duration-300">
                      <div className="flex items-center justify-between border-b pb-4">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-[0.5rem] border",
                            generatedAnnounce.importance === 'high' 
                              ? "bg-rose-50 border-rose-100 text-rose-700"
                              : generatedAnnounce.importance === 'low'
                                ? "bg-slate-100 border-slate-200 text-slate-500"
                                : "bg-indigo-50 border-indigo-100 text-indigo-700"
                          )}>
                            Urgence: {generatedAnnounce.importance === 'high' ? 'Haute' : generatedAnnounce.importance === 'low' ? 'Basse' : 'Normale'}
                          </span>
                        </div>
                        <button
                          onClick={() => handleCopyToClipboard(generatedAnnounce.content, 'announce')}
                          className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          {copiedText === 'announce' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              Copié !
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copier le corps
                            </>
                          )}
                        </button>
                      </div>

                      <div className="space-y-4 flex-1">
                        <h4 className="text-xl font-black text-slate-800 leading-tight">
                          {generatedAnnounce.title}
                        </h4>
                        
                        <div 
                          className="text-slate-600 text-sm leading-relaxed prose prose-indigo max-w-none prose-sm"
                          dangerouslySetInnerHTML={{ __html: generatedAnnounce.content }}
                        />
                      </div>

                      <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-100 flex items-start gap-2.5 text-xs text-amber-800 font-bold">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <p>L'IA a rédigé le texte ci-dessus sous format HTML riche (italiques, gras, puces). Vous pouvez directement réajuster les critères de distribution à gauche avant de le diffuser.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-3">
                      <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto">
                        <Bell className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-extrabold text-slate-700 text-sm">Prêt pour la création d'annonces</p>
                        <p className="text-xs text-slate-400 max-w-sm mt-1">Renseignez les directives à gauche et laissez l'IA formuler un communiqué clair et esthétique.</p>
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: COURSE SYNTHESIS FIHES                             */}
        {/* ======================================================== */}
        {activeTool === 'guides' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Controls */}
              <div className="lg:col-span-4 space-y-6">
                <Card className="p-6 border-none shadow-xl shadow-slate-200/40 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-base">Générateur de Fiches de Réduction</h4>
                      <p className="text-[11px] text-slate-400 font-bold">Créez des feuilles d'études et mémos capitaux.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Module académique</label>
                    <select 
                      value={guideSelectedModuleId} 
                      onChange={(e) => setGuideSelectedModuleId(Number(e.target.value))}
                      className="w-full p-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold text-slate-700 focus:border-indigo-500 outline-none"
                    >
                      {modules.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Sujet de leçon / Concepts à mémoriser</label>
                    <textarea
                      value={guideTopic}
                      onChange={(e) => setGuideTopic(e.target.value)}
                      placeholder="Ex: Le cycle de vie des requêtes TCP, de la résolution DNS au handshake à trois voies..."
                      className="w-full h-28 p-4 bg-slate-50 border-2 border-slate-100 rounded-xl text-slate-700 placeholder-slate-400 font-bold text-xs focus:border-indigo-500 transition-all outline-none resize-none"
                    />
                  </div>

                  <Button
                    onClick={handleGenerateGuide}
                    disabled={isGeneratingGuide || !guideTopic}
                    className="w-full py-4 text-xs uppercase tracking-widest font-black bg-indigo-600 hover:bg-indigo-500 text-white gap-2 shadow"
                  >
                    {isGeneratingGuide ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Confection de la fiche...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Générer la Fiche Guide
                      </>
                    )}
                  </Button>
                </Card>
              </div>

              {/* Study Fiche Guide display */}
              <div className="lg:col-span-8">
                {generatedGuide ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    {/* Header bar */}
                    <Card className="p-6 border-none shadow-xl shadow-indigo-50/50 bg-indigo-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <span className="text-[9px] bg-white/15 px-2.5 py-1 rounded-[0.5rem] font-black uppercase tracking-widest">Générateur intelligent</span>
                        <h4 className="text-xl font-black mt-1 italic tracking-tight">{generatedGuide.title}</h4>
                      </div>
                      <button
                        onClick={() => {
                          const markdownPayload = `# ${generatedGuide.title}\n\n` + 
                            generatedGuide.sections.map(s => `## ${s.subtitle}\n${s.markdownContent}`).join('\n\n') + 
                            `\n\n## Points Clés à Retenir (Takeaways)\n` + 
                            generatedGuide.keyTakeaways.map(t => `- ${t}`).join('\n');
                          handleCopyToClipboard(markdownPayload, 'full-guide');
                        }}
                        className="flex items-center gap-1 bg-white hover:bg-slate-50 text-indigo-950 font-black text-[10px] px-4 py-2.5 rounded-xl uppercase tracking-wider transition-colors"
                      >
                        {copiedText === 'full-guide' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            Guide Copié !
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copier au format Markdown
                          </>
                        )}
                      </button>
                    </Card>

                    {/* Left takeaways, right content structured */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                      <div className="md:col-span-4 space-y-4">
                        <Card className="p-5 border-none shadow-lg bg-amber-50/60 border-l-4 border-l-amber-500 rounded-2xl space-y-3">
                          <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-widest flex items-center gap-1.5">
                            <Target className="w-4 h-4 text-amber-500" />
                            Takeaways (Mémento)
                          </h5>
                          <ul className="space-y-2">
                            {generatedGuide.keyTakeaways.map((point, i) => (
                              <li key={i} className="text-[11px] leading-relaxed text-slate-700 font-bold list-disc ml-3.5">
                                {point}
                              </li>
                            ))}
                          </ul>
                        </Card>
                      </div>

                      <div className="md:col-span-8 space-y-4">
                        {generatedGuide.sections.map((sec, sIdx) => (
                          <Card key={sIdx} className="p-6 border-none shadow-xl shadow-slate-200/40 space-y-3">
                            <div className="flex items-center justify-between border-b pb-2 border-slate-50">
                              <h5 className="font-extrabold text-slate-800 text-sm">{sec.subtitle}</h5>
                              <button
                                onClick={() => handleCopyToClipboard(sec.markdownContent, `sec-${sIdx}`)}
                                className="text-slate-300 hover:text-indigo-600 transition-colors p-1"
                                title="Copier cette section"
                              >
                                {copiedText === `sec-${sIdx}` ? (
                                  <Check className="w-4 h-4 text-emerald-500" />
                                ) : (
                                  <Copy className="w-4.5 h-4.5" />
                                )}
                              </button>
                            </div>
                            <pre className="text-xs text-slate-600 leading-relaxed font-sans whitespace-pre-wrap break-words">
                              {sec.markdownContent}
                            </pre>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <Card className="h-full border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center p-8 bg-slate-50 min-h-[350px]">
                    <div className="text-center space-y-3">
                      <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-extrabold text-slate-700 text-sm">Prût pour la modélisation de Fiches</p>
                        <p className="text-xs text-slate-400 max-w-sm mt-1">Générez des supports synthétiques et explications pédagogiques claires structurées en Markdown d'un simple clic.</p>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: RUBRIC / CRITERIA GENERATOR                       */}
        {/* ======================================================== */}
        {activeTool === 'rubrics' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Controls */}
              <div className="lg:col-span-5 space-y-6">
                <Card className="p-6 border-none shadow-xl shadow-slate-200/40 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
                      <CheckSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-base">Barèmes & Rubrics Pédagogiques</h4>
                      <p className="text-[11px] text-slate-400 font-bold">Automatisez la découpe et les critères de notation.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Description courte du devoir/projet à noter</label>
                    <textarea
                      value={rubricAssignment}
                      onChange={(e) => setRubricAssignment(e.target.value)}
                      placeholder="Ex: Projet Pratique d'Intégration HTML/CSS. Maquette Responsive complexe multi-pages. Utilisation obligatoire des grilles CSS, flexbox, variables et formulaires d'expédition..."
                      className="w-full h-28 p-4 bg-slate-50 border-2 border-slate-100 rounded-xl text-slate-700 placeholder-slate-400 font-bold text-xs focus:border-indigo-500 transition-all outline-none resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Barème global (Points maximum)</label>
                    <div className="flex items-center gap-4 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <input 
                        type="range" 
                        min="5" 
                        max="100" 
                        step="5" 
                        value={rubricPoints} 
                        onChange={(e) => setRubricPoints(Number(e.target.value))}
                        className="flex-1 accent-indigo-600"
                      />
                      <span className="font-extrabold text-slate-800 text-sm bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg">{rubricPoints} pts</span>
                    </div>
                  </div>

                  <Button
                    onClick={handleGenerateRubric}
                    disabled={isGeneratingRubric || !rubricAssignment}
                    className="w-full py-4 text-xs uppercase tracking-widest font-black bg-indigo-600 hover:bg-indigo-500 text-white gap-2 shadow"
                  >
                    {isGeneratingRubric ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Calcul de la grille...
                      </>
                    ) : (
                      <>
                        <Award className="w-4 h-4" />
                        Générer la Rubric IA
                      </>
                    )}
                  </Button>
                </Card>
              </div>

              {/* Rubric display */}
              <div className="lg:col-span-7">
                {generatedRubric ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-5"
                  >
                    <div className="flex items-center justify-between bg-white p-4 rounded-xl border-2 border-slate-100/60 shadow-sm">
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-base">{generatedRubric.title}</h4>
                        <p className="text-[10px] text-slate-400 font-bold">Total: {generatedRubric.criteriaList.reduce((acc, c) => acc + c.maxPoints, 0)} points attribués.</p>
                      </div>
                      
                      <button
                        onClick={() => {
                          const rubPayload = `### ${generatedRubric.title}\n\n` + 
                            generatedRubric.criteriaList.map(c => `#### ${c.criteriaName} (${c.maxPoints} pts)\n${c.description}`).join('\n\n') + 
                            `\n\n**Conseil d'évaluation:** ${generatedRubric.tips}`;
                          handleCopyToClipboard(rubPayload, 'full-rubric');
                        }}
                        className="flex items-center gap-1 text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800 transition-colors"
                      >
                        {copiedText === 'full-rubric' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            Copié !
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copier la grille
                          </>
                        )}
                      </button>
                    </div>

                    <div className="space-y-4">
                      {generatedRubric.criteriaList.map((crit, cIdx) => (
                        <Card key={cIdx} className="p-5 border-none shadow-xl shadow-slate-200/40 relative overflow-hidden flex items-start justify-between gap-4">
                          <div className="space-y-1 flex-1">
                            <h5 className="font-extrabold text-slate-800 text-sm">{crit.criteriaName}</h5>
                            <p className="text-xs text-slate-500 font-medium leading-relaxed">{crit.description}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-black text-xs px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700">
                              /{crit.maxPoints} pts
                            </span>
                          </div>
                        </Card>
                      ))}
                    </div>

                    {generatedRubric.tips && (
                      <Card className="p-4 border-none shadow-lg bg-indigo-950 text-indigo-200 text-xs font-bold leading-relaxed flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-black text-indigo-100 text-xs uppercase tracking-wider mb-0.5">Note de l'inspecteur académique :</p>
                          <p className="opacity-90">{generatedRubric.tips}</p>
                        </div>
                      </Card>
                    )}
                  </motion.div>
                ) : (
                  <Card className="h-full border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center p-8 bg-slate-50 min-h-[350px]">
                    <div className="text-center space-y-3">
                      <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto">
                        <CheckSquare className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-extrabold text-slate-700 text-sm">Prêt pour la découpe de barèmes</p>
                        <p className="text-xs text-slate-400 max-w-sm mt-1">Écrivez les consignes d'un travail à corriger pour que l'IA distribue équitablement les points sur des critères clairs.</p>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 5: CERTIFICATION PRACTICAL EXAMS                     */}
        {/* ======================================================== */}
        {activeTool === 'practicals' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              
              {/* Left Side: Parameters Form */}
              <div className="xl:col-span-4 space-y-6">
                <Card className="p-6 border border-slate-100 shadow-xl rounded-[2rem] space-y-6">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-base">Fiches Pratiques de Certification</h4>
                    <p className="text-xs text-slate-400 mt-1 font-bold">Configurez les paramètres de certification.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Vendeur / Constructeur</label>
                      <select 
                        value={practicalVendor} 
                        onChange={(e) => {
                          setPracticalVendor(e.target.value);
                          if (e.target.value === 'Cisco') setPracticalCertName('CCNA Routing & Switching');
                          else if (e.target.value === 'Microsoft') setPracticalCertName('AZ-104 Azure Administrator');
                          else if (e.target.value === 'Microsoft Office') setPracticalCertName('MOS Excel Associate');
                          else if (e.target.value === 'AWS') setPracticalCertName('AWS Cloud Practitioner');
                          else setPracticalCertName('Certification Professionnelle');
                        }}
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-xl text-xs font-bold transition-all outline-none"
                      >
                        <option value="Microsoft Office">Microsoft Office (MOS)</option>
                        <option value="Cisco">Cisco Systems</option>
                        <option value="Microsoft">Microsoft Certification (Azure/Admin)</option>
                        <option value="AWS">Amazon Web Services (AWS)</option>
                        <option value="VMware">VMware</option>
                        <option value="CompTIA">CompTIA</option>
                        <option value="Autre">Autre Constructeur</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nom de la Certification</label>
                      <Input 
                        value={practicalCertName} 
                        onChange={(e) => setPracticalCertName(e.target.value)} 
                        placeholder="Ex: Cisco CCNA, MOS Word, AWS Architect..."
                        className="bg-slate-50 border-2 transition-all text-xs font-bold py-3.5"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Module Académique de rattachement</label>
                      <select 
                        value={practicalSelectedModuleId} 
                        onChange={(e) => setPracticalSelectedModuleId(Number(e.target.value))}
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-xl text-xs font-bold transition-all outline-none"
                      >
                        {modules.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Barème total</label>
                        <select 
                          value={practicalPoints} 
                          onChange={(e) => setPracticalPoints(Number(e.target.value))}
                          className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-xl text-xs font-bold transition-all outline-none"
                        >
                          <option value="20">20 Points</option>
                          <option value="40">40 Points</option>
                          <option value="100">100 Points</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Durée (Min)</label>
                        <select 
                          value={practicalDuration} 
                          onChange={(e) => setPracticalDuration(Number(e.target.value))}
                          className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-xl text-xs font-bold transition-all outline-none"
                        >
                          <option value="45">45 Minutes</option>
                          <option value="60">60 Minutes</option>
                          <option value="90">90 Minutes</option>
                          <option value="120">120 Minutes</option>
                          <option value="180">180 Minutes</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Sujet / Consignes techniques</label>
                        <span className="text-[8px] uppercase tracking-widest text-indigo-500 font-extrabold font-sans">Recommandé</span>
                      </div>
                      <textarea 
                        value={practicalTopic} 
                        onChange={(e) => setPracticalTopic(e.target.value)} 
                        rows={5}
                        placeholder="Ex: Configuration de l'adressage IP, création de VLANs 10 (Ventes) et 20 (R&D), configuration de Trunking 802.1Q et du routage inter-VLAN sur un routeur Cisco 2911."
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-2xl text-xs font-bold transition-all outline-none resize-none font-sans"
                      />
                    </div>

                    <div className="pt-2">
                      <Button 
                        onClick={handleGeneratePractical}
                        disabled={isGeneratingPractical || !practicalTopic.trim()}
                        className="w-full py-4 text-xs font-black uppercase tracking-widest gap-2 shadow-lg"
                      >
                        {isGeneratingPractical ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            Génération en cours...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-white" />
                            Générer la Fiche IA
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Pre-made Templates shortcuts */}
                    <div className="pt-4 border-t border-slate-100">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 pl-1">Exemples populaires</span>
                      <div className="grid grid-cols-1 gap-1.5">
                        <button 
                          onClick={() => {
                            setPracticalVendor('Microsoft Office');
                            setPracticalCertName('MOS Excel Associate');
                            setPracticalTopic('Conception d\'un tableau de bord de ventes mensuel avec calcul de marges, fonctions d\'agrégation SUMIFS et AVERAGEIFS, et graphiques de tendances.');
                          }}
                          className="text-left p-2.5 rounded-xl hover:bg-slate-50 border border-slate-100 transition-all text-[10px] font-bold text-slate-700 flex items-center justify-between"
                        >
                          <span>MOS Excel : Tableau de bord</span>
                          <span className="text-[8px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-black uppercase">Excel</span>
                        </button>
                        <button 
                          onClick={() => {
                            setPracticalVendor('Cisco');
                            setPracticalCertName('CCNA Enterprise');
                            setPracticalTopic('Configuration d\'un routage OSPFv2 single-area sur 3 routeurs Cisco, assignation d\'adresses IPv4 d\'interfaces et vérification de la table de routage.');
                          }}
                          className="text-left p-2.5 rounded-xl hover:bg-slate-50 border border-slate-100 transition-all text-[10px] font-bold text-slate-700 flex items-center justify-between"
                        >
                          <span>Cisco CCNA : OSPF Routing</span>
                          <span className="text-[8px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-black uppercase">Réseau</span>
                        </button>
                        <button 
                          onClick={() => {
                            setPracticalVendor('Microsoft');
                            setPracticalCertName('AZ-104 Azure Administrator');
                            setPracticalTopic('Déploiement d\'une machine virtuelle Linux avec son réseau virtuel (VNet), son groupe de sécurité réseau (NSG) et l\'ouverture du port HTTP 80.');
                          }}
                          className="text-left p-2.5 rounded-xl hover:bg-slate-50 border border-slate-100 transition-all text-[10px] font-bold text-slate-700 flex items-center justify-between"
                        >
                          <span>Azure AZ-104 : VM Deployment</span>
                          <span className="text-[8px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-black uppercase">Cloud</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Saved/Locked Practical sheets Library */}
                <Card className="p-6 border border-slate-100 shadow-xl rounded-[2rem] space-y-4">
                  <div className="flex items-center justify-between border-b pb-2 border-slate-100">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                        <ClipboardList className="w-4.5 h-4.5 text-indigo-500" />
                        Fiches Pratiques Enregistrées
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-bold">Consultez et rechargez vos fiches.</p>
                    </div>
                    {savedPracticals.length > 0 && (
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-2.5 py-0.5 rounded-full">
                        {savedPracticals.length}
                      </span>
                    )}
                  </div>

                  {isLoadingSavedPracticals ? (
                    <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                      <span className="text-[10px] font-bold">Chargement des fiches...</span>
                    </div>
                  ) : savedPracticals.length === 0 ? (
                    <div className="py-8 text-center text-slate-400">
                      <p className="text-xs font-medium leading-relaxed">Aucune fiche pratique sauvegardée pour le moment.</p>
                      <p className="text-[10px] text-slate-300 mt-1">Générez une fiche pratique à droite et cliquez sur "Enregistrer" pour la stocker ici durablement.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                      {savedPracticals.map((ex) => {
                        const moduleName = modules.find(m => m.id === ex.moduleId)?.name || `Module ${ex.moduleId}`;
                        return (
                          <div 
                            key={ex.id}
                            onClick={() => handleLoadPractical(ex)}
                            className="p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-indigo-100 cursor-pointer transition-all flex items-start justify-between gap-3 group/item relative"
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <h5 className="font-extrabold text-slate-700 text-[11px] leading-tight truncate group-hover/item:text-indigo-600 transition-colors">
                                {ex.title}
                              </h5>
                              <div className="flex items-center gap-2 text-[9px] text-slate-400 font-bold truncate">
                                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded truncate max-w-[120px]">
                                  {moduleName}
                                </span>
                                <span>{ex.durationMinutes} Min</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={(e) => handleDeletePractical(ex.id, e)}
                                className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover/item:opacity-100 focus:opacity-100"
                                title="Supprimer la fiche"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </div>

              {/* Right Side: Display & Action Fiche */}
              <div className="xl:col-span-8 flex flex-col h-full">
                {generatedPractical ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-4"
                  >
                    {/* View Mode Switcher Segmented Pills */}
                    <div className="flex items-center justify-between p-1.5 bg-slate-100 rounded-2xl border border-slate-200/60 font-sans shadow-sm select-none">
                      <div className="flex items-center gap-1.5 w-full">
                        <button
                          type="button"
                          onClick={() => setPracticalViewFilter('candidate')}
                          className={cn(
                            "flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2",
                            practicalViewFilter === 'candidate'
                              ? "bg-white text-indigo-700 shadow-sm border border-slate-200/20"
                              : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
                          )}
                        >
                          <UserCheck className="w-4 h-4 text-indigo-600" />
                          Sujet Épreuve (Aperçu Candidat)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPracticalViewFilter('teacher')}
                          className={cn(
                            "flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2",
                            practicalViewFilter === 'teacher'
                              ? "bg-white text-indigo-700 shadow-sm border border-slate-200/20"
                              : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
                          )}
                        >
                          <Wrench className="w-4 h-4 text-emerald-600" />
                          Directives & Corrigés (Vue Formateur)
                        </button>
                      </div>
                    </div>

                    <Card className="p-8 border-4 border-double border-slate-800 shadow-2xl rounded-[2.5rem] bg-white space-y-6 font-serif">
                      
                      {/* Document Header */}
                      <div className="border-b-4 border-double border-slate-850 pb-6 flex justify-between items-start">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-indigo-600 rounded">
                              {generatedPractical.vendor} CERTIFICATION
                            </span>
                            <span className="text-slate-400 text-xs font-bold font-sans">
                              {generatedPractical.certificationName}
                            </span>
                          </div>
                          <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase leading-tight font-serif italic text-indigo-950">
                            {generatedPractical.title}
                          </h3>
                        </div>
                        <div className="text-right shrink-0 font-sans">
                          <div className="px-4 py-2 bg-indigo-50 rounded-2xl border border-indigo-100 text-center">
                            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 block">Note Pratique</span>
                            <span className="text-lg font-black text-indigo-700">/{practicalPoints} Pts</span>
                          </div>
                        </div>
                      </div>

                      {/* Header details layout */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-3 bg-slate-50 rounded-2xl px-4 border border-slate-100 font-sans text-xs">
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Durée de l'Épreuve</span>
                          <span className="font-extrabold text-slate-800">{generatedPractical.durationMinutes} Minutes</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Candidat</span>
                          <span className="text-slate-400 font-bold">_________________</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Groupe</span>
                          <span className="text-slate-400 font-bold">_________________</span>
                        </div>
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Date d'Évaluation</span>
                          <span className="text-slate-400 font-bold">__ / __ / 2026</span>
                        </div>
                      </div>

                      {/* Scenario Block */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 font-sans">🏢 Scénario & Contexte Professionnel</h4>
                        <p className="text-slate-700 text-sm leading-relaxed font-serif italic bg-slate-50/50 p-4 rounded-2xl border border-slate-100/70 whitespace-pre-line">
                          {generatedPractical.scenario}
                        </p>
                      </div>

                      {/* Requirements Block */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 font-sans">⚙️ Environnement Réseau & Applicatif</h4>
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-600 font-sans">
                          {generatedPractical.requirements.map((req, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-indigo-500 font-extrabold mt-0.5 shrink-0">•</span>
                              <span className="font-bold">{req}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Provided Files / Starters Section & Enriched Library */}
                      <div className="space-y-4 pt-4 border-t border-slate-100">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex flex-col gap-0.5">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 font-sans flex items-center gap-2">
                              📁 Fichiers de démarrage fournis (Starters)
                            </h4>
                            <p className="text-xs text-slate-500 font-sans">
                              {practicalViewFilter === 'teacher' 
                                ? "Ces fichiers de travail bruts doivent être distribués aux candidats pour la réalisation de l'épreuve."
                                : "Téléchargez les fichiers ci-dessous pour démarrer vos tâches d'évaluation pratique."}
                            </p>
                          </div>
                          
                          {practicalViewFilter === 'teacher' && (
                            <button
                              type="button"
                              onClick={() => setShowStartersLibrary(!showStartersLibrary)}
                              className={cn(
                                "py-1.5 px-3 rounded-lg text-xs font-bold font-sans flex items-center justify-center gap-1.5 border transition-all cursor-pointer select-none",
                                showStartersLibrary 
                                  ? "bg-indigo-600 text-white border-indigo-700 shadow" 
                                  : "bg-white text-indigo-700 border-indigo-200 hover:bg-slate-50 shadow-sm"
                              )}
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              {showStartersLibrary ? "Masquer la Bibliothèque" : "📚 Bibliothèque de Modèles"}
                            </button>
                          )}
                        </div>

                        {/* Current files list */}
                        {generatedPractical.providedFiles && generatedPractical.providedFiles.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {generatedPractical.providedFiles.map((file, idx) => (
                              <div key={idx} className="flex flex-col justify-between p-4 rounded-xl border border-slate-200/60 bg-slate-50/60 shadow-sm hover:shadow transition-all space-y-3">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 overflow-hidden">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide shrink-0 ${
                                        file.fileType === 'xlsx' ? 'bg-emerald-100 text-emerald-800' :
                                        file.fileType === 'docx' ? 'bg-indigo-100 text-indigo-800' :
                                        'bg-slate-200 text-slate-800'
                                      }`}>
                                        .{file.fileType}
                                      </span>
                                      <span className="font-mono text-xs font-black text-slate-700 truncate" title={file.fileName}>
                                        {file.fileName}
                                      </span>
                                    </div>
                                    {practicalViewFilter === 'teacher' && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteProvidedFile(file.fileName)}
                                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer select-none"
                                        title="Retirer ce fichier de l'épreuve"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-600 line-clamp-2" title={file.description}>
                                    {file.description}
                                  </p>
                                </div>
                                <div className="flex gap-2 font-sans">
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadProvidedFile(file, false)}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold bg-white border border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg shadow-sm hover:shadow transition-all hover:bg-slate-50 select-none cursor-pointer"
                                  >
                                    <Download className="w-3.5 h-3.5 text-slate-500" />
                                    Starter brut
                                  </button>
                                  {practicalViewFilter === 'teacher' && (
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadProvidedFile(file, true)}
                                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold bg-emerald-50 border border-emerald-200 hover:border-emerald-300 text-emerald-850 rounded-lg shadow-sm hover:shadow transition-all hover:bg-emerald-100 select-none cursor-pointer"
                                    >
                                      <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                                      Corrigé
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-6 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                            <p className="text-xs text-slate-500 font-medium font-sans">
                              Aucun fichier de démarrage n'est actuellement configuré pour cet examen.
                            </p>
                            {practicalViewFilter === 'teacher' && (
                              <p className="text-[10px] text-slate-400 font-sans mt-1">
                                Cliquez sur « Bibliothèque de Modèles » pour injecter des fichiers prêts à l'emploi.
                              </p>
                            )}
                          </div>
                        )}

                        {/* Collapsible Templates Library view */}
                        <AnimatePresence>
                          {showStartersLibrary && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden bg-indigo-50/30 border border-indigo-100/60 rounded-2xl p-4 space-y-4"
                            >
                              <div className="flex flex-col gap-0.5">
                                <h5 className="text-xs font-black text-indigo-900 font-sans flex items-center gap-1.5">
                                  📚 Bibliothèque de Modèles de Référence Enrichis
                                </h5>
                                <p className="text-[10px] text-indigo-700/80 font-sans">
                                  Sélectionnez un modèle d'examen ci-dessous pour injecter des données, formules ou squelettes de scripts authentiques dans votre épreuve pratique.
                                </p>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-sans">
                                {PREBUILT_STARTER_TEMPLATES.map((tmpl) => (
                                  <div key={tmpl.id} className="p-3 bg-white border border-indigo-100 rounded-xl hover:border-indigo-200 hover:shadow-sm transition-all flex flex-col justify-between space-y-3">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5 justify-between">
                                        <span className="text-[9px] font-black text-indigo-500 tracking-wider uppercase block">{tmpl.category}</span>
                                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase shrink-0 border ${
                                          tmpl.fileType === 'xlsx' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                          tmpl.fileType === 'docx' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                                          'bg-slate-50 text-slate-700 border-slate-100'
                                        }`}>
                                          .{tmpl.fileType}
                                        </span>
                                      </div>
                                      <h6 className="text-xs font-black text-slate-800 leading-tight">
                                        {tmpl.title}
                                      </h6>
                                      <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">
                                        {tmpl.description}
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-2 pt-1 border-t border-slate-50">
                                      <button
                                        type="button"
                                        onClick={() => setPreviewingTemplate(tmpl)}
                                        className="px-2 py-1.5 rounded-lg text-[10px] font-bold bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 select-none cursor-pointer flex items-center gap-1"
                                        title="Prévisualiser la structure interne du fichier"
                                      >
                                        Visualiser (Brut)
                                      </button>
                                      
                                      <button
                                        type="button"
                                        onClick={() => handleInjectTemplate(tmpl)}
                                        className="flex-1 py-1.5 px-2.5 rounded-lg text-[10px] font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center justify-center gap-1 select-none cursor-pointer"
                                      >
                                        <Plus className="w-3 h-3 text-white" />
                                        Injecter à l'Épreuve
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Practical Tasks Block */}
                      <div className="space-y-4 pt-4 border-t border-slate-100">
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 font-sans">🛠️ Consignes & Tâches à réaliser</h4>
                        <div className="space-y-4 font-sans">
                          {generatedPractical.tasks.map((task, idx) => (
                            <div key={idx} className="p-4 rounded-2xl bg-indigo-50/30 border border-indigo-100/50 space-y-3">
                              <div className="flex justify-between items-start gap-4 flex-wrap">
                                <h5 className="font-black text-slate-800 text-sm flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs shrink-0">{idx + 1}</span>
                                  {task.title}
                                </h5>
                                <span className="text-[10px] uppercase font-black text-indigo-700 bg-indigo-100/80 px-2.5 py-1 rounded-md">
                                  {task.points} Points
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 font-medium leading-relaxed italic pl-8">
                                {task.description}
                              </p>
                              
                              <div className="pl-8 space-y-1.5">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Étapes requises :</span>
                                {task.steps.map((step, sIdx) => (
                                  <div key={sIdx} className="text-xs text-slate-700 font-semibold flex items-start gap-2">
                                    <span className="text-indigo-400 font-black shrink-0">{idx + 1}.{sIdx + 1}</span>
                                    <span>{step}</span>
                                  </div>
                                ))}
                              </div>

                              {practicalViewFilter === 'teacher' && task.solution && (
                                <div className="mt-3 pl-8">
                                  <details className="group bg-emerald-50/50 border border-emerald-100/60 rounded-xl p-3">
                                    <summary className="text-xs font-bold text-emerald-800 cursor-pointer list-none flex items-center justify-between select-none">
                                      <span className="flex items-center gap-2">🔑 Afficher le Corrigé & Formules attendues</span>
                                      <span className="text-[10px] transition-transform group-open:rotate-180">▼</span>
                                    </summary>
                                    <div className="mt-2 text-xs text-slate-700 leading-relaxed font-sans whitespace-pre-line border-t border-emerald-100/30 pt-2 bg-white/70 p-2.5 rounded-lg border">
                                      {task.solution}
                                    </div>
                                  </details>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Rubrics table & Enhancements */}
                      <div className="space-y-6 pt-6 border-t border-slate-100">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="space-y-0.5">
                            <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 font-sans flex items-center gap-2">
                              📊 Grille de Notation & Barème d'Évaluation
                            </h4>
                            <p className="text-xs text-slate-500 font-sans">
                              Optimisez vos barèmes d'évaluation académique, modifiez les indicateurs ou simulez la correction en temps réel.
                            </p>
                          </div>

                          {practicalViewFilter === 'teacher' && (
                            <div className="flex flex-wrap items-center gap-2 font-sans select-none">
                              <button
                                type="button"
                                onClick={handleOptimizeRubricWithAI}
                                disabled={isOptimizingRubric}
                                className="py-2 px-3 rounded-xl text-xs font-black bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                              >
                                {isOptimizingRubric ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-650" />
                                    Audit IA...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                    Optimiser par IA
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={handleStartAddingCriterion}
                                className="py-2 px-3 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer flex items-center gap-1.5"
                              >
                                <Plus className="w-3.5 h-3.5 text-slate-500" />
                                Ajouter un critère
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setIsRatingMode(!isRatingMode);
                                  // Reset simulated scoring data when toggled off
                                  if (isRatingMode) {
                                    setAssignedPoints({});
                                    setStudentFeedbackText('');
                                  }
                                }}
                                className={cn(
                                  "py-2 px-3 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center gap-1.5",
                                  isRatingMode 
                                    ? "bg-emerald-600 text-white border-emerald-700 shadow shadow-emerald-100" 
                                    : "bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50"
                                )}
                              >
                                <Calculator className="w-3.5 h-3.5" />
                                {isRatingMode ? "Mode Lecture simple" : "Simulateur de Notation"}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Interactive Mode Assessment Header Card */}
                        {isRatingMode && (
                          <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50/40 via-white to-indigo-50/25 border border-emerald-200/60 shadow-sm font-sans space-y-4">
                            <div className="flex items-center gap-2 pb-3 border-b border-slate-150/40">
                              <GraduationCap className="w-5 h-5 text-emerald-600" />
                              <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider font-sans">
                                Saisie des Notes & Correction Candidate Active
                              </h5>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                              {/* Left Inputs */}
                              <div className="space-y-3 md:col-span-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide font-sans">Nom de l'étudiant</label>
                                    <input
                                      type="text"
                                      value={candidateName}
                                      onChange={(e) => setCandidateName(e.target.value)}
                                      placeholder="Ex: Amine Benali"
                                      className="w-full text-xs font-bold px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide font-sans">Groupe / Classe</label>
                                    <input
                                      type="text"
                                      value={candidateGroup}
                                      onChange={(e) => setCandidateGroup(e.target.value)}
                                      placeholder="Ex: DEV-102"
                                      className="w-full text-xs font-bold px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                                    />
                                  </div>
                                </div>
                                
                                <div className="flex gap-2 font-sans">
                                  <button
                                    type="button"
                                    onClick={handleGenerateStudentFeedbackWithAI}
                                    disabled={isGeneratingFeedback || !candidateName.trim()}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                                  >
                                    {isGeneratingFeedback ? (
                                      <>
                                        <Loader2 className="w-4 h-4 animate-spin text-emerald-100" />
                                        Génération de la critique...
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles className="w-4 h-4 text-emerald-200" />
                                        Générer Feedback Candidat (IA)
                                      </>
                                    )}
                                  </button>
                                  {studentFeedbackText && (
                                    <button
                                      type="button"
                                      onClick={() => handleCopyToClipboard(studentFeedbackText, 'candidate-feedback')}
                                      className="px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer flex items-center gap-1"
                                    >
                                      {copiedText === 'candidate-feedback' ? <Check className="w-4 h-4 text-emerald-600 animate-pulse" /> : <Copy className="w-4 h-4 text-slate-500" />}
                                      {copiedText === 'candidate-feedback' ? "Copié !" : "Copier le Feedback"}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Right Running Score Widget */}
                              <div className="p-4 rounded-xl bg-slate-50 border border-slate-150 flex flex-col items-center justify-center text-center space-y-2 min-h-[100px] font-sans">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Note d'Épreuve Pratique</span>
                                <div className="text-2xl font-black text-slate-800 tracking-tight">
                                  {generatedPractical.evaluationCriteria.reduce((sum, c, idx) => {
                                    const val = assignedPoints[idx] !== undefined ? assignedPoints[idx] : 0;
                                    return sum + val;
                                  }, 0)}
                                  <span className="text-sm font-bold text-slate-500"> / {generatedPractical.evaluationCriteria.reduce((sum, c) => sum + (c.points > 0 ? c.points : 0), 0)} Pts</span>
                                </div>
                                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-emerald-500 h-full transition-all duration-300" 
                                    style={{ 
                                      width: `${Math.min(100, Math.max(0, (generatedPractical.evaluationCriteria.reduce((sum, c, idx) => {
                                        const val = assignedPoints[idx] !== undefined ? assignedPoints[idx] : 0;
                                        return sum + val;
                                      }, 0) / (generatedPractical.evaluationCriteria.reduce((sum, c) => sum + (c.points > 0 ? c.points : 0), 0) || 1)) * 100))}%` 
                                    }}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Live Feedback Text Outcome */}
                            <AnimatePresence>
                              {studentFeedbackText && (
                                <motion.div
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 10 }}
                                  className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/30 space-y-2 font-sans"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                                      <Info className="w-3.5 h-3.5" />
                                      Feedback individualisé de l'Examinateur (Généré par IA)
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setStudentFeedbackText('')}
                                      className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 cursor-pointer"
                                    >
                                      Effacer
                                    </button>
                                  </div>
                                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap select-all bg-white p-3.5 rounded-lg border border-indigo-100/40 font-medium">
                                    {studentFeedbackText}
                                  </p>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}

                        {/* Inline custom criterion addition card */}
                        <AnimatePresence>
                          {isAddingCriterion && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 font-sans"
                            >
                              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <h5 className="text-xs font-black text-slate-700 uppercase">Ajouter un nouveau critère sur la Grille</h5>
                                <button 
                                  type="button" 
                                  onClick={() => setIsAddingCriterion(false)} 
                                  className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                                >
                                  Fermer
                                </button>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block mb-1">Tâche correspondante</label>
                                  <select
                                    value={newCriterion.taskTitle}
                                    onChange={(e) => setNewCriterion({...newCriterion, taskTitle: e.target.value})}
                                    className="w-full text-xs font-bold p-2 border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500"
                                  >
                                    <option value="Tâche Générale">Tâche Générale</option>
                                    {generatedPractical.tasks.map((t, tIdx) => (
                                      <option key={tIdx} value={t.title}>{t.title}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="sm:col-span-2">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block mb-1">Critère d'évaluation</label>
                                  <input
                                    type="text"
                                    value={newCriterion.criteriaName}
                                    onChange={(e) => setNewCriterion({...newCriterion, criteriaName: e.target.value})}
                                    placeholder="Ex: Présence d'un script de sauvegarde de base de données valide"
                                    className="w-full text-xs font-bold p-2 border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block mb-1">Barème de Note (Points)</label>
                                  <input
                                    type="number"
                                    value={newCriterion.points}
                                    onChange={(e) => setNewCriterion({...newCriterion, points: parseInt(e.target.value) || 0})}
                                    placeholder="Ex: 5"
                                    className="w-full text-xs font-bold p-2 border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500"
                                  />
                                </div>
                                <div className="sm:col-span-2">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block mb-1">Méthode de vérification & Directives</label>
                                  <input
                                    type="text"
                                    value={newCriterion.guidelines}
                                    onChange={(e) => setNewCriterion({...newCriterion, guidelines: e.target.value})}
                                    placeholder="Ex: Exécuter backup.sh et vérifier les archives générées"
                                    className="w-full text-xs font-bold p-2 border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500"
                                  />
                                </div>
                              </div>

                              <div className="flex gap-2 justify-end">
                                <button
                                  type="button"
                                  onClick={() => setIsAddingCriterion(false)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-600 cursor-pointer"
                                >
                                  Annuler
                                </button>
                                <button
                                  type="button"
                                  onClick={handleSubmitNewCriterion}
                                  className="px-4 py-1.5 rounded-lg text-xs font-black bg-indigo-600 text-white cursor-pointer"
                                >
                                  Sauvegarder le Critère
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Standard/Simulated Score Table */}
                        <div className="overflow-hidden border border-slate-100 rounded-2xl font-sans bg-white shadow-sm font-sans">
                          <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-50/80">
                              <tr>
                                <th scope="col" className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest font-sans">Tâche associée</th>
                                <th scope="col" className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest font-sans">Critère de correction</th>
                                <th scope="col" className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest font-sans">Points</th>
                                {practicalViewFilter === 'teacher' && (
                                  <th scope="col" className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest font-sans">
                                    {isRatingMode ? "Notation Interactive" : "Méthode de vérification"}
                                  </th>
                                )}
                                {practicalViewFilter === 'teacher' && (
                                  <th scope="col" className="px-4 py-3 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest font-sans">Actions</th>
                                )}
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100 text-xs">
                              {generatedPractical.evaluationCriteria.map((c, cIdx) => {
                                const isItemEditing = editingCriterionIndex === cIdx;
                                const currentRating = assignedPoints[cIdx] !== undefined ? assignedPoints[cIdx] : 0;
                                
                                return (
                                  <tr key={cIdx} className={cn(
                                    "transition-colors",
                                    isItemEditing ? "bg-amber-50/30" : "hover:bg-slate-50/50",
                                    isRatingMode && currentRating > 0 ? "bg-emerald-50/20" : ""
                                  )}>
                                    {/* Inline Row Editing Block */}
                                    {isItemEditing && editingCriterion ? (
                                      <>
                                        <td className="px-4 py-3">
                                          <input
                                            type="text"
                                            value={editingCriterion.taskTitle}
                                            onChange={(e) => setEditingCriterion({ ...editingCriterion, taskTitle: e.target.value })}
                                            className="w-full p-1.5 text-xs font-bold border border-slate-200 rounded-lg bg-white focus:outline-none"
                                          />
                                        </td>
                                        <td className="px-4 py-3">
                                          <input
                                            type="text"
                                            value={editingCriterion.criteriaName}
                                            onChange={(e) => setEditingCriterion({ ...editingCriterion, criteriaName: e.target.value })}
                                            className="w-full p-1.5 text-xs font-bold border border-slate-200 rounded-lg bg-white focus:outline-none"
                                          />
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                          <input
                                            type="number"
                                            value={editingCriterion.points}
                                            onChange={(e) => setEditingCriterion({ ...editingCriterion, points: parseInt(e.target.value) || 0 })}
                                            className="w-20 p-1.5 text-xs font-bold border border-slate-200 rounded-lg bg-white focus:outline-none"
                                          />
                                        </td>
                                        <td className="px-4 py-3">
                                          <input
                                            type="text"
                                            value={editingCriterion.guidelines}
                                            onChange={(e) => setEditingCriterion({ ...editingCriterion, guidelines: e.target.value })}
                                            className="w-full p-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white focus:outline-none"
                                          />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                          <div className="flex gap-1 justify-end">
                                            <button
                                              type="button"
                                              onClick={handleSaveEditedCriterion}
                                              className="p-1 px-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 text-[10px] cursor-pointer"
                                            >
                                              Enregistrer
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEditingCriterionIndex(null);
                                                setEditingCriterion(null);
                                              }}
                                              className="p-1 px-2 bg-slate-105 text-slate-600 rounded-lg hover:bg-slate-200 text-[10px] cursor-pointer"
                                            >
                                              X
                                            </button>
                                          </div>
                                        </td>
                                      </>
                                    ) : (
                                      <>
                                        {/* Standard View Fields */}
                                        <td className="px-4 py-3 font-extrabold text-slate-700">{c.taskTitle}</td>
                                        
                                        <td className="px-4 py-3">
                                          <div className="space-y-0.5">
                                            <p className="font-bold text-slate-900">{c.criteriaName}</p>
                                            {isRatingMode && (
                                              <p className="text-[10px] text-slate-400 font-medium">{c.guidelines}</p>
                                            )}
                                          </div>
                                        </td>

                                        <td className="px-4 py-3 whitespace-nowrap">
                                          {c.points < 0 ? (
                                            <span className="px-2 py-0.5 bg-rose-50 border border-rose-100 text-rose-700 rounded font-black flex items-center gap-1 w-max">
                                              🛑 Pénalité {c.points} pts
                                            </span>
                                          ) : (
                                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded font-black w-max block">
                                              +{c.points} pts
                                            </span>
                                          )}
                                        </td>

                                        {/* Guidelines / Interactive Grading Column */}
                                        {practicalViewFilter === 'teacher' && (
                                          <td className="px-4 py-3">
                                            {isRatingMode ? (
                                              c.points < 0 ? (
                                                /* Penalties live configuration */
                                                <div className="flex items-center gap-2 select-none font-sans">
                                                  <button
                                                    type="button"
                                                    onClick={() => setAssignedPoints({ ...assignedPoints, [cIdx]: 0 })}
                                                    className={cn(
                                                      "px-2 py-1 text-[10px] font-bold rounded-lg border cursor-pointer",
                                                      currentRating === 0
                                                        ? "bg-slate-700 text-white border-slate-800"
                                                        : "bg-white text-slate-500 hover:bg-slate-50 border-slate-250"
                                                    )}
                                                  >
                                                    Aucune erreur (0 pt)
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => setAssignedPoints({ ...assignedPoints, [cIdx]: c.points })}
                                                    className={cn(
                                                      "px-2 py-1 text-[10px] font-black rounded-lg border cursor-pointer",
                                                      currentRating === c.points
                                                        ? "bg-rose-500 border-rose-600 text-white"
                                                        : "bg-white text-rose-600 border-rose-200 hover:bg-rose-50"
                                                    )}
                                                  >
                                                    ⚠️ Pénalité infligée ({c.points} pts)
                                                  </button>
                                                </div>
                                              ) : (
                                                /* Standard points clickers */
                                                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                                  <div className="flex items-center gap-1 select-none font-sans">
                                                    <button
                                                      type="button"
                                                      onClick={() => setAssignedPoints({ ...assignedPoints, [cIdx]: 0 })}
                                                      className={cn(
                                                        "px-2 py-1 text-[10px] font-bold rounded-lg border cursor-pointer",
                                                        currentRating === 0
                                                          ? "bg-slate-700 text-white border-slate-800"
                                                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                                                      )}
                                                    >
                                                      0% (Non acquis)
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => setAssignedPoints({ ...assignedPoints, [cIdx]: Math.max(1, Math.round(c.points * 0.5)) })}
                                                      className={cn(
                                                        "px-2 py-1 text-[10px] font-bold rounded-lg border cursor-pointer",
                                                        currentRating === Math.max(1, Math.round(c.points * 0.5))
                                                          ? "bg-amber-500 text-white border-amber-600"
                                                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                                                      )}
                                                    >
                                                      50% (Partiel)
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => setAssignedPoints({ ...assignedPoints, [cIdx]: c.points })}
                                                      className={cn(
                                                        "px-2 py-1 text-[10px] font-bold rounded-lg border cursor-pointer",
                                                        currentRating === c.points
                                                          ? "bg-emerald-650 text-white border-emerald-700 bg-emerald-600"
                                                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                                                      )}
                                                    >
                                                      100% (Acquis)
                                                    </button>
                                                  </div>

                                                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5">
                                                    <span className="text-[10px] text-slate-400 font-bold">Ajusté:</span>
                                                    <input
                                                      type="number"
                                                      min="0"
                                                      max={c.points}
                                                      value={currentRating}
                                                      onChange={(e) => {
                                                        const num = Math.min(c.points, Math.max(0, parseInt(e.target.value) || 0));
                                                        setAssignedPoints({ ...assignedPoints, [cIdx]: num });
                                                      }}
                                                      className="w-10 text-[11px] font-black focus:outline-none bg-transparent text-slate-800"
                                                    />
                                                    <span className="text-[10px] text-slate-400 font-bold">/ {c.points}</span>
                                                  </div>
                                                </div>
                                              )
                                            ) : (
                                              <p className="text-slate-500 font-semibold leading-relaxed font-medium">{c.guidelines}</p>
                                            )}
                                          </td>
                                        )}

                                        {/* Actions Cells */}
                                        {practicalViewFilter === 'teacher' && (
                                          <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1.5 font-sans">
                                              <button
                                                type="button"
                                                onClick={() => handleStartEditingCriterion(cIdx)}
                                                className="p-1 px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-650 transition-all cursor-pointer flex items-center gap-1 text-[10px] select-none"
                                                title="Modifier la formulation"
                                              >
                                                <Edit className="w-3 h-3" /> Éditer
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteCriterion(cIdx)}
                                                className="p-1 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-100 text-slate-400 hover:text-rose-650 rounded-lg transition-all cursor-pointer select-none"
                                                title="Supprimer définitivement"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            </div>
                                          </td>
                                        )}
                                      </>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Examiner guidelines */}
                      {practicalViewFilter === 'teacher' && generatedPractical.generalTipsForTeacher && (
                        <div className="p-4 bg-indigo-950 text-indigo-200 text-xs rounded-2xl leading-relaxed flex items-start gap-4 font-sans">
                          <AlertCircle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-extrabold text-indigo-50 text-xs uppercase tracking-wider mb-1">Directives d'évaluation pour le formateur</p>
                            <p className="opacity-90">{generatedPractical.generalTipsForTeacher}</p>
                          </div>
                        </div>
                      )}
                    </Card>

                    {/* Actions panel */}
                    <div className="flex gap-4 flex-wrap">
                      {practicalViewFilter === 'teacher' && (
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            const payload = `### ÉVALUATION PRATIQUE CERTIFICATION ${generatedPractical.vendor} : ${generatedPractical.certificationName}\n\n` +
                              `Sujet: **${generatedPractical.title}**\n` +
                              `Durée: ${generatedPractical.durationMinutes} Minutes | Points: ${practicalPoints} Pts\n\n` +
                              `#### Scénario d'entreprise\n${generatedPractical.scenario}\n\n` +
                              `#### Prérequis Technique\n${generatedPractical.requirements.map(r => `- ${r}`).join('\n')}\n\n` +
                              `#### Tâches\n` +
                              generatedPractical.tasks.map((t, i) => `##### Task ${i+1}: ${t.title} (${t.points} pts)\n${t.description}\nSteps:\n${t.steps.map((s, si) => `  ${i+1}.${si+1}. ${s}`).join('\n')}`).join('\n\n') +
                              `\n\n#### Grille d'évaluation\n` +
                              generatedPractical.evaluationCriteria.map(e => `- **${e.taskTitle}: ${e.criteriaName} (${e.points} pts)** : ${e.guidelines}`).join('\n') +
                              `\n\n#### Directives Examinateur\n${generatedPractical.generalTipsForTeacher}`;
                            handleCopyToClipboard(payload, 'practical-fiche');
                          }}
                          className="py-3 px-6 text-xs uppercase tracking-wider font-black gap-2 select-none"
                        >
                          {copiedText === 'practical-fiche' ? (
                            <>
                              <Check className="w-4 h-4 text-emerald-500 animate-bounce" /> Un Copié !
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" /> Copier la Fiche (Markdown)
                            </>
                          )}
                        </Button>
                      )}

                      <button
                        type="button"
                        onClick={handleExportPracticalToWord}
                        className={cn(
                          "py-3 px-6 rounded-xl text-xs uppercase tracking-wider font-black flex items-center justify-center gap-2 select-none border-2 border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 cursor-pointer",
                          practicalViewFilter !== 'teacher' && "flex-1"
                        )}
                      >
                        <FileText className="w-4 h-4 text-indigo-600" /> Télécharger Énoncé Word (.docx)
                      </button>

                      {practicalViewFilter === 'teacher' && (
                        <button
                          type="button"
                          onClick={handleExportPracticalSolutionToWord}
                          className="py-3 px-6 rounded-xl text-xs uppercase tracking-wider font-black flex items-center justify-center gap-2 select-none border-2 border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100/80 hover:border-emerald-300 cursor-pointer"
                        >
                          <CheckSquare className="w-4 h-4 text-emerald-600" /> Télécharger Corrigé Word (.docx)
                        </button>
                      )}

                      {practicalViewFilter === 'teacher' && (
                        <Button 
                          onClick={handleSavePractical} 
                          disabled={isSavingPractical} 
                          className="flex-1 py-3 px-6 text-xs uppercase tracking-wider font-black gap-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl"
                        >
                          {isSavingPractical ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                              Sauvegarde...
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4 text-white" />
                              Enregistrer comme Évaluation Pratique (Brouillon)
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <Card className="h-full border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center p-12 bg-slate-50 min-h-[500px]">
                    <div className="text-center space-y-4 max-w-md font-sans">
                      <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto shadow-md">
                        <Award className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-base">Générateur Pédagogique d'Examens Pratiques</h4>
                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                          Sélectionnez une certification (Microsoft Word/Excel, Cisco CCNA, AWS, CompTIA, etc.), décrivez le sujet de l'activité, et l'IA créera une fiche complète d'évaluation avec scénario professionnel, tâches détaillées et critères de barème conformes aux exigences professionnelles.
                        </p>
                      </div>
                    </div>
                  </Card>
                )}
              </div>

            </div>
          </div>
        )}
      {/* Modal - Previewing Template Content */}
      <AnimatePresence>
        {previewingTemplate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl border border-slate-100 flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-50/20">
                <div className="space-y-0.5 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-indigo-600 tracking-wider uppercase bg-indigo-100/60 px-2 py-0.5 rounded">
                      {previewingTemplate.category}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 font-bold">
                      .{previewingTemplate.fileType}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-800 leading-tight">
                    {previewingTemplate.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewingTemplate(null)}
                  className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer select-none border border-slate-200"
                >
                  Fermer
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 max-h-[60vh] text-slate-700">
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Description</span>
                  <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                    {previewingTemplate.description}
                  </p>
                </div>

                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nom de fichier associé</span>
                  <p className="text-xs font-mono text-indigo-700 bg-indigo-50/40 p-2 rounded-lg border border-indigo-100/50 inline-block font-extrabold select-all">
                    {previewingTemplate.fileName}
                  </p>
                </div>

                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.55">Aperçu du contenu de démarrage (Starters bruts)</span>
                  {previewingTemplate.fileType === 'xlsx' && previewingTemplate.excelSheets && previewingTemplate.excelSheets.length > 0 ? (
                    <div className="space-y-3">
                      {previewingTemplate.excelSheets.map((sheet, sIdx) => (
                        <div key={sIdx} className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                          <div className="bg-slate-50 border-b border-slate-200 p-2 font-black text-[10px] text-slate-600 font-mono">
                            🗂️ Onglet : {sheet.sheetName}
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-[11px]">
                              <thead>
                                <tr className="bg-slate-100/60 border-b border-slate-200 font-black text-slate-700">
                                  {sheet.headers.map((h, hIdx) => (
                                    <th key={hIdx} className="px-3 py-2 font-black border-r border-slate-200 last:border-r-0">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {sheet.rows.map((row, rIdx) => (
                                  <tr key={rIdx} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50">
                                    {row.map((cell, cIdx) => (
                                      <td key={cIdx} className="px-3 py-1.5 border-r border-slate-150 last:border-r-0 text-slate-600 font-medium whitespace-nowrap">{cell?.toString()}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <pre className="p-4 rounded-2xl bg-slate-900 text-emerald-400 font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-[250px] border border-slate-800 shadow-inner select-all">
                      {previewingTemplate.rawContentText || previewingTemplate.contentStructure}
                    </pre>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    handleDownloadProvidedFile(previewingTemplate, false);
                  }}
                  className="py-1.5 px-3 rounded-xl text-xs font-bold border border-slate-300 hover:border-slate-400 bg-white text-slate-700 flex items-center gap-1 select-none cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Télécharger Brut
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDownloadProvidedFile(previewingTemplate, true);
                  }}
                  className="py-1.5 px-3 rounded-xl text-xs font-bold border border-emerald-200 hover:border-emerald-350 bg-emerald-50 text-emerald-800 flex items-center gap-1 select-none cursor-pointer"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                  Télécharger Corrigé
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleInjectTemplate(previewingTemplate);
                    setPreviewingTemplate(null);
                  }}
                  className="py-2 px-4 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 select-none cursor-pointer shadow-sm shadow-indigo-100"
                >
                  <Plus className="w-4 h-4 text-white" />
                  Injecter à l'Épreuve
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      </div>
    </div>
  );
};
