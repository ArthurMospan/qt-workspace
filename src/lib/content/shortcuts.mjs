export const SHORTCUT_GROUPS = Object.freeze([
  Object.freeze({
    label: 'Всюди',
    items: Object.freeze([
      Object.freeze({ keys: ['⌘', 'K'], label: 'Командна палітра', alt: ['Ctrl', 'K'] }),
      Object.freeze({ keys: ['Esc'], label: 'Закрити вікно, панель або масовий вибір' }),
    ]),
  }),
  Object.freeze({
    label: 'У палітрі',
    items: Object.freeze([
      Object.freeze({ keys: ['↑', '↓'], label: 'Вибір' }),
      Object.freeze({ keys: ['↵'], label: 'Відкрити' }),
    ]),
  }),
  Object.freeze({
    label: 'У завданні',
    items: Object.freeze([
      Object.freeze({ keys: ['Esc'], label: 'Повернутись до дошки' }),
    ]),
  }),
  Object.freeze({
    label: 'У списках завдань',
    items: Object.freeze([
      Object.freeze({ keys: ['Shift', 'Click'], label: 'Вибрати діапазон' }),
    ]),
  }),
]);
