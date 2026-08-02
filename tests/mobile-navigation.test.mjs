import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('the bar reserves its own footprint through one shared variable', async () => {
  const css = await read('../src/app/globals.css');
  const layout = await read('../src/app/(app)/layout.js');
  const nav = await read('../src/components/MobileNav.jsx');

  // Geometry is declared once.
  assert.match(css, /--qt-nav-height: \d+px;/);
  assert.match(css, /--qt-nav-inset: max\(var\(--qt-nav-gap\), env\(safe-area-inset-bottom\)\);/);
  assert.match(css, /--qt-nav-space: calc\(var\(--qt-nav-height\) \+ var\(--qt-nav-inset\) \+ var\(--qt-nav-gap\)\);/);

  // Both the bar and the column that has to clear it read the same variables,
  // so they cannot drift apart the way a hardcoded 56px did.
  assert.match(layout, /pb-\[var\(--qt-nav-space\)\]/);
  assert.doesNotMatch(layout, /pb-\[calc\(56px/);
  assert.match(nav, /bottom: 'var\(--qt-nav-inset\)'/);
  assert.match(nav, /height: 'var\(--qt-nav-height\)'/);
});

test('the bar floats with real corners instead of sitting on the viewport edge', async () => {
  const nav = await read('../src/components/MobileNav.jsx');
  assert.match(nav, /rounded-\[22px\]/);
  assert.match(nav, /left: 'var\(--qt-nav-gap\)'/);
  assert.match(nav, /right: 'var\(--qt-nav-gap\)'/);
  // A bar welded to bottom-0 is the thing being replaced.
  assert.doesNotMatch(nav, /fixed bottom-0 left-0 right-0/);
  // The sheet matches the bar rather than going full-bleed under it.
  assert.match(nav, /rounded-\[24px\] max-h-\[78dvh\]/);
});

test('the page does not opt into viewport-fit=cover', async () => {
  // Deliberate. With the default fit the browser keeps the home indicator and
  // the gesture bar outside the layout viewport, so a fixed bar cannot end up
  // under them — the reason a bottom menu built this way never fights the
  // mobile browser chrome. Opting into cover moves that responsibility into
  // every env() call site.
  const layout = await read('../src/app/layout.js');
  // The property, not the word — the comment above it explains the choice.
  assert.doesNotMatch(layout, /^\s*viewportFit:/m);
  assert.match(layout, /export const viewport = \{/);
  assert.match(layout, /themeColor: '#f4f4f5'/);
  // Pinch-zoom must survive: the app has 10-11px type.
  assert.match(layout, /maximumScale: 5/);
  assert.doesNotMatch(layout, /userScalable: false/);
});

test('the keyboard is the one piece of chrome the bar has to handle itself', async () => {
  const hook = await read('../src/lib/hooks/useKeyboardOpen.js');
  const nav = await read('../src/components/MobileNav.jsx');
  const css = await read('../src/app/globals.css');

  assert.match(hook, /window\.visualViewport/);
  // Measured as a fraction of the viewport, so it holds on a phone and a tablet
  // and is not tripped by a collapsing URL bar.
  assert.match(hook, /KEYBOARD_FRACTION = 0\.3/);
  assert.match(hook, /document\.body\.dataset\.keyboard/);

  assert.match(nav, /const keyboardOpen = useKeyboardOpen\(\)/);
  assert.match(nav, /keyboardOpen \? 'pointer-events-none translate-y-\[140%\] opacity-0'/);
  assert.match(nav, /aria-hidden=\{keyboardOpen\}/);
  // And the space it reserved collapses with it, so the composer gains the room.
  assert.match(css, /body\[data-keyboard='open'\] \{\s*\n\s*--qt-nav-space: 0px;/);
});

test('the active tab is announced, not only tinted', async () => {
  const nav = await read('../src/components/MobileNav.jsx');
  assert.match(nav, /aria-current=\{active \? 'page' : undefined\}/);
  assert.match(nav, /aria-expanded=\{moreOpen\}/);
  assert.match(nav, /aria-label="Основна навігація"/);
});

test('the chat badge has exactly one Firestore subscription behind it', async () => {
  const nav = await read('../src/components/MobileNav.jsx');
  const bridge = await read('../src/components/WorkspaceNotificationBridge.jsx');
  const title = await read('../src/components/WorkspaceDocumentTitle.jsx');

  // The bridge subscribes; everyone else reads the published number.
  assert.match(bridge, /useUnreadChatCount\(\)/);
  assert.match(bridge, /setUnreadChatCount\(displayedUnreadChats\)/);
  assert.doesNotMatch(nav, /useUnreadChatCount/);
  assert.doesNotMatch(title, /useUnreadChatCount/);
  assert.match(nav, /useWorkspaceStore\(s => s\.unreadChatCount\)/);
});

test('the app installs as an app rather than as a bookmark', async () => {
  const manifest = await read('../src/app/manifest.js');
  assert.match(manifest, /display: 'standalone'/);
  assert.match(manifest, /start_url: '\/'/);
  assert.match(manifest, /theme_color: '#f4f4f5'/);
  // A 32px favicon is not a home-screen icon.
  assert.match(manifest, /sizes: '436x436'/);
});
