// Landing_claude/tools/extract.mjs
//
// Дістає справжню розмітку компонентів продукту з живого /ui-kit і складає її
// в JSON. Лендінг збирає мокапи саме з неї, тому вони не «схожі на продукт», а
// є ним: ті самі класи, та сама структура, ті самі іконки.
//
// Каталог рендериться локальним `next dev` — інших залежностей немає, у прод
// цей скрипт не ходить і нічого не змінює.
//
//   node Landing_claude/tools/extract.mjs                     # усі секції
//   node Landing_claude/tools/extract.mjs --port=3000 --only=charts,filters

import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const val = (name, fallback) => argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;

const PORT = val('port', '3000');
const ONLY = val('only', '').split(',').map(s => s.trim()).filter(Boolean);

// Секції, у яких лежить те, що показує лендінг. Мітка — рівно той підпис, що
// стоїть у навігації каталогу.
const SECTIONS = [
  ['sidebar-layout', 'Workspace Shell'],
  ['headers', 'Header (Хедер)'],
  ['page-headers', 'Page Header (Шапка)'],
  ['task-crm', 'Task Rows'],
  ['task-elements', 'Задачі — власні елементи'],
  ['task-attributes', 'Task Attributes Panel'],
  ['badges', 'Priority, Tags & Counters'],
  ['avatars', 'Avatars & Teams'],
  ['filters', 'Filter Bar'],
  ['progress', 'KPI Cards'],
  ['charts', 'Графіки й таблиці'],
  ['calendar', 'Календар — власні елементи'],
  ['chat-elements', 'Чат — власні елементи'],
  ['detail-layout', 'Деталі задачі й події'],
  ['surfaces', 'Surfaces'],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, locale: 'uk-UA' });
await page.goto(`http://localhost:${PORT}/ui-kit`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
await page.waitForSelector('h3', { timeout: 180_000 });

const out = {};

for (const [id, label] of SECTIONS) {
  if (ONLY.length && !ONLY.includes(id)) continue;

  const nav = page.getByRole('button', { name: label, exact: true }).first();
  if (!(await nav.count())) { console.log('немає в навігації:', label); continue; }
  await nav.click();
  await page.waitForTimeout(1200);

  // Превʼю монтуються, коли доходять до екрана, тож секцію треба спершу
  // прогорнути цілком — інакше на виході буде порожня оболонка PreviewBlock.
  const scroller = await page.evaluateHandle(() => {
    const fits = el => el.scrollHeight > el.clientHeight + 40;
    return [...document.querySelectorAll('main, div')].find(fits) || document.scrollingElement;
  });
  for (let step = 0; step < 40; step += 1) {
    const done = await scroller.evaluate(el => {
      const before = el.scrollTop;
      el.scrollTop = before + 600;
      return el.scrollTop === before;
    });
    await page.waitForTimeout(160);
    if (done) break;
  }
  await page.waitForTimeout(1200);

  out[id] = await page.evaluate(() => {
    const blocks = {};
    // Заголовок саме PreviewBlock, а не якийсь h3 усередині компонента.
    for (const h3 of document.querySelectorAll('h3[class*="text-[16px]"]')) {
      const shell = h3.parentElement?.parentElement?.parentElement;
      const body = shell?.children?.[1];
      if (!body) continue;
      blocks[h3.textContent.trim()] = body.innerHTML;
    }
    return blocks;
  });

  console.log(id, '→', Object.keys(out[id]).length, 'превʼю');
}

await writeFile(path.join(HERE, 'kit-markup.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('записано tools/kit-markup.json');
await browser.close();
