import React, { useState, useRef, useEffect } from 'react';
import { 
  Database, 
  Download, 
  Upload, 
  ShieldCheck, 
  FileSpreadsheet, 
  Sparkles, 
  HardDrive, 
  Activity, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle,
  Trash2,
  Clock,
  Calendar,
  Settings,
  Play,
  History,
  Check,
  Loader2,
  XCircle,
  Search,
  Filter,
  Terminal,
  Eye,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface DiagnosticData {
  integrity: string;
  size: number;
  counts: {
    users: number;
    groups: number;
    modules: number;
    exams: number;
    questions: number;
    results: number;
    logs: number;
  };
}

export const DatabaseManagement = () => {
  const [isRestoring, setIsRestoring] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [exportFormat, setExportFormat] = useState<'db' | 'zip'>('zip');
  const [diagnostic, setDiagnostic] = useState<DiagnosticData | null>(null);
  const [loadingDiagnostic, setLoadingDiagnostic] = useState(false);
  
  // Custom states for Scheduled Automatic Backups
  const [settings, setSettings] = useState<any>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [autoBackups, setAutoBackups] = useState<any[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [triggeringBackup, setTriggeringBackup] = useState(false);

  const [activeTab, setActiveTab] = useState<'status' | 'manual' | 'auto' | 'logs'>('status');

  // Advanced Audit Logs Preview (Temps Réel) States
  const [logsList, setLogsList] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsSearch, setLogsSearch] = useState('');
  const [logsFilterAction, setLogsFilterAction] = useState('all');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);

  // Online Users state
  const [onlineUsersList, setOnlineUsersList] = useState<any[]>([]);
  const [loadingOnlineUsers, setLoadingOnlineUsers] = useState(false);

  const fetchOnlineUsers = async (silent = false) => {
    if (!silent) setLoadingOnlineUsers(true);
    try {
      const data = await api.admin.getOnlineUsers();
      setOnlineUsersList(data || []);
    } catch (error: any) {
      console.debug("Quietly handled online status poll error:", error?.message || error);
    } finally {
      if (!silent) setLoadingOnlineUsers(false);
    }
  };

  const fetchAuditLogs = async (silent = false) => {
    if (!silent) setLoadingLogs(true);
    try {
      const data = await api.admin.getLogs();
      setLogsList(data || []);
      // Keep online users list in sync
      fetchOnlineUsers(true);
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      if (!silent) setLoadingLogs(false);
    }
  };

  // Advanced Visual Loading States State
  const [progress, setProgress] = useState<{
    isActive: boolean;
    type: 'optimize' | 'restore' | 'backup_manual' | 'backup_auto' | null;
    title: string;
    description: string;
    steps: string[];
    currentStepIndex: number;
    percentage: number;
    status: 'running' | 'success' | 'error';
    errorMessage?: string;
  }>({
    isActive: false,
    type: null,
    title: '',
    description: '',
    steps: [],
    currentStepIndex: 0,
    percentage: 0,
    status: 'running'
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const startProgress = (
    type: 'optimize' | 'restore' | 'backup_manual' | 'backup_auto', 
    title: string, 
    description: string, 
    steps: string[]
  ) => {
    setProgress({
      isActive: true,
      type,
      title,
      description,
      steps,
      currentStepIndex: 0,
      percentage: 5,
      status: 'running',
      errorMessage: undefined
    });

    const totalDuration = type === 'restore' ? 4000 : 2500;
    const numSteps = steps.length;
    
    // We increment percentage and current step inside this timer
    const interval = setInterval(() => {
      setProgress(prev => {
        if (!prev.isActive || prev.status !== 'running') {
          clearInterval(interval);
          return prev;
        }
        
        const nextPct = Math.min(prev.percentage + (90 / (totalDuration / 100)), 95);
        const nextStep = Math.min(Math.floor((nextPct / 100) * numSteps), numSteps - 1);
        
        return {
          ...prev,
          currentStepIndex: nextStep,
          percentage: parseFloat(nextPct.toFixed(1))
        };
      });
    }, 100);

    return {
      finish: () => {
        clearInterval(interval);
        setProgress(prev => ({
          ...prev,
          currentStepIndex: steps.length - 1,
          percentage: 100,
          status: 'success'
        }));
      },
      fail: (err: string) => {
        clearInterval(interval);
        setProgress(prev => ({
          ...prev,
          status: 'error',
          errorMessage: err
        }));
      }
    };
  };

  const getActionCategory = (action: string) => {
    if (!action) return 'other';
    const a = action.toUpperCase();
    if (a.includes('USER') || a.includes('LOGIN') || a.includes('LOGOUT') || a.includes('ROLE')) return 'security_user';
    if (a.includes('EVAL') || a.includes('RESULT') || a.includes('EXAM') || a.includes('QUESTION') || a.includes('STUDENT') || a.includes('GROUP')) return 'assessment_data';
    if (a.includes('BACKUP') || a.includes('RESTORE') || a.includes('VACUUM') || a.includes('OPTIMIZE') || a.includes('DB')) return 'maintenance';
    if (a.includes('SETTING') || a.includes('CONFIG')) return 'settings';
    return 'other';
  };

  // Fetch SQLite diagnostics
  const fetchDiagnostics = async () => {
    setLoadingDiagnostic(true);
    try {
      const data = await api.admin.getDiagnostic();
      setDiagnostic(data);
    } catch (error) {
      console.error("Failed to load db diagnostics:", error);
    } finally {
      setLoadingDiagnostic(false);
    }
  };

  // Fetch Settings and Auto-Backups
  const fetchSettingsAndBackups = async () => {
    setLoadingSettings(true);
    setLoadingBackups(true);
    try {
      const s = await api.settings.get();
      setSettings(s);

      const backups = await api.admin.getAutoBackups();
      setAutoBackups(backups);
    } catch (error) {
      console.error("Failed to fetch auto backups settings:", error);
    } finally {
      setLoadingSettings(false);
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
    fetchSettingsAndBackups();
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchAuditLogs();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'logs' || !realtimeEnabled) return;
    
    const interval = setInterval(() => {
      fetchAuditLogs(true);
    }, 8000);
    
    return () => clearInterval(interval);
  }, [activeTab, realtimeEnabled]);

  const handleSaveSettings = async (updatedFields: any) => {
    setSavingSettings(true);
    try {
      const payload = {
        ...(settings || {}),
        ...updatedFields
      };
      const updated = await api.settings.update(payload);
      setSettings(updated);
    } catch (error) {
      console.error("Failed to update settings:", error);
      alert("Échec de la sauvegarde des paramètres.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTriggerBackup = async () => {
    if (triggeringBackup) return;
    setTriggeringBackup(true);

    const steps = [
      "Sécurisation de la session administrateur...",
      "Vérification des quotas de stockage disque...",
      "Lancement de la réplication à chaud SQLite...",
      "Compression binaire en direct...",
      "Application de la politique de rétention...",
      "Synchronisation finale du planificateur..."
    ];

    const ctrl = startProgress(
      'backup_auto',
      'Cycle de Sauvegarde en Cours',
      "Le planificateur de maintenance procède à l'archivage automatique immédiat de votre école.",
      steps
    );

    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      await api.admin.triggerAutoBackup();
      
      const backups = await api.admin.getAutoBackups();
      setAutoBackups(backups);
      const s = await api.settings.get();
      setSettings(s);
      await fetchDiagnostics();
      
      await new Promise(resolve => setTimeout(resolve, 800));
      ctrl.finish();
    } catch (error: any) {
      console.error("Failed to trigger auto backup:", error);
      ctrl.fail(error?.message || "Impossible de générer le cycle automatique.");
    } finally {
      setTriggeringBackup(false);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement la sauvegarde "${filename}" ?`)) {
      return;
    }
    try {
      await api.admin.deleteAutoBackup(filename);
      // Refresh list
      const backups = await api.admin.getAutoBackups();
      setAutoBackups(backups);
    } catch (error) {
      console.error("Failed to delete auto backup:", error);
      alert("Échec de la suppression.");
    }
  };

  const handleDownloadBackup = (filename: string) => {
    window.location.href = `/api/admin/auto-backups/${filename}`;
  };

  const handleRestoreFromBackup = async (filename: string) => {
    setIsRestoring(true);
    
    const steps = [
      `Localisation de l'archive "${filename}"...`,
      "Vérification de la somme de contrôle...",
      "Sauvegarde de secours des paramètres actuels...",
      "Remplacement à plat des tables d'évaluation...",
      "Validation de l'index d'intégrité SQLite...",
      "Redémarrage logiciel de l'application..."
    ];

    const ctrl = startProgress(
      'restore',
      'Restauration de l\'Établissement',
      `Le snapshot "${filename}" est en cours de déploiement. Vos données actives de l'école vont être écrasées.`,
      steps
    );

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await api.admin.restoreAutoBackup(filename);
      await new Promise(resolve => setTimeout(resolve, 1500));
      ctrl.finish();
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error("Auto restore failed:", error);
      ctrl.fail(error?.message || "Échec de restauration depuis ce fichier.");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleBackup = async () => {
    const steps = [
      "Préparation de l'extraction système...",
      exportFormat === 'zip' 
        ? "Compilation du tableau de bord et écriture des CSV..."
        : "Initialisation du flux de transfert...",
      "Validation de la compression du conteneur...",
      "Lancement du téléchargement navigateur..."
    ];

    const ctrl = startProgress(
      'backup_manual',
      'Génération de l\'Exportation',
      exportFormat === 'zip'
        ? "Création d'une archive ZIP complète contenant les CSV éditables et le dashboard offline."
        : "Extraction d'un fichier miroir unifié .db de la plateforme.",
      steps
    );

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (exportFormat === 'zip') {
        window.location.href = api.admin.backupZip();
      } else {
        window.location.href = api.admin.backup();
      }
      await new Promise(resolve => setTimeout(resolve, 800));
      ctrl.finish();
    } catch (error: any) {
      console.error("Manual backup failed:", error);
      ctrl.fail("Échec lors du téléchargement.");
    }
  };

  const handleOptimize = async () => {
    if (isOptimizing) return;
    setIsOptimizing(true);

    const steps = [
      "Suspension temporaire et libération des verrous de requêtes...",
      "Analyse de la fragmentation physique du fichier sqlite...",
      "Exécution de la directive système VACUUM...",
      "Reconstruction complète des index de recherche QCM...",
      "Mise à jour instantanée du diagnostic de santé..."
    ];

    const ctrl = startProgress(
      'optimize',
      'Optimisation Structurelle SQLite',
      "Le système procède à un compactage complet pour libérer de l'espace disque et accélérer la recherche.",
      steps
    );

    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      const result = await api.admin.runVacuum();
      await fetchDiagnostics();
      await new Promise(resolve => setTimeout(resolve, 800));
      ctrl.finish();
    } catch (error: any) {
      console.error("Optimize failed:", error);
      ctrl.fail("Échec lors de la défragmentation des tables.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    
    const steps = [
      "Analyse de l'archive ou fichier fourni...",
      "Détection des signatures de tables de notes...",
      "Mise en sécurité préliminaire...",
      "Écrasement à chaud de la base active...",
      "Vérification d'intégrité post-écriture...",
      "Planification du rechargement général..."
    ];

    const ctrl = startProgress(
      'restore',
      'Restauration Complète Importée',
      "Le fichier de données importé est en cours de traitement pour remplacer l'intégrité de la plateforme.",
      steps
    );

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await api.admin.restore(file);
      await new Promise(resolve => setTimeout(resolve, 1500));
      ctrl.finish();
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error("Restore failed:", error);
      ctrl.fail(error?.message || "Le fichier importé n'est pas une base sqlite valide ou son archive est corrompue.");
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Octets';
    const k = 1024;
    const sizes = ['Octets', 'Ko', 'Mo', 'Go'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredLogs = logsList.filter(log => {
    const searchLower = logsSearch.toLowerCase();
    const actionMatch = log.action ? log.action.toLowerCase().includes(searchLower) : false;
    const detailsMatch = log.details ? log.details.toLowerCase().includes(searchLower) : false;
    const userMatch = log.userName ? log.userName.toLowerCase().includes(searchLower) : false;
    const emailMatch = log.userEmail ? log.userEmail.toLowerCase().includes(searchLower) : false;
    const matchesSearch = actionMatch || detailsMatch || userMatch || emailMatch || !logsSearch;

    if (logsFilterAction === 'all') return matchesSearch;
    const category = getActionCategory(log.action);
    return matchesSearch && category === logsFilterAction;
  });

  return (
    <section className="space-y-8 max-w-5xl mx-auto" id="database-management-section">
      {/* Title block */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100" id="db-title-block">
        <div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Maintenance & Base de Données</h3>
          <p className="text-xs text-slate-400 mt-1">Supervisez l'intégrité, compactez et exportez les données de l'établissement offline.</p>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center border border-indigo-100 shadow-sm">
          <Database className="w-5 h-5 text-indigo-600 animate-pulse" />
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-px" id="db-tabs-nav">
        <button
          id="tab-btn-status"
          onClick={() => setActiveTab('status')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'status'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          Santé & Diagnostics
        </button>
        <button
          id="tab-btn-manual"
          onClick={() => setActiveTab('manual')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'manual'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'
          }`}
        >
          <Download className="w-4 h-4" />
          Sauvegardes Manuelles
        </button>
        <button
          id="tab-btn-auto"
          onClick={() => setActiveTab('auto')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'auto'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          Cycles Automatiques
          {autoBackups.length > 0 && (
            <span className="ml-1 bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-normal">
              {autoBackups.length}
            </span>
          )}
        </button>
        <button
          id="tab-btn-logs"
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'logs'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'
          }`}
        >
          <Terminal className="w-4 h-4" />
          Journaux d'Audit
          {realtimeEnabled && (
            <span className="relative flex h-2 w-2 ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      <div className="space-y-6" id="db-tab-content">
        {activeTab === 'status' && (
          <div className="space-y-6" id="status-tab">
            {/* Diagnostics Card */}
            <Card className="p-6 border-2 border-slate-50 bg-white shadow-sm space-y-6" id="diagnostics-card">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-tight flex items-center gap-2">
                  <div className="w-1.5 h-3.5 bg-emerald-500 rounded-full" />
                  Index Diagnostic SQLite & Santé
                </h4>
                <button 
                  onClick={fetchDiagnostics} 
                  disabled={loadingDiagnostic}
                  className="p-1.5 rounded-lg border border-slate-100 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  title="Rafraîchir les diagnostics"
                  id="btn-refresh-diagnostics"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingDiagnostic ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loadingDiagnostic && !diagnostic ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin text-slate-300" />
                  <p className="text-xs font-semibold uppercase tracking-wider">Analyse de la base de données...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Health Indicators */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* Disk Size */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100/50 flex items-center justify-center text-indigo-500">
                        <HardDrive className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Taille sur disque</p>
                        <p className="text-sm font-black text-slate-800 mt-0.5">
                          {diagnostic ? formatSize(diagnostic.size) : 'Calcul en cours...'}
                        </p>
                      </div>
                    </div>

                    {/* Integrity check */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold border ${
                        diagnostic?.integrity === 'ok' 
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-500' 
                          : 'bg-amber-50 border-amber-100 text-amber-500'
                      }`}>
                        {diagnostic?.integrity === 'ok' ? (
                          <ShieldCheck className="w-5 h-5" />
                        ) : (
                          <AlertTriangle className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Intégrité SQLite</p>
                        <p className={`text-sm font-black mt-0.5 uppercase ${
                          diagnostic?.integrity === 'ok' ? 'text-emerald-600' : 'text-amber-600'
                        }`}>
                          {diagnostic ? (diagnostic.integrity === 'ok' ? 'Conforme / OK' : diagnostic.integrity) : 'Vérification...'}
                        </p>
                      </div>
                    </div>

                  </div>

                  {/* Table row counters */}
                  <div className="border border-slate-50 rounded-2xl overflow-hidden bg-white/50">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 font-bold">
                          <th className="px-4 py-3 uppercase tracking-wider text-[10px]">Table Système</th>
                          <th className="px-4 py-3 uppercase tracking-wider text-[10px] text-right">Nombre de lignes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-medium text-slate-600">
                        <tr>
                          <td className="px-4 py-3 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            Utilisateurs (Administrateurs, Enseignants, Étudiants)
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-800">
                            {diagnostic?.counts.users ?? '-'}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                            Groupes scolaires / Classes
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-800">
                            {diagnostic?.counts.groups ?? '-'}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Modules de formation
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-800">
                            {diagnostic?.counts.modules ?? '-'}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                            Examens QCM programmés
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-800">
                            {diagnostic?.counts.exams ?? '-'}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                            Questions individuelles
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-800">
                            {diagnostic?.counts.questions ?? '-'}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Résultats & Soumissions d'Examens
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-800">
                            {diagnostic?.counts.results ?? '-'}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                            Journaux d'Audit & Sécurité
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-800">
                            {diagnostic?.counts.logs ?? '-'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Optimisation button and footer check */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-emerald-50/20 border border-emerald-100/40 rounded-2xl">
                    <div className="space-y-1 text-center sm:text-left">
                      <h5 className="text-xs font-black text-emerald-800 flex items-center justify-center sm:justify-start gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                        Maintenance recommandée
                      </h5>
                      <p className="text-[10px] text-emerald-700/80 font-medium">Reconstruisez les index et libérez de l'espace disque résiduel inutile (SQLite VACUUM).</p>
                    </div>
                    <Button 
                      onClick={handleOptimize}
                      disabled={isOptimizing}
                      variant="outline"
                      className="py-2.5 px-4 text-[10px] font-black uppercase tracking-wider border-emerald-200 text-emerald-700 bg-emerald-50/30 hover:bg-emerald-50 transition-all shadow-sm w-full sm:w-auto"
                      id="btn-optimize-db"
                    >
                      {isOptimizing ? (
                        <span className="flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Optimisation...
                        </span>
                      ) : (
                        'Optimiser la Base'
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {activeTab === 'manual' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8" id="manual-tab">
            {/* Export Settings Card */}
            <Card className="p-6 border-2 border-slate-50 shadow-sm bg-white flex flex-col justify-between space-y-6" id="export-card">
              <div className="space-y-6">
                <div className="space-y-1">
                  <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-tight flex items-center gap-2">
                    <div className="w-1.5 h-3.5 bg-indigo-505 bg-indigo-600 rounded-full" />
                    Exportation
                  </h4>
                  <p className="text-xs text-slate-400">Exportez librement les données complètes de l'établissement.</p>
                </div>

                {/* Selection format */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Choisir le format d'export :</label>
                  
                  <div className="grid grid-cols-1 gap-2">
                    {/* Mode ZIP */}
                    <div 
                      onClick={() => setExportFormat('zip')}
                      className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                        exportFormat === 'zip' 
                          ? 'border-indigo-500 bg-indigo-50/20' 
                          : 'border-slate-100 hover:border-slate-200 bg-white'
                      }`}
                      id="export-format-zip"
                    >
                      <div className="flex items-start gap-3">
                        <input 
                          type="radio" 
                          name="format" 
                          checked={exportFormat === 'zip'}
                          onChange={() => setExportFormat('zip')}
                          className="mt-1 accent-indigo-600"
                        />
                        <div className="space-y-0.5">
                          <p className="text-xs font-black text-slate-800 flex items-center gap-1">
                            Archive Intégrale ZIP
                            <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase px-1.5 py-0.5 rounded tracking-widest">Premium</span>
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Contient la base de données brute, des exports CSV individuels pour toutes vos tables (Excel), et un dashboard web HTML interactif consultable hors-ligne.</p>
                        </div>
                      </div>
                    </div>

                    {/* Mode standard SQLite .db */}
                    <div 
                      onClick={() => setExportFormat('db')}
                      className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                        exportFormat === 'db' 
                          ? 'border-indigo-500 bg-indigo-50/20' 
                          : 'border-slate-100 hover:border-slate-200 bg-white'
                      }`}
                      id="export-format-db"
                    >
                      <div className="flex items-start gap-3">
                        <input 
                          type="radio" 
                          name="format" 
                          checked={exportFormat === 'db'}
                          onChange={() => setExportFormat('db')}
                          className="mt-1 accent-indigo-600"
                        />
                        <div className="space-y-0.5">
                          <p className="text-xs font-black text-slate-800">Fichier binaire SQLite (.db)</p>
                          <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Fichier binaire standard contenant la base sqlite brute, indispensable pour vos opérations de sauvegarde à plat.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleBackup}
                className="w-full py-3.5 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm shadow-indigo-100 bg-indigo-600 hover:bg-indigo-700"
                id="btn-execute-export"
              >
                <Download className="w-4 h-4" /> 
                {exportFormat === 'zip' ? "Exporter l'Archive complète" : "Exporter le fichier .db"}
              </Button>
            </Card>

            {/* Import / Restore Card */}
            <Card className="p-6 border-2 border-slate-50 shadow-sm bg-white space-y-6 flex flex-col justify-between" id="import-card">
              <div className="space-y-6">
                <div className="space-y-1">
                  <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-tight flex items-center gap-2">
                    <div className="w-1.5 h-3.5 bg-rose-500 rounded-full" />
                    Restauration simple
                  </h4>
                  <p className="text-xs text-slate-400">Importez une sauvegarde pour écraser entièrement l'état de l'application.</p>
                </div>

                <div className="p-4 bg-rose-50/35 border border-rose-100/50 rounded-2xl">
                  <p className="text-[10px] text-rose-700 leading-relaxed font-bold flex items-start gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    Attention : Cette action est irréversible. Toutes les données d'élèves, de notes, d'examens et historiques enregistrées sur l'ordinateur serveur seront définitivement détruites au profit de la base importée.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isRestoring}
                  variant="outline"
                  className="w-full py-3.5 text-[10px] font-black uppercase tracking-widest border-2 border-slate-200 hover:bg-slate-50 hover:text-slate-900 flex items-center justify-center gap-2 shadow-sm"
                  id="btn-upload-restore"
                >
                  {isRestoring ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                  ) : (
                    <>
                      <Upload className="w-4 h-4" /> Restaurer / Restaurer ZIP
                    </>
                  )}
                </Button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleRestore} 
                  className="hidden" 
                  accept=".db,.zip"
                  id="file-import-input"
                />
                <p className="text-[9px] text-slate-400 text-center font-bold uppercase tracking-wider">Accepte les fichiers .db ou archives complètes .zip</p>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'auto' && (
          <div className="space-y-6" id="auto-tab">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-600 animate-pulse" />
                  Sauvegardes Automatiques Programmées (Cycles & Rétention)
                </h3>
                <p className="text-xs text-slate-400 mt-1">Configurez une politique robuste de sauvegardes périodiques locales avec écrasement dynamique et automatisation intelligente.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Controls Settings Card */}
              <Card className="lg:col-span-1 p-6 border-2 border-slate-50 bg-white shadow-sm space-y-6" id="auto-backup-settings-card">
                <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-tight flex items-center gap-2">
                  <Settings className="w-4 h-4 text-slate-500" />
                  Configuration
                </h4>

                {loadingSettings || !settings ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin text-slate-300" />
                    <p className="text-[10px] font-bold uppercase tracking-wider">Chargement des paramètres du planificateur...</p>
                  </div>
                ) : (
                  <div className="space-y-4 text-xs font-semibold text-slate-600">
                    {/* Enabled checkbox */}
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="space-y-0.5">
                        <p className="text-xs font-black text-slate-800">Activer les sauvegardes</p>
                        <p className="text-[10px] text-slate-400">Automatisation via l'horloge système</p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={settings.autoBackupEnabled}
                        onChange={(e) => handleSaveSettings({ autoBackupEnabled: e.target.checked })}
                        disabled={savingSettings}
                        className="w-4 h-4 accent-indigo-600 cursor-pointer"
                        id="checkbox-enable-autobackup"
                      />
                    </div>

                    {/* Interval / Frequency Select */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Fréquence de cycle :
                      </label>
                      <select
                        value={settings.autoBackupInterval}
                        onChange={(e) => handleSaveSettings({ autoBackupInterval: e.target.value })}
                        disabled={savingSettings || !settings.autoBackupEnabled}
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white shadow-sm focus:border-indigo-500 text-slate-800 font-bold"
                        id="select-autobackup-interval"
                      >
                        <option value="daily">Quotidien (Toutes les 24 heures)</option>
                        <option value="weekly">Hebdomadaire (Tous les 7 jours)</option>
                        <option value="monthly">Mensuel (Tous les mois)</option>
                      </select>
                    </div>

                    {/* Target hour input */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Heures de déclenchement :
                      </label>
                      <input 
                        type="time"
                        value={settings.autoBackupTime}
                        onChange={(e) => handleSaveSettings({ autoBackupTime: e.target.value })}
                        disabled={savingSettings || !settings.autoBackupEnabled}
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white shadow-sm focus:border-indigo-500 text-slate-800 font-bold"
                        id="input-autobackup-time"
                      />
                      <p className="text-[9px] text-slate-400 font-medium">Heure locale conseillée pendant l'inactivité (ex: 02:00).</p>
                    </div>

                    {/* Max files count rotation keep */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <HardDrive className="w-3 h-3" /> Rétention (Fichiers max à garder) :
                      </label>
                      <input 
                        type="number"
                        min="1"
                        max="50"
                        value={settings.autoBackupCount}
                        onChange={(e) => handleSaveSettings({ autoBackupCount: Number(e.target.value) })}
                        disabled={savingSettings || !settings.autoBackupEnabled}
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white shadow-sm focus:border-indigo-500 text-slate-800 font-bold"
                        id="input-autobackup-count"
                      />
                      <p className="text-[9px] text-slate-400 font-medium">Les fichiers les plus anciens seront supprimés de manière transparente pour respecter ce quota.</p>
                    </div>

                    {/* Last Run Info block */}
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Dernière exécution :</p>
                      <p className="text-xs font-black text-slate-700 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        {settings.autoBackupLastRun 
                          ? new Date(settings.autoBackupLastRun).toLocaleString('fr-FR')
                          : 'Jamais exécuté'
                        }
                      </p>
                    </div>

                    {/* Trigger Manual Immediate backup button */}
                    <Button
                      onClick={handleTriggerBackup}
                      disabled={triggeringBackup}
                      variant="outline"
                      className="w-full mt-4 py-3 border-2 border-indigo-100 text-indigo-700 bg-indigo-50/10 hover:bg-indigo-50 text-[10px] uppercase font-black tracking-wider flex items-center justify-center gap-1.5 shadow-sm"
                      id="btn-trigger-manual-autobackup"
                    >
                      {triggeringBackup ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      Sauvegarder immédiatement
                    </Button>
                  </div>
                )}
              </Card>

              {/* Backups Files List Table/Card */}
              <Card className="lg:col-span-2 p-6 border-2 border-slate-50 bg-white shadow-sm space-y-6 flex flex-col justify-between" id="auto-backups-list-card">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-tight flex items-center gap-2">
                      <div className="w-1.5 h-3.5 bg-indigo-600 rounded-full" />
                      Fichiers archivés sur le disque
                    </h4>
                    <p className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">{autoBackups.length} fichier(s)</p>
                  </div>

                  {loadingBackups ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                      <RefreshCw className="w-8 h-8 animate-spin text-slate-300" />
                      <p className="text-xs font-semibold uppercase tracking-wider">Récupération de la liste des sauvegardes...</p>
                    </div>
                  ) : autoBackups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                      <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 shadow-inner">
                        <Database className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-black text-slate-700">Aucune sauvegarde périodique détectée.</p>
                        <p className="text-[10px] text-slate-400 max-w-xs font-medium">Les sauvegardes automatiques s'afficheront ici de manière ordonnée chronologiquement une fois configurées ou déclenchées.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-slate-50 rounded-2xl overflow-hidden bg-white/50 max-h-[350px] overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 font-bold">
                            <th className="px-4 py-3 uppercase tracking-wider text-[10px]">Nom du fichier / Date</th>
                            <th className="px-4 py-3 uppercase tracking-wider text-[10px] text-right">Taille</th>
                            <th className="px-4 py-3 uppercase tracking-wider text-[10px] text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 font-medium text-slate-600">
                          {autoBackups.map((bak) => (
                            <tr key={bak.filename} className="hover:bg-slate-50/20 transition-colors">
                              <td className="px-4 py-3.5 space-y-0.5">
                                <p className="font-extrabold text-slate-800 truncate max-w-xs" title={bak.filename}>{bak.filename}</p>
                                <p className="text-[10px] text-slate-400">{new Date(bak.createdAt).toLocaleString('fr-FR')}</p>
                              </td>
                              <td className="px-4 py-3.5 text-right font-bold text-slate-800">
                                {formatSize(bak.size)}
                              </td>
                              <td className="px-4 py-3.5 flex items-center justify-center gap-1.5">
                                {/* Download */}
                                <button
                                  onClick={() => handleDownloadBackup(bak.filename)}
                                  className="p-1.5 rounded-lg border border-slate-100 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-colors"
                                  title="Télécharger cette sauvegarde"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>

                                {/* Restore */}
                                <button
                                  onClick={() => handleRestoreFromBackup(bak.filename)}
                                  disabled={isRestoring}
                                  className="p-1.5 rounded-lg border border-emerald-100 bg-emerald-50/15 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                                  title="Restaurer l'application à cet état"
                                >
                                  {isRestoring ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                </button>

                                {/* Delete */}
                                <button
                                  onClick={() => handleDeleteBackup(bak.filename)}
                                  className="p-1.5 rounded-lg border border-rose-100 bg-rose-50/15 text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                                  title="Supprimer définitivement"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Disk usage recommendation indicator */}
                <div className="mt-4 p-4 bg-indigo-50/15 border border-indigo-100/40 rounded-2xl flex items-start gap-3">
                  <Activity className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5 animate-pulse" />
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-indigo-800 uppercase tracking-widest">Fonctionnement et Sécurité Locale</p>
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed">Puisque l'application fonctionne localement hors-ligne, ces sauvegardes sont périodiquement enregistrées directement sur votre plateforme hôte. Pensez à exporter régulièrement des fichiers physiques par le choix ci-dessus pour préserver vos données en sauvegarde hors site.</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-6 pb-4" id="logs-tab">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Logs Console */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="p-6 border-2 border-slate-50 bg-white shadow-sm space-y-6" id="logs-main-card">
                  {/* Header with real-time status and refresh buttons */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-tight flex items-center gap-2">
                        <div className="w-1.5 h-3.5 bg-indigo-500 rounded-full animate-pulse" />
                        Console des Journaux d'Audit & Sécurité
                      </h4>
                      <p className="text-[11px] text-slate-400 font-semibold leading-relaxed mt-1">
                        Historisation détaillée des transactions, des modifications de notes et des accès administrateurs.
                      </p>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      {/* Realtime switch wrapper */}
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer select-none">
                        <div className="relative inline-flex items-center">
                          <input 
                            type="checkbox" 
                            checked={realtimeEnabled} 
                            onChange={(e) => setRealtimeEnabled(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                        </div>
                        <span>Temps réel {realtimeEnabled && <span className="text-emerald-500 font-semibold">(actif)</span>}</span>
                      </label>

                      <Button
                        onClick={() => fetchAuditLogs()}
                        disabled={loadingLogs}
                        variant="outline"
                        className="flex items-center gap-1.5 py-1.5 px-3 text-xs font-black uppercase tracking-wider h-8 text-slate-600 hover:text-indigo-600 border-slate-200"
                        id="btn-refresh-logs"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin text-indigo-500' : ''}`} />
                        Rafraîchir
                      </Button>
                    </div>
                  </div>

                  {/* Filtering Controls */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    {/* Search Bar */}
                    <div className="col-span-1 md:col-span-2 relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                        <Search className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        value={logsSearch}
                        onChange={(e) => setLogsSearch(e.target.value)}
                        placeholder="Chercher par action, utilisateur, détails..."
                        className="w-full pl-9 pr-4 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none shadow-sm placeholder-slate-400 text-slate-700"
                      />
                    </div>

                    {/* Filter Selector */}
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                        <Filter className="w-4 h-4" />
                      </span>
                      <select
                        value={logsFilterAction}
                        onChange={(e) => setLogsFilterAction(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none shadow-sm text-slate-700 cursor-pointer appearance-none"
                      >
                        <option value="all">Toutes les actions</option>
                        <option value="security_user">Comptes & Utilisateurs</option>
                        <option value="assessment_data">Notes & Évaluations</option>
                        <option value="maintenance">Maintenance & BD</option>
                        <option value="settings">Paramètres généraux</option>
                        <option value="other">Autres actions</option>
                      </select>
                    </div>

                    {/* Status Quick Stats indicator */}
                    <div className="flex items-center justify-between px-3 py-1.5 bg-white border border-slate-200/50 rounded-xl font-medium">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Trouvés</span>
                      <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg font-mono">
                        {filteredLogs.length} / {logsList.length}
                      </span>
                    </div>
                  </div>

                  {/* Logs Content Area */}
                  {loadingLogs && logsList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Chargement de l'audit...</p>
                    </div>
                  ) : filteredLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-2 border-2 border-dashed border-slate-100 rounded-2xl">
                      <Terminal className="w-8 h-8 text-slate-300" />
                      <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Aucune action correspondante</p>
                      <p className="text-[10px] text-slate-400 leading-normal">Essayez d'ajuster vos filtres de recherche ou de rafraîchir la console.</p>
                    </div>
                  ) : (
                    <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-indigo-100/10 text-[10px] uppercase font-black tracking-widest text-slate-400">
                              <th className="px-4 py-3 text-center w-12">#</th>
                              <th className="px-4 py-3">Horodatage</th>
                              <th className="px-4 py-3">Utilisateur</th>
                              <th className="px-4 py-3">Action</th>
                              <th className="px-4 py-3">Données logs</th>
                              <th className="px-4 py-3 text-center">Inspecter</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 text-xs font-medium">
                            {filteredLogs.map((log) => {
                              const category = getActionCategory(log.action);
                              let categoryLabel = 'Autre';
                              let categoryColor = 'bg-slate-50 border-slate-100 text-slate-500';
                              
                              if (category === 'security_user') {
                                categoryLabel = 'Sécurité';
                                categoryColor = 'bg-blue-50 border-blue-100 text-blue-600';
                              } else if (category === 'assessment_data') {
                                categoryLabel = 'Notes';
                                categoryColor = 'bg-purple-50 border-purple-100 text-purple-600';
                              } else if (category === 'maintenance') {
                                categoryLabel = 'Maintenance';
                                categoryColor = 'bg-amber-50 border-amber-100 text-amber-600';
                              } else if (category === 'settings') {
                                categoryLabel = 'Configuration';
                                categoryColor = 'bg-indigo-50 border-indigo-100 text-indigo-600';
                              }

                              return (
                                <tr 
                                  key={log.id} 
                                  className="hover:bg-indigo-50/5 transition-colors animate-fade-in"
                                >
                                  <td className="px-4 py-3 text-center font-mono text-slate-400">
                                    {log.id}
                                  </td>
                                  <td className="px-4 py-3 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                                    <div className="flex items-center gap-1.5">
                                      <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                      {new Date(log.createdAt).toLocaleString('fr-FR')}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="min-w-0">
                                      <p className="font-bold text-slate-800 tracking-tight leading-normal truncate">{log.userName || "Utilisateur Inconnu"}</p>
                                      <p className="text-[10px] text-slate-400 font-mono leading-none truncate mt-0.5">{log.userEmail || "Pas d'adresse email"}</p>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider ${categoryColor}`}>
                                      {categoryLabel}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 max-w-xs text-slate-600 leading-normal font-semibold truncate">
                                    <div className="flex flex-col">
                                      <span className="text-[11px] font-black font-mono text-indigo-950 uppercase">{log.action}</span>
                                      {log.details && (
                                        <span className="text-[10px] text-slate-400 truncate mt-0.5" title={log.details}>
                                          {log.details}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <button
                                      onClick={() => setSelectedLog(log)}
                                      className="p-1 px-2.5 rounded-lg border border-slate-100 bg-white text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-colors inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                                      title="Inspecter les données techniques"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>Voir</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </Card>
              </div>

              {/* Right Column: Online Users */}
              <div className="space-y-6">
                <Card className="p-6 border-2 border-slate-50 bg-white shadow-sm space-y-6" id="logs-online-users-card">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-tight flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-500" />
                      Utilisateurs en ligne
                      <span className="ml-auto inline-flex items-center justify-center bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full text-[10px] font-black font-mono">
                        {onlineUsersList.length}
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-400 font-semibold leading-relaxed mt-1">
                      Mise à jour périodique des sessions actives sur la plateforme.
                    </p>
                  </div>

                  {loadingOnlineUsers && onlineUsersList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Chargement des sessions...</p>
                    </div>
                  ) : onlineUsersList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2 border-2 border-dashed border-slate-50 rounded-2xl">
                      <Users className="w-6 h-6 text-slate-300" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Aucune session active</p>
                      <p className="text-[9px] text-slate-400 text-center leading-normal px-4">Tous les utilisateurs sont hors-ligne ou inactifs.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                      {onlineUsersList.map((user) => {
                        let roleLabel = 'Étudiant';
                        let roleColor = 'bg-slate-50 border-slate-200 text-slate-500';
                        if (user.role === 'admin') {
                          roleLabel = 'Admin';
                          roleColor = 'bg-rose-50 border-rose-100 text-rose-600';
                        } else if (user.role === 'teacher') {
                          roleLabel = 'Tableau';
                          roleColor = 'bg-indigo-50 border-indigo-100 text-indigo-600';
                        }

                        // Get relative seconds for lastActive
                        const secAgo = Math.max(0, Math.floor((Date.now() - user.lastActive) / 1000));
                        const timeAgoText = secAgo < 10 ? 'A l\'instant' : `Il y a ${secAgo}s`;

                        return (
                          <button
                            key={user.id}
                            onClick={() => {
                              // Filter logs automatically by user name (or clear if already selected)
                              if (logsSearch === user.displayName) {
                                setLogsSearch('');
                              } else {
                                setLogsSearch(user.displayName);
                              }
                            }}
                            className={`w-full group flex items-center justify-between p-3 border rounded-xl transition-all duration-300 cursor-pointer text-left ${
                              logsSearch === user.displayName 
                                ? 'border-indigo-500 bg-indigo-50/25 ring-2 ring-indigo-500/10'
                                : 'border-slate-100 bg-white hover:border-indigo-100 hover:bg-slate-50/50'
                            }`}
                            title={`Filtrer les journaux pour ${user.displayName}`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="relative shrink-0">
                                <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xs font-black text-indigo-600 select-none">
                                  {user.displayName.trim().slice(0, 2).toUpperCase()}
                                </div>
                                <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white animate-pulse" />
                              </div>
                              <div className="min-w-0 leading-tight">
                                <p className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                                  {user.displayName}
                                </p>
                                <p className="text-[10px] text-slate-400 font-mono truncate">
                                  {user.email}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className={`px-1.5 py-0.5 border rounded-full text-[8px] font-black uppercase tracking-wider ${roleColor}`}>
                                {roleLabel}
                              </span>
                              <span className="text-[8px] font-mono text-slate-400">
                                {timeAgoText}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Audit Log Inspection Modal */}
      <AnimatePresence>
        {selectedLog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
            id="audit-inspector-overlay"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-lg bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 overflow-hidden space-y-6 animate-fade-in"
              id="audit-inspector-card"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100 text-indigo-600">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Inspection de la transaction</h4>
                    <p className="text-[10px] text-slate-400 font-mono">UUID Trace / ID: #{selectedLog.id}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Informational properties */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-100/30">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Utilisateur</span>
                  <span className="font-extrabold text-slate-800 block truncate">{selectedLog.userName}</span>
                  <span className="font-mono text-[10px] text-slate-400 block truncate">{selectedLog.userEmail}</span>
                </div>
                <div className="space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-100/30">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Horodatage</span>
                  <span className="font-extrabold text-slate-800 block">{new Date(selectedLog.createdAt).toLocaleDateString('fr-FR')}</span>
                  <span className="font-mono text-[10px] text-slate-400 block">{new Date(selectedLog.createdAt).toLocaleTimeString('fr-FR')}</span>
                </div>
              </div>

              {/* Action and details layout */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Action Système</label>
                <div className="p-3 bg-slate-950 text-emerald-400 font-bold text-xs select-all rounded-xl font-mono">
                  {selectedLog.action}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Détails de la transaction</label>
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl overflow-x-auto text-[11px] font-mono leading-relaxed text-slate-700 max-h-[160px]">
                  {(() => {
                    try {
                      if (!selectedLog.details) return <span className="text-slate-400 italic">Aucune donnée supplémentaire</span>;
                      const parsed = JSON.parse(selectedLog.details);
                      return <pre className="whitespace-pre">{JSON.stringify(parsed, null, 2)}</pre>;
                    } catch (e) {
                      return <span className="break-all whitespace-pre-wrap">{selectedLog.details}</span>;
                    }
                  })()}
                </div>
              </div>

              {/* Footer Button overlay */}
              <div className="pt-2">
                <Button
                  onClick={() => setSelectedLog(null)}
                  className="w-full py-2.5 text-xs font-black uppercase tracking-wider bg-slate-800 hover:bg-slate-900 text-white rounded-xl"
                  id="btn-close-audit-modal"
                >
                  Fermer l'inspecteur
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visual Progress Mode Indicator (Advanced Loading States) */}
      <AnimatePresence>
        {progress.isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
            id="progress-modal-overlay"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-md bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 overflow-hidden space-y-6"
              id="progress-modal-card"
            >
              {/* Header Icon & Titles */}
              <div className="flex items-center gap-4 border-b border-slate-50 pb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm shrink-0 ${
                  progress.status === 'error' 
                    ? 'bg-rose-50 border-rose-100 text-rose-500'
                    : progress.status === 'success'
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-500 animate-bounce'
                    : 'bg-indigo-50 border-indigo-100 text-indigo-500'
                }`}>
                  {progress.status === 'error' ? (
                    <XCircle className="w-5 h-5" />
                  ) : progress.status === 'success' ? (
                    <Check className="w-5 h-5 stroke-[3]" />
                  ) : progress.type === 'optimize' ? (
                    <Sparkles className="w-5 h-5 animate-spin" style={{ animationDuration: '3s' }} />
                  ) : progress.type === 'restore' ? (
                    <Upload className="w-5 h-5 animate-bounce" />
                  ) : (
                    <Database className="w-5 h-5 animate-pulse" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-base font-black text-slate-800 tracking-tight truncate">
                    {progress.title}
                  </h4>
                  <p className="text-xs text-slate-400 font-medium leading-normal mt-0.5">
                    {progress.status === 'success' 
                      ? "L'opération s'est déroulée avec succès !" 
                      : progress.status === 'error' 
                      ? "Une erreur est survenue lors de l'exécution."
                      : progress.description}
                  </p>
                </div>
              </div>

              {/* Progress and Numbers */}
              {progress.status !== 'error' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-black">
                    <span className="text-slate-400 uppercase tracking-wider text-[10px]">Index Global</span>
                    <span className="text-indigo-600 font-mono text-sm">{Math.round(progress.percentage)}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100/30">
                    <motion.div
                      className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress.percentage}%` }}
                      transition={{ duration: 0.1 }}
                    />
                  </div>
                </div>
              )}

              {/* Step list */}
              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                {progress.steps.map((step, idx) => {
                  const isCompleted = idx < progress.currentStepIndex || progress.status === 'success';
                  const isCurrent = idx === progress.currentStepIndex && progress.status === 'running';

                  return (
                    <div 
                      key={idx} 
                      className={`flex items-start gap-3 p-2 rounded-xl transition-all border text-xs font-semibold ${
                        isCompleted 
                          ? 'bg-emerald-50/10 border-emerald-100/20 text-emerald-600'
                          : isCurrent
                          ? 'bg-indigo-50/20 border-indigo-100/50 text-indigo-700 font-black shadow-sm'
                          : 'bg-transparent border-transparent text-slate-300'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isCompleted ? (
                          <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        ) : isCurrent ? (
                          <div className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center animate-pulse">
                            <Loader2 className="w-2.5 h-2.5 animate-spin stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-200 text-slate-300 flex items-center justify-center text-[9px] font-bold">
                            {idx + 1}
                          </div>
                        )}
                      </div>
                      <span className="leading-tight shrink">{step}</span>
                    </div>
                  );
                })}
              </div>

              {/* Success / Error Messages & Action Buttons */}
              {progress.status === 'error' && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl space-y-1">
                  <p className="text-[10px] font-black text-rose-800 uppercase tracking-widest">Rapport de panne :</p>
                  <p className="text-xs text-rose-700 font-semibold leading-relaxed">{progress.errorMessage}</p>
                </div>
              )}

              <div className="flex gap-2">
                {progress.status === 'error' && (
                  <Button
                    onClick={() => setProgress(p => ({ ...p, isActive: false }))}
                    className="w-full py-2.5 text-xs font-black uppercase tracking-wider bg-rose-600 hover:bg-rose-700"
                    id="btn-progress-error-close"
                  >
                    Fermer le diagnostic
                  </Button>
                )}
                {progress.status === 'success' && (
                  <Button
                    onClick={() => {
                      setProgress(p => ({ ...p, isActive: false }));
                    }}
                    className="w-full py-2.5 text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700"
                    id="btn-progress-success-close"
                  >
                    {progress.type === 'restore' ? 'Redémarrage...' : 'Terminer'}
                  </Button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
