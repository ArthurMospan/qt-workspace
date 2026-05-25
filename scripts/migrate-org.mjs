// scripts/migrate-org.mjs
// Reads the existing organizations/quickteam doc, extracts UIDs from members[],
// and writes back the flat memberUids[] field needed by OrgContext.
// Also stamps organizationId onto any projects that are missing it.
//
// Usage: node scripts/migrate-org.mjs
//
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc, arrayUnion, collection, getDocs, writeBatch } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            "AIzaSyA_600j8nCfF8bx34R0A4YZXjvHLcIW4_4",
  authDomain:        "quickteam-me.firebaseapp.com",
  projectId:         "quickteam-me",
  storageBucket:     "quickteam-me.firebasestorage.app",
  messagingSenderId: "108090865537",
  appId:             "1:108090865537:web:005666d7a09ede7894da80",
};

const ORG_ID = 'quickteam';

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

async function run() {
  console.log('🚀 Starting migration for org:', ORG_ID);

  // ─── 1. Add memberUids to org ───────────────────────────────────────────
  const orgRef  = doc(db, 'organizations', ORG_ID);
  const orgSnap = await getDoc(orgRef);

  if (!orgSnap.exists()) {
    console.error('❌ Organization not found:', ORG_ID);
    process.exit(1);
  }

  const orgData = orgSnap.data();
  const members = orgData.members || [];
  const memberUids = members.map(m => m.uid).filter(Boolean);

  console.log(`📋 Found ${memberUids.length} members:`, memberUids);

  if (orgData.memberUids && orgData.memberUids.length === memberUids.length) {
    console.log('✅ memberUids already up to date, skipping...');
  } else {
    await updateDoc(orgRef, { memberUids });
    console.log('✅ memberUids written to organizations/' + ORG_ID);
  }

  // ─── 2. Stamp organizationId on all projects that are missing it ───────
  const projectsSnap = await getDocs(collection(db, 'projects'));
  const toStamp = projectsSnap.docs.filter(d => !d.data().organizationId);

  if (toStamp.length === 0) {
    console.log('✅ All projects already have organizationId, nothing to stamp.');
  } else {
    console.log(`🔧 Stamping organizationId on ${toStamp.length} projects...`);
    const batch = writeBatch(db);
    toStamp.forEach(d => {
      batch.update(d.ref, { organizationId: ORG_ID });
    });
    await batch.commit();
    console.log(`✅ Done! Stamped ${toStamp.length} projects with organizationId="${ORG_ID}"`);
  }

  // ─── 3. Stamp organizationId on tasks that are missing it ──────────────
  const tasksSnap = await getDocs(collection(db, 'tasks'));
  const tasksToStamp = tasksSnap.docs.filter(d => !d.data().organizationId);
  if (tasksToStamp.length > 0) {
    console.log(`🔧 Stamping organizationId on ${tasksToStamp.length} tasks...`);
    const batchSize = 400;
    for (let i = 0; i < tasksToStamp.length; i += batchSize) {
      const chunk = tasksToStamp.slice(i, i + batchSize);
      const b = writeBatch(db);
      chunk.forEach(d => b.update(d.ref, { organizationId: ORG_ID }));
      await b.commit();
    }
    console.log(`✅ Stamped ${tasksToStamp.length} tasks.`);
  } else {
    console.log('✅ All tasks already have organizationId.');
  }

  // ─── 4. Stamp organizationId on issues that are missing it ─────────────
  const issuesSnap = await getDocs(collection(db, 'issues'));
  const issuesToStamp = issuesSnap.docs.filter(d => !d.data().organizationId);
  if (issuesToStamp.length > 0) {
    console.log(`🔧 Stamping organizationId on ${issuesToStamp.length} issues...`);
    const batchSize = 400;
    for (let i = 0; i < issuesToStamp.length; i += batchSize) {
      const chunk = issuesToStamp.slice(i, i + batchSize);
      const b = writeBatch(db);
      chunk.forEach(d => b.update(d.ref, { organizationId: ORG_ID }));
      await b.commit();
    }
    console.log(`✅ Stamped ${issuesToStamp.length} issues.`);
  } else {
    console.log('✅ All issues already have organizationId.');
  }

  console.log('\n🎉 Migration complete! Your workspace is ready for multi-tenancy.');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
