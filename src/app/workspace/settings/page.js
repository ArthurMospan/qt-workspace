'use client';
// src/app/workspace/settings/page.js — Redesigned Settings (clean, no emoji, QT-style)
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext }  from '@/lib/context/AppContext';
import useWorkspaceStore  from '@/store/useWorkspaceStore';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import {
  User, Bell, Shield, Zap, Users, GitBranch,
  Palette, Check, Plus, Trash2, Edit2, X, Save,
  Building, LogOut, Download, RefreshCw, Mail,
  Copy, ExternalLink, ChevronRight, AlertTriangle,
  Link2, PlugZap, ToggleLeft, ToggleRight, Receipt, CreditCard,
  Globe, Tag as TagIcon, Briefcase, GripVertical,
  Archive, ArchiveRestore, Bug, LayoutTemplate
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

// ── Constants ────────────────────────────────────────────────────────
const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://qt-green.vercel.app';

const ROLE_LABELS = {
  owner: 'Власник',
  admin: 'Адміністратор',
  member: 'Учасник'
};

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
  { id: 'blocker', label: 'Blocker', color: '#dc2626' },
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
        <p className={`text-[13px] font-medium leading-snug ${danger ? 'text-red-600' : 'text-[#1f1f1f]'}`}>{label}</p>
        {desc && <p className={`text-[12px] mt-[2px] leading-relaxed ${danger ? 'text-red-400' : 'text-[#9a9a9a]'}`}>{desc}</p>}
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
          <h2 className="text-[20px] font-bold text-[#1f1f1f] tracking-tight">{title}</h2>
          {desc && <p className="text-[13px] text-[#9a9a9a] mt-[4px] leading-relaxed">{desc}</p>}
        </div>
        {rightAction && <div className="shrink-0 flex items-center gap-2">{rightAction}</div>}
      </div>
      <div className="flex flex-col gap-[24px]">
        {children}
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

function WorkflowItem({ item, onSave, onDelete, canDelete = true, variant = 'status', provided }) {
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
      className="flex items-center gap-3 py-[8px] px-[8px] -mx-[8px] rounded-[12px] hover:bg-[#f4f4f5] transition-colors group bg-white"
    >
      {provided?.dragHandleProps && (
        <div {...provided.dragHandleProps} className="shrink-0 text-[#cfcfcf] hover:text-[#1f1f1f] cursor-grab active:cursor-grabbing">
          <GripVertical size={14} />
        </div>
      )}
      {/* Color */}
      <div className="relative shrink-0">
        <button
          onClick={() => setShowPalette(v => !v)}
          className="w-[14px] h-[14px] rounded-full ring-2 ring-offset-2 ring-transparent hover:ring-[#1f1f1f]/20 transition-all"
          style={{ background: color }}
        />
        {showPalette && (
          <div className="absolute left-0 top-[22px] z-20 bg-white border border-[#e9e9e9] rounded-[10px] p-[10px] shadow-lg grid grid-cols-5 gap-[6px] w-[148px]">
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
        <span className="flex-1 text-[13px] font-semibold text-[#1f1f1f]">{item.label}</span>
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

      {/* Actions */}
      <div className="flex items-center justify-end gap-1 shrink-0 w-[64px]">
        {editing ? (
          <>
            <Button onClick={save} style="ghost" color="green" size="icon" icon={Check} iconSize={12} />
            <Button
              onClick={() => {
                if (item.isNew) { onDelete(item.id); }
                else { setEditing(false); setLabel(item.label); setColor(item.color); }
              }}
              style="ghost" color="gray" size="icon" icon={X} iconSize={12}
            />
          </>
        ) : (
          <>
            <Button onClick={() => setEditing(true)}
              style="ghost" color="gray" size="icon" icon={Edit2} iconSize={11}
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
    <div className="flex items-center gap-3 py-[8px] px-[8px] -mx-[8px] rounded-[12px] hover:bg-[#f4f4f5] transition-colors group">
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
            <span className="text-[12px] text-[#9a9a9a]">$</span>
            <Input
              type="number"
              value={hourlyRate}
              onChange={e => setHourlyRate(e.target.value)}
              placeholder="Ставка"
              className="h-[28px] text-[12px] w-[50px] text-right"
            />
            <span className="text-[11px] text-[#9a9a9a]">/год</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-between">
          <span className="text-[13px] font-semibold text-[#1f1f1f]">{item.label}</span>
          <span className="text-[12px] font-medium text-[#9a9a9a]">${item.hourlyRate || 0}/год</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-1 shrink-0 w-[64px]">
        {editing ? (
          <>
            <Button onClick={save} style="ghost" color="green" size="icon" icon={Check} iconSize={12} />
            <Button
              onClick={() => {
                if (item.isNew) { onDelete(item.id); }
                else { setEditing(false); setLabel(item.label); setHourlyRate(item.hourlyRate); }
              }}
              style="ghost" color="gray" size="icon" icon={X} iconSize={12}
            />
          </>
        ) : (
          <>
            <Button onClick={() => setEditing(true)}
              style="ghost" color="gray" size="icon" icon={Edit2} iconSize={11}
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
  const { currentUser, signOut, activeOrgId, projects } = useAppContext();
  const showToast = useWorkspaceStore(s => s.showToast);
  const confirmDialog = useConfirm();
  const { org, members, inviteMember, changeMemberRole, removeMember, setMemberPosition } = useOrganization();

  // Role resolution
  const myMemberInfo = members.find(m => m.id === (currentUser?.uid || currentUser?.id));
  const myRole = myMemberInfo?.role || 'member';
  const isAdmin = myRole === 'owner' || myRole === 'admin';
  const isOwner = myRole === 'owner';

  const [activeSection, setActiveSection] = useState('profile');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const sec = searchParams.get('section');
      if (sec) {
        setActiveSection(sec);
      }
    }
  }, []);

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
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [qtSaving,       setQtSaving]       = useState(false);

  // ── API Keys ──
  const [apiKeys, setApiKeys] = useState([]);
  const [generatingKey, setGeneratingKey] = useState(false);

  // ── Billing ──
  const [orgPlan,        setOrgPlan]        = useState('free');
  const [projectsCount,  setProjectsCount]  = useState(0);
  const [upgrading,      setUpgrading]      = useState(false);

  // ── Notifications ──
  const [notif, setNotif] = useState({
    assigned: true, commented: true, statusChanged: false, deadline: true, mentioned: true,
  });
  const [notifSaving, setNotifSaving] = useState(false);

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

  // Sync from Firestore (initial only)
  useEffect(() => {
    if (currentUser) {
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
    }
  }, [currentUser]); // eslint-disable-line

  useEffect(() => {
    if (currentUser?.name && !displayName) setDisplayName(currentUser.name);
    if (org?.name && !orgName) setOrgName(org.name);
    if (org?.logo && !orgLogo) setOrgLogo(org.logo);
  }, [currentUser?.name, org?.name, org?.logo]); // eslint-disable-line

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
          setApiKeys(orgData.apiKeys || []);
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
  }, [activeOrgId, currentUser?.uid]); // eslint-disable-line

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

  const saveIntegration = async (enabled) => {
    if (!activeOrgId) return;
    
    // If user is trying to turn it OFF, show confirmation
    if (qtEnabled && !enabled) {
      setShowDisableConfirm(true);
      return;
    }

    // Otherwise (turning ON), do it immediately
    await confirmSaveIntegration(true);
  };

  const confirmSaveIntegration = async (enabled) => {
    setQtSaving(true);
    setShowDisableConfirm(false);
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
      const newToken = `qt_${crypto.randomUUID().replace(/-/g, '')}`;
      const newKey = {
        id: Date.now().toString(),
        token: newToken,
        name: `Key ${new Date().toLocaleDateString()}`,
        createdAt: new Date().toISOString(),
        active: true
      };
      
      const updatedKeys = [...apiKeys, newKey];
      await updateDoc(doc(db, 'organizations', activeOrgId), { apiKeys: updatedKeys });
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
      await updateDoc(doc(db, 'organizations', activeOrgId), { apiKeys: updatedKeys });
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
      const uid = currentUser?.id || currentUser?.uid;
      // Ролі живуть у orgMemberships (джерело правди після міграції 006), не в legacy members[]
      await updateDoc(doc(db, 'orgMemberships', `${activeOrgId}_${uid}`), { role: 'admin' });
      await updateDoc(doc(db, 'orgMemberships', `${activeOrgId}_${targetUid}`), { role: 'owner' });
      await updateDoc(doc(db, 'organizations', activeOrgId), { ownerId: targetUid });
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

  const handleDeleteOrg = async (type) => {
    if (!activeOrgId) return;
    try {
      if (type === 'hard') {
        const typed = await confirmDialog({
          title: 'Видалити організацію назавжди?',
          message: 'Введіть DELETE для повного та безповоротного видалення організації.',
          confirmText: 'Видалити', danger: true,
          input: { placeholder: 'DELETE' },
        });
        if (typed !== 'DELETE') return;
        await deleteDoc(doc(db, 'organizations', activeOrgId));
        showToast('Організацію повністю видалено');
        setTimeout(() => window.location.href = '/workspace', 1000);
      } else if (type === 'soft') {
        const typed = await confirmDialog({
          title: 'Видалити організацію через 30 днів?',
          message: 'Введіть 30 для видалення організації через 30 днів (ви зможете її відновити).',
          confirmText: 'Запланувати видалення', danger: true,
          input: { placeholder: '30' },
        });
        if (typed !== '30') return;
        
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);
        
        await updateDoc(doc(db, 'organizations', activeOrgId), {
          status: 'pending_deletion',
          deleteAt: futureDate.toISOString()
        });
        showToast('Організацію заплановано до видалення');
      }
    } catch (e) {
      showToast('Помилка видалення', 'error');
    }
  };

  const handleUpgradePlan = async (newPlan = 'pro') => {
    showToast('Підключення платіжної системи в розробці 🛠️');
  };

  const unarchiveProject = async (id) => {
    try {
      await updateDoc(doc(db, 'projects', id), { status: 'active' });
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
      const { collection, query, where, getDocs, writeBatch } = await import('firebase/firestore');
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
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.update(d.ref, { columnId: targetColId }));
        await batch.commit();
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
            style="ghost" color="gray" size={size}
            className="rounded-xl px-4"
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
          className={`rounded-xl px-6 transition-all duration-300 ${showSavedCheck ? '!bg-emerald-600 !hover:bg-emerald-700 text-white' : ''}`}
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
              <span className="text-[13px] text-[#9a9a9a]">{currentUser?.email}</span>
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
            <div className="flex flex-col gap-2 py-[12px] border-t border-[#f4f4f5] mt-2">
              <label className="text-[13px] font-medium text-[#1f1f1f]">Про себе</label>
              <p className="text-[12px] text-[#9a9a9a] -mt-1 leading-relaxed">Коротка інформація про вашу роль, досвід чи інтереси</p>
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

      // ──────────────────────────────────────────────────────────────
      case 'notifications': return (
        <Section title="Сповіщення" desc="Налаштуй які події надсилають тобі сповіщення" rightAction={saveButton}>
          <Card variant="white" padding="lg" className="!border-none">
            {[
              { key: 'assigned',      label: 'Задачу призначено мені',   desc: 'Хтось призначив завдання на тебе' },
              { key: 'commented',     label: 'Новий коментар',           desc: 'В завдання де ти виконавець або автор' },
              { key: 'statusChanged', label: 'Зміна статусу завдання',     desc: 'Коли змінюється статус твоїх завдань' },
              { key: 'deadline',      label: 'Нагадування про дедлайн',  desc: 'За 24 години до дедлайну' },
              { key: 'mentioned',     label: 'Згадування в коментарях',  desc: 'Хтось написав @ваше-ім\'я' },
            ].map(n => (
              <Row key={n.key} label={n.label} desc={n.desc}>
                <ToggleSwitch checked={notif[n.key]} onChange={v => setNotif(p => ({ ...p, [n.key]: v }))} size="sm" />
              </Row>
            ))}
          </Card>
          <Card variant="white" padding="lg" className="!border-none">
            <Row label="Push-сповіщення у браузері" desc="Отримувати сповіщення навіть коли вкладка закрита">
              <Button
                onClick={async () => {
                  const result = await Notification.requestPermission();
                  showToast(result === 'granted' ? 'Push-сповіщення увімкнено' : 'Доступ відхилено');
                }}
                style="secondary" color="blue" size="lg"
              >
                {typeof window !== 'undefined' && window.Notification?.permission === 'granted'
                  ? 'Увімкнено'
                  : 'Увімкнути'}
              </Button>
            </Row>
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
                <code className="text-[12px] bg-[#f4f4f5] border border-[#e9e9e9] px-2 py-1 rounded-[6px] text-[#9a9a9a] font-mono">
                  {activeOrgId || 'quickteam'}
                </code>
                <Button
                  onClick={() => { navigator.clipboard.writeText(activeOrgId || 'quickteam'); showToast('Скопійовано'); }}
                  style="ghost" color="blue" size="icon-sm"
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
            const newToken = `qt_${crypto.randomUUID().replace(/-/g, '')}`;
            const newKey = { id: Date.now().toString(), token: newToken, name: 'BuggyBag Integration', createdAt: new Date().toISOString(), active: true };
            const updatedKeys = [...apiKeys, newKey];
            await updateDoc(doc(db, 'organizations', activeOrgId), { apiKeys: updatedKeys });
            setApiKeys(updatedKeys);
            showToast('Інтеграцію з BuggyBag увімкнено!');
          } else {
            if (buggyBagKey) {
              const updatedKeys = apiKeys.filter(k => k.id !== buggyBagKey.id);
              await updateDoc(doc(db, 'organizations', activeOrgId), { apiKeys: updatedKeys });
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
                <div className="w-10 h-10 rounded-[10px] bg-[#6366f1] flex items-center justify-center shrink-0">
                  <LayoutTemplate size={16} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <div>
                      <p className="text-[14px] font-semibold text-[#1f1f1f]">QuickTeam+</p>
                      <p className="text-[12px] text-[#9a9a9a] mt-[2px]">Синхронізація клієнтських запитів з порталу</p>
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
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-[3px] rounded-full bg-[#f5f5f5] text-[#9a9a9a]">
                        <span className="w-[5px] h-[5px] rounded-full bg-[#cfcfcf]" />
                        Вимкнено
                      </span>
                    )}
                    {qtEnabled && (
                      <a
                        href={process.env.NEXT_PUBLIC_PORTAL_URL || 'https://qt-green.vercel.app'}
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
                <div className="w-10 h-10 rounded-[10px] bg-[#fdf2f8] flex items-center justify-center shrink-0">
                  <svg width="18" height="18" viewBox="0 0 194 194" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[#db2777]">
                    <path d="M10.7365 18.4947C-0.604524 20.9451 -6.27503 -5.19299 10.7365 0.933186C24.3457 5.83418 36.659 21.4903 41.1144 28.7056L42.7999 31.4049C54.7817 28.0012 71.5545 27.9996 97.0001 27.9996C122.445 27.9996 139.218 28.0014 151.199 31.4049L152.886 28.7056C157.341 21.4903 169.655 5.83418 183.264 0.933186C200.275 -5.19278 194.605 20.9448 183.264 18.4947C174.191 16.5343 165.982 22.0348 163.012 25.0299L157.341 31.1558L156.075 33.0904C159.532 34.5302 162.546 36.377 165.248 38.7467C166.669 39.9929 168.008 41.3305 169.254 42.7515C180 55.0055 180 73.6704 180 111C180 148.329 180 166.994 169.254 179.248C168.008 180.669 166.669 182.007 165.248 183.253C152.994 194 134.33 194 97.0001 194C59.6708 194 41.006 194 28.7521 183.253C27.331 182.007 25.9925 180.669 24.7462 179.248C14.0002 166.994 14.0001 148.329 14.0001 111C14.0001 73.6703 13.9999 55.0054 24.7462 42.7515C25.9925 41.3304 27.331 39.9929 28.7521 38.7467C31.454 36.3772 34.4674 34.5302 37.924 33.0904L36.6593 31.1558L30.9884 25.0299C28.0181 22.0348 19.8093 16.5343 10.7365 18.4947Z" fill="currentColor"/>
                    <path d="M30.6001 102.7C30.6001 86.6564 43.6062 73.6503 59.6501 73.6503C75.6939 73.6503 88.7001 86.6564 88.7001 102.7V106.85C88.7001 122.894 75.6939 135.9 59.6501 135.9C43.6062 135.9 30.6001 122.894 30.6001 106.85V102.7Z" fill="white"/>
                    <path d="M105.3 102.7C105.3 86.6564 118.306 73.6503 134.35 73.6503C150.394 73.6503 163.4 86.6564 163.4 102.7V106.85C163.4 122.894 150.394 135.9 134.35 135.9C118.306 135.9 105.3 122.894 105.3 106.85V102.7Z" fill="white"/>
                    <path d="M126.05 97.512C126.05 88.917 133.018 81.9495 141.613 81.9495C150.208 81.9495 157.175 88.917 157.175 97.512C157.175 106.107 150.208 113.074 141.613 113.074C133.018 113.074 126.05 106.107 126.05 97.512Z" fill="currentColor"/>
                    <path d="M51.3501 97.512C51.3501 88.917 58.3176 81.9495 66.9126 81.9495C75.5075 81.9495 82.4751 88.917 82.4751 97.512C82.4751 106.107 75.5075 113.074 66.9126 113.074C58.3176 113.074 51.3501 106.107 51.3501 97.512Z" fill="currentColor"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <div>
                      <p className="text-[14px] font-semibold text-[#1f1f1f] flex items-center gap-2">
                        BuggyBag Portal
                      </p>
                      <p className="text-[12px] text-[#9a9a9a] mt-[2px]">Перетворюйте баг-репорти в завдання автоматично</p>
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
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-[3px] rounded-full bg-[#f5f5f5] text-[#9a9a9a]">
                          <span className="w-[5px] h-[5px] rounded-full bg-[#cfcfcf]" />
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
                      <div className="bg-[#fcfcfc] border border-[#e9e9e9] rounded-[8px] p-4 mt-1">
                        <p className="text-[12px] font-semibold text-[#1f1f1f] mb-3">Вставте ці дані в налаштуваннях BuggyBag:</p>
                        <div className="grid grid-cols-[100px_1fr] gap-3 items-center mb-3">
                          <span className="text-[11px] text-[#9a9a9a] uppercase tracking-wider font-bold">API Token</span>
                          <div className="flex items-center gap-2">
                            <code className="text-[12px] font-mono bg-white border border-[#e9e9e9] px-3 py-1.5 rounded flex-1 select-all">{buggyBagKey.token}</code>
                            <button onClick={() => { navigator.clipboard.writeText(buggyBagKey.token); showToast('Токен скопійовано'); }} className="text-[#9a9a9a] hover:text-[#1f1f1f] transition-colors"><Copy size={14} /></button>
                          </div>
                        </div>
                        <div className="grid grid-cols-[100px_1fr] gap-3 items-center">
                          <span className="text-[11px] text-[#9a9a9a] uppercase tracking-wider font-bold">Org ID</span>
                          <div className="flex items-center gap-2">
                            <code className="text-[12px] font-mono bg-white border border-[#e9e9e9] px-3 py-1.5 rounded flex-1 select-all">{activeOrgId}</code>
                            <button onClick={() => { navigator.clipboard.writeText(activeOrgId); showToast('ID скопійовано'); }} className="text-[#9a9a9a] hover:text-[#1f1f1f] transition-colors"><Copy size={14} /></button>
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
                      <div key={item} className="flex items-center gap-2 text-[12px] text-[#cfcfcf]">
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
              <div className={`bg-gradient-to-r ${isPro ? 'from-[#fefce8] to-[#fffbeb]' : 'from-[#eef2ff] to-white'} px-6 py-6 border-b border-[#e9e9e9]`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`inline-block px-[10px] py-[3px] ${isPro ? 'bg-[#eab308]' : 'bg-[#6366f1]'} text-white text-[10px] font-bold uppercase tracking-wider rounded-full mb-3 shadow-sm`}>
                      {isPro ? 'PRO Plan' : 'Free Plan'}
                    </span>
                    <h3 className="text-[20px] font-bold text-[#1f1f1f] mb-1">{isPro ? 'Професійний тариф' : 'Безкоштовний тариф'}</h3>
                    <p className="text-[13px] text-[#9a9a9a]">{isPro ? 'Безлімітні проєкти та всі функції розблоковано' : 'Використовується для тестування (Demo)'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[32px] font-black text-[#1f1f1f] leading-none mb-1">{isPro ? '$15' : '$0'}<span className="text-[14px] text-[#cfcfcf] font-medium">/міс</span></p>
                  </div>
                </div>
              </div>
              
              <div className="px-6 py-5">
                <p className="text-[12px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-4">Ліміти плану</p>
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="flex items-center justify-between text-[13px] font-medium mb-2">
                      <span className="text-[#4a4a4a]">Учасники команди</span>
                      <span className="text-[#1f1f1f]">{members.length} / Необмежено</span>
                    </div>
                    <div className="h-[6px] bg-[#f0f0f0] rounded-full overflow-hidden">
                      <div className="h-full bg-[#10b981] rounded-full" style={{ width: '15%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[13px] font-medium mb-2">
                      <span className="text-[#4a4a4a]">Активні проєкти</span>
                      <span className="text-[#1f1f1f]">{projectsCount} / {isPro ? 'Необмежено' : projectLimit}</span>
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

              <div className="px-6 py-4 bg-[#fcfcfc] border-t border-[#e9e9e9] flex justify-end">
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
                          <p className="text-[14px] font-bold text-[#1f1f1f]">{member.name || member.email}</p>
                          {isMe && <span className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider bg-[#f4f4f5] px-1.5 py-0.5 rounded-md">Ти</span>}
                        </div>
                        <p className="text-[12px] text-[#9a9a9a]">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* Position */}
                      <Select
                        value={member.positionId || ''}
                        onChange={(val) => handlePositionChange(member.id, val)}
                        options={[{value: '', label: 'Без посади'}, ...positions.map(p => ({value: p.id, label: p.label}))]}
                        className="w-[160px]"
                        buttonClassName="bg-[#f4f4f5] rounded-[10px] px-[12px] h-[36px]"
                        disabled={!isAdmin}
                      />
                      
                      {/* Role */}
                      <Select
                        value={member.role}
                        onChange={(val) => handleRoleChange(member.id, val)}
                        options={Object.entries(ROLE_LABELS).map(([k,v]) => ({value: k, label: v}))}
                        className="w-[140px]"
                        buttonClassName="bg-[#f4f4f5] rounded-[10px] px-[12px] h-[36px]"
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
      case 'statuses': return (
        <Section title="Статуси завдань" desc="Статуси завдань — застосовуються до всіх проєктів" rightAction={saveButton}>
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
                style="ghost" color="gray" size="lg"
                icon={Plus} iconSize={13}
                className="w-full justify-start py-3 mt-2"
              >
                Додати статус
              </Button>
            </Card>
          )}
        </Section>
      );

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
                style="ghost" color="gray" size="lg"
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
                style="ghost" color="gray" size="lg"
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
                style="ghost" color="gray" size="lg"
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
                style="ghost" color="gray" size="lg"
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
              <>
                <Row label="Видалити організацію (через 30 днів)" desc="Організація буде схована і повністю видалиться через 30 днів">
                  <Button
                    onClick={() => handleDeleteOrg('soft')}
                    style="secondary" color="red" size="lg"
                  >
                    Видалити через 30 днів
                  </Button>
                </Row>
                <Row label="Видалити організацію негайно" desc="Повне і миттєве видалення організації і всіх даних без можливості відновлення">
                  <Button
                    onClick={() => handleDeleteOrg('hard')}
                    style="primary" color="red" size="lg"
                    icon={Trash2} iconSize={12}
                  >
                    Видалити негайно
                  </Button>
                </Row>
              </>
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
                  <div className="w-12 h-12 rounded-full bg-[#f4f4f5] flex items-center justify-center mb-3">
                    <Archive size={20} className="text-[#9a9a9a]" />
                  </div>
                  <p className="text-[14px] font-bold text-[#1f1f1f]">Немає архівованих проєктів</p>
                  <p className="text-[12px] text-[#9a9a9a] mt-1">Тут відображатимуться всі архівовані проєкти організації</p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-[#f4f4f5] -my-3">
                  {archivedProjects.map(p => (
                    <div key={p.id} className="flex items-center justify-between py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-[#1f1f1f] truncate">{p.name}</p>
                        {p.description && (
                          <p className="text-[12px] text-[#9a9a9a] truncate mt-0.5">{p.description}</p>
                        )}
                      </div>
                      <Button
                        onClick={() => unarchiveProject(p.id)}
                        style="secondary"
                        color="green"
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

  // ── Modals ───────────────────────────────────────────────────────
  const disableIntegrationModal = showDisableConfirm && (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-[400px] bg-white rounded-[24px] shadow-2xl p-6 animate-in zoom-in-95 duration-200">
        <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle size={24} />
        </div>
        <h3 className="text-[18px] font-bold text-[#1f1f1f] mb-2">Відключити інтеграцію?</h3>
        <p className="text-[13px] text-[#9a9a9a] mb-6">
          Ви впевнені? Якщо ви відключите інтеграцію, ви більше не зможете інтегрувати проєкти з клієнтським порталом. Ваші клієнти втратять доступ до оновлень у реальному часі.
        </p>
        <div className="flex gap-3">
          <Button
            onClick={() => setShowDisableConfirm(false)}
            style="secondary" color="gray" size="lg"
            className="flex-1"
          >
            Скасувати
          </Button>
          <Button
            onClick={() => confirmSaveIntegration(false)}
            style="primary" color="red" size="lg"
            className="flex-1"
          >
            Відключити
          </Button>
        </div>
      </div>
    </div>
  );



  // ── Layout ───────────────────────────────────────────────────
  const allowedNav = NAV.filter(n => !n.adminOnly || isAdmin);

  const handleNavChange = (id) => {
    setActiveSection(id);
  };

  const sidebarContent = (
    <InnerNavigation
      items={allowedNav}
      activeId={activeSection}
      onChange={handleNavChange}
    />
  );

  return (
    <SidebarLayout sidebar={sidebarContent} hasBorder={false}>
      <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#f4f4f5] relative">
        <div className="max-w-[760px] mx-auto px-[32px] py-[48px] min-h-full flex flex-col">
          <div className="flex-1 pb-[100px]">
            {renderSection()}
          </div>
        </div>
      </main>



      {disableIntegrationModal}

      <Dialog isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} title="Запросити нового учасника" size="md">
        <div className="flex flex-col gap-4 py-4 min-h-[200px]">
          <Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@example.com" label="Email учасника" />
          <Select value={inviteRole} onChange={setInviteRole} options={Object.entries(ROLE_LABELS).map(([k,v]) => ({value: k, label: v}))} label="Роль" />
        </div>
        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-[#f0f0f0]">
          <Button onClick={() => setShowInviteModal(false)} style="ghost" color="dark" size="lg">Скасувати</Button>
          <Button onClick={async () => { await handleInvite(); setShowInviteModal(false); }} loading={inviting} disabled={inviting || !inviteEmail.trim()} style="primary" color="dark" size="lg">Надіслати запрошення</Button>
        </div>
      </Dialog>
    </SidebarLayout>
  );
}
