'use client';
import React, { useState } from 'react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { HeaderSearch } from '@/components/ui/Forms/HeaderSearch';
import { Textarea } from '@/components/ui/Forms/Textarea';
import { Select, MultiSelect } from '@/components/ui/Select';
import Tabs from '@/components/ui/Tabs';
import FilterBar from '@/components/ui/FilterBar';
import Surface from '@/components/ui/Surface';
import ContextMenu from '@/components/ui/ContextMenu';
import {
  ButtonGroup, AvatarGroup, Breadcrumb, FormGroup, Badge, StatusBadge, PriorityBadge, Tag, Counter,
  Checkbox, RadioButton, ToggleSwitch, DatePicker, TimePicker, FileInput, SearchInput,
  ProgressRing, Chip, Stat, Alert, Toast, LoadingSpinner, EmptyState, Pagination, Stepper,
  Dropdown, Popover, Tooltip, TaskAttributesPanel, Progress, KpiCard, Table,
  SidebarLayout, InnerNavigation, PageHeader
} from '@/components/ui';
import Dialog from '@/components/ui/Dialog';
import TopHeader from '@/components/ui/Layout/TopHeader';
import WorkspaceHeader from '@/components/WorkspaceHeader';
import WorkspaceSidebar from '@/components/WorkspaceSidebar';
import TaskCard from '@/components/ui/TaskManagement/TaskCard';
import TaskRow from '@/components/ui/TaskManagement/TaskRow';
import ProjectCard from '@/components/ui/TaskManagement/ProjectCard';
import TeamMemberCard from '@/components/ui/TaskManagement/TeamMemberCard';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { DEFAULT_STATUSES, DEFAULT_PRIORITIES, DEFAULT_TYPES } from '@/lib/hooks/useWorkflowConfig';
import {
  Plus, Edit2, Trash2, Archive, Search, ChevronRight, ChevronDown,
  User, Bell, Settings, Settings2, Check, X, AlertCircle, Info,
  LayoutGrid, Type, Palette, Square, AlignLeft, ToggleLeft,
  Layers, MessageSquare, Zap, Hash, Calendar, Clock, Filter,
  ArrowUp, ArrowDown, Minus, Star, Bug, CheckSquare, Flag,
  Play, Pause, RefreshCw, MoreVertical, Copy, ExternalLink,
  TrendingUp, BarChart2, PieChart, Users, Folder, Tag as TagIcon, Lock,
  Globe, Eye, EyeOff, Upload, Download, Link, Paperclip,
  ChevronLeft, ChevronsUpDown, GripVertical, Move, Columns,
  List, Table as TableIcon, Kanban, Activity, Target, Award,
  PanelLeftOpen, Building
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// NAV SECTIONS
// ─────────────────────────────────────────────────────────────────────────────

const GROUPS = [
  {
    title: 'Атоми (Atoms)',
    items: [
      { id: 'tokens',       label: 'Design Tokens',      icon: Palette },
      { id: 'typography',   label: 'Typography',         icon: Type },
      { id: 'buttons',      label: 'Buttons',            icon: Square },
      { id: 'inputs',       label: 'Inputs, Selectors & Pickers',  icon: AlignLeft },
      { id: 'selects',      label: 'Selects & Dropdowns',icon: ToggleLeft },
      { id: 'tabs',         label: 'Tabs',               icon: LayoutGrid },
      { id: 'badges',       label: 'Badges, Status & Priority', icon: Hash },
      { id: 'avatars',      label: 'Avatars & Teams',    icon: Users },
      { id: 'surfaces',     label: 'Surfaces',           icon: Layers },
      { id: 'breadcrumbs',  label: 'Breadcrumbs',        icon: ChevronRight },
      { id: 'tooltips',     label: 'Tooltips',           icon: MessageSquare },
    ]
  },
  {
    title: 'Молекули (Molecules)',
    items: [
      { id: 'button-groups',label: 'Button Groups',      icon: Columns },
      { id: 'avatar-groups',label: 'Avatar Groups',      icon: Users },
      { id: 'form-groups',  label: 'Form Groups',        icon: AlignLeft },
      { id: 'task-attributes', label: 'Task Attributes Panel', icon: Settings },
      { id: 'filters',      label: 'Filter Bar',         icon: Filter },
      { id: 'navigation-overlays', label: 'Navigation & Overlays', icon: MoreVertical },
      { id: 'progress',     label: 'Progress & Stats',   icon: TrendingUp },
      { id: 'feedback',     label: 'Feedback & States',  icon: Bell },
    ]
  },
  {
    title: 'Організми (Organisms)',
    items: [
      { id: 'task-crm',     label: 'Task & CRM Cards',   icon: CheckSquare },
      { id: 'dialogs',      label: 'Dialogs & Modals',   icon: MessageSquare },
    ]
  },
  {
    title: 'Лейаути (Layouts)',
    items: [
      { id: 'headers',           label: 'Header (Хедер)',                 icon: LayoutGrid },
      { id: 'page-headers',      label: 'Page Header (Шапка)',            icon: Type },
      { id: 'sidebar-layout',    label: 'Sidebar + Main Content',         icon: PanelLeftOpen },
      { id: 'inner-nav-layout',  label: 'Inner Navigation + Main Content', icon: List },
    ]
  }
];

const SECTIONS = GROUPS.flatMap(g => g.items);

// ─────────────────────────────────────────────────────────────────────────────
// PREVIEW WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

function PreviewBlock({ title, description, children, filePath, fullWidth = false, dark = false }) {
  const [copied, setCopied] = useState(false);

  const copyPath = () => {
    if (!filePath) return;
    navigator.clipboard.writeText(filePath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-[12px]">
      <div className="flex items-start justify-between w-full">
        <div>
          <h3 className="text-[16px] font-bold text-[#1f1f1f]">{title}</h3>
          {description && <p className="text-[12px] text-[#9a9a9a] mt-[2px]">{description}</p>}
        </div>
        {filePath && (
          <button
            onClick={copyPath}
            title={`Клацніть, щоб скопіювати шлях: ${filePath}`}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[#f4f4f5] hover:bg-[#e9e9e9] border border-[#e2e2e4] text-[#71717a] hover:text-[#18181b] text-[11px] font-mono transition-all font-semibold active:scale-95 shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
              <path d="M6 6h10"/>
              <path d="M6 10h10"/>
            </svg>
            <span>{copied ? 'Скопійовано!' : filePath.split('/').pop()}</span>
          </button>
        )}
      </div>
      <div className={`rounded-[16px] p-[24px] ${dark ? 'bg-[#1f1f1f]' : 'bg-white border border-[#f0f0f0]'} ${fullWidth ? '' : 'flex flex-wrap items-center gap-[12px]'}`}>
        {children}
      </div>
    </div>
  );
}

function TokenChip({ label, value, isColor = false }) {
  return (
    <div className="flex items-center gap-[10px] bg-white rounded-[10px] px-[14px] py-[10px] border border-[#f0f0f0]">
      {isColor && <div className="w-[24px] h-[24px] rounded-[6px] shrink-0 border border-[#f0f0f0]" style={{ backgroundColor: value }} />}
      <div>
        <div className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wide">{label}</div>
        <div className="text-[13px] font-semibold text-[#1f1f1f] font-mono">{value}</div>
      </div>
    </div>
  );
}

// Status dot helper
function StatusDot({ color }) {
  return <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ backgroundColor: color }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────



function ButtonsSection() {
  return (
    <div className="flex flex-col gap-[40px]">
      {/* ─── Primary Buttons ─── */}
      <PreviewBlock title="Primary Buttons" description="Головні дії. Кольори: фон #1f1f1f (hover #303030), текст #ffffff. Небезпечна дія (danger, color=red): фон #ef4444. Скруглення (border-radius): 10px для всіх розмірів. Висота: Large 36px, Medium 32px, Small 28px." fullWidth>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#f0f0f0]">
                <th className="pb-3 text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider w-[240px]">Стан / Конфігурація</th>
                <th className="pb-3 text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider w-[220px]">Large — 36px (lg)</th>
                <th className="pb-3 text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider w-[220px]">Medium — 32px (md)</th>
                <th className="pb-3 text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider">Small — 28px (sm)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f4f4f5]">
              <tr className="align-middle">
                <td className="py-4 text-[13px] font-semibold text-[#1f1f1f]">Default (Текст)</td>
                <td className="py-4"><Button style="primary" size="lg">Зберегти</Button></td>
                <td className="py-4"><Button style="primary" size="md">Зберегти</Button></td>
                <td className="py-4"><Button style="primary" size="sm">Зберегти</Button></td>
              </tr>
              <tr className="align-middle">
                <td className="py-4 text-[13px] font-semibold text-[#1f1f1f]">З іконкою</td>
                <td className="py-4"><Button style="primary" size="lg" icon={Plus}>Новий проєкт</Button></td>
                <td className="py-4"><Button style="primary" size="md" icon={Plus}>Новий проєкт</Button></td>
                <td className="py-4"><Button style="primary" size="sm" icon={Plus}>Додати</Button></td>
              </tr>
              <tr className="align-middle">
                <td className="py-4 text-[13px] font-semibold text-[#1f1f1f]">Завантаження (loading)</td>
                <td className="py-4"><Button style="primary" size="lg" loading>Збереження...</Button></td>
                <td className="py-4"><Button style="primary" size="md" loading>Збереження...</Button></td>
                <td className="py-4"><Button style="primary" size="sm" loading>Збереження...</Button></td>
              </tr>
              <tr className="align-middle">
                <td className="py-4 text-[13px] font-semibold text-[#1f1f1f]">Вимкнено (disabled)</td>
                <td className="py-4"><Button style="primary" size="lg" disabled>Недоступно</Button></td>
                <td className="py-4"><Button style="primary" size="md" disabled>Недоступно</Button></td>
                <td className="py-4"><Button style="primary" size="sm" disabled>Недоступно</Button></td>
              </tr>
              <tr className="align-middle">
                <td className="py-4 text-[13px] font-semibold text-[#1f1f1f]">Небезпечна дія (danger, color=red)</td>
                <td className="py-4"><Button style="primary" color="red" size="lg" icon={Trash2}>Видалити проєкт</Button></td>
                <td className="py-4"><Button style="primary" color="red" size="md" icon={Trash2}>Видалити</Button></td>
                <td className="py-4"><Button style="primary" color="red" size="sm" icon={Trash2}>Видалити</Button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </PreviewBlock>

      {/* ─── Secondary Buttons ─── */}
      <PreviewBlock title="Secondary Buttons" description="Другорядні дії. Кольори: фон #f5f5f5 (hover #ebebeb), текст #1f1f1f. Небезпечна дія (danger, color=red): фон #f5f5f5, текст #ef4444. Скруглення: 10px для всіх розмірів. Висота: Large 36px, Medium 32px, Small 28px." fullWidth>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#f0f0f0]">
                <th className="pb-3 text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider w-[240px]">Стан / Конфігурація</th>
                <th className="pb-3 text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider w-[220px]">Large — 36px (lg)</th>
                <th className="pb-3 text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider w-[220px]">Medium — 32px (md)</th>
                <th className="pb-3 text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider">Small — 28px (sm)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f4f4f5]">
              <tr className="align-middle">
                <td className="py-4 text-[13px] font-semibold text-[#1f1f1f]">Default (Текст)</td>
                <td className="py-4"><Button style="secondary" size="lg">Скасувати</Button></td>
                <td className="py-4"><Button style="secondary" size="md">Скасувати</Button></td>
                <td className="py-4"><Button style="secondary" size="sm">Скасувати</Button></td>
              </tr>
              <tr className="align-middle">
                <td className="py-4 text-[13px] font-semibold text-[#1f1f1f]">З іконкою</td>
                <td className="py-4"><Button style="secondary" size="lg" icon={Archive}>Архівувати</Button></td>
                <td className="py-4"><Button style="secondary" size="md" icon={Archive}>Архівувати</Button></td>
                <td className="py-4"><Button style="secondary" size="sm" icon={Plus}>Додати</Button></td>
              </tr>
              <tr className="align-middle">
                <td className="py-4 text-[13px] font-semibold text-[#1f1f1f]">Завантаження (loading)</td>
                <td className="py-4"><Button style="secondary" size="lg" loading>Завантаження...</Button></td>
                <td className="py-4"><Button style="secondary" size="md" loading>Завантаження...</Button></td>
                <td className="py-4"><Button style="secondary" size="sm" loading>Завантаження...</Button></td>
              </tr>
              <tr className="align-middle">
                <td className="py-4 text-[13px] font-semibold text-[#1f1f1f]">Вимкнено (disabled)</td>
                <td className="py-4"><Button style="secondary" size="lg" disabled>Недоступно</Button></td>
                <td className="py-4"><Button style="secondary" size="md" disabled>Недоступно</Button></td>
                <td className="py-4"><Button style="secondary" size="sm" disabled>Недоступно</Button></td>
              </tr>
              <tr className="align-middle">
                <td className="py-4 text-[13px] font-semibold text-[#1f1f1f]">Небезпечна дія (danger, color=red)</td>
                <td className="py-4"><Button style="secondary" color="red" size="lg" icon={Trash2}>Видалити проєкт</Button></td>
                <td className="py-4"><Button style="secondary" color="red" size="md" icon={Trash2}>Видалити</Button></td>
                <td className="py-4"><Button style="secondary" color="red" size="sm" icon={Trash2}>Видалити</Button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </PreviewBlock>

      {/* ─── Ghost Buttons ─── */}
      <PreviewBlock title="Ghost Buttons" description="Безмежові прозорі дії. Кольори: фон transparent (hover #f0f0f0), текст #9a9a9a (hover #1f1f1f). Небезпечна дія (danger, color=red): текст #ef4444. Скруглення: 10px для всіх розмірів. Висота: Large 36px, Medium 32px, Small 28px." fullWidth>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#f0f0f0]">
                <th className="pb-3 text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider w-[240px]">Стан / Конфігурація</th>
                <th className="pb-3 text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider w-[220px]">Large — 36px (lg)</th>
                <th className="pb-3 text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider w-[220px]">Medium — 32px (md)</th>
                <th className="pb-3 text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider">Small — 28px (sm)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f4f4f5]">
              <tr className="align-middle">
                <td className="py-4 text-[13px] font-semibold text-[#1f1f1f]">Default (Текст)</td>
                <td className="py-4"><Button style="ghost" size="lg">Детальніше</Button></td>
                <td className="py-4"><Button style="ghost" size="md">Детальніше</Button></td>
                <td className="py-4"><Button style="ghost" size="sm">Детальніше</Button></td>
              </tr>
              <tr className="align-middle">
                <td className="py-4 text-[13px] font-semibold text-[#1f1f1f]">З іконкою</td>
                <td className="py-4"><Button style="ghost" size="lg" icon={ExternalLink}>Відкрити</Button></td>
                <td className="py-4"><Button style="ghost" size="md" icon={ExternalLink}>Відкрити</Button></td>
                <td className="py-4"><Button style="ghost" size="sm" icon={ExternalLink}>Відкрити</Button></td>
              </tr>
              <tr className="align-middle">
                <td className="py-4 text-[13px] font-semibold text-[#1f1f1f]">Завантаження (loading)</td>
                <td className="py-4"><Button style="ghost" size="lg" loading>Завантаження...</Button></td>
                <td className="py-4"><Button style="ghost" size="md" loading>Завантаження...</Button></td>
                <td className="py-4"><Button style="ghost" size="sm" loading>Завантаження...</Button></td>
              </tr>
              <tr className="align-middle">
                <td className="py-4 text-[13px] font-semibold text-[#1f1f1f]">Вимкнено (disabled)</td>
                <td className="py-4"><Button style="ghost" size="lg" disabled>Недоступно</Button></td>
                <td className="py-4"><Button style="ghost" size="md" disabled>Недоступно</Button></td>
                <td className="py-4"><Button style="ghost" size="sm" disabled>Недоступно</Button></td>
              </tr>
              <tr className="align-middle">
                <td className="py-4 text-[13px] font-semibold text-[#1f1f1f]">Небезпечна дія (danger, color=red)</td>
                <td className="py-4"><Button style="ghost" color="red" size="lg" icon={Trash2}>Видалити</Button></td>
                <td className="py-4"><Button style="ghost" color="red" size="md" icon={Trash2}>Видалити</Button></td>
                <td className="py-4"><Button style="ghost" color="red" size="sm" icon={Trash2}>Видалити</Button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </PreviewBlock>

      {/* ─── Icon-Only Buttons ─── */}
      <PreviewBlock title="Icon-Only Buttons" description="Кнопки без тексту. Текст всередині приховано через sr-only для доступності. Скруглення: 10px для всіх розмірів. Розміри: Large 36×36px (icon-lg), Medium 32×32px (icon), Small 28×28px (icon-sm).">
        <div className="flex flex-col gap-[20px] w-full">
          <div>
            <h4 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[8px]">Large — 36×36px (icon-lg)</h4>
            <div className="flex items-center gap-[8px]">
              <Button style="primary" size="icon-lg" icon={Plus}>Додати</Button>
              <Button style="secondary" size="icon-lg" icon={Edit2}>Редагувати</Button>
              <Button style="ghost" size="icon-lg" icon={Settings}>Налаштування</Button>
              <Button style="secondary" color="red" size="icon-lg" icon={Trash2}>Видалити</Button>
            </div>
          </div>
          <div>
            <h4 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[8px]">Medium — 32×32px (icon)</h4>
            <div className="flex items-center gap-[8px]">
              <Button style="primary" size="icon" icon={Plus}>Додати</Button>
              <Button style="secondary" size="icon" icon={Edit2}>Редагувати</Button>
              <Button style="ghost" size="icon" icon={Settings}>Налаштування</Button>
              <Button style="secondary" color="red" size="icon" icon={Trash2}>Видалити</Button>
            </div>
          </div>
          <div>
            <h4 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[8px]">Small — 28×28px (icon-sm)</h4>
            <div className="flex items-center gap-[8px]">
              <Button style="primary" size="icon-sm" icon={Plus}>Додати</Button>
              <Button style="secondary" size="icon-sm" icon={Edit2}>Редагувати</Button>
              <Button style="ghost" size="icon-sm" icon={Settings}>Налаштування</Button>
              <Button style="secondary" color="red" size="icon-sm" icon={Trash2}>Видалити</Button>
            </div>
          </div>
        </div>
      </PreviewBlock>
    </div>
  );
}

function InputsSection() {
  const [val, setVal] = useState('');
  const [pw, setPw] = useState('');
  const [headerVal, setHeaderVal] = useState('');
  const [show, setShow] = useState(false);

  // States for new input types
  const [chk, setChk] = useState(false);
  const [rdo, setRdo] = useState('one');
  const [tgl, setTgl] = useState(true);
  const [dateSingle, setDateSingle] = useState('');
  const [timeVal, setTimeVal] = useState('');
  const [fileVal, setFileVal] = useState([]);
  const [srchVal, setSrchVal] = useState('');

  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Standard Input — 36px" description="Стандартні текстові поля. Висота: 36px. Кольори: фон #f4f4f5, рамка transparent, фокус-рамка #1f1f1f. Текст #1f1f1f, placeholder #cfcfcf. Скруглення: 10px." fullWidth>
        <div className="max-w-[400px] flex flex-col gap-[12px]">
          <Input placeholder="Введіть text..." value={val} onChange={e => setVal(e.target.value)} />
          <Input placeholder="Заблоковане поле" disabled />
        </div>
      </PreviewBlock>

      <PreviewBlock title="Checkbox, Radio & Toggle" description="Кнопки вибору та перемикачі. Checkbox скруглений відповідно до розміру (L4). Radio - класичний. Toggle - округлена пігулка.">
        <div className="flex items-center gap-[24px] flex-wrap">
          <Checkbox checked={chk} onChange={setChk} label="Я погоджуюся з умовами" id="chk-demo" />
          <RadioButton
            name="radio-demo"
            value={rdo}
            onChange={setRdo}
            options={[
              { label: 'Варіант 1', value: 'one' },
              { label: 'Варіант 2', value: 'two' },
            ]}
            layout="horizontal"
          />
          <ToggleSwitch checked={tgl} onChange={setTgl} label="Активний спринт" />
        </div>
      </PreviewBlock>

      <PreviewBlock title="Pickers: Date & Time" description="Інструменти вибору дати та часу. DatePicker містить випадаючий календар (L2), а TimePicker інтегрований у висоту 36px із заокругленням 10px (L2.5)." fullWidth>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px] max-w-[500px]">
          <div>
            <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[6px] block">Оберіть дату</label>
            <DatePicker value={dateSingle} onChange={setDateSingle} placeholder="Оберіть день..." />
          </div>
          <div>
            <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[6px] block">Оберіть час</label>
            <TimePicker value={timeVal} onChange={setTimeVal} />
          </div>
        </div>
      </PreviewBlock>

      <PreviewBlock title="SearchInput & FileInput" description="Пошук із вбудованою іконкою та FileInput із зоною завантаження (L2.5)." fullWidth>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px] max-w-[600px]">
          <div>
            <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[6px] block">Пошуковий запит</label>
            <SearchInput value={srchVal} onChange={setSrchVal} placeholder="Швидкий пошук..." />
          </div>
          <div>
            <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[6px] block">Завантаження файлів</label>
            <FileInput value={fileVal} onChange={setFileVal} multiple />
          </div>
        </div>
      </PreviewBlock>

      <PreviewBlock title="Header Search Input — 36px" description="Спеціальний безмежовий пошук для хедера. Кольори: фон transparent, нижня рамка фокусу #1f1f1f. Текст #1f1f1f, placeholder #cfcfcf, іконка #9a9a9a." fullWidth>
        <div className="max-w-[400px]">
          <HeaderSearch value={headerVal} onChange={setHeaderVal} placeholder="Пошук по робочому простору..." />
        </div>
      </PreviewBlock>

      <PreviewBlock title="With Icon" description="icon prop — Search, Calendar, User, etc." fullWidth>
        <div className="flex flex-col gap-[10px] max-w-[400px]">
          <Input placeholder="Пошук..." icon={Search} />
          <Input placeholder="Email адреса" icon={User} />
          <Input placeholder="Дата" icon={Calendar} />
        </div>
      </PreviewBlock>

      <PreviewBlock title="Password / Toggle" description="Pattern for password fields with show/hide toggle." fullWidth>
        <div className="max-w-[400px]">
          <div className="relative">
            <Input type={show ? 'text' : 'password'} placeholder="Пароль" value={pw} onChange={e => setPw(e.target.value)} icon={Lock} />
            <button
              onClick={() => setShow(s => !s)}
              className="absolute right-[10px] top-1/2 -translate-y-1/2 text-[#9a9a9a] hover:text-[#1f1f1f] transition-colors"
            >
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
      </PreviewBlock>

      <PreviewBlock title="Validation State" description="error prop shows red border + error message below." fullWidth>
        <div className="max-w-[400px] flex flex-col gap-[10px]">
          <Input placeholder="Email" error="Невірна адреса електронної пошти" defaultValue="bad@" />
          <Input placeholder="Назва проєкту" error="Поле обов'язкове" />
        </div>
      </PreviewBlock>

      <PreviewBlock title="Inline: Input + Button" description="36px input + 36px button — zero-pixel alignment." fullWidth>
        <div className="flex items-center gap-[8px] max-w-[500px]">
          <Input placeholder="Введіть email для запрошення..." icon={User} />
          <Button style="primary" size="lg">Запросити</Button>
        </div>
      </PreviewBlock>

      <PreviewBlock title="Textarea" description="Багаторядкові текстові області. Кольори: фон #f4f4f5, фокус-рамка #1f1f1f. Скруглення: 10px. Зміна розміру (resize) вимкнена за замовчуванням." fullWidth>
        <div className="max-w-[500px] flex flex-col gap-[10px]">
          <Textarea placeholder="Опис завдання або проєкту..." rows={3} />
          <Textarea placeholder="Великий опис..." rows={6} />
        </div>
      </PreviewBlock>

      <PreviewBlock title="Form label pattern" description="Always 11px, bold, uppercase, tracking-wider, color #9a9a9a." fullWidth>
        <div className="max-w-[400px] flex flex-col gap-[16px]">
          <div>
            <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[6px] block">Назва проєкту *</label>
            <Input placeholder="Наприклад: Редизайн сайту" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[6px] block">Опис</label>
            <Textarea placeholder="Короткий опис..." rows={3} />
          </div>
        </div>
      </PreviewBlock>
    </div>
  );
}

function SelectsSection() {
  const [v1, setV1] = useState('');
  const [v2, setV2] = useState('');
  const [v3, setV3] = useState([]);
  const [v4, setV4] = useState('');
  const [v5, setV5] = useState([]);
  const [v6, setV6] = useState('in-progress');

  const statusOpts = DEFAULT_STATUSES.map(s => ({ value: s.id, label: s.label, dotColor: s.color }));
  const priorityOpts = DEFAULT_PRIORITIES.map(p => ({ value: p.id, label: p.label, dotColor: p.color }));
  const memberOpts = [
    { value: 'u1', label: 'Артур Моспан' },
    { value: 'u2', label: 'Іван Петренко' },
    { value: 'u3', label: 'Марина Коваль' },
    { value: 'u4', label: 'Дмитро Сірко' },
  ];

  return (
    <div className="flex flex-col gap-[40px]">
      {/* ─── Standard Selects ─── */}
      <PreviewBlock title="Standard Selects" description="Випадаючі списки для форм. Висота: 36px. Кольори: кнопка #f4f4f5 (hover #ebebeb), текст #1f1f1f, рамка випадаючого списку #f0f0f0, тінь dropdown. Скруглення: 10px. Опції містять кольорові маркери (dotColor)." fullWidth>
        <div className="flex items-center gap-[8px]">
          <Select options={statusOpts} value={v1} onChange={setV1} placeholder="Статус..." className="w-[180px]" />
          <Select options={priorityOpts} value={v2} onChange={setV2} placeholder="Пріоритет..." className="w-[160px]" />
        </div>
      </PreviewBlock>

      {/* ─── Ghost Select & MultiSelect ─── */}
      <PreviewBlock title="Ghost Select & MultiSelect" description="Безмежові селектори для панелей фільтрів (FilterBar). Висота: 28px (вбудована в FilterBar висотою 36px). Кольори: фон transparent (hover #ebebeb), текст #1f1f1f, маркер #9a9a9a. Скруглення: 8px. Активуються при наведенні, мають уніфікований шрифт (font-medium)." fullWidth>
        <FilterBar>
          <Select options={statusOpts} value={v4} onChange={setV4} placeholder="Всі статуси" variant="ghost" />
          <MultiSelect options={memberOpts} value={v5} onChange={setV5} placeholder="Всі виконавці" searchPlaceholder="Шукати..." variant="ghost" />
        </FilterBar>
      </PreviewBlock>

      {/* ─── Inline Attribute Select ─── */}
      <PreviewBlock title="Inline Attribute Select" description="Ультракомпактний селектор для бічних панелей деталей та таблиць. Висота: 22px. Кольори: bg-transparent, текст #1f1f1f. Скруглення: 10px. Охоплює ховер-ефектом (#ebebeb) увесь стовпчик разом із заголовком." fullWidth>
        <div className="max-w-[200px] bg-[#f4f4f5] p-4 rounded-[12px]">
          <div className="hover:bg-[#ebebeb] p-2 -m-2 rounded-[10px] transition-colors flex flex-col gap-[4px] w-full cursor-pointer" onClick={e => { if (e.target.tagName === 'SPAN' || e.target === e.currentTarget) e.currentTarget.querySelector('button')?.click(); }}>
            <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider">Статус</span>
            <Select 
              value={v6} 
              onChange={setV6} 
              options={statusOpts} 
              buttonClassName="bg-transparent rounded-[10px] px-0 h-[22px] font-medium text-[13px] justify-start gap-1 w-full" 
            />
          </div>
        </div>
      </PreviewBlock>

      {/* ─── MultiSelect with Search ─── */}
      <PreviewBlock title="MultiSelect with Search" description="Множинний вибір із вбудованим пошуковим рядком. Висота: 36px. Кольори: фон #f4f4f5, чекбокси опцій #1f1f1f при виборі. Скруглення: 10px. Має вбудовану валідацію порожнього пошуку." fullWidth>
        <div className="max-w-[300px]">
          <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[6px] block">Виконавці</label>
          <MultiSelect options={memberOpts} value={v3} onChange={setV3} placeholder="Оберіть виконавців..." searchPlaceholder="Шукати учасника..." />
        </div>
      </PreviewBlock>
    </div>
  );
}

function TabsSection() {
  const [a1, setA1] = useState('board');
  const [a2, setA2] = useState('active');
  const [a3, setA3] = useState('kanban');
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Standard Tabs — 36px" description="Pill wrapper bg-[#f4f4f5], active tab bg-white shadow-sm.">
        <Tabs tabs={[{ id: 'board', label: 'Дошка' }, { id: 'backlog', label: 'Беклог' }, { id: 'sprints', label: 'Спринти' }]} activeTab={a1} onTabChange={setA1} />
      </PreviewBlock>

      <PreviewBlock title="With Icons" description="Tab icon size 14px.">
        <Tabs
          tabs={[
            { id: 'kanban', label: 'Kanban', icon: Kanban },
            { id: 'list', label: 'Список', icon: List },
            { id: 'table', label: 'Таблиця', icon: TableIcon },
          ]}
          activeTab={a3}
          onTabChange={setA3}
        />
      </PreviewBlock>

      <PreviewBlock title="Segmented Switcher (Icon-only)" description="Перемикач вигляду сторінки. Використовує кастомні іконки без текстових міток (label), автоматично формуючи квадратні кнопки 28x28px. Висота: 36px. Скруглення: 10px.">
        <Tabs
          tabs={[
            { id: 'grid', icon: Kanban },
            { id: 'list', icon: List },
          ]}
          activeTab={a1 === 'board' ? 'grid' : 'list'}
          onTabChange={(id) => setA1(id === 'grid' ? 'board' : 'sprints')}
        />
      </PreviewBlock>
    </div>
  );
}

function SurfacesSection() {
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Панельна ієрархія (Layout Surfaces)" description="Головні будівельні блоки для контент-зони. Дотримуються правил вкладеності: сіра підкладка (Level 1) -> вкладені білі картки або сірі інсети (Level 2)." fullWidth>
        
        {/* Level 1: Gray Main Panel */}
        <Surface variant="panel" padding="lg" className="w-full">
          <div className="mb-[16px]">
            <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider bg-white border border-[#e9e9e9] px-[8px] py-[3px] rounded-[6px]">
              Level 1: Main Panel (#f4f4f5, rounded-[16px])
            </span>
            <p className="text-[12px] text-[#9a9a9a] mt-[8px]">Основна сіра контент-зона для розмежування логічних секцій або колонок.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
            {/* Level 2: White Card Surface */}
            <Surface variant="card" padding="lg" className="!rounded-[12px]">
              <span className="text-[10px] font-bold text-[#6366f1] uppercase tracking-wider bg-[#6366f1]/8 border border-[#6366f1]/15 px-[8px] py-[3px] rounded-[6px]">
                Level 2: White Card (rounded-[12px])
              </span>
              <p className="text-[13px] text-[#1f1f1f] font-semibold mt-[12px]">Біла плаваюча картка</p>
              <p className="text-[12px] text-[#9a9a9a] mt-[4px]">Без рамки та без тіней. Чиста біла поверхня для розміщення окремих завдань, деталей або списків.</p>
            </Surface>

            {/* Level 2: Surface Inset */}
            <Surface variant="inset" padding="lg">
              <span className="text-[10px] font-bold text-[#b45309] uppercase tracking-wider bg-[#fbbf24]/8 border border-[#fbbf24]/15 px-[8px] py-[3px] rounded-[6px]">
                Level 2: Inset Surface (#f0f0f0, rounded-[12px])
              </span>
              <p className="text-[13px] text-[#1f1f1f] font-semibold mt-[12px]">Вкладений інсет-блок</p>
              <p className="text-[12px] text-[#9a9a9a] mt-[4px]">Втоплена темніша панель із меншим скругленням (12px) для вкладених блоків, форм або додаткової інформації.</p>
            </Surface>
          </div>

        </Surface>
      </PreviewBlock>
    </div>
  );
}

function BadgesSection() {
  return (
    <div className="flex flex-col gap-[32px]">
      {/* ─── Standard Badge Component ─── */}
      <PreviewBlock title="Badge Component" description="Універсальний компонент Badge. Підтримує 3 розміри (sm, md, lg) та 6 варіантів оформлення (default, success, warning, danger, error, info).">
        <div className="flex flex-col gap-[16px] w-full">
          <div>
            <h4 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[8px]">Sizes (sm, md, lg)</h4>
            <div className="flex items-center gap-[12px]">
              <Badge size="sm">Small</Badge>
              <Badge size="md">Medium (Default)</Badge>
              <Badge size="lg">Large</Badge>
            </div>
          </div>
          <div>
            <h4 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[8px]">Variants</h4>
            <div className="flex flex-wrap items-center gap-[8px]">
              <Badge variant="default">Default</Badge>
              <Badge variant="info">Info / Indigo</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="error">Error / Orange</Badge>
              <Badge variant="danger">Danger</Badge>
            </div>
          </div>
        </div>
      </PreviewBlock>

      {/* ─── StatusBadge Component ─── */}
      <PreviewBlock title="StatusBadge Component" description="Динамічний статусний бейдж, що автоматично використовує колірні налаштування з конфігурації робочого простору.">
        <div className="flex items-center gap-[8px]">
          <StatusBadge status="todo" />
          <StatusBadge status="in-progress" />
          <StatusBadge status="done" />
          <StatusBadge status="blocked" />
        </div>
      </PreviewBlock>

      {/* ─── PriorityBadge Component (Priority Indicators) ─── */}
      <PreviewBlock title="PriorityBadge Component (Priority Indicators)" description="Спеціалізований бейдж пріоритету завдання. Автоматично підбирає колір, іконку та текст.">
        <div className="flex items-center gap-[8px]">
          <PriorityBadge priority="low" />
          <PriorityBadge priority="medium" />
          <PriorityBadge priority="high" />
          <PriorityBadge priority="blocker" />
          <PriorityBadge priority="info" />
        </div>
      </PreviewBlock>

      {/* ─── Issue Type Chips ─── */}
      <PreviewBlock title="Issue Type Chips" description="Epic, Feature, Task, Bug — використовуються в таблицях спринтів та беклозі. Мають спокійні скляні кольори без іконок.">
        <div className="flex items-center gap-[8px]">
          <Tag label="Epic" color="#8b5cf6" showIcon={false} />
          <Tag label="Feature" color="#0891b2" showIcon={false} />
          <Tag label="Task" color="#059669" showIcon={false} />
          <Tag label="Bug" color="#dc2626" showIcon={false} />
        </div>
      </PreviewBlock>


      {/* ─── Tag Component ─── */}
      <PreviewBlock title="Tag Component (Мітки)" description="Компонент міток із вбудованою іконкою Lucide 'Tag'. Підтримує 6 спокійних скляних варіантів та можливість видалення (кліку по хрестику).">
        <div className="flex flex-col gap-[12px] w-full">
          <div className="flex flex-wrap items-center gap-[8px]">
            <Tag label="Frontend" variant="info" />
            <Tag label="Design" variant="success" />
            <Tag label="Bug" variant="danger" />
            <Tag label="DevOps" variant="warning" />
            <Tag label="Backend" variant="error" />
            <Tag label="Archive" variant="default" />
          </div>
          <div>
            <h4 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[8px]">Removable Tags</h4>
            <div className="flex flex-wrap items-center gap-[8px]">
              <Tag label="React" variant="info" onRemove={() => alert('Видалити React')} />
              <Tag label="Tailwind" variant="success" onRemove={() => alert('Видалити Tailwind')} />
              <Tag label="Next.js" variant="default" onRemove={() => alert('Видалити Next.js')} />
            </div>
          </div>
        </div>
      </PreviewBlock>

      {/* ─── Counter Component ─── */}
      <PreviewBlock title="Counter Component (Каунтери & Індикатори)" description="Універсальний каунтер для сайдбару, чату чи проектів. Підтримує числові значення, звичайні точки сповіщень (dot) у різних розмірах (sm, md, lg) та статусах, адаптуючись до світлих і темних поверхонь (dark={true}).">
        <div className="flex flex-col gap-[24px] w-full">
          {/* Light Mode */}
          <div>
            <h4 className="text-[11px] font-bold text-[#1f1f1f] uppercase tracking-wider mb-[12px]">Світлий фон (Замовчування)</h4>
            <div className="flex flex-col gap-[12px]">
              <div className="flex items-center gap-[16px] flex-wrap">
                <span className="text-[11px] font-bold text-[#9a9a9a] w-[140px]">Count Mode (sm, md, lg):</span>
                <Counter value={5} size="sm" status="info" />
                <Counter value={12} size="md" status="danger" />
                <Counter value={99} size="md" status="success" />
                <Counter value={120} size="lg" status="muted" />
              </div>
              <div className="flex items-center gap-[16px] flex-wrap">
                <span className="text-[11px] font-bold text-[#9a9a9a] w-[140px]">Dot Mode (sm, md, lg):</span>
                <Counter variant="dot" size="sm" status="info" />
                <Counter variant="dot" size="md" status="danger" />
                <Counter variant="dot" size="lg" status="success" />
              </div>
            </div>
          </div>

          {/* Dark Mode */}
          <div className="bg-[#1f1f1f] -mx-[24px] -mb-[24px] p-[24px] rounded-b-[16px]">
            <h4 className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-[12px]">Темний фон (Для сайдбару: dark={`{true}`})</h4>
            <div className="flex flex-col gap-[12px]">
              <div className="flex items-center gap-[16px] flex-wrap">
                <span className="text-[11px] font-bold text-white/30 w-[140px]">Count Mode (sm, md, lg):</span>
                <Counter value={5} size="sm" status="info" dark />
                <Counter value={12} size="md" status="danger" dark />
                <Counter value={99} size="md" status="success" dark />
                <Counter value={120} size="lg" status="muted" dark />
              </div>
              <div className="flex items-center gap-[16px] flex-wrap">
                <span className="text-[11px] font-bold text-white/30 w-[140px]">Dot Mode (sm, md, lg):</span>
                <Counter variant="dot" size="sm" status="info" dark />
                <Counter variant="dot" size="md" status="danger" dark />
                <Counter variant="dot" size="lg" status="success" dark />
              </div>
            </div>
          </div>
        </div>
      </PreviewBlock>

      {/* ─── Role Badges ─── */}
      <PreviewBlock title="Role Badges" description="Бейджі ролей учасників проєкту.">
        <Badge variant="primary" size="sm">Owner</Badge>
        <Badge variant="info" size="sm">Admin</Badge>
        <Badge variant="default" size="sm">Member</Badge>
        <Badge variant="success" size="sm">Client</Badge>
      </PreviewBlock>
    </div>
  );
}

function AvatarsSection() {
  const sizes = [20, 24, 28, 32, 36, 40, 48];
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Avatar sizes" description="Базовий атом аватара розробника. Використовується в картках, списках та таблицях.">
        <div className="flex items-end gap-[16px]">
          {sizes.map(s => (
            <div key={s} className="flex flex-col items-center gap-[6px]">
              <div
                className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
                style={{ width: s, height: s, backgroundColor: '#6366f1', fontSize: Math.max(8, s * 0.35) }}
              >
                АМ
              </div>
              <span className="text-[9px] font-mono text-[#9a9a9a]">{s}px</span>
            </div>
          ))}
        </div>
      </PreviewBlock>
    </div>
  );
}

function ProgressSection() {
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Progress Components (Linear & Circular)" description="Реальні компоненти відображення прогресу." fullWidth>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[24px] w-full">
          {/* Linear Progress */}
          <div className="flex flex-col gap-[16px]">
            <h4 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-2">Linear Progress (sm, md, lg)</h4>
            <div className="flex flex-col gap-4">
              <div>
                <span className="text-[11px] text-[#9a9a9a] font-bold block mb-1">Small (success):</span>
                <Progress value={45} variant="success" size="sm" showLabel />
              </div>
              <div>
                <span className="text-[11px] text-[#9a9a9a] font-bold block mb-1">Medium (default):</span>
                <Progress value={68} variant="default" size="md" showLabel />
              </div>
              <div>
                <span className="text-[11px] text-[#9a9a9a] font-bold block mb-1">Large (danger):</span>
                <Progress value={90} variant="danger" size="lg" showLabel />
              </div>
            </div>
          </div>

          {/* Progress Ring */}
          <div className="flex flex-col gap-[16px]">
            <h4 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-2">Circular Progress Ring (sm, md, lg)</h4>
            <div className="flex items-center gap-[16px] flex-wrap">
              <div className="flex flex-col items-center gap-1">
                <ProgressRing value={25} size="sm" variant="danger" />
                <span className="text-[10px] text-[#9a9a9a]">sm</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <ProgressRing value={60} size="md" variant="warning" />
                <span className="text-[10px] text-[#9a9a9a]">md</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <ProgressRing value={85} size="lg" variant="success" />
                <span className="text-[10px] text-[#9a9a9a]">lg</span>
              </div>
            </div>
          </div>
        </div>
      </PreviewBlock>

      <PreviewBlock title="KpiCard & Stat Components" description="Справжні блоки аналітики з сайту." fullWidth>
        <div className="flex flex-col gap-6 w-full">
          <div>
            <h4 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-3">KpiCard (Колоризовані показники аналітики)</h4>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
              <KpiCard label="Всі завдання" value="89 / 124" sub="71% прогресу" color="#10b981" icon={Target} trend={12} />
              <KpiCard label="Velocity (7д)" value="14" sub="завдань за тиждень" color="#6366f1" icon={Zap} trend={-5} />
              <KpiCard label="Списано часу" value="45г 30хв" sub="по 4 проєктах" color="#0891b2" icon={Clock} />
              <KpiCard label="Команда" value="8" sub="учасників із завданнями" color="#eab308" icon={Users} />
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-3">Stat (Простий текстовий показник)</h4>
            <div className="flex items-center gap-8 flex-wrap">
              <Stat label="Активні користувачі" number="120" trend="up" trendValue={8.2} icon={Users} />
              <Stat label="Прострочено завдань" number="3" trend="down" trendValue={15.4} icon={AlertCircle} />
              <Stat label="Середній час релізу" number="4.2 дн" icon={Clock} />
            </div>
          </div>
        </div>
      </PreviewBlock>
    </div>
  );
}



function NavigationOverlaysSection() {
  const [currentStep, setCurrentStep] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const menuItems = [
    { icon: Edit2, label: 'Редагувати', onClick: () => alert('Редагувати') },
    { icon: Copy, label: 'Дублювати', onClick: () => alert('Дублювати') },
    { icon: Users, label: 'Учасники', onClick: () => alert('Учасники') },
    { icon: Settings, label: 'Налаштування', onClick: () => alert('Налаштування') },
    { isDivider: true },
    { icon: Trash2, label: 'Видалити', isDanger: true, onClick: () => alert('Видалити') },
  ];

  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Dropdown, Popover & Tooltip" description="Спливаючі та інформаційні елементи. Dropdown та Popover використовують L2 (12px), а Tooltip використовує L3 (8px)." fullWidth>
        <div className="flex items-center gap-[24px] flex-wrap">
          <Dropdown
            trigger="Опції проєкту"
            items={[
              { label: 'Експорт PDF', onClick: () => alert('PDF') },
              { label: 'Експорт CSV', onClick: () => alert('CSV') },
            ]}
          />

          <Popover
            trigger={<Button style="secondary">Показати Popover</Button>}
            position="bottom"
          >
            <div className="p-2">
              <h4 className="text-[14px] font-bold mb-1">Інформаційне вікно</h4>
              <p className="text-[12px] text-[#9a9a9a]">Корисна інформація або додаткові налаштування.</p>
            </div>
          </Popover>

          <Tooltip content="Це підказка при наведенні" position="top">
            <Button style="secondary">Наведіть для підказки</Button>
          </Tooltip>
        </div>
      </PreviewBlock>

      <PreviewBlock title="ContextMenu & Dropdown Menu Elements" description="Контекстні та випадаючі меню. Скруглення L2 (12px) відповідно до інструкцій." fullWidth>
        <div className="flex items-start gap-[40px] items-start flex-wrap">
          <div className="flex flex-col gap-[8px]">
            <span className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider">Інтерактивне меню</span>
            <ContextMenu 
              trigger={<Button style="secondary" size="icon" icon={MoreVertical}>Меню</Button>} 
              items={menuItems}
            />
          </div>

          <div className="flex flex-col gap-[8px]">
            <span className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider">Стиль елементів</span>
            <div className="bg-white rounded-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-[#f0f0f0] py-[6px] w-[200px]">
              {[
                { icon: Edit2, label: 'Редагувати' },
                { icon: Copy, label: 'Дублювати' },
                { icon: Archive, label: 'Архівувати' },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="px-[14px] py-[9px] text-[13px] font-medium text-[#1f1f1f] hover:bg-[#f4f4f5] flex items-center gap-[8px] cursor-pointer transition-colors">
                    <Icon size={14} className="text-[#9a9a9a]" />{item.label}
                  </div>
                );
              })}
              <div className="h-[1px] bg-[#f0f0f0] my-[4px] mx-[14px]" />
              <div className="px-[14px] py-[9px] text-[13px] font-medium text-red-500 hover:bg-red-50 flex items-center gap-[8px] cursor-pointer transition-colors">
                <Trash2 size={14} />Видалити
              </div>
            </div>
          </div>
        </div>
      </PreviewBlock>

      <PreviewBlock title="Stepper" description="Кроковий навігатор для майстрів створення або процесів." fullWidth>
        <Stepper
          steps={['Основна інформація', 'Налаштування команди', 'Підтвердження']}
          currentStep={currentStep}
          onStepClick={setCurrentStep}
        />
      </PreviewBlock>

      <PreviewBlock title="Pagination" description="Посторінкова навігація з кнопками L2.5 (10px) та стрілками.">
        <Pagination
          currentPage={currentPage}
          totalPages={5}
          onPageChange={setCurrentPage}
        />
      </PreviewBlock>
    </div>
  );
}

function DialogsSection() {
  const [open1, setOpen1] = useState(false);
  const [open2, setOpen2] = useState(false);
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Standard Dialog" description="rounded-[24px] overlay modal. Default width 480px.">
        <Button style="primary" size="lg" onClick={() => setOpen1(true)}>Відкрити форму</Button>
        <Dialog isOpen={open1} onClose={() => setOpen1(false)} title="Редагувати проєкт" size="sm">
          <div className="flex flex-col gap-[16px]">
            <div>
              <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[6px] block">Назва *</label>
              <Input placeholder="Назва проєкту..." />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[6px] block">Опис</label>
              <Textarea placeholder="Короткий опис..." rows={3} />
            </div>
          </div>
          <div className="flex gap-[8px] mt-[24px]">
            <Button style="secondary" size="lg" className="flex-1" onClick={() => setOpen1(false)}>Скасувати</Button>
            <Button style="primary" size="lg" className="flex-1" onClick={() => setOpen1(false)}>Зберегти</Button>
          </div>
        </Dialog>
      </PreviewBlock>

      <PreviewBlock title="Danger / Confirm Dialog" description="Destructive action confirmation. Centered icon + description.">
        <Button style="secondary" color="red" size="lg" icon={Trash2} onClick={() => setOpen2(true)}>Видалити</Button>
        <Dialog isOpen={open2} onClose={() => setOpen2(false)} size="sm" showCloseButton={false}>
          <div className="flex flex-col items-center text-center">
            <div className="w-[56px] h-[56px] bg-red-50 rounded-full flex items-center justify-center mb-[16px]">
              <AlertCircle size={24} className="text-red-500" />
            </div>
            <h2 className="text-[18px] font-bold text-[#1f1f1f] mb-[8px]">Видалити проєкт?</h2>
            <p className="text-[13px] text-[#9a9a9a] leading-relaxed mb-[24px]">
              Ви видаляєте <strong className="text-[#1f1f1f]">Редизайн сайту</strong>. Цю дію неможливо скасувати.
            </p>
            <div className="flex gap-[8px] w-full">
              <Button style="secondary" size="lg" className="flex-1" onClick={() => setOpen2(false)}>Скасувати</Button>
              <Button style="primary" color="red" size="lg" className="flex-1" onClick={() => setOpen2(false)}>Видалити</Button>
            </div>
          </div>
        </Dialog>
      </PreviewBlock>
    </div>
  );
}

function HeadersSection() {
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="1) WorkspaceHeader (Живий компонент)" description="Справжній хедер додатку, який реагує на стейт (хлібні крихти, таймер, чат)." filePath="src/components/WorkspaceHeader.jsx" fullWidth>
        <div className="border border-[#f0f0f0] rounded-[16px] overflow-hidden bg-white">
          <WorkspaceHeader />
        </div>
      </PreviewBlock>

      <PreviewBlock title="2) Звичайний пошук (Search Mode)" description="Пошук для загальних сторінок (старий TopHeader)." filePath="src/components/ui/Layout/TopHeader.jsx" fullWidth>
        <div className="border border-[#f0f0f0] rounded-[16px] overflow-hidden">
          <TopHeader 
            mode="search" 
            searchPlaceholder="Пошук по моїх завданнях..." 
            unreadCount={0} 
          />
        </div>
      </PreviewBlock>

      <PreviewBlock title="3) Хлібні крихти з пошуком (Project Mode)" description="Навігація проєкту з розсувним пошуком." filePath="src/components/ui/Layout/TopHeader.jsx" fullWidth>
        <div className="border border-[#f0f0f0] rounded-[16px] overflow-hidden">
          <TopHeader 
            mode="project" 
            projectName="Mobile App Redesign" 
            unreadCount={5} 
          />
        </div>
      </PreviewBlock>

      <PreviewBlock title="4) Хлібні крихти детального перегляду (Breadcrumbs Mode)" description="Відображення повного ієрархічного шляху до конкретної завдання." filePath="src/components/ui/Layout/TopHeader.jsx" fullWidth>
        <div className="border border-[#f0f0f0] rounded-[16px] overflow-hidden">
          <TopHeader 
            mode="breadcrumbs" 
            breadcrumbs={[
              { label: 'Проєкти', href: '/workspace' },
              { label: 'Mobile App Redesign', href: '/workspace/project-1' },
              { label: 'QT-104: Зворотній звʼязок', href: null },
            ]}
            unreadCount={2}
          />
        </div>
      </PreviewBlock>

      <PreviewBlock title="5) Пошук по чатах + Аватарки + Статус (Chat Mode)" description="Спеціальний режим для чатів та каналів." filePath="src/components/ui/Layout/TopHeader.jsx" fullWidth>
        <div className="border border-[#f0f0f0] rounded-[16px] overflow-hidden">
          <TopHeader 
            mode="chat" 
            showNotifications={false}
            onlineUsers={[
              { name: 'Oksana', avatar: 'https://i.pravatar.cc/150?u=oksana' },
              { name: 'Ivan', avatar: 'https://i.pravatar.cc/150?u=ivan' },
              { name: 'Taras', avatar: 'https://i.pravatar.cc/150?u=taras' }
            ]}
          />
        </div>
      </PreviewBlock>
    </div>
  );
}

function PageHeadersSection() {
  const [tab1, setTab1] = useState('kanban');
  const [tab2, setTab2] = useState('active');
  const [priority, setPriority] = useState('all');
  const [project, setProject] = useState([]);

  return (
    <div className="flex flex-col gap-[32px]">
      {/* Варіант 1: Повний (Заголовок + Дії + Таби + Фільтри + Switcher) */}
      <PreviewBlock title="1) Повний варіант (Full PageHeader)" description="Містить заголовок, кнопки дій, вкладки сторінки, фільтри та перемикач вигляду (як на сторінці Мої завдання)." filePath="src/components/ui/Layout/PageHeader.jsx" fullWidth>
        <div className="border border-[#f0f0f0] rounded-[24px] overflow-hidden bg-white p-[24px] w-full">
          <PageHeader
            variant="main"
            title="Мої завдання"
            actions={
              <div className="flex gap-2">
                <Button onClick={() => alert('Налаштування')} icon={Settings2} size="icon-lg" style="secondary" title="Налаштування" />
                <Button onClick={() => alert('Створити')} icon={Plus} size="lg" style="primary" color="dark">Створити завдання</Button>
              </div>
            }
            filters={
              <div className="flex items-center justify-between w-full">
                <FilterBar>
                  <MultiSelect
                    variant="ghost"
                    value={project}
                    onChange={setProject}
                    options={[
                      { value: 'p1', label: 'QuickTeam Website' },
                      { value: 'p2', label: 'Mobile Application' }
                    ]}
                    placeholder="Всі проєкти"
                    searchPlaceholder="Пошук проєкту..."
                  />
                  <Select
                    variant="ghost"
                    value={priority}
                    onChange={setPriority}
                    options={[
                      { value: 'all', label: 'Всі пріоритети' },
                      { value: 'blocker', label: 'Blocker', dotColor: '#ef4444' },
                      { value: 'high', label: 'High', dotColor: '#f97316' }
                    ]}
                  />
                </FilterBar>
                
                <Tabs
                  tabs={[
                    { id: 'kanban', icon: Kanban },
                    { id: 'list', icon: List }
                  ]}
                  activeTab={tab1}
                  onTabChange={setTab1}
                  className="ml-auto"
                />
              </div>
            }
          />
        </div>
      </PreviewBlock>

      {/* Варіант 2: Заголовок + Дії (Без табів, без фільтрів) */}
      <PreviewBlock title="2) Тільки заголовок та дії" description="Простий заголовок з кнопкою дії. Використовується на сторінках налаштувань або деталей." filePath="src/components/ui/Layout/PageHeader.jsx" fullWidth>
        <div className="border border-[#f0f0f0] rounded-[24px] overflow-hidden bg-white p-[24px] w-full">
          <PageHeader
            variant="main"
            title="Профіль учасника"
            actions={
              <Button onClick={() => alert('Зберегти')} style="primary" color="dark" size="lg">Зберегти профіль</Button>
            }
          />
        </div>
      </PreviewBlock>

      {/* Варіант 3: Заголовок + Фільтри (Без табів, без дій) */}
      <PreviewBlock title="3) Заголовок + Фільтри" description="Шапка з фільтрами, але без дій чи перемикачів вкладок." filePath="src/components/ui/Layout/PageHeader.jsx" fullWidth>
        <div className="border border-[#f0f0f0] rounded-[24px] overflow-hidden bg-white p-[24px] w-full">
          <PageHeader
            variant="main"
            title="Аналітика завантаження"
            filters={
              <FilterBar>
                <Select
                  variant="ghost"
                  value={priority}
                  onChange={setPriority}
                  options={[
                    { value: 'all', label: 'Всі пріоритети' },
                    { value: 'blocker', label: 'Blocker', dotColor: '#ef4444' },
                    { value: 'high', label: 'High', dotColor: '#f97316' }
                    ]}
                  />
                </FilterBar>
              }
            />
          </div>
        </PreviewBlock>

        {/* Варіант 4: Заголовок + Таби + Дії (Без фільтрів, без перемикача) */}
        <PreviewBlock title="4) Заголовок + Вкладки + Дії" description="Використовується на сторінках зі списками без розгорнутої фільтрації (наприклад, список Проєктів)." filePath="src/components/ui/Layout/PageHeader.jsx" fullWidth>
          <div className="border border-[#f0f0f0] rounded-[24px] overflow-hidden bg-white p-[24px] w-full">
            <PageHeader
              variant="main"
              title="Проєкти"
              tabs={[
                { id: 'active', label: 'Активні' },
                { id: 'archived', label: 'Архівні' }
              ]}
              activeTab={tab2}
              onTabChange={setTab2}
              actions={
                <Button onClick={() => alert('Створити проєкт')} style="primary" color="dark" size="lg" icon={Plus}>Новий проєкт</Button>
              }
            />
          </div>
        </PreviewBlock>
      </div>
  );
}

function FeedbackSection() {
  const [toastConfig, setToastConfig] = useState(null);
  
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Toasters" description="Центровані темні спливаючі сповіщення з іконками." fullWidth>
        <div className="flex flex-wrap gap-[8px]">
          <Button style="primary" size="lg" onClick={() => setToastConfig({ variant: 'success', message: 'Проєкт успішно збережено ✓' })}>
            Успіх Тост
          </Button>
          <Button style="secondary" color="red" size="lg" onClick={() => setToastConfig({ variant: 'error', message: 'Помилка при збереженні даних' })}>
            Помилка Тост
          </Button>
          <Button style="secondary" size="lg" onClick={() => setToastConfig({ variant: 'warning', message: 'Увага: Сесія скоро закінчиться' })}>
            Попередження
          </Button>
          <Button style="secondary" size="lg" onClick={() => setToastConfig({ variant: 'loading', message: 'Завантаження даних...' })}>
            Завантаження
          </Button>
        </div>
        {toastConfig && (
          <Toast
            variant={toastConfig.variant}
            message={toastConfig.message}
            autoClose={toastConfig.variant === 'loading' ? 0 : 3000}
            onClose={() => setToastConfig(null)}
          />
        )}
      </PreviewBlock>

      <PreviewBlock title="Alerts" description="Компонент сповіщень. Має скруглення L3 (8px) відповідно до токенів." fullWidth>
        <div className="flex flex-col gap-[12px] max-w-[600px]">
          <Alert variant="success" title="Операція успішна">Проєкт успішно створено та додано до бази даних.</Alert>
          <Alert variant="info" title="Потребує уваги">Будь ласка, перевірте правильність введених даних.</Alert>
          <Alert variant="warning" title="Попередження">Термін виконання завдання спливає сьогодні.</Alert>
          <Alert variant="danger" title="Помилка доступу">У вас немає прав для видалення цього проєкту.</Alert>
        </div>
      </PreviewBlock>

      <PreviewBlock title="Loading Spinner" description="Анімований спіннер для станів завантаження.">
        <div className="flex items-center gap-[24px]">
          <LoadingSpinner size="sm" />
          <LoadingSpinner size="md" />
          <LoadingSpinner size="lg" />
        </div>
      </PreviewBlock>

      <PreviewBlock title="Empty States" description="Заглушки для порожніх списків або результатів пошуку (Преміум дизайн з сайту)." fullWidth>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px] w-full">
          <div className="bg-white rounded-[16px] border border-[#efefef] shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
            <EmptyState
              icon={MessageSquare}
              title="Немає коментарів"
              description="Будьте першим, хто прокоментує це завдання!"
            />
          </div>
          <div className="bg-white rounded-[16px] border border-[#efefef] shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
            <EmptyState
              icon={CheckSquare}
              title="Задач не знайдено"
              description="Спробуйте змінити параметри пошуку або фільтрації."
              action="Створити завдання"
              onAction={() => alert('Створення завдання...')}
            />
          </div>
        </div>
      </PreviewBlock>
    </div>
  );
}

function TaskCRMSection() {
  const dummyComments = [
    { id: '1', author: 'Артур Моспан', initials: 'АМ', timestamp: new Date('2026-07-12T10:00:00Z'), content: 'Кругові скруглення тепер виглядають супер!', edited: false },
    { id: '2', author: 'Іван Петренко', initials: 'ІП', timestamp: new Date('2026-07-12T10:50:00Z'), content: 'Згоден, концентричність робить інтерфейс дуже акуратним.', parentId: '1' }
  ];

  const demoMembers = [
    { uid: '1', name: 'Артур Моспан', initials: 'АМ', bg: '#6366f1' },
    { uid: '2', name: 'Іван Петренко', initials: 'ІП', bg: '#10b981' }
  ];

  const demoLabels = [
    { id: 'frontend', label: 'Frontend', color: '#3b82f6' },
    { id: 'design', label: 'Design', color: '#db2777' },
    { id: 'bug', label: 'Bug', color: '#ef4444' }
  ];

  const demoSprints = [
    { id: 'sprint-1', name: 'Спринт 12' }
  ];

  const task1 = {
    id: 't1',
    title: "Редизайн головної сторінки з новими компонентами",
    priority: "high",
    type: "feature",
    assigneeIds: ['1', '2'],
    dueDate: new Date('2026-07-13T12:00:00Z'),
    subtasks: [{ id: '1', title: 'Кнопки', done: true }, { id: '2', title: 'Інпути', done: false }],
    labelIds: ['frontend', 'design'],
    sprintId: 'sprint-1'
  };

  const task2 = {
    id: 't2',
    title: "Критична помилка при авторизації користувачів через Google",
    priority: "critical",
    type: "bug",
    assigneeIds: ['2'],
    dueDate: new Date('2026-07-11T12:00:00Z'), // overdue in this static demo
    subtasks: [],
    labelIds: ['bug']
  };

  const task3 = {
    id: 't3',
    title: "Написати юніт-тести для нового контролера авторизації",
    priority: "low",
    type: "task",
    assigneeIds: [],
    dueDate: null,
    subtasks: []
  };

  const task4 = {
    id: 't4',
    title: "Інтеграція Stripe для автоматичного прийому платіжних карток",
    priority: "medium",
    type: "feature",
    assigneeIds: ['1'],
    dueDate: null,
    subtasks: [{ id: '1', done: true }, { id: '2', done: true }, { id: '3', done: true }],
    hasUnreadChat: true
  };

  const task5 = {
    id: 't5',
    title: "Додати кнопку швидкого експорту звітів аналітики у CSV та PDF",
    priority: "low",
    type: "feature",
    assigneeIds: ['2'],
    dueDate: new Date('2026-07-14T12:00:00Z'),
    subtasks: [],
    labelIds: ['frontend']
  };

  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Project & Team Cards" description="Картки проєктів та користувачів. Мають скруглення L1 (16px)." fullWidth>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[16px]">
          <ProjectCard
            name="Редизайн сайту QuickTeam"
            description="Оновлення інтерфейсу згідно з новими правилами концентричності та токенів"
            members={demoMembers}
            taskCount={15}
            inProgressCount={4}
            commentCount={32}
          />
          <ProjectCard
            name="Редизайн сайту QuickTeam (Велика картка / Bento)"
            description="Головний проєкт організації. Оновлення інтерфейсу згідно з новими правилами концентричності та токенів."
            members={demoMembers}
            taskCount={15}
            inProgressCount={4}
            commentCount={32}
            isLarge
            lastAction={{
              actor: 'Артур Моспан',
              action: 'оновив завдання',
              issueKey: 'QT-104',
              title: 'Редизайн сторінки авторизації',
              time: '15 хв тому'
            }}
            className="md:col-span-2"
          />
          <TeamMemberCard
            name="Артур Моспан"
            role="Product Lead"
            status="online"
          />
        </div>
      </PreviewBlock>

      <PreviewBlock title="Task Card (Kanban)" description="Основна картка завдання для канбан дошки." fullWidth>
        <div className="bg-[#f4f4f5] p-6 rounded-[16px] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[16px]">
          <TaskCard
            issue={task1}
            members={demoMembers}
            labels={demoLabels}
            sprints={demoSprints}
            projectName="QuickTeam"
          />
          <TaskCard
            issue={task2}
            members={demoMembers}
            labels={demoLabels}
            sprints={demoSprints}
            projectName="QuickTeam"
          />
          <TaskCard
            issue={task3}
            members={demoMembers}
            labels={demoLabels}
            sprints={demoSprints}
            projectName="QuickTeam"
          />
          <TaskCard
            issue={task4}
            members={demoMembers}
            labels={demoLabels}
            sprints={demoSprints}
            projectName="QuickTeam"
          />
          <TaskCard
            issue={task5}
            members={demoMembers}
            labels={demoLabels}
            sprints={demoSprints}
            projectName="QuickTeam"
          />
        </div>
      </PreviewBlock>

      <PreviewBlock title="Task Row (List View)" description="Компактне відображення завдання у вигляді рядка для списків." fullWidth>
        <div className="bg-[#f4f4f5] p-6 rounded-[16px] flex flex-col gap-[8px]">
          <TaskRow
            issue={task1}
            members={demoMembers}
            labels={demoLabels}
            sprints={demoSprints}
            projectName="QuickTeam"
          />
          <TaskRow
            issue={task2}
            members={demoMembers}
            labels={demoLabels}
            sprints={demoSprints}
            projectName="QuickTeam"
          />
          <TaskRow
            issue={task3}
            members={demoMembers}
            labels={demoLabels}
            sprints={demoSprints}
            projectName="QuickTeam"
          />
          <TaskRow
            issue={task4}
            members={demoMembers}
            labels={demoLabels}
            sprints={demoSprints}
            projectName="QuickTeam"
          />
          <TaskRow
            issue={task5}
            members={demoMembers}
            labels={demoLabels}
            sprints={demoSprints}
            projectName="QuickTeam"
          />
        </div>
      </PreviewBlock>
    </div>
  );
}


function SidebarSection() {
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Workspace Layout Shell (Сайдбар + Мейн Контент)" description="Головний каркас інтерфейсу: лівий сайдбар окремим блоком та права біла контентна область із вбудованим WorkspaceHeader." filePath="src/components/WorkspaceSidebar.jsx" fullWidth>
        <div className="h-[550px] rounded-[24px] overflow-hidden flex bg-[#f5f5f5] w-full p-[12px] relative">
          {/* Left: Sidebar wrapper with exact layout.js paddings */}
          <div className="shrink-0 h-full flex pr-[6px]">
            <div className="h-full rounded-[24px] overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex bg-[#1f1f1f]">
              <WorkspaceSidebar />
            </div>
          </div>

          {/* Right: Main content panel with header and child page area */}
          <div className="flex-1 h-full flex flex-col pl-[6px] overflow-hidden">
            <div className="flex flex-col flex-1 bg-white rounded-[24px] overflow-hidden relative">
              {/* Header inside the container */}
              <div className="border-b border-[#f0f0f0] bg-white z-10 shrink-0">
                <WorkspaceHeader />
              </div>
              
              {/* Main Content Area */}
              <div className="flex-1 p-[24px] overflow-y-auto bg-white flex flex-col gap-4">
                <div className="h-full border-2 border-dashed border-[#f0f0f0] rounded-[16px] flex items-center justify-center bg-[#fbfbfb]">
                  <span className="text-[#cfcfcf] font-bold text-[13px]">Main Work Area (Контентна зона)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PreviewBlock>
    </div>
  );
}

function ButtonGroupsSection() {
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Secondary Button Group (Horizontal)" description="Група другорядних кнопок. Зовнішні кути заокруглені до L2.5 (10px), а внутрішні стикуються через тонку роздільну лінію." fullWidth>
        <ButtonGroup>
          <Button style="secondary">Огляд</Button>
          <Button style="secondary">Активність</Button>
          <Button style="secondary">Налаштування</Button>
        </ButtonGroup>
      </PreviewBlock>

      <PreviewBlock title="Primary Button Group (Horizontal)" description="Група головних темних дій з темними контрастними роздільниками." fullWidth>
        <ButtonGroup>
          <Button style="primary">Запуск</Button>
          <Button style="primary">Пауза</Button>
          <Button style="primary">Зупинка</Button>
        </ButtonGroup>
      </PreviewBlock>

      <PreviewBlock title="Vertical Button Group" description="Вертикальна орієнтація. Верхні та нижні кути заокруглені, проміжні кути пласкі." fullWidth>
        <div className="max-w-[200px]">
          <ButtonGroup orientation="vertical" className="w-full">
            <Button style="secondary" className="justify-start">Редагувати</Button>
            <Button style="secondary" className="justify-start">Дублювати</Button>
            <Button style="secondary" className="justify-start">Видалити</Button>
          </ButtonGroup>
        </div>
      </PreviewBlock>
    </div>
  );
}

function AvatarGroupsSection() {
  const dummyAvatars = [
    { name: 'Артур Моспан', initials: 'АМ', bg: '#6366f1', email: 'arthur@quickteam.io' },
    { name: 'Іван Петренко', initials: 'ІП', bg: '#10b981', email: 'ivan@quickteam.io' },
    { name: 'Марина Коваль', initials: 'МК', bg: '#f59e0b', email: 'marina@quickteam.io' },
    { name: 'Дмитро Сірко', initials: 'ДС', bg: '#ec4899', email: 'dmytro@quickteam.io' },
    { name: 'Олена Зоря', initials: 'ОЗ', bg: '#14b8a6', email: 'olena@quickteam.io' },
  ];
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Avatar Group (Overlapping)" description="Компонент групи аватарів учасників проєкту. Завдяки білій обводці (ring-2 ring-white) аватари елегантно набігають один на одного, утворюючи візуально розділену групу. Автоматично розраховує та показує залишок (+N).">
        <div className="flex flex-col gap-[20px] w-full">
          <div>
            <h4 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[8px]">Sizes (sm, md, lg, xl)</h4>
            <div className="flex flex-col gap-[16px]">
              <div className="flex items-center gap-[12px]">
                <span className="text-[12px] text-[#9a9a9a] w-[100px]">Small (20px)</span>
                <AvatarGroup avatars={dummyAvatars} maxDisplay={4} size="sm" />
              </div>
              <div className="flex items-center gap-[12px]">
                <span className="text-[12px] text-[#9a9a9a] w-[100px]">Medium (28px)</span>
                <AvatarGroup avatars={dummyAvatars} maxDisplay={3} size="md" />
              </div>
              <div className="flex items-center gap-[12px]">
                <span className="text-[12px] text-[#9a9a9a] w-[100px]">Large (36px)</span>
                <AvatarGroup avatars={dummyAvatars} maxDisplay={3} size="lg" />
              </div>
              <div className="flex items-center gap-[12px]">
                <span className="text-[12px] text-[#9a9a9a] w-[100px]">X-Large (44px)</span>
                <AvatarGroup avatars={dummyAvatars} maxDisplay={3} size="xl" />
              </div>
            </div>
          </div>
        </div>
      </PreviewBlock>
    </div>
  );
}

function TooltipsSection() {
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Tooltip Component" description="Компонент підказки, який з'являється при наведенні. Підтримує 4 позиції: top (default), bottom, left, right." fullWidth>
        <div className="flex items-center gap-[24px] justify-center w-full py-[40px]">
          <Tooltip content="Підказка зверху" position="top">
            <Button style="secondary">Наведи (Top)</Button>
          </Tooltip>
          <Tooltip content="Підказка знизу" position="bottom">
            <Button style="secondary">Наведи (Bottom)</Button>
          </Tooltip>
          <Tooltip content="Підказка зліва" position="left">
            <Button style="secondary">Наведи (Left)</Button>
          </Tooltip>
          <Tooltip content="Підказка справа" position="right">
            <Button style="secondary">Наведи (Right)</Button>
          </Tooltip>
        </div>
      </PreviewBlock>
    </div>
  );
}

function BreadcrumbsSection() {
  const [projectSearchActive, setProjectSearchActive] = useState(false);
  const [projectQuery, setProjectQuery] = useState('');

  const projectCrumbs = [
    { label: 'Проєкти', href: '/workspace' },
    { label: 'Mobile App Redesign', href: null },
  ];

  const taskCrumbs = [
    { label: 'Проєкти', href: '/workspace' },
    { label: 'Mobile App Redesign', href: '/workspace/project-1' },
    { label: 'QT-104: Зворотній звʼязок', href: null },
  ];

  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="1) Project Breadcrumbs with Search (Навігація Проєкту)" description="Використовується в шапці проєкту. Містить кнопку для активації внутрішньопроєктного пошуку." fullWidth>
        <div className="flex flex-col gap-[8px] items-start w-full">
          <Breadcrumb 
            items={projectCrumbs} 
            showSearchButton={true}
            isSearchActive={projectSearchActive}
            onSearchToggle={() => setProjectSearchActive(true)}
            searchValue={projectQuery}
            onSearchChange={setProjectQuery}
            onSearchClear={() => { setProjectQuery(''); setProjectSearchActive(false); }}
            searchPlaceholder="Пошук по Mobile App Redesign..."
          />
          {projectSearchActive && (
            <Button style="secondary" size="sm" onClick={() => { setProjectQuery(''); setProjectSearchActive(false); }} className="mt-[4px]">
              Скинути пошук (Показати крихти знову)
            </Button>
          )}
        </div>
      </PreviewBlock>

      <PreviewBlock title="2) Nested Task Breadcrumbs (Навігація детального перегляду)" description="Показує повний шлях до конкретного таску/субтаску." fullWidth>
        <Breadcrumb items={taskCrumbs} />
      </PreviewBlock>
    </div>
  );
}

function TaskAttributesSection() {
  const [statusVal, setStatusVal] = useState('todo');
  const [memberVal, setMemberVal] = useState([]);
  
  const statusOpts = DEFAULT_STATUSES.map(s => ({ value: s.id, label: s.label, dotColor: s.color }));
  
  const memberOpts = [
    { value: '1', label: 'Артур М.' },
    { value: '2', label: 'Олена К.' },
    { value: '3', label: 'Дмитро П.' }
  ];

  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Task Attributes Panel Layout" description="Панель властивостей завдання. Використовує flex-wrap для запобігання обрізанню випадних списків, розбиває параметри на первинні та другорядні з анімованим згортанням." fullWidth>
        <TaskAttributesPanel
          primaryChildren={
            <>
              <div className="flex flex-col gap-[4px] min-w-[130px] hover:bg-[#ebebeb] p-2 -m-2 rounded-[10px] cursor-pointer transition-colors" onClick={e => { if (e.target.tagName === 'SPAN' || e.target === e.currentTarget) e.currentTarget.querySelector('button')?.click(); }}>
                <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider">Статус</span>
                <Select value={statusVal} onChange={setStatusVal} options={statusOpts} buttonClassName="bg-transparent rounded-[10px] px-0 h-[22px] font-medium text-[13px] justify-start gap-1 w-full" />
              </div>
              <div className="flex flex-col gap-[4px] min-w-[130px] hover:bg-[#ebebeb] p-2 -m-2 rounded-[10px] cursor-pointer transition-colors" onClick={e => { if (e.target.tagName === 'SPAN' || e.target === e.currentTarget) e.currentTarget.querySelector('button')?.click(); }}>
                <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider">Виконавець</span>
                <Select value={memberVal[0] || ''} onChange={val => setMemberVal(val ? [val] : [])} options={memberOpts} buttonClassName="bg-transparent rounded-[10px] px-0 h-[22px] font-medium text-[13px] justify-start gap-1 w-full" />
              </div>
              <div className="flex flex-col gap-[4px] min-w-[130px] hover:bg-[#ebebeb] p-2 -m-2 rounded-[10px] cursor-pointer transition-colors" onClick={e => { if (e.target.tagName === 'SPAN' || e.target === e.currentTarget) e.currentTarget.querySelector('button')?.click(); }}>
                <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider">Пріоритет</span>
                <Select value="medium" onChange={() => {}} options={[{ value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} buttonClassName="bg-transparent rounded-[10px] px-0 h-[22px] font-medium text-[13px] justify-start gap-1 w-full" />
              </div>
            </>
          }
          secondaryChildren={
            <>
              <div className="flex flex-col gap-[4px] min-w-[130px] hover:bg-[#ebebeb] p-2 -m-2 rounded-[10px] cursor-pointer transition-colors" onClick={e => { if (e.target.tagName === 'SPAN' || e.target === e.currentTarget) e.currentTarget.querySelector('button')?.click(); }}>
                <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider">Створено</span>
                <span className="text-[13px] font-medium text-[#1f1f1f] h-[22px] flex items-center">30.05.2026</span>
              </div>
              <div className="flex flex-col gap-[4px] min-w-[130px] hover:bg-[#ebebeb] p-2 -m-2 rounded-[10px] cursor-pointer transition-colors" onClick={e => { if (e.target.tagName === 'SPAN' || e.target === e.currentTarget) e.currentTarget.querySelector('button')?.click(); }}>
                <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider">Оцінка (Story Points)</span>
                <span className="text-[13px] font-medium text-[#1f1f1f] h-[22px] flex items-center">5 SP</span>
              </div>
            </>
          }
        />
      </PreviewBlock>
    </div>
  );
}

function FormGroupsSection() {
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Form Group Layouts" description="Контейнери для полів форми. Зв'язують заголовок Label (атом) та поле вводу (Input). Відображають зірочку (*) для обов'язкових полів та опис помилки під інпутом." fullWidth>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[24px] max-w-[900px]">
          <FormGroup label="Назва проєкту">
            <Input placeholder="Введіть назву..." />
          </FormGroup>

          <FormGroup label="Електронна пошта" required>
            <Input placeholder="name@company.com" />
          </FormGroup>

          <FormGroup label="Пароль" required error="Пароль має містити щонайменше 8 символів">
            <Input type="password" placeholder="••••••••" error={true} />
          </FormGroup>
        </div>
      </PreviewBlock>
    </div>
  );
}

function NavMenuSection() {
  const [active, setActive] = useState('profile');
  const NAV = [
    { id: 'profile',       label: 'Особистий профіль', icon: User,     group: 'Особисте' },
    { id: 'notifications', label: 'Сповіщення',        icon: Bell,     group: 'Особисте' },
    { id: 'workspace',     label: 'Загальні',          icon: Building, group: 'Організація' },
    { id: 'team',          label: 'Учасники команди',  icon: Users,    group: 'Організація' },
  ];
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="InnerNavigation з контентною зоною" description="Патерн навігації всередині сторінок з групуванням елементів, іконками, активним та небезпечним станами, з відображенням сірої контентної зони праворуч." filePath="src/components/ui/Navigation/InnerNavigation.jsx" fullWidth>
        <div className="h-[400px] border border-[#f0f0f0] rounded-[24px] overflow-hidden flex bg-white p-[12px] gap-[12px] w-full">
          {/* Left panel - InnerNavigation */}
          <div className="w-[280px] bg-[#f4f4f5] rounded-[16px] overflow-hidden shrink-0 flex flex-col">
            <InnerNavigation
              items={NAV}
              activeId={active}
              onChange={setActive}
            />
          </div>
          {/* Right panel - Gray Content Zone */}
          <div className="flex-1 bg-[#f4f4f5] rounded-[16px] flex flex-col items-center justify-center text-center p-6">
            <span className="text-[#9a9a9a] font-bold text-[13px] uppercase tracking-wider block mb-2">Контент зона (Content Area)</span>
            <p className="text-[#b1b1b1] text-[12px] max-w-[280px] leading-relaxed">Основна сіра контент-зона для розмежування логічних секцій або колонок.</p>
          </div>
        </div>
      </PreviewBlock>
    </div>
  );
}

function EmptyStatesSection() {
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Page-level Empty State" description="Центрована панель-заглушка на всю ширину (наприклад, коли немає проєктів)." fullWidth>
        <div className="bg-white rounded-[24px] border border-[#f0f0f0] p-[24px] flex items-center justify-center w-full">
          <EmptyState
            icon={Folder}
            title="Немає проєктів"
            description="Створіть перший проєкт, щоб розпочати роботу з командою."
            action="Новий проєкт"
            onAction={() => alert('Новий проєкт')}
          />
        </div>
      </PreviewBlock>

      <PreviewBlock title="Inline Empty State" description="Компактна заглушка всередині колонок канбану або списків." fullWidth>
        <div className="bg-[#f4f4f5] rounded-[16px] p-[24px] flex items-center justify-center w-full">
          <EmptyState
            icon={CheckSquare}
            title="Немає завдань"
          />
        </div>
      </PreviewBlock>
    </div>
  );
}

function FiltersSection() {
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [view, setView] = useState('kanban');
  const statusOpts = [
    { value: '', label: 'Всі статуси' },
    ...DEFAULT_STATUSES.map(s => ({ value: s.id, label: s.label, dotColor: s.color }))
  ];
  const priorityOpts = [
    { value: '', label: 'Всі пріоритети' },
    ...DEFAULT_PRIORITIES.map(p => ({ value: p.id, label: p.label, dotColor: p.color }))
  ];
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Full filter toolbar" description="Молекулярний елемент фільтрації сторінок. Поєднує FilterBar із примарними селекторами (variant='ghost') та перемикач вигляду (плитка/список) висотою 36px." fullWidth>
        <div className="flex items-center justify-between w-full bg-white border border-[#f0f0f0] p-4 rounded-[20px] shadow-sm">
          <FilterBar>
            <Select options={statusOpts} value={status} onChange={setStatus} placeholder="Всі статуси" variant="ghost" />
            <Select options={priorityOpts} value={priority} onChange={setPriority} placeholder="Всі пріоритети" variant="ghost" />
          </FilterBar>
          
          <Tabs
            tabs={[
              { id: 'kanban', icon: Kanban },
              { id: 'list', icon: List }
            ]}
            activeTab={view}
            onTabChange={setView}
          />
        </div>
      </PreviewBlock>
    </div>
  );
}

function TypographySection() {
  const types = [
    { tag: 'h1', label: 'Page Title', size: '24px', weight: '700', cls: 'text-[24px] font-bold text-[#1f1f1f]', note: 'Every page main title — text-2xl' },
    { tag: 'h2', label: 'Section Title', size: '18px', weight: '700', cls: 'text-[18px] font-bold text-[#1f1f1f]', note: 'Card/modal headings' },
    { tag: 'h3', label: 'Subsection', size: '16px', weight: '700', cls: 'text-[16px] font-bold text-[#1f1f1f]', note: 'Sprint header, panel title' },
    { tag: 'h4', label: 'Card Title', size: '15px', weight: '700', cls: 'text-[15px] font-bold text-[#1f1f1f]', note: 'Project/issue card title' },
    { tag: 'body', label: 'Body', size: '14px', weight: '600', cls: 'text-[14px] font-semibold text-[#1f1f1f]', note: 'Primary content text' },
    { tag: 'sm', label: 'Secondary', size: '13px', weight: '600', cls: 'text-[13px] font-semibold text-[#1f1f1f]', note: 'Descriptions, input text, buttons' },
    { tag: 'xs', label: 'Small', size: '12px', weight: '600', cls: 'text-[12px] font-semibold text-[#1f1f1f]', note: 'Captions, tab labels' },
    { tag: 'label', label: 'Form Label', size: '11px', weight: '700', cls: 'text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider', note: 'ALWAYS uppercase + tracking-wider' },
    { tag: 'mono', label: 'Mono / ID', size: '11px', weight: '700', cls: 'text-[11px] font-bold font-mono text-[#9a9a9a]', note: 'Issue keys: QT-001, IDs' },
    { tag: 'muted', label: 'Muted', size: '13px', weight: '600', cls: 'text-[13px] font-semibold text-[#9a9a9a]', note: 'Secondary/inactive text' },
  ];
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Type Scale" description="Full typography system." fullWidth>
        <div className="flex flex-col gap-[20px]">
          {types.map(t => (
            <div key={t.tag} className="flex items-baseline gap-[24px] border-b border-[#f0f0f0] pb-[16px] last:border-0">
              <div className="w-[72px] shrink-0">
                <span className="text-[10px] font-mono font-bold text-[#9a9a9a] bg-[#f4f4f5] px-[8px] py-[3px] rounded-[6px]">{t.tag}</span>
              </div>
              <div className="flex-1">
                <div className={t.cls}>{t.label} — Швидка команда</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[11px] font-mono text-[#9a9a9a]">{t.size} / w{t.weight}</div>
                <div className="text-[10px] text-[#cfcfcf] mt-[2px] max-w-[180px]">{t.note}</div>
              </div>
            </div>
          ))}
        </div>
      </PreviewBlock>
    </div>
  );
}

function TokensSection() {
  const colors = [
    { label: 'Dark (Primary)', value: '#1f1f1f' },
    { label: 'Pill Dark (hover)', value: '#303030' },
    { label: 'Canvas/Surface Zinc Gray', value: '#f4f4f5' },
    { label: 'Interactive Element Gray', value: '#f4f4f5' },
    { label: 'Inset Gray', value: '#f0f0f0' },
    { label: 'Border', value: '#e9e9e9' },
    { label: 'Border Light', value: '#f0f0f0' },
    { label: 'Text Muted', value: '#9a9a9a' },
    { label: 'Text Inactive', value: '#cfcfcf' },
    { label: 'Success', value: '#10b981' },
    { label: 'Warning', value: '#eab308' },
    { label: 'Danger', value: '#ef4444' },
    { label: 'Info / Indigo', value: '#6366f1' },
    { label: 'Cyan', value: '#0891b2' },
    { label: 'Orange', value: '#f97316' },
    { label: 'Purple', value: '#8b5cf6' },
  ];
  const sizes = [
    { label: 'Button lg (CTA, default)', value: '36px' },
    { label: 'Button md (action)', value: '32px' },
    { label: 'Button sm (compact)', value: '28px' },
    { label: 'Input / Select / Tabs height', value: '36px' },
    { label: 'L0: Global / Modal radius', value: '24px (rounded-[24px])' },
    { label: 'L1: Panel / Card radius', value: '16px (rounded-[16px])' },
    { label: 'L2: Inset Surface radius', value: '12px (rounded-[12px])' },
    { label: 'L2.5: Button / Input radius', value: '10px (rounded-[10px])' },
    { label: 'L3: Small accent radius', value: '8px (rounded-[8px])' },
    { label: 'L4: Badge / Tag radius', value: '6px (rounded-[6px])' },
    { label: 'Page horizontal padding', value: '32px' },
    { label: 'Page title → content gap', value: '24px' },
    { label: 'Max content width', value: '1400px' },
    { label: 'Sidebar width', value: '220px' },
  ];
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Color Palette" description="All tokens from /src/lib/design/tokens.js" fullWidth>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-[8px]">
          {colors.map(t => <TokenChip key={t.label} {...t} isColor />)}
        </div>
      </PreviewBlock>
      <PreviewBlock title="Sizing & Spacing" description="Strict rules — never use arbitrary values outside these." fullWidth>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-[8px]">
          {sizes.map(t => <TokenChip key={t.label} {...t} />)}
        </div>
      </PreviewBlock>
      <div className="bg-[#f4f4f5] rounded-[16px] p-6 border border-[#e9e9e9]/50 flex flex-col gap-3">
        <h4 className="text-[14px] font-bold text-[#1f1f1f]">Принцип концентричних кутів (Concentric Corners Rule)</h4>
        <p className="text-[12px] text-[#9a9a9a] leading-relaxed">
          Для збереження геометричної гармонії та уникнення візуального спотворення кутів, внутрішні скруглення деталей мають бути меншими за зовнішні скруглення їх контейнерів відповідно до формули:
          <span className="block font-mono bg-[#f0f0f0] rounded-[6px] px-3 py-1.5 text-[11px] text-[#1f1f1f] mt-1.5 w-fit">R_inner = R_outer - Padding</span>
        </p>
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex items-center gap-3 text-[12px]">
            <span className="font-bold text-[#1f1f1f] w-[140px]">L0 (Глобальний) [24px]</span>
            <span className="text-[#9a9a9a]">Основний робочий екран, overlay діалогові модалки</span>
          </div>
          <div className="flex items-center gap-3 text-[12px]">
            <span className="font-bold text-[#1f1f1f] w-[140px]">L1 (Панелі/Картки) [16px]</span>
            <span className="text-[#9a9a9a]">Головні сірі панелі, білі плаваючі картки</span>
          </div>
          <div className="flex items-center gap-3 text-[12px]">
            <span className="font-bold text-[#1f1f1f] w-[140px]">L2 (Вкладені) [12px]</span>
            <span className="text-[#9a9a9a]">Внутрішні інсет-панелі, випадаючі списки dropdown</span>
          </div>
          <div className="flex items-center gap-3 text-[12px]">
            <span className="font-bold text-[#1f1f1f] w-[140px]">L2.5 (Форми) [10px]</span>
            <span className="text-[#9a9a9a]">Кнопки (всіх розмірів), текстові поля (input, textarea)</span>
          </div>
          <div className="flex items-center gap-3 text-[12px]">
            <span className="font-bold text-[#1f1f1f] w-[140px]">L3 (Акценти) [8px]</span>
            <span className="text-[#9a9a9a]">Елементи всередині кнопок, фільтри, дрібні кнопки</span>
          </div>
          <div className="flex items-center gap-3 text-[12px]">
            <span className="font-bold text-[#1f1f1f] w-[140px]">L4 (Деталі) [6px]</span>
            <span className="text-[#9a9a9a]">StatusBadge, PriorityBadge, Tag-чіпи, Counter-каунтери</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION MAP
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_MAP = {
  buttons:    <ButtonsSection />,
  inputs:     <InputsSection />,
  selects:    <SelectsSection />,
  tabs:       <TabsSection />,
  surfaces:   <SurfacesSection />,
  badges:     <BadgesSection />,
  avatars:    <AvatarsSection />,
  progress:   <ProgressSection />,
  'navigation-overlays': <NavigationOverlaysSection />,
  dialogs:    <DialogsSection />,
  filters:    <FiltersSection />,
  typography: <TypographySection />,
  tokens:     <TokensSection />,
  headers:           <HeadersSection />,
  'page-headers':    <PageHeadersSection />,
  'sidebar-layout':  <SidebarSection />,
  'inner-nav-layout': <NavMenuSection />,
  'task-crm':  <TaskCRMSection />,
  feedback:   <FeedbackSection />,
  'button-groups': <ButtonGroupsSection />,
  'avatar-groups': <AvatarGroupsSection />,
  'breadcrumbs':   <BreadcrumbsSection />,
  tooltips:        <TooltipsSection />,
  'form-groups':   <FormGroupsSection />,
  'task-attributes': <TaskAttributesSection />,
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function UIKitPage() {
  const [activeSection, setActiveSection] = useState('buttons');
  const current = SECTIONS.find(s => s.id === activeSection);

  return (
    <div className="w-full h-full flex overflow-hidden bg-[#f5f5f5]">

      {/* ── Left Nav ──────────────────────────────────────────────────────── */}
      <div className="hidden md:flex w-[224px] shrink-0 h-full flex-col p-[12px] pr-[6px]">
        <div className="bg-[#1f1f1f] rounded-[20px] h-full flex flex-col overflow-hidden">
          <div className="px-[20px] pt-[20px] pb-[16px] border-b border-white/10 shrink-0">
            <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-[2px]">Internal · Not in nav</div>
            <div className="text-[17px] font-bold text-white">UI Kit</div>
            <div className="text-[10px] text-white/30 mt-[1px]">16 sections · CRM components</div>
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
              Зміни в src/components/ui/<br />
              розходяться по всьому сайту.
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden p-0 md:p-[12px] md:pl-[6px]">
        <div className="flex-1 flex flex-col bg-white rounded-none md:rounded-[24px] overflow-hidden border border-[#f0f0f0]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-4 md:px-[32px] py-[14px] md:py-[18px] border-b border-[#f0f0f0] shrink-0">
            <div className="min-w-0">
              <h1 className="text-[24px] font-bold text-[#1f1f1f]">{current?.label}</h1>
              <p className="text-[12px] text-[#9a9a9a] mt-[2px]">Всі компоненти — живі. Зміни в src/components/ui/ відображаються тут і скрізь.</p>
            </div>
            <select
              aria-label="Секція UI Kit"
              value={activeSection}
              onChange={event => setActiveSection(event.target.value)}
              className="md:hidden w-full h-10 px-3 bg-[#f4f4f5] border border-[#e2e2e4] rounded-[8px] text-[13px] font-semibold text-[#1f1f1f]"
            >
              {SECTIONS.map(section => <option key={section.id} value={section.id}>{section.label}</option>)}
            </select>
            <div className="hidden md:flex items-center gap-[6px] px-[12px] h-[28px] bg-[#f4f4f5] rounded-[8px]">
              <div className="w-[6px] h-[6px] rounded-full bg-[#10b981]" />
              <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide">INTERNAL ONLY · /ui-kit</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-5 md:px-[32px] md:py-[32px]">
            {SECTION_MAP[activeSection]}
          </div>
        </div>
      </div>
    </div>
  );
}
