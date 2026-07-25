// Shared recurrence maths for the calendar. The client (useCalendarEvents) and
// the reminder job (/api/calendar/reminders) MUST agree on which occurrences
// exist, otherwise a reminder fires for a slot the calendar never showed.

// Advancing a monthly series with setMonth() alone drifts: 31 January + 1 month
// lands on 3 March, and every later occurrence inherits the shift. The day of
// month is anchored to the series start and clamped to the target month's
// length instead, so the 31st becomes the 28th/30th and then returns to the 31st.
export function addRecurrence(date, frequency, interval, anchorDayOfMonth = null) {
  const next = new Date(date);
  if (frequency === 'daily') {
    next.setDate(next.getDate() + interval);
    return next;
  }
  if (frequency === 'weekly') {
    next.setDate(next.getDate() + 7 * interval);
    return next;
  }
  if (frequency === 'monthly') {
    const anchorDay = anchorDayOfMonth ?? date.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + interval);
    const daysInTargetMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(anchorDay, daysInTargetMonth));
    return next;
  }
  return next;
}

// Occurrences of a series that overlap [windowStart, windowEnd].
//
// Callers used to walk from the series start with a fixed iteration cap, which
// silently truncated long-running series: a daily event older than the cap
// simply stopped producing occurrences — no error, no reminders, nothing on the
// calendar. Here the walk is seeded near the window, so the cost depends on the
// window length rather than on how old the series is, and `truncated` reports
// the case where a window genuinely holds more occurrences than the cap.
export function expandOccurrences({
  start,
  frequency = 'none',
  interval = 1,
  until = null,
  windowStart,
  windowEnd,
  maxOccurrences = 1000,
}) {
  const seriesStart = new Date(start);
  if (!Number.isFinite(seriesStart.getTime())) return { occurrences: [], truncated: false };
  if (frequency === 'none' || !['daily', 'weekly', 'monthly'].includes(frequency)) {
    const withinWindow = seriesStart <= windowEnd && seriesStart >= windowStart;
    return { occurrences: withinWindow ? [new Date(seriesStart)] : [], truncated: false };
  }

  const step = Math.max(1, Math.floor(Number(interval) || 1));
  const limit = until && Number.isFinite(new Date(until).getTime())
    ? new Date(Math.min(new Date(until).getTime(), windowEnd.getTime()))
    : windowEnd;

  const anchorDayOfMonth = seriesStart.getDate();
  let cursor = new Date(seriesStart);

  // Jump close to the window instead of stepping through years of history.
  if (cursor < windowStart) {
    const approxStepDays = frequency === 'daily' ? step : frequency === 'weekly' ? 7 * step : 30 * step;
    const behindDays = (windowStart.getTime() - cursor.getTime()) / 86_400_000;
    const skip = Math.max(0, Math.floor(behindDays / approxStepDays) - 1);
    for (let index = 0; index < skip; index += 1) {
      cursor = addRecurrence(cursor, frequency, step, anchorDayOfMonth);
    }
    // The estimate is deliberately short; close the remaining gap exactly.
    let guard = 0;
    while (cursor < windowStart && guard < maxOccurrences) {
      const next = addRecurrence(cursor, frequency, step, anchorDayOfMonth);
      if (next.getTime() <= cursor.getTime()) break;
      cursor = next;
      guard += 1;
    }
  }

  const occurrences = [];
  let truncated = false;
  while (cursor <= limit) {
    if (occurrences.length >= maxOccurrences) {
      truncated = true;
      break;
    }
    if (cursor >= windowStart) occurrences.push(new Date(cursor));
    const next = addRecurrence(cursor, frequency, step, anchorDayOfMonth);
    if (next.getTime() <= cursor.getTime()) break;
    cursor = next;
  }
  return { occurrences, truncated };
}
