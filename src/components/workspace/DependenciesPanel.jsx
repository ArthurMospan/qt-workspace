'use client';
import { useState } from 'react';
import { Link2, Plus, Trash2, AlertCircle } from 'lucide-react';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import useWorkspaceStore from '@/store/useWorkspaceStore';

const LINK_TYPES = [
  { value: 'blocks', label: 'блокує', color: '#dc2626' },
  { value: 'is-blocked-by', label: 'заблокована', color: '#f97316' },
  { value: 'duplicates', label: 'дублікат', color: '#a855f7' },
  { value: 'relates-to', label: 'пов\'язана з', color: '#0891b2' },
];

export default function DependenciesPanel({
  issue,
  links = [],
  onAddLink,
  onRemoveLink,
  allIssues = [],
  loading
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [linkType, setLinkType] = useState('relates-to');
  const [searchQuery, setSearchQuery] = useState('');

  const { showToast } = useWorkspaceStore();
  const { doneStatusIds } = useWorkflowConfig();

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const searchResults = normalizedSearch
    ? allIssues.filter(candidate => candidate.id !== issue.id && (
        (candidate.issueKey || '').toLowerCase().includes(normalizedSearch) ||
        (candidate.title || '').toLowerCase().includes(normalizedSearch)
      )).slice(0, 5)
    : [];

  const handleAddLink = async (targetIssue) => {
    if (targetIssue.id === issue.id) return; // Don't link to self
    try {
      await onAddLink(issue.id, targetIssue.id, linkType);
      setSearchQuery('');
      setShowAddForm(false);
      showToast('Залежність успішно додано');
    } catch (err) {
      console.error('Error adding link:', err);
      showToast(err.message || 'Помилка додавання', 'error');
    }
  };

  // Get unique link targets (avoid showing same issue twice)
  const uniqueLinks = Array.from(
    new Map(links.map(l => [
      l.sourceIssueId === issue.id ? l.targetIssueId : l.sourceIssueId,
      l
    ])).values()
  );

  const hasBlocker = links.some(l =>
    l.relationType === 'blocks' &&
    l.targetIssueId === issue.id &&
    allIssues.find(i => i.id === l.sourceIssueId && !doneStatusIds.includes(i.columnId || i.status))
  );

  return (
    <div className="flex flex-col gap-[12px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold text-muted uppercase tracking-wider">
          <Link2 size={12} className="inline mr-[4px]" />
          Залежності
        </h3>
        <Button style="secondary" size="icon" icon={Plus} onClick={() => setShowAddForm(!showAddForm)} title="Додати залежність" />
      </div>

      {/* Blocker Warning */}
      {hasBlocker && (
        <div className="flex items-start gap-[8px] px-[12px] py-[8px] bg-red-50 border border-red-200 rounded-[12px]">
          <AlertCircle size={14} className="text-red-500 mt-[2px] shrink-0" />
          <p className="text-[11px] text-red-700 font-medium">
            Ця завдання заблокована і не може бути закрита
          </p>
        </div>
      )}

      {/* Add Link Form */}
      {showAddForm && (
        <div className="flex flex-col gap-[8px] p-[12px] bg-canvas rounded-[12px] border border-line">
          <div>
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-[4px]">
              Тип зв’язку
            </label>
            <select
              value={linkType}
              onChange={e => setLinkType(e.target.value)}
              className="w-full px-[8px] py-[6px] bg-white border border-line rounded-[8px] text-[12px] text-ink focus:border-ink"
            >
              {LINK_TYPES.map(t => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-[4px]">
              Пошук завдання
            </label>
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ID або назва..."
            />
          </div>

          {/* Search Results */}
          {searchQuery && searchResults.length > 0 && (
            <div className="flex flex-col gap-[4px] max-h-[200px] overflow-y-auto">
              {searchResults.slice(0, 5).map(result => (
                <button
                  key={result.id}
                  onClick={() => handleAddLink(result)}
                  className="flex items-start gap-[8px] p-[8px] text-left bg-white border border-line rounded-[8px] hover:border-ink transition-colors"
                >
                  <code className="text-[10px] font-bold text-muted mt-[1px] shrink-0">
                    {result.issueKey || 'ID'}
                  </code>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-ink truncate">
                      {result.title}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-[8px]">
            <Button style="secondary" size="md" onClick={() => { setShowAddForm(false); setSearchQuery(''); }} className="w-full">
              Скасувати
            </Button>
          </div>
        </div>
      )}

      {/* Links List */}
      {uniqueLinks.length === 0 && !showAddForm ? (
        <p className="text-[11px] text-faint">Немає залежностей</p>
      ) : (
        <div className="flex flex-col gap-[6px]">
          {uniqueLinks.map(link => {
            const linkCfg = LINK_TYPES.find(t => t.value === link.relationType);
            const isSource = link.sourceIssueId === issue.id;
            const targetId = isSource ? link.targetIssueId : link.sourceIssueId;
            const targetIssue = allIssues.find(i => i.id === targetId);

            return (
              <div
                key={link.id}
                className="flex items-center gap-[8px] p-[8px] bg-canvas border border-line rounded-[8px]"
              >
                <span
                  className="text-[10px] font-bold px-[6px] py-[2px] rounded-[6px] shrink-0 whitespace-nowrap"
                  style={{ color: linkCfg?.color, backgroundColor: linkCfg?.color + '18' }}
                >
                  {linkCfg?.label || link.relationType}
                </span>

                {targetIssue ? (
                  <div className="flex-1 min-w-0">
                    <code className="text-[10px] font-bold text-muted">
                      {targetIssue.issueKey || 'ID'}
                    </code>
                    <p className="text-[11px] text-ink truncate">
                      {targetIssue.title}
                    </p>
                  </div>
                ) : (
                  <p className="text-[10px] text-faint">Задачу видалено</p>
                )}

                <Button style="secondary" color="red" size="icon" icon={Trash2} onClick={() => onRemoveLink(link.id)} title="Видалити" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
