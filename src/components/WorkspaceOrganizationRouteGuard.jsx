'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';

function LoadingScreen() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#f5f5f5]">
      <div className="w-8 h-8 border-[3px] border-line border-t-[#1f1f1f] rounded-full animate-spin" />
    </div>
  );
}

export default function WorkspaceOrganizationRouteGuard({ children }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { activeOrgId, allOrgs, switchOrg } = useAppContext();
  const requestedOrgId = searchParams.get('org');
  const requestedOrg = requestedOrgId
    ? allOrgs.find(organization => organization.id === requestedOrgId)
    : null;

  useEffect(() => {
    if (requestedOrg && requestedOrg.id !== activeOrgId) {
      switchOrg(requestedOrg.id);
    }
  }, [activeOrgId, requestedOrg, switchOrg]);

  if (!requestedOrgId || requestedOrgId === activeOrgId) return children;
  if (requestedOrg) return <LoadingScreen />;

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#f5f5f5] p-6">
      <div className="w-full max-w-[420px] rounded-[20px] border border-line bg-white p-6 text-center shadow-sm">
        <h1 className="text-[18px] font-bold text-ink mb-2">Немає доступу до організації</h1>
        <p className="text-[13px] text-muted mb-5">
          Сповіщення веде до організації, учасником якої ви більше не є. Задачу не було видалено через цю помилку.
        </p>
        <button
          onClick={() => router.replace('/workspace')}
          className="rounded-[10px] bg-ink px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-ink-hover"
        >
          Повернутися до поточної організації
        </button>
      </div>
    </div>
  );
}
