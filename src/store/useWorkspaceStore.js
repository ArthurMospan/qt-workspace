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
// Stopping the timer is not the same thing as writing the time down. Between
// those two moments the minutes exist nowhere else, and every way of leaving
// the page — a canonical-URL redirect, a reload, a mistaken click — used to
// destroy them silently. They are persisted the instant the timer stops and
// only cleared once the user has saved or explicitly discarded them.
const PENDING_LOG_STORAGE_KEY = 'qt_pending_time_log';
// A timer left running overnight is a forgotten timer, not 14 billable hours.
const MAX_TIMER_MS = 12 * 60 * 60 * 1000;
// An unsaved slip is worth keeping across a reload, not across a fortnight.
const MAX_PENDING_LOG_MS = 7 * 24 * 60 * 60 * 1000;

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

function readStoredPendingLog() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PENDING_LOG_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw);
    const minutes = Number(stored?.minutes);
    const stoppedAt = Number(stored?.stoppedAt);
    if (!stored?.issueId || !Number.isFinite(minutes) || minutes <= 0) return null;
    if (!Number.isFinite(stoppedAt) || Date.now() - stoppedAt > MAX_PENDING_LOG_MS) return null;
    return { ...stored, minutes: Math.round(minutes), stoppedAt };
  } catch {
    return null;
  }
}

function writeStoredPendingLog(pending) {
  if (typeof window === 'undefined') return;
  try {
    if (pending) window.localStorage.setItem(PENDING_LOG_STORAGE_KEY, JSON.stringify(pending));
    else window.localStorage.removeItem(PENDING_LOG_STORAGE_KEY);
  } catch { /* private mode / quota — the in-memory pending log still works */ }
}

const elapsedSeconds = startedAt => Math.max(0, Math.floor((Date.now() - startedAt) / 1000));

const useWorkspaceStore = create((set, get) => ({

  // ── Quick view ────────────────────────────────────────────────────
  // A task or an event, read without leaving the screen that named it.
  //
  // The panel itself already existed — `IssueModal` over `IssueDetail` — and
  // exactly one screen opened it, while every other place that names a task
  // navigated away and made you come back: a mention in chat, a row in
  // analytics, the two lists on a profile, an event in the calendar. Holding
  // the choice here rather than in each of those screens is what makes it one
  // panel instead of six copies of the same state.
  //
  // Not in the address, unlike the profile overlay: this opens from an object
  // the screen already has in hand, and reconstructing a task from an id in a
  // query string would mean a fresh read on every screen that can open one.
  // `Відкрити на повній сторінці` inside the panel is the shareable path.
  quickView: null, // { kind: 'issue' | 'event', record }

  openIssueQuickView: issue => {
    if (issue?.id) set({ quickView: { kind: 'issue', record: issue } });
  },
  openEventQuickView: event => {
    if (event?.id || event?.sourceEventId) set({ quickView: { kind: 'event', record: event } });
  },
  closeQuickView: () => set({ quickView: null }),

  // ── Timer ─────────────────────────────────────────────────────────
  activeTimer:    null,   // { issueId, projectId, startedAt, entityType?, ...context }
  timerElapsed:   0,      // seconds
  _timerInterval: null,
  // Minutes a stopped timer produced that nobody has written down yet.
  // { issueId, projectId, minutes, stoppedAt, entityType?, ...context }
  pendingTimeLog: null,

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
    // Written down before anything navigates. The screen that asks the user to
    // confirm these minutes may be remounted by a canonical-URL redirect or
    // closed by a reload before they get to press save; the minutes have to be
    // somewhere that survives both.
    const pending = { ...result, stoppedAt: Date.now() };
    writeStoredPendingLog(pending);
    set({
      activeTimer: null,
      timerElapsed: 0,
      _timerInterval: null,
      pendingTimeLog: pending,
    });
    return result;
  },

  /** The user saved the minutes, or knowingly threw them away. */
  clearPendingTimeLog: () => {
    writeStoredPendingLog(null);
    set({ pendingTimeLog: null });
  },

  // Re-attaches a timer that survived a reload. Safe to call repeatedly.
  restoreTimer: () => {
    const { activeTimer, _timerInterval } = get();
    if (!get().pendingTimeLog) {
      const storedPending = readStoredPendingLog();
      if (storedPending) set({ pendingTimeLog: storedPending });
      else writeStoredPendingLog(null);
    }
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
    // A confirmation is read at a glance and can go; a failure has to be read,
    // and often decided about — «повідомити про це?» — which nobody manages in
    // three and a half seconds. Same toast, two different jobs.
    const duration = options.duration
      || (type === 'error' ? 9000 : type === 'warning' ? 6000 : 3500);
    const timer = setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null, _toastTimer: null });
    }, duration);
    set({
      toast: {
        message,
        type,
        id,
        action: options.action,
        // What the reporter would send. The message alone is what the user was
        // shown; `detail` is what actually happened, and only a failure has one.
        detail: options.detail || null,
        context: options.context || '',
      },
      _toastSeq: id,
      _toastTimer: timer,
    });
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
  // Whether that map is an answer yet. An empty map means two opposite things —
  // «this reader has opened nothing» and «the cursors have not arrived» — and a
  // task timeline that cannot tell them apart reads its whole history as
  // unread, draws its boundary at the day the task was created, and sends the
  // reader there. Nothing may judge what is new until this is true.
  issueReadStateLoaded: false,
  setIssueReadState: (readState) => set({ issueReadState: readState, issueReadStateLoaded: true }),
  resetIssueReadState: () => set({ issueReadState: {}, issueReadStateLoaded: false }),

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

  // UI state below the AppContext outlives React route trees. On an
  // organization switch that is useful for account-wide notifications and a
  // running timer, but dangerous for records that belong to the workspace we
  // just left. Clear every organization-scoped surface as one transaction.
  resetOrganizationScope: () => {
    const toastTimer = get()._toastTimer;
    const liveNotifTimer = get()._liveNotifTimer;
    if (toastTimer) clearTimeout(toastTimer);
    if (liveNotifTimer) clearTimeout(liveNotifTimer);
    set({
      quickView: null,
      toast: null,
      _toastTimer: null,
      liveNotif: null,
      _liveNotifTimer: null,
      unreadChatCount: 0,
      issueReadState: {},
      issueReadStateLoaded: false,
      breadcrumbs: [],
      chatSearch: '',
      teamSearch: '',
      workspaceSearch: '',
      myTaskSearch: '',
      projectSearch: '',
      sprintSearch: '',
      analyticsSearch: '',
      calendarSearch: '',
      localSearchFeedback: null,
      chatOnlineUsers: [],
      sidebarPreview: null,
    });
  },
}));

export default useWorkspaceStore;
