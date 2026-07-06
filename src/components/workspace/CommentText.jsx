'use client';
import { parseMentions } from '@/lib/utils/mentions';

export default function CommentText({ text, members = [] }) {
  if (!text) return null;

  // Parse mentions and create parts
  const mentions = parseMentions(text);
  const memberMap = new Map(members.map(m => [
    (m.name || '').toLowerCase(),
    { id: m.id || m.uid, name: m.name, avatar: m.avatar || m.photoURL }
  ]));

  // Split text by @mentions and reconstruct with highlights
  const parts = [];
  let lastIndex = 0;
  const regex = /@(\w+)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex, match.index)
      });
    }

    // Add mention
    const mentionName = match[1];
    const isMember = mentions.includes(mentionName) && memberMap.has(mentionName.toLowerCase());

    parts.push({
      type: 'mention',
      content: `@${mentionName}`,
      isMember
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.substring(lastIndex)
    });
  }

  return (
    <>
      {parts.map((part, i) =>
        part.type === 'mention' ? (
          <span
            key={i}
            className={`font-bold ${
              part.isMember
                ? 'text-[#6366f1] bg-[#6366f1]/10 px-[2px] rounded-[3px]'
                : 'text-muted'
            }`}
          >
            {part.content}
          </span>
        ) : (
          <span key={i}>{part.content}</span>
        )
      )}
    </>
  );
}
