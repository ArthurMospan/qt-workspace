'use client';

import UserAvatar from '@/components/UserAvatar';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default function MentionText({ text = '', members = [], dark = false }) {
  const candidates = members
    .filter(member => member?.name)
    .sort((a, b) => b.name.length - a.name.length);

  if (!text || candidates.length === 0) return text;

  const byName = new Map(candidates.map(member => [member.name, member]));
  const pattern = candidates.map(member => escapeRegExp(member.name)).join('|');
  const regex = new RegExp(`@(${pattern})(?=\\s|[.,!?;:]|$)`, 'g');
  const parts = [];
  let cursor = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));
    const member = byName.get(match[1]);
    parts.push(
      <span
        key={`${member.id || member.uid}-${match.index}`}
        className={`mx-[2px] inline-flex max-w-full items-center gap-1 rounded-full px-2 py-[2px] align-middle text-[12px] font-bold ${
          dark ? 'bg-white/15 text-white' : 'bg-black/[0.08] text-ink'
        }`}
      >
        <UserAvatar user={member} size={16} />
        <span className="truncate">{member.name}</span>
      </span>,
    );
    cursor = regex.lastIndex;
  }

  if (cursor === 0) return text;
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}
