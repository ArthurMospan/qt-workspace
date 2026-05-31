const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'quickteam-me'
});
const db = admin.firestore();

async function test() {
  try {
    const snap = await db.collection('organizations').limit(1).get();
    const activeOrgId = snap.docs[0].id;
    const ref = db.doc(`organizations/${activeOrgId}/settings/workflow`);
    
    console.log('Writing WITHOUT emoji...');
    try {
      await ref.set({ statuses: [{ id: 'test', label: 'Test', color: '#000' }] }, { merge: true });
      console.log('SUCCESS: Wrote without emoji');
    } catch (e) {
      console.log('FAIL: Wrote without emoji:', e.message);
    }
    
    console.log('Writing WITH emoji...');
    try {
      await ref.set({ statuses: [{ id: 'test', label: 'Test', color: '#000', emoji: '😁' }] }, { merge: true });
      console.log('SUCCESS: Wrote with emoji');
    } catch (e) {
      console.log('FAIL: Wrote with emoji:', e.message);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}
test();
