import React, { useState } from 'react';
import { Group, Exam } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Users, Info } from 'lucide-react';

interface ActivateExamModalProps {
  exam: Exam;
  groups: Group[];
  onConfirm: (groupId: number) => void;
  onClose: () => void;
}

export const ActivateExamModal = ({ exam, groups, onConfirm, onClose }: ActivateExamModalProps) => {
  const [selectedGroupId, setSelectedGroupId] = useState<number | ''>(exam.groupId || '');

  return (
    <Modal title="Activer l'examen" onClose={onClose}>
      <div className="p-5 sm:p-8 space-y-6">
        <div className="flex gap-4 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
          <Info className="w-6 h-6 text-indigo-600 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-indigo-900">Activation par groupe</p>
            <p className="text-xs text-indigo-600/80 leading-relaxed">
              En activant cet examen pour un groupe spécifique, seuls les étudiants appartenant à ce groupe pourront le voir et le passer.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Sélectionnez le groupe cible</label>
          <div className="grid grid-cols-1 gap-3">
            {groups.map((group) => (
              <button
                key={group.id}
                onClick={() => setSelectedGroupId(group.id)}
                className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all group ${
                  selectedGroupId === group.id
                    ? 'border-indigo-600 bg-indigo-50/50'
                    : 'border-slate-100 hover:border-indigo-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    selectedGroupId === group.id ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'
                  }`}>
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className={`font-bold text-sm ${selectedGroupId === group.id ? 'text-indigo-600' : 'text-slate-700'}`}>
                      {group.name}
                    </p>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                      Groupe ID: {group.id}
                    </p>
                  </div>
                </div>
                {selectedGroupId === group.id && (
                  <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onClose} className="flex-1">Annuler</Button>
          <Button 
            onClick={() => selectedGroupId && onConfirm(Number(selectedGroupId))} 
            disabled={!selectedGroupId}
            className="flex-1"
          >
            Activer maintenant
          </Button>
        </div>
      </div>
    </Modal>
  );
};
