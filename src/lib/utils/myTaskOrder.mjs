import { compareIssues, resolveDropIndex } from './optimistic.mjs';

export function normalizeMyTaskOrders(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([issueId, order]) => (
        typeof issueId === 'string'
        && issueId
        && Number.isFinite(order)
        && order >= 0
      ))
      .map(([issueId, order]) => [issueId, Math.trunc(order)]),
  );
}

export function compareMyTaskIssues(orders = {}) {
  return (a, b) => {
    const aOrder = orders[a?.id];
    const bOrder = orders[b?.id];
    const aOrdered = Number.isFinite(aOrder);
    const bOrdered = Number.isFinite(bOrder);
    if (aOrdered && bOrdered && aOrder !== bOrder) return aOrder - bOrder;
    if (aOrdered !== bOrdered) return aOrdered ? -1 : 1;
    const fallback = compareIssues(a, b);
    if (fallback !== 0) return fallback;
    return String(a?.id || '').localeCompare(String(b?.id || ''));
  };
}

/**
 * Reorder the personal cross-project board without touching a project's own
 * `order`. Hidden/filter-mismatched cards stay between the visible neighbours
 * the user aimed at, using the same visible-index resolution as other boards.
 */
export function planMyTaskDrop({
  issues,
  issueId,
  targetCategoryId,
  position,
  orders,
  categoryOf,
}) {
  const moving = (issues || []).find(issue => issue.id === issueId);
  if (!moving) return null;

  const compare = compareMyTaskIssues(orders);
  const column = (issues || [])
    .filter(issue => issue.id !== issueId && categoryOf(issue) === targetCategoryId)
    .sort(compare);
  const insertAt = resolveDropIndex(
    column,
    position?.visibleColumnIds || [],
    position?.visibleIndex ?? 0,
  );
  const ordered = [
    ...column.slice(0, insertAt),
    moving,
    ...column.slice(insertAt),
  ];
  const liveIssueIds = new Set((issues || []).map(issue => issue.id));
  const nextOrders = Object.fromEntries(
    Object.entries(normalizeMyTaskOrders(orders))
      .filter(([storedIssueId]) => liveIssueIds.has(storedIssueId)),
  );
  ordered.forEach((issue, index) => {
    nextOrders[issue.id] = index;
  });

  return { insertAt, ordered, orders: nextOrders };
}
