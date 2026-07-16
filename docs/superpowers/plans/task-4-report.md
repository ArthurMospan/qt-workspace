# Task 4 Report: `/api/join` route + client migration

**Repo:** `c:\Users\Arthu\QuickTeam\qt`
**Branch:** `security/phase0-firestore-rules`
**Commit:** `ee184da` — "feat: move project join to server route, drop client-side writes"

## Files created/modified

- **Created** `src/app/api/join/route.js` — `POST` handler. Extracts `Authorization: Bearer <idToken>`, verifies it via `getAdminAuth().verifyIdToken()`, reads `inviteId` from the JSON body, calls `joinProject({ db: getAdminDb(), uid: decoded.uid, userName: decoded.name || null, userAvatar: decoded.picture || null, inviteId })`. Identity (`uid`, `name`, `picture`) comes exclusively from the verified decoded token, never from the request body — satisfies the security requirement. Maps `joinProject`'s error codes (`invalid_invite` 400, `invite_not_found` 404, `invite_inactive` 410, `project_not_found` 404) to Ukrainian user-facing messages, matching the plan's exact code. No role logic in the route, per the stated deviation — roles are clamped inside `joinProject` itself (`ALLOWED_INVITE_ROLES` allowlist, confirmed by reading `src/lib/server/joinProject.js`).
- **Modified** `src/app/(main)/join/page.js` — removed the direct Firestore imports (`doc/getDoc/updateDoc/arrayUnion/addDoc/collection/serverTimestamp`, `db`, `notifyTeam`) and replaced the client-side read-invite/read-project/write-team/write-message/notify sequence with a single `fetch('/api/join', ...)` call, sending the current user's ID token as a Bearer header. Removed the artificial 1500ms `setTimeout` delay (no longer needed — the server responds only after commit). Behavior preserved: already-a-member and success paths both still redirect to `/project/{id}`, same Ukrainian status/error strings.

## Lint

`npm run lint` output: **74 problems (49 errors, 25 warnings)** — identical count to the pre-existing baseline. Verified via `git stash` / re-lint / `git stash pop`: the exact same 74 problems exist on the branch tip *before* this change, in unrelated files (`Header.jsx`, `ProjectsPage.jsx`, `MediaViewer.jsx`, etc. — React Compiler ref/memoization rules, pre-existing across the codebase). Neither of the two files I touched gained any new lint issues:
- `src/app/api/join/route.js` — zero lint findings.
- `src/app/(main)/join/page.js` — one pre-existing error at line 23 (`setIsInAppBrowser` inside a `useEffect`, flagged by the React Compiler `set-state-in-effect` rule) which sits in code I did not touch (confirmed via `git diff` showing that line unchanged).

Conclusion: this change introduces **zero new lint errors or warnings**.

## Build

`npm run build` (Next.js 16.2.4, Turbopack): **succeeded**. Route table shows `ƒ /api/join` registered as a dynamic (server-rendered) route alongside the other `/api/*` routes, and `○ /join` / `ƒ /join/[id]` compiled fine. No TypeScript or compilation errors.

## What remains UNVERIFIED

**Step 5 (manual browser verification) was NOT performed.** I have no way to drive an interactive browser/Google OAuth session from this environment. Specifically NOT verified:
- Creating a project, generating an invite link, opening it as a different Google account, and confirming: successful join, redirect to `/project/{id}`, system message appearing in chat, notification landing for the owner.
- Re-opening the same invite link as the same account and confirming `alreadyMember: true` is returned with no duplicate `team` entry.
- That `getAdminAuth().verifyIdToken()` behaves correctly against the real `quickteam-portal-prod` project's tokens in a deployed (non-emulator) environment.

**This is an honest gap, not an oversight** — per the task's own instructions, an "I verified this" claim would be false. A human must run Step 5 manually (locally via `npm run dev`, then again on prod after deploy) before Task 5-7's rule closure ships, per the plan's explicit ordering constraint.

## Not done (out of scope per instructions)

- Step 7 (`git push` / deploy) was intentionally skipped — committed locally only, as instructed.
- Did not touch `firestore.rules` (Tasks 5-7).
- Did not touch unrelated pre-existing working-tree changes present before I started (`.gitignore` modification adding `.superpowers/`, untracked `firestore-debug.log` from earlier emulator runs) — left those out of my commit since they're not part of this task.

## Concerns

- None regarding the implementation itself — it follows the plan's code verbatim and correctly applies the stated deviation (no role logic in the route).
- The one real concern is procedural, not technical: Step 5 manual verification is a hard gate before Task 5-7 rule deployment, and it is still outstanding. Do not treat this report as clearance to proceed to rule closure.

---

# Defect Fix: Configuration error masking in `/api/join` (commit 62374c6)

**Issue:** `getAdminAuth()` was inside the try block guarding `verifyIdToken()`, causing configuration errors (missing `FIREBASE_SERVICE_ACCOUNT`, wrong project ID) to be silently rebranded as 401 "invalid session" instead of failing loudly per the guard's intent.

**Before:**
```js
let decoded;
try {
  decoded = await getAdminAuth().verifyIdToken(idToken);
} catch {
  return NextResponse.json({ error: 'Сесія недійсна. Увійдіть ще раз.' }, { status: 401 });
}
```

**After:**
```js
const auth = getAdminAuth();
let decoded;
try {
  decoded = await auth.verifyIdToken(idToken);
} catch (error) {
  console.error('[api/join] Token verification failed:', error.message);
  return NextResponse.json({ error: 'Сесія недійсна. Увійдіть ще раз.' }, { status: 401 });
}
```

**Build:** `npm run build` — succeeded. Route `/api/join` registered as dynamic (ƒ). Compilation: 0 errors.

**Command:** `git commit -m "fix: prevent configuration errors from being masked as auth failures in /api/join"`
