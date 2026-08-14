import { NextResponse } from 'next/server';
import { authorizeOrgRequest, getAdminDb } from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';

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
    const membershipsSnap = await db.collection('orgMemberships')
      .where('orgId', '==', organizationId)
      .get();
    const memberships = membershipsSnap.docs
      .map(item => item.data())
      .filter(membership => membership.removalPending !== true);
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
