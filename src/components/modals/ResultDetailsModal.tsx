import React from 'react';
import { CheckCircle2, XCircle, MinusCircle, HelpCircle, ArrowLeft, Sparkles } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Exam, Result } from '../../types';
import { cn, formatScore, formatPercent } from '../../lib/utils';
import { Button } from '../ui/Button';

interface ResultDetailsModalProps {
  exam: Exam;
  result: Result;
  onClose: () => void;
}

export const ResultDetailsModal = ({ exam, result, onClose }: ResultDetailsModalProps) => {
  const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text || '');

  return (
    <Modal title={`Résultats : ${exam.title}`} onClose={onClose} maxWidth="max-w-4xl">
      <div className="flex flex-col h-full bg-slate-50/10">
        {/* AI Insight Header */}
        {(result.score / (result.totalPoints || 1)) < 1 && (
          <div className="mx-5 sm:mx-8 mt-5 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-white border border-indigo-200 flex items-center justify-center shrink-0">
               <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Analyse de l'IA Assistant</p>
              <p className="text-xs font-medium text-slate-600 leading-relaxed italic">
                {result.score / result.totalPoints >= 0.8 
                  ? "Excellente performance ! Vous maîtrisez bien les concepts clés. Concentrez-vous sur les détails techniques pour atteindre la perfection." 
                  : result.score / result.totalPoints >= 0.5
                  ? "Bon travail, mais certains points méritent d'être revus. Analysez vos erreurs ci-dessous pour mieux comprendre les nuances du module."
                  : "Attention, les fondamentaux ne semblent pas encore acquis. Je vous recommande de revoir le support de cours de ce module et de retenter l'exercice."}
              </p>
            </div>
          </div>
        )}

        {/* Header Stats */}
        <div className="p-5 sm:p-8 bg-white border-b border-slate-100 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            <div>
              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Score Final</p>
              <p className="text-2xl sm:text-3xl font-black text-indigo-600 font-display">{formatScore(result.score)} <span className="text-[10px] sm:text-xs font-bold text-slate-300 tracking-tighter">/ {result.totalPoints}</span></p>
            </div>
            <div>
              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Précision</p>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 font-display">{formatPercent((result.score / (result.totalPoints || 1)) * 100)}%</p>
            </div>
            <div>
              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Questions</p>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 font-display">{result.totalQuestions}</p>
            </div>
            <div>
              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Date</p>
              <p className="text-xs sm:text-sm font-black text-slate-600 mt-1">{new Date(result.completedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </div>
          </div>

          {/* Question Indicator Bar */}
          <div id="question-indicators-bar" className="pt-6 border-t border-slate-50">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1">Aperçu rapide des réponses</p>
            <div className="flex flex-wrap gap-2">
              {exam.questions.map((q, qIdx) => {
                const qRes = result.questionResults?.[qIdx];
                const pointsEarned = qRes?.pointsEarned || 0;
                const isCorrect = pointsEarned === q.points;
                const isPartial = pointsEarned > 0 && pointsEarned < q.points;
                
                return (
                  <a 
                    key={qIdx}
                    href={`#question-${qIdx}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(`question-${qIdx}`)?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black transition-all hover:scale-110 active:scale-95 shadow-sm",
                      isCorrect 
                        ? "bg-emerald-500 text-white shadow-emerald-200" 
                        : isPartial
                          ? "bg-amber-500 text-white shadow-amber-200"
                          : "bg-rose-500 text-white shadow-rose-200"
                    )}
                    title={`Question ${qIdx + 1}: ${pointsEarned} / ${q.points} PTS`}
                  >
                    {qIdx + 1}
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        {/* Questions Breakdown */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 sm:space-y-8 custom-scrollbar">
          {exam.questions.map((q, idx) => {
            const qResult = result.questionResults?.[idx];
            const studentAns = result.answers[idx];
            const pointsEarned = qResult?.pointsEarned || 0;
            const isCorrect = pointsEarned === q.points;
            const isPartial = pointsEarned > 0 && pointsEarned < q.points;
            const qAr = isArabic(q.text);
            
            return (
              <div 
                key={idx} 
                id={`question-${idx}`}
                className={cn(
                  "p-4 sm:p-6 rounded-2xl sm:rounded-3xl border-2 transition-all scroll-mt-20",
                  isCorrect 
                    ? "bg-emerald-50/30 border-emerald-100/50" 
                    : isPartial
                      ? "bg-amber-50/30 border-amber-100/50"
                      : "bg-rose-50/30 border-rose-100/50",
                  qAr ? "text-right" : "text-left"
                )}
                dir={qAr ? "rtl" : "ltr"}
              >
                <div className={cn("flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4", qAr ? "sm:flex-row-reverse" : "")}>
                  <div className={cn("flex items-start gap-3", qAr ? "flex-row-reverse" : "")}>
                    <span className="w-8 h-8 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-xs font-black text-slate-400 shrink-0">#{idx + 1}</span>
                    <div className={cn("prose prose-slate prose-sm text-slate-700 font-bold max-w-full overflow-x-auto", qAr ? "text-right" : "text-left")}>
                      {q.type === 'fill-in-the-blanks' ? (
                        <span>
                          {q.text.split(/\[blank\]/g).map((part, i, arr) => (
                            <React.Fragment key={i}>
                              <span dangerouslySetInnerHTML={{ __html: part }} />
                              {i < arr.length - 1 && (
                                <span className={cn(
                                  "inline-block mx-1 px-2 py-0.5 rounded border-b-2 font-black min-w-[60px] text-center",
                                  studentAns?.[i] === q.correctAnswers?.[i] 
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-400" 
                                    : "bg-rose-50 text-rose-700 border-rose-400"
                                )}>
                                  {studentAns?.[i] || '...'}
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
                  <div className={cn("flex flex-wrap items-center gap-2", qAr ? "flex-row-reverse" : "")}>
                    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-100 shrink-0 w-fit", qAr ? "flex-row-reverse" : "")}>
                      {isCorrect ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : isPartial ? (
                        <MinusCircle className="w-4 h-4 text-amber-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-500" />
                      )}
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest", 
                        isCorrect ? "text-emerald-600" : isPartial ? "text-amber-600" : "text-rose-600"
                      )}>
                        {formatScore(pointsEarned)} / {q.points} PTS
                      </span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        document.getElementById('question-indicators-bar')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className={cn("h-8 px-2 text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 hover:bg-indigo-50", qAr ? "mr-auto" : "")}
                    >
                      {qAr ? "العودة إلى المؤشرات" : "Retour aux indicateurs"}
                    </Button>
                  </div>
                </div>

                {/* Question Type Specific Details */}
                <div className={cn("mt-4 space-y-4", qAr ? "sm:pr-11" : "sm:pl-11")}>
                  {q.type === 'matching' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-2">
                        {q.options?.map((opt, oIdx) => {
                          const studentMatchIdx = (studentAns as any)?.[oIdx];
                          const isMatchCorrect = studentMatchIdx === q.correctMatches?.[oIdx];
                          return (
                            <div key={oIdx} className={cn(
                              "flex items-center justify-between p-3 rounded-xl border text-xs font-bold",
                              isMatchCorrect ? "bg-emerald-50/50 border-emerald-100 text-emerald-700" : "bg-rose-50/50 border-rose-100 text-rose-700"
                            )}>
                              <div className="flex items-center gap-3">
                                <span className="opacity-70" dangerouslySetInnerHTML={{ __html: opt.text }} />
                                <span className="text-slate-300">→</span>
                                <span>{q.matchOptions?.[studentMatchIdx] || 'Non associé'}</span>
                              </div>
                              {!isMatchCorrect && (
                                <div className="text-[9px] font-black uppercase text-slate-400">
                                  Correct : {q.matchOptions?.[q.correctMatches?.[oIdx] as any]}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {q.type === 'ordering' && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {(studentAns as any)?.map((optIdx: number, oIdx: number) => {
                          const isPosCorrect = optIdx === q.correctOrder?.[oIdx];
                          return (
                            <div key={oIdx} className={cn(
                              "flex items-center gap-2 p-2 rounded-lg border text-[10px] font-bold",
                              isPosCorrect ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-rose-50 border-rose-100 text-rose-700"
                            )}>
                              <span className="w-5 h-5 flex items-center justify-center rounded bg-white shadow-sm font-black text-[8px]">{oIdx + 1}</span>
                              <span dangerouslySetInnerHTML={{ __html: q.options?.[optIdx]?.text || '' }} />
                            </div>
                          );
                        })}
                      </div>
                      {!isCorrect && (
                        <div className="space-y-2">
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Ordre Correct</p>
                          <div className="flex flex-wrap gap-2">
                            {q.correctOrder?.map((optIdx, oIdx) => (
                              <div key={oIdx} className="flex items-center gap-2 p-2 rounded-lg border border-emerald-100 bg-emerald-50/30 text-[10px] font-bold text-emerald-700 opacity-70">
                                <span className="w-5 h-5 flex items-center justify-center rounded bg-white shadow-sm font-black text-[8px]">{oIdx + 1}</span>
                                <span dangerouslySetInnerHTML={{ __html: q.options?.[optIdx]?.text || '' }} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Votre Réponse</p>
                    <div className="p-3 sm:p-4 bg-white/80 rounded-xl sm:rounded-2xl border border-slate-100 text-xs sm:text-sm font-bold text-indigo-600 break-words">
                      {q.type === 'multiple-choice' || q.type === 'true-false' ? (
                        <span dangerouslySetInnerHTML={{ __html: q.options?.[studentAns as number]?.text || 'Pas de réponse' }} />
                      ) : q.type === 'fill-in-the-blanks' ? (
                        (studentAns as any)?.join?.(', ') || 'N/A'
                      ) : q.type === 'matching' ? (
                        <span>Détails affichés ci-dessus</span>
                      ) : q.type === 'ordering' ? (
                        <span>Détails affichés ci-dessus</span>
                      ) : String(studentAns || 'N/A')}
                    </div>
                  </div>

                  {!isCorrect && q.type !== 'short-answer' && (
                    <div className="space-y-2">
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Réponse Correcte</p>
                      <div className="p-3 sm:p-4 bg-emerald-50/50 rounded-xl sm:rounded-2xl border border-emerald-100 text-xs sm:text-sm font-bold text-emerald-700 break-words">
                        {q.type === 'multiple-choice' || q.type === 'true-false' ? (
                          <span dangerouslySetInnerHTML={{ __html: q.options?.find(o => o.isCorrect)?.text || '' }} />
                        ) : q.type === 'fill-in-the-blanks' ? (
                          q.correctAnswers?.join(', ')
                        ) : q.correctAnswer || 'Voir avec l\'enseignant'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="p-5 sm:p-6 border-t border-slate-100 bg-white sticky bottom-0">
          <Button onClick={onClose} variant="outline" className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour
          </Button>
        </div>
      </div>
    </Modal>
  );
};
