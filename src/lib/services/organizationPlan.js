'use client';

import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { normalizePlan } from '@/lib/utils/plans.mjs';

/**
 * Switching plans, with nothing to pay.
 *
 * Two screens do it now — the settings section and the dialog the crown opens —
 * so the write lives here rather than in whichever of them was written first.
 * It is one field on the organization document, written straight from the
 * client, because until money is involved that is the honest version of what
 * happens: an owner picks a plan and the workspace changes.
 *
 * When billing is real this becomes a server route and `plan` joins `apiKeys`
 * among the fields firestore.rules refuses from a client. Nothing else has to
 * move when it does, which is the other reason it is here.
 */
export async function switchOrganizationPlan(organizationId, plan) {
  const next = normalizePlan(plan);
  await updateDoc(doc(db, 'organizations', organizationId), { plan: next });
  return next;
}
