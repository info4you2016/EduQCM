import React, { useState } from 'react';
import { Edit2, Trash2, AlertCircle, Check, Filter } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Question, QuestionType } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { RichTextEditor } from '../ui/RichTextEditor';

interface ImportPreviewModalProps {
  pendingQuestions: { question: Question, isValid: boolean, errors: string[] }[];
  onConfirm: () => void;
  onCancel: () => void;
  onUpdateQuestion: (idx: number, updates: Partial<Question>) => void;
  onRemoveQuestion: (idx: number) => void;
}

export const ImportPreviewModal = ({ 
  pendingQuestions, 
  onConfirm, 
  onCancel,
  onUpdateQuestion,
  onRemoveQuestion
}: ImportPreviewModalProps) => {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [showOnlyInvalid, setShowOnlyInvalid] = useState(false);

  const validCount = pendingQuestions.filter(p => p.isValid).length;
  const invalidCount = pendingQuestions.length - validCount;

  const filteredQuestions = showOnlyInvalid 
    ? pendingQuestions.map((q, idx) => ({ ...q, originalIdx: idx })).filter(q => !q.isValid)
    : pendingQuestions.map((q, idx) => ({ ...q, originalIdx: idx }));

  return (
    <Modal title="Aperçu de l'importation" onClose={onCancel} maxWidth="max-w-4xl">
      <div className="flex flex-col h-full sm:max-h-[85vh]">
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs sm:text-sm font-bold text-slate-600">{validCount} valides</span>
            </div>
            {invalidCount > 0 && (
              <button 
                onClick={() => setShowOnlyInvalid(!showOnlyInvalid)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 transition-all",
                  showOnlyInvalid ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
                )}
              >
                <div className={cn("w-2 h-2 rounded-full", showOnlyInvalid ? "bg-rose-500 animate-pulse" : "bg-rose-500")} />
                <span className="text-xs font-black uppercase tracking-widest">{invalidCount} erreurs</span>
                <Filter className="w-3 h-3 ml-1" />
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{pendingQuestions.length} questions au total</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar">
          {filteredQuestions.length === 0 && showOnlyInvalid && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-4">
              <Check className="w-12 h-12 text-emerald-500 bg-emerald-50 p-3 rounded-full" />
              <p className="font-bold text-sm">Félicitations ! Toutes les questions sont valides.</p>
              <Button variant="outline" size="sm" onClick={() => setShowOnlyInvalid(false)}>Tout afficher</Button>
            </div>
          )}
          {filteredQuestions.map((item, fIdx) => {
            const idx = item.originalIdx;
            return (
              <div 
                key={idx} 
                className={cn(
                  "p-4 sm:p-5 rounded-2xl border transition-all",
                  item.isValid ? "bg-white border-slate-100" : "bg-rose-50/30 border-rose-200 shadow-lg shadow-rose-500/5 translate-x-1 border-l-4"
                )}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 w-5">#{idx + 1}</span>
                    <span className="text-[10px] font-black uppercase text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                      {item.question.type}
                    </span>
                    {!item.isValid && (
                      <span className="text-[9px] font-black uppercase text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> À corriger
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
                      className={cn(
                        "p-1.5 transition-all rounded-lg",
                        editingIdx === idx ? "text-indigo-600 bg-indigo-50" : "text-slate-400 hover:text-indigo-600 hover:bg-white"
                      )}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      type="button"
                      onClick={() => onRemoveQuestion(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-white rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm text-slate-700 font-medium line-clamp-2" dangerouslySetInnerHTML={{ __html: item.question.text || '<span class="italic text-slate-400">Pas d\'énoncé</span>' }} />
                  
                  {!item.isValid && (
                    <div className="space-y-1.5 mt-3 p-3 bg-rose-50/50 rounded-xl border border-rose-100/50">
                      {item.errors.map((err, eIdx) => (
                        <div key={eIdx} className="flex items-center gap-1.5 text-rose-600 text-[10px] font-black uppercase tracking-wide">
                          <AlertCircle className="w-3 h-3" />
                          {err}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {editingIdx === idx && (
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <RichTextEditor 
                    label="Énoncé" 
                    value={item.question.text} 
                    onChange={(val) => onUpdateQuestion(idx, { text: val })} 
                  />
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase">Points</label>
                      <input 
                        type="number" 
                        value={item.question.points} 
                        onChange={(e) => onUpdateQuestion(idx, { points: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-xs font-bold text-slate-400 uppercase">Type</label>
                       <select 
                        value={item.question.type} 
                        onChange={(e) => onUpdateQuestion(idx, { type: e.target.value as QuestionType })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
                       >
                         <option value="multiple-choice">Choix multiple</option>
                         <option value="true-false">Vrai / Faux</option>
                         <option value="short-answer">Réponse courte</option>
                         <option value="fill-in-the-blanks">Texte à trous</option>
                         <option value="ordering">Mise en ordre</option>
                         <option value="matching">Association</option>
                       </select>
                    </div>
                  </div>

                  {item.question.type === 'short-answer' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase">Réponse attendue</label>
                      <RichTextEditor 
                        theme="bubble"
                        value={item.question.correctAnswer || ''} 
                        onChange={(val) => onUpdateQuestion(idx, { correctAnswer: val })}
                        className="bg-white border border-slate-200 rounded-lg min-h-[60px]"
                      />
                    </div>
                  )}

                  {(item.question.type === 'multiple-choice' || item.question.type === 'true-false') && (
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-400 uppercase">Options</label>
                       {(item.question.options || []).map((opt, oIdx) => (
                         <div key={oIdx} className="flex items-center gap-2">
                           <input 
                            type="radio" 
                            name={`correct-preview-${idx}`}
                            checked={opt.isCorrect} 
                            onChange={() => {
                              const newOpts = [...(item.question.options || [])].map((o, i) => ({ ...o, isCorrect: i === oIdx }));
                              onUpdateQuestion(idx, { options: newOpts });
                            }}
                           />
                           <div className="flex-1">
                             <RichTextEditor 
                              theme="bubble"
                              value={opt.text} 
                              onChange={(val) => {
                                const newOpts = [...(item.question.options || [])];
                                newOpts[oIdx] = { ...newOpts[oIdx], text: val };
                                onUpdateQuestion(idx, { options: newOpts });
                              }}
                              className="bg-white border border-slate-200 rounded-lg min-h-[40px]"
                             />
                           </div>
                         </div>
                       ))}
                    </div>
                  )}

                  {item.question.type === 'ordering' && (
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-400 uppercase">Éléments</label>
                       {(item.question.options || []).map((opt, oIdx) => (
                         <div key={oIdx} className="flex items-center gap-2">
                           <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">{oIdx + 1}</div>
                           <div className="flex-1">
                             <RichTextEditor 
                              theme="bubble"
                              value={opt.text} 
                              onChange={(val) => {
                                const newOpts = [...(item.question.options || [])];
                                newOpts[oIdx] = { ...newOpts[oIdx], text: val };
                                onUpdateQuestion(idx, { options: newOpts });
                              }}
                              className="bg-white border border-slate-200 rounded-lg min-h-[40px]"
                             />
                           </div>
                         </div>
                       ))}
                    </div>
                  )}

                  {item.question.type === 'matching' && (
                    <div className="space-y-3">
                       <label className="text-xs font-bold text-slate-400 uppercase">Associations (Tableau 3 Colonnes)</label>
                       <div className="overflow-x-auto rounded-xl border border-slate-100">
                         <table className="w-full text-xs text-left border-collapse">
                           <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                             <tr>
                               <th className="px-4 py-3 border-b border-slate-100">Élément Gauche</th>
                               <th className="px-2 py-3 border-b border-slate-100 text-center w-12">Lien</th>
                               <th className="px-4 py-3 border-b border-slate-100">Élément Droite mélangé</th>
                             </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-50">
                             {(item.question.options || []).map((opt, oIdx) => (
                               <tr key={oIdx} className="group hover:bg-slate-50/30 transition-colors">
                                 <td className="px-4 py-3 align-top">
                                   <RichTextEditor 
                                     theme="bubble"
                                     value={opt.text} 
                                     onChange={(val) => {
                                       const newOpts = [...(item.question.options || [])];
                                       newOpts[oIdx] = { ...newOpts[oIdx], text: val };
                                       onUpdateQuestion(idx, { options: newOpts });
                                     }}
                                     className="bg-white border border-slate-200 rounded-lg min-h-[40px] focus-within:border-indigo-300 transition-colors"
                                   />
                                 </td>
                                 <td className="px-2 py-3 align-middle text-center text-slate-300">
                                   <div className="flex justify-center items-center h-full">
                                     <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:border-indigo-100 group-hover:text-indigo-400 transition-all">
                                       <Filter className="w-3.5 h-3.5 rotate-90" />
                                     </div>
                                   </div>
                                 </td>
                                 <td className="px-4 py-3 align-top">
                                   <RichTextEditor 
                                     theme="bubble"
                                     value={item.question.matchOptions?.[oIdx] || ''} 
                                     onChange={(val) => {
                                       const newMatch = [...(item.question.matchOptions || [])];
                                       newMatch[oIdx] = val;
                                       onUpdateQuestion(idx, { matchOptions: newMatch });
                                     }}
                                     className="bg-white border border-slate-200 rounded-lg min-h-[40px] focus-within:border-indigo-300 transition-colors"
                                   />
                                 </td>
                               </tr>
                             ))}
                           </tbody>
                         </table>
                       </div>
                       <p className="text-[9px] font-medium text-slate-400 italic px-1">Note: En cas d'importation, les éléments de droite sont automatiquement mélangés pour le test de l'aperçu.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
          })}
        </div>

        <div className="p-5 sm:p-6 border-t border-slate-100 bg-white flex flex-col sm:flex-row justify-end gap-3 shrink-0">
          <Button variant="outline" type="button" onClick={onCancel}>Tout annuler</Button>
          <Button 
            type="button"
            onClick={onConfirm} 
            disabled={pendingQuestions.length === 0 || invalidCount > 0}
            className="gap-2"
          >
            {invalidCount > 0 ? (
              <>Corrigez les {invalidCount} erreurs pour continuer</>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Importer {pendingQuestions.length} questions
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
