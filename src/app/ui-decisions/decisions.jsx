'use client';

// The fourteen decisions left in the surfaces pass, each rendered twice: the
// markup the product draws today, copied verbatim from the file it lives in,
// and the kit component that would replace it.
//
// Both halves are real. The "now" column is not a drawing of the current look —
// it is the current look, the same JSX with the same class strings. The "after"
// column is the actual kit component, not an impression of one. A survey about
// appearance is worth nothing if either side is approximated.
//
// This page is temporary. When the decisions are made it goes, along with its
// route and the two guard exceptions that let it exist.

import { useState } from 'react';
import {
  IconAction, Input, Textarea, Pill, OptionCard, TextAction, UserAvatar, TitleInput,
} from '@/components/ui';
import {
  ArrowRight, CalendarClock, ChevronRight, Clock, Download, FileText,
  MoreVertical, PanelLeftClose, Play, Plus, QrCode, Users, X,
} from 'lucide-react';

const DEMO_USER = { id: 'kit-arthur', name: 'Артур Моспан', email: 'arthur@quickteam.app' };

// ── Context frames ──────────────────────────────────────────────────────────
// A slice of the screen the element sits on, so the question is not "do you
// like this button" but "do you like this button there".

function Frame({ label, tone = 'canvas', children }) {
  const background = {
    canvas: 'bg-canvas',
    white: 'bg-white',
    dark: 'bg-[#1f1f1f]',
    brand: 'bg-[#3d2a63]',
  }[tone];
  return (
    <div className="overflow-hidden rounded-[12px] border border-line">
      <div className="border-b border-line bg-canvas px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-faint">
        {label}
      </div>
      <div className={`${background} p-4`}>{children}</div>
    </div>
  );
}

// A photograph of the live screen with the element ringed on it. Taken from
// production, so this is not a reconstruction of where the thing sits — it is
// where the thing sits. The frames built out of components below still earn
// their place: they show the element large enough to judge, which a 1680px
// screenshot cannot.
function Shot({ src, alt, note }) {
  return (
    <figure className="m-0 overflow-hidden rounded-[12px] border border-line">
      <div className="border-b border-line bg-canvas px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-faint">
        {alt}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- a fixed local
          screenshot on a dev-only page; next/image would add a loader and a
          build step for a file that ships and dies with this page. */}
      <img src={src} alt={alt} className="block w-full" loading="lazy" />
      {note && (
        <figcaption className="border-t border-line bg-canvas px-3 py-1.5 text-[11px] text-muted">
          {note}
        </figcaption>
      )}
    </figure>
  );
}

// The element under discussion, ringed inside its context.
function Spot({ children }) {
  return (
    <span className="relative inline-flex rounded-[10px] outline-2 outline-offset-[3px] outline-dashed outline-[#ef4444]">
      {children}
    </span>
  );
}

function SidebarStrip({ children, tone }) {
  return (
    <Frame label={tone === 'brand' ? 'бічна панель · брендована тема' : 'бічна панель · типова тема'} tone={tone}>
      <div className="flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-white/10 text-[13px] font-bold text-white">Q</span>
        <span className="text-[14px] font-bold text-white">QuickTeam</span>
        <span className="ml-auto">{children}</span>
      </div>
      <div className="mt-4 flex flex-col gap-1.5">
        {['Проєкти', 'Мої завдання', 'Календар'].map(item => (
          <span key={item} className="rounded-[8px] px-2 py-1.5 text-[13px] text-white/55">{item}</span>
        ))}
      </div>
    </Frame>
  );
}

// ── The decisions ───────────────────────────────────────────────────────────

export function useDecisions() {
  const [role, setRole] = useState('member');
  const [eventType, setEventType] = useState('meeting');

  return [
    {
      id: 'fields',
      title: 'Поля вводу з власною рамкою',
      count: 4,
      where: 'ai-call/page.js:275, :280, :302 · workspace/AgileBoard.jsx:30',
      why: 'Білі поля з рамкою і 8px радіусом. Поле кіту — сіре, без видимої рамки: воно втоплене у фон, а не вирізане з нього.',
      shot: <Shot src="/ui-decisions/aicall.jpeg" alt="екран «Дзвінок → задачі» · продакшн" note="Обведено поле транскрипту й зону завантаження — обидва білі з рамкою." />,
      context: (
        <Frame label="екран «Дзвінок → задачі» · картка чернетки" tone="canvas">
          <div className="rounded-[12px] border border-line bg-white p-4">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">Задача 1 з 4</p>
            <Spot>
              <input
                readOnly
                value="Полагодити експорт у CSV"
                className="w-full rounded-[8px] border border-transparent bg-white px-3 py-2 text-[13px] font-medium text-ink ring-1 ring-line outline-none"
              />
            </Spot>
            <textarea
              readOnly
              value="Ламається на кириличних назвах колонок."
              className="mt-2 w-full resize-y rounded-[8px] border border-line bg-white px-3 py-2 text-[12px] text-muted outline-none"
              rows={2}
            />
          </div>
        </Frame>
      ),
      now: (
        <>
          <input readOnly value="Полагодити експорт у CSV" className="w-full rounded-[8px] border border-line bg-white px-3 py-2 text-[13px] outline-none" />
          <textarea readOnly value="Ламається на кириличних…" rows={2} className="w-full resize-y rounded-[8px] border border-line bg-white px-3 py-2 text-[13px] outline-none" />
        </>
      ),
      after: (
        <>
          <Input defaultValue="Полагодити експорт у CSV" readOnly />
          <Textarea defaultValue="Ламається на кириличних…" rows={2} readOnly />
        </>
      ),
      options: [
        { kind: 'adopt', title: 'Узяти поле кіту', note: 'Поля виглядають як усюди на сайті.' },
        { kind: 'build', title: 'Додати «рамковий» вигляд у кіт', note: 'Якщо біле з рамкою — свідомий вибір саме для цих форм.' },
        { kind: 'keep', title: 'Лишити як є', note: 'Ці екрани й далі малюють свої поля.' },
      ],
    },

    {
      id: 'inline',
      title: 'Прозорі поля, що редагують текст на місці',
      count: 2,
      where: 'AudioTaskPanel.jsx:217, :222',
      why: 'Назва й опис чернетки: текст виглядає як текст, доки в нього не клацнеш. Коробки немає ніколи.',
      context: (
        <Frame label="панель аудіо-задач · рядок чернетки" tone="canvas">
          <div className="flex items-start gap-3 rounded-[12px] border border-line bg-white p-3">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border border-faint text-[11px]">✓</span>
            <div className="min-w-0 flex-1">
              <Spot>
                <input readOnly value="Полагодити експорт у CSV" className="w-full bg-transparent text-[13px] font-bold text-ink outline-none" />
              </Spot>
              <textarea readOnly rows={2} value="Ламається на кириличних назвах колонок." className="mt-1 w-full resize-none bg-transparent text-[12px] leading-5 text-muted outline-none" />
            </div>
          </div>
        </Frame>
      ),
      now: (
        <>
          <input readOnly value="Полагодити експорт у CSV" className="w-full bg-transparent text-[13px] font-bold text-ink outline-none" />
          <textarea readOnly rows={2} value="Ламається на кириличних…" className="w-full resize-none bg-transparent text-[12px] leading-5 text-muted outline-none" />
          <p className="font-mono text-[10px] text-faint">коробки немає ніколи</p>
        </>
      ),
      after: (
        <>
          <TitleInput readOnly value="Полагодити експорт у CSV" className="!text-[13px]" />
          <p className="font-mono text-[10px] text-faint">варіант A — TitleInput, риска у фокусі</p>
          <Input defaultValue="Полагодити експорт у CSV" readOnly />
          <p className="font-mono text-[10px] text-faint">варіант B — звичайне поле кіту</p>
        </>
      ),
      options: [
        { kind: 'build', title: 'Варіант A — розширити TitleInput', note: 'Один компонент «текст, що редагується» на всі розміри.' },
        { kind: 'adopt', title: 'Варіант B — звичайне поле кіту', note: 'Зʼявляться коробки там, де зараз їх немає.' },
        { kind: 'keep', title: 'Лишити як є', note: 'Панель і далі малює свої два поля.' },
      ],
    },

    {
      id: 'sidebar',
      title: 'Контроли бічної панелі й мобільної навігації',
      count: 8,
      where: 'WorkspaceSidebar.jsx:234, :247, :298, :374 · MobileNav.jsx:178, :223, :232, :263',
      why: 'Беруть колір із теми бренду організації. Кіт таких кольорів не знає — його іконки завжди сірі, тож на брендованій панелі випадуть із теми.',
      shot: <Shot src="/ui-decisions/chat.jpeg" alt="екран «Чат» · продакшн" note="Обведено кнопку згортання панелі ліворуч угорі та чип статусу праворуч." />,
      context: (
        <SidebarStrip tone="brand">
          <Spot>
            <button type="button" className="p-1 text-white/55 transition-colors hover:text-white">
              <PanelLeftClose size={20} />
            </button>
          </Spot>
        </SidebarStrip>
      ),
      now: (
        <div className="flex items-center gap-4 rounded-[10px] bg-[#3d2a63] p-3">
          <button type="button" className="p-1 text-white/55"><PanelLeftClose size={20} /></button>
          <button type="button" className="p-1 text-white/55"><Plus size={16} /></button>
          <button type="button" className="p-1 text-white/55"><Users size={18} /></button>
        </div>
      ),
      after: (
        <div className="flex items-center gap-4 rounded-[10px] bg-[#3d2a63] p-3">
          <IconAction label="Сховати панель" icon={PanelLeftClose} size="sm" appearance="quiet" />
          <IconAction label="Новий проєкт" icon={Plus} size="sm" appearance="quiet" />
          <IconAction label="Команда" icon={Users} size="sm" appearance="quiet" />
        </div>
      ),
      afterNote: 'Сірий кіту не тримає бренд — тому варіант «навчити IconAction теми».',
      options: [
        { kind: 'build', title: 'Навчити IconAction теми панелі', note: 'Новий вигляд, що успадковує колір бренду.' },
        { kind: 'keep', title: 'Лишити як хром панелі', note: 'Тема бренду — окрема система, і це нормально.' },
      ],
    },

    {
      id: 'rowbuttons',
      title: 'Рядки на всю ширину, які є кнопкою',
      count: 5,
      where: 'SearchModal.jsx:76 · profile/ProfileView.jsx:354 · WorkloadTab.jsx:204 · qtplus/cards/NoteCard.jsx:6 · CalendarEventPage.jsx:1166',
      why: 'Однакова роль — три різні радіуси й два різні фони. Поруч це видно одразу, на різних екранах — ні.',
      context: (
        <Frame label="модалка пошуку · список результатів" tone="white">
          <div className="flex flex-col gap-1.5">
            <Spot>
              <button type="button" className="flex w-full items-center justify-between rounded-[12px] px-4 py-2.5 text-left transition-colors hover:bg-canvas">
                <span className="text-[13px] font-medium text-ink">QT-104 · Зворотний звʼязок</span>
                <ChevronRight size={14} className="text-faint" />
              </button>
            </Spot>
            <button type="button" className="flex w-full items-center justify-between rounded-[12px] px-4 py-2.5 text-left hover:bg-canvas">
              <span className="text-[13px] font-medium text-ink">QT-118 · Експорт у CSV</span>
              <ChevronRight size={14} className="text-faint" />
            </button>
          </div>
        </Frame>
      ),
      now: (
        <>
          <div className="flex items-center gap-2 rounded-[12px] border border-line bg-white px-3 py-2.5 text-[13px]">Результат пошуку <span className="ml-auto font-mono text-[11px] text-muted">12px</span></div>
          <div className="flex items-center gap-2 rounded-[14px] border border-line bg-white px-3 py-2.5 text-[13px]">Подія в профілі <span className="ml-auto font-mono text-[11px] text-muted">14px</span></div>
          <div className="flex items-center gap-2 rounded-[16px] bg-canvas px-3 py-2.5 text-[13px]">Рядок навантаження <span className="ml-auto font-mono text-[11px] text-muted">16px</span></div>
        </>
      ),
      after: (
        <>
          {['Результат пошуку', 'Подія в профілі', 'Рядок навантаження'].map(label => (
            <div key={label} className="flex items-center gap-2 rounded-[12px] border border-line bg-white px-3 py-2.5 text-[13px]">
              {label}<span className="ml-auto font-mono text-[11px] text-muted">12px</span>
            </div>
          ))}
        </>
      ),
      afterNote: 'Компонента ще немає — це те, як він виглядав би.',
      options: [
        { kind: 'build', title: 'Зробити компонент «рядок-кнопка»', note: 'Найбільша разова уніфікація з тих, що лишились.' },
        { kind: 'keep', title: 'Лишити як є', note: 'Кожен екран сам вирішує, як виглядає його рядок.' },
      ],
    },

    {
      id: 'tiles',
      title: 'Плитки вибору',
      count: 4,
      where: 'CalendarEventDialog.jsx:279 · OrgSwitcherScreen.jsx:27 · TimesheetTab.jsx:300 · WorkloadTab.jsx:612',
      why: 'Тип події, організація, тиждень, учасник — «плитка, яку обирають». У кіті вже є OptionCard, але він горизонтальний.',
      shot: <Shot src="/ui-decisions/invite.jpeg" alt="Команда → Запросити учасника · продакшн" note="Обведено картку вибору ролі — вона вже з кіту, питання про решту плиток." />,
      context: (
        <Frame label="діалог створення події · вибір типу" tone="white">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">Тип події</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'meeting', label: 'Зустріч', icon: Users },
              { id: 'deadline', label: 'Дедлайн', icon: Clock },
              { id: 'reminder', label: 'Нагадування', icon: CalendarClock },
            ].map(item => {
              const Icon = item.icon;
              const active = eventType === item.id;
              const tile = (
                <button
                  type="button"
                  onClick={() => setEventType(item.id)}
                  className={`flex min-h-[62px] w-full flex-col items-center justify-center gap-1 rounded-[12px] border-2 p-2 text-[12px] font-bold transition-colors ${active ? 'border-ink bg-canvas text-ink' : 'border-line bg-white text-muted hover:bg-canvas'}`}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
              return item.id === 'meeting' ? <Spot key={item.id}>{tile}</Spot> : <span key={item.id}>{tile}</span>;
            })}
          </div>
        </Frame>
      ),
      now: (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-[12px] border-2 border-ink bg-canvas p-2 text-[12px] font-bold"><Users size={16} />Зустріч</button>
          <button type="button" className="flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-[12px] border-2 border-line bg-white p-2 text-[12px] font-bold text-muted"><Clock size={16} />Дедлайн</button>
        </div>
      ),
      after: (
        <div className="flex flex-col gap-2">
          <OptionCard
            icon={Users}
            title="Зустріч"
            description="Подія з учасниками та нагадуванням."
            selected={role === 'member'}
            onClick={() => setRole('member')}
          />
          <p className="font-mono text-[10px] text-faint">OptionCard як він є — горизонтальний, 16px</p>
        </div>
      ),
      options: [
        { kind: 'build', title: 'Дати OptionCard вертикальний вигляд', note: 'Один компонент вибору на всі випадки, дві розкладки.' },
        { kind: 'keep', title: 'Лишити як є', note: 'Плитки лишаються власними для кожного екрана.' },
      ],
    },

    {
      id: 'calendargrid',
      title: 'Сітка календаря',
      count: 5,
      where: 'calendar/page.js:119, :142, :238, :301, :310',
      why: 'Чип події, чип дедлайну, порожній слот, кружечок числа дня, плюс під курсором. Власна мова календаря — у кіті таких форм немає взагалі.',
      shot: <Shot src="/ui-decisions/calendar.jpeg" alt="екран «Календар» · місяць · продакшн" note="Обведено кружечок числа дня і плюс, що зʼявляється під курсором." />,
      context: (
        <Frame label="календар · тиждень" tone="white">
          <div className="grid grid-cols-3 gap-2">
            {['ПН 14', 'ВТ 15', 'СР 16'].map((day, index) => (
              <div key={day} className="min-h-[112px] rounded-[10px] border border-line p-2">
                <div className="mb-2 flex items-center justify-between">
                  <span className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold ${index === 0 ? 'bg-ink text-white' : 'text-ink'}`}>
                    {day.split(' ')[1]}
                  </span>
                  {index === 0 && (
                    <Spot>
                      <button type="button" className="grid h-6 w-6 place-items-center rounded-[7px] text-muted hover:bg-canvas"><Plus size={13} /></button>
                    </Spot>
                  )}
                </div>
                {index === 0 && (
                  <div className="rounded-[8px] border border-line border-l-[3px] border-l-[#ef4444] bg-white px-2 py-1 text-[11px] font-semibold">
                    10:00 Планерка
                  </div>
                )}
                {index === 1 && <div className="border-t border-[#ededed] px-1 py-1.5 text-[11px] text-faint">Створити о 14:00</div>}
              </div>
            ))}
          </div>
        </Frame>
      ),
      now: (
        <>
          <div className="rounded-[8px] border border-line border-l-[3px] border-l-[#ef4444] bg-white px-2 py-1 text-[11px] font-semibold">10:00 Планерка команди</div>
          <div className="flex items-center gap-3">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-[11px] font-bold text-white">14</span>
            <span className="border-t border-[#ededed] px-1 py-1.5 text-[11px] text-faint">Створити подію о 14:00</span>
          </div>
        </>
      ),
      after: null,
      afterNote: 'У кіті нічого схожого немає — компоненти треба створювати з нуля.',
      options: [
        { kind: 'build', title: 'Зробити компоненти календаря', note: 'Чип події, комірка дня, слот часу — у кіт, із превʼю. Найбільша нова робота.' },
        { kind: 'keep', title: 'Лишити календарю власну мову', note: 'Календар — окрема структура, як чат колись був.' },
      ],
    },

    {
      id: 'eventattrs',
      title: 'Смуга атрибутів події',
      count: 3,
      where: 'CalendarEventPage.jsx:889, :973, :1040',
      why: 'Задача вже бере AttributeTrigger із кіту; подія малює свої тригери руками. Виглядає однаково — різниця лише в тому, звідки береться.',
      context: (
        <Frame label="сторінка події · смуга атрибутів" tone="white">
          <div className="grid grid-cols-3 gap-1.5 rounded-[12px] bg-canvas p-2">
            {[['Статус', 'Заплановано'], ['Дата', '14 серпня'], ['Учасники', '3 особи']].map(([label, value], index) => {
              const cell = (
                <div className="flex flex-col gap-1 rounded-[10px] px-2 py-1.5 transition-colors hover:bg-[#ebebeb]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</span>
                  <span className="text-[13px] font-medium text-ink">{value}</span>
                </div>
              );
              return index === 0 ? <Spot key={label}>{cell}</Spot> : <span key={label}>{cell}</span>;
            })}
          </div>
        </Frame>
      ),
      now: (
        <div className="flex gap-1.5 rounded-[10px] bg-canvas p-1.5">
          <div className="flex-1 rounded-[10px] px-2 py-1.5">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">Статус</span>
            <span className="text-[13px] font-medium">Заплановано</span>
          </div>
        </div>
      ),
      after: (
        <div className="flex gap-1.5 rounded-[10px] bg-canvas p-1.5">
          <div className="flex-1 rounded-[10px] px-2 py-1.5">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">Статус</span>
            <span className="text-[13px] font-medium">В роботі</span>
          </div>
        </div>
      ),
      afterNote: 'Пікселі не рухаються — зникає лише копія коду.',
      options: [
        { kind: 'adopt', title: 'Узяти AttributeTrigger', note: 'Компонент уже є і вже вживається на задачі.' },
        { kind: 'keep', title: 'Лишити як є', note: 'Подія й далі малює свої тригери.' },
      ],
    },

    {
      id: 'textactions',
      title: 'Дрібні текстові кнопки',
      count: 3,
      where: 'calendar/page.js:319 · WorkspaceHeader.jsx:461 · InviteLinkSection.jsx:120',
      why: 'Текст без коробки, що щось робить. У кіті це TextAction — але його найменший розмір не має жирності, а всі три ці кнопки жирні.',
      shot: <Shot src="/ui-decisions/notifications.jpeg" alt="екран «Мої завдання» · панель сповіщень · продакшн" note="Обведено дзвінок і «Очистити прочитані» в підвалі панелі." />,
      context: (
        <Frame label="панель сповіщень · підвал" tone="white">
          <div className="flex items-center justify-between rounded-[10px] border-t border-canvas bg-[#fafafa] px-4 py-2.5">
            <Spot>
              <button type="button" className="text-[11px] font-medium text-muted transition-colors hover:text-[#ef4444]">
                Очистити прочитані (2)
              </button>
            </Spot>
            <span className="text-[10px] text-faint">останні 12</span>
          </div>
        </Frame>
      ),
      now: (
        <div className="flex flex-col items-start gap-2">
          <span className="text-[10px] font-semibold text-muted">ще 3</span>
          <span className="text-[11px] font-medium text-muted">Очистити прочитані (2)</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[11px] font-semibold"><Download size={12} /> Завантажити PNG</span>
        </div>
      ),
      after: (
        <div className="flex flex-col items-start gap-2">
          <TextAction tone="muted" size="xs">ще 3</TextAction>
          <TextAction tone="muted" size="sm">Очистити прочитані (2)</TextAction>
          <TextAction tone="ink" size="sm" icon={Download}>Завантажити PNG</TextAction>
        </div>
      ),
      afterNote: 'Капсула зникає — TextAction коробки не має.',
      options: [
        { kind: 'build', title: 'Дати TextAction жирний дрібний розмір', note: 'Три виклики — рівно стільки, скільки контракт вимагає.' },
        { kind: 'keep', title: 'Лишити як є', note: 'Три дрібні кнопки лишаються власними.' },
      ],
    },

    {
      id: 'swatches',
      title: 'Вибір кольору в налаштуваннях',
      count: 3,
      where: 'settings/page.js:341, :351, :2359',
      why: 'Кружечок кольору мітки, палітра під ним і вибір теми панелі. Три розміри й три різні способи показати «обрано».',
      shot: <Shot src="/ui-decisions/settings.jpeg" alt="Налаштування → Статуси завдань · продакшн" note="Обведено кружечок кольору статусу — 14px із ring-обведенням." />,
      context: (
        <Frame label="налаштування · мітки" tone="white">
          <div className="flex items-center gap-3 rounded-[10px] border border-line px-3 py-2">
            <Spot>
              <button type="button" className="h-[14px] w-[14px] rounded-full bg-[#ef4444] ring-2 ring-transparent ring-offset-2 transition-all hover:ring-ink/20" />
            </Spot>
            <span className="text-[13px] font-medium text-ink">Терміново</span>
            <span className="ml-auto flex gap-1.5">
              {['#ef4444', '#f97316', '#10b981', '#3b82f6'].map(colour => (
                <span key={colour} className="h-[18px] w-[18px] rounded-full" style={{ background: colour, outline: colour === '#ef4444' ? '2px solid #1f1f1f' : 'none', outlineOffset: 2 }} />
              ))}
            </span>
          </div>
        </Frame>
      ),
      now: (
        <div className="flex items-center gap-5">
          <span className="h-[14px] w-[14px] rounded-full bg-[#ef4444] ring-2 ring-ink/25 ring-offset-2" />
          <span className="h-[18px] w-[18px] rounded-full bg-[#10b981]" style={{ outline: '2px solid #1f1f1f', outlineOffset: 2 }} />
          <span className="h-[30px] w-[44px] rounded-[8px] border-2 border-ink bg-ink" />
        </div>
      ),
      after: (
        <div className="flex items-center gap-3.5">
          {['#ef4444', '#10b981', '#1f1f1f'].map((colour, index) => (
            <span key={colour} className="h-[20px] w-[20px] rounded-full" style={{ background: colour, outline: index === 0 ? '2px solid #1f1f1f' : '2px solid transparent', outlineOffset: 2 }} />
          ))}
        </div>
      ),
      afterNote: 'Компонента ще немає — це те, як він виглядав би: один розмір, один спосіб «обрано».',
      options: [
        { kind: 'build', title: 'Зробити компонент «зразок кольору»', note: 'Один спосіб показати колір і вибір.' },
        { kind: 'keep', title: 'Лишити як є', note: 'Налаштування й далі малюють свої кружечки.' },
      ],
    },

    {
      id: 'iconbuttons',
      title: 'Іконкові кнопки з вільними відступами',
      count: 5,
      where: 'page.js:158 · AudioTaskPanel.jsx:156 · AgileBoard.jsx:259, :349 · qtplus/cards/AudioCard.jsx:97',
      why: 'У кожної свій відступ, тож у сусідніх рядах іконки стоять на різній висоті. IconAction дав би однакову квадратну коробку.',
      shot: <Shot src="/ui-decisions/projects.jpeg" alt="екран «Проєкти» · продакшн" note="Обведено кебаб на картці проєкту — одна з пʼяти кнопок із власним відступом." />,
      context: (
        <Frame label="картка проєкту · верхній ряд" tone="canvas">
          <div className="rounded-[16px] bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex -space-x-2.5">
                <UserAvatar user={DEMO_USER} size="md" stacked />
                <UserAvatar user={{ id: 'o', name: 'Олена Коваль' }} size="md" stacked />
              </div>
              <Spot>
                <button type="button" aria-label="Дії з проєктом" className="rounded-[8px] p-[7px] text-muted transition-all hover:bg-white hover:text-ink">
                  <MoreVertical size={16} />
                </button>
              </Spot>
            </div>
            <p className="mt-3 text-[15px] font-bold text-ink">Design</p>
          </div>
        </Frame>
      ),
      now: (
        <div className="flex items-center gap-3.5 border-b border-dashed border-faint pb-2">
          <button type="button" className="rounded-[8px] p-[7px] text-muted"><MoreVertical size={16} /></button>
          <button type="button" className="rounded-full p-2 text-muted"><X size={15} /></button>
          <button type="button" className="text-muted"><ChevronRight size={16} /></button>
          <button type="button" className="grid h-8 w-8 place-items-center rounded-[8px] bg-canvas text-ink"><Play size={14} /></button>
        </div>
      ),
      after: (
        <div className="flex items-center gap-3.5 border-b border-dashed border-faint pb-2">
          <IconAction label="Дії" icon={MoreVertical} size="sm" appearance="quiet" />
          <IconAction label="Закрити" icon={X} size="sm" appearance="quiet" />
          <IconAction label="Розгорнути" icon={ChevronRight} size="sm" appearance="quiet" />
          <IconAction label="Відтворити" icon={Play} size="sm" appearance="soft" />
        </div>
      ),
      afterNote: 'Пунктир — спільний базис. Зліва центри іконок гуляють, справа стоять рівно.',
      options: [
        { kind: 'adopt', title: 'Узяти IconAction', note: 'Іконки стануть на одну сітку. Дехто зсунеться на 1–3px.' },
        { kind: 'keep', title: 'Лишити як є', note: 'Кожна кнопка тримає свій відступ.' },
      ],
    },

    {
      id: 'statuschips',
      title: 'Кольорові чипи стану',
      count: 3,
      where: 'page.js:144 · settings/page.js:421 · WorkspaceHeader.jsx:110',
      why: 'Три «маленькі кольорові прямокутники з текстом» — рівно те, що робить Pill, тільки клікабельні.',
      context: (
        <Frame label="картка архівного проєкту" tone="canvas">
          <div className="flex items-center justify-between rounded-[16px] bg-white p-4">
            <div>
              <p className="text-[15px] font-bold text-ink">Legacy Portal</p>
              <p className="text-[11px] text-muted">в архіві з 12 травня</p>
            </div>
            <Spot>
              <button type="button" className="flex items-center gap-1 rounded-[8px] bg-[#10b981]/10 px-3 py-1.5 text-[12px] font-bold text-[#10b981] transition-all hover:bg-[#10b981]/20">
                <ArrowRight size={13} /> Розархівувати
              </button>
            </Spot>
          </div>
        </Frame>
      ),
      now: (
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1 rounded-[8px] bg-[#10b981]/10 px-3 py-1.5 text-[12px] font-bold text-[#10b981]">Розархівувати</span>
          <span className="inline-flex rounded-[7px] bg-canvas px-2 py-0.5 text-[10px] font-bold text-muted">Завершальний</span>
          <span className="inline-flex rounded-[7px] bg-ink px-2 py-[3px] text-[9px] font-bold text-white">BETA</span>
        </div>
      ),
      after: (
        <div className="flex flex-wrap items-center gap-2.5">
          <Pill tone="success" size="md">Розархівувати</Pill>
          <Pill tone="neutral" size="md">Завершальний</Pill>
          <Pill tone="dark" size="md">BETA</Pill>
        </div>
      ),
      options: [
        { kind: 'adopt', title: 'Зібрати з Pill і Button', note: 'Кіт уже має обидві частини — треба скласти.' },
        { kind: 'keep', title: 'Лишити як є', note: 'Три чипи лишаються власними.' },
      ],
    },

    {
      id: 'oneoffs',
      title: 'Поодинокі, кожен свій',
      count: 5,
      where: 'InviteLinkSection.jsx:97 · AudioTaskPanel.jsx:209 · CalendarEventPage.jsx:1236 · qtplus/StageStepper.jsx:29 · qtplus/cards/FileCard.jsx:65',
      why: 'Кнопка QR, дрібна галочка чернетки, кнопка в панелі часу, сегмент степера етапів і прозорий шар «клацни будь-де на картці». Спільного між ними нема.',
      context: (
        <Frame label="запрошення · посилання" tone="white">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">Запрошення за посиланням</p>
          <div className="rounded-[10px] bg-canvas px-3 py-2 font-mono text-[11px] text-muted">quickteam.app/invite/8f2a…</div>
          <Spot>
            <button type="button" className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-faint text-[12px] text-muted hover:border-muted hover:text-ink">
              <QrCode size={15} /> Показати QR-код
            </button>
          </Spot>
        </Frame>
      ),
      now: (
        <div className="flex flex-col gap-2.5">
          <span className="flex h-10 items-center justify-center gap-2 rounded-[10px] border border-dashed border-faint text-[12px] text-muted"><QrCode size={15} /> Показати QR-код</span>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="grid h-5 w-5 place-items-center rounded-[6px] border border-faint text-[11px]">✓</span>
            <span className="rounded-[8px] bg-canvas px-2.5 py-1.5 text-[11px] font-bold">Списати час</span>
            <span className="inline-flex min-w-[120px] items-center justify-center gap-1.5 rounded-[10px] border border-ink px-3 py-2 text-[11px] font-bold"><Clock size={13} /> Етап 1</span>
          </div>
          <div className="relative rounded-[12px] border border-line bg-white p-3 text-[12px]">
            <FileText size={14} className="mb-1 text-muted" /> Файл.pdf
            <span className="absolute inset-0 grid place-items-center rounded-[12px] border border-dashed border-faint bg-ink/[0.03] font-mono text-[10px] text-muted">прозорий шар на всю картку</span>
          </div>
        </div>
      ),
      after: null,
      afterNote: 'Кожен доведеться дивитись окремо — я покажу до/після перед кожною зміною.',
      options: [
        { kind: 'build', title: 'Розібрати поштучно', note: 'Я пройду кожен і покажу до/після перед зміною.' },
        { kind: 'keep', title: 'Лишити як є', note: 'Пʼять поодиноких лишаються поза кітом.' },
      ],
    },

    {
      id: 'auth',
      title: 'Екрани входу',
      count: 3,
      where: 'AuthLayout.jsx:46, :67, :84',
      why: 'Login і Onboarding були домовлено поза зоною змін кіту — темне тло, власна логіка. Питання лише в тому, чи домовленість ще чинна.',
      context: (
        <Frame label="екран входу · верхня смуга" tone="dark">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-bold text-white">QuickTeam</span>
            <div className="flex items-center gap-4">
              <Spot>
                <button type="button" className="flex items-center gap-2 text-[13px] text-white/70 transition-colors hover:text-white">
                  <Plus size={15} /> Створити організацію
                </button>
              </Spot>
              <span className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-[#2a2a2a] text-white/70">
                <Users size={15} />
              </span>
            </div>
          </div>
        </Frame>
      ),
      now: (
        <div className="flex items-center gap-4 rounded-[10px] bg-[#1f1f1f] p-3">
          <span className="flex items-center gap-2 text-[13px] text-white/70"><Plus size={15} /> Створити організацію</span>
          <span className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-[#2a2a2a] text-white/70"><Users size={15} /></span>
        </div>
      ),
      after: null,
      afterNote: 'Щоб завести вхід у кіт, кіту потрібен темний контекст — це помітна окрема робота.',
      options: [
        { kind: 'keep', title: 'Лишити поза зоною', note: 'Як домовлялись — вхід живе окремо.' },
        { kind: 'adopt', title: 'Завести і їх у кіт', note: 'Тоді кіту потрібен темний контекст.' },
      ],
    },

    {
      id: 'status',
      title: 'Віджет статусу користувача',
      count: 3,
      where: 'UserStatusSetter.jsx:49, :85, :101',
      why: 'Технічна пастка, а не смак. Цей файл — єдиний, хто вживає три оголошені варіанти кіту. Обхід продукту не заходить у кіт, тож після переносу звіт заявив би, що варіанти мертві, поки продукт малює їх щодня.',
      shot: <Shot src="/ui-decisions/chat.jpeg" alt="екран «Чат» · продакшн" note="Обведено чип статусу праворуч у хедері." />,
      context: (
        <Frame label="хедер чату · правий край" tone="white">
          <div className="flex items-center justify-end gap-2">
            <Spot>
              <button type="button" className="flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1.5 transition-colors hover:bg-[#efefef]">
                <span className="text-[12px]">🔴</span>
                <span className="text-[11px] font-bold text-ink">Зайнятий</span>
              </button>
            </Spot>
            <span className="grid h-9 w-9 place-items-center rounded-[10px]"><UserAvatar user={DEMO_USER} size="sm" /></span>
          </div>
        </Frame>
      ),
      now: (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1.5">
          <span className="text-[12px]">🔴</span>
          <span className="text-[11px] font-bold text-ink">Зайнятий</span>
        </span>
      ),
      after: null,
      afterNote: 'Вигляд не змінюється. Змінюється звіт: три варіанти стануть «мертвими», хоча продукт їх малює.',
      options: [
        { kind: 'keep', title: 'Лишити на місці', note: 'Безпечно. Гвард у тестах уже це стереже.' },
        { kind: 'build', title: 'Спершу навчити звіт бачити кіт', note: 'Більша зміна в перевірках, зате пастка зникає назавжди.' },
      ],
    },
  ];
}
