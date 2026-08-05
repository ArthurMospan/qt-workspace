// src/lib/utils/statusCategories.mjs — the two layers of a status.
//
// A status has a *name*, which belongs to the organization's workflow and can be
// anything ("Код-ревʼю", "Погодження клієнтом", "QA"), and a *category*, which is
// one of five fixed values every product surface can rely on. Names are local,
// categories are shared — the same split Linear, ClickUp, Notion and Shortcut
// make, and for the same reason: anything that spans projects has to group work
// by something that exists everywhere.
//
// Before this file the app had one global list of names and no categories, so
// «Мої завдання» built its columns from raw names, project boards could hide any
// of those names, and dropping a card into a column the card's own project had
// switched off was rejected by the server with a message the user could do
// nothing about. Categories remove the collision instead of guarding it: a task
// of any project has exactly one category, so a category column can never be
// missing from a project.
//
// Two guesses also die here. "Which status means finished" used to be read from
// a position in the list, and "which means in progress" was `statuses.slice(1)`.
// Both are now a direct question to the data.

// Canonical order. Category columns are the same for every member of every
// organization, so their order is fixed here rather than taken from the
// workflow — the workflow only orders *names* inside a category.
export const STATUS_CATEGORY_IDS = Object.freeze([
  'backlog',
  'todo',
  'in-progress',
  'done',
  'cancelled',
]);

// `terminal: true` means "the task is closed": progress, velocity, overdue,
// billing and `completedAt` all read this. Both closing categories count, which
// is exactly how the product already described its terminal statuses — «Готово»,
// «Скасовано» and «Дубль» all close a task.
export const STATUS_CATEGORIES = Object.freeze({
  backlog: Object.freeze({
    id: 'backlog',
    label: 'Беклог',
    color: '#9a9a9a',
    terminal: false,
    hint: 'Зібрано, але ще не заплановано. Сюди потрапляють нові завдання.',
  }),
  todo: Object.freeze({
    id: 'todo',
    label: 'До виконання',
    color: '#6366f1',
    terminal: false,
    hint: 'Заплановано й готове до роботи.',
  }),
  'in-progress': Object.freeze({
    id: 'in-progress',
    label: 'У роботі',
    color: '#f59e0b',
    terminal: false,
    hint: 'Робота триває — разом із ревʼю, QA та погодженнями.',
  }),
  done: Object.freeze({
    id: 'done',
    label: 'Готово',
    color: '#10b981',
    terminal: true,
    hint: 'Роботу завершено. За цією категорією рахуються прогрес, швидкість і рахунок.',
  }),
  cancelled: Object.freeze({
    id: 'cancelled',
    label: 'Скасовано',
    color: '#71717a',
    terminal: true,
    hint: 'Завдання закрито без виконання: скасовано, дубль, не актуально.',
  }),
});

// Categories the built-in and historical status ids belong to. Only ids the
// product itself has shipped are listed: a custom id is never guessed at by
// name, it falls through to the positional rules below.
const BUILT_IN_STATUS_CATEGORIES = Object.freeze({
  backlog: 'backlog',
  todo: 'todo',
  'in-progress': 'in-progress',
  'code-review': 'in-progress',
  qa: 'in-progress',
  'client-approval': 'in-progress',
  done: 'done',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  duplicate: 'cancelled',
});

export function isStatusCategoryId(value) {
  return typeof value === 'string'
    && Object.prototype.hasOwnProperty.call(STATUS_CATEGORIES, value);
}

export function isTerminalStatusCategory(value) {
  return isStatusCategoryId(value) && STATUS_CATEGORIES[value].terminal === true;
}

export function statusCategoryLabel(value) {
  return isStatusCategoryId(value) ? STATUS_CATEGORIES[value].label : '';
}

function statusList(statuses) {
  return Array.isArray(statuses) ? statuses.filter(status => status?.id) : [];
}

// The pre-category rule for "which statuses close a task" had three steps: an
// explicit `isDone` flag, else an id of 'done', else the last column. The flag is
// a deliberate answer and is read first below; these two are what is left — a
// guess from a name and a guess from a position — so they are consulted only
// after the built-in ids and the entry column have had their say.
function guessedTerminalStatusIds(list) {
  const named = list.find(status => status.id === 'done');
  if (named) return [named.id];
  return [list[list.length - 1].id];
}

/**
 * Category of every status in a workflow, as a Map keyed by status id.
 *
 * Nothing has to be migrated for this to be correct: a status that carries no
 * category is read through the rules that used to be implicit, in the order of
 * how much each one actually knows. An explicit category is the answer; a
 * deliberate `isDone` flag closes a task; a built-in id keeps the meaning it
 * shipped with; the first column is where new work lands; and only then do the
 * two old guesses — a status named 'done', or simply the last column — decide.
 * Everything else is work in progress.
 */
export function statusCategoryMap(statuses) {
  const list = statusList(statuses);
  const categories = new Map();
  if (!list.length) return categories;
  const flagged = new Set(
    list.filter(status => status.isDone === true).map(status => status.id),
  );
  const guessed = flagged.size ? new Set() : new Set(guessedTerminalStatusIds(list));
  list.forEach((status, index) => {
    if (isStatusCategoryId(status.category)) {
      categories.set(status.id, status.category);
      return;
    }
    if (flagged.has(status.id)) {
      categories.set(status.id, 'done');
      return;
    }
    const builtIn = BUILT_IN_STATUS_CATEGORIES[status.id];
    if (builtIn) {
      categories.set(status.id, builtIn);
      return;
    }
    if (index === 0) {
      categories.set(status.id, 'backlog');
      return;
    }
    categories.set(status.id, guessed.has(status.id) ? 'done' : 'in-progress');
  });
  return categories;
}

/** Category of one status id, or '' when the workflow has no such status. */
export function statusCategoryOf(statusId, statuses) {
  return statusCategoryMap(statuses).get(statusId) || '';
}

/**
 * The same statuses with `category` and `isDone` written out explicitly, so a
 * saved workflow document never leaves the two disagreeing and no reader has to
 * re-derive anything. `isDone` is kept because it is what older documents and
 * the public task API were built on — it is now a consequence of the category,
 * never a second opinion about it.
 */
export function withStatusCategories(statuses) {
  const categories = statusCategoryMap(statuses);
  return statusList(statuses).map(status => {
    const category = categories.get(status.id);
    return {
      ...status,
      category,
      isDone: isTerminalStatusCategory(category),
    };
  });
}

/**
 * Statuses that close a task. Never empty for a non-empty workflow: a workflow
 * whose categories somehow leave nothing terminal still has to give progress,
 * billing and overdue a definition of "finished", and the last column is the
 * same fallback the app used before categories existed.
 */
export function terminalStatusIds(statuses) {
  const list = statusList(statuses);
  if (!list.length) return [];
  const categories = statusCategoryMap(list);
  const terminal = list
    .filter(status => isTerminalStatusCategory(categories.get(status.id)))
    .map(status => status.id);
  return terminal.length ? terminal : [list[list.length - 1].id];
}

/** Statuses of one category, in workflow order. */
export function statusesInCategory(categoryId, statuses) {
  const categories = statusCategoryMap(statuses);
  return statusList(statuses).filter(status => categories.get(status.id) === categoryId);
}

/** Ids of the statuses of one category, in workflow order. */
export function categoryStatusIds(categoryId, statuses) {
  return statusesInCategory(categoryId, statuses).map(status => status.id);
}

/** Statuses whose category is `in-progress` — what «в роботі» means, exactly. */
export function inProgressStatusIds(statuses) {
  return categoryStatusIds('in-progress', statuses);
}

/** Statuses whose category is `backlog` — work that is collected, not planned. */
export function backlogStatusIds(statuses) {
  return categoryStatusIds('backlog', statuses);
}

/**
 * The categories this workflow actually uses, in canonical order. A category no
 * status maps to is not a column anybody could drop into, so it is not shown.
 */
export function activeStatusCategoryIds(statuses) {
  const used = new Set(statusCategoryMap(statuses).values());
  return STATUS_CATEGORY_IDS.filter(categoryId => used.has(categoryId));
}

/**
 * The columns of a cross-project board: one per category in use, carrying the
 * category's own label and colour rather than any single status's.
 */
export function statusCategoryColumns(statuses) {
  return activeStatusCategoryIds(statuses).map(categoryId => ({
    id: categoryId,
    label: STATUS_CATEGORIES[categoryId].label,
    color: STATUS_CATEGORIES[categoryId].color,
    isCategory: true,
  }));
}

/**
 * Which status a task should get when it is dropped into a category column.
 *
 * A task keeps the status it already has whenever that status is in the target
 * category — moving between two columns of one category is not a status change.
 * Otherwise it takes the first status of that category the *task's own project*
 * actually uses, which is why a project's hidden columns can never make a
 * category drop illegal. Returns null when the project has switched off every
 * status of that category; the caller says so instead of writing a status the
 * board would then refuse to show.
 */
export function resolveCategoryStatusId(categoryId, statuses, {
  currentStatusId = null,
  hiddenStatusIds = [],
} = {}) {
  if (!isStatusCategoryId(categoryId)) return null;
  const hidden = new Set(hiddenStatusIds || []);
  const candidates = categoryStatusIds(categoryId, statuses)
    .filter(statusId => !hidden.has(statusId));
  if (currentStatusId && candidates.includes(currentStatusId)) return currentStatusId;
  return candidates[0] || null;
}

/**
 * Where new work lands: the first `backlog` status, else the first status that
 * does not close a task, else the first status there is. Every writer that used
 * to hardcode the id 'backlog' or take `statuses[0]` asks this instead.
 */
export function entryStatusId(statuses) {
  const list = statusList(statuses);
  if (!list.length) return null;
  const categories = statusCategoryMap(list);
  const backlog = list.find(status => categories.get(status.id) === 'backlog');
  if (backlog) return backlog.id;
  const open = list.find(status => !isTerminalStatusCategory(categories.get(status.id)));
  return (open || list[0]).id;
}
