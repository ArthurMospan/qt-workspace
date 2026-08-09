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

/** Uppercase letters/numbers only; the hyphen belongs to the final issue key. */
export function normalizeIssuePrefix(value) {
  return String(value || '')
    .trim()
    .replace(/[^\p{L}\p{N}]/gu, '')
    .slice(0, ISSUE_PREFIX_MAX_LENGTH)
    .toLocaleUpperCase('uk-UA');
}

export function isValidIssuePrefix(value) {
  const raw = String(value || '').trim();
  return raw.length >= ISSUE_PREFIX_MIN_LENGTH
    && raw.length <= ISSUE_PREFIX_MAX_LENGTH
    && /^[\p{L}\p{N}]+$/u.test(raw);
}

export function projectIssuePrefix(project) {
  const explicit = normalizeIssuePrefix(project?.issuePrefix);
  if (isValidIssuePrefix(explicit)) return explicit;

  const letters = String(project?.name || 'WS').match(/\p{L}|\p{N}/gu)?.join('') || 'WS';
  const generated = normalizeIssuePrefix(letters.slice(0, 3));
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
