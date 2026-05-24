'use client';
// src/components/KanbanBoard.jsx — Light theme, DnD
import { DragDropContext } from '@hello-pangea/dnd';
import KanbanColumn from './KanbanColumn';

const DEFAULT_STATUSES = [
  { id: 'todo',        label: 'Backlog',     color: '#9a9a9a' },
  { id: 'in-progress', label: 'В роботі',   color: '#6366f1' },
  { id: 'review',      label: 'Перевірка',  color: '#f97316' },
  { id: 'done',        label: 'Готово',     color: '#10b981' },
];

export default function KanbanBoard({ tasks, moveTask, teamMembers, onAddTask, onSelectTask, statuses }) {
  const columns = statuses?.length ? statuses : DEFAULT_STATUSES;

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    moveTask(draggableId, destination.droppableId, destination.index);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-[16px] h-full overflow-x-auto pb-[4px]">
        {columns.map(col => (
          <KanbanColumn
            key={col.id}
            columnId={col.id}
            label={col.label}
            color={col.color}
            tasks={tasks.filter(t => t.status === col.id)}
            teamMembers={teamMembers}
            onAddTask={onAddTask}
            onSelectTask={onSelectTask}
          />
        ))}
      </div>
    </DragDropContext>
  );
}
