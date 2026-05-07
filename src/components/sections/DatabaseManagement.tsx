import React, { useState, useRef } from 'react';
import { Database, Download, Upload } from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

export const DatabaseManagement = () => {
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBackup = () => {
    window.location.href = api.admin.backup();
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm("Êtes-vous sûr de vouloir restaurer la base de données ? Les données actuelles seront remplacées.")) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsRestoring(true);
    try {
      await api.admin.restore(file);
      alert("Base de données restaurée avec succès. La page va s'actualiser.");
      window.location.reload();
    } catch (error) {
      console.error("Restore failed:", error);
      alert("Échec de la restauration.");
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <h3 className="text-xl font-black text-slate-900 tracking-tight">Système</h3>
        <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
          <Database className="w-4 h-4 text-slate-300" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4">
        <Card className="p-5 border-2 border-slate-50 hover:bg-slate-50 transition-colors">
          <div className="flex flex-col gap-4">
            <div>
              <h4 className="font-black text-slate-900 text-sm mb-1 uppercase tracking-tight">Base de données</h4>
              <p className="text-xs text-slate-500 leading-relaxed">Gérez la sauvegarde et la restauration de vos données.</p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleBackup}
                variant="outline"
                className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50"
              >
                <Download className="w-3 h-3 mr-2" /> Sauvegarder
              </Button>
              <Button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isRestoring}
                className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest"
              >
                {isRestoring ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Upload className="w-3 h-3 mr-2" /> Restaurer
                  </>
                )}
              </Button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleRestore} 
                className="hidden" 
                accept=".db"
              />
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
};
