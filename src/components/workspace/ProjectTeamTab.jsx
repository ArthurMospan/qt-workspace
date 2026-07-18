'use client';

import { useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import UserAvatar from '@/components/UserAvatar';
import { Check, Mail, Phone, Search, UserPlus } from 'lucide-react';
import { useProjectTimeLogs } from '@/lib/hooks/useProjectTimeLogs';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { updateProjectTeam } from '@/lib/services/projects';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';

export default function ProjectTeamTab({ members = [], allMembers = [], issues = [], projectId, project, canManage = false }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const showToast = useWorkspaceStore(state => state.showToast);
  const { byUser } = useProjectTimeLogs(projectId);
  const { doneStatusIds } = useWorkflowConfig();
  const doneSet = new Set(doneStatusIds);
  const [manageOpen, setManageOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return allMembers;
    return allMembers.filter(member => [member.name, member.email]
      .some(value => String(value || '').toLowerCase().includes(query)));
  }, [allMembers, search]);

  const toggleMember = userId => {
    if (userId === project?.createdBy) return;
    setSelected(current => current.includes(userId)
      ? current.filter(id => id !== userId)
      : [...current, userId]);
  };

  const openManager = () => {
    setSelected(Array.isArray(project?.team) ? project.team : []);
    setSearch('');
    setManageOpen(true);
  };

  const saveTeam = async () => {
    setSaving(true);
    try {
      await updateProjectTeam(projectId, selected);
      showToast('Команду проєкту оновлено');
      setManageOpen(false);
    } catch (error) {
      showToast(error.message || 'Не вдалося оновити команду', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-8">
      {/* Сіра панель-підложка, на ній білі картки — як на сторінці проєктів */}
      <div className="w-full mt-[8px] bg-canvas rounded-[16px] p-[16px]">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-[16px] font-bold text-ink">Команда проєкту</h2>
            <p className="text-[12px] text-muted mt-1">{members.length} {members.length === 1 ? 'учасник' : 'учасників'}</p>
          </div>
          {canManage && (
            <Button icon={UserPlus} style="secondary" size="md" onClick={openManager}>
              Керувати
            </Button>
          )}
        </div>

        {members.length === 0 ? (
          <div className="min-h-[240px] flex flex-col items-center justify-center text-center">
            <UserPlus size={28} className="text-faint mb-3" />
            <p className="text-[13px] text-muted font-medium">У цьому проєкті ще немає учасників.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {members.map(member => {
              const uid = member.id || member.uid;
              const memberIssues = issues.filter(issue => issue.assigneeIds?.includes(uid));
              const done = memberIssues.filter(issue => doneSet.has(issue.columnId || issue.status)).length;
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
                    <UserAvatar user={member} size={48} />
                    <div className="flex-1 min-w-0 flex flex-col pt-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-[14px] font-bold text-ink truncate">{member.name || 'Анонім'}</h3>
                        {member.role && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted px-2 py-0.5 bg-[#f5f5f5] rounded-full">
                            {member.role === 'admin' ? 'Адмін' : member.role === 'owner' ? 'Власник' : 'Учасник'}
                          </span>
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
        onClose={() => setManageOpen(false)}
        title="Команда проєкту"
        size="md"
        footer={<><Button style="secondary" size="md" onClick={() => setManageOpen(false)}>Скасувати</Button><Button size="md" onClick={saveTeam} loading={saving}>Зберегти ({selected.length})</Button></>}
      >
        <div className="flex flex-col gap-4">
          <Input value={search} onChange={event => setSearch(event.target.value)} icon={Search} placeholder="Ім’я або email учасника" autoFocus />
          <div className="max-h-[420px] overflow-y-auto flex flex-col gap-1">
            {filteredMembers.map(member => {
              const uid = member.id || member.uid;
              const active = selected.includes(uid);
              const locked = uid === project?.createdBy;
              return (
                <button key={uid} type="button" onClick={() => toggleMember(uid)} disabled={locked}
                  className={`flex items-center gap-3 p-3 rounded-[8px] text-left transition-colors ${active ? 'bg-[#eef2ff]' : 'hover:bg-canvas'} disabled:cursor-default`}>
                  <UserAvatar user={member} size={36} />
                  <div className="flex-1 min-w-0"><p className="text-[13px] font-semibold text-ink truncate">{member.name || member.email}</p><p className="text-[11px] text-muted truncate">{locked ? 'Власник проєкту' : member.email}</p></div>
                  <span className={`w-5 h-5 rounded-full border flex items-center justify-center ${active ? 'bg-[#6366f1] border-[#6366f1]' : 'border-line'}`}>{active && <Check size={12} className="text-white" />}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Dialog>
    </div>
  );
}
