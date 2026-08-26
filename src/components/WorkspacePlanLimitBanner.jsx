'use client';

// The strip, wired to the workspace it is about.
//
// The kit component is told what to say; this decides whether there is anything
// to say at all. `usePlanLimits` costs no read of its own — the projects are
// already subscribed and the rest is a field on the organization document — so
// a strip that is almost never shown is almost never paid for.

import { useCallback, useEffect, useState } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { PlanLimitBanner } from '@/components/ui';
import { usePlanLimits } from '@/lib/hooks/usePlanLimits';
import useWorkspaceStore from '@/store/useWorkspaceStore';

// A week. Long enough that the strip is not something to close every morning,
// short enough that a workspace which has been full for a month is reminded
// that it is — the ceiling has not gone anywhere, and neither has the work
// somebody is not doing because of it.
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

// Per organization and per ceiling: closing «проєктів більше немає» must not
// also close «місць у команді більше немає», which is a different wall.
const dismissKey = (organizationId, limitId) => `qt:plan-limit-hidden:${organizationId}:${limitId}`;

function readDismissedUntil(key) {
  if (typeof window === 'undefined') return 0;
  try {
    return Number(window.localStorage.getItem(key)) || 0;
  } catch {
    // Private mode, or storage blocked. The strip shows; that is the safe way
    // for it to fail.
    return 0;
  }
}

export default function WorkspacePlanLimitBanner() {
  const { activeOrgId } = useAppContext();
  const { notices } = usePlanLimits();
  const openPlanUpgrade = useWorkspaceStore(state => state.openPlanUpgrade);

  // One strip, not three. A workspace that has filled up in every direction at
  // once would otherwise stack a wall of them over the page it is describing;
  // the first ceiling leads and the rest are a clause at the end of it.
  const [leading, ...rest] = notices;
  const key = leading && activeOrgId ? dismissKey(activeOrgId, leading.id) : '';

  // Read after mount, never during render — `localStorage` does not exist on
  // the server, and neither does a clock a render is allowed to look at. The
  // window is compared once here, which is also often enough: it is seven days
  // long, and the screen this hangs over is re-entered many times before it
  // expires.
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    // Deferred like every other read-after-mount in this workspace: a
    // synchronous setState in an effect body cascades a second render before
    // paint.
    queueMicrotask(() => setHidden(key ? readDismissedUntil(key) > Date.now() : false));
  }, [key]);

  const dismiss = useCallback(() => {
    setHidden(true);
    try {
      if (key) window.localStorage.setItem(key, String(Date.now() + DISMISS_MS));
    } catch {
      // Closing it for this session is still worth doing when it cannot be
      // remembered for next time.
    }
  }, [key]);

  if (!leading || hidden) return null;

  return (
    <PlanLimitBanner
      notice={leading}
      extra={rest.length}
      onOpen={() => openPlanUpgrade({ limitId: leading.id })}
      onDismiss={dismiss}
    />
  );
}
