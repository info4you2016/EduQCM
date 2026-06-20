import React from 'react';
import { Info, CheckCircle2, AlertCircle, Sparkles, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { Card } from '../ui/Card';

export const ImportHelp = () => {
  const formats = [
    {
      type: 'Examen Complet avec paramètres (JSON & CSV)',
      csv: 'exam_title,exam_type,exam_durationMinutes,exam_shuffleQuestions,exam_disableCopyPaste,type,text,options,correctOptionIndex,points\n"Examen Final SST","controle-continu",90,true,true,multiple-choice,"Capitale de la France?","Paris|Londres|Berlin",0,2',
      json: '{\n  "title": "Examen Final SST",\n  "examType": "controle-continu",\n  "durationMinutes": 90,\n  "shuffleQuestions": true,\n  "disableCopyPaste": true,\n  "questions": [\n    {\n      "type": "multiple-choice",\n      "text": "Capitale de la France?",\n      "options": ["Paris", "Londres", "Berlin"],\n      "correctOptionIndex": 0,\n      "points": 2\n    }\n  ]\n}',
      desc: 'Importe les métadonnées de l\'examen (titre, type, durée, restrictions de sécurité) ET les questions d\'un seul coup.'
    },
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
    },
    {
      type: 'Évaluation Pratique (practical)',
      csv: 'type,text,points\npractical,"Sujet de l\'activité pratique: Configurer un réseau local avec 3 sous-réseaux...",5',
      json: '{\n  "type": "practical",\n  "text": "Sujet de l\'activité pratique: Configurer un réseau local avec 3 sous-réseaux...",\n  "points": 5\n}',
      desc: 'Sujet d\'activité pratique réclammant une correction manuelle ou appréciation personnalisée par le formateur.'
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

      {/* Flexible normalizer attributes block */}
      <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-4 space-y-3.5">
        <div className="flex items-center gap-2 text-indigo-900">
          <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
          <h5 className="text-[11px] font-black uppercase tracking-wider">Moteur de Normalisation Intelligent</h5>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
          L'application intègre un parseur robuste qui tolère plusieurs variantes de noms de colonnes :
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px] font-bold text-slate-650">
          <div className="bg-white p-2.5 rounded-xl border border-slate-100 space-y-1">
            <span className="text-indigo-600 uppercase text-[9px] font-black">Enoncé :</span>
            <p className="text-slate-600 font-medium">Colonne <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono">text</code> ou <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono">question</code></p>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-slate-100 space-y-1">
            <span className="text-indigo-600 uppercase text-[9px] font-black">Type :</span>
            <p className="text-slate-600 font-medium">Colonne <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono">type</code> ou <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono">questionType</code></p>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-slate-100 space-y-1">
            <span className="text-indigo-600 uppercase text-[9px] font-black">Corrigé (Réponse courte) :</span>
            <p className="text-slate-600 font-medium"><code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono">correctAnswer</code> ou <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono">answer</code></p>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-slate-100 space-y-1">
            <span className="text-indigo-600 uppercase text-[9px] font-black">Corrigé (Texte à trous) :</span>
            <p className="text-slate-600 font-medium"><code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono">correctAnswers</code> ou <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono">answers</code></p>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-slate-100 space-y-1 md:col-span-2">
            <span className="text-indigo-600 uppercase text-[9px] font-black">Type d'alignements :</span>
            <p className="text-slate-600 font-medium">
              Les alias courants sont auto-détectés comme synonymes :
              <br />
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">qcm</code> / <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">mcq</code> (Choix multiple),{' '}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">vrai-faux</code> / <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">tf</code> (Vrai/Faux),{' '}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">reponse-courte</code> / <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">sa</code> (Réponse courte),{' '}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">trous</code> / <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">fib</code> (Trous),{' '}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">ordre</code> (Ordre),{' '}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">association</code> (Association),{' '}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">pratique</code> (Pratique).
            </p>
          </div>
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
          Assurez-vous que les colonnes CSV correspondent exactement aux noms indiqués ou à leurs alias. 
          Pour les listes dans le CSV (options, correctAnswers), utilisez le caractère pipe ("|") comme séparateur.
        </p>
      </Card>
    </div>
  );
};
