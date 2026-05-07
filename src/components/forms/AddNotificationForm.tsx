import React, { useState } from 'react';
import { api } from '../../lib/api';
import { UserProfile, Group } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { RichTextEditor } from '../ui/RichTextEditor';
import { Globe, Users } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AddNotificationFormProps {
  onComplete: () => void;
  user: UserProfile;
  groups: Group[];
}

export const AddNotificationForm = ({ onComplete, user, groups }: AddNotificationFormProps) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [targetType, setTargetType] = useState<'global' | 'group'>('global');
  const [selectedGroupId, setSelectedGroupId] = useState<number | ''>('');

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

    setLoading(true);
    try {
      await api.notifications.create({ 
        title, 
        content, 
        groupId: targetType === 'group' ? selectedGroupId : null,
        type: 'announcement'
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
      <div className="space-y-2">
        <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Ciblage de l'annonce</label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setTargetType('global')}
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
              <p className="text-[10px] opacity-70">Tous les étudiants</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTargetType('group')}
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
              <p className="text-[10px] opacity-70">Spécifique</p>
            </div>
          </button>
        </div>
      </div>

      {targetType === 'group' && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Sélectionner le groupe</label>
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(Number(e.target.value))}
            className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 text-sm font-bold focus:border-indigo-500 transition-all outline-none"
            required
          >
            <option value="">Choisir un groupe...</option>
            {groups.map(group => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
        </div>
      )}

      <Input label="Titre de l'annonce" value={title} onChange={(e) => setTitle(e.target.value)} required />
      
      <div className="space-y-2">
        <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Contenu</label>
        <RichTextEditor 
          value={content} 
          onChange={setContent}
          className="min-h-[200px]"
        />
      </div>

      <div className="pt-4 flex gap-3">
        <Button variant="outline" type="button" onClick={onComplete} className="flex-1 py-4 text-xs font-black uppercase tracking-widest">Annuler</Button>
        <Button type="submit" disabled={loading} className="flex-1 py-4 text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-100">
          {loading ? 'Publication...' : 'Publier l\'annonce'}
        </Button>
      </div>
    </form>
  );
};
