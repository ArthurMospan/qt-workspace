// Landing_claude/tools/capture.mjs
//
// Знімає справжні екрани QuickTeam для лендінга. Читає продукт як звичайний
// відвідувач через браузер — нічого не імпортує з src/ і нічого туди не пише.
//
// Профіль браузера лежить у tools/.profile (у .gitignore теки): вхід треба
// зробити руками один раз, далі сесія переживає перезапуски.
//
//   node Landing_claude/tools/capture.mjs --probe     — відкрити й показати, що видно
//   node Landing_claude/tools/capture.mjs --shots     — зняти повний набір
//   node Landing_claude/tools/capture.mjs --shots --only=board,analytics
//
// Прапорці: --url=<origin> --keep (не закривати вікно) --headless

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROFILE = path.join(HERE, '.profile');
const OUT = path.join(HERE, '..', 'assets', 'shots');

const argv = process.argv.slice(2);
const flag = name => argv.includes(`--${name}`);
const value = (name, fallback) => {
  const hit = argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const ORIGIN = value('url', 'https://qt-workspace.vercel.app').replace(/\/$/, '');
const ONLY = value('only', '').split(',').map(s => s.trim()).filter(Boolean);

// Кадри. `path` може бути функцією: тоді їй передають знайдений projectId.
const FRAMES = [
  { id: 'projects',  path: '/',          wait: 'main' },
  { id: 'board',     path: ctx => `/${ctx.projectId}`, wait: 'main' },
  { id: 'my',        path: '/my',        wait: 'main' },
  { id: 'sprints',   path: '/sprints',   wait: 'main' },
  { id: 'calendar',  path: '/calendar',  wait: 'main' },
  { id: 'chat',      path: '/chat',      wait: 'main' },
  { id: 'team',      path: '/team',      wait: 'main' },
  { id: 'analytics', path: '/analytics', wait: 'main' },
  { id: 'issue',     path: ctx => ctx.issueHref, wait: 'main', skipIf: ctx => !ctx.issueHref },
];

const log = (...a) => console.log('[capture]', ...a);

async function main() {
  await mkdir(PROFILE, { recursive: true });
  await mkdir(OUT, { recursive: true });

  const context = await chromium.launchPersistentContext(PROFILE, {
    headless: flag('headless'),
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    locale: 'uk-UA',
    timezoneId: 'Europe/Kyiv',
    reducedMotion: 'reduce',
    args: ['--hide-scrollbars'],
  });

  const page = context.pages()[0] || (await context.newPage());

  // Віджет репортера багів малює свою кнопку поверх інтерфейсу — на знімку
  // це чужий елемент, тож блокуємо саме його скрипт і нічого більше.
  await context.route('**/buggy-bag-standalone.js', route => route.abort());

  await page.goto(`${ORIGIN}/`, { waitUntil: 'domcontentloaded' });

  log('чекаю на вхід… залогіньтесь у вікні, що відкрилось');
  const ready = await waitForWorkspace(page);
  if (!ready) {
    log('не дочекався робочого простору — лишаю вікно відкритим');
    if (!flag('keep')) await context.close();
    return;
  }

  const ctx = await discover(page);
  log('організація:', ctx.org || '—');
  log('проєкти:', ctx.projects.map(p => `${p.name} (${p.id})`).join(', ') || '—');
  log('перше завдання:', ctx.issueHref || '—');

  await writeFile(path.join(HERE, 'context.json'), JSON.stringify(ctx, null, 2), 'utf8');

  if (flag('shots')) {
    for (const frame of FRAMES) {
      if (ONLY.length && !ONLY.includes(frame.id)) continue;
      if (frame.skipIf?.(ctx)) { log('пропускаю', frame.id); continue; }
      const href = typeof frame.path === 'function' ? frame.path(ctx) : frame.path;
      if (!href) { log('пропускаю', frame.id, '(немає адреси)'); continue; }
      await shoot(page, frame.id, href.startsWith('http') ? href : `${ORIGIN}${href}`, frame.wait);
    }
  }

  if (flag('keep')) {
    log('вікно лишається відкритим — закрийте його самі');
    await new Promise(() => {});
  }
  await context.close();
}

// Робочий простір готовий, коли на сторінці є сайдбар застосунку.
async function waitForWorkspace(page, timeout = 15 * 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const state = await page.evaluate(() => ({
      url: location.pathname,
      hasSidebar: !!document.querySelector('[data-app-sb]'),
    })).catch(() => null);
    if (state?.hasSidebar) return true;
    await page.waitForTimeout(1500);
  }
  return false;
}

async function discover(page) {
  return page.evaluate(() => {
    const sidebar = document.querySelector('[data-app-sb]');
    const links = [...(sidebar?.querySelectorAll('a[href]') || [])];
    const reserved = new Set(['/', '/my', '/sprints', '/calendar', '/chat', '/team', '/analytics', '/settings']);
    const projects = links
      .map(a => ({ id: a.getAttribute('href')?.replace(/^\//, ''), name: a.textContent.trim() }))
      .filter(p => p.id && !reserved.has(`/${p.id}`) && !p.id.includes('/'));
    const issue = [...document.querySelectorAll('a[href*="/issue/"]')][0];
    return {
      org: sidebar?.querySelector('h1, h2, [class*="font-semibold"]')?.textContent?.trim() || '',
      projects,
      projectId: projects[0]?.id || '',
      issueHref: issue?.getAttribute('href') || '',
    };
  });
}

async function shoot(page, id, url, waitFor) {
  log('знімаю', id, '→', url);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(waitFor, { timeout: 20_000 }).catch(() => {});
  // Дані приходять стрімами Firestore — мережевого простою тут не буває,
  // тож просто даємо кадру осісти.
  await page.waitForTimeout(3500);
  const file = path.join(OUT, `${id}.png`);
  await page.screenshot({ path: file });
  log('  →', path.relative(process.cwd(), file));
}

main().catch(err => { console.error(err); process.exit(1); });
