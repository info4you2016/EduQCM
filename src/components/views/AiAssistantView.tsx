import React, { useState } from 'react';
import { 
  Sparkles, Send, BrainCircuit, ClipboardList, AlertCircle, Loader2, Trash2, 
  Bell, BookOpen, Copy, Check, CheckSquare, Award, Target, HelpCircle, 
  FileText, ListTodo, Plus, Pin, ExternalLink, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  generateQuestions, 
  generateAnnouncementAI, 
  generateStudyGuideAI, 
  generateRubricAI 
} from '../../lib/gemini';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Module, Question, Group, Filiere } from '../../types';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';

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
  // Active Automation Tool/Tab
  const [activeTool, setActiveTool] = useState<'exams' | 'announcements' | 'guides' | 'rubrics'>('exams');

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
    } catch (err) {
      console.error("AI Generation failed:", err);
      alert("La génération d'examen a échoué. Veuillez réessayer.");
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
      alert("Examen sauvegardé avec succès en tant que brouillon !");
      onRefresh();
      onSelectTab('exams');
    } catch (err) {
      console.error("Failed to save exam:", err);
      alert("Erreur lors de la sauvegarde de l'examen.");
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
    } catch (err) {
      console.error("AI Announcement gen failed:", err);
      alert("La génération d'annonce a échoué. Veuillez réessayer.");
    } finally {
      setIsGeneratingAnnounce(false);
    }
  };

  const handlePublishAnnounce = async () => {
    if (!generatedAnnounce) return;
    
    if (announceTargetType === 'group' && !selectedGroupId) {
      alert("Veuillez choisir une classe cible.");
      return;
    }

    if (announceTargetType === 'filiere' && !selectedFiliereId) {
      alert("Veuillez choisir une filière cible.");
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
      alert("L'annonce générée par l'IA a été publiée avec succès !");
      setGeneratedAnnounce(null);
      setAnnounceTopic('');
      onRefresh();
    } catch (err) {
      console.error("Failed to publish AI announcement:", err);
      alert("Erreur lors de la publication.");
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
    } catch (err) {
      console.error("AI Guide gen failed:", err);
      alert("La génération de la fiche synthétique a échoué.");
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
    } catch (err) {
      console.error("AI Rubric gen failed:", err);
      alert("La génération de la grille d'évaluation a échoué.");
    } finally {
      setIsGeneratingRubric(false);
    }
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

      </div>
    </div>
  );
};
