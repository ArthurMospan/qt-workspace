'use client';

// Each of these ships on the site, and the first version of this preview gave
// no way to tell — six bare buttons labelled with prop syntax read as invented
// options. `where` is the screen you have already seen it on; `open` is what
// you do there to get it. Counts come from `npm run kit:scan`.
// Shaped exactly as the chat page feeds MessageBubble: `user`/`time` are
// pre-formatted by the page, `createdAt` is a Firestore-style stamp whose
// toMillis() decides whether consecutive messages share one avatar header.
// `toDate` as well as `toMillis`: a Firestore Timestamp carries both, and the
// day separator reads the first while avatar grouping reads the second. A stub
// with only `toMillis` printed «Invalid Date» in the separator.
export const stamp = (minutesAgo) => {
  const ms = Date.now() - minutesAgo * 60_000;
  return { toMillis: () => ms, toDate: () => new Date(ms) };
};

export const CHAT_DEMO_MEMBERS = [
  { id: 'kit-arthur', name: 'Артур Моспан' },
  { id: 'kit-olena', name: 'Олена Коваль', statusEmoji: '🎧', status: 'У фокусі' },
];

export const CHAT_DEMO_MESSAGES = [
  {
    id: 'm1',
    senderId: 'kit-olena',
    user: 'Олена Коваль',
    time: '10:42',
    text: 'Закинула макети нового онбордингу — гляньте другий екран, там питання по копірайту.',
    createdAt: stamp(34),
    reactions: { '👍': ['kit-arthur'] },
  },
  {
    id: 'm2',
    senderId: 'kit-arthur',
    user: 'Артур Моспан',
    time: '10:51',
    text: 'Подивився. Другий екран ок, тільки заголовок довший за колонку — зріжеться на мобілці.',
    createdAt: stamp(25),
  },
  {
    id: 'm3',
    senderId: 'kit-arthur',
    user: 'Артур Моспан',
    time: '10:52',
    text: 'І ще: кнопку «Далі» варто зробити на всю ширину.',
    createdAt: stamp(24),
    isPinned: true,
  },
];

// Chat's own kit components. The native controls that chat still hand-rolls
// were listed here too, which duplicated /ui-audit → Чат byte for byte; what
// stays is what chat contributes *to the kit* — its avatar scale, its icon
// sizes and its day divider, all of them real components.
export const KIT_MENTION_MEMBERS = [
  { id: 'kit-arthur', name: 'Артур Моспан', email: 'arthur@quickteam.app' },
  { id: 'kit-olena', name: 'Олена Коваль', email: 'olena@quickteam.app' },
  { id: 'kit-petro', name: 'Петро Іванчук', email: 'petro@quickteam.app' },
];
