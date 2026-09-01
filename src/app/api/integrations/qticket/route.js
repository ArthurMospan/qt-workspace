import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { authorizeOrgRequest, getAdminDb } from '@/lib/server/firebaseAdmin';
import { readJsonBody, routeErrorResponse } from '@/lib/server/apiErrors';
import { qTicketIntegrationConfig } from '@/lib/integrations/qticketContract.mjs';
import {
  historyEntry,
  normalizePortal,
  normalizeStaffRoles,
  QTICKET_HISTORY_LIMIT,
} from '@/lib/integrations/qticketDesk.mjs';
import { fetchQTicketUnread, provisionQTicket } from '@/lib/server/qticket';

const INTERNAL_ROLES = new Set(['owner', 'admin', 'member']);
// The rail asks for its badge on every mount, and the answer lives in another
// product. A minute of staleness is the price of not turning a page reload into
// a cross-service request — the number that matters is the one inside qTicket,
// and this one is a hint that it is worth opening. The map is per server
// instance and bounded; a cold start simply asks.
const UNREAD_TTL_MS = 60_000;
const UNREAD_CACHE_LIMIT = 500;
const unreadCache = new Map();

function cachedUnread(key, nowMs) {
  const entry = unreadCache.get(key);
  return entry && entry.expiresAt > nowMs ? entry.unread : null;
}

function rememberUnread(key, unread, nowMs) {
  if (unreadCache.size >= UNREAD_CACHE_LIMIT) {
    for (const [candidate, entry] of unreadCache) {
      if (entry.expiresAt <= nowMs) unreadCache.delete(candidate);
    }
    if (unreadCache.size >= UNREAD_CACHE_LIMIT) {
      unreadCache.delete(unreadCache.keys().next().value);
    }
  }
  unreadCache.set(key, { unread, expiresAt: nowMs + UNREAD_TTL_MS });
}

// A badge nobody can be shown is not worth a request: the row itself is drawn
// only for an active add-on and a person QuickTeam actually sent to qTicket.
async function qTicketUnreadFor(config, view, userId) {
  if (!config.configured || view.active !== true || !view.selectedUserIds.includes(userId)) return 0;
  const key = `${view.qTicketOrganizationId || 'pending'}|${userId}`;
  const nowMs = Date.now();
  const cached = cachedUnread(key, nowMs);
  if (cached !== null) return cached;
  try {
    const answer = await fetchQTicketUnread({
      sourceOrganizationId: view.sourceOrganizationId,
      sourceUserId: userId,
    });
    const unread = Math.max(0, Number(answer?.unread) || 0);
    rememberUnread(key, unread, nowMs);
    return unread;
  } catch (error) {
    // qTicket being unreachable is not a failure of this screen. The badge is
    // absent, the row still opens the product, and the miss is not cached —
    // the next mount asks again.
    console.error('[qticket] unread badge', error?.code || error?.message || error);
    return 0;
  }
}
const PUBLIC_PROFILE_FIELDS = ['name', 'email', 'customAvatar', 'avatar', 'photoURL'];
// The three decisions this route makes about the desk — which role, which
// brand, what changed — live in `qticketDesk.mjs`, where they can be tested as
// rules rather than as the text of a handler.

function organizationIdFrom(request) {
  return new URL(request.url).searchParams.get('organizationId')?.trim() || '';
}

function serializeTimestamp(value) {
  return value?.toDate?.().toISOString?.() || value || null;
}

function integrationView(config, data = {}, extra = {}) {
  return {
    configured: config.configured,
    active: data.active === true,
    selectedUserIds: Array.isArray(data.selectedUserIds) ? data.selectedUserIds : [],
    staffRoles: data.staffRoles && typeof data.staffRoles === 'object' ? data.staffRoles : {},
    portal: data.portal || null,
    qTicketOrganizationId: data.qTicketOrganizationId || '',
    revision: Number(data.revision) || 0,
    lastSyncAt: serializeTimestamp(data.lastSyncAt),
    lastError: data.lastError || '',
    // Whom qTicket refused a seat, and why. The contract has always returned
    // this so QuickTeam could explain it; nothing here read it, so a colleague
    // who already held a client seat got no access and the owner got a green
    // toast. See docs/integrations/QTICKET.md, «Provisioning».
    conflicts: Array.isArray(data.lastConflicts) ? data.lastConflicts : [],
    history: Array.isArray(data.history) ? data.history : [],
    unread: 0,
    ...extra,
  };
}

async function organizationSnapshot(db, organizationId, selectedUserIds, requestedRoles) {
  const organizationSnap = await db.doc(`organizations/${organizationId}`).get();
  if (!organizationSnap.exists) throw Object.assign(new Error('Організацію не знайдено'), { status: 404 });
  const organization = organizationSnap.data();
  const ownerId = organization.ownerId;
  const requested = [...new Set([ownerId, ...(selectedUserIds || [])].filter(Boolean))];
  if (requested.length > 100) {
    throw Object.assign(new Error('Для qTicket можна обрати не більше 100 працівників'), { status: 400 });
  }
  const membershipSnapshots = await db.getAll(...requested.map(userId => (
    db.doc(`orgMemberships/${organizationId}_${userId}`)
  )));
  const memberships = membershipSnapshots.map(snapshot => snapshot.exists ? snapshot.data() : null);
  if (memberships.some((membership, index) => (
    !membership
    || membership.orgId !== organizationId
    || membership.userId !== requested[index]
    || !INTERNAL_ROLES.has(membership.role)
    || membership.removalPending === true
  ))) {
    throw Object.assign(new Error('Оберіть лише активних учасників цієї організації'), { status: 400 });
  }
  const profiles = requested.length
    ? await db.getAll(...requested.map(userId => db.doc(`users/${userId}`)))
    : [];
  const staffRoles = normalizeStaffRoles(requestedRoles, { selectedUserIds: requested, ownerId });
  const staff = requested.map((userId, index) => {
    const membership = memberships[index];
    const profile = profiles[index]?.exists ? profiles[index].data() : {};
    const safe = Object.fromEntries(PUBLIC_PROFILE_FIELDS
      .filter(field => profile[field] !== undefined)
      .map(field => [field, profile[field]]));
    const email = String(safe.email || membership.email || '').trim().toLowerCase();
    const name = String(safe.name || email.split('@')[0] || 'Користувач').trim();
    if (!email) throw Object.assign(new Error(`У профілі ${name} немає email для qTicket`), { status: 400 });
    return {
      sourceUserId: userId,
      email,
      name,
      avatar: safe.customAvatar || safe.avatar || safe.photoURL || '',
      role: userId === ownerId ? 'owner' : (staffRoles[userId] || membership.role),
    };
  });
  return {
    organization,
    selectedUserIds: requested,
    staffRoles,
    staff,
  };
}

function snapshotDigest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export async function GET(request) {
  try {
    const organizationId = organizationIdFrom(request);
    const authorization = await authorizeOrgRequest(request, organizationId, ['owner', 'admin', 'member']);
    if (authorization.error) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    const config = qTicketIntegrationConfig();
    const snapshot = await getAdminDb().doc(`organizations/${organizationId}/private/qticket`).get();
    const view = integrationView(config, snapshot.data());
    // The rail already asks this route on every mount, so the badge rides with
    // the status it belongs to rather than opening a second request of its own.
    const unread = await qTicketUnreadFor(
      config,
      { ...view, sourceOrganizationId: organizationId },
      authorization.user.uid,
    );
    return NextResponse.json({ ...view, unread }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return routeErrorResponse(error, { context: 'qticket-status', fallbackMessage: 'Не вдалося перевірити qTicket' });
  }
}

export async function POST(request) {
  try {
    const body = await readJsonBody(request);
    const organizationId = String(body?.organizationId || '').trim();
    const authorization = await authorizeOrgRequest(request, organizationId, ['owner']);
    if (authorization.error) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    const config = qTicketIntegrationConfig();
    if (!config.configured) {
      return NextResponse.json({ error: 'qTicket не налаштовано на сервері', code: 'not_configured' }, { status: 503 });
    }

    const db = getAdminDb();
    const privateRef = db.doc(`organizations/${organizationId}/private/qticket`);
    const currentSnap = await privateRef.get();
    const current = currentSnap.exists ? currentSnap.data() : {};
    const snapshot = await organizationSnapshot(db, organizationId, body?.selectedUserIds, body?.staffRoles);
    // A brand the request did not mention is the brand already stored, not an
    // absent one: the roster form and the brand form are two controls on one
    // card, and a sync from either must not silently clear the other.
    const portal = body?.portal === undefined
      ? normalizePortal(current.portal)
      : normalizePortal(body.portal);
    const desired = {
      sourceOrganizationId: organizationId,
      entitlement: 'active',
      organization: {
        name: snapshot.organization.name || 'Організація',
        logo: snapshot.organization.logo || '',
        sidebarTheme: snapshot.organization.sidebarTheme || 'dark',
        sidebarColor: snapshot.organization.sidebarColor || '',
        timezone: snapshot.organization.timezone || 'Europe/Kyiv',
        ...(portal ? { portal } : {}),
      },
      staff: snapshot.staff,
    };
    const digest = snapshotDigest(desired);
    if (current.active === true && current.snapshotDigest === digest) {
      return NextResponse.json(integrationView(config, current));
    }
    const revision = current.pendingDigest === digest && Number(current.pendingRevision) > 0
      ? Number(current.pendingRevision)
      : (Number(current.revision) || 0) + 1;

    await privateRef.set({
      active: current.active === true,
      selectedUserIds: snapshot.selectedUserIds,
      staffRoles: snapshot.staffRoles,
      portal,
      pendingDigest: digest,
      pendingRevision: revision,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: authorization.user.uid,
      lastError: '',
    }, { merge: true });

    try {
      const provisioned = await provisionQTicket({ ...desired, revision });
      // qTicket names whoever it refused a seat, on every answer and not only
      // the one that refused them. Kept so the card can say why a colleague has
      // no access — this was returned and dropped, and the owner saw «Команду
      // qTicket синхронізовано» over a person who got nothing.
      const conflicts = Array.isArray(provisioned.conflicts) ? provisioned.conflicts : [];
      const history = [
        historyEntry({
          before: current,
          after: { selectedUserIds: snapshot.selectedUserIds, staffRoles: snapshot.staffRoles, portal },
          actorId: authorization.user.uid,
          revision,
        }),
        ...(Array.isArray(current.history) ? current.history : []),
      ].slice(0, QTICKET_HISTORY_LIMIT);
      await privateRef.set({
        active: true,
        selectedUserIds: snapshot.selectedUserIds,
        staffRoles: snapshot.staffRoles,
        portal,
        qTicketOrganizationId: provisioned.organizationId,
        revision,
        snapshotDigest: digest,
        pendingDigest: FieldValue.delete(),
        pendingRevision: FieldValue.delete(),
        lastSyncAt: FieldValue.serverTimestamp(),
        lastError: '',
        lastConflicts: conflicts,
        history,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return NextResponse.json({
        ...integrationView(config, {
          ...current,
          active: true,
          selectedUserIds: snapshot.selectedUserIds,
          staffRoles: snapshot.staffRoles,
          portal,
          qTicketOrganizationId: provisioned.organizationId,
          revision,
          lastConflicts: conflicts,
          history,
        }),
        lastSyncAt: new Date().toISOString(),
        status: provisioned.status,
      });
    } catch (upstreamError) {
      await privateRef.set({
        lastError: upstreamError.message.slice(0, 300),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      throw upstreamError;
    }
  } catch (error) {
    if (Number(error?.status) >= 400 && Number(error?.status) < 500) {
      return NextResponse.json({ error: error.message, code: error.code || 'invalid_request' }, { status: error.status });
    }
    return routeErrorResponse(error, { context: 'qticket-provision', fallbackMessage: 'Не вдалося активувати qTicket' });
  }
}

export async function DELETE(request) {
  try {
    const body = await readJsonBody(request);
    const organizationId = String(body?.organizationId || '').trim();
    const authorization = await authorizeOrgRequest(request, organizationId, ['owner']);
    if (authorization.error) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    const config = qTicketIntegrationConfig();
    if (!config.configured) {
      return NextResponse.json({ error: 'qTicket не налаштовано на сервері', code: 'not_configured' }, { status: 503 });
    }

    const db = getAdminDb();
    const privateRef = db.doc(`organizations/${organizationId}/private/qticket`);
    const currentSnap = await privateRef.get();
    const current = currentSnap.exists ? currentSnap.data() : {};
    if (current.active !== true) {
      return NextResponse.json(integrationView(config, current));
    }

    // The inactive snapshot still carries the current owner because version 1
    // requires one authoritative owner. qTicket gates the whole organization
    // by entitlement, so neither this owner nor existing clients keep access.
    // Keeping the previous selection in QuickTeam lets reactivation restore it.
    const snapshot = await organizationSnapshot(db, organizationId, []);
    const desired = {
      sourceOrganizationId: organizationId,
      entitlement: 'inactive',
      organization: {
        name: snapshot.organization.name || 'Організація',
        logo: snapshot.organization.logo || '',
        sidebarTheme: snapshot.organization.sidebarTheme || 'dark',
        sidebarColor: snapshot.organization.sidebarColor || '',
        timezone: snapshot.organization.timezone || 'Europe/Kyiv',
      },
      staff: snapshot.staff,
    };
    const digest = snapshotDigest(desired);
    const revision = (Number(current.revision) || 0) + 1;
    await privateRef.set({
      pendingDigest: digest,
      pendingRevision: revision,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: authorization.user.uid,
      lastError: '',
    }, { merge: true });

    try {
      const provisioned = await provisionQTicket({ ...desired, revision });
      await privateRef.set({
        active: false,
        revision,
        snapshotDigest: digest,
        pendingDigest: FieldValue.delete(),
        pendingRevision: FieldValue.delete(),
        lastSyncAt: FieldValue.serverTimestamp(),
        lastError: '',
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return NextResponse.json({
        ...integrationView(config, { ...current, active: false, revision }),
        status: provisioned.status,
      });
    } catch (upstreamError) {
      await privateRef.set({
        lastError: upstreamError.message.slice(0, 300),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      throw upstreamError;
    }
  } catch (error) {
    if (Number(error?.status) >= 400 && Number(error?.status) < 500) {
      return NextResponse.json({ error: error.message, code: error.code || 'invalid_request' }, { status: error.status });
    }
    return routeErrorResponse(error, { context: 'qticket-deactivate', fallbackMessage: 'Не вдалося вимкнути qTicket' });
  }
}
