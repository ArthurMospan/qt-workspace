'use client';
// src/app/workspace/layout.js — Sidebar full-height, header only over main content
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import WorkspaceSidebar from '@/components/WorkspaceSidebar';
import WorkspaceHeader  from '@/components/WorkspaceHeader';
import Toast from '@/components/Toast';

export default function WorkspaceLayout({ children }) {
  const router = useRouter();
  const { currentUser, authLoading, activeOrgId, orgLoading, orgRole, noOrg, signOut } = useAppContext();

  useEffect(() => {
    if (!authLoading && !currentUser) router.replace('/login');
  }, [currentUser, authLoading, router]);

  // 1. Auth loading
  if (authLoading || orgLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-[3px] border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
      </div>
    );
  }

  // 2. Not authenticated
  if (!currentUser) return null;

  // 3. Authenticated but not in any org → show onboarding
  if (noOrg) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#f7f7f7] p-8 text-center">
        <div className="text-[48px] mb-4">👋</div>
        <h1 className="text-[24px] font-bold text-[#1f1f1f] mb-2">Вас ще не додали до команди</h1>
        <p className="text-[14px] text-[#9a9a9a] max-w-[360px] mb-8">
          Щоб отримати доступ до воркспейсу, попросіть власника організації надіслати вам запрошення на ваш email:&nbsp;
          <span className="font-semibold text-[#1f1f1f]">{currentUser.email}</span>
        </p>
        <button
          onClick={async () => {
            if (signOut) await signOut();
            // Redirect is handled by the useEffect above when currentUser becomes null
          }}
          className="px-6 py-3 bg-[#1f1f1f] text-white rounded-[12px] font-bold text-[14px] hover:bg-[#303030] transition-colors"
        >
          Вийти
        </button>
      </div>
    );
  }

  // 4. User is in an org but role is client → redirect to portal
  const isClientOnly = orgRole === 'client';
  if (isClientOnly) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#f7f7f7] p-8 text-center">
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

  // 5. All good — render workspace
  return (
    <div className="w-full h-full flex overflow-hidden">
      {/* Sidebar — full height, not affected by header */}
      <WorkspaceSidebar />

      {/* Right column: header + content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <WorkspaceHeader />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>

      <Toast />
    </div>
  );
}

