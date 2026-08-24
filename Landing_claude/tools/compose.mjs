// Landing_claude/tools/compose.mjs
//
// Збирає index.html з шаблона й справжньої розмітки продукту.
//
// Мокапи на сторінці — не намальовані «схоже», а взяті з /ui-kit як є: ті самі
// класи, ті самі компоненти, ті самі іконки. Тут вони лише отримують
// демонстраційні дані й дрібні правки, які потрібні статичній сторінці:
// посилання нікуди не ведуть, дати не в минулому, у сайдбарі є проєкти.
//
// Порядок збірки:
//   node Landing_claude/tools/extract.mjs   # знімає розмітку з живого /ui-kit
//   node Landing_claude/tools/compose.mjs   # → index.html
//   node Landing_claude/tools/styles.mjs    # → assets/product.css під цей html

import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LANDING = path.join(HERE, '..');

const kit = JSON.parse(await readFile(path.join(HERE, 'kit-markup.json'), 'utf8'));
const pick = (section, title) => {
  const html = kit[section]?.[title];
  if (!html) throw new Error(`немає розмітки: ${section} / ${title}`);
  return html;
};

// Демонстраційні дані. Каталог показує компоненти, тому дати в ньому давно
// минули, а проєктів немає взагалі — організації ж не існує. Для сторінки
// це треба привести до вигляду живої команди.
const TEXT = {
  '13.07.2026': '29.08.2026',
  '14.07.2026': '02.09.2026',
  '11.07.2026': '28.08.2026',
  '13 лип.': '29 серп.',
  '14 лип.': '2 вер.',
  '11 лип.': '28 серп.',
  '12 травня': '25 серпня',
  '07.08.2026': '05.09.2026',
  'Назва проєкту': 'Мобільний застосунок',
};

const PROJECTS = ['Мобільний застосунок', 'Сайт клініки', 'Внутрішні інструменти'];

// Каталог показує компонент разом із поясненням і, буває, у кількох станах
// поруч. Сторінці потрібен один стан і жодних підказок для розробника, тому
// кадр може лишити тільки частину превʼю (`keep`) або викинути з нього
// службовий підпис (`drop`).
const SHOTS = {
  'board-crop':   { html: () => pick('task-crm', 'Agile Board — живий shared organism') },
  table:          { html: () => pick('task-crm', 'Task Table View — таблиця з редагуванням у клітинці') },
  time:           { html: () => pick('task-elements', 'Трекінг часу'),
                    drop: 'span[class~="text-[10px]"]' },
  calendar:       { html: () => pick('calendar', 'Місяць у долоні') },
  chat:           { html: () => pick('chat-elements', 'IssueMentionMenu — згадки задач через #') },
  kpi:            { html: () => pick('progress', 'KPI Cards') },
  attention:      { html: () => pick('charts', 'Що потребує уваги'),
                    keep: '[data-ui-surface="card"]' },
  notification:   { html: () => pick('headers', '8) Картка сповіщення') },
  'time-log':     { html: () => pick('task-elements', 'Трекінг часу') + pick('task-elements', 'Запис у журналі часу'),
                    drop: 'span[class~="text-[10px]"]' },
  workload:       { html: () => pick('charts', 'Таблиця показників') },
  budget:         { html: () => pick('charts', 'Частка від межі') },
  categories:     { html: () => pick('task-crm', 'Agile Board — колонки-категорії') },
  attributes:     { html: () => pick('task-attributes', 'Task Attributes Panel — Issue Detail') },
  distribution:   { html: () => pick('charts', 'Скільки чого') },
};

const browser = await chromium.launch();
const page = await browser.newPage();

// ── Головний кадр: оболонка застосунку з дошкою всередині ───────────────────
const shell = await build(page, {
  html: pick('sidebar-layout', 'Workspace Layout Shell (Сайдбар + Мейн Контент)'),
  extra: pick('task-crm', 'Agile Board — живий shared organism'),
  transform: (root, boardHtml, projects) => {
    // Каталог показує оболонку з порожньою робочою зоною й підписом-заглушкою.
    // На сторінці замість заглушки стоїть справжня дошка.
    const stub = [...root.querySelectorAll('span')].find(el => el.textContent.includes('Main Work Area'));
    const area = stub?.closest('.flex-1.p-\\[24px\\]') ?? stub?.parentElement?.parentElement;
    if (area) {
      area.className = 'flex-1 min-h-0 overflow-hidden bg-white flex flex-col p-[16px] pt-0';
      area.innerHTML = boardHtml;
      const board = area.firstElementChild;
      if (board) board.className = board.className.replace('h-[520px]', 'h-full').replace(' p-4', ' pt-4');
    }

    // Оболонка каталогу — заввишки з превʼю; героєві потрібно більше.
    const stage = root.firstElementChild;
    if (stage) stage.className = stage.className.replace('h-[550px]', 'h-[680px]');

    // Проєктів у каталозі немає — організації не існує. Рядок будується за
    // тією ж розміткою, що й у WorkspaceSidebar: та сама висота, ті самі
    // змінні теми, та сама іконка теки з навігації поруч.
    const list = [...root.querySelectorAll('div.flex.flex-col.gap-\\[4px\\]')].pop();
    const folder = root.querySelector('svg.lucide-folder');
    if (list && folder) {
      list.innerHTML = projects.map((name, index) => {
        const icon = folder.cloneNode(true);
        icon.setAttribute('width', '15');
        icon.setAttribute('height', '15');
        icon.setAttribute('class', 'lucide lucide-folder shrink-0');
        const active = index === 0;
        return `<a href="#" class="flex items-center mx-[8px] h-[32px] rounded-[8px] transition-all" style="background-color: ${active ? 'var(--sb-active)' : 'transparent'}; color: ${active ? 'var(--sb-text)' : 'var(--sb-muted-project)'};"><div class="w-full h-full flex items-center"><div class="flex items-center w-full h-full pl-[12px] gap-[16px] pr-[12px]">${icon.outerHTML}<span class="text-[12px] font-medium truncate">${name}</span></div></div></a>`;
      }).join('');
    }

    // Дані організації приїжджають з Firestore, тому в каталозі на їхньому
    // місці стоїть скелетон. Нижче — рівно та розмітка, якою продукт його
    // замінює: логотип 32px, назва продукту 16/19, назва організації 12/17
    // і той самий перемикач.
    const lockup = root.querySelector('[data-ui-skeleton-preset="logo"]')?.parentElement;
    if (lockup) {
      lockup.innerHTML = '<a href="#" class="flex items-center justify-center shrink-0 hover:opacity-80 transition-opacity"><img src="assets/mark.svg" alt="QT" width="32" height="32" class="object-contain"></a>'
        + '<div class="flex flex-col min-w-0 ml-[12px]">'
        + '<a href="#" class="hover:opacity-80 transition-opacity"><h1 data-ui-type="branding-title" class="tracking-tight truncate transition-all" style="color: var(--sb-text); font-size: 16px; height: 19px; line-height: 19px; font-weight: 700;">QuickTeam</h1></a>'
        + '<div class="flex items-center gap-[4px] transition-colors w-fit" style="color: var(--sb-muted); height: 17px;">'
        + '<span class="truncate max-w-[120px] transition-all" style="font-size: 12px; line-height: 17px; font-weight: 500;">Веб-студія</span>'
        + '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevrons-up-down shrink-0"><path d="m7 15 5 5 5-5"></path><path d="m7 9 5-5 5 5"></path></svg>'
        + '</div></div>';
    }

    // Сцена переїзду: картка йде з «До виконання» в «У роботі» — обидві
    // колонки видно без горизонтальної прокрутки, тож рух не відбувається
    // за краєм кадру.
    const columns = [...root.querySelectorAll('[class*="w-[82vw]"]')];
    const columnBy = label => columns.find(col => col.textContent.trim().startsWith(label));
    const from = columnBy('До виконання');
    const to = columnBy('У роботі');
    const card = from?.querySelector('[data-rfd-draggable-id]');
    const target = to?.querySelector('.qt-nav-scroll');

    if (card && target) {
      // Колонка прокручується, тобто обрізає все, що виїжджає за її межі —
      // разом із карткою, яка саме туди й летить. У живому продукті це
      // правильно; у нерухомому кадрі прокручувати нічого, тож на час сцени
      // колонка-джерело перестає бути кліпом.
      card.closest('.qt-nav-scroll')?.classList.add('fly-lane');
      from.classList.add('fly-column');

      const slot = root.ownerDocument.createElement('div');
      slot.className = 'fly-slot';
      card.parentElement.insertBefore(slot, card);
      slot.appendChild(card);

      const drop = root.ownerDocument.createElement('div');
      drop.className = 'drop-slot';
      target.insertBefore(drop, target.firstChild);
    }
  },
});

// ── Решта кадрів ───────────────────────────────────────────────────────────
const shots = { shell };
for (const [name, shot] of Object.entries(SHOTS)) {
  shots[name] = await build(page, { html: shot.html(), keep: shot.keep, drop: shot.drop });
}

await browser.close();

// ── Підстановка в шаблон ───────────────────────────────────────────────────
let html = await readFile(path.join(LANDING, 'index.template.html'), 'utf8');

for (const [name, markup] of Object.entries(shots)) {
  const token = `<!--shot:${name}-->`;
  if (!html.includes(token)) { console.log('шаблон не просить кадр:', name); continue; }
  html = html.replace(token, `<div class="shot" data-shot="${name}" inert>${markup}</div>`);
}

const missed = html.match(/<!--shot:[a-z-]+-->/g);
if (missed) throw new Error(`немає кадрів для: ${missed.join(', ')}`);

// Tailwind сканує файл як текст, а не як DOM. Серіалізація перетворює `&`
// і `>` у класах на сутності, тож варіанти на кшталт `[&>*]:!absolute`
// перестають існувати для збирача — і компонент, який на них тримається,
// розсипається. У значенні атрибута обидва символи легальні як є.
const unescaped = html.replace(/class="([^"]*)"/g, (all, value) =>
  `class="${value.replace(/&amp;/g, '&').replace(/&gt;/g, '>')}"`);

await writeFile(path.join(LANDING, 'index.html'), unescaped, 'utf8');
console.log(`index.html — ${(html.length / 1024).toFixed(0)} KB, кадрів: ${Object.keys(shots).length}`);

// ───────────────────────────────────────────────────────────────────────────

async function build(page, { html, extra = '', transform, keep, drop }) {
  await page.setContent(`<div id="root">${html}</div>`, { waitUntil: 'domcontentloaded' });

  return page.evaluate(({ extra, text, projects, keep, drop, hasTransform, transformSource }) => {
    const root = document.getElementById('root');

    if (hasTransform) {
      // Перетворення передається сюди текстом: воно виконується в контексті
      // сторінки, де є справжній DOM, а не в Node, де його немає.
      // eslint-disable-next-line no-new-func
      new Function('root', 'boardHtml', 'projects', `return (${transformSource})(root, boardHtml, projects)`)(root, extra, projects);
    }

    if (keep) {
      const only = root.querySelector(keep);
      if (only) root.replaceChildren(only);
    }
    if (drop) for (const el of root.querySelectorAll(drop)) el.remove();

    // Статична сторінка: посилання нікуди не ведуть, керування не забирає фокус.
    for (const el of root.querySelectorAll('a[href]')) el.setAttribute('href', '#');
    for (const el of root.querySelectorAll('[tabindex]')) el.removeAttribute('tabindex');
    for (const el of root.querySelectorAll('[draggable]')) el.removeAttribute('draggable');
    for (const el of root.querySelectorAll('input, textarea')) el.setAttribute('readonly', '');

    // Дати каталогу давно минули — у кадрі команди це виглядало б так, ніби
    // все горить. Лишаємо рівно одну прострочену задачу: так буває.
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      let value = node.nodeValue;
      for (const [from, to] of Object.entries(text)) value = value.split(from).join(to);
      if (value !== node.nodeValue) node.nodeValue = value;
    }

    const overdue = [...root.querySelectorAll('*')]
      .filter(el => !el.children.length && /Прострочено/.test(el.textContent));
    overdue.slice(1).forEach(el => el.closest('span, div')?.remove());

    return root.innerHTML;
  }, { extra, text: TEXT, projects: PROJECTS, keep: keep || '', drop: drop || '', hasTransform: Boolean(transform), transformSource: transform ? transform.toString() : '' });
}
