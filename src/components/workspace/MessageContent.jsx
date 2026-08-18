import React from 'react';
import HoverCard from './HoverCard';
import IssueMentionChip from './IssueMentionChip';
import { ChatAttachmentList } from '@/components/ui/Chat/ChatAttachmentList';

// Before attachments were a field of their own, a file was written into the
// message text — `![attachment](url)` for a picture, `📎 name` for anything
// else. Those messages are still in the channels, and each of the two used to
// draw itself: a bare 300px `<img>` with a border, and a grey 40px box with a
// paperclip in the middle of the name. Neither looked like the tile the same
// file gets today, which is most of why files in chat "все по-різному".
//
// They are read out as attachments now and handed to the one tile.
function legacyAttachment(line) {
  if (line.startsWith('![attachment](') && line.endsWith(')')) {
    const url = line.slice(14, -1);
    return url ? { name: url.split(/[?#]/)[0].split('/').pop() || 'Зображення', url } : null;
  }
  if (line.startsWith('📎 ')) {
    const name = line.slice(2).trim();
    return name ? { name } : null;
  }
  return null;
}

export default function MessageContent({ text, members, searchTerm }) {
  if (!text) return null;
  const memberNames = (members || [])
    .map(member => member.name || member.displayName || member.email)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const escapedMemberNames = memberNames.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  const highlightText = (content) => {
    if (!searchTerm) return content;
    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedSearchTerm})`, 'gi');
    const parts = content.split(regex);
    const normalizedSearchTerm = searchTerm.toLocaleLowerCase('uk-UA');
    return (
      <>
        {parts.map((p, i) =>
          p.toLocaleLowerCase('uk-UA') === normalizedSearchTerm ? (
            <mark key={i} className="bg-yellow-200/60 text-black px-0.5 rounded font-medium">
              {p}
            </mark>
          ) : (
            p
          )
        )}
      </>
    );
  };

  // We split by lines first
  const allLines = text.split('\n');
  const legacyAttachments = allLines.map(legacyAttachment).filter(Boolean);
  const lines = allLines.filter(line => !legacyAttachment(line));

  return (
    <>
      {lines.map((line, idx) => {
        // Tokenizer for formatting
        // We need to parse **, *, _, ~, `, @user, #issue, URLs
        // A simple regex approach that splits the string

        const mentionPattern = escapedMemberNames.length
          ? `@(?:${escapedMemberNames.join('|')})`
          : '@[^\\s]+';
        const tokenRegex = new RegExp(`(\\*\\*.*?\\*\\*|\\*.*?\\*|_.*?_|~.*?~|\\x60[^\\x60]+\\x60|${mentionPattern}|#[\\p{L}\\p{N}-]+|https?:\\/\\/[^\\s]+)`, 'gu');
        const parts = line.split(tokenRegex);

        return (
          <div key={idx} className="mb-1 last:mb-0">
            {parts.map((part, pIdx) => {
              if (!part) return null;

              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
              }
              if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
                return <em key={pIdx}>{part.slice(1, -1)}</em>;
              }
              if (part.startsWith('_') && part.endsWith('_')) {
                return <em key={pIdx}>{part.slice(1, -1)}</em>;
              }
              if (part.startsWith('~') && part.endsWith('~')) {
                return <del key={pIdx}>{part.slice(1, -1)}</del>;
              }
              if (part.startsWith('`') && part.endsWith('`')) {
                return <code key={pIdx} className="bg-[#f0f0f0] text-[#e01e5a] px-1 py-0.5 rounded text-[13px] font-mono">{part.slice(1, -1)}</code>;
              }
              if (part.startsWith('@')) {
                return (
                  <HoverCard key={pIdx} type="user" value={part.slice(1)} members={members} />
                );
              }
              if (part.startsWith('#')) {
                const issueKey = part.slice(1).toLocaleUpperCase('uk-UA');
                return (
                  <IssueMentionChip key={pIdx} issueKey={issueKey} />
                );
              }
              if (part.startsWith('http://') || part.startsWith('https://')) {
                return (
                  <a
                    key={pIdx}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ink hover:underline break-all inline-flex items-center gap-1"
                  >
                    {part}
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="inline">
                      <path d="M2 10L10 2M10 2H6M10 2V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                );
              }

              return <span key={pIdx}>{highlightText(part)}</span>;
            })}
          </div>
        );
      })}
      <ChatAttachmentList attachments={legacyAttachments} />
    </>
  );
}
