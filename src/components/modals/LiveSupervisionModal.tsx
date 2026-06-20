import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Radio, Clock, Users, ShieldAlert, Award, Search, AlertTriangle, 
  CheckCircle2, Play, Volume2, VolumeX, ListRestart, Eye, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { socket } from '../../lib/api';
import { cn } from '../../lib/utils';
import { Exam } from '../../types';
import { Modal } from '../ui/Modal';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useAppStore } from '../../store/useAppStore';
import { useConfirm } from '../ui/ConfirmDialog';

interface LiveStudentSession {
  studentId: number;
  studentName: string;
  registrationNumber: string;
  answeredCount: number;
  totalQuestions: number;
  tabExitCount: number;
  status: 'active' | 'completed';
  lastUpdated: number;
  extraTimeMinutes?: number;
  timeLeft?: number;
  cheatAlerts?: Array<{ type: string; details: string; timestamp: number }>;
  hasPendingDecision?: boolean;
  pendingDecisionTime?: number;
}

interface CheatAlertLog {
  id: string;
  studentId: number;
  studentName: string;
  type: string;
  details: string;
  timestamp: number;
}

interface LiveSupervisionModalProps {
  exam: Exam;
  onClose: () => void;
  moduleName?: string;
}

export const LiveSupervisionModal: React.FC<LiveSupervisionModalProps> = ({ exam, onClose, moduleName }) => {
  const confirm = useConfirm();
  const {
    supervisedSessions: sessions,
    setSupervisedSessions: setSessions,
    alertsLog,
    setAlertsLog,
    clearAlertsLog,
    soundEnabled,
    setSoundEnabled
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedStudentId, setExpandedStudentId] = useState<number | null>(null);
  const alertsEndRef = useRef<HTMLDivElement>(null);

  // Play browser sound warning on cheat alerts
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, audioCtx.currentTime); // high warning pitch
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2); // short warning duration
    } catch (e) {
      console.warn("Audio warning blocked or unsupported:", e);
    }
  };

  useEffect(() => {
    // 1. Subscribe to Live Supervision of this specific Exam
    socket.emit("exam:subscribe-supervision", { examId: exam.id });

    // 2. Listen to Session Progression updates
    const handleLiveUpdate = (data: { examId: number; sessions: LiveStudentSession[] }) => {
      if (data.examId === exam.id) {
        setSessions(data.sessions || []);
      }
    };

    // 3. Listen to Cheat alert triggers to notify the teacher via real-time flash/toasts & log them
    const handleCheatAlert = (data: { studentId: number; studentName: string; type: string; details: string; timestamp: number }) => {
      playBeep();
      setAlertsLog(prev => [
        {
          id: `${data.studentId}-${data.timestamp}-${Math.random()}`,
          ...data
        },
        ...prev
      ].slice(0, 100)); // Keep last 100 alerts
    };

    socket.on("exam:live-update", handleLiveUpdate);
    socket.on("exam:cheat-alert-toast", handleCheatAlert);

    return () => {
      socket.off("exam:live-update", handleLiveUpdate);
      socket.off("exam:cheat-alert-toast", handleCheatAlert);
    };
  }, [exam.id, soundEnabled]);

  // Handle scrolling of alerts log
  useEffect(() => {
    if (alertsEndRef.current) {
      alertsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [alertsLog]);

  // Compute live statistical states
  const stats = useMemo(() => {
    const totalConnected = sessions.filter(s => s.status === 'active').length;
    const totalFinished = sessions.filter(s => s.status === 'completed').length;
    let cheatCount = 0;
    sessions.forEach(s => {
      cheatCount += s.tabExitCount || 0;
      if (s.cheatAlerts) {
        cheatCount += s.cheatAlerts.filter(a => a.type !== 'tab-exit').length;
      }
    });

    return {
      connected: totalConnected,
      finished: totalFinished,
      cheats: cheatCount,
      totalRegistered: sessions.length
    };
  }, [sessions]);

  // Filter students based on query
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(s => 
      s.studentName.toLowerCase().includes(q) || 
      s.registrationNumber.toLowerCase().includes(q)
    );
  }, [sessions, searchQuery]);

  // Find sessions where the student had a tab exit and requires authorization to proceed
  const pendingSessions = useMemo(() => {
    return sessions.filter(s => s.hasPendingDecision && s.status === 'active');
  }, [sessions]);

  // Format date/time
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const toggleStudentExpand = (id: number) => {
    setExpandedStudentId(prev => prev === id ? null : id);
  };

  return (
    <Modal title={`Supervision Live - ${exam.title}`} onClose={onClose} maxWidth="sm:max-w-[95%]">
      <div className="flex flex-col lg:flex-row gap-6 p-6 w-full min-h-[75vh] max-h-[85vh] overflow-hidden bg-slate-50/50">
        
        {/* LEFT COLUMN: Stat board & Student Live table list */}
        <div className="flex-1 flex flex-col gap-6 overflow-hidden">
          
          {/* Metrics summary banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4 border border-slate-100 bg-white flex items-center gap-4 shadow-sm rounded-2xl relative overflow-hidden">
              <div className="absolute right-0 top-0 h-1 bg-sky-500 w-full" />
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Connectés</p>
                <h3 className="text-2xl font-black text-slate-900 mt-0.5">{stats.connected}</h3>
              </div>
            </Card>

            <Card className="p-4 border border-slate-100 bg-white flex items-center gap-4 shadow-sm rounded-2xl relative overflow-hidden">
              <div className="absolute right-0 top-0 h-1 bg-emerald-500 w-full" />
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Terminés</p>
                <h3 className="text-2xl font-black text-slate-900 mt-0.5">{stats.finished}</h3>
              </div>
            </Card>

            <Card className="p-4 border border-rose-100 bg-white flex items-center gap-4 shadow-sm rounded-2xl relative overflow-hidden">
              <div className="absolute right-0 top-0 h-1 bg-rose-500 w-full animate-pulse" />
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Alertes Triche</p>
                <h3 className="text-2xl font-black text-rose-600 mt-0.5">{stats.cheats}</h3>
              </div>
            </Card>

            <Card className="p-4 border border-slate-100 bg-white flex items-center gap-4 shadow-sm rounded-2xl relative overflow-hidden">
              <div className="absolute right-0 top-0 h-1 bg-indigo-500 w-full" />
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Évalués</p>
                <h3 className="text-2xl font-black text-slate-900 mt-0.5">{stats.totalRegistered}</h3>
              </div>
            </Card>
          </div>

          {/* Table Header controls */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Rechercher par nom ou numéro d'inscription..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border-2 border-transparent focus:border-indigo-500/10 focus:bg-white rounded-xl text-xs font-bold transition-all outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="h-9 rounded-xl text-[10px] uppercase font-black tracking-wider flex items-center gap-2"
              >
                {soundEnabled ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-indigo-600" /> Son Activé
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-slate-400" /> Son Muet
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Section Incidents / Décisions en attente */}
          {pendingSessions.length > 0 && (
            <div className="bg-rose-50/50 border border-rose-100 p-4 rounded-2xl space-y-3 shadow-sm shrink-0">
              <h4 className="text-[10px] font-black uppercase text-rose-800 tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 animate-bounce" /> {pendingSessions.length} incident{pendingSessions.length > 1 ? 's' : ''} de sortie d'onglet en attente de décision
              </h4>
              <div className="divide-y divide-rose-100/50 block">
                {pendingSessions.map(ps => (
                  <div key={ps.studentId} className="py-3 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-black text-rose-900 uppercase tracking-tight block">{ps.studentName}</span>
                      <span className="text-[10px] text-rose-700/80 font-bold block">Matricule: {ps.registrationNumber} • {ps.tabExitCount} sortie(s) d'onglet</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const ok = await confirm({
                            title: "Bloquer l'étudiant",
                            message: `Voulez-vous bloquer et forcer la soumission de l'examen de ${ps.studentName} ?`,
                            confirmLabel: "Bloquer",
                            cancelLabel: "Annuler",
                            variant: "danger"
                          });
                          if (ok) {
                            socket.emit('exam:remote-action', { examId: exam.id, studentId: ps.studentId, action: 'stop' });
                          }
                        }}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-black text-[9px] uppercase tracking-wider h-8 rounded-xl flex items-center gap-1.5 px-3 whitespace-nowrap shadow-sm shadow-rose-600/10"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" /> Bloquer
                      </Button>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          socket.emit('exam:remote-action', { examId: exam.id, studentId: ps.studentId, action: 'allow' });
                        }}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[9px] uppercase tracking-wider h-8 rounded-xl flex items-center gap-1.5 px-3 whitespace-nowrap shadow-sm shadow-emerald-500/10"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Autoriser à continuer
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Student session list (with expansions) */}
          <div className="flex-1 overflow-y-auto bg-white border border-slate-100 rounded-2xl shadow-sm pr-1">
            {filteredSessions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-12 text-slate-400">
                <Radio className="w-12 h-12 text-slate-200 animate-pulse mb-3" />
                <p className="text-sm font-bold">Attente des connexions des étudiants...</p>
                <p className="text-xs text-slate-400 mt-1">Les étudiants apparaîtront ici en temps réel lorsqu'ils commenceront l'examen.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {filteredSessions.map(session => {
                  const hasCheated = (session.tabExitCount > 0) || (session.cheatAlerts && session.cheatAlerts.length > 0);
                  const isFinished = session.status === 'completed';
                  const isExpanded = expandedStudentId === session.studentId;
                  const totalAlertsCount = (session.tabExitCount || 0) + (session.cheatAlerts?.length || 0);

                  return (
                    <div 
                      key={session.studentId}
                      className={cn(
                        "transition-all duration-300",
                        hasCheated && "bg-rose-50/10 hover:bg-rose-50/20",
                        isExpanded ? "bg-slate-50/50" : ""
                      )}
                    >
                      {/* Primary Session Line */}
                      <div 
                        onClick={() => toggleStudentExpand(session.studentId)}
                        className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/40 select-none"
                      >
                        {/* Name & Badge */}
                        <div className="flex items-center gap-4 min-w-[200px]">
                          <div className={cn(
                            "w-2.5 h-2.5 rounded-full ring-4 shrink-0",
                            isFinished ? "bg-emerald-500 ring-emerald-50" : "bg-amber-500 ring-amber-50 animate-pulse"
                          )} />
                          <div>
                            <h4 className="font-black text-xs text-slate-800 uppercase tracking-tight">{session.studentName}</h4>
                            <p className="text-[10px] font-mono text-slate-400 mt-0.5">Matricule: {session.registrationNumber || 'N/A'}</p>
                          </div>
                        </div>

                        {/* Answers Progress bar */}
                        <div className="flex-1 w-full sm:max-w-xs space-y-1">
                          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                            <span>Progression :</span>
                            <strong>{session.answeredCount} / {session.totalQuestions} questions</strong>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div 
                              className={cn(
                                "h-full transition-all duration-500 rounded-full",
                                isFinished ? "bg-emerald-500" : "bg-indigo-600"
                              )}
                              style={{ width: `${(session.answeredCount / (session.totalQuestions || 1)) * 100}%` }}
                            />
                          </div>
                        </div>

                        {/* Cheating Alerts Metric indicators */}
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm",
                              session.tabExitCount > 0 
                                ? "bg-rose-50 text-rose-600 border-rose-100 animate-pulse" 
                                : "bg-emerald-50 text-emerald-600 border-emerald-100"
                            )}>
                              {session.tabExitCount > 0 ? (
                                <>
                                  <AlertTriangle className="w-3 h-3 text-rose-500 animate-bounce" /> {session.tabExitCount} Sortie{session.tabExitCount > 1 ? 's' : ''}
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Écran Sécurisé
                                </>
                              )}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-slate-400 hover:text-indigo-600">
                            <span className="text-[10px] font-bold uppercase tracking-wider">Détails</span>
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Section showing all logs for this specific student */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden border-t border-slate-100 bg-slate-50/50"
                          >
                            <div className="p-4 space-y-4">
                              <h5 className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-2">
                                <ShieldAlert className="w-3.5 h-3.5 text-rose-500" /> Historique d'Affichage / Intégrité de l'élève
                              </h5>

                              {(!session.cheatAlerts || session.cheatAlerts.length === 0) && session.tabExitCount === 0 ? (
                                <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 p-3 rounded-xl font-bold flex items-center gap-2">
                                  <CheckCircle2 className="w-4 h-4" /> Aucun indice de comportement altéré ou de fuite focus détecté pour l'instant.
                                </p>
                              ) : (
                                <div className="space-y-2 max-h-48 overflow-y-auto bg-white p-3 border border-slate-100 rounded-xl divide-y divide-slate-50 shadow-inner">
                                  {session.tabExitCount > 0 && (
                                    <div className="py-2 flex justify-between items-center text-xs">
                                      <div className="flex items-center gap-2 font-bold text-slate-700">
                                        <AlertTriangle className="w-4 h-4 text-amber-500" /> Sortie d'écran (Alt+Tab ou réduction)
                                      </div>
                                      <span className="text-[10px] font-black text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">
                                        Total : {session.tabExitCount} fois
                                      </span>
                                    </div>
                                  )}

                                  {session.cheatAlerts?.map((alert, aIdx) => (
                                    <div key={aIdx} className="py-2 flex justify-between items-start text-xs gap-4">
                                      <div className="flex items-start gap-2 text-slate-600 font-medium">
                                        <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                        <span>{alert.details}</span>
                                      </div>
                                      <span className="text-[9px] font-mono whitespace-nowrap text-slate-400 mt-0.5">
                                        {formatTime(alert.timestamp)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {session.hasPendingDecision && (
                                <div className="bg-rose-50 border-2 border-rose-200 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse mt-2">
                                  <div className="flex items-center gap-3">
                                    <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
                                    <div>
                                      <p className="text-xs font-black text-rose-800 uppercase tracking-wider">Sortie d'onglet détectée !</p>
                                      <p className="text-xs text-rose-700 font-semibold leading-relaxed">
                                        L'élève a quitté la page de l'examen. Souhaitez-vous le bloquer pour tricherie ou l'autoriser à poursuivre ?
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                                    <Button
                                      size="sm"
                                      className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] uppercase tracking-wider h-9 rounded-xl flex items-center justify-center gap-1.5 px-3 whitespace-nowrap shadow-sm shadow-rose-600/10"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        const ok = await confirm({
                                          title: "Bloquer l'étudiant",
                                          message: `Voulez-vous bloquer et forcer la soumission de l'examen de ${session.studentName} ?`,
                                          confirmLabel: "Bloquer",
                                          cancelLabel: "Annuler",
                                          variant: "danger"
                                        });
                                        if (ok) {
                                          socket.emit('exam:remote-action', { examId: exam.id, studentId: session.studentId, action: 'stop' });
                                        }
                                      }}
                                    >
                                      <ShieldAlert className="w-3.5 h-3.5" /> Bloquer l'élève
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[10px] uppercase tracking-wider h-9 rounded-xl flex items-center justify-center gap-1.5 px-3 whitespace-nowrap shadow-sm shadow-emerald-500/10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        socket.emit('exam:remote-action', { examId: exam.id, studentId: session.studentId, action: 'allow' });
                                      }}
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Autoriser à continuer
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {/* Télécommande de Contrôle à Distance (Remote Exam Controls) */}
                              <div className="pt-4 border-t border-slate-100 space-y-2">
                                <h5 className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-2">
                                  <Radio className="w-3.5 h-3.5 text-indigo-500" /> Télécommande d'Examen (Contrôle à distance)
                                </h5>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                  <div className="bg-white p-3.5 border border-slate-100 rounded-2xl flex flex-col justify-between shadow-sm">
                                    <div className="space-y-1">
                                      <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Durée & Temps</span>
                                        {session.extraTimeMinutes && session.extraTimeMinutes > 0 ? (
                                          <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                            +{session.extraTimeMinutes} Min Accordés
                                          </span>
                                        ) : null}
                                      </div>
                                      <p className="text-xs font-bold text-slate-700 mt-1">
                                        Temps restant estimé : <span className="font-mono text-indigo-600 underline">
                                          {session.timeLeft !== undefined ? `${Math.floor(session.timeLeft / 60)}m ${(session.timeLeft % 60).toString().padStart(2, '0')}s` : 'N/A'}
                                        </span>
                                      </p>
                                    </div>

                                    <Button 
                                      size="sm"
                                      disabled={isFinished}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        socket.emit('exam:remote-action', { examId: exam.id, studentId: session.studentId, action: 'add-time', amount: 10 });
                                      }}
                                      className="mt-3 w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[10px] uppercase tracking-wider h-9 rounded-xl flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-500/10"
                                    >
                                      <Clock className="w-3.5 h-3.5" /> Accorder +10 minutes
                                    </Button>
                                  </div>

                                  <div className="bg-white p-3.5 border border-slate-100 rounded-2xl flex flex-col justify-between shadow-sm">
                                    <div className="space-y-1">
                                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Interruption Forcée</span>
                                      <p className="text-xs font-semibold text-slate-500 mt-1 leading-snug">
                                        {isFinished 
                                          ? "L'élève a soumis ou terminé l'examen." 
                                          : "Suspendre l'étudiant immédiatement et soumettre automatiquement sa copie."
                                        }
                                      </p>
                                    </div>

                                    <Button 
                                      size="sm"
                                      disabled={isFinished}
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        const ok = await confirm({
                                          title: "Forcer l'arrêt",
                                          message: `Voulez-vous forcer l'arrêt immédiat et la soumission de l'examen pour ${session.studentName} ?`,
                                          confirmLabel: "Forcer l'arrêt",
                                          cancelLabel: "Annuler",
                                          variant: "danger"
                                        });
                                        if (ok) {
                                          socket.emit('exam:remote-action', { examId: exam.id, studentId: session.studentId, action: 'stop' });
                                        }
                                      }}
                                      className="mt-3 w-full bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] uppercase tracking-wider h-9 rounded-xl flex items-center justify-center gap-1.5 shadow-sm shadow-rose-600/10"
                                    >
                                      <ShieldAlert className="w-3.5 h-3.5" /> Forcer l'arrêt
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Real-time global network alert stream */}
        <div className="w-full lg:w-80 bg-slate-900 text-slate-100 p-5 rounded-[2rem] flex flex-col h-full shrink-0 shadow-lg shadow-black/15">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800">
            <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-rose-500">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" /> Alertes en Direct
            </h4>
            <span className="text-[9px] font-mono bg-slate-800 text-slate-400 px-2 py-1 rounded-full uppercase">
              Flux Sockets
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[35vh] lg:max-h-none">
            {alertsLog.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <ShieldAlert className="w-10 h-10 text-slate-800 mb-2" />
                <p className="text-xs font-bold">Aucune alerte récente</p>
                <p className="text-[10px] text-slate-600 mt-1">Les sorties d'écran et autres alertes de triche s'afficheront ici en temps réel.</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {alertsLog.map(alert => (
                  <motion.div 
                    key={alert.id}
                    initial={{ opacity: 0, x: 20, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: 'auto' }}
                    exit={{ opacity: 0, x: -20, height: 0 }}
                    className="p-3 bg-red-950/40 border border-red-900/40 rounded-xl space-y-1.5 shadow"
                  >
                    <div className="flex justify-between items-center">
                      <strong className="text-xs text-red-400 uppercase font-black tracking-tight block truncate max-w-[150px]">
                        {alert.studentName}
                      </strong>
                      <span className="text-[8px] font-mono text-slate-500">
                        {formatTime(alert.timestamp)}
                      </span>
                    </div>

                    <p className="text-[10px] text-red-200 leading-snug">{alert.details}</p>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            <div ref={alertsEndRef} />
          </div>

          {alertsLog.length > 0 && (
            <button 
              onClick={clearAlertsLog}
              className="mt-4 pt-3 border-t border-slate-800 text-center text-[10px] font-black text-rose-400 hover:text-rose-300 uppercase tracking-widest w-full hover:bg-slate-800/25 py-2 rounded-xl transition-all"
            >
              Effacer le journal
            </button>
          )}
        </div>

      </div>
    </Modal>
  );
};
