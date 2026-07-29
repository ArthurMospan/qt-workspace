'use client';

import { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Circle,
  Copy,
  Paperclip,
  Send,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import Button from '@/components/ui/Button';

const DECISIONS = [
  {
    id: 'button-colors',
    title: 'Кольори CTA-кнопок',
    question: 'Чи повинні PRO/billing CTA бути синіми, якщо основний Button підтримує лише dark/red?',
    scope: 'Projects modal · Settings / Billing',
    risk: 'Середній',
    preview: 'buttons',
    choices: [
      {
        id: 'dark-red-only',
        title: 'Тільки dark + red',
        description: 'Прибрати оманливі blue/gray props. Всі звичайні CTA темні, небезпечні — червоні.',
        recommended: true,
      },
      {
        id: 'billing-colors',
        title: 'Окремі billing colors',
        description: 'Додати справжні blue/gray variants, але дозволити їх лише для тарифів і підписки.',
      },
      {
        id: 'leave-current',
        title: 'Лишити як зараз',
        description: 'Props blue/gray залишаться, але візуально продовжать ставати dark.',
        warning: true,
      },
    ],
  },
  {
    id: 'typography',
    title: 'Типографічна шкала',
    question: 'Яка шкала має стати канонічною для page та section titles?',
    scope: 'PageHeader · section headings · design tokens',
    risk: 'Високий',
    preview: 'typography',
    choices: [
      {
        id: 'live-24-18',
        title: 'Жива шкала 24 / 18',
        description: 'Зберегти нинішній вигляд сайту й виправити старі tokens 32/24.',
        recommended: true,
      },
      {
        id: 'token-32-24',
        title: 'Token-шкала 32 / 24',
        description: 'Збільшити заголовки по всьому продукту відповідно до старих tokens.',
      },
    ],
  },
  {
    id: 'control-heights',
    title: 'Висоти Input та суміжних controls',
    question: 'Уніфікувати всі поля до 36px чи формалізувати менші контекстні розміри?',
    scope: 'Settings · IssueDetail · Billing · Invite dialog',
    risk: 'Високий',
    preview: 'inputs',
    choices: [
      {
        id: 'named-sizes',
        title: 'Named sizes: sm / md / lg',
        description: 'Зберегти 28/32/36px як явні sizes; 52px лишити окремим invite composition.',
        recommended: true,
      },
      {
        id: 'strict-36',
        title: 'Усе по 36px',
        description: 'Максимальна однаковість, але compact toolbars і таблиці стануть вищими.',
      },
      {
        id: 'free-overrides',
        title: 'Лишити довільні overrides',
        description: 'Нічого не зламається зараз, але UI Kit не контролюватиме нові висоти.',
        warning: true,
      },
    ],
  },
  {
    id: 'chat-composers',
    title: 'Три chat composer-и',
    question: 'Чи мають workspace, task timeline та QuickTeam+ виглядати однаково?',
    scope: 'Workspace chat · task timeline · QuickTeam+',
    risk: 'Високий',
    preview: 'chat',
    choices: [
      {
        id: 'shared-core-context-shells',
        title: 'Спільне ядро, різні оболонки',
        description: 'Винести textarea/send/attachments у shared primitives, але лишити 16/18/24px контексти.',
        recommended: true,
      },
      {
        id: 'one-workspace-composer',
        title: 'Один workspace composer',
        description: 'Усюди toolbar, border і прямокутний Send як у головному чаті.',
      },
      {
        id: 'keep-three',
        title: 'Лишити три незалежні',
        description: 'Зберегти поточний вигляд, але зміни доведеться повторювати в трьох файлах.',
        warning: true,
      },
    ],
  },
  {
    id: 'task-attributes',
    title: 'Task vs Calendar attributes',
    question: 'Що уніфікувати між task attributes і calendar attributes?',
    scope: 'IssueDetail · CalendarEventPage',
    risk: 'Високий',
    preview: 'attributes',
    choices: [
      {
        id: 'same-chrome-different-fields',
        title: 'Однаковий chrome, різні поля',
        description: 'Залишити 6/7 колонок за змістом, але вирівняти radius, labels, hover і compact controls.',
        recommended: true,
      },
      {
        id: 'one-grid',
        title: 'Однакова grid-схема',
        description: 'Один layout для task та event; частину полів доведеться ховати або переносити.',
      },
      {
        id: 'keep-contexts',
        title: 'Не змінювати',
        description: 'Залишити навіть різницю compact Select: 10px у task і 8px у calendar.',
      },
    ],
  },
  {
    id: 'cards-surfaces',
    title: 'Card та Surface',
    question: 'Border, radius і padding мають бути глобальними чи залежати від вкладеності?',
    scope: 'Settings · Analytics · Team · Billing',
    risk: 'Середній',
    preview: 'cards',
    choices: [
      {
        id: 'named-context-presets',
        title: 'Named context presets',
        description: 'Описати panel/card/inset і bordered/borderless як явні presets без довільних overrides.',
        recommended: true,
      },
      {
        id: 'all-borderless-16',
        title: 'Borderless + 16px всюди',
        description: 'Чистіший вигляд, але nested cards можуть втратити візуальну ієрархію.',
      },
      {
        id: 'all-bordered-16',
        title: 'Border + 16px всюди',
        description: 'Максимальна читабельність меж, але Settings стане візуально важчим.',
      },
    ],
  },
  {
    id: 'filter-bars',
    title: 'FilterBar та ширини фільтрів',
    question: 'Як контролювати різні 136/148/200/210px widths?',
    scope: 'Projects · Calendar · Analytics · My · Sprints',
    risk: 'Середній',
    preview: 'filters',
    choices: [
      {
        id: 'content-presets',
        title: 'Presets за типом контенту',
        description: 'member/project = wide, date/type = compact; сторінка обирає preset, а не px.',
        recommended: true,
      },
      {
        id: 'auto-width',
        title: 'Повністю auto width',
        description: 'Контрол визначає ширину за label; toolbar може стрибати між значеннями.',
      },
      {
        id: 'one-width',
        title: 'Одна ширина 200px',
        description: 'Найпростіше правило, але Calendar займатиме значно більше місця.',
      },
    ],
  },
  {
    id: 'sprint-badge',
    title: 'Sprint status badge',
    question: 'Що зробити з локальним Badge на сторінці спринтів?',
    scope: 'Sprints page',
    risk: 'Низький',
    preview: 'badges',
    choices: [
      {
        id: 'shared-status-pill',
        title: 'Новий shared StatusPill',
        description: 'Малий text-only pill із довільним semantic color для sprint та майбутніх статусів.',
        recommended: true,
      },
      {
        id: 'tag-no-icon',
        title: 'Використати Tag без іконки',
        description: 'Менше компонентів, але Tag семантично означає мітку, а не статус.',
      },
      {
        id: 'keep-local',
        title: 'Лишити локальний Badge',
        description: 'Нуль ризику зараз, але він не синхронізуватиметься через UI Kit.',
        warning: true,
      },
    ],
  },
  {
    id: 'empty-states',
    title: 'Геометрія EmptyState',
    question: 'Як зберегти різні висоти, не повертаючись до довільних className?',
    scope: 'Projects · Chat · Team · QuickTeam+ · Timeline',
    risk: 'Середній',
    preview: 'empty',
    choices: [
      {
        id: 'context-props',
        title: 'Context / density props',
        description: 'Ввести page, inset, compact і flexible; зміст лишається сторінковим.',
        recommended: true,
      },
      {
        id: 'one-fixed-state',
        title: 'Один fixed EmptyState',
        description: 'Однаковий розмір усюди, але маленькі chat/profile області розтягнуться.',
      },
      {
        id: 'keep-classes',
        title: 'Лишити className',
        description: 'Поточний вигляд не зміниться, але нові контексти знову можуть розійтися.',
      },
    ],
  },
  {
    id: 'manual-controls',
    title: 'Ручні buttons та inputs',
    question: 'Наскільки агресивно замінювати 187 native buttons і 39 native inputs/textareas?',
    scope: 'Весь workspace',
    risk: 'Дуже високий',
    preview: 'manual',
    choices: [
      {
        id: 'extract-repeated-only',
        title: 'Виносити лише повторювані patterns',
        description: 'Спочатку chat send, compact actions, number inputs і header icon buttons.',
        recommended: true,
      },
      {
        id: 'replace-all',
        title: 'Замінити все shared-компонентами',
        description: 'Найбільша уніфікація, але високий ризик зламати спеціальні drag/media/chat controls.',
        warning: true,
      },
      {
        id: 'leave-all',
        title: 'Нічого не переносити',
        description: 'Нуль міграційного ризику, але UI Kit ніколи не стане повною точкою керування.',
      },
    ],
  },
];

const APPROVED_ANSWERS = {
  'button-colors': 'dark-red-only',
  typography: 'live-24-18',
  'control-heights': 'named-sizes',
  'chat-composers': 'shared-core-context-shells',
  'task-attributes': 'same-chrome-different-fields',
  'cards-surfaces': 'named-context-presets',
  'filter-bars': 'content-presets',
  'sprint-badge': 'shared-status-pill',
  'empty-states': 'context-props',
  'manual-controls': 'extract-repeated-only',
};

function PreviewFrame({ children, dark = false }) {
  return (
    <div className={`rounded-[12px] p-3 ${dark ? 'bg-ink text-white' : 'bg-canvas text-ink'}`}>
      {children}
    </div>
  );
}

function ButtonPreview({ choiceId }) {
  const colored = choiceId === 'billing-colors';
  return (
    <PreviewFrame>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`h-8 rounded-[10px] px-4 text-[12px] font-bold text-white ${
            colored ? 'bg-[#3b82f6]' : 'bg-ink'
          }`}
        >
          Оновити до PRO
        </button>
        <button
          type="button"
          className={`h-8 rounded-[10px] px-4 text-[12px] font-bold ${
            colored ? 'bg-[#f1f1f1] text-[#737373]' : 'bg-[#f5f5f5] text-ink'
          }`}
        >
          Скасувати
        </button>
        <button type="button" className="h-8 rounded-[10px] bg-[#ef4444] px-4 text-[12px] font-bold text-white">
          Видалити
        </button>
      </div>
    </PreviewFrame>
  );
}

function TypographyPreview({ choiceId }) {
  const large = choiceId === 'token-32-24';
  return (
    <PreviewFrame>
      <div className="font-bold tracking-tight" style={{ fontSize: large ? 32 : 24 }}>Проєкти</div>
      <div className="mt-2 font-bold" style={{ fontSize: large ? 24 : 18 }}>Активні завдання</div>
      <div className="mt-1 text-[12px] text-muted">Звичайний body залишається 13–14px</div>
    </PreviewFrame>
  );
}

function InputPreview({ choiceId }) {
  const strict = choiceId === 'strict-36';
  const rows = [
    { label: 'Compact toolbar', height: strict ? 36 : 28 },
    { label: 'Inline details', height: strict ? 36 : 32 },
    { label: 'Standard form', height: 36 },
  ];
  return (
    <PreviewFrame>
      <div className="space-y-2">
        {rows.map(row => (
          <div key={row.label} className="flex items-center gap-2">
            <span className="w-[92px] shrink-0 text-[10px] font-bold text-muted">{row.label}</span>
            <input
              readOnly
              value={`${row.height}px control`}
              style={{ height: row.height }}
              className="min-w-0 flex-1 rounded-[10px] border-0 bg-white px-3 text-[11px] font-medium text-ink outline-none"
            />
            <button
              type="button"
              style={{ height: row.height }}
              className="rounded-[10px] bg-ink px-3 text-[11px] font-bold text-white"
            >
              Дія
            </button>
          </div>
        ))}
      </div>
    </PreviewFrame>
  );
}

function MiniComposer({ radius, toolbar = false, attachment = false }) {
  return (
    <div className={`overflow-hidden bg-white ring-1 ring-black/[0.06] ${radius}`}>
      <div className="flex min-h-[36px] items-center gap-1 p-1">
        {attachment && (
          <span className="grid h-7 w-7 place-items-center rounded-[8px] text-muted">
            <Paperclip size={13} />
          </span>
        )}
        <span className="min-w-0 flex-1 px-2 text-[11px] text-muted">Повідомлення…</span>
        {!toolbar && (
          <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-white">
            <Send size={12} />
          </span>
        )}
      </div>
      {toolbar && (
        <div className="flex items-center justify-between border-t border-line px-2 py-1.5">
          <Paperclip size={13} className="text-muted" />
          <span className="rounded-[9px] bg-ink px-3 py-1 text-[10px] font-bold text-white">Надіслати</span>
        </div>
      )}
    </div>
  );
}

function ChatPreview({ choiceId }) {
  const one = choiceId === 'one-workspace-composer';
  return (
    <PreviewFrame>
      <div className="grid gap-2 sm:grid-cols-3">
        <div>
          <div className="mb-1 text-[9px] font-bold uppercase text-muted">Workspace</div>
          <MiniComposer radius="rounded-[16px]" toolbar />
        </div>
        <div>
          <div className="mb-1 text-[9px] font-bold uppercase text-muted">Timeline</div>
          <MiniComposer radius={one ? 'rounded-[16px]' : 'rounded-[18px]'} toolbar={one} attachment={!one} />
        </div>
        <div>
          <div className="mb-1 text-[9px] font-bold uppercase text-muted">QuickTeam+</div>
          <MiniComposer radius={one ? 'rounded-[16px]' : 'rounded-[24px]'} toolbar={one} />
        </div>
      </div>
    </PreviewFrame>
  );
}

function AttributeStrip({ calendar = false, unified = false }) {
  const fields = calendar
    ? ['Тип', 'Проєкт', 'Дата', 'Час', 'Учасники', 'Трекінг', 'Деталі']
    : ['Статус', 'Виконавець', 'Спринт', 'Дедлайн', 'Трекінг', 'Деталі'];
  return (
    <div className="grid gap-1.5 rounded-[12px] bg-white p-2" style={{ gridTemplateColumns: `repeat(${fields.length}, minmax(0, 1fr))` }}>
      {fields.map((field, index) => (
        <div key={field} className={`min-w-0 bg-canvas px-2 py-1.5 ${unified ? 'rounded-[10px]' : calendar ? 'rounded-[8px]' : 'rounded-[10px]'}`}>
          <div className="truncate text-[8px] font-bold uppercase text-muted">{field}</div>
          <div className="mt-1 h-[5px] w-3/4 rounded-full bg-faint" />
          {index === fields.length - 1 && <SlidersHorizontal size={10} className="mt-1 text-muted" />}
        </div>
      ))}
    </div>
  );
}

function AttributesPreview({ choiceId }) {
  const unified = choiceId === 'same-chrome-different-fields' || choiceId === 'one-grid';
  return (
    <PreviewFrame>
      <div className="space-y-2 overflow-hidden">
        <AttributeStrip unified={unified} />
        <AttributeStrip calendar unified={unified} />
      </div>
    </PreviewFrame>
  );
}

function CardPreview({ choiceId }) {
  const bordered = choiceId === 'all-bordered-16';
  const context = choiceId === 'named-context-presets';
  return (
    <PreviewFrame>
      <div className="grid grid-cols-2 gap-2">
        <div className={`rounded-[16px] bg-white p-3 ${bordered || context ? 'border border-line' : ''}`}>
          <div className="text-[11px] font-bold">Settings card</div>
          <div className="mt-2 h-2 rounded-full bg-canvas" />
        </div>
        <div className={`bg-white p-3 ${context ? 'rounded-[12px]' : 'rounded-[16px]'} ${bordered ? 'border border-line' : ''}`}>
          <div className="text-[11px] font-bold">Nested card</div>
          <div className="mt-2 h-2 rounded-full bg-canvas" />
        </div>
      </div>
    </PreviewFrame>
  );
}

function FilterPreview({ choiceId }) {
  const one = choiceId === 'one-width';
  const auto = choiceId === 'auto-width';
  const widths = auto ? ['auto', 'auto', 'auto'] : one ? [200, 200, 200] : [136, 200, 148];
  const labels = ['Тип', 'Всі проєкти', 'Цей місяць'];
  return (
    <PreviewFrame>
      <div className="flex flex-wrap items-center gap-1 rounded-[10px] bg-white p-1">
        {labels.map((label, index) => (
          <div
            key={label}
            style={{ width: widths[index] }}
            className="flex h-7 max-w-full items-center justify-between gap-2 rounded-[8px] px-2 text-[10px] font-semibold text-ink"
          >
            <span className="truncate">{label}</span>
            <span className="text-muted">⌄</span>
          </div>
        ))}
      </div>
    </PreviewFrame>
  );
}

function BadgePreview({ choiceId }) {
  const tag = choiceId === 'tag-no-icon';
  const local = choiceId === 'keep-local';
  return (
    <PreviewFrame>
      <div className="flex items-center gap-2">
        {['Активний', 'Запланований', 'Завершено'].map((label, index) => (
          <span
            key={label}
            className={`${tag ? 'rounded-[6px] px-[6px] py-[2px]' : 'rounded-[5px] px-[6px] py-[2px]'} text-[10px] font-bold`}
            style={{
              color: index === 0 ? '#10b981' : index === 1 ? '#737373' : '#94a3b8',
              background: index === 0 ? '#10b98118' : index === 1 ? '#9a9a9a18' : '#cbd5e118',
              opacity: local ? 0.82 : 1,
            }}
          >
            {tag ? '⌑ ' : ''}{label}
          </span>
        ))}
      </div>
    </PreviewFrame>
  );
}

function EmptyPreview({ choiceId }) {
  const fixed = choiceId === 'one-fixed-state';
  const heights = fixed ? [76, 76, 76] : [96, 64, 78];
  return (
    <PreviewFrame>
      <div className="grid grid-cols-3 gap-2">
        {['Page', 'Compact', 'Flexible'].map((label, index) => (
          <div key={label} style={{ height: heights[index] }} className="grid place-items-center rounded-[10px] bg-white p-2 text-center">
            <div>
              <Circle size={14} className="mx-auto text-muted" />
              <div className="mt-1 text-[9px] font-bold text-ink">{label}</div>
              <div className="mt-1 h-1 w-10 rounded-full bg-line" />
            </div>
          </div>
        ))}
      </div>
    </PreviewFrame>
  );
}

function ManualPreview({ choiceId }) {
  const repeated = choiceId === 'extract-repeated-only';
  return (
    <PreviewFrame>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="space-y-1">
          {[1, 2, 3].map(item => <div key={item} className="h-5 rounded-[7px] bg-white" />)}
        </div>
        <div className="text-center text-[10px] font-bold text-muted">{repeated ? 'повтори → shared' : choiceId === 'replace-all' ? 'усі → shared' : 'без змін'}</div>
        <div className="space-y-1">
          <div className={`h-5 rounded-[7px] ${repeated ? 'bg-ink' : 'bg-white'}`} />
          <div className="h-5 rounded-[7px] bg-white" />
          <div className="h-5 rounded-[7px] bg-white" />
        </div>
      </div>
    </PreviewFrame>
  );
}

function ChoicePreview({ type, choiceId }) {
  if (type === 'buttons') return <ButtonPreview choiceId={choiceId} />;
  if (type === 'typography') return <TypographyPreview choiceId={choiceId} />;
  if (type === 'inputs') return <InputPreview choiceId={choiceId} />;
  if (type === 'chat') return <ChatPreview choiceId={choiceId} />;
  if (type === 'attributes') return <AttributesPreview choiceId={choiceId} />;
  if (type === 'cards') return <CardPreview choiceId={choiceId} />;
  if (type === 'filters') return <FilterPreview choiceId={choiceId} />;
  if (type === 'badges') return <BadgePreview choiceId={choiceId} />;
  if (type === 'empty') return <EmptyPreview choiceId={choiceId} />;
  return <ManualPreview choiceId={choiceId} />;
}

function RiskBadge({ risk }) {
  const high = risk.includes('Високий');
  return (
    <span className={`inline-flex h-6 items-center rounded-[7px] px-2 text-[9px] font-bold uppercase tracking-wider ${
      high ? 'bg-[#fef2f2] text-[#b91c1c]' : risk === 'Низький' ? 'bg-[#ecfdf5] text-[#047857]' : 'bg-[#fefce8] text-[#92400e]'
    }`}>
      Ризик: {risk}
    </span>
  );
}

export default function DecisionLab() {
  const [copied, setCopied] = useState(false);
  const summary = DECISIONS.map((decision, index) => {
    const selected = decision.choices.find(choice => choice.id === APPROVED_ANSWERS[decision.id]);
    return `${index + 1}. ${decision.title}: ${selected?.title || 'НЕ ВИРІШЕНО'}`;
  }).join('\n');

  const copySummary = async () => {
    await navigator.clipboard.writeText(`UI Kit decisions\n\n${summary}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="flex flex-col gap-[24px]">
      <div className="rounded-[16px] border border-line bg-canvas p-[20px]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-[760px]">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-ink" />
              <h2 className="text-[18px] font-bold text-ink">Затверджені UI Kit decisions</h2>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              Нижче зафіксовані десять рішень, за якими синхронізуються shared-компоненти, продукт і ця сторінка UI Kit.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="rounded-[10px] bg-white px-3 py-2 text-[11px] font-bold text-ink">
              {DECISIONS.length} / {DECISIONS.length} затверджено
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-[10px] bg-white px-3 py-2 text-[11px] font-medium text-muted">
          <CheckCircle2 size={14} className="shrink-0 text-[#10b981]" />
          Брендинг не входить в опитування: custom branding продовжує змінювати тільки sidebar.
        </div>
      </div>

      {DECISIONS.map((decision, decisionIndex) => {
        const selectedChoice = decision.choices.find(choice => choice.id === APPROVED_ANSWERS[decision.id]);
        return (
          <section key={decision.id} className="rounded-[16px] border border-line bg-white p-[20px]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[8px] bg-ink text-[10px] font-bold text-white">
                    {decisionIndex + 1}
                  </span>
                  <h3 className="text-[16px] font-bold text-ink">{decision.title}</h3>
                </div>
                <p className="mt-2 text-[13px] font-semibold text-ink">{decision.question}</p>
                <p className="mt-1 text-[11px] text-muted">{decision.scope}</p>
              </div>
              <RiskBadge risk={decision.risk} />
            </div>

            <div className="mt-4 grid gap-3">
              <div className="grid min-w-0 gap-3 rounded-[14px] border border-ink bg-white p-3 ring-4 ring-ink/5 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
                <ChoicePreview type={decision.preview} choiceId={selectedChoice.id} />
                <div className="flex min-w-0 items-start gap-2 rounded-[10px] text-left">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border border-ink bg-ink text-white">
                    <Check size={10} strokeWidth={3} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[12px] font-bold text-ink">{selectedChoice.title}</span>
                      <span className="rounded-[6px] bg-[#ecfdf5] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#047857]">
                        Затверджено
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted">{selectedChoice.description}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })}

      <div className="rounded-[16px] bg-ink p-[20px] text-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-[16px] font-bold">Підсумок вибору</h3>
            <p className="mt-1 text-[11px] text-white/50">Збережено локально в цьому браузері.</p>
          </div>
          <Button style="secondary" size="md" icon={copied ? Check : Copy} onClick={copySummary}>
            {copied ? 'Скопійовано' : 'Скопіювати рішення'}
          </Button>
        </div>
        <pre className="mt-4 whitespace-pre-wrap rounded-[12px] bg-white/5 p-4 font-mono text-[11px] leading-relaxed text-white/75">
          {summary}
        </pre>
      </div>
    </div>
  );
}
