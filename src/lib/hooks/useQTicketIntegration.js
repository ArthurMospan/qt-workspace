'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { authenticatedRequest } from '@/lib/services/authenticatedRequest';

const EMPTY_STATUS = Object.freeze({
  configured: false,
  active: false,
  selectedUserIds: [],
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

  const synchronize = useCallback(async selectedUserIds => {
    if (!activeOrgId) throw new Error('Не вказано організацію');
    setLoading(true);
    try {
      const next = await request('/api/integrations/qticket', {
        method: 'POST',
        body: JSON.stringify({ organizationId: activeOrgId, selectedUserIds }),
      });
      setStatus(previous => ({ ...previous, ...next }));
      return next;
    } finally {
      setLoading(false);
    }
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

  const enabledForCurrentUser = useMemo(() => (
    status.active === true && status.selectedUserIds.includes(userId)
  ), [status.active, status.selectedUserIds, userId]);
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
  };
}
