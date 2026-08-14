const DAY_MS = 86_400_000;

function timestampMillis(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (Number.isFinite(value?.seconds)) return value.seconds * 1000;
  if (typeof value === 'string') {
    const millis = new Date(value).getTime();
    return Number.isFinite(millis) ? millis : 0;
  }
  return 0;
}

export function issueCycleStartMillis(issue) {
  const createdAt = timestampMillis(issue?.createdAt);
  const isYouTrackIssue = issue?.source === 'youtrack'
    || issue?.importMetadata?.provider === 'youtrack';
  if (!isYouTrackIssue) return createdAt;

  const importedAt = timestampMillis(
    issue?.importedAt || issue?.importMetadata?.importedAt,
  );
  return importedAt > 0 ? Math.max(createdAt, importedAt) : createdAt;
}

/**
 * Build cycle-time metrics without allowing corrupted dates to disappear.
 * Imported YouTrack history starts no earlier than the first QuickTeam import;
 * a completion before that lower bound is reported as a data error.
 */
export function summarizeCycleTimes(issues, getCompletedAtMillis) {
  const values = [];
  const invalidIssueIds = [];

  for (const issue of issues || []) {
    const startedAt = issueCycleStartMillis(issue);
    const completedAt = Number(getCompletedAtMillis(issue)) || 0;
    if (startedAt <= 0 || completedAt <= 0) continue;

    const days = (completedAt - startedAt) / DAY_MS;
    if (days < 0) {
      invalidIssueIds.push(issue.id || issue.issueKey || 'unknown');
      continue;
    }
    values.push(days);
  }

  return {
    averageDays: values.length > 0
      ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
      : null,
    invalidIssueIds,
  };
}
