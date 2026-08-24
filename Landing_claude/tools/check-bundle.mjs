// Перевірка зібраного файлу: він мусить працювати сам, без сусідніх файлів.
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const file = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const problems = [];
page.on('console', m => { if (m.type() === 'error') problems.push(m.text()); });
page.on('pageerror', e => problems.push(String(e)));
page.on('requestfailed', r => problems.push('failed: ' + r.url()));
await page.goto(pathToFileURL(path.resolve(file)).href, { waitUntil: 'networkidle' });
const h = await page.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < h; y += 600) { await page.evaluate(v => scrollTo(0, v), y); await page.waitForTimeout(60); }
await page.waitForTimeout(1400);
console.log(JSON.stringify(await page.evaluate(() => ({
  height: document.body.scrollHeight,
  overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  shots: document.querySelectorAll('.shot').length,
  displayFont: getComputedStyle(document.querySelector('.d-hero')).fontFamily,
  bg: getComputedStyle(document.body).backgroundColor,
  markLoaded: document.querySelector('.brand__mark').naturalWidth,
})), null, 2));
console.log('problems:', problems);
await browser.close();
