'use client';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// PUBLIC config for the QuickTeam+ project (quickteam-portal-prod). Not secrets;
// they ship to the browser like any Firebase web config. NEXT_PUBLIC_ => inlined
// at build time, so adding them in Vercel needs a redeploy.
const config = {
  apiKey: process.env.NEXT_PUBLIC_QTPLUS_FB_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_QTPLUS_FB_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_QTPLUS_FB_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_QTPLUS_FB_APP_ID,
};

const PORTAL_APP = 'qtplus-portal';

function portalApp() {
  if (!config.projectId) return null; // integration not configured -> inert
  const existing = getApps().find((a) => a.name === PORTAL_APP);
  return existing || initializeApp(config, PORTAL_APP);
}

export function getPortalAuth() {
  const app = portalApp();
  return app ? getAuth(app) : null;
}

export function getPortalDb() {
  const app = portalApp();
  return app ? getFirestore(app) : null;
}
