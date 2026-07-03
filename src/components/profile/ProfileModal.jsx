import React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Dialog } from '@/components/ui';
import ProfileView from './ProfileView';
import { useOrganization } from '@/lib/hooks/useOrganization';

export default function ProfileModal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { members } = useOrganization();
  
  const memberId = searchParams.get('member');
  const user = memberId ? members.find(m => (m.id || m.uid) === memberId) : null;
  const isOpen = !!user;

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
      className="p-0 overflow-hidden" // removes padding to let ProfileView stretch — ProfileView renders its own close button
    >
      <div className="w-full h-[80vh] flex flex-col">
        <ProfileView user={user} onClose={handleClose} />
      </div>
    </Dialog>
  );
}
