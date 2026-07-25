export function filterTeamIssues(issues = [], projectIds = [], memberId = 'all') {
  return issues.filter(issue => {
    if (projectIds.length > 0 && !projectIds.includes(issue.projectId)) return false;
    if (memberId !== 'all' && !issue.assigneeIds?.includes(memberId)) return false;
    return true;
  });
}

export function filterTeamTimeLogs(timeLogs = [], projectIds = [], memberId = 'all') {
  return timeLogs.filter(log => {
    if (projectIds.length > 0 && !projectIds.includes(log.projectId)) return false;
    if (memberId !== 'all' && log.userId !== memberId) return false;
    return true;
  });
}
