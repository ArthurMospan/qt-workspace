import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('the bar states its footprint once, and nothing reserves a strip for it', async () => {
  const css = await read('../src/app/globals.css');
  const layout = await read('../src/app/(app)/layout.js');
  const nav = await read('../src/components/MobileNav.jsx');

  // Geometry is declared once.
  assert.match(css, /--qt-nav-height: \d+px;/);
  assert.match(css, /--qt-nav-inset: max\(var\(--qt-nav-gap\), env\(safe-area-inset-bottom\)\);/);
  assert.match(css, /--qt-nav-space: calc\(var\(--qt-nav-height\) \+ var\(--qt-nav-inset\) \+ var\(--qt-nav-gap\)\);/);
  assert.match(nav, /bottom: 'var\(--qt-nav-inset\)'/);
  assert.match(nav, /height: 'var\(--qt-nav-height\)'/);

  // The shell reserves nothing. Below md it is white, so a reserved strip was a
  // dead band under the bar that no screen could paint into or scroll through.
  assert.doesNotMatch(layout, /pb-\[var\(--qt-nav-space\)\]/);
  assert.doesNotMatch(layout, /pb-\[calc\(56px/);
  assert.match(layout, /w-full p-0 md:p-\[12px\]/);
});

test('a screen ends its own scroller with the footprint the shell stopped reserving', async () => {
  const css = await read('../src/app/globals.css');

  // A tail, not a padding: these scrollers already carry paddings of their own
  // and one of them is handed a padding-bottom from JavaScript.
  assert.match(css, /\.qt-nav-scroll \{\s*\n\s*scroll-padding-bottom: var\(--qt-nav-space\);/);
  assert.match(css, /\.qt-nav-scroll::after \{[\s\S]*?height: var\(--qt-nav-space\);/);
  // An overlay covers the bar, so a shared view read inside a dialog adds none.
  assert.match(css, /\[role='dialog'\] \.qt-nav-scroll::after,\s*\n\s*\[data-ui-overlay\] \.qt-nav-scroll::after \{\s*\n\s*height: 0;/);
  // A screen that ends in a composer clears the bar with the dock instead.
  assert.match(css, /\.qt-nav-dock \{\s*\n\s*margin-bottom: var\(--qt-nav-space\);/);

  // Every screen that scrolls under the bar opts in, through the one class.
  const screens = [
    'src/app/(app)/page.js',
    'src/app/(app)/my/page.js',
    'src/app/(app)/analytics/page.js',
    'src/app/(app)/analytics/team/[memberId]/page.js',
    'src/app/(app)/sprints/page.js',
    'src/app/(app)/settings/page.js',
    // `/errors` is not in this list any more and must not come back: it left
    // the workspace shell entirely, so there is no bar over it to clear.
    'src/app/(app)/calendar/page.js',
    'src/app/(app)/[projectId]/ProjectBoardClient.jsx',
    'src/components/workspace/AgileBoard.jsx',
    'src/components/ui/Navigation/MemberRail.jsx',
    'src/components/ui/Navigation/ChannelRail.jsx',
    'src/components/profile/ProfileView.jsx',
  ];
  for (const screen of screens) {
    assert.match(await read(`../${screen}`), /qt-nav-scroll/, `${screen} scrolls under the bar`);
  }
  assert.match(await read('../src/app/(app)/chat/page.js'), /className="qt-nav-dock"/);
});

test('the last of the page dissolves under the bar instead of stopping at it', async () => {
  const css = await read('../src/app/globals.css');
  const nav = await read('../src/components/MobileNav.jsx');

  assert.match(nav, /className=\{`qt-nav-veil transition-opacity/);
  // Full width: the bar is inset from both sides and the content beside it was
  // the sharpest edge of the lot.
  assert.match(css, /\.qt-nav-veil \{[\s\S]*?left: 0;[\s\S]*?right: 0;/);
  assert.match(css, /\.qt-nav-veil \{[\s\S]*?pointer-events: none;/);
  assert.match(css, /\.qt-nav-veil \{[\s\S]*?height: calc\(var\(--qt-nav-space\) \+ 16px\);/);
  // Behind the bar, never in front of it.
  assert.match(css, /\.qt-nav-veil \{[\s\S]*?z-index: 39;/);
  assert.match(nav, /className=\{`qt-nav-bar fixed z-40/);
});

test('the bar is glass, and falls back to paint where there is no blur', async () => {
  const css = await read('../src/app/globals.css');
  const nav = await read('../src/components/MobileNav.jsx');

  // As round as a capsule of that height can be.
  assert.match(css, /--qt-nav-radius: calc\(var\(--qt-nav-height\) \/ 2\);/);
  assert.match(css, /\.qt-nav-bar \{[\s\S]*?border-radius: var\(--qt-nav-radius\);/);
  assert.doesNotMatch(nav, /rounded-\[22px\]/);

  // Opaque first; the glass is added only where it can actually be seen.
  assert.match(css, /\.qt-nav-bar \{[\s\S]*?background-color: var\(--sb-bg\);/);
  assert.match(css, /@supports \(background-color: color-mix\(in srgb, red 50%, transparent\)\)[\s\S]*?backdrop-filter: blur\(20px\) saturate\(180%\)/);
  assert.match(css, /background-color: color-mix\(in srgb, var\(--sb-bg\) var\(--qt-nav-opacity, 88%\), transparent\)/);

  // The heavy drop shadow is gone; a light bar keeps a short dense one and a
  // firmer border, or it disappears into a white page.
  assert.doesNotMatch(nav, /shadow-\[0_8px_24px/);
  assert.match(css, /\.qt-nav-bar\[data-nav-tone='light'\] \{[\s\S]*?border-color: rgb\(31 31 31 \/ 14%\);/);
  assert.match(nav, /data-nav-tone=\{barTheme\.isDark \? 'dark' : 'light'\}/);

  // The opacity is the theme's answer, not a number typed into the CSS.
  assert.match(nav, /'--qt-nav-opacity': `\$\{barTheme\.opacity \* 100\}%`/);
  assert.match(nav, /computeTranslucentSidebarTheme\(theme\.bg, \{ opacity: NAV_OPACITY \}\)/);
});

test('the boot script can no longer paint over the glass', async () => {
  const root = await read('../src/app/layout.js');
  const sidebar = await read('../src/components/WorkspaceSidebar.jsx');
  const nav = await read('../src/components/MobileNav.jsx');

  // It writes variables. `background-color: <hex> !important` on [data-app-sb]
  // beat every translucent background the bar could ask for.
  assert.match(root, /var css='--sb-bg:'\+t\.bg\+' !important;'/);
  assert.doesNotMatch(root, /background-color:'\+t\.bg/);

  // Which means both surfaces have to paint themselves from the variable, or
  // the branded rail flashes dark for the few hundred ms before hydration.
  assert.match(sidebar, /backgroundColor: 'var\(--sb-bg\)'/);
  assert.match(sidebar, /'--sb-bg': theme\.bg/);
  assert.match(nav, /'--sb-bg': barTheme\.bg/);
});

test('every --qt-nav variable read in the stylesheet is one that exists', async () => {
  const css = await read('../src/app/globals.css');
  const nav = await read('../src/components/MobileNav.jsx');
  // Declared in the stylesheet, or published onto the element by the bar itself.
  const declared = new Set([
    ...[...css.matchAll(/(--qt-nav-[a-z-]+):/g)].map(match => match[1]),
    ...[...nav.matchAll(/'(--qt-nav-[a-z-]+)':/g)].map(match => match[1]),
  ]);
  const consumed = new Set([...css.matchAll(/var\((--qt-nav-[a-z-]+)/g)].map(match => match[1]));
  // `--qt-nav-bottom-height` was read by the mobile bulk-action bar and written
  // by nobody, so it had been silently falling back to a 64px guess — a fallback
  // is a default for a value somebody supplies, not a place for a typo to live.
  assert.deepEqual([...consumed].filter(name => !declared.has(name)), []);
  // Two things float above the bar — the toast layer and the bulk-action card —
  // and they clear it by the same 8px, so the three of them read as one stack at
  // the bottom of the screen rather than as slabs at unrelated heights. The bulk
  // bar used to sit 16px up, and the extra void was what made it a second object.
  assert.equal((css.match(/bottom: calc\(var\(--qt-nav-space\) \+ 8px\);/g) || []).length, 2);
});

test('the bar floats with real corners instead of sitting on the viewport edge', async () => {
  const nav = await read('../src/components/MobileNav.jsx');
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

test('the keyboard is watched by the shell, and the bar reacts to it', async () => {
  const hook = await read('../src/lib/hooks/useKeyboardOpen.js');
  const layout = await read('../src/app/(app)/layout.js');
  const nav = await read('../src/components/MobileNav.jsx');
  const css = await read('../src/app/globals.css');

  assert.match(hook, /window\.visualViewport/);
  // Measured as a fraction of the viewport, so it holds on a phone and a tablet
  // and is not tripped by a collapsing URL bar.
  assert.match(hook, /KEYBOARD_FRACTION = 0\.3/);
  assert.match(hook, /document\.body\.dataset\.keyboard/);
  // And how much of the viewport it covers. Read at md and above — a tablet in
  // portrait is past that line and its keyboard does trip the fraction. Below md
  // nothing subtracts it; the test under this one is why.
  assert.match(hook, /--qt-keyboard-inset/);
  assert.match(css, /height: calc\(100dvh - var\(--qt-keyboard-inset, 0px\)\)/);

  // The watching belongs to the shell, not to the bar. A task and an event
  // render no bar at all, and they are the two screens with the most typing on
  // them; while the hook lived in MobileNav those two went unmeasured.
  assert.match(layout, /const keyboardOpen = useKeyboardOpen\(\)/);
  assert.match(layout, /<MobileNav keyboardOpen=\{keyboardOpen\} composerFocused=\{composerFocused\} \/>/);
  assert.doesNotMatch(nav, /useKeyboardOpen/);
  assert.match(nav, /const navHidden = keyboardOpen \|\| composerFocused;/);
  assert.match(nav, /navHidden \? 'pointer-events-none translate-y-\[140%\] opacity-0'/);
  assert.match(nav, /aria-hidden=\{navHidden\}/);
  // And the space it reserved collapses with it, so the composer gains the room.
  assert.match(css, /body\[data-keyboard='open'\] \{\s*\n\s*--qt-nav-space: 0px;/);
});

test('below md nothing corrects for the keyboard twice', async () => {
  const css = await read('../src/app/globals.css');
  const layout = await read('../src/app/(app)/layout.js');
  const chat = await read('../src/app/(app)/chat/page.js');
  const info = await read('../src/components/ui/Chat/ChannelInfoPanel.jsx');
  const dialog = await read('../src/components/ui/Dialog.jsx');

  // The rule this whole mechanism rests on. iOS covers the layout viewport with
  // the keyboard rather than shortening it, and lets you pan the visual viewport
  // down into the covered part. A document shorter than that pannable box is a
  // strip of bare page waiting for the first drag, so below md the document goes
  // back to the full height the moment the keyboard is measured.
  assert.match(css, /@media \(width < 48rem\) \{[\s\S]*?body\[data-keyboard='open'\] \{\s*\n\s*height: 100dvh;/);

  // Nothing inside that box then subtracts the overlap a second time. WebKit
  // already scrolled the ancestor scrollers and panned the window to get the
  // focused field out from under the keys; an app that shortens the shell one
  // frame later moves the same field up by the same keyboard again, which is how
  // a composer you have just tapped ends above the top edge — and the padding it
  // vacates is the bare strip a drag exposes.
  assert.doesNotMatch(layout, /pb-\[var\(--qt-keyboard-inset/);

  // The two full-screen chat panes are `fixed inset-0` and stop there, which is
  // the same box a Dialog's backdrop covers. They used to raise their own bottom
  // edge by the overlap and had both symptoms for it.
  for (const [name, source] of [['chat thread pane', chat], ['channel info panel', info]]) {
    assert.match(source, /data-ui-overlay="responsive-pane" className="fixed inset-0 z-50 md:static/, name);
    assert.doesNotMatch(source, /max-md:bottom-\[var\(--qt-keyboard-inset/, name);
  }

  // The reference implementation, stated as an assertion so it cannot drift into
  // reading the variable and taking the page's bugs with it: a Dialog covers the
  // layout viewport, caps itself in `dvh` — which the keyboard does not change —
  // and knows nothing about the inset.
  assert.match(dialog, /fixed inset-0 z-50 flex/);
  assert.doesNotMatch(dialog, /qt-keyboard-inset/);
});

test('no phone-only rule reads the keyboard inset', async () => {
  // The rot guard for the test above. Three call sites carried the second
  // correction and all three are gone; a fourth would reintroduce the bug in one
  // more place without failing anything else, because each one looks locally
  // reasonable. Below md the inset is measurement only — MobileNav and
  // `--qt-nav-space` read the `data-keyboard` attribute instead.
  const { readdir } = await import('node:fs/promises');
  const roots = [new URL('../src/', import.meta.url)];
  const offenders = [];
  while (roots.length) {
    const dir = roots.pop();
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
      if (entry.isDirectory()) { roots.push(child); continue; }
      if (!/\.(js|jsx|css)$/.test(entry.name)) continue;
      const source = await readFile(child, 'utf8');
      // A `max-md:` utility, or a `(width < 48rem)` block, that spends the inset.
      if (/max-md:[a-z-]*-\[[^\]]*--qt-keyboard-inset/.test(source)) {
        offenders.push(`${entry.name}: max-md: utility`);
      }
      const phoneBlocks = source.match(/@media \(width < 48rem\) \{[\s\S]*?\n  \}/g) || [];
      // `scroll-padding` is the one exception, and it is an exception because
      // of what it is rather than because it was convenient: it generates no
      // box, paints nothing and moves nothing — it only tells the browser
      // where the visible end of a scrollport is. The bug this guard exists
      // for is correcting for the keyboard a SECOND time in geometry the
      // browser has already corrected; a scroll hint cannot do that. It is
      // needed because the shell no longer reserves the overlap, so a phone
      // scroller now runs to the bottom of the layout viewport with its last
      // rows under the keys, and `scrollIntoView` would park them there.
      const spendsInset = block => block
        .split(/\r?\n/)
        .filter(line => line.includes('var(--qt-keyboard-inset'))
        .some(line => !/scroll-padding/.test(line));
      if (phoneBlocks.some(spendsInset)) {
        offenders.push(`${entry.name}: (width < 48rem) block`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test('a caret in a composer takes the bar away, from the cause rather than the consequence', async () => {
  const hook = await read('../src/lib/hooks/useComposerFocus.js');
  const layout = await read('../src/app/(app)/layout.js');
  const nav = await read('../src/components/MobileNav.jsx');
  const css = await read('../src/app/globals.css');

  // One listener, keyed on the shelf every composer already sits on, so the
  // workspace chat, its threads, a task's timeline and the QuickTeam+ panel are
  // all covered by being composers rather than by being wired up.
  assert.match(hook, /'\.chat-composer-dock'/);
  assert.match(hook, /addEventListener\('focusin'/);
  assert.match(hook, /addEventListener\('focusout'/);
  // Removing a focused element fires no focusout, so a dock that unmounts under
  // the caret would strand the flag; the next touch anywhere corrects it.
  assert.match(hook, /addEventListener\('pointerdown'/);
  // And a client navigation, which need not fire any of the three.
  assert.match(hook, /queueMicrotask\(\(\) => setFocused\(false\)\); \}, \[pathname\]\)/);
  assert.match(hook, /document\.body\.dataset\.composer/);

  // Watched by the shell, like the keyboard, and for the same reason.
  assert.match(layout, /const composerFocused = useComposerFocus\(pathname\)/);
  assert.doesNotMatch(nav, /useComposerFocus/);
  // Off screen and aria-hidden is not out of the tab order.
  assert.match(nav, /inert=\{navHidden \|\| undefined\}/);

  // The space collapses with the bar, and only below md.
  assert.match(css, /@media \(width < 48rem\) \{\s*\n\s*body\[data-composer='focused'\] \{\s*\n\s*--qt-nav-space: 0px;/);
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
