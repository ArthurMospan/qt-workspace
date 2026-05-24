'use client';
// src/app/workspace/layout.js — Auth guard + sidebar shell, light theme
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import WorkspaceSidebar from '@/components/WorkspaceSidebar';
import Toast from '@/components/Toast';

export default function WorkspaceLayout({ children }) {
  const router = useRouter();
  const { currentUser, authLoading } = useAppContext();

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.replace('/login');
    }
  }, [currentUser, authLoading, router]);

  if (authLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#f7f7f7]">
        <div className="w-[32px] h-[32px] border-[3px] border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="w-full h-full flex flex-row overflow-hidden bg-[#f7f7f7]">
      <WorkspaceSidebar />
      <main className="flex-1 flex flex-col overflow-hidden bg-[#f7f7f7]">
        {children}
      </main>
      <Toast />
    </div>
  );
}
