import React, { useState, useEffect } from 'react';
import { Mail, Lock, User, GraduationCap, AlertCircle, KeyRound, CheckCircle, ArrowLeft } from 'lucide-react';
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
  const [view, setView] = useState<'login' | 'signup' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [filiereId, setFiliereId] = useState<string>('');
  const [groupId, setGroupId] = useState<string>('');
  const [filieres, setFilieres] = useState<Filiere[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [role, setRole] = useState<UserRole>('student');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [demoToken, setDemoToken] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (view === 'signup') {
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
  }, [view]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);
    try {
      if (view === 'login') {
        const { user } = await api.auth.login({ email, password });
        onLogin(user);
      } else if (view === 'signup') {
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
      } else if (view === 'forgot') {
        const res = await api.auth.forgotPassword(email);
        setSuccessMessage("Un code de vérification temporaire a été généré avec succès.");
        if (res && res.resetToken) {
          setDemoToken(res.resetToken);
        }
        setView('reset');
      } else if (view === 'reset') {
        if (password !== confirmPassword) {
          throw new Error("Les deux mots de passe ne correspondent pas.");
        }
        const res = await api.auth.resetPassword({ email, token: resetToken, newPassword: password });
        setSuccessMessage(res.message || "Votre mot de passe a été modifié avec succès !");
        setResetToken('');
        setPassword('');
        setConfirmPassword('');
        setDemoToken('');
        setView('login');
      }
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  const getHeaderInfo = () => {
    switch (view) {
      case 'login':
        return {
          title: "Connexion à EduQCM",
          subtitle: "Accédez à votre espace individuel"
        };
      case 'signup':
        return {
          title: "Créer un compte",
          subtitle: "Rejoignez la plateforme EduQCM"
        };
      case 'forgot':
        return {
          title: "Mot de passe oublié ?",
          subtitle: "Entrez votre email pour demander une réinitialisation"
        };
      case 'reset':
        return {
          title: "Nouveau mot de passe",
          subtitle: "Veuillez saisir votre code à 6 chiffres et le nouveau mot de passe"
        };
    }
  };

  const header = getHeaderInfo();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-md w-full p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="bg-indigo-600 w-16 h-16 rounded-[1.25rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-200 rotate-3 hover:rotate-0 transition-transform duration-500 group cursor-default">
            <GraduationCap className="text-white w-10 h-10 group-hover:scale-110 transition-transform" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {header.title}
          </h1>
          <p className="text-slate-500 text-sm">
            {header.subtitle}
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm flex items-center gap-2 border border-rose-100">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 rounded-lg text-sm flex flex-col gap-1">
            <div className="flex items-center gap-2 font-semibold text-emerald-900">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Succès</span>
            </div>
            <p className="text-emerald-700 text-xs">{successMessage}</p>
          </div>
        )}

        {demoToken && (
          <div className="bg-indigo-50 border border-indigo-200 p-3.5 rounded-lg text-xs text-indigo-900 space-y-1">
            <p className="font-semibold flex items-center gap-1.5 text-indigo-700">
              <KeyRound className="w-3.5 h-3.5" />
              Simulation d'Envoi de Mail
            </p>
            <p className="text-slate-600">Pour l'environnement de démo, voici le code reçu par courriel :</p>
            <div className="mt-1.5 flex items-center justify-between bg-white px-3 py-1.5 rounded border border-indigo-100 font-mono text-sm tracking-wider font-bold text-center text-indigo-600 select-all">
              <span>{demoToken}</span>
              <span className="text-[9px] font-normal text-slate-400 font-sans">Double-cliquez pour copier</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {view === 'signup' && (
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

          {/* Email input is displayed for Login, Signup, Forgot views, and as disabled for Reset view */}
          <Input 
            label="Email" 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            icon={Mail} 
            disabled={view === 'reset'}
          />

          {view === 'reset' && (
            <Input 
              label="Code de réinitialisation" 
              type="text" 
              placeholder="Ex: 574312"
              value={resetToken} 
              onChange={(e) => setResetToken(e.target.value)} 
              required 
              maxLength={6}
              icon={KeyRound} 
            />
          )}

          {/* Password input is displayed for Login, Signup, and Reset views */}
          {view !== 'forgot' && (
            <Input 
              label={view === 'reset' ? "Nouveau mot de passe" : "Mot de passe"} 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              icon={Lock} 
            />
          )}

          {view === 'reset' && (
            <Input 
              label="Confirmer le nouveau mot de passe" 
              type="password" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              required 
              icon={Lock} 
            />
          )}

          {/* Forgot Password link displayed only during Login */}
          {view === 'login' && (
            <div className="flex justify-end pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setSuccessMessage('');
                  setView('forgot');
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-medium transition-colors focus:outline-none"
              >
                Mot de passe oublié ?
              </button>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full py-2.5 mt-2">
            {loading ? 'Chargement...' : 
             view === 'login' ? 'Se connecter' : 
             view === 'signup' ? "S'inscrire" : 
             view === 'forgot' ? 'Obtenir le code de réinitialisation' : 
             'Définir le nouveau mot de passe'}
          </Button>
        </form>

        <div className="text-center pt-2 border-t border-slate-100 flex flex-col gap-3 items-center justify-center">
          {view === 'login' && (
            <button 
              type="button"
              onClick={() => {
                setError('');
                setSuccessMessage('');
                setView('signup');
              }}
              className="text-sm text-indigo-600 hover:underline font-medium transition-all"
            >
              Pas encore de compte ? S'inscrire
            </button>
          )}

          {view === 'signup' && (
            <button 
              type="button"
              onClick={() => {
                setError('');
                setSuccessMessage('');
                setView('login');
              }}
              className="text-sm text-indigo-600 hover:underline font-medium transition-all"
            >
              Déjà un compte ? Se connecter
            </button>
          )}

          {(view === 'forgot' || view === 'reset') && (
            <button 
              type="button"
              onClick={() => {
                setError('');
                setSuccessMessage('');
                setDemoToken('');
                setView('login');
              }}
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors font-medium focus:outline-none"
            >
              <ArrowLeft className="w-4 h-4 text-slate-400" />
              Retour à la connexion
            </button>
          )}
        </div>
      </Card>
    </div>
  );
};
