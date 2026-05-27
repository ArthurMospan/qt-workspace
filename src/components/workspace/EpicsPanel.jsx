'use client';
import { useState } from 'react';
import { Plus, X, Zap } from 'lucide-react';

export default function EpicsPanel({
  issue,
  epics = [],
  allIssues = [],
  onUpdateEpic,
  onCreateEpic,
  loading = false
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newEpicTitle, setNewEpicTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const parentEpic = issue.parentEpicId
    ? epics.find(e => e.id === issue.parentEpicId) || allIssues.find(e => e.id === issue.parentEpicId)
    : null;

  const handleCreateEpic = async () => {
    if (!newEpicTitle.trim()) return;
    try {
      setCreating(true);
      await onCreateEpic(newEpicTitle.trim());
      setNewEpicTitle('');
      setShowCreate(false);
    } catch (err) {
      console.error('Error creating epic:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleSelectEpic = (epicId) => {
    onUpdateEpic(issue.id, epicId);
  };

  const handleRemoveEpic = () => {
    onUpdateEpic(issue.id, null);
  };

  return (
    <div className="flex flex-col gap-[12px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider">
          <Zap size={12} className="inline mr-[4px]" />
          Епік
        </h3>
        {!parentEpic && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="p-[4px] text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f0f0f0] rounded-[6px] transition-colors"
            title="Прив'язати до епіка"
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {/* Current Epic */}
      {parentEpic && (
        <div className="flex items-center justify-between p-[12px] bg-[#8b5cf6]/10 border border-[#8b5cf6]/30 rounded-[12px]">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-[#8b5cf6]">ЕПІК</p>
            <p className="text-[12px] font-bold text-[#1f1f1f] truncate">
              {parentEpic.title}
            </p>
            {parentEpic.issueKey && (
              <code className="text-[10px] text-[#9a9a9a]">
                {parentEpic.issueKey}
              </code>
            )}
          </div>
          <button
            onClick={handleRemoveEpic}
            className="p-[4px] ml-[8px] text-[#9a9a9a] hover:text-red-500 transition-colors shrink-0"
            title="Видалити"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* No Epic */}
      {!parentEpic && !showCreate && (
        <p className="text-[11px] text-[#cfcfcf]">Не прив'язана до епіка</p>
      )}

      {/* Create/Select Form */}
      {!parentEpic && showCreate && (
        <div className="flex flex-col gap-[8px] p-[12px] bg-[#f7f7f7] rounded-[12px] border border-[#e9e9e9]">
          <div>
            <label className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider block mb-[4px]">
              Новий епік
            </label>
            <input
              type="text"
              value={newEpicTitle}
              onChange={e => setNewEpicTitle(e.target.value)}
              placeholder="Назва епіка..."
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateEpic();
                if (e.key === 'Escape') setShowCreate(false);
              }}
              className="w-full px-[8px] py-[6px] bg-white border border-[#e9e9e9] rounded-[8px] text-[12px] text-[#1f1f1f] focus:border-[#1f1f1f]"
              autoFocus
            />
          </div>

          {/* Existing epics to choose from */}
          {epics.length > 0 && (
            <div>
              <label className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider block mb-[4px]">
                Або оберіть існуючий
              </label>
              <div className="flex flex-col gap-[4px] max-h-[150px] overflow-y-auto">
                {epics.map(epic => (
                  <button
                    key={epic.id}
                    onClick={() => handleSelectEpic(epic.id)}
                    className="flex items-start gap-[8px] p-[8px] text-left bg-white border border-[#e9e9e9] rounded-[8px] hover:border-[#1f1f1f] transition-colors"
                  >
                    <Zap size={12} className="text-[#8b5cf6] mt-[2px] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-[#1f1f1f] truncate">
                        {epic.title}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-[8px]">
            <button
              onClick={() => { setShowCreate(false); setNewEpicTitle(''); }}
              className="flex-1 px-[12px] py-[6px] text-[11px] font-bold text-[#9a9a9a] bg-white border border-[#e9e9e9] rounded-[8px] hover:bg-[#f0f0f0] transition-colors"
            >
              Скасувати
            </button>
            <button
              onClick={handleCreateEpic}
              disabled={!newEpicTitle.trim() || creating}
              className="flex-1 px-[12px] py-[6px] text-[11px] font-bold text-white bg-[#8b5cf6] rounded-[8px] hover:bg-[#7c3aed] disabled:opacity-40 transition-colors"
            >
              {creating ? '...' : 'Створити'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
