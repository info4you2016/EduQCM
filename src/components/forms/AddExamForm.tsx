import React, { useState, useRef } from 'react';
import { 
  Plus, Clock, Settings, Calendar, Shuffle, CircleHelp, Sparkles, Upload, 
  FileCode, FileText, ArrowUp, ArrowDown, Copy, Trash2, ChevronDown, Info, 
  Target, AlertCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';
import { api } from '../../lib/api';
import { generateQuestions } from '../../lib/gemini';
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

interface AddExamFormProps {
  modules: Module[];
  onComplete: () => void;
  user: UserProfile;
  initialData?: Exam;
}

export const AddExamForm = ({ modules, onComplete, user, initialData }: AddExamFormProps) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [moduleId, setModuleId] = useState<string>(initialData?.moduleId?.toString() || modules[0]?.id?.toString() || '');
  const [examType, setExamType] = useState<ExamType>(initialData?.type || 'controle-continu');
  const [durationHours, setDurationHours] = useState(initialData ? Math.floor(initialData.durationMinutes / 60).toString() : '0');
  const [durationMinutes, setDurationMinutes] = useState(initialData ? (initialData.durationMinutes % 60).toString() : '30');
  const [shuffleQuestions, setShuffleQuestions] = useState(initialData?.shuffleQuestions || false);
  const [scheduledAt, setScheduledAt] = useState(initialData?.scheduledAt ? new Date(initialData.scheduledAt).toISOString().substring(0, 16) : '');
  const [questions, setQuestions] = useState<Question[]>(initialData?.questions || [
    { id: '1', type: 'multiple-choice', text: '', options: [
      { text: '', isCorrect: true },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false }
    ], points: 1 }
  ]);
  const [collapsedQuestions, setCollapsedQuestions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [showImportInfo, setShowImportInfo] = useState(false);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<{question: Question, isValid: boolean, errors: string[]}[] | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showImportHelp, setShowImportHelp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (initialData?.hasResults) {
      alert("Impossible de modifier un examen qui a déjà des résultats.");
      return;
    }
    if (!moduleId) return alert("Veuillez sélectionner un module.");

    const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);
    const maxPoints = examType === 'controle-continu' ? 20 : 40;
    if (totalPoints !== maxPoints) {
      alert(`Le total des points doit être exactement de ${maxPoints} pour un ${examType === 'controle-continu' ? 'Contrôle Continu' : 'Examen de Fin de Module'}. Actuellement: ${totalPoints}`);
      return;
    }
    
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text || q.text === '<p><br></p>') {
        alert(`La question ${i + 1} n'a pas d'énoncé.`);
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
        questions,
        scheduledAt: scheduledAt || null
      };
      if (initialData) {
        await api.exams.update(initialData.id, examData);
      } else {
        await api.exams.create(examData);
      }
      onComplete();
    } catch (error) {
      console.error("Error saving exam:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 px-1">
      <AnimatePresence>
        {pendingImport && (
          <ImportPreviewModal 
            pendingQuestions={pendingImport}
            onConfirm={onConfirmImport}
            onCancel={() => setPendingImport(null)}
            onUpdateQuestion={onUpdatePendingQuestion}
            onRemoveQuestion={onRemovePendingQuestion}
          />
        )}
      </AnimatePresence>

      <div className="space-y-8">
        <section className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-subtle space-y-6">
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
          <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl cursor-pointer">
            <input type="checkbox" checked={shuffleQuestions} onChange={(e) => setShuffleQuestions(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded" />
            <span className="text-sm font-bold text-slate-700">Mélanger les questions</span>
          </label>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h4 className="text-2xl font-black text-slate-900">Questions ({questions.length})</h4>
              <p className={cn(
                "text-[10px] font-black uppercase tracking-widest",
                questions.reduce((sum, q) => sum + (q.points || 0), 0) === (examType === 'controle-continu' ? 20 : 40) ? "text-emerald-500" : "text-amber-500"
              )}>
                Total Points: {questions.reduce((sum, q) => sum + (q.points || 0), 0)} / {examType === 'controle-continu' ? 20 : 40}
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAiModal(true)} className="gap-2 border-indigo-200 bg-indigo-50/30 text-indigo-700 hover:bg-indigo-100/50">
                <Sparkles className="w-4 h-4" /> Générer avec l'IA
              </Button>
              <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 relative overflow-hidden">
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
                  {importProgress !== null ? (
                    <div className="w-4 h-4 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
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
              <Button type="button" size="sm" onClick={addQuestion} className="gap-2">
                <Plus className="w-4 h-4" /> Ajouter
              </Button>
            </div>
          </div>

          <AnimatePresence>
            {showAiModal && (
              <Modal title="Générateur de Questions IA" onClose={() => setShowAiModal(false)} maxWidth="max-w-4xl">
                 <AIQuestionGeneratorModal 
                   onQuestionsGenerated={handleAiQuestionsReady} 
                   onClose={() => setShowAiModal(false)} 
                   examType={examType}
                 />
              </Modal>
            )}
          </AnimatePresence>

          <div className="space-y-4">
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
            {questions.map((q, idx) => (
              <Card key={q.id} className="p-4 border-2 border-slate-100">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                    <select 
                      value={q.type} 
                      onChange={(e) => {
                        const newType = e.target.value as QuestionType;
                        const updates: Partial<Question> = { type: newType };
                        
                        // Initialize correct structures based on type
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
                      className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-bold text-slate-600 outline-none focus:border-indigo-500"
                    >
                      <option value="multiple-choice">QCM</option>
                      <option value="true-false">Vrai/Faux</option>
                      <option value="short-answer">Réponse</option>
                      <option value="fill-in-the-blanks">Trous</option>
                      <option value="ordering">Ordre</option>
                      <option value="matching">Assoc.</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" value={q.points} onChange={(e) => updateQuestion(q.id, 'points', Number(e.target.value))} className="w-12 text-center text-xs font-bold border rounded p-1" />
                    <button type="button" onClick={() => removeQuestion(idx)} className="p-1 text-slate-400 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <RichTextEditor value={q.text} onChange={(val) => updateQuestion(q.id, 'text', val)} label="Énoncé" />
                
                <div className="mt-6 space-y-4">
                  {/* Multiple Choice */}
                  {q.type === 'multiple-choice' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Options</label>
                        <button type="button" onClick={() => {
                          const newOpts = [...(q.options || []), { text: '', isCorrect: false }];
                          updateQuestion(q.id, 'options', newOpts);
                        }} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">+ Ajouter</button>
                      </div>
                      {(q.options || []).map((opt, oIdx) => (
                        <div key={oIdx} className="flex gap-3 items-center group">
                          <input 
                            type="radio" 
                            checked={opt.isCorrect} 
                            onChange={() => {
                              const newOpts = (q.options || []).map((o, i) => ({ ...o, isCorrect: i === oIdx }));
                              updateQuestion(q.id, 'options', newOpts);
                            }} 
                            className="w-5 h-5 text-indigo-600"
                          />
                          <input
                            type="text"
                            value={stripHtml(opt.text)}
                            onChange={(e) => {
                              const newOpts = [...(q.options || [])];
                              newOpts[oIdx] = { ...newOpts[oIdx], text: e.target.value };
                              updateQuestion(q.id, 'options', newOpts);
                            }}
                            className="flex-1 px-4 py-2 bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-xl text-sm font-bold outline-none"
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

                  {/* True / False */}
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
                              currentCorrect ? "bg-indigo-50 border-indigo-600 text-indigo-600" : "bg-slate-50 border-transparent text-slate-400 hover:bg-white hover:border-slate-200"
                            )}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Short Answer */}
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

                  {/* Fill-in-the-blanks */}
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
                            className="flex-1 px-4 py-2 bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-xl text-sm font-bold outline-none"
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

                  {/* Ordering */}
                  {q.type === 'ordering' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Éléments (dans l'ordre correct)</label>
                        <button type="button" onClick={() => {
                          const newOpts = [...(q.options || []), { text: '', isCorrect: false }];
                          const newOrder = newOpts.map((_, i) => i);
                          updateQuestion(q.id, { options: newOpts, correctOrder: newOrder });
                        }} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">+ Ajouter</button>
                      </div>
                      {(q.options || []).map((opt, oIdx) => (
                        <div key={oIdx} className="flex gap-3 items-center group">
                          <span className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center font-black text-xs text-indigo-600">{oIdx + 1}</span>
                          <input
                            type="text"
                            value={stripHtml(opt.text)}
                            onChange={(e) => {
                              const newOpts = [...(q.options || [])];
                              newOpts[oIdx] = { ...newOpts[oIdx], text: e.target.value };
                              updateQuestion(q.id, 'options', newOpts);
                            }}
                            className="flex-1 px-4 py-2 bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-xl text-sm font-bold outline-none"
                          />
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

                  {/* Matching */}
                  {q.type === 'matching' && (
                    <div className="space-y-4">
                       <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Paires d'associations (Tableau 3 Colonnes)</label>
                        <button type="button" onClick={() => {
                          const newOpts = [...(q.options || []), { text: '', isCorrect: false }];
                          const newMatchOpts = [...(q.matchOptions || []), ''];
                          // When adding a new pair, it matches itself by default in the original order
                          const newMatches = [...(q.correctMatches || []), (q.matchOptions || []).length];
                          updateQuestion(q.id, { options: newOpts, matchOptions: newMatchOpts, correctMatches: newMatches });
                        }} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">+ Ajouter une paire</button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-2">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase text-slate-400 pl-1">Entête Colonne Gauche</label>
                          <input
                            type="text"
                            value={q.columnAHeader || ''}
                            onChange={(e) => updateQuestion(q.id, 'columnAHeader', e.target.value)}
                            placeholder="Ex: Terme, Concept, Pays..."
                            className="w-full px-3 py-2 bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-xl text-xs font-bold outline-none"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase text-slate-400 pl-1">Entête Colonne Droite</label>
                          <input
                            type="text"
                            value={q.columnBHeader || ''}
                            onChange={(e) => updateQuestion(q.id, 'columnBHeader', e.target.value)}
                            placeholder="Ex: Définition, Capitale..."
                            className="w-full px-3 py-2 bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-xl text-xs font-bold outline-none"
                          />
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                            <tr>
                              <th className="px-4 py-3 border-b border-slate-100">{q.columnAHeader || 'Élément Gauche'}</th>
                              <th className="px-2 py-3 border-b border-slate-100 text-center w-16">Match</th>
                              <th className="px-4 py-3 border-b border-slate-100">{q.columnBHeader || 'Élément Droite'}</th>
                              <th className="px-4 py-3 border-b border-slate-100 w-12"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {(q.options || []).map((opt, oIdx) => (
                              <tr key={oIdx} className="group hover:bg-slate-50/30 transition-colors">
                                <td className="px-4 py-3">
                                  <input
                                    type="text"
                                    value={stripHtml(opt.text)}
                                    onChange={(e) => {
                                      const newOpts = [...(q.options || [])];
                                      newOpts[oIdx] = { ...newOpts[oIdx], text: e.target.value };
                                      updateQuestion(q.id, 'options', newOpts);
                                    }}
                                    className="w-full px-3 py-2 bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-xl text-xs font-bold outline-none shadow-sm transition-all"
                                    placeholder="Libellé gauche"
                                  />
                                </td>
                                <td className="px-2 py-3 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="text-[8px] font-bold text-slate-300 uppercase">Correct</span>
                                    <select
                                      value={q.correctMatches?.[oIdx] ?? oIdx}
                                      onChange={(e) => {
                                        const newMatches = [...(q.correctMatches || [])];
                                        newMatches[oIdx] = Number(e.target.value);
                                        updateQuestion(q.id, 'correctMatches', newMatches);
                                      }}
                                      className="bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-black rounded px-1.5 py-0.5 outline-none hover:bg-indigo-100 transition-colors"
                                    >
                                      {(q.matchOptions || []).map((_, mIdx) => (
                                        <option key={mIdx} value={mIdx}>→ {mIdx + 1}</option>
                                      ))}
                                    </select>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="relative group/field">
                                    <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-white border border-slate-200 rounded text-[8px] font-bold text-slate-400 flex items-center justify-center z-10">{oIdx + 1}</span>
                                    <input
                                      type="text"
                                      value={q.matchOptions?.[oIdx] || ''}
                                      onChange={(e) => {
                                        const newMatchOpts = [...(q.matchOptions || [])];
                                        newMatchOpts[oIdx] = e.target.value;
                                        updateQuestion(q.id, 'matchOptions', newMatchOpts);
                                      }}
                                      className="w-full px-3 py-2 bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-xl text-xs font-bold outline-none shadow-sm transition-all"
                                      placeholder="Libellé droite"
                                    />
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <button type="button" onClick={() => {
                                    const newOpts = (q.options || []).filter((_, i) => i !== oIdx);
                                    const newMatchOpts = (q.matchOptions || []).filter((_, i) => i !== oIdx);
                                    // Reset matches to be simple i -> i for the remaining elements to avoid index errors
                                    const resetMatches = newOpts.map((_, i) => i);
                                    updateQuestion(q.id, { options: newOpts, matchOptions: newMatchOpts, correctMatches: resetMatches });
                                  }} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all p-1.5 hover:bg-rose-50 rounded-lg">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex justify-between items-center px-1">
                        <p className="text-[9px] font-medium text-slate-400 italic">
                          L'élève devra associer chaque élément de gauche à son correspondant à droite par un glisser-déposer.
                        </p>
                        <button 
                          type="button" 
                          onClick={() => {
                            // Manual shuffle of match options for the user to see the effect
                            const matchItems = (q.matchOptions || []).map((text, index) => ({ text, index }));
                            const correctMatches = q.correctMatches || (q.options || []).map((_, i) => i);
                            
                            for (let i = matchItems.length - 1; i > 0; i--) {
                              const j = Math.floor(Math.random() * (i + 1));
                              [matchItems[i], matchItems[j]] = [matchItems[j], matchItems[i]];
                            }
                            
                            const newCorrectMatches = correctMatches.map(origIdx => 
                              matchItems.findIndex(item => item.index === origIdx)
                            );
                            
                            updateQuestion(q.id, { 
                              matchOptions: matchItems.map(item => item.text),
                              correctMatches: newCorrectMatches
                            });
                          }}
                          className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 flex items-center gap-1.5 transition-colors"
                        >
                          <Shuffle className="w-3 h-3" /> Mélanger la colonne droite
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>

      <div className="pt-8 flex gap-4">
        <Button variant="ghost" onClick={onComplete} className="flex-1">Annuler</Button>
        <Button type="submit" disabled={loading} className="flex-[2]">
          {loading ? 'Traitement...' : initialData ? 'Mettre à jour' : 'Publier'}
        </Button>
      </div>

      <AnimatePresence>
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
