const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const {firebaseProjectId,firebaseClientEmail,firebasePrivateKey,} = require("./env");

function initFirebaseAdmin() {
  if (getApps().length > 0) {
    const app = getApps()[0];
    return { app, auth: getAuth(app) };
  }

  const app = initializeApp({
    credential: cert({
      projectId: firebaseProjectId,
      clientEmail: firebaseClientEmail,
      privateKey: firebasePrivateKey,
    }),
  });

  console.log("Firebase Admin initialized:", app.name);
  return { app, auth: getAuth(app) };
}

module.exports = initFirebaseAdmin();
