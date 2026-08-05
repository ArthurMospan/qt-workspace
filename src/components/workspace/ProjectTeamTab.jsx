'use client';

import { useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import UserAvatar from '@/components/ui/DataDisplay/UserAvatar';
import { Check, Mail, Phone, Search, UserPlus, Users } from 'lucide-react';
import { useProjectTimeLogs } from '@/lib/hooks/useProjectTimeLogs';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { updateProjectTeam } from '@/lib/services/projects';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import EmptyState from '@/components/ui/Feedback/EmptyState';
import InviteMemberDialog from '@/components/InviteMemberDialog';
import Pill from '@/components/ui/DataDisplay/Pill';

export default function ProjectTeamTab({
  members = [],
  allMembers = [],
  issues = [],
  projectId,
  project,
  canManage = false,
  inviteMember,
  roleFilter = 'all',
  workloadFilter = 'all',
  manageOpen = false,
  onManageOpenChange = () => {},
  onOpenManager = () => {},
  selected = [],
  onSelectedChange = () => {},
  memberSearch = '',
  onMemberSearchChange = () => {},
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const showToast = useWorkspaceStore(state => state.showToast);
  const { byUser } = useProjectTimeLogs(projectId);
  const { closedStatusIds, deliveredStatusIds } = useWorkflowConfig();
  // Workload counts what is still open; the badge counts what was delivered.
  const deliveredSet = new Set(deliveredStatusIds);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) return allMembers;
    return allMembers.filter(member => [member.name, member.email]
      .some(value => String(value || '').toLowerCase().includes(query)));
  }, [allMembers, memberSearch]);
  const visibleMembers = useMemo(() => members.filter(member => {
    const uid = member.id || member.uid;
    const completedStatuses = new Set(closedStatusIds);
    const assigned = issues.some(issue =>
      issue.assigneeIds?.includes(uid) && !completedStatuses.has(issue.columnId || issue.status));
    if (roleFilter !== 'all' && member.role !== roleFilter) return false;
    if (workloadFilter === 'assigned' && !assigned) return false;
    if (workloadFilter === 'available' && assigned) return false;
    return true;
  }), [closedStatusIds, issues, members, roleFilter, workloadFilter]);

  const toggleMember = userId => {
    if (userId === project?.createdBy) return;
    onSelectedChange(selected.includes(userId)
      ? selected.filter(id => id !== userId)
      : [...selected, userId]);
  };

  const openManager = () => {
    onOpenManager();
  };

  const saveTeam = async () => {
    setSaving(true);
    try {
      await updateProjectTeam(projectId, selected);
      showToast('Команду проєкту оновлено');
      onManageOpenChange(false);
    } catch (error) {
      showToast(error.message || 'Не вдалося оновити команду', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col pb-8">
      <div data-ui-surface="panel" data-ui-padding="md" className="ui-surface w-full">
        {members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="У проєкті ще немає команди"
            description="Додайте учасників організації, щоб призначати їм завдання та бачити навантаження."
            action={canManage ? 'Додати учасників' : null}
            onAction={canManage ? openManager : null}
          />
        ) : visibleMembers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Немає учасників за цими фільтрами"
            description="Змініть роль або фільтр навантаження."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {visibleMembers.map(member => {
              const uid = member.id || member.uid;
              const memberIssues = issues.filter(issue => issue.assigneeIds?.includes(uid));
              const done = memberIssues.filter(issue => deliveredSet.has(issue.columnId || issue.status)).length;
              const open = memberIssues.length - done;
              const mins = byUser[uid] || 0;
              const h = Math.floor(mins / 60);
              const m = mins % 60;
              const timeStr = h > 0 ? (m > 0 ? `${h}г ${m}хв` : `${h}г`) : (m > 0 ? `${m}хв` : null);

              return (
                <button
                  type="button"
                  key={uid}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set('member', uid);
                    router.push(`${pathname}?${params.toString()}`);
                  }}
                  className="bg-white rounded-[12px] p-5 flex flex-col gap-4 text-left hover:ring-4 hover:ring-[#ECECEC] transition-all"
                >
                  <div className="flex items-start gap-4 w-full">
                    <UserAvatar user={member} size="xl" />
                    <div className="flex-1 min-w-0 flex flex-col pt-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="ui-type-card-title text-ink truncate">{member.name || 'Анонім'}</h3>
                        {member.role && (
                          <Pill tone="neutral" size="sm" uppercase>
                            {member.role === 'admin' ? 'Адмін' : member.role === 'owner' ? 'Власник' : 'Учасник'}
                          </Pill>
                        )}
                      </div>
                      <div className="flex flex-col gap-[4px] mt-2">
                        {member.email && (
                          <div className="flex items-center gap-2 text-faint">
                            <Mail size={12} className="shrink-0" />
                            <span className="text-[11px] truncate font-medium">{member.email}</span>
                          </div>
                        )}
                        {member.phone && (
                          <div className="flex items-center gap-2 text-faint">
                            <Phone size={12} className="shrink-0" />
                            <span className="text-[11px] truncate font-medium">{member.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-4 border-t border-line w-full">
                    <div className="text-center"><span className="block text-[10px] text-muted">Відкриті</span><strong className="text-[14px] text-ink">{open}</strong></div>
                    <div className="text-center"><span className="block text-[10px] text-muted">Завершено</span><strong className="text-[14px] text-ink">{done}</strong></div>
                    <div className="text-center"><span className="block text-[10px] text-muted">Час</span><strong className="text-[14px] text-ink">{timeStr || '—'}</strong></div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Dialog
        isOpen={manageOpen}
        onClose={() => onManageOpenChange(false)}
        title="Команда проєкту"
        size="md"
        footer={<><Button style="secondary" size="md" onClick={() => onManageOpenChange(false)}>Скасувати</Button><Button size="md" onClick={saveTeam} loading={saving}>Зберегти ({selected.length})</Button></>}
      >
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => {
              onManageOpenChange(false);
              setInviteOpen(true);
            }}
            className="flex items-center gap-3 rounded-[14px] bg-canvas p-4 text-left transition-colors hover:bg-[#ededed]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-ink">
              <UserPlus size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold text-ink">Запросити нового учасника</span>
              <span className="mt-0.5 block text-[11px] text-muted">Email, посилання або QR-код</span>
            </span>
          </button>
          <Input value={memberSearch} onChange={event => onMemberSearchChange(event.target.value)} icon={Search} placeholder="Ім’я або email учасника" autoFocus />
          <div className="max-h-[420px] overflow-y-auto flex flex-col gap-1">
            {filteredMembers.map(member => {
              const uid = member.id || member.uid;
              const active = selected.includes(uid);
              const locked = uid === project?.createdBy;
              return (
                <button key={uid} type="button" onClick={() => toggleMember(uid)} disabled={locked}
                  className={`flex items-center gap-3 p-3 rounded-[8px] text-left transition-colors ${active ? 'bg-canvas' : 'hover:bg-canvas'} disabled:cursor-default`}>
                  <UserAvatar user={member} size="md" />
                  <div className="flex-1 min-w-0"><p className="text-[13px] font-semibold text-ink truncate">{member.name || member.email}</p><p className="text-[11px] text-muted truncate">{locked ? 'Власник проєкту' : member.email}</p></div>
                  <span className={`w-5 h-5 rounded-full border flex items-center justify-center ${active ? 'bg-ink border-ink' : 'border-line'}`}>{active && <Check size={12} className="text-white" />}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Dialog>

      <InviteMemberDialog
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        inviteMember={inviteMember}
      />
    </div>
  );
}
