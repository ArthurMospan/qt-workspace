import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Initialize Firebase Admin securely
if (!admin.apps.length) {
  try {
    const config = {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'quickteam-me',
    };
    
    // Add credentials if available (required for Vercel and local development)
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      config.credential = admin.credential.cert({
        projectId: config.projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      });
    }
    
    admin.initializeApp(config);
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

export async function POST(req) {
  try {
    const apiKey = req.headers.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json({ error: 'Unauthorized. Missing API Key.' }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, attachments, organizationId, projectId, metadata, reporter, priority } = body;

    if (!title || !organizationId) {
      return NextResponse.json({ error: 'Missing required fields: title, organizationId' }, { status: 400 });
    }

    const db = admin.firestore();

    // 1. Verify organization exists and validate API Key
    const orgRef = db.collection('organizations').doc(organizationId);
    const orgSnap = await orgRef.get();
    
    if (!orgSnap.exists) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const orgData = orgSnap.data();
    const apiKeys = orgData.apiKeys || [];
    
    // Check if the provided apiKey exists in the organization's valid apiKeys
    const isValidKey = apiKeys.some(key => key.token === apiKey && key.active !== false);

    if (!isValidKey) {
      return NextResponse.json({ error: 'Unauthorized. Invalid or revoked API Key for this organization.' }, { status: 401 });
    }

    // 2. Prepare task payload
    const payload = {
      issueKey: `BUG-${Date.now().toString().slice(-6)}`,
      title: title.trim(),
      description: description ? description.trim() : '',
      status: 'backlog', 
      columnId: 'backlog',
      priority: priority || 'high',
      type: 'bug',
      organizationId,
      projectId: projectId || null, 
      attachments: attachments || [],
      metadata: metadata || {},
      source: 'buggybag',
      order: 0,
      assigneeIds: [],
      reporterName: reporter || 'Buggy Bag Integration',
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
        taskUrl: payload.projectId ? `/workspace/${payload.projectId}/issue/${issueRef.id}` : `/workspace`
      },
      message: 'Task created successfully in QuickTeam'
    });

  } catch (error) {
    console.error('[API v1 Tasks Create Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
