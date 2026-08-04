import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('a route transition shows a shape rather than nothing', async () => {
  const loading = await read('../src/app/(app)/loading.js');
  const skeleton = await read('../src/components/ui/Feedback/PageSkeleton.jsx');
  // A skeleton that occupies the regions the real screen will, so arriving
  // content does not appear to jump.
  assert.match(loading, /<PageSkeleton context="cards" \/>/);
  assert.match(skeleton, /aria-busy="true"/);
  // And an announcement for anyone who cannot see the shape.
  assert.match(skeleton, /sr-only">Завантаження…/);
});

// One shape for the whole workspace was three columns of task cards: right for
// a board, and a lie on every screen that has no columns. Each of those screens
// now names its own.
test('every workspace screen names the shape it arrives in', async () => {
  const expected = {
    '': 'cards',
    'my/': 'board',
    '[projectId]/': 'board',
    'sprints/': 'list',
    'analytics/': 'analytics',
    'calendar/': 'calendar',
    'team/': 'rail',
    'chat/': 'rail',
    'settings/': 'settings',
  };
  const skeleton = await read('../src/components/ui/Feedback/PageSkeleton.jsx');
  for (const [segment, context] of Object.entries(expected)) {
    const source = await read(`../src/app/(app)/${segment}loading.js`);
    assert.match(
      source,
      new RegExp(`context="${context.replace('[', '\[')}"`),
      `${segment || '/'} must load as "${context}"`,
    );
  }

  // Settings hides the workspace header, so it is the one shape that reserves
  // no room for it — the same split SidebarLayout's contexts already make.
  assert.match(skeleton, /headerOffset: false/);

  // A screen that already drew its own header asks for the body alone, so the
  // placeholder never draws a second heading over the real one.
  const board = await read('../src/app/(app)/[projectId]/page.js');
  const myTasks = await read('../src/app/(app)/my/page.js');
  for (const source of [board, myTasks]) {
    assert.match(source, /<PageSkeleton context=[^>]*region="body"/);
  }
  // And the board shape is built from the real column, not from the idea of
  // one: fixed 280px panels on canvas, not a responsive grid of loose cards.
  assert.match(skeleton, /w-\[280px\] shrink-0 flex-col overflow-hidden rounded-\[16px\] bg-canvas/);
});

test('losing the connection is visible, persistently', async () => {
  const hook = await read('../src/lib/hooks/useOnlineStatus.js');
  assert.match(hook, /addEventListener\('offline', update\)/);
  assert.match(hook, /addEventListener\('online', update\)/);
  // Starts optimistic so the server render and the first client render agree.
  assert.match(hook, /useState\(true\)/);

  const banner = await read('../src/components/ui/Feedback/ConnectionBanner.jsx');
  assert.match(banner, /role="status"/);
  assert.match(banner, /aria-live="polite"/);
  // Always mounted, so the change is announced rather than merely rendered.
  assert.doesNotMatch(banner, /if \(!offline\) return null/);

  const layout = await read('../src/app/(app)/layout.js');
  assert.match(layout, /<ConnectionBanner offline=\{!online\} \/>/);
});

test('the keyboard reaches the content without walking the sidebar', async () => {
  const layout = await read('../src/app/(app)/layout.js');
  assert.match(layout, /href="#qt-main"/);
  assert.match(layout, /Перейти до вмісту/);
  // The target has to be focusable for the jump to move focus, not just scroll.
  assert.match(layout, /<main id="qt-main" tabIndex=\{-1\}/);
});

test('focus is visible by default rather than per component', async () => {
  const css = await read('../src/app/globals.css');
  assert.match(css, /:focus-visible \{\s*\n\s*outline: 2px solid var\(--color-ink\);/);
  // The dark sidebar and bottom bar need their own colour or the ring vanishes.
  assert.match(css, /\[data-app-sb\] :where\(a, button, \[tabindex\]\):focus-visible \{\s*\n\s*outline-color/);
  // The skip link is only visible while focused.
  assert.match(css, /\.qt-skip-link \{[\s\S]*?transform: translateY\(-200%\);/);
  assert.match(css, /\.qt-skip-link:focus-visible \{\s*\n\s*transform: translateY\(0\);/);
});

test('a materialisation larger than one Firestore batch still commits', async () => {
  const source = await read('../src/lib/server/notificationOutbox.js');
  assert.match(source, /const BATCH_LIMIT = 400;/);
  assert.match(source, /await commitInChunks\(db, writes\)/);
  // The 500-write ceiling is a hard Firestore limit, and the first pass after a
  // quiet period is exactly when there are most of them.
  assert.match(source, /index \+= BATCH_LIMIT/);
});
