// src/store/useWorkspaceStore.js — Zustand store for workspace-level state
// Includes: active timer, elapsed tracking, and toast notifications
import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Helper: format seconds → '1:23:45' or '12:34'
// ---------------------------------------------------------------------------
function formatElapsed(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  const pad = (n) => String(n).padStart(2, '0');

  if (h > 0) {
    return `${h}:${pad(m)}:${pad(sec)}`;
  }
  return `${pad(m)}:${pad(sec)}`;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
const useWorkspaceStore = create((set, get) => ({
  // ─── Timer state ─────────────────────────────────────────────────────────
  activeTimer: null,        // null | { issueId: string, startedAt: number }
  timerElapsed: 0,          // seconds since timer started
  _timerInterval: null,     // NodeJS / browser interval ID

  // ─── Toast state ─────────────────────────────────────────────────────────
  toast: null,              // null | { message, type, id }

  // ─── Timer actions ───────────────────────────────────────────────────────

  /**
   * startTimer(issueId)
   * Starts a running timer for the given issue.
   * If a timer is already running, logs a warning.
   */
  startTimer: (issueId) => {
    const { activeTimer, _timerInterval } = get();

    if (activeTimer) {
      console.warn('[useWorkspaceStore] Timer already running for issue', activeTimer.issueId);
    }

    // Clear any orphaned interval
    if (_timerInterval) clearInterval(_timerInterval);

    const startedAt = Date.now();

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      set({ timerElapsed: elapsed });
    }, 1000);

    set({
      activeTimer: { issueId, startedAt },
      timerElapsed: 0,
      _timerInterval: interval,
    });
  },

  /**
   * stopTimer()
   * Stops the running timer.
   * Returns { issueId, minutes } or null if no timer was running.
   */
  stopTimer: () => {
    const { activeTimer, timerElapsed, _timerInterval } = get();

    if (_timerInterval) clearInterval(_timerInterval);

    if (!activeTimer) {
      set({ _timerInterval: null });
      return null;
    }

    const result = {
      issueId: activeTimer.issueId,
      minutes: Math.round(timerElapsed / 60),
    };

    set({
      activeTimer: null,
      timerElapsed: 0,
      _timerInterval: null,
    });

    return result;
  },

  /**
   * formatElapsed(seconds) — pure helper exposed on the store
   */
  formatElapsed,

  // ─── Toast actions ────────────────────────────────────────────────────────

  /**
   * showToast(message, type?)
   * type: 'success' | 'error' | 'info' | 'warning'
   * Auto-clears after 3 seconds.
   */
  showToast: (message, type = 'success') => {
    set({ toast: { message, type, id: Date.now() } });
    setTimeout(() => set({ toast: null }), 3000);
  },

  clearToast: () => set({ toast: null }),
}));

export default useWorkspaceStore;
