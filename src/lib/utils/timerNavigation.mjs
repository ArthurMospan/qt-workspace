function positiveMinutes(value) {
  const minutes = Math.round(Number(value));
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

export function timerTargetHref(timer, { minutes } = {}) {
  if (!timer) return '';

  const loggedMinutes = positiveMinutes(minutes);

  if (timer.entityType === 'calendar_event' && timer.eventId) {
    const search = new URLSearchParams();
    if (timer.occurrenceStartAt) search.set('occurrence', timer.occurrenceStartAt);
    if (loggedMinutes) search.set('logTime', String(loggedMinutes));
    const query = search.toString();
    return `/calendar/event/${encodeURIComponent(timer.eventId)}${query ? `?${query}` : ''}`;
  }

  if (!timer.projectId || !timer.issueId) return '';
  const query = loggedMinutes ? `?logTime=${loggedMinutes}` : '';
  return `/${encodeURIComponent(timer.projectId)}/issue/${encodeURIComponent(timer.issueId)}${query}`;
}
