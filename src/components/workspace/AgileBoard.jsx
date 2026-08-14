'use client';
// src/components/workspace/AgileBoard.jsx — 7-column kanban with DnD and Swimlanes
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import IssueCard from './IssueCard';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import Button from '@/components/ui/Button';
import Pill from '@/components/ui/DataDisplay/Pill';
import { columnOf, compareIssues } from '@/lib/utils/optimistic.mjs';
import PriorityIcon from '@/components/ui/DataDisplay/PriorityIcon';
import { NO_PRIORITY, ensureSystemPriorities } from '@/lib/utils/priorities.mjs';
import { COLUMN_RENDER_PAGE_SIZE } from '@/lib/utils/queryPagination.mjs';
import {
  createUkrainianDndAnnouncements,
  UKRAINIAN_DRAG_HANDLE_USAGE_INSTRUCTIONS,
} from '@/lib/utils/dndAnnouncements.mjs';

// The drag context cannot render during SSR/hydration, so the first board of a
// session waits a tick before painting. Every later mount — a tab switch, a
// `loading` flip, coming back from an issue — is already client-side, and
// returning null for a paint there reads as the board blinking out and back.
// One module-level flag means only the very first mount pays that frame.
let dndReady = false;

const ESTIMATED_CARD_HEIGHT = 178;
const CARD_GUTTER = 8;
const VIRTUAL_OVERSCAN = 2;

function MeasuredVirtualCard({ issue, index, top, onMeasure, renderCard }) {
  const [cardNode, setCardNode] = useState(null);

  useLayoutEffect(() => {
    if (!cardNode) return undefined;
    const report = () => onMeasure(
      issue.id,
      Math.ceil(cardNode.getBoundingClientRect().height) + CARD_GUTTER,
    );
    report();
    const observer = new ResizeObserver(report);
    observer.observe(cardNode);
    return () => observer.disconnect();
  }, [cardNode, issue.id, onMeasure]);

  return renderCard(issue, index, {
    cardRef: setCardNode,
    virtualStyle: {
      position: 'absolute',
      insetInline: 0,
      top,
    },
  });
}

// @hello-pangea/dnd's virtual mode expects the list to own its scroll height,
// render an overscanned window and provide a clone for the lifted card. Card
// heights are measured because task metadata makes them intentionally variable.
function VirtualDroppableColumn({
  dropId,
  issues,
  isDropDisabled,
  className,
  renderCard,
}) {
  const scrollRef = useRef(null);
  const [measuredHeights, setMeasuredHeights] = useState(() => new Map());
  const [viewport, setViewport] = useState({ scrollTop: 0, height: 600 });

  const measureViewport = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    setViewport(current => {
      const next = { scrollTop: node.scrollTop, height: node.clientHeight || 600 };
      return current.scrollTop === next.scrollTop && current.height === next.height
        ? current
        : next;
    });
  }, []);

  useLayoutEffect(() => {
    measureViewport();
    const node = scrollRef.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(measureViewport);
    observer.observe(node);
    return () => observer.disconnect();
  }, [measureViewport]);

  const handleMeasure = useCallback((issueId, height) => {
    setMeasuredHeights(current => {
      if (current.get(issueId) === height) return current;
      const next = new Map(current);
      next.set(issueId, height);
      return next;
    });
  }, []);

  const layout = useMemo(() => {
    const rows = [];
    for (const issue of issues) {
      const height = measuredHeights.get(issue.id) || ESTIMATED_CARD_HEIGHT;
      const previous = rows.at(-1);
      rows.push({
        top: previous ? previous.top + previous.height : 0,
        height,
      });
    }
    const last = rows.at(-1);
    return { rows, totalHeight: last ? last.top + last.height : 0 };
  }, [issues, measuredHeights]);

  const visibleRange = useMemo(() => {
    if (issues.length === 0) return { start: 0, end: 0 };
    const viewportStart = viewport.scrollTop;
    const viewportEnd = viewportStart + viewport.height;
    let start = 0;
    while (
      start < layout.rows.length
      && layout.rows[start].top + layout.rows[start].height < viewportStart
    ) start += 1;
    let end = start;
    while (end < layout.rows.length && layout.rows[end].top < viewportEnd) end += 1;
    return {
      start: Math.max(0, start - VIRTUAL_OVERSCAN),
      end: Math.min(issues.length, end + VIRTUAL_OVERSCAN),
    };
  }, [issues.length, layout.rows, viewport.height, viewport.scrollTop]);

  return (
    <Droppable
      droppableId={dropId}
      isDropDisabled={isDropDisabled}
      mode="virtual"
      renderClone={(provided, snapshot, rubric) => {
        const issue = issues[rubric.source.index];
        return issue ? renderCard(issue, undefined, {
          dragProvided: provided,
          dragSnapshot: snapshot,
        }) : null;
      }}
    >
      {(provided, snapshot) => (
        <div
          ref={node => {
            scrollRef.current = node;
            provided.innerRef(node);
          }}
          {...provided.droppableProps}
          onScroll={measureViewport}
          className={`${className} ${snapshot.isDraggingOver ? 'bg-[#e5e7eb]/50' : ''}`}
        >
          <div
            className="relative shrink-0"
            style={{
              height: layout.totalHeight + (snapshot.isUsingPlaceholder ? ESTIMATED_CARD_HEIGHT : 0),
              minHeight: '4px',
            }}
          >
            {issues.slice(visibleRange.start, visibleRange.end).map((issue, offset) => {
              const index = visibleRange.start + offset;
              return (
                <MeasuredVirtualCard
                  key={issue.id}
                  issue={issue}
                  index={index}
                  top={layout.rows[index].top}
                  onMeasure={handleMeasure}
                  renderCard={renderCard}
                />
              );
            })}
          </div>
        </div>
      )}
    </Droppable>
  );
}

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
        className="w-full px-3 py-2 bg-white rounded-[12px] border border-line text-[12px] text-ink placeholder-faint resize-none focus:border-ink focus:ring-1 focus:ring-ink transition-all"
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

export default function AgileBoard({
  issues,
  allIssues,
  members,
  projectId,
  project,
  projects = [],
  sprints = [],
  showProjectName = false,
  activeTimerIssueId,
  onAddIssue,
  onRequestAddIssue,
  onMoveIssue,
  swimlane = 'none',
  groupBy = 'status',
  hiddenColumns = [],
  showHiddenLane = false,
  issueLinks = [],
  isArchived,
  cardPageSize = COLUMN_RENDER_PAGE_SIZE,
  compareIssueCards = compareIssues,
}) {
  const [mounted, setMounted] = useState(dndReady);
  const {
    statuses: globalStatuses,
    labels,
    categoryColumns,
    statusCategoryById,
    priorities,
  } = useWorkflowConfig();
  // A board of one project has that project's statuses as its columns. A board
  // that spans projects cannot: a status one project has switched off is not a
  // column the other's cards may be dropped into, which is the collision this
  // mode removes. Its columns are the five shared categories instead, so every
  // card on it has exactly one column it belongs to.
  const byCategory = groupBy === 'category';
  const contextIssues = allIssues || issues;
  // A subtask carries its own status, so it is a card of its own on every
  // board. IssueCard prints the parent's key on it, which is what keeps the
  // hierarchy readable without hiding work from the column it belongs to.
  const boardIssues = issues;

  // Both sources hand back a fresh array on every render, which would defeat
  // the memos below; collapse them to a value that only changes on content.
  const hiddenColsKey = (project ? (project.hiddenColumns || []) : hiddenColumns).join(',');
  const activeHiddenCols = useMemo(
    () => (hiddenColsKey ? hiddenColsKey.split(',') : []),
    [hiddenColsKey]
  );

  const columns = useMemo(() => {
    const allColumns = byCategory ? categoryColumns : globalStatuses;
    const visibleColumns = allColumns.filter(s => !activeHiddenCols.includes(s.id));
    const hiddenColIds = activeHiddenCols.filter(id => allColumns.some(s => s.id === id));
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
  }, [byCategory, categoryColumns, globalStatuses, activeHiddenCols, showHiddenLane]);

  // Which column a card belongs to. In category mode a card's own status is not
  // a column of this board — its category is.
  const columnIdOf = useMemo(() => (byCategory
    ? issue => statusCategoryById.get(columnOf(issue)) || ''
    : columnOf), [byCategory, statusCategoryById]);

  // Columns that hold more than one status: the card has to name its own status
  // there, otherwise a category column silently flattens «Код-ревʼю» and «QA»
  // into one indistinguishable pile.
  const multiStatusColumnIds = useMemo(() => {
    if (!byCategory) return new Set();
    const counts = new Map();
    for (const category of statusCategoryById.values()) {
      counts.set(category, (counts.get(category) || 0) + 1);
    }
    return new Set([...counts].filter(([, count]) => count > 1).map(([category]) => category));
  }, [byCategory, statusCategoryById]);

  // One definition of "the cards of this column, in this order", used to render
  // a column and to read back where a card was dropped into it. Two definitions
  // is what let the board show one order and write another.
  const columnCards = (laneIssues, column) => (laneIssues || [])
    .filter(issue => (column?.isHiddenContainer
      ? column.colIds.includes(columnIdOf(issue))
      : columnIdOf(issue) === column?.id))
    .sort(compareIssueCards);

  const [activeAddColId, setActiveAddColId] = useState(null);
  // Large cross-project boards stay responsive by rendering a bounded first
  // page per column. The complete ordered column remains available to the drop
  // planner, so loading is only a rendering concern and never changes where a
  // card is persisted.
  const [visibleCardLimits, setVisibleCardLimits] = useState({});
  const normalizedCardPageSize = Number.isFinite(cardPageSize) && cardPageSize > 0
    ? Math.trunc(cardPageSize)
    : null;
  const dndAnnouncements = useMemo(() => createUkrainianDndAnnouncements({
    itemLabel: draggableId => {
      const issue = boardIssues.find(candidate => candidate.id === draggableId);
      return issue?.issueKey || issue?.title || 'Завдання';
    },
    listLabel: droppableId => {
      const columnId = String(droppableId || '').split('::').at(-1);
      return columns.find(column => column.id === columnId)?.label || 'Колонка';
    },
  }), [boardIssues, columns]);
  // Which columns are folded, remembered per board *and per grouping*: the two
  // modes have different columns, and one key let a collapsed «У роботі» category
  // fold the unrelated status that happens to share its id.
  const collapsedKey = `qt_board_collapsed_${projectId || 'default'}${byCategory ? '_category' : ''}`;
  // Read from the key rather than copied into state on mount: switching grouping
  // changes the key, and a copy would keep showing the folds of the mode you
  // just left. The override is this session's edits to the key it belongs to, so
  // it stops applying the moment the key changes — no effect has to reset it.
  const storedCollapsedCols = useMemo(() => {
    if (typeof window === 'undefined') return ['__hidden__'];
    try {
      const saved = localStorage.getItem(collapsedKey);
      return saved ? JSON.parse(saved) : ['__hidden__'];
    } catch {
      return ['__hidden__'];
    }
  }, [collapsedKey]);
  const [collapsedOverride, setCollapsedOverride] = useState(null);
  const collapsedCols = collapsedOverride?.key === collapsedKey
    ? collapsedOverride.columnIds
    : storedCollapsedCols;

  const toggleColumnCollapse = (id) => {
    const next = collapsedCols.includes(id)
      ? collapsedCols.filter(c => c !== id)
      : [...collapsedCols, id];
    setCollapsedOverride({ key: collapsedKey, columnIds: next });
    if (typeof window !== 'undefined') {
      localStorage.setItem(collapsedKey, JSON.stringify(next));
    }
  };

  useEffect(() => {
    if (dndReady) return;
    queueMicrotask(() => {
      dndReady = true;
      setMounted(true);
    });
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
      if (swimlane === 'assignee') {
        if (destLaneId === 'assignee-unassigned') {
          updateFields = { assigneeIds: [] };
        } else if (destLaneId && destLaneId.startsWith('assignee-')) {
          updateFields = { assigneeIds: [destLaneId.replace('assignee-', '')] };
        }
      }
    }

    // The column the user was looking at, not an index into rows they could not
    // see. Filters, swimlanes and the cross-project columns of «Мої завдання»
    // all mean the visible list is a subset of what `order` numbers, so the
    // caller resolves this against its own scope. It used to be resolved here,
    // against a list sorted by a rule of its own, and a card that was dropped
    // between two others landed wherever that other rule had put them.
    const destinationLane = destLaneId
      ? swimlanes.find(lane => lane.id === destLaneId)
      : swimlanes[0];
    const destinationColumn = columns.find(column => column.id === destColId);
    const visibleColumnIds = columnCards(destinationLane?.issues || boardIssues, destinationColumn)
      .filter(candidate => candidate.id !== draggableId)
      .map(candidate => candidate.id);

    onMoveIssue(
      draggableId,
      destColId,
      { visibleColumnIds, visibleIndex: destination.index },
      updateFields,
    );
  };

  const swimlanes = (() => {
    if (swimlane === 'none') {
      return [{ id: 'all', title: null, issues: boardIssues }];
    }
    if (swimlane === 'assignee') {
      const grouped = {};
      boardIssues.forEach(i => {
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
      const lanePriorities = [...ensureSystemPriorities(priorities), NO_PRIORITY];
      const grouped = Object.fromEntries(lanePriorities.map(priority => [priority.id, []]));
      boardIssues.forEach(i => {
         const p = i.priority || NO_PRIORITY.id;
         if(grouped[p]) grouped[p].push(i);
      });
      return lanePriorities.map(priority => ({
        id: `priority-${priority.id}`,
        title: (
          <span className="flex items-center gap-2">
            <PriorityIcon priority={priority} priorities={priorities} />
            <span>{priority.label}</span>
          </span>
        ),
        issues: grouped[priority.id],
      })).filter(lane => lane.issues.length > 0);
    }
    return [{ id: 'all', title: null, issues: boardIssues }];
  })();

  if (!mounted) {
    return null; // Avoid SSR hydration mismatches and React 18 strict mode DnD bug
  }

  return (
    <DragDropContext
      dragHandleUsageInstructions={UKRAINIAN_DRAG_HANDLE_USAGE_INSTRUCTIONS}
      onDragStart={dndAnnouncements.onDragStart}
      onDragUpdate={dndAnnouncements.onDragUpdate}
      onDragEnd={(result, provided) => {
        dndAnnouncements.onDragEnd(result, provided);
        onDragEnd(result);
      }}
    >
      <div className="flex flex-col h-full overflow-hidden">
        
        {/* Column Headers (fixed at top only for swimlanes) */}
        {swimlanes.length > 1 && (
          <div className="flex gap-4 pb-2 shrink-0 full-bleed">
            {columns.map(col => {
              const isCollapsed = collapsedCols.includes(col.id);
              const colTotalIssues = columnCards(boardIssues, col);

              if (isCollapsed) {
                return (
                  <div
                    key={col.id}
                    data-ui-surface="local"
                    className="flex flex-col items-center justify-start w-[48px] shrink-0 pt-4 pb-2 bg-canvas rounded-t-[12px] cursor-pointer hover:bg-[#f0f0f2] transition-colors"
                    onClick={() => toggleColumnCollapse(col.id)}
                    // The strip holds the chevron button, so it is not a
                    // `<button>` itself; it still answers the same two keys.
                    role="button"
                    tabIndex={0}
                    aria-expanded={false}
                    onKeyDown={event => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      toggleColumnCollapse(col.id);
                    }}
                  >
                    {/* The mirror image of the collapse control in the open header:
                        same component, same ghost style, same icon-xs box —
                        only the arrow points the other way. It used to be an
                        IconAction at a different size and weight, so the two
                        halves of one gesture read as unrelated buttons. The
                        strip itself carries the click; this is its affordance. */}
                    <Button
                      style="ghost"
                      size="icon-xs"
                      icon={ChevronRight}
                      className="mb-4 hover:!bg-white"
                      title="Розгорнути колонку"
                    />
                    <span className="w-[8px] h-[8px] rounded-full shrink-0 mb-4" style={{ background: col.color }} />
                    <h2 className="ui-type-column-title text-ink uppercase tracking-wide whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{col.label}</h2>
                    <Pill tone="count" size="md" className="mt-4">{colTotalIssues.length}</Pill>
                  </div>
                );
              }
              return (
                <div key={col.id} className="flex items-center justify-between w-[82vw] max-w-[320px] md:w-[280px] md:max-w-none shrink-0 px-4 pt-2 pb-1 rounded-t-[12px]">
                  <div className="flex items-center gap-[6px]">
                    <Button
                      onClick={() => toggleColumnCollapse(col.id)}
                      style="ghost"
                      size="icon-xs"
                      icon={ChevronLeft}
                      className="-ml-2 hover:!bg-white"
                      title="Згорнути колонку"
                    />
                    <span className="w-[8px] h-[8px] rounded-full" style={{ background: col.color }} />
                    <h2 className="ui-type-column-title text-ink uppercase tracking-wide">{col.label}</h2>
                    <Pill tone="count" size="md" className="ml-1">{colTotalIssues.length}</Pill>
                  </div>
                  <div className="flex items-center gap-1">
                    {!isArchived && !col.isHiddenContainer && (
                      <Button
                        onClick={() => onRequestAddIssue
                          ? onRequestAddIssue(col.id)
                          : setActiveAddColId(col.id)}
                        style="ghost"
                        size="icon-xs"
                        icon={Plus}
                        className="hover:!bg-white"
                        title="Додати завдання"
                      />
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
                  <h3 className="ui-type-item-title text-ink">{lane.title}</h3>
                  <Pill tone="count" size="md" className="ml-2">{lane.issues.length}</Pill>
                </div>
              )}
              
              <div className={`flex gap-4 ${swimlanes.length === 1 ? 'flex-1 min-h-0' : ''}`}>
                {columns.map(col => {
                  const colIssues = columnCards(lane.issues, col);

                  const dropId = swimlanes.length > 1 ? `${lane.id}::${col.id}` : col.id;
                  const visibleLimit = normalizedCardPageSize
                    ? visibleCardLimits[dropId] || normalizedCardPageSize
                    : colIssues.length;
                  const renderedColIssues = colIssues.slice(0, visibleLimit);
                  const remainingIssueCount = colIssues.length - renderedColIssues.length;
                  const shouldVirtualize = swimlanes.length === 1
                    && colIssues.length > COLUMN_RENDER_PAGE_SIZE;

                  const isCollapsed = collapsedCols.includes(col.id);

                  if (isCollapsed) {
                    return (
                      <div
                        key={col.id}
                        className={`flex flex-col w-[48px] shrink-0 bg-canvas ${swimlanes.length === 1 ? 'rounded-[16px] cursor-pointer hover:bg-[#f0f0f2] transition-colors items-center py-4 h-full' : 'rounded-[12px]'}`}
                        style={{ minHeight: swimlanes.length > 1 ? '100px' : undefined }}
                        onClick={swimlanes.length === 1 ? () => toggleColumnCollapse(col.id) : undefined}
                        // Only the single-swimlane strip is clickable at all;
                        // with swimlanes the chevron inside each one is.
                        role={swimlanes.length === 1 ? 'button' : undefined}
                        tabIndex={swimlanes.length === 1 ? 0 : undefined}
                        aria-expanded={swimlanes.length === 1 ? false : undefined}
                        onKeyDown={swimlanes.length === 1 ? (event => {
                          if (event.target !== event.currentTarget) return;
                          if (event.key !== 'Enter' && event.key !== ' ') return;
                          event.preventDefault();
                          toggleColumnCollapse(col.id);
                        }) : undefined}
                      >
                        {swimlanes.length === 1 && (
                          <>
                            <Button
                              style="ghost"
                              size="icon-xs"
                              icon={ChevronRight}
                              className="mb-4 hover:!bg-white"
                              title="Розгорнути колонку"
                            />
                            <span className="w-[8px] h-[8px] rounded-full shrink-0 mb-4" style={{ background: col.color }} />
                            <h2 className="ui-type-column-title text-ink uppercase tracking-wide whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{col.label}</h2>
                            <Pill tone="count" size="md" className="mt-4">{colIssues.length}</Pill>
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
                            <Button
                              onClick={() => toggleColumnCollapse(col.id)}
                              style="ghost"
                              size="icon-xs"
                              icon={ChevronLeft}
                              className="-ml-2 hover:!bg-white"
                              title="Згорнути колонку"
                            />
                            <span className="w-[8px] h-[8px] rounded-full" style={{ background: col.color }} />
                            <h2 className="ui-type-column-title text-ink uppercase tracking-wide">{col.label}</h2>
                            <Pill tone="count" size="md" className="ml-1">{colIssues.length}</Pill>
                          </div>
                          <div className="flex items-center gap-1">
                            {!isArchived && !col.isHiddenContainer && (
                              <Button
                                onClick={() => onRequestAddIssue
                                  ? onRequestAddIssue(col.id)
                                  : setActiveAddColId(col.id)}
                                style="ghost"
                                size="icon-xs"
                                icon={Plus}
                                className="hover:!bg-white"
                                title="Додати завдання"
                              />
                            )}
                          </div>
                        </div>
                      )}

                      {!onRequestAddIssue && activeAddColId === col.id && !col.isHiddenContainer && (
                        <InlineAddForm
                          onAdd={(title) => { onAddIssue(col.id, title, lane.id); setActiveAddColId(null); }}
                          onCancel={() => setActiveAddColId(null)}
                        />
                      )}

                      {/* Card spacing lives in a margin on the cards, never in
                          `gap` here: gap is invisible to the drag library, which
                          sizes its placeholder from each card's own box. With a
                          gap the slot freed by lifting a card was 8px taller
                          than the placeholder replacing it, so the whole column
                          hopped on every lift and again on every drop. */}
                      {(() => {
                        const renderIssueCard = (issue, index, virtualProps = {}) => (
                          <IssueCard
                            key={issue.id}
                            className="mb-[8px]"
                            issue={issue}
                            issues={issues}
                            allIssues={contextIssues}
                            members={members}
                            labels={labels}
                            index={index}
                            projectId={issue.projectId || projectId}
                            projectName={showProjectName
                              ? projects.find(item => item.id === issue.projectId)?.name || project?.name
                              : project?.name}
                            showProjectName={showProjectName}
                            sprints={sprints}
                            isTimerActive={activeTimerIssueId === issue.id}
                            issueLinks={issueLinks}
                            isArchived={isArchived}
                            showStatusName={byCategory && (
                              col.isHiddenContainer || multiStatusColumnIds.has(col.id)
                            )}
                            {...virtualProps}
                          />
                        );

                        if (shouldVirtualize) {
                          return (
                            <VirtualDroppableColumn
                              dropId={dropId}
                              issues={colIssues}
                              isDropDisabled={col.isHiddenContainer || isArchived}
                              className="flex-1 p-[8px] transition-colors hide-scrollbar rounded-b-[16px] overflow-y-auto"
                              renderCard={renderIssueCard}
                            />
                          );
                        }

                        return (
                          <Droppable droppableId={dropId} isDropDisabled={col.isHiddenContainer || isArchived}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`flex-1 p-[8px] flex flex-col transition-colors hide-scrollbar ${swimlanes.length === 1 ? 'rounded-b-[16px] overflow-y-auto' : 'rounded-[12px]'} ${
                                  snapshot.isDraggingOver ? 'bg-[#e5e7eb]/50' : ''
                                }`}
                              >
                                {renderedColIssues.map((issue, index) => renderIssueCard(issue, index))}
                                {provided.placeholder}
                                {remainingIssueCount > 0 && (
                                  <div className="shrink-0 pb-[8px]">
                                    <Button
                                      onClick={() => setVisibleCardLimits(current => ({
                                        ...current,
                                        [dropId]: visibleLimit + normalizedCardPageSize,
                                      }))}
                                      style="ghost"
                                      size="sm"
                                      className="w-full"
                                    >
                                      Показати ще {Math.min(normalizedCardPageSize, remainingIssueCount)} · лишилося {remainingIssueCount}
                                    </Button>
                                  </div>
                                )}
                                <div className="shrink-0 h-[4px]" />
                              </div>
                            )}
                          </Droppable>
                        );
                      })()}
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
