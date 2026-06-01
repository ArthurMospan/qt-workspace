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

// ── Invite Modal ─────────────────────────────────────────────────────────────
function InviteModal({ isOpen, onClose, inviteMember, currentUser }) {
  const showToast = useWorkspaceStore(s => s.showToast);
  const { members } = useOrganization();
  const [search, setSearch] = useState('');
  const [invitedIds, setInvitedIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const filteredMembers = members.filter(m => 
    (m.name || m.email || '').toLowerCase().includes(search.toLowerCase()) &&
    m.id !== (currentUser?.id || currentUser?.uid) // exclude self
  );

  const handleToggle = (id) => {
    setInvitedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    // In a real scenario, this would add the selected users to a project.
    // For now, we mock the success.
    setTimeout(() => {
      showToast(`Успішно додано ${invitedIds.length} учасників ✓`);
      setSubmitting(false);
      setInvitedIds([]);
      onClose();
    }, 1000);
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Запросити учасника" size="md">
      <div className="flex flex-col gap-4 py-2 h-[400px]">
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Пошук по учасниках організації..."
          icon={Search}
        />
        
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1 -mx-2 px-2">
          {filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-[13px] text-[#9a9a9a]">
              Нікого не знайдено
            </div>
          ) : (
            filteredMembers.map(m => {
              const isAdded = invitedIds.includes(m.id || m.uid);
              return (
                <div key={m.id || m.uid} className="flex items-center justify-between p-2 hover:bg-[#f4f4f5] rounded-[8px] transition-colors">
                  <div className="flex items-center gap-3">
                    <UserAvatar user={m} size={32} />
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-[#1f1f1f]">{m.name || m.email}</span>
                      <span className="text-[11px] text-[#9a9a9a]">{m.title || 'Учасник'}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    style={isAdded ? 'secondary' : 'ghost'}
                    color={isAdded ? 'dark' : 'blue'}
                    onClick={() => handleToggle(m.id || m.uid)}
                  >
                    {isAdded ? 'Додано' : 'Запросити'}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-[#f0f0f0]">
        <Button onClick={onClose} style="ghost" color="dark" size="md">Скасувати</Button>
        <Button onClick={handleSubmit} disabled={submitting || invitedIds.length === 0} loading={submitting} style="primary" color="dark" size="md">
          Додати до проєкту
        </Button>
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
                      {member.statusEmoji && <span>{member.statusEmoji}</span>}
                      {member.name || member.email}
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
        <Surface variant="card" className="flex-1 w-full max-w-[800px] mx-auto overflow-hidden !rounded-[12px] flex flex-col">
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
