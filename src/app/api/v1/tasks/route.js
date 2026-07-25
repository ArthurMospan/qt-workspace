import { NextResponse } from 'next/server';
import { routeErrorResponse } from '@/lib/server/apiErrors';
import { randomUUID } from 'node:crypto';
import { admin, enforceRateLimit, getAdminDb, getOrganizationApiKeys, hashApiKey, isValidApiKey } from '@/lib/server/firebaseAdmin';
import {
  DEFAULT_PRIORITY_IDS,
  DEFAULT_STATUS_IDS,
  DEFAULT_TYPE_IDS,
  workflowIds,
} from '@/lib/utils/workflowDefaults.mjs';

export async function POST(req) {
  try {
    const apiKey = req.headers.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json({ error: 'Unauthorized. Missing API Key.' }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, attachments, organizationId, projectId, metadata, reporter, priority } = body;

    if (!title || !organizationId || title.trim().length > 240) {
      return NextResponse.json({ error: 'Missing required fields: title, organizationId' }, { status: 400 });
    }

    const db = getAdminDb();

    // 1. Verify organization exists and validate API Key
    const orgRef = db.collection('organizations').doc(organizationId);
    const orgSnap = await orgRef.get();
    
    if (!orgSnap.exists) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const orgData = orgSnap.data();
    const apiKeys = await getOrganizationApiKeys(organizationId, orgData);
    
    // Check if the provided apiKey exists in the organization's valid apiKeys
    const validApiKey = isValidApiKey(apiKeys, apiKey);

    if (!validApiKey) {
      return NextResponse.json({ error: 'Unauthorized. Invalid or revoked API Key for this organization.' }, { status: 401 });
    }
    if (!(await enforceRateLimit('integration-task', `${organizationId}:${hashApiKey(apiKey)}`, 120, 60))) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    if (projectId) {
      const projectSnap = await db.collection('projects').doc(projectId).get();
      if (!projectSnap.exists || projectSnap.data().organizationId !== organizationId) {
        return NextResponse.json({ error: 'Project does not belong to this organization' }, { status: 400 });
      }
    }

    const safeAttachments = (Array.isArray(attachments) ? attachments : []).slice(0, 10).flatMap(attachment => {
      if (!attachment || typeof attachment !== 'object') return [];
      try {
        const url = new URL(attachment.url);
        if (url.protocol !== 'https:') return [];
        return [{
          name: String(attachment.name || 'Attachment').slice(0, 180),
          url: url.toString(),
          type: String(attachment.type || '').slice(0, 100),
          size: Number.isFinite(attachment.size) ? Math.max(0, attachment.size) : null,
        }];
      } catch {
        return [];
      }
    });
    let safeMetadata = {};
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      const serializedMetadata = JSON.stringify(metadata);
      if (serializedMetadata.length <= 20_000) safeMetadata = JSON.parse(serializedMetadata);
    }

    // 2. Resolve the organization's workflow. Hardcoding 'backlog'/'bug' and
    // trusting the caller's priority dropped externally created tasks into a
    // column that may not exist in this org's board, where nobody ever sees
    // them.
    const workflowSnapshot = await orgRef.collection('settings').doc('workflow').get();
    const workflow = workflowSnapshot.data() || {};
    const statusIds = workflowIds(workflow.statuses, DEFAULT_STATUS_IDS);
    const priorityIds = workflowIds(workflow.priorities, DEFAULT_PRIORITY_IDS);
    const typeIds = workflowIds(workflow.types, DEFAULT_TYPE_IDS);
    const status = statusIds.includes('backlog') ? 'backlog' : statusIds[0];
    const resolvedPriority = priorityIds.includes(priority)
      ? priority
      : (priorityIds.includes('high') ? 'high' : priorityIds[0]);
    const resolvedType = typeIds.includes('bug') ? 'bug' : typeIds[0];

    const payload = {
      issueKey: `EXT-${randomUUID().slice(0, 8).toUpperCase()}`,
      title: title.trim(),
      description: description ? String(description).trim().slice(0, 50_000) : '',
      status,
      columnId: status,
      priority: resolvedPriority,
      type: resolvedType,
      organizationId,
      projectId: projectId || null, 
      attachments: safeAttachments,
      metadata: safeMetadata,
      source: 'buggybag',
      order: 0,
      assigneeIds: [],
      reporterName: reporter ? String(reporter).slice(0, 120) : 'Buggy Bag Integration',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    // 3. Save to Firestore
    const issueRef = await db.collection('issues').add(payload);
    
    // 4. Add audit log to make it look clean in activity feed
    await db.collection('issues').doc(issueRef.id).collection('audit').add({
      userId: null,
      userName: 'Buggy Bag Integration',
      action: 'експортував баг з Buggy Bag',
      from: null,
      to: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return NextResponse.json({ 
      success: true, 
      data: {
        taskId: issueRef.id,
        issueKey: payload.issueKey,
        taskUrl: payload.projectId ? `/${payload.projectId}/issue/${issueRef.id}` : `/`
      },
      message: 'Task created successfully in QuickTeam'
    });

  } catch (error) {
    return routeErrorResponse(error, { context: 'API v1 Tasks Create', fallbackMessage: 'Internal Server Error' });
  }
}
