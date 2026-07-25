import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import { admin, getAdminDb } from '@/lib/server/firebaseAdmin';
import { youTrackClientFor } from '@/lib/server/youtrackIntegration';
import {
  fieldMinutes,
  fieldPresentation,
  fieldTimestamp,
  firstFieldValue,
  mapYouTrackPriority,
  mapYouTrackStatus,
  mapYouTrackType,
  normalizeMappingKey,
  relationTypeFromYouTrack,
  serializeCustomFields,
  sourceUserId,
  sourceUserName,
  youTrackField,
} from '@/lib/utils/youtrackImport.mjs';

const DEFAULT_WORKFLOW = {
  statuses: [
    { id: 'backlog', label: 'Backlog' },
    { id: 'todo', label: 'To Do' },
    { id: 'in-progress', label: 'In Progress' },
    { id: 'done', label: 'Done', isDone: true },
  ],
  priorities: [
    { id: 'blocker', label: 'Blocker' },
    { id: 'high', label: 'High' },
    { id: 'medium', label: 'Medium' },
    { id: 'low', label: 'Low' },
  ],
  types: [
    { id: 'epic', label: 'Epic' },
    { id: 'feature', label: 'Feature' },
    { id: 'task', label: 'Task' },
    { id: 'bug', label: 'Bug' },
  ],
  labels: [],
};

const IMPORT_STEP_LEASE_MS = 90_000;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function hashId(...parts) {
  return createHash('sha256').update(parts.map(part => String(part || '')).join('|')).digest('hex');
}

function importJobRef(jobId) {
  return getAdminDb().collection('imports').doc(jobId);
}

function externalLinkRef(organizationId, connectionId, entityType, externalId) {
  return getAdminDb().collection('externalObjectLinks')
    .doc(hashId(organizationId, 'youtrack', connectionId, entityType, externalId));
}

function timestamp(value, fallback = null) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? admin.firestore.Timestamp.fromDate(date) : fallback;
}

function serializeJob(snapshot) {
  if (!snapshot.exists) return null;
  const data = snapshot.data();
  return {
    id: snapshot.id,
    organizationId: data.organizationId,
    status: data.status,
    phase: data.phase,
    totalIssues: data.totalIssues || 0,
    processedIssues: data.processedIssues || 0,
    failedIssues: data.failedIssues || 0,
    processedLinks: data.processedLinks || 0,
    skippedLinks: data.skippedLinks || 0,
    nextIndex: data.nextIndex || 0,
    sourceProjects: data.sourceProjects || [],
    warnings: data.warnings || [],
    lastError: data.lastError || '',
    createdAt: data.createdAt?.toDate?.().toISOString() || null,
    updatedAt: data.updatedAt?.toDate?.().toISOString() || null,
    completedAt: data.completedAt?.toDate?.().toISOString() || null,
  };
}

async function claimImportStep(jobRef, organizationId) {
  const leaseId = randomUUID();
  const now = Date.now();
  let claimedJob = null;
  let terminalSnapshot = null;
  let busySnapshot = null;

  await getAdminDb().runTransaction(async transaction => {
    const snapshot = await transaction.get(jobRef);
    if (!snapshot.exists || snapshot.data().organizationId !== organizationId) {
      throw new Error('Імпорт не знайдено');
    }

    const data = snapshot.data();
    if (data.status === 'completed') {
      terminalSnapshot = snapshot;
      return;
    }
    if (data.status === 'cancelled') throw new Error('Імпорт скасовано');

    const leaseUntil = data.stepLeaseUntil?.toMillis?.() || 0;
    if (data.stepLeaseId && leaseUntil > now) {
      busySnapshot = snapshot;
      return;
    }

    transaction.update(jobRef, {
      stepLeaseId: leaseId,
      stepLeaseUntil: admin.firestore.Timestamp.fromMillis(now + IMPORT_STEP_LEASE_MS),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    claimedJob = { id: snapshot.id, ...data };
  });

  return { leaseId, claimedJob, terminalSnapshot, busySnapshot };
}

async function commitClaimedStep(jobRef, leaseId, {
  jobUpdates = {},
  itemRef = null,
  itemUpdates = null,
} = {}) {
  await getAdminDb().runTransaction(async transaction => {
    const snapshot = await transaction.get(jobRef);
    if (!snapshot.exists || snapshot.data().stepLeaseId !== leaseId) return;

    const updates = { ...jobUpdates };
    if (snapshot.data().status === 'cancelled') {
      delete updates.status;
      if (jobUpdates.status === 'completed') {
        delete updates.phase;
        delete updates.completedAt;
      }
    }

    transaction.update(jobRef, {
      ...updates,
      stepLeaseId: admin.firestore.FieldValue.delete(),
      stepLeaseUntil: admin.firestore.FieldValue.delete(),
    });
    if (itemRef && itemUpdates) transaction.set(itemRef, itemUpdates, { merge: true });
  });
}

async function releaseImportStep(jobRef, leaseId) {
  await getAdminDb().runTransaction(async transaction => {
    const snapshot = await transaction.get(jobRef);
    if (!snapshot.exists || snapshot.data().stepLeaseId !== leaseId) return;
    transaction.update(jobRef, {
      stepLeaseId: admin.firestore.FieldValue.delete(),
      stepLeaseUntil: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}

async function writeInChunks(entries, writer) {
  const db = getAdminDb();
  for (let offset = 0; offset < entries.length; offset += 400) {
    const batch = db.batch();
    entries.slice(offset, offset + 400).forEach((entry, index) => writer(batch, entry, offset + index));
    await batch.commit();
  }
}

function cleanProjectPrefix(value) {
  const cleaned = String(value || '').toUpperCase().replace(/[^A-ZА-ЯІЇЄҐ0-9]/gu, '').slice(0, 8);
  return cleaned || 'YT';
}

function actorFor(user, job) {
  if (!user) return {
    id: 'external:youtrack:unknown',
    name: 'Користувач YouTrack',
    avatar: null,
    email: '',
    external: true,
    sourceId: 'unknown',
  };
  const externalId = sourceUserId(user) || 'unknown';
  const mapped = job.userMappings?.[externalId];
  const external = !mapped || mapped === 'external';
  return {
    id: external ? `external:youtrack:${job.connectionId}:${externalId}` : mapped,
    name: sourceUserName(user),
    avatar: user.avatarUrl || null,
    email: String(user.email || ''),
    external,
    sourceId: externalId,
  };
}

async function saveExternalActors(job, actors) {
  const unique = new Map(
    actors
      .filter(actor => actor?.external && actor.sourceId)
      .map(actor => [actor.sourceId, actor]),
  );
  if (!unique.size) return;
  await writeInChunks([...unique.values()], (batch, actor) => {
    const ref = getAdminDb().collection('externalActors')
      .doc(hashId(job.organizationId, job.connectionId, actor.sourceId));
    batch.set(ref, {
      provider: 'youtrack',
      organizationId: job.organizationId,
      connectionId: job.connectionId,
      externalId: actor.sourceId,
      name: actor.name,
      email: actor.email,
      avatar: actor.avatar,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

async function ensureTargetProject(job, sourceProject) {
  const db = getAdminDb();
  const configuredTarget = job.projectMappings?.[sourceProject.id];
  if (configuredTarget && configuredTarget !== 'create') {
    const snapshot = await db.collection('projects').doc(configuredTarget).get();
    if (!snapshot.exists || snapshot.data().organizationId !== job.organizationId) {
      throw new Error(`Проєкт-призначення для ${sourceProject.name} більше не існує`);
    }
    return snapshot.id;
  }

  const linkRef = externalLinkRef(job.organizationId, job.connectionId, 'project', sourceProject.id);
  const existingLink = await linkRef.get();
  if (existingLink.exists) {
    const target = await db.collection('projects').doc(existingLink.data().quickTeamId).get();
    if (target.exists && target.data().organizationId === job.organizationId) return target.id;
  }

  const projectRef = db.collection('projects').doc();
  const mappedTeam = [...new Set([
    job.createdBy,
    ...Object.values(job.userMappings || {}).filter(value => value && value !== 'external'),
  ])].slice(0, 100);
  await db.runTransaction(async transaction => {
    const [freshLink, organization] = await Promise.all([
      transaction.get(linkRef),
      transaction.get(db.collection('organizations').doc(job.organizationId)),
    ]);
    if (freshLink.exists) return;
    if (!organization.exists) throw new Error('Організацію не знайдено');
    if ((organization.data().plan || 'free') !== 'pro') {
      const activeProjects = await transaction.get(
        db.collection('projects')
          .where('organizationId', '==', job.organizationId)
          .where('status', '==', 'active'),
      );
      if (activeProjects.size >= 3) {
        throw new Error('Ліміт проєктів вичерпано. Зіставте імпорт з наявним проєктом або перейдіть на Pro.');
      }
    }
    transaction.create(projectRef, {
      name: sourceProject.name,
      description: sourceProject.description || `Імпортовано з YouTrack · ${sourceProject.shortName}`,
      issuePrefix: cleanProjectPrefix(sourceProject.shortName),
      visibility: 'internal',
      organizationId: job.organizationId,
      team: mappedTeam,
      status: 'active',
      stagesCount: 0,
      issueCounter: 0,
      source: 'youtrack',
      externalKey: sourceProject.shortName,
      createdBy: job.createdBy,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.create(linkRef, {
      provider: 'youtrack',
      organizationId: job.organizationId,
      connectionId: job.connectionId,
      entityType: 'project',
      externalId: sourceProject.id,
      externalReadableId: sourceProject.shortName,
      quickTeamId: projectRef.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.update(db.collection('organizations').doc(job.organizationId), {
      projectMutationVersion: admin.firestore.FieldValue.increment(1),
    });
  });

  const finalLink = await linkRef.get();
  return finalLink.exists ? finalLink.data().quickTeamId : projectRef.id;
}

function workflowValues(snapshot) {
  const data = snapshot.exists ? snapshot.data() : {};
  return {
    statuses: Array.isArray(data.statuses) && data.statuses.length ? data.statuses : DEFAULT_WORKFLOW.statuses,
    priorities: Array.isArray(data.priorities) && data.priorities.length ? data.priorities : DEFAULT_WORKFLOW.priorities,
    types: Array.isArray(data.types) && data.types.length ? data.types : DEFAULT_WORKFLOW.types,
    labels: Array.isArray(data.labels) ? data.labels : DEFAULT_WORKFLOW.labels,
  };
}

function sourceTags(issue) {
  return (issue.tags || []).map(tag => String(tag?.name || '')).filter(Boolean).slice(0, 50);
}

function labelIdsFor(tags, workflow) {
  const tagKeys = new Set(tags.map(normalizeMappingKey));
  return (workflow.labels || [])
    .filter(label => tagKeys.has(normalizeMappingKey(label.label || label.id)))
    .map(label => label.id)
    .slice(0, 20);
}

function issueAssignees(issue, job) {
  const value = youTrackField(issue, 'Assignee');
  const users = Array.isArray(value) ? value : value ? [value] : [];
  return users.map(user => actorFor(user, job));
}

async function uploadBuffer(bytes, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
    stream.end(bytes);
  });
}

async function importAttachments({ client, job, issue, existingAttachments = [] }) {
  const sourceAttachments = await client.attachments(issue.id);
  const existingBySource = new Map(
    existingAttachments.filter(item => item?.sourceId).map(item => [item.sourceId, item]),
  );
  const imported = [];
  const warnings = [];

  for (const attachment of sourceAttachments) {
    const sourceId = String(attachment.id || '');
    if (!sourceId || !attachment.url) continue;
    if (existingBySource.has(sourceId)) {
      imported.push(existingBySource.get(sourceId));
      continue;
    }
    try {
      const { bytes, contentType } = await client.downloadAttachment(attachment.url);
      const publicId = `yt_${hashId(job.connectionId, sourceId).slice(0, 32)}`;
      const result = await uploadBuffer(bytes, {
        folder: `quickteam/imports/${job.organizationId}`,
        public_id: publicId,
        resource_type: 'auto',
        overwrite: true,
      });
      imported.push({
        source: 'youtrack',
        sourceId,
        name: String(attachment.name || 'attachment').slice(0, 240),
        url: result.secure_url,
        size: Number(attachment.size || bytes.length),
        type: String(attachment.mimeType || contentType),
        storagePath: result.public_id,
        resourceType: result.resource_type,
      });
    } catch (error) {
      warnings.push(`Вкладення ${attachment.name || sourceId}: ${error.message}`);
    }
  }
  return { attachments: imported, warnings };
}

async function upsertIssue({ job, sourceProject, issue, targetProjectId, workflow, attachments }) {
  const db = getAdminDb();
  const projectRef = db.collection('projects').doc(targetProjectId);
  const linkRef = externalLinkRef(job.organizationId, job.connectionId, 'issue', issue.id);
  const existingLink = await linkRef.get();
  const existingIssue = existingLink.exists
    ? await db.collection('issues').doc(existingLink.data().quickTeamId).get()
    : null;

  const stateName = fieldPresentation(youTrackField(issue, 'State'));
  const priorityName = fieldPresentation(youTrackField(issue, 'Priority'));
  const typeName = fieldPresentation(youTrackField(issue, 'Type'));
  const status = mapYouTrackStatus(stateName, workflow.statuses);
  const priority = mapYouTrackPriority(priorityName, workflow.priorities);
  const type = mapYouTrackType(typeName, workflow.types);
  const reporter = actorFor(issue.reporter, job);
  const assigneeActors = issueAssignees(issue, job);
  const watcherActors = (issue.watchers?.users || []).map(user => actorFor(user, job));
  const tags = sourceTags(issue);
  const dueDate = fieldTimestamp(youTrackField(issue, 'Due Date'));
  const estimateMinutes = fieldMinutes(youTrackField(issue, 'Estimation'));
  const sourceCreatedAt = timestamp(issue.created, admin.firestore.Timestamp.now());
  const sourceUpdatedAt = timestamp(issue.updated, sourceCreatedAt);
  const doneStatus = workflow.statuses.find(item => item.id === status)?.isDone === true
    || status === 'done';

  const importedFields = {
    title: String(issue.summary || issue.idReadable || 'Без назви').trim().slice(0, 240),
    description: String(issue.description || '').slice(0, 50_000),
    columnId: status,
    status,
    priority,
    type,
    assigneeIds: assigneeActors.filter(actor => !actor.external).map(actor => actor.id).slice(0, 20),
    watcherIds: watcherActors.filter(actor => !actor.external).map(actor => actor.id).slice(0, 50),
    labelIds: labelIdsFor(tags, workflow),
    dueDate: dueDate ? timestamp(dueDate) : null,
    estimateMinutes,
    attachments,
    reporterId: reporter.id,
    reporterName: reporter.name,
    source: 'youtrack',
    sourceKey: String(issue.idReadable || issue.id),
    importMetadata: {
      provider: 'youtrack',
      connectionId: job.connectionId,
      externalId: String(issue.id),
      externalReadableId: String(issue.idReadable || ''),
      sourceProjectId: sourceProject.id,
      sourceProjectKey: sourceProject.shortName,
      sourceUrl: `${job.baseUrl}/issue/${encodeURIComponent(issue.idReadable || issue.id)}`,
      externalReporter: reporter.external ? reporter : null,
      externalAssignees: assigneeActors.filter(actor => actor.external),
      externalWatchers: watcherActors.filter(actor => actor.external),
      tags,
      customFields: serializeCustomFields(issue.customFields),
      adapterVersion: 1,
      mappingVersion: 1,
    },
    createdAt: sourceCreatedAt,
    updatedAt: sourceUpdatedAt,
    ...(doneStatus ? { completedAt: timestamp(issue.resolved || issue.updated, sourceUpdatedAt) } : {}),
  };

  if (existingIssue?.exists) {
    await existingIssue.ref.set(importedFields, { merge: true });
    await linkRef.set({
      externalUpdatedAt: sourceUpdatedAt,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { issueId: existingIssue.id, created: false, actors: [reporter, ...assigneeActors, ...watcherActors] };
  }

  const issueRef = db.collection('issues').doc();
  await db.runTransaction(async transaction => {
    const [freshLink, project] = await Promise.all([
      transaction.get(linkRef),
      transaction.get(projectRef),
    ]);
    if (freshLink.exists) return;
    if (!project.exists || project.data().organizationId !== job.organizationId) {
      throw new Error('Проєкт-призначення не знайдено');
    }
    const next = (project.data().issueCounter || 0) + 1;
    const issueKey = `${cleanProjectPrefix(project.data().issuePrefix || project.data().name)}-${next}`;
    transaction.create(issueRef, {
      ...importedFields,
      organizationId: job.organizationId,
      projectId: targetProjectId,
      issueKey,
      sprintId: null,
      parentEpicId: null,
      subtasks: [],
      order: next,
      createdBy: job.createdBy,
    });
    transaction.update(projectRef, {
      issueCounter: next,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.create(linkRef, {
      provider: 'youtrack',
      organizationId: job.organizationId,
      connectionId: job.connectionId,
      entityType: 'issue',
      externalId: String(issue.id),
      externalReadableId: String(issue.idReadable || ''),
      quickTeamId: issueRef.id,
      externalUpdatedAt: sourceUpdatedAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.create(issueRef.collection('audit').doc(`import_${hashId(job.connectionId, issue.id).slice(0, 24)}`), {
      userId: job.createdBy,
      userName: 'YouTrack Import',
      action: 'imported',
      from: String(issue.idReadable || issue.id),
      to: issueKey,
      createdAt: sourceCreatedAt,
    });
  });
  const finalLink = await linkRef.get();
  return {
    issueId: finalLink.exists ? finalLink.data().quickTeamId : issueRef.id,
    created: true,
    actors: [reporter, ...assigneeActors, ...watcherActors],
  };
}

async function importComments({ job, issueId, comments }) {
  if (!comments.length) return [];
  const actors = [];
  await writeInChunks(comments, (batch, comment) => {
    const actor = actorFor(comment.author, job);
    actors.push(actor);
    const ref = getAdminDb().collection('issues').doc(issueId).collection('comments')
      .doc(`yt_${hashId(job.connectionId, comment.id).slice(0, 36)}`);
    batch.set(ref, {
      authorId: actor.id,
      authorName: actor.name,
      authorAvatar: actor.avatar,
      text: comment.deleted ? '[Коментар видалено в YouTrack]' : String(comment.text || '').slice(0, 50_000),
      attachments: [],
      readBy: [],
      replyTo: null,
      source: 'youtrack',
      sourceId: String(comment.id),
      createdAt: timestamp(comment.created, admin.firestore.Timestamp.now()),
      ...(comment.updated && comment.updated !== comment.created ? { editedAt: timestamp(comment.updated) } : {}),
    }, { merge: true });
  });
  await getAdminDb().collection('issues').doc(issueId).set({ commentCount: comments.length }, { merge: true });
  return actors;
}

async function importWorkItems({ job, issueId, projectId, workItems }) {
  const validItems = workItems.filter(item => {
    const minutes = Number(item.duration?.minutes || 0);
    return Number.isFinite(minutes) && minutes > 0;
  });
  if (!validItems.length) return [];
  const actors = [];
  await writeInChunks(validItems, (batch, item) => {
    const actor = actorFor(item.author || item.creator, job);
    actors.push(actor);
    const minutes = Number(item.duration?.minutes || 0);
    const ref = getAdminDb().collection('timeLogs')
      .doc(`yt_${hashId(job.connectionId, item.id).slice(0, 36)}`);
    batch.set(ref, {
      issueId,
      projectId,
      userId: actor.id,
      organizationId: job.organizationId,
      spentMinutes: Math.round(minutes),
      description: String(item.text || item.type?.name || '').slice(0, 5_000),
      loggedAt: timestamp(item.date || item.created, admin.firestore.Timestamp.now()),
      source: 'youtrack',
      sourceId: String(item.id),
      externalActor: actor.external ? actor : null,
    }, { merge: true });
  });
  return actors;
}

async function enqueueLinks(jobRef, job, sourceIssue, links) {
  const rows = links.flatMap(link => (link.issues || []).flatMap(target => {
    if (!target?.id || String(target.id) === String(sourceIssue.id)) return [];
    const relationType = relationTypeFromYouTrack(link.linkType, link.direction);
    const id = hashId(job.connectionId, sourceIssue.id, target.id, relationType);
    return [{
      id,
      sourceExternalId: String(sourceIssue.id),
      targetExternalId: String(target.id),
      targetReadableId: String(target.idReadable || ''),
      relationType,
      externalRelation: String(link.linkType?.name || ''),
    }];
  }));
  if (!rows.length) return;
  const refs = rows.map(row => jobRef.collection('links').doc(row.id));
  const existing = await getAdminDb().getAll(...refs);
  const missing = rows.filter((row, index) => !existing[index].exists);
  await writeInChunks(missing, (batch, row) => {
    batch.create(jobRef.collection('links').doc(row.id), {
      ...row,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}

async function processIssue(jobRef, job, queueItem) {
  const { client } = await youTrackClientFor(job.organizationId);
  const sourceProject = job.sourceProjects.find(project => project.id === queueItem.sourceProjectId);
  if (!sourceProject) throw new Error('Джерельний проєкт не знайдено у job');
  const targetProjectId = await ensureTargetProject(job, sourceProject);
  const issue = await client.issue(queueItem.sourceIssueId);
  const issueLink = await externalLinkRef(job.organizationId, job.connectionId, 'issue', issue.id).get();
  const existingIssue = issueLink.exists
    ? await getAdminDb().collection('issues').doc(issueLink.data().quickTeamId).get()
    : null;
  const [workflowSnapshot, comments, workItems, links, attachmentResult] = await Promise.all([
    getAdminDb().collection('organizations').doc(job.organizationId).collection('settings').doc('workflow').get(),
    client.comments(issue.id),
    client.workItems(issue.id),
    client.links(issue.id),
    importAttachments({
      client,
      job,
      issue,
      existingAttachments: existingIssue?.exists ? existingIssue.data().attachments || [] : [],
    }),
  ]);
  const workflow = workflowValues(workflowSnapshot);
  const saved = await upsertIssue({
    job,
    sourceProject,
    issue,
    targetProjectId,
    workflow,
    attachments: attachmentResult.attachments,
  });
  const [commentActors, workItemActors] = await Promise.all([
    importComments({ job, issueId: saved.issueId, comments }),
    importWorkItems({ job, issueId: saved.issueId, projectId: targetProjectId, workItems }),
  ]);
  await Promise.all([
    saveExternalActors(job, [...saved.actors, ...commentActors, ...workItemActors]),
    enqueueLinks(jobRef, job, issue, links),
  ]);
  return {
    issueId: saved.issueId,
    created: saved.created,
    warnings: attachmentResult.warnings,
  };
}

async function processPendingLink(jobRef, job) {
  const pending = await jobRef.collection('links').where('status', '==', 'pending').limit(1).get();
  if (pending.empty) return null;
  const rowSnapshot = pending.docs[0];
  const row = rowSnapshot.data();
  const [source, target] = await Promise.all([
    externalLinkRef(job.organizationId, job.connectionId, 'issue', row.sourceExternalId).get(),
    externalLinkRef(job.organizationId, job.connectionId, 'issue', row.targetExternalId).get(),
  ]);
  if (!source.exists || !target.exists || source.data().quickTeamId === target.data().quickTeamId) {
    await rowSnapshot.ref.update({
      status: 'skipped',
      reason: 'Пов’язана задача не входить до імпорту',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { skipped: true };
  }

  const sourceId = source.data().quickTeamId;
  const targetId = target.data().quickTeamId;
  const forwardId = hashId(job.organizationId, sourceId, targetId, row.relationType);
  const reverseType = {
    blocks: 'is-blocked-by',
    'is-blocked-by': 'blocks',
    duplicates: 'duplicates',
    'subtask-of': 'subtask-of',
    'relates-to': 'relates-to',
  }[row.relationType] || 'relates-to';
  const reverseId = hashId(job.organizationId, targetId, sourceId, reverseType);
  const batch = getAdminDb().batch();
  batch.set(getAdminDb().collection('issueLinks').doc(forwardId), {
    organizationId: job.organizationId,
    sourceIssueId: sourceId,
    targetIssueId: targetId,
    relationType: row.relationType,
    source: 'youtrack',
    externalRelation: row.externalRelation,
    createdBy: job.createdBy,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  batch.set(getAdminDb().collection('issueLinks').doc(reverseId), {
    organizationId: job.organizationId,
    sourceIssueId: targetId,
    targetIssueId: sourceId,
    relationType: reverseType,
    source: 'youtrack',
    externalRelation: row.externalRelation,
    createdBy: job.createdBy,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  batch.update(rowSnapshot.ref, {
    status: 'completed',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await batch.commit();
  return { skipped: false };
}

export async function prepareYouTrackImport({
  organizationId,
  userId,
  selectedProjectIds,
  projectMappings = {},
  userMappings = {},
}) {
  const selected = [...new Set((selectedProjectIds || []).filter(Boolean))].slice(0, 20);
  if (!selected.length) throw new Error('Оберіть хоча б один проєкт YouTrack');
  const { client, connection } = await youTrackClientFor(organizationId);
  const allProjects = await client.projects();
  const sourceProjects = allProjects
    .filter(project => selected.includes(String(project.id)) && !project.archived)
    .map(project => ({
      id: String(project.id),
      name: String(project.name || project.shortName || 'Без назви'),
      shortName: String(project.shortName || project.id),
      description: String(project.description || ''),
    }));
  if (sourceProjects.length !== selected.length) throw new Error('Один із вибраних проєктів недоступний');

  const mappedUids = [...new Set(Object.values(userMappings).filter(value => value && value !== 'external'))];
  if (mappedUids.length) {
    const memberships = await getAdminDb().getAll(
      ...mappedUids.map(uid => getAdminDb().collection('orgMemberships').doc(`${organizationId}_${uid}`)),
    );
    if (memberships.some((snapshot, index) => (
      !snapshot.exists || snapshot.data().orgId !== organizationId || snapshot.data().userId !== mappedUids[index]
    ))) {
      throw new Error('Один із користувачів більше не належить до організації');
    }
  }

  const targetIds = [...new Set(
    Object.values(projectMappings).filter(value => value && value !== 'create'),
  )];
  if (targetIds.length) {
    const targets = await getAdminDb().getAll(
      ...targetIds.map(id => getAdminDb().collection('projects').doc(id)),
    );
    if (targets.some(snapshot => !snapshot.exists || snapshot.data().organizationId !== organizationId)) {
      throw new Error('Один із проєктів-призначень недоступний');
    }
  }

  const queue = [];
  for (const sourceProject of sourceProjects) {
    const stubs = await client.issueStubs(sourceProject.shortName);
    stubs.forEach(issue => queue.push({
      sourceProjectId: sourceProject.id,
      sourceIssueId: String(issue.id),
      sourceReadableId: String(issue.idReadable || ''),
      title: String(issue.summary || issue.idReadable || ''),
      sourceUpdatedAt: issue.updated || null,
    }));
    if (queue.length > 100_000) throw new Error('Один імпорт обмежений 100 000 задач');
  }

  const jobRef = getAdminDb().collection('imports').doc();
  await jobRef.set({
    provider: 'youtrack',
    organizationId,
    connectionId: connection.connectionId,
    baseUrl: connection.baseUrl,
    createdBy: userId,
    status: 'prepared',
    phase: 'issues',
    sourceProjects,
    projectMappings: Object.fromEntries(sourceProjects.map(project => [
      project.id,
      projectMappings[project.id] || 'create',
    ])),
    userMappings,
    totalIssues: queue.length,
    processedIssues: 0,
    failedIssues: 0,
    processedLinks: 0,
    skippedLinks: 0,
    nextIndex: 0,
    warnings: [],
    adapterVersion: 1,
    mappingVersion: 1,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await writeInChunks(queue, (batch, item, index) => {
    batch.create(jobRef.collection('items').doc(String(index).padStart(8, '0')), {
      ...item,
      index,
      status: 'pending',
    });
  });
  return serializeJob(await jobRef.get());
}

export async function runYouTrackImportStep({ organizationId, jobId }) {
  const jobRef = importJobRef(jobId);
  const {
    leaseId,
    claimedJob: job,
    terminalSnapshot,
    busySnapshot,
  } = await claimImportStep(jobRef, organizationId);
  if (terminalSnapshot) return serializeJob(terminalSnapshot);
  if (busySnapshot) return { ...serializeJob(busySnapshot), stepInProgress: true };

  try {
    if (job.phase === 'issues') {
      if ((job.nextIndex || 0) >= (job.totalIssues || 0)) {
        await commitClaimedStep(jobRef, leaseId, {
          jobUpdates: {
            phase: 'links',
            status: 'running',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        });
        return serializeJob(await jobRef.get());
      }

      const itemRef = jobRef.collection('items').doc(String(job.nextIndex || 0).padStart(8, '0'));
      const item = await itemRef.get();
      if (!item.exists) {
        await commitClaimedStep(jobRef, leaseId, {
          jobUpdates: {
            nextIndex: admin.firestore.FieldValue.increment(1),
            failedIssues: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        });
        return serializeJob(await jobRef.get());
      }

      await itemRef.set({
        status: 'processing',
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      try {
        const result = await processIssue(jobRef, job, item.data());
        await commitClaimedStep(jobRef, leaseId, {
          itemRef,
          itemUpdates: {
            status: 'completed',
            quickTeamIssueId: result.issueId,
            result: result.created ? 'created' : 'updated',
            warnings: result.warnings,
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          jobUpdates: {
            status: 'running',
            nextIndex: admin.firestore.FieldValue.increment(1),
            processedIssues: admin.firestore.FieldValue.increment(1),
            ...(result.warnings.length ? { warnings: admin.firestore.FieldValue.arrayUnion(...result.warnings.slice(0, 10)) } : {}),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        });
      } catch (error) {
        const message = String(error.message || error).slice(0, 1_000);
        await commitClaimedStep(jobRef, leaseId, {
          itemRef,
          itemUpdates: {
            status: 'failed',
            error: message,
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          jobUpdates: {
            status: 'running',
            nextIndex: admin.firestore.FieldValue.increment(1),
            failedIssues: admin.firestore.FieldValue.increment(1),
            lastError: message,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        });
      }
      return serializeJob(await jobRef.get());
    }

    const linkResult = await processPendingLink(jobRef, job);
    if (!linkResult) {
      await commitClaimedStep(jobRef, leaseId, {
        jobUpdates: {
          status: 'completed',
          phase: 'completed',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      });
    } else {
      await commitClaimedStep(jobRef, leaseId, {
        jobUpdates: {
          processedLinks: admin.firestore.FieldValue.increment(linkResult.skipped ? 0 : 1),
          skippedLinks: admin.firestore.FieldValue.increment(linkResult.skipped ? 1 : 0),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      });
    }
    return serializeJob(await jobRef.get());
  } finally {
    await releaseImportStep(jobRef, leaseId);
  }
}

export async function getYouTrackImport({ organizationId, jobId }) {
  if (jobId) {
    const snapshot = await importJobRef(jobId).get();
    if (!snapshot.exists || snapshot.data().organizationId !== organizationId) return null;
    return serializeJob(snapshot);
  }
  const snapshot = await getAdminDb().collection('imports')
    .where('organizationId', '==', organizationId)
    .where('provider', '==', 'youtrack')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();
  return snapshot.docs.map(serializeJob);
}

export async function cancelYouTrackImport({ organizationId, jobId }) {
  const ref = importJobRef(jobId);
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.data().organizationId !== organizationId) {
    throw new Error('Імпорт не знайдено');
  }
  if (snapshot.data().status === 'completed') return serializeJob(snapshot);
  await ref.update({
    status: 'cancelled',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return serializeJob(await ref.get());
}
