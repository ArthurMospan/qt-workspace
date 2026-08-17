import { statusLabel } from './workflowDefaults.mjs';
import { NO_PRIORITY_ID } from './priorities.mjs';

/**
 * Which field changes are worth a line in a task's history.
 *
 * The list used to be three fields long — назва, пріоритет, виконавці — so the
 * feed in the task chat stayed silent while a deadline moved by a week, a task
 * changed type, or somebody dropped it into another sprint. "Дії пишуться в
 * чаті" was only a third true, and the third it covered was not the third that
 * causes arguments.
 *
 * `description` is deliberately recorded as a fact and not as a diff: the whole
 * body of a task in a `from`/`to` pair is a document inside a log entry, and
 * nobody reads it there.
 */
export const AUDITED_ISSUE_FIELDS = Object.freeze([
  'title',
  'priority',
  'assigneeIds',
  'type',
  'dueDate',
  'estimateMinutes',
  'labelIds',
  'sprintId',
  'description',
]);

export const FACT_ONLY_AUDITED_FIELDS = Object.freeze(['description']);

const FIELD_LABELS = Object.freeze({
  status: 'статус',
  columnId: 'статус',
  priority: 'пріоритет',
  title: 'назву',
  assigneeIds: 'виконавців',
  type: 'тип',
  dueDate: 'дедлайн',
  estimateMinutes: 'оцінку',
  labelIds: 'мітки',
  sprintId: 'спринт',
  parentIssueId: 'основну задачу',
});

const FACT_ONLY_TEXT = Object.freeze({
  description: 'Опис змінено',
});

/**
 * Stable string form of an audited field, so array values compare by content
 * rather than by identity. Order-insensitive for arrays: reordering assignees
 * is not a change worth an entry in the history.
 */
export function auditValue(value) {
  if (Array.isArray(value)) return JSON.stringify([...value].map(String).sort());
  if (value && typeof value.toMillis === 'function') return String(value.toMillis());
  if (value instanceof Date) return String(value.getTime());
  return String(value ?? '');
}

// An audited array arrives as the JSON `auditValue` produced, and a single id
// arrives bare — entries written before this module existed are both.
function idsOf(value) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string' || !value) return [];
  if (!value.startsWith('[')) return [value];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [value];
  }
}

function nameOf(collection, id, fallback) {
  const found = (collection || []).find(item => (item?.id || item?.uid) === id);
  return found?.name || found?.label || fallback;
}

function formatMinutes(raw) {
  const minutes = Number(raw);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} хв`;
  return rest === 0 ? `${hours} год` : `${hours} год ${rest} хв`;
}

function formatDueDate(raw, timeZone) {
  if (raw === null || raw === undefined || raw === '') return null;
  // Deadlines reach the log as milliseconds (`auditValue` of a Timestamp), as an
  // ISO string, or as a Firestore Timestamp when the entry was written before
  // this module existed.
  const millis = typeof raw === 'object' && typeof raw.toMillis === 'function'
    ? raw.toMillis()
    : Number(raw);
  const date = Number.isFinite(millis) && String(raw).trim() !== ''
    ? new Date(millis)
    : new Date(String(raw));
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  });
}

function formatAuditValue(field, value, context) {
  const {
    statuses = [],
    priorities = [],
    types = [],
    labels = [],
    sprints = [],
    members = [],
    timeZone,
  } = context || {};

  if (field === 'assigneeIds') {
    const ids = idsOf(value);
    if (ids.length === 0) return 'ніхто';
    return ids.map(id => nameOf(members, id, 'учасник')).join(', ');
  }
  if (field === 'labelIds') {
    const ids = idsOf(value);
    if (ids.length === 0) return 'без міток';
    return ids.map(id => nameOf(labels, id, id)).join(', ');
  }
  if (value === null || value === undefined || value === '') return 'не вказано';
  if (field === 'status' || field === 'columnId') return statusLabel(value, statuses);
  if (field === 'priority') {
    if (value === NO_PRIORITY_ID) return 'без пріоритету';
    return nameOf(priorities, value, value);
  }
  if (field === 'type') return nameOf(types, value, value);
  if (field === 'sprintId') return nameOf(sprints, value, 'спринт');
  if (field === 'dueDate') return formatDueDate(value, timeZone) || 'не вказано';
  if (field === 'estimateMinutes') return formatMinutes(value) || 'не вказано';
  return String(value);
}

/**
 * One line of a task's history, in words.
 *
 * The statuses, priorities, types, labels and sprints are read from the live
 * workflow — never from a table inside this file. A hard-coded map of seven
 * status ids is what made a project that renamed «QA» read «QA» in its own
 * history, and a project that added one read a raw `status-3`.
 *
 * @param {object} entry An `issues/{id}/audit` document.
 * @param {object} context Live workflow and directory: `statuses`, `priorities`,
 *   `types`, `labels`, `sprints`, `members`, `timeZone`.
 * @returns {string} A sentence for the timeline.
 */
export function describeAuditEvent(entry, context = {}) {
  const field = entry?.field || entry?.action?.replace(/^changed_/, '');
  if (entry?.action === 'created') return 'Створено завдання';
  if (field && FACT_ONLY_TEXT[field]) return FACT_ONLY_TEXT[field];
  if (!field || !FIELD_LABELS[field]) {
    // An action this build has no phrase for still names itself rather than
    // pretending the task was merely "updated".
    return typeof entry?.action === 'string' && entry.action && !entry.action.startsWith('changed_')
      ? entry.action
      : 'Оновлено завдання';
  }

  const label = FIELD_LABELS[field];
  const fieldLabel = `${label[0].toUpperCase()}${label.slice(1)}`;
  const from = formatAuditValue(field, entry.from ?? entry.oldValue, context);
  const to = formatAuditValue(field, entry.to ?? entry.newValue, context);
  if (from === to || from === 'не вказано' || from === 'ніхто' || from === 'без міток') {
    return `${fieldLabel} змінено на «${to}»`;
  }
  return `${fieldLabel} змінено: «${from}» → «${to}»`;
}
