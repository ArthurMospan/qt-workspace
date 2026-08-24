import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ projectId: 'quickteam-me', credential: cert({
  projectId: 'quickteam-me',
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\n/g, '\n'),
}) });
const db = getFirestore();
const org = 'org_7wQNudIZ_1786645743669';
const projects = await db.collection('projects').where('organizationId','==',org).select().get();
const ids = projects.docs.map(d => d.id).slice(0, 10);
const since = new Date('2026-07-26T00:00:00Z');
const until = new Date('2026-08-25T00:00:00Z');
try {
  const snap = await db.collection('timeLogs')
    .where('organizationId','==',org).where('projectId','in', ids)
    .where('issueId','!=','')
    .where('loggedAt','>=', since).where('loggedAt','<', until).get();
  let m = 0; for (const d of snap.docs) m += d.data().spentMinutes || 0;
  console.log(`windowed task logs OK: logs=${snap.size} minutes=${m}`);
} catch (e) {
  console.log('windowed task logs FAILED code', e.code, String(e.details||e.message).slice(0,120));
}
process.exit(0);
