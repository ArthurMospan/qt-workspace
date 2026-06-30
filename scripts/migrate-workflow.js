const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val.length) process.env[key.trim()] = val.join('=').trim().replace(/^['"]|['"]$/g, '');
});
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: 'quickteam-me',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  })
});

const db = admin.firestore();

async function run() {
  const orgs = await db.collection('organizations').get();
  for (const org of orgs.docs) {
    const docRef = db.doc(`organizations/${org.id}/settings/workflow`);
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data();
      if (data.statuses && !data.statuses.some(s => s.id === 'backlog')) {
        data.statuses.unshift({ id: 'backlog', label: 'Backlog', color: '#9a9a9a', emoji: '📋' });
        await docRef.update({ statuses: data.statuses });
        console.log('Added backlog to org', org.id);
      }
    }
  }
  console.log('Done');
}

run().catch(console.error);
