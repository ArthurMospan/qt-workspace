export const MAX_TIMER_DURATION_MS = 12 * 60 * 60 * 1000;

export function timerStartBlock(state) {
  if (state?.pending) return 'pending';
  if (state?.active) return 'active';
  return null;
}

export function timerStopDecision(state, timerId) {
  if (!state) return 'missing';
  if (!state.active && state.pending?.id === timerId) return 'idempotent';
  if (!state.active || state.active.id !== timerId) return 'changed';
  return 'stop';
}

export function clampedTimerStopMillis(startedAtMs, requestedAtMs, nowMs) {
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(nowMs)) return null;
  const candidate = Number.isFinite(requestedAtMs) ? requestedAtMs : nowMs;
  return Math.min(
    nowMs,
    startedAtMs + MAX_TIMER_DURATION_MS,
    Math.max(startedAtMs, candidate),
  );
}

export function timerMinutes(startedAtMs, stoppedAtMs) {
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(stoppedAtMs)) return null;
  return Math.max(1, Math.ceil((stoppedAtMs - startedAtMs) / 60_000));
}
