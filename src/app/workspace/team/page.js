'use client';

// src/app/workspace/team/page.js
import { useState, useEffect } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { Plus, Search, Users, X, User } from 'lucide-react';
import { 
  Button, 
  Dialog, 
  Input, 
  Surface, 
  LoadingSpinner, 
  EmptyState,
  ListItem,
  SearchInput
} from '@/components/ui';
import UserAvatar from '@/components/UserAvatar';
import ProfileView from '@/components/profile/ProfileView';
import { Select } from '@/components/ui/Select';

// ── Invite Modal ─────────────────────────────────────────────────────────────
function InviteModal({ isOpen, onClose, inviteMember }) {
  const { currentUser } = useAppContext();
  const showToast = useWorkspaceStore(s => s.showToast);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    try {
      setInviting(true);
      const uid = currentUser?.id || currentUser?.uid;
      const res = await inviteMember(inviteEmail.trim().toLowerCase(), uid, inviteRole);
      if (res.type === 'added_directly') {
        showToast('Користувача додано до команди ✓', 'success');
      } else {
        showToast('Запрошення успішно надіслано ✓', 'success');
      }
      setInviteEmail('');
      setInviteRole('member');
      onClose();
    } catch (err) {
      showToast(err.message || 'Помилка при запрошенні', 'error');
    } finally {
      setInviting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Запросити нового учасника"
      size="md"
      footer={
        <>
          <Button onClick={onClose} style="secondary" size="md">Скасувати</Button>
          <Button onClick={handleInvite} loading={inviting} disabled={inviting || !inviteEmail.trim()} style="primary" size="md">Надіслати запрошення</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 min-h-[200px]">
        <Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@example.com" label="Email учасника" />
        <Select value={inviteRole} onChange={setInviteRole} options={[
          {value: 'owner', label: 'Власник'},
          {value: 'admin', label: 'Адміністратор'},
          {value: 'member', label: 'Учасник'}
        ]} label="Роль" />
      </div>
    </Dialog>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const { currentUser, orgRole } = useAppContext();
  const { members, loading, inviteMember } = useOrganization();
  const { positions = [] } = useWorkflowConfig();
  
  const [showInviteModal, setShowInviteModal] = useState(false);
  const teamSearch = useWorkspaceStore(s => s.teamSearch) || '';
  const [selectedUid, setSelectedUid] = useState(null);

  const isAdmin = orgRole === 'owner' || orgRole === 'admin';

  const filteredMembers = members.filter(m =>
    (m.name || '').toLowerCase().includes(teamSearch.toLowerCase()) ||
    (m.email || '').toLowerCase().includes(teamSearch.toLowerCase())
  );

  // Auto-select first member on initial load
  useEffect(() => {
    if (!loading && members.length > 0 && !selectedUid) {
      setSelectedUid(filteredMembers[0]?.id || filteredMembers[0]?.uid);
    }
  }, [loading, members, selectedUid, filteredMembers]);

  const selectedMember = members.find(m => (m.id || m.uid) === selectedUid);

  return (
    <div className="flex w-full h-full p-[12px] pt-[56px] gap-[12px] bg-white">
      {/* LEFT PANEL */}
      <div 
        className="w-[280px] shrink-0 flex flex-col h-full bg-[#f4f4f5] rounded-[16px] overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-bold text-[#1f1f1f]">Команда</h2>
            <span className="text-[11px] font-bold text-[#9a9a9a] bg-white px-2 py-0.5 rounded-full border border-[#e9e9e9]">
              {members.length}
            </span>
          </div>
            {isAdmin && (
              <button 
                onClick={() => setShowInviteModal(true)} 
                className="text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-white rounded-[6px] p-[2px] transition-colors"
                title="Запросити"
              >
                <Plus size={16} />
              </button>
            )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-4 flex flex-col gap-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="sm" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-[13px] text-[#9a9a9a]">
              Нікого не знайдено
            </div>
          ) : (
            filteredMembers.map(member => {
              const uid = member.id || member.uid;
              const isSelected = selectedUid === uid;
              const isOnline = member.lastActive && (Date.now() - new Date(member.lastActive).getTime() < 120000);
              const positionName = positions.find(p => p.id === member.positionId)?.label || member.title || 'Посада не вказана';

              return (
                <button
                  key={uid}
                  onClick={() => setSelectedUid(uid)}
                  className={`w-full text-left px-3 py-2 rounded-[8px] transition-colors flex items-center gap-3 ${
                    isSelected ? 'bg-[#ebebeb]' : 'hover:bg-[#ebebeb]/50'
                  }`}
                >
                  <div className="relative shrink-0">
                    <UserAvatar user={member} size={36} />
                    {isOnline && (
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#10b981] rounded-full ring-2 ring-[#f4f4f5]" />
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className={`text-[13px] font-medium truncate transition-colors flex items-center gap-1 ${isSelected ? 'text-[#1f1f1f]' : 'text-[#4a4a4a] group-hover:text-[#1f1f1f]'}`}>
                      {member.name || member.email}
                      {member.statusEmoji && <span>{member.statusEmoji}</span>}
                    </span>
                    <span className="text-[11px] font-normal text-[#9a9a9a] truncate">
                      {positionName}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div 
        className="flex-1 flex flex-col h-full bg-[#f4f4f5] rounded-[16px] p-[12px] overflow-hidden"
      >
        <Surface variant="card" className="flex-1 w-full overflow-hidden !rounded-[12px] flex flex-col bg-white">
          {selectedMember ? (
            <ProfileView user={selectedMember} />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-white h-full">
              <EmptyState
                icon={User}
                title="Оберіть учасника"
                description="Виберіть когось зі списку ліворуч, щоб переглянути його профіль."
              />
            </div>
          )}
        </Surface>
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
