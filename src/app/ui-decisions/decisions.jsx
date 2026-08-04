'use client';

// The 56 hand-written controls, grouped only where the markup actually matches.
//
// The previous version of this file grouped by role and got it wrong: five
// "full-width rows" turned out to be a borderless list row, a bordered white
// card, a vertical note card and a grey read-only field, and the "colour chips"
// group contained a BETA badge that exists nowhere in the product. Answers to a
// survey are worth exactly as much as the survey's accuracy, so the rule here
// is now mechanical:
//
//   Every class string below is a `const`, used twice — once as the element's
//   own className, once as the caption printed under it. They cannot drift
//   apart, because they are the same string. Copy any caption into the file it
//   names and it will match character for character.
//
// Where a class is conditional in the source (`${active ? … : …}`), the caption
// says which branch is drawn. Elements are grouped only when their class
// strings genuinely agree; where the role is shared but the markup is not, the
// group is labelled a policy question and every member is drawn separately.
//
// This page is temporary. When the decisions are made it goes, along with its
// route and the two guard exceptions that let it exist.

import { useState } from 'react';
import {
  IconAction, Input, Textarea, Pill, OptionCard, TextAction, UserAvatar,
  Button, SelectableChip,
} from '@/components/ui';
import {
  ArchiveRestore, ArrowRight, Check, ChevronRight, ChevronsUpDown, Clock, Copy,
  Download, FileText, LogOut, Menu, PanelLeftClose,
  PanelLeftOpen, Play, Plus, QrCode, Settings2, Square, StickyNote, Users, X,
} from 'lucide-react';

const DEMO_USER = { id: 'kit-arthur', name: 'Артур Моспан', email: 'arthur@quickteam.app' };

// ── Frames ──────────────────────────────────────────────────────────────────
// A slice of the screen the element sits on, built from the container's own
// class string, so the question is not "do you like this button" but "do you
// like this button there".

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

// A photograph of the live screen with the element ringed on it.
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

// One real element plus its provenance. `cls` is the same string the child was
// given — the caller passes the const to both, so the label cannot lie.
function Real({ loc, cls, state, children }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 border-b border-dashed border-[#ededed] pb-2 last:border-b-0 last:pb-0">
      <div className="min-w-0">{children}</div>
      <p className="font-mono text-[9px] leading-relaxed text-faint">
        {loc}{state ? ` · ${state}` : ''}
      </p>
      <p className="break-words font-mono text-[9px] leading-relaxed text-[#b4b4b4]">{cls}</p>
    </div>
  );
}

// A kit element in the same slot, so the two columns are read the same way.
function Kit({ note, children }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 border-b border-dashed border-[#ededed] pb-2 last:border-b-0 last:pb-0">
      <div className="min-w-0">{children}</div>
      {note && <p className="font-mono text-[9px] leading-relaxed text-faint">{note}</p>}
    </div>
  );
}

// ── Verbatim class strings ──────────────────────────────────────────────────
// Copied out of the files named beside them. Nothing below rewrites these.

// Fields
const C_BOARD_COMPOSER = 'w-full px-3 py-2 bg-white rounded-[12px] border border-line text-[12px] text-ink placeholder-faint resize-none focus:border-ink focus:ring-1 focus:ring-ink transition-all shadow-sm';

// Shell chrome
const C_SB_COLLAPSE = 'mt-1 transition-colors shrink-0 ml-[8px]';
const C_SB_EXPAND = 'transition-colors';
const C_SB_NEWPROJECT = 'transition-colors';
const C_SB_STOP = 'flex items-center justify-center rounded-[8px] bg-[#ef4444] text-white hover:bg-[#dc2626] transition-colors shrink-0 w-[28px] h-[28px]';
const C_MN_TAB = 'relative flex-1 flex flex-col items-center justify-center gap-[3px] transition-colors active:bg-[var(--sb-active)]';
const C_MN_ORG = 'flex items-center gap-[6px] text-[var(--sb-text)] min-w-0';
const C_MN_CLOSE = 'text-muted p-[6px] -mr-[6px]';
const C_MN_NEW = 'text-[#666666] p-[4px] -mr-[4px]';

// Rows
const C_SEARCH_ROW = 'w-full flex items-center justify-between px-4 py-2.5 hover:bg-canvas transition-colors text-left group';
const C_WORKLOAD_ROW = 'grid w-full gap-4 px-4 py-4 text-left transition-colors hover:bg-canvas/70 sm:px-5 lg:grid-cols-[minmax(230px,1.4fr)_minmax(220px,1.2fr)_80px_80px_90px_115px] lg:items-center';
const C_PROFILE_ROW = 'flex w-full items-center gap-3 rounded-[14px] border border-line bg-white p-3 text-left transition-colors hover:bg-canvas';
const C_NOTE_CARD = 'rounded-[12px] border border-line bg-surface text-left flex flex-col overflow-hidden hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-shadow';
const C_EVENT_FIELD = 'w-full rounded-[16px] bg-canvas px-4 py-3 text-left text-[13px] font-medium text-ink transition-colors cursor-pointer hover:bg-[#ebebeb]';

// RSVP
const C_RSVP_TILE = 'flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-[12px] border text-[11px] font-bold transition-all disabled:opacity-50 border-black/[0.06] bg-white text-muted hover:border-black/15 hover:text-ink';
const C_RSVP_PAGE = 'rounded-[8px] px-2.5 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-50 bg-white text-muted hover:text-ink';
const C_RSVP_HEADER = 'rounded-[7px] px-2 py-1 text-[9px] font-bold transition-colors disabled:opacity-50 bg-white text-muted ring-1 ring-black/[0.07] hover:text-ink';

// Calendar
const C_CAL_EVENT = 'w-full text-left rounded-[8px] border-l-[3px] transition-[filter,transform] hover:brightness-[0.98] active:scale-[0.99] px-[7px] py-[5px]';
const C_CAL_DEADLINE = 'w-full text-left rounded-[8px] bg-white border border-line hover:border-[#d4d4d4] transition-colors px-[7px] py-[5px]';
const C_CAL_SLOT = 'absolute left-0 right-0 border-t border-[#ededed] hover:bg-black/[0.015] transition-colors';
const C_CAL_DAY = 'w-7 h-7 rounded-full text-[11px] font-bold bg-ink text-white';
const C_CAL_PLUS = 'w-6 h-6 rounded-[7px] opacity-0 group-hover:opacity-100 hover:bg-canvas flex items-center justify-center text-muted transition-all';
const C_CAL_MORE = 'text-[10px] font-semibold text-muted hover:text-ink pl-1';
const C_ATTR_TRIGGER = 'h-full w-full text-left hover:bg-[#ebebeb]';
const C_TIMESHEET_CELL = 'rounded-[14px] border p-[10px] min-h-[86px] flex flex-col items-start gap-[6px] text-left transition-colors cursor-pointer border-black/[0.05] bg-white hover:border-black/10 hover:shadow-sm';

// Text and chips
const C_CLEAR_READ = 'text-[11px] font-medium text-muted hover:text-red-500 disabled:opacity-40 disabled:hover:text-muted transition-colors';
const C_DOWNLOAD_PNG = 'mt-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-muted transition-colors hover:bg-canvas hover:text-ink';
const C_UNARCHIVE = 'px-[12px] py-[6px] rounded-[8px] bg-[#10b981]/10 text-[#10b981] hover:bg-[#10b981]/20 text-[12px] font-bold transition-all flex items-center gap-[4px] no-nav';
const C_DONE_STATUS = 'shrink-0 flex items-center gap-[4px] text-[10px] font-bold px-[8px] py-[3px] rounded-full transition-colors bg-[#10b981]/12 text-[#10b981]';

// Colour
const C_SWATCH_LABEL = 'w-[14px] h-[14px] rounded-full ring-2 ring-offset-2 ring-transparent hover:ring-ink/20 transition-all';
const C_SWATCH_PALETTE = 'w-[18px] h-[18px] rounded-full transition-transform hover:scale-110';
const C_SWATCH_THEME = 'flex flex-col items-center gap-[6px] group/theme';
const C_SWATCH_THEME_INNER = 'w-[44px] h-[44px] rounded-full transition-all ring-2 ring-ink ring-offset-2';

// Icon buttons
const C_BOARD_COLLAPSE = 'text-muted mb-4';
const C_AUDIO_PLAY = 'w-8 h-8 rounded-[8px] bg-canvas text-ink flex items-center justify-center shrink-0 hover:bg-line transition-colors disabled:opacity-40';

// Tabs
const C_STAGE_TAB = 'flex min-w-[140px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap px-3 pb-2 pt-1 text-[13px] border-b-2 transition-colors border-ink text-ink font-semibold hover:text-ink cursor-pointer';
const C_MEMBER_TAB = 'flex min-w-[150px] flex-1 items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left transition-all bg-white text-ink shadow-[0_1px_4px_rgba(0,0,0,0.08)]';

// One-offs
const C_COPY_LINK = 'mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-[10px] text-[13px] font-bold text-white transition-colors bg-ink hover:bg-ink-hover';
const C_ORG_AVATAR = 'flex flex-col items-center gap-4 transition-all duration-300 group/item w-[160px] group-hover/list:opacity-30 hover:!opacity-100';
const C_FILE_OVERLAY = 'absolute inset-0 cursor-pointer';

// Auth
const C_AUTH_CREATE = 'hidden md:flex items-center gap-2 text-white/70 hover:text-white transition-colors text-[13px] font-medium';
const C_AUTH_AVATAR = 'w-8 h-8 rounded-full bg-[#2a2a2a] border border-white/10 flex items-center justify-center overflow-hidden shrink-0 hover:border-white/30 transition-colors cursor-pointer';
const C_AUTH_LOGOUT = 'w-full flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-red-400 hover:bg-white/5 transition-colors text-left';

// Status
const C_STATUS_PILL = 'flex items-center gap-1.5 mr-1 bg-canvas px-3 py-1.5 rounded-full cursor-pointer hover:bg-[#efefef] transition-colors';
const C_STATUS_PRESET = 'flex items-center gap-[10px] p-[10px] rounded-[12px] hover:bg-canvas transition-all text-left group';
const C_STATUS_EMOJI = 'w-[36px] h-[36px] rounded-full flex items-center justify-center text-[18px] transition-all bg-canvas scale-110 shadow-sm';

// ── The decisions ───────────────────────────────────────────────────────────

export function useDecisions() {
  const [tile, setTile] = useState('yes');

  return [
    // ═══ Поля ════════════════════════════════════════════════════════════
    {
      id: 'board-composer',
      family: 'Поля',
      title: 'Поле «додати завдання» на дошці',
      count: 1,
      where: 'src/components/workspace/AgileBoard.jsx:30',
      why: 'Єдине поле в продукті з тінню. Радіус 12px замість 10px кіту, і у фокусі малює і рамку, і ring — кіт малює лише рамку.',
      context: (
        <Frame label="AgileBoard.jsx:29 · низ колонки" tone="canvas">
          <div className="rounded-[12px] bg-white/60 px-[8px] pb-[8px] pt-2">
            <Spot>
              <textarea readOnly rows={2} placeholder="Назва завдання... (Enter — зберегти)" className={C_BOARD_COMPOSER} />
            </Spot>
          </div>
        </Frame>
      ),
      now: (
        <Real loc="AgileBoard.jsx:30" cls={C_BOARD_COMPOSER}>
          <textarea readOnly rows={2} placeholder="Назва завдання... (Enter — зберегти)" className={C_BOARD_COMPOSER} />
        </Real>
      ),
      after: (
        <Kit note="Textarea кіту — без тіні, радіус 10px, у фокусі лише рамка">
          <Textarea rows={2} placeholder="Назва завдання... (Enter — зберегти)" readOnly />
        </Kit>
      ),
      options: [
        { kind: 'adopt', title: 'Узяти Textarea кіту', note: 'Тінь і ring зникають — поле сяде на сіре тло колонки.' },
        { kind: 'keep', title: 'Лишити як є', note: 'Тінь відділяє поле від картки під ним.' },
      ],
    },

    // ═══ Хром оболонки ═══════════════════════════════════════════════════
    {
      id: 'themed-chrome',
      family: 'Хром оболонки',
      title: 'Контроли, пофарбовані темою організації',
      count: 5,
      where: 'WorkspaceSidebar.jsx:234, :247, :298 · MobileNav.jsx:203, :261',
      why: 'Питання політики, не форми: ці пʼять різні за формою (три голі іконки в панелі, кнопка «Ще» в нижній панелі, назва організації в шторці), спільне в них одне — колір приходить із CSS-змінних теми (--sb-muted, --sb-text, --sb-hover, --sb-active). Кіт таких змінних не читає: його appearance завжди сірий.',
      shot: <Shot src="/ui-decisions/chat.jpeg" alt="екран «Чат» · продакшн" note="Обведено кнопку згортання панелі ліворуч угорі." />,
      context: (
        <Frame label="WorkspaceSidebar.jsx:230 · брендована тема" tone="brand">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-white/10 text-[13px] font-bold text-white">Q</span>
            <span className="text-[14px] font-bold text-white">QuickTeam</span>
            <span className="ml-auto">
              <Spot>
                <button type="button" className={C_SB_COLLAPSE} style={{ color: 'rgba(255,255,255,0.55)' }}>
                  <PanelLeftClose size={20} />
                </button>
              </Spot>
            </span>
          </div>
        </Frame>
      ),
      now: (
        <>
          <Real loc="WorkspaceSidebar.jsx:234" cls={C_SB_COLLAPSE} state="колір із style={{ color: 'var(--sb-muted)' }}">
            <span className="inline-flex rounded-[8px] bg-[#3d2a63] p-2">
              <button type="button" className={C_SB_COLLAPSE} style={{ color: 'rgba(255,255,255,0.55)' }}><PanelLeftClose size={20} /></button>
            </span>
          </Real>
          <Real loc="WorkspaceSidebar.jsx:247" cls={C_SB_EXPAND} state="var(--sb-muted)">
            <span className="inline-flex rounded-[8px] bg-[#3d2a63] p-2">
              <button type="button" className={C_SB_EXPAND} style={{ color: 'rgba(255,255,255,0.55)' }}><PanelLeftOpen size={20} /></button>
            </span>
          </Real>
          <Real loc="WorkspaceSidebar.jsx:298" cls={C_SB_NEWPROJECT} state="var(--sb-muted-header)">
            <span className="inline-flex rounded-[8px] bg-[#3d2a63] p-2">
              <button type="button" className={C_SB_NEWPROJECT} style={{ color: 'rgba(255,255,255,0.55)' }}><Plus size={16} /></button>
            </span>
          </Real>
          <Real loc="MobileNav.jsx:203" cls={C_MN_TAB} state="кнопка «Ще» — не посилання, але носить розкладку вкладки; закритий стан">
            <span className="inline-flex w-[92px] rounded-[8px] bg-[#3d2a63] p-2">
              <button type="button" className={C_MN_TAB} style={{ color: 'rgba(255,255,255,0.55)' }}>
                <Menu size={20} /><span className="text-[10px] font-semibold leading-none">Ще</span>
              </button>
            </span>
          </Real>
          <Real loc="MobileNav.jsx:261" cls={C_MN_ORG} state="var(--sb-text)">
            <span className="inline-flex rounded-[8px] bg-[#3d2a63] p-2">
              <button type="button" className={C_MN_ORG} style={{ color: '#ffffff' }}>
                <span className="truncate text-[15px] font-bold">QuickTeam</span><ChevronsUpDown size={14} className="shrink-0 text-muted" />
              </button>
            </span>
          </Real>
        </>
      ),
      after: (
        <Kit note="IconAction appearance=&quot;quiet&quot; — !text-muted, hover !bg-[#f0f0f0]. На фіолетовому це сірий на фіолетовому.">
          <span className="inline-flex rounded-[8px] bg-[#3d2a63] p-2">
            <IconAction label="Сховати панель" icon={PanelLeftClose} size="sm" appearance="quiet" />
          </span>
        </Kit>
      ),
      afterNote: 'appearance="inverse" (!bg-white/10 !text-white) тримає темне тло, але не читає колір бренду — на світлій темі панелі він так само випаде.',
      options: [
        { kind: 'build', title: 'Навчити IconAction теми панелі', note: 'Новий appearance, що читає --sb-* замість фіксованого сірого.' },
        { kind: 'keep', title: 'Лишити як хром панелі', note: 'Тема бренду — окрема система кольору, і це нормально.' },
      ],
    },

    {
      id: 'sheet-icons',
      family: 'Хром оболонки',
      title: 'Іконки в шапці мобільної шторки «Ще»',
      count: 2,
      where: 'MobileNav.jsx:270, :301',
      why: 'Пара однакових за роллю кнопок в одній шторці, у яких різні і колір, і відступ, і відʼємний зсув: text-muted p-[6px] -mr-[6px] проти text-[#666666] p-[4px] -mr-[4px]. Різниця ні на чому не тримається.',
      context: (
        <Frame label="MobileNav.jsx:258 · шапка шторки" tone="white">
          <div className="flex items-center justify-between rounded-[12px] bg-white px-4 py-3">
            <span className="text-[15px] font-bold text-ink">QuickTeam</span>
            <Spot><button type="button" className={C_MN_CLOSE} aria-label="Закрити"><X size={18} /></button></Spot>
          </div>
        </Frame>
      ),
      now: (
        <>
          <Real loc="MobileNav.jsx:270" cls={C_MN_CLOSE}>
            <button type="button" className={C_MN_CLOSE} aria-label="Закрити"><X size={18} /></button>
          </Real>
          <Real loc="MobileNav.jsx:301" cls={C_MN_NEW} state="назва приходить через title, не aria-label">
            <button type="button" className={C_MN_NEW} title="Новий проєкт"><Plus size={16} /></button>
          </Real>
        </>
      ),
      after: (
        <>
          <Kit note="однакова квадратна коробка, однаковий сірий"><IconAction label="Закрити" icon={X} size="sm" appearance="quiet" /></Kit>
          <Kit note="відʼємні зсуви доведеться лишити на call-site як className"><IconAction label="Новий проєкт" icon={Plus} size="sm" appearance="quiet" /></Kit>
        </>
      ),
      options: [
        { kind: 'adopt', title: 'Узяти IconAction', note: 'Дві кнопки стануть однакові; зсуви лишаються в місці виклику.' },
        { kind: 'keep', title: 'Лишити як є', note: 'Шторка й далі малює свої дві іконки.' },
      ],
    },

    {
      id: 'stop-timer',
      family: 'Хром оболонки',
      title: 'Червона кнопка «зупинити таймер»',
      count: 1,
      where: 'src/components/WorkspaceSidebar.jsx:374',
      why: 'Єдина кнопка в панелі, що не бере колір із теми — вона навмисне червона. У кіту такий вигляд уже є: IconAction appearance="danger" — це рівно ті самі #ef4444 і #dc2626.',
      context: (
        <Frame label="WorkspaceSidebar.jsx:370 · рядок активного таймера" tone="brand">
          <div className="flex items-center gap-2 rounded-[10px] bg-white/10 px-2 py-1.5">
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-white/80">QT-104 · Зворотний звʼязок</span>
            <span className="font-mono text-[12px] tabular-nums text-white">01:24</span>
            <Spot><button type="button" className={C_SB_STOP}><Square size={12} className="fill-current" /></button></Spot>
          </div>
        </Frame>
      ),
      now: (
        <Real loc="WorkspaceSidebar.jsx:374" cls={C_SB_STOP} state="розгорнута панель; згорнута — w-[24px] h-[24px] mt-1">
          <button type="button" className={C_SB_STOP}><Square size={12} className="fill-current" /></button>
        </Real>
      ),
      after: (
        <Kit note='IconAction appearance="danger" — !bg-[#ef4444], hover !bg-[#dc2626]. 30px замість 28px.'>
          <IconAction label="Зупинити та зберегти" icon={Square} size="compact" appearance="danger" />
        </Kit>
      ),
      options: [
        { kind: 'adopt', title: 'Узяти IconAction danger', note: 'Кольори збігаються точно; коробка зросте з 28px до 30px.' },
        { kind: 'keep', title: 'Лишити як є', note: '28px тримає рядок таймера вузьким.' },
      ],
    },

    // ═══ Рядки-кнопки ════════════════════════════════════════════════════
    {
      id: 'list-rows',
      family: 'Рядки-кнопки',
      title: 'Рядок списку з роздільником',
      count: 2,
      where: 'SearchModal.jsx:76 · WorkloadTab.jsx:204',
      why: 'Оці двоє справді однакові за побудовою: без рамки, без радіуса, розділені лінією батьківського divide-y, фон зʼявляється лише під курсором. Різниця тільки в силі підсвітки — bg-canvas проти bg-canvas/70.',
      context: (
        <Frame label="SearchModal.jsx:69 · divide-y divide-[#f0f0f0]" tone="white">
          <div className="divide-y divide-[#f0f0f0]">
            <Spot>
              <button type="button" className={C_SEARCH_ROW}>
                <span className="flex min-w-0 flex-1 items-center gap-3 pr-4">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border border-[#f0f0f0] bg-white shadow-sm"><FileText size={12} className="text-muted" /></span>
                  <code className="shrink-0 text-[11px] font-semibold text-muted">QT-104</code>
                  <span className="truncate text-[13px] font-semibold text-ink">Зворотний звʼязок</span>
                </span>
                <ChevronRight size={14} className="text-faint" />
              </button>
            </Spot>
            <button type="button" className={C_SEARCH_ROW}>
              <span className="flex min-w-0 flex-1 items-center gap-3 pr-4">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border border-[#f0f0f0] bg-white shadow-sm"><FileText size={12} className="text-muted" /></span>
                <code className="shrink-0 text-[11px] font-semibold text-muted">QT-118</code>
                <span className="truncate text-[13px] font-semibold text-ink">Експорт у CSV</span>
              </span>
              <ChevronRight size={14} className="text-faint" />
            </button>
          </div>
        </Frame>
      ),
      now: (
        <>
          <Real loc="SearchModal.jsx:76" cls={C_SEARCH_ROW}>
            <button type="button" className={C_SEARCH_ROW}>
              <span className="truncate text-[13px] font-semibold text-ink">QT-104 · Зворотний звʼязок</span>
              <ChevronRight size={14} className="text-faint" />
            </button>
          </Real>
          <Real loc="WorkloadTab.jsx:204" cls={C_WORKLOAD_ROW}>
            <button type="button" className={C_WORKLOAD_ROW}>
              <span className="flex min-w-0 items-center gap-3">
                <UserAvatar user={DEMO_USER} size="lg" />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-bold text-ink">Артур Моспан</span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted">Дизайнер · 2 год тому</span>
                </span>
              </span>
            </button>
          </Real>
        </>
      ),
      after: null,
      afterNote: 'Компонента «рядок списку» в кіті немає. Він був би тонкий: без рамки, без радіуса, один hover — саме те, що тут уже намальовано двічі.',
      options: [
        { kind: 'build', title: 'Зробити компонент «рядок списку»', note: 'Дві копії — рівно стільки, скільки контракт кіту вимагає для нового компонента.' },
        { kind: 'keep', title: 'Лишити як є', note: 'Два списки — два рядки, і різниця в hover нікому не заважає.' },
      ],
    },

    {
      id: 'profile-row',
      family: 'Рядки-кнопки',
      title: 'Рядок найближчої події в профілі',
      count: 1,
      where: 'src/components/profile/ProfileView.jsx:354',
      why: 'Не рядок списку, а біла картка з рамкою і радіусом 14px, якої в кіту немає: Surface preset="bordered-card" дає 16px і не є кнопкою.',
      context: (
        <Frame label="ProfileView.jsx:350 · найближчі події" tone="canvas">
          <Spot>
            <button type="button" className={C_PROFILE_ROW}>
              <span className="flex h-[46px] w-[46px] shrink-0 flex-col items-center justify-center rounded-[12px] bg-canvas">
                <span className="text-[10px] font-bold uppercase text-muted">серп</span>
                <span className="text-[17px] font-black leading-none text-ink">14</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-ink">Планерка команди</span>
                <span className="mt-0.5 block text-[11px] text-muted">10:00–10:30</span>
              </span>
            </button>
          </Spot>
        </Frame>
      ),
      now: (
        <Real loc="ProfileView.jsx:354" cls={C_PROFILE_ROW}>
          <button type="button" className={C_PROFILE_ROW}>
            <span className="flex h-[46px] w-[46px] shrink-0 flex-col items-center justify-center rounded-[12px] bg-canvas">
              <span className="text-[10px] font-bold uppercase text-muted">серп</span>
              <span className="text-[17px] font-black leading-none text-ink">14</span>
            </span>
            <span className="min-w-0 flex-1 text-[13px] font-bold text-ink">Планерка команди</span>
          </button>
        </Real>
      ),
      after: null,
      afterNote: 'Найближче в кіті — Surface preset="bordered-card": радіус 16px замість 14px і не кнопка, тож hover і фокус довелося б додавати зверху.',
      options: [
        { kind: 'adopt', title: 'Загорнути в Surface кіту', note: 'Радіус зросте 14→16px; кнопковість доведеться лишити на call-site.' },
        { kind: 'keep', title: 'Лишити як є', note: 'Один рядок в одному місці — не привід рухати радіус.' },
      ],
    },

    {
      id: 'note-card',
      family: 'Рядки-кнопки',
      title: 'Картка нотатки в QuickTeam+',
      count: 1,
      where: 'src/components/workspace/qtplus/cards/NoteCard.jsx:6',
      why: 'Вертикальна картка з двома зонами і тінню під курсором — єдиний елемент у продукті, що реагує на наведення тінню, а не фоном. У кіту такого hover немає взагалі.',
      context: (
        <Frame label="NoteCard.jsx:4 · сітка матеріалів" tone="canvas">
          <div className="w-[220px]">
            <Spot>
              <button type="button" className={C_NOTE_CARD}>
                <span className="flex items-center gap-2 border-b border-line px-3 py-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-canvas"><StickyNote size={14} className="text-muted" /></span>
                  <span className="truncate text-[13px] font-medium text-ink">Ідеї до релізу</span>
                </span>
                <span className="block px-3 py-2 text-[12px] text-ink">Перевірити експорт, дописати листа команді…</span>
              </button>
            </Spot>
          </div>
        </Frame>
      ),
      now: (
        <Real loc="NoteCard.jsx:6" cls={C_NOTE_CARD}>
          <button type="button" className={`${C_NOTE_CARD} w-[200px]`}>
            <span className="flex items-center gap-2 border-b border-line px-3 py-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-canvas"><StickyNote size={14} className="text-muted" /></span>
              <span className="truncate text-[13px] font-medium text-ink">Ідеї до релізу</span>
            </span>
            <span className="block px-3 py-2 text-[12px] text-ink">Перевірити експорт…</span>
          </button>
        </Real>
      ),
      after: null,
      afterNote: 'Surface кіту дає ту саму рамку і радіус 12px, але не має ні кнопковості, ні hover-тіні — обидві довелося б лишити на call-site, тобто компонент майже нічого не забирає.',
      options: [
        { kind: 'adopt', title: 'Загорнути в Surface кіту', note: 'Забирає рамку й радіус, лишає hover і кнопковість на місці виклику.' },
        { kind: 'keep', title: 'Лишити як є', note: 'Картка цілісна; розділяти її на Surface + hover нічого не спрощує.' },
      ],
    },

    {
      id: 'event-location',
      family: 'Рядки-кнопки',
      title: 'Місце події у режимі читання',
      count: 1,
      where: 'src/components/workspace/calendar/CalendarEventPage.jsx:1166',
      why: 'Те саме поле, що в режимі редагування вже є Input із кіту, у режимі читання малюється руками: сіре, радіус 16px замість 10px. Клац — і на його місці стає кітове поле іншої форми.',
      context: (
        <Frame label="CalendarEventPage.jsx:1159 · секція «Місце»" tone="white">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">Місце</p>
          <Spot><button type="button" className={C_EVENT_FIELD}>Кімната 3, другий поверх</button></Spot>
        </Frame>
      ),
      now: (
        <Real loc="CalendarEventPage.jsx:1166" cls={C_EVENT_FIELD} state="canManage = true">
          <button type="button" className={C_EVENT_FIELD}>Кімната 3, другий поверх</button>
        </Real>
      ),
      after: (
        <Kit note="Input із :1160 — той самий, що вже стоїть у режимі редагування">
          <Input defaultValue="Кімната 3, другий поверх" readOnly />
        </Kit>
      ),
      afterNote: 'Тут різниця найпомітніша: 16px → 10px і 44px висоти → 36px. Зате читання й редагування перестають стрибати.',
      options: [
        { kind: 'adopt', title: 'Малювати Input у обох станах', note: 'Читання й редагування збігаються; поле помітно зменшиться.' },
        { kind: 'keep', title: 'Лишити як є', note: 'Великий сірий блок краще читається як значення, а не як поле.' },
      ],
    },

    // ═══ Відповідь на запрошення ═════════════════════════════════════════
    {
      id: 'rsvp',
      family: 'Запрошення',
      title: 'Відповідь на запрошення: «Буду / Можливо / Не буду»',
      count: 3,
      where: 'CalendarEventDialog.jsx:279 · CalendarEventPage.jsx:1236 · WorkspaceHeader.jsx:110',
      why: 'Один і той самий контрол у трьох місцях і трьох розмірах: плитка 62px у діалозі, кнопка 8px на сторінці події, чип 7px у сповіщеннях. Обраний стан скрізь один — bg-ink text-white. Це найчистіший випадок дублювання з тих, що лишились.',
      context: (
        <Frame label="CalendarEventDialog.jsx:274 · «Ви приєднаєтесь?»" tone="white">
          <p className="mb-2 text-[12px] font-bold text-ink">Ви приєднаєтесь?</p>
          <div className="grid grid-cols-3 gap-2">
            {[['yes', 'Буду', Check], ['maybe', 'Можливо', Clock], ['no', 'Не буду', X]].map(([id, label, Icon]) => {
              const active = tile === id;
              const node = (
                <button
                  type="button"
                  onClick={() => setTile(id)}
                  className={`flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-[12px] border text-[11px] font-bold transition-all disabled:opacity-50 ${active ? 'border-ink bg-ink text-white' : 'border-black/[0.06] bg-white text-muted hover:border-black/15 hover:text-ink'}`}
                >
                  <Icon size={16} />{label}
                </button>
              );
              return id === 'yes' ? <Spot key={id}>{node}</Spot> : <span key={id}>{node}</span>;
            })}
          </div>
        </Frame>
      ),
      now: (
        <>
          <Real loc="CalendarEventDialog.jsx:279" cls={C_RSVP_TILE} state="необраний стан">
            <span className="grid w-[150px] grid-cols-2 gap-2">
              <button type="button" className={C_RSVP_TILE}><Check size={16} />Буду</button>
              <button type="button" className={C_RSVP_TILE}><X size={16} />Не буду</button>
            </span>
          </Real>
          <Real loc="CalendarEventPage.jsx:1236" cls={C_RSVP_PAGE} state="необраний стан">
            <span className="inline-flex gap-1.5 rounded-[10px] bg-canvas p-1.5">
              <button type="button" className={C_RSVP_PAGE}>Буду</button>
              <button type="button" className={C_RSVP_PAGE}>Не буду</button>
            </span>
          </Real>
          <Real loc="WorkspaceHeader.jsx:110" cls={C_RSVP_HEADER} state="необраний стан, surface='surface'">
            <span className="inline-flex gap-1.5">
              <button type="button" className={C_RSVP_HEADER}>Буду</button>
              <button type="button" className={C_RSVP_HEADER}>Не буду</button>
            </span>
          </Real>
        </>
      ),
      after: (
        <>
          <Kit note="SelectableChip shape=&quot;person&quot; — 8px, 12px тексту, обране = bg-ink">
            <span className="inline-flex gap-1.5">
              <SelectableChip shape="person" selected>Буду</SelectableChip>
              <SelectableChip shape="person">Не буду</SelectableChip>
            </span>
          </Kit>
          <Kit note="OptionCard — якщо плитка в діалозі має лишитись великою">
            <OptionCard icon={Check} title="Буду" description="Ви зʼявитесь на події." selected />
          </Kit>
        </>
      ),
      afterNote: 'SelectableChip уже вміє aria-pressed і обраний стан bg-ink. Чого йому бракує — вертикальної плитки на 62px і розміру 9px для сповіщень.',
      options: [
        { kind: 'build', title: 'Зробити компонент відповіді на запрошення', note: 'Один контрол, три розміри. Найбільша разова уніфікація з тих, що лишились.' },
        { kind: 'adopt', title: 'Узяти SelectableChip у всіх трьох', note: 'Плитка в діалозі стане чипом — діалог помітно зміниться.' },
        { kind: 'keep', title: 'Лишити як є', note: 'Три місця — три розміри, і копія лишається копією.' },
      ],
    },

    // ═══ Календар ════════════════════════════════════════════════════════
    {
      id: 'calendar-grid',
      family: 'Календар',
      title: 'Сітка календаря',
      count: 5,
      where: 'calendar/page.js:119, :142, :238, :301, :310',
      why: 'Чип події, чип дедлайну, годинний слот, кружечок числа дня і плюс під курсором. Власна мова календаря — у кіті таких форм немає взагалі. Годинний слот узагалі не має вигляду: це лінія зверху й підсвітка 1.5% чорного.',
      shot: <Shot src="/ui-decisions/calendar.jpeg" alt="екран «Календар» · місяць · продакшн" note="Обведено кружечок числа дня і плюс, що зʼявляється під курсором." />,
      context: (
        <Frame label="calendar/page.js:294 · комірка місяця" tone="white">
          <div className="grid grid-cols-2 gap-0">
            <div className="group min-h-[128px] border-b border-r border-line bg-white p-[7px]">
              <div className="mb-[6px] flex items-center justify-between">
                <Spot><button type="button" className={C_CAL_DAY}>14</button></Spot>
                <button type="button" className={C_CAL_PLUS} aria-label="Додати подію"><Plus size={13} /></button>
              </div>
              <div className="space-y-[4px]">
                <button type="button" className={C_CAL_EVENT} style={{ backgroundColor: '#eef2ff', borderLeftColor: '#6366f1' }}>
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Clock size={11} style={{ color: '#6366f1' }} className="shrink-0" />
                    <span className="truncate text-[10px] font-bold text-ink">10:00 Планерка</span>
                  </span>
                </button>
                <button type="button" className={C_CAL_DEADLINE}>
                  <span className="truncate text-[10px] font-bold text-ink">Здати макет</span>
                </button>
                <button type="button" className={C_CAL_MORE}>ще 2</button>
              </div>
            </div>
            <div className="min-h-[128px] border-b border-line bg-[#fafafa] p-[7px]" />
          </div>
        </Frame>
      ),
      now: (
        <>
          <Real loc="calendar/page.js:119" cls={C_CAL_EVENT} state="compact; фон і колір лінії — з inline style">
            <button type="button" className={C_CAL_EVENT} style={{ backgroundColor: '#eef2ff', borderLeftColor: '#6366f1' }}>
              <span className="flex min-w-0 items-center gap-1.5">
                <Clock size={11} style={{ color: '#6366f1' }} className="shrink-0" />
                <span className="truncate text-[10px] font-bold text-ink">10:00 Планерка</span>
              </span>
            </button>
          </Real>
          <Real loc="calendar/page.js:142" cls={C_CAL_DEADLINE} state="compact">
            <button type="button" className={C_CAL_DEADLINE}><span className="text-[10px] font-bold text-ink">Здати макет</span></button>
          </Real>
          <Real loc="calendar/page.js:238" cls={C_CAL_SLOT} state="позиція і висота — з inline style; тексту немає, лише aria-label">
            <span className="relative block h-[44px] w-full bg-white">
              <button type="button" className={C_CAL_SLOT} style={{ top: 0, height: 44 }} aria-label="Створити подію о 14:00" />
            </span>
          </Real>
          <Real loc="calendar/page.js:301" cls={C_CAL_DAY} state="сьогодні">
            <button type="button" className={C_CAL_DAY}>14</button>
          </Real>
          <Real loc="calendar/page.js:310" cls={C_CAL_PLUS} state="намальовано видимим; у продукті opacity-0 до наведення на комірку">
            <button type="button" className={`${C_CAL_PLUS} !opacity-100`} aria-label="Додати подію"><Plus size={13} /></button>
          </Real>
        </>
      ),
      after: null,
      afterNote: 'У кіті нічого схожого немає — компоненти треба створювати з нуля. Найближчий родич — IconAction для плюса, і тільки для нього.',
      options: [
        { kind: 'build', title: 'Зробити компоненти календаря', note: 'Чип події, комірка дня, слот часу — у кіт, із превʼю. Найбільша нова робота.' },
        { kind: 'keep', title: 'Лишити календарю власну мову', note: 'Календар — окрема структура, як чат колись був.' },
      ],
    },

    {
      id: 'timesheet-cell',
      family: 'Календар',
      title: 'Комірка дня в табелі',
      count: 1,
      where: 'src/components/workspace/TimesheetTab.jsx:300',
      why: 'Ще одна комірка календаря, але в аналітиці й з іншими числами: радіус 14px проти 10px у самому календарі, чотири стани рамки (поза місяцем, сьогодні, вихідний, звичайний).',
      context: (
        <Frame label="TimesheetTab.jsx:292 · тиждень табеля" tone="canvas">
          <div className="grid grid-cols-3 gap-[10px]">
            <Spot>
              <button type="button" className={C_TIMESHEET_CELL}>
                <span className="text-[12px] font-bold text-ink">14</span>
                <span className="text-[10px] font-medium text-muted">3 завд.</span>
              </button>
            </Spot>
            <button type="button" className={C_TIMESHEET_CELL}><span className="text-[12px] font-bold text-ink">15</span></button>
            <button type="button" className={C_TIMESHEET_CELL}><span className="text-[12px] font-bold text-ink">16</span></button>
          </div>
        </Frame>
      ),
      now: (
        <Real loc="TimesheetTab.jsx:300" cls={C_TIMESHEET_CELL} state="звичайний день у поточному місяці">
          <button type="button" className={`${C_TIMESHEET_CELL} w-[110px]`}>
            <span className="text-[12px] font-bold text-ink">14</span>
            <span className="text-[10px] font-medium text-muted">3 завд.</span>
          </button>
        </Real>
      ),
      after: null,
      afterNote: 'Відповідь тут напряму залежить від попереднього питання: якщо комірка дня стане компонентом кіту, ця має взяти її; якщо ні — лишається як є.',
      options: [
        { kind: 'build', title: 'Узяти майбутню комірку дня', note: 'Разом із рішенням про сітку календаря. Радіус зійде 14→10px.' },
        { kind: 'keep', title: 'Лишити як є', note: 'Табель — не календар, і його комірка може бути більшою.' },
      ],
    },

    {
      id: 'attr-triggers',
      family: 'Календар',
      title: 'Тригери атрибутів події',
      count: 2,
      where: 'CalendarEventPage.jsx:889, :973',
      why: 'Задача вже бере AttributeTrigger із кіту; подія збирає той самий вигляд із локальних змінних attributeItemClass і attributeLabelClass. Пікселі однакові — різниця лише в тому, звідки береться клас.',
      context: (
        <Frame label="CalendarEventPage.jsx:880 · смуга атрибутів" tone="white">
          <div className="grid grid-cols-3 gap-1.5 rounded-[12px] bg-canvas p-2">
            <Spot>
              <button type="button" className={`flex flex-col gap-1 rounded-[10px] px-2 py-1.5 transition-colors ${C_ATTR_TRIGGER}`}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Час події</span>
                <span className="text-[13px] font-medium text-ink">10:00–10:30</span>
              </button>
            </Spot>
            <button type="button" className={`flex flex-col gap-1 rounded-[10px] px-2 py-1.5 transition-colors ${C_ATTR_TRIGGER}`}>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Учасники</span>
              <span className="flex items-center text-[13px] font-medium text-ink"><Users size={13} className="mr-1.5 shrink-0 text-muted" />3 учасників</span>
            </button>
          </div>
        </Frame>
      ),
      now: (
        <>
          <Real loc="CalendarEventPage.jsx:889" cls={`\${attributeItemClass} ${C_ATTR_TRIGGER}`} state="attributeItemClass — локальна константа файлу">
            <button type="button" className={`flex flex-col gap-1 rounded-[10px] bg-canvas px-2 py-1.5 transition-colors ${C_ATTR_TRIGGER}`}>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Час події</span>
              <span className="text-[13px] font-medium text-ink">10:00–10:30</span>
            </button>
          </Real>
          <Real loc="CalendarEventPage.jsx:973" cls={`\${attributeItemClass} ${C_ATTR_TRIGGER}`}>
            <button type="button" className={`flex flex-col gap-1 rounded-[10px] bg-canvas px-2 py-1.5 transition-colors ${C_ATTR_TRIGGER}`}>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Учасники</span>
              <span className="text-[13px] font-medium text-ink">3 учасників</span>
            </button>
          </Real>
        </>
      ),
      after: (
        <Kit note="AttributeTrigger із кіту — той самий, що вже стоїть на сторінці задачі">
          <span className="inline-flex flex-col gap-1 rounded-[10px] bg-canvas px-2 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Час події</span>
            <span className="text-[13px] font-medium text-ink">10:00–10:30</span>
          </span>
        </Kit>
      ),
      afterNote: 'Пікселі не рухаються — зникає лише копія коду.',
      options: [
        { kind: 'adopt', title: 'Узяти AttributeTrigger', note: 'Компонент уже є і вже вживається на задачі.' },
        { kind: 'keep', title: 'Лишити як є', note: 'Подія й далі збирає свої тригери з локальних констант.' },
      ],
    },

    {
      id: 'details-toggle',
      family: 'Календар',
      title: 'Перемикач «Деталі» на сторінці події',
      count: 1,
      where: 'src/components/workspace/calendar/CalendarEventPage.jsx:1040',
      why: 'Не тригер атрибута, попри сусідство: це кнопка-перемикач, чий клас цілком зібраний із локальної detailsButtonClass плюс стан. У звіті вона виглядає як порожній рядок «${…} ${…}» саме тому, що в JSX не лишилось жодного статичного слова.',
      now: (
        <Real loc="CalendarEventPage.jsx:1040" cls="${detailsButtonClass} ${detailsOpen ? 'bg-white text-ink' : 'text-muted'}" state="detailsOpen = false">
          <button type="button" className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[12px] font-semibold text-muted transition-colors hover:bg-[#ebebeb]">
            <Settings2 size={14} /><span>Деталі</span>
          </button>
        </Real>
      ),
      after: (
        <Kit note='Button style="ghost" size="sm" — обраний стан довелося б виражати окремо'>
          <Button style="ghost" size="sm" icon={Settings2}>Деталі</Button>
        </Kit>
      ),
      afterNote: 'Тут головне не вигляд, а те, що клас елемента не видно в JSX узагалі. Навіть якщо лишити вигляд, константу варто розкрити на місці.',
      options: [
        { kind: 'adopt', title: 'Узяти Button кіту', note: 'Перемикання стану доведеться виразити через aria-pressed.' },
        { kind: 'keep', title: 'Лишити як є', note: 'Локальна константа тримає три кнопки сторінки однаковими.' },
      ],
    },

    // ═══ Текстові кнопки ═════════════════════════════════════════════════
    {
      id: 'text-actions',
      family: 'Текстові кнопки',
      title: 'Кнопки без коробки',
      count: 2,
      where: 'calendar/page.js:319 · WorkspaceHeader.jsx:461',
      why: 'Обидві — текст із hover, без фону й рамки, тобто рівно те, чим є TextAction. Але переїзд зачепить обидві по-різному: «ще N» зараз font-semibold на 10px, а розмір xs у кіту 10px без жирності; «Очистити прочитані» зараз font-medium на 11px, а розмір sm у кіту 11px із font-semibold. Одна схудне, друга потовщає.',
      shot: <Shot src="/ui-decisions/notifications.jpeg" alt="панель сповіщень · продакшн" note="Обведено «Очистити прочитані» в підвалі панелі." />,
      context: (
        <Frame label="WorkspaceHeader.jsx:459 · підвал панелі сповіщень" tone="white">
          <div className="flex items-center justify-between border-t border-canvas bg-[#fafafa] px-4 py-[10px]">
            <Spot><button type="button" className={C_CLEAR_READ}>Очистити прочитані (2)</button></Spot>
            <span className="text-[10px] text-faint">останні 12</span>
          </div>
        </Frame>
      ),
      now: (
        <>
          <Real loc="calendar/page.js:319" cls={C_CAL_MORE}>
            <button type="button" className={C_CAL_MORE}>ще 2</button>
          </Real>
          <Real loc="WorkspaceHeader.jsx:461" cls={C_CLEAR_READ}>
            <button type="button" className={C_CLEAR_READ}>Очистити прочитані (2)</button>
          </Real>
        </>
      ),
      after: (
        <>
          <Kit note='TextAction size="xs" — 10px, БЕЗ font-semibold: «ще 2» схудне'>
            <TextAction tone="muted" size="xs">ще 2</TextAction>
          </Kit>
          <Kit note='TextAction size="sm" — 11px font-semibold: «Очистити» потовщає з medium'>
            <TextAction tone="muted" size="sm">Очистити прочитані (2)</TextAction>
          </Kit>
        </>
      ),
      afterNote: 'Червоний hover теж зникає: у кіту він є як tone="danger-quiet", але той бере text-faint у спокої, а тут muted.',
      options: [
        { kind: 'adopt', title: 'Узяти TextAction як є', note: 'Обидві кнопки змінять жирність — у різні боки.' },
        { kind: 'build', title: 'Дати TextAction відсутні поєднання', note: 'Жирний 10px і muted-із-червоним-hover — рівно те, чого бракує.' },
        { kind: 'keep', title: 'Лишити як є', note: 'Дві кнопки лишаються власними.' },
      ],
    },

    {
      id: 'download-png',
      family: 'Текстові кнопки',
      title: '«Завантажити PNG» під QR-кодом',
      count: 1,
      where: 'src/components/InviteLinkSection.jsx:120',
      why: 'Виглядає як текстова кнопка, але має капсулу: rounded-full і фон під курсором. Тип збігається з TextAction size="sm" точно (11px semibold) — не збігається лише коробка, якої в TextAction немає взагалі.',
      shot: <Shot src="/ui-decisions/invite.jpeg" alt="Команда → Запросити учасника · продакшн" note="Обведено кнопку під QR-кодом." />,
      context: (
        <Frame label="InviteLinkSection.jsx:113 · картка QR" tone="canvas">
          <div className="flex flex-col items-center justify-center rounded-[16px] border border-line bg-white p-4">
            <div className="mb-2 flex items-center gap-2 text-[12px] font-bold text-ink"><QrCode size={14} />QR-код</div>
            <div className="grid h-[86px] w-[86px] place-items-center rounded-[8px] bg-canvas text-faint"><QrCode size={40} /></div>
            <Spot><button type="button" className={C_DOWNLOAD_PNG}><Download size={12} />Завантажити PNG</button></Spot>
          </div>
        </Frame>
      ),
      now: (
        <Real loc="InviteLinkSection.jsx:120" cls={C_DOWNLOAD_PNG}>
          <button type="button" className={C_DOWNLOAD_PNG}><Download size={12} />Завантажити PNG</button>
        </Real>
      ),
      after: (
        <Kit note='TextAction size="sm" — тип той самий, капсула зникає'>
          <TextAction tone="muted" size="sm" icon={Download}>Завантажити PNG</TextAction>
        </Kit>
      ),
      options: [
        { kind: 'adopt', title: 'Узяти TextAction', note: 'Капсула і фон під курсором зникають; тип не змінюється.' },
        { kind: 'keep', title: 'Лишити як є', note: 'Капсула відділяє кнопку від QR-коду над нею.' },
      ],
    },

    // ═══ Кольорові чипи ══════════════════════════════════════════════════
    {
      id: 'green-chips',
      family: 'Чипи',
      title: 'Зелені чипи-дії',
      count: 2,
      where: 'src/app/(app)/page.js:144 · settings/page.js:421',
      why: 'Обидва — зелений текст на зеленому з прозорістю, обидва з іконкою, обидва клікабельні. Не збігається все інше: 8px проти rounded-full, /10 проти /12, 12px проти 10px тексту.',
      shot: <Shot src="/ui-decisions/settings.jpeg" alt="Налаштування → Статуси завдань · продакшн" note="Обведено чип «Завершальний» у рядку статусу." />,
      context: (
        <Frame label="app/page.js:142 · картка архівного проєкту" tone="canvas">
          <div className="flex items-center justify-between rounded-[16px] bg-white p-4">
            <div>
              <p className="text-[15px] font-bold text-ink">Legacy Portal</p>
              <p className="text-[11px] text-muted">в архіві з 12 травня</p>
            </div>
            <Spot><button type="button" className={C_UNARCHIVE}><ArchiveRestore size={13} />Розархівувати</button></Spot>
          </div>
        </Frame>
      ),
      now: (
        <>
          <Real loc="app/(app)/page.js:144" cls={C_UNARCHIVE}>
            <button type="button" className={C_UNARCHIVE}><ArchiveRestore size={13} />Розархівувати</button>
          </Real>
          <Real loc="settings/page.js:421" cls={C_DONE_STATUS} state="isDone = true">
            <button type="button" className={C_DONE_STATUS}><Check size={11} />Завершальний</button>
          </Real>
        </>
      ),
      after: (
        <>
          <Kit note="Pill tone=&quot;success&quot; — але Pill не кнопка: клік довелося б лишити на обгортці">
            <Pill tone="success" size="md">Розархівувати</Pill>
          </Kit>
          <Kit note='Button style="ghost" — коробка і висота кіту, зелений довелося б додати як tone'>
            <Button style="ghost" size="sm" icon={ArrowRight}>Розархівувати</Button>
          </Kit>
        </>
      ),
      afterNote: 'Ані Pill, ані Button не покривають випадок цілком: Pill не натискається, Button не має зеленого tone. Тому «зібрати з двох» — це насправді «додати зелений tone у Button».',
      options: [
        { kind: 'build', title: 'Додати Button зелений tone', note: 'Тоді обидва чипи стають Button і різниця зникає.' },
        { kind: 'adopt', title: 'Обгорнути Pill у кнопку', note: 'Вигляд кіту, але контрол складається з двох елементів.' },
        { kind: 'keep', title: 'Лишити як є', note: 'Два зелені чипи лишаються власними.' },
      ],
    },

    {
      id: 'swatches',
      family: 'Чипи',
      title: 'Вибір кольору в налаштуваннях',
      count: 3,
      where: 'settings/page.js:341, :351, :2360',
      why: 'Три круглі зразки кольору, три розміри й три різні способи сказати «обрано»: ring-offset, outline і ще один ring-offset більшого радіуса. У :341 обраного стану немає взагалі — ring прозорий, підсвітка лише під курсором. У :2360 сам кружечок лежить у дочірньому div, а клас кнопки — тільки розкладка.',
      context: (
        <Frame label="settings/page.js:339 · рядок мітки" tone="white">
          <div className="flex items-center gap-3 rounded-[10px] border border-line px-3 py-2">
            <Spot><button type="button" className={C_SWATCH_LABEL} style={{ background: '#ef4444' }} aria-label="Обрати колір" /></Spot>
            <span className="text-[13px] font-medium text-ink">Терміново</span>
            <span className="ml-auto flex gap-1.5">
              {['#ef4444', '#f97316', '#10b981', '#3b82f6'].map(colour => (
                <button key={colour} type="button" className={C_SWATCH_PALETTE} style={{ background: colour, outline: colour === '#ef4444' ? '2px solid #1f1f1f' : 'none', outlineOffset: 2 }} aria-label={`Колір ${colour}`} />
              ))}
            </span>
          </div>
        </Frame>
      ),
      now: (
        <>
          <Real loc="settings/page.js:341" cls={C_SWATCH_LABEL} state="обраного стану немає — ring завжди прозорий">
            <button type="button" className={C_SWATCH_LABEL} style={{ background: '#ef4444' }} aria-label="Обрати колір" />
          </Real>
          <Real loc="settings/page.js:351" cls={C_SWATCH_PALETTE} state="обрано; outline приходить з inline style">
            <button type="button" className={C_SWATCH_PALETTE} style={{ background: '#10b981', outline: '2px solid #1f1f1f', outlineOffset: 2 }} aria-label="Колір #10b981" />
          </Real>
          <Real loc="settings/page.js:2360" cls={C_SWATCH_THEME} state={`кружечок — дочірній div: ${C_SWATCH_THEME_INNER}`}>
            <button type="button" className={C_SWATCH_THEME}>
              <span className={C_SWATCH_THEME_INNER} style={{ background: '#1f1f1f' }} />
              <span className="text-[11px] font-medium text-ink">Темна</span>
            </button>
          </Real>
        </>
      ),
      after: null,
      afterNote: 'Компонента «зразок кольору» в кіті немає. Він був би один розмір, один спосіб показати вибір і один спосіб прийняти колір — зараз колір приходить трьома шляхами: style.background, style.outline і клас.',
      options: [
        { kind: 'build', title: 'Зробити компонент «зразок кольору»', note: 'Один спосіб показати колір і вибір. :2360 доведеться перебудувати — там кружечок не є кнопкою.' },
        { kind: 'keep', title: 'Лишити як є', note: 'Налаштування й далі малюють свої кружечки.' },
      ],
    },

    // ═══ Іконкові кнопки ═════════════════════════════════════════════════
    {
      id: 'board-collapse',
      family: 'Іконкові кнопки',
      title: 'Стрілка розгортання згорнутої колонки',
      count: 2,
      where: 'AgileBoard.jsx:259, :349',
      why: 'Дві дослівні копії однієї кнопки в одному файлі: text-muted mb-4 — ані коробки, ані відступу, ані радіуса. Обидві вже позначені як переглянуті (data-ui-control="column-collapse"), тож питання не «чи можна», а «чи варто».',
      context: (
        <Frame label="AgileBoard.jsx:250 · згорнута колонка" tone="canvas">
          <div className="flex w-[52px] flex-col items-center rounded-[12px] bg-white py-3">
            <Spot><button type="button" aria-label="Розгорнути колонку" className={C_BOARD_COLLAPSE}><ChevronRight size={16} /></button></Spot>
            <span className="mb-4 h-[8px] w-[8px] shrink-0 rounded-full bg-[#6366f1]" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>У роботі</span>
          </div>
        </Frame>
      ),
      now: (
        <>
          <Real loc="AgileBoard.jsx:259" cls={C_BOARD_COLLAPSE} state="кілька доріжок">
            <button type="button" aria-label="Розгорнути колонку" className={C_BOARD_COLLAPSE}><ChevronRight size={16} /></button>
          </Real>
          <Real loc="AgileBoard.jsx:349" cls={C_BOARD_COLLAPSE} state="одна доріжка — дослівна копія рядка 259">
            <button type="button" aria-label="Розгорнути колонку" className={C_BOARD_COLLAPSE}><ChevronRight size={16} /></button>
          </Real>
        </>
      ),
      after: (
        <Kit note='IconAction size="sm" appearance="quiet" — зʼявиться квадратна коробка 28px і hover'>
          <IconAction label="Розгорнути колонку" icon={ChevronRight} size="sm" appearance="quiet" className="mb-4" />
        </Kit>
      ),
      afterNote: 'Колонка вузька (52px), тож коробка 28px у неї вміщується — але вертикальний ритм із крапкою і підписом під нею зсунеться.',
      options: [
        { kind: 'adopt', title: 'Узяти IconAction', note: 'Дві копії зійдуться в одну; зʼявиться коробка і hover.' },
        { kind: 'keep', title: 'Лишити як є', note: 'Гола іконка не заважає вузькій колонці; переглянуто вже двічі.' },
      ],
    },

    {
      id: 'audio-play',
      family: 'Іконкові кнопки',
      title: 'Кнопка відтворення в аудіо-картці',
      count: 1,
      where: 'src/components/workspace/qtplus/cards/AudioCard.jsx:97',
      why: 'Коробка 32px, радіус 8px, сіре тло — це майже IconAction appearance="soft" (30px, 8px). Переїзд коштує двох речей: іконка малюється з fill="currentColor", тобто трикутник зафарбований, а колір тут text-ink, тоді як soft дає !text-muted.',
      context: (
        <Frame label="AudioCard.jsx:93 · картка аудіо" tone="canvas">
          <div className="flex flex-col gap-2 rounded-[12px] border border-line bg-white px-3 py-3">
            <div className="flex items-center gap-2">
              <Spot><button type="button" className={C_AUDIO_PLAY} aria-label="Відтворити"><Play size={14} fill="currentColor" className="ml-[2px]" /></button></Spot>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">Планерка 14 серпня</span>
                <span className="block text-[11px] text-muted">0:00 / 12:41</span>
              </span>
            </div>
          </div>
        </Frame>
      ),
      now: (
        <Real loc="AudioCard.jsx:97" cls={C_AUDIO_PLAY} state='іконка: <Play size={14} fill="currentColor" className="ml-[2px]" />'>
          <button type="button" className={C_AUDIO_PLAY} aria-label="Відтворити"><Play size={14} fill="currentColor" className="ml-[2px]" /></button>
        </Real>
      ),
      after: (
        <Kit note='IconAction appearance="soft" size="compact" — 30px, трикутник контурний, колір muted'>
          <IconAction label="Відтворити" icon={Play} size="compact" appearance="soft" />
        </Kit>
      ),
      afterNote: 'Дві втрати відразу: заливка трикутника і темний колір. Кнопка «відтворити» з контурним сірим трикутником читається слабше — це видно на двох прикладах поруч.',
      options: [
        { kind: 'build', title: 'Дати IconAction заливку іконки', note: 'Прапорець «іконка залита» — для play/pause/stop, де контур не читається.' },
        { kind: 'adopt', title: 'Узяти IconAction soft як є', note: 'Трикутник стане контурним і сірим.' },
        { kind: 'keep', title: 'Лишити як є', note: 'Плеєр тримає свою кнопку.' },
      ],
    },

    // ═══ Вкладки ═════════════════════════════════════════════════════════
    {
      id: 'tab-strips',
      family: 'Вкладки',
      title: 'Дві смуги вкладок, дві різні мови',
      count: 2,
      where: 'qtplus/StageStepper.jsx:29 · WorkloadTab.jsx:612',
      why: 'Обидві — смуга з активним елементом, і жодна не бере Tabs, Segmented чи InnerNavigation із кіту. Мови різні: степер підкреслює активний знизу (border-b-2), аналітика піднімає його білою карткою з тінню на сірому жолобі.',
      context: (
        <Frame label="StageStepper.jsx:22 · смуга етапів" tone="white">
          <div className="flex w-full items-center border-b border-line">
            <Spot><button type="button" className={C_STAGE_TAB}><Clock size={13} />Бриф</button></Spot>
            <button type="button" className="flex min-w-[140px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3 pb-2 pt-1 text-[13px] text-muted transition-colors hover:text-ink">Дизайн</button>
          </div>
        </Frame>
      ),
      now: (
        <>
          <Real loc="StageStepper.jsx:29" cls={C_STAGE_TAB} state="активний і доступний етап">
            <button type="button" className={C_STAGE_TAB}><Clock size={13} />Бриф</button>
          </Real>
          <Real loc="WorkloadTab.jsx:612" cls={C_MEMBER_TAB} state="активна вкладка">
            <span className="inline-flex rounded-[16px] bg-[#e9e9e9] p-1.5">
              <button type="button" className={C_MEMBER_TAB}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-ink text-white"><Users size={14} /></span>
                <span className="text-[12px] font-semibold text-ink">Навантаження</span>
              </button>
            </span>
          </Real>
        </>
      ),
      after: null,
      afterNote: 'У кіті вже є три сусіди — Tabs, Segmented і InnerNavigation. Перш ніж заводити четвертий вигляд, варто перевірити, чи котрийсь із трьох не покриває обидва випадки; якщо покриває, це «взяти», а не «зробити».',
      options: [
        { kind: 'adopt', title: 'Перевірити Tabs / Segmented і взяти', note: 'Спершу я порівняю всі три з кітом і покажу, що збігається.' },
        { kind: 'keep', title: 'Лишити обидві власними', note: 'Степер і аналітика — різні структури з різними мовами.' },
      ],
    },

    // ═══ Поодинокі ═══════════════════════════════════════════════════════
    {
      id: 'copy-link',
      family: 'Поодинокі',
      title: 'Кнопка «Копіювати посилання»',
      count: 1,
      where: 'src/components/InviteLinkSection.jsx:97',
      why: 'Найпростіший випадок на сторінці: суцільна темна кнопка на всю ширину, 40px висоти, радіус 10px — це Button style="primary" майже піксель у піксель. Різниця лише в тому, що зелений стан «Скопійовано» кіт не має.',
      context: (
        <Frame label="InviteLinkSection.jsx:95 · блок посилання" tone="white">
          <div className="rounded-[12px] border border-dashed border-[#cfcfcf] bg-white p-2">
            <p className="truncate px-2 py-1 text-[12px] font-medium text-[#5a5a5a]">quickteam.app/invite/8f2a…</p>
            <Spot><button type="button" className={C_COPY_LINK}><Copy size={14} />Копіювати посилання</button></Spot>
          </div>
        </Frame>
      ),
      now: (
        <Real loc="InviteLinkSection.jsx:97" cls={C_COPY_LINK} state="copied = false; при copied — bg-emerald-500">
          <button type="button" className={C_COPY_LINK}><Copy size={14} />Копіювати посилання</button>
        </Real>
      ),
      after: (
        <Kit note='Button style="primary" — 36px замість 40px, радіус 10px той самий'>
          <Button style="primary" size="lg" icon={Copy} className="w-full">Копіювати посилання</Button>
        </Kit>
      ),
      options: [
        { kind: 'adopt', title: 'Узяти Button кіту', note: 'Висота 40→36px; зелений стан «Скопійовано» доведеться виразити окремо.' },
        { kind: 'keep', title: 'Лишити як є', note: 'Зелена підтвердна заливка тримається на власному класі.' },
      ],
    },

    {
      id: 'org-avatar',
      family: 'Поодинокі',
      title: 'Плитка організації на екрані вибору',
      count: 1,
      where: 'src/components/OrgSwitcherScreen.jsx:27',
      why: 'Не плитка вибору, попри вигляд: клас самої кнопки — це лише розкладка й ефект «решта тьмяніє». Усе видиме (коло 110px, рамка при наведенні, тінь) лежить у дочірньому div. Кіт має UserAvatar, але не має аватарки організації такого розміру.',
      context: (
        <Frame label="OrgSwitcherScreen.jsx:22 · вибір організації" tone="dark">
          <div className="flex gap-6">
            <Spot>
              <button type="button" className={C_ORG_AVATAR}>
                <span className="grid h-[110px] w-[110px] shrink-0 place-items-center overflow-hidden rounded-full border-[3px] border-transparent bg-[#2a2a2a] text-[40px] font-medium text-white shadow-xl">Q</span>
                <span className="text-[13px] font-medium text-white">QuickTeam</span>
              </button>
            </Spot>
          </div>
        </Frame>
      ),
      now: (
        <Real loc="OrgSwitcherScreen.jsx:27" cls={C_ORG_AVATAR} state="коло 110px — дочірній div, не ця кнопка">
          <span className="inline-flex rounded-[12px] bg-[#1f1f1f] p-3">
            <button type="button" className={C_ORG_AVATAR}>
              <span className="grid h-[110px] w-[110px] shrink-0 place-items-center rounded-full bg-[#2a2a2a] text-[40px] font-medium text-white shadow-xl">Q</span>
              <span className="text-[13px] font-medium text-white">QuickTeam</span>
            </button>
          </span>
        </Real>
      ),
      after: null,
      afterNote: 'Кіт не має ні аватарки організації, ні розміру 110px: UserAvatar доходить до lg. Щоб завести це в кіт, довелося б розширювати шкалу заради одного екрана.',
      options: [
        { kind: 'build', title: 'Розширити шкалу UserAvatar', note: 'Новий розмір і варіант «організація» заради одного екрана.' },
        { kind: 'keep', title: 'Лишити як є', note: 'Екран вибору організації — окремий світ, як і вхід.' },
      ],
    },

    {
      id: 'file-overlay',
      family: 'Поодинокі',
      title: 'Прозорий шар «клацни будь-де на картці»',
      count: 1,
      where: 'src/components/workspace/qtplus/cards/FileCard.jsx:65',
      why: 'Кнопка без жодного вигляду: absolute inset-0 і курсор. Вона нічого не малює — вона робить клікабельною всю картку, а видимі кнопки лежать над нею завдяки z-10. Питання не про вигляд, а про те, чи такий шар взагалі має бути кнопкою.',
      context: (
        <Frame label="FileCard.jsx:60 · картка файлу" tone="canvas">
          <div className="relative w-[220px] rounded-[12px] border border-line bg-white p-3">
            <FileText size={16} className="mb-1 text-muted" />
            <p className="text-[13px] font-medium text-ink">Договір.pdf</p>
            <p className="text-[11px] text-muted">240 КБ</p>
            <Spot>
              <span className="absolute inset-0 grid place-items-center rounded-[12px] border border-dashed border-faint bg-ink/[0.03] font-mono text-[10px] text-muted">
                прозорий шар на всю картку
              </span>
            </Spot>
          </div>
        </Frame>
      ),
      now: (
        <Real loc="FileCard.jsx:65" cls={C_FILE_OVERLAY} state="кнопка справжня і справді прозора; пунктир — окремий шар поверх неї, щоб було видно межі">
          <span className="relative block h-[64px] w-[200px] rounded-[12px] border border-line bg-white">
            <button type="button" className={C_FILE_OVERLAY} aria-label="Відкрити Договір.pdf" />
            <span className="pointer-events-none absolute inset-0 grid place-items-center rounded-[12px] border border-dashed border-faint bg-ink/[0.03] font-mono text-[10px] text-muted">
              межі прозорої кнопки
            </span>
          </span>
        </Real>
      ),
      after: null,
      afterNote: 'Компонента для цього в кіті немає й, найімовірніше, не має бути: це прийом розкладки, а не контрол. Альтернатива — зробити картку кнопкою, а внутрішні дії винести за її межі.',
      options: [
        { kind: 'keep', title: 'Лишити як прийом розкладки', note: 'Шар працює і вже має пояснення в коментарі поруч.' },
        { kind: 'build', title: 'Перебудувати картку', note: 'Картка стає кнопкою, внутрішні кнопки виходять із неї. Помітна перебудова.' },
      ],
    },

    // ═══ Політика ════════════════════════════════════════════════════════
    {
      id: 'auth',
      family: 'Політика',
      title: 'Екрани входу',
      count: 3,
      where: 'AuthLayout.jsx:46, :67, :84',
      why: 'Login і Onboarding були домовлено поза зоною змін кіту — темне тло, власна логіка. Питання лише в тому, чи домовленість ще чинна. Варто знати: кіт уже має appearance="auth-close" саме для цього тла, тобто перший крок туди вже зроблений.',
      context: (
        <Frame label="AuthLayout.jsx:40 · верхня смуга" tone="dark">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-bold text-white">QuickTeam</span>
            <div className="flex items-center gap-4">
              <Spot><button type="button" className={C_AUTH_CREATE}><Plus size={16} />Створити організацію</button></Spot>
              <button type="button" className={C_AUTH_AVATAR}><Users size={15} className="text-white/70" /></button>
            </div>
          </div>
        </Frame>
      ),
      now: (
        <>
          <Real loc="AuthLayout.jsx:46" cls={C_AUTH_CREATE}>
            <span className="inline-flex rounded-[8px] bg-[#1f1f1f] p-2">
              <button type="button" className={C_AUTH_CREATE}><Plus size={16} />Створити організацію</button>
            </span>
          </Real>
          <Real loc="AuthLayout.jsx:67" cls={C_AUTH_AVATAR}>
            <span className="inline-flex rounded-[8px] bg-[#1f1f1f] p-2">
              <button type="button" className={C_AUTH_AVATAR}><Users size={15} className="text-white/70" /></button>
            </span>
          </Real>
          <Real loc="AuthLayout.jsx:84" cls={C_AUTH_LOGOUT}>
            <span className="inline-flex w-[180px] rounded-[8px] bg-[#2a2a2a] p-1">
              <button type="button" className={C_AUTH_LOGOUT}><LogOut size={14} />Вийти</button>
            </span>
          </Real>
        </>
      ),
      after: null,
      afterNote: 'Щоб завести вхід у кіт, кіту потрібен повний темний контекст: зараз із темних appearance є auth-close, inverse і overlay — цього вистачає на іконки, але не на текстові кнопки й меню.',
      options: [
        { kind: 'keep', title: 'Лишити поза зоною', note: 'Як домовлялись — вхід живе окремо.' },
        { kind: 'adopt', title: 'Завести і їх у кіт', note: 'Тоді кіту потрібен темний контекст для тексту й меню, не лише для іконок.' },
      ],
    },

    {
      id: 'status-setter',
      family: 'Політика',
      title: 'Віджет статусу користувача',
      count: 3,
      where: 'UserStatusSetter.jsx:49, :85, :101',
      why: 'Технічна пастка, а не смак. Цей файл — єдиний, хто вживає три оголошені варіанти кіту. Обхід продукту не заходить у кіт, тож після переносу звіт заявив би, що варіанти мертві, поки продукт малює їх щодня.',
      shot: <Shot src="/ui-decisions/chat.jpeg" alt="екран «Чат» · продакшн" note="Обведено чип статусу праворуч у хедері." />,
      context: (
        <Frame label="UserStatusSetter.jsx:49 · правий край хедера" tone="white">
          <div className="flex items-center justify-end gap-2">
            <Spot>
              <button type="button" className={C_STATUS_PILL}>
                <span className="text-[12px]">🔴</span>
                <span className="text-[11px] font-bold text-ink">Зайнятий</span>
              </button>
            </Spot>
            <UserAvatar user={DEMO_USER} size="sm" />
          </div>
        </Frame>
      ),
      now: (
        <>
          <Real loc="UserStatusSetter.jsx:49" cls={C_STATUS_PILL}>
            <button type="button" className={C_STATUS_PILL}>
              <span className="text-[12px]">🔴</span><span className="text-[11px] font-bold text-ink">Зайнятий</span>
            </button>
          </Real>
          <Real loc="UserStatusSetter.jsx:85" cls={C_STATUS_PRESET}>
            <button type="button" className={C_STATUS_PRESET}>
              <span className="text-[20px]">🎯</span><span className="truncate text-[12px] font-bold text-ink">Зосереджений</span>
            </button>
          </Real>
          <Real loc="UserStatusSetter.jsx:101" cls={C_STATUS_EMOJI} state="обраний емодзі">
            <button type="button" className={C_STATUS_EMOJI}>🔴</button>
          </Real>
        </>
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
