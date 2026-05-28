'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { doc, updateDoc, addDoc, deleteDoc, collection, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ExternalLink, Archive, ArchiveRestore, Plus, Folder, Clock, Users, CheckCircle2, TrendingUp, Target, ArrowRight, Check, Lock, Globe, X, MoreVertical, Edit2, Trash2, User, CheckSquare, Search, Settings2, UserPlus, AlertCircle } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { can } from '@/lib/utils/can';
import BoardConfigModal from '@/components/workspace/BoardConfigModal';
import PageHeader from '@/components/workspace/PageHeader';
import Dialog from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Forms/Textarea';
import { Alert } from '@/components/ui/Feedback/Alert';
import Card from '@/components/ui/Layout/Card';

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://qt-green.vercel.app';

// ── Edit Project Modal ───────────────────────────────────────────────────────
function EditProjectModal({ project, onClose }) {
  const [name, setName] = useState(project.name || '');
  const [description, setDescription] = useState(project.description || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        name: name.trim(),
        description: description.trim(),
        updatedAt: serverTimestamp(),
      });
      onClose();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  return (
    <Dialog isOpen={true} onClose={onClose} title="Редагувати проєкт" size="sm">
      <div className="flex flex-col gap-[16px]">
        <div>
          <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[6px] block">Назва проєкту *</label>
          <Input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[6px] block">Опис</label>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="Короткий опис проєкту..."
          />
        </div>
      </div>
      <div className="flex gap-[8px] mt-[24px]">
        <Button onClick={onClose} style="secondary" size="md" className="flex-1">Скасувати</Button>
        <Button onClick={handleSave} disabled={!name.trim() || saving} style="primary" size="md" className="flex-1">
          {saving ? 'Збереження...' : 'Зберегти'}
        </Button>
      </div>
    </Dialog>
  );
}

// ── Add Member Modal ─────────────────────────────────────────────────────────
function AddMemberModal({ project, allMembers, onClose }) {
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [localTeam, setLocalTeam] = useState(project.team || []);

  const filtered = allMembers.filter(m => {
    const uid = m.id || m.uid;
    const q = search.toLowerCase();
    return (m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q));
  });

  const toggleMember = (uid) => {
    setLocalTeam(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        team: localTeam,
        updatedAt: serverTimestamp(),
      });
      onClose();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  return (
    <Dialog isOpen={true} onClose={onClose} title="Учасники проєкту" size="sm">
      <div className="flex flex-col gap-[16px]">
        <Input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Пошук по імені або email..."
          icon={Search}
        />
        <div className="flex-1 overflow-y-auto max-h-[300px] flex flex-col gap-[4px] -mx-1 px-1">
          {filtered.length === 0 && (
            <p className="text-center text-[13px] text-[#9a9a9a] py-8">Нікого не знайдено</p>
          )}
          {filtered.map(m => {
            const uid = m.id || m.uid;
            const isIn = localTeam.includes(uid);
            return (
              <button
                key={uid}
                onClick={() => toggleMember(uid)}
                className={`flex items-center gap-[12px] px-[12px] py-[10px] rounded-[12px] transition-colors text-left ${
                  isIn ? 'bg-[#eef2ff]' : 'hover:bg-[#f7f7f7]'
                }`}
              >
                <UserAvatar user={m} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[#1f1f1f] truncate">{m.name || m.email}</p>
                  <p className="text-[12px] text-[#9a9a9a] truncate">{m.email}</p>
                </div>
                <div className={`w-[20px] h-[20px] rounded-full border-2 flex items-center justify-center shrink-0 ${
                  isIn ? 'bg-[#6366f1] border-[#6366f1]' : 'border-[#e9e9e9]'
                }`}>
                  {isIn && <Check size={11} strokeWidth={3} className="text-white" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex gap-[8px] mt-[24px]">
        <Button onClick={onClose} style="secondary" size="md" className="flex-1">Скасувати</Button>
        <Button onClick={handleSave} disabled={saving} style="primary" size="md" className="flex-1">
          {saving ? 'Збереження...' : `Зберегти (${localTeam.length})`}
        </Button>
      </div>
    </Dialog>
  );
}

// ── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteConfirmModal({ project, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'projects', project.id));
      onDeleted?.();
      onClose();
    } catch (err) { console.error(err); setDeleting(false); }
  };

  return (
    <Dialog isOpen={true} onClose={onClose} size="sm" showCloseButton={false}>
      <div className="flex flex-col items-center text-center">
        <div className="w-[56px] h-[56px] bg-red-50 rounded-full flex items-center justify-center mb-[16px]">
          <AlertCircle size={24} className="text-red-500" />
        </div>
        <h2 className="text-[18px] font-bold text-[#1f1f1f] mb-[8px]">Видалити проєкт?</h2>
        <p className="text-[13px] text-[#9a9a9a] leading-relaxed mb-[24px]">
          Ви видаляєте <strong className="text-[#1f1f1f]">{project.name}</strong>. Цю дію неможливо скасувати.
        </p>
        <div className="flex gap-[8px] w-full">
          <Button onClick={onClose} style="secondary" size="md" className="flex-1">Скасувати</Button>
          <Button onClick={handleDelete} disabled={deleting} color="red" style="primary" size="md" className="flex-1">
            {deleting ? 'Видалення...' : 'Видалити'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ── Project Card ─────────────────────────────────────────────────────────────
const ProjectCard = ({ project, archive, unarchive, members = [], allOrgMembers = [] }) => {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showBoardConfig, setShowBoardConfig] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const isArchived = project.status === 'archived';
  const teamCount = Array.isArray(project.team) ? project.team.length : 0;

  const handleCardClick = (e) => {
    if (e.target.closest('.no-nav')) return;
    router.push(`/workspace/${project.id}`);
  };

  return (
    <>
      <div
        onClick={handleCardClick}
        className="group cursor-pointer relative bg-[#f7f7f7] rounded-[24px] flex flex-col border border-transparent shadow-none overflow-visible hover:bg-[#f0f0f0] transition-all duration-200 p-[20px] gap-[16px]"
      >
        {/* Top row: avatars + kebab */}
        <div className="flex items-center justify-between">
          <div className="flex -space-x-[10px]">
            {teamCount === 0 && (
              <div className="w-[30px] h-[30px] rounded-full bg-[#e9e9e9] border-2 border-[#f7f7f7] flex items-center justify-center">
                <Users size={13} className="text-[#9a9a9a]" />
              </div>
            )}
            {(project.team || []).slice(0, 4).map(uid => {
              const m = members.find(mbr => (mbr.id || mbr.uid) === uid);
              return m ? (
                <UserAvatar key={uid} user={m} size={30} className="border-2 border-[#f7f7f7] shadow-none" />
              ) : (
                <div key={uid} className="w-[30px] h-[30px] rounded-full bg-[#e9e9e9] border-2 border-[#f7f7f7] flex items-center justify-center">
                  <User size={13} className="text-[#9a9a9a]" />
                </div>
              );
            })}
            {teamCount > 4 && (
              <div className="w-[30px] h-[30px] rounded-full bg-[#e0e0e0] border-2 border-[#f7f7f7] flex items-center justify-center text-[9px] font-bold text-[#9a9a9a]">
                +{teamCount - 4}
              </div>
            )}
          </div>

          {/* Kebab menu */}
          <div className="relative no-nav">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              className="p-[7px] text-[#9a9a9a] hover:bg-white hover:text-[#1f1f1f] rounded-[8px] transition-all"
            >
              <MoreVertical size={16} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-[calc(100%+4px)] w-[200px] bg-white rounded-[16px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-[#f0f0f0] py-[6px] z-50">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowBoardConfig(true); setMenuOpen(false); }}
                    className="w-full text-left px-[14px] py-[9px] text-[13px] font-semibold text-[#1f1f1f] hover:bg-[#f7f7f7] flex items-center gap-[8px]"
                  >
                    <Settings2 size={14} className="text-[#9a9a9a]" /> Налаштувати
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowAddMember(true); setMenuOpen(false); }}
                    className="w-full text-left px-[14px] py-[9px] text-[13px] font-semibold text-[#1f1f1f] hover:bg-[#f7f7f7] flex items-center gap-[8px]"
                  >
                    <UserPlus size={14} className="text-[#9a9a9a]" /> Учасники
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowEdit(true); setMenuOpen(false); }}
                    className="w-full text-left px-[14px] py-[9px] text-[13px] font-semibold text-[#1f1f1f] hover:bg-[#f7f7f7] flex items-center gap-[8px]"
                  >
                    <Edit2 size={14} className="text-[#9a9a9a]" /> Редагувати
                  </button>
                  <div className="h-[1px] bg-[#f0f0f0] my-[4px] mx-[14px]" />
                  {!isArchived ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); archive(project.id); setMenuOpen(false); }}
                      className="w-full text-left px-[14px] py-[9px] text-[13px] font-semibold text-[#9a9a9a] hover:bg-[#f7f7f7] hover:text-[#1f1f1f] flex items-center gap-[8px]"
                    >
                      <Archive size={14} /> Архівувати
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); unarchive(project.id); setMenuOpen(false); }}
                      className="w-full text-left px-[14px] py-[9px] text-[13px] font-semibold text-[#10b981] hover:bg-emerald-50 flex items-center gap-[8px]"
                    >
                      <ArchiveRestore size={14} /> Розархівувати
                    </button>
                  )}
                  <div className="h-[1px] bg-[#f0f0f0] my-[4px] mx-[14px]" />
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowDelete(true); setMenuOpen(false); }}
                    className="w-full text-left px-[14px] py-[9px] text-[13px] font-semibold text-red-500 hover:bg-red-50 flex items-center gap-[8px]"
                  >
                    <Trash2 size={14} /> Видалити
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Title + description */}
        <div className="flex flex-col gap-[6px]">
          <h2 className="text-[16px] font-bold text-[#1f1f1f] leading-tight line-clamp-2">
            {project.name}
          </h2>
          {project.description && (
            <p className="text-[13px] text-[#9a9a9a] leading-[1.5] line-clamp-2">
              {project.description}
            </p>
          )}
        </div>

        {/* Bottom: task count + status badges */}
        <div className="flex items-center gap-[8px]">
          <span className="flex items-center gap-[5px] text-[11px] font-semibold text-[#9a9a9a] bg-white px-[8px] py-[4px] rounded-[8px]">
            <CheckSquare size={11} />{project.issueCounter || 0} задач
          </span>
          {isArchived && (
            <span className="text-[10px] font-bold px-[8px] py-[3px] rounded-[8px] bg-white text-[#9a9a9a]">
              Архів
            </span>
          )}
        </div>
      </div>

      {/* Modals */}
      {showEdit && <EditProjectModal project={project} onClose={() => setShowEdit(false)} />}
      {showAddMember && <AddMemberModal project={project} allMembers={allOrgMembers} onClose={() => setShowAddMember(false)} />}
      {showBoardConfig && <BoardConfigModal project={project} onClose={() => setShowBoardConfig(false)} />}
      {showDelete && <DeleteConfirmModal project={project} onClose={() => setShowDelete(false)} />}
    </>
  );
};

// ── New Internal Project Modal ───────────────────────────────────────────────
function NewProjectModal({ onClose, orgId, userId, orgPlan, activeProjectsCount }) {
  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [visibility,  setVisibility]  = useState('internal');
  const [saving,      setSaving]      = useState(false);

  const isFree      = orgPlan !== 'pro';
  const limitReached = false;

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        visibility,
        organizationId: orgId,
        team: [userId],
        status: 'active',
        progress: 0,
        stagesCount: 4,
        issueCounter: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: userId,
      };

      const projectRef = await addDoc(collection(db, 'projects'), payload);

      const stageNames = ['Брифінг & Аналіз', 'Дизайн & UI/UX', 'Розробка', 'Тестування & Реліз'];
      for (let i = 0; i < stageNames.length; i++) {
        const stageData = {
          label: `${String(i + 1).padStart(2, '0')}. ${stageNames[i]}`,
          status: i === 0 ? 'in-progress' : 'todo',
          projectId: projectRef.id,
          order: i,
          createdAt: serverTimestamp(),
        };
        await addDoc(collection(db, 'stages'), stageData);
      }

      onClose();
    } catch (err) {
      console.error('[NewProject]', err);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[24px] w-full max-w-[480px] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-[24px] pt-[24px] pb-[20px] border-b border-[#f0f0f0]">
          <h2 className="text-[18px] font-bold text-[#1f1f1f]">Новий проєкт</h2>
          <button onClick={onClose} className="p-[6px] hover:bg-[#f7f7f7] rounded-[8px] text-[#9a9a9a]"><X size={18} /></button>
        </div>
        {/* Content: upsell OR form */}
        {limitReached ? (
        <div className="p-[24px] flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-[#eef2ff] rounded-[20px] flex items-center justify-center mb-4">
            <Lock size={28} className="text-[#6366f1]" />
          </div>
          <h3 className="text-[17px] font-bold text-[#1f1f1f] mb-2">Ліміт Free плану</h3>
          <p className="text-[13px] text-[#9a9a9a] leading-relaxed mb-6">
            На безкоштовному тарифі дозволено максимум <strong>3 проєкти</strong>.
            Перейдіть на Pro для необмеженої кількості проєктів.
          </p>
          <div className="flex flex-col gap-2 w-full">
            <button
              onClick={() => { onClose(); window.location.href = '/workspace/settings#billing'; }}
              className="w-full h-[32px] rounded-[10px] text-[13px] font-bold text-white bg-[#6366f1] hover:bg-[#4f46e5] transition-colors"
            >
              Перейти на PRO →
            </button>
            <button onClick={onClose} className="w-full h-[32px] rounded-[10px] text-[13px] font-bold text-[#9a9a9a] hover:bg-[#f7f7f7] transition-colors">
              Закрити
            </button>
          </div>
        </div>
      ) : (
        <div className="p-[24px] flex flex-col gap-[16px]">
          <div>
            <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[6px] block">Назва проєкту *</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="Наприклад: Редизайн сайту"
              className="w-full text-[15px] font-semibold bg-[#f7f7f7] rounded-[12px] px-[14px] py-[10px] outline-none border border-transparent focus:border-[#1f1f1f] transition-colors"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[6px] block">Опис</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Короткий опис проєкту..."
              rows={3}
              className="w-full text-[14px] bg-[#f7f7f7] rounded-[12px] px-[14px] py-[10px] outline-none border border-transparent focus:border-[#1f1f1f] transition-colors resize-none"
            />
          </div>
        </div>
        )}
        {!limitReached && (
          <div className="flex gap-[8px] px-[24px] pb-[24px]">
            <button onClick={onClose} className="flex-1 h-[32px] rounded-[10px] text-[13px] font-bold text-[#9a9a9a] bg-[#f7f7f7] hover:bg-[#f0f0f0] transition-colors">
              Скасувати
            </button>
            <button
              onClick={handleCreate}
              disabled={!name.trim() || saving}
              className="flex-1 h-[32px] rounded-[10px] text-[13px] font-bold text-white bg-[#1f1f1f] hover:bg-[#303030] disabled:opacity-40 transition-colors"
            >
              {saving ? 'Створення...' : 'Створити проєкт'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  const { projects, currentUser, activeOrgId, activeOrg, orgRole } = useAppContext();
  const { members } = useOrganization();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const [showArchived,   setShowArchived]   = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);

  // Auto-open modal when navigated with ?new=1
  useEffect(() => {
    if (searchParams?.get('new') === '1') {
      setShowNewProject(true);
      router.replace('/workspace', { scroll: false });
    }
  }, [searchParams]);

  const visible = (projects || []).filter(p =>
    showArchived ? p.status === 'archived' : p.status !== 'archived'
  );

  const archive   = (id) => updateDoc(doc(db, 'projects', id), { status: 'archived' });
  const unarchive = (id) => updateDoc(doc(db, 'projects', id), { status: 'active' });

  const stats = useMemo(() => {
    const active = (projects || []).filter(p => p.status !== 'archived');
    const total = active.length;
    const completed = active.filter(p => p.progress >= 100).length;
    const avgProgress = total > 0 ? Math.round(active.reduce((acc, p) => acc + (p.progress || 0), 0) / total) : 0;
    return { total, completed, avgProgress };
  }, [projects]);

  return (<>
    <div className="flex-1 h-full overflow-y-auto overflow-x-hidden px-[32px] pb-[120px] custom-scrollbar bg-transparent">
      <div className="max-w-[1400px] mx-auto">
        
        <PageHeader
          variant="main"
          title="Проєкти"
          actions={
            <>
              <button
                onClick={() => setShowArchived(s => !s)}
                className={`flex items-center justify-center gap-[6px] px-[16px] h-[32px] rounded-[10px] text-[13px] font-bold transition-all ${
                  showArchived
                    ? 'bg-[#1f1f1f] text-white'
                    : 'bg-[#f5f5f5] text-[#1f1f1f] hover:bg-[#e9e9e9]'
                }`}
              >
                <Archive size={14} />
                <span className="hidden sm:inline">{showArchived ? 'Активні' : 'Архів'}</span>
              </button>

              {can(orgRole, 'create:project') && (
                <button
                  onClick={() => setShowNewProject(true)}
                  className="flex items-center justify-center px-[20px] gap-[6px] h-[36px] rounded-[10px] text-[14px] font-bold bg-[#1f1f1f] text-white hover:bg-[#303030] transition-all"
                >
                  <Plus size={16} /> <span className="hidden sm:inline">Новий проєкт</span>
                </button>
              )}
            </>
          }
        />

        {/* Projects Grid */}
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-[80px] text-center bg-white rounded-[32px] border border-[#f0f0f0]">
            <div className="w-[80px] h-[80px] bg-[#f7f7f7] rounded-full flex items-center justify-center mb-[24px]">
              <Folder size={40} className="text-[#cfcfcf]" />
            </div>
            <h2 className="text-[22px] font-bold text-[#1f1f1f] mb-[8px]">
              {showArchived ? 'Немає архівованих проєктів' : 'Немає активних проєктів'}
            </h2>
            <p className="text-[#9a9a9a] text-[14px] max-w-[280px]">
              Створіть новий проєкт, щоб розпочати роботу з командою.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[24px]">
            {visible.map(p => (
              <ProjectCard 
                key={p.id} 
                project={p} 
                archive={archive} 
                unarchive={unarchive}
                members={members}
                allOrgMembers={members}
              />
            ))}
          </div>
        )}

      </div>
    </div>

    {showNewProject && (
      <NewProjectModal
        onClose={() => setShowNewProject(false)}
        orgId={activeOrgId}
        userId={currentUser?.id || currentUser?.uid}
        orgPlan={activeOrg?.plan}
        activeProjectsCount={stats.total}
      />
    )}
  </>);
}
