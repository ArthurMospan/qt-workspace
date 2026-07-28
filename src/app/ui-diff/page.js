'use client';
import React, { useState } from 'react';
import Button from '@/components/ui/Button';
import ButtonGroup from '@/components/ui/Button/ButtonGroup';
import SplitButton from '@/components/ui/Button/SplitButton';
import StatusBadge from '@/components/ui/DataDisplay/StatusBadge';
import PriorityBadge from '@/components/ui/DataDisplay/PriorityBadge';
import KitKpiCard from '@/components/ui/DataDisplay/KpiCard';
import AvatarGroup from '@/components/ui/DataDisplay/AvatarGroup';
import Chip from '@/components/ui/DataDisplay/Chip';
import Stat from '@/components/ui/DataDisplay/Stat';
import ProgressRing from '@/components/ui/DataDisplay/ProgressRing';
import { FileInput } from '@/components/ui/Forms/FileInput';
import FormGroup from '@/components/ui/Forms/FormGroup';
import { HeaderSearch } from '@/components/ui/Forms/HeaderSearch';
import TeamMemberCard from '@/components/ui/TaskManagement/TeamMemberCard';
import CommentThread from '@/components/ui/TaskManagement/CommentThread';
import TimeLogDisplay from '@/components/ui/TaskManagement/TimeLogDisplay';
import UserAvatar from '@/components/ui/DataDisplay/UserAvatar';
import { DEFAULT_PRIORITIES } from '@/lib/hooks/useWorkflowConfig';
import {
  Palette, Copy, Layers, LayoutGrid, Box, MessageSquare,
  Clock, CheckCircle2,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// NAV
// ─────────────────────────────────────────────────────────────────────────────
const GROUPS = [
  {
    title: 'Кольори',
    items: [
      { id: 'palette',   label: 'Дублікати сірих/фонів', icon: Palette },
      { id: 'priority-colors', label: 'Кольори пріоритетів', icon: Box },
    ]
  },
  {
    title: 'Дублі атомів',
    items: [
      { id: 'kpi',       label: 'KPI-картка', icon: LayoutGrid },
      { id: 'badge',     label: 'Бейдж статусу', icon: Box },
      { id: 'priority',  label: 'Індикатор пріоритету', icon: Box },
      { id: 'avatars',   label: 'Аватарки', icon: Box },
    ]
  },
  {
    title: 'Кнопки',
    items: [
      { id: 'copy-btn',  label: 'Кнопка копіювання', icon: Copy },
      { id: 'chat-icons',label: 'Іконки-дії в чаті', icon: MessageSquare },
      { id: 'btn-color', label: 'Button ігнорує кольори', icon: Box },
      { id: 'btn-radius',label: 'Перекриття радіуса кнопки', icon: Box },
    ]
  },
  {
    title: 'Радіуси',
    items: [
      { id: 'radii', label: 'Ієрархія радіусів карток', icon: Layers },
    ]
  },
  {
    title: 'Невикористані компоненти',
    items: [
      { id: 'unused', label: 'Готові, але 0 використань', icon: Box },
    ]
  },
  {
    title: 'Поза скоупом',
    items: [
      { id: 'out-of-scope', label: 'Великі лейаути / архітектура', icon: Layers },
    ]
  },
];
const SECTIONS = GROUPS.flatMap(g => g.items);

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI
// ─────────────────────────────────────────────────────────────────────────────

function PriorityDot({ level }) {
  const label = { high: '🔴 Видно користувачу', medium: '🟡 Системне/технічне', low: '⚪ Інформаційне' };
  return (
    <span className="inline-flex items-center text-[11px] font-semibold text-[#6b6b6b]">
      {label[level]}
    </span>
  );
}

function DiffBlock({ id, level = 'medium', title, description, currentLabel = 'ПОТОЧНЕ', proposedLabel = 'UI KIT / ПРОПОЗИЦІЯ', current, proposed, currentFile, proposedFile, note }) {
  return (
    <div id={id} className="flex flex-col gap-[14px] scroll-mt-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-[10px] mb-[4px]">
            <span className="text-[11px] font-bold px-[8px] py-[2px] rounded-[6px] bg-[#1f1f1f] text-white tracking-wide">{id.toUpperCase()}</span>
            <PriorityDot level={level} />
          </div>
          <h3 className="text-[17px] font-bold text-[#1f1f1f]">{title}</h3>
          {description && <p className="text-[12px] text-[#9a9a9a] mt-[3px] max-w-[720px] leading-relaxed">{description}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
        <div className="flex flex-col gap-[8px]">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#b91c1c] px-[2px]">{currentLabel}</div>
          <div className="rounded-[16px] border border-[#fecaca] bg-[#fef2f2] p-[20px] min-h-[100px] flex flex-wrap items-center gap-[12px]">
            {current}
          </div>
          {currentFile && <div className="text-[10px] font-mono text-[#b1b1b1] px-[2px]">{currentFile}</div>}
        </div>
        <div className="flex flex-col gap-[8px]">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#047857] px-[2px]">{proposedLabel}</div>
          <div className="rounded-[16px] border border-[#a7f3d0] bg-[#ecfdf5] p-[20px] min-h-[100px] flex flex-wrap items-center gap-[12px]">
            {proposed}
          </div>
          {proposedFile && <div className="text-[10px] font-mono text-[#b1b1b1] px-[2px]">{proposedFile}</div>}
        </div>
      </div>

      {note && (
        <div className="text-[12px] text-[#6b6b6b] bg-[#f4f4f5] rounded-[10px] px-[14px] py-[10px] leading-relaxed">
          {note}
        </div>
      )}
    </div>
  );
}

function Swatch({ hex, label }) {
  return (
    <div className="flex items-center gap-[10px] bg-white rounded-[10px] px-[12px] py-[8px] border border-[#f0f0f0]">
      <div className="w-[22px] h-[22px] rounded-[6px] shrink-0 border border-black/5" style={{ background: hex }} />
      <div>
        <div className="text-[12px] font-mono font-bold text-[#1f1f1f]">{hex}</div>
        {label && <div className="text-[10px] text-[#9a9a9a]">{label}</div>}
      </div>
    </div>
  );
}

function PaletteRow({ id, level = 'medium', role, current, proposed, note }) {
  return (
    <div id={id} className="flex flex-col gap-[10px]">
      <div className="flex items-center gap-[10px]">
        <span className="text-[11px] font-bold px-[8px] py-[2px] rounded-[6px] bg-[#1f1f1f] text-white tracking-wide">{id.toUpperCase()}</span>
        <PriorityDot level={level} />
        <h4 className="text-[14px] font-bold text-[#1f1f1f]">{role}</h4>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
        <div className="flex flex-col gap-[8px]">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#b91c1c]">Зараз використовується (впереміш)</div>
          <div className="flex flex-wrap gap-[8px] bg-[#fef2f2] border border-[#fecaca] rounded-[12px] p-[14px]">
            {current.map(c => <Swatch key={c.hex} {...c} />)}
          </div>
        </div>
        <div className="flex flex-col gap-[8px]">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#047857]">Пропозиція — один токен</div>
          <div className="flex flex-wrap gap-[8px] bg-[#ecfdf5] border border-[#a7f3d0] rounded-[12px] p-[14px]">
            {proposed.map(c => <Swatch key={c.hex} {...c} />)}
          </div>
        </div>
      </div>
      {note && <div className="text-[12px] text-[#6b6b6b] bg-[#f4f4f5] rounded-[10px] px-[14px] py-[10px]">{note}</div>}
    </div>
  );
}

function ResolvedBlock({ id, title, description, decision, swatch, swatchLabel }) {
  return (
    <div id={id} className="flex flex-col gap-[14px] scroll-mt-4">
      <div className="flex items-center gap-[10px] mb-[2px]">
        <span className="text-[11px] font-bold px-[8px] py-[2px] rounded-[6px] bg-[#1f1f1f] text-white tracking-wide">{id.toUpperCase()}</span>
        <span className="inline-flex items-center gap-[4px] text-[11px] font-bold text-[#047857]">✅ Рішення прийнято</span>
      </div>
      <h3 className="text-[17px] font-bold text-[#1f1f1f]">{title}</h3>
      {description && <p className="text-[12px] text-[#9a9a9a] max-w-[720px] leading-relaxed">{description}</p>}
      <div className="flex items-center gap-[16px] bg-[#ecfdf5] border border-[#a7f3d0] rounded-[16px] p-[20px]">
        <Swatch hex={swatch} label={swatchLabel} />
        <p className="text-[12px] text-[#065f46] font-semibold">{decision}</p>
      </div>
    </div>
  );
}

function ReferenceCard({ id, level = 'low', title, description, resolved = false, decision }) {
  return (
    <div id={id} className={`flex flex-col gap-[6px] rounded-[16px] p-[20px] border ${resolved ? 'bg-[#ecfdf5] border-[#a7f3d0]' : 'bg-white border-[#f0f0f0]'}`}>
      <div className="flex items-center gap-[10px]">
        <span className="text-[11px] font-bold px-[8px] py-[2px] rounded-[6px] bg-[#1f1f1f] text-white tracking-wide">{id.toUpperCase()}</span>
        {resolved ? <span className="text-[11px] font-bold text-[#047857]">✅ Рішення прийнято</span> : <PriorityDot level={level} />}
      </div>
      <h4 className="text-[14px] font-bold text-[#1f1f1f] mt-[4px]">{title}</h4>
      <p className="text-[12px] text-[#9a9a9a] leading-relaxed">{description}</p>
      {decision && <p className="text-[12px] text-[#065f46] font-semibold mt-[4px]">{decision}</p>}
    </div>
  );
}

// Внутрішня (неекспортована) хардкоджена версія з реального коду —
// відтворена 1:1, щоб порівняння було чесним.
function LocalBacklogBadge({ label, color }) {
  return <span className="text-[10px] font-bold px-[6px] py-[2px] rounded-[6px]" style={{ color, background: color + '18' }}>{label}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTIONS
// ─────────────────────────────────────────────────────────────────────────────

function PaletteSection() {
  return (
    <div className="flex flex-col gap-[36px]">
      <PaletteRow
        id="d1" level="high" role="Основний сірий текст (text-muted)"
        current={[
          { hex: '#9a9a9a', label: '×604 — фактичний стандарт' },
          { hex: '#a3a3a3', label: '×10 — Input.jsx плейсхолдери' },
          { hex: '#666666', label: '×7 — FileInput та інші' },
          { hex: '#b0b0b0', label: '×3' },
          { hex: '#6b6b6b', label: '×1 — ConfirmProvider.jsx' },
        ]}
        proposed={[{ hex: '#9a9a9a', label: 'text-muted — залишити як є, замінити решту' }]}
      />
      <PaletteRow
        id="d2" level="medium" role="Світлий сірий (підписи / disabled)"
        current={[
          { hex: '#cfcfcf', label: '×142' },
          { hex: '#e0e0e0', label: '×6' },
        ]}
        proposed={[{ hex: '#cfcfcf', label: 'text-faint' }]}
      />
      <PaletteRow
        id="d3" level="high" role="Бордер"
        current={[
          { hex: '#e9e9e9', label: '×188' },
          { hex: '#f0f0f0', label: '×140' },
        ]}
        proposed={[
          { hex: '#e9e9e9', label: 'варіант А' },
          { hex: '#f0f0f0', label: 'варіант Б' },
        ]}
        note="Тут я НЕ обираю за тебе — обидва майже однакові й використовуються впереміш. Скажи, який лишити (або залиш два — «зовнішній/внутрішній бордер» теж валидна система)."
      />
      <PaletteRow
        id="d4" level="high" role="Сірий фон карток/сторінки"
        current={[
          { hex: '#f4f4f5', label: '×241 — картки' },
          { hex: '#f5f5f5', label: '×27 — фон воркспейсу' },
          { hex: '#fafafa', label: '×19' },
          { hex: '#f8f8f8', label: '×4' },
        ]}
        proposed={[
          { hex: '#f4f4f5', label: 'bg-subtle (картки)' },
          { hex: '#f5f5f5', label: 'bg-page (фон воркспейсу)' },
        ]}
        note="Пропоную лишити ДВА токени (картка ≠ фон сторінки — це, схоже, навмисно), і тільки влити в них #fafafa/#f8f8f8."
      />
    </div>
  );
}

function PriorityColorsSection() {
  return (
    <div className="flex flex-col gap-[40px]">
      <ResolvedBlock
        id="d5"
        title="Пріоритет Blocker — тепер всюди #ef4444"
        description="Було два різних червоних (#dc2626 на дошці/PriorityBadge-тексті vs #ef4444 у фільтрах). Уніфіковано на #ef4444 в усіх живих джерелах: DEFAULT_PRIORITIES, PriorityBadge kit, IssueDetail, SearchModal, sprints і AnalyticsTab."
        swatch="#ef4444"
        swatchLabel="blocker — єдиний колір усюди"
        decision="Застосовано в живих workflow, settings, badge, issue, search, sprint та analytics компонентах."
      />
      <ResolvedBlock
        id="d6"
        title="Пріоритет Low — тепер всюди сірий #9a9a9a"
        description="Дошка й PriorityBadge вже малювали low сірим; фільтри на 7 сторінках малювали синім (#3b82f6) — той самий пріоритет виглядав як інший статус. Уніфіковано на сірий."
        swatch="#9a9a9a"
        swatchLabel="low — єдиний колір усюди"
        decision="Замінено dotColor у фільтрах живих analytics, my, sprints, [projectId] та AnalyticsTab."
      />
    </div>
  );
}

function KpiSection() {
  return (
    <div className="flex flex-col gap-[16px]">
      <ResolvedBlock
        id="d8"
        title="KPI-картка задубльована — тепер один компонент"
        description="AnalyticsTab.jsx мала власну копію KPI-картки. Видалено, тепер імпортує kit-версію напряму — коли компонент зміниться, це відобразиться всюди одразу, а не тільки в одному місці."
        swatch="#6366f1"
        swatchLabel="KitKpiCard — єдина версія"
        decision="AnalyticsTab.jsx тепер імпортує ui/DataDisplay/KpiCard.jsx, локальну функцію видалено."
      />
      <KitKpiCard icon={Clock} label="ЗАВДАНЬ" value="24" trend={12} />
    </div>
  );
}

function BadgeSection() {
  return (
    <DiffBlock
      id="d9" level="medium"
      title="Бейдж статусу задубльований"
      description="Застарілий BacklogTab мав власну локальну Badge-функцію. Файл видалено; живі списки використовують StatusBadge, який бере колір і назву з workflow-конфігурації."
      current={<LocalBacklogBadge label="Code Review" color="#9a9a9a" />}
      proposed={<StatusBadge status="code-review" />}
      currentFile="Видалений legacy BacklogTab"
      proposedFile="src/components/ui/DataDisplay/StatusBadge.jsx"
    />
  );
}

function PrioritySection() {
  return (
    <div className="flex flex-col gap-[16px]">
      <ResolvedBlock
        id="d10"
        title="Пріоритет — тепер PriorityBadge замість ручного рендеру"
        description="Legacy BacklogTab малював пріоритет вручну іконкою+текстом і був видалений. Живі табличні види використовують kit PriorityBadge. IssueCard на дошці має навмисно компактніший формат."
        swatch="#ef4444"
        swatchLabel="PriorityBadge — єдиний спосіб для табличних/списочних видів"
        decision="Legacy-дублікат видалено; PriorityBadge лишився єдиним стандартом для табличних видів."
      />
      <PriorityBadge priority="blocker" />
    </div>
  );
}

function AvatarsSection() {
  return (
    <div className="flex flex-col gap-[16px]">
      <ResolvedBlock
        id="d11"
        title="Аватарки — тепер один стандарт: UserAvatar"
        description="Рішення власника: аватарки мають бути однакові; якщо фото немає, UserAvatar показує детермінований колір з ініціалів. Legacy-компонент з окремим рендером видалено."
        swatch="#4f46e5"
        swatchLabel="UserAvatar — єдиний стандарт"
        decision="UserAvatar лишився єдиним стандартом аватарів."
      />
      <div className="flex items-center gap-3">
        <UserAvatar user={{ name: 'Ivan Petrenko' }} size={32} />
        <span className="text-[12px] text-[#6b6b6b]">без фото — колір з ініціалів, детермінований за id</span>
      </div>
      <p className="text-[11px] text-[#9a9a9a]">
        Kit-компонент <code>ui/DataDisplay/Avatar.jsx</code> (завжди фіолетовий, без детермінованого кольору) лишається невикористаним — кандидат на видалення, дивись розділ «Невикористані компоненти».
      </p>
    </div>
  );
}

function CopyButtonSection() {
  return (
    <div className="flex flex-col gap-[16px]">
      <ResolvedBlock
        id="d12"
        title="Кнопка копіювання — тепер Button icon-sm скрізь"
        description="Дві кнопки копіювання в розділі Інтеграцій (BuggyBag) були сирим <button> з іконкою. Переведено на Button, як і Organization ID у тій самій формі раніше."
        swatch="#9a9a9a"
        swatchLabel="Button style=ghost size=icon-sm"
        decision="settings/page.js: обидві кнопки (токен BuggyBag, Org ID у секції інтеграцій) тепер <Button style='ghost' size='icon-sm' icon={Copy} />."
      />
      <Button style="ghost" size="icon-sm" icon={Copy} iconSize={12} />
    </div>
  );
}

function ChatIconsSection() {
  return (
    <div className="flex flex-col gap-[16px]">
      <ResolvedBlock
        id="d14"
        title="Іконки-дії повідомлення в чаті — уніфіковано"
        description="Hover-кнопки під повідомленням (відповісти, закріпити, редагувати, видалити) були нативними 28×28px кнопками — різниці з kit-розміром icon-sm не було, тож просто замінено."
        swatch="#9a9a9a"
        swatchLabel="Button style=ghost size=icon-sm"
        decision="chat/page.js MessageBubble: усі 4 кнопки (Thread, Pin, Edit, Delete) тепер Button; Pin зберіг активний indigo-стан через className, Delete — color='red'."
      />
      <Button style="ghost" size="icon-sm" icon={MessageSquare} iconSize={15} />
    </div>
  );
}

function ButtonColorSection() {
  return (
    <div className="flex flex-col gap-[16px]">
      <ResolvedBlock
        id="d18"
        title="Button color=blue/green/gray — прибрано з викликів"
        description="Рішення власника: кольори не будуть використовуватись часто, тому прибираємо ці пропси з викликів замість розширення палітри Button (= закриває T35 у цьому напрямку)."
        swatch="#1f1f1f"
        swatchLabel="Button завжди dark/red — інших кольорів у викликах більше немає"
        decision="Прибрано color=&quot;blue&quot;/&quot;gray&quot;/&quot;green&quot; з ~16 викликів у settings/page.js, sprints/page.js, EmptyState.jsx. НЕ займали білінг (2 кнопки апгрейду плану лишились як є)."
      />
      <Button style="ghost" size="md" icon={Copy}>Тепер просто dark</Button>
    </div>
  );
}

function ButtonRadiusSection() {
  return (
    <div className="flex flex-col gap-[16px]">
      <ResolvedBlock
        id="d19"
        title="Радіус кнопок — тепер завжди 10px"
        description="Кнопка «Зберегти» в Налаштуваннях додавала className=&quot;rounded-xl px-6&quot; (12px) поверх стандартних 10px Button. Прибрано перекриття радіуса."
        swatch="#1f1f1f"
        swatchLabel="10px — стандартний радіус Button, без винятків"
        decision="settings/page.js: rounded-xl прибрано з кнопок «Скинути» і «Зберегти» (px-4/px-6 padding лишився)."
      />
      <Button style="primary" size="lg">Зберегти профіль</Button>
    </div>
  );
}

function RadiiSection() {
  const radii = [
    { px: 24, label: 'Великі картки / діалоги', usage: 'KpiCard, Dialog, ProjectCard' },
    { px: 16, label: 'Середні панелі', usage: 'TeamMemberCard, ThreadSidebar, PageContentWrapper' },
    { px: 12, label: 'Дрібні контейнери', usage: 'MarkdownEditor, TimeLogDisplay, Dropdown-меню' },
    { px: 10, label: 'Елементи форм', usage: 'Button, Input, Select' },
  ];
  return (
    <div className="flex flex-col gap-[16px]">
      <div className="flex items-center gap-[10px]">
        <span className="text-[11px] font-bold px-[8px] py-[2px] rounded-[6px] bg-[#1f1f1f] text-white tracking-wide">D20</span>
        <PriorityDot level="low" />
      </div>
      <h3 className="text-[17px] font-bold text-[#1f1f1f]">Ієрархія радіусів карток</h3>
      <p className="text-[12px] text-[#9a9a9a] max-w-[720px] leading-relaxed">
        У коді реально є 4 стабільних значення радіуса, які завжди йдуть у парі з розміром елемента — це, схоже, НЕ помилка, а невисловлена система (великий елемент → великий радіус). Питання лише чи зафіксувати це правило явно в tokens.js, чи лишити як є (працює й так).
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px]">
        {radii.map(r => (
          <div key={r.px} className="flex flex-col items-center gap-[10px]">
            <div className="w-full h-[90px] bg-[#f4f4f5] border border-[#e9e9e9] flex items-center justify-center" style={{ borderRadius: r.px }}>
              <span className="text-[13px] font-bold text-[#1f1f1f]">{r.px}px</span>
            </div>
            <div className="text-center">
              <div className="text-[11px] font-bold text-[#1f1f1f]">{r.label}</div>
              <div className="text-[10px] text-[#9a9a9a]">{r.usage}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UnusedSection() {
  const demoAvatars = [{ name: 'Ivan' }, { name: 'Olena' }, { name: 'Petro' }, { name: 'Anna' }];
  const demoComments = [
    { id: '1', author: 'Іван', avatar: { name: 'Іван' }, content: 'Виглядає добре!', timestamp: new Date() },
  ];
  return (
    <div className="flex flex-col gap-[32px]">
      <p className="text-[13px] text-[#6b6b6b] bg-[#f4f4f5] rounded-[10px] px-[14px] py-[10px] max-w-[820px]">
        Ці компоненти повністю готові в UI Kit, але з 0 використань у застосунку. Тут вони живі й реальні (не мокапи) — подивись і скажи для кожного: «використовуємо, підставити в [де]» чи «видаляємо».
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[24px]">
        <div className="flex flex-col gap-[8px]">
          <div className="text-[11px] font-bold text-[#1f1f1f]">ButtonGroup / SplitButton</div>
          <div className="bg-white border border-[#f0f0f0] rounded-[16px] p-[20px] flex flex-col gap-[16px]">
            <ButtonGroup>
              <Button style="secondary" size="md">Дошка</Button>
              <Button style="secondary" size="md">Список</Button>
              <Button style="secondary" size="md">Календар</Button>
            </ButtonGroup>
            <SplitButton primaryLabel="Створити завдання" primaryAction={() => {}} items={[{ label: 'Створити епік' }, { label: 'Створити баг' }]} />
          </div>
        </div>

        <div className="flex flex-col gap-[8px]">
          <div className="text-[11px] font-bold text-[#1f1f1f]">AvatarGroup</div>
          <div className="bg-white border border-[#f0f0f0] rounded-[16px] p-[20px] flex items-center">
            <AvatarGroup avatars={demoAvatars} maxDisplay={3} size="md" />
          </div>
        </div>

        <div className="flex flex-col gap-[8px]">
          <div className="text-[11px] font-bold text-[#1f1f1f]">Chip</div>
          <div className="bg-white border border-[#f0f0f0] rounded-[16px] p-[20px] flex flex-wrap gap-[10px]">
            <Chip label="React" icon={CheckCircle2} color="primary" />
            <Chip label="Видалити" deletable color="danger" onDelete={() => {}} />
          </div>
        </div>

        <div className="flex flex-col gap-[8px]">
          <div className="text-[11px] font-bold text-[#1f1f1f]">Stat / ProgressRing</div>
          <div className="bg-white border border-[#f0f0f0] rounded-[16px] p-[20px] flex items-center gap-[24px]">
            <Stat number="128" label="Завдань" trend="up" trendValue="12" icon={CheckCircle2} />
            <ProgressRing value={68} size="sm" />
          </div>
        </div>

        <div className="flex flex-col gap-[8px]">
          <div className="text-[11px] font-bold text-[#1f1f1f]">FileInput / FormGroup</div>
          <div className="bg-white border border-[#f0f0f0] rounded-[16px] p-[20px]">
            <FormGroup label="Прикріпити файл">
              <FileInput />
            </FormGroup>
          </div>
        </div>

        <div className="flex flex-col gap-[8px]">
          <div className="text-[11px] font-bold text-[#1f1f1f]">HeaderSearch</div>
          <div className="bg-[#1f1f1f] rounded-[16px] p-[20px] flex items-center">
            <HeaderSearch placeholder="Пошук..." />
          </div>
        </div>

        <div className="flex flex-col gap-[8px]">
          <div className="text-[11px] font-bold text-[#1f1f1f]">TeamMemberCard</div>
          <div className="bg-[#f4f4f5] rounded-[16px] p-[20px] flex justify-center">
            <div className="w-[220px]">
              <TeamMemberCard name="Олена Коваль" role="Frontend Developer" status="online" avatar={{ name: 'Олена Коваль' }} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-[8px]">
          <div className="text-[11px] font-bold text-[#1f1f1f]">TimeLogDisplay</div>
          <div className="bg-[#f4f4f5] rounded-[16px] p-[20px]">
            <TimeLogDisplay task="Верстка форми логіну" duration={95} date={new Date()} billable user={{ name: 'Петро' }} onEdit={() => {}} onDelete={() => {}} />
          </div>
        </div>

        <div className="flex flex-col gap-[8px] md:col-span-2">
          <div className="text-[11px] font-bold text-[#1f1f1f]">CommentThread</div>
          <div className="bg-[#f4f4f5] rounded-[16px] p-[20px]">
            <CommentThread comments={demoComments} onReply={() => {}} />
          </div>
        </div>
      </div>
    </div>
  );
}

function OutOfScopeSection() {
  return (
    <div className="flex flex-col gap-[20px]">
      <p className="text-[13px] text-[#6b6b6b] bg-[#f4f4f5] rounded-[10px] px-[14px] py-[10px] max-w-[820px]">
        D7, D15, D17 і D22 вже вирішені (позначено зелено). D16 лишається поза скоупом як великий блок продуктової логіки.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
        <ReferenceCard
          id="d7" resolved
          title="PRIORITY_CFG/TYPE_CFG — тепер один спільний модуль"
          description="Кожен з 6 файлів мав власну копію кольорів/іконок пріоритету й типу — копії вже розходились (D5/D6 — наслідок саме цього)."
          decision="Додано PRIORITY_ICONS/TYPE_ICONS у useWorkflowConfig.js; живі sprint, search, issue та analytics компоненти будують CFG з DEFAULT_PRIORITIES/DEFAULT_TYPES + цих мап."
        />
        <ReferenceCard
          id="d15" resolved
          title="Модалки — спільний каркас, різний вміст"
          description="Рішення власника: розмір і вміст можуть різнитись, але заголовок, хрестик, радіус, відступи і футер-кнопки мають бути однакові."
          decision="CreateTaskModal вирівняно з BoardConfigModal: хрестик тепер kit Button (був сирий), header px-6 py-4, backdrop bg-black/40 blur-sm скрізь (було 20/60), кнопку submit винесено в спільний футер (bg-[#f4f4f5], Скасувати + Створити). IssueModal — лише backdrop вирівняно, вміст лишився делегованим до IssueDetail."
        />
        <ReferenceCard id="d16" level="low" title="CommentThread/TimeLogDisplay/TeamMemberCard дублюють IssueDetail/ProjectTeamTab" description="Великі блоки логіки, а не дрібні елементи — за політикою не чіпаємо. Не піднімалось у цій хвилі." />
        <ReferenceCard
          id="d17" resolved
          title="EmptyState — тепер kit-компонент у чаті"
          description="Порожній стан чату («Ще немає повідомлень») був саморобним блоком — замінено на kit EmptyState (той самий вигляд: іконка, заголовок, підпис)."
          decision="chat/page.js: блок з іконкою+двома <p> замінено на <EmptyState icon={MessageSquare} title={...} description={...} />."
        />
        <ReferenceCard
          id="d22" resolved
          title="Непідключені BacklogTab і MaterialsTab видалено"
          description="Обидва компоненти мали нуль імпортів; MaterialsTab також працював з недозволеним у правилах legacy-шляхом projectFiles. Актуальний list view і QuickTeam+ materials залишилися в живих маршрутах."
          decision="Видалено як мертвий код; Git history зберігає реалізацію, якщо продуктове рішення зміниться."
        />
      </div>
    </div>
  );
}

const SECTION_MAP = {
  palette: <PaletteSection />,
  'priority-colors': <PriorityColorsSection />,
  kpi: <KpiSection />,
  badge: <BadgeSection />,
  priority: <PrioritySection />,
  avatars: <AvatarsSection />,
  'copy-btn': <CopyButtonSection />,
  'chat-icons': <ChatIconsSection />,
  'btn-color': <ButtonColorSection />,
  'btn-radius': <ButtonRadiusSection />,
  radii: <RadiiSection />,
  unused: <UnusedSection />,
  'out-of-scope': <OutOfScopeSection />,
};

export default function UIDiffPage() {
  const [activeSection, setActiveSection] = useState('palette');
  const current = SECTIONS.find(s => s.id === activeSection);

  return (
    <div className="w-full h-full flex overflow-hidden bg-[#f5f5f5]">
      {/* ── Left Nav ── */}
      <div className="w-[240px] shrink-0 h-full flex flex-col p-[12px] pr-[6px]">
        <div className="bg-[#1f1f1f] rounded-[20px] h-full flex flex-col overflow-hidden">
          <div className="px-[20px] pt-[20px] pb-[16px] border-b border-white/10 shrink-0">
            <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-[2px]">Internal · Not in nav</div>
            <div className="text-[17px] font-bold text-white">UI DIFF</div>
            <div className="text-[10px] text-white/30 mt-[1px]">Поточне vs UI Kit, D1–D22</div>
          </div>
          <nav className="flex-1 overflow-y-auto p-[10px] flex flex-col gap-[14px]">
            {GROUPS.map(g => (
              <div key={g.title} className="flex flex-col gap-[3px]">
                <div className="px-[12px] py-[4px] text-[8px] font-bold text-white/30 uppercase tracking-widest">
                  {g.title}
                </div>
                {g.items.map(s => {
                  const Icon = s.icon;
                  const active = s.id === activeSection;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setActiveSection(s.id)}
                      className={`w-full flex items-center gap-[9px] px-[12px] h-[30px] rounded-[8px] text-[12px] font-semibold transition-all text-left ${active ? 'bg-white text-[#1f1f1f] shadow-sm' : 'text-white/50 hover:text-white hover:bg-white/8'}`}
                    >
                      <Icon size={13} className="shrink-0" />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="px-[20px] py-[14px] border-t border-white/10 shrink-0">
            <div className="text-[10px] text-white/25 leading-relaxed">
              Рішення пиши в чаті:<br />
              «D1 — ок», «D9 — заміняємо».
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 h-full flex flex-col overflow-hidden p-[12px] pl-[6px]">
        <div className="flex-1 flex flex-col bg-white rounded-[24px] overflow-hidden border border-[#f0f0f0]">
          <div className="flex items-center justify-between px-[32px] py-[18px] border-b border-[#f0f0f0] shrink-0">
            <div>
              <h1 className="text-[24px] font-bold text-[#1f1f1f]">{current?.label}</h1>
              <p className="text-[12px] text-[#9a9a9a] mt-[2px]">Ліворуч — як зараз у коді. Праворуч — UI Kit / пропозиція. Живий рендер, не мокап.</p>
            </div>
            <div className="flex items-center gap-[6px] px-[12px] h-[28px] bg-[#f4f4f5] rounded-[8px]">
              <div className="w-[6px] h-[6px] rounded-full bg-[#f59e0b]" />
              <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide">INTERNAL ONLY · /ui-diff</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-[32px] py-[32px]">
            {SECTION_MAP[activeSection]}
          </div>
        </div>
      </div>
    </div>
  );
}
