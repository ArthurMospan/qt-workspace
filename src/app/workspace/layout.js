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
  const { currentUser, authLoading, activeOrgId, activeOrg, orgLoading, orgError, orgRole, noOrg, signOut, allOrgs } = useAppContext();
  const [needsOrgSelection, setNeedsOrgSelection] = useState(false);
  // null on first render, then the matching nav is mounted. This prevents the
  // hidden nav variant from briefly opening its own Firestore subscriptions.
  const isMobile = useIsMobile();

  const pathname = usePathname();
  const isChat = pathname?.startsWith('/workspace/chat');
  const isSettings = pathname?.startsWith('/workspace/settings');
  const hideHeader = isSettings;

  useEffect(() => {
    if (!authLoading && !currentUser) {
      const currentLocation = `${window.location.pathname}${window.location.search}`;
      const returnTo = currentLocation.startsWith('/workspace') ? currentLocation : '/workspace';
      router.replace(`/login?next=${encodeURIComponent(returnTo)}`);
    }
  }, [currentUser, authLoading, pathname, router]);

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
      queueMicrotask(() => setNeedsOrgSelection(justLoggedIn));
    } else {
      queueMicrotask(() => setNeedsOrgSelection(false));
    }
  }, [authLoading, orgLoading, currentUser, noOrg, allOrgs]);

  // 1. Auth loading
  if (authLoading || orgLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#f5f5f5]">
        <div className="w-8 h-8 border-[3px] border-line border-t-[#1f1f1f] rounded-full animate-spin" />
      </div>
    );
  }

  // 2. Not authenticated
  if (!currentUser) return null;

  if (orgError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#f5f5f5] p-6">
        <div className="w-full max-w-[420px] rounded-[20px] border border-line bg-white p-6 text-center shadow-sm">
          <h1 className="text-[18px] font-bold text-ink mb-2">Workspace тимчасово недоступний</h1>
          <p className="text-[13px] text-muted mb-5">Не вдалося прочитати дані організації. Ваші дані не видалені.</p>
          <button onClick={() => window.location.reload()} className="rounded-[10px] bg-ink px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-ink-hover">Спробувати ще раз</button>
        </div>
      </div>
    );
  }

  // 3. Authenticated but not in any org → redirect immediately to onboarding
  if (noOrg) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#f5f5f5]">
        <div className="w-8 h-8 border-[3px] border-line border-t-[#1f1f1f] rounded-full animate-spin" />
      </div>
    );
  }


  // 4. Defensive fallback: the 'client' role is no longer assignable inside the
  //    team workspace (owner/admin/member only), but keep this guard so any legacy
  //    membership that still carries it lands on the client portal instead of here.
  const isClientOnly = orgRole === 'client';
  if (isClientOnly) {
    const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL;
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-canvas p-8 text-center">
        <div className="w-[64px] h-[64px] bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-6">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </div>
        <h1 className="text-[24px] font-bold text-ink mb-2">Доступ заборонено</h1>
        <p className="text-[14px] text-muted max-w-[320px] mb-8">
          Ви намагаєтесь увійти у внутрішній простір команди. Щоб керувати своїми проєктами, перейдіть на клієнтський портал.
        </p>
        {portalUrl ? (
          <a href={portalUrl}
             className="bg-ink text-white px-6 py-3 rounded-[12px] font-bold text-[14px] hover:bg-ink-hover transition-colors">
            Перейти на клієнтський портал
          </a>
        ) : (
          <p className="text-[13px] text-red-600">URL клієнтського порталу не налаштовано. Зверніться до адміністратора.</p>
        )}
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
      {isMobile === false && (
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
      {isMobile === true && (
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

