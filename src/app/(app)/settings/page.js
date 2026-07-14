'use client';
// src/app/workspace/settings/page.js — Redesigned Settings (clean, no emoji, QT-style)
import { useState, useEffect } from 'react';
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
  Palette, Check, Plus, Trash2, Edit2, X, Save,
  Building, LogOut, Download, RefreshCw, Mail,
  Copy, ExternalLink, ChevronRight, AlertTriangle, ArrowLeft,
  Link2, PlugZap, ToggleLeft, ToggleRight, Receipt, CreditCard,
  Globe, Tag as TagIcon, Briefcase, GripVertical,
  Archive, ArchiveRestore, Bug
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
  Surface,
  useConfirm
} from '@/components/ui';
import UserAvatar from '@/components/UserAvatar';
import ImageUpload from '@/components/ui/ImageUpload';
import { sendNotification } from '@/lib/hooks/useNotifications';
import { getDoneStatusIds } from '@/lib/hooks/useWorkflowConfig';
import { getOneBRedirectUri } from '@/lib/utils/oneb';

// ── Constants ────────────────────────────────────────────────────────
const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || '';
const ROLE_LABELS = {
  owner: 'Власник',
  admin: 'Адміністратор',
  member: 'Учасник'
};
const ASSIGNABLE_ROLE_OPTIONS = Object.entries(ROLE_LABELS)
  .filter(([role]) => role !== 'owner')
  .map(([value, label]) => ({ value, label }));

const DEFAULT_STATUSES = [
  { id: 'todo',            label: 'To Do',           color: '#6366f1' },
  { id: 'in-progress',     label: 'In Progress',     color: '#0891b2' },
  { id: 'done',            label: 'Done',            color: '#10b981' },
];
const DEFAULT_TYPES = [
  { id: 'epic',    label: 'Epic',    color: '#8b5cf6' },
  { id: 'feature', label: 'Feature', color: '#0891b2' },
  { id: 'task',    label: 'Task',    color: '#059669' },
  { id: 'bug',     label: 'Bug',     color: '#dc2626' },
];
const DEFAULT_PRIORITIES = [
  { id: 'blocker', label: 'Blocker', color: '#ef4444' },
  { id: 'high',    label: 'High',    color: '#f97316' },
  { id: 'medium',  label: 'Medium',  color: '#eab308' },
  { id: 'low',     label: 'Low',     color: '#9a9a9a' },
];
const DEFAULT_LABELS = [
  { id: 'bug',      label: 'Bug',      color: '#ef4444' },
  { id: 'frontend', label: 'Frontend', color: '#3b82f6' },
  { id: 'design',   label: 'Design',   color: '#db2777' },
];
const DEFAULT_POSITIONS = [
  { id: 'dev',      label: 'Розробник', hourlyRate: 30 },
  { id: 'designer', label: 'Дизайнер',   hourlyRate: 35 },
  { id: 'pm',       label: 'PM',         hourlyRate: 40 },
  { id: 'qa',       label: 'QA',         hourlyRate: 25 },
];
const COLOR_PALETTE = [
  '#dc2626','#f97316','#eab308','#22c55e','#10b981',
  '#0891b2','#6366f1','#8b5cf6','#db2777','#1f1f1f',
  '#9a9a9a','#059669','#7c3aed','#d97706','#0284c7',
];

const NAV = [
  { id: 'profile',       label: 'Особистий профіль',icon: User,          group: 'Особисте' },
  { id: 'auth-methods',  label: 'Способи входу',     icon: Link2,        group: 'Особисте' },
  { id: 'notifications', label: 'Сповіщення',       icon: Bell,          group: 'Особисте' },
  { id: 'localization',  label: 'Локалізація',      icon: Globe,         group: 'Особисте' },
  { id: 'workspace',     label: 'Загальні',         icon: Building,      group: 'Організація', adminOnly: true },
  { id: 'team',          label: 'Учасники команди', icon: Users,         group: 'Організація' },
  { id: 'billing',       label: 'Тарифний план',    icon: CreditCard,    group: 'Організація', adminOnly: true },
  { id: 'integrations',  label: 'Інтеграції',       icon: PlugZap,       group: 'Організація', adminOnly: true },
  { id: 'statuses',      label: 'Статуси завдань',    icon: GitBranch,     group: 'Налаштування процесів', adminOnly: true },
  { id: 'types',         label: 'Типи завдань',       icon: TagIcon,       group: 'Налаштування процесів', adminOnly: true },
  { id: 'priorities',    label: 'Пріоритети',       icon: AlertTriangle, group: 'Налаштування процесів', adminOnly: true },
  { id: 'labels',        label: 'Мітки',            icon: Palette,       group: 'Налаштування процесів', adminOnly: true },
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
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#6366f1] bg-[#f0f0ff] px-[8px] py-[4px] rounded-full">
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
          title={isDone ? 'Завершальний статус — за ним рахується прогрес/швидкість/білінг (клік, щоб прибрати)' : 'Позначити завершальним'}
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
      if (authError) {
        const message = authError === 'oneb_already_linked'
          ? 'Цей OneB акаунт уже підключений до іншого користувача'
          : authError === 'oneb_session'
            ? 'Не вдалося підтвердити сесію. Увійдіть ще раз і повторіть підключення OneB'
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
  const [wfSaving,   setWfSaving]   = useState(false);
  const [showSavedCheck, setShowSavedCheck] = useState(false);

  const triggerSavedSuccess = () => {
    setShowSavedCheck(true);
    setTimeout(() => setShowSavedCheck(false), 2500);
  };


  // ── Profile ──
  const [displayName,   setDisplayName]   = useState('');
  const [bio,           setBio]           = useState('');
  const [telegram,      setTelegram]      = useState('');
  const [phone,         setPhone]         = useState('');
  const [location,      setLocation]      = useState('');
  const [skillsInput,   setSkillsInput]   = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // ── Workspace ──
  const [orgName,         setOrgName]         = useState('');
  const [orgLogo,         setOrgLogo]         = useState('');
  const [inviteEmail,     setInviteEmail]     = useState('');
  const [workspaceSaving, setWorkspaceSaving] = useState(false);

  // ── Integration (QT portal) ──
  const [qtEnabled,      setQtEnabled]      = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [qtSaving,       setQtSaving]       = useState(false);

  // ── API Keys ──
  const [apiKeys, setApiKeys] = useState([]);

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
  const [generatingKey, setGeneratingKey] = useState(false);

  // ── Billing ──
  const [orgPlan,        setOrgPlan]        = useState('free');
  const [projectsCount,  setProjectsCount]  = useState(0);
  const [upgrading,      setUpgrading]      = useState(false);

  // ── Notifications ──
  // Events + delivery channels; channel defaults must mirror CHANNEL_DEFAULTS in useNotifications.js
  const [notif, setNotif] = useState({
    assigned: true, commented: true, statusChanged: false, deadline: true, mentioned: true,
    sound: true, popup: true, emailEnabled: false,
  });
  const [notifSaving, setNotifSaving] = useState(false);
  const [pushPerm, setPushPerm] = useState('default'); // browser Notification.permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      queueMicrotask(() => setPushPerm(Notification.permission));
    }
  }, []);

  // ── Localization ──
  const [dateFormat, setDateFormat] = useState('DD.MM.YYYY');
  const [firstDayOfWeek, setFirstDayOfWeek] = useState('Monday');
  const [timeFormat, setTimeFormat] = useState('24h');
  const [timezone, setTimezone] = useState('Europe/Kyiv');
  const [language, setLanguage] = useState('ua');
  const [locSaving, setLocSaving] = useState(false);

  // ── Team invite ──
  const [inviting,    setInviting]    = useState(false);
  const [inviteRole,  setInviteRole]  = useState('member');
  const [showInviteModal, setShowInviteModal] = useState(false);

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
        setBio(currentUser.bio || '');
        setTelegram(currentUser.telegram || '');
        setPhone(currentUser.phone || '');
        setLocation(currentUser.location || '');
        setSkillsInput(Array.isArray(currentUser.skills) ? currentUser.skills.join(', ') : '');
        if (currentUser.localization) {
          setDateFormat(currentUser.localization.dateFormat || 'DD.MM.YYYY');
          setFirstDayOfWeek(currentUser.localization.firstDayOfWeek || 'Monday');
          setTimeFormat(currentUser.localization.timeFormat || '24h');
          setTimezone(currentUser.localization.timezone || 'Europe/Kyiv');
          setLanguage(currentUser.localization.language || 'ua');
        }
      });
    }
  }, [currentUser]); // eslint-disable-line

  useEffect(() => {
    queueMicrotask(() => {
      if (currentUser?.name && !displayName) setDisplayName(currentUser.name);
      if (org?.name && !orgName) setOrgName(org.name);
      if (org?.logo && !orgLogo) setOrgLogo(org.logo);
    });
  }, [currentUser?.name, org?.name, org?.logo]); // eslint-disable-line

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
        }

        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const projQuery = query(collection(db, 'projects'), where('organizationId', '==', activeOrgId));
        const projSnap = await getDocs(projQuery);
        setProjectsCount(projSnap.docs.length);

        const uid = currentUser?.uid || currentUser?.id;
        if (uid) {
          const notifSnap = await getDoc(doc(db, 'users', uid, 'settings', 'notifications'));
          if (notifSnap.exists()) setNotif(p => ({ ...p, ...notifSnap.data() }));
        }
      } catch {}
      setWfLoading(false);
    };
    load();
  }, [activeOrgId, currentUser?.uid, isAdmin]); // eslint-disable-line

  // ── Handlers ─────────────────────────────────────────────────────

  const saveProfile = async () => {
    const uid = currentUser?.uid || currentUser?.id;
    if (!uid) return;
    setProfileSaving(true);
    try {
      const skillsArray = skillsInput
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      await updateDoc(doc(db, 'users', uid), {
        name: displayName.trim(),
        bio: bio.trim(),
        telegram: telegram.trim(),
        phone: phone.trim(),
        location: location.trim(),
        skills: skillsArray,
        updatedAt: serverTimestamp(),
      });
      showToast('Профіль збережено');
      triggerSavedSuccess();
    } catch (e) {
      console.error('Error saving profile:', e);
      showToast('Помилка збереження', 'error');
    }
    setProfileSaving(false);
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

      const redirectUri = getOneBRedirectUri(window.location.origin);
      const state = JSON.stringify({
        mode: 'link',
        r: '/settings?section=auth-methods',
        n: Math.random().toString(36).slice(2),
      });
      const scopes = process.env.NEXT_PUBLIC_ONEB_SCOPES ?? '';
      const scopeParam = scopes ? `&scope=${encodeURIComponent(scopes)}` : '';
      window.location.href = `https://account.oneb.app/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}${scopeParam}&state=${encodeURIComponent(state)}`;
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

  const saveWorkspace = async () => {
    if (!activeOrgId) return;
    setWorkspaceSaving(true);
    try {
      await updateDoc(doc(db, 'organizations', activeOrgId), { 
        name: orgName.trim(), 
        logo: orgLogo.trim(),
        updatedAt: serverTimestamp() 
      });
      showToast('Налаштування організації збережено');
      triggerSavedSuccess();
    } catch { showToast('Помилка збереження', 'error'); }
    setWorkspaceSaving(false);
  };

  const saveWorkflow = async () => {
    if (!activeOrgId) return;
    setWfSaving(true);
    try {
      const clean = arr => arr.map(({ isNew, ...rest }) => rest);
      await setDoc(doc(db, 'organizations', activeOrgId, 'settings', 'workflow'), {
        statuses: clean(statuses),
        types: clean(types),
        priorities: clean(priorities),
        labels: clean(labels),
        positions: clean(positions)
      }, { merge: true });
      showToast('Налаштування збережено');
      triggerSavedSuccess();
    } catch (e) { 
      console.error('Workflow Save Error:', e);
      showToast(e.message || 'Помилка збереження', 'error'); 
    }
    setWfSaving(false);
  };

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

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const uid = currentUser?.uid || currentUser?.id;
      const result = await inviteMember(inviteEmail.trim().toLowerCase(), uid, inviteRole);
      showToast(result.type === 'added_directly' ? 'Учасника додано' : 'Запрошення надіслано');
      setInviteEmail('');
    } catch (err) { showToast(err.message || 'Помилка', 'error'); }
    setInviting(false);
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

  // ── Sticky Save Action ───────────────────────────────────────────
  const getSaveAction = () => {
    switch (activeSection) {
      case 'profile': return { handler: saveProfile, loading: profileSaving, label: 'Зберегти профіль' };
      case 'notifications': return { handler: saveNotifications, loading: notifSaving, label: 'Зберегти сповіщення' };
      case 'localization': return { handler: saveLocalization, loading: locSaving, label: 'Зберегти локалізацію' };
      case 'workspace': return { handler: saveWorkspace, loading: workspaceSaving, label: 'Зберегти налаштування' };
      case 'statuses':
      case 'types':
      case 'priorities':
      case 'labels':
      case 'positions':
        return { handler: saveWorkflow, loading: wfSaving, label: 'Зберегти зміни' };
      default: return null;
    }
  };
  const saveAction = getSaveAction();

  const handleDragEnd = (result, list, setList) => {
    if (!result.destination) return;
    const items = Array.from(list);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setList(items);
  };

  // ── Section renderer ─────────────────────────────────────────────

  const renderSaveButton = (size = "md") => {
    if (!saveAction) return null;
    return (
      <div className="flex items-center gap-2 no-nav">
        {['statuses', 'types', 'priorities', 'labels', 'positions'].includes(activeSection) && (
          <Button 
            onClick={async () => {
              if (!(await confirmDialog({
                title: 'Скинути налаштування цієї секції до стандартних?',
                confirmText: 'Скинути', danger: true,
              }))) return;
              if (activeSection === 'statuses') setStatuses(DEFAULT_STATUSES);
              if (activeSection === 'types') setTypes(DEFAULT_TYPES);
              if (activeSection === 'priorities') setPriorities(DEFAULT_PRIORITIES);
              if (activeSection === 'labels') setLabels(DEFAULT_LABELS);
              if (activeSection === 'positions') setPositions(DEFAULT_POSITIONS);
            }} 
            style="ghost" size={size}
            className="px-4"
          >
            Скинути
          </Button>
        )}
        <Button
          onClick={saveAction.handler}
          loading={saveAction.loading}
          style="primary"
          color="dark"
          size={size}
          icon={showSavedCheck ? Check : undefined}
          className={`px-6 transition-all duration-300 ${showSavedCheck ? '!bg-emerald-600 !hover:bg-emerald-700 text-white' : ''}`}
        >
          {showSavedCheck ? 'Збережено!' : (saveAction.loading ? 'Збереження...' : saveAction.label)}
        </Button>
      </div>
    );
  };
  const saveButton = renderSaveButton();

  const renderSection = () => {
    switch (activeSection) {

      // ──────────────────────────────────────────────────────────────
      case 'profile': return (
        <Section title="Особистий профіль" desc="Ваша інформація відображається у профілі команди, завданнях та чаті" rightAction={saveButton}>
          <Card variant="white" padding="lg" className="!border-none">
            <Row label="Ім'я" desc="Показується в завданнях і чаті">
              <Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-[200px]" />
            </Row>
            <Row label="Email" desc="Використовується для входу та запрошень">
              <span className="text-[13px] text-muted">{currentUser?.email}</span>
            </Row>
            <Row label="Роль">
              <span className="text-[11px] font-semibold px-[8px] py-[3px] bg-[#f0f0f0] text-[#4a4a4a] rounded-full">
                {ROLE_LABELS[myRole] || myRole}
              </span>
            </Row>
            <Row label="Telegram" desc="Ваш нікнейм без @ (наприклад: username)">
              <Input value={telegram} onChange={e => setTelegram(e.target.value)} placeholder="username" className="w-[200px]" />
            </Row>
            <Row label="Телефон" desc="Контактний номер">
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+380..." className="w-[200px]" />
            </Row>
            <Row label="Локація" desc="Місто, країна">
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Київ, Україна" className="w-[200px]" />
            </Row>
            <Row label="Навички" desc="Вкажіть через кому (наприклад: React, UI Design, QA)">
              <Input value={skillsInput} onChange={e => setSkillsInput(e.target.value)} placeholder="React, Node.js, Design" className="w-[300px]" />
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
      case 'notifications': return (
        <Section title="Сповіщення" desc="Канали доставки та події, про які тебе повідомляти" rightAction={saveButton}>
          {/* Канали доставки */}
          <Card variant="white" padding="lg" className="!border-none">
            <p className="text-[11px] font-bold text-muted uppercase tracking-wider pb-2">Канали</p>
            <Row
              label="Push у браузері"
              desc={
                pushPerm === 'granted' ? 'Системні сповіщення увімкнено для цього браузера'
                : pushPerm === 'denied' ? 'Заблоковано браузером — дозволь сповіщення для сайту в налаштуваннях браузера'
                : 'Системні сповіщення, навіть коли вкладка не активна'
              }
            >
              {pushPerm === 'granted' ? (
                <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#10b981]">
                  <Check size={13} /> Увімкнено
                </span>
              ) : pushPerm === 'denied' ? (
                <span className="text-[12px] font-medium text-muted">Заблоковано</span>
              ) : (
                <Button
                  onClick={async () => {
                    const result = await Notification.requestPermission();
                    setPushPerm(result);
                    showToast(result === 'granted' ? 'Push-сповіщення увімкнено' : 'Доступ відхилено');
                  }}
                  style="secondary" size="md"
                >
                  Увімкнути
                </Button>
              )}
            </Row>
            <Row label="Звук" desc="Короткий сигнал при новому сповіщенні">
              <ToggleSwitch checked={notif.sound} onChange={v => setNotif(p => ({ ...p, sound: v }))} size="sm" />
            </Row>
            <Row label="Спливаючі сповіщення" desc="Картка внизу екрана, коли подія стається в реальному часі">
              <ToggleSwitch checked={notif.popup} onChange={v => setNotif(p => ({ ...p, popup: v }))} size="sm" />
            </Row>
            <Row label="Email" desc="Найважливіше (призначення, згадки, дедлайни) — дублювати на пошту">
              <ToggleSwitch checked={notif.emailEnabled} onChange={v => setNotif(p => ({ ...p, emailEnabled: v }))} size="sm" />
            </Row>
            <Row label="Перевірка" desc="Надішли собі тестове сповіщення — перевір звук, попап і push разом">
              <Button style="secondary" size="md" icon={Bell} onClick={sendTestNotification}>
                Надіслати тест
              </Button>
            </Row>
          </Card>

          {/* Події */}
          <Card variant="white" padding="lg" className="!border-none">
            <p className="text-[11px] font-bold text-muted uppercase tracking-wider pb-2">Події</p>
            {[
              { key: 'assigned',      label: 'Завдання призначено мені', desc: 'Хтось призначив завдання на тебе або створив нове одразу з тобою' },
              { key: 'commented',     label: 'Новий коментар',           desc: 'У завданнях, де ти виконавець або автор' },
              { key: 'mentioned',     label: 'Згадування',               desc: 'Хтось написав @твоє-імʼя в коментарі' },
              { key: 'statusChanged', label: 'Зміна статусу',            desc: 'Коли твоє завдання рухається по дошці' },
              { key: 'deadline',      label: 'Дедлайни',                 desc: 'За 24 години до дедлайну та щодня для прострочених завдань' },
            ].map(n => (
              <Row key={n.key} label={n.label} desc={n.desc}>
                <ToggleSwitch checked={notif[n.key]} onChange={v => setNotif(p => ({ ...p, [n.key]: v }))} size="sm" />
              </Row>
            ))}
          </Card>
        </Section>
      );

      // ──────────────────────────────────────────────────────────────
      case 'localization': return (
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
                  { value: 'DD.MM.YYYY', label: 'DD.MM.YYYY (13.05.2026)' },
                  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2026-05-13)' },
                  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (05/13/2026)' }
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
                  { value: '24h', label: '24-годинний (14:30)' },
                  { value: '12h', label: '12-годинний (2:30 PM)' }
                ]}
                className="w-[240px]"
              />
            </Row>
            <Row label="Часовий пояс" desc="Поточний регіональний час для планування">
              <Select
                value={timezone}
                onChange={setTimezone}
                options={[
                  { value: 'Europe/Kyiv', label: 'Europe/Kyiv (GMT+3)' },
                  { value: 'UTC', label: 'UTC (GMT+0)' },
                  { value: 'America/New_York', label: 'America/New_York (GMT-4)' },
                  { value: 'Europe/London', label: 'Europe/London (GMT+1)' }
                ]}
                className="w-[240px]"
              />
            </Row>
          </Card>
        </Section>
      );

      // ──────────────────────────────────────────────────────────────
      case 'workspace': return (
        <Section title="Загальні" desc="Загальні налаштування вашої організації" rightAction={saveButton}>
          <Card variant="white" padding="lg" className="!border-none">
            <Row label="Назва організації" desc="Видима всім у вашій організації">
              <Input value={orgName} onChange={e => setOrgName(e.target.value)} className="w-[200px]" />
            </Row>
            <Row label="Логотип організації" desc="Зображення для вашої організації (рекомендовано 1:1)">
              <ImageUpload value={orgLogo} onChange={setOrgLogo} theme="light" showLabel={false} showHint={false} />
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
        </Section>
      );



      // ──────────────────────────────────────────────────────────────
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

            {/* QT Portal — головна інтеграція */}
            <Card variant="white" padding="lg" className="mb-4 !border-none">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-[10px] bg-white border border-line flex items-center justify-center shrink-0 overflow-hidden">
                  <Image src="/quickteam.png" alt="" width={30} height={30} className="object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <div>
                      <p className="text-[14px] font-semibold text-ink">QuickTeam+</p>
                      <p className="text-[12px] text-muted mt-[2px]">Синхронізація клієнтських запитів з порталу</p>
                    </div>
                    <div className="shrink-0">
                      <ToggleSwitch
                        checked={qtEnabled}
                        onChange={saveIntegration}
                      />
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[#f0f0f0] flex items-center gap-3 flex-wrap">
                    {qtEnabled ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-[3px] rounded-full bg-green-50 text-[#10b981]">
                        <span className="w-[5px] h-[5px] rounded-full bg-[#10b981]" />
                        Підключено
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-[3px] rounded-full bg-[#f5f5f5] text-muted">
                        <span className="w-[5px] h-[5px] rounded-full bg-faint" />
                        Вимкнено
                      </span>
                    )}
                    {qtEnabled && PORTAL_URL && (
                      <a
                        href={PORTAL_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[12px] text-[#6366f1] font-semibold hover:underline"
                      >
                        Відкрити портал <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* BuggyBag Portal */}
            <Card variant="white" padding="lg" className="mb-4 !border-none">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-[10px] bg-white border border-line flex items-center justify-center shrink-0 overflow-hidden">
                  <Image src="/bug-logo.png" alt="" width={30} height={30} className="object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <div>
                      <p className="text-[14px] font-semibold text-ink flex items-center gap-2">
                        BuggyBag Portal
                      </p>
                      <p className="text-[12px] text-muted mt-[2px]">Перетворюйте баг-репорти в завдання автоматично</p>
                    </div>
                    <div className="shrink-0">
                      <ToggleSwitch
                        checked={buggyBagEnabled}
                        onChange={toggleBuggyBag}
                      />
                    </div>
                  </div>

                  {/* Status + info */}
                  <div className="mt-3 pt-3 border-t border-[#f0f0f0] flex flex-col gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      {buggyBagEnabled ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-[3px] rounded-full bg-green-50 text-[#10b981]">
                          <span className="w-[5px] h-[5px] rounded-full bg-[#10b981]" />
                          Підключено
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-[3px] rounded-full bg-[#f5f5f5] text-muted">
                          <span className="w-[5px] h-[5px] rounded-full bg-faint" />
                          Вимкнено
                        </span>
                      )}

                      <a
                        href="http://localhost:3000/projects"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[12px] text-[#6366f1] font-semibold cursor-pointer hover:underline"
                      >
                        Відкрити BuggyBag <ExternalLink size={11} />
                      </a>
                    </div>
                    
                    {buggyBagEnabled && (
                      <div className="bg-[#fcfcfc] border border-line rounded-[8px] p-4 mt-1">
                        <p className="text-[12px] font-semibold text-ink mb-3">Вставте ці дані в налаштуваннях BuggyBag:</p>
                        <div className="grid grid-cols-[100px_1fr] gap-3 items-center mb-3">
                          <span className="text-[11px] text-muted uppercase tracking-wider font-bold">API Token</span>
                          <div className="flex items-center gap-2">
                            <code className="text-[12px] font-mono bg-white border border-line px-3 py-1.5 rounded flex-1 select-all">
                              {buggyBagKey.token || `${buggyBagKey.prefix || 'qt_'}••••••••••••••••`}
                            </code>
                            {buggyBagKey.token && (
                              <Button onClick={() => { navigator.clipboard.writeText(buggyBagKey.token); showToast('Токен скопійовано'); }} style="ghost" size="icon-sm" icon={Copy} iconSize={14} />
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-[100px_1fr] gap-3 items-center">
                          <span className="text-[11px] text-muted uppercase tracking-wider font-bold">Org ID</span>
                          <div className="flex items-center gap-2">
                            <code className="text-[12px] font-mono bg-white border border-line px-3 py-1.5 rounded flex-1 select-all">{activeOrgId}</code>
                            <Button onClick={() => { navigator.clipboard.writeText(activeOrgId); showToast('ID скопійовано'); }} style="ghost" size="icon-sm" icon={Copy} iconSize={14} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* What syncs */}
                  <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
                    {[
                      'Баг-репорти',
                      'Скріншоти та консоль',
                      'Коментарі клієнтів',
                      'Статуси завдань',
                    ].map(item => (
                      <div key={item} className="flex items-center gap-2 text-[12px] text-faint">
                        <span className="w-[4px] h-[4px] rounded-full shrink-0 bg-[#e0e0e0]" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
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
        <Section title="Учасники команди" desc="Керування учасниками організації та їхніми ролями" rightAction={
          <Button onClick={() => setShowInviteModal(true)} style="primary" size="md" icon={Plus}>Запросити</Button>
        }>
          <Surface variant="card" className="!rounded-[12px] p-0 overflow-visible relative z-10">
            <div className="flex flex-col divide-y divide-[#f0f0f0] rounded-[12px]">
              {members.map((member, i) => {
                const isMe = member.id === (currentUser?.uid || currentUser?.id);
                return (
                  <div key={member.id} className={`p-4 px-6 flex items-center justify-between hover:bg-[#fcfcfc] transition-colors ${i === 0 ? 'rounded-t-[12px]' : ''} ${i === members.length - 1 ? 'rounded-b-[12px]' : ''}`}>
                    <div className="flex items-center gap-3">
                      <UserAvatar user={member} size={40} />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[14px] font-bold text-ink">{member.name || member.email}</p>
                          {isMe && <span className="text-[10px] font-bold text-muted uppercase tracking-wider bg-canvas px-1.5 py-0.5 rounded-md">Ти</span>}
                        </div>
                        <p className="text-[12px] text-muted">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* Position */}
                      <Select
                        value={member.positionId || ''}
                        onChange={(val) => handlePositionChange(member.id, val)}
                        options={[{value: '', label: 'Без посади'}, ...positions.map(p => ({value: p.id, label: p.label}))]}
                        className="w-[160px]"
                        buttonClassName="bg-canvas rounded-[10px] px-[12px] h-[36px]"
                        disabled={!isAdmin}
                      />
                      
                      {/* Role */}
                      <Select
                        value={member.role}
                        onChange={(val) => handleRoleChange(member.id, val)}
                        options={member.role === 'owner'
                          ? [{ value: 'owner', label: ROLE_LABELS.owner }]
                          : ASSIGNABLE_ROLE_OPTIONS}
                        className="w-[140px]"
                        buttonClassName="bg-canvas rounded-[10px] px-[12px] h-[36px]"
                        disabled={!(isOwner && !isMe)}
                      />

                      {/* Actions */}
                      <div className="flex items-center gap-1 w-[68px] justify-end">
                        {isAdmin && !isMe && (
                          <>
                            {isOwner && member.role === 'admin' && (
                              <Button onClick={() => handleTransferOwnership(member.id)} style="ghost" size="icon" title="Передати права власника" icon={Shield} className="text-orange-500 hover:text-orange-600" />
                            )}
                            <Button onClick={() => handleRemoveMember(member.id)} style="ghost" color="red" size="icon" icon={Trash2} />
                          </>
                        )}
                      </div>
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
        <Section title="Статуси завдань" desc="Статуси завдань — застосовуються до всіх проєктів. Позначте «завершальні» — за ними рахується прогрес, швидкість, прострочені та білінг." rightAction={saveButton}>
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
        </Section>
        );
      }

      case 'types': return (
        <Section title="Типи завдань" desc="Типи завдань — застосовуються до всіх проєктів" rightAction={saveButton}>
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
        </Section>
      );

      case 'priorities': return (
        <Section title="Пріоритети завдань" desc="Пріоритети завдань — застосовуються до всіх проєктів" rightAction={saveButton}>
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
        </Section>
      );

      case 'labels': return (
        <Section title="Мітки завдань" desc="Глобальні мітки для маркування завдань" rightAction={saveButton}>
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
        </Section>
      );

      case 'positions': return (
        <Section title="Посади та ставки" desc="Налаштування посад команди та погодинних ставок виконавців" rightAction={saveButton}>
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
                    confirmText: 'Скинути', danger: true,
                  }))) return;
                  setStatuses(DEFAULT_STATUSES);
                  setTypes(DEFAULT_TYPES);
                  setPriorities(DEFAULT_PRIORITIES);
                  setLabels(DEFAULT_LABELS);
                  await saveWorkflow();
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

  const handleNavChange = (id) => {
    setActiveSection(id);
    setMobilePane('content');
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



      <Dialog
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Запросити нового учасника"
        size="md"
        footer={
          <>
            <Button onClick={() => setShowInviteModal(false)} style="secondary" size="md">Скасувати</Button>
            <Button onClick={async () => { await handleInvite(); setShowInviteModal(false); }} loading={inviting} disabled={inviting || !inviteEmail.trim()} style="primary" size="md">Надіслати запрошення</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 min-h-[200px]">
          <Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@example.com" label="Email учасника" />
          <Select value={inviteRole} onChange={setInviteRole} options={ASSIGNABLE_ROLE_OPTIONS} label="Роль" />
        </div>
      </Dialog>
    </SidebarLayout>
  );
}
