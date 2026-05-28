'use client';
import { use, useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppContext } from '@/lib/context/AppContext';
import { useOrganization } from '@/lib/hooks/useOrganization';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import {
  Crown, Shield, User, Trash2, Activity, MessageSquare, FileText, CheckCircle2, TrendingUp, Target, ArrowLeft
} from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';
import { Select } from '@/components/ui/Select';

const NOW = Date.now();

const ROLES = {
  owner:  { label: 'Власник',      color: '#8b5cf6', icon: Crown },
  admin:  { label: 'Адміністратор', color: '#f97316', icon: Shield },
  member: { label: 'Учасник',       color: '#3b82f6', icon: User },
  client: { label: 'Клієнт',        color: '#06b6d4', icon: User },
};

function RoleBadge({ role }) {
  const cfg = ROLES[role] || ROLES.member;
  const Icon = cfg.icon;
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-[3px] rounded-[20px]"
      style={{ color: cfg.color, background: cfg.color + '18' }}>
      <Icon size={9} />{cfg.label}
    </span>
  );
}

export default function MemberDetailPage({ params }) {
  const { uid } = use(params);
  const router = useRouter();
  const { currentUser, projects, orgRole } = useAppContext();
  const { members, loading, changeMemberRole, removeMember, setMemberRate } = useOrganization();
  const showToast = useWorkspaceStore(s => s.showToast);

  const member = members.find(m => (m.id || m.uid) === uid);
  const isOwner = orgRole === 'owner';
  const isMe = uid === (currentUser?.id || currentUser?.uid);
  const canManage = isOwner && !isMe && member?.role !== 'owner';

  const memberProjects = projects.filter(p => p.team?.includes(uid));
  const activeProjects = memberProjects.filter(p => p.status !== 'archived').length;
  
  const mockStats = useMemo(() => {
    if (!uid) return { tasksDone: 0, messages: 0, filesQt: 0, filesWs: 0, efficiency: 0 };
    const seed = uid.charCodeAt(0) + uid.charCodeAt(uid.length - 1);
    return {
      tasksDone: (seed % 50) + 10,
      messages: (seed % 500) + 50,
      filesQt: seed % 30,
      filesWs: seed % 15,
      efficiency: (seed % 30) + 70,
    };
  }, [uid]);

  useEffect(() => {
    if (member) {
      useWorkspaceStore.setState({
        breadcrumbs: [
          { label: 'Команда', href: '/workspace/team' },
          { label: 'Профіль учасника', href: null },
        ]
      });
    }
    return () => useWorkspaceStore.setState({ breadcrumbs: [] });
  }, [member?.id, member?.uid]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#f7f7f7]">
        <div className="w-8 h-8 border-[3px] border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#f7f7f7]">
        <h2 className="text-[16px] font-bold text-[#1f1f1f] mb-2">Учасника не знайдено</h2>
        <button onClick={() => router.push('/workspace/team')} className="text-[#6366f1] text-[13px] hover:underline">
          Повернутися до команди
        </button>
      </div>
    );
  }

  const handleRoleChange = async (role) => {
    try {
      await changeMemberRole(uid, role);
      showToast('Роль змінено ✓');
    } catch {
      showToast('Помилка', 'error');
    }
  };

  const handleRemove = async () => {
    if (!confirm('Видалити учасника з команди?')) return;
    try {
      await removeMember(uid);
      showToast('Учасника видалено');
      router.push('/workspace/team');
    } catch {
      showToast('Помилка видалення', 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">


      <div className="flex-1 overflow-y-auto px-[32px] py-8">
        <div className="max-w-[800px] mx-auto grid grid-cols-1 md:grid-cols-[1fr_340px] gap-8">
          
          {/* Main Info Column */}
          <div className="flex flex-col gap-8">
            <div className="flex items-center gap-6 p-6 rounded-[20px] bg-[#f7f7f7] border border-[#e9e9e9]">
              <div className="relative shrink-0">
                <UserAvatar user={member} size={80} className="text-[28px] shadow-sm" />
                {member.lastActive && (NOW - new Date(member.lastActive).getTime() < 120000) && (
                  <span className="absolute bottom-1 right-1 w-[18px] h-[18px] bg-[#10b981] rounded-full ring-4 ring-[#f7f7f7]" />
                )}
              </div>
              <div>
                <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-1">{member.name || member.email}</h2>
                <p className="text-[14px] text-[#9a9a9a] mb-3">{member.email}</p>
                <RoleBadge role={member.role} />
              </div>
            </div>

            {/* Analytics Grid */}
            <div>
              <h4 className="text-[12px] font-bold text-[#1f1f1f] uppercase tracking-wider mb-4 flex items-center gap-2">
                <Activity size={14} className="text-[#6366f1]" /> Аналітика продуктивності
              </h4>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-white rounded-[16px] p-5 border border-[#e9e9e9] shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 text-[#6366f1] mb-2">
                    <Target size={16} />
                    <span className="text-[12px] font-bold">Проєкти</span>
                  </div>
                  <p className="text-[32px] font-black text-[#1f1f1f] tracking-tight">{activeProjects}</p>
                </div>
                <div className="bg-white rounded-[16px] p-5 border border-[#e9e9e9] shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 text-[#10b981] mb-2">
                    <CheckCircle2 size={16} />
                    <span className="text-[12px] font-bold">Виконано задач</span>
                  </div>
                  <p className="text-[32px] font-black text-[#1f1f1f] tracking-tight">{mockStats.tasksDone}</p>
                </div>
                <div className="bg-white rounded-[16px] p-5 border border-[#e9e9e9] shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 text-[#f97316] mb-2">
                    <MessageSquare size={16} />
                    <span className="text-[12px] font-bold">Повідомлень</span>
                  </div>
                  <p className="text-[32px] font-black text-[#1f1f1f] tracking-tight">{mockStats.messages}</p>
                </div>
                <div className="bg-white rounded-[16px] p-5 border border-[#e9e9e9] shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 text-[#0891b2] mb-2">
                    <FileText size={16} />
                    <span className="text-[12px] font-bold">Файлів (QT/WS)</span>
                  </div>
                  <p className="text-[32px] font-black text-[#1f1f1f] tracking-tight">{mockStats.filesQt} / {mockStats.filesWs}</p>
                </div>
              </div>
              
              <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-[16px] p-5 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-[12px] font-bold text-[#15803d] uppercase tracking-wide">Ефективність</p>
                  <p className="text-[13px] text-[#166534] mt-1 font-medium">Вище середнього на 14%</p>
                </div>
                <div className="flex items-center gap-2 text-[32px] font-black text-[#15803d] tracking-tight">
                  {mockStats.efficiency}% <TrendingUp size={24} strokeWidth={3} />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Management */}
          {isOwner && (
            <div className="flex flex-col gap-6">
              <div className="bg-white p-6 rounded-[20px] border border-[#e9e9e9] shadow-sm">
                <h4 className="text-[12px] font-bold text-[#1f1f1f] uppercase tracking-wider mb-5 flex items-center gap-2">
                  <Shield size={14} className="text-[#f97316]" /> Керування доступом
                </h4>
                
                <div className="flex flex-col gap-2 mb-5">
                  <label className="text-[12px] font-bold text-[#9a9a9a]">Погодинна ставка (USD)</label>
                  <input
                    type="number" min="0" step="1"
                    value={member.hourlyRate || 0}
                    onChange={async e => {
                      try {
                        await setMemberRate(uid, e.target.value);
                        showToast('Ставку оновлено');
                      } catch {
                        showToast('Помилка оновлення', 'error');
                      }
                    }}
                    className="w-full px-4 py-[12px] bg-[#f7f7f7] border border-[#e9e9e9] rounded-[14px] text-[14px] font-semibold text-[#1f1f1f] focus:border-[#1f1f1f] outline-none transition-colors"
                  />
                </div>
                
                {canManage && (
                  <>
                    <div className="flex flex-col gap-2 mb-6">
                      <label className="text-[12px] font-bold text-[#9a9a9a]">Глобальна роль</label>
                      <Select
                        value={member.role}
                        onChange={val => handleRoleChange(val)}
                        options={[
                          { value: 'member', label: 'Учасник' },
                          { value: 'admin', label: 'Адміністратор' },
                          { value: 'client', label: 'Клієнт' }
                        ]}
                      />
                    </div>

                    <div className="pt-5 border-t border-[#f0f0f0]">
                      <button onClick={handleRemove}
                        className="w-full flex items-center justify-center gap-2 px-[20px] py-[12px] bg-red-50 text-red-500 rounded-[14px] text-[13px] font-bold hover:bg-red-100 transition-colors border border-red-100">
                        <Trash2 size={16} /> Видалити з команди
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
