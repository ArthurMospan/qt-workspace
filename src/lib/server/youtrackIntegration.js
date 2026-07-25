import 'server-only';

import { createHash } from 'node:crypto';
import { admin, getAdminDb } from '@/lib/server/firebaseAdmin';
import { open, seal } from '@/lib/server/secretBox.mjs';
import { YouTrackClient } from '@/lib/server/youtrackClient';
import { normalizeYouTrackBaseUrl } from '@/lib/utils/youtrackImport.mjs';

function connectionRef(organizationId) {
  return getAdminDb().collection('organizations').doc(organizationId)
    .collection('private').doc('youtrack');
}

function connectionIdFor(baseUrl) {
  return createHash('sha256').update(baseUrl).digest('hex').slice(0, 32);
}

function publicConnection(snapshot) {
  if (!snapshot.exists) return { connected: false };
  const data = snapshot.data();
  return {
    connected: Boolean(data.tokenBox && data.baseUrl),
    baseUrl: data.baseUrl || '',
    connectionId: data.connectionId || '',
    account: data.account || null,
    connectedAt: data.connectedAt?.toDate?.().toISOString() || null,
    updatedAt: data.updatedAt?.toDate?.().toISOString() || null,
  };
}

export async function readYouTrackConnection(organizationId) {
  return publicConnection(await connectionRef(organizationId).get());
}

export async function connectYouTrack({ organizationId, baseUrl, token, userId }) {
  const normalizedUrl = normalizeYouTrackBaseUrl(baseUrl);
  const cleanToken = String(token || '').trim();
  if (cleanToken.length < 10 || cleanToken.length > 2_000) {
    throw new Error('Некоректний постійний токен YouTrack');
  }

  const client = new YouTrackClient({ baseUrl: normalizedUrl, token: cleanToken });
  const account = await client.me();
  const payload = {
    provider: 'youtrack',
    baseUrl: normalizedUrl,
    connectionId: connectionIdFor(normalizedUrl),
    tokenBox: seal(cleanToken),
    account: {
      id: String(account?.id || ''),
      login: String(account?.login || ''),
      name: String(account?.name || account?.fullName || account?.login || ''),
      email: String(account?.email || ''),
    },
    connectedBy: userId,
    connectedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await connectionRef(organizationId).set(payload);
  return { ...publicConnection({ exists: true, data: () => payload }), connectedAt: new Date().toISOString() };
}

export async function disconnectYouTrack(organizationId) {
  await connectionRef(organizationId).delete();
}

export async function youTrackClientFor(organizationId) {
  const snapshot = await connectionRef(organizationId).get();
  if (!snapshot.exists) throw new Error('YouTrack не підключено');
  const data = snapshot.data();
  if (!data.tokenBox || !data.baseUrl) throw new Error('Підключення YouTrack пошкоджене');
  return {
    connection: data,
    client: new YouTrackClient({ baseUrl: data.baseUrl, token: open(data.tokenBox) }),
  };
}

export async function discoverYouTrack(organizationId) {
  const { client, connection } = await youTrackClientFor(organizationId);
  const [projects, users] = await Promise.all([client.projects(), client.users()]);
  return {
    connectionId: connection.connectionId,
    projects: projects
      .filter(project => project?.id && !project.archived)
      .map(project => ({
        id: String(project.id),
        name: String(project.name || project.shortName || 'Без назви'),
        shortName: String(project.shortName || project.id),
        description: String(project.description || ''),
        archived: project.archived === true,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'uk')),
    users: users
      .filter(user => user?.id || user?.login)
      .map(user => ({
        id: String(user.id || user.login),
        login: String(user.login || ''),
        name: String(user.name || user.fullName || user.login || user.email || 'Користувач YouTrack'),
        email: String(user.email || ''),
        avatarUrl: String(user.avatarUrl || ''),
        banned: user.banned === true,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'uk')),
  };
}
