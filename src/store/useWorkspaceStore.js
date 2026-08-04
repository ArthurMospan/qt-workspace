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

// The running timer is the one piece of state whose loss costs the user real,
// unrecoverable work, so it outlives the tab. Only the descriptor is stored —
// elapsed time is always recomputed from `startedAt`, which keeps a restored
// timer accurate even after hours of downtime and immune to clock throttling.
const TIMER_STORAGE_KEY = 'qt_active_timer';
// A timer left running overnight is a forgotten timer, not 14 billable hours.
const MAX_TIMER_MS = 12 * 60 * 60 * 1000;

function readStoredTimer() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(TIMER_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw);
    const startedAt = Number(stored?.startedAt);
    if (!stored?.issueId || !Number.isFinite(startedAt)) return null;
    const elapsed = Date.now() - startedAt;
    if (elapsed < 0 || elapsed > MAX_TIMER_MS) return null;
    return { ...stored, startedAt };
  } catch {
    return null;
  }
}

function writeStoredTimer(timer) {
  if (typeof window === 'undefined') return;
  try {
    if (timer) window.localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(timer));
    else window.localStorage.removeItem(TIMER_STORAGE_KEY);
  } catch { /* private mode / quota — the in-memory timer still works */ }
}

const elapsedSeconds = startedAt => Math.max(0, Math.floor((Date.now() - startedAt) / 1000));

const useWorkspaceStore = create((set, get) => ({

  // ── Timer ─────────────────────────────────────────────────────────
  activeTimer:    null,   // { issueId, projectId, startedAt, entityType?, ...context }
  timerElapsed:   0,      // seconds
  _timerInterval: null,

  // Returns false when a timer is already running instead of silently
  // discarding it — replacing it used to throw away the tracked time.
  startTimer: (issueId, projectId, context = {}) => {
    const { activeTimer, _timerInterval } = get();
    if (activeTimer) return false;
    if (_timerInterval) clearInterval(_timerInterval);
    const timer = { ...context, issueId, projectId, startedAt: Date.now() };
    writeStoredTimer(timer);
    set({
      activeTimer: timer,
      timerElapsed: 0,
      _timerInterval: setInterval(() => set({ timerElapsed: elapsedSeconds(timer.startedAt) }), 1000),
    });
    return true;
  },

  stopTimer: () => {
    const { activeTimer, _timerInterval } = get();
    if (_timerInterval) clearInterval(_timerInterval);
    writeStoredTimer(null);
    if (!activeTimer) { set({ _timerInterval: null }); return null; }
    // Recomputed rather than read from `timerElapsed`, which a background tab
    // may not have updated recently.
    const seconds = elapsedSeconds(activeTimer.startedAt);
    const result = { ...activeTimer, minutes: Math.max(1, Math.ceil(seconds / 60)) };
    set({ activeTimer: null, timerElapsed: 0, _timerInterval: null });
    return result;
  },

  // Re-attaches a timer that survived a reload. Safe to call repeatedly.
  restoreTimer: () => {
    const { activeTimer, _timerInterval } = get();
    if (activeTimer) return;
    const stored = readStoredTimer();
    if (!stored) {
      writeStoredTimer(null);
      return;
    }
    if (_timerInterval) clearInterval(_timerInterval);
    set({
      activeTimer: stored,
      timerElapsed: elapsedSeconds(stored.startedAt),
      _timerInterval: setInterval(() => set({ timerElapsed: elapsedSeconds(stored.startedAt) }), 1000),
    });
  },

  formatElapsed,

  // ── Toast ─────────────────────────────────────────────────────────
  toast: null,
  _toastTimer: null,
  showToast: (message, type = 'success', options = {}) => {
    // Date.now() collides when two toasts fire in the same millisecond, which
    // let the first one's timer dismiss the second. A counter cannot collide,
    // and the pending timer is cancelled so each toast gets its full duration.
    const id = (get()._toastSeq || 0) + 1;
    const previousTimer = get()._toastTimer;
    if (previousTimer) clearTimeout(previousTimer);
    const timer = setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null, _toastTimer: null });
    }, options.duration || 3500);
    set({ toast: { message, type, id, action: options.action }, _toastSeq: id, _toastTimer: timer });
  },
  clearToast: () => {
    const timer = get()._toastTimer;
    if (timer) clearTimeout(timer);
    set({ toast: null, _toastTimer: null });
  },

  // ── Live notification popup (real-time) ───────────────────────────
  liveNotif: null,   // { id, title, body, type, link }
  _liveNotifTimer: null,
  showLiveNotif: (notif) => {
    // Same problem: the previous popup's timer used to clear whichever popup
    // happened to be on screen when it fired, cutting the newer one short.
    const previousTimer = get()._liveNotifTimer;
    if (previousTimer) clearTimeout(previousTimer);
    const timer = setTimeout(() => set({ liveNotif: null, _liveNotifTimer: null }), 6000);
    set({ liveNotif: notif, _liveNotifTimer: timer });
  },
  clearLiveNotif: () => {
    const timer = get()._liveNotifTimer;
    if (timer) clearTimeout(timer);
    set({ liveNotif: null, _liveNotifTimer: null });
  },

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

  // The same reasoning as the stream above, for the chat badge. Every consumer
  // that wanted the number — the bottom bar, the tab title — called
  // useUnreadChatCount() and got its own pair of Firestore listeners on
  // channels and readState. One publisher, many readers.
  unreadChatCount: 0,
  setUnreadChatCount: (count) => set(state =>
    (state.unreadChatCount === count ? state : { unreadChatCount: count })),

  // Per-issue read cursors are published once at the workspace boundary. Card
  // selectors read a single number from this map, so unchanged cards do not
  // subscribe to Firestore or rerender for another issue's cursor.
  issueReadState: {},
  setIssueReadState: (readState) => set({ issueReadState: readState }),

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
  calendarSearch: '',
  setCalendarSearch: (q) => set({ calendarSearch: q }),

  // Local pages publish only their final filtered count. The header uses it to
  // decide whether it needs the broader (and more expensive) search request.
  localSearchFeedback: null,
  setLocalSearchFeedback: (feedback) => set({ localSearchFeedback: feedback }),

  // One entry point for ⌘K and for escalation from a local search field. An id
  // makes two identical requests distinct, so a closed palette can be reopened
  // with the same query and scope.
  commandPaletteRequest: { id: 0, query: '', scope: null },
  openCommandPalette: ({ query = '', scope = null } = {}) => set(state => ({
    commandPaletteRequest: {
      id: state.commandPaletteRequest.id + 1,
      query: String(query || ''),
      scope,
    },
  })),

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
