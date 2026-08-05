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

export function projectIssuePrefix(project) {
  if (project?.issuePrefix) return String(project.issuePrefix).slice(0, 8).toUpperCase();
  const letters = String(project?.name || 'WS').match(/\p{L}/gu)?.join('') || 'WS';
  return letters.slice(0, 3).toUpperCase();
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
