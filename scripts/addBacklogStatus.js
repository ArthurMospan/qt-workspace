const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function run() {
  const orgs = await db.collection("organizations").get();
  for (const org of orgs.docs) {
    const docRef = db.doc(`organizations/${org.id}/settings/workflow`);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const data = docSnap.data();
      if (data.statuses && !data.statuses.some(s => s.id === "backlog")) {
        data.statuses.unshift({ id: "backlog", label: "Backlog", color: "#9a9a9a", emoji: "📋" });
        await docRef.update({ statuses: data.statuses });
        console.log(`Added backlog to org ${org.id}`);
      } else {
        console.log(`Org ${org.id} already has backlog or no statuses array.`);
      }
    } else {
      console.log(`Org ${org.id} has no workflow settings yet.`);
    }
  }
  console.log("Done");
  process.exit(0);
}

run().catch(console.error);
