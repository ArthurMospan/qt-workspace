import { NextResponse } from 'next/server';
import { authorizeOrgRequest, getAdminDb } from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';
import {
  MEMBER_STATUS,
  MEMBERSHIP_ARCHIVE,
  MEMBERSHIP_COLLECTION,
} from '@/lib/utils/orgMembership.mjs';

const PUBLIC_PROFILE_FIELDS = [
  'name', 'email', 'customAvatar', 'avatar', 'photoURL', 'phone', 'title', 'status', 'statusEmoji',
  'bio', 'skills', 'telegram', 'location', 'timezone', 'birthday', 'lastActive',
];
const NESTED_PROFILE_FIELDS = ['bio', 'skills', 'telegram', 'phone', 'location', 'timezone', 'birthday'];

function serializeValue(value) {
  if (value?.toDate) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serializeValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeValue(item)]));
  }
  return value;
}

export async function GET(request, context) {
  try {
    const { organizationId } = await context.params;
    const authorization = await authorizeOrgRequest(request, organizationId);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }

    const db = getAdminDb();
    // Deactivated people stay in the directory. Every task they were assigned,
    // every comment they wrote and every hour they logged still names them, and
    // a directory that forgets them turns all of that into an unknown id. They
    // come back flagged, so a picker can leave them out while history keeps
    // rendering their name and face.
    const [membershipsSnap, archivedSnap] = await Promise.all([
      db.collection(MEMBERSHIP_COLLECTION).where('orgId', '==', organizationId).get(),
      db.collection(MEMBERSHIP_ARCHIVE).where('orgId', '==', organizationId).get(),
    ]);
    const activeMemberships = membershipsSnap.docs
      .map(item => item.data())
      .filter(membership => membership.removalPending !== true)
      .map(membership => ({ ...membership, status: MEMBER_STATUS.active }));
    const archivedMemberships = archivedSnap.docs
      .map(item => item.data())
      .map(membership => ({ ...membership, status: MEMBER_STATUS.deactivated }));
    // An active membership always wins over an archived one. The two flows are
    // transactional and should never both exist for one person, but a directory
    // that listed somebody twice would break every list keyed by user id — and
    // it would do so quietly, long after whatever caused it.
    const activeUserIds = new Set(activeMemberships.map(membership => membership.userId));
    const memberships = [
      ...activeMemberships,
      ...archivedMemberships.filter(membership => !activeUserIds.has(membership.userId)),
    ];
    const profileSnaps = memberships.length
      ? await db.getAll(...memberships.map(item => db.collection('users').doc(item.userId)))
      : [];
    const canViewBilling = ['owner', 'admin'].includes(authorization.membership.role);
    const rateSnaps = canViewBilling && memberships.length
      ? await db.getAll(...memberships.map(item => db.collection('organizations')
        .doc(organizationId)
        .collection('memberRates')
        .doc(item.userId)))
      : [];

    const members = memberships.map((membership, index) => {
      const profile = profileSnaps[index]?.exists ? profileSnaps[index].data() : {};
      const safeProfile = {};
      for (const field of PUBLIC_PROFILE_FIELDS) {
        if (profile[field] !== undefined) safeProfile[field] = serializeValue(profile[field]);
      }
      if (profile.profile && typeof profile.profile === 'object') {
        safeProfile.profile = Object.fromEntries(NESTED_PROFILE_FIELDS
          .filter(field => profile.profile[field] !== undefined)
          .map(field => [field, serializeValue(profile.profile[field])]));
      }
      return {
        ...safeProfile,
        id: membership.userId,
        uid: membership.userId,
        role: membership.role,
        status: membership.status,
        deactivatedAt: serializeValue(membership.deactivatedAt) || null,
        joinedAt: serializeValue(membership.joinedAt) || null,
        positionId: membership.positionId || '',
        ...(canViewBilling ? {
          hourlyRate: Number(
            rateSnaps[index]?.exists
              ? rateSnaps[index].data().hourlyRate
              : membership.hourlyRate,
          ) || 0,
        } : {}),
      };
    });

    return NextResponse.json({ members }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return routeErrorResponse(error, { context: 'organization-members', fallbackMessage: 'Failed to load organization members' });
  }
}
