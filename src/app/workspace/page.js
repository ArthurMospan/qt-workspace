'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { doc, updateDoc, collection, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ExternalLink, Archive, ArchiveRestore, Plus, Folder, Clock, Users, CheckCircle2, TrendingUp, Target, ArrowRight, Check, Lock, Globe, MoreVertical, Edit2, Trash2, User, CheckSquare, Search, Settings2, UserPlus, Activity, MessageSquare } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';
import { useOrganization } from '@/lib/hooks/useOrganization';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { can } from '@/lib/utils/can';
import BoardConfigModal from '@/components/workspace/BoardConfigModal';
import { PageHeader, EmptyState, useConfirm } from '@/components/ui';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import ContextMenu from '@/components/ui/ContextMenu';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Forms/Textarea';
import Alert from '@/components/ui/Feedback/Alert';
import Card from '@/components/ui/Layout/Card';
import { Select, MultiSelect } from '@/components/ui/Select';
import FilterBar from '@/components/ui/FilterBar';
import Surface from '@/components/ui/Surface';
import TaskCard from '@/components/ui/TaskManagement/TaskCard';
import CreateTaskModal from '@/components/CreateTaskModal';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { useSprints } from '@/lib/hooks/useSprints';
import { createIssueViaApi } from '@/lib/services/issues';
import { archiveProject, deleteProject, restoreProject } from '@/lib/services/projects';

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
    <Dialog
      isOpen={true}
      onClose={onClose}
      title="Редагувати проєкт"
      size="sm"
      footer={
        <>
          <Button onClick={onClose} style="secondary" size="md">Скасувати</Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving} style="primary" size="md">
            {saving ? 'Збереження...' : 'Зберегти'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-[16px]">
        <div>
          <label className="text-[11px] font-bold text-muted uppercase tracking-wider mb-[6px] block">Назва проєкту *</label>
          <Input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-muted uppercase tracking-wider mb-[6px] block">Опис</label>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="Короткий опис проєкту..."
          />
        </div>
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
    <Dialog
      isOpen={true}
      onClose={onClose}
      title="Учасники проєкту"
      size="sm"
      footer={
        <>
          <Button onClick={onClose} style="secondary" size="md">Скасувати</Button>
          <Button onClick={handleSave} disabled={saving} style="primary" size="md">
            {saving ? 'Збереження...' : `Зберегти (${localTeam.length})`}
          </Button>
        </>
      }
    >
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
            <p className="text-center text-[13px] text-muted py-8">Нікого не знайдено</p>
          )}
          {filtered.map(m => {
            const uid = m.id || m.uid;
            const isIn = localTeam.includes(uid);
            return (
              <button
                key={uid}
                onClick={() => toggleMember(uid)}
                className={`flex items-center gap-[12px] px-[12px] py-[10px] rounded-[12px] transition-colors text-left ${
                  isIn ? 'bg-[#eef2ff]' : 'hover:bg-canvas'
                }`}
              >
                <UserAvatar user={m} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-ink truncate">{m.name || m.email}</p>
                  <p className="text-[12px] text-muted truncate">{m.email}</p>
                </div>
                <div className={`w-[20px] h-[20px] rounded-full border-2 flex items-center justify-center shrink-0 ${
                  isIn ? 'bg-[#6366f1] border-[#6366f1]' : 'border-line'
                }`}>
                  {isIn && <Check size={11} strokeWidth={3} className="text-white" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
}

// ── Project Card ─────────────────────────────────────────────────────────────
const ProjectCard = ({ project, archive, unarchive, members = [], allOrgMembers = [], issues = [], isLarge = false }) => {
  const router = useRouter();
  const { currentUser, activeOrgId } = useAppContext();
  const confirmDialog = useConfirm();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showBoardConfig, setShowBoardConfig] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const isArchived = project.status === 'archived';
  const teamCount = Array.isArray(project.team) ? project.team.length : 0;

  useEffect(() => {
    if (!project?.id || !activeOrgId || !currentUser) return;
    const uid = currentUser.id || currentUser.uid;
    const channelId = `project_${project.id}`;
    
    const readStateRef = doc(db, 'organizations', activeOrgId, 'readState', `${uid}_${channelId}`);
    const messagesRef = collection(db, 'organizations', activeOrgId, 'channels', channelId, 'messages');
    
    let lastReadTime = 0;
    let messagesList = [];

    const updateUnread = () => {
      const count = messagesList.filter(m => (m.createdAt?.toMillis?.() || 0) > lastReadTime).length;
      setUnreadCount(count);
    };

    const unsubRead = onSnapshot(readStateRef, (snap) => {
      lastReadTime = snap.exists() ? (snap.data().lastReadAt?.toMillis?.() || 0) : 0;
      updateUnread();
    }, () => {});

    const unsubMsgs = onSnapshot(query(messagesRef), (snap) => {
      messagesList = snap.docs.map(d => d.data());
      updateUnread();
    }, () => {});

    return () => {
      unsubRead();
      unsubMsgs();
    };
  }, [project.id, activeOrgId, currentUser]);

  const handleCardClick = (e) => {
    if (e.target.closest('.no-nav')) return;
    router.push(`/workspace/${project.id}`);
  };

  return (
    <>
      <div
        onClick={handleCardClick}
        className={`group relative flex flex-col justify-between bg-white !rounded-[16px] cursor-pointer overflow-visible transition-all duration-300 hover:ring-4 hover:ring-[#ECECEC] border border-transparent ${menuOpen ? 'z-30' : 'hover:z-10'} ${
          isLarge 
            ? 'md:col-span-2 md:row-span-2 p-[32px] pb-[40px] gap-[32px] min-h-[280px]' 
            : 'p-[24px] pb-[28px] gap-[20px] min-h-[220px]'
        }`}
      >
        {/* Top row: avatars + kebab */}
        <div className={`flex items-center justify-between ${menuOpen ? 'z-20' : 'z-10'}`}>
          <div className="flex -space-x-[10px]">
            {teamCount === 0 && (
              <div className="w-[30px] h-[30px] rounded-full bg-white flex items-center justify-center border-2 border-canvas">
                <Users size={13} className="text-muted" />
              </div>
            )}
            {(project.team || []).slice(0, 4).map(uid => {
              const m = members.find(mbr => (mbr.id || mbr.uid) === uid);
              return m ? (
                <UserAvatar key={uid} user={m} size={30} className="border-2 border-white shadow-none" />
              ) : (
                <div key={uid} className="w-[30px] h-[30px] rounded-full bg-white flex items-center justify-center border-2 border-canvas">
                  <User size={13} className="text-muted" />
                </div>
              );
            })}
            {teamCount > 4 && (
              <div className="w-[30px] h-[30px] rounded-full bg-[#e0e0e0] flex items-center justify-center text-[9px] font-bold text-muted border-2 border-white">
                +{teamCount - 4}
              </div>
            )}
          </div>

          {/* Kebab menu */}
          <div className="relative no-nav flex items-center gap-[8px]">
            {isArchived && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  unarchive(project.id);
                }}
                className="px-[12px] py-[6px] rounded-[8px] bg-[#10b981]/10 text-[#10b981] hover:bg-[#10b981]/20 text-[12px] font-bold transition-all flex items-center gap-[4px] no-nav"
              >
                <ArchiveRestore size={13} />
                Розархівувати
              </button>
            )}
            <ContextMenu
              onOpenChange={setMenuOpen}
              trigger={
                <button className="p-[7px] text-muted hover:bg-white hover:text-ink rounded-[8px] transition-all">
                  <MoreVertical size={16} />
                </button>
              }
              items={[
                { icon: Settings2, label: 'Налаштувати', onClick: () => setShowBoardConfig(true) },
                { icon: UserPlus, label: 'Учасники', onClick: () => setShowAddMember(true) },
                { icon: Edit2, label: 'Редагувати', onClick: () => setShowEdit(true) },
                { isDivider: true },
                !isArchived ? (
                  { icon: Archive, label: 'Архівувати', onClick: () => archive(project.id) }
                ) : (
                  { icon: ArchiveRestore, label: 'Розархівувати', onClick: () => unarchive(project.id), color: '#10b981' }
                ),
                { isDivider: true },
                { icon: Trash2, label: 'Видалити', isDanger: true, onClick: async () => {
                  if (await confirmDialog({
                    title: 'Видалити проєкт?',
                    message: `Ви видаляєте «${project.name}». Цю дію неможливо скасувати.`,
                    confirmText: 'Видалити', danger: true,
                  })) {
                    await deleteProject(project.id);
                  }
                } },
              ]}
            />
          </div>
        </div>

        {/* Title + description */}
        <div className="flex flex-col gap-[8px] z-10">
          <h2 className={`font-bold text-ink leading-tight transition-all duration-300 flex items-center gap-2 flex-wrap ${
            isLarge ? 'text-[28px]' : 'text-[18px]'
          }`}>
            <span>{project.name}</span>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center bg-ink text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 min-w-[20px] h-[20px]" title="Непрочитані повідомлення">
                {unreadCount}
              </span>
            )}
          </h2>
          {project.description && (
            <p className={`text-muted font-medium leading-[1.5] line-clamp-2 ${
              isLarge ? 'text-[14px] max-w-[560px]' : 'text-[13px]'
            }`}>
              {project.description}
            </p>
          )}
        </div>

        {/* Real-time stats and Dynamic content */}
        <ProjectStatsSection isLarge={isLarge} members={members} issues={issues} now={now} />
      </div>

      {/* Modals */}
      {showEdit && <EditProjectModal project={project} onClose={() => setShowEdit(false)} />}
      {showAddMember && <AddMemberModal project={project} allMembers={allOrgMembers} onClose={() => setShowAddMember(false)} />}
      {showBoardConfig && <BoardConfigModal project={project} onClose={() => setShowBoardConfig(false)} />}
    </>
  );
};

// Helper Component for Real-time project statistics and details
function ProjectStatsSection({ isLarge, members, issues = [], now }) {
  const { statuses, doneStatusIds } = useWorkflowConfig();
  const inProgressStatusIds = useMemo(
    () => statuses.slice(1).filter(status => !doneStatusIds.includes(status.id)).map(status => status.id),
    [statuses, doneStatusIds],
  );

  const stats = useMemo(() => {
    let inProgressCount = 0;
    let newestIssue = null;
    let newestTime = 0;

    for (const issue of issues) {
      if (inProgressStatusIds.includes(issue.columnId || issue.status)) {
        inProgressCount++;
      }

      const updatedAtTime = issue.updatedAt?.toMillis?.() || issue.createdAt?.toMillis?.() || 0;
      if (updatedAtTime > newestTime) {
        newestTime = updatedAtTime;
        newestIssue = issue;
      }
    }

    const commentsCount = issues.reduce(
      (sum, issue) => sum + (typeof issue.commentCount === 'number' ? issue.commentCount : 0),
      0,
    );

    let lastActionStr = null;
    if (newestIssue) {
      let actorName = 'Команда';
      let actorAvatar = null;
      let actorUser = null;
      if (newestIssue.updatedBy) {
        actorUser = members.find(m => (m.id || m.uid) === newestIssue.updatedBy);
      } else if (newestIssue.reporterId) {
        actorUser = members.find(m => (m.id || m.uid) === newestIssue.reporterId);
      } else if (newestIssue.reporterName) {
        actorUser = members.find(m => m.email && m.email.toLowerCase() === newestIssue.reporterName.toLowerCase());
      }

      if (actorUser) {
        actorName = actorUser.name || actorUser.displayName || actorUser.email?.split('@')[0];
        actorAvatar = actorUser.avatar || actorUser.photoURL || actorUser.photoUrl;
      } else if (newestIssue.source === 'buggybag' || newestIssue.integration === 'buggybag') {
        actorName = 'BuggyBag';
      } else if (newestIssue.reporterName) {
        actorName = newestIssue.reporterName;
      }

      lastActionStr = {
        issueKey: newestIssue.issueKey || 'Задачу',
        title: newestIssue.title,
        actor: actorName,
        actorAvatar,
        time: newestIssue.updatedAt || newestIssue.createdAt
      };
    }

    return {
      total: issues.length,
      inProgress: inProgressCount,
      comments: commentsCount,
      lastAction: lastActionStr
    };
  }, [issues, members, inProgressStatusIds]);

  const timeAgoString = (ts) => {
    if (!ts) return '';
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    const diff = now - d.getTime();
    if (diff < 60000) return 'щойно';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} хв тому`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} год тому`;
    return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="z-10 mt-auto flex flex-col gap-[14px] w-full">
      {isLarge && stats.lastAction && (
        <div className="bg-[#fafafa]/80 rounded-[12px] p-3 text-[12px] text-[#2a2a2a] flex items-start gap-2.5">
          {/* Actor Avatar */}
          {stats.lastAction.actorAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img 
              src={stats.lastAction.actorAvatar} 
              alt={stats.lastAction.actor} 
              referrerPolicy="no-referrer"
              className="w-7 h-7 rounded-full object-cover shrink-0" 
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-ink/5 text-ink font-bold flex items-center justify-center text-[9px] shrink-0 uppercase">
              {stats.lastAction.actor ? stats.lastAction.actor.slice(0, 2) : 'АМ'}
            </div>
          )}

          {/* Activity Text details */}
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-bold text-ink">{stats.lastAction.actor}</span>
              {stats.lastAction.time && (
                <span className="text-[10px] text-muted shrink-0 font-medium">{timeAgoString(stats.lastAction.time)}</span>
              )}
            </div>
            <p className="text-muted leading-tight line-clamp-1">
              оновив завдання{' '}
              <span className="text-ink font-semibold underline">{stats.lastAction.issueKey}: {stats.lastAction.title}</span>
            </p>
          </div>
        </div>
      )}
      
      <div className="pt-[14px] border-t border-[#f8f8f8] w-full">
        {/* Shaded stats block with soft custom dividers */}
        <div className="flex items-center justify-between bg-[#fafafa] rounded-[10px] py-[10px]">
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <span className="text-[14px] font-bold text-ink leading-none mb-1">{stats.total}</span>
            <span className="text-[9px] font-bold text-muted uppercase tracking-wider">завдань</span>
          </div>
          <div className="w-[1px] h-[16px] bg-line" />
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <span className="text-[14px] font-bold text-ink leading-none mb-1">{stats.inProgress}</span>
            <span className="text-[9px] font-bold text-muted uppercase tracking-wider">в роботі</span>
          </div>
          <div className="w-[1px] h-[16px] bg-line" />
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <span className="text-[14px] font-bold text-ink leading-none mb-1">{stats.comments}</span>
            <span className="text-[9px] font-bold text-muted uppercase tracking-wider">повідомлень</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── New Internal Project Modal ───────────────────────────────────────────────
function NewProjectModal({ onClose, orgId, orgPlan, activeProjectsCount }) {
  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [visibility,  setVisibility]  = useState('internal');
  const [saving,      setSaving]      = useState(false);

  const isFree      = orgPlan !== 'pro';
  const limitReached = isFree && activeProjectsCount >= 3;

  const [error, setError] = useState(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        visibility,
        organizationId: orgId,
      };

      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Сесія завершилась. Увійдіть знову.');

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Не вдалося створити проєкт');

      onClose();
    } catch (err) {
      console.error('[NewProject]', err);
      setError(err.message);
    }
    setSaving(false);
  };

  return (
    <Dialog isOpen={true} onClose={onClose} title="Новий проєкт" size="sm" footer={
      limitReached ? (
        <div className="flex flex-col gap-2 w-full">
          <Button onClick={() => { onClose(); window.location.href = '/workspace/settings#billing'; }} style="primary" color="blue" size="md" className="w-full">Перейти на PRO →</Button>
          <Button onClick={onClose} style="secondary" size="md" className="w-full">Закрити</Button>
        </div>
      ) : (
        <>
          <Button onClick={onClose} style="secondary" size="md">Скасувати</Button>
          <Button onClick={handleCreate} disabled={!name.trim() || saving} loading={saving} style="primary" size="md">Створити проєкт</Button>
        </>
      )
    }>
      {limitReached ? (
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-[#eef2ff] rounded-[12px] flex items-center justify-center mb-4">
            <Lock size={28} className="text-[#6366f1]" />
          </div>
          <h3 className="text-[17px] font-bold text-ink mb-2">Ліміт Free плану</h3>
          <p className="text-[13px] text-muted leading-relaxed">
            На безкоштовному тарифі дозволено максимум <strong>3 проєкти</strong>.
            Перейдіть на Pro для необмеженої кількості проєктів.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-[16px]">
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-[10px] text-[13px] border border-red-100 flex flex-col gap-2">
              <span className="font-semibold">{error}</span>
              {error.includes('Pro') && (
                <button 
                  onClick={() => { onClose(); window.location.href = '/workspace/settings#billing'; }}
                  className="bg-red-600 text-white font-bold px-3 py-1.5 rounded-[6px] w-fit hover:bg-red-700 transition-colors"
                >
                  Перейти на PRO →
                </button>
              )}
            </div>
          )}
          <div>
            <label className="text-[11px] font-bold text-muted uppercase tracking-wider mb-[6px] block">Назва проєкту *</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="Наприклад: Редизайн сайту"
              className="w-full text-[15px] font-semibold bg-canvas rounded-[10px] px-[14px] py-[10px] outline-none border border-transparent focus:border-ink transition-colors"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted uppercase tracking-wider mb-[6px] block">Опис</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Короткий опис проєкту..."
              rows={3}
              className="w-full text-[14px] bg-canvas rounded-[10px] px-[14px] py-[10px] outline-none border border-transparent focus:border-ink transition-colors resize-none"
            />
          </div>
        </div>
      )}
    </Dialog>
  );
}

export default function WorkspacePage() {
  const { projects, projectsLoading, projectsError, currentUser, activeOrgId, activeOrg, orgRole } = useAppContext();
  const showToast = useWorkspaceStore(s => s.showToast);
  const { members } = useOrganization();
  const { labels, doneStatusIds } = useWorkflowConfig();
  const { sprints } = useSprints();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const [showNewProject, setShowNewProject] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);

  // Real-time issues state
  const [allIssues, setAllIssues] = useState([]);
  const [issuesError, setIssuesError] = useState(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortOption, setSortOption] = useState('updated');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Auto-open modal when navigated with ?new=1
  useEffect(() => {
    if (searchParams?.get('new') === '1') {
      queueMicrotask(() => setShowNewProject(true));
      router.replace('/workspace', { scroll: false });
    }
  }, [searchParams, router]);

  // Real-time listener for all issues in this organization
  useEffect(() => {
    if (!activeOrgId) return;
    const q = query(collection(db, 'issues'), where('organizationId', '==', activeOrgId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllIssues(list);
      setIssuesError(null);
    }, (err) => {
      console.error('[WorkspacePage] issues error:', err);
      setAllIssues([]);
      setIssuesError(err);
    });
    return () => unsubscribe();
  }, [activeOrgId]);

  // Real progress per project: % of issues in a terminal status (the stored
  // `progress` field is never updated). Terminal statuses come from the config.
  const progressByProject = useMemo(() => {
    const doneSet = new Set(doneStatusIds);
    const counts = {};
    for (const issue of allIssues) {
      if (!issue.projectId) continue;
      const entry = counts[issue.projectId] || (counts[issue.projectId] = { total: 0, done: 0 });
      entry.total++;
      if (doneSet.has(issue.columnId || issue.status)) entry.done++;
    }
    const pct = {};
    for (const [pid, { total, done }] of Object.entries(counts)) {
      pct[pid] = total > 0 ? Math.round((done / total) * 100) : 0;
    }
    return pct;
  }, [allIssues, doneStatusIds]);

  const issuesByProject = useMemo(() => {
    const grouped = {};
    for (const issue of allIssues) {
      if (!issue.projectId) continue;
      (grouped[issue.projectId] ||= []).push(issue);
    }
    return grouped;
  }, [allIssues]);

  // Filter & sort visible projects
  const filteredProjects = useMemo(() => {
    let list = (projects || []).filter(p => p.status !== 'archived');

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
    }

    // Member filter
    if (selectedMember !== 'all') {
      list = list.filter(p => Array.isArray(p.team) && p.team.includes(selectedMember));
    }

    // Date Filter (Created range)
    if (dateFilter !== 'all') {
      const limit = dateFilter === '7days' ? 7 * 86400000 : 30 * 86400000;
      list = list.filter(p => {
        const time = p.createdAt?.toMillis?.() || p.createdAt?.seconds * 1000 || (p.createdAt instanceof Date ? p.createdAt.getTime() : 0);
        return (now - time) <= limit;
      });
    }

    // Sorting
    return [...list].sort((a, b) => {
      if (sortOption === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortOption === 'progress-desc') {
        return (progressByProject[b.id] || 0) - (progressByProject[a.id] || 0);
      }
      if (sortOption === 'progress-asc') {
        return (progressByProject[a.id] || 0) - (progressByProject[b.id] || 0);
      }
      // Default: 'updated' (most recently updated/created)
      const aTime = a.updatedAt?.toMillis?.() || a.updatedAt?.seconds * 1000 || (a.updatedAt instanceof Date ? a.updatedAt.getTime() : 0);
      const bTime = b.updatedAt?.toMillis?.() || b.updatedAt?.seconds * 1000 || (b.updatedAt instanceof Date ? b.updatedAt.getTime() : 0);
      return bTime - aTime;
    });
  }, [projects, searchQuery, selectedMember, dateFilter, sortOption, progressByProject, now]);

  // Sliced recent issues list (limit to 6)
  const recentIssues = useMemo(() => {
    const sorted = [...allIssues].sort((a, b) => {
      const aTime = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
      const bTime = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
    return sorted.slice(0, 6);
  }, [allIssues]);

  const archive = async (id) => {
    try {
      await archiveProject(id);
      showToast('Проєкт архівовано', 'success', {
        duration: 5000,
        action: {
          label: 'Скасувати',
          onClick: () => unarchive(id)
        }
      });
    } catch (err) {
      showToast('Помилка архівування', 'error');
    }
  };

  const unarchive = async (id) => {
    try {
      await restoreProject(id);
      showToast('Проєкт розархівовано');
    } catch (err) {
      showToast('Помилка розархівування', 'error');
    }
  };

  const stats = useMemo(() => {
    const active = (projects || []).filter(p => p.status !== 'archived');
    return { total: active.length };
  }, [projects]);

  const memberOptions = useMemo(() => {
    return [
      { value: 'all', label: 'Всі учасники' },
      ...(members || []).map(m => ({
        value: m.id || m.uid,
        label: m.name || m.email?.split('@')[0] || 'Учасник'
      }))
    ];
  }, [members]);

  const dateOptions = [
    { value: 'all', label: 'За весь час' },
    { value: '7days', label: 'Створено за 7 днів' },
    { value: '30days', label: 'Створено за 30 днів' }
  ];

  const sortOptions = [
    { value: 'updated', label: 'Нещодавно оновлені' },
    { value: 'name', label: 'За назвою (А-Я)' },
    { value: 'progress-desc', label: 'Прогрес (за спаданням)' },
    { value: 'progress-asc', label: 'Прогрес (за зростанням)' }
  ];

  const getPriorityColor = (priority) => {
    switch (String(priority).toLowerCase()) {
      case 'critical': return '#ef4444';
      case 'high': return '#f97316';
      case 'medium': return '#eab308';
      case 'low': return '#3b82f6';
      default: return '#9a9a9a';
    }
  };

  const getPriorityDetails = (priority) => {
    switch (String(priority).toLowerCase()) {
      case 'critical': return { bg: '#fee2e2', dot: '#ef4444', label: 'Критичний' };
      case 'high': return { bg: '#ffedd5', dot: '#f97316', label: 'Високий' };
      case 'medium': return { bg: '#fef9c3', dot: '#eab308', label: 'Середній' };
      case 'low': return { bg: '#dbeafe', dot: '#3b82f6', label: 'Низький' };
      default: return { bg: '#f4f4f5', dot: '#9a9a9a', label: 'Низький' };
    }
  };

  const timeAgo = (ts) => {
    if (!ts) return '';
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return 'щойно';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} хв тому`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} год тому`;
    return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
  };

  return (<>
    <div className="flex-1 h-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-transparent">
      <div className="w-full page-gutter pt-[56px] flex flex-col gap-2 min-h-full">
        
        <PageHeader
          variant="main"
          title="Проєкти"
          actions={
            can(orgRole, 'create:project') && (
              <Button
                onClick={() => setShowNewProject(true)}
                style="primary"
                color="dark"
                size="lg"
                icon={Plus}
                collapseAt="sm"
                title="Новий проєкт"
              >
                Новий проєкт
              </Button>
            )
          }
          filters={
            <FilterBar>
              <Select options={memberOptions} value={selectedMember} onChange={setSelectedMember} variant="ghost" />
              <Select options={dateOptions} value={dateFilter} onChange={setDateFilter} variant="ghost" />
              <Select options={sortOptions} value={sortOption} onChange={setSortOption} variant="ghost" />
            </FilterBar>
          }
        />

        {(projectsError || issuesError) && (
          <Alert
            variant="error"
            title="Не вдалося завантажити дані workspace"
            description="Перезавантажте сторінку. Якщо помилка повториться, перевірте доступ до організації або Firestore rules."
          />
        )}

        {/* Projects Panel */}
        <div className="w-full flex-1 flex flex-col">
          {projectsLoading ? (
            // Skeleton cards — shown while projects load to prevent empty state flash
            <Surface variant="panel" padding="lg" className="w-full min-h-[420px] flex-1 flex flex-col">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-[16px]">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="rounded-[16px] border border-line bg-canvas p-[20px] flex flex-col gap-[12px] animate-pulse">
                    <div className="h-[18px] w-2/3 bg-line rounded-[6px]" />
                    <div className="h-[12px] w-full bg-line rounded-[6px]" />
                    <div className="h-[12px] w-4/5 bg-line rounded-[6px]" />
                    <div className="mt-auto flex gap-2">
                      <div className="h-[24px] w-[24px] rounded-full bg-line" />
                      <div className="h-[24px] w-[24px] rounded-full bg-line" />
                    </div>
                  </div>
                ))}
              </div>
            </Surface>
          ) : filteredProjects.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
              <EmptyState
                icon={Folder}
                title="Проєкти не знайдені"
                description="Спробуйте змінити параметри фільтрації"
              />
            </div>
          ) : (
            <Surface variant="panel" padding="lg" className="w-full min-h-[420px] flex-1 flex flex-col">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-[16px]">
                {filteredProjects.map((p, index) => (
                  <ProjectCard 
                    key={p.id} 
                    project={p} 
                    archive={archive} 
                    unarchive={unarchive}
                    members={members}
                    allOrgMembers={members}
                    issues={issuesByProject[p.id] || []}
                    isLarge={index === 0 && selectedMember === 'all' && dateFilter === 'all'}
                  />
                ))}
              </div>
            </Surface>
          )}
        </div>

      </div>
    </div>

    {showNewProject && (
      <NewProjectModal
        onClose={() => setShowNewProject(false)}
        orgId={activeOrgId}
        orgPlan={activeOrg?.plan}
        activeProjectsCount={stats.total}
      />
    )}

    {showCreateTaskModal && (
      <CreateTaskModal
        isOpen={showCreateTaskModal}
        onClose={() => setShowCreateTaskModal(false)}
        onSubmit={async (formData) => {
          if (!formData.projectId) {
            throw new Error('Будь ласка, оберіть проєкт');
          }
          await createIssueViaApi({
            organizationId: activeOrgId,
            projectId: formData.projectId,
            data: {
              title: formData.title,
              description: formData.description || '',
              status: formData.status || 'todo',
              priority: formData.priority || 'medium',
              type: formData.type || 'task',
              assigneeIds: formData.assignees || [],
              labelIds: formData.labelIds || [],
              dueDate: formData.dueDate || null,
              sprintId: formData.sprintId || null,
            },
          });
        }}
        projects={projects}
        stages={[]}
        teamMembers={members}
      />
    )}
  </>);
}
