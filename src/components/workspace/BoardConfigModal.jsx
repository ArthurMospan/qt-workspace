'use client';
import { useState } from 'react';
import { X, EyeOff, Eye } from 'lucide-react';
import { doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import Button from '@/components/ui/Button';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';

export default function BoardConfigModal({ project, onClose }) {
  const showToast = useWorkspaceStore(s => s.showToast);
  const { statuses, loading } = useWorkflowConfig();
  
  // Initialize with existing hidden columns
  const [hiddenColumns, setHiddenColumns] = useState(
    project?.hiddenColumns || []
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    // Validate: At least one column must be visible
    if (statuses.length > 0 && hiddenColumns.length === statuses.length) {
      showToast('Дошка повинна мати хоча б одну видиму колонку', 'error');
      return;
    }

    setSaving(true);
    try {
      const updates = {
        hiddenColumns,
        updatedAt: serverTimestamp(),
      };
      if (auth.currentUser?.uid) {
        updates.team = arrayUnion(auth.currentUser.uid);
      }
      await updateDoc(doc(db, 'projects', project.id), updates);
      showToast('Налаштування дошки збережено ✓');
      // Small delay to ensure Firestore sync before closing
      setTimeout(() => {
        setSaving(false);
        onClose();
      }, 300);
    } catch (err) {
      console.error(err);
      showToast('Помилка збереження', 'error');
      setSaving(false);
    }
  };

  const toggleColumn = (id) => {
    setHiddenColumns(prev => 
      prev.includes(id) ? prev.filter(colId => colId !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-[480px] overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e9e9e9]">
          <h2 className="text-[16px] font-bold text-[#1f1f1f]">Налаштування дошки проєкту</h2>
          <Button style="secondary" size="icon" icon={X} onClick={onClose}>
            Закрити
          </Button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          <div>
            <h3 className="text-[14px] font-bold text-[#1f1f1f] mb-2">Видимість колонок</h3>
            <p className="text-[13px] text-[#9a9a9a] mb-4">
              Оберіть, які з глобальних статусів повинні відображатись як колонки на дошці цього проєкту. 
              Приховані колонки та задачі в них не будуть видимі на цій дошці.
            </p>

            {loading ? (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {statuses.map((status) => {
                  const isHidden = hiddenColumns.includes(status.id);
                  return (
                    <div 
                      key={status.id} 
                      onClick={() => toggleColumn(status.id)}
                      className={`flex items-center justify-between border rounded-[12px] p-3 cursor-pointer transition-colors ${
                        isHidden ? 'bg-[#f4f4f5] border-[#e9e9e9] opacity-60' : 'bg-white border-[#cfcfcf] hover:border-[#1f1f1f]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full" style={{ background: status.color }} />
                        <span className={`text-[14px] font-semibold ${isHidden ? 'text-[#9a9a9a]' : 'text-[#1f1f1f]'}`}>
                          {status.emoji} {status.label}
                        </span>
                      </div>
                      <div className="text-[#9a9a9a]">
                        {isHidden ? <EyeOff size={18} /> : <Eye size={18} className="text-[#10b981]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#e9e9e9] flex justify-end gap-3 bg-[#f4f4f5]">
          <Button style="secondary" size="md" onClick={onClose}>
            Скасувати
          </Button>
          <Button 
            style="primary"
            size="md"
            onClick={handleSave} 
            disabled={saving || loading}
            loading={saving}
          >
            {saving ? 'Збереження...' : 'Зберегти зміни'}
          </Button>
        </div>

      </div>
    </div>
  );
}
