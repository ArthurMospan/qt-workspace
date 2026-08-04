'use client';
import React, { forwardRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { searchEscalationState } from '@/lib/utils/searchScope.mjs';
import { paletteShortcutLabel } from '@/lib/utils/platformKeys.mjs';
import { useApplePlatform } from '@/lib/hooks/useApplePlatform';

/**
 * The search field inside the workspace header. Reached through `TopHeader`,
 * which is the only thing that renders it — it is not a general search input.
 *
 * @param {string} props.value Current query.
 * @param {(value: string) => void} props.onChange Fires with the new query.
 * @param {() => void} props.onClear Clears the field; renders the × while there is text.
 * @param {string} props.placeholder Placeholder text.
 * @param {number|null} props.localResultCount Final count produced by the current page.
 * @param {number} props.outsideResultCount Count returned by the broader search when local is empty.
 * @param {boolean} props.outsideLoading Whether that broader count is loading.
 * @param {(query: string) => void} props.onEscalate Opens the command palette with this query.
 * @param {(event: React.KeyboardEvent<HTMLInputElement>) => void} props.onKeyDown Optional caller keyboard handler after built-in escalation keys.
 * @param {string} props.className Placement in the parent only.
 */
export const HeaderSearch = forwardRef(({
  value = '',
  onChange,
  onClear,
  onEscalate,
  localResultCount = null,
  outsideResultCount = 0,
  outsideLoading = false,
  placeholder = 'Пошук...',
  className = '',
  onKeyDown,
  ...props
}, ref) => {
  const [escalationActive, setEscalationActive] = useState(false);
  // The hint used to read ⌘K on every machine, naming a key most of the team
  // does not have. The palette already answers to both.
  const apple = useApplePlatform();
  const paletteKeys = paletteShortcutLabel(apple);
  const escalation = searchEscalationState({
    query: value,
    localResultCount,
    outsideResultCount,
    outsideLoading,
  });

  const openEverywhere = () => onEscalate?.(escalation.term);

  const handleKeyDown = event => {
    if (event.key === 'ArrowDown' && escalation.active) {
      event.preventDefault();
      setEscalationActive(true);
      return;
    }
    if (event.key === 'Enter' && escalationActive && escalation.active) {
      event.preventDefault();
      openEverywhere();
      return;
    }
    if (event.key === 'Escape') setEscalationActive(false);
    onKeyDown?.(event);
  };

  return (
    <div className={`relative flex h-[36px] w-full max-w-[320px] items-center border-b border-transparent transition-colors focus-within:border-line ${className}`}>
      <Search size={14} className="text-muted absolute left-0 pointer-events-none" />
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => {
          setEscalationActive(false);
          onChange?.(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-full w-full bg-transparent pl-[24px] pr-[76px] text-[13px] text-ink outline-none placeholder:text-[#a3a3a3]"
        {...props}
      />
      {value && (
        <button
          onClick={() => {
            onChange?.('');
            onClear?.();
          }}
          aria-label="Очистити пошук"
          className="absolute right-[42px] p-1 text-faint transition-colors hover:text-muted"
        >
          <X size={13} />
        </button>
      )}
      <button
        type="button"
        onClick={openEverywhere}
        aria-label="Відкрити пошук всюди"
        aria-haspopup="dialog"
        // A hint, not a control: the field beside it is the thing to use. Boxed
        // in a bordered canvas chip it was the loudest element in the header,
        // so it loses the box and sits back to the faint tier, and only comes
        // forward under the cursor.
        className="absolute right-0 rounded-[6px] px-[4px] py-[2px] text-[10px] font-semibold leading-none text-faint transition-colors hover:text-muted"
      >
        {paletteKeys}
      </button>

      {escalation.active && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-full overflow-hidden rounded-[10px] border border-line bg-white shadow-lg">
          {escalation.localEmpty && (
            <button
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={openEverywhere}
              className="w-full px-[12px] py-[9px] text-left text-[12px] text-muted transition-colors hover:bg-canvas"
            >
              {escalation.outsideLoading
                ? 'Шукаємо поза цією сторінкою…'
                : `Знайдено поза цією сторінкою: ${escalation.outsideCount}`}
            </button>
          )}
          <button
            type="button"
            onMouseDown={event => event.preventDefault()}
            onMouseEnter={() => setEscalationActive(true)}
            onClick={openEverywhere}
            className={`flex w-full items-center justify-between border-t border-line px-[12px] py-[9px] text-left text-[12px] font-medium transition-colors ${
              escalationActive ? 'bg-canvas text-ink' : 'bg-white text-muted hover:bg-canvas hover:text-ink'
            }`}
          >
            <span className="min-w-0 truncate">Шукати «{escalation.term}» всюди</span>
            <span className="ml-2 shrink-0 text-[10px] text-faint">{paletteKeys}</span>
          </button>
        </div>
      )}
    </div>
  );
});

HeaderSearch.displayName = 'HeaderSearch';
export default HeaderSearch;
