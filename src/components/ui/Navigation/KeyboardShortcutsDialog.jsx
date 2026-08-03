'use client';

import Dialog from '../Dialog';

// ─── UI Kit: KeyboardShortcutsDialog ─────────────────────────────────────────
// The app had shortcuts and no way to find out about them, which makes a
// shortcut a secret rather than a feature. One list, opened with "?", which is
// itself the first entry.

export const SHORTCUT_GROUPS = [
  {
    label: 'Скрізь',
    items: [
      { keys: ['⌘', 'K'], label: 'Командна палітра', alt: ['Ctrl', 'K'] },
      { keys: ['?'], label: 'Цей список' },
      { keys: ['Esc'], label: 'Закрити вікно або панель' },
    ],
  },
  {
    label: 'У палітрі',
    items: [
      { keys: ['↑', '↓'], label: 'Вибір' },
      { keys: ['↵'], label: 'Відкрити' },
    ],
  },
  {
    label: 'У завданні',
    items: [
      { keys: ['Esc'], label: 'Повернутись до дошки' },
    ],
  },
];

function Key({ children }) {
  return (
    <kbd className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[6px] border border-line bg-canvas px-[6px] text-[11px] font-semibold text-ink">
      {children}
    </kbd>
  );
}

/**
 * The keyboard cheat sheet.
 *
 * @param {boolean} props.isOpen Whether it is on screen.
 * @param {() => void} props.onClose Closes it.
 */
export default function KeyboardShortcutsDialog({ isOpen, onClose }) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Гарячі клавіші"
      description="Працюють будь-де, крім полів вводу."
      size="sm"
      presentation="dialog"
    >
      <div className="flex flex-col gap-[18px]">
        {SHORTCUT_GROUPS.map(group => (
          <div key={group.label}>
            <p className="ui-type-eyebrow pb-[8px] uppercase tracking-wider text-faint">
              {group.label}
            </p>
            <div className="flex flex-col gap-[8px]">
              {group.items.map(item => (
                <div key={item.label} className="flex items-center justify-between gap-[16px]">
                  <span className="text-[13px] text-ink">{item.label}</span>
                  <span className="flex shrink-0 items-center gap-[4px]">
                    {item.keys.map(key => <Key key={key}>{key}</Key>)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  );
}
