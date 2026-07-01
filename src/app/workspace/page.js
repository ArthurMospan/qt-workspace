'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { doc, updateDoc, addDoc, deleteDoc, collection, serverTimestamp, getDocs, query, where, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ExternalLink, Archive, ArchiveRestore, Plus, Folder, Clock, Users, CheckCircle2, TrendingUp, Target, ArrowRight, Check, Lock, Globe, X, MoreVertical, Edit2, Trash2, User, CheckSquare, Search, Settings2, UserPlus, AlertCircle, Activity, MessageSquare } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';
import { useOrganization } from '@/lib/hooks/useOrganization';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { can } from '@/lib/utils/can';
import BoardConfigModal from '@/components/workspace/BoardConfigModal';
import { PageHeader, EmptyState } from '@/components/ui';
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
                  isIn ? 'bg-[#eef2ff]' : 'hover:bg-[#f4f4f5]'
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
const ProjectCard = ({ project, archive, unarchive, members = [], allOrgMembers = [], isLarge = false }) => {
  const router = useRouter();
  const { currentUser, activeOrgId } = useAppContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showBoardConfig, setShowBoardConfig] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
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

  const progressVal = Math.round(project.progress || 0);

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
              <div className="w-[30px] h-[30px] rounded-full bg-white flex items-center justify-center border-2 border-[#f4f4f5]">
                <Users size={13} className="text-[#9a9a9a]" />
              </div>
            )}
            {(project.team || []).slice(0, 4).map(uid => {
              const m = members.find(mbr => (mbr.id || mbr.uid) === uid);
              return m ? (
                <UserAvatar key={uid} user={m} size={30} className="border-2 border-white shadow-none" />
              ) : (
                <div key={uid} className="w-[30px] h-[30px] rounded-full bg-white flex items-center justify-center border-2 border-[#f4f4f5]">
                  <User size={13} className="text-[#9a9a9a]" />
                </div>
              );
            })}
            {teamCount > 4 && (
              <div className="w-[30px] h-[30px] rounded-full bg-[#e0e0e0] flex items-center justify-center text-[9px] font-bold text-[#9a9a9a] border-2 border-white">
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
                <button className="p-[7px] text-[#9a9a9a] hover:bg-white hover:text-[#1f1f1f] rounded-[8px] transition-all">
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
                { icon: Trash2, label: 'Видалити', isDanger: true, onClick: () => setShowDelete(true) },
              ]}
            />
          </div>
        </div>

        {/* Title + description */}
        <div className="flex flex-col gap-[8px] z-10">
          <h2 className={`font-bold text-[#1f1f1f] leading-tight transition-all duration-300 flex items-center gap-2 flex-wrap ${
            isLarge ? 'text-[28px]' : 'text-[18px]'
          }`}>
            <span>{project.name}</span>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center bg-[#1f1f1f] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 min-w-[20px] h-[20px]" title="Непрочитані повідомлення">
                {unreadCount}
              </span>
            )}
          </h2>
          {project.description && (
            <p className={`text-[#9a9a9a] font-medium leading-[1.5] line-clamp-2 ${
              isLarge ? 'text-[14px] max-w-[560px]' : 'text-[13px]'
            }`}>
              {project.description}
            </p>
          )}
        </div>

        {/* Real-time stats and Dynamic content */}
        <ProjectStatsSection project={project} isLarge={isLarge} members={members} />
      </div>

      {/* Modals */}
      {showEdit && <EditProjectModal project={project} onClose={() => setShowEdit(false)} />}
      {showAddMember && <AddMemberModal project={project} allMembers={allOrgMembers} onClose={() => setShowAddMember(false)} />}
      {showBoardConfig && <BoardConfigModal project={project} onClose={() => setShowBoardConfig(false)} />}
      {showDelete && <DeleteConfirmModal project={project} onClose={() => setShowDelete(false)} />}
    </>
  );
};

// Helper Component for Real-time project statistics and details
function ProjectStatsSection({ project, isLarge, members }) {
  const [stats, setStats] = useState({ total: 0, inProgress: 0, comments: 0, lastAction: null });

  useEffect(() => {
    if (!project?.id) return;
    const qIssues = query(collection(db, 'issues'), where('projectId', '==', project.id));
    const unsubscribe = onSnapshot(qIssues, async (snapshot) => {
      let totalCount = 0;
      let inProgressCount = 0;
      let commentsCount = 0;
      let newestIssue = null;
      let newestTime = 0;

      const issueDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      totalCount = issueDocs.length;

      // In-progress columns are columns that are not 'done', 'todo', or 'backlog'
      const inProgressColumns = ['in-progress', 'code-review', 'qa', 'client-approval'];
      
      for (const issue of issueDocs) {
        if (inProgressColumns.includes(issue.columnId || issue.status)) {
          inProgressCount++;
        }

        const updatedAtTime = issue.updatedAt?.toMillis?.() || issue.createdAt?.toMillis?.() || 0;
        if (updatedAtTime > newestTime) {
          newestTime = updatedAtTime;
          newestIssue = issue;
        }
      }

      // Query subcollection comment counts in parallel for all issues in this project
      const commentCountPromises = issueDocs.map(async (issue) => {
        try {
          const commentsSnap = await getDocs(collection(db, 'issues', issue.id, 'comments'));
          return commentsSnap.size;
        } catch (e) {
          return 0;
        }
      });

      const commentCounts = await Promise.all(commentCountPromises);
      commentsCount = commentCounts.reduce((sum, c) => sum + c, 0);

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
          actorAvatar: actorAvatar,
          time: newestIssue.updatedAt || newestIssue.createdAt
        };
      }

      setStats({
        total: totalCount,
        inProgress: inProgressCount,
        comments: commentsCount,
        lastAction: lastActionStr
      });
    }, (err) => {
      console.error('[ProjectStatsSection] error fetching stats:', err);
    });

    return () => unsubscribe();
  }, [project.id, members]);

  const timeAgoString = (ts) => {
    if (!ts) return '';
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    const diff = Date.now() - d.getTime();
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
            <img 
              src={stats.lastAction.actorAvatar} 
              alt={stats.lastAction.actor} 
              referrerPolicy="no-referrer"
              className="w-7 h-7 rounded-full object-cover shrink-0" 
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-[#1f1f1f]/5 text-[#1f1f1f] font-bold flex items-center justify-center text-[9px] shrink-0 uppercase">
              {stats.lastAction.actor ? stats.lastAction.actor.slice(0, 2) : 'АМ'}
            </div>
          )}

          {/* Activity Text details */}
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-bold text-[#1f1f1f]">{stats.lastAction.actor}</span>
              {stats.lastAction.time && (
                <span className="text-[10px] text-[#9a9a9a] shrink-0 font-medium">{timeAgoString(stats.lastAction.time)}</span>
              )}
            </div>
            <p className="text-[#9a9a9a] leading-tight line-clamp-1">
              оновив завдання{' '}
              <span className="text-[#1f1f1f] font-semibold underline">{stats.lastAction.issueKey}: {stats.lastAction.title}</span>
            </p>
          </div>
        </div>
      )}
      
      <div className="pt-[14px] border-t border-[#f8f8f8] w-full">
        {/* Shaded stats block with soft custom dividers */}
        <div className="flex items-center justify-between bg-[#fafafa] rounded-[10px] py-[10px]">
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <span className="text-[14px] font-bold text-[#1f1f1f] leading-none mb-1">{stats.total}</span>
            <span className="text-[9px] font-bold text-[#9a9a9a] uppercase tracking-wider">завдань</span>
          </div>
          <div className="w-[1px] h-[16px] bg-[#e9e9e9]" />
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <span className="text-[14px] font-bold text-[#1f1f1f] leading-none mb-1">{stats.inProgress}</span>
            <span className="text-[9px] font-bold text-[#9a9a9a] uppercase tracking-wider">в роботі</span>
          </div>
          <div className="w-[1px] h-[16px] bg-[#e9e9e9]" />
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <span className="text-[14px] font-bold text-[#1f1f1f] leading-none mb-1">{stats.comments}</span>
            <span className="text-[9px] font-bold text-[#9a9a9a] uppercase tracking-wider">повідомлень</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── New Internal Project Modal ───────────────────────────────────────────────
function NewProjectModal({ onClose, orgId, userId, orgPlan, activeProjectsCount }) {
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
        team: [userId],
        status: 'active',
        progress: 0,
        stagesCount: 4,
        issueCounter: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: userId,
      };
      
      const docRef = await addDoc(collection(db, 'projects'), payload);
      
      // Create default stages
      const stageNames = ['Брифінг & Аналіз', 'Дизайн & UI/UX', 'Розробка', 'Тестування & Реліз'];
      const batch = writeBatch(db);
      for (let i = 0; i < stageNames.length; i++) {
        const stageRef = doc(collection(db, 'stages'));
        batch.set(stageRef, {
          label: `${String(i + 1).padStart(2, '0')}. ${stageNames[i]}`,
          status: i === 0 ? 'in-progress' : 'todo',
          projectId: docRef.id,
          order: i,
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();

      onClose();
    } catch (err) {
      console.error('[NewProject]', err);
      setError(err.message);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[24px] w-full max-w-[480px] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-[24px] pt-[24px] pb-[20px] border-b border-[#f0f0f0]">
          <h2 className="text-[18px] font-bold text-[#1f1f1f]">Новий проєкт</h2>
          <Button style="secondary" size="icon" icon={X} onClick={onClose} />
        </div>
        {/* Content: upsell OR form */}
        {limitReached ? (
        <div className="p-[24px] flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-[#eef2ff] rounded-[12px] flex items-center justify-center mb-4">
            <Lock size={28} className="text-[#6366f1]" />
          </div>
          <h3 className="text-[17px] font-bold text-[#1f1f1f] mb-2">Ліміт Free плану</h3>
          <p className="text-[13px] text-[#9a9a9a] leading-relaxed mb-6">
            На безкоштовному тарифі дозволено максимум <strong>3 проєкти</strong>.
            Перейдіть на Pro для необмеженої кількості проєктів.
          </p>
          <div className="flex flex-col gap-2 w-full">
            <Button
              onClick={() => { onClose(); window.location.href = '/workspace/settings#billing'; }}
              style="primary" color="blue" size="md" className="w-full"
            >
              Перейти на PRO →
            </Button>
            <Button onClick={onClose} style="secondary" size="md" className="w-full">
              Закрити
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-[24px] flex flex-col gap-[16px]">
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
            <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[6px] block">Назва проєкту *</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="Наприклад: Редизайн сайту"
              className="w-full text-[15px] font-semibold bg-[#f4f4f5] rounded-[10px] px-[14px] py-[10px] outline-none border border-transparent focus:border-[#1f1f1f] transition-colors"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[6px] block">Опис</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Короткий опис проєкту..."
              rows={3}
              className="w-full text-[14px] bg-[#f4f4f5] rounded-[10px] px-[14px] py-[10px] outline-none border border-transparent focus:border-[#1f1f1f] transition-colors resize-none"
            />
          </div>
        </div>
        )}
        {!limitReached && (
          <div className="flex gap-[8px] px-[24px] pb-[24px]">
            <Button onClick={onClose} style="secondary" size="md" className="flex-1">
              Скасувати
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || saving}
              loading={saving}
              style="primary" size="md" className="flex-1"
            >
              Створити проєкт
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  const { projects, currentUser, activeOrgId, activeOrg, orgRole } = useAppContext();
  const showToast = useWorkspaceStore(s => s.showToast);
  const { members } = useOrganization();
  const { labels } = useWorkflowConfig();
  const { sprints } = useSprints();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const [showNewProject, setShowNewProject] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);

  // Real-time issues state
  const [allIssues, setAllIssues] = useState([]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortOption, setSortOption] = useState('updated');

  // Auto-open modal when navigated with ?new=1
  useEffect(() => {
    if (searchParams?.get('new') === '1') {
      setShowNewProject(true);
      router.replace('/workspace', { scroll: false });
    }
  }, [searchParams]);

  // Real-time listener for all issues in this organization
  useEffect(() => {
    if (!activeOrgId) return;
    const q = query(collection(db, 'issues'), where('organizationId', '==', activeOrgId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllIssues(list);
    }, (err) => console.error('[WorkspacePage] issues error:', err));
    return () => unsubscribe();
  }, [activeOrgId]);

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
      const now = Date.now();
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
        return (b.progress || 0) - (a.progress || 0);
      }
      if (sortOption === 'progress-asc') {
        return (a.progress || 0) - (b.progress || 0);
      }
      // Default: 'updated' (most recently updated/created)
      const aTime = a.updatedAt?.toMillis?.() || a.updatedAt?.seconds * 1000 || (a.updatedAt instanceof Date ? a.updatedAt.getTime() : 0);
      const bTime = b.updatedAt?.toMillis?.() || b.updatedAt?.seconds * 1000 || (b.updatedAt instanceof Date ? b.updatedAt.getTime() : 0);
      return bTime - aTime;
    });
  }, [projects, searchQuery, selectedMember, dateFilter, sortOption]);

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
      await updateDoc(doc(db, 'projects', id), { status: 'archived' });
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
      await updateDoc(doc(db, 'projects', id), { status: 'active' });
      showToast('Проєкт розархівовано');
    } catch (err) {
      showToast('Помилка розархівування', 'error');
    }
  };

  const stats = useMemo(() => {
    const active = (projects || []).filter(p => p.status !== 'archived');
    const total = active.length;
    const completed = active.filter(p => p.progress >= 100).length;
    const avgProgress = total > 0 ? Math.round(active.reduce((acc, p) => acc + (p.progress || 0), 0) / total) : 0;
    return { total, completed, avgProgress };
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
      <div className="w-full px-[24px] md:px-[32px] pt-[56px] flex flex-col gap-2 min-h-full">
        
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
              >
                <span className="hidden sm:inline">Новий проєкт</span>
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

        {/* Projects Panel */}
        <div className="w-full flex-1 flex flex-col">
          {filteredProjects.length === 0 ? (
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
        userId={currentUser?.id || currentUser?.uid}
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
          const { addDoc, collection, serverTimestamp, doc, runTransaction } = await import('firebase/firestore');
          const { db } = await import('@/lib/firebase');
          
          const tempKey = `WS-${Date.now()}`;
          const newIssueRef = await addDoc(collection(db, 'issues'), {
            issueKey: tempKey,
            organizationId: activeOrgId,
            projectId: formData.projectId,
            title: formData.title,
            description: formData.description || '',
            columnId: formData.status || 'todo',
            status: formData.status || 'todo',
            priority: formData.priority || 'medium',
            type: formData.type || 'task',
            assigneeIds: formData.assignees || [],
            labelIds: formData.labelIds || [],
            dueDate: formData.dueDate || null,
            sprintId: formData.sprintId || null,
            createdAt: serverTimestamp(),
            createdBy: currentUser?.id || currentUser?.uid
          });

          // Run transaction to increment project sequential counter and update sequential task key
          const projectRef = doc(db, 'projects', formData.projectId);
          runTransaction(db, async tx => {
            const projectSnap = await tx.get(projectRef);
            if (!projectSnap.exists()) return;
            const projectData = projectSnap.data();
            const current = projectData.issueCounter ?? 0;
            const next = current + 1;
            
            const pName = projectData.name || 'WS';
            const cleanProj = pName.replace(/[^a-zA-Z]/g, '');
            let prefix = cleanProj.slice(0, 3).toUpperCase();
            if (prefix.length < 2) {
              prefix = pName.slice(0, 2).toUpperCase();
            }
            if (!prefix) prefix = 'WS';

            tx.update(projectRef, {
              issueCounter: next,
              updatedAt: serverTimestamp()
            });
            tx.update(doc(db, 'issues', newIssueRef.id), {
              issueKey: `${prefix}-${next}`
            });
          }).catch(err => console.warn('[workspaceProjects] issueCounter update failed:', err));
        }}
        projects={projects}
        stages={[]}
        teamMembers={members}
      />
    )}
  </>);
}
