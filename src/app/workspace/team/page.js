'use client';
// src/app/workspace/team/page.js — Team management Dashboard with Analytics
import { useState } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { useOrganization } from '@/lib/hooks/useOrganization';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import {
  UserPlus, Crown, Shield, User, Trash2, Mail, Clock, Check, Plus, Search, X, Activity, MessageSquare, FileText, CheckCircle2, TrendingUp, Filter, Target, Calendar
} from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';

const ROLES = {
  owner:  { label: 'Власник',      color: '#8b5cf6', icon: Crown },
  admin:  { label: 'Адміністратор', color: '#f97316', icon: Shield },
  member: { label: 'Учасник',       color: '#9a9a9a', icon: User },
};

function RoleBadge({ role }) {
  const cfg = ROLES[role] || ROLES.member;
  const Icon = cfg.icon;
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-[3px] rounded-full"
      style={{ color: cfg.color, background: cfg.color + '18' }}>
      <Icon size={9} />{cfg.label}
    </span>
  );
}

function formatLastActive(iso) {
  if (!iso) return 'Ніколи';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'Зараз онлайн';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} хв тому`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} год тому`;
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

// ── Invite Modal ─────────────────────────────────────────────────────────────
function InviteModal({ onClose, inviteMember, currentUser }) {
  const showToast = useWorkspaceStore(s => s.showToast);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole,  setInviteRole]  = useState('member');
  const [inviting,    setInviting]    = useState(false);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const result = await inviteMember(
        inviteEmail.trim().toLowerCase(),
        currentUser?.id || currentUser?.uid,
        inviteRole,
      );
      if (result.type === 'added_directly') {
        showToast('Учасника додано до команди ✓');
      } else {
        showToast('Запрошення відправлено ✓');
      }
      onClose();
    } catch (err) {
      showToast(err.message || 'Помилка', 'error');
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-[440px] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#f0f0f0]">
          <h2 className="text-[16px] font-bold text-[#1f1f1f] flex items-center gap-2">
            <UserPlus size={18} className="text-[#6366f1]" /> Запросити учасника
          </h2>
          <button onClick={onClose} className="text-[#cfcfcf] hover:text-[#1f1f1f] transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleInvite} className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-[11px] font-bold text-[#9a9a9a] uppercase mb-1">Email адреса</label>
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full px-4 py-[12px] bg-[#f7f7f7] border border-[#e9e9e9] rounded-[14px] text-[13px] text-[#1f1f1f] placeholder-[#cfcfcf] focus:border-[#1f1f1f] transition-colors"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#9a9a9a] uppercase mb-1">Роль в команді</label>
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
              className="w-full px-4 py-[12px] bg-[#f7f7f7] border border-[#e9e9e9] rounded-[14px] text-[13px] font-semibold text-[#1f1f1f] cursor-pointer"
            >
              <option value="member">Учасник (Member)</option>
              <option value="admin">Адміністратор (Admin)</option>
            </select>
          </div>
          <p className="text-[11px] text-[#9a9a9a] bg-[#f7f7f7] p-3 rounded-[10px]">
            <span className="font-bold text-[#1f1f1f]">Примітка:</span> Якщо користувач вже зареєстрований — він одразу додається. Якщо ні — отримає запрошення при вході.
          </p>
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={onClose} className="px-[20px] py-[12px] text-[13px] font-bold text-[#9a9a9a] hover:text-[#1f1f1f]">
              Скасувати
            </button>
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="px-[20px] py-[12px] bg-[#1f1f1f] text-white rounded-[14px] text-[13px] font-bold hover:bg-[#303030] disabled:opacity-40 transition-all shadow-sm flex items-center gap-2"
            >
              {inviting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <UserPlus size={16} />}
              Надіслати запрошення
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Detail Panel ─────────────────────────────────────────────────────────────
function MemberDetailPanel({ member, projects, onClose, isMe, isOwner, changeMemberRole, removeMember }) {
  const showToast = useWorkspaceStore(s => s.showToast);
  const uid = member.id || member.uid;
  const canManage = isOwner && !isMe && member.role !== 'owner';

  const memberProjects = projects.filter(p => p.team?.includes(uid));
  const activeProjects = memberProjects.filter(p => p.status !== 'archived').length;
  
  // Mock detailed stats for dashboard
  const mockStats = {
    tasksDone: Math.floor(Math.random() * 50) + 10,
    tasksOpen: Math.floor(Math.random() * 20) + 2,
    messages: Math.floor(Math.random() * 500) + 50,
    filesQt: Math.floor(Math.random() * 30),
    filesWs: Math.floor(Math.random() * 15),
    efficiency: Math.floor(Math.random() * 30) + 70,
  };

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
      onClose();
    } catch {
      showToast('Помилка видалення', 'error');
    }
  };

  return (
    <div className="w-[420px] shrink-0 bg-white border-l border-[#e9e9e9] flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.02)] animate-in slide-in-from-right duration-300">
      <div className="flex items-center justify-between px-6 py-5 border-b border-[#f0f0f0]">
        <h3 className="text-[15px] font-bold text-[#1f1f1f]">Профіль учасника</h3>
        <button onClick={onClose} className="p-2 -mr-2 text-[#9a9a9a] hover:text-[#1f1f1f] rounded-full hover:bg-[#f7f7f7] transition-all">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Header Profile */}
        <div className="p-6 flex flex-col items-center text-center border-b border-[#f0f0f0]">
          <div className="relative mb-3">
            <UserAvatar user={member} size={80} className="text-[24px]" />
            {member.lastActive && (Date.now() - new Date(member.lastActive).getTime() < 120000) && (
              <span className="absolute bottom-1 right-1 w-[16px] h-[16px] bg-[#10b981] rounded-full ring-4 ring-white" />
            )}
          </div>
          <h2 className="text-[20px] font-bold text-[#1f1f1f]">{member.name || member.email}</h2>
          <p className="text-[13px] text-[#9a9a9a] mb-3">{member.email}</p>
          <RoleBadge role={member.role} />
        </div>

        {/* Analytics Grid */}
        <div className="p-6 border-b border-[#f0f0f0]">
          <h4 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-4 flex items-center gap-2">
            <Activity size={12} /> Аналітика продуктивності
          </h4>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-[#f7f7f7] rounded-[12px] p-4 border border-[#e9e9e9]">
              <div className="flex items-center gap-2 text-[#6366f1] mb-1">
                <Target size={14} />
                <span className="text-[11px] font-bold">Проєкти</span>
              </div>
              <p className="text-[24px] font-bold text-[#1f1f1f]">{activeProjects}</p>
            </div>
            <div className="bg-[#f7f7f7] rounded-[12px] p-4 border border-[#e9e9e9]">
              <div className="flex items-center gap-2 text-[#10b981] mb-1">
                <CheckCircle2 size={14} />
                <span className="text-[11px] font-bold">Виконано задач</span>
              </div>
              <p className="text-[24px] font-bold text-[#1f1f1f]">{mockStats.tasksDone}</p>
            </div>
            <div className="bg-[#f7f7f7] rounded-[12px] p-4 border border-[#e9e9e9]">
              <div className="flex items-center gap-2 text-[#f97316] mb-1">
                <MessageSquare size={14} />
                <span className="text-[11px] font-bold">Повідомлень</span>
              </div>
              <p className="text-[24px] font-bold text-[#1f1f1f]">{mockStats.messages}</p>
            </div>
            <div className="bg-[#f7f7f7] rounded-[12px] p-4 border border-[#e9e9e9]">
              <div className="flex items-center gap-2 text-[#0891b2] mb-1">
                <FileText size={14} />
                <span className="text-[11px] font-bold">Файлів (QT/WS)</span>
              </div>
              <p className="text-[24px] font-bold text-[#1f1f1f]">{mockStats.filesQt} / {mockStats.filesWs}</p>
            </div>
          </div>
          
          <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-[12px] p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-[#15803d] uppercase">Ефективність</p>
              <p className="text-[12px] text-[#166534] mt-1">Вище середнього на 14%</p>
            </div>
            <div className="flex items-center gap-1 text-[24px] font-bold text-[#15803d]">
              {mockStats.efficiency}% <TrendingUp size={16} />
            </div>
          </div>
        </div>

        {/* Management */}
        {canManage && (
          <div className="p-6">
            <h4 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Shield size={12} /> Керування доступом
            </h4>
            
            <div className="flex flex-col gap-2 mb-6">
              <label className="text-[12px] font-bold text-[#1f1f1f]">Глобальна роль</label>
              <select
                value={member.role}
                onChange={e => handleRoleChange(e.target.value)}
                className="w-full px-4 py-[12px] bg-[#f7f7f7] border border-[#e9e9e9] rounded-[14px] text-[13px] font-semibold text-[#1f1f1f] cursor-pointer"
              >
                <option value="member">Учасник</option>
                <option value="admin">Адміністратор</option>
              </select>
            </div>

            <button onClick={handleRemove}
              className="w-full flex items-center justify-center gap-2 px-[20px] py-[12px] bg-red-50 text-red-500 rounded-[14px] text-[13px] font-bold hover:bg-red-100 transition-colors border border-red-100">
              <Trash2 size={16} /> Видалити з команди
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const { currentUser, projects } = useAppContext();
  const { org, members, loading, inviteMember, changeMemberRole, removeMember } = useOrganization();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [search, setSearch] = useState('');

  const isOwner = org?.ownerId === (currentUser?.id || currentUser?.uid);
  const selectedMember = members.find(m => (m.id || m.uid) === selectedMemberId);

  const filteredMembers = members.filter(m => 
    (m.name || '').toLowerCase().includes(search.toLowerCase()) || 
    (m.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex overflow-hidden bg-[#f7f7f7]">
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="pt-[32px] mb-[24px] px-[24px] md:px-[40px] shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[26px] md:text-[36px] font-bold text-[#1f1f1f] tracking-tight leading-tight truncate">
                Команда
              </h1>
              <p className="text-[#9a9a9a] mt-[4px] text-[14px]">
                {members.length} учасник{members.length === 1 ? '' : 'ів'} · Аналітика та доступ
              </p>
            </div>
            {isOwner && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-[8px] px-[20px] py-[12px] rounded-[14px] text-[13px] font-bold bg-[#1f1f1f] text-white hover:bg-[#303030] transition-all shadow-sm"
              >
                <Plus size={16} /> Запросити
              </button>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-[24px] md:px-[40px] pb-4 shrink-0 flex items-center gap-3">
          <div className="relative flex-1 max-w-[320px]">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#cfcfcf]" />
            <input
              type="text"
              placeholder="Пошук учасників..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-[10px] bg-white border border-[#e9e9e9] rounded-[12px] text-[13px] text-[#1f1f1f] focus:border-[#1f1f1f] transition-colors shadow-sm"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-[10px] bg-white border border-[#e9e9e9] rounded-[12px] text-[13px] font-semibold text-[#1f1f1f] hover:bg-[#f7f7f7] shadow-sm">
            <Filter size={14} /> Фільтри
          </button>
        </div>

        {/* Dashboard List */}
        <div className="flex-1 overflow-y-auto px-[24px] md:px-[40px] pb-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-[32px] h-[32px] border-[3px] border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
            </div>
          ) : (
            <div className="bg-white border border-[#e9e9e9] rounded-[16px] overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#f0f0f0] bg-[#fafafa]">
                    <th className="px-6 py-4 text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider">Учасник</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider">Роль</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider">Проєкти</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider">Активність</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f0f0]">
                  {filteredMembers.map(member => {
                    const uid = member.id || member.uid;
                    const isMe = uid === (currentUser?.id || currentUser?.uid);
                    const activeProjects = projects.filter(p => p.team?.includes(uid) && p.status !== 'archived').length;
                    const isOnline = member.lastActive && (Date.now() - new Date(member.lastActive).getTime() < 120000);

                    return (
                      <tr 
                        key={uid} 
                        onClick={() => setSelectedMemberId(uid)}
                        className={`cursor-pointer transition-colors ${selectedMemberId === uid ? 'bg-[#f5f7ff]' : 'hover:bg-[#fafafa]'}`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                              <UserAvatar user={member} size={36} />
                              {isOnline && (
                                <span className="absolute bottom-0 right-0 w-[10px] h-[10px] bg-[#10b981] rounded-full ring-2 ring-white" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[14px] font-semibold text-[#1f1f1f] truncate">
                                {member.name || member.email}
                                {isMe && <span className="text-[11px] text-[#9a9a9a] font-normal ml-1">(ти)</span>}
                              </p>
                              <p className="text-[12px] text-[#9a9a9a] truncate">{member.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <RoleBadge role={member.role} />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-[30px] h-[30px] rounded-[8px] bg-[#f7f7f7] border border-[#e9e9e9] flex items-center justify-center text-[12px] font-bold text-[#1f1f1f]">
                              {activeProjects}
                            </div>
                            <span className="text-[11px] text-[#9a9a9a]">активних</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-[12px] text-[#9a9a9a]">
                            <Calendar size={12} />
                            {formatLastActive(member.lastActive)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredMembers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-[#9a9a9a] text-[13px]">
                        Нікого не знайдено
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail Side Panel */}
      {selectedMember && (
        <MemberDetailPanel 
          member={selectedMember} 
          projects={projects}
          onClose={() => setSelectedMemberId(null)}
          isMe={selectedMember.id === (currentUser?.id || currentUser?.uid)}
          isOwner={isOwner}
          changeMemberRole={changeMemberRole}
          removeMember={removeMember}
        />
      )}

      {/* Modals */}
      {showInviteModal && (
        <InviteModal 
          onClose={() => setShowInviteModal(false)} 
          inviteMember={inviteMember} 
          currentUser={currentUser} 
        />
      )}
    </div>
  );
}
