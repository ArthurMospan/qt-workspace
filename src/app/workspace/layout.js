'use client';
// src/app/workspace/layout.js — Sidebar full-height, header only over main content
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import WorkspaceSidebar from '@/components/WorkspaceSidebar';
import WorkspaceHeader  from '@/components/WorkspaceHeader';
import MobileNav from '@/components/MobileNav';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import Toast from '@/components/Toast';
import { ConfirmProvider } from '@/components/ui/ConfirmProvider';
import OrgSwitcherScreen from '@/components/OrgSwitcherScreen';
import ProfileModal from '@/components/profile/ProfileModal';
import { useState } from 'react';

export default function WorkspaceLayout({ children }) {
  const router = useRouter();
  const { currentUser, authLoading, activeOrgId, activeOrg, orgLoading, orgRole, noOrg, signOut, allOrgs } = useAppContext();
  const [needsOrgSelection, setNeedsOrgSelection] = useState(false);
  // null on first render (both nav variants mounted, CSS decides), then the
  // irrelevant one is unmounted so its listeners/re-renders don't run twice.
  const isMobile = useIsMobile();

  const pathname = usePathname();
  const isChat = pathname?.startsWith('/workspace/chat');
  const isSettings = pathname?.startsWith('/workspace/settings');
  const hideHeader = isSettings;

  useEffect(() => {
    if (!authLoading && !currentUser) router.replace('/login');
  }, [currentUser, authLoading, router]);

  // Onboarding redirect: if owner/admin and org not yet onboarded
  useEffect(() => {
    if (authLoading || orgLoading) return;
    if (!currentUser) return;
    if (!activeOrg) return;
    const isOwnerOrAdmin = orgRole === 'owner' || orgRole === 'admin';
    if (isOwnerOrAdmin && activeOrg.onboarded !== true) {
      router.replace('/onboarding');
    }
  }, [authLoading, orgLoading, currentUser, activeOrg, orgRole, router]);

  // 3. Authenticated but not in any org → redirect immediately to onboarding
  useEffect(() => {
    if (noOrg && !orgLoading && !authLoading) {
      router.replace('/onboarding');
    }
  }, [noOrg, orgLoading, authLoading, router]);

  // 4. Intercept for full-screen Org Selector
  useEffect(() => {
    if (authLoading || orgLoading || !currentUser || noOrg) return;
    
    if (allOrgs?.length > 1) {
      const justLoggedIn = sessionStorage.getItem('just_logged_in') === 'true';
      if (justLoggedIn) {
        setNeedsOrgSelection(true);
      } else {
        setNeedsOrgSelection(false);
      }
    } else {
      setNeedsOrgSelection(false);
    }
  }, [authLoading, orgLoading, currentUser, noOrg, allOrgs]);

  // 1. Auth loading
  if (authLoading || orgLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#f5f5f5]">
        <div className="w-8 h-8 border-[3px] border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
      </div>
    );
  }

  // 2. Not authenticated
  if (!currentUser) return null;

  // 3. Authenticated but not in any org → redirect immediately to onboarding
  if (noOrg) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#f5f5f5]">
        <div className="w-8 h-8 border-[3px] border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
      </div>
    );
  }


  // 4. User is in an org but role is client → redirect to portal
  const isClientOnly = orgRole === 'client';
  if (isClientOnly) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#f4f4f5] p-8 text-center">
        <div className="w-[64px] h-[64px] bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-6">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </div>
        <h1 className="text-[24px] font-bold text-[#1f1f1f] mb-2">Доступ заборонено</h1>
        <p className="text-[14px] text-[#9a9a9a] max-w-[320px] mb-8">
          Ви намагаєтесь увійти у внутрішній простір команди. Щоб керувати своїми проєктами, перейдіть на клієнтський портал.
        </p>
        <a href={process.env.NEXT_PUBLIC_PORTAL_URL || 'https://qt-green.vercel.app'}
           className="bg-[#1f1f1f] text-white px-6 py-3 rounded-[12px] font-bold text-[14px] hover:bg-[#303030] transition-colors">
          Перейти на клієнтський портал
        </a>
      </div>
    );
  }

  // 5. Needs org selection (Full screen Windows style login)
  if (needsOrgSelection) {
    return <OrgSwitcherScreen />; // No onClose provided, meaning they MUST select an org or create one
  }

  return (
    <ConfirmProvider>
    <div className="w-full h-full flex overflow-hidden bg-[#f5f5f5]">
      {/* Sidebar — full height, floating panel (desktop only; mobile uses MobileNav) */}
      {isMobile !== true && (
        <div className="print:hidden shrink-0 h-full hidden md:flex p-[12px] pr-[6px]">
          <div className="h-full rounded-[24px] overflow-hidden flex">
            <WorkspaceSidebar />
          </div>
        </div>
      )}

      {/* Right column: absolute header + content floating panel */}
      <div className="flex flex-col flex-1 overflow-hidden w-full p-0 pb-[calc(56px+env(safe-area-inset-bottom))] md:p-[12px] md:pl-[6px] md:pb-[12px]">
        <div className="flex flex-col flex-1 bg-white rounded-none md:rounded-[24px] overflow-hidden relative">
          {!hideHeader && (
            <div className="print:hidden absolute top-0 left-0 right-0 z-30">
              <WorkspaceHeader />
            </div>
          )}
          <main className="flex-1 flex flex-col overflow-hidden print:overflow-visible bg-transparent">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      {isMobile !== false && (
        <div className="print:hidden md:hidden">
          <MobileNav />
        </div>
      )}

      <Toast />
      <ProfileModal />
    </div>
    </ConfirmProvider>
  );
}

