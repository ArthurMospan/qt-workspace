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

  startTimer: (issueId, projectId) => {
    const { _timerInterval } = get();
    if (_timerInterval) clearInterval(_timerInterval);
    const startedAt = Date.now();
    const interval  = setInterval(() => set({ timerElapsed: Math.floor((Date.now() - startedAt) / 1000) }), 1000);
    set({ activeTimer: { issueId, projectId, startedAt }, timerElapsed: 0, _timerInterval: interval });
  },

  stopTimer: () => {
    const { activeTimer, timerElapsed, _timerInterval } = get();
    if (_timerInterval) clearInterval(_timerInterval);
    if (!activeTimer) { set({ _timerInterval: null }); return null; }
    const result = { issueId: activeTimer.issueId, projectId: activeTimer.projectId, minutes: Math.max(1, Math.ceil(timerElapsed / 60)) };
    set({ activeTimer: null, timerElapsed: 0, _timerInterval: null });
    return result;
  },

  formatElapsed,

  // ── Toast ─────────────────────────────────────────────────────────
  toast: null,
  showToast: (message, type = 'success', options = {}) => {
    const id = Date.now();
    set({ toast: { message, type, id, action: options.action } });
    const duration = options.duration || 3500;
    setTimeout(() => {
      if (get().toast?.id === id) {
        set({ toast: null });
      }
    }, duration);
  },
  clearToast: () => set({ toast: null }),

  // ── Live notification popup (real-time) ───────────────────────────
  liveNotif: null,   // { id, title, body, type, link }
  showLiveNotif: (notif) => {
    set({ liveNotif: notif });
    setTimeout(() => set({ liveNotif: null }), 6000);
  },
  clearLiveNotif: () => set({ liveNotif: null }),

  // One shared notification stream for the whole workspace. This avoids
  // separate Firestore listeners in the header, sidebar and org switcher.
  notifications: [],
  notificationsLoading: true,
  notificationActions: null,
  setNotificationCenter: (notifications, loading, actions) => set({
    notifications,
    notificationsLoading: loading,
    notificationActions: actions,
  }),
  clearNotificationCenter: () => set({
    notifications: [],
    notificationsLoading: false,
    notificationActions: null,
  }),

  // ── Breadcrumbs (set by each page) ────────────────────────────────
  breadcrumbs: [],   // [{ label, href? }]
  setBreadcrumbs: (crumbs) => set({ breadcrumbs: crumbs }),

  // ── Chat search (synced between header and chat page) ─────────────
  chatSearch: '',
  setChatSearch: (q) => set({ chatSearch: q }),

  // ── Team search (synced between header and team page) ─────────────
  teamSearch: '',
  setTeamSearch: (q) => set({ teamSearch: q }),

  // ── Page-context search ───────────────────────────────────────────
  workspaceSearch: '',
  setWorkspaceSearch: (q) => set({ workspaceSearch: q }),
  myTaskSearch: '',
  setMyTaskSearch: (q) => set({ myTaskSearch: q }),
  projectSearch: '',
  setProjectSearch: (q) => set({ projectSearch: q }),
  sprintSearch: '',
  setSprintSearch: (q) => set({ sprintSearch: q }),
  analyticsSearch: '',
  setAnalyticsSearch: (q) => set({ analyticsSearch: q }),

  // ── Chat online users (synced from chat page to header) ───────────
  chatOnlineUsers: [],
  setChatOnlineUsers: (users) => set({ chatOnlineUsers: users }),

  // ── Localization ──────────────────────────────────────────────────
  localization: null,
  setLocalization: (loc) => set({ localization: loc }),

  // ── Sidebar theme live-preview (settings page → sidebar) ─────────
  sidebarPreview: null,  // { theme: 'dark'|'light'|'custom', color: '#hex' } | null
  setSidebarPreview: (preview) => set({ sidebarPreview: preview }),
  clearSidebarPreview: () => set({ sidebarPreview: null }),
}));

export default useWorkspaceStore;
