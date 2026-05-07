import React, { useState, useEffect } from 'react';
import { Mail, Lock, User, GraduationCap, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { Filiere, Group, UserProfile, UserRole } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';

interface AuthViewProps {
  onLogin: (user: UserProfile) => void;
}

export const AuthView = ({ onLogin }: AuthViewProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [filiereId, setFiliereId] = useState<string>('');
  const [groupId, setGroupId] = useState<string>('');
  const [filieres, setFilieres] = useState<Filiere[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [role, setRole] = useState<UserRole>('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLogin) {
      const fetchLists = async () => {
        try {
          const [f, g] = await Promise.all([api.filieres.list(), api.groups.list()]);
          setFilieres(f);
          setGroups(g);
        } catch (err) {
          console.error("Error fetching lists:", err);
        }
      };
      fetchLists();
    }
  }, [isLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        const { user } = await api.auth.login({ email, password });
        onLogin(user);
      } else {
        const fId = filiereId === '' ? undefined : Number(filiereId);
        const gId = groupId === '' ? undefined : Number(groupId);
        const { user } = await api.auth.signup({ 
          email, 
          password, 
          displayName, 
          role,
          filiereId: role === 'student' ? fId : undefined,
          groupId: role === 'student' ? gId : undefined,
          filiere: role === 'student' ? filieres.find(f => f.id === fId)?.name : undefined,
          groupName: role === 'student' ? groups.find(g => g.id === gId)?.name : undefined
        });
        onLogin(user);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-md w-full p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="bg-indigo-600 w-16 h-16 rounded-[1.25rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-200 rotate-3 hover:rotate-0 transition-transform duration-500 group cursor-default">
            <GraduationCap className="text-white w-10 h-10 group-hover:scale-110 transition-transform" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {isLogin ? 'Connexion à EduQCM' : 'Créer un compte'}
          </h1>
          <p className="text-slate-500 text-sm">
            {isLogin ? 'Accédez à votre espace personnel' : 'Rejoignez la plateforme EduQCM'}
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <Input 
                label="Nom complet" 
                value={displayName} 
                onChange={(e) => setDisplayName(e.target.value)} 
                required 
                icon={User} 
              />
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Rôle</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('student')}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium border transition-all",
                      role === 'student' ? "bg-indigo-50 border-indigo-600 text-indigo-600" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    Étudiant
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('teacher')}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium border transition-all",
                      role === 'teacher' ? "bg-indigo-50 border-indigo-600 text-indigo-600" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    Enseignant
                  </button>
                </div>
              </div>
              {role === 'student' && (
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Filière</label>
                    <select 
                      value={filiereId} 
                      onChange={(e) => {
                        setFiliereId(e.target.value);
                        setGroupId('');
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                      required
                    >
                      <option value="">Sélectionnez une filière</option>
                      {filieres.map(f => <option key={f.id} value={f.id.toString()}>[{f.code}] {f.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Groupe</label>
                    <select 
                      value={groupId} 
                      onChange={(e) => setGroupId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                      required
                      disabled={!filiereId}
                    >
                      <option value="">Sélectionnez un groupe</option>
                      {groups.filter(g => g.filiereId === Number(filiereId)).map(g => <option key={g.id} value={g.id.toString()}>{g.name}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </>
          )}
          <Input 
            label="Email" 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            icon={Mail} 
          />
          <Input 
            label="Mot de passe" 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
            icon={Lock} 
          />
          
          <Button type="submit" disabled={loading} className="w-full py-2.5">
            {loading ? 'Chargement...' : isLogin ? 'Se connecter' : 'S\'inscrire'}
          </Button>
        </form>

        <div className="text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-indigo-600 hover:underline font-medium"
          >
            {isLogin ? "Pas encore de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
          </button>
        </div>
      </Card>
    </div>
  );
};
