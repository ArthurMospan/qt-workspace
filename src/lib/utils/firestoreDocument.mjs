// A Firestore document's path is its identity. Some legacy records also carry
// an `id` field in their data, but that denormalized copy may be stale (and the
// browser SDK may keep that stale value in IndexedDB). Always apply the path id
// after the stored data so cache contents can never redirect one resource to
// another.
export function firestoreDocumentData(document, options) {
  return {
    ...document.data(options),
    id: document.id,
  };
}
