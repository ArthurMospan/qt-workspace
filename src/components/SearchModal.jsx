'use client';
import { useRouter } from 'next/navigation';
import { X, AlertOctagon, ArrowUp, Minus, ArrowDown, Zap, Bug, Star, CheckSquare } from 'lucide-react';

const PRIORITY_CFG = {
  blocker: { c: '#dc2626', i: AlertOctagon },
  high: { c: '#f97316', i: ArrowUp },
  medium: { c: '#eab308', i: Minus },
  low: { c: '#9a9a9a', i: ArrowDown }
};

const TYPE_CFG = {
  epic: { c: '#8b5cf6', i: Zap },
  feature: { c: '#0891b2', i: Star },
  task: { c: '#059669', i: CheckSquare },
  bug: { c: '#dc2626', i: Bug }
};

export default function SearchModal({ isOpen, results, loading, query, onClose, projects }) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleResultClick = (issueId, projectId) => {
    router.push(`/workspace/${projectId}/issue/${issueId}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/20 backdrop-blur-sm pt-[80px]">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-[560px] max-h-[70vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-[24px] py-[16px] border-b border-[#e9e9e9] shrink-0">
          <div>
            <h2 className="text-[16px] font-bold text-[#1f1f1f]">Результати пошуку</h2>
            {query && <p className="text-[12px] text-[#9a9a9a] mt-[2px]">По запиту: "{query}"</p>}
          </div>
          <button
            onClick={onClose}
            className="p-[8px] text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f7f7f7] rounded-[8px] transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-[28px] h-[28px] border-[3px] border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-[24px] text-center">
              <div className="text-[48px] mb-[12px]">🔍</div>
              <p className="text-[14px] font-bold text-[#1f1f1f]">
                {query ? 'Нічого не знайдено' : 'Почніть вводити для пошуку'}
              </p>
              <p className="text-[12px] text-[#9a9a9a] mt-[4px]">
                {query
                  ? `За запитом "${query}" результатів не знайдено`
                  : 'Шукайте по ID, назві або описанню задачі'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#e9e9e9]">
              {results.map(issue => {
                const prio = PRIORITY_CFG[issue.priority] || PRIORITY_CFG.medium;
                const type = TYPE_CFG[issue.type] || TYPE_CFG.task;
                const PrioIcon = prio.i;
                const TypeIcon = type.i;
                const project = projects?.find(p => p.id === issue.projectId);

                return (
                  <button
                    key={issue.id}
                    onClick={() => handleResultClick(issue.id, issue.projectId)}
                    className="w-full flex items-start gap-[12px] px-[24px] py-[16px] hover:bg-[#f7f7f7] transition-colors text-left"
                  >
                    {/* Left: Type + Priority */}
                    <div className="flex flex-col gap-[4px] shrink-0 mt-[2px]">
                      <TypeIcon size={16} style={{ color: type.c }} />
                      <PrioIcon size={12} style={{ color: prio.c }} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-[8px] mb-[4px]">
                        <code className="text-[11px] font-bold text-[#9a9a9a]">
                          {issue.issueKey || `WS-${issue.id.slice(0, 8)}`}
                        </code>
                        <h3 className="text-[13px] font-bold text-[#1f1f1f] truncate flex-1">
                          {issue.title}
                        </h3>
                      </div>

                      {issue.description && (
                        <p className="text-[12px] text-[#9a9a9a] line-clamp-2 mb-[6px]">
                          {issue.description}
                        </p>
                      )}

                      <div className="flex items-center gap-[8px] flex-wrap">
                        {project && (
                          <span className="text-[10px] font-medium px-[6px] py-[2px] bg-[#f0f0f0] rounded-[6px] text-[#9a9a9a]">
                            {project.name}
                          </span>
                        )}
                        <span className="text-[10px] text-[#cfcfcf]">
                          {issue.columnId || 'backlog'}
                        </span>
                      </div>
                    </div>

                    {/* Right: Assignees preview */}
                    {issue.assigneeIds?.length > 0 && (
                      <div className="flex -space-x-1 shrink-0">
                        {issue.assigneeIds.slice(0, 2).map(uid => (
                          <div
                            key={uid}
                            className="w-[24px] h-[24px] rounded-full bg-[#e9e9e9] ring-1 ring-white flex items-center justify-center text-[8px] font-bold text-[#9a9a9a]"
                          >
                            {uid.slice(0, 1).toUpperCase()}
                          </div>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
