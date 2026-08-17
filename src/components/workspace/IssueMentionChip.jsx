'use client';

// A `#QT-12` in a message, showing what the task is called.
//
// This used to be a hovercard: the key alone, and you had to point at it and
// wait to find out which task it was. A mention is a reference in a sentence —
// «зробив у #QT-12» tells you nothing, «зробив у QT-12 · Виправити експорт» is
// the sentence somebody meant to write. The title is shown outright and the
// preview is gone with it.
//
// The name costs one request per distinct key, ever: the resolver below is a
// module-level cache shared by every message on the page, so a conversation
// that mentions three tasks twenty times asks three times. A key that cannot be
// resolved simply stays a key — a mention never renders as an error.

import { useEffect, useState } from 'react';
import { TaskIcon } from '@/lib/design/icons';
import { useAppContext } from '@/lib/context/AppContext';
import { auth } from '@/lib/firebase';
import useWorkspaceStore from '@/store/useWorkspaceStore';

const resolved = new Map();

// The same call the `#` picker makes, so a mention that could be written can be
// read. Failures resolve to `null` and are cached too: a missing task does not
// get asked about again on every re-render of the conversation.
function resolveIssueMention(organizationId, issueKey) {
  const id = `${organizationId}:${issueKey}`;
  if (resolved.has(id)) return resolved.get(id);

  const request = (async () => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return null;
    const params = new URLSearchParams({ organizationId, q: issueKey, mention: 'issue' });
    const response = await fetch(`/api/search?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Search failed');
    return (payload.results || []).find(item => (
      String(item.issueKey || '').toLocaleUpperCase('uk-UA') === issueKey
    )) || null;
  })().catch(error => {
    console.error('[IssueMentionChip] lookup failed', issueKey, error);
    return null;
  });

  resolved.set(id, request);
  return request;
}

/**
 * One `#`-mention of a task inside a message: its key, its name, and a click
 * that opens it in the quick-view panel without leaving the conversation.
 *
 * @param {string} props.issueKey The key written in the message, already uppercased.
 */
export default function IssueMentionChip({ issueKey }) {
  const { activeOrgId } = useAppContext();
  const openIssueQuickView = useWorkspaceStore(state => state.openIssueQuickView);
  const [issue, setIssue] = useState(null);

  useEffect(() => {
    if (!activeOrgId || !issueKey) return undefined;
    let cancelled = false;
    resolveIssueMention(activeOrgId, issueKey).then(found => {
      if (!cancelled) setIssue(found);
    });
    return () => { cancelled = true; };
  }, [activeOrgId, issueKey]);

  return (
    <button
      type="button"
      disabled={!issue}
      onClick={() => issue && openIssueQuickView(issue)}
      title={issue ? `Переглянути ${issueKey}: ${issue.title}` : `Завдання ${issueKey}`}
      className="inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full bg-black/[0.07] px-1.5 py-0.5 align-middle font-semibold text-ink transition-colors hover:bg-black/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 disabled:cursor-default disabled:hover:bg-black/[0.07]"
    >
      <TaskIcon size={11} className="shrink-0 text-muted" />
      <span className="shrink-0 font-mono text-[11px] font-bold text-muted">{issueKey}</span>
      {issue?.title && <span className="truncate">{issue.title}</span>}
    </button>
  );
}
