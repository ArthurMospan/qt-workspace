'use client';
// src/app/workspace/settings/page.js — Redesigned Settings (clean, no emoji, QT-style)
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAppContext }  from '@/lib/context/AppContext';
import useWorkspaceStore  from '@/store/useWorkspaceStore';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { useMobilePaneBack } from '@/lib/hooks/useMobilePaneBack';
import { restoreProject } from '@/lib/services/projects';
import { transferOrganizationOwnership } from '@/lib/services/organizations';
import { fetchWorkflowViaApi, updateWorkflowViaApi } from '@/lib/services/workflow';
import { authenticatedRequest } from '@/lib/services/authenticatedRequest';
import { userFacingErrorMessage } from '@/lib/utils/errors';
import { auth, createGitHubProvider, db, googleProvider } from '@/lib/firebase';
import { linkWithPopup, unlink } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import {
  User, Bell, Shield, Zap, Users, GitBranch,
  Shapes, Check, Plus, Trash2, Edit2, X, Save,
  Building, LogOut, Download, RefreshCw, Mail,
  Copy, ExternalLink, ChevronRight, ArrowLeft, AlertTriangle,
  Link2, PlugZap, ToggleLeft, ToggleRight, Receipt, CreditCard,
  Globe, Tag as TagIcon, Briefcase, GripVertical, Send,
  Archive, ArchiveRestore, Bug, SlidersHorizontal, DatabaseBackup, Lock
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { 
  Button, 
  Input, 
  Textarea, 
  Select, 
  ToggleSwitch, 
  Alert, 
  Card,
  ColorSwatch,
  LoadingSpinner,
  SidebarLayout,
  MobilePaneBack,
  InnerNavigation,
  PageHeader,
  Dialog,
  DatePicker,
  IconAction,
  Label,
  Pill,
  PriorityBadge,
  PriorityIcon,
  Surface,
  useConfirm,
  Popover
} from '@/components/ui';
import UserAvatar from '@/components/ui/DataDisplay/UserAvatar';
import ImageUpload from '@/components/ui/ImageUpload';
import { sendNotification } from '@/lib/hooks/useNotifications';
import {
  CHANNEL_DEFAULTS,
  EVENT_DEFAULTS,
  NOTIFICATION_EVENTS,
  resolveNotificationMatrix,
} from '@/lib/utils/notificationChannels.mjs';
import { computeSidebarTheme, SIDEBAR_PRESETS } from '@/lib/utils/sidebarTheme';
import { Colorful } from '@uiw/react-color';
import InviteMemberDialog from '@/components/InviteMemberDialog';
import TeamMemberSettingsDialog from '@/components/TeamMemberSettingsDialog';
import IntegrationCard, { IntegrationCode, IntegrationNote, IntegrationSteps } from '@/components/integrations/IntegrationCard';
import DataMigrationSettings from '@/components/migrations/DataMigrationSettings';
import {
  DEFAULT_STATUSES,
  DEFAULT_TYPES,
  DEFAULT_PRIORITIES,
  DEFAULT_LABELS,
  DEFAULT_POSITIONS,
  STATUS_CATEGORY_ICONS,
} from '@/lib/hooks/useWorkflowConfig';
import { hydrateWorkflowSettings } from '@/lib/utils/workflowSettingsHydration.mjs';
import { navigateToSameOrigin } from '@/lib/utils/browserNavigation.mjs';
import {
  createUkrainianDndAnnouncements,
  UKRAINIAN_DRAG_HANDLE_USAGE_INSTRUCTIONS,
} from '@/lib/utils/dndAnnouncements.mjs';
import {
  flattenStatusGroups,
  groupStatusesByCategory,
  isClosingCategory,
  STATUS_CATEGORIES,
  STATUS_CATEGORY_IDS,
} from '@/lib/utils/statusCategories.mjs';
import {
  taskTypeIcon,
  taskTypeIconKey,
} from '@/lib/design/taskTypeIcons';
import {
  NO_PRIORITY,
  isSystemPriorityId,
  priorityPresentation,
} from '@/lib/utils/priorities.mjs';
import { isSystemTaskTypeId } from '@/lib/utils/taskTypes.mjs';

// ── Constants ────────────────────────────────────────────────────────
const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || '';
const NOOP = () => {};
// Інлайниться на білді, тому зміна цієї змінної потребує redeploy, не просто
// рестарту.
const ROLE_LABELS = {
  owner: 'Власник',
  admin: 'Адміністратор',
  member: 'Учасник'
};
// Workflow defaults live in useWorkflowConfig (single source of truth for
// the board, this page and every other consumer) — never redeclare them here:
// a local copy is exactly the bug where Settings showed one set of statuses
// and the kanban another.
const COLOR_PALETTE = [
  '#dc2626','#f97316','#eab308','#22c55e','#10b981',
  '#0891b2','#6366f1','#8b5cf6','#db2777','#1f1f1f',
  '#9a9a9a','#059669','#7c3aed','#d97706','#0284c7',
];
const DEFAULT_WORKFLOW_SETTINGS = Object.freeze({
  statuses: DEFAULT_STATUSES,
  types: DEFAULT_TYPES,
  priorities: DEFAULT_PRIORITIES,
  labels: DEFAULT_LABELS,
  positions: DEFAULT_POSITIONS,
});

const NAV = [
  { id: 'profile',       label: 'Особистий профіль',icon: User,          group: 'Особисте' },
  { id: 'auth-methods',  label: 'Способи входу',     icon: Link2,        group: 'Особисте' },
  // No personal QuickTeam+ entry here on purpose. Connecting the account only
  // ever served linking a project, so that action lives in the project's
  // QuickTeam+ tab; the org-level switch stays under "Інтеграції".
  { id: 'notifications', label: 'Сповіщення',       icon: Bell,          group: 'Особисте' },
  { id: 'localization',  label: 'Локалізація',      icon: Globe,         group: 'Особисте' },
  { id: 'workspace',     label: 'Загальні',         icon: Building,      group: 'Організація', adminOnly: true },
  { id: 'team',          label: 'Учасники команди', icon: Users,         group: 'Організація' },
  { id: 'billing',       label: 'Тарифний план',    icon: CreditCard,    group: 'Організація', adminOnly: true },
  { id: 'integrations',  label: 'Інтеграції',       icon: PlugZap,       group: 'Організація', adminOnly: true },
  { id: 'migration',     label: 'Перенесення даних', icon: DatabaseBackup, group: 'Організація', adminOnly: true },
  { id: 'statuses',      label: 'Статуси завдань',    icon: GitBranch,     group: 'Налаштування процесів', adminOnly: true },
  { id: 'types',         label: 'Типи завдань',       icon: Shapes,        group: 'Налаштування процесів', adminOnly: true },
  { id: 'priorities',    label: 'Пріоритети',       icon: AlertTriangle, group: 'Налаштування процесів', adminOnly: true },
  { id: 'labels',        label: 'Мітки',            icon: TagIcon,       group: 'Налаштування процесів', adminOnly: true },
  { id: 'positions',     label: 'Посади та ставки', icon: Briefcase,     group: 'Налаштування процесів', adminOnly: true },
  { id: 'archives',      label: 'Архів проєктів',    icon: Archive,       group: 'Інше' },
  { id: 'danger',        label: 'Видалення даних',  icon: Shield,        group: 'Інше', danger: false, adminOnly: true },
];

// ── Primitives ───────────────────────────────────────────────────────
// Toggle removed - using ToggleSwitch from UI Kit

function Row({ label, desc, children, danger = false }) {
  return (
    <div className="flex flex-col items-stretch justify-between gap-3 py-[12px] sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1">
        <p className={`text-[13px] font-medium leading-snug ${danger ? 'text-red-600' : 'text-ink'}`}>{label}</p>
        {desc && <p className={`text-[12px] mt-[2px] leading-relaxed ${danger ? 'text-red-400' : 'text-muted'}`}>{desc}</p>}
      </div>
      <div className="w-full sm:w-auto sm:shrink-0">{children}</div>
    </div>
  );
}

function Section({ title, desc, rightAction, children }) {
  return (
    <div className="flex flex-col">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="ui-type-detail-title text-ink tracking-tight">{title}</h2>
          {desc && <p className="text-[13px] text-muted mt-[4px] leading-relaxed">{desc}</p>}
        </div>
        {rightAction && <div className="shrink-0 flex items-center gap-2">{rightAction}</div>}
      </div>
      <div className="flex flex-col gap-[24px]">
        {children}
      </div>
    </div>
  );
}

// Inline-editable field: save/cancel icons live INSIDE the field on the right,
// shown only while the value differs from what's saved (no reserved gap, no
// layout shift). Enter saves, Escape cancels.
function InlineEditField({ value, onChange, saved, onSave, placeholder = '', type = 'text', className = 'w-[240px]' }) {
  const dirty = (value ?? '') !== (saved ?? '');
  const [saving, setSaving] = useState(false);
  const commit = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try { await onSave(); } finally { setSaving(false); }
  };
  return (
    <div className={`relative max-sm:w-full ${className}`}>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          else if (e.key === 'Escape' && dirty) onChange(saved ?? '');
        }}
        composition={dirty ? 'inline-edit' : undefined}
      />
      {dirty && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 z-10">
          <IconAction onClick={commit} disabled={saving} label="Зберегти" icon={Check} size="xs" appearance="primary" />
          <IconAction onClick={() => onChange(saved ?? '')} label="Скасувати" icon={X} size="xs" appearance="soft" />
        </div>
      )}
    </div>
  );
}

function InlineDateField({ value, onChange, saved, onSave, placeholder = 'Оберіть дату' }) {
  const dirty = (value ?? '') !== (saved ?? '');
  const [saving, setSaving] = useState(false);
  const commit = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try { await onSave(); } finally { setSaving(false); }
  };
  return (
    <div className="flex w-full items-center gap-1.5 sm:w-[260px]">
      <DatePicker
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="min-w-0 flex-1"
        yearRange={{ min: new Date().getFullYear() - 100, max: new Date().getFullYear() }}
      />
      {dirty && (
        <>
          <IconAction
            onClick={commit}
            disabled={saving}
            label="Зберегти"
            icon={Check}
            size="compact"
            appearance="primary"
          />
          <IconAction
            onClick={() => onChange(saved ?? '')}
            label="Скасувати"
            icon={X}
            size="compact"
            appearance="soft"
          />
        </>
      )}
    </div>
  );
}

function GitHubLogo({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function GoogleLogo({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function OneBMark() {
  return <Image src="/oneb-logo.png" alt="OneB" width={18} height={18} className="object-contain rounded-[4px]" />;
}

// One switch per method, like every other settings row. Connect/disconnect was
// a pair of buttons next to a status pill that repeated what the switch
// position and the detail line already say.
function LoginMethodItem({
  icon,
  title,
  detail,
  connected,
  primary,
  loading,
  disabled,
  soon = false,
  staticMethod = false,
  onConnect,
  onDisconnect,
}) {
  // The primary method cannot be switched off — losing it would leave the
  // account with no way back in. Same rule the disconnect button carried.
  const locked = staticMethod || soon || primary || Boolean(loading) || Boolean(disabled);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-[14px]">
      <div className="flex items-center gap-3 min-w-0">
        <div data-ui-surface="local" className="w-[36px] h-[36px] rounded-[10px] bg-canvas flex items-center justify-center shrink-0 text-ink">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-ink leading-snug">{title}</p>
          <p className="text-[12px] text-muted mt-[2px] leading-snug truncate">{detail}</p>
        </div>
      </div>
      <ToggleSwitch
        checked={connected || primary}
        disabled={locked}
        onChange={next => (next ? onConnect?.() : onDisconnect?.())}
        ariaLabel={`${connected ? 'Відключити' : 'Підключити'} ${title}`}
      />
    </div>
  );
}

// Note: Card component replaced with UI Kit Card from @/components/ui/Layout/Card

// ── WorkflowItem ─────────────────────────────────────────────────────

function WorkflowItem({ item, onSave, onDelete, canDelete = true, locked = false, readOnly = false, variant = 'status', provided, priorityItems = [], typeSuggestions = [], onChooseTypeSuggestion = NOOP }) {
  const [editing,     setEditing]     = useState(item.isNew || false);
  const [label,       setLabel]       = useState(item.label);
  const [color,       setColor]       = useState(item.color);
  const [showPalette, setShowPalette] = useState(false);

  const save = () => {
    if (label.trim()) {
      const { isNew, ...rest } = item;
      onSave({
        ...rest,
        label: label.trim(),
        color,
        ...(variant === 'type' ? { icon: taskTypeIconKey(item) } : {}),
      });
      setEditing(false);
      setShowPalette(false);
    } else {
      if (item.isNew) onDelete(item.id);
      else {
        setEditing(false);
        setLabel(item.label);
        setColor(item.color);
      }
    }
  };

  const priorityConfig = variant === 'priority'
    ? priorityPresentation(item, priorityItems)
    : null;
  const normalizedTypeQuery = label.trim().toLocaleLowerCase('uk');
  const visibleTypeSuggestions = variant === 'type' && item.isNew
    ? typeSuggestions.filter(type => (
      !normalizedTypeQuery
      || type.label.toLocaleLowerCase('uk').includes(normalizedTypeQuery)
    ))
    : [];

  return (
    <div 
      ref={provided?.innerRef}
      {...provided?.draggableProps}
      data-ui-surface="local" className="flex items-center gap-3 py-[8px] px-[8px] -mx-[8px] rounded-[12px] hover:bg-canvas transition-colors group bg-white"
    >
      {provided?.dragHandleProps && (
        <div {...provided.dragHandleProps} className="shrink-0 text-faint hover:text-ink cursor-grab active:cursor-grabbing">
          <GripVertical size={14} />
        </div>
      )}
      {/* Color */}
      <div className="relative flex h-[18px] w-[18px] shrink-0 items-center justify-center">
        {readOnly && variant === 'priority' ? (
          <PriorityIcon priority={priorityConfig} priorities={priorityItems} />
        ) : (
          <ColorSwatch
            size="trigger"
            color={color}
            label="Обрати колір"
            aria-expanded={showPalette}
            onClick={() => setShowPalette(v => !v)}
          />
        )}
        {!readOnly && showPalette && (
          <div data-ui-surface="local" className="absolute left-0 top-[22px] z-20 bg-white border border-line rounded-[10px] p-[10px] shadow-lg grid grid-cols-5 gap-[6px] w-[148px]">
            {COLOR_PALETTE.map(c => (
              <ColorSwatch
                key={c}
                size="choice"
                color={c}
                selected={c === color}
                label={`Колір ${c}`}
                onClick={() => {
                  setColor(c);
                  setShowPalette(false);
                  if (!editing) {
                    const { isNew, ...rest } = item;
                    onSave({ ...rest, label: label.trim(), color: c });
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Label */}
      {editing ? (
        <div className="relative flex-1">
          <Input
            autoFocus
            size="sm"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder={variant === 'type' && item.isNew ? 'Назва типу' : undefined}
            onKeyDown={e => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') {
                if (item.isNew) onDelete(item.id);
                else {
                  setEditing(false);
                  setLabel(item.label);
                  setColor(item.color);
                }
              }
            }}
          />
          {visibleTypeSuggestions.length > 0 && (
            <div
              data-ui-surface="local"
              className="absolute left-0 right-0 top-[36px] z-30 rounded-[10px] border border-line bg-white p-1 shadow-lg"
            >
              <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-faint">
                Стандартні типи
              </p>
              {visibleTypeSuggestions.map(type => (
                <Button
                  key={type.id}
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => onChooseTypeSuggestion(type)}
                  style="ghost"
                  size="sm"
                  icon={taskTypeIcon(type)}
                  className="w-full justify-start"
                >
                  {type.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <span className="flex-1 text-[13px] font-semibold text-ink">{item.label}</span>
      )}

      {/* Badge preview */}
      {!editing && variant === 'type' && (
        <Pill
          label={label}
          icon={taskTypeIcon(item)}
          color={color}
          colorAlpha="14"
          size="lg"
          shape="badge"
          weight="medium"
          className="backdrop-blur-[2px]"
        />
      )}
      {!editing && variant === 'priority' && (
        <PriorityBadge priority={{ ...priorityConfig, label, color }} priorities={priorityItems} />
      )}
      {!editing && variant !== 'type' && variant !== 'priority' && (
        <Pill
          label={label}
          icon={variant === 'label' ? TagIcon : undefined}
          color={color}
          colorAlpha="14"
          size="lg"
          shape="badge"
          weight="medium"
          className="backdrop-blur-[2px]"
        />
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-1 shrink-0 w-[64px]">
        {editing ? (
          <>
            <Button onClick={save} aria-label="Зберегти" style="ghost" size="icon" icon={Check} />
            <Button
              onClick={() => {
                if (item.isNew) { onDelete(item.id); }
                else { setEditing(false); setLabel(item.label); setColor(item.color); }
              }}
              aria-label="Скасувати"
              style="ghost" size="icon" icon={X}
            />
          </>
        ) : (
          <>
            {readOnly ? (
              <div className="w-[32px]" />
            ) : (
              <Button onClick={() => setEditing(true)}
                aria-label="Редагувати"
                style="ghost" size="icon" icon={Edit2}
              />
            )}
            {locked ? (
              <Button
                disabled
                aria-label={variant === 'type' ? 'Системний тип' : 'Системний пріоритет'}
                title={variant === 'type' ? 'Системний тип не можна видалити' : 'Системний пріоритет не можна видалити'}
                style="ghost" size="icon" icon={Lock}
              />
            ) : canDelete ? (
              <Button onClick={() => onDelete(item.id)}
                aria-label="Видалити"
                style="ghost" color="red" size="icon" icon={Trash2}
              />
            ) : (
              <div className="w-[28px]" />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PositionItem({ item, onSave, onDelete }) {
  const [editing, setEditing] = useState(item.isNew || false);
  const [label, setLabel] = useState(item.label);
  const [hourlyRate, setHourlyRate] = useState(item.hourlyRate || 0);

  const save = () => {
    if (label.trim()) {
      const { isNew, ...rest } = item;
      onSave({ ...rest, label: label.trim(), hourlyRate: Number(hourlyRate) || 0 });
      setEditing(false);
    } else {
      if (item.isNew) onDelete(item.id);
      else { setEditing(false); setLabel(item.label); setHourlyRate(item.hourlyRate); }
    }
  };

  return (
    <div data-ui-surface="local" className="flex items-center gap-3 py-[8px] px-[8px] -mx-[8px] rounded-[12px] hover:bg-canvas transition-colors group">
      {editing ? (
        <div className="flex flex-1 items-center gap-3">
          <Input
            size="sm"
            autoFocus
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Назва посади"
            className="flex-1"
          />
          {/* The rate is a number, not an amount in dollars. Which currency it
              is worth is chosen per invoice, and printing "$" here promised a
              denomination this field never carried. */}
          <div className="w-[120px] flex items-center gap-1">
            <Input
              size="sm"
              type="number"
              value={hourlyRate}
              onChange={e => setHourlyRate(e.target.value)}
              placeholder="Ставка"
              className="w-[70px] text-right"
            />
            <span className="text-[11px] text-muted">/год</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-between">
          <span className="text-[13px] font-semibold text-ink">{item.label}</span>
          <span className="text-[12px] font-medium text-muted">{item.hourlyRate || 0}/год</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-1 shrink-0 w-[64px]">
        {editing ? (
          <>
            <Button onClick={save} aria-label="Зберегти" style="ghost" size="icon" icon={Check} />
            <Button
              onClick={() => {
                if (item.isNew) { onDelete(item.id); }
                else { setEditing(false); setLabel(item.label); setHourlyRate(item.hourlyRate); }
              }}
              aria-label="Скасувати"
              style="ghost" size="icon" icon={X}
            />
          </>
        ) : (
          <>
            <Button onClick={() => setEditing(true)}
              aria-label="Редагувати"
              style="ghost" size="icon" icon={Edit2}
            />
            <Button onClick={() => onDelete(item.id)}
              aria-label="Видалити"
              style="ghost" color="red" size="icon" icon={Trash2}
            />
          </>
        )}
      </div>
    </div>
  );
}

// Draft rows exist only in the editor. Persisting one before the person enters
// a label makes the server correctly reject the entire workflow as malformed.
const cleanWorkflowItems = arr => (arr || [])
  .filter(item => !item?.isNew)
  .map(({ isNew, ...rest }) => rest);

// ── MAIN PAGE ────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const { currentUser, signOut, activeOrgId, projects, orgRole } = useAppContext();
  const showToast = useWorkspaceStore(s => s.showToast);
  const confirmDialog = useConfirm();
  const {
    org,
    members,
    inviteMember,
    changeMemberRole,
    removeMember,
    setMemberPosition,
    getMemberRemovalImpact,
  } = useOrganization();

  // Role resolution
  const myMemberInfo = members.find(m => m.id === (currentUser?.uid || currentUser?.id));
  const myRole = orgRole || myMemberInfo?.role || 'member';
  const isAdmin = myRole === 'owner' || myRole === 'admin';
  const isOwner = myRole === 'owner';

  const [activeSection, setActiveSection] = useState('profile');
  const [integrationDetail, setIntegrationDetail] = useState('');

  // Mobile single-pane mode: 'sidebar' (список розділів) або 'content' (розділ)
  const [mobilePane, setMobilePane] = useState('sidebar');
  // Системний «назад» на телефоні повертає до списку розділів
  const requestPaneClose = useMobilePaneBack(mobilePane === 'content', () => setMobilePane('sidebar'));

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const sec = searchParams.get('section');
      const authSuccess = searchParams.get('auth');
      const authError = searchParams.get('authError');
      if (sec) {
        queueMicrotask(() => {
          setActiveSection(sec);
          setMobilePane('content'); // deep link opens the section directly on mobile
        });
      }
      if (authSuccess === 'oneb_connected') {
        queueMicrotask(() => showToast('OneB підключено'));
      }
      const qtplus = searchParams.get('qtplus');
      const qtplusError = searchParams.get('qtplusError');
      if (qtplus === 'connected') {
        queueMicrotask(() => showToast('QuickTeam+ підключено'));
      }
      if (qtplusError) {
        const message = qtplusError === 'state'
          ? 'Термін дії посилання минув або воно відкрите не в тому браузері. Спробуйте ще раз'
          : qtplusError === 'session'
            ? 'Не вдалося підтвердити сесію. Увійдіть ще раз і повторіть підключення'
            : qtplusError === 'not_configured'
              ? 'Інтеграцію QuickTeam+ не налаштовано на сервері'
              : 'Не вдалося підключити QuickTeam+';
        queueMicrotask(() => showToast(message, 'error'));
      }
      if (authError) {
        const message = authError === 'oneb_already_linked'
          ? 'Цей OneB акаунт уже підключений до іншого користувача'
          : authError === 'oneb_session'
            ? 'Не вдалося підтвердити сесію. Увійдіть ще раз і повторіть підключення OneB'
            : authError === 'oneb_state'
              ? 'Термін дії посилання минув або воно відкрите не в тому браузері. Спробуйте підключити OneB заново'
              : 'Не вдалося підключити OneB';
        queueMicrotask(() => showToast(message, 'error'));
      }
    }
  }, [showToast]);

  // ── Workflow ──
  const [statuses,   setStatuses]   = useState(DEFAULT_STATUSES);
  const [types,      setTypes]      = useState(DEFAULT_TYPES);
  const [priorities, setPriorities] = useState(DEFAULT_PRIORITIES);
  const [labels,     setLabels]     = useState(DEFAULT_LABELS);
  const [positions,  setPositions]  = useState(DEFAULT_POSITIONS);
  const [wfLoading,  setWfLoading]  = useState(true);
  const [showSavedCheck, setShowSavedCheck] = useState(false);
  const applyWorkflowPayload = useCallback(payload => {
    // React batches these setters into one commit. Keeping this as one
    // complete payload prevents a mixed A/B workflow during org switches.
    setStatuses(payload.statuses);
    setTypes(payload.types);
    setPriorities(payload.priorities);
    setLabels(payload.labels);
    setPositions(payload.positions);
  }, []);

  const triggerSavedSuccess = () => {
    setShowSavedCheck(true);
    setTimeout(() => setShowSavedCheck(false), 2500);
  };


  // ── Profile ──
  const [displayName,   setDisplayName]   = useState('');
  const [customAvatar,  setCustomAvatar]  = useState('');
  const [customAvatarStoragePath, setCustomAvatarStoragePath] = useState('');
  const [customAvatarResourceType, setCustomAvatarResourceType] = useState('image');
  const [bio,           setBio]           = useState('');
  const [telegram,      setTelegram]      = useState('');
  const [phone,         setPhone]         = useState('');
  const [location,      setLocation]      = useState('');
  const [birthday,      setBirthday]      = useState('');
  const [skillsInput,   setSkillsInput]   = useState('');

  // Saved values + whether any profile field is unsaved (for the leave guard).
  const savedSkills = Array.isArray(currentUser?.skills) ? currentUser.skills.join(', ') : '';
  const profileDirty =
    displayName !== (currentUser?.name || '') ||
    customAvatar !== (currentUser?.customAvatar || '') ||
    bio !== (currentUser?.bio || '') ||
    telegram !== (currentUser?.telegram || '') ||
    phone !== (currentUser?.phone || '') ||
    location !== (currentUser?.location || '') ||
    birthday !== (currentUser?.birthday || '') ||
    skillsInput !== savedSkills;

  // Discard unsaved profile edits (used when the user chooses to leave without
  // saving — otherwise the derived profileDirty stays true and the guard would
  // re-prompt on every navigation).
  const revertProfile = useCallback(() => {
    setDisplayName(currentUser?.name || '');
    setCustomAvatar(currentUser?.customAvatar || '');
    setCustomAvatarStoragePath(currentUser?.customAvatarStoragePath || '');
    setCustomAvatarResourceType(currentUser?.customAvatarResourceType || 'image');
    setBio(currentUser?.bio || '');
    setTelegram(currentUser?.telegram || '');
    setPhone(currentUser?.phone || '');
    setLocation(currentUser?.location || '');
    setBirthday(currentUser?.birthday || '');
    setSkillsInput(Array.isArray(currentUser?.skills) ? currentUser.skills.join(', ') : '');
  }, [currentUser]);

  // ── Workspace ──
  const [orgName,         setOrgName]         = useState('');
  const [orgLogo,         setOrgLogo]         = useState('');
  const [orgLogoStoragePath, setOrgLogoStoragePath] = useState('');
  const [orgLogoResourceType, setOrgLogoResourceType] = useState('image');
  const [orgCustomBranding, setOrgCustomBranding] = useState(false);
  const [sidebarTheme,    setSidebarTheme]    = useState('dark');     // 'dark' | 'light' | 'custom'
  const [sidebarColor,    setSidebarColor]    = useState('#1f1f1f');  // HEX for custom theme
  const setSidebarPreview = useWorkspaceStore(s => s.setSidebarPreview);
  const clearSidebarPreview = useWorkspaceStore(s => s.clearSidebarPreview);

  // Live preview: push changes to sidebar in real-time
  useEffect(() => {
    if (orgCustomBranding) {
      setSidebarPreview({
        theme: sidebarTheme,
        color: sidebarColor,
        customBranding: true,
        logo: orgLogo
      });
    } else {
      clearSidebarPreview();
    }
  }, [orgCustomBranding, sidebarTheme, sidebarColor, orgLogo, setSidebarPreview, clearSidebarPreview]);

  // Leaving Settings drops the live preview so the sidebar falls back to the
  // saved org document (which branding auto-save has already persisted).
  useEffect(() => () => clearSidebarPreview(), [clearSidebarPreview]);

  // ── Integration (QT portal) ──
  const [qtEnabled,      setQtEnabled]      = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [qtSaving,       setQtSaving]       = useState(false);

  // ── API Keys ──
  const [apiKeys, setApiKeys] = useState([]);
  const [buggyBagLoading, setBuggyBagLoading] = useState(false);
  const [telegramBotStatus, setTelegramBotStatus] = useState({ configured: false, connected: false, chatTitle: '' });
  const [telegramBotLoading, setTelegramBotLoading] = useState(false);
  // True between opening the bot deep link and the webhook confirming it.
  const [telegramAwaitingLink, setTelegramAwaitingLink] = useState(false);
  const [telegramGroupStatus, setTelegramGroupStatus] = useState({ configured: false, connected: false, chatTitle: '', defaultProjectId: '' });
  const [telegramGroupLoading, setTelegramGroupLoading] = useState(false);
  const [telegramGroupProjectId, setTelegramGroupProjectId] = useState('');
  const [telegramGroupConnect, setTelegramGroupConnect] = useState(null);
  const [telegramGroupSetupOpen, setTelegramGroupSetupOpen] = useState(false);

  const apiKeysRequest = async (method = 'GET', body = null) => {
    if (!activeOrgId) throw new Error('Не вказано організацію');
    return authenticatedRequest(`/api/integrations/api-keys?organizationId=${encodeURIComponent(activeOrgId)}`, {
      method,
      ...(body ? { body: JSON.stringify(body) } : {}),
    }, 'Не вдалося оновити інтеграцію BuggyBag');
  };

  const telegramRequest = useCallback(async (path, method = 'GET', body = null) => {
    return authenticatedRequest(path, {
      method,
      ...(body ? { body: JSON.stringify(body) } : {}),
    }, 'Не вдалося виконати запит до Telegram');
  }, []);

  const refreshTelegram = useCallback(async () => {
    if (!currentUser) return;
    const status = await telegramRequest('/api/integrations/telegram');
    setTelegramBotStatus(status);
  }, [currentUser, telegramRequest]);

  const refreshTelegramGroup = useCallback(async () => {
    if (!activeOrgId || !isAdmin) return;
    const status = await telegramRequest(`/api/integrations/telegram/group?organizationId=${encodeURIComponent(activeOrgId)}`);
    setTelegramGroupStatus(status);
    if (status.defaultProjectId) setTelegramGroupProjectId(status.defaultProjectId);
    if (status.connected) {
      setTelegramGroupSetupOpen(false);
      setTelegramGroupConnect(null);
    }
    return status;
  }, [activeOrgId, isAdmin, telegramRequest]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => refreshTelegram().catch(() => {}), 0);
    return () => window.clearTimeout(timeoutId);
  }, [refreshTelegram]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => refreshTelegramGroup().catch(() => {}), 0);
    return () => window.clearTimeout(timeoutId);
  }, [refreshTelegramGroup]);

  const connectTelegram = async () => {
    if (!activeOrgId) return;
    setTelegramBotLoading(true);
    try {
      const result = await telegramRequest('/api/integrations/telegram', 'POST', { organizationId: activeOrgId });
      window.open(result.link, '_blank', 'noopener,noreferrer');
      setTelegramAwaitingLink(true);
      showToast('Натисніть «Старт» у Telegram — далі підключиться саме');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setTelegramBotLoading(false);
    }
  };

  const disconnectTelegram = async () => {
    setTelegramBotLoading(true);
    try {
      await telegramRequest('/api/integrations/telegram', 'DELETE');
      setTelegramBotStatus(previous => ({ ...previous, connected: false, chatTitle: '' }));
      setNotif(previous => ({ ...previous, telegramEnabled: false }));
      showToast('Telegram відключено');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setTelegramBotLoading(false);
    }
  };

  // One control for the whole channel, like every other row in Канали: the
  // switch *is* the connection. Turning it on links the bot — or, for an
  // account that is already linked, just re-enables delivery; turning it off
  // unlinks it.
  const toggleTelegram = async enabled => {
    if (!enabled) {
      if (telegramBotStatus.connected) {
        await disconnectTelegram();
        return;
      }
      setNotif(previous => ({ ...previous, telegramEnabled: false }));
      return;
    }
    if (telegramBotStatus.connected) {
      setNotif(previous => ({ ...previous, telegramEnabled: true }));
      return;
    }
    await connectTelegram();
  };

  const connectTelegramGroup = async () => {
    if (!activeOrgId || !telegramGroupProjectId) {
      showToast('Оберіть проєкт для нових задач', 'error');
      return;
    }
    setTelegramGroupLoading(true);
    try {
      const result = await telegramRequest('/api/integrations/telegram/group', 'POST', {
        organizationId: activeOrgId,
        projectId: telegramGroupProjectId,
      });
      setTelegramGroupConnect(result);
      setTelegramGroupSetupOpen(true);
      window.open(result.addGroupLink, '_blank', 'noopener,noreferrer');
      showToast('Додайте бота в групу та надішліть команду підключення');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setTelegramGroupLoading(false);
    }
  };

  const disconnectTelegramGroup = async () => {
    if (!(await confirmDialog({
      title: 'Відключити Telegram-групу?',
      message: 'Бот перестане створювати задачі з цієї групи. Уже створені задачі залишаться у QuickTeam.',
      confirmText: 'Відключити',
      danger: true,
    }))) return false;

    setTelegramGroupLoading(true);
    try {
      await telegramRequest(`/api/integrations/telegram/group?organizationId=${encodeURIComponent(activeOrgId)}`, 'DELETE');
      setTelegramGroupStatus(previous => ({ ...previous, connected: false, chatTitle: '', defaultProjectId: '' }));
      setTelegramGroupConnect(null);
      setTelegramGroupSetupOpen(false);
      showToast('Telegram-групу відключено');
      return true;
    } catch (error) {
      showToast(error.message, 'error');
      return false;
    } finally {
      setTelegramGroupLoading(false);
    }
  };

  const toggleTelegramGroup = async enabled => {
    if (enabled) {
      setTelegramGroupSetupOpen(true);
      return;
    }
    if (telegramGroupStatus.connected) {
      await disconnectTelegramGroup();
      return;
    }
    setTelegramGroupSetupOpen(false);
    setTelegramGroupConnect(null);
  };
  const [generatingKey, setGeneratingKey] = useState(false);

  // ── Billing ──
  const [orgPlan,        setOrgPlan]        = useState('free');
  const [projectsCount,  setProjectsCount]  = useState(0);
  const [upgrading,      setUpgrading]      = useState(false);

  // ── Notifications ──
  // `channels` is the event × channel matrix; the flat per-event flags beside it
  // are the pre-matrix shape, still written in step with the in-app column so a
  // deploy that is mid-rollout keeps behaving. Defaults and the delivery rules
  // both live in lib/utils/notificationChannels.mjs.
  const [notif, setNotif] = useState({
    ...CHANNEL_DEFAULTS,
    ...EVENT_DEFAULTS,
    channels: resolveNotificationMatrix({}),
  });
  const [notifSaving, setNotifSaving] = useState(false);
  const notifMatrix = useMemo(() => resolveNotificationMatrix(notif), [notif]);

  // Ticking a cell. The in-app column also mirrors into the legacy flat flag.
  const setChannelEvent = (channel, key, enabled) => {
    setNotif(previous => {
      const matrix = resolveNotificationMatrix(previous);
      const next = {
        ...previous,
        channels: { ...matrix, [channel]: { ...matrix[channel], [key]: enabled } },
      };
      if (channel === 'inapp') next[key] = enabled;
      return next;
    });
  };

  // The Telegram link is not established here: the bot's webhook writes it only
  // after you press Start in Telegram. That wait used to be surfaced as a manual
  // «Перевірити» button, which put the mechanics of our own webhook in front of
  // the user. The row polls for the result itself now, and re-checks whenever
  // the tab regains focus — which is exactly when someone comes back from
  // Telegram. Enabling delivery is part of linking, so the preference is set
  // here too and picked up by the notif auto-save below.
  useEffect(() => {
    if (!telegramAwaitingLink) return undefined;
    const pollMs = 3000;
    const maxTicks = 60; // three minutes; the connect token itself lasts fifteen
    let ticks = 0;
    const check = async () => {
      try {
        const status = await telegramRequest('/api/integrations/telegram');
        setTelegramBotStatus(status);
        if (!status.connected) return;
        setTelegramAwaitingLink(false);
        setNotif(previous => ({ ...previous, telegramEnabled: true }));
        showToast('Telegram підключено');
      } catch {
        // Transient failure: the next tick retries, and the connect token stays
        // valid for 15 minutes either way.
      }
    };
    const timer = window.setInterval(() => {
      ticks += 1;
      if (ticks > maxTicks) {
        setTelegramAwaitingLink(false);
        return;
      }
      check();
    }, pollMs);
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [telegramAwaitingLink, telegramRequest, showToast]);

  // Last notif/localization value known to match Firestore (JSON) — see the
  // auto-save effects below. null until the first render establishes it.
  const notifBaseline = useRef(null);
  const locBaseline = useRef(null);
  // Debounces the branding colour picker, which fires continuously while dragging.
  const brandColorTimer = useRef(null);
  // Last workflow value known to match the server — process settings auto-save
  // (no manual button), so this guards against re-writing freshly hydrated data.
  const wfBaseline = useRef(null);
  const wfPersistedPayload = useRef(null);
  const wfLatestPayload = useRef(null);
  const wfLatestJson = useRef(null);
  const wfQueuedJson = useRef(null);
  const wfSaveQueue = useRef(Promise.resolve());
  const wfOrgId = useRef(activeOrgId);
  const wfLoadGeneration = useRef(0);
  // ── Localization ──
  const [dateFormat, setDateFormat] = useState('DD.MM.YYYY');
  const [firstDayOfWeek, setFirstDayOfWeek] = useState('Monday');
  const [timeFormat, setTimeFormat] = useState('24h');
  const [timezone, setTimezone] = useState('Europe/Kyiv');
  const [language, setLanguage] = useState('ua');
  const [locSaving, setLocSaving] = useState(false);

  // ── Team invite ──
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [memberSettingsId, setMemberSettingsId] = useState(null);

  // ─── Auth methods ───
  const [authProviderIds, setAuthProviderIds] = useState([]);
  const [authMethodLoading, setAuthMethodLoading] = useState(null);
  const hasGithubAuth = authProviderIds.includes('github.com');
  const hasGoogleAuth = authProviderIds.includes('google.com');
  const hasOneBAuth = Boolean(currentUser?.onebId && currentUser?.onebConnected !== false);
  const isPrimaryGitHub = hasGithubAuth && !hasGoogleAuth && !hasOneBAuth;
  const isPrimaryGoogle = hasGoogleAuth && !hasGithubAuth && !hasOneBAuth;
  const isPrimaryOneB = hasOneBAuth && !hasGithubAuth && !hasGoogleAuth;
  const isPrimaryEmail = false;

  const refreshAuthProviders = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setAuthProviderIds([]);
      return [];
    }
    await firebaseUser.reload().catch(() => {});
    const providerIds = firebaseUser.providerData.map(provider => provider.providerId);
    setAuthProviderIds(providerIds);
    return providerIds;
  };

  // Sync from Firestore (initial only)
  useEffect(() => {
    if (currentUser) {
      queueMicrotask(() => {
        if (currentUser.name && !displayName) setDisplayName(currentUser.name);
        if (currentUser.customAvatar && !customAvatar) setCustomAvatar(currentUser.customAvatar);
        setCustomAvatarStoragePath(currentUser.customAvatarStoragePath || '');
        setCustomAvatarResourceType(currentUser.customAvatarResourceType || 'image');
        setBio(currentUser.bio || '');
        setTelegram(currentUser.telegram || '');
        setPhone(currentUser.phone || '');
        setLocation(currentUser.location || '');
        setBirthday(currentUser.birthday || '');
        setSkillsInput(Array.isArray(currentUser.skills) ? currentUser.skills.join(', ') : '');
        if (currentUser.localization) {
          const loc = {
            dateFormat: currentUser.localization.dateFormat || 'DD.MM.YYYY',
            firstDayOfWeek: currentUser.localization.firstDayOfWeek || 'Monday',
            timeFormat: currentUser.localization.timeFormat || '24h',
            timezone: currentUser.localization.timezone || 'Europe/Kyiv',
            language: currentUser.localization.language || 'ua',
          };
          locBaseline.current = JSON.stringify(loc);
          setDateFormat(loc.dateFormat);
          setFirstDayOfWeek(loc.firstDayOfWeek);
          setTimeFormat(loc.timeFormat);
          setTimezone(loc.timezone);
          setLanguage(loc.language);
        }
      });
    }
  }, [currentUser]); // eslint-disable-line

  useEffect(() => {
    queueMicrotask(() => {
      if (currentUser?.name && !displayName) setDisplayName(currentUser.name);
      if (org?.name && !orgName) setOrgName(org.name);
      if (org?.logo && !orgLogo) setOrgLogo(org.logo);
      setOrgLogoStoragePath(org?.logoStoragePath || '');
      setOrgLogoResourceType(org?.logoResourceType || 'image');
      if (org?.customBranding !== undefined) setOrgCustomBranding(Boolean(org.customBranding));
      if (org?.sidebarTheme) setSidebarTheme(org.sidebarTheme);
      if (org?.sidebarColor) setSidebarColor(org.sidebarColor);
    });
  }, [currentUser?.name, org?.name, org?.logo, org?.logoStoragePath, org?.logoResourceType, org?.customBranding, org?.sidebarTheme, org?.sidebarColor]); // eslint-disable-line

  useEffect(() => {
    queueMicrotask(() => refreshAuthProviders());
  }, [currentUser?.id, currentUser?.uid]);

  // ── Breadcrumbs ──
  // Removed breadcrumbs to avoid duplicate 'Налаштування' in WorkspaceHeader
  useEffect(() => {
    const organizationId = activeOrgId;
    const generation = wfLoadGeneration.current + 1;
    wfLoadGeneration.current = generation;
    let cancelled = false;
    const isCurrentWorkflowLoad = () => (
      !cancelled
      && wfLoadGeneration.current === generation
      && wfOrgId.current === organizationId
    );
    const applyHydratedWorkflow = storedWorkflow => {
      const payload = hydrateWorkflowSettings(
        storedWorkflow,
        DEFAULT_WORKFLOW_SETTINGS,
      );
      const json = JSON.stringify(payload);
      wfBaseline.current = json;
      wfPersistedPayload.current = payload;
      wfLatestPayload.current = payload;
      wfLatestJson.current = json;
      wfQueuedJson.current = null;
      applyWorkflowPayload(payload);
    };

    wfOrgId.current = organizationId;
    wfBaseline.current = null;
    wfPersistedPayload.current = null;
    wfLatestPayload.current = null;
    wfLatestJson.current = null;
    wfQueuedJson.current = null;

    // Clear every section as one defaults payload before any request can
    // resolve. This removes org A's custom values while org B is loading.
    queueMicrotask(() => {
      if (!isCurrentWorkflowLoad()) return;
      applyHydratedWorkflow(null);
      setWfLoading(Boolean(organizationId));
    });

    if (!organizationId) {
      return () => {
        cancelled = true;
      };
    }

    const load = async () => {
      try {
        const storedWorkflow = await fetchWorkflowViaApi(organizationId);
        if (!isCurrentWorkflowLoad()) return;
        applyHydratedWorkflow(storedWorkflow);

        const intSnap = await getDoc(doc(db, 'organizations', organizationId, 'settings', 'integrations'));
        if (!isCurrentWorkflowLoad()) return;
        if (intSnap.exists()) {
          setQtEnabled(intSnap.data().qtPortalEnabled !== false);
        }
        
        const orgSnap = await getDoc(doc(db, 'organizations', organizationId));
        if (!isCurrentWorkflowLoad()) return;
        if (orgSnap.exists()) {
          const orgData = orgSnap.data();
          setOrgPlan(orgData.plan || 'free');
        }

        if (isAdmin) {
          const keyResult = await apiKeysRequest();
          if (!isCurrentWorkflowLoad()) return;
          setApiKeys(keyResult.keys || []);

          // Plan-limit count is admin-only (billing). Under team-gated project
          // reads a plain member can't run an org-wide projects query, so this
          // stays behind isAdmin — admins may read every project in the org.
          const { collection, query, where, getDocs } = await import('firebase/firestore');
          if (!isCurrentWorkflowLoad()) return;
          const projQuery = query(collection(db, 'projects'), where('organizationId', '==', organizationId));
          const projSnap = await getDocs(projQuery);
          if (!isCurrentWorkflowLoad()) return;
          setProjectsCount(projSnap.docs.length);
        }

        const uid = currentUser?.uid || currentUser?.id;
        if (uid) {
          const notifSnap = await getDoc(doc(db, 'users', uid, 'settings', 'notifications'));
          if (!isCurrentWorkflowLoad()) return;
          if (notifSnap.exists()) {
            const stored = notifSnap.data();
            setNotif(p => {
              // The matrix is resolved from the stored document, never from the
              // merged object: a pre-matrix document has no `channels`, and
              // merging would leave the defaults sitting there as if they had
              // been chosen, overriding what the account was actually getting.
              const merged = { ...p, ...stored, channels: resolveNotificationMatrix(stored) };
              notifBaseline.current = JSON.stringify(merged);
              return merged;
            });
          }
        }
      } catch (error) {
        if (isCurrentWorkflowLoad()) {
          showToast(error?.message || 'Не вдалося завантажити налаштування', 'error');
        }
      }
      if (isCurrentWorkflowLoad()) setWfLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [activeOrgId, currentUser?.uid, isAdmin, applyWorkflowPayload]); // eslint-disable-line

  // ── Handlers ─────────────────────────────────────────────────────

  // Auto-save saves what the USER changed — but hydration from Firestore also
  // lands in the same state, so a "skip first render" guard was not enough:
  // loading saved prefs re-saved them and toasted «Налаштування оновлено» the
  // moment the page opened. The baseline refs hold the last value known to
  // match Firestore (updated on hydration and after each save); the effects
  // only write when the state actually differs from that baseline.
  useEffect(() => {
    const json = JSON.stringify(notif);
    if (notifBaseline.current === null || notifBaseline.current === json) {
      notifBaseline.current = json;
      return;
    }
    const saveNotifEffect = async () => {
      const uid = currentUser?.uid || currentUser?.id;
      if (!uid) return;
      try {
        await setDoc(doc(db, 'users', uid, 'settings', 'notifications'), { ...notif, updatedAt: serverTimestamp() });
        notifBaseline.current = json;
        showToast('Налаштування оновлено');
      } catch { showToast('Помилка збереження', 'error'); }
    };
    saveNotifEffect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notif, showToast]);

  useEffect(() => {
    const json = JSON.stringify({ dateFormat, firstDayOfWeek, timeFormat, timezone, language });
    if (locBaseline.current === null || locBaseline.current === json) {
      locBaseline.current = json;
      return;
    }
    const saveLocEffect = async () => {
      const uid = currentUser?.uid || currentUser?.id;
      if (!uid) return;
      try {
        await updateDoc(doc(db, 'users', uid), {
          localization: { dateFormat, firstDayOfWeek, timeFormat, timezone, language },
          updatedAt: serverTimestamp()
        });
        locBaseline.current = json;
        showToast('Налаштування оновлено');
      } catch { showToast('Помилка збереження', 'error'); }
    };
    saveLocEffect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFormat, firstDayOfWeek, timeFormat, timezone, language, showToast]);

  // ── Unsaved-changes guard ────────────────────────────────────────
  // Process settings auto-save, so only Profile/Organization can be "dirty".
  // Switching sections is already guarded by handleSectionChange; this covers
  // LEAVING the settings page: a hard navigation (beforeunload) and in-app
  // <Link> clicks (sidebar → Проєкти etc.), intercepted in the capture phase so
  // we run before Next's Link handler and can cancel it.
  useEffect(() => {
    const hasUnsaved = () => profileDirty;

    const onBeforeUnload = (e) => {
      if (!hasUnsaved()) return;
      e.preventDefault();
      e.returnValue = '';
    };

    const onClickCapture = (e) => {
      if (!hasUnsaved()) return;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = e.target?.closest?.('a[href]');
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;      // opens a new tab
      const url = new URL(anchor.href, window.location.origin);
      if (url.origin !== window.location.origin) return;           // external → beforeunload handles it
      if (url.pathname === window.location.pathname) return;        // same page / in-page anchor
      e.preventDefault();
      e.stopPropagation();
      confirmDialog({
        title: 'Незбережені зміни',
        message: 'У вас є незбережені зміни. Ви впевнені, що хочете піти без збереження?',
        confirmText: 'Піти', danger: true,
      }).then(ok => {
        if (!ok) return;
        revertProfile(); // discard so we don't re-prompt on the next click
        router.push(url.pathname + url.search + url.hash);
      });
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClickCapture, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClickCapture, true);
    };
  }, [profileDirty, confirmDialog, router, revertProfile]);

  // Persist a single profile field inline (each field has its own save/cancel).
  const saveProfileField = async (field, rawValue) => {
    const uid = currentUser?.uid || currentUser?.id;
    if (!uid) return;
    let value = rawValue;
    if (field === 'skills') value = String(rawValue).split(',').map(s => s.trim()).filter(Boolean);
    else if (typeof rawValue === 'string') value = rawValue.trim();
    try {
      await updateDoc(doc(db, 'users', uid), { [field]: value, updatedAt: serverTimestamp() });
      showToast('Збережено');
      if (field === 'birthday') await announceBirthdayIfToday(value);
    } catch { showToast('Помилка збереження', 'error'); }
  };

  const saveProfileImage = async (url, asset) => {
    const uid = currentUser?.uid || currentUser?.id;
    if (!uid) throw new Error('Не вдалося визначити користувача');
    await updateDoc(doc(db, 'users', uid), {
      customAvatar: url,
      customAvatarStoragePath: asset?.storagePath || '',
      customAvatarResourceType: asset?.resourceType || '',
      updatedAt: serverTimestamp(),
    });
    setCustomAvatar(url);
    setCustomAvatarStoragePath(asset?.storagePath || '');
    setCustomAvatarResourceType(asset?.resourceType || 'image');
    showToast(url ? 'Аватар збережено' : 'Аватар видалено');
  };

  // The scheduled sweep claims each day once, and by the time anyone opens
  // Settings it has already run — so a birthday saved *for today* produced no
  // greeting and no notification until the next year. Ask the server to
  // announce it now instead. Everything it writes is keyed by day and member,
  // so the regular sweep landing later changes nothing.
  const announceBirthdayIfToday = async value => {
    const organizationId = activeOrgId;
    if (!organizationId || typeof value !== 'string') return;
    const match = value.match(/^\d{4}-(\d{2}-\d{2})$/);
    const today = new Date();
    const todayKey = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (!match || match[1] !== todayKey) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      await fetch('/api/calendar/birthday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ organizationId }),
      });
    } catch {
      // The greeting is a nicety, not part of saving the profile field.
    }
  };

  const handleSectionChange = async (newSection) => {
    if (newSection === activeSection) return true;
    // Everything auto-saves except individual profile fields (which save inline
    // per-field), so warn only when a profile field is left unsaved.
    if (profileDirty) {
      if (!(await confirmDialog({
        title: 'Незбережені зміни',
        message: 'У вас є незбережені зміни у профілі. Перейти без збереження?',
        confirmText: 'Перейти',
        danger: true,
      }))) {
        return false;
      }
      revertProfile(); // chose to leave → discard so the guard stops prompting
    }
    setActiveSection(newSection);
    setIntegrationDetail('');
    return true;
  };

  const saveLocalization = async () => {
    const uid = currentUser?.uid || currentUser?.id;
    if (!uid) return;
    setLocSaving(true);
    try {
      await updateDoc(doc(db, 'users', uid), {
        localization: {
          dateFormat,
          firstDayOfWeek,
          timeFormat,
          timezone,
          language,
        },
        updatedAt: serverTimestamp()
      });
      showToast('Параметри локалізації збережено');
      triggerSavedSuccess();
    } catch { showToast('Помилка збереження', 'error'); }
    setLocSaving(false);
  };

  const handleConnectGitHub = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return showToast('Потрібно увійти повторно', 'error');
    setAuthMethodLoading('github-connect');
    try {
      await linkWithPopup(firebaseUser, createGitHubProvider());
      await refreshAuthProviders();
      showToast('GitHub підключено');
    } catch (error) {
      console.warn('[settings] GitHub connect failed:', error);
      const providerIds = await refreshAuthProviders();
      if (providerIds.includes('github.com')) {
        showToast('GitHub підключено');
        return;
      }
      const message = error.code === 'auth/provider-already-linked'
        ? 'GitHub уже підключено'
        : error.code === 'auth/credential-already-in-use'
          ? 'Цей GitHub уже підключений до іншого акаунта'
          : error.code === 'auth/operation-not-allowed'
            ? 'GitHub треба увімкнути у Firebase Authentication'
            : error.code === 'auth/invalid-credential' || error.message?.includes('Bad credentials')
              ? 'GitHub відхилив OAuth-ключ. Оновіть Client ID і Client Secret у Firebase'
            : 'Не вдалося підключити GitHub';
      showToast(message, 'error');
    } finally {
      setAuthMethodLoading(null);
    }
  };

  const handleConnectGoogle = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return showToast('Потрібно увійти повторно', 'error');
    setAuthMethodLoading('google-connect');
    try {
      await linkWithPopup(firebaseUser, googleProvider);
      await refreshAuthProviders();
      showToast('Google підключено');
    } catch (error) {
      console.error('[settings] Google connect failed:', error);
      const message = error.code === 'auth/provider-already-linked'
        ? 'Google уже підключено'
        : error.code === 'auth/credential-already-in-use'
          ? 'Цей Google акаунт уже підключений до іншого користувача'
          : error.code === 'auth/operation-not-allowed'
            ? 'Google треба увімкнути у Firebase Authentication'
            : error.code === 'auth/requires-recent-login'
              ? 'Увійдіть повторно і спробуйте підключити Google ще раз'
              : 'Не вдалося підключити Google';
      showToast(message, 'error');
    } finally {
      setAuthMethodLoading(null);
    }
  };

  const handleDisconnectGitHub = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return showToast('Потрібно увійти повторно', 'error');
    if (!hasGoogleAuth && !hasOneBAuth) {
      return showToast('Спочатку підключіть Google або OneB, щоб не втратити доступ', 'error');
    }
    setAuthMethodLoading('github-disconnect');
    try {
      await unlink(firebaseUser, 'github.com');
      await refreshAuthProviders();
      showToast('GitHub відключено');
    } catch (error) {
      console.error('[settings] GitHub disconnect failed:', error);
      showToast(error.code === 'auth/no-such-provider' ? 'GitHub не підключено' : 'Не вдалося відключити GitHub', 'error');
    } finally {
      setAuthMethodLoading(null);
    }
  };

  const handleDisconnectGoogle = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return showToast('Потрібно увійти повторно', 'error');
    if (!hasGithubAuth && !hasOneBAuth) {
      return showToast('Спочатку підключіть GitHub або OneB, щоб не втратити доступ', 'error');
    }
    setAuthMethodLoading('google-disconnect');
    try {
      await unlink(firebaseUser, 'google.com');
      await refreshAuthProviders();
      showToast('Google відключено');
    } catch (error) {
      console.error('[settings] Google disconnect failed:', error);
      showToast(error.code === 'auth/no-such-provider' ? 'Google не підключено' : 'Не вдалося відключити Google', 'error');
    } finally {
      setAuthMethodLoading(null);
    }
  };

  const handleConnectOneB = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return showToast('Потрібно увійти повторно', 'error');
    const clientId = process.env.NEXT_PUBLIC_ONEB_CLIENT_ID || 'dummy_client_id';
    if (clientId === 'dummy_client_id') {
      return showToast('OneB Client ID не налаштований', 'error');
    }
    setAuthMethodLoading('oneb-connect');
    try {
      const idToken = await firebaseUser.getIdToken(true);
      const sessionResponse = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!sessionResponse.ok) throw new Error('Failed to refresh server session');

      // The server builds the authorize URL: it is the only side that can set
      // the httpOnly nonce cookie the callback checks against.
      const params = new URLSearchParams({ mode: 'link', r: '/settings?section=auth-methods' });
      navigateToSameOrigin(`/api/auth/oneb/start?${params.toString()}`);
    } catch (error) {
      console.error('[settings] OneB connect failed:', error);
      showToast('Не вдалося почати підключення OneB', 'error');
      setAuthMethodLoading(null);
    }
  };

  const handleDisconnectOneB = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return showToast('Потрібно увійти повторно', 'error');
    if (!hasGithubAuth && !hasGoogleAuth) {
      return showToast('Спочатку підключіть GitHub або Google, щоб не втратити доступ', 'error');
    }
    setAuthMethodLoading('oneb-disconnect');
    try {
      const idToken = await firebaseUser.getIdToken(true);
      const response = await fetch('/api/auth/oneb/unlink', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || result.error || 'Failed to unlink OneB');
      await firebaseUser.getIdToken(true);
      showToast('OneB відключено');
    } catch (error) {
      console.error('[settings] OneB disconnect failed:', error);
      showToast(error.message || 'Не вдалося відключити OneB', 'error');
    } finally {
      setAuthMethodLoading(null);
    }
  };

  // Org name is text → deliberate save on blur (no button, no writes while you
  // type). Only writes when the name actually changed.
  const saveOrgName = async () => {
    if (!activeOrgId) return;
    const trimmed = orgName.trim();
    if (!trimmed || trimmed === (org?.name || '')) return;
    try {
      await updateDoc(doc(db, 'organizations', activeOrgId), { name: trimmed, updatedAt: serverTimestamp() });
      showToast('Назву організації збережено');
    } catch { showToast('Помилка збереження', 'error'); }
  };

  // Branding (logo / toggle / theme / colour) persists the instant you change
  // it — it already live-previews in the sidebar, so a Save button was just
  // friction. Writes fire only from explicit user actions (never an effect), so
  // there is no spurious save on load. Takes current state + the just-changed
  // value and writes the derived document. The colour picker is debounced by
  // its caller because it fires continuously while dragging.
  const persistBranding = async (patch = {}, { rethrow = false } = {}) => {
    if (!activeOrgId) return;
    const next = {
      orgCustomBranding,
      orgLogo,
      orgLogoStoragePath,
      orgLogoResourceType,
      sidebarTheme,
      sidebarColor,
      ...patch,
    };
    const brandingValue = next.orgCustomBranding && (next.orgLogo || '').trim() ? true : false;
    try {
      await updateDoc(doc(db, 'organizations', activeOrgId), {
        logo: (next.orgLogo || '').trim(),
        logoStoragePath: next.orgLogoStoragePath || '',
        logoResourceType: next.orgLogoResourceType || '',
        customBranding: brandingValue,
        sidebarTheme: brandingValue ? next.sidebarTheme : 'dark',
        sidebarColor: brandingValue && next.sidebarTheme === 'custom' ? next.sidebarColor : '#1f1f1f',
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      showToast('Помилка збереження', 'error');
      if (rethrow) throw error;
    }
  };

  // Full workflow documents are serialized through one client queue. This
  // prevents two debounced saves from arriving out of order and restoring an
  // older status model after a newer one.
  const queueWorkflowMutation = useCallback((
    payload,
    {
      statusMigrations = [],
      notify = true,
    } = {},
  ) => {
    const organizationId = activeOrgId;
    if (!organizationId) return Promise.reject(new Error('Не вибрано організацію'));
    const json = JSON.stringify(payload);
    if (
      statusMigrations.length === 0
      && wfQueuedJson.current === json
      && wfBaseline.current !== json
    ) {
      return wfSaveQueue.current;
    }
    wfQueuedJson.current = json;

    const work = wfSaveQueue.current
      .catch(() => undefined)
      .then(async () => {
        let pendingPayload = payload;
        let pendingJson = json;
        let pendingMigrations = statusMigrations;
        while (true) {
          try {
            const result = await updateWorkflowViaApi({
              organizationId,
              workflow: pendingPayload,
              statusMigrations: pendingMigrations,
            });
            if (wfOrgId.current !== organizationId) return result;

            wfBaseline.current = pendingJson;
            wfPersistedPayload.current = pendingPayload;
            if (
              wfLatestPayload.current
              && wfLatestJson.current !== pendingJson
              && wfQueuedJson.current === pendingJson
            ) {
              pendingPayload = wfLatestPayload.current;
              pendingJson = wfLatestJson.current;
              pendingMigrations = [];
              wfQueuedJson.current = pendingJson;
              continue;
            }
            if (notify && wfLatestJson.current === pendingJson) {
              showToast('Налаштування оновлено');
            }
            return result;
          } catch (error) {
            if (wfOrgId.current !== organizationId) throw error;
            if (
              wfLatestPayload.current
              && wfLatestJson.current !== pendingJson
              && wfQueuedJson.current === pendingJson
            ) {
              pendingPayload = wfLatestPayload.current;
              pendingJson = wfLatestJson.current;
              pendingMigrations = [];
              wfQueuedJson.current = pendingJson;
              continue;
            }
            if (wfQueuedJson.current === pendingJson) wfQueuedJson.current = null;
            if (
              wfLatestJson.current === pendingJson
              && wfPersistedPayload.current
            ) {
              const restored = wfPersistedPayload.current;
              const restoredJson = JSON.stringify(restored);
              wfLatestPayload.current = restored;
              wfLatestJson.current = restoredJson;
              wfBaseline.current = restoredJson;
              applyWorkflowPayload(restored);
            }
            if (notify) {
              console.error('Workflow autosave error:', error);
              showToast(error.message || 'Помилка збереження', 'error');
            }
            throw error;
          }
        }
      });
    wfSaveQueue.current = work.catch(() => undefined);
    return work;
  }, [activeOrgId, applyWorkflowPayload, showToast]);

  // Process settings auto-save: persist workflow changes in real time through
  // the transactional API. Debouncing collapses a burst of inline edits or a
  // drag-reorder into one mutation.
  useEffect(() => {
    if (wfLoading) return;
    const payload = {
      statuses: cleanWorkflowItems(statuses),
      types: cleanWorkflowItems(types),
      priorities: cleanWorkflowItems(priorities),
      labels: cleanWorkflowItems(labels),
      positions: cleanWorkflowItems(positions),
    };
    const json = JSON.stringify(payload);
    wfLatestPayload.current = payload;
    wfLatestJson.current = json;
    if (wfBaseline.current === null) {
      wfBaseline.current = json;
      wfPersistedPayload.current = payload;
      return;
    }
    if (wfBaseline.current === json) return;
    if (!activeOrgId) return;
    const timer = setTimeout(() => {
      queueWorkflowMutation(payload).catch(() => {});
    }, 700);
    return () => clearTimeout(timer);
  }, [
    statuses,
    types,
    priorities,
    labels,
    positions,
    wfLoading,
    activeOrgId,
    queueWorkflowMutation,
  ]);

  const saveNotifications = async () => {
    const uid = currentUser?.uid || currentUser?.id;
    if (!uid) return;
    setNotifSaving(true);
    try {
      await setDoc(doc(db, 'users', uid, 'settings', 'notifications'), { ...notif, updatedAt: serverTimestamp() });
      showToast('Налаштування збережено');
      triggerSavedSuccess();
    } catch { showToast('Помилка збереження', 'error'); }
    setNotifSaving(false);
  };

  // Send a test notification to yourself — checks the whole pipeline (sound/popup/push)
  const sendTestNotification = async () => {
    const uid = currentUser?.uid || currentUser?.id;
    if (!uid) return;
    await sendNotification({
      userIds: [uid],
      type: 'test',
      title: 'Тестове сповіщення',
      body: 'Все працює! Так виглядатимуть сповіщення про події у воркспейсі.',
      organizationId: activeOrgId,
      actor: { id: uid, name: currentUser?.name || '', avatar: currentUser?.avatar || '' },
    });
    showToast('Тестове сповіщення надіслано ✓');
  };

  const saveIntegration = async (enabled) => {
    if (!activeOrgId) return;
    if (enabled && !PORTAL_URL) {
      showToast('Спочатку налаштуйте NEXT_PUBLIC_PORTAL_URL', 'error');
      return;
    }

    // If user is trying to turn it OFF, show confirmation
    if (qtEnabled && !enabled) {
      if (!(await confirmDialog({
        title: 'Відключити інтеграцію?',
        message: 'Ви впевнені? Якщо ви відключите інтеграцію, ви більше не зможете інтегрувати проєкти з клієнтським порталом. Ваші клієнти втратять доступ до оновлень у реальному часі.',
        confirmText: 'Відключити', danger: true,
      }))) return;
    }

    await confirmSaveIntegration(enabled);
  };

  const confirmSaveIntegration = async (enabled) => {
    setQtSaving(true);
    try {
      await setDoc(doc(db, 'organizations', activeOrgId, 'settings', 'integrations'), {
        qtPortalEnabled: enabled, updatedAt: serverTimestamp(),
      }, { merge: true });
      setQtEnabled(enabled);
      showToast(enabled ? 'Інтеграцію з QT увімкнено' : 'Інтеграцію з QT вимкнено');
    } catch { showToast('Помилка збереження', 'error'); }
    setQtSaving(false);
  };

  const generateApiKey = async () => {
    if (!activeOrgId) return;
    setGeneratingKey(true);
    try {
      const { key } = await apiKeysRequest('POST', { name: `Key ${new Date().toLocaleDateString()}` });
      const updatedKeys = [...apiKeys, key];
      setApiKeys(updatedKeys);
      showToast('Новий API ключ згенеровано');
    } catch (e) {
      showToast(userFacingErrorMessage(e, 'Не вдалося згенерувати API ключ'), 'error');
    }
    setGeneratingKey(false);
  };

  const revokeApiKey = async (keyId) => {
    if (!activeOrgId) return;
    if (!(await confirmDialog({
      title: 'Видалити API ключ?',
      message: 'Усі інтеграції, що його використовують, перестануть працювати.',
      confirmText: 'Видалити', danger: true,
    }))) return;
    try {
      const updatedKeys = apiKeys.filter(k => k.id !== keyId);
      await apiKeysRequest('DELETE', { keyId });
      setApiKeys(updatedKeys);
      showToast('API ключ видалено');
    } catch (e) {
      showToast(userFacingErrorMessage(e, 'Не вдалося видалити API ключ'), 'error');
    }
  };

  const handleRoleChange = async (uid, role) => {
    try { await changeMemberRole(uid, role); showToast('Роль змінено'); }
    catch (error) { showToast(userFacingErrorMessage(error, 'Не вдалося змінити роль'), 'error'); }
  };

  const handlePositionChange = async (uid, positionId) => {
    try { await setMemberPosition(uid, positionId); showToast('Посаду змінено'); }
    catch (error) { showToast(userFacingErrorMessage(error, 'Не вдалося змінити посаду'), 'error'); }
  };

  const handleTransferOwnership = async (targetUid) => {
    if (!(await confirmDialog({
      title: 'Передати права власника?',
      message: 'Ви втратите статус власника та станете адміністратором.',
      confirmText: 'Передати права', danger: true,
    }))) return;
    try {
      await transferOrganizationOwnership(activeOrgId, targetUid);
      showToast('Права власника успішно передано');
    } catch (e) {
      showToast(userFacingErrorMessage(e, 'Не вдалося передати права власника'), 'error');
    }
  };

  const handleRemoveMember = async (uid) => {
    let impact;
    try {
      impact = await getMemberRemovalImpact(uid);
    } catch (error) {
      showToast(userFacingErrorMessage(error, 'Не вдалося перевірити доступ учасника'), 'error');
      return;
    }
    if (!(await confirmDialog({
      title: 'Видалити учасника з команди?',
      message: `Кількість проєктів, з яких його буде прибрано: ${impact.projectCount}. Призначення та підписки на завдання також буде очищено.`,
      confirmText: 'Видалити', danger: true,
    }))) return;
    try { await removeMember(uid); showToast('Учасника видалено'); }
    catch (error) { showToast(userFacingErrorMessage(error, 'Не вдалося видалити учасника'), 'error'); }
  };

  const handleUpgradePlan = async (newPlan = 'pro') => {
    showToast('Підключення платіжної системи в розробці 🛠️');
  };

  const unarchiveProject = async (id) => {
    try {
      await restoreProject(id);
      showToast('Проєкт розархівовано');
    } catch (err) {
      showToast(userFacingErrorMessage(err, 'Не вдалося розархівувати проєкт'), 'error');
      return false;
    }
    return true;
  };

  // ── Workflow helpers ─────────────────────────────────────────────
  const makeUpdater = setter => ({
    onSave:   updated => setter(prev => prev.map(i => i.id === updated.id ? updated : i)),
    onDelete: id      => setter(prev => prev.filter(i => i.id !== id)),
  });
  const stA = makeUpdater(setStatuses);
  const tpA = makeUpdater(setTypes);
  const prA = makeUpdater(setPriorities);
  const lbA = makeUpdater(setLabels);
  const posA = makeUpdater(setPositions);

  const handlePriorityDragEnd = result => {
    if (!result.destination) return;
    setPriorities(current => {
      const moved = current[result.source.index];
      if (!moved || isSystemPriorityId(moved.id)) return current;

      const next = [...current];
      next.splice(result.source.index, 1);
      const blockerIndex = next.findIndex(item => item.id === 'blocker');
      const lowIndex = next.findIndex(item => item.id === 'low');
      const destinationIndex = Math.min(
        Math.max(result.destination.index, blockerIndex + 1),
        Math.max(blockerIndex + 1, lowIndex),
      );
      next.splice(destinationIndex, 0, moved);
      return next;
    });
  };

  // ── The workflow editor is a list per category ─────────────────────────────
  // A status's category is where it sits, not a dropdown on its row: you move a
  // status between «У роботі» and «Готово» by dragging it there, the way Linear
  // and Shortcut do it. That makes the two-layer model visible instead of
  // explained — and it means the flat array we save is always in category order,
  // so a project board's columns come out in the order work actually flows.
  const statusesByCategory = useMemo(() => groupStatusesByCategory(statuses), [statuses]);

  // The two invariants the whole product rests on, enforced here and again in the
  // API: something has to close a task, and something has to stay open for new
  // work to land in. Refused with the reason, never silently undone.
  const statusGroupsBreakInvariant = next => {
    const closing = next.filter(status => isClosingCategory(status.category)).length;
    if (closing === 0) {
      return 'Потрібен щонайменше один статус категорії «Готово» або «Скасовано» — '
        + 'без нього не рахуються прогрес, швидкість і рахунок';
    }
    if (closing === next.length) {
      return 'Потрібен щонайменше один відкритий статус — інакше нові завдання '
        + 'одразу вважатимуться закритими';
    }
    return null;
  };

  const handleStatusDragEnd = result => {
    const { source, destination } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId
      && source.index === destination.index
    ) return;
    const groups = new Map(
      [...statusesByCategory].map(([categoryId, items]) => [categoryId, [...items]]),
    );
    const from = groups.get(source.droppableId);
    const to = groups.get(destination.droppableId);
    if (!from || !to) return;
    const [moved] = from.splice(source.index, 1);
    if (!moved) return;
    to.splice(destination.index, 0, moved);
    const next = flattenStatusGroups(groups);
    if (source.droppableId !== destination.droppableId) {
      const problem = statusGroupsBreakInvariant(next);
      if (problem) {
        showToast(problem, 'error');
        return;
      }
    }
    setStatuses(next);
  };

  // Added into the category you pressed «+» on, and coloured like it: a status
  // starts out looking like what it means, and can be recoloured after.
  const handleAddStatus = categoryId => {
    setStatuses(prev => {
      const groups = groupStatusesByCategory(prev);
      groups.get(categoryId).push({
        id: `s-${Date.now()}`,
        label: 'Новий статус',
        color: STATUS_CATEGORIES[categoryId].color,
        category: categoryId,
        isDone: isClosingCategory(categoryId),
        isNew: true,
      });
      return flattenStatusGroups(groups);
    });
  };

  const handleStatusDeleteClick = async (id) => {
    const mutationOrganizationId = activeOrgId;
    const targetStatus = statuses.find(s => s.id === id);
    if (!targetStatus || targetStatus.isNew) {
      stA.onDelete(id);
      return;
    }
    if (statuses.filter(s => !s.isNew).length <= 1) {
      showToast('Дошка повинна мати хоча б одну видиму колонку', 'error');
      return;
    }
    const problem = statusGroupsBreakInvariant(statuses.filter(s => s.id !== id));
    if (problem) {
      showToast(problem, 'error');
      return;
    }
    // The tasks go to a status of the same category first: deleting «QA» must not
    // send its work to «Готово» just because that happens to be next in the list.
    const remaining = statuses.filter(s => s.id !== id && !s.isNew);
    const target = remaining.find(s => s.category === targetStatus.category)
      || remaining.find(s => !isClosingCategory(s.category))
      || remaining[0];
    if (!target) return;
    if (!(await confirmDialog({
      title: 'Видалити статус?',
      message: `Усі завдання зі статусом «${targetStatus.label}» буде атомарно переміщено в «${target.label}». Продовжити?`,
      confirmText: 'Видалити й перемістити',
      danger: true,
    }))) return;
    if (
      !mutationOrganizationId
      || wfOrgId.current !== mutationOrganizationId
    ) return;

    const nextStatuses = statuses.filter(status => status.id !== id);
    const payload = {
      statuses: cleanWorkflowItems(nextStatuses),
      types: cleanWorkflowItems(types),
      priorities: cleanWorkflowItems(priorities),
      labels: cleanWorkflowItems(labels),
      positions: cleanWorkflowItems(positions),
    };
    wfLatestPayload.current = payload;
    wfLatestJson.current = JSON.stringify(payload);
    setWfLoading(true);
    try {
      const result = await queueWorkflowMutation(payload, {
        statusMigrations: [{
          fromStatusId: id,
          toStatusId: target.id,
        }],
        notify: false,
      });
      if (wfOrgId.current !== mutationOrganizationId) return;
      setStatuses(nextStatuses);
      showToast(
        result.migratedIssues > 0
          ? `Статус видалено, переміщено завдань: ${result.migratedIssues}`
          : 'Статус видалено',
      );
    } catch (error) {
      if (wfOrgId.current !== mutationOrganizationId) return;
      showToast(
        error.message || 'Не вдалося безпечно видалити статус',
        'error',
      );
    } finally {
      if (wfOrgId.current === mutationOrganizationId) {
        setWfLoading(false);
      }
    }
  };

  const handleDragEnd = (result, list, setList) => {
    if (!result.destination) return;
    const items = Array.from(list);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setList(items);
  };

  // ── Section renderer ─────────────────────────────────────────────
  // Every section now saves without a header button (process settings & org
  // branding auto-save; profile saves inline per field), so section headers no
  // longer carry a Save button. Kept as null so existing rightAction props are
  // harmless no-ops.
  const saveButton = null;

  // Process settings auto-save (no Save button, no status pill — same silent
  // behaviour as Notifications/Localization). Each section gets a reset-to-
  // defaults footer at the very bottom instead, with a short explanation.
  const workflowResetConfig = {
    statuses: {
      noun: 'статуси',
      hint: 'Перетягуйте статуси між категоріями. Категорія визначає поведінку завдання на спільних дошках, у прогресі та звітах.',
      apply: () => setStatuses(DEFAULT_STATUSES),
    },
    types: {
      noun: 'типи',
      hint: '«Задача» лишається системним типом. Стандартні типи мають власні іконки, а створені вручну позначаються зіркою.',
      apply: () => setTypes(DEFAULT_TYPES),
    },
    priorities: {
      noun: 'пріоритети',
      hint: 'Чотири системні рівні не видаляються. Власні рівні можна додавати між ними — вигляд індикатора визначається позицією.',
      apply: () => setPriorities(DEFAULT_PRIORITIES),
    },
    labels: {
      noun: 'мітки',
      hint: 'Мітки доступні в усіх проєктах організації.',
      apply: () => setLabels(DEFAULT_LABELS),
    },
    positions: {
      noun: 'посади',
      hint: 'Ставка зберігається як число за годину; валюту обирають під час створення рахунку.',
      apply: () => setPositions(DEFAULT_POSITIONS),
    },
  };
  const renderWorkflowResetFooter = () => {
    const cfg = workflowResetConfig[activeSection];
    if (!cfg) return null;
    return (
      <div className="mt-2 flex flex-col items-start gap-1 px-4 py-3">
        <p className="text-[12px] text-muted leading-relaxed">{cfg.hint}</p>
        <p className="text-[12px] text-muted leading-relaxed">
          Повернути {cfg.noun} до стандартного набору QuickTeam. Ваші поточні зміни в цій секції буде замінено.
        </p>
        <Button
          style="ghost"
          size="sm"
          icon={RefreshCw}
          className="-ml-3 text-faint hover:text-muted"
          onClick={async () => {
            const resetOrganizationId = activeOrgId;
            if (!(await confirmDialog({
              title: `Скинути ${cfg.noun}?`,
              message: `Усі ваші ${cfg.noun} в цій секції буде замінено стандартним набором QuickTeam. Цю дію не можна скасувати.`,
              confirmText: 'Скинути', cancelText: 'Залишити', danger: true,
            }))) return;
            if (
              !resetOrganizationId
              || wfOrgId.current !== resetOrganizationId
            ) return;
            cfg.apply();
          }}
        >
          Скинути до стандартних
        </Button>
      </div>
    );
  };

  const renderSection = () => {
    switch (activeSection) {

      // ──────────────────────────────────────────────────────────────
      case 'profile': return (
        <Section title="Особистий профіль" desc="Ваша інформація відображається у профілі команди, завданнях та чаті" rightAction={saveButton}>
          <Card preset="borderless" padding="lg">
            <Row label="Аватар" desc="Завантажте власне фото (рекомендовано 1:1)">
              <ImageUpload
                value={customAvatar || currentUser?.avatar || ''}
                storagePath={customAvatarStoragePath}
                resourceType={customAvatarResourceType}
                organizationId={activeOrgId}
                kind="avatars"
                onChange={saveProfileImage}
                theme="light"
                showLabel={false}
                showHint={false}
              />
            </Row>
            <Row label="Ім'я" desc="Показується в завданнях і чаті">
              <InlineEditField value={displayName} onChange={setDisplayName} saved={currentUser?.name || ''} onSave={() => saveProfileField('name', displayName)} className="w-[260px]" />
            </Row>
            <Row label="Email" desc="Використовується для входу та запрошень">
              <span className="text-[13px] text-muted">{currentUser?.email}</span>
            </Row>
            <Row label="Telegram" desc="Ваш нікнейм без @ (наприклад: username)">
              <InlineEditField value={telegram} onChange={setTelegram} saved={currentUser?.telegram || ''} onSave={() => saveProfileField('telegram', telegram)} placeholder="username" className="w-[260px]" />
            </Row>
            <Row label="Телефон" desc="Контактний номер">
              <InlineEditField value={phone} onChange={setPhone} saved={currentUser?.phone || ''} onSave={() => saveProfileField('phone', phone)} placeholder="+380..." className="w-[260px]" />
            </Row>
            <Row label="Локація" desc="Місто, країна">
              <InlineEditField value={location} onChange={setLocation} saved={currentUser?.location || ''} onSave={() => saveProfileField('location', location)} placeholder="Київ, Україна" className="w-[260px]" />
            </Row>
            <Row label="День народження" desc="Показується команді в профілі та календарі">
              <InlineDateField
                value={birthday}
                onChange={setBirthday}
                saved={currentUser?.birthday || ''}
                onSave={() => saveProfileField('birthday', birthday)}
                placeholder="Оберіть день народження"
              />
            </Row>
            <div className="flex flex-col gap-2 py-[12px] border-t border-canvas mt-2">
              <Label context="inline">Про себе</Label>
              <p className="text-[12px] text-muted -mt-1 leading-relaxed">Коротка інформація про вашу роль, досвід чи інтереси</p>
              <Textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Розкажіть трохи про себе..."
                composition="settings-note"
              />
              {bio !== (currentUser?.bio || '') && (
                <div className="flex items-center justify-end gap-2">
                  <Button onClick={() => setBio(currentUser?.bio || '')} style="secondary" size="sm">Скасувати</Button>
                  <Button onClick={() => saveProfileField('bio', bio)} style="primary" color="dark" size="sm" icon={Check}>Зберегти</Button>
                </div>
              )}
            </div>
          </Card>
        </Section>
      );

      case 'auth-methods': return (
        <Section title="Способи входу" desc="Керуйте сервісами, через які можна входити у QuickTeam">
          <Card preset="borderless" padding="lg">
            <div className="divide-y divide-canvas">
              <LoginMethodItem
                icon={<GitHubLogo size={18} />}
                title="GitHub"
                detail={hasGithubAuth ? 'Підключено до поточного акаунта' : 'Вхід через GitHub OAuth'}
                connected={hasGithubAuth}
                primary={isPrimaryGitHub}
                loading={authMethodLoading === 'github-connect' || authMethodLoading === 'github-disconnect'}
                disabled={Boolean(authMethodLoading)}
                onConnect={handleConnectGitHub}
                onDisconnect={handleDisconnectGitHub}
              />
              <LoginMethodItem
                icon={<GoogleLogo size={18} />}
                title="Google"
                detail={hasGoogleAuth ? 'Підключено до поточного акаунта' : 'Вхід через Google OAuth'}
                connected={hasGoogleAuth}
                primary={isPrimaryGoogle}
                loading={authMethodLoading === 'google-connect' || authMethodLoading === 'google-disconnect'}
                disabled={Boolean(authMethodLoading)}
                onConnect={handleConnectGoogle}
                onDisconnect={handleDisconnectGoogle}
              />
              <LoginMethodItem
                icon={<OneBMark />}
                title="OneB"
                detail={hasOneBAuth
                  ? (currentUser?.onebAlias || currentUser?.onebWorkspace || 'Підключено до екосистеми OneB')
                  : 'Вхід через OneB OAuth'}
                connected={hasOneBAuth}
                primary={isPrimaryOneB}
                loading={authMethodLoading === 'oneb-connect' || authMethodLoading === 'oneb-disconnect'}
                disabled={Boolean(authMethodLoading)}
                onConnect={handleConnectOneB}
                onDisconnect={handleDisconnectOneB}
              />
              <LoginMethodItem
                icon={<Mail size={18} />}
                title="Email"
                detail="Вхід по email-коду тимчасово вимкнений"
                connected={false}
                primary={isPrimaryEmail}
                soon
                loading={false}
                disabled
                staticMethod
                onConnect={() => {}}
                onDisconnect={() => {}}
              />
            </div>
          </Card>
        </Section>
      );

      // ──────────────────────────────────────────────────────────────
      case 'notifications': {
        // Split by channel, one card each, because that is the question people
        // actually arrive with: "what does Telegram send me?". The previous
        // version put five event switches in one list and four channel switches
        // in another, and which event reached which channel was written nowhere —
        // it was hardcoded in the senders, and they disagreed with each other.
        const eventRows = [
          { key: 'assigned',      label: 'Завдання призначено мені', desc: 'Хтось призначив завдання на тебе або створив нове одразу з тобою' },
          { key: 'commented',     label: 'Новий коментар',           desc: 'У завданнях, де ти виконавець або автор' },
          { key: 'mentioned',     label: 'Згадування',               desc: 'Хтось написав @твоє-імʼя в коментарі' },
          { key: 'statusChanged', label: 'Зміна статусу',            desc: 'Коли твоє завдання рухається по дошці' },
          { key: 'deadline',      label: 'Дедлайни',                 desc: 'За 24 години до дедлайну; для прострочених — у день дедлайну, наступного дня і далі щотижня' },
          { key: 'chatMessage',   label: 'Повідомлення в чаті',      desc: 'Нові повідомлення в каналах і особистих чатах' },
        ].filter(row => NOTIFICATION_EVENTS.some(event => event.key === row.key));

        // Every line is the shared <Row>, so all three cards land on the same
        // label column and the same right-hand control column.
        const channelCard = ({ id, icon: ChannelIcon, title, caption, master, available, offNote, showDesc = false, footer = null }) => (
          <Card preset="borderless" padding="lg">
            <div className="flex items-start justify-between gap-4 pb-1">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-canvas">
                  <ChannelIcon size={16} className="text-ink" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-ink leading-none">{title}</p>
                  {caption && <p className="mt-[5px] text-[12px] text-muted truncate">{caption}</p>}
                </div>
              </div>
              {master && <div className="shrink-0 pt-[6px]">{master}</div>}
            </div>

            {available ? eventRows.map(row => (
              <Row key={row.key} label={row.label} desc={showDesc ? row.desc : undefined}>
                <ToggleSwitch
                  checked={notifMatrix[id][row.key] === true}
                  onChange={value => setChannelEvent(id, row.key, value)}
                  size="sm"
                  ariaLabel={`${row.label} — ${title}`}
                />
              </Row>
            )) : (
              <p className="py-[14px] text-[12px] leading-relaxed text-faint">{offNote}</p>
            )}

            {footer}
          </Card>
        );

        return (
          <Section title="Сповіщення" desc="Кожен канал окремо: обери, про що він тебе повідомляє" rightAction={saveButton}>
            {channelCard({
              id: 'inapp',
              icon: Bell,
              title: 'На сайті',
              caption: 'Дзвіночок у шапці робочого простору',
              available: true,
              showDesc: true,
              footer: (
                <div className="mt-1 border-t border-line pt-1">
                  <Row label="Звук" desc="Короткий сигнал при новому сповіщенні">
                    <ToggleSwitch checked={notif.sound} onChange={v => setNotif(p => ({ ...p, sound: v }))} size="sm" />
                  </Row>
                  <Row label="Спливаючі сповіщення" desc="Картка внизу екрана, коли подія стається в реальному часі">
                    <ToggleSwitch checked={notif.popup} onChange={v => setNotif(p => ({ ...p, popup: v }))} size="sm" />
                  </Row>
                </div>
              ),
            })}

            {channelCard({
              id: 'email',
              icon: Mail,
              title: 'Email',
              caption: currentUser?.email || 'Пошта не вказана',
              available: notif.emailEnabled === true,
              offNote: 'Канал вимкнено — увімкни, щоб обрати, що дублювати на пошту.',
              master: (
                <ToggleSwitch
                  checked={notif.emailEnabled === true}
                  onChange={v => setNotif(p => ({ ...p, emailEnabled: v }))}
                  size="sm"
                  ariaLabel="Сповіщення на пошту"
                />
              ),
            })}

            {channelCard({
              id: 'telegram',
              icon: Send,
              title: 'Telegram',
              caption: telegramBotStatus.connected
                ? `Підключено: ${telegramBotStatus.chatTitle || 'особистий чат із ботом'}`
                : telegramAwaitingLink
                  ? 'Натисніть «Старт» у Telegram — підключиться саме'
                  : telegramBotStatus.configured
                    ? 'Не підключено'
                    : 'Інтеграцію не налаштовано в цьому середовищі',
              available: telegramBotStatus.connected && notif.telegramEnabled === true,
              offNote: telegramBotStatus.configured
                ? 'Увімкни канал — відкриється бот. Після «Старт» тут зʼявиться список подій.'
                : telegramBotStatus.connected
                  ? 'Акаунт уже підключений у production. Його можна відключити і з localhost.'
                  : 'Інтеграцію не налаштовано в цьому середовищі.',
              master: (
                <ToggleSwitch
                  checked={telegramBotStatus.connected && notif.telegramEnabled === true}
                  onChange={toggleTelegram}
                  disabled={
                    telegramBotLoading ||
                    telegramAwaitingLink ||
                    (!telegramBotStatus.configured && !telegramBotStatus.connected)
                  }
                  size="sm"
                  ariaLabel="Сповіщення в Telegram"
                />
              ),
            })}
          </Section>
        );
      }

      // ──────────────────────────────────────────────────────────────
      case 'localization': {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        
        const hours24Num = now.getHours();
        const mins = String(now.getMinutes()).padStart(2, '0');
        const hours24Str = String(hours24Num).padStart(2, '0');
        const hours12Num = hours24Num % 12 || 12;
        const ampm = hours24Num >= 12 ? 'PM' : 'AM';
        
        const COMMON_TIMEZONES = [
          'UTC',
          'Pacific/Midway',
          'Pacific/Honolulu',
          'America/Anchorage',
          'America/Los_Angeles',
          'America/Denver',
          'America/Chicago',
          'America/New_York',
          'America/Caracas',
          'America/Buenos_Aires',
          'America/Sao_Paulo',
          'Atlantic/South_Georgia',
          'Atlantic/Azores',
          'Europe/London',
          'Europe/Paris',
          'Europe/Berlin',
          'Europe/Kyiv',
          'Europe/Helsinki',
          'Europe/Istanbul',
          'Asia/Jerusalem',
          'Asia/Dubai',
          'Asia/Tehran',
          'Asia/Kabul',
          'Asia/Karachi',
          'Asia/Kolkata',
          'Asia/Kathmandu',
          'Asia/Dhaka',
          'Asia/Yangon',
          'Asia/Bangkok',
          'Asia/Shanghai',
          'Asia/Hong_Kong',
          'Asia/Tokyo',
          'Australia/Perth',
          'Australia/Adelaide',
          'Australia/Sydney',
          'Pacific/Noumea',
          'Pacific/Auckland',
          'Pacific/Fiji',
          'Pacific/Tongatapu'
        ];

        const tzOptions = COMMON_TIMEZONES.map(tz => {
          try {
            const date = new Date();
            const timeStr = date.toLocaleTimeString('uk-UA', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
            let gmtStr = '';
            try {
              const str = date.toLocaleString('en-GB', { timeZone: tz, timeZoneName: 'shortOffset' });
              const match = str.match(/GMT([+-]\d+(?::\d+)?)/);
              gmtStr = match ? `GMT${match[1]}` : 'GMT+0';
            } catch (e) {}
            
            return { value: tz, label: `${tz} (${gmtStr}, ${timeStr})` };
          } catch(e) {
            return { value: tz, label: tz };
          }
        });

        return (
        <Section title="Локалізація та регіон" desc="Налаштуйте відображення дати, часу та формату календаря відповідно до вашого регіону" rightAction={saveButton}>
          <Card preset="borderless" padding="lg">
            <Row label="Мова інтерфейсу" desc="Наразі інтерфейс доступний лише українською">
              <Select
                value={language}
                onChange={setLanguage}
                disabled
                options={[
                  { value: 'ua', label: 'Українська' }
                ]}
                className="w-full sm:w-[240px]"
              />
            </Row>
            <Row label="Формат дати" desc="Оберіть зручний формат представлення дати">
              <Select
                value={dateFormat}
                onChange={setDateFormat}
                options={[
                  { value: 'DD.MM.YYYY', label: `DD.MM.YYYY (${dd}.${mm}.${yyyy})` },
                  { value: 'YYYY-MM-DD', label: `YYYY-MM-DD (${yyyy}-${mm}-${dd})` },
                  { value: 'MM/DD/YYYY', label: `MM/DD/YYYY (${mm}/${dd}/${yyyy})` }
                ]}
                className="w-full sm:w-[240px]"
              />
            </Row>
            <Row label="Перший день тижня" desc="Перший день тижня в сітці календаря (DatePicker)">
              <Select
                value={firstDayOfWeek}
                onChange={setFirstDayOfWeek}
                options={[
                  { value: 'Monday', label: 'Понеділок' },
                  { value: 'Sunday', label: 'Неділя' }
                ]}
                className="w-full sm:w-[240px]"
              />
            </Row>
            <Row label="Формат часу" desc="Виберіть між 24-годинним або 12-годинним форматом відображення">
              <Select
                value={timeFormat}
                onChange={setTimeFormat}
                options={[
                  { value: '24h', label: `24-годинний (${hours24Str}:${mins})` },
                  { value: '12h', label: `12-годинний (${hours12Num}:${mins} ${ampm})` }
                ]}
                className="w-full sm:w-[240px]"
              />
            </Row>
            <Row label="Часовий пояс" desc="Поточний регіональний час для планування">
              <Select
                value={timezone}
                onChange={setTimezone}
                options={tzOptions}
                className="w-full sm:w-[240px]"
              />
            </Row>
          </Card>
        </Section>
      );
      }

      // ──────────────────────────────────────────────────────────────
      case 'workspace': {
        const handleBrandingToggle = (val) => { setOrgCustomBranding(val); persistBranding({ orgCustomBranding: val }); };
        const handleThemeChange = (newTheme) => { setSidebarTheme(newTheme); persistBranding({ sidebarTheme: newTheme }); };
        const handleColorChange = (newColor) => {
          setSidebarColor(newColor);
          if (brandColorTimer.current) clearTimeout(brandColorTimer.current);
          brandColorTimer.current = setTimeout(() => persistBranding({ sidebarColor: newColor }), 400);
        };

        const THEME_OPTIONS = [
          { id: 'dark',   label: 'Темна',     bg: SIDEBAR_PRESETS.dark },
          { id: 'light',  label: 'Світла',    bg: SIDEBAR_PRESETS.light },
          { id: 'custom', label: 'Ваш колір', bg: sidebarColor },
        ];

        return (
        <Section title="Загальні" desc="Загальні налаштування вашої організації" rightAction={saveButton}>
          {/* Zone 1: Organization */}
          <Card preset="borderless" padding="lg">
            <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">Організація</p>
            <Row label="Назва організації" desc="Видима всім у вашій організації">
              <InlineEditField value={orgName} onChange={setOrgName} saved={org?.name || ''} onSave={saveOrgName} className="w-[260px]" />
            </Row>
            <Row label="Логотип організації" desc="Зображення для вашої організації (рекомендовано 1:1)">
              <ImageUpload
                value={orgLogo}
                storagePath={orgLogoStoragePath}
                resourceType={orgLogoResourceType}
                organizationId={activeOrgId}
                kind="logos"
                onChange={async (url, asset) => {
                  await persistBranding({
                    orgLogo: url,
                    orgLogoStoragePath: asset?.storagePath || '',
                    orgLogoResourceType: asset?.resourceType || '',
                  }, { rethrow: true });
                  setOrgLogo(url);
                  setOrgLogoStoragePath(asset?.storagePath || '');
                  setOrgLogoResourceType(asset?.resourceType || 'image');
                }}
                theme="light"
                showLabel={false}
                showHint={false}
              />
            </Row>
            {/* The organisation ID used to sit here, under "Загальні". Nothing
                on this screen asks for it: it is an argument to an API call,
                and the place to print it is the instructions that tell you to
                make that call. Settings is where you change what the
                organisation *is*, not where you look up its key. */}
          </Card>

          {/* Zone 2: Branding */}
          <Card preset="borderless" padding="lg" className={`transition-opacity ${!orgLogo ? 'opacity-50 pointer-events-none' : ''}`}>
            <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">Брендинг</p>
            {!orgLogo && (
              <p className="text-[12px] text-muted mb-3">Завантажте логотип організації, щоб розблокувати налаштування брендингу</p>
            )}
            <Row label="Брендинг у сайдбарі" desc="Замінити логотип QuickTeam на логотип вашої організації для всіх учасників">
              <div className="flex items-center gap-[12px]">
                {/* Show org logo preview when branding is on */}
                {orgCustomBranding && orgLogo && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={orgLogo}
                    alt="Логотип"
                    className="w-[32px] h-[32px] rounded-[8px] object-cover border border-line"
                  />
                )}
                <ToggleSwitch
                  checked={orgCustomBranding}
                  onChange={handleBrandingToggle}
                  disabled={!orgLogo}
                />
              </div>
            </Row>

            {/* Theme picker — visible only when branding is ON */}
            {orgCustomBranding && orgLogo && (
              <>
                <div className="pt-[12px]">
                  <p className="text-[13px] font-medium text-ink mb-[2px]">Тема сайдбару</p>
                  <p className="text-[12px] text-muted mb-[12px]">Оберіть колірну схему бічної панелі</p>
                  <div className="flex flex-wrap gap-[16px]">
                    {THEME_OPTIONS.map(opt => {
                      const isActive = sidebarTheme === opt.id;
                      const isCustomUnselected = opt.id === 'custom' && !isActive;

                      const buttonNode = (
                        <label
                          key={opt.id}
                          className="flex cursor-pointer flex-col items-center gap-[6px] group/theme"
                        >
                          <ColorSwatch
                            size="theme"
                            selected={isActive}
                            label={opt.label}
                            onClick={() => handleThemeChange(opt.id)}
                            color={isCustomUnselected
                              ? 'conic-gradient(#ef4444, #f59e0b, #22c55e, #3b82f6, #8b5cf6, #ec4899, #ef4444)'
                              : opt.bg}
                          />
                          <span className={`text-[11px] font-medium transition-colors ${isActive ? 'text-ink' : 'text-muted group-hover/theme:text-ink'}`}>{opt.label}</span>
                        </label>
                      );

                      if (opt.id === 'custom') {
                        return (
                          <Popover
                            key={opt.id}
                            position="top"
                            trigger={buttonNode}
                            hideCloseIcon
                          >
                            {({ close }) => (
                              <div className="flex flex-col gap-[16px] w-[220px]">
                                <Colorful
                                  color={sidebarColor}
                                  onChange={(color) => handleColorChange(color.hex)}
                                  disableAlpha={true}
                                />
                                <div className="flex items-center gap-[10px]">
                                  <div
                                    className="w-[28px] h-[28px] rounded-[6px] shrink-0 border border-line"
                                    style={{ backgroundColor: sidebarColor }}
                                  />
                                  <Input
                                    value={sidebarColor}
                                    onChange={e => {
                                      const v = e.target.value;
                                      setSidebarColor(v);
                                      if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) {
                                        handleColorChange(v);
                                      }
                                    }}
                                    composition="color-hex"
                                    size="md"
                                    placeholder="#1a365d"
                                  />
                                </div>
                                {/* «Скасувати» повертає збережений колір організації;
                                    хрестика зверху немає — він наїжджав на пікер */}
                                <div className="flex gap-[8px]">
                                  <Button
                                    style="secondary" size="sm" className="flex-1"
                                    onClick={() => { handleColorChange(org?.sidebarColor || '#1f1f1f'); close(); }}
                                  >
                                    Скасувати
                                  </Button>
                                  <Button style="primary" size="sm" className="flex-1" onClick={close}>
                                    Готово
                                  </Button>
                                </div>
                              </div>
                            )}
                          </Popover>
                        );
                      }

                      return buttonNode;
                    })}
                  </div>
                </div>
              </>
            )}
          </Card>
        </Section>
      );
      }



      // ──────────────────────────────────────────────────────────────
      case 'migration':
        return (
          <Section
            title="Перенесення даних"
            desc="Перенесіть робочі проєкти та історію команди у QuickTeam"
          >
            <DataMigrationSettings
              organizationId={activeOrgId}
              members={members}
              projects={projects}
              showToast={showToast}
            />
          </Section>
        );

      case 'integrations': {
        const buggyBagKey = apiKeys.find(k => k.name === 'BuggyBag Integration');
        const buggyBagEnabled = !!buggyBagKey;

        const toggleBuggyBag = async (enabled) => {
          if (!activeOrgId) return;
          setBuggyBagLoading(true);
          try {
            if (enabled) {
              const { key } = await apiKeysRequest('POST', { name: 'BuggyBag Integration' });
              const updatedKeys = [...apiKeys, key];
              setApiKeys(updatedKeys);
              showToast('Інтеграцію з BuggyBag увімкнено!');
            } else if (buggyBagKey) {
              const updatedKeys = apiKeys.filter(k => k.id !== buggyBagKey.id);
              await apiKeysRequest('DELETE', { keyId: buggyBagKey.id });
              setApiKeys(updatedKeys);
              showToast('Інтеграцію з BuggyBag вимкнено');
            }
            return true;
          } catch (error) {
            showToast(error?.message || 'Не вдалося оновити інтеграцію BuggyBag', 'error');
            return false;
          } finally {
            setBuggyBagLoading(false);
          }
        };

        const integrationRows = [
          {
            id: 'quickteam-plus',
            title: 'QuickTeam+',
            description: 'Клієнтські запити та оновлення з порталу.',
            logo: '/quickteam.png',
            status: qtEnabled ? 'Підключено' : 'Вимкнено',
            active: qtEnabled,
          },
          {
            id: 'telegram',
            title: 'Telegram',
            description: 'Створення задач із робочої Telegram-групи.',
            logo: '/integrations/telegram.svg',
            status: telegramGroupStatus.connected
              ? 'Підключено'
              : telegramGroupStatus.configured ? 'Не підключено' : 'Недоступно',
            active: telegramGroupStatus.connected,
          },
          {
            id: 'buggybag',
            title: 'BuggyBag Portal',
            description: 'Баг-репорти клієнтів як задачі QuickTeam.',
            logo: '/bug-logo.png',
            status: buggyBagEnabled ? 'Підключено' : 'Вимкнено',
            active: buggyBagEnabled,
          },
        ];

        if (!integrationDetail) {
          return (
            <Section title="Інтеграції" desc="Підключені сервіси та доступні канали">
              <div className="flex flex-col gap-[8px]">
                {integrationRows.map(item => (
                  <Card
                    key={item.id}
                    preset="bordered"
                    padding="md"
                    interactive
                    onClick={() => setIntegrationDetail(item.id)}
                  >
                    <div className="flex items-center gap-[12px]">
                      <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-line bg-white">
                        <Image src={item.logo} alt="" width={30} height={30} className="h-[28px] w-[28px] object-contain" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-bold text-ink">{item.title}</span>
                        <span className="mt-[2px] block truncate text-[11px] text-muted">{item.description}</span>
                      </span>
                      <Pill color={item.active ? '#10b981' : '#9a9a9a'} size="md" appearance="soft-outline">
                        {item.status}
                      </Pill>
                      <ChevronRight size={16} className="shrink-0 text-faint" />
                    </div>
                  </Card>
                ))}
              </div>
            </Section>
          );
        }

        const integrationTitle = integrationRows.find(item => item.id === integrationDetail)?.title || 'Інтеграція';

        return (
          <Section
            title={integrationTitle}
            desc="Опис, стан і налаштування інтеграції"
            rightAction={(
              <>
                <Button style="ghost" size="sm" icon={ArrowLeft} onClick={() => setIntegrationDetail('')}>
                  Усі інтеграції
                </Button>
                {saveButton}
              </>
            )}
          >

            {integrationDetail === 'quickteam-plus' && <IntegrationCard
              title="QuickTeam+"
              description="Синхронізує клієнтські запити та оновлення з порталу QuickTeam+."
              logoSrc="/quickteam.png"
              logoAlt="QuickTeam+"
              enabled={qtEnabled}
              onToggle={saveIntegration}
              toggleDisabled={qtSaving}
              status={qtEnabled ? 'connected' : 'off'}
              statusLabel={qtEnabled ? 'Підключено' : 'Вимкнено'}
              statusMeta={qtEnabled && PORTAL_URL ? (
                <a
                  href={PORTAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[12px] font-semibold text-ink hover:underline"
                >
                  Відкрити портал <ExternalLink size={11} />
                </a>
              ) : null}
            />}

            {/* Telegram bot — group task capture */}
            {integrationDetail === 'telegram' && <IntegrationCard
              title="Telegram"
              description="Створюйте задачі прямо з робочої Telegram-групи та автоматично додавайте їх у вибраний проєкт."
              logoSrc="/integrations/telegram.svg"
              logoAlt="Telegram"
              enabled={telegramGroupStatus.connected || telegramGroupSetupOpen}
              onToggle={toggleTelegramGroup}
              toggleDisabled={
                telegramGroupLoading ||
                (!telegramGroupStatus.configured && !telegramGroupStatus.connected)
              }
              status={telegramGroupStatus.connected ? 'connected' : telegramGroupSetupOpen ? 'pending' : telegramGroupStatus.configured ? 'off' : 'unavailable'}
              statusLabel={telegramGroupStatus.connected ? 'Підключено' : telegramGroupSetupOpen ? 'Налаштування' : telegramGroupStatus.configured ? 'Вимкнено' : 'Недоступно'}
              statusMeta={telegramGroupStatus.connected ? (
                <span className="text-[12px] text-muted">
                  {telegramGroupStatus.chatTitle || 'Telegram-група'}
                  {telegramGroupProjectId && projects.find(project => project.id === telegramGroupProjectId)?.name
                    ? ` → ${projects.find(project => project.id === telegramGroupProjectId).name}`
                    : ''}
                </span>
              ) : !telegramGroupStatus.configured ? (
                <span className="text-[11px] text-muted">Інтеграцію не налаштовано в цьому середовищі.</span>
              ) : null}
            >
              {telegramGroupStatus.connected ? (
                <div className="space-y-3">
                  <IntegrationNote title="Як створити задачу в групі">
                    <p><IntegrationCode>/task Назва задачі</IntegrationCode> — швидка команда.</p>
                    <p>
                      <IntegrationCode>
                        @{telegramGroupStatus.username || 'quick_team_bot'} Назва задачі
                      </IntegrationCode>
                      {' '}— звичайне звернення до бота.
                    </p>
                    <p>Наступні рядки повідомлення стануть описом задачі.</p>
                  </IntegrationNote>
                  <Button
                    style="ghost"
                    size="sm"
                    icon={RefreshCw}
                    onClick={() => refreshTelegramGroup().catch(error => showToast(error.message, 'error'))}
                  >
                    Перевірити підключення
                  </Button>
                </div>
              ) : telegramGroupSetupOpen ? (
                <IntegrationSteps
                  steps={[
                    {
                      title: 'Оберіть проєкт QuickTeam',
                      description: 'Усі нові задачі з цієї Telegram-групи потраплятимуть саме сюди.',
                      content: (
                        <div className="mt-2 max-w-[420px]">
                          <Select
                            value={telegramGroupProjectId}
                            onChange={setTelegramGroupProjectId}
                            options={[
                              { value: '', label: 'Оберіть проєкт' },
                              ...projects.filter(project => project.status !== 'archived').map(project => ({ value: project.id, label: project.name })),
                            ]}
                          />
                        </div>
                      ),
                    },
                    {
                      title: 'Додайте бота в Telegram-групу',
                      description: 'Telegram відкриється в новій вкладці. Виберіть потрібну групу та підтвердьте додавання.',
                      content: (
                        <Button
                          style="secondary"
                          size="sm"
                          icon={ExternalLink}
                          className="mt-2"
                          onClick={connectTelegramGroup}
                          loading={telegramGroupLoading}
                          disabled={!telegramGroupProjectId}
                        >
                          Відкрити Telegram
                        </Button>
                      ),
                    },
                    {
                      title: 'Підтвердьте групу командою',
                      description: telegramGroupConnect?.command
                        ? 'Скопіюйте одноразову команду та надішліть її в доданій групі протягом 30 хвилин.'
                        : 'Після додавання бота тут з’явиться одноразова команда.',
                      content: telegramGroupConnect?.command ? (
                        <IntegrationNote className="mt-2 max-w-[620px]">
                          <div className="flex items-center gap-2">
                          <IntegrationCode className="min-w-0 flex-1 select-all break-all">{telegramGroupConnect.command}</IntegrationCode>
                          <Button
                            style="ghost"
                            size="icon-sm"
                            icon={Copy}
                            onClick={() => {
                              navigator.clipboard.writeText(telegramGroupConnect.command);
                              showToast('Команду скопійовано');
                            }}
                            aria-label="Копіювати команду"
                          />
                          </div>
                        </IntegrationNote>
                      ) : null,
                    },
                    {
                      title: 'Перевірте підключення',
                      description: 'Після надсилання команди поверніться сюди. QuickTeam покаже назву групи та готовий приклад команди.',
                      content: (
                        <Button
                          style="ghost"
                          size="sm"
                          icon={RefreshCw}
                          className="mt-2"
                          onClick={() => refreshTelegramGroup().catch(error => showToast(error.message, 'error'))}
                        >
                          Перевірити
                        </Button>
                      ),
                    },
                  ]}
                />
              ) : null}
            </IntegrationCard>}

            {/* BuggyBag Portal */}
            {integrationDetail === 'buggybag' && <IntegrationCard
              title="BuggyBag Portal"
              description="Перетворює баг-репорти клієнтів на задачі QuickTeam разом зі скріншотами та технічними даними."
              logoSrc="/bug-logo.png"
              logoAlt="BuggyBag"
              enabled={buggyBagEnabled}
              onToggle={toggleBuggyBag}
              toggleDisabled={buggyBagLoading}
              status={buggyBagEnabled ? 'connected' : 'off'}
              statusLabel={buggyBagEnabled ? 'Підключено' : 'Вимкнено'}
              statusMeta={(
                <a
                  href="https://buggy-bag.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[12px] font-semibold text-ink hover:underline"
                >
                  Відкрити BuggyBag <ExternalLink size={11} />
                </a>
              )}
            >
              {buggyBagEnabled && (
                <IntegrationNote title="Вставте ці дані в налаштуваннях BuggyBag">
                  <div className="grid items-center gap-3 sm:grid-cols-[100px_1fr]">
                    <span>API Token</span>
                    <div className="flex min-w-0 items-center gap-2">
                      <IntegrationCode className="min-w-0 flex-1 select-all truncate">
                        {buggyBagKey.token || `${buggyBagKey.prefix || 'qt_'}••••••••••••••••`}
                      </IntegrationCode>
                      {buggyBagKey.token && (
                        <Button onClick={() => { navigator.clipboard.writeText(buggyBagKey.token); showToast('Токен скопійовано'); }} style="ghost" size="icon-sm" icon={Copy} aria-label="Копіювати API Token" />
                      )}
                    </div>
                    <span>Org ID</span>
                    <div className="flex min-w-0 items-center gap-2">
                      <IntegrationCode className="min-w-0 flex-1 select-all truncate">{activeOrgId}</IntegrationCode>
                      <Button onClick={() => { navigator.clipboard.writeText(activeOrgId); showToast('ID скопійовано'); }} style="ghost" size="icon-sm" icon={Copy} aria-label="Копіювати ID організації" />
                    </div>
                  </div>
                </IntegrationNote>
              )}
            </IntegrationCard>}
          </Section>
        );
      }

      // ──────────────────────────────────────────────────────────────
      case 'billing': {
        const isPro = orgPlan === 'pro';
        const projectLimit = isPro ? Infinity : 3;
        const projectsPercent = isPro ? 100 : Math.min(100, (projectsCount / projectLimit) * 100);

        return (
          <Section title="Тарифний план" desc="Управління підпискою та лімітами організації" rightAction={saveButton}>
            <Card preset="bordered" padding="none" className="overflow-hidden transition-all">
              <div className={`bg-white px-6 py-6 border-b border-line`}>
                <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <Pill appearance="outline" shape="badge" size="md" uppercase className="mb-3">
                      {isPro ? 'PRO PLAN' : 'FREE PLAN'}
                    </Pill>
                    <h3 className="ui-type-detail-title text-ink mb-1">{isPro ? 'Професійний тариф' : 'Безкоштовний тариф'}</h3>
                    <p className="text-[13px] text-muted">{isPro ? 'Безлімітні проєкти та всі функції розблоковано' : 'Використовується для тестування (Demo)'}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-[32px] font-black text-ink leading-none mb-1">{isPro ? '$15' : '$0'}<span className="text-[14px] text-faint font-medium">/міс</span></p>
                  </div>
                </div>
              </div>
              
              <div className="px-6 py-5">
                <p className="text-[12px] font-bold text-muted uppercase tracking-wider mb-4">Ліміти плану</p>
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="flex items-center justify-between text-[13px] font-medium mb-2">
                      <span className="text-[#4a4a4a]">Учасники команди</span>
                      <span className="text-ink">{members.length} / Необмежено</span>
                    </div>
                    <div className="h-[6px] bg-[#f0f0f0] rounded-full overflow-hidden">
                      <div className="h-full bg-[#10b981] rounded-full" style={{ width: '15%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[13px] font-medium mb-2">
                      <span className="text-[#4a4a4a]">Активні проєкти</span>
                      <span className="text-ink">{projectsCount} / {isPro ? 'Необмежено' : projectLimit}</span>
                    </div>
                    <div className="h-[6px] bg-[#f0f0f0] rounded-full overflow-hidden">
                      <div className={`h-full ${isPro ? 'bg-[#10b981]' : (projectsCount >= projectLimit ? 'bg-[#ef4444]' : 'bg-[#eab308]')} rounded-full transition-all`} style={{ width: `${projectsPercent}%` }} />
                    </div>
                    {!isPro && projectsCount >= projectLimit && (
                      <p className="text-[11px] text-[#ef4444] mt-1 font-medium">Ліміт досягнуто. Перейдіть на Pro для створення нових проєктів.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-[#fcfcfc] border-t border-line flex justify-end">
                {isPro ? (
                  <Button onClick={() => handleUpgradePlan('free')} disabled={upgrading} loading={upgrading} style="secondary" size="lg">
                    {upgrading ? 'Завантаження...' : 'Скасувати підписку'}
                  </Button>
                ) : (
                  <Button onClick={() => handleUpgradePlan('pro')} disabled={upgrading} loading={upgrading} style="primary" size="lg">
                    {upgrading ? 'Оновлення...' : 'Оновити до PRO'}
                  </Button>
                )}
              </div>
            </Card>
          </Section>
        );
      }

      // ──────────────────────────────────────────────────────────────
      // Everyone may see who is on the team; only owners and admins may change
      // anything about them. Both controls used to render for everyone, and
      // both lead to a wall: the invitations route requires owner/admin, and
      // the member dialog disables every field it contains. A control that
      // cannot do anything is not a disabled control, it is the wrong control.
      case 'team': return (
        <Section title="Учасники команди" rightAction={isAdmin ? (
          <Button onClick={() => setShowInviteModal(true)} style="primary" size="md" icon={Plus}>Запросити</Button>
        ) : null}>
          <Surface preset="card" padding="none" className="overflow-hidden relative z-10">
            <div className="flex flex-col divide-y divide-[#f0f0f0] rounded-[16px]">
              {members.map((member, i) => {
                const isMe = member.id === (currentUser?.uid || currentUser?.id);
                const positionLabel = positions.find(position => position.id === member.positionId)?.label || 'Без посади';
                return (
                  <div key={member.id} className={`flex items-center justify-between gap-4 px-5 py-4 hover:bg-[#fcfcfc] transition-colors ${i === 0 ? 'rounded-t-[16px]' : ''} ${i === members.length - 1 ? 'rounded-b-[16px]' : ''}`}>
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar user={member} size="lg" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[14px] font-bold text-ink">{member.name || member.email}</p>
                          {isMe && <Pill shape="badge" size="sm" uppercase>Ти</Pill>}
                        </div>
                        <p className="truncate text-[12px] text-muted">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Pill size="lg" className="hidden sm:inline-flex">{positionLabel}</Pill>
                      <Pill tone="ink-subtle" size="lg">{ROLE_LABELS[member.role] || member.role}</Pill>
                      {isAdmin && (
                        <Button
                          onClick={() => setMemberSettingsId(member.id || member.uid)}
                          style="secondary"
                          size="icon"
                          icon={SlidersHorizontal}
                          title="Налаштувати учасника"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Surface>
        </Section>
      );

      // ──────────────────────────────────────────────────────────────
      case 'statuses': {
        const closingStatuses = statuses.filter(s => isClosingCategory(s.category));
        const openStatuses = statuses.filter(s => !isClosingCategory(s.category));
        const statusAnnouncements = createUkrainianDndAnnouncements({
          itemLabel: draggableId => statuses.find(status => status.id === draggableId)?.label || 'Статус',
          listLabel: categoryId => STATUS_CATEGORIES[categoryId]?.label || 'Категорія статусів',
        });
        // The last status that closes a task and the last one that stays open
        // cannot be deleted — the same two invariants the drag guard enforces,
        // shown as a disabled control rather than a refusal after the click.
        const canDeleteStatus = status => (
          statuses.filter(s => !s.isNew).length > 1
          && !(isClosingCategory(status.category) && closingStatuses.length === 1)
          && !(!isClosingCategory(status.category) && openStatuses.length === 1)
        );
        return (
        <Section title="Статуси завдань" desc="Налаштуйте етапи, через які проходять завдання.">
          {wfLoading ? (
            <div className="py-12 flex items-center justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : (
            <Card preset="borderless">
              <DragDropContext
                dragHandleUsageInstructions={UKRAINIAN_DRAG_HANDLE_USAGE_INSTRUCTIONS}
                onDragStart={statusAnnouncements.onDragStart}
                onDragUpdate={statusAnnouncements.onDragUpdate}
                onDragEnd={(result, provided) => {
                  statusAnnouncements.onDragEnd(result, provided);
                  handleStatusDragEnd(result);
                }}
              >
                {STATUS_CATEGORY_IDS.map((categoryId, categoryIndex) => {
                  const category = STATUS_CATEGORIES[categoryId];
                  const CategoryIcon = STATUS_CATEGORY_ICONS[categoryId];
                  const items = statusesByCategory.get(categoryId) || [];
                  return (
                    <section
                      key={categoryId}
                      className={categoryIndex > 0 ? 'mt-5 border-t border-line pt-5' : ''}
                    >
                      <header className="mb-2 flex items-center gap-[10px]">
                        <CategoryIcon
                          size={16}
                          strokeWidth={2}
                          style={{ color: category.color }}
                          className="shrink-0"
                          aria-hidden
                        />
                        <h3 className="min-w-0 flex-1 ui-type-card-title text-ink">{category.label}</h3>
                        <Button
                          onClick={() => handleAddStatus(categoryId)}
                          style="ghost"
                          size="icon"
                          icon={Plus}
                          title={`Додати статус у «${category.label}»`}
                          aria-label={`Додати статус у «${category.label}»`}
                        />
                      </header>
                      <Droppable droppableId={categoryId}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`rounded-[12px] transition-colors ${
                              snapshot.isDraggingOver ? 'bg-canvas' : ''
                            }`}
                          >
                            {items.map((s, i) => (
                              <Draggable key={s.id || `new-${i}`} draggableId={s.id || `new-${i}`} index={i}>
                                {(dragProvided) => (
                                  <WorkflowItem item={s}
                                    onSave={stA.onSave} onDelete={handleStatusDeleteClick}
                                    canDelete={canDeleteStatus(s)}
                                    variant="status"
                                    provided={dragProvided}
                                  />
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                            {items.length === 0 && !snapshot.isDraggingOver && (
                              <p className="px-[8px] py-[10px] text-[12px] text-faint">
                                Немає статусів. Перетягніть сюди статус або натисніть «+».
                              </p>
                            )}
                          </div>
                        )}
                      </Droppable>
                    </section>
                  );
                })}
              </DragDropContext>
            </Card>
          )}
          {!wfLoading && renderWorkflowResetFooter()}
        </Section>
        );
      }

      // QUI-130. The epic sentence outlived the epics: the type was removed and
      // migrated away, so the only thing it still explained was itself.
      case 'types': {
        const addType = () => setTypes(current => [
          ...current,
          {
            id: `t-${Date.now()}`,
            label: '',
            color: '#8b5cf6',
            icon: 'star',
            isNew: true,
          },
        ]);
        return (
        <Section title="Типи завдань" desc="Налаштуйте доступні типи завдань.">
          {wfLoading ? (
            <div className="py-12 flex items-center justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : (
            <Card preset="borderless">
              {types.map(t => (
                <WorkflowItem
                  key={t.id}
                  item={t}
                  onSave={tpA.onSave}
                  onDelete={tpA.onDelete}
                  canDelete={!isSystemTaskTypeId(t.id)}
                  locked={isSystemTaskTypeId(t.id)}
                  variant="type"
                  typeSuggestions={DEFAULT_TYPES.filter(type => !types.some(current => current.id === type.id))}
                  onChooseTypeSuggestion={preset => setTypes(current => current.map(type => (
                    type.id === t.id ? { ...preset } : type
                  )))}
                />
              ))}
              <Button
                onClick={addType}
                style="ghost"
                size="lg"
                icon={Plus}
                composition="settings-row-action"
                className="mt-2"
              >
                Додати тип
              </Button>
            </Card>
          )}
          {!wfLoading && renderWorkflowResetFooter()}
        </Section>
        );
      }

      case 'priorities': {
        const priorityAnnouncements = createUkrainianDndAnnouncements({
          itemLabel: draggableId => priorities.find(priority => priority.id === draggableId)?.label || 'Пріоритет',
          listLabel: () => 'Пріоритети',
        });
        return (
        <Section title="Пріоритети завдань" desc="Налаштуйте рівні важливості завдань.">
          {wfLoading ? (
            <div className="py-12 flex items-center justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : (
            <Card preset="borderless">
              <WorkflowItem
                item={NO_PRIORITY}
                onSave={NOOP}
                onDelete={NOOP}
                canDelete={false}
                locked
                readOnly
                variant="priority"
                priorityItems={priorities}
              />
              <DragDropContext
                dragHandleUsageInstructions={UKRAINIAN_DRAG_HANDLE_USAGE_INSTRUCTIONS}
                onDragStart={priorityAnnouncements.onDragStart}
                onDragUpdate={priorityAnnouncements.onDragUpdate}
                onDragEnd={(result, provided) => {
                  priorityAnnouncements.onDragEnd(result, provided);
                  handlePriorityDragEnd(result);
                }}
              >
                <Droppable droppableId="workflow-priorities">
                  {provided => (
                    <div ref={provided.innerRef} {...provided.droppableProps}>
                      {priorities.map((pItem, index) => {
                        const locked = isSystemPriorityId(pItem.id);
                        return (
                          <Draggable key={pItem.id} draggableId={pItem.id} index={index} isDragDisabled={locked}>
                            {dragProvided => (
                              <WorkflowItem
                                item={pItem}
                                onSave={prA.onSave}
                                onDelete={prA.onDelete}
                                canDelete={!locked}
                                locked={locked}
                                variant="priority"
                                provided={dragProvided}
                                priorityItems={priorities}
                              />
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
              <Button
                onClick={() => setPriorities(current => {
                  const lowIndex = current.findIndex(item => item.id === 'low');
                  const next = [...current];
                  next.splice(lowIndex < 0 ? current.length : lowIndex, 0, {
                    id: `p-${Date.now()}`,
                    label: 'Новий пріоритет',
                    color: '#eab308',
                    isNew: true,
                  });
                  return next;
                })}
                style="ghost" size="lg"
                icon={Plus}
                composition="settings-row-action"
                className="mt-2"
              >
                Додати пріоритет
              </Button>
            </Card>
          )}
          {!wfLoading && renderWorkflowResetFooter()}
        </Section>
        );
      }

      case 'labels': return (
        <Section title="Мітки завдань" desc="Глобальні мітки для маркування завдань">
          {wfLoading ? (
            <div className="py-12 flex items-center justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : (
            <Card preset="borderless">
              {labels.map(l => (
                <WorkflowItem key={l.id} item={l} onSave={lbA.onSave} onDelete={lbA.onDelete} variant="label" />
              ))}
              <Button
                onClick={() => setLabels(p => [...p, { id: `l-${Date.now()}`, label: 'Нова мітка', color: '#db2777', isNew: true }])}
                style="ghost" size="lg"
                icon={Plus}
                composition="settings-row-action"
                className="mt-2"
              >
                Додати мітку
              </Button>
            </Card>
          )}
          {!wfLoading && renderWorkflowResetFooter()}
        </Section>
      );

      case 'positions': return (
        <Section title="Посади та ставки" desc="Погодинні ставки виконавців. Валюту обирають у рахунку — тут це просто число за годину">
          {wfLoading ? (
            <div className="py-12 flex items-center justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : (
            <Card preset="borderless">
              {positions.map(p => (
                <PositionItem key={p.id} item={p} onSave={posA.onSave} onDelete={posA.onDelete} />
              ))}
              <Button
                onClick={() => setPositions(p => [...p, { id: `pos-${Date.now()}`, label: 'Нова посада', hourlyRate: 0, isNew: true }])}
                style="ghost" size="lg"
                icon={Plus}
                composition="settings-row-action"
                className="mt-2"
              >
                Додати посаду
              </Button>
            </Card>
          )}
          {!wfLoading && renderWorkflowResetFooter()}
        </Section>
      );

      // ──────────────────────────────────────────────────────────────
      case 'danger': return (
        <Section title="Видалення даних" desc="Незворотні дії. Виконуйте обережно.">
          <Card preset="borderless" padding="lg">
            <Row label="Вийти з акаунту" desc="Завершити сесію на цьому пристрої">
              <Button
                onClick={async () => {
                  if (await confirmDialog({ title: 'Вийти з акаунта?', confirmText: 'Вийти', danger: true })) signOut();
                }}
                style="ghost" color="red" size="lg"
                icon={LogOut}
              >
                Вийти
              </Button>
            </Row>

            <Row label="Скинути налаштування процесів" desc="Повернути статуси, типи та пріоритети до стандартних значень">
              <Button
                onClick={async () => {
                  const resetOrganizationId = activeOrgId;
                  if (!(await confirmDialog({
                    title: 'Скинути всі workflow налаштування?',
                    message: 'Статуси, типи, пріоритети та мітки буде замінено стандартним набором QuickTeam. Цю дію не можна скасувати.',
                    confirmText: 'Скинути', cancelText: 'Залишити', danger: true,
                  }))) return;
                  if (
                    !resetOrganizationId
                    || wfOrgId.current !== resetOrganizationId
                  ) return;
                  setStatuses(DEFAULT_STATUSES);
                  setTypes(DEFAULT_TYPES);
                  setPriorities(DEFAULT_PRIORITIES);
                  setLabels(DEFAULT_LABELS);
                  // Auto-save persists these changes; no manual save needed.
                }}
                style="ghost" color="red" size="lg"
                icon={RefreshCw}
              >
                Скинути
              </Button>
            </Row>
            {isOwner && (
              <Row
                label="Видалення організації"
                desc="Тимчасово недоступне, доки не налаштовано безпечне каскадне видалення даних і файлів"
              >
                <Button style="secondary" color="red" size="lg" disabled>
                  Недоступно
                </Button>
              </Row>
            )}
          </Card>
        </Section>
      );

      // ──────────────────────────────────────────────────────────────
      case 'archives': {
        const archivedProjects = (projects || []).filter(p => p.status === 'archived');
        return (
          <Section title="Архів проєктів" desc="Перелік усіх архівованих проєктів організації з можливістю їх відновлення">
            <Card preset="borderless" padding="lg">
              {archivedProjects.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full bg-canvas flex items-center justify-center mb-3">
                    <Archive size={20} className="text-muted" />
                  </div>
                  <p className="text-[14px] font-bold text-ink">Немає архівованих проєктів</p>
                  <p className="text-[12px] text-muted mt-1">Тут відображатимуться всі архівовані проєкти організації</p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-canvas -my-3">
                  {archivedProjects.map(p => (
                    <div key={p.id} className="flex items-center justify-between py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-ink truncate">{p.name}</p>
                        {p.description && (
                          <p className="text-[12px] text-muted truncate mt-0.5">{p.description}</p>
                        )}
                      </div>
                      <Button
                        onClick={() => unarchiveProject(p.id)}
                        style="secondary"

                        size="sm"
                        icon={ArchiveRestore}
                        className="ml-4 shrink-0"
                      >
                        Розархівувати
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Section>
        );
      }

      default: return null;
    }
  };




  // ── Layout ───────────────────────────────────────────────────
  const allowedNav = NAV.filter(n => !n.adminOnly || isAdmin);

  const handleNavChange = async (id) => {
    const success = await handleSectionChange(id);
    if (success) setMobilePane('content');
  };

  const sidebarContent = (
    <InnerNavigation
      items={allowedNav}
      activeId={activeSection}
      onChange={handleNavChange}
    />
  );

  return (
    <SidebarLayout context="settings" sidebar={sidebarContent} hasBorder={false} mobilePane={mobilePane}>
      <main className="flex-1 overflow-y-auto custom-scrollbar bg-canvas relative">
        <div className="max-w-[760px] mx-auto px-[16px] py-[24px] md:px-[32px] md:py-[48px] min-h-full flex flex-col">
          <MobilePaneBack onClick={requestPaneClose} label="Всі налаштування" className="pb-[16px]" />
          <div className="flex-1 pb-[100px]">
            {renderSection()}
          </div>
        </div>
      </main>



      <InviteMemberDialog
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        inviteMember={inviteMember}
      />
      <TeamMemberSettingsDialog
        member={members.find(member => (member.id || member.uid) === memberSettingsId)}
        positions={positions}
        currentUserId={currentUser?.uid || currentUser?.id}
        isOwner={isOwner}
        isAdmin={isAdmin}
        onClose={() => setMemberSettingsId(null)}
        onRoleChange={handleRoleChange}
        onPositionChange={handlePositionChange}
        onTransferOwnership={async uid => {
          await handleTransferOwnership(uid);
          setMemberSettingsId(null);
        }}
        onRemove={async uid => {
          await handleRemoveMember(uid);
          setMemberSettingsId(null);
        }}
      />
    </SidebarLayout>
  );
}
