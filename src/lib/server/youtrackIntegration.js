import { FieldValue } from 'firebase-admin/firestore';
import 'server-only';

import { createHash } from 'node:crypto';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { open, seal, SealedBoxUnreadableError } from '@/lib/server/secretBox.mjs';
import { YouTrackClient } from '@/lib/server/youtrackClient';
import {
  YOUTRACK_DISCOVERY_PROBE,
  isYouTrackStateField,
  mergeYouTrackStatuses,
  normalizeYouTrackBaseUrl,
} from '@/lib/utils/youtrackImport.mjs';
import {
  DEFAULT_STATUS_IDS,
  statusLabel,
} from '@/lib/utils/workflowDefaults.mjs';
import { statusCategoryMap } from '@/lib/utils/statusCategories.mjs';

function connectionRef(organizationId) {
  return getAdminDb().collection('organizations').doc(organizationId)
    .collection('private').doc('youtrack');
}

// Знімок YouTrack і збережений вибір живуть поруч із токеном, у тій самій
// закритій колекції: `organizations/{orgId}/private/{doc}` заборонена браузеру
// цілком (`firestore.rules`), тож жодного нового правила для них не треба.
//
// Навіщо знімок узагалі зберігати. Розвідка — це десятки, а на великому
// YouTrack сотні HTTP-запитів; поки вона жила лише в пам'яті вкладки, кожне
// перезавантаження сторінки стирало проєкти, статуси та людей, і екран знову
// показував кнопку «Знайти проєкти». Саме звідси бралося «постійно щось
// нажимати, щоб щось показалось».
function discoveryRef(organizationId) {
  return getAdminDb().collection('organizations').doc(organizationId)
    .collection('private').doc('youtrackDiscovery');
}

function planRef(organizationId) {
  return getAdminDb().collection('organizations').doc(organizationId)
    .collection('private').doc('youtrackPlan');
}

// Стелі знімка, і вони перемножуються.
//
// Документ Firestore — це 1 MiB. Одна людина без аватара — близько ста байтів,
// один статус — дев'яносто, тож рахувати треба не кожну стелю окремо, а їхній
// добуток: 200 проєктів по 60 статусів — це вже понад мегабайт самими лише
// статусами, і знімок просто не записався б. Стелі нижче дають ~500 KiB у
// найгіршому випадку, з подвійним запасом.
//
// Опис проєкту не зберігається взагалі: екран його не малює, а importer читає
// проєкти власним запитом до YouTrack, не з кешу.
const DISCOVERY_USER_LIMIT = 600;
const DISCOVERY_PROJECT_LIMIT = 120;
const DISCOVERY_STATUS_LIMIT = 40;

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

/**
 * Відключення прибирає все, що стосувалося цього YouTrack, а не лише токен.
 *
 * Знімок і вибір — не таємниця, але лишати їх означає, що наступне підключення
 * покаже проєкти, прочитані колись давно, під новим токеном. Відновити їх
 * коштує один автоматичний перечит; заплутати ними — безкоштовно.
 *
 * Замінити токен, не втрачаючи нічого, — окрема дія («Змінити токен»), і саме
 * тому відключення може дозволити собі бути чистим розривом.
 */
export async function disconnectYouTrack(organizationId) {
  await Promise.all([
    connectionRef(organizationId).delete(),
    discoveryRef(organizationId).delete(),
    planRef(organizationId).delete(),
  ]);
}

export async function youTrackClientFor(organizationId) {
  const snapshot = await connectionRef(organizationId).get();
  if (!snapshot.exists) throw new Error('YouTrack не підключено');
  const data = snapshot.data();
  if (!data.tokenBox || !data.baseUrl) throw new Error('Підключення YouTrack пошкоджене');

  let token;
  try {
    token = open(data.tokenBox);
  } catch (error) {
    // A stored token that no longer decrypts — the encryption key was rotated,
    // or the document was written by a deployment holding a different one. Only
    // this layer knows what the box held, so only this layer can say what to do
    // about it; unhandled, the reader got Node's own English sentence about a
    // GCM tag, printed under a progress bar in the migration screen.
    if (error instanceof SealedBoxUnreadableError) {
      throw new Error(
        'Підключення YouTrack пошкоджене: збережений токен більше не вдається прочитати. '
        + 'Відключіть YouTrack і підключіть його знову — перенесені задачі залишаться на місці.',
      );
    }
    throw error;
  }

  return {
    connection: data,
    client: new YouTrackClient({ baseUrl: data.baseUrl, token }),
  };
}

/**
 * Цільові статуси QuickTeam — завжди свіжі, ніколи не з кешу.
 *
 * Одне читання документа налаштувань. Зберігати їх поруч зі знімком YouTrack
 * було б дешевше на одне читання й неправильно по суті: workflow редагують у
 * сусідній вкладці, і кешований список призначень означав би вибір, що вказує
 * на статус, якого вже немає, без жодної ознаки цього на екрані.
 */
async function targetStatusesFor(organizationId) {
  const workflowSnapshot = await getAdminDb().collection('organizations').doc(organizationId)
    .collection('settings').doc('workflow').get();
  const savedStatuses = workflowSnapshot.data()?.statuses;
  const workflowStatuses = Array.isArray(savedStatuses) && savedStatuses.length
    ? savedStatuses.filter(status => status?.id)
    : DEFAULT_STATUS_IDS.map(id => ({ id, label: statusLabel(id) }));
  const categories = statusCategoryMap(workflowStatuses);
  return workflowStatuses.map(status => ({
    id: String(status.id),
    label: String(status.label || status.id),
    category: categories.get(status.id) || '',
  }));
}

/**
 * Збережений знімок, якщо він від цього ж підключення.
 *
 * `connectionId` — це хеш адреси, тож знімок від іншого YouTrack ніколи не
 * видається за поточний: підключили інший сервер — екран чесно каже, що ще
 * нічого не читав, замість показати чужі проєкти під новою адресою.
 */
export async function readYouTrackDiscovery(organizationId, connectionId) {
  const [snapshot, targetStatuses] = await Promise.all([
    discoveryRef(organizationId).get(),
    targetStatusesFor(organizationId),
  ]);
  const data = snapshot.exists ? snapshot.data() : null;
  if (!data || (connectionId && data.connectionId !== connectionId)) {
    return { state: 'none', targetStatuses, projects: [], users: [] };
  }
  return {
    state: 'ready',
    connectionId: data.connectionId || '',
    readAt: data.readAt?.toDate?.().toISOString() || null,
    targetStatuses,
    projects: data.projects || [],
    users: data.users || [],
    usersTotal: data.usersTotal || (data.users || []).length,
    usersTruncated: data.usersTruncated === true,
    projectsTruncated: data.projectsTruncated === true,
  };
}

/** Читає YouTrack наново, зберігає знімок і повертає його в тій самій формі. */
export async function refreshYouTrackDiscovery(organizationId) {
  const discovery = await discoverYouTrack(organizationId);
  const projects = discovery.projects.slice(0, DISCOVERY_PROJECT_LIMIT).map(project => ({
    id: project.id,
    name: project.name,
    shortName: project.shortName,
    statusesPartial: project.statusesPartial === true,
    statuses: (project.statuses || []).slice(0, DISCOVERY_STATUS_LIMIT),
    statusesTruncated: (project.statuses || []).length > DISCOVERY_STATUS_LIMIT,
  }));
  const activeUsers = discovery.users.filter(user => !user.banned);
  const users = activeUsers.slice(0, DISCOVERY_USER_LIMIT).map(user => ({
    id: user.id,
    login: user.login,
    name: user.name,
    email: user.email,
  }));
  await discoveryRef(organizationId).set({
    connectionId: discovery.connectionId,
    projects,
    users,
    usersTotal: activeUsers.length,
    usersTruncated: activeUsers.length > DISCOVERY_USER_LIMIT,
    projectsTruncated: discovery.projects.length > DISCOVERY_PROJECT_LIMIT,
    readAt: FieldValue.serverTimestamp(),
  });
  return {
    state: 'ready',
    connectionId: discovery.connectionId,
    readAt: new Date().toISOString(),
    targetStatuses: discovery.targetStatuses,
    projects,
    users,
    usersTotal: activeUsers.length,
    usersTruncated: activeUsers.length > DISCOVERY_USER_LIMIT,
    projectsTruncated: discovery.projects.length > DISCOVERY_PROJECT_LIMIT,
  };
}

/**
 * Збережений вибір: що переносимо, куди і кого до кого прив'язано.
 *
 * Він живе на сервері з однієї причини — щоб перезавантаження сторінки нічого
 * не стирало. Останній запис перемагає: вибір належить організації, а не сеансу,
 * і домовлятися про версію документа через галочку в списку — це нова поломка
 * замість старої. Хто й коли міняв, видно в самому рядку.
 */
export async function readYouTrackPlan(organizationId, connectionId) {
  const snapshot = await planRef(organizationId).get();
  const data = snapshot.exists ? snapshot.data() : null;
  if (!data || (connectionId && data.connectionId !== connectionId)) return null;
  return {
    connectionId: data.connectionId || '',
    selectedProjectIds: data.selectedProjectIds || [],
    projectMappings: data.projectMappings || {},
    statusFilters: data.statusFilters || {},
    statusMappings: data.statusMappings || {},
    userMappings: data.userMappings || {},
    updatedBy: data.updatedBy || '',
    updatedAt: data.updatedAt?.toDate?.().toISOString() || null,
  };
}

function boundedRecord(value, limit) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, limit).map(([key, entry]) => [
    String(key).slice(0, 200),
    entry,
  ]));
}

export async function writeYouTrackPlan({ organizationId, connectionId, plan, userId }) {
  const selectedProjectIds = [...new Set((plan?.selectedProjectIds || [])
    .map(value => String(value || '').trim())
    .filter(Boolean))].slice(0, DISCOVERY_PROJECT_LIMIT);
  const statusFilters = Object.fromEntries(
    Object.entries(boundedRecord(plan?.statusFilters, DISCOVERY_PROJECT_LIMIT)).map(([key, value]) => [
      key,
      [...new Set((Array.isArray(value) ? value : [])
        .map(entry => String(entry || '').trim().slice(0, 200))
        .filter(Boolean))].slice(0, DISCOVERY_STATUS_LIMIT),
    ]),
  );
  const statusMappings = Object.fromEntries(
    Object.entries(boundedRecord(plan?.statusMappings, DISCOVERY_PROJECT_LIMIT)).map(([key, value]) => [
      key,
      Object.fromEntries(Object.entries(boundedRecord(value, DISCOVERY_STATUS_LIMIT))
        .map(([source, target]) => [source, String(target || '').slice(0, 200)])),
    ]),
  );
  const payload = {
    connectionId,
    selectedProjectIds,
    projectMappings: Object.fromEntries(
      Object.entries(boundedRecord(plan?.projectMappings, DISCOVERY_PROJECT_LIMIT))
        .map(([key, value]) => [key, String(value || 'create').slice(0, 200)]),
    ),
    statusFilters,
    statusMappings,
    userMappings: Object.fromEntries(
      Object.entries(boundedRecord(plan?.userMappings, DISCOVERY_USER_LIMIT))
        .map(([key, value]) => [key, String(value || 'external').slice(0, 200)]),
    ),
    updatedBy: userId,
    updatedAt: FieldValue.serverTimestamp(),
  };
  await planRef(organizationId).set(payload);
  return { ...payload, updatedAt: new Date().toISOString() };
}

export async function discoverYouTrack(organizationId) {
  const { client, connection } = await youTrackClientFor(organizationId);
  const [projects, users, targetStatuses] = await Promise.all([
    client.projects(),
    client.users(),
    targetStatusesFor(organizationId),
  ]);
  const stateBundleIds = [...new Set(projects.flatMap(project => (
    (project.customFields || [])
      .filter(isYouTrackStateField)
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
  const bundleStatusesByProject = new Map(projects.map(project => [
    String(project.id),
    (project.customFields || [])
      .filter(isYouTrackStateField)
      .flatMap(field => stateBundles.get(String(field?.bundle?.id || ''))?.values || []),
  ]));
  const observedIssuesByProject = new Map();
  const projectsNeedingFallback = projects.filter(project => (
    project?.id
    && !project.archived
    && (bundleStatusesByProject.get(String(project.id)) || []).length === 0
  ));
  // Tokens that can read/import issues do not necessarily have permission to
  // read admin bundles. Fall back to the state values on the issues themselves
  // in small batches so the picker never disappears merely because of 403/404.
  //
  // Стеля тут навмисна й вужча, ніж у черги імпорту. Розвідці потрібен перелік
  // статусів, а не кожна задача, і поки вона брала ті самі 50 000, один великий
  // проєкт означав п'ятсот послідовних сторінок — довше, ніж узагалі живе
  // запит. Проєкт, який у стелю не вліз, каже про це сам: `statusesPartial`
  // виходить на екран окремим реченням, бо статус, який трапляється лише в
  // старих задачах, у такий перелік не потрапить.
  for (let index = 0; index < projectsNeedingFallback.length; index += 4) {
    const batch = projectsNeedingFallback.slice(index, index + 4);
    const issueLists = await Promise.all(batch.map(
      project => client.issueStubs(project.shortName, YOUTRACK_DISCOVERY_PROBE),
    ));
    batch.forEach((project, projectIndex) => {
      observedIssuesByProject.set(String(project.id), issueLists[projectIndex] || []);
    });
  }
  return {
    connectionId: connection.connectionId,
    targetStatuses,
    projects: projects
      .filter(project => project?.id && !project.archived)
      .map(project => ({
        id: String(project.id),
        name: String(project.name || project.shortName || 'Без назви'),
        shortName: String(project.shortName || project.id),
        description: String(project.description || ''),
        archived: project.archived === true,
        statusesPartial:
          (observedIssuesByProject.get(String(project.id)) || []).length >= YOUTRACK_DISCOVERY_PROBE.limit,
        statuses: mergeYouTrackStatuses(
          bundleStatusesByProject.get(String(project.id)),
          observedIssuesByProject.get(String(project.id)),
        ),
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
