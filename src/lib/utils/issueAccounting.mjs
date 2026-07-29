import { existingParentIssueId } from './issueHierarchyModel.mjs';

const CALENDAR_EVENT_SOURCE = 'calendar_event';

function normalizedId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function sharesIssueScope(child, parent) {
  if (child?.projectId && parent?.projectId && child.projectId !== parent.projectId) {
    return false;
  }
  if (
    child?.organizationId
    && parent?.organizationId
    && child.organizationId !== parent.organizationId
  ) {
    return false;
  }
  return true;
}

function cyclicChildIds(parentIdByChild) {
  const cyclicIds = new Set();
  const resolved = new Set();

  for (const startId of parentIdByChild.keys()) {
    if (resolved.has(startId)) continue;

    const path = [];
    const positionById = new Map();
    let currentId = startId;

    while (currentId && parentIdByChild.has(currentId) && !resolved.has(currentId)) {
      const cycleStart = positionById.get(currentId);
      if (cycleStart !== undefined) {
        path.slice(cycleStart).forEach(id => cyclicIds.add(id));
        break;
      }
      positionById.set(currentId, path.length);
      path.push(currentId);
      currentId = parentIdByChild.get(currentId);
    }

    path.forEach(id => resolved.add(id));
  }

  return cyclicIds;
}

/**
 * Builds the accounting view of task hierarchy.
 *
 * Only a resolvable same-project/same-organization `parentIssueId` creates an
 * edge. Broken legacy pointers stay visible as standalone work, while cyclic
 * pointers are ignored rather than making every task in a cycle disappear
 * from reports.
 */
export function buildIssueAccountingIndex(issues = []) {
  const byId = new Map();
  issues.forEach(issue => {
    const id = normalizedId(issue?.id);
    if (id && !byId.has(id)) byId.set(id, issue);
  });

  const candidateParentIdByChild = new Map();
  const orphanIssueIds = new Set();

  byId.forEach((issue, issueId) => {
    const parentId = normalizedId(existingParentIssueId(issue));
    if (!parentId) return;
    const parent = byId.get(parentId);
    if (
      !parent
      || parentId === issueId
      || !sharesIssueScope(issue, parent)
    ) {
      orphanIssueIds.add(issueId);
      return;
    }
    candidateParentIdByChild.set(issueId, parentId);
  });

  const cycleIssueIds = cyclicChildIds(candidateParentIdByChild);
  const parentIdByChild = new Map();
  const childIdsByParent = new Map();

  candidateParentIdByChild.forEach((parentId, childId) => {
    if (cycleIssueIds.has(childId)) return;
    parentIdByChild.set(childId, parentId);
    const childIds = childIdsByParent.get(parentId) || [];
    childIds.push(childId);
    childIdsByParent.set(parentId, childIds);
  });

  const summaryIssueIds = new Set(childIdsByParent.keys());
  const actionableIssueIds = new Set(
    [...byId.keys()].filter(id => !summaryIssueIds.has(id)),
  );

  return {
    actionableIssueIds,
    byId,
    childIdsByParent,
    cycleIssueIds,
    orphanIssueIds,
    parentIdByChild,
    summaryIssueIds,
  };
}

/**
 * Selects leaf tasks plus standalone top-level tasks, preserving the order of
 * the supplied list. `hierarchyIssues` may be wider than `issues`, which keeps
 * a parent classified as a summary even when its children are hidden by a UI
 * filter or assigned to another member.
 */
export function selectActionableIssues(issues = [], hierarchyIssues = issues) {
  const { summaryIssueIds } = buildIssueAccountingIndex(hierarchyIssues);
  return issues.filter(issue => {
    const id = normalizedId(issue?.id);
    return !id || !summaryIssueIds.has(id);
  });
}

function actionableDescendantIds(parentId, index) {
  const result = [];
  const pending = [...(index.childIdsByParent.get(parentId) || [])];
  const visited = new Set([parentId]);

  while (pending.length > 0) {
    const issueId = pending.pop();
    if (!issueId || visited.has(issueId)) continue;
    visited.add(issueId);
    const children = index.childIdsByParent.get(issueId) || [];
    if (children.length === 0) result.push(issueId);
    else pending.push(...children);
  }

  return result;
}

/**
 * Parent progress is intentionally separate from task throughput. A nested
 * legacy hierarchy is reduced to its leaf descendants so it cannot count an
 * intermediate summary and its children at the same time.
 */
export function buildParentIssueProgress(issues = [], doneStatusIds = []) {
  const index = buildIssueAccountingIndex(issues);
  const doneSet = doneStatusIds instanceof Set
    ? doneStatusIds
    : new Set(doneStatusIds);

  return [...index.summaryIssueIds].map(parentId => {
    const childIds = actionableDescendantIds(parentId, index);
    const done = childIds.reduce((count, childId) => {
      const child = index.byId.get(childId);
      const statusId = child?.columnId || child?.status;
      return count + (doneSet.has(statusId) ? 1 : 0);
    }, 0);
    return {
      issue: index.byId.get(parentId),
      issueId: parentId,
      childIds,
      total: childIds.length,
      done,
      percent: childIds.length > 0 ? Math.round((done / childIds.length) * 100) : 0,
    };
  });
}

function validMinutes(value) {
  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

export function isValidRawTimeLogMinutes(value) {
  const minutes = Number(value);
  return Number.isSafeInteger(minutes) && minutes > 0 && minutes <= 525_600;
}

function validRawLogMinutes(value) {
  return isValidRawTimeLogMinutes(value) ? Number(value) : 0;
}

/**
 * Aggregates each raw task time log once and retains source IDs for invoice
 * traceability. Calendar occurrence logs are handled by their own billing
 * grouping and are deliberately excluded here.
 */
export function aggregateIssueTimeLogs(logs = []) {
  const byIssue = {};
  const seenLogIds = new Set();

  logs.forEach(log => {
    if (
      log?.sourceType === CALENDAR_EVENT_SOURCE
      || log?.eventId
    ) {
      return;
    }
    const issueId = normalizedId(log?.issueId);
    if (!issueId) return;
    if (!isValidRawTimeLogMinutes(log?.spentMinutes)) return;

    const logId = normalizedId(log?.id);
    if (logId && seenLogIds.has(logId)) return;
    if (logId) seenLogIds.add(logId);

    if (!byIssue[issueId]) {
      byIssue[issueId] = { totalMinutes: 0, byUser: {}, logIds: [] };
    }
    const minutes = validRawLogMinutes(log?.spentMinutes);
    byIssue[issueId].totalMinutes += minutes;

    const userId = normalizedId(log?.userId);
    if (userId) {
      byIssue[issueId].byUser[userId] = (
        byIssue[issueId].byUser[userId] || 0
      ) + minutes;
    }
    if (logId) byIssue[issueId].logIds.push(logId);
  });

  return byIssue;
}

export function sumRawTimeLogMinutes(logs = []) {
  const seenLogIds = new Set();
  return logs.reduce((total, log) => {
    const logId = normalizedId(log?.id);
    if (logId && seenLogIds.has(logId)) return total;
    if (logId) seenLogIds.add(logId);
    return total + validRawLogMinutes(log?.spentMinutes);
  }, 0);
}

export function calculateBillingAutoPrice({
  issue,
  logSummary,
  rates = {},
  isSummaryParent = false,
} = {}) {
  const totalMinutes = validMinutes(logSummary?.totalMinutes);
  if (totalMinutes > 0) {
    return Object.entries(logSummary?.byUser || {}).reduce(
      (total, [userId, minutes]) => (
        total + (validMinutes(minutes) / 60) * (Number(rates[userId]) || 0)
      ),
      0,
    );
  }

  // A parent estimate is a planning rollup. Billing it in addition to its
  // children would duplicate money, so parents only use their own actual logs.
  if (isSummaryParent) return 0;

  const estimateMinutes = validMinutes(issue?.estimateMinutes);
  if (estimateMinutes <= 0) return 0;
  const assigneeId = normalizedId(issue?.assigneeIds?.[0]);
  return (estimateMinutes / 60) * (assigneeId ? (Number(rates[assigneeId]) || 0) : 0);
}

/**
 * Summary parents are absent from estimated billing, but remain available when
 * they have time logged directly against themselves. Their children and
 * standalone tasks retain the usual actual-time/estimate fallback.
 */
export function selectBillableIssues(
  issues = [],
  timeLogsByIssue = {},
  hierarchyIssues = issues,
) {
  const { summaryIssueIds } = buildIssueAccountingIndex(hierarchyIssues);
  return issues.filter(issue => {
    const issueId = normalizedId(issue?.id);
    if (!issueId || !summaryIssueIds.has(issueId)) return true;
    return validMinutes(timeLogsByIssue[issueId]?.totalMinutes) > 0;
  });
}

/**
 * Incremental invoicing uses only currently unbilled actual logs. A task that
 * has ever had actual time must not fall back to its estimate after those logs
 * are invoiced; it reappears only when new unbilled actual logs are added.
 */
export function selectIncrementalBillableIssues(
  issues = [],
  availableTimeLogsByIssue = {},
  allTimeLogsByIssue = availableTimeLogsByIssue,
  hierarchyIssues = issues,
) {
  const index = buildIssueAccountingIndex(hierarchyIssues);
  return selectBillableIssues(
    issues,
    availableTimeLogsByIssue,
    hierarchyIssues,
  ).filter(issue => {
    const issueId = normalizedId(issue?.id);
    const availableActual = validMinutes(
      availableTimeLogsByIssue[issueId]?.totalMinutes,
    ) > 0;
    if (availableActual) return true;
    if (index.summaryIssueIds.has(issueId)) return false;
    return (allTimeLogsByIssue[issueId]?.logIds || []).length === 0;
  });
}

export function collectSourceTimeLogIds(items = [], timeLogsByItem = {}) {
  const ids = new Set();
  items.forEach(item => {
    (timeLogsByItem[item?.id]?.logIds || []).forEach(id => {
      const normalized = normalizedId(id);
      if (normalized) ids.add(normalized);
    });
  });
  return [...ids];
}

const CANCELLED_INVOICE_STATUSES = new Set([
  'cancelled',
  'canceled',
  'void',
  'voided',
]);

export function collectReservedInvoiceTimeLogIds(invoices = []) {
  const reservedIds = new Set();
  invoices.forEach(invoice => {
    const status = typeof invoice?.status === 'string'
      ? invoice.status.trim().toLowerCase()
      : '';
    if (CANCELLED_INVOICE_STATUSES.has(status)) return;
    const sourceIds = [
      ...(Array.isArray(invoice?.sourceTimeLogIds) ? invoice.sourceTimeLogIds : []),
      ...(Array.isArray(invoice?.items)
        ? invoice.items.flatMap(item => (
          Array.isArray(item?.sourceTimeLogIds) ? item.sourceTimeLogIds : []
        ))
        : []),
    ];
    sourceIds.forEach(id => {
      const normalized = normalizedId(id);
      if (normalized) reservedIds.add(normalized);
    });
  });
  return reservedIds;
}

export function collectReservedInvoiceItemIds(invoices = []) {
  const reservedIds = new Set();
  invoices.forEach(invoice => {
    const status = typeof invoice?.status === 'string'
      ? invoice.status.trim().toLowerCase()
      : '';
    if (CANCELLED_INVOICE_STATUSES.has(status)) return;
    (Array.isArray(invoice?.items) ? invoice.items : []).forEach(item => {
      const itemId = normalizedId(item?.itemId);
      const sourceIds = Array.isArray(item?.sourceTimeLogIds)
        ? item.sourceTimeLogIds.filter(id => normalizedId(id))
        : [];
      // An estimate/manual position without raw logs reserves the whole
      // billing item. Actual-time positions reserve only their source logs.
      if (itemId && sourceIds.length === 0) reservedIds.add(itemId);
    });
  });
  return reservedIds;
}

export function collectAmbiguousLegacyInvoiceKeys(invoices = []) {
  const keys = new Set();
  invoices.forEach(invoice => {
    const status = typeof invoice?.status === 'string'
      ? invoice.status.trim().toLowerCase()
      : '';
    if (CANCELLED_INVOICE_STATUSES.has(status)) return;
    (Array.isArray(invoice?.items) ? invoice.items : []).forEach(item => {
      const itemId = normalizedId(item?.itemId);
      const sourceIds = Array.isArray(item?.sourceTimeLogIds)
        ? item.sourceTimeLogIds.filter(id => normalizedId(id))
        : [];
      const key = normalizedId(item?.key);
      if (!itemId && sourceIds.length === 0 && key) keys.add(key);
    });
  });
  return keys;
}

/**
 * Drafts reserve source logs too: the current UI has no cancel/delete flow, so
 * silently issuing a second draft from the same work is more dangerous than
 * requiring the user to deselect the conflicting row. Cancelled/void invoices
 * release their sources, and estimate-only rows never conflict.
 */
export function findInvoiceTimeLogOverlap(
  items = [],
  timeLogsByItem = {},
  invoices = [],
) {
  const reservedIds = collectReservedInvoiceTimeLogIds(invoices);
  const reservedItemIds = collectReservedInvoiceItemIds(invoices);
  const ambiguousLegacyKeys = collectAmbiguousLegacyInvoiceKeys(invoices);
  const byItemId = {};
  const overlappingIds = new Set();
  const overlappingItemIds = new Set();

  items.forEach(item => {
    const itemId = normalizedId(item?.id);
    if (!itemId) return;
    const overlap = (timeLogsByItem[itemId]?.logIds || []).filter(id => (
      reservedIds.has(normalizedId(id))
    ));
    const itemReserved = (
      reservedItemIds.has(itemId)
      || ambiguousLegacyKeys.has(normalizedId(item?.issueKey || item?.key))
    );
    if (overlap.length === 0 && !itemReserved) return;
    byItemId[itemId] = [...new Set(overlap)];
    overlap.forEach(id => overlappingIds.add(id));
    if (itemReserved) overlappingItemIds.add(itemId);
  });

  return {
    byItemId,
    itemIds: Object.keys(byItemId),
    logIds: [...overlappingIds],
    sourceItemIds: [...overlappingItemIds],
  };
}
