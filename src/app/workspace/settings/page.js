'use client';
// src/app/workspace/settings/page.js — Redesigned Settings (clean, no emoji, QT-style)
import { useState, useEffect } from 'react';
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
  Link2, PlugZap, ToggleLeft, ToggleRight, Receipt, CreditCard
} from 'lucide-react';

// ── Constants ────────────────────────────────────────────────────────
const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://qt-green.vercel.app';

const DEFAULT_STATUSES = [
  { id: 'todo',        label: 'To Do',       color: '#6366f1' },
  { id: 'in-progress', label: 'In Progress', color: '#0891b2' },
  { id: 'done',        label: 'Done',        color: '#10b981' },
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
const COLOR_PALETTE = [
  '#dc2626','#f97316','#eab308','#22c55e','#10b981',
  '#0891b2','#6366f1','#8b5cf6','#db2777','#1f1f1f',
  '#9a9a9a','#059669','#7c3aed','#d97706','#0284c7',
];

const NAV = [
  { id: 'profile',       label: 'Особистий профіль',icon: User,          group: 'Особисте' },
  { id: 'notifications', label: 'Сповіщення',       icon: Bell,          group: 'Особисте' },
  { id: 'workspace',     label: 'Загальні',         icon: Building,      group: 'Воркспейс', adminOnly: true },
  { id: 'team',          label: 'Учасники команди', icon: Users,         group: 'Воркспейс' },
  { id: 'billing',       label: 'Тарифний план',    icon: CreditCard,    group: 'Воркспейс', adminOnly: true },
  { id: 'integrations',  label: 'Інтеграції',       icon: PlugZap,       group: 'Воркспейс', adminOnly: true },
  { id: 'workflow',      label: 'Статуси та типи',  icon: GitBranch,     group: 'Налаштування процесів', adminOnly: true },
  { id: 'danger',        label: 'Видалення даних',  icon: Shield,        group: 'Інше', danger: true, adminOnly: true },
];

// ── Primitives ───────────────────────────────────────────────────────

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-[40px] h-[22px] rounded-full transition-colors ${value ? 'bg-[#1f1f1f]' : 'bg-[#e0e0e0]'}`}
    >
      <span className={`absolute top-[3px] w-[16px] h-[16px] bg-white rounded-full shadow-sm transition-all ${value ? 'left-[21px]' : 'left-[3px]'}`} />
    </button>
  );
}

function Row({ label, desc, children, danger = false, topBorder = false }) {
  return (
    <div className={`flex items-center justify-between gap-6 py-[14px] ${topBorder ? 'border-t border-[#f0f0f0]' : 'border-b border-[#f0f0f0]'} last:border-b-0 first:border-t-0`}>
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
    <div>
      <div className="mb-5">
        <h2 className="text-[18px] font-semibold text-[#1f1f1f] tracking-tight">{title}</h2>
        {desc && <p className="text-[13px] text-[#9a9a9a] mt-[3px]">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-[#f7f7f7] rounded-[24px] p-6 mb-5 ${className}`}>
      {children}
    </div>
  );
}

function SaveBtn({ onClick, loading, label = 'Зберегти' }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-2 px-5 py-[10px] bg-[#1f1f1f] text-white rounded-[10px] text-[13px] font-medium hover:bg-[#303030] transition-colors disabled:opacity-50"
    >
      {loading && <RefreshCw size={13} className="animate-spin" />}
      {label}
    </button>
  );
}

function Input({ value, onChange, placeholder, type = 'text', className = '' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`text-[13px] bg-[#f7f7f7] border border-[#e9e9e9] rounded-[10px] px-3 py-[7px] outline-none focus:border-[#1f1f1f] transition-colors ${className}`}
    />
  );
}

// ── WorkflowItem ─────────────────────────────────────────────────────

function WorkflowItem({ item, onSave, onDelete, canDelete = true }) {
  const [editing,     setEditing]     = useState(item.isNew || false);
  const [label,       setLabel]       = useState(item.label);
  const [color,       setColor]       = useState(item.color);
  const [showPalette, setShowPalette] = useState(false);

  const save = () => {
    if (label.trim()) {
      const { isNew, ...rest } = item;
      onSave({ ...rest, label: label.trim(), color });
    }
    setEditing(false);
    setShowPalette(false);
  };

  return (
    <div className="flex items-center gap-3 py-[11px] border-b border-[#f0f0f0] last:border-0 group">
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
              <button key={c} onClick={() => { setColor(c); setShowPalette(false); }}
                className="w-[18px] h-[18px] rounded-full transition-transform hover:scale-110"
                style={{ background: c, outline: c === color ? '2px solid #1f1f1f' : 'none', outlineOffset: 2 }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Label */}
      {editing ? (
        <input
          autoFocus
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditing(false); setLabel(item.label); } }}
          className="flex-1 text-[13px] bg-[#f7f7f7] border border-[#e9e9e9] rounded-[6px] px-2 py-[4px] outline-none focus:border-[#1f1f1f]"
        />
      ) : (
        <span className="flex-1 text-[13px] text-[#1f1f1f]">{item.label}</span>
      )}

      {/* Badge preview */}
      {!editing && (
        <span className="text-[10px] font-semibold px-[8px] py-[2px] rounded-full shrink-0"
          style={{ background: color + '18', color }}>
          {item.label}
        </span>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {editing ? (
          <>
            <button onClick={save} className="p-[5px] text-[#10b981] hover:bg-green-50 rounded-[5px]"><Check size={12} /></button>
            <button onClick={() => { 
              if (item.isNew) { onDelete(item.id); }
              else { setEditing(false); setLabel(item.label); setColor(item.color); }
            }}
              className="p-[5px] text-[#9a9a9a] hover:bg-[#f7f7f7] rounded-[5px]"><X size={12} /></button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)}
              className="p-[5px] text-[#cfcfcf] hover:text-[#1f1f1f] hover:bg-[#f7f7f7] rounded-[5px] opacity-0 group-hover:opacity-100 transition-all">
              <Edit2 size={11} />
            </button>
            {canDelete && (
              <button onClick={() => onDelete(item.id)}
                className="p-[5px] text-[#cfcfcf] hover:text-red-500 hover:bg-red-50 rounded-[5px] opacity-0 group-hover:opacity-100 transition-all">
                <Trash2 size={11} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── MAIN PAGE ────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { currentUser, signOut, activeOrgId } = useAppContext();
  const showToast = useWorkspaceStore(s => s.showToast);
  const { org, members, inviteMember, changeMemberRole, removeMember } = useOrganization();

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
  const [wfLoading,  setWfLoading]  = useState(true);
  const [wfSaving,   setWfSaving]   = useState(false);

  // ── Profile ──
  const [displayName,   setDisplayName]   = useState('');
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

  // ── Team invite ──
  const [inviting,    setInviting]    = useState(false);
  const [inviteRole,  setInviteRole]  = useState('member');

  // Sync from Firestore (initial only)
  useEffect(() => {
    if (currentUser?.name && !displayName) setDisplayName(currentUser.name);
  }, [currentUser?.name]); // eslint-disable-line

  useEffect(() => {
    if (currentUser?.name && !displayName) setDisplayName(currentUser.name);
    if (org?.name && !orgName) setOrgName(org.name);
    if (org?.logo && !orgLogo) setOrgLogo(org.logo);
  }, [currentUser?.name, org?.name, org?.logo]); // eslint-disable-line

  // ── Breadcrumbs ──
  useEffect(() => {
    useWorkspaceStore.setState({
      breadcrumbs: [
        { label: 'Налаштування', href: null },
      ]
    });
    return () => useWorkspaceStore.setState({ breadcrumbs: [] });
  }, []);
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
      await updateDoc(doc(db, 'users', uid), { name: displayName.trim(), updatedAt: serverTimestamp() });
      showToast('Профіль збережено');
    } catch { showToast('Помилка збереження', 'error'); }
    setProfileSaving(false);
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
      await setDoc(doc(db, 'organizations', activeOrgId, 'settings', 'workflow'), {
        statuses, types, priorities, labels, updatedAt: serverTimestamp(),
      });
      showToast('Workflow збережено');
    } catch { showToast('Помилка збереження', 'error'); }
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

  const handleRemoveMember = async (uid) => {
    if (!confirm('Видалити учасника з команди?')) return;
    try { await removeMember(uid); showToast('Учасника видалено'); }
    catch { showToast('Помилка', 'error'); }
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

  // ── Section renderer ─────────────────────────────────────────────

  const renderSection = () => {
    switch (activeSection) {

      // ──────────────────────────────────────────────────────────────
      case 'profile': return (
        <Section title="Профіль" desc="Ваше ім'я відображається у задачах та коментарях">
          <Card>
            <Row label="Ім'я" desc="Показується в задачах і чаті">
              <Input value={displayName} onChange={setDisplayName} className="w-[200px]" />
            </Row>
            <Row label="Email" desc="Використовується для входу та запрошень">
              <span className="text-[13px] text-[#9a9a9a]">{currentUser?.email}</span>
            </Row>
            <Row label="Роль">
              <span className="text-[11px] font-semibold px-[8px] py-[3px] bg-[#f0f0f0] text-[#4a4a4a] rounded-full">
                {currentUser?.role || 'Member'}
              </span>
            </Row>
          </Card>
          <SaveBtn onClick={saveProfile} loading={profileSaving} label="Зберегти профіль" />
        </Section>
      );

      // ──────────────────────────────────────────────────────────────
      case 'notifications': return (
        <Section title="Сповіщення" desc="Налаштуй які події надсилають тобі сповіщення">
          <Card>
            {[
              { key: 'assigned',      label: 'Задачу призначено мені',   desc: 'Хтось призначив задачу на тебе' },
              { key: 'commented',     label: 'Новий коментар',           desc: 'В задачі де ти виконавець або автор' },
              { key: 'statusChanged', label: 'Зміна статусу задачі',     desc: 'Коли змінюється статус твоїх задач' },
              { key: 'deadline',      label: 'Нагадування про дедлайн',  desc: 'За 24 години до дедлайну' },
              { key: 'mentioned',     label: 'Згадування в коментарях',  desc: 'Хтось написав @ваше-ім\'я' },
            ].map(n => (
              <Row key={n.key} label={n.label} desc={n.desc}>
                <Toggle value={notif[n.key]} onChange={v => setNotif(p => ({ ...p, [n.key]: v }))} />
              </Row>
            ))}
          </Card>
          <Card>
            <Row label="Push-сповіщення у браузері" desc="Отримувати сповіщення навіть коли вкладка закрита">
              <button
                onClick={async () => {
                  const result = await Notification.requestPermission();
                  showToast(result === 'granted' ? 'Push-сповіщення увімкнено' : 'Доступ відхилено');
                }}
                className="text-[12px] font-medium text-[#1f1f1f] underline underline-offset-2 hover:text-[#4a4a4a]"
              >
                {typeof window !== 'undefined' && window.Notification?.permission === 'granted'
                  ? 'Увімкнено'
                  : 'Увімкнути'}
              </button>
            </Row>
          </Card>
          <SaveBtn onClick={saveNotifications} loading={notifSaving} />
        </Section>
      );

      // ──────────────────────────────────────────────────────────────
      case 'workspace': return (
        <Section title="Воркспейс" desc="Загальні налаштування вашої організації">
          <Card>
            <Row label="Назва організації" desc="Видима всім у вашому воркспейсі">
              <Input value={orgName} onChange={setOrgName} className="w-[200px]" />
            </Row>
            <Row label="URL Логотипу" desc="Вставте посилання на зображення для вашої організації">
              <Input value={orgLogo} onChange={setOrgLogo} className="w-[300px]" placeholder="https://example.com/logo.png" />
            </Row>
            <Row label="Organization ID" desc="Унікальний ідентифікатор для API інтеграцій">
              <div className="flex items-center gap-2">
                <code className="text-[12px] bg-[#f7f7f7] border border-[#e9e9e9] px-2 py-1 rounded-[6px] text-[#9a9a9a] font-mono">
                  {activeOrgId || 'quickteam'}
                </code>
                <button
                  onClick={() => { navigator.clipboard.writeText(activeOrgId || 'quickteam'); showToast('Скопійовано'); }}
                  className="text-[#cfcfcf] hover:text-[#1f1f1f] transition-colors"
                >
                  <Copy size={12} />
                </button>
              </div>
            </Row>
          </Card>
          <SaveBtn onClick={saveWorkspace} loading={workspaceSaving} />
        </Section>
      );

      // ──────────────────────────────────────────────────────────────
      case 'team': return (
        <Section title="Команда" desc={`${members.length} учасник${members.length === 1 ? '' : 'ів'} у воркспейсі`}>

          {/* Members list */}
          <Card>
            {members.length === 0 && (
              <div className="py-8 text-center text-[13px] text-[#cfcfcf]">Немає учасників</div>
            )}
            {members.map(m => {
              const uid    = m.id || m.uid;
              const isMe   = uid === (currentUser?.id || currentUser?.uid);
              const initials = (m.name || m.email || '?')[0]?.toUpperCase();
              return (
                <div key={uid} className="flex items-center gap-3 py-[12px] border-b border-[#f0f0f0] last:border-0">
                  <div className="w-8 h-8 rounded-full bg-[#1f1f1f] flex items-center justify-center text-white text-[12px] font-semibold shrink-0">
                    {m.avatar
                      ? <img src={m.avatar} alt="" className="w-full h-full object-cover rounded-full" />
                      : initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#1f1f1f] truncate">
                      {m.name || m.email}
                      {isMe && <span className="ml-1 text-[10px] text-[#9a9a9a] font-normal">(ви)</span>}
                    </p>
                    <p className="text-[11px] text-[#9a9a9a] truncate">{m.email}</p>
                  </div>
                  <div className="w-[120px]">
                    <Select
                      value={m.role || 'member'}
                      onChange={val => handleRoleChange(uid, val)}
                      disabled={!isAdmin || isMe || m.role === 'owner'}
                      options={[
                        { value: 'owner', label: 'WorkspaceAdmin' },
                        { value: 'admin', label: 'Admin' },
                        { value: 'member', label: 'Member' }
                      ]}
                      className="text-[11px]"
                    />
                  </div>
                  {isAdmin && !isMe && m.role !== 'owner' && (
                    <button
                      onClick={() => handleRemoveMember(uid)}
                      className="p-[5px] text-[#cfcfcf] hover:text-red-500 hover:bg-red-50 rounded-[6px] transition-all"
                      title="Видалити"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </Card>

          {/* Invite */}
          {isAdmin && (
            <div className="mb-3">
              <p className="text-[12px] font-medium text-[#1f1f1f] mb-2">Запросити учасника</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleInvite(); }}
                  placeholder="email@company.com"
                  className="flex-1 text-[13px] bg-white border border-[#e9e9e9] rounded-[10px] px-3 py-[8px] outline-none focus:border-[#1f1f1f] transition-colors"
                />
                <div className="w-[100px]">
                  <Select
                    value={inviteRole}
                    onChange={val => setInviteRole(val)}
                    options={[
                      { value: 'member', label: 'Member' },
                      { value: 'admin', label: 'Admin' }
                    ]}
                  />
                </div>
                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  className="flex items-center gap-2 px-4 py-[8px] bg-[#1f1f1f] text-white rounded-[10px] text-[12px] font-medium hover:bg-[#303030] transition-colors disabled:opacity-50 shrink-0"
                >
                  {inviting ? <RefreshCw size={12} className="animate-spin" /> : <Mail size={12} />}
                  Запросити
                </button>
              </div>
            </div>
          )}

          {/* Roles guide */}
          <Card className="bg-[#fafafa]">
            <div className="py-[6px]">
              <p className="text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wider mb-3">Ролі та доступ</p>
              {[
                { role: 'WorkspaceAdmin',  desc: 'Повний доступ, включаючи видалення воркспейсу' },
                { role: 'Admin',  desc: 'Керує проєктами, командою та налаштуваннями' },
                { role: 'Member', desc: 'Створює і редагує задачі, не може керувати командою' },
              ].map(r => (
                <div key={r.role} className="flex items-baseline gap-3 py-[5px]">
                  <span className="text-[11px] font-semibold text-[#1f1f1f] w-[100px] shrink-0">{r.role}</span>
                  <span className="text-[12px] text-[#9a9a9a]">{r.desc}</span>
                </div>
              ))}
            </div>
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
          <Section title="Тарифний план" desc="Управління підпискою та лімітами воркспейсу">
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
                  <button onClick={() => handleUpgradePlan('free')} disabled={upgrading} className="px-5 py-2 bg-white border border-[#e9e9e9] text-[#1f1f1f] rounded-[10px] text-[13px] font-bold hover:bg-[#f7f7f7] transition-all disabled:opacity-50">
                    {upgrading ? 'Завантаження...' : 'Скасувати підписку'}
                  </button>
                ) : (
                  <button onClick={() => handleUpgradePlan('pro')} disabled={upgrading} className="px-5 py-2 bg-[#6366f1] text-white rounded-[10px] text-[13px] font-bold shadow-md hover:bg-[#4f46e5] hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50">
                    {upgrading ? 'Оновлення...' : 'Оновити до PRO'}
                  </button>
                )}
              </div>
            </Card>
          </Section>
        );
      }

      // ──────────────────────────────────────────────────────────────
      case 'workflow': return (
        <Section title="Workflow" desc="Статуси, типи та пріоритети задач — застосовуються до всіх проєктів">

          {wfLoading ? (
            <div className="py-12 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Statuses */}
              <div className="mb-2">
                <p className="text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wider mb-2">Статуси</p>
                <Card>
                  {statuses.map((s, i) => (
                    <WorkflowItem key={s.id} item={s}
                      onSave={stA.onSave} onDelete={stA.onDelete}
                      canDelete={i > 0 && i < statuses.length - 1}
                    />
                  ))}
                  <button
                    onClick={() => setStatuses(p => [...p, { id: `s-${Date.now()}`, label: 'Новий статус', color: '#6366f1', isNew: true }])}
                    className="flex items-center gap-2 py-3 text-[12px] font-medium text-[#9a9a9a] hover:text-[#1f1f1f] transition-colors"
                  >
                    <Plus size={13} /> Додати статус
                  </button>
                </Card>
              </div>

              {/* Types */}
              <div className="mb-2">
                <p className="text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wider mb-2">Типи задач</p>
                <Card>
                  {types.map(t => (
                    <WorkflowItem key={t.id} item={t} onSave={tpA.onSave} onDelete={tpA.onDelete} />
                  ))}
                  <button
                    onClick={() => setTypes(p => [...p, { id: `t-${Date.now()}`, label: 'Новий тип', color: '#059669', isNew: true }])}
                    className="flex items-center gap-2 py-3 text-[12px] font-medium text-[#9a9a9a] hover:text-[#1f1f1f] transition-colors"
                  >
                    <Plus size={13} /> Додати тип
                  </button>
                </Card>
              </div>

              {/* Priorities */}
              <div className="mb-4">
                <p className="text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wider mb-2">Пріоритети</p>
                <Card>
                  {priorities.map((p, i) => (
                    <WorkflowItem key={p.id} item={p}
                      onSave={prA.onSave} onDelete={prA.onDelete}
                      canDelete={i > 0 && i < priorities.length - 1}
                    />
                  ))}
                </Card>
              </div>

              {/* Labels */}
              <div className="mb-4">
                <p className="text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wider mb-2">Мітки (Теги)</p>
                <Card>
                  {labels.map(l => (
                    <WorkflowItem key={l.id} item={l} onSave={lbA.onSave} onDelete={lbA.onDelete} />
                  ))}
                  <button
                    onClick={() => setLabels(p => [...p, { id: `l-${Date.now()}`, label: 'Нова мітка', color: '#3b82f6', isNew: true }])}
                    className="flex items-center gap-2 py-3 text-[12px] font-medium text-[#9a9a9a] hover:text-[#1f1f1f] transition-colors"
                  >
                    <Plus size={13} /> Додати мітку
                  </button>
                </Card>
              </div>

              <div className="flex items-center gap-3">
                <SaveBtn onClick={saveWorkflow} loading={wfSaving} label="Зберегти workflow" />
                <button
                  onClick={() => {
                    setStatuses(DEFAULT_STATUSES);
                    setTypes(DEFAULT_TYPES);
                    setPriorities(DEFAULT_PRIORITIES);
                    setLabels(DEFAULT_LABELS);
                    showToast('Скинуто до стандартних значень');
                  }}
                  className="text-[12px] text-[#9a9a9a] hover:text-[#1f1f1f] transition-colors"
                >
                  Скинути до стандартних
                </button>
              </div>
            </>
          )}
        </Section>
      );

      // ──────────────────────────────────────────────────────────────
      case 'danger': return (
        <Section title="Небезпечна зона" desc="Незворотні дії. Виконуйте обережно.">
          <Card>
            <Row label="Вийти з акаунту" desc="Завершити сесію на цьому пристрої">
              <button
                onClick={() => { if (confirm('Вийти з акаунта?')) signOut(); }}
                className="flex items-center gap-2 text-[12px] font-medium text-[#1f1f1f] hover:text-red-500 transition-colors"
              >
                <LogOut size={13} /> Вийти
              </button>
            </Row>
            <Row label="Експортувати дані" desc="Завантажити всі задачі та файли в ZIP-архів">
              <button
                onClick={() => showToast('Функція в розробці')}
                className="flex items-center gap-2 text-[12px] font-medium text-[#1f1f1f] hover:text-[#4a4a4a] transition-colors"
              >
                <Download size={13} /> Експортувати
              </button>
            </Row>
            <Row label="Скинути workflow" desc="Повернути статуси, типи та пріоритети до стандартних значень" danger>
              <button
                onClick={async () => {
                  if (!confirm('Скинути всі workflow налаштування?')) return;
                  setStatuses(DEFAULT_STATUSES);
                  setTypes(DEFAULT_TYPES);
                  setPriorities(DEFAULT_PRIORITIES);
                  setLabels(DEFAULT_LABELS);
                  await saveWorkflow();
                }}
                className="flex items-center gap-2 text-[12px] font-medium text-red-500 hover:text-red-700 transition-colors"
              >
                <RefreshCw size={13} /> Скинути
              </button>
            </Row>
            {isOwner && (
              <Row label="Видалити воркспейс" desc="Видалить усі проєкти, задачі та дані команди — незворотно" danger>
                <button
                  onClick={() => {
                    const typed = prompt('Введіть DELETE для підтвердження');
                    if (typed === 'DELETE') showToast('Функція недоступна в demo-режимі', 'error');
                  }}
                  className="flex items-center gap-2 text-[12px] font-medium text-red-600 bg-red-50 px-3 py-[5px] rounded-[10px] hover:bg-red-100 transition-colors"
                >
                  <Trash2 size={12} /> Видалити воркспейс
                </button>
              </Row>
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
          <button
            onClick={() => setShowDisableConfirm(false)}
            className="flex-1 py-2.5 rounded-[10px] text-[13px] font-bold text-[#1f1f1f] bg-[#f7f7f7] hover:bg-[#e9e9e9] transition-colors"
          >
            Скасувати
          </button>
          <button
            onClick={() => confirmSaveIntegration(false)}
            className="flex-1 py-2.5 rounded-[10px] text-[13px] font-bold text-white bg-red-500 hover:bg-red-600 transition-colors"
          >
            Відключити
          </button>
        </div>
      </div>
    </div>
  );

  // ── Nav groups ───────────────────────────────────────────────────
  const allowedNav = NAV.filter(n => !n.adminOnly || isAdmin);
  const groups = [...new Set(allowedNav.map(n => n.group))];

  // ── Layout ───────────────────────────────────────────────────
  return (
    <div className="flex-1 flex overflow-hidden bg-white">

      {/* Sidebar */}
      <aside className="w-[220px] shrink-0 overflow-y-auto px-[12px] pt-[24px] pb-[32px] border-r border-[#f7f7f7]">
        {groups.map(group => (
          <div key={group} className="mb-[20px]">
            <p className="px-3 pb-[6px] text-[10px] font-bold text-[#cfcfcf] uppercase tracking-widest">{group}</p>
            <div className="flex flex-col gap-[1px]">
              {allowedNav.filter(n => n.group === group).map(nav => {
                const Icon   = nav.icon;
                const active = activeSection === nav.id;
                return (
                  <button
                    key={nav.id}
                    onClick={() => setActiveSection(nav.id)}
                    className={`flex items-center gap-[10px] w-full px-3 py-[8px] rounded-[10px] text-[13px] font-medium transition-all text-left ${
                      active
                        ? 'bg-[#f7f7f7] text-[#1f1f1f]'
                        : nav.danger
                          ? 'text-red-500 hover:bg-red-50'
                          : 'text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f7f7f7]'
                    }`}
                  >
                    <Icon size={15} strokeWidth={2} className={active ? 'text-[#1f1f1f]' : nav.danger ? 'text-red-400' : 'text-[#cfcfcf]'} />
                    {nav.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="w-full px-[32px] pt-[24px] pb-16 max-w-[900px]">
          {renderSection()}
        </div>
      </main>

      {disableIntegrationModal}
    </div>
  );
}
