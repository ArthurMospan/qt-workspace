// Landing_claude/tools/check.mjs — числова перевірка сторінки без знімків.
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const url = pathToFileURL(path.resolve('Landing_claude/index.html')).href;
const width = Number(process.argv[2] || 1440);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 } });
const problems = [];
page.on('console', m => { if (m.type() === 'error') problems.push(m.text()); });
page.on('pageerror', e => problems.push(String(e)));
await page.goto(url, { waitUntil: 'networkidle' });
const h = await page.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < h; y += 600) { await page.evaluate(v => scrollTo(0, v), y); await page.waitForTimeout(70); }
await page.waitForTimeout(1400);
const report = await page.evaluate(() => {
  const r = el => el.getBoundingClientRect();
  const doc = document.documentElement;
  return {
    width: innerWidth,
    overflowX: doc.scrollWidth - doc.clientWidth,
    bars: [...document.querySelectorAll('.bars i')].map(b => Math.round(r(b).height)),
    meters: [...document.querySelectorAll('.meter i')].map(b => Math.round(r(b).width)),
    counters: [...document.querySelectorAll('[data-count]')].map(b => b.textContent),
    hidden: [...document.querySelectorAll('[data-reveal]')].filter(e => getComputedStyle(e).opacity !== '1').length,
    flyLeft: Math.round(r(document.querySelector('.fly-slot .card')).left),
    dropLeft: Math.round(r(document.querySelector('.drop-slot')).left),
    tinyText: [...document.querySelectorAll('main *')].filter(e => {
      const s = getComputedStyle(e); const size = parseFloat(s.fontSize);
      return e.children.length === 0 && e.textContent.trim() && size < 9;
    }).length,
  };
});
console.log(JSON.stringify({ report, problems }, null, 2));
await browser.close();
