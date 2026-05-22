import React, { useState } from 'react';
import { FileUp, Download, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { cn } from '../../lib/utils';

interface BulkImportStudentsProps {
  filiereId: number;
  groupId: number;
  groupName: string;
  onSuccess: () => void;
}

export const BulkImportStudents = ({ filiereId, groupId, groupName, onSuccess }: BulkImportStudentsProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState<{ success: number, failed: number, errors: string[] } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const downloadTemplate = () => {
    const csvContent = "email,displayName,password\nstudent1@example.com,Jean Dupont,Password123\nstudent2@example.com,Marie Curie,Password123";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "template_eleves.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    setResults(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const students = lines.slice(1)
        .filter(line => line.trim() !== '')
        .map(line => {
          const values = line.split(',').map(v => v.trim());
          const student: any = { 
            filiereId, 
            groupId, 
            groupName 
          };
          headers.forEach((header, index) => {
            student[header] = values[index];
          });
          return student;
        });

      try {
        const res = await api.students.bulkImport(students);
        setResults(res);
        if (res.success > 0) {
          onSuccess();
        }
      } catch (err) {
        console.error("Bulk import failed:", err);
        alert("L'importation a échoué. Vérifiez le format du fichier.");
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <Card className="p-6 border-2 border-slate-100 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <FileUp className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900">Importation Groupée</h4>
            <p className="text-xs text-slate-500">Ajoutez plusieurs étudiants via CSV</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={downloadTemplate} className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
          <Download className="w-3.5 h-3.5 mr-2" /> Template
        </Button>
      </div>

      {!results ? (
        <div className="space-y-4">
          <div className={cn(
            "border-2 border-dashed rounded-3xl p-8 text-center transition-all",
            file ? "border-indigo-200 bg-indigo-50/30" : "border-slate-100 hover:border-slate-200"
          )}>
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileChange} 
              className="hidden" 
              id="csv-upload" 
            />
            <label htmlFor="csv-upload" className="cursor-pointer space-y-3 block">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-400">
                <FileUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-600">{file ? file.name : "Cliquez pour choisir un fichier CSV"}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Format: email, displayName, password</p>
              </div>
            </label>
          </div>

          <Button 
            className="w-full py-6 rounded-[1.5rem]" 
            disabled={!file || isImporting} 
            onClick={handleImport}
          >
            {isImporting ? "Importation..." : "Lancer l'importation"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
             <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex flex-col items-center gap-1">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span className="text-xl font-black text-emerald-600">{results.success}</span>
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Succès</span>
             </div>
             <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex flex-col items-center gap-1">
                <XCircle className="w-5 h-5 text-rose-600" />
                <span className="text-xl font-black text-rose-600">{results.failed}</span>
                <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest">Échecs</span>
             </div>
          </div>

          {results.errors.length > 0 && (
            <div className="p-4 bg-slate-50 rounded-2xl space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Erreurs rencontrées</p>
              {results.errors.map((err, i) => (
                <div key={i} className="text-[11px] text-rose-600 flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}

          <Button variant="ghost" className="w-full" onClick={() => { setResults(null); setFile(null); }}>
             Réessayer
          </Button>
        </div>
      )}
    </Card>
  );
};
