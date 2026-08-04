import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function markIssueSeen({ organizationId, issueId, userId, lastSeenAt }) {
  if (!organizationId || !issueId || !userId || !lastSeenAt) return;
  await setDoc(
    doc(db, 'organizations', organizationId, 'issueReadState', `${userId}_${issueId}`),
    {
      userId,
      issueId,
      lastSeenAt,
    },
    { merge: true },
  );
}
