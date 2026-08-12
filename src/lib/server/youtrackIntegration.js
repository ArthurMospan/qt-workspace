import { FieldValue } from 'firebase-admin/firestore';
import 'server-only';

import { createHash } from 'node:crypto';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
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
    connectedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
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
  const stateBundleIds = [...new Set(projects.flatMap(project => (
    (project.customFields || [])
      .filter(field => (
        String(field?.$type || '').includes('StateProjectCustomField')
        || String(field?.field?.name || '').toLowerCase() === 'state'
      ))
      .map(field => String(field?.bundle?.id || ''))
      .filter(Boolean)
  )))];
  const stateBundles = new Map();
  for (let index = 0; index < stateBundleIds.length; index += 8) {
    const batch = stateBundleIds.slice(index, index + 8);
    const values = await Promise.all(batch.map(bundleId => client.stateBundle(bundleId)));
    batch.forEach((bundleId, bundleIndex) => {
      if (values[bundleIndex]) stateBundles.set(bundleId, values[bundleIndex]);
    });
  }
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
        statuses: (project.customFields || [])
          .filter(field => (
            String(field?.$type || '').includes('StateProjectCustomField')
            || String(field?.field?.name || '').toLowerCase() === 'state'
          ))
          .flatMap(field => stateBundles.get(String(field?.bundle?.id || ''))?.values || [])
          .filter(status => status?.name)
          .sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))
          .map(status => ({
            id: String(status.id || status.name),
            name: String(status.name),
            archived: status.archived === true,
          })),
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
