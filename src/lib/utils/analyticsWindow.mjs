// The window an analytics screen is actually looking at.
//
// A report shows a period. It used to *read* a history: the analytics
// subscription asked Firestore for every time log the organization had ever
// written and threw away everything outside the chosen 7/14/30/90 days in the
// browser. Tasks are a finite set — one per piece of work — but a time log is
// written every time somebody stops a timer, by every person, every day, and it
// is never deleted. After two years that is tens of thousands of documents on
// every cold open of the screen, against a daily read quota this product has
// already exhausted twice.
//
// So the period stops being a filter and becomes part of the query. These are
// the only two windows the analytics screens ask for, and they are computed
// here — in one pure module — so that the bound in the query and the predicate
// in the component cannot drift into two different answers.
//
// Both windows are half-open on the right where they have a right edge:
// `sinceMillis <= loggedAt < untilMillis`. `untilMillis === null` means «no
// upper bound», which is what a trailing period wants: a log may carry a date
// the person typed in, and that date can be in the future.

export const DAY_MS = 86_400_000;

/** The 7/14/30/90 the period control offers, in one place. */
export const ANALYTICS_PERIOD_DAYS = [7, 14, 30, 90];

export function startOfLocalDay(millis) {
  const date = new Date(millis);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * The trailing period behind «за 30 днів».
 *
 * Aligned to local midnight rather than to the current instant on purpose. The
 * overview re-reads the clock every minute to keep «прострочено зараз» honest,
 * and a bound that moved with it would rebuild the Firestore query sixty times
 * an hour. Midnight alignment makes the window slightly wider than the
 * component's own `now - period` predicate, never narrower, so the numbers stay
 * exactly what they were.
 */
export function periodTimeLogWindow(nowMillis, periodDays) {
  const days = Number(periodDays);
  if (!Number.isFinite(nowMillis) || !Number.isFinite(days) || days <= 0) return null;
  return {
    sinceMillis: startOfLocalDay(nowMillis) - Math.ceil(days) * DAY_MS,
    untilMillis: null,
  };
}

/**
 * The week or the month the timesheet is currently showing.
 *
 * This is the range «Табель» lays its grid out over, and it is the range it
 * reads. Paging back to March does not re-read everything since March: it moves
 * the window, both edges of it.
 */
export function timesheetRange(mode, anchor) {
  const base = anchor instanceof Date ? anchor : new Date(anchor);
  const at = Number.isFinite(base.getTime()) ? base : new Date();
  if (mode === 'month') {
    return {
      start: new Date(at.getFullYear(), at.getMonth(), 1),
      end: new Date(at.getFullYear(), at.getMonth() + 1, 1),
    };
  }
  const start = new Date(at);
  const weekday = start.getDay();
  start.setDate(start.getDate() - (weekday === 0 ? 6 : weekday - 1));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

export function timesheetTimeLogWindow(mode, anchor) {
  const { start, end } = timesheetRange(mode, anchor);
  return { sinceMillis: start.getTime(), untilMillis: end.getTime() };
}

/**
 * A stable identity for a window, so a hook can re-subscribe when the window
 * moves and stay put when only the object identity changed.
 */
export function timeLogWindowKey(window) {
  if (!window) return 'none';
  return `${window.sinceMillis ?? ''}:${window.untilMillis ?? ''}`;
}

export function isTimeLogWindow(window) {
  return Boolean(window)
    && Number.isFinite(window.sinceMillis)
    && (window.untilMillis === null
      || window.untilMillis === undefined
      || Number.isFinite(window.untilMillis));
}
