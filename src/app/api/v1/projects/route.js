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

export async function GET(req) {
  try {
    const apiKey = req.headers.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json({ error: 'Unauthorized. Missing API Key.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing required query parameter: organizationId' }, { status: 400 });
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

    // 2. Fetch active projects for this organization
    const projectsSnap = await db.collection('projects')
      .where('organizationId', '==', organizationId)
      .where('status', '==', 'active')
      .get();
      
    const projects = [];
    projectsSnap.forEach(doc => {
      const data = doc.data();
      projects.push({
        id: doc.id,
        name: data.name,
      });
    });

    return NextResponse.json({ 
      success: true, 
      data: projects
    });

  } catch (error) {
    console.error('[API v1 Projects Fetch Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
