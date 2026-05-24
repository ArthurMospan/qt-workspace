'use client';
// src/app/workspace/layout.js — Auth guard + sidebar shell
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import WorkspaceSidebar from '@/components/WorkspaceSidebar';

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
      <div className="w-full h-full flex items-center justify-center bg-[#111]">
        <div className="w-[36px] h-[36px] border-[3px] border-white/10 border-t-white/40 rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="w-full h-full flex flex-row overflow-hidden bg-[#111]">
      <WorkspaceSidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
