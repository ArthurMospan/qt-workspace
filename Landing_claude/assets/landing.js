/* ══════════════════════════════════════════════════════════════════════════
   QuickTeam — лендінг. Уся поведінка сторінки.

   Без залежностей і без збірки: сторінка відкривається подвійним кліком по
   index.html. Правило одне — нічого з написаного тут не має бути потрібним,
   щоб прочитати сторінку. JS домальовує рух, а не вміст: із вимкненими
   скриптами лишається та сама верстка, просто нерухома.
   ══════════════════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ── Рік у підвалі ────────────────────────────────────────────────── */
  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  /* ── Шапка: фон зʼявляється, щойно сторінка зрушила ───────────────── */
  const nav = $('#nav');
  const onScroll = () => {
    if (nav) nav.dataset.stuck = String(window.scrollY > 12);
    tiltHero();
  };

  /* ── Мобільне меню ────────────────────────────────────────────────── */
  const burger = $('#burger');
  const sheet  = $('#sheet');
  if (burger && sheet) {
    const setSheet = open => {
      sheet.dataset.open = String(open);
      burger.setAttribute('aria-expanded', String(open));
    };
    burger.addEventListener('click', () => setSheet(sheet.dataset.open !== 'true'));
    sheet.addEventListener('click', e => { if (e.target.tagName === 'A') setSheet(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setSheet(false); });
    document.addEventListener('click', e => {
      if (!sheet.contains(e.target) && !burger.contains(e.target)) setSheet(false);
    });
  }

  /* ── Масштаб мокапів ──────────────────────────────────────────────────
     Мокап зверстаний під фіксовану ширину (--shot-w) і стискається цілком,
     а не переливається. Інакше кожен вузький екран показував би інтерфейс,
     якого в продукті немає: зламані колонки, перенесені підписи, інші
     пропорції. Висоту контейнера доводиться рахувати тут, бо transform
     не змінює місця, яке елемент займає в потоці.                        */
  const shots = $$('.shot');

  const fitShots = () => {
    for (const shot of shots) {
      const stage = shot.firstElementChild;
      if (!stage) continue;
      const style = getComputedStyle(shot);
      const design = parseFloat(style.getPropertyValue('--shot-w')) || stage.offsetWidth;
      // Нижче певного масштабу зменшувати вже нема сенсу: підписи на картках
      // стають нечитабельними, і замість інтерфейсу виходить сіра плитка.
      // Тому на вузьких екранах мокап не стискається далі, а обрізається —
      // рівно як справжня дошка в браузері телефона.
      const floor = parseFloat(style.getPropertyValue('--s-min')) || 0;
      const scale = Math.max(floor, Math.min(1, shot.clientWidth / design));
      shot.style.setProperty('--s', String(scale));
      shot.style.height = `${stage.offsetHeight * scale}px`;
    }
  };

  /* Розміри сцени на дошці міряються, а не задаються числом: крок колонок
     різний, коли сайдбар видно і коли ні, а висота картки залежить від того,
     у скільки рядків ліг її заголовок. offsetLeft/offsetHeight читаються до
     трансформації, тобто одразу в координатах макета. */
  const measureBoard = () => {
    const cols = $$('[data-shot="board"] .col');
    const flying = $('[data-shot="board"] .fly-slot .card');
    if (cols.length < 2 || !flying) return;

    const pitch = cols[1].offsetLeft - cols[0].offsetLeft;
    const height = flying.offsetHeight + 8; // картка плюс проміжок сітки

    for (const slot of $$('[data-shot="board"] .fly-slot, [data-shot="board"] .drop-slot')) {
      slot.style.setProperty('--slot-h', `${height}px`);
    }
    flying.style.setProperty('--fly-x', `${pitch}px`);
  };

  const relayout = () => { fitShots(); measureBoard(); };

  if (shots.length) {
    relayout();
    new ResizeObserver(relayout).observe(document.body);
    // Шрифти приїжджають після першого кадру й міняють висоту макета.
    if (document.fonts?.ready) document.fonts.ready.then(relayout);
  }

  /* ── Нахил героя ──────────────────────────────────────────────────────
     Мокап лежить під кутом, поки він на самому початку сторінки, і
     вирівнюється, поки читач до нього доходить. Не окрема анімація —
     просто інша позиція тієї самої речі.                                 */
  const tilt = $('#heroTilt');

  function tiltHero() {
    if (!tilt || calm) return;
    const progress = Math.min(1, Math.max(0, window.scrollY / 620));
    tilt.style.setProperty('--tilt', `${(8 * (1 - progress)).toFixed(2)}deg`);
    tilt.style.setProperty('--zoom', String(0.975 + 0.025 * progress));
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── Поява при скролі ─────────────────────────────────────────────── */
  const reveal = new IntersectionObserver((entries, self) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.dataset.shown = 'true';
      self.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

  $$('[data-reveal]').forEach(el => reveal.observe(el));

  /* ── Смуги, шкали, кільце й лічильники ────────────────────────────────
     Усе це стоїть на нулі й доростає до свого значення один раз, коли
     блок уперше зʼявився. Значення живуть у розмітці — тут лише момент.

     Ціль запамʼятовується один раз, на старті, у data-атрибут. Раніше її
     читали в момент показу з інлайнового стилю — і варто було двом
     спостерігачам (мокапу й панелі всередині нього) спрацювати в одному
     кадрі, як другий зчитував уже обнулене значення й фіксував шкалу на
     нулі назавжди. Саме тому всі шкали лишались порожніми.               */
  const growables = $$('[data-grow]');

  for (const el of growables) {
    const h = el.style.getPropertyValue('--h');
    const w = el.style.getPropertyValue('--w');
    if (h) el.dataset.h = h;
    if (w) el.dataset.w = w;
    if (calm) continue;
    if (h) el.style.setProperty('--h', '0%');
    if (w) el.style.setProperty('--w', '0%');
  }

  const grown = new IntersectionObserver((entries, self) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      growPanel(entry.target);
      self.unobserve(entry.target);
    }
  }, { threshold: 0.2 });

  $$('.mk').forEach(el => grown.observe(el));

  function growPanel(root) {
    $$('[data-grow]', root).forEach(el => {
      if (el.dataset.h) el.style.setProperty('--h', el.dataset.h);
      if (el.dataset.w) el.style.setProperty('--w', el.dataset.w);
    });

    $$('[data-count]', root).forEach(el => countUp(el));
    $$('[data-donut]', root).forEach(el => sweep(el));
  }

  function countUp(el) {
    const target = Number(el.dataset.count);
    if (!Number.isFinite(target)) return;
    if (calm) { el.textContent = String(target); return; }
    const started = performance.now();
    const step = now => {
      const t = Math.min(1, (now - started) / 900);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(target * eased));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // Конічний градієнт не анімується переходом, тож кут веде rAF.
  function sweep(el) {
    const a = 52, b = 69;
    if (calm) { el.style.setProperty('--a', `${a}%`); el.style.setProperty('--b', `${b}%`); return; }
    const started = performance.now();
    const step = now => {
      const t = Math.min(1, (now - started) / 900);
      const eased = 1 - Math.pow(1 - t, 3);
      el.style.setProperty('--a', `${(a * eased).toFixed(1)}%`);
      el.style.setProperty('--b', `${(b * eased).toFixed(1)}%`);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ── Сцена на дошці ───────────────────────────────────────────────────
     Одна картка переїжджає з «У роботі» на «На перевірці». Один раз, коли
     дошку вперше видно — це показ продукту, а не фонова анімація.        */
  const board = $('[data-shot="board"] .board');
  const sidebarNav = $('[data-shot="board"] .sb__nav');

  if (board && !calm) {
    board.dataset.play = 'false';
    if (sidebarNav) sidebarNav.dataset.play = 'false';

    const stage = new IntersectionObserver((entries, self) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (sidebarNav) sidebarNav.dataset.play = 'true';
        board.dataset.play = 'true';
        // Лічильники колонок доганяють картку. Без цього дошка після
        // переїзду показує «3» там, звідки завдання щойно поїхало.
        setTimeout(() => {
          $$('.col__head b[data-after]', board).forEach(el => { el.textContent = el.dataset.after; });
        }, 1500);
        self.disconnect();
      }
    }, { threshold: 0.35 });

    stage.observe(board);
  }

  /* ── Таймер у шапці дошки ─────────────────────────────────────────────
     Тікає лише поки видимий: секундомір, який рахує за спиною читача,
     нікому нічого не показує й лише гріє батарею.                        */
  const ticker = $('#ticker');
  if (ticker && !calm) {
    let seconds = 1 * 3600 + 12 * 60 + 40;
    let timer = null;

    const paint = () => {
      const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
      const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
      const s = String(seconds % 60).padStart(2, '0');
      ticker.textContent = `${h}:${m}:${s}`;
    };

    new IntersectionObserver(entries => {
      const visible = entries.some(e => e.isIntersecting);
      if (visible && !timer) timer = setInterval(() => { seconds += 1; paint(); }, 1000);
      if (!visible && timer) { clearInterval(timer); timer = null; }
    }, { threshold: 0.2 }).observe(ticker);
  }

  /* ── Питання ──────────────────────────────────────────────────────────
     Один відкритий за раз: список коротких відповідей читають підряд, а не
     розкладають перед собою всі одразу.                                  */
  $$('.faq__item').forEach(item => {
    const button = $('.faq__q', item);
    if (!button) return;
    button.addEventListener('click', () => {
      const open = item.dataset.open === 'true';
      $$('.faq__item').forEach(other => {
        other.dataset.open = 'false';
        $('.faq__q', other)?.setAttribute('aria-expanded', 'false');
      });
      if (!open) {
        item.dataset.open = 'true';
        button.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ── Тепла пляма під курсором у бенто ─────────────────────────────────
     Єдиний ефект на сторінці, що слухає мишу. На дотик його немає, і це
     правильно: там немає курсора, за яким світити.                       */
  if (matchMedia('(hover: hover) and (pointer: fine)').matches && !calm) {
    $$('.cell').forEach(cell => {
      cell.addEventListener('pointermove', e => {
        const box = cell.getBoundingClientRect();
        cell.style.setProperty('--mx', `${e.clientX - box.left}px`);
        cell.style.setProperty('--my', `${e.clientY - box.top}px`);
      });
    });
  }
})();
