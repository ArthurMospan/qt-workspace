'use client';

import UserAvatar from '@/components/UserAvatar';
import { filterMentionCandidates } from '@/lib/utils/mentions';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const URL_PATTERN = 'https?:\\/\\/[^\\s]+';

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
  const byName = new Map(candidates.map(member => [member.name, member]));

  // URLs first: alternation resolves left to right at a given position, and a
  // link may itself contain an `@`, which must not be read as a mention.
  const mentionPattern = candidates.length
    ? `@(?:${candidates.map(member => escapeRegExp(member.name)).join('|')})(?=\\s|[.,!?;:]|$)`
    : null;
  const regex = new RegExp(`(${[URL_PATTERN, mentionPattern].filter(Boolean).join('|')})`, 'g');

  const nodes = [];
  let cursor = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const token = match[0];
    cursor = regex.lastIndex;

    if (token.startsWith('@')) {
      const member = byName.get(token.slice(1));
      nodes.push(
        <span
          key={`mention-${match.index}`}
          className={`mx-[2px] inline-flex max-w-full items-center gap-1 rounded-full px-2 py-[2px] align-middle text-[12px] font-bold ${
            dark ? 'bg-white/15 text-white' : 'bg-black/[0.08] text-ink'
          }`}
        >
          <UserAvatar user={member} size={16} />
          <span className="truncate">{member.name}</span>
        </span>,
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
