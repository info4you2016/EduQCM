import React, { useState } from 'react';
import { api } from '../../lib/api';
import { UserProfile, Group, Filiere } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { RichTextEditor } from '../ui/RichTextEditor';
import { Globe, Users, GraduationCap, ShieldAlert, BookOpen } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AddNotificationFormProps {
  onComplete: () => void;
  user: UserProfile;
  groups: Group[];
  filieres?: Filiere[];
}

export const AddNotificationForm = ({ onComplete, user, groups, filieres = [] }: AddNotificationFormProps) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [targetType, setTargetType] = useState<'global' | 'filiere' | 'group'>('global');
  const [selectedGroupId, setSelectedGroupId] = useState<number | ''>('');
  const [selectedFiliereId, setSelectedFiliereId] = useState<number | ''>('');
  const [audienceRole, setAudienceRole] = useState<'all' | 'students' | 'teachers'>('all');
  const [isPinned, setIsPinned] = useState(false);
  const [importance, setImportance] = useState<'normal' | 'low' | 'high'>('normal');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentName, setAttachmentName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content || content === '<p><br></p>') {
      alert("Le contenu de l'annonce ne peut pas être vide.");
      return;
    }
    
    if (targetType === 'group' && !selectedGroupId) {
      alert("Veuillez sélectionner un groupe.");
      return;
    }

    if (targetType === 'filiere' && !selectedFiliereId) {
      alert("Veuillez sélectionner une filière.");
      return;
    }

    setLoading(true);
    try {
      await api.notifications.create({ 
        title, 
        content, 
        groupId: targetType === 'group' ? selectedGroupId : null,
        filiereId: targetType === 'filiere' ? selectedFiliereId : null,
        audienceRole,
        type: 'announcement',
        isPinned,
        importance,
        attachmentUrl: attachmentUrl.trim() || null,
        attachmentName: attachmentUrl.trim() ? (attachmentName.trim() || "Lien ressources") : null
      });
      onComplete();
    } catch (error) {
      console.error("Error creating notification:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Target Type Selector */}
      <div className="space-y-2">
        <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Périmètre de diffusion</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => {
              setTargetType('global');
              setSelectedGroupId('');
              setSelectedFiliereId('');
            }}
            className={cn(
              "flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left group",
              targetType === 'global' 
                ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md translate-y-[-2px]" 
                : "border-slate-100 hover:border-slate-200 text-slate-500"
            )}
          >
            <div className={cn(
              "p-2 rounded-lg transition-colors",
              targetType === 'global' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
            )}>
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <p className="font-black text-xs uppercase tracking-tight">Globale</p>
              <p className="text-[10px] opacity-70">Toute l'école / Tous</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setTargetType('filiere');
              setSelectedGroupId('');
            }}
            className={cn(
              "flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left group",
              targetType === 'filiere' 
                ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md translate-y-[-2px]" 
                : "border-slate-100 hover:border-slate-200 text-slate-500"
            )}
          >
            <div className={cn(
              "p-2 rounded-lg transition-colors",
              targetType === 'filiere' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
            )}>
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <p className="font-black text-xs uppercase tracking-tight">Filière</p>
              <p className="text-[10px] opacity-70">Par discipline d'études</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setTargetType('group');
              setSelectedFiliereId('');
            }}
            className={cn(
              "flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left group",
              targetType === 'group' 
                ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md translate-y-[-2px]" 
                : "border-slate-100 hover:border-slate-200 text-slate-500"
            )}
          >
            <div className={cn(
              "p-2 rounded-lg transition-colors",
              targetType === 'group' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
            )}>
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="font-black text-xs uppercase tracking-tight">Groupe</p>
              <p className="text-[10px] opacity-70">Classe spécifique</p>
            </div>
          </button>
        </div>
      </div>

      {/* Target refinement inputs based on type */}
      {targetType === 'filiere' && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Sélectionner la filière cible</label>
          <select
            value={selectedFiliereId}
            onChange={(e) => setSelectedFiliereId(Number(e.target.value))}
            className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 text-sm font-bold focus:border-indigo-500 transition-all outline-none"
            required
          >
            <option value="">Choisir une filière académique...</option>
            {filieres.map(filiere => (
              <option key={filiere.id} value={filiere.id}>
                {filiere.name} ({filiere.code || 'N/A'})
              </option>
            ))}
          </select>
        </div>
      )}

      {targetType === 'group' && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Sélectionner la classe (groupe) cible</label>
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(Number(e.target.value))}
            className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 text-sm font-bold focus:border-indigo-500 transition-all outline-none"
            required
          >
            <option value="">Choisir une classe...</option>
            {groups.map(group => {
              const filiereObj = filieres.find(f => f.id === group.filiereId);
              return (
                <option key={group.id} value={group.id}>
                  {group.name} {filiereObj ? `— [${filiereObj.name}]` : ''}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Role audience selection */}
      <div className="space-y-2">
        <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Filtrer par rôle d’audience</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {(['all', 'students', 'teachers'] as const).map((roleOption) => (
            <button
              key={roleOption}
              type="button"
              onClick={() => setAudienceRole(roleOption)}
              className={cn(
                "py-3 px-4 rounded-xl border-2 text-center font-bold text-xs transition-all flex items-center justify-center gap-2",
                audienceRole === roleOption 
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-extrabold shadow-sm"
                  : "border-slate-100 text-slate-500 hover:bg-slate-50"
              )}
            >
              <span className={cn(
                "w-2 h-2 rounded-full",
                roleOption === 'all' ? "bg-indigo-600" : roleOption === 'students' ? "bg-teal-500" : "bg-amber-500"
              )} />
              {roleOption === 'all' && 'Tous (Élèves & Profs)'}
              {roleOption === 'students' && 'Étudiants uniquement'}
              {roleOption === 'teachers' && 'Formateurs uniquement'}
            </button>
          ))}
        </div>
      </div>

      <Input label="Titre de l'annonce" value={title} onChange={(e) => setTitle(e.target.value)} required />
      
      {/* Importance and Pinned status row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Niveau d'importance</label>
          <div className="flex gap-2">
            {(['low', 'normal', 'high'] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setImportance(level)}
                className={cn(
                  "flex-1 py-3 px-3 rounded-xl border-2 text-center font-bold text-xs transition-all",
                  importance === level 
                    ? level === 'high' 
                      ? "border-rose-600 bg-rose-50 text-rose-700 font-extrabold"
                      : level === 'low'
                        ? "border-slate-600 bg-slate-50 text-slate-700 font-extrabold"
                        : "border-indigo-600 bg-indigo-50 text-indigo-700 font-extrabold"
                    : "border-slate-100 text-slate-500 hover:bg-slate-50"
                )}
              >
                {level === 'high' ? '🔥 Urgent' : level === 'low' ? '💤 Faible' : '📢 Normal'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Épingler l'annonce</label>
          <button
            type="button"
            onClick={() => setIsPinned(!isPinned)}
            className={cn(
              "w-full h-12 rounded-xl border-2 font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2",
              isPinned
                ? "border-amber-500 bg-amber-50 text-amber-700 font-extrabold shadow-sm"
                : "border-slate-100 text-slate-400 hover:bg-slate-50"
            )}
          >
            <span className={cn("inline-block w-2.5 h-2.5 rounded-full", isPinned ? "bg-amber-500 animate-pulse" : "bg-slate-300")} />
            {isPinned ? '📌 Épinglée en priorité' : 'Ne pas épingler'}
          </button>
        </div>
      </div>

      {/* Attachments optional Section */}
      <div className="p-4 rounded-2xl bg-slate-50/50 border-2 border-slate-100/60 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-3 bg-indigo-600 rounded-full" />
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Lien de Ressource ou Fichier (Optionnel)</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input 
            label="Nom du lien" 
            placeholder="Ex: Fiche de révision PDF" 
            value={attachmentName} 
            onChange={(e) => setAttachmentName(e.target.value)} 
          />
          <Input 
            label="URL de la ressource" 
            placeholder="Ex: https://drive.google.com/file/..." 
            value={attachmentUrl} 
            onChange={(e) => setAttachmentUrl(e.target.value)} 
          />
        </div>
      </div>
      
      {/* Editor Content */}
      <div className="space-y-2">
        <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Contenu</label>
        <RichTextEditor 
          value={content} 
          onChange={setContent}
          className="min-h-[200px]"
        />
      </div>

      {/* Buttons */}
      <div className="pt-4 flex gap-3">
        <Button variant="outline" type="button" onClick={onComplete} className="flex-1 py-4 text-xs font-black uppercase tracking-widest">Annuler</Button>
        <Button type="submit" disabled={loading} className="flex-1 py-4 text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-100">
          {loading ? 'Publication...' : 'Publier l\'annonce'}
        </Button>
      </div>
    </form>
  );
};
