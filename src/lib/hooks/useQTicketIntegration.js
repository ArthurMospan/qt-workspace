'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { usePlanLimits } from '@/lib/hooks/usePlanLimits';
import { authenticatedRequest } from '@/lib/services/authenticatedRequest';

const EMPTY_STATUS = Object.freeze({
  configured: false,
  active: false,
  selectedUserIds: [],
  // Which qTicket role each selected person gets, where it is not the role
  // they hold in QuickTeam. Absent means «the same one».
  staffRoles: {},
  // The client-facing brand, when it is not the organization's own. `null` is
  // «the same one» and is the default.
  portal: null,
  // Whom qTicket refused a seat because they already hold a client one. The
  // contract always returned these; the card never asked.
  conflicts: [],
  qTicketOrganizationId: '',
  revision: 0,
  lastSyncAt: null,
  lastError: '',
  // Unknown and none are drawn the same way — nothing — so the badge never
  // claims an empty inbox it could not reach. See the status route.
  unread: 0,
});

export function useQTicketIntegration() {
  const { activeOrgId, currentUser } = useAppContext();
  const { allows } = usePlanLimits();
  const userId = currentUser?.uid || currentUser?.id || '';
  const [status, setStatus] = useState(EMPTY_STATUS);
  const [loading, setLoading] = useState(false);

  const request = useCallback(async (path, options = {}) => authenticatedRequest(
    path,
    options,
    'Не вдалося виконати запит до qTicket',
  ), []);

  const refresh = useCallback(async () => {
    if (!activeOrgId || !userId) {
      setStatus(EMPTY_STATUS);
      return EMPTY_STATUS;
    }
    setLoading(true);
    try {
      const next = await request(`/api/integrations/qticket?organizationId=${encodeURIComponent(activeOrgId)}`);
      setStatus({ ...EMPTY_STATUS, ...next });
      return next;
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, request, userId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => refresh().catch(() => {}), 0);
    return () => window.clearTimeout(timeoutId);
  }, [refresh]);

  // One sync sends whatever the card is holding. `portal` left out means «keep
  // the brand you have» rather than «clear it» — the roster form and the brand
  // form are two controls on one card, and either must be able to sync without
  // erasing the other.
  const synchronize = useCallback(async ({ selectedUserIds, staffRoles, portal } = {}) => {
    if (!activeOrgId) throw new Error('Не вказано організацію');
    setLoading(true);
    try {
      const next = await request('/api/integrations/qticket', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: activeOrgId,
          selectedUserIds,
          staffRoles,
          ...(portal === undefined ? {} : { portal }),
        }),
      });
      setStatus(previous => ({ ...previous, ...next }));
      return next;
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, request]);

  // Asked of qTicket, not of this database — see the route. It writes nothing,
  // so it does not touch `status`: an unreachable add-on is a finding to show,
  // not a reason to redraw the card as broken.
  const ping = useCallback(async () => {
    if (!activeOrgId) throw new Error('Не вказано організацію');
    return request('/api/integrations/qticket/ping', {
      method: 'POST',
      body: JSON.stringify({ organizationId: activeOrgId }),
    });
  }, [activeOrgId, request]);

  const open = useCallback(async (returnTo = '/overview') => {
    if (!activeOrgId) throw new Error('Не вказано організацію');
    setLoading(true);
    try {
      const launch = await request('/api/integrations/qticket/launch', {
        method: 'POST',
        body: JSON.stringify({ organizationId: activeOrgId, returnTo }),
      });
      if (!launch.launchUrl) throw new Error('qTicket не повернув посилання для входу');
      window.location.assign(launch.launchUrl);
      return launch;
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, request]);

  const deactivate = useCallback(async () => {
    if (!activeOrgId) throw new Error('Не вказано організацію');
    setLoading(true);
    try {
      const next = await request('/api/integrations/qticket', {
        method: 'DELETE',
        body: JSON.stringify({ organizationId: activeOrgId }),
      });
      setStatus(previous => ({ ...previous, ...next, active: false }));
      return next;
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, request]);

  // Тут, а не в рейці: `enabledForCurrentUser` читають і сайдбар, і нижня
  // панель телефона, і жодна з них не має вирішувати це окремо. Малювати
  // платний пункт меню — те саме «відповідати за фічу», що й пускати в неї.
  const enabledForCurrentUser = useMemo(() => (
    status.active === true && status.selectedUserIds.includes(userId) && allows('qticket')
  ), [allows, status.active, status.selectedUserIds, userId]);
  const unread = enabledForCurrentUser ? Math.max(0, Number(status.unread) || 0) : 0;

  return {
    status,
    loading,
    enabledForCurrentUser,
    unread,
    refresh,
    synchronize,
    deactivate,
    open,
    ping,
  };
}
