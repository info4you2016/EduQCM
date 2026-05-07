import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';
import { Filiere, Module, UserProfile } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { RichTextEditor } from '../ui/RichTextEditor';

interface AddModuleFormProps {
  filieres: Filiere[];
  onComplete: () => void;
  user: UserProfile;
  initialData?: Module;
}

export const AddModuleForm = ({ filieres, onComplete, user, initialData }: AddModuleFormProps) => {
  const [code, setCode] = useState(initialData?.code || '');
  const [name, setName] = useState(initialData?.name || '');
  const [durationHours, setDurationHours] = useState(initialData?.durationHours?.toString() || '0');
  const [desc, setDesc] = useState(initialData?.description || '');
  const [filiereId, setFiliereId] = useState<string>(initialData?.filiereId?.toString() || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fId = filiereId === '' ? null : Number(filiereId);
      const data = { 
        code, 
        name, 
        durationHours: Number(durationHours), 
        description: desc, 
        filiereId: fId 
      };

      if (initialData) {
        await api.modules.update(initialData.id, data);
      } else {
        await api.modules.create(data);
      }
      onComplete();
    } catch (error) {
      console.error("Error saving module:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input 
            label="Numéro de module" 
            value={code} 
            onChange={(e) => setCode(e.target.value)} 
            required 
            placeholder="ex: M101" 
          />
          <Input 
            label="Masse Horaire (H)" 
            type="number"
            value={durationHours} 
            onChange={(e) => setDurationHours(e.target.value)} 
            required 
            placeholder="ex: 60" 
          />
        </div>
        <Input 
          label="Nom du module" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          required 
          placeholder="ex: Algorithmique et Structure de Données" 
        />
        <RichTextEditor 
          label="Description"
          value={desc}
          onChange={setDesc}
          placeholder="Décrivez brièvement le contenu du module..."
        />
        <div className="space-y-1.5">
          <label className="text-sm font-bold text-slate-700 uppercase tracking-widest text-[10px]">Filière concernée</label>
          <div className="relative">
            <select 
              value={filiereId} 
              onChange={(e) => setFiliereId(e.target.value)}
              className="w-full pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm appearance-none cursor-pointer"
              required
            >
              <option value="">Sélectionnez une filière</option>
              {filieres.map(f => <option key={f.id} value={f.id.toString()}>[{f.code}] {f.name}</option>)}
            </select>
            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 rotate-90 pointer-events-none" />
          </div>
        </div>
      </div>
      
      <div className="pt-6 flex gap-4 border-t border-slate-100">
        <Button variant="ghost" onClick={onComplete} className="flex-1 h-12 text-slate-400 hover:text-slate-600">Annuler</Button>
        <Button type="submit" disabled={loading} className="flex-[2] h-12 shadow-lg shadow-indigo-100">
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Traitement...
            </div>
          ) : initialData ? 'Enregistrer les modifications' : 'Créer le nouveau module'}
        </Button>
      </div>
    </form>
  );
};
