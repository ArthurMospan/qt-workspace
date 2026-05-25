import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  console.log('Testing without auth...');
  try {
    const snap = await getDoc(doc(db, 'systemMigrations', 'quickteam'));
    console.log('systemMigrations exists:', snap.exists());
  } catch(e) {
    console.log('systemMigrations error:', e.code);
  }

  try {
    const snap = await getDocs(query(collection(db, 'projects'), where('organizationId', '==', 'quickteam'), orderBy('createdAt', 'desc')));
    console.log('projects count:', snap.size);
  } catch(e) {
    console.log('projects error:', e.code, e.message);
  }
}

test().catch(console.error);
