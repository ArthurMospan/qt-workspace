'use client';
import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import useWorkspaceStore from '@/store/useWorkspaceStore';

export const DEFAULT_COLUMNS = [
  { id: 'todo',         label: 'To Do',       color: '#6366f1' },
  { id: 'in-progress',  label: 'In Progress', color: '#0891b2' },
  { id: 'done',         label: 'Done',        color: '#10b981' },
];

export default function BoardConfigModal({ project, onClose }) {
  const showToast = useWorkspaceStore(s => s.showToast);
  
  // Initialize with existing config or defaults
  const [columns, setColumns] = useState(
    project?.boardColumns?.length ? project.boardColumns : DEFAULT_COLUMNS
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    // Validate: need at least 1 column
    if (columns.length === 0) {
      showToast('Додайте хоча б одну колонку', 'error');
      return;
    }
    // Validate: no empty names
    if (columns.some(c => !c.label.trim())) {
      showToast('Назви колонок не можуть бути порожніми', 'error');
      return;
    }

    setSaving(true);
    try {
      const updates = {
        boardColumns: columns,
        updatedAt: serverTimestamp(),
      };
      if (auth.currentUser?.uid) {
        updates.team = arrayUnion(auth.currentUser.uid);
      }
      await updateDoc(doc(db, 'projects', project.id), updates);
      showToast('Колонки успішно оновлено ✓');
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

  const addColumn = () => {
    const newId = 'col_' + Math.random().toString(36).substr(2, 9);
    setColumns([...columns, { id: newId, label: 'Нова колонка', color: '#9a9a9a' }]);
  };

  const removeColumn = (id) => {
    setColumns(columns.filter(c => c.id !== id));
  };

  const updateColumn = (id, field, value) => {
    setColumns(columns.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-[480px] overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e9e9e9]">
          <h2 className="text-[16px] font-bold text-[#1f1f1f]">Налаштування проєкту</h2>
          <button onClick={onClose} className="p-2 text-[#9a9a9a] hover:text-[#1f1f1f] bg-[#f7f7f7] hover:bg-[#e9e9e9] rounded-full transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          


          <div>
            <h3 className="text-[14px] font-bold text-[#1f1f1f] mb-2">Колонки дошки</h3>
            <p className="text-[13px] text-[#9a9a9a] mb-4">
              Налаштуйте статуси для цього проєкту. Видалення колонки не видаляє задачі.
            </p>

            <div className="flex flex-col gap-3">
              {columns.map((col, idx) => (
                <div key={col.id} className="flex items-center gap-3 bg-[#f7f7f7] border border-[#e9e9e9] rounded-[12px] p-2">
                  <div className="flex items-center justify-center w-6 h-6 text-[#9a9a9a] text-[10px] font-bold">
                    {idx + 1}
                  </div>
                  
                  <input
                    type="color"
                    value={col.color}
                    onChange={(e) => updateColumn(col.id, 'color', e.target.value)}
                    className="w-8 h-8 p-0 border-0 rounded cursor-pointer overflow-hidden shrink-0"
                  />
                  
                  <input
                    type="text"
                    value={col.label}
                    onChange={(e) => updateColumn(col.id, 'label', e.target.value)}
                    placeholder="Назва колонки"
                    className="flex-1 bg-white border border-[#e9e9e9] rounded-[6px] px-3 py-[6px] text-[13px] font-medium outline-none focus:border-[#1f1f1f]"
                  />

                  <button 
                    onClick={() => removeColumn(col.id)}
                    className="p-2 text-[#cfcfcf] hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addColumn}
              className="mt-4 flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-[#e9e9e9] rounded-[12px] text-[13px] font-bold text-[#9a9a9a] hover:border-[#cfcfcf] hover:text-[#1f1f1f] transition-all"
            >
              <Plus size={16} /> Додати колонку
            </button>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#e9e9e9] flex justify-end gap-3 bg-[#f7f7f7]">
          <button onClick={onClose} className="px-4 py-2 text-[13px] font-bold text-[#9a9a9a] hover:text-[#1f1f1f]">
            Скасувати
          </button>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="px-6 py-2 bg-[#1f1f1f] text-white text-[13px] font-bold rounded-[8px] hover:bg-[#2a2a2a] disabled:opacity-50"
          >
            {saving ? 'Збереження...' : 'Зберегти зміни'}
          </button>
        </div>

      </div>
    </div>
  );
}
