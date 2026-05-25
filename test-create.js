import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';

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
const auth = getAuth(app);
const db = getFirestore(app);

async function test() {
  try {
    // Need a test user to test auth rules!
    await signInWithEmailAndPassword(auth, 'test@example.com', 'testpassword');
    console.log('Logged in as:', auth.currentUser.uid);

    const docRef = await addDoc(collection(db, 'projects'), {
      name: 'Test Project',
      organizationId: 'quickteam',
      createdAt: serverTimestamp()
    });
    console.log('Project created:', docRef.id);
  } catch(e) {
    console.log('Error:', e.code, e.message);
  }
}

test().catch(console.error);
