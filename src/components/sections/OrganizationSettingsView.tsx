import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { OrganizationSettings, HeaderLine } from '../../types';
import { Save, Building2, Calendar, Palette, Check, RefreshCw, Upload, Plus, Trash2, MoveUp, MoveDown, Type, Italic } from 'lucide-react';
import { Button } from '../ui/Button';

export function OrganizationSettingsView() {
  const [settings, setSettings] = useState<OrganizationSettings>({
    orgName: 'OFPPT',
    orgNameArabic: 'مكتب التكوين المهني وإنعاش الشغل',
    orgNameFrench: 'Office de la Formation Professionnelle et de la promotion du travail',
    regionalDirection: 'Direction Régionale De BM-KH',
    institutionName: 'Institut Spécialisé de Technologie Appliquée AL HASSANIA Oued-Zem',
    orgSubName: 'DRBMKH',
    orgLogoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/OFPPT_Logo.svg/1200px-OFPPT_Logo.svg.png',
    regionName: 'ROYAUME DU MAROC',
    academicYear: '2024/2025',
    orgLogoBgColor: '#059669',
    orgLogoTextColor: '#ffffff',
    headerLines: [
      { id: '1', text: 'مكتب التكوين المهني وإنعاش الشغل', fontSize: 14, isBold: true, isItalic: false, alignment: 'center', fontFamily: 'Amiri, serif' },
      { id: '2', text: 'Office de la Formation Professionnelle et de la promotion du travail', fontSize: 10, isBold: true, isItalic: false, alignment: 'center', fontFamily: 'Inter, sans-serif' },
      { id: '3', text: 'Direction Régionale De BM-KH', fontSize: 10, isBold: true, isItalic: false, alignment: 'center', fontFamily: 'Inter, sans-serif' },
      { id: '4', text: 'Institut Spécialisé de Technologie Appliquée AL HASSANIA Oued-Zem', fontSize: 10, isBold: true, isItalic: false, alignment: 'center', fontFamily: 'Inter, sans-serif' }
    ]
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await api.settings.get();
      if (data) {
        // Migration: If no headerLines but legacy fields exist, populate them
        if (!data.headerLines || data.headerLines.length === 0) {
          const legacyLines: HeaderLine[] = [];
          if (data.orgNameArabic) legacyLines.push({ id: Math.random().toString(36).substr(2, 9), text: data.orgNameArabic, fontSize: 14, isBold: true, isItalic: false, alignment: 'center', fontFamily: 'Amiri, serif' });
          if (data.orgNameFrench) legacyLines.push({ id: Math.random().toString(36).substr(2, 9), text: data.orgNameFrench, fontSize: 10, isBold: true, isItalic: false, alignment: 'center', fontFamily: 'Inter, sans-serif' });
          if (data.regionalDirection) legacyLines.push({ id: Math.random().toString(36).substr(2, 9), text: data.regionalDirection, fontSize: 10, isBold: true, isItalic: false, alignment: 'center', fontFamily: 'Inter, sans-serif' });
          if (data.institutionName) legacyLines.push({ id: Math.random().toString(36).substr(2, 9), text: data.institutionName, fontSize: 10, isBold: true, isItalic: false, alignment: 'center', fontFamily: 'Inter, sans-serif' });
          
          data.headerLines = legacyLines;
        }
        setSettings(data);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api.settings.update(settings);
      setMessage({ type: 'success', text: 'Paramètres mis à jour avec succès.' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erreur lors de la mise à jour.' });
    } finally {
      setSaving(false);
    }
  };

  const addHeaderLine = () => {
    const newLine: HeaderLine = {
      id: Math.random().toString(36).substr(2, 9),
      text: 'Nouvelle ligne d\'en-tête',
      fontSize: 10,
      isBold: false,
      isItalic: false,
      alignment: 'center',
      fontFamily: 'Inter'
    };
    setSettings({
      ...settings,
      headerLines: [...(settings.headerLines || []), newLine]
    });
  };

  const FONT_FAMILIES = [
    { name: 'Par défaut (Inter)', value: 'Inter, sans-serif' },
    { name: 'Arial', value: 'Arial, sans-serif' },
    { name: 'Times New Roman', value: '"Times New Roman", serif' },
    { name: 'Courier New', value: '"Courier New", monospace' },
    { name: 'Georgia', value: 'Georgia, serif' },
    { name: 'Verdana', value: 'Verdana, sans-serif' },
    { name: 'Traditional Arabic', value: '"Traditional Arabic", serif' },
    { name: 'Amiri', value: 'Amiri, serif' }
  ];

  const removeHeaderLine = (id: string) => {
    setSettings({
      ...settings,
      headerLines: (settings.headerLines || []).filter(l => l.id !== id)
    });
  };

  const updateHeaderLine = (id: string, updates: Partial<HeaderLine>) => {
    setSettings({
      ...settings,
      headerLines: (settings.headerLines || []).map(l => l.id === id ? { ...l, ...updates } : l)
    });
  };

  const moveHeaderLine = (id: string, direction: 'up' | 'down') => {
    const lines = [...(settings.headerLines || [])];
    const index = lines.findIndex(l => l.id === id);
    if (index === -1) return;
    
    if (direction === 'up' && index > 0) {
      [lines[index - 1], lines[index]] = [lines[index], lines[index - 1]];
    } else if (direction === 'down' && index < lines.length - 1) {
      [lines[index + 1], lines[index]] = [lines[index], lines[index + 1]];
    }
    
    setSettings({ ...settings, headerLines: lines });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Paramètres de l'Organisation</h2>
          <p className="text-slate-500">Configurez l'en-tête officiel qui apparaîtra sur vos documents.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-slate-800">Éditeur d'En-tête</h3>
              </div>
            </div>

            {/* Visual Editor Section */}
            <div className="p-4 sm:p-8 bg-slate-100/30">
              <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-lg max-w-3xl mx-auto">
                <div className="flex border-b border-slate-300 min-h-[120px]">
                  {/* Logo Side */}
                  <div className="w-[12%] p-2 border-r border-slate-300 flex items-center justify-center bg-slate-50/50">
                    {settings.orgLogoUrl ? (
                      <img src={settings.orgLogoUrl} alt="Logo" className="max-w-full max-h-16 object-contain" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-slate-200 flex items-center justify-center text-[8px] text-slate-400 font-bold uppercase">Logo</div>
                    )}
                  </div>
                  
                  {/* Center Text Column */}
                  <div className="flex-1 flex flex-col justify-center py-2">
                    {(settings.headerLines || []).map((line, idx) => (
                      <div 
                        key={line.id} 
                        style={{ 
                          fontSize: `${line.fontSize}px`, 
                          fontWeight: line.isBold ? 'bold' : 'normal',
                          fontStyle: line.isItalic ? 'italic' : 'normal',
                          textAlign: line.alignment,
                          fontFamily: line.fontFamily || 'inherit',
                          borderBottom: settings.showHeaderLines && idx < (settings.headerLines?.length || 0) - 1 ? '1px solid #000' : 'none',
                          padding: '2px 10px',
                          lineHeight: '1.2'
                        }}
                      >
                        {line.text}
                      </div>
                    ))}
                  </div>

                  {/* Right Logo Side */}
                  <div className="w-[12%] p-2 border-l border-slate-300 flex items-center justify-center bg-slate-50/50">
                    {settings.orgLogoUrl ? (
                      <img src={settings.orgLogoUrl} alt="Logo" className="max-w-full max-h-16 object-contain" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-slate-200 flex items-center justify-center text-[8px] text-slate-400 font-bold uppercase">Logo</div>
                    )}
                  </div>
                </div>

                {/* Metadata Row */}
                <div className="grid grid-cols-3 text-[9px] sm:text-[10px] bg-slate-50">
                  <div className="p-2 border-r border-slate-200 flex items-center gap-1 font-bold">
                    <span className="text-slate-400 uppercase tracking-tighter">Filière :</span> [Auto]
                  </div>
                  <div className="p-2 border-r border-slate-200 flex items-center justify-center gap-1 font-bold">
                    <span className="text-slate-400 uppercase tracking-tighter">Niveau :</span> [Auto]
                  </div>
                  <div className="p-2 flex items-center gap-2 bg-white px-3 font-bold">
                    <span className="text-slate-400 uppercase tracking-tighter shrink-0">Année de Formation :</span>
                    <input
                      type="text"
                      value={settings.academicYear || ''}
                      onChange={(e) => setSettings({ ...settings, academicYear: e.target.value })}
                      className="w-full bg-transparent border-none p-0 focus:ring-0 text-indigo-600 outline-none"
                    />
                  </div>
                </div>
              </div>
              <p className="text-center text-[10px] text-slate-400 mt-3 font-medium">Aperçu visuel de l'en-tête (estimatif)</p>
            </div>

            {/* Header Lines Editor */}
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Type className="w-4 h-4 text-indigo-500" />
                  Lignes de texte de l'en-tête
                </h4>
                <Button type="button" variant="outline" size="sm" onClick={addHeaderLine}>
                  <Plus className="w-4 h-4 mr-1" />
                  Ajouter une ligne
                </Button>
              </div>

              <div className="space-y-3">
                {(settings.headerLines || []).map((line, index) => (
                  <div key={line.id} className="flex flex-col sm:flex-row gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-sm animate-in zoom-in-95 duration-200">
                    <div className="flex-1 space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={line.text}
                          onChange={(e) => updateHeaderLine(line.id, { text: e.target.value })}
                          className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                          placeholder="Texte de la ligne..."
                          style={{ direction: /[\u0600-\u06FF]/.test(line.text) ? 'rtl' : 'ltr' }}
                        />
                      </div>
                      <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Taille</label>
                          <input
                            type="number"
                            value={line.fontSize}
                            onChange={(e) => updateHeaderLine(line.id, { fontSize: parseInt(e.target.value) || 12 })}
                            className="w-16 px-2 py-1 text-xs rounded border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Gras</label>
                          <input
                            type="checkbox"
                            checked={line.isBold}
                            onChange={(e) => updateHeaderLine(line.id, { isBold: e.target.checked })}
                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Italique</label>
                          <input
                            type="checkbox"
                            checked={line.isItalic}
                            onChange={(e) => updateHeaderLine(line.id, { isItalic: e.target.checked })}
                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Alignement</label>
                          <select
                            value={line.alignment}
                            onChange={(e) => updateHeaderLine(line.id, { alignment: e.target.value as any })}
                            className="px-2 py-1 text-xs rounded border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                          >
                            <option value="left">Gauche</option>
                            <option value="center">Centre</option>
                            <option value="right">Droite</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Police</label>
                          <select
                            value={line.fontFamily || ''}
                            onChange={(e) => updateHeaderLine(line.id, { fontFamily: e.target.value })}
                            className="px-2 py-1 text-xs rounded border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                          >
                            <option value="">Par défaut</option>
                            {FONT_FAMILIES.map(font => (
                              <option key={font.value} value={font.value}>{font.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="flex sm:flex-col gap-2 items-center justify-center border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-3">
                      <button
                        type="button"
                        onClick={() => moveHeaderLine(line.id, 'up')}
                        disabled={index === 0}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <MoveUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveHeaderLine(line.id, 'down')}
                        disabled={index === (settings.headerLines?.length || 0) - 1}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <MoveDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeHeaderLine(line.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {(settings.headerLines || []).length === 0 && (
                  <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl">
                    <p className="text-slate-400 text-sm">Aucune ligne d'en-tête personnalisée. Ajoutez-en une pour commencer.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Separator Lines Toggle & Other Settings */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/30 border-t border-slate-100">
               <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1 h-3 bg-indigo-400 rounded-full" />
                    Autres Paramètres
                  </h4>
                  <div className="space-y-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3">
                       <label className="relative inline-flex items-center cursor-pointer">
                         <input 
                           type="checkbox" 
                           checked={settings.showHeaderLines || false} 
                           onChange={(e) => setSettings({ ...settings, showHeaderLines: e.target.checked })}
                           className="sr-only peer" 
                         />
                         <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                       </label>
                       <span className="text-[10px] font-bold text-slate-500 uppercase">Afficher les lignes de séparation entre les textes</span>
                    </div>
                    
                    <div className="space-y-1">
                       <label className="text-[10px] font-bold text-slate-500 uppercase">Acronyme Organisation (Pied de page)</label>
                       <input
                         type="text"
                         value={settings.orgName || ''}
                         onChange={(e) => setSettings({ ...settings, orgName: e.target.value })}
                         className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-bold text-slate-500 uppercase">Code Sous-Direction (Pied de page)</label>
                       <input
                         type="text"
                         value={settings.orgSubName || ''}
                         onChange={(e) => setSettings({ ...settings, orgSubName: e.target.value })}
                         className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                       />
                    </div>
                  </div>
               </div>

               <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1 h-3 bg-violet-400 rounded-full" />
                    Logo de l'Organisation
                  </h4>
                  <div className="space-y-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex gap-2">
                       <div className="flex-1 space-y-1">
                         <label className="text-[10px] font-bold text-slate-500 uppercase">URL du Logo direct</label>
                         <input
                           type="text"
                           value={settings.orgLogoUrl || ''}
                           onChange={(e) => setSettings({ ...settings, orgLogoUrl: e.target.value })}
                           className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                         />
                       </div>
                       <div className="flex items-end pb-0.5">
                         <label className="cursor-pointer bg-slate-50 p-2 rounded-lg border border-slate-200 hover:bg-slate-100 ring-offset-2 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                           <Upload className="w-4 h-4 text-slate-500" />
                           <input
                             type="file"
                             accept="image/*"
                             className="hidden"
                             onChange={(e) => {
                               const file = e.target.files?.[0];
                               if (file) {
                                 const reader = new FileReader();
                                 reader.onloadend = () => setSettings({ ...settings, orgLogoUrl: reader.result as string });
                                 reader.readAsDataURL(file);
                               }
                             }}
                           />
                         </label>
                       </div>
                    </div>
                    <p className="text-[10px] text-slate-400 italic font-medium">Le logo sera utilisé pour les deux côtés de l'en-tête.</p>
                  </div>
               </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              {message && (
                <div className={`flex items-center gap-2 text-sm ${message.type === 'success' ? 'text-emerald-600' : 'text-rose-600'} animate-in fade-in duration-300`}>
                  {message.type === 'success' && <Check className="w-4 h-4" />}
                  {message.text}
                </div>
              )}
              <div className="flex-1" />
              <Button type="submit" disabled={saving}>
                <Save className={`w-4 h-4 mr-2 ${saving ? 'animate-pulse' : ''}`} />
                {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
