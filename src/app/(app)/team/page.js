'use client';

// src/app/workspace/team/page.js
import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { useMobilePaneBack } from '@/lib/hooks/useMobilePaneBack';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { Plus, User } from 'lucide-react';
import { 
  Surface,
  LoadingSpinner,
  EmptyState,
  Button,
  Pill,
  MobilePaneBack,
  SidebarLayout,
  MemberRail,
} from '@/components/ui';
import UserAvatar from '@/components/ui/DataDisplay/UserAvatar';
import ProfileView from '@/components/profile/ProfileView';
import InviteMemberDialog from '@/components/InviteMemberDialog';
import { usePublishLocalSearchResults } from '@/lib/hooks/usePublishLocalSearchResults';
import { useOrganizationPresence } from '@/lib/hooks/useOrganizationPresence';
import { formatLastSeenUk, isPresenceOnline } from '@/lib/utils/presence.mjs';

// ── Invite Modal ─────────────────────────────────────────────────────────────
// ── Main Page ────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const { orgRole, currentUser } = useAppContext();
  const { members, loading, inviteMember } = useOrganization();
  const { positions = [] } = useWorkflowConfig();
  const presenceByUserId = useOrganizationPresence();
  
  const [showInviteModal, setShowInviteModal] = useState(false);
  // QUI-104. Search can now answer with a person, and an answer has to land on
  // that person rather than on whoever happens to be first in the list.
  const searchParams = useSearchParams();
  const requestedMemberId = searchParams.get('member') || '';
  const teamSearch = useWorkspaceStore(s => s.teamSearch) || '';
  const [selectedUid, setSelectedUid] = useState(null);
  // Mobile single-pane mode: 'list' (учасники) або 'detail' (профіль); md+ показує обидві
  const [mobilePane, setMobilePane] = useState('list');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  // Системний «назад» на телефоні повертає до списку команди
  const requestPaneClose = useMobilePaneBack(mobilePane === 'detail', () => setMobilePane('list'));

  const isAdmin = orgRole === 'owner' || orgRole === 'admin';

  const membersWithPresence = useMemo(() => members.map(member => {
    const memberId = member.id || member.uid;
    const currentUserId = currentUser?.id || currentUser?.uid;
    const lastActive = memberId === currentUserId
      ? now
      : (presenceByUserId[memberId] || member.lastActive);
    const online = memberId === currentUserId || isPresenceOnline(lastActive, now);
    return {
      ...member,
      lastActive,
      online,
      presenceLabel: formatLastSeenUk(lastActive, { now, online }),
      positionName: positions.find(position => position.id === member.positionId)?.label
        || member.title
        || 'Посада не вказана',
    };
  }), [currentUser, members, now, positions, presenceByUserId]);

  const filteredMembers = useMemo(() => membersWithPresence.filter(m =>
    (m.name || '').toLowerCase().includes(teamSearch.toLowerCase()) ||
    (m.email || '').toLowerCase().includes(teamSearch.toLowerCase())
  ), [membersWithPresence, teamSearch]);
  usePublishLocalSearchResults(teamSearch, filteredMembers.length);

  useEffect(() => {
    if (loading || !requestedMemberId) return;
    if (!members.some(member => (member.id || member.uid) === requestedMemberId)) return;
    queueMicrotask(() => {
      setSelectedUid(requestedMemberId);
      setMobilePane('detail');
    });
  }, [loading, members, requestedMemberId]);

  // Auto-select first member on initial load
  useEffect(() => {
    if (!loading && members.length > 0 && !selectedUid) {
      queueMicrotask(() => setSelectedUid(filteredMembers[0]?.id || filteredMembers[0]?.uid));
    }
  }, [loading, members, selectedUid, filteredMembers]);

  const selectedMember = membersWithPresence.find(m => (m.id || m.uid) === selectedUid);

  return (
    <SidebarLayout
      context="team"
      mobilePane={mobilePane === 'detail' ? 'content' : 'sidebar'}
      sidebar={
        <MemberRail
          members={filteredMembers}
          activeId={selectedUid}
          onSelect={member => { setSelectedUid(member.id || member.uid); setMobilePane('detail'); }}
          loading={loading}
          action={isAdmin ? (
            <Button
              onClick={() => setShowInviteModal(true)}
              style="ghost"
              size="icon-xs"
              icon={Plus}
              className="hover:!bg-white"
              title="Запросити"
            />
          ) : null}
        />
      }
    >
      {/* RIGHT PANEL — mobile: shown only when a member is selected */}
      <div
        data-ui-surface="panel"
        data-ui-padding="sm"
        className={`ui-surface ${mobilePane === 'list' ? 'hidden' : 'flex'} md:flex flex-1 flex-col h-full overflow-hidden`}
      >
        {/* The arrow rides on the profile itself, opposite the close button
            the modal version of this view draws — it used to be a labelled
            text button on its own line above the card, which spent a row of a
            phone screen saying what an arrow says. */}
        <Surface preset="nested-card" className="relative flex-1 w-full overflow-hidden flex flex-col">
          <MobilePaneBack onClick={requestPaneClose} label="До списку команди" className="absolute left-[16px] top-[16px] z-20" />
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
      <InviteMemberDialog
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        inviteMember={inviteMember}
      />
    </SidebarLayout>
  );
}
