import React, { useState } from 'react';
import { Sparkles, Brain, Loader2, CheckCircle2, AlertCircle, Plus, ClipboardList } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { generateQuestions, GeneratedQuestion } from '../../lib/gemini';
import { QuestionType, ExamType } from '../../types';
import { cn } from '../../lib/utils';

interface AIQuestionGeneratorModalProps {
  onQuestionsGenerated: (questions: GeneratedQuestion[]) => void;
  onClose: () => void;
  examType?: ExamType;
}

export const AIQuestionGeneratorModal = ({ onQuestionsGenerated, onClose, examType }: AIQuestionGeneratorModalProps) => {
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(5);
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>(['multiple-choice', 'true-false', 'short-answer']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);

  const handleTypeToggle = (type: QuestionType) => {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    if (selectedTypes.length === 0) {
      setError("Veuillez sélectionner au moins un type de question.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const targetPoints = examType === 'fin-de-module' ? 40 : (examType === 'controle-continu' ? 20 : undefined);
      const questions = await generateQuestions(topic, count, targetPoints, selectedTypes);
      setGeneratedQuestions(questions);
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue lors de la génération.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddAll = () => {
    const sorted = [...generatedQuestions].sort((a, b) => 
      QUESTION_TYPE_ORDER.indexOf(a.type as QuestionType) - QUESTION_TYPE_ORDER.indexOf(b.type as QuestionType)
    );
    onQuestionsGenerated(sorted);
    onClose();
  };

  const totalPoints = generatedQuestions.reduce((sum, q) => sum + q.points, 0);

  const QUESTION_TYPE_ORDER: QuestionType[] = ['multiple-choice', 'true-false', 'short-answer', 'fill-in-the-blanks', 'ordering', 'matching'];

  const groupedQuestions = generatedQuestions.reduce((groups, q) => {
    const type = q.type;
    if (!groups[type]) groups[type] = [];
    groups[type].push(q);
    return groups;
  }, {} as Record<string, GeneratedQuestion[]>);

  const typeLabels: Record<string, string> = {
    'multiple-choice': 'QCM',
    'true-false': 'Vrai/Faux',
    'short-answer': 'Réponse Courte',
    'fill-in-the-blanks': 'Texte à trous',
    'ordering': 'Ordonnancement',
    'matching': 'Appariement'
  };

  return (
    <div className="p-6 sm:p-8 space-y-8">
      <div className="flex items-center justify-between gap-4 bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-200">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Assistant IA Générateur</h3>
            <p className="text-xs text-slate-500 font-medium">Décrivez votre sujet et l'IA créera des questions variées.</p>
          </div>
        </div>
        <div className="px-4 py-2 bg-white rounded-xl border border-indigo-100 shadow-sm">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Type d'examen</span>
          <span className="text-sm font-black text-indigo-600 uppercase">
            {examType === 'fin-de-module' ? 'Fin de Module (40 pts)' : 'Contrôle Continu (20 pts)'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-12 space-y-4">
          <div className="relative">
            <Input 
              label="Sujet de l'examen"
              value={topic} 
              onChange={(e) => setTopic(e.target.value)} 
              placeholder="Ex: Programmation Python, Histoire du Maroc, Anatomie humaine..."
              className="bg-slate-50 border-2 focus:bg-white text-base py-6"
            />
            <Sparkles className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-400 opacity-50 pointer-events-none mt-2" />
          </div>
        </div>
        
        <div className="md:col-span-4 space-y-4">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nombre de questions</label>
          <select 
            value={count} 
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-full px-4 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-2xl text-sm font-bold transition-all outline-none"
          >
            {[3, 5, 8, 10, 12, 15, 20].map(c => <option key={c} value={c}>{c} Questions</option>)}
          </select>
        </div>

        <div className="md:col-span-12 space-y-4">
          <div className="flex items-center justify-between pl-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Types de questions souhaités</label>
            <div className="flex gap-3">
              <button 
                onClick={() => setSelectedTypes(['multiple-choice', 'true-false', 'short-answer', 'fill-in-the-blanks', 'ordering', 'matching'])}
                className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 transition-colors"
              >
                Tout sélectionner
              </button>
              <button 
                onClick={() => setSelectedTypes([])}
                className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-500 transition-colors"
              >
                Tout désélectionner
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'multiple-choice', label: 'QCM' },
              { id: 'true-false', label: 'Vrai/Faux' },
              { id: 'short-answer', label: 'Réponse Courte' },
              { id: 'fill-in-the-blanks', label: 'Texte à trous' },
              { id: 'ordering', label: 'Ordonnancement' },
              { id: 'matching', label: 'Appariement' }
            ].map(type => (
              <button
                key={type.id}
                onClick={() => handleTypeToggle(type.id as QuestionType)}
                className={cn(
                  "px-4 py-3 rounded-xl border-2 font-bold text-xs transition-all flex items-center gap-2",
                  selectedTypes.includes(type.id as QuestionType)
                    ? "bg-indigo-50 border-indigo-600 text-indigo-600 shadow-sm"
                    : "bg-slate-50 border-transparent text-slate-400 hover:bg-white hover:border-slate-200"
                )}
              >
                {selectedTypes.includes(type.id as QuestionType) && <CheckCircle2 className="w-3.5 h-3.5" />}
                {type.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <Button 
          onClick={handleGenerate} 
          disabled={loading || !topic.trim() || selectedTypes.length === 0} 
          className="px-10 py-6 gap-3 text-sm font-black uppercase tracking-widest shadow-xl shadow-indigo-100"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Réflexion en cours...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Générer avec l'IA
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-3 text-rose-600 text-sm font-bold">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {generatedQuestions.length > 0 && !loading && (
        <div className="space-y-6 pt-4 border-t-2 border-slate-50">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-black text-slate-900 tracking-tight uppercase">Aperçu des questions générées</h4>
            <div className="flex gap-2">
              <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase">{generatedQuestions.length} Questions</span>
              <span className={cn(
                "text-[10px] font-black px-3 py-1 rounded-full uppercase",
                totalPoints === (examType === 'fin-de-module' ? 40 : 20) ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
              )}>
                Total: {totalPoints} / {examType === 'fin-de-module' ? 40 : 20} pts
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-8 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {QUESTION_TYPE_ORDER.filter(type => groupedQuestions[type]).map(type => {
              const questions = groupedQuestions[type];
              return (
                <div key={type} className="space-y-4">
                  <div className="flex items-center gap-2 sticky top-0 bg-white py-2 z-10">
                    <div className="h-px bg-slate-100 flex-1" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-3">
                      {typeLabels[type] || type} ({questions.length})
                    </span>
                    <div className="h-px bg-slate-100 flex-1" />
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {questions.map((q, qIdx) => {
                      const originalIdx = generatedQuestions.indexOf(q);
                      return (
                        <Card key={qIdx} className="p-5 border-2 border-slate-50 hover:bg-slate-50/50 transition-colors group">
                          <div className="flex justify-between items-start gap-4">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black px-2 py-0.5 bg-slate-100 text-slate-500 rounded-lg">#{originalIdx + 1}</span>
                                <span className="text-[10px] font-black text-indigo-400">({q.points} pts)</span>
                              </div>
                              <p className="font-bold text-slate-800 text-sm leading-relaxed">{q.text}</p>
                              
                              {q.type === 'multiple-choice' && q.options && (
                                <div className="grid grid-cols-2 gap-2 mt-3">
                                  {q.options.map((opt, oIdx) => (
                                    <div key={oIdx} className={cn(
                                      "text-[10px] p-2 rounded-lg border",
                                      opt.isCorrect ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-bold" : "bg-white border-slate-100 text-slate-400"
                                    )}>
                                      {String.fromCharCode(97 + oIdx)}) {opt.text}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {q.type === 'true-false' && (
                                <div className="flex gap-2 mt-3">
                                  {['Vrai', 'Faux'].map((val) => (
                                    <div key={val} className={cn(
                                      "text-[10px] px-3 py-1.5 rounded-lg border",
                                      q.correctAnswer === val ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-bold" : "bg-white border-slate-100 text-slate-400"
                                    )}>
                                      {val}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {q.type === 'short-answer' && q.correctAnswer && (
                                <div className="mt-3 p-2 bg-indigo-50/30 rounded-lg border border-indigo-100/50">
                                  <span className="text-[9px] font-black text-indigo-400 uppercase block mb-1">Réponse attendue</span>
                                  <p className="text-[10px] text-slate-600 font-medium italic">{q.correctAnswer}</p>
                                </div>
                              )}

                              {q.type === 'fill-in-the-blanks' && q.correctAnswers && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {q.correctAnswers.map((ans, aIdx) => (
                                    <span key={aIdx} className="text-[10px] px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100 font-bold">
                                      [{aIdx + 1}] {ans}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {q.type === 'ordering' && q.options && q.correctOrder && (
                                <div className="mt-3 space-y-1">
                                  <span className="text-[9px] font-black text-indigo-400 uppercase block mb-1">Ordre correct</span>
                                  {q.correctOrder.map((idxVal, oIdx) => (
                                    <div key={oIdx} className="text-[10px] font-medium text-slate-600 flex items-center gap-2">
                                      <span className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-black">{oIdx + 1}</span>
                                      {q.options![idxVal].text}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {q.type === 'matching' && q.options && q.matchOptions && q.correctMatches && (
                                <div className="mt-3 space-y-2">
                                  <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-tight">{q.columnAHeader || 'Gauche'}</div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-tight">{q.columnBHeader || 'Droite'}</div>
                                  </div>
                                  <div className="grid grid-cols-1 gap-1 px-1">
                                    {q.options.map((opt, oIdx) => (
                                      <div key={oIdx} className="text-[10px] font-medium flex items-center gap-2">
                                        <span className="text-slate-500">{opt.text}</span>
                                        <div className="h-px bg-slate-100 flex-1 border-dotted border-b" />
                                        <span className="text-emerald-600 font-bold">{q.matchOptions![q.correctMatches![oIdx]]}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-4 pt-4">
            <Button variant="ghost" onClick={onClose} className="flex-1">Annuler</Button>
            <Button onClick={handleAddAll} className="flex-[2] gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Ajouter ces {generatedQuestions.length} questions
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
