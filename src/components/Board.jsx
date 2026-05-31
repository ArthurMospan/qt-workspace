'use client';
// src/components/Board.jsx — Trello-like board: columns + cards + inline add
import { useState, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, X } from 'lucide-react';
import UserAvatar from './UserAvatar';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { useLocalization } from '@/lib/hooks/useLocalization';

// Fallback colors for priority — support both 'blocker'/'critical' naming
const PRIORITY_FALLBACK = {
  blocker:  '#ef4444',
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#e9e9e9',
};

function Card({ task, members, index, onClick }) {
  const { formatDate } = useLocalization();
  const assignees = (task.assignees || [])
    .map(uid => members.find(m => (m.id || m.uid) === uid))
    .filter(Boolean);

  const due = task.dueDate?.toDate ? task.dueDate.toDate()
    : task.dueDate ? new Date(task.dueDate) : null;
  const overdue = due && due < new Date() && task.status !== 'done';

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`bg-white rounded-[10px] border border-[#e9e9e9] px-3 py-[10px] cursor-pointer
            hover:border-[#cfcfcf] hover:ring-4 hover:ring-[#1f1f1f]/5 transition-all select-none
            ${snapshot.isDragging ? 'rotate-[1deg] opacity-90' : ''}`}
        >
          {/* Priority dot + title */}
          <div className="flex items-start gap-2">
            <span className="mt-[6px] w-[7px] h-[7px] rounded-full shrink-0"
              style={{ background: PRIORITY_FALLBACK[task.priority] || '#e9e9e9' }} />
            <p className="text-[13px] font-semibold text-[#1f1f1f] leading-snug line-clamp-3 flex-1">
              {task.title}
            </p>
          </div>

          {/* Footer */}
          {(due || assignees.length > 0) && (
            <div className="flex items-center justify-between mt-[8px]">
              {due ? (
                <span className={`text-[10px] font-semibold px-[6px] py-[2px] rounded-full ${
                  overdue ? 'bg-red-50 text-red-500' : 'bg-[#f4f4f5] text-[#9a9a9a]'
                }`}>
                  {formatDate(due)}
                </span>
              ) : <div />}

              {assignees.length > 0 && (
                <div className="flex -space-x-[5px]">
                  {assignees.slice(0, 3).map(m => (
                    <UserAvatar key={m.id || m.uid} user={m} size={20}
                      className="ring-[1.5px] ring-white" />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}

function Column({ col, tasks, members, onCardClick, onAddCard }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef(null);

  const startAdding = () => {
    setAdding(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const submit = () => {
    if (title.trim()) {
      onAddCard(col.id, title.trim());
      setTitle('');
    }
    setAdding(false);
  };

  return (
    <div className="flex flex-col w-[272px] shrink-0 bg-[#f1f2f4] rounded-[12px] p-3 max-h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="w-[8px] h-[8px] rounded-full" style={{ background: col.color }} />
          <h3 className="text-[12px] font-bold text-[#1f1f1f] uppercase tracking-wide">{col.label}</h3>
          <span className="text-[11px] font-semibold text-[#9a9a9a]">{tasks.length}</span>
        </div>
        <button onClick={startAdding}
          className="w-[24px] h-[24px] flex items-center justify-center rounded-[6px] text-[#9a9a9a] hover:bg-[#e0e2e5] hover:text-[#1f1f1f] transition-all">
          <Plus size={14} />
        </button>
      </div>

      {/* Cards */}
      <Droppable droppableId={col.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex flex-col gap-[6px] flex-1 overflow-y-auto min-h-[4px] rounded-[8px] transition-colors
              ${snapshot.isDraggingOver ? 'bg-[#e0e2e5]/60' : ''}`}
          >
            {tasks.map((task, i) => (
              <Card key={task.id} task={task} members={members} index={i}
                onClick={() => onCardClick(task)} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {/* Inline add */}
      {adding ? (
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            ref={inputRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
              if (e.key === 'Escape') { setAdding(false); setTitle(''); }
            }}
            placeholder="Назва задачі..."
            rows={2}
            className="w-full px-3 py-2 bg-white rounded-[8px] border border-[#e9e9e9] text-[13px] text-[#1f1f1f] placeholder-[#cfcfcf] resize-none focus:border-[#1f1f1f] transition-colors"
          />
          <div className="flex items-center gap-2">
            <button onClick={submit}
              className="px-3 py-[6px] bg-[#1f1f1f] text-white rounded-[8px] text-[12px] font-bold hover:bg-[#303030] transition-colors">
              Додати
            </button>
            <button onClick={() => { setAdding(false); setTitle(''); }}
              className="text-[#9a9a9a] hover:text-[#1f1f1f] transition-colors p-1">
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <button onClick={startAdding}
          className="mt-2 flex items-center gap-2 px-2 py-2 text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#e0e2e5] rounded-[8px] transition-all text-[12px] font-medium">
          <Plus size={14} /> Додати картку
        </button>
      )}
    </div>
  );
}

export default function Board({ tasks, members, onCardClick, onAddCard, onMoveCard }) {
  // Use workflow config for dynamic columns; fallback to 4 defaults if config not loaded yet
  const { statuses = [] } = useWorkflowConfig();
  const columns = statuses.length > 0
    ? statuses.map(s => ({ id: s.id, label: s.label, color: s.color || '#9a9a9a' }))
    : [
        { id: 'todo',        label: 'To Do',   color: '#9a9a9a' },
        { id: 'in-progress', label: 'В роботі', color: '#6366f1' },
        { id: 'review',      label: 'Review',  color: '#f97316' },
        { id: 'done',        label: 'Готово',  color: '#10b981' },
      ];

  const onDragEnd = ({ draggableId, destination }) => {
    if (!destination) return;
    onMoveCard(draggableId, destination.droppableId, destination.index);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-[12px] h-full overflow-x-auto pb-3">
        {columns.map(col => (
          <Column
            key={col.id}
            col={col}
            tasks={tasks.filter(t => t.status === col.id || t.columnId === col.id)}
            members={members}
            onCardClick={onCardClick}
            onAddCard={onAddCard}
          />
        ))}
      </div>
    </DragDropContext>
  );
}
