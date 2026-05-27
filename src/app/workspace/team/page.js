'use client';
// src/app/workspace/team/page.js — Team management Dashboard with Analytics
import { useState, useMemo } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { useOrganization } from '@/lib/hooks/useOrganization';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import {
  UserPlus, Crown, Shield, User, Trash2, Mail, Clock, Check, Plus, Search, X, Activity, MessageSquare, FileText, CheckCircle2, TrendingUp, Filter, Target, Calendar
} from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';
import { Select } from '@/components/ui/Select';

// Stable timestamp for online status (avoids Date.now during render)
const NOW = Date.now();

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
            <Select
              value={inviteRole}
              onChange={val => setInviteRole(val)}
              options={[
                { value: 'member', label: 'Учасник (Member)' },
                { value: 'admin', label: 'Адміністратор (Admin)' }
              ]}
              className="w-full text-[13px] font-semibold"
            />
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



// ── Main Page ────────────────────────────────────────────────────────────────
import { useRouter } from 'next/navigation';

export default function TeamPage() {
  const router = useRouter();
  const { currentUser, projects, orgRole } = useAppContext();
  const { org, members, loading, inviteMember, changeMemberRole, removeMember, setMemberRate } = useOrganization();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [search, setSearch] = useState('');

  const isOwner = orgRole === 'owner';

  const filteredMembers = members.filter(m => 
    (m.name || '').toLowerCase().includes(search.toLowerCase()) || 
    (m.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex overflow-hidden bg-white">
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="pt-0 mb-[20px] px-[32px] shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[24px] font-bold text-[#1f1f1f] tracking-tight">Команда</h1>
              <p className="text-[13px] font-medium text-[#9a9a9a] mt-[4px]">
                {members.length} учасник{members.length === 1 ? '' : 'ів'} · Доступ та ролі
              </p>
            </div>
            {isOwner && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-[8px] px-[16px] py-[10px] rounded-[12px] text-[13px] font-bold bg-[#1f1f1f] text-white hover:bg-[#303030] transition-all"
              >
                <Plus size={15} /> Запросити
              </button>
            )}
          </div>
        </div>

        {/* Search toolbar */}
        <div className="px-[32px] pb-5 shrink-0">
          <div className="relative max-w-[300px]">
            <Search size={14} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-[#9a9a9a]" />
            <input
              type="text"
              placeholder="Пошук учасників..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-[36px] pr-[12px] py-[9px] bg-[#f7f7f7] border-transparent rounded-[10px] text-[13px] text-[#1f1f1f] focus:border-[#1f1f1f] border outline-none transition-colors"
            />
          </div>
        </div>

        {/* Member Cards Grid */}
        <div className="flex-1 overflow-y-auto px-[32px] pb-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-[32px] h-[32px] border-[3px] border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredMembers.map(member => {
                const uid = member.id || member.uid;
                const isMe = uid === (currentUser?.id || currentUser?.uid);
                const activeProjects = projects.filter(p => p.team?.includes(uid) && p.status !== 'archived').length;
                const isOnline = member.lastActive && (NOW - new Date(member.lastActive).getTime() < 120000);
                const cfg = ROLES[member.role] || ROLES.member;

                return (
                  <button
                    key={uid}
                    onClick={() => router.push(`/workspace/team/${uid}`)}
                    className="flex items-start text-left p-4 rounded-[16px] transition-all border bg-white border-[#e9e9e9] hover:border-[#cfcfcf] hover:shadow-sm"
                  >
                    {/* Avatar */}
                    <div className="relative mr-4 shrink-0 mt-[2px]">
                      <UserAvatar user={member} size={48} />
                      {isOnline && (
                        <span className="absolute bottom-0 right-0 w-[12px] h-[12px] bg-[#10b981] rounded-full ring-2 ring-white" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-[2px]">
                        <p className="text-[14px] font-bold text-[#1f1f1f] truncate">
                          {member.name || member.email}
                          {isMe && <span className="text-[11px] text-[#9a9a9a] font-normal ml-1">(ти)</span>}
                        </p>
                        <RoleBadge role={member.role} />
                      </div>
                      
                      <p className="text-[12px] text-[#9a9a9a] truncate w-full mb-3">{member.email}</p>

                      {/* Stats row */}
                      <div className="flex items-center gap-3 mt-auto pt-3 border-t border-[#f0f0f0] w-full">
                        <span className="flex items-center gap-[6px] text-[11px] text-[#1f1f1f] font-semibold">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#9a9a9a]"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                          {activeProjects} <span className="text-[#9a9a9a] font-normal">проєкт{activeProjects === 1 ? '' : 'ів'}</span>
                        </span>
                        <span className="text-[#e9e9e9]">·</span>
                        <span className="flex items-center gap-[6px] text-[11px] text-[#1f1f1f] font-semibold">
                          <Clock size={12} className="text-[#9a9a9a]" />
                          <span className="text-[#9a9a9a] font-normal">{formatLastActive(member.lastActive)}</span>
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {filteredMembers.length === 0 && (
                <div className="col-span-full py-16 text-center text-[#9a9a9a] text-[13px]">
                  Нікого не знайдено
                </div>
              )}
            </div>
          )}
        </div>
      </div>


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
