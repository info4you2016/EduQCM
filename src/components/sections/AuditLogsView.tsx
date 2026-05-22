import React, { useState, useEffect, useMemo } from 'react';
import { 
  History, Search, Filter, User, Calendar, Info, ShieldAlert, 
  Download, BarChart3, AlertCircle, Terminal, Eye,
  ArrowUpRight, ArrowDownRight, Clock, Activity, Zap
} from 'lucide-react';
import { api } from '../../lib/api';
import { AuditLog } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell 
} from 'recharts';

export const AuditLogsView = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [liveMode, setLiveMode] = useState(false);

  useEffect(() => {
    fetchLogs(); // Initial fetch
  }, []);

  useEffect(() => {
    let interval: any;
    if (liveMode) {
      interval = setInterval(fetchLogs, 5000); // Poll every 5s in live mode
    }
    return () => clearInterval(interval);
  }, [liveMode]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await api.admin.getLogs();
      setLogs(data);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const actions = useMemo(() => Array.from(new Set(logs.map(l => l.action))), [logs]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const logsToday = logs.filter(l => new Date(l.createdAt) >= today).length;
    const uniqueUsers = new Set(logs.map(l => l.userId)).size;
    const criticalActions = logs.filter(l => {
      const a = l.action.toUpperCase();
      return a.includes('DELETE') || a.includes('PERMISSION') || a.includes('ERROR') || a.includes('RESTORE');
    }).length;

    // Trend data for last 7 days
    const trendData = Array.from({ length: 7 }).map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const count = logs.filter(l => {
        const d = new Date(l.createdAt);
        return d >= date && d < nextDate;
      }).length;
      
      return {
        date: date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
        count
      };
    });
    
    // Action breakdown
    const breakdown = actions.map(action => ({
      name: action,
      count: logs.filter(l => l.action === action).length
    })).sort((a, b) => b.count - a.count).slice(0, 5);
    
    return {
      total: logs.length,
      today: logsToday,
      users: uniqueUsers,
      critical: criticalActions,
      trendData,
      breakdown
    };
  }, [logs, actions]);

  const getSeverity = (action: string) => {
    const a = action.toUpperCase();
    if (a.includes('DELETE') || a.includes('ERROR') || a.includes('RESTORE')) return 'high';
    if (a.includes('UPDATE') || a.includes('PERMISSION')) return 'medium';
    return 'low';
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = 
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.userEmail?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = filterAction === 'all' || log.action === filterAction;
      
      const logDate = new Date(log.createdAt);
      const matchesDate = (!dateRange.start || logDate >= new Date(dateRange.start)) &&
                         (!dateRange.end || logDate <= new Date(dateRange.end + 'T23:59:59'));
      
      return matchesSearch && matchesFilter && matchesDate;
    });
  }, [logs, searchQuery, filterAction, dateRange]);

  const getActionColor = (action: string) => {
    const a = action.toUpperCase();
    if (a.includes('DELETE')) return 'text-rose-600 bg-rose-50 border-rose-100';
    if (a.includes('ERROR')) return 'text-red-700 bg-red-50 border-red-100';
    if (a.includes('EXPORT') || a.includes('DOWNLOAD')) return 'text-amber-600 bg-amber-50 border-amber-100';
    if (a.includes('RESTORE')) return 'text-purple-600 bg-purple-50 border-purple-100';
    if (a.includes('UPDATE')) return 'text-indigo-600 bg-indigo-50 border-indigo-100';
    if (a.includes('CREATE')) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    if (a.includes('AUTH') || a.includes('LOGIN')) return 'text-blue-600 bg-blue-50 border-blue-100';
    return 'text-slate-600 bg-slate-50 border-slate-100';
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Utilisateur', 'Email', 'Action', 'Détails'];
    const rows = filteredLogs.map(log => [
      new Date(log.createdAt).toLocaleString('fr-FR'),
      log.userName || 'Système',
      log.userEmail || 'N/A',
      log.action,
      log.details.replace(/,/g, ';') // Prevent CSV breakage
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDetails = (details: string) => {
    try {
      if (details.startsWith('{')) {
        const parsed = JSON.parse(details);
        return <pre className="whitespace-pre-wrap font-mono text-[10px] bg-slate-800 p-4 rounded-xl border border-slate-700/50 text-indigo-300">{JSON.stringify(parsed, null, 2)}</pre>;
      }
      return <p className="text-[11px] text-white leading-relaxed font-mono">{details}</p>;
    } catch (e) {
      return <p className="text-[11px] text-white leading-relaxed font-mono">{details}</p>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3 uppercase tracking-tight">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            Journal d'Audit
          </h2>
          <p className="text-slate-500 font-medium ml-1">Surveillance exhaustive de l'activité plateforme.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => setLiveMode(!liveMode)} 
            variant={liveMode ? "primary" : "outline"} 
            className={cn("gap-2", liveMode && "bg-indigo-600 border-indigo-600")}
          >
            <Activity className={cn("w-4 h-4", liveMode && "animate-pulse")} />
            {liveMode ? 'Live On' : 'Activer Live'}
          </Button>
          <Button onClick={exportToCSV} variant="outline" className="gap-2 border-emerald-100 text-emerald-600 hover:bg-emerald-50">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          <Button onClick={fetchLogs} variant="outline" className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <History className="w-4 h-4" />}
            Actualiser
          </Button>
        </div>
      </div>

      {/* Stats & Charts Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Key Stats */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
           <Card className="p-6 bg-slate-900 border-none shadow-2xl relative overflow-hidden group col-span-1 sm:col-span-2">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-150 transition-transform duration-1000">
                <ShieldAlert className="w-32 h-32 text-indigo-400" />
              </div>
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                   <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-1">Volume d'Activité</p>
                   <h3 className="text-4xl font-black text-white tracking-tighter mb-4 italic">{stats.total} <span className="text-xl text-slate-500 not-italic font-medium lowercase">événements</span></h3>
                </div>
                <div className="h-[120px] w-full mt-4">
                   <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.trendData}>
                        <defs>
                          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                          dy={10}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                          labelStyle={{ color: '#94a3b8', fontWeight: 900, textTransform: 'uppercase', fontSize: '10px' }}
                        />
                        <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                      </AreaChart>
                   </ResponsiveContainer>
                </div>
              </div>
           </Card>

           <Card className="p-6 bg-white border-2 border-slate-50 hover:shadow-lg transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                   <AlertCircle className="w-5 h-5" />
                </div>
                <Zap className="w-4 h-4 text-slate-200" />
              </div>
              <div>
                <p className="text-3xl font-black text-slate-900 leading-none">{stats.critical}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Actions Critiques</p>
              </div>
           </Card>

           <Card className="p-6 bg-white border-2 border-slate-50 hover:shadow-lg transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                   <User className="w-5 h-5" />
                </div>
                <Activity className="w-4 h-4 text-slate-200" />
              </div>
              <div>
                <p className="text-3xl font-black text-slate-900 leading-none">{stats.users}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Acteurs Uniques</p>
              </div>
           </Card>
        </div>

        {/* Right Column: Breakdown */}
        <div className="lg:col-span-4 h-full">
           <Card className="p-6 bg-white border-2 border-slate-50 h-full flex flex-col">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-500" /> Répartition Actions
              </h4>
              <div className="flex-1 space-y-4">
                 {stats.breakdown.map((item, idx) => (
                    <div key={item.name} className="space-y-1.5">
                       <div className="flex items-center justify-between text-[10px] font-black uppercase">
                          <span className="text-slate-600 truncate max-w-[150px]">{item.name}</span>
                          <span className="text-indigo-600">{Math.round((item.count / (stats.total || 1)) * 100)}%</span>
                       </div>
                       <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                          <motion.div 
                             initial={{ width: 0 }}
                             animate={{ width: `${(item.count / (stats.total || 1)) * 100}%` }}
                             transition={{ delay: idx * 0.1, duration: 1 }}
                             className={cn(
                                "h-full rounded-full transition-all duration-1000",
                                idx === 0 ? "bg-indigo-500" :
                                idx === 1 ? "bg-blue-400" :
                                idx === 2 ? "bg-emerald-400" :
                                "bg-slate-300"
                             )}
                          />
                       </div>
                    </div>
                 ))}
                 {stats.breakdown.length === 0 && (
                   <div className="h-full flex flex-col items-center justify-center py-8 opacity-20">
                      <BarChart3 className="w-12 h-12 mb-2" />
                      <p className="text-[10px] font-black uppercase">Données insuffisantes</p>
                   </div>
                 )}
              </div>
           </Card>
        </div>
      </div>

      <Card className="p-6 border-slate-200 bg-slate-50/30">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher action, utilisateur, détails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none shadow-sm font-bold text-slate-700 text-sm"
            >
              <option value="all">Filtre Action (Tous)</option>
              {actions.sort().map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
             <input
               type="date"
               value={dateRange.start}
               onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
               className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
             />
             <span className="text-slate-400">→</span>
             <input
               type="date"
               value={dateRange.end}
               onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
               className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
             />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border-2 border-slate-100 shadow-xl shadow-slate-200/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800">
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Date & Heure</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Utilisateur</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Action</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Détails</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-6 h-20">
                      <div className="flex gap-4">
                        <div className="w-24 h-4 bg-slate-100 rounded" />
                        <div className="w-32 h-4 bg-slate-100 rounded" />
                        <div className="flex-1 h-4 bg-slate-50 rounded" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="group hover:bg-slate-50 transition-all duration-300">
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 text-sm font-black text-slate-700">
                          <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                          {new Date(log.createdAt).toLocaleDateString('fr-FR')}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 ml-5">
                          <Clock className="w-3 h-3" />
                          {new Date(log.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-black text-sm group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 overflow-hidden relative shadow-sm">
                           {log.userEmail ? (
                             <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${log.userEmail}`} alt="avatar" />
                           ) : (
                             log.userName?.[0] || 'S'
                           )}
                        </div>
                        <div className="flex flex-col">
                          <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{log.userName || 'Système'}</p>
                          <p className="text-[10px] font-bold text-indigo-500">{log.userEmail || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-transparent shadow-sm ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                        {getSeverity(log.action) === 'high' && (
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" title="Sévérité Haute" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5 max-w-md">
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-lg bg-slate-50 mt-0.5 shrink-0">
                          <Terminal className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-slate-600 leading-relaxed text-balance line-clamp-2 md:line-clamp-none">
                            {log.details}
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">ID: {String(log.id).slice(0, 8)}</span>
                            {log.details.includes('{') && (
                              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-500 text-[8px] font-black rounded uppercase">JSON Payload</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         className="opacity-0 group-hover:opacity-100 rounded-xl h-8 w-8 p-0"
                         onClick={() => setSelectedLog(log)}
                        >
                         <Eye className="w-4 h-4 text-indigo-500" />
                       </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-24 text-center">
                    <div className="w-20 h-20 rounded-[2.5rem] bg-slate-50 flex items-center justify-center mx-auto mb-6">
                      <History className="w-10 h-10 text-slate-200" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Aucun Log Trouvé</h3>
                    <p className="text-slate-500 text-sm font-medium">Réessayez avec des filtres moins restrictifs.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
             Affichage de {filteredLogs.length} sur {logs.length} entrées
           </p>
        </div>
      </Card>

      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-white"
            >
              <div className="p-8 bg-slate-900 text-white flex items-center justify-between">
                <div>
                   <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3 italic">
                     <Terminal className="w-6 h-6 text-indigo-400" /> Détails du Log
                   </h3>
                   <p className="text-slate-400 text-xs font-bold tracking-widest uppercase mt-1">Audit Trace Reference: {selectedLog.id}</p>
                </div>
                <Button variant="ghost" onClick={() => setSelectedLog(null)} className="text-white hover:bg-white/10 rounded-full w-10 h-10 p-0">
                  <ArrowDownRight className="w-4 h-4 rotate-45" />
                </Button>
              </div>
              
              <div className="p-8 space-y-6">
                 <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                       <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Action</label>
                          <span className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border ${getActionColor(selectedLog.action)}`}>
                            {selectedLog.action}
                          </span>
                       </div>
                       <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Utilisateur</label>
                          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                             <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-xs">
                                {selectedLog.userName?.[0] || 'S'}
                             </div>
                             <div>
                                <p className="text-sm font-black text-slate-900 uppercase leading-none">{selectedLog.userName || 'Système'}</p>
                                <p className="text-[10px] font-bold text-slate-400 mt-1">{selectedLog.userEmail || 'N/A'}</p>
                             </div>
                          </div>
                       </div>
                    </div>
                    
                    <div className="space-y-4">
                       <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Horodatage</label>
                          <div className="flex items-center gap-2 p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100 text-indigo-600">
                             <Clock className="w-4 h-4" />
                             <span className="text-sm font-black">{new Date(selectedLog.createdAt).toLocaleString('fr-FR')}</span>
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="pt-6 border-t border-slate-100">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Rapport d'Activité Complet</label>
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                       {formatDetails(selectedLog.details)}
                    </div>
                 </div>
                 
                 <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-100">
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                    <p className="text-[10px] font-bold text-amber-800 leading-tight">
                      Note: Ce log est stocké de manière immuable et ne peut pas être modifié. 
                      Pratique standard pour la conformité et la sécurité.
                    </p>
                 </div>
                 
                 <div className="flex justify-end pt-4">
                    <Button onClick={() => setSelectedLog(null)} className="rounded-2xl px-8 uppercase font-black tracking-widest shadow-xl shadow-indigo-100">
                      Fermer le rapport
                    </Button>
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
