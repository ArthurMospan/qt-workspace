import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const page_url = pathToFileURL(path.resolve('Landing_claude/index.html')).href;
const out = process.argv[2] || '.';
const width = Number(process.argv[3] || 1440);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));

await page.goto(page_url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

// Прокрутити всю сторінку, щоб спрацювали reveal-и, потім знімати.
const height = await page.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < height; y += 700) {
  await page.evaluate(v => window.scrollTo(0, v), y);
  await page.waitForTimeout(90);
}
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(900);

const marks = JSON.parse(process.env.MARKS || '[]');
for (const [name, y] of marks) {
  await page.evaluate(v => window.scrollTo(0, v), y);
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(out, `${name}.png`) });
}

const metrics = await page.evaluate(() => {
  const doc = document.documentElement;
  const overflow = doc.scrollWidth > doc.clientWidth ? doc.scrollWidth - doc.clientWidth : 0;
  const shots = [...document.querySelectorAll('.shot')].map(s => ({
    w: s.clientWidth, h: Math.round(s.getBoundingClientRect().height),
    s: getComputedStyle(s).getPropertyValue('--s').trim(),
  }));
  return { pageHeight: doc.scrollHeight, overflow, shots };
});

console.log(JSON.stringify({ metrics, errors }, null, 2));
await browser.close();
