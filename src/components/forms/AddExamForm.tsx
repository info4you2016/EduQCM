import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, Clock, Settings, Calendar, Shuffle, CircleHelp, Sparkles, Upload, 
  FileCode, FileText, ArrowUp, ArrowDown, Copy, Trash2, ChevronDown, Info, 
  Target, AlertCircle, Loader2, ShieldAlert, Link2, Wand2, Calculator, CheckCircle2,
  LayoutGrid, ListChecks, Type, Scissors, Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';
import { api } from '../../lib/api';
import { generateQuestions, generateQuestionVariation, generateDistractors, generateMatchingPairs, refineQuestion } from '../../lib/gemini';
import { cn, stripHtml, normalizeQuestion } from '../../lib/utils';
import { Module, UserProfile, Exam, Question, QuestionType, ExamType } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { RichTextEditor } from '../ui/RichTextEditor';
import { ImportPreviewModal } from '../modals/ImportPreviewModal';
import { ImportHelp } from '../sections/ImportHelp';
import { Modal } from '../ui/Modal';
import { AIQuestionGeneratorModal } from '../modals/AIQuestionGeneratorModal';
import { toast } from 'react-hot-toast';

interface AddExamFormProps {
  modules: Module[];
  onComplete: () => void;
  user: UserProfile;
  initialData?: Exam;
}

export const AddExamForm = ({ modules, onComplete, user, initialData }: AddExamFormProps) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [moduleId, setModuleId] = useState<string>(() => initialData?.moduleId?.toString() || modules[0]?.id?.toString() || '');
  const [examType, setExamType] = useState<ExamType>(initialData?.type || 'controle-continu');
  const [durationHours, setDurationHours] = useState(initialData ? Math.floor((initialData.durationMinutes || 0) / 60).toString() : '0');
  const [durationMinutes, setDurationMinutes] = useState(initialData ? ((initialData.durationMinutes || 0) % 60).toString() : '30');
  const [shuffleQuestions, setShuffleQuestions] = useState(initialData?.shuffleQuestions || false);
  const [disableCopyPaste, setDisableCopyPaste] = useState(initialData?.disableCopyPaste || false);
  const [forceFullscreen, setForceFullscreen] = useState(initialData?.forceFullscreen || false);
  const [detectTabExits, setDetectTabExits] = useState(initialData?.detectTabExits || false);
  const [scheduledAt, setScheduledAt] = useState(() => {
    if (!initialData?.scheduledAt) return '';
    try {
      const d = new Date(initialData.scheduledAt);
      return isNaN(d.getTime()) ? '' : d.toISOString().substring(0, 16);
    } catch {
      return '';
    }
  });
  const [questions, setQuestions] = useState<Question[]>(initialData?.questions || [
    { id: '1', type: 'multiple-choice', text: '', options: [
      { text: '', isCorrect: true },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false }
    ], points: 1 }
  ]);
  const [collapsedQuestions, setCollapsedQuestions] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'settings' | 'questions'>('settings');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showImportInfo, setShowImportInfo] = useState(false);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<{question: Question, isValid: boolean, errors: string[]}[] | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [variatingId, setVariatingId] = useState<string | null>(null);
  const [showImportHelp, setShowImportHelp] = useState(false);
  const [orgSettings, setOrgSettings] = useState<any>(null);
  const [showBulkOptionsId, setShowBulkOptionsId] = useState<string | null>(null);
  const [bulkOptionsText, setBulkOptionsText] = useState('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const lastSavedRef = useRef<Date | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const EXAM_TEMPLATES = [
    {
      id: 'qcm-10',
      name: 'QCM 10 Questions',
      icon: <ListChecks className="w-4 h-4" />,
      description: '10 QCM (2 pts ch.)',
      generate: () => Array.from({ length: 10 }).map((_, i) => ({
        id: Math.random().toString(36).substring(2, 11),
        type: 'multiple-choice' as QuestionType,
        text: '',
        options: [
          { text: '', isCorrect: true },
          { text: '', isCorrect: false },
          { text: '', isCorrect: false },
          { text: '', isCorrect: false }
        ],
        points: 2
      }))
    },
    {
      id: 'tf-10',
      name: 'Vrai/Faux 10 Questions',
      icon: <CheckCircle2 className="w-4 h-4" />,
      description: '10 Vrai/Faux (2 pts ch.)',
      generate: () => Array.from({ length: 10 }).map((_, i) => ({
        id: Math.random().toString(36).substring(2, 11),
        type: 'true-false' as QuestionType,
        text: '',
        options: [
          { text: 'Vrai', isCorrect: true },
          { text: 'Faux', isCorrect: false }
        ],
        points: 2
      }))
    },
    {
      id: 'mixte-basic',
      name: 'Mixte Basique',
      icon: <LayoutGrid className="w-4 h-4" />,
      description: '5 QCM, 5 Vrai/Faux',
      generate: () => [
        ...Array.from({ length: 5 }).map(() => ({
          id: Math.random().toString(36).substring(2, 11),
          type: 'multiple-choice' as QuestionType,
          text: '',
          options: [{ text: '', isCorrect: true }, { text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }],
          points: 2
        })),
        ...Array.from({ length: 5 }).map(() => ({
          id: Math.random().toString(36).substring(2, 11),
          type: 'true-false' as QuestionType,
          text: '',
          options: [{ text: 'Vrai', isCorrect: true }, { text: 'Faux', isCorrect: false }],
          points: 2
        }))
      ]
    }
  ];

  const applyTemplate = (templateId: string) => {
    const template = EXAM_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    
    if (questions.some(q => q.text) && !confirm("L'application d'un modèle remplacera vos questions actuelles. Continuer ?")) {
      return;
    }
    
    const newQs = template.generate();
    setQuestions(newQs);
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await api.settings.get();
        setOrgSettings(settings);
        
        // Apply defaults ONLY if it's a new exam (no initialData)
        if (!initialData && settings?.defaultExamSettings) {
          const defaults = settings.defaultExamSettings;
          if (typeof defaults.durationMinutes === 'number') {
            setDurationHours(Math.floor(defaults.durationMinutes / 60).toString());
            setDurationMinutes((defaults.durationMinutes % 60).toString());
          }
          if (defaults.shuffleQuestions !== undefined) {
            setShuffleQuestions(defaults.shuffleQuestions);
          }
          if (defaults.disableCopyPaste !== undefined) {
            setDisableCopyPaste(defaults.disableCopyPaste);
          }
          if (defaults.forceFullscreen !== undefined) {
            setForceFullscreen(defaults.forceFullscreen);
          }
          if (defaults.detectTabExits !== undefined) {
            setDetectTabExits(defaults.detectTabExits);
          }
        }
      } catch (err) {
        console.error("Failed to fetch settings:", err);
      }
    };
    fetchSettings();
  }, [initialData]);

  useEffect(() => {
    if (!moduleId && modules.length > 0 && !initialData) {
      setModuleId(modules[0].id.toString());
    }
  }, [modules, moduleId, initialData]);
  useEffect(() => {
    if (!initialData) {
      const draft = localStorage.getItem(`exam_draft_${user.id}`);
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          if (confirm("Un brouillon non enregistré a été trouvé. Voulez-vous le restaurer ?")) {
            setTitle(parsed.title || '');
            setModuleId(parsed.moduleId || '');
            setExamType(parsed.examType || 'controle-continu');
            setQuestions(parsed.questions || []);
            setDurationHours(parsed.durationHours || '0');
            setDurationMinutes(parsed.durationMinutes || '30');
            setShuffleQuestions(parsed.shuffleQuestions || false);
            setDisableCopyPaste(parsed.disableCopyPaste || false);
            setForceFullscreen(parsed.forceFullscreen || false);
            setDetectTabExits(parsed.detectTabExits || false);
          } else {
            localStorage.removeItem(`exam_draft_${user.id}`);
          }
        } catch (e) {
          console.error("Failed to load draft", e);
        }
      }
    }
  }, [user.id, initialData]);

  useEffect(() => {
    if (!initialData && (title || questions.length > 1 || (questions.length === 1 && questions[0].text))) {
      const draft = {
        title,
        moduleId,
        examType,
        questions,
        durationHours,
        durationMinutes,
        shuffleQuestions,
        disableCopyPaste,
        forceFullscreen,
        detectTabExits
      };
      localStorage.setItem(`exam_draft_${user.id}`, JSON.stringify(draft));
      
      const now = new Date();
      if (!lastSavedRef.current || now.getTime() - lastSavedRef.current.getTime() > 5000) {
        setLastSaved(now);
        lastSavedRef.current = now;
      }
    }
  }, [title, moduleId, examType, questions, durationHours, durationMinutes, shuffleQuestions, disableCopyPaste, forceFullscreen, detectTabExits, user.id, initialData]);

  const handleAiQuestionsReady = (generated: any[]) => {
    const formatted: Question[] = generated.map(q => {
      const result = validateAndNormalize(q);
      const question = result.question;
      // Ensure unique ID
      question.id = Math.random().toString(36).substring(2, 11);
      return question;
    });
    
    setQuestions(prev => {
      const isInitialEmpty = prev.length === 1 && !prev[0].text;
      return isInitialEmpty ? formatted : [...prev, ...formatted];
    });
  };

  const addQuestion = () => {
    setQuestions([...questions, { 
      id: Math.random().toString(36).substring(2, 11), 
      type: 'multiple-choice',
      text: '', 
      options: [
        { text: '', isCorrect: true }, 
        { text: '', isCorrect: false }, 
        { text: '', isCorrect: false }, 
        { text: '', isCorrect: false }
      ], 
      points: 1
    }]);
  };

  const validateAndNormalize = (q: any): { question: Question, isValid: boolean, errors: string[] } => {
    const errors: string[] = [];
    if (!q || typeof q !== 'object') {
      return { 
        question: { id: Date.now().toString(), type: 'multiple-choice', text: 'Structure invalide', points: 0 },
        isValid: false,
        errors: ['Structure de donnée invalide']
      };
    }

    const text = q.text || q.question || '';
    if (!text) errors.push('Énoncé manquant');

    const rawType = (q.type || q.questionType || 'multiple-choice').toLowerCase();
    let type: QuestionType = 'multiple-choice';
    if (['multiple-choice', 'qcm', 'mcq'].includes(rawType)) type = 'multiple-choice';
    else if (['true-false', 'vrai-faux', 'tf'].includes(rawType)) type = 'true-false';
    else if (['short-answer', 'reponse-courte', 'sa'].includes(rawType)) type = 'short-answer';
    else if (['fill-in-the-blanks', 'trous', 'fib'].includes(rawType)) type = 'fill-in-the-blanks';
    else if (['ordering', 'ordre'].includes(rawType)) type = 'ordering';
    else if (['matching', 'association'].includes(rawType)) type = 'matching';
    else if (['practical', 'pratique'].includes(rawType)) type = 'practical';
    else errors.push(`Type de question inconnu: ${rawType}`);

    const points = (q.points !== undefined && !isNaN(Number(q.points))) ? Number(q.points) : 1;
    
    // For ordering and matching, default shuffleOptions to true if not specified
    let shuffleOptions = q.shuffleOptions === true || q.shuffleOptions === 'true' || q.shuffleOptions === 1 || q.shuffleOptions === '1';
    if ((type === 'ordering' || type === 'matching') && q.shuffleOptions === undefined) {
      shuffleOptions = true;
    }

    const parseList = (val: any): any[] => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string' && val.trim()) return val.split('|').map(s => s.trim());
      return [];
    };

    const base: Question = {
      id: q.id || Math.random().toString(36).substring(2, 11),
      type,
      text,
      points,
      shuffleOptions
    };

    switch (type) {
      case 'multiple-choice':
      case 'true-false': {
        const optList = parseList(q.options);
        const finalOptions = optList.length > 0 ? optList : (type === 'true-false' ? ['Vrai', 'Faux'] : []);
        
        if (finalOptions.length === 0) errors.push('Options manquantes');
        
        const correctIdx = q.correctOptionIndex !== undefined ? Number(q.correctOptionIndex) : (q.correctAnswerIndex !== undefined ? Number(q.correctAnswerIndex) : -1);
        
        const question: Question = {
          ...base,
          options: finalOptions.map((opt: any, idx: number) => {
            if (typeof opt === 'string') {
              return { text: opt, isCorrect: idx === correctIdx };
            }
            return {
              text: opt.text || opt.label || '',
              isCorrect: opt.isCorrect !== undefined ? (opt.isCorrect === true || opt.isCorrect === 'true') : (idx === correctIdx)
            };
          })
        };

        if (question.options && question.options.length > 0 && !question.options.some(o => o.isCorrect)) errors.push('Aucune option correcte définie');
        if (question.options?.some(o => !o.text)) errors.push('Certaines options sont vides');

        return { question, isValid: errors.length === 0, errors };
      }
      case 'short-answer': {
        const question: Question = {
          ...base,
          correctAnswer: String(q.correctAnswer || q.answer || '')
        };
        if (!question.correctAnswer) errors.push('Réponse attendue manquante');
        return { question, isValid: errors.length === 0, errors };
      }
      case 'fill-in-the-blanks': {
        const answers = parseList(q.correctAnswers || q.answers).map(String);
        const question: Question = {
          ...base,
          correctAnswers: answers
        };
        const blanksCount = (text.match(/\[blank\]/g) || []).length;
        if (blanksCount === 0) errors.push("L'énoncé doit contenir '[blank]'");
        if (answers.length < blanksCount) errors.push(`Il manque des réponses (${blanksCount} attendus, ${answers.length} fournis)`);
        return { question, isValid: errors.length === 0, errors };
      }
      case 'ordering': {
        const rawOpts = parseList(q.options).map(opt => typeof opt === 'string' ? opt : (opt.text || opt.label || ''));
        const correctOrderInput = Array.isArray(q.correctOrder) 
          ? q.correctOrder.map(Number) 
          : (typeof q.correctOrder === 'string' ? q.correctOrder.split('|').map(Number) : rawOpts.map((_, i) => i));

        // Create objects to track original position
        const items = rawOpts.map((text, index) => ({ text, index }));
        
        // Shuffle the items for the database/editor
        for (let i = items.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [items[i], items[j]] = [items[j], items[i]];
        }

        // New correctOrder must point to the new indices of original items in the order they should appear
        const newCorrectOrder = correctOrderInput.map(origIdx => 
          items.findIndex(item => item.index === origIdx)
        );

        const question: Question = {
          ...base,
          options: items.map(item => ({ text: item.text })),
          correctOrder: newCorrectOrder
        };

        if (question.options?.length === 0) errors.push('Éléments à ordonner manquants');
        if (question.options?.some(o => !o.text)) errors.push('Certains éléments sont vides');
        return { question, isValid: errors.length === 0, errors };
      }
      case 'matching': {
        const rawOpts = parseList(q.options).map(opt => typeof opt === 'string' ? opt : (opt.text || opt.label || ''));
        const rawMatchOpts = parseList(q.matchOptions).map(String);
        const correctMatchesInput = Array.isArray(q.correctMatches) 
          ? q.correctMatches.map(Number) 
          : (typeof q.correctMatches === 'string' ? q.correctMatches.split('|').map(Number) : rawOpts.map((_, i) => i));

        // Create objects to track original position of match options
        const matchItems = rawMatchOpts.map((text, index) => ({ text, index }));
        
        // Shuffle the match items
        for (let i = matchItems.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [matchItems[i], matchItems[j]] = [matchItems[j], matchItems[i]];
        }

        // New correctMatches must point to the new indices of right-side options
        const newCorrectMatches = correctMatchesInput.map(origRightIdx => 
          matchItems.findIndex(item => item.index === origRightIdx)
        );

        const question: Question = {
          ...base,
          options: rawOpts.map(text => ({ text })),
          matchOptions: matchItems.map(item => item.text),
          correctMatches: newCorrectMatches
        };

        if (question.options?.length === 0) errors.push('Options de gauche manquantes');
        if (question.matchOptions?.length === 0) errors.push('Options de droite manquantes');
        if (question.options?.length !== question.matchOptions?.length) errors.push('Le nombre d\'options de gauche et de droite doit être identique');
        return { question, isValid: errors.length === 0, errors };
      }
      default:
        return { question: base, isValid: false, errors: ['Type de question non supporté'] };
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportProgress(0);

    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        setImportProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    reader.onerror = () => {
      setImportError("Erreur lors de la lecture du fichier.");
      setImportProgress(null);
    };
    reader.onload = (event) => {
      const content = event.target?.result as string;
      
      try {
        if (file.name.endsWith('.json')) {
          const imported = JSON.parse(content);
          if (Array.isArray(imported)) {
            const validated = imported.map(validateAndNormalize);
            setImportProgress(100);
            setTimeout(() => {
              setPendingImport(validated);
              setImportProgress(null);
            }, 300);
          } else {
            throw new Error("Le format JSON doit être un tableau de questions.");
          }
        } else if (file.name.endsWith('.csv')) {
          Papa.parse(content, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              if (results.errors.length > 0) {
                setImportError(`Erreur CSV: ${results.errors[0].message}`);
                setImportProgress(null);
                return;
              }
              const validated = results.data.map(validateAndNormalize);
              setImportProgress(100);
              setTimeout(() => {
                setPendingImport(validated);
                setImportProgress(null);
              }, 300);
            },
            error: (err) => {
              setImportError(`Erreur CSV: ${err.message}`);
              setImportProgress(null);
            }
          });
        } else {
          throw new Error("Format de fichier non supporté. Utilisez .json ou .csv");
        }
      } catch (err: any) {
        setImportError(err.message || "Erreur lors de l'importation.");
        setImportProgress(null);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onConfirmImport = () => {
    if (!pendingImport) return;
    const importedQs = pendingImport.filter(p => p.isValid).map(p => p.question);
    setQuestions(prev => {
      const isInitialEmpty = prev.length === 1 && !prev[0].text;
      return isInitialEmpty ? importedQs : [...prev, ...importedQs];
    });
    setPendingImport(null);
  };

  const onUpdatePendingQuestion = (idx: number, updates: Partial<Question>) => {
    if (!pendingImport) return;
    const newPending = [...pendingImport];
    const updatedQ = { ...newPending[idx].question, ...updates };
    newPending[idx] = validateAndNormalize(updatedQ);
    setPendingImport(newPending);
  };

  const onRemovePendingQuestion = (idx: number) => {
    if (!pendingImport) return;
    const newPending = pendingImport.filter((_, i) => i !== idx);
    setPendingImport(newPending.length > 0 ? newPending : null);
  };

  const handleVariation = async (idx: number) => {
    const q = questions[idx];
    setVariatingId(q.id);
    try {
      const variation = await generateQuestionVariation(normalizeQuestion(q));
      const result = validateAndNormalize(variation);
      updateQuestion(q.id, result.question);
    } catch (err) {
      console.error("Variation failed:", err);
      toast.error("La génération d'une variation a échoué.");
    } finally {
      setVariatingId(null);
    }
  };

  const removeQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    const newQs = questions.filter((_, i) => i !== idx);
    setQuestions(newQs);
  };

  const duplicateQuestion = (idx: number) => {
    const q = questions[idx];
    const newQ = { 
      ...q, 
      id: Math.random().toString(36).substring(2, 11) 
    };
    const newQs = [...questions];
    newQs.splice(idx + 1, 0, newQ);
    setQuestions(newQs);
  };

  const moveQuestion = (idx: number, direction: 'up' | 'down') => {
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === questions.length - 1) return;
    
    const newQs = [...questions];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newQs[idx], newQs[targetIdx]] = [newQs[targetIdx], newQs[idx]];
    setQuestions(newQs);
  };

  const exportToJSON = () => {
    const data = questions.map(q => {
      const nq = normalizeQuestion(q);
      const exportQ: any = {
        type: nq.type,
        text: stripHtml(nq.text),
        points: nq.points,
        shuffleOptions: nq.shuffleOptions,
      };
      if (nq.type === 'multiple-choice' || nq.type === 'true-false') {
        exportQ.options = nq.options?.map(o => stripHtml(o.text));
        exportQ.correctOptionIndex = nq.options?.findIndex(o => o.isCorrect);
      } else if (nq.type === 'short-answer') {
        exportQ.correctAnswer = stripHtml(nq.correctAnswer || '');
      } else if (nq.type === 'fill-in-the-blanks') {
        exportQ.correctAnswers = nq.correctAnswers?.map(ans => stripHtml(ans));
      } else if (nq.type === 'ordering') {
        exportQ.options = nq.options?.map(o => stripHtml(o.text));
        exportQ.correctOrder = nq.correctOrder;
      } else if (nq.type === 'matching') {
        exportQ.options = nq.options?.map(o => stripHtml(o.text));
        exportQ.matchOptions = nq.matchOptions?.map(opt => stripHtml(opt));
        exportQ.correctMatches = nq.correctMatches;
      }
      return exportQ;
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    saveAs(blob, `questions_${stripHtml(title).replace(/\s+/g, '_') || 'export'}.json`);
  };

  const exportToCSV = () => {
    const data = questions.map(q => {
      const nq = normalizeQuestion(q);
      const row: any = {
        type: nq.type,
        text: stripHtml(nq.text),
        points: nq.points,
        shuffleOptions: nq.shuffleOptions,
      };
      if (nq.type === 'multiple-choice' || nq.type === 'true-false') {
        row.options = nq.options?.map(o => stripHtml(o.text)).join('|');
        row.correctOptionIndex = nq.options?.findIndex(o => o.isCorrect);
      } else if (nq.type === 'short-answer') {
        row.correctAnswer = stripHtml(nq.correctAnswer || '');
      } else if (nq.type === 'fill-in-the-blanks') {
        row.correctAnswers = nq.correctAnswers?.map(ans => stripHtml(ans)).join('|');
      } else if (nq.type === 'ordering') {
        row.options = nq.options?.map(o => stripHtml(o.text)).join('|');
        row.correctOrder = nq.correctOrder?.join('|');
      } else if (nq.type === 'matching') {
        row.options = nq.options?.map(o => stripHtml(o.text)).join('|');
        row.matchOptions = nq.matchOptions?.map(opt => stripHtml(opt)).join('|');
        row.correctMatches = nq.correctMatches?.join('|');
      }
      return row;
    });
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `questions_${stripHtml(title).replace(/\s+/g, '_') || 'export'}.csv`);
  };

  const updateQuestion = (id: string, fieldOrUpdates: keyof Question | Partial<Question>, value?: any) => {
    React.startTransition(() => {
      setQuestions(prev => prev.map(q => {
        if (q.id !== id) return q;
        if (typeof fieldOrUpdates === 'string') {
          return { ...q, [fieldOrUpdates]: value };
        }
        return { ...q, ...fieldOrUpdates };
      }));
    });
  };

  const filteredQuestions = questions.filter(q => 
    stripHtml(q.text).toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);
  const maxPoints = examType === 'controle-continu' ? 20 : 40;
  const isPointsValid = totalPoints === maxPoints;

  const distributePoints = () => {
    if (questions.length === 0) return;
    const maxPoints = examType === 'controle-continu' ? 20 : 40;
    const basePoints = Math.floor(maxPoints / questions.length);
    const extraPoints = maxPoints % questions.length;
    
    setQuestions(questions.map((q, i) => ({
      ...q,
      points: basePoints + (i < extraPoints ? 1 : 0)
    })));
  };

  const handleRefine = async (idx: number) => {
    const q = questions[idx];
    setVariatingId(q.id);
    try {
      const refined = await refineQuestion(normalizeQuestion(q));
      const result = validateAndNormalize(refined);
      updateQuestion(q.id, { ...result.question, id: q.id });
    } catch (err) {
      console.error("Refinement failed:", err);
      toast.error("L'amélioration IA a échoué.");
    } finally {
      setVariatingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (initialData?.hasResults) {
      toast.error("Impossible de modifier un examen qui a déjà des résultats.");
      return;
    }
    if (!moduleId) {
      toast.error("Veuillez sélectionner un module.");
      return;
    }

    const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);
    const maxPoints = examType === 'controle-continu' ? 20 : 40;
    if (totalPoints !== maxPoints) {
      toast.error(`Le total des points doit être exactement de ${maxPoints} pour un ${examType === 'controle-continu' ? 'Contrôle Continu' : 'Examen de Fin de Module'}. Actuellement: ${totalPoints}`);
      return;
    }
    
    for (let i = 0; i < questions.length; i++) {
       const q = questions[i];
       if (!q.text || q.text === '<p><br></p>') {
         toast.error(`La question ${i + 1} n'a pas d'énoncé.`);
         setCollapsedQuestions(prev => ({ ...prev, [q.id]: false }));
         return;
       }
    }

    setLoading(true);
    try {
      const examData = {
        title,
        moduleId: Number(moduleId),
        type: examType,
        durationMinutes: (parseInt(durationHours) || 0) * 60 + (parseInt(durationMinutes) || 0),
        shuffleQuestions,
        disableCopyPaste,
        forceFullscreen,
        detectTabExits,
        questions,
        scheduledAt: scheduledAt || null
      };
      if (initialData) {
        await api.exams.update(initialData.id, examData);
      } else {
        await api.exams.create(examData);
      }
      localStorage.removeItem(`exam_draft_${user.id}`);
      onComplete();
    } catch (error) {
      console.error("Error saving exam:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 px-1">
      {/* Tab Navigation */}
      <div className="flex items-center justify-between sticky top-0 z-30 bg-slate-50/80 backdrop-blur-md py-4 mb-6 border-b border-slate-200">
        <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              activeTab === 'settings' 
                ? "bg-white text-indigo-600 shadow-sm" 
                : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
            )}
          >
            <Settings className="w-4 h-4 inline-block mr-2" />
            Paramètres
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('questions')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center",
              activeTab === 'questions' 
                ? "bg-white text-indigo-600 shadow-sm" 
                : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
            )}
          >
            <FileText className="w-4 h-4 inline-block mr-2" />
            Questions
            <span className={cn(
              "ml-2 px-1.5 py-0.5 rounded-full text-[10px]",
              activeTab === 'questions' ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-500"
            )}>
              {questions.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-4">
          {lastSaved && (
            <div className="hidden md:flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white/50 px-3 py-1.5 rounded-lg border border-slate-100">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              Sauvegardé à {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}

          <div className="flex gap-1.5 p-1 bg-white border border-slate-200 rounded-xl">
            {[
              { type: 'easy', color: 'bg-emerald-500', name: 'F' },
              { type: 'medium', color: 'bg-amber-500', name: 'M' },
              { type: 'hard', color: 'bg-rose-500', name: 'D' }
            ].map(d => {
              const count = questions.filter(q => q.difficulty === d.type).length;
              return (
                <div key={d.type} className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-50 transition-colors" title={`${count} questions ${d.type}`}>
                  <div className={cn("w-2 h-2 rounded-full", d.color)} />
                  <span className="text-[10px] font-black text-slate-500">{count}</span>
                </div>
              );
            })}
          </div>

          {activeTab === 'questions' && (
            <div className="relative group">
              <Plus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder="Rechercher une question..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold w-64 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
          )}
          
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white",
            isPointsValid ? "border-emerald-200 bg-emerald-50/30" : "border-amber-200 bg-amber-50/30"
          )}>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Points</span>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-sm font-black",
                  isPointsValid ? "text-emerald-600" : "text-amber-600"
                )}>
                  {totalPoints} / {maxPoints}
                </span>
                {!isPointsValid && questions.length > 0 && (
                  <button 
                    type="button"
                    onClick={distributePoints}
                    className="p-1 hover:bg-slate-100 rounded-md text-amber-500 transition-colors"
                    title="Distribuer les points équitablement"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            {isPointsValid ? (
              <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                <Target className="w-3.5 h-3.5 text-white" />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                <AlertCircle className="w-3.5 h-3.5 text-white" />
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'settings' ? (
          <motion.section 
            key="settings"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-subtle space-y-6"
          >
            <Input label="Titre de l'examen" value={title} onChange={(e) => setTitle(e.target.value)} required />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Module</label>
              <select 
                value={moduleId} 
                onChange={(e) => setModuleId(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-2xl text-sm font-bold transition-all outline-none"
                required
              >
                <option value="">Sélectionnez un module</option>
                {modules.map(m => <option key={m.id} value={m.id.toString()}>{m.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Type d'examen</label>
              <select 
                value={examType} 
                onChange={(e) => setExamType(e.target.value as ExamType)}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-2xl text-sm font-bold transition-all outline-none"
                required
              >
                <option value="controle-continu">Contrôle Continu (Barème: 20)</option>
                <option value="fin-de-module">Examen de Fin de Module (Barème: 40)</option>
              </select>
            </div>
            <div className="space-y-1.5 flex flex-col justify-end">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Durée</label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input 
                    type="number" 
                    value={durationHours} 
                    onChange={(e) => setDurationHours(e.target.value)} 
                    placeholder="H"
                    min="0"
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-2xl text-sm font-bold transition-all outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">H</span>
                </div>
                <div className="flex-1 relative">
                  <input 
                    type="number" 
                    value={durationMinutes} 
                    onChange={(e) => setDurationMinutes(e.target.value)} 
                    placeholder="Min"
                    min="0"
                    max="59"
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-2xl text-sm font-bold transition-all outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">MIN</span>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Date/Heure</label>
              <input 
                type="datetime-local" 
                value={scheduledAt} 
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-2xl text-sm font-bold transition-all outline-none"
              />
            </div>
          </div>
          <div className="space-y-4">
            <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl cursor-pointer border-2 border-transparent hover:border-indigo-100 transition-all">
              <input type="checkbox" checked={shuffleQuestions} onChange={(e) => setShuffleQuestions(e.target.checked)} className="w-5 h-5 text-indigo-600 rounded-lg border-2 border-slate-300 focus:ring-indigo-500" />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Shuffle className="w-4 h-4 text-indigo-500" /> Mélanger les questions
                </span>
                <span className="text-[10px] text-slate-400 font-medium">L'ordre des questions sera différent pour chaque étudiant</span>
              </div>
            </label>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-slate-400" /> Configuration de la Sécurité & Anti-Triche
              </label>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Bloquer le copier-coller & clic droit */}
                <div className={`flex flex-col justify-between p-5 rounded-2xl border-2 transition-all ${
                  disableCopyPaste 
                    ? 'border-indigo-500 bg-indigo-50/10 shadow-sm' 
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <Scissors className="w-5 h-5" />
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={disableCopyPaste} 
                          onChange={(e) => setDisableCopyPaste(e.target.checked)}
                          className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 font-black"></div>
                      </label>
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900">Bloquer le Copier-Coller & Clic Droit</h4>
                      <p className="text-xs text-slate-500 font-semibold leading-relaxed mt-1">
                        Désactive la copie, le collage, la coupure, la sélection de texte et le menu contextuel, ainsi que les raccourcis inspecteurs F12.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${disableCopyPaste ? 'text-indigo-600' : 'text-slate-400'}`}>
                      {disableCopyPaste ? 'Activé' : 'Désactivé'}
                    </span>
                  </div>
                </div>

                {/* 2. Mode plein écran obligatoire */}
                <div className={`flex flex-col justify-between p-5 rounded-2xl border-2 transition-all ${
                  forceFullscreen 
                    ? 'border-indigo-500 bg-indigo-50/10 shadow-sm' 
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <Layers className="w-5 h-5" />
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={forceFullscreen} 
                          onChange={(e) => setForceFullscreen(e.target.checked)}
                          className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 font-black"></div>
                      </label>
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900">Exiger le Mode Plein Écran</h4>
                      <p className="text-xs text-slate-500 font-semibold leading-relaxed mt-1">
                        Oblige l'étudiant à travailler en plein écran. L'examen est interrompu si le mode plein écran est fermé par l'étudiant.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${forceFullscreen ? 'text-indigo-600' : 'text-slate-400'}`}>
                      {forceFullscreen ? 'Activé' : 'Désactivé'}
                    </span>
                  </div>
                </div>

                {/* 3. Détecter les changements d'onglet */}
                <div className={`flex flex-col justify-between p-5 rounded-2xl border-2 transition-all ${
                  detectTabExits 
                    ? 'border-rose-500 bg-rose-50/10 shadow-sm' 
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <ShieldAlert className="w-5 h-5" />
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={detectTabExits} 
                          onChange={(e) => setDetectTabExits(e.target.checked)}
                          className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 font-black"></div>
                      </label>
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900">Détecter les Sorties d'Onglet</h4>
                      <p className="text-xs text-slate-500 font-semibold leading-relaxed mt-1">
                        Surveille si l'élève change d'onglet ou d'application et déclenche des alertes en temps réel sur la supervision de l'enseignant.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${detectTabExits ? 'text-rose-600' : 'text-slate-400'}`}>
                      {detectTabExits ? 'Activé' : 'Désactivé'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Modèles Express</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {EXAM_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => applyTemplate(tmpl.id)}
                  className="flex flex-col items-start gap-3 p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-500 hover:shadow-lg transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    {tmpl.icon}
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-slate-900 group-hover:text-indigo-600">{tmpl.name}</h5>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">{tmpl.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </motion.section>
      ) : (
          <motion.section 
            key="questions"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between bg-white/50 p-4 rounded-3xl border border-slate-100 mb-6">
              <div className="flex flex-col">
                <h4 className="text-xl font-black text-slate-900">Banque de Questions</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gérez et organisez vos questions</p>
              </div>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      if (confirm("Êtes-vous sûr de vouloir supprimer TOUTES les questions ?")) {
                        setQuestions([{ 
                          id: Math.random().toString(36).substring(2, 11), 
                          type: 'multiple-choice',
                          text: '', 
                          options: [
                            { text: '', isCorrect: true }, 
                            { text: '', isCorrect: false }, 
                            { text: '', isCorrect: false }, 
                            { text: '', isCorrect: false }
                          ], 
                          points: 1
                        }]);
                      }
                    }}
                    className="gap-2 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="w-4 h-4" />
                    Tout effacer
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowPreview(true)} 
                    className="gap-2 border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 rounded-xl"
                  >
                    <CircleHelp className="w-4 h-4" /> Prévisualiser
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowAiModal(true)} className="gap-2 border-indigo-200 bg-indigo-50/30 text-indigo-700 hover:bg-indigo-100/50 rounded-xl">
                  <Sparkles className="w-4 h-4" /> Générer avec l'IA
                </Button>
                <div className="flex bg-white p-1 rounded-xl border border-slate-200 relative overflow-hidden">
                  {importProgress !== null && (
                    <div 
                      className="absolute bottom-0 left-0 h-0.5 bg-indigo-500 transition-all duration-300" 
                      style={{ width: `${importProgress}%` }}
                    />
                  )}
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => fileInputRef.current?.click()} 
                    className={cn("gap-2 rounded-lg", importProgress !== null && "opacity-50 pointer-events-none")}
                  >
                    <Upload className="w-4 h-4" />
                    {importProgress !== null ? 'Importation...' : 'Import'}
                  </Button>
                  <div className="w-px h-4 bg-slate-200 self-center mx-1" />
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowImportHelp(true)} 
                    className="px-2 rounded-lg text-slate-400 hover:text-indigo-600"
                    title="Aide sur le format d'importation"
                  >
                    <Info className="w-4 h-4" />
                  </Button>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleImport} accept=".csv,.json" className="hidden" />
                <Button type="button" size="sm" onClick={addQuestion} className="gap-2 rounded-xl">
                  <Plus className="w-4 h-4" /> Nouvelle Question
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-9 space-y-6">
                <AnimatePresence>
                  {importError && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-center gap-3 text-rose-600"
                    >
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <p className="text-sm font-bold">{importError}</p>
                      <button onClick={() => setImportError(null)} className="ml-auto text-rose-400 hover:text-rose-600 font-black text-xs uppercase">Fermer</button>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {filteredQuestions.length === 0 && searchQuery && (
                  <div className="p-12 text-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                    <CircleHelp className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-500 font-bold">Aucune question ne correspond à votre recherche "{searchQuery}"</p>
                    <button onClick={() => setSearchQuery('')} className="mt-2 text-indigo-600 text-xs font-black uppercase hover:underline">Effacer la recherche</button>
                  </div>
                )}

                {filteredQuestions.map((q, idx) => (
                  <Card key={q.id} id={`q-${q.id}`} className={cn(
                    "p-5 transition-all border-2 scroll-mt-24",
                    collapsedQuestions[q.id] ? "bg-slate-50/50 border-slate-100" : "bg-white border-slate-100 shadow-sm ring-1 ring-slate-100"
                  )}>
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        {/* Question Badge & Navigation */}
                        <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 shadow-xl">
                          <div className="flex flex-col gap-1">
                             <button 
                               type="button" 
                               disabled={idx === 0}
                               onClick={() => moveQuestion(idx, 'up')}
                               className="p-1 text-slate-500 hover:text-white disabled:opacity-20 transition-colors"
                             >
                               <ArrowUp className="w-3 h-3" />
                             </button>
                             <button 
                               type="button" 
                               disabled={idx === questions.length - 1}
                               onClick={() => moveQuestion(idx, 'down')}
                               className="p-1 text-slate-500 hover:text-white disabled:opacity-20 transition-colors"
                             >
                               <ArrowDown className="w-3 h-3" />
                             </button>
                          </div>
                          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center border border-indigo-500/50 shadow-inner">
                            <span className="text-[11px] font-black text-white">{questions.indexOf(q) + 1}</span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <select 
                          value={q.type} 
                          onChange={(e) => {
                            const newType = e.target.value as QuestionType;
                            const updates: Partial<Question> = { type: newType };
                            if (newType === 'multiple-choice') {
                              updates.options = [
                                { text: '', isCorrect: true },
                                { text: '', isCorrect: false },
                                { text: '', isCorrect: false },
                                { text: '', isCorrect: false }
                              ];
                            } else if (newType === 'true-false') {
                              updates.options = [
                                { text: 'Vrai', isCorrect: true },
                                { text: 'Faux', isCorrect: false }
                              ];
                            } else if (newType === 'short-answer') {
                              updates.correctAnswer = '';
                            } else if (newType === 'fill-in-the-blanks') {
                              updates.correctAnswers = [''];
                            } else if (newType === 'ordering') {
                              updates.options = [{ text: '', isCorrect: false }];
                              updates.correctOrder = [0];
                            } else if (newType === 'matching') {
                              updates.options = [{ text: '', isCorrect: false }];
                              updates.matchOptions = [''];
                              updates.correctMatches = [0];
                            }
                            updateQuestion(q.id, updates);
                          }}
                          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none focus:border-indigo-500 transition-all w-fit"
                        >
                          <option value="multiple-choice">QCM</option>
                          <option value="true-false">Vrai/Faux</option>
                          <option value="short-answer">Réponse</option>
                          <option value="fill-in-the-blanks">Trous</option>
                          <option value="ordering">Ordre</option>
                          <option value="matching">Assoc.</option>
                          <option value="practical">Pratique</option>
                        </select>
                        <input 
                          type="text"
                          placeholder="Section (ex: Partie 1)" 
                          value={q.section || ''} 
                          onChange={(e) => updateQuestion(q.id, 'section', e.target.value)}
                          className="h-6 text-[10px] py-1 px-3 border-transparent bg-slate-100 rounded-lg focus:bg-white min-w-[120px] outline-none font-bold"
                        />
                        </div>
                      </div>

                      <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-2xl border border-slate-200/50">
                        <button 
                          type="button" 
                          onClick={() => duplicateQuestion(questions.indexOf(q))} 
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all"
                          title="Dupliquer la question"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button 
                          type="button" 
                          onClick={() => removeQuestion(questions.indexOf(q))} 
                          className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                          title="Supprimer la question"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="w-px h-6 bg-slate-200 mx-1" />
                        <button 
                          type="button" 
                          onClick={() => setCollapsedQuestions(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                          className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-white rounded-xl transition-all"
                        >
                          <ChevronDown className={cn("w-4 h-4 transition-transform", collapsedQuestions[q.id] && "rotate-180")} />
                        </button>
                      </div>
                    </div>

                    
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-1 p-1 bg-slate-50 w-fit rounded-xl border border-slate-200/50">
                          {(['easy', 'medium', 'hard'] as const).map(level => (
                            <button
                              key={level}
                              type="button"
                              onClick={() => updateQuestion(q.id, 'difficulty', level)}
                              className={cn(
                                "px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all",
                                q.difficulty === level 
                                  ? level === 'easy' ? "bg-emerald-500 text-white" : level === 'medium' ? "bg-amber-500 text-white" : "bg-rose-500 text-white"
                                  : "text-slate-400 hover:bg-slate-200"
                              )}
                            >
                              {level === 'easy' ? 'Facile' : level === 'medium' ? 'Moyen' : 'Difficile'}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleRefine(questions.indexOf(q))} 
                          disabled={variatingId === q.id}
                          className="h-8 px-2 text-[9px] font-black uppercase tracking-widest text-emerald-600 hover:bg-white rounded-lg transition-all gap-1.5"
                          title="Améliorer la clarté avec l'IA"
                        >
                          {variatingId === q.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                          Affiner
                        </Button>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleVariation(questions.indexOf(q))} 
                          disabled={variatingId === q.id}
                          className="h-8 px-2 text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:bg-white rounded-lg transition-all gap-1.5"
                        >
                          {variatingId === q.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                          Variation
                        </Button>
                      </div>
                      <div className="flex items-center bg-indigo-50 px-3 py-1.5 gap-2 rounded-xl border border-indigo-100">
                         <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Points</label>
                         <input 
                           type="number" 
                           value={q.points ?? 1} 
                           onChange={(e) => updateQuestion(q.id, 'points', Number(e.target.value))} 
                           className="w-10 bg-transparent text-center text-xs font-black text-indigo-700 outline-none" 
                         />
                      </div>
                    </div>
                  </div>

                  {!collapsedQuestions[q.id] && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <RichTextEditor value={q.text} onChange={(val) => updateQuestion(q.id, 'text', val)} label="Énoncé" />
                      
                      <div className="mt-6 space-y-4">
                        {/* Question Type Specific UI (Keeping existing logic but slightly refined) */}
                        {q.type === 'multiple-choice' && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Options de Réponse</label>
                              <div className="flex gap-4">
                                <button
                                  type="button"
                                  disabled={variatingId === q.id || !q.text || !q.options?.some(o => o.text && o.isCorrect)}
                                  onClick={async () => {
                                    setVariatingId(q.id);
                                    try {
                                      const correctOpt = q.options?.find(o => o.isCorrect)?.text || '';
                                      const distractors = await generateDistractors(q.text, correctOpt);
                                      
                                      if (distractors && distractors.length > 0) {
                                        const newOpts = [
                                          q.options?.find(o => o.isCorrect) || { text: correctOpt, isCorrect: true },
                                          ...distractors.map(d => ({ text: d, isCorrect: false }))
                                        ];
                                        updateQuestion(q.id, 'options', newOpts);
                                      }
                                    } catch (err) {
                                      console.error("Distractor generation failed:", err);
                                      toast.error("La génération des distracteurs a échoué.");
                                    } finally {
                                      setVariatingId(null);
                                    }
                                  }}
                                  className={cn(
                                    "text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline flex items-center gap-1",
                                    (variatingId === q.id || !q.text || !q.options?.some(o => o.text && o.isCorrect)) && "opacity-50 cursor-not-allowed"
                                  )}
                                >
                                  {variatingId === q.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                  Compléter avec l'IA
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowBulkOptionsId(q.id)}
                                  className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline flex items-center gap-1"
                                >
                                  Import groupé
                                </button>
                                <button type="button" onClick={() => {
                                  const newOpts = [...(q.options || []), { text: '', isCorrect: false }];
                                  updateQuestion(q.id, 'options', newOpts);
                                }} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">+ Ajouter une option</button>
                              </div>
                            </div>
                            {(q.options || []).map((opt, oIdx) => (
                              <div key={oIdx} className="flex gap-3 items-center group">
                                <input 
                                  type="radio" 
                                  checked={!!opt.isCorrect} 
                                  onChange={() => {
                                    const newOpts = (q.options || []).map((o, i) => ({ ...o, isCorrect: i === oIdx }));
                                    updateQuestion(q.id, 'options', newOpts);
                                  }} 
                                  className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                                <input
                                  type="text"
                                  value={stripHtml(opt.text)}
                                  onChange={(e) => {
                                    const newOpts = [...(q.options || [])];
                                    newOpts[oIdx] = { ...newOpts[oIdx], text: e.target.value };
                                    updateQuestion(q.id, 'options', newOpts);
                                  }}
                                  className={cn(
                                    "flex-1 px-4 py-2.5 bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-xl text-sm font-bold outline-none transition-all",
                                    opt.isCorrect && "bg-emerald-50/50 border-emerald-100 focus:border-emerald-200"
                                  )}
                                  placeholder={`Option ${oIdx + 1}`}
                                />
                                <button type="button" onClick={() => {
                                  const newOpts = (q.options || []).filter((_, i) => i !== oIdx);
                                  updateQuestion(q.id, 'options', newOpts);
                                }} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-rose-500">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Add other types as needed, keeping existing logic for now for brevity */}
                        {q.type === 'true-false' && (
                           <div className="flex gap-4">
                            {[
                              { label: 'Vrai (Correct)', val: true },
                              { label: 'Faux (Correct)', val: false }
                            ].map((item, i) => {
                              const currentCorrect = q.options?.find(o => o.isCorrect)?.text === (i === 0 ? 'Vrai' : 'Faux');
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => {
                                    updateQuestion(q.id, 'options', [
                                      { text: 'Vrai', isCorrect: i === 0 },
                                      { text: 'Faux', isCorrect: i === 1 }
                                    ]);
                                  }}
                                  className={cn(
                                    "flex-1 py-4 rounded-2xl border-2 font-black transition-all",
                                    currentCorrect ? "bg-emerald-50 border-emerald-500 text-emerald-600" : "bg-slate-50 border-transparent text-slate-400 hover:bg-white hover:border-slate-200"
                                  )}
                                >
                                  {item.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {q.type === 'short-answer' && (
                           <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Réponse attendue (IA compare le sens)</label>
                              <textarea
                                value={q.correctAnswer || ''}
                                onChange={(e) => updateQuestion(q.id, 'correctAnswer', e.target.value)}
                                className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl text-sm font-bold outline-none min-h-[100px]"
                                placeholder="Entrez la réponse modèle..."
                              />
                           </div>
                        )}
                        {q.type === 'fill-in-the-blanks' && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mots à remplir</label>
                              <button type="button" onClick={() => {
                                const newAns = [...(q.correctAnswers || []), ''];
                                updateQuestion(q.id, 'correctAnswers', newAns);
                              }} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">+ Ajouter un trou</button>
                            </div>
                            {(q.correctAnswers || []).map((ans, aIdx) => (
                              <div key={aIdx} className="flex gap-3 items-center group">
                                <span className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center font-black text-xs text-slate-400">#{aIdx + 1}</span>
                                <input
                                  type="text"
                                  value={ans}
                                  onChange={(e) => {
                                    const newAns = [...(q.correctAnswers || [])];
                                    newAns[aIdx] = e.target.value;
                                    updateQuestion(q.id, 'correctAnswers', newAns);
                                  }}
                                  className="flex-1 px-4 py-2.5 bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-xl text-sm font-bold outline-none"
                                  placeholder="Mot attendu"
                                />
                                <button type="button" onClick={() => {
                                  const newAns = (q.correctAnswers || []).filter((_, i) => i !== aIdx);
                                  updateQuestion(q.id, 'correctAnswers', newAns);
                                }} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-rose-500">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {q.type === 'ordering' && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Éléments dans le BON ORDRE</label>
                              <button type="button" onClick={() => {
                                const newOpts = [...(q.options || []), { text: '' }];
                                const newOrder = [...(q.correctOrder || []), newOpts.length - 1];
                                updateQuestion(q.id, { options: newOpts, correctOrder: newOrder });
                              }} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">+ Ajouter un élément</button>
                            </div>
                            {(q.options || []).map((opt, oIdx) => (
                              <div key={oIdx} className="flex gap-3 items-center group">
                                <span className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center font-black text-xs text-white shadow-lg">{oIdx + 1}</span>
                                <input
                                  type="text"
                                  value={opt.text}
                                  onChange={(e) => {
                                    const newOpts = [...(q.options || [])];
                                    newOpts[oIdx] = { ...newOpts[oIdx], text: e.target.value };
                                    updateQuestion(q.id, 'options', newOpts);
                                  }}
                                  className="flex-1 px-4 py-2.5 bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-xl text-sm font-bold outline-none transition-all"
                                  placeholder={`Élément ${oIdx + 1}`}
                                />
                                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    type="button" 
                                    disabled={oIdx === 0}
                                    onClick={() => {
                                      const newOpts = [...(q.options || [])];
                                      [newOpts[oIdx], newOpts[oIdx - 1]] = [newOpts[oIdx - 1], newOpts[oIdx]];
                                      updateQuestion(q.id, 'options', newOpts);
                                    }}
                                    className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button 
                                    type="button" 
                                    disabled={oIdx === (q.options || []).length - 1}
                                    onClick={() => {
                                      const newOpts = [...(q.options || [])];
                                      [newOpts[oIdx], newOpts[oIdx + 1]] = [newOpts[oIdx + 1], newOpts[oIdx]];
                                      updateQuestion(q.id, 'options', newOpts);
                                    }}
                                    className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                </div>
                                <button type="button" onClick={() => {
                                  const newOpts = (q.options || []).filter((_, i) => i !== oIdx);
                                  const newOrder = newOpts.map((_, i) => i);
                                  updateQuestion(q.id, { options: newOpts, correctOrder: newOrder });
                                }} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-rose-500">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {q.type === 'matching' && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Paires d'Association</label>
                              <div className="flex gap-4">
                                <button
                                  type="button"
                                  disabled={variatingId === q.id || !q.text}
                                  onClick={async () => {
                                    setVariatingId(q.id);
                                    try {
                                      const pairs = await generateMatchingPairs(q.text);
                                      if (pairs && pairs.length > 0) {
                                        const newOpts = pairs.map(p => ({ text: p.a }));
                                        const newMatchOpts = pairs.map(p => p.b);
                                        const newMatches = pairs.map((_, i) => i);
                                        updateQuestion(q.id, { 
                                          options: newOpts, 
                                          matchOptions: newMatchOpts, 
                                          correctMatches: newMatches 
                                        });
                                      }
                                    } catch (err) {
                                      console.error("Pair generation failed:", err);
                                      toast.error("La génération des paires a échoué.");
                                    } finally {
                                      setVariatingId(null);
                                    }
                                  }}
                                  className={cn(
                                    "text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline flex items-center gap-1",
                                    (variatingId === q.id || !q.text) && "opacity-50 cursor-not-allowed"
                                  )}
                                >
                                  {variatingId === q.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                  Générer avec l'IA
                                </button>
                                <button type="button" onClick={() => {
                                  const newOpts = [...(q.options || []), { text: '' }];
                                  const newMatchOpts = [...(q.matchOptions || []), ''];
                                  const newMatches = [...(q.correctMatches || []), newMatchOpts.length - 1];
                                  updateQuestion(q.id, { 
                                    options: newOpts, 
                                    matchOptions: newMatchOpts, 
                                    correctMatches: newMatches 
                                  });
                                }} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">+ Ajouter une paire</button>
                              </div>
                            </div>
                            
                            <AnimatePresence mode="popLayout">
                              {(q.options || []).map((opt, oIdx) => (
                                <motion.div 
                                  key={oIdx}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  className="grid grid-cols-[1fr,auto,1fr,auto] gap-3 items-center group bg-slate-50/50 p-3 rounded-2xl border-2 border-slate-100/50 hover:border-indigo-100 hover:bg-white transition-all shadow-sm"
                                >
                                  <div className="relative">
                                    <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <input
                                      type="text"
                                      value={opt.text}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          const nextInput = (e.currentTarget.parentElement?.nextElementSibling?.nextElementSibling as HTMLElement)?.querySelector('input');
                                          nextInput?.focus();
                                        }
                                      }}
                                      onChange={(e) => {
                                        const newOpts = [...(q.options || [])];
                                        newOpts[oIdx] = { ...newOpts[oIdx], text: e.target.value };
                                        updateQuestion(q.id, 'options', newOpts);
                                      }}
                                      className="w-full px-4 py-2.5 bg-white border-2 border-transparent focus:border-indigo-100 rounded-xl text-sm font-bold outline-none shadow-sm"
                                      placeholder="Question / Terme"
                                    />
                                  </div>

                                  <div className="relative group/link">
                                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                                      <Link2 className="w-5 h-5" />
                                    </div>
                                    <div className="absolute top-1/2 left-full w-4 h-0.5 bg-indigo-100 -translate-y-1/2 -z-10" />
                                    <div className="absolute top-1/2 right-full w-4 h-0.5 bg-indigo-100 -translate-y-1/2 -z-10" />
                                  </div>

                                  <input
                                    type="text"
                                    value={q.matchOptions?.[oIdx] || ''}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        // Auto-add new row if last one
                                        if (oIdx === (q.options?.length || 0) - 1) {
                                           const newOpts = [...(q.options || []), { text: '' }];
                                           const newMatchOpts = [...(q.matchOptions || []), ''];
                                           const newMatches = [...(q.correctMatches || []), newMatchOpts.length - 1];
                                           updateQuestion(q.id, { options: newOpts, matchOptions: newMatchOpts, correctMatches: newMatches });
                                           setTimeout(() => {
                                              const inputs = document.querySelectorAll(`input`);
                                              const lastInput = inputs[inputs.length - 2]; // Penal-to-last is the new Question input
                                              (lastInput as HTMLElement)?.focus();
                                           }, 50);
                                        }
                                      }
                                    }}
                                    onChange={(e) => {
                                      const newMatchOpts = [...(q.matchOptions || [])];
                                      newMatchOpts[oIdx] = e.target.value;
                                      updateQuestion(q.id, 'matchOptions', newMatchOpts);
                                    }}
                                    className="px-4 py-2.5 bg-white border-2 border-transparent focus:border-indigo-100 rounded-xl text-sm font-bold outline-none shadow-sm"
                                    placeholder="Réponse / Définition"
                                  />
                                  
                                  <button 
                                    type="button" 
                                    onClick={() => {
                                      const newOpts = (q.options || []).filter((_, i) => i !== oIdx);
                                      const newMatchOpts = (q.matchOptions || []).filter((_, i) => i !== oIdx);
                                      const newMatches = newOpts.map((_, i) => i);
                                      updateQuestion(q.id, { 
                                        options: newOpts, 
                                        matchOptions: newMatchOpts, 
                                        correctMatches: newMatches 
                                      });
                                    }} 
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                </motion.div>
                              ))}
                            </AnimatePresence>

                            {(q.options || []).length === 0 && (
                              <div className="py-8 border-2 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center text-slate-400 gap-3">
                                <Link2 className="w-8 h-8 opacity-20" />
                                <p className="text-xs font-bold uppercase tracking-widest">Aucune paire ajoutée</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </Card>
              ))}
              </div>

              {/* Sidebar */}
              <div className="lg:col-span-3 sticky top-24 space-y-6">
                {/* Validation Dashboard */}
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                   <div className="flex flex-col">
                      <h5 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-indigo-500" /> État de l'Examen
                      </h5>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">Vérification en temps réel</p>
                   </div>

                   <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-500 uppercase">Progression</span>
                          <span className="text-xs font-bold text-slate-700">{totalPoints} / {maxPoints} pts</span>
                        </div>
                        <div className={cn("w-2.5 h-2.5 rounded-full", isPointsValid ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-500 uppercase">Questions</span>
                          <span className="text-xs font-bold text-slate-700">{questions.length} total</span>
                        </div>
                        <FileText className="w-4 h-4 text-slate-400" />
                      </div>
                   </div>

                   {/* Errors List */}
                   {(() => {
                     const errors = [];
                     if (totalPoints !== maxPoints) errors.push(`Mauvais barème (${totalPoints}/${maxPoints})`);
                     questions.forEach((q, i) => {
                       if (!q.text || q.text === '<p><br></p>') errors.push(`Q${i+1}: Énoncé vide`);
                       if ((q.type === 'multiple-choice' || q.type === 'true-false') && !q.options?.some(o => o.isCorrect)) errors.push(`Q${i+1}: Pas de réponse correcte`);
                       if (q.type === 'short-answer' && !q.correctAnswer) errors.push(`Q${i+1}: Corrigé manquant`);
                     });
                     
                     if (errors.length === 0) return (
                        <div className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                          <CheckCircle2 className="w-4 h-4" /> Prêt pour publication
                        </div>
                     );

                     return (
                       <div className="space-y-2">
                         <span className="text-[10px] font-black text-rose-500 uppercase pl-1">Erreurs ({errors.length})</span>
                         <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                            {errors.map((err, i) => (
                              <div key={i} className="text-[9px] font-bold text-rose-600 bg-rose-50/50 px-2.5 py-1.5 rounded-lg border border-rose-100/50 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-rose-500 rounded-full shrink-0" />
                                {err}
                              </div>
                            ))}
                         </div>
                       </div>
                     );
                   })()}
                </div>

                {/* Quick Navigation */}
                <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl space-y-4">
                  <div className="flex flex-col">
                    <h5 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-indigo-400" /> Navigation Rapide
                    </h5>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">Cliquez pour défiler</p>
                  </div>
                  <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {questions.map((q, i) => (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => {
                          const el = document.getElementById(`q-${q.id}`);
                          el?.scrollIntoView({ behavior: 'smooth' });
                          setCollapsedQuestions(prev => ({ ...prev, [q.id]: false }));
                        }}
                        className={cn(
                          "w-full aspect-square rounded-xl flex items-center justify-center text-[10px] font-black transition-all",
                          !q.text ? "bg-rose-900/50 text-rose-200 border border-rose-800" : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                        )}
                        title={`Question ${i+1}`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="pt-8 flex gap-4 border-t border-slate-100">
        <Button variant="ghost" onClick={onComplete} className="flex-1 rounded-2xl h-12 font-black uppercase text-xs tracking-widest text-slate-400">Annuler</Button>
        <Button type="submit" disabled={loading || !isPointsValid} className={cn(
          "flex-[2] rounded-2xl h-12 font-black uppercase text-xs tracking-widest shadow-lg shadow-indigo-500/20",
          !isPointsValid && "opacity-50 cursor-not-allowed"
        )}>
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Traitement...
            </div>
          ) : initialData ? 'Mettre à jour l\'Examen' : 'Publier l\'Examen'}
        </Button>
      </div>

      <AnimatePresence>
        {showAiModal && (
          <AIQuestionGeneratorModal 
            examType={examType}
            onQuestionsGenerated={handleAiQuestionsReady}
            onClose={() => setShowAiModal(false)}
          />
        )}

        {showBulkOptionsId && (
          <Modal title="Ajout groupé d'options" onClose={() => setShowBulkOptionsId(null)} maxWidth="max-w-md">
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500 font-medium">Une option par ligne. La première ligne sera marquée comme correcte par défaut.</p>
              <textarea
                value={bulkOptionsText}
                onChange={(e) => setBulkOptionsText(e.target.value)}
                className="w-full h-48 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-100 focus:bg-white transition-all"
                placeholder="Option 1&#10;Option 2&#10;Option 3..."
              />
              <div className="flex gap-3 pt-2">
                 <Button variant="ghost" onClick={() => setShowBulkOptionsId(null)} className="flex-1 rounded-xl font-bold">Annuler</Button>
                 <Button 
                   onClick={() => {
                     const lines = bulkOptionsText.split('\n').map(l => l.trim()).filter(l => l);
                     if (lines.length > 0) {
                        updateQuestion(showBulkOptionsId, { options: lines.map((l, i) => ({ text: l, isCorrect: i === 0 })) });
                     }
                     setShowBulkOptionsId(null);
                     setBulkOptionsText('');
                   }}
                   className="flex-1 rounded-xl font-bold"
                 >
                   Importer
                 </Button>
              </div>
            </div>
          </Modal>
        )}

        {showPreview && (
          <Modal title="Prévisualisation de l'examen" onClose={() => setShowPreview(false)} maxWidth="max-w-4xl">
            <div className="p-8 space-y-12 bg-slate-50 min-h-[80vh]">
              <div className="bg-white p-12 rounded-[2rem] shadow-xl border border-slate-100">
                <div className="text-center mb-12 space-y-3 pb-8 border-b border-slate-100">
                   <h2 className="text-3xl font-black text-slate-900">{title || "Sans titre"}</h2>
                   <div className="flex items-center justify-center gap-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> {(parseInt(durationHours) || 0) * 60 + (parseInt(durationMinutes) || 0)} Minutes</span>
                      <span className="flex items-center gap-2"><Target className="w-3.5 h-3.5" /> {totalPoints} Points</span>
                      <span className="flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> {questions.length} Questions</span>
                   </div>
                </div>

                <div className="space-y-10">
                  {questions.map((q, qIdx) => (
                    <div key={q.id} className="space-y-4">
                      <div className="flex gap-4">
                        <span className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shrink-0">{qIdx + 1}</span>
                        <div className="space-y-4 flex-1">
                          <div className="text-lg font-bold text-slate-800" dangerouslySetInnerHTML={{ __html: q.text }} />
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">[{q.points} point{q.points > 1 ? 's' : ''}]</div>
                          
                          {q.type === 'multiple-choice' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {q.options?.map((opt, oIdx) => (
                                <div key={oIdx} className="p-4 rounded-2xl border-2 border-slate-100 flex items-center gap-3">
                                  <div className="w-5 h-5 rounded-full border-2 border-slate-200" />
                                  <span className="text-sm font-bold text-slate-600">{stripHtml(opt.text)}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {q.type === 'matching' && (
                             <div className="space-y-3">
                               {q.options?.map((opt, oIdx) => (
                                 <div key={oIdx} className="grid grid-cols-[1fr,auto,1fr] gap-6 items-center">
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm font-bold text-slate-600">{stripHtml(opt.text)}</div>
                                    <Link2 className="w-5 h-5 text-slate-300" />
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 border-dashed text-sm font-bold text-slate-400">Associer...</div>
                                 </div>
                               ))}
                             </div>
                          )}

                          {q.type === 'short-answer' && (
                            <div className="w-full h-24 border-2 border-slate-100 border-dashed rounded-2xl" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Modal>
        )}

        {pendingImport && (
          <ImportPreviewModal 
            pendingQuestions={pendingImport}
            onConfirm={onConfirmImport}
            onCancel={() => setPendingImport(null)}
            onUpdateQuestion={onUpdatePendingQuestion}
            onRemoveQuestion={onRemovePendingQuestion}
          />
        )}
        {showImportHelp && (
          <Modal title="Aide au format d'importation" onClose={() => setShowImportHelp(false)} maxWidth="max-w-2xl">
            <div className="p-5 sm:p-8">
              <ImportHelp />
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </form>

  );
};
