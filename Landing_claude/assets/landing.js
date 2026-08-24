/* ══════════════════════════════════════════════════════════════════════════
   QuickTeam — лендінг. Уся поведінка сторінки.

   Без залежностей і без збірки. Правило одне: нічого з написаного тут не має
   бути потрібним, щоб прочитати сторінку. Скрипт додає рух, а не вміст —
   з вимкненим JavaScript лишається та сама верстка, просто нерухома.
   ══════════════════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ── Рік у підвалі ────────────────────────────────────────────────── */
  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  /* ── Шапка й нахил героя ──────────────────────────────────────────── */
  const nav = $('#nav');
  const tilt = $('#heroTilt');

  const onScroll = () => {
    if (nav) nav.dataset.stuck = String(window.scrollY > 12);
    if (!tilt || calm) return;
    const progress = Math.min(1, Math.max(0, window.scrollY / 620));
    tilt.style.setProperty('--tilt', `${(8 * (1 - progress)).toFixed(2)}deg`);
    tilt.style.setProperty('--zoom', String(0.975 + 0.025 * progress));
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

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

  /* ── Поява при скролі ─────────────────────────────────────────────── */
  const reveal = new IntersectionObserver((entries, self) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.dataset.shown = 'true';
      self.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

  $$('[data-reveal]').forEach(el => reveal.observe(el));

  /* ── Сцена на дошці ───────────────────────────────────────────────────
     Картка переїжджає з «До виконання» в «У роботі». Розмітка дошки —
     справжня, тому жодного числа тут не зашито: і відстань між колонками,
     і висота картки виміряні по самому мокапу, а вони залежать від ширини
     вікна так само, як у продукті.                                       */
  const shot = $('[data-shot="shell"]');
  const slot = shot && $('.fly-slot', shot);
  const drop = shot && $('.drop-slot', shot);
  const card = slot && slot.firstElementChild;

  let pointer = null;

  const measure = () => {
    if (!shot || !slot || !drop || !card) return;

    const cardBox = card.getBoundingClientRect();
    const dropBox = drop.getBoundingClientRect();
    const shotBox = shot.getBoundingClientRect();

    slot.style.setProperty('--slot-h', `${Math.round(slot.getBoundingClientRect().height)}px`);
    drop.style.setProperty('--slot-h', `${Math.round(slot.getBoundingClientRect().height)}px`);

    const flyX = Math.round(dropBox.left - cardBox.left);
    slot.style.setProperty('--fly-x', `${flyX}px`);
    if (pointer) {
      pointer.style.setProperty('--fly-x', `${flyX}px`);
      pointer.style.setProperty('--px', `${Math.round(cardBox.left - shotBox.left + cardBox.width * 0.42)}px`);
      pointer.style.setProperty('--py', `${Math.round(cardBox.top - shotBox.top + 26)}px`);
    }
  };

  if (shot && slot && drop && card && !calm) {
    // Курсор малюється скриптом, а не лежить у розмітці: він належить сцені,
    // а не інтерфейсу, і в мокапі продукту його бути не повинно.
    pointer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    pointer.setAttribute('viewBox', '0 0 24 24');
    pointer.setAttribute('class', 'pointer');
    pointer.setAttribute('aria-hidden', 'true');
    pointer.innerHTML = '<path d="M4 2.5 19 11l-6.6 1.6L9.6 19z" fill="#1f1f1f" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>';
    shot.appendChild(pointer);

    measure();
    new ResizeObserver(measure).observe(shot);
    if (document.fonts?.ready) document.fonts.ready.then(measure);

    const stage = new IntersectionObserver((entries, self) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        measure();
        shot.dataset.play = 'true';
        self.disconnect();
      }
    }, { threshold: 0.3 });

    stage.observe(shot);
  }

  /* ── Питання ──────────────────────────────────────────────────────────
     Один відкритий за раз: короткі відповіді читають підряд, а не
     розкладають перед собою всі одночасно.                               */
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
