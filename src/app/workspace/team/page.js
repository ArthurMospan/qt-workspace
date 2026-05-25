'use client';
// src/app/workspace/team/page.js — Team management (YouTrack-style)
import { useState } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { useOrganization } from '@/lib/hooks/useOrganization';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import {
  UserPlus, Crown, Shield, User, Trash2, Mail, Clock,
  MoreVertical, Check, X, ChevronDown,
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

export default function TeamPage() {
  const { currentUser } = useAppContext();
  const { org, members, loading, inviteMember, changeMemberRole, removeMember } = useOrganization();
  const showToast = useWorkspaceStore(s => s.showToast);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole,  setInviteRole]  = useState('member');
  const [inviting,    setInviting]    = useState(false);
  const [openMenu,    setOpenMenu]    = useState(null); // uid of open menu

  const isOwner = org?.ownerId === (currentUser?.id || currentUser?.uid);

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
      setInviteEmail('');
    } catch (err) {
      showToast(err.message || 'Помилка', 'error');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (uid) => {
    if (!confirm('Видалити учасника з команди?')) return;
    try {
      await removeMember(uid);
      showToast('Учасника видалено');
    } catch {
      showToast('Помилка видалення', 'error');
    }
    setOpenMenu(null);
  };

  const handleRoleChange = async (uid, role) => {
    try {
      await changeMemberRole(uid, role);
      showToast('Роль змінено ✓');
    } catch {
      showToast('Помилка', 'error');
    }
    setOpenMenu(null);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f7f7]">
      {/* Header */}
      <div className="pt-[32px] mb-[32px] px-[16px] md:px-[32px]">
        <div>
          <h1 className="text-[26px] md:text-[36px] font-bold text-[#1f1f1f] tracking-tight leading-tight truncate">
            Команда
          </h1>
          <p className="text-[#9a9a9a] mt-[4px] text-[14px]">
            {members.length} учасник{members.length === 1 ? '' : 'ів'} · {org?.name || 'QuickTeam'}
          </p>
        </div>
      </div>

      <div className="px-[16px] md:px-[32px] max-w-[740px]">

        {/* Invite form */}
        {isOwner && (
          <div className="bg-white border border-[#e9e9e9] rounded-[16px] p-5 mb-6">
            <h3 className="text-[14px] font-bold text-[#1f1f1f] mb-4 flex items-center gap-2">
              <UserPlus size={16} /> Запросити в команду
            </h3>
            <form onSubmit={handleInvite} className="flex gap-2">
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="email@example.com"
                className="flex-1 px-4 py-[12px] bg-[#f7f7f7] border border-[#e9e9e9] rounded-[14px] text-[13px] text-[#1f1f1f] placeholder-[#cfcfcf] focus:border-[#1f1f1f] transition-colors"
              />
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}
                className="px-3 py-[12px] bg-[#f7f7f7] border border-[#e9e9e9] rounded-[14px] text-[13px] font-semibold text-[#1f1f1f] cursor-pointer"
              >
                <option value="member">Учасник</option>
                <option value="admin">Адмін</option>
              </select>
              <button
                type="submit"
                disabled={inviting || !inviteEmail.trim()}
                className="px-[20px] py-[12px] bg-[#1f1f1f] text-white rounded-[14px] text-[13px] font-bold hover:bg-[#303030] disabled:opacity-40 transition-all whitespace-nowrap shadow-sm"
              >
                {inviting ? '...' : 'Запросити'}
              </button>
            </form>
            <p className="text-[11px] text-[#9a9a9a] mt-2">
              Якщо користувач вже зареєстрований — одразу додається. Якщо ні — отримає запрошення при вході.
            </p>
          </div>
        )}

        {/* Members list */}
        <div className="bg-white border border-[#e9e9e9] rounded-[16px] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#f0f0f0]">
            <h3 className="text-[14px] font-bold text-[#1f1f1f]">Учасники команди</h3>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
            </div>
          ) : members.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <User size={32} className="text-[#e9e9e9] mx-auto mb-3" />
              <p className="text-[13px] text-[#9a9a9a]">Команда порожня</p>
              {!isOwner && <p className="text-[11px] text-[#cfcfcf] mt-1">Зверніться до власника воркспейсу</p>}
            </div>
          ) : (
            <div className="divide-y divide-[#f7f7f7]">
              {members.map(member => {
                const uid = member.id || member.uid;
                const isMe = uid === (currentUser?.id || currentUser?.uid);
                const canManage = isOwner && !isMe && member.role !== 'owner';

                return (
                  <div key={uid} className="flex items-center gap-4 px-5 py-4 hover:bg-[#fafafa] transition-colors relative">
                    {/* Avatar + online indicator */}
                    <div className="relative shrink-0">
                      <UserAvatar user={member} size={40} />
                      {member.lastActive && (Date.now() - new Date(member.lastActive).getTime() < 120000) && (
                        <span className="absolute bottom-0 right-0 w-[10px] h-[10px] bg-[#10b981] rounded-full ring-2 ring-white" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] font-semibold text-[#1f1f1f] truncate">
                          {member.name || member.email}
                          {isMe && <span className="text-[11px] text-[#9a9a9a] font-normal ml-1">(ти)</span>}
                        </p>
                        <RoleBadge role={member.role} />
                      </div>
                      <div className="flex items-center gap-3 mt-[2px]">
                        <p className="text-[11px] text-[#9a9a9a] flex items-center gap-1">
                          <Mail size={10} />{member.email}
                        </p>
                        <p className="text-[11px] text-[#cfcfcf] flex items-center gap-1">
                          <Clock size={10} />{formatLastActive(member.lastActive)}
                        </p>
                      </div>
                    </div>

                    {/* Actions (owner only, not self, not other owners) */}
                    {canManage && (
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenu(openMenu === uid ? null : uid)}
                          className="p-2 text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f0f0f0] rounded-[8px] transition-all"
                        >
                          <MoreVertical size={14} />
                        </button>

                        {openMenu === uid && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                            <div className="absolute right-0 top-full mt-1 bg-white border border-[#e9e9e9] rounded-[12px] shadow-xl z-20 w-[180px] overflow-hidden">
                              <div className="px-3 py-2 border-b border-[#f0f0f0]">
                                <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide">Змінити роль</p>
                              </div>
                              {Object.entries(ROLES).filter(([r]) => r !== 'owner').map(([roleId, cfg]) => (
                                <button key={roleId} onClick={() => handleRoleChange(uid, roleId)}
                                  className={`flex items-center gap-2 w-full px-3 py-[8px] text-[12px] hover:bg-[#f7f7f7] transition-colors ${
                                    member.role === roleId ? 'font-bold text-[#1f1f1f]' : 'text-[#9a9a9a]'
                                  }`}>
                                  {member.role === roleId && <Check size={11} />}
                                  {member.role !== roleId && <span className="w-[11px]" />}
                                  {cfg.label}
                                </button>
                              ))}
                              <div className="border-t border-[#f0f0f0]">
                                <button onClick={() => handleRemove(uid)}
                                  className="flex items-center gap-2 w-full px-3 py-[8px] text-[12px] text-red-500 hover:bg-red-50 transition-colors">
                                  <Trash2 size={11} /> Видалити з команди
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
