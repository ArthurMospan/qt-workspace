// Landing_claude/tools/styles.mjs
//
// Генерує assets/product.css — стилі продукту для мокапів на лендінгу.
//
// Джерело те саме, що в застосунку: src/app/globals.css. Ми не копіюємо з
// нього значення й не переписуємо класи руками — Tailwind проходить по
// готовому index.html і видає рівно ті утиліти, які використовує справжня
// розмітка. Через це мокап не «схожий на продукт»: це його стилі.
//
// Єдина правка на льоту — прибраний рядок `@import "tailwindcss"`, бо цей
// імпорт ми робимо самі, з `source(none)`: інакше Tailwind піде сканувати весь
// репозиторій і принесе класи, яких на сторінці немає.
//
//   node Landing_claude/tools/styles.mjs

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LANDING = path.join(HERE, '..');
const REPO = path.join(LANDING, '..');

const globals = await readFile(path.join(REPO, 'src', 'app', 'globals.css'), 'utf8');
const withoutImport = globals.replace(/^\s*@import\s+["']tailwindcss["'];\s*$/m, '');

const entry = [
  '@import "tailwindcss" source(none);',
  `@source "${path.join(LANDING, 'index.html').replace(/\\/g, '/')}";`,
  withoutImport,
].join('\n');

const result = await postcss([tailwind()]).process(entry, {
  from: path.join(REPO, 'src', 'app', 'globals.css'),
  to: path.join(LANDING, 'assets', 'product.css'),
});

await mkdir(path.join(LANDING, 'assets'), { recursive: true });
await writeFile(path.join(LANDING, 'assets', 'product.css'), result.css, 'utf8');

console.log(`assets/product.css — ${(result.css.length / 1024).toFixed(0)} KB`);
