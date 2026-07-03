'use client';
import React, { useState } from 'react';
import Button from '@/components/ui/Button';
import ButtonGroup from '@/components/ui/Button/ButtonGroup';
import SplitButton from '@/components/ui/Button/SplitButton';
import StatusBadge from '@/components/ui/DataDisplay/StatusBadge';
import PriorityBadge from '@/components/ui/DataDisplay/PriorityBadge';
import KitKpiCard from '@/components/ui/DataDisplay/KpiCard';
import KitAvatar from '@/components/ui/DataDisplay/Avatar';
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
import UserAvatar from '@/components/UserAvatar';
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

function ReferenceCard({ id, level = 'low', title, description }) {
  return (
    <div id={id} className="flex flex-col gap-[6px] bg-white border border-[#f0f0f0] rounded-[16px] p-[20px]">
      <div className="flex items-center gap-[10px]">
        <span className="text-[11px] font-bold px-[8px] py-[2px] rounded-[6px] bg-[#1f1f1f] text-white tracking-wide">{id.toUpperCase()}</span>
        <PriorityDot level={level} />
      </div>
      <h4 className="text-[14px] font-bold text-[#1f1f1f] mt-[4px]">{title}</h4>
      <p className="text-[12px] text-[#9a9a9a] leading-relaxed">{description}</p>
    </div>
  );
}

// Внутрішні (неекспортовані) хардкоджені версії з реального коду —
// відтворені 1:1, щоб порівняння було чесним.
function LocalKpiCard({ icon: Icon, label, value, sub, color = '#6366f1', trend }) {
  return (
    <div className="bg-[#f4f4f5] rounded-[24px] p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-[12px] flex items-center justify-center" style={{ background: color + '18' }}>
          <Icon size={16} style={{ color }} />
        </div>
        {trend != null && (
          <span className={`text-[11px] font-semibold flex items-center gap-1 ${trend >= 0 ? 'text-[#10b981]' : 'text-red-500'}`}>
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-[28px] font-bold text-[#1f1f1f] leading-none mb-1">{value}</p>
      <p className="text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wide">{label}</p>
      {sub && <p className="text-[11px] text-[#cfcfcf] mt-1">{sub}</p>}
    </div>
  );
}

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
      <DiffBlock
        id="d5" level="high"
        title="Пріоритет Blocker — два різні червоні"
        description="Дошка (IssueCard, реальні задачі) використовує #dc2626. Але UI Kit PriorityBadge малює крапку (#ef4444) іншим відтінком за текст (#dc2626), і той самий #ef4444 повторюється у фільтрах на сторінці проєкту/аналітики."
        currentLabel="ФІЛЬТРИ (dotColor='#ef4444')"
        proposedLabel="ДОШКА / DEFAULT_PRIORITIES (#dc2626)"
        current={<Swatch hex="#ef4444" label="фільтр пріоритету, projectId/page.js" />}
        proposed={<Swatch hex="#dc2626" label="IssueCard, BacklogTab, DEFAULT_PRIORITIES" />}
        note="UI Kit PriorityBadge сам собі суперечить: крапка #ef4444, текст #dc2626 — вибери один і для kit-компонента, і для фільтрів."
      />
      <DiffBlock
        id="d6" level="high"
        title="Пріоритет Low — сірий чи синій?"
        description="Дошка і PriorityBadge малюють low сірим (узгоджено між собою). Фільтри на 7 сторінках красять low синім — той самий пріоритет виглядає як зовсім інший статус."
        currentLabel="ФІЛЬТРИ (dotColor='#3b82f6')"
        proposedLabel="ДОШКА / PriorityBadge (#9a9a9a)"
        current={<Swatch hex="#3b82f6" label="7 файлів: сторінка проєкту, аналітика, sprints…" />}
        proposed={<Swatch hex="#9a9a9a" label="IssueCard, BacklogTab, PriorityBadge kit" />}
      />
    </div>
  );
}

function KpiSection() {
  return (
    <DiffBlock
      id="d8" level="medium"
      title="KPI-картка задубльована"
      description="AnalyticsTab.jsx має власну, невелику копію KPI-картки замість готової з UI Kit. Візуально майже ідентична (кит трохи темніший радіус іконки й трохи інший розмір цифри — 26px замість 28px)."
      current={<LocalKpiCard icon={Clock} label="ЗАВДАНЬ" value="24" color="#6366f1" trend={12} />}
      proposed={<KitKpiCard icon={Clock} label="ЗАВДАНЬ" value="24" color="#6366f1" trend={12} />}
      currentFile="src/components/workspace/AnalyticsTab.jsx:27 (локальна функція KpiCard)"
      proposedFile="src/components/ui/DataDisplay/KpiCard.jsx"
    />
  );
}

function BadgeSection() {
  return (
    <DiffBlock
      id="d9" level="medium"
      title="Бейдж статусу задубльований"
      description="BacklogTab.jsx (нині мертвий файл) має власну локальну Badge-функцію для статусу колонки. У кіті вже є StatusBadge, який бере колір і назву прямо з workflow-конфігурації — тобто сам синхронізується з Налаштуваннями, а локальна копія — ні."
      current={<LocalBacklogBadge label="Code Review" color="#9a9a9a" />}
      proposed={<StatusBadge status="code-review" />}
      currentFile="src/components/workspace/BacklogTab.jsx:26 (локальна функція Badge)"
      proposedFile="src/components/ui/DataDisplay/StatusBadge.jsx"
    />
  );
}

function PrioritySection() {
  return (
    <DiffBlock
      id="d10" level="high"
      title="Пріоритет — крапка+текст вручну, замість готового PriorityBadge"
      description="У беклозі й на дошці пріоритет малюється вручну іконкою + кольоровим текстом. У кіті вже є готовий PriorityBadge (0 використань у застосунку) — той самий сенс, компактніше, і колір лежить в одному місці."
      current={
        <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: '#dc2626' }}>
          <span className="w-[8px] h-[8px] rounded-full inline-block" style={{ background: '#dc2626' }} /> blocker
        </span>
      }
      proposed={<PriorityBadge priority="blocker" />}
      currentFile="src/components/workspace/BacklogTab.jsx:198 (ручний рендер), AgileBoard/IssueCard — свій варіант"
      proposedFile="src/components/ui/DataDisplay/PriorityBadge.jsx"
    />
  );
}

function AvatarsSection() {
  return (
    <DiffBlock
      id="d11" level="high"
      title="Аватарки трьома різними способами"
      description="У застосунку є три шляхи показати аватар користувача: правильний UserAvatar (детермінований колір з ініціалів, тултіп) — це фактичний стандарт; kit-компонент Avatar (завжди фіолетовий фон, без детермінованого кольру) — гірша версія, майже не використовується; і сирий <img> з фолбеком на зовнішній ui-avatars.com у мертвому BacklogTab."
      currentLabel="СИРИЙ <img> + ui-avatars.com"
      proposedLabel="UserAvatar (фактичний стандарт застосунку)"
      current={
        // eslint-disable-next-line @next/next/no-img-element
        <img src="https://ui-avatars.com/api/?name=Ivan&size=32" alt="Ivan" className="w-[32px] h-[32px] rounded-full ring-[1.5px] ring-white object-cover" />
      }
      proposed={<UserAvatar user={{ name: 'Ivan Petrenko' }} size={32} />}
      currentFile="src/components/workspace/BacklogTab.jsx:206"
      proposedFile="src/components/UserAvatar.jsx"
      note={<>Третій варіант, kit-компонент <code>ui/DataDisplay/Avatar.jsx</code>, теж живий, але завжди малює фіолетовий фон незалежно від користувача — вважаю його гіршою копією <code>UserAvatar</code>, кандидат на видалення, а не на використання. Показую поруч: <span className="inline-flex align-middle mx-1"><KitAvatar initials="ІП" /></span></>}
    />
  );
}

function CopyButtonSection() {
  return (
    <DiffBlock
      id="d12" level="medium"
      title="Кнопка копіювання — нативна іконка замість Button"
      description="У розділі Інтеграцій (BuggyBag) дві кнопки копіювання зроблені сирим <button> з іконкою. У профілі організації такий самий елемент вже переведено на Button size='icon-sm' (хвиля E) — лишилось привести ці два."
      current={<button className="text-[#9a9a9a] hover:text-[#1f1f1f] transition-colors"><Copy size={14} /></button>}
      proposed={<Button style="ghost" color="blue" size="icon-sm" icon={Copy} iconSize={12} />}
      currentFile="src/app/workspace/settings/page.js:1195,1202"
      proposedFile="вже застосовано для Organization ID у той самій формі"
    />
  );
}

function ChatIconsSection() {
  return (
    <DiffBlock
      id="d14" level="medium"
      title="Іконки-дії повідомлення в чаті"
      description="Hover-кнопки під повідомленням (відповісти, закріпити, редагувати, видалити) — нативні 28×28px кнопки. Kit-розмір icon-sm — теж рівно 28px, тобто заміна суто механічна, без зміни верстки."
      current={
        <button className="w-7 h-7 flex items-center justify-center rounded-lg text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f4f4f5] transition-colors" title="Відповісти в гілку">
          <MessageSquare size={15} />
        </button>
      }
      proposed={<Button style="ghost" size="icon-sm" icon={MessageSquare} iconSize={15} />}
      currentFile="src/app/workspace/chat/page.js (MessageBubble, ~4 кнопки на повідомлення)"
    />
  );
}

function ButtonColorSection() {
  return (
    <DiffBlock
      id="d18" level="high"
      title="Button мовчки ігнорує color=&quot;blue&quot;/&quot;green&quot;/&quot;gray&quot;"
      description="У коді є виклики Button з color=&quot;blue&quot; (копіювання Org ID), color=&quot;gray&quot; (кнопка «Скинути») — але компонент підтримує лише dark/red, тому обидва мовчки стають чорними. Розробник, який писав color=&quot;blue&quot;, очікував побачити синю кнопку."
      currentLabel="ЩО НАПИСАНО В КОДІ (color=&quot;blue&quot;)"
      proposedLabel="ЩО РЕАЛЬНО РЕНДЕРИТЬСЯ ЗАРАЗ"
      current={<div className="flex flex-col items-start gap-1"><Button style="ghost" color="blue" size="md" icon={Copy}>Мало бути синім</Button><span className="text-[10px] text-[#b91c1c]">задумано: текст синього кольору</span></div>}
      proposed={<div className="flex flex-col items-start gap-1"><Button style="ghost" color="blue" size="md" icon={Copy}>Насправді чорне</Button><span className="text-[10px] text-[#9a9a9a]">Button.jsx:68 звужує колір до dark/red</span></div>}
      note="Це не «поточне vs kit» — це один і той самий рендер, показаний двічі, щоб було видно розрив між тим, що написано в коді, і тим, що бачить користувач. Рішення (= T35): або додати blue/green у палітру Button, або прибрати ці кольори з викликів."
    />
  );
}

function ButtonRadiusSection() {
  return (
    <DiffBlock
      id="d19" level="medium"
      title="Перекриття радіуса кнопки в Налаштуваннях"
      description="Кнопка «Зберегти» в Налаштуваннях додає className=&quot;rounded-xl px-6&quot; поверх Button — rounded-xl це 12px, а стандартний радіус Button 10px. Виходять дві трохи різні геометрії кнопок в одному застосунку."
      current={<Button style="primary" size="lg" className="rounded-xl px-6">Зберегти профіль</Button>}
      proposed={<Button style="primary" size="lg">Зберегти профіль</Button>}
      currentFile="src/app/workspace/settings/page.js (renderSaveButton)"
      proposedFile="стандартний Button, без перекриття"
    />
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
        Ці пункти з дизайн-ревю навмисно без візуального порівняння — вони або великі лейаути (за твоєю політикою не перебудовуємо), або суто архітектурні, не про вигляд.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
        <ReferenceCard id="d7" level="medium" title="PRIORITY_CFG/TYPE_CFG скопійовані в ~6 файлів" description="Архітектурне: кожна копія конфігурації кольорів може розійтися незалежно (D5/D6 — вже наслідок). Кандидат на один спільний файл у lib/, не про вигляд." />
        <ReferenceCard id="d15" level="low" title="Модалки CreateTaskModal/IssueModal/BoardConfigModal" description="Власні оверлеї, не ui-kit Dialog. Великі форми — за твоєю політикою не перебудовуємо." />
        <ReferenceCard id="d16" level="low" title="CommentThread/TimeLogDisplay/TeamMemberCard дублюють IssueDetail/ProjectTeamTab" description="Великі блоки логіки, а не дрібні елементи — за політикою не чіпаємо." />
        <ReferenceCard id="d17" level="medium" title="EmptyState kit vs саморобні заглушки в чаті/беклозі" description="Дрібний елемент, теоретично можна підставити — але завжди всередині великого лейаута, тому переносжу сюди для явного рішення, а не мовчки роблю." />
        <ReferenceCard id="d22" level="medium" title="BacklogTab.jsx і MaterialsTab.jsx — мертвий код" description="Ніде не імпортуються. Питання не дизайнерське: видалити чи повернути в застосунок?" />
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
