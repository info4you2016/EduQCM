import React, { useState } from 'react';
import { WordTemplate, OrganizationSettings, Exam } from '../../types';
import { X, FileText, FileDown, Check, Sparkles, Layout, Settings } from 'lucide-react';
import { Button } from '../ui/Button';

interface ExportModelModalProps {
  exam: Exam;
  templates: WordTemplate[];
  defaultSettings: OrganizationSettings | null;
  initialFormat: 'pdf' | 'docx';
  initialShowAnswers: boolean;
  onClose: () => void;
  onExport: (options: {
    templateId: string | 'default';
    format: 'pdf' | 'docx';
    showAnswers: boolean;
    paperSaver: boolean;
    qcmDoubleColumn?: boolean;
  }) => void;
}

export const ExportModelModal = ({
  exam,
  templates = [],
  defaultSettings,
  initialFormat,
  initialShowAnswers,
  onClose,
  onExport,
}: ExportModelModalProps) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | 'default'>('default');
  const [format, setFormat] = useState<'pdf' | 'docx'>(initialFormat);
  const [showAnswers, setShowAnswers] = useState<boolean>(initialShowAnswers);
  const [paperSaver, setPaperSaver] = useState<boolean>(false);
  const [qcmDoubleColumn, setQcmDoubleColumn] = useState<boolean>(false);

  const handleExportClick = () => {
    onExport({
      templateId: selectedTemplateId,
      format,
      showAnswers,
      paperSaver,
      qcmDoubleColumn,
    });
  };

  const getTemplateInfo = (id: string | 'default') => {
    if (id === 'default') {
      return {
        name: "Modèle Principal (Défaut)",
        desc: defaultSettings?.orgNameFrench || defaultSettings?.orgName || "En-tête de l'organisation configuré par défaut",
        cols: defaultSettings?.headerColumns?.length || 0,
        footer: defaultSettings?.showFooter ? "Pied de page activé" : "Pied de page désactivé"
      };
    }
    const t = templates.find(temp => temp.id === id);
    if (!t) return null;
    return {
      name: t.name,
      desc: "Modèle personnalisé enregistré dans les paramètres",
      cols: t.headerColumns?.length || 0,
      footer: t.showFooter ? "Pied de page activé" : "Pied de page désactivé"
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" id="export-model-modal">
      <div className="bg-white rounded-3xl w-full max-w-2xl border border-slate-100 shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight font-sans">
                Options d'Exportation de l'Examen
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Personnalisez le modèle d'en-tête et pied de page du document exporté
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            id="close-export-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Section: Format Selector */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              1. FORMAT DE DOCUMENT
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setFormat('pdf')}
                className={`p-4 rounded-2xl border-2 text-left flex items-start gap-4 transition-all ${
                  format === 'pdf'
                    ? 'border-indigo-600 bg-indigo-50/40 text-indigo-900 shadow-sm'
                    : 'border-slate-100 hover:border-slate-200 bg-white text-slate-600'
                }`}
              >
                <div className={`p-2 rounded-xl shrink-0 ${format === 'pdf' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 text-slate-400'}`}>
                  <FileDown className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm">Fichier PDF (.pdf)</div>
                  <div className="text-xs text-slate-400 mt-1">Idéal pour l'impression directe et la distribution numérique non modifiable.</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('docx')}
                className={`p-4 rounded-2xl border-2 text-left flex items-start gap-4 transition-all ${
                  format === 'docx'
                    ? 'border-blue-600 bg-blue-50/40 text-blue-900 shadow-sm'
                    : 'border-slate-100 hover:border-slate-200 bg-white text-slate-600'
                }`}
              >
                <div className={`p-2 rounded-xl shrink-0 ${format === 'docx' ? 'bg-blue-100 text-blue-700' : 'bg-slate-50 text-slate-400'}`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm">Document Microsoft Word (.docx)</div>
                  <div className="text-xs text-slate-400 mt-1">Idéal si vous souhaitez éditer manuellement le texte ou la mise en page sous Word.</div>
                </div>
              </button>
            </div>
          </div>

          {/* Section: Show/Hide Corrections */}
          <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-800">Exporter le Corrigé type de l'examen</div>
                  <div className="text-xs text-slate-500">Inclut les bonnes réponses et l'évaluation théorique si validées.</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAnswers}
                  onChange={(e) => setShowAnswers(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
          </div>

          {/* Section: Paper Saver Mode */}
          <div className="space-y-3 p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl animate-pulse">
                  <Layout className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-800">Mode Éco / Compact ("Paper Saver")</div>
                  <div className="text-xs text-slate-500">Optimise la mise en page, réduit les marges, espacements et police pour économiser du papier.</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={paperSaver}
                  onChange={(e) => setPaperSaver(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          {/* Section: Double Column MCQ Mode */}
          <div className="space-y-3 p-4 bg-violet-50/40 rounded-2xl border border-violet-100/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-100 text-violet-600 rounded-xl">
                  <Layout className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-800">Disposition QCM en Double Colonne (Multi-Column)</div>
                  <div className="text-xs text-slate-500">Affiche les questions de type QCM sur deux colonnes côte à côte pour un format optimal.</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={qcmDoubleColumn}
                  onChange={(e) => setQcmDoubleColumn(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
              </label>
            </div>
          </div>

          {/* Section: Template Selector */}
          <div className="space-y-3">
            <div className="flex justify-between items-baseline">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                2. SÉLECTIONNER LE MODÈLE D'ENTÊTE & PIED DE PAGE
              </label>
              <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded-full">
                {templates.length + 1} disponibles
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
              {/* Default Template Choice */}
              <button
                type="button"
                onClick={() => setSelectedTemplateId('default')}
                className={`p-4 rounded-2xl border-2 text-left flex items-start justify-between transition-all ${
                  selectedTemplateId === 'default'
                    ? 'border-indigo-600 bg-indigo-50/20 text-indigo-900 shadow-sm'
                    : 'border-slate-100 hover:border-slate-200 bg-white text-slate-600'
                }`}
              >
                <div className="space-y-1.5 pr-2">
                  <div className="flex items-center gap-2">
                    <Layout className="w-4 h-4 text-indigo-500" />
                    <span className="font-bold text-sm">Modèle Principal (Défaut)</span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2">
                    {defaultSettings?.institutionName || "Modèle d'en-tête standard configuré par l'établissement."}
                  </p>
                  <div className="flex gap-2 text-[9px] font-bold text-slate-400 uppercase mt-2">
                    <span>{defaultSettings?.headerColumns?.length || 0} colonnes</span>
                    <span>•</span>
                    <span>{defaultSettings?.showFooter ? 'Pied activé' : 'Pied désactivé'}</span>
                  </div>
                </div>
                {selectedTemplateId === 'default' && (
                  <div className="p-1 bg-indigo-600 text-white rounded-full shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </button>

              {/* Custom Templates List */}
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(tpl.id)}
                  className={`p-4 rounded-2xl border-2 text-left flex items-start justify-between transition-all ${
                    selectedTemplateId === tpl.id
                      ? 'border-indigo-600 bg-indigo-50/20 text-indigo-900 shadow-sm'
                      : 'border-slate-100 hover:border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <div className="space-y-1.5 pr-2">
                    <div className="flex items-center gap-2">
                      <Layout className="w-4 h-4 text-indigo-500" />
                      <span className="font-bold text-sm truncate max-w-[170px]">{tpl.name}</span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2">
                      Modèle personnalisé enregistré avec vos préférences d'en-tête et pied de page.
                    </p>
                    <div className="flex gap-2 text-[9px] font-bold text-slate-400 uppercase mt-2">
                      <span>{tpl.headerColumns?.length || 0} colonnes</span>
                      <span>•</span>
                      <span>{tpl.showFooter ? 'Pied activé' : 'Pied désactivé'}</span>
                    </div>
                  </div>
                  {selectedTemplateId === tpl.id && (
                    <div className="p-1 bg-indigo-600 text-white rounded-full shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-slate-50 bg-slate-50/50 flex justify-end gap-3 mt-auto">
          <Button
            variant="ghost"
            onClick={onClose}
            className="rounded-xl px-5 py-2 hover:bg-slate-200/50 transition-all font-semibold"
          >
            Annuler
          </Button>
          <Button
            onClick={handleExportClick}
            className={`rounded-xl px-6 py-2 shadow-md transition-all font-semibold text-white --color-format-${format} ${
              format === 'pdf' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            Exporter maintenant ({format === 'pdf' ? 'PDF' : 'Word'})
          </Button>
        </div>
      </div>
    </div>
  );
};
