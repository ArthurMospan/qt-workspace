'use client';
// src/components/OrgSwitcherScreen.jsx
// Full-screen org picker — Windows account-switcher style.
import { useState, useEffect } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import useWorkspaceStore from '@/store/useWorkspaceStore';

function OrgBigCard({ org, role, unreadCount, onClick }) {
  const firstLetter = (org.name || 'О')[0].toUpperCase();

  return (
    <button
      onClick={(e) => onClick(e, org.id)}
      className="flex flex-col items-center gap-4 transition-all duration-300 group/item w-[160px] group-hover/list:opacity-30 hover:!opacity-100"
    >
      <div className="relative">
        <div id={`org-circle-${org.id}`} className="w-[110px] h-[110px] rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-[#2a2a2a] border-[3px] border-transparent group-hover/item:border-white shadow-xl transition-all duration-300 relative z-10">
          {(org.logo || org.logoUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo || org.logoUrl} alt={org.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[40px] font-medium text-white">{firstLetter}</span>
          )}
        </div>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 z-20 min-w-[25px] h-[25px] px-1.5 rounded-full bg-[#6366f1] border-[3px] border-[#171717] text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </div>
      <div className="flex flex-col items-center min-w-0 w-full text-center mt-2">
        <p className="text-[16px] font-bold text-white w-full truncate transition-transform group-hover/item:scale-105">{org.name || 'Без назви'}</p>
        <span className="text-[13px] font-medium text-white/50 mt-1 capitalize transition-transform group-hover/item:scale-105">{role || 'Користувач'}</span>
      </div>
    </button>
  );
}

export default function OrgSwitcherScreen({ onClose }) {
  const { allOrgs, switchOrg, currentUser } = useAppContext();
  const router = useRouter();
  const [expandingOrg, setExpandingOrg] = useState(null);
  const notifications = useWorkspaceStore(state => state.notifications);
  const unreadByOrg = notifications.reduce((counts, item) => {
    if (!item.read && item.organizationId) {
      counts[item.organizationId] = (counts[item.organizationId] || 0) + 1;
    }
    return counts;
  }, {});

  const handleSelect = (e, org) => {
    const circle = document.getElementById(`org-circle-${org.id}`);
    if (circle) {
      const rect = circle.getBoundingClientRect();
      setExpandingOrg({
        org,
        rect: {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        },
        active: false,
      });

      // Trigger the animation in the next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setExpandingOrg(prev => prev ? { ...prev, active: true } : null);
        });
      });
    }

    setTimeout(() => {
      sessionStorage.setItem('qt_org_selected_this_session', '1');
      sessionStorage.removeItem('just_logged_in');
      switchOrg(org.id);
      onClose?.();
      router.push('/workspace');
    }, 700); // 700ms for smooth transition
  };

  const getRoleInOrg = (org) => {
    const memData = org.members?.find(m => m.uid === (currentUser?.id || currentUser?.uid));
    return memData?.role || 'member';
  };

  const isExpanding = !!expandingOrg;

  return (
    <div className={`fixed inset-0 z-[200] ${onClose ? 'bg-transparent' : 'bg-[#f5f5f5]'}`}>
      <AuthLayout hideCreateOrg={false} onClose={onClose}>
        
        <div className={`flex flex-col items-center w-full max-w-[800px] transition-opacity duration-300 ${isExpanding ? 'opacity-0' : 'opacity-100'} animate-in slide-in-from-bottom-8 duration-500 pb-16`}>
          <h1 className="text-[32px] font-bold text-white mb-2 text-center tracking-tight">Оберіть організацію</h1>
          <p className="text-[14px] font-medium text-white/50 mb-12 text-center">
            Ви увійшли як {currentUser?.email}
          </p>

          <div className="flex flex-wrap justify-center gap-8 items-start group/list">
            {allOrgs.map(org => (
              <OrgBigCard
                key={org.id}
                org={org}
                role={getRoleInOrg(org)}
                unreadCount={unreadByOrg[org.id] || 0}
                onClick={(e) => handleSelect(e, org)}
              />
            ))}
          </div>
        </div>

        {/* Expanding White Border Animation */}
        {expandingOrg && (
          <div 
            className="fixed z-[1000] rounded-full flex items-center justify-center overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{
              left: expandingOrg.active ? '50%' : expandingOrg.rect.x,
              top: expandingOrg.active ? '50%' : expandingOrg.rect.y,
              width: 110,
              height: 110,
              transform: `translate(-50%, -50%) scale(${expandingOrg.active ? 1.2 : 1})`,
              boxShadow: expandingOrg.active ? '0 0 0 150vw #ffffff' : '0 0 0 3px #ffffff',
              backgroundColor: '#2a2a2a',
            }}
          >
            {(expandingOrg.org.logo || expandingOrg.org.logoUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={expandingOrg.org.logo || expandingOrg.org.logoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[40px] font-medium text-white">{(expandingOrg.org.name || 'О')[0].toUpperCase()}</span>
            )}
          </div>
        )}
      </AuthLayout>
    </div>
  );
}
