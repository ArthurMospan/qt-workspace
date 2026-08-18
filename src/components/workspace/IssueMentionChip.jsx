'use client';

// A `#QT-12` in a message: the same chip a mentioned person wears, with the
// task's own name in it.
//
// It used to be a hovercard — the key alone, and you had to point at it and
// wait to find out which task it was. «зробив у #QT-12» is not a sentence.
// The name is shown outright, and the chip is `MENTION_CHIP`, the one shape
// shared with `@name`: a mentioned task and a mentioned person are the same
// kind of thing to read past, so they look the same.

import { useCallback, useEffect, useState } from 'react';
import { TaskIcon } from '@/lib/design/icons';
import { useAppContext } from '@/lib/context/AppContext';
import { auth } from '@/lib/firebase';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { MENTION_CHIP_BADGE, mentionChipClass, mentionChipLabel } from './HoverCard';

// One request per key for the lifetime of the page, shared by every message on
// it: a conversation that mentions three tasks twenty times asks three times.
//
// Only an *answer* is kept. The first version cached the failure too, and the
// most common failure is the one that happens on mount — Firebase has not
// restored the session yet, so there is no token to send. Caching that meant a
// chat opened before sign-in finished never resolved a single mention for the
// rest of the visit.
const resolved = new Map();

async function fetchIssueByKey(organizationId, issueKey) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not signed in yet');
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
}

function resolveIssueMention(organizationId, issueKey) {
  const id = `${organizationId}:${issueKey}`;
  const cached = resolved.get(id);
  if (cached) return cached;

  const request = fetchIssueByKey(organizationId, issueKey).then(issue => {
    // A key that resolves to nothing is a real answer and worth keeping; a key
    // that could not be asked about is not, so the next render tries again.
    if (!issue) resolved.set(id, Promise.resolve(null));
    return issue;
  }).catch(error => {
    resolved.delete(id);
    console.error('[IssueMentionChip] lookup failed', issueKey, error);
    return null;
  });

  resolved.set(id, request);
  return request;
}

/**
 * One `#`-mention of a task inside a message: its name, and a click that opens
 * it in the quick-view panel without leaving the conversation.
 *
 * @param {string} props.issueKey The key written in the message, already uppercased.
 * @param {boolean} props.dark On a dark bubble — a task chat message of your own.
 */
export default function IssueMentionChip({ issueKey, dark = false }) {
  const { activeOrgId, currentUser } = useAppContext();
  const openIssueQuickView = useWorkspaceStore(state => state.openIssueQuickView);
  const [issue, setIssue] = useState(null);
  // Re-run once the session arrives: the first attempt on a cold page has no
  // token, and the chip has to try again rather than stay a bare key forever.
  const signedInAs = currentUser?.uid || currentUser?.id || '';

  useEffect(() => {
    if (!activeOrgId || !issueKey || !signedInAs) return undefined;
    let cancelled = false;
    resolveIssueMention(activeOrgId, issueKey).then(found => {
      if (!cancelled && found) setIssue(found);
    });
    return () => { cancelled = true; };
  }, [activeOrgId, issueKey, signedInAs]);

  // Clicking is never refused. If the name has not arrived — a slow request, a
  // page opened and clicked in the same second — the click resolves it and then
  // opens, instead of the chip sitting there inert.
  const open = useCallback(async () => {
    if (issue) {
      openIssueQuickView(issue);
      return;
    }
    if (!activeOrgId) return;
    const found = await resolveIssueMention(activeOrgId, issueKey);
    if (found) {
      setIssue(found);
      openIssueQuickView(found);
    }
  }, [activeOrgId, issue, issueKey, openIssueQuickView]);

  return (
    <button
      type="button"
      onClick={open}
      title={issue ? `${issueKey}: ${issue.title}` : `Завдання ${issueKey}`}
      className={mentionChipClass({ dark })}
      data-mention="issue"
    >
      {/* Exactly where the face sits on a person's mention, at the same size
          and out of the line's way, so the two chips are one shape. */}
      <span className={`${MENTION_CHIP_BADGE} ${dark ? 'text-white/70' : 'text-muted'}`}>
        <TaskIcon size={12} />
      </span>
      {mentionChipLabel(issue?.title || issueKey)}
    </button>
  );
}
