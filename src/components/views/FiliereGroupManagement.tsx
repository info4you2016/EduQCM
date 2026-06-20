import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Edit2, Trash2, Users, User, FileUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { Filiere, Group, FiliereLevel } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import { BulkImportStudents } from '../sections/BulkImportStudents';
import { toast } from 'react-hot-toast';
import { useConfirm } from '../ui/ConfirmDialog';

export const StudentListModal = React.memo(({ group, onClose }: { group: Group; onClose: () => void }) => {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const data = await api.groups.getStudents(group.id);
      setStudents(data);
    } catch (err: any) {
      console.error("Error fetching students:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [group.id]);

  return (
    <Modal title={`Gestion du Groupe - ${group.name}`} onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-6 p-5 sm:p-8">
        <div className="flex items-center justify-between">
           <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Liste des Étudiants</h3>
           <div className="flex gap-2">
             <Button 
               variant={showImport ? "primary" : "outline"} 
               size="sm" 
               onClick={() => setShowImport(!showImport)}
               className="text-[10px] font-black uppercase tracking-widest gap-2"
             >
               <FileUp className="w-3.5 h-3.5" />
               {showImport ? "Voir la Liste" : "Import CSV"}
             </Button>
           </div>
        </div>

        {showImport ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <BulkImportStudents 
              filiereId={group.filiereId} 
              groupId={group.id} 
              groupName={group.name} 
              onSuccess={fetchStudents} 
            />
          </motion.div>
        ) : (
          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
              </div>
            ) : students.length === 0 ? (
              <EmptyState message="Aucun étudiant dans ce groupe." />
            ) : (
              <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2 font-sans font-medium tracking-tight text-gray-900">
                {students.map(student => (
                  <Card key={student.id} className="p-4 flex items-center gap-4 border-none shadow-md shadow-slate-100 bg-slate-50/50">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-slate-100">
                      <User className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-900">{student.displayName}</h4>
                      <p className="text-xs text-slate-500">{student.email}</p>
                    </div>
                    <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest bg-white px-2 py-0.5 rounded-lg border border-slate-100">
                      Inscrit le {new Date(student.createdAt).toLocaleDateString()}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
});

export const FiliereForm = ({ initialData, onComplete }: { initialData: Filiere | null; onComplete: () => void }) => {
  const [code, setCode] = useState(initialData?.code || '');
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [niveau, setNiveau] = useState<FiliereLevel>(initialData?.niveau || 'technicien spécialisé');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (initialData) {
        await api.filieres.update(initialData.id, { code, name, description, niveau });
        toast.success("Filière mise à jour avec succès");
      } else {
        await api.filieres.create({ code, name, description, niveau });
        toast.success("Filière créée avec succès");
      }
      onComplete();
    } catch (err: any) {
      toast.error(err.message || "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-5 sm:p-8">
      <div className="space-y-4">
        <Input label="Code de la filière" value={code} onChange={(e) => setCode(e.target.value)} required placeholder="ex: TDI" />
        <Input label="Nom de la filière" value={name} onChange={(e) => setName(e.target.value)} required placeholder="ex: Informatique de Gestion" />
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Niveau</label>
          <select 
            value={niveau} 
            onChange={(e) => setNiveau(e.target.value as FiliereLevel)}
            className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-2xl text-sm font-bold transition-all outline-none appearance-none"
            required
          >
            <option value="spécialisation">Spécialisation</option>
            <option value="qualification">Qualification</option>
            <option value="technicien">Technicien</option>
            <option value="technicien spécialisé">Technicien Spécialisé</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Description</label>
          <textarea 
            value={description} 
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-2xl text-sm font-bold transition-all outline-none"
            placeholder="Brève description de la filière..."
            rows={3}
          />
        </div>
      </div>
      <div className="pt-4 flex flex-col sm:flex-row gap-3">
        <Button variant="outline" type="button" onClick={onComplete} className="w-full sm:flex-1 py-4">Annuler</Button>
        <Button type="submit" disabled={loading} className="w-full sm:flex-1 py-4">
          {loading ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </div>
    </form>
  );
};

export const GroupForm = ({ filieres, initialData, onComplete }: { filieres: Filiere[]; initialData: Group | null; onComplete: () => void }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [filiereId, setFiliereId] = useState(initialData?.filiereId || filieres[0]?.id || 0);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filiereId) return toast.error("Veuillez sélectionner une filière.");
    setLoading(true);
    try {
      if (initialData) {
        await api.groups.update(initialData.id, { name, filiereId });
        toast.success("Groupe mis à jour avec succès");
      } else {
        await api.groups.create({ name, filiereId });
        toast.success("Groupe créé avec succès");
      }
      onComplete();
    } catch (err: any) {
      toast.error(err.message || "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-5 sm:p-8">
      <div className="space-y-4">
        <Input label="Nom du groupe" value={name} onChange={(e) => setName(e.target.value)} required placeholder="ex: G1-A" />
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Filière associée</label>
          <select 
            value={filiereId} 
            onChange={(e) => setFiliereId(Number(e.target.value))}
            className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-2xl text-sm font-bold transition-all outline-none appearance-none"
            required
          >
            <option value="">Sélectionnez une filière</option>
            {filieres.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      </div>
      <div className="pt-4 flex flex-col sm:flex-row gap-3">
        <Button variant="outline" type="button" onClick={onComplete} className="w-full sm:flex-1 py-4">Annuler</Button>
        <Button type="submit" disabled={loading} className="w-full sm:flex-1 py-4">
          {loading ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </div>
    </form>
  );
};

export const FiliereGroupManagement = ({ filieres, groups, onRefresh, mode = 'all' }: { filieres: Filiere[]; groups: Group[]; onRefresh: () => void; mode?: 'all' | 'filieres' | 'groups' }) => {
  const confirm = useConfirm();
  const [isAddingFiliere, setIsAddingFiliere] = useState(false);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [editingFiliere, setEditingFiliere] = useState<Filiere | null>(null);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [viewingGroupStudents, setViewingGroupStudents] = useState<Group | null>(null);

  const [filierePage, setFilierePage] = useState(1);
  const [groupPage, setGroupPage] = useState(1);

  const filiereItemsPerPage = 4;
  const groupItemsPerPage = 4;

  const groupsWithFiliere = useMemo(() => {
    return groups.map(g => ({
      ...g,
      filiere: filieres.find(f => f.id === g.filiereId)
    }));
  }, [groups, filieres]);

  const totalFilierePages = Math.max(1, Math.ceil(filieres.length / filiereItemsPerPage));
  const paginatedFilieres = useMemo(() => {
    return filieres.slice((filierePage - 1) * filiereItemsPerPage, filierePage * filiereItemsPerPage);
  }, [filieres, filierePage]);

  const totalGroupPages = Math.max(1, Math.ceil(groupsWithFiliere.length / groupItemsPerPage));
  const paginatedGroups = useMemo(() => {
    return groupsWithFiliere.slice((groupPage - 1) * groupItemsPerPage, groupPage * groupItemsPerPage);
  }, [groupsWithFiliere, groupPage]);

  useEffect(() => {
    if (filierePage > totalFilierePages) {
      setFilierePage(totalFilierePages);
    }
  }, [filieres.length, totalFilierePages, filierePage]);

  useEffect(() => {
    if (groupPage > totalGroupPages) {
      setGroupPage(totalGroupPages);
    }
  }, [groupsWithFiliere.length, totalGroupPages, groupPage]);

  const handleDeleteFiliere = async (id: number) => {
    const ok = await confirm({
      title: "Supprimer la filière",
      message: "Voulez-vous vraiment supprimer cette filière ? Attention, cela supprimera tous les groupes associés à cette filière et dissociera les étudiants, les modules et les notifications liés.",
      confirmLabel: "Supprimer",
      cancelLabel: "Annuler",
      variant: "danger"
    });
    if (!ok) return;
    try {
      await api.filieres.delete(id);
      toast.success("Filière et ses dépendances supprimées avec succès");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Impossible de supprimer la filière");
    }
  };

  const handleDeleteGroup = async (id: number) => {
    const ok = await confirm({
      title: "Supprimer le groupe",
      message: "Voulez-vous vraiment supprimer ce groupe ?",
      confirmLabel: "Supprimer",
      cancelLabel: "Annuler",
      variant: "danger"
    });
    if (!ok) return;
    try {
      await api.groups.delete(id);
      toast.success("Groupe supprimé avec succès");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Impossible de supprimer le groupe");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 font-serif italic tracking-tight">
            {mode === 'filieres' ? 'Gestion des Filières' : mode === 'groups' ? 'Gestion des Groupes' : 'Gestion des Filières & Groupes'}
          </h2>
          <p className="text-slate-500 mt-1">
            {mode === 'filieres' ? 'Gérez les cursus et spécialités.' : mode === 'groups' ? 'Gérez les classes et les étudiants.' : 'Configurez les structures académiques pour vos étudiants.'}
          </p>
        </div>
      </div>

      <div className={cn("grid grid-cols-1 gap-8", mode === 'all' ? "lg:grid-cols-2" : "max-w-4xl")}>
        {/* Filières Section */}
        {(mode === 'all' || mode === 'filieres') && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-900 font-serif italic">Filières</h3>
              <Button onClick={() => setIsAddingFiliere(true)} variant="outline" className="gap-2 text-xs uppercase tracking-widest font-black py-3 px-4">
                <Plus className="w-4 h-4" /> Ajouter
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {filieres.length === 0 ? (
                <EmptyState message="Aucune filière créée." />
              ) : (
                paginatedFilieres.map(f => (
                  <Card key={f.id} className="p-5 flex items-center justify-between group border-none shadow-xl shadow-slate-200/40 hover:-translate-y-1 transition-all duration-300">
                    <div className="cursor-pointer flex-1" onClick={() => setEditingFiliere(f)}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg uppercase tracking-widest">
                          {f.code}
                        </span>
                        <h4 className="font-black text-slate-900 text-lg group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{f.name}</h4>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        {f.niveau && (
                          <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase tracking-tighter border border-slate-200">
                            {f.niveau}
                          </span>
                        )}
                      </div>
                      <div className="mb-3">
                        {f.description && f.description.trim() ? (
                          <p className="text-xs text-slate-600 leading-relaxed max-w-2xl bg-slate-50/50 p-2.5 rounded-xl border border-dashed border-slate-100 whitespace-pre-wrap">
                            {f.description}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400 italic bg-amber-50/20 px-2.5 py-1.5 rounded-lg border border-dashed border-amber-100/40 inline-block font-medium">
                            (Aucune description renseignée)
                          </p>
                        )}
                      </div>
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Créée le {new Date(f.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setEditingFiliere(f)}
                        className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDeleteFiliere(f.id)}
                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))
              )}
              <button 
                onClick={() => setIsAddingFiliere(true)}
                className="w-full py-4 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 mt-2"
              >
                <Plus className="w-4 h-4" /> Ajouter une filière
              </button>

              {/* Filières Pagination */}
              {totalFilierePages > 1 && (
                <div className="flex items-center justify-between p-3.5 bg-white border border-slate-100 rounded-2xl shadow-sm mt-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Page {filierePage} / {totalFilierePages}
                  </span>
                  <div className="flex gap-1.5">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={filierePage === 1}
                      onClick={() => setFilierePage(p => Math.max(1, p - 1))}
                      className="h-7 px-2.5 text-[9px] font-black uppercase tracking-wider rounded-lg"
                    >
                      Précédent
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={filierePage === totalFilierePages}
                      onClick={() => setFilierePage(p => Math.min(totalFilierePages, p + 1))}
                      className="h-7 px-2.5 text-[9px] font-black uppercase tracking-wider rounded-lg"
                    >
                      Suivant
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Groupes Section */}
        {(mode === 'all' || mode === 'groups') && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-900 font-serif italic">Groupes</h3>
              <Button onClick={() => setIsAddingGroup(true)} variant="outline" className="gap-2 text-xs uppercase tracking-widest font-black py-3 px-4" disabled={filieres.length === 0}>
                <Plus className="w-4 h-4" /> Ajouter
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {groupsWithFiliere.length === 0 ? (
                <EmptyState message="Aucun groupe créé." />
              ) : (
                paginatedGroups.map(g => (
                  <Card key={g.id} className="p-5 flex items-center justify-between group border-none shadow-xl shadow-slate-200/40 hover:-translate-y-1 transition-all duration-300">
                    <div className="cursor-pointer flex-1" onClick={() => setViewingGroupStudents(g)}>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-black text-slate-900 text-lg group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{g.name}</h4>
                        <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg uppercase tracking-widest">
                          {g.filiere?.name || 'Filière inconnue'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Créé le {new Date(g.createdAt).toLocaleDateString()}</p>
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                          <Users className="w-3 h-3" /> {g.studentCount || 0} étudiants • Cliquer pour voir
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 pl-4 border-l border-slate-50 ml-4">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setEditingGroup(g)}
                        className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                        title="Modifier"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDeleteGroup(g.id)}
                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))
              )}
              <button 
                onClick={() => setIsAddingGroup(true)}
                disabled={filieres.length === 0}
                className="w-full py-4 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" /> Ajouter un groupe
              </button>

              {/* Groupes Pagination */}
              {totalGroupPages > 1 && (
                <div className="flex items-center justify-between p-3.5 bg-white border border-slate-100 rounded-2xl shadow-sm mt-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Page {groupPage} / {totalGroupPages}
                  </span>
                  <div className="flex gap-1.5">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={groupPage === 1}
                      onClick={() => setGroupPage(p => Math.max(1, p - 1))}
                      className="h-7 px-2.5 text-[9px] font-black uppercase tracking-wider rounded-lg"
                    >
                      Précédent
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={groupPage === totalGroupPages}
                      onClick={() => setGroupPage(p => Math.min(totalGroupPages, p + 1))}
                      className="h-7 px-2.5 text-[9px] font-black uppercase tracking-wider rounded-lg"
                    >
                      Suivant
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {(isAddingFiliere || editingFiliere) && (
          <Modal title={editingFiliere ? "Modifier la Filière" : "Ajouter une Filière"} onClose={() => { setIsAddingFiliere(false); setEditingFiliere(null); }}>
            <FiliereForm initialData={editingFiliere} onComplete={() => { setIsAddingFiliere(false); setEditingFiliere(null); onRefresh(); }} />
          </Modal>
        )}

        {(isAddingGroup || editingGroup) && (
          <Modal title={editingGroup ? "Modifier le Groupe" : "Ajouter un Groupe"} onClose={() => { setIsAddingGroup(false); setEditingGroup(null); }}>
            <GroupForm filieres={filieres} initialData={editingGroup} onComplete={() => { setIsAddingGroup(false); setEditingGroup(null); onRefresh(); }} />
          </Modal>
        )}

        {viewingGroupStudents && (
          <StudentListModal group={viewingGroupStudents} onClose={() => setViewingGroupStudents(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};
