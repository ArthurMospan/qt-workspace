import 'server-only';

import { NextResponse } from 'next/server';
import {
  DEFAULT_PLAN,
  normalizePlan,
  planLimit,
  planLimitRefusal,
  planUsagePeriod,
} from '@/lib/utils/plans.mjs';

// Where a ceiling becomes a refusal.
//
// The price list said «10 учасників» for months and nothing counted them. Three
// of the registry's ceilings now have a route that says no, and all three say
// no through this file, so a plan cannot be enforced in one place and forgotten
// in another — and cannot be worded differently either, because the sentence
// comes from the registry rather than from the route.
//
// ── The counter on the organization, and what it is not ─────────────────
//
// Every refusal here counts for real at the moment of the write: the project
// transaction counts projects, the invitation counts memberships, the AI route
// reads its own tally inside a transaction. `usage` on the organization
// document is written alongside as a **display cache** — it is what lets a
// button look refused before it is pressed and a strip appear on a screen that
// has loaded nothing but the organization. Nothing is decided from it. A client
// that wrote a smaller number into it would change what it sees and nothing
// about what it is allowed to do.

/** The plan a workspace is on, from a document snapshot or a fresh read. */
export function organizationPlan(snapshot) {
  return normalizePlan(snapshot?.exists ? snapshot.data().plan : DEFAULT_PLAN);
}

/**
 * How many people hold a seat right now.
 *
 * Membership is the existence of `orgMemberships/{orgId}_{uid}`: deactivating
 * somebody moves that document to the archive rather than flagging it, so
 * counting the collection is counting the active team with nothing to filter.
 * `count()` is an aggregation — one read per thousand documents, not one per
 * member — which matters on a plan with a daily read budget.
 */
export async function countActiveMembers(db, organizationId) {
  const snapshot = await db.collection('orgMemberships')
    .where('orgId', '==', organizationId)
    .count()
    .get();
  return snapshot.data().count;
}

/**
 * Writes the display cache, and only when it has actually moved.
 *
 * A write on every request would be a write per page view on a product whose
 * free tier is metered in writes. Never throws: the number on a badge is not
 * worth failing an invitation over.
 */
export async function recordPlanUsage(db, organizationId, patch) {
  try {
    const reference = db.collection('organizations').doc(organizationId);
    const snapshot = await reference.get();
    if (!snapshot.exists) return;
    const current = snapshot.data().usage || {};
    const changed = Object.entries(patch).some(([key, value]) => current[key] !== value);
    if (!changed) return;
    await reference.set({ usage: { ...current, ...patch } }, { merge: true });
  } catch (error) {
    console.error('[planLimits] usage cache write failed', { organizationId, error });
  }
}

/**
 * The 403 a route sends when a ceiling is in the way, or `null` to carry on.
 *
 * The body carries the machine-readable parts as well as the sentence, so the
 * screen that receives it can open the upgrade dialog on the right ceiling
 * instead of parsing Ukrainian out of an error string.
 */
export function planLimitRefusalResponse(plan, key, used) {
  const ceiling = planLimit(plan, key);
  if (used < ceiling) return null;
  return NextResponse.json({
    error: planLimitRefusal(plan, key, used),
    planLimit: { id: key, plan: normalizePlan(plan), ceiling: Number.isFinite(ceiling) ? ceiling : null, used },
  }, { status: 403 });
}

/**
 * Takes one call off this month's allowance, or refuses.
 *
 * Two steps rather than one, on purpose. `reserve` reads the tally before the
 * model is called, so a workspace at its ceiling never reaches Gemini at all;
 * `commit` increments inside a transaction, and only after an analysis actually
 * came back, so a request the provider dropped does not spend somebody's month.
 * The gap between them can let two simultaneous calls both pass at the last
 * unit, which is a better failure than charging for an answer nobody got.
 */
export async function reserveAiCall(db, organizationId, timeZone) {
  const period = planUsagePeriod(new Date(), timeZone);
  const snapshot = await db.collection('organizations').doc(organizationId).get();
  const plan = organizationPlan(snapshot);
  const usage = snapshot.exists ? snapshot.data().usage || {} : {};
  const used = usage.aiCallsPeriod === period && typeof usage.aiCalls === 'number' ? usage.aiCalls : 0;
  // The tally and the plan, not the verdict. The route asks
  // `planLimitRefusalResponse` itself, naming the ceiling where it refuses —
  // which is what `tests/plans.test.mjs` holds every `enforced: true` to, and
  // what stops a flag being flipped on a file that only looks like it counts.
  return { plan, period, used };
}

export async function commitAiCall(db, organizationId, period) {
  try {
    const reference = db.collection('organizations').doc(organizationId);
    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return;
      const usage = snapshot.data().usage || {};
      const carried = usage.aiCallsPeriod === period && typeof usage.aiCalls === 'number' ? usage.aiCalls : 0;
      transaction.set(reference, {
        usage: { ...usage, aiCalls: carried + 1, aiCallsPeriod: period },
      }, { merge: true });
    });
  } catch (error) {
    // An analysis that was delivered must not be turned into an error because
    // the tally could not be written. It undercounts; it never loses work.
    console.error('[planLimits] ai call tally failed', { organizationId, error });
  }
}
