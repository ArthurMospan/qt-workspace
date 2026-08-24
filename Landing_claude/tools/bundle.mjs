// Landing_claude/tools/bundle.mjs
//
// Складає лендінг в один самодостатній HTML-файл: стилі й скрипт стають
// інлайновими, знак — data URI. Потрібно для публікації там, де сторінка
// може бути тільки одним файлом і не має права ходити по сусідніх адресах.
//
//   node Landing_claude/tools/bundle.mjs            → dist/quickteam-landing.html
//   node Landing_claude/tools/bundle.mjs --artifact → без doctype/html/head/body
//
// Прапорець --artifact потрібен для хостингів, які самі загортають вміст
// у свій каркас: тоді на виході лишаються тільки <title>, <style>, вміст
// <body> і <script>.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const artifact = process.argv.includes('--artifact');

const read = name => readFile(path.join(ROOT, name), 'utf8');

const FONTS = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Roboto+Condensed:wght@400;600;700&display=swap';

const html = await read('index.html');

// Порядок важливий: спершу стилі продукту (вони в шарах @layer), потім стилі
// сторінки (поза шарами). Саме тому сторінка перебиває `body` застосунку,
// а не навпаки.
const css = [
  await read('assets/product.css'),
  await read('assets/landing.css'),
  await read('assets/sections.css'),
].join('\n');
const js = await read('assets/landing.js');
const mark = await read('assets/mark.svg');

const markUri = `data:image/svg+xml;utf8,${encodeURIComponent(mark).replace(/'/g, '%27')}`;

// @import мусить стояти першим правилом у таблиці стилів, інакше браузер
// його мовчки викидає і сторінка їде на системних шрифтах.
const style = `@import url("${FONTS}");\n${css}`;

// Заголовок сторінки й назва артефакту — різні речі. У <title> лежить рядок
// для пошуку, а в галереї потрібне ім'я, за яким сторінку впізнають серед
// десятків інших.
const named = process.argv.find(a => a.startsWith('--title='))?.slice(8);
const title = named ?? html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? 'QuickTeam';
const body = html.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? '';

const inlined = body
  .replace(/<script src="assets\/landing\.js" defer><\/script>/, '')
  .replaceAll('assets/mark.svg', markUri);

const page = artifact
  ? [
      `<title>${title}</title>`,
      `<style>\n${style}\n</style>`,
      inlined,
      `<script>\n${js}\n</script>`,
    ].join('\n')
  : [
      '<!doctype html>',
      '<html lang="uk">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      `<title>${title}</title>`,
      '<meta name="theme-color" content="#0c0c0d">',
      `<link rel="icon" href="${markUri}" type="image/svg+xml">`,
      `<style>\n${style}\n</style>`,
      '</head>',
      '<body>',
      inlined,
      `<script>\n${js}\n</script>`,
      '</body>',
      '</html>',
    ].join('\n');

const out = path.join(ROOT, 'dist');
await mkdir(out, { recursive: true });
const file = path.join(out, artifact ? 'artifact.html' : 'quickteam-landing.html');
await writeFile(file, page, 'utf8');

console.log(`${path.relative(process.cwd(), file)} — ${(page.length / 1024).toFixed(0)} KB`);
