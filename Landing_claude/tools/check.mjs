// Landing_claude/tools/check.mjs
//
// Числова перевірка сторінки замість знімків: що не поїхало за край, що сцена
// на дошці приземляється точно, що всередині кадрів немає нічого, вирваного
// з потоку, і що консоль чиста.
//
//   node Landing_claude/tools/check.mjs 1440

import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const file = process.argv[3] || 'Landing_claude/index.html';
const width = Number(process.argv[2] || 1440);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 } });

const problems = [];
page.on('console', m => { if (m.type() === 'error') problems.push(m.text()); });
page.on('pageerror', e => problems.push(String(e)));
page.on('requestfailed', r => problems.push(`не завантажилось: ${r.url()}`));

await page.goto(pathToFileURL(path.resolve(file)).href, { waitUntil: 'networkidle' });

const height = await page.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < height; y += 600) {
  await page.evaluate(v => scrollTo(0, v), y);
  await page.waitForTimeout(70);
}
await page.waitForTimeout(1600);

const report = await page.evaluate(() => {
  const doc = document.documentElement;
  const box = el => el.getBoundingClientRect();

  const card = document.querySelector('.fly-slot > *');
  const drop = document.querySelector('.drop-slot');
  const shots = [...document.querySelectorAll('.shot')];

  // Компонент, який у продукті висить над сторінкою (тост, спливне меню),
  // усередині кадру мусить бути прибитий до свого превʼю — інакше він
  // вилітає поверх лендінга.
  const escaped = shots.flatMap(shot => [...shot.querySelectorAll('*')]
    .filter(el => getComputedStyle(el).position === 'fixed')
    .filter(el => {
      const a = box(el);
      const b = box(shot);
      return a.left < b.left - 1 || a.right > b.right + 1 || a.top < b.top - 1;
    })
    .map(el => el.className.slice(0, 60)));

  return {
    width: innerWidth,
    pageHeight: doc.scrollHeight,
    overflowX: doc.scrollWidth - doc.clientWidth,
    shots: shots.length,
    landing: card && drop ? Math.round(box(card).left - box(drop).left) : null,
    hiddenReveals: [...document.querySelectorAll('[data-reveal]')]
      .filter(el => getComputedStyle(el).opacity !== '1').length,
    escaped,
  };
});

console.log(JSON.stringify({ report, problems }, null, 2));
await browser.close();
