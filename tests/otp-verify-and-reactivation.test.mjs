import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

// A six-digit code with five tries is a ceiling only if the five are counted
// one at a time. Read-compare-increment let a burst of parallel guesses all see
// «four so far»; and while `start` was limited per address and per IP,
// `verify` — the half a guesser actually calls — counted nothing.
test('the login code is compared and counted in one transaction, under a rate limit', async () => {
  const verify = await read('src/app/api/auth/email/verify/route.js');
  assert.match(verify, /enforceRateLimit\('auth-email-verify-email', email/);
  assert.match(verify, /enforceRateLimit\('auth-email-verify-ip', ip/);
  const transaction = verify.slice(verify.indexOf('runTransaction(async transaction'), verify.indexOf("if (verdict === 'expired')"));
  assert.match(transaction, /await transaction\.get\(otpRef\)/);
  assert.match(transaction, /safeCompareHex\(codeHash, otp\.codeHash\)/);
  assert.match(transaction, /transaction\.update\(otpRef, \{\s*attempts: FieldValue\.increment\(1\)/);
  // A right guess consumes the code inside the same transaction, before
  // anything is minted for it.
  assert.match(transaction, /transaction\.delete\(otpRef\);\s*return 'ok';/);
  assert.doesNotMatch(verify, /await otpRef\.(get|update|delete)\(/);
  // The rate limit is asked before the code document is read.
  assert.ok(verify.indexOf('enforceRateLimit(') < verify.indexOf('getEmailOtpRef(email)'));
});

// The plan is enforced where somebody is let in. Invitations, their acceptance
// and invite links count seats against the ceiling; «Повернути доступ» did
// not, so a workspace that had archived seats from a paid month could re-seat
// every one of them on Free. It counts the way the invitation route counts.
test('giving a seat back counts against the members ceiling like an invitation does', async () => {
  const [members, invitations] = await Promise.all([
    read('src/app/api/organizations/[organizationId]/members/[memberId]/route.js'),
    read('src/app/api/invitations/route.js'),
  ]);
  const reactivate = members.slice(members.indexOf('async function reactivateMember'), members.indexOf('export async function PATCH'));
  for (const source of [reactivate, invitations]) {
    assert.match(source, /countActiveMembers\(db, organizationId\)/);
    assert.match(source, /\.where\('status', '==', 'pending'\)\s*\.count\(\)/);
    assert.match(source, /planLimitRefusalResponse\(\s*organizationPlan\(organizationSnapshot\),\s*'members',\s*seatsTaken \+ pendingSeats,?\s*\)/);
  }
  assert.ok(reactivate.indexOf('planLimitRefusalResponse(') < reactivate.indexOf('await reactivateMembership('));
});
