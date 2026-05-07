import React, { useMemo } from 'react';
import { Clock, ClipboardList, Plus, FileCode, FileText, CheckCircle2, Eye } from 'lucide-react';
import { saveAs } from 'file-saver';
import Papa from 'papaparse';
import { cn, stripHtml, normalizeQuestion, formatDuration } from '../../lib/utils';
import { Exam } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface ExamPreviewModalProps {
  exam: Exam;
  onClose: () => void;
  moduleName?: string;
}

export const ExamPreviewModal = React.memo(({ exam, onClose, moduleName }: ExamPreviewModalProps) => {
  const totalPoints = useMemo(() => {
    return exam.questions.reduce((sum, q) => sum + (normalizeQuestion(q).points || 1), 0);
  }, [exam.questions]);

  return (
    <Modal title={`Aperçu de l'examen - ${exam.title}`} onClose={onClose} maxWidth="sm:max-w-[80%]">
      <div className="p-5 sm:p-8 space-y-6 w-full">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-slate-900">{exam.title}</h4>
              {moduleName && (
                <span className="text-[10px] font-black bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full uppercase tracking-widest">
                  {moduleName}
                </span>
              )}
              {exam.type && (
                <span className={cn(
                  "text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest",
                  exam.type === 'fin-de-module' ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                )}>
                  {exam.type === 'fin-de-module' ? 'Fin de Module (40 pts)' : 'Contrôle Continu (20 pts)'}
                </span>
              )}
              <span className="text-[10px] font-black bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full uppercase tracking-widest">
                {totalPoints} point{totalPoints > 1 ? 's' : ''} au total
              </span>
            </div>
            <p className="text-sm text-slate-500">{exam.description || 'Pas de description.'}</p>
            <div className="flex gap-2 mt-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="text-[10px] h-7 gap-1.5 font-bold uppercase tracking-wider"
                onClick={() => {
                  const data = exam.questions.map(q => {
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
                  saveAs(blob, `questions_${stripHtml(exam.title).replace(/\s+/g, '_')}.json`);
                }}
              >
                <FileCode className="w-3.5 h-3.5" /> JSON
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="text-[10px] h-7 gap-1.5 font-bold uppercase tracking-wider"
                onClick={() => {
                  const data = exam.questions.map(q => {
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
                  saveAs(blob, `questions_${stripHtml(exam.title).replace(/\s+/g, '_')}.csv`);
                }}
              >
                <FileText className="w-3.5 h-3.5" /> CSV
              </Button>
            </div>
          </div>
          <div className="text-right space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase justify-end">
              <Clock className="w-3.5 h-3.5" /> {formatDuration(exam.durationMinutes)}
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase justify-end">
              <ClipboardList className="w-3.5 h-3.5" /> {exam.questions.length} questions
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-500 uppercase justify-end">
              <Plus className="w-3.5 h-3.5" /> {totalPoints} points total
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h5 className="font-bold text-slate-900 flex items-center gap-2">
            <Eye className="w-4 h-4 text-indigo-600" />
            Contenu de l'examen
          </h5>
          <div className="space-y-6 w-full">
            {exam.questions.map((rawQ, idx) => {
              const q = normalizeQuestion(rawQ);
              return (
                <div key={q.id || idx} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-indigo-200 transition-colors">
                  <div className="flex justify-between items-start gap-4 mb-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-sm shadow-indigo-100">
                        {idx + 1}
                      </span>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase tracking-widest w-fit mb-1">
                          {q.type}
                        </span>
                        <div className="prose prose-base max-w-none font-semibold text-slate-950 leading-relaxed break-normal overflow-x-auto">
                          {q.type === 'fill-in-the-blanks' ? (
                            <span>
                              {q.text.split(/\[blank\]/g).map((part, i, arr) => (
                                <React.Fragment key={i}>
                                  <span dangerouslySetInnerHTML={{ __html: part }} />
                                  {i < arr.length - 1 && (
                                    <span className="inline-block mx-1 px-3 py-0.5 bg-indigo-50 border-b-2 border-indigo-400 rounded text-indigo-700 font-black min-w-[80px] text-center">
                                      [{q.correctAnswers?.[i] || '...'}]
                                    </span>
                                  )}
                                </React.Fragment>
                              ))}
                            </span>
                          ) : (
                            <div dangerouslySetInnerHTML={{ __html: q.text }} />
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                      {q.points} pt{q.points > 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  <div className="space-y-3 ml-11">
                    {(q.type === 'multiple-choice' || q.type === 'true-false') && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options?.map((opt, oIdx) => (
                          <div key={oIdx} className={cn(
                            "px-4 py-2.5 rounded-xl text-xs border flex items-center justify-between transition-all",
                            opt.isCorrect 
                              ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-bold ring-2 ring-emerald-500/10" 
                              : "bg-slate-50 border-slate-100 text-slate-600"
                          )}>
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                                opt.isCorrect ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"
                              )}>
                                {opt.isCorrect && <CheckCircle2 className="w-3 h-3" />}
                              </div>
                              <span dangerouslySetInnerHTML={{ __html: opt.text }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {q.type === 'short-answer' && (
                      <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl space-y-1">
                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Réponse attendue</p>
                        <p className="text-sm font-bold text-emerald-900" dangerouslySetInnerHTML={{ __html: q.correctAnswer || '' }} />
                      </div>
                    )}

                    {q.type === 'fill-in-the-blanks' && (
                      <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl space-y-2">
                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Mots attendus (dans l'ordre)</p>
                        <div className="flex flex-wrap gap-2">
                          {q.correctAnswers?.map((ans, aIdx) => (
                            <span key={aIdx} className="bg-white px-2 py-1 rounded-lg border border-emerald-200 text-xs font-bold text-emerald-700">
                              {aIdx + 1}. {ans}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {q.type === 'ordering' && (
                      <div className="space-y-2">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Ordre correct</p>
                        <div className="space-y-1.5">
                          {q.correctOrder?.map((optIdx, oIdx) => (
                            <div key={oIdx} className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                              <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black shrink-0 shadow-sm">
                                {oIdx + 1}
                              </span>
                              <span className="text-xs font-bold text-emerald-900" dangerouslySetInnerHTML={{ __html: q.options?.[optIdx]?.text || '' }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {q.type === 'matching' && (
                      <div className="space-y-2">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Associations correctes</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.options?.map((opt, oIdx) => (
                            <div key={oIdx} className="flex flex-col gap-1 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                              <div className="flex items-center justify-between gap-2 border-b border-emerald-200 pb-1 mb-1">
                                <span className="text-[8px] font-black text-emerald-500 uppercase">Élément A</span>
                                <span className="text-[8px] font-black text-indigo-500 uppercase">Association B</span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-xs font-bold text-emerald-900" dangerouslySetInnerHTML={{ __html: opt.text }} />
                                <span className="text-xs font-bold text-indigo-600">{q.matchOptions?.[q.correctMatches?.[oIdx] as number]}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
});
