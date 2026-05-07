import React from 'react';
import { Info, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { Card } from '../ui/Card';

export const ImportHelp = () => {
  const formats = [
    {
      type: 'QCM (multiple-choice)',
      csv: 'type,text,options,correctOptionIndex,points\nmultiple-choice,"Capitale France?","Paris|Londres|Berlin",0,1',
      json: '{\n  "type": "multiple-choice",\n  "text": "Capitale France?",\n  "options": ["Paris", "Londres", "Berlin"],\n  "correctOptionIndex": 0,\n  "points": 1\n}',
      desc: 'Options séparées par "|" dans le CSV.'
    },
    {
      type: 'Vrai/Faux (true-false)',
      csv: 'type,text,correctOptionIndex,points\ntrue-false,"La terre est ronde?",0,1',
      json: '{\n  "type": "true-false",\n  "text": "La terre est ronde?",\n  "correctOptionIndex": 0,\n  "points": 1\n}',
      desc: 'Index 0 pour Vrai, 1 pour Faux.'
    },
    {
      type: 'Réponse Courte (short-answer)',
      csv: 'type,text,correctAnswer,points\nshort-answer,"Capitale Italie?","Rome",1',
      json: '{\n  "type": "short-answer",\n  "text": "Capitale Italie?",\n  "correctAnswer": "Rome",\n  "points": 1\n}',
      desc: 'Correction automatique basée sur le texte.'
    },
    {
      type: 'Texte à trous (fill-in-the-blanks)',
      csv: 'type,text,correctAnswers,points\nfill-in-the-blanks,"Le [blank] est bleu.", "ciel", 1',
      json: '{\n  "type": "fill-in-the-blanks",\n  "text": "Le [blank] est bleu.",\n  "correctAnswers": ["ciel"],\n  "points": 1\n}',
      desc: 'Utilisez [blank] dans l\'énoncé.'
    },
    {
      type: 'Ordre (ordering)',
      csv: 'type,text,options,correctOrder,points\nordering,"Trier par taille","Petit|Moyen|Grand","0|1|2",1',
      json: '{\n  "type": "ordering",\n  "text": "Trier par taille",\n  "options": ["Petit", "Moyen", "Grand"],\n  "correctOrder": [0, 1, 2],\n  "points": 1\n}',
      desc: 'correctOrder contient les index dans l\'ordre final.'
    },
    {
      type: 'Association (matching)',
      csv: 'type,text,options,matchOptions,correctMatches,points\nmatching,"Pays et Capitales","France|Italie","Paris|Rome","0|1",1',
      json: '{\n  "type": "matching",\n  "text": "Pays et Capitales",\n  "options": ["France", "Italie"],\n  "matchOptions": ["Paris", "Rome"],\n  "correctMatches": [0, 1],\n  "points": 1\n}',
      desc: 'Relie l\'élément à gauche (options) à celui de droite (matchOptions).'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-indigo-600 shadow-sm">
          <Info className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-black text-indigo-900 uppercase tracking-tight">Format d'importation</h4>
          <p className="text-xs text-indigo-600/80 font-medium tracking-tight">Supporte les fichiers JSON et CSV (.csv, .json)</p>
        </div>
      </div>

      <div className="space-y-4">
        {formats.map((f, i) => (
          <details key={i} className="group bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden transition-all">
            <summary className="flex items-center justify-between p-4 cursor-pointer list-none select-none">
              <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{f.type}</span>
              <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center group-open:rotate-180 transition-transform">
                <motion.span className="text-slate-400 font-bold">+</motion.span>
              </div>
            </summary>
            <div className="px-4 pb-4 pt-0 space-y-4">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" /> {f.desc}
              </p>
              
              <div className="space-y-3">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 block">Format CSV</label>
                  <pre className="p-3 bg-slate-900 text-slate-300 rounded-xl text-[10px] font-mono overflow-x-auto">
                    {f.csv}
                  </pre>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5 block">Format JSON</label>
                  <pre className="p-3 bg-slate-900 text-slate-300 rounded-xl text-[10px] font-mono overflow-x-auto">
                    {f.json}
                  </pre>
                </div>
              </div>
            </div>
          </details>
        ))}
      </div>

      <Card className="p-4 bg-amber-50 border-amber-100 flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
        <p className="text-[10px] font-bold text-amber-700 leading-relaxed">
          Assurez-vous que les colonnes CSV correspondent exactement aux noms indiqués. 
          Pour les listes dans le CSV (options, correctAnswers), utilisez le caractère pipe ("|") comme séparateur.
        </p>
      </Card>
    </div>
  );
};
