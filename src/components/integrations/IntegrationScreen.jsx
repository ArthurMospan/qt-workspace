'use client';

// ─── Екран однієї інтеграції ─────────────────────────────────────────────────
//
// Дві сцени, і в обох усі інтеграції виглядають однаково.
//
// Поки не підключено — одна сцена підключення: логотип, речення, форма, одна
// кнопка. Більше на екрані немає нічого. Щойно підключено — сцена зникає
// назавжди, і лишаються рядки налаштувань, ті самі `SettingRow`, якими набрані
// решта «Налаштувань».
//
// Що це замінило. Кожна інтеграція мала власну форму: qTicket — текстову
// кнопку там, де в сусідів світч, шість блоків підряд і кнопку «Синхронізувати»
// на екрані, де все інше зберігається саме; Telegram — майстер із чотирьох
// пронумерованих кроків просто в картці; YouTrack — те саме плюс власну панель
// із власним радіусом. Спільного між ними був лише логотип.
//
// Три речі пішли разом зі старим файлом і мають лишитись у минулому:
//
//   `IntegrationNote` — сіра панель з обводкою, у яку складали все підряд.
//   Вона давала третій і четвертий рівень вкладеності (картка → панель → білий
//   список → рядок) і ставила поля вводу на `canvas`, де сіре поле на сірому
//   тлі не має видимих меж. Її роль виконують рядки на білому та `Card`.
//
//   `IntegrationSteps` — нумеровані кроки. Крок — це стан, а не абзац: людина
//   не може «бути» на кроці 3, якщо всі чотири намальовані одночасно. Те, що
//   справді має кроки, стало формою підключення або діалогом.
//
//   `IntegrationCode` — <code> для токена й адреси. Лишився там, де це
//   справді літерал, який копіюють, і не малює більше цілі абзаци.

import Image from 'next/image';
import { Button, Card, Pill, ToggleSwitch } from '@/components/ui';
import { integrationStatus } from '@/lib/content/integrations.mjs';

/**
 * Плитка з логотипом сервісу — та сама у списку, у шапці й у сцені підключення.
 *
 * @param {string} props.src Шлях до логотипа.
 * @param {string} props.alt Назва сервісу; порожня, коли поруч стоїть підпис.
 * @param {'sm'|'md'|'lg'} props.size Плитка списку, плитка шапки, плитка сцени.
 */
export function IntegrationLogo({ src, alt = '', size = 'md' }) {
  const box = { sm: 30, md: 40, lg: 52 }[size] || 40;
  const glyph = { sm: 22, md: 30, lg: 34 }[size] || 30;
  const radius = { sm: 8, md: 10, lg: 14 }[size] || 10;
  return (
    <span
      data-ui-surface="local"
      className="flex shrink-0 items-center justify-center overflow-hidden border border-line bg-surface"
      style={{ width: box, height: box, borderRadius: radius }}
    >
      <Image src={src} alt={alt} width={glyph} height={glyph} className="object-contain" style={{ width: glyph, height: glyph }} />
    </span>
  );
}

/**
 * Стан і вимикач — те, що стоїть у шапці екрана справа.
 *
 * Світч тут у всіх без винятку. qTicket мав на цьому місці текстову кнопку, яка
 * міняла назву («Активувати» / «Відкрити») і робила дві різні речі під одним
 * виглядом; вимкнути інтеграцію нею було не можна взагалі, для цього внизу
 * екрана стояла третя кнопка. Відкрити сервіс — окрема, вторинна дія, і вона
 * виглядає як посилання назовні, чим вона і є.
 *
 * @param {'connected'|'idle'|'connecting'|'error'|'unavailable'} props.status Стан підключення.
 * @param {{label: string, icon?: React.ComponentType, onClick: () => void}} props.action Вторинна дія шапки.
 * @param {boolean} props.enabled Чи ввімкнена інтеграція.
 * @param {(next: boolean) => void} props.onToggle Вмикає й вимикає її.
 * @param {boolean} props.toggleDisabled Світч недоступний — немає прав або середовище не налаштоване.
 * @param {string} props.title Назва сервісу, для доступного імені світча.
 */
export function IntegrationControls({
  status,
  action,
  enabled,
  onToggle,
  toggleDisabled = false,
  title,
}) {
  const state = integrationStatus(status);
  return (
    <>
      <Pill tone={state.tone} size="md">{state.label}</Pill>
      {action && (
        <Button style="secondary" size="sm" icon={action.icon} onClick={action.onClick} disabled={action.disabled}>
          {action.label}
        </Button>
      )}
      {onToggle && (
        <ToggleSwitch
          checked={enabled}
          onChange={onToggle}
          disabled={toggleDisabled}
          ariaLabel={`${enabled ? 'Вимкнути' : 'Увімкнути'} інтеграцію ${title}`}
        />
      )}
    </>
  );
}

/**
 * Сцена підключення: усе, що є на екрані, поки інтеграція не підключена.
 *
 * Одна дія, і вона названа тим, що станеться. Форма — під поясненням, а не між
 * пронумерованими абзацами: там, де кроки справді є (додати бота в групу,
 * надіслати команду), вони стаються в Telegram, а не на цьому екрані, і
 * розповідати про них наперед — це інструкція замість кнопки.
 *
 * @param {string} props.logoSrc Логотип сервісу.
 * @param {string} props.title Що станеться після натискання.
 * @param {string} props.description Одне речення про те, навіщо це.
 * @param {React.ReactNode} props.children Поля, потрібні для підключення; без них сцена — це просто кнопка.
 * @param {{label: string, onClick: () => void, loading?: boolean, disabled?: boolean, icon?: React.ComponentType}} props.action Кнопка підключення.
 * @param {React.ReactNode} props.footnote Дрібний рядок під кнопкою — куди дінеться токен, що буде далі.
 */
export function IntegrationConnect({
  logoSrc,
  title,
  description,
  children,
  action,
  footnote,
}) {
  return (
    <Card preset="borderless" padding="lg">
      <div className="flex flex-col items-center gap-[14px] py-[26px] text-center">
        {logoSrc && <IntegrationLogo src={logoSrc} size="lg" />}
        <div className="flex flex-col gap-[6px]">
          <p className="ui-type-dialog-title text-ink">{title}</p>
          {description && (
            <p className="mx-auto max-w-[46ch] text-[13px] leading-relaxed text-muted">{description}</p>
          )}
        </div>
        {children && <div className="mt-[2px] flex w-full max-w-[340px] flex-col gap-[10px] text-left">{children}</div>}
        {action && (
          <Button
            size="md"
            icon={action.icon}
            onClick={action.onClick}
            loading={action.loading}
            disabled={action.disabled}
          >
            {action.label}
          </Button>
        )}
        {footnote && <p className="max-w-[46ch] text-[11px] leading-relaxed text-muted">{footnote}</p>}
      </div>
    </Card>
  );
}

/**
 * Зона роботи — єдине відхилення від спільної форми, і воно навмисне.
 *
 * Перенесення даних має те, чого немає в жодної інтеграції: процес, який
 * триває хвилинами, показує поступ і може обірватись посередині. Це не
 * налаштування, тож у рядку йому місця немає, і саме тому зона має власну
 * картку з рамкою — щоб її було видно як окрему річ, а не як ще одне поле.
 *
 * @param {string} props.title Назва роботи.
 * @param {string} props.description Один рядок про те, як вона поводиться.
 * @param {React.ReactNode} props.status Пігулка стану роботи.
 * @param {React.ReactNode} props.children Поступ, попередження, кнопки.
 */
export function IntegrationWork({ title, description, status, children }) {
  return (
    <Card preset="bordered" padding="lg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="ui-type-card-title text-ink">{title}</p>
          {description && <p className="mt-[2px] text-[12px] leading-relaxed text-muted">{description}</p>}
        </div>
        {status}
      </div>
      {children && <div className="mt-[16px] flex flex-col gap-[14px]">{children}</div>}
    </Card>
  );
}

/**
 * Літерал, який копіюють: токен, ідентифікатор організації, команда бота.
 *
 * Єдине, що лишилось від старого файлу, і лише в цій ролі. Раніше в <code>
 * загортали і цілі речення.
 */
export function IntegrationCode({ children, className = '' }) {
  return (
    <code className={`rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink ${className}`}>
      {children}
    </code>
  );
}
