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
import { ChevronRight } from 'lucide-react';

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
 * З `onClick` рядок сам стає кнопкою: тоді праворуч стоїть `value` і стрілка,
 * а натиснути можна по всій ширині. Без нього це просто рядок із контролом.
 *
 * @param {React.ReactNode} props.label Назва налаштування.
 * @param {React.ReactNode} props.desc Пояснення під назвою; одне речення.
 * @param {React.ReactNode} props.children Контрол справа — світч, селект, поле, кнопка.
 * @param {() => void} props.onClick Робить увесь рядок кнопкою, що відкриває наступний екран.
 * @param {React.ReactNode} props.value Поточне значення праворуч, коли рядок щось відкриває; на телефоні воно переходить під назву й бере всю ширину.
 * @param {boolean} props.danger Незворотна дія: назва й пояснення беруть `danger`.
 */
export default function SettingRow({ label, desc, children, onClick, value, danger = false }) {
  const items = Children.toArray(children);
  const switchOnly = items.length > 0 && items.every(isSwitchNode);

  const text = (
    <div className="min-w-0 flex-1">
      <p className={`text-[13px] font-medium leading-snug ${danger ? 'text-danger' : 'text-ink'}`}>{label}</p>
      {desc && <p className={`text-[12px] mt-[2px] leading-relaxed ${danger ? 'text-danger' : 'text-muted'}`}>{desc}</p>}
    </div>
  );

  // Рядок, який щось відкриває, показує це стрілкою — і клікається весь.
  //
  // Спершу тут стояла `TextAction` зі значенням замість напису: «5 із 9»
  // темним текстом праворуч. У спокої вона нічим не відрізнялася від значення,
  // яке просто надруковано поруч, тож єдиним способом дізнатися, що рядок
  // кудись веде, було провести по ньому мишею й побачити підкреслення. Ціль до
  // того ж була завширшки з ці чотири символи.
  //
  // Стрілка — той самий знак, яким відкриваються картки інтеграцій і рядки
  // `SignalList`, і кнопкою стає весь рядок, а не напис у ньому.
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group flex w-full items-center gap-3 py-[12px] text-left transition-colors sm:gap-6 max-sm:flex-wrap max-sm:gap-y-1"
      >
        {text}
        {/* Значення нестисливе, і на телефоні платила за це назва: «Остання
            задача з групи» ламалася посеред фрази, щоб звільнити місце під
            «QT-118 · 27 серп». Нижче 640px значення просто йде на свій рядок під
            назвою — тим самим порогом, яким уже переноситься рядок із полем. */}
        {value && <span className="shrink-0 text-[13px] text-muted max-sm:order-1 max-sm:w-full max-sm:shrink">{value}</span>}
        {children}
        <ChevronRight size={16} className="shrink-0 text-faint transition-colors group-hover:text-ink" aria-hidden />
      </button>
    );
  }

  return (
    <div className={`flex justify-between gap-3 py-[12px] sm:flex-row sm:items-center sm:gap-6 ${
      switchOnly ? 'flex-row items-center' : 'flex-col items-stretch'
    }`}>
      {text}
      <div className={switchOnly ? 'shrink-0' : 'w-full sm:w-auto sm:shrink-0'}>{children}</div>
    </div>
  );
}
