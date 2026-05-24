'use client';
// src/components/workspace/AgileBoard.jsx — 7-column kanban with DnD
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import IssueCard from './IssueCard';
import { Plus } from 'lucide-react';
import { useState, useRef } from 'react';

export const COLUMNS = [
  { id: 'backlog',          label: 'Backlog',         color: '#9a9a9a' },
  { id: 'todo',             label: 'To Do',           color: '#6366f1' },
  { id: 'in-progress',      label: 'In Progress',     color: '#0891b2' },
  { id: 'code-review',      label: 'Code Review',     color: '#d97706' },
  { id: 'qa',               label: 'QA',              color: '#7c3aed' },
  { id: 'client-approval',  label: 'Client Approval', color: '#db2777' },
  { id: 'done',             label: 'Done',            color: '#10b981' },
];

function InlineAdd({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const ref = useRef(null);

  const submit = () => {
    const t = title.trim();
    if (t) { onAdd(t); setTitle(''); }
    setOpen(false);
  };

  return open ? (
    <div className="px-[6px] pb-[6px]">
      <textarea
        ref={ref}
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
          if (e.key === 'Escape') { setOpen(false); setTitle(''); }
        }}
        placeholder="Назва задачі... (Enter — зберегти)"
        rows={2}
        className="w-full px-3 py-2 bg-white rounded-[8px] border border-[#e9e9e9] text-[12px] text-[#1f1f1f] placeholder-[#cfcfcf] resize-none focus:border-[#6366f1] transition-colors"
      />
      <div className="flex gap-2 mt-[6px]">
        <button onClick={submit}
          className="px-3 py-[5px] bg-[#1f1f1f] text-white rounded-[7px] text-[11px] font-bold hover:bg-[#303030]">
          Додати
        </button>
        <button onClick={() => { setOpen(false); setTitle(''); }}
          className="px-3 py-[5px] text-[#9a9a9a] hover:text-[#1f1f1f] text-[11px]">
          Скасувати
        </button>
      </div>
    </div>
  ) : (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-[6px] w-full px-3 py-[7px] text-[11px] text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-white/60 rounded-[8px] transition-all font-medium">
      <Plus size={12} /> Нова задача
    </button>
  );
}

export default function AgileBoard({ issues, members, projectId, activeTimerIssueId, onAddIssue, onMoveIssue }) {
  const onDragEnd = ({ draggableId, source, destination }) => {
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    onMoveIssue(draggableId, destination.droppableId, destination.index);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 h-full overflow-x-auto pb-2 pr-1">
        {COLUMNS.map(col => {
          const colIssues = issues
            .filter(i => i.columnId === col.id)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

          return (
            <div key={col.id} className="flex flex-col w-[240px] shrink-0 bg-[#f1f2f4] rounded-[14px] overflow-hidden"
              style={{ height: 'calc(100vh - 110px)' }}>

              {/* Column header */}
              <div className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0">
                <div className="flex items-center gap-[6px]">
                  <span className="w-[7px] h-[7px] rounded-full" style={{ background: col.color }} />
                  <h3 className="text-[11px] font-bold text-[#1f1f1f] uppercase tracking-wide">{col.label}</h3>
                  <span className="text-[10px] font-bold text-[#9a9a9a] bg-white/60 px-[6px] py-[1px] rounded-full">
                    {colIssues.length}
                  </span>
                </div>
              </div>

              {/* Droppable area — own scroll */}
              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 overflow-y-auto px-[6px] flex flex-col gap-[5px] transition-colors ${
                      snapshot.isDraggingOver ? 'bg-[#e4e6ea]' : ''
                    }`}
                  >
                    {colIssues.map((issue, i) => (
                      <IssueCard
                        key={issue.id}
                        issue={issue}
                        members={members}
                        index={i}
                        projectId={projectId}
                        isTimerActive={activeTimerIssueId === issue.id}
                      />
                    ))}
                    {provided.placeholder}
                    <div className="shrink-0 h-[4px]" />
                  </div>
                )}
              </Droppable>

              {/* Inline add */}
              <div className="px-[4px] pb-[6px] shrink-0 border-t border-white/40 pt-[4px]">
                <InlineAdd onAdd={(title) => onAddIssue(col.id, title)} />
              </div>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
