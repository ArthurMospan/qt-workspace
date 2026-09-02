'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import Button from '@/components/ui/Button';
import { withNotificationOrganization } from '@/lib/utils/notificationNavigation.mjs';

function LoadingScreen() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-canvas">
      <div className="w-8 h-8 border-[3px] border-line border-t-ink rounded-full animate-spin" />
    </div>
  );
}

export default function WorkspaceOrganizationRouteGuard({ children }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { activeOrgId, allOrgs, switchOrg, orgLoading, orgDirectoryVerified } = useAppContext();
  const requestedOrgId = searchParams.get('org');
  const requestedOrg = requestedOrgId
    ? allOrgs.find(organization => organization.id === requestedOrgId)
    : null;

  useEffect(() => {
    if (requestedOrg && requestedOrg.id !== activeOrgId) {
      switchOrg(requestedOrg.id);
    }
  }, [activeOrgId, requestedOrg, switchOrg]);

  useEffect(() => {
    if (!requestedOrgId && activeOrgId) {
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const scoped = withNotificationOrganization(current, activeOrgId);
      if (scoped && scoped !== current) window.history.replaceState(null, '', scoped);
    }
  }, [activeOrgId, requestedOrgId]);

  if (!requestedOrgId || requestedOrgId === activeOrgId) return children;
  if (requestedOrg) return <LoadingScreen />;
  // An empty membership list is not proof of an organization you cannot reach.
  // Following a notification link on a cold load renders this guard before the
  // organizations arrive, and announcing «Немає доступу до організації» there
  // accuses the reader of something that is about to be false.
  if (orgLoading || !orgDirectoryVerified) return <LoadingScreen />;

  return (
    <div className="w-full h-full flex items-center justify-center bg-canvas p-6">
      <div data-ui-surface="local" className="w-full max-w-[420px] rounded-[20px] border border-line bg-white p-6 text-center shadow-sm">
        <h1 className="ui-type-section-title text-ink mb-2">Немає доступу до організації</h1>
        {/* Не «сповіщення»: `?org=` несе так само скопійоване посилання,
            закладка й запрошення, і найчастіша причина не «вас прибрали», а
            «ви зайшли іншим акаунтом» — а речення стверджувало рівно одну з
            них. Другу половину («Задачу не було видалено через цю помилку»)
            читач не питав: він щойно натиснув посилання, а не видаляв задачу.
            Одне речення, яке називає факт, і те саме, що каже qTicket. */}
        <p className="text-[13px] text-muted mb-5">
          Посилання веде до організації, до якої цей акаунт не має доступу.
        </p>
        {/* Кнопка називає, куди веде, а не яку внутрішню річ робить. «Поточна
            організація» — це слово продукту про свій стан: читач, який щойно
            дізнався, що потрапив не туди, не має жодного уявлення, котра з них
            поточна, і чи є вона взагалі. */}
        <Button
          onClick={() => router.replace('/')}
          size="lg"
          composition="workspace-guard"
        >
          На головну сторінку
        </Button>
      </div>
    </div>
  );
}
