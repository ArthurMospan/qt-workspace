'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Layers3,
  MoreHorizontal,
  Plus,
  ScanSearch,
  X,
} from 'lucide-react';
import {
  Button,
  Counter,
  Input,
  Label,
  StatusPill,
  Surface,
  TypeBadge,
} from '@/components/ui';
import audit from './fidelity-audit.generated.json';

const QUESTIONS = [
  {
    id: 'token-source',
    title: 'Єдине джерело geometry та typography',
    question: 'Як зробити так, щоб зміна токена справді одночасно міняла сайт і /ui-kit?',
    scope: 'globals.css · design/tokens.js · Button/Input/Card/Surface · ручні Tailwind-класи',
    risk: 'Високий',
    preview: 'tokens',
    evidence: [
      `${audit.totals.manualSurfaces} ручних surface-кандидатів`,
      `${audit.totals.headingStyles} heading-використань`,
      'JS tokens зараз не керують основними Button/Input/Card',
    ],
    choices: [
      {
        id: 'semantic-css-contract',
        title: 'Semantic CSS contract',
        description: 'Живі CSS variables/utilities для radius, typography й controls; shared-компоненти та /ui-kit використовують ті самі значення.',
        recommended: true,
      },
      {
        id: 'components-only',
        title: 'Тільки shared-компоненти',
        description: 'Токени лишаються описом, а синхронізація досягається поступовою заміною ручної верстки компонентами.',
      },
      {
        id: 'document-only',
        title: 'Лишити як документацію',
        description: 'UI Kit показує правила, але ручні класи на сайті можуть надалі відхилятися.',
        warning: true,
      },
    ],
  },
  {
    id: 'form-labels',
    title: 'Form labels',
    question: 'Що робити з п’ятьма майже однаковими стилями підписів форм?',
    scope: 'Projects · Sprints · Billing · Timesheet · AI Call · Audio Task',
    risk: 'Середній',
    preview: 'labels',
    evidence: [
      `${audit.totals.manualLabels} native <label>`,
      '10px/11px, tracking-wide/wider',
      'відступи 4/6/8px',
    ],
    choices: [
      {
        id: 'shared-label-context-gap',
        title: 'Один Label, gap задає layout',
        description: 'Типографіка, колір і required-state завжди shared; відстань до поля контролює контейнер.',
        recommended: true,
      },
      {
        id: 'label-density-props',
        title: 'Label compact / standard',
        description: 'Два явні розміри Label для щільних таблиць і звичайних форм.',
      },
      {
        id: 'keep-local-labels',
        title: 'Лишити локальні labels',
        description: 'Поточні відступи не зміняться, але різниця tracking/color залишиться непомітною для UI Kit.',
        warning: true,
      },
    ],
  },
  {
    id: 'side-sheets',
    title: 'Side sheets та fullscreen overlays',
    question: 'Які з ручних overlay-shells повинні перейти на shared Dialog?',
    scope: 'Create project · Board config · Event edit · Time log · mobile chat · media viewers',
    risk: 'Високий',
    preview: 'sheets',
    evidence: [
      `${audit.totals.manualModalShells} ручних fixed/inset shells`,
      'форми змішані з mobile panels і media viewers',
      'різні z-index/header/close geometry',
    ],
    choices: [
      {
        id: 'form-sheets-only',
        title: 'Dialog для форм, viewers окремо',
        description: 'Create/Edit/Config/Time Log у shared sheet; mobile navigation, chat panels і media lightbox лишаються context overlays.',
        recommended: true,
      },
      {
        id: 'all-dialog',
        title: 'Усе через Dialog',
        description: 'Навіть media/mobile overlays отримають одну оболонку; можливі проблеми з fullscreen та responsive поведінкою.',
        warning: true,
      },
      {
        id: 'keep-shells',
        title: 'Не переносити',
        description: 'Кожний overlay лишається незалежним і може надалі розходитися.',
      },
    ],
  },
  {
    id: 'pill-taxonomy',
    title: 'Pills, badges та counters',
    question: 'Як канонізувати десятки локальних маленьких підкладок, не змішуючи їх семантику?',
    scope: 'Settings · Chat · Issue cards · Migration · Calendar · Team · Sprints',
    risk: 'Високий',
    preview: 'pills',
    evidence: [
      `${audit.totals.manualPills} ручних pill-кандидатів`,
      'radius 4/5/6/full',
      'однакова форма використовується для status/type/count/meta',
    ],
    choices: [
      {
        id: 'semantic-pill-family',
        title: 'Semantic family',
        description: 'Counter, StatusPill, TypeBadge, Tag + новий нейтральний MetaPill; кожна семантика має sizes.',
        recommended: true,
      },
      {
        id: 'universal-badge',
        title: 'Один універсальний Badge',
        description: 'Менше компонентів, але status, type, label і count змішаються в одному складному API.',
      },
      {
        id: 'keep-local-pills',
        title: 'Лишити локальні pills',
        description: 'Найменший ризик зараз, але зміна badge-геометрії в UI Kit не оновить сайт.',
        warning: true,
      },
    ],
  },
  {
    id: 'icon-actions',
    title: 'Компактні icon actions',
    question: 'Чи переносити ручні 24–36px icon-buttons на named Button sizes?',
    scope: 'Chat · Settings · Header · Markdown · QuickTeam+ · Media',
    risk: 'Середній',
    preview: 'icons',
    evidence: [
      `${audit.totals.manualIconButtons} нейтральних icon-button кандидатів`,
      '24/26/28/30/32/36px',
      'частина кнопок не має aria-label',
    ],
    choices: [
      {
        id: 'neutral-actions-shared',
        title: 'Shared для neutral actions',
        description: 'Звичайні close/edit/more/add → icon-xs/icon-sm/icon; media та dark auth controls лишають свої оболонки.',
        recommended: true,
      },
      {
        id: 'all-icon-buttons-shared',
        title: 'Усі icon-buttons shared',
        description: 'Максимальна однаковість, але lightbox/audio/header branding втратять контекстний chrome.',
      },
      {
        id: 'keep-icon-buttons',
        title: 'Лишити ручними',
        description: 'Розміри й hover-state продовжать відрізнятися між екранами.',
        warning: true,
      },
    ],
  },
  {
    id: 'control-compositions',
    title: 'Виняткові висоти controls',
    question: 'Як зафіксувати 40/42/52px compositions без довільного className поверх shared control?',
    scope: 'Error CTA · Time log · Invite input · large textarea · details dropdowns',
    risk: 'Високий',
    preview: 'controls',
    evidence: [
      `${audit.totals.sharedChromeOverrides} chrome-overrides shared-компонентів`,
      '42px time inputs',
      '52px invite composition',
    ],
    choices: [
      {
        id: 'named-compositions',
        title: 'Named composition presets',
        description: 'Залишити sm/md/lg для атомів, додати явні composition props для invite, time-log, long-text і sheet-body.',
        recommended: true,
      },
      {
        id: 'strict-control-sizes',
        title: 'Тільки sm / md / lg',
        description: 'Усі поля максимум 36px; invite/time-log інтерфейси стануть компактнішими.',
      },
      {
        id: 'allow-class-overrides',
        title: 'Дозволити overrides',
        description: 'Поточний вигляд збережеться, але UI Kit не зможе гарантувати геометрію.',
        warning: true,
      },
    ],
  },
  {
    id: 'component-twins',
    title: 'Компоненти-двійники з однаковими назвами',
    question: 'Що робити з локальними ProjectCard, Toast і Avatar поруч з іншими UI Kit версіями?',
    scope: 'Projects · global toast · QuickTeam+ chat',
    risk: 'Середній',
    preview: 'twins',
    evidence: [
      `${audit.totals.localSharedNameCollisions} name collisions`,
      'UI Kit версії зараз unused',
      'одна назва не означає однаковий компонент',
    ],
    choices: [
      {
        id: 'canonicalize-or-rename',
        title: 'Canonicalize або чесно перейменувати',
        description: 'Справжній повтор стає shared; context-only реалізація отримує точну назву, unused двійник видаляється.',
        recommended: true,
      },
      {
        id: 'delete-unused-only',
        title: 'Лише видалити unused UI версії',
        description: 'Колізії зникнуть, але живі локальні компоненти не потраплять у бібліотеку.',
      },
      {
        id: 'keep-twins',
        title: 'Лишити обидві версії',
        description: 'Найвищий ризик випадково імпортувати не ту реалізацію в майбутньому.',
        warning: true,
      },
    ],
  },
  {
    id: 'surface-boundary',
    title: 'Межа Card / Surface / локального контейнера',
    question: 'Наскільки широко shared surfaces повинні керувати картками й вкладеними блоками?',
    scope: 'Issue detail · Analytics · Settings · Calendar · Billing · QuickTeam+',
    risk: 'Високий',
    preview: 'surfaces',
    evidence: [
      `${audit.totals.manualSurfaces} ручних surface-кандидатів`,
      '51× radius 16px, 26× 12px, 15× 10px',
      'частина — cards, частина — dropdown/message/layout',
    ],
    choices: [
      {
        id: 'semantic-surfaces',
        title: 'Shared semantic surfaces',
        description: 'Product card/panel/inset переводимо на Card/Surface; dropdown, message bubble, calendar cell та media лишаються context primitives.',
        recommended: true,
      },
      {
        id: 'tokens-with-local-markup',
        title: 'Токени, але локальний markup',
        description: 'Контейнери лишаються div, проте використовують semantic radius/background utilities.',
      },
      {
        id: 'all-surfaces-shared',
        title: 'Кожний rounded block shared',
        description: 'Максимальна формальна уніфікація, але надмірна кількість props і wrapper-компонентів.',
        warning: true,
      },
    ],
  },
  {
    id: 'typography-contexts',
    title: 'Контексти типографіки',
    question: 'Чи мають auth, onboarding, invoice та rich text повторювати workspace 24/18?',
    scope: 'Workspace · Auth · Onboarding · printable invoice · Markdown',
    risk: 'Високий',
    preview: 'typography',
    evidence: [
      `${audit.totals.headingStyles} headings`,
      '14 фактичних size-варіантів',
      '24/18 є каноном тільки для workspace hierarchy',
    ],
    choices: [
      {
        id: 'named-typography-contexts',
        title: 'Named typography contexts',
        description: 'Workspace 24/18; auth/onboarding hero, document та rich-text scales формалізуються окремо й показуються в UI Kit.',
        recommended: true,
      },
      {
        id: 'strict-24-18-everywhere',
        title: '24 / 18 абсолютно всюди',
        description: 'Максимальна однаковість, але onboarding hero та invoice втратять потрібну ієрархію.',
      },
      {
        id: 'keep-heading-classes',
        title: 'Лишити локальні headings',
        description: 'Контексти збережуться, але нові розміри не контролюватимуться.',
        warning: true,
      },
    ],
  },
  {
    id: 'catalog-scope',
    title: 'Повнота каталогу',
    question: 'Що саме означає «UI Kit — біблія всього сайту» для спеціалізованих екранів?',
    scope: 'Workspace · Auth · Onboarding · Markdown · Media · Portal/QuickTeam+',
    risk: 'Середній',
    preview: 'scope',
    evidence: [
      `${audit.totals.productFiles} product UI files перевірено`,
      `${audit.kit.totals.used} shared components у живому каталозі`,
      'specialized organisms поки показані не всі',
    ],
    choices: [
      {
        id: 'whole-product-contexts',
        title: 'Весь продукт, але за контекстами',
        description: 'UI Kit містить shared atoms і representative organisms для workspace, auth, editor/media та portal; branding все ще тільки sidebar.',
      },
      {
        id: 'authenticated-workspace',
        title: 'Тільки authenticated workspace',
        description: 'Login/onboarding/editor/media не входять у контракт каталогу.',
        recommended: true,
      },
      {
        id: 'shared-atoms-only',
        title: 'Лише атоми та молекули',
        description: 'Складені екрани не показуються; subtle composition drift доведеться шукати вручну.',
        warning: true,
      },
    ],
  },
];

function PreviewFrame({ children }) {
  return <div className="rounded-[14px] bg-canvas p-4">{children}</div>;
}

function TokenPreview({ choiceId }) {
  const linked = choiceId === 'semantic-css-contract';
  const componentsOnly = choiceId === 'components-only';
  return (
    <PreviewFrame>
      <div className="grid gap-3 sm:grid-cols-2">
        {['UI Kit', 'Живий сайт'].map((label, index) => (
          <div
            key={label}
            className={`border border-line bg-white p-4 ${linked || (componentsOnly && index === 0) ? 'rounded-[16px]' : 'rounded-[12px]'}`}
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</div>
            <div className={`mt-3 h-9 bg-canvas ${linked || (componentsOnly && index === 0) ? 'rounded-[10px]' : 'rounded-[8px]'}`} />
          </div>
        ))}
      </div>
      <div className="mt-3 text-[11px] font-medium text-muted">
        {linked ? 'Один token contract → обидві сторони' : 'Зміна може торкнутися лише однієї сторони'}
      </div>
    </PreviewFrame>
  );
}

function LabelPreview({ choiceId }) {
  const local = choiceId === 'keep-local-labels';
  const compact = choiceId === 'label-density-props';
  return (
    <PreviewFrame>
      <div className="grid gap-3 sm:grid-cols-3">
        {['Проєкт', 'Спринт', 'Опис'].map((label, index) => (
          <div key={label} className={local && index === 1 ? 'flex flex-col gap-2' : 'flex flex-col gap-[6px]'}>
            {local ? (
              <span className={`${index === 2 ? 'text-[10px]' : 'text-[11px]'} font-bold uppercase ${index ? 'tracking-wide text-muted' : 'tracking-wider text-[#666]'}`}>
                {label}
              </span>
            ) : (
              <Label className={compact && index === 1 ? 'text-[10px]' : ''}>{label}</Label>
            )}
            <Input size={compact && index === 1 ? 'sm' : 'lg'} readOnly value="" />
          </div>
        ))}
      </div>
    </PreviewFrame>
  );
}

function SheetPreview({ choiceId }) {
  const unified = choiceId === 'form-sheets-only' || choiceId === 'all-dialog';
  return (
    <PreviewFrame>
      <div className="grid gap-3 sm:grid-cols-2">
        {['Нове завдання', 'Налаштування дошки'].map((title, index) => (
          <div key={title} className={`overflow-hidden bg-white ${unified ? 'rounded-[16px]' : index ? 'rounded-[12px]' : 'rounded-[20px]'}`}>
            <div className={`flex items-center justify-between border-b border-line ${unified ? 'px-4 py-3' : index ? 'px-3 py-2' : 'px-5 py-4'}`}>
              <span className={`${unified ? 'text-[16px]' : index ? 'text-[14px]' : 'text-[18px]'} font-bold text-ink`}>{title}</span>
              <Button style="ghost" size={unified ? 'icon-sm' : index ? 'icon-xs' : 'icon'} icon={X} aria-label="Закрити" />
            </div>
            <div className="space-y-2 p-4"><div className="h-8 rounded-[10px] bg-canvas" /><div className="h-8 rounded-[10px] bg-canvas" /></div>
          </div>
        ))}
      </div>
    </PreviewFrame>
  );
}

function PillPreview({ choiceId }) {
  if (choiceId === 'semantic-pill-family') {
    return (
      <PreviewFrame>
        <div className="flex flex-wrap items-center gap-2">
          <Counter value={12} size="sm" />
          <StatusPill label="Активний" color="#10b981" />
          <TypeBadge label="Task" color="#6366f1" />
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-muted">Meta · 2 хв</span>
        </div>
      </PreviewFrame>
    );
  }
  const universal = choiceId === 'universal-badge';
  return (
    <PreviewFrame>
      <div className="flex flex-wrap items-center gap-2">
        {['12', 'Активний', 'Task', 'Meta · 2 хв'].map((label, index) => (
          <span
            key={label}
            className={`${universal ? 'rounded-[6px]' : index % 2 ? 'rounded-full' : 'rounded-[4px]'} bg-white px-2 py-1 text-[10px] font-bold text-muted`}
          >
            {label}
          </span>
        ))}
      </div>
    </PreviewFrame>
  );
}

function IconPreview({ choiceId }) {
  const shared = choiceId !== 'keep-icon-buttons';
  return (
    <PreviewFrame>
      <div className="flex items-end gap-4">
        {[Plus, MoreHorizontal, X].map((Icon, index) => (
          <div key={index} className="text-center">
            {shared ? (
              <Button
                style="ghost"
                size={choiceId === 'all-icon-buttons-shared' ? 'icon' : ['icon-xs', 'icon-sm', 'icon'][index]}
                icon={Icon}
                aria-label="Дія"
              />
            ) : (
              <button
                type="button"
                aria-label="Дія"
                className={`${['h-6 w-6 rounded-[7px]', 'h-[30px] w-[30px] rounded-[8px]', 'h-9 w-9 rounded-full'][index]} inline-flex items-center justify-center bg-white text-muted`}
              >
                <Icon size={14} />
              </button>
            )}
            <div className="mt-1 text-[9px] text-muted">{shared ? ['xs', 'sm', 'md'][index] : ['24', '30', '36'][index]}</div>
          </div>
        ))}
      </div>
    </PreviewFrame>
  );
}

function ControlPreview({ choiceId }) {
  const named = choiceId === 'named-compositions';
  const strict = choiceId === 'strict-control-sizes';
  const heights = strict ? [36, 36, 36] : [36, 42, 52];
  return (
    <PreviewFrame>
      <div className="grid gap-3 sm:grid-cols-3">
        {['Form lg', named ? 'Time log composition' : 'Time log override', named ? 'Invite composition' : 'Invite override'].map((label, index) => (
          <div key={label}>
            <div className="mb-1 text-[10px] font-bold text-muted">{label}</div>
            <div style={{ height: heights[index] }} className="flex items-center rounded-[10px] bg-white px-3 text-[11px] text-muted">
              {heights[index]}px
            </div>
          </div>
        ))}
      </div>
    </PreviewFrame>
  );
}

function TwinsPreview({ choiceId }) {
  const canonical = choiceId === 'canonicalize-or-rename';
  return (
    <PreviewFrame>
      <div className="space-y-2">
        {[
          ['ProjectCard', canonical ? 'WorkspaceProjectCard / shared ProjectCard' : 'local + ui/ProjectCard'],
          ['Toast', canonical ? 'AppToast / shared Toast' : 'local + ui/Toast'],
          ['Avatar', canonical ? 'QtPlusAvatar / shared UserAvatar' : 'local + ui/Avatar'],
        ].map(([name, result]) => (
          <div key={name} className="grid grid-cols-[100px_1fr] items-center gap-3 rounded-[10px] bg-white px-3 py-2">
            <code className="text-[11px] font-bold text-ink">{name}</code>
            <span className="text-[11px] text-muted">{choiceId === 'delete-unused-only' ? 'unused UI twin видаляється' : result}</span>
          </div>
        ))}
      </div>
    </PreviewFrame>
  );
}

function SurfacePreview({ choiceId }) {
  const allShared = choiceId === 'all-surfaces-shared';
  const semantic = choiceId === 'semantic-surfaces';
  return (
    <PreviewFrame>
      <div className={`bg-white p-4 ${semantic || allShared ? 'rounded-[16px]' : 'rounded-[14px]'}`}>
        <div className="text-[11px] font-bold text-ink">{semantic || allShared ? 'Panel · 16px' : 'Local container · 14px'}</div>
        <div className={`mt-3 bg-canvas p-3 ${semantic || allShared ? 'rounded-[12px]' : 'rounded-[10px]'}`}>
          <div className="text-[10px] font-bold text-muted">{semantic || allShared ? 'Inset · 12px' : 'Local nested block'}</div>
          <div className={`mt-2 h-8 bg-white ${allShared ? 'rounded-[12px]' : 'rounded-[10px]'}`} />
        </div>
      </div>
    </PreviewFrame>
  );
}

function TypographyPreview({ choiceId }) {
  const strict = choiceId === 'strict-24-18-everywhere';
  const local = choiceId === 'keep-heading-classes';
  const rows = [
    ['Workspace', 24],
    ['Auth hero', strict ? 24 : local ? 32 : 32],
    ['Invoice', strict ? 24 : local ? 28 : 28],
    ['Rich text H2', strict ? 18 : local ? 20 : 20],
  ];
  return (
    <PreviewFrame>
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map(([label, size]) => (
          <div key={label} className="rounded-[10px] bg-white px-3 py-2">
            <div className="text-[9px] font-bold uppercase tracking-wider text-muted">{label}</div>
            <div className="mt-1 font-bold text-ink" style={{ fontSize: size }}>{size}px</div>
          </div>
        ))}
      </div>
    </PreviewFrame>
  );
}

function ScopePreview({ choiceId }) {
  const included = choiceId === 'whole-product-contexts'
    ? ['Workspace', 'Auth', 'Editor / Media', 'Portal / QT+']
    : choiceId === 'authenticated-workspace'
      ? ['Workspace']
      : ['Atoms', 'Molecules'];
  return (
    <PreviewFrame>
      <div className="grid gap-2 sm:grid-cols-4">
        {['Workspace', 'Auth', 'Editor / Media', 'Portal / QT+'].map(label => (
          <div
            key={label}
            className={`rounded-[10px] px-3 py-4 text-center text-[10px] font-bold ${
              included.includes(label) || choiceId === 'shared-atoms-only' ? 'bg-ink text-white' : 'bg-white text-faint'
            }`}
          >
            {label}
          </div>
        ))}
      </div>
    </PreviewFrame>
  );
}

function QuestionPreview({ type, choiceId }) {
  if (type === 'tokens') return <TokenPreview choiceId={choiceId} />;
  if (type === 'labels') return <LabelPreview choiceId={choiceId} />;
  if (type === 'sheets') return <SheetPreview choiceId={choiceId} />;
  if (type === 'pills') return <PillPreview choiceId={choiceId} />;
  if (type === 'icons') return <IconPreview choiceId={choiceId} />;
  if (type === 'controls') return <ControlPreview choiceId={choiceId} />;
  if (type === 'twins') return <TwinsPreview choiceId={choiceId} />;
  if (type === 'surfaces') return <SurfacePreview choiceId={choiceId} />;
  if (type === 'typography') return <TypographyPreview choiceId={choiceId} />;
  return <ScopePreview choiceId={choiceId} />;
}

function RiskBadge({ risk }) {
  const high = risk === 'Високий';
  return (
    <span className={`rounded-[7px] px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${
      high ? 'bg-[#fef2f2] text-[#b91c1c]' : 'bg-[#fefce8] text-[#92400e]'
    }`}>
      Ризик: {risk}
    </span>
  );
}

export default function FidelitySurvey() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const answers = {
    'token-source': 'semantic-css-contract',
    'form-labels': 'shared-label-context-gap',
    'side-sheets': 'form-sheets-only',
    'pill-taxonomy': 'semantic-pill-family',
    'icon-actions': 'neutral-actions-shared',
    'control-compositions': 'named-compositions',
    'component-twins': 'canonicalize-or-rename',
    'surface-boundary': 'semantic-surfaces',
    'typography-contexts': 'named-typography-contexts',
    'catalog-scope': 'authenticated-workspace',
  };
  const [copied, setCopied] = useState(false);
  const question = QUESTIONS[currentIndex];
  const recommendedChoice = question.choices.find(choice => choice.recommended);
  const selectedChoice = question.choices.find(choice => choice.id === answers[question.id]);
  const previewChoice = selectedChoice || recommendedChoice || question.choices[0];
  const answeredCount = Object.keys(answers).length;

  const summary = QUESTIONS.map((item, index) => {
    const choice = item.choices.find(candidate => candidate.id === answers[item.id]);
    return `${index + 1}. ${item.title}: ${choice?.title || 'НЕ ВИБРАНО'}`;
  }).join('\n');

  const copySummary = async () => {
    await navigator.clipboard.writeText(`UI Kit fidelity decisions\n\n${summary}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="flex flex-col gap-[20px]">
      <Surface preset="bordered-panel" padding="lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-[760px]">
            <div className="flex items-center gap-2">
              <ScanSearch size={18} />
              <h2 className="text-[18px] font-bold text-ink">Затверджені fidelity-рішення</h2>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              Автоматично перевірено {audit.totals.productFiles} reachable-файлів authenticated workspace. Усі десять рішень нижче вже затверджені та закодовані в semantic contracts.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-[10px] bg-white px-3 py-2">
            <Layers3 size={14} className="text-muted" />
            <span className="text-[11px] font-bold text-ink">{answeredCount} / {QUESTIONS.length} вибрано</span>
          </div>
        </div>
      </Surface>

      <div className="flex flex-wrap gap-1.5">
        {QUESTIONS.map((item, index) => {
          const selected = index === currentIndex;
          const answered = Boolean(answers[item.id]);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setCurrentIndex(index)}
              aria-label={`Питання ${index + 1}: ${item.title}`}
              className={`grid h-8 w-8 place-items-center rounded-[9px] text-[11px] font-bold transition-colors ${
                selected
                  ? 'bg-ink text-white'
                  : answered
                    ? 'bg-[#ecfdf5] text-[#047857]'
                    : 'bg-canvas text-muted hover:bg-line hover:text-ink'
              }`}
            >
              {answered && !selected ? <Check size={13} /> : index + 1}
            </button>
          );
        })}
      </div>

      <section className="rounded-[16px] border border-line bg-white p-[20px]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Питання {currentIndex + 1} з {QUESTIONS.length}
            </div>
            <h3 className="mt-1 text-[18px] font-bold text-ink">{question.title}</h3>
            <p className="mt-2 text-[13px] font-semibold text-ink">{question.question}</p>
            <p className="mt-1 text-[11px] text-muted">{question.scope}</p>
          </div>
          <RiskBadge risk={question.risk} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {question.evidence.map(item => (
            <span key={item} className="rounded-full bg-canvas px-2.5 py-1 text-[10px] font-semibold text-muted">
              {item}
            </span>
          ))}
        </div>

        <div className="mt-4">
          <QuestionPreview type={question.preview} choiceId={previewChoice.id} />
          {!selectedChoice && (
            <p className="mt-2 text-[10px] text-muted">
              Поки вибір не зроблено, preview показує рекомендований безпечний варіант.
            </p>
          )}
        </div>

        <div className="mt-4 grid gap-2">
          {question.choices.map(choice => {
            const selected = answers[question.id] === choice.id;
            return (
              <button
                key={choice.id}
                type="button"
                disabled
                className={`flex items-start gap-3 rounded-[12px] border p-3 text-left transition-colors ${
                  selected ? 'border-ink bg-canvas ring-4 ring-ink/5' : 'border-line bg-white opacity-60'
                }`}
              >
                <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                  selected ? 'border-ink bg-ink text-white' : 'border-faint text-transparent'
                }`}>
                  <Check size={10} strokeWidth={3} />
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[12px] font-bold text-ink">{choice.title}</span>
                    {choice.recommended && (
                      <span className="rounded-[6px] bg-[#ecfdf5] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#047857]">
                        Затверджено
                      </span>
                    )}
                    {choice.warning && (
                      <span className="rounded-[6px] bg-[#fef2f2] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#b91c1c]">
                        Ризик drift
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-[10px] leading-relaxed text-muted">{choice.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          style="secondary"
          size="md"
          icon={ArrowLeft}
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex(index => Math.max(0, index - 1))}
        >
          Назад
        </Button>
        <Button
          size="md"
          icon={currentIndex === QUESTIONS.length - 1 ? Copy : ArrowRight}
          onClick={currentIndex === QUESTIONS.length - 1
            ? copySummary
            : () => setCurrentIndex(index => Math.min(QUESTIONS.length - 1, index + 1))}
        >
          {currentIndex === QUESTIONS.length - 1
            ? copied ? 'Скопійовано' : 'Скопіювати відповіді'
            : 'Наступне'}
        </Button>
      </div>

      {answeredCount === QUESTIONS.length && (
        <div className="rounded-[16px] bg-ink p-[20px] text-white">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-[16px] font-bold">Усі рішення вибрані</h3>
              <p className="mt-1 text-[11px] text-white/60">Скопіюй цей блок і надішли мені без додаткових пояснень.</p>
            </div>
            <Button style="secondary" size="md" icon={copied ? Check : Copy} onClick={copySummary}>
              {copied ? 'Скопійовано' : 'Скопіювати'}
            </Button>
          </div>
          <pre className="mt-4 whitespace-pre-wrap rounded-[12px] bg-white/5 p-4 font-mono text-[11px] leading-relaxed text-white/75">
            {summary}
          </pre>
        </div>
      )}
    </div>
  );
}
