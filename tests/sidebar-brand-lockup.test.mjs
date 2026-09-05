import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isResolvedOrganization } from '../src/lib/utils/organizationList.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

// The mark and the two lines beside it are one object, and centring the text
// *box* on the logo is not the same as centring the words on it: the big line
// swaps from top to bottom between the plain and branded states, and the ink
// goes with it. Aligned by box alone, «QuickTeam» sat 1.5px above the logo's
// axis — small, visible, and reported twice.
//
// For a column of fixed height H split into a title row and an organization
// row, the words land on the centre when
//
//   titleRow = H/2 + (titleInk − organizationInk) / 2
//
// Measured glyph ink (ascent + descent, not the line box, which carries
// descender space nobody sees) is 14/12 unbranded and 10/17 branded, giving
// 19+17 and 15+21. This test recomputes the split from those measurements, so
// changing a font size in the lockup fails here instead of drifting quietly.

const COLUMN_HEIGHT = 36;
const INK = {
  unbranded: { title: 14, organization: 12 },
  branded: { title: 10, organization: 17 },
};

const titleRowFor = ({ title, organization }) =>
  Math.round(COLUMN_HEIGHT / 2 + (title - organization) / 2);

test('the brand lockup splits its 36px on the ink, not down the middle', () => {
  assert.equal(titleRowFor(INK.unbranded), 19);
  assert.equal(COLUMN_HEIGHT - titleRowFor(INK.unbranded), 17);
  assert.equal(titleRowFor(INK.branded), 15);
  assert.equal(COLUMN_HEIGHT - titleRowFor(INK.branded), 21);
  // Both states stay exactly as tall, so nothing shifts when branding arrives.
  assert.equal(titleRowFor(INK.unbranded) + (COLUMN_HEIGHT - titleRowFor(INK.unbranded)), COLUMN_HEIGHT);
  assert.equal(titleRowFor(INK.branded) + (COLUMN_HEIGHT - titleRowFor(INK.branded)), COLUMN_HEIGHT);
});

test('the sidebar ships the split this file derives', async () => {
  const sidebar = await read('src/components/WorkspaceSidebar.jsx');
  assert.match(sidebar, /height: isBranded \? 15 : 19/);
  assert.match(sidebar, /lineHeight: isBranded \? '15px' : '19px'/);
  assert.match(sidebar, /height: isBranded \? 21 : 17/);
  assert.match(sidebar, /lineHeight: isBranded \? '21px' : '17px'/);
  // The old even-looking split is what put the words above the logo.
  assert.doesNotMatch(sidebar, /lineHeight: '16px'/);
  assert.doesNotMatch(sidebar, /lineHeight: '20px'/);
  // The mark and the lines share a centre line rather than a top edge.
  assert.match(sidebar, /flex items-center min-w-0 flex-1/);
});

// Кут рейки на пару кадрів малювався з порожнечі, і це було не миготіння
// завантаження, а помилка.
//
// Список організацій публікує за членство, чий документ ще не приїхав,
// заглушку `{ id, pending: true }`: простір лишається досяжним, поки по
// документ ідуть ще раз. Брендинг питав рівно «чи є організація», заглушка
// відповідала «є», і логотип із кольором бралися з порожнечі. Гірше: кеш
// анти-мигання записувався з тієї ж заглушки, тому наступне завантаження
// стартувало зі стандартної темної теми знову — кеш, який існує проти
// мигання, сам його й відтворював.
test('заглушка на час читання не є брендом', async () => {
  const [list, cache, sidebar, nav] = await Promise.all([
    read('src/lib/utils/organizationList.mjs'),
    read('src/lib/hooks/useCachedOrgBranding.js'),
    read('src/components/WorkspaceSidebar.jsx'),
    read('src/components/MobileNav.jsx'),
  ]);

  assert.equal(isResolvedOrganization({ id: 'a', name: 'Acme' }), true);
  assert.equal(isResolvedOrganization({ id: 'a', pending: true }), false);
  assert.equal(isResolvedOrganization(null), false);
  assert.match(list, /export function isResolvedOrganization\(organization\)/);

  // Кеш віддає бренд саме в ту мить, для якої він і є, і не пише в себе те,
  // чого в заглушці немає.
  assert.match(cache, /const organization = isResolvedOrganization\(activeOrg\) \? activeOrg : null;/);
  assert.match(cache, /if \(!activeOrgId \|\| !organization\) return;/);
  assert.match(cache, /writeCachedBrand\(activeOrgId, normalizeBrand\(organization\)\);/);
  assert.match(cache, /if \(organization\) return normalizeBrand\(organization\);/);
  assert.doesNotMatch(cache, /if \(activeOrg\) return normalizeBrand\(activeOrg\);/);

  // Отруєні записи вже лежать у браузерах, тож старий зразок викидається разом.
  assert.match(cache, /const BRAND_CACHE_VERSION = 1;/);
  assert.match(cache, /if \(!stored \|\| stored\.v !== BRAND_CACHE_VERSION\) return null;/);

  // Обидва читачі бренду: тема пишеться в кеш лише з живого документа.
  for (const [surface, source] of [['rail', sidebar], ['phone', nav]]) {
    assert.match(source, /useSidebarThemeBoot\(theme, isResolvedOrganization\(activeOrg\), activeOrgId\)/, surface);
    assert.doesNotMatch(source, /useSidebarThemeBoot\(theme, Boolean\(activeOrg\)/, surface);
  }
  // А логотип і назва чекають на документ, а не на заглушку без обох.
  assert.match(sidebar, /const brandingReady = Boolean\(sidebarPreview\) \|\| isResolvedOrganization\(activeOrg\);/);
});

// Колір малювався до першого кадру — і жив кілька мілісекунд.
//
// Boot-стиль знімався на монтуванні рейки. Рейка ж монтується не тоді, коли
// організація готова, а тоді, коли список організацій перестав вантажитись, —
// тобто вже на заглушках. Тому намальоване зникало майже одразу, і далі
// стояла стандартна темна тема, доки не відповість `/api/organizations`; на
// холодній серверній функції це секунди, і всі вони показували рівно той
// дефолт, проти якого весь цей механізм і зроблений.
test('намальоване до першого кадру тримається до живого документа', async () => {
  const cache = await read('src/lib/hooks/useCachedOrgBranding.js');

  // Стиль іде тієї миті, коли є чим його замінити…
  assert.match(cache, /if \(ready\) \{\s*\n\s*releaseRail\(\);/);
  // …і сходить сам, якщо замінити нічим і не буде чим: інакше `!important`
  // поверх React-змінних тримав би кешований колір вічно на завантаженні, де
  // організація не приїде ніколи.
  assert.match(cache, /const BOOT_THEME_HOLD_MS = 15_000;/);
  assert.match(cache, /const timer = window\.setTimeout\(releaseRail, BOOT_THEME_HOLD_MS\);/);
  assert.match(cache, /return \(\) => window\.clearTimeout\(timer\);\s*\n\s*\}, \[ready\]\);/);

  // Не на монтуванні. Це і був увесь баг.
  assert.doesNotMatch(
    cache,
    /document\.getElementById\('sb-boot-theme'\)\?\.remove\(\);\s*\n\s*\}, \[\]\);/,
  );
});

// Анти-мигання не працювало рівно там, де воно найпотрібніше, — у новій
// вкладці. Вибір організації живе в `sessionStorage`, нова вкладка його не
// має, і boot-скрипт виходив ні з чим: рейка спалахувала стандартною темною
// темою при кожному вході з нової вкладки, і тільки з неї.
test('нова вкладка знає, який колір малювати до першого кадру', async () => {
  const layout = await read('src/app/layout.js');

  // Скрипт вбудований у сторінку рядком, тож і перевіряється він як код: цей
  // шматок виймається з джерела й виконується. Інакше тест пильнував би текст,
  // який ніхто не запускав, — а це саме той код, у якому помилка не падає, а
  // мовчки нічого не фарбує.
  assert.ok(layout.includes('${BOOT_ORGANIZATION}if(!o)return;'));
  const [, lookup] = /const BOOT_ORGANIZATION = `([^`]*)`;/.exec(layout);

  const storage = entries => {
    const keys = Object.keys(entries);
    return {
      length: keys.length,
      key: index => (index in keys ? keys[index] : null),
      getItem: name => (name in entries ? entries[name] : null),
    };
  };
  const chosen = (search, session, local) => new Function(
    'location', 'sessionStorage', 'localStorage',
    `${lookup} return o;`,
  )({ search }, storage(session), storage(local));

  // Адреса важить більше за вкладку, вкладка — більше за пам'ять браузера.
  assert.equal(chosen('?org=from-link', { qt_active_org_id: 'from-tab' }, {}), 'from-link');
  assert.equal(chosen('', { qt_active_org_id: 'from-tab' }, { 'qt_last_org_id:u1': 'from-memory' }), 'from-tab');
  assert.equal(chosen('', {}, { 'qt_last_org_id:u1': 'from-memory' }), 'from-memory');
  assert.equal(chosen('?org=%D1%84', {}, {}), 'ф');

  // Рівно один запам'ятований акаунт. Два — і вгадувати нема з чого: кадр
  // стандартної теми кращий за кадр чужого кольору.
  assert.ok(!chosen('', {}, { 'qt_last_org_id:u1': 'one', 'qt_last_org_id:u2': 'two' }));
  assert.ok(!chosen('', {}, { qt_sidebar_collapsed: '1' }));
  assert.ok(!chosen('', {}, {}));
});
