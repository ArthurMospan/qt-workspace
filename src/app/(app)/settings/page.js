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
import { auth, createGitHubProvider, db, googleProvider } from '@/lib/firebase';
import { linkWithPopup, unlink } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import {
  User, Bell, Shield, Zap, Users, GitBranch,
  Shapes, Check, Plus, Trash2, Edit2, X, Save,
  Building, LogOut, Download, RefreshCw, Mail,
  Copy, ExternalLink, ChevronRight, AlertTriangle, ArrowLeft,
  Link2, PlugZap, ToggleLeft, ToggleRight, Receipt, CreditCard,
  Globe, Tag as TagIcon, Briefcase, GripVertical, Send,
  Archive, ArchiveRestore, Bug, SlidersHorizontal, DatabaseBackup
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
  LoadingSpinner, 
  SidebarLayout, 
  InnerNavigation, 
  PageHeader,
  Dialog,
  DatePicker,
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
import IntegrationCard, { IntegrationSteps } from '@/components/integrations/IntegrationCard';
import DataMigrationSettings from '@/components/migrations/DataMigrationSettings';
import {
  getDoneStatusIds,
  DEFAULT_STATUSES,
  DEFAULT_TYPES,
  DEFAULT_PRIORITIES,
  DEFAULT_LABELS,
  DEFAULT_POSITIONS,
} from '@/lib/hooks/useWorkflowConfig';

// ── Constants ────────────────────────────────────────────────────────
const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || '';
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
    <div className="flex items-center justify-between gap-6 py-[12px]">
      <div className="min-w-0 flex-1">
        <p className={`text-[13px] font-medium leading-snug ${danger ? 'text-red-600' : 'text-ink'}`}>{label}</p>
        {desc && <p className={`text-[12px] mt-[2px] leading-relaxed ${danger ? 'text-red-400' : 'text-muted'}`}>{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Section({ title, desc, rightAction, children }) {
  return (
    <div className="flex flex-col">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] font-bold text-ink tracking-tight">{title}</h2>
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
    <div className={`relative ${className}`}>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          else if (e.key === 'Escape' && dirty) onChange(saved ?? '');
        }}
        className={dirty ? '!pr-[54px]' : ''}
      />
      {dirty && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 z-10">
          <button
            type="button" onClick={commit} disabled={saving} title="Зберегти"
            className="w-[24px] h-[24px] flex items-center justify-center rounded-[7px] bg-ink text-white hover:bg-ink/90 transition-colors disabled:opacity-50"
          >
            <Check size={15} />
          </button>
          <button
            type="button" onClick={() => onChange(saved ?? '')} title="Скасувати"
            className="w-[24px] h-[24px] flex items-center justify-center rounded-[7px] bg-canvas text-muted hover:bg-line transition-colors"
          >
            <X size={15} />
          </button>
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
    <div className="flex w-[260px] items-center gap-1.5">
      <DatePicker
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="min-w-0 flex-1"
        yearRange={{ min: new Date().getFullYear() - 100, max: new Date().getFullYear() }}
      />
      {dirty && (
        <>
          <button
            type="button"
            onClick={commit}
            disabled={saving}
            title="Зберегти"
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] bg-ink text-white transition-colors hover:bg-ink/90 disabled:opacity-50"
          >
            <Check size={15} />
          </button>
          <button
            type="button"
            onClick={() => onChange(saved ?? '')}
            title="Скасувати"
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] bg-canvas text-muted transition-colors hover:bg-line"
          >
            <X size={15} />
          </button>
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

function ProviderStatus({ primary, connected, soon }) {
  if (soon) {
    return (
      <span className="inline-flex items-center text-[11px] font-bold text-[#b45309] bg-[#fffbeb] px-[8px] py-[4px] rounded-full">
        Soon
      </span>
    );
  }
  if (primary) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-ink bg-ink/8 px-[8px] py-[4px] rounded-full">
        <Check size={12} /> Основний
      </span>
    );
  }
  if (connected) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#10b981] bg-[#ecfdf5] px-[8px] py-[4px] rounded-full">
        <Check size={12} /> Активно
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-[11px] font-bold text-muted bg-canvas px-[8px] py-[4px] rounded-full">
      Не підключено
    </span>
  );
}

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
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-[14px]">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-[36px] h-[36px] rounded-[10px] bg-canvas border border-line flex items-center justify-center shrink-0 text-ink">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-ink leading-snug">{title}</p>
          <p className="text-[12px] text-muted mt-[2px] leading-snug truncate">{detail}</p>
        </div>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-3 min-w-[190px]">
        <ProviderStatus primary={primary} connected={connected} soon={soon} />
        {staticMethod ? null : connected ? (
          <Button
            onClick={onDisconnect}
            disabled={disabled || primary}
            loading={loading}
            style="ghost"
            color="red"
            size="sm"
            className="min-w-[96px]"
          >
            Відключити
          </Button>
        ) : (
          <Button
            onClick={onConnect}
            disabled={disabled}
            loading={loading}
            style="secondary"
            size="sm"
            className="min-w-[96px]"
          >
            Підключити
          </Button>
        )}
      </div>
    </div>
  );
}

// Note: Card component replaced with UI Kit Card from @/components/ui/Layout/Card

// ── WorkflowItem ─────────────────────────────────────────────────────

function hexToRgba(hex, alpha) {
  if (!hex) return 'transparent';
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  return `rgba(${r},${g},${b},${alpha})`;
}

function WorkflowItem({ item, onSave, onDelete, canDelete = true, variant = 'status', provided, isDone = false, onToggleDone }) {
  const [editing,     setEditing]     = useState(item.isNew || false);
  const [label,       setLabel]       = useState(item.label);
  const [color,       setColor]       = useState(item.color);
  const [showPalette, setShowPalette] = useState(false);

  const save = () => {
    if (label.trim()) {
      const { isNew, ...rest } = item;
      onSave({ ...rest, label: label.trim(), color });
      setEditing(false);
      setShowPalette(false);
    } else {
      if (item.isNew) onDelete(item.id);
      else { setEditing(false); setLabel(item.label); }
    }
  };

  return (
    <div 
      ref={provided?.innerRef}
      {...provided?.draggableProps}
      className="flex items-center gap-3 py-[8px] px-[8px] -mx-[8px] rounded-[12px] hover:bg-canvas transition-colors group bg-white"
    >
      {provided?.dragHandleProps && (
        <div {...provided.dragHandleProps} className="shrink-0 text-faint hover:text-ink cursor-grab active:cursor-grabbing">
          <GripVertical size={14} />
        </div>
      )}
      {/* Color */}
      <div className="relative shrink-0">
        <button
          onClick={() => setShowPalette(v => !v)}
          className="w-[14px] h-[14px] rounded-full ring-2 ring-offset-2 ring-transparent hover:ring-ink/20 transition-all"
          style={{ background: color }}
        />
        {showPalette && (
          <div className="absolute left-0 top-[22px] z-20 bg-white border border-line rounded-[10px] p-[10px] shadow-lg grid grid-cols-5 gap-[6px] w-[148px]">
            {COLOR_PALETTE.map(c => (
              <button 
                key={c} 
                onClick={() => { 
                  setColor(c); 
                  setShowPalette(false); 
                  if (!editing) {
                    const { isNew, ...rest } = item;
                    onSave({ ...rest, label: label.trim(), color: c });
                  }
                }}
                className="w-[18px] h-[18px] rounded-full transition-transform hover:scale-110"
                style={{ background: c, outline: c === color ? '2px solid #1f1f1f' : 'none', outlineOffset: 2 }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Label */}
      {editing ? (
        <div className="flex-1">
          <Input
            autoFocus
            value={label}
            onChange={e => setLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { if (item.isNew) onDelete(item.id); else { setEditing(false); setLabel(item.label); } } }}
            className="h-[28px] text-[12px]"
          />
        </div>
      ) : (
        <span className="flex-1 text-[13px] font-semibold text-ink">{item.label}</span>
      )}

      {/* Badge preview */}
      {!editing && (
        <span 
          className={`inline-flex items-center shrink-0 text-[11px] font-medium backdrop-blur-[2px] transition-all ${
            variant === 'priority' ? 'gap-[6px] px-[8px] py-[3px] rounded-[6px]' :
            variant === 'label' ? 'gap-1.5 px-[10px] py-[3px] rounded-[6px]' :
            'px-[10px] py-[3px] rounded-[6px]'
          }`}
          style={{ 
            background: hexToRgba(color, 0.08), 
            color: color
          }}
        >
          {variant === 'priority' && <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ backgroundColor: color }} />}
          {variant === 'label' && <TagIcon size={10} className="shrink-0 opacity-70" />}
          {label}
        </span>
      )}

      {/* Terminal (done) toggle — statuses only */}
      {variant === 'status' && !editing && onToggleDone && (
        <button
          type="button"
          onClick={onToggleDone}
          title={isDone ? 'Завершальний статус — за ним рахується прогрес/швидкість/рахунок (клік, щоб прибрати)' : 'Позначити завершальним'}
          className={`shrink-0 flex items-center gap-[4px] text-[10px] font-bold px-[8px] py-[3px] rounded-full transition-colors ${
            isDone ? 'bg-[#10b981]/12 text-[#10b981]' : 'text-faint hover:text-muted hover:bg-canvas'
          }`}
        >
          <Check size={11} /> Завершальний
        </button>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-1 shrink-0 w-[64px]">
        {editing ? (
          <>
            <Button onClick={save} style="ghost" size="icon" icon={Check} iconSize={12} />
            <Button
              onClick={() => {
                if (item.isNew) { onDelete(item.id); }
                else { setEditing(false); setLabel(item.label); setColor(item.color); }
              }}
              style="ghost" size="icon" icon={X} iconSize={12}
            />
          </>
        ) : (
          <>
            <Button onClick={() => setEditing(true)}
              style="ghost" size="icon" icon={Edit2} iconSize={11}
            />
            {canDelete ? (
              <Button onClick={() => onDelete(item.id)}
                style="ghost" color="red" size="icon" icon={Trash2} iconSize={11}
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
    <div className="flex items-center gap-3 py-[8px] px-[8px] -mx-[8px] rounded-[12px] hover:bg-canvas transition-colors group">
      {editing ? (
        <div className="flex flex-1 items-center gap-3">
          <Input
            autoFocus
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Назва посади"
            className="h-[28px] text-[12px] flex-1"
          />
          <div className="w-[120px] flex items-center gap-1">
            <span className="text-[12px] text-muted">$</span>
            <Input
              type="number"
              value={hourlyRate}
              onChange={e => setHourlyRate(e.target.value)}
              placeholder="Ставка"
              className="h-[28px] text-[12px] w-[50px] text-right"
            />
            <span className="text-[11px] text-muted">/год</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-between">
          <span className="text-[13px] font-semibold text-ink">{item.label}</span>
          <span className="text-[12px] font-medium text-muted">${item.hourlyRate || 0}/год</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-1 shrink-0 w-[64px]">
        {editing ? (
          <>
            <Button onClick={save} style="ghost" size="icon" icon={Check} iconSize={12} />
            <Button
              onClick={() => {
                if (item.isNew) { onDelete(item.id); }
                else { setEditing(false); setLabel(item.label); setHourlyRate(item.hourlyRate); }
              }}
              style="ghost" size="icon" icon={X} iconSize={12}
            />
          </>
        ) : (
          <>
            <Button onClick={() => setEditing(true)}
              style="ghost" size="icon" icon={Edit2} iconSize={11}
            />
            <Button onClick={() => onDelete(item.id)}
              style="ghost" color="red" size="icon" icon={Trash2} iconSize={11}
            />
          </>
        )}
      </div>
    </div>
  );
}

// Strips the transient `isNew` UI flag before a workflow item is persisted.
const cleanWorkflowItems = arr => (arr || []).map(({ isNew, ...rest }) => rest);

// ── MAIN PAGE ────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const { currentUser, signOut, activeOrgId, projects, orgRole } = useAppContext();
  const showToast = useWorkspaceStore(s => s.showToast);
  const confirmDialog = useConfirm();
  const { org, members, inviteMember, changeMemberRole, removeMember, setMemberPosition } = useOrganization();

  // Role resolution
  const myMemberInfo = members.find(m => m.id === (currentUser?.uid || currentUser?.id));
  const myRole = orgRole || myMemberInfo?.role || 'member';
  const isAdmin = myRole === 'owner' || myRole === 'admin';
  const isOwner = myRole === 'owner';

  const [activeSection, setActiveSection] = useState('profile');

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
  const [positions,  setPositions]  = useState([]);
  const [wfLoading,  setWfLoading]  = useState(true);
  const [showSavedCheck, setShowSavedCheck] = useState(false);

  const triggerSavedSuccess = () => {
    setShowSavedCheck(true);
    setTimeout(() => setShowSavedCheck(false), 2500);
  };


  // ── Profile ──
  const [displayName,   setDisplayName]   = useState('');
  const [customAvatar,  setCustomAvatar]  = useState('');
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
    const token = await auth.currentUser?.getIdToken();
    if (!token || !activeOrgId) throw new Error('Authentication required');
    const response = await fetch(`/api/integrations/api-keys?organizationId=${encodeURIComponent(activeOrgId)}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'API key request failed');
    return result;
  };

  const telegramRequest = useCallback(async (path, method = 'GET', body = null) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Authentication required');
    const response = await fetch(path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Telegram request failed');
    return result;
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
  // Last workflow value known to match Firestore — process settings auto-save
  // (no manual button), so this guards against re-writing freshly hydrated data.
  const wfBaseline = useRef(null);
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
      if (org?.customBranding !== undefined) setOrgCustomBranding(Boolean(org.customBranding));
      if (org?.sidebarTheme) setSidebarTheme(org.sidebarTheme);
      if (org?.sidebarColor) setSidebarColor(org.sidebarColor);
    });
  }, [currentUser?.name, org?.name, org?.logo, org?.customBranding, org?.sidebarTheme, org?.sidebarColor]); // eslint-disable-line

  useEffect(() => {
    queueMicrotask(() => refreshAuthProviders());
  }, [currentUser?.id, currentUser?.uid]);

  // ── Breadcrumbs ──
  // Removed breadcrumbs to avoid duplicate 'Налаштування' in WorkspaceHeader
  useEffect(() => {
    const load = async () => {
      if (!activeOrgId) return;
      try {
        const wfSnap = await getDoc(doc(db, 'organizations', activeOrgId, 'settings', 'workflow'));
        if (wfSnap.exists()) {
          const d = wfSnap.data();
          if (d.statuses !== undefined)   setStatuses(d.statuses);
          if (d.types !== undefined)      setTypes(d.types);
          if (d.priorities !== undefined) setPriorities(d.priorities);
          if (d.labels !== undefined)     setLabels(d.labels);
          if (d.positions !== undefined)  setPositions(d.positions);
          else                            setPositions(DEFAULT_POSITIONS);
        } else {
          setPositions(DEFAULT_POSITIONS);
        }
        const intSnap = await getDoc(doc(db, 'organizations', activeOrgId, 'settings', 'integrations'));
        if (intSnap.exists()) {
          setQtEnabled(intSnap.data().qtPortalEnabled !== false);
        }
        
        const orgSnap = await getDoc(doc(db, 'organizations', activeOrgId));
        if (orgSnap.exists()) {
          const orgData = orgSnap.data();
          setOrgPlan(orgData.plan || 'free');
        }

        if (isAdmin) {
          const keyResult = await apiKeysRequest();
          setApiKeys(keyResult.keys || []);

          // Plan-limit count is admin-only (billing). Under team-gated project
          // reads a plain member can't run an org-wide projects query, so this
          // stays behind isAdmin — admins may read every project in the org.
          const { collection, query, where, getDocs } = await import('firebase/firestore');
          const projQuery = query(collection(db, 'projects'), where('organizationId', '==', activeOrgId));
          const projSnap = await getDocs(projQuery);
          setProjectsCount(projSnap.docs.length);
        }

        const uid = currentUser?.uid || currentUser?.id;
        if (uid) {
          const notifSnap = await getDoc(doc(db, 'users', uid, 'settings', 'notifications'));
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
      } catch {}
      setWfLoading(false);
    };
    load();
  }, [activeOrgId, currentUser?.uid, isAdmin]); // eslint-disable-line

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
    } catch { showToast('Помилка збереження', 'error'); }
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
      window.location.href = `/api/auth/oneb/start?${params.toString()}`;
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
  const persistBranding = async (patch = {}) => {
    if (!activeOrgId) return;
    const next = { orgCustomBranding, orgLogo, sidebarTheme, sidebarColor, ...patch };
    const brandingValue = next.orgCustomBranding && (next.orgLogo || '').trim() ? true : false;
    try {
      await updateDoc(doc(db, 'organizations', activeOrgId), {
        logo: (next.orgLogo || '').trim(),
        customBranding: brandingValue,
        sidebarTheme: brandingValue ? next.sidebarTheme : 'dark',
        sidebarColor: brandingValue && next.sidebarTheme === 'custom' ? next.sidebarColor : '#1f1f1f',
        updatedAt: serverTimestamp(),
      });
    } catch { showToast('Помилка збереження', 'error'); }
  };

  // Process settings auto-save: persist workflow changes in real time — no
  // manual "Save" button. The baseline ref keeps the initial hydration (and org
  // switches, which re-load state) from writing freshly loaded data back and
  // toasting on open. Debounced so a burst of inline edits or a drag-reorder
  // collapses into a single write.
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
    if (wfBaseline.current === null || wfBaseline.current === json) {
      wfBaseline.current = json;
      return;
    }
    if (!activeOrgId) return;
    const timer = setTimeout(async () => {
      try {
        await setDoc(doc(db, 'organizations', activeOrgId, 'settings', 'workflow'), payload, { merge: true });
        wfBaseline.current = json;
        showToast('Налаштування оновлено');
      } catch (e) {
        console.error('Workflow autosave error:', e);
        showToast(e.message || 'Помилка збереження', 'error');
      }
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses, types, priorities, labels, positions, wfLoading, activeOrgId]);

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
      showToast('Помилка генерації ключа', 'error');
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
      showToast('Помилка видалення ключа', 'error');
    }
  };

  const handleRoleChange = async (uid, role) => {
    try { await changeMemberRole(uid, role); showToast('Роль змінено'); }
    catch { showToast('Помилка', 'error'); }
  };

  const handlePositionChange = async (uid, positionId) => {
    try { await setMemberPosition(uid, positionId); showToast('Посаду змінено'); }
    catch { showToast('Помилка', 'error'); }
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
      showToast('Помилка передачі прав', 'error');
    }
  };

  const handleRemoveMember = async (uid) => {
    if (!(await confirmDialog({
      title: 'Видалити учасника з команди?',
      confirmText: 'Видалити', danger: true,
    }))) return;
    try { await removeMember(uid); showToast('Учасника видалено'); }
    catch { showToast('Помилка', 'error'); }
  };

  const handleUpgradePlan = async (newPlan = 'pro') => {
    showToast('Підключення платіжної системи в розробці 🛠️');
  };

  const unarchiveProject = async (id) => {
    try {
      await restoreProject(id);
      showToast('Проєкт розархівовано');
    } catch (err) {
      showToast('Помилка розархівування', 'error');
    }
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

  // Toggle whether a status counts as "work complete". We materialize explicit
  // `isDone` flags on every status so the terminal set is unambiguous (no reliance
  // on the implicit 'done'-id fallback). There is always ≥1 terminal status:
  // clearing the last one just falls back to the default via getDoneStatusIds.
  const handleToggleStatusDone = (id) => {
    setStatuses(prev => {
      const done = new Set(getDoneStatusIds(prev));
      if (done.has(id)) done.delete(id); else done.add(id);
      return prev.map(s => ({ ...s, isDone: done.has(s.id) }));
    });
  };

  const handleStatusDeleteClick = async (id) => {
    const targetStatus = statuses.find(s => s.id === id);
    if (!targetStatus || targetStatus.isNew) {
      stA.onDelete(id);
      return;
    }
    if (statuses.filter(s => !s.isNew).length <= 1) {
      showToast('Дошка повинна мати хоча б одну видиму колонку', 'error');
      return;
    }
    setWfLoading(true);
    try {
      const { collection, query, where, getDocs, writeBatch, serverTimestamp, deleteField } = await import('firebase/firestore');
      const q = query(collection(db, 'issues'), where('organizationId', '==', activeOrgId), where('columnId', '==', id));
      const snap = await getDocs(q);
      const targetColId = statuses.find(s => s.id !== id && !s.isNew)?.id || 'backlog';
      
      if (snap.docs.length > 0) {
        if (!(await confirmDialog({
          title: 'Видалити колонку?',
          message: `У цій колонці є ${snap.docs.length} завдань. При видаленні вони будуть переміщені в "${statuses.find(s => s.id === targetColId)?.label || 'Backlog'}". Продовжити?`,
          confirmText: 'Продовжити', danger: true,
        }))) {
          setWfLoading(false);
          return;
        }
        const sourceWasDone = getDoneStatusIds(statuses).includes(id);
        const targetIsDone = getDoneStatusIds(statuses).includes(targetColId);
        for (let offset = 0; offset < snap.docs.length; offset += 400) {
          const batch = writeBatch(db);
          snap.docs.slice(offset, offset + 400).forEach(issueDoc => {
            const updates = { columnId: targetColId, status: targetColId, updatedAt: serverTimestamp() };
            if (targetIsDone && !sourceWasDone) updates.completedAt = serverTimestamp();
            if (!targetIsDone && sourceWasDone) updates.completedAt = deleteField();
            batch.update(issueDoc.ref, updates);
          });
          await batch.commit();
        }
      }
      stA.onDelete(id);
    } catch (e) {
      showToast('Помилка видалення статусу: ' + e.message, 'error');
    }
    setWfLoading(false);
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
    statuses:   { noun: 'статуси',    apply: () => setStatuses(DEFAULT_STATUSES) },
    types:      { noun: 'типи',       apply: () => setTypes(DEFAULT_TYPES) },
    priorities: { noun: 'пріоритети', apply: () => setPriorities(DEFAULT_PRIORITIES) },
    labels:     { noun: 'мітки',      apply: () => setLabels(DEFAULT_LABELS) },
    positions:  { noun: 'посади',     apply: () => setPositions(DEFAULT_POSITIONS) },
  };
  const renderWorkflowResetFooter = () => {
    const cfg = workflowResetConfig[activeSection];
    if (!cfg) return null;
    return (
      <div className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[12px] bg-canvas px-4 py-3">
        <p className="text-[12px] text-muted leading-relaxed">
          Повернути {cfg.noun} до стандартного набору QuickTeam. Ваші поточні зміни в цій секції буде замінено.
        </p>
        <Button
          style="secondary"
          color="red"
          size="sm"
          icon={RefreshCw}
          className="shrink-0"
          onClick={async () => {
            if (!(await confirmDialog({
              title: `Скинути ${cfg.noun}?`,
              message: `Усі ваші ${cfg.noun} в цій секції буде замінено стандартним набором QuickTeam. Цю дію не можна скасувати.`,
              confirmText: 'Скинути', cancelText: 'Залишити', danger: true,
            }))) return;
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
          <Card variant="white" padding="lg" className="!border-none">
            <Row label="Аватар" desc="Завантажте власне фото (рекомендовано 1:1)">
              <ImageUpload
                value={customAvatar || currentUser?.avatar || ''}
                onChange={v => { setCustomAvatar(v); saveProfileField('customAvatar', v); }}
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
              <label className="text-[13px] font-medium text-ink">Про себе</label>
              <p className="text-[12px] text-muted -mt-1 leading-relaxed">Коротка інформація про вашу роль, досвід чи інтереси</p>
              <Textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Розкажіть трохи про себе..."
                className="w-full mt-1 text-[13px] h-[80px]"
              />
              {bio !== (currentUser?.bio || '') && (
                <div className="flex items-center justify-end gap-2">
                  <Button onClick={() => setBio(currentUser?.bio || '')} style="secondary" size="sm">Скасувати</Button>
                  <Button onClick={() => saveProfileField('bio', bio)} style="primary" color="dark" size="sm" icon={Check} iconSize={14}>Зберегти</Button>
                </div>
              )}
            </div>
          </Card>
        </Section>
      );

      case 'auth-methods': return (
        <Section title="Способи входу" desc="Керуйте сервісами, через які можна входити у QuickTeam">
          <Card variant="white" padding="lg" className="!border-none">
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
          { key: 'deadline',      label: 'Дедлайни',                 desc: 'За 24 години до дедлайну та щодня для прострочених завдань' },
        ].filter(row => NOTIFICATION_EVENTS.some(event => event.key === row.key));

        // Every line is the shared <Row>, so all three cards land on the same
        // label column and the same right-hand control column.
        const channelCard = ({ id, icon: ChannelIcon, title, caption, master, available, offNote, showDesc = false, footer = null }) => (
          <Card variant="white" padding="lg" className="!border-none">
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
                    : 'Бот не налаштований на сервері',
              available: telegramBotStatus.connected && notif.telegramEnabled === true,
              offNote: telegramBotStatus.configured
                ? 'Увімкни канал — відкриється бот. Після «Старт» тут зʼявиться список подій.'
                : 'Бот не налаштований на сервері, тому канал недоступний.',
              master: (
                <ToggleSwitch
                  checked={telegramBotStatus.connected && notif.telegramEnabled === true}
                  onChange={toggleTelegram}
                  disabled={!telegramBotStatus.configured || telegramBotLoading || telegramAwaitingLink}
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
          <Card variant="white" padding="lg" className="!border-none">
            <Row label="Мова інтерфейсу" desc="Виберіть мову відображення">
              <Select
                value={language}
                onChange={setLanguage}
                options={[
                  { value: 'ua', label: 'Українська' }
                ]}
                className="w-[240px]"
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
                className="w-[240px]"
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
                className="w-[240px]"
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
                className="w-[240px]"
              />
            </Row>
            <Row label="Часовий пояс" desc="Поточний регіональний час для планування">
              <Select
                value={timezone}
                onChange={setTimezone}
                options={tzOptions}
                className="w-[240px]"
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
          <Card variant="white" padding="lg" className="!border-none">
            <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">Організація</p>
            <Row label="Назва організації" desc="Видима всім у вашій організації">
              <InlineEditField value={orgName} onChange={setOrgName} saved={org?.name || ''} onSave={saveOrgName} className="w-[260px]" />
            </Row>
            <Row label="Логотип організації" desc="Зображення для вашої організації (рекомендовано 1:1)">
              <ImageUpload value={orgLogo} onChange={v => { setOrgLogo(v); persistBranding({ orgLogo: v }); }} theme="light" showLabel={false} showHint={false} />
            </Row>
            <Row label="Organization ID" desc="Унікальний ідентифікатор для API інтеграцій">
              <div className="flex items-center gap-2">
                <code className="text-[12px] bg-canvas border border-line px-2 py-1 rounded-[6px] text-muted font-mono">
                  {activeOrgId || 'quickteam'}
                </code>
                <Button
                  onClick={() => { navigator.clipboard.writeText(activeOrgId || 'quickteam'); showToast('Скопійовано'); }}
                  style="ghost" size="icon-sm"
                  icon={Copy}
                  iconSize={12}
                />
              </div>
            </Row>
          </Card>

          {/* Zone 2: Branding */}
          <Card variant="white" padding="lg" className={`!border-none transition-opacity ${!orgLogo ? 'opacity-50 pointer-events-none' : ''}`}>
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
                  <div className="flex gap-[16px]">
                    {THEME_OPTIONS.map(opt => {
                      const isActive = sidebarTheme === opt.id;
                      const isCustomUnselected = opt.id === 'custom' && !isActive;

                      const buttonNode = (
                        <button
                          key={opt.id}
                          onClick={() => {
                            handleThemeChange(opt.id);
                          }}
                          className="flex flex-col items-center gap-[6px] group/theme"
                        >
                          <div
                            className={`w-[44px] h-[44px] rounded-full transition-all ${
                              isActive
                                ? 'ring-2 ring-ink ring-offset-2'
                                : 'ring-1 ring-line hover:ring-muted'
                            }`}
                            style={isCustomUnselected
                              ? { background: 'conic-gradient(#ef4444, #f59e0b, #22c55e, #3b82f6, #8b5cf6, #ec4899, #ef4444)' }
                              : {
                                  backgroundColor: opt.bg,
                                  border: opt.id === 'light' && !isActive ? '1px solid #e0e0e0' : 'none',
                                }
                            }
                          />
                          <span className={`text-[11px] font-medium transition-colors ${isActive ? 'text-ink' : 'text-muted group-hover/theme:text-ink'}`}>{opt.label}</span>
                        </button>
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
                                    className="w-full font-mono text-[13px] h-[32px]"
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
          if (enabled) {
            const { key } = await apiKeysRequest('POST', { name: 'BuggyBag Integration' });
            const updatedKeys = [...apiKeys, key];
            setApiKeys(updatedKeys);
            showToast('Інтеграцію з BuggyBag увімкнено!');
          } else {
            if (buggyBagKey) {
              const updatedKeys = apiKeys.filter(k => k.id !== buggyBagKey.id);
              await apiKeysRequest('DELETE', { keyId: buggyBagKey.id });
              setApiKeys(updatedKeys);
              showToast('Інтеграцію з BuggyBag вимкнено');
            }
          }
        };

        return (
          <Section title="Інтеграції" desc="Керуй підключеними сервісами" rightAction={saveButton}>

            <IntegrationCard
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
            />

            {/* Telegram bot — group task capture */}
            <IntegrationCard
              title="Telegram"
              description="Створюйте задачі прямо з робочої Telegram-групи та автоматично додавайте їх у вибраний проєкт."
              logoSrc="/integrations/telegram.svg"
              logoAlt="Telegram"
              enabled={telegramGroupStatus.connected || telegramGroupSetupOpen}
              onToggle={toggleTelegramGroup}
              toggleDisabled={!telegramGroupStatus.configured || telegramGroupLoading}
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
                <span className="text-[11px] text-muted">Бота ще не налаштовано на сервері QuickTeam.</span>
              ) : null}
            >
              {telegramGroupStatus.connected ? (
                <div className="space-y-3">
                  <div className="rounded-[10px] border border-line bg-canvas p-3">
                    <p className="text-[12px] font-semibold text-ink">Як створити задачу в групі</p>
                    <div className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted">
                      <p><code className="rounded bg-white px-1.5 py-0.5 text-ink">/task Назва задачі</code> — швидка команда.</p>
                      <p>
                        <code className="rounded bg-white px-1.5 py-0.5 text-ink">
                          @{telegramGroupStatus.username || 'quick_team_bot'} Назва задачі
                        </code>
                        {' '}— звичайне звернення до бота.
                      </p>
                      <p>Наступні рядки повідомлення стануть описом задачі.</p>
                    </div>
                  </div>
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
                        <div className="mt-2 flex max-w-[620px] items-center gap-2 rounded-[8px] border border-line bg-canvas p-2">
                          <code className="min-w-0 flex-1 select-all break-all text-[11px] text-ink">{telegramGroupConnect.command}</code>
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
            </IntegrationCard>

            {/* BuggyBag Portal */}
            <IntegrationCard
              title="BuggyBag Portal"
              description="Перетворює баг-репорти клієнтів на задачі QuickTeam разом зі скріншотами та технічними даними."
              logoSrc="/bug-logo.png"
              logoAlt="BuggyBag"
              enabled={buggyBagEnabled}
              onToggle={toggleBuggyBag}
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
                <div className="rounded-[10px] border border-line bg-canvas p-3">
                  <p className="mb-3 text-[12px] font-semibold text-ink">Вставте ці дані в налаштуваннях BuggyBag</p>
                  <div className="grid items-center gap-3 sm:grid-cols-[100px_1fr]">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted">API Token</span>
                    <div className="flex min-w-0 items-center gap-2">
                      <code className="min-w-0 flex-1 select-all truncate rounded border border-line bg-white px-3 py-1.5 font-mono text-[12px]">
                        {buggyBagKey.token || `${buggyBagKey.prefix || 'qt_'}••••••••••••••••`}
                      </code>
                      {buggyBagKey.token && (
                        <Button onClick={() => { navigator.clipboard.writeText(buggyBagKey.token); showToast('Токен скопійовано'); }} style="ghost" size="icon-sm" icon={Copy} iconSize={14} aria-label="Копіювати API Token" />
                      )}
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Org ID</span>
                    <div className="flex min-w-0 items-center gap-2">
                      <code className="min-w-0 flex-1 select-all truncate rounded border border-line bg-white px-3 py-1.5 font-mono text-[12px]">{activeOrgId}</code>
                      <Button onClick={() => { navigator.clipboard.writeText(activeOrgId); showToast('ID скопійовано'); }} style="ghost" size="icon-sm" icon={Copy} iconSize={14} aria-label="Копіювати ID організації" />
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                {[
                  'Баг-репорти',
                  'Скріншоти та консоль',
                  'Коментарі клієнтів',
                  'Статуси завдань',
                ].map(item => (
                  <div key={item} className="flex items-center gap-2 text-[12px] text-faint">
                    <span className="h-[4px] w-[4px] shrink-0 rounded-full bg-[#e0e0e0]" />
                    {item}
                  </div>
                ))}
              </div>
            </IntegrationCard>
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
            <Card className={`!border-none shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-hidden p-0 transition-all`}>
              <div className={`bg-white px-6 py-6 border-b border-line`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`inline-flex items-center px-[8px] py-[3px] rounded-md border border-line bg-canvas text-ink text-[11px] font-semibold mb-3`}>
                      {isPro ? 'PRO PLAN' : 'FREE PLAN'}
                    </span>
                    <h3 className="text-[20px] font-bold text-ink mb-1">{isPro ? 'Професійний тариф' : 'Безкоштовний тариф'}</h3>
                    <p className="text-[13px] text-muted">{isPro ? 'Безлімітні проєкти та всі функції розблоковано' : 'Використовується для тестування (Demo)'}</p>
                  </div>
                  <div className="text-right">
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
                  <Button onClick={() => handleUpgradePlan('free')} disabled={upgrading} loading={upgrading} style="secondary" color="gray" size="lg">
                    {upgrading ? 'Завантаження...' : 'Скасувати підписку'}
                  </Button>
                ) : (
                  <Button onClick={() => handleUpgradePlan('pro')} disabled={upgrading} loading={upgrading} style="primary" color="blue" size="lg">
                    {upgrading ? 'Оновлення...' : 'Оновити до PRO'}
                  </Button>
                )}
              </div>
            </Card>
          </Section>
        );
      }

      // ──────────────────────────────────────────────────────────────
      case 'team': return (
        <Section title="Учасники команди" rightAction={
          <Button onClick={() => setShowInviteModal(true)} style="primary" size="md" icon={Plus}>Запросити</Button>
        }>
          <Surface variant="card" className="!rounded-[16px] p-0 overflow-hidden relative z-10">
            <div className="flex flex-col divide-y divide-[#f0f0f0] rounded-[16px]">
              {members.map((member, i) => {
                const isMe = member.id === (currentUser?.uid || currentUser?.id);
                const positionLabel = positions.find(position => position.id === member.positionId)?.label || 'Без посади';
                return (
                  <div key={member.id} className={`flex items-center justify-between gap-4 px-5 py-4 hover:bg-[#fcfcfc] transition-colors ${i === 0 ? 'rounded-t-[16px]' : ''} ${i === members.length - 1 ? 'rounded-b-[16px]' : ''}`}>
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar user={member} size={40} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[14px] font-bold text-ink">{member.name || member.email}</p>
                          {isMe && <span className="text-[10px] font-bold text-muted uppercase tracking-wider bg-canvas px-1.5 py-0.5 rounded-md">Ти</span>}
                        </div>
                        <p className="truncate text-[12px] text-muted">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="hidden rounded-full bg-canvas px-3 py-1.5 text-[11px] font-semibold text-muted sm:inline">{positionLabel}</span>
                      <span className="rounded-full bg-canvas px-3 py-1.5 text-[11px] font-semibold text-ink">{ROLE_LABELS[member.role] || member.role}</span>
                      <Button
                        onClick={() => setMemberSettingsId(member.id || member.uid)}
                        style="secondary"
                        size="icon"
                        icon={SlidersHorizontal}
                        title="Налаштувати учасника"
                      />
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
        const doneIds = getDoneStatusIds(statuses);
        return (
        <Section title="Статуси завдань" desc="Статуси завдань — застосовуються до всіх проєктів. Позначте «завершальні» — за ними рахуються прогрес, швидкість, прострочені та рахунок.">
          {wfLoading ? (
            <div className="py-12 flex items-center justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : (
            <Card className="!border-none">
              <DragDropContext onDragEnd={(res) => handleDragEnd(res, statuses, setStatuses)}>
                <Droppable droppableId="statuses-list">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps}>
                      {statuses.map((s, i) => (
                        <Draggable key={s.id || `new-${i}`} draggableId={s.id || `new-${i}`} index={i}>
                          {(provided) => (
                            <WorkflowItem item={s}
                              onSave={stA.onSave} onDelete={handleStatusDeleteClick}
                              canDelete={statuses.length > 1 && !['backlog', 'done'].includes(s.id)}
                              variant="status"
                              isDone={doneIds.includes(s.id)}
                              onToggleDone={() => handleToggleStatusDone(s.id)}
                              provided={provided}
                            />
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
              <Button
                onClick={() => {
                  setStatuses(p => {
                    const newStatuses = [...p];
                    newStatuses.splice(newStatuses.length - 1, 0, { id: `s-${Date.now()}`, label: 'Новий статус', color: '#6366f1', isNew: true });
                    return newStatuses;
                  });
                }}
                style="ghost" size="lg"
                icon={Plus} iconSize={13}
                className="w-full justify-start py-3 mt-2"
              >
                Додати статус
              </Button>
            </Card>
          )}
          {!wfLoading && renderWorkflowResetFooter()}
        </Section>
        );
      }

      case 'types': return (
        <Section title="Типи завдань" desc="Типи завдань — застосовуються до всіх проєктів">
          {wfLoading ? (
            <div className="py-12 flex items-center justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : (
            <Card className="!border-none">
              {types.map(t => (
                <WorkflowItem key={t.id} item={t} onSave={tpA.onSave} onDelete={tpA.onDelete} variant="type" />
              ))}
              <Button
                onClick={() => setTypes(p => [...p, { id: `t-${Date.now()}`, label: 'Новий тип', color: '#059669', isNew: true }])}
                style="ghost" size="lg"
                icon={Plus} iconSize={13}
                className="w-full justify-start py-3 mt-2"
              >
                Додати тип
              </Button>
            </Card>
          )}
          {!wfLoading && renderWorkflowResetFooter()}
        </Section>
      );

      case 'priorities': return (
        <Section title="Пріоритети завдань" desc="Пріоритети завдань — застосовуються до всіх проєктів">
          {wfLoading ? (
            <div className="py-12 flex items-center justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : (
            <Card className="!border-none">
              {priorities.map(pItem => (
                <WorkflowItem key={pItem.id} item={pItem} onSave={prA.onSave} onDelete={prA.onDelete} variant="priority" />
              ))}
              <Button
                onClick={() => setPriorities(p => [...p, { id: `p-${Date.now()}`, label: 'Новий пріоритет', color: '#eab308', isNew: true }])}
                style="ghost" size="lg"
                icon={Plus} iconSize={13}
                className="w-full justify-start py-3 mt-2"
              >
                Додати пріоритет
              </Button>
            </Card>
          )}
          {!wfLoading && renderWorkflowResetFooter()}
        </Section>
      );

      case 'labels': return (
        <Section title="Мітки завдань" desc="Глобальні мітки для маркування завдань">
          {wfLoading ? (
            <div className="py-12 flex items-center justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : (
            <Card className="!border-none">
              {labels.map(l => (
                <WorkflowItem key={l.id} item={l} onSave={lbA.onSave} onDelete={lbA.onDelete} variant="label" />
              ))}
              <Button
                onClick={() => setLabels(p => [...p, { id: `l-${Date.now()}`, label: 'Нова мітка', color: '#db2777', isNew: true }])}
                style="ghost" size="lg"
                icon={Plus} iconSize={13}
                className="w-full justify-start py-3 mt-2"
              >
                Додати мітку
              </Button>
            </Card>
          )}
          {!wfLoading && renderWorkflowResetFooter()}
        </Section>
      );

      case 'positions': return (
        <Section title="Посади та ставки" desc="Налаштування посад команди та погодинних ставок виконавців">
          {wfLoading ? (
            <div className="py-12 flex items-center justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : (
            <Card className="!border-none">
              {positions.map(p => (
                <PositionItem key={p.id} item={p} onSave={posA.onSave} onDelete={posA.onDelete} />
              ))}
              <Button
                onClick={() => setPositions(p => [...p, { id: `pos-${Date.now()}`, label: 'Нова посада', hourlyRate: 0, isNew: true }])}
                style="ghost" size="lg"
                icon={Plus} iconSize={13}
                className="w-full justify-start py-3 mt-2"
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
          <Card variant="white" padding="lg" className="!border-none">
            <Row label="Вийти з акаунту" desc="Завершити сесію на цьому пристрої">
              <Button
                onClick={async () => {
                  if (await confirmDialog({ title: 'Вийти з акаунта?', confirmText: 'Вийти', danger: true })) signOut();
                }}
                style="ghost" color="red" size="lg"
                icon={LogOut} iconSize={13}
              >
                Вийти
              </Button>
            </Row>

            <Row label="Скинути workflow" desc="Повернути статуси, типи та пріоритети до стандартних значень">
              <Button
                onClick={async () => {
                  if (!(await confirmDialog({
                    title: 'Скинути всі workflow налаштування?',
                    message: 'Статуси, типи, пріоритети та мітки буде замінено стандартним набором QuickTeam. Цю дію не можна скасувати.',
                    confirmText: 'Скинути', cancelText: 'Залишити', danger: true,
                  }))) return;
                  setStatuses(DEFAULT_STATUSES);
                  setTypes(DEFAULT_TYPES);
                  setPriorities(DEFAULT_PRIORITIES);
                  setLabels(DEFAULT_LABELS);
                  // Auto-save persists these changes; no manual save needed.
                }}
                style="ghost" color="red" size="lg"
                icon={RefreshCw} iconSize={13}
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
            <Card variant="white" padding="lg" className="!border-none">
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
                        className="shrink-0 ml-4 font-bold"
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
    <SidebarLayout sidebar={sidebarContent} hasBorder={false} mobilePane={mobilePane}>
      <main className="flex-1 overflow-y-auto custom-scrollbar bg-canvas relative">
        <div className="max-w-[760px] mx-auto px-[16px] py-[24px] md:px-[32px] md:py-[48px] min-h-full flex flex-col">
          <button
            onClick={requestPaneClose}
            className="md:hidden flex items-center gap-2 text-[13px] font-semibold text-muted hover:text-ink pb-[16px] transition-colors"
          >
            <ArrowLeft size={15} /> Всі налаштування
          </button>
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
