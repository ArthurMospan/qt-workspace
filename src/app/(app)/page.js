'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { reportLoadError, userFacingErrorMessage } from '@/lib/utils/errors';
import { organizationLoadErrorKind } from '@/lib/utils/organizationLoadErrors.mjs';
import { usePublishLocalSearchResults } from '@/lib/hooks/usePublishLocalSearchResults';

import {
  chunkProjectIds,
  flattenDocumentBuckets,
} from '@/lib/utils/projectScopedQueries.mjs';
import { withoutArchivedIssues } from '@/lib/utils/issueArchive.mjs';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ExternalLink, Archive, ArchiveRestore, Plus, Folder, Clock, Users, TrendingUp, Target, ArrowRight, Lock, MoreVertical, Trash2, User, ListTodo, CircleDotDashed, CalendarClock, MessageSquare, Settings2 } from 'lucide-react';
import UserAvatar from '@/components/ui/DataDisplay/UserAvatar';
import { useOrganization } from '@/lib/hooks/useOrganization';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { can } from '@/lib/utils/can';
import { isExternalActorId } from '@/lib/utils/issueParticipants.mjs';
import { issueActivity } from '@/lib/utils/issueReadState.mjs';
import BoardConfigModal from '@/components/workspace/BoardConfigModal';
import {
  EmptyState,
  IconAction,
  PageHeader,
  LoadingSpinner,
  ProjectSettingsForm,
  Pill,
  useConfirm,
} from '@/components/ui';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import { issuePath } from '@/lib/utils/issueKeys.mjs';
import TaskCounters from '@/components/ui/TaskManagement/TaskCounters';
import ContextMenu from '@/components/ui/ContextMenu';
import Alert from '@/components/ui/Feedback/Alert';
import Card from '@/components/ui/Layout/Card';
import { Select } from '@/components/ui/Select';
import FilterBar from '@/components/ui/FilterBar';
import Surface from '@/components/ui/Surface';
import CreateTaskModal from '@/components/CreateTaskModal';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { isDueDateOverdue } from '@/lib/utils/date';
import { organizationTimeZone } from '@/lib/utils/timeZone.mjs';
import { useSprints } from '@/lib/hooks/useSprints';
import { createIssueViaApi } from '@/lib/services/issues';
import { archiveProject, deleteProject, restoreProject } from '@/lib/services/projects';
import { sendProjectInvitations } from '@/lib/services/projectInvitations';
import {
  failedInvitesMessage,
  malformedEmailsMessage,
  parseInviteEmails,
  undeliveredEmailsMessage,
} from '@/lib/utils/inviteEmails';


// ── Project Card ─────────────────────────────────────────────────────────────
const WorkspaceProjectCard = ({ project, archive, unarchive, members = [], allOrgMembers = [], issues = [], isLarge = false, orgLoading, now }) => {
  const router = useRouter();
  const { currentUser, activeOrgId, orgRole } = useAppContext();
  const showToast = useWorkspaceStore(state => state.showToast);
  const confirmDialog = useConfirm();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showBoardConfig, setShowBoardConfig] = useState(false);
  const notifications = useWorkspaceStore(state => state.notifications);
  const isArchived = project.status === 'archived';
  const teamCount = Array.isArray(project.team) ? project.team.length : 0;

  // Preserve the familiar project-card identity: the people are the useful
  // context here, not an abstract visibility label. The featured card scales
  // the whole stack as one unit so placeholders never overpower real faces.
  const stackAvatar = isLarge ? 'md' : 'sm';
  const stackChip = isLarge ? 30 : 24;
  const stackOverlap = isLarge ? '-space-x-[10px]' : '-space-x-[8px]';

  // The two badges on a project card, and what they used to cost.
  //
  // They were fed by two live listeners *per card*: one over the entire message
  // history of `project_<id>` and one over its read cursor. That channel is
  // legacy — `isVisibleChatChannel` has excluded `project_*` rooms for a while
  // and nothing in the product writes to one any more — so opening the
  // dashboard read a dead conversation's whole history, once per project, to
  // draw a number that could only ever be zero.
  //
  // Both facts are already in the workspace's notification stream, which is
  // subscribed once at the layout and shared by the sidebar's project dot. The
  // card reads the same stream: no listener, no document, and a number that is
  // about something that actually happens.
  const projectNotices = useMemo(() => {
    const mine = notifications.filter(item => (
      !item.read
      && item.projectId === project.id
      && item.organizationId === activeOrgId
    ));
    return {
      unread: mine.filter(item => item.type === 'chat_message').length,
      mentions: mine.filter(item => item.type === 'mentioned').length,
    };
  }, [activeOrgId, notifications, project.id]);
  const unreadCount = projectNotices.unread;
  const mentionCount = projectNotices.mentions;

  const handleCardClick = (e) => {
    if (e.target.closest('.no-nav')) return;
    router.push(`/${project.id}`);
  };

  // Built from what this role may actually do, not filtered afterwards — an
  // entry that would only ever be refused is never offered.
  const canEditProject = can(orgRole, 'edit:project_settings');
  const canDeleteProject = can(orgRole, 'delete:project');
  const projectMenuItems = [
    // One entry, one dialog — the same one the project page opens. Splitting
    // settings from members meant two different dialogs edited the same
    // project record.
    ...(canEditProject
      ? [{ icon: Settings2, label: 'Налаштування', onClick: () => setShowBoardConfig(true) }]
      : []),
    // Three entries do not need to be sorted into three groups: the rules used
    // to separate «Налаштування», «Архівувати» and «Видалити» drew more lines
    // than the menu had items.
    ...(canEditProject
      ? [
        !isArchived
          ? { icon: Archive, label: 'Архівувати', onClick: () => archive(project.id) }
          : { icon: ArchiveRestore, label: 'Розархівувати', onClick: () => unarchive(project.id), color: '#10b981' },
      ]
      : []),
    ...(canDeleteProject
      ? [
        {
          icon: Trash2,
          label: 'Видалити',
          isDanger: true,
          onClick: async () => {
            if (await confirmDialog({
              title: 'Видалити проєкт?',
              message: `Ви видаляєте «${project.name}». Цю дію неможливо скасувати.`,
              confirmText: 'Видалити',
              danger: true,
            })) {
              try {
                await deleteProject(project.id);
                showToast('Проєкт видалено');
              } catch (error) {
                showToast(userFacingErrorMessage(error, 'Не вдалося видалити проєкт'), 'error');
              }
            }
          },
        },
      ]
      : []),
  ];

  return (
    <>
      <div
        data-ui-surface="project-card"
        data-ui-density={isLarge ? 'large' : 'default'}
        onClick={handleCardClick}
        // The card holds its own menu button, so it cannot be a `<button>`
        // without nesting one. It takes the role, the tab stop and the two
        // activation keys instead.
        role="button"
        tabIndex={0}
        onKeyDown={event => {
          if (event.target !== event.currentTarget) return;
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          handleCardClick(event);
        }}
        className={`ui-surface group relative flex flex-col justify-between cursor-pointer overflow-visible transition-all duration-300 ${menuOpen ? 'z-30' : 'hover:z-10'} ${
          isLarge 
            ? 'md:col-span-2 md:row-span-2'
            : ''
        }`}
      >
        {/* Top row: the original project-team identity plus the kebab. */}
        <div className={`flex items-center justify-between ${menuOpen ? 'z-20' : 'z-10'}`}>
          <div className={`flex ${stackOverlap}`} aria-label={`Учасників проєкту: ${teamCount}`}>
            {teamCount === 0 && (
              <div title="У проєкті ще немає учасників" data-ui-surface="local" style={{ width: stackChip, height: stackChip }} className="rounded-full bg-white flex items-center justify-center border-2 border-canvas">
                <Users size={isLarge ? 13 : 11} className="text-muted" />
              </div>
            )}
            {(project.team || []).slice(0, 4).map(uid => {
              const member = members.find(candidate => (candidate.id || candidate.uid) === uid);
              return member ? (
                // A face with no name under it is a riddle: the stack is the
                // only place the project's people appear, so hovering one says
                // who it is.
                <UserAvatar key={uid} user={member} size={stackAvatar} stacked tooltip />
              ) : (
                <div key={uid} title="Учасника не знайдено в організації" data-ui-surface="local" style={{ width: stackChip, height: stackChip }} className="rounded-full bg-white flex items-center justify-center border-2 border-canvas">
                  <User size={isLarge ? 13 : 11} className="text-muted" />
                </div>
              );
            })}
            {teamCount > 4 && (
              <Pill tone="neutral" preset="avatar-counter">+{teamCount - 4}</Pill>
            )}
          </div>

          {/* Kebab menu */}
          {/* No «Розархівувати» chip here: this list filters archived projects
              out before it renders a card (see filteredProjects below), so the
              chip could never appear on screen. The one the product actually
              shows lives in Settings → Архів проєктів and is already a kit
              Button. The menu item below is dead for the same reason; it costs
              one line and keeps the menu correct if the filter ever changes. */}
          {/* A member sees no kebab at all. Every entry in it is owner/admin
              work, and a menu that only ever answers "у вас немає прав" is
              worse than no menu: it advertises three things you cannot do on
              a project you are simply a participant of. */}
          {projectMenuItems.length > 0 && (
            <div className="relative no-nav flex items-center gap-[8px]">
              <ContextMenu
                onOpenChange={setMenuOpen}
                // QUI-105. 32px, not 28px. This is the only control on a project
                // card and it sits in a corner with nothing beside it to make a
                // small target forgivable — `sm` is the size for dense toolbars,
                // which this is the opposite of.
                trigger={
                  <IconAction label="Дії з проєктом" icon={MoreVertical} size="md" appearance="quiet" />
                }
                items={projectMenuItems}
              />
            </div>
          )}
        </div>

        {/* Title + description */}
        <div className="flex flex-col gap-[8px] z-10">
          <div className="flex flex-wrap items-center gap-[8px]">
            <h2
              data-ui-density={isLarge ? 'large' : 'default'}
              className="ui-type-project-card-title text-ink leading-tight transition-all duration-300"
            >
              {project.name}
            </h2>
          </div>
          {project.description && (
            <p className={`text-muted font-medium leading-[1.5] line-clamp-2 ${
              isLarge ? 'text-[14px] max-w-[560px]' : 'text-[13px]'
            }`}>
              {project.description}
            </p>
          )}
        </div>

        {/* Real-time stats and Dynamic content */}
        <ProjectStatsSection
          isLarge={isLarge}
          members={members}
          issues={issues}
          now={now}
          currentUser={currentUser}
          orgLoading={orgLoading}
          unreadCount={unreadCount}
          mentionCount={mentionCount}
        />
      </div>

      {/* Modals */}
      {showBoardConfig && (
        <BoardConfigModal
          project={project}
          issues={issues}
          organizationMembers={allOrgMembers}
          canManageTeam={can(orgRole, 'manage:team')}
          canInvite={can(orgRole, 'manage:team')}
          onArchive={archive}
          onUnarchive={unarchive}
          onDelete={deleteProject}
          onClose={() => setShowBoardConfig(false)}
        />
      )}
    </>
  );
};

// Helper Component for Real-time project statistics and details
// What the activity record says happened, said two ways: with a person in front
// of it, and without one when nothing recorded who acted.
const ISSUE_ACTIVITY_VERBS = {
  comment: 'написав у чаті завдання',
  created: 'створив завдання',
  status: 'змінив статус завдання',
  restored: 'відновив завдання',
  updated: 'оновив завдання',
};
const ISSUE_ACTIVITY_EVENTS = {
  comment: 'Нове повідомлення в чаті завдання',
  created: 'Створено завдання',
  status: 'Змінено статус завдання',
  restored: 'Відновлено завдання',
  updated: 'Оновлено завдання',
};

function ProjectStatsSection({ isLarge, members, issues = [], now, currentUser, orgLoading, unreadCount = 0, mentionCount = 0 }) {
  const { closedStatusIds } = useWorkflowConfig();
  const { activeOrg } = useAppContext();
  const timeZone = organizationTimeZone(activeOrg);

  const stats = useMemo(() => {
    let activeCount = 0;
    let overdueCount = 0;
    let newestIssue = null;
    let newestActivity = null;

    for (const issue of issues) {
      const statusId = issue.columnId || issue.status;
      // «в роботі» read as the status «В роботі» and counted only that
      // category, so the card and the board disagreed about the same project:
      // everything in «До виконання» was work the project still owed and the
      // number did not mention it. What is open is what is left to do.
      if (!closedStatusIds.includes(statusId)) {
        activeCount++;
      }
      // «N моїх» said nothing a person could act on — the number they care
      // about is what is late and what is waiting for them, which is the same
      // pair of facts a task card carries.
      if (!closedStatusIds.includes(statusId) && isDueDateOverdue(issue.dueDate, { timeZone })) {
        overdueCount++;
      }

      // Only what the activity record says, never `updatedAt` — see
      // `issueActivity`. A card whose position was renumbered because somebody
      // dropped another card into its column had its document written and
      // nothing else, and it used to take this whole line with it.
      const activity = issueActivity(issue);
      if (activity.millis > (newestActivity?.millis || 0)) {
        newestActivity = activity;
        newestIssue = issue;
      }
    }

    let lastActionStr = null;
    if (newestIssue) {
      // Who *acted* — which is only ever what the activity record says. This
      // used to fall through to `reporterId` and then `reporterName`, so a task
      // with no recorded activity was attributed to whoever originally filed
      // it. On anything imported from YouTrack that reporter is an external
      // person with a synthetic id who has no QuickTeam account at all, and the
      // card announced that they had "оновив завдання" — an action by someone
      // who does not exist, on a task nobody had touched.
      //
      // The reporter is not the actor. With no actor recorded there is nothing
      // truthful to say about who did it, so the line says what happened
      // without naming anyone.
      const actorId = newestIssue.lastActivityActorId || newestIssue.updatedBy || '';
      const isExternalActor = isExternalActorId(actorId);
      let actorUser = null;
      if (actorId && !isExternalActor) {
        actorUser = members.find(m => (m.id || m.uid) === actorId) || null;
        if (!actorUser && (actorId === currentUser?.id || actorId === currentUser?.uid)) actorUser = currentUser;
      }

      // A member list still loading is not a member who cannot be found.
      if (actorId && !actorUser && !isExternalActor && orgLoading) {
        lastActionStr = null;
      } else {
        let actorName = '';
        let actorAvatar = null;
        if (actorUser) {
          actorName = actorUser.name || actorUser.displayName || actorUser.email?.split('@')[0] || '';
          actorAvatar = actorUser.avatar || actorUser.photoURL || actorUser.photoUrl || null;
        } else if (actorId && newestIssue.lastActivityActorName) {
          // Recorded by whoever performed the action, so it names the person
          // who did it even if they have since left the organization.
          actorName = newestIssue.lastActivityActorName;
          actorAvatar = newestIssue.lastActivityActorAvatar || null;
        } else if (newestIssue.source === 'buggybag' || newestIssue.integration === 'buggybag') {
          actorName = 'BuggyBag';
        }

        lastActionStr = {
          issueKey: newestIssue.issueKey || 'Задачу',
          title: newestIssue.title,
          actor: actorName,
          actorAvatar,
          actorUser: actorUser || (actorName ? { id: actorId || undefined, name: actorName, avatar: actorAvatar } : null),
          // Every type that was not a comment used to read "оновив завдання",
          // so a task that had just been created announced itself as updated.
          action: (actorName ? ISSUE_ACTIVITY_VERBS : ISSUE_ACTIVITY_EVENTS)[newestActivity.type]
            || (actorName ? 'оновив завдання' : 'Оновлено завдання'),
          time: newestActivity.at,
          projectId: newestIssue.projectId,
          id: newestIssue.id
        };
      }
    }

    return {
      total: issues.length,
      active: activeCount,
      overdue: overdueCount,
      lastAction: lastActionStr
    };
  }, [closedStatusIds, currentUser, issues, members, orgLoading, timeZone]);

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
        // The whole block is the link, not the task title inside it. Only the
        // title was clickable and nothing said so, so the block behaved like a
        // caption you could accidentally hit. Hovering it now darkens the fill
        // — the same "this is a target" language as a list row.
        <Link
          href={issuePath(stats.lastAction)}
          onClick={(e) => e.stopPropagation()}
          title="Відкрити завдання"
          className="group/activity no-nav bg-[#fafafa]/80 hover:bg-[#f0f0f0] rounded-[12px] p-3 text-[12px] text-[#2a2a2a] flex items-start gap-2.5 transition-colors"
        >
          {/* No avatar and no name line when nothing recorded who acted —
              an empty bold line above the sentence read as a person whose
              name had failed to load. */}
          {stats.lastAction.actorUser && <UserAvatar user={stats.lastAction.actorUser} size="sm" />}

          {/* Activity Text details */}
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <div className="flex items-baseline justify-between gap-2">
              {stats.lastAction.actor
                ? <span className="font-bold text-ink">{stats.lastAction.actor}</span>
                : <span className="font-bold text-muted">Активність</span>}
              {stats.lastAction.time && (
                <span className="text-[10px] text-muted shrink-0 font-medium">{timeAgoString(stats.lastAction.time)}</span>
              )}
            </div>
            <p className="text-muted leading-tight line-clamp-1">
              {stats.lastAction.action}{' '}
              <span className="text-ink font-semibold group-hover/activity:underline">
                {stats.lastAction.issueKey}: {stats.lastAction.title}
              </span>
            </p>
          </div>
        </Link>
      )}
      
      {/* No rule above this row. The card is one object and the counts are the
          last line of it, not a second panel. */}
      <div className="flex w-full flex-wrap items-center gap-x-[18px] gap-y-[8px] text-[11px]">
        <span className="flex items-center gap-[6px] text-muted" title="Усі завдання проєкту, разом із закритими">
          <ListTodo size={14} strokeWidth={1.9} aria-hidden />
          <strong className="text-ink">{stats.total}</strong>
          <span>завдань</span>
        </span>
        <span className="flex items-center gap-[6px] text-muted" title="Незакриті завдання — усе, крім «Готово» і «Скасовано»">
          <CircleDotDashed size={14} strokeWidth={1.9} aria-hidden />
          <strong className="text-ink">{stats.active}</strong>
          <span>активних</span>
        </span>
        {stats.overdue > 0 && (
          // Same ink as the counts beside it. A card that lists three facts
          // does not need one of them shouting — the word already says it.
          <span className="flex items-center gap-[6px] text-muted" title="Завдання, у яких минув дедлайн">
            <CalendarClock size={14} strokeWidth={1.9} aria-hidden />
            <strong className="text-ink">{stats.overdue}</strong>
            <span>прострочено</span>
          </span>
        )}
        {unreadCount > 0 && (
          <span className="flex items-center gap-[6px] text-muted" title="Непрочитані повідомлення в чаті проєкту">
            <MessageSquare size={14} strokeWidth={1.9} aria-hidden />
            <strong className="text-ink">{unreadCount}</strong>
            <span>нових</span>
          </span>
        )}

        {/* Being named is the one fact on this card addressed to you, so it
            sits where the task card puts it: at the far right of the last row,
            in the same mark. */}
        <TaskCounters mentions={mentionCount} className="ml-auto" />
      </div>
    </div>
  );
}

// ── New Internal Project Modal ───────────────────────────────────────────────
function NewProjectModal({ onClose, orgId, orgPlan, activeProjectsCount, members = [], statuses = [], canInvite = false }) {
  const router = useRouter();
  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [visibility,  setVisibility]  = useState('internal');
  const [saving,      setSaving]      = useState(false);
  const [team,        setTeam]        = useState([]);
  const [hiddenColumns, setHiddenColumns] = useState([]);
  const [nameError, setNameError] = useState('');
  const [inviteEmails, setInviteEmails] = useState('');
  const [inviteEmailsError, setInviteEmailsError] = useState('');
  const { inviteMember } = useOrganization();

  const isFree      = orgPlan !== 'pro';
  const limitReached = isFree && activeProjectsCount >= 3;

  const [error, setError] = useState(null);
  const handleCreate = async () => {
    // A disabled primary button gave no reason why, so the form now says what
    // is missing and marks the field instead of silently refusing the click.
    if (!name.trim()) {
      setNameError('Вкажіть назву проєкту');
      return;
    }
    const { emails: invitees, malformed } = parseInviteEmails(inviteEmails);
    if (malformed.length) {
      setInviteEmailsError(malformedEmailsMessage(malformed));
      return;
    }
    setInviteEmailsError('');
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        visibility,
        organizationId: orgId,
        team,
        hiddenColumns,
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

      // Invitations are sent after the project exists so each one can carry its
      // id: accepting then joins the organization and this project in one step.
      // The project is already created, so a failing address is reported rather
      // than thrown — it must not read as "the project was not created".
      if (invitees.length) {
        const { failures, undelivered } = await sendProjectInvitations(inviteMember, {
          emails: invitees,
          projectId: result.id,
        });
        const problem = failedInvitesMessage(failures) || undeliveredEmailsMessage(undelivered);
        if (problem) {
          setInviteEmailsError(`Проєкт створено. ${problem}`);
          setSaving(false);
          return;
        }
      }

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
          <Button onClick={() => { onClose(); router.push('/settings#billing'); }} style="primary" size="md" className="w-full">Перейти на PRO →</Button>
          <Button onClick={onClose} style="secondary" size="md" className="w-full">Закрити</Button>
        </div>
      ) : (
        <>
          <Button onClick={onClose} style="secondary" size="md">Скасувати</Button>
          <Button onClick={handleCreate} disabled={saving} loading={saving} style="primary" size="md">Створити проєкт</Button>
        </>
      )
    }>
      {limitReached ? (
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-[#eef2ff] rounded-[12px] flex items-center justify-center mb-4">
            <Lock size={28} className="text-muted" />
          </div>
          <h3 className="ui-type-feature-title text-ink mb-2">Ліміт Free плану</h3>
          <p className="text-[13px] text-muted leading-relaxed">
            На безкоштовному тарифі дозволено максимум <strong>3 проєкти</strong>.
            Перейдіть на Pro для необмеженої кількості проєктів.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-[16px]">
          {error && (
            <Alert variant="error" title={error}>
              {error.includes('Pro') ? (
                <Button
                  style="primary"
                  color="red"
                  size="sm"
                  className="mt-1"
                  onClick={() => { onClose(); router.push('/settings#billing'); }}
                >
                  Перейти на PRO →
                </Button>
              ) : null}
            </Alert>
          )}
          {/* Same shared form the settings dialog renders — the two used to be
              hand-written separately and drifted apart field by field. */}
          <ProjectSettingsForm
            name={name}
            onNameChange={value => {
              setName(value);
              if (nameError) setNameError('');
            }}
            nameError={nameError}
            description={description}
            onDescriptionChange={setDescription}
            statuses={statuses}
            hiddenStatusIds={hiddenColumns}
            onHiddenStatusIdsChange={setHiddenColumns}
            backlogStatusId={statuses.some(status => status.id === 'backlog') ? 'backlog' : statuses[0]?.id}
            teamMembers={members}
            teamMemberIds={team}
            onTeamMemberIdsChange={setTeam}
            teamPlaceholder="Оберіть учасників проєкту"
            teamHint="Ви як автор проєкту будете додані автоматично."
            inviteEmails={inviteEmails}
            onInviteEmailsChange={canInvite ? value => {
              setInviteEmails(value);
              if (inviteEmailsError) setInviteEmailsError('');
            } : undefined}
            inviteEmailsError={inviteEmailsError}
            inviteEmailsHint="Кожен рядок — окрема адреса. Запрошення підуть після створення проєкту; хто прийме — одразу потрапить і в організацію, і в цей проєкт."
          />
        </div>
      )}
    </Dialog>
  );
}

export default function WorkspacePage() {
  const { projects, projectsLoading, projectsError, currentUser, activeOrgId, activeOrg, orgRole } = useAppContext();
  const showToast = useWorkspaceStore(s => s.showToast);
  const { members, loading: orgLoading } = useOrganization();
  const { labels, deliveredStatusIds, statuses } = useWorkflowConfig();
  const { sprints } = useSprints();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const [showNewProject, setShowNewProject] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);

  // Real-time issues state
  const [allIssues, setAllIssues] = useState([]);
  const [issuesError, setIssuesError] = useState(null);

  // Filter states
  const searchQuery = useWorkspaceStore(s => s.workspaceSearch);
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
      router.replace('/', { scroll: false });
    }
  }, [searchParams, router]);

  // Real-time listener for the issues of every project this user can open.
  // Querying the whole organization is rejected as soon as one project is out
  // of reach, because Firestore applies the read rule to every candidate row.
  const projectScope = useMemo(
    () => [...new Set((projects || []).map(project => project.id).filter(Boolean))]
      .sort()
      .join(','),
    [projects],
  );
  useEffect(() => {
    const projectIds = projectScope ? projectScope.split(',') : [];
    if (!activeOrgId || projectIds.length === 0) {
      queueMicrotask(() => setAllIssues([]));
      return undefined;
    }
    const buckets = new Map();
    const unsubs = chunkProjectIds(projectIds).map((chunk, chunkIndex) => onSnapshot(
      query(
        collection(db, 'issues'),
        where('organizationId', '==', activeOrgId),
        where('projectId', 'in', chunk),
      ),
      { includeMetadataChanges: true },
      (snapshot) => {
        buckets.set(chunkIndex, snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data({ serverTimestamps: 'estimate' }),
        })));
        // This screen has its own subscription rather than going through
        // `useWorkspaceAnalytics`, so the rule has to be applied by hand here
        // too: an archived task is out of the working set, and counting it
        // would hold a project's progress down with work nobody is doing.
        setAllIssues(withoutArchivedIssues(flattenDocumentBuckets(buckets)));
        setIssuesError(null);
      },
      (err) => {
        reportLoadError('[WorkspacePage] issues', err);
        setIssuesError(err);
      },
    ));
    return () => unsubs.forEach(unsubscribe => unsubscribe());
  }, [activeOrgId, projectScope]);

  useEffect(() => {
    const handleIssueActivity = event => {
      const detail = event.detail;
      if (!detail?.issueId) return;
      setAllIssues(previous => previous.map(issue =>
        issue.id === detail.issueId ? { ...issue, ...detail } : issue
      ));
    };
    window.addEventListener('quickteam:issue-activity', handleIssueActivity);
    return () => window.removeEventListener('quickteam:issue-activity', handleIssueActivity);
  }, []);

  // Real progress per project: % of issues actually delivered (the stored
  // `progress` field is never updated). Delivered, not merely closed — a project
  // whose tasks were cancelled has not made that much progress.
  const progressByProject = useMemo(() => {
    const deliveredSet = new Set(deliveredStatusIds);
    const counts = {};
    for (const issue of allIssues) {
      if (!issue.projectId) continue;
      const entry = counts[issue.projectId] || (counts[issue.projectId] = { total: 0, done: 0 });
      entry.total++;
      if (deliveredSet.has(issue.columnId || issue.status)) entry.done++;
    }
    const pct = {};
    for (const [pid, { total, done }] of Object.entries(counts)) {
      pct[pid] = total > 0 ? Math.round((done / total) * 100) : 0;
    }
    return pct;
  }, [allIssues, deliveredStatusIds]);

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
  usePublishLocalSearchResults(searchQuery, filteredProjects.length);

  // Sliced recent issues list (limit to 6)
  const recentIssues = useMemo(() => {
    // "Recent" means recently acted on, not recently written to. Sorted by
    // `updatedAt`, this list filled with the neighbours of whatever card was
    // dragged last.
    const sorted = [...allIssues].sort(
      (a, b) => issueActivity(b).millis - issueActivity(a).millis,
    );
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
      showToast(userFacingErrorMessage(err, 'Не вдалося архівувати проєкт'), 'error');
      return false;
    }
    return true;
  };

  const unarchive = async (id) => {
    try {
      await restoreProject(id);
      showToast('Проєкт розархівовано');
    } catch (err) {
      showToast(userFacingErrorMessage(err, 'Не вдалося розархівувати проєкт'), 'error');
      return false;
    }
    return true;
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
        label: m.name || m.email?.split('@')[0] || 'Учасник',
        user: m,
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

  const workspaceLoadError = projectsError || issuesError;
  const workspaceLoadErrorKind = organizationLoadErrorKind(workspaceLoadError);
  const workspaceAccessFailure = workspaceLoadErrorKind === 'permission-denied'
    || workspaceLoadErrorKind === 'not-found';

  return (<>
    <div className="qt-nav-scroll flex-1 h-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-transparent">
      <div className="workspace-page-layout min-h-full">
        
        <PageHeader
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
            <FilterBar context="projects">
              <Select filterRole="member" options={memberOptions} value={selectedMember} onChange={setSelectedMember} variant="ghost" />
              <Select filterRole="date" options={dateOptions} value={dateFilter} onChange={setDateFilter} variant="ghost" />
              <Select filterRole="sort" options={sortOptions} value={sortOption} onChange={setSortOption} variant="ghost" />
            </FilterBar>
          }
        />

        {workspaceLoadError && (
          <div className="flex flex-col items-start gap-2">
            <Alert
              variant="error"
              title={workspaceAccessFailure
                ? 'Немає доступу до даних організації'
                : projectsError
                  ? 'Не вдалося завантажити проєкти'
                  : 'Не вдалося завантажити завдання'}
              description={workspaceAccessFailure
                ? 'Доступ відкликано або організацію видалено.'
                : 'Перевірте підключення до інтернету та спробуйте ще раз.'}
            />
            {!workspaceAccessFailure && (
              <Button onClick={() => window.location.reload()} style="secondary" size="sm">
                Спробувати ще раз
              </Button>
            )}
          </div>
        )}

        {/* Projects Panel */}
        <div className="w-full flex-1 flex flex-col">
          {projectsLoading ? (
            // A spinner, not a grid of placeholder cards. The cards never lined
            // up with the real ones — different height, different gaps — so the
            // moment the projects arrived the whole grid appeared to jump.
            <Surface preset="panel" padding="lg" composition="chart-panel" className="w-full flex-1 flex flex-col">
              <div role="status" aria-busy="true" className="flex min-h-[280px] flex-1 items-center justify-center">
                <LoadingSpinner size="md" />
                <span className="sr-only">Завантаження…</span>
              </div>
            </Surface>
          ) : filteredProjects.length === 0 ? (
            <Surface preset="panel" padding="md" className="w-full">
              <EmptyState
                icon={Folder}
                title={(projects || []).filter(project => project.status !== 'archived').length === 0 ? 'Ще немає проєктів' : 'Проєкти не знайдені'}
                description={(projects || []).filter(project => project.status !== 'archived').length === 0
                  ? can(orgRole, 'create:project')
                    ? 'Створіть перший проєкт, щоб організувати завдання та роботу команди.'
                    : 'Попросіть адміністратора створити перший проєкт для команди.'
                  : 'Спробуйте змінити параметри фільтрації.'}
                action={(projects || []).filter(project => project.status !== 'archived').length === 0 && can(orgRole, 'create:project') ? 'Створити проєкт' : null}
                onAction={(projects || []).filter(project => project.status !== 'archived').length === 0 && can(orgRole, 'create:project') ? () => setShowNewProject(true) : null}
                context="page"
              />
            </Surface>
          ) : (
            <Surface preset="panel" padding="lg" className="w-full">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-[16px]">
                {filteredProjects.map((p, index) => (
                  <WorkspaceProjectCard
                    key={p.id} 
                    project={p} 
                    archive={archive} 
                    unarchive={unarchive}
                    members={members}
                    allOrgMembers={members}
                    issues={issuesByProject[p.id] || []}
                    isLarge={index === 0 && selectedMember === 'all' && dateFilter === 'all'}
                    orgLoading={orgLoading}
                    now={now}
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
        members={members}
        statuses={statuses}
        canInvite={can(orgRole, 'manage:team')}
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
          const created = await createIssueViaApi({
            organizationId: activeOrgId,
            projectId: formData.projectId,
            data: {
              title: formData.title,
              description: formData.description || '',
              status: formData.status || 'backlog',
              priority: formData.priority || 'medium',
              type: formData.type || 'task',
              assigneeIds: formData.assignees || [],
              labelIds: formData.labelIds || [],
              dueDate: formData.dueDate || null,
              estimateMinutes: formData.estimateMinutes || 0,
              sprintId: formData.sprintId || null,
            },
          });
          return { ...created, projectId: formData.projectId };
        }}
        projects={projects}
        stages={[]}
        teamMembers={members}
      />
    )}
  </>);
}
