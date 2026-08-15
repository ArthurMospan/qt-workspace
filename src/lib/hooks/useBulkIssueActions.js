'use client';

import { useCallback, useMemo } from 'react';
import { bulkIssuesViaApi } from '@/lib/services/issues';
import { useOptimisticPatch } from '@/lib/hooks/useOptimisticPatch';
import { optimisticBulkPatches } from '@/lib/bulk/issueBulkOptimistic.mjs';
import { MAX_BULK_ISSUES } from '@/lib/bulk/issueBulkActions.mjs';

function batches(values, size) {
  const result = [];
  for (let offset = 0; offset < values.length; offset += size) {
    result.push(values.slice(offset, offset + size));
  }
  return result;
}

function resultMessage(result, selectedIssues, action) {
  const failed = result?.failed || [];
  const completed = result?.updated?.length || 0;
  const requested = result?.requested || selectedIssues.length;
  const base = action === 'duplicate'
    ? `Створено копій: ${completed} із ${requested}`
    : action === 'archive'
      ? `Архівовано ${completed} із ${requested}`
      : `Оновлено ${completed} із ${requested}`;
  if (!failed.length) return base;
  const byId = new Map(selectedIssues.map(issue => [issue.id, issue.issueKey || issue.title || issue.id]));
  const reasons = failed
    .slice(0, 4)
    .map(item => `${byId.get(item.id) || item.id}: ${item.reason}`)
    .join('; ');
  const rest = failed.length > 4 ? `; ще ${failed.length - 4}` : '';
  return `${base}; ${failed.length} не змінено — ${reasons}${rest}`;
}

export function useBulkIssueActions({
  issues = [],
  organizationId,
  showToast,
  resolveStatusId,
}) {
  const [optimisticIssues, applyPatch, revertPatch] = useOptimisticPatch(issues);
  const visibleIssues = useMemo(
    () => optimisticIssues.filter(issue => !issue._bulkArchived),
    [optimisticIssues],
  );

  const applyBulkAction = useCallback(async (action, value, selectedIssues) => {
    const scopedIssues = (selectedIssues || []).filter(issue => issue?.id);
    if (!organizationId || !scopedIssues.length) return null;
    const issueIds = scopedIssues.map(issue => issue.id);
    const optimistic = optimisticBulkPatches(scopedIssues, action, value, resolveStatusId);
    applyPatch(optimistic);

    try {
      // The endpoint is deliberately bounded. A user-facing «select all» must
      // still mean all, so larger selections are sent as safe server-sized
      // batches and merged into one partial-result contract.
      const result = { requested: issueIds.length, updated: [], failed: [] };
      for (const issueIdBatch of batches(issueIds, MAX_BULK_ISSUES)) {
        try {
          const batch = await bulkIssuesViaApi({
            organizationId,
            issueIds: issueIdBatch,
            action,
            value,
          });
          result.updated.push(...(batch.updated || []));
          result.failed.push(...(batch.failed || []));
        } catch (error) {
          const reason = error?.message || 'Не вдалося виконати масову дію';
          result.failed.push(...issueIdBatch.map(id => ({ id, reason })));
        }
      }
      const failedIds = (result.failed || []).map(item => item.id);
      if (failedIds.length) revertPatch(failedIds);

      // Category operations resolve to each project's real status on the
      // server. Replace a guessed optimistic status with that authoritative
      // per-task patch as soon as the response arrives.
      const serverPatches = Object.fromEntries((result.updated || []).flatMap(item => (
        item.patch ? [[item.id, item.patch]] : []
      )));
      applyPatch(serverPatches);
      showToast?.(resultMessage(result, scopedIssues, action), failedIds.length ? 'error' : undefined);
      return result;
    } catch (error) {
      revertPatch(issueIds);
      showToast?.(error?.message || 'Не вдалося виконати масову дію', 'error');
      return {
        requested: issueIds.length,
        updated: [],
        failed: issueIds.map(id => ({ id, reason: error?.message || 'Не вдалося виконати масову дію' })),
      };
    }
  }, [applyPatch, organizationId, resolveStatusId, revertPatch, showToast]);

  return { issues: visibleIssues, applyBulkAction };
}

export default useBulkIssueActions;
