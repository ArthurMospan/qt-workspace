import { NextResponse } from 'next/server';
import { authenticateRequest, getAdminDb } from '@/lib/server/firebaseAdmin';
import { routeErrorResponse } from '@/lib/server/apiErrors';

const GET_ALL_CHUNK = 100;

/**
 * Server-authoritative organization directory for the signed-in account.
 *
 * The workspace normally receives this through Firestore's live client query.
 * This route is the independent recovery path for a browser whose persistent
 * Firestore cache or network state is stuck: the caller supplies no user or
 * organization id, so the verified token is the only scope it can read.
 */
export async function GET(request) {
  try {
    const authorization = await authenticateRequest(request);
    if (authorization.error) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }

    const uid = authorization.user.uid;
    const db = getAdminDb();
    const membershipSnapshot = await db.collection('orgMemberships')
      .where('userId', '==', uid)
      .get();
    const memberships = membershipSnapshot.docs
      .map(document => document.data())
      .filter(membership => membership.userId === uid && membership.orgId)
      .map(membership => ({ orgId: membership.orgId, role: membership.role || null }));
    const organizationIds = [...new Set(memberships.map(membership => membership.orgId))];

    const chunks = [];
    for (let index = 0; index < organizationIds.length; index += GET_ALL_CHUNK) {
      chunks.push(organizationIds.slice(index, index + GET_ALL_CHUNK));
    }
    const documentChunks = await Promise.all(chunks.map(ids => db.getAll(
      ...ids.map(id => db.collection('organizations').doc(id)),
    )));
    const organizations = documentChunks
      .flat()
      .filter(document => document.exists)
      .map(document => ({ id: document.id, ...document.data() }));

    return NextResponse.json({ memberships, organizations });
  } catch (error) {
    return routeErrorResponse(error, {
      context: 'organization-directory',
      fallbackMessage: 'Не вдалося перевірити список організацій',
    });
  }
}
