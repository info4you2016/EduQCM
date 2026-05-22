import React, { useState } from 'react';
import { User, Lock, Save, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { UserProfile } from '../../types';
import { api } from '../../lib/api';

interface ProfileModalProps {
  user: UserProfile;
  onClose: () => void;
  onUpdate: (user: UserProfile) => void;
}

export const ProfileModal = ({ user, onClose, onUpdate }: ProfileModalProps) => {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [registrationNumber, setRegistrationNumber] = useState(user.registrationNumber || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password && password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const data: any = { displayName, registrationNumber };
      if (password) data.password = password;
      
      const res = await api.auth.update(data);
      onUpdate(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || "Erreur lors de la mise à jour du profil.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Mon Profil" onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-5 sm:p-8 space-y-6">
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-xs font-bold">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <Input 
            label="Nom complet" 
            value={displayName} 
            onChange={(e) => setDisplayName(e.target.value)} 
            icon={User}
            required
          />

          <Input 
            label="Numéro d'inscription (CEF)" 
            value={registrationNumber} 
            onChange={(e) => setRegistrationNumber(e.target.value)} 
            icon={User}
            placeholder="Ex: 2425..."
          />
          
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Changer le mot de passe</p>
            <Input 
              label="Nouveau mot de passe" 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              icon={Lock}
              placeholder="Laisser vide pour ne pas changer"
            />
            <Input 
              label="Confirmer le mot de passe" 
              type="password" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              icon={Lock}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Annuler</Button>
          <Button type="submit" disabled={loading} className="flex-1 gap-2">
            <Save className="w-4 h-4" /> {loading ? 'Mise à jour...' : 'Enregistrer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
