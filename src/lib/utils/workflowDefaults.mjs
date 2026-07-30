// Canonical default workflow, shared by the client hook, the board, the
// invoice builder and both task-creation APIs.
//
// These lists used to be copy-pasted in four places (useWorkflowConfig,
// useIssues, BillingTab, /api/issues and /api/v1/tasks), each free to drift
// from the others. Icons and colours stay in the client hook — only the ids and
// human labels live here, so this file is importable from server routes too.

export const DEFAULT_STATUS_IDS = ['backlog', 'todo', 'in-progress', 'done'];
export const DEFAULT_TYPE_IDS = ['feature', 'task', 'bug'];
export const DEFAULT_PRIORITY_IDS = ['blocker', 'high', 'medium', 'low'];
export const DEFAULT_LABEL_IDS = ['bug', 'frontend', 'design'];

// Human labels for the built-in workflow columns. Custom statuses carry their
// own label in the org's workflow document; this is the fallback for the
// defaults and for legacy ids that predate configurable workflows.
export const STATUS_LABELS = {
  backlog: 'Беклог',
  todo: 'До виконання',
  'in-progress': 'У роботі',
  'code-review': 'Код-ревʼю',
  qa: 'QA',
  'client-approval': 'Погодження клієнтом',
  done: 'Готово',
};

// Existing organizations can still have the original English defaults saved in
// Firestore. Localize only a known stable id + its exact old label: custom ids
// and renamed built-ins remain untouched.
const BUILT_IN_LABEL_TRANSLATIONS = {
  statuses: {
    backlog: { Backlog: 'Беклог' },
    todo: { 'To Do': 'До виконання' },
    'in-progress': { 'In Progress': 'У роботі' },
    'code-review': { 'Code Review': 'Код-ревʼю' },
    'client-approval': { 'Client Approval': 'Погодження клієнтом' },
    done: { Done: 'Готово' },
  },
  types: {
    epic: { Epic: 'Епік (legacy)' },
    feature: { Feature: 'Фіча' },
    task: { Task: 'Задача' },
    bug: { Bug: 'Баг' },
  },
  priorities: {
    blocker: { Blocker: 'Критичний', 'Блокер': 'Критичний' },
    high: { High: 'Високий' },
    medium: { Medium: 'Середній' },
    low: { Low: 'Низький' },
  },
  labels: {
    bug: { Bug: 'Баг' },
    frontend: { Frontend: 'Фронтенд' },
    design: { Design: 'Дизайн' },
  },
  positions: {
    dev: { Developer: 'Розробник' },
    designer: { Designer: 'Дизайнер' },
    pm: { 'Project Manager': 'PM', PM: 'PM' },
    qa: { QA: 'QA' },
  },
};

export function localizeBuiltInWorkflowItems(section, items) {
  if (!Array.isArray(items)) return items;
  const sectionTranslations = BUILT_IN_LABEL_TRANSLATIONS[section];
  if (!sectionTranslations) return items;
  return items.map(item => {
    const localized = sectionTranslations[item?.id]?.[item?.label];
    return localized ? { ...item, label: localized } : item;
  });
}

export function statusLabel(statusId, statuses = []) {
  const configured = statuses.find(status => status?.id === statusId);
  return configured?.label || STATUS_LABELS[statusId] || statusId || '';
}

// Terminal ("done") statuses for a workflow configuration.
// A status counts as terminal when it carries `isDone: true`; configs saved
// before that flag existed fall back to an id of 'done', then to the last
// column. Kept here so the server routes apply exactly the same rule as the UI.
export function resolveDoneStatusIds(statuses) {
  const list = Array.isArray(statuses) && statuses.length ? statuses : null;
  if (!list) return ['done'];
  const flagged = list.filter(status => status?.isDone === true).map(status => status.id);
  if (flagged.length) return flagged;
  const named = list.find(status => status?.id === 'done');
  if (named) return [named.id];
  return [list[list.length - 1].id];
}

// Ids from a saved workflow section, falling back to the defaults above.
export function workflowIds(section, fallback) {
  return Array.isArray(section) && section.length ? section.map(item => item.id) : fallback;
}
