const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'quickteam-me'
});
const db = admin.firestore();

async function test() {
  try {
    console.log('Fetching org...');
    const snap = await db.collection('organizations').limit(1).get();
    const activeOrgId = snap.docs[0].id;
    console.log('Using org:', activeOrgId);
    
    const ref = db.doc(`organizations/${activeOrgId}/settings/workflow`);
    const doc = await ref.get();
    console.log('Data exists:', doc.exists);
    console.log('Data:', doc.data());
  } catch (err) {
    console.error('Error:', err);
  }
}
test();
