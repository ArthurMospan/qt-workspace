'use client';
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import Button from '@/components/ui/Button';
import { DEFAULT_PRIORITIES, DEFAULT_TYPES, PRIORITY_ICONS, TYPE_ICONS } from '@/lib/hooks/useWorkflowConfig';

const PRIORITY_CFG = Object.fromEntries(DEFAULT_PRIORITIES.map(p => [p.id, { c: p.color, i: PRIORITY_ICONS[p.id] }]));
const TYPE_CFG = Object.fromEntries(DEFAULT_TYPES.map(t => [t.id, { c: t.color, i: TYPE_ICONS[t.id] }]));

export default function SearchModal({ isOpen, results, loading, query, onClose, projects }) {
  const router = useRouter();

  // Add click-outside listener to close the dropdown
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e) => {
      // If clicking inside the search input or the dropdown itself, do nothing
      // We assume the dropdown has id="search-dropdown" and input is elsewhere
      const isDropdown = e.target.closest('#search-dropdown');
      const isInput = e.target.closest('input[type="text"]');
      if (!isDropdown && !isInput) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleResultClick = (issueId, projectId) => {
    router.push(`/workspace/${projectId}/issue/${issueId}`);
    onClose();
  };

  return (
    <div id="search-dropdown" className="absolute top-[calc(100%+8px)] left-[8px] right-[8px] sm:left-[16px] sm:right-auto z-50 flex items-start">
      <div className="bg-white rounded-[16px] shadow-[0_8px_40px_rgba(0,0,0,0.12)] border border-[#f0f0f0] w-full sm:w-[480px] max-h-[480px] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#f0f0f0] shrink-0 bg-[#fbfbfb]">
          <div>
            <h2 className="text-[13px] font-bold text-[#1f1f1f]">Результати пошуку</h2>
            {query && <p className="text-[11px] text-[#9a9a9a] mt-[2px]">Запит: «{query}»</p>}
          </div>
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
                  : 'Шукайте по ID, назві або описанню завдання'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#f0f0f0]">
              {results.map(issue => {
                const type = TYPE_CFG[issue.type] || TYPE_CFG.task;
                const TypeIcon = type.i;
                const project = projects?.find(p => p.id === issue.projectId);

                return (
                  <button
                    key={issue.id}
                    onClick={() => handleResultClick(issue.id, issue.projectId)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#f4f4f5] transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
                      {/* Left: Type Icon */}
                      <div className="w-5 h-5 flex items-center justify-center rounded-[6px] shrink-0 bg-white border border-[#f0f0f0] shadow-sm">
                        <TypeIcon size={12} style={{ color: type.c }} />
                      </div>

                      {/* Content: ID + Title */}
                      <div className="flex items-baseline gap-2 min-w-0 flex-1">
                        <code className="text-[11px] font-semibold text-[#9a9a9a] shrink-0">
                          {issue.issueKey || `WS-${issue.id.slice(0, 5)}`}
                        </code>
                        <span className="text-[13px] font-semibold text-[#1f1f1f] truncate group-hover:text-[#6366f1] transition-colors">
                          {issue.title}
                        </span>
                      </div>
                    </div>

                    {/* Right: Project badge + Assignees */}
                    <div className="flex items-center gap-3 shrink-0">
                      {issue.assigneeIds?.length > 0 && (
                        <div className="flex -space-x-1">
                          {issue.assigneeIds.slice(0, 2).map(uid => (
                            <div
                              key={uid}
                              className="w-[18px] h-[18px] rounded-full bg-[#e9e9e9] ring-2 ring-white flex items-center justify-center text-[7px] font-bold text-[#9a9a9a]"
                            >
                              {uid.slice(0, 1).toUpperCase()}
                            </div>
                          ))}
                        </div>
                      )}
                      {project && (
                        <span className="text-[10px] font-medium px-2 py-0.5 bg-[#f5f5f5] text-[#9a9a9a] rounded-full group-hover:bg-[#ebebeb] transition-colors">
                          {project.name}
                        </span>
                      )}
                    </div>
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
