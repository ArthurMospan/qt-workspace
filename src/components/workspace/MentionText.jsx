'use client';

import IssueMentionChip from '@/components/workspace/IssueMentionChip';
import HoverCard from '@/components/workspace/HoverCard';
import { filterMentionCandidates } from '@/lib/utils/mentions';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const URL_PATTERN = 'https?:\\/\\/[^\\s]+';

// `#QT-12`, at a word boundary — the same rule the composer above this text
// uses to decide it should offer the task picker. The boundary character is
// part of the match because a lookbehind is not worth the browser floor; it is
// handed back as plain text below.
//
// The task chat is where `#` mentions are *written* most often, and it was the
// one surface that never read them back: the picker inserted a key and the
// message then showed that key, raw, while the same message in the workspace
// chat showed the task's name. Same text, two different products.
const ISSUE_PATTERN = '(?:^|[\\s([{])#[\\p{L}\\p{N}-]+';

// Everything up to the first whitespace is greedy, so a pasted address that
// ends a sentence swallows the punctuation. Hand that tail back as plain text —
// `.../a.` is a sentence about `/a`, not a link to `/a.`.
function splitUrlTail(url) {
  let end = url.length;
  while (end > 0) {
    const char = url[end - 1];
    if ('.,;:!?'.includes(char)) {
      end -= 1;
      continue;
    }
    // A closing paren belongs to the URL unless it is unbalanced, so links that
    // legitimately carry one (Wikipedia, Figma node ids) stay intact.
    if (char === ')') {
      const head = url.slice(0, end);
      const opened = (head.match(/\(/g) || []).length;
      const closed = (head.match(/\)/g) || []).length;
      if (closed > opened) {
        end -= 1;
        continue;
      }
    }
    break;
  }
  return [url.slice(0, end), url.slice(end)];
}

export default function MentionText({ text = '', members = [], dark = false, excludeMemberId = '' }) {
  if (!text) return text;

  const candidates = filterMentionCandidates(members, excludeMemberId)
    .sort((a, b) => b.name.length - a.name.length);

  // URLs first: alternation resolves left to right at a given position, and a
  // link may itself contain an `@`, which must not be read as a mention.
  const mentionPattern = candidates.length
    ? `@(?:${candidates.map(member => escapeRegExp(member.name)).join('|')})(?=\\s|[.,!?;:]|$)`
    : null;
  const regex = new RegExp(
    `(${[URL_PATTERN, mentionPattern, ISSUE_PATTERN].filter(Boolean).join('|')})`,
    'gu',
  );

  const nodes = [];
  let cursor = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const token = match[0];
    cursor = regex.lastIndex;

    if (token.startsWith('@')) {
      // The very same component the workspace chat uses, rather than a lookalike
      // span: a mention here opens the person's profile and shows their card,
      // which the retyped copy never could.
      nodes.push(
        <HoverCard
          key={`mention-${match.index}`}
          value={token.slice(1)}
          members={members}
          dark={dark}
        />,
      );
      continue;
    }

    if (!token.startsWith('http')) {
      const hash = token.indexOf('#');
      if (hash > 0) nodes.push(token.slice(0, hash));
      nodes.push(
        <IssueMentionChip
          key={`issue-${match.index}`}
          issueKey={token.slice(hash + 1).toLocaleUpperCase('uk-UA')}
          dark={dark}
        />,
      );
      continue;
    }

    const [href, tail] = splitUrlTail(token);
    nodes.push(
      <a
        key={`link-${match.index}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className={`font-medium break-all underline decoration-1 underline-offset-2 transition-colors hover:decoration-2 ${
          dark ? 'text-white' : 'text-ink'
        }`}
      >
        {href}
      </a>,
    );
    if (tail) nodes.push(tail);
  }

  if (nodes.length === 0) return text;
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}
