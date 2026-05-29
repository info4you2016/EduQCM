import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../../lib/api';
import { 
  Users, 
  Search, 
  UserPlus, 
  Trash2, 
  Edit2,
  Shield, 
  GraduationCap, 
  BookOpen, 
  Filter,
  X,
  Mail,
  CheckCircle,
  AlertCircle,
  Upload,
  FileText,
  Loader2
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { cn } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { Filiere, Group } from '../../types';

interface User {
  id: number;
  email: string;
  displayName: string;
  role: 'student' | 'teacher' | 'admin';
  groupNameResolved?: string;
  filiereNameResolved?: string;
  registrationNumber?: string;
  createdAt: string;
}

export const AdminUserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'teacher' | 'admin'>('all');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter]);
  
  const [filieres, setFilieres] = useState<Filiere[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    displayName: '',
    registrationNumber: '',
    role: 'student' as const,
    filiereId: '' as number | '',
    groupId: '' as number | '',
  });
  const [editFormData, setEditFormData] = useState({
    email: '',
    displayName: '',
    role: 'student' as const,
    password: '',
    registrationNumber: '',
    filiereId: '' as number | '',
    groupId: '' as number | '',
  });

  // Import state
  const [importData, setImportData] = useState<any[]>([]);
  const [importStep, setImportStep] = useState<'upload' | 'preview'>('upload');
  const [selectedFiliereId, setSelectedFiliereId] = useState<number | ''>('');
  const [selectedGroupId, setSelectedGroupId] = useState<number | ''>('');
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingUser) {
      setEditFormData({
        email: editingUser.email,
        displayName: editingUser.displayName,
        role: editingUser.role,
        password: '',
        registrationNumber: editingUser.registrationNumber || '',
        filiereId: (editingUser as any).filiereId || '',
        groupId: (editingUser as any).groupId || '',
      });
    }
  }, [editingUser]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await api.admin.listUsers();
      setUsers(data);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du chargement des utilisateurs");
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      const [fData, gData] = await Promise.all([
        api.filieres.list(),
        api.groups.list()
      ]);
      setFilieres(fData);
      setGroups(gData);
    } catch (err) {
      console.error("Failed to fetch dependencies:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!validateEmail(newUser.email)) {
      toast.error("Format d'email invalide");
      return;
    }
    if (newUser.displayName.length < 3) {
      toast.error("Le nom doit avoir au moins 3 caractères");
      return;
    }
    if (newUser.password.length < 6) {
      toast.error("Le mot de passe doit avoir au moins 6 caractères");
      return;
    }

    try {
      await api.admin.createUser(newUser);
      toast.success("Utilisateur créé avec succès");
      setIsAddingUser(false);
      setNewUser({ 
        email: '', 
        password: '', 
        displayName: '', 
        role: 'student', 
        registrationNumber: '',
        filiereId: '',
        groupId: ''
      });
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création");
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ?")) return;
    try {
      await api.admin.deleteUser(id);
      toast.success("Utilisateur supprimé");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la suppression");
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    // Validation
    if (!validateEmail(editFormData.email)) {
      toast.error("Format d'email invalide");
      return;
    }
    if (editFormData.displayName.length < 3) {
      toast.error("Le nom doit avoir au moins 3 caractères");
      return;
    }
    if (editFormData.password && editFormData.password.length < 6) {
      toast.error("Le nouveau mot de passe doit avoir au moins 6 caractères");
      return;
    }

    try {
      const data: any = { ...editFormData };
      if (!data.password) delete data.password; // Don't update password if empty

      await api.admin.updateUser(editingUser.id, data);
      toast.success("Utilisateur mis à jour");
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la mise à jour");
    }
  };

  const validateEmail = (email: string) => {
    return String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        // Map and Validate
        const mappedData = data.map((row: any) => {
          const regNo = String(row['N° inscription'] || row['N° d\'inscription'] || row['ID'] || row['Registration Number'] || '').trim();
          const prenom = String(row['prenom'] || row['Prénom'] || '').trim();
          const nom = String(row['nom'] || row['Nom'] || '').trim();
          const email = String(row['email'] || row['Email'] || '').trim().toLowerCase();
          const password = String(row['mot de passe'] || row['Mot de passe'] || row['password'] || 'Ofppt2024').trim();

          const rowData: any = {
            registrationNumber: regNo,
            displayName: `${prenom} ${nom}`.trim(),
            email,
            password,
            errors: [] as string[]
          };

          if (!email) rowData.errors.push("Email manquant");
          else if (!validateEmail(email)) rowData.errors.push("Format email invalide");
          
          if (!rowData.displayName) rowData.errors.push("Nom/Prénom manquant");
          if (!password) rowData.errors.push("Mot de passe manquant");

          return rowData;
        });

        if (mappedData.length === 0) {
          toast.error("Aucune donnée trouvée dans le fichier.");
          return;
        }

        setImportData(mappedData);
        setImportStep('preview');
      } catch (err) {
        toast.error("Erreur lors de la lecture du fichier");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const executeImport = async () => {
    if (!selectedFiliereId || !selectedGroupId) {
      toast.error("Veuillez sélectionner une filière et un groupe");
      return;
    }

    try {
      setIsProcessingImport(true);
      const studentsToImport = importData.map(s => ({
        ...s,
        filiereId: Number(selectedFiliereId),
        groupId: Number(selectedGroupId)
      }));

      const result = await api.students.bulkImport(studentsToImport);
      toast.success(`${result.success} étudiants importés avec succès.`);
      if (result.failed > 0) {
        toast.error(`${result.failed} échecs.`);
      }
      
      setIsImporting(false);
      setImportData([]);
      setImportStep('upload');
      setSelectedFiliereId('');
      setSelectedGroupId('');
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'importation");
    } finally {
      setIsProcessingImport(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (u.registrationNumber && u.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage));
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredUsers, currentPage, itemsPerPage]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3 uppercase">
            <Users className="w-8 h-8 text-indigo-600" />
            Gestion des Utilisateurs
          </h2>
          <p className="text-slate-500 mt-1 font-medium italic">Administrez les comptes, les rôles et les accès de la plateforme.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline"
            onClick={() => setIsImporting(true)}
            className="border-2 border-slate-200 hover:border-indigo-600 hover:text-indigo-600 rounded-2xl px-6 py-6 font-black uppercase tracking-widest text-xs transition-all active:scale-95 flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Importation Excel
          </Button>
          <Button 
            onClick={() => setIsAddingUser(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl px-6 py-6 font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Ajouter un Utilisateur
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          <Input 
            placeholder="Rechercher par nom, email ou N° inscription..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 h-14 bg-white border-slate-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700"
          />
        </div>
        <div className="relative group">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <select 
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="w-full pl-12 h-14 bg-white border border-slate-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-black text-xs uppercase tracking-widest text-slate-700 appearance-none cursor-pointer"
          >
            <option value="all">Tous les rôles</option>
            <option value="admin">Administrateurs</option>
            <option value="teacher">Enseignants</option>
            <option value="student">Étudiants</option>
          </select>
        </div>
        <Card className="flex items-center px-6 bg-indigo-50/50 border-indigo-100 rounded-2xl">
          <div className="text-2xl font-black text-indigo-600 leading-none">{filteredUsers.length}</div>
          <div className="ml-3 text-[10px] font-black text-indigo-400 uppercase tracking-widest">Résultats</div>
        </Card>
      </div>

      <Card className="overflow-hidden border-2 border-slate-50 shadow-2xl shadow-slate-200/50 rounded-[2.5rem] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">
                <th className="px-8 py-5">Utilisateur</th>
                <th className="px-4 py-5">Rôle</th>
                <th className="px-4 py-5">Groupe / Filière</th>
                <th className="px-4 py-5">Date d'inscription</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-8 py-4"><div className="h-6 bg-slate-100 rounded-lg w-full"></div></td>
                  </tr>
                ))
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 text-slate-300">
                      <Search className="w-12 h-12" />
                      <p className="font-black uppercase tracking-widest text-xs">Aucun utilisateur trouvé</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <motion.tr 
                    key={user.id} 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="group hover:bg-indigo-50/20 transition-colors"
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center border transition-all duration-500 group-hover:scale-110 group-hover:rotate-6",
                          user.role === 'admin' ? "bg-rose-50 border-rose-100 text-rose-600" :
                          user.role === 'teacher' ? "bg-indigo-50 border-indigo-100 text-indigo-600" :
                          "bg-emerald-50 border-emerald-100 text-emerald-600"
                        )}>
                          {user.role === 'admin' ? <Shield className="w-6 h-6" /> :
                           user.role === 'teacher' ? <BookOpen className="w-6 h-6" /> :
                           <GraduationCap className="w-6 h-6" />}
                        </div>
                        <div>
                          <div className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors text-base uppercase tracking-tight flex items-center gap-2">
                            {user.displayName}
                            {user.registrationNumber && (
                              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-mono">
                                #{user.registrationNumber}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 lowercase">
                             <Mail className="w-3 h-3" /> {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      <span className={cn(
                        "px-3 py-1 font-black text-[10px] rounded-lg uppercase tracking-widest border",
                        user.role === 'admin' ? "bg-rose-50 text-rose-600 border-rose-100" :
                        user.role === 'teacher' ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                        "bg-emerald-50 text-emerald-600 border-emerald-100"
                      )}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-5">
                      {user.role === 'student' ? (
                        <div className="space-y-1">
                          <div className="text-xs font-black text-slate-700 uppercase tracking-tight">{user.groupNameResolved || 'N/A'}</div>
                          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-widest italic">{user.filiereNameResolved || 'N/A'}</div>
                        </div>
                      ) : (
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Interne</span>
                      )}
                    </td>
                    <td className="px-4 py-5 font-mono text-[10px] text-slate-500 uppercase">
                      {new Date(user.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setEditingUser(user)}
                          className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 h-10 w-10 p-0 rounded-xl"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 h-10 w-10 p-0 rounded-xl"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
           <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full sm:w-auto">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] text-center sm:text-left">
               Affichage {filteredUsers.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} à {Math.min(currentPage * itemsPerPage, filteredUsers.length)} sur {filteredUsers.length} comptes (total: {users.length})
             </span>
             <select
               value={itemsPerPage}
               onChange={(e) => {
                 setItemsPerPage(Number(e.target.value));
                 setCurrentPage(1);
               }}
               className="text-[10px] font-black uppercase tracking-widest bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-500 focus:outline-none cursor-pointer hover:border-slate-300 transition-colors w-full sm:w-auto text-center"
             >
               <option value={10}>10 par page</option>
               <option value={20}>20 par page</option>
               <option value={50}>50 par page</option>
               <option value={100}>100 par page</option>
             </select>
           </div>
           
           {totalPages > 1 && (
             <div className="flex items-center justify-center gap-2 w-full sm:w-auto">
               <Button 
                 variant="outline" 
                 size="sm" 
                 disabled={currentPage === 1}
                 onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                 className="h-8 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border-slate-200 text-slate-500 hover:text-indigo-600 bg-white"
               >
                 Précédent
               </Button>
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 min-w-[100px] text-center">
                 Page {currentPage} sur {totalPages}
               </span>
               <Button 
                 variant="outline" 
                 size="sm" 
                 disabled={currentPage === totalPages}
                 onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                 className="h-8 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border-slate-200 text-slate-500 hover:text-indigo-600 bg-white"
               >
                 Suivant
               </Button>
             </div>
           )}
        </div>
      </Card>

      {/* Bulk Import Modal */}
      <AnimatePresence>
        {isImporting && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsImporting(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-2xl sm:rounded-[3rem] rounded-2xl shadow-2xl overflow-hidden border border-white/20 p-1.5 sm:p-2 max-h-[95vh] flex flex-col"
            >
              <div className="bg-slate-50/50 sm:rounded-[2.5rem] rounded-xl p-5 sm:p-8 md:p-12 overflow-y-auto">
                <div className="flex items-center justify-between mb-6 sm:mb-8">
                  <div className="min-w-0">
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 sm:gap-3">
                      <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600 shrink-0" />
                      <span className="truncate">Importation en Masse</span>
                    </h3>
                    <p className="text-slate-500 text-[10px] sm:text-sm font-medium mt-1 italic truncate">
                      Importez vos étudiants via Excel.
                    </p>
                  </div>
                  <Button variant="ghost" onClick={() => setIsImporting(false)} className="rounded-xl sm:rounded-2xl h-10 w-10 sm:h-14 sm:w-14 p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all shrink-0">
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                  </Button>
                </div>

                {importStep === 'upload' ? (
                  <div className="space-y-6 sm:space-y-8">
                    <div className="bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-2xl sm:rounded-[2rem] p-8 sm:p-12 text-center flex flex-col items-center gap-4 group hover:border-indigo-400 transition-all cursor-pointer"
                         onClick={() => fileInputRef.current?.click()}>
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-100 group-hover:scale-110 group-hover:rotate-3 transition-transform">
                        <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900 uppercase tracking-widest text-[10px] sm:text-sm">Cliquez pour téléverser</p>
                        <p className="text-slate-500 text-[10px] mt-2">Formats supportés: .xlsx, .xls</p>
                      </div>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".xlsx, .xls"
                        onChange={handleFileUpload}
                      />
                    </div>

                    <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-100 space-y-4">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Shield className="w-3 h-3 sm:w-4 sm:h-4" />
                        Structure attendue
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-600">Le fichier Excel doit contenir :</p>
                      <div className="grid grid-cols-2 lg:grid-cols-5 gap-1.5 sm:gap-2">
                        {['N° inscr.', 'nom', 'prenom', 'email', 'pass'].map(col => (
                          <div key={col} className="bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100 text-[9px] font-black text-indigo-600 text-center uppercase truncate">
                            {col}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 sm:space-y-8 animate-in slide-in-from-right duration-500">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-2">
                        <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Filière Cible</label>
                        <select 
                          value={selectedFiliereId}
                          onChange={(e) => {
                            setSelectedFiliereId(Number(e.target.value));
                            setSelectedGroupId('');
                          }}
                          className="w-full h-12 sm:h-14 bg-white border border-slate-100 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-500/10 font-bold text-[10px] sm:text-xs uppercase tracking-widest text-slate-700 px-4 appearance-none"
                        >
                          <option value="">Sélectionner une filière</option>
                          {filieres.map(f => (
                            <option key={f.id} value={f.id}>{f.name} ({f.code})</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Groupe Cible</label>
                        <select 
                          value={selectedGroupId}
                          onChange={(e) => setSelectedGroupId(Number(e.target.value))}
                          disabled={!selectedFiliereId}
                          className="w-full h-12 sm:h-14 bg-white border border-slate-100 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-500/10 font-bold text-[10px] sm:text-xs uppercase tracking-widest text-slate-700 px-4 appearance-none disabled:opacity-50"
                        >
                          <option value="">Sélectionner un groupe</option>
                          {groups.filter(g => g.filiereId === selectedFiliereId).map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex flex-col min-w-0">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
                            Aperçu ({importData.length})
                          </h4>
                          {importData.some(d => d.errors.length > 0) && (
                            <p className="text-rose-500 text-[9px] font-bold uppercase mt-0.5 animate-pulse">
                              Erreurs détectées
                            </p>
                          )}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setImportStep('upload')} className="text-indigo-600 font-bold text-[10px] sm:text-xs underline underline-offset-4 decoration-indigo-200 shrink-0">
                          Changer
                        </Button>
                      </div>
                      <div className="max-h-48 sm:max-h-60 overflow-y-auto border border-slate-100 rounded-xl sm:rounded-2xl bg-white divide-y divide-slate-50 shadow-inner">
                        {importData.map((row, idx) => (
                          <div key={idx} className={cn(
                            "p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 group transition-colors",
                            row.errors.length > 0 ? "bg-rose-50/50 hover:bg-rose-50" : "hover:bg-slate-50/50"
                          )}>
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={cn(
                                "w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center text-[9px] sm:text-[10px] font-black transition-colors shrink-0",
                                row.errors.length > 0 ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600"
                              )}>
                                {idx + 1}
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-xs sm:text-sm font-black text-slate-900 truncate">{row.displayName || '???'}</p>
                                  {row.errors.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {row.errors.map((err: string, i: number) => (
                                        <span key={i} className="text-[8px] bg-rose-600 text-white px-1 py-0.5 rounded font-bold uppercase tracking-tight">
                                          {err}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <p className="text-[10px] sm:text-xs text-slate-400 font-medium italic truncate">{row.email || 'Pas d\'email'}</p>
                              </div>
                            </div>
                            {row.registrationNumber && (
                              <span className="text-[9px] sm:text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 self-start sm:self-center">
                                #{row.registrationNumber}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2">
                      <Button 
                        disabled={isProcessingImport}
                        onClick={() => setIsImporting(false)}
                        variant="ghost" 
                        className="flex-1 py-5 sm:py-7 uppercase tracking-widest font-black text-[10px] sm:text-xs rounded-xl sm:rounded-2xl order-2 sm:order-1"
                      >
                        Annuler
                      </Button>
                      <Button 
                        disabled={isProcessingImport || !selectedGroupId || importData.some(d => d.errors.length > 0)}
                        onClick={executeImport}
                        className="flex-1 py-5 sm:py-7 bg-indigo-600 hover:bg-indigo-700 text-white uppercase tracking-widest font-black text-[10px] sm:text-xs rounded-xl sm:rounded-2xl shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:bg-slate-200 disabled:shadow-none disabled:text-slate-400 order-1 sm:order-2"
                      >
                        {isProcessingImport ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        Confirmer
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddingUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingUser(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-xl sm:rounded-[3rem] rounded-2xl shadow-2xl overflow-hidden border border-white/20 p-1.5 sm:p-2 max-h-[95vh] flex flex-col"
            >
              <div className="bg-slate-50/50 sm:rounded-[2.5rem] rounded-xl p-6 sm:p-12 overflow-y-auto">
                <div className="flex items-center justify-between mb-8">
                  <div className="min-w-0">
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                      <UserPlus className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600 shrink-0" />
                      <span className="truncate">Nouvel Utilisateur</span>
                    </h3>
                    <p className="text-slate-500 text-[10px] sm:text-sm font-medium mt-1 italic truncate">Créer un nouveau compte.</p>
                  </div>
                  <Button variant="ghost" onClick={() => setIsAddingUser(false)} className="rounded-xl sm:rounded-2xl h-10 w-10 sm:h-14 sm:w-14 p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all shrink-0">
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                  </Button>
                </div>

                <form onSubmit={handleCreateUser} className="space-y-4 sm:space-y-6">
                  <div className="space-y-1.5 sm:space-y-2">
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Nom Complet</label>
                    <div className="relative">
                      <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                      <Input 
                        required
                        value={newUser.displayName}
                        onChange={(e) => setNewUser({...newUser, displayName: e.target.value})}
                        className="pl-11 sm:pl-12 h-12 sm:h-14 bg-white border-slate-100 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-500/10 font-medium text-sm sm:text-base"
                        placeholder="Jean Dupont"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 sm:space-y-2">
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">N° Inscription (optionnel)</label>
                    <div className="relative">
                      <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                      <Input 
                        value={newUser.registrationNumber}
                        onChange={(e) => setNewUser({...newUser, registrationNumber: e.target.value})}
                        className="pl-11 sm:pl-12 h-12 sm:h-14 bg-white border-slate-100 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-500/10 font-medium text-sm sm:text-base"
                        placeholder="Ex: 2405001"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                        <Input 
                          required
                          type="email"
                          value={newUser.email}
                          onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                          className="pl-11 sm:pl-12 h-12 sm:h-14 bg-white border-slate-100 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-500/10 font-medium text-sm sm:text-base"
                          placeholder="jean@example.com"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Rôle</label>
                      <div className="relative">
                        <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                        <select 
                          value={newUser.role}
                          onChange={(e) => setNewUser({...newUser, role: e.target.value as any, filiereId: '', groupId: ''})}
                          className="w-full pl-11 sm:pl-12 h-12 sm:h-14 bg-white border border-slate-100 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-500/10 font-black text-[10px] uppercase tracking-widest text-slate-700 appearance-none cursor-pointer"
                        >
                          <option value="student">Étudiant</option>
                          <option value="teacher">Enseigneur</option>
                          <option value="admin">Administrateur</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {newUser.role === 'student' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="space-y-1.5 sm:space-y-2">
                        <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Filière</label>
                        <select 
                          value={newUser.filiereId}
                          onChange={(e) => setNewUser({...newUser, filiereId: Number(e.target.value), groupId: ''})}
                          className="w-full h-12 sm:h-14 bg-white border border-slate-100 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-500/10 font-black text-[10px] uppercase tracking-widest text-slate-700 px-4 appearance-none"
                        >
                          <option value="">Sélectionner une filière</option>
                          {filieres.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5 sm:space-y-2">
                        <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Groupe</label>
                        <select 
                          value={newUser.groupId}
                          onChange={(e) => setNewUser({...newUser, groupId: Number(e.target.value)})}
                          disabled={!newUser.filiereId}
                          className="w-full h-12 sm:h-14 bg-white border border-slate-100 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-500/10 font-black text-[10px] uppercase tracking-widest text-slate-700 px-4 appearance-none disabled:opacity-50"
                        >
                          <option value="">Sélectionner un groupe</option>
                          {groups.filter(g => g.filiereId === newUser.filiereId).map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5 sm:space-y-2">
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Mot de passe</label>
                    <div className="relative">
                      <AlertCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                      <Input 
                        required
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                        className="pl-11 sm:pl-12 h-12 sm:h-14 bg-white border-slate-100 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-500/10 font-medium text-sm sm:text-base"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <div className="pt-4 sm:pt-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => setIsAddingUser(false)}
                      className="flex-1 py-5 sm:py-7 uppercase tracking-widest font-black text-[10px] sm:text-xs rounded-xl sm:rounded-2xl order-2 sm:order-1"
                    >
                      Annuler
                    </Button>
                    <Button 
                      type="submit"
                      className="flex-1 py-5 sm:py-7 bg-indigo-600 hover:bg-indigo-700 text-white uppercase tracking-widest font-black text-[10px] sm:text-xs rounded-xl sm:rounded-2xl shadow-xl shadow-indigo-100 transition-all active:scale-95 order-1 sm:order-2"
                    >
                      Créer le Compte
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingUser(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-xl sm:rounded-[3rem] rounded-2xl shadow-2xl overflow-hidden border border-white/20 p-1.5 sm:p-2 max-h-[95vh] flex flex-col"
            >
              <div className="bg-slate-50/50 sm:rounded-[2.5rem] rounded-xl p-6 sm:p-12 overflow-y-auto">
                <div className="flex items-center justify-between mb-8">
                  <div className="min-w-0">
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                      <Edit2 className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600 shrink-0" />
                      <span className="truncate">Modifier Profil</span>
                    </h3>
                    <p className="text-slate-500 text-[10px] sm:text-sm font-medium mt-1 italic truncate">Update {editingUser.displayName}.</p>
                  </div>
                  <Button variant="ghost" onClick={() => setEditingUser(null)} className="rounded-xl sm:rounded-2xl h-10 w-10 sm:h-14 sm:w-14 p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all shrink-0">
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                  </Button>
                </div>

                <form onSubmit={handleUpdateUser} className="space-y-4 sm:space-y-6">
                  <div className="space-y-1.5 sm:space-y-2">
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Nom Complet</label>
                    <div className="relative">
                      <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                      <Input 
                        required
                        value={editFormData.displayName}
                        onChange={(e) => setEditFormData({...editFormData, displayName: e.target.value})}
                        className="pl-11 sm:pl-12 h-12 sm:h-14 bg-white border-slate-100 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-500/10 font-medium text-sm sm:text-base"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 sm:space-y-2">
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">N° Inscription</label>
                    <div className="relative">
                      <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                      <Input 
                        value={editFormData.registrationNumber}
                        onChange={(e) => setEditFormData({...editFormData, registrationNumber: e.target.value})}
                        className="pl-11 sm:pl-12 h-12 sm:h-14 bg-white border-slate-100 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-500/10 font-medium text-sm sm:text-base"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                        <Input 
                          required
                          type="email"
                          value={editFormData.email}
                          onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                          className="pl-11 sm:pl-12 h-12 sm:h-14 bg-white border-slate-100 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-500/10 font-medium text-sm sm:text-base"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Rôle</label>
                      <div className="relative">
                        <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                        <select 
                          value={editFormData.role}
                          onChange={(e) => setEditFormData({...editFormData, role: e.target.value as any, filiereId: '', groupId: ''})}
                          className="w-full pl-11 sm:pl-12 h-12 sm:h-14 bg-white border border-slate-100 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-500/10 font-black text-[10px] uppercase tracking-widest text-slate-700 appearance-none cursor-pointer"
                        >
                          <option value="student">Étudiant</option>
                          <option value="teacher">Enseigneur</option>
                          <option value="admin">Administrateur</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {editFormData.role === 'student' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="space-y-1.5 sm:space-y-2">
                        <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Filière</label>
                        <select 
                          value={editFormData.filiereId}
                          onChange={(e) => setEditFormData({...editFormData, filiereId: Number(e.target.value), groupId: ''})}
                          className="w-full h-12 sm:h-14 bg-white border border-slate-100 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-500/10 font-black text-[10px] uppercase tracking-widest text-slate-700 px-4 appearance-none"
                        >
                          <option value="">Sélectionner une filière</option>
                          {filieres.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5 sm:space-y-2">
                        <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Groupe</label>
                        <select 
                          value={editFormData.groupId}
                          onChange={(e) => setEditFormData({...editFormData, groupId: Number(e.target.value)})}
                          disabled={!editFormData.filiereId}
                          className="w-full h-12 sm:h-14 bg-white border border-slate-100 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-500/10 font-black text-[10px] uppercase tracking-widest text-slate-700 px-4 appearance-none disabled:opacity-50"
                        >
                          <option value="">Sélectionner un groupe</option>
                          {groups.filter(g => g.filiereId === editFormData.filiereId).map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5 sm:space-y-2">
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Nouveau mot de passe (optionnel)</label>
                    <div className="relative">
                      <AlertCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                      <Input 
                        type="password"
                        value={editFormData.password}
                        onChange={(e) => setEditFormData({...editFormData, password: e.target.value})}
                        className="pl-11 sm:pl-12 h-12 sm:h-14 bg-white border-slate-100 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-500/10 font-medium text-sm sm:text-base"
                        placeholder="Laisser vide pour ne pas changer"
                      />
                    </div>
                  </div>

                  <div className="pt-4 sm:pt-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => setEditingUser(null)}
                      className="flex-1 py-5 sm:py-7 uppercase tracking-widest font-black text-[10px] sm:text-xs rounded-xl sm:rounded-2xl order-2 sm:order-1"
                    >
                      Annuler
                    </Button>
                    <Button 
                      type="submit"
                      className="flex-1 py-5 sm:py-7 bg-indigo-600 hover:bg-indigo-700 text-white uppercase tracking-widest font-black text-[10px] sm:text-xs rounded-xl sm:rounded-2xl shadow-xl shadow-indigo-100 transition-all active:scale-95 order-1 sm:order-2"
                    >
                      Enregistrer
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
