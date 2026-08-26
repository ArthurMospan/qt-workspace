'use client';

// The strip, wired to the workspace it is about.
//
// The kit component is told what to say; this decides whether there is anything
// to say at all. `usePlanLimits` costs no read of its own — the projects are
// already subscribed and the rest is a field on the organization document — so
// a strip that is almost never shown is almost never paid for.

import { PlanLimitBanner } from '@/components/ui';
import { usePlanLimits } from '@/lib/hooks/usePlanLimits';
import useWorkspaceStore from '@/store/useWorkspaceStore';

export default function WorkspacePlanLimitBanner() {
  const { notices } = usePlanLimits();
  const openPlanUpgrade = useWorkspaceStore(state => state.openPlanUpgrade);

  // One strip, not three. A workspace that has filled up in every direction at
  // once would otherwise stack a wall of them over the page it is describing;
  // the loudest ceiling leads and the rest are a clause at the end of it.
  const [leading, ...rest] = notices;
  if (!leading) return null;

  return (
    <PlanLimitBanner
      notice={leading}
      extra={rest.length}
      onOpen={() => openPlanUpgrade({ limitId: leading.id })}
    />
  );
}
