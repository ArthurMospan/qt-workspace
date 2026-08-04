import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { BADGE_MAX, badgeCount, badgeGeometry, badgeLabel } from '../src/lib/utils/faviconBadge.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('the badge says how many, until saying how many stops being readable', () => {
  assert.equal(badgeLabel(0), '');
  assert.equal(badgeLabel(-3), '');
  assert.equal(badgeLabel(1), '1');
  assert.equal(badgeLabel(BADGE_MAX), '9');
  assert.equal(badgeLabel(BADGE_MAX + 1), '9+');
  assert.equal(badgeLabel(240), '9+');
  // Whatever arrives from a store is a number or it is nothing.
  assert.equal(badgeLabel(undefined), '');
  assert.equal(badgeLabel('4'), '4');
});

test('chat and notifications are one number in the tab', () => {
  assert.equal(badgeCount({ unreadChats: 2, unreadNotifications: 3 }), 5);
  assert.equal(badgeCount({ unreadChats: 0, unreadNotifications: 0 }), 0);
  assert.equal(badgeCount({}), 0);
  // A negative count is a bug upstream, not a subtraction here.
  assert.equal(badgeCount({ unreadChats: -5, unreadNotifications: 2 }), 2);
});

test('the badge stays inside the icon at every canvas size', () => {
  for (const size of [16, 32, 64, 128]) {
    const { radius, centerX, centerY, ringWidth, fontSize } = badgeGeometry(size);
    assert.ok(centerX + radius + ringWidth <= size, `${size}px: badge overflows right`);
    assert.ok(centerY + radius + ringWidth <= size, `${size}px: badge overflows bottom`);
    assert.ok(centerX - radius - ringWidth > 0, `${size}px: badge covers the whole icon`);
    assert.ok(fontSize > 0 && fontSize < radius * 2, `${size}px: label cannot fit its disc`);
  }
});

test('the workspace owns the tab icon in one place, and hands it back', async () => {
  const component = await read('../src/components/FaviconBadge.jsx');
  // The original href is captured before anything overwrites it; after the
  // first repaint the link says "data:…" and no longer knows where it came from.
  assert.match(component, /originalHref\.current === null/);
  assert.match(component, /link\.setAttribute\('href', originalHref\.current\)/);
  // Nothing unread means the plain icon, not a badge reading zero.
  assert.match(component, /if \(count <= 0\) \{\s*\n\s*restore\(\);/);

  const layout = await read('../src/app/(app)/layout.js');
  assert.match(layout, /<FaviconBadge \/>/);
});

test('a pasted link unfurls as something', async () => {
  const card = await read('../src/app/opengraph-image.js');
  assert.match(card, /export const size = \{ width: 1200, height: 630 \}/);
  assert.match(card, /export const contentType = 'image\/png'/);
  // The tagline is Ukrainian and the bundled fallback font has no Cyrillic.
  assert.match(card, /fonts: fonts\.length \? fonts : undefined/);

  const twitter = await read('../src/app/twitter-image.js');
  assert.match(twitter, /from '\.\/opengraph-image'/);

  const layout = await read('../src/app/layout.js');
  assert.match(layout, /metadataBase: new URL\(SITE_URL\)/);
  assert.match(layout, /card: 'summary_large_image'/);
});
