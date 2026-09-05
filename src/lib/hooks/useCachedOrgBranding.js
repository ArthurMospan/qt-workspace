'use client';

// Кеш брендингу сайдбару в localStorage. Документ організації їде з Firestore
// асинхронно, тому без кешу після перезавантаження сайдбар секунду світить
// стандартною темною темою і лише потім перемальовується в брендовану. Кеш
// віддає останній відомий брендинг одразу; щойно приходять живі дані — вони
// стають джерелом правди і оновлюють кеш.
import { useEffect, useState } from 'react';
import { SIDEBAR_THEME_VERSION } from '@/lib/utils/sidebarTheme';
import { planAllows } from '@/lib/utils/plans.mjs';
import { isResolvedOrganization } from '@/lib/utils/organizationList.mjs';

const cacheKey = orgId => `qt_sidebar_brand_${orgId}`;

// Версія записів у кеші бренду.
//
// Кеш існує проти мигання, а якийсь час сам його й спричиняв: активною
// вважалась заглушка на час читання, з неї виходив порожній бренд, і саме він
// лягав у кеш поверх справжнього. Отруєні записи вже лежать у браузерах, і без
// версії перше завантаження після виправлення показало б рівно те, що
// виправляли. Підняти число — викинути всі записи старого зразка разом;
// замість них один раз буде скелетон, а далі кеш наповниться правильним.
const BRAND_CACHE_VERSION = 1;

function readCachedBrand(orgId) {
  try {
    const stored = JSON.parse(localStorage.getItem(cacheKey(orgId)) || 'null');
    if (!stored || stored.v !== BRAND_CACHE_VERSION) return null;
    return stored.brand ?? null;
  } catch {
    return null;
  }
}

// `brand` може бути й `null` — це теж відповідь («брендинг вимкнено або не за
// тарифом»), тож вона загорнута, а не збережена як є.
function writeCachedBrand(orgId, brand) {
  try {
    localStorage.setItem(cacheKey(orgId), JSON.stringify({ v: BRAND_CACHE_VERSION, brand }));
  } catch { /* storage may be disabled */ }
}

// Тариф питається тут, а не в сайдбарі, бо сайдбар — не єдиний читач цього
// кешу, і брендинг, намальований в одному місці й не намальований в іншому,
// гірший за обидві відповіді.
//
// Дірка була така: перемикач у налаштуваннях знав про тариф, а застосований
// логотип — ні. Місяць на Lite, увімкнений бренд, повернення на Free — і
// логотип лишався назавжди, бо його малювали з полів документа, яких ніхто не
// звіряв із тарифом. Самі поля (`customBranding`, `logo`, `sidebarColor`) не
// чіпаються: налаштування зберігається, вимикається лише фіча, і разом з
// оплатою бренд повертається недоторканим.
function normalizeBrand(org) {
  if (!org?.customBranding || !org?.logo) return null;
  if (!planAllows(org.plan, 'branding')) return null;
  return {
    customBranding: true,
    logo: org.logo,
    sidebarTheme: org.sidebarTheme || 'dark',
    sidebarColor: org.sidebarColor || null,
  };
}

export function useCachedOrgBranding(activeOrgId, activeOrg) {
  const [cached, setCached] = useState(null);
  // Заглушка, яку список публікує за членство без документа, не є організацією
  // тут. Вона не має ні логотипа, ні кольору, ні тарифу — а живі дані вона
  // заступала: кеш віддавали лише «поки організації немає», і заглушка цю
  // умову закривала. Тому бренд зникав саме в ту мить, для якої кеш і є, а
  // ефект нижче ще й записував поверх нього `null`.
  const organization = isResolvedOrganization(activeOrg) ? activeOrg : null;

  // Читаємо кеш, щойно відомий orgId — ще до приходу документа організації.
  useEffect(() => {
    queueMicrotask(() => {
      setCached(activeOrgId ? readCachedBrand(activeOrgId) : null);
    });
  }, [activeOrgId]);

  // Живі дані оновлюють кеш (у т.ч. коли брендинг вимкнули — пишемо null).
  useEffect(() => {
    if (!activeOrgId || !organization) return;
    writeCachedBrand(activeOrgId, normalizeBrand(organization));
  }, [activeOrgId, organization]);

  if (organization) return normalizeBrand(organization);
  return cached;
}

// Друга половина анти-мигання (перша — інлайн boot-скрипт у src/app/layout.js,
// що фарбує [data-app-sb] кешованою темою ДО першого кадру). Тут: щойно
// приїхали живі дані організації — записуємо застосовану тему в кеш для
// наступного перезавантаження і прибираємо boot-стиль, віддаючи владу React.
export function useSidebarThemeBoot(theme, ready, activeOrgId) {
  // Handing the rail back to React is not the same decision as trusting what it
  // is painting. The style has to go the moment this component renders — React
  // always has a theme, even before the organization document arrives, and an
  // `!important` copy of an older one sitting over it wins for as long as it is
  // there. Waiting for `ready` meant that on any load where the organization
  // never arrived — a refused read, a spent quota — the browser kept painting a
  // cached theme for ever, and a change to the colours simply never appeared.
  useEffect(() => {
    document.getElementById('sb-boot-theme')?.remove();
  }, []);

  // Writing the cache is the decision that needs the data to be real: caching a
  // default dark rail for a branded workspace would put the flash back.
  useEffect(() => {
    if (!ready || !theme?.bg || !activeOrgId) return;
    try {
      // Versioned, so that changing how a theme is derived invalidates every
      // copy of the old one — see SIDEBAR_THEME_VERSION.
      localStorage.setItem(
        `qt_sidebar_theme:${activeOrgId}`,
        JSON.stringify({ ...theme, v: SIDEBAR_THEME_VERSION }),
      );
      localStorage.removeItem('qt_sidebar_theme');
    } catch {}
  }, [activeOrgId, theme, ready]);
}
