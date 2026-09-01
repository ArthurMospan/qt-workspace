'use client';

// ─── UI Kit: Setting Row ─────────────────────────────────────────────────────
// Одне налаштування: назва зліва, пояснення під нею, контрол справа.
//
// Це рядок, яким набрані всі чотирнадцять секцій «Налаштувань», і він жив
// усередині `settings/page.js` як локальна функція. Доти цього вистачало —
// рядок був потрібен рівно на одному екрані. Перестало вистачати, коли екран
// інтеграції мав виглядати так само: сусідній файл не може імпортувати
// локальну функцію сторінки, тож у нього був вибір між власною копією рядка й
// власною формою екрана. Обидва варіанти — це друга думка про те, як виглядає
// налаштування, і саме через неї «Інтеграції» вже одного разу відійшли від
// решти налаштувань у сірі панелі з обводкою.
//
// Компонент навмисно не малює ні рамки, ні роздільника: рядки складаються в
// `Card preset="borderless"`, і саме картка вирішує, що їх оточує.
//
// Перенесено без зміни розмітки: висоти, кеглі й поведінка перемикача ті самі,
// що були, — інакше чотирнадцять секцій зсунулись би на піксель заради
// переїзду файлу.

import React, { Children, isValidElement } from 'react';

// Перемикач — єдиний контрол, поруч з яким рядок лишається рядком на телефоні.
//
// Решта (поле, селект, завантаження логотипа) на вузькому екрані переходить під
// назву й бере всю ширину; світч цього не потребує й виглядав би безглуздо
// розтягнутим. Пошук рекурсивний, бо виклики загортають світч у `div` разом із
// підписом чи короною тарифу, і тоді він перестає бути прямою дитиною.
const isSwitchNode = node => {
  if (!isValidElement(node)) return false;
  if (node.type?.isSwitch) return true;
  if (node.type !== 'div' && node.type !== 'span') return false;
  return Children.toArray(node.props?.children).some(isSwitchNode);
};

/**
 * Рядок одного налаштування.
 *
 * @param {React.ReactNode} props.label Назва налаштування.
 * @param {React.ReactNode} props.desc Пояснення під назвою; одне речення.
 * @param {React.ReactNode} props.children Контрол справа — світч, селект, поле, кнопка.
 * @param {boolean} props.danger Незворотна дія: назва й пояснення беруть `danger`.
 */
export default function SettingRow({ label, desc, children, danger = false }) {
  const items = Children.toArray(children);
  const switchOnly = items.length > 0 && items.every(isSwitchNode);
  return (
    <div className={`flex justify-between gap-3 py-[12px] sm:flex-row sm:items-center sm:gap-6 ${
      switchOnly ? 'flex-row items-center' : 'flex-col items-stretch'
    }`}>
      <div className="min-w-0 flex-1">
        <p className={`text-[13px] font-medium leading-snug ${danger ? 'text-danger' : 'text-ink'}`}>{label}</p>
        {desc && <p className={`text-[12px] mt-[2px] leading-relaxed ${danger ? 'text-danger' : 'text-muted'}`}>{desc}</p>}
      </div>
      <div className={switchOnly ? 'shrink-0' : 'w-full sm:w-auto sm:shrink-0'}>{children}</div>
    </div>
  );
}
