'use client';
// src/lib/migrations/runMigrations.js
// One-time migrations that run in browser context (as authenticated user).
// Each migration checks if it already ran before doing anything.
// Safe to call multiple times — idempotent.
import {
  doc, getDoc, updateDoc, collection, getDocs, writeBatch, setDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID || 'quickteam';
const MIGRATIONS_DOC = `systemMigrations/${ORG_ID}`;

async function hasRun(name) {
  try {
    const snap = await getDoc(doc(db, 'systemMigrations', ORG_ID));
    return snap.exists() && snap.data()?.[name] === true;
  } catch { return false; }
}

async function markDone(name) {
  await setDoc(doc(db, 'systemMigrations', ORG_ID), { [name]: true }, { merge: true });
}

// ─── Migration 001: Add memberUids array to organizations/quickteam ──────────
async function migration001_addMemberUids() {
  const name = 'm001_memberUids';
  if (await hasRun(name)) return;

  const orgRef  = doc(db, 'organizations', ORG_ID);
  const orgSnap = await getDoc(orgRef);
  if (!orgSnap.exists()) return;

  const members = orgSnap.data().members || [];
  const memberUids = members.map(m => m.uid).filter(Boolean);

  if (memberUids.length > 0) {
    await updateDoc(orgRef, { memberUids });
    console.log('[Migration 001] ✅ memberUids added:', memberUids);
  }

  await markDone(name);
}

// ─── Migration 002: Stamp organizationId on projects ────────────────────────
async function migration002_stampProjects() {
  const name = 'm002_stampProjects';
  if (await hasRun(name)) return;

  const snap = await getDocs(collection(db, 'projects'));
  const toStamp = snap.docs.filter(d => !d.data().organizationId);
  if (toStamp.length === 0) { await markDone(name); return; }

  const batch = writeBatch(db);
  toStamp.forEach(d => batch.update(d.ref, { organizationId: ORG_ID }));
  await batch.commit();

  console.log(`[Migration 002] ✅ Stamped ${toStamp.length} projects with organizationId`);
  await markDone(name);
}

// ─── Migration 003: Stamp organizationId on tasks ────────────────────────────
async function migration003_stampTasks() {
  const name = 'm003_stampTasks';
  if (await hasRun(name)) return;

  const snap = await getDocs(collection(db, 'tasks'));
  const toStamp = snap.docs.filter(d => !d.data().organizationId);
  if (toStamp.length === 0) { await markDone(name); return; }

  // Process in chunks of 400 (Firestore batch limit)
  for (let i = 0; i < toStamp.length; i += 400) {
    const batch = writeBatch(db);
    toStamp.slice(i, i + 400).forEach(d => batch.update(d.ref, { organizationId: ORG_ID }));
    await batch.commit();
  }

  console.log(`[Migration 003] ✅ Stamped ${toStamp.length} tasks`);
  await markDone(name);
}

// ─── Migration 004: Stamp organizationId on issues ───────────────────────────
async function migration004_stampIssues() {
  const name = 'm004_stampIssues';
  if (await hasRun(name)) return;

  const snap = await getDocs(collection(db, 'issues'));
  const toStamp = snap.docs.filter(d => !d.data().organizationId);
  if (toStamp.length === 0) { await markDone(name); return; }

  for (let i = 0; i < toStamp.length; i += 400) {
    const batch = writeBatch(db);
    toStamp.slice(i, i + 400).forEach(d => batch.update(d.ref, { organizationId: ORG_ID }));
    await batch.commit();
  }

  console.log(`[Migration 004] ✅ Stamped ${toStamp.length} issues`);
  await markDone(name);
}

// ─── Migration 005: Mark existing org as onboarded (skip wizard for existing users) ─
async function migration005_markOnboarded() {
  const name = 'm005_markOnboarded';
  if (await hasRun(name)) return;

  const orgRef  = doc(db, 'organizations', ORG_ID);
  const orgSnap = await getDoc(orgRef);
  if (!orgSnap.exists()) return;

  // Only mark as onboarded if org already has projects (i.e. is NOT brand new)
  const projectsSnap = await getDocs(collection(db, 'projects'));
  const hasProjects = projectsSnap.docs.some(d => d.data().organizationId === ORG_ID || !d.data().organizationId);

  if (hasProjects || orgSnap.data().onboarded === true) {
    await updateDoc(orgRef, { onboarded: true });
    console.log('[Migration 005] ✅ Existing org marked as onboarded');
  }

  await markDone(name);
}

// ─── Migration 006: Extract members to orgMemberships collection ────────────
async function migration006_extractOrgMemberships() {
  const name = 'm006_extractOrgMemberships';
  if (await hasRun(name)) return;

  const orgsSnap = await getDocs(collection(db, 'organizations'));
  if (orgsSnap.empty) { await markDone(name); return; }

  let extractedCount = 0;
  // Use a batch to write orgMemberships
  for (const orgDoc of orgsSnap.docs) {
    const orgData = orgDoc.data();
    const members = orgData.members || [];
    
    if (members.length > 0) {
      const batch = writeBatch(db);
      for (const m of members) {
        if (!m.uid) continue;
        const membershipId = `${orgDoc.id}_${m.uid}`;
        const membershipRef = doc(db, 'orgMemberships', membershipId);
        batch.set(membershipRef, {
          id: membershipId,
          orgId: orgDoc.id,
          userId: m.uid,
          role: m.role || 'member',
          joinedAt: m.joinedAt || new Date().toISOString(),
          hourlyRate: m.hourlyRate || 0
        }, { merge: true });
        extractedCount++;
      }
      await batch.commit();
      
      // Optionally remove members and memberUids from org document to save space
      // For safety during transition, we can leave them, but the plan is to rely on orgMemberships.
    }
  }

  console.log(`[Migration 006] ✅ Extracted ${extractedCount} memberships to orgMemberships collection`);
  await markDone(name);
}

// ─── Main runner ─────────────────────────────────────────────────────────────
export async function runMigrations() {
  try {
    console.log('[Migrations] 🚀 Running...');
    await migration001_addMemberUids();
    await migration002_stampProjects();
    await migration003_stampTasks();
    await migration004_stampIssues();
    await migration005_markOnboarded();
    await migration006_extractOrgMemberships();
    console.log('[Migrations] ✅ All done.');
  } catch (err) {
    // Non-fatal — log but don't crash the app
    console.warn('[Migrations] ⚠️ Error (non-fatal):', err.message);
  }
}
