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
  const { currentUser, authLoading } = useAppContext();

  useEffect(() => {
    if (!authLoading && !currentUser) router.replace('/login');
  }, [currentUser, authLoading, router]);

  if (authLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-[3px] border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
      </div>
    );
  }
  if (!currentUser) return null;

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
