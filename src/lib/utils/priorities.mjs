export const NO_PRIORITY_ID = 'none';

// Stored ids are stable business semantics. Labels and colours are editable,
// but these four anchors stay present and in this order so future SLA,
// escalation and notification rules never depend on a translated label.
export const SYSTEM_PRIORITY_IDS = Object.freeze([
  'blocker',
  'high',
  'medium',
  'low',
]);

export const DEFAULT_SYSTEM_PRIORITIES = Object.freeze([
  { id: 'blocker', label: 'Критичний', color: '#ef4444' },
  { id: 'high', label: 'Високий', color: '#f97316' },
  { id: 'medium', label: 'Середній', color: '#eab308' },
  { id: 'low', label: 'Низький', color: '#9a9a9a' },
]);

export const NO_PRIORITY = Object.freeze({
  id: NO_PRIORITY_ID,
  label: 'Без пріоритету',
  color: '#9a9a9a',
  isNoPriority: true,
});

const SYSTEM_PRIORITY_SET = new Set(SYSTEM_PRIORITY_IDS);
const DEFAULT_BY_ID = new Map(DEFAULT_SYSTEM_PRIORITIES.map(item => [item.id, item]));
const SYSTEM_RING_OPACITY = Object.freeze({
  high: { outer: 1, inner: 1 },
  medium: { outer: 0.55, inner: 1 },
  low: { outer: 0.55, inner: 0.55 },
});

export function isSystemPriorityId(priorityId) {
  return SYSTEM_PRIORITY_SET.has(priorityId);
}

// Old settings documents may predate the lock and can be missing an anchor.
// Restore it for every reader without touching custom items or overwriting an
// edited system label/colour. A future settings save persists the repaired set.
export function ensureSystemPriorities(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return DEFAULT_SYSTEM_PRIORITIES.map(item => ({ ...item }));
  }

  const suppliedById = new Map(items.map(item => [item?.id, item]));
  const hasEverySystemPriority = SYSTEM_PRIORITY_IDS.every(id => suppliedById.has(id));
  const presentSystemOrder = items
    .filter(item => isSystemPriorityId(item?.id))
    .map(item => item.id);
  const hasValidSystemOrder = hasEverySystemPriority
    && presentSystemOrder.every((id, index) => id === SYSTEM_PRIORITY_IDS[index])
    && items[0]?.id === 'blocker'
    && items.at(-1)?.id === 'low';

  if (hasValidSystemOrder) return items.map(item => ({ ...item }));

  const custom = items
    .filter(item => item?.id && !isSystemPriorityId(item.id) && item.id !== NO_PRIORITY_ID)
    .map(item => ({ ...item }));
  const restored = SYSTEM_PRIORITY_IDS.map(id => ({
    ...DEFAULT_BY_ID.get(id),
    ...(suppliedById.get(id) || {}),
    id,
  }));

  // Keep recoverable custom levels inside the four anchors. The editor can
  // then move them into a more precise gap without ever placing one above
  // Critical or below Low.
  return [restored[0], restored[1], restored[2], ...custom, restored[3]];
}

export function hasValidSystemPriorityStructure(items) {
  if (!Array.isArray(items)) return false;
  const ids = items.map(item => item?.id);
  if (!SYSTEM_PRIORITY_IDS.every(id => ids.includes(id))) return false;
  const systemOrder = ids.filter(isSystemPriorityId);
  return systemOrder.every((id, index) => id === SYSTEM_PRIORITY_IDS[index])
    && ids[0] === 'blocker'
    && ids.at(-1) === 'low';
}

export function selectablePriorities(items) {
  return [NO_PRIORITY, ...ensureSystemPriorities(items)];
}

function mix(from, to, amount) {
  return Number((from + (to - from) * amount).toFixed(3));
}

function customRingOpacity(priorityId, priorities) {
  const list = ensureSystemPriorities(priorities);
  const index = list.findIndex(item => item.id === priorityId);
  if (index < 0) return SYSTEM_RING_OPACITY.low;

  const highIndex = list.findIndex(item => item.id === 'high');
  const mediumIndex = list.findIndex(item => item.id === 'medium');
  const lowIndex = list.findIndex(item => item.id === 'low');

  if (index < highIndex) return SYSTEM_RING_OPACITY.high;
  if (index < mediumIndex) {
    const span = Math.max(1, mediumIndex - highIndex);
    const amount = (index - highIndex) / span;
    return {
      outer: mix(1, 0.55, amount),
      inner: 1,
    };
  }
  if (index < lowIndex) {
    const span = Math.max(1, lowIndex - mediumIndex);
    const amount = (index - mediumIndex) / span;
    return {
      outer: 0.55,
      inner: mix(1, 0.55, amount),
    };
  }
  return SYSTEM_RING_OPACITY.low;
}

export function priorityPresentation(priority, priorities = []) {
  const source = typeof priority === 'string'
    ? selectablePriorities(priorities).find(item => item.id === priority)
    : priority;
  const id = source?.id || NO_PRIORITY_ID;

  if (id === NO_PRIORITY_ID || source?.isNoPriority) {
    return {
      ...NO_PRIORITY,
      critical: false,
      outerOpacity: 0.2,
      innerOpacity: 0.2,
    };
  }

  const fallback = DEFAULT_BY_ID.get(id);
  const rings = SYSTEM_RING_OPACITY[id] || customRingOpacity(id, priorities);
  return {
    id,
    label: source?.label || fallback?.label || 'Пріоритет',
    color: source?.color || fallback?.color || '#9a9a9a',
    critical: id === 'blocker',
    isNoPriority: false,
    outerOpacity: rings.outer,
    innerOpacity: rings.inner,
  };
}

export function prioritySelectOption(priority, priorities) {
  const presentation = priorityPresentation(priority, priorities);
  return {
    value: presentation.id,
    label: presentation.label,
    priorityMark: presentation,
  };
}

export function prioritySelectOptions(priorities, { includeNone = true } = {}) {
  const list = includeNone ? selectablePriorities(priorities) : ensureSystemPriorities(priorities);
  return list.map(priority => prioritySelectOption(priority, priorities));
}
