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
  Globe, Tag as TagIcon, Briefcase
} from 'lucide-react';
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
  PageHeader 
} from '@/components/ui';
import ImageUpload from '@/components/ui/ImageUpload';

// ── Constants ────────────────────────────────────────────────────────
const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://qt-green.vercel.app';

const ROLE_LABELS = {
  owner: 'Власник',
  admin: 'Адміністратор',
  member: 'Учасник',
  client: 'Клієнт',
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
  { id: 'statuses',      label: 'Статуси задач',    icon: GitBranch,     group: 'Налаштування процесів', adminOnly: true },
  { id: 'types',         label: 'Типи задач',       icon: TagIcon,       group: 'Налаштування процесів', adminOnly: true },
  { id: 'priorities',    label: 'Пріоритети',       icon: AlertTriangle, group: 'Налаштування процесів', adminOnly: true },
  { id: 'labels',        label: 'Мітки',            icon: Palette,       group: 'Налаштування процесів', adminOnly: true },
  { id: 'positions',     label: 'Посади та ставки', icon: Briefcase,     group: 'Налаштування процесів', adminOnly: true },
  { id: 'danger',        label: 'Видалення даних',  icon: Shield,        group: 'Інше', danger: true, adminOnly: true },
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

function Section({ title, desc, children }) {
  return (
    <div className="flex flex-col">
      <div className="mb-6">
        <h2 className="text-[20px] font-bold text-[#1f1f1f] tracking-tight">{title}</h2>
        {desc && <p className="text-[13px] text-[#9a9a9a] mt-[4px]">{desc}</p>}
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

function WorkflowItem({ item, onSave, onDelete, canDelete = true, variant = 'status' }) {
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
    <div className="flex items-center gap-3 py-[8px] px-[8px] -mx-[8px] rounded-[12px] hover:bg-[#f4f4f5] transition-colors group">
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
              className="opacity-0 group-hover:opacity-100"
            />
            {canDelete ? (
              <Button onClick={() => onDelete(item.id)}
                style="ghost" color="red" size="icon" icon={Trash2} iconSize={11}
                className="opacity-0 group-hover:opacity-100"
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
              className="opacity-0 group-hover:opacity-100"
            />
            <Button onClick={() => onDelete(item.id)}
              style="ghost" color="red" size="icon" icon={Trash2} iconSize={11}
              className="opacity-0 group-hover:opacity-100"
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
  const { currentUser, signOut, activeOrgId } = useAppContext();
  const showToast = useWorkspaceStore(s => s.showToast);
  const { org, members, inviteMember, changeMemberRole, removeMember, setMemberPosition } = useOrganization();

  // Role resolution
  const myMemberInfo = members.find(m => m.id === (currentUser?.uid || currentUser?.id));
  const myRole = myMemberInfo?.role || 'member';
  const isAdmin = myRole === 'owner' || myRole === 'admin';
  const isOwner = myRole === 'owner';

  const [activeSection, setActiveSection] = useState('profile');

  // ── Workflow ──
  const [statuses,   setStatuses]   = useState(DEFAULT_STATUSES);
  const [types,      setTypes]      = useState(DEFAULT_TYPES);
  const [priorities, setPriorities] = useState(DEFAULT_PRIORITIES);
  const [labels,     setLabels]     = useState(DEFAULT_LABELS);
  const [positions,  setPositions]  = useState([]);
  const [wfLoading,  setWfLoading]  = useState(true);
  const [wfSaving,   setWfSaving]   = useState(false);

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
  const [qtSaving,       setQtSaving]       = useState(false);

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
          setOrgPlan(orgSnap.data().plan || 'free');
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
      showToast('Збережено');
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
    if (!confirm('Ви дійсно хочете передати права власника цій особі? Ви втратите статус власника та станете адміністратором.')) return;
    try {
      const orgRef = doc(db, 'organizations', activeOrgId);
      const orgSnap = await getDoc(orgRef);
      const orgData = orgSnap.data();
      
      const uid = currentUser?.id || currentUser?.uid;
      const updatedMembers = orgData.members.map(m => {
        if (m.uid === uid) return { ...m, role: 'admin' };
        if (m.uid === targetUid) return { ...m, role: 'owner' };
        return m;
      });
      
      await updateDoc(orgRef, {
        ownerId: targetUid,
        members: updatedMembers
      });
      showToast('Права власника успішно передано');
    } catch (e) {
      showToast('Помилка передачі прав', 'error');
    }
  };

  const handleRemoveMember = async (uid) => {
    if (!confirm('Видалити учасника з команди?')) return;
    try { await removeMember(uid); showToast('Учасника видалено'); }
    catch { showToast('Помилка', 'error'); }
  };

  const handleDeleteOrg = async (type) => {
    if (!activeOrgId) return;
    try {
      if (type === 'hard') {
        const typed = prompt('Введіть DELETE для повного та безповоротного видалення організації');
        if (typed !== 'DELETE') return;
        await deleteDoc(doc(db, 'organizations', activeOrgId));
        showToast('Організацію повністю видалено');
        setTimeout(() => window.location.href = '/workspace', 1000);
      } else if (type === 'soft') {
        const typed = prompt('Введіть 30 для видалення організації через 30 днів (ви зможете її відновити)');
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

  // ── Section renderer ─────────────────────────────────────────────

  const renderSection = () => {
    switch (activeSection) {

      // ──────────────────────────────────────────────────────────────
      case 'profile': return (
        <Section title="Особистий профіль" desc="Ваша інформація відображається у профілі команди, задачах та чаті">
          <Card variant="white" padding="lg">
            <Row label="Ім'я" desc="Показується в задачах і чаті">
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
        <Section title="Сповіщення" desc="Налаштуй які події надсилають тобі сповіщення">
          <Card variant="white" padding="lg">
            {[
              { key: 'assigned',      label: 'Задачу призначено мені',   desc: 'Хтось призначив задачу на тебе' },
              { key: 'commented',     label: 'Новий коментар',           desc: 'В задачі де ти виконавець або автор' },
              { key: 'statusChanged', label: 'Зміна статусу задачі',     desc: 'Коли змінюється статус твоїх задач' },
              { key: 'deadline',      label: 'Нагадування про дедлайн',  desc: 'За 24 години до дедлайну' },
              { key: 'mentioned',     label: 'Згадування в коментарях',  desc: 'Хтось написав @ваше-ім\'я' },
            ].map(n => (
              <Row key={n.key} label={n.label} desc={n.desc}>
                <ToggleSwitch checked={notif[n.key]} onChange={v => setNotif(p => ({ ...p, [n.key]: v }))} size="sm" />
              </Row>
            ))}
          </Card>
          <Card variant="white" padding="lg">
            <Row label="Push-сповіщення у браузері" desc="Отримувати сповіщення навіть коли вкладка закрита">
              <Button
                onClick={async () => {
                  const result = await Notification.requestPermission();
                  showToast(result === 'granted' ? 'Push-сповіщення увімкнено' : 'Доступ відхилено');
                }}
                style="secondary" color="blue" size="md"
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
        <Section title="Локалізація та регіон" desc="Налаштуйте відображення дати, часу та формату календаря відповідно до вашого регіону">
          <Card variant="white" padding="lg">
            <Row label="Мова інтерфейсу" desc="Виберіть мову відображення">
              <Select
                value={language}
                onChange={setLanguage}
                options={[
                  { value: 'ua', label: 'Українська' },
                  { value: 'en', label: 'English (В розробці)' }
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
        <Section title="Загальні" desc="Загальні налаштування вашої організації">
          <Card variant="white" padding="lg">
            <Row label="Назва організації" desc="Видима всім у вашій організації">
              <Input value={orgName} onChange={e => setOrgName(e.target.value)} className="w-[200px]" />
            </Row>
            <Row label="Логотип організації" desc="Зображення для вашої організації (рекомендовано 1:1)">
              <ImageUpload value={orgLogo} onChange={setOrgLogo} theme="light" showLabel={false} />
            </Row>
            <Row label="Organization ID" desc="Унікальний ідентифікатор для API інтеграцій">
              <div className="flex items-center gap-2">
                <code className="text-[12px] bg-[#f4f4f5] border border-[#e9e9e9] px-2 py-1 rounded-[6px] text-[#9a9a9a] font-mono">
                  {activeOrgId || 'quickteam'}
                </code>
                <Button
                  onClick={() => { navigator.clipboard.writeText(activeOrgId || 'quickteam'); showToast('Скопійовано'); }}
                  style="ghost" color="blue" size="sm"
                  icon={Copy}
                  iconSize={12}
                />
              </div>
            </Row>
          </Card>
        </Section>
      );



      // ──────────────────────────────────────────────────────────────
      case 'integrations': return (
        <Section title="Інтеграції" desc="Керуй підключеними сервісами">

          {/* QT Portal — головна інтеграція */}
          <div className="bg-white border border-[#e9e9e9] rounded-[12px] p-5 mb-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-[10px] bg-[#1f1f1f] flex items-center justify-center shrink-0">
                <Link2 size={16} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-4 mb-1">
                  <div>
                    <p className="text-[14px] font-semibold text-[#1f1f1f] flex items-center gap-2">
                      QT — Клієнтський портал
                      <span className="text-[9px] font-bold px-[6px] py-[2px] bg-[#f0f0f0] text-[#9a9a9a] rounded-[4px] uppercase tracking-wider">
                        В розробці
                      </span>
                    </p>
                    <p className="text-[12px] text-[#9a9a9a] mt-[2px]">Синхронізація матеріалів, чат з клієнтами та статуси проєктів у реальному часі</p>
                  </div>
                  <div className="shrink-0">
                    <button disabled className="relative w-[40px] h-[22px] rounded-full bg-[#e0e0e0] opacity-50 cursor-not-allowed">
                      <span className="absolute top-[3px] w-[16px] h-[16px] bg-white rounded-full shadow-sm left-[3px]" />
                    </button>
                  </div>
                </div>

                {/* Status + info */}
                <div className="mt-3 pt-3 border-t border-[#f0f0f0] flex items-center gap-3 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-[3px] rounded-full bg-[#f5f5f5] text-[#9a9a9a]">
                    <span className="w-[5px] h-[5px] rounded-full bg-[#cfcfcf]" />
                    Тимчасово вимкнено
                  </span>

                  <button
                    disabled
                    className="flex items-center gap-1 text-[12px] text-[#cfcfcf] font-medium cursor-not-allowed"
                  >
                    Відкрити QT <ExternalLink size={11} />
                  </button>
                </div>

                {/* What syncs */}
                <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
                  {[
                    'Повідомлення від клієнтів',
                    'Матеріали та файли',
                    'Статуси стадій проєкту',
                    'Запити на затвердження',
                  ].map(item => (
                    <div key={item} className="flex items-center gap-2 text-[12px] text-[#cfcfcf]">
                      <span className="w-[4px] h-[4px] rounded-full shrink-0 bg-[#e0e0e0]" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Section>
      );

      // ──────────────────────────────────────────────────────────────
      case 'billing': {
        const isPro = orgPlan === 'pro';
        const projectLimit = isPro ? Infinity : 3;
        const projectsPercent = isPro ? 100 : Math.min(100, (projectsCount / projectLimit) * 100);

        return (
          <Section title="Тарифний план" desc="Управління підпискою та лімітами організації">
            <Card className={`border-${isPro ? '[#eab308]/40' : '[#6366f1]/20'} shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-hidden p-0 transition-all`}>
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
      case 'statuses': return (
        <Section title="Статуси задач" desc="Статуси задач — застосовуються до всіх проєктів">
          {wfLoading ? (
            <div className="py-12 flex items-center justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : (
            <Card>
              {statuses.map((s, i) => (
                <WorkflowItem key={s.id} item={s}
                  onSave={stA.onSave} onDelete={stA.onDelete}
                  canDelete={i > 0 && i < statuses.length - 1}
                  variant="status"
                />
              ))}
              <Button
                onClick={() => {
                  setStatuses(p => {
                    const newStatuses = [...p];
                    newStatuses.splice(newStatuses.length - 1, 0, { id: `s-${Date.now()}`, label: 'Новий статус', color: '#6366f1', emoji: '📌', isNew: true });
                    return newStatuses;
                  });
                }}
                style="ghost" color="gray" size="md"
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
        <Section title="Типи задач" desc="Типи задач — застосовуються до всіх проєктів">
          {wfLoading ? (
            <div className="py-12 flex items-center justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : (
            <Card>
              {types.map(t => (
                <WorkflowItem key={t.id} item={t} onSave={tpA.onSave} onDelete={tpA.onDelete} variant="type" />
              ))}
              <Button
                onClick={() => setTypes(p => [...p, { id: `t-${Date.now()}`, label: 'Новий тип', color: '#059669', emoji: '📄', isNew: true }])}
                style="ghost" color="gray" size="md"
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
        <Section title="Пріоритети задач" desc="Пріоритети задач — застосовуються до всіх проєктів">
          {wfLoading ? (
            <div className="py-12 flex items-center justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : (
            <Card>
              {priorities.map(pItem => (
                <WorkflowItem key={pItem.id} item={pItem} onSave={prA.onSave} onDelete={prA.onDelete} variant="priority" />
              ))}
              <Button
                onClick={() => setPriorities(p => [...p, { id: `p-${Date.now()}`, label: 'Новий пріоритет', color: '#eab308', emoji: '🔥', isNew: true }])}
                style="ghost" color="gray" size="md"
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
        <Section title="Мітки задач" desc="Глобальні мітки для маркування задач">
          {wfLoading ? (
            <div className="py-12 flex items-center justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : (
            <Card>
              {labels.map(l => (
                <WorkflowItem key={l.id} item={l} onSave={lbA.onSave} onDelete={lbA.onDelete} variant="label" />
              ))}
              <Button
                onClick={() => setLabels(p => [...p, { id: `l-${Date.now()}`, label: 'Нова мітка', color: '#db2777', isNew: true }])}
                style="ghost" color="gray" size="md"
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
        <Section title="Посади та ставки" desc="Налаштування посад команди та погодинних ставок виконавців">
          {wfLoading ? (
            <div className="py-12 flex items-center justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : (
            <Card>
              {positions.map(p => (
                <PositionItem key={p.id} item={p} onSave={posA.onSave} onDelete={posA.onDelete} />
              ))}
              <Button
                onClick={() => setPositions(p => [...p, { id: `pos-${Date.now()}`, label: 'Нова посада', hourlyRate: 0, isNew: true }])}
                style="ghost" color="gray" size="md"
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
          <Card variant="white" padding="lg">
            <Row label="Вийти з акаунту" desc="Завершити сесію на цьому пристрої">
              <Button
                onClick={() => { if (confirm('Вийти з акаунта?')) signOut(); }}
                style="ghost" color="red" size="md"
                icon={LogOut} iconSize={13}
              >
                Вийти
              </Button>
            </Row>
            <Row label="Експортувати дані" desc="Завантажити всі задачі та файли в ZIP-архів">
              <Button
                onClick={() => showToast('Функція в розробці')}
                style="ghost" color="gray" size="md"
                icon={Download} iconSize={13}
              >
                Експортувати
              </Button>
            </Row>
            <Row label="Скинути workflow" desc="Повернути статуси, типи та пріоритети до стандартних значень" danger>
              <Button
                onClick={async () => {
                  if (!confirm('Скинути всі workflow налаштування?')) return;
                  setStatuses(DEFAULT_STATUSES);
                  setTypes(DEFAULT_TYPES);
                  setPriorities(DEFAULT_PRIORITIES);
                  setLabels(DEFAULT_LABELS);
                  await saveWorkflow();
                }}
                style="ghost" color="red" size="md"
                icon={RefreshCw} iconSize={13}
              >
                Скинути
              </Button>
            </Row>
            {isOwner && (
              <>
                <Row label="Видалити організацію (через 30 днів)" desc="Організація буде схована і повністю видалиться через 30 днів" danger>
                  <Button
                    onClick={() => handleDeleteOrg('soft')}
                    style="secondary" color="red" size="md"
                  >
                    Видалити через 30 днів
                  </Button>
                </Row>
                <Row label="Видалити організацію негайно" desc="Повне і миттєве видалення організації і всіх даних без можливості відновлення" danger>
                  <Button
                    onClick={() => handleDeleteOrg('hard')}
                    style="primary" color="red" size="md"
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

  // ── Layout ───────────────────────────────────────────────────
  const allowedNav = NAV.filter(n => !n.adminOnly || isAdmin);

  const handleNavChange = (id) => {
    if (id === 'team') {
      router.push('/workspace/team');
    } else {
      setActiveSection(id);
    }
  };

  const sidebarContent = (
    <InnerNavigation
      items={allowedNav}
      activeId={activeSection}
      onChange={handleNavChange}
    />
  );

  return (
    <SidebarLayout sidebar={sidebarContent}>
      <main className="flex-1 overflow-y-auto custom-scrollbar bg-white relative">
        <div className="max-w-[700px] mx-auto px-[32px] py-[48px] min-h-full flex flex-col">
          <div className="flex-1 pb-[100px]">
            {renderSection()}
          </div>
        </div>
      </main>

      {/* Sticky Save Footer */}
      {saveAction && (
        <div className="absolute bottom-[24px] left-1/2 -translate-x-1/2 bg-[#f4f4f5] shadow-[0_8px_32px_rgba(0,0,0,0.08)] rounded-full p-[8px] flex items-center gap-[8px] border border-[#e9e9e9] z-50">
          {['statuses', 'types', 'priorities', 'labels', 'positions'].includes(activeSection) && (
            <Button 
              onClick={() => {
                if (!confirm('Скинути налаштування цієї секції до стандартних?')) return;
                if (activeSection === 'statuses') setStatuses(DEFAULT_STATUSES);
                if (activeSection === 'types') setTypes(DEFAULT_TYPES);
                if (activeSection === 'priorities') setPriorities(DEFAULT_PRIORITIES);
                if (activeSection === 'labels') setLabels(DEFAULT_LABELS);
                if (activeSection === 'positions') setPositions(DEFAULT_POSITIONS);
              }} 
              style="ghost" color="gray" size="md" className="rounded-full px-[16px]"
            >
              Скинути
            </Button>
          )}
          <Button onClick={saveAction.handler} loading={saveAction.loading} style="primary" color="dark" size="md" className="rounded-full px-[32px]">
            {saveAction.loading ? 'Збереження...' : saveAction.label}
          </Button>
        </div>
      )}

      {disableIntegrationModal}
    </SidebarLayout>
  );
}
