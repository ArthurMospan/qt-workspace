'use client';

import { useEffect, useState } from 'react';

import { startOfLocalDay } from '@/lib/utils/analyticsWindow.mjs';

/**
 * Local midnight, as a value a render may depend on.
 *
 * The analytics window is «the last N days», and N days back from *now* moves
 * with the clock: reading `Date.now()` during render would rebuild the
 * Firestore query on every re-render, and a session left open overnight would
 * otherwise go on reporting yesterday's period. Midnight is the only edge that
 * matters to a window measured in days, so that is the only thing this
 * publishes — and it changes once a day.
 */
export function useLocalDayStart() {
  const [dayStart, setDayStart] = useState(() => startOfLocalDay(Date.now()));

  useEffect(() => {
    const tick = () => setDayStart(current => {
      const next = startOfLocalDay(Date.now());
      return next === current ? current : next;
    });
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, []);

  return dayStart;
}
