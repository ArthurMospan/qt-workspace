'use client';

import { useState } from 'react';
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Folder,
  GitBranch,
  Kanban,
  List,
  Plus,
  ScanSearch,
} from 'lucide-react';
import { Button, Counter, StatusPill, Surface } from '@/components/ui';

const APPROVED_ANSWERS = {
  'hidden-kanban-columns': 'context-hidden-lane',
  'hidden-list-items': 'group-both-lists',
  'task-create-entry': 'context-create',
  'project-identity': 'cross-project-only',
  'legacy-epic-policy': 'legacy-read-only',
  'task-hierarchy': 'real-child-issues',
};

const QUESTIONS = [
  {
    id: 'hidden-kanban-columns',
    title: 'Приховані колонки на Kanban',
    question: 'Однаково ховати колонки в проєкті та в «Моїх завданнях», чи лишити різну поведінку?',
    current: 'Проєкт повністю ховає колонку; «Мої завдання» збирають її задачі в колонку «Приховані».',
    preview: 'hidden-kanban',
    choices: [
      {
        id: 'context-hidden-lane',
        title: 'Лишити context preset',
        description: 'У проєкті колонка справді прихована; у cross-project дошці задачі не губляться й збираються праворуч.',
        recommended: true,
      },
      {
        id: 'hide-everywhere',
        title: 'Повністю ховати всюди',
        description: 'Однакова поведінка, але особисті призначені задачі можуть зникнути з «Моїх завдань».',
      },
      {
        id: 'hidden-lane-everywhere',
        title: 'Колонка «Приховані» всюди',
        description: 'Жодна задача не зникає, але project-level налаштування вже не означає повне приховування.',
      },
    ],
  },
  {
    id: 'hidden-list-items',
    title: 'Приховані статуси у режимі «Списком»',
    question: 'Чи повинне налаштування прихованих колонок також впливати на List View?',
    current: 'Обидва спискові представлення збирають задачі прихованих статусів в окрему секцію «Приховані».',
    preview: 'hidden-list',
    choices: [
      {
        id: 'group-both-lists',
        title: 'Секція «Приховані» в обох',
        description: 'Задачі не губляться: обидва List View збирають приховані статуси в одну явну секцію.',
        recommended: true,
      },
      {
        id: 'show-both-lists',
        title: 'Показувати в обох списках',
        description: 'Налаштування керує тільки Kanban; список завжди є повним реєстром задач.',
      },
      {
        id: 'keep-context-list',
        title: 'Лишити різницю',
        description: 'Особистий список компактніший, project list повний, але поведінка неочевидна.',
      },
    ],
  },
  {
    id: 'task-create-entry',
    title: 'Швидке створення з колонки',
    question: 'Plus у колонці має відкривати однакову форму на обох дошках?',
    current: 'У проєкті — inline title; у «Моїх завданнях» — повна форма, бо треба вибрати проєкт.',
    preview: 'create',
    choices: [
      {
        id: 'context-create',
        title: 'Context-aware створення',
        description: 'Project board лишає швидкий inline add, cross-project board відкриває повну форму з проєктом.',
        recommended: true,
      },
      {
        id: 'full-form-everywhere',
        title: 'Повна форма всюди',
        description: 'Абсолютно однакова дія, але швидке створення в конкретному проєкті стає повільнішим.',
      },
      {
        id: 'inline-everywhere',
        title: 'Inline add всюди',
        description: 'Для «Моїх завдань» доведеться додати ще один компактний selector проєкту.',
      },
    ],
  },
  {
    id: 'project-identity',
    title: 'Назва проєкту на task card / row',
    question: 'Показувати назву проєкту на картці навіть усередині самого проєкту?',
    current: 'У «Моїх завданнях» назва потрібна для контексту; у проєкті вона прихована як дубль сторінки.',
    preview: 'project',
    choices: [
      {
        id: 'cross-project-only',
        title: 'Тільки у cross-project views',
        description: 'Один shared component, а project chip вмикається семантичним prop лише там, де він не дублює контекст.',
        recommended: true,
      },
      {
        id: 'show-project-everywhere',
        title: 'Показувати всюди',
        description: 'Картки 1:1 за наповненням, але в проєкті з’являється повтор назви на кожній задачі.',
      },
      {
        id: 'hide-project-everywhere',
        title: 'Не показувати ніде',
        description: 'Чистіші картки, але в «Моїх завданнях» незрозуміло, до якого проєкту належить задача.',
      },
    ],
  },
  {
    id: 'legacy-epic-policy',
    title: 'Що робити зі старими Епіками',
    question: 'Епік прибрано з нового створення та фільтрів. Яка доля вже записаних задач цього типу?',
    current: 'Дані не видалені: старі записи продовжують читатися, щоб нічого не зламати.',
    preview: 'epic',
    choices: [
      {
        id: 'legacy-read-only',
        title: 'Legacy read-only',
        description: 'Старі Епіки видимі з позначкою legacy, але нові створити або призначити не можна.',
        recommended: true,
      },
      {
        id: 'migrate-to-feature',
        title: 'Мігрувати у Фічу',
        description: 'Idempotent migration змінить type та обережно прибере parentEpic-зв’язки після окремої перевірки.',
      },
      {
        id: 'restore-epic',
        title: 'Повернути Епік',
        description: 'Епік знову стає повноцінним типом у create/edit/filter і потребує чіткого продуктового сценарію.',
      },
    ],
  },
  {
    id: 'task-hierarchy',
    title: 'Задача, підзадача й чекліст',
    question: 'Що є справжньою підзадачею, а що лишається lightweight-кроком?',
    current: 'Підзадача — повноцінний issue з parentIssueId; checkbox живе тільки в Markdown-описі.',
    preview: 'hierarchy',
    choices: [
      {
        id: 'real-child-issues',
        title: 'Повноцінні підзадачі',
        description: 'Батьківська задача агрегує прогрес, а кожна підзадача має власний ключ, статус, час і виконавців.',
        recommended: true,
      },
      {
        id: 'checklist-array',
        title: 'Окремий масив чекліста',
        description: 'Швидко, але дублює Markdown-checkbox і знову створює два різні чеклісти.',
      },
      {
        id: 'links-as-hierarchy',
        title: 'Ієрархія через зв’язки',
        description: 'Гнучко, але напрямок, цикли й аналітика стають неоднозначними для користувача.',
      },
    ],
  },
];

function MiniTask({ showProject = false, legacy = false }) {
  return (
    <div className="rounded-[10px] border border-line bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-ink">Підготувати реліз</span>
        {legacy && <StatusPill label="Епік · legacy" color="#8b5cf6" size="sm" />}
      </div>
      {showProject && (
        <div className="mt-2 flex items-center gap-1 text-[9px] font-semibold text-muted">
          <Folder size={10} /> QuickTeam
        </div>
      )}
    </div>
  );
}

function QuestionPreview({ type, choiceId }) {
  if (type === 'hidden-kanban') {
    const projectHidden = choiceId !== 'hidden-lane-everywhere';
    const myHidden = choiceId === 'hide-everywhere';
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ['Проєкт', projectHidden],
          ['Мої завдання', myHidden],
        ].map(([label, fullyHidden]) => (
          <div key={label} className="rounded-[12px] bg-canvas p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold text-muted">
              <Kanban size={12} /> {label}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {['До виконання', 'У роботі', fullyHidden ? null : 'Приховані'].map((column, index) => column ? (
                <div key={column} className="rounded-[8px] bg-white p-2">
                  <div className="truncate text-[8px] font-bold uppercase text-muted">{column}</div>
                  <div className="mt-2 h-7 rounded-[6px] bg-canvas" />
                </div>
              ) : (
                <div key={index} className="grid place-items-center rounded-[8px] border border-dashed border-line text-faint">
                  <EyeOff size={14} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'hidden-list') {
    const showProject = choiceId === 'show-both-lists' || choiceId === 'keep-context-list';
    const showMy = choiceId === 'show-both-lists';
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ['Проєкт', showProject],
          ['Мої завдання', showMy],
        ].map(([label, showHidden]) => (
          <div key={label} className="rounded-[12px] bg-canvas p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold text-muted">
              <List size={12} /> {label}
            </div>
            <MiniTask />
            <div className="mt-2 flex items-center gap-1.5 text-[9px] font-semibold text-muted">
              {showHidden ? <Eye size={11} /> : <EyeOff size={11} />}
              Hidden status: {showHidden ? 'видимий' : 'відфільтрований'}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'create') {
    const projectMode = choiceId === 'full-form-everywhere' ? 'Повна форма' : 'Inline title';
    const myMode = choiceId === 'inline-everywhere' ? 'Inline + проєкт' : 'Повна форма';
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[['Проєкт', projectMode], ['Мої завдання', myMode]].map(([label, mode]) => (
          <div key={label} className="rounded-[12px] bg-canvas p-3">
            <div className="flex items-center justify-between text-[10px] font-bold text-muted">
              <span>{label}</span>
              <Plus size={13} />
            </div>
            <div className="mt-3 rounded-[9px] bg-white px-3 py-2 text-[10px] font-semibold text-ink">{mode}</div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'project') {
    const showProject = choiceId === 'show-project-everywhere';
    const showMy = choiceId !== 'hide-project-everywhere';
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[12px] bg-canvas p-3">
          <div className="mb-2 text-[10px] font-bold text-muted">Проєкт</div>
          <MiniTask showProject={showProject} />
        </div>
        <div className="rounded-[12px] bg-canvas p-3">
          <div className="mb-2 text-[10px] font-bold text-muted">Мої завдання</div>
          <MiniTask showProject={showMy} />
        </div>
      </div>
    );
  }

  if (type === 'hierarchy') {
    return (
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)]">
        <div className="rounded-[10px] border border-line bg-white p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted">
            <GitBranch size={12} /> QUI-42 · Основна задача
          </div>
          <div className="mt-2 text-[11px] font-semibold text-ink">Підготувати реліз</div>
          <div className="mt-2 text-[9px] text-muted">1/2 підзадач · без подвійного рахунку</div>
        </div>
        <div className="grid place-items-center text-muted">→</div>
        <div className="rounded-[10px] bg-canvas p-3">
          <div className="text-[9px] font-semibold text-muted">QUI-43 · Підзадача</div>
          <div className="mt-1 text-[11px] font-semibold text-ink">Перевірити міграцію</div>
          <div className="mt-2 text-[9px] text-muted">Власний статус, час і виконавець</div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <MiniTask legacy={choiceId === 'legacy-read-only'} />
      <MiniTask />
      <div className="grid place-items-center rounded-[10px] bg-canvas p-3 text-center text-[10px] font-semibold text-muted">
        {choiceId === 'migrate-to-feature'
          ? 'Епік → Фіча'
          : choiceId === 'restore-epic'
            ? 'Епік активний'
            : 'Новий Епік недоступний'}
      </div>
    </div>
  );
}

export default function FidelityFollowUpSurvey() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const question = QUESTIONS[currentIndex];
  const selectedId = APPROVED_ANSWERS[question.id];
  const selectedChoice = question.choices.find(choice => choice.id === selectedId);
  const answeredCount = QUESTIONS.length;

  const copySummary = async () => {
    const summary = QUESTIONS.map((item, index) => {
      const choice = item.choices.find(candidate => candidate.id === APPROVED_ANSWERS[item.id]);
      return `${index + 1}. ${item.title}: ${choice?.title}`;
    }).join('\n');
    await navigator.clipboard.writeText(`UI Kit follow-up decisions\n\n${summary}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col gap-5">
      <Surface preset="bordered-panel" padding="lg">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div className="max-w-[760px]">
            <div className="flex items-center gap-2">
              <ScanSearch size={18} />
              <h2 className="text-[18px] font-bold text-ink">Затверджені follow-up рішення</h2>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              П’ять контекстних відмінностей затверджені та закріплені у shared-компонентах і
              робочих екранах. Цей запис read-only: він показує чинний контракт, а не нове опитування.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-[10px] bg-white px-3 py-2">
            <Counter value={answeredCount} size="sm" />
            <span className="text-[11px] font-bold text-ink">з {QUESTIONS.length} затверджено</span>
          </div>
        </div>
      </Surface>

      <div className="flex flex-wrap gap-1.5">
        {QUESTIONS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setCurrentIndex(index)}
            aria-label={`Питання ${index + 1}: ${item.title}`}
            className={`grid h-8 w-8 place-items-center rounded-[9px] text-[11px] font-bold ${
              index === currentIndex
                ? 'bg-ink text-white'
                : 'bg-[#ecfdf5] text-[#047857]'
            }`}
          >
            {index !== currentIndex ? <Check size={13} /> : index + 1}
          </button>
        ))}
      </div>

      <section className="rounded-[16px] border border-line bg-white p-5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
          Питання {currentIndex + 1} з {QUESTIONS.length}
        </div>
        <h3 className="mt-1 text-[18px] font-bold text-ink">{question.title}</h3>
        <p className="mt-2 text-[13px] font-semibold text-ink">{question.question}</p>
        <p className="mt-1 text-[11px] text-muted">До рішення: {question.current}</p>

        <div className="mt-4 rounded-[14px] bg-canvas p-4">
          <QuestionPreview type={question.preview} choiceId={selectedId} />
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-[12px] border border-ink bg-canvas p-3 ring-4 ring-ink/5">
          <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border border-ink bg-ink text-white">
            <Check size={10} strokeWidth={3} />
          </span>
          <span>
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] font-bold text-ink">{selectedChoice.title}</span>
              <span className="rounded-[6px] bg-[#ecfdf5] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#047857]">
                Затверджено
              </span>
            </span>
            <span className="mt-1 block text-[10px] leading-relaxed text-muted">{selectedChoice.description}</span>
          </span>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button
            style="secondary"
            size="md"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex(index => Math.max(0, index - 1))}
          >
            Назад
          </Button>
          <Button
            style="secondary"
            size="md"
            disabled={currentIndex === QUESTIONS.length - 1}
            onClick={() => setCurrentIndex(index => Math.min(QUESTIONS.length - 1, index + 1))}
          >
            Далі
          </Button>
        </div>
        <Button style="primary" size="md" icon={copied ? Check : Copy} onClick={copySummary}>
          {copied ? 'Скопійовано' : 'Скопіювати рішення'}
        </Button>
      </div>
    </div>
  );
}
