// tests/visual/ui-kit.spec.mjs — one screenshot per /ui-kit section.
//
// The three generated reports answer "does the product use the kit, with the
// values the kit declares". None of them can see that a control moved four
// pixels or lost its border. This suite is that missing sense: it photographs
// every section and fails on the difference, with expected/actual/diff PNGs in
// the CI artifact.
//
// Only the resting state is captured. Hover, focus and disabled belong to the
// state matrix, which is a separate job — mixing them in here would mean every
// baseline encodes an arbitrary pointer position.
import { test, expect } from '@playwright/test';
import { SECTIONS } from './sections.mjs';

// A fixed instant, so relative timestamps in the chat and task demos render the
// same string forever. The demos read the clock while their module evaluates,
// which is why this is an init script rather than a call after navigation.
const FROZEN_TIME = Date.UTC(2026, 6, 12, 9, 0, 0);

// Chromium cannot capture past 16384px in either dimension. The variant matrix
// renders every declared value of every component and needs ~15300 of them, so
// the ceiling sits just under the hard limit — and a section that outgrows it
// fails loudly instead of quietly photographing half of itself.
const MAX_SHOT_HEIGHT = 16_000;

// `next dev` keeps a hot-reload socket open that the test browser has no use
// for and that fails its handshake on every load. It is the dev server talking
// about itself, not the catalogue rendering badly.
const DEV_SERVER_NOISE = /webpack-hmr|WebSocket connection to 'ws:/;

let consoleErrors = [];
let widgetRequests = 0;

test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  widgetRequests = 0;
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (!DEV_SERVER_NOISE.test(text)) consoleErrors.push(text);
  });
  page.on('pageerror', error => consoleErrors.push(`pageerror: ${error.message}`));

  // Freeze wall-clock reads without faking timers: requestAnimationFrame and
  // setTimeout stay real, so React, transitions and the waits below still run.
  await page.addInitScript(fixed => {
    const RealDate = Date;
    class FrozenDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) super(fixed);
        else super(...args);
      }
      static now() { return fixed; }
    }
    window.Date = FrozenDate;
  }, FROZEN_TIME);

  // The bug-reporter widget in the root layout is third-party furniture that
  // floats above the page. Served empty rather than aborted, so the block does
  // not itself become the console error this suite asserts against.
  await page.route(
    url => url.hostname === 'buggy-bag.vercel.app',
    route => {
      widgetRequests += 1;
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    },
  );

  await page.goto('/ui-kit', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-kit-scroll]');
  // The dev build paints its own indicator in the corner of every page.
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await settle(page);
});

test.afterEach(() => {
  expect(consoleErrors, 'the catalogue must render without console errors').toEqual([]);
});

// Fonts arrive from Google Fonts, so a screenshot taken before they land would
// bake the fallback metrics into the baseline.
async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images)
        .filter(image => !image.complete)
        .map(image => image.decode().catch(() => {})),
    );
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

// The catalogue scrolls inside a flex child, not the window, so `fullPage` sees
// only the visible slice. Growing the viewport to the content height is what
// puts the whole section in one frame — and it does it without overriding the
// page's own overflow, which would change the very layout under test.
async function showSection(page, id) {
  const scroller = page.locator('[data-kit-scroll]');
  // The server already renders the first section, so a click that lands before
  // hydration changes nothing and leaves no trace. Retrying the click until the
  // section actually switches is the honest way to wait for a live page — there
  // is no earlier signal that the handler is attached.
  await expect(async () => {
    await page.locator(`[data-kit-nav="${id}"]`).click();
    await expect(scroller).toHaveAttribute('data-kit-section', id, { timeout: 1_000 });
  }).toPass({ timeout: 45_000 });

  // A clicked nav button keeps focus, and the pointer would otherwise rest
  // wherever the click landed — both are visible states.
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.mouse.move(0, 0);
  await scroller.evaluate(element => { element.scrollTop = 0; });
  await settle(page);

  // Growing the viewport can reflow the content taller (wrapped rows unwrap,
  // sticky elements settle), so measure again until it stops overflowing.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const overflow = await scroller.evaluate(el => Math.ceil(el.scrollHeight - el.clientHeight));
    if (overflow <= 0) break;
    const viewport = page.viewportSize();
    const height = Math.min(viewport.height + overflow, MAX_SHOT_HEIGHT);
    if (height === viewport.height) break;
    await page.setViewportSize({ width: viewport.width, height });
    await settle(page);
  }

  const remaining = await scroller.evaluate(el => Math.ceil(el.scrollHeight - el.clientHeight));
  expect(remaining, `section "${id}" does not fit in ${MAX_SHOT_HEIGHT}px`).toBeLessThanOrEqual(0);
  return scroller;
}

// A section added to GROUPS without a baseline would otherwise be covered by
// nothing at all, which is the failure mode this whole suite exists to prevent.
test('the navigation lists exactly the sections this suite covers', async ({ page }) => {
  const ids = await page
    .locator('[data-kit-nav]')
    .evaluateAll(elements => elements.map(element => element.dataset.kitNav));
  expect(ids).toEqual(SECTIONS.map(section => section.id));
});

// Both of these are silent when they break: a live clock would only show up as
// a chat timestamp that drifts by a minute between two baseline runs, and a
// missed interception as a third-party widget that appears in some screenshots
// and not others.
test('the page is photographed against a frozen clock and without the widget', async ({ page }) => {
  expect(await page.evaluate(() => Date.now()), 'the page clock is frozen').toBe(FROZEN_TIME);
  expect(await page.evaluate(() => new Date().getTime())).toBe(FROZEN_TIME);
  expect(widgetRequests, 'the bug-reporter script is intercepted').toBeGreaterThan(0);
});

for (const section of SECTIONS) {
  test(`${section.id} — ${section.label}`, async ({ page }) => {
    const scroller = await showSection(page, section.id);
    await expect(scroller).toHaveScreenshot(`${section.id}.png`);
  });
}
