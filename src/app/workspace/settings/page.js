'use client';
// src/app/workspace/settings/page.js — Full-featured Workspace Settings Hub
import { useState, useEffect, useCallback } from 'react';
import { useAppContext }    from '@/lib/context/AppContext';
import { useTeamMembers }  from '@/lib/hooks/useTeamMembers';
import useWorkspaceStore   from '@/store/useWorkspaceStore';
import {
  User, Bell, Shield, Zap, Users, AlertTriangle, GitBranch,
  Palette, ChevronRight, Check, Plus, Trash2, GripVertical,
  Edit2, X, Save, Link2, Building, LogOut, Download, RefreshCw,
  Mail, Eye, EyeOff, Copy, ExternalLink, ArrowRight,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ORG_ID } from '@/lib/firebase';

// ── Default workflow config ─────────────────────────────────────────

const DEFAULT_STATUSES = [
  { id: 'backlog',         label: 'Backlog',         color: '#9a9a9a', emoji: '📋' },
  { id: 'todo',            label: 'To Do',           color: '#6366f1', emoji: '📌' },
  { id: 'in-progress',     label: 'In Progress',     color: '#0891b2', emoji: '⚡' },
  { id: 'code-review',     label: 'Code Review',     color: '#d97706', emoji: '🔍' },
  { id: 'qa',              label: 'QA',              color: '#7c3aed', emoji: '🧪' },
  { id: 'client-approval', label: 'Client Approval', color: '#db2777', emoji: '👁' },
  { id: 'done',            label: 'Done',            color: '#10b981', emoji: '✅' },
];

const DEFAULT_TYPES = [
  { id: 'epic',    label: 'Epic',    color: '#8b5cf6', emoji: '⚡' },
  { id: 'feature', label: 'Feature', color: '#0891b2', emoji: '⭐' },
  { id: 'task',    label: 'Task',    color: '#059669', emoji: '✅' },
  { id: 'bug',     label: 'Bug',     color: '#dc2626', emoji: '🐛' },
];

const DEFAULT_PRIORITIES = [
  { id: 'blocker', label: 'Blocker', color: '#dc2626', emoji: '🚨' },
  { id: 'high',    label: 'High',    color: '#f97316', emoji: '🔴' },
  { id: 'medium',  label: 'Medium',  color: '#eab308', emoji: '🟡' },
  { id: 'low',     label: 'Low',     color: '#9a9a9a', emoji: '🔵' },
];

const COLOR_PALETTE = [
  '#dc2626','#f97316','#eab308','#22c55e','#10b981',
  '#0891b2','#6366f1','#8b5cf6','#db2777','#1f1f1f',
  '#9a9a9a','#059669','#7c3aed','#d97706','#0284c7',
];

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://qt-green.vercel.app';

// ── Reusable primitives ─────────────────────────────────────────────

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`w-[42px] h-[24px] rounded-full transition-colors relative ${value ? 'bg-[#1f1f1f]' : 'bg-[#e9e9e9]'}`}
    >
      <span className={`absolute top-[3px] w-[18px] h-[18px] bg-white rounded-full shadow transition-all ${value ? 'left-[21px]' : 'left-[3px]'}`} />
    </button>
  );
}

function SectionHeader({ icon: Icon, title, desc }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-8 h-8 bg-[#f7f7f7] rounded-[8px] flex items-center justify-center">
          <Icon size={16} className="text-[#1f1f1f]" />
        </div>
        <h2 className="text-[18px] font-bold text-[#1f1f1f]">{title}</h2>
      </div>
      {desc && <p className="text-[13px] text-[#9a9a9a] ml-11">{desc}</p>}
    </div>
  );
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white border border-[#e9e9e9] rounded-[14px] overflow-hidden mb-4 ${className}`}>
      {children}
    </div>
  );
}

function CardRow({ label, desc, children, danger }) {
  return (
    <div className={`px-5 py-4 flex items-center justify-between gap-6 border-b border-[#f7f7f7] last:border-0 ${danger ? 'bg-red-50/50' : ''}`}>
      <div className="min-w-0 flex-1">
        <p className={`text-[13px] font-semibold ${danger ? 'text-red-600' : 'text-[#1f1f1f]'}`}>{label}</p>
        {desc && <p className={`text-[11px] mt-[2px] ${danger ? 'text-red-400' : 'text-[#9a9a9a]'}`}>{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ── Inline editable workflow item ────────────────────────────────────

function WorkflowItem({ item, onSave, onDelete, canDelete = true, showEmoji = true }) {
  const [editing, setEditing] = useState(false);
  const [label,   setLabel]   = useState(item.label);
  const [color,   setColor]   = useState(item.color);
  const [showPalette, setShowPalette] = useState(false);

  const save = () => {
    if (label.trim()) onSave({ ...item, label: label.trim(), color });
    setEditing(false);
    setShowPalette(false);
  };

  return (
    <div className="flex items-center gap-3 py-[10px] px-5 border-b border-[#f7f7f7] last:border-0 group">
      {/* Color dot → palette */}
      <div className="relative shrink-0">
        <button
          onClick={() => setShowPalette(v => !v)}
          className="w-[24px] h-[24px] rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform"
          style={{ background: color }}
          title="Змінити колір"
        />
        {showPalette && (
          <div className="absolute left-0 top-[30px] z-20 bg-white border border-[#e9e9e9] rounded-[12px] p-2 shadow-xl grid grid-cols-5 gap-1 w-[140px]">
            {COLOR_PALETTE.map(c => (
              <button key={c} onClick={() => { setColor(c); setShowPalette(false); }}
                className="w-[20px] h-[20px] rounded-full hover:scale-125 transition-transform border-2"
                style={{ background: c, borderColor: c === color ? '#1f1f1f' : 'transparent' }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Emoji */}
      {showEmoji && <span className="text-[16px] shrink-0">{item.emoji}</span>}

      {/* Label */}
      {editing ? (
        <input
          autoFocus
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditing(false); setLabel(item.label); } }}
          className="flex-1 text-[13px] font-semibold bg-[#f7f7f7] rounded-[7px] px-3 py-[5px] outline-none border border-[#e9e9e9] focus:border-[#1f1f1f]"
        />
      ) : (
        <span className="flex-1 text-[13px] font-semibold text-[#1f1f1f]">{item.label}</span>
      )}

      {/* Colored preview pill */}
      {!editing && (
        <span className="text-[10px] font-bold px-2 py-[2px] rounded-full shrink-0"
          style={{ background: color + '18', color }}>
          {item.label}
        </span>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {editing ? (
          <>
            <button onClick={save} className="p-1 text-[#10b981] hover:bg-green-50 rounded-[5px]"><Check size={13} /></button>
            <button onClick={() => { setEditing(false); setLabel(item.label); setColor(item.color); }}
              className="p-1 text-[#9a9a9a] hover:bg-[#f7f7f7] rounded-[5px]"><X size={13} /></button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)}
              className="p-1 text-[#cfcfcf] hover:text-[#1f1f1f] hover:bg-[#f7f7f7] rounded-[5px] opacity-0 group-hover:opacity-100 transition-all">
              <Edit2 size={12} />
            </button>
            {canDelete && (
              <button onClick={() => onDelete(item.id)}
                className="p-1 text-[#cfcfcf] hover:text-red-500 hover:bg-red-50 rounded-[5px] opacity-0 group-hover:opacity-100 transition-all">
                <Trash2 size={12} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── NAV sections ────────────────────────────────────────────────────

const NAV = [
  { id: 'profile',        label: 'Профіль',          icon: User,          group: 'Особисте' },
  { id: 'workspace',      label: 'Воркспейс',        icon: Building,      group: 'Організація' },
  { id: 'statuses',       label: 'Статуси задач',    icon: GitBranch,     group: 'Workflow' },
  { id: 'types',          label: 'Типи задач',       icon: Palette,       group: 'Workflow' },
  { id: 'priorities',     label: 'Пріоритети',       icon: AlertTriangle, group: 'Workflow' },
  { id: 'team',           label: 'Команда',          icon: Users,         group: 'Організація' },
  { id: 'integrations',   label: 'Інтеграції',       icon: Zap,           group: 'Організація' },
  { id: 'notifications',  label: 'Сповіщення',       icon: Bell,          group: 'Особисте' },
  { id: 'danger',         label: 'Небезпечна зона',  icon: Shield,        group: 'Особисте', danger: true },
];

// ── MAIN PAGE ──────────────────────────────────────────────────────

export default function SettingsPage() {
  const { currentUser, projects, signOut } = useAppContext();
  const showToast = useWorkspaceStore(s => s.showToast);

  const teamUids = projects?.flatMap(p => Array.isArray(p.team) ? p.team : []) || [];
  const uniqueUids = [...new Set(teamUids)];
  const { members } = useTeamMembers(uniqueUids);

  const [activeSection, setActiveSection] = useState('profile');

  // ── Workflow state (loaded from Firestore) ──
  const [statuses,    setStatuses]    = useState(DEFAULT_STATUSES);
  const [types,       setTypes]       = useState(DEFAULT_TYPES);
  const [priorities,  setPriorities]  = useState(DEFAULT_PRIORITIES);
  const [wfLoading,   setWfLoading]   = useState(true);
  const [wfSaving,    setWfSaving]    = useState(false);

  // ── Profile state ──
  const [displayName, setDisplayName] = useState(currentUser?.name || '');
  const [orgName,     setOrgName]     = useState('QuickTeam');

  // ── Notifications ──
  const [notif, setNotif] = useState({
    assigned: true, commented: true, statusChanged: false, deadline: true, mentioned: true,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const ref  = doc(db, 'workspaceSettings', 'workflow');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data();
          if (d.statuses?.length)    setStatuses(d.statuses);
          if (d.types?.length)       setTypes(d.types);
          if (d.priorities?.length)  setPriorities(d.priorities);
        }
      } catch {}
      setWfLoading(false);
    };
    load();
  }, []);

  const saveWorkflow = async () => {
    setWfSaving(true);
    try {
      await setDoc(doc(db, 'workspaceSettings', 'workflow'), {
        statuses, types, priorities, updatedAt: serverTimestamp(),
      });
      showToast('Workflow збережено ✓');
    } catch {
      showToast('Помилка збереження', 'error');
    }
    setWfSaving(false);
  };

  const groups = [...new Set(NAV.map(n => n.group))];

  // ── Helpers for list editing ──
  const makeUpdater = (setter) => ({
    onSave: (updated) => setter(prev => prev.map(i => i.id === updated.id ? updated : i)),
    onDelete: (id) => setter(prev => prev.filter(i => i.id !== id)),
    onAdd: (newItem) => setter(prev => [...prev, newItem]),
  });

  const statusActions    = makeUpdater(setStatuses);
  const typeActions      = makeUpdater(setTypes);
  const priorityActions  = makeUpdater(setPriorities);

  const addStatus = () => {
    const id = `status-${Date.now()}`;
    setStatuses(prev => [...prev, { id, label: 'Новий статус', color: '#6366f1', emoji: '📋' }]);
  };
  const addType = () => {
    const id = `type-${Date.now()}`;
    setTypes(prev => [...prev, { id, label: 'Новий тип', color: '#059669', emoji: '🔖' }]);
  };

  // ─────────────────────────────────────────────────────────────────
  // SECTION CONTENT
  // ─────────────────────────────────────────────────────────────────

  const renderSection = () => {
    switch (activeSection) {

      // ── Profile ───────────────────────────────────────────────────
      case 'profile': return (
        <div>
          <SectionHeader icon={User} title="Профіль" desc="Особисті дані відображаються у задачах та командному чаті" />
          <Card>
            <CardRow label="Повне ім'я" desc="Показується у всіх задачах і сповіщеннях">
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="text-[13px] font-semibold bg-[#f7f7f7] rounded-[8px] px-3 py-[6px] outline-none border border-transparent focus:border-[#e9e9e9] w-[200px]"
              />
            </CardRow>
            <CardRow label="Email" desc="Використовується для входу та сповіщень">
              <span className="text-[13px] text-[#9a9a9a]">{currentUser?.email}</span>
            </CardRow>
            <CardRow label="Аватар" desc="Генерується автоматично з ім'я">
              <div className="w-8 h-8 rounded-full bg-[#1f1f1f] flex items-center justify-center text-white text-[11px] font-bold">
                {(displayName || currentUser?.name || '?')[0]?.toUpperCase()}
              </div>
            </CardRow>
            <CardRow label="Роль" desc="Твоя роль в організації">
              <span className="text-[11px] font-bold px-2 py-[3px] bg-[#1f1f1f] text-white rounded-full">
                {currentUser?.role || 'Admin'}
              </span>
            </CardRow>
          </Card>
          <button
            onClick={() => { showToast('Профіль оновлено ✓'); }}
            className="px-6 py-[10px] bg-[#1f1f1f] text-white rounded-[10px] text-[13px] font-bold hover:bg-[#303030] transition-colors"
          >
            Зберегти профіль
          </button>
        </div>
      );

      // ── Workspace General ─────────────────────────────────────────
      case 'workspace': return (
        <div>
          <SectionHeader icon={Building} title="Воркспейс" desc="Загальні налаштування організації" />
          <Card>
            <CardRow label="Назва організації" desc="Відображається у всьому інтерфейсі">
              <input
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                className="text-[13px] font-semibold bg-[#f7f7f7] rounded-[8px] px-3 py-[6px] outline-none border border-transparent focus:border-[#e9e9e9] w-[200px]"
              />
            </CardRow>
            <CardRow label="Organization ID" desc="Ідентифікатор для API та multi-tenancy">
              <div className="flex items-center gap-2">
                <code className="text-[11px] bg-[#f7f7f7] border border-[#e9e9e9] px-2 py-1 rounded-[6px] text-[#9a9a9a]">quickteam</code>
                <button onClick={() => { navigator.clipboard.writeText('quickteam'); showToast('Скопійовано'); }}
                  className="text-[#cfcfcf] hover:text-[#1f1f1f]"><Copy size={12} /></button>
              </div>
            </CardRow>
            <CardRow label="Клієнтський портал" desc="Інтегрований сервіс для замовників">
              <a href={PORTAL_URL} target="_blank" rel="noopener"
                className="flex items-center gap-1 text-[12px] font-medium text-[#6366f1] hover:underline">
                Відкрити <ExternalLink size={11} />
              </a>
            </CardRow>
            <CardRow label="Мова інтерфейсу" desc="Мова відображення системи">
              <select className="text-[13px] bg-[#f7f7f7] rounded-[8px] px-3 py-[6px] outline-none border border-transparent">
                <option>🇺🇦 Українська</option>
                <option>🇬🇧 English</option>
              </select>
            </CardRow>
          </Card>
          <Card>
            <CardRow label="Timezone" desc="Використовується для дедлайнів та звітів">
              <select className="text-[13px] bg-[#f7f7f7] rounded-[8px] px-3 py-[6px] outline-none border border-transparent">
                <option>Europe/Kyiv (UTC+3)</option>
                <option>Europe/London (UTC+0)</option>
                <option>America/New_York (UTC-5)</option>
              </select>
            </CardRow>
            <CardRow label="Формат дати" desc="Як відображаються дати у задачах">
              <select className="text-[13px] bg-[#f7f7f7] rounded-[8px] px-3 py-[6px] outline-none border border-transparent">
                <option>DD MMM YYYY (15 чер 2025)</option>
                <option>DD/MM/YYYY</option>
                <option>MM/DD/YYYY</option>
              </select>
            </CardRow>
          </Card>
          <button onClick={() => showToast('Налаштування воркспейсу збережено ✓')}
            className="px-6 py-[10px] bg-[#1f1f1f] text-white rounded-[10px] text-[13px] font-bold hover:bg-[#303030] transition-colors">
            Зберегти
          </button>
        </div>
      );

      // ── Statuses ──────────────────────────────────────────────────
      case 'statuses': return (
        <div>
          <SectionHeader icon={GitBranch} title="Статуси задач"
            desc="Налаштуй стадії workflow для своїх задач. Зміни застосовуються до всіх проєктів." />

          <div className="bg-blue-50 border border-blue-100 rounded-[12px] px-4 py-3 mb-4 flex items-start gap-2">
            <span className="text-blue-500 text-[13px]">💡</span>
            <p className="text-[12px] text-blue-600">Клікни на кольоровий кружок щоб змінити колір. Клікни на назву — щоб редагувати. Перший і останній статуси не можна видалити.</p>
          </div>

          <Card>
            {wfLoading ? (
              <div className="px-5 py-8 text-center text-[#cfcfcf] text-[12px]">Завантаження...</div>
            ) : statuses.map((s, i) => (
              <WorkflowItem
                key={s.id}
                item={s}
                onSave={statusActions.onSave}
                onDelete={statusActions.onDelete}
                canDelete={i > 0 && i < statuses.length - 1}
              />
            ))}
            <div className="px-5 py-3 border-t border-[#f7f7f7]">
              <button onClick={addStatus}
                className="flex items-center gap-2 text-[12px] font-semibold text-[#6366f1] hover:text-[#4f46e5] transition-colors">
                <Plus size={13} /> Додати статус
              </button>
            </div>
          </Card>

          <button onClick={saveWorkflow} disabled={wfSaving}
            className="flex items-center gap-2 px-6 py-[10px] bg-[#1f1f1f] text-white rounded-[10px] text-[13px] font-bold hover:bg-[#303030] transition-colors disabled:opacity-50">
            {wfSaving ? <><RefreshCw size={13} className="animate-spin" /> Збереження...</> : <><Save size={13} /> Зберегти зміни</>}
          </button>
        </div>
      );

      // ── Issue Types ───────────────────────────────────────────────
      case 'types': return (
        <div>
          <SectionHeader icon={Palette} title="Типи задач" desc="Визнач категорії роботи у твоїх проєктах" />
          <Card>
            {types.map(t => (
              <WorkflowItem key={t.id} item={t} onSave={typeActions.onSave} onDelete={typeActions.onDelete} />
            ))}
            <div className="px-5 py-3 border-t border-[#f7f7f7]">
              <button onClick={addType}
                className="flex items-center gap-2 text-[12px] font-semibold text-[#6366f1]">
                <Plus size={13} /> Додати тип
              </button>
            </div>
          </Card>
          <button onClick={saveWorkflow} disabled={wfSaving}
            className="flex items-center gap-2 px-6 py-[10px] bg-[#1f1f1f] text-white rounded-[10px] text-[13px] font-bold hover:bg-[#303030] transition-colors disabled:opacity-50">
            {wfSaving ? <><RefreshCw size={13} className="animate-spin" /> Збереження...</> : <><Save size={13} /> Зберегти зміни</>}
          </button>
        </div>
      );

      // ── Priorities ────────────────────────────────────────────────
      case 'priorities': return (
        <div>
          <SectionHeader icon={AlertTriangle} title="Пріоритети"
            desc="Визнач рівні важливості задач. Впливають на підсвітку в канбані." />
          <Card>
            {priorities.map((p, i) => (
              <WorkflowItem
                key={p.id}
                item={p}
                onSave={priorityActions.onSave}
                onDelete={priorityActions.onDelete}
                canDelete={i > 0 && i < priorities.length - 1}
              />
            ))}
          </Card>

          {/* Preview */}
          <div className="mb-4">
            <p className="text-[11px] font-bold text-[#cfcfcf] uppercase tracking-widest mb-3">Превью карток</p>
            <div className="flex gap-3 flex-wrap">
              {priorities.map(p => (
                <div key={p.id}
                  className="w-[130px] bg-white rounded-[10px] border p-3 relative overflow-hidden"
                  style={{
                    borderColor: p.color + '40',
                    background: `linear-gradient(135deg, ${p.color}10, white 60%)`,
                  }}>
                  <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full" style={{ background: p.color }} />
                  <div className="pl-2">
                    <span className="text-[9px] font-bold px-2 py-[2px] rounded-full"
                      style={{ background: p.color + '18', color: p.color }}>
                      {p.emoji} {p.label}
                    </span>
                    <p className="text-[11px] font-semibold text-[#1f1f1f] mt-2 leading-tight">Назва задачі</p>
                    <p className="text-[9px] text-[#cfcfcf] mt-1">QT-42</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button onClick={saveWorkflow} disabled={wfSaving}
            className="flex items-center gap-2 px-6 py-[10px] bg-[#1f1f1f] text-white rounded-[10px] text-[13px] font-bold hover:bg-[#303030] transition-colors disabled:opacity-50">
            {wfSaving ? <><RefreshCw size={13} className="animate-spin" /> Збереження...</> : <><Save size={13} /> Зберегти зміни</>}
          </button>
        </div>
      );

      // ── Team ──────────────────────────────────────────────────────
      case 'team': return (
        <div>
          <SectionHeader icon={Users} title="Команда" desc={`${members.length} учасників у воркспейсі`} />

          <Card>
            {members.length === 0 && (
              <div className="px-5 py-8 text-center text-[12px] text-[#cfcfcf]">Немає учасників</div>
            )}
            {members.map(m => {
              const uid   = m.id || m.uid;
              const initials = (m.name || m.email || '?')[0]?.toUpperCase();
              const isMe  = uid === (currentUser?.id || currentUser?.uid);
              return (
                <div key={uid} className="flex items-center gap-3 px-5 py-[12px] border-b border-[#f7f7f7] last:border-0">
                  <div className="w-9 h-9 rounded-full bg-[#1f1f1f] flex items-center justify-center text-white text-[13px] font-bold shrink-0">
                    {m.avatar ? <img src={m.avatar} alt="" className="w-full h-full object-cover rounded-full" /> : initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#1f1f1f] flex items-center gap-2">
                      {m.name || m.email}
                      {isMe && <span className="text-[9px] font-bold px-[5px] py-[1px] bg-[#f0f0f0] text-[#9a9a9a] rounded-full">Це ти</span>}
                    </p>
                    <p className="text-[11px] text-[#9a9a9a] truncate">{m.email}</p>
                  </div>
                  <select className="text-[11px] font-bold bg-[#f7f7f7] rounded-[8px] px-3 py-[5px] outline-none border border-transparent"
                    defaultValue={m.role || 'member'}>
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  {!isMe && (
                    <button className="p-[6px] text-[#cfcfcf] hover:text-red-500 hover:bg-red-50 rounded-[6px] transition-all"
                      title="Видалити з команди">
                      <X size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </Card>

          {/* Invite */}
          <Card>
            <div className="px-5 py-4">
              <p className="text-[13px] font-bold text-[#1f1f1f] mb-1">Запросити учасника</p>
              <p className="text-[11px] text-[#9a9a9a] mb-3">Надішли запрошення на email</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="email@company.com"
                  className="flex-1 text-[13px] bg-[#f7f7f7] rounded-[10px] px-4 py-[9px] outline-none border border-transparent focus:border-[#e9e9e9]"
                />
                <select className="text-[12px] bg-[#f7f7f7] rounded-[10px] px-3 py-[9px] outline-none border border-transparent font-semibold">
                  <option>Member</option>
                  <option>Admin</option>
                  <option>Viewer</option>
                </select>
                <button onClick={() => showToast('Запрошення надіслано ✓')}
                  className="flex items-center gap-1 px-4 py-[9px] bg-[#1f1f1f] text-white rounded-[10px] text-[12px] font-bold hover:bg-[#303030] transition-colors shrink-0">
                  <Mail size={12} /> Запросити
                </button>
              </div>
            </div>
          </Card>

          {/* Roles legend */}
          <Card>
            <div className="px-5 py-4">
              <p className="text-[13px] font-bold text-[#1f1f1f] mb-3">Ролі та доступи</p>
              {[
                { role: 'Admin',  desc: 'Повний доступ: керує проєктами, командою, налаштуваннями' },
                { role: 'Member', desc: 'Може створювати та редагувати задачі, не може керувати командою' },
                { role: 'Viewer', desc: 'Тільки перегляд задач і аналітики' },
              ].map(r => (
                <div key={r.role} className="flex items-center gap-3 py-2">
                  <span className="text-[10px] font-bold px-2 py-[2px] bg-[#f0f0f0] text-[#4a4a4a] rounded-full w-[60px] text-center shrink-0">{r.role}</span>
                  <span className="text-[12px] text-[#9a9a9a]">{r.desc}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      );

      // ── Integrations ──────────────────────────────────────────────
      case 'integrations': return (
        <div>
          <SectionHeader icon={Zap} title="Інтеграції" desc="Підключи зовнішні сервіси до QuickTeam" />
          {[
            {
              name: 'Клієнтський портал', icon: '🌐', desc: 'Двосторонній синхрон матеріалів та повідомлень',
              status: 'active', statusLabel: '✓ Підключено', href: PORTAL_URL,
              actions: [{ label: 'Відкрити портал', href: PORTAL_URL }],
            },
            {
              name: 'GitHub', icon: '🐙', desc: 'Автоматично прив\'язуй коміти та PR до задач',
              status: 'coming', statusLabel: 'Незабаром',
            },
            {
              name: 'Slack', icon: '💬', desc: 'Отримуй сповіщення про задачі в Slack-каналах',
              status: 'coming', statusLabel: 'Незабаром',
            },
            {
              name: 'Figma', icon: '🎨', desc: 'Прив\'язуй макети та дизайн-файли до задач',
              status: 'coming', statusLabel: 'Незабаром',
            },
            {
              name: 'Telegram Bot', icon: '✈️', desc: 'Сповіщення в Telegram для всієї команди',
              status: 'coming', statusLabel: 'Незабаром',
            },
          ].map(int => (
            <Card key={int.name}>
              <div className="px-5 py-4 flex items-center gap-4">
                <div className="text-[28px] shrink-0">{int.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-[2px]">
                    <p className="text-[14px] font-bold text-[#1f1f1f]">{int.name}</p>
                    <span className={`text-[10px] font-bold px-2 py-[2px] rounded-full ${
                      int.status === 'active'
                        ? 'bg-green-50 text-green-600'
                        : 'bg-[#f5f5f5] text-[#cfcfcf]'
                    }`}>{int.statusLabel}</span>
                  </div>
                  <p className="text-[12px] text-[#9a9a9a]">{int.desc}</p>
                </div>
                {int.status === 'active' && int.href && (
                  <a href={int.href} target="_blank" rel="noopener"
                    className="flex items-center gap-1 text-[12px] font-semibold text-[#6366f1] hover:underline shrink-0">
                    Відкрити <ExternalLink size={11} />
                  </a>
                )}
                {int.status === 'coming' && (
                  <button onClick={() => showToast('Незабаром 🚀')}
                    className="text-[12px] font-semibold text-[#cfcfcf] hover:text-[#9a9a9a] shrink-0">
                    Підключити →
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      );

      // ── Notifications ─────────────────────────────────────────────
      case 'notifications': return (
        <div>
          <SectionHeader icon={Bell} title="Сповіщення" desc="Вибери які події тобі важливі" />
          <Card>
            {[
              { key: 'assigned',      label: 'Задачу призначено мені',   desc: 'Хтось призначив задачу на тебе' },
              { key: 'commented',     label: 'Новий коментар',           desc: 'В задачі де ти виконавець або автор' },
              { key: 'statusChanged', label: 'Зміна статусу задачі',     desc: 'Коли змінюється статус твоїх задач' },
              { key: 'deadline',      label: 'Дедлайн завтра',           desc: 'Нагадування за 24 год до дедлайну' },
              { key: 'mentioned',     label: 'Тебе згадали',             desc: 'Хтось написав @твоє-ім\'я' },
            ].map(n => (
              <CardRow key={n.key} label={n.label} desc={n.desc}>
                <Toggle value={notif[n.key]} onChange={v => setNotif(p => ({ ...p, [n.key]: v }))} />
              </CardRow>
            ))}
          </Card>
          <Card>
            <CardRow label="Browser Push-сповіщення" desc="Нативні push у браузері навіть коли вкладка закрита">
              <button
                onClick={async () => {
                  const result = await Notification.requestPermission();
                  showToast(result === 'granted' ? 'Push дозволено ✓' : 'Push відхилено');
                }}
                className="text-[12px] font-semibold text-[#6366f1] hover:underline"
              >
                {typeof window !== 'undefined' && window.Notification?.permission === 'granted' ? '✓ Дозволено' : 'Дозволити'}
              </button>
            </CardRow>
          </Card>
          <button onClick={() => showToast('Сповіщення збережено ✓')}
            className="px-6 py-[10px] bg-[#1f1f1f] text-white rounded-[10px] text-[13px] font-bold hover:bg-[#303030] transition-colors">
            Зберегти
          </button>
        </div>
      );

      // ── Danger Zone ───────────────────────────────────────────────
      case 'danger': return (
        <div>
          <SectionHeader icon={Shield} title="Небезпечна зона" desc="Необоротні дії. Будь обережний." />
          <Card>
            <CardRow label="Експортувати дані"
              desc="Завантажити всі задачі, коментарі та файли в ZIP-архів">
              <button
                onClick={() => showToast('Експорт розпочато, завантажиться за кілька хвилин')}
                className="flex items-center gap-1 text-[12px] font-semibold text-[#1f1f1f] hover:text-[#6366f1]">
                <Download size={13} /> Експортувати
              </button>
            </CardRow>
            <CardRow label="Вийти з акаунту" desc="Вихід на всіх пристроях">
              <button
                onClick={() => { if (confirm('Вийти?')) signOut(); }}
                className="flex items-center gap-1 text-[12px] font-semibold text-red-500 hover:text-red-700">
                <LogOut size={13} /> Вийти
              </button>
            </CardRow>
            <CardRow label="Скинути workflow" desc="Повернути статуси, типи та пріоритети до стандартних значень" danger>
              <button
                onClick={async () => {
                  if (!confirm('Скинути всі workflow налаштування до стандартних?')) return;
                  setStatuses(DEFAULT_STATUSES);
                  setTypes(DEFAULT_TYPES);
                  setPriorities(DEFAULT_PRIORITIES);
                  await saveWorkflow();
                  showToast('Workflow скинуто ✓');
                }}
                className="flex items-center gap-1 text-[12px] font-semibold text-red-500 hover:text-red-700">
                <RefreshCw size={13} /> Скинути
              </button>
            </CardRow>
            <CardRow label="Видалити воркспейс" desc="Видалить всі проєкти, задачі та дані команди. Необоротно." danger>
              <button
                onClick={() => {
                  const confirm1 = prompt('Введи DELETE для підтвердження');
                  if (confirm1 === 'DELETE') showToast('Функція недоступна в demo-режимі', 'error');
                }}
                className="flex items-center gap-1 text-[12px] font-bold text-red-600 hover:text-red-800 bg-red-50 px-3 py-[5px] rounded-[7px]">
                <Trash2 size={12} /> Видалити
              </button>
            </CardRow>
          </Card>
        </div>
      );

      default: return null;
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // LAYOUT
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex overflow-hidden bg-[#f5f5f5]">

      {/* ── LEFT SIDEBAR NAV ── */}
      <aside className="w-[220px] shrink-0 bg-white border-r border-[#efefef] overflow-y-auto">
        <div className="px-4 pt-6 pb-4">
          <p className="text-[12px] font-bold text-[#1f1f1f]">Налаштування</p>
        </div>
        {groups.map(group => {
          const items = NAV.filter(n => n.group === group);
          return (
            <div key={group} className="mb-2">
              <p className="px-4 py-[5px] text-[9px] font-bold text-[#cfcfcf] uppercase tracking-widest">{group}</p>
              {items.map(nav => {
                const Icon    = nav.icon;
                const active  = activeSection === nav.id;
                return (
                  <button
                    key={nav.id}
                    onClick={() => setActiveSection(nav.id)}
                    className={`flex items-center gap-3 w-full px-4 py-[9px] text-[13px] font-medium transition-all text-left ${
                      active
                        ? 'bg-[#f0f0f0] text-[#1f1f1f] font-semibold'
                        : nav.danger
                          ? 'text-red-500 hover:bg-red-50'
                          : 'text-[#4a4a4a] hover:bg-[#f7f7f7]'
                    }`}
                  >
                    <Icon size={14} className={active ? 'text-[#1f1f1f]' : nav.danger ? 'text-red-400' : 'text-[#9a9a9a]'} />
                    {nav.label}
                    {active && <ChevronRight size={11} className="ml-auto text-[#cfcfcf]" />}
                  </button>
                );
              })}
            </div>
          );
        })}
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[720px] mx-auto px-8 pt-8 pb-16">
          {renderSection()}
        </div>
      </main>
    </div>
  );
}
