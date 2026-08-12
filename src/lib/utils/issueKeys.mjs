// src/lib/utils/issueKeys.mjs
// What a task is called, and where that name comes from.
//
// The prefix rule was written twice server-side (the issues route and the
// Telegram intake) and a third, different rule lived on the client, which
// *invented* a key when a task had none: it glued the project's first three
// letters to four characters of the Firestore document id. `QUI-a3f2` is not an
// identifier anybody can use — you cannot say it, search it, or find it again —
// and it changed the moment the same task was viewed from another project.
//
// A task either has a key or it does not. Where it does not, the title is its
// name and nothing is drawn.

export const ISSUE_PREFIX_MIN_LENGTH = 2;
export const ISSUE_PREFIX_MAX_LENGTH = 8;

const CYRILLIC_TO_LATIN = Object.freeze({
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ye',
  ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'yi', й: 'y', к: 'k', л: 'l',
  м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '',
  ю: 'yu', я: 'ya', ё: 'yo', ы: 'y', э: 'e', ъ: '',
});

function latinize(value) {
  return Array.from(String(value || '').toLocaleLowerCase('uk-UA'))
    .map(character => CYRILLIC_TO_LATIN[character] ?? character)
    .join('')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** URL-safe uppercase ASCII only; the hyphen belongs to the final issue key. */
export function normalizeIssuePrefix(value) {
  return latinize(value)
    .trim()
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, ISSUE_PREFIX_MAX_LENGTH)
    .toUpperCase();
}

export function isValidIssuePrefix(value) {
  const raw = String(value || '').trim();
  return raw.length >= ISSUE_PREFIX_MIN_LENGTH
    && raw.length <= ISSUE_PREFIX_MAX_LENGTH
    && /^[A-Z0-9]+$/i.test(raw);
}

export function projectIssuePrefix(project) {
  const explicit = normalizeIssuePrefix(project?.issuePrefix);
  if (isValidIssuePrefix(explicit)) return explicit;

  const generated = normalizeIssuePrefix(project?.name || 'WS').slice(0, 3);
  if (generated.length >= ISSUE_PREFIX_MIN_LENGTH) return generated;
  return normalizeIssuePrefix(`${generated}WS`).slice(0, 3) || 'WS';
}

/** Whether another project in the same organization already owns this prefix. */
export function projectIssuePrefixTaken(projects, prefix, excludeProjectId = '') {
  const normalized = normalizeIssuePrefix(prefix);
  if (!normalized) return false;
  return (projects || []).some(project => (
    project?.id !== excludeProjectId
    && projectIssuePrefix(project) === normalized
  ));
}

/**
 * Pick a readable organization-wide prefix without making the user discover a
 * collision after submitting the project form: `ENG`, `ENG2`, `ENG3`, ...
 */
export function suggestAvailableIssuePrefix(project, projects, excludeProjectId = '') {
  const base = projectIssuePrefix(project);
  if (!projectIssuePrefixTaken(projects, base, excludeProjectId)) return base;

  for (let index = 2; index <= 999_999; index += 1) {
    const suffix = String(index);
    const stemLength = ISSUE_PREFIX_MAX_LENGTH - suffix.length;
    const stem = Array.from(base).slice(0, stemLength).join('');
    const candidate = normalizeIssuePrefix(`${stem}${suffix}`);
    if (
      isValidIssuePrefix(candidate)
      && !projectIssuePrefixTaken(projects, candidate, excludeProjectId)
    ) {
      return candidate;
    }
  }

  return base;
}

// `WS-` is what tasks were keyed with before projects had prefixes of their own.
// The number is the real, stable part of such a key, so it is kept and only the
// generic prefix is replaced.
const LEGACY_PREFIX = /^WS-(\d+)$/;

/**
 * The key to print for a task, or an empty string when it has none.
 *
 * @param {object} issue The task.
 * @param {object} project Its project, for re-prefixing a legacy `WS-` key.
 */
export function taskDisplayKey(issue, project = null) {
  const key = typeof issue?.issueKey === 'string' ? issue.issueKey.trim() : '';
  if (!key) return '';
  const legacy = key.match(LEGACY_PREFIX);
  if (!legacy) return key;
  return `${projectIssuePrefix(project)}-${legacy[1]}`;
}

/** Raw pre-prefix key to try when somebody opens a displayed legacy key. */
export function legacyStoredIssueKey(displayKey, project = null) {
  const match = String(displayKey || '').trim().match(/^([\p{L}\p{N}]+)-(\d+)$/u);
  if (!match || normalizeIssuePrefix(match[1]) !== projectIssuePrefix(project)) return '';
  return `WS-${match[2]}`;
}

/** The human key is canonical in URLs; the document id is only a fallback. */
export function issueRouteIdentifier(issue, project = null) {
  const issueKey = taskDisplayKey(issue, project);
  if (/^[A-Z0-9]{2,8}-\d+$/i.test(issueKey)) return issueKey.toUpperCase();
  return typeof issue?.id === 'string' ? issue.id.trim() : '';
}

/** Build one canonical task-details path everywhere the product links to it. */
export function issuePath(issue, projectOrId = issue?.projectId) {
  const projectId = typeof projectOrId === 'string'
    ? projectOrId.trim()
    : typeof projectOrId?.id === 'string'
      ? projectOrId.id.trim()
      : '';
  const project = projectOrId && typeof projectOrId === 'object' ? projectOrId : null;
  const identifier = issueRouteIdentifier(issue, project);
  if (!projectId || !identifier) return '';
  return `/${encodeURIComponent(projectId)}/issue/${encodeURIComponent(identifier)}`;
}

/** Accept both the canonical issue key and old Firestore-id links. */
export function issueMatchesRouteIdentifier(issue, routeIdentifier, project = null) {
  let identifier = String(routeIdentifier || '').trim();
  try {
    identifier = decodeURIComponent(identifier);
  } catch {
    // A malformed escape sequence is simply not a matching issue key.
  }
  const normalizedIdentifier = identifier.toLocaleUpperCase('uk-UA');
  return issue?.id === identifier
    || issueRouteIdentifier(issue, project) === normalizedIdentifier
    || issueRouteIdentifier(issue) === normalizedIdentifier
    || legacyStoredIssueKey(identifier, project) === issue?.issueKey;
}
