import React, { useRef } from 'react';
import { User, ClipboardList, CheckCircle2, XCircle, Sparkles, FileText, Download, Star, ArrowUp } from 'lucide-react';
import { motion } from 'motion/react';
import { Modal } from '../ui/Modal';
import { Card } from '../ui/Card';
import { Result, Exam, Question } from '../../types';
import { cn, formatScore, normalizeQuestion } from '../../lib/utils';
import { Button } from '../ui/Button';

interface ResultDetailModalProps {
  result: Result;
  exam: Exam;
  onClose: () => void;
}

export const ResultDetailModal = ({ result, exam, onClose }: ResultDetailModalProps) => {
  const percentage = Math.round((result.score / (result.totalPoints || 1)) * 100);
  const topRef = useRef<HTMLDivElement>(null);

  const scrollToTop = () => {
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToQuestion = (idx: number) => {
    document.getElementById(`detail-question-${idx}`)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <Modal title={`Détails du Résultat - ${result.studentName}`} onClose={onClose} maxWidth="max-w-4xl">
      <div className="p-8 space-y-10 max-h-[80vh] overflow-y-auto custom-scrollbar relative">
        <div ref={topRef} />
        
        {/* Header Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <Card className="p-6 bg-slate-50 border-none flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-indigo-600 shadow-sm">
                <User className="w-6 h-6" />
              </div>
              <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Étudiant</p>
                <h4 className="font-black text-slate-900 text-lg uppercase tracking-tight">{result.studentName}</h4>
                <p className="text-[10px] font-bold text-slate-400">{result.studentEmail}</p>
              </div>
           </Card>

           <Card className="p-6 bg-indigo-50/50 border-none flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                <ClipboardList className="w-6 h-6" />
              </div>
              <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Examen</p>
                <h4 className="font-black text-slate-900 text-lg uppercase tracking-tight">{exam.title}</h4>
                <p className="text-[10px] font-bold text-slate-400 italic">Complété le {new Date(result.completedAt).toLocaleDateString()}</p>
              </div>
           </Card>

           <Card className={cn(
             "p-6 border-none flex flex-col items-center justify-center gap-3",
             percentage >= 80 ? "bg-emerald-50 text-emerald-700" : percentage >= 50 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
           )}>
              <div className="text-4xl font-black">{percentage}%</div>
              <div className="flex flex-col items-center">
                <p className={cn("text-[10px] font-black uppercase tracking-widest opacity-60 mb-1")}>Note Finale</p>
                <h4 className="font-black text-xl">{formatScore(result.score)} / {result.totalPoints}</h4>
              </div>
           </Card>
        </div>

        {/* Question Indicators (Quick Nav) - Hide on Print */}
        <div className="p-6 bg-white border-2 border-slate-50 rounded-[2.5rem] shadow-sm print:hidden">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 ml-2">Indices de navigation rapide</p>
          <div className="flex flex-wrap gap-2">
            {exam.questions.map((q, qIdx) => {
              const qRes = result.questionResults?.[qIdx];
              const pointsEarned = qRes?.pointsEarned || 0;
              const isCorrect = pointsEarned === q.points;
              const isPartial = pointsEarned > 0 && pointsEarned < q.points;
              
              return (
                <button 
                  key={qIdx}
                  onClick={() => scrollToQuestion(qIdx)}
                  className={cn(
                    "w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black transition-all hover:scale-110 active:scale-95 shadow-sm",
                    isCorrect 
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-100" 
                      : isPartial
                        ? "bg-amber-500 text-white shadow-lg shadow-amber-100"
                        : "bg-rose-500 text-white shadow-lg shadow-rose-100"
                  )}
                  title={`Question ${qIdx + 1}: ${formatScore(pointsEarned)} / ${q.points} PTS`}
                >
                  {qIdx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* AI Feedback */}
        {result.aiFeedback && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 bg-indigo-600 rounded-[2.5rem] text-white space-y-4 shadow-xl shadow-indigo-200"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6" />
              <h3 className="text-xl font-black uppercase tracking-tight">Analyse de l'Assistant IA</h3>
            </div>
            <div className="text-indigo-100 font-medium leading-relaxed whitespace-pre-wrap text-sm">
              {result.aiFeedback}
            </div>
          </motion.div>
        )}

        {/* Question by Question Review */}
        <div className="space-y-6">
          <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
            Révision des Questions
          </h3>
          
          <div className="space-y-4">
            {exam.questions.map((rawQ, idx) => {
              const q = normalizeQuestion(rawQ);
              const qResult = result.questionResults?.[idx];
              const isCorrect = qResult?.isCorrect;
              const pointsEarned = qResult?.pointsEarned || 0;
              const studentAns = result.answers[idx];
              
              const renderAnswer = (ans: any, isExpected: boolean) => {
                if (ans === null || ans === undefined) return isExpected ? "N/A" : "Aucune réponse";

                switch (q.type) {
                  case 'multiple-choice':
                  case 'true-false':
                    if (typeof ans === 'number' && q.options && q.options[ans]) {
                       return q.options[ans].text;
                    }
                    if (isExpected) {
                      const correctIdx = q.options?.findIndex(o => o.isCorrect);
                      if (correctIdx !== undefined && correctIdx !== -1 && q.options) {
                        return q.options[correctIdx].text;
                      }
                      return q.correctAnswer || "N/A";
                    }
                    return ans.toString();

                  case 'short-answer':
                    return ans.toString();

                  case 'fill-in-the-blanks':
                    return Array.isArray(ans) ? ans.join(', ') : ans.toString();

                  case 'ordering':
                    if (Array.isArray(ans) && q.options) {
                      return ans.map((optIdx: number) => q.options![optIdx]?.text).join(' → ');
                    }
                    return ans.toString();

                  case 'matching':
                    if (Array.isArray(ans) && q.matchOptions && q.options) {
                       return ans.map((rightIdx: number, leftIdx: number) => {
                         const leftText = q.options![leftIdx]?.text;
                         const rightText = q.matchOptions![rightIdx];
                         return `${leftText} : ${rightText}`;
                       }).join(' | ');
                    }
                    return ans.toString();

                  default:
                    return Array.isArray(ans) ? ans.join(', ') : ans.toString();
                }
              };

              const getRawExpectedAns = () => {
                switch (q.type) {
                  case 'multiple-choice':
                  case 'true-false':
                    return q.options?.findIndex(o => o.isCorrect);
                  case 'ordering':
                    return q.correctOrder;
                  case 'matching':
                    return q.correctMatches;
                  case 'fill-in-the-blanks':
                    return q.correctAnswers;
                  case 'short-answer':
                    return q.correctAnswer;
                  default:
                    return q.correctAnswer || q.correctAnswers || q.correctOptionIndex;
                }
              };

              const rawExpectedAns = getRawExpectedAns();

              return (
                <div 
                  key={idx} 
                  id={`detail-question-${idx}`}
                  className="scroll-mt-6"
                >
                  <Card className="p-6 border-2 border-slate-50 space-y-4 rounded-[2rem]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Question {idx + 1}</span>
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 uppercase tracking-widest">{q.type}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={scrollToTop}
                          className="h-7 px-3 text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-full print:hidden"
                        >
                          <ArrowUp className="w-3 h-3 mr-1" /> Retour aux indices
                        </Button>
                        <div className={cn(
                          "flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                          isCorrect ? "bg-emerald-50 text-emerald-600" : pointsEarned > 0 ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-700"
                        )}>
                          {isCorrect ? <CheckCircle2 className="w-3 h-3" /> : pointsEarned > 0 ? <Star className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {formatScore(pointsEarned)} / {q.points || 1} Points
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="font-bold text-slate-800 leading-relaxed" dangerouslySetInnerHTML={{ __html: q.text }} />
                      
                      {/* Student Answer vs Correct Answer */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                         <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Réponse de l'étudiant</p>
                            <p className="text-sm font-bold text-slate-700 italic">
                               {renderAnswer(studentAns, false)}
                            </p>
                         </div>
                         <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                            <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-2">Réponse attendue</p>
                            <p className="text-sm font-bold text-emerald-700">
                               {renderAnswer(rawExpectedAns, true)}
                            </p>
                         </div>
                      </div>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end pt-6 border-t border-slate-100">
          <Button onClick={onClose} className="rounded-full px-8">Fermer</Button>
        </div>
      </div>
    </Modal>
  );
};

