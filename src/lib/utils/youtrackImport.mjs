const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /\.localhost$/i,
  /\.local$/i,
  /^127\./,
  /^10\./,
  /^169\.254\./,
  /^192\.168\./,
  /^0\./,
];

function isPrivateIpv4(hostname) {
  const match = hostname.match(/^172\.(\d{1,3})\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

export function normalizeYouTrackBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) throw new Error('Вкажіть адресу YouTrack');
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('YouTrack має використовувати HTTPS');
  if (url.username || url.password || url.port) throw new Error('Некоректна адреса YouTrack');
  if (
    PRIVATE_HOST_PATTERNS.some(pattern => pattern.test(url.hostname))
    || isPrivateIpv4(url.hostname)
    || url.hostname === '::1'
  ) {
    throw new Error('Локальні та приватні адреси YouTrack не підтримуються');
  }
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/api$/i, '');
  return url.toString().replace(/\/+$/, '');
}

export function normalizeMappingKey(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

export function sourceUserId(user) {
  return String(user?.id || user?.login || user?.email || '').trim();
}

export function sourceUserName(user) {
  return String(user?.name || user?.fullName || user?.login || user?.email || 'Користувач YouTrack').trim();
}

export function suggestUserMappings(sourceUsers, members) {
  const membersByEmail = new Map(
    (members || [])
      .filter(member => member?.email)
      .map(member => [String(member.email).trim().toLowerCase(), member.id || member.uid]),
  );
  return Object.fromEntries((sourceUsers || []).flatMap(user => {
    const id = sourceUserId(user);
    if (!id) return [];
    const email = String(user?.email || '').trim().toLowerCase();
    return [[id, email && membersByEmail.has(email) ? membersByEmail.get(email) : 'external']];
  }));
}

export function youTrackField(issue, fieldName) {
  const wanted = normalizeMappingKey(fieldName);
  return (issue?.customFields || []).find(field => normalizeMappingKey(field?.name) === wanted)?.value ?? null;
}

export function firstFieldValue(value) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function fieldPresentation(value) {
  const item = firstFieldValue(value);
  if (item == null) return '';
  if (typeof item === 'string' || typeof item === 'number') return String(item);
  return String(item.name || item.fullName || item.login || item.presentation || item.text || '');
}

export function fieldMinutes(value) {
  const item = firstFieldValue(value);
  if (Number.isFinite(item?.minutes)) return Math.max(0, Math.round(item.minutes));
  if (Number.isFinite(item)) return Math.max(0, Math.round(item));
  return null;
}

export function fieldTimestamp(value) {
  const item = firstFieldValue(value);
  const raw = typeof item === 'object' && item ? (item.timestamp ?? item.value ?? item.date) : item;
  if (Number.isFinite(raw)) return new Date(raw);
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = new Date(raw);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  return null;
}

function findWorkflowId(items, sourceName, fallbacks) {
  const wanted = normalizeMappingKey(sourceName);
  const direct = (items || []).find(item => (
    normalizeMappingKey(item?.id) === wanted || normalizeMappingKey(item?.label) === wanted
  ));
  if (direct) return direct.id;
  const available = new Set((items || []).map(item => item.id));
  return fallbacks.find(id => available.has(id)) || items?.[0]?.id || null;
}

export function mapYouTrackStatus(sourceName, statuses = []) {
  const key = normalizeMappingKey(sourceName);
  const done = /(done|fixed|verified|resolved|closed|complete|виконан|готов)/u.test(key);
  const progress = /(progress|doing|review|test|робот|перевір)/u.test(key);
  const backlog = /(backlog|untriaged|черг|беклог)/u.test(key);
  return findWorkflowId(
    statuses,
    sourceName,
    done ? ['done'] : progress ? ['in-progress', 'doing'] : backlog ? ['backlog'] : ['todo', 'backlog'],
  );
}

export function mapYouTrackPriority(sourceName, priorities = []) {
  const key = normalizeMappingKey(sourceName);
  const fallbacks = /(showstopper|critical|blocker|критич)/u.test(key)
    ? ['blocker', 'high']
    : /(major|high|важлив|висок)/u.test(key)
      ? ['high', 'medium']
      : /(minor|low|низьк)/u.test(key)
        ? ['low', 'medium']
        : ['medium', 'low'];
  return findWorkflowId(priorities, sourceName, fallbacks);
}

export function mapYouTrackType(sourceName, types = []) {
  const key = normalizeMappingKey(sourceName);
  const fallbacks = /(bug|defect|помил|баг)/u.test(key)
    ? ['bug', 'task']
    : /(epic|епік)/u.test(key)
      ? ['epic', 'feature', 'task']
      : /(feature|story|функц|істор)/u.test(key)
        ? ['feature', 'task']
        : ['task', 'feature'];
  return findWorkflowId(types, sourceName, fallbacks);
}

export function serializeCustomFields(fields) {
  return (fields || []).slice(0, 100).map(field => ({
    id: String(field?.id || ''),
    name: String(field?.name || ''),
    type: String(field?.$type || ''),
    value: Array.isArray(field?.value)
      ? field.value.slice(0, 50).map(fieldPresentation)
      : fieldPresentation(field?.value),
  }));
}

export function relationTypeFromYouTrack(linkType = {}, direction = '') {
  const label = normalizeMappingKey(
    direction === 'INWARD'
      ? linkType.targetToSource || linkType.name
      : linkType.sourceToTarget || linkType.name,
  );
  if (/duplicate/u.test(label)) return 'duplicates';
  if (/(subtask|parent)/u.test(label)) return 'subtask-of';
  if (/(blocks|isrequiredfor)/u.test(label)) return 'blocks';
  if (/(blockedby|dependson|requiredfor)/u.test(label)) return 'is-blocked-by';
  return 'relates-to';
}
