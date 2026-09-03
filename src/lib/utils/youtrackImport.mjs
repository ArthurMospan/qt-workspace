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

export function isYouTrackStateField(field) {
  const type = String(field?.$type || '');
  const name = normalizeMappingKey(field?.field?.name || field?.name);
  return /State(?:Project|Issue)CustomField/u.test(type)
    || ['state', 'status', 'стан', 'статус'].includes(name);
}

/**
 * Reads an issue's workflow state.
 *
 * Discovery recognises the state field by its `$type`, so a YouTrack whose
 * field is renamed or localized still offers its statuses for selection. Doing
 * the lookup here by the literal name "State" made the two disagree: the picker
 * listed statuses that no issue could ever match, and the prepared job counted
 * zero. Match on type first and keep the name as the fallback for responses
 * that do not carry `$type`.
 */
export function youTrackStateName(issue) {
  const fields = issue?.customFields || [];
  const field = fields.find(isYouTrackStateField);
  return fieldPresentation(field?.value ?? null);
}

/**
 * Builds the source-status catalogue used by the import picker. Admin bundle
 * values are the preferred inventory, but ordinary issue reads are the
 * permission-safe fallback: a token that can import an issue can still reveal
 * that issue's current state even when YouTrack refuses the bundle endpoint.
 */
export function mergeYouTrackStatuses(bundleStatuses = [], issues = []) {
  const byName = new Map();
  (bundleStatuses || []).forEach((status, index) => {
    const name = String(status?.name || '').trim();
    const key = normalizeMappingKey(name);
    if (!key) return;
    byName.set(key, {
      id: String(status?.id || name),
      name,
      archived: status?.archived === true,
      ordinal: Number.isFinite(status?.ordinal) ? status.ordinal : index,
      issueCount: 0,
    });
  });
  (issues || []).forEach(issue => {
    const name = youTrackStateName(issue);
    const key = normalizeMappingKey(name);
    if (!key) return;
    const current = byName.get(key);
    if (current) {
      current.issueCount += 1;
      return;
    }
    byName.set(key, {
      id: name,
      name,
      archived: false,
      ordinal: Number.MAX_SAFE_INTEGER,
      issueCount: 1,
    });
  });
  return [...byName.values()]
    .sort((a, b) => a.ordinal - b.ordinal || a.name.localeCompare(b.name, 'uk'))
    .map(({ ordinal, ...status }) => status);
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

function firestoreTimestampMillis(value) {
  if (typeof value?.toMillis === 'function') {
    const millis = value.toMillis();
    return Number.isFinite(millis) ? millis : null;
  }
  if (
    Number.isSafeInteger(value?.seconds)
    && Number.isSafeInteger(value?.nanoseconds)
  ) {
    return (value.seconds * 1_000) + Math.floor(value.nanoseconds / 1_000_000);
  }
  return null;
}

function exactFlatRecord(left, right) {
  if (left == null || right == null) return left == null && right == null;
  if (
    typeof left !== 'object'
    || Array.isArray(left)
    || typeof right !== 'object'
    || Array.isArray(right)
  ) {
    return false;
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return (
    leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => (
      key === rightKeys[index] && Object.is(left[key], right[key])
    ))
  );
}

export function youTrackImportedWorkLogMatches(current, expected) {
  if (!current || !expected) return false;
  const scalarFields = [
    'issueId',
    'projectId',
    'userId',
    'organizationId',
    'spentMinutes',
    'description',
    'source',
    'sourceId',
  ];
  if (scalarFields.some(field => !Object.is(current[field], expected[field]))) {
    return false;
  }
  const currentLoggedAt = firestoreTimestampMillis(current.loggedAt);
  const expectedLoggedAt = firestoreTimestampMillis(expected.loggedAt);
  return (
    currentLoggedAt !== null
    && expectedLoggedAt !== null
    && currentLoggedAt === expectedLoggedAt
    && exactFlatRecord(current.externalActor, expected.externalActor)
  );
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

/**
 * Resolves a YouTrack state to an organization status. A saved manual choice
 * wins only while that status still exists; otherwise the same deterministic
 * suggestion used by discovery is applied. This keeps old import jobs safe
 * when an administrator edits the workflow between discovery and commit.
 */
export function resolveYouTrackStatus(sourceName, statuses = [], explicitStatusId = '') {
  const available = new Set((statuses || []).map(status => status?.id).filter(Boolean));
  const explicit = String(explicitStatusId || '').trim();
  if (explicit && available.has(explicit)) return explicit;
  return mapYouTrackStatus(sourceName, statuses);
}

export function suggestYouTrackStatusMappings(projects = [], statuses = []) {
  return Object.fromEntries((projects || []).flatMap(project => {
    const projectId = String(project?.id || '').trim();
    if (!projectId) return [];
    return [[projectId, Object.fromEntries((project.statuses || []).flatMap(status => {
      const sourceName = String(status?.name || '').trim();
      if (!sourceName) return [];
      const targetId = mapYouTrackStatus(sourceName, statuses);
      return targetId ? [[sourceName, targetId]] : [];
    }))]];
  }));
}

export function filterYouTrackIssuesByStatuses(issues = [], allowedStatusNames) {
  if (!Array.isArray(allowedStatusNames)) return issues;
  const allowed = new Set(allowedStatusNames.map(normalizeMappingKey).filter(Boolean));
  // Never turn an explicit empty choice into a full import. The API rejects
  // this state for a selected project; the helper still fails closed on its
  // own so a malformed client cannot enqueue every issue by accident.
  if (allowed.size === 0) return [];
  return issues.filter(issue => allowed.has(normalizeMappingKey(youTrackStateName(issue))));
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
  const creatableTypes = (types || []).filter(type => type?.id !== 'epic');
  const fallbacks = /(bug|defect|помил|баг)/u.test(key)
    ? ['bug', 'task']
    : /(epic|епік)/u.test(key)
      // Epic is a source-system grouping, not a QuickTeam task type. Preserve
      // the original YouTrack value in import metadata and map the work item to
      // the closest actionable type instead.
      ? ['feature', 'task']
      : /(feature|story|функц|істор)/u.test(key)
        ? ['feature', 'task']
        : ['task', 'feature'];
  return findWorkflowId(creatableTypes, sourceName, fallbacks);
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

export function normalizeYouTrackRelation(linkType = {}, direction = '') {
  const label = normalizeMappingKey(
    direction === 'INWARD'
      ? linkType.targetToSource || linkType.name
      : linkType.sourceToTarget || linkType.name,
  );
  if (/(isduplicatedby|duplicatedby)/u.test(label)) {
    return { relationType: 'duplicates', reverse: true, hierarchyHint: false };
  }
  if (/duplicate/u.test(label)) {
    return { relationType: 'duplicates', reverse: false, hierarchyHint: false };
  }
  // YouTrack hierarchy can be deeper than the deliberately one-level QuickTeam
  // model and can span projects. Keep it visible as a regular relation and flag
  // it for review instead of silently constructing an invalid parent chain.
  if (/(subtask|parent)/u.test(label)) {
    return { relationType: 'relates-to', reverse: false, hierarchyHint: true };
  }
  if (/(blocks|isrequiredfor)/u.test(label)) {
    return { relationType: 'blocks', reverse: false, hierarchyHint: false };
  }
  if (/(blockedby|dependson|requiredfor)/u.test(label)) {
    return { relationType: 'blocks', reverse: true, hierarchyHint: false };
  }
  return { relationType: 'relates-to', reverse: false, hierarchyHint: false };
}

const YOUTRACK_RELATION_STRENGTH = {
  blocks: 3,
  duplicates: 2,
  'relates-to': 1,
};

function relationRowTieBreakKey(row) {
  return [
    String(row?.sourceExternalId || ''),
    String(row?.targetExternalId || ''),
    String(row?.externalRelation || ''),
    String(row?.targetReadableId || ''),
  ].join('\u0000');
}

/**
 * Selects the one relation QuickTeam may retain for a YouTrack issue pair.
 *
 * The comparison is intentionally independent from discovery order. This is
 * used both while folding one API response and while a reciprocal issue later
 * enqueues the same pair, so a weaker early `relates-to` can still become a
 * `blocks` relation before the link phase starts.
 */
export function strongestYouTrackRelationRow(left, right) {
  const candidates = [left, right].filter(Boolean);
  if (candidates.length === 0) return null;

  const strongestValue = Math.max(...candidates.map(
    row => YOUTRACK_RELATION_STRENGTH[row?.relationType] || 0,
  ));
  const strongest = candidates
    .filter(row => (YOUTRACK_RELATION_STRENGTH[row?.relationType] || 0) === strongestValue)
    .sort((a, b) => relationRowTieBreakKey(a).localeCompare(relationRowTieBreakKey(b)));
  const selected = strongest[0];

  return {
    ...selected,
    hierarchyHint: strongest.some(row => row?.hierarchyHint === true),
  };
}

export function relationTypeFromYouTrack(linkType = {}, direction = '') {
  return normalizeYouTrackRelation(linkType, direction).relationType;
}

// ─── Стан перенесення: одне слово, один вихід ────────────────────────────────
//
// Екран мав власну таблицю станів — `statusLabel`, `JOB_TONES`, `progressFor` і
// `ACTIVE_JOB_STATUSES` жили просто в JSX, — і саме тому в ньому був стан без
// виходу. «Скасовано · 0 із 663 · 0%» малювалось, бо картка бере найновіший
// job, яким би він не був, а всі кнопки стояли за `activeJob`, до якого
// «скасовано» не належить. Панель була, дії не було, прибрати її не міг ніхто.
//
// Тепер словник станів один і він тут, поруч із рештою чистих правил імпорту.
// Правило, яке його тримає, просте: для кожного стану й кожного читача
// `importActionsFor` повертає непорожній список. Це перевіряє тест, а не
// обіцянка в коментарі.

// Крок імпорту тримає оренду 90 секунд (`IMPORT_STEP_LEASE_MS`), тож «не
// рухається» — це прострочена оренда І тиша, довша за неї. Сам `updatedAt`, без
// оренди, називав паузою живий імпорт, який просто робив одну повільну задачу
// зі сотнею коментарів і вкладенням на 20 MB.
export const IMPORT_STALLED_AFTER_MS = 180_000;

// Покинуте перенесення — те, до якого автор не повернувся. Його має право
// зупинити будь-який адміністратор: інакше `assertNoForeignActiveImport` тримає
// цілу організацію в заручниках у людини, яка вже пішла.
export const IMPORT_ABANDONED_AFTER_MS = 15 * 60_000;

// Скільки задач переносимо, не перепитуючи. Більше — і перед записом у робочий
// простір екран спиняється й називає число: «6 214 задач» — це вже рішення, а
// не крок.
export const IMPORT_AUTOSTART_LIMIT = 2_000;

// Скільки проєктів переносить один запуск. Стеля була в importer'і як `slice`,
// тобто мовчазна: обрали двадцять п'ять — перенеслося двадцять, і ніде про це
// не було сказано. Тепер число одне на обидва боки: сервер відмовляє, а вибір
// за замовчуванням не заводить людину в цю відмову з першого ж екрана.
export const IMPORT_PROJECT_LIMIT = 20;

// Скільки задач читає розвідка, щоб зібрати статуси проєкту. Без цієї стелі
// один проєкт на 50 000 задач — це 500 послідовних сторінок, тобто дві хвилини
// проти `maxDuration = 60`: розвідка просто не поверталась, і людина бачила
// рівно те, на що скаржилась — «воно висить».
export const YOUTRACK_DISCOVERY_PROBE = Object.freeze({ limit: 2_000, sort: 'updated desc' });

const IMPORT_STATE_PRESENTATION = Object.freeze({
  none: { label: 'Не розпочато', tone: 'neutral' },
  ready: { label: 'Готово до запуску', tone: 'neutral' },
  running: { label: 'Іде', tone: 'dark' },
  stalled: { label: 'Пауза', tone: 'warning' },
  blocked: { label: 'Спинилося', tone: 'danger' },
  'blocked-connection': { label: 'Потрібен новий токен', tone: 'danger' },
  completed: { label: 'Завершено', tone: 'dark' },
  cancelled: { label: 'Скасовано', tone: 'neutral' },
});

function millisOf(value) {
  if (!value) return 0;
  const parsed = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Який це стан — єдина відповідь, якою користуються і екран, і тести.
 *
 * `prepared` лишається тим, що пише сервер, і читається як `ready`: міграції
 * заради перейменування статусу не буває, а два слова про одне зводяться в
 * одному місці — тут.
 *
 * @param {object} job Серіалізований job або null.
 * @param {number} now Поточний час у мілісекундах; передається ззовні, щоб функція лишалась чистою.
 */
export function importJobState(job, now = 0) {
  if (!job || job.acknowledgedAt) return 'none';
  if (job.status === 'blocked') return 'blocked';
  if (job.status === 'completed') return 'completed';
  if (job.status === 'cancelled') return 'cancelled';
  if (job.status === 'prepared' || job.status === 'ready') return 'ready';
  if (job.status !== 'running') return 'none';
  const silentFor = now - millisOf(job.updatedAt);
  const leaseHeld = millisOf(job.leaseUntil) > now;
  return !leaseHeld && silentFor > IMPORT_STALLED_AFTER_MS ? 'stalled' : 'running';
}

/** Стан, у якому перенесення ще може писати. Поки він такий — налаштування закриті. */
export function importJobIsOpen(state) {
  return state === 'ready' || state === 'running' || state === 'stalled' || state === 'blocked';
}

/** Стан, у якому цю вкладку має сенс крутити далі без участі людини. */
export function importJobIsDrivable(state) {
  return state === 'ready' || state === 'running';
}

/**
 * Стан, у якому натискання «Продовжити» має що продовжувати.
 *
 * Ширший за `importJobIsDrivable`, і саме в цьому суть різниці. Крутити далі
 * самому можна лише те, що рухається; а починати рух — і те, що спинилось, і
 * те, що заблокувалось. Поки предикат був один, «Продовжити» на паузі й
 * «Спробувати ще раз» на зупиненому не надсилали жодного запиту: цикл перевіряв
 * умову перед першим кроком і виходив.
 */
export function importJobIsResumable(state) {
  return state === 'ready' || state === 'running' || state === 'stalled' || state === 'blocked';
}

export function importJobIsAbandoned(job, state, now = 0) {
  // `ready` теж покидають: чергу порахували, підтвердження не натиснули й пішли.
  // Поки цього стану тут не було, порахований чужий job замикав налаштування й
  // не давав нікому, крім автора та власника, жодної кнопки.
  if (state !== 'ready' && state !== 'stalled' && state !== 'blocked') return false;
  return now - millisOf(job?.updatedAt || job?.createdAt) > IMPORT_ABANDONED_AFTER_MS;
}

/**
 * Слово в пігулці й тон, яким його малюють.
 */
export function describeImportJob(job, now = 0) {
  const state = importJobState(job, now);
  const key = state === 'blocked' && job?.blockedReason === 'connection'
    ? 'blocked-connection'
    : state;
  const presentation = IMPORT_STATE_PRESENTATION[key] || IMPORT_STATE_PRESENTATION.none;
  return { state, label: presentation.label, tone: presentation.tone };
}

/**
 * Що можна зробити з цим перенесенням — з погляду того, хто на нього дивиться.
 *
 * Порядок у списку — це порядок на екрані, і перший елемент завжди головна дія.
 * Для жодного стану список не буває порожнім одразу для всіх трьох читачів:
 * саме це й означає «немає стану без виходу».
 *
 * @param {object} job Серіалізований job або null.
 * @param {string} state Результат `importJobState`.
 * @param {{userId: string, isOrganizationOwner: boolean, isOrganizationAdmin: boolean, abandoned: boolean}} viewer Хто дивиться.
 */
export function importActionsFor(job, state, viewer = {}) {
  const {
    userId = '',
    isOrganizationOwner = false,
    isOrganizationAdmin = true,
    abandoned = false,
  } = viewer;
  const author = job?.createdBy || '';
  const mine = !author || author === userId;
  // Зупинити можна своє; чуже — власнику; покинуте — будь-якому адміністратору.
  // Інакше один заморожений job тримає організацію в заручниках, бо
  // `assertNoForeignActiveImport` не дасть нікому почати власний.
  const mayStop = mine || isOrganizationOwner || (abandoned && isOrganizationAdmin);

  if (state === 'none') {
    return [{ id: 'start', label: 'Перенести', kind: 'primary' }];
  }
  if (state === 'ready') {
    return [
      ...(mine ? [{ id: 'run', label: 'Почати перенесення', kind: 'primary' }] : []),
      ...(mayStop ? [{ id: 'cancel', label: 'Скасувати', kind: 'danger' }] : []),
    ];
  }
  if (state === 'running') {
    return mayStop ? [{ id: 'cancel', label: 'Зупинити', kind: 'danger' }] : [];
  }
  if (state === 'stalled') {
    return [
      ...(mine ? [{ id: 'run', label: 'Продовжити', kind: 'primary' }] : []),
      ...(mayStop ? [{ id: 'cancel', label: 'Зупинити', kind: 'danger' }] : []),
    ];
  }
  if (state === 'blocked') {
    // Дві дії, а не одна: полагодити причину й піти далі — різні кроки, і після
    // першого має лишитися чим зробити другий. Поки тут стояла сама лише
    // причина, людина вставляла новий токен — і опинялась перед тією самою
    // панеллю «Потрібен новий токен» без жодної кнопки, що продовжує.
    const repair = job?.blockedReason === 'connection'
      ? { id: 'token', label: 'Ввести новий токен', kind: 'primary' }
      : job?.blockedReason === 'plan'
        ? { id: 'scope', label: 'Відкрити «Проєкти й статуси»', kind: 'primary' }
        : null;
    const resume = repair
      ? { id: 'run', label: 'Продовжити', kind: 'secondary' }
      : { id: 'run', label: 'Спробувати ще раз', kind: 'primary' };
    return [
      ...(mine ? [repair, resume].filter(Boolean) : []),
      ...(mayStop ? [{ id: 'cancel', label: 'Зупинити', kind: 'danger' }] : []),
    ];
  }
  // Завершене й скасоване прибирає з екрана будь-хто, хто його бачить: це не
  // керування чужою роботою, а прибрати зі столу те, що вже сталося.
  return [
    { id: 'acknowledge', label: 'Зрозуміло', kind: 'primary' },
    { id: 'restart', label: state === 'cancelled' ? 'Почати заново' : 'Перенести ще раз', kind: 'secondary' },
  ];
}

/**
 * Чому перенесення спинилось, а не просто не змогло одну задачу.
 *
 * Різниця не косметична. Відкликаний токен ловився тим самим `catch`, що й
 * зіпсована задача: importer позначав задачу невдалою, посував чергу й ішов
 * далі — і 663 задачі ставали 663 помилками за десять хвилин, по одному
 * HTTP-запиту на кожну. Смуга доходила до 100%, статус ставав «Завершено», а
 * перенесено було нуль. Саме це й видно на скріншоті, з якого почалась ця
 * робота.
 *
 * @param {Error} error Виняток кроку імпорту.
 * @returns {'connection'|'plan'|'quota'|''} Порожній рядок означає, що зламалась саме ця задача.
 */
export function importHaltReason(error) {
  const status = Number(error?.status);
  const message = String(error?.message || '');
  const code = String(error?.code || '').toLowerCase();
  if (error?.source === 'youtrack' && (status === 401 || status === 403)) return 'connection';
  if (/^YouTrack не підключено|^Підключення YouTrack пошкоджене/.test(message)) return 'connection';
  if (/^Ліміт /.test(message)) return 'plan';
  if (/^Організацію не знайдено|^Проєкт-призначення |^Джерельний проєкт не знайдено/.test(message)) return 'plan';
  if (code === '8' || code.includes('resource-exhausted') || /resource_exhausted|quota exceeded/i.test(message)) {
    return 'quota';
  }
  return '';
}

// Скільки поспіль невдалих задач означає, що ламається не задача, а щось під нею.
export const IMPORT_FAILURE_STREAK_LIMIT = 10;

// Речення, яке пояснює зупинку. Стоїть тут, а не в JSX, бо це частина словника
// станів: сервер записує причину одним словом, екран читає її одним викликом.
const HALT_SENTENCES = Object.freeze({
  connection: 'YouTrack більше не приймає збережений токен. Перенесення спинилося й нічого не втратило — усе, що встигло перенестись, лишилось у QuickTeam.',
  plan: 'Перенесення спинилося: обраний проєкт або статус більше не доступний у QuickTeam.',
  quota: 'Сьогоднішній ліміт звернень до бази вичерпано. Перенесення можна продовжити завтра — воно почнеться з тієї задачі, на якій спинилося.',
  failures: 'Кілька задач поспіль не перенеслися, тому перенесення спинилося, щоб не витратити чергу даремно.',
  // Окрема причина, бо це окремий етап: задачі вже перенесені, лишилися звʼязки
  // між ними. Казати тут «кілька задач поспіль не перенеслися» — неправда, і
  // саме так воно й читалося, поки фаза звʼязків позичала чужий текст.
  links: 'Задачі перенесено; спинилося на звʼязках між ними. Продовжте — задачі не дублюються.',
});

export function importHaltSentence(reason) {
  return HALT_SENTENCES[reason] || HALT_SENTENCES.failures;
}

/**
 * Що в збереженому виборі більше не сходиться з тим, що є зараз.
 *
 * Вибір тепер живе на сервері й переживає перезавантаження — а разом із цим
 * переживає й редагування workflow, архівування проєкту та звільнення людини.
 * Раніше такі розбіжності були рідкою гонкою, яку `prepare` ловив і повертав
 * помилкою у той момент, коли натискали «Перевірити імпорт»; тепер вони —
 * звичайний стан наступного ранку, тож їх називають до натискання, поіменно, і
 * кожна веде у вікно, де її виправляють.
 *
 * @param {object} plan Збережений вибір.
 * @param {object} discovery Знімок YouTrack.
 * @param {{targetStatuses: object[], projects: object[], memberIds: Set<string>}} present Те, що є в QuickTeam зараз.
 */
export function importPlanIssues(plan, discovery, present = {}) {
  const { targetStatuses = [], projects = [], memberIds = new Set() } = present;
  const selected = (plan?.selectedProjectIds || []).filter(Boolean);
  if (!selected.length) return [];

  const sourceProjects = new Map((discovery?.projects || []).map(project => [project.id, project]));
  const statusById = new Map(targetStatuses.map(status => [status.id, status]));
  const projectById = new Map(projects.map(project => [project.id, project]));
  const issues = [];

  selected.forEach(sourceProjectId => {
    const sourceProject = sourceProjects.get(sourceProjectId);
    if (!sourceProject) {
      issues.push({
        id: `project-gone-${sourceProjectId}`,
        tone: 'critical',
        opens: 'scope',
        title: 'Один із обраних проєктів більше не видно у YouTrack',
        description: 'Оновіть список і оберіть заново',
      });
      return;
    }
    const targetId = plan?.projectMappings?.[sourceProjectId] || 'create';
    const target = targetId === 'create' ? null : projectById.get(targetId);
    if (targetId !== 'create' && (!target || target.status === 'archived')) {
      issues.push({
        id: `target-gone-${sourceProjectId}`,
        tone: 'critical',
        opens: 'scope',
        title: `Проєкт-призначення для «${sourceProject.name}» недоступний`,
        description: 'Оберіть інший проєкт або створіть новий',
      });
      return;
    }
    const hidden = new Set(target?.hiddenColumns || []);
    const chosenStatuses = plan?.statusFilters?.[sourceProjectId] || [];
    if (!chosenStatuses.length) {
      issues.push({
        id: `no-status-${sourceProjectId}`,
        tone: 'critical',
        opens: 'scope',
        title: `У проєкті «${sourceProject.name}» не обрано жодного статусу`,
        description: 'Оберіть хоча б один — інакше переносити нічого',
      });
      return;
    }
    chosenStatuses.forEach(sourceStatus => {
      const mapped = plan?.statusMappings?.[sourceProjectId]?.[sourceStatus] || '';
      if (!mapped || !statusById.has(mapped)) {
        issues.push({
          id: `status-gone-${sourceProjectId}-${sourceStatus}`,
          tone: 'critical',
          opens: 'scope',
          title: `Статус QuickTeam для «${sourceStatus}» більше не існує`,
          description: `Проєкт «${sourceProject.name}» — оберіть інший статус`,
        });
        return;
      }
      if (hidden.has(mapped)) {
        issues.push({
          id: `status-hidden-${sourceProjectId}-${sourceStatus}`,
          tone: 'critical',
          opens: 'scope',
          title: `Статус для «${sourceStatus}» приховано у проєкті-призначенні`,
          description: `Проєкт «${sourceProject.name}» — оберіть видимий статус`,
        });
      }
    });
  });

  Object.entries(plan?.userMappings || {}).forEach(([sourceId, memberId]) => {
    if (!memberId || memberId === 'external' || memberIds.has(memberId)) return;
    const user = (discovery?.users || []).find(candidate => sourceUserId(candidate) === sourceId);
    issues.push({
      id: `member-gone-${sourceId}`,
      tone: 'critical',
      opens: 'people',
      title: `${sourceUserName(user) || 'Користувач YouTrack'} прив’язаний до того, кого вже немає в організації`,
      description: 'Оберіть іншого учасника або лишіть зовнішнім автором',
    });
  });

  return issues;
}
