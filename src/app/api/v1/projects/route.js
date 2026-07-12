import { NextResponse } from 'next/server';
import { enforceRateLimit, getAdminDb, getOrganizationApiKeys, hashApiKey, isValidApiKey } from '@/lib/server/firebaseAdmin';

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
    if (!(await enforceRateLimit('integration-projects', `${organizationId}:${hashApiKey(apiKey)}`, 300, 60))) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
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
