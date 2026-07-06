'use client';
import { useState } from 'react';
import { Plus, X, Zap } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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
        <h3 className="text-[11px] font-bold text-muted uppercase tracking-wider">
          <Zap size={12} className="inline mr-[4px]" />
          Епік
        </h3>
        {!parentEpic && (
          <Button style="secondary" size="icon" icon={Plus} onClick={() => setShowCreate(!showCreate)} />
        )}
      </div>

      {/* Current Epic */}
      {parentEpic && (
        <div className="flex items-center justify-between p-[12px] bg-[#8b5cf6]/10 border border-[#8b5cf6]/30 rounded-[12px]">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-[#8b5cf6]">ЕПІК</p>
            <p className="text-[12px] font-bold text-ink truncate">
              {parentEpic.title}
            </p>
            {parentEpic.issueKey && (
              <code className="text-[10px] text-muted">
                {parentEpic.issueKey}
              </code>
            )}
          </div>
          <Button style="secondary" color="red" size="icon" icon={X} onClick={handleRemoveEpic} className="ml-[8px]" />
        </div>
      )}

      {/* No Epic */}
      {!parentEpic && !showCreate && (
        <p className="text-[11px] text-faint">Не прив’язана до епіка</p>
      )}

      {/* Create/Select Form */}
      {!parentEpic && showCreate && (
        <div className="flex flex-col gap-[8px] p-[12px] bg-canvas rounded-[12px] border border-line">
          <div>
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-[4px]">
              Новий епік
            </label>
            <Input
              value={newEpicTitle}
              onChange={e => setNewEpicTitle(e.target.value)}
              placeholder="Назва епіка..."
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateEpic();
                if (e.key === 'Escape') setShowCreate(false);
              }}
              autoFocus
            />
          </div>

          {/* Existing epics to choose from */}
          {epics.length > 0 && (
            <div>
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-[4px]">
                Або оберіть існуючий
              </label>
              <div className="flex flex-col gap-[4px] max-h-[150px] overflow-y-auto">
                {epics.map(epic => (
                  <button
                    key={epic.id}
                    onClick={() => handleSelectEpic(epic.id)}
                    className="flex items-start gap-[8px] p-[8px] text-left bg-white border border-line rounded-[8px] hover:border-ink transition-colors"
                  >
                    <Zap size={12} className="text-[#8b5cf6] mt-[2px] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-ink truncate">
                        {epic.title}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-[8px]">
            <Button style="secondary" size="md" onClick={() => { setShowCreate(false); setNewEpicTitle(''); }} className="flex-1">
              Скасувати
            </Button>
            <Button style="primary" size="md" disabled={!newEpicTitle.trim() || creating} loading={creating} onClick={handleCreateEpic} className="flex-1">
              Створити
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
