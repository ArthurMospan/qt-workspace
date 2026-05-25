const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, orderBy, limit } = require('firebase/firestore');

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
});

const db = getFirestore(app);

getDocs(query(collection(db, 'projects'), limit(10)))
  .then(snap => {
    console.log('--- LATEST 10 PROJECTS ---');
    snap.docs.forEach(doc => {
      const data = doc.data();
      console.log(`ID: ${doc.id}`);
      console.log(`Name: ${data.name}`);
      console.log(`OrgId: ${data.organizationId}`);
      console.log(`Team: ${JSON.stringify(data.team)}`);
      console.log(`Visibility: ${data.visibility}`);
      console.log(`Status: ${data.status}`);
      console.log(`CreatedAt: ${data.createdAt ? (data.createdAt.toMillis ? new Date(data.createdAt.toMillis()).toISOString() : data.createdAt) : 'none'}`);
      console.log('---------------------------');
    });
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
