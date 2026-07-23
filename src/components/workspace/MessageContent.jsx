import React from 'react';
import HoverCard from './HoverCard';

export default function MessageContent({ text, members, searchTerm }) {
  if (!text) return null;

  const highlightText = (content) => {
    if (!searchTerm) return content;
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const parts = content.split(regex);
    return (
      <>
        {parts.map((p, i) =>
          regex.test(p) ? (
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
  const lines = text.split('\n');

  return (
    <>
      {lines.map((line, idx) => {
        // Handle images
        if (line.startsWith('![attachment](')) {
          const url = line.slice(14, -1);
          // eslint-disable-next-line @next/next/no-img-element
          return <img key={idx} src={url} alt="attachment" className="max-w-[300px] max-h-[300px] rounded-[8px] border border-line mt-2 mb-1 object-cover" />;
        }
        if (line.startsWith('📎 ')) {
          return (
             <div key={idx} className="h-[40px] px-3 mt-1 inline-flex items-center bg-canvas rounded-[6px] border border-line text-[12px] font-medium text-ink">
               {line}
             </div>
          );
        }

        // Tokenizer for formatting
        // We need to parse **, *, _, ~, `, @user, #issue, URLs
        // A simple regex approach that splits the string

        const tokenRegex = /(\*\*.*?\*\*|\*.*?\*|_.*?_|~.*?~|`[^`]+`|@[a-zA-Zа-яА-ЯіІїЇєЄ0-9_]+|#[a-zA-Z0-9-]+|https?:\/\/[^\s]+)/g;
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
                  <HoverCard key={pIdx} type="user" value={part.slice(1)} members={members}>
                    <span className="bg-ink/10 text-ink font-bold px-1 rounded cursor-pointer hover:bg-ink/20 transition-colors">
                      {part}
                    </span>
                  </HoverCard>
                );
              }
              if (part.startsWith('#')) {
                return (
                  <HoverCard key={pIdx} type="issue" value={part.slice(1)} members={members}>
                    {part}
                  </HoverCard>
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
    </>
  );
}
