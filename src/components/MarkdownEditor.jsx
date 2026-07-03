import React, { useState, useRef, useCallback, useMemo } from 'react';
import MarkdownViewer from './MarkdownViewer';
import { Bold, Italic, Link as LinkIcon, List, ListOrdered, CheckSquare, Code, Heading } from 'lucide-react';

export default function MarkdownEditor({ value = '', onChange, placeholder = 'Напишіть опис (підтримується Markdown)...', minHeight = '150px', defaultTab = 'write' }) {
  const [tab, setTab] = useState(defaultTab);
  const textareaRef = useRef(null);

  const insertText = useCallback((before, after = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);

    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);
    onChange(newText);

    // Set cursor position back after React re-renders
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  }, [value, onChange]);

  const toolbar = useMemo(() => [
    { icon: Heading, label: 'Заголовок', action: () => insertText('### ', '') },
    { icon: Bold, label: 'Жирний', action: () => insertText('**', '**') },
    { icon: Italic, label: 'Курсив', action: () => insertText('*', '*') },
    { divider: true },
    { icon: LinkIcon, label: 'Посилання', action: () => insertText('[', '](https://)') },
    { divider: true },
    { icon: List, label: 'Маркований список', action: () => insertText('- ', '') },
    { icon: ListOrdered, label: 'Нумерований список', action: () => insertText('1. ', '') },
    { icon: CheckSquare, label: 'Чекліст', action: () => insertText('- [ ] ', '') },
    { divider: true },
    { icon: Code, label: 'Код', action: () => insertText('`', '`') },
  ], [insertText]);

  return (
    <div className="w-full border border-[#e9e9e9] rounded-[12px] bg-white overflow-hidden flex flex-col">
      {/* Tabs & Toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-[#f0f0f0] bg-[#fafafa] px-2 py-1 gap-2">
        
        {/* Tabs */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTab('write')}
            className={`px-3 py-1.5 text-[12px] font-bold rounded-[6px] transition-colors ${tab === 'write' ? 'bg-white text-[#1f1f1f] shadow-sm' : 'text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f0f0f0]'}`}
          >
            Редагування
          </button>
          <button
            type="button"
            onClick={() => setTab('preview')}
            className={`px-3 py-1.5 text-[12px] font-bold rounded-[6px] transition-colors ${tab === 'preview' ? 'bg-white text-[#1f1f1f] shadow-sm' : 'text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f0f0f0]'}`}
          >
            Попередній перегляд
          </button>
        </div>

        {/* Formatting Toolbar */}
        {tab === 'write' && (
          <div className="flex items-center gap-1 overflow-x-auto pr-2">
            {/* eslint-disable-next-line react-hooks/refs -- false positive: insertText only reads textareaRef.current inside its own onClick-invoked body, never during render */}
            {toolbar.map((item, idx) => {
              if (item.divider) {
                return <div key={`div-${idx}`} className="w-[1px] h-[16px] bg-[#e9e9e9] mx-1"></div>;
              }
              const Icon = item.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  title={item.label}
                  onClick={item.action}
                  className="p-1.5 text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#e9e9e9] rounded-[6px] transition-colors"
                >
                  <Icon size={14} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="relative">
        {tab === 'write' ? (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full p-4 text-[14px] text-[#1f1f1f] leading-relaxed resize-y focus:outline-none placeholder-[#cfcfcf]"
            style={{ minHeight }}
          />
        ) : (
          <div className="w-full p-4 overflow-y-auto" style={{ minHeight }}>
            {value.trim() ? (
              <MarkdownViewer content={value} />
            ) : (
              <p className="text-[14px] text-[#9a9a9a] italic">Нічого для попереднього перегляду</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
