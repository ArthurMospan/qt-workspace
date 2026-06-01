import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'quickteam-me',
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (err) {
      console.error('[API Projects] Token verification failed:', err);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    const userId = decodedToken.uid;
    const body = await req.json();
    const { name, description, visibility, organizationId } = body;

    if (!name || !organizationId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = admin.firestore();

    // 1. Verify plan and limits
    const orgRef = db.collection('organizations').doc(organizationId);
    const orgSnap = await orgRef.get();
    
    if (!orgSnap.exists) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    
    const orgPlan = orgSnap.data().plan || 'free';
    
    if (orgPlan !== 'pro') {
      const projectsSnap = await db.collection('projects')
        .where('organizationId', '==', organizationId)
        .where('status', '==', 'active')
        .get();
        
      if (projectsSnap.size >= 3) {
        return NextResponse.json({ 
          error: 'Ліміт проєктів вичерпано. Перейдіть на Pro план.' 
        }, { status: 403 });
      }
    }

    // 2. Create the project
    const payload = {
      name: name.trim(),
      description: description ? description.trim() : '',
      visibility: visibility || 'internal',
      organizationId,
      team: [userId],
      status: 'active',
      progress: 0,
      stagesCount: 4,
      issueCounter: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: userId,
    };
    
    const projectRef = await db.collection('projects').add(payload);
    
    // 3. Create default stages
    const stageNames = ['Брифінг & Аналіз', 'Дизайн & UI/UX', 'Розробка', 'Тестування & Реліз'];
    const batch = db.batch();
    for (let i = 0; i < stageNames.length; i++) {
      const stageRef = db.collection('stages').doc();
      batch.set(stageRef, {
        label: `${String(i + 1).padStart(2, '0')}. ${stageNames[i]}`,
        status: i === 0 ? 'in-progress' : 'todo',
        projectId: projectRef.id,
        order: i,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    
    return NextResponse.json({ success: true, id: projectRef.id });
  } catch (error) {
    console.error('[API Projects Create Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
