import React, { useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Dialog } from '@/components/ui';
import ProfileView from './ProfileView';
import { useTeamMembers } from '@/lib/hooks/useTeamMembers';

export default function ProfileModal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const memberId = searchParams.get('member');
  const isOpen = !!memberId;

  const uids = useMemo(() => memberId ? [memberId] : [], [memberId]);
  const { members, loading } = useTeamMembers(uids);
  const user = members[0] || null;

  const handleClose = () => {
    // Remove 'member' from searchParams
    const params = new URLSearchParams(searchParams.toString());
    params.delete('member');
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      size="lg"
      className="overflow-hidden"
      bodyClassName="!p-0"
    >
      <div className="w-full h-[80vh] flex flex-col relative">
        {user ? (
          <ProfileView user={user} onClose={handleClose} />
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center bg-white">
             <div className="animate-spin w-8 h-8 border-4 border-ink border-t-transparent rounded-full"></div>
             <button onClick={handleClose} className="absolute top-4 right-4 p-2 text-faint hover:text-ink z-10 bg-white rounded-full">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
             </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 bg-white">
            <p className="text-muted">Користувача не знайдено</p>
             <button onClick={handleClose} className="absolute top-4 right-4 p-2 text-faint hover:text-ink z-10 bg-white rounded-full">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
             </button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
