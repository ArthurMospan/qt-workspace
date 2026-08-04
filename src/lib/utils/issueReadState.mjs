export function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function issueActivityCursor(issue) {
  return timestampMillis(issue?.lastActivityAt);
}

export function isIssueUnread(issue, lastSeenAt, currentUserId) {
  const activityAt = issueActivityCursor(issue);
  if (!issue?.id || !activityAt || !currentUserId) return false;

  const actorId = issue.lastActivityActorId || issue.updatedBy || issue.createdBy;
  if (actorId && actorId === currentUserId) return false;

  return activityAt > timestampMillis(lastSeenAt);
}
