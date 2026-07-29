import { existingParentIssueId } from './issueHierarchyModel.mjs';

function cleanId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function doneSetOf(doneStatusIds) {
  return doneStatusIds instanceof Set ? doneStatusIds : new Set(doneStatusIds || []);
}

export function issueStatusId(issue) {
  return issue?.columnId || issue?.status || null;
}

export function openChildIssues(issueId, issues = [], doneStatusIds = []) {
  const currentId = cleanId(issueId);
  if (!currentId) return [];
  const doneSet = doneSetOf(doneStatusIds);
  return issues.filter(candidate => (
    existingParentIssueId(candidate) === currentId
    && !doneSet.has(issueStatusId(candidate))
  ));
}

function blockerIdFor(link, issueId) {
  if (!link || !issueId) return null;
  if (link.relationType === 'blocks' && link.targetIssueId === issueId) {
    return cleanId(link.sourceIssueId);
  }
  // Compatibility with a partially migrated legacy pair. The old API wrote
  // both `blocks` and its `is-blocked-by` inverse.
  if (link.relationType === 'is-blocked-by' && link.sourceIssueId === issueId) {
    return cleanId(link.targetIssueId);
  }
  return null;
}

export function openBlockerIssues(
  issueId,
  issues = [],
  issueLinks = [],
  doneStatusIds = [],
) {
  const currentId = cleanId(issueId);
  if (!currentId) return [];
  const doneSet = doneSetOf(doneStatusIds);
  const byId = new Map(
    issues.flatMap(issue => {
      const id = cleanId(issue?.id);
      return id ? [[id, issue]] : [];
    }),
  );
  const seen = new Set();
  const blockers = [];

  for (const link of issueLinks || []) {
    const blockerId = blockerIdFor(link, currentId);
    if (!blockerId || seen.has(blockerId)) continue;
    seen.add(blockerId);
    const blocker = byId.get(blockerId)
      || (link.sourceIssueId === blockerId ? link.sourceIssue : link.targetIssue)
      || null;
    // A dangling legacy link is reviewable data, but it must not permanently
    // prevent work from being completed when the referenced task no longer
    // exists.
    if (blocker && !doneSet.has(issueStatusId(blocker))) blockers.push(blocker);
  }

  return blockers;
}

export function issueCompletionBlockers({
  issueId,
  issues = [],
  issueLinks = [],
  doneStatusIds = [],
} = {}) {
  const children = openChildIssues(issueId, issues, doneStatusIds);
  const dependencies = openBlockerIssues(
    issueId,
    issues,
    issueLinks,
    doneStatusIds,
  );
  return {
    children,
    dependencies,
    canComplete: children.length === 0 && dependencies.length === 0,
  };
}
