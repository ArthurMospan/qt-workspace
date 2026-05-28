'use client';
// src/app/workspace/team/page.js — Team management Dashboard with Analytics
import { useState, useMemo } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { useOrganization } from '@/lib/hooks/useOrganization';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import {
  UserPlus, Crown, Shield, User, Trash2, Mail, Clock, Plus, Search
} from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import Surface from '@/components/ui/Surface';
import { LoadingSpinner } from '@/components/ui/Feedback/LoadingSpinner';

// Stable timestamp for online status (avoids Date.now during render)
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
  // Map roles to badge variants
  const variantMap = {
    owner: 'primary',
    admin: 'warning',
    member: 'default',
    client: 'default',
  };
  const variant = variantMap[role] || 'default';

  return (
    <Badge variant={variant} className="flex items-center gap-1">
      <Icon size={10} />{cfg.label}
    </Badge>
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
function InviteModal({ isOpen, onClose, inviteMember, currentUser }) {
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
      setInviteEmail('');
      setInviteRole('member');
      onClose();
    } catch (err) {
      showToast(err.message || 'Помилка', 'error');
    } finally {
      setInviting(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Запросити учасника" size="md">
      <form onSubmit={handleInvite} className="flex flex-col gap-5">
        <div>
          <label className="block text-[11px] font-bold text-[#9a9a9a] uppercase mb-2">Email адреса</label>
          <Input
            type="email"
            required
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="name@company.com"
            icon={Mail}
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-[#9a9a9a] uppercase mb-2">Роль в команді</label>
          <Select
            value={inviteRole}
            onChange={val => setInviteRole(val)}
            options={[
              { value: 'member', label: 'Учасник (Member)' },
              { value: 'admin', label: 'Адміністратор (Admin)' },
              { value: 'client', label: 'Клієнт (Client)' }
            ]}
            className="w-full text-[13px] font-semibold"
          />
        </div>
        <Surface variant="light" padding="md" className="text-[11px] text-[#9a9a9a]">
          <span className="font-bold text-[#1f1f1f]">Примітка:</span> Якщо користувач вже зареєстрований — він одразу додається. Якщо ні — отримає запрошення при вході.
        </Surface>
        <div className="flex justify-end gap-3 mt-2 pt-3 border-t border-[#f0f0f0]">
          <Button
            type="button"
            onClick={onClose}
            style="secondary"
            color="dark"
            size="md"
          >
            Скасувати
          </Button>
          <Button
            type="submit"
            disabled={inviting || !inviteEmail.trim()}
            loading={inviting}
            style="primary"
            color="dark"
            size="md"
            icon={UserPlus}
          >
            Надіслати запрошення
          </Button>
        </div>
      </form>
    </Dialog>
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
    <div className="flex-1 flex overflow-hidden bg-transparent">

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="pt-[32px] mb-[24px] px-[32px] shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[32px] font-bold text-[#1f1f1f] tracking-tight">Команда</h1>
            </div>
            {isOwner && (
              <Button
                onClick={() => setShowInviteModal(true)}
                style="primary"
                color="dark"
                size="lg"
                icon={Plus}
              >
                Запросити
              </Button>
            )}
          </div>
        </div>

        {/* Search toolbar */}
        <div className="px-[32px] pb-5 shrink-0">
          <div className="w-full max-w-[300px]">
            <Input
              type="text"
              placeholder="Пошук учасників..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              icon={Search}
            />
          </div>
        </div>

        {/* Member Cards Grid */}
        <div className="flex-1 overflow-y-auto px-[32px] pb-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <LoadingSpinner size="md" />
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
                  <Surface
                    key={uid}
                    variant="card"
                    padding="lg"
                    className="cursor-pointer hover:shadow-md transition-shadow flex flex-col"
                    onClick={() => router.push(`/workspace/team/${uid}`)}
                  >
                    {/* Avatar and name header */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="relative shrink-0">
                        <UserAvatar user={member} size={48} />
                        {isOnline && (
                          <span className="absolute bottom-0 right-0 w-[12px] h-[12px] bg-[#10b981] rounded-full ring-2 ring-white" />
                        )}
                      </div>

                      <div className="flex flex-col flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-[#1f1f1f] truncate">
                          {member.name || member.email}
                          {isMe && <span className="text-[11px] text-[#9a9a9a] font-normal ml-1">(ти)</span>}
                        </p>
                        <p className="text-[12px] text-[#9a9a9a] truncate w-full">{member.email}</p>
                      </div>
                    </div>

                    {/* Role badge */}
                    <div className="mb-3">
                      <RoleBadge role={member.role} />
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-2 pt-3 border-t border-[#f0f0f0] w-full text-[11px] text-[#9a9a9a]">
                      <span className="flex items-center gap-[4px]">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                        {activeProjects} проєкт{activeProjects === 1 ? '' : 'ів'}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-[4px]">
                        <Clock size={12} />
                        {formatLastActive(member.lastActive)}
                      </span>
                    </div>
                  </Surface>
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
      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        inviteMember={inviteMember}
        currentUser={currentUser}
      />
    </div>
  );
}
