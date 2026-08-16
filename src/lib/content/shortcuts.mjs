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
  // «Вибрати діапазон» не казало ані з чого починається діапазон, ані що перший
  // Shift+клік узагалі вмикає вибір. Дві дії — два рядки, кожен своїми словами.
  Object.freeze({
    label: 'У списках і на дошці завдань',
    items: Object.freeze([
      Object.freeze({ keys: ['Shift', 'Клік'], label: 'Почати вибір із цього завдання' }),
      Object.freeze({ keys: ['Shift', 'Клік'], label: 'Далі — вибрати все між першим і цим' }),
      Object.freeze({ keys: ['Esc'], label: 'Зняти вибір' }),
    ]),
  }),
]);
