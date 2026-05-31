// src/store/useWorkspaceStore.js
import { create } from 'zustand';

function formatElapsed(seconds) {
  const s   = Math.max(0, Math.floor(seconds));
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = n => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

const useWorkspaceStore = create((set, get) => ({

  // ── Timer ─────────────────────────────────────────────────────────
  activeTimer:    null,   // { issueId, startedAt }
  timerElapsed:   0,      // seconds
  _timerInterval: null,

  startTimer: (issueId) => {
    const { _timerInterval } = get();
    if (_timerInterval) clearInterval(_timerInterval);
    const startedAt = Date.now();
    const interval  = setInterval(() => set({ timerElapsed: Math.floor((Date.now() - startedAt) / 1000) }), 1000);
    set({ activeTimer: { issueId, startedAt }, timerElapsed: 0, _timerInterval: interval });
  },

  stopTimer: () => {
    const { activeTimer, timerElapsed, _timerInterval } = get();
    if (_timerInterval) clearInterval(_timerInterval);
    if (!activeTimer) { set({ _timerInterval: null }); return null; }
    const result = { issueId: activeTimer.issueId, minutes: Math.round(timerElapsed / 60) };
    set({ activeTimer: null, timerElapsed: 0, _timerInterval: null });
    return result;
  },

  formatElapsed,

  // ── Toast ─────────────────────────────────────────────────────────
  toast: null,
  showToast: (message, type = 'success') => {
    set({ toast: { message, type, id: Date.now() } });
    setTimeout(() => set({ toast: null }), 3500);
  },
  clearToast: () => set({ toast: null }),

  // ── Live notification popup (real-time) ───────────────────────────
  liveNotif: null,   // { id, title, body, type, link }
  showLiveNotif: (notif) => {
    set({ liveNotif: notif });
    setTimeout(() => set({ liveNotif: null }), 6000);
  },
  clearLiveNotif: () => set({ liveNotif: null }),

  // ── Breadcrumbs (set by each page) ────────────────────────────────
  breadcrumbs: [],   // [{ label, href? }]
  setBreadcrumbs: (crumbs) => set({ breadcrumbs: crumbs }),

  // ── Chat search (synced between header and chat page) ─────────────
  chatSearch: '',
  setChatSearch: (q) => set({ chatSearch: q }),

  // ── Chat online users (synced from chat page to header) ───────────
  chatOnlineUsers: [],
  setChatOnlineUsers: (users) => set({ chatOnlineUsers: users }),
}));

export default useWorkspaceStore;
