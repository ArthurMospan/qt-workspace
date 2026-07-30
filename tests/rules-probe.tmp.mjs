import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

let environment;

before(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'quickteam-rules-probe',
    firestore: {
      rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  });
});

after(async () => { await environment?.cleanup(); });

async function seed({ projectCount, linksPerProject }) {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'organizations', 'org-a'), { ownerId: 'owner-a', name: 'Org A' });
    await setDoc(doc(db, 'orgMemberships', 'org-a_owner-a'), {
      id: 'org-a_owner-a', orgId: 'org-a', userId: 'owner-a', role: 'owner',
    });
    for (let p = 0; p < projectCount; p += 1) {
      await setDoc(doc(db, 'projects', `project-${p}`), {
        organizationId: 'org-a', name: `P${p}`, status: 'active', team: ['owner-a'],
      });
      for (let l = 0; l < linksPerProject; l += 1) {
        await setDoc(doc(db, 'issueLinks', `link-${p}-${l}`), {
          organizationId: 'org-a', projectId: `project-${p}`,
          relationType: 'blocks', sourceIssueId: `s${p}${l}`, targetIssueId: `t${p}${l}`,
        });
      }
    }
  });
}

async function probe(label, uid, build) {
  const context = environment.authenticatedContext(uid);
  try {
    const snap = await getDocs(build(context.firestore()));
    console.log(`OK     ${label} -> ${snap.size} docs`);
  } catch (error) {
    console.log(`DENIED ${label} -> ${error.code || error.message}`);
  }
}

const orgWide = db => query(collection(db, 'issueLinks'), where('organizationId', '==', 'org-a'));

test('how many distinct projects can an org-wide link query survive', async () => {
  for (const projectCount of [1, 2, 3, 4, 5]) {
    await seed({ projectCount, linksPerProject: 3 });
    await probe(`owner, ${projectCount} project(s) x3 links`, 'owner-a', orgWide);
  }
  await seed({ projectCount: 1, linksPerProject: 30 });
  await probe('owner, 1 project x30 links', 'owner-a', orgWide);
});
