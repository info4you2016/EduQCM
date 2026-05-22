import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../../lib/api';
import { OrganizationSettings, HeaderLine, HeaderColumn, WordTemplate } from '../../types';
import { 
  Save, Building2, Calendar, Palette, Check, RefreshCw, 
  Upload, Plus, Trash2, MoveUp, MoveDown, Type, Italic, 
  Settings, ShieldAlert, Timer, Ruler,
  Image as ImageIcon, Columns as ColumnsIcon, Layout as LayoutIcon, AlignLeft, AlignCenter, AlignRight, Clock 
} from 'lucide-react';
import { Button } from '../ui/Button';

interface OrganizationSettingsViewProps {
  onUpdate?: (settings: OrganizationSettings) => void;
}

export function OrganizationSettingsView({ onUpdate }: OrganizationSettingsViewProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'header' | 'footer' | 'acad' | 'extra'>('general');
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
    orgLogoUrlRight: '',
    footerText: '',
    showFooter: true,
    headerLines: [
      { id: '1', text: 'مكتب التكوين المهني وإنعاش الشغل', fontSize: 14, isBold: true, isItalic: false, alignment: 'center', fontFamily: 'Amiri, serif' },
      { id: '2', text: 'Office de la Formation Professionnelle et de la promotion du travail', fontSize: 10, isBold: true, isItalic: false, alignment: 'center', fontFamily: 'Inter, sans-serif' },
      { id: '3', text: 'Direction Régionale De BM-KH', fontSize: 10, isBold: true, isItalic: false, alignment: 'center', fontFamily: 'Inter, sans-serif' },
      { id: '4', text: 'Institut Spécialisé de Technologie Appliquée AL HASSANIA Oued-Zem', fontSize: 10, isBold: true, isItalic: false, alignment: 'center', fontFamily: 'Inter, sans-serif' }
    ],
    footerColumns: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [templateNamingId, setTemplateNamingId] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [isAddingNewTemplate, setIsAddingNewTemplate] = useState(false);
  const [initialSettings, setInitialSettings] = useState<OrganizationSettings | null>(null);

  const previewReplaceVariables = (text: string) => {
    if (!text) return '';
    return text
      .replace(/{{TITRE}}/g, 'Examen Final')
      .replace(/{{MODULE}}/g, 'M101 - Développement Web')
      .replace(/{{PROF}}/g, 'Formateur Nom')
      .replace(/{{DATE}}/g, new Date().toLocaleDateString('fr-FR'))
      .replace(/{{GROUPE}}/g, 'DEV101')
      .replace(/{{DUREE}}/g, '2h 00m')
      .replace(/{{TYPE}}/g, 'EFM')
      .replace(/{{FILIERE}}/g, 'Développement Digital')
      .replace(/{{ETABLISSEMENT}}/g, settings.institutionName || 'INSTITUTION')
      .replace(/{{DIRECTION}}/g, settings.regionalDirection || 'DIRECTION RÉGIONALE')
      .replace(/{{REGION}}/g, settings.regionName || 'REGION')
      .replace(/{{ANNEE_ACAD}}/g, settings.academicYear || '2024/2025')
      .replace(/{{CODE_ORG}}/g, settings.orgSubName || 'ORG')
      .replace(/{{ORG_AR}}/g, settings.orgNameArabic || 'ORG AR')
      .replace(/{{ORG_FR}}/g, settings.orgNameFrench || 'ORG FR');
  };

  const hasUnsavedChanges = useMemo(() => {
    if (!initialSettings) return false;
    return JSON.stringify(settings) !== JSON.stringify(initialSettings);
  }, [settings, initialSettings]);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await api.settings.get();
      if (data) {
        // Migration: If no headerLines but legacy fields exist, populate them with variables
        if (!data.headerLines || data.headerLines.length === 0) {
          const legacyLines: HeaderLine[] = [];
          if (data.orgNameArabic) legacyLines.push({ id: Math.random().toString(36).substr(2, 9), type: 'text', text: '{{ORG_AR}}', fontSize: 14, isBold: true, isItalic: false, alignment: 'center', fontFamily: 'Amiri, serif' });
          if (data.orgNameFrench) legacyLines.push({ id: Math.random().toString(36).substr(2, 9), type: 'text', text: '{{ORG_FR}}', fontSize: 10, isBold: true, isItalic: false, alignment: 'center', fontFamily: 'Inter, sans-serif' });
          if (data.regionalDirection) legacyLines.push({ id: Math.random().toString(36).substr(2, 9), type: 'text', text: '{{DIRECTION}}', fontSize: 10, isBold: true, isItalic: false, alignment: 'center', fontFamily: 'Inter, sans-serif' });
          if (data.institutionName) legacyLines.push({ id: Math.random().toString(36).substr(2, 9), type: 'text', text: '{{ETABLISSEMENT}}', fontSize: 10, isBold: true, isItalic: false, alignment: 'center', fontFamily: 'Inter, sans-serif' });
          
          data.headerLines = legacyLines;
        }

        // Migration to HeaderColumns
        if (!data.headerColumns || data.headerColumns.length === 0) {
          data.headerColumns = [
            {
              id: 'col-1',
              width: 15,
              lines: data.orgLogoUrl ? [{ id: 'l-logo-left', type: 'image', imageUrl: data.orgLogoUrl, alignment: 'center' }] : [],
              borderRight: true
            },
            {
              id: 'col-2',
              width: 70,
              lines: (data.headerLines || []).map(l => ({ ...l, type: l.type || 'text' })),
              borderRight: true
            },
            {
              id: 'col-3',
              width: 15,
              lines: data.orgLogoUrlRight ? [{ id: 'l-logo-right', type: 'image', imageUrl: data.orgLogoUrlRight, alignment: 'center' }] : 
                     (data.orgLogoUrl ? [{ id: 'l-logo-right-fallback', type: 'image', imageUrl: data.orgLogoUrl, alignment: 'center' }] : [])
            }
          ];
        } else {
          // Ensure all lines have a type
          data.headerColumns = data.headerColumns.map(col => ({
            ...col,
            lines: col.lines.map(line => ({ ...line, type: line.type || 'text' }))
          }));
        }

        // Migration to FooterColumns
        if (!data.footerColumns || data.footerColumns.length === 0) {
          if (data.showFooterTable && data.footerTable && data.footerTable.rows.length > 0) {
            // Convert table to columns
            const colCount = data.footerTable.rows[0].length;
            data.footerColumns = Array.from({ length: colCount }).map((_, cIdx) => ({
              id: `fcol-${cIdx}`,
              width: Math.floor(100 / colCount),
              borderRight: cIdx < colCount - 1,
              lines: data.footerTable!.rows.map((row, rIdx) => ({
                id: `fline-${rIdx}-${cIdx}`,
                type: 'text',
                text: row[cIdx],
                fontSize: data.footerFontSize || 9,
                alignment: 'center',
                fontFamily: data.footerFontFamily || 'Inter'
              }))
            }));
          } else if (data.footerText) {
            data.footerColumns = [{
              id: 'fcol-1',
              width: 100,
              lines: [{
                id: 'fline-1',
                type: 'text',
                text: data.footerText,
                fontSize: data.footerFontSize || 10,
                alignment: 'center',
                fontFamily: data.footerFontFamily || 'Inter'
              }]
            }];
          } else {
            // Default footer: Page numbers only maybe? Or empty.
            data.footerColumns = [
              {
                id: 'fcol-1',
                width: 100,
                lines: [
                  { id: 'fline-1', type: 'text', text: '{{TITRE}} - Page {{PAGE}} sur {{TOTAL}}', fontSize: 9, alignment: 'center' }
                ]
              }
            ];
          }
        } else {
          data.footerColumns = data.footerColumns.map(col => ({
            ...col,
            lines: col.lines.map(line => ({ ...line, type: line.type || 'text' }))
          }));
        }

        setSettings(data);
        setInitialSettings(JSON.parse(JSON.stringify(data)));
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveAsTemplate = async () => {
    setIsAddingNewTemplate(true);
    setNewTemplateName(`Modèle ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`);
  };

  const confirmSaveTemplate = async () => {
    if (!newTemplateName.trim()) {
      setMessage({ type: 'error', text: 'Le nom du modèle est requis.' });
      return;
    }

    const newTemplate: WordTemplate = {
      id: Math.random().toString(36).substr(2, 9),
      name: newTemplateName.trim(),
      headerColumns: JSON.parse(JSON.stringify(settings.headerColumns || [])),
      showHeaderLines: settings.showHeaderLines,
      showFooter: settings.showFooter,
      footerText: settings.footerText,
      footerTable: settings.footerTable ? JSON.parse(JSON.stringify(settings.footerTable)) : undefined,
      footerColumns: JSON.parse(JSON.stringify(settings.footerColumns || [])),
      footerFontSize: settings.footerFontSize,
      footerFontFamily: settings.footerFontFamily
    };

    const updatedSettings = {
      ...settings,
      templates: [...(settings.templates || []), newTemplate]
    };
    
    setSettings(updatedSettings);
    setIsAddingNewTemplate(false);
    setNewTemplateName('');
    
    try {
      await api.settings.update(updatedSettings);
      setMessage({ type: 'success', text: `Modèle "${newTemplate.name}" enregistré.` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde du modèle.' });
    }
  };

  const applyTemplate = (template: WordTemplate) => {
    setSettings({
      ...settings,
      headerColumns: JSON.parse(JSON.stringify(template.headerColumns)),
      showHeaderLines: template.showHeaderLines ?? settings.showHeaderLines,
      showFooter: template.showFooter ?? settings.showFooter,
      footerText: template.footerText ?? settings.footerText,
      footerTable: template.footerTable ? JSON.parse(JSON.stringify(template.footerTable)) : settings.footerTable,
      footerColumns: template.footerColumns ? JSON.parse(JSON.stringify(template.footerColumns)) : settings.footerColumns,
      footerFontSize: template.footerFontSize ?? settings.footerFontSize,
      footerFontFamily: template.footerFontFamily ?? settings.footerFontFamily
    });
    setMessage({ type: 'success', text: `Modèle "${template.name}" appliqué.` });
  };

  const updateTemplate = async (id: string) => {
    const template = (settings.templates || []).find(t => t.id === id);
    if (!template) return;
    
    if (!confirm(`Souhaitez-vous mettre à jour le modèle "${template.name}" avec les paramètres d'en-tête actuels ?`)) return;

    const updatedTemplates = (settings.templates || []).map(t => t.id === id ? {
      ...t,
      headerColumns: JSON.parse(JSON.stringify(settings.headerColumns || [])),
      showHeaderLines: settings.showHeaderLines,
      showFooter: settings.showFooter,
      footerText: settings.footerText,
      footerTable: settings.footerTable ? JSON.parse(JSON.stringify(settings.footerTable)) : undefined,
      footerColumns: JSON.parse(JSON.stringify(settings.footerColumns || [])),
      footerFontSize: settings.footerFontSize,
      footerFontFamily: settings.footerFontFamily
    } : t);

    const updatedSettings = {
      ...settings,
      templates: updatedTemplates
    };

    setSettings(updatedSettings);

    try {
      await api.settings.update(updatedSettings);
      setMessage({ type: 'success', text: `Modèle "${template.name}" mis à jour.` });
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Erreur lors de la mise à jour du modèle.' });
    }
  };

  const renameTemplate = (id: string) => {
    const template = (settings.templates || []).find(t => t.id === id);
    if (!template) return;
    setTemplateNamingId(id);
    setNewTemplateName(template.name);
  };

  const confirmRenameTemplate = async () => {
    if (!templateNamingId || !newTemplateName.trim()) return;

    const updatedSettings = {
      ...settings,
      templates: (settings.templates || []).map(t => t.id === templateNamingId ? { ...t, name: newTemplateName.trim() } : t)
    };

    setSettings(updatedSettings);
    setTemplateNamingId(null);
    setNewTemplateName('');

    try {
      await api.settings.update(updatedSettings);
      setMessage({ type: 'success', text: 'Modèle renommé.' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Error renaming template:", error);
      setMessage({ type: 'error', text: 'Erreur lors du changement de nom.' });
    }
  };

  const removeTemplate = async (id: string) => {
    const template = (settings.templates || []).find(t => t.id === id);
    if (!template) return;

    if (!confirm(`Souhaitez-vous vraiment supprimer le modèle "${template.name}" ?`)) return;

    const updatedSettings = {
      ...settings,
      templates: (settings.templates || []).filter(t => t.id !== id)
    };

    setSettings(updatedSettings);
    try {
      await api.settings.update(updatedSettings);
      setMessage({ type: 'success', text: `Modèle "${template.name}" supprimé.` });
    } catch (error) {
      setMessage({ type: 'error', text: 'Erreur lors de la suppression.' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api.settings.update(settings);
      setInitialSettings(JSON.parse(JSON.stringify(settings)));
      onUpdate?.(settings);
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

  const addColumn = () => {
    const newCol: HeaderColumn = {
      id: Math.random().toString(36).substr(2, 9),
      width: 20,
      lines: [],
      borderRight: false
    };
    setSettings({
      ...settings,
      headerColumns: [...(settings.headerColumns || []), newCol]
    });
  };

  const removeColumn = (id: string) => {
    setSettings({
      ...settings,
      headerColumns: (settings.headerColumns || []).filter(c => c.id !== id)
    });
  };

  const updateColumn = (id: string, updates: Partial<HeaderColumn>) => {
    setSettings({
      ...settings,
      headerColumns: (settings.headerColumns || []).map(c => c.id === id ? { ...c, ...updates } : c)
    });
  };

  const moveColumn = (id: string, direction: 'left' | 'right') => {
    const cols = [...(settings.headerColumns || [])];
    const index = cols.findIndex(c => c.id === id);
    if (index === -1) return;
    
    if (direction === 'left' && index > 0) {
      [cols[index - 1], cols[index]] = [cols[index], cols[index - 1]];
    } else if (direction === 'right' && index < cols.length - 1) {
      [cols[index + 1], cols[index]] = [cols[index], cols[index + 1]];
    }
    
    setSettings({ ...settings, headerColumns: cols });
  };

  const addLineToColumn = (colId: string, type: 'text' | 'image' = 'text') => {
    const newLine: HeaderLine = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      text: type === 'text' ? 'Nouvelle ligne' : '',
      imageUrl: '',
      fontSize: 10,
      isBold: false,
      isItalic: false,
      alignment: 'center'
    };
    setSettings({
      ...settings,
      headerColumns: (settings.headerColumns || []).map(c => 
        c.id === colId ? { ...c, lines: [...c.lines, newLine] } : c
      )
    });
  };

  const removeLineFromColumn = (colId: string, lineId: string) => {
    setSettings({
      ...settings,
      headerColumns: (settings.headerColumns || []).map(c => 
        c.id === colId ? { ...c, lines: c.lines.filter(l => l.id !== lineId) } : c
      )
    });
  };

  const addCCRule = () => {
    const newRule = { min: 0, max: 10, count: 1 };
    setSettings({
      ...settings,
      ccRules: [...(settings.ccRules || []), newRule].sort((a, b) => a.min - b.min)
    });
  };

  const removeCCRule = (index: number) => {
    const rules = [...(settings.ccRules || [])];
    rules.splice(index, 1);
    setSettings({ ...settings, ccRules: rules });
  };

  const updateCCRule = (index: number, updates: Partial<{ min: number, max: number, count: number }>) => {
    const rules = [...(settings.ccRules || [])];
    rules[index] = { ...rules[index], ...updates };
    setSettings({ ...settings, ccRules: rules });
  };

  const updateLineInColumn = (colId: string, lineId: string, updates: Partial<HeaderLine>) => {
    setSettings({
      ...settings,
      headerColumns: (settings.headerColumns || []).map(c => 
        c.id === colId ? { ...c, lines: c.lines.map(l => l.id === lineId ? { ...l, ...updates } : l) } : c
      )
    });
  };

  const moveLineInColumn = (colId: string, lineId: string, direction: 'up' | 'down') => {
    const columns = [...(settings.headerColumns || [])];
    const colIndex = columns.findIndex(c => c.id === colId);
    if (colIndex === -1) return;
    
    const lines = [...columns[colIndex].lines];
    const lineIndex = lines.findIndex(l => l.id === lineId);
    if (lineIndex === -1) return;
    
    if (direction === 'up' && lineIndex > 0) {
      [lines[lineIndex - 1], lines[lineIndex]] = [lines[lineIndex], lines[lineIndex - 1]];
    } else if (direction === 'down' && lineIndex < lines.length - 1) {
      [lines[lineIndex + 1], lines[lineIndex]] = [lines[lineIndex], lines[lineIndex + 1]];
    }
    
    columns[colIndex] = { ...columns[colIndex], lines };
    setSettings({ ...settings, headerColumns: columns });
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

  const addFooterColumnCustom = () => {
    const newCol: HeaderColumn = {
      id: Math.random().toString(36).substr(2, 9),
      width: 20,
      lines: [],
      borderRight: false
    };
    setSettings({
      ...settings,
      footerColumns: [...(settings.footerColumns || []), newCol]
    });
  };

  const removeFooterColumnCustom = (id: string) => {
    setSettings({
      ...settings,
      footerColumns: (settings.footerColumns || []).filter(c => c.id !== id)
    });
  };

  const updateFooterColumnCustom = (id: string, updates: Partial<HeaderColumn>) => {
    setSettings({
      ...settings,
      footerColumns: (settings.footerColumns || []).map(c => c.id === id ? { ...c, ...updates } : c)
    });
  };

  const moveFooterColumnCustom = (id: string, direction: 'left' | 'right') => {
    const cols = [...(settings.footerColumns || [])];
    const index = cols.findIndex(c => c.id === id);
    if (index === -1) return;
    
    if (direction === 'left' && index > 0) {
      [cols[index - 1], cols[index]] = [cols[index], cols[index - 1]];
    } else if (direction === 'right' && index < cols.length - 1) {
      [cols[index + 1], cols[index]] = [cols[index], cols[index + 1]];
    }
    
    setSettings({ ...settings, footerColumns: cols });
  };

  const addLineToFooterColumn = (colId: string, type: 'text' | 'image' = 'text') => {
    const newLine: HeaderLine = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      text: type === 'text' ? 'Nouvelle ligne' : '',
      imageUrl: '',
      fontSize: 10,
      isBold: false,
      isItalic: false,
      alignment: 'center'
    };
    setSettings({
      ...settings,
      footerColumns: (settings.footerColumns || []).map(c => 
        c.id === colId ? { ...c, lines: [...c.lines, newLine] } : c
      )
    });
  };

  const removeLineFromFooterColumn = (colId: string, lineId: string) => {
    setSettings({
      ...settings,
      footerColumns: (settings.footerColumns || []).map(c => 
        c.id === colId ? { ...c, lines: c.lines.filter(l => l.id !== lineId) } : c
      )
    });
  };

  const updateLineInFooterColumn = (colId: string, lineId: string, updates: Partial<HeaderLine>) => {
    setSettings({
      ...settings,
      footerColumns: (settings.footerColumns || []).map(c => 
        c.id === colId ? { ...c, lines: c.lines.map(l => l.id === lineId ? { ...l, ...updates } : l) } : c
      )
    });
  };

  const moveLineInFooterColumn = (colId: string, lineId: string, direction: 'up' | 'down') => {
    const columns = [...(settings.footerColumns || [])];
    const colIndex = columns.findIndex(c => c.id === colId);
    if (colIndex === -1) return;
    
    const lines = [...columns[colIndex].lines];
    const lineIndex = lines.findIndex(l => l.id === lineId);
    if (lineIndex === -1) return;
    
    if (direction === 'up' && lineIndex > 0) {
      [lines[lineIndex - 1], lines[lineIndex]] = [lines[lineIndex], lines[lineIndex - 1]];
    } else if (direction === 'down' && lineIndex < lines.length - 1) {
      [lines[lineIndex + 1], lines[lineIndex]] = [lines[lineIndex], lines[lineIndex + 1]];
    }
    
    columns[colIndex] = { ...columns[colIndex], lines };
    setSettings({ ...settings, footerColumns: columns });
  };

  const addFooterRow = () => {
    const table = settings.footerTable || { rows: [['', '', ''], ['', '', '']] };
    const colCount = table.rows[0]?.length || 3;
    const newRow = Array(colCount).fill('');
    setSettings({
      ...settings,
      footerTable: {
        rows: [...table.rows, newRow]
      }
    });
  };

  const removeFooterRow = (index: number) => {
    const table = settings.footerTable || { rows: [['', '', ''], ['', '', '']] };
    if (table.rows.length <= 1) return;
    const newRows = [...table.rows];
    newRows.splice(index, 1);
    setSettings({
      ...settings,
      footerTable: { rows: newRows }
    });
  };

  const addFooterColumn = () => {
    const table = settings.footerTable || { rows: [['', '', ''], ['', '', '']] };
    const newRows = table.rows.map(row => [...row, '']);
    setSettings({
      ...settings,
      footerTable: { rows: newRows }
    });
  };

  const removeFooterColumn = (index: number) => {
    const table = settings.footerTable || { rows: [['', '', ''], ['', '', '']] };
    if (table.rows[0]?.length <= 1) return;
    const newRows = table.rows.map(row => {
      const newRow = [...row];
      newRow.splice(index, 1);
      return newRow;
    });
    setSettings({
      ...settings,
      footerTable: { rows: newRows }
    });
  };

  const moveFooterRow = (index: number, direction: 'up' | 'down') => {
    const table = settings.footerTable || { rows: [['', '', ''], ['', '', '']] };
    const rows = [...table.rows];
    if (direction === 'up' && index > 0) {
      [rows[index - 1], rows[index]] = [rows[index], rows[index - 1]];
    } else if (direction === 'down' && index < rows.length - 1) {
      [rows[index + 1], rows[index]] = [rows[index], rows[index + 1]];
    }
    setSettings({ ...settings, footerTable: { rows } });
  };

  const moveFooterColumn = (index: number, direction: 'left' | 'right') => {
    const table = settings.footerTable || { rows: [['', '', ''], ['', '', '']] };
    const rows = table.rows.map(row => {
      const newRow = [...row];
      if (direction === 'left' && index > 0) {
        [newRow[index - 1], newRow[index]] = [newRow[index], newRow[index - 1]];
      } else if (direction === 'right' && index < newRow.length - 1) {
        [newRow[index + 1], newRow[index]] = [newRow[index], newRow[index + 1]];
      }
      return newRow;
    });
    setSettings({ ...settings, footerTable: { rows } });
  };

  const updateFooterCell = (rowIndex: number, colIndex: number, value: string) => {
    const table = settings.footerTable || { rows: [['', '', ''], ['', '', '']] };
    const newRows = [...table.rows];
    newRows[rowIndex] = [...newRows[rowIndex]];
    newRows[rowIndex][colIndex] = value;
    setSettings({
      ...settings,
      footerTable: { rows: newRows }
    });
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
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Paramètres de l'Organisation</h2>
          <p className="text-slate-500 font-medium tracking-tight">Configurez l'identité et les documents de votre établissement.</p>
        </div>
      </div>

      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl w-fit">
        {[
          { id: 'general', label: 'Général', icon: Building2 },
          { id: 'header', label: 'En-tête', icon: LayoutIcon },
          { id: 'footer', label: 'Pied de page', icon: ColumnsIcon },
          { id: 'acad', label: 'Académique', icon: Timer },
          { id: 'extra', label: 'Plus', icon: ShieldAlert },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-3xl border-2 border-slate-100 shadow-soft overflow-hidden">
            {/* General Tab Content */}
            {activeTab === 'general' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-6 h-6 text-indigo-500" />
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Identité de l'Organisation</h3>
                  </div>
                </div>
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nom de l'Institution</label>
                      <input
                        type="text"
                        value={settings.institutionName || ''}
                        onChange={(e) => setSettings({ ...settings, institutionName: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-2xl text-sm font-bold transition-all outline-none"
                        placeholder="Ex: ISTA Oued-Zem"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Nom de l'organisation (Arabe)</label>
                      <input
                        type="text"
                        dir="rtl"
                        value={settings.orgNameArabic || ''}
                        onChange={(e) => setSettings({ ...settings, orgNameArabic: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-2xl text-sm font-bold transition-all outline-none text-right font-amiri"
                        placeholder="مكتب التكوين المهني..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nom de l'organisation (Français)</label>
                      <input
                        type="text"
                        value={settings.orgNameFrench || ''}
                        onChange={(e) => setSettings({ ...settings, orgNameFrench: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-2xl text-sm font-bold transition-all outline-none"
                        placeholder="Office de la formation..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Direction Régionale</label>
                      <input
                        type="text"
                        value={settings.regionalDirection || ''}
                        onChange={(e) => setSettings({ ...settings, regionalDirection: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-2xl text-sm font-bold transition-all outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Année Académique</label>
                      <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-slate-300" />
                        <input
                          type="text"
                          value={settings.academicYear || ''}
                          onChange={(e) => setSettings({ ...settings, academicYear: e.target.value })}
                          className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-2xl text-sm font-bold transition-all outline-none"
                          placeholder="2024-2025"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logos de l'établissement</label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <div className="w-full h-24 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center p-2 relative group overflow-hidden">
                              {settings.orgLogoUrl ? (
                                <img src={settings.orgLogoUrl} alt="Logo Gauche" className="max-h-full object-contain" />
                              ) : <ImageIcon className="w-8 h-8 text-slate-300" />}
                              <label className="absolute inset-0 bg-indigo-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <Upload className="w-5 h-5 mr-2" />
                                <span className="text-[10px] font-black uppercase">Logo Gauche</span>
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => setSettings({ ...settings, orgLogoUrl: reader.result as string });
                                    reader.readAsDataURL(file);
                                  }
                                }} />
                              </label>
                           </div>
                        </div>
                        <div className="space-y-2">
                           <div className="w-full h-24 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center p-2 relative group overflow-hidden">
                              {settings.orgLogoUrlRight ? (
                                <img src={settings.orgLogoUrlRight} alt="Logo Droit" className="max-h-full object-contain" />
                              ) : (settings.orgLogoUrl ? <img src={settings.orgLogoUrl} alt="Fallabck Logo" className="max-h-full object-contain opacity-50 grayscale" /> : <ImageIcon className="w-8 h-8 text-slate-300" />)}
                              <label className="absolute inset-0 bg-indigo-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <Upload className="w-5 h-5 mr-2" />
                                <span className="text-[10px] font-black uppercase">Logo Droit</span>
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => setSettings({ ...settings, orgLogoUrlRight: reader.result as string });
                                    reader.readAsDataURL(file);
                                  }
                                }} />
                              </label>
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Header Tab Content */}
            {activeTab === 'header' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <LayoutIcon className="w-6 h-6 text-indigo-500" />
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Configuration de l'En-tête</h3>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={saveAsTemplate} className="h-10 text-[10px] uppercase font-black tracking-widest px-6 border-emerald-100 text-emerald-600 hover:bg-emerald-50 rounded-xl">
                    <Save className="w-4 h-4 mr-2" /> Enregistrer comme Modèle
                  </Button>
                </div>

            {/* Templates Management area */}
            <div className="p-6 bg-slate-50 border-b border-slate-100">
               <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-3 bg-indigo-500 rounded-full" />
                      <h4 className="text-sm font-bold text-slate-800 tracking-tight">Catalogue des Modèles d'En-tête</h4>
                    </div>
                  {!isAddingNewTemplate && (
                    <Button type="button" variant="outline" size="sm" onClick={saveAsTemplate} className="h-8 text-[10px] uppercase font-black tracking-widest px-3 border-emerald-100 text-emerald-600 hover:bg-emerald-50">
                      <Plus className="w-3.5 h-3.5 mr-1.5" /> Nouveau Modèle
                    </Button>
                  )}
               </div>

               {isAddingNewTemplate && (
                 <div className="mb-6 p-4 bg-emerald-50 rounded-2xl border-2 border-emerald-100 animate-in zoom-in-95 duration-300">
                    <label className="block text-[10px] font-black text-emerald-700 uppercase mb-2 tracking-widest">Nommer votre nouveau modèle</label>
                    <div className="flex gap-2">
                       <input 
                         type="text" 
                         autoFocus
                         value={newTemplateName}
                         onChange={(e) => setNewTemplateName(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && confirmSaveTemplate()}
                         className="flex-1 px-4 py-2 bg-white rounded-xl border border-emerald-200 outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                         placeholder="Ex: Modèle En-tête Classique"
                       />
                       <Button size="sm" onClick={confirmSaveTemplate} className="bg-emerald-600 hover:bg-emerald-700">Enregistrer</Button>
                       <Button size="sm" variant="ghost" onClick={() => { setIsAddingNewTemplate(false); setNewTemplateName(''); }}>Annuler</Button>
                    </div>
                 </div>
               )}

               {(settings.templates || []).length > 0 ? (
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                   {settings.templates?.map(tpl => (
                     <div key={tpl.id} className="group p-4 rounded-2xl border-2 border-slate-200 bg-white hover:border-indigo-500 hover:shadow-lg transition-all space-y-3">
                        <div className="flex items-center justify-between">
                           <div className="flex flex-col flex-1">
                              {templateNamingId === tpl.id ? (
                                <div className="flex gap-1">
                                  <input 
                                    type="text"
                                    autoFocus
                                    value={newTemplateName}
                                    onChange={(e) => setNewTemplateName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && confirmRenameTemplate()}
                                    className="w-full px-2 py-1 text-xs font-bold border border-indigo-200 rounded outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                  <button onClick={confirmRenameTemplate} className="text-emerald-500"><Check className="w-4 h-4" /></button>
                                </div>
                              ) : (
                                <>
                                  <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{tpl.name}</span>
                                  <span className="text-[9px] text-slate-400 font-bold uppercase">{tpl.headerColumns.length} Colonnes</span>
                                </>
                              )}
                           </div>
                           <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => renameTemplate(tpl.id)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Renommer"
                              >
                                <Type className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeTemplate(tpl.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-50">
                           <Button 
                             type="button" 
                             variant="outline" 
                             size="sm" 
                             className="flex-1 h-7 text-[9px] font-black uppercase tracking-widest border-indigo-100 text-indigo-600 hover:bg-indigo-50"
                             onClick={() => applyTemplate(tpl)}
                           >
                              Visualiser
                           </Button>
                           <Button 
                             type="button" 
                             variant="outline" 
                             size="sm" 
                             className="flex-1 h-7 text-[9px] font-black uppercase tracking-widest border-amber-100 text-amber-600 hover:bg-amber-50"
                             onClick={() => updateTemplate(tpl.id)}
                           >
                              Mise à jour
                           </Button>
                        </div>
                     </div>
                   ))}
                 </div>
               ) : (
                 <div className="py-8 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
                    <p className="text-xs font-bold text-slate-400 uppercase italic">Aucun modèle personnalisé enregistré.</p>
                 </div>
               )}
            </div>

            {/* Visual Editor Section */}
            <div className="p-4 sm:p-12 bg-slate-200/50 relative overflow-hidden">
               {/* Decorative background elements to look like a desk */}
               <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
                 <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded shadow-sm rotate-12" />
                 <div className="absolute top-40 right-20 w-24 h-32 bg-white rounded shadow-sm -rotate-6" />
                 <div className="absolute bottom-10 left-1/4 w-40 h-1 bg-slate-300 rounded-full" />
               </div>

              <div className="flex flex-col items-center gap-6 relative z-10 w-full">
                <div className="flex items-center justify-between w-full max-w-3xl px-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                        Aperçu Live du Document Word
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-lg border border-slate-300 shadow-sm">
                      <Ruler className="w-3 h-3 text-slate-400" />
                      <span className="text-[9px] font-bold text-slate-500">FORMAT A4</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold italic">Dimensions réelles à l'exportation</p>
                </div>

                <div className="relative w-full max-w-3xl">
                  {/* Digital Ruler */}
                  <div className="absolute -top-4 left-0 w-full h-4 bg-slate-300/50 rounded-t-sm flex items-end px-1 overflow-hidden pointer-events-none">
                    {Array.from({ length: 21 }).map((_, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center">
                        <div className="h-2 w-[1px] bg-slate-400" />
                        <span className="text-[6px] text-slate-500 scale-75 leading-none mt-0.5">{i}</span>
                      </div>
                    ))}
                  </div>

                  <div className="w-full bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-sm min-h-[400px] flex flex-col p-8 sm:p-12 border border-slate-200 transition-all duration-500 hover:shadow-[0_30px_60_rgba(0,0,0,0.15)] ring-1 ring-slate-900/5 relative overflow-hidden">
                    {/* Watermark Preview */}
                    {settings.showWatermark && settings.watermarkText && (
                      <div 
                        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0"
                        style={{ opacity: (settings.watermarkOpacity || 3) / 100 }}
                      >
                        <div 
                          className="font-black text-6xl lg:text-8xl uppercase -rotate-45 tracking-[2rem] whitespace-nowrap"
                          style={{ color: settings.watermarkColor || '#000000' }}
                        >
                          {settings.watermarkText}
                        </div>
                      </div>
                    )}
                  {/* The actual header preview */}
                  <div className="border-b-2 border-slate-900 pb-2">
                    <div className="flex min-h-[140px] w-full">
                      {(settings.headerColumns || []).map((col, colIdx) => (
                        <div 
                          key={col.id} 
                          style={{ 
                            width: `${col.width}%`,
                            borderRight: col.borderRight ? '1.5px solid #000' : 'none',
                            borderLeft: col.borderLeft ? '1.5px solid #000' : 'none',
                            backgroundColor: col.bgColor || 'transparent',
                            color: col.textColor || '#000'
                          }}
                          className="flex flex-col justify-center py-2"
                        >
                          {col.lines.map((line, lineIdx) => (
                            <div 
                              key={line.id} 
                              style={{ 
                                fontSize: `${line.fontSize}px`, 
                                fontWeight: line.isBold ? 'bold' : 'normal',
                                fontStyle: line.isItalic ? 'italic' : 'normal',
                                textAlign: line.alignment,
                                fontFamily: line.fontFamily || 'inherit',
                                padding: '1px 8px',
                                lineHeight: '1.2',
                                color: line.type === 'text' ? (col.textColor || '#000') : 'inherit'
                              }}
                              className="flex items-center justify-center min-h-[1.2em]"
                            >
                              {line.type === 'image' ? (
                                <img 
                                  src={line.imageUrl || 'https://placehold.co/40x40?text=Logo'} 
                                  alt="Logo" 
                                  style={{ 
                                    width: line.imageWidth ? `${line.imageWidth}px` : '40px',
                                    height: line.imageHeight ? `${line.imageHeight}px` : '40px',
                                    objectFit: 'contain'
                                  }}
                                />
                              ) : (
                                previewReplaceVariables(line.text)
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer Preview */}
                  {settings.showFooter && (
                    <div className="mt-auto pt-4 border-t-2 border-slate-900">
                      <div className="flex w-full">
                        {(settings.footerColumns || []).map((col) => (
                          <div 
                            key={col.id} 
                            style={{ 
                              width: `${col.width}%`,
                              borderRight: col.borderRight ? '1.5px solid #000' : 'none',
                              borderLeft: col.borderLeft ? '1.5px solid #000' : 'none',
                              backgroundColor: col.bgColor || 'transparent',
                              color: col.textColor || '#000'
                            }}
                            className="flex flex-col justify-center py-1"
                          >
                            {col.lines.map((line) => (
                              <div 
                                key={line.id} 
                                style={{ 
                                  fontSize: `${line.fontSize}px`, 
                                  fontWeight: line.isBold ? 'bold' : 'normal',
                                  fontStyle: line.isItalic ? 'italic' : 'normal',
                                  textAlign: line.alignment,
                                  fontFamily: line.fontFamily || 'inherit',
                                  padding: '1px 8px',
                                  lineHeight: '1.2',
                                  color: line.type === 'text' ? (col.textColor || '#000') : 'inherit',
                                  display: 'flex',
                                  justifyContent: line.alignment === 'center' ? 'center' : line.alignment === 'right' ? 'flex-end' : 'flex-start'
                                }}
                                className="items-center min-h-[1.2em]"
                              >
                                {line.type === 'image' ? (
                                  <img 
                                    src={line.imageUrl || 'https://placehold.co/40x40?text=Logo'} 
                                    alt="Logo" 
                                    style={{ 
                                      width: line.imageWidth ? `${line.imageWidth}px` : '30px',
                                      height: line.imageHeight ? `${line.imageHeight}px` : '30px',
                                      objectFit: 'contain'
                                    }}
                                  />
                                ) : (
                                  previewReplaceVariables(line.text)
                                )}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Document Body Placeholder */}
                  <div className="mt-8 space-y-4 opacity-10 pointer-events-none">
                    <div className="h-4 bg-slate-900 rounded w-3/4" />
                    <div className="h-4 bg-slate-400 rounded w-full" />
                    <div className="h-4 bg-slate-400 rounded w-full" />
                  </div>

                  {/* Filière Information Row */}
                  <div className="mt-8 grid grid-cols-3 text-[10px] border-t border-slate-200 pt-2 font-serif italic text-slate-400">
                    <div>Filière: [Auto]</div>
                    <div className="text-center">Niveau: [Auto]</div>
                    <div className="text-right">Année: {settings.academicYear}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Default Exam Settings Section */}
            <div className="p-6 border-t border-slate-100 bg-white">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-6">
                 <Settings className="w-4 h-4 text-indigo-500" />
                 Paramètres par Défaut des Examens
               </h4>
               
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="p-5 rounded-2xl border-2 border-slate-50 bg-slate-50/30 space-y-4">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <Timer className="w-4 h-4 text-indigo-600" />
                      </div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-tight">Durée Standard</label>
                    </div>
                    <div className="flex items-center gap-3">
                      <input 
                        type="number"
                        value={settings.defaultExamSettings?.durationMinutes || 60}
                        onChange={(e) => setSettings({
                          ...settings,
                          defaultExamSettings: {
                            ...(settings.defaultExamSettings || { durationMinutes: 60, shuffleQuestions: true, disableCopyPaste: false }),
                            durationMinutes: parseInt(e.target.value) || 0
                          }
                        })}
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 font-bold text-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <span className="text-xs font-bold text-slate-400">min</span>
                    </div>
                    <p className="text-[9px] text-slate-400 font-medium">Durée pré-remplie lors de la création d'un examen.</p>
                 </div>

                 <div className="p-5 rounded-2xl border-2 border-slate-50 bg-slate-50/30 space-y-4">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                        <RefreshCw className="w-4 h-4 text-amber-600" />
                      </div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-tight">Mélange des Questions</label>
                    </div>
                    <div className="flex items-center gap-3 h-[42px]">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={settings.defaultExamSettings?.shuffleQuestions ?? true} 
                          onChange={(e) => setSettings({
                            ...settings,
                            defaultExamSettings: {
                              ...(settings.defaultExamSettings || { durationMinutes: 60, shuffleQuestions: true, disableCopyPaste: false }),
                              shuffleQuestions: e.target.checked
                            }
                          })}
                          className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                        <span className="ml-3 text-xs font-bold text-slate-600">{settings.defaultExamSettings?.shuffleQuestions ?? true ? 'Activé' : 'Désactivé'}</span>
                      </label>
                    </div>
                    <p className="text-[9px] text-slate-400 font-medium">L'ordre des questions sera aléatoire par défaut.</p>
                 </div>

                 <div className="p-5 rounded-2xl border-2 border-slate-50 bg-slate-50/30 space-y-4">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                        <ShieldAlert className="w-4 h-4 text-rose-600" />
                      </div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-tight">Anti Copier-Coller</label>
                    </div>
                    <div className="flex items-center gap-3 h-[42px]">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={settings.defaultExamSettings?.disableCopyPaste ?? false} 
                          onChange={(e) => setSettings({
                            ...settings,
                            defaultExamSettings: {
                              ...(settings.defaultExamSettings || { durationMinutes: 60, shuffleQuestions: true, disableCopyPaste: false }),
                              disableCopyPaste: e.target.checked
                            }
                          })}
                          className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-rose-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
                        <span className="ml-3 text-xs font-bold text-slate-600">{settings.defaultExamSettings?.disableCopyPaste ?? false ? 'Sécurisé' : 'Standard'}</span>
                      </label>
                    </div>
                    <p className="text-[9px] text-slate-400 font-medium">Empêche les étudiants de copier les questions ou coller des réponses.</p>
                 </div>
               </div>
            </div>

                  {/* Advanced Header Editor */}
                  <div className="p-8 space-y-8">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                          <ColumnsIcon className="w-4 h-4 text-indigo-500" />
                          Configuration des Colonnes
                        </h4>
                        <p className="text-[10px] text-slate-400 font-medium">Divisez votre document en zones de texte et d'images.</p>
                      </div>
                      <div className="flex items-center gap-3">
                         <div className="flex items-center gap-3 p-1.5 bg-slate-100 rounded-xl px-3 border border-slate-200/50">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={settings.showHeaderLines || false} 
                                onChange={(e) => setSettings({ ...settings, showHeaderLines: e.target.checked })}
                                className="sr-only peer" 
                              />
                              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">Séparateurs</span>
                         </div>
                         <Button type="button" variant="outline" size="sm" onClick={addColumn} className="rounded-xl px-4 font-black uppercase text-[10px] tracking-widest">
                           <Plus className="w-4 h-4 mr-1.5" /> Ajouter
                         </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                {(settings.headerColumns || []).map((col, colIdx) => (
                  <div key={col.id} className="p-5 bg-white rounded-2xl border-2 border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] font-black uppercase text-slate-400">Largeur (%)</label>
                          <input 
                            type="number" 
                            value={col.width || 20}
                            onChange={(e) => updateColumn(col.id, { width: parseInt(e.target.value) || 20 })}
                            className="w-16 px-2 py-1 text-xs rounded border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                           <input 
                             type="checkbox"
                             checked={col.borderLeft || false}
                             onChange={(e) => updateColumn(col.id, { borderLeft: e.target.checked })}
                             className="w-4 h-4 text-indigo-600 rounded"
                           />
                           <label className="text-[10px] font-bold text-slate-500 uppercase">Bordure Gauche</label>
                        </div>
                        <div className="flex items-center gap-2">
                           <input 
                             type="checkbox"
                             checked={col.borderRight || false}
                             onChange={(e) => updateColumn(col.id, { borderRight: e.target.checked })}
                             className="w-4 h-4 text-indigo-600 rounded"
                           />
                           <label className="text-[10px] font-bold text-slate-500 uppercase">Bordure Droite</label>
                        </div>
                        <div className="flex items-center gap-3 ml-4 pl-4 border-l border-slate-200">
                           <div className="flex flex-col">
                             <label className="text-[8px] font-black text-slate-400 uppercase">Fond</label>
                             <input 
                               type="color" 
                               value={col.bgColor || '#ffffff'}
                               onChange={(e) => updateColumn(col.id, { bgColor: e.target.value })}
                               className="w-6 h-6 rounded cursor-pointer border border-slate-200 p-0"
                             />
                           </div>
                           <div className="flex flex-col">
                             <label className="text-[8px] font-black text-slate-400 uppercase">Texte</label>
                             <input 
                               type="color" 
                               value={col.textColor || '#000000'}
                               onChange={(e) => updateColumn(col.id, { textColor: e.target.value })}
                               className="w-6 h-6 rounded cursor-pointer border border-slate-200 p-0"
                             />
                           </div>
                           <button 
                             type="button"
                             onClick={() => updateColumn(col.id, { bgColor: '#ffffff', textColor: '#000000' })}
                             className="text-[8px] font-bold text-slate-400 hover:text-indigo-600 underline"
                           >
                             Reset
                           </button>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <button 
                          type="button" 
                          onClick={() => moveColumn(col.id, 'left')} 
                          disabled={colIdx === 0}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 disabled:opacity-30"
                        >
                          <MoveUp className="w-4 h-4 -rotate-90" />
                        </button>
                        <button 
                          type="button" 
                          onClick={() => moveColumn(col.id, 'right')} 
                          disabled={colIdx === (settings.headerColumns?.length || 0) - 1}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 disabled:opacity-30"
                        >
                          <MoveDown className="w-4 h-4 -rotate-90" />
                        </button>
                        <button 
                          type="button" 
                          onClick={() => removeColumn(col.id)} 
                          className="p-1.5 text-slate-400 hover:text-rose-600 ml-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {col.lines.map((line, lineIdx) => (
                        <div key={line.id} className="flex gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 items-start">
                          <div className="flex flex-col gap-2 pt-1">
                            <button 
                              type="button" 
                              onClick={() => updateLineInColumn(col.id, line.id, { type: line.type === 'text' ? 'image' : 'text' })}
                              className={`p-1.5 rounded-lg transition-colors ${line.type === 'image' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}
                              title={line.type === 'text' ? 'Changer en Image' : 'Changer en Texte'}
                            >
                              {line.type === 'image' ? <ImageIcon className="w-3.5 h-3.5" /> : <Type className="w-3.5 h-3.5" />}
                            </button>
                          </div>

                          <div className="flex-1 space-y-3">
                            {line.type === 'text' ? (
                              <>
                              <textarea
                                value={line.text || ''}
                                onChange={(e) => updateLineInColumn(col.id, line.id, { text: e.target.value })}
                                className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Texte de la ligne..."
                                rows={1}
                                style={{ direction: /[\u0600-\u06FF]/.test(line.text || '') ? 'rtl' : 'ltr' }}
                              />
                              <div className="flex flex-wrap gap-1 mt-1">
                                 {['TITRE', 'MODULE', 'PROF', 'DATE', 'GROUPE', 'DUREE', 'TYPE', 'FILIERE', 'ORG_AR', 'ORG_FR'].map(v => (
                                   <button 
                                     key={v}
                                     type="button"
                                     onClick={() => updateLineInColumn(col.id, line.id, { text: `${line.text || ''} {{${v}}}` })}
                                     className="text-[8px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded hover:bg-indigo-100 hover:text-indigo-600 transition-colors border border-slate-200/50"
                                   >
                                     + {'{{'}{v}{'}}'}
                                   </button>
                                 ))}
                              </div>
                              </>
                            ) : (
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <input 
                                    type="text" 
                                    value={line.imageUrl || ''}
                                    onChange={(e) => updateLineInColumn(col.id, line.id, { imageUrl: e.target.value })}
                                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="URL de l'image (logo)..."
                                  />
                                </div>
                                <label className="cursor-pointer bg-white p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">
                                  <Upload className="w-4 h-4 text-slate-500" />
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = () => updateLineInColumn(col.id, line.id, { imageUrl: reader.result as string });
                                        reader.readAsDataURL(file);
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                            )}

                              <div className="flex flex-wrap gap-4 items-center">
                                {line.type === 'image' && (
                                  <>
                                    <div className="flex items-center gap-1.5">
                                      <label className="text-[9px] font-black text-slate-400">LARGEUR</label>
                                      <input 
                                        type="number" 
                                        value={line.imageWidth || 40} 
                                        onChange={(e) => updateLineInColumn(col.id, line.id, { imageWidth: parseInt(e.target.value) || 40 })}
                                        className="w-12 px-1.5 py-0.5 text-[10px] rounded border border-slate-200 outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                                      />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <label className="text-[9px] font-black text-slate-400">HAUTEUR</label>
                                      <input 
                                        type="number" 
                                        value={line.imageHeight || 40} 
                                        onChange={(e) => updateLineInColumn(col.id, line.id, { imageHeight: parseInt(e.target.value) || 40 })}
                                        className="w-12 px-1.5 py-0.5 text-[10px] rounded border border-slate-200 outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                                      />
                                    </div>
                                  </>
                                )}
                                <div className="flex items-center gap-1.5">
                                <label className="text-[9px] font-black text-slate-400">ALIGN</label>
                                <div className="flex border border-slate-200 rounded-md overflow-hidden bg-white">
                                  <button 
                                    type="button" 
                                    onClick={() => updateLineInColumn(col.id, line.id, { alignment: 'left' })}
                                    className={`p-1 ${line.alignment === 'left' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}
                                  >
                                    <AlignLeft className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    type="button" 
                                    onClick={() => updateLineInColumn(col.id, line.id, { alignment: 'center' })}
                                    className={`p-1 border-x border-slate-100 ${line.alignment === 'center' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}
                                  >
                                    <AlignCenter className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    type="button" 
                                    onClick={() => updateLineInColumn(col.id, line.id, { alignment: 'right' })}
                                    className={`p-1 ${line.alignment === 'right' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}
                                  >
                                    <AlignRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {line.type === 'text' ? (
                                <>
                                  <div className="flex items-center gap-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase">Taille</label>
                                    <input
                                      type="number"
                                      value={line.fontSize || 12}
                                      onChange={(e) => updateLineInColumn(col.id, line.id, { fontSize: parseInt(e.target.value) || 12 })}
                                      className="w-12 px-1.5 py-1 text-[10px] rounded border border-slate-200"
                                    />
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                      <input 
                                        type="checkbox" 
                                        checked={line.isBold || false} 
                                        onChange={(e) => updateLineInColumn(col.id, line.id, { isBold: e.target.checked })}
                                        className="rounded text-indigo-600"
                                      />
                                      <span className="text-[9px] font-black text-slate-400 uppercase">Gras</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                      <input 
                                        type="checkbox" 
                                        checked={line.isItalic || false} 
                                        onChange={(e) => updateLineInColumn(col.id, line.id, { isItalic: e.target.checked })}
                                        className="rounded text-indigo-600"
                                      />
                                      <span className="text-[9px] font-black text-slate-400 uppercase">Ital</span>
                                    </label>
                                  </div>
                                  <select
                                    value={line.fontFamily || ''}
                                    onChange={(e) => updateLineInColumn(col.id, line.id, { fontFamily: e.target.value })}
                                    className="px-1.5 py-1 text-[10px] rounded border border-slate-200 bg-white"
                                  >
                                    <option value="">Police par défaut</option>
                                    {FONT_FAMILIES.map(font => (
                                      <option key={font.value} value={font.value}>{font.name}</option>
                                    ))}
                                  </select>
                                </>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase">Largeur (px)</label>
                                    <input
                                      type="number"
                                      value={line.imageWidth || 40}
                                      onChange={(e) => updateLineInColumn(col.id, line.id, { imageWidth: parseInt(e.target.value) || 40 })}
                                      className="w-14 px-1.5 py-1 text-[10px] rounded border border-slate-200"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase">Hauteur (px)</label>
                                    <input
                                      type="number"
                                      value={line.imageHeight || 40}
                                      onChange={(e) => updateLineInColumn(col.id, line.id, { imageHeight: parseInt(e.target.value) || 40 })}
                                      className="w-14 px-1.5 py-1 text-[10px] rounded border border-slate-200"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-1 border-l border-slate-200 pl-2">
                            <button 
                              type="button" 
                              onClick={() => moveLineInColumn(col.id, line.id, 'up')}
                              disabled={lineIdx === 0}
                              className="p-1 text-slate-300 hover:text-indigo-600 disabled:opacity-20"
                            >
                              <MoveUp className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              type="button" 
                              onClick={() => moveLineInColumn(col.id, line.id, 'down')}
                              disabled={lineIdx === col.lines.length - 1}
                              className="p-1 text-slate-300 hover:text-indigo-600 disabled:opacity-20"
                            >
                              <MoveDown className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              type="button" 
                              onClick={() => removeLineFromColumn(col.id, line.id)}
                              className="p-1 text-slate-300 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {col.lines.length === 0 && (
                        <div className="py-4 border shadow-inner bg-slate-50/50 border-dashed border-slate-200 rounded-xl text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Colonne Vide</p>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                         <Button type="button" variant="outline" size="sm" className="flex-1 text-[10px] py-1 h-auto" onClick={() => addLineToColumn(col.id, 'text')}>
                           <Type className="w-3 h-3 mr-1" />
                           Texte
                         </Button>
                         <Button type="button" variant="outline" size="sm" className="flex-1 text-[10px] py-1 h-auto" onClick={() => addLineToColumn(col.id, 'image')}>
                           <ImageIcon className="w-3 h-3 mr-1" />
                           Image
                         </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {(settings.headerColumns || []).length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl bg-white shadow-sm">
                    <p className="text-slate-400 text-sm">Aucune colonne. Cliquez sur "Ajouter une colonne" pour commencer la mise en page.</p>
                  </div>
                )}
              </div>
            </div>

              </div>
            )}

            {/* Footer Tab Content */}
            {activeTab === 'footer' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <ColumnsIcon className="w-6 h-6 text-indigo-500" />
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Pied de Page</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={settings.showFooter || false} 
                        onChange={(e) => setSettings({ ...settings, showFooter: e.target.checked })}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Activer</span>
                  </div>
                </div>

                <div className="p-8 space-y-8">
                  {settings.showFooter ? (
                    <>
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                          <LayoutIcon className="w-4 h-4 text-indigo-500" />
                          Configuration des Colonnes de Pied de Page
                        </h4>
                        <div className="flex items-center gap-3">
                           <div className="flex items-center gap-3 p-1.5 bg-slate-100 rounded-xl px-3 border border-slate-200/50">
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={settings.showFooterLines || false} 
                                  onChange={(e) => setSettings({ ...settings, showFooterLines: e.target.checked })}
                                  className="sr-only peer" 
                                />
                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                              </label>
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">Séparateurs</span>
                           </div>
                        <Button type="button" variant="outline" size="sm" onClick={addFooterColumnCustom} className="rounded-xl px-4 font-black uppercase text-[10px] tracking-widest">
                          <Plus className="w-4 h-4 mr-1.5" /> Ajouter une colonne
                        </Button>
                        </div>
                      </div>

                      <div className="space-y-6">
                        {(settings.footerColumns || []).map((col, colIdx) => (
                          <div key={col.id} className="p-5 bg-white rounded-2xl border-2 border-slate-100 shadow-sm space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <label className="text-[10px] font-black uppercase text-slate-400">Largeur (%)</label>
                                  <input 
                                    type="number" 
                                    value={col.width || 20}
                                    onChange={(e) => updateFooterColumnCustom(col.id, { width: parseInt(e.target.value) || 20 })}
                                    className="w-16 px-2 py-1 text-xs rounded border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                   <input 
                                     type="checkbox"
                                     checked={col.borderLeft || false}
                                     onChange={(e) => updateFooterColumnCustom(col.id, { borderLeft: e.target.checked })}
                                     className="w-4 h-4 text-indigo-600 rounded"
                                   />
                                   <label className="text-[10px] font-bold text-slate-500 uppercase">Bordure Gauche</label>
                                </div>
                                <div className="flex items-center gap-2">
                                   <input 
                                     type="checkbox"
                                     checked={col.borderRight || false}
                                     onChange={(e) => updateFooterColumnCustom(col.id, { borderRight: e.target.checked })}
                                     className="w-4 h-4 text-indigo-600 rounded"
                                   />
                                   <label className="text-[10px] font-bold text-slate-500 uppercase">Bordure Droite</label>
                                </div>
                                <div className="flex items-center gap-3 ml-4 pl-4 border-l border-slate-200">
                                   <div className="flex flex-col">
                                     <label className="text-[8px] font-black text-slate-400 uppercase">Fond</label>
                                     <input 
                                       type="color" 
                                       value={col.bgColor || '#ffffff'}
                                       onChange={(e) => updateFooterColumnCustom(col.id, { bgColor: e.target.value })}
                                       className="w-6 h-6 rounded cursor-pointer border border-slate-200 p-0"
                                     />
                                   </div>
                                   <div className="flex flex-col">
                                     <label className="text-[8px] font-black text-slate-400 uppercase">Texte</label>
                                     <input 
                                       type="color" 
                                       value={col.textColor || '#000000'}
                                       onChange={(e) => updateFooterColumnCustom(col.id, { textColor: e.target.value })}
                                       className="w-6 h-6 rounded cursor-pointer border border-slate-200 p-0"
                                     />
                                   </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-1">
                                <button 
                                  type="button" 
                                  onClick={() => moveFooterColumnCustom(col.id, 'left')} 
                                  disabled={colIdx === 0}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 disabled:opacity-30"
                                >
                                  <MoveUp className="w-4 h-4 -rotate-90" />
                                </button>
                                <button 
                                  type="button" 
                                  onClick={() => moveFooterColumnCustom(col.id, 'right')} 
                                  disabled={colIdx === (settings.footerColumns?.length || 0) - 1}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 disabled:opacity-30"
                                >
                                  <MoveDown className="w-4 h-4 -rotate-90" />
                                </button>
                                <button 
                                  type="button" 
                                  onClick={() => removeFooterColumnCustom(col.id)} 
                                  className="p-1.5 text-slate-400 hover:text-rose-600 ml-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            <div className="space-y-3">
                              {col.lines.map((line, lineIdx) => (
                                <div key={line.id} className="flex gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 items-start">
                                  <div className="flex flex-col gap-2 pt-1">
                                    <button 
                                      type="button" 
                                      onClick={() => updateLineInFooterColumn(col.id, line.id, { type: line.type === 'text' ? 'image' : 'text' })}
                                      className={`p-1.5 rounded-lg transition-colors ${line.type === 'image' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}
                                      title={line.type === 'text' ? 'Changer en Image' : 'Changer en Texte'}
                                    >
                                      {line.type === 'image' ? <ImageIcon className="w-3.5 h-3.5" /> : <Type className="w-3.5 h-3.5" />}
                                    </button>
                                  </div>

                                  <div className="flex-1 space-y-3">
                                    {line.type === 'text' ? (
                                      <>
                                      <textarea
                                        value={line.text || ''}
                                        onChange={(e) => updateLineInFooterColumn(col.id, line.id, { text: e.target.value })}
                                        className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Texte du pied de page..."
                                        rows={1}
                                        style={{ direction: /[\u0600-\u06FF]/.test(line.text || '') ? 'rtl' : 'ltr' }}
                                      />
                                      <div className="flex flex-wrap gap-1 mt-1">
                                         {['TITRE', 'MODULE', 'PROF', 'DATE', 'GROUPE', 'DUREE', 'TYPE', 'FILIERE', 'PAGE', 'TOTAL', 'ORG_AR', 'ORG_FR'].map(v => (
                                           <button 
                                             key={v}
                                             type="button"
                                             onClick={() => updateLineInFooterColumn(col.id, line.id, { text: `${line.text || ''} {{${v}}}` })}
                                             className="text-[8px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded hover:bg-indigo-100 hover:text-indigo-600 transition-colors border border-slate-200/50"
                                           >
                                             + {'{{'}{v}{'}}'}
                                           </button>
                                         ))}
                                      </div>
                                      </>
                                    ) : (
                                      <div className="flex gap-2">
                                        <div className="flex-1">
                                          <input 
                                            type="text" 
                                            value={line.imageUrl || ''}
                                            onChange={(e) => updateLineInFooterColumn(col.id, line.id, { imageUrl: e.target.value })}
                                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="URL de l'image (logo)..."
                                          />
                                        </div>
                                        <label className="cursor-pointer bg-white p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">
                                          <Upload className="w-4 h-4 text-slate-500" />
                                          <input 
                                            type="file" 
                                            accept="image/*" 
                                            className="hidden" 
                                            onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => updateLineInFooterColumn(col.id, line.id, { imageUrl: reader.result as string });
                                                reader.readAsDataURL(file);
                                              }
                                            }}
                                          />
                                        </label>
                                      </div>
                                    )}

                                      <div className="flex flex-wrap gap-4 items-center">
                                        {line.type === 'image' && (
                                          <>
                                            <div className="flex items-center gap-1.5">
                                              <label className="text-[9px] font-black text-slate-400">LARGEUR</label>
                                              <input 
                                                type="number" 
                                                value={line.imageWidth || 30} 
                                                onChange={(e) => updateLineInFooterColumn(col.id, line.id, { imageWidth: parseInt(e.target.value) || 30 })}
                                                className="w-12 px-1.5 py-0.5 text-[10px] rounded border border-slate-200 outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                                              />
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                              <label className="text-[9px] font-black text-slate-400">HAUTEUR</label>
                                              <input 
                                                type="number" 
                                                value={line.imageHeight || 30} 
                                                onChange={(e) => updateLineInFooterColumn(col.id, line.id, { imageHeight: parseInt(e.target.value) || 30 })}
                                                className="w-12 px-1.5 py-0.5 text-[10px] rounded border border-slate-200 outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                                              />
                                            </div>
                                          </>
                                        )}
                                        <div className="flex items-center gap-1.5">
                                        <label className="text-[9px] font-black text-slate-400">ALIGN</label>
                                        <div className="flex border border-slate-200 rounded-md overflow-hidden bg-white">
                                          <button 
                                            type="button" 
                                            onClick={() => updateLineInFooterColumn(col.id, line.id, { alignment: 'left' })}
                                            className={`p-1 ${line.alignment === 'left' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}
                                          >
                                            <AlignLeft className="w-3.5 h-3.5" />
                                          </button>
                                          <button 
                                            type="button" 
                                            onClick={() => updateLineInFooterColumn(col.id, line.id, { alignment: 'center' })}
                                            className={`p-1 border-x border-slate-100 ${line.alignment === 'center' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}
                                          >
                                            <AlignCenter className="w-3.5 h-3.5" />
                                          </button>
                                          <button 
                                            type="button" 
                                            onClick={() => updateLineInFooterColumn(col.id, line.id, { alignment: 'right' })}
                                            className={`p-1 ${line.alignment === 'right' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}
                                          >
                                            <AlignRight className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>

                                      {line.type === 'text' && (
                                        <>
                                          <div className="flex items-center gap-1.5">
                                            <label className="text-[9px] font-black text-slate-400 uppercase">Taille</label>
                                            <input
                                              type="number"
                                              value={line.fontSize || 9}
                                              onChange={(e) => updateLineInFooterColumn(col.id, line.id, { fontSize: parseInt(e.target.value) || 9 })}
                                              className="w-12 px-1.5 py-1 text-[10px] rounded border border-slate-200"
                                            />
                                          </div>
                                          <div className="flex items-center gap-4">
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                              <input 
                                                type="checkbox" 
                                                checked={line.isBold || false} 
                                                onChange={(e) => updateLineInFooterColumn(col.id, line.id, { isBold: e.target.checked })}
                                                className="rounded text-indigo-600"
                                              />
                                              <span className="text-[9px] font-black text-slate-400 uppercase">Gras</span>
                                            </label>
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                              <input 
                                                type="checkbox" 
                                                checked={line.isItalic || false} 
                                                onChange={(e) => updateLineInFooterColumn(col.id, line.id, { isItalic: e.target.checked })}
                                                className="rounded text-indigo-600"
                                              />
                                              <span className="text-[9px] font-black text-slate-400 uppercase">Ital</span>
                                            </label>
                                          </div>
                                          <select
                                            value={line.fontFamily || ''}
                                            onChange={(e) => updateLineInFooterColumn(col.id, line.id, { fontFamily: e.target.value })}
                                            className="px-1.5 py-1 text-[10px] rounded border border-slate-200 bg-white"
                                          >
                                            <option value="">Police par défaut</option>
                                            {FONT_FAMILIES.map(font => (
                                              <option key={font.value} value={font.value}>{font.name}</option>
                                            ))}
                                          </select>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex flex-col gap-1 border-l border-slate-200 pl-2">
                                    <button 
                                      type="button" 
                                      onClick={() => moveLineInFooterColumn(col.id, line.id, 'up')}
                                      disabled={lineIdx === 0}
                                      className="p-1 text-slate-300 hover:text-indigo-600 disabled:opacity-20"
                                    >
                                      <MoveUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                      type="button" 
                                      onClick={() => moveLineInFooterColumn(col.id, line.id, 'down')}
                                      disabled={lineIdx === col.lines.length - 1}
                                      className="p-1 text-slate-300 hover:text-indigo-600 disabled:opacity-20"
                                    >
                                      <MoveDown className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                      type="button" 
                                      onClick={() => removeLineFromFooterColumn(col.id, line.id)}
                                      className="p-1 text-slate-300 hover:text-rose-600"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}

                              <div className="flex gap-2 pt-2">
                                 <Button type="button" variant="outline" size="sm" className="flex-1 text-[10px] py-1 h-auto" onClick={() => addLineToFooterColumn(col.id, 'text')}>
                                   <Plus className="w-3 h-3 mr-1" />
                                   Ajouter Texte
                                 </Button>
                                 <Button type="button" variant="outline" size="sm" className="flex-1 text-[10px] py-1 h-auto" onClick={() => addLineToFooterColumn(col.id, 'image')}>
                                   <ImageIcon className="w-3 h-3 mr-1" />
                                   Ajouter Image
                                 </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                       <LayoutIcon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                       <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Le pied de page est désactivé</p>
                       <p className="text-xs text-slate-400 mt-1">Activez-le en haut pour configurer les mentions légales.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Academic Tab Content */}
            {activeTab === 'acad' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <Timer className="w-6 h-6 text-indigo-500" />
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Règles & Paramètres Académiques</h3>
                  </div>
                </div>

                <div className="p-8 space-y-10">
                   {/* CC Rules */}
                   <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-tight">
                            <div className="w-1 h-3 bg-amber-400 rounded-full" />
                            Règles des Contrôles Continus (CC)
                          </h4>
                          <p className="text-[10px] text-slate-400 font-medium">Définissez le nombre de contrôles requis selon la masse horaire.</p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={addCCRule} className="rounded-xl px-4 font-black uppercase text-[10px] tracking-widest">
                          <Plus className="w-4 h-4 mr-1.5" /> Ajouter
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {(settings.ccRules || []).map((rule, idx) => (
                          <div key={idx} className="flex items-center gap-4 bg-white p-4 rounded-2xl border-2 border-slate-100 shadow-sm group">
                            <div className="grid grid-cols-3 gap-3 flex-1">
                              <div className="space-y-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase">MinH</label>
                                <input 
                                  type="number" 
                                  value={rule.min || 0}
                                  onChange={(e) => updateCCRule(idx, { min: parseInt(e.target.value) || 0 })}
                                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase">MaxH</label>
                                <input 
                                  type="number" 
                                  value={rule.max || 0}
                                  onChange={(e) => updateCCRule(idx, { max: parseInt(e.target.value) || 0 })}
                                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase text-indigo-600">Nb CC</label>
                                <input 
                                  type="number" 
                                  value={rule.count || 0}
                                  onChange={(e) => updateCCRule(idx, { count: parseInt(e.target.value) || 0 })}
                                  className="w-full px-2 py-1.5 text-xs rounded-lg border-2 border-indigo-100 focus:border-indigo-500 outline-none font-bold text-indigo-600 text-center"
                                />
                              </div>
                            </div>
                            <button type="button" onClick={() => removeCCRule(idx)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                   </div>

                   {/* Exam Settings */}
                   <div className="space-y-6">
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-tight">
                          <div className="w-1 h-3 bg-violet-400 rounded-full" />
                          Paramètres d'Examen par Défaut
                        </h4>
                        <p className="text-[10px] text-slate-400 font-medium">Configurations appliquées aux nouveaux examens créés.</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="p-5 bg-white rounded-2xl border-2 border-slate-100 shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                               <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-indigo-500" />
                                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Durée (minutes)</label>
                               </div>
                               <input 
                                 type="number" 
                                 value={settings.defaultExamDuration || 60}
                                 onChange={(e) => setSettings({ ...settings, defaultExamDuration: parseInt(e.target.value) || 60 })}
                                 className="w-20 px-3 py-1.5 text-xs rounded-lg border-2 border-slate-100 focus:border-indigo-500 outline-none font-bold text-center"
                               />
                            </div>
                         </div>

                         <div className="p-5 bg-white rounded-2xl border-2 border-slate-100 shadow-sm h-full flex flex-col justify-center gap-4">
                            <div className="flex items-center justify-between">
                               <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mélanger les questions</label>
                               <label className="relative inline-flex items-center cursor-pointer">
                                 <input 
                                   type="checkbox" 
                                   checked={settings.defaultShuffleQuestions || false} 
                                   onChange={(e) => setSettings({ ...settings, defaultShuffleQuestions: e.target.checked })}
                                   className="sr-only peer" 
                                 />
                                 <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                               </label>
                            </div>
                            <div className="flex items-center justify-between">
                               <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mélanger les options</label>
                               <label className="relative inline-flex items-center cursor-pointer">
                                 <input 
                                   type="checkbox" 
                                   checked={settings.defaultShuffleOptions || false} 
                                   onChange={(e) => setSettings({ ...settings, defaultShuffleOptions: e.target.checked })}
                                   className="sr-only peer" 
                                 />
                                 <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                               </label>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            )}

            {/* Extra Tab Content */}
            {activeTab === 'extra' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="w-6 h-6 text-indigo-500" />
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Fonctionnalités Supplémentaires</h3>
                  </div>
                </div>

                <div className="p-8 space-y-8">
                   <div className="p-8 bg-white border-2 border-slate-100 rounded-3xl shadow-sm space-y-6">
                      <div className="flex items-center justify-between">
                         <div className="space-y-1">
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                               <div className="w-1 h-3 bg-rose-400 rounded-full" />
                               Filigrane (Document Word)
                            </h4>
                            <p className="text-xs text-slate-400">Affiche un texte en arrière-plan sur toutes les pages de l'export.</p>
                         </div>
                         <label className="relative inline-flex items-center cursor-pointer">
                           <input
                             type="checkbox"
                             checked={settings.showWatermark || false}
                             onChange={(e) => setSettings({ ...settings, showWatermark: e.target.checked })}
                             className="sr-only peer"
                           />
                           <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                         </label>
                      </div>

                      {settings.showWatermark && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-50 animate-in slide-in-from-top-4 duration-300">
                           <div className="space-y-4">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Texte du Filigrane</label>
                              <input
                                type="text"
                                value={settings.watermarkText || ''}
                                onChange={(e) => setSettings({ ...settings, watermarkText: e.target.value })}
                                placeholder="EX: CONFIDENTIEL"
                                className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-2xl text-sm font-bold transition-all outline-none"
                              />
                           </div>
                           <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Couleur</label>
                                    <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-2xl border border-slate-200">
                                      <input
                                        type="color"
                                        value={settings.watermarkColor || '#E0E0E0'}
                                        onChange={(e) => setSettings({ ...settings, watermarkColor: e.target.value })}
                                        className="h-8 w-8 rounded-lg cursor-pointer border-none bg-transparent"
                                      />
                                      <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">{settings.watermarkColor || '#E0E0E0'}</span>
                                    </div>
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Opacité ({settings.watermarkOpacity || 3}%)</label>
                                    <input
                                      type="range"
                                      min="1"
                                      max="20"
                                      value={(settings.watermarkOpacity || 3)}
                                      onChange={(e) => setSettings({ ...settings, watermarkOpacity: parseInt(e.target.value) })}
                                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 mt-4"
                                    />
                                 </div>
                              </div>
                           </div>
                        </div>
                      )}
                   </div>
                </div>
              </div>
            )}

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

      {/* Floating Save Indicator */}
      <AnimatePresence>
        {hasUnsavedChanges && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4"
          >
            <div className="bg-slate-900 text-white p-4 rounded-3xl shadow-2xl flex items-center justify-between border border-white/10 backdrop-blur-xl bg-slate-900/90">
              <div className="flex items-center gap-3 ml-2">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <RefreshCw className="w-4 h-4 text-amber-500 animate-spin-slow" />
                </div>
                <div>
                   <p className="text-xs font-black uppercase tracking-widest text-slate-400">Modifications non enregistrées</p>
                   <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Vos changements ne sont pas encore appliqués.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSettings(JSON.parse(JSON.stringify(initialSettings)))}
                  className="text-slate-400 hover:text-white hover:bg-white/10 h-10 px-4 font-black uppercase text-[10px]"
                >
                  Annuler
                </Button>
                <Button 
                  onClick={() => handleSubmit(new Event('submit') as any)} 
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white h-10 px-6 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-500/20"
                >
                   {saving ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
