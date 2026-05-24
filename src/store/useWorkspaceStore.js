// src/store/useWorkspaceStore.js — Zustand: timer + toast
import { create } from 'zustand';

export const useWorkspaceStore = create((set, get) => ({
  // ── Toast ──────────────────────────────────────────────────────────
  toast: null,
  showToast: (message, type = 'success') => {
    set({ toast: { message, type, id: Date.now() } });
    setTimeout(() => set({ toast: null }), 3500);
  },
  clearToast: () => set({ toast: null }),

  // ── Active Timer ───────────────────────────────────────────────────
  activeTimer: null,     // { issueId, startedAt }
  timerElapsed: 0,       // seconds
  _timerInterval: null,

  startTimer: (issueId) => {
    const { _timerInterval, activeTimer } = get();

    // Stop existing if running
    if (_timerInterval) clearInterval(_timerInterval);

    const startedAt = Date.now();
    const interval = setInterval(() => {
      set({ timerElapsed: Math.floor((Date.now() - startedAt) / 1000) });
    }, 1000);

    set({
      activeTimer: { issueId, startedAt },
      timerElapsed: 0,
      _timerInterval: interval,
    });
  },

  stopTimer: () => {
    const { _timerInterval, activeTimer, timerElapsed } = get();
    if (_timerInterval) clearInterval(_timerInterval);

    if (!activeTimer) return null;

    const result = {
      issueId: activeTimer.issueId,
      minutes: Math.max(1, Math.round(timerElapsed / 60)),
    };

    set({ activeTimer: null, timerElapsed: 0, _timerInterval: null });
    return result;
  },

  formatElapsed: (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  },
}));
