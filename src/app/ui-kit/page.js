'use client';
import React, { createContext, useContext, useState } from 'react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Forms/Textarea';
import { Select, MultiSelect } from '@/components/ui/Select';
import Tabs from '@/components/ui/Tabs';
import FilterBar from '@/components/ui/FilterBar';
import Surface from '@/components/ui/Surface';
import ContextMenu from '@/components/ui/ContextMenu';
import {
  FormGroup, IconAction, Label, Pill, PriorityBadge, TypeBadge, Tag, Counter,
  Checkbox, ToggleSwitch, DatePicker, TimePicker,
  Alert, LoadingSpinner, EmptyState,
  Popover, Tooltip, TaskAttributesPanel, getTaskAttributeChrome, KpiCard,
  SidebarLayout, InnerNavigation, PageHeader, Card, Segmented, ImageUpload, UserAvatar,
  ConfirmProvider, useConfirm, ChatComposerCore, ProjectSettingsForm, StatusPill, StatusVisibilityPicker, TaskListView
} from '@/components/ui';
import Dialog from '@/components/ui/Dialog';
import { Toast } from '@/components/ui/Feedback/Toast';
import TopHeader from '@/components/ui/Layout/TopHeader';
import WorkspaceHeader from '@/components/WorkspaceHeader';
import WorkspaceSidebar from '@/components/WorkspaceSidebar';
import AgileBoard from '@/components/workspace/AgileBoard';
import TaskRow from '@/components/ui/TaskManagement/TaskRow';
import CreateTaskModal from '@/components/CreateTaskModal';
import ChatComposerDock from '@/components/ui/ChatComposerDock';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { DEFAULT_STATUSES, DEFAULT_PRIORITIES, DEFAULT_TYPES, useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import UsagePanel from './UsagePanel';
import kitUsage from './kit-usage.generated.json';
import kitDrift from './kit-drift.generated.json';
import { CALENDAR_EVENT_TYPE_OPTIONS } from '@/components/workspace/calendar/CalendarEventDialog';
import { colors as designColors, sizing, spacing } from '@/lib/design/tokens';
import {
  Plus, Edit2, Trash2, Archive, Search, ChevronDown,
  User, Bell, Settings, Settings2, Check, X, AlertCircle, Info,
  LayoutGrid, Type, Palette, Square, AlignLeft, ToggleLeft,
  Layers, MessageSquare, Zap, Hash, Calendar, Clock, Filter,
  ArrowDown, Minus, Star, Bug, CheckSquare, Flag,
  Play, Pause, RefreshCw, MoreVertical, Copy, ExternalLink,
  TrendingUp, BarChart2, PieChart, Users, Tag as TagIcon, Lock,
  Globe, Eye, EyeOff, Upload, Download, Link, Paperclip,
  ChevronLeft, ChevronsUpDown, GripVertical, Move,
  List, Table as TableIcon, Kanban, Activity, Target, Award,
  PanelLeftOpen, Building, Folder, Smile, Plug, ScanSearch, MapPin, Code2,
  Box, Grid3x3, CircleSlash
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// NAV SECTIONS
// ─────────────────────────────────────────────────────────────────────────────

// Only components belong in this navigation. The ten "Поверхні" entries that
// used to sit above Atoms were the fidelity audit — 145 hand-written controls
// photographed out of the product — and they now live on /ui-audit, where a
// report can be a report instead of impersonating a layer of the kit.
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
      { id: 'badges',       label: 'Priority, Tags & Counters', icon: Hash },
      { id: 'avatars',      label: 'Avatars & Teams',    icon: Users },
      { id: 'surfaces',     label: 'Surfaces',           icon: Layers },
      { id: 'tooltips',     label: 'Tooltips',           icon: MessageSquare },
    ]
  },
  {
    title: 'Молекули (Molecules)',
    items: [
      { id: 'task-attributes', label: 'Task Attributes Panel', icon: Settings },
      { id: 'form-groups',  label: 'Form Groups',        icon: AlignLeft },
      { id: 'filters',      label: 'Filter Bar',         icon: Filter },
      { id: 'navigation-overlays', label: 'Navigation & Overlays', icon: MoreVertical },
      { id: 'progress',     label: 'KPI Cards',          icon: TrendingUp },
      { id: 'feedback',     label: 'Feedback & States',  icon: Bell },
      { id: 'chat-composer', label: 'Chat Composer Dock', icon: MessageSquare },
      { id: 'chat-elements', label: 'Чат — власні елементи', icon: MessageSquare },
    ]
  },
  {
    title: 'Організми (Organisms)',
    items: [
      { id: 'task-crm',     label: 'Task Rows',          icon: CheckSquare },
      { id: 'dialogs',      label: 'Dialogs & Modals',   icon: MessageSquare },
    ]
  },
  {
    title: 'Лейаути (Layouts)',
    items: [
      { id: 'headers',           label: 'Header (Хедер)',                 icon: LayoutGrid },
      { id: 'page-headers',      label: 'Page Header (Шапка)',            icon: Type },
      { id: 'sidebar-layout',    label: 'Workspace Shell',                icon: PanelLeftOpen },
      { id: 'inner-nav-layout',  label: 'SidebarLayout — 3 контексти',    icon: List },
    ]
  },
  {
    // Every value the kit declares, in one grid. This is what makes "I change
    // it here, it changes on the site" checkable rather than hoped for.
    title: 'Контроль (Control)',
    items: [
      { id: 'variant-matrix', label: 'Матриця варіантів', icon: Grid3x3 },
    ]
  }
];

const SECTIONS = GROUPS.flatMap(g => g.items);

// ─────────────────────────────────────────────────────────────────────────────
// PREVIEW WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

// Opening the usage drawer is available to every preview without threading a
// callback through each section function.
const KitContext = createContext({ openUsage: () => {} });

function PreviewBlock({ title, description, children, filePath, component, fullWidth = false, dark = false }) {
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const { openUsage } = useContext(KitContext);

  // Both of these are generated: the snippet is the preview's own JSX, and the
  // count is the product's real usage. Neither is written next to the preview,
  // so neither can quietly stop being true.
  const code = kitUsage.previews?.[title];
  const usageEntry = component ? kitUsage.components?.[component] : null;

  const copyPath = () => {
    if (!filePath) return;
    navigator.clipboard.writeText(filePath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-[12px]">
      <div className="flex items-start justify-between w-full gap-3">
        <div className="min-w-0">
          <h3 className="text-[16px] font-bold text-[#1f1f1f]">{title}</h3>
          {description && <p className="text-[12px] text-[#9a9a9a] mt-[2px]">{description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {usageEntry && (
            <button
              onClick={() => openUsage(component)}
              title={`${component}: ${usageEntry.count} використань на ${usageEntry.routes.length} екранах`}
              className="flex cursor-pointer items-center gap-1.5 rounded-[6px] border border-[#e2e2e4] bg-[#f4f4f5] px-2.5 py-1 text-[11px] font-semibold text-[#71717a] transition-all hover:bg-[#e9e9e9] hover:text-[#18181b] active:scale-95"
            >
              <MapPin size={11} />
              <span className="font-mono">×{usageEntry.count}</span>
              <span className="text-[#cfcfcf]">·</span>
              <span>{usageEntry.routes.length} екранів</span>
            </button>
          )}
          {code && (
            <button
              onClick={() => setShowCode(value => !value)}
              aria-pressed={showCode}
              title="Показати код цього preview"
              className={`flex cursor-pointer items-center gap-1.5 rounded-[6px] border px-2.5 py-1 text-[11px] font-mono font-semibold transition-all active:scale-95 ${
                showCode
                  ? 'border-[#1f1f1f] bg-[#1f1f1f] text-white'
                  : 'border-[#e2e2e4] bg-[#f4f4f5] text-[#71717a] hover:bg-[#e9e9e9] hover:text-[#18181b]'
              }`}
            >
              <Code2 size={11} />
              Код
            </button>
          )}
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
      </div>
      <div className={`rounded-[16px] p-[24px] ${dark ? 'bg-[#1f1f1f]' : 'bg-white border border-[#f0f0f0]'} ${fullWidth ? '' : 'flex flex-wrap items-center gap-[12px]'}`}>
        {children}
      </div>
      {showCode && code && (
        <pre className="overflow-x-auto rounded-[12px] bg-[#1f1f1f] p-[16px] text-[11px] leading-relaxed text-[#e4e4e7]">
          <code>{code}</code>
        </pre>
      )}
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
      <PreviewBlock title="Primary Buttons" component="Button" description="Головні дії. Кольори: фон #1f1f1f (hover #303030), текст #ffffff. Небезпечна дія (danger, color=red): фон #ef4444. Скруглення (border-radius): 10px для всіх розмірів. Висота: Large 36px, Medium 32px, Small 28px." fullWidth>
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
      <PreviewBlock
        title="Адаптивний подвійний підпис"
        description="IssueDetail тримає в children два span-и: короткий на мобільному, повний на десктопі. Це не те саме, що collapseAt — той ховає підпис цілком, а тут підпис саме змінюється. Затверджено як канон. Звузь вікно, щоб побачити перемикання."
        filePath="src/components/workspace/IssueDetail.jsx"
        fullWidth
      >
        <div className="flex flex-wrap items-center gap-[8px]">
          <Button aria-label="Додати підзадачу" style="ghost" size="sm" composition="inline-add-action" icon={Plus}>
            <span className="sm:hidden">Підзадача</span><span className="hidden sm:inline">Додати підзадачу</span>
          </Button>
          <Button aria-label="Додати зв’язок" style="ghost" size="sm" composition="inline-add-action" icon={Plus}>
            <span className="sm:hidden">Зв’язок</span><span className="hidden sm:inline">Додати зв’язок</span>
          </Button>
          <Button aria-label="Додати мітку" style="ghost" size="sm" composition="inline-add-action" icon={Plus}>
            <span className="sm:hidden">Мітка</span><span className="hidden sm:inline">Додати мітку</span>
          </Button>
        </div>
      </PreviewBlock>

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
  const [show, setShow] = useState(false);
  const [chk, setChk] = useState(false);
  const [tgl, setTgl] = useState(true);
  const [dateSingle, setDateSingle] = useState('');
  const [timeSingle, setTimeSingle] = useState('09:00');
  const [hiddenStatusIds, setHiddenStatusIds] = useState(['done']);

  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Named Input sizes — sm / md / lg" component="Input" description="Три живі висоти для Input та суміжних controls: sm 28px, md 32px, lg 36px. lg є стандартом за замовчуванням." fullWidth>
        <div className="max-w-[400px] flex flex-col gap-[12px]">
          <Input size="sm" placeholder="Small — 28px" />
          <Input size="md" placeholder="Medium — 32px" />
          <Input size="lg" placeholder="Large — 36px" value={val} onChange={e => setVal(e.target.value)} />
          <Input size="md" preset="money" suffix="₴/г" type="number" defaultValue="125" aria-label="Грошове значення" />
          <Input size="lg" placeholder="Заблоковане поле" disabled />
        </div>
      </PreviewBlock>

      <PreviewBlock title="Checkbox & Toggle" component="ToggleSwitch" description="Ті самі Checkbox і ToggleSwitch, які зараз використовує продукт.">
        <div className="flex items-center gap-[24px] flex-wrap">
          <Checkbox checked={chk} onChange={setChk} label="Я погоджуюся з умовами" id="chk-demo" />
          <ToggleSwitch checked={tgl} onChange={setTgl} label="Активний спринт" />
        </div>
      </PreviewBlock>

      <PreviewBlock title="Project Status Visibility" description="Shared picker для створення й налаштувань проєкту. Беклог заблокований як обов’язкова fallback-колонка." fullWidth>
        <div className="max-w-[520px]">
          <StatusVisibilityPicker
            statuses={DEFAULT_STATUSES}
            hiddenStatusIds={hiddenStatusIds}
            onChange={setHiddenStatusIds}
          />
        </div>
      </PreviewBlock>

      <PreviewBlock title="Date & Time Pickers" description="Живі DatePicker і TimePicker, які використовуються у задачах, календарі та налаштуваннях." fullWidth>
        <div className="grid max-w-[532px] gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[6px] block">Оберіть дату</label>
            <DatePicker value={dateSingle} onChange={setDateSingle} placeholder="Оберіть день..." />
          </div>
          <div>
            <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[6px] block">Оберіть час</label>
            <TimePicker value={timeSingle} onChange={setTimeSingle} aria-label="Демонстраційний час" />
          </div>
        </div>
      </PreviewBlock>

      <PreviewBlock title="Brand image upload" description="Фактичний світлий ImageUpload із налаштувань профілю та брендування." filePath="src/app/(app)/settings/page.js" fullWidth>
        <div className="max-w-[380px] rounded-[16px] border border-line bg-white p-[20px]">
          <ImageUpload value="/favicon.ico" onChange={() => {}} theme="light" />
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

      <PreviewBlock title="Textarea" component="Textarea" description="Багаторядкові текстові області. Кольори: фон #f4f4f5, фокус-рамка #1f1f1f. Скруглення: 10px. Зміна розміру (resize) вимкнена за замовчуванням." fullWidth>
        <div className="max-w-[500px] flex flex-col gap-[10px]">
          <Textarea placeholder="Опис завдання або проєкту..." rows={3} />
          <Textarea placeholder="Великий опис..." rows={6} />
        </div>
      </PreviewBlock>

      <PreviewBlock title="Form label pattern" component="Label" description="Always 11px, bold, uppercase, tracking-wider, color #9a9a9a." fullWidth>
        <div className="max-w-[400px] flex flex-col gap-[16px]">
          <div>
            <Label htmlFor="kit-project-name" required className="mb-[6px] block">Назва проєкту</Label>
            <Input id="kit-project-name" placeholder="Наприклад: Редизайн сайту" />
          </div>
          <div>
            <Label htmlFor="kit-project-description" className="mb-[6px] block">Опис</Label>
            <Textarea id="kit-project-description" placeholder="Короткий опис..." rows={3} />
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
  // `user` on every option so the previews show the avatar treatment the
  // product actually renders, not a bare list of names.
  const memberOpts = [
    { value: 'u1', label: 'Артур Моспан', user: { id: 'u1', name: 'Артур Моспан' } },
    { value: 'u2', label: 'Іван Петренко', user: { id: 'u2', name: 'Іван Петренко' } },
    { value: 'u3', label: 'Марина Коваль', user: { id: 'u3', name: 'Марина Коваль' } },
    { value: 'u4', label: 'Дмитро Сірко', user: { id: 'u4', name: 'Дмитро Сірко' } },
  ];

  return (
    <div className="flex flex-col gap-[40px]">
      {/* ─── Standard Selects ─── */}
      <PreviewBlock title="Standard Selects — sm / md / lg" component="Select" description="Named sizes збігаються з Input і Button: 28 / 32 / 36px. Ghost-фільтри мають окремий compact preset." fullWidth>
        <div className="flex flex-wrap items-center gap-[8px]">
          <Select size="sm" options={statusOpts} value={v1} onChange={setV1} placeholder="Small — 28px" className="w-[160px]" />
          <Select size="md" options={priorityOpts} value={v2} onChange={setV2} placeholder="Medium — 32px" className="w-[160px]" />
          <Select size="lg" options={statusOpts} value={v1} onChange={setV1} placeholder="Large — 36px" className="w-[180px]" />
        </div>
      </PreviewBlock>

      {/* ─── Ghost Select & MultiSelect ─── */}
      <PreviewBlock title="Ghost Select & MultiSelect" description="Безмежові селектори для панелей фільтрів (FilterBar). Висота: 28px (вбудована в FilterBar висотою 36px). Кольори: фон transparent (hover #ebebeb), текст #1f1f1f, маркер #9a9a9a. Скруглення: 8px. Активуються при наведенні, мають уніфікований шрифт (font-medium). Контекст context=&quot;stacked&quot; розтягує кожен контрол на всю ширину — його використовує PageHeader у мобільній модалці фільтрів." fullWidth>
        <FilterBar>
          <Select filterRole="type" options={statusOpts} value={v4} onChange={setV4} placeholder="Всі статуси" variant="ghost" />
          <MultiSelect filterRole="member" options={memberOpts} value={v5} onChange={setV5} placeholder="Всі виконавці" searchPlaceholder="Шукати..." variant="ghost" />
        </FilterBar>
      </PreviewBlock>

      {/* ─── Inline Attribute Select ─── */}
      <PreviewBlock title="Inline Attribute Select" description="Ультракомпактний селектор для бічних панелей деталей та таблиць. Висота: 22px. Кольори: bg-transparent, текст #1f1f1f. Скруглення: 10px. Охоплює ховер-ефектом (#ebebeb) увесь стовпчик разом із заголовком. Атрибути з кількома значеннями (виконавці) використовують MultiSelect із compact + showSelectedAvatars — стек аватарів і «Ім’я +N» замість «Обрано (N)»." fullWidth>
        <div className="max-w-[200px] bg-[#f4f4f5] p-4 rounded-[12px]">
          <div className="hover:bg-[#ebebeb] p-2 -m-2 rounded-[10px] transition-colors flex flex-col gap-[4px] w-full cursor-pointer" onClick={e => { if (e.target.tagName === 'SPAN' || e.target === e.currentTarget) e.currentTarget.querySelector('button')?.click(); }}>
            <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider">Статус</span>
            <Select
              value={v6}
              onChange={setV6}
              options={statusOpts}
              buttonClassName="h-[22px] w-full justify-start gap-1 rounded-[10px] bg-transparent px-0 text-[13px] font-medium leading-[22px]"
            />
          </div>
          <div className="mt-3 hover:bg-[#ebebeb] p-2 -m-2 rounded-[10px] transition-colors flex flex-col gap-[4px] w-full cursor-pointer" onClick={e => { if (e.target.tagName === 'SPAN' || e.target === e.currentTarget) e.currentTarget.querySelector('button')?.click(); }}>
            <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider">Виконавці</span>
            <MultiSelect
              compact
              showSelectedAvatars
              value={v3}
              onChange={setV3}
              options={memberOpts}
              placeholder="Не призначено"
              searchPlaceholder="Знайти учасника..."
              buttonClassName="h-[22px] w-full justify-start gap-1 rounded-[10px] bg-transparent px-0 text-[13px] font-medium leading-[22px]"
              dropdownClassName="w-[260px]"
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
  const [a3, setA3] = useState('kanban');
  const [period, setPeriod] = useState(30);
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

      <PreviewBlock title="Segmented Switcher" component="Segmented" description="Компактний взаємовиключний перемикач, який продукт використовує всередині FilterBar для періодів і режимів.">
        <div className="rounded-[10px] bg-canvas p-[2px]">
          <Segmented
            value={period}
            onChange={setPeriod}
            options={[7, 14, 30, 90].map(days => ({ value: days, label: `${days}д` }))}
          />
        </div>
      </PreviewBlock>
    </div>
  );
}

function SurfacesSection() {
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Панельна ієрархія (Layout Surfaces)" component="Surface" description="Головні будівельні блоки для контент-зони. Дотримуються правил вкладеності: сіра підкладка (Level 1) -> вкладені білі картки або сірі інсети (Level 2)." fullWidth>
        
        {/* Level 1: Gray Main Panel */}
        <Surface preset="panel" padding="lg" className="w-full">
          <div className="mb-[16px]">
            <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider bg-white border border-[#e9e9e9] px-[8px] py-[3px] rounded-[6px]">
              Level 1: Main Panel (#f4f4f5, rounded-[16px])
            </span>
            <p className="text-[12px] text-[#9a9a9a] mt-[8px]">Основна сіра контент-зона для розмежування логічних секцій або колонок.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
            {/* Level 2: White Card Surface */}
            <Surface preset="nested-card" padding="lg">
              <span className="text-[10px] font-bold text-[#6366f1] uppercase tracking-wider bg-[#6366f1]/8 border border-[#6366f1]/15 px-[8px] py-[3px] rounded-[6px]">
                Level 2: White Card (rounded-[12px])
              </span>
              <p className="text-[13px] text-[#1f1f1f] font-semibold mt-[12px]">Біла плаваюча картка</p>
              <p className="text-[12px] text-[#9a9a9a] mt-[4px]">Без рамки та без тіней. Чиста біла поверхня для розміщення окремих завдань, деталей або списків.</p>
            </Surface>

            <Surface preset="card" padding="md" className="flex flex-col">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
                Team page card (rounded-[16px])
              </span>
              <p className="mt-[12px] text-[13px] font-semibold text-ink">Біла продуктова поверхня</p>
              <p className="mt-[4px] text-[12px] text-muted">Другий реально використаний Surface-варіант.</p>
            </Surface>
          </div>

        </Surface>
      </PreviewBlock>

      <PreviewBlock title="Card variants" component="Card" description="Живий Card, який використовується на сторінках аналітики, налаштувань, інтеграцій та порталу." fullWidth>
        <div className="grid w-full grid-cols-1 gap-[16px] md:grid-cols-2">
          <Card preset="bordered" padding="lg">
            <p className="text-[13px] font-bold text-ink">White card</p>
            <p className="mt-[4px] text-[12px] text-muted">Стандартна продуктова картка з border-line.</p>
          </Card>
          <Card preset="borderless" padding="lg">
            <p className="text-[13px] font-bold text-ink">Borderless white card</p>
            <p className="mt-[4px] text-[12px] text-muted">Найпоширеніший фактичний варіант у Settings та Analytics.</p>
          </Card>
        </div>
      </PreviewBlock>

      <PreviewBlock title="Outline danger — Profile emergency call" description="Єдиний фактичний outline-варіант на сайті." filePath="src/components/profile/ProfileView.jsx">
        <Button
          style="outline"
          color="red"
          size="lg"
          icon={Zap}
          className="!bg-red-50 hover:!bg-red-100 !border !border-[#ef4444]"
        >
          Виклик
        </Button>
      </PreviewBlock>

      <PreviewBlock
        title="IconAction — neutral compact actions" component="IconAction"
        description="Живе semantic family для close/edit/more/download та інших нейтральних icon-actions. Geometry і appearance названі, тому product та /ui-kit використовують один контракт."
        filePath="src/components/ui/IconAction.jsx"
        fullWidth
      >
        <div className="flex flex-wrap items-center gap-3">
          <IconAction label="Редагувати" icon={Edit2} size="xs" appearance="quiet" />
          <IconAction label="Налаштування" icon={Settings} size="sm" appearance="soft" />
          <IconAction label="Більше" icon={MoreVertical} size="md" appearance="surface" />
          <IconAction label="Закрити" icon={X} size="md" appearance="surface-plain" />
          <IconAction label="Видалити" icon={Trash2} size="sm" appearance="surface-danger" />
        </div>
      </PreviewBlock>
    </div>
  );
}

function BadgesSection() {
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock
        title="Pill — semantic metadata family" component="Pill"
        description="Спільна geometry для neutral metadata, status-like tones і compact badges. Counter, StatusPill та TypeBadge зберігають окрему семантику поверх тієї самої системи."
        filePath="src/components/ui/DataDisplay/Pill.jsx"
        fullWidth
      >
        <div className="flex flex-wrap items-center gap-3">
          <Pill tone="neutral" size="sm">Metadata</Pill>
          <Pill tone="dark" size="md">Dark</Pill>
          <Pill tone="success" size="md">Готово</Pill>
          <Pill tone="warning" size="md">Очікує</Pill>
          <Pill tone="danger" size="md">Прострочено</Pill>
          <Pill tone="info" size="sm" shape="badge">1г 25хв</Pill>
          <Pill tone="surface" size="wide-sm" appearance="soft-outline">Проєкт</Pill>
          <Pill tone="neutral" size="md" preset="avatar-counter">+3</Pill>
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="Композитні Pill — вкладені елементи"
        description="Pill приймає не лише текст. Ці три композиції — з IssueCard та календаря: іконка стану, текст із забарвленим суфіксом, і аватар учасника з його відповіддю. Затверджено як канон: продукт лишається, каталог їх описує."
        filePath="src/components/ui/DataDisplay/Pill.jsx"
        fullWidth
      >
        <div className="flex flex-col gap-[18px] w-full">
          <div>
            <h4 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[8px]">Іконка стану — IssueCard</h4>
            <Pill tone="danger" size="sm" shape="badge" weight="medium" title="Заблоковано іншою задачею">
              <Lock size={10} />
              Заблоковано
            </Pill>
          </div>
          <div>
            <h4 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[8px]">Текст із забарвленим суфіксом — форма події</h4>
            <div className="flex flex-wrap gap-[6px]">
              <Pill tone="neutral" size="wide-sm" weight="medium">
                Артур Моспан
                <span className="text-emerald-600">· буде</span>
              </Pill>
              <Pill tone="neutral" size="wide-sm" weight="medium">
                Олена Коваль
                <span className="text-muted">· очікуємо</span>
              </Pill>
            </div>
          </div>
          <div>
            <h4 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[8px]">Аватар + імʼя + стан — сторінка події</h4>
            <Pill tone="surface-ink" size="lg" weight="medium">
              <UserAvatar user={{ id: 'kit-arthur', name: 'Артур Моспан' }} size="xs" />
              <span className="font-semibold">Артур Моспан</span>
              <span className="text-emerald-600">· буде</span>
            </Pill>
          </div>
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="TypeBadge — task type"
        description="Єдиний бейдж типу, який напряму використовують IssueCard, TaskRow та рядки рахунку в аналітиці."
        filePath="src/components/ui/DataDisplay/TypeBadge.jsx"
      >
        <div className="flex flex-wrap items-center gap-[8px]">
          {DEFAULT_TYPES.map(type => (
            <TypeBadge key={type.id} label={type.label} color={type.color} />
          ))}
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="PriorityBadge — Billing task rows"
        description="Живий бейдж пріоритету з BillingTab. Значення приходить із завдання, тому показані всі можливі пріоритети."
        filePath="src/components/workspace/BillingTab.jsx"
      >
        <div className="flex items-center gap-[8px]">
          <PriorityBadge priority="low" />
          <PriorityBadge priority="medium" />
          <PriorityBadge priority="high" />
          <PriorityBadge priority="blocker" />
          <PriorityBadge priority="info" />
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="Tag — issue labels"
        description="Два фактичні розміри мітки: компактний у IssueCard та стандартний у IssueDetail. Колір завжди приходить із конфігурації мітки бренду/проєкту."
        filePath="src/components/workspace/IssueCard.jsx"
      >
        <div className="flex items-center gap-[12px]">
          <Tag label="Фронтенд" color="#3b82f6" size="small" className="shrink-0" />
          <Tag label="Дизайн" color="#db2777" />
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="Counter — chat and branded navigation" component="Counter"
        description="Живі sm-лічильники: subtle для колонок дошки, світлий для чату, темний для навігації та dot-індикатор організації."
        filePath="src/components/WorkspaceSidebar.jsx"
        fullWidth
      >
        <div className="grid gap-[16px] md:grid-cols-3">
          <div>
            <h4 className="mb-[10px] text-[11px] font-bold uppercase tracking-wider text-muted">Board column · subtle</h4>
            <Counter value={337} size="sm" appearance="subtle" />
          </div>
          <div>
            <h4 className="mb-[10px] text-[11px] font-bold uppercase tracking-wider text-muted">Chat list · light surface</h4>
            <Counter value={12} size="sm" status="muted" className="shrink-0" />
          </div>
          <div className="rounded-[12px] bg-ink p-[16px]">
            <h4 className="mb-[10px] text-[11px] font-bold uppercase tracking-wider text-white/50">Sidebar · branded dark surface</h4>
            <div className="flex items-center gap-[12px]">
              <Counter value={7} size="sm" status="muted" dark />
              <Counter value={3} size="sm" status="info" dark />
              <Counter variant="dot" size="sm" status="info" dark />
            </div>
          </div>
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="StatusPill — sprint states"
        description="Спільний компактний статус зі сторінки спринтів. Геометрія однакова, а label і semantic color приходять із контексту."
        filePath="src/app/(app)/sprints/page.js"
      >
        <div className="flex flex-wrap items-center gap-[8px]">
          <StatusPill label="Активний" color="#10b981" />
          <StatusPill label="Запланований" color="#9a9a9a" />
          <StatusPill label="Завершено" color="#1f1f1f" />
        </div>
      </PreviewBlock>

    </div>
  );
}

function AvatarsSection() {
  const sizes = [['xs', 16], ['sm', 24], ['md', 32], ['lg', 40], ['xl', 48], ['hero', 96]];
  const demoUser = { id: 'ui-kit-arthur', name: 'Артур Моспан' };
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock
        title="UserAvatar sizes"
        component="UserAvatar"
        description="Канонічний живий аватар із продукту: фото, fallback-ініціали, детермінований колір і tooltip. Розмір задається токеном шкали, а не числом — джерело значень одне, у AVATAR_SIZES."
        filePath="src/components/ui/DataDisplay/UserAvatar.jsx"
      >
        <div className="flex flex-wrap items-end gap-[16px]">
          {sizes.map(([token, px]) => (
            <div key={token} className="flex flex-col items-center gap-[6px]">
              <UserAvatar user={demoUser} size={token} tooltip />
              <span className="text-[9px] font-mono text-[#1f1f1f]">{token}</span>
              <span className="text-[9px] font-mono text-[#cfcfcf]">{px}px</span>
            </div>
          ))}
        </div>
      </PreviewBlock>

      <PreviewBlock title="UserAvatar states" description="Ті самі стани, які реально бачить користувач: брендований колір і відсутні дані.">
        <UserAvatar user={{ name: 'Олена Коваль', avatarColor: '#059669' }} size="lg" tooltip />
        <UserAvatar user={null} size="lg" />
      </PreviewBlock>
    </div>
  );
}

function ProgressSection() {
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="KPI Cards" description="Живі KpiCard з аналітики, velocity та workload." fullWidth>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          <KpiCard label="Всі завдання" value="89 / 124" sub="71% прогресу" icon={Target} trend={12} />
          <KpiCard label="Velocity (7д)" value="14" sub="завдань за тиждень" icon={Zap} trend={-5} />
          <KpiCard label="Списано часу" value="45г 30хв" sub="по 4 проєктах" icon={Clock} />
          <KpiCard label="Команда" value="8" sub="учасників із завданнями" icon={Users} />
        </div>
      </PreviewBlock>
    </div>
  );
}



const KIT_MENU_LABELS = [
  { id: 'frontend', label: 'Фронтенд' },
  { id: 'bug', label: 'Баг' },
  { id: 'design', label: 'Дизайн' },
];

function NavigationOverlaysSection() {
  const [menuLabelIds, setMenuLabelIds] = useState(['frontend']);
  const menuItems = [
    { icon: Edit2, label: 'Редагувати', onClick: () => alert('Редагувати') },
    { icon: Copy, label: 'Дублювати', onClick: () => alert('Дублювати') },
    { icon: Users, label: 'Учасники', onClick: () => alert('Учасники') },
    { icon: Settings, label: 'Налаштування', onClick: () => alert('Налаштування') },
    { isDivider: true },
    { icon: Trash2, label: 'Видалити', isDanger: true, onClick: () => alert('Видалити') },
  ];
  const toggleMenuItems = KIT_MENU_LABELS.map(label => ({
    icon: TagIcon,
    label: label.label,
    selected: menuLabelIds.includes(label.id),
    onClick: () => setMenuLabelIds(current => (
      current.includes(label.id)
        ? current.filter(id => id !== label.id)
        : [...current, label.id]
    )),
  }));

  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Popover & Tooltip" component="Popover" description="Живі Popover і Tooltip, які використовує продукт." fullWidth>
        <div className="flex items-center gap-[24px] flex-wrap">
          <Popover
            trigger={<Button style="secondary">Показати Popover</Button>}
            position="bottom"
          >
            <div className="p-2">
              <h4 className="text-[14px] font-bold mb-1">Інформаційне вікно</h4>
              <p className="text-[12px] text-[#9a9a9a]">Корисна інформація або додаткові налаштування.</p>
            </div>
          </Popover>

          <Popover
            position="bottom"
            align="start"
            gap={4}
            hideCloseIcon
            hideArrow
            minWidth="200px"
            padding="6px"
            triggerClassName="inline-flex"
            trigger={(
              <button
                type="button"
                data-ui-control="identity-meta-trigger"
                className="ui-native-control text-[12px] font-medium text-muted"
              >
                <span>Автор:</span>
                <UserAvatar user={{ id: 'u1', name: 'Артур Моспан' }} size="xs" />
                <span className="font-semibold text-ink">Артур Моспан</span>
              </button>
            )}
          >
            <div className="w-[188px]">
              <Button style="ghost" size="md" composition="menu-item">
                Переглянути профіль
              </Button>
              <Button style="ghost" size="md" composition="menu-item">
                Написати в чат
              </Button>
            </div>
          </Popover>

          <Tooltip content="Це підказка при наведенні" position="top">
            <Button style="secondary">Наведіть для підказки</Button>
          </Tooltip>
        </div>
      </PreviewBlock>

      <PreviewBlock title="Context Menu" description="Живий ContextMenu з продуктовими станами елементів. Пункт із prop selected стає перемикачем: галочка праворуч, напівжирна назва, панель не закривається (closeOnSelect={false})." fullWidth>
        <div className="flex items-start gap-[40px] flex-wrap">
          <div className="flex flex-col gap-[8px]">
            <span className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider">Інтерактивне меню</span>
            <ContextMenu
              trigger={<Button style="secondary" size="icon" icon={MoreVertical}>Меню</Button>}
              items={menuItems}
            />
          </div>
          <div className="flex flex-col gap-[8px]">
            <span className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider">Меню-перемикач (мітки задачі)</span>
            <ContextMenu
              trigger={(
                <Button style="ghost" size="sm" composition="inline-add-action" icon={Plus}>
                  Додати мітку
                </Button>
              )}
              dropdownClassName="w-[220px]"
              closeOnSelect={false}
              items={toggleMenuItems}
            />
          </div>
        </div>
      </PreviewBlock>

    </div>
  );
}

function ConfirmDialogPreview() {
  const confirm = useConfirm();
  const [lastResult, setLastResult] = useState(null);

  const openConfirm = async () => {
    const accepted = await confirm({
      title: 'Видалити проєкт?',
      message: 'Ви видаляєте «Редизайн сайту». Цю дію неможливо скасувати.',
      confirmText: 'Видалити',
      danger: true,
    });
    setLastResult(accepted ? 'Підтверджено' : 'Скасовано');
  };

  return (
    <div className="flex items-center gap-[12px]">
      <Button style="secondary" color="red" size="lg" icon={Trash2} onClick={openConfirm}>Видалити</Button>
      {lastResult && <span className="text-[12px] font-semibold text-muted">{lastResult}</span>}
    </div>
  );
}

// Each of these ships on the site, and the first version of this preview gave
// no way to tell — six bare buttons labelled with prop syntax read as invented
// options. `where` is the screen you have already seen it on; `open` is what
// you do there to get it. Counts come from `npm run kit:scan`.
const DIALOG_VARIANTS = [
  {
    id: 'flush',
    label: 'bodyPadding="flush"',
    props: { bodyPadding: 'flush', size: 'lg' },
    note: 'Тіло без відступу — вміст сам керує своїми полями й може йти на всю ширину.',
    where: 'Створення завдання · Профіль користувача',
    open: 'Мої завдання → «Створити завдання»',
  },
  {
    id: 'responsive',
    label: 'bodyPadding="responsive"',
    props: { bodyPadding: 'responsive', size: 'md' },
    note: 'Вужчий відступ на мобільному, звичайний на десктопі.',
    where: 'Деталі задачі · Подія календаря',
    open: 'Проєкт → задача → «Списати час»',
  },
  {
    id: 'spacious',
    label: 'bodyPadding="spacious"',
    props: { bodyPadding: 'spacious', size: 'sm' },
    note: 'Просторі форми, де поля не мають тиснутись до країв.',
    where: 'Мої завдання · Зміна статусу користувача',
    open: 'Клац на свій аватар → «Змінити статус»',
  },
  {
    id: 'invite',
    label: 'bodyPadding="invite"',
    props: { bodyPadding: 'invite', size: 'lg' },
    note: 'Форма запрошення: поле пошти й роль на всю ширину, кнопки внизу.',
    where: 'Запрошення учасника',
    open: 'Команда → «+» у шапці списку',
  },
  {
    id: 'sheet',
    label: 'presentation="sheet"',
    props: { presentation: 'sheet', size: 'sm', bodyPadding: 'spacious' },
    note: 'Висувна панель збоку замість центрованої модалки — не окремий компонент, а той самий Dialog.',
    where: 'Мої завдання → налаштування вигляду',
    open: 'Мої завдання → іконка фільтрів праворуч',
  },
  {
    id: 'status',
    label: 'size="status"',
    props: { size: 'status' },
    note: 'Найвужчий діалог у продукті — рівно під поле статусу й емодзі.',
    where: 'Зміна статусу користувача',
    open: 'Клац на свій аватар у сайдбарі',
  },
];

function DialogsSection() {
  const [open1, setOpen1] = useState(false);
  const [dialogVariant, setDialogVariant] = useState(null);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [projectSettingsName, setProjectSettingsName] = useState('QuickTeam Website');
  const [projectSettingsDescription, setProjectSettingsDescription] = useState('Основний продукт команди');
  const [projectSettingsHidden, setProjectSettingsHidden] = useState(['done']);
  const [projectSettingsTeam, setProjectSettingsTeam] = useState(['owner-demo', 'designer-demo']);
  const [projectSettingsInvites, setProjectSettingsInvites] = useState('');
  return (
    <ConfirmProvider>
      <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Standard Dialog" component="Dialog" description="Спільний chrome: sm 440px, md 560px, lg 760px, xl 960px. Приклад нижче — sm dialog.">
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

      <PreviewBlock title="Danger / Confirm Dialog" description="Живий ConfirmProvider, який продукт використовує замість native confirm()/prompt().">
        <ConfirmDialogPreview />
      </PreviewBlock>

      {/* Dialog cannot render standalone in the variant matrix — it needs an
          open state — so its declared values are shown here, where they can be
          opened. Every one of these ships on the site, hence the «Де на сайті»
          line on each: the previous version was six bare buttons labelled with
          prop syntax, which read as options somebody invented for the kit. */}
      <PreviewBlock
        title="Dialog — решта оголошених значень"
        description="Це не окремі компоненти й не вигадані опції: усі шість стоять на реальних екранах, просто рідко (по 1–2 місця кожен). Під кожним написано, де саме він живе і як його відкрити в продукті."
        fullWidth
      >
        <div className="grid w-full gap-[10px] sm:grid-cols-2 lg:grid-cols-3">
          {DIALOG_VARIANTS.map(variant => (
            <div key={variant.id} className="flex flex-col gap-[8px] rounded-[12px] border border-line p-[12px]">
              <span className="font-mono text-[11px] font-bold text-ink">{variant.label}</span>
              <p className="text-[11px] leading-relaxed text-muted">{variant.note}</p>
              <div className="mt-auto flex flex-col gap-[6px] pt-[4px]">
                <span className="text-[10px] leading-relaxed text-faint">
                  <span className="font-semibold text-muted">Де на сайті:</span> {variant.where}
                  <br />
                  <span className="font-semibold text-muted">Як відкрити:</span> {variant.open}
                </span>
                <Button style="secondary" size="sm" onClick={() => setDialogVariant(variant.id)}>
                  Показати
                </Button>
              </div>
            </div>
          ))}
        </div>
        {DIALOG_VARIANTS.map(variant => (
          <Dialog
            key={variant.id}
            isOpen={dialogVariant === variant.id}
            onClose={() => setDialogVariant(null)}
            title={variant.label}
            {...variant.props}
          >
            <div className="flex flex-col gap-3">
              <p className="text-[12px] leading-relaxed text-muted">{variant.note}</p>
              <Surface preset="inset" padding="md">
                <p className="text-[11px] text-muted">
                  Живе тут: <span className="font-semibold text-ink">{variant.where}</span>
                </p>
                <p className="mt-1 font-mono text-[11px] text-ink">
                  {Object.entries(variant.props).map(([key, value]) => `${key}="${value}"`).join(' ')}
                </p>
              </Surface>
              <Button style="primary" size="md" onClick={() => setDialogVariant(null)}>Закрити</Button>
            </div>
          </Dialog>
        ))}
      </PreviewBlock>

      <PreviewBlock
        title="Project Settings Dialog"
        description="Точний shared organism з проєкту: правий sm sheet, як форма створення проєкту."
        filePath="src/components/ui/TaskManagement/ProjectSettingsForm.jsx"
      >
        <Button style="secondary" size="lg" icon={Settings} onClick={() => setProjectSettingsOpen(true)}>
          Налаштування проєкту
        </Button>
        <Dialog
          isOpen={projectSettingsOpen}
          onClose={() => setProjectSettingsOpen(false)}
          title="Налаштування проєкту"
          size="sm"
          footer={(
            <>
              <Button style="secondary" size="md" onClick={() => setProjectSettingsOpen(false)}>
                Скасувати
              </Button>
              <Button style="primary" size="md" onClick={() => setProjectSettingsOpen(false)}>
                Зберегти зміни
              </Button>
            </>
          )}
        >
          <ProjectSettingsForm
            name={projectSettingsName}
            onNameChange={setProjectSettingsName}
            description={projectSettingsDescription}
            onDescriptionChange={setProjectSettingsDescription}
            statuses={DEFAULT_STATUSES}
            hiddenStatusIds={projectSettingsHidden}
            onHiddenStatusIdsChange={setProjectSettingsHidden}
            backlogStatusId="backlog"
            teamMembers={[
              { id: 'owner-demo', name: 'Олена Коваль', email: 'olena@example.com' },
              { id: 'designer-demo', name: 'Іван Петренко', email: 'ivan@example.com' },
              { id: 'developer-demo', name: 'Марія Бондар', email: 'maria@example.com' },
            ]}
            teamMemberIds={projectSettingsTeam}
            onTeamMemberIdsChange={setProjectSettingsTeam}
            ownerId="owner-demo"
            layout="stacked"
            inviteEmails={projectSettingsInvites}
            onInviteEmailsChange={setProjectSettingsInvites}
          />
        </Dialog>
      </PreviewBlock>

      <PreviewBlock
        title="CreateTaskModal — large sheet"
        description="Живий великий організм створення задачі. Він використовує Dialog size=lg, тому ширина, заголовок, close та footer не дублюються локально."
        filePath="src/components/CreateTaskModal.jsx"
      >
        <Button style="primary" size="lg" icon={Plus} onClick={() => setCreateTaskOpen(true)}>
          Створити завдання
        </Button>
        <CreateTaskModal
          isOpen={createTaskOpen}
          onClose={() => setCreateTaskOpen(false)}
          onSubmit={async () => setCreateTaskOpen(false)}
          stages={[]}
          teamMembers={[]}
          projectContext={{ id: 'ui-kit', name: 'UI Kit' }}
          sprints={[]}
        />
      </PreviewBlock>
      </div>
    </ConfirmProvider>
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

      <PreviewBlock title="3) Хлібні крихти з пошуком (Project Mode)" description="Навігація проєкту з розсувним пошуком. Аватарок команди тут навмисно немає — склад проєкту видно на вкладці «Команда», а хедер лишається місцем для навігації." filePath="src/components/ui/Layout/TopHeader.jsx" fullWidth>
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
              { label: 'Проєкти', href: '/' },
              { label: 'Mobile App Redesign', href: '/project-1' },
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
            // No third-party avatar host here: the three placeholder URLs this
            // used to fetch failed on every load of the page, and the product
            // deliberately stores no such URL either — a user without a photo
            // gets initials in their own deterministic colour, which is the
            // thing worth previewing.
            onlineUsers={[
              { id: 'oksana', name: 'Оксана Литвин' },
              { id: 'ivan', name: 'Іван Петренко' },
              { id: 'taras', name: 'Тарас Шевчук' },
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
      <PreviewBlock title="1) Повний варіант (Full PageHeader)" description="Містить заголовок, кнопки дій, вкладки сторінки, фільтри та перемикач вигляду (як на сторінці Мої завдання). На екранах вужче 768px рядок фільтрів ховається: замість нього — іконка з лічильником активних фільтрів, яка відкриває їх у модалці (звузьте вікно, щоб перевірити)." filePath="src/components/ui/Layout/PageHeader.jsx" fullWidth>
        <div className="border border-[#f0f0f0] rounded-[24px] overflow-hidden bg-white p-[24px] w-full">
          <PageHeader
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
                    filterRole="project"
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
                    filterRole="type"
                    variant="ghost"
                    value={priority}
                    onChange={setPriority}
                    options={[
                      { value: 'all', label: 'Всі пріоритети' },
                      { value: 'blocker', label: 'Критичний', dotColor: '#ef4444' },
                      { value: 'high', label: 'Високий', dotColor: '#f97316' }
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
            title="Аналітика завантаження"
            filters={
              <FilterBar>
                <Select
                  variant="ghost"
                  value={priority}
                  onChange={setPriority}
                  options={[
                    { value: 'all', label: 'Всі пріоритети' },
                    { value: 'blocker', label: 'Критичний', dotColor: '#ef4444' },
                    { value: 'high', label: 'Високий', dotColor: '#f97316' }
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
  const [qtPlusProject, setQtPlusProject] = useState('');
  const [toast, setToast] = useState(null);
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Alerts" component="Alert" description="Компонент сповіщень. Має скруглення L3 (8px) відповідно до токенів." fullWidth>
        <div className="flex flex-col gap-[12px] max-w-[600px]">
          <Alert variant="success" title="Операція успішна">Проєкт успішно створено та додано до бази даних.</Alert>
          <Alert variant="info" title="Потребує уваги">Будь ласка, перевірте правильність введених даних.</Alert>
          <Alert variant="warning" title="Попередження">Термін виконання завдання спливає сьогодні.</Alert>
          <Alert variant="error" title="Не вдалося завантажити проєкти">Спробуйте оновити сторінку.</Alert>
        </div>
      </PreviewBlock>

      <PreviewBlock title="Loading Spinner" description="Анімований спіннер для станів завантаження.">
        <div className="flex items-center gap-[24px]">
          <LoadingSpinner size="sm" />
          <LoadingSpinner size="md" />
        </div>
      </PreviewBlock>

      {/* Toast reported zero usages for months because WorkspaceToastHost
          imports it under a different name (`UiToast`), and the scan matched on
          the exported one. It is on every screen in the product. */}
      <PreviewBlock
        title="Toast"
        component="Toast"
        description="Спливне сповіщення, яке продукт показує через WorkspaceToastHost — той самий компонент, лише під локальним іменем UiToast. Рендериться в портал поверх усього; тут показані всі варіанти без автозакриття."
        filePath="src/components/WorkspaceToastHost.jsx"
        fullWidth
      >
        <div className="flex flex-wrap gap-2">
          {['success', 'error', 'warning', 'info', 'loading'].map(variant => (
            <Button key={variant} style="secondary" size="md" onClick={() => setToast(variant)}>
              {variant}
            </Button>
          ))}
        </div>
        {toast && (
          <Toast
            key={toast}
            variant={toast}
            message={`Toast variant="${toast}"`}
            action="Скасувати"
            onAction={() => setToast(null)}
            autoClose={false}
            onClose={() => setToast(null)}
          />
        )}
      </PreviewBlock>

      <PreviewBlock
        title="Empty States — продуктові контексти"
        description="Не вигадані картки: ліворуч точний empty state головної сторінки, праворуч точний empty state workspace-чату."
        filePath="src/components/ui/Feedback/EmptyState.jsx"
        fullWidth
      >
        <div className="grid w-full grid-cols-1 gap-[16px] lg:grid-cols-2">
          <Surface preset="panel" padding="md" className="w-full">
            <EmptyState
              icon={Folder}
              title="Ще немає проєктів"
              description="Створіть перший проєкт, щоб організувати завдання та роботу команди."
              action="Створити проєкт"
              onAction={() => {}}
              context="page"
            />
          </Surface>
          <div className="flex min-h-[328px] flex-1 items-center justify-center rounded-[16px] bg-canvas">
            <EmptyState
              icon={MessageSquare}
              title="Ще немає повідомлень"
              description="Почніть розмову! 👋"
              context="page"
            />
          </div>
        </div>
        <div className="mt-[16px] grid w-full grid-cols-1 gap-[16px] lg:grid-cols-2">
          <EmptyState
            icon={User}
            title="Нікого не знайдено"
            description="Спробуйте змінити пошуковий запит."
            density="compact"
          />
          <EmptyState
            icon={MessageSquare}
            title="Ще немає повідомлень"
            description="Почніть обговорення завдання з командою."
            context="flexible"
          />
          <EmptyState
            icon={Plug}
            title="Підключіть QuickTeam+"
            description="Підключіть акаунт, щоб працювати з матеріалами та чатом."
            action="Підключити QuickTeam+"
            onAction={() => {}}
            context="inset"
            surface="card"
          />
          <EmptyState
            icon={Plug}
            title="Оберіть проєкт QuickTeam+"
            description="Привʼяжіть клієнтський проєкт, щоб бачити етапи, матеріали та чат."
            context="inset"
            surface="card"
          >
            <div className="mx-auto flex w-full max-w-[420px] flex-col gap-2 sm:flex-row">
              <Select
                value={qtPlusProject}
                onChange={setQtPlusProject}
                options={[
                  { value: 'brand', label: 'Brand redesign' },
                  { value: 'mobile', label: 'Mobile application' },
                ]}
                placeholder="Оберіть проєкт QuickTeam+"
                className="min-w-0 flex-1 text-left"
              />
              <Button style="primary" size="lg" disabled={!qtPlusProject}>Привʼязати</Button>
            </div>
          </EmptyState>
        </div>
      </PreviewBlock>
    </div>
  );
}

// Chat's own kit components. The native controls that chat still hand-rolls
// were listed here too, which duplicated /ui-audit → Чат byte for byte; what
// stays is what chat contributes *to the kit* — its avatar scale, its icon
// sizes and its day divider, all of them real components.
function ChatElementsSection() {
  const demoUser = { id: 'kit-arthur', name: 'Артур Моспан' };
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock
        title="Чат — власна шкала аватарів"
        description="Чат побудований навколо 36px аватара в рядку повідомлення. Ці розміри існують тільки для чат-поверхонь і навмисно не зведені до загальної шкали: злиття в найближчі xs/sm/md зсувало кожен рядок на 4px."
        filePath="src/components/ui/DataDisplay/UserAvatar.jsx"
        component="UserAvatar"
        fullWidth
      >
        <div className="flex flex-wrap items-end gap-[20px]">
          {[['chat-message', 36, 'рядок повідомлення'], ['chat-member', 28, 'список учасників'],
            ['chat-inline', 20, 'у рядку'], ['chat-mention', 18, 'згадка в тексті']].map(([token, px, role]) => (
            <div key={token} className="flex flex-col items-center gap-[6px]">
              <UserAvatar user={demoUser} size={token} />
              <span className="font-mono text-[9px] font-bold text-[#1f1f1f]">{token}</span>
              <span className="text-[9px] text-[#cfcfcf]">{px}px · {role}</span>
            </div>
          ))}
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="Чат — розміри іконок у діях"
        description="Загальна шкала дає 20px коробці 16px іконку — правильно для щільних тулбарів і завелико для дії над повідомленням, де завжди було 12px. Задається іменованою composition, а не числом на місці виклику."
        filePath="src/components/ui/Button.jsx"
        fullWidth
      >
        <div className="flex flex-col gap-[16px]">
          {[['chat-micro-action', 12, 'дії над повідомленням: відповісти, редагувати, видалити'],
            ['chat-composer-cancel', 13, 'скасування в композері'],
            ['chat-message-action', 15, 'дії в рядку: гілка, закріпити'],
            ['chat-panel-action', 16, 'закрити гілку, інфо про канал'],
            ['chat-composer-action', 17, 'емодзі та вкладення в композері']].map(([token, px, role]) => (
            <div key={token} className="flex items-center gap-[12px]">
              <Button style="ghost" size="icon-sm" composition={token} icon={MessageSquare}>{token}</Button>
              <span className="font-mono text-[10px] font-bold text-[#1f1f1f]">{token}</span>
              <span className="text-[10px] text-[#cfcfcf]">{px}px · {role}</span>
            </div>
          ))}
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="Чат — роздільники дат"
        description="Пілюля дати між групами повідомлень. Має власну геометрію: під час зведення варіантів її склали в sm/wide-sm, від чого вона стала вужчою, а текст — на піксель більшим. Видно на кожному переході дня."
        filePath="src/app/globals.css"
        component="Pill"
      >
        <Pill tone="surface" size="chat-day" weight="medium" uppercase>Сьогодні</Pill>
        <Pill tone="surface" size="chat-day-wide" uppercase>12 березня</Pill>
      </PreviewBlock>
    </div>
  );
}

function ChatComposerSection() {
  const [message, setMessage] = useState('');
  const canSend = Boolean(message.trim());

  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock
        title="Workspace Chat Composer"
        description="Точна композиція основного workspace-чату: той самий canvas, textarea, toolbar, attachment/emoji controls і send state. ChatComposerDock відповідає лише за overlap."
        filePath="src/app/(app)/chat/page.js"
        fullWidth
      >
        <div className="h-[420px] w-full">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[16px] bg-canvas h-full">
          <div className="relative z-10 flex min-h-[64px] shrink-0 items-center gap-2 border-b border-line/70 bg-canvas/90 px-4 py-3 backdrop-blur-xl">
            <Hash size={17} className="shrink-0 text-ink" />
            <div className="min-w-0 flex-1">
              <h2 className="flex items-center gap-1.5 truncate text-[15px] font-bold text-ink">general</h2>
              <p className="truncate text-[11px] text-muted">Загальний канал для всієї команди</p>
            </div>
            <Info size={16} className="text-muted" />
          </div>

          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-12 pt-2 scroll-pb-12">
            <div className="flex h-full flex-1 items-center justify-center">
              <EmptyState
                icon={MessageSquare}
                title="Ще немає повідомлень"
                description="Почніть розмову! 👋"
              />
            </div>
          </div>

          <ChatComposerDock>
            <div className="relative px-4 pb-4">
              <ChatComposerCore
                variant="workspace"
                value={message}
                onChange={event => setMessage(event.target.value)}
                placeholder="Написати в #general..."
                toolbar={(
                  <>
                    <button
                      type="button"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink transition-colors"
                      title="Emoji"
                    >
                      <Smile size={17} />
                    </button>
                    <button
                      type="button"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink transition-colors"
                      title="Прикріпити файл"
                    >
                      <Paperclip size={17} />
                    </button>
                  </>
                )}
                onSubmit={() => setMessage('')}
                canSubmit={canSend}
              />
            </div>
          </ChatComposerDock>
        </div>
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="Task Timeline & QuickTeam+ composers"
        description="Спільне ядро ChatComposerCore з двома продуктовими оболонками: timeline має attachment-control, QuickTeam+ — компактну shell без нього."
        filePath="src/components/workspace/UnifiedTimeline.jsx"
        fullWidth
      >
        <div className="grid w-full grid-cols-1 gap-[16px] lg:grid-cols-2">
          <div className="flex h-[210px] flex-col overflow-hidden rounded-[16px] bg-canvas">
            <div className="flex-1 p-4 text-[12px] text-muted">Task timeline</div>
            <ChatComposerDock composition="timeline-composer">
              <ChatComposerCore
                variant="timeline"
                value=""
                onChange={() => {}}
                placeholder="Написати повідомлення..."
                leading={<Button className="self-center rounded-full" style="ghost" size="icon-sm" icon={Paperclip} type="button" aria-label="Додати файл" />}
                onSubmit={() => {}}
                canSubmit={false}
              />
            </ChatComposerDock>
          </div>

          <div className="flex h-[210px] flex-col overflow-hidden rounded-[16px] bg-canvas">
            <div className="flex-1 p-4 text-[12px] text-muted">QuickTeam+ chat</div>
            <ChatComposerDock composition="timeline-composer">
              <ChatComposerCore
                variant="qtplus"
                value=""
                onChange={() => {}}
                placeholder="Повідомлення…"
                onSubmit={() => {}}
                canSubmit={false}
              />
            </ChatComposerDock>
          </div>
        </div>
      </PreviewBlock>
    </div>
  );
}

function TaskCRMSection() {
  const { statuses } = useWorkflowConfig();
  const firstStatusId = statuses[0]?.id || DEFAULT_STATUSES[0].id;
  const secondStatusId = statuses[1]?.id || firstStatusId;
  const thirdStatusId = statuses[2]?.id || secondStatusId;
  const lastStatusId = statuses.at(-1)?.id || thirdStatusId;
  const demoMembers = [
    { uid: '1', name: 'Артур Моспан', initials: 'АМ', bg: '#6366f1' },
    { uid: '2', name: 'Іван Петренко', initials: 'ІП', bg: '#10b981' }
  ];

  const demoLabels = [
    { id: 'frontend', label: 'Фронтенд', color: '#3b82f6' },
    { id: 'design', label: 'Дизайн', color: '#db2777' },
    { id: 'bug', label: 'Баг', color: '#ef4444' }
  ];

  const demoSprints = [
    { id: 'sprint-1', name: 'Спринт 12' }
  ];

  const task1 = {
    id: 't1',
    issueKey: 'QUI-41',
    projectId: 'ui-kit-project',
    columnId: firstStatusId,
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
    issueKey: 'QUI-42',
    projectId: 'ui-kit-project',
    columnId: secondStatusId,
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
    issueKey: 'QUI-43',
    projectId: 'ui-kit-project',
    columnId: thirdStatusId,
    title: "Написати юніт-тести для нового контролера авторизації",
    priority: "low",
    type: "task",
    parentIssueId: 't1',
    assigneeIds: [],
    dueDate: null,
    subtasks: []
  };

  const task4 = {
    id: 't4',
    issueKey: 'QUI-44',
    projectId: 'ui-kit-project',
    columnId: lastStatusId,
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
    issueKey: 'QUI-45',
    projectId: 'ui-kit-project',
    columnId: firstStatusId,
    title: "Додати кнопку швидкого експорту звітів аналітики у CSV та PDF",
    priority: "low",
    type: "feature",
    assigneeIds: ['2'],
    dueDate: new Date('2026-07-14T12:00:00Z'),
    subtasks: [],
    labelIds: ['frontend']
  };
  const demoIssues = [task1, task2, task3, task4, task5];

  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Task Row (List View)" description="Один shared row для project і cross-project контекстів; назву проєкту вмикає лише semantic prop showProjectName." fullWidth>
        <div className="bg-[#f4f4f5] p-6 rounded-[16px] flex flex-col gap-[8px]">
          <p className="ui-type-eyebrow uppercase tracking-wider text-muted">Project context — назва проєкту прихована</p>
          <TaskRow
            issue={task1}
            allIssues={demoIssues}
            members={demoMembers}
            labels={demoLabels}
            sprints={demoSprints}
            projectName="QuickTeam"
          />
          <p className="ui-type-eyebrow mt-2 uppercase tracking-wider text-muted">Cross-project context — назва проєкту видима</p>
          <TaskRow
            issue={task2}
            allIssues={demoIssues}
            members={demoMembers}
            labels={demoLabels}
            sprints={demoSprints}
            projectName="QuickTeam"
            showProjectName
          />
          <TaskRow
            issue={task3}
            allIssues={demoIssues}
            members={demoMembers}
            labels={demoLabels}
            sprints={demoSprints}
            projectName="QuickTeam"
            showProjectName
          />
          <TaskRow
            issue={task4}
            allIssues={demoIssues}
            members={demoMembers}
            labels={demoLabels}
            sprints={demoSprints}
            projectName="QuickTeam"
            showProjectName
          />
          <TaskRow
            issue={task5}
            allIssues={demoIssues}
            members={demoMembers}
            labels={demoLabels}
            sprints={demoSprints}
            projectName="QuickTeam"
            showProjectName
          />
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="Task List View — живий shared organism"
        description="Саме цей organism рендерить обидва списки: hiddenStatusIds збирає відповідні задачі в секцію «Приховані», а showProjectName додає проєкт лише у cross-project view. Кожну секцію можна згорнути кнопкою праворуч (той самий ghost icon, що згортає колонку канбану); розділювальної лінії під заголовком немає — секції відділяє відступ."
        filePath="src/components/ui/TaskManagement/TaskListView.jsx"
        fullWidth
      >
        <TaskListView
          issues={demoIssues}
          allIssues={demoIssues}
          members={demoMembers}
          labels={demoLabels}
          sprints={demoSprints}
          projects={[{ id: 'ui-kit-project', name: 'QuickTeam' }]}
          showProjectName
          hiddenStatusIds={[lastStatusId]}
        />
      </PreviewBlock>

      <PreviewBlock
        title="Agile Board — живий shared organism"
        description="Та сама Kanban-дошка використовується в проєкті та в «Мої завдання». Відмінності контексту задаються явними props, а не другою копією верстки."
        filePath="src/components/workspace/AgileBoard.jsx"
        fullWidth
      >
        <div className="h-[520px] min-w-0 overflow-hidden rounded-[16px] bg-white p-4">
          <AgileBoard
            issues={demoIssues}
            allIssues={demoIssues}
            members={demoMembers}
            projects={[{ id: 'ui-kit-project', name: 'QuickTeam' }]}
            projectId="ui-kit-project"
            project={{ id: 'ui-kit-project', name: 'QuickTeam', hiddenColumns: [] }}
            sprints={demoSprints}
            onAddIssue={() => {}}
            onMoveIssue={() => {}}
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

function TooltipsSection() {
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Tooltip Component" component="Tooltip" description="Компонент підказки, який з'являється при наведенні. Підтримує 4 позиції: top (default), bottom, left, right." fullWidth>
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

function TaskAttributesSection() {
  const [statusVal, setStatusVal] = useState('todo');
  const [memberVal, setMemberVal] = useState('1');
  const [sprintVal, setSprintVal] = useState('sprint-12');
  const [dueDate, setDueDate] = useState('2026-08-07');
  const [priority, setPriority] = useState('medium');
  const [type, setType] = useState('feature');
  const [eventType, setEventType] = useState('meeting');
  const [eventProject, setEventProject] = useState('quickteam');
  
  const statusOpts = DEFAULT_STATUSES.map(s => ({ value: s.id, label: s.label, dotColor: s.color }));
  
  const memberOpts = [
    { value: '', label: 'Не призначено' },
    { value: '1', label: 'Артур Моспан' },
    { value: '2', label: 'Олена Коваль' },
    { value: '3', label: 'Дмитро Петренко' }
  ];
  const {
    attributeItemClass,
    attributeLabelClass,
    compactInputClass,
    compactSelectClass,
    detailsButtonClass,
  } = getTaskAttributeChrome();

  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock
        title="Task Attributes Panel — Issue Detail"
        description="Точний primary strip зі сторінки завдання: ті самі compact/singleRow props, grid, поля, кнопка таймера та Details popover."
        filePath="src/components/workspace/IssueDetail.jsx"
        fullWidth
      >
        <div className="relative isolate -mx-2 px-2">
          <TaskAttributesPanel
            singleRow
            context="task"
            compact
            cardClassName="transition-[background-color,padding] duration-200"
            primaryChildren={
              <>
                <div className={attributeItemClass}>
                  <span className={attributeLabelClass}>Статус</span>
                  <Select compact value={statusVal} onChange={setStatusVal} options={statusOpts} buttonClassName={compactSelectClass} />
                </div>

                <div className={attributeItemClass}>
                  <span className={attributeLabelClass}>Виконавець</span>
                  <Select compact value={memberVal} onChange={setMemberVal} options={memberOpts} buttonClassName={compactSelectClass} />
                </div>

                <div className={`max-sm:hidden ${attributeItemClass}`}>
                  <span className={attributeLabelClass}>Спринт</span>
                  <Select
                    compact
                    value={sprintVal}
                    onChange={setSprintVal}
                    options={[
                      { value: '', label: 'Беклог (без спринта)' },
                      { value: 'sprint-12', label: 'Спринт 12' },
                    ]}
                    buttonClassName={compactSelectClass}
                  />
                </div>

                <div className={`max-sm:hidden ${attributeItemClass}`}>
                  <span className={attributeLabelClass}>Дедлайн</span>
                  <DatePicker
                    compact
                    hideIcon
                    inputClassName={compactInputClass}
                    value={dueDate}
                    onChange={setDueDate}
                    placeholder="Без дедлайну"
                  />
                </div>

                <div className={`${attributeItemClass} max-sm:px-1.5`}>
                  <span className={attributeLabelClass}><span className="sm:hidden">Час</span><span className="max-sm:hidden">Трекінг часу</span></span>
                  <div className="flex h-[22px] min-w-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label="Запустити таймер"
                      title="Запустити таймер"
                      className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[6px] bg-line leading-none text-ink transition-colors hover:bg-[#d9d9d9]"
                    >
                      <Play size={10} strokeWidth={0} className="block translate-x-[1px] fill-current" />
                    </button>
                    <button type="button" className="min-w-0 truncate text-[11px] font-bold text-ink">
                      1г 25хв <span className="font-medium text-muted max-sm:hidden"> / 3г</span>
                    </button>
                  </div>
                </div>

                <Popover
                  position="bottom"
                  hideCloseIcon
                  className="flex h-full items-center"
                  trigger={(
                    <button
                      type="button"
                      className={`${detailsButtonClass} max-sm:px-0 text-muted`}
                      aria-label="Деталі завдання"
                      title="Пріоритет і тип"
                    >
                      <Settings2 size={14} />
                      <span className="max-sm:hidden">Деталі</span>
                    </button>
                  )}
                >
                  <div className="flex w-[248px] max-w-full flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Пріоритет</span>
                      <Select value={priority} onChange={setPriority} options={DEFAULT_PRIORITIES.map(item => ({ value: item.id, label: item.label, dotColor: item.color }))} buttonClassName="h-[36px] w-full rounded-[10px] bg-canvas px-3 text-[13px] font-medium" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Тип</span>
                      <Select value={type} onChange={setType} options={DEFAULT_TYPES.map(item => ({ value: item.id, label: item.label, dotColor: item.color }))} buttonClassName="h-[36px] w-full rounded-[10px] bg-canvas px-3 text-[13px] font-medium" />
                    </div>
                  </div>
                </Popover>
              </>
            }
          />
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="Task Attributes Panel — Calendar Event"
        description="Другий фактичний організм на тому самому TaskAttributesPanel: 7 колонок, event type/project/date, час, учасники, трекінг і details."
        filePath="src/components/workspace/calendar/CalendarEventPage.jsx"
        fullWidth
      >
        <div className="relative -mx-2 mt-[12px] px-2">
          <TaskAttributesPanel
            singleRow
            context="calendar"
            compact
            primaryChildren={(
              <>
                <div className={attributeItemClass}>
                  <span className={attributeLabelClass}>Тип</span>
                  <Select
                    compact
                    value={eventType}
                    onChange={setEventType}
                    options={CALENDAR_EVENT_TYPE_OPTIONS}
                    buttonClassName={compactSelectClass}
                  />
                </div>
                <div className={attributeItemClass}>
                  <span className={attributeLabelClass}>Проєкт</span>
                  <Select
                    compact
                    value={eventProject}
                    onChange={setEventProject}
                    options={[{ value: 'quickteam', label: 'QuickTeam' }, { value: '', label: 'Без проєкту' }]}
                    buttonClassName={compactSelectClass}
                  />
                </div>
                <div className={attributeItemClass}>
                  <span className={attributeLabelClass}>Дата</span>
                  <DatePicker
                    compact
                    hideIcon
                    value={dueDate}
                    onChange={setDueDate}
                    inputClassName={compactInputClass}
                  />
                </div>
                <button type="button" className={`${attributeItemClass} h-full w-full text-left`}>
                  <span className={attributeLabelClass}>Час події</span>
                  <span className="flex h-[22px] items-center truncate text-[13px] font-medium text-ink">10:00–11:00</span>
                </button>
                <button type="button" className={`${attributeItemClass} h-full w-full text-left`}>
                  <span className={attributeLabelClass}>Учасники</span>
                  <span className="flex h-[22px] items-center truncate text-[13px] font-medium text-ink"><Users size={13} className="mr-1.5 shrink-0 text-muted" />3 учасники</span>
                </button>
                <div className={attributeItemClass}>
                  <span className={attributeLabelClass}>Трекінг часу</span>
                  <div className="flex h-[22px] min-w-0 items-center gap-1">
                    <button type="button" className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[6px] leading-none transition-colors bg-line text-ink hover:bg-[#d9d9d9]">
                      <Play size={10} strokeWidth={0} className="block translate-x-[1px] fill-current" />
                    </button>
                    <button type="button" className="min-w-0 truncate text-[11px] font-bold text-ink">45 хв</button>
                  </div>
                </div>
                <button type="button" className={`${detailsButtonClass} text-muted`}>
                  <Settings2 size={14} />
                  <span>Деталі</span>
                </button>
              </>
            )}
          />
        </div>
      </PreviewBlock>

    </div>
  );
}

function FormGroupsSection() {
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Form Group Layouts" component="FormGroup" description="Контейнери для полів форми. Зв'язують заголовок Label (атом) та поле вводу (Input). Обов'язкове поле позначається текстом «обов'язково» праворуч у заголовку (не червоною зірочкою), помилка — червоною рамкою поля й текстом під ним." fullWidth>
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

      <PreviewBlock
        title="Label з іконкою"
        description="Іконка задається пропом icon, а не вкладається в children. Preflight робить svg display:block, тож іконка всередині текстового span займає власний рядок і стає над написом — саме тому вона тут іменований проп із фіксованим розміром 13. Працює і на Label, і на FormGroup."
        filePath="src/components/ui/Forms/Label.jsx"
        fullWidth
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[24px] max-w-[900px]">
          <FormGroup label="Учасники" icon={Users}>
            <Input placeholder="Додати учасників" />
          </FormGroup>

          <FormGroup label="Нагадування" icon={Bell} required>
            <Input placeholder="За 15 хвилин" />
          </FormGroup>

          <div className="flex flex-col gap-[6px]">
            <Label icon={MapPin}>Місце</Label>
            <Input placeholder="Офіс або кімната" />
          </div>
        </div>
      </PreviewBlock>
    </div>
  );
}

// The three screens that "look different" — and the one shell they share.
//
// Settings, Team and Chat each render a canvas rail beside a white pane. Only
// Settings used to say so; Chat and Team hand-wrote the same shell, which is
// exactly how they drifted apart. They are still three different layouts —
// that part was never the problem — they are just three *named* ones now, so
// changing the shell changes all three and nothing else.
function NavMenuSection() {
  const [active, setActive] = useState('profile');
  const [teamPane, setTeamPane] = useState('sidebar');
  const NAV = [
    { id: 'profile',       label: 'Особистий профіль', icon: User,     group: 'Особисте' },
    { id: 'notifications', label: 'Сповіщення',        icon: Bell,     group: 'Особисте' },
    { id: 'workspace',     label: 'Загальні',          icon: Building, group: 'Організація' },
    { id: 'team',          label: 'Учасники команди',  icon: Users,    group: 'Організація' },
  ];
  const demoUser = { id: 'kit-arthur', name: 'Артур Моспан' };

  // The rail rows below are the product's own markup, not an approximation.
  // The first version of these previews invented its own list ("# загальний",
  // a plain member list) and the result did not look like the site at all —
  // which is exactly the failure a catalogue is supposed to prevent. These use
  // the same `ui-native-control[data-ui-control='chat-list-action']` rule and
  // the same active/unread states that /chat and /team render.
  const chatRow = ({ id, name, kind, active = false, unread = 0, online = false }) => (
    <button
      key={id}
      type="button"
      data-ui-control="chat-list-action"
      className={`ui-native-control ${
        active ? 'bg-[#ebebeb] text-ink font-semibold' : 'text-muted hover:bg-[#ebebeb]/50 hover:text-ink'
      }`}
    >
      {kind === 'channel' ? (
        <Hash size={14} className={active ? 'text-ink' : 'text-muted'} />
      ) : (
        <div className="relative shrink-0">
          <div className="h-[18px] w-[18px] overflow-hidden rounded-full">
            <UserAvatar user={{ id, name }} size="chat-mention" />
          </div>
          {online && <span className="absolute -bottom-[1px] -right-[1px] h-2 w-2 rounded-full border border-canvas bg-[#10b981]" />}
        </div>
      )}
      <span className={`flex-1 truncate text-[13px] ${unread && !active ? 'font-bold text-ink' : ''}`}>{name}</span>
      {unread > 0 && !active && <Counter value={unread} size="sm" status="muted" className="shrink-0" />}
    </button>
  );

  const teamRow = ({ id, name, position, active = false }) => (
    <button
      key={id}
      type="button"
      className={`flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left transition-colors ${
        active ? 'bg-white shadow-sm' : 'hover:bg-white/60'
      }`}
    >
      <UserAvatar user={{ id, name }} size="sm" />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[13px] font-semibold text-ink">{name}</span>
        <span className="truncate text-[11px] font-normal text-muted">{position}</span>
      </div>
    </button>
  );

  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock
        title="SidebarLayout context=&quot;settings&quot;"
        component="SidebarLayout"
        description="Повна висота вікна, нічого не зафіксовано зверху. InnerNavigation у рейці, біла панель контенту малюється самим лейаутом (hasBorder={false})."
        filePath="src/app/(app)/settings/page.js"
        fullWidth
      >
        <div className="h-[420px] w-full overflow-hidden rounded-[24px] border border-line bg-white">
          <SidebarLayout
            context="settings"
            sidebar={<InnerNavigation items={NAV} activeId={active} onChange={setActive} />}
            hasBorder={false}
          >
            <main className="flex-1 overflow-y-auto custom-scrollbar bg-canvas relative">
              <div className="max-w-[760px] mx-auto px-[16px] py-[24px] md:px-[32px] md:py-[48px] min-h-full flex flex-col">
                <div className="flex-1 pb-[100px]">
                  <h2 className="text-[22px] font-bold text-ink">Особистий профіль</h2>
                  <p className="mt-1 text-[13px] text-muted">Керуйте особистими даними та налаштуваннями профілю.</p>
                  <Surface preset="card" padding="lg" className="mt-6">
                    <div className="h-[180px]" />
                  </Surface>
                </div>
              </div>
            </main>
          </SidebarLayout>
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="SidebarLayout context=&quot;team&quot;"
        description="Під фіксованим 56px хедером, тому каркас сам резервує цю висоту. Права панель — Surface preset=&quot;panel&quot;, а не проста біла зона, тому сторінка малює її сама (wrapsContent: false)."
        filePath="src/app/(app)/team/page.js"
        fullWidth
      >
        <div className="h-[420px] w-full overflow-hidden rounded-[24px] border border-line bg-white">
          <SidebarLayout
            context="team"
            mobilePane={teamPane}
            className="!pt-[12px]"
            sidebar={(
              <>
                <div className="flex shrink-0 items-center justify-between p-4">
                  <div className="flex items-center gap-2">
                    <h2 className="ui-type-dialog-title text-ink">Команда</h2>
                    <Pill appearance="outline" size="md">4</Pill>
                  </div>
                  <Button style="ghost" size="icon-sm" icon={Plus} aria-label="Запросити" />
                </div>
                <div className="flex flex-1 flex-col gap-[2px] overflow-y-auto custom-scrollbar px-2 pb-2">
                  {[
                    { id: 'arthur', name: 'Артур Моспан', position: 'Власник організації', active: true },
                    { id: 'olena', name: 'Олена Коваль', position: 'Frontend Developer' },
                    { id: 'petro', name: 'Петро Іванчук', position: 'Designer' },
                    { id: 'anna', name: 'Анна Мельник', position: 'QA Engineer' },
                  ].map(teamRow)}
                </div>
              </>
            )}
          >
            <Surface preset="panel" padding="sm" className="flex flex-1 flex-col overflow-hidden">
              <div className="flex flex-col items-center gap-2 py-8">
                <UserAvatar user={demoUser} size="hero" />
                <h3 className="text-[18px] font-bold text-ink">Артур Моспан</h3>
                <StatusPill label="Онлайн" tone="success" />
              </div>
              <button type="button" onClick={() => setTeamPane(teamPane === 'sidebar' ? 'content' : 'sidebar')}
                className="mx-auto rounded-[8px] bg-canvas px-3 py-1.5 text-[11px] font-bold text-muted">
                mobilePane: {teamPane} (клац, щоб перемкнути)
              </button>
            </Surface>
          </SidebarLayout>
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="SidebarLayout context=&quot;chat&quot;"
        description="Той самий каркас, але чат подає дві панелі поруч — розмову й гілку — тому лейаут не загортає контент у власну білу зону. Це єдина справжня відмінність чату; жолоб, ширина рейки та відступ під хедером тепер спільні."
        filePath="src/app/(app)/chat/page.js"
        fullWidth
      >
        <div className="h-[420px] w-full overflow-hidden rounded-[24px] border border-line bg-canvas">
          <SidebarLayout
            context="chat"
            className="!pt-[12px]"
            sidebar={(
              <aside className="flex-1 overflow-y-auto custom-scrollbar px-[16px] py-[32px]">
                <div className="mb-[24px]">
                  <div className="flex items-center justify-between px-3 pb-[8px]">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Канали</span>
                    <Button style="ghost" size="icon-xs" icon={Plus} className="hover:!bg-white" aria-label="Новий канал" />
                  </div>
                  <div className="flex flex-col gap-[2px]">
                    {[
                      { id: 'general', name: 'general', kind: 'channel', active: true },
                      { id: 'design', name: 'design', kind: 'channel', unread: 3 },
                      { id: 'releases', name: 'releases', kind: 'channel' },
                    ].map(chatRow)}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between px-3 pb-[8px]">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Особисті</span>
                  </div>
                  <div className="flex flex-col gap-[2px]">
                    {[
                      { id: 'olena', name: 'Олена Коваль', kind: 'dm', online: true, unread: 1 },
                      { id: 'petro', name: 'Петро Іванчук', kind: 'dm' },
                    ].map(chatRow)}
                  </div>
                </div>
              </aside>
            )}
          >
            <div className="flex flex-1 gap-3 min-w-0 overflow-hidden">
              {/* Conversation pane — the product's own chrome: canvas surface,
                  64px translucent header, composer docked at the bottom. */}
              <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[16px] bg-canvas">
                <div className="relative z-10 flex min-h-[64px] shrink-0 items-center gap-2 border-b border-line/70 bg-canvas/90 px-4 py-3 backdrop-blur-xl">
                  <Hash size={17} className="shrink-0 text-ink" />
                  <div className="min-w-0 flex-1">
                    <h2 className="ui-type-compact-title truncate text-ink">general</h2>
                    <p className="truncate text-[11px] text-muted">Загальний канал для всієї команди</p>
                  </div>
                  <IconAction label="Інформація про канал" icon={Info} size="md" appearance="quiet" composition="chat-panel-action" />
                </div>
                <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-12 pt-2" />
                <ChatComposerDock>
                  <div className="relative px-4 pb-4">
                    <ChatComposerCore variant="workspace" value="" onChange={() => {}} onSubmit={() => {}} placeholder="Написати в #general..." canSubmit={false} />
                  </div>
                </ChatComposerDock>
              </div>
              {/* Thread rail — the second pane, and the only reason chat opts
                  out of the shell drawing a single content pane. */}
              <div data-ui-overlay="responsive-pane" className="hidden shrink-0 flex-col overflow-hidden rounded-[16px] bg-canvas md:flex md:w-[280px]">
                <div className="relative z-10 flex h-[56px] shrink-0 items-center justify-between border-b border-line/70 bg-canvas/90 px-5 backdrop-blur-xl">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={16} className="text-muted" />
                    <h3 className="ui-type-card-title text-ink">Гілка</h3>
                  </div>
                  <IconAction label="Закрити гілку" icon={X} size="md" appearance="quiet" composition="chat-panel-action" />
                </div>
              </div>
            </div>
          </SidebarLayout>
        </div>
      </PreviewBlock>
    </div>
  );
}

function FiltersSection() {
  const [selectedMember, setSelectedMember] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortOption, setSortOption] = useState('updated');
  const memberOptions = [
    { value: 'all', label: 'Всі учасники', icon: Users },
    { value: 'u1', label: 'Артур Моспан', user: { id: 'u1', name: 'Артур Моспан' } },
    { value: 'u2', label: 'Олена Коваль', user: { id: 'u2', name: 'Олена Коваль' } },
  ];
  const dateOptions = [
    { value: 'all', label: 'За весь час' },
    { value: '7days', label: 'Створено за 7 днів' },
    { value: '30days', label: 'Створено за 30 днів' },
  ];
  const sortOptions = [
    { value: 'updated', label: 'Нещодавно оновлені' },
    { value: 'name', label: 'За назвою (А-Я)' },
    { value: 'progress-desc', label: 'Прогрес (за спаданням)' },
    { value: 'progress-asc', label: 'Прогрес (за зростанням)' },
  ];
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock
        title="Filter Bar — Projects Page"
        description="Точний filter slot головної сторінки проєктів, а не довільна toolbar-композиція."
        filePath="src/app/(app)/page.js"
        fullWidth
      >
        <PageHeader
          title="Проєкти"
          actions={<Button style="primary" color="dark" size="lg" icon={Plus}>Новий проєкт</Button>}
          filters={(
            <FilterBar>
              <Select filterRole="member" options={memberOptions} value={selectedMember} onChange={setSelectedMember} variant="ghost" />
              <Select filterRole="date" options={dateOptions} value={dateFilter} onChange={setDateFilter} variant="ghost" />
              <Select filterRole="sort" options={sortOptions} value={sortOption} onChange={setSortOption} variant="ghost" />
            </FilterBar>
          )}
        />
      </PreviewBlock>
    </div>
  );
}

function TypographySection() {
  const types = [
    { tag: 'display', label: 'Display Title', size: '32px', weight: '700', cls: 'ui-type-display-title text-ink', note: 'Organization switcher hero' },
    { tag: 'metric', label: 'Metric Title', size: '28px', weight: '900', cls: 'ui-type-metric-title text-ink', note: 'Billing and large project card' },
    { tag: 'page', label: 'Page Title', size: '24px', weight: '700', cls: 'ui-type-page-title text-ink', note: 'Workspace primary title' },
    { tag: 'detail', label: 'Detail Title', size: '20px', weight: '700', cls: 'ui-type-detail-title text-ink', note: 'Detail and settings title' },
    { tag: 'section', label: 'Section Title', size: '18px', weight: '700', cls: 'ui-type-section-title text-ink', note: 'Section and sheet title' },
    { tag: 'feature', label: 'Feature Title', size: '17px', weight: '700', cls: 'ui-type-feature-title text-ink', note: 'Feature card title' },
    { tag: 'dialog', label: 'Dialog Title', size: '16px', weight: '700', cls: 'ui-type-dialog-title text-ink', note: 'Dialog chrome' },
    { tag: 'compact', label: 'Compact Title', size: '15px', weight: '700', cls: 'ui-type-compact-title text-ink', note: 'Dense panel title' },
    { tag: 'card', label: 'Card Title', size: '14px', weight: '700', cls: 'ui-type-card-title text-ink', note: 'Cards and detail sections' },
    { tag: 'item', label: 'Item Title', size: '12px', weight: '700', cls: 'ui-type-item-title text-ink', note: 'Rows and small groups' },
    { tag: 'micro', label: 'Micro Title', size: '11px', weight: '700', cls: 'ui-type-micro-title text-ink', note: 'Dense data panels' },
    { tag: 'eyebrow', label: 'Eyebrow', size: '11px', weight: '700', cls: 'ui-type-eyebrow', note: 'Uppercase section marker' },
  ];
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Named typography contexts" description="Ці semantic classes є живим джерелом typography для authenticated workspace і /ui-kit." fullWidth>
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
    { label: 'Dark (Primary)', value: designColors.dark },
    { label: 'Pill Dark (hover)', value: designColors.hover.dark },
    { label: 'Canvas / Element', value: designColors.light },
    { label: 'Surface', value: designColors.surface },
    { label: 'Border', value: designColors.border.primary },
    { label: 'Border Secondary', value: designColors.border.secondary },
    { label: 'Border Light', value: designColors.border.light },
    { label: 'Text Muted', value: designColors.text.muted },
    { label: 'Text Inactive', value: designColors.text.inactive },
    { label: 'Success', value: designColors.status.success },
    { label: 'Warning', value: designColors.status.warning },
    { label: 'Danger', value: designColors.status.danger },
    { label: 'Info / Indigo', value: designColors.status.info },
    { label: 'Cyan', value: designColors.status.cyan },
    { label: 'Orange', value: designColors.status.error },
    { label: 'Purple', value: designColors.status.purple },
  ];
  const sizes = [
    { label: 'Button lg (CTA, default)', value: sizing.button.lg },
    { label: 'Button md (action)', value: sizing.button.md },
    { label: 'Button sm (compact)', value: sizing.button.sm },
    { label: 'Input sm', value: sizing.input.sm },
    { label: 'Input md', value: sizing.input.md },
    { label: 'Input lg / Select / Tabs', value: sizing.input.lg },
    { label: 'L0: Global / Modal radius', value: `${sizing.radius.max} (rounded-[24px])` },
    { label: 'L1: Panel / Card radius', value: `${sizing.radius.full} (rounded-[16px])` },
    { label: 'L2: Inset Surface radius', value: `${sizing.radius.xl} (rounded-[12px])` },
    { label: 'L2.5: Button / Input radius', value: `${sizing.radius.lg} (rounded-[10px])` },
    { label: 'L3: Small accent radius', value: `${sizing.radius.md} (rounded-[8px])` },
    { label: 'L4: Badge / Tag radius', value: '6px (rounded-[6px])' },
    { label: 'Page horizontal padding', value: spacing.pagePadding },
    { label: 'Page title → content gap', value: spacing.sectionGap },
    { label: 'Max content width', value: '1400px' },
    { label: 'Sidebar width', value: '220px' },
  ];
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="Color Palette" description="Живі значення з /src/lib/design/tokens.js; зміна джерела автоматично оновлює цю таблицю." fullWidth>
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
// VARIANT MATRIX
// ─────────────────────────────────────────────────────────────────────────────

// Every value the implementation declares — rendered, not listed.
//
// The list version of this screen still let a variant hide: 53 values shipped
// on the site while no preview anywhere showed them, so "the kit is the source"
// was true for the component and false for half its variants. Rendering each
// declared value from the manifest closes that structurally — a variant cannot
// exist without a preview, because the preview is generated from the same
// declaration the variant is. Adding a lookup-map entry or a `data-ui-*` rule
// makes it appear here on the next `npm run kit:drift`; nothing is hand-written.
//
// One base example per component, with the variant prop spread over it. Where a
// component cannot stand alone — Dialog needs an open state, PageHeader a whole
// page — the value is shown with the reason and a pointer to its real preview,
// rather than a fabricated example that would be a second source of truth.
const VARIANT_BASE = {
  Button: (props) => <Button style="secondary" size="md" icon={Plus} {...props}>Кнопка</Button>,
  IconAction: (props) => <IconAction label="Дія" icon={Settings2} size="md" {...props} />,
  Input: (props) => <Input placeholder="Текст" {...props} />,
  Textarea: (props) => <Textarea placeholder="Текст" rows={2} {...props} />,
  Select: (props) => (
    <Select value="a" onChange={() => {}} options={[{ value: 'a', label: 'Обрано' }]} {...props} />
  ),
  MultiSelect: (props) => (
    <MultiSelect value={['a']} onChange={() => {}} options={[{ value: 'a', label: 'Обрано' }]} {...props} />
  ),
  Surface: (props) => <Surface padding="md" {...props}><span className="text-[11px] text-muted">Поверхня</span></Surface>,
  Pill: (props) => <Pill {...props}>Мітка</Pill>,
  UserAvatar: (props) => <UserAvatar user={{ id: 'kit', name: 'Артур Моспан' }} {...props} />,
  Counter: (props) => <Counter value={3} {...props} />,
  Alert: (props) => <Alert {...props}>Повідомлення</Alert>,
  LoadingSpinner: (props) => <LoadingSpinner {...props} />,
  ToggleSwitch: (props) => <ToggleSwitch checked onChange={() => {}} {...props} />,
  Segmented: (props) => (
    <Segmented value="a" onChange={() => {}} options={[{ value: 'a', label: 'Один' }, { value: 'b', label: 'Два' }]} {...props} />
  ),
  Card: (props) => <Card {...props}><span className="text-[11px] text-muted">Картка</span></Card>,
  FormGroup: (props) => <FormGroup label="Поле" {...props}><Input placeholder="Текст" /></FormGroup>,
  Label: (props) => <Label {...props}>Підпис</Label>,
  Tag: (props) => <Tag {...props}>Тег</Tag>,
  EmptyState: (props) => <EmptyState icon={Folder} title="Порожньо" description="Немає записів." {...props} />,
  Popover: (props) => (
    <Popover trigger={<span className="text-[11px] font-semibold text-ink underline">Відкрити</span>} {...props}>
      <span className="text-[11px] text-muted">Вміст</span>
    </Popover>
  ),
  ChatComposerCore: (props) => (
    <div className="w-full max-w-[420px]">
      <ChatComposerCore value="" onChange={() => {}} onSubmit={() => {}} placeholder="Повідомлення" {...props} />
    </div>
  ),
};

// Why a component has no standalone example, and where to look instead.
const VARIANT_ELSEWHERE = {
  Dialog: 'Потребує відкритого стану — див. «Dialogs & Modals»',
  FilterBar: 'Живе всередині PageHeader — див. «Filter Bar»',
  TaskAttributesPanel: 'Потребує задачі — див. «Task Attributes Panel»',
  ChatComposerDock: 'Прикріплений до низу екрана — див. «Chat Composer Dock»',
  SidebarLayout: 'Каркас цілого екрана — див. «SidebarLayout — 3 контексти»',
};

// A dark value needs a dark backdrop to be visible at all.
const NEEDS_DARK = /inverse|overlay|auth-close/;

function VariantCell({ component, prop, value, count, previewed }) {
  const render = VARIANT_BASE[component];
  const tone = count === 0
    ? 'border-line bg-canvas'
    : previewed
      ? 'border-[#a7f3d0] bg-white'
      : 'border-[#fde68a] bg-white';

  return (
    <div className={`flex flex-col gap-[6px] rounded-[10px] border p-[10px] ${tone}`}>
      <div
        className={`relative isolate flex min-h-[52px] items-center justify-center overflow-hidden rounded-[8px] p-2 ${
          NEEDS_DARK.test(value) ? 'bg-ink' : 'bg-[#fafafa]'
        }`}
      >
        {render
          ? render({ [prop]: value })
          : <span className="px-2 text-center text-[10px] leading-relaxed text-faint">{VARIANT_ELSEWHERE[component]}</span>}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-[10px] font-bold text-ink">{value}</span>
        <span className={`ml-auto shrink-0 rounded-full px-[6px] text-[9px] font-bold ${
          count === 0 ? 'bg-canvas text-faint' : 'bg-[#ecfdf5] text-[#047857]'
        }`}>
          ×{count}
        </span>
      </div>
    </div>
  );
}

function VariantMatrixSection() {
  const { openUsage } = useContext(KitContext);
  const manifest = kitDrift.manifest;
  const usedCounts = kitDrift.usage;
  const previewed = new Set(kitDrift.previewedValues);

  return (
    <div className="flex flex-col gap-[24px]">
      <Surface preset="bordered-panel" padding="lg">
        <h2 className="text-[18px] font-bold text-ink">
          {kitDrift.totals.declaredValues} оголошених значень у {Object.keys(manifest).length} компонентах
        </h2>
        <p className="mt-2 max-w-[820px] text-[12px] leading-relaxed text-muted">
          Варіант оголошує реалізація, а не список: lookup-мапи компонентів і
          <span className="font-mono"> data-ui-*</span> правила в globals.css. Кожне значення тут
          відрендерене живим компонентом — тому варіант не може існувати без preview.
          Щоб додати варіант, додай запис у мапу або правило в CSS, і він з&apos;явиться сам.
        </p>
        <div className="mt-3 flex flex-wrap gap-[8px] text-[11px] font-semibold">
          <span className="rounded-[6px] bg-[#ecfdf5] px-[8px] py-[3px] text-[#047857]">
            вживається на сайті — {kitDrift.totals.declaredValues - kitDrift.totals.declaredUnused}
          </span>
          <span className="rounded-[6px] bg-canvas px-[8px] py-[3px] text-muted">
            оголошене, не вживається — {kitDrift.totals.declaredUnused}
          </span>
        </div>
      </Surface>

      {Object.entries(manifest).map(([component, props]) => (
        <section key={component} className="rounded-[14px] border border-line bg-white">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <button
              type="button"
              onClick={() => openUsage(component)}
              className="cursor-pointer font-mono text-[12px] font-bold text-ink hover:underline"
            >
              {component}
            </button>
            <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] font-bold text-muted">
              {kitUsage.components[component]?.count ?? 0} використань
            </span>
            {VARIANT_ELSEWHERE[component] && (
              <span className="text-[10px] text-faint">{VARIANT_ELSEWHERE[component]}</span>
            )}
          </div>
          <div className="flex flex-col gap-[14px] p-[14px]">
            {Object.entries(props).map(([prop, values]) => (
              <div key={prop}>
                <div className="mb-[6px] font-mono text-[11px] font-bold text-ink">{prop}</div>
                <div className="grid gap-[8px] [grid-template-columns:repeat(auto-fill,minmax(140px,1fr))]">
                  {values.map(value => (
                    <VariantCell
                      key={value}
                      component={component}
                      prop={prop}
                      value={value}
                      count={usedCounts[`${component}.${prop}.${value}`] || 0}
                      previewed={previewed.has(`${component}.${prop}.${value}`)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
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
  'chat-composer': <ChatComposerSection />,
  'chat-elements': <ChatElementsSection />,
  tooltips:        <TooltipsSection />,
  'form-groups':   <FormGroupsSection />,
  'task-attributes': <TaskAttributesSection />,
  'variant-matrix': <VariantMatrixSection />,
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function UIKitPage() {
  const [activeSection, setActiveSection] = useState('tokens');
  const [usageFor, setUsageFor] = useState(null);
  const current = SECTIONS.find(s => s.id === activeSection);

  return (
    <KitContext.Provider value={{ openUsage: setUsageFor }}>
    <div className="w-full h-full flex overflow-hidden bg-[#f5f5f5]">

      {/* ── Left Nav ──────────────────────────────────────────────────────── */}
      <div className="hidden md:flex w-[224px] shrink-0 h-full flex-col p-[12px] pr-[6px]">
        <div className="bg-[#1f1f1f] rounded-[20px] h-full flex flex-col overflow-hidden">
          <div className="px-[20px] pt-[20px] pb-[16px] border-b border-white/10 shrink-0">
            <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-[2px]">Internal · Not in nav</div>
            <div className="text-[17px] font-bold text-white">UI Kit</div>
            <div className="text-[10px] text-white/30 mt-[1px]">{SECTIONS.length} sections · product UI only</div>
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
                      // min-h rather than a fixed height: a two-line label
                      // (there are several now) overflowed its row and printed
                      // on top of the next item.
                      className={`w-full flex items-center gap-[9px] px-[12px] min-h-[30px] py-[6px] rounded-[8px] text-[12px] font-semibold transition-all text-left ${active ? 'bg-white text-[#1f1f1f] shadow-sm' : 'text-white/50 hover:text-white hover:bg-white/8'}`}
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
      <UsagePanel component={usageFor} onClose={() => setUsageFor(null)} />
    </div>
    </KitContext.Provider>
  );
}
