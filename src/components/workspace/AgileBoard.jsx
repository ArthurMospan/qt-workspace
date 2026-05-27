'use client';
// src/components/workspace/AgileBoard.jsx — 7-column kanban with DnD and Swimlanes
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import IssueCard from './IssueCard';
import { Plus } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { DEFAULT_COLUMNS } from './BoardConfigModal';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';

function InlineAddForm({ onAdd, onCancel }) {
  const [title, setTitle] = useState('');
  const ref = useRef(null);

  const submit = () => {
    const t = title.trim();
    if (t) { onAdd(t); setTitle(''); }
  };

  return (
    <div className="px-[8px] pb-[8px]">
      <textarea
        ref={ref}
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
          if (e.key === 'Escape') { onCancel(); setTitle(''); }
        }}
        placeholder="Назва задачі... (Enter — зберегти)"
        rows={2}
        className="w-full px-3 py-2 bg-white rounded-[12px] border border-[#e9e9e9] text-[12px] text-[#1f1f1f] placeholder-[#cfcfcf] resize-none focus:border-[#1f1f1f] focus:ring-1 focus:ring-[#1f1f1f] transition-all shadow-sm"
      />
      <div className="flex gap-2 mt-[6px]">
        <button onClick={submit}
          className="px-3 py-[5px] bg-[#1f1f1f] text-white rounded-[8px] text-[11px] font-bold hover:bg-[#303030] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]">
          Додати
        </button>
        <button onClick={() => { onCancel(); setTitle(''); }}
          className="px-3 py-[5px] text-[#9a9a9a] hover:text-[#1f1f1f] text-[11px] transition-colors">
          Скасувати
        </button>
      </div>
    </div>
  );
}

export default function AgileBoard({ issues, members, projectId, project, activeTimerIssueId, onAddIssue, onMoveIssue, swimlane = 'none' }) {
  const [mounted, setMounted] = useState(false);
  const columns = project?.boardColumns?.length ? project.boardColumns : DEFAULT_COLUMNS;
  const { labels } = useWorkflowConfig();
  
  const [activeAddColId, setActiveAddColId] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const onDragEnd = ({ draggableId, source, destination }) => {
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    
    // If swimlanes are active, droppableId is "laneId::columnId"
    const destParts = destination.droppableId.split('::');
    const sourceParts = source.droppableId.split('::');
    const destColId = destParts.length > 1 ? destParts[1] : destination.droppableId;
    const destLaneId = destParts.length > 1 ? destParts[0] : null;
    const sourceLaneId = sourceParts.length > 1 ? sourceParts[0] : null;

    let updateFields = null;
    if (destLaneId !== sourceLaneId) {
      if (swimlane === 'epic') {
        if (destLaneId === 'epic-none') {
          updateFields = { parentEpicId: null };
        } else if (destLaneId && destLaneId.startsWith('epic-')) {
          updateFields = { parentEpicId: destLaneId.replace('epic-', '') };
        }
      } else if (swimlane === 'assignee') {
        if (destLaneId === 'assignee-unassigned') {
          updateFields = { assigneeIds: [] };
        } else if (destLaneId && destLaneId.startsWith('assignee-')) {
          updateFields = { assigneeIds: [destLaneId.replace('assignee-', '')] };
        }
      }
    }

    onMoveIssue(draggableId, destColId, destination.index, updateFields);
  };

  const getSwimlanes = () => {
    if (swimlane === 'none') {
      return [{ id: 'all', title: null, issues }];
    }
    if (swimlane === 'assignee') {
      const grouped = {};
      issues.forEach(i => {
        const aIds = i.assigneeIds && i.assigneeIds.length > 0 ? i.assigneeIds : ['unassigned'];
        aIds.forEach(uid => {
          if (!grouped[uid]) grouped[uid] = [];
          grouped[uid].push(i);
        });
      });
      const lanes = Object.entries(grouped).map(([uid, uIssues]) => {
         const member = members.find(m => (m.id || m.uid) === uid);
         return {
           id: `assignee-${uid}`,
           title: member ? member.name : 'Без виконавця',
           issues: uIssues
         };
      });
      return lanes.sort((a,b) => a.id === 'assignee-unassigned' ? 1 : -1);
    }
    if (swimlane === 'priority') {
      const grouped = { blocker:[], high:[], medium:[], low:[] };
      issues.forEach(i => {
         const p = i.priority || 'medium';
         if(grouped[p]) grouped[p].push(i);
      });
      return [
        { id: 'priority-blocker', title: 'Blocker 🔴', issues: grouped.blocker },
        { id: 'priority-high', title: 'High 🟠', issues: grouped.high },
        { id: 'priority-medium', title: 'Medium 🟡', issues: grouped.medium },
        { id: 'priority-low', title: 'Low ⚪', issues: grouped.low },
      ].filter(l => l.issues.length > 0);
    }
    if (swimlane === 'epic') {
      const epics = issues.filter(i => i.type === 'epic');
      const lanes = epics.map(epic => {
        const childIssues = issues.filter(i => i.parentEpicId === epic.id);
        return {
          id: `epic-${epic.id}`,
          title: `Epic: ${epic.title}`,
          issues: childIssues
        };
      });
      // Plus issues without parent epic
      const noEpicIssues = issues.filter(i => !i.parentEpicId && i.type !== 'epic');
      if (noEpicIssues.length > 0 || epics.length === 0) {
        lanes.push({ id: 'epic-none', title: 'Без Епіку', issues: noEpicIssues });
      }
      return lanes.filter(l => l.issues.length > 0 || l.id.startsWith('epic-') && l.id !== 'epic-none'); 
      // show epic lane even if empty to allow drag into it, but hide empty non-epic lane
    }
    return [{ id: 'all', title: null, issues }];
  };

  if (!mounted) {
    return null; // Avoid SSR hydration mismatches and React 18 strict mode DnD bug
  }

  const swimlanes = getSwimlanes();

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex flex-col h-full overflow-hidden">
        
        {/* Column Headers (fixed at top only for swimlanes) */}
        {swimlanes.length > 1 && (
          <div className="flex gap-4 pb-2 shrink-0 pr-2">
            {columns.map(col => (
              <div key={col.id} className="flex items-center justify-between w-[280px] shrink-0 px-4 pt-2 pb-1 rounded-t-[14px]">
                <div className="flex items-center gap-[8px]">
                  <span className="w-[8px] h-[8px] rounded-full" style={{ background: col.color }} />
                  <h3 className="text-[12px] font-bold text-[#1f1f1f] uppercase tracking-wide">{col.label}</h3>
                </div>
                <button
                  onClick={() => setActiveAddColId(col.id)}
                  className="text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-white rounded-[6px] p-[2px] transition-colors"
                  title="Додати задачу"
                >
                  <Plus size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Scrollable swimlanes area */}
        <div className="flex-1 overflow-auto pr-2 pb-6">
          {swimlanes.map(lane => (
            <div key={lane.id} className="mb-4">
              
              {swimlanes.length > 1 && (
                <div className="sticky left-0 flex items-center bg-[#f0f0f0] rounded-[6px] px-3 py-[6px] mb-2 w-max min-w-[200px]">
                  <h4 className="text-[12px] font-bold text-[#1f1f1f]">{lane.title}</h4>
                  <span className="ml-2 text-[10px] font-bold text-[#9a9a9a] bg-white px-2 py-[2px] rounded-full">{lane.issues.length}</span>
                </div>
              )}
              
              <div className="flex gap-4">
                {columns.map(col => {
                  const colIssues = lane.issues
                    .filter(i => i.columnId === col.id)
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                  
                  const dropId = swimlanes.length > 1 ? `${lane.id}::${col.id}` : col.id;

                  return (
                    <div key={col.id} className={`flex flex-col w-[280px] shrink-0 bg-[#f7f7f7] ${swimlanes.length === 1 ? 'rounded-[24px]' : 'rounded-[12px]'}`} style={{ minHeight: swimlanes.length > 1 ? '100px' : 'calc(100vh - 160px)' }}>
                      
                      {/* Integrated header if no swimlanes */}
                      {swimlanes.length === 1 && (
                        <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
                          <div className="flex items-center gap-[8px]">
                            <span className="w-[8px] h-[8px] rounded-full" style={{ background: col.color }} />
                            <h3 className="text-[12px] font-bold text-[#1f1f1f] uppercase tracking-wide">{col.label}</h3>
                            <span className="text-[11px] font-bold text-[#9a9a9a] bg-white/60 px-[6px] py-[2px] rounded-full">
                              {colIssues.length}
                            </span>
                          </div>
                          <button
                            onClick={() => setActiveAddColId(col.id)}
                            className="text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-white rounded-[6px] p-[2px] transition-colors"
                            title="Додати задачу"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      )}

                      {activeAddColId === col.id && (
                        <InlineAddForm
                          onAdd={(title) => { onAddIssue(col.id, title, lane.id); setActiveAddColId(null); }}
                          onCancel={() => setActiveAddColId(null)}
                        />
                      )}

                      <Droppable droppableId={dropId}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`flex-1 px-[8px] pb-[8px] flex flex-col gap-[8px] transition-colors ${swimlanes.length === 1 ? 'rounded-b-[14px]' : 'rounded-[12px]'} ${
                              snapshot.isDraggingOver ? 'bg-[#e5e7eb]/50' : ''
                            }`}
                          >
                            {colIssues.map((issue, i) => (
                              <IssueCard
                                key={issue.id}
                                issue={issue}
                                issues={issues}
                                members={members}
                                labels={labels}
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
                    </div>
                  );
                })}
              </div>

            </div>
          ))}
        </div>
      </div>
    </DragDropContext>
  );
}
