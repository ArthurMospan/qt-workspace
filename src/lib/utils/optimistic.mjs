// src/lib/utils/optimistic.mjs — pure logic behind optimistic drag & drop.
//
// Every board in the app renders a Firestore snapshot directly. A drop
// therefore had no visible effect until the write echoed back, and
// @hello-pangea/dnd — which can only animate into the list it can see — played
// its drop animation back to the *source* slot, after which the echo re-rendered
// the card somewhere else. That two-step is the flicker users complained about.
//
// The fix is to overlay the pending result on top of the snapshot synchronously
// inside onDragEnd, then drop the overlay once the snapshot agrees with it.
// These helpers hold the parts worth testing without React or Firestore.

// Fields that come back from Firestore in exactly the shape we send them, so an
// overlay on them can be compared against the snapshot and retired reliably.
// Anything else (timestamps, rich text, sentinels) is left to the round-trip.
const PATCHABLE_FIELDS = [
  'columnId',
  'status',
  'order',
  'sprintId',
  'parentEpicId',
  'assigneeIds',
  'priority',
];

// Firestore sentinels (serverTimestamp, deleteField, arrayUnion…) and Timestamps
// are objects that never equal the value the snapshot returns for them.
function isMirrorable(value) {
  if (Array.isArray(value)) return value.every(v => typeof v !== 'object' || v === null);
  return value === null || typeof value !== 'object';
}

/** Column a card currently lives in, tolerating docs that predate `columnId`. */
export function columnOf(issue) {
  return issue?.columnId ?? issue?.status ?? null;
}

function createdMillis(issue) {
  return issue?.createdAt?.toMillis?.() ?? 0;
}

/**
 * Total ordering for issues: explicitly ordered cards first (ascending), then
 * everything else by creation time. Totality matters — the list is sorted once
 * from the snapshot and again after the overlay is merged, and an ambiguous
 * comparator would let cards swap places between those passes.
 */
export function compareIssues(a, b) {
  const ao = a?.order;
  const bo = b?.order;
  if (ao !== undefined && bo !== undefined) return ao - bo;
  if (ao !== undefined) return -1;
  if (bo !== undefined) return 1;
  return createdMillis(a) - createdMillis(b);
}

/** True when `actual` already holds `expected` (arrays compared by value). */
export function sameValue(actual, expected) {
  if (Array.isArray(expected)) {
    return Array.isArray(actual)
      && actual.length === expected.length
      && expected.every((value, i) => actual[i] === value);
  }
  if (expected === null) return actual === null || actual === undefined;
  return actual === expected;
}

/** True when the snapshot doc has caught up with every field of the overlay. */
export function patchLanded(doc, patch) {
  return Object.entries(patch).every(([key, value]) => sameValue(doc[key], value));
}

/** Narrow an arbitrary update to the fields that are safe to mirror locally. */
export function pickPatchableFields(data) {
  if (!data) return null;
  const patch = {};
  for (const field of PATCHABLE_FIELDS) {
    if (!(field in data)) continue;
    const value = data[field];
    if (value === undefined || !isMirrorable(value)) continue;
    patch[field] = value;
  }
  return Object.keys(patch).length ? patch : null;
}

/**
 * Merge pending overlays into a snapshot list. Returns the original array
 * untouched when no overlay applies, so consumers keep referential stability
 * and React can skip the re-render.
 */
export function applyPatches(items, patches) {
  if (!patches || !items?.length) return items;
  let touched = false;
  const merged = items.map(item => {
    const patch = patches[item.id];
    if (!patch) return item;
    touched = true;
    return { ...item, ...patch };
  });
  return touched ? merged : items;
}

/**
 * Drop overlays the snapshot has caught up with (and overlays for cards that no
 * longer exist). Returns the same reference when nothing changed, `null` when
 * everything has landed.
 */
export function prunePatches(items, patches) {
  if (!patches) return null;
  const byId = new Map((items || []).map(item => [item.id, item]));
  const remaining = {};
  let dropped = 0;

  for (const [id, patch] of Object.entries(patches)) {
    const doc = byId.get(id);
    if (!doc || patchLanded(doc, patch)) {
      dropped += 1;
      continue;
    }
    remaining[id] = patch;
  }

  if (!dropped) return patches;
  return Object.keys(remaining).length ? remaining : null;
}

/**
 * Work out the full result of dropping `issueId` at `targetIndex` of
 * `targetColumnId`. The returned patch map is the single description of the
 * move: the board paints it immediately and the Firestore batch writes exactly
 * the same values, so the overlay retires the moment the echo arrives instead
 * of fighting it.
 *
 * Cards whose position is unchanged are left out of the patch map — they need
 * neither a repaint nor a write.
 */
export function planMove(issues, issueId, targetColumnId, targetIndex) {
  const moving = (issues || []).find(issue => issue.id === issueId);
  if (!moving) return null;

  const column = issues
    .filter(issue => issue.id !== issueId && columnOf(issue) === targetColumnId)
    .sort(compareIssues);

  const requested = Number.isFinite(Number(targetIndex)) ? Math.trunc(Number(targetIndex)) : 0;
  const insertAt = Math.min(Math.max(0, requested), column.length);
  const ordered = [...column.slice(0, insertAt), moving, ...column.slice(insertAt)];

  const patches = {};
  ordered.forEach((issue, index) => {
    if (issue.id === issueId) {
      patches[issue.id] = { columnId: targetColumnId, status: targetColumnId, order: index };
      return;
    }
    if (issue.order !== index) patches[issue.id] = { order: index };
  });

  return { from: columnOf(moving), insertAt, ordered, patches };
}
