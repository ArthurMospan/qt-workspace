const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'quickteam-me'
});
const db = admin.firestore();

db.collection('projects').orderBy('createdAt', 'desc').limit(5).get()
  .then(snap => {
    console.log('--- LATEST 5 PROJECTS ---');
    snap.forEach(doc => {
      const data = doc.data();
      console.log(`ID: ${doc.id}`);
      console.log(`Name: ${data.name}`);
      console.log(`OrgId: ${data.organizationId}`);
      console.log(`Visibility: ${data.visibility}`);
      console.log(`Team: ${JSON.stringify(data.team)}`);
      console.log('---------------------------');
    });
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
