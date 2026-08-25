'use client';

// Кеш брендингу сайдбару в localStorage. Документ організації їде з Firestore
// асинхронно, тому без кешу після перезавантаження сайдбар секунду світить
// стандартною темною темою і лише потім перемальовується в брендовану. Кеш
// віддає останній відомий брендинг одразу; щойно приходять живі дані — вони
// стають джерелом правди і оновлюють кеш.
import { useEffect, useState } from 'react';

const cacheKey = orgId => `qt_sidebar_brand_${orgId}`;

function normalizeBrand(org) {
  if (!org?.customBranding || !org?.logo) return null;
  return {
    customBranding: true,
    logo: org.logo,
    sidebarTheme: org.sidebarTheme || 'dark',
    sidebarColor: org.sidebarColor || null,
  };
}

export function useCachedOrgBranding(activeOrgId, activeOrg) {
  const [cached, setCached] = useState(null);

  // Читаємо кеш, щойно відомий orgId — ще до приходу документа організації.
  useEffect(() => {
    queueMicrotask(() => {
      if (!activeOrgId) {
        setCached(null);
        return;
      }
      try {
        setCached(JSON.parse(localStorage.getItem(cacheKey(activeOrgId)) || 'null'));
      } catch {
        setCached(null);
      }
    });
  }, [activeOrgId]);

  // Живі дані оновлюють кеш (у т.ч. коли брендинг вимкнули — пишемо null).
  useEffect(() => {
    if (!activeOrgId || !activeOrg) return;
    try {
      localStorage.setItem(cacheKey(activeOrgId), JSON.stringify(normalizeBrand(activeOrg)));
    } catch {}
  }, [activeOrgId, activeOrg]);

  if (activeOrg) return normalizeBrand(activeOrg);
  return cached;
}

// Друга половина анти-мигання (перша — інлайн boot-скрипт у src/app/layout.js,
// що фарбує [data-app-sb] кешованою темою ДО першого кадру). Тут: щойно
// приїхали живі дані організації — записуємо застосовану тему в кеш для
// наступного перезавантаження і прибираємо boot-стиль, віддаючи владу React.
export function useSidebarThemeBoot(theme, ready, activeOrgId) {
  useEffect(() => {
    if (!ready || !theme?.bg || !activeOrgId) return;
    try {
      localStorage.setItem(`qt_sidebar_theme:${activeOrgId}`, JSON.stringify(theme));
      localStorage.removeItem('qt_sidebar_theme');
    } catch {}
    document.getElementById('sb-boot-theme')?.remove();
  }, [activeOrgId, theme, ready]);
}
