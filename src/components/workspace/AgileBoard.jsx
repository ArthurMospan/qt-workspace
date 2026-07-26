'use client';
// src/components/workspace/AgileBoard.jsx — 7-column kanban with DnD and Swimlanes
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import IssueCard from './IssueCard';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { DEFAULT_COLUMNS } from './BoardConfigModal';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import Button from '@/components/ui/Button';

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
        placeholder="Назва завдання... (Enter — зберегти)"
        rows={2}
        className="w-full px-3 py-2 bg-white rounded-[12px] border border-line text-[12px] text-ink placeholder-faint resize-none focus:border-ink focus:ring-1 focus:ring-ink transition-all shadow-sm"
      />
      <div className="flex gap-2 mt-[6px]">
        <Button style="primary" size="sm" onClick={submit}>
          Додати
        </Button>
        <Button style="secondary" size="sm" onClick={() => { onCancel(); setTitle(''); }}>
          Скасувати
        </Button>
      </div>
    </div>
  );
}

export default function AgileBoard({ issues, members, projectId, project, activeTimerIssueId, onAddIssue, onMoveIssue, swimlane = 'none', hiddenColumns = [], showHiddenLane = false, issueLinks = [], isArchived }) {
  const [mounted, setMounted] = useState(false);
  const { statuses: globalStatuses, labels } = useWorkflowConfig();
  
  // Both sources hand back a fresh array on every render, which would defeat
  // the memos below; collapse them to a value that only changes on content.
  const hiddenColsKey = (project ? (project.hiddenColumns || []) : hiddenColumns).join(',');
  const activeHiddenCols = useMemo(
    () => (hiddenColsKey ? hiddenColsKey.split(',') : []),
    [hiddenColsKey]
  );

  const columns = useMemo(() => {
    const visibleColumns = globalStatuses.filter(s => !activeHiddenCols.includes(s.id));
    const hiddenColIds = activeHiddenCols.filter(id => globalStatuses.some(s => s.id === id));
    const next = [...visibleColumns];
    if (showHiddenLane && hiddenColIds.length > 0) {
      next.push({
        id: '__hidden__',
        label: 'Приховані',
        color: '#cfcfcf',
        isHiddenContainer: true,
        colIds: hiddenColIds
      });
    }
    return next;
  }, [globalStatuses, activeHiddenCols, showHiddenLane]);

  const [activeAddColId, setActiveAddColId] = useState(null);
  const [collapsedCols, setCollapsedCols] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`qt_board_collapsed_${projectId || 'default'}`);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return ['__hidden__'];
  });

  const toggleColumnCollapse = (id) => {
    setCollapsedCols(prev => {
      const next = prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id];
      if (typeof window !== 'undefined') {
        localStorage.setItem(`qt_board_collapsed_${projectId || 'default'}`, JSON.stringify(next));
      }
      return next;
    });
  };

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const onDragEnd = (result) => {
    if (isArchived) return;
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    
    // If swimlanes are active, droppableId is "laneId::columnId"
    const destParts = destination.droppableId.split('::');
    const sourceParts = source.droppableId.split('::');
    const destColId = destParts.length > 1 ? destParts[1] : destination.droppableId;
    const destLaneId = destParts.length > 1 ? destParts[0] : null;
    const sourceLaneId = sourceParts.length > 1 ? sourceParts[0] : null;

    if (destColId === '__hidden__') return; // Cannot drop into the combined hidden container

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

  const swimlanes = useMemo(() => {
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
  }, [swimlane, issues, members]);

  if (!mounted) {
    return null; // Avoid SSR hydration mismatches and React 18 strict mode DnD bug
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex flex-col h-full overflow-hidden">
        
        {/* Column Headers (fixed at top only for swimlanes) */}
        {swimlanes.length > 1 && (
          <div className="flex gap-4 pb-2 shrink-0 full-bleed">
            {columns.map(col => {
              const isCollapsed = collapsedCols.includes(col.id);
              const colTotalIssues = issues.filter(i => {
                if (col.isHiddenContainer) return col.colIds.includes(i.columnId);
                return i.columnId === col.id;
              });

              if (isCollapsed) {
                return (
                  <div key={col.id} className="flex flex-col items-center justify-start w-[48px] shrink-0 pt-4 pb-2 bg-canvas rounded-t-[12px] cursor-pointer hover:bg-[#f0f0f2] transition-colors" onClick={() => toggleColumnCollapse(col.id)}>
                    <button className="text-muted mb-4">
                      <ChevronRight size={16} />
                    </button>
                    <span className="w-[8px] h-[8px] rounded-full shrink-0 mb-4" style={{ background: col.color }} />
                    <h3 className="text-[12px] font-bold text-ink uppercase tracking-wide whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{col.label}</h3>
                    <span className="text-[11px] font-bold text-muted bg-white/60 px-[2px] py-[6px] rounded-full text-center mt-4" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                      {colTotalIssues.length}
                    </span>
                  </div>
                );
              }
              return (
                <div key={col.id} className="flex items-center justify-between w-[82vw] max-w-[320px] md:w-[280px] md:max-w-none shrink-0 px-4 pt-2 pb-1 rounded-t-[12px]">
                  <div className="flex items-center gap-[6px]">
                    <button
                      onClick={() => toggleColumnCollapse(col.id)}
                      className="text-muted hover:text-ink hover:bg-white rounded-[6px] p-[2px] transition-colors -ml-2"
                      title="Згорнути колонку"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="w-[8px] h-[8px] rounded-full" style={{ background: col.color }} />
                    <h3 className="text-[12px] font-bold text-ink uppercase tracking-wide">{col.label}</h3>
                    <span className="text-[11px] font-bold text-muted bg-white/60 px-[6px] py-[2px] rounded-full ml-1">
                      {colTotalIssues.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {!isArchived && !col.isHiddenContainer && (
                      <button
                        onClick={() => setActiveAddColId(col.id)}
                        className="text-muted hover:text-ink hover:bg-white rounded-[6px] p-[2px] transition-colors"
                        title="Додати завдання"
                      >
                        <Plus size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Scrollable swimlanes area — full-bleed so columns scroll to the panel edge, not the page padding */}
        <div className={`flex-1 overflow-auto snap-x snap-mandatory md:snap-none full-bleed ${swimlanes.length === 1 ? 'overflow-y-hidden pb-2 flex flex-col' : 'pb-6'}`}>
          {swimlanes.map(lane => (
            <div key={lane.id} className={`mb-4 ${swimlanes.length === 1 ? 'flex-1 min-h-0 flex flex-col' : ''}`}>
              
              {swimlanes.length > 1 && (
                <div className="sticky left-0 flex items-center bg-[#f0f0f0] rounded-[6px] px-3 py-[6px] mb-2 w-max min-w-[200px]">
                  <h4 className="text-[12px] font-bold text-ink">{lane.title}</h4>
                  <span className="ml-2 text-[10px] font-bold text-muted bg-white px-2 py-[2px] rounded-full">{lane.issues.length}</span>
                </div>
              )}
              
              <div className={`flex gap-4 ${swimlanes.length === 1 ? 'flex-1 min-h-0' : ''}`}>
                {columns.map(col => {
                  const colIssues = lane.issues
                    .filter(i => {
                      if (col.isHiddenContainer) return col.colIds.includes(i.columnId);
                      return i.columnId === col.id;
                    })
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                  
                  const dropId = swimlanes.length > 1 ? `${lane.id}::${col.id}` : col.id;

                  const isCollapsed = collapsedCols.includes(col.id);

                  if (isCollapsed) {
                    return (
                      <div key={col.id} className={`flex flex-col w-[48px] shrink-0 bg-canvas ${swimlanes.length === 1 ? 'rounded-[16px] cursor-pointer hover:bg-[#f0f0f2] transition-colors items-center py-4 h-full' : 'rounded-[12px]'}`} style={{ minHeight: swimlanes.length > 1 ? '100px' : undefined }} onClick={swimlanes.length === 1 ? () => toggleColumnCollapse(col.id) : undefined}>
                        {swimlanes.length === 1 && (
                          <>
                            <button className="text-muted mb-4">
                              <ChevronRight size={16} />
                            </button>
                            <span className="w-[8px] h-[8px] rounded-full shrink-0 mb-4" style={{ background: col.color }} />
                            <h3 className="text-[12px] font-bold text-ink uppercase tracking-wide whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{col.label}</h3>
                            <span className="text-[11px] font-bold text-muted bg-white/60 px-[2px] py-[6px] rounded-full text-center mt-4" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                              {colIssues.length}
                            </span>
                          </>
                        )}
                        {swimlanes.length > 1 && (
                          <div className="flex-1 border-2 border-dashed border-line/50 rounded-[12px] m-1" />
                        )}
                      </div>
                    );
                  }

                  return (
                    <div key={col.id} className={`flex flex-col w-[82vw] max-w-[320px] md:w-[280px] md:max-w-none shrink-0 snap-center bg-canvas hover:bg-[#f0f0f2] transition-colors duration-200 ${swimlanes.length === 1 ? 'rounded-[16px] h-full overflow-hidden' : 'rounded-[12px]'}`} style={{ minHeight: swimlanes.length > 1 ? '100px' : undefined }}>
                      
                      {/* Integrated header if no swimlanes */}
                      {swimlanes.length === 1 && (
                        <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
                          <div className="flex items-center gap-[6px]">
                            <button
                              onClick={() => toggleColumnCollapse(col.id)}
                              className="text-muted hover:text-ink hover:bg-white rounded-[6px] p-[2px] transition-colors -ml-2"
                              title="Згорнути колонку"
                            >
                              <ChevronLeft size={16} />
                            </button>
                            <span className="w-[8px] h-[8px] rounded-full" style={{ background: col.color }} />
                            <h3 className="text-[12px] font-bold text-ink uppercase tracking-wide">{col.label}</h3>
                            <span className="text-[11px] font-bold text-muted bg-white/60 px-[6px] py-[2px] rounded-full ml-1">
                              {colIssues.length}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {!isArchived && !col.isHiddenContainer && (
                              <button
                                onClick={() => setActiveAddColId(col.id)}
                                className="text-muted hover:text-ink hover:bg-white rounded-[6px] p-[2px] transition-colors"
                                title="Додати завдання"
                              >
                                <Plus size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {activeAddColId === col.id && !col.isHiddenContainer && (
                        <InlineAddForm
                          onAdd={(title) => { onAddIssue(col.id, title, lane.id); setActiveAddColId(null); }}
                          onCancel={() => setActiveAddColId(null)}
                        />
                      )}

                      <Droppable droppableId={dropId} isDropDisabled={col.isHiddenContainer || isArchived}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`flex-1 p-[8px] flex flex-col gap-[8px] transition-colors custom-scrollbar ${swimlanes.length === 1 ? 'rounded-b-[16px] overflow-y-auto' : 'rounded-[12px]'} ${
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
                                projectName={project?.name}
                                isTimerActive={activeTimerIssueId === issue.id}
                                issueLinks={issueLinks}
                                isArchived={isArchived}
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
