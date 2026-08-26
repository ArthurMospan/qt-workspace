'use client';

// What this workspace has left, on every screen, for no reads of its own.
//
// A ceiling that is only checked by the route that refuses is a ceiling people
// meet by being told no. Everything here exists so a control can look refused
// before it is pressed and a strip can say so before anybody presses anything —
// which needs the numbers to be available on screens that have loaded nothing.
//
// So nothing here fetches. Two sources, both already in hand:
//
//   • Projects come from `AppContext`, which is subscribed to them on every
//     screen anyway. Exact, and free. A plain member sees only the projects
//     they are on, so their count would be short — but a plain member cannot
//     create a project either, and the two people who can (owner, admin) see
//     every one of them.
//   • People and calls come from `usage` on the organization document, written
//     by the server routes that count them for real. It is a display cache and
//     is documented as one in `src/lib/server/planLimits.js`: a number missing
//     from it reads as «not known», never as zero, and nothing is decided from
//     it — the refusal is always the route's.

import { useMemo } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import {
  normalizePlan,
  planAllows,
  planLimitNotice,
  planLimitNotices,
  planLimitState,
  planUsage,
  planUsagePeriod,
} from '@/lib/utils/plans.mjs';
import { organizationTimeZone } from '@/lib/utils/timeZone.mjs';

export function usePlanLimits() {
  const { activeOrg, orgRole, projects } = useAppContext();

  return useMemo(() => {
    const plan = normalizePlan(activeOrg?.plan);
    const canAct = orgRole === 'owner' || orgRole === 'admin';
    const period = planUsagePeriod(new Date(), organizationTimeZone(activeOrg));
    const cached = planUsage(activeOrg, { period });
    const visibleProjects = (Array.isArray(projects) ? projects : [])
      .filter(project => project.status === 'active').length;

    const used = {
      ...cached,
      projects: canAct ? visibleProjects : cached.projects,
    };

    return {
      plan,
      used,
      /**
       * Whether this plan includes a capability. The other half of the gate:
       * `blocked` is about a number that ran out, this is about something the
       * plan does not have at any number.
       */
      allows: capabilityId => planAllows(plan, capabilityId),
      /** Whether this ceiling is in the way right now. */
      blocked: key => planLimitState(plan, key, used[key]).blocked,
      /** The whole state of one ceiling: what it is, what is spent, «3 з 3». */
      state: key => planLimitState(plan, key, used[key]),
      /** The sentence for one ceiling, or `null` while nothing is wrong. */
      notice: key => planLimitNotice(plan, key, used[key]),
      /**
       * Every ceiling in the way, for the strip across the top — and only for
       * the people who can do something about it. A plain member cannot invite,
       * cannot create a project and cannot change the plan, so a permanent
       * strip telling them the team is full is noise they cannot clear.
       */
      notices: canAct ? planLimitNotices(plan, used) : [],
    };
  }, [activeOrg, orgRole, projects]);
}

export default usePlanLimits;
