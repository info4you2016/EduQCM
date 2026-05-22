import React, { useState } from 'react';
import { Sparkles, Send, BrainCircuit, ClipboardList, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateQuestions } from '../../lib/gemini';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Module, Question } from '../../types';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';

interface AiAssistantViewProps {
  modules: Module[];
  onRefresh: () => void;
  onSelectTab: (tab: string) => void;
}

export const AiAssistantView = ({ modules, onRefresh, onSelectTab }: AiAssistantViewProps) => {
  const [prompt, setPrompt] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState<number>(modules[0]?.id || 0);
  const [difficulty, setDifficulty] = useState('Standard');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedExam, setGeneratedExam] = useState<{ title: string, questions: Question[] } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleGenerate = async () => {
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
      alert("La génération a échoué. Veuillez réessayer.");
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
        description: `Généré par IA à partir du sujet: ${prompt} (${difficulty})`
      });
      alert("Examen sauvegardé en tant que brouillon !");
      onRefresh();
      onSelectTab('exams');
    } catch (err) {
      console.error("Failed to save exam:", err);
      alert("Erreur lors de la sauvegarde.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-200">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 font-serif italic tracking-tight">Assistant IA Pédagogique</h2>
            <p className="text-slate-500 font-medium">Générez des contenus pédagogiques de haute qualité en quelques secondes.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Input Panel */}
        <div className="lg:col-span-12">
          <Card className="p-8 border-none shadow-2xl shadow-slate-200/50 space-y-8 bg-slate-900 text-white relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-3xl transition-all duration-1000 group-hover:bg-indigo-500/20" />
             
             <div className="relative z-10 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-xl font-black tracking-tight">Générateur d'Examen Intelligent</h3>
                  <p className="text-slate-400 text-sm font-medium leading-relaxed">
                    Décrivez le sujet ou collez le contenu du cours. L'IA analysera le niveau et créera un examen complet avec QCM, Vrai/Faux, et questions à réponse courte.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] ml-1">Module Cible</label>
                      <select 
                        value={selectedModuleId} 
                        onChange={(e) => setSelectedModuleId(Number(e.target.value))}
                        className="w-full px-5 py-4 bg-white/5 border-2 border-white/10 rounded-2xl text-white font-bold outline-none focus:border-indigo-500/50 transition-all appearance-none"
                      >
                         {modules.map(m => <option key={m.id} value={m.id} className="text-slate-900">{m.name}</option>)}
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] ml-1">Niveau de Difficulté</label>
                      <select 
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value)}
                        className="w-full px-5 py-4 bg-white/5 border-2 border-white/10 rounded-2xl text-white font-bold outline-none focus:border-indigo-500/50 transition-all appearance-none"
                      >
                         <option value="Fondamental" className="text-slate-900">Fondamental (Facile)</option>
                         <option value="Standard" className="text-slate-900">Standard (Moyen)</option>
                         <option value="Avancé" className="text-slate-900">Avancé (Difficile)</option>
                      </select>
                   </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] ml-1">Sujet ou Contenu</label>
                   <textarea
                     value={prompt}
                     onChange={(e) => setPrompt(e.target.value)}
                     placeholder="Décrivez les objectifs de l'examen ou collez un texte de cours ici..."
                     className="w-full min-h-[150px] p-6 bg-white/5 border-2 border-white/10 rounded-[2rem] text-white placeholder-slate-500 font-medium outline-none focus:border-indigo-500/50 transition-all resize-none"
                   />
                </div>

                <Button 
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt}
                  className="w-full py-8 rounded-[2rem] bg-indigo-600 hover:bg-indigo-500 text-white font-black text-lg gap-3 shadow-xl shadow-indigo-900/40 border-none"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Génération en cours...
                    </>
                  ) : (
                    <>
                      <BrainCircuit className="w-6 h-6" />
                      Générer l'examen complet
                    </>
                  )}
                </Button>
             </div>
          </Card>
        </div>

        {/* Results Panel */}
        <AnimatePresence>
          {generatedExam && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-12 space-y-8"
            >
              <div className="flex items-center justify-between">
                 <h3 className="text-2xl font-black text-slate-900 tracking-tight">Aperçu du contenu généré</h3>
                 <div className="flex gap-4">
                    <Button variant="outline" onClick={() => setGeneratedExam(null)} className="rounded-full px-6">Supprimer</Button>
                    <Button onClick={handleSaveExam} disabled={isSaving} className="rounded-full px-8 bg-emerald-600 hover:bg-emerald-500">
                       {isSaving ? "Sauvegarde..." : "Sauvegarder l'examen"}
                    </Button>
                 </div>
              </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {generatedExam.questions.map((q, idx) => (
                  <Card key={idx} className="p-6 border-2 border-slate-50 hover:border-indigo-100 transition-all duration-300 rounded-[2rem] space-y-4 group/q">
                     <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black bg-slate-100 text-slate-400 px-2 py-0.5 rounded-lg uppercase tracking-widest">Question {idx + 1}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{q.type}</span>
                          <button 
                            onClick={() => removeQuestion(idx)}
                            className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover/q:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                     </div>
                     <textarea 
                        value={q.text || ''}
                        onChange={(e) => updateQuestion(idx, 'text', e.target.value)}
                        className="w-full bg-transparent font-bold text-slate-800 leading-relaxed border-none focus:ring-0 p-0 resize-none overflow-hidden"
                        rows={2}
                     />
                     {q.options && (
                       <div className="space-y-2">
                          {q.options.map((opt, i) => {
                            const isCorrect = typeof opt === 'string' ? opt === q.correctAnswer : (opt as any).isCorrect;
                            const text = typeof opt === 'string' ? opt : (opt as any).text;
                            return (
                              <div key={i} className={cn(
                                "text-xs p-3 rounded-xl border font-medium",
                                isCorrect ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-slate-50 border-slate-100 text-slate-500"
                              )}>
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
    </div>
  );
};
