// How many documents a screen actually read.
//
// docs/ROADMAP.md states the gap plainly: «Production runs on Firestore's free
// read quota… What is still missing is the half before that: nothing counts
// documents read, so "which screen spent it" can only be answered by reading
// code.» This is that half.
//
// It counts what Firestore bills, which is not the same as what a listener
// emits. A snapshot delivered from the local cache costs nothing, and after the
// first attach a listener is charged only for documents that changed — so
// counting `docs.length` on every emission would report a number several times
// larger than the bill and would be worse than no number at all. Two rules
// follow:
//
//   • a snapshot whose metadata says `fromCache` is not counted;
//   • only `docChanges()` are counted, which on the first delivery is every
//     document and afterwards is what moved.
//
// Nothing here is a decision the product makes. It never throws, never awaits,
// and holds a few dozen integers; a meter that could break a screen would be a
// worse trade than not knowing.

const totals = new Map();
let startedAt = Date.now();

/** @returns {number} how many documents this delivery is billed for. */
export function billedDocumentCount(snapshot) {
  if (!snapshot || snapshot.metadata?.fromCache) return 0;
  if (typeof snapshot.docChanges === 'function') {
    try {
      return snapshot.docChanges().length;
    } catch {
      // A snapshot from a source that does not implement it — fall through.
    }
  }
  return Array.isArray(snapshot.docs) ? snapshot.docs.length : 0;
}

/**
 * Records one delivery.
 *
 * @param {string} scope What is reading — a hook name, not a screen: one hook
 *   may serve several screens and it is the query that costs money.
 * @param {object} snapshot A Firestore QuerySnapshot.
 * @returns {number} what was added, so a caller can log it in place.
 */
export function countRead(scope, snapshot) {
  const documents = billedDocumentCount(snapshot);
  if (documents <= 0) return 0;
  const current = totals.get(scope) || { documents: 0, deliveries: 0 };
  current.documents += documents;
  current.deliveries += 1;
  totals.set(scope, current);
  return documents;
}

/** Everything counted since the page loaded, widest first. */
export function readMeterSnapshot() {
  const rows = [...totals.entries()]
    .map(([scope, value]) => ({ scope, ...value }))
    .sort((left, right) => right.documents - left.documents);
  return {
    since: new Date(startedAt).toISOString(),
    documents: rows.reduce((sum, row) => sum + row.documents, 0),
    byScope: rows,
  };
}

export function resetReadMeter() {
  totals.clear();
  startedAt = Date.now();
}

// The meter has no screen, on purpose.
//
// «Which screen spent the quota» is a question asked while looking at a
// browser, a handful of times, by whoever is investigating — not a number a
// workspace needs on a page. A console handle answers it completely and costs
// no layout, no read of its own, and nothing to keep in sync:
//
//   qtReads()        → { documents, byScope: [{ scope, documents, deliveries }] }
//   qtReads.reset()
//
// Attached from the authenticated layout, so it exists exactly where the wide
// queries do.
export function exposeReadMeter() {
  if (typeof window === 'undefined') return;
  const handle = () => readMeterSnapshot();
  handle.reset = resetReadMeter;
  window.qtReads = handle;
}
