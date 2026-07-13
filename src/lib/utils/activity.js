'use client';

// Coordinates activity heartbeats between tabs on the same origin. Every tab
// may run a timer, but only the first visible tab that claims the interval is
// allowed to write to Firestore.
export function claimActivityHeartbeat(key, intervalMs) {
  if (typeof window === 'undefined' || document.visibilityState !== 'visible') return false;

  const storageKey = `qt:activity-heartbeat:${key}`;
  const now = Date.now();
  try {
    const previous = Number(window.localStorage.getItem(storageKey) || 0);
    if (now - previous < intervalMs) return false;
    window.localStorage.setItem(storageKey, String(now));
  } catch {
    // If storage is unavailable, keep presence functional in this tab.
  }
  return true;
}
