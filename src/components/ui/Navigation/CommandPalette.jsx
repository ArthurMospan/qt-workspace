'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell, Building2, Calendar, CheckCircle2, ChevronRight, CircleDot, Folder,
  Keyboard, MessageSquare, PieChart, Plus, Search, Settings, Square, Sun, Users, Zap,
} from 'lucide-react';
import Dialog from '../Dialog';
import {
  flattenGroups,
  groupCommands,
  issueCommands,
  rankCommands,
} from '@/lib/utils/commandPalette.mjs';

// ─── UI Kit: CommandPalette ──────────────────────────────────────────────────
// One keystroke to anywhere. The workspace already had a route table, a project
// list and a search API; what it did not have was a way to reach any of them
// without three clicks through a sidebar.
//
// The catalogue and its ranking live in lib/utils/commandPalette.mjs so they can
// be asserted without a browser; this file is the surface.

const ICONS = {
  folder: Folder,
  check: CheckCircle2,
  sun: Sun,
  message: MessageSquare,
  calendar: Calendar,
  zap: Zap,
  users: Users,
  chart: PieChart,
  settings: Settings,
  plus: Plus,
  stop: Square,
  bell: Bell,
  building: Building2,
  keyboard: Keyboard,
  issue: CircleDot,
};

/**
 * The workspace command palette.
 *
 * @param {boolean} props.isOpen Whether it is on screen.
 * @param {() => void} props.onClose Closes it.
 * @param {object[]} props.commands Catalogue from `buildCommands`.
 * @param {object[]} props.issues Search results to append as their own group.
 * @param {boolean} props.searching Whether results are still loading.
 * @param {(query: string) => void} props.onQueryChange Called as the query changes.
 * @param {(command: object) => void} props.onSelect Runs the chosen command.
 * @param {object[]} props.projects Projects, used to name the project a found task belongs to.
 */
export default function CommandPalette({
  isOpen,
  onClose,
  commands = [],
  issues = [],
  searching = false,
  onQueryChange,
  onSelect,
  projects = [],
}) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Команди"
      size="md"
      presentation="dialog"
      showCloseButton={false}
      bodyPadding="flush"
      titleContext="eyebrow"
    >
      {/* The body only exists while the palette is open, which is what makes
          "reopening starts clean" a property of mounting rather than an effect
          that resets state after the fact. */}
      {isOpen && (
        <PaletteBody
          onClose={onClose}
          commands={commands}
          issues={issues}
          searching={searching}
          projects={projects}
          onQueryChange={onQueryChange}
          onSelect={onSelect}
        />
      )}
    </Dialog>
  );
}

function PaletteBody({ onClose, commands, issues, searching, projects, onQueryChange, onSelect }) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const listRef = useRef(null);

  const groups = useMemo(() => groupCommands([
    ...rankCommands(commands, query),
    ...issueCommands(issues, projects),
  ]), [commands, issues, projects, query]);
  const flat = useMemo(() => flattenGroups(groups), [groups]);
  // The flat order is what the arrow keys walk, so each row asks the flat list
  // for its own position rather than a counter incremented while rendering.
  const indexById = useMemo(
    () => new Map(flat.map((command, index) => [command.id, index])),
    [flat],
  );

  useEffect(() => { onQueryChange?.(query); }, [onQueryChange, query]);

  // Keep the highlighted row in view when the keyboard moves past the fold.
  useEffect(() => {
    listRef.current
      ?.querySelector('[data-command-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [cursor, groups]);

  const run = command => {
    if (!command) return;
    onSelect?.(command);
    onClose?.();
  };

  const handleKeyDown = event => {
    if (event.key === 'ArrowDown' || (event.key === 'n' && event.ctrlKey)) {
      event.preventDefault();
      setCursor(index => (flat.length ? (index + 1) % flat.length : 0));
    } else if (event.key === 'ArrowUp' || (event.key === 'p' && event.ctrlKey)) {
      event.preventDefault();
      setCursor(index => (flat.length ? (index - 1 + flat.length) % flat.length : 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(flat[cursor]);
    }
  };

  return (
    <>
      <div className="flex items-center gap-[10px] border-b border-line px-[16px]">
        <Search size={16} className="shrink-0 text-muted" />
        <input
          // Mounted only while open, so this is the focus without an effect.
          autoFocus
          value={query}
          onChange={event => { setQuery(event.target.value); setCursor(0); }}
          onKeyDown={handleKeyDown}
          placeholder="Куди піти або що зробити…"
          aria-label="Пошук команд"
          aria-controls="command-palette-list"
          className="h-[48px] w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
        />
        {searching && (
          <span className="h-[14px] w-[14px] shrink-0 animate-spin rounded-full border-2 border-line border-t-ink" />
        )}
      </div>

      <div
        ref={listRef}
        id="command-palette-list"
        role="listbox"
        aria-label="Команди"
        className="max-h-[min(56dvh,420px)] overflow-y-auto overscroll-contain py-[6px]"
      >
        {!flat.length && (
          <p className="px-[16px] py-[28px] text-center text-[13px] text-muted">
            Нічого не знайдено за «{query}»
          </p>
        )}

        {groups.map(group => (
          <div key={group.group} className="pb-[4px]">
            <p className="ui-type-eyebrow px-[16px] pb-[4px] pt-[8px] uppercase tracking-wider text-faint">
              {group.label}
            </p>
            {group.items.map(command => {
              const index = indexById.get(command.id) ?? 0;
              const Icon = ICONS[command.icon] || ChevronRight;
              const active = index === cursor;
              return (
                <button
                  key={command.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-command-active={active}
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => run(command)}
                  className={`flex w-full items-center gap-[12px] px-[16px] py-[9px] text-left transition-colors ${
                    active ? 'bg-canvas' : 'bg-transparent'
                  }`}
                >
                  <Icon size={16} className={active ? 'text-ink' : 'text-muted'} />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">
                    {command.label}
                  </span>
                  {command.hint && (
                    <span className="shrink-0 truncate text-[12px] text-muted">{command.hint}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-[14px] border-t border-line px-[16px] py-[8px] text-[11px] text-faint">
        <span>↑↓ вибір</span>
        <span>↵ відкрити</span>
        <span>Esc закрити</span>
      </div>
    </>
  );
}
